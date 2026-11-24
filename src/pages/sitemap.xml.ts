import type { APIRoute } from 'astro';
import { db, articles, agendas, studentsAlumni } from '../db';
import { eq, isNull, and, sql } from 'drizzle-orm';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const baseUrl = url.origin || 'https://sman1unggulan.sch.id';
  const nowIso = new Date().toISOString();

  // Halaman publik statis resmi sekolah
  const staticPages: { path: string; changefreq: string; priority: string }[] = [
    { path: '', changefreq: 'daily', priority: '1.0' },
    { path: '/profil', changefreq: 'weekly', priority: '0.9' },
    { path: '/berita', changefreq: 'daily', priority: '0.9' },
    { path: '/agenda', changefreq: 'daily', priority: '0.9' },
    { path: '/pendaftaran', changefreq: 'daily', priority: '0.9' },
    { path: '/direktori', changefreq: 'weekly', priority: '0.8' },
    { path: '/prestasi', changefreq: 'weekly', priority: '0.8' },
    { path: '/ekstrakurikuler', changefreq: 'weekly', priority: '0.8' },
    { path: '/fasilitas', changefreq: 'monthly', priority: '0.8' },
    { path: '/galeri', changefreq: 'weekly', priority: '0.7' },
    { path: '/dokumen', changefreq: 'weekly', priority: '0.7' },
    { path: '/alumni', changefreq: 'monthly', priority: '0.7' },
    { path: '/kelulusan', changefreq: 'monthly', priority: '0.7' },
    { path: '/bkk', changefreq: 'weekly', priority: '0.7' },
    { path: '/mahad', changefreq: 'monthly', priority: '0.7' },
    { path: '/osis', changefreq: 'monthly', priority: '0.7' },
    { path: '/osim', changefreq: 'monthly', priority: '0.7' },
    { path: '/kontak', changefreq: 'monthly', priority: '0.7' },
    { path: '/cari', changefreq: 'weekly', priority: '0.5' },
    { path: '/syarat-ketentuan', changefreq: 'monthly', priority: '0.5' },
    { path: '/kebijakan-privasi', changefreq: 'monthly', priority: '0.5' },
  ];

  // 1. Artikel Berita Terbit (Tanpa Draf & Sampah)
  const publishedArticles = await db
    .select({
      slug: articles.slug,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, 'published'),
        isNull(articles.deletedAt),
        sql`${articles.publishedAt} <= ${nowIso}`
      )
    )
    .catch(() => []);

  // 2. Agenda Kegiatan
  const activeAgendas = await db
    .select({
      id: agendas.id,
      updatedAt: agendas.updatedAt,
      createdAt: agendas.createdAt,
    })
    .from(agendas)
    .catch(() => []);

  // 3. Prestasi Publik dengan Consent
  const publicAchievements = await db
    .select({
      id: studentsAlumni.id,
      createdAt: studentsAlumni.createdAt,
    })
    .from(studentsAlumni)
    .where(
      and(
        eq(studentsAlumni.type, 'achievement'),
        eq(studentsAlumni.isPublicConsent, true)
      )
    )
    .catch(() => []);

  const staticUrlsXml = staticPages
    .map(
      (item) => `
  <url>
    <loc>${baseUrl}${item.path}</loc>
    <changefreq>${item.changefreq}</changefreq>
    <priority>${item.priority}</priority>
  </url>`
    )
    .join('');

  const articleUrlsXml = publishedArticles
    .map(
      (art) => `
  <url>
    <loc>${baseUrl}/berita/${art.slug}</loc>
    <lastmod>${(art.updatedAt || art.publishedAt || nowIso).slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('');

  const agendaUrlsXml = activeAgendas
    .map(
      (ag) => `
  <url>
    <loc>${baseUrl}/agenda/${ag.id}</loc>
    <lastmod>${(ag.updatedAt || ag.createdAt || nowIso).slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('');

  const achievementUrlsXml = publicAchievements
    .map(
      (ach) => `
  <url>
    <loc>${baseUrl}/prestasi/${ach.id}</loc>
    <lastmod>${(ach.createdAt || nowIso).slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrlsXml}
${articleUrlsXml}
${agendaUrlsXml}
${achievementUrlsXml}
</urlset>`.trim();

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
