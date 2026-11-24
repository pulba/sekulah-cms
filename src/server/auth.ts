import 'dotenv/config';
import { eq, and, gt, sql } from 'drizzle-orm';
import { db, users, sessions, loginAttempts } from '../db';

// Fallback session secret for HMAC signing (Overridden by SESSION_SECRET env in production)
const SESSION_SECRET = process.env.SESSION_SECRET || 'sman1-super-secret-key-change-in-prod-2026-edge-safe';

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hash a plain password using Web Crypto PBKDF2 (SHA-512, 100,000 iterations).
 * Universal compatibility: Bun, Node.js 18+, and Cloudflare Workers (workerd).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-512',
    },
    passwordKey,
    256 // 32 bytes
  );

  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

/**
 * Verify a plain password against the stored hash.
 * Handles both PBKDF2 hashes and bootstrap default password ('admin123').
 */
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  // Bootstrap fallback: if no passwordHash set yet, accept default admin123
  if (!storedHash || storedHash === 'admin123') {
    return password === 'admin123';
  }

  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }

  const iterations = parseInt(parts[1], 10);
  const saltHex = parts[2];
  const expectedHashHex = parts[3];

  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-512',
    },
    passwordKey,
    256
  );

  const computedHashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return constantTimeEqual(computedHashHex, expectedHashHex);
}

/**
 * Sign session ID using HMAC-SHA256 to prevent tampering.
 */
async function signToken(sessionId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(sessionId));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${sessionId}.${sigHex}`;
}

/**
 * Verify HMAC signature of a signed token and extract the sessionId.
 */
async function verifyTokenSignature(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;

  const [sessionId, providedSig] = token.split('.');
  if (!sessionId || !providedSig) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(sessionId));
  const expectedSigHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (constantTimeEqual(providedSig, expectedSigHex)) {
    return sessionId;
  }

  return null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'editor';
}

/**
 * Create a new cryptographic session and persist it to the SQLite sessions table.
 * Returns the signed token string to be stored in HttpOnly cookie.
 */
export async function createSession(data: {
  userId: string;
  userEmail: string;
  userName: string;
  role: 'super_admin' | 'editor';
  ipAddress?: string;
  userAgent?: string;
}): Promise<string> {
  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const sessionId = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + 60 * 60 * 24 * 7; // 7 days

  await db.insert(sessions).values({
    id: sessionId,
    userId: data.userId,
    userEmail: data.userEmail,
    userName: data.userName,
    role: data.role,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    expiresAt,
  });

  return signToken(sessionId);
}

/**
 * Validate a session token against HMAC signature, expiration, and database record.
 * Also verifies that the user account is still active.
 */
export async function validateSession(signedToken: string): Promise<{ user: SessionUser; sessionId: string } | null> {
  const sessionId = await verifyTokenSignature(signedToken);
  if (!sessionId) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);

  const foundSession = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, nowSeconds)))
    .limit(1)
    .then((r) => r[0]);

  if (!foundSession) return null;

  // Verify that the user still exists and isActive is true
  const foundUser = await db
    .select()
    .from(users)
    .where(and(eq(users.id, foundSession.userId), eq(users.isActive, true)))
    .limit(1)
    .then((r) => r[0]);

  if (!foundUser) {
    // User deleted or deactivated: revoke session
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return {
    user: {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      role: foundUser.role as 'super_admin' | 'editor',
    },
    sessionId,
  };
}

/**
 * Revoke session permanently from database.
 */
export async function revokeSession(signedTokenOrId: string): Promise<void> {
  let sessionId: string | null = null;
  if (signedTokenOrId.includes('.')) {
    sessionId = await verifyTokenSignature(signedTokenOrId);
  } else {
    sessionId = signedTokenOrId;
  }

  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }
}

/**
 * Rotate an existing session: generate a new session ID, delete the old one.
 */
export async function rotateSession(
  oldSignedToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  const validation = await validateSession(oldSignedToken);
  if (!validation) return null;

  // Revoke old session
  await revokeSession(validation.sessionId);

  // Issue new session
  return createSession({
    userId: validation.user.id,
    userEmail: validation.user.email,
    userName: validation.user.name,
    role: validation.user.role,
    ipAddress,
    userAgent,
  });
}

/**
 * Rate Limiting for Login: max 5 failed attempts per IP in a 15-minute window.
 */
export async function checkLoginRateLimit(ipAddress: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetMinutes: number;
}> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - 15 * 60; // 15 minutes ago

  const recentFailures = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.ipAddress, ipAddress),
        eq(loginAttempts.isSuccess, false),
        gt(loginAttempts.attemptedAt, windowStart)
      )
    )
    .then((r) => Number(r[0]?.count || 0));

  const maxAttempts = 5;
  const remaining = Math.max(0, maxAttempts - recentFailures);

  return {
    allowed: recentFailures < maxAttempts,
    remaining,
    resetMinutes: 15,
  };
}

/**
 * Record a login attempt and clear failed attempts upon success.
 */
export async function recordLoginAttempt(
  ipAddress: string,
  email: string,
  isSuccess: boolean
): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  await db.insert(loginAttempts).values({
    ipAddress,
    email: email.trim().toLowerCase(),
    attemptedAt: nowSeconds,
    isSuccess,
  });

  // If successful login from this IP, clear past failed attempts for this IP
  if (isSuccess) {
    await db
      .delete(loginAttempts)
      .where(and(eq(loginAttempts.ipAddress, ipAddress), eq(loginAttempts.isSuccess, false)));
  }
}

/**
 * Extract true client IP from Cloudflare or reverse proxy headers.
 */
export function getClientIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * Sign a temporary 1-hour draft preview token for staff.
 */
export async function signPreviewToken(articleId: number, slug: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const payload = `${articleId}:${slug}:${expiresAt}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}.${sigHex}`;
}

/**
 * Verify draft preview token.
 */
export async function verifyPreviewToken(token: string): Promise<{ articleId: number; slug: string } | null> {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const parts = payload.split(':');
  if (parts.length !== 3) return null;

  const articleId = parseInt(parts[0], 10);
  const slug = parts[1];
  const expiresAt = parseInt(parts[2], 10);

  if (Date.now() / 1000 > expiresAt) return null; // expired

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSigHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (constantTimeEqual(sig, expectedSigHex)) {
    return { articleId, slug };
  }
  return null;
}

