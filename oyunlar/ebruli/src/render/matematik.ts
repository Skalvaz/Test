/**
 * Çizici matematiği (GDD §10.1): yumuşatma eğrileri, yay, karma gürültü.
 * DOM yok; vitest'te sınanır. Görsel rastgelelik çekirdeğin RNG'sine
 * dokunmaz: burada yalnız konumdan türeyen karma (hash) kullanılır.
 */
export const TAU = Math.PI * 2;

export const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const sinirla01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ara = (a: number, b: number, t: number): number => a + (b - a) * t;

export const outCubic = (t: number): number => {
  const u = 1 - sinirla01(t);
  return 1 - u * u * u;
};
export const inQuad = (t: number): number => {
  const u = sinirla01(t);
  return u * u;
};
export const inCubic = (t: number): number => {
  const u = sinirla01(t);
  return u * u * u;
};
export const inOutCubic = (t: number): number => {
  const u = sinirla01(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
export const outQuad = (t: number): number => {
  const u = sinirla01(t);
  return 1 - (1 - u) * (1 - u);
};
/** outBack (s = 1,70158): hedefi biraz aşıp geri gelir. */
export const outBack = (t: number, s = 1.70158): number => {
  const u = sinirla01(t) - 1;
  return 1 + u * u * ((s + 1) * u + s);
};
/** Yumuşak tepe: 0 → 1 → 0 (sinüs yarım dalga). */
export const tepe = (t: number): number => Math.sin(Math.PI * sinirla01(t));

/** Yay (§10.1: k = 380, c = 20, m = 1), yarı örtük Euler; dt ≤ 1/120 s alt adımlarla. */
export interface Yay {
  x: number;
  v: number;
}
export function yayAdim(y: Yay, hedef: number, dtMs: number, k = 380, c = 20): void {
  let kalan = dtMs / 1000;
  while (kalan > 1e-6) {
    const dt = Math.min(1 / 120, kalan);
    kalan -= dt;
    const a = -k * (y.x - hedef) - c * y.v;
    y.v += a * dt;
    y.x += y.v * dt;
  }
}

/** 32 bit karma → [0, 1). Aynı girdi aynı sonucu verir (konum tohumlu görsel çeşitlilik). */
export function karma01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tek boyutlu yumuşak gürültü (değer gürültüsü, kosinüs ara değer) → [−1, 1]. */
export function gurultu1(x: number, tohum = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = karma01(i, tohum) * 2 - 1;
  const b = karma01(i + 1, tohum) * 2 - 1;
  const u = (1 - Math.cos(f * Math.PI)) / 2;
  return a + (b - a) * u;
}

/** İki boyutlu değer gürültüsü → [0, 1]. */
export function gurultu2(x: number, y: number, tohum = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = karma01(ix, iy, tohum);
  const b = karma01(ix + 1, iy, tohum);
  const c = karma01(ix, iy + 1, tohum);
  const d = karma01(ix + 1, iy + 1, tohum);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Kübik Bezier noktası (tek eksen). */
export function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** İkinci dereceden Bezier noktası (tek eksen). */
export function bezier2(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}
