import { getDatabase } from '../db/database';
import type { ScryfallCard } from '../types/card';

/** Tempo de vida do cache local: 12 horas em milissegundos */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export function makeCacheKey(setCode: string, collectorNumber: string): string {
  return `${setCode.toLowerCase().trim()}:${collectorNumber.toLowerCase().trim()}`;
}

export async function getCachedCard(
  setCode: string,
  collectorNumber: string,
): Promise<ScryfallCard | null> {
  try {
    const db = await getDatabase();
    const key = makeCacheKey(setCode, collectorNumber);
    const row = await db.getFirstAsync<{
      card_json: string;
      updated_at: number;
    }>('SELECT card_json, updated_at FROM card_cache WHERE cache_key = ?', key);

    if (!row) {
      return null;
    }

    if (Date.now() - row.updated_at > CACHE_TTL_MS) {
      return null;
    }

    return JSON.parse(row.card_json) as ScryfallCard;
  } catch {
    return null;
  }
}

export async function setCachedCard(
  setCode: string,
  collectorNumber: string,
  card: ScryfallCard,
): Promise<void> {
  try {
    const db = await getDatabase();
    const key = makeCacheKey(setCode, collectorNumber);
    await db.runAsync(
      `INSERT OR REPLACE INTO card_cache (cache_key, set_code, collector_number, card_json, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      key,
      setCode.toLowerCase().trim(),
      collectorNumber.toLowerCase().trim(),
      JSON.stringify(card),
      Date.now(),
    );
  } catch {
    // Falha no cache não deve interromper o fluxo do usuário
  }
}
