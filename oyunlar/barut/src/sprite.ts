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

  /** Kalın çizgi: yol boyunca w×w kareler basar. */
  kal(x0: number, y0: number, x1: number, y1: number, w: number, ton: number): this {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      this.k(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, ton);
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

/**
 * Oyuncunun saldırı helikopteri, AH-64 çizgisinde (kullanıcı isteği): rotorun
 * üstünde radar kubbesi, yanlarda iri motor kaportaları, düz panelli uzun
 * tandem kabin, burunda nişangâh tareti, gövde altında zincirli top, kısa
 * kanatta roket yuvası ve füze rafı, geriye yatık dikme, altta yatay denge,
 * sabit iniş takımı ve kuyruk tekeri. İşaret yok.
 */
export const HELI_N = { ox: 46, oy: 16, direk: [46, 5], kuyruk: [7, 8], namlu: [76, 28] } as const;
export const SPR_HELI = (() => {
  const b = new Boya(96, 34);
  // Kuyruk bomu, dikme, yatay denge
  b.p([10, 13, 36, 11, 36, 18, 22, 17, 10, 16], B);
  b.p([9, 16, 15, 15, 11, 3, 6, 2, 3, 4], B);
  b.p([1, 18, 16, 17, 16, 19, 1, 20], T2);
  // Gövde: bomdan buruna; kabinin arkasında yükselir, burunda alçalır
  b.p([34, 11, 56, 8, 59, 7, 67, 8, 79, 13, 84, 15, 87, 18, 85, 21, 78, 23, 50, 23, 40, 21, 34, 18], B);
  // Motor kaportası (gövdenin yanında, iri) ve egzoz
  b.p([35, 9, 55, 9, 58, 11, 58, 15, 36, 15, 33, 13, 33, 11], T5);
  // Rotor direği ve üstündeki radar kubbesi
  b.k(44, 5, 5, 4, T2);
  b.k(45, 3, 3, 2, T2);
  b.o(46, 1.5, 4.6, T4, 1.7);
  // Yan avyonik kaportası
  b.p([50, 16, 76, 16, 79, 18, 79, 21, 50, 21], T5);
  // Kısa kanat, roket yuvası, füze rafı
  b.p([45, 16, 57, 16, 56, 18, 46, 18], T2);
  b.k(43, 20, 12, 4, T2);
  b.k(45, 26, 10, 2, T2);
  // Burun nişangâhı (alt taret) ve gece görüşü (üst)
  b.o(85, 19.5, 2.6, T2);
  b.k(81, 13, 3, 2, T2);
  // Zincirli top yuvası, iniş takımı tekeri, kuyruk tekeri
  b.k(64, 23, 6, 3, T2);
  b.o(61, 30.5, 2.6, T1);
  b.o(13, 24, 1.8, T1);
  b.kenar();
  // Top namlusu ve takım dikmeleri
  b.c(69, 25, 76, 28, M).c(69, 26, 75, 28, M);
  b.c(57, 22, 60, 28, M).c(59, 23, 62, 28, M).c(14, 17, 13, 22, M);
  b.c(48, 18, 48, 20, M).c(52, 18, 52, 20, M).c(50, 24, 50, 25, M); // pilonlar
  // Kabin: düz cam paneller, kalın çerçeve, arada zırhlı bölme
  b.p([60, 8, 67, 9, 78, 14, 78, 15, 60, 15], T2); // koyu, parlak cam
  b.c(59, 7, 67, 8, M).c(67, 8, 79, 13, M).c(59, 7, 59, 15, M).c(59, 15, 79, 15, M).c(79, 13, 79, 15, M);
  b.c(68, 9, 69, 15, M).c(69, 9, 70, 15, M); // iki kabin arasındaki bölme
  b.c(64, 9, 64, 14, T1).c(74, 12, 74, 14, T1); // ince kayıtlar
  // Camda yansıma: her panelde çapraz açık çizgi
  b.c(61, 12, 63, 9, T5).n(61, 13, T4).c(65, 13, 67, 10, T4).c(71, 13, 73, 11, T5).c(75, 14, 76, 13, T4);
  // Motor: egzoz ağzı (karanlık), hava girişi, kaporta çizgileri
  b.k(33, 10, 4, 4, T1).n(34, 11, M).n(35, 12, M);
  b.o(57, 12, 1.6, M).n(57, 12, T3);
  b.c(39, 9, 39, 15, T4).c(47, 9, 47, 15, T4).c(38, 12, 55, 12, T4).n(42, 10, T3).n(51, 10, T3).n(43, 14, T3).n(52, 14, T3);
  // Radar kubbesi ve rotor başı
  b.c(43, 1, 49, 1, B).n(46, 3, M).c(43, 6, 49, 6, M);
  // Avyonik kaportası: panel çizgileri, alt kenarda gölge
  b.c(50, 16, 76, 16, M).c(50, 21, 79, 21, T4).c(57, 17, 57, 20, T4).c(65, 17, 65, 20, T4).c(72, 17, 72, 20, T4);
  b.n(53, 18, T3).n(61, 18, T3).n(68, 18, T3).n(75, 19, T3);
  // Roket yuvası (ön yüzünde tüp ağızları), füzeler
  b.c(54, 21, 54, 22, B).c(44, 21, 52, 21, T1);
  b.n(55, 26, M).n(55, 27, M).c(46, 26, 53, 26, T3);
  // Burun: taret camı, panel
  b.n(86, 19, B).n(85, 20, T4).c(80, 16, 83, 17, T5).c(79, 22, 84, 21, T5);
  // Gövde ve bom: panel çizgileri, perçinler, uyarı şeridi
  b.c(40, 13, 40, 20, T5).c(45, 19, 49, 22, T5).c(36, 16, 49, 16, T5);
  b.c(12, 14, 34, 13, T5).k(25, 12, 2, 6, M).k(29, 12, 1, 6, M);
  b.n(18, 15, T4).n(22, 15, T4).n(31, 16, T4);
  // Dikme: ön kenar, kuyruk rotoru göbeği
  b.c(13, 14, 10, 4, T5).k(6, 7, 2, 2, T1);
  b.c(2, 19, 15, 18, T1);
  // Teker göbekleri
  b.n(61, 30, T4).n(61, 31, T4).n(13, 24, T4);
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

/** Sabit süslerin ortak gürültüsü (sıva dökülmesi, kabuk, pas). */
const kes = (a: number, b: number): number => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

// Sabit süslerin hepsinde alt orta yere oturur: (w >> 1, h - 1).

/** Tank engeli: üç çelik kiriş, ortada cıvatalı bağlantı levhası. */
export const SPR_KIRPI = (() => {
  const b = new Boya(27, 21);
  b.kal(3, 18, 23, 3, 3, T3); // sağa yatan kiriş
  b.kal(3, 4, 23, 18, 3, T3); // sola yatan kiriş
  b.kal(13, 1, 12, 19, 3, T2); // arkadaki dik kiriş (gölgede)
  b.kenar(T1);
  // Üst yüzlerde ışık, alt yüzlerde gölge: kiriş köşebent gibi okunur
  b.c(3, 17, 23, 2, T5).c(3, 3, 23, 17, T5);
  b.c(4, 19, 24, 4, T2).c(3, 5, 22, 19, T2);
  b.k(11, 9, 5, 5, T2).k(12, 10, 3, 3, T3).n(11, 9, T5).n(15, 9, T5).n(11, 13, T5).n(15, 13, T5); // levha ve cıvatalar
  b.n(4, 18, T1).n(22, 18, T1).n(22, 4, T4).n(5, 4, T4); // uç kesikleri
  b.c(8, 14, 9, 13, T4).n(18, 7, T4).n(17, 14, T4); // pas lekeleri
  return b.bitir();
})();

/**
 * Kuru ağaç: kalın, kabuklu gövde; biri kırık üç ana dal; ince sürgünler;
 * dalda bir karga. Kalın kısımlar kenarlı, sürgünler tek piksel.
 */
export const SPR_AGAC = (() => {
  const W = 47;
  const b = new Boya(W, 56);
  let tohum = 11;
  const r = (): number => {
    tohum = (tohum * 16807) % 2147483647;
    return tohum / 2147483647;
  };
  const surgun: [number, number, number, number][] = [];
  const dal = (x: number, y: number, aci: number, uz: number, kalin: number, d: number): void => {
    const x1 = x + Math.cos(aci) * uz;
    const y1 = y + Math.sin(aci) * uz;
    if (kalin >= 2) b.kal(x, y, x1, y1, kalin, T2);
    else surgun.push([x, y, x1, y1]);
    if (d <= 0) return;
    const k = kalin > 2 ? kalin - 1 : kalin - (d < 3 ? 1 : 0);
    dal(x1, y1, aci - 0.38 - r() * 0.35, uz * 0.8, Math.max(1, k), d - 1);
    dal(x1, y1, aci + 0.34 + r() * 0.38, uz * 0.74, Math.max(1, k - 1), d - 1);
  };
  // Gövde: dipte genişler, hafif eğri
  b.p([19, 55, 20, 48, 21, 40, 21, 33, 26, 33, 26, 41, 27, 48, 29, 55], T2);
  b.p([14, 55, 19, 51, 20, 55], T2).p([28, 55, 29, 51, 33, 55], T2); // kökler
  dal(23, 34, -Math.PI / 2 - 0.62, 11, 3, 3);
  dal(24, 34, -Math.PI / 2 + 0.55, 12, 3, 3);
  dal(23, 36, -Math.PI / 2 - 0.02, 14, 2, 2);
  // Kırık dal: kısa, ucu yarılmış
  b.kal(26, 40, 33, 36, 2, T2);
  b.kenar(T1);
  for (const [x0, y0, x1, y1] of surgun) b.c(x0, y0, x1, y1, T1);
  // Kabuk: ışık soldan, dikine yarıklar, budak
  b.c(20, 53, 22, 35, T3).c(21, 46, 21, 41, T3).n(20, 50, T3);
  b.c(25, 52, 24, 44, T1).c(23, 49, 23, 46, T1).c(26, 54, 26, 50, T1);
  b.o(24, 42, 1.2, T1).n(24, 42, T3);
  b.n(33, 35, T5).n(34, 36, T5).n(34, 35, T1).n(32, 36, T4); // kırığın açık renkli odunu
  b.c(15, 55, 18, 53, T3).c(30, 53, 32, 55, T1);
  // Karga: kırık dalın ucunda, sola bakar
  b.k(33, 32, 4, 2, T1).n(32, 32, T1).n(31, 33, T1).n(37, 33, T1).n(38, 34, T1).n(34, 31, T1).n(35, 34, T1);
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

/**
 * Sokak lambası: dökme kaide, bilezikli direk, ortasından bükülmüş; kıvrık
 * kol, camı kırık fener, sarkan kablo, direğe yapıştırılmış ilan. Kaide
 * ortası (8, 67); çizimde ayna alınabilir.
 */
export const SPR_LAMBA = (() => {
  const b = new Boya(30, 68);
  // Kaide: iki kademeli
  b.k(4, 63, 9, 5, T3).k(5, 58, 7, 5, T3).k(6, 55, 5, 3, T3);
  // Direk: dik çıkar, belinden bükülmüş
  b.kal(8, 55, 8, 32, 3, T3);
  b.kal(8, 32, 13, 9, 3, T3);
  b.k(12, 5, 3, 4, T3).n(13, 4, T3); // tepe topuzu
  // Kol: düz, altında payanda
  b.kal(13, 9, 25, 9, 2, T3);
  b.c(14, 14, 19, 10, T3);
  // Fener: koldan asılı, üstü şapkalı
  b.k(22, 11, 2, 2, T3);
  b.p([19, 13, 27, 13, 28, 15, 26, 20, 20, 20, 18, 15], T3);
  b.kenar(T1);
  // Direkte ışık ve gölge, bilezikler
  b.c(7, 54, 7, 33, T5).c(7, 32, 12, 10, T5);
  b.c(9, 54, 9, 33, T2).c(10, 31, 14, 11, T2);
  for (const y of [50, 41, 33]) b.c(7, y, 9, y, T1);
  b.c(10, 24, 12, 24, T1).c(12, 16, 14, 16, T1);
  b.c(14, 8, 25, 8, T5).n(12, 5, T5).n(12, 6, T5);
  // Kaide ayrıntısı
  b.c(4, 63, 12, 63, T5).c(5, 58, 11, 58, T5).c(6, 55, 10, 55, T5);
  b.k(11, 64, 2, 4, T2).k(10, 59, 2, 4, T2).n(7, 65, T1).n(7, 60, T1);
  // Fener: şapkada ışık, camı kırık (içi karanlık, köşede bir parça cam)
  b.c(19, 13, 27, 13, T5).c(18, 15, 28, 15, T1);
  b.k(20, 16, 6, 3, T1).n(20, 16, B).n(21, 17, B).n(20, 17, B).n(25, 16, T4);
  b.c(23, 16, 23, 18, T3); // cam çıtası
  // Sarkan kablo
  b.n(24, 21, T1).n(24, 22, T1).n(25, 23, T1).n(25, 24, T1).n(24, 25, T1).n(24, 26, T1).n(25, 27, T1);
  // Direkteki ilan
  b.k(6, 43, 5, 6, B).c(6, 43, 10, 43, T1).c(6, 48, 9, 48, T1).c(6, 43, 6, 48, T1).c(10, 43, 10, 47, T1);
  b.c(7, 45, 9, 45, T2).c(7, 46, 8, 46, T2).n(10, 48, T4);
  return b.bitir();
})();

/**
 * Beton bariyer: geniş taban, daralan gövde; uyarı şeritleri; bir köşesi
 * kopmuş, içinden demir çıkıyor; altta kaldırma yuvaları.
 */
export const SPR_BARIYER = (() => {
  const b = new Boya(33, 17);
  b.p([1, 15, 1, 12, 7, 9, 9, 1, 19, 1, 22, 4, 24, 4, 25, 9, 31, 12, 31, 15], T5);
  b.kenar(T1);
  // Alt kademe gölgede
  for (let y = 10; y <= 15; y++) for (let x = 1; x <= 31; x++) if (b.d[y * 33 + x] === T5 + 1) b.n(x, y, T4);
  b.c(8, 9, 24, 9, T3);
  // Uyarı şeritleri (yalnız üst gövdede)
  for (let k = 0; k < 4; k++) {
    for (let y = 2; y <= 8; y++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = 9 + k * 5 + dx + (8 - y) * 0.5;
        if (b.d[y * 33 + Math.round(x)] === T5 + 1) b.n(x, y, T2);
      }
    }
  }
  b.c(9, 1, 18, 1, B); // üst kenarda ışık
  // Kopuk köşe: kırık yüzey ve demirler
  b.n(20, 2, T3).n(21, 3, T3).n(22, 4, T3).n(23, 5, T3);
  b.c(21, 2, 24, 0, T1).c(23, 3, 26, 2, T1);
  // Kaldırma yuvaları, çatlak, kurşun izi
  b.k(6, 14, 3, 2, T1).k(23, 14, 3, 2, T1);
  b.c(13, 10, 14, 13, T2).c(14, 13, 13, 15, T2).n(27, 12, T2).n(4, 13, T2);
  return b.bitir();
})();

/**
 * Yön levhası: ok biçimli tabela (yazı yok, yalnız ok), altında yuvarlak
 * küçük levha; direk eğik, beton ayaklı; kurşun delikleri.
 */
export const SPR_LEVHA = (() => {
  const b = new Boya(25, 40);
  b.kal(12, 38, 13, 12, 2, T3); // direk
  b.k(9, 37, 7, 3, T4); // beton ayak
  b.p([2, 2, 16, 3, 22, 8, 16, 13, 2, 12], B); // ok biçimli tabela
  b.o(12, 21, 4.4, T5); // yuvarlak levha
  b.kenar(T1);
  b.c(12, 37, 13, 26, T5).c(12, 16, 12, 14, T5);
  b.c(9, 37, 15, 37, B);
  // Tabela: iç çerçeve ve ok
  b.c(4, 4, 15, 5, T3).c(4, 10, 15, 11, T3).c(4, 4, 4, 10, T3).c(15, 5, 19, 8, T3).c(15, 11, 19, 8, T3);
  b.c(6, 7, 14, 8, T1).c(6, 8, 14, 9, T1).c(12, 5, 16, 8, T1).c(12, 11, 16, 8, T1);
  // Yuvarlak levha: halka ve çubuk
  for (let a = 0; a < 20; a++) b.n(12 + Math.cos(a * 0.314) * 3.2, 21 + Math.sin(a * 0.314) * 3.2, T2);
  b.c(10, 21, 14, 21, T1);
  // Kurşun delikleri (çevresi ezik)
  b.n(8, 6, T1).n(9, 6, T4).n(18, 9, T1).n(5, 11, T1).n(13, 19, T1).n(14, 19, T4);
  b.n(11, 13, T1).n(14, 13, T1); // kelepçeler
  return b.bitir();
})();

/** Variller: biri dik (ezik, kapaklı), biri devrilmiş; altında sızıntı. */
export const SPR_VARIL = (() => {
  const b = new Boya(29, 19);
  b.k(2, 4, 10, 13, T3); // dik varil
  b.o(6.5, 4, 5, T4, 1.6); // kapak
  b.k(13, 9, 13, 8, T3); // devrik varil
  b.o(25.5, 12.5, 2, T4, 4); // devrik varilin ağzı
  b.kenar(T1);
  // Dik varil: ışık solda, gölge sağda, bilezikler, ezik
  b.k(3, 5, 1, 11, T5).k(10, 5, 2, 12, T2);
  b.c(2, 8, 11, 8, T1).c(2, 13, 11, 13, T1).c(3, 8, 3, 8, T4);
  b.o(6.5, 4, 3, T5, 0.8).n(8, 4, T1); // kapak yüzü ve tıpa
  b.c(6, 10, 8, 11, T2).n(7, 10, T5);
  // Devrik varil: üst yüzde ışık, altında gölge, bilezikler dikine
  b.c(13, 10, 24, 10, T5).c(13, 16, 24, 16, T2);
  b.c(16, 9, 16, 16, T1).c(21, 9, 21, 16, T1);
  b.o(25.5, 12.5, 1, T1, 2.6); // ağız içi karanlık
  // Sızıntı
  b.c(22, 18, 28, 18, T1).n(26, 17, T1).n(27, 17, T1);
  return b.bitir();
})();

/**
 * Yıkık duvar köşesi: sıvalı tuğla, basamak basamak kırılmış üst, pencere
 * boşluğu (lentosu ve denizliği yerinde, bir kanadı asılı), demirler, dipte
 * tuğla yığını.
 */
export const SPR_DUVAR = (() => {
  const W = 48;
  const H = 54;
  const b = new Boya(W, H);
  // Duvarın üst kenarı: tuğla basamakları (4 piksellik sütunlar, 3 piksellik sıralar)
  const ust = [30, 21, 15, 12, 6, 6, 3, 9, 15, 18, 27];
  for (let k = 0; k < ust.length; k++) {
    for (let y = ust[k]; y < H - 1; y++) {
      for (let x = 2 + k * 4; x < 6 + k * 4; x++) {
        const sira = Math.floor(y / 3);
        const derz = y % 3 === 2 || (x + (sira % 2) * 3) % 6 === 0;
        // Sıva: kırık kenarlara yakın yerlerde ve rastgele lekelerde dökülmüş
        const kenaraYakin = y - ust[k] < 4 + kes(k, 3) * 5;
        const leke = Math.hypot((x - 34) / 7, (y - 40) / 6) + (kes(x, y) - 0.5) * 0.4 < 1;
        b.n(x, y, kenaraYakin || leke ? (derz ? T2 : T3) : T5);
      }
    }
  }
  // Pencere boşluğu
  for (let y = 22; y < 37; y++) for (let x = 15; x < 26; x++) b.d[y * W + x] = 0;
  // Dipteki tuğla yığını (duvardan taşar)
  b.p([0, 53, 3, 48, 9, 46, 13, 50, 15, 53], T3);
  b.p([36, 53, 39, 47, 44, 49, 47, 53], T3);
  b.kenar(T1);
  for (let y = 22; y < 37; y++) for (let x = 15; x < 26; x++) if (x > 15 && x < 25 && y > 22 && y < 36) b.d[y * W + x] = 0;
  // Lento ve denizlik
  b.k(13, 19, 15, 3, T4).c(13, 19, 27, 19, B).c(13, 22, 27, 22, T1);
  b.k(13, 37, 15, 2, B).c(13, 39, 27, 39, T1);
  // Asılı kalan kanat: tek menteşede, eğik
  b.p([25, 24, 29, 26, 28, 37, 24, 35], T3);
  b.c(25, 24, 29, 26, T1).c(29, 26, 28, 37, T1).c(28, 37, 24, 35, T1);
  for (let y = 27; y < 35; y += 2) b.c(25, y, 28, y + 1, T2);
  // Sıvada çatlak, kurşun izleri, afiş kalıntısı
  b.c(8, 30, 10, 36, T2).c(10, 36, 8, 42, T2).c(8, 42, 9, 47, T2);
  b.n(31, 30, T2).n(32, 30, T4).n(12, 44, T2).n(29, 45, T2);
  b.k(30, 20, 6, 7, B).c(30, 20, 35, 20, T2).c(30, 20, 30, 26, T2).c(31, 22, 34, 22, T3).c(31, 24, 33, 24, T3).n(35, 26, T5).n(34, 26, T5);
  // Demirler: kırık üstten çıkar, biri bükük
  b.c(19, 5, 18, 0, T1).c(27, 3, 29, 0, T1).c(29, 0, 32, 1, T1).c(11, 15, 9, 10, T1);
  // Yığındaki tuğlalar
  b.k(3, 50, 4, 2, T4).k(8, 48, 4, 2, T5).k(9, 51, 4, 2, T2).k(39, 50, 4, 2, T4).k(41, 52, 4, 1, T2);
  b.c(3, 52, 6, 52, T1).c(8, 50, 11, 50, T1).c(39, 52, 42, 52, T1);
  b.c(2, 52, 45, 52, T2);
  return b.bitir();
})();

/**
 * Makineli cip, HMMWV çizgisinde (kullanıcı isteği): geniş ve alçak kutu gövde,
 * uzun düz kaput, dik ön cam, dört kapı (kapılarda çapraz baskı), arkaya inen
 * eğik tavan, köşeli çamurluk boşlukları, iri tekerler, tavanda taret halkası.
 * Nişancı, kalkan ve namlu çizim anında eklenir (hurdada görünmesinler).
 */
export const JEEP_N = { ox: 31, oy: 18, namlu: [25, 3], nisanci: [21, 6], teker: [[15, 27], [47, 27]] } as const;
export const SPR_JEEP = (() => {
  const W = 64;
  const b = new Boya(W, 34);
  // Gövde: eğik arka, düz tavan, dik ön cam, kaput, burun
  b.p([3, 23, 3, 15, 9, 8, 33, 8, 35, 14, 57, 14, 60, 16, 60, 23], T3);
  b.k(60, 20, 3, 3, T2).k(0, 20, 3, 3, T2); // tamponlar
  b.k(17, 6, 12, 2, T2); // taret halkası
  b.kenar(M);
  // Alt kuşak gölgede, üst yüzeylerde ışık
  for (let x = 4; x < 60; x++) for (let y = 21; y < 24; y++) if (b.d[y * W + x] === T3 + 1) b.n(x, y, T2);
  b.c(10, 9, 32, 9, T5).c(36, 15, 56, 15, T5).c(5, 15, 9, 10, T4);
  // Köşeli çamurluk boşlukları
  for (const cx of [15, 47]) b.p([cx - 8, 23, cx - 6, 18, cx + 6, 18, cx + 8, 23], T1);
  b.teker(15, 27, 5.7).teker(47, 27, 5.7);
  for (const cx of [15, 47]) b.n(cx - 3, 27, T4).n(cx + 3, 27, T4).n(cx, 24, T4).n(cx, 30, T4); // bijonlar
  // Camlar: ön kapı (ön köşesi eğik), arka kapı; içerisi karanlık, camda parlama
  b.p([27, 10, 32, 10, 33, 13, 27, 13], T1).k(19, 10, 7, 4, T1);
  b.c(28, 12, 30, 10, T4).c(20, 12, 22, 10, T4);
  b.n(31, 12, M).n(31, 11, M).n(32, 12, M); // şoförün başı
  // Kapılar: derzler, kollar, çapraz baskı
  b.c(26, 9, 26, 22, M).c(18, 9, 18, 22, M).c(35, 14, 35, 22, M);
  b.c(24, 15, 25, 15, M).c(33, 15, 34, 15, M);
  b.c(20, 16, 24, 21, T2).c(24, 16, 20, 21, T2).c(28, 16, 33, 21, T2).c(33, 16, 28, 21, T2);
  // Eğik arka: panjur, stop; arkada anten (bağlı, kavisli)
  b.c(6, 16, 9, 12, T2).c(8, 17, 11, 13, T2).n(3, 18, M).n(3, 19, T5);
  b.c(8, 9, 6, 3, M).c(6, 3, 9, 0, M);
  // Kaput: panjur, far, ızgara dilimleri, çeki demiri
  b.c(40, 16, 45, 16, T1).c(40, 18, 45, 18, T1).c(47, 16, 52, 16, T1);
  b.k(58, 17, 2, 2, B);
  b.c(58, 20, 58, 22, M).c(56, 20, 56, 22, M).c(54, 20, 54, 22, T2);
  b.n(62, 21, T5).n(1, 21, T5);
  // Taret halkası ayrıntısı
  b.c(17, 6, 28, 6, T4);
  return b.bitir();
})();

// ---- Hurdalar ----

/**
 * Yanmış hurda: sağlam sprite'tan türetilir. Boya yanıp kül rengine döner
 * (gövde orta gri, çizgiler koyu gri; mürekkep yok: hurda dekor sayılır,
 * hareketli birliklerle yarışmaz), isabet yerinin çevresi islenir, delik
 * köşeli ve içi karanlıktır; `acik` delik silueti de koparır (kule yuvası,
 * kopan burun). Eskiden hurda düz siyah siluetti.
 */
function hurda(s: Sprite, tohum: number, delikler: [number, number, number, number][]): Sprite {
  const d = new Uint8Array(s.d.length);
  const kul = (ton: number): number => (ton < 20 ? T1 : ton < 64 ? T2 : ton < 150 ? T3 : ton < 234 ? T4 : T5);
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = s.d[y * s.w + x];
      if (!c) continue;
      let ton = kul(c - 1);
      // İs: isabet yerine yakınlık + yukarı doğru yalayan alev izi
      let is = 0;
      for (const [hx, hy, r] of delikler) {
        const uz = Math.hypot(x - hx, (y - hy) * (y < hy ? 0.6 : 1.3));
        is = Math.max(is, 1 - (uz - r) / (r * 1.6 + 4));
      }
      is += (kes((x >> 1) + tohum, (y >> 1) * 3 + tohum) - 0.5) * 0.5;
      if (is > 0.75 && ton > T1) ton = Math.max(T1, ton - 86);
      else if (is > 0.3 && ton > T2) ton -= 43;
      d[y * s.w + x] = ton + 1;
    }
  }
  for (const [hx, hy, r, acik] of delikler) {
    for (let y = Math.max(0, Math.floor(hy - r - 3)); y < Math.min(s.h, hy + r + 4); y++) {
      for (let x = Math.max(0, Math.floor(hx - r - 3)); x < Math.min(s.w, hx + r + 4); x++) {
        if (!d[y * s.w + x]) continue;
        // Köşeli delik: yarıçap açıya göre oynar (yıldız gibi yırtık)
        const aci = Math.atan2(y - hy, x - hx);
        const rr = r * (0.62 + 0.55 * kes(Math.floor((aci + Math.PI) * 1.6) + tohum, r));
        const uz = Math.hypot(x - hx, y - hy);
        if (uz < rr) d[y * s.w + x] = acik ? 0 : T1 + 1;
        else if (uz < rr + 1.1) d[y * s.w + x] = (kes(x + tohum, y) < 0.28 ? T5 : T1) + 1; // yırtık sac: yer yer parlak
      }
    }
  }
  return { w: s.w, h: s.h, d, v: new Uint8Array(s.d.length) };
}

// Delikler: [x, y, yarıçap, açık mı (silueti koparır)]
export const SPR_H_TANK = hurda(SPR_TANK, 3, [[45, 4, 7, 1], [22, 12, 3, 0], [63, 11, 2, 0]]);
export const SPR_H_UCAKSAVAR = hurda(SPR_UCAKSAVAR, 5, [[34, 3, 7, 1], [56, 10, 3, 0]]);
export const SPR_H_KAMYON = hurda(SPR_KAMYON, 7, [[24, 5, 8, 1], [63, 11, 3, 0], [40, 14, 2, 0]]);
export const SPR_H_DHELI = hurda(SPR_DHELI, 9, [[52, 13, 5, 0], [84, 19, 5, 1], [18, 13, 2, 0]]);
export const SPR_H_JET = hurda(SPR_JET, 11, [[42, 10, 4, 0], [88, 11, 6, 1]]);
export const SPR_H_HELI = hurda(SPR_HELI, 13, [[53, 16, 5, 0], [8, 7, 5, 1], [70, 12, 3, 0]]);
export const SPR_H_JEEP = hurda(SPR_JEEP, 15, [[45, 13, 5, 1], [24, 15, 3, 0], [8, 12, 3, 1]]);

void ATES;
