import type { IpRenkleri } from './ip';
import { karistir } from './matematik';
import { P, type KapsulRengi } from './palet';

/**
 * Fitil görünümleri (GDD §10.3, §13.3: "Fitil görünümleri yalnız bu katmanı
 * değiştirir"). Boş bırakılan renk zincir renginden gelir.
 */
export interface FitilGorunumu {
  ana?: string;
  acik?: string;
  koyu?: string;
}

export const FITIL_GORUNUMLERI: Record<string, FitilGorunumu> = {
  kenevir: {},
  altinTel: { ana: '#E8B64A', acik: '#FFF0B8', koyu: '#8A5A10' },
  simsek: { ana: '#9AD8FF', acik: '#FFFFFF', koyu: '#2A5AA8' },
  gokkusagi: { acik: '#FFFFFF' },
  atesBocegi: { ana: '#B8E05A', acik: '#F4FFB0', koyu: '#3A5A10' },
  laleDali: { ana: '#3EA860', acik: '#FFB0D8', koyu: '#1A5A2A' },
  denizKopugu: { ana: '#7FE0E0', acik: '#F0FFFF', koyu: '#1A6A78' },
  ejderKuyrugu: { ana: '#E2482A', acik: '#FFC060', koyu: '#5A0A08' },
  denizFeneri: { ana: '#FFF3D6', acik: '#FFFFFF', koyu: '#C89A40' },
};

/**
 * Fitil ip renkleri (§13.3): renk zincir rengidir; kenevir ipte zincir rengi
 * kenevir bejine karışır (aynı renkli kapsülün üstünde okunsun), 7+ düğümde
 * #FFF4C2'ye karışır, halkada gül-altın.
 */
export function fitilRenkleri(gorunum: string, k: KapsulRengi, n: number, halka: boolean, cikis?: IpRenkleri): IpRenkleri {
  const r = cikis ?? { ana: '', acik: '', koyu: '', parilti: null };
  if (halka) {
    r.ana = '#F5A6C8';
    r.acik = '#FFE3A0';
    r.koyu = '#9A2E5C';
    r.parilti = '#FFB6D8';
    return r;
  }
  const g = FITIL_GORUNUMLERI[gorunum] ?? FITIL_GORUNUMLERI.kenevir;
  let ana = g.ana ?? karistir(k.ana, '#F2D9A8', 0.38);
  let acik = g.acik ?? karistir(k.acik, '#FFF6E0', 0.45);
  let koyu = g.koyu ?? karistir(karistir(k.ana, k.koyu, 0.55), '#F2D9A8', 0.12);
  if (n >= 7) {
    const m = Math.min(0.75, 0.45 + (n - 7) * 0.06);
    ana = karistir(ana, P.beyazSicak, m);
    acik = karistir(acik, '#FFFFFF', m);
    koyu = karistir(koyu, P.isiHalkasi, m * 0.6);
  }
  r.ana = ana;
  r.acik = acik;
  r.koyu = koyu;
  r.parilti = n >= 7 ? P.beyazSicak : k.ana;
  return r;
}
