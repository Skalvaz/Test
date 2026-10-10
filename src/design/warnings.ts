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

import { evaluateRules, type Finding, type Rule, type Severity } from './core/rules';
import type { KnobValue } from './core/knob';
import { GraphError } from './errors';
import { FlowpathError, flowFunction, LP_LOAD, machFromFlow, type RowKey } from './flowpath';
import { buildEngine, type BuiltEngine } from './graph';
import { clampEngineKnob, knobById, knobCtx, knobRange, type KnobCtx } from './knobs';
import { fmtNum, fmtSci, summarize, type DesignSummary, type LimitGauge } from './summary';
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
  /**
   * Ailenin referans motoru (evaluate'in BuildOptions.reference'ı). Atölye
   * grafiklerinde çalışabilirlik (ops) yok (familyBase siler): "Düzelt"
   * önerisi motoru bununla kurar, yoksa her öneri kurulamaz sayılırdı.
   */
  reference?: BuiltEngine;
  /**
   * Etkin aile (atölye; evaluate'in seçeneği). Çok varyantlı ailede varyant
   * kapsamlı düğme aile zarfına kırpılır (store.ts writeKnob): "Düzelt"
   * önerisi de aynı kırpmayla sınanır, zarf dışı öneri gösterilmez.
   */
  family?: KnobCtx['family'];
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

/** Düğmenin bu motordaki aralığı (knobs.ts §2.10); düğme yoksa sınırsız */
function rangeOf(c: WarnCtx, knob: string): [number, number] {
  const k = knobById(knob);
  return (k && knobRange(k, c.built.traits)) || [-Infinity, Infinity];
}

/**
 * Öneriyi düğme aralığına kırpar (mağaza da kırpar; etiket oyuncunun
 * alacağı değeri göstersin). Kırpılmış değerin bulguyu kaldırıp
 * kaldırmadığını evaluateWarnings sınar.
 */
function clampTo(c: WarnCtx, knob: string, v: number): number {
  const [lo, hi] = rangeOf(c, knob);
  return Math.min(hi, Math.max(lo, v));
}

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
  /**
   * Ana öneri (`remedy`) yoksa ya da sınamadan geçmezse sırayla denenen
   * başka düğmeler (ör. fan PR aralığı yetmezse baypas oranı). Tembel:
   * pahalı hesaplar yalnız gerekince yapılır.
   */
  alternatives?: ((c: WarnCtx) => Finding['remedy'])[];
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

/** Milin devrini belirleyen modül: HP'de HPC, LP'de ilk kompresör (yoksa güç türbini) */
function spoolModule(g: EngineGraph, spool: 'lp' | 'hp'): CompressorModule | TurbineModule | undefined {
  if (spool === 'hp') return mod<CompressorModule>(g, 'hpc');
  return frontModule(g) ?? mod<TurbineModule>(g, 'lpt');
}

/**
 * Bir milin uç hızı düğmesi için üst sınır: aynı mildeki bütün devir
 * sınırlarını (ilk kademe bağıl Mach'ı, eksenel uç hızı, türbin AN²) %2
 * içeride bırakan en büyük uç hızı. Devir uç hızıyla orantılı, kanal
 * alanları devirden bağımsız: uç hızı ∝ U, AN² ∝ U². "Düzelt" bunu kullanır;
 * böylece bir sınırı düzeltirken aynı düğmeye bağlı öteki sınır aşık kalmaz.
 */
function tipSpeedCap(c: WarnCtx, spool: 'lp' | 'hp'): number | undefined {
  const m = spoolModule(c.graph, spool);
  const U = m?.tipSpeed;
  if (!m || !U) return undefined;
  const caps: (number | undefined)[] = [];
  const axial: RowKey[] = spool === 'hp' ? ['hpc'] : ['front', 'booster'];
  for (const k of axial) {
    const r = c.s.rows[k];
    if (r?.uTip) caps.push((U * INSIDE * c.tech.axialUTip.caution) / r.uTip);
  }
  // İlk kademe bağıl Mach'ı: sıra düğmenin kendi modülü (fan/LPC ya da HPC)
  const first = spool === 'hp' ? c.s.rows.hpc : m.type === 'lpt' ? undefined : c.s.rows.front;
  if (first?.mrelTip) {
    const lim = spool === 'hp' ? c.tech.tipMachRel.hpc : c.s.bpr >= 1 ? c.tech.tipMachRel.fan : c.tech.tipMachRel.front;
    caps.push(tipSpeedFor(first.mrelTip, m.mach[0], U, INSIDE * lim.caution));
  }
  const t = spool === 'hp' ? 'hpt' : 'lpt';
  const an2 = c.s.rows[t]?.an2;
  if (an2) caps.push(U * Math.sqrt((INSIDE * c.tech.an2[t].caution) / an2));
  const ok = caps.filter((x): x is number => x !== undefined && Number.isFinite(x) && x > 0);
  return ok.length ? Math.min(...ok) : undefined;
}

/** Uç hızı "Düzelt"i: milin bütün devir sınırlarını içeride bırakan değer */
function tipRemedy(c: WarnCtx, spool: 'lp' | 'hp', name: string): Finding['remedy'] {
  const m = spoolModule(c.graph, spool);
  const cap = tipSpeedCap(c, spool);
  if (!m?.tipSpeed || cap === undefined || cap >= m.tipSpeed) return undefined;
  const v = clampTo(c, `${m.type}.tipSpeed`, floorTo(cap, 1));
  if (v >= m.tipSpeed) return undefined;
  return remedy(`${m.type}.tipSpeed`, v, `${name} uç hızı ${fmtNum(m.tipSpeed)} → ${fmtNum(v)} m/s`);
}

/**
 * Karıştırıcı dengesi "Düzelt"i: P19t/P5t'yi 1,02'ye getiren fan PR ya da
 * BPR, düğmenin aralığı içinde. Oran ikisiyle de artar (fan PR: baypas
 * basıncı ↑ ve LPT işi ↑ → P5 ↓; BPR: LPT işi ↑ → P5 ↓). Aralıkta çözüm
 * yoksa öneri yok (kırpılan değer uyarıyı kaldırmaz).
 */
function mixerRemedy(c: WarnCtx, knob: 'fan.pr' | 'fan.bypassRatio'): Finding['remedy'] {
  const fan = mod<CompressorModule>(c.graph, 'fan');
  const d = c.built.design;
  if (!fan) return undefined;
  const isPr = knob === 'fan.pr';
  const x0 = isPr ? fan.pr : fan.bypassRatio;
  if (!(x0 !== undefined && x0 > 0)) return undefined;
  const ratio = (x: number) => {
    const s = resized(d, isPr ? { fanPR: x } : { bypassRatio: x });
    return (s['13'].P * (1 - d.bypassDuctDP)) / s['5'].P;
  };
  const [rlo, rhi] = rangeOf(c, knob);
  const lo = Math.max(rlo, isPr ? 1.05 : 0.01);
  const hi = Math.min(rhi, isPr ? Math.max(6, fan.pr * 2) : 20);
  if (!(hi > lo)) return undefined;
  // Yüksek FPR/BPR'de çekirdekte basınç kalmaz (P5 ≤ P0): oran sınırsız büyür
  const x = secant(ratio, x0, x0 * 1.05, 1.02, lo, hi, Infinity, 1e-4);
  if (x === undefined) return undefined;
  const v = clean(Math.min(hi, Math.max(lo, Math.round(x * 100) / 100)));
  const name = isPr ? 'Fan basınç oranı' : 'Baypas oranı';
  return remedy(knob, v, `${name} ${fmtNum(x0, 2)} → ${fmtNum(v, 2)}`);
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
  knobsOf: (c) => {
    const m = spoolModule(c.graph, t === 'hpt' ? 'hp' : 'lp');
    return [`${t}.mach.1`, ...(m?.tipSpeed ? [`${m.type}.tipSpeed`] : [])];
  },
  glossary: 'an2',
  remedy: (c) => {
    // AN² = A_çıkış · rpm²; A_çıkış ∝ 1/F(M1), devir M1'den bağımsız
    const m = mod<TurbineModule>(c.graph, t);
    const v = c.s.rows[t]?.an2;
    if (!m || !v) return undefined;
    const target = INSIDE * c.tech.an2[t].caution;
    const f = flowFunction(m.mach[1], GAS) * (v / target);
    if (f < flowFunction(0.55, GAS)) {
      const M1 = clean(clampTo(c, `${t}.mach.1`, ceilTo(machFromFlow(f, GAS), 0.001)));
      return remedy(`${t}.mach.1`, M1, `${t.toUpperCase()} çıkış Mach'ı ${fmtNum(m.mach[1], 3)} → ${fmtNum(M1, 3)}`);
    }
    // Çıkış Mach'ı düğme aralığının dışına çıkardı: mil devrini düşür
    const spool = t === 'hpt' ? 'hp' : 'lp';
    const sm = spoolModule(c.graph, spool);
    const name = sm?.type === 'hpc' ? 'HPC' : sm?.type === 'lpt' ? 'Güç türbini' : rowName('front', c.graph);
    return tipRemedy(c, spool, name);
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
      remedy: (c) => (mod(c.graph, 'fan') ? tipRemedy(c, 'lp', 'Fan') : undefined),
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
      remedy: (c) => (frontModule(c.graph) ? tipRemedy(c, 'lp', rowName('front', c.graph)) : undefined),
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
      remedy: (c) => tipRemedy(c, 'hp', 'HPC'),
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
        const v = clampTo(c, 'propeller.rpm', floorTo((p.rpm * INSIDE * c.tech.propTipMach.caution) / m, 10));
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
        // Booster fanla aynı milde: fan uç hızı aynı oranda düşer
        const k = worstRow(c, AXIAL, (r) => r.uTip);
        if (!k) return undefined;
        if (k === 'hpc') return tipRemedy(c, 'hp', 'HPC');
        return frontModule(c.graph) ? tipRemedy(c, 'lp', rowName('front', c.graph)) : undefined;
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
        const v = clean(clampTo(c, 'hpc.centrifugal.workFraction', floorTo(cen.workFraction * ((INSIDE * c.tech.impellerUTip.caution) / u) ** 2, 0.01)));
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
        const v = clampTo(c, 'combustor.tit', floorTo(INSIDE * c.tech.t4.caution, 5));
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
        const v = clean(clampTo(c, 'hpc.pr', floorTo(pr, 0.1)));
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
      fix: 'T4’ü düşür ya da HPC basınç oranını artır.',
      tags: () => ['hpt', 'lpt'],
      knobs: ['combustor.tit', 'hpc.pr'],
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
        const lo = Math.max(T3 + 50, rangeOf(c, 'combustor.tit')[0]);
        const t4 = secant(negMargin, d.tit, d.tit - 40, -want, lo, d.tit, -Infinity, 0.05);
        if (t4 === undefined) return undefined;
        const v = clampTo(c, 'combustor.tit', floorTo(t4, 5));
        return remedy('combustor.tit', v, `T4 ${fmtNum(d.tit)} → ${fmtNum(v)} K`);
      },
      alternatives: [
        (c) => {
          // T4 düşürmek başka sınırı bozuyorsa (karışık akışta karıştırıcı
          // dengesi): OPR artınca HPT daha çok iş çeker, çıkışı soğur
          const hpc = mod<CompressorModule>(c.graph, 'hpc');
          const d = c.built.design;
          const hi = rangeOf(c, 'hpc.pr')[1];
          if (!hpc || !(hi > hpc.pr)) return undefined;
          const amber = d.limits.egtAmber;
          const want = c.tech.egtMargin.caution / INSIDE;
          // Çok yüksek OPR'de HPT işi çıkaramaz (hata): o uçta çözüm yok
          const margin = (x: number) => amber - (resized(d, { hpcPR: x })['45'].T - KELVIN);
          const pr = secant(margin, hpc.pr, Math.min(hi, hpc.pr * 1.05), want, hpc.pr, hi, -Infinity, 0.05);
          if (pr === undefined) return undefined;
          const v = clean(Math.min(hi, ceilTo(pr, 0.1)));
          return remedy('hpc.pr', v, `HPC basınç oranı ${fmtNum(hpc.pr, 1)} → ${fmtNum(v, 1)}`);
        },
      ],
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
        const v = clean(clampTo(c, 'combustor.refVelocity', ceilTo(c.tech.combustorVref.low.caution / INSIDE, 0.1)));
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
        const v = clean(clampTo(c, 'combustor.refVelocity', floorTo(INSIDE * l.caution, 0.1)));
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
        const v = clean(clampTo(c, 'hpt.mach.0', ceilTo(c.tech.hptInletMach.caution / INSIDE, 0.001)));
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
        const v = clean(clampTo(c, 'hpc.loading', floorTo(Math.min(m.loading, INSIDE * c.tech.loading.hpc.caution), 0.001)));
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
        const v = clean(clampTo(c, 'lpc.loading', floorTo(Math.min(m.loading, INSIDE * c.tech.loading.booster.caution), 0.001)));
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
        const v = clean(clampTo(c, `${k}.loading`, floorTo(Math.min(m.loading, INSIDE * c.tech.loading.turbine.caution), 0.001)));
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
        `LPT ${fmtNum(v)} kademe: yavaş dönen LP milinde türbin işi ancak çok kademeyle çıkar; motor uzar ve ağırlaşır. LP milini hızlandır (fan uç hızı), LPT kademe yüklemesini artır ya da BPR'yi düşür. Büyük turbofanlarda bu yüzden dişli fan kullanılır.`,
      fix: 'LP milini hızlandır (uç hızı), LPT kademe yüklemesini artır ya da baypas oranını düşür.',
      tags: () => ['lpt'],
      knobs: ['fan.tipSpeed'],
      knobsOf: (c) => [
        frontModule(c.graph) ? tipKnobOf(c, 'front') : 'lpt.tipSpeed',
        'lpt.loading',
        ...(mod(c.graph, 'fan') ? ['fan.bypassRatio'] : []),
      ],
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
        // Aynı mildeki devir sınırları (fan ucu Mach'ı, AN²) ve düğme aralığı:
        // gereken hız bunları aşıyorsa uç hızı önerilmez (yükleme denenir)
        const cap = Math.min(tipSpeedCap(c, 'lp') ?? Infinity, rangeOf(c, `${knobMod.type}.tipSpeed`)[1]);
        if (v > cap) return undefined;
        const name = front ? rowName('front', c.graph) : 'Güç türbini';
        return remedy(`${knobMod.type}.tipSpeed`, v, `${name} uç hızı ${fmtNum(knobMod.tipSpeed)} → ${fmtNum(v)} m/s`);
      },
      alternatives: [
        (c) => {
          // x ∝ 1/ψ: kademe sayısını 7·0,98'e indiren yükleme. Gerçek ψ ≤
          // düğmedeki ψ (kademe yukarı yuvarlanır): türbin yükleme sınırının
          // %2 içinde kalmalı
          const r = c.s.rows.lpt;
          const lpt = mod<TurbineModule>(c.graph, 'lpt');
          if (!r || !lpt) return undefined;
          const x = (r.stages * r.loading) / lpt.loading;
          const v = clean(ceilTo((lpt.loading * x) / (INSIDE * c.tech.lptStages.caution), 0.01));
          if (v > Math.min(INSIDE * c.tech.loading.turbine.caution, rangeOf(c, 'lpt.loading')[1])) return undefined;
          return remedy('lpt.loading', v, `LPT yüklemesi ${fmtNum(lpt.loading, 2)} → ${fmtNum(v, 2)}`);
        },
      ],
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
        `Karıştırıcıda baypas/çekirdek basınç oranı ${fmtNum(v, 3)}: akışlar eşit basınçta buluşmazsa karışma kaybı büyür ve biri ötekini tıkar. 'Düzelt' fan basınç oranını (aralığı yetmezse baypas oranını) dengeler.`,
      fix: 'Fan basınç oranını ya da baypas oranını dengele (P19t ≈ P5t).',
      tags: () => ['mixer'],
      knobs: ['fan.pr', 'fan.bypassRatio'],
      glossary: 'mixer',
      remedy: (c) => mixerRemedy(c, 'fan.pr'),
      alternatives: [(c) => mixerRemedy(c, 'fan.bypassRatio')],
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

const SEVERITY_RANK: Record<Severity, number> = { info: 0, caution: 1, warning: 2 };

/** Kırpma değeri değiştirdi mi (kayan nokta artığı sayılmaz) */
function sameKnobValue(a: KnobValue, b: KnobValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
  return a === b;
}

/**
 * Öneri uygulanmış motorun uyarıları; uygulanamıyorsa null. Mağaza gibi
 * uygular: değer düğmenin aralığına, çok varyantlı ailede varyant düğmesi
 * ayrıca aile zarfına kırpılır (store.ts writeKnob) ve motor ailenin
 * referansıyla kurulur. Kırpma değeri değiştiriyorsa öneri geçersizdir:
 * oyuncunun alacağı değer etikettekinden farklı olur.
 */
function findingsAfter(ctx: WarnCtx, rem: NonNullable<Finding['remedy']>): Finding[] | null {
  const k = knobById(rem.knob);
  const kc = knobCtx(ctx.graph, { tech: ctx.tech, family: ctx.family });
  if (!k || !k.range(kc)) return null;
  let v = clampEngineKnob(k, rem.value, kc);
  const fam = ctx.family;
  const env = k.scope === 'variant' && fam && fam.variants.length > 1 ? fam.envelope[k.id] : undefined;
  if (env && typeof v === 'number') v = Math.min(env[1], Math.max(env[0], v));
  if (!sameKnobValue(v, rem.value)) return null;
  const graph = k.set(ctx.graph, v);
  try {
    const built = buildEngine(graph, { reference: ctx.reference });
    const s = summarize(built);
    assertFiniteSummary(s);
    return evaluateRules(WARNING_RULES, { ...ctx, graph, built, s }, { remedies: false });
  } catch (e) {
    if (isDesignFailure(e)) return null;
    throw e;
  }
}

/**
 * "Düzelt" önerisi geçerli mi: (a) motor referansla kurulur, (b) aralığa
 * kırpılmış değerle bulgu kalkar, (c) öncekinde olmayan (ya da daha hafif
 * olan) hiçbir caution/warning doğmaz. `cache`: aynı öneri (ör. iki uç
 * hızı bulgusu aynı LP devrini önerir) bir kez kurulur.
 */
function remedyHolds(
  ctx: WarnCtx,
  f: Finding,
  rem: NonNullable<Finding['remedy']>,
  before: Map<string, number>,
  cache: Map<string, Finding[] | null>,
): boolean {
  const key = `${rem.knob}=${String(rem.value)}`;
  let after = cache.get(key);
  if (after === undefined) cache.set(key, (after = findingsAfter(ctx, rem)));
  if (!after) return false;
  return after.every((a) => a.severity === 'info' || (a.id !== f.id && (before.get(a.id) ?? -1) >= SEVERITY_RANK[a.severity]));
}

/**
 * < 2 ms, taslakta da çağrılır. "Düzelt" önerileri hesaplanır ve
 * `remedyHolds` ile sınanır; geçmeyen öneri yerine kuralın öteki düğmeleri
 * (`alternatives`) denenir, hiçbiri geçmezse öneri gösterilmez. Sürükleme
 * taslağında `remedies: false` ile atlanır.
 */
export function evaluateWarnings(ctx: WarnCtx, opts: { remedies?: boolean } = {}): Finding[] {
  const out = evaluateRules(WARNING_RULES, ctx, opts);
  const before = new Map(out.map((f) => [f.id, SEVERITY_RANK[f.severity]]));
  const cache = new Map<string, Finding[] | null>();
  for (const f of out) {
    const r = RULE_BY_ID.get(f.id);
    if (r?.groupOf) f.group = r.groupOf(ctx);
    f.knobs = knobsPresent(ctx.graph, r?.knobsOf ? r.knobsOf(ctx) : f.knobs);
    if (opts.remedies === false || f.severity === 'info') continue;
    let rem = f.remedy && remedyHolds(ctx, f, f.remedy, before, cache) ? f.remedy : undefined;
    for (const alt of rem ? [] : (r?.alternatives ?? [])) {
      const a = alt(ctx);
      if (a && remedyHolds(ctx, f, a, before, cache)) {
        rem = a;
        break;
      }
    }
    f.remedy = rem;
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
  /**
   * Tam güç. `N1`/`N2`: ölçülen devir ile FADEC hedefinden küçüğü (devir
   * sınırına dayanan hedef pencerede henüz oturmamış olabilir). `power`:
   * pervaneli/mil çıkışlı motorda mil gücü / tasarım mil gücü.
   */
  full: { N1: number; N2: number; power?: number; egtLimited: boolean; surgeMargin: number };
}

/** Tam güç ölçüsü eşikleri: jet N1, pervaneli/mil çıkışlı motorda mil gücü */
const FULL_N1_MIN = 0.95;
/**
 * Mil gücü N2 ile hızla (≈ N2⁵) düşer: %90 güç ≈ N2 %98. Jette N1 %95 ≈ itki
 * %85–87; güç ölçüsü 1 s'lik pencerede henüz oturmadığı için biraz sıkı.
 */
const FULL_POWER_MIN = 0.9;

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
    // Pervaneli/mil çıkışlı motorda N1 güç türbini devridir ve onu pervane
    // valisi %100'de tutar: ölçü teslim edilen mil gücü
    metric: (c) => (c.full.egtLimited ? 0 : (c.full.power ?? c.full.N1)),
    dir: 'below',
    limits: (c) => ({ caution: c.full.power !== undefined ? FULL_POWER_MIN : FULL_N1_MIN }),
    unit: '',
    digits: 2,
    title: (_v, c) =>
      c.full.egtLimited
        ? 'Tam güçte EGT sınırlayıcı devrede'
        : c.full.power !== undefined
          ? `Tam güçte mil gücü %${fmtNum(c.full.power * 100)}`
          : `Tam güçte N1 %${fmtNum(c.full.N1 * 100)}`,
    text: (_v, _l, c) =>
      c.full.egtLimited
        ? 'Tam güçte EGT sürekli sınıra dayanıyor: FADEC yakıtı kısıyor, tasarım itkisine ulaşılamıyor.'
        : c.full.power !== undefined
          ? `Tam güçte mil gücü tasarımın %${fmtNum(c.full.power * 100)}'i (gaz jeneratörü N2 %${fmtNum(c.full.N2 * 100)}): gaz jeneratörü tasarım devrine çıkamıyor; güç türbini devrini vali tutuyor ama teslim edilen güç beklenenden az.`
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
 * Benzetim süreleri [s]: rölanti trim'i rölanti devrinden başlar ve oturur;
 * tam güç tasarım noktasında (denge) başlar, sağlıklı motor orada kalır.
 * Tasarımı tutamayan motor pencerede oturmaz, ama sapma yönü görünür: yakıt
 * sınırında (surge) N1 1 s'de %92'ye iner, devir sınırında FADEC hedefi ilk
 * adımdan bellidir (ölçüye katılır). Benzetim saniyesi 7–14 ms; süre bütçeyi
 * aşacaksa adım sayısı azalır (en az MIN_SECONDS). Yüklü makinede ve ilk
 * çağrıda (JIT ısınması) bütçe aşılabilir; çağrı yalnız boşta yapılır.
 */
const IDLE_SECONDS = 2;
const FULL_SECONDS = 1;
const MIN_SECONDS = 0.5;
const DT = 1 / 60;

/**
 * trim(0 s) durumu kurar; adımlar bütçe içinde (saate bakarak) atılır. Bir
 * sonraki adım süre sınırını aşacaksa (en pahalı adım kadar pay) durur.
 */
function trimWithin(sim: EngineSim, throttle: number, seconds: number, deadline: number): void {
  sim.trim(throttle, 0);
  let now = performance.now();
  let stepMax = 0;
  for (let t = 0; t < seconds; t += DT) {
    if (t >= MIN_SECONDS && now + stepMax > deadline) break;
    sim.step(DT);
    const after = performance.now();
    stepMax = Math.max(stepMax, after - now);
    now = after;
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
  // Pervaneli/mil çıkışlı motorda FADEC gaz jeneratörünü (N2) yönetir, güç
  // türbini devrini yük valisi tutar. Pal tasarım noktasındaki dengede
  // (güç = tasarım mil gücü) başlar; ince palla başlasa pencere güç
  // türbininin geçici aşırı devrini (%109–114) ölçerdi.
  const shaftOut = b.traits.output !== 'thrust';
  if (shaftOut) hot.propPitch = 1;
  trimWithin(hot, 1, FULL_SECONDS, t0 + OPERABILITY_BUDGET_MS);
  const full = {
    N1: Math.min(hot.N1, hot.n1Command ?? hot.N1),
    N2: Math.min(hot.N2, hot.n2Command ?? hot.N2),
    power: shaftOut ? hot.propPower / Math.max(r.shaftPower, 1) : undefined,
    egtLimited: hot.egtLimited,
    surgeMargin: hot.cycle.surgeMargin,
  };
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

/**
 * Sonlu olmaması tasarımı anlamsızlaştıran büyüklükler (evaluate ve
 * "Düzelt" sınaması): NaN'lı özette kurallar hiçbir şey bulmaz, motor
 * sağlıklı sanılırdı.
 */
export function assertFiniteSummary(s: DesignSummary): void {
  const checks: [string, number | undefined][] = [
    ['itki', s.thrust],
    ['kütle', s.mass],
    ['çap', s.diameter],
    ['boy', s.length],
    ['T4', s.t4],
    ['mil gücü', s.output === 'thrust' ? 0 : s.shaftPower],
  ];
  for (const [what, v] of checks) if (v === undefined || !Number.isFinite(v)) throw new NonFiniteDesignError(what);
}

/** Beklenen tasarım hatası mı (atölye yakalar; konsola düşmez) */
export function isDesignFailure(e: unknown): boolean {
  return e instanceof GraphError || e instanceof FlowpathError || e instanceof DesignError || e instanceof NonFiniteDesignError;
}

/** Türbin çıkış Mach'ı bunun altındaysa kapanmanın nedeni oyuncunun Mach'ı sayılır (aralık 0,15–0,55) */
const TURBINE_LOW_EXIT_MACH = 0.2;

/**
 * Türbin kanalının genişlemeden kapanma nedeni ve temel düğmeleri: HPT
 * kompresörü çevirir (T4, HPC PR); LPT milin yüküne göre fanı (BPR, FPR) ya
 * da LPC'yi (LPC PR, T4) çevirir. Serbest güç türbininde, yükü bilinmeyen
 * LPT'de ya da çıkış Mach'ı çok düşükken (asıl neden uzman düğmesi) null:
 * genel metin kullanılır.
 */
function turbineExpansion(e: FlowpathError, name: string): { cause: string; advice: string; knobs: string[]; glossary: TeachingError['glossary'] } | null {
  const mach1 = e.data?.mach1;
  if (mach1 !== undefined && mach1 <= TURBINE_LOW_EXIT_MACH) return null;
  if (e.group === 'hpt') {
    return { cause: 'türbin kompresörü çevirmek için gazı çok genişletiyor', advice: "T4'ü artır ya da HPC basınç oranını düşür", knobs: ['combustor.tit', 'hpc.pr'], glossary: 'stageLoading' };
  }
  if (e.group !== 'lpt') return null;
  switch (e.data?.lpLoad) {
    case LP_LOAD.fan:
      return { cause: 'türbin fanı çevirmek için gazı çok genişletiyor', advice: "BPR ya da FPR'yi düşür", knobs: ['fan.bypassRatio', 'fan.pr'], glossary: 'bpr' };
    case LP_LOAD.lpc:
      return { cause: `türbin LPC'yi çevirmek için gazı çok genişletiyor`, advice: `LPC basınç oranını düşür ya da T4'ü artır (${name} daha az genişletir)`, knobs: ['lpc.pr', 'combustor.tit'], glossary: 'stageLoading' };
    default:
      return null;
  }
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
        // Türbin çıkışı: kanal gazın genişlemesiyle büyür (LPT'de milin
        // yükünün, HPT'de kompresörün işi); oyuncunun temel düğmeleri de
        // önerilir. Neden oyuncunun düşürdüğü çıkış Mach'ıysa genel metin.
        if (e.group === 'lpt' || e.group === 'hpt') {
          const why = turbineExpansion(e, name);
          if (why) {
            return {
              title: `${name} kanalı kapanıyor`,
              text: `${name} çıkışında kanal kapanıyor: ${why.cause}, çıkışta büyüyen akış uç daralmasıyla kanala sığmıyor. ${why.advice}; uzman ayarda ${name} uç genişlemesini (taper) ya da çıkış Mach'ını artır.`,
              knobs: [...why.knobs, ...(e.knobs.length ? e.knobs : [`${e.group}.taper`, `${e.group}.mach.1`])],
              glossary: why.glossary,
              source: 'flowpath',
              group: e.group,
              raw,
            };
          }
        }
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
      case 'turbine.diskRoom': {
        // layouts/bare.ts checkLptDisk: göbek kanat kökü + disk payıyla mile iniyor
        const d = e.data ?? {};
        const cm = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? `${fmtNum(v * 100, 1)} cm` : '?');
        const why = turbineExpansion(e, name);
        const expert = `uzman ayarda ${name} uç genişlemesini (taper) ya da çıkış Mach'ını artır.`;
        return {
          title: `${name} diski mile sığmıyor`,
          // Gereken pay da yazılır: göbek milin iki katıyken bile neden
          // sığmadığı görünsün (kök + jant göbeğin içine iner, disk göbeği mili sarar)
          text:
            `${name} son kademesinin göbeği ${cm(d.hub)}; kanat kökü ve jant bunun ${cm(d.hub !== undefined && d.rim !== undefined ? d.hub - d.rim : undefined)} içine iniyor (jant tabanı ${cm(d.rim)}). ` +
            `Disk göbeğinin ${cm(d.shaft)}'lik mili sarması için jant tabanı en az ${cm(d.need)} olmalı. ` +
            (why ? `${why.cause[0].toUpperCase()}${why.cause.slice(1)}; büyüyen çıkış kanalı içe, mile doğru açılıyor. ${why.advice}; ${expert}` : `Çıkış kanalı içe, mile doğru açılıyor: ${expert}`),
          knobs: [...(why?.knobs ?? []), ...e.knobs.filter((k) => !why?.knobs.includes(k))],
          glossary: why?.glossary ?? 'stageLoading',
          source: 'flowpath',
          group: e.group,
          raw,
        };
      }
      case 'stages.invalid': {
        // sizeRow: x = Δh/(ψ·U²) sonlu değil ya da > 1000 (evaluate bunu
        // önceden 'knob.range'e çevirir; doğrudan buildEngine çağrısında buradan)
        const tip = e.group === 'hpc' || e.group === 'hpt' ? ['hpc.tipSpeed'] : e.group === 'lpt' ? ['fan.tipSpeed', 'lpc.tipSpeed', 'lpt.tipSpeed'] : e.group === 'lpc' ? ['lpc.tipSpeed', 'fan.tipSpeed'] : [`${e.group}.tipSpeed`];
        return {
          title: `${name} kademe sayısı hesaplanamıyor`,
          text: `${name} kademe sayısı hesaplanamıyor: kademe başına iş uç hızının karesi ve yüklemeyle orantılı, ikisi sıfıra yaklaşınca kademe sayısı sonsuza gider. Milin uç hızını ya da ${name} kademe yüklemesini artır.`,
          knobs: e.knobs.length ? [...e.knobs] : [...tip, `${e.group}.loading`],
          glossary: 'stageLoading',
          source: 'flowpath',
          group: e.group,
          raw,
        };
      }
      case 'layout.notReady':
        return { title: 'Bu mimari yakında', text: raw, knobs: [...e.knobs], source: 'flowpath', group: e.group, raw };
      case 'knob.range':
        // Metin evaluate.ts'te sayıyla kurulur (zaten öğretici)
        return { title: `${name}: değer aralık dışında`, text: raw, knobs: [...e.knobs], source: 'flowpath', group: e.group, raw };
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
