import type { CardListItem } from '../types/list';
import { getUsdPriceCentsForFinish } from '../utils/money';
import {
  applyListPriceRefresh,
  type ListItemPriceUpdate,
} from './listsRepository';
import { fetchCardsByCollection } from './scryfall';

export interface PriceRefreshResult {
  updatedCount: number;
  noPriceCount: number;
  notFoundCount: number;
  failedCount: number;
  refreshedAt: number | null;
}

export interface PriceRefreshOptions {
  onProgress?: (processed: number, total: number) => void;
}

export async function refreshListPrices(
  listId: number,
  items: CardListItem[],
  options: PriceRefreshOptions = {},
): Promise<PriceRefreshResult> {
  const cardIds = Array.from(new Set(items.map((item) => item.cardId)));

  if (cardIds.length === 0) {
    return {
      updatedCount: 0,
      noPriceCount: 0,
      notFoundCount: 0,
      failedCount: 0,
      refreshedAt: null,
    };
  }

  const collection = await fetchCardsByCollection(cardIds, {
    onProgress: options.onProgress,
  });

  const cardsById = new Map(collection.cards.map((card) => [card.id, card]));
  const notFoundIds = new Set(collection.notFoundIds);
  const failedIds = new Set(collection.failedIds);
  const priceUpdatedAt = Date.now();

  const updates: ListItemPriceUpdate[] = [];
  let updatedCount = 0;
  let noPriceCount = 0;
  let notFoundCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const card = cardsById.get(item.cardId);

    if (card) {
      const currentPriceUsdCents = getUsdPriceCentsForFinish(card, item.finish);

      updates.push({
        itemId: item.id,
        currentPriceUsdCents,
        priceUpdatedAt,
      });

      if (currentPriceUsdCents == null) {
        noPriceCount += 1;
      } else {
        updatedCount += 1;
      }

      continue;
    }

    if (failedIds.has(item.cardId)) {
      failedCount += 1;
    } else if (notFoundIds.has(item.cardId)) {
      notFoundCount += 1;
    } else {
      // A Scryfall não devolveu o id nem em data nem em not_found.
      failedCount += 1;
    }
  }

  const refreshedAt = updates.length > 0 ? priceUpdatedAt : null;

  await applyListPriceRefresh({
    listId,
    updates,
    refreshedAt,
  });

  return {
    updatedCount,
    noPriceCount,
    notFoundCount,
    failedCount,
    refreshedAt,
  };
}

export function formatPriceRefreshResult(result: PriceRefreshResult): string {
  const parts: string[] = [];

  if (result.updatedCount > 0) {
    parts.push(
      result.updatedCount === 1
        ? '1 atualizado'
        : `${result.updatedCount} atualizados`,
    );
  }

  if (result.noPriceCount > 0) {
    parts.push(`${result.noPriceCount} sem cotação`);
  }

  if (result.notFoundCount > 0) {
    parts.push(
      result.notFoundCount === 1
        ? '1 não encontrada'
        : `${result.notFoundCount} não encontradas`,
    );
  }

  if (result.failedCount > 0) {
    parts.push(
      result.failedCount === 1 ? '1 falhou' : `${result.failedCount} falharam`,
    );
  }

  return parts.length > 0 ? parts.join(' • ') : 'Nenhum preço atualizado.';
}
