/**
 * Olay özeti: bir oyunun çekirdek olaylarından (`Olay[]`) meta için gereken
 * sayaçlar — günlük görevler (§10.5), rozetler (§10.6), Gece Tablosu
 * hammaddesi (§10.3) ve paylaşım ızgarası.
 *
 * Kullanım (uygulama):
 *
 *   let oz = ozetBaslat();
 *   // her eylemden sonra (hamleUygula sonucu):
 *   oz = ozetHamle(oz, sonuc.olaylar, { hamle, onceki });
 *   // kazanınca final gösterisinden sonra:
 *   oz = ozetFinal(oz, final.olaylar);
 *   bolumSonucu(kayit, { …, olaylarOzeti: oz });
 *
 * Fonksiyonlar saftır (yeni nesne döner); Geri Sar için bir önceki özet
 * saklanıp geri konur.
 *
 * Atıf kuralları (olaylardan çıkarım):
 *  - Çapraz roket vuruşu: ↗/↘ eksenli `ozelTetiklendi` (T, merkez) için,
 *    eksen üstünde d uzaklıktaki hücrede tam T + 25·d anında gelen
 *    kafesKirildi / engelHasar / isTemizlendi / devFisekDoldu.
 *  - Barut izi dev fişeği: `devFisekFirladi` hücresinde ya da dik komşusunda,
 *    aynı eylemde daha önce `izYandi` olduysa.
 *  - Sar ve Pişir: fitil yolunun en az 3 düğümü bir kafesin dik komşusu ve
 *    o kafes bu eylemde ısındı ya da kırıldı (kafesler `onceki` durumdan;
 *    verilmezse kırılan kafeslerden).
 */
import { ROKET_ADIM } from '../core/sabitler';
import type { Hamle, KomboTuru, Konum, Olay, OyunDurumu } from '../core/types';
import { patlamaKaydi } from './galeri';
import type { TabloHammaddesi, TabloSegmenti } from './galeri';
import { TABLO_REAKSIYON_SAYISI } from './sabitler';

export interface OyunOzeti {
  /** Bütün oyuncu eylemleri (hamle, körük, güçlendirici). */
  eylem: number;
  /** Hamle harcayan eylem sayısı (fitil, çift dokunuş). */
  oyuncuHamlesi: number;
  /** Hamle harcayan her eylemin R değeri (paylaşım ızgarası). */
  reaksiyonlar: number[];
  /** Renge göre patlayan kapsül (0..5); yıldız topu ayrı. */
  renkPatlama: number[];
  yildizPatlama: number;
  toplamPatlama: number;
  isiPatlamasi: number;
  enCokNesil: number;
  enBuyukReaksiyon: number;
  enUzunZincir: number;
  halka: number;
  roketAtesi: number;
  kasimpatiAtesi: number;
  yildizAtesi: number;
  kombolar: KomboTuru[];
  kafesKirilan: number;
  dosemeAydinlanan: number;
  desenBoyanan: number;
  /** Tamamen yok edilen kaya. */
  kayaYokEdilen: number;
  /** Kaya/kova kat hasarı. */
  engelHasar: number;
  isTemizlenen: number;
  fenerToplanan: number;
  devFisekAtesi: number;
  korukKullanim: number;
  /** Körük eylemlerindeki en büyük R. */
  korukEnBuyukR: number;
  caprazRoketKafes: number;
  caprazRoketEngel: number;
  sarVePisir: boolean;
  izliDevFisek: number;
  /** Final gösterisinde ateşlenen roket ve patlama. */
  finalRoket: number;
  finalPatlama: number;
  tablo: TabloHammaddesi;
}

export function ozetBaslat(): OyunOzeti {
  return {
    eylem: 0,
    oyuncuHamlesi: 0,
    reaksiyonlar: [],
    renkPatlama: [0, 0, 0, 0, 0, 0],
    yildizPatlama: 0,
    toplamPatlama: 0,
    isiPatlamasi: 0,
    enCokNesil: 0,
    enBuyukReaksiyon: 0,
    enUzunZincir: 0,
    halka: 0,
    roketAtesi: 0,
    kasimpatiAtesi: 0,
    yildizAtesi: 0,
    kombolar: [],
    kafesKirilan: 0,
    dosemeAydinlanan: 0,
    desenBoyanan: 0,
    kayaYokEdilen: 0,
    engelHasar: 0,
    isTemizlenen: 0,
    fenerToplanan: 0,
    devFisekAtesi: 0,
    korukKullanim: 0,
    korukEnBuyukR: 0,
    caprazRoketKafes: 0,
    caprazRoketEngel: 0,
    sarVePisir: false,
    izliDevFisek: 0,
    finalRoket: 0,
    finalPatlama: 0,
    tablo: { reaksiyonlar: [], final: [], finalSure: 0 },
  };
}

function kopya(oz: OyunOzeti): OyunOzeti {
  return {
    ...oz,
    reaksiyonlar: [...oz.reaksiyonlar],
    renkPatlama: [...oz.renkPatlama],
    kombolar: [...oz.kombolar],
    tablo: { reaksiyonlar: [...oz.tablo.reaksiyonlar], final: oz.tablo.final, finalSure: oz.tablo.finalSure },
  };
}

type EylemTuru = Hamle['tur'];

/** Tek bir olay listesinin sayaçları (özet nesnesine eklenir). */
interface ListeSonucu {
  R: number;
  kayitlar: number[];
  sure: number;
  roket: number;
  patlama: number;
}

function listeIsle(oz: OyunOzeti, olaylar: readonly Olay[], kafesler: Set<string> | null, final: boolean): ListeSonucu {
  const anahtar = (h: Konum) => `${h.x},${h.y}`;
  let R = -1;
  let fitilDisi = 0;
  let sure = 0;
  let roket = 0;
  let patlama = 0;
  const kayitlar: number[] = [];
  const caprazRoketler: { x: number; y: number; t: number; eksen: 2 | 3 }[] = [];
  const izler: { x: number; y: number; t: number }[] = [];
  let yol: Konum[] | null = null;
  const isinanlar = new Set<string>();
  const kirilanKafesler = new Set<string>();

  for (const o of olaylar) {
    if (o.t > sure) sure = o.t;
    switch (o.tur) {
      case 'fitilBasladi':
        yol = o.yol;
        if (o.yol.length > oz.enUzunZincir) oz.enUzunZincir = o.yol.length;
        if (o.halka) oz.halka++;
        break;
      case 'patlama':
        patlama++;
        oz.toplamPatlama++;
        if (o.renk >= 0 && o.renk <= 5) oz.renkPatlama[o.renk]++;
        else oz.yildizPatlama++;
        if (o.neden === 'isi') oz.isiPatlamasi++;
        if (o.nesil > oz.enCokNesil) oz.enCokNesil = o.nesil;
        if (o.k === 0) fitilDisi++;
        kayitlar.push(patlamaKaydi(o, o.t));
        break;
      case 'ozelTetiklendi':
        if (o.ozel === 'roket') {
          oz.roketAtesi++;
          roket++;
          if (o.eksen === 2 || o.eksen === 3) caprazRoketler.push({ x: o.hucre.x, y: o.hucre.y, t: o.t, eksen: o.eksen });
        } else if (o.ozel === 'kasimpati') oz.kasimpatiAtesi++;
        else if (o.ozel === 'yildiz') oz.yildizAtesi++;
        break;
      case 'kombinasyon':
        oz.kombolar.push(o.kombo);
        break;
      case 'kafesKirildi':
        oz.kafesKirilan++;
        kirilanKafesler.add(anahtar(o.hucre));
        break;
      case 'isindi':
        isinanlar.add(anahtar(o.hucre));
        break;
      case 'dosemeAydinlandi':
        oz.dosemeAydinlanan++;
        break;
      case 'desenBoyandi':
        oz.desenBoyanan++;
        break;
      case 'engelHasar':
        oz.engelHasar++;
        if (o.engel === 'kaya' && o.kalan === 0) oz.kayaYokEdilen++;
        break;
      case 'isTemizlendi':
        oz.isTemizlenen++;
        break;
      case 'fenerToplandi':
        oz.fenerToplanan++;
        break;
      case 'devFisekFirladi':
        oz.devFisekAtesi++;
        if (izler.some((iz) => iz.t <= o.t && Math.abs(iz.x - o.hucre.x) + Math.abs(iz.y - o.hucre.y) <= 1)) oz.izliDevFisek++;
        break;
      case 'izYandi':
        izler.push({ x: o.hucre.x, y: o.hucre.y, t: o.t });
        break;
      case 'korukKullanildi':
        oz.korukKullanim++;
        break;
      case 'reaksiyon':
        R = o.boyut;
        break;
      default:
        break;
    }
  }
  if (R < 0) R = fitilDisi;
  // Final gösterisi bir hamle değildir: tek hamle rekorlarına girmez.
  if (!final && R > oz.enBuyukReaksiyon) oz.enBuyukReaksiyon = R;

  // Çapraz roket atfı: eksen üstünde d uzaklıkta, tam T + 25·d anında gelen engel olayları.
  if (caprazRoketler.length > 0) {
    const sayildi = new Set<number>();
    olaylar.forEach((o, i) => {
      if (o.tur !== 'kafesKirildi' && o.tur !== 'engelHasar' && o.tur !== 'isTemizlendi' && o.tur !== 'devFisekDoldu') return;
      for (const r of caprazRoketler) {
        const dx = o.hucre.x - r.x;
        const dy = o.hucre.y - r.y;
        if (dx === 0) continue;
        const eksende = r.eksen === 2 ? dx === -dy : dx === dy;
        if (!eksende || o.t !== r.t + ROKET_ADIM * Math.abs(dx) || sayildi.has(i)) continue;
        sayildi.add(i);
        oz.caprazRoketEngel++;
        if (o.tur === 'kafesKirildi') oz.caprazRoketKafes++;
        break;
      }
    });
  }

  // Sar ve Pişir: yolun ≥ 3 düğümü bir kafesin dik komşusu ve kafes ısındı/kırıldı.
  if (yol && !oz.sarVePisir) {
    const adaylar = kafesler ?? kirilanKafesler;
    for (const k of adaylar) {
      if (!isinanlar.has(k) && !kirilanKafesler.has(k)) continue;
      const [kx, ky] = k.split(',').map(Number);
      let n = 0;
      for (const p of yol) if (Math.abs(p.x - kx) + Math.abs(p.y - ky) === 1) n++;
      if (n >= 3) {
        oz.sarVePisir = true;
        break;
      }
    }
  }
  return { R, kayitlar, sure, roket, patlama };
}

function eylemTuru(olaylar: readonly Olay[], hamle?: Hamle): EylemTuru {
  if (hamle) return hamle.tur;
  for (const o of olaylar) {
    if (o.tur === 'fitilBasladi') return 'fitil';
    if (o.tur === 'korukKullanildi') return 'koruk';
    if (o.tur === 'guclendirici') return o.guc;
  }
  return 'ciftDokunus';
}

/**
 * Bir oyuncu eyleminin (hamle, körük, güçlendirici) olaylarını özete ekler.
 * `onceki`: eylemden önceki durum (Sar ve Pişir için kafes konumları).
 */
export function ozetHamle(oz0: OyunOzeti, olaylar: readonly Olay[], baglam: { hamle?: Hamle; onceki?: OyunDurumu } = {}): OyunOzeti {
  const oz = kopya(oz0);
  let kafesler: Set<string> | null = null;
  if (baglam.onceki) {
    const d = baglam.onceki;
    kafesler = new Set();
    d.hucreler.forEach((h, i) => {
      if (!h.delik && h.kafes) kafesler!.add(`${i % d.w},${Math.floor(i / d.w)}`);
    });
  }
  const tur = eylemTuru(olaylar, baglam.hamle);
  const s = listeIsle(oz, olaylar, kafesler, false);
  oz.eylem++;
  if (tur === 'fitil' || tur === 'ciftDokunus') {
    oz.reaksiyonlar.push(s.R);
    oz.oyuncuHamlesi++;
  }
  if (tur === 'koruk' && s.R > oz.korukEnBuyukR) oz.korukEnBuyukR = s.R;
  if (s.kayitlar.length > 0) {
    const seg: TabloSegmenti = { boyut: s.R, sira: oz.eylem, kayitlar: s.kayitlar, sure: s.sure };
    const liste = oz.tablo.reaksiyonlar;
    // Boyuta göre azalan; eşitlikte kayıt sayısı, sonra erken gelen kalır.
    const daha = (a: TabloSegmenti, b: TabloSegmenti) => a.boyut > b.boyut || (a.boyut === b.boyut && a.kayitlar.length > b.kayitlar.length);
    let i = liste.length;
    while (i > 0 && daha(seg, liste[i - 1])) i--;
    if (i < TABLO_REAKSIYON_SAYISI) {
      liste.splice(i, 0, seg);
      if (liste.length > TABLO_REAKSIYON_SAYISI) liste.length = TABLO_REAKSIYON_SAYISI;
    }
  }
  return oz;
}

/** Final gösterisinin olaylarını ekler (§7.3). */
export function ozetFinal(oz0: OyunOzeti, olaylar: readonly Olay[]): OyunOzeti {
  const oz = kopya(oz0);
  const s = listeIsle(oz, olaylar, null, true);
  oz.finalRoket += s.roket;
  oz.finalPatlama += s.patlama;
  oz.tablo.final = [...oz.tablo.final, ...s.kayitlar];
  oz.tablo.finalSure = Math.max(oz.tablo.finalSure, s.sure);
  return oz;
}

/**
 * Kolaylık: oyunun bütün eylem olay listelerinden (ve varsa final
 * gösterisinden) özet. Olay listelerini saklayan çağıran için; eylem başına
 * `ozetHamle` ile aynı sonucu verir (durum bilgisi olmadan).
 */
export function olaylardanOzet(eylemler: readonly (readonly Olay[])[], final?: readonly Olay[]): OyunOzeti {
  let oz = ozetBaslat();
  for (const ol of eylemler) oz = ozetHamle(oz, ol);
  if (final) oz = ozetFinal(oz, final);
  return oz;
}
