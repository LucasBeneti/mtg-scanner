import * as SQLite from 'expo-sqlite';
import { migrateDatabase } from './migrations';

/** Banco único do app: cache de cartas + listas. */
export const DATABASE_NAME = 'mtg_scanner_cache.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre (uma única vez) o banco compartilhado e garante que as migrations
 * estejam aplicadas. Todos os serviços devem usar esta função em vez de
 * chamar `openDatabaseAsync` diretamente.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    const promise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `);

      await migrateDatabase(db);

      return db;
    })();

    databasePromise = promise;

    // Se a abertura/migração falhar, permite tentar de novo na próxima chamada.
    promise.catch(() => {
      if (databasePromise === promise) {
        databasePromise = null;
      }
    });
  }

  return databasePromise;
}
