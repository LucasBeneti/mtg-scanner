import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CurrencyToggle } from '../components/CurrencyToggle';
import { ConfirmDialog } from '../components/list/ConfirmDialog';
import { ListItemRow } from '../components/list/ListItemRow';
import { ListNameModal } from '../components/list/ListNameModal';
import { PriceOverrideModal } from '../components/list/PriceOverrideModal';
import { useFxRate } from '../hooks/useFxRate';
import { useListDetail } from '../hooks/useListDetail';
import { useMoney } from '../hooks/useMoney';
import { track } from '../services/analytics';
import {
  clearItemPriceOverride,
  decrementItemQuantity,
  deleteList,
  incrementItemQuantity,
  removeListItem,
  renameList,
  setItemPriceOverride,
} from '../services/listsRepository';
import {
  formatPriceRefreshResult,
  refreshListPrices,
  type PriceRefreshResult,
} from '../services/priceRefresh';
import type { CardListItem } from '../types/list';
import { formatRelativeUpdateTime } from '../utils/datetime';
import { formatRateDate, formatRateMicros } from '../utils/money';

interface ListDetailScreenProps {
  listId: number | null;
}

/** "Atualizado há 3h" -> "há 3h", para compor a linha da cotação. */
function rateAgeLabel(fetchedAt: number): string {
  return formatRelativeUpdateTime(fetchedAt).replace('Atualizado ', '');
}

export function ListDetailScreen({ listId }: ListDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { detail, isLoading, error, reload } = useListDetail(listId);
  const { format } = useMoney();
  const fx = useFxRate();
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CardListItem | null>(null);
  const [itemToEditPrice, setItemToEditPrice] = useState<CardListItem | null>(
    null,
  );
  const [itemToClearOverride, setItemToClearOverride] =
    useState<CardListItem | null>(null);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [refreshResult, setRefreshResult] = useState<PriceRefreshResult | null>(
    null,
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const handleIncrement = useCallback(
    async (itemId: number) => {
      if (pendingItemId != null) return;

      setPendingItemId(itemId);
      setActionError(null);

      try {
        await incrementItemQuantity(itemId);

        const item = detail?.items.find((candidate) => candidate.id === itemId);
        if (item) {
          track('list item quantity changed', {
            direction: 'increment',
            finish: item.finish,
            quantity_before: item.quantity,
          });
        }

        await reload();
      } catch (updateError) {
        console.warn('[lists] falha ao aumentar quantidade', updateError);
        setActionError('Não foi possível atualizar a quantidade.');
      } finally {
        setPendingItemId(null);
      }
    },
    [detail, pendingItemId, reload],
  );

  const handleDecrement = useCallback(
    async (itemId: number) => {
      if (pendingItemId != null) return;

      setPendingItemId(itemId);
      setActionError(null);

      try {
        await decrementItemQuantity(itemId);

        const item = detail?.items.find((candidate) => candidate.id === itemId);
        if (item) {
          track('list item quantity changed', {
            direction: 'decrement',
            finish: item.finish,
            quantity_before: item.quantity,
          });
        }

        await reload();
      } catch (updateError) {
        console.warn('[lists] falha ao diminuir quantidade', updateError);
        setActionError('Não foi possível atualizar a quantidade.');
      } finally {
        setPendingItemId(null);
      }
    },
    [detail, pendingItemId, reload],
  );

  const handleRemoveRequest = useCallback(
    (itemId: number) => {
      const item = detail?.items.find((candidate) => candidate.id === itemId);

      if (item) {
        setItemToRemove(item);
      }
    },
    [detail],
  );

  const handleEditPriceRequest = useCallback(
    (itemId: number) => {
      const item = detail?.items.find((candidate) => candidate.id === itemId);

      if (item) {
        setItemToEditPrice(item);
      }
    },
    [detail],
  );

  const handleRefresh = async () => {
    if (!detail || isRefreshing || detail.items.length === 0) {
      return;
    }

    setIsRefreshing(true);
    setRefreshProgress({ processed: 0, total: 0 });
    setRefreshResult(null);
    setRefreshError(null);

    const startedAt = Date.now();

    try {
      const result = await refreshListPrices(detail.id, detail.items, {
        onProgress: (processed, total) =>
          setRefreshProgress({ processed, total }),
      });

      setRefreshResult(result);

      track('prices refreshed', {
        list_id: detail.id,
        item_count: detail.items.length,
        updated_count: result.updatedCount,
        no_price_count: result.noPriceCount,
        not_found_count: result.notFoundCount,
        failed_count: result.failedCount,
        duration_ms: Date.now() - startedAt,
      });

      await reload();
    } catch (refreshFailure) {
      console.warn('[lists] falha ao atualizar preços', refreshFailure);
      track('prices refresh failed', {
        list_id: detail.id,
        item_count: detail.items.length,
        error_kind: 'unknown',
      });
      setRefreshError('Não foi possível atualizar os preços.');
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const countLabel =
    detail == null
      ? ''
      : detail.cardCount === 1
        ? '1 carta'
        : `${detail.cardCount} cartas`;

  const rateReference = fx.rate ? formatRateDate(fx.rate.rateDate) : null;
  const rateMeta = fx.rate
    ? `R$ ${formatRateMicros(fx.rate.rateMicros)} · ${
        rateReference
          ? `ref. ${rateReference}`
          : rateAgeLabel(fx.rate.fetchedAt)
      }${fx.isStale ? ' (desatualizada)' : ''}`
    : null;
  const canToggleCurrency = fx.isAvailable || fx.error == null;

  if (isLoading || error || detail == null) {
    return (
      <View style={styles.container}>
        <StatusBar style='light' />
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={handleGoBack}
            accessibilityRole='button'
            accessibilityLabel='Voltar'
          >
            <Text style={styles.backButtonText}>‹ Voltar</Text>
          </Pressable>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size='small' color='#38BDF8' />
              <Text style={styles.stateText}>Carregando lista...</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => void reload()}
                accessibilityRole='button'
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stateCard}>
              <Text style={styles.emptyTitle}>
                {listId == null ? 'Lista inválida' : 'Lista não encontrada'}
              </Text>
              <Text style={styles.emptyText}>
                {listId == null
                  ? 'O identificador da lista é inválido.'
                  : 'Ela pode ter sido excluída.'}
              </Text>
              <Pressable
                style={styles.retryButton}
                onPress={handleGoBack}
                accessibilityRole='button'
              >
                <Text style={styles.retryButtonText}>Voltar</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style='light' />

      <FlatList
        data={detail.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ListItemRow
            item={item}
            isPending={pendingItemId === item.id}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemoveRequest}
            onEditPrice={handleEditPriceRequest}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListHeaderComponent={
          <View>
            <Pressable
              style={styles.backButton}
              onPress={handleGoBack}
              accessibilityRole='button'
              accessibilityLabel='Voltar'
            >
              <Text style={styles.backButtonText}>‹ Voltar</Text>
            </Pressable>

            <Text style={styles.title}>{detail.name}</Text>
            <Text style={styles.subtitle}>{countLabel}</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>VALOR ESTIMADO</Text>
              <Text style={styles.summaryValue}>
                {format(detail.estimatedValueUsdCents)}
              </Text>
              <Text style={styles.summaryMeta}>{countLabel} nesta lista</Text>

              <View style={styles.currencyRow}>
                <CurrencyToggle
                  value={fx.currency}
                  onChange={fx.setCurrency}
                  disabled={!canToggleCurrency}
                  isLoading={fx.isLoading}
                />
              </View>

              {fx.currency === 'BRL' && rateMeta ? (
                <>
                  <View style={styles.rateRow}>
                    <Text style={styles.rateMeta}>{rateMeta}</Text>
                    <Pressable
                      style={styles.rateRefreshButton}
                      onPress={() => void fx.refresh()}
                      disabled={fx.isRefreshing}
                      accessibilityRole='button'
                      accessibilityLabel='Atualizar cotação'
                      hitSlop={6}
                    >
                      {fx.isRefreshing ? (
                        <ActivityIndicator size='small' color='#38BDF8' />
                      ) : (
                        <Text style={styles.rateRefreshText}>Atualizar</Text>
                      )}
                    </Pressable>
                  </View>
                  <Text style={styles.rateDisclaimer}>
                    Conversão de referência · não inclui IOF
                  </Text>
                </>
              ) : null}

              {!fx.isAvailable && fx.error ? (
                <View style={styles.rateErrorRow}>
                  <Text style={styles.rateErrorText}>{fx.error}</Text>
                  <Pressable
                    onPress={() => fx.setCurrency('BRL')}
                    accessibilityRole='button'
                    accessibilityLabel='Tentar buscar a cotação novamente'
                    hitSlop={6}
                  >
                    <Text style={styles.rateRetryText}>Tentar novamente</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.refreshRow}>
              <Pressable
                style={[
                  styles.refreshButton,
                  (isRefreshing || detail.items.length === 0) &&
                    styles.refreshButtonDisabled,
                ]}
                onPress={() => void handleRefresh()}
                disabled={isRefreshing || detail.items.length === 0}
                accessibilityRole='button'
                accessibilityLabel='Atualizar preços da lista'
              >
                {isRefreshing ? (
                  <ActivityIndicator size='small' color='#38BDF8' />
                ) : (
                  <Text style={styles.refreshButtonText}>Atualizar preços</Text>
                )}
              </Pressable>

              <Text style={styles.refreshMeta}>
                {isRefreshing
                  ? refreshProgress && refreshProgress.total > 0
                    ? `Atualizando ${refreshProgress.processed}/${refreshProgress.total}...`
                    : 'Preparando...'
                  : formatRelativeUpdateTime(detail.lastRefreshedAt)}
              </Text>
            </View>

            {refreshResult ? (
              <Text style={styles.refreshSummary}>
                {formatPriceRefreshResult(refreshResult)}
              </Text>
            ) : null}

            {refreshError ? (
              <Text style={styles.refreshErrorText}>{refreshError}</Text>
            ) : null}

            <Pressable
              style={styles.addCardsPrimaryButton}
              onPress={() => {
                track('scanner opened', {
                  source: 'list_detail',
                  list_id: detail.id,
                });
                router.push({
                  pathname: '/scan',
                  params: { listId: String(detail.id) },
                });
              }}
              accessibilityRole='button'
              accessibilityLabel='Adicionar cartas a esta lista'
            >
              <Text style={styles.addCardsPrimaryButtonText}>
                Adicionar cartas
              </Text>
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionButton}
                onPress={() => setIsRenameOpen(true)}
                accessibilityRole='button'
              >
                <Text style={styles.actionButtonText}>Renomear</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => setIsDeleteOpen(true)}
                accessibilityRole='button'
              >
                <Text style={styles.deleteButtonText}>Excluir lista</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Cartas</Text>
              <Text style={styles.sectionMeta}>{countLabel}</Text>
            </View>

            {actionError ? (
              <Text style={styles.actionErrorText}>{actionError}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma carta nesta lista</Text>
            <Text style={styles.emptyText}>
              Toque em “Adicionar cartas” para escanear e registrar cartas nesta
              lista.
            </Text>
          </View>
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {isRenameOpen && detail ? (
        <ListNameModal
          title='Renomear lista'
          confirmLabel='Salvar'
          initialValue={detail.name}
          onClose={() => setIsRenameOpen(false)}
          onSubmit={async (name) => {
            await renameList(detail.id, name);
            track('list renamed', { list_id: detail.id });
            setIsRenameOpen(false);
            await reload();
          }}
        />
      ) : null}

      {isDeleteOpen && detail ? (
        <ConfirmDialog
          title='Excluir lista'
          message={`Excluir a lista "${detail.name}"? Ela tem ${countLabel}. Essa ação não pode ser desfeita.`}
          confirmLabel='Excluir'
          destructive
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={async () => {
            await deleteList(detail.id);
            track('list deleted', {
              list_id: detail.id,
              card_count: detail.cardCount,
              age_days: Math.max(
                0,
                Math.floor((Date.now() - detail.createdAt) / 86_400_000),
              ),
            });
            handleGoBack();
          }}
        />
      ) : null}

      {itemToRemove ? (
        <ConfirmDialog
          title='Remover carta'
          message={`Remover ${itemToRemove.quantity} ${
            itemToRemove.quantity === 1 ? 'cópia' : 'cópias'
          } de "${
            itemToRemove.snapshot.printedName ?? itemToRemove.snapshot.name
          }" da lista?`}
          confirmLabel='Remover'
          destructive
          onCancel={() => setItemToRemove(null)}
          onConfirm={async () => {
            await removeListItem(itemToRemove.id);
            track('list item removed', {
              finish: itemToRemove.finish,
              quantity: itemToRemove.quantity,
            });
            setItemToRemove(null);
            setActionError(null);
            await reload();
          }}
        />
      ) : null}

      {itemToEditPrice ? (
        <PriceOverrideModal
          item={itemToEditPrice}
          onClose={() => setItemToEditPrice(null)}
          onRequestRemove={() => {
            setItemToClearOverride(itemToEditPrice);
            setItemToEditPrice(null);
          }}
          onSubmit={async (priceUsdCents, note) => {
            const previousPrice =
              itemToEditPrice.currentPriceUsdCents ??
              itemToEditPrice.entryPriceUsdCents;

            await setItemPriceOverride({
              itemId: itemToEditPrice.id,
              priceUsdCents,
              note,
              now: Date.now(),
            });

            track('list item price overridden', {
              list_id: detail.id,
              finish: itemToEditPrice.finish,
              had_override: itemToEditPrice.priceOverrideUsdCents != null,
              has_note: note != null,
              price_delta_cents:
                previousPrice == null ? null : priceUsdCents - previousPrice,
            });

            setItemToEditPrice(null);
            setActionError(null);
            await reload();
          }}
        />
      ) : null}

      {itemToClearOverride ? (
        <ConfirmDialog
          title='Remover preço manual'
          message={`Remover o preço manual de ${itemToClearOverride.quantity} ${
            itemToClearOverride.quantity === 1 ? 'cópia' : 'cópias'
          } de "${
            itemToClearOverride.snapshot.printedName ??
            itemToClearOverride.snapshot.name
          }"? A observação será apagada e o item volta a usar a cotação da API.`}
          confirmLabel='Remover'
          destructive
          onCancel={() => setItemToClearOverride(null)}
          onConfirm={async () => {
            await clearItemPriceOverride(itemToClearOverride.id);

            track('list item price override cleared', {
              list_id: detail.id,
              finish: itemToClearOverride.finish,
            });

            setItemToClearOverride(null);
            setActionError(null);
            await reload();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 20,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: '#4ADE80',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  currencyRow: {
    marginTop: 14,
  },
  rateRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  rateMeta: {
    flex: 1,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  rateRefreshButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  rateRefreshText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  rateDisclaimer: {
    alignSelf: 'stretch',
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  rateErrorRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  rateErrorText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '600',
  },
  rateRetryText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  refreshButton: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 138,
    alignItems: 'center',
  },
  refreshButtonDisabled: {
    opacity: 0.4,
  },
  refreshButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  refreshMeta: {
    flex: 1,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  refreshSummary: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  refreshErrorText: {
    color: '#F87171',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  addCardsPrimaryButton: {
    borderRadius: 14,
    backgroundColor: '#38BDF8',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  addCardsPrimaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  deleteButtonText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionMeta: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  actionErrorText: {
    color: '#F87171',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  stateCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  retryButtonText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  itemSeparator: {
    height: 8,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 18,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
});
