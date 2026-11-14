import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { getListDetail, touchListAccess } from '../services/listsRepository';
import type { ListDetail } from '../types/list';

interface UseListDetailResult {
  detail: ListDetail | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useListDetail(listId: number | null): UseListDetailResult {
  const [detail, setDetail] = useState<ListDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async (): Promise<ListDetail | null> => {
    if (listId == null) {
      return null;
    }

    await touchListAccess(listId);
    return getListDetail(listId);
  }, [listId]);

  const reload = useCallback(async () => {
    setError(null);

    try {
      const result = await loadDetail();
      setDetail(result);
    } catch (loadError) {
      console.warn('[lists] falha ao carregar lista', loadError);
      setError('Não foi possível carregar esta lista.');
    } finally {
      setIsLoading(false);
    }
  }, [loadDetail]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          const result = await loadDetail();

          if (active) {
            setDetail(result);
            setError(null);
          }
        } catch (loadError) {
          console.warn('[lists] falha ao carregar lista', loadError);

          if (active) {
            setError('Não foi possível carregar esta lista.');
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
    }, [loadDetail]),
  );

  return { detail, isLoading, error, reload };
}
