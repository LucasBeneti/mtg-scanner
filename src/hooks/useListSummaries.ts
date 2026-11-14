import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  getAllListSummaries,
  getRecentListSummaries,
} from '../services/listsRepository';
import type { ListSummary } from '../types/list';

interface UseListSummariesResult {
  summaries: ListSummary[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useListSummaries(limit?: number): UseListSummariesResult {
  const [summaries, setSummaries] = useState<ListSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = useCallback(async (): Promise<ListSummary[]> => {
    if (limit == null) {
      return getAllListSummaries();
    }

    return getRecentListSummaries(limit);
  }, [limit]);

  const reload = useCallback(async () => {
    setError(null);

    try {
      const result = await loadSummaries();
      setSummaries(result);
    } catch (loadError) {
      console.warn('[lists] falha ao carregar listas', loadError);
      setError('Não foi possível carregar suas listas.');
    } finally {
      setIsLoading(false);
    }
  }, [loadSummaries]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          const result = await loadSummaries();

          if (active) {
            setSummaries(result);
            setError(null);
          }
        } catch (loadError) {
          console.warn('[lists] falha ao carregar listas', loadError);

          if (active) {
            setError('Não foi possível carregar suas listas.');
          }
        } finally {
          if (active) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [loadSummaries]),
  );

  return { summaries, isLoading, error, reload };
}
