/** Meta testleri için ortak kurucular (yalnız testlerde kullanılır). */
import type { BolumIstatistigi, Konum, Olay, OzelTur } from '../../core/types';
import { bolumSonucu } from '../ilerleme';
import type { BolumSonucGirdisi, BolumSonucCiktisi } from '../ilerleme';
import type { Kayit } from '../kayit';
import { yeniKayit } from '../kayit';
import type { OyunOzeti } from '../ozet';

export function bosIst(ek: Partial<BolumIstatistigi> = {}): BolumIstatistigi {
  return {
    enUzunZincir: 0,
    enBuyukReaksiyon: 0,
    halkaSayisi: 0,
    toplamPatlama: 0,
    isiPatlamasi: 0,
    enCokNesil: 0,
    roket: 0,
    kasimpati: 0,
    yildiz: 0,
    kombinasyon: 0,
    reaksiyonlar: [],
    korukKullanim: 0,
    kafesKirilan: 0,
    kayaKirilan: 0,
    fenerToplanan: 0,
    devFisekAtesi: 0,
    guclendirici: 0,
    ustaEli: false,
    ...ek,
  };
}

export type SonucEk = Partial<Omit<BolumSonucGirdisi, 'bolumId' | 'kazandi'>> & { ist?: Partial<BolumIstatistigi>; oz?: OyunOzeti };

export function kazan(k: Kayit, bolumId: number, yildiz = 1, ek: SonucEk = {}): BolumSonucCiktisi {
  const { ist, oz, ...geri } = ek;
  return bolumSonucu(k, { bolumId, kazandi: true, puan: 1000 * yildiz, yildiz, istatistik: bosIst(ist), olaylarOzeti: oz, ...geri });
}

export function kaybet(k: Kayit, bolumId: number, ek: SonucEk = {}): BolumSonucCiktisi {
  const { ist, oz, ...geri } = ek;
  return bolumSonucu(k, { bolumId, kazandi: false, puan: 300, yildiz: 0, istatistik: bosIst(ist), olaylarOzeti: oz, ...geri });
}

/** 1..n bölümlerini ilk denemede `yildiz` ile kazanır. */
export function ilerlet(n: number, yildiz = 1, k: Kayit = yeniKayit(7), ek: SonucEk = {}): Kayit {
  for (let id = 1; id <= n; id++) k = kazan(k, id, yildiz, ek).kayit;
  return k;
}

const h = (x: number, y: number): Konum => ({ x, y });

export const O = {
  fitil: (yol: [number, number][], halka = false, renk = 0): Olay => ({ t: 0, tur: 'fitilBasladi', yol: yol.map(([x, y]) => h(x, y)), halka, renk }),
  patlama: (x: number, y: number, renk: number, e: { t?: number; neden?: 'fitil' | 'isi' | 'vurus' | 'iz' | 'devFisek' | 'final' | 'kibrit'; nesil?: number; ozel?: OzelTur; k?: number } = {}): Olay => ({
    t: e.t ?? 0,
    tur: 'patlama',
    hucre: h(x, y),
    renk,
    neden: e.neden ?? 'fitil',
    nesil: e.nesil ?? 0,
    puan: 10,
    ozel: e.ozel ?? 'yok',
    k: e.k ?? 0,
  }),
  ozel: (x: number, y: number, ozel: OzelTur, eksen: 0 | 1 | 2 | 3 = 0, t = 0): Olay => ({ t, tur: 'ozelTetiklendi', hucre: h(x, y), ozel, eksen }),
  kafes: (x: number, y: number, t = 0): Olay => ({ t, tur: 'kafesKirildi', hucre: h(x, y) }),
  isindi: (x: number, y: number, t = 0, isi = 1): Olay => ({ t, tur: 'isindi', hucre: h(x, y), isi, kizgin: false }),
  engel: (x: number, y: number, engel: 'kaya' | 'kova', kalan: number, t = 0): Olay => ({ t, tur: 'engelHasar', hucre: h(x, y), engel, kalan }),
  reaksiyon: (boyut: number, t = 0, kombo = false): Olay => ({ t, tur: 'reaksiyon', boyut, zirveT: t, merkez: h(0, 0), kombo, kademe: null }),
  kombo: (kombo: 'yildizHatti' | 'kalinRoket' | 'devKasimpati' | 'roketYagmuru' | 'bahce' | 'buyukFinal', t = 0): Olay => ({ t, tur: 'kombinasyon', hucre: h(0, 0), kombo }),
  iz: (x: number, y: number, t: number): Olay => ({ t, tur: 'izYandi', hucre: h(x, y) }),
  devFisek: (x: number, y: number, t: number): Olay => ({ t, tur: 'devFisekFirladi', hucre: h(x, y) }),
  devDoldu: (x: number, y: number, t: number): Olay => ({ t, tur: 'devFisekDoldu', hucre: h(x, y), dolum: 1, kapasite: 5 }),
  koruk: (): Olay => ({ t: 0, tur: 'korukKullanildi', merkez: h(3, 3) }),
  fener: (t = 0): Olay => ({ t, tur: 'fenerToplandi', hucre: h(0, 8) }),
  doseme: (x: number, y: number, t = 0): Olay => ({ t, tur: 'dosemeAydinlandi', hucre: h(x, y), kalan: 0 }),
  final: (kalan: number): Olay => ({ t: 0, tur: 'finalBasladi', kalanHamle: kalan }),
  isTemiz: (x: number, y: number, t = 0): Olay => ({ t, tur: 'isTemizlendi', hucre: h(x, y) }),
};
