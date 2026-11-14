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
 * Formata centavos em USD no padrão brasileiro: US$ 1.234,56.
 */
export function formatUsdCents(cents: number | null): string {
  if (cents == null) return '—';

  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100).toString();
  const decimalPart = (absolute % 100).toString().padStart(2, '0');
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = cents < 0 ? '-' : '';

  return `US$ ${sign}${withThousands},${decimalPart}`;
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
