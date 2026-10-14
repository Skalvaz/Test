/**
 * Botların ortak parçaları (GDD §16.5): dürüst değerlendirme tohumları,
 * Körük merkezi, V formülü, aday → hamle dönüşümü.
 *
 * Dürüst değerlendirme: bot adayları durumun bir kopyasında
 * `rng = mulberry32(durumKarmasi ^ botTohumu)` ile çözer; gerçek dolum
 * akışını (d.rng) görmez. Seçilen hamle gerçek durumda oynanır.
 */
import { durumKarmasi, ilerlemeYuzdesi, mulberry32Bir } from '../core/index';
import type { Hamle, Konum, OyunDurumu } from '../core/index';
import type { BotRng, TahtaBilgi } from './adaylar';
import AG from './agirliklar.json';

export type BotTuru = 'usta' | 'acemi';

export type Agirliklar = typeof AG;
export const AGIRLIKLAR: Agirliklar = AG;

export interface BotSecenek {
  /** Tam çözülecek aday sayısı (Usta 64; hafif Usta 16). */
  tamCozum?: number;
  /** Üretilecek en fazla aday (§16.5: 2000). */
  adaySiniri?: number;
  /** İlk hamle kısıtı (§15 zorunluIlkHamle); null = serbest. */
  izin?: readonly (readonly [number, number])[] | null;
  /** Ağırlıklar (varsayılan bot/agirliklar.json). */
  agirlik?: Agirliklar;
}

/** Hamle başına bot tohumları. */
export interface BotTohumlari {
  karma: number;
  /** Değerlendirme kopyasının oyun RNG'si: mulberry32(karma ^ botTohumu). */
  degerlendirme: number;
  /** Bot RNG'si (DFS sırası, Acemi seçimleri). */
  siralama: BotRng;
}

export function botTohumlari(d: OyunDurumu, botTohumu: number): BotTohumlari {
  const karma = durumKarmasi(d);
  return {
    karma,
    degerlendirme: mulberry32Bir((karma ^ botTohumu) >>> 0),
    siralama: { rng: mulberry32Bir((karma ^ botTohumu ^ 0x5bd1e995) >>> 0) },
  };
}

/** Oyun tohumundan botun kendi tohumu (aynı tohum → aynı bot). */
export function botTohumuTuret(tohum: number): number {
  return mulberry32Bir((tohum ^ 0x0b07b075) >>> 0);
}

export function konumlar(w: number, yol: readonly number[]): Konum[] {
  return yol.map((i) => ({ x: i % w, y: Math.floor(i / w) }));
}

export function korukDolu(d: OyunDurumu): boolean {
  return d.korukKapasite > 0 && d.korukDolum >= d.korukKapasite && !d.bitti;
}

/**
 * Usta Körük merkezi (§16.5): en çok eşik hücresi üreten merkez. Eşitlikte
 * ısınacak hücre sayısı, sonra (y, x) sırası. Chebyshev ≤ 1 ısınabilir
 * kapsüller +1 alır; kalkanlı hücre ısınmaz.
 */
export function korukMerkezi(b: TahtaBilgi): Konum {
  const { w, h } = b;
  let en = -1;
  let enEsik = -1;
  let enIsinan = -1;
  for (let i = 0; i < b.n; i++) {
    if (b.d.hucreler[i].delik) continue;
    const x = i % w;
    const y = (i - x) / w;
    let esik = 0;
    let isinan = 0;
    for (let yy = y - 1; yy <= y + 1; yy++) {
      for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (b.isi[j] < 0 || b.kalkan[j]) continue;
        isinan++;
        if (b.isi[j] + 1 >= b.d.esik) esik++;
      }
    }
    if (esik > enEsik || (esik === enEsik && isinan > enIsinan)) {
      en = i;
      enEsik = esik;
      enIsinan = isinan;
    }
  }
  return { x: en % w, y: Math.floor(en / w) };
}

/** Kafessiz özel taşlar (çift dokunuş adayları); izin varsa yalnız izinliler. */
export function ozelTaslar(b: TahtaBilgi): number[] {
  const l: number[] = [];
  for (let i = 0; i < b.n; i++) {
    const c = b.d.hucreler[i];
    if (c.delik || c.kafes || c.icerik?.tur !== 'kapsul' || c.icerik.ozel === 'yok') continue;
    if (b.izin && !b.izin[i]) continue;
    l.push(i);
  }
  return l;
}

/** Tahta özeti (V formülünün durum terimleri). */
export function tahtaOzeti(d: OyunDurumu): { kizgin: number; isiOrt: number; ozel: number; kapsul: number } {
  let kizgin = 0;
  let isi = 0;
  let kapsul = 0;
  let ozel = 0;
  for (const c of d.hucreler) {
    const ic = c.icerik;
    if (c.delik || ic?.tur !== 'kapsul') continue;
    kapsul++;
    isi += ic.isi;
    if (ic.isi >= d.esik - 1) kizgin++;
    if (ic.ozel !== 'yok') ozel++;
  }
  return { kizgin, isiOrt: kapsul ? isi / kapsul : 0, ozel, kapsul };
}

/**
 * V formülü (§16.5):
 * V = 1000·Δ(hedef ilerleme oranı) + 0,02·Δpuan + 40·(kızgın kapsül sayısı)
 *   + 15·(ısı toplamı / kapsül) + 80·(sahadaki özel taşlar)
 *   − 300·[kazanç yokken kalan hamle = 0]
 * P4a eki: + kazanc·[kazanç] (kazandıran hamle her zaman seçilsin; formülde
 * kazanç terimi yok, puanı yüksek bir hamle kazancın önüne geçebiliyordu).
 */
export function degerV(d0: OyunDurumu, d1: OyunDurumu, W: Agirliklar = AG, ilerleme0 = ilerlemeYuzdesi(d0)): number {
  const o = tahtaOzeti(d1);
  let V = W.hedef * (ilerlemeYuzdesi(d1) - ilerleme0) + W.puan * (d1.puan - d0.puan) + W.kizgin * o.kizgin + W.isiOrtalama * o.isiOrt + W.ozel * o.ozel;
  if (d1.bitti === 'kazanc') V += W.kazanc;
  else if (d1.kalanHamle <= 0) V -= W.sonHamle;
  return V;
}

/** Aday yolundan fitil hamlesi. */
export function fitilHamlesi(w: number, yol: readonly number[], halka: boolean): Hamle {
  return { tur: 'fitil', yol: konumlar(w, yol), halka };
}
