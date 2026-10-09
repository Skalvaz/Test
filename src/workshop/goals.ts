/**
 * Görev kartı (M5a, §9.2 S7; kesilebilir paket): üç tasarım görevi ve
 * hedef zarf. "Füze motoru" (çap ≤ 0,5 m, 4 kN), "Bölgesel jet"
 * (≥ 80 kN, TSFC ≤ 11), "Helikopter" (≥ 1,2 MW, ≤ 250 kg).
 *
 * P0: tipler ve imzalar. Görevleri ve gövdeyi P4b/P10 yazar.
 */

import type { Finding } from '../design/core/rules';
import type { DesignSummary } from '../design/summary';
import type { DesignGoal } from '../design/warnings';

export type { DesignGoal } from '../design/warnings';

/** Görevler (P4b doldurur) */
export const GOALS: readonly DesignGoal[] = [];

export function checkGoal(
  _g: DesignGoal,
  _s: DesignSummary,
  _f: Finding[],
): { met: boolean; rows: { label: string; ok: boolean; text: string }[] } {
  throw new Error('P4b: görev denetimi henüz yok.');
}
