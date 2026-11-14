import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ListSummary } from '../../types/list';
import { formatUsdCents } from '../../utils/money';

interface ListPreviewCardProps {
  summary: ListSummary;
  onPress: () => void;
}

export function ListPreviewCard({ summary, onPress }: ListPreviewCardProps) {
  const countLabel =
    summary.cardCount === 1 ? '1 carta' : `${summary.cardCount} cartas`;
  const meta =
    summary.cardCount === 0
      ? 'Sem cartas'
      : `${countLabel} • ${formatUsdCents(summary.estimatedValueUsdCents)}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole='button'
      accessibilityLabel={`Abrir lista ${summary.name}`}
    >
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {summary.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardPressed: {
    opacity: 0.78,
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  chevron: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '700',
  },
});
