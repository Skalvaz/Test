/**
 * Engel ve zemin sprite'ları (GDD §13.2 "Engeller"). Hücre boyu c.
 *
 *  kaya[kat]        üst üste kat sayısı kadar taş; çatlak sayısı 3 − kat
 *                   (kat azaldıkça çatlar: "bir vuruş kaldı" dili, ısıdaki gibi)
 *  kova[kat]        ahşap kova, su seviyesi kata göre
 *  devFisek         kırmızı-altın silindir; dolum halkası ayrı (N parçalı)
 *  fener            kâğıt fener (salınım çizimde), sıcak parıltı ayrı
 *  is               siyah bulut, gürültülü kenar (kıpırtı çizimde)
 *  doseme[kat]      koyu karo + pirinç köşeler; 2 katta çift çerçeve
 *  dosemeIsik       aydınlanmış karo (#FFC86B sıcak ışık)
 *  desen[renk]      istenen rengin silik silueti; boyali[renk] parlak hali
 */
import type { KapsulRengi } from '../palet';
import { P } from '../palet';
import { gurultu2, rgba } from '../matematik';
import { spriteUret, yuvarlakDikdortgen, type Ctx, type Sprite } from '../tuval';
import { sekilYolu } from './sekil';

export class EngelSpritelari {
  c = 0;
  dpr = 1;
  kaya: Sprite[] = [];
  kova: Sprite[] = [];
  devFisek!: Sprite;
  fener!: Sprite;
  fenerParilti!: Sprite;
  is!: Sprite;
  doseme: Sprite[] = [];
  dosemeIsik!: Sprite;
  desen: Sprite[] = [];
  desenBoyali: Sprite[] = [];
  private halka = new Map<string, Sprite>();
  private renkAnahtari = '';

  hazirla(c: number, dpr: number, renkler: KapsulRengi[]): boolean {
    const anahtar = renkler.map((r) => r.ana).join();
    if (c === this.c && dpr === this.dpr && anahtar === this.renkAnahtari && this.kaya.length) return false;
    this.c = c;
    this.dpr = dpr;
    this.renkAnahtari = anahtar;
    this.halka.clear();
    const b = Math.ceil(1.06 * c);
    this.kaya = [];
    for (let kat = 1; kat <= 3; kat++) this.kaya[kat] = spriteUret(b, b, dpr, (x) => kaya(x, c, kat));
    this.kova = [];
    for (let kat = 1; kat <= 2; kat++) this.kova[kat] = spriteUret(b, b, dpr, (x) => kova(x, c, kat));
    this.devFisek = spriteUret(b, b, dpr, (x) => devFisek(x, c));
    this.fener = spriteUret(b, Math.ceil(1.1 * c), dpr, (x) => fener(x, c), b / 2, 0.12 * c);
    this.fenerParilti = spriteUret(Math.ceil(1.6 * c), Math.ceil(1.6 * c), dpr, (x) => {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.8 * c);
      g.addColorStop(0, 'rgba(255,200,107,0.55)');
      g.addColorStop(0.4, 'rgba(255,160,60,0.18)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      x.fillStyle = g;
      x.fillRect(-0.8 * c, -0.8 * c, 1.6 * c, 1.6 * c);
    });
    this.is = spriteUret(Math.ceil(1.12 * c), Math.ceil(1.12 * c), dpr, (x) => isBulutu(x, c));
    this.doseme = [];
    for (let kat = 1; kat <= 2; kat++) this.doseme[kat] = spriteUret(c, c, dpr, (x) => doseme(x, c, kat, false));
    this.dosemeIsik = spriteUret(c, c, dpr, (x) => doseme(x, c, 1, true));
    this.desen = renkler.map((k) => spriteUret(c, c, dpr, (x) => desen(x, c, k, false)));
    this.desenBoyali = renkler.map((k) => spriteUret(c, c, dpr, (x) => desen(x, c, k, true)));
    return true;
  }

  /** Dev fişek dolum halkası: N parça, ilk `dolum` dolu. Tembel önbellek. */
  devFisekHalkasi(N: number, dolum: number): Sprite {
    const k = `${N}:${dolum}`;
    let s = this.halka.get(k);
    if (!s) {
      const c = this.c;
      s = spriteUret(Math.ceil(1.24 * c), Math.ceil(1.24 * c), this.dpr, (x) => dolumHalkasi(x, c, N, dolum));
      this.halka.set(k, s);
    }
    return s;
  }
}

/** Gürültülü kenarlı taş biçimi (belirlenimli). */
function tasYolu(x: Ctx, cx: number, cy: number, rx: number, ry: number, tohum: number): void {
  const n = 18;
  x.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = 0.88 + 0.2 * gurultu2(Math.cos(a) * 1.6 + tohum * 3.1, Math.sin(a) * 1.6 + tohum * 1.7);
    const px = cx + Math.cos(a) * rx * g;
    const py = cy + Math.sin(a) * ry * g;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
  }
  x.closePath();
}

function kaya(x: Ctx, c: number, kat: number): void {
  // Taşlar alttan üste: kat sayısı kadar dilim.
  const dilimler: [number, number, number, number][] =
    kat === 1
      ? [[0, 0.04, 0.4, 0.36]]
      : kat === 2
        ? [
            [0, 0.17, 0.42, 0.24],
            [0.02, -0.14, 0.33, 0.21],
          ]
        : [
            [0, 0.24, 0.43, 0.18],
            [-0.02, 0.0, 0.36, 0.17],
            [0.03, -0.23, 0.27, 0.15],
          ];
  dilimler.forEach(([dx, dy, rx, ry], i) => {
    const cx = dx * c;
    const cy = dy * c;
    // Gölge
    tasYolu(x, cx + 0.02 * c, cy + 0.04 * c, rx * c, ry * c, i + kat * 7);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.fill();
    tasYolu(x, cx, cy, rx * c, ry * c, i + kat * 7);
    const g = x.createLinearGradient(cx - rx * c, cy - ry * c, cx + rx * c * 0.6, cy + ry * c);
    g.addColorStop(0, '#7A7482');
    g.addColorStop(0.35, P.tasAcik);
    g.addColorStop(1, P.tasKoyu);
    x.fillStyle = g;
    x.fill();
    x.lineWidth = 1.4;
    x.strokeStyle = '#1C1920';
    x.stroke();
    // Üst kenar ışığı
    x.save();
    tasYolu(x, cx, cy, rx * c, ry * c, i + kat * 7);
    x.clip();
    x.strokeStyle = 'rgba(220,214,230,0.35)';
    x.lineWidth = 2;
    tasYolu(x, cx + 0.025 * c, cy + 0.03 * c, rx * c, ry * c, i + kat * 7);
    x.stroke();
    // Benekler
    for (let k = 0; k < 7; k++) {
      const a = gurultu2(k * 1.7 + i, kat * 2.3) * Math.PI * 2;
      const d = gurultu2(k * 0.9, i + kat) * 0.75;
      x.fillStyle = k % 2 ? 'rgba(20,18,24,0.35)' : 'rgba(180,176,190,0.22)';
      x.beginPath();
      x.arc(cx + Math.cos(a) * rx * c * d, cy + Math.sin(a) * ry * c * d, 0.018 * c + (k % 3) * 0.006 * c, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  });
  // Çatlaklar: 3 − kat.
  const catlak = 3 - kat;
  const yollar: [number, number][][] = [
    [
      [-0.05, -0.3],
      [0.02, -0.12],
      [-0.06, 0.02],
      [0.04, 0.16],
      [0.0, 0.3],
    ],
    [
      [0.3, -0.06],
      [0.14, 0.0],
      [0.08, 0.12],
      [-0.1, 0.14],
      [-0.28, 0.24],
    ],
  ];
  for (let k = 0; k < catlak; k++) {
    const yol = yollar[k];
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.strokeStyle = 'rgba(200,196,210,0.45)';
    x.lineWidth = 1.2;
    x.beginPath();
    yol.forEach(([px, py], j) => (j ? x.lineTo(px * c + 1, py * c + 1) : x.moveTo(px * c + 1, py * c + 1)));
    x.stroke();
    x.strokeStyle = '#0E0C10';
    x.lineWidth = 2.2;
    x.beginPath();
    yol.forEach(([px, py], j) => (j ? x.lineTo(px * c, py * c) : x.moveTo(px * c, py * c)));
    x.stroke();
  }
}

function kova(x: Ctx, c: number, kat: number): void {
  const ust = -0.24 * c;
  const alt = 0.36 * c;
  const wu = 0.36 * c;
  const wa = 0.28 * c;
  // Sap
  x.strokeStyle = '#2A1406';
  x.lineWidth = 3.4;
  x.beginPath();
  x.arc(0, ust, wu * 0.92, Math.PI * 1.08, Math.PI * 1.92);
  x.stroke();
  x.strokeStyle = P.pirinc;
  x.lineWidth = 1.6;
  x.stroke();
  // Gövde (çıtalar)
  x.beginPath();
  x.moveTo(-wu, ust);
  x.lineTo(-wa, alt);
  x.quadraticCurveTo(0, alt + 0.06 * c, wa, alt);
  x.lineTo(wu, ust);
  x.closePath();
  const g = x.createLinearGradient(-wu, 0, wu, 0);
  g.addColorStop(0, '#4A2C16');
  g.addColorStop(0.3, '#9A6232');
  g.addColorStop(0.55, '#7A4A22');
  g.addColorStop(1, '#3A2010');
  x.fillStyle = g;
  x.fill();
  x.lineWidth = 1.6;
  x.strokeStyle = '#1E0E04';
  x.stroke();
  x.save();
  x.clip();
  for (let i = -3; i <= 3; i++) {
    x.strokeStyle = 'rgba(30,14,4,0.55)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo((i / 3.5) * wu, ust);
    x.lineTo((i / 3.5) * wa, alt + 0.04 * c);
    x.stroke();
  }
  // Çemberler
  for (const t of [0.22, 0.75]) {
    const y = ust + (alt - ust) * t;
    const w = wu + (wa - wu) * t;
    x.fillStyle = '#2C2830';
    x.fillRect(-w - 2, y - 0.035 * c, 2 * w + 4, 0.07 * c);
    x.fillStyle = 'rgba(200,200,220,0.35)';
    x.fillRect(-w - 2, y - 0.035 * c, 2 * w + 4, 0.018 * c);
  }
  x.restore();
  // Ağız ve su
  x.beginPath();
  x.ellipse(0, ust, wu, 0.1 * c, 0, 0, Math.PI * 2);
  x.fillStyle = '#1A0C04';
  x.fill();
  x.strokeStyle = '#B07A42';
  x.lineWidth = 1.6;
  x.stroke();
  const suY = ust + (kat === 2 ? 0.025 : 0.06) * c;
  const suW = wu * (kat === 2 ? 0.9 : 0.78);
  x.save();
  x.beginPath();
  x.ellipse(0, ust, wu - 1, 0.1 * c - 1, 0, 0, Math.PI * 2);
  x.clip();
  x.beginPath();
  x.ellipse(0, suY, suW, 0.08 * c * (kat === 2 ? 1 : 0.75), 0, 0, Math.PI * 2);
  const sg = x.createLinearGradient(-suW, suY, suW, suY);
  sg.addColorStop(0, '#1F6FC0');
  sg.addColorStop(0.5, '#7FD0FF');
  sg.addColorStop(1, '#2A80D0');
  x.fillStyle = sg;
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.7)';
  x.beginPath();
  x.ellipse(-suW * 0.35, suY - 0.015 * c, suW * 0.25, 0.015 * c, 0, 0, Math.PI * 2);
  x.fill();
  x.restore();
}

function devFisek(x: Ctx, c: number): void {
  const w = 0.2 * c;
  const ust = -0.2 * c;
  const alt = 0.36 * c;
  // Taban gölgesi
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.beginPath();
  x.ellipse(0, alt + 0.02 * c, w * 1.3, 0.05 * c, 0, 0, Math.PI * 2);
  x.fill();
  // Gövde silindiri
  const g = x.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, '#5A0C10');
  g.addColorStop(0.3, '#E23A2E');
  g.addColorStop(0.55, '#FF6A4A');
  g.addColorStop(1, '#6A1014');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-w, ust);
  x.lineTo(-w, alt);
  x.ellipse(0, alt, w, 0.05 * c, 0, Math.PI, 0, true);
  x.lineTo(w, ust);
  x.closePath();
  x.fill();
  x.lineWidth = 1.5;
  x.strokeStyle = '#2A0406';
  x.stroke();
  // Altın bantlar ve yıldız damgası
  const bant = (y: number, h: number) => {
    const bg = x.createLinearGradient(-w, 0, w, 0);
    bg.addColorStop(0, P.bakirKoyu);
    bg.addColorStop(0.35, P.pirincAcik);
    bg.addColorStop(1, P.bakirKoyu);
    x.fillStyle = bg;
    x.fillRect(-w, y, 2 * w, h);
  };
  bant(ust + 0.04 * c, 0.05 * c);
  bant(alt - 0.1 * c, 0.05 * c);
  x.fillStyle = P.pirincAcik;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? 0.035 * c : 0.08 * c;
    const px = Math.cos(a) * rr;
    const py = 0.1 * c + Math.sin(a) * rr;
    if (i) x.lineTo(px, py);
    else x.moveTo(px, py);
  }
  x.closePath();
  x.fill();
  // Konik başlık
  const kg = x.createLinearGradient(-w, 0, w, 0);
  kg.addColorStop(0, '#7A4A10');
  kg.addColorStop(0.4, P.pirincAcik);
  kg.addColorStop(1, '#6A3A08');
  x.fillStyle = kg;
  x.beginPath();
  x.moveTo(-w - 0.02 * c, ust);
  x.lineTo(0, ust - 0.2 * c);
  x.lineTo(w + 0.02 * c, ust);
  x.closePath();
  x.fill();
  x.strokeStyle = '#2A1406';
  x.lineWidth = 1.5;
  x.stroke();
  // Fitil ucu
  x.strokeStyle = '#3A2A1A';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(0, ust - 0.2 * c);
  x.quadraticCurveTo(0.06 * c, ust - 0.26 * c, 0.02 * c, ust - 0.3 * c);
  x.stroke();
}

function dolumHalkasi(x: Ctx, c: number, N: number, dolum: number): void {
  const seg = (Math.PI * 2) / N;
  const bosluk = (12 * Math.PI) / 180;
  const R = 0.47 * c;
  x.lineCap = 'round';
  for (let i = 0; i < N; i++) {
    const a0 = -Math.PI / 2 + i * seg + bosluk / 2;
    const a1 = a0 + seg - bosluk;
    const dolu = i < dolum;
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 0.07 * c + 2;
    x.beginPath();
    x.arc(0, 0, R, a0, a1);
    x.stroke();
    x.strokeStyle = dolu ? P.pirincAcik : 'rgba(255,220,160,0.16)';
    x.lineWidth = 0.07 * c;
    x.beginPath();
    x.arc(0, 0, R, a0, a1);
    x.stroke();
    if (dolu) {
      x.strokeStyle = 'rgba(255,250,220,0.9)';
      x.lineWidth = 0.025 * c;
      x.beginPath();
      x.arc(0, 0, R, a0, a1);
      x.stroke();
    }
  }
}

function fener(x: Ctx, c: number): void {
  // Asıl: (0,0) askı noktası; gövde merkezi 0,48c aşağıda.
  const cy = 0.5 * c;
  const rx = 0.28 * c;
  const ry = 0.32 * c;
  x.strokeStyle = '#3A2416';
  x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(0, 0);
  x.lineTo(0, cy - ry - 0.04 * c);
  x.stroke();
  // Gövde
  x.beginPath();
  x.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  const g = x.createRadialGradient(-0.06 * c, cy - 0.06 * c, 0, 0, cy, rx * 1.3);
  g.addColorStop(0, '#FFF6C8');
  g.addColorStop(0.35, '#FFD27A');
  g.addColorStop(0.8, '#FF9A3C');
  g.addColorStop(1, '#C8501A');
  x.fillStyle = g;
  x.fill();
  // Kaburgalar
  x.save();
  x.clip();
  x.strokeStyle = 'rgba(150,60,10,0.45)';
  x.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    x.beginPath();
    x.ellipse(0, cy, Math.abs(i) * rx * 0.36 + 0.5, ry, 0, i < 0 ? Math.PI / 2 : -Math.PI / 2, i < 0 ? (Math.PI * 3) / 2 : Math.PI / 2);
    x.stroke();
  }
  for (const t of [-0.5, 0, 0.5]) {
    x.beginPath();
    x.ellipse(0, cy + t * ry, rx * Math.sqrt(1 - t * t), 0.03 * c, 0, 0, Math.PI);
    x.stroke();
  }
  x.restore();
  x.lineWidth = 1.4;
  x.strokeStyle = '#7A2E0A';
  x.beginPath();
  x.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  x.stroke();
  // Kapaklar
  const kapak = (y: number) => {
    x.fillStyle = '#2A1810';
    yuvarlakDikdortgen(x, -0.14 * c, y - 0.035 * c, 0.28 * c, 0.07 * c, 0.02 * c);
    x.fill();
    x.fillStyle = 'rgba(242,198,109,0.7)';
    x.fillRect(-0.12 * c, y - 0.03 * c, 0.24 * c, 0.012 * c);
  };
  kapak(cy - ry + 0.01 * c);
  kapak(cy + ry - 0.01 * c);
  // Püskül
  x.strokeStyle = '#C8282A';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(0, cy + ry + 0.03 * c);
  x.lineTo(0, cy + ry + 0.12 * c);
  x.stroke();
}

function isBulutu(x: Ctx, c: number): void {
  const daireler: [number, number, number][] = [
    [-0.2, 0.08, 0.22],
    [0.18, 0.1, 0.21],
    [0, -0.08, 0.26],
    [-0.22, -0.12, 0.15],
    [0.24, -0.1, 0.16],
    [0.02, 0.2, 0.18],
  ];
  const yol = (s: number, dx = 0, dy = 0) => {
    x.beginPath();
    for (const [px, py, pr] of daireler) {
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const g = 1 + 0.12 * (gurultu2(Math.cos(a) * 2 + px * 9, Math.sin(a) * 2 + py * 9) - 0.5);
        const qx = (px + Math.cos(a) * pr * g * s) * c + dx;
        const qy = (py + Math.sin(a) * pr * g * s) * c + dy;
        if (i === 0) x.moveTo(qx, qy);
        else x.lineTo(qx, qy);
      }
      x.closePath();
    }
  };
  yol(1.08, 0.02 * c, 0.04 * c);
  x.fillStyle = 'rgba(0,0,0,0.45)';
  x.fill('nonzero');
  yol(1.06);
  x.fillStyle = '#6A5A68';
  x.fill('nonzero');
  yol(1);
  const g = x.createRadialGradient(-0.1 * c, -0.16 * c, 0, 0, 0, 0.48 * c);
  g.addColorStop(0, '#5A4C5A');
  g.addColorStop(0.5, '#2A222A');
  g.addColorStop(1, '#100C10');
  x.fillStyle = g;
  x.fill('nonzero');
  // Köz benekleri (içinde sönmemiş kıvılcım)
  for (let k = 0; k < 6; k++) {
    const a = k * 2.4;
    const d = 0.08 + 0.05 * (k % 3);
    x.fillStyle = k % 2 ? 'rgba(255,120,40,0.35)' : 'rgba(255,200,120,0.18)';
    x.beginPath();
    x.arc(Math.cos(a) * d * c, Math.sin(a) * d * c + 0.02 * c, 0.012 * c + (k % 2) * 0.008 * c, 0, Math.PI * 2);
    x.fill();
  }
}

function koseler(x: Ctx, c: number, ic: number, uz: number, kal: number, parlak: boolean): void {
  const g = x.createLinearGradient(-c / 2, -c / 2, c / 2, c / 2);
  g.addColorStop(0, parlak ? '#FFE9A8' : P.pirincAcik);
  g.addColorStop(1, parlak ? P.pirinc : P.bakirKoyu);
  x.fillStyle = g;
  const a = c / 2 - ic;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    x.save();
    x.scale(sx, sy);
    x.beginPath();
    x.moveTo(-a, -a);
    x.lineTo(-a + uz, -a);
    x.lineTo(-a + uz, -a + kal);
    x.lineTo(-a + kal, -a + kal);
    x.lineTo(-a + kal, -a + uz);
    x.lineTo(-a, -a + uz);
    x.closePath();
    x.fill();
    x.lineWidth = 0.8;
    x.strokeStyle = 'rgba(40,18,4,0.8)';
    x.stroke();
    x.restore();
  }
}

function doseme(x: Ctx, c: number, kat: number, isikli: boolean): void {
  const ic = 0.07 * c;
  const s = c - 2 * ic;
  yuvarlakDikdortgen(x, -s / 2, -s / 2, s, s, 0.1 * c);
  if (isikli) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, s * 0.72);
    g.addColorStop(0, rgba(P.sicakIsik, 0.78));
    g.addColorStop(0.55, rgba('#FFA040', 0.42));
    g.addColorStop(1, rgba(P.isikliYuva, 0.9));
    x.fillStyle = g;
  } else {
    const g = x.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, '#2C2018');
    g.addColorStop(1, '#140C08');
    x.fillStyle = g;
  }
  x.fill();
  // Karo dokusu: ince çapraz çizgi
  if (!isikli) {
    x.save();
    yuvarlakDikdortgen(x, -s / 2, -s / 2, s, s, 0.1 * c);
    x.clip();
    x.strokeStyle = 'rgba(242,198,109,0.07)';
    x.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      x.beginPath();
      x.moveTo(i * 0.12 * c - s, -s);
      x.lineTo(i * 0.12 * c + s, s);
      x.stroke();
    }
    x.restore();
  }
  x.lineWidth = 1.2;
  x.strokeStyle = isikli ? 'rgba(255,230,160,0.9)' : 'rgba(217,164,65,0.4)';
  yuvarlakDikdortgen(x, -s / 2, -s / 2, s, s, 0.1 * c);
  x.stroke();
  // Pirinç köşeler; 2 katta iç içe çift köşe ve çift çerçeve.
  x.globalAlpha = isikli ? 1 : 0.8;
  koseler(x, c, ic - 0.5, 0.16 * c, 0.04 * c, isikli);
  if (kat === 2) {
    const s2 = s - 0.1 * c;
    x.lineWidth = 1.3;
    x.strokeStyle = 'rgba(217,164,65,0.55)';
    yuvarlakDikdortgen(x, -s2 / 2, -s2 / 2, s2, s2, 0.07 * c);
    x.stroke();
    koseler(x, c, ic + 0.07 * c, 0.12 * c, 0.035 * c, isikli);
  }
  x.globalAlpha = 1;
}

function desen(x: Ctx, c: number, k: KapsulRengi, boyali: boolean): void {
  // Desen hücresi: rengin silik karosu + kapsülün çevresinden taşan siluet
  // (kapsül hücreyi örtse de istenen renk ve şekil okunur).
  const ic = 0.06 * c;
  const s = c - 2 * ic;
  yuvarlakDikdortgen(x, -s / 2, -s / 2, s, s, 0.14 * c);
  if (boyali) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 0.62 * c);
    g.addColorStop(0, rgba(k.acik, 0.7));
    g.addColorStop(0.55, rgba(k.ana, 0.42));
    g.addColorStop(1, rgba(k.koyu, 0.35));
    x.fillStyle = g;
    x.fill();
    x.lineWidth = 1.5;
    x.strokeStyle = rgba(k.acik, 0.9);
    x.stroke();
  } else {
    x.fillStyle = rgba(k.ana, 0.12);
    x.fill();
  }
  const o = 1.2;
  x.save();
  x.scale(o, o);
  sekilYolu(x, k.sekil, 0.4 * c);
  x.lineJoin = 'round';
  if (boyali) {
    x.lineWidth = 2.6 / o;
    x.strokeStyle = rgba('#FFFFFF', 0.85);
    x.stroke();
  } else {
    x.setLineDash([4 / o, 3 / o]);
    x.lineWidth = 2 / o;
    x.strokeStyle = rgba(k.acik, 0.75);
    x.stroke();
  }
  x.restore();
}
