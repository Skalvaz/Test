/**
 * Botların ortak parçaları (GDD §14): dürüst değerlendirme tohumları,
 * zorunlu ilk hamle, özel taşa dokunan hamleler.
 *
 * Dürüst değerlendirme (K14): bot ileri bakışını durumun KOPYASINDA
 * `rng = mulberry32(durumKarmasi ^ botTohumu)` ile yapar; gerçek dolum
 * akışını (`d.rng`) görmez. Seçilen hamle gerçek durumda oynanır.
 */
import { damla, durumKarmasi, mulberry32Bir } from '../core/index';
import type { BolumVerisi, Hamle, OyunDurumu } from '../core/index';
import AG from './agirliklar.json';

export type BotTuru = 'usta' | 'acemi';

export type Agirliklar = typeof AG;
export const AGIRLIKLAR: Agirliklar = AG;

export interface BotSecenek {
  /** İlk hamle kısıtı (§12.1 zorunluIlkHamle); null = serbest. */
  izin?: Hamle | null;
  /** Ağırlıklar (varsayılan bot/agirliklar.json). */
  agirlik?: Agirliklar;
}

/** Bir karar için bot tohumları. */
export interface BotTohumlari {
  karma: number;
  /** Değerlendirme kopyasının oyun RNG'si. */
  degerlendirme: number;
  /** Botun kendi seçim RNG'si (Acemi zarları, eşitlik bozma). */
  secim: { rng: number };
}

export function botTohumlari(d: OyunDurumu, botTohumu: number): BotTohumlari {
  const karma = durumKarmasi(d);
  return {
    karma,
    degerlendirme: mulberry32Bir((karma ^ botTohumu) >>> 0),
    secim: { rng: mulberry32Bir((karma ^ botTohumu ^ 0x5bd1e995) >>> 0) },
  };
}

/** Oyun tohumundan botun kendi tohumu (aynı tohum → aynı bot). */
export function botTohumuTuret(tohum: number): number {
  return mulberry32Bir((tohum ^ 0x0eb2a11) >>> 0);
}

/** Bölümün zorunlu ilk hamlesi (yalnız ilk hamlede). */
export function zorunluHamle(v: BolumVerisi, d: OyunDurumu): Hamle | null {
  const z = v.zorunluIlkHamle;
  if (!z || d.hamleNo !== 0) return null;
  return { tur: 'surukle', kaynak: { x: z.kaynak[0], y: z.kaynak[1] }, hedef: { x: z.hedef[0], y: z.hedef[1] } };
}

/** Hamle bir özel taşa dokunuyor mu. */
export function ozelHamleMi(d: OyunDurumu, h: Hamle): boolean {
  const a = damla(d.hucreler[h.kaynak.y * d.w + h.kaynak.x]);
  const b = damla(d.hucreler[h.hedef.y * d.w + h.hedef.x]);
  return (!!a && a.ozel !== 'yok') || (!!b && b.ozel !== 'yok');
}
