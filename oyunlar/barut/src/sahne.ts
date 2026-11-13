/**
 * Sahne çizimi. Simülasyon dünya biriminde (genişlik G = 240) çalışır; çizim
 * K = 1,5 katı çözünürlüktedir (ekran 360 piksel). Dünya → ekran: X(), Y().
 * Arka plan katmanları ve toprak dokusu açılışta bir kez üretilir.
 */
import {
  BAGLAR, DUNYA_G, Dunya, G, G_MAYIN, KOS, M_BOMBA, M_DKURSUN, M_DRPG, M_HAVAN, M_KURSUN, M_OBOMBA, M_ROKET, M_TOP,
  O_CIFT, O_HIZ, O_TAMIR, PANIK, P_ATES, P_DUMAN, P_ENKAZ, P_KAN, P_KASK, P_KIVILCIM, P_KOVAN, P_KULE, P_TOPRAK,
  P_TOZ, SIPER_ON, SIPER_X, T_HELI, T_JET, T_KAMYON, T_ROKET, T_TANK, T_UCAKSAVAR, YANIYOR,
  type Asker,
} from './dunya';
import {
  SPR_AGAC, SPR_DHELI, SPR_GOMU, SPR_HELI, SPR_JET, SPR_KAMYON, SPR_KASK, SPR_KIRPI, SPR_KULE, SPR_MAYIN,
  SPR_NAKLIYE, SPR_SANDIK, SPR_SIMGE_HELI, SPR_SIMGE_SIPER, SPR_TANK, SPR_UCAKSAVAR,
} from './sprite';
import { AKKOR, ATES, KAN, KURU_KAN, Tuval, yaziGenislik, type YaziSecenek } from './tuval';

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

/** Zemindeki sabit süsler: [dünya x, tip] (0 tank engeli, 1 kuru ağaç). */
const SUSLER: [number, number][] = [
  [196, 0], [232, 1], [286, 0], [300, 0], [362, 1], [410, 0], [462, 1], [500, 0], [514, 0], [560, 1],
];

/** Uzak katman: tepeler ve soluk bir şehir silueti. 0 = saydam. */
function uzakKatman(): Uint8Array {
  const t = new Tuval(UW, UH);
  t.g.fill(0);
  const sirt = (x: number): number => UH - 40 - 18 * Math.sin(x * 0.011 + 0.6) - 9 * Math.sin(x * 0.029 + 2);
  for (let x = 0; x < UW; x++) for (let y = Math.round(sirt(x)); y < UH; y++) t.g[y * UW + x] = 234;
  // Şehir: sıkışık, farklı boylarda soluk yapılar
  let x = 2;
  let no = 0;
  while (x < UW - 8) {
    no++;
    const w = 10 + Math.round(kes(no, 2) * 22);
    const h = 18 + Math.round(kes(no, 3) * kes(no, 7) * 150);
    const y = UH - 22 - h;
    t.kutu(x, y, w, h + 30, 213);
    t.kutu(x + w - 2, y, 2, h + 30, 200);
    // Pencere noktaları
    for (let wy = y + 4; wy < y + h - 2; wy += 6) {
      for (let wx = x + 2; wx < x + w - 3; wx += 4) if (kes(wx, wy) < 0.5) t.kutu(wx, wy, 2, 3, 196);
    }
    const tur = kes(no, 4);
    if (tur < 0.2) {
      // Baca ve duman
      t.kutu(x + 2, y - 30, 4, 30, 213);
      for (let k = 0; k < 7; k++) t.daire(x + 6 + k * 7, y - 34 - k * 4, 3.5 + k * 1.5, 238);
    } else if (tur < 0.4) {
      t.cizgi(x + w / 2, y, x + w / 2, y - 14, 213); // anten
      t.cizgi(x + w / 2 - 3, y - 9, x + w / 2 + 3, y - 9, 213);
    } else if (tur < 0.55) {
      t.kutu(x + 2, y - 6, 7, 6, 213); // su deposu
      t.cizgi(x + 2, y - 7, x + 8, y - 7, 200);
    } else if (tur < 0.7 && h > 50) {
      // Yıkık köşe
      for (let k = 0; k < 9; k++) t.kutu(x + w - 6 + Math.round(kes(k, no) * 4), y + k * 2 - 2, 8, 3, 0);
    }
    x += w + (kes(no, 5) < 0.3 ? 8 + Math.round(kes(no, 6) * 20) : 1);
  }
  // Yakın sırt: şehrin eteğini örter
  for (let xx = 0; xx < UW; xx++) {
    const b = UH - 20 - 9 * Math.sin(xx * 0.019 + 3) - 5 * Math.sin(xx * 0.051);
    for (let y = Math.round(b); y < UH; y++) t.g[y * UW + xx] = 224;
  }
  return t.g;
}

/** Orta katman: bombalanmış binalar, direkler, kuru ağaçlar, enkaz. 0 = saydam. */
function ortaKatman(): Uint8Array {
  const t = new Tuval(OW, OH);
  t.g.fill(0);
  const DUVAR = 170;
  const GOLGE = 128;
  const taban = (x: number): number => OH - 13 - 7 * Math.sin(x * 0.02 + 1) - 4 * Math.sin(x * 0.055 + 2);
  const al = (x: number, y: number): number => (x < 0 || y < 0 || x >= OW || y >= OH ? 0 : t.g[y * OW + x]);
  const koy = (x: number, y: number, d: number): void => {
    if (x >= 0 && y >= 0 && x < OW && y < OH) t.g[y * OW + x] = d;
  };
  /** Yalnız duvarın olduğu yere boyar. */
  const duvara = (x: number, y: number, d: number): void => {
    if (al(x, y) === DUVAR) koy(x, y, d);
  };

  let bx = 34;
  let no = 0;
  while (bx < OW - 70) {
    no++;
    const w = 50 + Math.round(kes(no, 1) * 66);
    const h = 96 + Math.round(kes(no, 2) * 270);
    const by = Math.round(taban(bx + w / 2)) + 5;
    const sol = kes(no, 3) < 0.5;
    const yikik = 0.2 + kes(no, 4) * 0.65;
    const ustler: number[] = [];
    for (let c = 0; c < w; c++) {
      // Kırık üst kenar: bir köşeden basamak basamak çökmüş
      const u = sol ? c / w : 1 - c / w;
      const cok = Math.max(0, yikik - u) / yikik;
      const basamak = Math.floor(cok * 8) / 8;
      const ust = by - h + Math.round(basamak * h * 0.72 + (cok > 0 ? (kes(Math.floor(c / 4) + no * 9, 5) - 0.5) * 7 : 0));
      ustler.push(ust);
      for (let y = Math.max(0, ust); y < by; y++) koy(bx + c, y, c >= w - 5 ? GOLGE : DUVAR);
    }
    // Sağlam kısmın çatısı: korkuluk, su deposu, anten
    const saglam = ustler.findIndex((u) => u === by - h);
    if (saglam >= 0) {
      let son = saglam;
      while (son < w && ustler[son] === by - h) son++;
      for (let c = saglam; c < son; c++) {
        koy(bx + c, by - h - 1, GOLGE);
        koy(bx + c, by - h - 2, c % 6 < 4 ? DUVAR : 0);
      }
      if (son - saglam > 24) {
        const tx = bx + saglam + 6 + Math.round(kes(no, 30) * (son - saglam - 22));
        if (kes(no, 31) < 0.6) {
          t.kutu(tx, by - h - 16, 12, 9, GOLGE);
          t.kutu(tx + 1, by - h - 15, 10, 2, 150);
          t.cizgi(tx + 1, by - h - 7, tx + 1, by - h - 2, GOLGE);
          t.cizgi(tx + 10, by - h - 7, tx + 10, by - h - 2, GOLGE);
        } else {
          t.cizgi(tx, by - h - 2, tx, by - h - 26, GOLGE);
          t.cizgi(tx - 5, by - h - 19, tx + 5, by - h - 19, GOLGE);
          t.cizgi(tx - 3, by - h - 23, tx + 3, by - h - 23, GOLGE);
        }
      }
    }
    // Kırık kenarda demirler ve açıkta kalan kat döşemeleri
    for (let c = 1; c < w - 1; c++) {
      const u = ustler[c];
      if (u > by - h) {
        if (al(bx + c, u) === DUVAR) koy(bx + c, u, GOLGE);
        if (kes(c + no * 5, 40) < 0.13) {
          const uz = 4 + Math.round(kes(c, no + 41) * 8);
          const yat = Math.round((kes(c, no + 42) - 0.5) * 6);
          t.cizgi(bx + c, u - 1, bx + c + yat, u - uz, 100);
        }
      }
    }
    // Katlar ve pencereler
    const KAT = 26;
    for (let ky = by - 18; ky > by - h + 10; ky -= KAT) {
      for (let c = 0; c < w - 5; c++) duvara(bx + c, ky + 14, 150); // kat silmesi
      const balkon = kes(no * 3, ky) < 0.3;
      for (let c = 8; c < w - 16; c += 17) {
        const px = bx + c;
        const tur = kes(c + no * 3, ky);
        if (al(px, ky) !== DUVAR || al(px + 8, ky - 12) !== DUVAR) continue;
        if (tur < 0.09) {
          // Top yemiş duvar: köşeli, düzensiz delik. Çoğunun içi karanlık oda,
          // bazısından gök görünür; altında açıkta kalan döşeme.
          const acik = kes(c, ky + 7) < 0.35;
          const gen = 7 + kes(c, ky + 8) * 5;
          const boy = 9 + kes(c, ky + 9) * 5;
          for (let yy = -20; yy <= 6; yy++) {
            for (let xx = -8; xx <= 16; xx++) {
              const uz = Math.max(Math.abs(xx - 4) / gen, Math.abs(yy + 7) / boy) + (kes(Math.floor((xx + c) / 2), Math.floor((yy + ky) / 2)) - 0.5) * 0.5;
              if (uz < 0.8) duvara(px + xx, ky + yy, acik ? 0 : 85);
              else if (uz < 1) duvara(px + xx, ky + yy, GOLGE);
            }
          }
          if (!acik) for (let xx = -2; xx < 11; xx++) if (al(px + xx, ky + 1) === 85) koy(px + xx, ky + 1, 150);
          continue;
        }
        // Çerçeve + cam
        for (let yy = 0; yy < 13; yy++) for (let xx = 0; xx < 9; xx++) duvara(px + xx, ky - yy, tur < 0.34 ? 213 : 85);
        for (let xx = -1; xx < 10; xx++) duvara(px + xx, ky + 1, GOLGE); // denizlik
        for (let xx = -1; xx < 10; xx++) duvara(px + xx, ky - 13, 150); // lento
        if (tur >= 0.34) {
          if (tur < 0.5) {
            // Tahtayla kapatılmış
            for (let k = 0; k < 3; k++) for (let xx = 0; xx < 9; xx++) koy(px + xx, ky - 2 - k * 4, 150);
          } else if (tur < 0.8) {
            // Kayıt: artı
            for (let yy = 0; yy < 13; yy++) koy(px + 4, ky - yy, 128);
            for (let xx = 0; xx < 9; xx++) koy(px + xx, ky - 6, 128);
          } else {
            // Kırık cam: köşede açıklık
            for (let k = 0; k < 5; k++) for (let xx = 0; xx < 5 - k; xx++) koy(px + xx, ky - 12 + k, 128);
          }
          // Üstünde is lekesi
          if (kes(c, ky + no) < 0.18) {
            for (let yy = 14; yy < 30; yy++) {
              for (let xx = 1; xx < 8; xx++) if (kes(px + xx, ky - yy) < 1 - (yy - 14) / 16) duvara(px + xx, ky - yy, 150);
            }
          }
        }
        if (balkon && tur >= 0.09) {
          // Balkon: döşeme ve korkuluk
          for (let xx = -3; xx < 12; xx++) koy(px + xx, ky + 3, GOLGE);
          for (let xx = -3; xx < 12; xx += 2) for (let yy = 0; yy < 5; yy++) duvara(px + xx, ky + 2 - yy, GOLGE);
          for (let xx = -3; xx < 12; xx++) duvara(px + xx, ky - 3, GOLGE);
        }
      }
    }
    // Çatlaklar
    for (let k = 0; k < 3; k++) {
      let cx = bx + 6 + Math.round(kes(no, 50 + k) * (w - 16));
      let cy = by - 20 - Math.round(kes(no, 53 + k) * (h - 50));
      for (let n = 0; n < 16; n++) {
        duvara(cx, cy, GOLGE);
        cy += 1;
        duvara(cx, cy, GOLGE);
        cx += kes(n + k, no) < 0.5 ? 1 : -1;
        cy += 1;
      }
    }
    // Yağmur borusu
    if (kes(no, 60) < 0.6) for (let y = by - h + 4; y < by; y++) duvara(bx + 3, y, y % 14 === 0 ? 100 : GOLGE);
    // Giriş: kapı ve tente
    const kx = bx + Math.round(w * (0.3 + kes(no, 61) * 0.3));
    for (let yy = 0; yy < 20; yy++) for (let xx = 0; xx < 11; xx++) duvara(kx + xx, by - 1 - yy, 85);
    for (let xx = -2; xx < 13; xx++) duvara(kx + xx, by - 22, GOLGE);
    // Enkaz yığını
    for (let k = 0; k < 16; k++) {
      const rx = bx + Math.round((sol ? 0 : w) + (kes(no, k + 20) - 0.5) * 44);
      const rw = 4 + Math.round(kes(k, no) * 9);
      const rh = 3 + Math.round(kes(k, no + 2) * 5);
      const ry = by - Math.round(kes(k, no + 1) * 10) - rh + 4;
      t.kutu(rx, ry, rw, rh, kes(k, 7) < 0.5 ? 150 : GOLGE);
      t.kutu(rx, ry, rw, 1, kes(k, 7) < 0.5 ? DUVAR : 150);
    }
    bx += w + 18 + Math.round(kes(no, 6) * 76);
  }
  // Zemin şeridi
  for (let x = 0; x < OW; x++) {
    const ty = Math.round(taban(x));
    for (let y = ty; y < OH; y++) koy(x, y, y === ty ? GOLGE : 150);
  }
  // Direkler ve teller
  let once = -1;
  let onceY = 0;
  for (let x = 20; x < OW; x += 110 + Math.round(kes(x, 8) * 44)) {
    const by = Math.round(taban(x));
    const egik = Math.round((kes(x, 9) - 0.5) * 10);
    t.kalin(x, by, x + egik, by - 72, 100);
    t.cizgi(x + egik - 8, by - 65, x + egik + 8, by - 66, 100);
    t.cizgi(x + egik - 6, by - 58, x + egik + 6, by - 59, 100);
    t.nokta(x + egik - 8, by - 67, 100);
    t.nokta(x + egik + 8, by - 68, 100);
    if (once >= 0 && kes(x, 10) < 0.8) {
      for (let k = 0; k <= 60; k++) {
        const u = k / 60;
        t.nokta(once + (x + egik - once) * u, onceY + (by - 66 - onceY) * u + Math.sin(u * Math.PI) * 14, 128);
      }
    } else if (once >= 0) {
      // Kopmuş tel: direkten sarkar
      for (let k = 0; k < 26; k++) t.nokta(once + k * 0.5 + Math.sin(k * 0.3) * 2, onceY + k * 1.6, 128);
    }
    once = x + egik + 8;
    onceY = by - 67;
  }
  // Kuru ağaçlar
  const dal = (x: number, y: number, aci: number, uz: number, d: number): void => {
    const x1 = x + Math.cos(aci) * uz;
    const y1 = y + Math.sin(aci) * uz;
    t.cizgi(x, y, x1, y1, 112);
    if (d > 2) t.cizgi(x + 1, y, x1 + 1, y1, 112);
    if (d <= 0) return;
    dal(x1, y1, aci - 0.33 - kes(x, d) * 0.4, uz * 0.73, d - 1);
    dal(x1, y1, aci + 0.3 + kes(y, d) * 0.4, uz * 0.71, d - 1);
  };
  for (let x = 70; x < OW; x += 140 + Math.round(kes(x, 11) * 90)) dal(x, Math.round(taban(x)) + 2, -Math.PI / 2 + (kes(x, 12) - 0.5) * 0.3, 19, 5);
  // Yanmış araba iskeletleri
  for (let x = 150; x < OW; x += 260 + Math.round(kes(x, 13) * 120)) {
    const y = Math.round(taban(x)) + 1;
    t.kutu(x, y - 8, 30, 6, 112);
    t.kutu(x + 7, y - 14, 15, 6, 112);
    t.kutu(x + 9, y - 12, 5, 4, 0);
    t.kutu(x + 16, y - 12, 4, 4, 0);
    t.daire(x + 6, y - 2, 3, 112);
    t.daire(x + 24, y - 2, 3, 112);
  }
  return t.g;
}

export class Sahne {
  private uzak = uzakKatman();
  private orta = ortaKatman();
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
      const g = y < 70 ? 85 : y < 120 ? 85 - (y - 70) * 0.86 : 42;
      t.g.fill(Math.round(g), y * W, (y + 1) * W);
    }
    // Katman çizgileri: dalgalı, kesik
    for (const [derin, ton, dalga] of [[36, 64, 5], [70, 42, 7], [108, 20, 6], [150, 0, 8]] as const) {
      for (let x = 0; x < W; x++) {
        const y = Math.round(derin + dalga * Math.sin(x * 0.021 + derin) + 3 * Math.sin(x * 0.07 + derin * 2));
        if (kes(Math.floor(x / 7), derin) < 0.8) t.nokta(x, y, ton);
        if (kes(Math.floor(x / 13), derin + 1) < 0.25) t.nokta(x, y + 1, ton);
      }
    }
    // Taşlar
    for (let i = 0; i < 300; i++) {
      const x = Math.round(kes(i, 1) * W);
      const y = 24 + Math.round(kes(i, 2) * (H - 30));
      const rx = 1.5 + kes(i, 3) * 4;
      const ry = 1 + kes(i, 4) * 2.4;
      const koyu = y > 110;
      for (let yy = -4; yy <= 4; yy++) {
        for (let xx = -6; xx <= 6; xx++) {
          const u = (xx / rx) ** 2 + (yy / ry) ** 2;
          if (u > 1) continue;
          t.nokta(x + xx, y + yy, yy < -ry * 0.3 ? (koyu ? 100 : 150) : koyu ? 64 : 112);
        }
      }
    }
    for (let i = 0; i < 500; i++) t.nokta(kes(i, 5) * W, 18 + kes(i, 6) * (H - 20), kes(i, 7) < 0.5 ? 128 : 60);
    // Ağaç kökleri
    const kok = (x: number, y: number, aci: number, uz: number, d: number): void => {
      const x1 = x + Math.cos(aci) * uz;
      const y1 = y + Math.sin(aci) * uz;
      t.cizgi(x, y, x1, y1, 20);
      if (d <= 0) return;
      kok(x1, y1, aci - 0.5 - kes(x, d) * 0.4, uz * 0.75, d - 1);
      kok(x1, y1, aci + 0.45 + kes(y, d) * 0.4, uz * 0.7, d - 1);
    };
    for (const [sx, tip] of SUSLER) if (tip === 1) kok(sx * K, 22, Math.PI / 2, 12, 3);
    // Eski su borusu: kırık, eklemli
    const by = 86;
    for (let x = 250; x < 470; x++) {
      if (x > 352 && x < 368) continue;
      t.nokta(x, by - 3, 0);
      t.nokta(x, by + 3, 0);
      for (let k = -2; k <= 2; k++) t.nokta(x, by + k, k < 0 ? 150 : 112);
      if (x % 44 === 0) t.kutu(x - 1, by - 4, 4, 9, 0);
    }
    // Kemikler
    for (const [kx, ky] of [[620, 60], [140, 104], [780, 128]]) {
      t.cizgi(kx, ky, kx + 12, ky + 3, 200);
      t.daire(kx, ky, 1.6, 200);
      t.daire(kx + 12, ky + 3, 1.6, 200);
      for (let k = 0; k < 4; k++) t.cizgi(kx + 2 + k * 3, ky + 6 + (k % 2), kx + 4 + k * 3, ky + 11, 180);
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
      if (x < -110 || x > EK + 110) continue;
      if (o.tip === T_HELI) {
        t.cizDon(SPR_DHELI, x, y, o.aci, o.yon < 0, 33, 12);
        if (!o.dusuyor) {
          const [mx, my] = this.yerel(x, y, o.aci, o.yon, -2, -13);
          this.pervane(mx, my, o.aci, 34);
          const [kx, ky] = this.yerel(x, y, o.aci, o.yon, -30, -6);
          const ka = d.zaman * 38;
          t.cizgi(kx - Math.cos(ka) * 5, ky - Math.sin(ka) * 5, kx + Math.cos(ka) * 5, ky + Math.sin(ka) * 5, 0);
        }
      } else if (o.tip === T_JET) {
        t.cizDon(SPR_JET, x, y, o.dusuyor ? o.aci * 0.5 : 0, true, 38, 10);
        if (!o.dusuyor) {
          // Art yakıcı
          const uz = 7 + (Math.floor(d.zaman * 30) % 3) * 3;
          for (let k = 0; k < uz; k++) {
            const gen = Math.max(0, 2 - Math.floor(k / 3));
            for (let m = -gen; m <= gen; m++) t.vurgu(x + 37 + k, y + 1 + m, k < 3 ? AKKOR : ATES);
          }
        }
      } else {
        t.ciz(SPR_NAKLIYE, x - 44, y - 11);
        const p = Math.floor(d.zaman * 30) % 2 === 0 ? 9 : 4;
        t.cizgi(x + 7, y + 1 - p, x + 7, y + 1 + p, 60);
        t.cizgi(x + 8, y + 1 - 9, x + 8, y + 1 + 9, 200);
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
        else {
          const ty = y - ty0;
          t.g[i] = ty >= 0 && ty < TH ? this.toprak[ty * TW + tpx] : 85;
        }
      }
      // Kan: yüzeyde kırmızı, yoğunsa aşağı sızar
      if (kan > 30 && ys >= 0 && ys < H - 8) {
        const derin = 2 + (kan > 110 ? 1 : 0) + (kan > 190 ? 1 : 0) + (kan > 150 && kes(px, 3) < 0.25 ? 3 : 0);
        for (let k = 0; k < derin; k++) t.v[(ys + k) * W + x] = k < 3 ? KAN : KURU_KAN;
      }
      // Ot, çakıl
      if (is < 40 && les < 30 && wi > SIPER_ON && ys > 6) {
        const h = kes(px, 7);
        if (h < 0.2) {
          const boy = 1 + Math.floor(kes(px, 8) * 5);
          const egik = kes(px, 9) < 0.5 ? 1 : -1;
          for (let k = 1; k <= boy; k++) t.nokta(x + (k > 2 ? egik : 0), ys - k, 0);
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
    // Sabit süsler
    for (const [ox, tip] of SUSLER) {
      const x = this.X(ox);
      if (x < -30 || x > EK + 30) continue;
      const y = this.Y(d.yerY(ox));
      if (tip === 0) t.ciz(SPR_KIRPI, x - 9, y - 12);
      else t.ciz(SPR_AGAC, x - 17, y - 36);
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
      if (e.tip === T_TANK) t.cizDon(SPR_TANK, x, y - 8 + bat, e.aci, true, 36, 10, 255);
      else if (e.tip === T_UCAKSAVAR) t.cizDon(SPR_UCAKSAVAR, x, y - 8 + bat, e.aci, true, 32, 10, 255);
      else if (e.tip === T_KAMYON) t.cizDon(SPR_KAMYON, x, y - 9 + bat, e.aci + 0.2, true, 33, 13, 255);
      else if (e.tip === T_HELI) t.cizDon(SPR_DHELI, x, y - 8 + bat, e.aci + 0.4, true, 33, 12, 255);
      else if (e.tip === T_JET) t.cizDon(SPR_JET, x, y - 6 + bat, e.aci + 0.5, true, 38, 10, 255);
      else t.cizDon(SPR_HELI, x, y - 9 + bat, e.aci + 0.5, false, 36, 14, 255);
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
  }

  private siper(on: boolean): void {
    const { t, d } = this;
    const y = this.Y(d.zemin);
    const can = d.siperCan;
    if (!on) {
      // Arkadaki sığınak: kütük duvar, mazgal, torbalı çatı
      const bx = this.X(SIPER_X - 46);
      if (can > 0) {
        t.kutu(bx, y - 30, 51, 30, 0);
        t.kutu(bx + 1, y - 29, 49, 29, 100);
        for (let k = 0; k < 5; k++) t.kutu(bx + 1, y - 29 + k * 6, 49, 1, 64);
        for (let k = 0; k < 5; k++) for (let m = 0; m < 4; m++) t.nokta(bx + 6 + m * 12 + (k % 2) * 5, y - 26 + k * 6, 128);
        t.kutu(bx + 7, y - 21, 22, 5, 0); // mazgal
        t.kutu(bx + 8, y - 20, 20, 1, 42);
        t.kutu(bx + 36, y - 17, 10, 17, 30); // kapı
        t.kutu(bx + 37, y - 16, 8, 1, 64);
        for (let k = 0; k < 4; k++) this.kumTorbasi(bx - 3 + k * 14, y - 37);
        for (let k = 0; k < 3; k++) this.kumTorbasi(bx + 4 + k * 14, y - 43);
        // Telsiz anteni
        t.cizgi(bx + 47, y - 37, bx + 51, y - 70, 0);
        t.nokta(bx + 51, y - 71, 0);
        // Cephane sandıkları
        t.kutu(bx + 54, y - 8, 12, 8, 0);
        t.kutu(bx + 55, y - 7, 10, 6, 128);
        t.kutu(bx + 55, y - 4, 10, 1, 64);
      } else {
        for (let k = 0; k < 12; k++) t.kutu(bx + k * 5 + Math.round(kes(k, 1) * 4), y - 4 - Math.round(kes(k, 2) * 12), 6, 16, kes(k, 3) < 0.5 ? 0 : 64);
      }
      // Bayrak
      const dx = this.X(SIPER_X - 54);
      const egik = can > 0 ? 0 : 13;
      t.kalin(dx, y, dx + egik, y - 80, 0);
      t.daire(dx + egik + 0.5, y - 82, 1.6, 0);
      for (let k = 0; k < 27; k++) {
        const dal = Math.sin(d.zaman * 5 - k * 0.38) * (k / 27) * 3.4;
        const fy = y - 79 + Math.round(dal);
        const fx = dx + egik + 2 + k;
        t.nokta(fx, fy, 0);
        t.nokta(fx, fy + 15, 0);
        const golge = Math.cos(d.zaman * 5 - k * 0.38) > 0.5;
        for (let m = 1; m < 15; m++) t.nokta(fx, fy + m, can > 0 ? (golge ? 213 : 254) : 128);
        if (k === 26) for (let m = 0; m <= 15; m++) t.nokta(fx, fy + m, 0);
        // Amblem: baklava
        const uz = Math.abs(k - 13);
        if (uz <= 5) for (let m = 7 - (5 - uz); m <= 8 + (5 - uz); m++) t.nokta(fx, fy + m, 0);
      }
      return;
    }
    // Öndeki kum torbası duvarı (askerlerin önünde)
    const sx = this.X(SIPER_ON - 18);
    const satir = can > 66 ? 3 : can > 33 ? 2 : can > 0 ? 1 : 0;
    for (let r = 0; r < satir; r++) {
      const adet = r === 2 ? 2 : 3;
      for (let k = 0; k < adet; k++) this.kumTorbasi(sx + k * 13 + (r % 2) * 6 + (r === 2 ? 0 : 0), y - 7 - r * 6);
    }
    if (can > 0) {
      for (const ox of [-30, -8, 14]) for (let k = 0; k < 2; k++) this.kumTorbasi(this.X(SIPER_X + ox) + k * 13, y - 7);
    }
    // Dikenli tel: kazıklar ve sarmal
    const tx = this.X(SIPER_ON + 6);
    for (let k = 0; k < 40; k++) {
      const a = k * 0.7;
      t.nokta(tx + k + Math.cos(a) * 2, y - 7 + Math.sin(a) * 4, 0);
      if (k % 6 === 3) t.nokta(tx + k, y - 12, 0);
    }
    for (let k = 0; k <= 40; k += 13) {
      t.cizgi(tx + k, y, tx + k + 1, y - 13, 0);
      t.cizgi(tx + k + 1, y, tx + k + 2, y - 13, 0);
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

  private araclar(): void {
    const { t, d } = this;
    for (const a of d.araclar) {
      const sars = a.sars > 0 ? (Math.floor(d.zaman * 60) % 2 ? 1 : -1) : 0;
      const x = this.X(a.x) + sars;
      const y = this.Y(a.y);
      if (x < -60 || x > EK + 60) continue;
      const gidiyor = a.x > a.dur;
      // Yürürken hafif sallanır
      const zip = gidiyor && Math.sin(a.t * 13) > 0.6 ? 1 : 0;
      if (a.tip === T_TANK) {
        const yon = a.nisanT > 0 && d.heli.x > a.x ? 1 : -1;
        const c = Math.cos(a.namlu);
        const s = Math.sin(a.namlu);
        const tepki = a.sars > 0.08 ? 4 : 0; // atış sonrası geri tepme
        const kx = x + 4 - yon * tepki * 0.5;
        const ky = y - 20;
        // Namlu
        const bx = kx + yon * 13;
        const by = ky - 5;
        const uz = 30 - tepki;
        for (let k = -1; k <= 1; k++) t.cizgi(bx, by + k, bx + yon * c * uz, by + k - s * uz, 0);
        t.kutu(bx + yon * c * uz - 2, by - s * uz - 2, 4, 5, 0); // namlu ağız freni
        t.ciz(SPR_KULE, kx - 16, ky - 11, yon < 0);
        // Anten
        const ax = kx - yon * 10;
        const sal = Math.sin(a.t * 7) * (gidiyor ? 2 : 0.6);
        t.cizgi(ax, ky - 11, ax + sal, ky - 27, 0);
        t.ciz(SPR_TANK, x - 36, y - 20 + zip, true);
        if (gidiyor) {
          // Palet dişleri akar
          const k = Math.floor(a.t * 16) % 4;
          for (let p = -32 + k; p < 33; p += 4) {
            t.nokta(x + p, y - 1, 150);
            t.nokta(x - p, y - 10, 150);
          }
        }
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
      } else if (a.tip === T_UCAKSAVAR) {
        t.ciz(SPR_UCAKSAVAR, x - 32, y - 20 + zip, true);
        const px = x + 11;
        const py = y - 13 + zip;
        const c = Math.cos(a.namlu);
        const s = Math.sin(a.namlu);
        // Kaide, kalkan, çift namlu
        t.kutu(px - 3, py - 2, 7, 4, 0);
        t.kalin(px, py - 2, px + c * 6, py - 2 - s * 6, 0);
        for (const k of [-2, 2]) {
          const ox = -s * k;
          const oy = -c * k;
          t.cizgi(px + ox, py - 4 + oy, px + ox + c * 22, py - 4 + oy - s * 22, 0);
        }
        t.daire(px + c * 5, py - 4 - s * 5, 3, 0);
        t.daire(px + c * 5, py - 4 - s * 5, 1.5, 128);
      } else {
        t.ciz(SPR_KAMYON, x - 33, y - 26 + zip, true);
      }
      this.canCubugu(x, y - 44, a.can / a.enCan);
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

  private adam(s: Asker): void {
    const t = this.t;
    const x = this.X(s.x);
    if (x < -20 || x > EK + 20) return;
    const y = this.Y(s.y);
    const yon = s.yon;
    let kalca = y - 9;
    let boyun = y - 17;
    let egil = 0;
    const kosuyor = s.durum === KOS || s.durum === PANIK || s.durum === YANIYOR;
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
      egil = yon * (s.durum === KOS ? 2 : 3);
    } else if (s.tip === T_ROKET && !s.dost) {
      // Diz çökmüş
      kalca = y - 6;
      boyun = y - 14;
      this.uzuv(x, kalca, x + yon * 4, y, yon * 2, -3);
      this.uzuv(x, kalca, x - yon * 6, y, -yon * 1, 2);
      t.nokta(x + yon * 5, y, 0);
    } else {
      this.uzuv(x, kalca, x - 3, y, -0.5, 0);
      this.uzuv(x, kalca, x + 2, y, 0.5, 0);
      t.nokta(x - 4, y, 0);
      t.nokta(x + 3, y, 0);
    }
    const nx = Math.round(x + egil);
    // Gövde (2 piksel) ve sırt çantası
    t.kalin(x, kalca, nx, boyun, 0);
    if (!s.dost && s.durum !== YANIYOR) t.kutu(nx - (yon > 0 ? 3 : -2), boyun + 2, 2, 5, 0);
    // Baş
    const hx = Math.round(x + egil * 1.4);
    const hy = Math.round(boyun - 4);
    t.daire(hx + 0.5, hy, 3.2, 0);
    if (s.dost) {
      t.daire(hx + 0.5, hy + 0.5, 1.8, 250);
      t.kutu(hx - 3, hy - 4, 8, 2, 0); // kasket
      t.nokta(hx + yon * 5, hy - 3, 0);
    } else {
      t.cizgi(hx - 4, hy, hx + 5, hy, 0); // miğfer kenarı
      t.nokta(hx - 1, hy - 2, 128);
      t.nokta(hx, hy - 3, 128);
    }
    const by = boyun + 2;
    if (s.durum === PANIK) {
      const k = Math.sin(s.faz * 2) * 2;
      this.uzuv(nx, by, nx - 5, by - 7 + k, -2, 1);
      this.uzuv(nx + 1, by, nx + 6, by - 7 - k, 2, 1);
    } else if (s.durum === YANIYOR) {
      const k = Math.sin(s.faz * 1.7) * 4;
      this.uzuv(nx, by, nx - 6, by - 4 + k, -1, -2);
      this.uzuv(nx + 1, by, nx + 7, by - 4 - k, 1, -2);
    } else if (s.durum === KOS) {
      // Silah göğüste çapraz
      this.uzuv(nx, by, nx + yon * 5, by + 4, 0, 2);
      if (s.tip === T_ROKET) {
        t.kalin(nx - yon * 7, by - 1, nx + yon * 7, by - 4, 0);
        t.daire(nx + yon * 8, by - 4, 1.5, 0);
      } else {
        t.cizgi(nx - yon * 3, by + 6, nx + yon * 10, by + 1, 0);
        t.nokta(nx - yon * 3, by + 7, 0);
      }
    } else {
      // Nişan
      const c = Math.cos(s.nisanAci);
      const sn = Math.sin(s.nisanAci);
      this.uzuv(nx, by, nx + c * 6, by + sn * 6, 0, 2);
      if (s.tip === T_ROKET && !s.dost) {
        t.kalin(nx - c * 6, by - 1 - sn * 6, nx + c * 10, by - 1 + sn * 10, 0);
        t.daire(nx + c * 11, by - 1 + sn * 11, 1.8, 0);
        if (s.hedef === 1 && Math.floor(this.d.zaman * 14) % 2 === 0) t.yazi('!', x, y - 40, { hiza: 0, olcek: 3, vurgu: KAN });
      } else {
        t.cizgi(nx + c * 2, by + sn * 2, nx + c * 14, by + sn * 14, 0);
        t.nokta(nx - c * 2, by - sn * 2 + 1, 0); // dipçik
        // Atış anı: namlu ucunda kıvılcım
        if (s.sayac > 0.9 && s.sayac < 2 && Math.floor(this.d.zaman * 30) % 2 === 0 && s.sayac % 1 > 0.92) {
          t.vurgu(nx + c * 15, by + sn * 15, ATES);
          t.vurgu(nx + c * 16, by + sn * 16, AKKOR);
        }
      }
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
    t.cizDon(SPR_HELI, x, y, h.egim, h.yon < 0, 36, 14, vurulmus ? 255 : 0);
    const [mx, my] = this.yerel(x, y, h.egim, h.yon, -3, -15);
    this.pervane(mx, my, h.egim, 40);
    // Kuyruk pervanesi
    const [kx, ky] = this.yerel(x, y, h.egim, h.yon, -32, -8);
    const ka = d.zaman * 40;
    t.cizgi(kx - Math.cos(ka) * 6, ky - Math.sin(ka) * 6, kx + Math.cos(ka) * 6, ky + Math.sin(ka) * 6, 0);
    t.cizgi(kx - Math.cos(ka + 1.57) * 6, ky - Math.sin(ka + 1.57) * 6, kx + Math.cos(ka + 1.57) * 6, ky + Math.sin(ka + 1.57) * 6, 150);
    // Namlu alevi: yıldız biçimli parlama
    if (h.top > 0.07 && d.oyunda && !h.olu) {
      const [ax, ay] = this.yerel(x, y, h.egim, h.yon, 28, 10);
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
      t.yazi('DOKUN: BOMBA', 12, y + 24, { olcek: 3, ton: 240, kenar: 0 });
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
    this.sigdir('DOKUN: BOMBA BIRAK', EK / 2, y2 + 22, { hiza: 0, ton: 240, kenar: 0 });
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
