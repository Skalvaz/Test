/**
 * Offscreen tuval yardımcıları (GDD §13.5). Sprite ve katmanlar normal
 * <canvas> öğesine çizilir: `OffscreenCanvas` her tarayıcıda drawImage ile
 * güvenilir değil (eski iOS); tek tip olması önbellek kodunu sadeleştirir.
 */
export type Tuval = HTMLCanvasElement;
export type Ctx = CanvasRenderingContext2D;

export function tuvalOlustur(w: number, h: number): { tuval: Tuval; ctx: Ctx } {
  const tuval = document.createElement('canvas');
  tuval.width = Math.max(1, Math.ceil(w));
  tuval.height = Math.max(1, Math.ceil(h));
  const ctx = tuval.getContext('2d');
  if (!ctx) throw new Error('offscreen 2B bağlamı alınamadı');
  return { tuval, ctx };
}

/** Yuvarlak köşeli dikdörtgen yolu (roundRect olmayan tarayıcılar için). */
export function yuvarlakDikdortgen(c: Ctx, x: number, y: number, w: number, h: number, r: number, ekle = false): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!ekle) c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.arcTo(x + w, y, x + w, y + rr, rr);
  c.lineTo(x + w, y + h - rr);
  c.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  c.lineTo(x + rr, y + h);
  c.arcTo(x, y + h, x, y + h - rr, rr);
  c.lineTo(x, y + rr);
  c.arcTo(x, y, x + rr, y, rr);
  c.closePath();
}

/**
 * Sprite: piksel tuvali + mantıksal (CSS px) boyutu ve çapa noktası.
 * Çizim: drawImage(t, x − ox, y − oy, w, h).
 */
export interface Sprite {
  t: Tuval;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** Merkezli sprite üret: `ciz` mantıksal koordinatlarda, (0,0) çapada çizer. */
export function spriteUret(w: number, h: number, dpr: number, ciz: (c: Ctx) => void, ox = w / 2, oy = h / 2): Sprite {
  const { tuval, ctx } = tuvalOlustur(w * dpr, h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  ciz(ctx);
  return { t: tuval, w, h, ox, oy };
}

/** Sprite'ı (x, y) çapasına `olcek` ile çizer. */
export function spriteCiz(c: Ctx, s: Sprite, x: number, y: number, olcek = 1): void {
  c.drawImage(s.t, x - s.ox * olcek, y - s.oy * olcek, s.w * olcek, s.h * olcek);
}

/** Sprite'ı döndürerek ve eksen ölçekleriyle çizer (dönüşümü geri yükler). */
export function spriteCizDon(c: Ctx, s: Sprite, x: number, y: number, aci: number, sx: number, sy = sx): void {
  c.save();
  c.translate(x, y);
  if (aci) c.rotate(aci);
  c.scale(sx, sy);
  c.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
  c.restore();
}
