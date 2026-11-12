/**
 * LODOS simülasyonu: dalga, tekne, misina (verlet ip), balıklar, hava.
 * Çizim ve ses bilmez; olanları `olaylar` kuyruğuna yazar. Rastgelelik
 * tohumlu (mulberry32), adım sabit (1/60 s) → aynı girdi aynı gece.
 */

export const G = 180; // ekran genişliği (mantıksal piksel)
export const DUNYA_G = 540;
export const N_IP = 16;
export const SURE = 165; // bir gece, saniye
export const L_MIN = 4;
/** Olta ucunun tekne merkezine göre yeri. */
export const UC_X = -28;
export const UC_Y = -19;
/** Balıkların sağda döndüğü yer: olta ucu en çok DUNYA_G − 58'e uzanır. */
const SAG_SINIR = DUNYA_G - 66;

export const HAMSI = 0;
export const ISTAVRIT = 1;
export const PALAMUT = 2;
export const LUFER = 3;
export const KILIC = 4;
export const CIZME = 5;
export const AMFORA = 6;

export interface TurBilgi {
  ad: string;
  deger: number;
  /** Besin zinciri sırası; 0 = cansız (çizme, amfora). */
  sira: number;
  hiz: number;
  /** Derinlik bandı (0 yüzey, 1 dip). */
  ust: number;
  alt: number;
  agirlik: number;
  /** Görüş yarıçapı ve saniyede ısırma isteği. */
  gor: number;
  istah: number;
  /** Bu x'ten solda dolaşmaz (derin su balıkları). */
  minX: number;
  sozler: string[];
}

export const TUR: TurBilgi[] = [
  { ad: 'HAMSİ', deger: 1, sira: 1, hiz: 20, ust: 0.04, alt: 0.3, agirlik: 0.1, gor: 24, istah: 1.6, minX: 0,
    sozler: ['BEN DAHA ÇOCUĞUM!', 'ANNEME SÖYLERİM!', 'YANLIŞ ANLAŞILMA!', 'TAVAYA GİRMEM!'] },
  { ad: 'İSTAVRİT', deger: 3, sira: 2, hiz: 17, ust: 0.16, alt: 0.5, agirlik: 0.2, gor: 30, istah: 1.1, minX: 0,
    sozler: ['AĞIR OL REİS!', 'BU YEM SAHTE!', 'PAZARLIK YAPALIM?', 'DUR, AÇIKLARIM!'] },
  { ad: 'PALAMUT', deger: 10, sira: 3, hiz: 20, ust: 0.36, alt: 0.74, agirlik: 0.42, gor: 40, istah: 0.6, minX: 130,
    sozler: ['SEN KİMSİN BE!', 'MEVSİMİM DEĞİL!', 'BU İŞ BURADA BİTMEZ!'] },
  { ad: 'LÜFER', deger: 30, sira: 4, hiz: 22, ust: 0.55, alt: 0.94, agirlik: 0.6, gor: 46, istah: 0.7, minX: 240,
    sozler: ['BEN LÜFERİM, SAYGI!', "BOĞAZ'IN PRENSİYİM!", 'AVUKATIMI İSTERİM!'] },
  { ad: 'KILIÇ', deger: 120, sira: 5, hiz: 26, ust: 0.6, alt: 0.94, agirlik: 0.8, gor: 60, istah: 0.7, minX: 290,
    sozler: ['EN GARDE!', 'BUNU ÖDEYECEKSİN!', 'KILICIMA DOKUNMA!'] },
  { ad: 'ÇİZME', deger: 0, sira: 0, hiz: 0, ust: 1, alt: 1, agirlik: 0.3, gor: 6, istah: 9, minX: 0, sozler: [] },
  { ad: 'AMFORA', deger: 40, sira: 0, hiz: 0, ust: 1, alt: 1, agirlik: 0.5, gor: 6, istah: 9, minX: 0, sozler: [] },
];

export type Durum = 'yuz' | 'ilgi' | 'olta' | 'kac' | 'ucus';

export interface Balik {
  tur: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  yon: 1 | -1;
  durum: Durum;
  t: number;
  faz: number;
  suru: number;
  ox: number;
  oy: number;
  hedefY: number;
  /** > 0 iken çırpınıyor; < 0 iken bir sonraki çırpınmaya sayar. */
  cirp: number;
  unlem: number;
  ux: number;
  uy: number;
}

export interface Suru {
  tur: number;
  x: number;
  y: number;
  yon: 1 | -1;
  hedefY: number;
}

export interface Anasi {
  x: number;
  y: number;
  faz: number;
  y0: number;
}

export interface Parca {
  tip: 'kabarcik' | 'damla' | 'kivilcim' | 'kalp';
  x: number;
  y: number;
  vx: number;
  vy: number;
  omur: number;
}

export interface Balon {
  metin: string;
  sahip: 'reis' | 'kedi' | Balik | null;
  x: number;
  y: number;
  t: number;
}

export interface Yazi {
  metin: string;
  x: number;
  y: number;
  t: number;
  vurgu: boolean;
}

export type Olay =
  | { tip: 'isirdi'; tur: number }
  | { tip: 'yutuldu'; tur: number; zincir: number }
  | { tip: 'yakalandi'; tur: number; deger: number }
  | { tip: 'kedi' }
  | { tip: 'koptu' }
  | { tip: 'carpildi' }
  | { tip: 'simsek' }
  | { tip: 'faz'; ad: string }
  | { tip: 'vapur' }
  | { tip: 'cirpin' }
  | { tip: 'bitti' };

export interface Girdi {
  basili: boolean;
  /** Dünya koordinatı. */
  x: number;
  y: number;
}

export function rng32(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const rampa = (t: number, a: number, b: number): number => sinirla((t - a) / (b - a), 0, 1);
const yumusak = (k: number): number => k * k * (3 - 2 * k);

export class Dunya {
  readonly deniz: number;
  rng: () => number;

  /** Hep akan saat (dalga, canlandırma). */
  zaman = 0;
  /** Gecenin saati (yalnız oyunda ilerler). */
  t = 0;
  oyunda = false;
  bitti = false;

  firtina = 0;
  yagmur = 0;
  safak = 0;
  ruzgar = 0;

  tekne = { x: 108, vx: 0, y: 0, egim: 0 };
  kam = { x: 0 };

  L = L_MIN;
  ipX = new Float32Array(N_IP);
  ipY = new Float32Array(N_IP);
  ipPX = new Float32Array(N_IP);
  ipPY = new Float32Array(N_IP);
  kancaHiz = 0;
  /** Misina koptu ya da çarpıldı: bu süre boyunca olta yok / kontrol yok. */
  kopuk = 0;
  sersem = 0;
  cekiyor = false;

  kancadaki: Balik | null = null;
  gerilim = 0;
  kopma = 0;
  zincir = 0;

  baliklar: Balik[] = [];
  surular: Suru[] = [];
  analar: Anasi[] = [];
  parcalar: Parca[] = [];
  balonlar: Balon[] = [];
  yazilar: Yazi[] = [];
  olaylar: Olay[] = [];

  para = 0;
  yakalanan = [0, 0, 0, 0, 0, 0, 0];
  kediPayi = 0;
  enZincir = 0;
  kopan = 0;

  simsek: { x: number; t: number; yol: number[] } | null = null;
  private simsekSayac = 6;
  flas = 0;
  sarsinti = 0;
  kediKabarik = 0;
  kediYiyor = 0;
  kediZipla = 0;
  vapur: { x: number; yon: 1 | -1 } | null = null;
  private vapurlar = [52, 114];
  private fazNo = 0;
  private kilicSayac = 0;

  ipucu = '';
  private ipucuNo = 0;
  private ipucuSure = 0;
  private cirpinmaIpucu = false;

  constructor(
    public readonly yuk: number,
    tohum = 1,
  ) {
    this.deniz = Math.round(yuk * 0.3);
    this.rng = rng32(tohum);
    this.tekne.y = this.deniz;
    this.kur();
  }

  // ---- Arazi ve deniz ----

  taban(x: number): number {
    const p = yumusak(sinirla((x - 130) / 250, 0, 1));
    const derin = (0.8 + 0.2 * p) * (this.yuk - this.deniz - 20);
    return this.deniz + derin + 4 * Math.sin(x * 0.07) + 3 * Math.sin(x * 0.19 + 1) + 2 * Math.sin(x * 0.41 + 2);
  }

  dalga(x: number): number {
    const z = this.zaman;
    const a = 0.9 + 5.4 * this.firtina;
    return a * (0.5 * Math.sin(x * 0.045 + z * 1.3) + 0.3 * Math.sin(x * 0.11 - z * 1.9 + 1.3) + 0.35 * Math.sin(x * 0.019 + z * 0.7));
  }

  yuzey(x: number): number {
    return this.deniz + this.dalga(x);
  }

  private bantY(tur: number, k: number, x: number): number {
    const T = TUR[tur];
    const d = this.yuk - this.deniz - 20;
    const y = this.deniz + (T.ust + (T.alt - T.ust) * k) * d;
    return Math.min(y, this.taban(x) - 9);
  }

  // ---- Kurulum ----

  private kur(): void {
    const r = this.rng;
    const suruEkle = (tur: number, adet: number, x: number): void => {
      const s: Suru = { tur, x, y: this.bantY(tur, r(), x), yon: r() < 0.5 ? 1 : -1, hedefY: 0 };
      s.hedefY = s.y;
      this.surular.push(s);
      const no = this.surular.length - 1;
      for (let i = 0; i < adet; i++) {
        const b = this.balikEkle(tur, x + (r() - 0.5) * 24, s.y + (r() - 0.5) * 10);
        b.suru = no;
        b.ox = (r() - 0.5) * (tur === HAMSI ? 26 : 34);
        b.oy = (r() - 0.5) * (tur === HAMSI ? 11 : 16);
      }
    };
    suruEkle(HAMSI, 7, 80);
    suruEkle(HAMSI, 6, 240);
    suruEkle(HAMSI, 7, 430);
    suruEkle(ISTAVRIT, 4, 170);
    suruEkle(ISTAVRIT, 4, 340);
    suruEkle(ISTAVRIT, 3, 450);
    for (let i = 0; i < 4; i++) this.tekBalik(PALAMUT, 170 + r() * 290);
    for (let i = 0; i < 2; i++) this.tekBalik(LUFER, 290 + r() * 170);

    const cansiz = (tur: number, x: number): void => {
      const b = this.balikEkle(tur, x, this.taban(x) - 4);
      b.yon = 1;
    };
    cansiz(CIZME, 56 + r() * 22);
    cansiz(CIZME, 280 + r() * 40);
    cansiz(AMFORA, 420 + r() * 50);

    for (let i = 0; i < 3; i++) this.anaEkle(190 + r() * 320);
    this.ipSifirla();
  }

  private balikEkle(tur: number, x: number, y: number): Balik {
    const r = this.rng;
    const b: Balik = {
      tur, x, y, vx: 0, vy: 0, yon: r() < 0.5 ? 1 : -1, durum: 'yuz', t: 0, faz: r() * 6,
      suru: -1, ox: 0, oy: 0, hedefY: y, cirp: -2, unlem: 0, ux: 0, uy: 0,
    };
    this.baliklar.push(b);
    return b;
  }

  private tekBalik(tur: number, x: number): Balik {
    x = sinirla(x, TUR[tur].minX + 10, DUNYA_G - 14);
    const b = this.balikEkle(tur, x, this.bantY(tur, this.rng(), x));
    b.hedefY = b.y;
    return b;
  }

  private anaEkle(x: number): void {
    const d = this.yuk - this.deniz - 20;
    const y = Math.min(this.deniz + (0.28 + this.rng() * 0.42) * d, this.taban(x) - 16);
    this.analar.push({ x, y, y0: y, faz: this.rng() * 6 });
  }

  ucX(): number {
    return this.tekne.x + UC_X;
  }

  ucY(): number {
    return this.tekne.y + UC_Y + this.tekne.egim * UC_X - this.gerilim * 2;
  }

  private ipSifirla(): void {
    const x = this.ucX();
    const y = this.ucY();
    for (let i = 0; i < N_IP; i++) {
      this.ipX[i] = this.ipPX[i] = x;
      this.ipY[i] = this.ipPY[i] = y + (i / (N_IP - 1)) * L_MIN;
    }
    this.L = L_MIN;
  }

  get kancaX(): number {
    return this.ipX[N_IP - 1];
  }

  get kancaY(): number {
    return this.ipY[N_IP - 1];
  }

  basla(): void {
    this.oyunda = true;
    this.soyle('reis', 'RASTGELE!');
    this.ipucuNo = 1;
    this.ipucu = 'BASILI TUT: OLTAYI İNDİR';
    this.ipucuSure = 99;
  }

  // ---- Yardımcılar ----

  soyle(sahip: Balon['sahip'], metin: string, x = 0, y = 0): void {
    this.balonlar = this.balonlar.filter((b) => b.sahip !== sahip || sahip === null);
    if (this.balonlar.length >= 3) this.balonlar.shift();
    this.balonlar.push({ metin, sahip, x, y, t: 0 });
  }

  private yaz(metin: string, x: number, y: number, vurgu = false): void {
    this.yazilar.push({ metin, x, y, t: 0, vurgu });
  }

  private sac(tip: Parca['tip'], x: number, y: number, adet: number, guc: number): void {
    const r = this.rng;
    for (let i = 0; i < adet; i++) {
      const a = r() * Math.PI * 2;
      const h = guc * (0.3 + r() * 0.7);
      this.parcalar.push({
        tip, x: x + (r() - 0.5) * 3, y: y + (r() - 0.5) * 3,
        vx: Math.cos(a) * h, vy: tip === 'damla' ? -Math.abs(Math.sin(a)) * h - guc * 0.4 : Math.sin(a) * h,
        omur: 0.5 + r() * 0.7,
      });
    }
    if (this.parcalar.length > 220) this.parcalar.splice(0, this.parcalar.length - 220);
  }

  private secSoz(tur: number): string {
    const s = TUR[tur].sozler;
    return s[(this.rng() * s.length) | 0];
  }

  private uygunYem(b: Balik): boolean {
    const yem = this.kancadaki;
    const T = TUR[b.tur];
    if (T.sira === 0) return !yem;
    if (yem && TUR[yem.tur].sira === 0) return false;
    const fark = T.sira - (yem ? TUR[yem.tur].sira : 0);
    return fark >= 1 && fark <= 2;
  }

  // ---- Adım ----

  adim(dt: number, girdi: Girdi): void {
    this.zaman += dt;
    if (this.oyunda && !this.bitti) {
      this.t += dt;
      this.fazlar();
      if (this.t >= SURE) {
        this.bitti = true;
        this.olaylar.push({ tip: 'bitti' });
      }
    }
    const t = this.t;
    this.firtina = 0.35 * rampa(t, 30, 75) + 0.65 * rampa(t, 75, 95) - 0.82 * rampa(t, 128, 152);
    this.yagmur = 0.5 * rampa(t, 30, 44) + 0.5 * rampa(t, 75, 90) - 0.88 * rampa(t, 128, 152);
    this.safak = rampa(t, 135, SURE);
    this.ruzgar = this.firtina * (0.6 + 0.4 * Math.sin(this.zaman * 0.7));

    const serbest = this.oyunda && !this.bitti && this.sersem <= 0 && this.kopuk <= 0;
    this.tekneAdim(dt, girdi, serbest);
    this.oltaAdim(dt, girdi, serbest);
    this.balikAdim(dt);
    this.anaAdim(dt);
    this.gerilimAdim(dt);
    this.havaAdim(dt);
    this.parcaAdim(dt);
    this.ipucuAdim(dt);

    // Kamera: tekne orta bandın dışına çıkınca kayar.
    const ekranX = this.tekne.x - this.kam.x;
    if (ekranX > 114) this.kam.x += (ekranX - 114) * Math.min(1, dt * 6);
    if (ekranX < 70) this.kam.x += (ekranX - 70) * Math.min(1, dt * 6);
    this.kam.x = sinirla(this.kam.x, 0, DUNYA_G - G);

    if (this.flas > 0) this.flas -= dt;
    if (this.sarsinti > 0) this.sarsinti = Math.max(0, this.sarsinti - dt * 3);
    if (this.kediKabarik > 0) this.kediKabarik -= dt;
    if (this.kediYiyor > 0) this.kediYiyor -= dt;
    if (this.kediZipla > 0) this.kediZipla -= dt;
  }

  private fazlar(): void {
    const esik = [30, 75, 135];
    const ad = ['YAĞMUR', 'LODOS!', 'ŞAFAK'];
    const soz = ['YAĞMUR GELİYOR.', 'LODOS PATLADI!', 'GÜN AĞARIYOR.'];
    if (this.fazNo < 3 && this.t >= esik[this.fazNo]) {
      this.olaylar.push({ tip: 'faz', ad: ad[this.fazNo] });
      this.soyle('reis', soz[this.fazNo]);
      this.fazNo++;
    }
    if (this.vapurlar.length && this.t >= this.vapurlar[0]) {
      this.vapurlar.shift();
      const yon = this.vapurlar.length ? 1 : -1;
      this.vapur = { x: yon > 0 ? -40 : G + 40, yon };
      this.olaylar.push({ tip: 'vapur' });
    }
  }

  private tekneAdim(dt: number, girdi: Girdi, serbest: boolean): void {
    const tk = this.tekne;
    let hedef = tk.x;
    if (serbest && girdi.basili) hedef = girdi.x - UC_X;
    let ax = (hedef - tk.x) * 7 - tk.vx * 4.5;
    ax = sinirla(ax, -160, 160);
    ax += this.ruzgar * 14 * Math.sin(this.zaman * 0.9 + 1);
    tk.vx = sinirla(tk.vx + ax * dt, -58, 58);
    tk.x += tk.vx * dt;
    if (tk.x < 36) {
      tk.x = 36;
      tk.vx = 0;
    }
    if (tk.x > DUNYA_G - 30) {
      tk.x = DUNYA_G - 30;
      tk.vx = 0;
    }
    const hy = (this.yuzey(tk.x - 15) + this.yuzey(tk.x) + this.yuzey(tk.x + 15)) / 3;
    tk.y += (hy - tk.y) * Math.min(1, dt * 9);
    const egim = (this.yuzey(tk.x + 17) - this.yuzey(tk.x - 17)) / 34;
    tk.egim += (egim - tk.egim) * Math.min(1, dt * 7);
  }

  private oltaAdim(dt: number, girdi: Girdi, serbest: boolean): void {
    if (this.sersem > 0) this.sersem -= dt;
    if (this.kopuk > 0) {
      this.kopuk -= dt;
      if (this.kopuk <= 0) this.ipSifirla();
      return;
    }
    const ucx = this.ucX();
    const ucy = this.ucY();
    const yem = this.kancadaki;

    // Misina boyu: parmağa kadar sal, bırakınca sar.
    let hedefL = L_MIN;
    if (serbest && girdi.basili) {
      const gy = Math.min(girdi.y, this.taban(girdi.x) - 2);
      if (gy > this.yuzey(girdi.x) + 3) hedefL = Math.max(L_MIN, Math.hypot(girdi.x - ucx, gy - ucy));
    }
    const sarma = yem ? 78 * (1 - 0.55 * TUR[yem.tur].agirlik) : 115;
    this.cekiyor = this.L > hedefL + 0.6;
    if (this.L < hedefL) this.L = Math.min(hedefL, this.L + 92 * dt);
    else this.L = Math.max(hedefL, this.L - sarma * dt);

    // Kancadaki balığın çekişi
    let bfx = 0;
    let bfy = 0;
    if (yem && TUR[yem.tur].sira > 0) {
      const w = TUR[yem.tur].agirlik;
      yem.cirp -= dt;
      if (yem.cirp < -(2.2 + (1 - w) * 2.5)) {
        yem.cirp = 0.9 + this.rng() * 0.5;
        if (w >= 0.4) {
          this.olaylar.push({ tip: 'cirpin' });
          if (!this.cirpinmaIpucu) {
            this.cirpinmaIpucu = true;
            this.ipucu = 'ÇIRPINIRKEN ÇEKME! PARMAĞINI BALIĞA KOY';
            this.ipucuSure = 5;
          }
        }
      }
      const cirp = yem.cirp > 0;
      const guc = (cirp ? 1500 : 260) * w;
      const a = Math.sin(this.zaman * (cirp ? 9 : 2.3) + yem.faz) * 1.2;
      bfx = Math.sin(a) * guc;
      bfy = Math.abs(Math.cos(a)) * guc * 0.7;
    }

    // Verlet
    const n = N_IP;
    const X = this.ipX;
    const Y = this.ipY;
    const PX = this.ipPX;
    const PY = this.ipPY;
    const akinti = Math.sin(this.zaman * 0.5) * 14 * (0.3 + this.firtina);
    for (let i = 1; i < n; i++) {
      const su = Y[i] > this.yuzey(X[i]);
      const sur = su ? 0.9 : 0.985;
      const vx = (X[i] - PX[i]) * sur;
      const vy = (Y[i] - PY[i]) * sur;
      PX[i] = X[i];
      PY[i] = Y[i];
      let ax = su ? akinti : -this.ruzgar * 60;
      let ay = su ? 130 : 420;
      if (i === n - 1) {
        ay = su ? 400 : 760;
        if (su) {
          ax += bfx;
          ay += bfy;
        } else if (yem) {
          ax += bfx * 0.25;
        }
      }
      X[i] += vx + ax * dt * dt;
      Y[i] += vy + ay * dt * dt;
    }
    const seg = this.L / (n - 1);
    for (let it = 0; it < 10; it++) {
      X[0] = ucx;
      Y[0] = ucy;
      for (let i = 0; i < n - 1; i++) {
        const dx = X[i + 1] - X[i];
        const dy = Y[i + 1] - Y[i];
        const d = Math.hypot(dx, dy);
        if (d <= seg || d < 1e-6) continue;
        const f = (d - seg) / d;
        if (i === 0) {
          X[1] -= dx * f;
          Y[1] -= dy * f;
        } else {
          X[i] += dx * f * 0.5;
          Y[i] += dy * f * 0.5;
          X[i + 1] -= dx * f * 0.5;
          Y[i + 1] -= dy * f * 0.5;
        }
      }
    }
    for (let i = 1; i < n; i++) {
      const tb = this.taban(X[i]) - 1;
      if (Y[i] > tb) Y[i] = tb;
      X[i] = sinirla(X[i], 2, DUNYA_G - 2);
    }
    const k = n - 1;
    this.kancaHiz = Math.hypot(X[k] - PX[k], Y[k] - PY[k]) / dt;

    if (yem) {
      yem.x = X[k];
      yem.y = Y[k];
      // Tekneye alma
      if (this.L <= L_MIN + 0.6) this.tekneyeAl(yem);
    }
  }

  private tekneyeAl(b: Balik): void {
    this.kancadaki = null;
    this.gerilim = 0;
    this.kopma = 0;
    b.durum = 'ucus';
    b.t = 0;
    b.ux = b.x;
    b.uy = b.y;
    this.sac('damla', b.x, this.yuzey(b.x), 6, 40);
  }

  private indi(b: Balik): void {
    const T = TUR[b.tur];
    const tk = this.tekne;
    this.yakalanan[b.tur]++;
    this.enZincir = Math.max(this.enZincir, this.zincir);
    const kediYer = b.tur === HAMSI && (this.yakalanan[HAMSI] === 1 || this.rng() < 0.22);
    if (kediYer) {
      this.kediPayi++;
      this.kediYiyor = 1.4;
      this.sac('kalp', tk.x + 16, tk.y - 15, 2, 8);
      this.soyle('kedi', this.kediPayi === 1 ? 'HAMSİ? BANA MI?' : 'MRRR.');
      this.olaylar.push({ tip: 'kedi' });
    } else {
      this.para += T.deger;
      this.yaz(T.deger > 0 ? `+${T.deger}` : '0', tk.x, tk.y - 30, T.deger >= 10);
      this.olaylar.push({ tip: 'yakalandi', tur: b.tur, deger: T.deger });
      if (b.tur === CIZME) this.soyle('kedi', 'BU NE? ÇİZME Mİ?');
      else if (b.tur === AMFORA) this.soyle('reis', 'BU MÜZELİK!');
      else if (b.tur === KILIC) this.soyle('reis', 'ALLAH ALLAH!');
      else if (T.sira >= 3) {
        this.soyle('kedi', 'MİYAAAV!');
        this.kediZipla = 0.5;
      }
    }
    this.zincir = 0;
    this.ipucuIlerle(3);
  }

  private balikAdim(dt: number): void {
    const r = this.rng;
    const kx = this.kancaX;
    const ky = this.kancaY;
    const kancaSuda = this.kopuk <= 0 && this.sersem <= 0 && ky > this.yuzey(kx) + 2;

    for (const s of this.surular) {
      const T = TUR[s.tur];
      s.x += s.yon * T.hiz * 0.8 * dt;
      if (s.x < 20) s.yon = 1;
      if (s.x > SAG_SINIR - 6) s.yon = -1;
      if (r() < 0.04 * dt) s.yon = -s.yon as 1 | -1;
      if (r() < 0.3 * dt) s.hedefY = this.bantY(s.tur, r(), s.x);
      s.hedefY = Math.min(s.hedefY, this.taban(s.x) - 12);
      s.y += (s.hedefY - s.y) * Math.min(1, dt * 0.6);
    }

    let ilgili = 0;
    for (const b of this.baliklar) if (b.durum === 'ilgi') ilgili++;

    for (let i = this.baliklar.length - 1; i >= 0; i--) {
      const b = this.baliklar[i];
      const T = TUR[b.tur];
      b.t += dt;
      if (b.unlem > 0) b.unlem -= dt;
      const dx = kx - b.x;
      const dy = ky - b.y;
      const uz = Math.hypot(dx, dy);

      if (T.sira === 0) {
        // Çizme / amfora: dipte bekler, boş kanca değerse takılır.
        if (b.durum === 'yuz') {
          if (kancaSuda && !this.kancadaki && uz < T.gor) this.tak(b, false);
        } else if (b.durum === 'ucus') this.ucusAdim(b, i, dt);
        continue;
      }

      b.faz += dt * (5 + Math.hypot(b.vx, b.vy) * 0.25);

      switch (b.durum) {
        case 'yuz': {
          let hx = b.yon * T.hiz;
          let hy = (b.hedefY - b.y) * 0.9;
          if (b.suru >= 0) {
            const s = this.surular[b.suru];
            const tx = s.x + b.ox + Math.sin(this.zaman * 0.9 + b.faz * 0.1) * 4;
            const ty = s.y + b.oy;
            hx = sinirla((tx - b.x) * 1.4, -T.hiz * 1.6, T.hiz * 1.6) + s.yon * T.hiz * 0.5;
            hy = (ty - b.y) * 1.4;
          } else {
            // Kenarlarda döner: solda kendi derin su sınırı, sağda oltanın
            // yetişebildiği yer (tekne dünyanın ucuna kadar gidemez).
            if (r() < 0.07 * dt) b.yon = -b.yon as 1 | -1;
            if (b.x < T.minX + 8) b.yon = 1;
            if (b.x > SAG_SINIR) b.yon = -1;
            hx = b.yon * T.hiz * (b.x < T.minX || b.x > SAG_SINIR + 12 ? 1.4 : 1);
            if (r() < 0.25 * dt) b.hedefY = this.bantY(b.tur, r(), b.x);
          }
          b.vx += (hx - b.vx) * Math.min(1, dt * 2.2);
          b.vy += (hy - b.vy) * Math.min(1, dt * 2.2);
          if (b.suru >= 0 && Math.abs(b.vx) > 2) b.yon = b.vx > 0 ? 1 : -1;
          if (kancaSuda && ilgili < 2 && uz < T.gor && kx > T.minX - 24 && this.kancaHiz < 75 && this.uygunYem(b) && r() < T.istah * dt) {
            b.durum = 'ilgi';
            b.t = 0;
            b.unlem = 0.7;
            ilgili++;
          }
          break;
        }
        case 'ilgi': {
          const hiz = T.hiz * 1.7;
          const k = uz > 0.01 ? hiz / uz : 0;
          b.vx += (dx * k - b.vx) * Math.min(1, dt * 6);
          b.vy += (dy * k - b.vy) * Math.min(1, dt * 6);
          if (Math.abs(b.vx) > 2) b.yon = b.vx > 0 ? 1 : -1;
          if (!kancaSuda || !this.uygunYem(b) || uz > T.gor * 2 || b.t > 6 || kx < T.minX - 24) {
            b.durum = 'yuz';
            b.t = 0;
          } else if (uz < 4.5) {
            this.tak(b, true);
          }
          break;
        }
        case 'kac': {
          b.vx *= 1 - dt * 1.2;
          b.vy *= 1 - dt * 1.2;
          if (b.t > 1.3) {
            b.durum = 'yuz';
            b.yon = b.vx > 0 ? 1 : -1;
            b.hedefY = this.bantY(b.tur, r(), b.x);
          }
          break;
        }
        case 'olta':
          continue;
        case 'ucus':
          this.ucusAdim(b, i, dt);
          continue;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.x = sinirla(b.x, 4, DUNYA_G - 4);
      const ust = this.yuzey(b.x) + 5;
      const alt = this.taban(b.x) - 5 - T.agirlik * 7;
      if (b.y < ust) {
        b.y = ust;
        b.vy = Math.abs(b.vy) * 0.3;
      }
      if (b.y > alt) {
        b.y = alt;
        b.vy = -Math.abs(b.vy) * 0.3;
      }
      if (r() < 0.05 * dt) this.parcalar.push({ tip: 'kabarcik', x: b.x + b.yon * 3, y: b.y, vx: 0, vy: -9, omur: 2 + r() * 2 });
    }

    // Kılıç: yalnız lodosta, derinde tek başına.
    if (this.t > 70 && this.t < 140 && !this.baliklar.some((b) => b.tur === KILIC)) {
      this.kilicSayac -= dt;
      if (this.kilicSayac <= 0) {
        const solda = this.tekne.x > 420;
        const b = this.tekBalik(KILIC, solda ? 300 : DUNYA_G - 14);
        b.yon = solda ? 1 : -1;
        this.kilicSayac = 22;
      }
    }
  }

  /** Balık kancaya takılır; kancada yem varsa onu yutar. */
  private tak(b: Balik, canli: boolean): void {
    const yem = this.kancadaki;
    if (yem) {
      const i = this.baliklar.indexOf(yem);
      if (i >= 0) this.baliklar.splice(i, 1);
      this.zincir++;
      this.sac('kabarcik', yem.x, yem.y, 10, 26);
      this.yaz(`ZİNCİR x${this.zincir + 1}`, b.x, b.y - 12, true);
      this.olaylar.push({ tip: 'yutuldu', tur: b.tur, zincir: this.zincir });
      this.yenile(yem.tur);
      this.ipucuIlerle(4);
    } else {
      this.olaylar.push({ tip: 'isirdi', tur: b.tur });
      this.ipucuIlerle(2);
    }
    b.durum = 'olta';
    b.suru = -1;
    b.cirp = -1;
    b.t = 0;
    this.kancadaki = b;
    this.sarsinti = Math.max(this.sarsinti, 0.2 + TUR[b.tur].agirlik * 0.6);
    if (canli) {
      if (this.rng() < 0.75 || this.yakalanan[b.tur] === 0) this.soyle(b, this.secSoz(b.tur));
      // Yakındakiler ürker.
      for (const o of this.baliklar) {
        if (o === b || o.durum !== 'yuz' || TUR[o.tur].sira === 0) continue;
        const ux = o.x - b.x;
        const uy = o.y - b.y;
        const m = Math.hypot(ux, uy);
        if (m < 30 && m > 0.1) {
          o.durum = 'kac';
          o.t = 0.5;
          o.vx = (ux / m) * 70;
          o.vy = (uy / m) * 40;
        }
      }
    }
  }

  /** Eksilen türün yerine ekran dışından yenisi gelir. */
  private yenile(tur: number): void {
    if (TUR[tur].sira === 0 || tur === KILIC) return;
    const sag = this.kam.x + G / 2 < DUNYA_G / 2;
    const x = sag ? DUNYA_G - 8 : Math.max(TUR[tur].minX + 10, 8);
    const b = this.tekBalik(tur, x);
    b.yon = sag ? -1 : 1;
    if (tur === HAMSI || tur === ISTAVRIT) {
      const adaylar = this.surular.map((s, i) => (s.tur === tur ? i : -1)).filter((i) => i >= 0);
      b.suru = adaylar[(this.rng() * adaylar.length) | 0];
      b.ox = (this.rng() - 0.5) * 28;
      b.oy = (this.rng() - 0.5) * 12;
    }
  }

  private ucusAdim(b: Balik, i: number, dt: number): void {
    const sure = 0.5;
    const k = Math.min(1, b.t / sure);
    const hx = this.tekne.x + 2;
    const hy = this.tekne.y - 3;
    b.x = b.ux + (hx - b.ux) * k;
    b.y = b.uy + (hy - b.uy) * k - Math.sin(k * Math.PI) * 14;
    b.faz += dt * 30;
    if (k >= 1) {
      this.baliklar.splice(i, 1);
      this.indi(b);
      this.yenile(b.tur);
    }
  }

  private anaAdim(dt: number): void {
    const istenen = 3 + Math.floor(this.t / 35);
    if (this.analar.length < istenen) this.anaEkle(this.kam.x > DUNYA_G / 2 - G / 2 ? 170 : DUNYA_G - 12);
    const kx = this.kancaX;
    const ky = this.kancaY;
    for (const a of this.analar) {
      a.faz += dt * 2.2;
      a.x += Math.sin(this.zaman * 0.23 + a.y0) * 5 * dt;
      a.y = a.y0 + Math.sin(a.faz * 0.5) * 9;
      a.x = sinirla(a.x, 150, DUNYA_G - 8);
      if (this.kopuk <= 0 && this.sersem <= 0 && ky > this.yuzey(kx) + 2 && Math.hypot(kx - a.x, ky - (a.y + 3)) < 7.5) {
        this.carpil(a);
      }
    }
  }

  private carpil(a: Anasi): void {
    this.sersem = 1.3;
    this.flas = 0.07;
    this.sarsinti = 0.7;
    this.sac('kivilcim', this.kancaX, this.kancaY, 12, 55);
    this.soyle(null, 'ZZZT!', a.x, a.y - 8);
    this.olaylar.push({ tip: 'carpildi' });
    this.birak('KAÇTI!');
  }

  /** Kancadaki balık kurtulur. */
  private birak(soz: string): void {
    const b = this.kancadaki;
    this.kancadaki = null;
    this.gerilim = 0;
    this.kopma = 0;
    this.zincir = 0;
    if (!b) return;
    if (TUR[b.tur].sira === 0) {
      b.durum = 'yuz';
      b.y = this.taban(b.x) - 4;
      return;
    }
    b.durum = 'kac';
    b.t = 0;
    b.vx = (this.rng() < 0.5 ? -1 : 1) * 80;
    b.vy = 30;
    b.hedefY = this.bantY(b.tur, this.rng(), b.x);
    this.soyle('reis', soz);
    if (this.rng() < 0.6) this.soyle(b, 'GÖRÜŞÜRÜZ REİS!');
  }

  private gerilimAdim(dt: number): void {
    const b = this.kancadaki;
    if (!b || this.kopuk > 0) {
      this.gerilim += (0 - this.gerilim) * Math.min(1, dt * 8);
      this.kopma = 0;
      return;
    }
    const w = TUR[b.tur].agirlik;
    const cirp = b.cirp > 0 && TUR[b.tur].sira > 0;
    let hedef = w * (this.cekiyor ? 1 : 0.3) * (cirp ? 2.3 : 1);
    hedef += this.firtina * w * 0.35 * (0.5 + 0.5 * Math.sin(this.zaman * 2.1));
    this.gerilim += (hedef - this.gerilim) * Math.min(1, dt * 7);
    if (this.gerilim > 1) this.kopma += (this.gerilim - 1) * dt;
    else this.kopma = Math.max(0, this.kopma - dt * 0.6);
    if (this.kopma > 0.32) {
      this.kopan++;
      this.kopuk = 1.7;
      this.sarsinti = 1;
      this.sac('kivilcim', this.ucX(), this.ucY(), 8, 45);
      this.olaylar.push({ tip: 'koptu' });
      this.birak('MİSİNA KOPTU!');
    }
  }

  private havaAdim(dt: number): void {
    if (this.vapur) {
      this.vapur.x += this.vapur.yon * 9 * dt;
      if (this.vapur.x < -50 || this.vapur.x > G + 50) this.vapur = null;
    }
    if (this.simsek) {
      this.simsek.t -= dt;
      if (this.simsek.t <= 0) this.simsek = null;
    }
    if (this.firtina > 0.6 && this.oyunda && !this.bitti) {
      this.simsekSayac -= dt;
      if (this.simsekSayac <= 0) {
        this.simsekSayac = 4 + this.rng() * 6;
        const x = this.kam.x + 14 + this.rng() * (G - 28);
        const yol: number[] = [];
        let cx = x + (this.rng() - 0.5) * 30;
        const son = this.yuzey(x);
        for (let y = 0; y < son; y += 5 + this.rng() * 6) {
          yol.push(cx, y);
          cx += (this.rng() - 0.5) * 14 + (x - cx) * 0.2;
        }
        yol.push(x, son);
        this.simsek = { x, t: 0.32, yol };
        this.flas = 0.09;
        this.sarsinti = 1;
        this.kediKabarik = 1.5;
        if (this.rng() < 0.6) this.soyle('kedi', 'TISSS!');
        this.sac('damla', x, son, 10, 60);
        for (const b of this.baliklar) {
          if (b.durum === 'ilgi' || (b.durum === 'yuz' && TUR[b.tur].sira > 0 && Math.abs(b.x - x) < 60)) {
            b.durum = 'kac';
            b.t = 0.4;
            b.vx = (b.x < x ? -1 : 1) * 75;
            b.vy = 25;
          }
        }
        this.olaylar.push({ tip: 'simsek' });
      }
    }
  }

  private parcaAdim(dt: number): void {
    for (let i = this.parcalar.length - 1; i >= 0; i--) {
      const p = this.parcalar[i];
      p.omur -= dt;
      if (p.tip === 'kabarcik') {
        p.vy += (-16 - p.vy) * dt * 2;
        p.vx *= 1 - dt * 3;
        p.x += (p.vx + Math.sin(this.zaman * 6 + p.y) * 4) * dt;
        p.y += p.vy * dt;
        if (p.y < this.yuzey(p.x) + 1) p.omur = 0;
      } else if (p.tip === 'damla') {
        p.vy += 220 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vy > 0 && p.y > this.yuzey(p.x)) p.omur = 0;
      } else if (p.tip === 'kalp') {
        p.x += Math.sin(this.zaman * 5 + p.omur * 3) * 6 * dt;
        p.y -= 9 * dt;
      } else {
        p.vx *= 1 - dt * 5;
        p.vy *= 1 - dt * 5;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.omur <= 0) this.parcalar.splice(i, 1);
    }
    for (let i = this.balonlar.length - 1; i >= 0; i--) {
      const b = this.balonlar[i];
      b.t += dt;
      const s = b.sahip;
      if (s === 'reis') {
        b.x = this.tekne.x - 13;
        b.y = this.tekne.y - 17;
      } else if (s === 'kedi') {
        b.x = this.tekne.x + 15;
        b.y = this.tekne.y - 14;
      } else if (s) {
        b.x = s.x;
        b.y = s.y - 9;
      }
      if (b.t > 1.5 + b.metin.length * 0.055) this.balonlar.splice(i, 1);
    }
    for (let i = this.yazilar.length - 1; i >= 0; i--) {
      const y = this.yazilar[i];
      y.t += dt;
      y.y -= 11 * dt;
      if (y.t > 1.4) this.yazilar.splice(i, 1);
    }
  }

  // ---- İpuçları: ilk gecede adım adım öğretir ----

  private ipucuIlerle(olay: number): void {
    // 1 indir → 2 bırak → 3 yem yap → 4 bitti
    if (olay === 2 && this.ipucuNo === 1) {
      this.ipucuNo = 2;
      this.ipucu = 'BIRAK: MİSİNAYI SAR';
      this.ipucuSure = 99;
    } else if (olay === 3 && this.ipucuNo === 2) {
      this.ipucuNo = 3;
      this.ipucu = 'TUTTUĞUNU DERİNE İNDİR: BÜYÜĞÜ GELİR';
      this.ipucuSure = 9;
    } else if (olay === 4 && this.ipucuNo <= 3) {
      this.ipucuNo = 4;
      this.ipucu = 'DERİN SU SAĞDA >';
      this.ipucuSure = 5;
    }
  }

  private ipucuAdim(dt: number): void {
    if (this.ipucuSure > 0) {
      this.ipucuSure -= dt;
      if (this.ipucuSure <= 0) this.ipucu = '';
    }
    if (this.bitti) this.ipucu = '';
  }
}
