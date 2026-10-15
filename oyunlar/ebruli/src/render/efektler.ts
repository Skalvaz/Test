/**
 * Geçici efektler (GDD §10.2): su halkaları, boyanın suya açılması, karışım
 * kayması, tarak süpürmesi, girdap çöküşü, lale açılışı ve yaprakları,
 * mürekkep sıçraması, birleşim halkası, hedef kartına uçan damla ve kâğıt,
 * yükselen puan yazısı, mermer parçaları.
 *
 * Havuzlu (160 nesne, önceden ayrılmış): kare başına bellek ayırma yok;
 * havuz dolarsa en yaşlı efekt yeniden kullanılır. Zaman "oynatma ms"idir
 * (çizici hız çarpanıyla ilerletir).
 */
import { PALET } from '../app/katalog';
import type { Palet } from '../app/sozlesme';
import type { Renk, Yon } from '../core/types';
import { kagitYapragi } from './zemin';
import { inOutCubic, karma01, outCubic, TAU, bezier2 } from './matematik';
import { renkUclu, rgba } from './palet';
import type { DamlaSpritelari, EfektSpritelari } from './sprite';
import { spriteUret, type Ctx, type Sprite } from './tuval';

export const E = {
  HALKA: 1,
  LEKE: 2,
  KAYMA: 3,
  TARAK: 4,
  GIRDAP: 5,
  LALE: 6,
  YAPRAK: 7,
  MUREKKEP: 8,
  BIRLESIM: 9,
  UCUS: 10,
  KAGIT_UCUS: 11,
  METIN: 12,
  MERMER: 13,
  TARAK_IZ: 14,
} as const;

export interface Efekt {
  aktif: boolean;
  tur: number;
  /** Geçen süre (ms; negatif = gecikme). */
  t: number;
  sure: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r0: number;
  r1: number;
  a0: number;
  /** Renk kodu (0–7) ya da efekt renk dizini. */
  renk: number;
  renk2: number;
  yon: Yon;
  /** Tarak: hat boyunca hücre sayısı (merkezden iki yöne). */
  n1: number;
  n2: number;
  aci: number;
  tohum: number;
  /** Ekran üstü katman (HUD'a uçanlar): kamera sarsıntısı ve karartma almaz. */
  ust: boolean;
  metin: string;
  /** Bitince çağrılır (uçuş varışı → HUD bildirimi). */
  bitince: (() => void) | null;
}

const HAVUZ = 160;

function bosEfekt(): Efekt {
  return {
    aktif: false,
    tur: 0,
    t: 0,
    sure: 1,
    x: 0,
    y: 0,
    x2: 0,
    y2: 0,
    r0: 0,
    r1: 0,
    a0: 1,
    renk: 0,
    renk2: 0,
    yon: 'yatay',
    n1: 0,
    n2: 0,
    aci: 0,
    tohum: 0,
    ust: false,
    metin: '',
    bitince: null,
  };
}

export interface EfektCizimBaglami {
  spr: DamlaSpritelari;
  efs: EfektSpritelari;
  hucre: number;
  palet: Palet;
  dpr: number;
}

export class Efektler {
  readonly liste: Efekt[] = [];
  private sira = 0;
  private boyaliKagit = new Map<string, Sprite>();

  constructor() {
    for (let i = 0; i < HAVUZ; i++) this.liste.push(bosEfekt());
  }

  /** Boş efekt nesnesi al (alanları sıfırlanmış). */
  al(tur: number, sure: number, gecikme = 0): Efekt {
    let e: Efekt | undefined;
    for (let k = 0; k < HAVUZ; k++) {
      const c = this.liste[(this.sira + k) % HAVUZ];
      if (!c.aktif) {
        e = c;
        this.sira = (this.sira + k + 1) % HAVUZ;
        break;
      }
    }
    if (!e) {
      // Dolu: en yaşlıyı yeniden kullan (varsa bitiş geri çağrısını kaçırma).
      let en = this.liste[0];
      for (const c of this.liste) if (c.t / c.sure > en.t / en.sure) en = c;
      en.bitince?.();
      e = en;
    }
    Object.assign(e, bosEfekt());
    e.aktif = true;
    e.tur = tur;
    e.sure = Math.max(1, sure);
    e.t = -gecikme;
    return e;
  }

  sayi(): number {
    let n = 0;
    for (const e of this.liste) if (e.aktif) n++;
    return n;
  }

  temizle(): void {
    for (const e of this.liste) {
      if (e.aktif && e.bitince) e.bitince();
      e.aktif = false;
      e.bitince = null;
    }
  }

  guncelle(dt: number): void {
    for (const e of this.liste) {
      if (!e.aktif) continue;
      e.t += dt;
      if (e.t >= e.sure) {
        e.aktif = false;
        const f = e.bitince;
        e.bitince = null;
        f?.();
      }
    }
  }

  /** Bir katmanı çiz: `ust` false tahta (kamera ile), true ekran üstü. */
  ciz(c: Ctx, b: EfektCizimBaglami, ust: boolean, zamanMs: number): void {
    for (const e of this.liste) {
      if (!e.aktif || e.t < 0 || e.ust !== ust) continue;
      const f = Math.min(1, e.t / e.sure);
      switch (e.tur) {
        case E.HALKA: {
          const r = e.r0 + (e.r1 - e.r0) * outCubic(f);
          const a = e.a0 * (1 - f);
          if (a < 0.01) break;
          c.strokeStyle = rgba(e.renk === 0 ? PALET.kagit : renkUclu(e.renk as Renk, b.palet)[1], a);
          c.lineWidth = Math.max(0.8, b.hucre * 0.035 * (1 - f * 0.6));
          c.beginPath();
          c.arc(e.x, e.y, r, 0, TAU);
          c.stroke();
          break;
        }
        case E.LEKE: {
          const r = e.r0 + (e.r1 - e.r0) * outCubic(f);
          const s = b.spr.hale(e.renk as Renk | 0);
          const k = r / (b.hucre * 0.66);
          c.globalAlpha = e.a0 * (1 - f) * (1 - f);
          c.drawImage(s.t, e.x - s.ox * k, e.y - s.oy * k, s.w * k, s.h * k);
          c.globalAlpha = 1;
          break;
        }
        case E.KAYMA: {
          const u = outCubic(f);
          const x = e.x + (e.x2 - e.x) * u;
          const y = e.y + (e.y2 - e.y) * u;
          const s = b.spr.govde(e.renk as Renk, 'yok', 'yatay');
          const k = 1 - 0.45 * u;
          c.globalAlpha = 1 - 0.7 * u;
          c.save();
          c.translate(x, y);
          const dx = e.x2 - e.x;
          const dy = e.y2 - e.y;
          c.rotate(Math.atan2(dy, dx));
          c.scale(k * (1 + 0.25 * Math.sin(Math.PI * u)), k * (1 - 0.12 * Math.sin(Math.PI * u)));
          c.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
          c.restore();
          c.globalAlpha = 1;
          break;
        }
        case E.TARAK:
          this.tarakCiz(c, b, e);
          break;
        case E.TARAK_IZ:
          this.tarakIzCiz(c, b, e, f);
          break;
        case E.GIRDAP: {
          const kol = b.spr.girdapKol();
          const cok = Math.min(1, e.t / 400);
          // Baklava önce açılır (r1), sonra dönerek merkeze çöker.
          const r = f < 0.25 ? e.r1 * outCubic(f / 0.25) : e.r1 * (1 - 0.85 * inOutCubic((f - 0.25) / 0.75));
          const k = r / (b.hucre * 0.43);
          c.globalAlpha = 0.85 * (1 - f * f);
          c.save();
          c.translate(e.x, e.y);
          c.rotate(e.aci + cok * 7);
          c.scale(k, k);
          c.drawImage(kol.t, -kol.ox, -kol.oy, kol.w, kol.h);
          c.restore();
          // Sarmal iz (suda).
          c.strokeStyle = rgba(PALET.altinAcik, 0.35 * (1 - f));
          c.lineWidth = Math.max(1, b.hucre * 0.04);
          c.beginPath();
          for (let i = 0; i <= 60; i++) {
            const u = i / 60;
            const rr = e.r1 * 1.05 * (1 - u) * (0.4 + 0.6 * (1 - f));
            const a = e.aci + u * 9 + f * 5;
            const px = e.x + Math.cos(a) * rr;
            const py = e.y + Math.sin(a) * rr;
            if (i === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.stroke();
          c.globalAlpha = 1;
          break;
        }
        case E.LALE: {
          const s = b.spr.laleSiluet();
          const k = 1 + 1.6 * outCubic(f);
          c.globalAlpha = 0.95 * (1 - f);
          c.save();
          c.translate(e.x, e.y);
          c.scale(k, k);
          c.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
          c.restore();
          // Açılan taç yaprakları (6, dairesel).
          c.fillStyle = rgba('#F6E7C8', 0.8 * (1 - f));
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + e.aci;
            const rr = b.hucre * (0.3 + 1.1 * outCubic(f));
            c.save();
            c.translate(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
            c.rotate(a + Math.PI / 2);
            yaprakYolu(c, b.hucre * 0.22 * (1 - f * 0.5));
            c.fill();
            c.restore();
          }
          c.globalAlpha = 1;
          break;
        }
        case E.YAPRAK: {
          const u = inOutCubic(f);
          const x = bezier2(e.x, (e.x + e.x2) / 2 + (e.y2 - e.y) * 0.25, e.x2, u);
          const y = bezier2(e.y, (e.y + e.y2) / 2 - (e.x2 - e.x) * 0.25 - b.hucre * 0.4, e.y2, u);
          const [ana] = renkUclu(e.renk as Renk | 0, b.palet);
          c.save();
          c.translate(x, y);
          c.rotate(e.aci + u * 4);
          c.globalAlpha = f > 0.85 ? (1 - f) / 0.15 : 1;
          c.fillStyle = '#FBEFD6';
          yaprakYolu(c, b.hucre * 0.2);
          c.fill();
          c.fillStyle = rgba(ana, 0.75);
          yaprakYolu(c, b.hucre * 0.12);
          c.fill();
          c.restore();
          c.globalAlpha = 1;
          break;
        }
        case E.MUREKKEP: {
          const r = e.r1 * outCubic(Math.min(1, e.t / 200));
          c.globalAlpha = 0.85 * (1 - f) ** 1.5;
          c.fillStyle = '#16120E';
          murekkepLekesi(c, e.x, e.y, r, e.tohum);
          c.fill();
          // Uydu damlalar.
          for (let i = 0; i < 9; i++) {
            const a = karma01(e.tohum, i) * TAU;
            const d = r * (1.05 + karma01(e.tohum, i + 20) * 0.5);
            const rr = b.hucre * (0.05 + karma01(e.tohum, i + 40) * 0.08);
            c.beginPath();
            c.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, rr, 0, TAU);
            c.fill();
          }
          c.globalAlpha = 1;
          break;
        }
        case E.BIRLESIM: {
          const r = e.r1 * outCubic(f);
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = rgba(PALET.altinAcik, 0.8 * (1 - f));
          c.lineWidth = b.hucre * 0.12 * (1 - f) + 1;
          c.beginPath();
          c.arc(e.x, e.y, r, 0, TAU);
          c.stroke();
          c.strokeStyle = rgba('#FFFFFF', 0.5 * (1 - f));
          c.lineWidth = b.hucre * 0.05 * (1 - f) + 0.5;
          c.beginPath();
          c.arc(e.x, e.y, r * 0.7, 0, TAU);
          c.stroke();
          const p = b.efs.parilti;
          const k = (b.hucre * 2.6 * (1 - f * 0.5)) / 32;
          c.globalAlpha = 0.9 * (1 - f);
          c.drawImage(p.t, e.x - p.ox * k, e.y - p.oy * k, p.w * k, p.h * k);
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
          break;
        }
        case E.UCUS: {
          const u = inOutCubic(f);
          const x = bezier2(e.x, e.x + (e.x2 - e.x) * 0.2, e.x2, u);
          const y = bezier2(e.y, Math.min(e.y, e.y2) - b.hucre * 1.2, e.y2, u);
          const s = b.spr.govde(e.renk as Renk, 'yok', 'yatay');
          const k = 0.85 - 0.4 * u;
          c.drawImage(s.t, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
          // İz: arkada 4 silik kopya.
          for (let i = 1; i <= 3; i++) {
            const uu = Math.max(0, u - i * 0.05);
            const xx = bezier2(e.x, e.x + (e.x2 - e.x) * 0.2, e.x2, uu);
            const yy = bezier2(e.y, Math.min(e.y, e.y2) - b.hucre * 1.2, e.y2, uu);
            const kk = k * (1 - i * 0.18);
            c.globalAlpha = 0.25 / i;
            c.drawImage(s.t, xx - s.ox * kk, yy - s.oy * kk, s.w * kk, s.h * kk);
          }
          c.globalAlpha = 1;
          break;
        }
        case E.KAGIT_UCUS: {
          const u = inOutCubic(f);
          const x = bezier2(e.x, e.x - b.hucre * 0.8, e.x2, u);
          const y = bezier2(e.y, e.y - b.hucre * 1.6, e.y2, u);
          const s = this.boyaliKagitSprite(b, e.renk);
          // Köşeden kalkış: ilk %25'te x ekseninde daralarak döner.
          const kalk = Math.min(1, f / 0.25);
          c.save();
          c.translate(x, y);
          c.rotate(e.aci * u + 0.3 * kalk);
          const k = 1 - 0.55 * u;
          c.scale(k * (1 - 0.35 * Math.sin(Math.PI * kalk)), k);
          c.globalAlpha = f > 0.9 ? (1 - f) / 0.1 : 1;
          c.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
          c.restore();
          c.globalAlpha = 1;
          break;
        }
        case E.METIN: {
          const y = e.y - 34 * outCubic(f);
          const a = f < 0.7 ? 1 : (1 - f) / 0.3;
          const k = f < 0.15 ? 0.6 + 0.4 * outCubic(f / 0.15) * 1.1 : 1;
          c.save();
          c.globalAlpha = a;
          c.translate(e.x, y);
          c.scale(k, k);
          c.font = `800 ${Math.round(e.r0)}px "Alegreya Sans", "Segoe UI", system-ui, sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.lineJoin = 'round';
          c.strokeStyle = 'rgba(20,14,8,0.85)';
          c.lineWidth = Math.max(3, e.r0 * 0.22);
          c.strokeText(e.metin, 0, 0);
          c.fillStyle = e.renk2 ? PALET.kagit : PALET.altinAcik;
          c.fillText(e.metin, 0, 0);
          c.restore();
          break;
        }
        case E.MERMER: {
          const s = b.spr.mermer(e.tohum & 3, 1, 2);
          const h = b.hucre;
          const pw = s.t.width / 2;
          const ph = s.t.height / 2;
          for (let q = 0; q < 4; q++) {
            const dx = q % 2 ? 1 : -1;
            const dy = q < 2 ? -1 : 1;
            const u = outCubic(f);
            const x = e.x + dx * h * 0.45 * u;
            const y = e.y + dy * h * 0.3 * u + h * 0.6 * f * f;
            c.save();
            c.globalAlpha = 1 - f;
            c.translate(x, y);
            c.rotate(dx * dy * u * 0.9);
            c.drawImage(s.t, (q % 2) * pw, (q < 2 ? 0 : 1) * ph, pw, ph, (q % 2 ? 0 : -s.w / 2), (q < 2 ? -s.h / 2 : 0), s.w / 2, s.h / 2);
            c.restore();
          }
          c.globalAlpha = 1;
          break;
        }
      }
    }
    void zamanMs;
  }

  private tarakCiz(c: Ctx, b: EfektCizimBaglami, e: Efekt): void {
    const h = b.hucre;
    const hiz = h / 25; // px/ms
    const yatay = e.yon === 'yatay';
    const mesafe = e.t * hiz;
    const s = b.spr.govde(e.renk as Renk, 'tarak', e.yon);
    // İki yöne giden taraklar (yalnız tarak katmanı görünsün diye gövde küçük ve saydam).
    for (const [yonIsaret, n] of [
      [1, e.n2],
      [-1, e.n1],
    ] as const) {
      const sinir = (n + 0.5) * h;
      const d = Math.min(mesafe, sinir);
      const a = mesafe > sinir ? Math.max(0, 1 - (mesafe - sinir) / (h * 1.5)) : 1;
      if (a <= 0) continue;
      const x = e.x + (yatay ? d * yonIsaret : 0);
      const y = e.y + (yatay ? 0 : d * yonIsaret);
      c.globalAlpha = a;
      const k = 1.05;
      c.drawImage(s.t, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);
      // Uç parıltısı.
      c.globalCompositeOperation = 'lighter';
      const p = b.efs.altinHale;
      const kk = (h * 0.9) / 32;
      c.drawImage(p.t, x - p.ox * kk, y - p.oy * kk, p.w * kk, p.h * kk);
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
  }

  /** Suda tarağın bıraktığı dalgalı iz: 5 paralel çizgi, sinüs ofsetli, 600 ms'de solar. */
  private tarakIzCiz(c: Ctx, b: EfektCizimBaglami, e: Efekt, f: number): void {
    const h = b.hucre;
    const yatay = e.yon === 'yatay';
    const uz1 = (e.n1 + 0.5) * h;
    const uz2 = (e.n2 + 0.5) * h;
    const ilerleme = Math.min(1, e.t / Math.max(1, (Math.max(e.n1, e.n2) + 1) * 25));
    const a = 0.55 * (1 - Math.max(0, (f - 0.3) / 0.7));
    if (a <= 0.01) return;
    const [ana, acik] = renkUclu(e.renk as Renk | 0, b.palet);
    c.lineCap = 'round';
    for (let k = -2; k <= 2; k++) {
      c.strokeStyle = rgba(k % 2 === 0 ? acik : ana, a * (k === 0 ? 1 : 0.7));
      c.lineWidth = Math.max(0.8, h * 0.035);
      c.beginPath();
      const N = 40;
      for (let i = 0; i <= N; i++) {
        const u = -uz1 * ilerleme + ((uz1 + uz2) * ilerleme * i) / N;
        const ofs = k * h * 0.13 + Math.sin(u / (h * 0.32) + e.tohum + k * 0.6) * h * 0.05;
        const x = e.x + (yatay ? u : ofs);
        const y = e.y + (yatay ? ofs : u);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    }
  }

  private boyaliKagitSprite(b: EfektCizimBaglami, renk: number): Sprite {
    const anahtar = `${b.hucre}|${b.dpr}|${renk}|${b.palet}`;
    let s = this.boyaliKagit.get(anahtar);
    if (!s) {
      const h = b.hucre;
      s = spriteUret(h, h, b.dpr, (cc) => {
        kagitYapragi(cc, h, renk * 13 + 5, 1);
        if (renk) {
          const [ana, acik] = renkUclu(renk as Renk, b.palet);
          const g = cc.createRadialGradient(-h * 0.05, -h * 0.05, h * 0.03, 0, 0, h * 0.36);
          g.addColorStop(0, rgba(acik, 0.85));
          g.addColorStop(0.6, rgba(ana, 0.8));
          g.addColorStop(1, rgba(ana, 0));
          cc.fillStyle = g;
          cc.beginPath();
          cc.arc(0, 0, h * 0.36, 0, TAU);
          cc.fill();
          cc.strokeStyle = rgba(acik, 0.6);
          cc.lineWidth = h * 0.02;
          cc.beginPath();
          cc.arc(0, 0, h * 0.22, 0, TAU);
          cc.stroke();
        }
      });
      if (this.boyaliKagit.size > 24) this.boyaliKagit.clear();
      this.boyaliKagit.set(anahtar, s);
    }
    return s;
  }
}

/** Taç yaprağı yolu (0,0 merkez, uç yukarı). */
export function yaprakYolu(c: Ctx, r: number): void {
  c.beginPath();
  c.moveTo(0, -r);
  c.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.6, r * 0.6, 0, r);
  c.bezierCurveTo(-r * 0.6, r * 0.6, -r * 0.7, -r * 0.4, 0, -r);
  c.closePath();
}

/** Düzensiz mürekkep lekesi yolu (tohumlu). */
export function murekkepLekesi(c: Ctx, x: number, y: number, r: number, tohum: number): void {
  c.beginPath();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rr = r * (0.82 + 0.28 * karma01(tohum, i % N) + 0.08 * Math.sin(a * 5 + tohum));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}
