import { getSetting, setSetting } from './settingsRepository';

export const FX_SETTING_KEY = 'fx:usd-brl';

/** Revalida a cotação no máximo uma vez por dia. */
export const FX_TTL_MS = 24 * 60 * 60 * 1000;

const REQUEST_TIMEOUT_MS = 8_000;

/** Limites de sanidade para descartar respostas absurdas. */
const MIN_RATE = 0.1;
const MAX_RATE = 50;

const FRANKFURTER_URL =
  'https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL';
const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

export type FxSource = 'frankfurter' | 'awesomeapi';

export interface FxRate {
  /** BRL por USD multiplicado por 1e6 (5,6666 -> 5666600). */
  rateMicros: number;
  /** Data de referência do provider (YYYY-MM-DD), quando informada. */
  rateDate: string | null;
  /** Quando buscamos a cotação (não quando ela foi publicada). */
  fetchedAt: number;
  source: FxSource;
}

interface FrankfurterResponse {
  date?: string;
  rates?: { BRL?: number };
}

interface AwesomeApiResponse {
  USDBRL?: { bid?: string; ask?: string; create_date?: string };
}

function toRateMicros(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value;

  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount < MIN_RATE ||
    amount > MAX_RATE
  ) {
    return null;
  }

  return Math.round(amount * 1_000_000);
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Referência do BCE: já é mid-market. */
async function fetchFromFrankfurter(): Promise<FxRate> {
  const payload = (await fetchJson(FRANKFURTER_URL)) as FrankfurterResponse;
  const rateMicros = toRateMicros(payload?.rates?.BRL);

  if (rateMicros == null) {
    throw new Error('Frankfurter sem cotação BRL válida');
  }

  return {
    rateMicros,
    rateDate: payload?.date ?? null,
    fetchedAt: Date.now(),
    source: 'frankfurter',
  };
}

/**
 * A AwesomeAPI informa bid/ask. Usamos o ponto médio para manter a mesma
 * semântica do Frankfurter — assim o valor não "pula" quando o fallback entra.
 */
async function fetchFromAwesomeApi(): Promise<FxRate> {
  const payload = (await fetchJson(AWESOME_API_URL)) as AwesomeApiResponse;
  const bid = Number(payload?.USDBRL?.bid);
  const ask = Number(payload?.USDBRL?.ask);
  const mid =
    Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : bid;
  const rateMicros = toRateMicros(mid);

  if (rateMicros == null) {
    throw new Error('AwesomeAPI sem cotação BRL válida');
  }

  return {
    rateMicros,
    rateDate: payload?.USDBRL?.create_date?.slice(0, 10) ?? null,
    fetchedAt: Date.now(),
    source: 'awesomeapi',
  };
}

const PROVIDERS: (() => Promise<FxRate>)[] = [
  fetchFromFrankfurter,
  fetchFromAwesomeApi,
];

export async function getCachedRate(): Promise<FxRate | null> {
  const cached = await getSetting<FxRate>(FX_SETTING_KEY);

  if (
    !cached ||
    typeof cached.rateMicros !== 'number' ||
    !Number.isFinite(cached.rateMicros) ||
    cached.rateMicros <= 0 ||
    typeof cached.fetchedAt !== 'number'
  ) {
    return null;
  }

  return cached;
}

let inFlight: Promise<FxRate | null> | null = null;

/**
 * Retorna a cotação cacheada, buscando uma nova quando expirada.
 * Nunca lança: em falha total devolve o cache antigo (ou `null`).
 */
export function loadRate(
  options: { force?: boolean } = {},
): Promise<FxRate | null> {
  if (inFlight) return inFlight;

  const run = async (): Promise<FxRate | null> => {
    try {
      const cached = await getCachedRate();

      if (
        !options.force &&
        cached &&
        Date.now() - cached.fetchedAt < FX_TTL_MS
      ) {
        return cached;
      }

      for (const provider of PROVIDERS) {
        try {
          const rate = await provider();
          await setSetting(FX_SETTING_KEY, rate);
          return rate;
        } catch (error) {
          console.warn('[fx] provedor de cotação falhou', error);
        }
      }

      return cached;
    } finally {
      inFlight = null;
    }
  };

  inFlight = run();
  return inFlight;
}
