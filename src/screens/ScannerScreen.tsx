import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {
  CameraOverlay,
  computeCollectorCropRect,
} from '../components/CameraOverlay';
import { CardResultSheet } from '../components/CardResultSheet';
import { ManualFallbackModal } from '../components/ManualFallbackModal';
import { parseCollectorOcrText } from '../services/collectorParser';
import {
  fetchCardBySetAndNumber,
  type FetchCardResult,
  ScryfallError,
} from '../services/scryfall';
import type { ParsedCollectorInfo } from '../types/card';

/** Intervalo entre capturas automáticas para o OCR (em ms) */
const SCAN_INTERVAL_MS = 650;
/** Leituras consecutivas iguais exigidas para confirmar a carta */
const REQUIRED_CONFIRMATIONS = 2;
/** Tentativas seguidas sem leitura antes de exibir o aviso de fallback manual */
const EMPTY_SCANS_BEFORE_HINT = 7;

interface OcrDebugSnapshot {
  croppedUri: string;
  rawText: string;
  blockCount: number;
  durationMs: number;
  scanNumber: number;
  parsedCandidate: ParsedCollectorInfo | null;
  confirmationCount: number;
  errorMessage?: string;
}

export function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();

  const photoOutput = usePhotoOutput({
    quality: 0.85,
  });

  const [isCameraConfigured, setIsCameraConfigured] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasToggledTorch, setHasToggledTorch] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const [debugSnapshot, setDebugSnapshot] = useState<OcrDebugSnapshot | null>(
    null,
  );
  const [confirmedCardInfo, setConfirmedCardInfo] =
    useState<ParsedCollectorInfo | null>(null);
  const [emptyScanCount, setEmptyScanCount] = useState(0);

  const [isFetchingScryfall, setIsFetchingScryfall] = useState(false);
  const [scryfallResult, setScryfallResult] = useState<FetchCardResult | null>(
    null,
  );
  const [scryfallError, setScryfallError] = useState<string | null>(null);
  const [manualModalVisible, setManualModalVisible] = useState(false);

  const isProcessingFrameRef = useRef(false);
  const scanCountRef = useRef(0);
  const lastCandidateKeyRef = useRef<string | null>(null);
  const streakCountRef = useRef(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const lookupCardInScryfall = useCallback(
    async (parsed: ParsedCollectorInfo) => {
      setIsFetchingScryfall(true);
      setScryfallError(null);

      try {
        const result = await fetchCardBySetAndNumber(
          parsed.setCode,
          parsed.collectorNumber,
        );
        setScryfallResult(result);
        setEmptyScanCount(0);
      } catch (err) {
        setScryfallResult(null);
        if (err instanceof ScryfallError) {
          setScryfallError(err.message);
        } else {
          setScryfallError(
            'Falha de conexão ao consultar a Scryfall. Verifique a internet.',
          );
        }
      } finally {
        setIsFetchingScryfall(false);
      }
    },
    [],
  );

  const isLoopBlocked =
    isPaused ||
    isFetchingScryfall ||
    scryfallResult !== null ||
    manualModalVisible;

  const captureAndRecognizeOnce = useCallback(async () => {
    if (isProcessingFrameRef.current || !isCameraConfigured || isLoopBlocked) {
      return;
    }

    isProcessingFrameRef.current = true;
    const startTime = Date.now();

    try {
      // 1. Captura foto silenciosa em arquivo temporário
      const photoFile = await photoOutput.capturePhotoToFile(
        {
          enableShutterSound: false,
          flashMode: 'off',
        },
        {},
      );

      const sourceUri = photoFile.filePath.startsWith('file://')
        ? photoFile.filePath
        : `file://${photoFile.filePath}`;

      // 2. Recorta apenas a sub-caixa do canto inferior esquerdo da moldura
      const cropRect = computeCollectorCropRect(
        photoFile.width,
        photoFile.height,
      );
      const manipulatorContext = ImageManipulator.manipulate(sourceUri);
      manipulatorContext.crop(cropRect);
      const renderedImage = await manipulatorContext.renderAsync();
      const croppedResult = await renderedImage.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.9,
      });

      // 3. Executa o OCR on-device (Google ML Kit Latin) apenas no recorte
      const ocrResult = await TextRecognition.recognize(
        croppedResult.uri,
        TextRecognitionScript.LATIN,
      );

      // 4. Extrai { setCode, collectorNumber } e aplica buffer de confirmação em 2 leituras
      const parsed = parseCollectorOcrText(ocrResult.text);
      let currentStreak = 0;

      if (parsed) {
        const candidateKey = `${parsed.setCode}:${parsed.collectorNumber}`;
        if (lastCandidateKeyRef.current === candidateKey) {
          currentStreak = streakCountRef.current + 1;
        } else {
          lastCandidateKeyRef.current = candidateKey;
          currentStreak = 1;
        }
        streakCountRef.current = currentStreak;
        setEmptyScanCount(0);

        if (currentStreak >= REQUIRED_CONFIRMATIONS) {
          setConfirmedCardInfo(parsed);
          lastCandidateKeyRef.current = null;
          streakCountRef.current = 0;
          void lookupCardInScryfall(parsed);
        }
      } else {
        lastCandidateKeyRef.current = null;
        streakCountRef.current = 0;
        setEmptyScanCount((prev) => prev + 1);
      }

      scanCountRef.current += 1;
      setDebugSnapshot({
        croppedUri: croppedResult.uri,
        rawText: ocrResult.text.trim(),
        blockCount: ocrResult.blocks.length,
        durationMs: Date.now() - startTime,
        scanNumber: scanCountRef.current,
        parsedCandidate: parsed,
        confirmationCount: currentStreak,
      });
    } catch (err) {
      scanCountRef.current += 1;
      setDebugSnapshot((prev) => ({
        croppedUri: prev?.croppedUri ?? '',
        rawText: prev?.rawText ?? '',
        blockCount: 0,
        durationMs: Date.now() - startTime,
        scanNumber: scanCountRef.current,
        parsedCandidate: null,
        confirmationCount: 0,
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Erro ao capturar/processar frame',
      }));
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [isCameraConfigured, isLoopBlocked, photoOutput, lookupCardInScryfall]);

  useEffect(() => {
    const timer = setInterval(() => {
      void captureAndRecognizeOnce();
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [captureAndRecognizeOnce]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style='light' />
        <Text style={styles.permissionTitle}>
          Permissão de Câmera Necessária
        </Text>
        <Text style={styles.permissionDescription}>
          Autorize o acesso à câmera para visualizar o scanner de cartas.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir Câmera</Text>
        </Pressable>
      </View>
    );
  }

  const activeCandidate = debugSnapshot?.parsedCandidate;
  const candidateBadgeText = activeCandidate
    ? `${activeCandidate.setCode.toUpperCase()} #${activeCandidate.collectorNumber} (${Math.min(
        debugSnapshot.confirmationCount,
        REQUIRED_CONFIRMATIONS,
      )}/${REQUIRED_CONFIRMATIONS})`
    : null;
  const isCurrentFrameConfirmed =
    (debugSnapshot?.confirmationCount ?? 0) >= REQUIRED_CONFIRMATIONS;

  const toggleTorch = () => {
    setHasToggledTorch(true);
    setTorchOn((v) => !v);
  };

  const togglePause = () =>
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        setTorchOn(false);
      }
      return next;
    });

  const handleCloseResultSheet = () => {
    setScryfallResult(null);
    setConfirmedCardInfo(null);
    setEmptyScanCount(0);
    lastCandidateKeyRef.current = null;
    streakCountRef.current = 0;
  };

  const isCameraActive =
    !isPaused && scryfallResult === null && !manualModalVisible;

  return (
    <View style={styles.container}>
      <StatusBar style='light' />

      <Camera
        style={StyleSheet.absoluteFill}
        device='back'
        isActive={isCameraActive}
        torchMode={
          isCameraStarted && (torchOn || hasToggledTorch)
            ? torchOn
              ? 'on'
              : 'off'
            : undefined
        }
        outputs={[photoOutput]}
        enableNativeTapToFocusGesture={true}
        onConfigured={() => setIsCameraConfigured(true)}
        onStarted={() => setIsCameraStarted(true)}
        onPreviewStarted={() => setIsCameraStarted(true)}
        onStopped={() => setIsCameraStarted(false)}
        onError={(e) => console.warn('[camera]', e)}
      />

      <CameraOverlay
        isPaused={isPaused}
        candidateBadgeText={candidateBadgeText}
        isConfirmed={isCurrentFrameConfirmed}
      />

      {/* Botão discreto no topo para ligar/desligar o painel de Debug OCR */}
      <View style={[styles.topActionsRow, { top: insets.top + 12 }]}>
        <Pressable
          style={[
            styles.debugToggleButton,
            showDebugPanel && styles.debugToggleButtonActive,
          ]}
          onPress={() => setShowDebugPanel((v) => !v)}
        >
          <Text
            style={[
              styles.debugToggleText,
              showDebugPanel && styles.debugToggleTextActive,
            ]}
          >
            {showDebugPanel ? 'Ocultar Debug OCR' : 'Debug OCR'}
          </Text>
        </Pressable>
      </View>

      {/* Toast de carregamento ao buscar na Scryfall */}
      {isFetchingScryfall ? (
        <View style={[styles.fetchingToast, { top: insets.top + 12 }]}>
          <ActivityIndicator size='small' color='#38BDF8' />
          <Text style={styles.fetchingToastText}>
            Buscando {confirmedCardInfo?.setCode.toUpperCase()} #
            {confirmedCardInfo?.collectorNumber}...
          </Text>
        </View>
      ) : null}

      {/* Painel de Debug opcional (Recorte + OCR + Parser) */}
      {showDebugPanel ? (
        <View
          style={[styles.debugPanel, { top: insets.top + 48 }]}
          pointerEvents='none'
        >
          <View style={styles.debugHeaderRow}>
            <Text style={styles.debugBadge}>DEBUG OCR + PARSER</Text>
            <Text style={styles.debugMeta}>
              {debugSnapshot
                ? `Scan #${debugSnapshot.scanNumber} • ${debugSnapshot.durationMs}ms`
                : 'Aguardando captura...'}
            </Text>
          </View>

          <View style={styles.debugBodyRow}>
            {debugSnapshot?.croppedUri ? (
              <Image
                source={{ uri: debugSnapshot.croppedUri }}
                style={styles.cropPreview}
                resizeMode='contain'
              />
            ) : (
              <View style={[styles.cropPreview, styles.cropPlaceholder]}>
                <Text style={styles.cropPlaceholderText}>Recorte</Text>
              </View>
            )}

            <View style={styles.ocrTextBox}>
              <Text style={styles.ocrLabel}>OCR cru:</Text>
              <Text style={styles.ocrRawText} numberOfLines={2}>
                {debugSnapshot?.errorMessage
                  ? `Erro: ${debugSnapshot.errorMessage}`
                  : debugSnapshot?.rawText
                    ? debugSnapshot.rawText.replace(/\s+/g, ' ')
                    : '(nenhum texto detectado)'}
              </Text>

              <Text style={[styles.ocrLabel, styles.parsedLabel]}>
                Parser ({debugSnapshot?.confirmationCount ?? 0}/
                {REQUIRED_CONFIRMATIONS}):
              </Text>
              <Text
                style={[
                  styles.parsedValue,
                  isCurrentFrameConfirmed && styles.parsedValueConfirmed,
                ]}
              >
                {activeCandidate
                  ? `set="${activeCandidate.setCode}" • number="${activeCandidate.collectorNumber}"`
                  : 'Aguardando padrão SET • Nº...'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Banner de Fallback Manual quando a leitura falha várias vezes ou ocorre erro */}
      {(emptyScanCount >= EMPTY_SCANS_BEFORE_HINT || scryfallError) &&
      !scryfallResult ? (
        <Pressable
          style={[styles.fallbackBanner, { bottom: insets.bottom + 84 }]}
          onPress={() => setManualModalVisible(true)}
        >
          <Text style={styles.fallbackBannerTitle}>
            {scryfallError ?? 'Dificuldade para ler o código automaticamente?'}
          </Text>
          <Text style={styles.fallbackBannerSubtitle}>
            Reflexo foil, pouca luz ou cartas antigas (pré-2015) podem impedir o
            OCR. Toque aqui para digitar o código (ex: FDN 125).
          </Text>
        </Pressable>
      ) : null}

      {/* Controles inferiores */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.controlButton, torchOn && styles.controlButtonActive]}
          onPress={toggleTorch}
          disabled={!isCameraActive}
        >
          <Text
            style={[
              styles.controlButtonText,
              torchOn && styles.controlButtonTextActive,
            ]}
          >
            {torchOn ? 'Luz: ON' : 'Luz: OFF'}
          </Text>
        </Pressable>

        <Pressable
          style={styles.manualEntryButton}
          onPress={() => setManualModalVisible(true)}
        >
          <Text style={styles.manualEntryButtonText}>Digitar Código</Text>
        </Pressable>

        <Pressable
          style={[styles.controlButton, isPaused && styles.controlButtonActive]}
          onPress={togglePause}
        >
          <Text
            style={[
              styles.controlButtonText,
              isPaused && styles.controlButtonTextActive,
            ]}
          >
            {isPaused ? 'Retomar' : 'Pausar'}
          </Text>
        </Pressable>
      </View>

      {/* Bottom Sheet com detalhes da carta e todos os preços disponíveis */}
      <CardResultSheet
        card={scryfallResult?.card ?? null}
        fromCache={scryfallResult?.fromCache ?? false}
        onClose={handleCloseResultSheet}
      />

      {/* Modal de Fallback Manual */}
      <ManualFallbackModal
        visible={manualModalVisible}
        reasonMessage={scryfallError}
        onClose={() => setManualModalVisible(false)}
        onSubmit={(parsed) => {
          setManualModalVisible(false);
          setConfirmedCardInfo(parsed);
          void lookupCardInScryfall(parsed);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  permissionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionDescription: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  topActionsRow: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  debugToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugToggleButtonActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
  },
  debugToggleText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  debugToggleTextActive: {
    color: '#0F172A',
  },
  fetchingToast: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  fetchingToastText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  debugPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  debugBadge: {
    color: '#FACC15',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  debugMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  debugBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cropPreview: {
    width: 110,
    height: 62,
    borderRadius: 6,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  cropPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropPlaceholderText: {
    color: '#64748B',
    fontSize: 10,
  },
  ocrTextBox: {
    flex: 1,
  },
  ocrLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  parsedLabel: {
    marginTop: 4,
  },
  ocrRawText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  parsedValue: {
    color: '#FACC15',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  parsedValueConfirmed: {
    color: '#4ADE80',
  },
  fallbackBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FACC15',
  },
  fallbackBannerTitle: {
    color: '#FACC15',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  fallbackBannerSubtitle: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 17,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  controlButtonActive: {
    backgroundColor: '#FACC15',
    borderColor: '#FACC15',
  },
  controlButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  controlButtonTextActive: {
    color: '#0F172A',
  },
  manualEntryButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
  },
  manualEntryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
});
