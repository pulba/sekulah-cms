import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { eq, desc, asc, and, ne, or, isNull, isNotNull, like, sql, inArray } from 'drizzle-orm';
import { db, settings, announcements, agendas, articles, categories, teachers, documents, users, auditLogs, galleries, studentsAlumni, media, heroSlides, extracurriculars, facilities, registrations, ppdbFormVersions, navigationItems, graduations, bkkOpportunities, mahadPrograms, studentEnrollmentStats, graduationTracerStats, partners } from '../db';
import { getDefaultPpdbConfig, resolvePpdbPortal, type PpdbFullConfig } from '../utils/ppdbConfigDefaults';
import {
  createSession,
  validateSession,
  revokeSession,
  checkLoginRateLimit,
  recordLoginAttempt,
  verifyPassword,
  hashPassword,
  getClientIp,
  signPreviewToken,
  verifyPreviewToken,
} from './auth';
import { createDatabaseSnapshot, restoreDatabaseSnapshot } from './backup';
import {
  validateUploadedDocument,
  savePpdbDocument,
  getPpdbDocument,
} from './ppdbStorage';
import { invalidateSettingsCache } from '../utils/settingsCache';
import { sanitizeArticleHtml } from '../utils/sanitizeHtml';
import { verifySessionToken } from '../lib/auth-server';

const app = new Hono().basePath('/api');

// Global Correlation ID Tracking (Observability Sprint 3)
app.use('*', async (c, next) => {
  const correlationId = c.req.header('x-correlation-id') || crypto.randomUUID();
  c.set('correlationId' as any, correlationId);
  await next();
  c.res.headers.set('X-Correlation-ID', correlationId);
});

// Centralized Global Error Handler (TC-20: No raw stack traces or internal leaks in production)
app.onError((err, c) => {
  const correlationId = (c.get('correlationId' as any) as string) || crypto.randomUUID();
  const ip = getClientIp(c);
  console.error(`[ERROR] [${new Date().toISOString()}] [CID: ${correlationId}] [IP: ${ip}] ${c.req.method} ${c.req.url} - ${err.message}`);

  return c.json(
    {
      success: false,
      error: 'Terjadi kesalahan internal pada server institusi. Silakan hubungi tim IT dengan menyertakan ID pelacakan.',
      correlationId,
    },
    500
  );
});

// Global Logger & CORS
app.use('*', logger());
app.use('*', cors());

// Proteksi CSRF & Validasi Origin untuk request mutasi (POST, PUT, DELETE, PATCH)
app.use('*', async (c, next) => {
  const method = c.req.method;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    // Exempt: logout tidak membawa data sensitif, cukup hapus cookie
    const path = new URL(c.req.url).pathname;
    if (path === '/auth/logout') return next();

    const origin = c.req.header('origin');
    const host = c.req.header('host');
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const isLocal = originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
        // Cloudflare Workers: strip port from host before comparing
        const hostStripped = host.split(':')[0];
        const originStripped = originUrl.hostname;
        if (originStripped !== hostStripped && !isLocal) {
          return c.json({ success: false, error: 'Akses ditolak: Permintaan lintas domain (CSRF) terdeteksi' }, 403);
        }
      } catch {
        return c.json({ success: false, error: 'Header origin tidak valid' }, 403);
      }
    }
  }
  return next();
});

// ==========================================
// 1. AUTENTIKASI STAF & GURU (Sprint 1 Keamanan)
// ==========================================
app.post('/auth/login', async (c) => {
  const ipAddress = getClientIp(c);

  // Rate Limiting: Maksimal 5 percobaan gagal per IP dalam 15 menit
  const rateLimit = await checkLoginRateLimit(ipAddress);
  if (!rateLimit.allowed) {
    return c.json(
      {
        success: false,
        error: `Terlalu banyak percobaan login yang gagal. Akses dari IP ini dibatasi sementara selama ${rateLimit.resetMinutes} menit demi keamanan institusi.`,
      },
      429
    );
  }

  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Format JSON request tidak valid' }, 400);
    }

    const { email, password } = body || {};

    if (!email || !password) {
      return c.json({ success: false, error: 'Email dan kata sandi wajib diisi' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Cari akun staf aktif di database
    const user = await db
      .select()
      .from(users)
      .where(and(eq(users.email, normalizedEmail), eq(users.isActive, true)))
      .limit(1)
      .then((r) => r[0]);

    if (!user) {
      // Catat kegagalan login untuk mitigasi brute force
      await recordLoginAttempt(ipAddress, normalizedEmail, false);
      return c.json({ success: false, error: 'Kredensial login tidak valid' }, 401);
    }

    // Verifikasi Password (PBKDF2 atau fallback awal)
    const isPasswordValid = await verifyPassword(String(password), user.passwordHash);
    if (!isPasswordValid) {
      await recordLoginAttempt(ipAddress, normalizedEmail, false);
      return c.json({ success: false, error: 'Kredensial login tidak valid' }, 401);
    }

    // Login Berhasil -> Reset catatan percobaan gagal IP ini
    await recordLoginAttempt(ipAddress, normalizedEmail, true);

    // Auto-upgrade password hash jika belum memakai standar PBKDF2
    if (!user.passwordHash || !user.passwordHash.startsWith('pbkdf2:')) {
      const newHash = await hashPassword(String(password));
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    }

    // Buat sesi kriptografis terdaftar di database
    const signedToken = await createSession({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      role: user.role as 'super_admin' | 'editor',
      ipAddress,
      userAgent: c.req.header('user-agent'),
    });

    const isProd = process.env.NODE_ENV === 'production';
    setCookie(c, 'auth_session', signedToken, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });

    // Catat log audit login berhasil
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
      details: 'Pengguna berhasil masuk ke dashboard CMS dengan token sesi terverifikasi',
      ipAddress,
    });

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/auth/logout', async (c) => {
  const isProd = c.req.url.startsWith('https://');
  const cmsCookie = getCookie(c, 'cms_session');
  if (cmsCookie) {
    const payload = await verifySessionToken(cmsCookie).catch(() => null);
    if (payload) {
      await db.insert(auditLogs).values({
        userId: payload.uid,
        userEmail: payload.email,
        action: 'LOGOUT',
        entity: 'user',
        entityId: payload.uid,
        details: 'Pengguna keluar dari sesi CMS (sesi JWT Google/Firebase dicabut)',
        ipAddress: getClientIp(c),
      }).catch(() => null);
    }
  }

  const cookie = getCookie(c, 'auth_session');
  if (cookie) {
    const session = await validateSession(cookie).catch(() => null);
    if (session) {
      await db.insert(auditLogs).values({
        userId: session.user.id,
        userEmail: session.user.email,
        action: 'LOGOUT',
        entity: 'user',
        entityId: session.user.id,
        details: 'Pengguna keluar dari sesi CMS (sesi dicabut dari server)',
        ipAddress: getClientIp(c),
      }).catch(() => null);
    }
    // Cabut sesi secara permanen di database
    await revokeSession(cookie).catch(() => null);
  }

  const cookieOpts = { path: '/', secure: isProd, httpOnly: true, sameSite: 'Lax' as const };
  deleteCookie(c, 'auth_session', cookieOpts);
  deleteCookie(c, 'cms_session', cookieOpts);
  return c.json({ success: true, message: 'Berhasil keluar' });
});

app.get('/auth/me', async (c) => {
  const cmsCookie = getCookie(c, 'cms_session');
  if (cmsCookie) {
    const payload = await verifySessionToken(cmsCookie).catch(() => null);
    if (payload) {
      return c.json({
        success: true,
        user: {
          id: payload.uid,
          email: payload.email,
          name: payload.name,
          role: payload.role === 'admin' ? 'super_admin' : payload.role,
          photoUrl: payload.photoUrl,
        },
      });
    } else {
      deleteCookie(c, 'cms_session', { path: '/' });
    }
  }

  const cookie = getCookie(c, 'auth_session');
  if (!cookie) {
    return c.json({ success: false, error: 'Belum terautentikasi' }, 401);
  }

  const session = await validateSession(cookie);
  if (!session) {
    deleteCookie(c, 'auth_session', { path: '/' });
    return c.json({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa' }, 401);
  }

  return c.json({ success: true, user: session.user });
});

app.put('/auth/change-password', async (c) => {
  try {
    const cookie = getCookie(c, 'auth_session');
    if (!cookie) {
      return c.json({ success: false, error: 'Belum terautentikasi' }, 401);
    }

    const session = await validateSession(cookie);
    if (!session) {
      deleteCookie(c, 'auth_session', { path: '/' });
      return c.json({ success: false, error: 'Sesi tidak valid atau telah kedaluwarsa' }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body || {};

    if (!currentPassword || !newPassword) {
      return c.json({ success: false, error: 'Kata sandi saat ini dan kata sandi baru wajib diisi' }, 400);
    }

    if (String(newPassword).length < 8) {
      return c.json({ success: false, error: 'Kata sandi baru minimal 8 karakter' }, 400);
    }

    const userRecord = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!userRecord) {
      return c.json({ success: false, error: 'Akun staf tidak ditemukan' }, 404);
    }

    const isMatch = await verifyPassword(String(currentPassword), userRecord.passwordHash);
    if (!isMatch) {
      return c.json({ success: false, error: 'Kata sandi saat ini salah' }, 400);
    }

    const newHash = await hashPassword(String(newPassword));
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userRecord.id));

    await db.insert(auditLogs).values({
      userId: userRecord.id,
      userEmail: userRecord.email,
      action: 'UPDATE',
      entity: 'user',
      entityId: userRecord.id,
      details: 'Pengguna memperbarui kata sandi akun secara mandiri',
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Kata sandi berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 2. ENDPOINT PUBLIK
// ==========================================
app.get('/health', async (c) => {
  try {
    // Dynamic database connectivity check
    await db.select({ val: sql`1` }).from(settings).limit(1);
    return c.json({
      status: 'ok',
      database: 'connected',
      version: '1.0.0',
      system: 'School CMS Backend API',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json(
      {
        status: 'degraded',
        database: 'disconnected',
        error: 'Koneksi basis data terganggu',
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

app.get('/settings', async (c) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingsMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    return c.json({ success: true, data: settingsMap });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/announcements', async (c) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const list = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          or(isNull(announcements.expiresAt), sql`${announcements.expiresAt} >= ${today}`)
        )
      )
      .orderBy(desc(announcements.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.get('/agendas', async (c) => {
  try {
    const list = await db.select().from(agendas).orderBy(agendas.eventDate);
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.get('/articles', async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit')) || 10, 50);
    const categorySlug = c.req.query('kategori') || c.req.query('category');
    const nowIso = new Date().toISOString();

    const conditions: any[] = [
      isNull(articles.deletedAt),
      eq(articles.status, 'published'),
      sql`${articles.publishedAt} <= ${nowIso}`,
    ];

    if (categorySlug) {
      const foundCat = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, categorySlug)).limit(1).then(r => r[0]);
      if (foundCat) {
        conditions.push(eq(articles.categoryId, foundCat.id));
      }
    }

    const list = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        coverImage: articles.coverImage,
        categoryId: articles.categoryId,
        categoryName: categories.name,
        categorySlug: categories.slug,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(desc(articles.publishedAt))
      .limit(limit);

    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.get('/articles/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const previewToken = c.req.query('preview_token');

    let isPreview = false;
    if (previewToken) {
      const verified = await verifyPreviewToken(previewToken);
      if (verified && verified.slug === slug) {
        isPreview = true;
      }
    }

    const conditions: any[] = [eq(articles.slug, slug), isNull(articles.deletedAt)];
    if (!isPreview) {
      conditions.push(eq(articles.status, 'published'));
      conditions.push(sql`${articles.publishedAt} <= ${new Date().toISOString()}`);
    }

    const article = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        content: articles.content,
        coverImage: articles.coverImage,
        categoryId: articles.categoryId,
        categoryName: categories.name,
        status: articles.status,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        metaTitle: articles.metaTitle,
        metaDescription: articles.metaDescription,
        authorName: users.name,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(and(...conditions))
      .limit(1)
      .then((res) => res[0]);

    if (!article) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan atau belum dipublikasikan' }, 404);
    }

    // Hanya naikkan viewCount untuk pembaca publik sah (bukan staf pratinjau draf)
    if (!isPreview) {
      await db
        .update(articles)
        .set({ viewCount: article.viewCount + 1 })
        .where(eq(articles.id, article.id));
    }

    return c.json({ success: true, data: article, isPreview });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/teachers', async (c) => {
  try {
    const list = await db
      .select()
      .from(teachers)
      .where(eq(teachers.isActive, true))
      .orderBy(teachers.orderNumber);
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.get('/documents', async (c) => {
  try {
    const list = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



// Rate Limiter Unduh Dokumen: Maksimal 5 unduhan per IP per dokumen per menit
const documentDownloadAttempts = new Map<string, { count: number; resetAt: number }>();

// Endpoint unduh berkas publik dengan counter download_count dan proteksi Rate Limiting IP (TC-16)
app.post('/documents/:id/download', async (c) => {
  const ip = getClientIp(c);
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'ID dokumen tidak valid' }, 400);
  }

  // Rate Limiting IP: Maks 5 unduhan per IP per dokumen dalam jendela 60 detik
  const now = Date.now();
  const rateLimitKey = `${ip}_doc_${id}`;
  const record = documentDownloadAttempts.get(rateLimitKey);
  if (record && record.resetAt > now) {
    if (record.count >= 5) {
      return c.json(
        {
          success: false,
          error: 'Terlalu banyak permintaan unduh dokumen. Mohon tunggu 1 menit.',
        },
        429
      );
    }
    record.count++;
  } else {
    documentDownloadAttempts.set(rateLimitKey, { count: 1, resetAt: now + 60000 });
  }

  // Pembersihan berkala jika cache in-memory melebihi 1000 entri
  if (documentDownloadAttempts.size > 1000) {
    for (const [key, val] of documentDownloadAttempts.entries()) {
      if (val.resetAt <= now) {
        documentDownloadAttempts.delete(key);
      }
    }
  }

  try {
    const doc = await db.select().from(documents).where(eq(documents.id, id)).limit(1).then((r) => r[0]);
    if (!doc) {
      return c.json({ success: false, error: 'Dokumen tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(documents)
      .set({ downloadCount: sql`${documents.downloadCount} + 1` })
      .where(eq(documents.id, id))
      .returning({ downloadCount: documents.downloadCount });

    const newCount = updated[0]?.downloadCount ?? (doc.downloadCount + 1);

    return c.json({ success: true, fileUrl: doc.fileUrl, downloadCount: newCount });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint penambahan counter view artikel berita publik (Non-blocking, Anti-Bot & Anti-Spam F5)
app.post('/articles/:id/view', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (!id || isNaN(id)) {
      return c.json({ success: false, error: 'ID artikel tidak valid' }, 400);
    }

    // 1. Filter Bot & Crawler (Cloudflare verified bot header & User-Agent regex)
    const isCfVerifiedBot = c.req.header('cf-verified-bot') === 'true';
    const userAgent = c.req.header('user-agent') || '';
    const isBot =
      isCfVerifiedBot ||
      /bot|crawler|spider|crawling|slurp|bingbot|googlebot|yandex|baiduspider|facebookexternalhit|whatsapp|telegrambot/i.test(
        userAgent
      );

    if (isBot) {
      return c.json({ success: true, ignored: true, reason: 'bot_detected' });
    }

    // 2. Anti-Spam F5: Dedup 24 Jam via Cookie 'art_v_{id}'
    const cookieKey = `art_v_${id}`;
    const viewedCookie = getCookie(c, cookieKey);
    if (viewedCookie) {
      return c.json({ success: true, dedup: true });
    }

    // 3. Update viewCount secara atomik di database
    const result = await db
      .update(articles)
      .set({ viewCount: sql`${articles.viewCount} + 1` })
      .where(and(eq(articles.id, id), eq(articles.status, 'published'), isNull(articles.deletedAt)))
      .returning({ id: articles.id, viewCount: articles.viewCount });

    if (!result || result.length === 0) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan atau belum diterbitkan' }, 404);
    }

    // 4. Set Cookie 24 Jam (86400 detik)
    setCookie(c, cookieKey, '1', {
      maxAge: 86400,
      path: '/',
      sameSite: 'Lax',
      httpOnly: true,
    });

    return c.json({ success: true, viewCount: result[0].viewCount });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint Galeri Publik
app.get('/galleries', async (c) => {
  try {
    const list = await db.select().from(galleries).orderBy(desc(galleries.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint Mitra & Rekanan Publik
app.get('/partners', async (c) => {
  try {
    const list = await db
      .select()
      .from(partners)
      .where(eq(partners.isActive, true))
      .orderBy(asc(partners.orderNumber), desc(partners.id));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



// Endpoint Prestasi & Alumni Publik (Hanya yang berstatus izin persetujuan publik)
app.get('/students_alumni', async (c) => {
  try {
    const type = c.req.query('type') as 'achievement' | 'alumni' | undefined;
    const conditions: any[] = [eq(studentsAlumni.isPublicConsent, true)];
    if (type) {
      conditions.push(eq(studentsAlumni.type, type));
    }
    const list = await db
      .select()
      .from(studentsAlumni)
      .where(and(...conditions))
      .orderBy(desc(studentsAlumni.year));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint Pengiriman Tracer Study Mandiri Alumni Publik
app.post('/alumni/submit', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name?.trim() || !body.year?.trim() || !body.title?.trim()) {
      return c.json({ success: false, error: 'Nama lengkap, tahun kelulusan, dan status profesi/jurusan wajib diisi' }, 400);
    }

    const inserted = await db
      .insert(studentsAlumni)
      .values({
        name: body.name.trim(),
        type: 'alumni',
        title: body.title.trim(),
        year: String(body.year).trim(),
        organization: body.organization ? body.organization.trim() : null,
        photoUrl: body.photoUrl ? body.photoUrl.trim() : null,
        description: body.description ? body.description.trim() : null,
        isPublicConsent: body.isPublicConsent !== false,
      })
      .returning();

    return c.json({
      success: true,
      message: 'Terima kasih! Data tracer study Anda berhasil dikirimkan.',
      data: inserted[0],
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || 'Terjadi kesalahan sistem' }, 500);
  }
});

// Endpoint Banner Slider Hero Publik
app.get('/sliders', async (c) => {
  try {
    const list = await db
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.isActive, true))
      .orderBy(asc(heroSlides.orderNumber));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



// Endpoint Navigasi Website Dinamis Publik
app.get('/navigation', async (c) => {
  try {
    const items = await db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.isActive, true))
      .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.createdAt));
    return c.json({ success: true, data: items });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 2.8. KONFIGURASI FORMULIR PPDB DINAMIS (Published vs Draft Preview)
// ==========================================
app.get('/ppdb/config', async (c) => {
  try {
    const isDraftRequested = c.req.query('draft') === 'true';

    // Ambil setting sekolah saat ini
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const schoolType = (settingMap['school_type'] || settingMap['school_level'] || 'SMA').toUpperCase();
    const schoolName = settingMap['school_name'] || 'SMAN 1 Unggulan';
    const boardingAvailable = settingMap['boarding_available'] === 'true';

    // Cek jika draft diminta oleh staf admin terotentikasi
    if (isDraftRequested) {
      const cookie = getCookie(c, 'auth_session');
      if (cookie) {
        const session = await validateSession(cookie).catch(() => null);
        if (session) {
          const draftJson = settingMap['ppdb_form_config_draft'];
          if (draftJson) {
            try {
              const parsedDraft = JSON.parse(draftJson);
              return c.json({ success: true, data: parsedDraft, isDraft: true });
            } catch {}
          }
        }
      }
    }

    // Ambil published config
    const publishedJson = settingMap['ppdb_form_config'];
    if (publishedJson) {
      try {
        const parsed = JSON.parse(publishedJson);
        parsed.schoolName = schoolName;
        parsed.schoolType = schoolType;
        parsed.services.boardingAvailableInSchool = boardingAvailable;
        return c.json({ success: true, data: parsed, isDraft: false });
      } catch {}
    }

    // Fallback: Inisialisasi default berdasarkan jenis satuan institusi
    const defaultConfig = getDefaultPpdbConfig(schoolType, schoolName, boardingAvailable);
    const jsonStr = JSON.stringify(defaultConfig);
    const existing = await db.select().from(settings).where(eq(settings.key, 'ppdb_form_config')).limit(1).then(r => r[0]);
    if (existing) {
      await db.update(settings).set({ value: jsonStr }).where(eq(settings.key, 'ppdb_form_config'));
    } else {
      await db.insert(settings).values({ key: 'ppdb_form_config', value: jsonStr });
    }
    invalidateSettingsCache();

    return c.json({ success: true, data: defaultConfig, isDraft: false });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 2.9. PENDAFTARAN PESERTA DIDIK BARU (PPDB) DENGAN KEAMANAN PRODUKSI
// ==========================================
app.post('/ppdb/register', async (c) => {
  const ipAddress = getClientIp(c);

  try {
    const contentType = c.req.header('content-type') || '';
    let body: Record<string, any> = {};
    const uploadedFiles: Record<string, File> = {};

    if (contentType.includes('multipart/form-data')) {
      try {
        const parsed = await c.req.parseBody();
        for (const [k, v] of Object.entries(parsed)) {
          if (v instanceof File) {
            if (v.size > 0 && v.name) {
              uploadedFiles[k] = v;
            }
          } else if (typeof v === 'string') {
            body[k] = v.trim();
          } else {
            body[k] = v;
          }
        }
      } catch (err: any) {
        return c.json({ success: false, error: 'Gagal memproses berkas formulir: ' + (err.message || 'Format tidak valid') }, 400);
      }
    } else {
      try {
        body = await c.req.json();
      } catch {
        return c.json({ success: false, error: 'Format payload permintaan pendaftaran tidak valid.' }, 400);
      }
    }

    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Data formulir tidak boleh kosong.' }, 400);
    }

    // 1. Ambil Konfigurasi Aktual dari Database & Evaluasi Status Portal Server
    const allSettings = await db.select().from(settings);
    const config = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const schoolType = (config['school_type'] || config['school_level'] || 'SMA').toUpperCase();
    const schoolName = config['school_name'] || 'SMAN 1 Unggulan';
    const boardingAvailable = config['boarding_available'] === 'true';

    let fullConfig: PpdbFullConfig;
    if (config['ppdb_form_config']) {
      try {
        fullConfig = JSON.parse(config['ppdb_form_config']);
      } catch {
        fullConfig = getDefaultPpdbConfig(schoolType, schoolName, boardingAvailable);
      }
    } else {
      fullConfig = getDefaultPpdbConfig(schoolType, schoolName, boardingAvailable);
    }

    // Resolusi status portal aktual secara ketat di server (WIB Asia/Jakarta)
    const portalResolution = resolvePpdbPortal(fullConfig, new Date());
    if (portalResolution.effectiveStatus !== 'opened' || !portalResolution.activeWave) {
      if (portalResolution.effectiveStatus === 'upcoming') {
        const nextWaveName = portalResolution.nextWave?.name || 'Gelombang Baru';
        const nextWaveDate = portalResolution.nextWave?.startDate || '';
        return c.json(
          {
            success: false,
            error: `Pendaftaran peserta didik baru belum dibuka. ${nextWaveName} dijadwalkan dibuka pada ${nextWaveDate} pukul 00.00.00 WIB.`,
          },
          400
        );
      }
      return c.json(
        {
          success: false,
          error: portalResolution.reason || 'Pendaftaran peserta didik baru (PPDB) saat ini sedang ditutup atau seluruh periode pendaftaran telah berakhir.',
        },
        400
      );
    }

    const assignedWave = portalResolution.activeWave;

    // Resolusi Tahun Ajaran & Batas Kuota Gelombang dari Server
    const academicYear = fullConfig.academicYear || config['ppdb_year'] || '2026/2027';
    const ppdbBoardingEnabled = config['ppdb_boarding_enabled'] === 'true' || (boardingAvailable && config['ppdb_boarding_enabled'] !== 'false');

    // Validasi kuota pendaftaran gelombang jika ditentukan
    if (assignedWave.quota && assignedWave.quota > 0) {
      const currentQuotaCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(registrations)
        .where(and(eq(registrations.academicYear, academicYear), eq(registrations.wave, assignedWave.name)))
        .then((r) => Number(r[0]?.count) || 0);

      if (currentQuotaCount >= assignedWave.quota) {
        return c.json(
          {
            success: false,
            error: `Alokasi kuota pendaftaran untuk ${assignedWave.name} telah terpenuhi (${currentQuotaCount}/${assignedWave.quota} siswa). Silakan menunggu pembukaan periode berikutnya.`,
          },
          400
        );
      }
    }

    // 2. Validasi Relasi Bisnis & Anti-Tampering
    const clientSchoolType = String(body.schoolType || body.school_type || schoolType).toUpperCase();
    if (clientSchoolType !== schoolType) {
      return c.json(
        {
          success: false,
          error: `Jenis satuan pendidikan (${clientSchoolType}) tidak sesuai dengan konfigurasi institusi (${schoolType}).`,
        },
        400
      );
    }

    const isBoardingRequested = body.isBoarding === true || body.is_boarding === 'true' || body.is_boarding === true;
    if (isBoardingRequested && !ppdbBoardingEnabled) {
      return c.json(
        {
          success: false,
          error: 'Layanan asrama/pesantren tidak tersedia untuk pendaftaran di sekolah ini.',
        },
        400
      );
    }

    // 3. Validasi Field & Sanitasi Input (Zero-Trust Validation)
    const fullName = String(body.fullName || body.full_name || '').trim();
    if (!fullName || fullName.length < 3 || fullName.length > 100) {
      return c.json({ success: false, error: 'Nama lengkap calon siswa wajib diisi (antara 3 s.d. 100 karakter).' }, 400);
    }
    // Nama mendukung huruf Latin, tanda petik, titik, tanda hubung, spasi
    const nameRegex = /^[a-zA-Z\s\.\'\`\-\u00C0-\u024F]+$/;
    if (!nameRegex.test(fullName)) {
      return c.json({ success: false, error: 'Nama lengkap mengandung karakter yang tidak diizinkan.' }, 400);
    }

    // NIK: Tepat 16 digit string numerik (pengenal unik, bukan number)
    const nik = String(body.nik || '').trim();
    if (!/^\d{16}$/.test(nik)) {
      return c.json({ success: false, error: 'Nomor Induk Kependudukan (NIK) calon siswa wajib tepat 16 digit angka numerik.' }, 400);
    }

    // NISN: String 10 digit jika diisi
    const nisn = body.nisn ? String(body.nisn).trim() : null;
    if (nisn && !/^\d{10}$/.test(nisn)) {
      return c.json({ success: false, error: 'NISN harus terdiri dari 10 digit angka numerik.' }, 400);
    }

    // Gender: L / P / Laki-laki / Perempuan
    const rawGender = String(body.gender || '').trim().toUpperCase();
    let gender = '';
    if (rawGender === 'L' || rawGender.startsWith('LAKI')) {
      gender = 'L';
    } else if (rawGender === 'P' || rawGender.startsWith('PEREMPUAN')) {
      gender = 'P';
    }
    if (!gender) {
      return c.json({ success: false, error: 'Jenis kelamin wajib dipilih (Laki-laki / Perempuan).' }, 400);
    }

    // Tempat Lahir
    const birthPlace = String(body.birthPlace || body.birth_place || '').trim();
    if (!birthPlace || birthPlace.length < 2) {
      return c.json({ success: false, error: 'Tempat lahir wajib diisi.' }, 400);
    }

    // Tanggal Lahir: Validasi format & batas usia wajar
    const birthDate = String(body.birthDate || body.birth_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return c.json({ success: false, error: 'Format tanggal lahir harus YYYY-MM-DD.' }, 400);
    }
    const bDate = new Date(birthDate);
    const now = new Date();
    if (isNaN(bDate.getTime()) || bDate > now) {
      return c.json({ success: false, error: 'Tanggal lahir tidak valid atau berada di masa depan.' }, 400);
    }
    const ageYears = (now.getTime() - bDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 5 || ageYears > 26) {
      return c.json({ success: false, error: 'Usia calon peserta didik tidak memenuhi batas ketentuan penerimaan (5 - 25 tahun).' }, 400);
    }

    // Agama
    const religion = String(body.religion || '').trim();
    if (!religion) {
      return c.json({ success: false, error: 'Agama calon siswa wajib dipilih.' }, 400);
    }

    // Sekolah Asal
    const prevSchool = String(body.prevSchool || body.prev_school || '').trim();
    if (!prevSchool || prevSchool.length < 3) {
      return c.json({ success: false, error: 'Nama sekolah asal calon siswa wajib diisi.' }, 400);
    }

    // Orang Tua
    const fatherName = String(body.fatherName || body.father_name || '').trim();
    if (!fatherName || fatherName.length < 2) {
      return c.json({ success: false, error: 'Nama ayah kandung wajib diisi.' }, 400);
    }
    const motherName = String(body.motherName || body.mother_name || '').trim();
    if (!motherName || motherName.length < 2) {
      return c.json({ success: false, error: 'Nama ibu kandung wajib diisi.' }, 400);
    }

    // NIK Orang Tua jika diisi
    const fatherNik = body.fatherNik || body.father_nik ? String(body.fatherNik || body.father_nik).trim() : null;
    if (fatherNik && !/^\d{16}$/.test(fatherNik)) {
      return c.json({ success: false, error: 'NIK Ayah harus berupa 16 digit angka numerik jika diisi.' }, 400);
    }
    const motherNik = body.motherNik || body.mother_nik ? String(body.motherNik || body.mother_nik).trim() : null;
    if (motherNik && !/^\d{16}$/.test(motherNik)) {
      return c.json({ success: false, error: 'NIK Ibu harus berupa 16 digit angka numerik jika diisi.' }, 400);
    }

    // Alamat Domisili
    const address = String(body.address || '').trim();
    const village = String(body.village || '').trim();
    const district = String(body.district || '').trim();
    const city = String(body.city || '').trim();
    if (!address || !village || !district || !city) {
      return c.json({ success: false, error: 'Data alamat lengkap, desa/kelurahan, kecamatan, dan kota/kabupaten wajib diisi.' }, 400);
    }

    // Nomor Telepon Calon Siswa / Orang Tua
    const phoneStudent = String(body.phoneStudent || body.phone_student || '').trim();
    const cleanPhone = phoneStudent.replace(/[\s\-\(\)]/g, '');
    if (!/^(?:\+62|62|0)8[1-9][0-9]{6,11}$/.test(cleanPhone)) {
      return c.json({ success: false, error: 'Nomor telepon/WhatsApp tidak valid. Masukkan nomor seluler Indonesia yang aktif (misal 081234567890).' }, 400);
    }

    // Email Calon Siswa (Opsional)
    const emailStudent = body.emailStudent || body.email_student ? String(body.emailStudent || body.email_student).trim().toLowerCase() : null;
    if (emailStudent && (!emailStudent.includes('@') || emailStudent.length > 100)) {
      return c.json({ success: false, error: 'Format alamat email tidak valid.' }, 400);
    }

    // Jalur Pendaftaran
    const admissionPath = String(body.admissionPath || body.admission_path || 'Umum').trim();
    const regType = String(body.regType || body.reg_type || 'Baru').trim();

    // Aturan Khusus Vokasi (SMK)
    let majorChoice1 = body.majorChoice1 || body.major_choice_1 ? String(body.majorChoice1 || body.major_choice_1).trim() : null;
    let majorChoice2 = body.majorChoice2 || body.major_choice_2 ? String(body.majorChoice2 || body.major_choice_2).trim() : null;
    if (schoolType === 'SMK') {
      if (!majorChoice1) {
        return c.json({ success: false, error: 'Pilihan Program/Kompetensi Keahlian ke-1 wajib dipilih untuk jenjang SMK.' }, 400);
      }
      if (majorChoice2 && majorChoice1 === majorChoice2) {
        return c.json({ success: false, error: 'Pilihan kompetensi keahlian ke-2 tidak boleh sama dengan pilihan ke-1.' }, 400);
      }
    }

    // 3.1. Validasi Berkas Persyaratan (Integritas Dokumen Wajib & Opsional)
    const rawKk = uploadedFiles['file_kk'] || uploadedFiles['fileKk'];
    const rawAkta = uploadedFiles['file_akta'] || uploadedFiles['fileAkta'];
    const rawSkl = uploadedFiles['file_skl'] || uploadedFiles['fileSkl'];
    const rawAdditional = uploadedFiles['file_additional'] || uploadedFiles['fileAdditional'] || uploadedFiles['file_prestasi'] || uploadedFiles['file_tahfidz'] || uploadedFiles['file_butawarna'];

    // Dokumen Wajib 1: Kartu Keluarga
    if (!rawKk && !body.fileKk && !body.file_kk) {
      return c.json({ success: false, error: 'Dokumen Kartu Keluarga (KK) wajib diunggah.' }, 400);
    }
    if (rawKk) {
      const v = validateUploadedDocument(rawKk, 'Kartu Keluarga (KK)');
      if (!v.valid) return c.json({ success: false, error: v.error }, 400);
    }

    // Dokumen Wajib 2: Akta Kelahiran
    if (!rawAkta && !body.fileAkta && !body.file_akta) {
      return c.json({ success: false, error: 'Dokumen Akta Kelahiran Calon Siswa wajib diunggah.' }, 400);
    }
    if (rawAkta) {
      const v = validateUploadedDocument(rawAkta, 'Akta Kelahiran');
      if (!v.valid) return c.json({ success: false, error: v.error }, 400);
    }

    // Dokumen Wajib 3: SKL / Ijazah
    if (!rawSkl && !body.fileSkl && !body.file_skl) {
      return c.json({ success: false, error: 'Dokumen Surat Keterangan Lulus (SKL) / Ijazah / Rapor wajib diunggah.' }, 400);
    }
    if (rawSkl) {
      const v = validateUploadedDocument(rawSkl, 'Surat Keterangan Lulus (SKL) / Rapor');
      if (!v.valid) return c.json({ success: false, error: v.error }, 400);
    }

    // Dokumen Opsional: Prestasi / Tahfidz / Pendukung
    if (rawAdditional) {
      const v = validateUploadedDocument(rawAdditional, 'Dokumen Pendukung');
      if (!v.valid) return c.json({ success: false, error: v.error }, 400);
    }

    // 4. Pencegahan Data Ganda (Anti-Duplicate Submission)
    const existingSubmission = await db
      .select({ id: registrations.id, registrationNumber: registrations.registrationNumber })
      .from(registrations)
      .where(and(eq(registrations.nik, nik), eq(registrations.academicYear, academicYear)))
      .limit(1)
      .then((r) => r[0]);

    if (existingSubmission) {
      return c.json(
        {
          success: false,
          error: `Calon peserta didik dengan NIK ${nik} sudah terdaftar sebelumnya untuk tahun ajaran ${academicYear} (Nomor Registrasi: ${existingSubmission.registrationNumber}). Pengiriman ganda tidak diizinkan demi integritas data.`,
        },
        409
      );
    }

    // 5. Pembuatan Nomor Registrasi Unik di Sisi Server
    const yearPrefix = academicYear.slice(0, 4);
    let registrationNumber = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const candidate = `REG-${yearPrefix}-${randomSuffix}`;
      const conflict = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.registrationNumber, candidate))
        .limit(1)
        .then((r) => r[0]);

      if (!conflict) {
        registrationNumber = candidate;
        isUnique = true;
      }
    }

    if (!registrationNumber) {
      registrationNumber = `REG-${yearPrefix}-${Date.now().toString().slice(-6)}`;
    }

    // Buat Kode Akses / Verifikasi Unik Calon Siswa (e.g. KOD-8A2F)
    const codeChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let codeSuffix = '';
    for (let i = 0; i < 4; i++) {
      codeSuffix += codeChars[Math.floor(Math.random() * codeChars.length)];
    }
    const verificationCode = `KOD-${codeSuffix}`;

    // Simpan Berkas Persyaratan ke Penyimpanan Aman Terproteksi
    let fileKkUrl: string | null = body.fileKk || body.file_kk || null;
    if (rawKk && typeof rawKk !== 'string') {
      await savePpdbDocument(registrationNumber, 'kk', rawKk as File);
      fileKkUrl = `/api/ppdb/document/${registrationNumber}/kk`;
    }

    let fileAktaUrl: string | null = body.fileAkta || body.file_akta || null;
    if (rawAkta && typeof rawAkta !== 'string') {
      await savePpdbDocument(registrationNumber, 'akta', rawAkta as File);
      fileAktaUrl = `/api/ppdb/document/${registrationNumber}/akta`;
    }

    let fileSklUrl: string | null = body.fileSkl || body.file_skl || null;
    if (rawSkl && typeof rawSkl !== 'string') {
      await savePpdbDocument(registrationNumber, 'skl', rawSkl as File);
      fileSklUrl = `/api/ppdb/document/${registrationNumber}/skl`;
    }

    let fileAdditionalUrl: string | null = body.fileAdditional || body.file_additional || null;
    if (rawAdditional && typeof rawAdditional !== 'string') {
      await savePpdbDocument(registrationNumber, 'additional', rawAdditional as File);
      fileAdditionalUrl = `/api/ppdb/document/${registrationNumber}/additional`;
    }

    // 6. Buat Snapshot Konfigurasi saat Formulir Didaftarkan
    const configSnapshot = JSON.stringify({
      schoolName: config['school_name'] || 'SMAN 1 Unggulan',
      npsn: config['npsn'] || '',
      schoolType,
      academicYear,
      admissionPath,
      waveId: assignedWave.id,
      waveName: assignedWave.name,
      waveBenefit: assignedWave.benefit || null,
      waveEndDate: assignedWave.endDate,
      submittedAt: new Date().toISOString(),
    });

    const regId = crypto.randomUUID();

    // Wajib: Gelombang ditetapkan secara objektif di server berdasarkan tanggal submit aktual
    const wave = assignedWave.name;

    // 7. Simpan ke Basis Data dengan Parameterized Query (Drizzle ORM)
    await db.insert(registrations).values({
      id: regId,
      registrationNumber,
      academicYear,
      wave,
      regType,
      admissionPath,
      schoolType,
      majorChoice1,
      majorChoice2,
      isBoarding: isBoardingRequested,
      fullName,
      nik,
      nisn,
      gender,
      birthPlace,
      birthDate,
      religion,
      prevSchool,
      fatherName,
      fatherNik,
      fatherStatus: body.fatherStatus || body.father_status || 'Hidup',
      fatherEducation: body.fatherEducation || body.father_education || null,
      fatherJob: body.fatherJob || body.father_job || null,
      fatherIncome: body.fatherIncome || body.father_income || null,
      fatherPhone: body.fatherPhone || body.father_phone || null,
      motherName,
      motherNik,
      motherStatus: body.motherStatus || body.mother_status || 'Hidup',
      motherEducation: body.motherEducation || body.mother_education || null,
      motherJob: body.motherJob || body.mother_job || null,
      motherIncome: body.motherIncome || body.mother_income || null,
      motherPhone: body.motherPhone || body.mother_phone || null,
      guardianName: body.guardianName || body.guardian_name || null,
      guardianNik: body.guardianNik || body.guardian_nik || null,
      guardianJob: body.guardianJob || body.guardian_job || null,
      guardianPhone: body.guardianPhone || body.guardian_phone || null,
      address,
      rtRw: body.rtRw || body.rt_rw || null,
      village,
      district,
      city,
      province: body.province || 'Jawa Timur',
      postalCode: body.postalCode || body.postal_code || null,
      phoneStudent: cleanPhone,
      emailStudent,
      fileKk: fileKkUrl,
      fileAkta: fileAktaUrl,
      fileSkl: fileSklUrl,
      fileAdditional: fileAdditionalUrl,
      status: 'submitted',
      registrationStatus: 'submitted',
      verificationStatus: 'pending',
      selectionStatus: 'not_announced',
      verificationCode,
      configSnapshot,
    });

    // 8. Pencatatan Audit Log Keamanan
    await db.insert(auditLogs).values({
      userId: null,
      userEmail: null,
      action: 'PPDB_REGISTRATION_SUBMITTED',
      entity: 'registration',
      entityId: registrationNumber,
      details: `Pendaftaran siswa baru berhasil: "${fullName}" (${admissionPath}) - Nomor: ${registrationNumber} - Kode Akses: ${verificationCode}`,
      ipAddress,
    });

    // 9. Berikan Respons Bersih
    return c.json({
      success: true,
      registrationNumber,
      verificationCode,
      studentName: fullName,
      admissionPath,
      academicYear,
      submittedAt: new Date().toISOString(),
      message: 'Pendaftaran peserta didik baru berhasil disimpan secara resmi pada basis data.',
    });
  } catch (err: any) {
    console.error('Error PPDB Register:', err);
    return c.json(
      {
        success: false,
        error: 'Terjadi kegagalan saat memproses pendaftaran. Pastikan data tidak duplikat dan coba beberapa saat lagi.',
      },
      500
    );
  }
});

// ==========================================
// 2.9.1. AKSES DOKUMEN PERSYARATAN BERKAS PPDB (HAK AKSES TERPROTEKSI)
// ==========================================
app.get('/ppdb/document/:regNumber/:docType', async (c) => {
  const regNumber = c.req.param('regNumber');
  const docType = c.req.param('docType') as 'kk' | 'akta' | 'skl' | 'additional';

  if (!['kk', 'akta', 'skl', 'additional'].includes(docType)) {
    return c.json({ success: false, error: 'Jenis dokumen persyaratan tidak valid.' }, 400);
  }

  // 1. Verifikasi Otorisasi:
  let isAuthorized = false;
  const cookie = getCookie(c, 'auth_session');
  if (cookie) {
    const session = await validateSession(cookie);
    if (session) {
      isAuthorized = true;
    }
  }

  const reg = await db
    .select({
      id: registrations.id,
      registrationNumber: registrations.registrationNumber,
      verificationCode: registrations.verificationCode,
    })
    .from(registrations)
    .where(eq(registrations.registrationNumber, regNumber))
    .limit(1)
    .then((r) => r[0]);

  if (!reg) {
    return c.json({ success: false, error: 'Data pendaftaran tidak ditemukan.' }, 404);
  }

  if (!isAuthorized) {
    const code = (c.req.query('code') || c.req.header('X-Verification-Code') || '').trim();
    if (!code || !reg.verificationCode || code.toUpperCase() !== reg.verificationCode.toUpperCase()) {
      const acceptsHtml = c.req.header('accept')?.includes('text/html');
      if (acceptsHtml) {
        return c.html(
          `<!doctype html>
          <html lang="id">
            <head>
              <meta charset="UTF-8" />
              <title>Akses Dokumen Terproteksi</title>
              <style>
                body { font-family: system-ui, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc; color: #0f172a; }
                .card { max-width: 480px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
                h2 { color: #dc2626; margin-top: 0; font-size: 1.25rem; }
                p { color: #64748b; font-size: 14px; line-height: 1.6; }
                a { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #0d9488; color: white; text-decoration: none; font-weight: 600; font-size: 13px; border-radius: 6px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>Akses Dokumen Terproteksi</h2>
                <p>Dokumen pendaftar ini bersifat rahasia dan dilindungi privasinya. Untuk membuka dokumen, pastikan Anda telah login sebagai Panitia PPDB, atau buka melalui tautan resmi Lembar Bukti Pendaftaran dengan Kode Akses Calon Siswa Anda.</p>
                <a href="/pendaftaran#section-cek-status">&larr; Buka Portal Cek Status &amp; Cetak Bukti</a>
              </div>
            </body>
          </html>`,
          403
        );
      }

      return c.json(
        {
          success: false,
          error: 'Akses ditolak: Dokumen persyaratan pendaftar bersifat rahasia. Kode verifikasi tidak sesuai atau Anda belum terautentikasi.',
        },
        403
      );
    }
    isAuthorized = true;
  }

  // 2. Ambil dokumen dari storage
  const docResult = await getPpdbDocument(regNumber, docType);
  if (!docResult) {
    return c.json(
      {
        success: false,
        error: 'Berkas dokumen persyaratan belum diunggah atau tidak ditemukan di penyimpanan server.',
      },
      404
    );
  }

  const { buffer, meta } = docResult;

  const rawOriginalName = meta.originalName || `${docType}_document`;
  const asciiFilename = rawOriginalName.replace(/[^\x20-\x7E]/g, '_').replace(/["\r\n]/g, '');
  const encodedFilename = encodeURIComponent(rawOriginalName);

  c.header('Content-Type', meta.mimeType || 'application/octet-stream');
  c.header('Content-Disposition', `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  return c.body(new Uint8Array(buffer));
});

// ==========================================
// 2.10. CEK STATUS PENDAFTARAN PPDB (Kluster C2 Keamanan & Privasi Siswa)
// ==========================================
const statusCheckAttempts = new Map<string, { count: number; resetAt: number }>();

app.post('/ppdb/check-status', async (c) => {
  const ip = getClientIp(c);
  const now = Date.now();

  // Rate Limiting Berbasis IP: Maks 10 percobaan per menit
  const record = statusCheckAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= 10) {
      return c.json(
        {
          success: false,
          error: 'Terlalu banyak percobaan cek status. Mohon tunggu 1 menit demi keamanan data calon peserta didik.',
        },
        429
      );
    }
    record.count++;
  } else {
    statusCheckAttempts.set(ip, { count: 1, resetAt: now + 60000 });
  }

  try {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Format permintaan tidak valid.' }, 400);
    }

    const regNo = String(body.registrationNumber || '').trim().toUpperCase();
    const verCode = String(body.verificationCode || '').trim().toUpperCase();

    if (!regNo || !verCode) {
      return c.json(
        {
          success: false,
          error: 'Nomor registrasi dan kode verifikasi wajib diisi.',
        },
        400
      );
    }

    // Cari pendaftar berdasarkan Nomor Registrasi
    const student = await db
      .select({
        id: registrations.id,
        registrationNumber: registrations.registrationNumber,
        verificationCode: registrations.verificationCode,
        fullName: registrations.fullName,
        admissionPath: registrations.admissionPath,
        regType: registrations.regType,
        wave: registrations.wave,
        academicYear: registrations.academicYear,
        schoolType: registrations.schoolType,
        majorChoice1: registrations.majorChoice1,
        registrationStatus: registrations.registrationStatus,
        verificationStatus: registrations.verificationStatus,
        selectionStatus: registrations.selectionStatus,
        revisionNotes: registrations.revisionNotes,
        notes: registrations.notes,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(eq(registrations.registrationNumber, regNo))
      .limit(1)
      .then((r) => r[0]);

    // Respon netral jika data tidak ditemukan atau kode verifikasi tidak cocok
    if (!student || !student.verificationCode || student.verificationCode.toUpperCase() !== verCode) {
      return c.json(
        {
          success: false,
          error: 'Nomor registrasi atau kode verifikasi tidak cocok. Pastikan data yang dimasukkan benar sesuai bukti pendaftaran Anda.',
        },
        404
      );
    }

    // Ambil tanggal pengumuman resmi dari konfigurasi PPDB
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    let isAnnouncementReleased = true;
    let announcementSchedule = '';

    if (settingMap['ppdb_form_config']) {
      try {
        const fullConf = JSON.parse(settingMap['ppdb_form_config']);
        const currentWave = fullConf.waves?.find((w: any) => w.name === student.wave);
        if (currentWave?.announcementDate) {
          announcementSchedule = currentWave.announcementDate;
          const annTime = new Date(`${currentWave.announcementDate}T00:00:00+07:00`).getTime();
          if (Date.now() < annTime) {
            isAnnouncementReleased = false;
          }
        }
      } catch {}
    }

    // Proteksi jadwal: Sebelum pengumuman resmi dirilis, status seleksi tetap "not_announced"
    const publicSelectionStatus = isAnnouncementReleased
      ? student.selectionStatus || 'not_announced'
      : 'not_announced';

    return c.json({
      success: true,
      data: {
        registrationNumber: student.registrationNumber,
        verificationCode: student.verificationCode,
        studentName: student.fullName,
        admissionPath: student.admissionPath,
        regType: student.regType,
        wave: student.wave,
        academicYear: student.academicYear,
        majorChoice: student.majorChoice1,
        submittedAt: student.createdAt,
        announcementSchedule,
        isAnnouncementReleased,
        // Tiga dimensi status independen
        registrationStatus: student.registrationStatus || 'submitted',
        verificationStatus: student.verificationStatus || 'pending',
        selectionStatus: publicSelectionStatus,
        revisionNotes: student.verificationStatus === 'revision_required' ? student.revisionNotes : null,
      },
    });
  } catch (err: any) {
    console.error('Error Cek Status PPDB:', err);
    return c.json({ success: false, error: 'Terjadi kesalahan sistem saat memeriksa status pendaftaran.' }, 500);
  }
});

// ==========================================
// 3. ENDPOINT ADMIN CRUD (Kluster B & C)
// ==========================================
// Middleware proteksi rute /api/admin/*
app.use('/admin/*', async (c, next) => {
  // 1. Periksa sesi stateless JWT (Google / Firebase)
  const cmsCookie = getCookie(c, 'cms_session');
  if (cmsCookie) {
    const payload = await verifySessionToken(cmsCookie).catch(() => null);
    if (payload) {
      c.set('user' as any, {
        id: payload.uid,
        email: payload.email,
        name: payload.name,
        role: payload.role === 'admin' ? 'super_admin' : payload.role,
        photoUrl: payload.photoUrl,
      });
      c.set('sessionId' as any, payload.uid);
      return next();
    } else {
      deleteCookie(c, 'cms_session', { path: '/' });
    }
  }

  // 2. Periksa sesi database lokal
  const cookie = getCookie(c, 'auth_session');
  if (!cookie) {
    return c.json({ success: false, error: 'Akses ditolak: sesi login tidak ditemukan' }, 401);
  }

  const session = await validateSession(cookie);
  if (!session) {
    deleteCookie(c, 'auth_session', { path: '/' });
    return c.json({ success: false, error: 'Akses ditolak: sesi kedaluwarsa atau tidak valid' }, 401);
  }

  c.set('user' as any, session.user);
  c.set('sessionId' as any, session.sessionId);
  return next();
});

// Middleware otorisasi khusus Super Admin
const requireSuperAdmin = async (c: any, next: any) => {
  const user = c.get('user' as any);
  if (!user || user.role !== 'super_admin') {
    return c.json(
      {
        success: false,
        error: 'Akses ditolak: Tindakan ini memerlukan hak akses Super Administrator',
      },
      403
    );
  }
  return next();
};

// Middleware otorisasi staf terautentikasi (Editor & Super Admin)
const requireAuth = async (c: any, next: any) => {
  const user = c.get('user' as any);
  if (!user) {
    return c.json(
      {
        success: false,
        error: 'Akses ditolak: Sesi login tidak ditemukan',
      },
      401
    );
  }
  return next();
};

// ==========================================
// 3.1. CRUD KATEGORI BERITA (Sprint 2)
// ==========================================
app.get('/admin/categories', async (c) => {
  try {
    const list = await db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        createdAt: categories.createdAt,
        articleCount: sql<number>`(SELECT count(*) FROM ${articles} WHERE ${articles.categoryId} = ${categories.id} AND ${articles.deletedAt} IS NULL)`,
      })
      .from(categories)
      .orderBy(categories.name);
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/categories', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: 'Nama kategori wajib diisi' }, 400);
    }
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await db
      .select()
      .from(categories)
      .where(or(eq(categories.name, body.name.trim()), eq(categories.slug, slug)))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      return c.json({ success: false, error: 'Nama atau slug kategori sudah digunakan' }, 400);
    }

    const inserted = await db.insert(categories).values({ name: body.name.trim(), slug }).returning();
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'category',
      entityId: String(inserted[0].id),
      details: `Menambahkan kategori baru: "${body.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/categories/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: 'Nama kategori wajib diisi' }, 400);
    }
    const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const duplicate = await db
      .select()
      .from(categories)
      .where(and(or(eq(categories.name, body.name.trim()), eq(categories.slug, slug)), ne(categories.id, id)))
      .limit(1)
      .then((r) => r[0]);

    if (duplicate) {
      return c.json({ success: false, error: 'Nama atau slug kategori sudah digunakan oleh kategori lain' }, 400);
    }

    await db.update(categories).set({ name: body.name.trim(), slug }).where(eq(categories.id, id));
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'category',
      entityId: String(id),
      details: `Memperbarui kategori: "${body.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Kategori berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/categories/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    // Cek apakah masih digunakan artikel aktif
    const usedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(and(eq(articles.categoryId, id), isNull(articles.deletedAt)))
      .then((r) => Number(r[0]?.count || 0));

    if (usedCount > 0) {
      return c.json({ success: false, error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${usedCount} artikel aktif.` }, 400);
    }

    await db.delete(categories).where(eq(categories.id, id));
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'category',
      entityId: String(id),
      details: `Menghapus kategori ID #${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Kategori berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.2. CRUD BERITA & ARTIKEL (Sprint 2)
// ==========================================
app.get('/admin/articles', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 10));
    const offset = (page - 1) * limit;
    const status = c.req.query('status') || 'all'; // all, published, draft, trash
    const categoryId = c.req.query('categoryId') ? Number(c.req.query('categoryId')) : null;
    const search = c.req.query('q')?.trim();

    const conditions: any[] = [];
    if (status === 'trash') {
      conditions.push(isNotNull(articles.deletedAt));
    } else {
      conditions.push(isNull(articles.deletedAt));
      if (status === 'published') conditions.push(eq(articles.status, 'published'));
      if (status === 'draft') conditions.push(eq(articles.status, 'draft'));
    }

    if (categoryId) {
      conditions.push(eq(articles.categoryId, categoryId));
    }

    if (search) {
      conditions.push(like(articles.title, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(whereClause)
      .then((r) => Number(r[0]?.count || 0));

    const list = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        coverImage: articles.coverImage,
        categoryId: articles.categoryId,
        categoryName: categories.name,
        status: articles.status,
        publishedAt: articles.publishedAt,
        viewCount: articles.viewCount,
        deletedAt: articles.deletedAt,
        createdAt: articles.createdAt,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(whereClause)
      .orderBy(desc(articles.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      success: true,
      data: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/articles/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const article = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!article) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan' }, 404);
    }

    return c.json({ success: true, data: article });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/articles/:id/preview-token', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const article = await db
      .select({ id: articles.id, slug: articles.slug })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!article) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan' }, 404);
    }

    const token = await signPreviewToken(article.id, article.slug);
    return c.json({
      success: true,
      previewUrl: `/berita/${article.slug}?preview_token=${token}`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Berita: Create
app.post('/admin/articles', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.title || !body.content) {
      return c.json({ success: false, error: 'Judul dan konten berita wajib diisi' }, 400);
    }

    const baseSlug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}`;

    // Validasi pencegahan slug duplikat
    const slugConflict = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), isNull(articles.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (slugConflict) {
      return c.json(
        {
          success: false,
          error: `Slug URL "${slug}" sudah digunakan oleh artikel lain. Gunakan judul atau slug yang berbeda.`,
        },
        400
      );
    }

    const status = body.status === 'published' ? 'published' : 'draft';
    const publishedAt = status === 'published' ? (body.publishedAt || new Date().toISOString()) : null;
    const cleanContent = sanitizeArticleHtml(body.content);

    const newArticle = {
      slug,
      title: body.title,
      summary: body.summary || body.title,
      content: cleanContent,
      coverImage: body.coverImage || null,
      categoryId: body.categoryId ? Number(body.categoryId) : 1,
      authorId: user.id,
      status: status as 'draft' | 'published',
      publishedAt,
      metaTitle: body.metaTitle || body.title,
      metaDescription: body.metaDescription || body.summary,
    };

    const inserted = await db.insert(articles).values(newArticle).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'article',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan berita baru: "${body.title}" (${status})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Berita: Update (Preserves view count and checks duplicate slug)
app.put('/admin/articles/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan' }, 404);
    }

    if (!body.title || !body.content) {
      return c.json({ success: false, error: 'Judul dan konten berita wajib diisi' }, 400);
    }

    const slug = body.slug ? body.slug.trim() : existing.slug;

    // Cek slug duplikat pada artikel lain
    const slugConflict = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), ne(articles.id, id), isNull(articles.deletedAt)))
      .limit(1)
      .then((r) => r[0]);

    if (slugConflict) {
      return c.json({ success: false, error: `Slug URL "${slug}" sudah digunakan oleh artikel lain` }, 400);
    }

    const status = body.status === 'published' ? 'published' : 'draft';
    const publishedAt = status === 'published' ? (body.publishedAt || existing.publishedAt || new Date().toISOString()) : null;
    const cleanContent = sanitizeArticleHtml(body.content);

    await db
      .update(articles)
      .set({
        title: body.title,
        slug,
        summary: body.summary || body.title,
        content: cleanContent,
        coverImage: body.coverImage || null,
        categoryId: body.categoryId ? Number(body.categoryId) : existing.categoryId,
        status,
        publishedAt,
        metaTitle: body.metaTitle || body.title,
        metaDescription: body.metaDescription || body.summary,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(articles.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'article',
      entityId: String(id),
      details: `Memperbarui artikel: "${body.title}" (${status})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Artikel berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Berita: Delete (Soft delete ke Sampah atau Force delete untuk Superadmin)
app.delete('/admin/articles/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const force = c.req.query('force') === 'true';

    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan' }, 404);
    }

    if (force) {
      if (user.role !== 'super_admin') {
        return c.json({ success: false, error: 'Hapus permanen hanya dapat dilakukan oleh Super Admin' }, 403);
      }
      await db.delete(articles).where(eq(articles.id, id));
    } else {
      // Soft-delete
      await db.update(articles).set({ deletedAt: new Date().toISOString() }).where(eq(articles.id, id));
    }

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: force ? 'DELETE_PERMANENT' : 'TRASH',
      entity: 'article',
      entityId: String(id),
      details: force
        ? `Menghapus permanen artikel: "${existing.title}"`
        : `Memindahkan artikel ke Sampah: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({
      success: true,
      message: force ? 'Artikel berhasil dihapus permanen' : 'Artikel berhasil dipindahkan ke Sampah',
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Restore Berita dari Sampah: POST /admin/articles/:id/restore
app.post('/admin/articles/:id/restore', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Artikel tidak ditemukan' }, 404);
    }

    await db.update(articles).set({ deletedAt: null }).where(eq(articles.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'RESTORE',
      entity: 'article',
      entityId: String(id),
      details: `Memulihkan artikel dari Sampah: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Artikel berhasil dipulihkan dari Sampah' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.3. CRUD AGENDA AKADEMIK (Sprint 2)
// ==========================================
// List Agenda Admin dengan filter bulan & status
app.get('/admin/agendas', async (c) => {
  try {
    const month = c.req.query('month'); // format YYYY-MM
    const status = c.req.query('status'); // all, upcoming, completed
    const q = c.req.query('q');

    const conditions: any[] = [];
    if (month) {
      conditions.push(like(agendas.eventDate, `${month}%`));
    }
    if (status === 'upcoming') {
      conditions.push(eq(agendas.isCompleted, false));
    } else if (status === 'completed') {
      conditions.push(eq(agendas.isCompleted, true));
    }
    if (q) {
      conditions.push(or(like(agendas.title, `%${q.trim()}%`), like(agendas.location, `%${q.trim()}%`)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const list = await db.select().from(agendas).where(whereClause).orderBy(desc(agendas.eventDate));

    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



// CRUD Agenda: Create (Validasi tanggal mulai vs selesai)
app.post('/admin/agendas', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.title || !body.eventDate || !body.location) {
      return c.json({ success: false, error: 'Judul, tanggal mulai, dan lokasi kegiatan wajib diisi' }, 400);
    }

    // Validasi rentang tanggal & jam (TC-11)
    if (body.endDate && body.endDate < body.eventDate) {
      return c.json(
        { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai kegiatan' },
        400
      );
    }
    if (body.startTime && body.endTime && (!body.endDate || body.endDate === body.eventDate)) {
      if (body.endTime <= body.startTime) {
        return c.json(
          { success: false, error: 'Jam selesai harus lebih akhir dari jam mulai pada hari yang sama' },
          400
        );
      }
    }

    const inserted = await db
      .insert(agendas)
      .values({
        title: body.title,
        description: body.description || null,
        eventDate: body.eventDate,
        endDate: body.endDate || null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        location: body.location,
        isCompleted: false,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'agenda',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan agenda baru: "${body.title}" (${body.eventDate})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Agenda: Update
app.put('/admin/agendas/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(agendas)
      .where(eq(agendas.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Agenda tidak ditemukan' }, 404);
    }

    if (!body.title || !body.eventDate || !body.location) {
      return c.json({ success: false, error: 'Judul, tanggal mulai, dan lokasi kegiatan wajib diisi' }, 400);
    }

    // Validasi rentang tanggal & jam (TC-11)
    if (body.endDate && body.endDate < body.eventDate) {
      return c.json(
        { success: false, error: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai kegiatan' },
        400
      );
    }
    if (body.startTime && body.endTime && (!body.endDate || body.endDate === body.eventDate)) {
      if (body.endTime <= body.startTime) {
        return c.json(
          { success: false, error: 'Jam selesai harus lebih akhir dari jam mulai pada hari yang sama' },
          400
        );
      }
    }

    await db
      .update(agendas)
      .set({
        title: body.title,
        description: body.description || null,
        eventDate: body.eventDate,
        endDate: body.endDate || null,
        startTime: body.startTime || null,
        endTime: body.endTime || null,
        location: body.location,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agendas.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'agenda',
      entityId: String(id),
      details: `Memperbarui agenda: "${body.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Agenda berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Agenda: Toggle Status Selesai
app.put('/admin/agendas/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db
      .select()
      .from(agendas)
      .where(eq(agendas.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Agenda tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(agendas)
      .set({ isCompleted: !existing.isCompleted, updatedAt: new Date().toISOString() })
      .where(eq(agendas.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'agenda',
      entityId: String(id),
      details: `Mengubah status agenda "${existing.title}" menjadi ${!existing.isCompleted ? 'Selesai' : 'Belum Selesai'}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// CRUD Agenda: Delete
app.delete('/admin/agendas/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db
      .select()
      .from(agendas)
      .where(eq(agendas.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Agenda tidak ditemukan' }, 404);
    }

    await db.delete(agendas).where(eq(agendas.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'agenda',
      entityId: String(id),
      details: `Menghapus agenda: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Agenda berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.4. CRUD GURU & TENAGA KEPENDIDIKAN (Sprint 4)
// ==========================================
app.get('/admin/teachers', async (c) => {
  try {
    const list = await db.select().from(teachers).orderBy(teachers.orderNumber);
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.get('/admin/teachers/template', async (c) => {
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SMAN 1 Unggulan CMS';
    wb.created = new Date();

    const ws = wb.addWorksheet('Data Guru');
    const wsRef = wb.addWorksheet('Referensi');
    wsRef.state = 'hidden';

    const positions = [
      'Kepala Sekolah',
      'Wakil Kepala Sekolah Kurikulum',
      'Wakil Kepala Sekolah Kesiswaan',
      'Wakil Kepala Sekolah Sarana & Prasarana',
      'Wakil Kepala Sekolah Humas',
      'Kepala Tata Usaha',
      'Guru Pengampu',
      'Guru Bimbingan Konseling (BK)',
      'Staf Tata Usaha',
      'Tenaga Laboratorium',
      'Tenaga Perpustakaan',
    ];

    const statuses = ['Aktif', 'Nonaktif'];

    positions.forEach((pos, idx) => {
      wsRef.getCell(`A${idx + 1}`).value = pos;
    });

    statuses.forEach((st, idx) => {
      wsRef.getCell(`B${idx + 1}`).value = st;
    });

    ws.columns = [
      { header: 'Nama Lengkap', key: 'name', width: 32 },
      { header: 'NIP', key: 'nip', width: 22 },
      { header: 'Jabatan Struktural', key: 'position', width: 34 },
      { header: 'Mata Pelajaran', key: 'subject', width: 28 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FF1E293B' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    ws.addRow({
      name: 'Drs. H. Ahmad Fauzi, M.Pd.',
      nip: '198001012005011002',
      position: 'Kepala Sekolah',
      subject: 'Manajemen Pendidikan',
      status: 'Aktif',
    });

    ws.addRow({
      name: 'Siti Rahmawati, S.Pd.',
      nip: '198505122008012006',
      position: 'Guru Pengampu',
      subject: 'Matematika',
      status: 'Aktif',
    });

    ws.addRow({
      name: 'Budi Prasetyo, S.Kom.',
      nip: '199003202015011004',
      position: 'Staf Tata Usaha',
      subject: '',
      status: 'Aktif',
    });

    for (let r = 2; r <= 500; r++) {
      ws.getCell(`C${r}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`Referensi!$A$1:$A$${positions.length}`],
        showErrorMessage: true,
        errorTitle: 'Jabatan Tidak Valid',
        error: 'Pilih salah satu jabatan resmi dari dropdown yang tersedia.',
      };

      ws.getCell(`E${r}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`Referensi!$B$1:$B$${statuses.length}`],
        showErrorMessage: true,
        errorTitle: 'Status Tidak Valid',
        error: 'Pilih Aktif atau Nonaktif.',
      };
    }

    const buffer = await wb.xlsx.writeBuffer();

    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    c.header('Content-Disposition', 'attachment; filename="template_data_guru.xlsx"');
    return c.body(buffer);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/teachers/import', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const contentType = c.req.header('content-type') || '';

    let rows: any[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return c.json({ success: false, error: 'Berkas Excel wajib diunggah' }, 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return c.json({ success: false, error: 'Lembar kerja (sheet) tidak ditemukan dalam berkas' }, 400);
      }
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
    } else {
      const body = await c.req.json();
      rows = body.teachers || body.rows || [];
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return c.json({ success: false, error: 'Tidak ada baris data yang ditemukan dalam berkas' }, 400);
    }

    const inserted: any[] = [];
    const skipped: any[] = [];
    const errors: string[] = [];

    const existingTeachers = await db.select({ id: teachers.id, nip: teachers.nip, name: teachers.name }).from(teachers);
    const existingNipMap = new Map<string, any>();
    for (const t of existingTeachers) {
      if (t.nip) existingNipMap.set(t.nip.trim(), t);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = String(row['Nama Lengkap'] || row['Nama'] || row['nama'] || row['name'] || '').trim();
      const rawPosition = String(row['Jabatan Struktural'] || row['Jabatan'] || row['jabatan'] || row['position'] || '').trim();
      const rawNip = row['NIP'] || row['nip'] || row['Nomor Induk Pegawai'] || null;
      const nip = rawNip ? String(rawNip).trim() : null;
      const rawSubject = row['Mata Pelajaran'] || row['Mapel'] || row['subject'] || row['mapel'] || null;
      const subject = rawSubject ? String(rawSubject).trim() : null;
      const rawStatus = row['Status'] || row['status'] || row['Aktif'] || '';
      const isActive = rawStatus ? !String(rawStatus).toLowerCase().includes('non') : true;

      if (!name && !rawPosition && !nip) {
        continue;
      }

      if (!name) {
        errors.push(`Baris ${rowNum}: Nama guru wajib diisi.`);
        continue;
      }

      const position = rawPosition || 'Guru Pengampu';

      if (nip && existingNipMap.has(nip)) {
        const dup = existingNipMap.get(nip);
        skipped.push({ row: rowNum, name, nip, reason: `NIP ${nip} sudah terdaftar (${dup.name})` });
        continue;
      }

      try {
        const category = resolveTeacherCategory(position);
        const [res] = await db.insert(teachers).values({
          name,
          nip,
          position,
          category,
          subject,
          photoUrl: null,
          orderNumber: 10,
          isActive,
        }).returning();

        if (nip) existingNipMap.set(nip, res);
        inserted.push(res);
      } catch (insertErr: any) {
        errors.push(`Baris ${rowNum} (${name}): ${insertErr.message}`);
      }
    }

    if (inserted.length > 0) {
      await db.insert(auditLogs).values({
        userId: user?.id || null,
        userEmail: user?.email || 'admin@sekolah.sch.id',
        action: 'CREATE',
        entity: 'teacher',
        entityId: 'bulk_import',
        details: `Impor data guru Excel: ${inserted.length} berhasil, ${skipped.length} dilewati, ${errors.length} gagal`,
        ipAddress: getClientIp(c),
      });
    }

    return c.json({
      success: true,
      totalProcessed: rows.length,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      skipped,
      errors,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

function resolveTeacherCategory(position: string, explicitCategory?: string): 'guru' | 'tendik' | 'pimpinan' {
  if (explicitCategory === 'guru' || explicitCategory === 'tendik' || explicitCategory === 'pimpinan') {
    return explicitCategory;
  }
  const p = (position || '').toLowerCase();
  if (p.includes('kepala') || p.includes('wakil') || p.includes('waka')) return 'pimpinan';
  if (p.includes('tata usaha') || p.includes('laboran') || p.includes('laboratorium') || p.includes('pustakawan') || p.includes('perpustakaan') || p.includes('staf') || p.includes('administrasi')) return 'tendik';
  return 'guru';
}

app.post('/admin/teachers', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.name || !body.position) {
      return c.json({ success: false, error: 'Nama dan jabatan guru wajib diisi' }, 400);
    }

    const nip = body.nip ? String(body.nip).trim() : null;
    if (nip) {
      const existingNip = await db.select().from(teachers).where(eq(teachers.nip, nip)).limit(1).then((r) => r[0]);
      if (existingNip) {
        return c.json({ success: false, error: `NIP ${nip} sudah terdaftar atas nama ${existingNip.name}` }, 400);
      }
    }

    const category = resolveTeacherCategory(body.position, body.category);
    const inserted = await db.insert(teachers).values({
      name: body.name.trim(),
      nip,
      position: body.position.trim(),
      category,
      subject: body.subject ? body.subject.trim() : null,
      photoUrl: body.photoUrl || null,
      orderNumber: body.orderNumber !== undefined && body.orderNumber !== '' ? Number(body.orderNumber) : 10,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    }).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'teacher',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan guru/staf: "${body.name}" (${body.position} - ${category})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/teachers/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Data guru tidak ditemukan' }, 404);
    }

    const nip = body.nip ? String(body.nip).trim() : null;
    if (nip) {
      const existingNip = await db
        .select()
        .from(teachers)
        .where(and(eq(teachers.nip, nip), ne(teachers.id, id)))
        .limit(1)
        .then((r) => r[0]);
      if (existingNip) {
        return c.json({ success: false, error: `NIP ${nip} sudah terdaftar atas nama ${existingNip.name}` }, 400);
      }
    }

    const targetPos = body.position !== undefined ? body.position.trim() : existing.position;
    const category = body.category !== undefined 
      ? resolveTeacherCategory(targetPos, body.category)
      : (body.position ? resolveTeacherCategory(targetPos, existing.category) : existing.category);

    const updated = await db
      .update(teachers)
      .set({
        name: body.name !== undefined ? body.name.trim() : existing.name,
        nip,
        position: targetPos,
        category,
        subject: body.subject !== undefined ? (body.subject ? body.subject.trim() : null) : existing.subject,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : existing.photoUrl,
        orderNumber: body.orderNumber !== undefined && body.orderNumber !== '' ? Number(body.orderNumber) : existing.orderNumber,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      })
      .where(eq(teachers.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'teacher',
      entityId: String(id),
      details: `Memperbarui profil guru/staf: "${updated[0]?.name}" (${category})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/teachers/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Guru tidak ditemukan' }, 404);
    }

    await db.delete(teachers).where(eq(teachers.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'teacher',
      entityId: String(id),
      details: `Menghapus data guru: "${existing.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Data guru berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/teachers/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db
      .select()
      .from(teachers)
      .where(eq(teachers.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Data guru tidak ditemukan' }, 404);
    }

    const nextState = !existing.isActive;
    const updated = await db
      .update(teachers)
      .set({ isActive: nextState })
      .where(eq(teachers.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || null,
      action: 'UPDATE',
      entity: 'teacher',
      entityId: String(id),
      details: `Mengubah status aktif guru: "${existing.name}" menjadi ${nextState ? 'Aktif' : 'Nonaktif'}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.5. CRUD PENGUMUMAN CEPAT / BANNER (Sprint 4)
// ==========================================
app.get('/admin/announcements', async (c) => {
  try {
    const list = await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/announcements', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.text || !body.text.trim()) {
      return c.json({ success: false, error: 'Teks pengumuman wajib diisi' }, 400);
    }

    const inserted = await db
      .insert(announcements)
      .values({
        text: body.text.trim(),
        linkUrl: body.linkUrl ? body.linkUrl.trim() : null,
        linkText: body.linkText ? body.linkText.trim() : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        isUrgent: body.isUrgent !== undefined ? Boolean(body.isUrgent) : false,
        expiresAt: body.expiresAt ? body.expiresAt.trim() : null,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'announcement',
      entityId: String(inserted[0]?.id),
      details: `Membuat pengumuman baru: "${body.text.slice(0, 50)}..."`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/announcements/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Pengumuman tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(announcements)
      .set({
        text: body.text !== undefined ? body.text.trim() : existing.text,
        linkUrl: body.linkUrl !== undefined ? (body.linkUrl ? body.linkUrl.trim() : null) : existing.linkUrl,
        linkText: body.linkText !== undefined ? (body.linkText ? body.linkText.trim() : null) : existing.linkText,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        isUrgent: body.isUrgent !== undefined ? Boolean(body.isUrgent) : existing.isUrgent,
        expiresAt: body.expiresAt !== undefined ? (body.expiresAt ? body.expiresAt.trim() : null) : existing.expiresAt,
      })
      .where(eq(announcements.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'announcement',
      entityId: String(id),
      details: `Memperbarui pengumuman ID ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/announcements/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Pengumuman tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db.update(announcements).set({
      isActive: newStatus,
    }).where(eq(announcements.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'announcement',
      entityId: String(id),
      details: `Mengubah status pengumuman ID ${id} menjadi: ${newStatus ? 'Aktif' : 'Non-aktif'}`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/announcements/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Pengumuman tidak ditemukan' }, 404);
    }

    await db.delete(announcements).where(eq(announcements.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'announcement',
      entityId: String(id),
      details: `Menghapus pengumuman: "${existing.text.slice(0, 50)}..."`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Pengumuman berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.6. CRUD GALERI MEDIA (Sprint 4)
// ==========================================
app.get('/admin/galleries', async (c) => {
  try {
    const list = await db.select().from(galleries).orderBy(desc(galleries.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/galleries', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.title || !body.mediaUrl) {
      return c.json({ success: false, error: 'Judul dan URL media wajib diisi' }, 400);
    }

    const inserted = await db
      .insert(galleries)
      .values({
        title: body.title.trim(),
        type: body.type === 'youtube' ? 'youtube' : 'image',
        mediaUrl: body.mediaUrl.trim(),
        caption: body.caption ? body.caption.trim() : null,
        albumName: body.albumName ? body.albumName.trim() : 'Umum',
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'gallery',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan item galeri: "${body.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/galleries/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(galleries).where(eq(galleries.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Item galeri tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(galleries)
      .set({
        title: body.title !== undefined ? body.title.trim() : existing.title,
        type: body.type !== undefined ? (body.type === 'youtube' ? 'youtube' : 'image') : existing.type,
        mediaUrl: body.mediaUrl !== undefined ? body.mediaUrl.trim() : existing.mediaUrl,
        caption: body.caption !== undefined ? (body.caption ? body.caption.trim() : null) : existing.caption,
        albumName: body.albumName !== undefined ? (body.albumName ? body.albumName.trim() : 'Umum') : existing.albumName,
      })
      .where(eq(galleries.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'gallery',
      entityId: String(id),
      details: `Memperbarui item galeri: "${updated[0]?.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/galleries/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db.select().from(galleries).where(eq(galleries.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Item galeri tidak ditemukan' }, 404);
    }

    await db.delete(galleries).where(eq(galleries.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'gallery',
      entityId: String(id),
      details: `Menghapus galeri: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Item galeri berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.7. CRUD DOKUMEN & UNDUHAN (Sprint 4)
// ==========================================
app.get('/admin/documents', async (c) => {
  try {
    const list = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/documents', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.title || !body.fileUrl) {
      return c.json({ success: false, error: 'Judul dan URL berkas dokumen wajib diisi' }, 400);
    }

    const inserted = await db
      .insert(documents)
      .values({
        title: body.title.trim(),
        fileUrl: body.fileUrl.trim(),
        fileSize: body.fileSize ? body.fileSize.trim() : null,
        fileType: body.fileType ? body.fileType.toUpperCase().trim() : 'PDF',
        category: body.category ? body.category.trim() : 'Umum',
        downloadCount: 0,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'document',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan dokumen: "${body.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/documents/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(documents).where(eq(documents.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Dokumen tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(documents)
      .set({
        title: body.title !== undefined ? body.title.trim() : existing.title,
        fileUrl: body.fileUrl !== undefined ? body.fileUrl.trim() : existing.fileUrl,
        fileSize: body.fileSize !== undefined ? (body.fileSize ? body.fileSize.trim() : null) : existing.fileSize,
        fileType: body.fileType !== undefined ? body.fileType.toUpperCase().trim() : existing.fileType,
        category: body.category !== undefined ? (body.category ? body.category.trim() : 'Umum') : existing.category,
      })
      .where(eq(documents.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'document',
      entityId: String(id),
      details: `Memperbarui dokumen: "${updated[0]?.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/documents/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(documents).where(eq(documents.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Dokumen tidak ditemukan' }, 404);
    }

    const newActive = !existing.isActive;
    const updated = await db
      .update(documents)
      .set({ isActive: newActive })
      .where(eq(documents.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || null,
      action: 'UPDATE',
      entity: 'document',
      entityId: String(id),
      details: `${newActive ? 'Mengaktifkan' : 'Menonaktifkan'} dokumen: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/documents/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db.select().from(documents).where(eq(documents.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Dokumen tidak ditemukan' }, 404);
    }

    await db.delete(documents).where(eq(documents.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'document',
      entityId: String(id),
      details: `Menghapus dokumen: "${existing.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Dokumen berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.8. CRUD PRESTASI & ALUMNI (Sprint 4)
// ==========================================
app.get('/admin/students_alumni', async (c) => {
  try {
    const list = await db.select().from(studentsAlumni).orderBy(desc(studentsAlumni.year));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/students_alumni', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.name || !body.title || !body.year) {
      return c.json({ success: false, error: 'Nama, judul capaian, dan tahun wajib diisi' }, 400);
    }

    const inserted = await db
      .insert(studentsAlumni)
      .values({
        name: body.name.trim(),
        type: body.type === 'alumni' ? 'alumni' : 'achievement',
        title: body.title.trim(),
        year: String(body.year).trim(),
        organization: body.organization ? body.organization.trim() : null,
        photoUrl: body.photoUrl || null,
        description: body.description ? body.description.trim() : null,
        isPublicConsent: body.isPublicConsent !== undefined ? Boolean(body.isPublicConsent) : true,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'students_alumni',
      entityId: String(inserted[0]?.id),
      details: `Menambahkan data ${body.type === 'alumni' ? 'alumni' : 'prestasi'}: "${body.name} - ${body.title}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/students_alumni/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(studentsAlumni).where(eq(studentsAlumni.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Data prestasi/alumni tidak ditemukan' }, 404);
    }

    const updated = await db
      .update(studentsAlumni)
      .set({
        name: body.name !== undefined ? body.name.trim() : existing.name,
        type: body.type !== undefined ? (body.type === 'alumni' ? 'alumni' : 'achievement') : existing.type,
        title: body.title !== undefined ? body.title.trim() : existing.title,
        year: body.year !== undefined ? String(body.year).trim() : existing.year,
        organization: body.organization !== undefined ? (body.organization ? body.organization.trim() : null) : existing.organization,
        photoUrl: body.photoUrl !== undefined ? body.photoUrl : existing.photoUrl,
        description: body.description !== undefined ? (body.description ? body.description.trim() : null) : existing.description,
        isPublicConsent: body.isPublicConsent !== undefined ? Boolean(body.isPublicConsent) : existing.isPublicConsent,
      })
      .where(eq(studentsAlumni.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'students_alumni',
      entityId: String(id),
      details: `Memperbarui data ${updated[0]?.type}: "${updated[0]?.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/students_alumni/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db
      .select()
      .from(studentsAlumni)
      .where(eq(studentsAlumni.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Data prestasi/alumni tidak ditemukan' }, 404);
    }

    const newConsent = !existing.isPublicConsent;
    const updated = await db
      .update(studentsAlumni)
      .set({ isPublicConsent: newConsent })
      .where(eq(studentsAlumni.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'students_alumni',
      entityId: String(id),
      details: `${newConsent ? 'Menampilkan ke' : 'Menyembunyikan dari'} web publik: "${existing.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/students_alumni/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));

    const existing = await db.select().from(studentsAlumni).where(eq(studentsAlumni.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Data prestasi/alumni tidak ditemukan' }, 404);
    }

    await db.delete(studentsAlumni).where(eq(studentsAlumni.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'students_alumni',
      entityId: String(id),
      details: `Menghapus data ${existing.type}: "${existing.name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.9. MANAJEMEN PENGGUNA STAF (Sprint 4 Super Admin Only)
// ==========================================
app.get('/admin/users', requireSuperAdmin, async (c) => {
  try {
    const list = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/users', requireSuperAdmin, async (c) => {
  try {
    const adminUser: any = c.get('user' as any);
    const body = await c.req.json();

    const { name, email, password, role } = body || {};
    if (!name || !email || !password) {
      return c.json({ success: false, error: 'Nama, email, dan kata sandi awal wajib diisi' }, 400);
    }

    if (String(password).length < 8) {
      return c.json({ success: false, error: 'Kata sandi awal minimal 8 karakter' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1).then((r) => r[0]);
    if (existing) {
      return c.json({ success: false, error: 'Email dinas sudah terdaftar dalam sistem' }, 400);
    }

    const passwordHash = await hashPassword(String(password));
    const userRole = role === 'super_admin' ? 'super_admin' : 'editor';
    const newId = crypto.randomUUID();

    const inserted = await db
      .insert(users)
      .values({
        id: newId,
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        role: userRole,
        isActive: true,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });

    await db.insert(auditLogs).values({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'CREATE',
      entity: 'user',
      entityId: newId,
      details: `Menambahkan staf baru: "${name}" (${normalizedEmail}) dengan role ${userRole}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/users/:id', requireSuperAdmin, async (c) => {
  try {
    const adminUser: any = c.get('user' as any);
    const targetId = c.req.param('id');
    const body = await c.req.json();

    const existing = await db.select().from(users).where(eq(users.id, targetId)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Pengguna staf tidak ditemukan' }, 404);
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.role !== undefined) {
      // Cegah Super Admin mengubah role akunnya sendiri (risiko terkunci / self-lockout)
      if (existing.id === adminUser.id && body.role !== 'super_admin') {
        return c.json({ success: false, error: 'Anda tidak dapat menurunkan peran Super Admin akun Anda sendiri' }, 400);
      }
      updateData.role = body.role === 'super_admin' ? 'super_admin' : 'editor';
    }
    if (body.isActive !== undefined) {
      // Cegah menonaktifkan akun sendiri
      if (existing.id === adminUser.id && !body.isActive) {
        return c.json({ success: false, error: 'Anda tidak dapat menonaktifkan akun Anda sendiri' }, 400);
      }
      updateData.isActive = Boolean(body.isActive);
    }
    if (body.password) {
      if (String(body.password).length < 8) {
        return c.json({ success: false, error: 'Kata sandi baru minimal 8 karakter' }, 400);
      }
      updateData.passwordHash = await hashPassword(String(body.password));
    }

    const updated = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      });

    await db.insert(auditLogs).values({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'UPDATE',
      entity: 'user',
      entityId: targetId,
      details: `Memperbarui akun staf: "${existing.name}" (${existing.email})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/users/:id', requireSuperAdmin, async (c) => {
  try {
    const adminUser: any = c.get('user' as any);
    const targetId = c.req.param('id');

    if (targetId === adminUser.id) {
      return c.json({ success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri' }, 400);
    }

    const existing = await db.select().from(users).where(eq(users.id, targetId)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Pengguna staf tidak ditemukan' }, 404);
    }

    await db.delete(users).where(eq(users.id, targetId));

    await db.insert(auditLogs).values({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'DELETE',
      entity: 'user',
      entityId: targetId,
      details: `Menghapus akun staf: "${existing.name}" (${existing.email})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Pengguna staf berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.8. MANAJEMEN BANNER SLIDER HERO (Kluster B2)
// ==========================================
app.get('/admin/sliders', async (c) => {
  try {
    const list = await db
      .select()
      .from(heroSlides)
      .orderBy(asc(heroSlides.orderNumber), asc(heroSlides.id));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/sliders', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { tagline, title, subtitle, imageUrl, linkUrl, linkText, linkUrl2, linkText2, orderNumber, isActive } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return c.json({ success: false, error: 'Judul slider wajib diisi' }, 400);
    }
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return c.json({ success: false, error: 'Gambar banner wajib dipilih dari media library' }, 400);
    }

    const maxOrderRes = await db
      .select({ maxOrder: sql<number>`MAX(${heroSlides.orderNumber})` })
      .from(heroSlides);
    const nextOrder = orderNumber !== undefined && Number(orderNumber) > 0 
      ? Number(orderNumber) 
      : ((maxOrderRes[0]?.maxOrder ?? 0) + 1);

    const inserted = await db.insert(heroSlides).values({
      tagline: tagline ? String(tagline).trim() : null,
      title: title.trim(),
      subtitle: subtitle ? String(subtitle).trim() : null,
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl ? String(linkUrl).trim() : null,
      linkText: linkText ? String(linkText).trim() : null,
      linkUrl2: linkUrl2 ? String(linkUrl2).trim() : null,
      linkText2: linkText2 ? String(linkText2).trim() : null,
      orderNumber: nextOrder,
      isActive: isActive !== false,
    }).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'CREATE',
      entity: 'hero_slide',
      entityId: String(inserted?.id),
      details: `Menambahkan banner slider baru: "${title}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/sliders/reorder', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { ids } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, error: 'Daftar ID urutan banner tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const batchUpdates = ids
      .map((id: any, i: number) => {
        const slideId = Number(id);
        if (isNaN(slideId)) return null;
        return db.update(heroSlides).set({
          orderNumber: i + 1,
          updatedAt: nowIso,
        }).where(eq(heroSlides.id, slideId));
      })
      .filter(Boolean);

    if (batchUpdates.length > 0) {
      await db.batch(batchUpdates as any);
    }

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'hero_slide',
      details: `Menata ulang urutan susunan banner slider hero (${ids.length} banner)`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, message: 'Urutan banner berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/sliders/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { tagline, title, subtitle, imageUrl, linkUrl, linkText, linkUrl2, linkText2, orderNumber, isActive } = body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return c.json({ success: false, error: 'Judul slider wajib diisi' }, 400);
    }
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return c.json({ success: false, error: 'Gambar banner wajib dipilih dari media library' }, 400);
    }

    const existing = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Slide banner tidak ditemukan' }, 404);
    }

    const targetOrderNumber = (orderNumber !== undefined && orderNumber !== null && !isNaN(Number(orderNumber)) && Number(orderNumber) > 0)
      ? Number(orderNumber)
      : (existing.orderNumber ?? 1);

    const updated = await db.update(heroSlides).set({
      tagline: tagline ? String(tagline).trim() : null,
      title: title.trim(),
      subtitle: subtitle ? String(subtitle).trim() : null,
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl ? String(linkUrl).trim() : null,
      linkText: linkText ? String(linkText).trim() : null,
      linkUrl2: linkUrl2 ? String(linkUrl2).trim() : null,
      linkText2: linkText2 ? String(linkText2).trim() : null,
      orderNumber: targetOrderNumber,
      isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      updatedAt: new Date().toISOString(),
    }).where(eq(heroSlides.id, id)).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'hero_slide',
      entityId: String(id),
      details: `Memperbarui banner slider: "${title}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/sliders/:id/toggle', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const user: any = c.get('user' as any);
    const existing = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Slider tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db.update(heroSlides).set({
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    }).where(eq(heroSlides.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'hero_slide',
      entityId: String(id),
      details: `Mengubah status banner slider "${existing.title}" menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/sliders/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const user: any = c.get('user' as any);
    const existing = await db.select().from(heroSlides).where(eq(heroSlides.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Slider tidak ditemukan' }, 404);
    }

    await db.delete(heroSlides).where(eq(heroSlides.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'DELETE',
      entity: 'hero_slide',
      entityId: String(id),
      details: `Menghapus banner slider: "${existing.title}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, message: 'Slider berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.7.1. MANAJEMEN NAVIGASI WEBSITE DINAMIS (Navbar)
// ==========================================

// GET /admin/navigation - Ambil seluruh menu website (Top-level & Submenu)
app.get('/admin/navigation', async (c) => {
  try {
    const list = await db
      .select()
      .from(navigationItems)
      .orderBy(asc(navigationItems.sortOrder), asc(navigationItems.createdAt));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



// POST /admin/navigation - Tambah menu navigasi baru
app.post('/admin/navigation', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const {
      label,
      type = 'page',
      href,
      parentId,
      sortOrder,
      isActive = true,
      showDesktop = true,
      showMobile = true,
      openInNewTab = false,
    } = body || {};

    if (!label || typeof label !== 'string' || !label.trim()) {
      return c.json({ success: false, error: 'Nama menu navigasi wajib diisi' }, 400);
    }

    if (type !== 'page' && type !== 'dropdown') {
      return c.json({ success: false, error: 'Tipe menu harus berupa "page" atau "dropdown"' }, 400);
    }

    if (type === 'page' && (!href || typeof href !== 'string' || !href.trim())) {
      return c.json({ success: false, error: 'Tujuan tautan halaman wajib diisi untuk menu tipe halaman' }, 400);
    }

    // Validasi Parent: Parent harus ada, bertipe dropdown, dan tidak boleh memiliki parent (max 2 level)
    let cleanParentId: string | null = null;
    if (parentId && typeof parentId === 'string' && parentId.trim()) {
      cleanParentId = parentId.trim();
      const parentItem = await db
        .select()
        .from(navigationItems)
        .where(eq(navigationItems.id, cleanParentId))
        .limit(1)
        .then((r) => r[0]);

      if (!parentItem) {
        return c.json({ success: false, error: 'Induk dropdown yang dipilih tidak ditemukan' }, 400);
      }
      if (parentItem.type !== 'dropdown') {
        return c.json({ success: false, error: 'Induk menu harus memiliki tipe Dropdown' }, 400);
      }
      if (parentItem.parentId) {
        return c.json({ success: false, error: 'Sistem hanya mendukung maksimal 2 tingkat dropdown (Menu Induk > Submenu)' }, 400);
      }
      if (type === 'dropdown') {
        return c.json({ success: false, error: 'Dropdown tidak dapat bersarang di dalam dropdown lain' }, 400);
      }
    }

    // Tentukan nomor urutan otomatis jika tidak disediakan
    let finalOrder = Number(sortOrder);
    if (isNaN(finalOrder)) {
      const siblings = await db
        .select()
        .from(navigationItems)
        .where(cleanParentId ? eq(navigationItems.parentId, cleanParentId) : isNull(navigationItems.parentId));
      finalOrder = siblings.length;
    }

    const newItemId = 'nav_' + crypto.randomUUID().slice(0, 8);
    const inserted = await db
      .insert(navigationItems)
      .values({
        id: newItemId,
        label: label.trim(),
        type,
        href: type === 'page' ? (href ? href.trim() : null) : null,
        parentId: cleanParentId,
        sortOrder: finalOrder,
        isActive: Boolean(isActive),
        showDesktop: Boolean(showDesktop),
        showMobile: Boolean(showMobile),
        openInNewTab: Boolean(openInNewTab),
      })
      .returning()
      .then((r) => r[0]);

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'CREATE',
        entity: 'navigation',
        entityId: newItemId,
        details: `Menambahkan item menu navigasi baru: "${label.trim()}" (${type})`,
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /admin/navigation/:id - Edit item menu navigasi
app.put('/admin/navigation/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const {
      label,
      type = 'page',
      href,
      parentId,
      sortOrder,
      isActive,
      showDesktop,
      showMobile,
      openInNewTab,
    } = body || {};

    const existing = await db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Item navigasi tidak ditemukan' }, 404);
    }

    if (!label || typeof label !== 'string' || !label.trim()) {
      return c.json({ success: false, error: 'Nama menu navigasi wajib diisi' }, 400);
    }

    if (type === 'page' && (!href || typeof href !== 'string' || !href.trim())) {
      return c.json({ success: false, error: 'Tujuan tautan halaman wajib diisi untuk menu tipe halaman' }, 400);
    }

    let cleanParentId: string | null = null;
    if (parentId && typeof parentId === 'string' && parentId.trim()) {
      cleanParentId = parentId.trim();
      if (cleanParentId === id) {
        return c.json({ success: false, error: 'Menu tidak dapat menjadi induk bagi dirinya sendiri' }, 400);
      }

      const parentItem = await db
        .select()
        .from(navigationItems)
        .where(eq(navigationItems.id, cleanParentId))
        .limit(1)
        .then((r) => r[0]);

      if (!parentItem) {
        return c.json({ success: false, error: 'Induk dropdown yang dipilih tidak ditemukan' }, 400);
      }
      if (parentItem.type !== 'dropdown') {
        return c.json({ success: false, error: 'Induk menu harus memiliki tipe Dropdown' }, 400);
      }
      if (parentItem.parentId) {
        return c.json({ success: false, error: 'Sistem hanya mendukung maksimal 2 tingkat dropdown' }, 400);
      }
    }

    // Jika diubah dari dropdown menjadi page, pastikan tidak memiliki anak
    if (existing.type === 'dropdown' && type === 'page') {
      const children = await db
        .select()
        .from(navigationItems)
        .where(eq(navigationItems.parentId, id));
      if (children.length > 0) {
        return c.json({
          success: false,
          error: `Menu ini memiliki ${children.length} submenu. Pindahkan atau hapus submenu terlebih dahulu sebelum mengubah tipe ke Halaman.`,
        }, 400);
      }
    }

    // Jika item adalah parent yang punya anak, tidak boleh dipindahkan menjadi anak orang lain (mencegah level 3)
    if (cleanParentId) {
      const children = await db
        .select()
        .from(navigationItems)
        .where(eq(navigationItems.parentId, id));
      if (children.length > 0) {
        return c.json({
          success: false,
          error: 'Menu dropdown yang memiliki submenu tidak dapat dipindahkan menjadi anak submenu lain.',
        }, 400);
      }
    }

    const updated = await db
      .update(navigationItems)
      .set({
        label: label.trim(),
        type,
        href: type === 'page' ? (href ? href.trim() : null) : null,
        parentId: cleanParentId,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        showDesktop: showDesktop !== undefined ? Boolean(showDesktop) : existing.showDesktop,
        showMobile: showMobile !== undefined ? Boolean(showMobile) : existing.showMobile,
        openInNewTab: openInNewTab !== undefined ? Boolean(openInNewTab) : existing.openInNewTab,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(navigationItems.id, id))
      .returning()
      .then((r) => r[0]);

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'UPDATE',
        entity: 'navigation',
        entityId: id,
        details: `Memperbarui menu navigasi "${label.trim()}"`,
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /admin/navigation/:id/toggle - Toggle status aktif / nonaktif
app.put('/admin/navigation/:id/toggle', async (c) => {
  try {
    const id = c.req.param('id');
    const user: any = c.get('user' as any);
    const existing = await db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Item navigasi tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db
      .update(navigationItems)
      .set({ isActive: newStatus, updatedAt: new Date().toISOString() })
      .where(eq(navigationItems.id, id));

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'UPDATE',
        entity: 'navigation',
        entityId: id,
        details: `${newStatus ? 'Mengaktifkan' : 'Menonaktifkan'} menu navigasi: "${existing.label}"`,
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /admin/navigation/reorder - Perbarui urutan / struktur menu
app.put('/admin/navigation/reorder', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { items } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'Daftar susunan menu tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const batchNavUpdates = items
      .filter((it: any) => it && it.id)
      .map((it: any) => {
        const updateData: any = {
          sortOrder: Number(it.sortOrder) || 0,
          updatedAt: nowIso,
        };
        if (it.parentId !== undefined) {
          updateData.parentId = it.parentId ? String(it.parentId) : null;
        }
        return db.update(navigationItems).set(updateData).where(eq(navigationItems.id, String(it.id)));
      });

    if (batchNavUpdates.length > 0) {
      await db.batch(batchNavUpdates as any);
    }

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'UPDATE',
        entity: 'navigation',
        entityId: 'reorder',
        details: 'Menyimpan susunan dan pengurutan menu navigasi website',
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, message: 'Urutan menu navigasi berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /admin/navigation/:id - Hapus menu navigasi
app.delete('/admin/navigation/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user: any = c.get('user' as any);

    const existing = await db
      .select()
      .from(navigationItems)
      .where(eq(navigationItems.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return c.json({ success: false, error: 'Item navigasi tidak ditemukan' }, 404);
    }

    // Jika memiliki anak (submenu), hapus juga submenu-nya
    await db.delete(navigationItems).where(eq(navigationItems.parentId, id));
    await db.delete(navigationItems).where(eq(navigationItems.id, id));

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'DELETE',
        entity: 'navigation',
        entityId: id,
        details: `Menghapus menu navigasi: "${existing.label}"`,
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, message: 'Menu navigasi berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /admin/navigation/reset-defaults - Kembalikan ke menu bawaan
app.post('/admin/navigation/reset-defaults', async (c) => {
  try {
    const user: any = c.get('user' as any);
    await db.delete(navigationItems);

    const defaultItems = [
      { id: 'nav_home', label: 'Beranda', type: 'page', href: '/', parentId: null, sortOrder: 0, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_profile', label: 'Profil', type: 'dropdown', href: null, parentId: null, sortOrder: 1, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_sambutan', label: 'Sambutan Kepala Sekolah', type: 'page', href: '/profil#sambutan', parentId: 'nav_profile', sortOrder: 0, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_sejarah', label: 'Sejarah Sekolah', type: 'page', href: '/profil#sejarah', parentId: 'nav_profile', sortOrder: 1, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_visimisi', label: 'Visi dan Misi', type: 'page', href: '/profil#visi-misi', parentId: 'nav_profile', sortOrder: 2, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_berita', label: 'Berita', type: 'page', href: '/berita', parentId: null, sortOrder: 2, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_agenda', label: 'Agenda', type: 'page', href: '/agenda', parentId: null, sortOrder: 3, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_direktori', label: 'Direktori', type: 'dropdown', href: null, parentId: null, sortOrder: 4, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_guru', label: 'Guru dan Staf', type: 'page', href: '/direktori', parentId: 'nav_direktori', sortOrder: 0, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_fasilitas', label: 'Fasilitas Sekolah', type: 'page', href: '/fasilitas', parentId: 'nav_direktori', sortOrder: 1, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_kontak', label: 'Kontak', type: 'page', href: '/kontak', parentId: null, sortOrder: 5, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
      { id: 'nav_ppdb', label: 'PPDB', type: 'page', href: '/pendaftaran', parentId: null, sortOrder: 6, isActive: true, showDesktop: true, showMobile: true, openInNewTab: false },
    ];

    for (const item of defaultItems) {
      await db.insert(navigationItems).values(item);
    }

    await db
      .insert(auditLogs)
      .values({
        userId: user?.id,
        userEmail: user?.email,
        action: 'UPDATE',
        entity: 'navigation',
        entityId: 'reset',
        details: 'Mereset susunan menu navigasi website ke konfigurasi standar sekolah',
        ipAddress: getClientIp(c),
      })
      .catch(() => null);

    return c.json({ success: true, message: 'Navigasi berhasil direset ke standar bawaan' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 3.8. EKSTRAKURIKULER & FASILITAS SEKOLAH
// ==========================================

// --- EKSTRAKURIKULER ---
app.get('/admin/extracurriculars', async (c) => {
  try {
    const list = await db
      .select()
      .from(extracurriculars)
      .orderBy(asc(extracurriculars.orderNumber), desc(extracurriculars.id));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/extracurriculars', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { name, category, schedule, coach, description, imageUrl, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama ekstrakurikuler wajib diisi' }, 400);
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return c.json({ success: false, error: 'Kategori ekstrakurikuler wajib dipilih' }, 400);
    }

    const inserted = await db.insert(extracurriculars).values({
      name: name.trim(),
      category: category.trim(),
      schedule: schedule ? String(schedule).trim() : null,
      coach: coach ? String(coach).trim() : null,
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
    }).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'CREATE',
      entity: 'extracurricular',
      entityId: String(inserted?.id),
      details: `Menambahkan ekstrakurikuler baru: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/extracurriculars/reorder', async (c) => {
  try {
    const body = await c.req.json();
    const { ids } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, error: 'Daftar ID urutan tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const batchEkskul = ids
      .map((id: any, i: number) => {
        const numId = Number(id);
        if (isNaN(numId)) return null;
        return db.update(extracurriculars).set({
          orderNumber: i + 1,
          updatedAt: nowIso,
        }).where(eq(extracurriculars.id, numId));
      })
      .filter(Boolean);

    if (batchEkskul.length > 0) {
      await db.batch(batchEkskul as any);
    }

    return c.json({ success: true, message: 'Urutan ekstrakurikuler berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/extracurriculars/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const body = await c.req.json();
    const { name, category, schedule, coach, description, imageUrl, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama ekstrakurikuler wajib diisi' }, 400);
    }

    const updated = await db.update(extracurriculars).set({
      name: name.trim(),
      category: category ? String(category).trim() : 'Umum',
      schedule: schedule ? String(schedule).trim() : null,
      coach: coach ? String(coach).trim() : null,
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
    }).where(eq(extracurriculars.id, id)).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'extracurricular',
      entityId: String(id),
      details: `Memperbarui ekstrakurikuler: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/extracurriculars/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(extracurriculars).where(eq(extracurriculars.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Ekstrakurikuler tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db.update(extracurriculars).set({
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    }).where(eq(extracurriculars.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'extracurricular',
      entityId: String(id),
      details: `Mengubah status ekstrakurikuler "${existing.name}" menjadi: ${newStatus ? 'Aktif' : 'Non-aktif'}`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/extracurriculars/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(extracurriculars).where(eq(extracurriculars.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Ekstrakurikuler tidak ditemukan' }, 404);
    }

    await db.delete(extracurriculars).where(eq(extracurriculars.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'DELETE',
      entity: 'extracurricular',
      entityId: String(id),
      details: `Menghapus ekstrakurikuler: "${existing.name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, message: 'Ekstrakurikuler berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- FASILITAS SEKOLAH ---
app.get('/admin/facilities', async (c) => {
  try {
    const list = await db
      .select()
      .from(facilities)
      .orderBy(asc(facilities.orderNumber), desc(facilities.id));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/facilities', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { name, category, location, capacity, description, imageUrl, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama fasilitas wajib diisi' }, 400);
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return c.json({ success: false, error: 'Kategori fasilitas wajib dipilih' }, 400);
    }

    const inserted = await db.insert(facilities).values({
      name: name.trim(),
      category: category.trim(),
      location: location ? String(location).trim() : null,
      capacity: capacity ? String(capacity).trim() : null,
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
    }).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'CREATE',
      entity: 'facility',
      entityId: String(inserted?.id),
      details: `Menambahkan fasilitas baru: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/facilities/reorder', async (c) => {
  try {
    const body = await c.req.json();
    const { ids } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, error: 'Daftar ID urutan tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const batchFac = ids
      .map((id: any, i: number) => {
        const numId = Number(id);
        if (isNaN(numId)) return null;
        return db.update(facilities).set({
          orderNumber: i + 1,
          updatedAt: nowIso,
        }).where(eq(facilities.id, numId));
      })
      .filter(Boolean);

    if (batchFac.length > 0) {
      await db.batch(batchFac as any);
    }

    return c.json({ success: true, message: 'Urutan fasilitas berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/facilities/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const body = await c.req.json();
    const { name, category, location, capacity, description, imageUrl, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama fasilitas wajib diisi' }, 400);
    }

    const updated = await db.update(facilities).set({
      name: name.trim(),
      category: category ? String(category).trim() : 'Umum',
      location: location ? String(location).trim() : null,
      capacity: capacity ? String(capacity).trim() : null,
      description: description ? String(description).trim() : null,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
    }).where(eq(facilities.id, id)).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'facility',
      entityId: String(id),
      details: `Memperbarui fasilitas: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/facilities/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Fasilitas tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db.update(facilities).set({
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    }).where(eq(facilities.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'facility',
      entityId: String(id),
      details: `Mengubah status fasilitas "${existing.name}" menjadi: ${newStatus ? 'Aktif' : 'Non-aktif'}`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/facilities/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Fasilitas tidak ditemukan' }, 404);
    }

    await db.delete(facilities).where(eq(facilities.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'DELETE',
      entity: 'facility',
      entityId: String(id),
      details: `Menghapus fasilitas: "${existing.name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, message: 'Fasilitas berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// --- MITRA & REKANAN KERJA SAMA ---
app.get('/admin/partners', async (c) => {
  try {
    const list = await db
      .select()
      .from(partners)
      .orderBy(asc(partners.orderNumber), desc(partners.id));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/partners', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { name, category, logoUrl, websiteUrl, description, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama mitra / instansi wajib diisi' }, 400);
    }
    if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) {
      return c.json({ success: false, error: 'Logo mitra wajib diunggah/dipilih' }, 400);
    }

    const inserted = await db.insert(partners).values({
      name: name.trim(),
      category: category ? String(category).trim() : 'Perguruan Tinggi',
      logoUrl: logoUrl.trim(),
      websiteUrl: websiteUrl ? String(websiteUrl).trim() : null,
      description: description ? String(description).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
    }).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'CREATE',
      entity: 'partner',
      entityId: String(inserted?.id),
      details: `Menambahkan mitra kerja sama: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/partners/reorder', async (c) => {
  try {
    const body = await c.req.json();
    const { ids } = body || {};

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ success: false, error: 'Daftar ID urutan tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const batchOps = ids
      .map((id: any, i: number) => {
        const numId = Number(id);
        if (isNaN(numId)) return null;
        return db.update(partners).set({
          orderNumber: i + 1,
          updatedAt: nowIso,
        }).where(eq(partners.id, numId));
      })
      .filter(Boolean);

    if (batchOps.length > 0) {
      await db.batch(batchOps as any);
    }

    return c.json({ success: true, message: 'Urutan mitra berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/partners/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const body = await c.req.json();
    const { name, category, logoUrl, websiteUrl, description, orderNumber, isActive } = body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return c.json({ success: false, error: 'Nama mitra / instansi wajib diisi' }, 400);
    }
    if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) {
      return c.json({ success: false, error: 'Logo mitra wajib diunggah/dipilih' }, 400);
    }

    const updated = await db.update(partners).set({
      name: name.trim(),
      category: category ? String(category).trim() : 'Perguruan Tinggi',
      logoUrl: logoUrl.trim(),
      websiteUrl: websiteUrl ? String(websiteUrl).trim() : null,
      description: description ? String(description).trim() : null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
    }).where(eq(partners.id, id)).returning().then(r => r[0]);

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'partner',
      entityId: String(id),
      details: `Memperbarui data mitra: "${name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/partners/:id/toggle', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(partners).where(eq(partners.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Mitra tidak ditemukan' }, 404);
    }

    const newStatus = !existing.isActive;
    await db.update(partners).set({
      isActive: newStatus,
      updatedAt: new Date().toISOString(),
    }).where(eq(partners.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'UPDATE',
      entity: 'partner',
      entityId: String(id),
      details: `Mengubah status mitra "${existing.name}" menjadi: ${newStatus ? 'Aktif' : 'Non-aktif'}`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, isActive: newStatus });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/partners/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    if (isNaN(id)) return c.json({ success: false, error: 'ID tidak valid' }, 400);

    const existing = await db.select().from(partners).where(eq(partners.id, id)).limit(1).then(r => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Mitra tidak ditemukan' }, 404);
    }

    await db.delete(partners).where(eq(partners.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id,
      userEmail: user?.email,
      action: 'DELETE',
      entity: 'partner',
      entityId: String(id),
      details: `Menghapus mitra: "${existing.name}"`,
      ipAddress: getClientIp(c),
    }).catch(() => null);

    return c.json({ success: true, message: 'Mitra berhasil dihapus' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 4. PUSTAKA MEDIA & STORAGE R2/LOKAL (Kluster C1)
// ==========================================
import path from 'path';
// r2/sharp are Node.js-only — loaded lazily at runtime inside each handler (not at module init)
// This prevents Cloudflare Workers from crashing on startup due to incompatible native modules
const loadR2 = () => import('./r2');

// 4.1. DAFTAR BERKAS MEDIA DENGAN FILTER & STATS
app.get('/admin/media', async (c) => {
  try {
    const category = c.req.query('category');
    const search = c.req.query('search')?.trim();
    const type = c.req.query('type'); // 'image', 'document', 'video', 'all'
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(c.req.query('limit') || '36', 10)));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];

    if (category && category !== 'all' && category !== 'Semua') {
      conditions.push(eq(media.category, category));
    }

    if (search) {
      conditions.push(
        or(
          like(media.title, `%${search}%`),
          like(media.originalName, `%${search}%`),
          like(media.altText, `%${search}%`),
          like(media.description, `%${search}%`)
        )
      );
    }

    if (type && type !== 'all') {
      if (type === 'image') {
        conditions.push(like(media.fileType, 'image/%'));
      } else if (type === 'video') {
        conditions.push(or(like(media.fileType, 'video/%'), eq(media.fileExtension, 'mp4')));
      } else if (type === 'document') {
        conditions.push(
          or(
            like(media.fileType, '%pdf%'),
            like(media.fileType, '%document%'),
            like(media.fileType, '%sheet%'),
            like(media.fileType, '%presentation%'),
            eq(media.fileExtension, 'pdf'),
            eq(media.fileExtension, 'doc'),
            eq(media.fileExtension, 'docx'),
            eq(media.fileExtension, 'xls'),
            eq(media.fileExtension, 'xlsx')
          )
        );
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalRes, statsRes] = await Promise.all([
      db.select()
        .from(media)
        .where(whereClause)
        .orderBy(desc(media.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(media)
        .where(whereClause),
      db.select({
        totalSize: sql<number>`COALESCE(sum(${media.fileSize}), 0)`,
        totalCount: sql<number>`count(*)`,
      }).from(media),
    ]);

    const total = totalRes[0]?.count || 0;
    const stats = {
      totalSize: statsRes[0]?.totalSize || 0,
      totalCount: statsRes[0]?.totalCount || 0,
    };

    return c.json({
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4.2. UNGGAH BERKAS BARU KE PUSTAKA MEDIA (Multi-size, Metadata, Keamanan)
app.post('/admin/media/upload', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.parseBody();
    const file = body['file'];
    const category = (body['category'] as string) || 'Umum';
    const title = (body['title'] as string) || '';
    const description = (body['description'] as string) || '';
    const altText = (body['altText'] as string) || '';
    const isPrivate = body['isPrivate'] === 'true' || body['isPrivate'] === '1' || body['isPrivate'] === true;

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Berkas tidak ditemukan dalam formulir' }, 400);
    }

    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());
    const fileName = (file as File).name;
    const mimeType = (file as File).type || 'application/octet-stream';

    // Validasi Ekstensi Berkas — Allowlist (Keamanan Institusi TC-13)
    const ext = (fileName.toLowerCase().split('.').pop() || '').trim();
    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'bmp', 'tiff', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'aac'];
    if (!ALLOWED_EXTS.includes(ext)) {
      return c.json({ success: false, error: `Format berkas .${ext} tidak diizinkan. Hanya format gambar, dokumen, video, dan audio yang diterima.` }, 400);
    }

    // Batasi ukuran maksimal 15 MB
    if (fileBuffer.byteLength > 15 * 1024 * 1024) {
      return c.json({ success: false, error: 'Ukuran file melebihi batas 15 MB' }, 400);
    }

    const { processAndUploadMedia } = await loadR2();
    const processed = await processAndUploadMedia(fileBuffer, fileName, mimeType);

    const cleanTitle = title.trim() || path.basename(fileName, path.extname(fileName));
    const cleanAlt = altText.trim() || cleanTitle;

    const inserted = await db.insert(media).values({
      fileName: path.basename(processed.storageKey),
      originalName: fileName,
      fileUrl: processed.url,
      thumbnailUrl: processed.thumbnailUrl,
      mediumUrl: processed.mediumUrl,
      fileSize: processed.fileSize,
      fileType: processed.mimeType,
      fileExtension: processed.extension,
      category,
      title: cleanTitle,
      description: description.trim(),
      altText: cleanAlt,
      isPrivate,
      uploadedBy: user.id,
      uploaderName: user.name,
      storageKey: processed.storageKey,
      width: processed.width,
      height: processed.height,
    }).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'media',
      entityId: String(inserted[0].id),
      details: `Mengunggah media: "${fileName}" [${category}] (${(fileBuffer.byteLength / 1024).toFixed(1)} KB)`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4.2b. GANTI / TIMPA BERKAS MEDIA (Replace / Crop Overwrite)
app.post('/admin/media/:id/replace', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.parseBody();
    const file = body['file'];

    const existing = await db.select().from(media).where(eq(media.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Berkas media tidak ditemukan' }, 404);
    }

    if (user.role !== 'super_admin' && existing.uploadedBy !== user.id) {
      return c.json({ success: false, error: 'Akses ditolak: Anda hanya dapat mengganti berkas yang Anda unggah sendiri' }, 403);
    }

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Berkas pengganti tidak ditemukan' }, 400);
    }

    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());
    const fileName = (file as File).name || existing.originalName;
    const mimeType = (file as File).type || existing.fileType || 'application/octet-stream';

    const { processAndUploadMedia, deleteStorageFiles } = await loadR2();
    const processed = await processAndUploadMedia(fileBuffer, fileName, mimeType);

    // Hapus berkas fisik lama jika berbeda
    if (existing.storageKey && existing.storageKey !== processed.storageKey) {
      const keysToDelete = [existing.storageKey];
      if (existing.thumbnailUrl) keysToDelete.push(existing.thumbnailUrl);
      if (existing.mediumUrl) keysToDelete.push(existing.mediumUrl);
      await deleteStorageFiles(keysToDelete).catch(() => {});
    }

    const updated = await db.update(media).set({
      fileName: path.basename(processed.storageKey),
      originalName: fileName,
      fileUrl: processed.url,
      thumbnailUrl: processed.thumbnailUrl,
      mediumUrl: processed.mediumUrl,
      fileSize: processed.fileSize,
      fileType: processed.mimeType,
      fileExtension: processed.extension,
      storageKey: processed.storageKey,
      width: processed.width,
      height: processed.height,
      updatedAt: sql`(CURRENT_TIMESTAMP)`,
    }).where(eq(media.id, id)).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'media',
      entityId: String(id),
      details: `Mengganti berkas media: "${existing.originalName}" -> "${fileName}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4.3. PERBARUI METADATA BERKAS MEDIA (Role-Protected)
app.put('/admin/media/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const body = await c.req.json();

    const existing = await db.select().from(media).where(eq(media.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Berkas media tidak ditemukan' }, 404);
    }

    // Role check: Editor hanya boleh mengedit metadata berkas miliknya sendiri
    if (user.role !== 'super_admin' && existing.uploadedBy !== user.id) {
      return c.json({
        success: false,
        error: 'Akses ditolak: Anda hanya dapat mengubah metadata berkas yang Anda unggah sendiri',
      }, 403);
    }

    const updated = await db.update(media).set({
      title: body.title !== undefined ? body.title : existing.title,
      description: body.description !== undefined ? body.description : existing.description,
      altText: body.altText !== undefined ? body.altText : existing.altText,
      category: body.category !== undefined ? body.category : existing.category,
      isPrivate: body.isPrivate !== undefined ? Boolean(body.isPrivate) : existing.isPrivate,
      updatedAt: sql`(CURRENT_TIMESTAMP)`,
    }).where(eq(media.id, id)).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'media',
      entityId: String(id),
      details: `Memperbarui metadata media: "${updated[0].title || updated[0].fileName}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated[0] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4.4. CEK PENGGUNAAN ASET MEDIA DI HALAMAN LAIN (Mencegah Broken Image)
app.get('/admin/media/:id/usage', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const item = await db.select().from(media).where(eq(media.id, id)).limit(1).then((r) => r[0]);
    if (!item) {
      return c.json({ success: false, error: 'Berkas media tidak ditemukan' }, 404);
    }

    const url = item.fileUrl;
    const thumb = item.thumbnailUrl;
    const medium = item.mediumUrl;

    const [usedArticles, usedGalleries, usedTeachers, usedDocuments] = await Promise.all([
      db.select({ id: articles.id, title: articles.title, slug: articles.slug })
        .from(articles)
        .where(
          or(
            eq(articles.coverImage, url),
            like(articles.content, `%${url}%`),
            thumb ? like(articles.content, `%${thumb}%`) : sql`0=1`,
            medium ? like(articles.content, `%${medium}%`) : sql`0=1`
          )
        )
        .limit(5),
      db.select({ id: galleries.id, title: galleries.title })
        .from(galleries)
        .where(eq(galleries.mediaUrl, url))
        .limit(5),
      db.select({ id: teachers.id, name: teachers.name })
        .from(teachers)
        .where(eq(teachers.photoUrl, url))
        .limit(5),
      db.select({ id: documents.id, title: documents.title })
        .from(documents)
        .where(eq(documents.fileUrl, url))
        .limit(5),
    ]);

    const totalUsage = usedArticles.length + usedGalleries.length + usedTeachers.length + usedDocuments.length;

    return c.json({
      success: true,
      isUsed: totalUsage > 0,
      totalUsage,
      usage: {
        articles: usedArticles,
        galleries: usedGalleries,
        teachers: usedTeachers,
        documents: usedDocuments,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4.5. HAPUS BERKAS MEDIA (Role-Protected & Safe Usage Check)
app.delete('/admin/media/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = Number(c.req.param('id'));
    const force = c.req.query('force') === 'true';

    const existing = await db.select().from(media).where(eq(media.id, id)).limit(1).then((r) => r[0]);
    if (!existing) {
      return c.json({ success: false, error: 'Berkas media tidak ditemukan' }, 404);
    }

    // Role check: Editor dikunci agar tidak bisa menghapus berkas pengguna lain
    if (user.role !== 'super_admin' && existing.uploadedBy !== user.id) {
      return c.json({
        success: false,
        error: 'Akses ditolak: Anda hanya memiliki izin untuk menghapus berkas yang Anda unggah sendiri.',
      }, 403);
    }

    // Cek penggunaan aset sebelum dihapus jika belum dikonfirmasi force
    if (!force) {
      const url = existing.fileUrl;
      const [usedArticles, usedGalleries] = await Promise.all([
        db.select({ id: articles.id, title: articles.title })
          .from(articles)
          .where(or(eq(articles.coverImage, url), like(articles.content, `%${url}%`)))
          .limit(3),
        db.select({ id: galleries.id, title: galleries.title })
          .from(galleries)
          .where(eq(galleries.mediaUrl, url))
          .limit(3),
      ]);

      const count = usedArticles.length + usedGalleries.length;
      if (count > 0) {
        const names = [...usedArticles.map((a) => `Berita: "${a.title}"`), ...usedGalleries.map((g) => `Galeri: "${g.title}"`)].join(', ');
        return c.json({
          success: false,
          requiresConfirmation: true,
          error: `Berkas ini masih digunakan di ${count} tempat (${names}). Menghapusnya akan merusak tampilan (broken link).`,
        }, 409);
      }
    }

    const keysToDelete: string[] = [];
    if (existing.storageKey) keysToDelete.push(existing.storageKey);
    if (existing.thumbnailUrl) {
      const thumbKey = existing.thumbnailUrl.replace(/^\/?uploads\//, '').replace(/^https?:\/\/[^\/]+\//, '');
      keysToDelete.push(thumbKey);
    }
    if (existing.mediumUrl) {
      const medKey = existing.mediumUrl.replace(/^\/?uploads\//, '').replace(/^https?:\/\/[^\/]+\//, '');
      keysToDelete.push(medKey);
    }

    const { deleteStorageFiles } = await loadR2();
    await deleteStorageFiles(keysToDelete);
    await db.delete(media).where(eq(media.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'DELETE',
      entity: 'media',
      entityId: String(id),
      details: `Menghapus berkas media: "${existing.originalName || existing.fileName}" (${(existing.fileSize / 1024).toFixed(1)} KB)`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Berkas berhasil dihapus dari Pustaka Media' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// 4.5. ENDPOINT UPLOAD UMUM (Kompatibilitas Mundur & Integrasi Otomatis Media Library)
app.post('/admin/upload', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ success: false, error: 'Berkas tidak ditemukan dalam formulir' }, 400);
    }

    const fileBuffer = Buffer.from(await (file as File).arrayBuffer());
    const fileName = (file as File).name;
    const mimeType = (file as File).type || 'application/octet-stream';

    const ext = (fileName.toLowerCase().split('.').pop() || '').trim();
    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'bmp', 'tiff', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'flac', 'aac'];
    if (!ALLOWED_EXTS.includes(ext)) {
      return c.json({ success: false, error: `Format berkas .${ext} tidak diizinkan. Hanya format gambar, dokumen, video, dan audio yang diterima.` }, 400);
    }

    if (fileBuffer.byteLength > 15 * 1024 * 1024) {
      return c.json({ success: false, error: 'Ukuran file melebihi batas 15 MB' }, 400);
    }

    const { processAndUploadMedia: processMedia } = await loadR2();
    const processed = await processMedia(fileBuffer, fileName, mimeType);

    // Otomatis simpan ke tabel media
    const cleanTitle = path.basename(fileName, path.extname(fileName));
    const inserted = await db.insert(media).values({
      fileName: path.basename(processed.storageKey),
      originalName: fileName,
      fileUrl: processed.url,
      thumbnailUrl: processed.thumbnailUrl,
      mediumUrl: processed.mediumUrl,
      fileSize: processed.fileSize,
      fileType: processed.mimeType,
      fileExtension: processed.extension,
      category: 'Umum',
      title: cleanTitle,
      description: '',
      altText: cleanTitle,
      isPrivate: false,
      uploadedBy: user?.id || null,
      uploaderName: user?.name || null,
      storageKey: processed.storageKey,
      width: processed.width,
      height: processed.height,
    }).returning().catch(() => null);

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'CREATE',
      entity: 'media',
      entityId: processed.storageKey,
      details: `Mengunggah berkas: "${fileName}" (${(fileBuffer.byteLength / 1024).toFixed(1)} KB)`,
      ipAddress: getClientIp(c),
    });

    return c.json({
      success: true,
      url: processed.url,
      key: processed.storageKey,
      size: processed.fileSize,
      mimeType: processed.mimeType,
      thumbnailUrl: processed.thumbnailUrl,
      mediumUrl: processed.mediumUrl,
      mediaId: inserted ? inserted[0]?.id : null,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


// ==========================================
// 5. PENGATURAN IDENTITAS SEKOLAH & AUDIT LOGS (Super Admin Only)
// ==========================================
app.post('/admin/settings', requireSuperAdmin, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Data pengaturan tidak valid' }, 400);
    }

    const nowIso = new Date().toISOString();
    const entries: { key: string; value: string; updatedAt: string }[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') {
        entries.push({ key, value, updatedAt: nowIso });
      }
    }

    // Batch all writes in a single round-trip HTTP pipeline to Turso
    const batchOps: any[] = [];
    if (entries.length > 0) {
      batchOps.push(
        db
          .insert(settings)
          .values(entries)
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: sql`excluded.value`,
              updatedAt: sql`excluded.updated_at`,
            },
          })
      );
    }

    // Jika admissions_label diperbarui, sinkronkan juga record menu navbar pendaftaran
    if (typeof body.admissions_label === 'string' && body.admissions_label.trim()) {
      const newLabel = body.admissions_label.trim();
      batchOps.push(
        db.update(navigationItems)
          .set({ label: newLabel })
          .where(or(eq(navigationItems.id, 'nav_ppdb'), eq(navigationItems.href, '/pendaftaran')))
      );
    }

    batchOps.push(
      db.insert(auditLogs).values({
        userId: user.id,
        userEmail: user.email,
        action: 'UPDATE',
        entity: 'setting',
        entityId: 'global',
        details: 'Memperbarui konfigurasi identitas visual & informasi sekolah',
        ipAddress: getClientIp(c),
      })
    );

    if (batchOps.length > 0) {
      await db.batch(batchOps as any);
    }

    // Invalidate cached settings so subsequent reads fetch fresh data
    invalidateSettingsCache();

    return c.json({ success: true, message: 'Pengaturan sekolah berhasil diperbarui' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint Riwayat Audit Logs (Super Admin Only)
app.get('/admin/logs', requireSuperAdmin, async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    const offset = Number(c.req.query('offset')) || 0;

    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ success: true, data: logs });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 8. BACKUP & PEMULIHAN BASIS DATA (Sprint 3)
// ==========================================
app.get('/admin/backup/download', requireSuperAdmin, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const snapshot = await createDatabaseSnapshot();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BACKUP_EXPORT',
      entity: 'database',
      entityId: 'full_snapshot',
      details: `Ekspor cadangan basis data lengkap (${snapshot.metadata.totalTables} tabel, Checksum: ${snapshot.checksum.slice(0, 8)}...)`,
      ipAddress: getClientIp(c),
    });

    const filename = `backup-sman1unggulan-${new Date().toISOString().slice(0, 10)}.json`;
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Type', 'application/json');
    return c.body(JSON.stringify(snapshot, null, 2));
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/backup/sqlite', requireSuperAdmin, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const fs = await import('fs');
    const path = await import('path');
    const dbPath = path.resolve(process.cwd(), 'local.db');

    if (!fs.existsSync(dbPath)) {
      return c.json({ success: false, error: 'Berkas basis data local.db tidak ditemukan di direktori root server.' }, 404);
    }

    const fileBuffer = fs.readFileSync(dbPath);
    const filename = `backup-database-${new Date().toISOString().slice(0, 10)}.db`;

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BACKUP_SQLITE_EXPORT',
      entity: 'database',
      entityId: 'sqlite_file',
      details: `Ekspor berkas biner SQLite utuh (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`,
      ipAddress: getClientIp(c),
    });

    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Type', 'application/x-sqlite3');
    return c.body(fileBuffer);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/backup/restore', requireSuperAdmin, async (c) => {
  try {
    const user: any = c.get('user' as any);
    let snapshot: any;
    try {
      snapshot = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Format berkas snapshot JSON tidak valid.' }, 400);
    }

    const result = await restoreDatabaseSnapshot(snapshot);

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BACKUP_RESTORE',
      entity: 'database',
      entityId: 'full_snapshot',
      details: `Pemulihan basis data dari snapshot berkas berhasil. Tabel dipulihkan: ${Object.keys(result.restoredCounts).join(', ')}`,
      ipAddress: getClientIp(c),
    });

    return c.json({
      success: true,
      message: 'Basis data berhasil dipulihkan dari cadangan.',
      restoredCounts: result.restoredCounts,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// ==========================================
// 9. MANAJEMEN PENDAFTAR PPDB (Operator & Admin PPDB)
// ==========================================
app.get('/admin/ppdb/registrations', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 15));
    const offset = (page - 1) * limit;
    const status = c.req.query('status');
    const pathQuery = c.req.query('path');
    const waveQuery = c.req.query('wave');
    const search = c.req.query('q')?.trim();

    const conditions: any[] = [];
    if (status && ['submitted', 'verified', 'accepted', 'rejected'].includes(status)) {
      conditions.push(eq(registrations.status, status as any));
    }
    if (pathQuery) {
      conditions.push(eq(registrations.admissionPath, pathQuery));
    }
    if (waveQuery) {
      conditions.push(eq(registrations.wave, waveQuery));
    }
    if (search) {
      conditions.push(
        or(
          like(registrations.fullName, `%${search}%`),
          like(registrations.registrationNumber, `%${search}%`),
          like(registrations.nik, `%${search}%`),
          like(registrations.nisn, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(registrations)
      .where(whereClause)
      .then((r) => Number(r[0]?.count || 0));

    const list = await db
      .select({
        id: registrations.id,
        registrationNumber: registrations.registrationNumber,
        academicYear: registrations.academicYear,
        wave: registrations.wave,
        regType: registrations.regType,
        admissionPath: registrations.admissionPath,
        schoolType: registrations.schoolType,
        majorChoice1: registrations.majorChoice1,
        majorChoice2: registrations.majorChoice2,
        isBoarding: registrations.isBoarding,
        fullName: registrations.fullName,
        nik: registrations.nik,
        nisn: registrations.nisn,
        gender: registrations.gender,
        birthPlace: registrations.birthPlace,
        birthDate: registrations.birthDate,
        prevSchool: registrations.prevSchool,
        phoneStudent: registrations.phoneStudent,
        city: registrations.city,
        status: registrations.status,
        registrationStatus: registrations.registrationStatus,
        verificationStatus: registrations.verificationStatus,
        selectionStatus: registrations.selectionStatus,
        verificationCode: registrations.verificationCode,
        revisionNotes: registrations.revisionNotes,
        verifiedAt: registrations.verifiedAt,
        notes: registrations.notes,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(whereClause)
      .orderBy(desc(registrations.createdAt))
      .limit(limit)
      .offset(offset);

    // Hitung ringkasan statistik real-time
    const statsTotal = await db.select({ count: sql<number>`count(*)` }).from(registrations).then((r) => Number(r[0]?.count || 0));
    const statsSubmitted = await db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.status, 'submitted')).then((r) => Number(r[0]?.count || 0));
    const statsVerified = await db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.status, 'verified')).then((r) => Number(r[0]?.count || 0));
    const statsAccepted = await db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.status, 'accepted')).then((r) => Number(r[0]?.count || 0));
    const statsRejected = await db.select({ count: sql<number>`count(*)` }).from(registrations).where(eq(registrations.status, 'rejected')).then((r) => Number(r[0]?.count || 0));

    return c.json({
      success: true,
      data: list,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total: statsTotal,
        submitted: statsSubmitted,
        verified: statsVerified,
        accepted: statsAccepted,
        rejected: statsRejected,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/ppdb/registrations/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const student = await db
      .select()
      .from(registrations)
      .where(eq(registrations.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!student) {
      return c.json({ success: false, error: 'Data pendaftar tidak ditemukan.' }, 404);
    }

    return c.json({ success: true, data: student });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.patch('/admin/ppdb/registrations/:id/status', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status, verificationStatus, selectionStatus, revisionNotes, notes } = body || {};

    const target = await db
      .select({ id: registrations.id, fullName: registrations.fullName, registrationNumber: registrations.registrationNumber })
      .from(registrations)
      .where(eq(registrations.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!target) {
      return c.json({ success: false, error: 'Data pendaftar tidak ditemukan.' }, 404);
    }

    const updateFields: any = {
      updatedAt: new Date().toISOString(),
    };

    // Update status verifikasi berkas
    if (verificationStatus && ['pending', 'revision_required', 'verified'].includes(verificationStatus)) {
      updateFields.verificationStatus = verificationStatus;
      updateFields.verifiedBy = user.id;
      updateFields.verifiedAt = new Date().toISOString();
    }

    // Update hasil seleksi
    if (selectionStatus && ['not_announced', 'accepted', 'rejected', 'waitlist'].includes(selectionStatus)) {
      updateFields.selectionStatus = selectionStatus;
    }

    if (revisionNotes !== undefined) {
      updateFields.revisionNotes = revisionNotes ? String(revisionNotes).trim() : null;
    }

    if (notes !== undefined) {
      updateFields.notes = notes ? String(notes).trim() : null;
    }

    // Sinkronisasi status terpadu legacy
    if (status && ['submitted', 'verified', 'accepted', 'rejected'].includes(status)) {
      updateFields.status = status;
    } else if (updateFields.selectionStatus === 'accepted') {
      updateFields.status = 'accepted';
    } else if (updateFields.selectionStatus === 'rejected') {
      updateFields.status = 'rejected';
    } else if (updateFields.verificationStatus === 'verified') {
      updateFields.status = 'verified';
    } else {
      updateFields.status = 'submitted';
    }

    await db
      .update(registrations)
      .set(updateFields)
      .where(eq(registrations.id, id));

    const auditDetail = `Operator memperbarui status ${target.fullName} (${target.registrationNumber}): Berkas=${updateFields.verificationStatus || 'tetap'}, Seleksi=${updateFields.selectionStatus || 'tetap'}`;

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'PPDB_STATUS_UPDATE',
      entity: 'registration',
      entityId: target.registrationNumber,
      details: auditDetail,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Status pendaftaran berhasil diperbarui.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/ppdb/registrations/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = c.req.param('id');

    const target = await db
      .select({ id: registrations.id, fullName: registrations.fullName, registrationNumber: registrations.registrationNumber })
      .from(registrations)
      .where(eq(registrations.id, id))
      .limit(1)
      .then((r) => r[0]);

    if (!target) {
      return c.json({ success: false, error: 'Data pendaftar tidak ditemukan.' }, 404);
    }

    await db.delete(registrations).where(eq(registrations.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id || 'system',
      userEmail: user?.email || 'admin@system',
      action: 'PPDB_REGISTRATION_DELETE',
      entity: 'registration',
      entityId: target.registrationNumber,
      details: `Operator menghapus data calon siswa ${target.fullName} (${target.registrationNumber})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Data calon siswa berhasil dihapus.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/ppdb/export', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const status = c.req.query('status');
    const waveQuery = c.req.query('wave');
    const search = c.req.query('q')?.trim();

    const conditions: any[] = [];
    if (status && ['submitted', 'verified', 'accepted', 'rejected'].includes(status)) {
      conditions.push(eq(registrations.status, status as any));
    }
    if (waveQuery) {
      conditions.push(eq(registrations.wave, waveQuery));
    }
    if (search) {
      conditions.push(
        or(
          like(registrations.fullName, `%${search}%`),
          like(registrations.registrationNumber, `%${search}%`),
          like(registrations.nik, `%${search}%`),
          like(registrations.nisn, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Ambil data pendaftar (terfilter atau seluruhnya)
    const list = await db
      .select()
      .from(registrations)
      .where(whereClause)
      .orderBy(desc(registrations.createdAt));

    const isFiltered = conditions.length > 0;

    // Proteksi Keamanan: Catat Log Akses Ekspor PII Sensitif
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'PPDB_EXPORT_DATA',
      entity: 'registration',
      entityId: isFiltered ? 'filtered' : 'all',
      details: `Ekspor data ${isFiltered ? 'terfilter' : 'seluruh'} calon pendaftar PPDB (${list.length} baris) oleh ${user.name}`,
      ipAddress: getClientIp(c),
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data Pendaftar PPDB');

    worksheet.columns = [
      { header: 'No. Registrasi', key: 'regNumber', width: 18 },
      { header: 'Gelombang', key: 'wave', width: 16 },
      { header: 'Nama Lengkap', key: 'fullName', width: 28 },
      { header: 'Jalur', key: 'path', width: 18 },
      { header: 'Satuan', key: 'schoolType', width: 10 },
      { header: 'Pilihan 1', key: 'choice1', width: 22 },
      { header: 'Asrama', key: 'boarding', width: 10 },
      { header: 'Jenis Kelamin', key: 'gender', width: 12 },
      { header: 'NISN', key: 'nisn', width: 14 },
      { header: 'NIK', key: 'nik', width: 18 },
      { header: 'Sekolah Asal', key: 'prevSchool', width: 26 },
      { header: 'No. HP/WA', key: 'phone', width: 16 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Catatan Verifikasi', key: 'notes', width: 30 },
      { header: 'Waktu Daftar', key: 'createdAt', width: 22 },
    ];

    list.forEach((item) => {
      worksheet.addRow({
        regNumber: item.registrationNumber,
        wave: item.wave || 'Gelombang 1',
        fullName: item.fullName,
        path: item.admissionPath,
        schoolType: item.schoolType,
        choice1: item.majorChoice1 || '-',
        boarding: item.isBoarding ? 'Ya' : 'Tidak',
        gender: item.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        nisn: item.nisn || '-',
        nik: item.nik,
        prevSchool: item.prevSchool,
        phone: item.phoneStudent,
        status: item.status.toUpperCase(),
        notes: item.notes || '-',
        createdAt: item.createdAt,
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const todayStr = new Date().toISOString().slice(0, 10);
    const filename = isFiltered ? `data-ppdb-terfilter-${todayStr}.xlsx` : `data-ppdb-semua-${todayStr}.xlsx`;

    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return c.body(buffer as any);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 10. PPDB DYNAMIC FORM BUILDER & CONFIGURATION MANAGEMENT
// ==========================================
app.get('/admin/ppdb/config', async (c) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const schoolType = (settingMap['school_type'] || settingMap['school_level'] || 'SMA').toUpperCase();
    const schoolName = settingMap['school_name'] || 'SMAN 1 Unggulan';
    const boardingAvailable = settingMap['boarding_available'] === 'true';

    let publishedConfig: PpdbFullConfig | null = null;
    let draftConfig: PpdbFullConfig | null = null;

    if (settingMap['ppdb_form_config']) {
      try { publishedConfig = JSON.parse(settingMap['ppdb_form_config']); } catch {}
    }
    if (settingMap['ppdb_form_config_draft']) {
      try { draftConfig = JSON.parse(settingMap['ppdb_form_config_draft']); } catch {}
    }

    if (!publishedConfig) {
      publishedConfig = getDefaultPpdbConfig(schoolType, schoolName, boardingAvailable);
      const str = JSON.stringify(publishedConfig);
      await db.insert(settings).values({ key: 'ppdb_form_config', value: str }).onConflictDoUpdate({ target: settings.key, set: { value: str } });
    }

    // Ambil riwayat versi konfigurasi
    const versions = await db
      .select({
        id: ppdbFormVersions.id,
        version: ppdbFormVersions.version,
        schoolType: ppdbFormVersions.schoolType,
        status: ppdbFormVersions.status,
        publishedAt: ppdbFormVersions.publishedAt,
        notes: ppdbFormVersions.notes,
        createdAt: ppdbFormVersions.createdAt,
      })
      .from(ppdbFormVersions)
      .orderBy(desc(ppdbFormVersions.version))
      .limit(10);

    return c.json({
      success: true,
      published: publishedConfig,
      draft: draftConfig || publishedConfig,
      hasDraftDiff: Boolean(draftConfig && JSON.stringify(draftConfig) !== JSON.stringify(publishedConfig)),
      versions,
      institution: {
        schoolName,
        schoolType,
        schoolStatus: settingMap['school_status'] || 'Negeri',
        educationLevel: settingMap['education_level'] || 'menengah_atas',
        boardingAvailable,
      },
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Endpoint hitung statistik pemakaian gelombang oleh pendaftar (Proteksi integritas data)
app.get('/admin/ppdb/waves/usage', async (c) => {
  try {
    const list = await db
      .select({
        wave: registrations.wave,
        count: sql<number>`count(*)`,
      })
      .from(registrations)
      .groupBy(registrations.wave);

    const usageMap: Record<string, number> = {};
    for (const item of list) {
      if (item.wave) {
        usageMap[item.wave] = Number(item.count) || 0;
      }
    }

    return c.json({ success: true, data: usageMap });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/ppdb/config/save', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Data konfigurasi tidak valid.' }, 400);
    }

    const actualConfig = (body.config && typeof body.config === 'object' && body.config.steps) ? body.config : body;
    actualConfig.updatedAt = new Date().toISOString();
    const configStr = JSON.stringify(actualConfig);

    // Simpan langsung ke settings
    const existing = await db.select().from(settings).where(eq(settings.key, 'ppdb_form_config')).limit(1).then((r) => r[0]);
    if (existing) {
      await db.update(settings).set({ value: configStr, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'ppdb_form_config'));
    } else {
      await db.insert(settings).values({ key: 'ppdb_form_config', value: configStr });
    }

    // Sinkronkan nilai kunci top-level
    const syncKeys: Record<string, string> = {
      ppdb_year: actualConfig.academicYear || '2026/2027',
      ppdb_portal_mode: actualConfig.portalMode || 'auto',
      ppdb_active_wave: actualConfig.activeWave || 'Gelombang 1',
      ppdb_status: actualConfig.status || 'opened',
      ppdb_quota_total: actualConfig.totalQuota || '360 Siswa Baru',
      ppdb_start_date: actualConfig.startDate || '',
      ppdb_end_date: actualConfig.endDate || '',
      ppdb_boarding_enabled: actualConfig.services?.boardingEnabledInPpdb ? 'true' : 'false',
    };

    if (actualConfig.admissionsLabel) syncKeys.admissions_label = actualConfig.admissionsLabel;
    if (actualConfig.admissionsTitle) syncKeys.admissions_title = actualConfig.admissionsTitle;
    if (actualConfig.admissionsSubtitle) syncKeys.admissions_subtitle = actualConfig.admissionsSubtitle;

    const nowIsoSync = new Date().toISOString();
    const syncEntries = Object.entries(syncKeys).map(([k, v]) => ({
      key: k,
      value: v,
      updatedAt: nowIsoSync,
    }));

    if (syncEntries.length > 0) {
      await db
        .insert(settings)
        .values(syncEntries)
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: sql`excluded.value`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    // Sinkronkan ke menu navbar jika ada update label pendaftaran
    if (actualConfig.admissionsLabel) {
      await db.update(navigationItems)
        .set({ label: actualConfig.admissionsLabel.trim() })
        .where(or(eq(navigationItems.id, 'nav_ppdb'), eq(navigationItems.href, '/pendaftaran')));
    }

    // Catat audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'UPDATE',
      entity: 'ppdb_config',
      entityId: 'ppdb_form_config',
      details: `Menyimpan pengaturan formulir PPDB (Tahun Ajaran: ${actualConfig.academicYear || '-'}, Status: ${actualConfig.status || 'opened'})`,
      ipAddress: getClientIp(c),
    });

    invalidateSettingsCache();

    return c.json({ success: true, message: 'Pengaturan formulir PPDB berhasil disimpan.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/ppdb/config/draft', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Payload konfigurasi draf tidak valid.' }, 400);
    }

    body.updatedAt = new Date().toISOString();
    const str = JSON.stringify(body);

    const existing = await db.select().from(settings).where(eq(settings.key, 'ppdb_form_config_draft')).limit(1).then((r) => r[0]);
    if (existing) {
      await db.update(settings).set({ value: str, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'ppdb_form_config_draft'));
    } else {
      await db.insert(settings).values({ key: 'ppdb_form_config_draft', value: str });
    }

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'PPDB_CONFIG_DRAFT_SAVED',
      entity: 'ppdb_config',
      entityId: `v${body.version || 1}-draft`,
      details: `Menyimpan draf konfigurasi formulir PPDB (Tahapan: ${body.steps?.length || 7}, Jalur: ${body.paths?.length || 0})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: 'Draf konfigurasi PPDB berhasil disimpan.', data: body });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/ppdb/config/publish', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    if (!body || typeof body !== 'object') {
      return c.json({ success: false, error: 'Data konfigurasi publikasi tidak valid.' }, 400);
    }

    const actualConfig = (body.config && typeof body.config === 'object' && body.config.steps) ? body.config : body;
    const notes = body.notes || actualConfig.notes;

    // Naikkan nomor versi
    const newVersion = (Number(actualConfig.version) || 1) + 1;
    actualConfig.version = newVersion;
    actualConfig.updatedAt = new Date().toISOString();
    const configStr = JSON.stringify(actualConfig);

    // 1. Simpan ke settings live
    const existingLive = await db.select().from(settings).where(eq(settings.key, 'ppdb_form_config')).limit(1).then((r) => r[0]);
    if (existingLive) {
      await db.update(settings).set({ value: configStr, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'ppdb_form_config'));
    } else {
      await db.insert(settings).values({ key: 'ppdb_form_config', value: configStr });
    }

    // 2. Bersihkan atau sinkronkan draft
    await db.update(settings).set({ value: configStr, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'ppdb_form_config_draft')).catch(() => null);

    // 3. Sinkronkan nilai kunci top-level untuk kompatibilitas frontend & backend
    const syncKeys: Record<string, string> = {
      ppdb_year: actualConfig.academicYear || '2026/2027',
      ppdb_portal_mode: actualConfig.portalMode || 'auto',
      ppdb_active_wave: actualConfig.activeWave || 'Gelombang 1',
      ppdb_status: actualConfig.status || 'opened',
      ppdb_quota_total: actualConfig.totalQuota || '360 Siswa Baru',
      ppdb_start_date: actualConfig.startDate || '',
      ppdb_end_date: actualConfig.endDate || '',
      ppdb_boarding_enabled: actualConfig.services?.boardingEnabledInPpdb ? 'true' : 'false',
    };

    const nowIsoSync = new Date().toISOString();
    const syncEntries = Object.entries(syncKeys).map(([k, v]) => ({
      key: k,
      value: v,
      updatedAt: nowIsoSync,
    }));

    if (syncEntries.length > 0) {
      await db
        .insert(settings)
        .values(syncEntries)
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: sql`excluded.value`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    // 4. Catat riwayat versi permanen ke tabel ppdbFormVersions
    const versionId = crypto.randomUUID();
    await db.insert(ppdbFormVersions).values({
      id: versionId,
      version: newVersion,
      schoolType: actualConfig.schoolType || 'SMA',
      configJson: configStr,
      status: 'published',
      publishedAt: new Date().toISOString(),
      publishedBy: user.id,
      notes: notes || `Publikasi konfigurasi PPDB versi ${newVersion} oleh ${user.name}`,
    });

    // 5. Catat audit log
    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'PPDB_CONFIG_PUBLISHED',
      entity: 'ppdb_config',
      entityId: `v${newVersion}`,
      details: `Mempublikasikan konfigurasi formulir PPDB Versi ${newVersion} secara resmi untuk calon peserta didik.`,
      ipAddress: getClientIp(c),
    });

    invalidateSettingsCache();

    return c.json({
      success: true,
      message: `Konfigurasi formulir PPDB Versi ${newVersion} berhasil dipublikasikan secara resmi.`,
      version: newVersion,
      data: body,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/ppdb/config/reset-defaults', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const schoolType = (settingMap['school_type'] || settingMap['school_level'] || 'SMA').toUpperCase();
    const schoolName = settingMap['school_name'] || 'SMAN 1 Unggulan';
    const boardingAvailable = settingMap['boarding_available'] === 'true';

    const defaultConfig = getDefaultPpdbConfig(schoolType, schoolName, boardingAvailable);
    const str = JSON.stringify(defaultConfig);

    const existingDraft = await db.select().from(settings).where(eq(settings.key, 'ppdb_form_config_draft')).limit(1).then((r) => r[0]);
    if (existingDraft) {
      await db.update(settings).set({ value: str, updatedAt: new Date().toISOString() }).where(eq(settings.key, 'ppdb_form_config_draft'));
    } else {
      await db.insert(settings).values({ key: 'ppdb_form_config_draft', value: str });
    }

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'PPDB_CONFIG_RESET_DEFAULTS',
      entity: 'ppdb_config',
      entityId: schoolType,
      details: `Mengatur ulang draf formulir PPDB ke template baku satuan ${schoolType}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: `Draf formulir berhasil diatur ulang ke template default ${schoolType}.`, data: defaultConfig });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ========================================================
// MODUL PENGUMUMAN KELULUSAN (SISWA BARU & KELAS 12)
// ========================================================

// 1. Ambil data kelulusan kelas 12 (Admin)
app.get('/admin/graduations', async (c) => {
  try {
    const year = c.req.query('year') || '';
    const className = c.req.query('class') || '';
    const status = c.req.query('status') || '';
    const q = (c.req.query('q') || '').trim().toLowerCase();

    let query = db.select().from(graduations);
    const conditions: any[] = [];

    if (year) conditions.push(eq(graduations.academicYear, year));
    if (className) conditions.push(eq(graduations.className, className));
    if (status) conditions.push(eq(graduations.status, status as any));
    if (q) {
      conditions.push(
        or(
          like(graduations.name, `%${q}%`),
          like(graduations.nisn, `%${q}%`),
          like(graduations.nis, `%${q}%`)
        )
      );
    }

    const allData = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(asc(graduations.className), asc(graduations.name))
      : await query.orderBy(desc(graduations.academicYear), asc(graduations.className), asc(graduations.name));

    // Hitung ringkasan statistik
    const stats = {
      total: allData.length,
      lulus: allData.filter((s) => s.status === 'LULUS').length,
      tidakLulus: allData.filter((s) => s.status === 'TIDAK_LULUS').length,
      ditunda: allData.filter((s) => s.status === 'DITUNDA').length,
    };

    // Ambil daftar kelas unik untuk filter
    const classes = Array.from(new Set(allData.map((s) => s.className).filter(Boolean))).sort();

    return c.json({ success: true, data: allData, stats, classes });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 2. Batch Import Siswa Kelas 12 (Upload Excel atau Copy-Paste)
app.post('/admin/graduations/batch', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { academicYear, mode = 'append', items = [] } = body;

    if (!academicYear || !Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'Data pendaftar atau tahun ajaran tidak valid.' }, 400);
    }

    // Jika mode 'replace', hapus data tahun ajaran ini terlebih dahulu
    if (mode === 'replace') {
      await db.delete(graduations).where(eq(graduations.academicYear, academicYear));
    }

    // Validasi dan normalisasi setiap baris
    const rowsToInsert = items
      .filter((row: any) => row && (row.name || row.nama) && (row.nisn || row.nis || row.className || row.kelas))
      .map((row: any) => {
        const rawStatus = (row.status || 'LULUS').toUpperCase().replace(/\s+/g, '_');
        const validStatus = ['LULUS', 'TIDAK_LULUS', 'DITUNDA'].includes(rawStatus) ? rawStatus : 'LULUS';

        return {
          academicYear,
          nisn: String(row.nisn || row.NISN || '').trim(),
          nis: String(row.nis || row.NIS || '').trim() || null,
          name: String(row.name || row.nama || '').trim(),
          className: String(row.className || row.kelas || row.class_name || 'XII').trim(),
          major: String(row.major || row.jurusan || '').trim() || null,
          gender: String(row.gender || row.jk || row.jenis_kelamin || '').trim().toUpperCase() || null,
          birthPlace: String(row.birthPlace || row.tempat_lahir || '').trim() || null,
          birthDate: String(row.birthDate || row.tanggal_lahir || '').trim() || null,
          status: validStatus as any,
          letterNumber: String(row.letterNumber || row.no_skl || row.nomor_surat || '').trim() || null,
          averageScore: String(row.averageScore || row.nilai || row.rata_rata || '').trim() || null,
          notes: String(row.notes || row.keterangan || '').trim() || null,
        };
      });

    if (rowsToInsert.length === 0) {
      return c.json({ success: false, error: 'Tidak ada baris data valid yang dapat disimpan.' }, 400);
    }

    // Insert batch
    await db.insert(graduations).values(rowsToInsert);

    // Audit log
    await db.insert(auditLogs).values({
      userId: user?.id || 'admin',
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'IMPORT_GRADUATIONS',
      entity: 'graduations',
      entityId: academicYear,
      details: `Mengimpor ${rowsToInsert.length} data kelulusan kelas 12 tahun ajaran ${academicYear} (Mode: ${mode}).`,
      ipAddress: getClientIp(c),
    });

    return c.json({
      success: true,
      message: `Berhasil menyimpan ${rowsToInsert.length} data kelulusan siswa.`,
      count: rowsToInsert.length,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 3. Tambah single siswa kelas 12 (Admin)
app.post('/admin/graduations/single', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();

    if (!body.name || !body.nisn || !body.className || !body.academicYear) {
      return c.json({ success: false, error: 'Nama, NISN, Kelas, dan Tahun Ajaran wajib diisi.' }, 400);
    }

    await db.insert(graduations).values({
      academicYear: body.academicYear.trim(),
      nisn: body.nisn.trim(),
      nis: body.nis?.trim() || null,
      name: body.name.trim(),
      className: body.className.trim(),
      major: body.major?.trim() || null,
      gender: body.gender?.trim() || null,
      birthPlace: body.birthPlace?.trim() || null,
      birthDate: body.birthDate?.trim() || null,
      status: body.status || 'LULUS',
      letterNumber: body.letterNumber?.trim() || null,
      averageScore: body.averageScore?.trim() || null,
      notes: body.notes?.trim() || null,
    });

    return c.json({ success: true, message: 'Data siswa berhasil ditambahkan.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 4. Update siswa kelas 12
app.put('/admin/graduations/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();

    await db
      .update(graduations)
      .set({
        nisn: body.nisn?.trim(),
        nis: body.nis?.trim() || null,
        name: body.name?.trim(),
        className: body.className?.trim(),
        major: body.major?.trim() || null,
        status: body.status,
        letterNumber: body.letterNumber?.trim() || null,
        averageScore: body.averageScore?.trim() || null,
        notes: body.notes?.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(graduations.id, id));

    return c.json({ success: true, message: 'Data siswa berhasil diperbarui.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 5. Hapus single siswa kelas 12
app.delete('/admin/graduations/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    await db.delete(graduations).where(eq(graduations.id, id));
    return c.json({ success: true, message: 'Data siswa berhasil dihapus.' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 6. Hapus semua data tahun ajaran tertentu
app.delete('/admin/graduations/clear', async (c) => {
  try {
    const year = c.req.query('year');
    if (!year) {
      return c.json({ success: false, error: 'Parameter tahun ajaran wajib disertakan.' }, 400);
    }
    await db.delete(graduations).where(eq(graduations.academicYear, year));
    return c.json({ success: true, message: `Semua data kelulusan tahun ajaran ${year} berhasil dihapus.` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 6b. Bulk Hapus Siswa Kelas 12 Terpilih (Multi-Select)
app.post('/admin/graduations/bulk-delete', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));

    if (ids.length === 0) {
      return c.json({ success: false, error: 'Tidak ada data siswa yang dipilih.' }, 400);
    }

    await db.delete(graduations).where(inArray(graduations.id, ids));

    await db.insert(auditLogs).values({
      userId: user?.id || 'admin',
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'BULK_DELETE_GRADUATIONS',
      entity: 'graduations',
      entityId: `${ids.length} siswa`,
      details: `Menghapus ${ids.length} data siswa kelulusan kelas 12 secara massal.`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, message: `Berhasil menghapus ${ids.length} data siswa terpilih.` });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 7. Bulk Action Status Seleksi Calon Siswa Baru (PPDB/PSB/SPMB)
app.post('/admin/admissions/bulk-selection-status', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { registrationIds = [], selectionStatus = 'accepted', notes } = body;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return c.json({ success: false, error: 'Pilih minimal satu pendaftar.' }, 400);
    }

    const validStatus = ['accepted', 'waitlist', 'rejected', 'not_announced'];
    if (!validStatus.includes(selectionStatus)) {
      return c.json({ success: false, error: 'Status seleksi tidak valid.' }, 400);
    }

    for (const regId of registrationIds) {
      await db
        .update(registrations)
        .set({
          selectionStatus,
          status: selectionStatus === 'accepted' ? 'accepted' : selectionStatus === 'rejected' ? 'rejected' : 'verified',
          notes: notes !== undefined ? notes : undefined,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(registrations.id, regId));
    }

    await db.insert(auditLogs).values({
      userId: user?.id || 'admin',
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'UPDATE_ADMISSIONS_STATUS',
      entity: 'registrations',
      entityId: `bulk-${registrationIds.length}`,
      details: `Memperbarui status seleksi ${registrationIds.length} calon siswa menjadi '${selectionStatus}'.`,
      ipAddress: getClientIp(c),
    });

    return c.json({
      success: true,
      message: `Berhasil memperbarui status kelulusan untuk ${registrationIds.length} pendaftar.`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 8. Public API: Kelulusan Siswa Tingkat Akhir (Kelas 12)
app.get('/public/graduations', async (c) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const isPublished = settingMap['graduation_grade12_published'] !== 'false';
    const releaseDate = settingMap['graduation_grade12_date'] || '';
    const now = new Date().toISOString();

    // Cek apakah jadwal pengumuman sudah tiba
    const isLocked = !isPublished || (releaseDate && releaseDate > now);

    const year = c.req.query('year') || settingMap['graduation_grade12_year'] || '2025/2026';
    const className = c.req.query('class') || '';
    const status = c.req.query('status') || '';
    const q = (c.req.query('q') || '').trim().toLowerCase();

    if (isLocked) {
      return c.json({
        success: true,
        isLocked: true,
        releaseDate,
        announcementNotes: settingMap['graduation_grade12_notes'] || 'Pengumuman kelulusan resmi belum dibuka.',
        data: [],
      });
    }

    let query = db.select({
      id: graduations.id,
      academicYear: graduations.academicYear,
      nisn: graduations.nisn,
      nis: graduations.nis,
      name: graduations.name,
      className: graduations.className,
      major: graduations.major,
      status: graduations.status,
      letterNumber: graduations.letterNumber,
      averageScore: graduations.averageScore,
      notes: graduations.notes,
    }).from(graduations);

    const conditions: any[] = [eq(graduations.academicYear, year)];
    if (className) conditions.push(eq(graduations.className, className));
    if (status) conditions.push(eq(graduations.status, status as any));
    if (q) {
      conditions.push(
        or(
          like(graduations.name, `%${q}%`),
          like(graduations.nisn, `%${q}%`),
          like(graduations.nis, `%${q}%`)
        )
      );
    }

    const data = await query.where(and(...conditions)).orderBy(asc(graduations.className), asc(graduations.name));

    return c.json({
      success: true,
      isLocked: false,
      data,
      total: data.length,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// 9. Public API: Pengumuman Kelulusan Seleksi Pendaftaran Siswa Baru (Tabel Hasil Seleksi)
app.get('/public/admissions-results', async (c) => {
  try {
    const allSettings = await db.select().from(settings);
    const settingMap = allSettings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const isPublished = settingMap['admissions_announcement_published'] !== 'false';
    const releaseDate = settingMap['admissions_announcement_date'] || '';
    const now = new Date().toISOString();
    const isLocked = !isPublished || (releaseDate && releaseDate > now);

    if (isLocked) {
      return c.json({
        success: true,
        isLocked: true,
        releaseDate,
        message: settingMap['admissions_announcement_notes'] || 'Pengumuman seleksi pendaftaran siswa baru belum dibuka untuk publik.',
        data: [],
      });
    }

    const year = c.req.query('year') || settingMap['ppdb_year'] || '2026/2027';
    const path = c.req.query('path') || '';
    const status = c.req.query('status') || '';
    const q = (c.req.query('q') || '').trim().toLowerCase();

    // Hanya ambil field non-sensitif (tanpa NIK, nomor HP ortu, dll.)
    let query = db.select({
      id: registrations.id,
      registrationNumber: registrations.registrationNumber,
      fullName: registrations.fullName,
      prevSchool: registrations.prevSchool,
      admissionPath: registrations.admissionPath,
      majorChoice1: registrations.majorChoice1,
      wave: registrations.wave,
      academicYear: registrations.academicYear,
      selectionStatus: registrations.selectionStatus,
      schoolType: registrations.schoolType,
      updatedAt: registrations.updatedAt,
    }).from(registrations);

    // Filter: hanya siswa yang sudah ditetapkan statusnya ('accepted', 'waitlist', 'rejected')
    const conditions: any[] = [
      eq(registrations.academicYear, year),
      or(
        eq(registrations.selectionStatus, 'accepted'),
        eq(registrations.selectionStatus, 'waitlist'),
        eq(registrations.selectionStatus, 'rejected')
      )
    ];

    if (path) conditions.push(eq(registrations.admissionPath, path));
    if (status) conditions.push(eq(registrations.selectionStatus, status as any));
    if (q) {
      conditions.push(
        or(
          like(registrations.fullName, `%${q}%`),
          like(registrations.registrationNumber, `%${q}%`),
          like(registrations.prevSchool, `%${q}%`)
        )
      );
    }

    const data = await query.where(and(...conditions)).orderBy(asc(registrations.admissionPath), asc(registrations.fullName));

    return c.json({
      success: true,
      isLocked: false,
      data,
      total: data.length,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 23. BURSA KERJA KHUSUS (BKK) & MITRA INDUSTRI (SMK)
// ==========================================
app.get('/bkk', async (c) => {
  try {
    const type = c.req.query('type');
    const q = c.req.query('q');

    const conditions: any[] = [eq(bkkOpportunities.isActive, true)];
    if (type && ['lowongan', 'magang', 'mitra_mou'].includes(type)) {
      conditions.push(eq(bkkOpportunities.type, type as any));
    }
    if (q) {
      conditions.push(
        or(
          like(bkkOpportunities.title, `%${q}%`),
          like(bkkOpportunities.companyName, `%${q}%`),
          like(bkkOpportunities.location, `%${q}%`)
        )
      );
    }

    const data = await db
      .select()
      .from(bkkOpportunities)
      .where(and(...conditions))
      .orderBy(asc(bkkOpportunities.orderNumber), desc(bkkOpportunities.id));

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/bkk', requireAuth, async (c) => {
  try {
    const data = await db
      .select()
      .from(bkkOpportunities)
      .orderBy(asc(bkkOpportunities.orderNumber), desc(bkkOpportunities.id));
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/bkk', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { title, companyName, companyLogo, type, location, salaryRange, deadline, quota, requirements, contactPerson, orderNumber, isActive } = body;

    if (!title || !companyName || !location || !requirements) {
      return c.json({ success: false, error: 'Judul, nama mitra industri, lokasi, dan persyaratan wajib diisi.' }, 400);
    }

    const [inserted] = await db.insert(bkkOpportunities).values({
      title: title.trim(),
      companyName: companyName.trim(),
      companyLogo: companyLogo?.trim() || null,
      type: type || 'lowongan',
      location: location.trim(),
      salaryRange: salaryRange?.trim() || null,
      deadline: deadline?.trim() || null,
      quota: quota?.trim() || null,
      requirements: requirements.trim(),
      contactPerson: contactPerson?.trim() || null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
    }).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BKK_CREATE',
      entity: 'bkk_opportunities',
      entityId: String(inserted.id),
      details: `Menambah data BKK: "${title}" (${companyName})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/bkk/:id', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { title, companyName, companyLogo, type, location, salaryRange, deadline, quota, requirements, contactPerson, orderNumber, isActive } = body;

    const [updated] = await db
      .update(bkkOpportunities)
      .set({
        title: title?.trim(),
        companyName: companyName?.trim(),
        companyLogo: companyLogo?.trim() || null,
        type: type || 'lowongan',
        location: location?.trim(),
        salaryRange: salaryRange?.trim() || null,
        deadline: deadline?.trim() || null,
        quota: quota?.trim() || null,
        requirements: requirements?.trim(),
        contactPerson: contactPerson?.trim() || null,
        orderNumber: Number(orderNumber) || 0,
        isActive: isActive !== false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(bkkOpportunities.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BKK_UPDATE',
      entity: 'bkk_opportunities',
      entityId: String(id),
      details: `Memperbarui data BKK: "${title}" (${companyName})`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/bkk/:id/toggle', requireAuth, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const current = await db.select().from(bkkOpportunities).where(eq(bkkOpportunities.id, id)).get();
    if (!current) return c.json({ success: false, error: 'Data tidak ditemukan' }, 404);

    const [updated] = await db
      .update(bkkOpportunities)
      .set({ isActive: !current.isActive, updatedAt: new Date().toISOString() })
      .where(eq(bkkOpportunities.id, id))
      .returning();

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/bkk/:id', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    await db.delete(bkkOpportunities).where(eq(bkkOpportunities.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'BKK_DELETE',
      entity: 'bkk_opportunities',
      entityId: String(id),
      details: `Menghapus data BKK ID: ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ==========================================
// 24. MA'HAD & KEPESANTRENAN / TAHFIDZ (MADRASAH)
// ==========================================
app.get('/mahad', async (c) => {
  try {
    const category = c.req.query('category');
    const conditions: any[] = [eq(mahadPrograms.isActive, true)];
    if (category) {
      conditions.push(eq(mahadPrograms.category, category));
    }

    const data = await db
      .select()
      .from(mahadPrograms)
      .where(and(...conditions))
      .orderBy(asc(mahadPrograms.orderNumber), desc(mahadPrograms.id));

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.get('/admin/mahad', requireAuth, async (c) => {
  try {
    const data = await db
      .select()
      .from(mahadPrograms)
      .orderBy(asc(mahadPrograms.orderNumber), desc(mahadPrograms.id));
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.post('/admin/mahad', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { name, category, target, schedule, mentor, description, imageUrl, orderNumber, isActive } = body;

    if (!name) {
      return c.json({ success: false, error: 'Nama program ma\'had / keagamaan wajib diisi.' }, 400);
    }

    const [inserted] = await db.insert(mahadPrograms).values({
      name: name.trim(),
      category: category?.trim() || 'Tahfidz',
      target: target?.trim() || null,
      schedule: schedule?.trim() || null,
      mentor: mentor?.trim() || null,
      description: description?.trim() || null,
      imageUrl: imageUrl?.trim() || null,
      orderNumber: Number(orderNumber) || 0,
      isActive: isActive !== false,
    }).returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'MAHAD_CREATE',
      entity: 'mahad_programs',
      entityId: String(inserted.id),
      details: `Menambah program ma'had: "${name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/mahad/:id', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { name, category, target, schedule, mentor, description, imageUrl, orderNumber, isActive } = body;

    const [updated] = await db
      .update(mahadPrograms)
      .set({
        name: name?.trim(),
        category: category?.trim() || 'Tahfidz',
        target: target?.trim() || null,
        schedule: schedule?.trim() || null,
        mentor: mentor?.trim() || null,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        orderNumber: Number(orderNumber) || 0,
        isActive: isActive !== false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mahadPrograms.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'MAHAD_UPDATE',
      entity: 'mahad_programs',
      entityId: String(id),
      details: `Memperbarui program ma'had: "${name}"`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/mahad/:id/toggle', requireAuth, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    const current = await db.select().from(mahadPrograms).where(eq(mahadPrograms.id, id)).get();
    if (!current) return c.json({ success: false, error: 'Data tidak ditemukan' }, 404);

    const [updated] = await db
      .update(mahadPrograms)
      .set({ isActive: !current.isActive, updatedAt: new Date().toISOString() })
      .where(eq(mahadPrograms.id, id))
      .returning();

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/mahad/:id', requireAuth, async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    await db.delete(mahadPrograms).where(eq(mahadPrograms.id, id));

    await db.insert(auditLogs).values({
      userId: user.id,
      userEmail: user.email,
      action: 'MAHAD_DELETE',
      entity: 'mahad_programs',
      entityId: String(id),
      details: `Menghapus program ma'had ID: ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ========================================================
// 25. REKAPITULASI KESISWAAN (DAPODIK / EMIS)
// ========================================================
app.get('/admin/enrollment-stats', async (c) => {
  try {
    const list = await db
      .select()
      .from(studentEnrollmentStats)
      .orderBy(desc(studentEnrollmentStats.academicYear));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/enrollment-stats', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const { academicYear, totalStudents, maleCount, femaleCount, rombelCount, source = 'Dapodik', isActive = true } = body;

    if (!academicYear || !totalStudents) {
      return c.json({ success: false, error: 'Tahun ajaran dan total siswa wajib diisi' }, 400);
    }

    const cleanYear = String(academicYear).trim();

    // Check if record for this academic year already exists (upsert pattern)
    const existing = await db
      .select()
      .from(studentEnrollmentStats)
      .where(eq(studentEnrollmentStats.academicYear, cleanYear))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      if (isActive) {
        await db.update(studentEnrollmentStats).set({ isActive: false }).where(ne(studentEnrollmentStats.id, existing.id));
      }
      const [updated] = await db
        .update(studentEnrollmentStats)
        .set({
          totalStudents: Number(totalStudents),
          maleCount: maleCount ? Number(maleCount) : null,
          femaleCount: femaleCount ? Number(femaleCount) : null,
          rombelCount: rombelCount ? Number(rombelCount) : null,
          source: String(source).trim(),
          isActive: Boolean(isActive),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(studentEnrollmentStats.id, existing.id))
        .returning();

      return c.json({ success: true, data: updated });
    }

    if (isActive) {
      await db.update(studentEnrollmentStats).set({ isActive: false });
    }

    const [inserted] = await db
      .insert(studentEnrollmentStats)
      .values({
        academicYear: cleanYear,
        totalStudents: Number(totalStudents),
        maleCount: maleCount ? Number(maleCount) : null,
        femaleCount: femaleCount ? Number(femaleCount) : null,
        rombelCount: rombelCount ? Number(rombelCount) : null,
        source: String(source).trim(),
        isActive: Boolean(isActive),
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'CREATE',
      entity: 'enrollment_stats',
      entityId: String(inserted?.id),
      details: `Menambahkan rekap siswa TA ${cleanYear}: ${totalStudents} siswa`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/enrollment-stats/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const { academicYear, totalStudents, maleCount, femaleCount, rombelCount, source, isActive } = body;

    if (isActive) {
      await db.update(studentEnrollmentStats).set({ isActive: false }).where(ne(studentEnrollmentStats.id, id));
    }

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (academicYear !== undefined) updateData.academicYear = String(academicYear).trim();
    if (totalStudents !== undefined) updateData.totalStudents = Number(totalStudents);
    if (maleCount !== undefined) updateData.maleCount = maleCount ? Number(maleCount) : null;
    if (femaleCount !== undefined) updateData.femaleCount = femaleCount ? Number(femaleCount) : null;
    if (rombelCount !== undefined) updateData.rombelCount = rombelCount ? Number(rombelCount) : null;
    if (source !== undefined) updateData.source = String(source).trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const [updated] = await db
      .update(studentEnrollmentStats)
      .set(updateData)
      .where(eq(studentEnrollmentStats.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'UPDATE',
      entity: 'enrollment_stats',
      entityId: String(id),
      details: `Memperbarui rekap kesiswaan ID ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/enrollment-stats/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    await db.delete(studentEnrollmentStats).where(eq(studentEnrollmentStats.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'DELETE',
      entity: 'enrollment_stats',
      entityId: String(id),
      details: `Menghapus rekap kesiswaan ID ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ========================================================
// 26. REKAPITULASI KELANJUTAN LULUSAN (TRACER COHORT)
// ========================================================
app.get('/admin/tracer-stats', async (c) => {
  try {
    const list = await db
      .select()
      .from(graduationTracerStats)
      .orderBy(desc(graduationTracerStats.graduationYear));
    return c.json({ success: true, data: list });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});



app.post('/admin/tracer-stats', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const body = await c.req.json();
    const {
      graduationYear,
      totalGraduates,
      ptnAcceptedUnique = 0,
      ptsAccepted = 0,
      workingCount = 0,
      entrepreneurCount = 0,
      notes,
      isActive = true,
    } = body;

    if (!graduationYear || !totalGraduates) {
      return c.json({ success: false, error: 'Tahun kelulusan dan total lulusan wajib diisi' }, 400);
    }

    const cleanYear = String(graduationYear).trim();

    // Check if record for this graduation year already exists (upsert pattern)
    const existing = await db
      .select()
      .from(graduationTracerStats)
      .where(eq(graduationTracerStats.graduationYear, cleanYear))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      if (isActive) {
        await db.update(graduationTracerStats).set({ isActive: false }).where(ne(graduationTracerStats.id, existing.id));
      }
      const [updated] = await db
        .update(graduationTracerStats)
        .set({
          totalGraduates: Number(totalGraduates),
          ptnAcceptedUnique: Number(ptnAcceptedUnique || 0),
          ptsAccepted: Number(ptsAccepted || 0),
          workingCount: Number(workingCount || 0),
          entrepreneurCount: Number(entrepreneurCount || 0),
          notes: notes ? String(notes).trim() : existing.notes,
          isActive: Boolean(isActive),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(graduationTracerStats.id, existing.id))
        .returning();

      return c.json({ success: true, data: updated });
    }

    if (isActive) {
      await db.update(graduationTracerStats).set({ isActive: false });
    }

    const [inserted] = await db
      .insert(graduationTracerStats)
      .values({
        graduationYear: cleanYear,
        totalGraduates: Number(totalGraduates),
        ptnAcceptedUnique: Number(ptnAcceptedUnique || 0),
        ptsAccepted: Number(ptsAccepted || 0),
        workingCount: Number(workingCount || 0),
        entrepreneurCount: Number(entrepreneurCount || 0),
        notes: notes ? String(notes).trim() : null,
        isActive: Boolean(isActive),
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'CREATE',
      entity: 'tracer_stats',
      entityId: String(inserted?.id),
      details: `Menambahkan rekap tracer lulusan ${cleanYear}: ${totalGraduates} lulusan, ${ptnAcceptedUnique} PTN`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: inserted });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.put('/admin/tracer-stats/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    const body = await c.req.json();
    const {
      graduationYear,
      totalGraduates,
      ptnAcceptedUnique,
      ptsAccepted,
      workingCount,
      entrepreneurCount,
      notes,
      isActive,
    } = body;

    if (isActive) {
      await db.update(graduationTracerStats).set({ isActive: false }).where(ne(graduationTracerStats.id, id));
    }

    const updateData: any = { updatedAt: new Date().toISOString() };
    if (graduationYear !== undefined) updateData.graduationYear = String(graduationYear).trim();
    if (totalGraduates !== undefined) updateData.totalGraduates = Number(totalGraduates);
    if (ptnAcceptedUnique !== undefined) updateData.ptnAcceptedUnique = Number(ptnAcceptedUnique);
    if (ptsAccepted !== undefined) updateData.ptsAccepted = Number(ptsAccepted);
    if (workingCount !== undefined) updateData.workingCount = Number(workingCount);
    if (entrepreneurCount !== undefined) updateData.entrepreneurCount = Number(entrepreneurCount);
    if (notes !== undefined) updateData.notes = notes ? String(notes).trim() : null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const [updated] = await db
      .update(graduationTracerStats)
      .set(updateData)
      .where(eq(graduationTracerStats.id, id))
      .returning();

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'UPDATE',
      entity: 'tracer_stats',
      entityId: String(id),
      details: `Memperbarui rekap tracer ID ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true, data: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

app.delete('/admin/tracer-stats/:id', async (c) => {
  try {
    const user: any = c.get('user' as any);
    const id = parseInt(c.req.param('id'), 10);
    await db.delete(graduationTracerStats).where(eq(graduationTracerStats.id, id));

    await db.insert(auditLogs).values({
      userId: user?.id || null,
      userEmail: user?.email || 'admin@sekolah.sch.id',
      action: 'DELETE',
      entity: 'tracer_stats',
      entityId: String(id),
      details: `Menghapus rekap tracer ID ${id}`,
      ipAddress: getClientIp(c),
    });

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

export { app };
export type AppType = typeof app;


