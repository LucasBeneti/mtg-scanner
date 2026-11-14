import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListPreviewCard } from '../components/list/ListPreviewCard';
import { useListSummaries } from '../hooks/useListSummaries';

export function AllListsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { summaries, isLoading, error, reload } = useListSummaries();

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

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
          accessibilityLabel='Voltar para a tela inicial'
        >
          <Text style={styles.backButtonText}>‹ Início</Text>
        </Pressable>

        <Text style={styles.title}>Todas as listas</Text>
        <Text style={styles.subtitle}>
          {summaries.length === 1
            ? '1 lista salva neste aparelho'
            : `${summaries.length} listas salvas neste aparelho`}
        </Text>

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
              Volte para a Home para criar sua primeira lista.
            </Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {summaries.map((summary) => (
              <ListPreviewCard
                key={summary.id}
                summary={summary}
                onPress={() =>
                  router.push({
                    pathname: '/lists/[id]',
                    params: { id: String(summary.id) },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
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
