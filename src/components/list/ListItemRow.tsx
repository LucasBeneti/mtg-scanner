import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCardImageSourceFromUri } from '../../services/scryfall';
import type { CardListItem } from '../../types/list';
import { getFinishLabel } from '../../utils/finish';
import { formatUsdCents } from '../../utils/money';

interface ListItemRowProps {
  item: CardListItem;
  isPending: boolean;
  onIncrement: (itemId: number) => void;
  onDecrement: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

export const ListItemRow = React.memo(function ListItemRow({
  item,
  isPending,
  onIncrement,
  onDecrement,
  onRemove,
}: ListItemRowProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSource = getCardImageSourceFromUri(item.snapshot.imageUriNormal);
  const currentPrice = item.currentPriceUsdCents;
  const entryPrice = item.entryPriceUsdCents;
  const effectivePrice = currentPrice ?? entryPrice;
  const lineTotal =
    effectivePrice == null ? null : effectivePrice * item.quantity;
  const displayName = item.snapshot.printedName ?? item.snapshot.name;
  const priceLabel =
    currentPrice != null
      ? `${formatUsdCents(currentPrice)} / un.`
      : entryPrice != null
        ? `${formatUsdCents(entryPrice)} / un. (entrada)`
        : 'Sem cotação';
  const showEntryComparison =
    currentPrice != null && entryPrice != null && currentPrice !== entryPrice;
  const showNoCurrent = currentPrice == null && entryPrice != null;

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      <View style={styles.topRow}>
        {imageSource && !imageFailed ? (
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode='cover'
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>?</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.setCode.toUpperCase()} #{item.collectorNumber}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.finishBadge}>
              <Text style={styles.finishBadgeText}>
                {getFinishLabel(item.finish)}
              </Text>
            </View>
          </View>

          <Text style={styles.unitPrice}>{priceLabel}</Text>

          {showEntryComparison ? (
            <Text style={styles.entryPrice}>
              Entrada: {formatUsdCents(entryPrice)} / un.
            </Text>
          ) : null}

          {showNoCurrent ? (
            <Text style={styles.entryPrice}>
              Sem cotação atual • total usa a entrada
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.stepper}>
          <Pressable
            style={[
              styles.stepperButton,
              (item.quantity <= 1 || isPending) && styles.stepperButtonDisabled,
            ]}
            onPress={() => onDecrement(item.id)}
            disabled={item.quantity <= 1 || isPending}
            accessibilityRole='button'
            accessibilityLabel={`Diminuir quantidade de ${displayName}`}
            hitSlop={6}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>

          <Text style={styles.quantityValue}>{item.quantity}</Text>

          <Pressable
            style={[
              styles.stepperButton,
              isPending && styles.stepperButtonDisabled,
            ]}
            onPress={() => onIncrement(item.id)}
            disabled={isPending}
            accessibilityRole='button'
            accessibilityLabel={`Aumentar quantidade de ${displayName}`}
            hitSlop={6}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {lineTotal == null ? '—' : formatUsdCents(lineTotal)}
          </Text>
        </View>

        {isPending ? (
          <ActivityIndicator size='small' color='#38BDF8' />
        ) : (
          <Pressable
            style={styles.removeButton}
            onPress={() => onRemove(item.id)}
            accessibilityRole='button'
            accessibilityLabel={`Remover ${displayName} da lista`}
            hitSlop={6}
          >
            <Text style={styles.removeButtonText}>Remover</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 12,
  },
  cardPending: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    gap: 12,
  },
  image: {
    width: 48,
    height: 67,
    borderRadius: 6,
    backgroundColor: '#0F172A',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 7,
  },
  finishBadge: {
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  finishBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  unitPrice: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  entryPrice: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 9,
    backgroundColor: '#0F172A',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperButtonText: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 19,
  },
  quantityValue: {
    minWidth: 22,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  totalBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  removeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  removeButtonText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
});
