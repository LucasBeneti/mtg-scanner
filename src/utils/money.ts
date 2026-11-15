import type { ScryfallCard } from '../types/card';
import type { CardFinish } from '../types/list';

/**
 * Converte um preço em string da Scryfall (ex.: "0.35") para centavos.
 * Retorna null quando o preço não está disponível ou é inválido.
 */
export function parseUsdToCents(
  value: string | null | undefined,
): number | null {
  if (value == null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return null;

  return Math.round(amount * 100);
}

/**
 * Formata centavos com o símbolo informado no padrão brasileiro: R$ 1.234,56.
 */
export function formatCurrencyCents(
  cents: number | null,
  symbol: string,
): string {
  if (cents == null) return '—';

  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100).toString();
  const decimalPart = (absolute % 100).toString().padStart(2, '0');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = cents < 0 ? '-' : '';

  return `${symbol} ${sign}${withThousands},${decimalPart}`;
}

/**
 * Formata centavos em USD no padrão brasileiro: US$ 1.234,56.
 */
export function formatUsdCents(cents: number | null): string {
  return formatCurrencyCents(cents, 'US$');
}

/**
 * Formata centavos em BRL no padrão brasileiro: R$ 1.234,56.
 */
export function formatBrlCents(cents: number | null): string {
  return formatCurrencyCents(cents, 'R$');
}

/**
 * Converte centavos de USD para centavos de BRL usando a taxa em micros.
 * Arredonda para o centavo mais próximo.
 */
export function convertUsdCentsToBrlCents(
  usdCents: number,
  rateMicros: number,
): number {
  return Math.round((usdCents * rateMicros) / 1_000_000);
}

/**
 * Formata a taxa em micros com 4 casas: 5666600 -> "5,6666".
 */
export function formatRateMicros(rateMicros: number): string {
  return (rateMicros / 1_000_000).toFixed(4).replace('.', ',');
}

/**
 * Formata a data de referência da cotação (YYYY-MM-DD) como "DD/MM".
 */
export function formatRateDate(rateDate: string | null): string | null {
  if (!rateDate) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rateDate);
  if (!match) return null;

  return `${match[3]}/${match[2]}`;
}

/**
 * Extrai o preço em USD de um acabamento específico da carta.
 */
export function getUsdPriceForFinish(
  card: ScryfallCard,
  finish: CardFinish,
): string | null {
  const prices: Record<CardFinish, string | null> = {
    normal: card.prices.usd,
    foil: card.prices.usd_foil,
    etched: card.prices.usd_etched,
  };

  return prices[finish];
}

/**
 * Extrai o preço em centavos de um acabamento específico da carta.
 */
export function getUsdPriceCentsForFinish(
  card: ScryfallCard,
  finish: CardFinish,
): number | null {
  return parseUsdToCents(getUsdPriceForFinish(card, finish));
}
