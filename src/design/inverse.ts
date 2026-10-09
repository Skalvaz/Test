/**
 * Ters eşleme (M5a, docs/M5A-SPEC.md §6.7): 3B tutamacın hedef konumu →
 * bağlı düğmenin değeri. Her eşleme fiziksel bir bağı izler:
 *
 *  - Ön uç (radyal): sabit eksenel Mach ve göbek/uç oranında halka alanı
 *    kütle akışıyla orantılı → W' = W·(r'/r)² (kapalı biçim).
 *  - Pervane ucu: çap = 2r'.
 *  - Kompresör boyu (eksenel, kademeye yapışır): hedef kademe sayısı
 *    n' = 1 + round((z'−z0)/aralık); basınç oranı ikiye bölmeyle öyle
 *    seçilir ki gerçek yükleme düğmenin 0,95'i olsun (x = Δh/(ψU²) = 0,95n').
 *  - Lüle ağzı (radyal): kısa egzozda ağız Mach'ı (kapalı biçim); ayrık
 *    turbofanda baypas ağzı ↔ fan basınç oranı; karışık akışta ortak lüle
 *    ↔ baypas oranı; tek akışlı jette "lüle trimi" ↔ T4 (§9.2 S2).
 *
 * Ara üretimler grafiğin kendi `ops`'u eksikse geçerli motoru referans
 * alır (operability.ts oranları zincirlendiğinde ailenin şablonuyla aynı
 * sonucu verir).
 */

import { GAS } from '../sim/gas';
import type { BuiltEngine } from './graph';
import { annulusArea, machFromFlow, type RowGeometry } from './flowpath';
import { buildChecked, feasibleRange, knobById, knobCtx, knobRange, type KnobId } from './knobs';
import type { EngineTraits } from './traits';
import type { CompressorModule, EngineGraph } from './types';

/** Grafikten motor üretimi */
export type Rebuild = (g: EngineGraph) => BuiltEngine;

/** Ters eşleme sonucu: yeni grafik, yapışılan konum ve bağlı düğmenin değeri */
export interface Solved {
  model: EngineGraph;
  snapped: number;
  value: number;
}

const hasFullOps = (g: EngineGraph) => !!(g.ops?.inertia && g.ops.hpcMap && g.ops.limits && g.ops.start);

/** Ara üretim: tam ops'lu (şablon) grafik kendi başına, atölye grafiği b'yi referans alarak */
export function rebuilderFor(b: BuiltEngine): Rebuild {
  return (g) => buildChecked(g, hasFullOps(g) ? {} : { reference: b });
}

/** Bağlı düğmenin değerini yazar (aralığa kırpmadan: çağıran kırpar) */
function withKnob(g: EngineGraph, id: KnobId, v: number): EngineGraph {
  return knobById(id)!.set(g, v);
}

const clamp = (v: number, r: [number, number]) => Math.min(r[1], Math.max(r[0], v));

/* ------------------------------------------------------------------ */
/* Tekdüze çözücü                                                      */
/* ------------------------------------------------------------------ */

export interface Probe {
  f: number;
  model: EngineGraph;
  b: BuiltEngine;
}

/**
 * Tekdüze f(x) için f(x) = hedef'i x0 (geçerli, f0) ile `end` arasında
 * arar. Hedef bu yönde değilse x0 kalır; uçta bile ulaşılamıyorsa uç
 * döner. Kurulamayan nokta "hedefin ötesi" sayılır (çözülebilir sınıra
 * yapışır). En çok 1 + `steps` üretim.
 */
export function solveMonotone(
  evalAt: (x: number) => Probe | null,
  x0: number,
  f0: number,
  end: number,
  target: number,
  steps = 14,
): { x: number; f: number; probe?: Probe } {
  let best: { x: number; f: number; probe?: Probe } = { x: x0, f: f0 };
  const crossed = (f: number) => (f - target) * (f0 - target) <= 0;
  const consider = (x: number, p: Probe) => {
    if (Math.abs(p.f - target) < Math.abs(best.f - target)) best = { x, f: p.f, probe: p };
  };
  if (x0 === end || f0 === target) return best;
  const pe = evalAt(end);
  if (pe) {
    consider(end, pe);
    if (!crossed(pe.f)) return best;
  }
  let lo = x0;
  let hi = end;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const p = evalAt(mid);
    if (!p) {
      hi = mid;
      continue;
    }
    consider(mid, p);
    if (crossed(p.f)) hi = mid;
    else lo = mid;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Ön uç ve pervane                                                    */
/* ------------------------------------------------------------------ */

/** Ön uç tutamacının konumu: fan/LPC ilk kademe ucu, turboşaftta HPC ucu; pervanelide yok */
export function frontTipAnchor(b: BuiltEngine): { z: number; r: number } | null {
  if (b.traits.lpLoad === 'propeller') return null;
  const row = b.traits.lpLoad === 'shaft' ? b.flowpath.gas.hpc : b.flowpath.gas.front;
  return row ? { z: row.z0, r: row.tip[0] } : null;
}

/** Ön uç → hava akışı: sabit Mach ve ν'de A ∝ W, r ∝ √W */
export function solveFrontTip(g: EngineGraph, b: BuiltEngine, r: number): Solved {
  const a = frontTipAnchor(b);
  if (!a) return { model: g, snapped: 0, value: g.massFlow };
  const range = knobRange('engine.massFlow', b.traits)!;
  const W = clamp(g.massFlow * (r / a.r) ** 2, range);
  return { model: withKnob(g, 'engine.massFlow', W), snapped: a.r * Math.sqrt(W / g.massFlow), value: W };
}

/** Ön uç sürükleme sınırı: hava akışı aralığından */
export function frontTipRange(g: EngineGraph, b: BuiltEngine): { lo: number; hi: number; loReason?: string; hiReason?: string } {
  const a = frontTipAnchor(b);
  const range = knobRange('engine.massFlow', b.traits);
  if (!a || !range) return { lo: 0, hi: 0 };
  const fmt = (w: number) => w.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  return {
    lo: a.r * Math.sqrt(range[0] / g.massFlow),
    hi: a.r * Math.sqrt(range[1] / g.massFlow),
    loReason: `Hava akışı bu ailenin alt sınırında (${fmt(range[0])} kg/s).`,
    hiReason: `Hava akışı bu ailenin üst sınırında (${fmt(range[1])} kg/s): daha büyük motor yeni aile ister.`,
  };
}

export function propTipAnchor(b: BuiltEngine): { z: number; r: number } | null {
  const L = b.flowpath.layout;
  return L.style === 'turboprop' ? { z: L.prop.z, r: L.prop.radius } : null;
}

export function solvePropTip(g: EngineGraph, b: BuiltEngine, r: number): Solved {
  const range = knobRange('propeller.diameter', b.traits) ?? [1.5, 5];
  const D = clamp(2 * r, range);
  return { model: withKnob(g, 'propeller.diameter', D), snapped: D / 2, value: D };
}

/* ------------------------------------------------------------------ */
/* Kompresör boyu (kademe sayısı)                                       */
/* ------------------------------------------------------------------ */

export type StageModule = 'fan' | 'lpc' | 'hpc';

/** Modülün gaz yolu sırası: tek akışlı jette LPC ön sıradır, turbofanda booster */
export function stageRow(b: BuiltEngine, m: StageModule): RowGeometry | undefined {
  const gas = b.flowpath.gas;
  if (m === 'hpc') return gas.hpc;
  if (m === 'fan') return b.traits.lpLoad === 'fan' ? gas.front : undefined;
  return b.traits.lpLoad === 'lpc' ? gas.front : gas.booster;
}

/** Kademe tutamacı: son rotor ekseni, orta yarıçapta */
export function stageAnchor(b: BuiltEngine, m: StageModule): { z: number; r: number } | null {
  const row = stageRow(b, m);
  return row ? { z: row.z1, r: (row.hub[1] + row.tip[1]) / 2 } : null;
}

/** Kademe yüklemesi düğmesi (gerçek yükleme hedefi bunun 0,95'i) */
const loadingOf = (g: EngineGraph, m: StageModule) => (g.modules.find((x) => x.type === m) as CompressorModule | undefined)?.loading ?? 0;

/** Sürekli kademe sayısı x = Δh/(ψ_düğme·U²) */
const stageCount = (b: BuiltEngine, g: EngineGraph, m: StageModule) => {
  const row = stageRow(b, m)!;
  return (row.loading * row.stages) / loadingOf(g, m);
};

/** Hedef konumdaki kademe sayısı */
export function stagesAt(row: RowGeometry, z: number): number {
  return Math.min(20, Math.max(1, 1 + Math.round((z - row.z0) / row.pitch)));
}

/**
 * Kompresör boyu → basınç oranı. Kademe sayısı değişmiyorsa grafik aynen
 * kalır (tıklamak basınç oranını oynatmaz).
 */
export function solveStages(g: EngineGraph, b: BuiltEngine, m: StageModule, z: number, rebuild: Rebuild = rebuilderFor(b)): Solved {
  const row = stageRow(b, m);
  const id = `${m}.pr` as KnobId;
  const k = knobById(id)!;
  const pr0 = Number(k.get(g));
  if (!row) return { model: g, snapped: z, value: pr0 };
  const n = stagesAt(row, z);
  if (n === row.stages) return { model: g, snapped: row.z1, value: pr0 };
  const range = knobRange(id, b.traits)!;
  const target = 0.95 * n;
  const evalAt = (pr: number): Probe | null => {
    const model = withKnob(g, id, pr);
    try {
      const b2 = rebuild(model);
      return { f: stageCount(b2, model, m), model, b: b2 };
    } catch {
      return null;
    }
  };
  const x0 = stageCount(b, g, m);
  const end = target > x0 ? range[1] : range[0];
  const s = solveMonotone(evalAt, clamp(pr0, range), x0, end, target);
  if (!s.probe) return { model: g, snapped: row.z1, value: pr0 };
  return { model: s.probe.model, snapped: stageRow(s.probe.b, m)!.z1, value: s.x };
}

/* ------------------------------------------------------------------ */
/* Lüle ağzı                                                           */
/* ------------------------------------------------------------------ */

/** Lüle ağzının bağlı düğmesi (§9.2 S2 "lüle trimi") */
export type NozzleCoupling = 'nozzle.exitMach' | 'fan.pr' | 'fan.bypassRatio' | 'combustor.tit';

export function nozzleCoupling(t: EngineTraits): NozzleCoupling {
  if (t.nozzle === 'stub') return 'nozzle.exitMach';
  if (t.exhaust === 'separate') return 'fan.pr';
  if (t.exhaust === 'mixed') return 'fan.bypassRatio';
  return 'combustor.tit';
}

/**
 * Ağız yarıçapının bağlı düğmeyle değişim yönü (fizik): T4 artınca türbin
 * daha az genişler, lüle basıncı artar → ağız küçülür; FPR artınca baypas
 * jeti hızlanır → ağız küçülür; BPR artınca karışık akış büyür → ağız büyür.
 */
const NOZZLE_SIGN: Record<NozzleCoupling, 1 | -1> = {
  'nozzle.exitMach': -1,
  'fan.pr': -1,
  'fan.bypassRatio': 1,
  'combustor.tit': -1,
};

/** Ayrık turbofanda baypas ağzı FPR [1,25, 2,0] içinde aranır */
const SEPARATE_FPR: [number, number] = [1.25, 2.0];

/** Lüle ağzı tutamacı: ayrık turbofanda baypas ağzı, diğerlerinde (çekirdek/ortak) lüle ağzı */
export function nozzleAnchor(b: BuiltEngine): { z: number; r: number } {
  const L = b.flowpath.layout;
  if (L.style === 'nacelle' && b.traits.exhaust === 'separate') return { z: L.bypassExit.z, r: L.bypassExit.rDuct };
  return { z: L.exhaustExit.z, r: L.exhaustExit.radius };
}

/** Bağlı düğmenin arama aralığı */
export function nozzleSearchRange(b: BuiltEngine): [number, number] | null {
  const c = nozzleCoupling(b.traits);
  const r = knobRange(c, b.traits);
  if (!r) return null;
  return c === 'fan.pr' ? [Math.max(r[0], SEPARATE_FPR[0]), Math.min(r[1], SEPARATE_FPR[1])] : r;
}

/** Kısa egzoz: ağız Mach'ı ↔ ağız yarıçapı (istasyon 5 akışı, kapalı biçim) */
function stubExit(b: BuiltEngine, M: number): number {
  return Math.sqrt(annulusArea(b.sized.point.stations['5'], M, GAS) / Math.PI);
}

export function solveNozzleExit(g: EngineGraph, b: BuiltEngine, r: number, rebuild: Rebuild = rebuilderFor(b)): Solved {
  const c = nozzleCoupling(b.traits);
  const k = knobById(c)!;
  const v0 = Number(k.get(g));
  const range = nozzleSearchRange(b);
  if (!range) return { model: g, snapped: nozzleAnchor(b).r, value: v0 };
  if (c === 'nozzle.exitMach') {
    const st = b.sized.point.stations['5'];
    const M = clamp(machFromFlow((st.W * Math.sqrt(st.T)) / (st.P * Math.PI * r * r), GAS), range);
    return { model: withKnob(g, c, M), snapped: stubExit(b, M), value: M };
  }
  const evalAt = (v: number): Probe | null => {
    const model = withKnob(g, c, v);
    try {
      const b2 = rebuild(model);
      return { f: nozzleAnchor(b2).r, model, b: b2 };
    } catch {
      return null;
    }
  };
  const r0 = nozzleAnchor(b).r;
  const up = (r - r0) * NOZZLE_SIGN[c] > 0;
  const s = solveMonotone(evalAt, clamp(v0, range), r0, up ? range[1] : range[0], r);
  if (!s.probe) return { model: g, snapped: r0, value: v0 };
  return { model: s.probe.model, snapped: s.f, value: s.x };
}

/* ------------------------------------------------------------------ */
/* Sürükleme sınırları (boşta hesaplanır; motor başına önbellekli)      */
/* ------------------------------------------------------------------ */

export interface DragRange {
  lo: number;
  hi: number;
  loReason?: string;
  hiReason?: string;
}

const memo = new WeakMap<BuiltEngine, Map<string, unknown>>();
function cached<T>(b: BuiltEngine, key: string, f: () => T): T {
  let m = memo.get(b);
  if (!m) memo.set(b, (m = new Map()));
  if (!m.has(key)) m.set(key, f());
  return m.get(key) as T;
}

const fmtNum = (v: number, d = 2) => v.toLocaleString('tr-TR', { maximumFractionDigits: d });

/** Bağlı düğmenin çözülebilir aralığı (arama aralığıyla kesişik) */
function couplingFeasible(g: EngineGraph, b: BuiltEngine, id: KnobId, search: [number, number], rebuild: Rebuild) {
  return cached(b, `feasible:${id}`, () => {
    const k = knobById(id)!;
    const ctx = knobCtx(g);
    const f = feasibleRange(g, k, ctx, { build: rebuild, translate: (e) => ({ title: '', text: errText(e), knobs: [], source: 'design', raw: errText(e) }) });
    return { lo: Math.max(f.lo, search[0]), hi: Math.min(f.hi, search[1]), loWhy: f.loReason?.raw, hiWhy: f.hiReason?.raw };
  });
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Kompresör boyu tutamacının sınırı ve kademe çentikleri */
export function stageRange(g: EngineGraph, b: BuiltEngine, m: StageModule, rebuild: Rebuild = rebuilderFor(b)): DragRange & { snaps: number[] } {
  return cached(b, `stages:${m}`, () => {
    const row = stageRow(b, m);
    const id = `${m}.pr` as KnobId;
    const range = knobRange(id, b.traits);
    if (!row || !range) return { lo: 0, hi: 0, snaps: [] };
    const f = couplingFeasible(g, b, id, range, rebuild);
    const count = (pr: number) => {
      try {
        return stageRow(rebuild(withKnob(g, id, pr)), m)!.stages;
      } catch {
        return row.stages;
      }
    };
    const nLo = Math.min(count(f.lo), row.stages);
    const nHi = Math.max(count(f.hi), row.stages);
    const zOf = (n: number) => row.z0 + (n - 1) * row.pitch;
    const snaps: number[] = [];
    for (let n = nLo; n <= nHi; n++) snaps.push(zOf(n));
    return {
      lo: zOf(nLo),
      hi: zOf(nHi),
      loReason: f.loWhy ?? `Basınç oranı alt sınırda (${fmtNum(f.lo)}).`,
      hiReason: f.hiWhy ?? `Basınç oranı üst sınırda (${fmtNum(f.hi)}).`,
      snaps,
    };
  });
}

/** Lüle ağzı tutamacının sınırı ve tekdüzelik (değilse kilit nedeni) */
export function nozzleRange(g: EngineGraph, b: BuiltEngine, rebuild: Rebuild = rebuilderFor(b)): DragRange & { blocked: string | null } {
  return cached(b, 'nozzle', () => {
    const c = nozzleCoupling(b.traits);
    const search = nozzleSearchRange(b);
    const r0 = nozzleAnchor(b).r;
    if (!search) return { lo: r0, hi: r0, blocked: LOCKED };
    if (c === 'nozzle.exitMach') {
      const a = stubExit(b, search[1]);
      const z = stubExit(b, search[0]);
      return { lo: a, hi: z, loReason: `Ağız Mach'ı üst sınırda (${fmtNum(search[1])}).`, hiReason: `Ağız Mach'ı alt sınırda (${fmtNum(search[0])}).`, blocked: null };
    }
    const f = couplingFeasible(g, b, c, search, rebuild);
    const anchorAt = (v: number) => {
      try {
        return nozzleAnchor(rebuild(withKnob(g, c, v))).r;
      } catch {
        return NaN;
      }
    };
    const v0 = Number(knobById(c)!.get(g));
    const pts = [f.lo, (f.lo + v0) / 2, v0, (v0 + f.hi) / 2, f.hi].map((v) => (v === v0 ? r0 : anchorAt(v)));
    const sign = NOZZLE_SIGN[c];
    const monotone = pts.every((r, i) => Number.isFinite(r) && (i === 0 || (r - pts[i - 1]) * sign > -1e-9));
    const rLo = sign > 0 ? pts[0] : pts[4];
    const rHi = sign > 0 ? pts[4] : pts[0];
    const knobLabel = knobById(c)!.label;
    const atLo = sign > 0 ? f.loWhy : f.hiWhy;
    const atHi = sign > 0 ? f.hiWhy : f.loWhy;
    return {
      lo: Math.min(rLo, r0),
      hi: Math.max(rHi, r0),
      loReason: atLo ?? `${knobLabel} sınırda.`,
      hiReason: atHi ?? `${knobLabel} sınırda.`,
      blocked: monotone ? null : LOCKED,
    };
  });
}

/** Tekdüze olmayan eşlemede kilit nedeni */
export const LOCKED = "Bu mimaride lüle alanını çevrim belirler: T4'ü ya da basınç oranlarını değiştir.";
