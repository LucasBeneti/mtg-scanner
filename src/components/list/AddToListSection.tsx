import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface AddToListSectionProps {
  listName: string;
  finishLabel: string;
  unitPriceLabel: string;
  existingQuantity: number;
  onAdd: (quantity: number) => Promise<void>;
  onSkip: () => void;
}

const MAX_QUANTITY = 99;

export function AddToListSection({
  listName,
  finishLabel,
  unitPriceLabel,
  existingQuantity,
  onAdd,
  onSkip,
}: AddToListSectionProps) {
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAdd = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onAdd(quantity);
      setQuantity(1);
      setIsSubmitting(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível adicionar a carta à lista.',
      );
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setQuantity(1);
    setErrorMessage(null);
    onSkip();
  };

  const decrement = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increment = () => {
    setQuantity((current) => Math.min(MAX_QUANTITY, current + 1));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Adicionar à lista</Text>
      <Text style={styles.listName} numberOfLines={1}>
        {listName}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{finishLabel}</Text>
        <Text style={styles.metaText}>{unitPriceLabel} / cópia</Text>
      </View>

      {existingQuantity > 0 ? (
        <Text style={styles.existingText}>
          Já na lista: {existingQuantity}. Adicionar vai somar à quantidade
          existente.
        </Text>
      ) : null}

      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantidade</Text>

        <View style={styles.stepper}>
          <Pressable
            style={[
              styles.stepperButton,
              (quantity === 1 || isSubmitting) && styles.stepperButtonDisabled,
            ]}
            onPress={decrement}
            disabled={quantity === 1 || isSubmitting}
            accessibilityRole='button'
            accessibilityLabel='Diminuir quantidade'
            hitSlop={8}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>

          <Text style={styles.quantityValue}>{quantity}</Text>

          <Pressable
            style={[
              styles.stepperButton,
              (quantity === MAX_QUANTITY || isSubmitting) &&
                styles.stepperButtonDisabled,
            ]}
            onPress={increment}
            disabled={quantity === MAX_QUANTITY || isSubmitting}
            accessibilityRole='button'
            accessibilityLabel='Aumentar quantidade'
            hitSlop={8}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.addButton}
          onPress={() => void handleAdd()}
          disabled={isSubmitting}
          accessibilityRole='button'
          accessibilityLabel='Adicionar à lista'
          accessibilityState={{ disabled: isSubmitting }}
        >
          {isSubmitting ? (
            <ActivityIndicator size='small' color='#0F172A' />
          ) : (
            <Text style={styles.addButtonText}>Adicionar</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isSubmitting}
          accessibilityRole='button'
        >
          <Text style={styles.skipButtonText}>Pular</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    padding: 14,
    marginBottom: 16,
  },
  title: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  listName: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  metaText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  existingText: {
    color: '#FACC15',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  quantityLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperButtonText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  quantityValue: {
    minWidth: 24,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  addButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  skipButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
});
