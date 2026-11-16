import type { CardListItem } from '../types/list';

type PriceFields = Pick<
  CardListItem,
  'priceOverrideUsdCents' | 'currentPriceUsdCents' | 'entryPriceUsdCents'
>;

/**
 * Preço unitário que vale para o item: o override manual vence a cotação
 * atual, que por sua vez vence o preço de entrada congelado.
 */
export function getEffectiveUnitPriceUsdCents(
  item: PriceFields,
): number | null {
  return (
    item.priceOverrideUsdCents ??
    item.currentPriceUsdCents ??
    item.entryPriceUsdCents
  );
}
