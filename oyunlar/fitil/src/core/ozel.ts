/**
 * Özel taş etkileri (§4.2) ve kombinasyonlar (§4.4).
 *
 * Etkiler kuyruğa olay ekler; kendi başlarına patlatmaz. Hücre kümesi
 * yardımcıları önizlemeyle (§3.9) paylaşılır.
 */
import { ekle, kon, puanEkle, type Cozum } from './baglam';
import {
  BUYUK_FINAL_ADIM,
  DEV_KASIMPATI_ADIM,
  DEV_KASIMPATI_DALGA,
  KASIMPATI_DALGA,
  KASIMPATI_VURUS,
  KOMBO_ADIM,
  PUAN,
  ROKET_ADIM,
  YILDIZ_ADIM,
} from './sabitler';
import { enCokRenk } from './yol';
import type { Eksen, KomboTuru, OyunDurumu, OzelTur, PatlamaNedeni } from './types';

/** Eksenin iki yönü (§2.3): 0 yatay, 1 dikey, 2 ↗/↙, 3 ↘/↖. */
export const EKSEN_YONLERI: readonly (readonly [number, number])[][] = [
  [
    [1, 0],
    [-1, 0],
  ],
  [
    [0, -1],
    [0, 1],
  ],
  [
    [1, -1],
    [-1, 1],
  ],
  [
    [1, 1],
    [-1, -1],
  ],
];

/** Hücre ve uzaklık çifti: [uzaklık, indeks]. */
export type UzakHucre = [number, number];

function deliksiz(d: OyunDurumu, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < d.w && y < d.h && !d.hucreler[y * d.w + x].delik;
}

/** Roket: eksenin iki yönünde d = 1, 2, … kenara kadar; delikler atlanır (§4.2). */
export function roketHucreleri(d: OyunDurumu, x: number, y: number, eksen: Eksen, cikti: UzakHucre[] = []): UzakHucre[] {
  for (const [dx, dy] of EKSEN_YONLERI[eksen]) {
    for (let u = 1; ; u++) {
      const nx = x + dx * u;
      const ny = y + dy * u;
      if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) break;
      if (!d.hucreler[ny * d.w + nx].delik) cikti.push([u, ny * d.w + nx]);
    }
  }
  return cikti;
}

/** Chebyshev uzaklığı tam r olan deliksiz hücreler, (y, x) sırasıyla. */
export function halkaHucreleri(d: OyunDurumu, x: number, y: number, r: number): number[] {
  const c: number[] = [];
  for (let ny = y - r; ny <= y + r; ny++) {
    for (let nx = x - r; nx <= x + r; nx++) {
      if (Math.max(Math.abs(nx - x), Math.abs(ny - y)) !== r) continue;
      if (deliksiz(d, nx, ny)) c.push(ny * d.w + nx);
    }
  }
  return c;
}

/**
 * Kalın roket şeridi (§4.4): eksen boyunca 3 paralel hat. Yatayda y−1, y,
 * y+1 satırları; dikeyde x−1, x, x+1 sütunları; çaprazda (x−1, y), (x, y),
 * (x+1, y) noktalarından geçen hatlar. d = eksen boyunca uzaklık. Taban
 * noktası tahta dışında kalan çapraz hat tahtaya sonradan girebilir, bu
 * yüzden tahta dışı hücreler atlanır (durulmaz). S2'nin kendisi hariç.
 */
export function kalinRoketHucreleri(d: OyunDurumu, x: number, y: number, eksen: Eksen): UzakHucre[] {
  const [dx, dy] = EKSEN_YONLERI[eksen][0];
  const kaydir: [number, number][] =
    eksen === 0
      ? [
          [0, -1],
          [0, 0],
          [0, 1],
        ]
      : [
          [-1, 0],
          [0, 0],
          [1, 0],
        ];
  const L = d.w + d.h;
  const c: UzakHucre[] = [];
  for (const [ox, oy] of kaydir) {
    for (let s = -L; s <= L; s++) {
      if (ox === 0 && oy === 0 && s === 0) continue;
      const nx = x + ox + dx * s;
      const ny = y + oy + dy * s;
      if (deliksiz(d, nx, ny)) c.push([Math.abs(s), ny * d.w + nx]);
    }
  }
  return c;
}

/** Hedef renkteki planlı olmayan kapsüller (kafesli dahil), (dx²+dy², y, x) sırasıyla (§4.2). */
export function renkHedefleri(d: OyunDurumu, x: number, y: number, renk: number, planli: Uint8Array | null, uzaklikSirali: boolean): number[] {
  const l: number[] = [];
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    if (h.delik || h.icerik?.tur !== 'kapsul' || h.icerik.renk !== renk) continue;
    if (planli && planli[i]) continue;
    l.push(i);
  }
  if (uzaklikSirali) {
    const u = (i: number): number => {
      const hx = i % d.w;
      const hy = (i - hx) / d.w;
      return (hx - x) * (hx - x) + (hy - y) * (hy - y);
    };
    // İndeks (y, x) sırasını zaten verir; eşit uzaklıkta kararlı sıralama korur.
    l.sort((a, b) => u(a) - u(b) || a - b);
  }
  return l;
}

/**
 * Yıldız topunun hedef rengi (§4.2): zincir hamlesinde zincir rengi (zincirde
 * ya da zincir dışından tetiklense de); zincir olmayan eylemde (çift dokunuş,
 * kibrit, körük, final) tetiklenme anında tahtada en çok bulunan renk.
 */
export function yildizHedefRengi(c: Cozum): number {
  return c.zincirVar ? c.zincirRengi : enCokRenk(c.d);
}

/** Kendi etkisi (§4.2). T: tetiklenme anı, g: nesil, neden: vuruşların nedeni. */
export function ozelEtki(c: Cozum, i: number, ozel: OzelTur, eksen: Eksen, T: number, g: number, neden: PatlamaNedeni): void {
  const d = c.d;
  const x = i % d.w;
  const y = (i - x) / d.w;
  if (ozel === 'roket') {
    c.olaylar.push({ t: T, tur: 'ozelTetiklendi', hucre: kon(d, i), ozel, eksen });
    for (const [u, j] of roketHucreleri(d, x, y, eksen)) ekle(c, T + ROKET_ADIM * u, j, 'VURUS', { nesil: g, neden });
  } else if (ozel === 'kasimpati') {
    c.olaylar.push({ t: T, tur: 'ozelTetiklendi', hucre: kon(d, i), ozel, eksen });
    for (const j of halkaHucreleri(d, x, y, 1)) ekle(c, T + KASIMPATI_VURUS, j, 'VURUS', { nesil: g, neden });
    ekle(c, T + KASIMPATI_DALGA, i, 'DALGA', { yaricap: 2 });
    for (const j of halkaHucreleri(d, x, y, 2)) ekle(c, T + KASIMPATI_DALGA, j, 'ISI_DALGASI', { nesil: g });
  } else if (ozel === 'yildiz') {
    const hedefRenk = yildizHedefRengi(c);
    c.olaylar.push({ t: T, tur: 'ozelTetiklendi', hucre: kon(d, i), ozel, eksen, hedefRenk });
    const l = renkHedefleri(d, x, y, hedefRenk, c.planli, true);
    for (let k = 0; k < l.length; k++) ekle(c, T + YILDIZ_ADIM * (k + 1), l[k], 'VURUS', { nesil: g, neden });
  }
}

/** İki özel taşın birleşimi (§4.4); sıra önemsiz, 6 çift. */
export function komboTuru(a: OzelTur, b: OzelTur): KomboTuru | null {
  if (a === 'yok' || b === 'yok') return null;
  const s = a < b ? `${a}+${b}` : `${b}+${a}`;
  switch (s) {
    case 'roket+roket':
      return 'yildizHatti';
    case 'kasimpati+roket':
      return 'kalinRoket';
    case 'kasimpati+kasimpati':
      return 'devKasimpati';
    case 'roket+yildiz':
      return 'roketYagmuru';
    case 'kasimpati+yildiz':
      return 'bahce';
    case 'yildiz+yildiz':
      return 'buyukFinal';
  }
  return null;
}

/**
 * Birleşik etki S2 hücresinde T anında başlar (§4.4). s1: yüklenen taş,
 * s2: S2'nin kendisi. "Zincir rengi" joker çiftlerinde §4.2 kuralına uyar.
 */
export function komboEtki(
  c: Cozum,
  i: number,
  s1: { ozel: OzelTur; eksen: Eksen },
  s2: { ozel: OzelTur; eksen: Eksen },
  T: number,
  g: number,
  neden: PatlamaNedeni,
): void {
  const d = c.d;
  const kt = komboTuru(s1.ozel, s2.ozel);
  if (!kt) return;
  const x = i % d.w;
  const y = (i - x) / d.w;
  c.olaylar.push({ t: T, tur: 'kombinasyon', hucre: kon(d, i), kombo: kt });
  puanEkle(c, T, PUAN.kombo[kt], 'diger', i);
  d.istatistik.kombinasyon++;
  c.kombo = true;
  switch (kt) {
    case 'yildizHatti': {
      const l: [number, number][] = [];
      for (let e = 0; e < 4; e++) roketHucreleri(d, x, y, e as Eksen, l);
      for (const [u, j] of l) ekle(c, T + ROKET_ADIM * u, j, 'VURUS', { nesil: g, neden });
      return;
    }
    case 'kalinRoket': {
      const eksen = s1.ozel === 'roket' ? s1.eksen : s2.eksen;
      for (const [u, j] of kalinRoketHucreleri(d, x, y, eksen)) ekle(c, T + ROKET_ADIM * u, j, 'VURUS', { nesil: g, neden });
      return;
    }
    case 'devKasimpati': {
      for (let r = 1; r <= 2; r++) for (const j of halkaHucreleri(d, x, y, r)) ekle(c, T + DEV_KASIMPATI_ADIM * r, j, 'VURUS', { nesil: g, neden });
      ekle(c, T + DEV_KASIMPATI_DALGA, i, 'DALGA', { yaricap: 3 });
      for (const j of halkaHucreleri(d, x, y, 3)) ekle(c, T + DEV_KASIMPATI_DALGA, j, 'ISI_DALGASI', { nesil: g });
      return;
    }
    case 'roketYagmuru':
    case 'bahce': {
      // Zincir rengindeki planlı olmayan kapsüller (kafesli dahil) döner;
      // roket yağmurunda (y, x), bahçede S2'ye uzaklık sırasıyla. i. taş
      // T + 40·(i+1) anında kendi hücresinde patlar ve etkisini işler.
      const renk = c.zincirVar ? c.zincirRengi : enCokRenk(d);
      const yeni: OzelTur = kt === 'roketYagmuru' ? 'roket' : 'kasimpati';
      const l = renkHedefleri(d, x, y, renk, c.planli, kt === 'bahce');
      for (let k = 0; k < l.length; k++) {
        const j = l[k];
        const ic = d.hucreler[j].icerik;
        if (ic?.tur !== 'kapsul') continue;
        ic.ozel = yeni;
        ic.eksen = (yeni === 'roket' ? k % 4 : 0) as Eksen;
        c.planli[j] = 1;
        c.olaylar.push({ t: T, tur: 'ozelOlustu', hucre: kon(d, j), ozel: yeni, eksen: ic.eksen, renk: ic.renk, isi: ic.isi });
        ekle(c, T + KOMBO_ADIM * (k + 1), j, 'TETIK', { nesil: g, neden });
      }
      return;
    }
    case 'buyukFinal': {
      for (let j = 0; j < d.hucreler.length; j++) {
        if (j === i || d.hucreler[j].delik) continue;
        const jx = j % d.w;
        const jy = (j - jx) / d.w;
        const u = Math.max(Math.abs(jx - x), Math.abs(jy - y));
        ekle(c, T + BUYUK_FINAL_ADIM * u, j, 'VURUS', { nesil: g, neden });
      }
      return;
    }
  }
}

/** Etki hücreleri (önizleme §3.9, kesik çizgi): kendi etkisi. */
export function etkiHucreleri(d: OyunDurumu, i: number, ozel: OzelTur, eksen: Eksen, hedefRenk: number, haric: ReadonlySet<number>): number[] {
  const x = i % d.w;
  const y = (i - x) / d.w;
  if (ozel === 'roket') return roketHucreleri(d, x, y, eksen).map((u) => u[1]);
  if (ozel === 'kasimpati') return [...halkaHucreleri(d, x, y, 1), ...halkaHucreleri(d, x, y, 2)];
  if (ozel === 'yildiz') return renkHedefleri(d, x, y, hedefRenk, null, true).filter((j) => !haric.has(j));
  return [];
}

/** Kombinasyon etki hücreleri (önizleme). */
export function komboHucreleri(d: OyunDurumu, i: number, kt: KomboTuru, rokEksen: Eksen, renk: number, haric: ReadonlySet<number>): number[] {
  const x = i % d.w;
  const y = (i - x) / d.w;
  switch (kt) {
    case 'yildizHatti': {
      const l: UzakHucre[] = [];
      for (let e = 0; e < 4; e++) roketHucreleri(d, x, y, e as Eksen, l);
      return l.map((u) => u[1]);
    }
    case 'kalinRoket':
      return kalinRoketHucreleri(d, x, y, rokEksen).map((u) => u[1]);
    case 'devKasimpati':
      return [1, 2, 3].flatMap((r) => halkaHucreleri(d, x, y, r));
    case 'roketYagmuru':
    case 'bahce':
      return renkHedefleri(d, x, y, renk, null, kt === 'bahce').filter((j) => !haric.has(j));
    case 'buyukFinal': {
      const l: number[] = [];
      for (let j = 0; j < d.hucreler.length; j++) if (j !== i && !d.hucreler[j].delik) l.push(j);
      return l;
    }
  }
}
