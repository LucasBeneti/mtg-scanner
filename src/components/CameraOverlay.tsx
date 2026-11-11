import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

export const OVERLAY_RATIOS = {
  /** Largura da moldura como fração da largura da tela */
  cardWidthFraction: 0.78,
  /** Proporção padrão de uma carta de Magic (88mm x 63mm) */
  cardAspectRatio: 88 / 63,
  /** Limite máximo da altura da carta em relação à tela */
  maxCardHeightFraction: 0.64,
};

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Calcula o retângulo de corte (em pixels da foto em pé/portrait) correspondente
 * à sub-caixa amarela onde fica o código SET • NÚMERO no canto inferior esquerdo da carta.
 */
export function computeCollectorCropRect(
  rawPhotoWidth: number,
  rawPhotoHeight: number
): CropRect {
  // Como o app roda fixo em portrait, garantimos largura <= altura mesmo quando o sensor reporta landscape
  const photoWidth = Math.min(rawPhotoWidth, rawPhotoHeight);
  const photoHeight = Math.max(rawPhotoWidth, rawPhotoHeight);

  const cardWidthPx = photoWidth * OVERLAY_RATIOS.cardWidthFraction;
  const cardHeightPx = Math.min(
    photoHeight * OVERLAY_RATIOS.maxCardHeightFraction,
    cardWidthPx * OVERLAY_RATIOS.cardAspectRatio
  );

  const cardLeftPx = (photoWidth - cardWidthPx) / 2;
  const cardTopPx = (photoHeight - cardHeightPx) / 2;

  // Recorta o canto inferior esquerdo da moldura com margem de segurança para compensar leve inclinação da mão
  const originX = Math.max(0, Math.floor(cardLeftPx));
  const originY = Math.max(0, Math.floor(cardTopPx + cardHeightPx * 0.78));
  const width = Math.min(photoWidth - originX, Math.ceil(cardWidthPx * 0.65));
  const height = Math.min(photoHeight - originY, Math.ceil(cardHeightPx * 0.22));

  return { originX, originY, width, height };
}

interface CameraOverlayProps {
  isPaused?: boolean;
  candidateBadgeText?: string | null;
  isConfirmed?: boolean;
}

export function CameraOverlay({
  isPaused = false,
  candidateBadgeText,
  isConfirmed = false,
}: CameraOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const cardWidth = Math.round(screenWidth * OVERLAY_RATIOS.cardWidthFraction);
  const cardHeight = Math.round(
    Math.min(
      screenHeight * OVERLAY_RATIOS.maxCardHeightFraction,
      cardWidth * OVERLAY_RATIOS.cardAspectRatio
    )
  );

  return (
    <View style={styles.overlayContainer} pointerEvents="none">
      <View style={styles.topHintContainer}>
        <Text style={styles.topHintTitle}>Encaixe a carta na moldura</Text>
        <Text style={styles.topHintSubtitle}>
          {isPaused
            ? 'Captura pausada'
            : 'Alinhe o canto inferior esquerdo na caixa destacada'}
        </Text>
      </View>

      {/* Moldura da carta */}
      <View style={[styles.cardFrame, { width: cardWidth, height: cardHeight }]}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        {/* Sub-caixa demarcando onde fica o SET • NÚMERO */}
        <View
          style={[
            styles.collectorBox,
            isConfirmed && styles.collectorBoxConfirmed,
          ]}
        >
          <View
            style={[
              styles.collectorBadge,
              isConfirmed && styles.collectorBadgeConfirmed,
            ]}
          >
            <Text style={styles.collectorBadgeText}>
              {candidateBadgeText ?? 'SET • Nº (ex: FDN • 0125)'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHintContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    alignItems: 'center',
  },
  topHintTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  topHintSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
  },
  cardFrame: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38BDF8',
    borderWidth: 4,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 16,
  },
  collectorBox: {
    position: 'absolute',
    left: '3%',
    bottom: '2.5%',
    width: '56%',
    height: '13%',
    borderWidth: 2,
    borderColor: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.14)',
    borderRadius: 8,
  },
  collectorBoxConfirmed: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
  },
  collectorBadge: {
    position: 'absolute',
    top: -22,
    left: 0,
    backgroundColor: '#FACC15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  collectorBadgeConfirmed: {
    backgroundColor: '#4ADE80',
  },
  collectorBadgeText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '800',
  },
});
