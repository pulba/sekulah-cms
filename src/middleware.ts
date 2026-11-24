import { defineMiddleware } from 'astro:middleware';
import { validateSession } from './server/auth';
import { verifySessionToken } from './lib/auth-server';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Hanya periksa rute portal admin
  if (pathname.startsWith('/admin')) {
    const cmsSessionCookie = context.cookies.get('cms_session')?.value;
    const sessionCookie = context.cookies.get('auth_session')?.value;
    let user: any = null;

    // 1. Verifikasi Sesi Stateless JWT (Google / Firebase Auth)
    if (cmsSessionCookie) {
      try {
        const payload = await verifySessionToken(cmsSessionCookie);
        if (payload) {
          user = {
            id: payload.uid,
            email: payload.email,
            name: payload.name,
            role: payload.role === 'admin' ? 'super_admin' : payload.role,
            photoUrl: payload.photoUrl,
          };
        } else {
          // Token kedaluwarsa atau signature tidak valid
          context.cookies.delete('cms_session', { path: '/' });
        }
      } catch {
        user = null;
      }
    }

    // 2. Fallback: Verifikasi Sesi Database Lokal (Password Login)
    if (!user && sessionCookie) {
      try {
        const session = await validateSession(sessionCookie);
        if (session) {
          user = session.user;
        } else {
          // Sesi sudah dicabut di server atau kedaluwarsa -> bersihkan cookie
          context.cookies.delete('auth_session', { path: '/' });
        }
      } catch {
        user = null;
      }
    }

    // Jika belum login dan mengakses halaman admin selain /admin/login
    if (!user && pathname !== '/admin/login') {
      return context.redirect('/admin/login');
    }

    // Jika sudah login dan mengakses /admin/login, alihkan ke dashboard
    if (user && pathname === '/admin/login') {
      return context.redirect('/admin');
    }

    // Proteksi Hak Akses Role (RBAC) pada Halaman Sensitif Super Admin
    if (user && user.role !== 'super_admin' && user.role !== 'admin') {
      const superAdminOnlyRoutes = [
        '/admin/pengaturan',
        '/admin/profil',
        '/admin/logs',
        '/admin/users',
        '/admin/pemeliharaan',
      ];
      const isRestricted = superAdminOnlyRoutes.some((route) => pathname.startsWith(route));
      if (isRestricted) {
        return context.redirect('/admin?error=unauthorized_role');
      }
    }

    // Simpan data user ke locals Astro
    context.locals.user = user;
  }

  const response = await next();

  // Edge Caching Cloudflare untuk Halaman Publik SSR:
  // Cache 60 detik di Cloudflare CDN Edge, Stale-While-Revalidate 5 menit di background.
  // Bypass otomatis untuk admin, api, cetak bukti, draft preview, dan staf yang sedang login.
  if (
    context.request.method === 'GET' &&
    response.status === 200 &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/uploads') &&
    !pathname.startsWith('/_') &&
    !pathname.includes('cetak') &&
    !context.cookies.has('cms_session') &&
    !context.cookies.has('auth_session') &&
    !context.url.searchParams.has('preview_token')
  ) {
    if (!response.headers.has('Cache-Control')) {
      response.headers.set(
        'Cache-Control',
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
      );
    }
  }

  return response;
});
