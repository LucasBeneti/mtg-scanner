import type { Currency } from '../types/currency';
import { convertBrlCentsToUsdCents } from './money';

/** Teto de sanidade: US$ 99.000.000,00 em centavos. */
export const MAX_PRICE_OVERRIDE_USD_CENTS = 9_900_000_000;

export const MAX_PRICE_OVERRIDE_NOTE_LENGTH = 120;

export class InvalidPriceOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPriceOverrideError';
  }
}

export function normalizePriceOverrideNote(raw: string): string | null {
  const note = raw.trim();

  if (!note) {
    return null;
  }

  if (note.length > MAX_PRICE_OVERRIDE_NOTE_LENGTH) {
    throw new InvalidPriceOverrideError(
      `A observação deve ter no máximo ${MAX_PRICE_OVERRIDE_NOTE_LENGTH} caracteres.`,
    );
  }

  return note;
}

interface ParsePriceInputOptions {
  currency: Currency;
  /** Taxa em micros, obrigatória para converter BRL em USD. */
  rateMicros: number | null;
}

/**
 * Converte o texto digitado pelo usuário em centavos de USD.
 *
 * Aceita vírgula ou ponto como separador decimal ("12,34" e "12.34") e valores
 * com separador de milhar ("1.234,56"). Arredonda para o centavo mais próximo.
 * Lança `InvalidPriceOverrideError` para entrada vazia, não numérica, negativa
 * ou acima do teto.
 */
export function parsePriceInputToUsdCents(
  raw: string,
  { currency, rateMicros }: ParsePriceInputOptions,
): number {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new InvalidPriceOverrideError('Informe um preço.');
  }

  const amount = Number(normalizeDecimalInput(trimmed));

  if (!Number.isFinite(amount)) {
    throw new InvalidPriceOverrideError('Preço inválido.');
  }

  if (amount < 0) {
    throw new InvalidPriceOverrideError('O preço não pode ser negativo.');
  }

  const typedCents = Math.round(amount * 100);

  let usdCents = typedCents;

  if (currency === 'BRL') {
    if (rateMicros == null || rateMicros <= 0) {
      throw new InvalidPriceOverrideError(
        'Cotação do dólar indisponível para converter o preço.',
      );
    }

    usdCents = convertBrlCentsToUsdCents(typedCents, rateMicros);

    // R$ 0,01 pode arredondar para zero; "sem preço" já é representado por NULL.
    if (usdCents === 0 && typedCents > 0) {
      usdCents = 1;
    }
  }

  if (usdCents > MAX_PRICE_OVERRIDE_USD_CENTS) {
    throw new InvalidPriceOverrideError('Preço acima do limite permitido.');
  }

  return usdCents;
}

/**
 * Formata centavos para popular o input, sem símbolo e sem separador de
 * milhar: 12345 -> "123,45".
 */
export function formatCentsForInput(cents: number | null): string {
  if (cents == null) {
    return '';
  }

  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100).toString();
  const decimalPart = (absolute % 100).toString().padStart(2, '0');

  return `${cents < 0 ? '-' : ''}${integerPart},${decimalPart}`;
}

/**
 * Normaliza separadores decimais para o formato aceito por `Number`.
 * Com vírgula e ponto juntos, o último é o decimal; um separador repetido é
 * tratado como separador de milhar.
 */
function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/\s/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

    return cleaned
      .split(thousandsSeparator)
      .join('')
      .replace(decimalSeparator, '.');
  }

  if (lastComma >= 0) {
    const parts = cleaned.split(',');

    return parts.length > 2 ? parts.join('') : cleaned.replace(',', '.');
  }

  if (lastDot >= 0) {
    const parts = cleaned.split('.');

    return parts.length > 2 ? parts.join('') : cleaned;
  }

  return cleaned;
}
