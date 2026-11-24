/**
 * Check + create missing tables di Turso REMOTE (force remote URL)
 * Run: bun run scripts/setup-turso-tables.ts
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// Parse .dev.vars manually (tidak pakai dotenv agar tidak di-override)
const devVarsContent = readFileSync('.dev.vars', 'utf-8');
const parseDevVars = (content: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
};

const devVars = parseDevVars(devVarsContent);
const url = devVars['TURSO_DATABASE_URL'];
const authToken = devVars['TURSO_AUTH_TOKEN'];

console.log('Connecting to Turso remote:', url?.slice(0, 50) + '...');

if (!url || url.startsWith('file:')) {
  console.error('URL bukan remote:', url);
  process.exit(1);
}

const remote = createClient({ url, authToken });

async function run() {
  // Cek tables yang ada
  const existing = await remote.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const existingTables = existing.rows.map((r: any) => r[0] as string);
  console.log('Existing remote tables:', existingTables.join(', '));

  const ddls: { name: string; sql: string }[] = [
    {
      name: 'sessions',
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_name TEXT NOT NULL,
        role TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`
    },
    {
      name: 'login_attempts',
      sql: `CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        email TEXT,
        attempted_at INTEGER NOT NULL,
        is_success INTEGER NOT NULL DEFAULT 0
      )`
    },
    {
      name: 'audit_logs',
      sql: `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`
    },
    {
      name: 'media',
      sql: `CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        thumbnail_url TEXT,
        medium_url TEXT,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        file_extension TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Umum',
        title TEXT,
        description TEXT,
        alt_text TEXT,
        is_private INTEGER NOT NULL DEFAULT 0,
        uploaded_by TEXT,
        uploader_name TEXT,
        storage_key TEXT,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      )`
    },
  ];

  for (const { name, sql } of ddls) {
    if (!existingTables.includes(name)) {
      console.log(`Creating table: ${name}`);
      await remote.execute(sql);
      console.log(`  ✅ ${name} created`);
    } else {
      console.log(`  ⏭️  ${name} already exists`);
    }
  }

  // Check users table untuk password hash
  const usersResult = await remote.execute(
    "SELECT id, email, name, role, password_hash FROM users LIMIT 10"
  );
  console.log('\nUsers in Turso remote:');
  for (const row of usersResult.rows) {
    const hasHash = row[4] ? '✅ has hash' : '❌ no hash';
    console.log(`  ${row[1]} (${row[3]}) ${hasHash}`);
  }

  console.log('\nDone!');
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
