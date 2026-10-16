/**
 * Ebru Şöleni (GDD §8.3) ve Usta'nın Eli (§8.4, K16).
 *
 * Şölen: kazançtan sonra uygulama çağırır. `solenBasladi`, kalan hamle
 * başına +300 (`puanEklendi{solen}`), kalan her hamle için (en fazla 15)
 * `d.rng` ile seçilen düz KARIŞIK damla (yoksa ham) tarağa döner
 * (`donustu`, t = 0; yön sırayla yatay/dikey) ve i. tarak 160·(i+1) tikte
 * yerinde ateşlenir (kendi `temizlendi{solen}`'i ile kalkar; alanı
 * `solen` nedeniyle temizler). Ardından normal çözümleme (dolum, kaskat).
 * Sonunda `kalanHamle = 0`, `solenYapildi = true`; ikinci çağrı fırlatır.
 * Temizlik günlüğünde hamle −1.
 */
import { Baglam } from './baglam';
import { cozumDongusu } from './cozum';
import { eylemSonu } from './hamle';
import { hedefleriIsle } from './hedef';
import { oluysaKaristir } from './karistir';
import { kuyruguIsle } from './ozel';
import { rngInt } from './rng';
import { PUAN, USTA_ELI_HAMLE, ZAMAN } from './sabitler';
import { damla, durumKopyala, hamMi, karisikMi } from './tahta';
import type { Damla, HamleSonucu, OyunDurumu } from './types';

/** Şölende tarağa dönen en fazla damla (fazla hamleler yalnız puan). */
export const SOLEN_TARAK_SINIRI = 15;

export class EylemHatasi extends Error {}

export function ebruSoleni(d0: OyunDurumu): HamleSonucu {
  if (d0.bitti !== 'kazanc') throw new EylemHatasi('ebruSoleni: bölüm kazanılmadı');
  if (d0.solenYapildi) throw new EylemHatasi('ebruSoleni: şölen zaten yapıldı');
  const d = durumKopyala(d0);
  const c = new Baglam(d, false, -1);
  const kalan = Math.max(0, d.kalanHamle);
  c.ekle(0, { tur: 'solenBasladi', kalanHamle: kalan });
  c.puanEkle(0, PUAN.solenHamle * kalan, 'solen');
  c.adimBasla(1);
  const secilen = new Set<number>();
  const n = Math.min(SOLEN_TARAK_SINIRI, kalan);
  for (let k = 0; k < n; k++) {
    const adaylar = (sec: (r: number) => boolean): number[] => {
      const l: number[] = [];
      for (let i = 0; i < d.hucreler.length; i++) {
        const dm = damla(d.hucreler[i]);
        if (dm && dm.ozel === 'yok' && !secilen.has(i) && sec(dm.renk)) l.push(i);
      }
      return l;
    };
    let l = adaylar(karisikMi);
    if (l.length === 0) l = adaylar(hamMi);
    if (l.length === 0) break;
    const i = l[rngInt(d, l.length)];
    secilen.add(i);
    const eski = damla(d.hucreler[i])!;
    const tarak: Damla = { id: eski.id, renk: eski.renk, ozel: 'tarak', yon: k % 2 === 0 ? 'yatay' : 'dikey' };
    d.hucreler[i].icerik = { tur: 'damla', damla: tarak };
    c.ekle(0, { tur: 'donustu', hucre: c.K(i), damla: { ...tarak } });
    c.kuyrugaEkle({ hucre: i, ozel: 'tarak', renk: tarak.renk, yon: tarak.yon, id: tarak.id, t: ZAMAN.solenAraligi * (k + 1), kaldir: 'solen', neden: 'solen' });
  }
  kuyruguIsle(c);
  c.adimBitir();
  cozumDongusu(c, 2);
  c.olaylar = hedefleriIsle(d, c.olaylar);
  d.kalanHamle = 0;
  d.solenYapildi = true;
  return eylemSonu(c, null, false);
}

/**
 * Usta'nın Eli (§8.4): kayıptan +5 hamleyle devam, en fazla 1★. Tahta ölüyse
 * karıştırır. Bitişin sıfırlanması ve +5 hamle olay değildir: uygulama
 * görsel tahtada `bitti = null` yapar (kalanHamle gibi `sonraki`den okur).
 */
export function ustaEliUygula(d0: OyunDurumu): HamleSonucu {
  if (d0.bitti !== 'kayip') throw new EylemHatasi('ustaEliUygula: bölüm kaybedilmedi');
  if (d0.istatistik.ustaEli) throw new EylemHatasi("ustaEliUygula: Usta'nın Eli zaten kullanıldı");
  const d = durumKopyala(d0);
  d.kalanHamle += USTA_ELI_HAMLE;
  d.bitti = null;
  d.istatistik.ustaEli = true;
  const c = new Baglam(d, false, d.hamleNo);
  oluysaKaristir(c);
  const merkez = { x: (d.w - (d.w % 2)) / 2, y: (d.h - (d.h % 2)) / 2 };
  c.ekle(c.t, { tur: 'hamleOzeti', temizlenen: 0, kaskat: 0, eslesme: false, merkez });
  return { durum: d, olaylar: c.olaylar };
}
