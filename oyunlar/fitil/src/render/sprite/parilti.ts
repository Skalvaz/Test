/**
 * Parçacık ve ışık sprite'ları (§16.6: parıltılar sprite önbelleğinden,
 * `shadowBlur` yok). Boyutlar hücreden bağımsızdır; çizimde ölçeklenir.
 *
 *  nokta[renk]   beyaz-sıcak çekirdekli yuvarlak parıltı (lighter), yarıçap 16
 *  cizgi[renk]   kuyruklu çizgi (sağda parlak baş, solda sönen iz), 64×16
 *  duman         yumuşak gri bulut (source-over)
 *  kirinti       köşeli taş kırığı
 *  cubuk         pirinç kafes çubuğu
 *  isik          büyük beyaz yumuşak ışık (gök aydınlatma, flaş)
 *  alev          fitil başı alevi (yukarı uzun)
 *  el            öğretici saydam el
 *  vinyet        kenar kararması (tam ekran, ölçeklenir)
 */
import { P } from '../palet';
import { hexRgb } from '../matematik';
import { spriteUret, type Ctx, type Sprite } from '../tuval';

export const NOKTA_R = 16;
export const CIZGI_W = 64;
export const CIZGI_H = 16;

export class PariltiSpritelari {
  dpr = 0;
  anahtar = '';
  nokta: Sprite[] = [];
  cizgi: Sprite[] = [];
  duman!: Sprite;
  kirinti!: Sprite;
  cubuk!: Sprite;
  isik!: Sprite;
  alev!: Sprite;
  el!: Sprite;
  vinyet!: Sprite;
  halka!: Sprite;

  hazirla(dpr: number, renkler: readonly string[]): boolean {
    const anahtar = renkler.join();
    if (dpr === this.dpr && anahtar === this.anahtar) return false;
    this.dpr = dpr;
    this.anahtar = anahtar;
    const d = Math.min(dpr, 2);
    this.nokta = renkler.map((r) => spriteUret(2 * NOKTA_R, 2 * NOKTA_R, d, (x) => nokta(x, r)));
    this.cizgi = renkler.map((r) => spriteUret(CIZGI_W, CIZGI_H, d, (x) => cizgi(x, r), CIZGI_W - CIZGI_H / 2, CIZGI_H / 2));
    this.duman = spriteUret(64, 64, d, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(70,64,76,0.55)');
      g.addColorStop(0.5, 'rgba(50,44,56,0.3)');
      g.addColorStop(1, 'rgba(40,36,44,0)');
      x.fillStyle = g;
      x.fillRect(-32, -32, 64, 64);
    });
    this.kirinti = spriteUret(16, 16, d, (x) => {
      x.beginPath();
      x.moveTo(-6, -3);
      x.lineTo(-1, -7);
      x.lineTo(6, -4);
      x.lineTo(5, 4);
      x.lineTo(-2, 6);
      x.lineTo(-7, 2);
      x.closePath();
      const g = x.createLinearGradient(-6, -6, 6, 6);
      g.addColorStop(0, '#8A8494');
      g.addColorStop(1, '#2E2A33');
      x.fillStyle = g;
      x.fill();
      x.strokeStyle = '#141216';
      x.lineWidth = 1;
      x.stroke();
    });
    this.cubuk = spriteUret(8, 48, d, (x) => {
      const g = x.createLinearGradient(-3, 0, 3, 0);
      g.addColorStop(0, P.bakirKoyu);
      g.addColorStop(0.4, P.pirincAcik);
      g.addColorStop(1, P.bakirKoyu);
      x.fillStyle = '#2A1406';
      x.fillRect(-3.5, -22, 7, 44);
      x.fillStyle = g;
      x.fillRect(-2.5, -21, 5, 42);
    });
    this.isik = spriteUret(128, 128, d, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.2, 'rgba(255,255,255,0.45)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(-64, -64, 128, 128);
    });
    this.alev = spriteUret(32, 48, d, (x) => alev(x), 16, 34);
    this.el = spriteUret(72, 84, d, (x) => el(x), 22, 6);
    this.vinyet = spriteUret(128, 128, 1, (x) => {
      const g = x.createRadialGradient(0, 0, 30, 0, 0, 92);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = g;
      x.fillRect(-64, -64, 128, 128);
    });
    this.halka = spriteUret(128, 128, d, (x) => {
      // İnce parlak halka (şok halkası, büyük final): r 56, ölçeklenerek çizilir.
      x.lineWidth = 6;
      x.strokeStyle = 'rgba(255,255,255,0.25)';
      x.beginPath();
      x.arc(0, 0, 56, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 2.5;
      x.strokeStyle = 'rgba(255,255,255,0.95)';
      x.beginPath();
      x.arc(0, 0, 56, 0, Math.PI * 2);
      x.stroke();
    });
    return true;
  }
}

function nokta(x: Ctx, renk: string): void {
  const c = hexRgb(renk);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, NOKTA_R);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, `rgba(${Math.min(255, c.r + 120)},${Math.min(255, c.g + 120)},${Math.min(255, c.b + 120)},1)`);
  g.addColorStop(0.3, `rgba(${c.r},${c.g},${c.b},0.75)`);
  g.addColorStop(0.6, `rgba(${c.r},${c.g},${c.b},0.18)`);
  g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
  x.fillStyle = g;
  x.fillRect(-NOKTA_R, -NOKTA_R, 2 * NOKTA_R, 2 * NOKTA_R);
}

function cizgi(x: Ctx, renk: string): void {
  // Çapa: baş (sağda). Gövde sola doğru söner.
  const c = hexRgb(renk);
  const L = CIZGI_W - CIZGI_H / 2;
  const g = x.createLinearGradient(-L, 0, CIZGI_H / 2, 0);
  g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
  g.addColorStop(0.6, `rgba(${c.r},${c.g},${c.b},0.45)`);
  g.addColorStop(0.9, `rgba(${Math.min(255, c.r + 100)},${Math.min(255, c.g + 100)},${Math.min(255, c.b + 100)},0.95)`);
  g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-L, 0);
  x.quadraticCurveTo(-L * 0.3, -CIZGI_H * 0.22, 0, -CIZGI_H * 0.3);
  x.arc(0, 0, CIZGI_H * 0.3, -Math.PI / 2, Math.PI / 2);
  x.quadraticCurveTo(-L * 0.3, CIZGI_H * 0.22, -L, 0);
  x.closePath();
  x.fill();
  const h = x.createRadialGradient(0, 0, 0, 0, 0, CIZGI_H / 2);
  h.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.6)`);
  h.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
  x.fillStyle = h;
  x.fillRect(-CIZGI_H / 2, -CIZGI_H / 2, CIZGI_H, CIZGI_H);
}

function alev(x: Ctx): void {
  const katman = (w: number, h: number, renk0: string, renk1: string) => {
    const g = x.createRadialGradient(0, -h * 0.2, 0, 0, -h * 0.2, h);
    g.addColorStop(0, renk0);
    g.addColorStop(1, renk1);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -h);
    x.bezierCurveTo(w * 0.9, -h * 0.4, w, h * 0.25, 0, h * 0.35);
    x.bezierCurveTo(-w, h * 0.25, -w * 0.9, -h * 0.4, 0, -h);
    x.closePath();
    x.fill();
  };
  katman(14, 32, 'rgba(255,150,40,0.85)', 'rgba(255,60,20,0)');
  katman(9, 22, 'rgba(255,210,90,0.95)', 'rgba(255,120,30,0.2)');
  katman(5, 12, 'rgba(255,255,235,1)', 'rgba(255,230,160,0.5)');
}

/** Saydam öğretici el: işaret parmağı ucu çapa (0,0). */
function el(x: Ctx): void {
  x.lineJoin = 'round';
  x.lineCap = 'round';
  const yol = () => {
    x.beginPath();
    // İşaret parmağı (yukarı-sol)
    x.moveTo(-4, 2);
    x.quadraticCurveTo(0, -4, 5, 2);
    x.lineTo(9, 30);
    // Orta, yüzük, serçe parmak boğumları
    x.quadraticCurveTo(14, 25, 19, 30);
    x.quadraticCurveTo(24, 27, 28, 33);
    x.quadraticCurveTo(33, 31, 36, 38);
    x.lineTo(38, 56);
    x.quadraticCurveTo(36, 72, 22, 76);
    x.lineTo(6, 76);
    x.quadraticCurveTo(-8, 70, -12, 56);
    // Başparmak
    x.lineTo(-22, 40);
    x.quadraticCurveTo(-24, 33, -16, 33);
    x.lineTo(-6, 44);
    x.closePath();
  };
  yol();
  x.fillStyle = 'rgba(255,248,236,0.92)';
  x.fill();
  x.lineWidth = 2.6;
  x.strokeStyle = 'rgba(40,24,16,0.85)';
  x.stroke();
  x.strokeStyle = 'rgba(40,24,16,0.35)';
  x.lineWidth = 1.4;
  x.beginPath();
  x.moveTo(9, 30);
  x.lineTo(10, 42);
  x.moveTo(19, 30);
  x.lineTo(20, 42);
  x.moveTo(28, 33);
  x.lineTo(29, 44);
  x.stroke();
  // Tırnak
  x.fillStyle = 'rgba(255,220,210,0.9)';
  x.beginPath();
  x.ellipse(0.5, 3, 2.8, 3.6, 0, 0, Math.PI * 2);
  x.fill();
}
