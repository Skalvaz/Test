/**
 * Oyundaki motorlar: dördü de modül grafiğinden üretilir (M4a: turbojet,
 * askeri turbofan; M4b: turboprop, yüksek baypaslı turbofan). Simülasyon
 * tasarımı ve 3B yerleşim aynı kaynaktan gelir.
 */

import { ENGINE_CATALOG, type EngineDesign, type EngineKind } from '../sim/design';
import type { BareJetLayout, EngineLayout, TurbofanLayout, TurbopropLayout } from './flowpath';
import { buildEngine, type BuiltEngine } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph } from './types';

export const ENGINE_GRAPHS: Partial<Record<EngineKind, EngineGraph>> = {
  turbojet: TURBOJET_GRAPH,
  militaryTurbofan: MILITARY_TURBOFAN_GRAPH,
  turboprop: TURBOPROP_GRAPH,
  turbofan: TURBOFAN_GRAPH,
};

const built = new Map<EngineKind, BuiltEngine>();

/** Grafikten üretilmiş motor (önbellekli); grafiği olmayan tipte undefined */
export function builtEngine(kind: EngineKind): BuiltEngine | undefined {
  const g = ENGINE_GRAPHS[kind];
  if (!g) return undefined;
  let b = built.get(kind);
  if (!b) {
    b = buildEngine(g);
    built.set(kind, b);
  }
  return b;
}

/**
 * Bir motor tipinin grafiğini değiştirir (atölye ve kayıt kancası); null
 * şablona döndürür. Sonra App.setEngine / rebuildVisual ile model ve
 * simülasyon yeniden kurulmalıdır. Geçersiz grafikte hata atar, eskisi kalır.
 */
export function overrideGraph(kind: EngineKind, graph: EngineGraph | null): BuiltEngine | undefined {
  const g = graph ?? TEMPLATES[kind];
  if (!g) return undefined;
  const b = buildEngine(g);
  ENGINE_GRAPHS[kind] = g;
  built.set(kind, b);
  return b;
}

const TEMPLATES: Partial<Record<EngineKind, EngineGraph>> = { ...ENGINE_GRAPHS };

/** Simülasyonun kullanacağı tasarım */
export function engineDesign(kind: EngineKind): EngineDesign {
  return builtEngine(kind)?.design ?? ENGINE_CATALOG[kind];
}

/** Motorun 3B yerleşimi (grafikten üretilen tiplerde) */
export function engineLayout(kind: EngineKind): EngineLayout | undefined {
  return builtEngine(kind)?.flowpath.layout;
}

/** Çıplak motor 3B yerleşimi */
export function bareJetLayout(kind: EngineKind): BareJetLayout | undefined {
  const l = engineLayout(kind);
  return l?.style === 'bare' ? l : undefined;
}

/** Kaportalı turbofan 3B yerleşimi */
export function turbofanLayout(kind: EngineKind): TurbofanLayout | undefined {
  const l = engineLayout(kind);
  return l?.style === 'turbofan' ? l : undefined;
}

/** Turboprop 3B yerleşimi */
export function turbopropLayout(kind: EngineKind): TurbopropLayout | undefined {
  const l = engineLayout(kind);
  return l?.style === 'turboprop' ? l : undefined;
}
