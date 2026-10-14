/**
 * Parçacık havuzu (GDD §16.6): 800 parçacık, yapı-dizisi (SoA) düzeni,
 * boş yuva yığını. Kare başına bellek ayırma yok. Taşma olursa yeni
 * parçacık sessizce atlanır.
 *
 * İki katman: tahta (kamera ile yakınlaşır) ve gök (`GOK` bayrağı; gök
 * bandındaki havai fişekler, kamera sarsıntısının yalnız bir kısmını alır).
 */
import type { Donusum } from './donusum';
import type { Ctx } from './tuval';
import type { PariltiSpritelari } from './sprite/parilti';
import { CIZGI_H, CIZGI_W, NOKTA_R } from './sprite/parilti';

export const HAVUZ = 800;

export const T = {
  NOKTA: 0,
  CIZGI: 1,
  DUMAN: 2,
  KIRINTI: 3,
  CUBUK: 4,
  KOZ: 5,
} as const;

export const B = {
  TITRESIM: 1, // karanfil: hızlı parlaklık titreşimi
  YANIP: 2, // ateş böceği: yavaş yanıp sönme
  PIRILTI: 4, // ömrün sonunda pırıltı (glitter)
  GOK: 8, // gök katmanı
  SABIT_BOY: 16, // ömür boyu küçülmez
  UST: 32, // ekran üstü katman (HUD kartları çevresi)
} as const;
const KATMAN = B.GOK | B.UST;

export class ParcacikHavuzu {
  readonly x = new Float32Array(HAVUZ);
  readonly y = new Float32Array(HAVUZ);
  readonly vx = new Float32Array(HAVUZ);
  readonly vy = new Float32Array(HAVUZ);
  readonly yas = new Float32Array(HAVUZ);
  readonly omur = new Float32Array(HAVUZ);
  readonly boyut = new Float32Array(HAVUZ);
  readonly surtunme = new Float32Array(HAVUZ);
  readonly yercekimi = new Float32Array(HAVUZ);
  readonly iz = new Float32Array(HAVUZ);
  readonly donus = new Float32Array(HAVUZ);
  readonly donusHizi = new Float32Array(HAVUZ);
  readonly acisal = new Float32Array(HAVUZ);
  readonly alfa = new Float32Array(HAVUZ);
  readonly buyume = new Float32Array(HAVUZ);
  readonly renk = new Uint8Array(HAVUZ);
  readonly tur = new Uint8Array(HAVUZ);
  readonly bayrak = new Uint8Array(HAVUZ);
  readonly aktif = new Uint8Array(HAVUZ);
  private readonly bos = new Int16Array(HAVUZ);
  private bosSayi = HAVUZ;
  /** Etkin parçacık sayısı (otomatik kalite ve test için). */
  sayi = 0;
  /** Kalite çarpanı (otomatik kalite düşükse 0,5): üreticiler sayıyı bununla çarpar. */
  oran = 1;

  constructor() {
    for (let i = 0; i < HAVUZ; i++) this.bos[i] = HAVUZ - 1 - i;
  }

  /** Kalite çarpanıyla sayı (en az 1, n > 0 ise). */
  adet(n: number): number {
    return n <= 0 ? 0 : Math.max(1, Math.round(n * this.oran));
  }

  ekle(tur: number, x: number, y: number, vx: number, vy: number, omur: number, boyut: number, renk: number, surtunme = 0, yercekimi = 0): number {
    if (this.bosSayi === 0) return -1;
    const i = this.bos[--this.bosSayi];
    this.aktif[i] = 1;
    this.sayi++;
    this.tur[i] = tur;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.yas[i] = 0;
    this.omur[i] = omur;
    this.boyut[i] = boyut;
    this.renk[i] = renk;
    this.surtunme[i] = surtunme;
    this.yercekimi[i] = yercekimi;
    this.iz[i] = 0;
    this.donus[i] = 0;
    this.donusHizi[i] = 0;
    this.acisal[i] = 0;
    this.alfa[i] = 1;
    this.buyume[i] = 0;
    this.bayrak[i] = 0;
    return i;
  }

  private sil(i: number): void {
    this.aktif[i] = 0;
    this.bos[this.bosSayi++] = i;
    this.sayi--;
  }

  temizle(): void {
    for (let i = 0; i < HAVUZ; i++) if (this.aktif[i]) this.sil(i);
  }

  guncelle(dtMs: number): void {
    if (dtMs <= 0 || this.sayi === 0) return;
    const t = dtMs / 1000;
    for (let i = 0; i < HAVUZ; i++) {
      if (!this.aktif[i]) continue;
      const yas = this.yas[i] + dtMs;
      this.yas[i] = yas;
      if (yas < 0) continue;
      if (yas >= this.omur[i]) {
        this.sil(i);
        continue;
      }
      const s = this.surtunme[i];
      if (s > 0) {
        const f = Math.exp(-s * t);
        this.vx[i] *= f;
        this.vy[i] *= f;
      }
      const w = this.acisal[i];
      if (w !== 0) {
        const co = Math.cos(w * t);
        const si = Math.sin(w * t);
        const vx = this.vx[i];
        this.vx[i] = vx * co - this.vy[i] * si;
        this.vy[i] = vx * si + this.vy[i] * co;
      }
      this.vy[i] += this.yercekimi[i] * t;
      this.x[i] += this.vx[i] * t;
      this.y[i] += this.vy[i] * t;
      this.donus[i] += this.donusHizi[i] * t;
    }
  }

  /**
   * Katmanı çiz. `katman`: 0 tahta, B.GOK ya da B.UST. `taban`: o katmanın
   * dönüşümü (DPR × kamera). İki geçiş: source-over (duman, kırıntı, çubuk)
   * ve lighter (ışıklar).
   */
  ciz(ctx: Ctx, sp: PariltiSpritelari, taban: Donusum, katman: number, zaman: number): void {
    if (this.sayi === 0) return;
    const istenen = katman;
    // 1. geçiş: opak türler
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < HAVUZ; i++) {
      if (!this.aktif[i] || this.yas[i] < 0 || (this.bayrak[i] & KATMAN) !== istenen) continue;
      const tur = this.tur[i];
      if (tur !== T.DUMAN && tur !== T.KIRINTI && tur !== T.CUBUK) continue;
      const f = this.yas[i] / this.omur[i];
      if (tur === T.DUMAN) {
        const s = this.boyut[i] * (1 + this.buyume[i] * f);
        ctx.globalAlpha = this.alfa[i] * (1 - f) * Math.min(1, f * 6);
        taban.sprite(ctx, sp.duman, this.x[i], this.y[i], this.donus[i], s / 32, s / 32);
      } else {
        ctx.globalAlpha = this.alfa[i] * Math.min(1, (1 - f) * 4);
        const s = this.boyut[i];
        taban.sprite(ctx, tur === T.KIRINTI ? sp.kirinti : sp.cubuk, this.x[i], this.y[i], this.donus[i], s, s);
      }
    }
    // 2. geçiş: ışıklar
    ctx.globalCompositeOperation = 'lighter';
    taban.uygula(ctx);
    for (let i = 0; i < HAVUZ; i++) {
      if (!this.aktif[i] || this.yas[i] < 0 || (this.bayrak[i] & KATMAN) !== istenen) continue;
      const tur = this.tur[i];
      if (tur === T.DUMAN || tur === T.KIRINTI || tur === T.CUBUK) continue;
      const f = this.yas[i] / this.omur[i];
      const bay = this.bayrak[i];
      let a = this.alfa[i] * (1 - f * f);
      if (bay & B.TITRESIM) a *= 0.55 + 0.45 * Math.sin(this.yas[i] * 0.09 + i * 1.7);
      if (bay & B.YANIP) a *= 0.5 + 0.5 * Math.sin(this.yas[i] * 0.008 + i * 2.3);
      if (bay & B.PIRILTI && f > 0.62) a *= ((((this.yas[i] / 45) | 0) + i) & 1) === 0 ? 1 : 0.15;
      if (tur === T.KOZ) a *= 0.65 + 0.35 * Math.sin(zaman * 0.02 + i * 3.1);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a > 1 ? 1 : a;
      const boy = bay & B.SABIT_BOY ? this.boyut[i] : this.boyut[i] * (1 - 0.55 * f);
      if (tur === T.CIZGI) {
        const vx = this.vx[i];
        const vy = this.vy[i];
        const hiz = Math.sqrt(vx * vx + vy * vy);
        const uz = Math.max(boy * 2.2, hiz * this.iz[i]);
        const sx = uz / (CIZGI_W - CIZGI_H / 2);
        // Sprite'ın parlak çekirdeği yüksekliğin ~%30'u: görünen kalınlık ≈ boy.
        const sy = (boy * 1.9) / (CIZGI_H / 2);
        taban.sprite(ctx, sp.cizgi[this.renk[i]], this.x[i], this.y[i], Math.atan2(vy, vx), sx, sy);
      } else {
        const s = sp.nokta[this.renk[i]];
        // Nokta sprite'ı hale içerir: çekirdek yarıçapı ≈ boy olacak biçimde büyüt.
        const r = (boy * 2.6) / NOKTA_R;
        taban.yerel(ctx, this.x[i], this.y[i], 0, r, r);
        ctx.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    taban.uygula(ctx);
  }
}
