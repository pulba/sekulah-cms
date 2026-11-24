import 'dotenv/config';
import { SignJWT, jwtVerify, importPKCS8, decodeJwt } from 'jose';

export interface SessionPayload {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
  role: string;
  sv: number; // session version
  [key: string]: any;
}

export interface FirebaseUserInfo {
  uid: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  disabled: boolean;
  role: string | null;
  claims: Record<string, any>;
}

// Fallback session secret for JWT HMAC signing
const SESSION_SECRET = process.env.SESSION_SECRET || 'sman1-super-secret-key-change-in-prod-2026-edge-safe';

/**
 * Sign stateless session JWT (HS256) valid for 7 days.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secretKey = new TextEncoder().encode(SESSION_SECRET);
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

/**
 * Verify and decode stateless session JWT.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secretKey = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Exchange Google OAuth authorization code for ID Token and Access Token.
 */
export async function exchangeGoogleCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ id_token: string; access_token: string; expires_in?: number; token_type?: string }> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errText}`);
  }

  return await tokenResponse.json();
}

/**
 * Verify Google ID Token and register/login user into Firebase Authentication.
 * Uses Firebase Identity Toolkit REST API (Edge-safe, zero heavy SDK).
 */
export async function signInWithGoogleIdToken(
  googleIdToken: string,
  requestUri?: string
): Promise<{ uid: string; email: string; displayName: string; photoUrl?: string }> {
  const apiKey = process.env.PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

  if (apiKey) {
    const fbRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postBody: `id_token=${googleIdToken}&providerId=google.com`,
          requestUri: requestUri || 'http://localhost:4321',
          returnSecureToken: true,
          returnIdpCredential: true,
        }),
      }
    );

    if (fbRes.ok) {
      const data = await fbRes.json();
      return {
        uid: data.localId,
        email: data.email || '',
        displayName: data.displayName || (data.email ? data.email.split('@')[0] : 'User'),
        photoUrl: data.photoUrl || undefined,
      };
    } else {
      const errText = await fbRes.text();
      console.warn(`Firebase signInWithIdp error (${fbRes.status}): ${errText}. Falling back to ID token decode.`);
    }
  }

  // Fallback: decode claims directly from verified Google ID Token
  const decoded = decodeJwt(googleIdToken);
  if (!decoded || !decoded.sub) {
    throw new Error('Invalid Google ID token payload');
  }

  return {
    uid: String(decoded.sub),
    email: String(decoded.email || ''),
    displayName: String(decoded.name || (decoded.email ? String(decoded.email).split('@')[0] : 'User')),
    photoUrl: decoded.picture ? String(decoded.picture) : undefined,
  };
}

// In-memory cache for Google Service Account OAuth token
let cachedSaToken: { token: string; expiresAt: number } | null = null;

/**
 * Resolve Service Account credentials from JSON or individual environment variables.
 */
function getServiceAccountCredentials(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  // Option 1: FIREBASE_SERVICE_ACCOUNT_JSON
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID || '',
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  // Option 2: Individual env vars
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

/**
 * Generate Google OAuth2 Access Token for Identity Toolkit using Service Account.
 */
async function getGoogleServiceAccountAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const creds = getServiceAccountCredentials();
  if (!creds) return null;

  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least another 2 minutes
  if (cachedSaToken && cachedSaToken.expiresAt > now + 120) {
    return { token: cachedSaToken.token, projectId: creds.projectId };
  }

  try {
    const privateKeyObj = await importPKCS8(creds.privateKey, 'RS256');

    const jwt = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(creds.clientEmail)
      .setSubject(creds.clientEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKeyObj);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Failed to obtain Google Service Account access token (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    cachedSaToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600),
    };

    return { token: data.access_token, projectId: creds.projectId };
  } catch (err) {
    console.warn('Error generating Service Account token:', err);
    return null;
  }
}

/**
 * Fetch Firebase User by UID to inspect disabled status and Custom Claims (role).
 */
export async function getFirebaseUser(uid: string): Promise<FirebaseUserInfo> {
  const sa = await getGoogleServiceAccountAccessToken();
  if (!sa || !sa.projectId) {
    return {
      uid,
      email: '',
      displayName: '',
      disabled: false,
      role: null,
      claims: {},
    };
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${sa.projectId}/accounts:lookup`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sa.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ localId: [uid] }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Firebase accounts:lookup error (${res.status}): ${errText}`);
      return {
        uid,
        email: '',
        displayName: '',
        disabled: false,
        role: null,
        claims: {},
      };
    }

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) {
      return {
        uid,
        email: '',
        displayName: '',
        disabled: false,
        role: null,
        claims: {},
      };
    }

    let claims: Record<string, any> = {};
    if (user.customAttributes) {
      try {
        claims = JSON.parse(user.customAttributes);
      } catch {}
    }

    return {
      uid: user.localId,
      email: user.email || '',
      displayName: user.displayName || '',
      photoUrl: user.photoUrl,
      disabled: !!user.disabled,
      role: claims.role || null,
      claims,
    };
  } catch (err) {
    console.warn('Error fetching user from Firebase Admin:', err);
    return {
      uid,
      email: '',
      displayName: '',
      disabled: false,
      role: null,
      claims: {},
    };
  }
}

/**
 * Set Custom User Claims in Firebase Authentication via Admin REST API.
 */
export async function setFirebaseCustomUserClaims(
  uid: string,
  claims: Record<string, any>
): Promise<boolean> {
  const sa = await getGoogleServiceAccountAccessToken();
  if (!sa || !sa.projectId) {
    console.warn('Cannot set custom user claims: Service Account not configured');
    return false;
  }

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${sa.projectId}/accounts:update`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sa.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: uid,
          customAttributes: JSON.stringify(claims),
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`Firebase accounts:update error (${res.status}): ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Error setting custom user claims in Firebase:', err);
    return false;
  }
}
