/**
 * Kutlama yazıları (GDD §8.2, §10.2, §11.5): kaskat kademeleri ("Güzel",
 * "Nefis", "Harika", "Şaheser!"), "Ebru Şöleni!" ve "Tekne çalkalanıyor…".
 * İri Cormorant Garamond; arkasında mürekkep sıçraması gibi kabaran leke.
 * Ölçek yay ile 0 → 1,25 → 1, 700 ms kalır, 250 ms'de solar.
 */
import { PALET } from '../app/katalog';
import { murekkepLekesi } from './efektler';
import { karma01, outCubic, yayAdim, type Yay } from './matematik';
import type { Ctx } from './tuval';

export const BASLIK_FONT = '"Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
export const GOVDE_FONT = '"Alegreya Sans", "Segoe UI", system-ui, sans-serif';

export type YaziStili = 'kaskat' | 'saheser' | 'solen' | 'bilgi';

export class Yazi {
  metin = '';
  stil: YaziStili = 'kaskat';
  private t = -1;
  private kal = 700;
  private yay: Yay = { x: 0, v: 0 };
  private tohum = 1;
  x = 0;
  y = 0;
  boy = 56;

  goster(metin: string, stil: YaziStili, x: number, y: number, boy: number, kalMs = 700): void {
    this.metin = metin;
    this.stil = stil;
    this.x = x;
    this.y = y;
    this.boy = boy;
    this.t = 0;
    this.kal = kalMs;
    this.yay = { x: 0, v: 0 };
    this.tohum = (this.tohum * 7 + 13) % 997;
  }

  aktif(): boolean {
    return this.t >= 0;
  }

  kapat(): void {
    this.t = -1;
  }

  guncelle(dt: number): void {
    if (this.t < 0) return;
    this.t += dt;
    yayAdim(this.yay, 1, dt);
    if (this.t > 180 + this.kal + 250) this.t = -1;
  }

  ciz(c: Ctx): void {
    if (this.t < 0 || !this.metin) return;
    const solma = Math.max(0, this.t - 180 - this.kal) / 250;
    const a = 1 - solma;
    const s = Math.max(0, this.yay.x);
    const bilgi = this.stil === 'bilgi';
    c.save();
    c.translate(this.x, this.y);
    c.globalAlpha = Math.max(0, a);
    // Mürekkep sıçraması (arkada kabaran leke).
    if (!bilgi) {
      const kab = outCubic(Math.min(1, this.t / 260));
      const w = this.boy * (0.55 + this.metin.length * 0.24);
      c.save();
      c.scale(1, 0.42);
      c.globalAlpha = 0.5 * a;
      c.fillStyle = '#120E0A';
      murekkepLekesi(c, 0, this.boy * 0.12, w * 0.62 * kab, this.tohum);
      c.fill();
      for (let i = 0; i < 7; i++) {
        const an = karma01(this.tohum, i) * Math.PI * 2;
        const d = w * (0.62 + karma01(this.tohum, i + 9) * 0.3) * kab;
        c.beginPath();
        c.arc(Math.cos(an) * d, Math.sin(an) * d + this.boy * 0.12, this.boy * (0.05 + karma01(this.tohum, i + 3) * 0.07), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.globalAlpha = Math.max(0, a);
    }
    c.scale(s, s);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    if (bilgi) {
      c.font = `800 ${Math.round(this.boy)}px ${GOVDE_FONT}`;
      c.strokeStyle = 'rgba(10,20,24,0.85)';
      c.lineWidth = this.boy * 0.22;
      c.strokeText(this.metin, 0, 0);
      c.fillStyle = PALET.kagit;
      c.fillText(this.metin, 0, 0);
    } else {
      c.font = `700 ${Math.round(this.boy)}px ${BASLIK_FONT}`;
      c.strokeStyle = '#1A120A';
      c.lineWidth = this.boy * 0.14;
      c.strokeText(this.metin, 0, 0);
      const g = c.createLinearGradient(0, -this.boy * 0.5, 0, this.boy * 0.45);
      if (this.stil === 'kaskat') {
        g.addColorStop(0, '#FFF8E6');
        g.addColorStop(0.55, PALET.kagit);
        g.addColorStop(1, PALET.altinAcik);
      } else {
        g.addColorStop(0, '#FFF3C4');
        g.addColorStop(0.5, PALET.altinAcik);
        g.addColorStop(1, PALET.altin);
      }
      c.fillStyle = g;
      c.fillText(this.metin, 0, 0);
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = Math.max(1, this.boy * 0.02);
      c.strokeText(this.metin, 0, -this.boy * 0.02);
    }
    c.restore();
  }
}
