/**
 * Öğretici uyarılar ve hata çevirisi (M5a, docs/M5A-SPEC.md §2.11). Uyarı
 * kuralları design/core/rules.ts biçimindedir; eşikler tech.ts'ten.
 *
 * Her kural bir ölçüyü (özet ya da gaz yolu) eşikle karşılaştırır ve aşınca
 * nedenini, bedelini ve çaresini anlatan bir bulgu üretir. "Düzelt" önerisi
 * (`remedy`) bağlı düğmenin eşiği %2 içeride bırakan değeridir; çoğu kapalı
 * biçimde (uç Mach'ı uç hızıyla, AN² çıkış alanıyla orantılı), EGT payı ve
 * karıştırıcı dengesi tasarım noktası ikiye bölmesiyle bulunur.
 *
 * Sınır: uyarılar ISA deniz seviyesi statik tasarım noktasındadır; uçuşta
 * pervane ucu ve yüksek irtifa sönmesi M5c'de (performans tablosu).
 */

import { evaluateRules, type Finding, type Rule } from './core/rules';
import type { KnobValue } from './core/knob';
import { GraphError } from './errors';
import { FlowpathError, computeGasPath, flowFunction, machFromFlow, type RowKey } from './flowpath';
import { toEngineDesign, type BuiltEngine } from './graph';
import { fmtNum, fmtSci, type DesignSummary, type LimitGauge } from './summary';
import { TECH_MODERN, type Lim, type TechLimits } from './tech';
import type { CompressorModule, EngineGraph, EngineModule, NozzleModule, PropellerModule, TurbineModule } from './types';
import { DesignError, sizeEngine, type EngineDesign } from '../sim/design';
import { EngineSim } from '../sim/engineSim';
import { AIR, GAS } from '../sim/gas';

/**
 * Tasarım görevi (Görev kartı). Katman kuralı gereği burada tanımlanır
 * (design/ workshop/'u içe aktarmaz); workshop/goals.ts yeniden dışa verir.
 */
export interface DesignGoal {
  id: string;
  title: string;
  brief: string;
  require: {
    thrustMin?: number;
    shaftPowerMin?: number;
    tsfcMax?: number;
    sfcMax?: number;
    massMax?: number;
    diameterMax?: number;
    lengthMax?: number;
    noWarnings?: boolean;
  };
  hint?: string;
  lesson?: string;
}

export interface WarnCtx {
  graph: EngineGraph;
  built: BuiltEngine;
  s: DesignSummary;
  tech: TechLimits;
  goal?: DesignGoal;
}

/** §2.11 tablosundaki kimlikler ('fanTipMach', 'an2Hpt', 'egtMargin'…) */
export type WarningId = string;

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                         */
/* ------------------------------------------------------------------ */

const KELVIN = 273.15;
/** "Düzelt": eşiğin %2 içi */
const INSIDE = 0.98;

const mod = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;
const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step;
const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;
/** Kayan nokta artığı olmadan yuvarlanmış değer (0,58 değil 0,5800000001) */
const clean = (v: number) => Number(v.toPrecision(10));

/** LP milinin ilk kompresörü (fan ya da LPC) */
const frontModule = (g: EngineGraph) => mod<CompressorModule>(g, 'fan') ?? mod<CompressorModule>(g, 'lpc');
/** Çıplak/kaportalı modellerde parça adı: fan, TJ'nin LPC'si 'booster' parçasıdır */
const frontPart = (g: EngineGraph) => (mod(g, 'fan') ? 'fan' : 'booster');

const rowPart: Record<RowKey, string> = { front: 'fan', booster: 'booster', hpc: 'hpc', hpt: 'hpt', lpt: 'lpt' };
const rowName = (k: RowKey, g: EngineGraph) =>
  k === 'front' ? (mod(g, 'fan') ? 'Fan' : 'LPC') : ({ booster: 'Booster', hpc: 'HPC', hpt: 'HPT', lpt: 'LPT' } as const)[k];

const remedy = (knob: string, value: KnobValue, label: string): Finding['remedy'] => ({ knob, value, label });

/**
 * Bağıl uç Mach'ını hedefe getiren uç hızı. Mrel² = M² + (U/a)² (M eksenel
 * giriş Mach'ı, a girişteki ses hızı): U ∝ √(Mrel² − M²).
 */
function tipSpeedFor(mrel: number, axialMach: number, uTip: number, target: number): number | undefined {
  const now = mrel * mrel - axialMach * axialMach;
  const want = target * target - axialMach * axialMach;
  if (!(now > 0 && want > 0)) return undefined;
  return uTip * Math.sqrt(want / now);
}

/**
 * Tasarım noktasında bir değişkenin ikiye bölmesi (f artan): f(x) = hedef.
 * Hata veren (çözülemeyen) nokta `errorAs` sayılır: aralığın hangi ucunda
 * çözüm kalmadığını çağıran bilir. Bulunamazsa undefined.
 */
function bisect(f: (x: number) => number, lo: number, hi: number, target: number, errorAs: number, iters = 24): number | undefined {
  const safe = (x: number) => {
    try {
      const v = f(x);
      return Number.isFinite(v) ? v : errorAs;
    } catch {
      return errorAs;
    }
  };
  if (!(safe(lo) <= target && safe(hi) >= target)) return undefined;
  let a = lo;
  let b = hi;
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (safe(m) < target) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/**
 * Kesen yöntemi (neredeyse doğrusal ölçüler için: EGT payı T4 ile): birkaç
 * tasarım noktası hesabıyla f(x) = hedef. Yakınsamazsa ikiye bölmeye düşer.
 */
function secant(f: (x: number) => number, x0: number, x1: number, target: number, lo: number, hi: number, errorAs: number, tol: number): number | undefined {
  try {
    let f0 = f(x0) - target;
    let f1 = f(x1) - target;
    for (let i = 0; i < 6 && Number.isFinite(f0) && Number.isFinite(f1) && f1 !== f0; i++) {
      const x2 = x1 - (f1 * (x1 - x0)) / (f1 - f0);
      if (!(x2 >= lo && x2 <= hi)) break;
      x0 = x1;
      f0 = f1;
      x1 = x2;
      f1 = f(x1) - target;
      if (Math.abs(f1) < tol) return x1;
    }
  } catch {
    // ikiye bölmeye düş
  }
  return bisect(f, lo, hi, target, errorAs);
}

/** Tasarımın bir alanı değişmiş kopyasıyla tasarım noktası */
const resized = (d: EngineDesign, patch: Partial<EngineDesign>) => sizeEngine({ ...d, ...patch }).point.stations;

/* ------------------------------------------------------------------ */
/* Kurallar                                                            */
/* ------------------------------------------------------------------ */

/** Sınır çubuğu tanımı (sonuç paneli) */
interface GaugeSpec {
  label: string | ((c: WarnCtx) => string);
  unit: string;
  level: 'basic' | 'expert';
}

/**
 * Kural + motora göre değişen alanlar (modül, düğmeler, parçalar): ortak
 * Rule tipinde `group` ve `knobs` sabittir, burada bulguya sonradan yazılır.
 */
interface WarnRule extends Rule<WarnCtx> {
  groupOf?(c: WarnCtx): string;
  knobsOf?(c: WarnCtx): string[];
  gauge?: GaugeSpec;
}

const lims = (l: Lim) => ({ caution: l.caution, warning: l.warning });

/** En kötü sıra (verilen ölçüye göre) */
function worstRow(c: WarnCtx, keys: RowKey[], f: (r: NonNullable<DesignSummary['rows'][RowKey]>) => number): RowKey | undefined {
  let best: RowKey | undefined;
  let v = -Infinity;
  for (const k of keys) {
    const r = c.s.rows[k];
    if (r && f(r) > v) {
      v = f(r);
      best = k;
    }
  }
  return best;
}

const AXIAL: RowKey[] = ['front', 'booster', 'hpc'];
const TURBINES: RowKey[] = ['hpt', 'lpt'];

/** Uç hızı düğmesi: booster fanla aynı milde, hızını fan belirler */
function tipKnobOf(c: WarnCtx, k: RowKey): string {
  if (k === 'hpc') return 'hpc.tipSpeed';
  return `${frontModule(c.graph)?.type ?? 'lpc'}.tipSpeed`;
}

const an2Rule = (t: 'hpt' | 'lpt'): WarnRule => ({
  id: t === 'hpt' ? 'an2Hpt' : 'an2Lpt',
  group: t,
  metric: (c) => c.s.rows[t]?.an2,
  dir: 'above',
  limits: (c) => lims(c.tech.an2[t]),
  unit: '',
  digits: 2,
  title: (v) => `${t.toUpperCase()} AN² ${fmtSci(v)} m²·rpm²`,
  text: (v, lim) =>
    `${t.toUpperCase()} AN² ${fmtSci(v)} (sınır ${fmtSci(lim)} m²·rpm²): diskteki merkezkaç gerilmesi kanat alanı × devir² ile artar; sınırı aşan disk patlar. Çıkış Mach'ını artır (kısa kanat) ya da devri düşür.`,
  fix: `${t.toUpperCase()} çıkış Mach'ını artır (kanatlar kısalır) ya da mil devrini düşür.`,
  tags: () => [t],
  knobs: [`${t}.mach.1`],
  glossary: 'an2',
  remedy: (c) => {
    // AN² = A_çıkış · rpm²; A_çıkış ∝ 1/F(M1), devir M1'den bağımsız
    const m = mod<TurbineModule>(c.graph, t);
    const v = c.s.rows[t]?.an2;
    if (!m || !v) return undefined;
    const target = INSIDE * c.tech.an2[t].caution;
    const f = flowFunction(m.mach[1], GAS) * (v / target);
    if (f >= flowFunction(0.55, GAS)) return undefined; // düğme aralığının dışı
    const M1 = clean(ceilTo(machFromFlow(f, GAS), 0.001));
    return remedy(`${t}.mach.1`, M1, `${t.toUpperCase()} çıkış Mach'ı ${fmtNum(m.mach[1], 3)} → ${fmtNum(M1, 3)}`);
  },
  gauge: { label: `${t.toUpperCase()} AN²`, unit: 'm²·rpm²', level: 'basic' },
});

export const WARNING_RULES: readonly Rule<WarnCtx>[] = (
  [
    {
      id: 'fanTipMach',
      group: 'fan',
      applies: (c) => c.built.traits.lpLoad === 'fan' && c.s.bpr >= 1,
      metric: (c) => c.s.rows.front?.mrelTip,
      dir: 'above',
      limits: (c) => lims(c.tech.tipMachRel.fan),
      unit: '',
      digits: 2,
      title: (v) => `Fan ucu bağıl Mach ${fmtNum(v, 2)}`,
      text: (v) =>
        `Fan ucu bağıl Mach ${fmtNum(v, 2)}: uçta şok dalgaları verimi düşürür ve kalkışta 'testere' sesi (buzz-saw) yapar. Uç hızını düşür.`,
      fix: 'Fan uç hızını düşür.',
      tags: () => ['fan'],
      knobs: ['fan.tipSpeed'],
      glossary: 'tipMach',
      lesson: 'birdstrike',
      remedy: (c) => {
        const fan = mod<CompressorModule>(c.graph, 'fan');
        const r = c.s.rows.front;
        if (!fan?.tipSpeed || !r?.mrelTip) return undefined;
        const u = tipSpeedFor(r.mrelTip, fan.mach[0], fan.tipSpeed, INSIDE * c.tech.tipMachRel.fan.caution);
        if (!u) return undefined;
        const v = floorTo(u, 1);
        return remedy('fan.tipSpeed', v, `Fan uç hızı ${fmtNum(fan.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      gauge: { label: 'Fan ucu Mrel', unit: '', level: 'basic' },
    },
    {
      id: 'frontTipMach',
      group: 'lpc',
      groupOf: (c) => frontModule(c.graph)?.type ?? 'lpc',
      applies: (c) => (c.built.traits.lpLoad === 'fan' || c.built.traits.lpLoad === 'lpc') && c.s.bpr < 1,
      metric: (c) => c.s.rows.front?.mrelTip,
      dir: 'above',
      limits: (c) => lims(c.tech.tipMachRel.front),
      unit: '',
      digits: 2,
      title: (v, c) => `${rowName('front', c.graph)} ilk kademe uç bağıl Mach ${fmtNum(v, 2)}`,
      text: (v, _l, c) =>
        `${rowName('front', c.graph)} ilk kademesinin ucu bağıl Mach ${fmtNum(v, 2)}: süpersonik uçta şok kaybı büyür, kanat titreşir ve surge payı daralır. Uç hızını düşür.`,
      fix: 'İlk kompresörün uç hızını düşür.',
      tags: (c) => [frontPart(c.graph)],
      knobs: ['lpc.tipSpeed'],
      knobsOf: (c) => [tipKnobOf(c, 'front')],
      glossary: 'tipMach',
      lesson: 'surge',
      remedy: (c) => {
        const m = frontModule(c.graph);
        const r = c.s.rows.front;
        if (!m?.tipSpeed || !r?.mrelTip) return undefined;
        const u = tipSpeedFor(r.mrelTip, m.mach[0], m.tipSpeed, INSIDE * c.tech.tipMachRel.front.caution);
        if (!u) return undefined;
        const v = floorTo(u, 1);
        return remedy(`${m.type}.tipSpeed`, v, `${rowName('front', c.graph)} uç hızı ${fmtNum(m.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      gauge: { label: (c) => `${rowName('front', c.graph)} ucu Mrel`, unit: '', level: 'basic' },
    },
    {
      id: 'hpcTipMach',
      group: 'hpc',
      metric: (c) => c.s.rows.hpc?.mrelTip,
      dir: 'above',
      limits: (c) => lims(c.tech.tipMachRel.hpc),
      unit: '',
      digits: 2,
      title: (v) => `HPC ilk kademe uç bağıl Mach ${fmtNum(v, 2)}`,
      text: (v) =>
        `HPC ilk kademesi Mach ${fmtNum(v, 2)}: kısa kanatlarda şok kaybı büyük. Uç hızını düşür ya da santrifüje daha çok iş ver.`,
      fix: 'HPC uç hızını düşür.',
      tags: () => ['hpc'],
      knobs: ['hpc.tipSpeed'],
      glossary: 'tipMach',
      lesson: 'surge',
      remedy: (c) => {
        const m = mod<CompressorModule>(c.graph, 'hpc');
        const r = c.s.rows.hpc;
        if (!m?.tipSpeed || !r?.mrelTip) return undefined;
        const u = tipSpeedFor(r.mrelTip, m.mach[0], m.tipSpeed, INSIDE * c.tech.tipMachRel.hpc.caution);
        if (!u) return undefined;
        const v = floorTo(u, 1);
        return remedy('hpc.tipSpeed', v, `HPC uç hızı ${fmtNum(m.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      gauge: { label: 'HPC ucu Mrel', unit: '', level: 'basic' },
    },
    {
      id: 'propTipMach',
      group: 'propeller',
      applies: (c) => c.built.traits.output === 'propeller',
      // Pervaneli motorda LP "uç Mach'ı" durağan pervane ucu Mach'ıdır
      metric: (c) => c.built.flowpath.metrics.tipMachRel.lp,
      dir: 'above',
      limits: (c) => lims(c.tech.propTipMach),
      unit: '',
      digits: 2,
      title: (v) => `Pervane ucu Mach ${fmtNum(v, 2)}`,
      text: (v) =>
        `Durağan pervane ucu Mach ${fmtNum(v, 2)}: uçta şok sesi ve verim kaybı başlar; uçuşta ileri hız eklenince uç Mach'ı daha da artar. Pervane devrini ya da çapını düşür.`,
      fix: 'Pervane devrini ya da çapını düşür.',
      tags: () => ['propeller'],
      knobs: ['propeller.rpm', 'propeller.diameter'],
      glossary: 'tipMach',
      lesson: 'altitude',
      remedy: (c) => {
        const p = mod<PropellerModule>(c.graph, 'propeller');
        const m = c.built.flowpath.metrics.tipMachRel.lp;
        if (!p || !(m > 0)) return undefined;
        const v = floorTo((p.rpm * INSIDE * c.tech.propTipMach.caution) / m, 10);
        return remedy('propeller.rpm', v, `Pervane devri ${fmtNum(p.rpm)} → ${fmtNum(v)} rpm`);
      },
      gauge: { label: 'Pervane ucu Mach', unit: '', level: 'basic' },
    },
    {
      id: 'axialTipSpeed',
      group: 'hpc',
      groupOf: (c) => {
        const k = worstRow(c, AXIAL, (r) => r.uTip);
        return k === 'hpc' || !k ? 'hpc' : k === 'booster' ? 'lpc' : (frontModule(c.graph)?.type ?? 'lpc');
      },
      metric: (c) => Math.max(...AXIAL.map((k) => c.s.rows[k]?.uTip ?? 0)),
      dir: 'above',
      limits: (c) => lims(c.tech.axialUTip),
      unit: 'm/s',
      digits: 0,
      title: (v, c) => `${rowName(worstRow(c, AXIAL, (r) => r.uTip) ?? 'hpc', c.graph)} uç hızı ${fmtNum(v)} m/s`,
      text: (v, lim, c) =>
        `${rowName(worstRow(c, AXIAL, (r) => r.uTip) ?? 'hpc', c.graph)} ucu ${fmtNum(v)} m/s (sınır ${fmtNum(lim)}): disk ve kanat kökündeki merkezkaç gerilmesi uç hızının karesiyle artar; titanyum diskler 600 m/s dolayında sınıra gelir. Uç hızını düşür.`,
      fix: 'Uç hızını düşür.',
      tags: (c) => {
        const k = worstRow(c, AXIAL, (r) => r.uTip) ?? 'hpc';
        return [k === 'front' ? frontPart(c.graph) : rowPart[k]];
      },
      knobs: ['hpc.tipSpeed'],
      knobsOf: (c) => [tipKnobOf(c, worstRow(c, AXIAL, (r) => r.uTip) ?? 'hpc')],
      lesson: 'birdstrike',
      remedy: (c) => {
        const k = worstRow(c, AXIAL, (r) => r.uTip);
        const r = k && c.s.rows[k];
        if (!k || !r) return undefined;
        const m = k === 'hpc' ? mod<CompressorModule>(c.graph, 'hpc') : frontModule(c.graph);
        if (!m?.tipSpeed) return undefined;
        // Booster fanla aynı milde: fan uç hızı aynı oranda düşer
        const v = floorTo((m.tipSpeed * INSIDE * c.tech.axialUTip.caution) / r.uTip, 1);
        return remedy(`${m.type}.tipSpeed`, v, `${m.type === 'hpc' ? 'HPC' : rowName('front', c.graph)} uç hızı ${fmtNum(m.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      gauge: { label: 'Eksenel uç hızı', unit: 'm/s', level: 'expert' },
    },
    {
      id: 'impellerTipSpeed',
      group: 'hpc',
      metric: (c) => c.s.impellerUTip,
      dir: 'above',
      limits: (c) => lims(c.tech.impellerUTip),
      unit: 'm/s',
      digits: 0,
      title: (v) => `Santrifüj çark ucu ${fmtNum(v)} m/s`,
      text: (v, lim) =>
        `Santrifüj çark ucu ${fmtNum(v)} m/s (sınır ${fmtNum(lim)}): tek parça titanyum çarkın merkezkaç gerilmesi sınırda. Çarka daha az iş ver; eksenel kademeler biraz artar.`,
      fix: 'Santrifüj iş payını düşür.',
      tags: () => ['hpc'],
      knobs: ['hpc.centrifugal.workFraction'],
      remedy: (c) => {
        // U² = iş payı · cp·ΔT / yükleme: U ∝ √(iş payı)
        const cen = mod<CompressorModule>(c.graph, 'hpc')?.centrifugal;
        const u = c.s.impellerUTip;
        if (!cen || !u) return undefined;
        const v = clean(floorTo(cen.workFraction * ((INSIDE * c.tech.impellerUTip.caution) / u) ** 2, 0.01));
        return remedy('hpc.centrifugal.workFraction', v, `Santrifüj iş payı ${fmtNum(cen.workFraction * 100)} → ${fmtNum(v * 100)} %`);
      },
      gauge: { label: 'Çark ucu hızı', unit: 'm/s', level: 'expert' },
    },
    an2Rule('hpt'),
    an2Rule('lpt'),
    {
      id: 't4',
      group: 'combustor',
      metric: (c) => c.s.t4,
      dir: 'above',
      limits: (c) => lims(c.tech.t4),
      unit: 'K',
      digits: 0,
      title: (v) => `T4 ${fmtNum(v)} K`,
      text: (v) =>
        `T4 ${fmtNum(v)} K: kanatlar tek kristal alaşımın sınırında. Gerçek motor kompresörden %15–20 soğutma havası alır (M5c'de hesaplanacak).`,
      fix: 'Türbin giriş sıcaklığını düşür.',
      tags: () => ['hpt', 'combustor'],
      knobs: ['combustor.tit'],
      glossary: 'tit',
      lesson: 'brayton',
      remedy: (c) => {
        const v = floorTo(INSIDE * c.tech.t4.caution, 5);
        return remedy('combustor.tit', v, `T4 ${fmtNum(c.s.t4)} → ${fmtNum(v)} K`);
      },
      gauge: { label: 'T4', unit: 'K', level: 'basic' },
    },
    {
      id: 't3',
      group: 'hpc',
      metric: (c) => c.s.t3,
      dir: 'above',
      limits: (c) => lims(c.tech.t3),
      unit: 'K',
      digits: 0,
      title: (v) => `T3 ${fmtNum(v)} K`,
      text: (v) =>
        `T3 ${fmtNum(v)} K: kompresör çıkışı çok sıcak; son kademe diskleri ve yanma odası gömleği malzeme sınırında, NOx da artar. HPC basınç oranını düşür.`,
      fix: 'HPC basınç oranını düşür.',
      tags: () => ['hpc'],
      knobs: ['hpc.pr'],
      glossary: 'opr',
      lesson: 'brayton',
      remedy: (c) => {
        // T3 = T25·(1 + (PR^k − 1)/η) tersinden
        const hpc = mod<CompressorModule>(c.graph, 'hpc');
        if (!hpc) return undefined;
        const T25 = c.built.sized.point.stations['25'].T;
        const k = (AIR.gamma - 1) / AIR.gamma;
        const pr = Math.pow(1 + hpc.eff * ((INSIDE * c.tech.t3.caution) / T25 - 1), 1 / k);
        const v = clean(floorTo(pr, 0.1));
        return remedy('hpc.pr', v, `HPC basınç oranı ${fmtNum(hpc.pr, 1)} → ${fmtNum(v, 1)}`);
      },
      gauge: { label: 'T3', unit: 'K', level: 'basic' },
    },
    {
      id: 'egtMargin',
      group: 'lpt',
      metric: (c) => c.s.egtMargin,
      dir: 'below',
      limits: (c) => lims(c.tech.egtMargin),
      unit: 'K',
      digits: 0,
      title: (v) => `EGT payı ${fmtNum(v)} K`,
      text: (v) =>
        `EGT payı ${fmtNum(v)} K: kalkış gücünde türbin çıkışı sürekli sınırın üstünde. Test hücresinde FADEC itkiyi kısacak. Yeni motorda 40–60 K bırakılır.`,
      fix: 'T4’ü düşür.',
      tags: () => ['hpt', 'lpt'],
      knobs: ['combustor.tit'],
      glossary: 'egtMargin',
      lesson: 'fadec',
      remedy: (c) => {
        // EGT payı T4 ile monoton azalır: payı caution/0,98'e getiren T4
        const d = c.built.design;
        const amber = d.limits.egtAmber;
        const want = c.tech.egtMargin.caution / INSIDE;
        const T3 = c.built.sized.point.stations['3'].T;
        // Düşük T4'te HPT işi çıkaramaz (hata): o uçta pay "sınırsız" sayılır
        const negMargin = (x: number) => -(amber - (resized(d, { tit: x })['45'].T - KELVIN));
        const t4 = secant(negMargin, d.tit, d.tit - 40, -want, T3 + 50, d.tit, -Infinity, 0.05);
        if (t4 === undefined) return undefined;
        const v = floorTo(t4, 5);
        return remedy('combustor.tit', v, `T4 ${fmtNum(d.tit)} → ${fmtNum(v)} K`);
      },
      gauge: { label: 'EGT payı', unit: 'K', level: 'basic' },
    },
    {
      id: 'hpcExitBlade',
      group: 'hpc',
      metric: (c) => c.s.rows.hpc?.hExitMm,
      dir: 'below',
      limits: (c) => lims(c.tech.hpcExitBladeMm),
      unit: 'mm',
      digits: 1,
      title: (v) => `HPC son kanadı ${fmtNum(v, 1)} mm`,
      text: (v) =>
        `HPC son kanadı ${fmtNum(v, 1)} mm: uç boşluğu kanat boyuna oranla büyür, verim düşer. Küçük motorlar bu yüzden santrifüj son kademe kullanır.`,
      fix: 'Daha büyük motor (hava akışı), daha düşük HPC basınç oranı ya da santrifüj son kademeli mimari.',
      tags: () => ['hpc'],
      knobs: ['hpc.pr', 'hpc.mach.1', 'engine.massFlow'],
      glossary: 'stageLoading',
      gauge: { label: 'HPC son kanat', unit: 'mm', level: 'basic' },
    },
    {
      id: 'combustorVelLow',
      group: 'combustor',
      metric: (c) => c.s.combustor.vref,
      dir: 'below',
      limits: (c) => lims(c.tech.combustorVref.low),
      unit: 'm/s',
      digits: 1,
      title: (v) => `Yanma odası referans hızı ${fmtNum(v, 1)} m/s`,
      text: (v) =>
        `Yanma odası referans hızı ${fmtNum(v, 1)} m/s: gömlek gereğinden geniş ve ağır; düşük hızda yakıt–hava karışması zayıflar. Referans hızı artır.`,
      fix: 'Referans hızı artır (gömlek küçülür).',
      tags: () => ['combustor'],
      knobs: ['combustor.refVelocity'],
      glossary: 'refVelocity',
      remedy: (c) => {
        const v = clean(ceilTo(c.tech.combustorVref.low.caution / INSIDE, 0.1));
        return remedy('combustor.refVelocity', v, `Referans hız ${fmtNum(c.s.combustor.vref, 1)} → ${fmtNum(v, 1)} m/s`);
      },
    },
    {
      id: 'combustorVelHigh',
      group: 'combustor',
      metric: (c) => c.s.combustor.vref,
      dir: 'above',
      limits: (c) => lims(c.s.combustor.style === 'annular' ? c.tech.combustorVref.highAnnular : c.tech.combustorVref.highCan),
      unit: 'm/s',
      digits: 1,
      title: (v) => `Yanma odası referans hızı ${fmtNum(v, 1)} m/s`,
      text: (v, lim) =>
        `Yanma odası referans hızı ${fmtNum(v, 1)} m/s (sınır ${fmtNum(lim)}): alev tutucunun arkasında alev zor tutunur; rölantide ve yüksek irtifada sönme riski, çalıştırmada ateşleme zorlaşır. Referans hızı düşür.`,
      fix: 'Referans hızı düşür (gömlek büyür).',
      tags: () => ['combustor'],
      knobs: ['combustor.refVelocity'],
      glossary: 'flameout',
      lesson: 'start',
      remedy: (c) => {
        const l = c.s.combustor.style === 'annular' ? c.tech.combustorVref.highAnnular : c.tech.combustorVref.highCan;
        const v = clean(floorTo(INSIDE * l.caution, 0.1));
        return remedy('combustor.refVelocity', v, `Referans hız ${fmtNum(c.s.combustor.vref, 1)} → ${fmtNum(v, 1)} m/s`);
      },
    },
    {
      id: 'hptInletMach',
      group: 'hpt',
      metric: (c) => c.s.hptInletMach,
      dir: 'below',
      limits: (c) => lims(c.tech.hptInletMach),
      unit: '',
      digits: 3,
      title: (v) => `HPT girişi Mach ${fmtNum(v, 3)}`,
      text: (v) =>
        `HPT girişi eksenel Mach ${fmtNum(v, 3)}: türbin girişi gereğinden geniş ve ağır, kanatlar uzar ve devirde AN² büyür. Gerçek HPT girişinde Mach 0,1–0,15. Giriş Mach'ını artır.`,
      fix: "HPT giriş Mach'ını artır.",
      tags: () => ['hpt'],
      knobs: ['hpt.mach.0'],
      remedy: (c) => {
        const v = clean(ceilTo(c.tech.hptInletMach.caution / INSIDE, 0.001));
        return remedy('hpt.mach.0', v, `HPT giriş Mach'ı ${fmtNum(c.s.hptInletMach, 3)} → ${fmtNum(v, 3)}`);
      },
      gauge: { label: 'HPT giriş Mach', unit: '', level: 'expert' },
    },
    {
      id: 'hpcLoading',
      group: 'hpc',
      metric: (c) => c.s.rows.hpc?.loading,
      dir: 'above',
      limits: (c) => lims(c.tech.loading.hpc),
      unit: '',
      digits: 2,
      title: (v) => `HPC kademe yüklemesi ψ ${fmtNum(v, 2)}`,
      text: (v) =>
        `HPC kademe yüklemesi ψ ${fmtNum(v, 2)}: her kademeden çok iş isteniyor; kanatlarda akış ayrılır, verim ve surge payı düşer. Daha çok kademe kullan (yüklemeyi azalt) ya da basınç oranını düşür.`,
      fix: 'HPC kademe yüklemesini azalt (kademe artar) ya da basınç oranını düşür.',
      tags: () => ['hpc'],
      knobs: ['hpc.loading', 'hpc.pr'],
      glossary: 'stageLoading',
      lesson: 'surge',
      remedy: (c) => {
        // Gerçek ψ ≤ düğmedeki ψ (kademe sayısı yukarı yuvarlanır)
        const m = mod<CompressorModule>(c.graph, 'hpc');
        if (!m) return undefined;
        const v = clean(floorTo(Math.min(m.loading, INSIDE * c.tech.loading.hpc.caution), 0.001));
        return remedy('hpc.loading', v, `HPC yüklemesi ${fmtNum(m.loading, 3)} → ${fmtNum(v, 3)}`);
      },
    },
    {
      id: 'boosterLoading',
      group: 'lpc',
      metric: (c) => c.s.rows.booster?.loading,
      dir: 'above',
      limits: (c) => lims(c.tech.loading.booster),
      unit: '',
      digits: 2,
      title: (v) => `Booster kademe yüklemesi ψ ${fmtNum(v, 2)}`,
      text: (v) =>
        `Booster kademe yüklemesi ψ ${fmtNum(v, 2)}: yavaş dönen fan milinde booster kademeleri aşırı yükleniyor; verim düşer, rölantide surge riski artar. Yüklemeyi azalt (kademe artar).`,
      fix: 'Booster kademe yüklemesini azalt.',
      tags: () => ['booster'],
      knobs: ['lpc.loading', 'lpc.pr'],
      glossary: 'stageLoading',
      remedy: (c) => {
        const m = mod<CompressorModule>(c.graph, 'lpc');
        if (!m) return undefined;
        const v = clean(floorTo(Math.min(m.loading, INSIDE * c.tech.loading.booster.caution), 0.001));
        return remedy('lpc.loading', v, `Booster yüklemesi ${fmtNum(m.loading, 3)} → ${fmtNum(v, 3)}`);
      },
    },
    {
      id: 'turbineLoading',
      group: 'lpt',
      groupOf: (c) => worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt',
      metric: (c) => Math.max(...TURBINES.map((k) => c.s.rows[k]?.loading ?? 0)),
      dir: 'above',
      limits: (c) => lims(c.tech.loading.turbine),
      unit: '',
      digits: 2,
      title: (v, c) => `${rowName(worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt', c.graph)} kademe yüklemesi ψ ${fmtNum(v, 2)}`,
      text: (v, _l, c) =>
        `${rowName(worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt', c.graph)} kademe yüklemesi ψ ${fmtNum(v, 2)}: kanatlar akışı çok fazla çeviriyor; şok ve ayrılma kayıpları büyür. Yüklemeyi azalt (bir kademe daha).`,
      fix: 'Türbin kademe yüklemesini azalt.',
      tags: (c) => [worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt'],
      knobs: ['lpt.loading'],
      knobsOf: (c) => [`${worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt'}.loading`],
      glossary: 'stageLoading',
      remedy: (c) => {
        const k = (worstRow(c, TURBINES, (r) => r.loading) ?? 'lpt') as 'hpt' | 'lpt';
        const m = mod<TurbineModule>(c.graph, k);
        if (!m) return undefined;
        const v = clean(floorTo(Math.min(m.loading, INSIDE * c.tech.loading.turbine.caution), 0.001));
        return remedy(`${k}.loading`, v, `${k.toUpperCase()} yüklemesi ${fmtNum(m.loading, 3)} → ${fmtNum(v, 3)}`);
      },
    },
    {
      id: 'lptStages',
      group: 'lpt',
      metric: (c) => c.s.rows.lpt?.stages,
      dir: 'above',
      limits: (c) => lims(c.tech.lptStages),
      unit: 'adet',
      digits: 0,
      title: (v) => `LPT ${fmtNum(v)} kademe`,
      text: (v) =>
        `LPT ${fmtNum(v)} kademe: yavaş dönen LP milinde türbin işi ancak çok kademeyle çıkar; motor uzar ve ağırlaşır. LP milini hızlandır (fan uç hızı) ya da BPR'yi düşür. Büyük turbofanlarda bu yüzden dişli fan kullanılır.`,
      fix: 'LP milini hızlandır (uç hızı) ya da baypas oranını düşür.',
      tags: () => ['lpt'],
      knobs: ['fan.tipSpeed'],
      knobsOf: (c) => [frontModule(c.graph) ? tipKnobOf(c, 'front') : 'lpt.tipSpeed', ...(mod(c.graph, 'fan') ? ['fan.bypassRatio'] : [])],
      glossary: 'bpr',
      remedy: (c) => {
        // Kademe x = Δh/(ψ·U²); U ∝ uç hızı. x'i 7·0,98'e indiren uç hızı
        const r = c.s.rows.lpt;
        const lpt = mod<TurbineModule>(c.graph, 'lpt');
        const front = frontModule(c.graph);
        const knobMod = front ?? lpt;
        if (!r || !lpt || !knobMod?.tipSpeed) return undefined;
        const x = (r.stages * r.loading) / lpt.loading;
        const v = ceilTo(knobMod.tipSpeed * Math.sqrt(x / (INSIDE * c.tech.lptStages.caution)), 1);
        const name = front ? rowName('front', c.graph) : 'Güç türbini';
        return remedy(`${knobMod.type}.tipSpeed`, v, `${name} uç hızı ${fmtNum(knobMod.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      gauge: { label: 'LPT kademesi', unit: 'adet', level: 'expert' },
    },
    {
      id: 'mixerPR',
      group: 'mixer',
      metric: (c) => c.s.mixerPR,
      dir: 'outside',
      limits: (c) => ({ caution: c.tech.mixerPR.caution, warning: c.tech.mixerPR.warning }),
      unit: '',
      digits: 3,
      title: (v) => `Karıştırıcı basınç oranı ${fmtNum(v, 3)}`,
      text: (v) =>
        `Karıştırıcıda baypas/çekirdek basınç oranı ${fmtNum(v, 3)}: akışlar eşit basınçta buluşmazsa karışma kaybı büyür ve biri ötekini tıkar. 'Düzelt' fan basınç oranını dengeler.`,
      fix: 'Fan basınç oranını dengele (P19t ≈ P5t).',
      tags: () => ['mixer'],
      knobs: ['fan.pr'],
      glossary: 'mixer',
      remedy: (c) => {
        // P19t/P5t fan PR ile artar (baypas basıncı ↑, LPT işi ↑ → P5 ↓)
        const fan = mod<CompressorModule>(c.graph, 'fan');
        const d = c.built.design;
        if (!fan) return undefined;
        const ratio = (fpr: number) => {
          const s = resized(d, { fanPR: fpr });
          return (s['13'].P * (1 - d.bypassDuctDP)) / s['5'].P;
        };
        // Yüksek FPR'de çekirdekte basınç kalmaz (P5 ≤ P0): oran sınırsız büyür
        const fpr = secant(ratio, fan.pr, fan.pr * 1.05, 1.02, 1.05, Math.max(6, fan.pr * 2), Infinity, 1e-4);
        if (fpr === undefined) return undefined;
        const v = clean(Math.round(fpr * 100) / 100);
        return remedy('fan.pr', v, `Fan basınç oranı ${fmtNum(fan.pr, 2)} → ${fmtNum(v, 2)}`);
      },
      gauge: { label: 'Karıştırıcı P19t/P5t', unit: '', level: 'expert' },
    },
    {
      id: 'envelope',
      group: 'engine',
      applies: (c) => !!(c.goal?.require.diameterMax || c.goal?.require.lengthMax),
      metric: (c) => {
        const r = c.goal!.require;
        return Math.max(r.diameterMax ? c.s.diameter / r.diameterMax : 0, r.lengthMax ? c.s.length / r.lengthMax : 0);
      },
      dir: 'above',
      limits: () => ({ caution: 1 }),
      unit: '',
      digits: 2,
      title: (_v, c) => `Hedef zarf aşıldı (${fmtNum(c.s.diameter, 2)} × ${fmtNum(c.s.length, 2)} m)`,
      text: (_v, _l, c) => {
        const r = c.goal!.require;
        const lim = [r.diameterMax ? `çap ≤ ${fmtNum(r.diameterMax, 2)} m` : '', r.lengthMax ? `boy ≤ ${fmtNum(r.lengthMax, 2)} m` : ''].filter(Boolean).join(', ');
        return `Motor görevin kutusuna sığmıyor (${lim}); şu an çap ${fmtNum(c.s.diameter, 2)} m, boy ${fmtNum(c.s.length, 2)} m. Gövde yuvası motoru olduğu gibi almaz.`;
      },
      fix: 'Hava akışını ya da kademe sayısını azalt.',
      tags: () => [],
      knobs: ['engine.massFlow'],
    },
    {
      id: 'smallEngine',
      group: 'hpc',
      infoOnly: true,
      applies: (c) => !c.built.traits.centrifugal,
      // Çekirdek (HPC) akışı: küçük olan çekirdektir
      metric: (c) => c.built.sized.point.stations['25'].W,
      dir: 'below',
      limits: () => ({ caution: 5 }),
      unit: 'kg/s',
      digits: 1,
      title: (v) => `Küçük çekirdek (${fmtNum(v, 1)} kg/s)`,
      text: () => 'Küçük motorda Reynolds ve uç boşluğu verimi düşürür; model ölçek etkisini M5c’de hesaplayacak.',
      fix: 'Bilgi: verimler bu boyutta biraz iyimser.',
      tags: () => ['hpc'],
      knobs: [],
    },
    {
      id: 'chevronCost',
      group: 'nozzle',
      infoOnly: true,
      metric: (c) => {
        const ch = mod<NozzleModule>(c.graph, 'nozzle')?.chevrons;
        return (ch?.core ?? 0) + (ch?.bypass ?? 0);
      },
      dir: 'above',
      limits: () => ({ caution: 0 }),
      unit: 'adet',
      digits: 0,
      title: (v) => `Chevron’lu lüle (${fmtNum(v)} diş)`,
      text: () =>
        'Chevron’lu her lüle itkiden %0,25 alır; karşılığında jetin karışma katmanı hızlanır ve kalkış gürültüsü azalır (dB hesabı M5c’de).',
      fix: 'Bilgi: sessizlik için küçük itki bedeli.',
      tags: (c) => {
        const ch = mod<NozzleModule>(c.graph, 'nozzle')?.chevrons;
        return [...((ch?.bypass ?? 0) > 0 ? ['bypassNozzle'] : []), ...((ch?.core ?? 0) > 0 ? ['exhaust'] : [])];
      },
      knobs: ['nozzle.chevrons.core', 'nozzle.chevrons.bypass'],
      glossary: 'chevron',
    },
  ] satisfies WarnRule[]
).map((r) => r as WarnRule);

const RULE_BY_ID = new Map((WARNING_RULES as WarnRule[]).map((r) => [r.id, r]));

/** Motorda bulunmayan modüllerin düğmelerini ayıklar ('engine.*' ve 'bypassDuct.*' kalır) */
export function knobsPresent(g: EngineGraph, knobs: readonly string[]): string[] {
  return knobs.filter((k) => {
    const m = k.split('.')[0];
    if (m === 'engine') return true;
    if (m === 'bypassDuct') return !!g.bypassDuct;
    return g.modules.some((x) => x.type === m);
  });
}

/**
 * Düğme kimliğinin yolu (`<modül>.<alan>[.<alt>]`, sayısal parça dizi
 * indisi) üzerinden değer yazılmış klon. "Düzelt" önerisini sınamak için;
 * düğme tanımlarının kendi `set`'i (knobs.ts) ile aynı yolu izler.
 */
function withKnob(g: EngineGraph, id: string, v: KnobValue): EngineGraph | null {
  const [m, ...path] = id.split('.');
  const c = structuredClone(g);
  let o: unknown = m === 'engine' ? c : c.modules.find((x) => x.type === m);
  for (let i = 0; i < path.length - 1 && o; i++) o = (o as Record<string, unknown>)[path[i]];
  if (!o || typeof o !== 'object' || !path.length) return null;
  (o as Record<string, unknown>)[path[path.length - 1]] = v;
  return c;
}

/**
 * Öneri uygulanınca motor kurulabiliyor mu (kurulamıyorsa "Düzelt"
 * gösterilmez). Hata kaynakları kurallar, tasarım noktası ve gaz yolu
 * kanallarıdır; 3B yerleşim (pahalı kısım) atlanır.
 */
function remedyBuilds(g: EngineGraph, f: Finding): boolean {
  const next = f.remedy && withKnob(g, f.remedy.knob, f.remedy.value);
  if (!next) return false;
  try {
    computeGasPath(next, sizeEngine(toEngineDesign(next)));
    return true;
  } catch {
    return false;
  }
}

/**
 * < 2 ms, taslakta da çağrılır. "Düzelt" önerileri hesaplanır ve uygulanınca
 * motorun kurulduğu sınanır; sürükleme taslağında `remedies: false` ile
 * atlanır.
 */
export function evaluateWarnings(ctx: WarnCtx, opts: { remedies?: boolean } = {}): Finding[] {
  const out = evaluateRules(WARNING_RULES, ctx, opts);
  for (const f of out) {
    const r = RULE_BY_ID.get(f.id);
    if (r?.groupOf) f.group = r.groupOf(ctx);
    f.knobs = knobsPresent(ctx.graph, r?.knobsOf ? r.knobsOf(ctx) : f.knobs);
    if (f.remedy && !remedyBuilds(ctx.graph, f)) f.remedy = undefined;
  }
  return out;
}

/**
 * Sonuç panelinin sınır çubukları: çubuğu olan her uygulanabilir kural.
 * İki yönlü sınırda (karıştırıcı PR) değere yakın taraf gösterilir.
 */
export function evaluateGauges(ctx: WarnCtx): LimitGauge[] {
  const out: LimitGauge[] = [];
  for (const r of WARNING_RULES as WarnRule[]) {
    if (!r.gauge) continue;
    if (r.applies && !r.applies(ctx)) continue;
    const v = r.metric(ctx);
    if (v === undefined || !Number.isFinite(v)) continue;
    const l = r.limits(ctx);
    let dir: 'above' | 'below';
    let caution: number;
    let warning: number | undefined;
    if (r.dir === 'outside') {
      const [cLo, cHi] = Array.isArray(l.caution) ? l.caution : [-Infinity, l.caution];
      const [wLo, wHi] = Array.isArray(l.warning) ? l.warning : [-Infinity, l.warning ?? Infinity];
      const low = v < (cLo + cHi) / 2;
      dir = low ? 'below' : 'above';
      caution = low ? cLo : cHi;
      warning = low ? wLo : wHi;
    } else {
      dir = r.dir;
      caution = l.caution as number;
      warning = l.warning as number | undefined;
    }
    out.push({
      id: r.id,
      label: typeof r.gauge.label === 'function' ? r.gauge.label(ctx) : r.gauge.label,
      unit: r.gauge.unit,
      value: v,
      caution,
      warning,
      dir,
      parts: r.tags(ctx),
      glossary: r.glossary,
      level: r.gauge.level,
    });
  }
  // Yanma odası referans hızı iki kuralda (alt ve üst): tek çubuk, yakın taraf
  const vref = ctx.s.combustor.vref;
  const low = ctx.tech.combustorVref.low;
  const high = ctx.s.combustor.style === 'annular' ? ctx.tech.combustorVref.highAnnular : ctx.tech.combustorVref.highCan;
  const isLow = vref < (low.caution + high.caution) / 2;
  out.push({
    id: 'combustorVel',
    label: 'Yanma odası hızı',
    unit: 'm/s',
    value: vref,
    caution: isLow ? low.caution : high.caution,
    warning: isLow ? low.warning : high.warning,
    dir: isLow ? 'below' : 'above',
    parts: ['combustor'],
    glossary: 'refVelocity',
    level: 'expert',
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Çalışabilirlik (trim)                                               */
/* ------------------------------------------------------------------ */

/** Trim sonuçları: rölanti ve tam güç */
export interface OpCtx {
  built: BuiltEngine;
  tech: TechLimits;
  idle: { lit: boolean; N2: number; idleN2: number };
  full: { N1: number; egtLimited: boolean; surgeMargin: number };
}

/** Trim bulguları (sözlük/ders tutarlılık testi okur) */
export const OPERABILITY_RULES: readonly Rule<OpCtx>[] = [
  {
    id: 'surgeMargin',
    group: 'hpc',
    metric: (c) => c.full.surgeMargin,
    dir: 'below',
    limits: (c) => lims(c.tech.surgeMargin),
    unit: '%',
    digits: 0,
    title: (v) => `Surge payı %${fmtNum(v * 100)}`,
    text: (v) =>
      `Tam güçte HPC surge payı %${fmtNum(v * 100)}: çalışma noktası surge hattına yakın; ani gaz açışında, yan rüzgârda ya da kirli kompresörde akış tersine dönebilir.`,
    fix: 'HPC basınç oranını ya da kademe yüklemesini azalt.',
    tags: () => ['hpc'],
    knobs: ['hpc.pr', 'hpc.loading'],
    glossary: 'surgeMargin',
    lesson: 'surge',
  },
  {
    id: 'idleTrim',
    group: 'combustor',
    // Yanıyorsa rölanti eşiğine uzaklık, sönmüşse −1
    metric: (c) => (c.idle.lit ? c.idle.N2 - (c.idle.idleN2 - 0.03) : -1),
    dir: 'below',
    limits: () => ({ caution: 0, warning: 0 }),
    unit: '',
    digits: 2,
    title: (_v, c) => (c.idle.lit ? `Rölanti tutmuyor (N2 %${fmtNum(c.idle.N2 * 100)})` : 'Rölantide alev sönüyor'),
    text: (_v, _l, c) =>
      c.idle.lit
        ? `Rölantide N2 %${fmtNum(c.idle.N2 * 100)}, hedef %${fmtNum(c.idle.idleN2 * 100)}: türbin rölantide kompresörü ve aksesuarları çeviremiyor; çalıştırma takılı kalır (hung start).`
        : 'Rölanti yakıtında yanma odası alevi tutamıyor: yakıt/hava oranı sönme sınırının altında. Test hücresinde motor çalışmaz.',
    fix: 'T4’ü ya da HPC verimini artır, aksesuar gücünü azalt.',
    tags: () => ['combustor', 'hpt'],
    knobs: ['combustor.tit', 'engine.accessoryPower'],
    glossary: 'hungStart',
    lesson: 'start',
  },
  {
    id: 'fullTrim',
    group: 'lpt',
    metric: (c) => (c.full.egtLimited ? 0 : c.full.N1),
    dir: 'below',
    limits: () => ({ caution: 0.95 }),
    unit: '',
    digits: 2,
    title: (_v, c) => (c.full.egtLimited ? 'Tam güçte EGT sınırlayıcı devrede' : `Tam güçte N1 %${fmtNum(c.full.N1 * 100)}`),
    text: (_v, _l, c) =>
      c.full.egtLimited
        ? 'Tam güçte EGT sürekli sınıra dayanıyor: FADEC yakıtı kısıyor, tasarım itkisine ulaşılamıyor.'
        : `Tam güçte N1 %${fmtNum(c.full.N1 * 100)}: motor tasarım devrine çıkamıyor, itki beklenenden az.`,
    fix: 'T4’ü düşür ya da EGT payını artır.',
    tags: () => ['lpt'],
    knobs: ['combustor.tit'],
    glossary: 'fadec',
    lesson: 'fadec',
  },
];

/** Bütçe [ms]: aşılırsa tam güç trim'i kısalır */
const OPERABILITY_BUDGET_MS = 30;
/**
 * Benzetim süreleri [s]: rölanti trim'i rölanti devrinden başlar ve oturur,
 * tam güç tasarım noktasından ~0,6 s'de kararlı. Benzetim saniyesi 7–14 ms;
 * süre bütçeyi aşacaksa adım sayısı azalır (en az MIN_SECONDS).
 */
const IDLE_SECONDS = 2;
const FULL_SECONDS = 1;
const MIN_SECONDS = 0.5;
const DT = 1 / 60;

/** trim(0 s) durumu kurar; adımlar bütçe içinde (saate bakarak) atılır */
function trimWithin(sim: EngineSim, throttle: number, seconds: number, deadline: number): void {
  sim.trim(throttle, 0);
  for (let t = 0; t < seconds; t += DT) {
    if (t >= MIN_SECONDS && performance.now() > deadline) break;
    sim.step(DT);
  }
}

/**
 * Rölanti ve tam güç trim'i; yalnız tam üretimde, boşta. Rölanti trim'in
 * rölanti başlangıcından, tam güç tasarım noktasından başlar (ivmelenmeyi
 * beklemeden kararlı hali sınar). ≤ 30 ms (bütçenin %60'ı rölantiye).
 */
export function evaluateOperability(b: BuiltEngine, tech: TechLimits = TECH_MODERN): Finding[] {
  const t0 = performance.now();
  const sim = new EngineSim(b.design);
  trimWithin(sim, 0, IDLE_SECONDS, t0 + 0.6 * OPERABILITY_BUDGET_MS);
  const idle = { lit: sim.lit, N2: sim.N2, idleN2: sim.limits.idleN2 };
  // Ayrı benzetim: rölantiden kalan önbellekler (surge yakıt sınırı) ilk
  // adımda tasarım yakıtını keserdi
  const r = b.sized.ref;
  const hot = new EngineSim(b.design);
  hot.N1 = 1;
  hot.N2 = 1;
  hot.wf = r.Wf;
  trimWithin(hot, 1, FULL_SECONDS, t0 + OPERABILITY_BUDGET_MS);
  const full = { N1: hot.N1, egtLimited: hot.egtLimited, surgeMargin: hot.cycle.surgeMargin };
  return evaluateRules(OPERABILITY_RULES, { built: b, tech, idle, full });
}

/* ------------------------------------------------------------------ */
/* Hata çevirisi                                                       */
/* ------------------------------------------------------------------ */

/**
 * Ham hatanın (GraphError, FlowpathError, DesignError, NaN) öğretici hali.
 * `raw` özgün mesaj; `knobs` panelde işaretlenecek düğmeler.
 */
export interface TeachingError {
  title: string;
  text: string;
  knobs: string[];
  glossary?: string;
  source: 'graph' | 'flowpath' | 'design';
  group?: string;
  raw: string;
}

const MODULE_NAMES: Record<string, string> = {
  fan: 'Fan',
  lpc: 'LPC',
  hpc: 'HPC',
  hpt: 'HPT',
  lpt: 'LPT',
  combustor: 'Yanma odası',
  inlet: 'Giriş',
  nozzle: 'Lüle',
  mixer: 'Karıştırıcı',
  afterburner: 'Art yakıcı',
  propeller: 'Pervane',
  shaft: 'Çıkış mili',
  engine: 'Motor',
};

/**
 * Tasarım noktası hataları (sim/design.ts sizeEngine). DesignError kod
 * taşımaz; simülasyon katmanının sabit mesajları eşlenir.
 */
const DESIGN_ERRORS: { match: RegExp; title: string; text: string; knobs: string[]; glossary?: string; group: string }[] = [
  {
    match: /P5 ≤ P0/,
    title: 'Çekirdekte basınç kalmadı',
    text: 'Çekirdekte genişleyecek basınç kalmadı: türbin bütün basıncı fanı çevirmeye harcıyor. BPR ya da FPR’yi düşür, T4’ü artır.',
    knobs: ['fan.bypassRatio', 'fan.pr', 'lpc.pr', 'combustor.tit'],
    glossary: 'bpr',
    group: 'lpt',
  },
  {
    match: /LP türbini fanı çeviremiyor/,
    title: 'LPT fanı çeviremiyor',
    text: 'LPT’nin çekebileceği iş fanın istediğinden az. BPR ya da FPR’yi düşür, T4’ü artır.',
    knobs: ['fan.bypassRatio', 'fan.pr', 'lpc.pr', 'combustor.tit'],
    glossary: 'bpr',
    group: 'lpt',
  },
  {
    match: /HP türbini gereken işi çıkaramıyor/,
    title: 'HPT kompresörü çeviremiyor',
    text: 'HPT kompresörü çeviremiyor: T4 çok düşük ya da HPC basınç oranı çok yüksek.',
    knobs: ['combustor.tit', 'hpc.pr'],
    glossary: 'tit',
    group: 'hpt',
  },
  {
    match: /Güç türbinine genişleyecek basınç kalmıyor/,
    title: 'Güç türbinine basınç kalmadı',
    text: 'Güç türbinine genişleyecek basınç kalmadı: gaz jeneratörü kendi kompresörünü zor çeviriyor.',
    knobs: ['combustor.tit', 'hpc.pr'],
    glossary: 'shaftPower',
    group: 'lpt',
  },
  {
    match: /T4, kompresör çıkış sıcaklığından düşük/,
    title: 'T4, T3’ten düşük',
    text: 'Yanma odası çıkışı girişinden soğuk olamaz: T4’ü artır ya da OPR’yi düşür.',
    knobs: ['combustor.tit', 'hpc.pr'],
    glossary: 'tit',
    group: 'combustor',
  },
];

/** Tasarım noktası sayısal olarak çözülemedi (NaN/∞): evaluate üretir */
export class NonFiniteDesignError extends Error {
  constructor(what: string) {
    super(`Tasarım noktası çözülemedi (${what} sonlu değil).`);
    this.name = 'NonFiniteDesignError';
  }
}

/** Beklenen tasarım hatası mı (atölye yakalar; konsola düşmez) */
export function isDesignFailure(e: unknown): boolean {
  return e instanceof GraphError || e instanceof FlowpathError || e instanceof DesignError || e instanceof NonFiniteDesignError;
}

export function translateError(e: unknown): TeachingError {
  const raw = e instanceof Error ? e.message : String(e);
  if (e instanceof GraphError) {
    // Kural metinleri zaten öğretici
    return {
      title: `${MODULE_NAMES[e.group] ?? 'Motor'}: geçersiz düzen`,
      text: raw,
      knobs: [...e.knobs],
      source: 'graph',
      group: e.group,
      raw,
    };
  }
  if (e instanceof FlowpathError) {
    const name = MODULE_NAMES[e.group] ?? e.group.toUpperCase();
    switch (e.code) {
      case 'annulus.closed':
        return {
          title: `${name} kanalı kapanıyor`,
          text: `${name} çıkışında kanal kapanıyor: uç çok daralıyor ya da çıkış Mach'ı çok düşük.`,
          knobs: e.knobs.length ? [...e.knobs] : [`${e.group}.taper`, `${e.group}.mach.1`],
          glossary: 'stageLoading',
          source: 'flowpath',
          group: e.group,
          raw,
        };
      case 'combustor.cansFit': {
        const n = e.data?.cans;
        return {
          title: 'Kutular sığmıyor',
          text: `${n !== undefined ? fmtNum(n) : 'Bu kadar'} kutu çevreye sığmıyor: kutu sayısını azalt ya da referans hızı artır.`,
          knobs: e.knobs.length ? [...e.knobs] : ['combustor.cans', 'combustor.refVelocity'],
          glossary: 'refVelocity',
          source: 'flowpath',
          group: 'combustor',
          raw,
        };
      }
      case 'layout.notReady':
        return { title: 'Bu mimari yakında', text: raw, knobs: [...e.knobs], source: 'flowpath', group: e.group, raw };
      case 'tipSpeed.missing':
        return { title: `${name} uç hızı eksik`, text: raw, knobs: [...e.knobs], source: 'flowpath', group: e.group, raw };
      default:
        return { title: `${name}: geometri kurulamıyor`, text: raw, knobs: [...e.knobs], source: 'flowpath', group: e.group, raw };
    }
  }
  if (e instanceof DesignError) {
    const hit = DESIGN_ERRORS.find((x) => x.match.test(raw));
    if (hit) return { title: hit.title, text: hit.text, knobs: [...hit.knobs], glossary: hit.glossary, source: 'design', group: hit.group, raw };
  }
  if (e instanceof NonFiniteDesignError) {
    return {
      title: 'Tasarım noktası çözülemedi',
      text: 'Tasarım noktası çözülemedi: değerler fiziksel aralığın dışında. Son değişikliği geri al.',
      knobs: [],
      source: 'design',
      group: 'engine',
      raw,
    };
  }
  return { title: 'Tasarım çözülemedi', text: raw, knobs: [], source: 'design', group: 'engine', raw };
}
