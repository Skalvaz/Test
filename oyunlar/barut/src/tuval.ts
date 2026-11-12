/**
 * Taramalı kare tamponu.
 *
 * Her piksel bir açıklık değeridir (0 mürekkep … 255 kâğıt). Ekrana basarken
 * 7 gri kademeye indirilir; ara değerler komşu iki kademe arasında Bayer 4×4
 * ile taranır. Kademeler birbirine yakın olduğundan tarama yumuşak görünür.
 * Ayrı vurgu katmanı kan (kırmızı) ve ateş (kehribar) gibi renkleri taşır.
 */

/** Gri kademeler, koyudan açığa (ABGR). */
const KADEME = [0xff1a1614, 0xff3c3835, 0xff605c59, 0xff858380, 0xffa6a9a7, 0xffc4cbcb, 0xffdbe6e9];
/** Vurgu renkleri: 1 kan, 2 ateş, 3 kurumuş kan, 4 akkor. */
const VURGULAR = [0, 0xff1e14b0, 0xff2ca1f2, 0xff140e65, 0xffe8fbff];

export const KAN = 1;
export const ATES = 2;
export const KURU_KAN = 3;
export const AKKOR = 4;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** [açıklık][bayer hücresi] → renk. */
const TABLO = new Uint32Array(256 * 16);
for (let g = 0; g < 256; g++) {
  const f = (g / 255) * (KADEME.length - 1);
  const alt = Math.min(KADEME.length - 2, Math.floor(f));
  const kesir = f - alt;
  for (let b = 0; b < 16; b++) TABLO[g * 16 + b] = KADEME[kesir > (BAYER[b] + 0.5) / 16 ? alt + 1 : alt];
}

/** Sprite hücreleri: 0 saydam; 1–255 açıklık + 1 (yani 1 = mürekkep); vurgu ayrı dizide. */
export interface Sprite {
  w: number;
  h: number;
  d: Uint8Array;
  v: Uint8Array;
}

const HARITA: Record<string, number> = { '#': 1, x: 60, '+': 118, '-': 176, o: 255 };

/** `#` mürekkep, `x` koyu, `+` orta, `-` açık, `o` beyaz, `r` kan, `*` ateş, `.` saydam. */
export function sprite(satirlar: string[]): Sprite {
  const h = satirlar.length;
  const w = Math.max(...satirlar.map((s) => s.length));
  const d = new Uint8Array(w * h);
  const v = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = satirlar[y][x] ?? '.';
      if (c === 'r') {
        d[y * w + x] = 1;
        v[y * w + x] = KAN;
      } else if (c === '*') {
        d[y * w + x] = 1;
        v[y * w + x] = ATES;
      } else d[y * w + x] = HARITA[c] ?? 0;
    }
  }
  return { w, h, d, v };
}

export interface YaziSecenek {
  olcek?: number;
  ton?: number;
  /** -1 sol, 0 orta, 1 sağ. */
  hiza?: -1 | 0 | 1;
  /** Çevresine bu tonda 1 piksel kenar (her zeminde okunur). */
  kenar?: number;
  vurgu?: number;
}

// ---- Piksel yazı: 5 piksel yüksek, değişken genişlik, Türkçe büyük harf ----
const HARF: Record<string, string> = {
  A: '.##./#..#/####/#..#/#..#',
  B: '###./#..#/###./#..#/###.',
  C: '.###/#.../#.../#.../.###',
  D: '###./#..#/#..#/#..#/###.',
  E: '####/#.../###./#.../####',
  F: '####/#.../###./#.../#...',
  G: '.###/#.../#.##/#..#/.###',
  H: '#..#/#..#/####/#..#/#..#',
  I: '###/.#./.#./.#./###',
  J: '..##/...#/...#/#..#/.##.',
  K: '#..#/#.#./##../#.#./#..#',
  L: '#.../#.../#.../#.../####',
  M: '#...#/##.##/#.#.#/#...#/#...#',
  N: '#..#/##.#/#.##/#..#/#..#',
  O: '.##./#..#/#..#/#..#/.##.',
  P: '###./#..#/###./#.../#...',
  Q: '.##./#..#/#..#/#.#./.#.#',
  R: '###./#..#/###./#.#./#..#',
  S: '.###/#.../.##./...#/###.',
  T: '###/.#./.#./.#./.#.',
  U: '#..#/#..#/#..#/#..#/.##.',
  V: '#...#/#...#/.#.#./.#.#./..#..',
  W: '#...#/#...#/#.#.#/##.##/#...#',
  X: '#..#/#..#/.##./#..#/#..#',
  Y: '#.#/#.#/.#./.#./.#.',
  Z: '####/...#/.##./#.../####',
  '0': '.##./#.##/#..#/##.#/.##.',
  '1': '.#./##./.#./.#./###',
  '2': '###./...#/.##./#.../####',
  '3': '###./...#/.##./...#/###.',
  '4': '#..#/#..#/####/...#/...#',
  '5': '####/#.../###./...#/###.',
  '6': '.##./#.../###./#..#/.##.',
  '7': '####/...#/..#./.#../.#..',
  '8': '.##./#..#/.##./#..#/.##.',
  '9': '.##./#..#/.###/...#/.##.',
  '!': '#/#/#/./#',
  '?': '###./...#/.##./..../.#..',
  '.': './././././#',
  ',': '../../../.#/#.',
  ':': './#/./#/.',
  '-': '.../.../###/.../...',
  '+': '.../.#./###/.#./...',
  "'": '#/#/././.',
  '/': '..#/..#/.#./#../#..',
  x: '.../#.#/.#./#.#/...',
  '>': '#../.#./..#/.#./#..',
  '<': '..#/.#./#../.#./..#',
};
const BILESIK: Record<string, [string, string, number]> = {
  Ç: ['C', '..#.', 5],
  Ş: ['S', '.#..', 5],
  Ğ: ['G', '.##.', -2],
  İ: ['I', '.#.', -2],
  Ö: ['O', '#..#', -2],
  Ü: ['U', '#..#', -2],
};

interface Glif {
  w: number;
  p: Int8Array;
}
const GLIF = new Map<string, Glif>();
(function glifKur(): void {
  const cevir = (satirlar: string[], ek?: [string, number]): Glif => {
    const w = satirlar[0].length;
    const p: number[] = [];
    satirlar.forEach((s, y) => {
      for (let x = 0; x < s.length; x++) if (s[x] === '#') p.push(x, y);
    });
    if (ek) for (let x = 0; x < ek[0].length; x++) if (ek[0][x] === '#') p.push(x, ek[1]);
    return { w, p: Int8Array.from(p) };
  };
  for (const [k, v] of Object.entries(HARF)) GLIF.set(k, cevir(v.split('/')));
  for (const [k, [taban, isaret, y]] of Object.entries(BILESIK)) GLIF.set(k, cevir(HARF[taban].split('/'), [isaret, y]));
})();

export function yaziGenislik(metin: string, olcek = 2): number {
  let w = 0;
  for (const c of metin) w += (c === ' ' ? 3 : (GLIF.get(c)?.w ?? 3) + 1) * olcek;
  return Math.max(0, w - olcek);
}

export class Tuval {
  readonly g: Uint8Array;
  readonly v: Uint8Array;

  constructor(
    public readonly w: number,
    public readonly h: number,
  ) {
    this.g = new Uint8Array(w * h);
    this.v = new Uint8Array(w * h);
  }

  doldur(d: number): void {
    this.g.fill(d);
    this.v.fill(0);
  }

  nokta(x: number, y: number, d = 0): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.g[i] = d;
    this.v[i] = 0;
  }

  vurgu(x: number, y: number, renk: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.v[y * this.w + x] = renk;
  }

  kutu(x: number, y: number, w: number, h: number, d = 0, renk = 0): void {
    x = Math.round(x);
    y = Math.round(y);
    const x1 = Math.min(this.w, x + Math.round(w));
    const y1 = Math.min(this.h, y + Math.round(h));
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      const s = yy * this.w;
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        this.g[s + xx] = d;
        this.v[s + xx] = renk;
      }
    }
  }

  cerceve(x: number, y: number, w: number, h: number, d = 0): void {
    this.kutu(x, y, w, 1, d);
    this.kutu(x, y + h - 1, w, 1, d);
    this.kutu(x, y, 1, h, d);
    this.kutu(x + w - 1, y, 1, h, d);
  }

  cizgi(x0: number, y0: number, x1: number, y1: number, d = 0, renk = 0): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let hata = dx + dy;
    const W = this.w;
    const H = this.h;
    for (let n = 0; n < 1500; n++) {
      if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) {
        const i = y0 * W + x0;
        if (renk) this.v[i] = renk;
        else {
          this.g[i] = d;
          this.v[i] = 0;
        }
      }
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
  }

  /** 2 piksel kalın çizgi (namlu, gövde). */
  kalin(x0: number, y0: number, x1: number, y1: number, d = 0): void {
    this.cizgi(x0, y0, x1, y1, d);
    if (Math.abs(x1 - x0) > Math.abs(y1 - y0)) this.cizgi(x0, y0 + 1, x1, y1 + 1, d);
    else this.cizgi(x0 + 1, y0, x1 + 1, y1, d);
  }

  daire(cx: number, cy: number, r: number, d = 0, renk = 0): void {
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (renk) this.v[i] = renk;
        else {
          this.g[i] = d;
          this.v[i] = 0;
        }
      }
    }
  }

  halka(cx: number, cy: number, r: number, d = 0, kesik = 1): void {
    const adim = Math.max(8, Math.ceil(r * 6.5));
    for (let i = 0; i < adim; i++) {
      if (kesik > 1 && Math.floor((i / adim) * 24) % kesik !== 0) continue;
      const a = (i / adim) * Math.PI * 2;
      this.nokta(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d);
    }
  }

  /**
   * Yumuşak leke: merkezde `guc` kadar, kenara doğru azalarak açıklığı
   * `hedef` tonuna çeker (duman: koyuya, toz: açığa). Taranınca yarı saydam olur.
   */
  leke(cx: number, cy: number, r: number, guc: number, hedef: number): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const m = (dx * dx + dy * dy) / r2;
        if (m >= 1) continue;
        const i = y * this.w + x;
        if (this.v[i]) continue;
        const k = guc * (1 - m * m);
        this.g[i] += (hedef - this.g[i]) * k;
      }
    }
  }

  ciz(s: Sprite, x: number, y: number, ters = false, koyu = 0): void {
    x = Math.round(x);
    y = Math.round(y);
    const W = this.w;
    const H = this.h;
    for (let sy = 0; sy < s.h; sy++) {
      const py = y + sy;
      if (py < 0 || py >= H) continue;
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.d[sy * s.w + sx];
        if (!c) continue;
        const px = x + (ters ? s.w - 1 - sx : sx);
        if (px < 0 || px >= W) continue;
        const i = py * W + px;
        this.g[i] = koyu ? Math.max(0, c - 1 - koyu) : c - 1;
        this.v[i] = koyu ? 0 : s.v[sy * s.w + sx];
      }
    }
  }

  /** Döndürülmüş sprite: (cx, cy) sprite'ın (ox, oy) noktasına gelir. */
  cizDon(s: Sprite, cx: number, cy: number, aci: number, ters = false, ox = s.w / 2, oy = s.h / 2, koyu = 0): void {
    const c = Math.cos(aci);
    const sn = Math.sin(aci);
    const R = Math.ceil(Math.hypot(Math.max(ox, s.w - ox), Math.max(oy, s.h - oy))) + 1;
    const W = this.w;
    const H = this.h;
    const bx = Math.round(cx);
    const by = Math.round(cy);
    for (let dy = -R; dy <= R; dy++) {
      const py = by + dy;
      if (py < 0 || py >= H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const px = bx + dx;
        if (px < 0 || px >= W) continue;
        let lx = c * dx + sn * dy;
        const ly = -sn * dx + c * dy;
        if (ters) lx = -lx;
        const sx = Math.floor(lx + ox);
        const sy = Math.floor(ly + oy);
        if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
        const hucre = s.d[sy * s.w + sx];
        if (!hucre) continue;
        const i = py * W + px;
        this.g[i] = koyu ? Math.max(0, hucre - 1 - koyu) : hucre - 1;
        this.v[i] = koyu ? 0 : s.v[sy * s.w + sx];
      }
    }
  }

  yazi(metin: string, x: number, y: number, sec: YaziSecenek = {}): void {
    const olcek = sec.olcek ?? 2;
    const gen = yaziGenislik(metin, olcek);
    x = Math.round(sec.hiza === 0 ? x - gen / 2 : sec.hiza === 1 ? x - gen : x);
    y = Math.round(y);
    if (sec.kenar !== undefined) {
      this.yaziHam(metin, x - 1, y, olcek, sec.kenar, 0);
      this.yaziHam(metin, x + 1, y, olcek, sec.kenar, 0);
      this.yaziHam(metin, x, y - 1, olcek, sec.kenar, 0);
      this.yaziHam(metin, x, y + 1, olcek, sec.kenar, 0);
    }
    this.yaziHam(metin, x, y, olcek, sec.ton ?? 0, sec.vurgu ?? 0);
  }

  private yaziHam(metin: string, x: number, y: number, olcek: number, ton: number, renk: number): void {
    let cx = x;
    for (const c of metin) {
      if (c === ' ') {
        cx += 3 * olcek;
        continue;
      }
      const gl = GLIF.get(c);
      if (!gl) {
        cx += 4 * olcek;
        continue;
      }
      for (let i = 0; i < gl.p.length; i += 2) this.kutu(cx + gl.p[i] * olcek, y + gl.p[i + 1] * olcek, olcek, olcek, ton, renk);
      cx += (gl.w + 1) * olcek;
    }
  }

  /** Tamponu görüntüye yazar. `parla` > 0: patlama anında ekran ağarır. */
  sun(hedef: Uint32Array, parla = 0): void {
    const { w, h, g, v } = this;
    let i = 0;
    const ek = Math.round(parla * 90);
    for (let y = 0; y < h; y++) {
      const satir = (y & 3) << 2;
      for (let x = 0; x < w; x++, i++) {
        const vi = v[i];
        if (vi) hedef[i] = VURGULAR[vi];
        else {
          let gi = g[i] + ek;
          if (gi > 255) gi = 255;
          hedef[i] = TABLO[(gi << 4) | satir | (x & 3)];
        }
      }
    }
  }
}
