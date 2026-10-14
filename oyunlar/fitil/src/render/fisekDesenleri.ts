/**
 * 24 havai fişek deseni (GDD §10.3 tablosu). Her desen prosedüreldir:
 * `{ parcacik, yayilma, hiz[px/s], omur[ms], iz, yercekimi, renk }` ve bir
 * üretici. Üretici havuza tam `adet(parcacik)` parçacık koyar (otomatik
 * kalitede yarısı). Hızlar `olcek` ile çarpılır (gök bandının boyuna göre).
 */
import type { DesenId } from '../app/katalog';
import { B, T, type ParcacikHavuzu } from './parcacik';
import { R } from './palet';

export type IzBoyu = 'yok' | 'kisa' | 'orta' | 'uzun' | 'cokUzun';

/** İz süresi (s): çizgi boyu = hız × iz. */
export const IZ_SN: Record<IzBoyu, number> = { yok: 0, kisa: 0.045, orta: 0.09, uzun: 0.16, cokUzun: 0.26 };

export interface DesenOrtami {
  /** Hız ölçeği (1 = 390 px genişlikte gök bandı). */
  olcek: number;
  /** Ana renk (efekt renk indeksi); −1 gökkuşağı. */
  renk: number;
  /** İkincil renk (efekt renk indeksi). */
  renk2: number;
  /** [0,1) görsel rastgelelik. */
  rnd: () => number;
  /** Gök katmanı mı. */
  gok: boolean;
  /** Ek gecikme (ms). */
  gecikme?: number;
}

export interface DesenTarifi {
  id: DesenId;
  /** Tablo: toplam parçacık. */
  parcacik: number;
  yayilma: string;
  /** Temel hız px/s (ölçek 1). */
  hiz: number;
  /** Temel ömür ms. */
  omur: number;
  iz: IzBoyu;
  /** Yerçekimi px/s². */
  yercekimi: number;
  /** Sürtünme 1/s. */
  surtunme: number;
  /** Parçacık yarıçapı px. */
  boy: number;
  uret(h: ParcacikHavuzu, x: number, y: number, o: DesenOrtami): number;
}

const ALTIN = R.ALTIN;
const ALTIN_ORAN = Math.PI * (3 - Math.sqrt(5));

/** Tarifin parametreleriyle tek parçacık. */
function p(
  h: ParcacikHavuzu,
  t: DesenTarifi,
  o: DesenOrtami,
  x: number,
  y: number,
  vx: number,
  vy: number,
  renk: number,
  ek?: { boy?: number; omur?: number; iz?: number; bayrak?: number; gecikme?: number; acisal?: number; yercekimi?: number; surtunme?: number },
): void {
  const tur = t.iz === 'yok' ? T.NOKTA : T.CIZGI;
  const rr = o.rnd();
  const omur = (ek?.omur ?? t.omur) * (0.85 + 0.3 * rr);
  const i = h.ekle(tur, x, y, vx * o.olcek, vy * o.olcek, omur, (ek?.boy ?? t.boy) * Math.min(1.3, 0.6 + 0.4 * o.olcek), renk, ek?.surtunme ?? t.surtunme, (ek?.yercekimi ?? t.yercekimi) * o.olcek);
  if (i < 0) return;
  h.iz[i] = ek?.iz ?? IZ_SN[t.iz];
  h.bayrak[i] = (o.gok ? B.GOK : 0) | (ek?.bayrak ?? B.PIRILTI);
  h.acisal[i] = ek?.acisal ?? 0;
  const g = (o.gecikme ?? 0) + (ek?.gecikme ?? 0);
  if (g > 0) h.yas[i] = -g;
}

/** Gökkuşağıysa her parçacığa ayrı ton. */
function renkSec(o: DesenOrtami, i: number): number {
  return o.renk < 0 ? R.GOKKUSAGI + (i % 6) : o.renk;
}

function kure(h: ParcacikHavuzu, t: DesenTarifi, x: number, y: number, o: DesenOrtami, n: number, hiz: number, sapma: number, ek?: Parameters<typeof p>[8]): void {
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - z * z);
    const a = i * ALTIN_ORAN + o.rnd() * 0.05;
    const v = hiz * (1 + (o.rnd() - 0.5) * sapma);
    p(h, t, o, x, y, Math.cos(a) * rr * v, Math.sin(a) * rr * v, renkSec(o, i), ek);
  }
}

function cember(h: ParcacikHavuzu, t: DesenTarifi, x: number, y: number, o: DesenOrtami, n: number, hiz: number, renk: number, egim: number, basla = 0, ek?: Parameters<typeof p>[8]): void {
  const ce = Math.cos(egim);
  const se = Math.sin(egim);
  const yass = 0.55 + 0.45 * Math.abs(Math.cos(egim * 1.7));
  for (let i = 0; i < n; i++) {
    const a = basla + (i / n) * Math.PI * 2;
    const ux = Math.cos(a) * hiz;
    const uy = Math.sin(a) * hiz * yass;
    p(h, t, o, x, y, ux * ce - uy * se, ux * se + uy * ce, renk < 0 ? renkSec(o, i) : renk, ek);
  }
}

/** Kapalı bir eğriyi (u ∈ [0,1)) n noktayla örnekleyip hız alanı yap. */
function egri(h: ParcacikHavuzu, t: DesenTarifi, x: number, y: number, o: DesenOrtami, n: number, f: (u: number) => [number, number], aci = 0, ek?: Parameters<typeof p>[8]): void {
  const ca = Math.cos(aci);
  const sa = Math.sin(aci);
  for (let i = 0; i < n; i++) {
    const [ux, uy] = f(i / n);
    const vx = (ux * ca - uy * sa) * t.hiz;
    const vy = (ux * sa + uy * ca) * t.hiz;
    p(h, t, o, x, y, vx, vy, renkSec(o, i), ek);
  }
}

/** Kırık çizgi üzerinde eşit aralıklı örnekleme (kapalı). */
function cokgenOrnek(v: [number, number][], u: number): [number, number] {
  const n = v.length;
  let L = 0;
  const parca: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = v[i];
    const b = v[(i + 1) % n];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    parca.push(d);
    L += d;
  }
  let s = u * L;
  for (let i = 0; i < n; i++) {
    if (s <= parca[i] || i === n - 1) {
      const a = v[i];
      const b = v[(i + 1) % n];
      const k = parca[i] ? s / parca[i] : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    s -= parca[i];
  }
  return v[0];
}

const YILDIZ5: [number, number][] = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 ? 0.42 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r];
});

const LALE: [number, number][] = [
  [0, 0.55],
  [-0.38, 0.38],
  [-0.56, 0.0],
  [-0.58, -0.45],
  [-0.48, -0.8],
  [-0.24, -0.42],
  [0, -0.9],
  [0.24, -0.42],
  [0.48, -0.8],
  [0.58, -0.45],
  [0.56, 0.0],
  [0.38, 0.38],
];

function tarif(t: Omit<DesenTarifi, 'uret'>, uret: (this: DesenTarifi, h: ParcacikHavuzu, x: number, y: number, o: DesenOrtami, n: number) => void): DesenTarifi {
  const d = t as DesenTarifi;
  d.uret = function (h, x, y, o) {
    const n = h.adet(this.parcacik);
    const once = h.sayi;
    uret.call(this, h, x, y, o, n);
    return h.sayi - once;
  };
  return d;
}

export const DESEN_TARIFLERI: readonly DesenTarifi[] = [
  tarif({ id: 'kasimpati', parcacik: 120, yayilma: 'Küre (eşit açılar)', hiz: 230, omur: 1250, iz: 'orta', yercekimi: 70, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    kure(h, this, x, y, o, n, this.hiz, 0.08);
  }),
  tarif({ id: 'palmiye', parcacik: 70, yayilma: '7 kalın kol', hiz: 250, omur: 1500, iz: 'uzun', yercekimi: 150, surtunme: 1.2, boy: 3.6 }, function (h, x, y, o, n) {
    const kol = 7;
    const don = o.rnd() * 0.4;
    for (let i = 0; i < n; i++) {
      const k = i % kol;
      const j = Math.floor(i / kol);
      const m = Math.max(1, Math.ceil(n / kol) - 1);
      const a = -Math.PI / 2 + don + (k * Math.PI * 2) / kol + (o.rnd() - 0.5) * 0.06;
      const v = this.hiz * (0.5 + 0.5 * (j / m));
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, j % 3 === 0 ? ALTIN : renkSec(o, k), { boy: this.boy * (0.7 + 0.5 * (j / m)) });
    }
  }),
  tarif({ id: 'sogut', parcacik: 90, yayilma: 'Küre, düşük hız, yüksek yerçekimi', hiz: 140, omur: 2200, iz: 'cokUzun', yercekimi: 210, surtunme: 1.1, boy: 2.2 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const z = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(1 - z * z);
      const a = i * ALTIN_ORAN;
      const v = this.hiz * (0.9 + o.rnd() * 0.2);
      p(h, this, o, x, y, Math.cos(a) * rr * v, Math.sin(a) * rr * v - 30, i % 3 === 0 ? renkSec(o, i) : ALTIN);
    }
  }),
  tarif({ id: 'halka', parcacik: 64, yayilma: 'Tek hızlı çember', hiz: 240, omur: 1100, iz: 'kisa', yercekimi: 50, surtunme: 1.6, boy: 2.8 }, function (h, x, y, o, n) {
    cember(h, this, x, y, o, n, this.hiz, o.renk, (o.rnd() - 0.5) * 1.2);
  }),
  tarif({ id: 'ciftHalka', parcacik: 96, yayilma: 'İki hızlı çember', hiz: 240, omur: 1100, iz: 'kisa', yercekimi: 50, surtunme: 1.6, boy: 2.6 }, function (h, x, y, o, n) {
    const egim = (o.rnd() - 0.5) * 1.2;
    const a = Math.round(n / 2);
    cember(h, this, x, y, o, a, this.hiz, o.renk, egim);
    cember(h, this, x, y, o, n - a, this.hiz * 0.6, o.renk2, egim, Math.PI / a);
  }),
  tarif({ id: 'kalp', parcacik: 80, yayilma: 'Kalp eğrisi örnekleme', hiz: 210, omur: 1250, iz: 'kisa', yercekimi: 25, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    egri(h, this, x, y, o, n, (u) => {
      const t = u * Math.PI * 2;
      const hx = 16 * Math.sin(t) ** 3;
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return [hx / 17, hy / 17];
    });
  }),
  tarif({ id: 'spiral', parcacik: 72, yayilma: 'Açıya zamanla ofset', hiz: 230, omur: 1350, iz: 'orta', yercekimi: 30, surtunme: 1.3, boy: 2.6 }, function (h, x, y, o, n) {
    const kol = 3;
    const m = Math.max(1, Math.ceil(n / kol) - 1);
    for (let i = 0; i < n; i++) {
      const k = i % kol;
      const j = Math.floor(i / kol);
      const a = (k * Math.PI * 2) / kol + j * 0.2;
      const v = this.hiz * (0.25 + 0.75 * (j / m));
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, k === 1 ? o.renk2 : renkSec(o, i), { acisal: 2.4 });
    }
  }),
  tarif({ id: 'yildiz', parcacik: 75, yayilma: '5 kollu çokgen', hiz: 230, omur: 1150, iz: 'kisa', yercekimi: 30, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    egri(h, this, x, y, o, n, (u) => cokgenOrnek(YILDIZ5, u), (o.rnd() - 0.5) * 0.5);
  }),
  tarif({ id: 'selale', parcacik: 110, yayilma: 'Yatay yay + yerçekimi', hiz: 210, omur: 2300, iz: 'cokUzun', yercekimi: 230, surtunme: 1.0, boy: 2.1 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1);
      const a = Math.PI + u * Math.PI;
      const v = this.hiz * (0.7 + 0.3 * o.rnd());
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v * 0.32, i % 4 === 0 ? renkSec(o, i) : i % 2 ? ALTIN : R.BEYAZ_SICAK);
    }
  }),
  tarif({ id: 'marti', parcacik: 60, yayilma: 'Martı çokgeni örnekleme', hiz: 240, omur: 1150, iz: 'kisa', yercekimi: 25, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const u = -1 + (2 * i) / Math.max(1, n - 1);
      const au = Math.abs(u);
      const yy = 0.18 - 0.62 * Math.sin(Math.PI * au) * (1 - 0.3 * au);
      p(h, this, o, x, y, u * this.hiz, yy * this.hiz, renkSec(o, i));
    }
  }),
  tarif({ id: 'lale', parcacik: 70, yayilma: 'Lale çokgeni', hiz: 215, omur: 1300, iz: 'kisa', yercekimi: 25, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    const sap = Math.round(n * 0.2);
    const tac = n - sap;
    // Üç sivri yapraklı çanak.
    egri(h, this, x, y, o, tac, (u) => cokgenOrnek(LALE, u));
    for (let i = 0; i < sap; i++) {
      const k = i / Math.max(1, sap - 1);
      const yaprak = i >= sap - 4;
      const vx = yaprak ? (i % 2 ? 1 : -1) * (0.28 + 0.06 * (i - sap + 4)) * this.hiz : 0;
      const vy = yaprak ? (0.95 + 0.04 * (i - sap + 4)) * this.hiz : (0.55 + 0.75 * k) * this.hiz;
      p(h, this, o, x, y, vx, vy, R.GOKKUSAGI + 3);
    }
  }),
  tarif({ id: 'karanfil', parcacik: 140, yayilma: 'Sık küre + titreşim', hiz: 220, omur: 1200, iz: 'kisa', yercekimi: 60, surtunme: 1.6, boy: 2.2 }, function (h, x, y, o, n) {
    kure(h, this, x, y, o, n, this.hiz, 0.3, { bayrak: B.TITRESIM | B.PIRILTI });
  }),
  tarif({ id: 'papatya', parcacik: 100, yayilma: '12 kol + merkez', hiz: 230, omur: 1200, iz: 'kisa', yercekimi: 40, surtunme: 1.5, boy: 2.5 }, function (h, x, y, o, n) {
    const merkez = Math.round(n * 0.16);
    const kol = n - merkez;
    const m = Math.max(1, Math.ceil(kol / 12) - 1);
    for (let i = 0; i < kol; i++) {
      const k = i % 12;
      const j = Math.floor(i / 12);
      const a = (k * Math.PI * 2) / 12;
      const v = this.hiz * (0.4 + 0.6 * (j / m));
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, renkSec(o, k));
    }
    for (let i = 0; i < merkez; i++) {
      const a = (i / merkez) * Math.PI * 2;
      const v = this.hiz * 0.16;
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, ALTIN, { boy: 3 });
    }
  }),
  tarif({ id: 'kuyrukluYildiz', parcacik: 30, yayilma: 'Tek parlak baş + iz', hiz: 260, omur: 1500, iz: 'uzun', yercekimi: 35, surtunme: 0.7, boy: 2.2 }, function (h, x, y, o, n) {
    const a = -Math.PI / 2 + (o.rnd() < 0.5 ? -1 : 1) * (0.5 + o.rnd() * 0.5);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    p(h, this, o, x, y, ca * this.hiz, sa * this.hiz, R.BEYAZ_SICAK, { boy: 6, iz: 0.34, bayrak: B.SABIT_BOY });
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const v = this.hiz * (0.92 - 0.6 * k);
      const s = (o.rnd() - 0.5) * 0.25;
      p(h, this, o, x, y, (ca + s * -sa) * v, (sa + s * ca) * v, renkSec(o, i), { gecikme: k * 260, boy: 2 });
    }
  }),
  tarif({ id: 'carkifelek', parcacik: 90, yayilma: 'Dönen 6 kol', hiz: 220, omur: 1400, iz: 'orta', yercekimi: 25, surtunme: 1.3, boy: 2.6 }, function (h, x, y, o, n) {
    const m = Math.max(1, Math.ceil(n / 6) - 1);
    for (let i = 0; i < n; i++) {
      const k = i % 6;
      const j = Math.floor(i / 6);
      const a = (k * Math.PI) / 3;
      const v = this.hiz * (0.22 + 0.78 * (j / m));
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, k % 2 ? o.renk2 : renkSec(o, i), { acisal: 3.2 });
    }
  }),
  tarif({ id: 'atesBocegi', parcacik: 50, yayilma: 'Yavaş, yanıp sönen', hiz: 70, omur: 2600, iz: 'yok', yercekimi: -6, surtunme: 0.6, boy: 3.2 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const a = o.rnd() * Math.PI * 2;
      const v = this.hiz * (0.3 + 0.7 * o.rnd());
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, i % 3 ? R.GOKKUSAGI + 2 : renkSec(o, i), { bayrak: B.YANIP | B.SABIT_BOY });
    }
  }),
  tarif({ id: 'gul', parcacik: 100, yayilma: 'İç içe 3 çember', hiz: 230, omur: 1200, iz: 'kisa', yercekimi: 40, surtunme: 1.5, boy: 2.5 }, function (h, x, y, o, n) {
    const a = Math.round(n * 0.4);
    const b = Math.round(n * 0.33);
    const egim = (o.rnd() - 0.5) * 0.6;
    cember(h, this, x, y, o, a, this.hiz, o.renk, egim);
    cember(h, this, x, y, o, b, this.hiz * 0.68, o.renk2, egim, 0.3);
    cember(h, this, x, y, o, n - a - b, this.hiz * 0.38, R.BEYAZ_SICAK, egim, 0.6);
  }),
  tarif({ id: 'yagmur', parcacik: 80, yayilma: 'Aşağı akan çizgiler', hiz: 160, omur: 1800, iz: 'uzun', yercekimi: 160, surtunme: 0.8, boy: 2 }, function (h, x, y, o, n) {
    const gen = 110 * o.olcek;
    for (let i = 0; i < n; i++) {
      const u = (i / Math.max(1, n - 1)) * 2 - 1;
      const px = x + u * gen * (0.7 + 0.3 * o.rnd());
      const py = y + Math.cos(u * 1.6) * -26 * o.olcek + (o.rnd() - 0.5) * 10;
      p(h, this, o, px, py, u * 18, this.hiz * (0.2 + 0.4 * o.rnd()), renkSec(o, i), { gecikme: Math.abs(u) * 140 });
    }
  }),
  tarif({ id: 'tac', parcacik: 70, yayilma: 'Yarım küre yukarı', hiz: 240, omur: 1350, iz: 'orta', yercekimi: 120, surtunme: 1.2, boy: 2.6 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const u = i / Math.max(1, n - 1);
      const a = Math.PI + u * Math.PI;
      const v = this.hiz * (i % 7 === 3 ? 1.12 : 0.88 + 0.12 * o.rnd());
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, i % 7 === 3 ? o.renk2 : renkSec(o, i));
    }
  }),
  tarif({ id: 'hilal', parcacik: 60, yayilma: 'Hilal çokgeni', hiz: 220, omur: 1200, iz: 'kisa', yercekimi: 25, surtunme: 1.5, boy: 2.6 }, function (h, x, y, o, n) {
    const dis = Math.round(n * 0.6);
    const ic = n - dis;
    for (let i = 0; i < dis; i++) {
      const a = Math.PI * 0.32 + (i / Math.max(1, dis - 1)) * Math.PI * 1.36;
      p(h, this, o, x, y, Math.cos(a) * this.hiz, Math.sin(a) * this.hiz, renkSec(o, i));
    }
    for (let i = 0; i < ic; i++) {
      const a = Math.PI * 0.5 + (i / Math.max(1, ic - 1)) * Math.PI;
      const ux = 0.38 + Math.cos(a) * 0.78;
      const uy = Math.sin(a) * 0.86;
      p(h, this, o, x, y, ux * this.hiz, uy * this.hiz, renkSec(o, i + 1));
    }
  }),
  tarif({ id: 'dalga', parcacik: 64, yayilma: 'Sinüs çizgisi', hiz: 230, omur: 1300, iz: 'orta', yercekimi: 20, surtunme: 1.4, boy: 2.6 }, function (h, x, y, o, n) {
    for (let i = 0; i < n; i++) {
      const u = -1 + (2 * i) / Math.max(1, n - 1);
      p(h, this, o, x, y, u * this.hiz, 0.3 * Math.sin(Math.PI * 2 * u) * this.hiz, renkSec(o, i));
    }
  }),
  tarif({ id: 'kelebek', parcacik: 90, yayilma: 'Kelebek eğrisi', hiz: 64, omur: 1300, iz: 'kisa', yercekimi: 25, surtunme: 1.5, boy: 2.5 }, function (h, x, y, o, n) {
    // Kelebek eğrisi (Fay, sadeleştirilmiş): r = e^{cos t} − 2·cos 4t.
    egri(h, this, x, y, o, n, (u) => {
      const t = u * Math.PI * 2;
      const r = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t);
      return [Math.sin(t) * r * 0.95, -Math.cos(t) * r * 0.8];
    });
  }),
  tarif({ id: 'fenerAlayi', parcacik: 100, yayilma: 'Sıralı küçük patlamalar (5×20)', hiz: 120, omur: 900, iz: 'kisa', yercekimi: 70, surtunme: 1.8, boy: 2.3 }, function (h, x, y, o, n) {
    const grup = 5;
    for (let i = 0; i < n; i++) {
      const g = i % grup;
      const j = Math.floor(i / grup);
      const m = Math.max(1, Math.ceil(n / grup));
      const cx = x + (g - 2) * 46 * o.olcek;
      const cy = y + Math.abs(g - 2) * 12 * o.olcek;
      const a = (j / m) * Math.PI * 2;
      p(h, this, o, cx, cy, Math.cos(a) * this.hiz, Math.sin(a) * this.hiz, g % 2 ? ALTIN : renkSec(o, g), { gecikme: g * 170 });
    }
  }),
  tarif({ id: 'saat', parcacik: 72, yayilma: 'Kadran + akrep çizgisi', hiz: 230, omur: 1300, iz: 'kisa', yercekimi: 20, surtunme: 1.5, boy: 2.5 }, function (h, x, y, o, n) {
    const akrep = Math.round(n / 6);
    const kadran = n - akrep;
    cember(h, this, x, y, o, kadran, this.hiz, o.renk, 0);
    const a = -Math.PI / 2 + Math.floor(o.rnd() * 12) * (Math.PI / 6);
    for (let i = 0; i < akrep; i++) {
      const v = this.hiz * (0.08 + 0.62 * (i / Math.max(1, akrep - 1)));
      p(h, this, o, x, y, Math.cos(a) * v, Math.sin(a) * v, o.renk2, { boy: 3 });
    }
  }),
];

const DIZIN = new Map<string, DesenTarifi>(DESEN_TARIFLERI.map((d) => [d.id, d]));

export function desenTarifi(id: string | undefined): DesenTarifi {
  return (id && DIZIN.get(id)) || DESEN_TARIFLERI[0];
}
