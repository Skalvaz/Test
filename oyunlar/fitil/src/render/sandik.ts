/**
 * Fişek sandığı (GDD §13.4, §16.6 katman 2): koyu ahşap damar (yatay şerit,
 * sin(y·0,15 + gürültü(x)·3)), 14 px pirinç köşe plakaları, kenar boyunca
 * hücre başına 1 perçin, içe gömülü yuvalar (2 px iç gölge) ve kalıcı ışık
 * izi katmanı (§13.1 "Işıklı yuva": #3B2A12 + altın radyal alfa 0,25).
 *
 * Çerçeve ve yuvalar offscreen'de pişer; ışık izi ayrı bir offscreen'e hücre
 * hücre işlenir (açılış canlandırması bitince).
 */
import { gurultu2, hexRgb, rgba } from './matematik';
import { P } from './palet';
import type { Sahne } from './sahne';
import { spriteUret, tuvalOlustur, yuvarlakDikdortgen, type Ctx, type Sprite, type Tuval } from './tuval';

export class Sandik {
  private govde: Tuval | null = null;
  private isik: Tuval | null = null;
  private isikCtx: Ctx | null = null;
  private isikliYuva: Sprite | null = null;
  /** Dairesel maske açılış kareleri (her karede clip() yerine; §16.6). */
  private acilis: Sprite[] = [];
  /** Tuvalin tahta uzayındaki sol üst köşesi ve boyu. */
  ox = 0;
  oy = 0;
  ow = 0;
  oh = 0;
  private pay = 0;
  private pisti: Uint8Array = new Uint8Array(0);
  /** Bölüm sonu parlaması (kazanç) 0..1. */
  parla = 0;
  /** Işık izi katmanında en az bir yuva var mı (boşsa çizilmez). */
  private isikVar = false;

  constructor(private s: Sahne) {}

  /** Çerçeve + yuvaları pişir; ışık izi katmanını durumdan yeniden kur. */
  kur(): void {
    const s = this.s;
    const t = s.tahta;
    const c = s.c;
    const F = s.cerceve;
    const pay = Math.ceil(F + 16);
    this.pay = pay;
    this.ox = s.gx - pay;
    this.oy = s.gy - pay;
    this.ow = t.w * c + 2 * pay;
    this.oh = t.h * c + 2 * pay;
    const d = Math.min(2, s.dpr);
    const { tuval, ctx } = tuvalOlustur(this.ow * d, this.oh * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.cizGovde(ctx, d);
    this.govde = tuval;
    const ik = tuvalOlustur(this.ow * d, this.oh * d);
    ik.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.isik = ik.tuval;
    this.isikCtx = ik.ctx;
    this.isikliYuva = spriteUret(c, c, d, (x) => {
      const ic = 0.05 * c;
      const sw = c - 2 * ic;
      yuvarlakDikdortgen(x, -sw / 2, -sw / 2, sw, sw, 0.16 * c);
      x.fillStyle = P.isikliYuva;
      x.fill();
      const g = x.createRadialGradient(0, 0, 0, 0, 0, sw * 0.62);
      g.addColorStop(0, rgba('#FFD27A', 0.25));
      g.addColorStop(0.6, rgba('#E8A040', 0.12));
      g.addColorStop(1, rgba('#E8A040', 0));
      x.fillStyle = g;
      x.fill();
      x.lineWidth = 1;
      x.strokeStyle = 'rgba(255,210,140,0.22)';
      yuvarlakDikdortgen(x, -sw / 2 + 0.5, -sw / 2 + 0.5, sw - 1, sw - 1, 0.16 * c);
      x.stroke();
    });
    this.acilis = maskeKareleri(this.isikliYuva, c, d);
    this.pisti = new Uint8Array(t.w * t.h);
    this.isikGuncelle(true);
  }

  private cizGovde(x: Ctx, d: number): void {
    const s = this.s;
    const t = s.tahta;
    const c = s.c;
    const F = s.cerceve;
    const pay = this.pay;
    const gx = pay;
    const gy = pay;
    const gw = t.w * c;
    const gh = t.h * c;
    const R = Math.min(0.34 * c, F + 6);
    // 1. Yumuşak gölge (shadowBlur yok: genişleyen saydam katmanlar).
    for (let i = 14; i >= 1; i--) {
      x.fillStyle = `rgba(0,0,0,${0.035})`;
      yuvarlakDikdortgen(x, gx - F - i, gy - F - i + 8, gw + 2 * F + 2 * i, gh + 2 * F + 2 * i, R + i);
      x.fill();
    }
    // 2. Ahşap damar: ImageData ile piksel piksel (yalnız kurulumda).
    const W = Math.ceil(this.ow * d);
    const H = Math.ceil(this.oh * d);
    const dis = { x: (gx - F) * d, y: (gy - F) * d, w: (gw + 2 * F) * d, h: (gh + 2 * F) * d };
    const img = x.getImageData(0, 0, W, H);
    const v = img.data;
    const koyu = hexRgb(P.ahsapKoyu);
    const orta = hexRgb('#5A3A22');
    const damar = hexRgb('#6E4A2C');
    const icX0 = gx * d;
    const icY0 = gy * d;
    const icX1 = (gx + gw) * d;
    const icY1 = (gy + gh) * d;
    for (let py = Math.floor(dis.y); py < Math.ceil(dis.y + dis.h); py++) {
      if (py < 0 || py >= H) continue;
      const yy = py / d;
      for (let px = Math.floor(dis.x); px < Math.ceil(dis.x + dis.w); px++) {
        if (px < 0 || px >= W) continue;
        const xx = px / d;
        const ic = px >= icX0 && px < icX1 && py >= icY0 && py < icY1;
        // Tahta şeritleri: her ~18 px'te bir derz.
        const serit = Math.floor((yy + (ic ? 0 : 7)) / 18);
        const n = gurultu2(xx * 0.035 + serit * 13.7, yy * 0.11 + serit * 3.1);
        const w = 0.5 + 0.5 * Math.sin(yy * 0.15 * (ic ? 1.6 : 1) + n * 3 + serit * 1.3);
        let r = koyu.r + (orta.r - koyu.r) * w;
        let g = koyu.g + (orta.g - koyu.g) * w;
        let b = koyu.b + (orta.b - koyu.b) * w;
        if (w > 0.82) {
          const k = (w - 0.82) / 0.18;
          r += (damar.r - r) * k;
          g += (damar.g - g) * k;
          b += (damar.b - b) * k;
        }
        const derz = (yy + (ic ? 0 : 7)) % 18;
        if (derz < 0.9) {
          r *= 0.55;
          g *= 0.55;
          b *= 0.55;
        }
        if (ic) {
          // İç pano: daha koyu ve daha az damarlı.
          const yum = 0.62;
          r = (koyu.r + (r - koyu.r) * 0.45) * yum;
          g = (koyu.g + (g - koyu.g) * 0.45) * yum;
          b = (koyu.b + (b - koyu.b) * 0.45) * yum;
        }
        const o = (py * W + px) * 4;
        v[o] = r;
        v[o + 1] = g;
        v[o + 2] = b;
        v[o + 3] = 255;
      }
    }
    const kat = tuvalOlustur(W, H);
    kat.ctx.putImageData(img, 0, 0);
    // Çerçeve biçimine kırp ve ana tuvale bindir.
    x.save();
    yuvarlakDikdortgen(x, gx - F, gy - F, gw + 2 * F, gh + 2 * F, R);
    x.clip();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(kat.tuval, 0, 0);
    x.restore();
    x.setTransform(d, 0, 0, d, 0, 0);
    // Üstten gelen yumuşak ışık (çerçeve hacmi).
    const isik = x.createLinearGradient(0, gy - F, 0, gy + gh + F);
    isik.addColorStop(0, 'rgba(255,214,160,0.12)');
    isik.addColorStop(0.5, 'rgba(255,214,160,0)');
    isik.addColorStop(1, 'rgba(0,0,0,0.28)');
    x.fillStyle = isik;
    yuvarlakDikdortgen(x, gx - F, gy - F, gw + 2 * F, gh + 2 * F, R);
    x.fill();
    // 3. Çerçeve kabartması: dış açık kenar, iç koyu oluk.
    x.lineWidth = 1.5;
    x.strokeStyle = 'rgba(255,214,150,0.22)';
    yuvarlakDikdortgen(x, gx - F + 0.75, gy - F + 0.75, gw + 2 * F - 1.5, gh + 2 * F - 1.5, R);
    x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    x.lineWidth = 2;
    yuvarlakDikdortgen(x, gx - 1, gy - 1, gw + 2, gh + 2, 0.18 * c);
    x.stroke();
    x.strokeStyle = 'rgba(255,214,150,0.12)';
    x.lineWidth = 1;
    yuvarlakDikdortgen(x, gx - 3, gy - 3, gw + 6, gh + 6, 0.2 * c);
    x.stroke();
    // 4. Yuvalar (delik dışı): radyal #160E08 → #24160D, 2 px iç gölge.
    const ic = 0.05 * c;
    const sw = c - 2 * ic;
    const yr = 0.16 * c;
    for (let y = 0; y < t.h; y++) {
      for (let xx = 0; xx < t.w; xx++) {
        const h = t.hucreler[y * t.w + xx];
        if (h.delik) continue;
        const sx = gx + xx * c + ic;
        const sy = gy + y * c + ic;
        const cx = sx + sw / 2;
        const cy = sy + sw / 2;
        yuvarlakDikdortgen(x, sx, sy, sw, sw, yr);
        const g = x.createRadialGradient(cx, cy + sw * 0.08, 0, cx, cy, sw * 0.7);
        g.addColorStop(0, P.yuvaIc);
        g.addColorStop(1, P.yuvaDis);
        x.fillStyle = g;
        x.fill();
        x.save();
        yuvarlakDikdortgen(x, sx, sy, sw, sw, yr);
        x.clip();
        x.lineWidth = 2;
        x.strokeStyle = 'rgba(0,0,0,0.75)';
        yuvarlakDikdortgen(x, sx + 1, sy + 1, sw + 2, sw + 2, yr);
        x.stroke();
        x.strokeStyle = 'rgba(255,214,150,0.09)';
        yuvarlakDikdortgen(x, sx - 2, sy - 2, sw + 1, sw + 1, yr);
        x.stroke();
        x.restore();
        // Yuva ağzının alt kenarında ince ışık
        x.strokeStyle = 'rgba(255,214,150,0.13)';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(sx + yr, sy + sw + 0.5);
        x.lineTo(sx + sw - yr, sy + sw + 0.5);
        x.stroke();
      }
    }
    // 5. Perçinler: kenar boyunca hücre başına 1.
    const percin = (px: number, py: number) => {
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.beginPath();
      x.arc(px + 0.6, py + 1, 2.9, 0, Math.PI * 2);
      x.fill();
      const g = x.createRadialGradient(px - 0.9, py - 0.9, 0, px, py, 2.8);
      g.addColorStop(0, '#FFF2C8');
      g.addColorStop(0.45, P.pirinc);
      g.addColorStop(1, P.bakirKoyu);
      x.fillStyle = g;
      x.beginPath();
      x.arc(px, py, 2.6, 0, Math.PI * 2);
      x.fill();
    };
    const kenarOrta = F / 2;
    for (let i = 0; i < t.w; i++) {
      const px = gx + (i + 0.5) * c;
      percin(px, gy - kenarOrta);
      percin(px, gy + gh + kenarOrta);
    }
    for (let j = 0; j < t.h; j++) {
      const py = gy + (j + 0.5) * c;
      percin(gx - kenarOrta, py);
      percin(gx + gw + kenarOrta, py);
    }
    // 6. Pirinç köşe plakaları (14 px).
    const K = 14 + F * 0.6;
    const koseler: [number, number, number, number][] = [
      [gx - F, gy - F, 1, 1],
      [gx + gw + F, gy - F, -1, 1],
      [gx + gw + F, gy + gh + F, -1, -1],
      [gx - F, gy + gh + F, 1, -1],
    ];
    for (const [kx, ky, sx, sy] of koseler) {
      x.save();
      x.translate(kx, ky);
      x.scale(sx, sy);
      x.beginPath();
      x.moveTo(R * 0.3, 0);
      x.lineTo(K + 8, 0);
      x.lineTo(K + 8, 6);
      x.quadraticCurveTo(K - 2, 7, K - 4, F + 2);
      x.lineTo(F + 2, F + 2);
      x.lineTo(F + 2, K - 4);
      x.quadraticCurveTo(7, K - 2, 6, K + 8);
      x.lineTo(0, K + 8);
      x.lineTo(0, R * 0.3);
      x.quadraticCurveTo(0, 0, R * 0.3, 0);
      x.closePath();
      const g = x.createLinearGradient(0, 0, K, K);
      g.addColorStop(0, P.pirincAcik);
      g.addColorStop(0.5, P.pirinc);
      g.addColorStop(1, P.bakirKoyu);
      x.fillStyle = 'rgba(0,0,0,0.45)';
      x.save();
      x.translate(0.8, 1.4);
      x.fill();
      x.restore();
      x.fillStyle = g;
      x.fill();
      x.lineWidth = 1;
      x.strokeStyle = '#4A2408';
      x.stroke();
      x.strokeStyle = 'rgba(255,240,200,0.55)';
      x.beginPath();
      x.moveTo(2.5, K + 5);
      x.lineTo(2.5, 2.5);
      x.lineTo(K + 5, 2.5);
      x.stroke();
      x.restore();
      percin(kx + sx * (F * 0.5 + 1), ky + sy * (F * 0.5 + 1));
    }
  }

  /** Işık izi katmanını durumla eşitle (`hepsi`: sıfırdan). */
  isikGuncelle(hepsi = false): void {
    const s = this.s;
    const t = s.tahta;
    const x = this.isikCtx;
    if (!x || !this.isikliYuva) return;
    if (hepsi) {
      x.clearRect(0, 0, this.ow, this.oh);
      this.pisti.fill(0);
      this.isikVar = false;
    }
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      if (!h.isikIzi) {
        if (this.pisti[i]) {
          // Geri sarma vb.: tüm katmanı yeniden kur.
          this.pisti.fill(0);
          this.isikVar = false;
          x.clearRect(0, 0, this.ow, this.oh);
          this.isikGuncelle(false);
          return;
        }
        continue;
      }
      if (this.pisti[i] || h.isikAcilis < 1) continue;
      this.pisti[i] = 1;
      this.isikVar = true;
      const hx = i % t.w;
      const hy = (i - hx) / t.w;
      const sp = this.isikliYuva;
      x.drawImage(sp.t, this.pay + hx * s.c, this.pay + hy * s.c, sp.w, sp.h);
    }
  }

  /** Çerçeve + yuvalar + ışık izi (+ açılmakta olan yuvalar). */
  ciz(c: Ctx): void {
    const s = this.s;
    if (!this.govde || !this.isik) return;
    c.drawImage(this.govde, this.ox, this.oy, this.ow, this.oh);
    this.isikGuncelle();
    if (this.isikVar) c.drawImage(this.isik, this.ox, this.oy, this.ow, this.oh);
    // Açılan yuvalar: dairesel maske 0→1 (önceden pişmiş kareler).
    const t = s.tahta;
    const n = this.acilis.length;
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      if (!h.isikIzi || h.isikAcilis >= 1) continue;
      const hx = i % t.w;
      const hy = (i - hx) / t.w;
      const k = 1 - (1 - h.isikAcilis) * (1 - h.isikAcilis) * (1 - h.isikAcilis);
      const sp = this.acilis[Math.min(n - 1, Math.floor(k * n))];
      c.drawImage(sp.t, s.mx(hx) - sp.ox, s.my(hy) - sp.oy, sp.w, sp.h);
    }
    if (this.parla > 0 && this.isikVar) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = this.parla * (0.55 + 0.25 * Math.sin(s.zaman * 0.004));
      c.drawImage(this.isik, this.ox, this.oy, this.ow, this.oh);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
  }

  /**
   * Üst kenar şeridini yeniden çiz (tahta üstünden düşen kapsüllerin
   * çerçevenin arkasından çıkması için).
   */
  ustKenar(c: Ctx): void {
    if (!this.govde) return;
    const d = this.govde.width / this.ow;
    const h = this.pay;
    c.drawImage(this.govde, 0, 0, this.govde.width, h * d, this.ox, this.oy, this.ow, h);
  }
}

/** Hücre sprite'ının dairesel maskeyle açılış kareleri (yarıçap 0 → 0,72c). */
export function maskeKareleri(kaynak: Sprite, c: number, d: number, n = 10): Sprite[] {
  const kareler: Sprite[] = [];
  for (let k = 1; k <= n; k++) {
    kareler.push(
      spriteUret(kaynak.w, kaynak.h, d, (x) => {
        x.beginPath();
        x.arc(0, 0, (k / n) * c * 0.72, 0, Math.PI * 2);
        x.clip();
        x.drawImage(kaynak.t, -kaynak.ox, -kaynak.oy, kaynak.w, kaynak.h);
      }),
    );
  }
  return kareler;
}
