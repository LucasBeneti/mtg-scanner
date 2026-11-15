import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Currency } from '../types/currency';

const OPTIONS: Currency[] = ['USD', 'BRL'];

interface CurrencyToggleProps {
  value: Currency;
  onChange: (currency: Currency) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function CurrencyToggle({
  value,
  onChange,
  disabled = false,
  isLoading = false,
}: CurrencyToggleProps) {
  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.container, disabled && styles.containerDisabled]}
        accessibilityRole='radiogroup'
        accessibilityLabel='Moeda de exibição dos preços'
      >
        {OPTIONS.map((option) => {
          const isActive = option === value;
          const showSpinner = isLoading && option === 'BRL';

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              disabled={disabled || isActive || showSpinner}
              accessibilityRole='radio'
              accessibilityState={{ selected: isActive, disabled }}
              accessibilityLabel={`Exibir preços em ${option}`}
              style={[styles.option, isActive && styles.optionActive]}
            >
              {showSpinner ? (
                <ActivityIndicator size='small' color='#38BDF8' />
              ) : (
                <Text
                  style={[styles.optionText, isActive && styles.optionTextActive]}
                >
                  {option}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {disabled ? (
        <Text style={styles.disabledLabel}>Cotação indisponível</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    padding: 2,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  option: {
    minWidth: 58,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  optionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  optionTextActive: {
    color: '#38BDF8',
  },
  disabledLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
});
