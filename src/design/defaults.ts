/**
 * Mimariden grafik: bağışçı şablon modülleri ve hedef itki/güç için hava
 * akışı (docs/M5A-SPEC.md §2.4). Bağışçılar kalibrasyondan (§4) SONRAKİ
 * şablon değerlerini kullanır: üretilen her mimari uyarısız başlar.
 *
 * P0: yalnız sözleşme. Gövdeleri P4a yazar.
 */

import type { Architecture } from './architecture';
import type { EngineGraph, ModuleType } from './types';

/** Modül bağışçısı: TJ turbojet, MTF askeri TF, TF yolcu TF, TP turboprop, TS turboşaft, TJD kuru TJ, TFM karışık TF */
export type Donor = 'TJ' | 'MTF' | 'TF' | 'TP' | 'TS' | 'TJD' | 'TFM';

const todo = (): never => {
  throw new Error('P4a: varsayılan modüller henüz yok.');
};

export function donorFor(_m: ModuleType, _a: Architecture): Donor {
  return todo();
}

export function graphFromArchitecture(_a: Architecture, _size: { massFlow: number; name: string }): EngineGraph {
  return todo();
}

/** Hedef itki [N] ya da mil gücü [W] için hava akışı: 30 adımlı ikiye bölme, log uzayında */
export function solveMassFlow(_g: EngineGraph, _target: { thrust?: number; shaftPower?: number }): number {
  return todo();
}
