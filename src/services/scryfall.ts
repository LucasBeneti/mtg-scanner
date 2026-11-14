import type { ImageURISource } from 'react-native';
import type { ScryfallCard } from '../types/card';
import { getCachedCard, setCachedCard } from './cardCache';
import { normalizeCollectorNumber } from './collectorParser';

const SCRYFALL_BASE_URL = 'https://api.scryfall.com';

export const SCRYFALL_USER_AGENT = 'MTGScannerMobile/0.1 (Expo React Native)';

/**
 * A API da Scryfall exige headers User-Agent e Accept em todas as chamadas.
 * Rate limit oficial: ~2 req/s (mínimo 500ms entre chamadas).
 */
const SCRYFALL_HEADERS = {
  'User-Agent': SCRYFALL_USER_AGENT,
  Accept: 'application/json',
};

const MIN_REQUEST_INTERVAL_MS = 550;
let lastRequestTimestamp = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed),
    );
  }
  lastRequestTimestamp = Date.now();
}

export class ScryfallError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ScryfallError';
    this.status = status;
  }
}

export interface FetchCardResult {
  card: ScryfallCard;
  fromCache: boolean;
}

export interface CollectionFetchResult {
  cards: ScryfallCard[];
  notFoundIds: string[];
  failedIds: string[];
}

export interface CollectionFetchOptions {
  onProgress?: (processed: number, total: number) => void;
}

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
  not_found?: { id?: string }[];
}

const COLLECTION_BATCH_SIZE = 75;

/**
 * Busca a impressão exata de uma carta na Scryfall por sigla da edição e número do colecionador.
 * Consulta primeiro o cache local SQLite para resposta instantânea e economia de requisições.
 */
export async function fetchCardBySetAndNumber(
  rawSetCode: string,
  rawCollectorNumber: string,
): Promise<FetchCardResult> {
  const setCode = rawSetCode.trim().toLowerCase();
  const collectorNumber = normalizeCollectorNumber(rawCollectorNumber);

  // 1. Consulta cache local SQLite primeiro
  const cached = await getCachedCard(setCode, collectorNumber);
  if (cached) {
    return { card: cached, fromCache: true };
  }

  // 2. Respeita o espaçamento mínimo de rate limit da Scryfall
  await waitForRateLimit();

  const url = `${SCRYFALL_BASE_URL}/cards/${encodeURIComponent(
    setCode,
  )}/${encodeURIComponent(collectorNumber)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: SCRYFALL_HEADERS,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new ScryfallError(
        `Carta não encontrada na Scryfall: ${setCode.toUpperCase()} #${collectorNumber}`,
        404,
      );
    }
    if (response.status === 429) {
      throw new ScryfallError(
        'Limite de requisições da Scryfall atingido (HTTP 429). Aguarde alguns segundos.',
        429,
      );
    }
    throw new ScryfallError(
      `Erro ao consultar Scryfall (HTTP ${response.status}).`,
      response.status,
    );
  }

  const card = (await response.json()) as ScryfallCard;

  // 3. Salva no SQLite para consultas futuras
  await setCachedCard(setCode, collectorNumber, card);

  return { card, fromCache: false };
}

/**
 * Busca os dados atuais de várias cartas pelo endpoint de coleção da Scryfall.
 * O endpoint aceita até 75 identificadores por request; listas maiores são
 * divididas em lotes. Falhas de um lote não impedem os demais.
 */
export async function fetchCardsByCollection(
  cardIds: string[],
  options: CollectionFetchOptions = {},
): Promise<CollectionFetchResult> {
  const uniqueIds = Array.from(new Set(cardIds));
  const result: CollectionFetchResult = {
    cards: [],
    notFoundIds: [],
    failedIds: [],
  };

  if (uniqueIds.length === 0) {
    return result;
  }

  let processed = 0;

  for (
    let index = 0;
    index < uniqueIds.length;
    index += COLLECTION_BATCH_SIZE
  ) {
    const batch = uniqueIds.slice(index, index + COLLECTION_BATCH_SIZE);

    await waitForRateLimit();

    try {
      const response = await fetch(`${SCRYFALL_BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: {
          ...SCRYFALL_HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: batch.map((id) => ({ id })),
        }),
      });

      if (!response.ok) {
        result.failedIds.push(...batch);
      } else {
        const payload = (await response.json()) as ScryfallCollectionResponse;

        result.cards.push(...payload.data);

        for (const missing of payload.not_found ?? []) {
          if (missing.id) {
            result.notFoundIds.push(missing.id);
          }
        }

        for (const card of payload.data) {
          await setCachedCard(card.set, card.collector_number, card);
        }
      }
    } catch (error) {
      console.warn('[scryfall] falha no lote da coleção', error);
      result.failedIds.push(...batch);
    } finally {
      processed += batch.length;
      options.onProgress?.(processed, uniqueIds.length);
    }
  }

  return result;
}

/**
 * Monta o source do <Image> já com o User-Agent exigido pelo CDN da Scryfall.
 * O CDN rejeita UAs padrão de biblioteca (ex: okhttp/4.9.2) com HTTP 400.
 */
export function getCardImageSourceFromUri(
  uri: string | null,
): ImageURISource | null {
  if (!uri) {
    return null;
  }

  return {
    uri,
    headers: { 'User-Agent': SCRYFALL_USER_AGENT },
  };
}

export function getCardImageSource(card: ScryfallCard): ImageURISource | null {
  const uri =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null;

  return getCardImageSourceFromUri(uri);
}
