import type { ParsedCollectorInfo } from '../types/card';

/**
 * Códigos de idioma impressos no rodapé das cartas de Magic logo após a sigla da edição
 * (ex: "BLB • EN", "FDN • PT", "MH3 • JP").
 */
const LANGUAGE_CODES = new Set([
  'EN',
  'PT',
  'ES',
  'FR',
  'DE',
  'IT',
  'JP',
  'JA',
  'KO',
  'RU',
  'CS',
  'CT',
  'ZHS',
  'ZHT',
  'PH',
]);

/**
 * Letras de raridade/tipo impressas no bloco de colecionador:
 * C (Common), U (Uncommon), R (Rare), M (Mythic), S (Special), L (Land), T (Token), P (Promo)
 */
const RARITY_LETTERS = new Set(['C', 'U', 'R', 'M', 'S', 'L', 'T', 'P']);

/**
 * Palavras do rodapé de copyright/ilustrador que devem ser ignoradas como sigla de set.
 */
const IGNORED_TOKENS = new Set([
  'TM',
  'LLC',
  'WOTC',
  'AND',
  'THE',
  'FOR',
  'NOT',
  'SALE',
]);

/**
 * Corrige trocas comuns de OCR em sequências numéricas (ex: "O064" -> "0064")
 * e remove zeros à esquerda mantendo sufixos válidos como "125a" ou "125★".
 * A API da Scryfall espera "64" em vez de "0064".
 */
export function normalizeCollectorNumber(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '')
    // Corrige 'O' maiúsculo lido no lugar de zero quando cercado ou seguido de dígitos
    .replace(/O(?=\d)/gi, '0')
    .replace(/(?<=\d)O/gi, '0');

  const match = cleaned.match(/^0*(\d+)([a-zA-Z★☆]*)$/);
  if (!match) {
    return cleaned.toLowerCase();
  }

  const [, digits, suffix] = match;
  return `${digits}${suffix.toLowerCase()}`;
}

/**
 * Faz o parse de uma entrada manual como "FDN 125", "BLB • 0064", "mh3/241".
 */
export function parseManualInput(input: string): ParsedCollectorInfo | null {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[•·/\\\-_]+/g, ' ')
    .replace(/\s+/g, ' ');

  const setFirst = cleaned.match(/^([A-Z0-9]{3,5})\s+0*(\d{1,4}[A-Z★]?)$/);
  if (setFirst) {
    return {
      setCode: setFirst[1].toLowerCase(),
      collectorNumber: normalizeCollectorNumber(setFirst[2]),
      rawMatch: `${setFirst[1]} • ${setFirst[2]}`,
    };
  }

  const numFirst = cleaned.match(/^0*(\d{1,4}[A-Z★]?)\s+([A-Z0-9]{3,5})$/);
  if (numFirst) {
    return {
      setCode: numFirst[2].toLowerCase(),
      collectorNumber: normalizeCollectorNumber(numFirst[1]),
      rawMatch: `${numFirst[2]} • ${numFirst[1]}`,
    };
  }

  return null;
}

/**
 * Extrai `{ setCode, collectorNumber }` do texto cru retornado pelo OCR
 * na sub-caixa do canto inferior esquerdo da carta.
 *
 * Suporta:
 * 1) Layout 2023+ (ex: Foundations, Bloomburrow, Modern Horizons 3):
 *    Linha 1: "R 0064" ou "M 0241" ou "U 0125"
 *    Linha 2: "BLB • EN" ou "FDN • PT"
 * 2) Layout M15–2022 (ex: Dominaria United, Kamigawa):
 *    Linha 1: "064/280 R" ou "125/264 U"
 *    Linha 2: "DMU • EN"
 * 3) Leituras em linha única ou compactas: "BLB 0064", "FDN • 0125"
 */
export function parseCollectorOcrText(
  ocrText: string
): ParsedCollectorInfo | null {
  if (!ocrText || !ocrText.trim()) {
    return null;
  }

  const normalized = ocrText
    .toUpperCase()
    .replace(/[|]/g, 'I')
    .replace(/[\r\n]+/g, '\n')
    // Corrige "O064" -> "0064" quando o OCR troca zero por letra O antes de dígitos
    .replace(/\bO(\d{2,3})\b/g, '0$1');

  // 1. Tenta localizar o SET ancorado pelo código de idioma: ex. "BLB • EN", "FDN · PT", "MH3 EN"
  let detectedSet: string | null = null;
  const setLangRegex =
    /\b([A-Z0-9]{3,4})\s*[•·.*\-~]?\s*\b(EN|PT|ES|FR|DE|IT|JP|JA|KO|RU|CS|CT|ZHS|ZHT|PH)\b/g;

  let match: RegExpExecArray | null;
  while ((match = setLangRegex.exec(normalized)) !== null) {
    const candidate = match[1];
    if (
      !LANGUAGE_CODES.has(candidate) &&
      !IGNORED_TOKENS.has(candidate) &&
      !/^\d+$/.test(candidate)
    ) {
      detectedSet = candidate;
      break;
    }
  }

  // 2. Tenta localizar o Número do Colecionador:
  //    a) Formato fração (M15–2022): "064/280" ou "125/264"
  //    b) Formato raridade + número (2023+): "R 0064", "C 0125", "M 0241"
  //    c) Número com 4 dígitos preenchidos com zero à esquerda: "0064", "0125"
  let detectedRawNumber: string | null = null;

  const fractionMatch = normalized.match(/\b(\d{1,4}[A-Z★]?)\s*\/\s*\d{2,4}\b/);
  if (fractionMatch) {
    detectedRawNumber = fractionMatch[1];
  }

  if (!detectedRawNumber) {
    const rarityNumMatch = normalized.match(
      /\b[CURMSLP]\s*[•·-]?\s*(0\d{2,3}[A-Z★]?|\d{1,4}[A-Z★]?)\b/
    );
    if (rarityNumMatch) {
      detectedRawNumber = rarityNumMatch[1];
    }
  }

  if (!detectedRawNumber) {
    const paddedNumMatch = normalized.match(/\b(0\d{2,3}[A-Z★]?)\b/);
    if (paddedNumMatch) {
      detectedRawNumber = paddedNumMatch[1];
    }
  }

  // 3. Fallback para o SET: se o idioma não foi lido pelo OCR, procura token de 3-4 caracteres
  //    alfanuméricos começando com letra que não seja idioma, raridade ou palavra ignorada.
  if (!detectedSet) {
    const tokens = normalized.split(/[\s•·.,/\\-]+/).filter(Boolean);
    for (const token of tokens) {
      if (
        /^[A-Z][A-Z0-9]{2,3}$/.test(token) &&
        !LANGUAGE_CODES.has(token) &&
        !RARITY_LETTERS.has(token) &&
        !IGNORED_TOKENS.has(token)
      ) {
        detectedSet = token;
        break;
      }
    }
  }

  // 4. Fallback para o número: se achou o SET mas o número não tinha zero à esquerda nem barra
  if (detectedSet && !detectedRawNumber) {
    const lines = normalized.split('\n');
    for (const line of lines) {
      const numMatches = line.match(/\b(\d{1,4}[A-Z★]?)\b/g);
      if (numMatches) {
        for (const candidate of numMatches) {
          const numericVal = parseInt(candidate, 10);
          // Ignora anos de copyright como 1993, 2023, 2024, 2025, 2026
          if (
            numericVal >= 1993 &&
            numericVal <= 2030 &&
            candidate.length === 4 &&
            !candidate.startsWith('0')
          ) {
            continue;
          }
          detectedRawNumber = candidate;
          break;
        }
      }
      if (detectedRawNumber) break;
    }
  }

  if (detectedSet && detectedRawNumber) {
    const normalizedNumber = normalizeCollectorNumber(detectedRawNumber);
    return {
      setCode: detectedSet.toLowerCase(),
      collectorNumber: normalizedNumber,
      rawMatch: `${detectedSet} • ${detectedRawNumber}`,
    };
  }

  return null;
}
