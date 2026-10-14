/**
 * İkili min-yığın (§3.5 kuyruğu). Anahtar (t, y, x, sıra): önce zaman, sonra
 * satır (yukarıdan aşağı), sonra sütun (soldan sağa), sonra ekleme sırası.
 * Aynı anda olan olaylar bu sırayla işlenir; sonuç tamamen belirlenimlidir.
 */
export interface YiginAnahtari {
  t: number;
  y: number;
  x: number;
  sira: number;
}

/** a, b'den önce mi işlenir? */
export function once(a: YiginAnahtari, b: YiginAnahtari): boolean {
  if (a.t !== b.t) return a.t < b.t;
  if (a.y !== b.y) return a.y < b.y;
  if (a.x !== b.x) return a.x < b.x;
  return a.sira < b.sira;
}

export class MinYigin<T extends YiginAnahtari> {
  private readonly a: T[] = [];

  get boyut(): number {
    return this.a.length;
  }

  ekle(o: T): void {
    const a = this.a;
    a.push(o);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!once(a[i], a[p])) break;
      const g = a[i];
      a[i] = a[p];
      a[p] = g;
      i = p;
    }
  }

  al(): T | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const ust = a[0];
    const son = a.pop() as T;
    if (a.length > 0) {
      a[0] = son;
      let i = 0;
      const n = a.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let k = i;
        if (l < n && once(a[l], a[k])) k = l;
        if (r < n && once(a[r], a[k])) k = r;
        if (k === i) break;
        const g = a[i];
        a[i] = a[k];
        a[k] = g;
        i = k;
      }
    }
    return ust;
  }
}
