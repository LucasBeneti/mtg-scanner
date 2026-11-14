import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import {
  CardResultSheet,
  getCardPeekHeight,
} from '../components/CardResultSheet';
import { ManualFallbackModal } from '../components/ManualFallbackModal';
import { makeCacheKey } from '../services/cardCache';
import { parseCollectorOcrText } from '../services/collectorParser';
import {
  addCardToList,
  getListById,
  getListItemsForCard,
  ListNotFoundError,
  touchListAccess,
} from '../services/listsRepository';
import {
  fetchCardBySetAndNumber,
  type FetchCardResult,
  ScryfallError,
} from '../services/scryfall';
import type { ParsedCollectorInfo } from '../types/card';
import type { CardFinish, CardList } from '../types/list';
import { getUsdPriceCentsForFinish } from '../utils/money';

/** Intervalo entre capturas automáticas para o OCR (em ms) */
const SCAN_INTERVAL_MS = 250;
/** Leituras consecutivas iguais exigidas para confirmar a carta */
const REQUIRED_CONFIRMATIONS = 2;
/** Tentativas seguidas sem leitura antes de exibir o aviso de fallback manual */
const EMPTY_SCANS_BEFORE_HINT = 7;
/** Tempo mínimo antes de tentar de novo um código que acabou de falhar */
const FAILED_LOOKUP_COOLDOWN_MS = 10_000;

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

interface ExistingItemsState {
  listId: number;
  cardId: string;
  quantities: Record<CardFinish, number>;
}

interface AddedToastState {
  message: string;
  listId: number;
  listName: string;
}

interface ScannerScreenProps {
  activeListId?: number | null;
}

export function ScannerScreen({ activeListId = null }: ScannerScreenProps) {
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
  const [isScreenFocused, setIsScreenFocused] = useState(false);

  const [debugSnapshot, setDebugSnapshot] = useState<OcrDebugSnapshot | null>(
    null,
  );
  const [confirmedCardInfo, setConfirmedCardInfo] =
    useState<ParsedCollectorInfo | null>(null);
  const [emptyScanCount, setEmptyScanCount] = useState(0);

  const [isFetchingScryfall, setIsFetchingScryfall] = useState(false);
  const [lastReadResult, setLastReadResult] = useState<FetchCardResult | null>(
    null,
  );
  const [scryfallError, setScryfallError] = useState<string | null>(null);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [activeList, setActiveList] = useState<CardList | null>(null);
  const [listModeError, setListModeError] = useState<string | null>(null);
  const [existingItems, setExistingItems] = useState<ExistingItemsState | null>(
    null,
  );
  const [addedToast, setAddedToast] = useState<AddedToastState | null>(null);

  const isProcessingFrameRef = useRef(false);
  const scanCountRef = useRef(0);
  const lastCandidateKeyRef = useRef<string | null>(null);
  const streakCountRef = useRef(0);
  const lastReadKeyRef = useRef<string | null>(null);
  const failedKeyRef = useRef<string | null>(null);
  const failedAtRef = useRef(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (activeListId == null) {
        setActiveList(null);
        setListModeError(null);
        return;
      }

      let active = true;

      void (async () => {
        try {
          await touchListAccess(activeListId).catch(() => undefined);
          const list = await getListById(activeListId);

          if (!active) return;

          if (list) {
            setActiveList(list);
            setListModeError(null);
          } else {
            setActiveList(null);
            setListModeError(
              'Lista não encontrada. Você pode continuar escaneando sem adicionar.',
            );
          }
        } catch (error) {
          console.warn('[lists] falha ao carregar lista ativa', error);

          if (active) {
            setActiveList(null);
            setListModeError(
              'Não foi possível carregar a lista. Escaneie sem adicionar.',
            );
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [activeListId]),
  );

  useEffect(() => {
    if (!activeList || !lastReadResult) {
      return;
    }

    const listId = activeList.id;
    const cardId = lastReadResult.card.id;
    let active = true;

    void (async () => {
      try {
        const items = await getListItemsForCard(listId, cardId);

        if (!active) return;

        const quantities: Record<CardFinish, number> = {
          normal: 0,
          foil: 0,
          etched: 0,
        };

        for (const item of items) {
          quantities[item.finish] = item.quantity;
        }

        setExistingItems({ listId, cardId, quantities });
      } catch (error) {
        console.warn('[lists] falha ao carregar quantidades existentes', error);

        if (active) {
          setExistingItems({
            listId,
            cardId,
            quantities: { normal: 0, foil: 0, etched: 0 },
          });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [activeList, lastReadResult]);

  useEffect(() => {
    if (!addedToast) return;

    const timer = setTimeout(() => setAddedToast(null), 5000);

    return () => clearTimeout(timer);
  }, [addedToast]);

  const lookupCardInScryfall = useCallback(
    async (parsed: ParsedCollectorInfo) => {
      const key = makeCacheKey(parsed.setCode, parsed.collectorNumber);

      setAddedToast(null);
      setIsFetchingScryfall(true);
      setScryfallError(null);

      try {
        const result = await fetchCardBySetAndNumber(
          parsed.setCode,
          parsed.collectorNumber,
        );
        setLastReadResult(result);
        setSheetExpanded(true);
        setEmptyScanCount(0);
        lastReadKeyRef.current = key;
        failedKeyRef.current = null;
        failedAtRef.current = 0;
      } catch (err) {
        if (err instanceof ScryfallError) {
          setScryfallError(err.message);
        } else {
          setScryfallError(
            'Falha de conexão ao consultar a Scryfall. Verifique a internet.',
          );
        }
        failedKeyRef.current = key;
        failedAtRef.current = Date.now();
      } finally {
        setIsFetchingScryfall(false);
      }
    },
    [],
  );

  const handleAddToList = useCallback(
    async ({ finish, quantity }: { finish: CardFinish; quantity: number }) => {
      if (!activeList || !lastReadResult) {
        throw new Error('Lista ou carta indisponível para adicionar.');
      }

      const card = lastReadResult.card;
      const entryPriceUsdCents = getUsdPriceCentsForFinish(card, finish);

      try {
        await addCardToList({
          listId: activeList.id,
          card,
          finish,
          quantity,
          entryPriceUsdCents,
          now: Date.now(),
        });
      } catch (error) {
        if (error instanceof ListNotFoundError) {
          setActiveList(null);
          setListModeError(
            'Lista não encontrada. Você pode continuar escaneando sem adicionar.',
          );
        }
        throw error;
      }

      setExistingItems((current) => {
        if (
          !current ||
          current.listId !== activeList.id ||
          current.cardId !== card.id
        ) {
          return current;
        }

        return {
          ...current,
          quantities: {
            ...current.quantities,
            [finish]: current.quantities[finish] + quantity,
          },
        };
      });

      setSheetExpanded(false);
      lastCandidateKeyRef.current = null;
      streakCountRef.current = 0;
      setAddedToast({
        message:
          quantity === 1
            ? 'Carta adicionada à lista'
            : `${quantity} cópias adicionadas à lista`,
        listId: activeList.id,
        listName: activeList.name,
      });
    },
    [activeList, lastReadResult],
  );

  const handleViewAddedList = () => {
    if (!addedToast) return;

    const listId = addedToast.listId;
    setAddedToast(null);
    router.replace({
      pathname: '/lists/[id]',
      params: { id: String(listId) },
    });
  };

  const isLoopBlocked =
    !isScreenFocused ||
    isPaused ||
    isFetchingScryfall ||
    sheetExpanded ||
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

          const key = makeCacheKey(parsed.setCode, parsed.collectorNumber);
          const isSameAsLastRead = key === lastReadKeyRef.current;
          const isInFailedCooldown =
            key === failedKeyRef.current &&
            Date.now() - failedAtRef.current < FAILED_LOOKUP_COOLDOWN_MS;

          if (!isSameAsLastRead && !isInFailedCooldown) {
            void lookupCardInScryfall(parsed);
          }
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

  useEffect(() => {
    if (!sheetExpanded) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setSheetExpanded(false);
        return true;
      },
    );

    return () => subscription.remove();
  }, [sheetExpanded]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/');
  };

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style='light' />
        <Pressable
          style={[
            styles.backButton,
            styles.permissionBackButton,
            { top: insets.top + 12 },
          ]}
          onPress={handleGoBack}
          accessibilityRole='button'
          accessibilityLabel='Voltar para a tela inicial'
        >
          <Text style={styles.backButtonText}>‹ Início</Text>
        </Pressable>
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

  const handleCollapseResultSheet = () => {
    setSheetExpanded(false);
    lastCandidateKeyRef.current = null;
    streakCountRef.current = 0;
  };

  const handleExpandResultSheet = () => {
    setSheetExpanded(true);
  };

  const isCameraActive =
    isScreenFocused && !isPaused && !sheetExpanded && !manualModalVisible;

  const peekHeight = getCardPeekHeight(insets.bottom);
  const bottomBarBottom = lastReadResult ? peekHeight + 12 : insets.bottom + 16;
  const fallbackBannerBottom = lastReadResult
    ? peekHeight + 84
    : insets.bottom + 84;

  const existingQuantitiesForCard =
    activeList &&
    lastReadResult &&
    existingItems &&
    existingItems.listId === activeList.id &&
    existingItems.cardId === lastReadResult.card.id
      ? existingItems.quantities
      : undefined;

  const hasListModeHeader = Boolean(activeList || listModeError);
  const listModeHeaderTop = insets.top + 56;
  const statusToastTop = insets.top + (hasListModeHeader ? 112 : 56);
  const debugPanelTop = insets.top + (hasListModeHeader ? 152 : 96);

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

      {/* Barra superior: voltar para a Home + toggle do painel de Debug OCR */}
      <View
        style={[styles.topBar, { top: insets.top + 12 }]}
        pointerEvents='box-none'
      >
        <Pressable
          style={styles.backButton}
          onPress={handleGoBack}
          accessibilityRole='button'
          accessibilityLabel='Voltar para a tela inicial'
        >
          <Text style={styles.backButtonText}>‹ Início</Text>
        </Pressable>

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

      {/* Modo lista: indica para qual lista as próximas cartas serão adicionadas */}
      {activeList ? (
        <View
          style={[styles.listModeBar, { top: listModeHeaderTop }]}
          pointerEvents='none'
        >
          <Text style={styles.listModeLabel}>ADICIONANDO A</Text>
          <Text style={styles.listModeName} numberOfLines={1}>
            {activeList.name}
          </Text>
        </View>
      ) : listModeError ? (
        <View
          style={[
            styles.listModeBar,
            styles.listModeErrorBar,
            { top: listModeHeaderTop },
          ]}
          pointerEvents='none'
        >
          <Text style={styles.listModeErrorText}>{listModeError}</Text>
        </View>
      ) : null}

      {/* Toast de carregamento ao buscar na Scryfall */}
      {isFetchingScryfall ? (
        <View style={[styles.fetchingToast, { top: statusToastTop }]}>
          <ActivityIndicator size='small' color='#38BDF8' />
          <Text style={styles.fetchingToastText}>
            Buscando {confirmedCardInfo?.setCode.toUpperCase()} #
            {confirmedCardInfo?.collectorNumber}...
          </Text>
        </View>
      ) : null}

      {addedToast ? (
        <View style={[styles.addedToast, { top: statusToastTop }]}>
          <View style={styles.addedToastInfo}>
            <Text style={styles.addedToastTitle}>{addedToast.message}</Text>
            <Text style={styles.addedToastSubtitle} numberOfLines={1}>
              {addedToast.listName}
            </Text>
          </View>
          <Pressable
            style={styles.addedToastAction}
            onPress={handleViewAddedList}
            accessibilityRole='button'
            accessibilityLabel='Ver lista'
          >
            <Text style={styles.addedToastActionText}>Ver lista</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Painel de Debug opcional (Recorte + OCR + Parser) */}
      {showDebugPanel ? (
        <View
          style={[styles.debugPanel, { top: debugPanelTop }]}
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
      {(scryfallError ||
        (!lastReadResult && emptyScanCount >= EMPTY_SCANS_BEFORE_HINT)) &&
      !sheetExpanded ? (
        <Pressable
          style={[styles.fallbackBanner, { bottom: fallbackBannerBottom }]}
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
      <View style={[styles.bottomBar, { bottom: bottomBarBottom }]}>
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
        card={lastReadResult?.card ?? null}
        fromCache={lastReadResult?.fromCache ?? false}
        expanded={sheetExpanded}
        onExpand={handleExpandResultSheet}
        onCollapse={handleCollapseResultSheet}
        activeListName={activeList?.name ?? null}
        existingQuantities={existingQuantitiesForCard}
        onAddToList={handleAddToList}
        onSkipCard={handleCollapseResultSheet}
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
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  permissionBackButton: {
    position: 'absolute',
    left: 16,
  },
  listModeBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 9,
  },
  listModeErrorBar: {
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  listModeLabel: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  listModeName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  listModeErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  addedToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 12,
  },
  addedToastInfo: {
    flex: 1,
  },
  addedToastTitle: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
  },
  addedToastSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  addedToastAction: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addedToastActionText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
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
