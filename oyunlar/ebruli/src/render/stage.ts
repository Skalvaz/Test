/**
 * Tuval sahnesi: cihaz piksel oranına göre keskin çizim, kapsayıcıya göre
 * yeniden boyutlanma ve telefonda tarayıcı çubuğunun açılıp kapanmasına
 * (visualViewport) tepki. Mantıksal birim CSS pikselidir.
 */
export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = 1;
  private listeners: Array<(w: number, h: number) => void> = [];
  private ro: ResizeObserver | null = null;

  constructor(host: HTMLElement, maxDpr = 2.5) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sahne';
    host.appendChild(this.canvas);
    // `desynchronized` (düşük gecikmeli tuval) KULLANILMAZ: Android Chrome'da tuvali tek
    // tamponlu ekran katmanı yapar, her karede baştan çizilen sahne tablette yarım
    // kareler hâlinde titrer (Chrome: "genel amaçlı değil, kalem uygulamaları için").
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Tuval 2B bağlamı alınamadı');
    this.ctx = ctx;
    const fit = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      if (w === this.width && h === this.height && dpr === this.dpr) return;
      this.width = w;
      this.height = h;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      for (const l of this.listeners) l(w, h);
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(fit);
      this.ro.observe(host);
    }
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    fit();
  }

  onResize(fn: (w: number, h: number) => void): void {
    this.listeners.push(fn);
    if (this.width) fn(this.width, this.height);
  }

  /** Her karenin başında: dönüşümü sıfırla ve DPR ölçeğini uygula. */
  begin(): CanvasRenderingContext2D {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return c;
  }
}
