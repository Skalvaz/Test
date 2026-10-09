/**
 * Türetilmiş motor tipi (M5a): motorun "ne olduğu" artık modüllerden
 * çıkarılır. Arayüz ve görsel `EngineTraits` okur; simülasyon traits'i
 * görmez (yalnız afterburner/mixer/prop/shaft alanlarına bakar).
 *
 * `presentation` eski `EngineKind`'ın yerini tutar: arayüz tablolarının
 * (gaz kolu kademeleri, EICAS etiketleri, kamera açıları) anahtarı. Kuru
 * turbojet `turbojet`, karışık kaportalı turbofan `turbofan` sunumunu
 * kullanır; farklarını diğer alanlar taşır.
 */

import type { EngineDesign, EngineKind } from '../sim/design';
import type { LpLoad } from './architecture';
import type {
  AfterburnerModule,
  CombustorModule,
  CombustorStyle,
  CompressorModule,
  EngineGraph,
  EngineModule,
  InletModule,
  MixerModule,
  NozzleModule,
  NozzleStyle,
} from './types';

/** 3B yerleşim ve model üreticisi seçimi (layouts/, engine/models.ts) */
export type LayoutStyle = 'bare' | 'nacelle' | 'turboprop' | 'turboshaft';

export interface EngineTraits {
  layout: LayoutStyle;
  lpLoad: LpLoad;
  output: 'thrust' | 'propeller' | 'shaft';
  booster: boolean;
  centrifugal: boolean;
  bpr: number;
  /** bpr > 0 */
  bypass: boolean;
  exhaust: 'single' | 'separate' | 'mixed';
  afterburner: boolean;
  nozzle: NozzleStyle;
  /** convergent | cd */
  variableNozzle: boolean;
  combustor: CombustorStyle;
  /** Kaportalı (nacelle) */
  installed: boolean;
  /** İsli alev/kurum: M5a lpLoad==='lpc' && bpr===0 (M5c: dönem/T4) */
  smoky: boolean;
  /** Arayüz tablolarının anahtarı */
  presentation: EngineKind;
}

const find = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;
const has = (g: EngineGraph, type: EngineModule['type']) => g.modules.some((m) => m.type === type);

/**
 * Yerleşim stili: pervane → turboprop; çıkış mili → turboshaft; kaportalı
 * giriş → nacelle; diğer → bare (test hücresinde çıplak motor).
 */
export function layoutStyleOf(g: EngineGraph): LayoutStyle {
  if (has(g, 'propeller')) return 'turboprop';
  if (has(g, 'shaft')) return 'turboshaft';
  return find<InletModule>(g, 'inlet')?.style === 'nacelle' ? 'nacelle' : 'bare';
}

/**
 * Sunum tipi: pervane → turboprop; çıkış mili → turboshaft; kaportalı →
 * turbofan; baypaslı → askeri turbofan; diğer → turbojet.
 */
export function presentationKind(t: Omit<EngineTraits, 'presentation'>): EngineKind {
  if (t.lpLoad === 'propeller') return 'turboprop';
  if (t.lpLoad === 'shaft') return 'turboshaft';
  if (t.layout === 'nacelle') return 'turbofan';
  if (t.bpr > 0) return 'militaryTurbofan';
  return 'turbojet';
}

const withPresentation = (t: Omit<EngineTraits, 'presentation'>): EngineTraits => ({ ...t, presentation: presentationKind(t) });

export function deriveTraits(g: EngineGraph): EngineTraits {
  const fan = find<CompressorModule>(g, 'fan');
  const hpc = find<CompressorModule>(g, 'hpc');
  const noz = find<NozzleModule>(g, 'nozzle');
  const lpLoad: LpLoad = has(g, 'propeller') ? 'propeller' : has(g, 'shaft') ? 'shaft' : fan ? 'fan' : 'lpc';
  const bpr = fan?.bypassRatio ?? 0;
  const layout = layoutStyleOf(g);
  const nozzle = noz?.style ?? 'fixed';
  return withPresentation({
    layout,
    lpLoad,
    output: lpLoad === 'propeller' ? 'propeller' : lpLoad === 'shaft' ? 'shaft' : 'thrust',
    booster: !!fan && has(g, 'lpc'),
    centrifugal: !!hpc?.centrifugal,
    bpr,
    bypass: bpr > 0,
    exhaust: bpr > 0 ? (find<MixerModule>(g, 'mixer') ? 'mixed' : 'separate') : 'single',
    afterburner: !!find<AfterburnerModule>(g, 'afterburner'),
    nozzle,
    variableNozzle: nozzle === 'convergent' || nozzle === 'cd',
    combustor: find<CombustorModule>(g, 'combustor')?.style ?? 'annular',
    installed: layout === 'nacelle',
    smoky: lpLoad === 'lpc' && bpr === 0,
  });
}

/**
 * Grafiksiz katalog tasarımları için geri düşüş. EngineDesign lüle ve yanma
 * odası stilini taşımaz: art yakıcılı baypassız motor değişken yakınsak,
 * baypaslı yakınsak-ıraksak lüle; yanma odası halka sayılır (katalogdaki
 * dört motorda deriveTraits ile aynı sonuç, test edilir).
 */
export function traitsFromDesign(d: EngineDesign): EngineTraits {
  const bpr = d.bypassRatio;
  const lpLoad: LpLoad = d.prop ? 'propeller' : d.shaft ? 'shaft' : bpr > 0 ? 'fan' : 'lpc';
  const gasGen = lpLoad === 'propeller' || lpLoad === 'shaft';
  const exhaust = gasGen || bpr <= 0 ? 'single' : d.afterburner || d.mixer ? 'mixed' : 'separate';
  // Kaportalı oluş tasarımın sunum tipinden (graph.ts design.kind =
  // traits.presentation): karışık kaportalı turbofan da 'turbofan' sunumunu
  // kullanır, BPR eşiğiyle tahmin edilmez
  const installed = lpLoad === 'fan' && d.kind === 'turbofan';
  const layout: LayoutStyle = lpLoad === 'propeller' ? 'turboprop' : lpLoad === 'shaft' ? 'turboshaft' : installed ? 'nacelle' : 'bare';
  const nozzle: NozzleStyle = gasGen ? 'stub' : exhaust === 'separate' ? 'separate' : d.afterburner ? (bpr > 0 ? 'cd' : 'convergent') : 'fixed';
  return withPresentation({
    layout,
    lpLoad,
    output: lpLoad === 'propeller' ? 'propeller' : lpLoad === 'shaft' ? 'shaft' : 'thrust',
    booster: lpLoad === 'fan' && d.boosterPR > 1,
    centrifugal: gasGen,
    bpr,
    bypass: bpr > 0,
    exhaust,
    afterburner: !!d.afterburner,
    nozzle,
    variableNozzle: nozzle === 'convergent' || nozzle === 'cd',
    combustor: 'annular',
    installed,
    smoky: lpLoad === 'lpc' && bpr === 0,
  });
}
