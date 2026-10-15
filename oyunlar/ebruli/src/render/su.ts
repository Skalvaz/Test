/**
 * Su (tekne) katmanı (GDD §11.4, §9.3 sudaki canlı iz).
 *
 *  - Arka plan (offscreen, yeniden boyutlanmada): bütün tuvali kaplayan
 *    atölye suyu (dikey gradyan), kenar kararması; tekne içinde pencereden
 *    vuran yumuşak ışık.
 *  - Dalga dokusu: 256×256 tohumlu, dikişsiz döşenen dalga çizgileri;
 *    tekne içinde iki katman farklı yönlere yavaşça kayar (alfa ~0,08).
 *    Düşük kalitede durağan.
 *  - Canlı iz: her eşleşme suya silik bir ebru halkası damgalar; bölüm
 *    boyunca birikir (tablonun silik ön izlemesi). Damgalar listede tutulur,
 *    yeniden boyutlanmada yeniden basılır.
 */
import type { Ctx, Tuval } from './tuval';
import { tuvalOlustur } from './tuval';
import { karma01, TAU } from './matematik';
import { hexRgb, karistir, rgba } from './palet';
import type { Dikdortgen } from '../app/sozlesme';

export interface SuRenkleri {
  ust: string;
  alt: string;
  parilti: string;
}

interface IzDamgasi {
  /** Tahta koordinatı (hücre biriminde, merkez). */
  x: number;
  y: number;
  renk: string;
  boyut: number;
  tohum: number;
}

export class SuKatmani {
  private arka: Tuval | null = null;
  private doku: Tuval | null = null;
  private desen: CanvasPattern | null = null;
  private iz: Tuval | null = null;
  private izCtx: Ctx | null = null;
  private izler: IzDamgasi[] = [];
  private W = 0;
  private H = 0;
  private dpr = 1;
  private tekne: Dikdortgen = { x: 0, y: 0, w: 0, h: 0 };
  private hucre = 40;
  private renk: SuRenkleri = { ust: '#0B2B2E', alt: '#0A1E33', parilti: '#1F4D4F' };
  private anahtar = '';

  /** Sahne boyutu, tekne (tahta) dikdörtgeni ve su renkleri. Anahtar değişirse yeniden pişer. */
  ayarla(W: number, H: number, dpr: number, tekne: Dikdortgen, hucre: number, renk: SuRenkleri): void {
    const k = `${W}|${H}|${dpr}|${tekne.x}|${tekne.y}|${tekne.w}|${tekne.h}|${renk.ust}|${renk.alt}`;
    if (k === this.anahtar) return;
    this.anahtar = k;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.tekne = { ...tekne };
    this.hucre = hucre;
    this.renk = renk;
    this.arkaPisir();
    if (!this.doku) this.dokuPisir();
    this.izPisir();
  }

  private arkaPisir(): void {
    const { W, H, dpr } = this;
    const { tuval, ctx: c } = tuvalOlustur(W * dpr, H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.renk.ust);
    g.addColorStop(1, this.renk.alt);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // Tekne içinde pencereden vuran ışık: üst ortada yumuşak parıltı.
    const t = this.tekne;
    const cx = t.x + t.w * 0.42;
    const cy = t.y + t.h * 0.18;
    const R = Math.max(t.w, t.h) * 0.9;
    const p = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    p.addColorStop(0, rgba(this.renk.parilti, 0.55));
    p.addColorStop(0.5, rgba(this.renk.parilti, 0.16));
    p.addColorStop(1, rgba(this.renk.parilti, 0));
    c.fillStyle = p;
    c.fillRect(0, 0, W, H);
    // Kenar kararması (vinyet).
    const v = c.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,4,10,0.55)');
    c.fillStyle = v;
    c.fillRect(0, 0, W, H);
    // Çok hafif tohumlu ışık lekeleri (su yüzeyi canlı dursun).
    const acik = karistir(hexRgb(this.renk.parilti), [255, 255, 255], 0.25);
    for (let i = 0; i < 40; i++) {
      const x = karma01(i, 3) * W;
      const y = karma01(i, 7) * H;
      const r = 20 + karma01(i, 11) * 90;
      const lg = c.createRadialGradient(x, y, 0, x, y, r);
      lg.addColorStop(0, rgba(acik, 0.035));
      lg.addColorStop(1, rgba(acik, 0));
      c.fillStyle = lg;
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    this.arka = tuval;
  }

  /** 256×256 dikişsiz dalga dokusu (DPR'siz; desen olarak döşenir). */
  private dokuPisir(): void {
    const N = 256;
    const { tuval, ctx: c } = tuvalOlustur(N, N);
    c.lineCap = 'round';
    const cizgi = (y0: number, n: number, A: number, faz: number, kal: number, a: number) => {
      for (const dy of [-N, 0, N]) {
        c.beginPath();
        for (let x = -4; x <= N + 4; x += 4) {
          const y = y0 + dy + A * Math.sin((x / N) * TAU * n + faz) + A * 0.4 * Math.sin((x / N) * TAU * (n + 2) + faz * 1.7);
          if (x === -4) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.lineWidth = kal * 3;
        c.strokeStyle = `rgba(220,245,240,${a * 0.25})`;
        c.stroke();
        c.lineWidth = kal;
        c.strokeStyle = `rgba(235,252,248,${a})`;
        c.stroke();
      }
    };
    for (let i = 0; i < 22; i++) {
      const y0 = karma01(i, 101) * N;
      const n = 1 + Math.floor(karma01(i, 102) * 3);
      const A = 3 + karma01(i, 103) * 8;
      cizgi(y0, n, A, karma01(i, 104) * TAU, 0.8 + karma01(i, 105) * 1.6, 0.35 + karma01(i, 106) * 0.5);
    }
    this.doku = tuval;
    this.desen = null;
  }

  private izPisir(): void {
    const t = this.tekne;
    const { tuval, ctx } = tuvalOlustur(t.w * this.dpr, t.h * this.dpr);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.iz = tuval;
    this.izCtx = ctx;
    for (const d of this.izler) this.damgaBas(d);
  }

  /** Bölüm başında: canlı izi sil. */
  izSifirla(): void {
    this.izler.length = 0;
    if (this.iz && this.izCtx) {
      this.izCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.izCtx.clearRect(0, 0, this.iz.width, this.iz.height);
      this.izCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  /** Canlı iz damgası: tahta hücre koordinatında (x, y merkez), renk, grup boyu. */
  izEkle(x: number, y: number, renk: string, boyut: number): void {
    const d: IzDamgasi = { x, y, renk, boyut, tohum: this.izler.length * 31 + 7 };
    this.izler.push(d);
    if (this.izler.length > 400) this.izler.shift();
    this.damgaBas(d);
  }

  private damgaBas(d: IzDamgasi): void {
    const c = this.izCtx;
    if (!c) return;
    const h = this.hucre;
    const cx = (d.x + 0.5) * h;
    const cy = (d.y + 0.5) * h;
    const r = h * (0.8 + 0.18 * Math.sqrt(Math.max(1, d.boyut - 2)));
    // Ebru damlası: dolgu + iki ince halka (silik).
    const g = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, rgba(d.renk, 0.05));
    g.addColorStop(0.85, rgba(d.renk, 0.075));
    g.addColorStop(1, rgba(d.renk, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, TAU);
    c.fill();
    c.lineWidth = Math.max(0.8, h * 0.02);
    for (const k of [0.62, 0.86]) {
      c.strokeStyle = rgba(d.renk, 0.1);
      c.beginPath();
      // Hafif dalgalı halka (ebru boyası hiç tam daire değildir).
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const rr = r * k * (1 + 0.05 * Math.sin(a * 3 + d.tohum) + 0.03 * Math.sin(a * 5 + d.tohum * 1.3));
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }

  /** Arka plan + kayan dalgalar + canlı iz. `akis` false ise doku durağan. */
  ciz(c: Ctx, zamanMs: number, akis: boolean): void {
    if (this.arka) c.drawImage(this.arka, 0, 0, this.W, this.H);
    const t = this.tekne;
    if (this.doku) {
      if (!this.desen) this.desen = c.createPattern(this.doku, 'repeat');
      if (this.desen) {
        const s = akis ? zamanMs / 1000 : 0;
        c.save();
        c.beginPath();
        c.rect(t.x, t.y, t.w, t.h);
        c.clip();
        c.fillStyle = this.desen;
        c.globalAlpha = 0.07;
        const ox1 = (s * 9) % 256;
        const oy1 = (s * 3.5) % 256;
        c.translate(t.x + ox1, t.y + oy1);
        c.fillRect(-ox1 - 256, -oy1 - 256, t.w + 512, t.h + 512);
        c.translate(-ox1, -oy1);
        c.scale(1.6, 1.35);
        const ox2 = (-s * 6) % 256;
        const oy2 = (s * 5) % 256;
        c.translate(ox2, oy2);
        c.globalAlpha = 0.05;
        c.fillRect(-ox2 - 256, -oy2 - 256, t.w / 1.6 + 512, t.h / 1.35 + 512);
        c.restore();
        c.globalAlpha = 1;
      }
    }
    if (this.iz && this.izler.length) c.drawImage(this.iz, t.x, t.y, t.w, t.h);
  }
}
