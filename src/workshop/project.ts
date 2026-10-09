/**
 * Atölye projesi (M5a): aileler, etkin aile, uzman kipi, kıyas noktası ve
 * görev. Saf TS durum: three.js ve DOM yok (docs/M5A-SPEC.md §2.13).
 *
 * Aile tabanı şablondan kopyalanırken `ops` (çalışabilirlik) atılır: atölye
 * motorunun ataleti, marş torku ve aksesuar gücü ailenin şablonundan
 * ölçeklenir (operability.ts, `BuildOptions.reference`).
 */

import type { Architecture } from '../design/architecture';
import type { Family } from '../design/core/family';
import { TEMPLATES } from '../design/catalog';
import {
  familyFromDoc,
  familyToDoc,
  type DocExtras,
  type EngineDocV1,
  type WorkshopProjectDocV1,
} from '../design/engineDoc';
import { buildEngine, type BuiltEngine } from '../design/graph';
import { ENGINE_KNOBS, type KnobRangeCtx } from '../design/knobs';
import type { TemplateId } from '../design/templates';
import type { EngineTraits } from '../design/traits';
import type { DesignGoal } from '../design/warnings';
import type { EngineGraph } from '../design/types';
import { goalById } from './goals';

export type { TemplateId } from '../design/templates';
export type { HandleId } from '../design/handles';
export type { ModuleRef } from '../design/partsMap';

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

/** Proje sınırları */
export const MAX_FAMILIES = 8;
export const MAX_VARIANTS = 4;

/** Şablon kimlikleri, başlangıç ekranındaki sırada */
export const TEMPLATE_IDS: readonly TemplateId[] = ['turbojet', 'turbojetDry', 'militaryTurbofan', 'turbofanMixed', 'turbofan', 'turboprop', 'turboshaft'];

/** Henüz şablonu olmayan aile için en yakın şablon (P5–P7 birleşene dek) */
const TEMPLATE_FALLBACK: Partial<Record<TemplateId, TemplateId>> = {
  turbojetDry: 'turbojet',
  turbofanMixed: 'turbofan',
  turboshaft: 'turboprop',
};

/** Türetilmiş tipe göre ailenin şablonu (çalışabilirlik referansı) */
export function templateFor(t: EngineTraits): TemplateId {
  switch (t.presentation) {
    case 'turbojet':
      return t.afterburner ? 'turbojet' : 'turbojetDry';
    case 'militaryTurbofan':
      return 'militaryTurbofan';
    case 'turbofan':
      return t.exhaust === 'mixed' ? 'turbofanMixed' : 'turbofan';
    default:
      return t.presentation;
  }
}

/** Var olan şablon (yoksa en yakını) */
export function existingTemplate(id: TemplateId): TemplateId {
  return TEMPLATES[id] ? id : (TEMPLATE_FALLBACK[id] ?? 'turbofan');
}

const refCache = new Map<TemplateId, BuiltEngine>();

/** Ailenin referans motoru: şablonun üretilmiş hali (önbellekli) */
export function referenceBuilt(id: TemplateId): BuiltEngine {
  const key = existingTemplate(id);
  let b = refCache.get(key);
  if (!b) {
    b = buildEngine(TEMPLATES[key]!);
    refCache.set(key, b);
  }
  return b;
}

/** Aile adının açıklayıcı kısmı ("AT-1 Sade turbojet") */
export function familyLabel(t: EngineTraits): string {
  switch (t.presentation) {
    case 'turbojet':
      return t.afterburner ? 'Art yakıcılı turbojet' : 'Sade turbojet';
    case 'militaryTurbofan':
      return t.afterburner ? 'Art yakıcılı turbofan' : 'Düşük baypaslı turbofan';
    case 'turbofan':
      return t.exhaust === 'mixed' ? 'Karışık akışlı turbofan' : 'Turbofan';
    case 'turboprop':
      return 'Turboprop';
    default:
      return 'Turboşaft';
  }
}

/** Sıradaki aile kodu: AT-1, AT-2, … */
export function nextFamilyCode(p: { families: { code: string }[] }): string {
  let n = 0;
  for (const f of p.families) {
    const m = /^AT-(\d+)$/.exec(f.code);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `AT-${n + 1}`;
}

/** Varyantın otomatik adı: itki kN'u ya da mil gücü (100 kW biriminde) */
export function autoVariantName(code: string, s: { output: string; thrust: number; shaftPower?: number }): string {
  return s.output === 'thrust' || s.shaftPower === undefined ? `${code}/${Math.round(s.thrust / 1e3)}` : `${code}/${Math.round(s.shaftPower / 1e5)}`;
}

/** Şablon/bağışçı grafiğinden aile tabanı: kind ve çalışabilirlik atılır */
export function familyBase(g: EngineGraph): EngineGraph {
  const c = structuredClone(g);
  delete c.kind;
  // Uzman düzeltmesi (aksesuar gücü) korunur; geri kalan ops referanstan ölçeklenir
  const acc = c.ops?.accessoryPower;
  delete c.ops;
  if (acc !== undefined) c.ops = { accessoryPower: acc };
  return c;
}

/**
 * Varyant zarfı: her varyant düğmesi için taban değerinin ±%15'i (basınç
 * oranında ±%10) ile düğme aralığının kesişimi.
 */
export function defaultEnvelope(base: EngineGraph, ctx: KnobRangeCtx): Record<string, [number, number]> {
  const env: Record<string, [number, number]> = {};
  for (const k of ENGINE_KNOBS) {
    if (k.scope !== 'variant') continue;
    const r = k.range(ctx);
    const v = k.get(base);
    if (!r || typeof v !== 'number') continue;
    const f = k.id.endsWith('.pr') ? 0.1 : 0.15;
    env[k.id] = [Math.max(r[0], v * (1 - f)), Math.min(r[1], v * (1 + f))];
  }
  return env;
}

/** Proje → belge (aile başına yan bilgiler korunur) */
export function projectToDoc(p: WorkshopProject, extras: ReadonlyMap<string, DocExtras> = new Map()): WorkshopProjectDocV1 {
  return {
    format: 'tfa-workshop',
    v: 1,
    families: p.families.map((f) => {
      const x = extras.get(f.id) ?? {};
      const meta = { ...(x.meta ?? { created: new Date().toISOString(), modified: '' }), modified: new Date().toISOString() };
      return familyToDoc(f, { ...x, meta });
    }),
    active: p.activeFamily,
    expert: p.expert,
    ...(p.goal ? { goal: p.goal.id } : {}),
  };
}

/** Belge → proje + aile yan bilgileri */
export function projectFromDoc(d: WorkshopProjectDocV1): { project: WorkshopProject; extras: Map<string, DocExtras> } {
  const extras = new Map<string, DocExtras>();
  const families = d.families.map((doc: EngineDocV1) => {
    const r = familyFromDoc(doc);
    extras.set(r.family.id, r.extras);
    return r.family as EngineFamily;
  });
  const goal = d.goal ? goalById(d.goal) : undefined;
  return {
    project: { families, activeFamily: d.active, expert: d.expert, ...(goal ? { goal } : {}) },
    extras,
  };
}
