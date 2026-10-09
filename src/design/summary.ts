/**
 * Sonuç özeti (M5a): üretilmiş motordan sonuç panelinin, uyarıların ve
 * görevlerin okuduğu sayılar (docs/M5A-SPEC.md §2.12).
 *
 * P0: tipler ve imzalar. Gövdeleri P3 yazar.
 */

import type { BuiltEngine } from './graph';
import type { CombustorStyle } from './types';

/** Turbomakine sırası özeti */
export interface RowSummary {
  stages: number;
  uTip: number;
  uMean: number;
  loading: number;
  hExitMm: number;
  rpm: number;
  mrelTip?: number;
  an2?: number;
}

export interface DesignSummary {
  output: 'thrust' | 'propeller' | 'shaft';
  /** N, N, W */
  thrust: number;
  thrustWet?: number;
  shaftPower?: number;
  /** g/(kN·s) */
  tsfc?: number;
  /** g/(kW·h) */
  sfc?: number;
  mass: number;
  massParts: Record<string, number>;
  cgZ: number;
  thrustToWeight?: number;
  powerToWeight?: number;
  specificThrust?: number;
  diameter: number;
  length: number;
  opr: number;
  bpr: number;
  fpr?: number;
  t3: number;
  t4: number;
  t45: number;
  egtMargin: number;
  rpm: { lp: number; hp: number };
  gearRatio?: number;
  rows: Partial<Record<'front' | 'booster' | 'hpc' | 'hpt' | 'lpt', RowSummary>>;
  impellerUTip?: number;
  hptInletMach: number;
  combustor: { style: CombustorStyle; vref: number; length: number; height: number; cans?: number };
  mixerPR?: number;
  velocityRatio?: number;
  /** "1+3 · 9 · 2+6" */
  stagesLabel: string;
}

export interface SummaryDelta {
  key: keyof DesignSummary | string;
  abs: number;
  rel: number;
  /** true: iyileşme, false: kötüleşme, null: nötr (çap/boy) */
  better: boolean | null;
  text: string;
}

/** Sonuç panelindeki sınır çubuğu */
export interface LimitGauge {
  id: string;
  label: string;
  unit: string;
  value: number;
  caution: number;
  warning?: number;
  dir: 'above' | 'below';
  parts: string[];
  glossary?: string;
}

const todo = (): never => {
  throw new Error('P3: sonuç özeti henüz yok.');
};

export function summarize(_b: BuiltEngine): DesignSummary {
  return todo();
}

export function diffSummary(_a: DesignSummary, _b: DesignSummary): SummaryDelta[] {
  return todo();
}

/** Neden zinciri: en büyük 3 kütle katkısı, kademe ve devir değişimleri */
export function explainDelta(_a: DesignSummary, _b: DesignSummary): string[] {
  return todo();
}
