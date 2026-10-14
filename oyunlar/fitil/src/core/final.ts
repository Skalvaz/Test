/**
 * Final Gösterisi (§7.3). Kazanınca uygulama çağırır (hamleUygula
 * `bolumBitti{kazanc}` yazar, final ayrı bir eylemdir). Saf; girdiyi
 * değiştirmez.
 *  1. i = 0..m−1: düz kapsüller (y, x) sırasına dizilir, `rngInt` ile biri
 *     seçilir, `rngInt(4)` eksenli rokete döner ve t = 120·i'de tetiklenir.
 *     Seçimler (RNG) baştan yapılır; roketler t = 0'da belirir.
 *  2. Yerçekimi ve doldurma.
 *  3. Tahtadaki bütün özel taşlar (kafesli dahil) (y, x) sırasıyla 80 tik
 *     arayla tetiklenir; yeni özel taş kalmayana kadar en fazla 5 tur.
 *     Her tur yerçekiminden sonra bayraklar ve kalkan yenilenir.
 *  4. Kalan her hamle için +100.
 * Final roketlerinin kendi patlaması ve vuruşları `final` nedenlidir.
 * Reaksiyon bonusu ve körük dolumu yoktur.
 */
import { bayraklariSifirla, cozumOlustur, ekle, kon, type Cozum } from './baglam';
import { duzKapsulMu } from './engel';
import { HamleHatasi, reaksiyonYaz } from './hamle';
import { puanHedefi } from './hedef';
import { cozumle } from './resolve';
import { rngInt } from './rng';
import { FINAL_OZEL_ARALIK, FINAL_OZEL_TUR, FINAL_ROKET_ARALIK, PUAN } from './sabitler';
import { durumKopyala } from './tahta';
import { yercekimiTuru } from './yercekimi';
import type { Eksen, HamleSonucu, OyunDurumu } from './types';

export function finalGosterisi(d0: OyunDurumu): HamleSonucu {
  if (d0.bitti !== 'kazanc') throw new HamleHatasi('finalGosterisi: bölüm kazanılmadı');
  if (d0.finalYapildi) throw new HamleHatasi('finalGosterisi: final zaten yapıldı');
  const d = durumKopyala(d0);
  const c = cozumOlustur(d);
  c.final = true;
  const m = Math.max(0, d.kalanHamle);
  c.olaylar.push({ t: 0, tur: 'finalBasladi', kalanHamle: m });

  // 1. Kalan hamle kadar roket.
  for (let r = 0; r < m; r++) {
    const liste: number[] = [];
    for (let i = 0; i < d.hucreler.length; i++) if (!c.planli[i] && duzKapsulMu(d.hucreler[i])) liste.push(i);
    if (liste.length === 0) break;
    const i = liste[rngInt(d, liste.length)];
    const eksen = rngInt(d, 4) as Eksen;
    const ic = d.hucreler[i].icerik;
    if (ic?.tur !== 'kapsul') continue;
    ic.ozel = 'roket';
    ic.eksen = eksen;
    c.planli[i] = 1;
    c.olaylar.push({ t: 0, tur: 'ozelOlustu', hucre: kon(d, i), ozel: 'roket', eksen, renk: ic.renk, isi: ic.isi });
    ekle(c, FINAL_ROKET_ARALIK * r, i, 'TETIK', { nesil: 0, neden: 'final' });
  }
  cozumle(c);

  // 2. Yerçekimi ve doldurma.
  let t = yercekimiTuru(c, c.saat);

  // 3. Özel taş turları.
  for (let tur = 0; tur < FINAL_OZEL_TUR; tur++) {
    bayraklariSifirla(c);
    const ozeller: number[] = [];
    for (let i = 0; i < d.hucreler.length; i++) {
      const h = d.hucreler[i];
      if (!h.delik && h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok') ozeller.push(i);
    }
    if (ozeller.length === 0) break;
    for (let j = 0; j < ozeller.length; j++) {
      c.planli[ozeller[j]] = 1;
      ekle(c, t + FINAL_OZEL_ARALIK * j, ozeller[j], 'TETIK', { nesil: 0, neden: 'final' });
    }
    cozumle(c);
    t = yercekimiTuru(c, Math.max(t, c.saat));
  }

  // 4. Kalan hamle başına +100; hamleler gösteriye dönüştü.
  finalBitir(c, t, m);
  return { durum: d, olaylar: c.olaylar };
}

function finalBitir(c: Cozum, t: number, m: number): void {
  const d = c.d;
  if (m > 0) {
    d.puan += PUAN.kalanHamle * m;
    c.olaylar.push({ t, tur: 'puanEklendi', miktar: PUAN.kalanHamle * m, neden: 'kalanHamle' });
  }
  d.kalanHamle = 0;
  d.finalYapildi = true;
  puanHedefi(c, t);
  // Final reaksiyonu istatistiğe (enBuyukReaksiyon, reaksiyonlar) girmez:
  // gösteri oyuncu hamlesi değildir. Olay yine yazılır (kamera, Gece Tablosu).
  reaksiyonYaz(c, t, null);
}
