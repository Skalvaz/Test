/**
 * Sahne çizimi: gök, deniz, dip, canlılar, tekne, yağmur, balonlar, arayüz.
 * Her şey Tuval'e gri değer olarak yazılır; 1-bit tarama Tuval.sun'da.
 * Yalnız görsel olan şeyler (yağmur, martı, plankton) burada yaşar ve
 * simülasyonun tohumlu rastgeleliğine dokunmaz.
 */
import {
  AMFORA, CIZME, Dunya, G, HAMSI, ISTAVRIT, KILIC, LUFER, N_IP, PALAMUT, SURE, TUR,
  type Balik,
} from './dunya';
import {
  SPR_AMFORA, SPR_CAMI, SPR_CIZME, SPR_DENIZANASI, SPR_HAMSI, SPR_ISTAVRIT, SPR_KANCA, SPR_KEDI,
  SPR_CAPA, SPR_KABUK, SPR_KILCIK, SPR_KILIC, SPR_KIZKULESI, SPR_KULE, SPR_LUFER, SPR_MARTI, SPR_PALAMUT, SPR_REIS, SPR_TEKNE,
  SPR_VAPUR, SPR_YENGEC,
} from './sprite';
import { Tuval, yaziGenislik, type Sprite } from './tuval';

export interface Arayuz {
  durum: 'baslik' | 'oyun' | 'sonuc';
  rekor: number;
  yeniRekor: boolean;
  sesAcik: boolean;
  fazYazi: string;
  fazT: number;
  sonucT: number;
}

const BALIK_SPR: Sprite[] = [];
BALIK_SPR[HAMSI] = SPR_HAMSI;
BALIK_SPR[ISTAVRIT] = SPR_ISTAVRIT;
BALIK_SPR[PALAMUT] = SPR_PALAMUT;
BALIK_SPR[LUFER] = SPR_LUFER;
BALIK_SPR[KILIC] = SPR_KILIC;
BALIK_SPR[CIZME] = SPR_CIZME;
BALIK_SPR[AMFORA] = SPR_AMFORA;

const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const yumusak = (k: number): number => k * k * (3 - 2 * k);
const kes = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const AY_X = G - 30;

const LOGO = [
  ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
];

const GOMULER: [number, number, Sprite, boolean][] = [
  [34, 17, SPR_KILCIK, false],
  [118, 33, SPR_CAPA, false],
  [196, 16, SPR_KABUK, false],
  [268, 20, SPR_KILCIK, true],
  [352, 14, SPR_KABUK, true],
  [436, 12, SPR_CAPA, false],
  [500, 8, SPR_KABUK, false],
];

const BW = 256;
const BH = 64;

/** x'te döşenebilen fbm bulut dokusu. */
function bulutDokusu(): Float32Array {
  const d = new Float32Array(BW * BH);
  const kat = [
    [64, 20, 0.55],
    [32, 10, 0.28],
    [16, 5, 0.17],
  ];
  for (let o = 0; o < kat.length; o++) {
    const [hx, hy, guc] = kat[o];
    const nx = BW / hx;
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const fx = x / hx;
        const fy = y / hy;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const ux = yumusak(fx - ix);
        const uy = yumusak(fy - iy);
        const a = kes((ix % nx) + o * 17, iy + o * 31);
        const b = kes(((ix + 1) % nx) + o * 17, iy + o * 31);
        const c = kes((ix % nx) + o * 17, iy + 1 + o * 31);
        const e = kes(((ix + 1) % nx) + o * 17, iy + 1 + o * 31);
        d[y * BW + x] += (a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy) * guc;
      }
    }
  }
  return d;
}

interface Damla {
  x: number;
  y: number;
  uz: number;
  hiz: number;
  ton: number;
}

export class Sahne {
  private bulut = bulutDokusu();
  private yildiz: number[] = [];
  private damlalar: Damla[] = [];
  private sicrama: { x: number; t: number }[] = [];
  private plankton: { x: number; y: number; f: number }[] = [];
  private martilar: { x: number; y: number; hiz: number; f: number }[] = [];
  private otlar: { x: number; boy: number; faz: number }[] = [];
  private ruzgarCizgi: { x: number; y: number; uz: number }[] = [];
  private derinlik: Float32Array;
  private sx = 0;
  private sy = 0;
  private ayGuc = 1;

  constructor(
    private t: Tuval,
    private d: Dunya,
  ) {
    for (let i = 0; i < 46; i++) this.yildiz.push(Math.random() * G, Math.random() * d.deniz * 0.82, Math.random() * 6);
    for (let i = 0; i < 130; i++) this.damlalar.push(this.yeniDamla(true));
    for (let i = 0; i < 44; i++) {
      this.plankton.push({ x: Math.random() * 560, y: d.deniz + 8 + Math.random() * (d.yuk - d.deniz - 20), f: Math.random() * 6 });
    }
    for (let i = 0; i < 3; i++) {
      this.martilar.push({ x: Math.random() * G, y: 14 + Math.random() * d.deniz * 0.45, hiz: 9 + Math.random() * 8, f: Math.random() * 6 });
    }
    for (let i = 0; i < 34; i++) this.otlar.push({ x: 8 + Math.random() * 524, boy: 5 + Math.random() * 14, faz: Math.random() * 6 });
    for (let i = 0; i < 9; i++) this.ruzgarCizgi.push({ x: Math.random() * G, y: Math.random() * d.deniz, uz: 10 + Math.random() * 22 });
    this.derinlik = new Float32Array(d.yuk);
    for (let i = 0; i < d.yuk; i++) this.derinlik[i] = Math.exp(-i / 48);
  }

  private yeniDamla(ilk: boolean): Damla {
    const yakin = Math.random() < 0.45;
    return {
      x: Math.random() * (G + 60),
      y: ilk ? Math.random() * this.d.deniz : -Math.random() * 30,
      uz: yakin ? 7 + Math.random() * 9 : 3 + Math.random() * 4,
      hiz: yakin ? 300 + Math.random() * 80 : 190 + Math.random() * 50,
      ton: yakin ? 255 : 130,
    };
  }

  guncelle(dt: number): void {
    const d = this.d;
    const egik = 0.12 + d.firtina * 0.5;
    const etkin = Math.floor(this.damlalar.length * d.yagmur);
    for (let i = 0; i < this.damlalar.length; i++) {
      const p = this.damlalar[i];
      if (i >= etkin && p.y < 0) continue;
      p.y += p.hiz * dt;
      p.x -= p.hiz * egik * dt;
      const ys = d.yuzey(p.x + d.kam.x);
      if (p.y > ys) {
        if (p.ton === 255 && Math.random() < 0.6) this.sicrama.push({ x: p.x + d.kam.x, t: 0 });
        Object.assign(p, this.yeniDamla(false));
      }
    }
    for (let i = this.sicrama.length - 1; i >= 0; i--) {
      this.sicrama[i].t += dt;
      if (this.sicrama[i].t > 0.22) this.sicrama.splice(i, 1);
    }
    for (const m of this.martilar) {
      m.f += dt * 7;
      m.x += m.hiz * dt * (1 + d.firtina * 2);
      m.y += Math.sin(m.f * 0.3) * 3 * dt - d.firtina * 10 * dt;
      if (m.x > G + 20) {
        m.x = -20 - Math.random() * 60;
        m.y = 14 + Math.random() * d.deniz * 0.45;
      }
    }
    for (const r of this.ruzgarCizgi) {
      r.x -= (150 + r.uz * 6) * dt;
      if (r.x < -40) {
        r.x = G + Math.random() * 60;
        r.y = Math.random() * d.deniz;
      }
    }
    // Sarsıntı
    const s = d.sarsinti;
    this.sx = s > 0.02 ? Math.round((Math.random() - 0.5) * 4 * s) : 0;
    this.sy = s > 0.02 ? Math.round((Math.random() - 0.5) * 4 * s) : 0;
  }

  ciz(a: Arayuz): void {
    const t = this.t;
    t.temizle();
    this.gok();
    this.denizCiz();
    this.dipSusleri();
    this.canlilar();
    this.olta();
    this.tekne();
    this.havaUstu();
    this.balonlar();
    if (a.durum === 'oyun') this.hud(a);
    else if (a.durum === 'baslik') this.baslik(a);
    else this.sonuc(a);
  }

  // ---- Gök ----

  private gok(): void {
    const { t, d } = this;
    const W = t.w;
    const deniz = d.deniz;
    const z = d.zaman;
    const kam = d.kam.x;
    const ortu = sinirla(0.16 + 0.84 * Math.pow(sinirla(d.firtina + d.yagmur * 0.35, 0, 1), 0.7), 0, 1);

    // Ay
    const mx = AY_X - kam * 0.04 + this.sx;
    const my = 19 + d.t * 0.1;
    const ay = sinirla(1 - ortu * 0.95 + 0.12 - d.safak * 0.8, 0.12, 1);
    this.ayGuc = ay;
    t.isik(mx, my, 26, 80 * ay);
    t.daire(mx, my, 8, Math.round(255 * Math.min(1, ay * 1.15)));
    t.daire(mx + 4, my - 3, 7, Math.round(26 * ay));

    // Yıldızlar
    for (let i = 0; i < this.yildiz.length; i += 3) {
      const gor = 1 - ortu * 1.25 - d.safak * 1.6;
      if (kes(i, 3) > gor) continue;
      const parla = Math.sin(z * 1.7 + this.yildiz[i + 2]);
      if (parla < -0.7) continue;
      t.nokta(this.yildiz[i], this.yildiz[i + 1], parla > 0.9 ? 255 : 170);
    }

    // Bulutlar + şafak
    const esik = 0.7 - 0.3 * ortu;
    const parlak = (d.simsek ? 2.6 : 1) * (26 + 30 * ortu);
    const kay = z * (3 + 16 * d.firtina) + kam * 0.15;
    const safak = d.safak;
    const son = Math.min(t.h, deniz + 14);
    for (let y = 0; y < son; y++) {
      const yk = y / deniz;
      const zarf = 1 - yumusak(sinirla((yk - 0.38) / 0.6, 0, 1));
      const ty = Math.min(BH - 1, (yk * BH) | 0);
      const ty2 = (ty + 23) & (BH - 1);
      const gun = safak > 0 ? safak * 150 * Math.pow(Math.min(1, yk), 2.6) * (0.8 + 0.2 * Math.sin(y * 1.1)) : 0;
      for (let x = 0; x < W; x++) {
        const n =
          this.bulut[ty * BW + ((x + kay) & (BW - 1))] * 0.66 +
          this.bulut[ty2 * BW + ((x * 2 + kay * 1.7 + 97) & (BW - 1))] * 0.34;
        // Üç kademeli: bulutlar düz tonlu, kenarlı kümeler olur.
        const ham = (n - esik) * 3.4 * zarf;
        const yog = ham < 0.22 ? 0 : ham < 0.62 ? 0.45 : 1;
        const ek = yog * parlak + gun;
        if (ek < 1) continue;
        const i = y * W + x;
        const sVal = t.g[i] + ek;
        t.g[i] = sVal > 255 ? 255 : sVal;
      }
    }

    // Güneş (gecenin sonunda ufuktan doğar)
    if (d.t > 148) {
      const k = sinirla((d.t - 148) / (SURE - 148), 0, 1);
      t.daire(40 - kam * 0.04, deniz + 12 - 17 * k, 11, 255, true);
    }

    // Ufuk: tepeler, cami, kule
    const p = kam * 0.22;
    for (let x = 0; x < W; x++) {
      const wx = x + p;
      const hy = deniz - 3 - 4.5 * (Math.sin(wx * 0.021 + 1) + 1) - 2 * Math.sin(wx * 0.063) - 1.5 * Math.sin(wx * 0.17);
      for (let y = Math.round(hy); y < deniz + 10; y++) {
        const i = y * W + x;
        if (y < 0 || y >= t.h) continue;
        t.g[i] = 34;
        t.v[i] = 0;
      }
      // Kıyı ışıkları
      if (kes(Math.round(wx), 9) < 0.035 && Math.sin(z * 0.8 + wx) > -0.6 && d.safak < 0.7) t.vurgu(x, Math.round(hy) + 3);
    }
    t.ciz(SPR_CAMI, 62 - p, deniz - 20);
    t.ciz(SPR_KULE, 140 - p, deniz - 19);
    t.ciz(SPR_CAMI, 226 - p, deniz - 17);
    const kk = Math.round(20 - p);
    t.ciz(SPR_KIZKULESI, kk, deniz - 11, { ton: 255, hale: true });
    if (Math.sin(z * 2.2) > 0.2) {
      t.isik(kk + 5, deniz - 9, 10, 100);
      t.vurgu(kk + 5, deniz - 9);
    }

    // Vapur
    if (d.vapur) {
      const vx = Math.round(d.vapur.x);
      const vy = deniz - 9 + Math.round(Math.sin(z * 1.2) * 0.8);
      for (let i = 0; i < 5; i++) {
        const dx = vx + 12 - d.vapur.yon * (i * 6 + ((z * 9) % 6));
        t.isik(dx, vy - 4 - i * 2.5, 3 + i, 70);
      }
      t.ciz(SPR_VAPUR, vx, vy, { ters: d.vapur.yon < 0, ton: 235, hale: true });
    }

    // Martılar
    for (const m of this.martilar) {
      if (m.y < -4) continue;
      t.ciz(SPR_MARTI[Math.sin(m.f) > 0 ? 0 : 1], m.x, m.y, { hale: true });
    }

    // Şimşek
    const s = d.simsek;
    if (s) {
      const yol = s.yol;
      if (s.t > 0.2 || ((s.t * 40) | 0) % 2 === 0) {
        for (let i = 0; i < yol.length - 2; i += 2) {
          const x0 = yol[i] - kam;
          const x1 = yol[i + 2] - kam;
          t.cizgi(x0, yol[i + 1], x1, yol[i + 3], 255);
          t.cizgi(x0 + 1, yol[i + 1], x1 + 1, yol[i + 3], 255);
          if (i === 4 || i === 10) t.cizgi(x0, yol[i + 1], x0 + (i === 4 ? 12 : -10), yol[i + 1] + 13, 255);
        }
        t.isik(s.x - kam, yol[yol.length - 1], 26, 200);
      }
    }
  }

  // ---- Deniz ve dip ----

  private denizCiz(): void {
    const { t, d } = this;
    const W = t.w;
    const H = t.h;
    const z = d.zaman;
    const kam = d.kam.x;
    const isikK = sinirla(this.ayGuc + d.safak, 0, 1);
    const taban0 = 1 + 14 * d.safak;
    const tepe = 15 + 30 * d.safak;
    for (let x = 0; x < W; x++) {
      const wx = x + kam - this.sx;
      const ys = Math.round(d.yuzey(wx)) + this.sy;
      const tb = Math.round(d.taban(wx)) + this.sy;
      const huzme = Math.max(0, Math.sin(wx * 0.023 + z * 0.17) + 0.35) * 36 * isikK;
      for (let y = Math.max(0, ys); y < H; y++) {
        const i = y * W + x;
        t.v[i] = 0;
        if (y >= tb) {
          const dd = y - tb;
          if (dd === 0) t.g[i] = 255;
          else if (dd === 1) t.g[i] = 0;
          else {
            // Noktalı katman çizgileri: dip şeklini izler, derinde düzleşir.
            const kat = dd + Math.round(2.5 * Math.sin(wx * 0.06 + dd * 0.2));
            const cizgi = (kat === 13 || kat === 29 || kat === 48) && (Math.round(wx) & 1) === 0;
            t.g[i] = cizgi || kes(wx, y - this.sy) < 0.008 ? 255 : 3 + 44 * this.derinlik[Math.min(H - 1, dd * 4)];
          }
          continue;
        }
        const der = y - ys;
        const e = this.derinlik[der];
        let g = taban0 + tepe * e;
        if (huzme > 1) {
          const s = Math.sin((wx - der * 0.5) * 0.085 + z * 0.35);
          if (s > 0) g += s * s * huzme * Math.exp(-der / 95);
        }
        t.g[i] = g > 255 ? 255 : g;
      }
      if (ys >= 0 && ys < H) t.g[ys * W + x] = 255;
      // Fırtınada köpük
      if (d.firtina > 0.35 && kes(Math.round(wx), Math.floor(z * 7)) < 0.07 * d.firtina) {
        t.nokta(x, ys - 1 - Math.floor(kes(wx, z) * 3), 255);
      }
    }

    // Ay yakamozu
    const mx = AY_X - kam * 0.04;
    const adim = Math.floor(z * 5);
    for (let k = 1; k < 13; k++) {
      if (kes(k, adim) > this.ayGuc * 0.95) continue;
      const gx = Math.round(mx + (kes(k * 7, adim) - 0.5) * (6 + k * 2.4));
      const gy = Math.round(d.yuzey(gx + kam)) + 1 + k * 2;
      const uz = 1 + Math.floor(kes(k, 2) * 3);
      for (let u = 0; u < uz; u++) t.nokta(gx + u, gy, 255);
    }
    // Güneş yakamozu
    if (d.t > 150) {
      for (let k = 1; k < 10; k++) {
        if (kes(k + 40, adim) > 0.7) continue;
        const gx = Math.round(40 - kam * 0.04 + (kes(k * 3, adim) - 0.5) * (5 + k * 2));
        const gy = Math.round(d.yuzey(gx + kam)) + 1 + k * 2;
        t.vurgu(gx, gy);
        t.vurgu(gx + 1, gy);
      }
    }
  }

  private dipSusleri(): void {
    const { t, d } = this;
    const kam = d.kam.x - this.sx;
    const z = d.zaman;
    // Yosunlar
    for (const o of this.otlar) {
      const x = o.x - kam;
      if (x < -6 || x > G + 6) continue;
      const tb = d.taban(o.x) + this.sy;
      for (let k = 1; k < o.boy; k++) {
        const kk = k / o.boy;
        const px = Math.round(x + Math.sin(z * 1.3 + o.faz + k * 0.3) * kk * kk * 2.6);
        t.sil(px - 1, Math.round(tb - k));
        t.sil(px + 1, Math.round(tb - k));
        t.nokta(px, tb - k, 255);
        if (k % 3 === 1 && k < o.boy - 2) t.nokta(px + (k % 6 === 1 ? 1 : -1), tb - k - 1, 255);
      }
    }
    // Dibin altındaki gömüler
    for (const [gx, gd, spr, ters] of GOMULER) {
      const x = gx - kam;
      if (x < -20 || x > G + 20) continue;
      t.ciz(spr, x, d.taban(gx) + gd + this.sy, { hale: true, ters });
    }
    // Yengeç
    const yx = 360 + Math.sin(z * 0.13) * 50;
    t.ciz(SPR_YENGEC[Math.floor(z * 5) % 2], yx - kam - 4, d.taban(yx) - 5 + this.sy, { hale: true });
    // Plankton
    for (const p of this.plankton) {
      const px = p.x + Math.sin(z * 0.4 + p.f) * 5 - kam;
      const py = p.y + Math.cos(z * 0.3 + p.f * 2) * 4 + this.sy;
      if (px < 0 || px >= G) continue;
      if (py > d.taban(p.x) - 2 || Math.sin(z * 1.3 + p.f * 3) < -0.2) continue;
      t.nokta(px, py, 190);
    }
  }

  // ---- Canlılar ----

  private canlilar(): void {
    const { t, d } = this;
    const kam = d.kam.x - this.sx;
    for (const p of d.parcalar) {
      const x = p.x - kam;
      const y = p.y + this.sy;
      if (p.tip === 'kivilcim') {
        t.vurgu(x, y);
        t.vurgu(x + 1, y);
      } else if (p.tip === 'kalp') {
        t.vurgu(x - 1, y - 1);
        t.vurgu(x + 1, y - 1);
        t.vurgu(x - 1, y);
        t.vurgu(x, y);
        t.vurgu(x + 1, y);
        t.vurgu(x, y + 1);
      } else t.nokta(x, y, 255);
    }

    for (const a of d.analar) {
      const x = a.x - kam;
      if (x < -12 || x > G + 12) continue;
      const kare = Math.sin(a.faz) > 0 ? 0 : 1;
      t.ciz(SPR_DENIZANASI[kare], x - 5, a.y - 3 + this.sy, { hale: true });
    }

    for (const b of d.baliklar) {
      if (b.durum === 'olta') continue;
      this.balikCiz(b, kam);
    }
  }

  private balikCiz(b: Balik, kam: number): void {
    const t = this.t;
    const s = BALIK_SPR[b.tur];
    const x = b.x - kam;
    const y = b.y + this.sy;
    if (x < -44 || x > G + 44) return;
    if (TUR[b.tur].sira === 0) {
      t.ciz(s, x - s.w / 2, y - s.h + 4, { hale: true });
      return;
    }
    if (b.durum === 'ucus') {
      const dik = Math.sin(b.faz) > 0;
      if (dik) t.ciz(s, x - s.h / 2, y - s.w / 2, { dik: true, hale: true });
      else t.ciz(s, x - s.w / 2, y - s.h / 2, { ters: Math.sin(b.faz * 0.5) > 0, hale: true });
      return;
    }
    const g = s.h <= 3 ? 0.7 : s.h <= 5 ? 1 : 1.5;
    const hizli = b.durum === 'kac' || b.durum === 'ilgi' ? 1.5 : 1;
    const w = s.w;
    t.ciz(s, x - w / 2, y - s.h / 2, {
      ters: b.yon < 0,
      hale: true,
      kay: (sx) => Math.sin(b.faz - sx * 0.55) * g * hizli * (1 - sx / w),
    });
    if (b.unlem > 0) t.yazi('!', x, y - s.h / 2 - 8, { hiza: 0, zemin: true });
  }

  // ---- Olta ----

  private olta(): void {
    const { t, d } = this;
    if (d.kopuk > 0) return;
    const kam = d.kam.x - this.sx;
    const gergin = d.gerilim > 0.85 && Math.floor(d.zaman * 14) % 2 === 0;
    for (let i = 0; i < N_IP - 1; i++) {
      t.cizgi(d.ipX[i] - kam, d.ipY[i] + this.sy, d.ipX[i + 1] - kam, d.ipY[i + 1] + this.sy, 255, gergin);
    }
    const kx = d.kancaX - kam;
    const ky = d.kancaY + this.sy;
    const b = d.kancadaki;
    if (!b) {
      t.ciz(SPR_KANCA, kx - 2, ky, { hale: true });
      return;
    }
    const s = BALIK_SPR[b.tur];
    if (TUR[b.tur].sira === 0) {
      t.ciz(s, kx - s.w / 2, ky, { hale: true });
      return;
    }
    const cirp = b.cirp > 0 ? 2.2 : 1;
    const w = s.w;
    t.ciz(s, kx - s.h / 2, ky - 1, {
      dik: true,
      hale: true,
      kay: (sx) => Math.sin(b.faz * cirp - sx * 0.6) * (0.8 + cirp * 0.5) * (1 - sx / w),
    });
    if (b.cirp > 0 && TUR[b.tur].agirlik >= 0.4 && Math.floor(d.zaman * 10) % 2 === 0) {
      t.yazi('!!', kx + s.h / 2 + 4, ky + 2, { zemin: true, vurgu: true });
    }
  }

  // ---- Tekne ----

  private tekne(): void {
    const { t, d } = this;
    const tk = d.tekne;
    const tx = Math.round(tk.x - d.kam.x + this.sx);
    const ty = Math.round(tk.y) + this.sy;
    const e = tk.egim;
    const yat = (dx: number): number => Math.round(dx * e);

    // Fener ışığı
    const fx = tx + 8;
    const fy = ty - 19 + yat(8);
    t.isik(fx, fy + 1, 24, 95);

    // Direk ve fener
    t.cizgi(tx + 4, ty - 4 + yat(4), tx + 4, ty - 24 + yat(4), 255);
    t.cizgi(tx + 4, ty - 24 + yat(4), tx + 8, ty - 24 + yat(8), 255);
    t.nokta(fx, fy - 4, 255);
    t.kutu(fx - 2, fy - 3, 5, 1, 255);
    t.kutu(fx - 2, fy + 2, 5, 1, 255);
    t.nokta(fx - 2, fy - 2, 255);
    t.nokta(fx + 2, fy - 2, 255);
    t.nokta(fx - 2, fy + 1, 255);
    t.nokta(fx + 2, fy + 1, 255);
    for (let yy = -2; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) t.vurgu(fx + xx, fy + yy);

    // Gövde
    t.ciz(SPR_TEKNE, tx - 23, ty - 5, { hale: true, kay: (sx) => (sx - 23) * e });

    // Reis
    const asiliyor = d.kancadaki !== null && d.cekiyor;
    const rs = SPR_REIS[asiliyor ? 1 : 0];
    const rx = tx - 18;
    const ry = ty - 14 + yat(-13);
    t.ciz(rs, rx, ry, { hale: true });

    // Olta kamışı
    if (d.kopuk <= 0 || Math.floor(d.zaman * 10) % 2 === 0) {
      const ex = rx;
      const ey = ry + 8;
      const ux = d.ucX() - d.kam.x + this.sx;
      const uy = d.ucY() + this.sy;
      const ox = (ex + ux) / 2 - 1;
      const oy = (ey + uy) / 2 - 2 + d.gerilim * 2.5;
      t.cizgi(ex, ey, ox, oy, 255);
      t.cizgi(ox, oy, ux, uy, 255);
    }

    // Kedi
    let kare = Math.floor(d.zaman * 1.3) % 5 === 0 ? 1 : 0;
    if (d.kediYiyor > 0) kare = 3;
    if (d.kediKabarik > 0) kare = 2;
    const zip = d.kediZipla > 0 ? Math.round(Math.sin((d.kediZipla / 0.5) * Math.PI) * 5) : 0;
    t.ciz(SPR_KEDI[kare], tx + 10, ty - 11 + yat(15) - zip, { hale: true });

    // Fenerin sudaki yansıması
    const adim = Math.floor(d.zaman * 6);
    for (let k = 0; k < 4; k++) {
      if (kes(k + 3, adim) < 0.45) continue;
      const gx = fx + Math.round((kes(k, adim) - 0.5) * 9);
      t.vurgu(gx, ty + 6 + k * 2);
      t.vurgu(gx + 1, ty + 6 + k * 2);
    }
  }

  // ---- Yağmur, rüzgâr ----

  private havaUstu(): void {
    const { t, d } = this;
    const egik = 0.12 + d.firtina * 0.5;
    const etkin = Math.floor(this.damlalar.length * d.yagmur);
    for (let i = 0; i < this.damlalar.length; i++) {
      const p = this.damlalar[i];
      if (i >= etkin && p.y < 0) continue;
      if (p.y < 0) continue;
      t.cizgi(p.x, p.y, p.x + p.uz * egik, p.y - p.uz, p.ton);
    }
    for (const s of this.sicrama) {
      const x = s.x - d.kam.x;
      const y = d.yuzey(s.x);
      const r = s.t < 0.1 ? 1 : 2;
      t.nokta(x - r, y - 1, 255);
      t.nokta(x + r, y - 1, 255);
      if (s.t < 0.1) t.nokta(x, y - 2, 255);
    }
    if (d.firtina > 0.5) {
      const n = Math.floor((d.firtina - 0.5) * 2 * this.ruzgarCizgi.length);
      for (let i = 0; i < n; i++) {
        const r = this.ruzgarCizgi[i];
        t.cizgi(r.x, r.y, r.x + r.uz, r.y - r.uz * 0.12, 110);
      }
    }
  }

  // ---- Balonlar ve uçan yazılar ----

  private balonlar(): void {
    const { t, d } = this;
    const kam = d.kam.x - this.sx;
    for (const b of d.balonlar) {
      const metin = b.metin.slice(0, Math.max(1, Math.floor(b.t * 38)));
      const tam = yaziGenislik(b.metin);
      const w = tam + 7;
      const h = 12;
      const ax = b.x - kam;
      const x = Math.round(sinirla(ax - w / 2, 1, G - w - 1));
      const y = Math.round(Math.max(12, b.y - h - 4 + this.sy));
      t.kutu(x - 1, y - 1, w + 2, h + 2, 0);
      t.cerceve(x, y, w, h, 255);
      const kx = Math.round(sinirla(ax, x + 3, x + w - 4));
      t.nokta(kx, y + h - 1, 0);
      t.nokta(kx - 1, y + h - 1, 0);
      t.nokta(kx + 1, y + h - 1, 0);
      t.nokta(kx - 1, y + h, 255);
      t.nokta(kx + 1, y + h, 255);
      t.nokta(kx, y + h + 1, 255);
      t.nokta(kx, y + h, 0);
      t.yazi(metin, x + 4, y + 4);
    }
    for (const y of d.yazilar) {
      if (y.t > 1.1 && Math.floor(y.t * 16) % 2 === 0) continue;
      t.yazi(y.metin, y.x - kam, y.y + this.sy, { hiza: 0, zemin: true, vurgu: y.vurgu });
    }
  }

  // ---- Arayüz ----

  private sesSimge(a: Arayuz): void {
    const t = this.t;
    const x = G - 12;
    const y = 5;
    t.kutu(x - 2, y - 2, 12, 10, 0);
    t.kutu(x, y + 2, 2, 2, 255);
    t.cizgi(x + 2, y + 1, x + 4, y - 1 + 0, 255);
    t.cizgi(x + 2, y + 4, x + 4, y + 6, 255);
    t.cizgi(x + 4, y - 1, x + 4, y + 6, 255);
    if (a.sesAcik) {
      t.nokta(x + 6, y + 2, 255);
      t.nokta(x + 6, y + 3, 255);
      t.cizgi(x + 8, y, x + 8, y + 5, 255);
    } else {
      t.cizgi(x + 6, y + 1, x + 9, y + 4, 255);
      t.cizgi(x + 9, y + 1, x + 6, y + 4, 255);
    }
  }

  private satirlar(metin: string, enCok: number): string[] {
    if (yaziGenislik(metin) <= enCok) return [metin];
    const kelime = metin.split(' ');
    let en = 0;
    let fark = 1e9;
    for (let i = 1; i < kelime.length; i++) {
      const f = Math.abs(yaziGenislik(kelime.slice(0, i).join(' ')) - yaziGenislik(kelime.slice(i).join(' ')));
      if (f < fark) {
        fark = f;
        en = i;
      }
    }
    return [kelime.slice(0, en).join(' '), kelime.slice(en).join(' ')];
  }

  private hud(a: Arayuz): void {
    const { t, d } = this;
    t.yazi(`${d.para} LİRA`, 5, 6, { zemin: true });
    const dk = 120 + Math.floor((Math.min(d.t, SURE) / SURE) * 240);
    const saat = `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`;
    t.yazi(saat, G / 2, 6, { hiza: 0, zemin: true });
    this.sesSimge(a);

    const b = d.kancadaki;
    if (b) {
      const gw = 46;
      const gx = Math.round(G / 2 - gw / 2);
      const gy = 17;
      t.kutu(gx - 2, gy - 2, gw + 4, 19, 0);
      t.cerceve(gx, gy, gw, 5, 255);
      const dolu = Math.round(sinirla(d.gerilim, 0, 1.15) / 1.15 * (gw - 2));
      const tehlike = d.gerilim > 0.85;
      for (let x = 0; x < dolu; x++) {
        for (let y = 0; y < 3; y++) {
          if (tehlike) t.vurgu(gx + 1 + x, gy + 1 + y);
          else t.nokta(gx + 1 + x, gy + 1 + y, 255);
        }
      }
      const cizik = gx + 1 + Math.round((gw - 2) / 1.15);
      t.nokta(cizik, gy - 1, 255);
      t.nokta(cizik, gy + 5, 255);
      t.yazi(TUR[b.tur].ad, G / 2, gy + 9, { hiza: 0 });
    }

    if (a.fazYazi && a.fazT < 2.8 && (a.fazT > 0.5 || Math.floor(a.fazT * 12) % 2 === 0)) {
      t.yazi(a.fazYazi, G / 2, Math.round(d.deniz * 0.42), { hiza: 0, olcek: 2, zemin: true });
    }

    if (d.ipucu) {
      const s = this.satirlar(d.ipucu, G - 10);
      const y0 = d.yuk - 8 - s.length * 10;
      const en = Math.max(...s.map((x) => yaziGenislik(x)));
      t.kutu(Math.round(G / 2 - en / 2) - 4, y0 - 5, en + 8, s.length * 10 + 6, 0);
      t.cerceve(Math.round(G / 2 - en / 2) - 4, y0 - 5, en + 8, s.length * 10 + 6, 255);
      s.forEach((satir, i) => t.yazi(satir, G / 2, y0 + i * 10, { hiza: 0 }));
    }
  }

  /** Başlık: kalın harfler ve altında dalgalanan, taranmış yansıması. */
  private logo(y: number): void {
    const t = this.t;
    const olcek = 4;
    const adim = 6 * olcek;
    const toplam = LOGO.length * adim - olcek;
    const x0 = Math.round(G / 2 - toplam / 2);
    const dolu = (px: number, py: number): boolean => {
      if (px < 0 || py < 0 || px >= toplam || py >= 7 * olcek) return false;
      const n = Math.floor(px / adim);
      const gx = Math.floor((px - n * adim) / olcek);
      return gx < 5 && LOGO[n][Math.floor(py / olcek)][gx] === '#';
    };
    const h = 7 * olcek;
    for (let py = -1; py <= h; py++) {
      for (let px = -1; px <= toplam; px++) {
        const ic = dolu(px, py);
        if (ic) t.nokta(x0 + px, y + py, 255);
        else if (dolu(px - 1, py) || dolu(px + 1, py) || dolu(px, py - 1) || dolu(px, py + 1)) t.sil(x0 + px, y + py);
      }
    }
    for (let r = 0; r < 12; r++) {
      const kay = Math.round(Math.sin(this.d.zaman * 2.4 + r * 0.8) * (0.6 + r * 0.16));
      const ton = 120 - r * 8;
      for (let px = 0; px < toplam; px++) {
        if (dolu(px, h - 1 - r * 2)) t.nokta(x0 + px + kay, y + h + 3 + r, ton);
      }
    }
  }

  private baslik(a: Arayuz): void {
    const { t, d } = this;
    const y = Math.round(d.deniz * 0.2);
    this.logo(y);
    t.yazi('GECE BALIKÇISI', G / 2, y + 49, { hiza: 0, zemin: true });
    if (Math.floor(d.zaman * 1.6) % 2 === 0) {
      t.yazi('DOKUN VE BAŞLA', G / 2, Math.round(d.deniz + (d.yuk - d.deniz) * 0.4), { hiza: 0, zemin: true });
    }
    const y2 = d.yuk - 34;
    t.yazi('BASILI TUT: OLTA İNER', G / 2, y2, { hiza: 0, zemin: true });
    t.yazi('BIRAK: MİSİNA SARILIR', G / 2, y2 + 10, { hiza: 0, zemin: true });
    if (a.rekor > 0) t.yazi(`REKOR ${a.rekor} LİRA`, G / 2, y2 + 22, { hiza: 0, zemin: true, vurgu: true });
    this.sesSimge(a);
  }

  private sonuc(a: Arayuz): void {
    const { t, d } = this;
    const satir: [string, string, string][] = [];
    for (const tur of [HAMSI, ISTAVRIT, PALAMUT, LUFER, KILIC, AMFORA, CIZME]) {
      const n = d.yakalanan[tur];
      if (!n) continue;
      const kedi = tur === HAMSI ? d.kediPayi : 0;
      satir.push([TUR[tur].ad, `x${n}`, String((n - kedi) * TUR[tur].deger)]);
    }
    const ek: string[] = [];
    if (d.kediPayi) ek.push(`KEDİNİN PAYI: ${d.kediPayi} HAMSİ`);
    if (d.enZincir) ek.push(`EN UZUN ZİNCİR: x${d.enZincir + 1}`);
    if (d.kopan) ek.push(`KOPAN MİSİNA: ${d.kopan}`);
    const h = 62 + satir.length * 10 + ek.length * 10 + (satir.length ? 4 : 10);
    const w = 146;
    const x = Math.round(G / 2 - w / 2);
    const y = Math.round(Math.max(8, d.yuk * 0.5 - h / 2));
    const gorunen = Math.floor(a.sonucT * 9);
    t.kutu(x - 1, y - 1, w + 2, h + 2, 0);
    t.cerceve(x, y, w, h, 255);
    t.cerceve(x + 2, y + 2, w - 4, h - 4, 90);
    let cy = y + 10;
    t.yazi('GÜN AĞARDI', G / 2, cy, { hiza: 0, olcek: 2 });
    cy += 20;
    let no = 0;
    if (!satir.length) {
      t.yazi('BU GECE RASTGELMEDİ.', G / 2, cy, { hiza: 0, });
      cy += 10;
    }
    for (const [ad, adet, deger] of satir) {
      if (no++ > gorunen) break;
      t.yazi(ad, x + 10, cy);
      t.yazi(adet, x + 88, cy, { hiza: 1 });
      t.yazi(deger, x + w - 10, cy, { hiza: 1 });
      cy += 10;
    }
    cy += 2;
    for (const e of ek) {
      if (no++ > gorunen) break;
      t.yazi(e, G / 2, cy, { hiza: 0 });
      cy += 10;
    }
    if (no <= gorunen) {
      cy = y + h - 30;
      for (let i = x + 8; i < x + w - 8; i += 2) t.nokta(i, cy - 6, 255);
      t.yazi(`${d.para} LİRA`, G / 2, cy, { hiza: 0, olcek: 2, vurgu: a.yeniRekor });
      cy += 15;
      if (a.yeniRekor) t.yazi('YENİ REKOR!', G / 2, cy, { hiza: 0, vurgu: Math.floor(d.zaman * 4) % 2 === 0 });
      else t.yazi(`REKOR ${a.rekor}`, G / 2, cy, { hiza: 0 });
    }
    if (a.sonucT > 1.6 && Math.floor(d.zaman * 1.6) % 2 === 0) {
      t.yazi('DOKUN: YENİ GECE', G / 2, Math.min(d.yuk - 10, y + h + 8), { hiza: 0, zemin: true });
    }
  }
}
