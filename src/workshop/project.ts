/**
 * Atölye projesi (M5a): aileler, etkin aile, uzman kipi, kıyas noktası ve
 * görev. Saf TS durum: three.js ve DOM yok (docs/M5A-SPEC.md §2.13).
 *
 * P0: tipler. Proje işlemlerini P4b yazar.
 */

import type { Architecture } from '../design/architecture';
import type { Family } from '../design/core/family';
import type { DesignGoal } from '../design/warnings';
import type { EngineGraph, ModuleType } from '../design/types';

export type { TemplateId } from '../design/templates';

export type EngineFamily = Family<EngineGraph, Architecture>;

export interface WorkshopProject {
  /** En çok 8 (M5a) */
  families: EngineFamily[];
  activeFamily: string;
  expert: boolean;
  /** Kıyas noktası */
  baseline?: { familyId: string; variantId: string; graph: EngineGraph };
  goal?: DesignGoal;
}

/** Seçilebilir modül ya da motorun bütünü */
export type ModuleRef = ModuleType | 'engine';

/** 3B temel tutamaçlar */
export type HandleId = 'frontTip' | 'propTip' | 'length:fan' | 'length:lpc' | 'length:hpc' | 'nozzleExit';

/** Proje sınırları */
export const MAX_FAMILIES = 8;
export const MAX_VARIANTS = 4;
