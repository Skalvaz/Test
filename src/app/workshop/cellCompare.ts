/**
 * Test hücresi şeridinin "beklenen / ölçülen" karşılaştırması (M5a §6.9
 * madde 5). Beklenen: atölyenin tasarım noktası (ISA, deniz seviyesi,
 * durağan, tam güç); ölçülen: simülasyonun CANLI anlık değeri
 * (`sim.snapshot()`), boyutlandırmanın sabit noktası (`sim.eng.point`)
 * değil. Yüzde yalnız aynı koşulda (ISA deniz seviyesi, M0, tam gaz,
 * motor yanıyor) verilir; değilse nedeni yazılır.
 */

import type { DesignSummary } from '../../design/summary';

export interface CellCompareInput {
  expected: Pick<DesignSummary, 'output' | 'thrust' | 'thrustWet' | 'shaftPower'>;
  /** Canlı değerler (`sim.snapshot()`): itki [N], çıkış mili gücü [W] */
  live: { thrust: number; shaftPower: number; lit: boolean; egtLimited: boolean; N1: number; n1Command: number };
  flight: { altitude: number; mach: number; isaDev: number };
  controls: { throttle: number; reheat: number };
  /** Arıza/yıpranma yok (sağlık katsayıları 1, fan hasarı yok) */
  healthy: boolean;
}

export interface CellCompare {
  /** Mil gücü mü (kW) itki mi (kN) */
  shaft: boolean;
  unit: 'kN' | 'kW';
  /** Gösterim biriminde */
  want: number;
  got: number;
  /** Koşul uygunsa yüzde fark, değilse null */
  pct: number | null;
  /** ±%3 dışında mı (koşul uygunken) */
  off: boolean;
  why: string;
}

/** Tasarım noktası koşulu: ISA, deniz seviyesi, durağan */
export const isDesignCondition = (f: CellCompareInput['flight']): boolean =>
  Math.abs(f.altitude) < 50 && Math.abs(f.mach) < 0.02 && Math.abs(f.isaDev) < 0.5;

export function cellCompare(i: CellCompareInput): CellCompare {
  const e = i.expected;
  const shaft = e.output !== 'thrust' && e.shaftPower !== undefined;
  // Art yakıcı yanarken ıslak itkiyle kıyaslanır (varsa)
  const wet = !shaft && i.controls.reheat > 0 && e.thrustWet !== undefined;
  const wantSi = shaft ? e.shaftPower! : wet ? e.thrustWet! : e.thrust;
  const gotSi = shaft ? i.live.shaftPower : i.live.thrust;
  const k = 1e-3;
  const base = { shaft, unit: (shaft ? 'kW' : 'kN') as 'kW' | 'kN', want: wantSi * k, got: gotSi * k };
  const full = i.controls.throttle >= 0.99;
  if (!i.live.lit) return { ...base, pct: null, off: false, why: 'motor çalışınca tam güçte ölçülür' };
  if (!isDesignCondition(i.flight)) return { ...base, pct: null, off: false, why: 'ISA deniz seviyesinde, durağanken ölçülür' };
  if (!full) return { ...base, pct: null, off: false, why: 'tam güçte ölçülür' };
  const pct = wantSi > 0 ? ((gotSi - wantSi) / wantSi) * 100 : 0;
  const off = Math.abs(pct) > 3;
  let why = 'tasarımla uyumlu (±%3)';
  if (off) {
    if (i.live.egtLimited) why = 'EGT sınırlayıcı devrede';
    else if (Math.abs(i.live.N1 - i.live.n1Command) > 0.01) why = 'motor henüz dengelenmedi';
    else if (!i.healthy) why = 'arıza ya da yıpranma etkin';
    else why = 'devir sınırı ya da kumanda farkı';
  }
  return { ...base, pct, off, why };
}
