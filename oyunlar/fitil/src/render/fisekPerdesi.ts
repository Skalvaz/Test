/**
 * Fişek perdesi (fişek ek): DOM HUD'un ÜSTÜNDE ikinci, küçük bir tuval.
 *
 * Dikey telefonda (özellikle claude.ai görüntüleyicisinde, ~390×700) üst
 * bandın büyük kısmını HUD plakası kaplar; ana tuvaldeki gök fişeklerinin
 * oraya taşan kısmı görünmezdi. Çizici, HUD bandına (y < hudAlt) düşen gök
 * ışığını, gök parçacıklarını, kovanları, hedef kartlarına uçan kıvılcımları
 * ve kart patlamalarını bu tuvale çizer; ana tuvalde aynı katmanlar
 * y ≥ hudAlt'a kırpılır (çift çizim yok, sınır dikişsiz).
 *
 * - Tuval yalnız HUD bandını kaplar (genişlik × hudAlt): bellek ve birleştirme
 *   maliyeti küçük. DPR ana tuvalinkiyle aynıdır (uygulama sahnesi en fazla 2;
 *   2'yi aşarsa perde kapanır ve her şey tek tuvalde çizilir).
 * - `pointer-events: none`; katman HUD'un üstünde, balon/bant/modalların altında.
 * - HUD okunur kalsın: çizimin üstüne yukarıdan aşağı saydamlık maskesi
 *   (`destination-in`, üstte ~%60, sınırda %100 — ana tuvalle dikişsiz).
 * - Yalnız içerik varken temizlenip çizilir; içerik bitince bir kez temizlenir.
 *   Gradyan boyut değişince bir kez kurulur: kare başına bellek ayırma yok.
 */
import type { Ctx } from './tuval';

export class FisekPerdesi {
  readonly tuval: HTMLCanvasElement;
  readonly ctx: Ctx;
  /** Mantıksal boyut (CSS px) ve DPR. */
  w = 0;
  h = 0;
  dpr = 1;
  private kirli = false;
  private maske: CanvasGradient | null = null;

  constructor(readonly kap: HTMLElement) {
    this.tuval = document.createElement('canvas');
    this.tuval.className = 'f-fisek-tuval';
    this.tuval.setAttribute('aria-hidden', 'true');
    this.tuval.width = 1;
    this.tuval.height = 1;
    const st = this.tuval.style;
    st.position = 'absolute';
    st.left = '0';
    st.top = '0';
    st.pointerEvents = 'none';
    st.width = '0px';
    st.height = '0px';
    kap.appendChild(this.tuval);
    const ctx = this.tuval.getContext('2d');
    if (!ctx) throw new Error('fişek perdesi 2B bağlamı alınamadı');
    this.ctx = ctx;
  }

  /** Perdeyi `w × h` CSS px'e ayarla (h = HUD'un alt kenarı). Aynıysa bir şey yapmaz. */
  boyutla(w: number, h: number, dpr: number): void {
    const W = Math.max(0, Math.round(w));
    const H = Math.max(0, Math.round(h));
    if (W === this.w && H === this.h && dpr === this.dpr) return;
    this.w = W;
    this.h = H;
    this.dpr = dpr;
    this.tuval.width = Math.max(1, Math.round(W * dpr));
    this.tuval.height = Math.max(1, Math.round(H * dpr));
    this.tuval.style.width = `${W}px`;
    this.tuval.style.height = `${H}px`;
    this.kirli = false;
    if (H > 0) {
      const g = this.ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.6)');
      g.addColorStop(0.75, 'rgba(0,0,0,0.82)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      this.maske = g;
    } else this.maske = null;
  }

  /** Çizime başla: tuvali temizler. Dönüşümü çağıran kurar (DPR dahil). */
  basla(): Ctx {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.tuval.width, this.tuval.height);
    this.kirli = true;
    return c;
  }

  /** Çizimi bitir: HUD okunurluğu için saydamlık maskesi. */
  bitir(): void {
    const c = this.ctx;
    if (this.maske) {
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'destination-in';
      c.fillStyle = this.maske;
      c.fillRect(0, 0, this.w, this.h);
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  /** İçerik yoksa: önceki karede çizim varsa bir kez temizle. */
  temizle(): void {
    if (!this.kirli) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.tuval.width, this.tuval.height);
    this.kirli = false;
  }

  kaldir(): void {
    this.tuval.remove();
  }
}
