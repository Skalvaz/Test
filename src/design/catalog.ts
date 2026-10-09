/**
 * Oyundaki motorlar ve tasarım yuvaları. Dört motor tipi de modül
 * grafiğinden üretilir (M4a: turbojet, askeri turbofan; M4b: turboprop,
 * yüksek baypaslı turbofan). Simülasyon tasarımı ve 3B yerleşim aynı
 * kaynaktan gelir.
 *
 * Yuvalar (M5a): her motor tipinin (`EngineKind`) kendi yuvası şablonla
 * başlar; dersler, kayıt sahneleri ve test hücresi kataloğu bu yuvaları
 * kullanır. Oyuncunun tasarımı ayrı `workshop` yuvasındadır: kind
 * yuvalarını ezmez.
 */

import { ENGINE_CATALOG, registerCatalogDesign, type EngineDesign, type EngineKind } from '../sim/design';
import type { EngineLayout } from './flowpath';
import { buildEngine, GraphError, type BuildOptions, type BuiltEngine } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH, type TemplateId } from './templates';
import { TURBOJET_DRY_GRAPH } from './turbojetDry';
import { TURBOSHAFT_GRAPH } from './turboshaft';
import { traitsFromDesign, type EngineTraits } from './traits';
import type { EngineGraph } from './types';

export type SlotId = EngineKind | 'workshop';

/**
 * Aile şablonları. M5a sonunda yedisi de var (P5 kuru turbojet, P6 karışık
 * kaportalı turbofan, P7 turboşaft); o zamana dek eksik olanlar undefined.
 */
export const TEMPLATES: Partial<Record<TemplateId, EngineGraph>> = {
  turbojet: TURBOJET_GRAPH,
  turbojetDry: TURBOJET_DRY_GRAPH,
  militaryTurbofan: MILITARY_TURBOFAN_GRAPH,
  turboprop: TURBOPROP_GRAPH,
  turbofan: TURBOFAN_GRAPH,
  turboshaft: TURBOSHAFT_GRAPH,
};

/** Motor tipi yuvasının şablonu (tipler şablon kimlikleriyle aynı adı taşır) */
const KIND_TEMPLATE: Record<EngineKind, TemplateId> = {
  turbojet: 'turbojet',
  militaryTurbofan: 'militaryTurbofan',
  turboprop: 'turboprop',
  turbofan: 'turbofan',
  turboshaft: 'turboshaft',
};

/** Kind yuvalarının güncel grafikleri (kayıt ve ölçüm betikleri okur) */
export const ENGINE_GRAPHS: Partial<Record<EngineKind, EngineGraph>> = {};
for (const k of Object.keys(KIND_TEMPLATE) as EngineKind[]) {
  const g = TEMPLATES[KIND_TEMPLATE[k]];
  if (g) ENGINE_GRAPHS[k] = g;
}

const isKind = (slot: SlotId): slot is EngineKind => slot !== 'workshop';

/** Yuva → grafik ve (tembel) üretilmiş motor */
let workshopGraph: EngineGraph | null = null;
const built = new Map<SlotId, BuiltEngine>();

const graphOf = (slot: SlotId): EngineGraph | undefined => (isKind(slot) ? ENGINE_GRAPHS[slot] : (workshopGraph ?? undefined));

/** Yuvanın üretilmiş motoru (önbellekli); grafiği olmayan yuvada undefined */
export function builtFor(slot: SlotId): BuiltEngine | undefined {
  const g = graphOf(slot);
  if (!g) return undefined;
  let b = built.get(slot);
  if (!b) {
    b = buildEngine(g);
    built.set(slot, b);
  }
  return b;
}

/**
 * Simülasyonun kullanacağı tasarım (eski `engineDesign(kind)`). Grafiği
 * olmayan kind yuvasında el yazımı katalog; hiçbiri yoksa tipli hata.
 */
export function designFor(slot: SlotId): EngineDesign {
  const b = builtFor(slot);
  if (b) return b.design;
  if (isKind(slot) && ENGINE_CATALOG[slot]) return ENGINE_CATALOG[slot];
  throw new GraphError(
    slot === 'workshop' ? 'Atölye yuvası boş: önce bir tasarım kur.' : `"${slot}" motoru henüz yok.`,
    'slot.empty',
  );
}

/** Yuvanın 3B yerleşimi (grafikten üretilen yuvalarda) */
export function layoutFor(slot: SlotId): EngineLayout | undefined {
  return builtFor(slot)?.flowpath.layout;
}

/** Arayüz ve görselin okuduğu türetilmiş tip (grafiksiz katalogda tasarımdan) */
export function traitsFor(slot: SlotId): EngineTraits {
  return builtFor(slot)?.traits ?? traitsFromDesign(designFor(slot));
}

/**
 * Bir yuvanın grafiğini değiştirir. null kind yuvasında şablona döner,
 * workshop'ta boşaltır. Geçersiz grafikte ATAR, eski yuva kalır. Sonra
 * App.setEngine / rebuildVisual ile model ve simülasyon yeniden kurulmalıdır
 * (App.applyDesign ikisini birlikte yapar).
 */
export function setSlotGraph(slot: SlotId, g: EngineGraph | null, opts?: BuildOptions): BuiltEngine | undefined {
  if (!isKind(slot)) {
    if (!g) {
      workshopGraph = null;
      built.delete(slot);
      return undefined;
    }
    const b = buildEngine(g, opts);
    workshopGraph = g;
    built.set(slot, b);
    return b;
  }
  const next = g ?? TEMPLATES[KIND_TEMPLATE[slot]];
  if (!next) return undefined;
  const b = buildEngine(next, opts);
  ENGINE_GRAPHS[slot] = next;
  built.set(slot, b);
  return b;
}

/**
 * Önceden üretilmiş motoru yuvaya yazar (yeniden üretmeden). Atölye
 * mağazası motoru kendi seçenekleriyle (referans, kademe histerezisi)
 * üretir; App aynı nesneyi kullanır ki sayılar, 3B model ve simülasyon
 * aynı tasarımı göstersin.
 */
export function setSlotBuilt(slot: SlotId, b: BuiltEngine): BuiltEngine {
  if (isKind(slot)) ENGINE_GRAPHS[slot] = b.graph;
  else workshopGraph = b.graph;
  built.set(slot, b);
  return b;
}

/** Kayıt kancası uyumu (CLAUDE.md tarifi): yalnız kind yuvaları */
export const overrideGraph = (kind: EngineKind, g: EngineGraph | null): BuiltEngine | undefined => setSlotGraph(kind, g);

/** @deprecated builtFor; kayıt/ölçüm betikleri (`__design.builtEngine`) için */
export const builtEngine = (kind: EngineKind): BuiltEngine | undefined => builtFor(kind);

// Grafikten üretilip el yazımı karşılığı olmayan tipler katalogda kaydolur
// (sim katmanı design/'ı içe aktarmaz; M5a P7: turboşaft)
for (const k of Object.keys(ENGINE_GRAPHS) as EngineKind[]) {
  if (!(k in ENGINE_CATALOG)) registerCatalogDesign(k, builtFor(k)!.design);
}
