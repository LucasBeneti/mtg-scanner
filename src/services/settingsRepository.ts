import { getDatabase } from '../db/database';

/**
 * Preferências e cotações em um key-value simples, na mesma conexão do resto
 * do app. Valores são serializados em JSON.
 *
 * Usar a conexão compartilhada (em vez de uma segunda conexão) evita
 * `SQLITE_BUSY` quando uma escrita concorre com as transações de preços.
 */
export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );

  if (!row) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    // Valor corrompido: trata como ausente em vez de quebrar a tela.
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    Date.now(),
  );
}
