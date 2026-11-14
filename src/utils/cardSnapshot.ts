import type { ScryfallCard } from '../types/card';
import type { CardFinish, CardListSnapshot } from '../types/list';

/**
 * Normaliza os acabamentos da Scryfall para o vocabulário do app.
 * A Scryfall usa "nonfoil"; o app usa "normal".
 */
export function getAvailableFinishes(card: ScryfallCard): CardFinish[] {
  const finishes = card.finishes ?? [];

  return finishes.map((finish) => (finish === 'nonfoil' ? 'normal' : finish));
}

/**
 * Imagem normal da carta, considerando cartas de face dupla.
 */
export function getCardImageUriNormal(card: ScryfallCard): string | null {
  return (
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? null
  );
}

/**
 * Snapshot mínimo da carta para exibição offline dentro de uma lista.
 */
export function buildCardSnapshot(card: ScryfallCard): CardListSnapshot {
  return {
    id: card.id,
    name: card.name,
    printedName: card.printed_name,
    setCode: card.set,
    setName: card.set_name,
    collectorNumber: card.collector_number,
    rarity: card.rarity,
    typeLine: card.type_line,
    imageUriNormal: getCardImageUriNormal(card),
    finishes: getAvailableFinishes(card),
  };
}
