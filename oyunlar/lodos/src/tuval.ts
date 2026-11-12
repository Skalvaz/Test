/**
 * 1-bit kare tamponu.
 *
 * Her şey önce 0–255 gri değer olarak yazılır; ekrana basarken mavi gürültü
 * eşiğiyle tek bite indirilir. Böylece gölgeler, bulutlar, su derinliği
 * kendiliğinden noktalı taramaya dönüşür. Ayrı bir vurgu katmanı (kehribar)
 * fener, kıvılcım, güneş gibi az sayıda pikseli boyar.
 */

export const ZEMIN = 0xff120b08; // #080b12 (ABGR)
export const MUREKKEP = 0xfff0e8dc; // #dce8f0
export const VURGU = 0xff2ea8ff; // #ffa82e

/**
 * Eşik matrisi: 32×32 mavi gürültü (en iyi aday yöntemi, kenarlarda sarmalı).
 * Düzenli Bayer ızgarası yerine elle noktalanmış gibi dağınık tarama verir.
 */
const EB = 32;
const ESIK = new Uint8Array(EB * EB);
(function esikKur(): void {
  let a = 0x1234abcd;
  const rng = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const n = EB * EB;
  const bos: number[] = [];
  for (let i = 0; i < n; i++) bos.push(i);
  const px = new Int16Array(n);
  const py = new Int16Array(n);
  for (let k = 0; k < n; k++) {
    let enUzak = -1;
    let secilen = 0;
    const aday = Math.min(bos.length, k < 2 ? 1 : 14);
    for (let c = 0; c < aday; c++) {
      const bi = (rng() * bos.length) | 0;
      const x = bos[bi] % EB;
      const y = (bos[bi] / EB) | 0;
      let enYakin = 1e9;
      for (let j = 0; j < k; j++) {
        let dx = Math.abs(px[j] - x);
        if (dx > EB / 2) dx = EB - dx;
        let dy = Math.abs(py[j] - y);
        if (dy > EB / 2) dy = EB - dy;
        const d = dx * dx + dy * dy;
        if (d < enYakin) enYakin = d;
      }
      if (enYakin > enUzak) {
        enUzak = enYakin;
        secilen = bi;
      }
    }
    const hucre = bos[secilen];
    bos[secilen] = bos[bos.length - 1];
    bos.pop();
    px[k] = hucre % EB;
    py[k] = (hucre / EB) | 0;
    ESIK[hucre] = Math.floor((k * 255) / n);
  }
})();

/** Sprite hücreleri: 0 saydam, 1 mürekkep, 2 siyah (örter), 3 gri, 4 vurgu. */
export interface Sprite {
  w: number;
  h: number;
  d: Uint8Array;
  /** 1 piksel genişletilmiş örtü ((w+2)×(h+2)); arka planı temizlemek için. */
  hale: Uint8Array;
}

export function sprite(satirlar: string[]): Sprite {
  const h = satirlar.length;
  const w = Math.max(...satirlar.map((s) => s.length));
  const d = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = satirlar[y][x] ?? '.';
      d[y * w + x] = c === '#' ? 1 : c === '_' ? 2 : c === '+' ? 3 : c === '*' ? 4 : 0;
    }
  }
  const hw = w + 2;
  const hale = new Uint8Array(hw * (h + 2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!d[y * w + x]) continue;
      for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) hale[(y + dy) * hw + x + dx] = 1;
    }
  }
  return { w, h, d, hale };
}

export interface SpriteSecenek {
  /** Yatay çevir. */
  ters?: boolean;
  /** 90° döndür: sağa bakan sprite'ın başı yukarı gelir. */
  dik?: boolean;
  /** Kaynak sütuna göre kaydırma (dalgalanma, yatma). */
  kay?: (sutun: number) => number;
  /** Çevresini 1 piksel siyaha boya (zeminden ayırır). */
  hale?: boolean;
  /** Mürekkep piksellerinin gri değeri (uzak siluetler için). */
  ton?: number;
}

export interface YaziSecenek {
  olcek?: number;
  ton?: number;
  /** -1 sol, 0 orta, 1 sağ. */
  hiza?: -1 | 0 | 1;
  /** Arkasına siyah kutu. */
  zemin?: boolean;
  vurgu?: boolean;
  /** Satıra göre ton (başlıkta taramalı dolgu). */
  tonFn?: (satir: number) => number;
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
  '~': '..../.#.#/#.#./..../....',
  // Küçük simgeler
  '$': '.#./###/#../###/..#', // kullanılmıyor; yer tutucu
  '^': '.#.#./#####/#####/.###./..#..', // kalp
};
const BILESIK: Record<string, [string, string, number]> = {
  // harf: [taban, işaret satırı, işaretin y'si (−2 üst, 5 alt)]
  Ç: ['C', '..#.', 5],
  Ş: ['S', '.#..', 5],
  Ğ: ['G', '.##.', -2],
  İ: ['I', '.#.', -2],
  Ö: ['O', '#..#', -2],
  Ü: ['U', '#..#', -2],
};

interface Glif {
  w: number;
  /** [dx, dy] dolu pikseller. */
  p: Int8Array;
}
const GLIF = new Map<string, Glif>();
function glifKur(): void {
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
}
glifKur();

export function yaziGenislik(metin: string, olcek = 1): number {
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

  temizle(): void {
    this.g.fill(0);
    this.v.fill(0);
  }

  nokta(x: number, y: number, d = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.g[y * this.w + x] = d;
  }

  ekle(x: number, y: number, d: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    const s = this.g[i] + d;
    this.g[i] = s > 255 ? 255 : s < 0 ? 0 : s;
  }

  vurgu(x: number, y: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.v[y * this.w + x] = 1;
  }

  /** Vurguyu da siler (üstüne çizilen şey vurgunun altında kalmasın). */
  sil(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.g[i] = 0;
    this.v[i] = 0;
  }

  kutu(x: number, y: number, w: number, h: number, d = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    const x1 = Math.min(this.w, x + w);
    const y1 = Math.min(this.h, y + h);
    for (let yy = Math.max(0, y); yy < y1; yy++) {
      for (let xx = Math.max(0, x); xx < x1; xx++) {
        const i = yy * this.w + xx;
        this.g[i] = d;
        if (d === 0) this.v[i] = 0;
      }
    }
  }

  cerceve(x: number, y: number, w: number, h: number, d = 255): void {
    this.kutu(x + 1, y, w - 2, 1, d);
    this.kutu(x + 1, y + h - 1, w - 2, 1, d);
    this.kutu(x, y + 1, 1, h - 2, d);
    this.kutu(x + w - 1, y + 1, 1, h - 2, d);
  }

  cizgi(x0: number, y0: number, x1: number, y1: number, d = 255, vurgulu = false): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let hata = dx + dy;
    for (let n = 0; n < 2000; n++) {
      if (vurgulu) this.vurgu(x0, y0);
      else this.nokta(x0, y0, d);
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

  daire(cx: number, cy: number, r: number, d = 255, vurgulu = false): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const ddx = x - cx;
        const ddy = y - cy;
        if (ddx * ddx + ddy * ddy <= r2) {
          if (vurgulu) this.vurgu(x, y);
          else this.nokta(x, y, d);
        }
      }
    }
  }

  halka(cx: number, cy: number, r: number, d = 255): void {
    const adim = Math.max(8, Math.ceil(r * 7));
    for (let i = 0; i < adim; i++) {
      const a = (i / adim) * Math.PI * 2;
      this.nokta(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d);
    }
  }

  /** Toplamalı yumuşak ışık (tarama ile hale olur). */
  isik(cx: number, cy: number, r: number, guc: number): void {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const m = Math.hypot(x - cx, y - cy) / r;
        if (m >= 1) continue;
        const k = 1 - m;
        const i = y * this.w + x;
        const s = this.g[i] + guc * k * k;
        this.g[i] = s > 255 ? 255 : s;
      }
    }
  }

  ciz(s: Sprite, x: number, y: number, sec: SpriteSecenek = {}): void {
    x = Math.round(x);
    y = Math.round(y);
    const { ters, dik, kay, hale } = sec;
    const ton = sec.ton ?? 255;
    if (hale) {
      const hw = s.w + 2;
      for (let hy = 0; hy < s.h + 2; hy++) {
        for (let hx = 0; hx < hw; hx++) {
          if (!s.hale[hy * hw + hx]) continue;
          const sx = hx - 1;
          const sy = hy - 1;
          const k = kay ? Math.round(kay(Math.min(s.w - 1, Math.max(0, sx)))) : 0;
          if (dik) this.sil(x + sy + k, y + (s.w - 1 - sx));
          else this.sil(x + (ters ? s.w - 1 - sx : sx), y + sy + k);
        }
      }
    }
    for (let sy = 0; sy < s.h; sy++) {
      for (let sx = 0; sx < s.w; sx++) {
        const c = s.d[sy * s.w + sx];
        if (!c) continue;
        const k = kay ? Math.round(kay(sx)) : 0;
        let px: number;
        let py: number;
        if (dik) {
          px = x + sy + k;
          py = y + (s.w - 1 - sx);
        } else {
          px = x + (ters ? s.w - 1 - sx : sx);
          py = y + sy + k;
        }
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
        const i = py * this.w + px;
        if (c === 4) {
          this.v[i] = 1;
        } else {
          this.v[i] = 0;
          this.g[i] = c === 1 ? ton : c === 2 ? 0 : (ton * 0.42) | 0;
        }
      }
    }
  }

  yazi(metin: string, x: number, y: number, sec: YaziSecenek = {}): void {
    const olcek = sec.olcek ?? 1;
    const ton = sec.ton ?? 255;
    const gen = yaziGenislik(metin, olcek);
    x = Math.round(sec.hiza === 0 ? x - gen / 2 : sec.hiza === 1 ? x - gen : x);
    y = Math.round(y);
    if (sec.zemin) this.kutu(x - 2, y - 3 * olcek, gen + 4, 9 * olcek + 1, 0);
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
      for (let i = 0; i < gl.p.length; i += 2) {
        const gx = gl.p[i];
        const gy = gl.p[i + 1];
        for (let oy = 0; oy < olcek; oy++) {
          const py = y + gy * olcek + oy;
          const d = sec.tonFn ? sec.tonFn(gy * olcek + oy) : ton;
          for (let ox = 0; ox < olcek; ox++) {
            const px = cx + gx * olcek + ox;
            if (sec.vurgu) this.vurgu(px, py);
            else {
              this.nokta(px, py, d);
              if (px >= 0 && py >= 0 && px < this.w && py < this.h) this.v[py * this.w + px] = 0;
            }
          }
        }
      }
      cx += (gl.w + 1) * olcek;
    }
  }

  /** Gri tamponu 1 bite indirip görüntüye yazar. `ters`: şimşek çakması. */
  sun(hedef: Uint32Array, ters: boolean): void {
    const { w, h, g, v } = this;
    const acik = ters ? ZEMIN : MUREKKEP;
    const koyu = ters ? MUREKKEP : ZEMIN;
    let i = 0;
    for (let y = 0; y < h; y++) {
      const satir = (y & (EB - 1)) * EB;
      for (let x = 0; x < w; x++, i++) {
        hedef[i] = v[i] ? VURGU : g[i] > ESIK[satir + (x & (EB - 1))] ? acik : koyu;
      }
    }
  }
}
