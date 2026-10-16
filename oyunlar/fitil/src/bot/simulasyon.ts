/**
 * Bot oyunu (GDD §16.5, §8.3 sonu): bir bölümü bir tohumla baştan sona
 * oynar ve doğrulama ölçütleri için kayıt tutar. Saf (Node ve tarayıcı):
 * `oyunAdimlari` her eylemden sonra `yield` eder, böylece tarayıcıda zaman
 * dilimli çalıştırılabilir (levels/uretici.ts); `oyunOyna` sonuna kadar sürer.
 *
 * Tohum s: deneme numarası s (oyun akışı `oyunTohumu(tohum, s)`), bot
 * tohumu `botTohumuTuret(s)`. Aynı (bölüm, tohum, bot) aynı sonucu verir.
 */
import { bolumuYukle, finalGosterisi, hamleUygula, ilerlemeYuzdesi, ozelTuruBul } from '../core/index';
import type { BolumVerisi, Hamle, Olay, OyunDurumu } from '../core/index';
import { acemiSec } from './acemi';
import { botTohumuTuret, tahtaOzeti, type BotSecenek, type BotTuru } from './ortak';
import { ustaSec } from './usta';

/** Tahmini süre (§8.3 sonu): oyuncu eylemi başına düşünme süresi (ms). */
export const DUSUNME_MS = 3000;
/** Sonsuz döngü koruması (eylem sayısı). */
const EYLEM_SINIRI = 400;

export interface OyunSonucu {
  bolumId: number;
  tohum: number;
  bot: BotTuru;
  kazandi: boolean;
  /** Final gösterisi dahil puan. */
  puan: number;
  /** Kazanç anındaki puan (final öncesi). */
  puanFinalOncesi: number;
  /** Oyuncu hamlesi (fitil + çift dokunuş). */
  hamle: number;
  /** Bitişteki hedef ilerlemesi (0..1). */
  ilerleme: number;
  /** Her oyuncu hamlesinin reaksiyon boyutu R. */
  reaksiyonlar: number[];
  /** Fitil hamlelerinin zincir uzunlukları. */
  zincirler: number[];
  /** Oyuncu zinciriyle oluşan özel taşlar (§4.1 dönüşüm). */
  roket: number;
  kasimpati: number;
  yildiz: number;
  ciftDokunus: number;
  halka: number;
  koruk: number;
  /** Hamle sonu ortalama ısıların toplamı ve sayısı (ısı/kapsül). */
  isiToplam: number;
  isiSayi: number;
  /** Tahmini süre: Σ(3 sn + eylem canlandırması) + final gösterisi. */
  sureMs: number;
  /**
   * Bölümün mühür koşullarının bu oyundaki değerleri (`muhurDegeri`, mühür
   * sırasıyla); yalnız sim-cli `--dogrula` doldurur (bant uyarısı).
   */
  muhurDegerleri?: number[];
}

export interface OyunSecenek {
  bot?: BotSecenek;
  /** Kalibrasyon: başlangıç hamlesine eklenecek hamle (öneri eğrisi için). */
  hamleEk?: number;
  /** Her eylemi kaydet (sim-cli tek oyun dökümü, mühür izi). */
  kayit?: (k: { d: OyunDurumu; hamle: Hamle; olaylar: Olay[]; sonraki: OyunDurumu }) => void;
  /**
   * Mühür kısıtı (docs/KANCALAR.md §A.7, `enCok` mühürleri): oyunda en çok
   * bu kadar Körük / ≤ 3 düğümlü fitil. Sınır dolunca bot Körük'ü
   * kullanmaz / 3'lük adayları eler (uygun aday yoksa eleyemez).
   */
  kisit?: OyunKisiti;
}

export interface OyunKisiti {
  koruk?: number;
  kisaZincir?: number;
}

function sonT(olaylar: readonly Olay[]): number {
  return olaylar.length ? olaylar[olaylar.length - 1].t : 0;
}

export function* oyunAdimlari(v: BolumVerisi, tohum: number, bot: BotTuru, s: OyunSecenek = {}): Generator<void, OyunSonucu, void> {
  let d = bolumuYukle(v, tohum);
  if (s.hamleEk) {
    d.kalanHamle += s.hamleEk;
    d.toplamHamle += s.hamleEk;
  }
  const botTohumu = botTohumuTuret(tohum);
  const sonuc: OyunSonucu = {
    bolumId: v.id,
    tohum,
    bot,
    kazandi: false,
    puan: 0,
    puanFinalOncesi: 0,
    hamle: 0,
    ilerleme: 0,
    reaksiyonlar: [],
    zincirler: [],
    roket: 0,
    kasimpati: 0,
    yildiz: 0,
    ciftDokunus: 0,
    halka: 0,
    koruk: 0,
    isiToplam: 0,
    isiSayi: 0,
    sureMs: 0,
  };
  let korukSayaci = 0;
  let kisaSayaci = 0;
  for (let eylem = 0; !d.bitti && eylem < EYLEM_SINIRI; eylem++) {
    const izin = d.hamleNo === 0 ? (v.zorunluIlkHamle ?? null) : null;
    const secenek: BotSecenek = { ...s.bot, izin };
    if (s.kisit?.koruk !== undefined && korukSayaci >= s.kisit.koruk) secenek.korukYok = true;
    if (s.kisit?.kisaZincir !== undefined && kisaSayaci >= s.kisit.kisaZincir) secenek.enKisaZincir = 4;
    const h = bot === 'usta' ? ustaSec(d, botTohumu, secenek) : acemiSec(d, botTohumu, secenek);
    if (h.tur === 'koruk') korukSayaci++;
    else if (h.tur === 'fitil' && h.yol.length <= 3) kisaSayaci++;
    const r = hamleUygula(d, h);
    s.kayit?.({ d, hamle: h, olaylar: r.olaylar, sonraki: r.durum });
    sonuc.sureMs += DUSUNME_MS + sonT(r.olaylar);
    if (h.tur === 'koruk') sonuc.koruk++;
    else {
      sonuc.hamle++;
      let R = 0;
      for (let k = r.olaylar.length - 1; k >= 0; k--) {
        const o = r.olaylar[k];
        if (o.tur === 'reaksiyon') {
          R = o.boyut;
          break;
        }
      }
      sonuc.reaksiyonlar.push(R);
      if (h.tur === 'fitil') {
        const n = h.yol.length;
        sonuc.zincirler.push(n);
        if (h.halka) sonuc.halka++;
        else {
          const son = d.hucreler[h.yol[n - 1].y * d.w + h.yol[n - 1].x].icerik;
          if (son?.tur === 'kapsul' && son.ozel === 'yok') {
            const tur = ozelTuruBul(d.ozelEsikleri, n);
            if (tur !== 'yok') sonuc[tur]++;
          }
        }
      } else sonuc.ciftDokunus++;
      sonuc.isiToplam += tahtaOzeti(r.durum).isiOrt;
      sonuc.isiSayi++;
    }
    d = r.durum;
    yield;
  }
  sonuc.ilerleme = ilerlemeYuzdesi(d);
  sonuc.puanFinalOncesi = d.puan;
  if (d.bitti === 'kazanc') {
    sonuc.kazandi = true;
    const f = finalGosterisi(d);
    sonuc.sureMs += sonT(f.olaylar);
    d = f.durum;
  }
  sonuc.puan = d.puan;
  return sonuc;
}

/** Bir oyunu sonuna kadar oynat. */
export function oyunOyna(v: BolumVerisi, tohum: number, bot: BotTuru, s: OyunSecenek = {}): OyunSonucu {
  const g = oyunAdimlari(v, tohum, bot, s);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}
