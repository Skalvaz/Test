/**
 * Parçacık havuzu (GDD §10.1): en fazla 400 parçacık, yapı-dizisi (SoA)
 * düzeni, boş yuva yığını; kare başına bellek ayırma yok. Havuz dolarsa yeni
 * parçacık sessizce atlanır. Düşük kalitede üreticiler `adet()` ile ×0,5.
 *
 * Türler: DAMLACIK (boya damlacığı, normal karışım), ISIK (parlak nokta,
 * `lighter`), IS (mürekkep is zerresi), LIF (krem kâğıt lifi), PUL (altın
 * varak pulu, döner, `lighter`), KIRINTI (mermer kırıntısı).
 */
import type { EfektSpritelari } from './sprite';
import { NOKTA_R } from './sprite';
import type { Ctx } from './tuval';

export const HAVUZ = 400;

export const PT = {
  DAMLACIK: 0,
  ISIK: 1,
  IS: 2,
  LIF: 3,
  PUL: 4,
  KIRINTI: 5,
} as const;

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
  readonly donus = new Float32Array(HAVUZ);
  readonly donusHizi = new Float32Array(HAVUZ);
  /** Açısal hız (rad/s): hız vektörünü döndürür (sarmal). */
  readonly acisal = new Float32Array(HAVUZ);
  readonly alfa = new Float32Array(HAVUZ);
  readonly renk = new Uint8Array(HAVUZ);
  readonly tur = new Uint8Array(HAVUZ);
  /** 1 = ekran üstü katman (kamera sarsıntısı almaz, HUD çevresi). */
  readonly ust = new Uint8Array(HAVUZ);
  readonly aktif = new Uint8Array(HAVUZ);
  private readonly bos = new Int16Array(HAVUZ);
  private bosSayi = HAVUZ;
  sayi = 0;
  /** Kalite çarpanı (otomatik kalite düşükse 0,5). */
  oran = 1;

  constructor() {
    for (let i = 0; i < HAVUZ; i++) this.bos[i] = HAVUZ - 1 - i;
  }

  adet(n: number): number {
    return n <= 0 ? 0 : Math.max(1, Math.round(n * this.oran));
  }

  /** Yeni parçacık; `gecikme` ms sonra görünür (yaş negatif başlar). Dolu havuzda −1. */
  ekle(tur: number, x: number, y: number, vx: number, vy: number, omur: number, boyut: number, renk: number, surtunme = 0, yercekimi = 0, gecikme = 0): number {
    if (this.bosSayi === 0) return -1;
    const i = this.bos[--this.bosSayi];
    this.aktif[i] = 1;
    this.sayi++;
    this.tur[i] = tur;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.yas[i] = -gecikme;
    this.omur[i] = omur;
    this.boyut[i] = boyut;
    this.renk[i] = renk;
    this.surtunme[i] = surtunme;
    this.yercekimi[i] = yercekimi;
    this.donus[i] = 0;
    this.donusHizi[i] = 0;
    this.acisal[i] = 0;
    this.alfa[i] = 1;
    this.ust[i] = 0;
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

  /** Katmanı çiz (`ust` 0 tahta, 1 ekran üstü). İki geçiş: normal ve `lighter`. */
  ciz(c: Ctx, sp: EfektSpritelari, ust: number): void {
    if (this.sayi === 0) return;
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < HAVUZ; i++) {
      if (!this.aktif[i] || this.yas[i] < 0 || this.ust[i] !== ust) continue;
      const tur = this.tur[i];
      if (tur === PT.ISIK || tur === PT.PUL) continue;
      const f = this.yas[i] / this.omur[i];
      const a = this.alfa[i] * (1 - f * f) * Math.min(1, this.yas[i] / 40 + 0.2);
      if (a <= 0.01) continue;
      c.globalAlpha = a > 1 ? 1 : a;
      const b = this.boyut[i] * (1 - 0.45 * f);
      if (tur === PT.DAMLACIK) {
        const s = sp.nokta[this.renk[i]];
        const r = (b * 2) / NOKTA_R;
        c.drawImage(s.t, this.x[i] - s.ox * r * 0.5, this.y[i] - s.oy * r * 0.5, s.w * r * 0.5, s.h * r * 0.5);
      } else {
        const s = tur === PT.IS ? sp.is : tur === PT.LIF ? sp.lif : sp.kirinti;
        const k = b / 6;
        c.save();
        c.translate(this.x[i], this.y[i]);
        c.rotate(this.donus[i]);
        c.drawImage(s.t, -s.ox * k, -s.oy * k, s.w * k, s.h * k);
        c.restore();
      }
    }
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < HAVUZ; i++) {
      if (!this.aktif[i] || this.yas[i] < 0 || this.ust[i] !== ust) continue;
      const tur = this.tur[i];
      if (tur !== PT.ISIK && tur !== PT.PUL) continue;
      const f = this.yas[i] / this.omur[i];
      let a = this.alfa[i] * (1 - f * f);
      if (tur === PT.PUL) a *= 0.6 + 0.4 * Math.sin(this.yas[i] * 0.03 + i);
      if (a <= 0.01) continue;
      c.globalAlpha = a > 1 ? 1 : a;
      const b = this.boyut[i] * (1 - 0.5 * f);
      if (tur === PT.ISIK) {
        const s = sp.nokta[this.renk[i]];
        const r = (b * 2.4) / NOKTA_R;
        c.drawImage(s.t, this.x[i] - s.ox * r * 0.5, this.y[i] - s.oy * r * 0.5, s.w * r * 0.5, s.h * r * 0.5);
      } else {
        const s = sp.pul;
        const k = b / 5;
        c.save();
        c.translate(this.x[i], this.y[i]);
        c.rotate(this.donus[i]);
        c.scale(k * Math.abs(Math.cos(this.donus[i] * 1.7)) + 0.15 * k, k);
        c.drawImage(s.t, -s.ox, -s.oy, s.w, s.h);
        c.restore();
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
