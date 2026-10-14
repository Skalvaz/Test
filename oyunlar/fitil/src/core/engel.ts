/**
 * Engeller ve çevre öğeleri (§5) — vuruş tablosunun kapsül dışı satırları
 * (§3.5.3), barut izi tutuşması ve is yayılması.
 *
 * Kapsül dışı içerik için "Bitişik" ve "Vuruş" sütunları aynıdır:
 *   ıslak → kurur, kaya/kova → −1 kat, dev fişek → +1 dolum, is → temizlenir,
 *   fener/boş → etki yok.
 */
import { ekle, kon, puanEkle, type Cozum } from './baglam';
import { hedefSay, isGerekliArtir } from './hedef';
import { rngInt } from './rng';
import { DEV_FISEK_GECIKME, IZ_ADIM, PUAN } from './sabitler';
import type { Hucre } from './types';

/** Kapsül dışı içeriğe bitişik patlama ya da vuruş etkisi. */
export function engelEtki(c: Cozum, i: number, t: number, g: number): void {
  const d = c.d;
  const h = d.hucreler[i];
  const ic = h.icerik;
  if (!ic || h.delik) return;
  switch (ic.tur) {
    case 'islak': {
      // Kurur → aynı renk kapsül, ısı 0 (§5). Hedefe sayılmaz.
      h.icerik = { tur: 'kapsul', renk: ic.renk, isi: 0, ozel: 'yok', eksen: 0 };
      c.olaylar.push({ t, tur: 'kurudu', hucre: kon(d, i), renk: ic.renk });
      return;
    }
    case 'kaya':
    case 'kova': {
      const kalan = ic.kat - 1;
      c.olaylar.push({ t, tur: 'engelHasar', hucre: kon(d, i), engel: ic.tur, kalan });
      puanEkle(c, t, PUAN.engelKat, 'diger', i);
      if (kalan <= 0) {
        h.icerik = null;
        puanEkle(c, t, PUAN.engelYokOldu, 'diger', i);
        if (ic.tur === 'kaya') {
          d.istatistik.kayaKirilan++;
          hedefSay(c, 'kaya', t);
        }
      } else {
        ic.kat = kalan as 1 | 2;
      }
      return;
    }
    case 'devFisek': {
      // Doluysa fırlamayı bekler; ek dolum yok sayılır.
      if (c.planli[i]) return;
      ic.dolum++;
      c.olaylar.push({ t, tur: 'devFisekDoldu', hucre: kon(d, i), dolum: ic.dolum, kapasite: ic.kapasite });
      if (ic.dolum >= ic.kapasite) {
        c.planli[i] = 1;
        ekle(c, t + DEV_FISEK_GECIKME, i, 'DEVFISEK_ATES', { nesil: g });
      }
      return;
    }
    case 'is': {
      // §5: temizlenir (+30). §7.1'deki "kat 20 + kalkınca 50" yerine §5'in
      // özel değeri (sabitler.PUAN.isTemizle) kullanılır.
      h.icerik = null;
      c.isTemizlendi = true;
      c.olaylar.push({ t, tur: 'isTemizlendi', hucre: kon(d, i) });
      puanEkle(c, t, PUAN.isTemizle, 'diger', i);
      hedefSay(c, 'is', t);
      return;
    }
    default:
      return;
  }
}

/**
 * Barut izi tutuşur (§5): i hücresi izin j. sırasıysa ve yanmamışsa yanar;
 * iki yöne adım başına 60 tik ilerleyen IZ_ILERLE planlanır. Tutuşturan
 * hücre zaten patladı ya da vuruş aldı; ona ikinci vuruş verilmez.
 */
export function izTutustur(c: Cozum, i: number, t: number, g: number): void {
  const d = c.d;
  const k = d.hucreler[i].izIndeksi;
  if (k < 0) return;
  const iz = d.izler[k];
  if (!iz) return;
  const j = iz.hucreler.indexOf(i);
  if (j < 0 || iz.yandi[j]) return;
  iz.yandi[j] = true;
  c.olaylar.push({ t, tur: 'izYandi', hucre: kon(d, i) });
  if (j > 0) ekle(c, t + IZ_ADIM, iz.hucreler[j - 1], 'IZ_ILERLE', { iz: k, izSira: j - 1, yon: -1, nesil: g });
  if (j < iz.hucreler.length - 1) ekle(c, t + IZ_ADIM, iz.hucreler[j + 1], 'IZ_ILERLE', { iz: k, izSira: j + 1, yon: 1, nesil: g });
}

/** Düz kapsül: özel olmayan, kafessiz, renkli kapsül (§5 is yayılması, §3.8, §7.3). */
export function duzKapsulMu(h: Hucre): boolean {
  return !h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.ozel === 'yok' && h.icerik.renk >= 0;
}

/**
 * İs yayılması (§5): hamlede hiç is temizlenmediyse, ise dik komşu düz
 * kapsüller (y, x) sırasına dizilir ve `rngInt` ile biri ise döner (ısısı
 * kaybolur). Hamle başına en fazla 1.
 */
export function isYayil(c: Cozum, t: number): void {
  if (c.isTemizlendi) return;
  const d = c.d;
  const aday = new Uint8Array(d.w * d.h);
  let isVar = false;
  for (let y = 0; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) {
      const h = d.hucreler[y * d.w + x];
      if (h.delik || h.icerik?.tur !== 'is') continue;
      isVar = true;
      if (y > 0) aday[(y - 1) * d.w + x] = 1;
      if (y < d.h - 1) aday[(y + 1) * d.w + x] = 1;
      if (x > 0) aday[y * d.w + x - 1] = 1;
      if (x < d.w - 1) aday[y * d.w + x + 1] = 1;
    }
  }
  if (!isVar) return;
  const liste: number[] = [];
  for (let i = 0; i < aday.length; i++) if (aday[i] && duzKapsulMu(d.hucreler[i])) liste.push(i);
  if (liste.length === 0) return;
  const s = liste[rngInt(d, liste.length)];
  d.hucreler[s].icerik = { tur: 'is' };
  c.olaylar.push({ t, tur: 'isYayildi', hucre: kon(d, s) });
  isGerekliArtir(c, t);
}
