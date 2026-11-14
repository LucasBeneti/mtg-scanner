import type { SQLiteDatabase } from 'expo-sqlite';

const LATEST_DATABASE_VERSION = 1;

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS card_cache (
          cache_key TEXT PRIMARY KEY NOT NULL,
          set_code TEXT NOT NULL,
          collector_number TEXT NOT NULL,
          card_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          last_accessed_at INTEGER NOT NULL,
          last_refreshed_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_lists_last_accessed
          ON lists(last_accessed_at DESC, id DESC);

        CREATE TABLE IF NOT EXISTS list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
          card_id TEXT NOT NULL,
          set_code TEXT NOT NULL,
          collector_number TEXT NOT NULL,
          finish TEXT NOT NULL CHECK (finish IN ('normal', 'foil', 'etched')),
          quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
          card_snapshot_json TEXT NOT NULL,
          entry_price_usd_cents INTEGER,
          last_added_at INTEGER NOT NULL,
          current_price_usd_cents INTEGER,
          price_updated_at INTEGER,
          created_at INTEGER NOT NULL,
          UNIQUE (list_id, card_id, finish)
        );

        CREATE INDEX IF NOT EXISTS idx_list_items_list_added
          ON list_items(list_id, last_added_at DESC, id DESC);

        CREATE INDEX IF NOT EXISTS idx_list_items_card_id
          ON list_items(card_id);
      `);
    },
  },
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= LATEST_DATABASE_VERSION) {
    return;
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await migration.up(db);
    currentVersion = migration.version;
  }

  await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
}
