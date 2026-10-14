/**
 * Yerçekimi ve doldurma (§3.6), fener toplama (§5, §3.5.4 adım 2).
 *
 * Kaskad yoktur (§3.7): düşen ve doğan taşlar kendiliğinden patlamaz.
 * RNG tüketim sırası (§16.3): dolum (soldan sağa sütun, aşağıdan yukarı
 * yuva) → fener doğumu → yardım yeniden çekimleri.
 */
import { kon, puanEkle, type Cozum } from './baglam';
import { hedefSay } from './hedef';
import { bilesenVar } from './kilit';
import { agirlikliSec, rngInt } from './rng';
import { PUAN, YERCEKIMI_PAYI } from './sabitler';
import { hareketliMi, sabitMi } from './tahta';
import type { Icerik, Konum, Renk } from './types';

/** Yardım n: doldurmadan sonra aranan bileşen boyutu (§3.6). */
const YARDIM_BILESEN = 4;

/**
 * Bir yerçekimi + doldurma turu. Bir şey düştüyse ya da doğduysa `yercekimi`
 * olayını t anında yazar ve true döner.
 */
export function yercekimiUygula(c: Cozum, t: number): boolean {
  const d = c.d;
  const W = d.w;
  const H = d.h;
  const dusenler: { den: Konum; e: Konum }[] = [];
  // Doğan kapsüller dolum sırasıyla: hücre, sütundaki dolum sırası.
  const doganHucre: number[] = [];
  const doganSira: number[] = [];
  // Dolum alan sütunlar ve her birinin en üst dolum kaydı (doganHucre indeksi).
  const dolumSutunlari: number[] = [];
  const enUstKayit: number[] = [];

  const S: number[] = [];
  for (let x = 0; x < W; x++) {
    // Yuva listesi: aşağıdan yukarı, delik ve sabit hücreler atlanır.
    S.length = 0;
    for (let y = H - 1; y >= 0; y--) {
      const h = d.hucreler[y * W + x];
      if (h.delik || sabitMi(h)) continue;
      S.push(y * W + x);
    }
    // Hareketli içerik sırasını koruyarak aşağı sıkışır (sabitlerin arkasından geçer).
    let yaz = 0;
    for (let k = 0; k < S.length; k++) {
      const h = d.hucreler[S[k]];
      if (!hareketliMi(h)) continue;
      if (k !== yaz) {
        d.hucreler[S[yaz]].icerik = h.icerik;
        h.icerik = null;
        dusenler.push({ den: kon(d, S[k]), e: kon(d, S[yaz]) });
      }
      yaz++;
    }
    // Üstte kalan boş yuvalar aşağıdan yukarı doldurulur.
    if (yaz < S.length) {
      for (let k = yaz; k < S.length; k++) {
        const renk = agirlikliSec(d, d.dogumAgirliklari) as Renk;
        d.hucreler[S[k]].icerik = { tur: 'kapsul', renk, isi: 0, ozel: 'yok', eksen: 0 };
        doganHucre.push(S[k]);
        doganSira.push(k - yaz);
      }
      dolumSutunlari.push(x);
      enUstKayit.push(doganHucre.length - 1);
    }
  }

  // Fener doğumu: tur başına en fazla 1.
  let fenerKayit = -1;
  const fd = d.fenerDogum;
  if (fd && fd.kalan > 0 && dolumSutunlari.length > 0) {
    let sahada = 0;
    for (const h of d.hucreler) if (!h.delik && h.icerik?.tur === 'fener') sahada++;
    if (sahada < fd.sahadaEnFazla) {
      const s = rngInt(d, dolumSutunlari.length);
      fenerKayit = enUstKayit[s];
      d.hucreler[doganHucre[fenerKayit]].icerik = { tur: 'fener' };
      fd.kalan--;
    }
  }

  // Yardım n: ≥ 4'lük bileşen yoksa doğanlar aynı sırayla yeniden çekilir.
  if (d.yardim > 0 && doganHucre.length > (fenerKayit >= 0 ? 1 : 0)) {
    for (let n = 0; n < d.yardim && !bilesenVar(d, YARDIM_BILESEN); n++) {
      for (let k = 0; k < doganHucre.length; k++) {
        if (k === fenerKayit) continue;
        const ic = d.hucreler[doganHucre[k]].icerik;
        if (ic?.tur === 'kapsul') ic.renk = agirlikliSec(d, d.dogumAgirliklari) as Renk;
      }
    }
  }

  if (dusenler.length === 0 && doganHucre.length === 0) return false;
  const doganlar: { hucre: Konum; icerik: Icerik; sanalY: number }[] = [];
  for (let k = 0; k < doganHucre.length; k++) {
    const ic = d.hucreler[doganHucre[k]].icerik as Icerik;
    doganlar.push({ hucre: kon(d, doganHucre[k]), icerik: { ...ic }, sanalY: -(doganSira[k] + 1) });
  }
  c.olaylar.push({ t, tur: 'yercekimi', dusenler, doganlar });
  return true;
}

/** Yerçekimi turu; olduysa sonraki aşamalar YERCEKIMI_PAYI sonra başlar. */
export function yercekimiTuru(c: Cozum, t: number): number {
  return yercekimiUygula(c, t) ? t + YERCEKIMI_PAYI : t;
}

/**
 * Fener toplama: `cikislar` sütunlarının çıkış yuvasındaki (sütunun deliksiz
 * en alt hücresi) fenerler toplanır (+200). Toplanan varsa true.
 */
export function fenerTopla(c: Cozum, t: number): boolean {
  const d = c.d;
  let toplandi = false;
  const sutunlar = [...new Set(d.cikislar)].filter((x) => x >= 0 && x < d.w).sort((a, b) => a - b);
  for (const x of sutunlar) {
    let i = -1;
    for (let y = d.h - 1; y >= 0; y--) {
      if (!d.hucreler[y * d.w + x].delik) {
        i = y * d.w + x;
        break;
      }
    }
    if (i < 0 || d.hucreler[i].icerik?.tur !== 'fener') continue;
    d.hucreler[i].icerik = null;
    c.olaylar.push({ t, tur: 'fenerToplandi', hucre: kon(d, i) });
    puanEkle(c, t, PUAN.fener, 'diger', i);
    d.istatistik.fenerToplanan++;
    hedefSay(c, 'fener', t);
    toplandi = true;
  }
  return toplandi;
}
