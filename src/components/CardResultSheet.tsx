import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCardImageSource } from '../services/scryfall';
import type { ScryfallCard } from '../types/card';
import type { CardFinish } from '../types/list';
import { getAvailableFinishes } from '../utils/cardSnapshot';
import { formatUsdCents, parseUsdToCents } from '../utils/money';
import { AddToListSection } from './list/AddToListSection';

interface CardResultSheetProps {
  card: ScryfallCard | null;
  fromCache: boolean;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  activeListName?: string | null;
  existingQuantities?: Partial<Record<CardFinish, number>>;
  onAddToList?: (input: {
    finish: CardFinish;
    quantity: number;
  }) => Promise<void>;
  onSkipCard?: () => void;
}

type FinishOption = CardFinish;

interface FinishPriceItem {
  key: FinishOption;
  label: string;
  usd: string | null;
  eur: string | null;
  available: boolean;
}

const RARITY_LABELS: Record<ScryfallCard['rarity'], string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Rara',
  mythic: 'Mítica',
  special: 'Especial',
  bonus: 'Bônus',
};

export const CARD_PEEK_HANDLE_HEIGHT = 16;
export const CARD_PEEK_ROW_HEIGHT = 64;

export function getCardPeekHeight(bottomInset: number): number {
  return (
    CARD_PEEK_HANDLE_HEIGHT + CARD_PEEK_ROW_HEIGHT + Math.max(bottomInset, 12)
  );
}

export function CardResultSheet({
  card,
  fromCache,
  expanded,
  onExpand,
  onCollapse,
  activeListName,
  existingQuantities,
  onAddToList,
  onSkipCard,
}: CardResultSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const [selectedFinish, setSelectedFinish] = useState<FinishOption>('normal');
  const [imageFailed, setImageFailed] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const sheetHeightRef = useRef(0);
  const startYRef = useRef(0);
  const scrollViewRef = useRef<ScrollViewInstance>(null);
  const expandedRef = useRef(expanded);
  const callbacksRef = useRef({ onExpand, onCollapse });

  expandedRef.current = expanded;
  callbacksRef.current = { onExpand, onCollapse };

  const peekHeight = getCardPeekHeight(insets.bottom);

  const animateTo = useCallback(
    (toValue: number) => {
      translateY.stopAnimation();
      Animated.spring(translateY, {
        toValue,
        useNativeDriver: false,
        bounciness: 0,
        speed: 18,
      }).start();
    },
    [translateY],
  );

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        startYRef.current = expandedRef.current ? 0 : sheetHeightRef.current;
        translateY.stopAnimation((value) => {
          startYRef.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const max = sheetHeightRef.current;
        const next = Math.min(Math.max(startYRef.current + gesture.dy, 0), max);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldCollapse = gesture.dy > 90 || gesture.vy > 0.6;
        if (shouldCollapse) {
          animateTo(sheetHeightRef.current);
          callbacksRef.current.onCollapse();
        } else {
          animateTo(0);
          callbacksRef.current.onExpand();
        }
      },
      onPanResponderTerminate: () => {
        animateTo(expandedRef.current ? 0 : sheetHeightRef.current);
      },
    }),
  ).current;

  const peekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy < -6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        startYRef.current = expandedRef.current ? 0 : sheetHeightRef.current;
        translateY.stopAnimation((value) => {
          startYRef.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const max = sheetHeightRef.current;
        const next = Math.min(Math.max(startYRef.current + gesture.dy, 0), max);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldExpand = gesture.dy < -60 || gesture.vy < -0.6;
        if (shouldExpand) {
          animateTo(0);
          callbacksRef.current.onExpand();
        } else {
          animateTo(sheetHeightRef.current);
          callbacksRef.current.onCollapse();
        }
      },
      onPanResponderTerminate: () => {
        animateTo(expandedRef.current ? 0 : sheetHeightRef.current);
      },
    }),
  ).current;

  useEffect(() => {
    setImageFailed(false);
  }, [card?.id]);

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [card?.id]);

  useEffect(() => {
    if (!card) return;

    const available = getAvailableFinishes(card);
    const isAvailable = (finish: CardFinish) =>
      available.length === 0 || available.includes(finish);

    const candidates: {
      finish: CardFinish;
      price: string | null;
    }[] = [
      { finish: 'normal', price: card.prices.usd },
      { finish: 'foil', price: card.prices.usd_foil },
      { finish: 'etched', price: card.prices.usd_etched },
    ];

    const firstWithPrice = candidates.find(
      (candidate) => isAvailable(candidate.finish) && candidate.price,
    );
    const firstAvailable = candidates.find((candidate) =>
      isAvailable(candidate.finish),
    );

    setSelectedFinish(
      firstWithPrice?.finish ?? firstAvailable?.finish ?? 'normal',
    );
  }, [card]);

  useEffect(() => {
    if (sheetHeight <= 0) return;
    animateTo(expanded ? 0 : sheetHeight);
  }, [expanded, sheetHeight, animateTo]);

  if (!card) {
    return null;
  }

  const availableFinishes = getAvailableFinishes(card);
  const isFinishAvailable = (finish: CardFinish) =>
    availableFinishes.length === 0 || availableFinishes.includes(finish);

  const finishes: FinishPriceItem[] = [
    {
      key: 'normal',
      label: 'Normal',
      usd: card.prices.usd,
      eur: card.prices.eur,
      available: isFinishAvailable('normal'),
    },
    {
      key: 'foil',
      label: 'Foil',
      usd: card.prices.usd_foil,
      eur: card.prices.eur_foil,
      available: isFinishAvailable('foil'),
    },
    {
      key: 'etched',
      label: 'Etched / Surge',
      usd: card.prices.usd_etched,
      eur: card.prices.eur_etched ?? null,
      available: isFinishAvailable('etched'),
    },
  ];

  const activeFinish =
    finishes.find(
      (finish) => finish.key === selectedFinish && finish.available,
    ) ??
    finishes.find((finish) => finish.available) ??
    finishes[0];
  const imageSource = getCardImageSource(card);
  const oracleText =
    card.oracle_text ??
    card.card_faces
      ?.map((face) => `${face.name}:\n${face.oracle_text ?? ''}`)
      .join('\n\n');

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, Math.max(sheetHeight, 1)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const peekOpacity = translateY.interpolate({
    inputRange: [
      Math.max(sheetHeight - peekHeight, 0),
      Math.max(sheetHeight, 1),
    ],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.overlay} pointerEvents='box-none'>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCollapse}
          accessible={false}
        />
      </Animated.View>

      <Animated.View
        pointerEvents={expanded ? 'none' : 'auto'}
        style={[
          styles.peek,
          {
            opacity: peekOpacity,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
        {...peekPanResponder.panHandlers}
      >
        <View style={styles.peekHandleZone}>
          <View style={styles.peekHandle} />
        </View>

        <Pressable
          style={styles.peekRow}
          onPress={onExpand}
          accessibilityRole='button'
          accessibilityLabel='Ver detalhes da última carta lida'
        >
          {imageSource && !imageFailed ? (
            <Image
              source={imageSource}
              style={styles.peekImage}
              resizeMode='cover'
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[styles.peekImage, styles.peekImagePlaceholder]}>
              <Text style={styles.peekPlaceholderText}>?</Text>
            </View>
          )}

          <View style={styles.peekInfo}>
            <Text style={styles.peekName} numberOfLines={1}>
              {card.printed_name ?? card.name}
            </Text>
            <Text style={styles.peekMeta} numberOfLines={1}>
              {card.set.toUpperCase()} #{card.collector_number} •{' '}
              {activeFinish.label} •{' '}
              {activeFinish.usd ? `US$ ${activeFinish.usd}` : 'Sem cotação'}
            </Text>
          </View>

          <Text style={styles.peekChevron}>▲</Text>
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={expanded ? 'auto' : 'none'}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height === sheetHeightRef.current) return;
          sheetHeightRef.current = height;
          setSheetHeight(height);
        }}
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 16,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handleZone} {...sheetPanResponder.panHandlers}>
          <Pressable
            style={styles.handleButton}
            onPress={onCollapse}
            accessibilityRole='button'
            accessibilityState={{ expanded }}
            accessibilityLabel='Recolher detalhes da carta'
          >
            <View style={styles.handle} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.sheetScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Cabeçalho da carta */}
          <View style={styles.headerRow}>
            {imageSource && !imageFailed ? (
              <Image
                source={imageSource}
                style={styles.cardImage}
                resizeMode='contain'
                onError={(event) => {
                  setImageFailed(true);
                  console.warn(
                    '[card-image] falha ao carregar',
                    event.nativeEvent.error,
                  );
                }}
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
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setSelectedFinish(item.key)}
                  disabled={!item.available}
                  style={[
                    styles.finishCard,
                    isSelected && styles.finishCardSelected,
                    !item.available && styles.finishCardDisabled,
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

          {activeListName && onAddToList ? (
            <AddToListSection
              key={`${card.id}:${activeFinish.key}`}
              listName={activeListName}
              finishLabel={activeFinish.label}
              unitPriceLabel={
                activeFinish.usd
                  ? formatUsdCents(parseUsdToCents(activeFinish.usd))
                  : 'Sem cotação'
              }
              existingQuantity={existingQuantities?.[activeFinish.key] ?? 0}
              onAdd={(quantity) =>
                onAddToList({
                  finish: activeFinish.key,
                  quantity,
                })
              }
              onSkip={onSkipCard ?? onCollapse}
            />
          ) : null}

          {/* Texto Oracle / Regras */}
          {oracleText ? (
            <View style={styles.oracleBox}>
              <Text style={styles.oracleTitle}>Texto da Carta (Oracle)</Text>
              <Text style={styles.oracleText}>{oracleText}</Text>
            </View>
          ) : null}
        </ScrollView>

        <Pressable style={styles.closeButton} onPress={onCollapse}>
          <Text style={styles.closeButtonText}>Recolher</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  peek: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    zIndex: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  peekHandleZone: {
    height: CARD_PEEK_HANDLE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  peekRow: {
    height: CARD_PEEK_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peekImage: {
    width: 40,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  peekImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekPlaceholderText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '700',
  },
  peekInfo: {
    flex: 1,
  },
  peekName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  peekMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  peekChevron: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '86%',
    borderTopWidth: 1,
    borderColor: '#334155',
    zIndex: 30,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetScroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  handleZone: {
    height: 44,
  },
  handleButton: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#334155',
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '700',
  },
});
