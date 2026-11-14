import type { ScryfallCard } from './card';

export type CardFinish = 'normal' | 'foil' | 'etched';

export interface CardList {
  id: number;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  lastRefreshedAt: number | null;
}

export interface ListSummary {
  id: number;
  name: string;
  cardCount: number;
  estimatedValueUsdCents: number;
  lastAccessedAt: number;
  lastRefreshedAt: number | null;
}

export interface CardListSnapshot {
  id: string;
  name: string;
  printedName?: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: ScryfallCard['rarity'];
  typeLine: string;
  imageUriNormal: string | null;
  finishes: CardFinish[];
}

export interface CardListItem {
  id: number;
  listId: number;
  cardId: string;
  setCode: string;
  collectorNumber: string;
  finish: CardFinish;
  quantity: number;
  snapshot: CardListSnapshot;
  entryPriceUsdCents: number | null;
  lastAddedAt: number;
  currentPriceUsdCents: number | null;
  priceUpdatedAt: number | null;
  createdAt: number;
}

export interface ListDetail extends CardList {
  items: CardListItem[];
  cardCount: number;
  estimatedValueUsdCents: number;
}

export interface AddCardToListInput {
  listId: number;
  card: ScryfallCard;
  finish: CardFinish;
  quantity: number;
  entryPriceUsdCents: number | null;
  now: number;
}
