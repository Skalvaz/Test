/**
 * Sahne çizimi. Simülasyon dünya biriminde (genişlik G = 240) çalışır; çizim
 * K = 1,5 katı çözünürlüktedir (ekran 360 piksel). Dünya → ekran: X(), Y().
 * Arka plan katmanları ve toprak dokusu açılışta bir kez üretilir.
 */
import {
  BAGLAR, B_MOLOZ, B_PENCERE, DUNYA_G, Dunya, G, G_MAYIN, HUCRE, KOS, P_TUGLA, T_KOPRUCU, M_BOMBA, M_DKURSUN, M_DRPG, M_HAVAN, M_KURSUN, M_OBOMBA, M_ROKET, M_TOP,
  M_NISANCI, O_CIFT, O_HIZ, O_TAMIR, PANIK, T_MAKINELI, T_NISANCI, T_SUBAY, P_ATES, P_DUMAN, P_ENKAZ, P_KAN, P_KASK, P_KIVILCIM, P_KOVAN, P_KULE, P_TOPRAK,
  P_TOZ, SIPER_ON, SIPER_X, T_HELI, T_JET, T_KAMYON, T_ROKET, T_TANK, T_TUFEK, T_UCAKSAVAR, YANIYOR,
  type Asker,
} from './dunya';
import {
  DHELI_N, HELI_N, JET_N, KAMYON_N, KULE_N, NAKLIYE_N, SPR_AGAC, SPR_ARABA, SPR_BARIYER, SPR_DUVAR, SPR_LAMBA,
  SPR_LEVHA, SPR_VARIL, SPR_DHELI, SPR_GOMU, SPR_HELI, SPR_JET, SPR_KAMYON,
  SPR_KASK, SPR_KIRPI, SPR_KULE, SPR_MAYIN, SPR_NAKLIYE, SPR_SANDIK, SPR_SIMGE_HELI, SPR_SIMGE_SIPER, SPR_TANK,
  SPR_UCAKSAVAR, SPR_UKULE, TANK_N, UCAKSAVAR_N, UKULE_N,
} from './sprite';
import { AKKOR, ATES, KAN, KURU_KAN, Tuval, yaziGenislik, type YaziSecenek } from './tuval';
import { binaDerisi, ortaKatman, uzakKatman } from './dekor';

/** Çizim ölçeği: 1 dünya birimi = K ekran pikseli. */
export const K = 1.5;
/** Ekran genişliği (piksel). */
export const EK = Math.round(G * K);

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

/** Bomba düğmesinin ekrandaki yeri (çizim ve dokunma aynı yeri kullanır). `ey`: ekran yüksekliği. */
export function bombaDugme(ey: number): { x: number; y: number; r: number } {
  return { x: EK - 44, y: ey - 54, r: 30 };
}
/** Ses düğmesi. */
export function sesDugme(): { x: number; y: number; w: number; h: number } {
  return { x: EK - 36, y: 40, w: 28, h: 22 };
}

const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const kes = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const DP = Math.round(DUNYA_G * K); // dünya genişliği (piksel)
const UZAK_K = 0.12;
const ORTA_K = 0.38;
const UW = Math.ceil(EK + (DP - EK) * UZAK_K) + 8;
const UH = 250;
const OW = Math.ceil(EK + (DP - EK) * ORTA_K) + 8;
const OH = 430;

/** Bez bebekte her noktaya değen bağlar (bit maskesi). */
const NOKTA_BAG = [1, 15, 50, 4, 8, 16, 32];

const LOGO = [
  ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
];

/** Savaş alanındaki sabit süsler: [dünya x, tip]. 0 tank engeli, 1 kuru ağaç, 2 araba, 3 lamba, 4 bariyer, 5 levha, 6 varil, 7 duvar. */
const SUSLER: [number, number][] = [
  [178, 4], [204, 3], [220, 1], [290, 0], [312, 2], [400, 6], [416, 1], [436, 3], [522, 7], [548, 0], [572, 2], [590, 1],
];

export class Sahne {
  private uzak = uzakKatman(UW, UH);
  private orta = ortaKatman(OW, OH);
  private toprak: Uint8Array;
  private toprakW = DP + 2;
  private toprakH: number;
  private toprakY0: number;
  private bulutlar: { x: number; y: number; b: number }[] = [];
  private sx = 0;
  private sy = 0;
  private kam = 0;

  constructor(
    private t: Tuval,
    private d: Dunya,
  ) {
    for (let i = 0; i < 6; i++) this.bulutlar.push({ x: Math.random() * (EK + 180), y: 80 + Math.random() * d.zemin * K * 0.34, b: 0.9 + Math.random() * 1.1 });
    this.toprakY0 = Math.round((d.zemin - 14) * K);
    this.toprakH = t.h - this.toprakY0 + 12;
    this.toprak = this.toprakDokusu();
  }

  /** Toprağın kesiti: dünyaya sabit doku (katmanlar, taşlar, kökler, eski boru, kemikler). */
  private toprakDokusu(): Uint8Array {
    const W = this.toprakW;
    const H = this.toprakH;
    const t = new Tuval(W, H);
    for (let y = 0; y < H; y++) {
      const g = y < 80 ? 85 : y < 140 ? 85 - (y - 80) * 0.72 : y < H - 46 ? 42 : 42 - (y - (H - 46)) * 0.5;
      t.g.fill(Math.round(Math.max(18, g)), y * W, (y + 1) * W);
    }
    // Katman çizgileri: dalgalı, kesik
    for (const [derin, ton, dalga] of [[36, 64, 5], [70, 42, 7], [108, 20, 6], [150, 0, 8], [196, 0, 7], [238, 0, 9]] as const) {
      if (derin > H - 20) continue;
      for (let x = 0; x < W; x++) {
        const y = Math.round(derin + dalga * Math.sin(x * 0.021 + derin) + 3 * Math.sin(x * 0.07 + derin * 2));
        if (kes(Math.floor(x / 7), derin) < 0.8) t.nokta(x, y, ton);
        if (kes(Math.floor(x / 13), derin + 1) < 0.25) t.nokta(x, y + 1, ton);
      }
    }
    // Taşlar: derine indikçe irileşir ve koyulaşır
    const adet = Math.round((W * H) / 520);
    for (let i = 0; i < adet; i++) {
      const x = Math.round(kes(i, 1) * W);
      const y = 24 + Math.round(kes(i, 2) * (H - 30));
      const iri = 1 + (y / H) * 0.9;
      const rx = (1.5 + kes(i, 3) * 4) * iri;
      const ry = (1 + kes(i, 4) * 2.4) * iri;
      const koyu = y > 120;
      for (let yy = -8; yy <= 8; yy++) {
        for (let xx = -11; xx <= 11; xx++) {
          const u = (xx / rx) ** 2 + (yy / ry) ** 2;
          if (u > 1) continue;
          t.nokta(x + xx, y + yy, u > 0.72 && yy > 0 ? (koyu ? 20 : 60) : yy < -ry * 0.3 ? (koyu ? 100 : 150) : koyu ? 64 : 112);
        }
      }
    }
    for (let i = 0; i < adet * 2; i++) t.nokta(kes(i, 5) * W, 18 + kes(i, 6) * (H - 20), kes(i, 7) < 0.5 ? 128 : 60);
    // Ağaç kökleri
    const kok = (x: number, y: number, aci: number, uz: number, d: number): void => {
      const x1 = x + Math.cos(aci) * uz;
      const y1 = y + Math.sin(aci) * uz;
      t.cizgi(x, y, x1, y1, 20);
      if (d <= 0) return;
      kok(x1, y1, aci - 0.5 - kes(x, d) * 0.4, uz * 0.75, d - 1);
      kok(x1, y1, aci + 0.45 + kes(y, d) * 0.4, uz * 0.7, d - 1);
    };
    for (const [sx, tip] of SUSLER) if (tip === 1) kok(sx * K, 22, Math.PI / 2, 14, 4);
    // Eski su borusu: kırık, eklemli
    const by = 86;
    for (let x = 250; x < 470; x++) {
      if (x > 352 && x < 368) continue;
      t.nokta(x, by - 3, 0);
      t.nokta(x, by + 3, 0);
      for (let k = -2; k <= 2; k++) t.nokta(x, by + k, k < 0 ? 150 : 112);
      if (x % 44 === 0) t.kutu(x - 1, by - 4, 4, 9, 0);
    }
    // Eski kanalizasyon tüneli: tuğla kemer, dibinde su; bir yeri çökmüş
    if (H > 230) {
      const ty = 176;
      for (let x = 520; x < 800; x++) {
        if (x > 650 && x < 672) continue;
        for (let k = 0; k < 26; k++) t.nokta(x, ty + k, k > 21 ? 85 : 12);
        t.nokta(x, ty - 1, 0);
        t.nokta(x, ty + 26, 0);
        if ((x + 3) % 6 < 4) t.nokta(x, ty - 3, 100);
        if (x % 6 < 4) t.nokta(x, ty - 5, 100);
        if (x % 9 === 0) t.nokta(x, ty + 22, 170); // sudaki yansıma
      }
      for (let k = 0; k < 40; k++) t.kutu(650 + Math.round(kes(k, 31) * 22), ty + 6 + Math.round(kes(k, 32) * 20), 3 + Math.round(kes(k, 33) * 4), 3, kes(k, 34) < 0.5 ? 64 : 100);
    }
    // Kemikler ve fosiller
    for (const [kx, ky] of [[620, 60], [140, 104], [780, 128], [300, 150], [90, 214], [430, 240]]) {
      if (ky > H - 30) continue;
      t.cizgi(kx, ky, kx + 12, ky + 3, 200);
      t.daire(kx, ky, 1.6, 200);
      t.daire(kx + 12, ky + 3, 1.6, 200);
      for (let k = 0; k < 4; k++) t.cizgi(kx + 2 + k * 3, ky + 6 + (k % 2), kx + 4 + k * 3, ky + 11, 180);
    }
    if (H > 220) {
      // Kafatası ve sarmal kabuk (derinde)
      t.daire(212, 196, 5, 200);
      t.kutu(209, 199, 7, 4, 200);
      t.nokta(210, 195, 20);
      t.nokta(214, 195, 20);
      t.kutu(210, 202, 1, 2, 20);
      t.kutu(213, 202, 1, 2, 20);
      for (let a = 0; a < 14; a += 0.25) t.nokta(700 + Math.cos(a) * a * 0.75, 232 + Math.sin(a) * a * 0.75, 170);
    }
    // Ana kaya: en altta iri bloklar ve çatlaklar
    for (let x = 0; x < W; x += 2) {
      const y = H - 40 + Math.round(6 * Math.sin(x * 0.02) + 3 * Math.sin(x * 0.09));
      t.nokta(x, y, 0);
      t.nokta(x + 1, y, 0);
    }
    for (let i = 0; i < W / 26; i++) {
      let cx = i * 26 + Math.round(kes(i, 41) * 14);
      let cy = H - 36;
      for (let n = 0; n < 16; n++) {
        t.nokta(cx, cy, 0);
        cx += kes(n, i + 42) < 0.5 ? 1 : -1;
        cy += 2;
        t.nokta(cx, cy - 1, 0);
      }
    }
    return t.g;
  }

  guncelle(dt: number): void {
    for (const b of this.bulutlar) {
      b.x += 5 * b.b * dt;
      if (b.x > EK + 100) b.x = -100;
    }
    const s = this.d.sarsinti;
    this.sx = s > 0.02 ? Math.round((Math.random() - 0.5) * 10 * s) : 0;
    this.sy = s > 0.02 ? Math.round((Math.random() - 0.5) * 10 * s) : 0;
  }

  private X(wx: number): number {
    return Math.round(wx * K) - this.kam;
  }

  private Y(wy: number): number {
    return Math.round(wy * K) + this.sy;
  }

  ciz(a: Arayuz): void {
    this.kam = Math.round(this.d.kam.x * K) - this.sx;
    this.gok();
    this.havadakiler();
    this.susler();
    this.zeminCiz();
    this.enkazlar();
    this.binalar();
    this.kopruler();
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
    const ufuk = this.Y(d.zemin);
    t.v.fill(0);
    t.g.fill(255);
    // Ufkun altı: çukurların arkasında görünen koyu toprak
    if (ufuk < t.h) t.g.fill(64, Math.max(0, ufuk + 6) * W);
    // Güneş
    const gx = EK * 0.74 - this.kam * 0.02;
    const gy = Math.round(t.h * 0.13);
    t.daire(gx, gy, 32, 240);
    t.daire(gx, gy, 27, 0, AKKOR);
    // Bulutlar: düz tabanlı, altı gölgeli
    for (const b of this.bulutlar) {
      const x = b.x - this.kam * 0.05;
      const y = b.y;
      t.daire(x - 13 * b.b, y - 2, 11 * b.b, 234);
      t.daire(x + 6 * b.b, y - 7 * b.b, 15 * b.b, 234);
      t.daire(x + 25 * b.b, y - 1, 9 * b.b, 234);
      t.kutu(x - 30 * b.b, y, 64 * b.b, 7, 234);
      t.kutu(x - 26 * b.b, y + 5, 56 * b.b, 2, 213);
    }
    this.katman(this.uzak, UW, UH, this.kam * UZAK_K, ufuk - UH + 10);
    this.katman(this.orta, OW, OH, this.kam * ORTA_K, ufuk - OH + 13);
  }

  /** Sprite içindeki bir noktanın (dönme merkezine göre lx, ly) ekrandaki yeri. */
  private yerel(x: number, y: number, aci: number, yon: number, lx: number, ly: number): [number, number] {
    const c = Math.cos(aci);
    const s = Math.sin(aci);
    const fx = lx * yon;
    return [x + c * fx - s * ly, y + s * fx + c * ly];
  }

  /** Dönen pervane: bulanık disk + kareden kareye uzayıp kısalan pal. */
  private pervane(mx: number, my: number, aci: number, yari: number): void {
    const t = this.t;
    const c = Math.cos(aci);
    const s = Math.sin(aci);
    const k = Math.floor(this.d.zaman * 60) % 4;
    t.cizgi(mx - c * yari, my - s * yari, mx + c * yari, my + s * yari, 170);
    t.cizgi(mx - c * yari * 0.9, my - s * yari * 0.9 - 1, mx + c * yari * 0.9, my + s * yari * 0.9 - 1, 213);
    const uz = [1, 0.35, 0.75, 0.15][k] * yari;
    t.kalin(mx - c * uz, my - s * uz, mx + c * uz, my + s * uz, 0);
    t.kutu(mx - 1, my - 1, 3, 2, 0);
  }

  private havadakiler(): void {
    const { t, d } = this;
    for (const o of d.havalar) {
      const x = this.X(o.x);
      const y = this.Y(o.y);
      if (x < -120 || x > EK + 120) continue;
      if (o.tip === T_HELI) {
        const N = DHELI_N;
        t.cizDon(SPR_DHELI, x, y, o.aci, o.yon < 0, N.ox, N.oy);
        if (!o.dusuyor) {
          const [mx, my] = this.yerel(x, y, o.aci, o.yon, N.direk[0] - N.ox, N.direk[1] - N.oy);
          this.pervane(mx, my, o.aci, 44);
          const [kx, ky] = this.yerel(x, y, o.aci, o.yon, N.kuyruk[0] - N.ox, N.kuyruk[1] - N.oy);
          const ka = d.zaman * 38;
          t.cizgi(kx - Math.cos(ka) * 6, ky - Math.sin(ka) * 6, kx + Math.cos(ka) * 6, ky + Math.sin(ka) * 6, 0);
          t.cizgi(kx + Math.sin(ka) * 6, ky - Math.cos(ka) * 6, kx - Math.sin(ka) * 6, ky + Math.cos(ka) * 6, 128);
        }
      } else if (o.tip === T_JET) {
        t.cizDon(SPR_JET, x, y, o.dusuyor ? o.aci * 0.5 : 0, true, JET_N.ox, JET_N.oy);
        if (!o.dusuyor) {
          // Art yakıcı: lülenin arkasında titreyen alev
          const uz = 9 + (Math.floor(d.zaman * 30) % 3) * 4;
          for (let k = 0; k < uz; k++) {
            const gen = Math.max(0, 2 - Math.floor(k / 4));
            for (let m = -gen; m <= gen; m++) t.vurgu(x + JET_N.ox - JET_N.lule[0] + k, y + m, k < 4 ? AKKOR : ATES);
          }
        }
      } else {
        const N = NAKLIYE_N;
        t.ciz(SPR_NAKLIYE, x - N.ox, y - N.oy);
        const p = Math.floor(d.zaman * 30) % 2 === 0 ? 9 : 4;
        for (const [px, py] of N.pervane) {
          t.cizgi(x - N.ox + px + 1, y - N.oy + py - 9, x - N.ox + px + 1, y - N.oy + py + 9, 200);
          t.cizgi(x - N.ox + px, y - N.oy + py - p, x - N.ox + px, y - N.oy + py + p, 60);
        }
      }
    }
  }

  // ---- Zemin ----

  private zeminCiz(): void {
    const { t, d } = this;
    const W = t.w;
    const H = t.h;
    const TW = this.toprakW;
    const TH = this.toprakH;
    const ty0 = this.toprakY0 + this.sy;
    for (let x = 0; x < W; x++) {
      const px = x + this.kam;
      const wxf = sinirla(px / K, 0, DUNYA_G - 0.001);
      const i0 = Math.floor(wxf);
      const f = wxf - i0;
      const ys = Math.round((d.yer[i0] * (1 - f) + d.yer[i0 + 1] * f) * K) + this.sy;
      const wi = Math.round(wxf);
      const is = d.is[wi];
      const kan = d.kanIz[wi];
      const les = d.les[wi];
      const lesK = les > 30 ? 4 + Math.round(les / 26) : 0;
      const yanik = is > 40 ? 3 + Math.round(is / 60) : 0;
      const tpx = sinirla(px, 0, TW - 1);
      for (let y = Math.max(0, ys); y < H; y++) {
        const dd = y - ys;
        const i = y * W + x;
        t.v[i] = 0;
        if (dd < 2) t.g[i] = 0;
        else if (dd < 2 + lesK) {
          // Leş yığını: ezilmiş hurda ve kemik
          const h = kes(px, dd);
          if (h < 0.07) t.g[i] = 240;
          else if (h < 0.2) t.g[i] = 112;
          else if (h < 0.25) {
            t.g[i] = 0;
            t.v[i] = KURU_KAN;
          } else t.g[i] = 0;
        } else if (dd < 2 + lesK + yanik) t.g[i] = kes(px, dd) < 0.7 ? 0 : 42;
        else if (dd < 6 && lesK === 0 && yanik === 0 && wi > SIPER_ON) t.g[i] = dd === 5 ? (kes(px, 1) < 0.55 ? 150 : 64) : 42; // asfalt ve altındaki çakıl
        else {
          const ty = y - ty0;
          t.g[i] = ty >= 0 && ty < TH ? this.toprak[ty * TW + tpx] : 85;
        }
      }
      // Kan: yüzeyde kırmızı, yoğunsa aşağı sızar
      if (kan > 30 && ys >= 0 && ys < H - 8) {
        const derin = 2 + (kan > 110 ? 1 : 0) + (kan > 190 ? 1 : 0) + (kan > 150 && kes(px, 3) < 0.25 ? 3 : 0);
        // Taze kan parlak, eskidikçe koyulaşır
        for (let k = 0; k < derin; k++) t.v[(ys + k) * W + x] = kan > 100 && k < 3 ? KAN : KURU_KAN;
      }
      // Ot, çakıl
      if (is < 40 && les < 30 && wi > SIPER_ON && ys > 6) {
        const h = kes(px, 7);
        if (h < 0.2) {
          const boy = 1 + Math.floor(kes(px, 8) * 5);
          const egik = kes(px, 9) < 0.5 ? 1 : -1;
          for (let k = 1; k <= boy; k++) t.nokta(x + (k > 2 ? egik : 0), ys - k, 64);
          if (boy === 5 && kes(px, 10) < 0.3) t.nokta(x + egik, ys - 6, 250); // küçük çiçek
        } else if (h > 0.985) {
          t.kutu(x, ys - 2, 3, 2, 128);
          t.kutu(x, ys - 3, 2, 1, 0);
        }
      }
    }
    // Toprağın altındakiler: mayın ve sandık
    for (const g of d.gomuler) {
      const x = this.X(g.x);
      if (x < -16 || x > EK + 16) continue;
      const y = this.Y(g.y);
      if (g.tip === G_MAYIN) {
        if (g.fitil >= 0 && Math.floor(d.zaman * 20) % 2 === 0) t.daire(x, y, 12, 0, KAN);
        t.ciz(SPR_MAYIN, x - 7, y - 7);
        if (Math.floor(d.zaman * 2 + g.x) % 2 === 0) t.vurgu(x, y, ATES);
      } else t.ciz(SPR_GOMU, x - 8, y - 7);
    }
  }

  /**
   * Sabit süsler. Zeminden ÖNCE çizilir: toprak sütunları üstlerine boyandığı
   * için gömülen kısım kendiliğinden kırpılır. Geniş olanlar (araba, bariyer,
   * tank engeli) iki temas noktasına göre yatar; dik duranlar ayak izinin en
   * alçak noktasına oturur. Hiçbiri yamaçta havada kalmaz (kullanıcı ekran
   * görüntüsüyle yakaladı: arabanın yarısı boşluktaydı).
   */
  private susler(): void {
    const { t, d } = this;
    const yat = (ox: number, yari: number): [number, number] => {
      const y0 = d.yerY(ox - yari);
      const y1 = d.yerY(ox + yari);
      return [this.Y(Math.max((y0 + y1) / 2, d.yerY(ox) - 1)) + 2, sinirla(Math.atan2(y1 - y0, yari * 2), -0.7, 0.7)];
    };
    const dip = (ox: number, yari: number): number => {
      let y = -1e9;
      for (let k = -yari; k <= yari; k++) y = Math.max(y, d.yerY(ox + k));
      return this.Y(y) + 1;
    };
    for (const [ox, tip] of SUSLER) {
      const x = this.X(ox);
      if (x < -50 || x > EK + 50) continue;
      if (tip === 0) {
        const [y, e] = yat(ox, 5);
        t.cizDon(SPR_KIRPI, x, y, e, false, SPR_KIRPI.w / 2, SPR_KIRPI.h - 1);
      } else if (tip === 1) t.ciz(SPR_AGAC, x - 17, dip(ox, 2) - 36);
      else if (tip === 2) {
        // Düz zeminde döndürmeden basılır (döndürme ince çizgileri bozar)
        const [y, e] = yat(ox, 13);
        if (Math.abs(e) < 0.07) t.ciz(SPR_ARABA, x - 27, y - SPR_ARABA.h);
        else t.cizDon(SPR_ARABA, x, y, e, false, SPR_ARABA.w / 2, SPR_ARABA.h - 1);
      } else if (tip === 3) t.ciz(SPR_LAMBA, x - 8, dip(ox, 2) - 60, ox % 2 === 0);
      else if (tip === 4) {
        const [y, e] = yat(ox, 7);
        t.cizDon(SPR_BARIYER, x, y, e, false, SPR_BARIYER.w / 2, SPR_BARIYER.h - 2);
      } else if (tip === 5) t.ciz(SPR_LEVHA, x - 9, dip(ox, 1) - 32);
      else if (tip === 6) t.ciz(SPR_VARIL, x - 5, dip(ox, 3) - 13);
      else t.ciz(SPR_DUVAR, x - 20, dip(ox, 13) - 48);
    }
  }

  private enkazlar(): void {
    const { t, d } = this;
    for (const e of d.enkazlar) {
      const x = this.X(e.x);
      if (x < -60 || x > EK + 60) continue;
      const y = this.Y(e.y);
      // Zemine karışmadan önce yavaşça gömülür
      const bat = e.t > 11 ? Math.round((e.t - 11) * 3) : 0;
      if (e.tip === T_TANK || e.tip === T_KOPRUCU) t.cizDon(SPR_TANK, x, y - 9 + bat, e.aci, true, TANK_N.ox, TANK_N.oy, 255);
      else if (e.tip === T_UCAKSAVAR) t.cizDon(SPR_UCAKSAVAR, x, y - 8 + bat, e.aci, true, UCAKSAVAR_N.ox, UCAKSAVAR_N.oy, 255);
      else if (e.tip === T_KAMYON) t.cizDon(SPR_KAMYON, x, y - 11 + bat, e.aci + 0.2, true, KAMYON_N.ox, KAMYON_N.oy, 255);
      else if (e.tip === T_HELI) t.cizDon(SPR_DHELI, x, y - 9 + bat, e.aci + 0.4, true, DHELI_N.ox, DHELI_N.oy, 255);
      else if (e.tip === T_JET) t.cizDon(SPR_JET, x, y - 6 + bat, e.aci + 0.5, true, JET_N.ox, JET_N.oy, 255);
      else t.cizDon(SPR_HELI, x, y - 10 + bat, e.aci + 0.5, false, HELI_N.ox, HELI_N.oy, 255);
    }
  }

  // ---- Yıkılabilir binalar ve köprüler ----

  /**
   * Binalar derisinden çizilir (`dekor.ts`): ayakta duran her hücre derinin
   * kendi 6×6 parçasını basar, yerinden oynayan hücre moloza döner. Kırılan
   * kenar girintili çıkıntılıdır ve açıkta kalan tuğla görünür.
   */
  private binalar(): void {
    const { t, d } = this;
    const B = Math.round(HUCRE * K); // hücre pikseli
    const W = t.w;
    const H = t.h;
    const koy = (x: number, y: number, v: number): void => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      t.g[i] = v;
      t.v[i] = 0;
    };
    for (const b of d.binalar) {
      const x0 = this.X(b.x);
      const N = b.sutun;
      if (x0 > EK + 10 || x0 + N * B < -10) continue;
      const deri = binaDerisi(b.tur);
      const tohum = b.x * 0.37;
      const ayakta = (c: number, r: number): boolean => c >= 0 && c < N && r >= 0 && r < b.satir && b.h[r * N + c] !== 0 && b.dy[r * N + c] === 0;
      let pencere = 0;
      for (let c = 0; c < N; c++) {
        const taban = this.Y(d.yerY(b.x + (c + 0.5) * HUCRE));
        const x = x0 + c * B;
        for (let r = 0; r < b.satir; r++) {
          const i = r * N + c;
          const tur = b.h[i];
          if (!tur) continue;
          const y = taban - (r + 1) * B - Math.round(b.dy[i] * K);
          const sol = c > 0 && !ayakta(c - 1, r);
          const sag = c < N - 1 && !ayakta(c + 1, r);
          const ust = !ayakta(c, r + 1);
          if (tur === B_MOLOZ) {
            // Moloz: kırık tuğla, sıva parçası, aralarında boşluk; üstü dişli
            for (let py = 0; py < B; py++) {
              for (let px = 0; px < B; px++) {
                const gx = c * B + px;
                const gy = r * B + py;
                if (ust && py < 2 && kes(gx + tohum, c * 3 + r) < (py === 0 ? 0.55 : 0.2)) continue;
                // Devrilmiş tuğla ve sıva parçaları: sıra sıra kaymış bloklar, aralarında gölge
                const sira = Math.floor(gy / 3);
                const kay = Math.floor(kes(sira + tohum, c) * 5);
                const blok = Math.floor((gx + kay) / 5);
                const h = kes(blok + tohum, sira * 3 + 1);
                let v = h < 0.14 ? 85 : h < 0.42 ? 128 : h < 0.8 ? 170 : 213;
                if (gy % 3 === 2 || (gx + kay) % 5 === 0) v = h < 0.14 ? 42 : 85;
                if (kes(gx * 5 + tohum, gy * 7) < 0.02) v = 0;
                const tepe = ust && (py === 0 || (py < 3 && kes(gx + tohum, c * 3 + r) < (py === 1 ? 0.55 : 0.2)));
                if (tepe || (sol && px === 0) || (sag && px === B - 1)) v = 0;
                koy(x + px, y + py, v);
              }
            }
            continue;
          }
          const sx0 = c * B;
          const sy0 = (b.satir - 1 - r) * B;
          const ustKirik = ust && r < b.satir - 1 && deri.g[(sy0 - 1) * deri.w + sx0 + 2] !== 0;
          for (let py = 0; py < B; py++) {
            for (let px = 0; px < B; px++) {
              let v = deri.g[(sy0 + py) * deri.w + sx0 + px];
              if (!v) continue;
              // Kırık kenarlar: girinti, mürekkep, açıkta tuğla
              let ic = 99;
              if (sol) ic = Math.min(ic, px - (kes(py + r * B + tohum, c) < 0.4 ? 1 : 0));
              if (sag) ic = Math.min(ic, B - 1 - px - (kes(py + r * B + tohum, c + 9) < 0.4 ? 1 : 0));
              if (ustKirik) ic = Math.min(ic, py - (kes(px + c * B + tohum, r + 5) < 0.4 ? 1 : 0));
              if (ic < 0) continue;
              if (ic === 0) v = 1;
              else if (ic === 1) v = (py + r * B) % 3 === 2 ? 112 : 170;
              koy(x + px, y + py, v === 1 ? 0 : v);
            }
          }
          if (tur === B_PENCERE) {
            // İçerideki asker: pencerede miğfer ve dışarı uzanan namlu
            if (pencere++ < b.asker) {
              t.kutu(x + 3, y + 2, 3, 1, 0);
              t.kutu(x + 2, y + 3, 5, 1, 0);
              t.kutu(x + 3, y + 4, 3, 1, 0);
              t.kutu(x - 1, y + 5, 5, 1, 0);
            }
            if (b.atisT > 0 && b.atisHucre === i) {
              t.daire(x - 2, y + 5, 3, 0, ATES);
              t.vurgu(x - 2, y + 5, AKKOR);
            }
          }
        }
      }
    }
  }

  private kopruler(): void {
    const { t, d } = this;
    for (const k of d.kopruler) {
      const xb = this.X(k.x1);
      const yb = this.Y(k.y1);
      // Açılırken sağ yakadan sola uzar; ucu yukarıdan iner
      const u = k.t;
      const xa = xb + (this.X(k.x0) - xb) * u;
      const ya = yb + (this.Y(k.y0) - yb) * u - (1 - u) * 34;
      if (xb < -10 || xa > EK + 10) continue;
      const n = Math.max(1, Math.round((xb - xa) / 9));
      for (let i = 0; i < n; i++) {
        const u0 = i / n;
        const u1 = (i + 1) / n;
        const x0 = xa + (xb - xa) * u0;
        const y0 = ya + (yb - ya) * u0;
        const x1 = xa + (xb - xa) * u1;
        const y1 = ya + (yb - ya) * u1;
        // Alt kafes: çapraz ve dikme
        t.cizgi(x0, y0 + 3, x1, y1 + 9, 85);
        t.cizgi(x0, y0 + 9, x1, y1 + 3, 85);
        t.cizgi(x0, y0 + 3, x0, y0 + 9, 0);
        t.cizgi(x0, y0 + 9, x1, y1 + 9, 0);
        // Tabliye
        t.cizgi(x0, y0, x1, y1, 0);
        t.cizgi(x0, y0 + 1, x1, y1 + 1, 150);
        t.cizgi(x0, y0 + 2, x1, y1 + 2, 0);
        // Korkuluk
        t.cizgi(x0, y0 - 4, x0, y0, 0);
      }
      t.cizgi(xa, ya - 4, xb, yb - 4, 85);
      t.cizgi(xb, yb - 4, xb, yb + 9, 0);
      t.daire((xa + xb) / 2, (ya + yb) / 2 + 6, 2.5, 0); // orta mafsal
      if (k.can < 4 && u >= 1) {
        // Hasarlı: sarkan parçalar
        t.cizgi((xa + xb) / 2 + 6, (ya + yb) / 2 + 9, (xa + xb) / 2 + 9, (ya + yb) / 2 + 17, 0);
        t.cizgi(xa + 12, ya + 9, xa + 10, ya + 15, 0);
      }
    }
  }

  // ---- Siper ----

  private kumTorbasi(x: number, y: number): void {
    const t = this.t;
    t.kutu(x + 1, y, 12, 7, 0);
    t.kutu(x, y + 1, 14, 5, 0);
    t.kutu(x + 1, y + 1, 12, 5, 200);
    t.kutu(x + 2, y + 1, 8, 1, 240);
    t.kutu(x + 2, y + 5, 10, 1, 150);
    t.nokta(x + 11, y + 3, 128);
    t.nokta(x + 4, y + 3, 170);
  }

  private varil(x: number, y: number, yatik = false): void {
    const t = this.t;
    if (yatik) {
      t.kutu(x, y - 9, 14, 9, 0);
      t.kutu(x + 1, y - 8, 12, 7, 112);
      t.kutu(x + 4, y - 8, 1, 7, 0);
      t.kutu(x + 9, y - 8, 1, 7, 0);
      t.kutu(x + 1, y - 7, 12, 1, 170);
      return;
    }
    t.kutu(x, y - 13, 10, 13, 0);
    t.kutu(x + 1, y - 12, 8, 11, 112);
    t.kutu(x + 1, y - 9, 8, 1, 0);
    t.kutu(x + 1, y - 4, 8, 1, 0);
    t.kutu(x + 2, y - 12, 1, 11, 170);
  }

  private kasa(x: number, y: number, w: number, h: number): void {
    const t = this.t;
    t.kutu(x, y - h, w, h, 0);
    t.kutu(x + 1, y - h + 1, w - 2, h - 2, 150);
    t.kutu(x + 1, y - h + 1, w - 2, 1, 200);
    t.kutu(x + 1, y - Math.round(h / 2), w - 2, 1, 85);
    t.kutu(x + 2, y - h + 2, 1, h - 4, 85);
    t.kutu(x + w - 3, y - h + 2, 1, h - 4, 85);
  }

  /** Küçük alev: hasarlı siperde yanıp sönen ateş. */
  private alev(x: number, y: number, boy: number): void {
    const t = this.t;
    const z = this.d.zaman;
    for (let k = 0; k < 3; k++) {
      const h = boy * (0.6 + 0.4 * Math.sin(z * 11 + k * 2.1));
      t.daire(x + (k - 1) * 3, y - h * 0.5, h * 0.45, 0, ATES);
    }
    t.daire(x, y - 2, boy * 0.25, 0, AKKOR);
    t.leke(x + Math.sin(z * 1.3) * 3, y - boy - 8, 7, 0.5, 30);
    t.leke(x + 4 + Math.sin(z * 0.9) * 4, y - boy - 20, 9, 0.35, 40);
  }

  /**
   * İleri üs: çadır, cephanelik, kamuflaj ağlı sığınak, telsiz direği, bayrak,
   * gözetleme kulesi (arka geçiş); kule korkuluğu, makineli yuvası, kum torbası
   * duvarı ve dikenli tel (ön geçiş: askerlerin önünde). Hasar aldıkça dökülür.
   */
  private siper(on: boolean): void {
    const { t, d } = this;
    const y = this.Y(d.zemin);
    const can = d.siperCan;
    const z = d.zaman;
    const kx = this.X(SIPER_X + 6); // gözetleme kulesinin ortası
    const ky = y - 66; // platform
    if (this.X(SIPER_ON + 40) < -10) return;

    if (!on) {
      // --- Bayrak direği (en arkada) ---
      const dx = this.X(SIPER_X - 44);
      const egik = can > 0 ? 0 : 16;
      t.kalin(dx, y, dx + egik, y - 104, 0);
      t.daire(dx + egik + 0.5, y - 106, 1.8, 0);
      for (let k = 0; k < 29; k++) {
        const dal = Math.sin(z * 5 - k * 0.36) * (k / 29) * 3.6;
        const fy = y - 103 + Math.round(dal);
        const fx = dx + egik + 2 + k;
        const golge = Math.cos(z * 5 - k * 0.36) > 0.5;
        for (let m = 1; m < 16; m++) t.nokta(fx, fy + m, can > 0 ? (golge ? 213 : 254) : 128);
        t.nokta(fx, fy, 0);
        t.nokta(fx, fy + 16, 0);
        if (k === 28) for (let m = 0; m <= 16; m++) t.nokta(fx, fy + m, 0);
        const uz = Math.abs(k - 14);
        if (uz <= 5) for (let m = 8 - (5 - uz); m <= 8 + (5 - uz); m++) t.nokta(fx, fy + m, 0);
        if (uz <= 2) for (let m = 8 - (2 - uz); m <= 8 + (2 - uz); m++) t.nokta(fx, fy + m, can > 0 ? 254 : 128);
      }

      // --- Çadır ---
      const cx = this.X(SIPER_X - 61);
      if (can > 33) {
        for (let yy = 0; yy <= 34; yy++) {
          const yari = Math.round((yy * 21) / 34);
          t.kutu(cx - yari, y - 34 + yy, yari * 2 + 1, 1, yy > 30 ? 170 : 213);
          t.kutu(cx - yari, y - 34 + yy, Math.max(1, Math.round(yari * 0.45)), 1, 240); // güneş alan yüz
          t.nokta(cx - yari - 1, y - 34 + yy, 0);
          t.nokta(cx + yari + 1, y - 34 + yy, 0);
        }
        for (let yy = 14; yy <= 34; yy++) {
          const yari = Math.round(((yy - 14) * 6) / 20);
          t.kutu(cx - yari, y - 34 + yy, yari * 2 + 1, 1, 64); // kapı aralığı
        }
        t.cizgi(cx, y - 37, cx, y - 34, 0);
        t.cizgi(cx - 21, y - 2, cx - 34, y, 0); // gergi ipleri
        t.cizgi(cx + 21, y - 2, cx + 31, y, 0);
        t.kutu(cx + 9, y - 16, 5, 1, 0, KAN); // sıhhiye işareti
        t.kutu(cx + 11, y - 18, 1, 5, 0, KAN);
      } else {
        for (let k = -20; k <= 20; k++) t.kutu(cx + k, y - 4 - Math.round(Math.abs(Math.sin(k * 0.5)) * 5), 1, 9, k % 3 ? 170 : 128);
        for (let k = -20; k <= 20; k++) t.nokta(cx + k, y - 5 - Math.round(Math.abs(Math.sin(k * 0.5)) * 5), 0);
      }
      if (can <= 66 && can > 0) this.alev(cx - 14, y, 9);

      // --- Cephanelik: variller, kasalar ---
      const sx = this.X(SIPER_X - 48);
      this.varil(sx, y);
      this.varil(sx + 9, y);
      this.varil(sx + 4, y - 13, true);
      this.kasa(sx + 16, y, 13, 9);

      // --- Telsiz direği (sığınağın arkasında): kafes, gergi telleri, yanıp sönen ışık ---
      const mx = this.X(SIPER_X - 26);
      if (can > 0) {
        t.cizgi(mx - 2, y - 30, mx - 1, y - 128, 0);
        t.cizgi(mx + 3, y - 30, mx + 1, y - 128, 0);
        for (let yy = 34; yy < 126; yy += 8) {
          t.cizgi(mx - 2, y - yy, mx + 3, y - yy - 8, 0);
          t.cizgi(mx + 3, y - yy, mx - 2, y - yy - 8, 0);
        }
        t.cizgi(mx, y - 96, mx - 38, y - 30, 128);
        t.cizgi(mx, y - 96, mx + 40, y - 34, 128);
        t.cizgi(mx - 7, y - 118, mx + 8, y - 118, 0);
        t.cizgi(mx - 5, y - 123, mx + 6, y - 123, 0);
        t.cizgi(mx, y - 128, mx, y - 136, 0);
        if (Math.sin(z * 4) > 0) {
          t.daire(mx, y - 137, 1.5, 0, ATES);
          t.vurgu(mx, y - 137, AKKOR);
        } else t.nokta(mx, y - 137, 0);
      }

      // --- Sığınak: beton gövde, kütük çatı, mazgal, kamuflaj ağı ---
      const bx = this.X(SIPER_X - 36);
      const bw = 50;
      if (can > 0) {
        t.kutu(bx, y - 31, bw, 31, 0);
        t.kutu(bx + 1, y - 30, bw - 2, 30, 128);
        t.kutu(bx + 1, y - 30, bw - 2, 1, 200);
        for (let k = 0; k < 16; k++) t.nokta(bx + 3 + ((k * 13) % (bw - 6)), y - 4 - ((k * 7) % 24), 100); // beton dokusu
        t.kutu(bx + 1, y - 12, bw - 2, 1, 100); // kalıp izi
        // Kütük çatı: iki sıra, uçları görünür
        for (let r = 0; r < 2; r++) {
          t.kutu(bx - 3, y - 37 - r * 6, bw + 6, 6, 0);
          t.kutu(bx - 2, y - 36 - r * 6, bw + 4, 4, 85);
          t.kutu(bx - 2, y - 36 - r * 6, bw + 4, 1, 128);
          for (let k = 2; k < bw + 2; k += 7) t.nokta(bx - 2 + k + r * 3, y - 34 - r * 6, 0);
        }
        // Mazgal ve içinden görünen namlu
        t.kutu(bx + 20, y - 22, 26, 6, 0);
        t.kutu(bx + 21, y - 21, 24, 1, 42);
        t.kutu(bx + 34, y - 20, 16, 2, 0);
        t.kutu(bx + 19, y - 23, 28, 1, 200);
        // Kapı
        t.kutu(bx + 4, y - 20, 11, 20, 0);
        t.kutu(bx + 5, y - 19, 9, 19, 42);
        t.kutu(bx + 5, y - 19, 9, 1, 85);
        t.nokta(bx + 12, y - 9, 170);
        if (can <= 33) {
          t.cizgi(bx + 30, y - 30, bx + 26, y - 18, 0); // çatlak
          t.cizgi(bx + 26, y - 18, 30 + bx, y - 8, 0);
        }
        // Çatıda kum torbaları
        for (let k = 0; k < 4; k++) this.kumTorbasi(bx - 1 + k * 13, y - 50);
        for (let k = 0; k < (can > 66 ? 3 : 1); k++) this.kumTorbasi(bx + 6 + k * 13, y - 56);
        // Kamuflaj ağı: çatının sağ ucundan yere inen perde, iri yapraklı doku
        for (let yy = 0; yy < 44; yy += 2) {
          const sol = bx + bw - 2 + Math.round(yy * 0.08);
          const sag = bx + bw + 5 + Math.round(yy * 0.36);
          for (let xx = sol; xx < sag; xx += 2) {
            const h = kes(Math.floor(xx / 4) + 3, Math.floor(yy / 4));
            if (h < 0.75) t.kutu(xx, y - 44 + yy, 2, 2, h < 0.4 ? 85 : 150);
          }
          t.nokta(sag, y - 44 + yy, 0);
        }
        if (can <= 33) this.alev(bx + bw - 6, y - 44, 11);
      } else {
        for (let k = 0; k < 14; k++) t.kutu(bx - 4 + k * 5 + Math.round(kes(k, 1) * 4), y - 4 - Math.round(kes(k, 2) * 14), 6, 18, kes(k, 3) < 0.5 ? 0 : 85);
        this.alev(bx + 14, y - 8, 12);
        this.alev(bx + 38, y - 4, 8);
      }

      // --- Gözetleme kulesi: çapraz bağlı ayaklar, merdiven, saç çatı, projektör ---
      const yat = can > 0 ? 0 : 22;
      if (can > 0 || true) {
        const ust = ky;
        t.kalin(kx - 12, y, kx - 9 + yat, ust, 0);
        t.kalin(kx + 11, y, kx + 8 + yat, ust, 0);
        for (const [a0, a1] of [[0, 0.5], [0.5, 1]]) {
          const y0 = y - 66 * a0;
          const y1 = y - 66 * a1;
          const xl0 = kx - 12 + 3 * a0 + yat * a0;
          const xl1 = kx - 12 + 3 * a1 + yat * a1;
          const xr0 = kx + 11 - 3 * a0 + yat * a0;
          const xr1 = kx + 11 - 3 * a1 + yat * a1;
          t.cizgi(xl0, y0, xr1, y1, 0);
          t.cizgi(xr0, y0, xl1, y1, 0);
          t.cizgi(xl1, y1, xr1, y1, 0);
        }
        // Merdiven
        for (let yy = 4; yy < 64; yy += 5) t.cizgi(kx - 17 + (yy / 66) * (3 + yat), y - yy, kx - 12 + (yy / 66) * (3 + yat), y - yy, 0);
        t.cizgi(kx - 17, y, kx - 14 + yat, ust, 0);
        if (can > 0) {
          // Platform
          t.kutu(kx - 15, ust, 31, 3, 0);
          t.kutu(kx - 14, ust, 29, 1, 128);
          // Direkler ve çatı
          t.cizgi(kx - 13, ust, kx - 13, ust - 27, 0);
          t.cizgi(kx + 13, ust, kx + 13, ust - 27, 0);
          if (can > 33) {
            for (let yy = 0; yy <= 9; yy++) {
              const yari = 19 - Math.round((9 - yy) * 1.9);
              t.kutu(kx - yari, ust - 37 + yy, yari * 2 + 1, 1, 85);
              t.nokta(kx - yari - 1, ust - 37 + yy, 0);
              t.nokta(kx + yari + 1, ust - 37 + yy, 0);
            }
            for (let k = -16; k <= 16; k += 4) t.cizgi(kx + k * 0.2, ust - 36, kx + k, ust - 28, 128); // oluklu sac
            t.kutu(kx - 20, ust - 28, 41, 2, 0);
          } else {
            t.cizgi(kx - 13, ust - 27, kx + 6, ust - 33, 0); // çatının iskeleti kalmış
            t.cizgi(kx + 6, ust - 33, kx + 13, ust - 27, 0);
            this.alev(kx + 2, ust - 28, 8);
          }
          // Projektör
          t.daire(kx + 16, ust - 20, 4, 0);
          t.daire(kx + 17, ust - 20, 2.4, 254);
          t.cizgi(kx + 13, ust - 20, kx + 13, ust - 14, 0);
        }
      }
      return;
    }

    // ---- Ön geçiş: askerlerin önünde kalanlar ----
    if (can > 0) {
      // Kule korkuluğu ve platformdaki kum torbaları
      t.kutu(kx - 15, ky - 13, 31, 1, 0);
      this.kumTorbasi(kx + 1, ky - 7);
      this.kumTorbasi(kx - 14, ky - 7);
      for (let k = -14; k <= 14; k += 7) t.cizgi(kx + k, ky - 13, kx + k, ky, 0);
    }
    // Makineli yuvası: yarım ay kum torbası
    const nx = this.X(SIPER_X + 30);
    if (can > 0) {
      this.kumTorbasi(nx - 22, y - 7);
      this.kumTorbasi(nx + 2, y - 7);
      this.kumTorbasi(nx + 15, y - 7);
      this.kasa(nx - 20, y - 7, 9, 6); // mermi sandığı
    }
    // Ön duvar: kazıklı kum torbası duvarı
    const sx = this.X(SIPER_ON - 20);
    const satir = can > 50 ? 2 : can > 0 ? 1 : 0;
    if (satir > 0) {
      t.kalin(sx - 2, y, sx - 2, y - 8 - satir * 6, 0);
      t.kalin(sx + 41, y, sx + 41, y - 8 - satir * 6, 0);
    }
    for (let r = 0; r < satir; r++) {
      for (let k = 0; k < 3; k++) this.kumTorbasi(sx + k * 13 + (r % 2) * 6, y - 7 - r * 6);
    }
    if (can <= 50 && can > 0) {
      // Dökülmüş torbalar
      this.kumTorbasi(sx + 44, y - 7);
      t.kutu(sx + 30, y - 2, 9, 2, 200);
    }
    // Dikenli tel: iki sıra sarmal, kazıklar
    const tx = this.X(SIPER_ON + 8);
    for (let k = 0; k <= 48; k += 12) {
      t.cizgi(tx + k - 3, y, tx + k + 3, y - 15, 85);
      t.cizgi(tx + k + 3, y, tx + k - 3, y - 15, 85);
    }
    for (let k = 0; k < 50; k++) {
      const a = k * 0.62;
      t.nokta(tx + k + Math.cos(a) * 2.5, y - 9 + Math.sin(a) * 5, 85);
      t.nokta(tx + k + Math.cos(a + 2) * 2.5, y - 4 + Math.sin(a + 2) * 3, 85);
      if (k % 5 === 2) t.nokta(tx + k, y - 15, 85);
    }
  }

  // ---- Araçlar ----

  private canCubugu(x: number, y: number, oran: number): void {
    const t = this.t;
    if (oran >= 1 || oran <= 0) return;
    t.kutu(x - 14, y, 28, 4, 0);
    t.kutu(x - 13, y + 1, 26, 2, 254);
    t.kutu(x - 13, y + 1, Math.max(1, Math.round(26 * oran)), 2, 0, KAN);
  }

  /** Araçların görsel eğimi (yumuşatılmış); simülasyonda yok. */
  private egimler = new WeakMap<object, number>();

  /**
   * Aracın zemindeki duruşu: ön ve arka temas noktasından eğim ve yükseklik.
   * Dönen değer: [ekran x, taban y, eğim açısı].
   */
  private durus(a: { x: number }, yari: number): [number, number, number] {
    const d = this.d;
    const y0 = d.yolY(a.x - yari);
    const y1 = d.yolY(a.x + yari);
    const hedef = sinirla(Math.atan2(y1 - y0, yari * 2), -0.6, 0.6);
    let e = this.egimler.get(a);
    if (e === undefined) e = hedef;
    e += (hedef - e) * 0.22;
    this.egimler.set(a, e);
    // İki ucun ortalamasına oturur; ortadaki tümsek daha yüksekse ona
    const taban = Math.min((y0 + y1) / 2, d.yolY(a.x) + 1.5);
    return [this.X(a.x), this.Y(taban), e];
  }

  private araclar(): void {
    const { t, d } = this;
    for (const a of d.araclar) {
      const sars = a.sars > 0 ? (Math.floor(d.zaman * 60) % 2 ? 1 : -1) : 0;
      const [x0, yb, e] = this.durus(a, a.tip === T_KAMYON ? 17 : 16);
      const x = x0 + sars;
      if (x < -70 || x > EK + 70) continue;
      const gidiyor = a.x > a.dur;
      // Yürürken süspansiyon hafifçe yaylanır
      const zip = gidiyor ? Math.round(Math.abs(Math.sin(a.t * 11)) * 1.3) : 0;
      if (a.tip === T_TANK) {
        const yc = yb - (SPR_TANK.h - 1 - TANK_N.oy) - zip;
        t.cizDon(SPR_TANK, x, yc, e, true, TANK_N.ox, TANK_N.oy);
        if (gidiyor) {
          // Palet baklaları akar
          const k = Math.floor(a.t * 16) % 4;
          for (let p = -34 + k; p < 35; p += 4) {
            const [px, py] = this.yerel(x, yc, e, -1, p, 9);
            t.nokta(px, py, 150);
          }
        }
        const yon = a.nisanT > 0 && d.heli.x > a.x ? 1 : -1;
        const tepki = a.sars > 0.08 ? 5 : 0; // atış sonrası geri tepme
        // Kule gövdenin üstüne 1 piksel biner (arada boşluk kalmaz)
        const [tx, ty] = this.yerel(x, yc, e, -1, TANK_N.kule[0] - TANK_N.ox, TANK_N.kule[1] - TANK_N.oy + 1);
        const [bx, by] = this.yerel(tx, ty, e, yon, KULE_N.namlu[0] - KULE_N.ox, KULE_N.namlu[1] - KULE_N.oy);
        // Namlu dengelidir: gövde yatsa da hedefe bakar
        const ux = yon * Math.cos(a.namlu);
        const uy = -Math.sin(a.namlu);
        const uz = 40 - tepki;
        for (let k = -1; k <= 1; k++) t.cizgi(bx, by + k, bx + ux * uz, by + k + uy * uz, 0);
        // Namlu gaz boşaltıcısı ve ağız
        for (let k = -2; k <= 2; k++) t.cizgi(bx + ux * uz * 0.5, by + k + uy * uz * 0.5, bx + ux * uz * 0.66, by + k + uy * uz * 0.66, 0);
        t.kutu(bx + ux * uz - 1, by + uy * uz - 2, 3, 5, 0);
        t.cizDon(SPR_KULE, tx - yon * tepki * 0.4, ty, e, yon < 0, KULE_N.ox, KULE_N.oy);
        // Anten
        const [ax, ay] = this.yerel(tx, ty, e, yon, -14, -9);
        t.cizgi(ax, ay, ax + Math.sin(a.t * 7) * (gidiyor ? 2.5 : 0.6) - e * 8, ay - 18, 0);
        if (a.nisanT > 0 && Math.floor(d.zaman * 14) % 2 === 0) {
          // Nişan çizgisi: helikoptere doğru kesik kırmızı çizgi
          const hx = this.X(d.heli.x);
          const hy = this.Y(d.heli.y);
          for (let k = 1; k < 10; k += 2) {
            const u0 = k / 11;
            const u1 = (k + 1) / 11;
            t.cizgi(bx + (hx - bx) * u0, by + (hy - by) * u0, bx + (hx - bx) * u1, by + (hy - by) * u1, 0, KAN);
          }
        }
      } else if (a.tip === T_KOPRUCU) {
        // Köprücü: tank gövdesi, üstünde katlı köprü; açarken üst kiriş öne devrilir
        const yc = yb - (SPR_TANK.h - 1 - TANK_N.oy) - zip;
        t.cizDon(SPR_TANK, x, yc, e, true, TANK_N.ox, TANK_N.oy);
        const [ax, ay] = this.yerel(x, yc, e, -1, 24, -8); // ön mafsal (araç sola bakar)
        const [bx2, by2] = this.yerel(x, yc, e, -1, -30, -9);
        t.kutu(ax - 2, ay - 2, 5, 6, 0);
        if (a.yuk > 0) {
          const kiris = (x0: number, y0: number, x1: number, y1: number): void => {
            for (let k = -1; k <= 1; k++) t.cizgi(x0, y0 + k, x1, y1 + k, k === 0 ? 128 : 0);
            for (let u = 0.1; u < 1; u += 0.2) t.cizgi(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u + 2, x0 + (x1 - x0) * (u + 0.1), y0 + (y1 - y0) * (u + 0.1) + 5, 0);
          };
          kiris(ax, ay - 3, bx2, by2 - 3); // alt kiriş: gövdenin üstünde yatar
          // Üst kiriş: açılırken mafsaldan öne doğru döner
          const ac = sinirla(a.nisanT / 2, 0, 1);
          const aci = -ac * Math.PI * 0.94;
          const uz = Math.hypot(bx2 - ax, by2 - ay);
          kiris(ax, ay - 8, ax + Math.cos(aci) * uz, ay - 8 + Math.sin(aci) * uz);
        } else {
          t.kalin(ax, ay - 2, ax + 10, ay - 12, 0); // boş kaldırma kolu
        }
      } else if (a.tip === T_UCAKSAVAR) {
        const N = UCAKSAVAR_N;
        const yc = yb - (SPR_UCAKSAVAR.h - 1 - N.oy) - zip;
        t.cizDon(SPR_UCAKSAVAR, x, yc, e, true, N.ox, N.oy);
        const c = Math.cos(a.namlu);
        const s = Math.sin(a.namlu);
        const yon = c >= 0 ? 1 : -1;
        const [tx, ty] = this.yerel(x, yc, e, -1, N.kule[0] - N.ox, N.kule[1] - N.oy + 1);
        const [gx, gy] = this.yerel(tx, ty, e, yon, UKULE_N.namlu[0] - UKULE_N.ox, UKULE_N.namlu[1] - UKULE_N.oy);
        // Dörtlü top: iki çift namlu, uçlarında alev gizleyen
        for (const k of [-3, -1, 1, 3]) {
          const ox = s * k * 0.8;
          const oy = c * k * 0.8;
          t.cizgi(gx + ox, gy + oy, gx + ox + c * 24, gy + oy - s * 24, 0);
          t.nokta(gx + ox + c * 25, gy + oy - s * 25, 0);
        }
        t.cizDon(SPR_UKULE, tx, ty, e, yon < 0, UKULE_N.ox, UKULE_N.oy);
        // Dönen radar çanağı
        const [rx, ry] = this.yerel(tx, ty, e, yon, UKULE_N.radar[0] - UKULE_N.ox, UKULE_N.radar[1] - UKULE_N.oy);
        t.cizgi(rx, ry, rx, ry - 6, 0);
        const gen = 1 + Math.abs(Math.cos(d.zaman * 3 + a.x)) * 7;
        for (let yy = -4; yy <= 4; yy++) {
          const w = Math.round(gen * Math.sqrt(1 - (yy / 4.5) ** 2));
          t.kutu(rx - w, ry - 10 + yy, w * 2 + 1, 1, yy === -4 || yy === 4 ? 0 : 128);
          t.nokta(rx - w, ry - 10 + yy, 0);
          t.nokta(rx + w, ry - 10 + yy, 0);
        }
      } else {
        const N = KAMYON_N;
        t.cizDon(SPR_KAMYON, x, yb - (SPR_KAMYON.h - 1 - N.oy) - zip, e, true, N.ox, N.oy);
      }
      this.canCubugu(x, yb - 52, a.can / a.enCan);
      // Çukur başında bekleyen araç: üstünde yanıp sönen işaret
      if (a.engelli && a.tip !== T_KOPRUCU && Math.floor(d.zaman * 3) % 2 === 0) t.yazi('?', x, yb - 62, { hiza: 0, olcek: 3, kenar: 255 });
    }
  }

  // ---- Askerler ----

  /** İki parçalı uzuv: kök → eklem → uç. */
  private uzuv(x0: number, y0: number, x1: number, y1: number, bukX: number, bukY: number): void {
    const mx = (x0 + x1) / 2 + bukX;
    const my = (y0 + y1) / 2 + bukY;
    this.t.cizgi(x0, y0, mx, my, 0);
    this.t.cizgi(mx, my, x1, y1, 0);
  }

  /**
   * Başlık. 0 miğfer, 1 ağ örtülü miğfer, 2 bere, 3 bandana, 4 subay kasketi,
   * 5 geniş kenarlı nişancı şapkası. Dostlar beyaz miğferli.
   */
  private sapka(hx: number, hy: number, yon: number, tur: number, dost: boolean): void {
    const t = this.t;
    t.daire(hx + 0.5, hy, 3.2, 0);
    if (dost) {
      t.daire(hx + 0.5, hy - 0.5, 2, 250);
      t.cizgi(hx - 4, hy, hx + 5, hy, 0);
      if (tur === 4) {
        t.kutu(hx - 4, hy - 5, 9, 2, 0);
        t.kutu(hx - 3, hy - 5, 7, 1, 250);
        t.nokta(hx + yon * 5, hy - 3, 0);
      }
      return;
    }
    if (tur === 0 || tur === 1) {
      t.cizgi(hx - 4, hy, hx + 5, hy, 0); // miğfer kenarı
      t.nokta(hx - 1, hy - 2, 128);
      t.nokta(hx, hy - 3, 128);
      if (tur === 1) {
        t.nokta(hx + 2, hy - 2, 128);
        t.nokta(hx - 2, hy - 1, 128);
        t.nokta(hx - yon * 4, hy + 1, 0); // sarkan örtü
        t.nokta(hx - yon * 4, hy + 2, 0);
      }
    } else if (tur === 2) {
      t.kutu(hx - 3, hy - 4, 7, 2, 0); // bere: yana yatık
      t.nokta(hx - yon * 4, hy - 3, 0);
      t.nokta(hx - yon * 4, hy - 2, 0);
      t.nokta(hx + yon * 2, hy - 4, 128);
    } else if (tur === 3) {
      t.cizgi(hx - 3, hy - 1, hx + 4, hy - 1, 128); // bandana ve uçuşan ucu
      const dal = Math.round(Math.sin(this.d.zaman * 9 + hx) * 1.2);
      t.cizgi(hx - yon * 3, hy - 1, hx - yon * 7, hy + dal, 0);
      t.nokta(hx - yon * 8, hy + dal + 1, 0);
    } else if (tur === 4) {
      t.kutu(hx - 4, hy - 5, 9, 2, 0); // kasket: geniş tabla, siperlik
      t.kutu(hx - 3, hy - 3, 7, 1, 0);
      t.nokta(hx + yon * 5, hy - 3, 0);
      t.nokta(hx + yon * 2, hy - 4, 254); // kokart
    } else {
      t.cizgi(hx - 6, hy - 1, hx + 7, hy - 1, 0); // geniş kenar
      t.kutu(hx - 2, hy - 4, 5, 3, 0);
      t.nokta(hx - yon * 6, hy, 0);
    }
  }

  /**
   * Silah: (ox, oy) omuz hizası, (c, sn) nişan yönü. 0 tüfek, 1 makineli,
   * 2 dürbünlü tüfek, 3 roketatar, 4 tabanca. Dönen değer: namlu ucu.
   */
  private silah(tur: number, ox: number, oy: number, c: number, sn: number, atis: boolean): void {
    const t = this.t;
    // Aşağı bakan dik yön (şarjör, çatal)
    const ax = c >= 0 ? -sn : sn;
    const ay = c >= 0 ? c : -c;
    let uz = 14;
    if (tur === 0) {
      t.cizgi(ox + c, oy + sn, ox + c * 14, oy + sn * 14, 0);
      t.nokta(ox - c * 2 + ax, oy - sn * 2 + ay, 0); // dipçik
      t.nokta(ox - c * 2, oy - sn * 2, 0);
      t.cizgi(ox + c * 6 + ax, oy + sn * 6 + ay, ox + c * 7 + ax * 3, oy + sn * 7 + ay * 3, 0); // eğri şarjör
    } else if (tur === 1) {
      uz = 18;
      t.kalin(ox - c * 2, oy - sn * 2, ox + c * 9, oy + sn * 9, 0);
      t.cizgi(ox + c * 9, oy + sn * 9, ox + c * 18, oy + sn * 18, 0);
      t.kutu(ox + c * 4 + ax * 2 - 1, oy + sn * 4 + ay * 2 - 1, 3, 3, 0); // mermi kutusu
      t.nokta(ox + c * 4 + ax * 2, oy + sn * 4 + ay * 2, 128);
      // Çatal ayak
      t.cizgi(ox + c * 13, oy + sn * 13, ox + c * 15 + ax * 5, oy + sn * 15 + ay * 5, 0);
      t.cizgi(ox + c * 13, oy + sn * 13, ox + c * 11 + ax * 5, oy + sn * 11 + ay * 5, 0);
    } else if (tur === 2) {
      uz = 20;
      t.cizgi(ox - c * 3, oy - sn * 3, ox + c * 20, oy + sn * 20, 0);
      t.cizgi(ox - c * 3 + ax, oy - sn * 3 + ay, ox + c * 2 + ax, oy + sn * 2 + ay, 0); // dipçik
      t.cizgi(ox + c * 4 - ax * 2, oy + sn * 4 - ay * 2, ox + c * 9 - ax * 2, oy + sn * 9 - ay * 2, 0); // dürbün
      t.nokta(ox + c * 9 - ax * 2, oy + sn * 9 - ay * 2, 170);
    } else if (tur === 3) {
      uz = 13;
      t.kalin(ox - c * 6, oy - 1 - sn * 6, ox + c * 9, oy - 1 + sn * 9, 0);
      t.daire(ox + c * 11, oy - 1 + sn * 11, 2, 0); // başlık
      t.nokta(ox + c * 13, oy - 1 + sn * 13, 0);
      t.cizgi(ox - c * 7 - ax * 2, oy - 1 - sn * 7 - ay * 2, ox - c * 7 + ax * 2, oy - 1 - sn * 7 + ay * 2, 0); // arka huni
      t.cizgi(ox + c * 2 + ax, oy + sn * 2 + ay, ox + c * 2 + ax * 3, oy + sn * 2 + ay * 3, 0); // kabza
    } else {
      uz = 9;
      t.cizgi(ox + c * 6, oy + sn * 6, ox + c * 9, oy + sn * 9, 0);
      t.nokta(ox + c * 6 + ax, oy + sn * 6 + ay, 0);
    }
    if (atis) {
      const mx = ox + c * (uz + 2);
      const my = oy + sn * (uz + 2);
      t.cizgi(mx - 2, my, mx + 2, my, 0, ATES);
      t.cizgi(mx, my - 2, mx, my + 2, 0, ATES);
      t.vurgu(mx + c * 2, my + sn * 2, ATES);
      t.vurgu(mx, my, AKKOR);
    }
  }

  /** Sırt çantası: 0 yok, 1 küçük, 2 battaniye rulolu, 3 kürekli, 4 yedek roketli, 5 mermi sandıklı. */
  private canta(nx: number, by: number, yon: number, tur: number): void {
    const t = this.t;
    if (tur === 0) return;
    const x = yon > 0 ? nx - 4 : nx + 2;
    t.kutu(x, by, 3, tur === 1 ? 5 : 6, 0);
    t.nokta(x + (yon > 0 ? 0 : 2), by + 1, 128);
    if (tur === 2) {
      t.kutu(x - (yon > 0 ? 1 : 0), by - 2, 4, 2, 0); // battaniye rulosu
      t.nokta(x + 1, by - 2, 150);
    } else if (tur === 3) {
      t.cizgi(x + 1, by, x + 1 - yon, by - 6, 0); // kürek sapı
      t.kutu(x - yon, by - 8, 2, 2, 0);
    } else if (tur === 4) {
      for (const k of [0, 2]) {
        t.cizgi(x + k, by, x + k - yon, by - 7, 0); // yedek roketler
        t.nokta(x + k - yon, by - 8, 0);
        t.nokta(x + k - yon, by - 9, 128);
      }
    } else if (tur === 5) {
      t.kutu(x - (yon > 0 ? 1 : 0), by + 1, 4, 5, 0);
      t.kutu(x, by + 3, 2, 1, 150);
    }
  }

  /** Yüzüstü yatmış makineli tüfekçi. */
  private yuzustu(s: Asker, x: number, y: number): void {
    const t = this.t;
    const yon = s.yon;
    const c = Math.cos(s.nisanAci);
    // Yerde yatarken namlu çok dikilemez
    const sn = Math.max(-0.75, Math.min(0.2, Math.sin(s.nisanAci)));
    const cc = Math.sign(c || yon) * Math.sqrt(1 - sn * sn);
    // Bacaklar geride, hafif açık
    t.cizgi(x - yon * 3, y - 3, x - yon * 13, y - 1, 0);
    t.cizgi(x - yon * 3, y - 3, x - yon * 11, y - 4, 0);
    t.nokta(x - yon * 14, y - 1, 0);
    t.nokta(x - yon * 12, y - 4, 0);
    // Gövde ve sırttaki mermi sandığı
    t.kalin(x - yon * 3, y - 4, x + yon * 4, y - 6, 0);
    t.kutu(x - (yon > 0 ? 3 : 0), y - 9, 4, 3, 0);
    t.nokta(x - (yon > 0 ? 2 : -1), y - 9, 150);
    // Dirsek yerde
    this.uzuv(x + yon * 4, y - 5, x + yon * 7, y - 5, 0, 3);
    this.sapka(x + yon * 6, y - 9, yon, 0, false);
    this.silah(1, x + yon * 6, y - 5, cc, sn, s.atis > 0);
  }

  private adam(s: Asker): void {
    const t = this.t;
    const d = this.d;
    const x = this.X(s.x);
    if (x < -30 || x > EK + 30) return;
    const y = this.Y(s.y) - Math.round(s.yukseklik * K);
    const yon = s.yon;
    const kl = s.kilik;
    const tip = s.tip;
    const dusman = !s.dost;
    const boy = dusman ? ((kl >> 7) & 3) - 1 : 0; // boy farkı: kalabalık tek tip görünmesin
    const kosuyor = dusman && (s.durum === KOS || s.durum === PANIK || s.durum === YANIYOR);
    // Dalga arasında dostlar sevinir
    const sevinc = s.dost && d.oyunda && d.ara > 2.6 && d.dalga > 0 && !d.bitisNeden;

    if (dusman && tip === T_MAKINELI && !kosuyor) {
      this.yuzustu(s, x, y);
      return;
    }

    let kalca = y - 9 - boy;
    let boyun = y - 17 - boy;
    let egil = 0;
    const dizde =
      (dusman && !kosuyor && (tip === T_ROKET || tip === T_NISANCI || (tip === T_TUFEK && ((kl >> 9) & 1) === 1))) || (s.dost && s.rol === 1);
    if (kosuyor) {
      // Koşu: bacaklar karşılıklı, diz öne bükülür, gövde hafifçe zıplar
      const zip = Math.abs(Math.sin(s.faz)) * 1.5;
      kalca -= zip;
      boyun -= zip;
      for (const faz of [s.faz, s.faz + Math.PI]) {
        const a = Math.sin(faz);
        const kalk = Math.max(0, Math.cos(faz));
        const fx = x + a * 5 * yon;
        const fy = y - kalk * 4;
        this.uzuv(x, kalca, fx, fy, yon * (1.5 + kalk * 1.5), -0.5);
        t.nokta(fx + yon, fy, 0);
      }
      egil = yon * (s.durum === KOS ? (tip === T_MAKINELI ? 3 : 2) : 3);
    } else if (dizde) {
      kalca = y - 6;
      boyun = y - 14;
      this.uzuv(x, kalca, x + yon * 4, y, yon * 2, -3);
      this.uzuv(x, kalca, x - yon * 6, y, -yon * 1, 2);
      t.nokta(x + yon * 5, y, 0);
    } else {
      const zip = sevinc ? Math.abs(Math.sin(d.zaman * 9 + s.x)) * 3 : 0;
      kalca -= zip;
      boyun -= zip;
      this.uzuv(x, kalca, x - 3, y, -0.5, 0);
      this.uzuv(x, kalca, x + 2, y, 0.5, 0);
      t.nokta(x - 4, y, 0);
      t.nokta(x + 3, y, 0);
    }
    const nx = Math.round(x + egil);
    const by = boyun + 2;
    // Gövde (2 piksel), çanta
    t.kalin(x, kalca, nx, boyun, 0);
    if (dusman && s.durum !== YANIYOR) {
      const canta = tip === T_ROKET ? 4 : tip === T_MAKINELI ? 5 : tip === T_SUBAY ? 0 : tip === T_NISANCI ? 1 : (kl >> 2) & 3;
      this.canta(nx, by, yon, canta);
      if (tip === T_SUBAY) t.cizgi(nx - 1, by, nx + 2, by + 5, 150); // çapraz kayış
      else if (((kl >> 4) & 7) === 0) {
        // Atkı: boyundan geriye uçuşur
        const dal = Math.round(Math.sin(d.zaman * 8 + s.x) * 1.5);
        t.cizgi(nx, boyun + 1, nx - yon * 5, boyun + 2 + dal, 0);
      }
    }
    // Baş
    const hx = Math.round(x + egil * 1.4);
    const hy = Math.round(boyun - 4);
    const baslik = s.dost ? (s.rol === 3 ? 4 : 0) : tip === T_SUBAY ? 4 : tip === T_NISANCI ? 5 : tip === T_MAKINELI ? 0 : kl & 3;
    this.sapka(hx, hy, yon, baslik, s.dost);

    // ---- Kollar ve silah ----
    if (s.durum === PANIK && dusman) {
      const k = Math.sin(s.faz * 2) * 2;
      this.uzuv(nx, by, nx - 5, by - 7 + k, -2, 1);
      this.uzuv(nx + 1, by, nx + 6, by - 7 - k, 2, 1);
      return;
    }
    if (s.durum === YANIYOR && dusman) {
      const k = Math.sin(s.faz * 1.7) * 4;
      this.uzuv(nx, by, nx - 6, by - 4 + k, -1, -2);
      this.uzuv(nx + 1, by, nx + 7, by - 4 - k, 1, -2);
      return;
    }
    if (sevinc && s.rol !== 1) {
      const k = Math.sin(d.zaman * 9 + s.x) * 2;
      this.uzuv(nx, by, nx - 5, by - 8 + k, -2, 1);
      this.uzuv(nx + 1, by, nx + 6, by - 8 - k, 2, 1);
      if (s.rol !== 3) t.cizgi(nx + 6, by - 8 - k, nx + 8, by - 19 - k, 0); // tüfek havada
      return;
    }
    if (s.dost) {
      const c = Math.cos(s.nisanAci);
      const sn = Math.sin(s.nisanAci);
      if (s.rol === 3) {
        // Subay: dürbünle bakar, arada eliyle ileriyi gösterir
        if (Math.sin(s.t * 0.9) > -0.2) {
          this.uzuv(nx, by, hx + 3, hy, 2, 2);
          this.uzuv(nx + 1, by, hx + 5, hy + 1, 3, 3);
          t.kutu(hx + 4, hy - 1, 4, 3, 0);
          t.nokta(hx + 7, hy, 200);
        } else {
          this.uzuv(nx, by, nx + 9, by - 2, 0, 2);
          this.uzuv(nx, by, nx - 3, by + 6, -2, 0);
        }
      } else if (s.rol === 1) {
        // Ağır makineli: üç ayak, soğutma gömlekli namlu, kalkan, mermi şeridi
        const px = x + 13;
        const py = y - 15;
        t.cizgi(px, py, px - 5, y, 0);
        t.cizgi(px, py, px + 6, y, 0);
        t.cizgi(px, py, px + 1, y - 2, 0);
        t.kalin(px - c * 6, py - 1 - sn * 6, px + c * 8, py - 1 + sn * 8, 0);
        t.kutu(px - c * 2 - 2, py - 3 - sn * 2, 4, 5, 0);
        t.cizgi(px + c * 8, py - 1 + sn * 8, px + c * 21, py - 1 + sn * 21, 0);
        t.cizgi(px + c * 8, py + sn * 8, px + c * 16, py + sn * 16, 0);
        t.kutu(px + c * 4 - 1, py - 6 + sn * 4, 2, 9, 0); // kalkan
        t.kutu(px - 5, py + 2, 5, 4, 0); // mermi kutusu
        t.nokta(px - 4, py + 3, 150);
        this.uzuv(nx, by, px - c * 6, py - 1 - sn * 6, 0, 2);
        this.uzuv(nx, by + 1, px - c * 5, py + 1 - sn * 5, 0, 3);
        if (s.atis > 0) {
          const mx = px + c * 24;
          const my = py - 1 + sn * 24;
          t.cizgi(mx - 3, my, mx + 3, my, 0, ATES);
          t.cizgi(mx, my - 3, mx, my + 3, 0, ATES);
          t.daire(mx, my, 1.5, 0, AKKOR);
        }
      } else {
        this.uzuv(nx, by, nx + c * 6, by + sn * 6, 0, 2);
        this.silah(0, nx, by, c, sn, s.atis > 0);
      }
      return;
    }
    if (s.durum === KOS) {
      // Koşarken taşıma
      this.uzuv(nx, by, nx + yon * 5, by + 4, 0, 2);
      if (tip === T_ROKET) {
        t.kalin(nx - yon * 7, by - 1, nx + yon * 7, by - 4, 0);
        t.daire(nx + yon * 9, by - 4, 1.8, 0);
      } else if (tip === T_MAKINELI) {
        t.kalin(nx - yon * 3, by + 5, nx + yon * 8, by + 4, 0);
        t.cizgi(nx + yon * 8, by + 4, nx + yon * 15, by + 3, 0);
        t.kutu(nx + yon * 3 - 1, by + 6, 3, 3, 0);
      } else if (tip === T_NISANCI) {
        t.cizgi(nx - yon * 2, by + 9, nx - yon * 4, by - 10, 0); // tüfek sırtta
        t.nokta(nx - yon * 5, by - 4, 0);
      } else if (tip === T_SUBAY) {
        // Tabanca havada, öteki kol "ileri" diye sallar
        const k = Math.sin(s.faz * 0.8) * 2;
        this.uzuv(nx, by, nx - yon * 2, by - 9 + k, -yon * 2, 1);
        t.cizgi(nx - yon * 2, by - 9 + k, nx - yon * 2, by - 12 + k, 0);
        t.nokta(nx - yon * 1, by - 12 + k, 0);
      } else {
        t.cizgi(nx - yon * 3, by + 6, nx + yon * 10, by + 1, 0);
        t.nokta(nx - yon * 3, by + 7, 0);
        t.cizgi(nx + yon * 3, by + 5, nx + yon * 4, by + 7, 0);
        if (((kl >> 5) & 3) === 0) t.cizgi(nx + yon * 10, by + 1, nx + yon * 13, by, 128); // süngü
      }
      return;
    }
    // Nişan
    const c = Math.cos(s.nisanAci);
    const sn = Math.sin(s.nisanAci);
    this.uzuv(nx, by, nx + c * 6, by + sn * 6, 0, 2);
    if (tip === T_ROKET) {
      this.silah(3, nx, by, c, sn, false);
      if (s.hedef === 1 && Math.floor(d.zaman * 14) % 2 === 0) t.yazi('!', x, y - 42, { hiza: 0, olcek: 3, vurgu: KAN });
    } else if (tip === T_NISANCI) {
      this.silah(2, nx, by, c, sn, s.atis > 0);
      if (s.seri === 1) {
        // Lazer: önce kesik, atışa yakın kesintisiz
        const hx2 = this.X(d.heli.x);
        const hy2 = this.Y(d.heli.y);
        const x0 = nx + c * 20;
        const y0 = by + sn * 20;
        const kesik = s.t < 0.7;
        for (let k = 0; k < 24; k++) {
          if (kesik && k % 2 === Math.floor(d.zaman * 12) % 2) continue;
          const u0 = k / 24;
          const u1 = (k + 1) / 24;
          t.cizgi(x0 + (hx2 - x0) * u0, y0 + (hy2 - y0) * u0, x0 + (hx2 - x0) * u1, y0 + (hy2 - y0) * u1, 0, KAN);
        }
        t.daire(hx2, hy2, kesik ? 2 : 3, 0, KAN);
      }
    } else if (tip === T_SUBAY) {
      this.silah(4, nx, by, c, sn, s.atis > 0);
      this.uzuv(nx, by, nx - yon * 4, by + 6, -yon, 0);
    } else {
      this.uzuv(nx, by + 1, nx + c * 9, by + 1 + sn * 9, 0, 3);
      this.silah(0, nx, by, c, sn, s.atis > 0);
    }
  }

  private askerler(): void {
    for (const s of this.d.askerler) this.adam(s);
  }

  private bezler(): void {
    const { t, d } = this;
    for (const b of d.bezler) {
      const x0 = this.X(b.x[2]);
      if (x0 < -60 || x0 > EK + 60) continue;
      for (let n = 0; n < 6; n++) {
        const [i0, i1] = BAGLAR[n];
        const ax = this.X(b.x[i0]);
        const ay = this.Y(b.y[i0]);
        const bx = this.X(b.x[i1]);
        const by = this.Y(b.y[i1]);
        if (b.bag & (1 << n)) {
          if (n === 1) t.kalin(ax, ay, bx, by, 0);
          else if (n === 0) t.cizgi(ax, ay, bx, by, 0);
          else this.uzuv(ax, ay, bx, by, (kes(n, 3) - 0.5) * 3, (kes(n, 4) - 0.5) * 3);
        } else if (!b.yanik) {
          // Kopuk yer: iki uçta kan
          t.vurgu(ax, ay, KAN);
          t.vurgu(ax + 1, ay, KAN);
          t.vurgu(bx, by, KAN);
        }
      }
      for (let k = 1; k < 7; k++) {
        if (b.bag & NOKTA_BAG[k]) continue;
        // Kopmuş uzuv
        const x = this.X(b.x[k]);
        const y = this.Y(b.y[k]);
        const vx = b.x[k] - b.px[k];
        const vy = b.y[k] - b.py[k];
        const m = Math.hypot(vx, vy);
        const ux = m > 0.05 ? vx / m : 1;
        const uy = m > 0.05 ? vy / m : 0;
        t.cizgi(x - ux * 4, y - uy * 4 - 1, x + ux * 4, y + uy * 4 - 1, 0);
        if (!b.yanik) t.vurgu(x - ux * 4, y - uy * 4 - 1, KAN);
      }
      const hx = this.X(b.x[0]);
      const hy = this.Y(b.y[0]);
      t.daire(hx + 0.5, hy - 1, 3.2, 0);
      if (b.dost) t.daire(hx + 0.5, hy - 0.5, 1.8, 250);
    }
  }

  // ---- Mermiler ----

  private mermiler(): void {
    const { t, d } = this;
    for (const iz of d.izler) t.cizgi(this.X(iz.x0), this.Y(iz.y0), this.X(iz.x1), this.Y(iz.y1), 0, ATES);
    for (const m of d.mermiler) {
      const x = this.X(m.x);
      const y = this.Y(m.y);
      if (x < -30 || x > EK + 30) continue;
      const hiz = Math.hypot(m.vx, m.vy) || 1;
      const ux = m.vx / hiz;
      const uy = m.vy / hiz;
      if (m.tip === M_KURSUN) {
        t.cizgi(x - ux * 11, y - uy * 11, x, y, 0, ATES);
        t.vurgu(x, y, AKKOR);
        t.vurgu(x - ux, y - uy, AKKOR);
      } else if (m.tip === M_ROKET || m.tip === M_DRPG) {
        t.kalin(x - ux * 8, y - uy * 8, x, y, 0);
        t.nokta(x + ux * 2, y + uy * 2, 0);
        // Kanatçık ve alev
        t.cizgi(x - ux * 8 - uy * 2, y - uy * 8 + ux * 2, x - ux * 8 + uy * 2, y - uy * 8 - ux * 2, 0);
        for (let k = 9; k < 14; k++) t.vurgu(x - ux * k, y - uy * k, k < 11 ? AKKOR : ATES);
      } else if (m.tip === M_DKURSUN) {
        t.kutu(x - 2, y - 2, 4, 4, 0);
        t.kutu(x - 1, y - 1, 2, 2, 0, KAN);
        t.cizgi(x - ux * 6, y - uy * 6, x - ux * 3, y - uy * 3, 0);
      } else if (m.tip === M_NISANCI) {
        t.cizgi(x - ux * 16, y - uy * 16, x, y, 0);
        t.cizgi(x - ux * 26, y - uy * 26, x - ux * 16, y - uy * 16, 170);
        t.vurgu(x, y, KAN);
      } else if (m.tip === M_TOP) {
        t.kalin(x - ux * 6, y - uy * 6, x, y, 0);
        t.vurgu(x - ux * 8, y - uy * 8, ATES);
      } else if (m.tip === M_HAVAN || m.tip === M_BOMBA || m.tip === M_OBOMBA) {
        // Bomba: şişkin gövde, kuyruk kanatçıkları
        for (let k = -4; k <= 4; k++) {
          const gen = k < -2 ? 1 : k > 3 ? 1 : 2;
          for (let n = -gen; n <= gen; n++) t.nokta(x + ux * k - uy * n, y + uy * k + ux * n, 0);
        }
        t.cizgi(x - ux * 7 - uy * 3, y - uy * 7 + ux * 3, x - ux * 7 + uy * 3, y - uy * 7 - ux * 3, 0);
        t.cizgi(x - ux * 5, y - uy * 5, x - ux * 7, y - uy * 7, 0);
        if (m.tip === M_OBOMBA) t.nokta(x - uy, y + ux, 254);
      }
    }
    // Uçaksavar uyarısı: daralan kesik halka ve artı
    for (const f of d.flaklar) {
      const x = this.X(f.x);
      const y = this.Y(f.y);
      const r = (19 + (1 - f.t / 0.95) * 16) * K;
      t.halka(x, y, r, 0, 2);
      t.halka(x, y, r + 1, 0, 2);
      t.cizgi(x - 5, y, x + 5, y, 0, KAN);
      t.cizgi(x, y - 5, x, y + 5, 0, KAN);
    }
  }

  // ---- Oyuncu helikopteri ve sandıklar ----

  private heli(): void {
    const { t, d } = this;
    const h = d.heli;
    // Sandıklar (halat helikopterin altında kalsın diye önce)
    for (const s of d.sandiklar) {
      const x = this.X(s.x);
      const y = this.Y(s.y);
      if (s.cekiliyor && !h.patladi) {
        // Halat: hafif sarkık
        const hx = this.X(h.x);
        const hy = this.Y(h.y) + 12;
        for (let k = 0; k <= 16; k++) {
          const u = k / 16;
          t.nokta(hx + (x - hx) * u + Math.sin(u * Math.PI) * Math.sin(d.zaman * 6) * 2, hy + (y - 6 - hy) * u, 0);
        }
        t.kutu(x - 2, y - 9, 5, 3, 0); // kanca
      }
      if (s.parasut && s.yerde <= 0 && !s.cekiliyor) {
        // Paraşüt: dilimli kubbe
        for (let k = -16; k <= 16; k++) {
          const ust = y - 36 - Math.sqrt(Math.max(0, 256 - k * k)) * 0.75;
          const dilim = Math.floor((k + 16) / 6.6) % 2 === 0;
          for (let f = Math.round(ust) + 1; f < y - 35; f++) t.nokta(x + k, f, dilim ? 250 : 200);
          t.nokta(x + k, ust, 0);
          t.nokta(x + k, y - 35, 0);
        }
        for (const k of [-16, -8, 0, 8, 16]) t.cizgi(x + k, y - 35, x + Math.sign(k) * 5, y - 7, 0);
      }
      if (s.yerde > 17 && Math.floor(d.zaman * 6) % 2 !== 0) continue;
      if (s.tip === O_TAMIR) {
        t.ciz(SPR_SANDIK, x - 8, y - 7);
        continue;
      }
      // Güçlendirme sandığı: beyaz kutu, üstünde simge, çevresinde yanıp sönen çerçeve
      const by = y - 9 + Math.round(Math.sin(d.zaman * 5 + s.x) * 2);
      t.kutu(x - 11, by - 1, 23, 19, 0);
      t.kutu(x - 10, by, 21, 17, 254);
      t.kutu(x - 10, by + 5, 21, 1, 200);
      t.kutu(x - 10, by + 11, 21, 1, 200);
      if (Math.floor(d.zaman * 4) % 2 === 0) t.cerceve(x - 14, by - 4, 29, 25, 0);
      if (s.tip === O_CIFT) t.yazi('x2', x + 1, by + 4, { hiza: 0, olcek: 2 });
      else if (s.tip === O_HIZ) t.yazi('>>', x + 1, by + 4, { hiza: 0, olcek: 2 });
      else {
        t.daire(x, by + 10, 5, 0);
        t.kalin(x + 3, by + 5, x + 6, by + 2, 0);
        t.vurgu(x + 7, by + 1, ATES);
        t.vurgu(x + 8, by + 1, AKKOR);
        t.nokta(x - 2, by + 8, 254);
      }
    }

    if (h.patladi) return;
    const x = this.X(h.x);
    const y = this.Y(h.y);
    // Alçakta uçarken pervane rüzgârı yerden toz kaldırır
    const yukseklik = d.yerY(h.x) - h.y;
    if (yukseklik < 46 && !h.olu) {
      const gy = this.Y(d.yerY(h.x));
      const guc = (1 - yukseklik / 46) * 0.5;
      for (let k = 0; k < 5; k++) {
        const u = kes(k, Math.floor(d.zaman * 12));
        const yan = (k % 2 ? 1 : -1) * (14 + u * 44);
        t.leke(x + yan, gy - 3 - u * 6, 6 + u * 5, guc, 214);
      }
    }
    const vurulmus = h.darbe > 0 && Math.floor(d.zaman * 30) % 2 === 0;
    const N = HELI_N;
    t.cizDon(SPR_HELI, x, y, h.egim, h.yon < 0, N.ox, N.oy, vurulmus ? 255 : 0);
    const [mx, my] = this.yerel(x, y, h.egim, h.yon, N.direk[0] - N.ox, N.direk[1] - N.oy);
    this.pervane(mx, my, h.egim, 48);
    // Kuyruk pervanesi
    const [kx, ky] = this.yerel(x, y, h.egim, h.yon, N.kuyruk[0] - N.ox, N.kuyruk[1] - N.oy);
    const ka = d.zaman * 40;
    t.cizgi(kx - Math.cos(ka) * 6, ky - Math.sin(ka) * 6, kx + Math.cos(ka) * 6, ky + Math.sin(ka) * 6, 0);
    t.cizgi(kx - Math.cos(ka + 1.57) * 6, ky - Math.sin(ka + 1.57) * 6, kx + Math.cos(ka + 1.57) * 6, ky + Math.sin(ka + 1.57) * 6, 150);
    // Namlu alevi: yıldız biçimli parlama
    if (h.top > 0.07 && d.oyunda && !h.olu) {
      const [ax, ay] = this.yerel(x, y, h.egim, h.yon, N.namlu[0] - N.ox, N.namlu[1] - N.oy);
      const c = Math.cos(h.namlu);
      const s = Math.sin(h.namlu);
      t.daire(ax + c * 3, ay + s * 3, 3, 0, ATES);
      t.cizgi(ax, ay, ax + c * 9, ay + s * 9, 0, ATES);
      t.cizgi(ax + c * 3 - s * 4, ay + s * 3 + c * 4, ax + c * 3 + s * 4, ay + s * 3 - c * 4, 0, ATES);
      t.vurgu(ax + c * 3, ay + s * 3, AKKOR);
      t.vurgu(ax + c * 4, ay + s * 4, AKKOR);
    }
  }

  // ---- Patlamalar ve parçalar ----

  private efektler(): void {
    const { t, d } = this;
    const P = d.parcalar;
    // Önce duman ve toz (arkada), sonra ateş ve katı parçalar
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (p.tip !== P_DUMAN && p.tip !== P_TOZ) continue;
      const x = this.X(p.x);
      if (x < -40 || x > EK + 40) continue;
      const k = p.omur / p.omur0;
      if (p.tip === P_DUMAN) t.leke(x, this.Y(p.y), p.boy * K, Math.min(0.9, k * 1.3), 26);
      else t.leke(x, this.Y(p.y), p.boy * K, Math.min(0.6, k * 0.8), 214);
    }
    for (const e of d.patlamalar) {
      const x = this.X(e.x);
      const y = this.Y(e.y);
      const r = e.r * K;
      const k = e.t / 0.55;
      if (e.t < 0.05) t.daire(x, y, r * 0.8, 0, AKKOR);
      else if (e.t < 0.3) {
        // Ateş topu: üst üste binen topaklar, ortası akkor
        const u = e.t / 0.3;
        const tohum = e.x * 0.37 + e.y;
        for (let n = 0; n < 9; n++) {
          const a = n * 0.7 + tohum;
          const uz = r * (0.15 + 0.5 * u) * (0.5 + kes(n, tohum));
          t.daire(x + Math.cos(a) * uz, y + Math.sin(a) * uz * 0.8 - u * r * 0.25, r * (0.26 + 0.22 * kes(tohum, n)) * (1 - u * 0.4), 0, ATES);
        }
        for (let n = 0; n < 5; n++) {
          const a = n * 1.3 + tohum;
          const uz = r * 0.3 * u;
          t.daire(x + Math.cos(a) * uz, y + Math.sin(a) * uz - u * r * 0.25, r * 0.24 * (1 - u), 0, AKKOR);
        }
      }
      if (e.t < 0.36) {
        t.halka(x, y, r * (0.9 + k * 3), 0, 2);
        t.halka(x, y, r * (0.9 + k * 3) - 1, 0, 3);
      }
    }
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const tip = p.tip;
      if (tip === P_DUMAN || tip === P_TOZ) continue;
      const x = this.X(p.x);
      if (x < -30 || x > EK + 30) continue;
      const y = this.Y(p.y);
      if (tip === P_KAN) {
        t.vurgu(x, y, KAN);
        t.vurgu(x + 1, y, KAN);
        t.vurgu(x - p.vx * 0.02, y - p.vy * 0.02, KAN);
      } else if (tip === P_ATES) {
        const k = p.omur / p.omur0;
        t.daire(x, y, p.boy * K * k, 0, ATES);
        if (k > 0.55) t.daire(x, y, p.boy * K * k * 0.45, 0, AKKOR);
      } else if (tip === P_KIVILCIM) {
        const renk = p.omur > p.omur0 * 0.5 ? AKKOR : ATES;
        t.vurgu(x, y, renk);
        t.vurgu(x - p.vx * 0.012, y - p.vy * 0.012, ATES);
      } else if (tip === P_TOPRAK) {
        t.nokta(x, y, 0);
        if (p.boy > 0.85) t.kutu(x, y, 2, 2, p.boy > 1 ? 64 : 0);
      } else if (tip === P_ENKAZ) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        const c = Math.cos(p.aci) * p.boy * K;
        const s = Math.sin(p.aci) * p.boy * K;
        t.kalin(x - c, y - 2 - s, x + c, y - 2 + s, 0);
        t.nokta(x - s * 0.4, y - 2 + c * 0.4, 0);
      } else if (tip === P_KOVAN) {
        t.cizgi(x, y, x + 1, y + 1, 85);
      } else if (tip === P_KULE) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        t.cizDon(SPR_KULE, x, y - 5, p.aci, false);
      } else if (tip === P_TUGLA) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        // Dönen tuğla: yatayken 4×2, dikken 2×4; koyu gri kenar, açık yüz
        const yatay = Math.abs(Math.cos(p.aci)) > 0.7;
        const tw = yatay ? 4 : 2;
        const th = yatay ? 2 : 4;
        t.kutu(x - 2, y - th - 1, tw + 1, th + 1, 42);
        t.kutu(x - 2, y - th - 1, tw, th, ((p.aci * 3) | 0) % 2 ? 170 : 213);
      } else if (tip === P_KASK) {
        if (p.omur < 1 && Math.floor(d.zaman * 10) % 2 === 0) continue;
        t.cizDon(SPR_KASK, x, y - 3, p.aci, false);
      }
    }
  }

  /** Genişliğe sığana kadar ölçeği küçülterek yazar. */
  private sigdir(metin: string, x: number, y: number, sec: YaziSecenek, enCok = EK - 12): void {
    let olcek = sec.olcek ?? 3;
    while (olcek > 1 && yaziGenislik(metin, olcek) > enCok) olcek--;
    this.t.yazi(metin, x, y, { ...sec, olcek });
  }

  private yazilar(): void {
    const { t, d } = this;
    for (const s of d.sozler) {
      if (s.t > 1 && Math.floor(s.t * 18) % 2 === 0) continue;
      const yari = yaziGenislik(s.metin, 3) / 2 + 4;
      const x = sinirla(this.X(s.x), yari, EK - yari);
      t.yazi(s.metin, x, this.Y(s.y), { hiza: 0, olcek: 3, kenar: 255, vurgu: s.vurgu ? KAN : 0 });
    }
  }

  // ---- Arayüz ----

  private cubuk(x: number, y: number, oran: number): void {
    const t = this.t;
    t.kutu(x, y, 86, 11, 0);
    t.kutu(x + 1, y + 1, 84, 9, 255);
    const w = Math.round(82 * sinirla(oran, 0, 1));
    if (w > 0) t.kutu(x + 2, y + 2, w, 7, 0, oran < 0.3 ? KAN : 0);
    for (let k = 1; k < 4; k++) t.kutu(x + 1 + k * 21, y + 1, 1, 2, 128);
  }

  private sesSimge(a: Arayuz): void {
    const t = this.t;
    const b = sesDugme();
    const x = b.x + 2;
    const y = b.y + 3;
    t.kutu(x, y + 5, 6, 7, 0);
    for (let k = 0; k < 7; k++) t.kutu(x + 6 + k, y + 5 - k, 1, 7 + k * 2, 0);
    if (a.sesAcik) {
      t.kalin(x + 17, y + 4, x + 17, y + 13, 0);
      t.kalin(x + 22, y + 1, x + 22, y + 16, 0);
    } else {
      t.kalin(x + 16, y + 4, x + 24, y + 13, 0);
      t.kalin(x + 24, y + 4, x + 16, y + 13, 0);
    }
  }

  /** Sağ alttaki bomba düğmesi ve üstündeki bomba sayısı. */
  private bombaHud(): void {
    const { t, d } = this;
    const b = bombaDugme(t.h);
    const var_ = d.bomba.adet > 0;
    t.daire(b.x, b.y, b.r, 0);
    t.daire(b.x, b.y, b.r - 3, var_ ? 255 : 128);
    t.halka(b.x, b.y, b.r - 6, var_ ? 213 : 100);
    // Bomba simgesi
    t.daire(b.x - 2, b.y + 3, 11, 0);
    t.kutu(b.x + 4, b.y - 11, 5, 6, 0);
    t.kalin(b.x + 8, b.y - 12, b.x + 13, b.y - 17, 0);
    if (var_) {
      const k = Math.floor(d.zaman * 10) % 2;
      t.daire(b.x + 14, b.y - 18 - k, 2, 0, ATES);
      t.vurgu(b.x + 14, b.y - 18 - k, AKKOR);
    }
    t.kutu(b.x - 7, b.y - 2, 2, 3, 254);
    t.kutu(b.x - 5, b.y - 4, 3, 2, 254);
    // Bomba sayısı: düğmenin üstünde küçük kutular; sıradaki dolarken yükselir
    const n = d.bomba.enCok;
    const x0 = b.x - Math.round((n * 9 - 3) / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 9;
      const y = b.y - b.r - 16;
      t.kutu(x - 1, y - 1, 8, 12, 0);
      t.kutu(x, y, 6, 10, i < d.bomba.adet ? 0 : 255, i < d.bomba.adet && d.guc.bomba > 0 ? KAN : 0);
      if (i === d.bomba.adet) {
        const dolu = Math.round(d.bomba.dolum * 10);
        if (dolu > 0) t.kutu(x, y + 10 - dolu, 6, dolu, 128);
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
    let y = 58;
    for (const [ad, kalan, sure] of liste) {
      if (kalan >= 4 || Math.floor(d.zaman * 6) % 2 !== 0) {
        t.yazi(ad, 12, y, { olcek: 3, kenar: 255 });
        t.kutu(12, y + 18, Math.round((kalan / sure) * 76), 3, 0, KAN);
      }
      y += 26;
    }
  }

  private hud(a: Arayuz): void {
    const { t, d } = this;
    t.ciz(SPR_SIMGE_HELI, 10, 14);
    this.cubuk(36, 14, d.heli.can / 100);
    t.ciz(SPR_SIMGE_SIPER, 10, 33);
    this.cubuk(36, 33, d.siperCan / 100);
    t.yazi(String(d.skor), EK - 10, 12, { hiza: 1, olcek: 4, kenar: 255 });
    if (d.seri > 1) {
      const kat = (1 + Math.min(d.seri - 1, 20) * 0.1).toFixed(1);
      t.yazi(`x${kat}`, EK - 46, 45, { hiza: 1, olcek: 3, kenar: 255, vurgu: KAN });
    }
    if (d.dalga > 0) t.yazi(`DALGA ${d.dalga}`, EK / 2 + 14, 15, { hiza: 0, olcek: 3, kenar: 255 });
    this.sesSimge(a);

    if (a.duyuru && a.duyuruT < 2.4 && (a.duyuruT > 0.4 || Math.floor(a.duyuruT * 14) % 2 === 0)) {
      this.sigdir(a.duyuru, EK / 2, Math.round(t.h * 0.26), { hiza: 0, olcek: 6, kenar: 255 });
    }
    // Uçak uyarısı: geleceği yükseklikte, sağ kenarda
    if (d.jetUyari > 0 && Math.floor(d.zaman * 8) % 2 === 0) {
      t.yazi('< UÇAK', EK - 10, this.Y(d.jetUyariY) - 8, { hiza: 1, olcek: 3, kenar: 255, vurgu: KAN });
    }
    // Ekran dışındaki sandık: kenarda ok
    for (const s of d.sandiklar) {
      const x = this.X(s.x);
      if (x >= 0 && x <= EK) continue;
      const sol = x < 0;
      const y = sinirla(this.Y(s.y) - 10, 80, t.h - 140);
      if (Math.floor(d.zaman * 5) % 2 === 0) t.yazi(sol ? '< SANDIK' : 'SANDIK >', sol ? 8 : EK - 8, y, { hiza: sol ? -1 : 1, olcek: 2, kenar: 255 });
    }
    if (a.ipucuT < 7 && a.durum === 'oyun') {
      const y = t.h - 62;
      t.yazi('SÜRÜKLE: UÇ', 12, y, { olcek: 3, ton: 240, kenar: 0 });
      t.yazi('BOMBA: SAĞ ALT', 12, y + 24, { olcek: 3, ton: 240, kenar: 0 });
    }
    this.bombaHud();
    this.gucHud();
  }

  private logo(y: number): void {
    const t = this.t;
    const olcek = 8;
    const adim = 6 * olcek;
    const toplam = LOGO.length * adim - olcek;
    const x0 = Math.round(EK / 2 - toplam / 2);
    for (const [ofs, ton] of [[4, 170], [0, 0]] as const) {
      LOGO.forEach((harf, n) => {
        harf.forEach((satir, gy) => {
          for (let gx = 0; gx < satir.length; gx++) {
            if (satir[gx] === '#') t.kutu(x0 + n * adim + gx * olcek + ofs, y + gy * olcek + ofs, olcek, olcek, ton);
          }
        });
      });
    }
    // Kurşun delikleri (çevresi çatlak) ve sızan kan
    for (let k = 0; k < 11; k++) {
      const px = x0 + 8 + Math.round(kes(k, 21) * (toplam - 16));
      const py = y + 5 + Math.round(kes(k, 22) * 46);
      t.daire(px, py, 2.2, 250);
      t.nokta(px + 3, py - 2, 250);
      t.nokta(px - 3, py + 1, 250);
    }
    const kx = x0 + adim * 2 + 4;
    const akis = 22 + Math.round(Math.sin(this.d.zaman * 1.5) * 4);
    for (let k = 0; k < akis; k++) {
      t.vurgu(kx, y + 56 + k, KAN);
      t.vurgu(kx + 1, y + 56 + k, KAN);
    }
    t.kutu(kx - 2, y + 56, 6, 2, 0, KAN);
    t.daire(kx + 0.5, y + 56 + akis, 2, 0, KAN);
    for (let k = 0; k < 10; k++) t.vurgu(kx + 19, y + 56 + k, KAN);
  }

  private baslik(a: Arayuz): void {
    const { t, d } = this;
    const y = Math.round(t.h * 0.2);
    this.logo(y);
    t.yazi('SİPERİ KORU', EK / 2, y + 92, { hiza: 0, olcek: 3, kenar: 255 });
    if (Math.floor(d.zaman * 1.6) % 2 === 0) t.yazi('DOKUN VE BAŞLA', EK / 2, Math.round(t.h * 0.47), { hiza: 0, olcek: 4, kenar: 255 });
    const y2 = t.h - 96;
    this.sigdir('SÜRÜKLE: HELİKOPTER UÇAR', EK / 2, y2, { hiza: 0, ton: 240, kenar: 0 });
    this.sigdir('BOMBA: SAĞ ALTTAKİ DÜĞME', EK / 2, y2 + 22, { hiza: 0, ton: 240, kenar: 0 });
    this.sigdir('TOPRAĞI KAZ, SANDIK BUL', EK / 2, y2 + 44, { hiza: 0, ton: 240, kenar: 0 });
    if (a.rekor > 0) t.yazi(`REKOR ${a.rekor}`, EK / 2, y2 + 70, { hiza: 0, olcek: 3, ton: 254, kenar: 0 });
    this.sesSimge(a);
  }

  private sonuc(a: Arayuz): void {
    const { t, d } = this;
    const w = 320;
    const h = 344;
    const x = Math.round(EK / 2 - w / 2);
    const y = Math.round(t.h * 0.5 - h / 2);
    t.kutu(x + 7, y + 7, w, h, 64);
    t.kutu(x, y, w, h, 0);
    t.kutu(x + 3, y + 3, w - 6, h - 6, 255);
    t.cerceve(x + 8, y + 8, w - 16, h - 16, 0);
    let cy = y + 30;
    t.yazi(d.bitisNeden === 'siper' ? 'SİPER DÜŞTÜ' : 'DÜŞTÜN', EK / 2, cy, { hiza: 0, olcek: 4 });
    cy += 50;
    const satirlar: [string, string][] = [
      ['DALGA', String(d.dalga)],
      ['PİYADE', String(d.olu.piyade)],
      ['ARAÇ', String(d.olu.arac)],
      ['HAVA', String(d.olu.hava)],
    ];
    const gorunen = Math.floor(a.sonucT * 7);
    satirlar.forEach(([ad, deger], i) => {
      if (i > gorunen) return;
      t.yazi(ad, x + 44, cy, { olcek: 3 });
      t.yazi(deger, x + w - 44, cy, { hiza: 1, olcek: 3 });
      cy += 28;
    });
    if (gorunen >= satirlar.length) {
      cy = y + h - 140;
      for (let k = x + 36; k < x + w - 36; k += 4) t.kutu(k, cy, 2, 1, 0);
      t.yazi(String(d.skor), EK / 2, cy + 18, { hiza: 0, olcek: 7, vurgu: a.yeniRekor ? KAN : 0 });
      t.yazi(a.yeniRekor ? 'YENİ REKOR!' : `REKOR ${a.rekor}`, EK / 2, cy + 72, { hiza: 0, olcek: 3 });
    }
    if (a.sonucT > 1.6 && Math.floor(d.zaman * 1.6) % 2 === 0) t.yazi('DOKUN: YENİDEN', EK / 2, y + h - 36, { hiza: 0, olcek: 3 });
  }
}

void [M_BOMBA, M_HAVAN, P_KAN];
