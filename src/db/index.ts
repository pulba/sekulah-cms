import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const rawUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
// Normalize libsql:// to https:// for maximum reliability across build and serverless environments
const url = rawUrl.startsWith('libsql://') ? rawUrl.replace(/^libsql:\/\//, 'https://') : rawUrl;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from './schema';
