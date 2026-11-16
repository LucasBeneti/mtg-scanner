import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFxRate } from '../../hooks/useFxRate';
import { useMoney } from '../../hooks/useMoney';
import type { CardListItem } from '../../types/list';
import type { Currency } from '../../types/currency';
import { formatShortDate } from '../../utils/datetime';
import { getFinishLabel } from '../../utils/finish';
import { convertUsdCentsToBrlCents } from '../../utils/money';
import {
  formatCentsForInput,
  MAX_PRICE_OVERRIDE_NOTE_LENGTH,
  normalizePriceOverrideNote,
  parsePriceInputToUsdCents,
} from '../../utils/priceOverride';

interface PriceOverrideModalProps {
  item: CardListItem;
  onClose: () => void;
  onSubmit: (priceUsdCents: number, note: string | null) => Promise<void>;
  onRequestRemove: () => void;
}

export function PriceOverrideModal({
  item,
  onClose,
  onSubmit,
  onRequestRemove,
}: PriceOverrideModalProps) {
  const insets = useSafeAreaInsets();
  const fx = useFxRate();
  const { format, formatLineTotal } = useMoney();

  const inputCurrency: Currency =
    fx.currency === 'BRL' && fx.rate ? 'BRL' : 'USD';
  const hasOverride = item.priceOverrideUsdCents != null;
  const basePriceUsdCents =
    item.priceOverrideUsdCents ??
    item.currentPriceUsdCents ??
    item.entryPriceUsdCents;

  const [priceText, setPriceText] = useState(() => {
    if (basePriceUsdCents == null) return '';

    if (inputCurrency === 'BRL' && fx.rate) {
      return formatCentsForInput(
        convertUsdCentsToBrlCents(basePriceUsdCents, fx.rate.rateMicros),
      );
    }

    return formatCentsForInput(basePriceUsdCents);
  });
  const [note, setNote] = useState(item.priceOverrideNote ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewUsdCents = useMemo(() => {
    if (!priceText.trim()) return null;

    try {
      return parsePriceInputToUsdCents(priceText, {
        currency: inputCurrency,
        rateMicros: fx.rate?.rateMicros ?? null,
      });
    } catch {
      return null;
    }
  }, [priceText, inputCurrency, fx.rate]);

  const displayName = item.snapshot.printedName ?? item.snapshot.name;
  const editedAt = formatShortDate(item.priceOverrideUpdatedAt);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      const priceUsdCents = parsePriceInputToUsdCents(priceText, {
        currency: inputCurrency,
        rateMicros: fx.rate?.rateMicros ?? null,
      });
      const normalizedNote = normalizePriceOverrideNote(note);

      setErrorMessage(null);
      setIsSubmitting(true);

      await onSubmit(priceUsdCents, normalizedNote);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar o preço.',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType='fade'
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={[
            styles.backdrop,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            disabled={isSubmitting}
            accessible={false}
          />

          <View style={styles.card}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps='handled'
            >
              <Text style={styles.title}>Editar preço</Text>
              <Text style={styles.cardName} numberOfLines={2}>
                {displayName}
              </Text>
              <Text style={styles.cardMeta}>
                {item.setCode.toUpperCase()} #{item.collectorNumber} ·{' '}
                {getFinishLabel(item.finish)}
              </Text>

              <View style={styles.referenceBox}>
                <View style={styles.referenceRow}>
                  <Text style={styles.referenceLabel}>Mercado</Text>
                  <Text style={styles.referenceValue}>
                    {item.currentPriceUsdCents == null
                      ? 'Sem cotação'
                      : `${format(item.currentPriceUsdCents)} / un.`}
                  </Text>
                </View>

                <View style={styles.referenceRow}>
                  <Text style={styles.referenceLabel}>Entrada</Text>
                  <Text style={styles.referenceValue}>
                    {item.entryPriceUsdCents == null
                      ? '—'
                      : `${format(item.entryPriceUsdCents)} / un.`}
                  </Text>
                </View>

                {hasOverride && editedAt ? (
                  <View style={styles.referenceRow}>
                    <Text style={styles.referenceLabel}>Última edição</Text>
                    <Text style={styles.referenceValue}>{editedAt}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.fieldLabel}>
                Preço unitário ({inputCurrency === 'BRL' ? 'R$' : 'US$'})
              </Text>

              <View style={styles.priceInputRow}>
                <Text style={styles.pricePrefix}>
                  {inputCurrency === 'BRL' ? 'R$' : 'US$'}
                </Text>
                <TextInput
                  style={styles.priceInput}
                  value={priceText}
                  onChangeText={(text) => {
                    setPriceText(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder='0,00'
                  placeholderTextColor='#64748B'
                  selectionColor='#38BDF8'
                  keyboardType='decimal-pad'
                  inputMode='decimal'
                  autoFocus
                  editable={!isSubmitting}
                  onSubmitEditing={() => void handleSubmit()}
                  accessibilityLabel='Preço unitário'
                />
              </View>

              <Text style={styles.helperText}>
                Vale para todas as {item.quantity}{' '}
                {item.quantity === 1 ? 'cópia' : 'cópias'} deste item.
                {inputCurrency === 'BRL'
                  ? ' Convertido para US$ pela cotação atual.'
                  : ''}
              </Text>

              {previewUsdCents != null ? (
                <Text style={styles.previewText}>
                  {item.quantity} × {format(previewUsdCents)} ={' '}
                  {formatLineTotal(previewUsdCents, item.quantity)}
                </Text>
              ) : null}

              <Text style={styles.fieldLabel}>Observação (opcional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => {
                  setNote(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder='Ex: preço de foil antigo na LigaMagic'
                placeholderTextColor='#64748B'
                selectionColor='#38BDF8'
                maxLength={MAX_PRICE_OVERRIDE_NOTE_LENGTH}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
                accessibilityLabel='Observação do preço'
              />
              <Text style={styles.noteCounter}>
                {note.length}/{MAX_PRICE_OVERRIDE_NOTE_LENGTH}
              </Text>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  disabled={isSubmitting}
                  accessibilityRole='button'
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, styles.confirmButton]}
                  onPress={() => void handleSubmit()}
                  disabled={isSubmitting}
                  accessibilityRole='button'
                  accessibilityState={{ disabled: isSubmitting }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size='small' color='#0F172A' />
                  ) : (
                    <Text style={styles.confirmButtonText}>Salvar</Text>
                  )}
                </Pressable>
              </View>

              {hasOverride ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={onRequestRemove}
                  disabled={isSubmitting}
                  accessibilityRole='button'
                  accessibilityLabel='Remover preço manual'
                  hitSlop={6}
                >
                  <Text style={styles.removeButtonText}>
                    Remover preço manual
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    padding: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  cardName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  cardMeta: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  referenceBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  referenceLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  referenceValue: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
  },
  pricePrefix: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 12,
  },
  helperText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  previewText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  noteCounter: {
    alignSelf: 'flex-end',
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    backgroundColor: '#38BDF8',
  },
  confirmButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  removeButton: {
    alignSelf: 'center',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  removeButtonText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },
});
