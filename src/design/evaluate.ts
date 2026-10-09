/**
 * Değerlendirme (M5a): grafik → üretilmiş motor + özet + sınır çubukları +
 * uyarılar; ya da öğretici hata. Atölye mağazası (workshop/store.ts) her
 * düzenlemede bunu çağırır (docs/M5A-SPEC.md §2.12).
 *
 * Beklenen tasarım hataları (GraphError, FlowpathError, DesignError, sonlu
 * olmayan sonuç) `{ error }` olarak döner, konsola yazılmaz. Beklenmeyen
 * hatalar (program hatası) yeniden atılır: gizlenmesin.
 */

import type { Finding } from './core/rules';
import { FlowpathError } from './flowpath';
import { buildEngine, type BuildOptions, type BuiltEngine } from './graph';
import { fmtNum, summarize, type DesignSummary, type LimitGauge } from './summary';
import { TECH_MODERN, type TechLimits } from './tech';
import type { CompressorModule, EngineGraph, TurbineModule } from './types';
import {
  evaluateGauges,
  evaluateWarnings,
  isDesignFailure,
  knobsPresent,
  NonFiniteDesignError,
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

/** Sonlu olmaması tasarımı anlamsızlaştıran büyüklükler */
function assertFinite(s: DesignSummary): void {
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

/**
 * Kanal düğmelerinin fiziksel aralığı. Grafik kuralları bunları ayırmıyor;
 * aralık dışı değerde (Mach 0, göbek/uç ≥ 1) gaz yolu NaN/∞ kademe ile döner
 * ve 3B yerleşimin kademe döngüleri bitmez, sekme donar. Atölyenin kaydırıcı
 * aralıkları dardır, ama dosyadan yüklenen proje de buradan geçer. Bu yalnız
 * güvenlik ağı: sınırlar düğme aralıklarından (§2.10) bilerek geniş.
 */
const ROW_RANGES: { key: string; label: string; get: (m: CompressorModule | TurbineModule) => number | undefined; ok: (v: number) => boolean; range: string }[] = [
  { key: 'mach.0', label: "giriş Mach'ı", get: (m) => m.mach[0], ok: (v) => v > 0 && v < 1, range: '0–1' },
  { key: 'mach.1', label: "çıkış Mach'ı", get: (m) => m.mach[1], ok: (v) => v > 0 && v < 1, range: '0–1' },
  { key: 'hubTip', label: 'göbek/uç oranı', get: (m) => m.hubTip, ok: (v) => v >= 0 && v < 1, range: '0–1' },
  { key: 'taper', label: 'uç daralması', get: (m) => m.taper, ok: (v) => v > 0 && v < 3, range: '0–3' },
  { key: 'loading', label: 'kademe yüklemesi', get: (m) => m.loading, ok: (v) => v >= 0.05 && v <= 10, range: '0,05–10' },
  { key: 'tipSpeed', label: 'uç hızı', get: (m) => m.tipSpeed, ok: (v) => v > 0 && v < 1000, range: '0–1000 m/s' },
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

export function evaluate(g: EngineGraph, opts: EvaluateOptions = {}): Evaluation | { error: TeachingError } {
  try {
    checkRanges(g);
    const built = buildEngine(g, opts);
    const summary = summarize(built);
    assertFinite(summary);
    const ctx: WarnCtx = { graph: g, built, s: summary, tech: opts.tech ?? TECH_MODERN, goal: opts.goal };
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
