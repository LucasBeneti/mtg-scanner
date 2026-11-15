import { useMemo } from 'react';
import {
  convertUsdCentsToBrlCents,
  formatBrlCents,
  formatUsdCents,
} from '../utils/money';
import type { Currency } from '../types/currency';
import { useFxRate } from './useFxRate';

interface UseMoneyResult {
  currency: Currency;
  /** Formata centavos de USD na moeda ativa. */
  format: (usdCents: number | null) => string;
  /** Total da linha: multiplica o BRL já arredondado para a conta fechar. */
  formatLineTotal: (unitUsdCents: number | null, quantity: number) => string;
}

export function useMoney(): UseMoneyResult {
  const { currency, rate } = useFxRate();

  return useMemo(() => {
    const toBrl = (usdCents: number): number | null =>
      rate ? convertUsdCentsToBrlCents(usdCents, rate.rateMicros) : null;

    const format = (usdCents: number | null): string => {
      if (usdCents == null) return '—';

      if (currency === 'BRL') {
        const brlCents = toBrl(usdCents);
        if (brlCents != null) return formatBrlCents(brlCents);
      }

      return formatUsdCents(usdCents);
    };

    const formatLineTotal = (
      unitUsdCents: number | null,
      quantity: number,
    ): string => {
      if (unitUsdCents == null) return '—';

      if (currency === 'BRL') {
        const unitBrlCents = toBrl(unitUsdCents);
        if (unitBrlCents != null) {
          return formatBrlCents(unitBrlCents * quantity);
        }
      }

      return formatUsdCents(unitUsdCents * quantity);
    };

    return { currency, format, formatLineTotal };
  }, [currency, rate]);
}
