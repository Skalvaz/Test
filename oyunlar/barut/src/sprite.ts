/**
 * Sprite'lar: küçük bir boyama diliyle (çokgen, kutu, daire, çizgi) çizilir,
 * sonra `kenar()` siluetin çevresine 1 piksel mürekkep çeker. Elle piksel
 * dizmekten hızlı, tarz tutarlı: düz tonlu gövde + mürekkep kenar + ince iç
 * ayrıntı. Hepsi SAĞA bakar; pervane, namlu, çöp adam çizim anında eklenir.
 */
import { ATES, KAN, type Sprite } from './tuval';

/** Tonlar: tuvalin düz görünen 7 kademesi. */
const M = 0;
const T1 = 42;
const T2 = 85;
const T3 = 128;
const T4 = 170;
const T5 = 213;
const B = 254;

export class Boya {
  readonly d: Uint8Array;
  readonly v: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint8Array(w * h);
    this.v = new Uint8Array(w * h);
  }

  /** Nokta. */
  n(x: number, y: number, ton: number, renk = 0): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = ton + 1;
    this.v[y * this.w + x] = renk;
    return this;
  }

  /** Kutu. */
  k(x: number, y: number, w: number, h: number, ton: number, renk = 0): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.n(xx, yy, ton, renk);
    return this;
  }

  /** Çizgi. */
  c(x0: number, y0: number, x1: number, y1: number, ton: number): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let hata = dx + dy;
    for (let i = 0; i < 400; i++) {
      this.n(x0, y0, ton);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * hata;
      if (e2 >= dy) {
        hata += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        hata += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Dolu daire / elips. */
  o(cx: number, cy: number, r: number, ton: number, ry = r): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const ux = (x - cx) / r;
        const uy = (y - cy) / ry;
        if (ux * ux + uy * uy <= 1) this.n(x, y, ton);
      }
    }
    return this;
  }

  /** Dolu çokgen: [x0, y0, x1, y1, …]. */
  p(n: number[], ton: number): this {
    let y0 = 1e9;
    let y1 = -1e9;
    for (let i = 1; i < n.length; i += 2) {
      y0 = Math.min(y0, n[i]);
      y1 = Math.max(y1, n[i]);
    }
    const kes: number[] = [];
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      kes.length = 0;
      const sy = y + 0.001;
      for (let i = 0; i < n.length; i += 2) {
        const ax = n[i];
        const ay = n[i + 1];
        const bx = n[(i + 2) % n.length];
        const by = n[(i + 3) % n.length];
        if (ay <= sy === by <= sy) continue;
        kes.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      kes.sort((a, b) => a - b);
      for (let k = 0; k + 1 < kes.length; k += 2) {
        for (let x = Math.round(kes[k]); x <= Math.round(kes[k + 1]); x++) this.n(x, y, ton);
      }
    }
    return this;
  }

  /** Siluetin çevresine 1 piksel kenar çeker (boş olup dolu komşusu olan hücreler). */
  kenar(ton = M): this {
    const { w, h, d } = this;
    const isaret: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[y * w + x]) continue;
        if ((x > 0 && d[y * w + x - 1]) || (x < w - 1 && d[y * w + x + 1]) || (y > 0 && d[(y - 1) * w + x]) || (y < h - 1 && d[(y + 1) * w + x])) {
          isaret.push(y * w + x);
        }
      }
    }
    for (const i of isaret) d[i] = ton + 1;
    return this;
  }

  /** Tekerlek: mürekkep lastik, gri jant, ortada göbek. */
  teker(cx: number, cy: number, r: number): this {
    return this.o(cx, cy, r, M).o(cx, cy, r - 1.6, T3).o(cx, cy, 0.8, M);
  }

  bitir(): Sprite {
    return { w: this.w, h: this.h, d: this.d, v: this.v };
  }
}

/**
 * Modeller gerçek araçların siluetinden esinlenir (işaret ve ülke yok):
 * saldırı helikopteri (tandem kabinli, T129/A129 çizgisinde), nakliye-saldırı
 * helikopteri (çift balon kabinli, Mi-24 çizgisinde), ana muharebe tankı
 * (alçak yuvarlak kuleli, T-72 çizgisinde), paletli uçaksavar (ZSU-23-4
 * çizgisinde), 6×6 kamyon (Ural çizgisinde), delta kanatlı av uçağı (MiG-21
 * çizgisinde), dört motorlu nakliye uçağı (C-130 çizgisinde).
 * Her sprite'ın yanında bağlantı noktaları: `ox, oy` dönme merkezi.
 */

/** Oyuncunun saldırı helikopteri. */
export const HELI_N = { ox: 44, oy: 15, direk: [42, 0], kuyruk: [5, 7], namlu: [84, 27] } as const;
export const SPR_HELI = (() => {
  const b = new Boya(90, 32);
  b.p([5, 11, 40, 10, 40, 18, 22, 16, 5, 14], B); // kuyruk bomu
  b.p([2, 2, 8, 2, 14, 11, 6, 14, 2, 10], B); // geriye yatık dikme
  b.k(13, 13, 11, 2, B); // yatay denge
  b.p([36, 10, 52, 8, 58, 5, 67, 5, 71, 9, 77, 9, 83, 15, 86, 19, 82, 22, 44, 23, 36, 19], B); // gövde + kademeli kabin
  b.p([38, 6, 56, 6, 60, 9, 60, 14, 38, 14], T5); // motor kaportası
  b.k(40, 2, 5, 4, T2); // rotor göbeği
  b.o(85, 21, 2.4, T2); // burun nişangâhı
  b.p([48, 17, 61, 17, 59, 20, 48, 20], T2); // kanatçık
  b.k(46, 21, 15, 4, T2); // roket yuvası
  b.k(72, 23, 6, 3, T2); // çene topu
  b.o(63, 28, 2.4, T1); // ana teker
  b.o(8, 21, 1.8, T1); // kuyruk tekeri
  b.kenar();
  b.c(78, 25, 84, 27, M); // namlu
  b.c(61, 24, 63, 26, M).c(9, 15, 8, 19, M); // dikmeler
  // Tandem kabin: arkada pilot (yüksek), önde nişancı; düz cam paneller
  b.p([59, 6, 66, 6, 69, 9, 60, 9], T4);
  b.p([70, 10, 76, 10, 81, 15, 71, 15], T4);
  b.c(59, 6, 66, 6, M).c(66, 6, 69, 9, M).c(60, 9, 69, 9, M).c(59, 6, 60, 9, M).c(63, 6, 64, 9, M);
  b.c(70, 10, 76, 10, M).c(76, 10, 81, 15, M).c(71, 15, 81, 15, M).c(70, 10, 71, 15, M).c(73, 10, 75, 15, M);
  b.n(61, 7, B).n(72, 11, B).n(73, 12, B);
  // Motor: egzoz, hava girişi, kaporta çizgileri
  b.k(37, 8, 3, 4, T2).o(59, 10, 2, M).o(59, 10, 1, T3);
  b.c(42, 8, 54, 8, T4).c(42, 12, 56, 12, T4).n(46, 10, T3).n(52, 10, T3);
  b.c(66, 11, 66, 21, T5).c(46, 15, 46, 22, T5).c(38, 19, 80, 19, T5);
  b.k(16, 12, 2, 4, M).k(20, 12, 1, 4, M); // kuyruk şeritleri
  b.o(30, 14, 2.6, M).o(30, 14, 1.1, B); // halka amblem
  b.c(47, 23, 59, 23, T1).n(61, 22, B).n(61, 24, B); // roket tüpleri
  b.k(4, 6, 2, 2, T2);
  b.n(34, 12, T4).n(26, 13, T4).n(78, 20, T4).n(56, 21, T4);
  return b.bitir();
})();

/** Düşmanın nakliye-saldırı helikopteri. */
export const DHELI_N = { ox: 44, oy: 14, direk: [41, 0], kuyruk: [4, 5], namlu: [89, 25] } as const;
export const SPR_DHELI = (() => {
  const b = new Boya(92, 31);
  b.p([3, 10, 34, 11, 34, 18, 18, 16, 3, 13], T2);
  b.p([0, 1, 6, 1, 12, 10, 4, 13, 0, 9], T2);
  b.k(10, 12, 10, 2, T2);
  b.p([30, 8, 52, 6, 62, 7, 68, 10, 76, 12, 86, 17, 87, 20, 80, 23, 36, 24, 30, 19], T2); // gövde
  b.p([35, 3, 54, 3, 60, 7, 33, 8], T1); // motor kamburu
  b.k(39, 0, 5, 3, T1);
  b.p([44, 17, 58, 17, 56, 22, 46, 25], T1); // aşağı eğik kanat
  b.k(42, 24, 13, 3, T1); // roket yuvası
  b.o(49, 28, 2.2, T1).o(73, 28, 2, T1);
  b.k(82, 22, 4, 3, T1);
  b.kenar();
  // Çift balon kabin
  b.o(69, 9, 4.2, M).o(69, 9, 3.2, T4).o(78, 13, 4.2, M).o(78, 13, 3.2, T4);
  b.n(68, 7, B).n(77, 11, B).n(67, 8, B);
  b.k(45, 11, 3, 3, T4).k(50, 11, 3, 3, T4).k(55, 11, 3, 3, T4); // kabin pencereleri
  b.c(44, 10, 58, 10, T1).c(44, 15, 58, 15, T1);
  b.o(58, 5, 1.6, M).o(54, 5, 1.6, M); // hava girişleri
  b.k(34, 5, 3, 2, M); // egzoz
  b.o(38, 16, 3, T1, 2).o(64, 19, 4, T1, 2).o(24, 13, 3, T1, 1.5); // kamuflaj
  b.c(85, 24, 89, 25, M);
  b.c(49, 25, 49, 26, M).c(73, 24, 73, 26, M);
  b.k(8, 11, 2, 3, B);
  b.c(45, 25, 54, 25, M).n(55, 24, B).n(55, 26, B);
  return b.bitir();
})();

/** Tank gövdesi. `kule`: kulenin oturduğu yer (alt orta). */
export const TANK_N = { ox: 40, oy: 12, kule: [45, 7] } as const;
export const SPR_TANK = (() => {
  const b = new Boya(80, 23);
  b.p([3, 12, 75, 12, 78, 16, 74, 21, 7, 21, 1, 17], T1); // palet zarfı
  b.p([6, 6, 54, 6, 73, 10, 76, 12, 4, 12, 4, 8], T2); // alçak gövde, eğimli ön zırh
  b.o(7, 5, 3.2, T2); // arkada yakıt varili
  b.kenar();
  for (let i = 0; i < 6; i++) b.teker(13 + i * 10.4, 17, 4.4);
  b.o(73, 15, 2.6, M).o(73, 15, 1.2, T3);
  b.o(5, 16, 2.6, M).o(5, 16, 1.2, T3);
  // Yan etek plakaları: tekerlerin üstünü örter
  b.k(8, 11, 64, 3, T2).c(8, 11, 71, 11, M).c(8, 14, 71, 14, M);
  for (let x = 18; x < 70; x += 10) b.c(x, 11, x, 14, M);
  b.k(70, 11, 4, 4, T1); // ön çamurluk lastiği
  b.c(56, 7, 71, 10, T3); // sıçratma levhası
  b.k(64, 7, 2, 2, B).n(76, 13, M); // far, çeki kancası
  b.k(1, 10, 4, 2, T1).n(6, 4, T4).n(8, 6, T1); // kütük, varil
  b.k(50, 6, 5, 1, M).n(30, 9, T3).n(20, 9, T3).n(40, 9, T3);
  return b.bitir();
})();

/** Tank kulesi: alçak, yuvarlak. Alt orta (19, 13); namlu çıkışı (36, 8). */
export const KULE_N = { ox: 19, oy: 13, namlu: [36, 8] } as const;
export const SPR_KULE = (() => {
  const b = new Boya(42, 14);
  b.p([3, 12, 1, 9, 4, 5, 12, 3, 25, 3, 33, 6, 36, 10, 34, 12], T2);
  b.k(12, 1, 7, 2, T2); // komutan kulesi
  b.k(0, 6, 4, 5, T1); // arka sandık
  b.kenar();
  b.k(33, 7, 4, 4, T1); // namlu kalkanı
  b.o(29, 6, 1.8, M).o(29, 6, 0.9, B); // projektör
  b.c(20, 8, 22, 5, M).c(23, 8, 25, 5, M).c(26, 9, 28, 6, M); // sis havanları
  b.c(13, 0, 22, 0, M).n(13, 1, M); // kule makinelisi
  b.c(7, 6, 10, 5, T3).n(16, 8, T3).n(18, 10, T3).c(6, 10, 30, 10, T3);
  // Kule numarası (beyaz boya): 27
  b.c(8, 5, 10, 5, B).n(10, 6, B).c(8, 7, 10, 7, B).n(8, 8, B).c(8, 9, 10, 9, B);
  b.c(12, 5, 14, 5, B).n(14, 6, B).n(13, 7, B).n(13, 8, B).n(13, 9, B);
  return b.bitir();
})();

/** Paletli uçaksavar gövdesi. */
export const UCAKSAVAR_N = { ox: 38, oy: 10, kule: [34, 6] } as const;
export const SPR_UCAKSAVAR = (() => {
  const b = new Boya(76, 20);
  b.p([3, 10, 71, 10, 74, 14, 70, 18, 7, 18, 1, 15], T1);
  b.p([5, 5, 58, 5, 70, 8, 72, 10, 4, 10], T2);
  b.kenar();
  for (let i = 0; i < 6; i++) b.teker(12 + i * 10.4, 14, 3.8);
  b.o(70, 13, 2.2, M).o(70, 13, 1, T3);
  b.o(5, 13, 2.2, M).o(5, 13, 1, T3);
  b.c(6, 9, 70, 9, T3);
  b.k(62, 6, 2, 2, B);
  for (let x = 8; x < 22; x += 3) b.c(x, 6, x, 8, T1); // motor ızgarası
  b.n(40, 7, T3).n(50, 7, T3);
  return b.bitir();
})();

/** Uçaksavar kulesi: büyük, köşeli. Alt orta (20, 15); namlu mili (29, 8); radar direği (8, 2). */
export const UKULE_N = { ox: 20, oy: 15, namlu: [29, 8], radar: [8, 2] } as const;
export const SPR_UKULE = (() => {
  const b = new Boya(40, 16);
  b.p([3, 14, 3, 6, 8, 3, 30, 3, 36, 7, 36, 14], T2);
  b.kenar();
  b.c(8, 8, 26, 8, T3);
  b.k(12, 10, 6, 4, T1).c(12, 10, 17, 10, M); // kapak
  b.k(26, 5, 7, 6, T1).c(26, 5, 32, 5, M); // namlu yuvası
  b.n(33, 12, T3).n(6, 12, T3);
  return b.bitir();
})();

/** 6×6 asker kamyonu: branda solda, kabin ve uzun kaput sağda. */
export const KAMYON_N = { ox: 40, oy: 16 } as const;
export const SPR_KAMYON = (() => {
  const b = new Boya(80, 31);
  b.p([3, 6, 8, 3, 38, 3, 43, 6, 43, 21, 3, 21], T3); // branda
  b.p([45, 7, 57, 7, 59, 14, 59, 23, 45, 23], T2); // kabin
  b.p([59, 14, 72, 14, 76, 17, 76, 23, 59, 23], T2); // kaput
  b.k(3, 21, 72, 3, T1); // şasi
  b.k(47, 24, 9, 3, T1); // yakıt deposu
  b.k(75, 23, 4, 2, T1); // tampon
  b.kenar();
  for (const x of [9, 16, 23, 30, 37]) b.c(x, 4, x, 16, T4);
  b.c(4, 10, 42, 10, T2);
  b.k(3, 17, 41, 4, T2).c(3, 17, 43, 17, M); // ahşap kasa
  for (let x = 8; x < 42; x += 7) b.c(x, 18, x, 20, T1);
  b.p([53, 9, 56, 9, 58, 14, 53, 14], T4).k(47, 9, 5, 5, T4); // ön cam, kapı camı
  b.c(52, 8, 52, 22, M).n(48, 10, B).n(54, 10, B).c(46, 16, 51, 16, T1).n(50, 18, M);
  b.c(74, 18, 74, 22, M).c(72, 18, 72, 22, T1).c(70, 18, 70, 22, T1); // ızgara
  b.k(73, 16, 2, 2, B); // far
  b.c(60, 15, 71, 15, T3);
  b.teker(13, 26, 4.5).teker(25, 26, 4.5).teker(66, 26, 4.5);
  b.c(7, 21, 31, 21, M).c(60, 21, 72, 21, M);
  return b.bitir();
})();

/** Delta kanatlı av uçağı. */
export const JET_N = { ox: 46, oy: 11, lule: [2, 11] } as const;
export const SPR_JET = (() => {
  const b = new Boya(92, 22);
  b.p([5, 8, 62, 7, 76, 9, 84, 11, 76, 13, 62, 14, 5, 14], T2); // ince gövde
  b.p([28, 7, 58, 7, 62, 5, 44, 4], T2); // sırt
  b.p([4, 8, 9, 0, 17, 0, 28, 8], T2); // dikey kuyruk
  b.p([26, 12, 52, 12, 36, 20, 25, 20], T1); // delta kanat
  b.p([4, 11, 14, 11, 8, 17, 2, 17], T1); // yatay kuyruk
  b.p([10, 14, 22, 14, 15, 18], T1); // karın yüzgeci
  b.kenar();
  b.p([58, 7, 63, 4, 69, 5, 73, 8], T4);
  b.c(58, 7, 63, 4, M).c(63, 4, 69, 5, M).c(69, 5, 73, 8, M).c(65, 4, 66, 8, M).n(62, 6, B);
  b.c(77, 9, 77, 13, M).p([78, 10, 86, 11, 78, 12], M).c(86, 11, 90, 10, M); // giriş konisi, pitot
  b.k(2, 9, 3, 5, T1).c(2, 9, 2, 13, M); // lüle
  b.c(10, 11, 56, 11, T1).c(30, 9, 30, 13, T1).c(48, 9, 48, 13, T1);
  b.k(11, 3, 3, 3, B);
  b.c(28, 19, 42, 19, M).n(43, 19, B).c(28, 18, 28, 20, M); // kanat altı füze
  return b.bitir();
})();

/** Dört motorlu dost nakliye uçağı. `pervane`: görünen iki motorun pervane yeri. */
export const NAKLIYE_N = { ox: 52, oy: 15, pervane: [[60, 12], [70, 12]] } as const;
export const SPR_NAKLIYE = (() => {
  const b = new Boya(104, 30);
  b.p([12, 11, 76, 9, 90, 10, 99, 15, 96, 19, 88, 21, 32, 21, 8, 14], B); // gövde, arkası kalkık
  b.p([4, 0, 13, 0, 24, 10, 10, 12, 4, 8], B); // yüksek dikey kuyruk
  b.k(2, 10, 14, 2, B);
  b.p([42, 6, 66, 6, 64, 9, 44, 9], T5); // üst kanat
  b.k(50, 10, 9, 5, T2).k(61, 10, 8, 4, T2); // motorlar
  b.o(54, 22, 8, B, 2.6); // iniş takımı kaportası
  b.kenar();
  b.o(99, 16, 1.6, T1); // radom
  b.k(85, 11, 3, 2, T4).k(89, 12, 3, 2, T4).k(93, 13, 2, 2, T4); // kokpit camları
  for (let x = 24; x < 48; x += 6) b.k(x, 13, 2, 2, T4);
  for (let x = 72; x < 84; x += 5) b.k(x, 13, 2, 2, T4);
  b.c(14, 16, 96, 16, T5).c(14, 14, 30, 20, T4);
  b.o(51, 24, 2, M).o(57, 24, 2, M);
  b.o(60, 12, 1.2, M).o(70, 12, 1.2, M);
  b.k(8, 3, 3, 3, M).n(9, 4, B);
  b.k(66, 12, 3, 6, T5).c(66, 12, 66, 17, T3); // yan kapı
  return b.bitir();
})();

/** Tamir sandığı (paraşütle gelir). */
export const SPR_SANDIK = (() => {
  const b = new Boya(17, 15);
  b.k(1, 1, 15, 13, B).kenar();
  b.c(1, 5, 15, 5, T4).c(1, 10, 15, 10, T4);
  b.k(7, 3, 3, 9, M, KAN).k(4, 6, 9, 3, M, KAN);
  return b.bitir();
})();

/** Tank engeli (çapraz çelik kirişler). Alt orta (9, 13). */
export const SPR_KIRPI = (() => {
  const b = new Boya(19, 14);
  b.c(1, 1, 16, 12, T4).c(2, 1, 17, 12, T4);
  b.c(17, 1, 2, 12, T4).c(16, 1, 1, 12, T4);
  b.k(8, 0, 2, 13, T4);
  b.kenar(T2);
  b.c(9, 1, 9, 11, B);
  return b.bitir();
})();

/** Kuru ağaç. Alt orta (17, 37). */
export const SPR_AGAC = (() => {
  const b = new Boya(36, 38);
  let tohum = 7;
  const r = (): number => {
    tohum = (tohum * 16807) % 2147483647;
    return tohum / 2147483647;
  };
  const dal = (x: number, y: number, aci: number, uz: number, d: number): void => {
    const x1 = x + Math.cos(aci) * uz;
    const y1 = y + Math.sin(aci) * uz;
    b.c(x, y, x1, y1, T2);
    if (d > 2) b.c(x + 1, y, x1 + 1, y1, T2);
    if (d > 3) b.c(x - 1, y, x1 - 1, y1, T2);
    if (d <= 0) return;
    dal(x1, y1, aci - 0.3 - r() * 0.45, uz * 0.74, d - 1);
    dal(x1, y1, aci + 0.28 + r() * 0.45, uz * 0.7, d - 1);
    if (d > 2 && r() < 0.5) dal(x1, y1, aci + (r() - 0.5) * 0.3, uz * 0.6, d - 2);
  };
  dal(17, 37, -Math.PI / 2 + 0.06, 11, 4);
  b.k(15, 35, 6, 3, T2); // kök
  return b.bitir();
})();

/** Toprağın altındaki mayın. Merkez (7, 7). */
export const SPR_MAYIN = (() => {
  const b = new Boya(15, 15);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.c(7 + Math.cos(a) * 4, 7 + Math.sin(a) * 4, 7 + Math.cos(a) * 7, 7 + Math.sin(a) * 7, T5);
  }
  b.o(7, 7, 4.4, B).o(7, 7, 3, T4).o(7, 7, 1.5, M);
  b.n(7, 7, M, KAN).n(5, 5, B);
  return b.bitir();
})();

/** Toprağın altındaki sandık. Merkez (8, 7). */
export const SPR_GOMU = (() => {
  const b = new Boya(17, 14);
  b.k(0, 0, 17, 14, T5).k(1, 1, 15, 12, T1);
  b.c(0, 4, 16, 4, T5).c(0, 9, 16, 9, T5);
  b.k(6, 2, 5, 1, B).k(10, 3, 1, 3, B).k(8, 5, 2, 2, B).k(8, 8, 1, 1, B).k(8, 10, 1, 2, B);
  return b.bitir();
})();

/** Baştan fırlayan miğfer. */
export const SPR_KASK = (() => {
  const b = new Boya(9, 6);
  b.o(4, 4, 3.4, M, 3.2);
  b.k(0, 4, 9, 2, M);
  b.d.fill(0, 5 * 9, 6 * 9);
  b.n(3, 2, T3).n(4, 2, T3);
  return b.bitir();
})();

export const SPR_SIMGE_HELI = (() => {
  const b = new Boya(21, 11);
  b.c(1, 0, 19, 0, M).k(10, 1, 1, 2, M);
  b.p([5, 3, 15, 3, 19, 6, 16, 8, 6, 8, 3, 6], M);
  b.k(0, 4, 6, 2, M).k(0, 2, 2, 3, M);
  b.c(6, 10, 16, 10, M).n(8, 9, M).n(14, 9, M);
  b.k(13, 4, 3, 2, B);
  return b.bitir();
})();

export const SPR_SIMGE_SIPER = (() => {
  const b = new Boya(21, 11);
  b.k(2, 0, 1, 11, M);
  b.k(3, 0, 8, 5, M).k(5, 2, 3, 1, B);
  b.o(10, 9, 4, M, 2).o(17, 9, 4, M, 2).o(13, 6, 4, M, 2);
  return b.bitir();
})();

// ---- Sokak döküntüsü (savaş alanındaki sabit süsler; hepsinin alt ortası yere oturur) ----

// Okunabilirlik kuralı: mürekkep siyahı yalnız hareketli birliklerindir. Dekor
// gri tonlarla ve koyu gri kenarla çizilir, yoksa askerler arada kaybolur.

/**
 * Yanmış otomobil: camları boşalmış, lastikleri erimiş, kaputu kalkmış sedan.
 * Alt orta (27, 21) yere oturur; iki jant aynı hizada, gövde düz durur.
 */
export const SPR_ARABA = (() => {
  const b = new Boya(54, 22);
  // Gövde: bagaj, kabin, kaput, tamponlar. Büyük, sade biçimler: yamaçta
  // döndürülünce de okunur (ince ayrıntı döndürmede karıncalanıyordu).
  b.p([3, 11, 8, 10, 15, 9, 21, 3, 35, 3, 41, 9, 49, 10, 51, 12, 51, 17, 3, 17], T3);
  b.p([42, 9, 48, 4, 50, 5, 45, 10], T3); // kalkık kaput
  b.k(1, 13, 3, 3, T3).k(50, 14, 3, 2, T3); // tamponlar
  b.o(13, 18, 3.3, T4).o(40, 18, 3.3, T4); // çıplak jantlar
  b.kenar(T1);
  // Camlar: yanmış, karanlık kabin; ortada direk
  b.p([22, 5, 27, 5, 27, 9, 18, 9], T1).p([30, 5, 34, 5, 38, 9, 30, 9], T1);
  // Üst yüzeylerde ışık: tavan, bagaj, kaput
  b.c(22, 4, 34, 4, T5).c(5, 11, 14, 10, T5).c(42, 10, 48, 11, T5);
  // Gövde alt yarısı gölgede
  b.k(4, 15, 46, 2, T2);
  // Çamurluk boşlukları ve jantlar
  for (const cx of [13, 40]) {
    b.o(cx, 18, 5, T1).o(cx, 18, 3, T4).o(cx, 18, 1, T1);
  }
  b.c(28, 11, 28, 16, T1); // kapı derzi
  b.c(22, 12, 24, 12, T1).c(31, 12, 33, 12, T1); // kollar
  b.k(31, 13, 4, 2, T4).k(7, 12, 3, 2, T4); // dökülmüş boya
  b.n(51, 12, B); // far yuvası
  return b.bitir();
})();

/** Eğilmiş sokak lambası. */
export const SPR_LAMBA = (() => {
  const b = new Boya(22, 62);
  b.c(6, 61, 8, 30, T4).c(7, 61, 9, 30, T4);
  b.c(8, 30, 12, 8, T4).c(9, 30, 13, 8, T4);
  b.c(12, 8, 19, 5, T4).c(12, 7, 19, 4, T4);
  b.k(16, 5, 5, 3, T4);
  b.k(4, 57, 7, 5, T4);
  b.kenar(T2);
  b.n(18, 8, B).n(17, 8, T4); // kırık cam
  return b.bitir();
})();

/** Beton bariyer. */
export const SPR_BARIYER = (() => {
  const b = new Boya(26, 14);
  b.p([7, 1, 18, 1, 20, 8, 24, 12, 1, 12, 5, 8], T4);
  b.kenar(T2);
  b.c(6, 9, 19, 9, T3).c(8, 3, 17, 3, T5).n(12, 6, T3).n(15, 10, T3);
  b.c(3, 12, 6, 7, T3); // çatlak
  return b.bitir();
})();

/** Yol levhası (direği eğik, kurşun delikli). */
export const SPR_LEVHA = (() => {
  const b = new Boya(18, 34);
  b.c(8, 33, 10, 12, T4).c(9, 33, 11, 12, T4);
  b.p([4, 1, 15, 2, 14, 12, 3, 11], B);
  b.kenar(T2);
  b.c(6, 4, 12, 5, T2).c(6, 7, 11, 8, T2); // yazı çizgileri
  b.n(13, 9, T2).n(5, 9, T2).n(9, 3, T2); // kurşun delikleri
  return b.bitir();
})();

/** Varil. */
export const SPR_VARIL = (() => {
  const b = new Boya(11, 15);
  b.k(1, 1, 9, 13, T4);
  b.kenar(T2);
  b.c(1, 4, 9, 4, T2).c(1, 10, 9, 10, T2).c(2, 2, 2, 12, T4).n(7, 7, T2);
  return b.bitir();
})();

/** Yıkık duvar parçası: pencere boşluklu, üstü kırık. */
export const SPR_DUVAR = (() => {
  const b = new Boya(40, 50);
  b.p([2, 49, 2, 14, 7, 12, 9, 6, 15, 7, 17, 2, 24, 3, 26, 10, 33, 12, 34, 22, 38, 24, 38, 49], T4);
  b.kenar(T2);
  // Pencere boşluğu: arkası görünür
  for (let y = 20; y < 33; y++) for (let x = 12; x < 22; x++) b.d[y * 40 + x] = 0;
  b.c(11, 19, 22, 19, T2).c(11, 33, 22, 33, T2).c(11, 19, 11, 33, T2).c(22, 19, 22, 33, T2);
  b.c(10, 34, 23, 34, T2); // denizlik
  // Tuğla sıraları ve çatlak
  for (let y = 16; y < 48; y += 5) for (let x = 4 + ((y / 5) % 2) * 3; x < 36; x += 7) if (b.d[y * 40 + Math.round(x)] === T4 + 1) b.c(x, y, x + 3, y, T3);
  b.c(28, 14, 30, 22, T2).c(30, 22, 27, 30, T2);
  b.c(17, 2, 15, -1, T2).c(24, 3, 27, 0, T2); // demirler
  b.k(2, 44, 36, 1, T2);
  return b.bitir();
})();

void ATES;
