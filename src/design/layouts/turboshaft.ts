/**
 * Turboşaft yerleşimi: halka giriş (+ parçacık ayırıcı), önden çıkışlı mil
 * ve ortak gaz jeneratörü (gasgen.ts). engine/turboshaft.js girdisi.
 *
 * READY = false: yerleşimi M5a P7 yazar. O zamana dek tipli
 * FlowpathError atar (undefined değil).
 */

import type { SizedEngine } from '../../sim/design';
import type { MountPoint } from '../card';
import { FlowpathError, type GasPath } from '../flowpath';
import type { EngineGraph } from '../types';
import type { GasGeneratorLayout } from './gasgen';
import type { LayoutResult } from './index';

export const READY = false;

export interface TurboshaftLayout {
  style: 'turboshaft';
  gg: GasGeneratorLayout;
  inlet: { z0: number; z1: number; rOuter: number; rInner: number; separator: boolean };
  output: { z: number; radius: number; flangeR: number; rpm: number; gearRatio: number; reduction: boolean };
  intake: { z: number; radius: number; y: 0 };
  exhaustExit: { z: number; radius: number };
  /** Gövde bağlantıları: çıkış flanşı + arka trunnion'lar */
  mounts: MountPoint[];
  /** Dış zarf [z, r], z artan */
  outerProfile: [number, number][];
}

export function turboshaftLayout(_graph: EngineGraph, _sized: SizedEngine, _gp: GasPath): LayoutResult {
  throw new FlowpathError('Turboşaft yerleşimi henüz yok.', 'layout.notReady', 'engine');
}
