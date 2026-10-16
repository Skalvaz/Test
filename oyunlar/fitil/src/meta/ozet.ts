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
import type { Hamle, KomboTuru, Konum, Olay, OyunDurumu, OzelTur } from '../core/types';
import { patlamaKaydi } from './galeri';
import type { TabloHammaddesi, TabloSegmenti } from './galeri';
import { TABLO_REAKSIYON_SAYISI } from './sabitler';

/** Oyuncu eyleminin türü (`Hamle['tur']`). */
export type EylemTuru = Hamle['tur'];

/**
 * Bir oyuncu eyleminin izi (Bölüm Mühürleri, docs/KANCALAR.md §A.3). Her
 * `ozetHamle` bir iz ekler; final gösterisi iz EKLEMEZ (mühürler finali
 * saymaz). Sayılar o eylemin olaylarından; atıflar (çapraz roket, barut izi
 * dev fişeği) özetle aynı kuralla.
 */
export interface HamleIzi {
  eylem: EylemTuru;
  /** Fitil zincirinin düğüm sayısı (halkada kapanış tekrarı sayılmaz); fitil değilse 0. */
  zincir: number;
  /** Fitil zincir rengi (joker zincir −1); fitil değilse −1. */
  renk: number;
  halka: boolean;
  /** Reaksiyon boyutu R (fitil düğümü olmayan kapsül patlamaları). */
  R: number;
  /** En yüksek patlama nesli. */
  nesil: number;
  /** Kapsül patlaması (fitil düğümleri dahil) ve renge göre dağılımı (0..5). */
  patlama: number;
  renkPatlama: number[];
  isiPatlamasi: number;
  /** Zincir dönüşümüyle (§4.1, son düğüm) oluşan özel taş; yoksa 'yok'. */
  olusan: OzelTur;
  /**
   * Patlayan özel taşlar (zincirde, ısıyla, vuruşla; kombinasyona giren iki
   * taş da sayılır: oyuncu için ikisi de "ateşlendi"). `patlama.ozel`'den.
   */
  roket: number;
  kasimpati: number;
  yildiz: number;
  /**
   * ↗/↘ eksenli roket: kendi etkisiyle tetiklenen (`ozelTetiklendi`) ve
   * kombinasyona giren (yüklenen ya da S2; eksen eylem öncesi durumdan,
   * `onceki` verilmezse sayılmaz).
   */
  caprazRoket: number;
  kombolar: KomboTuru[];
  kafes: number;
  /** Tamamen yok edilen kaya. */
  kaya: number;
  /** Kaya/kova kat hasarı. */
  engelHasar: number;
  doseme: number;
  desen: number;
  is: number;
  fener: number;
  devFisek: number;
  izliDevFisek: number;
  /** Çapraz roketin vurduğu engel (kafes, kaya/kova katı, is, dev fişek dolumu). */
  caprazEngel: number;
  /** Kuruyan ıslak barut. */
  kurutma: number;
}

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
  /** Eylem başına iz (mühürler; final hariç). */
  hamleIzleri: HamleIzi[];
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
    hamleIzleri: [],
  };
}

function kopya(oz: OyunOzeti): OyunOzeti {
  return {
    ...oz,
    reaksiyonlar: [...oz.reaksiyonlar],
    renkPatlama: [...oz.renkPatlama],
    kombolar: [...oz.kombolar],
    tablo: { reaksiyonlar: [...oz.tablo.reaksiyonlar], final: oz.tablo.final, finalSure: oz.tablo.finalSure },
    // İzler değişmez kayıtlardır: dizi kopyası yeter (Geri Sar eski özeti geri koyar).
    hamleIzleri: [...(oz.hamleIzleri ?? [])],
  };
}

/** Tek bir olay listesinin sayaçları (özet nesnesine eklenir). */
interface ListeSonucu {
  R: number;
  kayitlar: number[];
  sure: number;
  roket: number;
  patlama: number;
  /** Eylem izi için: en yüksek nesil, zincir, dönüşüm, çapraz roket, kuruma. */
  nesil: number;
  zincir: number;
  renk: number;
  halka: boolean;
  olusan: OzelTur;
  caprazRoket: number;
  kurutma: number;
  /** Patlayan özel taşlar (kombinasyona girenler dahil). */
  ozelPatlama: { roket: number; kasimpati: number; yildiz: number };
}

/**
 * `onceki`: eylem öncesi durum (kombinasyona giren roketin ekseni için; yol
 * taşları eylemin başında tahtadadır ve eylem içinde yer değiştirmez).
 */
function listeIsle(oz: OyunOzeti, olaylar: readonly Olay[], kafesler: Set<string> | null, final: boolean, onceki?: OyunDurumu): ListeSonucu {
  const anahtar = (h: Konum) => `${h.x},${h.y}`;
  let R = -1;
  let fitilDisi = 0;
  let sure = 0;
  let roket = 0;
  let patlama = 0;
  let nesil = 0;
  let zincir = 0;
  let renk = -1;
  let halka = false;
  let olusan: OzelTur = 'yok';
  let caprazRoket = 0;
  let kurutma = 0;
  const ozelPatlama = { roket: 0, kasimpati: 0, yildiz: 0 };
  /** Kombinasyona giren taş çapraz roket mi (eksen eylem öncesi durumdan). */
  const caprazMi = (h: Konum): boolean => {
    const ic = onceki && h.x >= 0 && h.y >= 0 && h.x < onceki.w && h.y < onceki.h ? onceki.hucreler[h.y * onceki.w + h.x].icerik : null;
    return ic?.tur === 'kapsul' && ic.ozel === 'roket' && (ic.eksen === 2 || ic.eksen === 3);
  };
  /** Zincir dönüşümü: son düğümün `dugumYandi` anı (k = |yol|); o anda o hücrede `ozelOlustu`. */
  let sonDugumT = -1;
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
        zincir = o.yol.length;
        renk = o.renk;
        halka = o.halka;
        if (o.yol.length > oz.enUzunZincir) oz.enUzunZincir = o.yol.length;
        if (o.halka) oz.halka++;
        break;
      case 'dugumYandi':
        if (yol && !halka && o.k === yol.length) sonDugumT = o.t;
        break;
      case 'ozelOlustu':
        if (yol && !halka && olusan === 'yok' && o.t === sonDugumT) {
          const son = yol[yol.length - 1];
          if (son.x === o.hucre.x && son.y === o.hucre.y) olusan = o.ozel;
        }
        break;
      case 'kurudu':
        kurutma++;
        break;
      case 'patlama':
        patlama++;
        oz.toplamPatlama++;
        if (o.renk >= 0 && o.renk <= 5) oz.renkPatlama[o.renk]++;
        else oz.yildizPatlama++;
        if (o.neden === 'isi') oz.isiPatlamasi++;
        if (o.nesil > oz.enCokNesil) oz.enCokNesil = o.nesil;
        if (o.nesil > nesil) nesil = o.nesil;
        if (o.k === 0) fitilDisi++;
        if (o.ozel === 'roket' || o.ozel === 'kasimpati' || o.ozel === 'yildiz') ozelPatlama[o.ozel]++;
        kayitlar.push(patlamaKaydi(o, o.t));
        break;
      case 'ozelTetiklendi':
        if (o.ozel === 'roket') {
          oz.roketAtesi++;
          roket++;
          if (o.eksen === 2 || o.eksen === 3) {
            caprazRoket++;
            caprazRoketler.push({ x: o.hucre.x, y: o.hucre.y, t: o.t, eksen: o.eksen });
          }
        } else if (o.ozel === 'kasimpati') oz.kasimpatiAtesi++;
        else if (o.ozel === 'yildiz') oz.yildizAtesi++;
        break;
      case 'kombinasyon':
        oz.kombolar.push(o.kombo);
        // S2 (kombinasyon hücresi) çapraz roketse o da ateşlenmiş sayılır.
        if (caprazMi(o.hucre)) caprazRoket++;
        break;
      case 'yuklendi':
        // S1: etkisi kombinasyona katılır; çapraz roketse sayılır.
        if (caprazMi(o.hucre)) caprazRoket++;
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
  return { R, kayitlar, sure, roket, patlama, nesil, zincir, renk, halka, olusan, caprazRoket, kurutma, ozelPatlama };
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
  const once = { ...oz, renkPatlama: [...oz.renkPatlama], kombolar: oz.kombolar.length };
  const s = listeIsle(oz, olaylar, kafesler, false, baglam.onceki);
  oz.eylem++;
  oz.hamleIzleri.push({
    eylem: tur,
    zincir: s.zincir,
    renk: s.renk,
    halka: s.halka,
    R: s.R,
    nesil: s.nesil,
    patlama: s.patlama,
    renkPatlama: oz.renkPatlama.map((n, i) => n - once.renkPatlama[i]),
    isiPatlamasi: oz.isiPatlamasi - once.isiPatlamasi,
    olusan: s.olusan,
    roket: s.ozelPatlama.roket,
    kasimpati: s.ozelPatlama.kasimpati,
    yildiz: s.ozelPatlama.yildiz,
    caprazRoket: s.caprazRoket,
    kombolar: oz.kombolar.slice(once.kombolar),
    kafes: oz.kafesKirilan - once.kafesKirilan,
    kaya: oz.kayaYokEdilen - once.kayaYokEdilen,
    engelHasar: oz.engelHasar - once.engelHasar,
    doseme: oz.dosemeAydinlanan - once.dosemeAydinlanan,
    desen: oz.desenBoyanan - once.desenBoyanan,
    is: oz.isTemizlenen - once.isTemizlenen,
    fener: oz.fenerToplanan - once.fenerToplanan,
    devFisek: oz.devFisekAtesi - once.devFisekAtesi,
    izliDevFisek: oz.izliDevFisek - once.izliDevFisek,
    caprazEngel: oz.caprazRoketEngel - once.caprazRoketEngel,
    kurutma: s.kurutma,
  });
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
