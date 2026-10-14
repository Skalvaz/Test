/**
 * Elle tutulan 2B dönüşüm matrisi. `ctx.save/restore` ve `getTransform`
 * (DOMMatrix ayırır) yerine kullanılır: kare başına bellek ayırma yok.
 * Taban matris (DPR × kamera) bir kez kurulur; döndürülmüş sprite çizimleri
 * bunun üstüne doğrudan setTransform ile yapılır.
 */
import type { Ctx, Sprite } from './tuval';

export class Donusum {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  kur(a: number, b: number, c: number, d: number, e: number, f: number): this {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  kopyala(o: Donusum): this {
    return this.kur(o.a, o.b, o.c, o.d, o.e, o.f);
  }

  uygula(ctx: Ctx): void {
    ctx.setTransform(this.a, this.b, this.c, this.d, this.e, this.f);
  }

  /** Bu matrisin ardından yerel (x, y, açı, ölçek) dönüşümünü ctx'e uygula. */
  yerel(ctx: Ctx, x: number, y: number, aci: number, sx: number, sy: number): void {
    const co = Math.cos(aci);
    const si = Math.sin(aci);
    const la = co * sx;
    const lb = si * sx;
    const lc = -si * sy;
    const ld = co * sy;
    ctx.setTransform(
      this.a * la + this.c * lb,
      this.b * la + this.d * lb,
      this.a * lc + this.c * ld,
      this.b * lc + this.d * ld,
      this.a * x + this.c * y + this.e,
      this.b * x + this.d * y + this.f,
    );
  }

  /** Döndürülmüş/ölçeklenmiş sprite (çapa noktası x,y'de). Sonra taban geri yüklenmez. */
  sprite(ctx: Ctx, s: Sprite, x: number, y: number, aci: number, sx: number, sy: number): void {
    this.yerel(ctx, x, y, aci, sx, sy);
    ctx.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
  }

  /** Noktayı dönüştür (ekran koordinatı); sonuç `cikis`a yazılır. */
  nokta(x: number, y: number, cikis: { x: number; y: number }): void {
    cikis.x = this.a * x + this.c * y + this.e;
    cikis.y = this.b * x + this.d * y + this.f;
  }
}
