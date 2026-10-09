/**
 * Öğretici uyarılar ve hata çevirisi (M5a, docs/M5A-SPEC.md §2.11). Uyarı
 * kuralları design/core/rules.ts biçimindedir; eşikler tech.ts'ten.
 *
 * P0: tipler ve imzalar. Kuralları, metinleri ve gövdeleri P3 yazar.
 */

import type { Finding, Rule } from './core/rules';
import type { BuiltEngine } from './graph';
import type { DesignSummary } from './summary';
import type { TechLimits } from './tech';
import type { EngineGraph } from './types';

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

/** Uyarı kuralları (P3 doldurur) */
export const WARNING_RULES: readonly Rule<WarnCtx>[] = [];

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

const todo = (): never => {
  throw new Error('P3: uyarılar henüz yok.');
};

/** < 2 ms, taslakta da çağrılır */
export function evaluateWarnings(_ctx: WarnCtx): Finding[] {
  return todo();
}

/** Rölanti ve tam güç trim'i; yalnız tam üretimde, boşta */
export function evaluateOperability(_b: BuiltEngine): Finding[] {
  return todo();
}

export function translateError(_e: unknown): TeachingError {
  return todo();
}
