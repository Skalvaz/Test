/**
 * Örgülü ip çizimi (GDD §13.3): iki sinüs ofsetli çizgi (genlik 0,12·kalınlık,
 * dalga boyu 10 px) açık ve koyu sırayla çizilir; üstüne `lighter` parıltı.
 * Fitil, yanan fitil, barut izi ve hayalet fitil bunu kullanır.
 *
 * Yol düğüm merkezlerinden geçer; köşeler ikinci dereceden eğriyle
 * yumuşatılır ve ~2,5 px aralıkla örneklenir. Önceden ayrılmış tamponlar:
 * kare başına bellek ayırma yok.
 */
import type { Ctx } from './tuval';

const EN_FAZLA = 4096;

export interface IpRenkleri {
  /** Taban (gövde) rengi. */
  ana: string | CanvasGradient;
  /** Açık iplik. */
  acik: string | CanvasGradient;
  /** Koyu iplik. */
  koyu: string | CanvasGradient;
  /** Parıltı rengi (`lighter`); null = parıltı yok. */
  parilti: string | CanvasGradient | null;
}

export class IpCizici {
  /** Örnek noktaları (x, y) ve yay uzunluğu s. */
  readonly px = new Float32Array(EN_FAZLA);
  readonly py = new Float32Array(EN_FAZLA);
  readonly s = new Float32Array(EN_FAZLA);
  readonly nx = new Float32Array(EN_FAZLA);
  readonly ny = new Float32Array(EN_FAZLA);
  n = 0;
  uzunluk = 0;
  /** Her düğümün örnek indeksi ve yay uzunluğu. */
  readonly dugumS = new Float32Array(256);
  dugumSayi = 0;

  /**
   * Düğüm merkezlerinden örnekle. `xs/ys` düğüm konumları (px). `kapali`:
   * son düğümden ilk düğüme kapanır (halka). `yuvarlak`: köşe yarıçapı px.
   */
  ornekle(xs: ArrayLike<number>, ys: ArrayLike<number>, sayi: number, kapali: boolean, yuvarlak: number, adim = 2.5): void {
    this.n = 0;
    this.uzunluk = 0;
    this.dugumSayi = 0;
    if (sayi <= 0) return;
    if (sayi === 1) {
      this.ekle(xs[0], ys[0]);
      this.dugumS[this.dugumSayi++] = 0;
      return;
    }
    const top = kapali ? sayi + 1 : sayi;
    const X = (i: number) => xs[i % sayi];
    const Y = (i: number) => ys[i % sayi];
    this.ekle(X(0), Y(0));
    this.dugumS[this.dugumSayi++] = 0;
    for (let i = 1; i < top; i++) {
      const ax = X(i - 1);
      const ay = Y(i - 1);
      const bx = X(i);
      const by = Y(i);
      const kose = i < top - 1;
      if (!kose) {
        this.cizgi(ax, ay, bx, by, adim);
        if (this.dugumSayi < 256) this.dugumS[this.dugumSayi++] = this.uzunluk;
        continue;
      }
      const cx = X(i + 1);
      const cy = Y(i + 1);
      const l1 = Math.hypot(bx - ax, by - ay);
      const l2 = Math.hypot(cx - bx, cy - by);
      const r = Math.min(yuvarlak, l1 * 0.45, l2 * 0.45);
      const p1x = bx + ((ax - bx) / (l1 || 1)) * r;
      const p1y = by + ((ay - by) / (l1 || 1)) * r;
      const p2x = bx + ((cx - bx) / (l2 || 1)) * r;
      const p2y = by + ((cy - by) / (l2 || 1)) * r;
      this.cizgi(this.px[this.n - 1], this.py[this.n - 1], p1x, p1y, adim);
      // Köşe eğrisi; düğüm, eğrinin ortası sayılır.
      const egriL = Math.hypot(p1x - bx, p1y - by) + Math.hypot(p2x - bx, p2y - by);
      const k = Math.max(2, Math.ceil(egriL / adim));
      for (let j = 1; j <= k; j++) {
        const t = j / k;
        const u = 1 - t;
        this.ekle(u * u * p1x + 2 * u * t * bx + t * t * p2x, u * u * p1y + 2 * u * t * by + t * t * p2y);
        if (j === Math.ceil(k / 2) && this.dugumSayi < 256) this.dugumS[this.dugumSayi++] = this.uzunluk;
      }
    }
    this.normaller();
  }

  private ekle(x: number, y: number): void {
    if (this.n >= EN_FAZLA) return;
    if (this.n > 0) this.uzunluk += Math.hypot(x - this.px[this.n - 1], y - this.py[this.n - 1]);
    this.px[this.n] = x;
    this.py[this.n] = y;
    this.s[this.n] = this.uzunluk;
    this.n++;
  }

  private cizgi(ax: number, ay: number, bx: number, by: number, adim: number): void {
    const L = Math.hypot(bx - ax, by - ay);
    const k = Math.max(1, Math.ceil(L / adim));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      this.ekle(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }

  private normaller(): void {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let dx = this.px[b] - this.px[a];
      let dy = this.py[b] - this.py[a];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      this.nx[i] = -dy;
      this.ny[i] = dx;
    }
  }

  /** s0..s1 aralığındaki örnek indeksleri. */
  private aralik(s0: number, s1: number): [number, number] {
    let a = 0;
    while (a < this.n - 1 && this.s[a + 1] <= s0) a++;
    let b = a;
    while (b < this.n - 1 && this.s[b] < s1) b++;
    return [a, b];
  }

  /** Merkez çizgiyi yol olarak kur (s0..s1). */
  private merkez(c: Ctx, a: number, b: number, kay = 0): void {
    c.beginPath();
    c.moveTo(this.px[a] + this.nx[a] * kay, this.py[a] + this.ny[a] * kay);
    for (let i = a + 1; i <= b; i++) c.lineTo(this.px[i] + this.nx[i] * kay, this.py[i] + this.ny[i] * kay);
  }

  /** s yay uzunluğundaki nokta (yazılır). */
  noktaAl(s: number, cikis: { x: number; y: number }): void {
    if (this.n === 0) return;
    if (s <= 0) {
      cikis.x = this.px[0];
      cikis.y = this.py[0];
      return;
    }
    let i = 0;
    while (i < this.n - 1 && this.s[i + 1] < s) i++;
    if (i >= this.n - 1) {
      cikis.x = this.px[this.n - 1];
      cikis.y = this.py[this.n - 1];
      return;
    }
    const d = this.s[i + 1] - this.s[i] || 1;
    const t = (s - this.s[i]) / d;
    cikis.x = this.px[i] + (this.px[i + 1] - this.px[i]) * t;
    cikis.y = this.py[i] + (this.py[i + 1] - this.py[i]) * t;
  }

  /**
   * Örgülü ipi çiz (s0..s1). `faz`: örgü kayması (px), kalın: px.
   * `parilti`: lighter geçişinin alfası (0 = yok).
   */
  ciz(c: Ctx, s0: number, s1: number, kalin: number, renk: IpRenkleri, faz: number, parilti: number): void {
    if (this.n < 2 || s1 <= s0) return;
    const [a, b] = this.aralik(s0, s1);
    if (b <= a) return;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // Parıltı (lighter): iki geniş, saydam geçiş.
    if (parilti > 0 && renk.parilti) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = renk.parilti;
      c.globalAlpha = 0.12 * parilti;
      c.lineWidth = kalin * 3.6;
      this.merkez(c, a, b);
      c.stroke();
      c.globalAlpha = 0.24 * parilti;
      c.lineWidth = kalin * 2.1;
      c.stroke();
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    // Koyu kenar (okunurluk) + gövde
    c.strokeStyle = 'rgba(20,8,2,0.62)';
    c.lineWidth = kalin + 3;
    this.merkez(c, a, b);
    c.stroke();
    c.strokeStyle = renk.ana;
    c.lineWidth = kalin;
    c.stroke();
    // İplikler: iki sinüs ofsetli iplik, açık ve koyu sırayla üst üste (örgü).
    // Genlik 0,12·kalınlık iplik merkezinin kayması + iplik yarı genişliği
    // (örgü ancak böyle okunuyor); dalga boyu 10 px, kalın fitilde biraz uzar.
    const A = 0.12 * kalin + kalin * 0.13;
    const k = (Math.PI * 2) / Math.max(10, kalin * 1.35);
    const ip = Math.max(1.2, kalin * 0.48);
    // Koyu iplik (tam) → açık iplik (üstteyken, koyu kenarlı) → koyu iplik (üstteyken).
    this.iplik(c, a, b, A, k, faz + Math.PI, ip, renk.koyu, 0);
    this.iplik(c, a, b, A, k, faz, ip + 1.2, 'rgba(20,8,2,0.28)', 1);
    this.iplik(c, a, b, A, k, faz, ip, renk.acik, 1);
    this.iplik(c, a, b, A, k, faz + Math.PI, ip + 1.2, 'rgba(20,8,2,0.28)', -1);
    this.iplik(c, a, b, A, k, faz + Math.PI, ip, renk.koyu, -1);
    // Silindir parlaması
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = Math.max(0.8, kalin * 0.16);
    this.merkez(c, a, b, -kalin * 0.26);
    c.stroke();
  }

  /** Tek iplik: `ust` 0 = hep, 1 = cos>0 yarı, −1 = cos<0 yarı. */
  private iplik(c: Ctx, a: number, b: number, A: number, k: number, faz: number, gen: number, renk: string | CanvasGradient, ust: number): void {
    c.strokeStyle = renk;
    c.lineWidth = gen;
    c.beginPath();
    let acik = false;
    for (let i = a; i <= b; i++) {
      const ph = this.s[i] * k + faz;
      const on = ust === 0 || (ust > 0 ? Math.cos(ph) > 0 : Math.cos(ph) < 0);
      if (!on) {
        acik = false;
        continue;
      }
      const o = A * Math.sin(ph);
      const x = this.px[i] + this.nx[i] * o;
      const y = this.py[i] + this.ny[i] * o;
      if (acik) c.lineTo(x, y);
      else c.moveTo(x, y);
      acik = true;
    }
    c.stroke();
  }

  /**
   * Yanmış kısım (s0..s1): kömür gövde + başa yakın sönen köz parıltısı.
   * `bas`: alev başının s değeri.
   */
  cizYanmis(c: Ctx, s0: number, s1: number, kalin: number, bas: number, sonum: number): void {
    if (this.n < 2 || s1 <= s0) return;
    const [a, b] = this.aralik(s0, s1);
    if (b <= a) return;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.globalAlpha = sonum;
    c.strokeStyle = 'rgba(30,22,20,0.9)';
    c.lineWidth = kalin * 0.7;
    this.merkez(c, a, b);
    c.stroke();
    c.globalAlpha = 1;
    // Köz: başa yakın parçalar sıcak, uzaklaştıkça söner (parça parça çizilir).
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = '#FF7A1A';
    c.lineWidth = kalin * 0.55;
    const parca = 6;
    for (let i = a; i < b; i += parca) {
      const d = bas - this.s[i];
      const al = Math.exp(-d / 46) * sonum;
      if (al < 0.03) continue;
      c.globalAlpha = Math.min(1, al);
      c.beginPath();
      c.moveTo(this.px[i], this.py[i]);
      const j = Math.min(b, i + parca);
      for (let q = i + 1; q <= j; q++) c.lineTo(this.px[q], this.py[q]);
      c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /** Kesik/düz tek çizgi (hayalet fitil, ışık turu). */
  cizInce(c: Ctx, s0: number, s1: number, gen: number, renk: string, kesik: boolean): void {
    if (this.n < 2 || s1 <= s0) return;
    const [a, b] = this.aralik(s0, s1);
    if (b <= a) return;
    c.strokeStyle = renk;
    c.lineWidth = gen;
    c.lineCap = 'round';
    if (kesik) c.setLineDash(KESIK);
    this.merkez(c, a, b);
    c.stroke();
    if (kesik) c.setLineDash(DUZ);
  }
}

export const KESIK = [7, 6];
export const DUZ: number[] = [];
