/**
 * Tuval yazıları (GDD §12.2 "Reaksiyon yazısı", §13.5): Güzel! / Harika! /
 * Muhteşem! / ŞENLİK! — ölçek 0→1,3→1 (yay k300 c14), harfler sinüsle
 * dalgalanır, 700 ms kalır, 250 ms'de solar; çevresinde 20 kıvılcım.
 * Harfler gösterim anında sprite'a pişirilir (olay anı; kare başına ayırma yok).
 * Kombinasyon adları ve "Sandık sallanıyor…" gibi küçük yazılar da buradan.
 */
import { yayAdim, type YayDurumu } from './matematik';
import { spriteUret, type Ctx, type Sprite } from './tuval';
import type { Donusum } from './donusum';

export const YAZI_FONT = '"Nunito", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif';

export interface YaziStili {
  boyut: number;
  /** Dolgu gradyan durakları (üst → alt). */
  dolgu: string[];
  kontur: string;
  /** Harf başına gökkuşağı. */
  gokkusagi?: boolean;
  /** Dalga genliği (px). */
  dalga: number;
  kalma: number;
  solma: number;
  /** Yay ile mi açılır (reaksiyon), yoksa yumuşak mı (bilgi). */
  yay: boolean;
}

export const STILLER: Record<string, YaziStili> = {
  guzel: { boyut: 44, dolgu: ['#FFFBEA', '#FFE08A', '#FFB020'], kontur: '#3A1A06', dalga: 3, kalma: 700, solma: 250, yay: true },
  harika: { boyut: 50, dolgu: ['#FFF6D8', '#FFC94D', '#FF7A1A'], kontur: '#3A1206', dalga: 4, kalma: 700, solma: 250, yay: true },
  muhtesem: { boyut: 56, dolgu: ['#FFF0FA', '#FF9AD0', '#FF5FB4'], kontur: '#3A0A24', dalga: 5, kalma: 700, solma: 250, yay: true },
  senlik: { boyut: 64, dolgu: ['#FFFFFF', '#FFE08A', '#FF7A1A'], kontur: '#24082A', gokkusagi: true, dalga: 6, kalma: 700, solma: 250, yay: true },
  kombo: { boyut: 34, dolgu: ['#FFFFFF', '#F2C66D', '#D9A441'], kontur: '#2A1406', dalga: 2.5, kalma: 650, solma: 250, yay: true },
  bilgi: { boyut: 22, dolgu: ['#FFF3D6', '#FFF3D6', '#CDB89A'], kontur: '#1A0C04', dalga: 1.2, kalma: 1100, solma: 300, yay: false },
};

const GOKKUSAGI = ['#FF5A5A', '#FFB347', '#FFF27A', '#5CFF9D', '#5CC8FF', '#C68CFF'];

interface Harf {
  sprite: Sprite;
  x: number;
}

export class Yazi {
  aktif = false;
  x = 0;
  y = 0;
  t = 0;
  stil: YaziStili = STILLER.guzel;
  private harfler: Harf[] = [];
  private olcek: YayDurumu = { x: 0, v: 0 };
  genislik = 0;

  /**
   * `enGenis` (px) verilirse yazı ondan genişse harf boyu orantılı küçülür
   * (uzun İngilizce kombo adları dar ekrana sığsın; sığan yazı aynen kalır).
   */
  goster(metin: string, stil: YaziStili, x: number, y: number, dpr: number, enGenis?: number): void {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.aktif = true;
    this.olcek.x = stil.yay ? 0 : 1;
    this.olcek.v = 0;
    const olc = spriteUret(1, 1, 1, () => {});
    const oc = olc.t.getContext('2d')!;
    const karakterler = [...metin];
    const olcum = (st: YaziStili) => {
      oc.font = `800 ${st.boyut}px ${YAZI_FONT}`;
      const g = karakterler.map((k) => oc.measureText(k).width);
      return { g, toplam: g.reduce((a, b) => a + b, 0) - Math.max(0, karakterler.length - 1) * st.boyut * 0.02 };
    };
    let o = olcum(stil);
    if (enGenis && enGenis > 0 && o.toplam > enGenis) {
      const k = enGenis / o.toplam;
      stil = { ...stil, boyut: stil.boyut * k, dalga: stil.dalga * k };
      o = olcum(stil);
    }
    this.stil = stil;
    const font = `800 ${stil.boyut}px ${YAZI_FONT}`;
    const genis = o.g;
    const toplam = o.toplam;
    this.genislik = toplam;
    let px = -toplam / 2;
    this.harfler = karakterler.map((k, i) => {
      const w = genis[i];
      const kw = Math.ceil(w + stil.boyut * 0.5);
      const kh = Math.ceil(stil.boyut * 1.5);
      const dolgu = stil.gokkusagi ? ['#FFFFFF', GOKKUSAGI[i % 6], GOKKUSAGI[(i + 1) % 6]] : stil.dolgu;
      const sp = spriteUret(kw, kh, dpr, (c) => harfCiz(c, k, font, stil, dolgu));
      const h: Harf = { sprite: sp, x: px + w / 2 };
      px += w - stil.boyut * 0.02;
      return h;
    });
  }

  gizle(): void {
    this.aktif = false;
  }

  guncelle(dt: number): void {
    if (!this.aktif) return;
    this.t += dt;
    if (this.stil.yay) yayAdim(this.olcek, 1, 300, 14, dt / 1000);
    if (this.t > this.stil.kalma + this.stil.solma) this.aktif = false;
  }

  ciz(c: Ctx, taban: Donusum, hareketiAzalt: boolean): void {
    if (!this.aktif) return;
    const st = this.stil;
    const solma = this.t > st.kalma ? 1 - (this.t - st.kalma) / st.solma : 1;
    const giris = st.yay ? 1 : Math.min(1, this.t / 160);
    c.globalAlpha = Math.max(0, solma) * giris;
    const o = Math.max(0, this.olcek.x);
    const yukari = st.yay ? 0 : (1 - giris) * 10;
    for (let i = 0; i < this.harfler.length; i++) {
      const h = this.harfler[i];
      const dalga = hareketiAzalt ? 0 : Math.sin(this.t * 0.012 - i * 0.55) * st.dalga;
      const aci = hareketiAzalt ? 0 : Math.sin(this.t * 0.01 - i * 0.7) * 0.05;
      taban.yerel(c, this.x + h.x * o, this.y + dalga * o + yukari, aci, o, o);
      c.drawImage(h.sprite.t, -h.sprite.ox, -h.sprite.oy, h.sprite.w, h.sprite.h);
    }
    c.globalAlpha = 1;
    taban.uygula(c);
  }
}

function harfCiz(c: Ctx, k: string, font: string, st: YaziStili, dolgu: string[]): void {
  c.font = font;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const b = st.boyut;
  // Kalın koyu kontur + alt gölge (kabartma)
  c.lineJoin = 'round';
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = b * 0.2;
  c.strokeText(k, 0, b * 0.08);
  c.strokeStyle = st.kontur;
  c.lineWidth = b * 0.17;
  c.strokeText(k, 0, 0);
  const g = c.createLinearGradient(0, -b * 0.42, 0, b * 0.38);
  g.addColorStop(0, dolgu[0]);
  g.addColorStop(0.5, dolgu[1]);
  g.addColorStop(1, dolgu[2]);
  c.fillStyle = g;
  c.fillText(k, 0, 0);
  // Üst parlama şeridi
  c.save();
  c.beginPath();
  c.rect(-b, -b, 2 * b, b * 0.78);
  c.clip();
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.fillText(k, 0, -b * 0.03);
  c.restore();
}
