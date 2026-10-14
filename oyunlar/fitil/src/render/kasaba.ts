/**
 * Tohumlu kasaba silueti (GDD §13.4, §10.1). Bina dizisi: genişlik 18–40 px,
 * yükseklik 30–90 px; çatı türleri düz, beşik, kubbe, kule; pencereler 4×6 px,
 * yanık pencere #FFC86B. Her mahallenin simge yapıları eklenir (iskele ve
 * kayıklar, kubbe ve minareler, vinçler, saat kulesi, çardak ve ağaçlar, yel
 * değirmeni ve rasathane, bacalar, surlar ve burçlar).
 *
 * Gece Tablosu da aynı çizimi kullanır (belirlenimli).
 */
import { Rng } from '../platform/rng';
import { GOKYUZU, MAHALLELER } from '../app/katalog';
import { karistir, rgba } from './matematik';
import type { Ctx } from './tuval';

export interface KasabaRenkleri {
  arka: string;
  on: string;
  vurgu: string;
}

export function kasabaRenkleri(mahalle: number): KasabaRenkleri {
  const m = MAHALLELER[((mahalle % 8) + 8) % 8];
  const g = GOKYUZU[m.gokyuzu];
  return {
    arka: karistir(karistir(g.alt, g.ust, 0.45), '#000000', 0.32),
    on: karistir(g.ust, '#000000', 0.55),
    vurgu: m.vurgu,
  };
}

/** Yanık pencerelerin konumları (çizimde titreşim için). */
export interface Pencere {
  x: number;
  y: number;
  faz: number;
}

/**
 * Siluet çiz: [sol, sol+gen] aralığında, `taban` çizgisine oturan iki katman.
 * `olcek` boyutları büyütür (Gece Tablosu 512 px genişlikte 1,2 kullanır).
 * Dönen pencere listesi yanık pencerelerdir.
 */
export function kasabaCiz(c: Ctx, sol: number, gen: number, taban: number, mahalle: number, tohum: number, olcek = 1): Pencere[] {
  const m = ((mahalle % 8) + 8) % 8;
  const r = new Rng((tohum ^ Math.imul(m + 1, 0x9e3779b9)) >>> 0);
  const renk = kasabaRenkleri(m);
  const pencereler: Pencere[] = [];

  // Arka katman: daha alçak, sisli.
  c.fillStyle = renk.arka;
  let x = sol - 10;
  while (x < sol + gen + 10) {
    const w = r.range(22, 46) * olcek;
    const h = r.range(18, 52) * olcek;
    const tur = r.int(4);
    binaYolu(c, x, taban, w, h, tur);
    c.fill();
    x += w + r.range(-4, 6) * olcek;
  }

  // Ön katman: bina dizisi + simge yapılar.
  const simgeX = sol + gen * (0.18 + r.float() * 0.6);
  const simgeG = 46 * olcek;
  x = sol - 6;
  while (x < sol + gen + 6) {
    if (x + 40 * olcek > simgeX && x < simgeX + simgeG) {
      x = simgeX + simgeG + 4 * olcek;
      continue;
    }
    const w = r.range(18, 40) * olcek;
    const h = r.range(30, 90) * olcek * (m === 1 ? 0.75 : 1);
    const tur = mahalleCatisi(m, r);
    c.fillStyle = renk.on;
    binaYolu(c, x, taban, w, h, tur);
    c.fill();
    // Çatı kenarına vurgu ışığı
    c.strokeStyle = rgba(renk.vurgu, 0.32);
    c.lineWidth = 1;
    binaYolu(c, x, taban, w, h, tur);
    c.stroke();
    // Pencereler 4×6 px
    const pw = 4 * olcek;
    const ph = 6 * olcek;
    const ust = taban - h + (tur === 0 ? 6 : 12) * olcek;
    for (let py = ust; py < taban - 10 * olcek; py += 11 * olcek) {
      for (let px = x + 4 * olcek; px < x + w - 6 * olcek; px += 8 * olcek) {
        if (r.float() < 0.42) {
          c.fillStyle = '#FFC86B';
          c.fillRect(px, py, pw, ph);
          pencereler.push({ x: px + pw / 2, y: py + ph / 2, faz: r.float() * Math.PI * 2 });
        } else if (r.float() < 0.5) {
          c.fillStyle = 'rgba(255,200,107,0.12)';
          c.fillRect(px, py, pw, ph);
        }
      }
    }
    x += w + r.range(0, 3) * olcek;
  }
  simgeCiz(c, m, simgeX, taban, olcek, renk, r, pencereler, sol, gen);
  return pencereler;
}

function mahalleCatisi(m: number, r: Rng): number {
  // 0 düz, 1 beşik, 2 kubbe, 3 kule
  const agirlik: number[][] = [
    [3, 5, 0, 1], // iskele: ahşap beşik çatılar
    [2, 1, 5, 2], // çarşı: kubbeler
    [5, 2, 0, 1], // liman: düz depolar
    [2, 4, 1, 3], // saat kulesi
    [1, 5, 2, 1], // bahçeler
    [2, 3, 2, 2], // tepe
    [5, 1, 0, 1], // fabrika
    [3, 1, 1, 4], // kale
  ];
  return r.weighted(agirlik[m]);
}

function binaYolu(c: Ctx, x: number, taban: number, w: number, h: number, tur: number): void {
  c.beginPath();
  c.moveTo(x, taban + 2);
  switch (tur) {
    case 1: // beşik
      c.lineTo(x, taban - h * 0.8);
      c.lineTo(x + w / 2, taban - h);
      c.lineTo(x + w, taban - h * 0.8);
      break;
    case 2: // kubbe
      c.lineTo(x, taban - h * 0.72);
      c.quadraticCurveTo(x, taban - h, x + w / 2, taban - h);
      c.quadraticCurveTo(x + w, taban - h, x + w, taban - h * 0.72);
      break;
    case 3: {
      // kule: dar gövde + sivri külah
      const k = w * 0.25;
      c.lineTo(x, taban - h * 0.55);
      c.lineTo(x + k, taban - h * 0.55);
      c.lineTo(x + k, taban - h * 0.82);
      c.lineTo(x + w / 2, taban - h);
      c.lineTo(x + w - k, taban - h * 0.82);
      c.lineTo(x + w - k, taban - h * 0.55);
      c.lineTo(x + w, taban - h * 0.55);
      break;
    }
    default:
      c.lineTo(x, taban - h);
      c.lineTo(x + w, taban - h);
  }
  c.lineTo(x + w, taban + 2);
  c.closePath();
}

function simgeCiz(c: Ctx, m: number, x: number, taban: number, o: number, renk: KasabaRenkleri, r: Rng, pen: Pencere[], sol: number, gen: number): void {
  c.fillStyle = renk.on;
  c.strokeStyle = renk.on;
  const isik = (px: number, py: number, rr = 1.6) => {
    c.fillStyle = '#FFC86B';
    c.beginPath();
    c.arc(px, py, rr * o, 0, Math.PI * 2);
    c.fill();
    pen.push({ x: px, y: py, faz: r.float() * Math.PI * 2 });
    c.fillStyle = renk.on;
  };
  switch (m) {
    case 0: {
      // İskele: deniz feneri + iskele direkleri + kayıklar
      c.beginPath();
      c.moveTo(x + 14 * o, taban + 2);
      c.lineTo(x + 18 * o, taban - 84 * o);
      c.lineTo(x + 30 * o, taban - 84 * o);
      c.lineTo(x + 34 * o, taban + 2);
      c.closePath();
      c.fill();
      c.fillRect(x + 15 * o, taban - 96 * o, 18 * o, 12 * o);
      c.beginPath();
      c.moveTo(x + 13 * o, taban - 96 * o);
      c.lineTo(x + 24 * o, taban - 106 * o);
      c.lineTo(x + 35 * o, taban - 96 * o);
      c.fill();
      isik(x + 24 * o, taban - 90 * o, 3.2);
      // Fener şeritleri
      c.fillStyle = rgba(renk.vurgu, 0.25);
      c.fillRect(x + 17 * o, taban - 60 * o, 14 * o, 4 * o);
      c.fillRect(x + 16 * o, taban - 34 * o, 16 * o, 4 * o);
      c.fillStyle = renk.on;
      for (let k = 0; k < 9; k++) c.fillRect(sol + (k / 8) * gen, taban - 6 * o, 2 * o, 10 * o);
      c.fillRect(sol, taban - 7 * o, gen, 2 * o);
      for (let k = 0; k < 3; k++) {
        const bx = sol + gen * (0.1 + 0.33 * k) + r.range(-10, 10);
        c.beginPath();
        c.moveTo(bx - 14 * o, taban - 2 * o);
        c.quadraticCurveTo(bx, taban + 6 * o, bx + 14 * o, taban - 2 * o);
        c.closePath();
        c.fill();
        c.fillRect(bx - o / 2, taban - 26 * o, o, 24 * o);
        c.beginPath();
        c.moveTo(bx + o, taban - 24 * o);
        c.lineTo(bx + 10 * o, taban - 6 * o);
        c.lineTo(bx + o, taban - 6 * o);
        c.fill();
        isik(bx - 6 * o, taban - 5 * o, 1.4);
      }
      break;
    }
    case 1: {
      // Çarşı: büyük kubbe + iki minare + mahya ışıkları
      c.beginPath();
      c.moveTo(x - 4 * o, taban + 2);
      c.lineTo(x - 4 * o, taban - 40 * o);
      c.quadraticCurveTo(x - 4 * o, taban - 72 * o, x + 23 * o, taban - 74 * o);
      c.quadraticCurveTo(x + 50 * o, taban - 72 * o, x + 50 * o, taban - 40 * o);
      c.lineTo(x + 50 * o, taban + 2);
      c.fill();
      c.fillRect(x + 22 * o, taban - 84 * o, 2 * o, 10 * o);
      const minare = (mx: number) => {
        c.fillRect(mx - 3 * o, taban - 104 * o, 6 * o, 106 * o);
        c.fillRect(mx - 5 * o, taban - 80 * o, 10 * o, 3 * o);
        c.beginPath();
        c.moveTo(mx - 3.5 * o, taban - 104 * o);
        c.lineTo(mx, taban - 122 * o);
        c.lineTo(mx + 3.5 * o, taban - 104 * o);
        c.fill();
      };
      const m1 = x - 14 * o;
      const m2 = x + 60 * o;
      minare(m1);
      minare(m2);
      // Mahya: minareler arasına gerilen ışıklar
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        const px = m1 + (m2 - m1) * t;
        const py = taban - 96 * o + Math.sin(t * Math.PI) * 14 * o;
        isik(px, py, 1.3);
      }
      break;
    }
    case 2: {
      // Liman: iki vinç + gemi direkleri
      for (const vx of [x, x + 34 * o]) {
        c.fillRect(vx, taban - 70 * o, 4 * o, 72 * o);
        c.beginPath();
        c.moveTo(vx - 26 * o, taban - 70 * o);
        c.lineTo(vx + 30 * o, taban - 76 * o);
        c.lineTo(vx + 30 * o, taban - 72 * o);
        c.lineTo(vx - 26 * o, taban - 67 * o);
        c.fill();
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(vx + 2 * o, taban - 86 * o);
        c.lineTo(vx - 26 * o, taban - 68 * o);
        c.moveTo(vx + 2 * o, taban - 86 * o);
        c.lineTo(vx + 30 * o, taban - 74 * o);
        c.moveTo(vx - 20 * o, taban - 68 * o);
        c.lineTo(vx - 20 * o, taban - 40 * o);
        c.stroke();
        c.fillRect(vx - 1, taban - 88 * o, 6 * o, 4 * o);
        isik(vx + 2 * o, taban - 88 * o, 1.5);
      }
      for (let k = 0; k < 2; k++) {
        const gx = sol + gen * (0.15 + 0.6 * k);
        c.beginPath();
        c.moveTo(gx - 30 * o, taban - 10 * o);
        c.lineTo(gx + 34 * o, taban - 10 * o);
        c.lineTo(gx + 26 * o, taban + 2);
        c.lineTo(gx - 26 * o, taban + 2);
        c.fill();
        c.fillRect(gx - 12 * o, taban - 58 * o, 2 * o, 48 * o);
        c.fillRect(gx + 10 * o, taban - 48 * o, 2 * o, 38 * o);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(gx - 11 * o, taban - 58 * o);
        c.lineTo(gx - 30 * o, taban - 10 * o);
        c.moveTo(gx - 11 * o, taban - 58 * o);
        c.lineTo(gx + 11 * o, taban - 48 * o);
        c.lineTo(gx + 34 * o, taban - 10 * o);
        c.stroke();
        isik(gx - 20 * o, taban - 6 * o, 1.3);
        isik(gx + 4 * o, taban - 6 * o, 1.3);
      }
      break;
    }
    case 3: {
      // Saat kulesi: yüksek kule + ışıklı kadran
      c.fillRect(x + 8 * o, taban - 96 * o, 30 * o, 98 * o);
      c.beginPath();
      c.moveTo(x + 4 * o, taban - 96 * o);
      c.lineTo(x + 23 * o, taban - 124 * o);
      c.lineTo(x + 42 * o, taban - 96 * o);
      c.fill();
      c.fillStyle = 'rgba(255,220,150,0.9)';
      c.beginPath();
      c.arc(x + 23 * o, taban - 76 * o, 10 * o, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = renk.on;
      c.lineWidth = 1.6 * o;
      c.beginPath();
      c.moveTo(x + 23 * o, taban - 76 * o);
      c.lineTo(x + 23 * o, taban - 83 * o);
      c.moveTo(x + 23 * o, taban - 76 * o);
      c.lineTo(x + 28 * o, taban - 74 * o);
      c.stroke();
      pen.push({ x: x + 23 * o, y: taban - 76 * o, faz: 0 });
      c.fillStyle = renk.on;
      for (let k = 0; k < 3; k++) isik(x + 16 * o + k * 7 * o, taban - 40 * o, 1.4);
      break;
    }
    case 4: {
      // Bahçeler: çardak + yuvarlak ağaçlar + ateş böcekleri
      c.beginPath();
      c.moveTo(x, taban - 34 * o);
      c.lineTo(x + 22 * o, taban - 56 * o);
      c.lineTo(x + 44 * o, taban - 34 * o);
      c.fill();
      c.fillRect(x + 4 * o, taban - 34 * o, 3 * o, 36 * o);
      c.fillRect(x + 37 * o, taban - 34 * o, 3 * o, 36 * o);
      c.fillRect(x + 2 * o, taban - 36 * o, 40 * o, 3 * o);
      for (let k = 0; k < 5; k++) isik(x + 8 * o + k * 7 * o, taban - 30 * o, 1.3);
      for (let k = 0; k < 4; k++) {
        const ax = sol + gen * (0.08 + k * 0.27) + r.range(-12, 12);
        const ar = r.range(14, 22) * o;
        c.fillRect(ax - 1.5 * o, taban - ar, 3 * o, ar + 2);
        c.beginPath();
        c.arc(ax, taban - ar - ar * 0.6, ar, 0, Math.PI * 2);
        c.arc(ax - ar * 0.6, taban - ar - ar * 0.2, ar * 0.7, 0, Math.PI * 2);
        c.arc(ax + ar * 0.6, taban - ar - ar * 0.25, ar * 0.7, 0, Math.PI * 2);
        c.fill();
      }
      for (let k = 0; k < 14; k++) {
        c.fillStyle = 'rgba(210,255,120,0.75)';
        c.beginPath();
        c.arc(sol + r.float() * gen, taban - r.float() * 70 * o, 1.1 * o, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = renk.on;
      break;
    }
    case 5: {
      // Tepe: tepe + yel değirmeni + rasathane kubbesi
      c.beginPath();
      c.moveTo(x - 50 * o, taban + 2);
      c.quadraticCurveTo(x + 20 * o, taban - 46 * o, x + 90 * o, taban + 2);
      c.fill();
      const dx = x + 6 * o;
      const dy = taban - 34 * o;
      c.beginPath();
      c.moveTo(dx - 8 * o, dy + 30 * o);
      c.lineTo(dx - 5 * o, dy - 6 * o);
      c.lineTo(dx + 5 * o, dy - 6 * o);
      c.lineTo(dx + 8 * o, dy + 30 * o);
      c.fill();
      for (let k = 0; k < 4; k++) {
        const a = 0.4 + (k * Math.PI) / 2;
        c.save();
        c.translate(dx, dy - 8 * o);
        c.rotate(a);
        c.fillRect(-1.5 * o, 0, 3 * o, 30 * o);
        c.fillRect(1.5 * o, 6 * o, 7 * o, 22 * o);
        c.restore();
      }
      c.beginPath();
      c.arc(x + 42 * o, taban - 30 * o, 16 * o, Math.PI, 0);
      c.fill();
      c.fillRect(x + 26 * o, taban - 30 * o, 32 * o, 14 * o);
      c.fillStyle = 'rgba(255,200,107,0.85)';
      c.save();
      c.translate(x + 42 * o, taban - 30 * o);
      c.rotate(-0.5);
      c.fillRect(-1.5 * o, -16 * o, 3 * o, 13 * o);
      c.restore();
      c.fillStyle = renk.on;
      break;
    }
    case 6: {
      // Fabrika: bacalar + testere dişi çatılı depo + duman
      for (let k = 0; k < 3; k++) {
        const bx = x + k * 16 * o;
        const bh = (70 + k * 14) * o;
        c.fillRect(bx, taban - bh, 8 * o, bh + 2);
        c.fillRect(bx - 1.5 * o, taban - bh, 11 * o, 4 * o);
        for (let s = 0; s < 4; s++) {
          c.fillStyle = `rgba(60,40,44,${0.42 - s * 0.09})`;
          c.beginPath();
          c.arc(bx + 4 * o + s * 7 * o, taban - bh - 6 * o - s * 9 * o, (5 + s * 3) * o, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = renk.on;
        isik(bx + 4 * o, taban - bh + 8 * o, 1.1);
      }
      const dx0 = sol + gen * 0.62;
      c.beginPath();
      c.moveTo(dx0, taban + 2);
      for (let k = 0; k < 5; k++) {
        c.lineTo(dx0 + k * 14 * o, taban - 32 * o);
        c.lineTo(dx0 + (k + 1) * 14 * o, taban - 22 * o);
      }
      c.lineTo(dx0 + 70 * o, taban + 2);
      c.fill();
      for (let k = 0; k < 5; k++) {
        c.fillStyle = 'rgba(255,170,90,0.7)';
        c.fillRect(dx0 + k * 14 * o + 2 * o, taban - 26 * o, 9 * o, 3 * o);
      }
      c.fillStyle = renk.on;
      break;
    }
    default: {
      // Kale: mazgallı sur + yuvarlak burçlar + bayrak
      const sw = 110 * o;
      const sx = x - 30 * o;
      c.fillRect(sx, taban - 34 * o, sw, 36 * o);
      for (let k = 0; k < 11; k++) c.fillRect(sx + k * 10 * o, taban - 40 * o, 6 * o, 6 * o);
      for (const bx of [sx - 6 * o, sx + sw - 16 * o]) {
        c.fillRect(bx, taban - 64 * o, 22 * o, 66 * o);
        c.beginPath();
        c.moveTo(bx - 3 * o, taban - 64 * o);
        c.lineTo(bx + 11 * o, taban - 86 * o);
        c.lineTo(bx + 25 * o, taban - 64 * o);
        c.fill();
        c.fillRect(bx + 10.5 * o, taban - 98 * o, 1.2 * o, 12 * o);
        c.fillStyle = renk.vurgu;
        c.beginPath();
        c.moveTo(bx + 11.7 * o, taban - 98 * o);
        c.lineTo(bx + 20 * o, taban - 95 * o);
        c.lineTo(bx + 11.7 * o, taban - 92 * o);
        c.fill();
        c.fillStyle = renk.on;
        isik(bx + 11 * o, taban - 50 * o, 1.5);
      }
      for (let k = 0; k < 8; k++) isik(sx + 8 * o + k * 13 * o, taban - 20 * o, 1.2);
    }
  }
}
