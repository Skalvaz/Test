/**
 * Kararlı serileştirme biçimi (M5a): motor ailesi belgesi `EngineDocV1` ve
 * atölye projesi `WorkshopProjectDocV1` (docs/M5A-SPEC.md §2.14). Kanonik
 * kurallar design/core/doc.ts'te; `modules` dizisi MODULE_ORDER sırasında.
 *
 * P0: tipler, `graphRev` (buildEngine `rev`'i bundan) ve imzalar.
 * Okuma/yazma gövdelerini P4b yazar.
 */

import type { KnobValue } from './core/knob';
import { canonicalJson, fnv1a64, type Migrator } from './core/doc';
import { MODULE_ORDER, type EngineGraph } from './types';
import type { TemplateId } from './templates';

/** kind türetilir, yazılmaz */
export type GraphDoc = Omit<EngineGraph, 'kind'>;

export interface EngineDocV1 {
  format: 'tfa-engine';
  v: 1;
  family: {
    /** 'f_' + 10 karakter Crockford base32 (kalıcı) */
    id: string;
    code: string;
    name: string;
    /** TAM grafik: şablona göre fark DEĞİL (şablonlar yeniden kalibre edilebilir) */
    base: GraphDoc;
    envelope?: Record<string, [number, number]>;
    origin?: { from: 'template' | 'wizard' | 'import'; template?: TemplateId; app: string };
  };
  /** id: 'v_' + 8 karakter */
  variants: { id: string; name: string; nameLocked?: boolean; values: Record<string, KnobValue> }[];
  active: string;
  meta: { created: string; modified: string; author?: string; notes?: string; tech?: string };
  /** Bilinmeyen alanlar okunur ve geri yazılır */
  ext?: Record<string, unknown>;
}

export interface WorkshopProjectDocV1 {
  format: 'tfa-workshop';
  v: 1;
  families: EngineDocV1[];
  active: string;
  expert: boolean;
  goal?: string;
}

/** Kanonik sıralama: modül dizisi akış sırasında */
export const DOC_ORDER = { modules: MODULE_ORDER } as const;

/** Grafiğin kimliği: 'r' + fnv1a64(kanonik(grafik \ kind)). Aynı grafik, aynı rev. */
export function graphRev(g: EngineGraph): string {
  const doc: Partial<EngineGraph> = { ...g };
  delete doc.kind;
  return 'r' + fnv1a64(canonicalJson(doc, { order: DOC_ORDER }));
}

/** M5a'da boş */
export const MIGRATIONS: readonly Migrator[] = [];

const todo = (): never => {
  throw new Error('P4b: belge okuma/yazma henüz yok.');
};

/** Kanonik JSON */
export function serializeDoc(_d: EngineDocV1): string {
  return todo();
}

export function parseDoc(_json: string): { doc?: EngineDocV1; errors: string[]; notes: string[] } {
  return todo();
}

export function variantRev(_d: EngineDocV1, _variantId: string): string {
  return todo();
}
