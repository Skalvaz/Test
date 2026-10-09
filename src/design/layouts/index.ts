/**
 * Yerleşim kayıt defteri: yerleşim stili (traits.ts LayoutStyle) → gaz
 * yolundan 3B yerleşim ve tipe özel kütle/ölçü fonksiyonu.
 *
 * Her yerleşim dosyası `READY` bayrağı taşır. Hazır olmayan yerleşim (ya da
 * hazır yerleşimin henüz yazılmamış dalı) tipli FlowpathError
 * ('… yerleşimi henüz yok') atar; ilgili mimari kartı "yakında" rozetiyle
 * seçilemez. M5a sonunda bütün bayraklar true.
 */

import type { SizedEngine } from '../../sim/design';
import { FlowpathError, type GasPath } from '../flowpath';
import { layoutStyleOf, type LayoutStyle } from '../traits';
import type { EngineGraph } from '../types';
import { READY as BARE_READY, READY_DRY, bareLayout, type BareJetLayout } from './bare';
import { READY as GASGEN_READY } from './gasgen';
import { READY as NACELLE_READY, READY_MIXED, nacelleLayout, type TurbofanLayout } from './turbofan';
import { READY as TURBOPROP_READY, turbopropLayoutFn, type TurbopropLayout } from './turboprop';
import { READY as TURBOSHAFT_READY, turboshaftLayout, type TurboshaftLayout } from './turboshaft';

export type EngineLayout = BareJetLayout | TurbofanLayout | TurbopropLayout | TurboshaftLayout;

/** Yerleşim + gaz yolu dışındaki kütle kalemleri + ölçüler */
export interface LayoutResult {
  layout: EngineLayout;
  /** Mil boyları (kütle) */
  shaftLen: { lp: number; hp: number };
  /** Tipe özel kütle kalemleri (gövde, art yakıcı, fan, pervane…) [kg] */
  extra: Record<string, number>;
  /** Fan/LPC uç çapı ya da pervane çapı; toplam boy [m] */
  diameter: number;
  length: number;
  /** LP milinin ilk kompresörünün uç bağıl Mach'ı (pervanede durağan uç Mach'ı) */
  lpTipMach: number;
}

export type LayoutFn = (graph: EngineGraph, sized: SizedEngine, gp: GasPath) => LayoutResult;

export const LAYOUTS: Record<LayoutStyle, LayoutFn> = {
  bare: bareLayout,
  nacelle: nacelleLayout,
  turboprop: turbopropLayoutFn,
  turboshaft: turboshaftLayout,
};

export const LAYOUT_READY: Record<LayoutStyle, boolean> = {
  bare: BARE_READY,
  nacelle: NACELLE_READY,
  turboprop: TURBOPROP_READY && GASGEN_READY,
  turboshaft: TURBOSHAFT_READY && GASGEN_READY,
};

const NOT_READY: Record<LayoutStyle, string> = {
  bare: 'Çıplak motor yerleşimi henüz yok.',
  nacelle: 'Kaportalı turbofan yerleşimi henüz yok.',
  turboprop: 'Turboprop yerleşimi henüz yok.',
  turboshaft: 'Turboşaft yerleşimi henüz yok.',
};

/** Grafiğin yerleşimi henüz yoksa nedeni; hazırsa null */
export function layoutNotReady(g: EngineGraph): string | null {
  const style = layoutStyleOf(g);
  if (!LAYOUT_READY[style]) return NOT_READY[style];
  const has = (t: string) => g.modules.some((m) => m.type === t);
  if (style === 'bare' && !has('afterburner') && !READY_DRY) return 'Art yakıcısız çıplak motor yerleşimi henüz yok.';
  if (style === 'nacelle' && has('mixer') && !READY_MIXED) return 'Karışık akışlı kaportalı turbofan yerleşimi henüz yok.';
  return null;
}

/** Yerleşim hazır değilse tipli FlowpathError atar */
export function assertLayoutReady(g: EngineGraph): void {
  const why = layoutNotReady(g);
  if (why) throw new FlowpathError(why, 'layout.notReady', 'engine');
}
