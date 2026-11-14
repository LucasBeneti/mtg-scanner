import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
            styles.scanButton,
            pressed && styles.scanButtonPressed,
          ]}
          onPress={() => router.push('/scan')}
          accessibilityRole='button'
          accessibilityLabel='Escanear cartas sem uma lista'
        >
          <Text style={styles.scanButtonText}>Escanear agora</Text>
          <Text style={styles.scanButtonHint}>Consulta rápida, sem lista</Text>
        </Pressable>

        <View style={styles.newListRow}>
          <Pressable
            style={[styles.newListButton, styles.newListButtonDisabled]}
            disabled
            accessibilityRole='button'
            accessibilityState={{ disabled: true }}
            accessibilityLabel='Criar nova lista, disponível em breve'
          >
            <Text style={styles.newListButtonText}>Nova lista</Text>
          </Pressable>
          <Text style={styles.comingSoonBadge}>EM BREVE</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Listas recentes</Text>
        </View>

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>
            Suas listas vão aparecer aqui
          </Text>
          <Text style={styles.placeholderText}>
            Na próxima fase você poderá criar listas, escanear cartas para
            dentro delas e acompanhar os preços.
          </Text>
        </View>
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
  header: {
    marginBottom: 28,
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
  scanButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
  },
  scanButtonPressed: {
    opacity: 0.85,
  },
  scanButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  scanButtonHint: {
    color: 'rgba(15, 23, 42, 0.65)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  newListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  newListButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    alignItems: 'center',
  },
  newListButtonDisabled: {
    opacity: 0.55,
  },
  newListButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  comingSoonBadge: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
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
  placeholderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    padding: 18,
  },
  placeholderTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
});
