import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_LIST_NAME_LENGTH, normalizeListName } from '../../utils/listName';

interface ListNameModalProps {
  title: string;
  confirmLabel: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function ListNameModal({
  title,
  confirmLabel,
  initialValue,
  onClose,
  onSubmit,
}: ListNameModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialValue ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      const normalizedName = normalizeListName(name);
      setErrorMessage(null);
      setIsSubmitting(true);
      await onSubmit(normalizedName);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar a lista.',
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
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>
              Dê um nome para identificar esta lista.
            </Text>

            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder='Ex: Cartas para vender'
              placeholderTextColor='#64748B'
              selectionColor='#38BDF8'
              maxLength={MAX_LIST_NAME_LENGTH}
              autoFocus
              autoCapitalize='sentences'
              returnKeyType='done'
              editable={!isSubmitting}
              onSubmitEditing={() => void handleSubmit()}
              accessibilityLabel='Nome da lista'
            />

            <View style={styles.inputMetaRow}>
              <Text style={styles.inputHint}>
                {name.length}/{MAX_LIST_NAME_LENGTH}
              </Text>
            </View>

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
                  <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
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
  description: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  input: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMetaRow: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  inputHint: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
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
});
