import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Helper: auto-extract if user pasted multiple .env variables into a single environment variable (e.g. SEKULAH_CMS)
function bootstrapEnv() {
  const combined = process.env.SEKULAH_CMS || process.env.ENV_FILE || '';
  if (combined && combined.includes('=')) {
    const lines = combined.split(/[\r\n]+/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}
bootstrapEnv();

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const rawUrl = process.env.TURSO_DATABASE_URL || metaEnv.TURSO_DATABASE_URL || 'file:local.db';
// Normalize libsql:// to https:// for maximum reliability across build and serverless environments
const url = rawUrl.startsWith('libsql://') ? rawUrl.replace(/^libsql:\/\//, 'https://') : rawUrl;
const authToken = process.env.TURSO_AUTH_TOKEN || metaEnv.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from './schema';
