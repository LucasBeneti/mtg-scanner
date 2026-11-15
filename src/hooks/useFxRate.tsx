import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  FX_TTL_MS,
  getCachedRate,
  loadRate,
  type FxRate,
} from '../services/fxRate';
import { getSetting, setSetting } from '../services/settingsRepository';
import type { Currency } from '../types/currency';

export const CURRENCY_SETTING_KEY = 'fx:display-currency';

interface FxRateContextValue {
  rate: FxRate | null;
  currency: Currency;
  /** Existe cotação disponível para converter. */
  isAvailable: boolean;
  /** Buscando a primeira cotação (não há valor em mãos). */
  isLoading: boolean;
  /** Qualquer busca em andamento, inclusive revalidação silenciosa. */
  isRefreshing: boolean;
  /** A cotação em cache já passou do TTL. */
  isStale: boolean;
  error: string | null;
  setCurrency: (currency: Currency) => void;
  refresh: () => Promise<void>;
}

const FxRateContext = createContext<FxRateContextValue | null>(null);

function isExpired(rate: FxRate | null): boolean {
  return rate == null || Date.now() - rate.fetchedAt >= FX_TTL_MS;
}

export function FxRateProvider({ children }: { children: React.ReactNode }) {
  const [rate, setRate] = useState<FxRate | null>(null);
  const [currency, setCurrencyState] = useState<Currency>('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const rateRef = useRef<FxRate | null>(null);
  const currencyRef = useRef<Currency>('USD');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyCurrency = useCallback((next: Currency, persist = true) => {
    currencyRef.current = next;
    setCurrencyState(next);

    if (persist) {
      void setSetting(CURRENCY_SETTING_KEY, next).catch((saveError) =>
        console.warn('[fx] falha ao salvar moeda', saveError),
      );
    }
  }, []);

  const fetchRate = useCallback(
    async (options?: { force?: boolean }): Promise<FxRate | null> => {
      setIsRefreshing(true);
      if (rateRef.current == null) setIsLoading(true);

      try {
        const next = await loadRate(options);

        if (!mountedRef.current) return next;

        if (next) {
          rateRef.current = next;
          setRate(next);
          setIsStale(Date.now() - next.fetchedAt >= FX_TTL_MS);
          setError(null);
        } else {
          setIsStale(true);
          setError('Não foi possível buscar a cotação.');
        }

        return next;
      } catch (fetchError) {
        console.warn('[fx] falha ao carregar cotação', fetchError);
        if (mountedRef.current) {
          setError('Não foi possível buscar a cotação.');
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setIsRefreshing(false);
          setIsLoading(false);
        }
      }
    },
    [],
  );

  // Carrega a preferência e a cotação cacheada no boot.
  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [storedCurrency, cachedRate] = await Promise.all([
          getSetting<Currency>(CURRENCY_SETTING_KEY),
          getCachedRate(),
        ]);

        if (!active) return;

        const initialCurrency: Currency =
          storedCurrency === 'BRL' ? 'BRL' : 'USD';
        applyCurrency(initialCurrency, false);

        if (cachedRate) {
          rateRef.current = cachedRate;
          setRate(cachedRate);
          setIsStale(Date.now() - cachedRate.fetchedAt >= FX_TTL_MS);
        }

        if (initialCurrency === 'BRL' && isExpired(cachedRate)) {
          const loaded = await fetchRate();

          if (!active) return;

          // Sem cache e sem rede: exibe USD, mas mantém a preferência salva
          // para tentar de novo na próxima abertura.
          if (loaded == null && cachedRate == null) {
            applyCurrency('USD', false);
          }
        }
      } catch (bootError) {
        console.warn('[fx] falha ao inicializar cotação', bootError);

        if (active) {
          applyCurrency('USD', false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [applyCurrency, fetchRate]);

  // Revalida ao voltar do background — só se já passou do TTL.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (currencyRef.current !== 'BRL') return;
      if (!isExpired(rateRef.current)) return;

      void fetchRate();
    });

    return () => subscription.remove();
  }, [fetchRate]);

  const setCurrency = useCallback(
    (next: Currency) => {
      setError(null);
      applyCurrency(next);

      if (next === 'BRL') {
        if (rateRef.current == null) {
          void (async () => {
            const loaded = await fetchRate();

            if (!mountedRef.current) return;

            if (loaded == null) {
              // Não persiste a volta para USD: a próxima abertura tenta BRL de novo.
              applyCurrency('USD', false);
            }
          })();
        } else if (isExpired(rateRef.current)) {
          // Tem cotação, mas antiga: revalida em background sem spinner.
          void fetchRate();
        }
      }
    },
    [applyCurrency, fetchRate],
  );

  const refresh = useCallback(async () => {
    await fetchRate({ force: true });
  }, [fetchRate]);

  const value = useMemo<FxRateContextValue>(
    () => ({
      rate,
      currency,
      isAvailable: rate != null,
      isLoading,
      isRefreshing,
      isStale,
      error,
      setCurrency,
      refresh,
    }),
    [
      rate,
      currency,
      isLoading,
      isRefreshing,
      isStale,
      error,
      setCurrency,
      refresh,
    ],
  );

  return (
    <FxRateContext.Provider value={value}>{children}</FxRateContext.Provider>
  );
}

export function useFxRate(): FxRateContextValue {
  const context = useContext(FxRateContext);

  if (!context) {
    throw new Error('useFxRate deve ser usado dentro de <FxRateProvider>');
  }

  return context;
}
