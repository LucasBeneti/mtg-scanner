import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCardImageUrl } from '../services/scryfall';
import type { ScryfallCard } from '../types/card';

interface CardResultSheetProps {
  card: ScryfallCard | null;
  fromCache: boolean;
  onClose: () => void;
}

type FinishOption = 'normal' | 'foil' | 'etched';

interface FinishPriceItem {
  key: FinishOption;
  label: string;
  usd: string | null;
  eur: string | null;
}

const RARITY_LABELS: Record<ScryfallCard['rarity'], string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Rara',
  mythic: 'Mítica',
  special: 'Especial',
  bonus: 'Bônus',
};

export function CardResultSheet({
  card,
  fromCache,
  onClose,
}: CardResultSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedFinish, setSelectedFinish] = useState<FinishOption>('normal');

  useEffect(() => {
    if (!card) return;
    if (card.prices.usd) {
      setSelectedFinish('normal');
    } else if (card.prices.usd_foil) {
      setSelectedFinish('foil');
    } else if (card.prices.usd_etched) {
      setSelectedFinish('etched');
    } else {
      setSelectedFinish('normal');
    }
  }, [card]);

  if (!card) {
    return null;
  }

  const finishes: FinishPriceItem[] = [
    {
      key: 'normal',
      label: 'Normal',
      usd: card.prices.usd,
      eur: card.prices.eur,
    },
    {
      key: 'foil',
      label: 'Foil',
      usd: card.prices.usd_foil,
      eur: card.prices.eur_foil,
    },
    {
      key: 'etched',
      label: 'Etched / Surge',
      usd: card.prices.usd_etched,
      eur: card.prices.eur_etched ?? null,
    },
  ];

  const activeFinish =
    finishes.find((f) => f.key === selectedFinish) ?? finishes[0];
  const imageUrl = getCardImageUrl(card);
  const oracleText =
    card.oracle_text ??
    card.card_faces
      ?.map((face) => `${face.name}:\n${face.oracle_text ?? ''}`)
      .join('\n\n');

  return (
    <Modal
      visible={true}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 12) + 16 },
          ]}
        >
          <View style={styles.handle} />

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Cabeçalho da carta */}
            <View style={styles.headerRow}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                  <Text style={styles.placeholderText}>Sem imagem</Text>
                </View>
              )}

              <View style={styles.cardMeta}>
                <Text style={styles.cardName}>
                  {card.printed_name ?? card.name}
                </Text>
                {card.printed_name && card.printed_name !== card.name ? (
                  <Text style={styles.cardOriginalName}>{card.name}</Text>
                ) : null}

                <Text style={styles.setInfo}>
                  {card.set_name} ({card.set.toUpperCase()} #
                  {card.collector_number})
                </Text>

                <View style={styles.badgesRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {RARITY_LABELS[card.rarity] ?? card.rarity}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      fromCache ? styles.cacheBadge : styles.apiBadge,
                    ]}
                  >
                    <Text
                      style={
                        fromCache ? styles.cacheBadgeText : styles.apiBadgeText
                      }
                    >
                      {fromCache ? 'CACHE SQLITE' : 'API SCRYFALL'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.typeLine}>{card.type_line}</Text>
              </View>
            </View>

            {/* Destaque do preço selecionado */}
            <View style={styles.mainPriceBox}>
              <Text style={styles.mainPriceLabel}>
                Cotação Scryfall ({activeFinish.label})
              </Text>
              <Text style={styles.mainPriceValue}>
                {activeFinish.usd ? `US$ ${activeFinish.usd}` : 'Sem cotação'}
              </Text>
              {activeFinish.eur ? (
                <Text style={styles.secondaryPriceValue}>
                  Cardmarket (EUR): € {activeFinish.eur}
                </Text>
              ) : null}
            </View>

            {/* Seletor de acabamento mostrando todos os preços disponíveis */}
            <Text style={styles.sectionTitle}>
              Escolha o acabamento da sua carta:
            </Text>
            <View style={styles.finishGrid}>
              {finishes.map((item) => {
                const isSelected = item.key === activeFinish.key;
                const hasPrice = item.usd !== null;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setSelectedFinish(item.key)}
                    style={[
                      styles.finishCard,
                      isSelected && styles.finishCardSelected,
                      !hasPrice && styles.finishCardDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.finishCardLabel,
                        isSelected && styles.finishCardLabelSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.finishCardPrice,
                        isSelected && styles.finishCardPriceSelected,
                      ]}
                    >
                      {item.usd ? `$${item.usd}` : '—'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Texto Oracle / Regras */}
            {oracleText ? (
              <View style={styles.oracleBox}>
                <Text style={styles.oracleTitle}>Texto da Carta (Oracle)</Text>
                <Text style={styles.oracleText}>{oracleText}</Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Escanear próxima carta</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '86%',
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  scrollContent: {
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  cardImage: {
    width: 112,
    height: 156,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  cardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 12,
  },
  cardMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  cardName: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '800',
  },
  cardOriginalName: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  setInfo: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  cacheBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
  },
  cacheBadgeText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
  },
  apiBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  apiBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  typeLine: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  mainPriceBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mainPriceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainPriceValue: {
    color: '#4ADE80',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  secondaryPriceValue: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  finishGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  finishCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  finishCardSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  finishCardDisabled: {
    opacity: 0.5,
  },
  finishCardLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  finishCardLabelSelected: {
    color: '#F8FAFC',
  },
  finishCardPrice: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  finishCardPriceSelected: {
    color: '#38BDF8',
  },
  oracleBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  oracleTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  oracleText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  closeButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
});
