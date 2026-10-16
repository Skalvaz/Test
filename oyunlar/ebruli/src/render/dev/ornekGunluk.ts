/**
 * Dev ve test için örnek temizlik günlükleri (GDD §9.1). Gerçek bölüm
 * sonunda günlük çekirdekten gelir; burada tablo tekniklerini tek tek
 * göstermek için tohumlu yapay günlükler üretilir.
 */
import type { TemizlikKaydi } from '../../core/types';
import { tabloRng } from '../ebru';

export interface GunlukAyari {
  hamle: number;
  /** Bölüm başına Tarak kaydı. */
  tarak?: number;
  girdap?: number;
  lale?: boolean;
  murekkep?: number;
  /** k ≥ 3 kaskatlı hamle sayısı. */
  kaskat?: number;
  /** k = 5 (Şaheser) kaskat. */
  saheser?: boolean;
  birlesim?: boolean;
  renkler?: (3 | 5 | 6)[];
  w?: number;
  h?: number;
}

export function ornekGunluk(tohum: number, a: GunlukAyari): TemizlikKaydi[] {
  const rnd = tabloRng(tohum);
  const w = a.w ?? 7;
  const h = a.h ?? 9;
  const renkler = a.renkler ?? [3, 5, 6];
  const out: TemizlikKaydi[] = [];
  const ozelHamle = new Map<number, 'tarak' | 'girdap' | 'lale' | 'murekkep' | 'birlesim'>();
  const yerles = (tur: 'tarak' | 'girdap' | 'lale' | 'murekkep' | 'birlesim', n: number) => {
    for (let i = 0; i < n; i++) ozelHamle.set(2 + Math.floor(rnd() * (a.hamle - 3)), tur);
  };
  yerles('tarak', a.tarak ?? 0);
  yerles('girdap', a.girdap ?? 0);
  yerles('murekkep', a.murekkep ?? 0);
  if (a.lale) yerles('lale', 1);
  if (a.birlesim) yerles('birlesim', 1);
  const kaskatlar = new Set<number>();
  for (let i = 0; i < (a.kaskat ?? 0); i++) kaskatlar.add(1 + Math.floor(rnd() * (a.hamle - 2)));
  const sahHamle = a.saheser ? Math.floor(a.hamle / 2) : -1;
  for (let hm = 0; hm < a.hamle; hm++) {
    const kMax = hm === sahHamle ? 5 : kaskatlar.has(hm) ? 3 : rnd() < 0.3 ? 2 : 1;
    for (let k = 1; k <= kMax; k++) {
      const gruplar = rnd() < 0.15 ? 2 : 1;
      for (let g = 0; g < gruplar; g++) {
        const boyut = rnd() < 0.18 ? 4 : rnd() < 0.06 ? 5 : 3;
        out.push({ hamle: hm, k, tur: 'grup', x10: Math.floor(rnd() * w * 10), y10: Math.floor((0.3 + rnd() * 0.7) * (h - 1) * 10), renk: renkler[Math.floor(rnd() * renkler.length)], boyut });
      }
    }
    const oz = ozelHamle.get(hm);
    if (oz) {
      const renk = renkler[Math.floor(rnd() * renkler.length)];
      out.push({
        hamle: hm,
        k: 1,
        tur: oz,
        x10: Math.floor(rnd() * w * 10),
        y10: Math.floor(rnd() * h * 10),
        renk: oz === 'murekkep' ? 7 : renk,
        boyut: oz === 'birlesim' ? 20 : oz === 'lale' ? 9 : oz === 'girdap' ? 13 : oz === 'tarak' ? w : 9,
        yon: oz === 'tarak' ? (rnd() < 0.5 ? 'yatay' : 'dikey') : undefined,
      });
    }
  }
  return out;
}
