import type { CardFinish } from '../types/list';

export const FINISH_LABELS: Record<CardFinish, string> = {
  normal: 'Normal',
  foil: 'Foil',
  etched: 'Etched / Surge',
};

export function getFinishLabel(finish: CardFinish): string {
  return FINISH_LABELS[finish];
}
