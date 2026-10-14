/**
 * Görsel palet (GDD §13.1). Kapsül renkleri katalogdan; renk körü paleti
 * Okabe–Ito uyarlaması, yüksek kontrast seçeneği 3 px kontur + beyaz iç simge.
 */
import { KAPSUL_RENKLERI } from '../app/katalog';
import type { Palet } from '../app/sozlesme';
import { karistir } from './matematik';

export const P = {
  gokUst: '#0B1030',
  gokAlt: '#2A1450',
  denizUst: '#0A0E26',
  denizAlt: '#1B1040',
  ahsapKoyu: '#24160D',
  ahsapOrta: '#3A2416',
  ahsapDamar: '#4E321F',
  yuvaIc: '#160E08',
  yuvaDis: '#24160D',
  isikliYuva: '#3B2A12',
  pirinc: '#D9A441',
  pirincAcik: '#F2C66D',
  bakir: '#B8642E',
  bakirKoyu: '#7A3E1C',
  krem: '#FFF3D6',
  ikincil: '#CDB89A',
  koz: '#FF7A1A',
  isiHalkasi: '#FF9A3C',
  beyazSicak: '#FFF4C2',
  uyari: '#FF5A3C',
  basari: '#7CFFB2',
  sicakIsik: '#FFC86B',
  gul: '#FF5FB4',
  tasAcik: '#5A5560',
  tasKoyu: '#2E2A33',
  su: '#7FC8FF',
} as const;

export type SekilAdi = 'daire' | 'yildiz' | 'damla' | 'elmas' | 'altigen' | 'ucgen';

export interface KapsulRengi {
  ana: string;
  acik: string;
  koyu: string;
  sekil: SekilAdi;
  ad: string;
}

/** Yıldız topu (renksiz inci cam). */
export const INCI: KapsulRengi = { ana: '#EDE8F7', acik: '#FFFFFF', koyu: '#7C7396', sekil: 'daire', ad: 'Yıldız' };

/** Paletteki 6 kapsül rengi. */
export function kapsulRenkleri(palet: Palet): KapsulRengi[] {
  return KAPSUL_RENKLERI.map((k) => {
    if (palet === 'renkKoru') {
      const ana = k.renkKoru;
      return { ana, acik: karistir(ana, '#FFFFFF', 0.58), koyu: karistir(ana, '#000000', 0.55), sekil: k.sekil, ad: k.ad };
    }
    return { ana: k.ana, acik: k.acik, koyu: k.koyu, sekil: k.sekil, ad: k.ad };
  });
}

/**
 * Parçacık/parıltı renk tablosu. 0–5 kapsül renkleri (palete göre), sonra
 * sabit efekt renkleri. Parıltı sprite'ları bu sırayla üretilir.
 */
export const R = {
  BEYAZ_SICAK: 6,
  KOZ: 7,
  ALTIN: 8,
  DUMAN: 9,
  SU: 10,
  BEYAZ: 11,
  TAS: 12,
  PIRINC: 13,
  GOKKUSAGI: 14, // 14..19 altı ton
  SICAK_ISIK: 20,
  BUHAR: 21,
  KOMUR: 22,
  /** 23..28: kapsül renklerinin %20 daha sıcak hali (ısı patlaması). */
  SICAK: 23,
} as const;
export const RENK_SAYISI = 29;

export function efektRenkleri(palet: Palet): string[] {
  const k = kapsulRenkleri(palet).map((r) => r.ana);
  return [
    ...k,
    P.beyazSicak,
    P.koz,
    P.pirincAcik,
    '#6E6878',
    P.su,
    '#FFFFFF',
    '#8C8794',
    P.pirinc,
    '#FF5A5A',
    '#FFB347',
    '#FFF27A',
    '#5CFF9D',
    '#5CC8FF',
    '#C68CFF',
    P.sicakIsik,
    '#E8EEF5',
    '#2A2226',
    ...k.map((r) => karistir(r, P.isiHalkasi, 0.2)),
  ];
}

/** Kapsül renk indeksinden (−1 = yıldız topu) efekt renk indeksi. */
export function efektRengi(renk: number): number {
  return renk >= 0 && renk <= 5 ? renk : R.BEYAZ;
}
