import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDialog } from '../components/list/ConfirmDialog';
import { ListItemRow } from '../components/list/ListItemRow';
import { ListNameModal } from '../components/list/ListNameModal';
import { useListDetail } from '../hooks/useListDetail';
import {
  decrementItemQuantity,
  deleteList,
  incrementItemQuantity,
  removeListItem,
  renameList,
} from '../services/listsRepository';
import type { CardListItem } from '../types/list';
import { formatUsdCents } from '../utils/money';

interface ListDetailScreenProps {
  listId: number | null;
}

export function ListDetailScreen({ listId }: ListDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { detail, isLoading, error, reload } = useListDetail(listId);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<CardListItem | null>(null);
  const [pendingItemId, setPendingItemId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  const handleIncrement = async (item: CardListItem) => {
    if (pendingItemId != null) return;

    setPendingItemId(item.id);
    setActionError(null);

    try {
      await incrementItemQuantity(item.id);
      await reload();
    } catch (updateError) {
      console.warn('[lists] falha ao aumentar quantidade', updateError);
      setActionError('Não foi possível atualizar a quantidade.');
    } finally {
      setPendingItemId(null);
    }
  };

  const handleDecrement = async (item: CardListItem) => {
    if (pendingItemId != null) return;

    setPendingItemId(item.id);
    setActionError(null);

    try {
      await decrementItemQuantity(item.id);
      await reload();
    } catch (updateError) {
      console.warn('[lists] falha ao diminuir quantidade', updateError);
      setActionError('Não foi possível atualizar a quantidade.');
    } finally {
      setPendingItemId(null);
    }
  };

  const countLabel =
    detail == null
      ? ''
      : detail.cardCount === 1
        ? '1 carta'
        : `${detail.cardCount} cartas`;

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
        ) : detail == null ? (
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
        ) : (
          <>
            <Text style={styles.title}>{detail.name}</Text>
            <Text style={styles.subtitle}>{countLabel}</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>VALOR ESTIMADO</Text>
              <Text style={styles.summaryValue}>
                {formatUsdCents(detail.estimatedValueUsdCents)}
              </Text>
              <Text style={styles.summaryMeta}>{countLabel} nesta lista</Text>
            </View>

            <Pressable
              style={styles.addCardsPrimaryButton}
              onPress={() =>
                router.push({
                  pathname: '/scan',
                  params: { listId: String(detail.id) },
                })
              }
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

            {detail.items.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Nenhuma carta nesta lista</Text>
                <Text style={styles.emptyText}>
                  Toque em “Adicionar cartas” para escanear e registrar cartas
                  nesta lista.
                </Text>
              </View>
            ) : (
              <View style={styles.itemsStack}>
                {detail.items.map((item) => (
                  <ListItemRow
                    key={item.id}
                    item={item}
                    isPending={pendingItemId === item.id}
                    onIncrement={() => void handleIncrement(item)}
                    onDecrement={() => void handleDecrement(item)}
                    onRemove={() => setItemToRemove(item)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isRenameOpen && detail ? (
        <ListNameModal
          title='Renomear lista'
          confirmLabel='Salvar'
          initialValue={detail.name}
          onClose={() => setIsRenameOpen(false)}
          onSubmit={async (name) => {
            await renameList(detail.id, name);
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
            setItemToRemove(null);
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
  itemsStack: {
    gap: 8,
  },
});
