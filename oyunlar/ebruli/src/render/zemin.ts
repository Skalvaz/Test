/**
 * Zemin katmanı (GDD §11.3, §13.5): suyun altındaki kâğıt, yağ lekesi ve
 * desen hücreleri. Durum imzası değişince (olay) offscreen'e yeniden pişer;
 * dönen yağ filmi ve boyanan desenin dairesel açılışı her karede çizilir.
 *
 *  - Kâğıt: krem kare (hücrenin %86'sı, alfa 0,85), tırtıklı kenar, ince lif
 *    dokusu; 2 kat = 3 px kaydırılmış ikinci yaprak.
 *  - Yağ: hücre zemini koyulaşır (#2A2F1E alfa 0,4) + yanardöner film
 *    (konik gradyan, alfa 0,25, 0,1 Hz döner).
 *  - Desen: istenen rengin motif parçası (taç yaprağı ya da sap) kesik
 *    çizgiyle (alfa 0,5); boyanınca dolu, ebru halkalı.
 */
import { PALET } from '../app/katalog';
import type { Palet } from '../app/sozlesme';
import type { TahtaGeometrisi } from '../app/sozlesme';
import type { GHucre, GorselTahta } from './gorselTahta';
import { karma01, TAU } from './matematik';
import { karistir, renkUclu, rgba, rgbHex } from './palet';
import { spriteUret, tuvalOlustur, type Ctx, type Sprite, type Tuval } from './tuval';

export class ZeminKatmani {
  private tuval: Tuval | null = null;
  private imza = '';
  private film: Sprite | null = null;
  private filmAnahtar = '';
  palet: Palet = 'standart';

  /** Durum imzası: değişince yeniden pişer. */
  private imzaHesapla(gt: GorselTahta, geo: TahtaGeometrisi, dpr: number): string {
    let s = `${geo.hucre}|${geo.x}|${geo.y}|${geo.w}|${geo.h}|${dpr}|${this.palet}|`;
    for (const h of gt.hucreler) s += h.delik ? '#' : `${h.kagit}${h.yag ? 1 : 0}${h.desen}${h.desenBoyali && h.desenAcilis >= 1 ? 1 : 0}`;
    return s;
  }

  /** Zeminde çizilecek bir şey var mı (boş bölümde katman atlanır). */
  bosMu(gt: GorselTahta): boolean {
    for (const h of gt.hucreler) if (h.kagit || h.yag || h.desen || h.delik) return false;
    return true;
  }

  ciz(c: Ctx, gt: GorselTahta, geo: TahtaGeometrisi, dpr: number, zamanMs: number): void {
    if (this.bosMu(gt)) return;
    const imza = this.imzaHesapla(gt, geo, dpr);
    if (imza !== this.imza || !this.tuval) {
      this.imza = imza;
      this.pisir(gt, geo, dpr);
    }
    const W = geo.w * geo.hucre;
    const H = geo.h * geo.hucre;
    c.drawImage(this.tuval!, geo.x, geo.y, W, H);
    // Dinamik: yağ filmi ve açılan desenler.
    const h = geo.hucre;
    const filmAnahtar = `${h}|${dpr}`;
    if (filmAnahtar !== this.filmAnahtar) {
      this.filmAnahtar = filmAnahtar;
      this.film = spriteUret(h, h, dpr, (cc) => yagFilmi(cc, h));
    }
    const aci = (zamanMs / 1000) * 0.1 * TAU;
    for (let i = 0; i < gt.hucreler.length; i++) {
      const hc = gt.hucreler[i];
      const x = geo.x + ((i % gt.w) + 0.5) * h;
      const y = geo.y + (Math.floor(i / gt.w) + 0.5) * h;
      if (hc.yag && this.film) {
        c.save();
        c.translate(x, y);
        c.rotate(aci + karma01(i, 9) * TAU);
        c.globalAlpha = 0.9;
        c.drawImage(this.film.t, -this.film.ox, -this.film.oy, this.film.w, this.film.h);
        c.restore();
      }
      if (hc.desen && hc.desenBoyali && hc.desenAcilis < 1) {
        c.save();
        c.beginPath();
        c.arc(x, y, h * 0.72 * hc.desenAcilis, 0, TAU);
        c.clip();
        c.translate(x, y);
        desenCiz(c, h, hc.desen, true, this.palet, i);
        c.restore();
      }
    }
  }

  private pisir(gt: GorselTahta, geo: TahtaGeometrisi, dpr: number): void {
    const h = geo.hucre;
    const W = gt.w * h;
    const H = gt.h * h;
    if (!this.tuval || this.tuval.width !== Math.ceil(W * dpr) || this.tuval.height !== Math.ceil(H * dpr)) {
      this.tuval = tuvalOlustur(W * dpr, H * dpr).tuval;
    }
    const c = this.tuval.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.tuval.width, this.tuval.height);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Delikler (teknenin dışı): ceviz dolgu + altın kenar.
    for (let i = 0; i < gt.hucreler.length; i++) {
      if (!gt.hucreler[i].delik) continue;
      const x = (i % gt.w) * h;
      const y = Math.floor(i / gt.w) * h;
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, PALET.ceviz);
      g.addColorStop(1, PALET.cevizKoyu);
      c.fillStyle = g;
      c.fillRect(x - 0.5, y - 0.5, h + 1, h + 1);
      c.strokeStyle = 'rgba(122,82,51,0.35)';
      c.lineWidth = 1;
      for (let k = 1; k < 5; k++) {
        c.beginPath();
        c.moveTo(x, y + (k * h) / 5 + Math.sin(k + i) * 2);
        c.quadraticCurveTo(x + h / 2, y + (k * h) / 5 + Math.cos(k * 1.7 + i) * 3, x + h, y + (k * h) / 5);
        c.stroke();
      }
    }
    for (let i = 0; i < gt.hucreler.length; i++) {
      if (!gt.hucreler[i].delik) continue;
      const x = (i % gt.w) * h;
      const y = Math.floor(i / gt.w) * h;
      const yan = (dx: number, dy: number) => {
        const k = gt.hucreler[i + dy * gt.w + dx];
        const xx = (i % gt.w) + dx;
        const yy = Math.floor(i / gt.w) + dy;
        return xx >= 0 && yy >= 0 && xx < gt.w && yy < gt.h && k && !k.delik;
      };
      c.strokeStyle = rgba(PALET.altin, 0.9);
      c.lineWidth = 1.6;
      c.beginPath();
      if (yan(0, -1)) (c.moveTo(x, y + 0.8), c.lineTo(x + h, y + 0.8));
      if (yan(0, 1)) (c.moveTo(x, y + h - 0.8), c.lineTo(x + h, y + h - 0.8));
      if (yan(-1, 0)) (c.moveTo(x + 0.8, y), c.lineTo(x + 0.8, y + h));
      if (yan(1, 0)) (c.moveTo(x + h - 0.8, y), c.lineTo(x + h - 0.8, y + h));
      c.stroke();
    }
    // Önce yağ zemini (koyulaşma), sonra kâğıtlar, en üstte desenler.
    for (let i = 0; i < gt.hucreler.length; i++) {
      const hc = gt.hucreler[i];
      if (hc.delik || !hc.yag) continue;
      const x = (i % gt.w) * h;
      const y = Math.floor(i / gt.w) * h;
      const g = c.createRadialGradient(x + h / 2, y + h / 2, h * 0.1, x + h / 2, y + h / 2, h * 0.62);
      g.addColorStop(0, rgba(PALET.yag, 0.55));
      g.addColorStop(0.75, rgba(PALET.yag, 0.4));
      g.addColorStop(1, rgba(PALET.yag, 0));
      c.fillStyle = g;
      c.fillRect(x - h * 0.1, y - h * 0.1, h * 1.2, h * 1.2);
    }
    for (let i = 0; i < gt.hucreler.length; i++) {
      const hc = gt.hucreler[i];
      if (hc.delik || !hc.kagit) continue;
      c.save();
      c.translate((i % gt.w) * h + h / 2, Math.floor(i / gt.w) * h + h / 2);
      kagitCiz(c, h, hc.kagit, i);
      c.restore();
    }
    for (let i = 0; i < gt.hucreler.length; i++) {
      const hc = gt.hucreler[i];
      if (hc.delik || !hc.desen) continue;
      if (hc.desenBoyali && hc.desenAcilis < 1) {
        // Açılan desen: kesik çizgili hali altta kalır, dolgu her karede.
        c.save();
        c.translate((i % gt.w) * h + h / 2, Math.floor(i / gt.w) * h + h / 2);
        desenCiz(c, h, hc.desen, false, this.palet, i);
        c.restore();
        continue;
      }
      c.save();
      c.translate((i % gt.w) * h + h / 2, Math.floor(i / gt.w) * h + h / 2);
      desenCiz(c, h, hc.desen, hc.desenBoyali, this.palet, i);
      c.restore();
    }
  }
}

/** Tek kâğıt yaprağı (tırtıklı kenarlı krem kare). (0,0) merkez. */
export function kagitYapragi(c: Ctx, h: number, tohum: number, alfa = 0.85): void {
  const s = h * 0.43;
  const yol = () => {
    c.beginPath();
    const N = 10;
    let ilk = true;
    for (let kenar = 0; kenar < 4; kenar++) {
      for (let i = 0; i < N; i++) {
        const u = i / N;
        const j = (karma01(tohum, kenar * 31 + i) - 0.5) * h * 0.035;
        let x = 0;
        let y = 0;
        if (kenar === 0) [x, y] = [-s + 2 * s * u, -s + j];
        else if (kenar === 1) [x, y] = [s + j, -s + 2 * s * u];
        else if (kenar === 2) [x, y] = [s - 2 * s * u, s + j];
        else [x, y] = [-s + j, s - 2 * s * u];
        if (ilk) c.moveTo(x, y);
        else c.lineTo(x, y);
        ilk = false;
      }
    }
    c.closePath();
  };
  c.globalAlpha = alfa;
  const g = c.createLinearGradient(-s, -s, s, s);
  g.addColorStop(0, '#FBF4E2');
  g.addColorStop(0.6, PALET.kagit);
  g.addColorStop(1, PALET.kagitGolge);
  c.fillStyle = g;
  yol();
  c.fill();
  // Lif dokusu.
  c.save();
  yol();
  c.clip();
  c.lineWidth = Math.max(0.5, h * 0.01);
  for (let i = 0; i < 9; i++) {
    const x = (karma01(tohum, 200 + i) - 0.5) * 2 * s;
    const y = (karma01(tohum, 300 + i) - 0.5) * 2 * s;
    const a = karma01(tohum, 400 + i) * Math.PI;
    c.strokeStyle = `rgba(150,120,80,${0.08 + karma01(tohum, 500 + i) * 0.08})`;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * h * 0.12, y + Math.sin(a) * h * 0.12);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = alfa * 0.9;
  c.strokeStyle = PALET.kagitKenar;
  c.lineWidth = Math.max(0.7, h * 0.016);
  yol();
  c.stroke();
  c.globalAlpha = 1;
}

/** Kâğıt hücresi: 1 ya da 2 kat (ikinci yaprak 3 px kaydırılmış, altta). */
export function kagitCiz(c: Ctx, h: number, kat: number, tohum: number): void {
  if (kat >= 2) {
    c.save();
    c.translate(3, 3);
    c.rotate(0.04);
    kagitYapragi(c, h, tohum * 7 + 3, 0.7);
    c.restore();
  }
  // Yaprağın suya düşen gölgesi.
  c.fillStyle = 'rgba(0,10,14,0.25)';
  c.fillRect(-h * 0.41 + 1.5, -h * 0.41 + 2.5, h * 0.86, h * 0.86);
  kagitYapragi(c, h, tohum);
}

/** Desen hücresi: istenen rengin motif parçası (kesik çizgi) ya da boyanmış hali. */
export function desenCiz(c: Ctx, h: number, renk: 3 | 5 | 6, boyali: boolean, palet: Palet, tohum: number): void {
  const [ana, acik, koyu] = renkUclu(renk, palet);
  const sap = renk === 6;
  const r = h * 0.4;
  const parca = () => {
    c.beginPath();
    if (sap) {
      // Sap: hafif kavisli gövde + yaprak.
      c.moveTo(-r * 0.12, -r);
      c.quadraticCurveTo(r * 0.05, 0, -r * 0.1, r);
      c.lineTo(r * 0.14, r);
      c.quadraticCurveTo(r * 0.3, 0, r * 0.12, -r);
      c.closePath();
      c.moveTo(r * 0.1, r * 0.3);
      c.quadraticCurveTo(r * 0.75, r * 0.1, r * 0.95, -r * 0.55);
      c.quadraticCurveTo(r * 0.35, -r * 0.35, r * 0.1, r * 0.3);
      c.closePath();
    } else {
      // Taç yaprağı: uca doğru sivrilen damla.
      c.moveTo(0, -r);
      c.bezierCurveTo(r * 0.75, -r * 0.35, r * 0.9, r * 0.55, 0, r * 0.95);
      c.bezierCurveTo(-r * 0.9, r * 0.55, -r * 0.75, -r * 0.35, 0, -r);
      c.closePath();
    }
  };
  if (boyali) {
    const g = c.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r * 1.05);
    g.addColorStop(0, acik);
    g.addColorStop(0.55, ana);
    g.addColorStop(1, koyu);
    c.fillStyle = g;
    parca();
    c.fill();
    // Ebru dokusu: parçanın içinde ince halkalar.
    c.save();
    parca();
    c.clip();
    c.lineWidth = Math.max(0.7, h * 0.018);
    for (let k = 0; k < 3; k++) {
      c.strokeStyle = k % 2 ? rgba(koyu, 0.35) : 'rgba(243,233,210,0.4)';
      c.beginPath();
      const ox = (karma01(tohum, k) - 0.5) * r * 0.4;
      c.arc(ox, r * 0.1, r * (0.35 + k * 0.22), 0, TAU);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = rgba(PALET.altin, 0.9);
    c.lineWidth = Math.max(1, h * 0.03);
    parca();
    c.stroke();
  } else {
    c.fillStyle = rgba(ana, 0.12);
    parca();
    c.fill();
    c.setLineDash([h * 0.07, h * 0.05]);
    c.strokeStyle = rgba(rgbHex(karistir(ana, '#FFFFFF', 0.25)), 0.6);
    c.lineWidth = Math.max(1, h * 0.03);
    parca();
    c.stroke();
    c.setLineDash([]);
  }
}

/** Yağ filmi: yanardöner konik gradyan, alfa 0,25 (çizici döndürür). */
function yagFilmi(c: Ctx, h: number): void {
  const r = h * 0.46;
  c.save();
  c.beginPath();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * TAU;
    const rr = r * (1 + 0.06 * Math.sin(a * 3) + 0.04 * Math.sin(a * 5 + 1));
    if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
  c.clip();
  const ctx = c as Ctx & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
  const renkler = ['#7FD6C2', '#E9D27A', '#E58FB4', '#8FA8F0', '#7FD6C2'];
  if (typeof ctx.createConicGradient === 'function') {
    const g = ctx.createConicGradient(0, 0, 0);
    renkler.forEach((k, i) => g.addColorStop(i / (renkler.length - 1), k));
    c.globalAlpha = 0.25;
    c.fillStyle = g;
    c.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  } else {
    c.globalAlpha = 0.2;
    for (let i = 0; i < 4; i++) {
      c.fillStyle = renkler[i];
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, r * 1.2, (i * TAU) / 4, ((i + 1) * TAU) / 4);
      c.fill();
    }
  }
  // Film halkaları (ince girişim çizgileri).
  c.globalAlpha = 0.35;
  c.lineWidth = Math.max(0.6, h * 0.012);
  for (let k = 1; k <= 3; k++) {
    c.strokeStyle = k % 2 ? 'rgba(200,255,240,0.6)' : 'rgba(255,200,240,0.5)';
    c.beginPath();
    c.ellipse(r * 0.1, -r * 0.05, r * 0.28 * k, r * 0.22 * k, 0.4, 0, TAU);
    c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
}

/** Hücre motif kılavuzu (önizleme): yalnız tip denetimi için dışa açık yardımcı. */
export const zeminVar = (h: GHucre): boolean => !!(h.kagit || h.yag || h.desen);
