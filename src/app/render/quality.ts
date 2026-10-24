/**
 * Grafik kalite kademeleri (App.ts'ten Dalga 0'da taşındı). Sahibi 2B
 * (T-12: dinamik çözünürlük, pil kipi, otomatik kademe seçimi buraya).
 */

import type { Settings } from '../../game/progress';

export type QualityLevel = Settings['quality'];

export interface QualityPreset {
  /** Cihaz piksel oranının üst sınırı */
  readonly pixelRatio: number;
  /** Güneş gölge haritası kenarı [teksel] */
  readonly shadow: number;
  readonly gtao: boolean;
  readonly bloom: boolean;
}

export const QUALITY: Readonly<Record<QualityLevel, QualityPreset>> = {
  low: { pixelRatio: 1, shadow: 1024, gtao: false, bloom: false },
  medium: { pixelRatio: 1.5, shadow: 2048, gtao: true, bloom: true },
  high: { pixelRatio: 2, shadow: 4096, gtao: true, bloom: true },
};
