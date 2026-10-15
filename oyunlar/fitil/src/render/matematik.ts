/**
 * Çizici matematik yardımcıları: yumuşatma eğrileri (GDD §12.1), yay
 * benzetimi, Perlin gürültüsü (sarsıntı yönü), renk karışımı.
 * Hepsi saf; kare başına bellek ayırmaz.
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const doyur = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

// --- Yumuşatma (§12.1) ---------------------------------------------------
export const outCubic = (t: number): number => {
  const u = 1 - doyur(t);
  return 1 - u * u * u;
};
export const inQuad = (t: number): number => {
  const u = doyur(t);
  return u * u;
};
export const inOutCubic = (t: number): number => {
  const u = doyur(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
export const outBack = (t: number, s = 1.70158): number => {
  const u = doyur(t) - 1;
  return u * u * ((s + 1) * u + s) + 1;
};
export const outQuad = (t: number): number => {
  const u = doyur(t);
  return 1 - (1 - u) * (1 - u);
};
/** 0→1→0 tepe (sinüs yarım dalga). */
export const tepe = (t: number): number => Math.sin(Math.PI * doyur(t));

/**
 * Yay (§12.1): yarı-örtük Euler, alt adım dt ≤ 1/120 s. Durum nesnesi
 * yerinde güncellenir (bellek ayırmaz). k sertlik, c sönüm, m = 1.
 */
export interface YayDurumu {
  x: number;
  v: number;
}
export function yayAdim(s: YayDurumu, hedef: number, k: number, c: number, dtSn: number): void {
  if (dtSn <= 0) return;
  const adim = Math.ceil(dtSn * 120);
  const h = dtSn / adim;
  for (let i = 0; i < adim; i++) {
    const a = -k * (s.x - hedef) - c * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
}

// --- Perlin gürültüsü (1B, tohumlu tablo) ----------------------------------
const PERM = new Uint8Array(512);
const GRAD = new Float32Array(256);
(() => {
  let s = 0x2545f491;
  const r = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) GRAD[i] = r() * 2 - 1;
})();

/** 1B Perlin gürültüsü, yaklaşık −1..1. `kanal` farklı akışlar için kaydırma. */
export function perlin1(x: number, kanal = 0): number {
  const xi = Math.floor(x);
  const f = x - xi;
  const a = PERM[(xi + kanal * 57) & 255];
  const b = PERM[(xi + 1 + kanal * 57) & 255];
  const g0 = GRAD[a] * f;
  const g1 = GRAD[b] * (f - 1);
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return (g0 + (g1 - g0) * u) * 2;
}

/** 2B değer gürültüsü (ahşap damarı, is bulutu kenarı), 0..1. */
export function gurultu2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  // Satır içi karma (çağrı başına kapanış nesnesi yok: sandık/gök pişirmede yüz binlerce çağrı).
  const p0 = PERM[xi & 255];
  const p1 = PERM[(xi + 1) & 255];
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = PERM[(p0 + yi) & 511] / 255;
  const b = PERM[(p1 + yi) & 511] / 255;
  const c = PERM[(p0 + yi + 1) & 511] / 255;
  const d = PERM[(p1 + yi + 1) & 511] / 255;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Hücre/tohum için hızlı karma → 0..1 (titreşim fazı vb.). */
export function karma01(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

// --- Renk ---------------------------------------------------------------
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbHex(c: RGB): string {
  const f = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${f(c.r)}${f(c.g)}${f(c.b)}`;
}

export function karistir(a: string, b: string, t: number): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex({ r: lerp(x.r, y.r, t), g: lerp(x.g, y.g, t), b: lerp(x.b, y.b, t) });
}

export function rgba(hex: string, a: number): string {
  const c = hexRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

/** Doygunluğu `oran` katına indir (ıslak barut: %40). */
export function doygunluk(hex: string, oran: number): string {
  const c = hexRgb(hex);
  const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return rgbHex({ r: lerp(l, c.r, oran), g: lerp(l, c.g, oran), b: lerp(l, c.b, oran) });
}

/** HSL → hex (gökkuşağı tonları için). */
export function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

/** İkinci dereceden Bezier noktası (bir eksen). */
export const bezier2 = (a: number, c: number, b: number, t: number): number => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
};
