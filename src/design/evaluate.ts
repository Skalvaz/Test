/**
 * Değerlendirme (M5a): grafik → üretilmiş motor + özet + sınır çubukları +
 * uyarılar; ya da öğretici hata. Atölye mağazası (workshop/store.ts) her
 * düzenlemede bunu çağırır (docs/M5A-SPEC.md §2.12).
 *
 * P0: tipler ve imza. Gövdeyi P3 yazar.
 */

import type { Finding } from './core/rules';
import type { BuildOptions, BuiltEngine } from './graph';
import type { DesignSummary, LimitGauge } from './summary';
import type { EngineGraph } from './types';
import type { TeachingError } from './warnings';

export interface Evaluation {
  graph: EngineGraph;
  built: BuiltEngine;
  summary: DesignSummary;
  gauges: LimitGauge[];
  findings: Finding[];
}

export function evaluate(_g: EngineGraph, _opts?: BuildOptions): Evaluation | { error: TeachingError } {
  throw new Error('P3: değerlendirme henüz yok.');
}
