/**
 * Atölyenin üç temel 3B tutamacı (M5a, docs/M5A-SPEC.md §6.7): ön uç (fan /
 * kompresör ucu ya da pervane ucu), kompresör boyu, lüle ağzı. Ters
 * eşlemeler inverse.ts'te.
 *
 * Aynı kimlik farklı mimarilerde farklı düğmeye bağlanabilir (lüle ağzı:
 * T4 / BPR / FPR / ağız Mach'ı): her bağ ayrı tanımdır, `available`
 * koşulları ayrıktır; `handleFor(id, ctx)` geçerli olanı seçer.
 */

import type { HandleDef } from './core/handle';
import type { BuiltEngine } from './graph';
import {
  frontTipAnchor,
  frontTipRange,
  nozzleAnchor,
  nozzleRange,
  propTipAnchor,
  solveFrontTip,
  solveNozzleExit,
  solvePropTip,
  solveStages,
  stageAnchor,
  stageRange,
  stageRow,
  type StageModule,
} from './inverse';
import { knobRange, type KnobRangeCtx } from './knobs';
import type { EngineTraits } from './traits';
import type { EngineGraph } from './types';

/** 3B temel tutamaçlar */
export type HandleId = 'frontTip' | 'propTip' | 'length:fan' | 'length:lpc' | 'length:hpc' | 'nozzleExit';

export type EngineHandle = HandleDef<EngineGraph, BuiltEngine, KnobRangeCtx> & { id: HandleId };

/** Kompresör boyu tutamacı */
function lengthHandle(m: StageModule, label: string, available: (t: EngineTraits) => boolean): EngineHandle {
  return {
    id: `length:${m}`,
    group: m,
    axis: 'axial',
    label,
    available: (ctx) => available(ctx.traits),
    // Tek kademeli fanın boyu kademeyle değişmez: tutamaç yok
    anchor: (b) => (m === 'fan' && (stageRow(b, m)?.stages ?? 1) <= 1 ? null : stageAnchor(b, m)),
    blockedReason: (_g, b) => (stageRow(b, m) ? null : 'Bu motorda bu kompresör yok.'),
    range: (g, b) => stageRange(g, b, m),
    snaps: (g, b) => stageRange(g, b, m).snaps,
    coupled: `${m}.pr`,
    solve: (g, b, z) => solveStages(g, b, m, z),
  };
}

/** Lüle ağzı tutamacı (bağlı düğme mimariye göre) */
function nozzleHandle(coupled: string, label: string, available: (t: EngineTraits) => boolean): EngineHandle {
  return {
    id: 'nozzleExit',
    group: 'nozzle',
    axis: 'radial',
    label,
    available: (ctx) => available(ctx.traits),
    anchor: (b) => nozzleAnchor(b),
    blockedReason: (g, b) => nozzleRange(g, b).blocked,
    range: (g, b) => nozzleRange(g, b),
    coupled,
    solve: (g, b, r) => {
      const s = solveNozzleExit(g, b, r);
      return { model: s.model, snapped: s.snapped };
    },
  };
}

export const ENGINE_HANDLES: readonly EngineHandle[] = [
  {
    id: 'frontTip',
    group: 'engine',
    axis: 'radial',
    label: 'Ön uç: hava akışı',
    available: (ctx) => ctx.traits.lpLoad !== 'propeller',
    anchor: frontTipAnchor,
    range: frontTipRange,
    coupled: 'engine.massFlow',
    solve: (g, b, r) => {
      const s = solveFrontTip(g, b, r);
      return { model: s.model, snapped: s.snapped };
    },
  },
  {
    id: 'propTip',
    group: 'propeller',
    axis: 'radial',
    label: 'Pervane ucu: çap',
    available: (ctx) => ctx.traits.lpLoad === 'propeller',
    anchor: propTipAnchor,
    range: (_g, b) => {
      const r = knobRange('propeller.diameter', b.traits) ?? [1.5, 5];
      return { lo: r[0] / 2, hi: r[1] / 2, loReason: 'Pervane çapı alt sınırda.', hiReason: 'Pervane çapı üst sınırda.' };
    },
    coupled: 'propeller.diameter',
    solve: (g, b, r) => {
      const s = solvePropTip(g, b, r);
      return { model: s.model, snapped: s.snapped };
    },
  },
  lengthHandle('fan', 'Fan boyu: kademe sayısı', (t) => t.lpLoad === 'fan'),
  lengthHandle('lpc', 'LPC boyu: kademe sayısı', (t) => t.lpLoad === 'lpc' || t.booster),
  lengthHandle('hpc', 'HPC boyu: kademe sayısı', () => true),
  nozzleHandle('nozzle.exitMach', "Egzoz ağzı: ağız Mach'ı", (t) => t.nozzle === 'stub'),
  nozzleHandle('fan.pr', 'Baypas lülesi ağzı: fan basınç oranı', (t) => t.nozzle !== 'stub' && t.exhaust === 'separate'),
  nozzleHandle('fan.bypassRatio', 'Ortak lüle ağzı: baypas oranı', (t) => t.nozzle !== 'stub' && t.exhaust === 'mixed'),
  nozzleHandle('combustor.tit', 'Lüle ağzı: lüle trimi (T4)', (t) => t.nozzle !== 'stub' && t.exhaust === 'single'),
];

/** Bu motorda geçerli tutamaç tanımı */
export function handleFor(id: HandleId, ctx: KnobRangeCtx): EngineHandle | undefined {
  return ENGINE_HANDLES.find((h) => h.id === id && h.available(ctx));
}

/** Bu motorda geçerli bütün tutamaçlar (kimlik başına bir tanım) */
export function handlesFor(ctx: KnobRangeCtx): EngineHandle[] {
  return ENGINE_HANDLES.filter((h) => h.available(ctx));
}

/**
 * Lüle tutamacı okumasının ilk satırı: bağı açıkça yazar (§6.7). Ör.
 * "Lüle trimi: daha geniş ağız → türbin daha az genişletir → T4 1230 → 1180 K".
 */
export function nozzleExplain(coupled: string, from: number, to: number): string {
  const f = (v: number, d = 2) => v.toLocaleString('tr-TR', { maximumFractionDigits: d, useGrouping: false });
  switch (coupled) {
    case 'combustor.tit':
      return `Lüle trimi: ${to < from ? 'daha geniş ağız → türbin daha az genişletir' : 'daha dar ağız → türbin daha çok genişletir'} → aynı hava ve basınç oranında T4 ${f(from, 0)} → ${f(to, 0)} K`;
    case 'fan.bypassRatio':
      return `Ortak lüle: ${to > from ? 'daha geniş ağız daha çok baypas havası geçirir' : 'daha dar ağız baypas havasını kısar'} → BPR ${f(from)} → ${f(to)}`;
    case 'fan.pr':
      return `Baypas lülesi: ${to < from ? 'daha geniş ağız, fan daha az sıkıştırır' : 'daha dar ağız, fan daha çok sıkıştırır'} → FPR ${f(from)} → ${f(to)}`;
    default:
      return `Egzoz ağzı: ${to < from ? 'daha geniş ağız, gaz daha yavaş çıkar' : 'daha dar ağız, gaz daha hızlı çıkar'} → ağız Mach'ı ${f(from)} → ${f(to)}`;
  }
}
