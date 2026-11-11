import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseManualInput } from '../services/collectorParser';
import type { ParsedCollectorInfo } from '../types/card';

interface ManualFallbackModalProps {
  visible: boolean;
  reasonMessage?: string | null;
  onClose: () => void;
  onSubmit: (parsed: ParsedCollectorInfo) => void;
}

export function ManualFallbackModal({
  visible,
  reasonMessage,
  onClose,
  onSubmit,
}: ManualFallbackModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    const parsed = parseManualInput(inputValue);
    if (!parsed) {
      setValidationError(
        'Digite a sigla da edição (3-4 letras) e o número. Ex: FDN 125 ou BLB 64'
      );
      return;
    }
    setValidationError(null);
    setInputValue('');
    onSubmit(parsed);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Busca Manual por Código</Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>
              Por que a leitura automática pode não funcionar?
            </Text>
            <Text style={styles.reasonText}>
              {reasonMessage ??
                '• Reflexo forte em cartas Foil ou sleeve brilhante\n• Cartas antigas (pré-2015) sem sigla de 3 letras no rodapé\n• Pouca iluminação ou foco ainda ajustando'}
            </Text>
          </View>

          <Text style={styles.inputLabel}>
            Código da Edição + Número do Colecionador
          </Text>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={(text) => {
              setInputValue(text);
              if (validationError) setValidationError(null);
            }}
            placeholder="Ex: FDN 125 ou BLB 64"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus={true}
            onSubmitEditing={handleConfirm}
          />

          {validationError ? (
            <Text style={styles.errorText}>{validationError}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Voltar à câmera</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={handleConfirm}>
              <Text style={styles.submitButtonText}>Buscar Preço</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#FACC15',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  reasonTitle: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  reasonText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  inputLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#475569',
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
});
