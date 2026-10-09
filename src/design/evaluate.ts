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
import { buildEngine, type BuildOptions, type BuiltEngine } from './graph';
import { summarize, type DesignSummary, type LimitGauge } from './summary';
import { TECH_MODERN, type TechLimits } from './tech';
import type { EngineGraph } from './types';
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

export function evaluate(g: EngineGraph, opts: EvaluateOptions = {}): Evaluation | { error: TeachingError } {
  try {
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
