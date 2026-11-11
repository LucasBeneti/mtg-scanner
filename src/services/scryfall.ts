import type { ScryfallCard } from '../types/card';
import { getCachedCard, setCachedCard } from './cardCache';
import { normalizeCollectorNumber } from './collectorParser';

const SCRYFALL_BASE_URL = 'https://api.scryfall.com';

/**
 * A API da Scryfall exige headers User-Agent e Accept em todas as chamadas.
 * Rate limit oficial: ~2 req/s (mínimo 500ms entre chamadas).
 */
const SCRYFALL_HEADERS = {
  'User-Agent': 'MTGScannerMobile/0.1 (Expo React Native)',
  Accept: 'application/json',
};

const MIN_REQUEST_INTERVAL_MS = 550;
let lastRequestTimestamp = 0;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed)
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

/**
 * Busca a impressão exata de uma carta na Scryfall por sigla da edição e número do colecionador.
 * Consulta primeiro o cache local SQLite para resposta instantânea e economia de requisições.
 */
export async function fetchCardBySetAndNumber(
  rawSetCode: string,
  rawCollectorNumber: string
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
    setCode
  )}/${encodeURIComponent(collectorNumber)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: SCRYFALL_HEADERS,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new ScryfallError(
        `Carta não encontrada na Scryfall: ${setCode.toUpperCase()} #${collectorNumber}`,
        404
      );
    }
    if (response.status === 429) {
      throw new ScryfallError(
        'Limite de requisições da Scryfall atingido (HTTP 429). Aguarde alguns segundos.',
        429
      );
    }
    throw new ScryfallError(
      `Erro ao consultar Scryfall (HTTP ${response.status}).`,
      response.status
    );
  }

  const card = (await response.json()) as ScryfallCard;

  // 3. Salva no SQLite para consultas futuras
  await setCachedCard(setCode, collectorNumber, card);

  return { card, fromCache: false };
}

/**
 * Extrai a melhor URL de imagem da carta (suportando cartas de duas faces).
 */
export function getCardImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) {
    return card.image_uris.normal;
  }
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces[0].image_uris?.normal ?? null;
  }
  return null;
}
