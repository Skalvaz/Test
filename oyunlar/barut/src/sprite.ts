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

/** Oyuncunun helikopteri. Dönme merkezi (36, 14), direk ucu (33, 0), namlu ucu (63, 24). */
export const SPR_HELI = (() => {
  const b = new Boya(74, 29);
  b.p([2, 10, 31, 10, 31, 18, 17, 16, 2, 13], B); // kuyruk bomu
  b.p([1, 3, 6, 3, 11, 11, 2, 13], B); // dikey kuyruk
  b.k(9, 13, 9, 2, B); // yatay denge
  b.p([25, 9, 47, 7, 59, 9, 67, 13, 70, 17, 65, 21, 31, 22, 25, 18], B); // gövde
  b.p([28, 5, 46, 4, 50, 8, 26, 9], T5); // motor kaputu
  b.k(32, 1, 3, 4, T2); // direk
  b.o(69, 19, 2, T2); // burun algılayıcısı
  b.k(34, 19, 11, 2, T2); // kanatçık
  b.k(32, 22, 15, 4, T2); // roket yuvası
  b.k(52, 22, 6, 3, T2); // top yuvası
  b.kenar();
  b.c(58, 24, 63, 24, M); // namlu
  b.c(36, 24, 34, 27, M).c(50, 24, 52, 27, M); // kızak ayakları
  b.c(29, 28, 57, 28, M).n(58, 27, M); // kızak
  // Kabin camı
  b.p([48, 9, 58, 9, 66, 14, 50, 14], T4);
  b.c(48, 9, 58, 9, M).c(58, 9, 66, 14, M).c(50, 14, 66, 14, M).c(48, 9, 50, 14, M).c(54, 9, 56, 14, M);
  b.c(51, 10, 53, 10, B).n(60, 11, B).n(61, 12, B);
  // Panel çizgileri, kapı
  b.c(41, 9, 41, 21, T5).c(30, 14, 46, 14, T5).c(44, 15, 44, 20, T4).c(44, 15, 48, 15, T4);
  b.k(27, 6, 3, 2, T2); // egzoz
  b.k(45, 5, 2, 2, M); // hava girişi
  b.c(30, 6, 43, 6, T4); // kaput çizgisi
  b.k(13, 11, 2, 4, M).k(17, 12, 1, 3, M); // kuyruk şeritleri
  b.o(35, 17, 3, M).o(35, 17, 1.3, B); // amblem
  b.c(33, 24, 45, 24, T1).n(47, 23, B).n(47, 25, B); // roket tüpleri
  b.n(29, 19, T4).n(61, 19, T4).n(23, 13, T4).n(20, 13, T4); // perçinler
  b.k(3, 5, 2, 2, T2); // kuyruk pervanesi göbeği
  return b.bitir();
})();

/** Düşman helikopteri: koyu, hantal. Dönme merkezi (33, 12), direk ucu (31, 0). */
export const SPR_DHELI = (() => {
  const b = new Boya(68, 25);
  b.p([2, 9, 28, 10, 28, 16, 14, 14, 2, 12], T2);
  b.p([1, 2, 7, 2, 11, 10, 2, 12], T2);
  b.p([22, 7, 46, 5, 58, 8, 64, 13, 64, 18, 56, 21, 28, 21, 22, 16], T2);
  b.p([26, 3, 44, 2, 48, 6, 24, 7], T1);
  b.k(30, 0, 3, 3, T1);
  b.k(30, 19, 13, 3, T1);
  b.kenar();
  b.p([46, 8, 55, 8, 61, 13, 48, 13], T4).c(51, 8, 53, 13, M).c(46, 8, 55, 8, M).c(48, 13, 61, 13, M);
  b.n(49, 9, B).n(50, 9, B);
  b.k(36, 10, 5, 4, T4).k(29, 10, 5, 4, T4);
  b.c(36, 10, 40, 10, M).c(29, 10, 33, 10, M);
  b.c(24, 17, 62, 17, T1); // gövde çizgisi
  b.k(8, 10, 3, 3, B).k(13, 11, 2, 2, B); // kuyruk işareti
  b.c(60, 20, 66, 21, M); // top
  b.c(33, 22, 31, 24, M).c(48, 22, 50, 24, M).c(26, 24, 55, 24, M);
  b.k(25, 4, 3, 2, M); // egzoz
  b.n(27, 12, T3).n(44, 18, T3).n(58, 16, T3);
  return b.bitir();
})();

/** Tank gövdesi. Alt orta (36, 20). */
export const SPR_TANK = (() => {
  const b = new Boya(72, 21);
  b.p([4, 10, 66, 10, 70, 14, 67, 19, 6, 19, 1, 15], T1); // palet takımı
  b.p([8, 3, 52, 3, 66, 7, 68, 10, 4, 10, 4, 6], T2); // üst gövde
  b.kenar();
  for (let i = 0; i < 6; i++) b.teker(11 + i * 10, 15, 4);
  b.o(66, 13, 2.6, M).o(66, 13, 1.2, T3); // tahrik dişlisi
  b.o(5, 14, 2.6, M).o(5, 14, 1.2, T3); // gergi tekerleği
  b.c(4, 10, 67, 10, M); // çamurluk altı
  b.c(5, 9, 66, 9, T3); // çamurluk
  b.c(52, 4, 65, 8, T3); // ön eğim
  b.k(40, 4, 7, 1, M).n(43, 5, M); // kapak
  b.k(61, 6, 2, 2, B); // far
  b.k(5, 4, 4, 3, T1).n(4, 3, M); // egzoz
  b.k(14, 5, 9, 2, T1).n(16, 5, M).n(19, 5, M).n(22, 5, M); // yedek palet
  b.c(26, 6, 36, 6, T3); // kürek sapı
  b.n(48, 7, T3).n(30, 8, T3).n(10, 8, T3);
  return b.bitir();
})();

/** Tank kulesi. Alt orta (16, 11). Namlu çizim anında eklenir. */
export const SPR_KULE = (() => {
  const b = new Boya(34, 12);
  b.p([4, 2, 24, 2, 31, 5, 31, 9, 26, 10, 4, 10, 1, 8, 1, 5], T2);
  b.k(13, 0, 7, 2, T2); // komutan kulesi
  b.kenar();
  b.k(28, 5, 4, 4, T1); // namlu kalkanı
  b.c(6, 4, 22, 4, T3);
  b.k(4, 6, 6, 3, T1).c(4, 7, 9, 7, M); // eşya sandığı
  b.n(16, 1, M).n(24, 7, T3).n(20, 7, T3);
  return b.bitir();
})();

/** Uçaksavar kamyonu: kasa solda, kabin sağda. Alt orta (32, 20). Silah çizimde eklenir, kasadaki yeri (20, 8). */
export const SPR_UCAKSAVAR = (() => {
  const b = new Boya(64, 21);
  b.k(2, 9, 40, 4, T2); // kasa
  b.p([42, 3, 54, 3, 60, 8, 62, 13, 42, 13], T2); // kabin
  b.k(4, 13, 56, 2, T1); // şasi
  b.k(5, 6, 6, 3, T1).k(30, 6, 7, 3, T1); // cephane sandıkları
  b.kenar();
  b.teker(12, 16, 4).teker(22, 16, 4).teker(52, 16, 4);
  b.p([46, 5, 53, 5, 57, 9, 46, 9], T4).c(46, 5, 53, 5, M).c(46, 9, 57, 9, M).n(48, 6, B);
  b.c(44, 4, 44, 12, M); // kapı
  b.k(61, 12, 2, 2, M); // tampon
  b.n(60, 10, B); // far
  b.c(3, 11, 40, 11, T1); // kasa çıtası
  for (let x = 6; x < 40; x += 6) b.n(x, 10, T3);
  return b.bitir();
})();

/** Asker kamyonu: branda solda, kabin sağda. Alt orta (33, 26). */
export const SPR_KAMYON = (() => {
  const b = new Boya(66, 27);
  b.p([2, 5, 6, 3, 36, 3, 40, 5, 40, 18, 2, 18], T3); // branda
  b.p([43, 8, 55, 8, 61, 13, 64, 18, 43, 18], T2); // kabin ve kaput
  b.k(2, 18, 62, 3, T1); // şasi
  b.kenar();
  for (const x of [8, 15, 22, 29, 36]) b.c(x, 4, x, 17, T4); // branda kaburgaları
  b.c(3, 10, 39, 10, T2); // ip
  b.k(2, 6, 2, 12, T2); // arka perde
  b.n(5, 12, M).n(11, 10, M).n(18, 10, M).n(25, 10, M).n(32, 10, M); // ip düğümleri
  b.p([46, 10, 54, 10, 58, 14, 46, 14], T4).c(46, 10, 54, 10, M).c(46, 14, 58, 14, M).n(48, 11, B).n(49, 11, B);
  b.c(45, 9, 45, 18, M).n(47, 16, M); // kapı
  b.c(62, 15, 62, 18, M).n(61, 14, B); // ızgara, far
  b.k(63, 19, 2, 2, M); // tampon
  b.teker(12, 22, 4).teker(22, 22, 4).teker(54, 22, 4);
  b.c(6, 19, 28, 19, M).c(48, 19, 60, 19, M); // çamurluk
  return b.bitir();
})();

/** Jet. Dönme merkezi (38, 10). */
export const SPR_JET = (() => {
  const b = new Boya(76, 20);
  b.p([4, 8, 30, 7, 52, 7, 66, 9, 74, 11, 66, 13, 30, 14, 6, 13], T2);
  b.p([2, 1, 8, 1, 14, 8, 5, 9], T2);
  b.p([24, 13, 44, 13, 30, 19, 20, 19], T1);
  b.p([4, 12, 12, 12, 7, 16, 2, 16], T1);
  b.kenar();
  b.p([50, 7, 58, 7, 64, 9, 50, 9], T4).c(54, 7, 55, 9, M).c(50, 7, 58, 7, M).n(52, 8, B);
  b.k(40, 10, 6, 3, M); // hava girişi
  b.c(10, 10, 38, 10, T1).c(48, 11, 68, 11, T1);
  b.k(2, 9, 2, 4, T1); // lüle
  b.c(22, 18, 36, 18, M).n(37, 18, B); // kanat altı füze
  b.k(5, 3, 2, 3, B); // kuyruk işareti
  b.n(60, 11, T4).n(26, 9, T4).n(18, 9, T4);
  return b.bitir();
})();

/** Dost nakliye uçağı. Dönme merkezi (44, 11). Pervane yerleri (52, 12) ve (38, 12). */
export const SPR_NAKLIYE = (() => {
  const b = new Boya(88, 22);
  b.p([6, 8, 70, 7, 80, 10, 86, 14, 78, 17, 14, 17, 4, 12], B);
  b.p([2, 1, 9, 1, 16, 8, 6, 9], B);
  b.p([28, 4, 56, 4, 54, 8, 30, 8], T5); // üst kanat
  b.k(36, 9, 14, 5, T2); // motor
  b.kenar();
  b.p([72, 9, 78, 9, 83, 13, 72, 13], T4).c(76, 9, 78, 13, M).c(72, 9, 78, 9, M).c(72, 13, 83, 13, M);
  for (let x = 20; x < 34; x += 5) b.k(x, 10, 2, 2, T4);
  for (let x = 54; x < 70; x += 5) b.k(x, 10, 2, 2, T4);
  b.c(8, 14, 78, 14, T5);
  b.k(14, 10, 3, 6, T5).c(14, 10, 14, 15, T3); // kapı
  b.k(4, 3, 3, 3, M).n(5, 4, B); // kuyruk işareti
  b.c(38, 12, 48, 12, T1);
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
  b.c(1, 1, 16, 12, T3).c(2, 1, 17, 12, T3);
  b.c(17, 1, 2, 12, T3).c(16, 1, 1, 12, T3);
  b.k(8, 0, 2, 13, T3);
  b.kenar();
  b.c(9, 1, 9, 11, T5);
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
    b.c(x, y, x1, y1, M);
    if (d > 2) b.c(x + 1, y, x1 + 1, y1, M);
    if (d > 3) b.c(x - 1, y, x1 - 1, y1, M);
    if (d <= 0) return;
    dal(x1, y1, aci - 0.3 - r() * 0.45, uz * 0.74, d - 1);
    dal(x1, y1, aci + 0.28 + r() * 0.45, uz * 0.7, d - 1);
    if (d > 2 && r() < 0.5) dal(x1, y1, aci + (r() - 0.5) * 0.3, uz * 0.6, d - 2);
  };
  dal(17, 37, -Math.PI / 2 + 0.06, 11, 4);
  b.k(15, 35, 6, 3, M); // kök
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

void ATES;
