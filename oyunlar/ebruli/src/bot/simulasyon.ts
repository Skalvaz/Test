/**
 * Bot oyunu (GDD §14): bir bölümü bir tohumla baştan sona oynar, ölçütler
 * için kayıt tutar. Saf (Node ve tarayıcı): `oyunAdimlari` her hamleden
 * sonra `yield` eder (tarayıcıda zaman dilimli çalıştırılabilir);
 * `oyunOyna` sonuna kadar sürer.
 *
 * Tohum s: deneme numarası s (oyun akışı `oyunTohumu(tohum, s)`, ilk tahta
 * her tohumda aynı), bot tohumu `botTohumuTuret(s)`. Aynı (bölüm, tohum,
 * bot) aynı sonucu verir. Kazanınca Ebru Şöleni de oynatılır.
 */
import { bolumuYukle, ebruSoleni, hamleUygula, hazirCiftSayisi, ilerlemeYuzdesi, yildizHesapla } from '../core/index';
import type { BolumVerisi, Hamle, Olay, OyunDurumu } from '../core/index';
import { acemiSec } from './acemi';
import { botTohumuTuret, zorunluHamle, type BotSecenek, type BotTuru } from './ortak';
import { ustaSec } from './usta';

/** Tahmini süre (§14.4): oyuncu hamlesi başına 3,5 sn. */
export const HAMLE_SURESI_MS = 3500;
/** Sonsuz döngü koruması. */
const HAMLE_SINIRI = 200;

export interface OyunSonucu {
  bolumId: number;
  tohum: number;
  bot: BotTuru;
  kazandi: boolean;
  /** Şölen dahil puan. */
  puan: number;
  /** Kazanç anındaki puan (şölen öncesi). */
  puanSolenOncesi: number;
  yildiz: 0 | 1 | 2 | 3;
  hamle: number;
  /** Bitişteki hedef ilerlemesi (0..1). */
  ilerleme: number;
  /** Eşleşme veren hamle. */
  eslesenHamle: number;
  /** Hamle öncesi durumların sayısı, ≥ 2 hazırlı ve 0 hazırlı olanlar. */
  durum: number;
  hazir2: number;
  hazir0: number;
  /** Üretilen özel taşlar ve birleşimler (oyuncu hamleleri). */
  tarak: number;
  girdap: number;
  lale: number;
  murekkep: number;
  birlesim: number;
  /** Her hamlenin kaskat sayısı (hamleOzeti.kaskat). */
  kaskatlar: number[];
  garantiKullanimi: number;
  karistirma: number;
  /** Tahmini süre: hamle × 3,5 sn. */
  sureMs: number;
}

export interface OyunSecenek {
  bot?: BotSecenek;
  /** Başlangıç hamlesine eklenecek hamle (kalibrasyon). */
  hamleEk?: number;
  /** Her hamleyi kaydet (sim-cli tek oyun dökümü). */
  kayit?: (k: { d: OyunDurumu; hamle: Hamle; olaylar: Olay[]; sonraki: OyunDurumu }) => void;
}

export function* oyunAdimlari(v: BolumVerisi, tohum: number, bot: BotTuru, s: OyunSecenek = {}): Generator<void, OyunSonucu, void> {
  let d = bolumuYukle(v, tohum);
  if (s.hamleEk) {
    d.kalanHamle += s.hamleEk;
    d.toplamHamle += s.hamleEk;
  }
  const botTohumu = botTohumuTuret(tohum);
  const r: OyunSonucu = {
    bolumId: v.id,
    tohum,
    bot,
    kazandi: false,
    puan: 0,
    puanSolenOncesi: 0,
    yildiz: 0,
    hamle: 0,
    ilerleme: 0,
    eslesenHamle: 0,
    durum: 0,
    hazir2: 0,
    hazir0: 0,
    tarak: 0,
    girdap: 0,
    lale: 0,
    murekkep: 0,
    birlesim: 0,
    kaskatlar: [],
    garantiKullanimi: 0,
    karistirma: 0,
    sureMs: 0,
  };
  for (let k = 0; !d.bitti && k < HAMLE_SINIRI; k++) {
    const hz = hazirCiftSayisi(d);
    r.durum++;
    if (hz >= 2) r.hazir2++;
    if (hz === 0) r.hazir0++;
    const secenek: BotSecenek = { ...s.bot, izin: zorunluHamle(v, d) };
    const h = bot === 'usta' ? ustaSec(d, botTohumu, secenek) : acemiSec(d, botTohumu, secenek);
    const sonuc = hamleUygula(d, h);
    s.kayit?.({ d, hamle: h, olaylar: sonuc.olaylar, sonraki: sonuc.durum });
    r.hamle++;
    const oz = sonuc.olaylar[sonuc.olaylar.length - 1];
    if (oz.tur === 'hamleOzeti') {
      r.kaskatlar.push(oz.kaskat);
      if (oz.eslesme) r.eslesenHamle++;
    }
    d = sonuc.durum;
    yield;
  }
  r.ilerleme = ilerlemeYuzdesi(d);
  r.puanSolenOncesi = d.puan;
  const ist = d.istatistik;
  Object.assign(r, { tarak: ist.tarak, girdap: ist.girdap, lale: ist.lale, murekkep: ist.murekkep, birlesim: ist.birlesim, garantiKullanimi: ist.garantiKullanimi, karistirma: ist.karistirma });
  r.sureMs = r.hamle * HAMLE_SURESI_MS;
  if (d.bitti === 'kazanc') {
    r.kazandi = true;
    d = ebruSoleni(d).durum;
  }
  r.puan = d.puan;
  r.yildiz = yildizHesapla(d, v);
  return r;
}

/** Bir oyunu sonuna kadar oynat. */
export function oyunOyna(v: BolumVerisi, tohum: number, bot: BotTuru, s: OyunSecenek = {}): OyunSonucu {
  const g = oyunAdimlari(v, tohum, bot, s);
  for (;;) {
    const x = g.next();
    if (x.done) return x.value;
  }
}
