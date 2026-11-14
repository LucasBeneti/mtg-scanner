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
import { ListNameModal } from '../components/list/ListNameModal';
import { ListPreviewCard } from '../components/list/ListPreviewCard';
import { useListSummaries } from '../hooks/useListSummaries';
import { createList } from '../services/listsRepository';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { summaries, isLoading, error, reload } = useListSummaries(3);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const openList = (listId: number) => {
    router.push({
      pathname: '/lists/[id]',
      params: { id: String(listId) },
    });
  };

  const openScannerForList = (listId: number) => {
    router.push({
      pathname: '/scan',
      params: { listId: String(listId) },
    });
  };

  const handleCreateList = async (name: string) => {
    const list = await createList(name);
    setIsCreateModalOpen(false);
    openScannerForList(list.id);
  };

  return (
    <View style={styles.container}>
      <StatusBar style='light' />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MTG SCANNER</Text>
          </View>
          <Text style={styles.title}>Minhas listas</Text>
          <Text style={styles.subtitle}>
            Organize as cartas que você já escaneou e acompanhe o valor da sua
            coleção.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={() => setIsCreateModalOpen(true)}
          accessibilityRole='button'
          accessibilityLabel='Criar nova lista'
        >
          <Text style={styles.primaryButtonText}>Nova lista</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
          onPress={() => router.push('/scan')}
          accessibilityRole='button'
          accessibilityLabel='Escanear cartas sem uma lista'
        >
          <Text style={styles.secondaryButtonText}>Escanear agora</Text>
          <Text style={styles.secondaryButtonHint}>
            Consulta rápida, sem lista
          </Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Listas recentes</Text>
          {summaries.length > 0 ? (
            <Pressable
              onPress={() => router.push('/lists')}
              accessibilityRole='button'
              accessibilityLabel='Ver todas as listas'
            >
              <Text style={styles.sectionLink}>Ver todas</Text>
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size='small' color='#38BDF8' />
            <Text style={styles.stateText}>Carregando listas...</Text>
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
        ) : summaries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma lista ainda</Text>
            <Text style={styles.emptyText}>
              Crie sua primeira lista para organizar as cartas que você
              escanear.
            </Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {summaries.map((summary) => (
              <ListPreviewCard
                key={summary.id}
                summary={summary}
                onPress={() => openList(summary.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {isCreateModalOpen ? (
        <ListNameModal
          title='Nova lista'
          confirmLabel='Criar'
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateList}
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
  header: {
    marginBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  badgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 28,
  },
  secondaryButtonPressed: {
    opacity: 0.78,
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButtonHint: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
  sectionLink: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  listStack: {
    gap: 10,
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
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
