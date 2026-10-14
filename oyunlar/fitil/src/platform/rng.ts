/**
 * Tohumlu, deterministik rastgele sayı üreteci (sfc32).
 *
 * Oyun mantığındaki her rastgelelik buradan gelir: aynı tohum ve aynı
 * hamleler aynı tahtayı üretir. Bu sayede bölümler bot ile tekrar tekrar
 * oynatılıp ölçülebilir ve günlük meydan okuma herkes için aynı olur.
 * Durum dört 32 bitlik sayıdır; `state()` / `fromState()` ile saklanabilir.
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string = 1) {
    const s = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    // splitmix32 ile dört kelimeyi doldur; sıfır durumdan kaçın.
    let x = s || 0x9e3779b9;
    const next = () => {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  static fromState(st: readonly [number, number, number, number]): Rng {
    const r = new Rng(1);
    [r.a, r.b, r.c, r.d] = st.map((v) => v >>> 0) as [number, number, number, number];
    return r;
  }

  state(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  clone(): Rng {
    return Rng.fromState(this.state());
  }

  /** 32 bitlik işaretsiz tamsayı. */
  nextU32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** [0, 1) aralığında sayı. */
  float(): number {
    return this.nextU32() / 4294967296;
  }

  /** [0, n) aralığında tamsayı (n > 0). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** [lo, hi] aralığında tamsayı. */
  range(lo: number, hi: number): number {
    return lo + this.int(hi - lo + 1);
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Yerinde Fisher–Yates karıştırma. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Ağırlıklı seçim; ağırlıklar negatif olmamalı, toplam > 0. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}

/** FNV-1a 32 bit; dize tohumlar (ör. "gunluk-2026-10-14") için. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
