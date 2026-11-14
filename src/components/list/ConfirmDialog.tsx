import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir esta ação.',
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
        if (!isSubmitting) onCancel();
      }}
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
          onPress={onCancel}
          disabled={isSubmitting}
          accessible={false}
        />

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isSubmitting}
              accessibilityRole='button'
            >
              <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                destructive ? styles.destructiveButton : styles.confirmButton,
              ]}
              onPress={() => void handleConfirm()}
              disabled={isSubmitting}
              accessibilityRole='button'
              accessibilityState={{ disabled: isSubmitting }}
            >
              {isSubmitting ? (
                <ActivityIndicator
                  size='small'
                  color={destructive ? '#F8FAFC' : '#0F172A'}
                />
              ) : (
                <Text
                  style={
                    destructive
                      ? styles.destructiveButtonText
                      : styles.confirmButtonText
                  }
                >
                  {confirmLabel}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  message: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
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
    marginTop: 20,
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
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  destructiveButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
});
