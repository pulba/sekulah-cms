import { db, settings } from '../db';

let cachedSettings: Record<string, string> | null = null;
let lastFetched = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds TTL

/**
 * Retrieves school settings as a key-value dictionary.
 * Caches in-memory to prevent multiple round-trips to remote Turso database
 * during SSR and across simultaneous component/layout renders.
 */
export async function getSettingsMap(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedSettings && now - lastFetched < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const all = await db.select().from(settings);
    cachedSettings = all.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, string>,
    );
    lastFetched = now;
    return cachedSettings;
  } catch {
    if (cachedSettings) return cachedSettings;
    return {};
  }
}

/**
 * Invalidates the in-memory cache so next read fetches fresh data from DB.
 * Should be called after any mutation to the settings table.
 */
export function invalidateSettingsCache(): void {
  cachedSettings = null;
  lastFetched = 0;
}

