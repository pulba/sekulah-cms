import type { APIRoute } from 'astro';
import {
  exchangeGoogleCodeForTokens,
  signInWithGoogleIdToken,
  getFirebaseUser,
  setFirebaseCustomUserClaims,
  signSessionToken,
} from '../../../../lib/auth-server';
import { db, users, auditLogs } from '../../../../db';

export const prerender = false;

export const ALL: APIRoute = async ({ request, cookies, redirect, url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  // Tangani pembatalan atau error dari Google OAuth
  if (errorParam) {
    cookies.delete('oauth_state', { path: '/' });
    return redirect(`/admin/login?error=google_${errorParam}`, 302);
  }

  // A. Validasi CSRF
  const savedState = cookies.get('oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    cookies.delete('oauth_state', { path: '/' });
    return redirect('/admin/login?error=csrf_failed', 302);
  }

  // Hapus cookie state setelah lolos validasi
  cookies.delete('oauth_state', { path: '/' });

  if (!code) {
    return redirect('/admin/login?error=missing_code', 302);
  }

  const clientId = import.meta.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return redirect('/admin/login?error=missing_google_config', 302);
  }

  const redirectUri = `${url.origin}/api/auth/callback/google`;

  // B. Pertukaran Kode (Token Exchange)
  let tokenData: { id_token?: string; access_token?: string };
  try {
    tokenData = await exchangeGoogleCodeForTokens(code, clientId, clientSecret, redirectUri);
  } catch (err) {
    console.error('Google token exchange error:', err);
    return redirect('/admin/login?error=token_exchange_failed', 302);
  }

  const idToken = tokenData.id_token;
  if (!idToken) {
    return redirect('/admin/login?error=token_exchange_failed', 302);
  }

  // C. Autentikasi dengan Firebase
  let firebaseAuth: { uid: string; email: string; displayName: string; photoUrl?: string };
  try {
    firebaseAuth = await signInWithGoogleIdToken(idToken, redirectUri);
  } catch (err) {
    console.error('Firebase Auth sign in error:', err);
    return redirect('/admin/login?error=firebase_auth_failed', 302);
  }

  const { uid, displayName, photoUrl } = firebaseAuth;
  const normalizedEmail = (firebaseAuth.email || '').toLowerCase().trim();

  if (!normalizedEmail) {
    return redirect('/admin/login?error=missing_email', 302);
  }

  // D. Pengecekan Akun dan Custom Claims (RBAC)
  let role: string | null = null;
  const ownerEmail = (import.meta.env.OWNER_ADMIN_EMAIL || process.env.OWNER_ADMIN_EMAIL || '').toLowerCase().trim();

  try {
    const fbUser = await getFirebaseUser(uid);
    if (fbUser.disabled) {
      return redirect('/admin/login?error=account_disabled', 302);
    }
    role = fbUser.role;
  } catch (err) {
    console.warn('Could not inspect Firebase Admin user claims:', err);
  }

  // Mekanisme Bootstrap Admin
  if (!role) {
    if (ownerEmail && normalizedEmail === ownerEmail) {
      role = 'admin';
      try {
        await setFirebaseCustomUserClaims(uid, { role: 'admin' });
      } catch (err) {
        console.warn('Failed to bootstrap custom claims on Firebase:', err);
      }
    } else {
      // Sistem tertutup: hanya pengguna yang sudah didaftarkan admin yang boleh masuk
      return redirect('/admin/login?error=unregistered_account', 302);
    }
  }

  // E. Pembuatan Sesi (JWT Stateless)
  const isHttps = url.protocol === 'https:' || process.env.NODE_ENV === 'production';
  const sessionToken = await signSessionToken({
    uid,
    email: normalizedEmail,
    name: displayName || normalizedEmail.split('@')[0],
    photoUrl,
    role,
    sv: 1,
  });

  // Simpan ke cookie cms_session (httpOnly, secure, sameSite: lax, 7 hari)
  cookies.set('cms_session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 hari
  });

  // Sinkronisasi ke basis data lokal (Drizzle / SQLite) & Audit Log
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
  try {
    await db.insert(users).values({
      id: uid,
      email: normalizedEmail,
      name: displayName || normalizedEmail.split('@')[0],
      avatarUrl: photoUrl || null,
      role: role === 'admin' ? 'super_admin' : 'editor',
      isActive: true,
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        email: normalizedEmail,
        name: displayName || normalizedEmail.split('@')[0],
        avatarUrl: photoUrl || null,
        role: role === 'admin' ? 'super_admin' : 'editor',
        isActive: true,
      },
    });

    await db.insert(auditLogs).values({
      userId: uid,
      userEmail: normalizedEmail,
      action: 'LOGIN',
      entity: 'user',
      entityId: uid,
      details: 'Pengguna berhasil masuk ke dashboard CMS dengan Google Login (Firebase Auth & JWT)',
      ipAddress: clientIp,
    });
  } catch (dbErr) {
    console.error('Gagal sinkronisasi data pengguna Google ke SQLite:', dbErr);
  }

  // 4. Pengalihan Akhir ke Root Dashboard
  return redirect('/admin', 302);
};
