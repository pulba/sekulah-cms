import type { APIRoute } from 'astro';
import 'dotenv/config';

export const prerender = false;

export const ALL: APIRoute = async ({ cookies, redirect, url }) => {
  // 1. Check Environment Variables
  const clientId = import.meta.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return redirect('/admin/login?error=missing_google_config', 302);
  }

  // 2. Generate unique CSRF state token
  const state = crypto.randomUUID();

  // 3. Store state in strict httpOnly cookie
  const isHttps = url.protocol === 'https:' || process.env.NODE_ENV === 'production';
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  // 4. Build Google OAuth2 Consent URL
  const redirectUri = `${url.origin}/api/auth/callback/google`;
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  // Redirect to Google Consent Screen
  return redirect(googleAuthUrl.toString(), 302);
};
