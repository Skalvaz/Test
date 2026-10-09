/**
 * Değerlendirme (M5a): grafik → üretilmiş motor + özet + sınır çubukları +
 * uyarılar; ya da öğretici hata. Atölye mağazası (workshop/store.ts) her
 * düzenlemede bunu çağırır (docs/M5A-SPEC.md §2.12).
 *
 * Beklenen tasarım hataları (GraphError, FlowpathError, DesignError, sonlu
 * olmayan sonuç) `{ error }` olarak döner, konsola yazılmaz. Beklenmeyen
 * hatalar (program hatası) yeniden atılır: gizlenmesin.
 */

import { sizeEngine } from '../sim/design';
import type { Finding } from './core/rules';
import { computeGasPath, FlowpathError, type RowKey } from './flowpath';
import { buildEngine, toEngineDesign, type BuildOptions, type BuiltEngine } from './graph';
import { fmtNum, summarize, type DesignSummary, type LimitGauge } from './summary';
import { TECH_MODERN, type TechLimits } from './tech';
import type { CompressorModule, EngineGraph, TurbineModule } from './types';
import {
  assertFiniteSummary,
  evaluateGauges,
  evaluateWarnings,
  isDesignFailure,
  knobsPresent,
  translateError,
  type DesignGoal,
  type TeachingError,
  type WarnCtx,
} from './warnings';

export interface Evaluation {
  graph: EngineGraph;
  built: BuiltEngine;
  summary: DesignSummary;
  gauges: LimitGauge[];
  findings: Finding[];
}

/** Üretim seçenekleri + uyarı bağlamı (M5a P3 eki; hepsi isteğe bağlı) */
export interface EvaluateOptions extends BuildOptions {
  /** Görev kartı: hedef zarf uyarısı için */
  goal?: DesignGoal;
  /** Varsayılan TECH_MODERN */
  tech?: TechLimits;
  /** false: pahalı "Düzelt" hesapları atlanır (sürükleme taslağı) */
  remedies?: boolean;
}

/**
 * Kanal düğmelerinin fiziksel aralığı. Grafik kuralları bunları ayırmıyor;
 * aralık dışı değerde (Mach 0, göbek/uç ≥ 1) gaz yolu NaN/∞ kademe ile döner
 * ve 3B yerleşimin kademe döngüleri bitmez, sekme donar. Atölyenin kaydırıcı
 * aralıkları dardır, ama dosyadan yüklenen proje de buradan geçer (aile
 * tabanı içe aktarmada kırpılmaz). Bu yalnız güvenlik ağı: sınırlar düğme
 * aralıklarından (§2.10) bilerek geniş. Kademe sayısı 1/(ψ·U²) ile büyür:
 * asıl sınır gaz yolundaki kademe tavanıdır (checkStages).
 */
const ROW_RANGES: { key: string; label: string; get: (m: CompressorModule | TurbineModule) => number | undefined; ok: (v: number) => boolean; range: string }[] = [
  { key: 'mach.0', label: "giriş Mach'ı", get: (m) => m.mach[0], ok: (v) => v > 0 && v < 1, range: '0–1' },
  { key: 'mach.1', label: "çıkış Mach'ı", get: (m) => m.mach[1], ok: (v) => v > 0 && v < 1, range: '0–1' },
  { key: 'hubTip', label: 'göbek/uç oranı', get: (m) => m.hubTip, ok: (v) => v >= 0 && v < 1, range: '0–1' },
  { key: 'taper', label: 'uç daralması', get: (m) => m.taper, ok: (v) => v > 0 && v < 3, range: '0–3' },
  { key: 'loading', label: 'kademe yüklemesi', get: (m) => m.loading, ok: (v) => v >= 0.05 && v <= 10, range: '0,05–10' },
  // Düğmeler 300 m/s'den başlar; kademe ∝ 1/U², 100 m/s'de bile yüzlerce kademe
  { key: 'tipSpeed', label: 'uç hızı', get: (m) => m.tipSpeed, ok: (v) => v >= 100 && v < 1000, range: '100–1000 m/s' },
];
const ROW_MODULES = new Set(['fan', 'lpc', 'hpc', 'hpt', 'lpt']);

function checkRanges(g: EngineGraph): void {
  if (!(Number.isFinite(g.massFlow) && g.massFlow > 0)) {
    throw new FlowpathError(`Hava akışı ${g.massFlow}: sıfırdan büyük olmalı.`, 'knob.range', 'engine', ['engine.massFlow'], { value: g.massFlow });
  }
  for (const m of g.modules) {
    if (!ROW_MODULES.has(m.type)) continue;
    const row = m as CompressorModule | TurbineModule;
    for (const r of ROW_RANGES) {
      const v = r.get(row);
      if (v === undefined || (Number.isFinite(v) && r.ok(v))) continue;
      const name = m.type === 'fan' ? 'Fan' : m.type.toUpperCase();
      throw new FlowpathError(
        `${name} ${r.label} ${Number.isFinite(v) ? fmtNum(v, 3) : String(v)}: fiziksel aralığın (${r.range}) dışında; kanal ve kademe sayısı hesaplanamaz.`,
        'knob.range',
        m.type,
        [`${m.type}.${r.key}`],
        { value: v },
      );
    }
  }
}

/**
 * Bir sıranın kademe tavanı. Kademe sayısı x = Δh/(ψ·U²) kapalı biçimde
 * hesaplanır ama kütle ve 3B yerleşim kademe kademe döner: dosyadan gelen
 * uç hızı 0,1 m/s ile 49 milyon kademe sekmeyi dondururdu. Düğme
 * aralıklarının uç birleşimleri de saçma uzun sıra kurabilir (TF: yavaş fan,
 * BPR 11, düşük LPT yüklemesi ≈ 300 kademe; uyarı lptStages): tavan onları
 * engellemez, yalnız donmayı önler.
 */
export const MAX_ROW_STAGES = 1000;

const ROW_KEYS: RowKey[] = ['front', 'booster', 'hpc', 'hpt', 'lpt'];

/**
 * Kademe tavanı denetimi: gaz yolu (tasarım noktası + kanallar, kademe
 * başına döngü yok) kütle ve yerleşimden önce kurulur (~0,01 ms; üretim
 * ~0,1 ms).
 */
function checkStages(g: EngineGraph, opts: BuildOptions): void {
  const gas = computeGasPath(g, sizeEngine(toEngineDesign(g, opts)), opts);
  const has = (t: string) => g.modules.some((m) => m.type === t);
  // Milin devrini belirleyen uç hızı düğmesi (warnings.ts spoolModule)
  const lpTip = has('fan') ? 'fan.tipSpeed' : has('lpc') ? 'lpc.tipSpeed' : 'lpt.tipSpeed';
  for (const k of ROW_KEYS) {
    const n = gas[k]?.stages;
    if (n === undefined || n <= MAX_ROW_STAGES) continue;
    const type = k === 'front' ? (has('fan') ? 'fan' : 'lpc') : k === 'booster' ? 'lpc' : k;
    const name = type === 'fan' ? 'Fan' : type.toUpperCase();
    const tip = k === 'hpc' || k === 'hpt' ? 'hpc.tipSpeed' : lpTip;
    throw new FlowpathError(
      `${name} ${Number.isFinite(n) ? fmtNum(n) : String(n)} kademe istiyor (en çok ${MAX_ROW_STAGES}): uç hızı ya da kademe yüklemesi fiziksel aralığın çok dışında.`,
      'knob.range',
      type,
      [tip, `${type}.loading`],
      { value: n },
    );
  }
}

export function evaluate(g: EngineGraph, opts: EvaluateOptions = {}): Evaluation | { error: TeachingError } {
  try {
    checkRanges(g);
    checkStages(g, opts);
    const built = buildEngine(g, opts);
    const summary = summarize(built);
    assertFiniteSummary(summary);
    const ctx: WarnCtx = { graph: g, built, s: summary, tech: opts.tech ?? TECH_MODERN, goal: opts.goal, reference: opts.reference };
    return {
      graph: g,
      built,
      summary,
      gauges: evaluateGauges(ctx),
      findings: evaluateWarnings(ctx, { remedies: opts.remedies }),
    };
  } catch (e) {
    if (!isDesignFailure(e)) throw e;
    const error = translateError(e);
    // Motorda olmayan modüllerin düğmeleri panelde işaretlenmez
    return { error: { ...error, knobs: knobsPresent(g, error.knobs) } };
  }
}

/** Sonuç tipi ayrımı */
export const isEvaluation = (r: Evaluation | { error: TeachingError }): r is Evaluation => !('error' in r);
