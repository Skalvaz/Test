/**
 * Karıştırma (§3.8). Konumlar: kafessiz kapsül (özel dahil) bulunan
 * hücreler; içerikler ısı ve özellikleriyle Fisher–Yates ile oyun
 * RNG'sinden karıştırılır. Fener ve ıslak yerinde kalır.
 *  1. Sonuç kilitliyse en fazla 20 kez tekrarlanır.
 *  2. Hâlâ kilitliyse düz kapsüller (y, x) sırasıyla dolaşılır ve rengi
 *     `rngInt(n)` ile yeniden çekilir (ısı korunur). Kilit kalkınca durulur.
 *
 * Sonlanma ve kilitsizlik güvencesi (P1 eki, §3.8'de yok): 2. adımdan sonra
 * hâlâ kilitliyse (çok az kapsüllü, engel dolu tahta) RNG kullanmadan
 * (y, x) sırasında ilk uygun komşu üçlü (yalnizHalka'da 2×2 blok) ilk
 * kapsülün rengine boyanır; o da yoksa ilk kafessiz kapsül yatay rokete
 * döner (çift dokunuş her zaman geçerli hamledir). Kafessiz kapsül hiç
 * yoksa tahta kilitli kalır (doğrulayıcı böyle bölümü reddeder).
 */
import { duzKapsulMu } from './engel';
import { kilitliMi } from './kilit';
import { rngInt } from './rng';
import { KARISTIRMA_SINIRI } from './sabitler';
import { DIK, SEKIZ } from './tahta';
import type { Icerik, Konum, OyunDurumu, Renk } from './types';

export interface KaristirmaSonucu {
  /** Yer değiştiren içerikler: den → e. */
  esleme: { den: Konum; e: Konum }[];
  /** Rengi yeniden çekilen kapsüller (son renk). */
  yenidenRenk: { hucre: Konum; renk: number }[];
  /** Son çare: rokete dönen kapsül. */
  roket: Konum | null;
}

function konum(w: number, i: number): Konum {
  const x = i % w;
  return { x, y: (i - x) / w };
}

/** d'yi yerinde karıştırır (d.rng tüketilir). */
export function karistir(d: OyunDurumu): KaristirmaSonucu {
  const yer: number[] = [];
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul') yer.push(i);
  }
  // kaynak[k]: yer[k]'deki içeriğin karıştırmadan önceki hücresi.
  const kaynak = yer.slice();
  const icerik: (Icerik | null)[] = yer.map((i) => d.hucreler[i].icerik);
  const karistirBir = (): void => {
    for (let k = yer.length - 1; k > 0; k--) {
      const j = rngInt(d, k + 1);
      const g = icerik[k];
      icerik[k] = icerik[j];
      icerik[j] = g;
      const s = kaynak[k];
      kaynak[k] = kaynak[j];
      kaynak[j] = s;
    }
    for (let k = 0; k < yer.length; k++) d.hucreler[yer[k]].icerik = icerik[k];
  };

  karistirBir();
  for (let tekrar = 0; tekrar < KARISTIRMA_SINIRI && kilitliMi(d); tekrar++) karistirBir();

  const renkDegisen = new Map<number, number>();
  if (kilitliMi(d)) {
    // 2. Düz kapsülleri sırayla yeniden renklendir.
    for (let i = 0; i < d.hucreler.length; i++) {
      const h = d.hucreler[i];
      if (!duzKapsulMu(h) || h.icerik?.tur !== 'kapsul') continue;
      const renk = rngInt(d, d.renkSayisi) as Renk;
      if (renk !== h.icerik.renk) {
        h.icerik.renk = renk;
        renkDegisen.set(i, renk);
      }
      if (!kilitliMi(d)) break;
    }
  }

  let roket: Konum | null = null;
  if (kilitliMi(d)) roket = sonCare(d, renkDegisen);

  const esleme: { den: Konum; e: Konum }[] = [];
  for (let k = 0; k < yer.length; k++) if (kaynak[k] !== yer[k]) esleme.push({ den: konum(d.w, kaynak[k]), e: konum(d.w, yer[k]) });
  const yenidenRenk = [...renkDegisen].sort((a, b) => a[0] - b[0]).map(([i, renk]) => ({ hucre: konum(d.w, i), renk }));
  return { esleme, yenidenRenk, roket };
}

/** Belirlenimli son çare (RNG yok); bkz. dosya başı. */
function sonCare(d: OyunDurumu, renkDegisen: Map<number, number>): Konum | null {
  const w = d.w;
  const duz = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < d.w && y < d.h && duzKapsulMu(d.hucreler[y * w + x]);
  const boya = (hucreler: number[]): void => {
    const ilk = d.hucreler[hucreler[0]].icerik;
    if (ilk?.tur !== 'kapsul') return;
    for (const i of hucreler) {
      const ic = d.hucreler[i].icerik;
      if (ic?.tur === 'kapsul' && ic.renk !== ilk.renk) {
        ic.renk = ilk.renk;
        renkDegisen.set(i, ilk.renk);
      }
    }
  };
  if (d.kurallar.yalnizHalka) {
    for (let y = 0; y + 1 < d.h; y++) {
      for (let x = 0; x + 1 < d.w; x++) {
        if (duz(x, y) && duz(x + 1, y) && duz(x, y + 1) && duz(x + 1, y + 1)) {
          boya([y * w + x, y * w + x + 1, (y + 1) * w + x, (y + 1) * w + x + 1]);
          if (!kilitliMi(d)) return null;
        }
      }
    }
  } else {
    const komsu = d.kurallar.dortKomsu ? DIK : SEKIZ;
    for (let a = 0; a < d.hucreler.length; a++) {
      const ax = a % w;
      const ay = (a - ax) / w;
      if (!duz(ax, ay)) continue;
      for (const k1 of komsu) {
        const bx = ax + k1.x;
        const by = ay + k1.y;
        if (!duz(bx, by)) continue;
        for (const k2 of komsu) {
          const cx = bx + k2.x;
          const cy = by + k2.y;
          if ((cx === ax && cy === ay) || !duz(cx, cy)) continue;
          boya([a, by * w + bx, cy * w + cx]);
          if (!kilitliMi(d)) return null;
        }
      }
    }
  }
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul') {
      h.icerik.ozel = 'roket';
      h.icerik.eksen = 0;
      return konum(w, i);
    }
  }
  return null;
}
