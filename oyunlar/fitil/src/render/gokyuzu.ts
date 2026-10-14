/**
 * Arka plan katmanı (GDD §13.4, §16.6 katman 1): gökyüzü gradyanı, 3 katman
 * yıldız tozu (tohumlu 120/80/40 nokta, 0,05–0,2 Hz parıltı), kasaba silueti,
 * deniz (gökyüzünün dikey yansıması, 6 sinüs şerit 0,3 Hz) ve sandığın
 * oturduğu iskele. Durağan kısımlar yalnız boyut/tema değişince pişirilir;
 * karede yalnız birkaç drawImage ve ucuz şeritler çizilir.
 */
import { GOKYUZU, MAHALLELER } from '../app/katalog';
import { Rng } from '../platform/rng';
import { kasabaCiz, type Pencere } from './kasaba';
import { karistir, rgba } from './matematik';
import { P } from './palet';
import { tuvalOlustur, type Ctx, type Tuval } from './tuval';
import type { Dikdortgen } from '../app/sozlesme';

interface Yansima {
  x: number;
  renk: string;
  omur: number;
  yas: number;
}

export class Gokyuzu {
  private taban: Tuval | null = null;
  private orta: Tuval | null = null;
  private kasaba: Tuval | null = null;
  private kasabaY = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  mahalle = 0;
  /** Ufuk (kasaba tabanı) ve deniz üst sınırı (CSS px). */
  ufuk = 0;
  private yakin: { x: number; y: number; r: number; f: number; faz: number }[] = [];
  private pencereler: Pencere[] = [];
  private yansimalar: Yansima[] = [];
  private ust: string = P.gokUst;
  private alt: string = P.gokAlt;
  private ayVar = false;
  private ayX = 0;
  private ayY = 0;
  /** Deniz durağan mı (otomatik kalite düşük). */
  durgun = false;
  private serit = '#FFFFFF';

  kur(w: number, h: number, dpr: number, mahalle: number, gokBandi: Dikdortgen, sandik: Dikdortgen | null): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.mahalle = mahalle;
    const m = MAHALLELER[((mahalle % 8) + 8) % 8];
    const g = GOKYUZU[m.gokyuzu];
    this.ust = g.ust;
    this.alt = g.alt;
    this.ayVar = m.gokyuzu === 'ayIsigi' || m.gokyuzu === 'yildizYagmuru' || m.gokyuzu === 'denizMavisi';
    this.ufuk = Math.round(gokBandi.y + gokBandi.h + 6);
    this.serit = karistir(this.alt, '#FFFFFF', 0.35);
    const tohum = 0x51f1 + mahalle * 977;
    const r = new Rng(tohum);

    // --- Taban: gökyüzü + uzak yıldızlar + deniz + iskele -------------------
    const { tuval, ctx } = tuvalOlustur(w * dpr, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gg = ctx.createLinearGradient(0, 0, 0, this.ufuk);
    gg.addColorStop(0, this.ust);
    gg.addColorStop(0.7, karistir(this.ust, this.alt, 0.7));
    gg.addColorStop(1, this.alt);
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, w, this.ufuk + 1);
    // Ufuk sisi: şenlik ışıklarının gökteki yansıması
    const sis = ctx.createLinearGradient(0, this.ufuk - 90, 0, this.ufuk);
    sis.addColorStop(0, rgba(m.vurgu, 0));
    sis.addColorStop(1, rgba(karistir(m.vurgu, '#FFC86B', 0.5), 0.16));
    ctx.fillStyle = sis;
    ctx.fillRect(0, this.ufuk - 90, w, 90);
    // Uzak yıldız tozu (120)
    for (let i = 0; i < 120; i++) {
      const x = r.float() * w;
      const y = Math.pow(r.float(), 1.4) * (this.ufuk - 20);
      ctx.fillStyle = `rgba(255,248,230,${0.2 + r.float() * 0.35})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Samanyolu benzeri yumuşak bant
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const bx = w * (-0.1 + 1.2 * t);
      const by = this.ufuk * (0.15 + 0.35 * t) + (r.float() - 0.5) * 30;
      const br = 40 + r.float() * 50;
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bg.addColorStop(0, rgba(karistir(this.alt, '#9AA8FF', 0.4), 0.05));
      bg.addColorStop(1, rgba(this.alt, 0));
      ctx.fillStyle = bg;
      ctx.fillRect(bx - br, by - br, 2 * br, 2 * br);
    }
    ctx.restore();
    // Ay
    if (this.ayVar) {
      this.ayX = w * 0.82;
      this.ayY = Math.max(26, this.ufuk * 0.28);
      const ar = 13;
      const hale = ctx.createRadialGradient(this.ayX, this.ayY, ar * 0.5, this.ayX, this.ayY, ar * 5);
      hale.addColorStop(0, 'rgba(255,244,214,0.22)');
      hale.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = hale;
      ctx.fillRect(this.ayX - ar * 5, this.ayY - ar * 5, ar * 10, ar * 10);
      ctx.fillStyle = '#FFF3D6';
      ctx.beginPath();
      ctx.arc(this.ayX, this.ayY, ar, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = karistir(this.ust, this.alt, 0.25);
      ctx.beginPath();
      ctx.arc(this.ayX + ar * 0.45, this.ayY - ar * 0.2, ar * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
    // Deniz: gökyüzünün dikey yansıması, koyulaşarak
    const dg = ctx.createLinearGradient(0, this.ufuk, 0, h);
    dg.addColorStop(0, karistir(this.alt, P.denizUst, 0.35));
    dg.addColorStop(0.35, karistir(this.ust, P.denizAlt, 0.5));
    dg.addColorStop(1, P.denizUst);
    ctx.fillStyle = dg;
    ctx.fillRect(0, this.ufuk, w, h - this.ufuk);
    // Ay yansıması
    if (this.ayVar) {
      for (let y = this.ufuk + 4; y < h; y += 5) {
        const k = (y - this.ufuk) / (h - this.ufuk);
        const gen = 6 + 30 * k;
        ctx.fillStyle = `rgba(255,243,214,${0.1 * (1 - k)})`;
        ctx.fillRect(this.ayX - gen / 2 + Math.sin(y * 0.3) * 4, y, gen, 1.6);
      }
    }
    // İskele: sandığın altında ahşap ayaklar ve tahtalar
    if (sandik) {
      const sx = sandik.x + sandik.w * 0.08;
      const sw = sandik.w * 0.84;
      const sy = sandik.y + sandik.h - 4;
      ctx.fillStyle = '#120A06';
      for (let k = 0; k <= 4; k++) {
        const px = sx + (k / 4) * sw - 5;
        ctx.fillRect(px, sy, 10, h - sy);
        ctx.fillStyle = 'rgba(242,198,109,0.08)';
        ctx.fillRect(px, sy, 2, h - sy);
        ctx.fillStyle = '#120A06';
      }
      const pg = ctx.createLinearGradient(0, sy, 0, sy + 14);
      pg.addColorStop(0, '#3A2416');
      pg.addColorStop(1, '#1A0F08');
      ctx.fillStyle = pg;
      ctx.fillRect(sx - 14, sy + 6, sw + 28, 12);
      // Suya düşen ayak yansımaları
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = 0; k <= 4; k++) ctx.fillRect(sx + (k / 4) * sw - 7, sy + 18, 14, h - sy);
    }
    this.taban = tuval;

    // --- Orta yıldız katmanı (80) — alfa ile parıldar ------------------------
    const o = tuvalOlustur(w * dpr, this.ufuk * dpr);
    o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < 80; i++) {
      const x = r.float() * w;
      const y = Math.pow(r.float(), 1.3) * (this.ufuk - 16);
      const rr = 0.6 + r.float() * 0.8;
      o.ctx.fillStyle = `rgba(255,250,235,${0.45 + r.float() * 0.4})`;
      o.ctx.beginPath();
      o.ctx.arc(x, y, rr, 0, Math.PI * 2);
      o.ctx.fill();
    }
    this.orta = o.tuval;

    // --- Yakın yıldızlar (40) — tek tek, kendi fazlarıyla ---------------------
    this.yakin = [];
    for (let i = 0; i < 40; i++) {
      this.yakin.push({
        x: r.float() * w,
        y: Math.pow(r.float(), 1.2) * (this.ufuk - 24) + 4,
        r: 1 + r.float() * 1.4,
        f: 0.05 + r.float() * 0.15,
        faz: r.float() * Math.PI * 2,
      });
    }

    // --- Kasaba silueti -----------------------------------------------------
    const kh = 130;
    this.kasabaY = this.ufuk - kh;
    const k = tuvalOlustur(w * dpr, (kh + 12) * dpr);
    k.ctx.setTransform(dpr, 0, 0, dpr, 0, -this.kasabaY * dpr);
    this.pencereler = kasabaCiz(k.ctx, 0, w, this.ufuk, mahalle, tohum, 1);
    this.kasaba = k.tuval;
    // Kıyı: ufuk çizgisi ve kasaba ışıklarının sudaki titrek yansıması (tabana pişer).
    ctx.fillStyle = 'rgba(255,200,107,0.16)';
    ctx.fillRect(0, this.ufuk, w, 1);
    for (const p of this.pencereler) {
      const yuk = this.ufuk - p.y;
      if (yuk > 90) continue;
      const boy = Math.min(h - this.ufuk - 2, 8 + yuk * 0.6);
      for (let yy = 2; yy < boy; yy += 2.5) {
        const k2 = yy / boy;
        ctx.fillStyle = `rgba(255,200,107,${(0.22 * (1 - k2)).toFixed(3)})`;
        const gen = 2 + 3 * k2;
        ctx.fillRect(p.x - gen / 2 + Math.sin(yy * 0.9 + p.faz) * 1.5, this.ufuk + yy, gen, 1.2);
      }
    }
  }

  /** Gökte patlama: denizde renkli yansıma bırak. */
  yansit(x: number, renk: string): void {
    if (this.yansimalar.length > 10) this.yansimalar.shift();
    this.yansimalar.push({ x, renk, omur: 1400, yas: 0 });
  }

  guncelle(dt: number): void {
    for (let i = this.yansimalar.length - 1; i >= 0; i--) {
      const y = this.yansimalar[i];
      y.yas += dt;
      if (y.yas >= y.omur) this.yansimalar.splice(i, 1);
    }
  }

  /** Gökyüzü + yıldızlar (kasabadan önce). */
  cizArka(c: Ctx, zaman: number, yildizPiriltisi = 1): void {
    if (!this.taban || !this.orta) return;
    c.drawImage(this.taban, 0, 0, this.w, this.h);
    const t = zaman / 1000;
    c.globalAlpha = 0.65 + 0.35 * Math.sin(t * Math.PI * 2 * 0.11);
    c.drawImage(this.orta, 0, 0, this.w, this.ufuk);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#FFF6E1';
    for (const s of this.yakin) {
      const a = (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * s.f + s.faz))) * yildizPiriltisi;
      c.globalAlpha = a;
      c.fillRect(s.x - s.r * 0.5, s.y - s.r * 0.5, s.r, s.r);
      if (s.r > 2) {
        c.globalAlpha = a * 0.35;
        c.fillRect(s.x - s.r * 2, s.y - 0.4, s.r * 4, 0.8);
        c.fillRect(s.x - 0.4, s.y - s.r * 2, 0.8, s.r * 4);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /** Kasaba + deniz şeritleri + yansımalar (gök parçacıklarından sonra). */
  cizOn(c: Ctx, zaman: number): void {
    if (!this.kasaba) return;
    c.drawImage(this.kasaba, 0, this.kasabaY, this.w, this.kasaba.height / this.dpr);
    const t = zaman / 1000;
    // Pencere titreşimi: birkaçı yavaşça söner/parlar.
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#FFC86B';
    for (let i = 0; i < this.pencereler.length; i += 3) {
      const p = this.pencereler[i];
      c.globalAlpha = 0.18 + 0.18 * Math.sin(t * 0.9 + p.faz);
      c.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    c.globalAlpha = 1;
    // Deniz: 6 sinüs şerit (0,3 Hz), gökyüzünün alfa 0,25'i.
    const deniz = this.h - this.ufuk;
    if (deniz > 8) {
      c.fillStyle = this.serit;
      for (let k = 0; k < 6; k++) {
        const yy = this.ufuk + 3 + deniz * (0.04 + 0.16 * k * (1 + k * 0.25));
        if (yy > this.h) break;
        const faz = this.durgun ? k : t * Math.PI * 2 * 0.3 + k * 1.7;
        const kay = Math.sin(faz) * 18;
        const gen = this.w * (0.35 + 0.1 * Math.sin(faz * 0.7 + k));
        c.globalAlpha = 0.25 * (1 - k * 0.12);
        c.fillRect(this.w * ((k * 0.37) % 1) - gen / 2 + kay, yy, gen, 1 + k * 0.25);
        c.fillRect(this.w * ((k * 0.37 + 0.55) % 1) - gen / 3 - kay, yy + 2 + k, gen * 0.6, 1);
      }
      // Gökteki patlamaların renkli yansıması
      for (const y of this.yansimalar) {
        const a = 0.3 * (1 - y.yas / y.omur);
        c.fillStyle = y.renk;
        for (let s = 0; s < 7; s++) {
          const yy = this.ufuk + 4 + s * (deniz / 9);
          if (yy > this.h) break;
          const gen = 10 + s * 5;
          c.globalAlpha = a * (1 - s / 8);
          c.fillRect(y.x - gen / 2 + Math.sin(t * 5 + s) * 4, yy, gen, 1.5);
        }
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
