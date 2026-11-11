import TextRecognition, {
  TextRecognitionScript,
} from '@react-native-ml-kit/text-recognition';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import {
  CameraOverlay,
  computeCollectorCropRect,
} from './src/components/CameraOverlay';

/** Intervalo entre capturas automáticas para o OCR (em ms) */
const SCAN_INTERVAL_MS = 650;

interface OcrDebugSnapshot {
  croppedUri: string;
  rawText: string;
  blockCount: number;
  durationMs: number;
  scanNumber: number;
  errorMessage?: string;
}

export default function App() {
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();

  const photoOutput = usePhotoOutput({
    quality: 0.85,
  });

  const [isCameraConfigured, setIsCameraConfigured] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<OcrDebugSnapshot | null>(
    null
  );

  const isProcessingFrameRef = useRef(false);
  const scanCountRef = useRef(0);

  useEffect(() => {
    if (!hasPermission && canRequestPermission) {
      requestPermission();
    }
  }, [hasPermission, canRequestPermission, requestPermission]);

  const captureAndRecognizeOnce = useCallback(async () => {
    if (isProcessingFrameRef.current || !isCameraConfigured || isPaused) {
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
        {}
      );

      const sourceUri = photoFile.filePath.startsWith('file://')
        ? photoFile.filePath
        : `file://${photoFile.filePath}`;

      // 2. Recorta apenas a sub-caixa do canto inferior esquerdo da moldura
      const cropRect = computeCollectorCropRect(
        photoFile.width,
        photoFile.height
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
        TextRecognitionScript.LATIN
      );

      scanCountRef.current += 1;
      setDebugSnapshot({
        croppedUri: croppedResult.uri,
        rawText: ocrResult.text.trim(),
        blockCount: ocrResult.blocks.length,
        durationMs: Date.now() - startTime,
        scanNumber: scanCountRef.current,
      });
    } catch (err) {
      scanCountRef.current += 1;
      setDebugSnapshot((prev) => ({
        croppedUri: prev?.croppedUri ?? '',
        rawText: prev?.rawText ?? '',
        blockCount: 0,
        durationMs: Date.now() - startTime,
        scanNumber: scanCountRef.current,
        errorMessage:
          err instanceof Error ? err.message : 'Erro ao capturar/processar frame',
      }));
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [isCameraConfigured, isPaused, photoOutput]);

  useEffect(() => {
    const timer = setInterval(() => {
      void captureAndRecognizeOnce();
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [captureAndRecognizeOnce]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style="light" />
        <Text style={styles.permissionTitle}>Permissão de Câmera Necessária</Text>
        <Text style={styles.permissionDescription}>
          Autorize o acesso à câmera para visualizar o scanner de cartas.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir Câmera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Camera
        style={StyleSheet.absoluteFill}
        device="back"
        isActive={!isPaused}
        outputs={[photoOutput]}
        torchMode={torchOn ? 'on' : 'off'}
        enableNativeTapToFocusGesture={true}
        onConfigured={() => setIsCameraConfigured(true)}
      />

      <CameraOverlay isPaused={isPaused} />

      {/* Painel de Debug da Fase 2: miniatura do recorte + texto cru do ML Kit */}
      <View style={styles.debugPanel} pointerEvents="none">
        <View style={styles.debugHeaderRow}>
          <Text style={styles.debugBadge}>FASE 2 • DEBUG OCR</Text>
          <Text style={styles.debugMeta}>
            {debugSnapshot
              ? `Scan #${debugSnapshot.scanNumber} • ${debugSnapshot.durationMs}ms • ${debugSnapshot.blockCount} bloco(s)`
              : 'Aguardando 1ª captura...'}
          </Text>
        </View>

        <View style={styles.debugBodyRow}>
          {debugSnapshot?.croppedUri ? (
            <Image
              source={{ uri: debugSnapshot.croppedUri }}
              style={styles.cropPreview}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.cropPreview, styles.cropPlaceholder]}>
              <Text style={styles.cropPlaceholderText}>Recorte</Text>
            </View>
          )}

          <View style={styles.ocrTextBox}>
            <Text style={styles.ocrLabel}>Texto lido pelo ML Kit:</Text>
            <Text style={styles.ocrRawText} numberOfLines={3}>
              {debugSnapshot?.errorMessage
                ? `Erro: ${debugSnapshot.errorMessage}`
                : debugSnapshot?.rawText
                  ? debugSnapshot.rawText
                  : '(nenhum texto detectado no recorte)'}
            </Text>
          </View>
        </View>
      </View>

      {/* Controles inferiores */}
      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.controlButton, torchOn && styles.controlButtonActive]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <Text
            style={[
              styles.controlButtonText,
              torchOn && styles.controlButtonTextActive,
            ]}
          >
            {torchOn ? 'Lanterna: ON' : 'Lanterna: OFF'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.controlButton, isPaused && styles.controlButtonActive]}
          onPress={() => setIsPaused((v) => !v)}
        >
          <Text
            style={[
              styles.controlButtonText,
              isPaused && styles.controlButtonTextActive,
            ]}
          >
            {isPaused ? 'Retomar Loop' : 'Pausar Loop'}
          </Text>
        </Pressable>
      </View>
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
  debugPanel: {
    position: 'absolute',
    top: 52,
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
    height: 54,
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
    marginBottom: 2,
  },
  ocrRawText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  controlButton: {
    paddingHorizontal: 20,
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
    fontSize: 14,
    fontWeight: '700',
  },
  controlButtonTextActive: {
    color: '#0F172A',
  },
});
