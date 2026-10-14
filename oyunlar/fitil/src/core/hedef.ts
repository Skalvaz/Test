/**
 * Bölüm hedefleri (§6): başlangıç durumu, ilerleme sayımı, tamamlanma.
 * İlerleme `gerekli` ile sınırlanır (HUD "25/25" gösterir). Her değişiklik
 * `hedefIlerledi` olayı yazar.
 */
import type { Cozum } from './baglam';
import type { Hedef, HedefDurumu, OyunDurumu } from './types';

export function hedefDurumu(d: OyunDurumu, h: Hedef): HedefDurumu {
  let gerekli = 0;
  switch (h.tur) {
    case 'topla':
    case 'fener':
    case 'devFisek':
    case 'zincirleme':
    case 'halka':
      gerekli = h.adet;
      break;
    case 'puan':
      gerekli = h.puan;
      break;
    case 'kafes':
      gerekli = d.hucreler.filter((c) => !c.delik && c.kafes).length;
      break;
    case 'kaya':
      gerekli = d.hucreler.filter((c) => !c.delik && c.icerik?.tur === 'kaya').length;
      break;
    case 'aydinlat':
      gerekli = d.hucreler.reduce((s, c) => s + (c.delik ? 0 : c.doseme), 0);
      break;
    case 'desen':
      gerekli = d.hucreler.filter((c) => !c.delik && c.desenRengi >= 0).length;
      break;
    case 'is':
      gerekli = d.hucreler.filter((c) => !c.delik && c.icerik?.tur === 'is').length;
      break;
  }
  return { hedef: h, ilerleme: 0, gerekli, tamam: gerekli <= 0 };
}

function yaz(c: Cozum, indeks: number, t: number): void {
  const h = c.d.hedefler[indeks];
  c.olaylar.push({ t, tur: 'hedefIlerledi', indeks, deger: h.ilerleme, tamam: h.tamam, gerekli: h.gerekli });
}

/** indeks. hedefin ilerlemesini `miktar` artır (gerekli ile sınırlı). */
export function hedefArtir(c: Cozum, indeks: number, miktar: number, t: number): void {
  const h = c.d.hedefler[indeks];
  const yeni = Math.min(h.gerekli, h.ilerleme + miktar);
  const tamam = yeni >= h.gerekli;
  if (yeni === h.ilerleme && tamam === h.tamam) return;
  h.ilerleme = yeni;
  h.tamam = tamam;
  yaz(c, indeks, t);
}

/** Belirli türdeki bütün hedefleri 1 artır (kafes, kaya, aydinlat, desen, is, fener, devFisek, halka, zincirleme). */
export function hedefSay(c: Cozum, tur: Hedef['tur'], t: number, miktar = 1): void {
  const hs = c.d.hedefler;
  for (let k = 0; k < hs.length; k++) if (hs[k].hedef.tur === tur) hedefArtir(c, k, miktar, t);
}

/**
 * TOPLA sayacı (§6.1): renk eşleşirse ya da hedef 'hepsi' ise +1. Yıldız
 * topu (renk −1) yalnız 'hepsi' sayacına girer. Dönüşüm ve kuruma sayılmaz
 * (bu işlev yalnız patlamada çağrılır).
 */
export function toplaSay(c: Cozum, renk: number, t: number): void {
  const hs = c.d.hedefler;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k].hedef;
    if (h.tur !== 'topla') continue;
    if (h.renk === 'hepsi' || (renk >= 0 && h.renk === renk)) hedefArtir(c, k, 1, t);
  }
}

/** İs yayıldı: 'is' hedeflerinin gerekli miktarı +1 (§6.8). */
export function isGerekliArtir(c: Cozum, t: number): void {
  const hs = c.d.hedefler;
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k];
    if (h.hedef.tur !== 'is') continue;
    h.gerekli++;
    h.tamam = h.ilerleme >= h.gerekli;
    yaz(c, k, t);
  }
}

/** 'puan' hedefini güncel puana eşitle (§6.11). */
export function puanHedefi(c: Cozum, t: number): void {
  const hs = c.d.hedefler;
  for (let k = 0; k < hs.length; k++) {
    if (hs[k].hedef.tur !== 'puan') continue;
    hedefArtir(c, k, c.d.puan - hs[k].ilerleme, t);
  }
}

export function hepsiTamam(d: OyunDurumu): boolean {
  for (const h of d.hedefler) if (!h.tamam) return false;
  return true;
}
