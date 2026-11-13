/**
 * Sahne çizimi: gök, uzak ve orta katman (harabe kasaba), zemin, siper,
 * askerler, araçlar, mermiler, patlamalar, arayüz. Açıklık değerleri Tuval'e
 * yazılır; tarama Tuval.sun'da. Arka plan katmanları açılışta bir kez üretilir.
 */
import {
  BAGLAR, DUNYA_G, Dunya, G, G_MAYIN, KOS, M_BOMBA, M_OBOMBA, O_CIFT, O_HIZ, O_TAMIR, M_DKURSUN, M_DRPG, M_HAVAN, M_KURSUN, M_ROKET, M_TOP, NISAN, PANIK,
  P_ATES, P_DUMAN, P_ENKAZ, P_KAN, P_KIVILCIM, P_KOVAN, P_KULE, P_TOPRAK, P_TOZ, SIPER_ON, SIPER_X, T_HELI, T_JET,
  T_KAMYON, T_NAKLIYE, T_ROKET, T_TANK, T_UCAKSAVAR, YANIYOR,
  type Asker, type Bez,
} from './dunya';
import {
  SPR_AGAC, SPR_DHELI, SPR_GOMU, SPR_HELI, SPR_JET, SPR_KAMYON, SPR_KIRPI, SPR_KULE, SPR_MAYIN, SPR_NAKLIYE, SPR_SANDIK,
  SPR_SIMGE_HELI,
  SPR_SIMGE_SIPER, SPR_TANK, SPR_UCAKSAVAR,
} from './sprite';
import { AKKOR, ATES, KAN, KURU_KAN, Tuval, yaziGenislik } from './tuval';

/** Bomba düğmesinin ekrandaki yeri (çizim ve dokunma aynı yeri kullanır). */
export function bombaDugme(yuk: number): { x: number; y: number; r: number } {
  return { x: G - 30, y: yuk - 36, r: 20 };
}

export interface Arayuz {
  durum: 'baslik' | 'oyun' | 'sonuc';
  rekor: number;
  yeniRekor: boolean;
  sesAcik: boolean;
  duyuru: string;
  duyuruT: number;
  sonucT: number;
  ipucuT: number;
}

const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const kes = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const UZAK_K = 0.12;
const ORTA_K = 0.38;
const UW = Math.ceil(G + (DUNYA_G - G) * UZAK_K) + 8;
const UH = 170;
const OW = Math.ceil(G + (DUNYA_G - G) * ORTA_K) + 8;
const OH = 280;

/** Bez bebekte her noktaya değen bağlar (bit maskesi). */
const NOKTA_BAG = [1, 15, 50, 4, 8, 16, 32];

const LOGO = [
  ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
];

/** Uzak katman: tepeler, küçük yapılar, bacalar. 0 = saydam. */
function uzakKatman(): Uint8Array {
  const t = new Tuval(UW, UH);
  t.g.fill(0);
  for (let x = 0; x < UW; x++) {
    const a = UH - 30 - 13 * Math.sin(x * 0.017 + 0.6) - 7 * Math.sin(x * 0.043 + 2);
    for (let y = Math.round(a); y < UH; y++) t.g[y * UW + x] = 234;
    const b = UH - 14 - 7 * Math.sin(x * 0.026 + 3) - 4 * Math.sin(x * 0.07);
    for (let y = Math.round(b); y < UH; y++) t.g[y * UW + x] = 224;
  }
  for (let i = 0; i < 22; i++) {
    const x = Math.round(kes(i, 1) * (UW - 30)) + 4;
    const w = 9 + Math.round(kes(i, 2) * 16);
    const h = 14 + Math.round(kes(i, 3) * 70);
    const y = UH - 12 - Math.round(7 * Math.sin(x * 0.026 + 3)) - h;
    t.kutu(x, y, w, h + 6, 213);
    for (let wy = y + 3; wy < y + h - 2; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (kes(wx, wy) < 0.6) t.kutu(wx, wy, 1, 2, 190);
    if (kes(i, 4) < 0.3) {
      t.kutu(x + 2, y - 22, 3, 22, 213);
      for (let k = 0; k < 5; k++) t.daire(x + 5 + k * 5, y - 25 - k * 3, 2.5 + k * 1.1, 240);
    }
  }
  return t.g;
}

/** Orta katman: bombalanmış binalar, direkler, kuru ağaçlar. 0 = saydam. */
function ortaKatman(): Uint8Array {
  const t = new Tuval(OW, OH);
  t.g.fill(0);
  const taban = (x: number): number => OH - 9 - 5 * Math.sin(x * 0.03 + 1) - 3 * Math.sin(x * 0.083 + 2);
  // Binalar
  let bx = 26;
  let no = 0;
  while (bx < OW - 50) {
    no++;
    const w = 32 + Math.round(kes(no, 1) * 44);
    const h = 60 + Math.round(kes(no, 2) * 180);
    const by = Math.round(taban(bx + w / 2)) + 3;
    const sol = kes(no, 3) < 0.5;
    const yikik = 0.25 + kes(no, 4) * 0.6;
    for (let c = 0; c < w; c++) {
      // Kırık üst kenar: bir köşeden basamak basamak çökmüş
      const u = sol ? c / w : 1 - c / w;
      const cok = Math.max(0, yikik - u) / yikik;
      const basamak = Math.floor(cok * 7) / 7;
      const ust = by - h + Math.round(basamak * h * 0.75 + (kes(Math.floor(c / 3) + no * 9, 5) - 0.5) * 4 * (cok > 0 ? 1 : 0));
      for (let y = ust; y < by; y++) t.g[y * OW + bx + c] = c >= w - 3 ? 128 : 170;
      if (ust >= 0) t.g[ust * OW + bx + c] = 128;
    }
    // Kat çizgileri ve pencereler
    for (let ky = by - 14; ky > by - h + 6; ky -= 17) {
      for (let c = 1; c < w - 1; c++) if (t.g[ky * OW + bx + c] === 170) t.g[(ky + 9) * OW + bx + c] = 150;
      for (let c = 5; c < w - 8; c += 11) {
        const patlak = kes(c + no * 3, ky) < 0.22;
        for (let yy = 0; yy < 8; yy++) {
          for (let xx = 0; xx < 5; xx++) {
            const i = (ky - yy) * OW + bx + c + xx;
            if (t.g[i] !== 170) continue;
            t.g[i] = patlak ? 0 : 85;
          }
        }
        if (patlak) {
          // Patlamış duvar: pencerenin çevresi de dökülmüş
          for (let k = 0; k < 14; k++) {
            const i = (ky - 4 + Math.round((kes(k, c) - 0.5) * 14)) * OW + bx + c + 2 + Math.round((kes(c, k) - 0.5) * 12);
            if (i > 0 && i < t.g.length && t.g[i] === 170) t.g[i] = 0;
          }
        } else if (kes(c, ky + no) < 0.5) {
          for (let xx = 0; xx < 5; xx++) {
            const i = (ky - 4) * OW + bx + c + xx;
            if (t.g[i] === 85) t.g[i] = 213;
          }
        }
      }
    }
    // Enkaz yığını
    for (let k = 0; k < 12; k++) {
      const rx = bx + Math.round((sol ? 0 : w) + (kes(no, k + 20) - 0.5) * 30);
      const rw = 3 + Math.round(kes(k, no) * 6);
      t.kutu(rx, by - 2 - Math.round(kes(k, no + 1) * 7), rw, 9, kes(k, 7) < 0.5 ? 150 : 128);
    }
    bx += w + 12 + Math.round(kes(no, 6) * 54);
  }
  // Zemin şeridi
  for (let x = 0; x < OW; x++) for (let y = Math.round(taban(x)); y < OH; y++) t.g[y * OW + x] = 150;
  // Direkler ve teller
  let once = -1;
  for (let x = 14; x < OW; x += 74 + Math.round(kes(x, 8) * 30)) {
    const by = Math.round(taban(x));
    const egik = Math.round((kes(x, 9) - 0.5) * 6);
    t.cizgi(x, by, x + egik, by - 48, 112);
    t.cizgi(x + egik - 5, by - 43, x + egik + 5, by - 44, 112);
    if (once >= 0 && kes(x, 10) < 0.75) {
      const ox = once;
      for (let k = 0; k <= 30; k++) {
        const u = k / 30;
        t.nokta(ox + (x + egik - ox) * u, by - 44 + Math.sin(u * Math.PI) * 9, 126);
      }
    }
    once = x + egik;
  }
  // Kuru ağaçlar
  const dal = (x: number, y: number, aci: number, uz: number, d: number): void => {
    const x1 = x + Math.cos(aci) * uz;
    const y1 = y + Math.sin(aci) * uz;
    t.cizgi(x, y, x1, y1, 118);
    if (d > 2) t.cizgi(x + 1, y, x1 + 1, y1, 118);
    if (d <= 0) return;
    dal(x1, y1, aci - 0.35 - kes(x, d) * 0.4, uz * 0.72, d - 1);
    dal(x1, y1, aci + 0.3 + kes(y, d) * 0.4, uz * 0.7, d - 1);
  };
  for (let x = 50; x < OW; x += 96 + Math.round(kes(x, 11) * 60)) dal(x, Math.round(taban(x)) + 2, -Math.PI / 2 + (kes(x, 12) - 0.5) * 0.3, 13, 4);
  return t.g;
}

export class Sahne {
  private uzak = uzakKatman();
  private orta = ortaKatman();
  private bulutlar: { x: number; y: number; b: number }[] = [];
  private sx = 0;
  private sy = 0;
  private kamX = 0;

  constructor(
    private t: Tuval,
    private d: Dunya,
  ) {
    for (let i = 0; i < 6; i++) this.bulutlar.push({ x: Math.random() * (G + 120), y: 56 + Math.random() * d.zemin * 0.34, b: 0.6 + Math.random() * 0.7 });
  }

  guncelle(dt: number): void {
    for (const b of this.bulutlar) {
      b.x += 3.5 * b.b * dt;
      if (b.x > G + 70) b.x = -70;
    }
    const s = this.d.sarsinti;
    this.sx = s > 0.02 ? Math.round((Math.random() - 0.5) * 7 * s) : 0;
    this.sy = s > 0.02 ? Math.round((Math.random() - 0.5) * 7 * s) : 0;
  }

  ciz(a: Arayuz): void {
    this.kamX = Math.round(this.d.kam.x) - this.sx;
    this.gok();
    this.havadakiler();
    this.zeminCiz();
    this.enkazlar();
    this.siper(false);
    this.araclar();
    this.askerler();
    this.siper(true);
    this.bezler();
    this.mermiler();
    this.heli();
    this.efektler();
    this.yazilar();
    if (a.durum === 'oyun') this.hud(a);
    else if (a.durum === 'baslik') this.baslik(a);
    else {
      this.hud(a);
      this.sonuc(a);
    }
  }

  // ---- Gök ve arka plan ----

  private katman(buf: Uint8Array, bw: number, bh: number, ofs: number, y0: number): void {
    const { g, v, w: W, h: H } = this.t;
    ofs = sinirla(Math.round(ofs), 0, bw - W);
    for (let y = 0; y < bh; y++) {
      const ty = y0 + y;
      if (ty < 0 || ty >= H) continue;
      const s = y * bw + ofs;
      const dd = ty * W;
      for (let x = 0; x < W; x++) {
        const c = buf[s + x];
        if (c) {
          g[dd + x] = c;
          v[dd + x] = 0;
        }
      }
    }
  }

  private gok(): void {
    const { t, d } = this;
    const W = t.w;
    const ufuk = d.zemin + this.sy;
    // Kâğıt gök, ufka doğru hafif pus
    t.v.fill(0);
    t.g.fill(255);
    void W;
    // Güneş
    const gx = G * 0.74 - d.kam.x * 0.03;
    const gy = Math.round(d.yuk * 0.13);
    t.daire(gx, gy, 21, 234);
    t.daire(gx, gy, 18, 0, AKKOR);
    // Bulutlar
    for (const b of this.bulutlar) {
      const x = b.x - d.kam.x * 0.06;
      t.kutu(x - 22 * b.b, b.y, 44 * b.b, 5, 234);
      t.daire(x - 9 * b.b, b.y, 8 * b.b, 234);
      t.daire(x + 6 * b.b, b.y - 2, 11 * b.b, 234);
      t.daire(x + 17 * b.b, b.y + 1, 6 * b.b, 234);
    }
    this.katman(this.uzak, UW, UH, d.kam.x * UZAK_K, ufuk - UH + 6);
    this.katman(this.orta, OW, OH, d.kam.x * ORTA_K, ufuk - OH + 8);
  }

  private havadakiler(): void {
    const { t, d } = this;
    const kam = this.kamX;
    for (const o of d.havalar) {
      const x = o.x - kam;
      const y = o.y + this.sy;
      if (x < -70 || x > G + 70) continue;
      if (o.tip === T_HELI) {
        t.cizDon(SPR_DHELI, x, y, o.aci, o.yon < 0, 22, 7);
        if (!o.dusuyor) this.pervane(x, y, o.aci, o.yon, 24, 20, 7, 22);
      } else if (o.tip === T_JET) {
        t.cizDon(SPR_JET, x, y, o.dusuyor ? o.aci * 0.5 : 0, true, 24, 6);
        if (!o.dusuyor) {
          t.vurgu(x + 25, y, ATES);
          t.vurgu(x + 26, y, ATES);
          t.vurgu(x + 27, y, AKKOR);
        }
      } else {
        t.ciz(SPR_NAKLIYE, x - 28, y - 6);
        const p = Math.floor(d.zaman * 30) % 2 === 0 ? 6 : 3;
        t.cizgi(x - 2, y + 3 - p, x - 2, y + 3 + p, 60);
        t.cizgi(x - 12, y + 3 - p, x - 12, y + 3 + p, 60);
      }
    }
    for (const s of d.sandiklar) {
      const x = s.x - kam;
      const y = s.y + this.sy;
      if (s.parasut && s.yerde <= 0) {
        // Paraşüt
        for (let k = -10; k <= 10; k++) {
          const yy = y - 22 - Math.sqrt(Math.max(0, 100 - k * k)) * 0.7;
          t.nokta(x + k, yy, 0);
          if (Math.abs(k) < 10) for (let f = yy + 1; f < y - 21; f++) t.nokta(x + k, f, k % 5 === 0 ? 150 : 240);
        }
        t.cizgi(x - 10, y - 22, x - 4, y - 4, 0);
        t.cizgi(x + 10, y - 22, x + 4, y - 4, 0);
        t.cizgi(x, y - 22, x, y - 4, 0);
      }
      if (s.yerde > 11 && Math.floor(d.zaman * 6) % 2 !== 0) continue;
      if (s.tip === O_TAMIR) {
        t.ciz(SPR_SANDIK, x - 5, y - 4);
        continue;
      }
      // Güçlendirme sandığı: beyaz kutu, üstünde simge; hafifçe yanıp söner
      const by = y - 6 + Math.round(Math.sin(d.zaman * 5 + s.x) * 1.5);
      t.kutu(x - 8, by - 1, 17, 13, 0);
      t.kutu(x - 7, by, 15, 11, 255);
      if (Math.floor(d.zaman * 4) % 2 === 0) t.cerceve(x - 10, by - 3, 21, 17, 0);
      if (s.tip === O_CIFT) t.yazi('x2', x + 1, by + 3, { olcek: 1, hiza: 0 });
      else if (s.tip === O_HIZ) t.yazi('>>', x + 1, by + 3, { olcek: 1, hiza: 0 });
      else {
        t.daire(x, by + 6, 3, 0);
        t.cizgi(x + 2, by + 3, x + 4, by + 1, 0);
        t.vurgu(x + 5, by + 1, ATES);
      }
    }
  }

  /** Dönen pervane: uzunluğu kareden kareye değişir, üstüne açık bir bulanıklık çizgisi. */
  private pervane(x: number, y: number, aci: number, yon: number, yari: number, ox: number, oy: number, sprOx: number): void {
    const t = this.t;
    const c = Math.cos(aci);
    const s = Math.sin(aci);
    // Direğin ucu: sprite'ta (ox, 0), dönme merkezi (sprOx, oy)
    const lx = (ox - sprOx) * (yon < 0 ? -1 : 1);
    const ly = -oy;
    const mx = x + c * lx - s * ly;
    const my = y + s * lx + c * ly;
    const k = Math.floor(this.d.zaman * 60) % 3;
    const uz = k === 0 ? yari : k === 1 ? yari * 0.45 : yari * 0.8;
    t.cizgi(mx - c * yari, my - s * yari, mx + c * yari, my + s * yari, 150);
    t.cizgi(mx - c * uz, my - s * uz, mx + c * uz, my + s * uz, 0);
  }

  // ---- Zemin ----

  private zeminCiz(): void {
    const { t, d } = this;
    const W = t.w;
    const H = t.h;
    const kam = this.kamX;
    for (let x = 0; x < W; x++) {
      const wx = sinirla(x + kam, 0, DUNYA_G);
      const y0 = Math.round(d.yer[wx]) + this.sy;
      const is = d.is[wx];
      const kan = d.kanIz[wx];
      const yanik = is > 40 ? 2 + Math.round(is / 70) : 0;
      for (let y = Math.max(0, y0); y < H; y++) {
        const dd = y - y0;
        const i = y * W + x;
        t.v[i] = 0;
        let g: number;
        if (dd < 2) g = 0;
        else if (dd < 2 + yanik) g = kes(wx, dd) < 0.7 ? 0 : 40;
        else {
          // Toprak: aşağı doğru koyulaşır, katman çizgileri ve taşlar
          g = dd < 26 ? 85 : dd < 60 ? 85 - (dd - 26) * 1.25 : 42;
          const kat = dd + Math.round(3 * Math.sin(wx * 0.045 + dd * 0.15));
          if (kat === 14 || kat === 34) g = 42;
          else if (kat === 62 || kat === 90) g = 0;
          else if (kes(wx, y - this.sy) < 0.01) g = 128;
        }
        t.g[i] = g;
      }
      // Kan: yüzeyde kırmızı, yoğunsa aşağı sızar
      if (kan > 30 && y0 >= 0 && y0 < H - 6) {
        const derin = 1 + (kan > 110 ? 1 : 0) + (kan > 190 ? 1 : 0) + (kan > 150 && kes(wx, 3) < 0.3 ? 2 : 0);
        for (let k = 0; k < derin; k++) t.v[(y0 + k) * W + x] = k < 2 ? KAN : KURU_KAN;
      }
      // Ot
      if (is < 40 && kes(wx, 7) < 0.16 && wx > SIPER_ON) {
        const boy = 1 + Math.floor(kes(wx, 8) * 3);
        for (let k = 1; k <= boy; k++) t.nokta(x + (k === boy && kes(wx, 9) < 0.5 ? 1 : 0), y0 - k, 0);
      }
    }
    // Toprağın altındakiler: mayın ve sandık siluetleri
    for (const g of d.gomuler) {
      const x = g.x - kam;
      if (x < -12 || x > G + 12) continue;
      const y = Math.round(g.y) + this.sy;
      if (g.tip === G_MAYIN) {
        if (g.fitil >= 0 && Math.floor(d.zaman * 20) % 2 === 0) t.daire(x, y, 9, 0, KAN);
        t.ciz(SPR_MAYIN, x - 5, y - 5);
        if (Math.floor(d.zaman * 2 + g.x) % 2 === 0) t.nokta(x, y, 255);
      } else t.ciz(SPR_GOMU, x - 5, y - 4);
    }
    // Sabit süsler: tank engelleri, kuru ağaçlar
    for (const [ox, tip] of SUSLER) {
      const x = ox - kam;
      if (x < -20 || x > G + 20) continue;
      const y = d.yerY(ox) + this.sy;
      if (tip === 0) t.ciz(SPR_KIRPI, x - 5, y - 7);
      else t.ciz(SPR_AGAC, x - 8, y - 13);
    }
  }

  private enkazlar(): void {
    const { t, d } = this;
    for (const e of d.enkazlar) {
      const x = e.x - this.kamX;
      if (x < -40 || x > G + 40) continue;
      const y = e.y + this.sy;
      if (e.t > 22 && Math.floor(d.zaman * 8) % 2 === 0) continue;
      if (e.tip === T_TANK) t.cizDon(SPR_TANK, x, y - 4, e.aci, true, 23, 6, 255);
      else if (e.tip === T_UCAKSAVAR) t.cizDon(SPR_UCAKSAVAR, x, y - 4, e.aci, true, 20, 6, 255);
      else if (e.tip === T_KAMYON) t.cizDon(SPR_KAMYON, x, y - 5, e.aci + 0.2, true, 20, 7, 255);
      else if (e.tip === T_HELI) t.cizDon(SPR_DHELI, x, y - 5, e.aci + 0.4, true, 22, 7, 255);
      else if (e.tip === T_JET) t.cizDon(SPR_JET, x, y - 4, e.aci + 0.5, true, 24, 6, 255);
      else t.cizDon(SPR_HELI, x, y - 5, e.aci + 0.5, false, 23, 8, 255);
    }
  }

  // ---- Siper ----

  private kumTorbasi(x: number, y: number): void {
    const t = this.t;
    t.kutu(x + 1, y, 8, 5, 0);
    t.kutu(x, y + 1, 10, 3, 0);
    t.kutu(x + 1, y + 1, 8, 3, 196);
    t.kutu(x + 2, y + 1, 5, 1, 232);
  }

  private siper(on: boolean): void {
    const { t, d } = this;
    const kam = this.kamX;
    const y = d.zemin + this.sy;
    const can = d.siperCan;
    if (!on) {
      // Arkadaki sığınak ve bayrak
      const bx = SIPER_X - 46 - kam;
      if (can > 0) {
        t.kutu(bx, y - 20, 34, 20, 0);
        t.kutu(bx + 1, y - 19, 32, 19, 96);
        t.kutu(bx + 5, y - 13, 14, 3, 0);
        t.kutu(bx + 24, y - 11, 6, 11, 30);
        for (let k = 0; k < 4; k++) this.kumTorbasi(bx - 2 + k * 9, y - 25);
        for (let k = 0; k < 3; k++) this.kumTorbasi(bx + 3 + k * 9, y - 29);
      } else {
        for (let k = 0; k < 9; k++) t.kutu(bx + k * 4 + Math.round(kes(k, 1) * 3), y - 3 - Math.round(kes(k, 2) * 8), 4, 11, kes(k, 3) < 0.5 ? 0 : 70);
      }
      const dx = SIPER_X - 54 - kam;
      const egik = can > 0 ? 0 : 9;
      t.cizgi(dx, y, dx + egik, y - 52, 0);
      t.cizgi(dx + 1, y, dx + 1 + egik, y - 52, 0);
      // Dalgalanan bayrak
      for (let k = 0; k < 17; k++) {
        const fy = y - 52 + Math.round(Math.sin(d.zaman * 5 - k * 0.5) * (k / 17) * 2.2);
        const fx = dx + egik + 2 + k;
        t.nokta(fx, fy, 0);
        t.nokta(fx, fy + 10, 0);
        for (let m = 1; m < 10; m++) t.nokta(fx, fy + m, can > 0 ? 250 : 120);
        if (k === 16) for (let m = 0; m <= 10; m++) t.nokta(fx, fy + m, 0);
        if (k >= 6 && k <= 10) for (let m = 3; m <= 7; m++) if (Math.abs(k - 8) + Math.abs(m - 5) <= 2) t.nokta(fx, fy + m, 0);
      }
      return;
    }
    // Öndeki kum torbası duvarı (askerlerin önünde)
    const sx = SIPER_ON - 16 - kam;
    const satir = can > 66 ? 3 : can > 33 ? 2 : can > 0 ? 1 : 0;
    for (let r = 0; r < satir; r++) {
      for (let k = 0; k < 3 - (r === 2 ? 1 : 0); k++) this.kumTorbasi(sx + k * 9 + (r % 2) * 4 - (r === 2 ? -4 : 0), y - 5 - r * 4);
    }
    for (const ox of [-30, -8, 14]) {
      if (can > 0) for (let k = 0; k < 2; k++) this.kumTorbasi(SIPER_X + ox + k * 9 - kam, y - 5);
    }
    // Dikenli tel
    const tx = SIPER_ON + 6 - kam;
    for (let k = 0; k < 26; k++) {
      t.nokta(tx + k, y - 4 + Math.round(Math.sin(k * 1.3) * 2), 0);
      if (k % 6 === 0) t.cizgi(tx + k, y, tx + k, y - 7, 0);
    }
  }

  // ---- Araçlar ----

  private canCubugu(x: number, y: number, oran: number): void {
    const t = this.t;
    if (oran >= 1 || oran <= 0) return;
    t.kutu(x - 10, y, 20, 3, 0);
    t.kutu(x - 9, y + 1, 18, 1, 236);
    t.kutu(x - 9, y + 1, Math.max(1, Math.round(18 * oran)), 1, 0, KAN);
  }

  private araclar(): void {
    const { t, d } = this;
    const kam = this.kamX;
    for (const a of d.araclar) {
      const x = a.x - kam + (a.sars > 0 ? (Math.floor(d.zaman * 60) % 2 ? 1 : -1) : 0);
      const y = Math.round(a.y) + this.sy;
      if (x < -40 || x > G + 40) continue;
      if (a.tip === T_TANK) {
        const yon = a.nisanT > 0 && d.heli.x > a.x ? 1 : -1;
        const c = Math.cos(a.namlu);
        const s = Math.sin(a.namlu);
        t.kalin(x + yon * 6, y - 16, x + yon * (6 + c * 20), y - 16 - s * 20, 0);
        t.ciz(SPR_KULE, x - 10 + (yon > 0 ? 2 : -2), y - 19, yon < 0);
        t.ciz(SPR_TANK, x - 23, y - 12, true);
        // Palet hareketi
        if (a.x > a.dur) {
          const k = Math.floor(a.t * 12) % 3;
          for (let p = -21 + k; p < 22; p += 3) t.nokta(x + p, y - 7, 150);
        }
        if (a.nisanT > 0 && Math.floor(d.zaman * 14) % 2 === 0) {
          // Nişan çizgisi: helikoptere doğru kesik çizgi
          const hx = d.heli.x - kam;
          const hy = d.heli.y + this.sy;
          for (let k = 1; k < 9; k += 2) {
            const u0 = k / 10;
            const u1 = (k + 1) / 10;
            t.cizgi(x + (hx - x) * u0, y - 16 + (hy - y + 16) * u0, x + (hx - x) * u1, y - 16 + (hy - y + 16) * u1, 0, KAN);
          }
        }
      } else if (a.tip === T_UCAKSAVAR) {
        t.ciz(SPR_UCAKSAVAR, x - 20, y - 12, true);
        const px = x + 9;
        const py = y - 11;
        const c = Math.cos(a.namlu);
        const s = Math.sin(a.namlu);
        t.kutu(px - 3, py - 3, 7, 4, 0);
        t.cizgi(px, py - 3, px + c * 15, py - 3 - s * 15, 0);
        t.cizgi(px, py - 5, px + c * 15, py - 5 - s * 15, 0);
      } else {
        t.ciz(SPR_KAMYON, x - 20, y - 14, true);
      }
      this.canCubugu(x, y - 30, a.can / a.enCan);
    }
  }

  // ---- Askerler ----

  private adam(s: Asker): void {
    const t = this.t;
    const x = Math.round(s.x - this.kamX);
    if (x < -12 || x > G + 12) return;
    const y = Math.round(s.y) + this.sy;
    const yon = s.yon;
    let kalca = y - 6;
    let boyun = y - 11;
    let egil = 0;
    const kosuyor = s.durum === KOS || s.durum === PANIK || s.durum === YANIYOR;
    if (kosuyor) {
      const a = Math.sin(s.faz) * 3;
      const b = Math.cos(s.faz);
      t.cizgi(x, kalca, x + a, y - Math.max(0, b) * 2, 0);
      t.cizgi(x, kalca, x - a, y - Math.max(0, -b) * 2, 0);
      egil = yon * 1.6;
    } else if (s.tip === T_ROKET && !s.dost) {
      // Diz çökmüş
      kalca = y - 4;
      boyun = y - 9;
      t.cizgi(x, kalca, x + yon * 3, y - 3, 0);
      t.cizgi(x + yon * 3, y - 3, x + yon * 3, y, 0);
      t.cizgi(x, kalca, x - yon * 3, y, 0);
    } else {
      t.cizgi(x, kalca, x - 2, y, 0);
      t.cizgi(x, kalca, x + 2, y, 0);
    }
    const nx = Math.round(x + egil);
    t.cizgi(x, kalca, nx, boyun, 0);
    t.cizgi(x + 1, kalca, nx + 1, boyun, 0);
    const hx = Math.round(x + egil * 1.4);
    const hy = boyun - 3;
    t.daire(hx + 0.5, hy, 2.3, 0);
    if (s.dost) {
      t.nokta(hx, hy, 250);
      t.nokta(hx + 1, hy, 250);
    } else t.cizgi(hx - 2, hy - 1, hx + 3, hy - 1, 0);

    if (s.durum === PANIK) {
      t.cizgi(nx, boyun + 1, nx - 4, boyun - 3, 0);
      t.cizgi(nx + 1, boyun + 1, nx + 5, boyun - 3, 0);
    } else if (s.durum === YANIYOR) {
      const k = Math.sin(s.faz * 1.7) * 3;
      t.cizgi(nx, boyun + 1, nx - 4, boyun - 2 + k, 0);
      t.cizgi(nx + 1, boyun + 1, nx + 5, boyun - 2 - k, 0);
    } else if (s.durum === KOS) {
      t.cizgi(nx, boyun + 1, nx + yon * 3, boyun + 4, 0);
      if (s.tip === T_ROKET) t.kalin(nx - yon * 4, boyun, nx + yon * 5, boyun - 2, 0);
      else t.cizgi(nx - yon * 1, boyun + 5, nx + yon * 7, boyun + 2, 0);
    } else {
      const c = Math.cos(s.nisanAci);
      const sn = Math.sin(s.nisanAci);
      t.cizgi(nx, boyun + 1, nx + c * 4, boyun + 1 + sn * 4, 0);
      if (s.tip === T_ROKET && !s.dost) {
        t.kalin(nx - c * 4, boyun - sn * 4, nx + c * 7, boyun + sn * 7, 0);
        t.nokta(nx + c * 8, boyun + sn * 8, 0);
        // Nişan alırken yanıp sönen işaret
        if (s.hedef === 1 && Math.floor(this.d.zaman * 14) % 2 === 0) t.yazi('!', x, y - 26, { hiza: 0, vurgu: KAN });
      } else t.cizgi(nx + c * 2, boyun + 1 + sn * 2, nx + c * 9, boyun + 1 + sn * 9, 0);
    }
  }

  private askerler(): void {
    for (const s of this.d.askerler) this.adam(s);
  }

  private bezler(): void {
    const { t, d } = this;
    const kam = this.kamX;
    for (const b of d.bezler) {
      const x0 = b.x[2] - kam;
      if (x0 < -40 || x0 > G + 40) continue;
      for (let n = 0; n < 6; n++) {
        const [i0, i1] = BAGLAR[n];
        if (b.bag & (1 << n)) {
          t.cizgi(b.x[i0] - kam, b.y[i0] + this.sy, b.x[i1] - kam, b.y[i1] + this.sy, 0);
          if (n === 1) t.cizgi(b.x[i0] - kam + 1, b.y[i0] + this.sy, b.x[i1] - kam + 1, b.y[i1] + this.sy, 0);
        } else if (!b.yanik) {
          // Kopuk yer: iki uçta kan
          t.vurgu(b.x[i0] - kam, b.y[i0] + this.sy, KAN);
          t.vurgu(b.x[i1] - kam, b.y[i1] + this.sy, KAN);
        }
      }
      for (let k = 1; k < 7; k++) {
        if (b.bag & NOKTA_BAG[k]) continue;
        // Kopmuş uzuv: kısa bir çizgi
        const x = b.x[k] - kam;
        const y = b.y[k] + this.sy;
        const vx = b.x[k] - b.px[k];
        const vy = b.y[k] - b.py[k];
        const m = Math.hypot(vx, vy);
        const ux = m > 0.05 ? vx / m : 1;
        const uy = m > 0.05 ? vy / m : 0;
        t.cizgi(x - ux * 2, y - uy * 2 - 1, x + ux * 2, y + uy * 2 - 1, 0);
        if (!b.yanik) t.vurgu(x - ux * 2, y - uy * 2 - 1, KAN);
      }
      const hx = b.x[0] - kam;
      const hy = b.y[0] + this.sy;
      t.daire(hx + 0.5, hy, 2.3, 0);
      if (b.dost) t.nokta(hx, hy, 250);
    }
  }

  // ---- Mermiler ----

  private mermiler(): void {
    const { t, d } = this;
    const kam = this.kamX;
    for (const iz of d.izler) t.cizgi(iz.x0 - kam, iz.y0 + this.sy, iz.x1 - kam, iz.y1 + this.sy, 0, ATES);
    for (const m of d.mermiler) {
      const x = m.x - kam;
      const y = m.y + this.sy;
      if (x < -20 || x > G + 20) continue;
      const hiz = Math.hypot(m.vx, m.vy) || 1;
      const ux = m.vx / hiz;
      const uy = m.vy / hiz;
      if (m.tip === M_KURSUN) {
        t.cizgi(x - ux * 7, y - uy * 7, x, y, 0, ATES);
        t.vurgu(x, y, AKKOR);
      } else if (m.tip === M_ROKET || m.tip === M_DRPG) {
        t.kalin(x - ux * 5, y - uy * 5, x, y, 0);
        t.vurgu(x - ux * 6, y - uy * 6, ATES);
        t.vurgu(x - ux * 7, y - uy * 7, AKKOR);
      } else if (m.tip === M_DKURSUN) {
        t.kutu(x - 1, y - 1, 3, 3, 0);
        t.vurgu(x, y, KAN);
      } else if (m.tip === M_TOP) {
        t.kalin(x - ux * 4, y - uy * 4, x, y, 0);
      } else if (m.tip === M_HAVAN || m.tip === M_BOMBA || m.tip === M_OBOMBA) {
        t.kalin(x - ux * 3, y - uy * 3, x + ux * 3, y + uy * 3, 0);
        t.cizgi(x - ux * 5 - uy * 2, y - uy * 5 + ux * 2, x - ux * 5 + uy * 2, y - uy * 5 - ux * 2, 0);
      }
    }
    // Uçaksavar uyarısı: daralan kesik halka
    for (const f of d.flaklar) {
      const x = f.x - kam;
      const y = f.y + this.sy;
      const r = 19 + (1 - f.t / 0.95) * 16;
      t.halka(x, y, r, 0, 2);
      t.cizgi(x - 3, y, x + 3, y, 0, KAN);
      t.cizgi(x, y - 3, x, y + 3, 0, KAN);
    }
  }

  // ---- Oyuncu helikopteri ----

  private heli(): void {
    const { t, d } = this;
    const h = d.heli;
    if (h.patladi) return;
    const x = h.x - this.kamX;
    const y = h.y + this.sy;
    const vurulmus = h.darbe > 0 && Math.floor(d.zaman * 30) % 2 === 0;
    t.cizDon(SPR_HELI, x, y, h.egim, h.yon < 0, 23, 8, vurulmus ? 255 : 0);
    this.pervane(x, y, h.egim, h.yon, 27, 20, 8, 23);
    // Kuyruk pervanesi
    const c = Math.cos(h.egim);
    const s = Math.sin(h.egim);
    const kx = x + c * -22 * h.yon - s * -3;
    const ky = y + s * -22 * h.yon + c * -3;
    const ka = d.zaman * 40;
    t.cizgi(kx - Math.cos(ka) * 4, ky - Math.sin(ka) * 4, kx + Math.cos(ka) * 4, ky + Math.sin(ka) * 4, 0);
    // Namlu alevi
    if (h.top > 0.045 && d.oyunda && !h.olu) {
      const mx = x + h.yon * 14 + Math.cos(h.namlu) * 3;
      const my = y + 6 + Math.sin(h.namlu) * 3;
      t.daire(mx, my, 2, 0, ATES);
      t.vurgu(mx, my, AKKOR);
    }
  }

  // ---- Patlamalar ve parçalar ----

  private efektler(): void {
    const { t, d } = this;
    const kam = this.kamX;
    const P = d.parcalar;
    // Önce duman ve toz (arkada), sonra ateş ve katı parçalar
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.tip !== P_DUMAN && p.tip !== P_TOZ) continue;
      const x = p.x - kam;
      if (x < -30 || x > G + 30) continue;
      const k = p.omur / p.omur0;
      if (p.tip === P_DUMAN) t.leke(x, p.y + this.sy, p.boy, Math.min(0.9, k * 1.3), 26);
      else t.leke(x, p.y + this.sy, p.boy, Math.min(0.6, k * 0.8), 214);
    }
    for (const e of d.patlamalar) {
      const x = e.x - kam;
      const y = e.y + this.sy;
      const k = e.t / 0.55;
      if (e.t < 0.05) t.daire(x, y, e.r * 0.8, 0, AKKOR);
      else if (e.t < 0.28) {
        // Ateş topu: üst üste binen topaklar (düz bir daire gibi durmasın)
        const u = e.t / 0.28;
        const tohum = e.x * 0.37 + e.y;
        for (let n = 0; n < 7; n++) {
          const a = n * 0.9 + tohum;
          const uz = e.r * (0.15 + 0.45 * u) * (0.5 + kes(n, tohum));
          t.daire(x + Math.cos(a) * uz, y + Math.sin(a) * uz * 0.8 - u * e.r * 0.25, e.r * (0.3 + 0.22 * kes(tohum, n)) * (1 - u * 0.45), 0, ATES);
        }
        for (let n = 0; n < 4; n++) {
          const a = n * 1.6 + tohum;
          const uz = e.r * 0.3 * u;
          t.daire(x + Math.cos(a) * uz, y + Math.sin(a) * uz - u * e.r * 0.25, e.r * 0.26 * (1 - u), 0, AKKOR);
        }
      }
      if (e.t < 0.36) t.halka(x, y, e.r * (0.9 + k * 3), 0, 2);
    }
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const tip = p.tip;
      if (tip === P_DUMAN || tip === P_TOZ) continue;
      const x = p.x - kam;
      if (x < -20 || x > G + 20) continue;
      const y = p.y + this.sy;
      if (tip === P_KAN) {
        t.vurgu(x, y, KAN);
        t.vurgu(x - p.vx * 0.012, y - p.vy * 0.012, KAN);
      } else if (tip === P_ATES) {
        const k = p.omur / p.omur0;
        t.daire(x, y, p.boy * k, 0, ATES);
        if (k > 0.6) t.daire(x, y, p.boy * k * 0.45, 0, AKKOR);
      } else if (tip === P_KIVILCIM) {
        t.vurgu(x, y, p.omur > p.omur0 * 0.5 ? AKKOR : ATES);
      } else if (tip === P_TOPRAK) {
        t.nokta(x, y, 0);
        if (p.boy > 0.9) t.nokta(x + 1, y, 0);
      } else if (tip === P_ENKAZ) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        const c = Math.cos(p.aci) * p.boy;
        const s = Math.sin(p.aci) * p.boy;
        t.kalin(x - c, y - 1 - s, x + c, y - 1 + s, 0);
      } else if (tip === P_KOVAN) {
        t.nokta(x, y, 60);
      } else if (tip === P_KULE) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        t.cizDon(SPR_KULE, x, y - 3, p.aci, false);
      }
    }
  }

  private yazilar(): void {
    const { t, d } = this;
    for (const s of d.sozler) {
      if (s.t > 1 && Math.floor(s.t * 18) % 2 === 0) continue;
      const yari = yaziGenislik(s.metin) / 2 + 3;
      const x = sinirla(s.x - this.kamX, yari, G - yari);
      t.yazi(s.metin, x, s.y + this.sy, { hiza: 0, kenar: 255, vurgu: s.vurgu ? KAN : 0 });
    }
  }

  // ---- Arayüz ----

  private cubuk(x: number, y: number, oran: number): void {
    const t = this.t;
    t.kutu(x, y, 58, 8, 0);
    t.kutu(x + 1, y + 1, 56, 6, 255);
    const w = Math.round(54 * sinirla(oran, 0, 1));
    if (w > 0) t.kutu(x + 2, y + 2, w, 4, 0, oran < 0.3 ? KAN : 0);
  }

  private sesSimge(a: Arayuz): void {
    const t = this.t;
    const x = G - 22;
    const y = 30;
    t.kutu(x, y + 3, 4, 5, 0);
    for (let k = 0; k < 5; k++) t.kutu(x + 4 + k, y + 3 - k, 1, 5 + k * 2, 0);
    if (a.sesAcik) {
      t.cizgi(x + 12, y + 2, x + 12, y + 8, 0);
      t.cizgi(x + 15, y, x + 15, y + 10, 0);
    } else {
      t.cizgi(x + 11, y + 2, x + 17, y + 8, 0);
      t.cizgi(x + 17, y + 2, x + 11, y + 8, 0);
    }
  }

  private hud(a: Arayuz): void {
    const { t, d } = this;
    t.ciz(SPR_SIMGE_HELI, 8, 10);
    this.cubuk(25, 10, d.heli.can / 100);
    t.ciz(SPR_SIMGE_SIPER, 8, 23);
    this.cubuk(25, 23, d.siperCan / 100);
    t.yazi(String(d.skor), G - 8, 9, { hiza: 1, olcek: 3, kenar: 255 });
    if (d.seri > 1) {
      const kat = (1 + Math.min(d.seri - 1, 20) * 0.1).toFixed(1);
      t.yazi(`x${kat}`, G - 30, 32, { hiza: 1, kenar: 255, vurgu: KAN });
    }
    if (d.dalga > 0) t.yazi(`DALGA ${d.dalga}`, G / 2 + 6, 10, { hiza: 0, kenar: 255 });
    this.sesSimge(a);

    if (a.duyuru && a.duyuruT < 2.4 && (a.duyuruT > 0.4 || Math.floor(a.duyuruT * 14) % 2 === 0)) {
      t.yazi(a.duyuru, G / 2, Math.round(d.yuk * 0.26), { hiza: 0, olcek: 4, kenar: 255 });
    }
    // Uçak uyarısı: geleceği yükseklikte, sağ kenarda
    if (d.jetUyari > 0 && Math.floor(d.zaman * 8) % 2 === 0) {
      t.yazi('< UÇAK', G - 8, d.jetUyariY - 5, { hiza: 1, kenar: 255, vurgu: KAN });
    }
    // Ekran dışındaki sandık
    if (a.ipucuT < 6 && a.durum === 'oyun') {
      const y = d.yuk - 40;
      t.yazi('SÜRÜKLE: UÇ', 8, y, { ton: 240, kenar: 0 });
      t.yazi('DOKUN: BOMBA', 8, y + 16, { ton: 240, kenar: 0 });
    }
    this.bombaHud();
    this.gucHud();
  }

  /** Sağ alttaki bomba düğmesi ve üstündeki bomba sayısı. */
  private bombaHud(): void {
    const { t, d } = this;
    const b = bombaDugme(d.yuk);
    const var_ = d.bomba.adet > 0;
    t.daire(b.x, b.y, b.r, 0);
    t.daire(b.x, b.y, b.r - 2, var_ ? 255 : 128);
    // Bomba simgesi
    t.daire(b.x - 1, b.y + 2, 7, 0);
    t.kutu(b.x + 3, b.y - 7, 3, 4, 0);
    t.cizgi(b.x + 5, b.y - 8, b.x + 8, b.y - 11, 0);
    if (var_) {
      t.vurgu(b.x + 9, b.y - 12, ATES);
      t.vurgu(b.x + 10, b.y - 12, AKKOR);
      t.vurgu(b.x + 9, b.y - 13, ATES);
    }
    t.nokta(b.x - 4, b.y - 1, 255);
    t.nokta(b.x - 3, b.y - 2, 255);
    // Bomba sayısı: düğmenin üstünde küçük kutular; son kutu dolarken yükselir
    const n = d.bomba.enCok;
    const x0 = b.x - Math.round((n * 6 - 2) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 6;
      const y = b.y - b.r - 11;
      t.kutu(x - 1, y - 1, 6, 8, 0);
      t.kutu(x, y, 4, 6, i < d.bomba.adet ? 0 : 255, i < d.bomba.adet && d.guc.bomba > 0 ? KAN : 0);
      if (i === d.bomba.adet) {
        const dolu = Math.round(d.bomba.dolum * 6);
        if (dolu > 0) t.kutu(x, y + 6 - dolu, 4, dolu, 128);
      }
    }
  }

  /** Süreli güçlendirmeler: can çubuklarının altında ad + kalan süre. */
  private gucHud(): void {
    const { t, d } = this;
    const liste: [string, number, number][] = [];
    if (d.guc.cift > 0) liste.push(['ÇİFT TOP', d.guc.cift, 22]);
    if (d.guc.hiz > 0) liste.push(['HIZ', d.guc.hiz, 22]);
    if (d.guc.bomba > 0) liste.push(['BOMBA', d.guc.bomba, 24]);
    let y = 38;
    for (const [ad, kalan, sure] of liste) {
      if (kalan < 4 && Math.floor(d.zaman * 6) % 2 === 0) {
        y += 17;
        continue;
      }
      t.yazi(ad, 8, y, { kenar: 255 });
      const w = Math.round((kalan / sure) * 50);
      t.kutu(8, y + 12, w, 2, 0, KAN);
      y += 17;
    }
  }

  private logo(y: number): void {
    const t = this.t;
    const olcek = 5;
    const adim = 6 * olcek;
    const toplam = LOGO.length * adim - olcek;
    const x0 = Math.round(G / 2 - toplam / 2);
    LOGO.forEach((harf, n) => {
      harf.forEach((satir, gy) => {
        for (let gx = 0; gx < satir.length; gx++) {
          if (satir[gx] !== '#') continue;
          t.kutu(x0 + n * adim + gx * olcek + 2, y + gy * olcek + 2, olcek, olcek, 170);
        }
      });
    });
    LOGO.forEach((harf, n) => {
      harf.forEach((satir, gy) => {
        for (let gx = 0; gx < satir.length; gx++) {
          if (satir[gx] !== '#') continue;
          t.kutu(x0 + n * adim + gx * olcek, y + gy * olcek, olcek, olcek, 0);
        }
      });
    });
    // Kurşun delikleri ve sızan kan
    for (let k = 0; k < 9; k++) {
      const px = x0 + 6 + Math.round(kes(k, 21) * (toplam - 12));
      const py = y + 3 + Math.round(kes(k, 22) * 29);
      t.daire(px, py, 1.4, 250);
    }
    const kx = x0 + adim * 2 + 3;
    for (let k = 0; k < 14 + Math.round(Math.sin(this.d.zaman * 1.5) * 3); k++) t.vurgu(kx, y + 35 + k, KAN);
    t.vurgu(kx + 1, y + 35, KAN);
    t.vurgu(kx - 1, y + 35, KAN);
    for (let k = 0; k < 7; k++) t.vurgu(kx + 12, y + 35 + k, KAN);
  }

  private baslik(a: Arayuz): void {
    const { t, d } = this;
    const y = Math.round(d.yuk * 0.22);
    this.logo(y);
    t.yazi('SİPERİ KORU', G / 2, y + 56, { hiza: 0, kenar: 255 });
    if (Math.floor(d.zaman * 1.6) % 2 === 0) t.yazi('DOKUN VE BAŞLA', G / 2, Math.round(d.yuk * 0.48), { hiza: 0, olcek: 3, kenar: 255 });
    const y2 = d.yuk - 56;
    t.yazi('SÜRÜKLE: HELİKOPTER UÇAR', G / 2, y2 - 16, { hiza: 0, ton: 240, kenar: 0 });
    t.yazi('DOKUN: BOMBA BIRAK', G / 2, y2, { hiza: 0, ton: 240, kenar: 0 });
    t.yazi('TOPRAĞI KAZ, SANDIK BUL', G / 2, y2 + 16, { hiza: 0, ton: 240, kenar: 0 });
    if (a.rekor > 0) t.yazi(`REKOR ${a.rekor}`, G / 2, y2 + 36, { hiza: 0, ton: 250, kenar: 0 });
    this.sesSimge(a);
  }

  private sonuc(a: Arayuz): void {
    const { t, d } = this;
    const w = 216;
    const h = 232;
    const x = Math.round(G / 2 - w / 2);
    const y = Math.round(d.yuk * 0.5 - h / 2);
    t.kutu(x + 5, y + 5, w, h, 60);
    t.kutu(x, y, w, h, 0);
    t.kutu(x + 2, y + 2, w - 4, h - 4, 255);
    t.cerceve(x + 5, y + 5, w - 10, h - 10, 0);
    let cy = y + 20;
    t.yazi(d.bitisNeden === 'siper' ? 'SİPER DÜŞTÜ' : 'DÜŞTÜN', G / 2, cy, { hiza: 0, olcek: 3 });
    cy += 34;
    const satirlar: [string, string][] = [
      ['DALGA', String(d.dalga)],
      ['PİYADE', String(d.olu.piyade)],
      ['ARAÇ', String(d.olu.arac)],
      ['HAVA', String(d.olu.hava)],
    ];
    const gorunen = Math.floor(a.sonucT * 7);
    satirlar.forEach(([ad, deger], i) => {
      if (i > gorunen) return;
      t.yazi(ad, x + 30, cy, {});
      t.yazi(deger, x + w - 30, cy, { hiza: 1 });
      cy += 19;
    });
    if (gorunen >= satirlar.length) {
      cy = y + h - 96;
      for (let k = x + 24; k < x + w - 24; k += 3) t.nokta(k, cy, 0);
      t.yazi(String(d.skor), G / 2, cy + 12, { hiza: 0, olcek: 5, vurgu: a.yeniRekor ? KAN : 0 });
      t.yazi(a.yeniRekor ? 'YENİ REKOR!' : `REKOR ${a.rekor}`, G / 2, cy + 50, { hiza: 0 });
    }
    if (a.sonucT > 1.6 && Math.floor(d.zaman * 1.6) % 2 === 0) t.yazi('DOKUN: YENİDEN', G / 2, y + h - 24, { hiza: 0 });
    // Kullanılmayan uyarıyı sustur
    void yaziGenislik;
  }
}

/** Zemindeki sabit süsler: [x, tip] (0 tank engeli, 1 kuru ağaç). */
const SUSLER: [number, number][] = [
  [196, 0], [232, 1], [286, 0], [300, 0], [362, 1], [410, 0], [462, 1], [500, 0], [514, 0], [560, 1],
];
