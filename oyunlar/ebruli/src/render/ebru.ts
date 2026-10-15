/**
 * Ebru modeli (GDD §9.3) — saf matematik, DOM yok, vitest'te sınanır.
 *
 * Su yüzeyindeki boya, oluşum sırasıyla çokgenlerden oluşur (her boya lekesi
 * bir çokgen: `Float32Array` köşe dizisi x0,y0,x1,y1…). Ebrunun iki temel
 * hareketi alanı koruyan dönüşümlerdir (Jaffer & Lu, "Mathematical
 * Marbling"):
 *
 *  - Damla bırakma (merkez c, yarıçap r): bütün eski köşeler
 *    p' = c + (p − c)·√(1 + r²/|p − c|²) ile itilir; yeni çokgen bir daire.
 *  - Tarama (biz/tarak hattı L, birim yön m, normal n):
 *    p' = p + z·u^(|(p − L)·n| / ℓ)·m, u = 0,5.
 *  - Biz çekme (yalnız bir doğru parçası boyunca; çiçek ebrusu): aynı
 *    düşüş, parçanın dışında yumuşak sönümle.
 *  - Girdap (bülbül yuvası): merkeze uzaklık d, açı θ(d) = a·e^(−d/s).
 *  - Sinüs kayması (şal): p' = p + A·sin(2π(p·n)/λ + φ)·m.
 *
 * Her işlemden sonra yeniden örnekleme: kenar > 6 px ise ortadan bölünür,
 * < 1,5 px ise birleştirilir. Çokgen başına ≤ 600, toplam ≤ 15 000 köşe;
 * aşılırsa en eski çokgenler dondurulur (dönüşür ama örneklenmez).
 */

export interface Cokgen {
  /** x0,y0,x1,y1… (CSS px, tablo koordinatı). */
  k: Float32Array;
  /** Köşe sayısı. */
  n: number;
  /** Dolgu rengi (#rrggbb). */
  renk: string;
  /** Kenar (damar) rengi. */
  kenar: string;
  /** Dondurulmuş: dönüşür ama yeniden örneklenmez. */
  donuk: boolean;
}

export interface EbruSinirlari {
  bolMax: number;
  birlesMin: number;
  cokgenMax: number;
  toplamMax: number;
}

export const SINIR_TAM: EbruSinirlari = { bolMax: 6, birlesMin: 1.5, cokgenMax: 600, toplamMax: 15000 };
/** Zayıf cihaz (§9.3 sade mod): 32 köşeli daire, toplam ≤ 6 000. */
export const SINIR_SADE: EbruSinirlari = { bolMax: 9, birlesMin: 2.2, cokgenMax: 300, toplamMax: 6000 };

/** Yeniden örnekleme için paylaşılan tampon (her çağrıda ayırma yok). */
let TAMPON = new Float64Array(4096);

export class EbruModeli {
  readonly cokgenler: Cokgen[] = [];
  /** Yeni dairenin en çok köşe sayısı (sade modda 32). */
  daireKose: number;

  constructor(readonly sinir: EbruSinirlari = SINIR_TAM) {
    this.daireKose = sinir === SINIR_SADE ? 32 : 64;
  }

  koseSayisi(): number {
    let n = 0;
    for (const c of this.cokgenler) n += c.n;
    return n;
  }

  /** Bütün köşelere nokta dönüşümü uygular (yerinde). */
  private donustur(f: (x: number, y: number, out: Float64Array) => void): void {
    const o = new Float64Array(2);
    for (const c of this.cokgenler) {
      const k = c.k;
      for (let i = 0; i < c.n; i++) {
        f(k[2 * i], k[2 * i + 1], o);
        k[2 * i] = o[0];
        k[2 * i + 1] = o[1];
      }
    }
  }

  /** Damla bırak: eskileri iter, (cx, cy) merkezli r yarıçaplı yeni daire ekler. */
  damla(cx: number, cy: number, r: number, renk: string, kenar: string): void {
    const r2 = r * r;
    this.donustur((x, y, o) => {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-9) {
        o[0] = cx + r;
        o[1] = cy;
        return;
      }
      const s = Math.sqrt(1 + r2 / d2);
      o[0] = cx + dx * s;
      o[1] = cy + dy * s;
    });
    const n = Math.max(16, Math.min(this.daireKose, Math.round((2 * Math.PI * r) / 4)));
    const k = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      k[2 * i] = cx + Math.cos(a) * r;
      k[2 * i + 1] = cy + Math.sin(a) * r;
    }
    this.cokgenler.push({ k, n, renk, kenar, donuk: false });
    this.yenidenOrnekle();
  }

  /**
   * Tarama (sonsuz hat): hat (lx, ly) noktasından geçer, yönü (mx, my) birim.
   * p' = p + z·u^(|(p − L)·n| / ℓ)·m.
   */
  tarama(lx: number, ly: number, mx: number, my: number, z: number, l: number, u = 0.5, ornekle = true): void {
    const nx = -my;
    const ny = mx;
    const lnu = Math.log(u);
    this.donustur((x, y, o) => {
      const d = Math.abs((x - lx) * nx + (y - ly) * ny);
      const f = z * Math.exp((lnu * d) / l);
      o[0] = x + f * mx;
      o[1] = y + f * my;
    });
    if (ornekle) this.yenidenOrnekle();
  }

  /** Biz çekme: (ax, ay) → (bx, by) parçası boyunca, uçlarda yumuşak sönümle. */
  biz(ax: number, ay: number, bx: number, by: number, z: number, l: number, u = 0.5): void {
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const mx = (bx - ax) / L;
    const my = (by - ay) / L;
    const nx = -my;
    const ny = mx;
    const lnu = Math.log(u);
    this.donustur((x, y, o) => {
      const t = (x - ax) * mx + (y - ay) * my;
      const d = Math.abs((x - ax) * nx + (y - ay) * ny);
      // Parçanın dışında uzaklık uçtan ölçülür.
      const dis = t < 0 ? -t : t > L ? t - L : 0;
      const f = z * Math.exp((lnu * (d + dis * 1.5)) / l);
      o[0] = x + f * mx;
      o[1] = y + f * my;
    });
    this.yenidenOrnekle();
  }

  /** Girdap: merkeze uzaklık d için θ(d) = a·e^(−d/s) radyan döndürme. */
  girdap(cx: number, cy: number, a: number, s: number): void {
    this.donustur((x, y, o) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = a * Math.exp(-d / s);
      const co = Math.cos(t);
      const si = Math.sin(t);
      o[0] = cx + dx * co - dy * si;
      o[1] = cy + dx * si + dy * co;
    });
    this.yenidenOrnekle();
  }

  /** Sinüs kayması: p' = p + A·sin(2π(p·n)/λ + φ)·m (m ⟂ n). */
  sinus(mx: number, my: number, A: number, lambda: number, faz: number): void {
    const nx = -my;
    const ny = mx;
    const w = (Math.PI * 2) / lambda;
    this.donustur((x, y, o) => {
      const f = A * Math.sin(w * (x * nx + y * ny) + faz);
      o[0] = x + f * mx;
      o[1] = y + f * my;
    });
    this.yenidenOrnekle();
  }

  /** Kenar > bolMax → böl; < birlesMin → birleştir. Bütçe aşılırsa eskileri dondur. */
  yenidenOrnekle(): void {
    const s = this.sinir;
    const bol2 = s.bolMax * s.bolMax;
    const birles2 = s.birlesMin * s.birlesMin;
    for (const c of this.cokgenler) {
      if (c.donuk) continue;
      const k = c.k;
      const n = c.n;
      // Hızlı yol: değişecek kenar yoksa dokunma (çoğu çokgen).
      let gerek = false;
      {
        let qx = k[2 * (n - 1)];
        let qy = k[2 * (n - 1) + 1];
        for (let i = 0; i < n; i++) {
          const x = k[2 * i];
          const y = k[2 * i + 1];
          const d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
          if (d2 > bol2 || (d2 < birles2 && n > 8)) {
            gerek = true;
            break;
          }
          qx = x;
          qy = y;
        }
      }
      if (!gerek) continue;
      // Önce birleştir (çok kısa kenarlar), sonra böl. Paylaşılan tampona yaz.
      let tmp = TAMPON;
      if (tmp.length < (n * 9 + 16) * 2) tmp = TAMPON = new Float64Array((n * 9 + 16) * 2);
      let m2 = 0;
      let kalan = n;
      let px = k[2 * (n - 1)];
      let py = k[2 * (n - 1) + 1];
      for (let i = 0; i < n; i++) {
        const x = k[2 * i];
        const y = k[2 * i + 1];
        const dx = x - px;
        const dy = y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < birles2 && kalan > 8 && m2 >= 2) {
          kalan--;
          continue;
        }
        if (d2 > bol2 && m2 / 2 + (n - i) < s.cokgenMax) {
          // Gerekirse birden çok parçaya böl.
          const parca = Math.min(8, Math.ceil(Math.sqrt(d2) / s.bolMax));
          for (let j = 1; j < parca; j++) {
            tmp[m2++] = px + (dx * j) / parca;
            tmp[m2++] = py + (dy * j) / parca;
          }
        }
        tmp[m2++] = x;
        tmp[m2++] = y;
        px = x;
        py = y;
      }
      const m = m2 / 2;
      if (m < 3) continue;
      c.k = Float32Array.from(tmp.subarray(0, m2));
      c.n = m;
    }
    // Toplam bütçe: en eskiden başlayarak dondur.
    let toplam = this.koseSayisi();
    for (const c of this.cokgenler) {
      if (toplam <= s.toplamMax) break;
      if (!c.donuk) {
        c.donuk = true;
        // Dondurulan çokgeni seyrelt (her ikinci köşe), bütçeye yer aç.
        if (c.n > 48) {
          const yeni = new Float32Array(Math.ceil(c.n / 2) * 2);
          let j = 0;
          for (let i = 0; i < c.n; i += 2) {
            yeni[j++] = c.k[2 * i];
            yeni[j++] = c.k[2 * i + 1];
          }
          toplam -= c.n - j / 2;
          c.k = yeni;
          c.n = j / 2;
        }
      }
    }
  }

  /** Köşe karması (belirlenimlilik testi): FNV-1a, 0,01 px'e yuvarlanmış. */
  karma(): number {
    let h = 0x811c9dc5;
    for (const c of this.cokgenler) {
      for (let i = 0; i < c.n * 2; i++) {
        const v = Math.round(c.k[i] * 100) | 0;
        h ^= v & 0xff;
        h = Math.imul(h, 0x01000193);
        h ^= (v >>> 8) & 0xff;
        h = Math.imul(h, 0x01000193);
        h ^= (v >>> 16) & 0xff;
        h = Math.imul(h, 0x01000193);
      }
      for (let i = 0; i < c.renk.length; i++) {
        h ^= c.renk.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
    }
    return h >>> 0;
  }
}

/** mulberry32 (tablo tohumu): [0, 1). */
export function tabloRng(tohum: number): () => number {
  let s = tohum >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
