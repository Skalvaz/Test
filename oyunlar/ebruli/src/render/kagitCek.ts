/**
 * Kâğıt çekme anı (GDD §9.5): tahta kararır (alfa 0,55, 400 ms) → krem
 * kâğıt üstten suya serilir (600 ms, outCubic; değdiği an kenarından su
 * halkaları açılır) → boya kâğıda işler → 1,8 sn'de köşeden tutulup
 * kaldırılır (inOutCubic, 3° dönme), desen köşeden açığa çıkar ve tablo
 * büyüyerek ortaya yerleşir. Sonda tablo `kaldir()`a dek ekranda kalır.
 */
import { PALET } from '../app/katalog';
import type { Dikdortgen } from '../app/sozlesme';
import { inOutCubic, outCubic, sinirla01, karma01 } from './matematik';
import type { Ctx } from './tuval';

type TabloTuvali = HTMLCanvasElement | OffscreenCanvas;

const T_KARAR = 400;
const T_SERIL = 600;
const T_ISLE = 350;
const T_KALK = 1800;

export class KagitCekme {
  private t = -1;
  private sure = 0;
  private tablo: TabloTuvali | null = null;
  private tabloT = 0;
  private P: Dikdortgen = { x: 0, y: 0, w: 0, h: 0 };
  private F: Dikdortgen = { x: 0, y: 0, w: 0, h: 0 };
  private azalt = false;
  private coz: (() => void) | null = null;
  private halka: ((x: number, y: number, r: number) => void) | null = null;
  private degdi = false;
  private bitti = false;

  baslat(tablo: TabloTuvali | null, tahta: Dikdortgen, W: number, H: number, azalt: boolean, halka: (x: number, y: number, r: number) => void): Promise<void> {
    this.coz?.();
    this.tablo = tablo;
    this.tabloT = tablo ? 1 : 0;
    this.azalt = azalt;
    this.halka = halka;
    this.degdi = false;
    this.bitti = false;
    // Kâğıt: tahtanın içine sığan 2:3 dikdörtgen.
    const pw = Math.min(tahta.w * 0.96, tahta.h * 0.96 * (2 / 3));
    const ph = pw * 1.5;
    this.P = { x: tahta.x + (tahta.w - pw) / 2, y: tahta.y + (tahta.h - ph) / 2, w: pw, h: ph };
    // Son yer: ekranın %84 × %64'üne sığan, biraz yukarıda.
    const fw = Math.min(W * 0.84, H * 0.64 * (2 / 3), 512);
    const fh = fw * 1.5;
    this.F = { x: (W - fw) / 2, y: Math.max(12, H * 0.44 - fh / 2), w: fw, h: fh };
    const k = azalt ? 0.5 : 1;
    this.sure = (T_KARAR + T_SERIL + T_ISLE + T_KALK) * k;
    this.t = 0;
    return new Promise<void>((r) => {
      this.coz = r;
    });
  }

  tabloVer(t: TabloTuvali | null): void {
    if (t && !this.tablo) this.tabloT = 0;
    this.tablo = t;
  }

  kaldir(): void {
    this.t = -1;
    this.tablo = null;
    const c = this.coz;
    this.coz = null;
    c?.();
  }

  aktif(): boolean {
    return this.t >= 0;
  }

  sonDikdortgen(): Dikdortgen | null {
    return this.t >= 0 ? { ...this.F } : null;
  }

  guncelle(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    if (this.tablo && this.tabloT < 1) this.tabloT = Math.min(1, this.tabloT + dt / 300);
    const k = this.azalt ? 0.5 : 1;
    if (!this.degdi && this.t >= (T_KARAR + T_SERIL) * k) {
      this.degdi = true;
      const p = this.P;
      this.halka?.(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h) * 0.55);
    }
    if (!this.bitti && this.t >= this.sure) {
      this.bitti = true;
      const c = this.coz;
      this.coz = null;
      c?.();
    }
  }

  ciz(c: Ctx, zamanMs: number): void {
    if (this.t < 0) return;
    const k = this.azalt ? 0.5 : 1;
    const t = this.t / k;
    // Kararma.
    const kar = 0.55 * outCubic(Math.min(1, t / T_KARAR));
    c.fillStyle = `rgba(3,10,14,${kar.toFixed(3)})`;
    c.fillRect(-10, -10, 1e5, 1e5);
    if (t < T_KARAR) return;
    const ts = t - T_KARAR;
    const P = this.P;
    const F = this.F;
    // Serilme: üstten kayarak iner, saydamlıktan belirir.
    const us = outCubic(Math.min(1, ts / T_SERIL));
    const ti = ts - T_SERIL;
    const isle = sinirla01(ti / T_ISLE);
    const tk = ti - T_ISLE;
    const uk = this.azalt ? sinirla01(tk / T_KALK) : inOutCubic(sinirla01(tk / T_KALK));
    let x = P.x;
    let y = P.y - P.h * 0.18 * (1 - us);
    let w = P.w * (1 + 0.04 * (1 - us));
    let h = P.h * (1 + 0.04 * (1 - us));
    x -= (w - P.w) / 2;
    let aci = 0;
    let kalk = 0;
    if (tk > 0) {
      x = P.x + (F.x - P.x) * uk;
      y = P.y + (F.y - P.y) * uk;
      w = P.w + (F.w - P.w) * uk;
      h = P.h + (F.h - P.h) * uk;
      kalk = Math.sin(Math.PI * Math.min(1, uk * 1.2)) * (1 - uk * 0.6);
      aci = this.azalt ? 0 : (3 * Math.PI) / 180 * Math.sin(Math.PI * uk);
    }
    c.save();
    c.globalAlpha = Math.min(1, us * 1.4);
    const cx = x + w / 2;
    const cy = y + h / 2;
    c.translate(cx, cy);
    c.rotate(aci);
    // Gölge (kalkınca büyür ve kayar).
    const gol = 4 + kalk * 18;
    for (let i = 6; i >= 1; i--) {
      c.fillStyle = `rgba(0,4,8,${(0.06 + kalk * 0.02).toFixed(3)})`;
      const e = (gol * i) / 6;
      c.fillRect(-w / 2 - e + gol * 0.4, -h / 2 - e + gol * 0.8, w + e * 2, h + e * 2);
    }
    // Kâğıt (arka yüz krem, aharlı).
    const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, '#FBF4E2');
    g.addColorStop(0.6, PALET.kagit);
    g.addColorStop(1, PALET.kagitGolge);
    c.fillStyle = g;
    c.fillRect(-w / 2, -h / 2, w, h);
    // Islanma: boya kâğıda işlerken desen silikçe geçer.
    const tablo = this.tablo;
    if (tablo && ti > 0) {
      const a = tk > 0 ? 1 : 0.22 * isle;
      if (tk <= 0) {
        c.globalAlpha = a * this.tabloT;
        c.drawImage(tablo as CanvasImageSource, -w / 2, -h / 2, w, h);
        c.globalAlpha = 1;
      } else {
        // Köşeden açığa çıkma: sol üst köşeden çapraz silme.
        const acik = Math.min(1, uk / 0.7);
        c.save();
        c.beginPath();
        const d = (w + h) * acik * 1.02;
        c.moveTo(-w / 2, -h / 2);
        c.lineTo(-w / 2 + d, -h / 2);
        c.lineTo(-w / 2, -h / 2 + d);
        c.closePath();
        c.clip();
        c.globalAlpha = this.tabloT;
        c.drawImage(tablo as CanvasImageSource, -w / 2, -h / 2, w, h);
        c.restore();
        c.globalAlpha = Math.min(1, us * 1.4);
        // Silme cephesinde ıslak parıltı.
        if (acik < 1) {
          c.strokeStyle = 'rgba(255,255,255,0.35)';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(-w / 2 + d, -h / 2);
          c.lineTo(-w / 2, -h / 2 + d);
          c.stroke();
        }
        // Silinmemiş kısımda da desen silik.
        c.save();
        c.beginPath();
        c.moveTo(-w / 2 + d, -h / 2);
        c.lineTo(w / 2, -h / 2);
        c.lineTo(w / 2, h / 2);
        c.lineTo(-w / 2, h / 2);
        c.lineTo(-w / 2, -h / 2 + d);
        c.closePath();
        c.clip();
        c.globalAlpha = 0.22 * this.tabloT;
        c.drawImage(tablo as CanvasImageSource, -w / 2, -h / 2, w, h);
        c.restore();
      }
    } else if (!tablo && ti > 0) {
      // Tablo henüz hazır değil: suyun ışıltısı kâğıtta.
      c.globalAlpha = 0.12 + 0.06 * Math.sin(zamanMs * 0.004);
      for (let i = 0; i < 6; i++) {
        const rx = (karma01(i, 1) - 0.5) * w * 0.7;
        const ry = (karma01(i, 2) - 0.5) * h * 0.7;
        c.strokeStyle = PALET.altin;
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(rx, ry, w * (0.06 + karma01(i, 3) * 0.1), 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    // Kalkan köşe: kıvrık köşe ışığı.
    if (kalk > 0.02) {
      const kk = Math.min(w, h) * 0.16 * kalk;
      const kg = c.createLinearGradient(-w / 2, -h / 2, -w / 2 + kk, -h / 2 + kk);
      kg.addColorStop(0, 'rgba(255,255,255,0.55)');
      kg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = kg;
      c.beginPath();
      c.moveTo(-w / 2, -h / 2);
      c.lineTo(-w / 2 + kk * 1.6, -h / 2);
      c.lineTo(-w / 2, -h / 2 + kk * 1.6);
      c.closePath();
      c.fill();
    }
    c.strokeStyle = 'rgba(138,109,18,0.6)';
    c.lineWidth = 1;
    c.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1);
    c.restore();
    c.globalAlpha = 1;
  }
}
