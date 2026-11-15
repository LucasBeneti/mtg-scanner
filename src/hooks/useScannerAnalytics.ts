import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { track } from '../services/analytics';
import type { ParsedCollectorInfo } from '../types/card';

interface ScannerAnalyticsOptions {
  mode: 'quick' | 'list';
  listId: number | null;
}

interface SessionStats {
  scanAttempts: number;
  emptyScans: number;
  ocrErrors: number;
  codesDetected: number;
  lookupsSucceeded: number;
  lookupsFailed: number;
  manualEntries: number;
  cardsAdded: number;
  cardsSkipped: number;
  torchUsed: boolean;
}

function createStats(): SessionStats {
  return {
    scanAttempts: 0,
    emptyScans: 0,
    ocrErrors: 0,
    codesDetected: 0,
    lookupsSucceeded: 0,
    lookupsFailed: 0,
    manualEntries: 0,
    cardsAdded: 0,
    cardsSkipped: 0,
    torchUsed: false,
  };
}

export interface ScannerAnalytics {
  recordScanAttempt: (parsed: ParsedCollectorInfo | null) => void;
  recordOcrError: () => void;
  recordCodeDetected: (
    parsed: ParsedCollectorInfo,
    attemptsToConfirm: number,
    torchOn: boolean,
  ) => void;
  recordLookupSucceeded: () => void;
  recordLookupFailed: () => void;
  recordManualEntry: () => void;
  recordCardAdded: () => void;
  recordCardSkipped: () => void;
  recordTorchUsed: () => void;
}

/**
 * Contadores da sessão de scan em refs: o loop de OCR roda a cada 250ms, então
 * nada aqui pode causar re-render ou emitir evento por frame.
 *
 * Emite `scan session started` ao focar a tela e um único `scan session ended`
 * ao sair, com os totais agregados.
 */
export function useScannerAnalytics({
  mode,
  listId,
}: ScannerAnalyticsOptions): ScannerAnalytics {
  const statsRef = useRef<SessionStats>(createStats());

  useFocusEffect(
    useCallback(() => {
      statsRef.current = createStats();
      const startedAt = Date.now();

      track('scan session started', { mode, list_id: listId });

      return () => {
        const stats = statsRef.current;

        track('scan session ended', {
          mode,
          list_id: listId,
          duration_ms: Date.now() - startedAt,
          scan_attempts: stats.scanAttempts,
          empty_scans: stats.emptyScans,
          ocr_errors: stats.ocrErrors,
          codes_detected: stats.codesDetected,
          lookups_succeeded: stats.lookupsSucceeded,
          lookups_failed: stats.lookupsFailed,
          manual_entries: stats.manualEntries,
          cards_added: stats.cardsAdded,
          cards_skipped: stats.cardsSkipped,
          torch_used: stats.torchUsed,
        });
      };
    }, [mode, listId]),
  );

  const recordScanAttempt = useCallback(
    (parsed: ParsedCollectorInfo | null) => {
      statsRef.current.scanAttempts += 1;

      if (!parsed) {
        statsRef.current.emptyScans += 1;
      }
    },
    [],
  );

  const recordOcrError = useCallback(() => {
    statsRef.current.ocrErrors += 1;
  }, []);

  const recordCodeDetected = useCallback(
    (
      parsed: ParsedCollectorInfo,
      attemptsToConfirm: number,
      torchOn: boolean,
    ) => {
      statsRef.current.codesDetected += 1;

      track('scan code detected', {
        set_code: parsed.setCode,
        collector_number: parsed.collectorNumber,
        attempts_to_confirm: attemptsToConfirm,
        torch_on: torchOn,
      });
    },
    [],
  );

  const recordLookupSucceeded = useCallback(() => {
    statsRef.current.lookupsSucceeded += 1;
  }, []);

  const recordLookupFailed = useCallback(() => {
    statsRef.current.lookupsFailed += 1;
  }, []);

  const recordManualEntry = useCallback(() => {
    statsRef.current.manualEntries += 1;
  }, []);

  const recordCardAdded = useCallback(() => {
    statsRef.current.cardsAdded += 1;
  }, []);

  const recordCardSkipped = useCallback(() => {
    statsRef.current.cardsSkipped += 1;
  }, []);

  const recordTorchUsed = useCallback(() => {
    statsRef.current.torchUsed = true;
  }, []);

  return {
    recordScanAttempt,
    recordOcrError,
    recordCodeDetected,
    recordLookupSucceeded,
    recordLookupFailed,
    recordManualEntry,
    recordCardAdded,
    recordCardSkipped,
    recordTorchUsed,
  };
}
