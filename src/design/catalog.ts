/**
 * Oyundaki motorlar: modül grafiğinden üretilenler (M4a: turbojet ve askeri
 * turbofan) ve henüz elle ölçülendirilmiş olanlar (M4b'ye kadar: yüksek
 * baypaslı turbofan, turboprop). Simülasyon tasarımı ve 3B yerleşim aynı
 * kaynaktan gelir.
 */

import { ENGINE_CATALOG, type EngineDesign, type EngineKind } from '../sim/design';
import type { BareJetLayout } from './flowpath';
import { buildEngine, type BuiltEngine } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOJET_GRAPH } from './templates';
import type { EngineGraph } from './types';

export const ENGINE_GRAPHS: Partial<Record<EngineKind, EngineGraph>> = {
  turbojet: TURBOJET_GRAPH,
  militaryTurbofan: MILITARY_TURBOFAN_GRAPH,
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

/** Çıplak motor 3B yerleşimi (grafikten üretilen tiplerde) */
export function bareJetLayout(kind: EngineKind): BareJetLayout | undefined {
  return builtEngine(kind)?.flowpath.layout;
}
