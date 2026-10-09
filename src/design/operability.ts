/**
 * Çalışabilirlik (atalet, kompresör haritası, limitler, marş sistemi):
 * geometriden henüz türetilmeyen alanlar (docs/M5A-SPEC.md §2.8).
 *
 * Şablonlar bunları `graph.ops` içinde tam verir. Atölye grafiklerinde
 * `ops` yok ya da kısmidir: ailenin şablonundan (referans) ölçeklenir.
 *
 * P0: kimlik taslağı — referansın değerleri aynen, `g.ops` alan alan
 * üstüne yazar. Gerçek ölçeklemeyi (atalet ∝ J, marş torku) P1 yazar;
 * şablonun kendisine uygulanınca bütün oranlar 1 kalmalı. Aksesuar gücü
 * tasarım noktasına girdiği için ayrı ve boyutlandırmadan önce çözülür
 * (resolveAccessoryPower).
 */

import type { EngineDesign } from '../sim/design';
import { GraphError } from './errors';
import type { BuiltEngine } from './graph';
import type { GasPath, MassBreakdown } from './flowpath';
import type { EngineGraph, Operability } from './types';

/** Tasarımın çalışabilirlik alanları (kopya) */
export function opsOf(d: EngineDesign): Operability {
  return { inertia: { ...d.inertia }, hpcMap: { ...d.hpcMap }, limits: { ...d.limits }, start: { ...d.start } };
}

/**
 * Grafiğin taslak çalışabilirliği: referans (varsa) + `g.ops`. Eksik alan
 * kalırsa öğretici GraphError (referanssız atölye grafiği).
 */
export function resolveOperability(g: EngineGraph, ref?: BuiltEngine): Operability {
  const base: Partial<Operability> = ref ? opsOf(ref.design) : {};
  const o = { ...base, ...g.ops };
  if (!o.inertia || !o.hpcMap || !o.limits || !o.start) {
    throw new GraphError(
      'Çalışabilirlik alanları (atalet, kompresör haritası, limitler, marş) eksik: aile şablonu referans verilmeli.',
      'engine.ops',
      'engine',
    );
  }
  return { inertia: { ...o.inertia }, hpcMap: { ...o.hpcMap }, limits: { ...o.limits }, start: { ...o.start } };
}

/**
 * Referans aileye göre ölçeklenmiş çalışabilirlik. P0: kimlik (oranlar 1),
 * `g.ops` alan alan üstüne yazar.
 */
export function deriveOperability(
  g: EngineGraph,
  _b: Omit<BuiltEngine, 'design' | 'rev'>,
  _ref: BuiltEngine,
  refOps: Operability,
): Operability {
  const o = { ...refOps, ...g.ops };
  return { inertia: { ...o.inertia }, hpcMap: { ...o.hpcMap }, limits: { ...o.limits }, start: { ...o.start } };
}

/** Aksesuar gücü ölçeğinin sınırları (§2.8) */
const ACCESSORY_CLAMP: [number, number] = [0.3, 3];

/** Çekirdek (HPC girişi, istasyon 25) akışı: grafikten, boyutlandırmadan önce */
const coreFlow = (g: EngineGraph) => {
  const fan = g.modules.find((m) => m.type === 'fan') as { bypassRatio?: number } | undefined;
  return g.massFlow / (1 + (fan?.bypassRatio ?? 0));
};

/**
 * Aksesuar gücü [W]: `g.ops.accessoryPower` (uzman düzeltmesi) >
 * referanstan ölçek `P_ref·W25/W25,ref` (×[0,3, 3]) > `g.accessoryPower`.
 * Tasarım noktasına (HPT işi) girdiği için toEngineDesign'da, yani
 * boyutlandırmadan önce çözülür. Şablonun kendisine uygulanınca oran 1.
 */
export function resolveAccessoryPower(g: EngineGraph, ref?: BuiltEngine): number {
  const own = g.ops?.accessoryPower;
  if (own !== undefined) return own;
  if (!ref) return g.accessoryPower;
  const k = coreFlow(g) / coreFlow(ref.graph);
  return ref.design.accessoryPower * Math.min(ACCESSORY_CLAMP[1], Math.max(ACCESSORY_CLAMP[0], k));
}

/** Rotor atalet ölçüsü Σ m_rotor·r_ort² (P1) */
export function rotorInertia(_gas: GasPath, _spool: 'lp' | 'hp', _mass: MassBreakdown): number {
  throw new Error('P1: rotor ataleti henüz yok.');
}
