/**
 * Damla çizim tarifi (GDD §11.3). Çizici bunu sprite önbelleğine
 * (`sprite.ts`, offscreen; anahtar renk × tür × hücre × DPR × palet × motif)
 * bir kez pişirir; kare başına yalnız drawImage. `shadowBlur` YASAK: parıltı
 * ve gölge radyal gradyanla.
 *
 * Katmanlar (hepsi (0,0) merkezli, hücre boyu `h`):
 *  - hale: suya yayılan boya lekesi (ebru damlasının açılımı) + silik dış halka;
 *  - gövde: suda yüzen, hafif kubbeli boya damlası (gölge, radyal gövde,
 *    ebru halkaları, motif, yansıma, alt kenarda su ışığı);
 *  - özel taş katmanları: Tarak (yönüne dik 7 dişli altın tarak + yön
 *    okları), Girdap (döndürülerek çizilen üç kollu sarmal), Lale (dönen
 *    yanardöner film + altın lale), Mürekkep (altın kenar, üç altın motif).
 *
 * Ham damla mat ve tek halkalı; karışık damla parlak, üç halkalı ve sağ
 * üstte altın pırıltılı ("bu eşleşir" işareti).
 */
import type { OzelTur, Renk, Yon } from '../core/types';
import { PALET, RENK_TANIMLARI, type Motif } from '../app/katalog';
import type { Palet } from '../app/sozlesme';
import { hexRgb, karistir, renkUclu, rgba, rgbHex } from './palet';
import { TAU } from './matematik';

export interface DamlaSecenek {
  palet?: Palet;
  /** Renk körlüğü motifleri (K17; varsayılan açık). */
  motifler?: boolean;
  /** 0..1 nefes/nabız ölçeği çarpanı (1 = durgun). */
  olcek?: number;
}

/** Damla yarıçapı (hücre oranı): ham 0,40, diğerleri 0,43 (§11.3). */
export function damlaYaricapi(kod: Renk | 0, ozel: OzelTur = 'yok'): number {
  if (ozel !== 'yok') return 0.43;
  return kod === 1 || kod === 2 || kod === 4 ? 0.4 : 0.43;
}

const hamMi = (k: Renk | 0) => k === 1 || k === 2 || k === 4;

export function motifCiz(c: CanvasRenderingContext2D, motifler: readonly Motif[], r: number, renk: string): void {
  const nokta = motifler.includes('nokta');
  const halka = motifler.includes('halka');
  const dalga = motifler.includes('dalga');
  c.strokeStyle = renk;
  c.fillStyle = renk;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const iki = motifler.length >= 2;
  if (halka) {
    c.lineWidth = r * 0.085;
    c.beginPath();
    c.arc(0, dalga && !nokta ? -r * 0.05 : 0, r * (iki ? 0.34 : 0.3), 0, TAU);
    c.stroke();
  }
  if (dalga) {
    c.lineWidth = r * 0.085;
    const yy = halka && nokta ? r * 0.5 : nokta ? r * 0.2 : halka ? r * 0.05 : 0;
    const gen = r * (iki ? 0.5 : 0.42);
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const x = -gen + 2 * gen * u;
      const y = yy + Math.sin(u * Math.PI * 3) * r * 0.11;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  if (nokta) {
    c.beginPath();
    c.arc(0, dalga && !halka ? -r * 0.18 : dalga ? -r * 0.12 : 0, r * 0.13, 0, TAU);
    c.fill();
  }
}

/** Suya yayılan hale (gövdenin altına; komşu haleler üst üste binince su lekelenir). */
export function haleCiz(c: CanvasRenderingContext2D, h: number, kod: Renk | 0, palet: Palet = 'standart'): void {
  const [ana, acik] = renkUclu(kod, palet);
  const ham = hamMi(kod);
  const murekkep = kod === 7;
  const r = h * damlaYaricapi(kod);
  const dis = h * (ham ? 0.58 : 0.66);
  const g = c.createRadialGradient(0, 0, r * 0.5, 0, 0, dis);
  if (murekkep) {
    g.addColorStop(0, 'rgba(201,162,39,0.30)');
    g.addColorStop(0.55, 'rgba(201,162,39,0.10)');
    g.addColorStop(1, 'rgba(201,162,39,0)');
  } else {
    const a = ham ? 0.26 : kod === 0 ? 0.3 : 0.42;
    g.addColorStop(0, rgba(ana, a));
    g.addColorStop(0.55, rgba(ana, a * 0.42));
    g.addColorStop(1, rgba(ana, 0));
  }
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, dis, 0, TAU);
  c.fill();
  // Ebru: boya suya açılırken kenarında ince, silik bir halka bırakır.
  c.strokeStyle = rgba(murekkep ? PALET.altinAcik : acik, ham ? 0.1 : 0.16);
  c.lineWidth = Math.max(0.6, h * 0.012);
  c.beginPath();
  c.arc(0, 0, dis * 0.86, 0, TAU);
  c.stroke();
}

/** Damla gövdesi (özel taş katmanları dahil; Girdap kolları ve Lale filmi hariç — onlar döner). */
export function govdeCiz(c: CanvasRenderingContext2D, h: number, kod: Renk | 0, ozel: OzelTur, yon: Yon, s: DamlaSecenek = {}): void {
  const palet = s.palet ?? 'standart';
  const motifAcik = s.motifler !== false;
  const [ana, acik, koyu] = renkUclu(kod, palet);
  const ham = hamMi(kod) && ozel === 'yok';
  const murekkep = kod === 7 || ozel === 'murekkep';
  const lale = ozel === 'lale';
  const r = h * damlaYaricapi(kod, ozel) * (s.olcek ?? 1);

  // 1. Suya düşen gölge (sağ alt; yüzen damla hissi).
  const gg = c.createRadialGradient(r * 0.1, r * 0.2, r * 0.55, r * 0.1, r * 0.2, r * 1.12);
  gg.addColorStop(0, 'rgba(2,10,14,0.38)');
  gg.addColorStop(1, 'rgba(2,10,14,0)');
  c.fillStyle = gg;
  c.beginPath();
  c.arc(r * 0.1, r * 0.2, r * 1.12, 0, TAU);
  c.fill();

  // 2. Gövde: sol üstte ışık, kenarda koyu boya birikimi (ebru boyasının kenarı).
  const g = c.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, 0, r);
  if (murekkep) {
    g.addColorStop(0, '#5A4E44');
    g.addColorStop(0.42, '#2A241F');
    g.addColorStop(1, '#0B0907');
  } else if (lale) {
    g.addColorStop(0, '#FFFDF6');
    g.addColorStop(0.5, '#EFE4CC');
    g.addColorStop(1, '#B8A27A');
  } else {
    g.addColorStop(0, acik);
    g.addColorStop(ham ? 0.6 : 0.45, ana);
    g.addColorStop(0.88, rgbHex(karistir(ana, koyu, 0.55)));
    g.addColorStop(1, koyu);
  }
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();

  // 3. Alt kenarda sudan yansıyan ışık (hacim).
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.clip();
  const alt = c.createRadialGradient(r * 0.35, r * 0.55, 0, r * 0.35, r * 0.55, r * 0.75);
  alt.addColorStop(0, rgba(murekkep ? '#8A7A66' : lale ? '#FFFFFF' : acik, murekkep ? 0.22 : 0.3));
  alt.addColorStop(1, rgba(acik, 0));
  c.fillStyle = alt;
  c.fillRect(-r, -r, 2 * r, 2 * r);
  c.restore();

  // 4. Ebru halkaları.
  if (murekkep) {
    c.strokeStyle = PALET.altin;
    c.lineWidth = r * 0.09;
    c.beginPath();
    c.arc(0, 0, r * 0.93, 0, TAU);
    c.stroke();
    c.strokeStyle = rgba(PALET.altinAcik, 0.55);
    c.lineWidth = r * 0.03;
    c.beginPath();
    c.arc(0, 0, r * 0.8, 0, TAU);
    c.stroke();
  } else if (ham) {
    c.strokeStyle = 'rgba(243,233,210,0.42)';
    c.lineWidth = r * 0.06;
    c.beginPath();
    c.arc(0, 0, r * 0.74, 0, TAU);
    c.stroke();
  } else if (!lale) {
    c.lineWidth = r * 0.075;
    const halkalar: [number, string][] = [
      [0.86, 'rgba(243,233,210,0.70)'],
      [0.7, rgba(koyu, 0.69)],
      [0.56, 'rgba(243,233,210,0.45)'],
    ];
    for (const [rr, renk] of halkalar) {
      c.strokeStyle = renk;
      c.beginPath();
      c.arc(0, 0, r * rr, 0, TAU);
      c.stroke();
    }
  } else {
    c.strokeStyle = rgba(PALET.altin, 0.85);
    c.lineWidth = r * 0.06;
    c.beginPath();
    c.arc(0, 0, r * 0.94, 0, TAU);
    c.stroke();
  }

  // 5. Motif (renk körlüğü; karışık iki ebeveynin motifini taşır). Özel taşlarda
  //    motif yerine taşın simgesi okunur; Tarak/Girdap motifi küçük ve soluk kalır.
  if (motifAcik && kod !== 0) {
    const tanim = RENK_TANIMLARI[kod as Renk];
    if (ozel === 'yok' || murekkep) {
      motifCiz(c, tanim.motifler, r * (ham ? 0.95 : 0.8), murekkep ? PALET.altinAcik : ham ? 'rgba(30,26,22,0.62)' : 'rgba(243,233,210,0.92)');
    }
  }

  // 6. Yansıma: ham mat, karışık parlak.
  c.fillStyle = `rgba(255,255,255,${ham ? 0.22 : murekkep ? 0.18 : 0.5})`;
  c.beginPath();
  c.ellipse(-r * 0.38, -r * 0.48, r * 0.3, r * 0.14, -0.5, 0, TAU);
  c.fill();
  if (!ham) {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    c.arc(-r * 0.56, -r * 0.3, r * 0.045, 0, TAU);
    c.fill();
  }

  // 7. Özel taş katmanları.
  if (ozel === 'tarak') tarakCiz(c, r, yon);
  else if (ozel === 'girdap') {
    // Kollar döndürülerek ayrıca çizilir (girdapKolCiz); burada göbek.
    c.fillStyle = PALET.altinKoyu;
    c.beginPath();
    c.arc(0, 0, r * 0.15, 0, TAU);
    c.fill();
  } else if (lale) {
    /* film ve lale silueti ayrı katman (laleFilmCiz, laleSiluetCiz) */
  }

  // 8. Karışık: altın dört uçlu pırıltı ("bu eşleşir").
  if (!ham && !murekkep && !lale && ozel === 'yok') yildizCiz(c, r * 0.62, -r * 0.62, r * 0.26, PALET.altinAcik);
}

/** Dört uçlu yıldız (pırıltı). */
export function yildizCiz(c: CanvasRenderingContext2D, px: number, py: number, u: number, renk: string): void {
  c.fillStyle = renk;
  c.beginPath();
  c.moveTo(px, py - u);
  c.quadraticCurveTo(px, py, px + u, py);
  c.quadraticCurveTo(px, py, px, py + u);
  c.quadraticCurveTo(px, py, px - u, py);
  c.quadraticCurveTo(px, py, px, py - u);
  c.fill();
}

/**
 * Tarak: yönüne dik altın bir sırt ve 7 diş (ebru tarağının iğneleri),
 * iki uçta yön okları. Yatay tarak satırı tarar: sırt dikey.
 */
export function tarakCiz(c: CanvasRenderingContext2D, r: number, yon: Yon): void {
  c.save();
  if (yon === 'dikey') c.rotate(Math.PI / 2);
  const koyu = '#4A3608';
  const dis = r * 0.74;
  const aralik = r * 0.22;
  // Sırt (dikey çubuk) ve dişler (yatay, sağa).
  const sirtX = -r * 0.2;
  const disUzun = r * 0.46;
  const cizSirt = (renk: string, ek: number) => {
    c.strokeStyle = renk;
    c.lineCap = 'round';
    c.lineWidth = r * 0.16 + ek;
    c.beginPath();
    c.moveTo(sirtX, -dis);
    c.lineTo(sirtX, dis);
    c.stroke();
    c.lineWidth = r * 0.08 + ek;
    for (let i = -3; i <= 3; i++) {
      const y = i * aralik;
      c.beginPath();
      c.moveTo(sirtX, y);
      c.lineTo(sirtX + disUzun, y);
      c.stroke();
    }
  };
  cizSirt(koyu, r * 0.08);
  cizSirt(PALET.altin, 0);
  // Sırt üstünde ışık.
  c.strokeStyle = rgba(PALET.altinAcik, 0.9);
  c.lineWidth = r * 0.05;
  c.beginPath();
  c.moveTo(sirtX - r * 0.03, -dis * 0.9);
  c.lineTo(sirtX - r * 0.03, dis * 0.9);
  c.stroke();
  // Yön okları (tarama ekseni boyunca, iki yanda).
  const ok = (x: number, s: number) => {
    c.beginPath();
    c.moveTo(x, -r * 0.16);
    c.lineTo(x + s * r * 0.16, 0);
    c.lineTo(x, r * 0.16);
    c.closePath();
    c.fillStyle = koyu;
    c.fill();
    c.save();
    c.translate(-s * r * 0.02, 0);
    c.scale(0.72, 0.72);
    c.beginPath();
    c.moveTo(x / 0.72, -r * 0.16);
    c.lineTo((x + s * r * 0.16) / 0.72, 0);
    c.lineTo(x / 0.72, r * 0.16);
    c.closePath();
    c.fillStyle = PALET.altinAcik;
    c.fill();
    c.restore();
  };
  ok(r * 0.68, 1);
  ok(-r * 0.62, -1);
  c.restore();
}

/** Girdap: üç kollu altın sarmal (çizici 0,3 Hz döndürür). */
export function girdapKolCiz(c: CanvasRenderingContext2D, h: number): void {
  const r = h * 0.43;
  for (let k = 0; k < 3; k++) {
    const a0 = (k * TAU) / 3;
    const nokta = (u: number): [number, number] => {
      const rr = r * (0.14 + 0.66 * u);
      const a = a0 + u * 2.6;
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    };
    // Kalından ince uca: parçalı çizgi.
    const N = 14;
    for (const [renk, ek] of [
      ['#4A3608', r * 0.07],
      [PALET.altin, 0],
    ] as const) {
      c.strokeStyle = renk;
      c.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const [x0, y0] = nokta(i / N);
        const [x1, y1] = nokta((i + 1) / N);
        c.lineWidth = r * (0.17 - 0.12 * (i / N)) + ek;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x1, y1);
        c.stroke();
      }
    }
    c.strokeStyle = rgba(PALET.altinAcik, 0.85);
    c.lineWidth = r * 0.035;
    c.beginPath();
    for (let i = 0; i <= N; i++) {
      const [x, y] = nokta((i / N) * 0.85);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = PALET.altinAcik;
  c.beginPath();
  c.arc(0, 0, r * 0.1, 0, TAU);
  c.fill();
}

/** Lale: yanardöner film (konik gradyan, alfa 0,5; çizici 0,15 Hz döndürür). */
export function laleFilmCiz(c: CanvasRenderingContext2D, h: number): void {
  const r = h * 0.43 * 0.97;
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.clip();
  const renkler = ['#F7B8C8', '#F9E2A8', '#B9EBD3', '#AFC8F5', '#D9B8F2', '#F7B8C8'];
  const ctx = c as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
  if (typeof ctx.createConicGradient === 'function') {
    const g = ctx.createConicGradient(0, 0, 0);
    renkler.forEach((k, i) => g.addColorStop(i / (renkler.length - 1), k));
    c.globalAlpha = 0.5;
    c.fillStyle = g;
    c.fillRect(-r, -r, 2 * r, 2 * r);
  } else {
    // Yedek: renkli dilimler.
    c.globalAlpha = 0.45;
    for (let i = 0; i < renkler.length - 1; i++) {
      c.fillStyle = renkler[i];
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, r, (i * TAU) / 5, ((i + 1) * TAU) / 5);
      c.fill();
    }
  }
  // Merkeze doğru solan film (kenarda yanardöner, ortada krem).
  c.globalAlpha = 1;
  const g2 = c.createRadialGradient(-r * 0.2, -r * 0.25, 0, 0, 0, r);
  g2.addColorStop(0, 'rgba(255,250,238,0.85)');
  g2.addColorStop(0.55, 'rgba(255,250,238,0.2)');
  g2.addColorStop(1, 'rgba(255,250,238,0)');
  c.fillStyle = g2;
  c.fillRect(-r, -r, 2 * r, 2 * r);
  c.restore();
}

/** Lale silueti: üç taç yaprağı, sap ve iki yaprak; altın kontur. */
export function laleSiluetCiz(c: CanvasRenderingContext2D, h: number, dolgu = PALET.altin, kontur = '#4A3608'): void {
  const r = h * 0.43;
  const yol = () => {
    c.beginPath();
    // Orta yaprak.
    c.moveTo(0, r * 0.12);
    c.bezierCurveTo(-r * 0.2, r * 0.02, -r * 0.18, -r * 0.42, 0, -r * 0.58);
    c.bezierCurveTo(r * 0.18, -r * 0.42, r * 0.2, r * 0.02, 0, r * 0.12);
    // Sol yaprak.
    c.moveTo(-r * 0.04, r * 0.16);
    c.bezierCurveTo(-r * 0.36, r * 0.12, -r * 0.44, -r * 0.2, -r * 0.34, -r * 0.44);
    c.bezierCurveTo(-r * 0.2, -r * 0.24, -r * 0.08, -r * 0.08, -r * 0.04, r * 0.16);
    // Sağ yaprak.
    c.moveTo(r * 0.04, r * 0.16);
    c.bezierCurveTo(r * 0.36, r * 0.12, r * 0.44, -r * 0.2, r * 0.34, -r * 0.44);
    c.bezierCurveTo(r * 0.2, -r * 0.24, r * 0.08, -r * 0.08, r * 0.04, r * 0.16);
  };
  const sap = () => {
    c.beginPath();
    c.moveTo(0, r * 0.14);
    c.quadraticCurveTo(r * 0.04, r * 0.44, 0, r * 0.66);
    c.moveTo(r * 0.01, r * 0.5);
    c.quadraticCurveTo(r * 0.24, r * 0.4, r * 0.32, r * 0.22);
    c.moveTo(0, r * 0.58);
    c.quadraticCurveTo(-r * 0.22, r * 0.5, -r * 0.3, r * 0.34);
  };
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = kontur;
  c.lineWidth = r * 0.13;
  sap();
  c.stroke();
  yol();
  c.lineWidth = r * 0.08;
  c.stroke();
  c.strokeStyle = dolgu;
  c.lineWidth = r * 0.07;
  sap();
  c.stroke();
  const g = c.createLinearGradient(0, -r * 0.6, 0, r * 0.2);
  g.addColorStop(0, PALET.altinAcik);
  g.addColorStop(1, dolgu);
  c.fillStyle = g;
  yol();
  c.fill();
}

/** P0 başvuru çizimi (iskelet sahnesi bunu kullanır): hale + gövde doğrudan. */
export function damlaCiz(c: CanvasRenderingContext2D, cx: number, cy: number, h: number, kod: Renk, s: DamlaSecenek = {}): void {
  c.save();
  c.translate(cx, cy);
  haleCiz(c, h, kod, s.palet);
  govdeCiz(c, h, kod, kod === 7 ? 'murekkep' : 'yok', 'yatay', s);
  c.restore();
}

/** Mermer engeli (§11.3): damarlı levha; can = katman çizgisi; hasar = çatlak. */
export function mermerCiz(c: CanvasRenderingContext2D, h: number, can: number, catlak: number, tohum: number): void {
  const s = h * 0.86;
  const x0 = -s / 2;
  const y0 = -s / 2;
  const rr = h * 0.12;
  let t = tohum >>> 0 || 1;
  const rnd = () => {
    t ^= t << 13;
    t >>>= 0;
    t ^= t >>> 17;
    t ^= t << 5;
    t >>>= 0;
    return t / 4294967296;
  };
  const yol = () => {
    c.beginPath();
    c.moveTo(x0 + rr, y0);
    c.arcTo(x0 + s, y0, x0 + s, y0 + s, rr);
    c.arcTo(x0 + s, y0 + s, x0, y0 + s, rr);
    c.arcTo(x0, y0 + s, x0, y0, rr);
    c.arcTo(x0, y0, x0 + s, y0, rr);
    c.closePath();
  };
  // Gölge.
  const gg = c.createRadialGradient(h * 0.05, h * 0.1, s * 0.3, h * 0.05, h * 0.1, s * 0.75);
  gg.addColorStop(0, 'rgba(0,8,12,0.45)');
  gg.addColorStop(1, 'rgba(0,8,12,0)');
  c.fillStyle = gg;
  c.fillRect(-h * 0.6, -h * 0.55, h * 1.25, h * 1.25);
  // Gövde.
  const g = c.createLinearGradient(x0, y0, x0 + s, y0 + s);
  g.addColorStop(0, '#F2EFE8');
  g.addColorStop(0.55, PALET.mermer[0]);
  g.addColorStop(1, '#B9B2A6');
  c.fillStyle = g;
  yol();
  c.fill();
  c.save();
  yol();
  c.clip();
  // Damarlar (tohumlu 3 Bezier).
  for (let i = 0; i < 3; i++) {
    const ax = x0 + rnd() * s;
    const ay = y0 - 2;
    const bx = x0 + rnd() * s;
    const by = y0 + s + 2;
    c.strokeStyle = rgba(PALET.mermer[1], 0.35 + rnd() * 0.3);
    c.lineWidth = h * (0.012 + rnd() * 0.02);
    c.beginPath();
    c.moveTo(ax, ay);
    c.bezierCurveTo(ax + (rnd() - 0.5) * s, y0 + s * 0.35, bx + (rnd() - 0.5) * s, y0 + s * 0.65, bx, by);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = h * 0.006;
    c.stroke();
  }
  // Katman çizgileri (can).
  for (let i = 0; i < can; i++) {
    const y = y0 + s - h * 0.07 - i * h * 0.075;
    c.strokeStyle = 'rgba(120,112,100,0.55)';
    c.lineWidth = h * 0.018;
    c.beginPath();
    c.moveTo(x0 + h * 0.08, y);
    c.lineTo(x0 + s - h * 0.08, y);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = h * 0.008;
    c.beginPath();
    c.moveTo(x0 + h * 0.08, y - h * 0.012);
    c.lineTo(x0 + s - h * 0.08, y - h * 0.012);
    c.stroke();
  }
  // Çatlaklar (aldığı hasar kadar).
  for (let i = 0; i < catlak; i++) {
    let x = (rnd() - 0.5) * s * 0.5;
    let y = y0 + rnd() * s * 0.3;
    c.strokeStyle = 'rgba(40,36,30,0.75)';
    c.lineWidth = h * 0.016;
    c.beginPath();
    c.moveTo(x, y);
    const adim = 5;
    for (let k = 0; k < adim; k++) {
      x += (rnd() - 0.5) * s * 0.32;
      y += s * (0.12 + rnd() * 0.08);
      c.lineTo(x, y);
      if (k === 2) {
        c.moveTo(x, y);
        c.lineTo(x + (rnd() - 0.2) * s * 0.3, y + s * 0.08);
        c.moveTo(x, y);
      }
    }
    c.stroke();
  }
  c.restore();
  // Kenar ışığı.
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = h * 0.02;
  yol();
  c.stroke();
  c.strokeStyle = 'rgba(90,82,72,0.5)';
  c.lineWidth = h * 0.012;
  yol();
  c.stroke();
}

/** Renk kodunu katalogdan dene (bilinmeyen kod → krem). */
export function renkGecerli(kod: number): kod is Renk {
  return kod >= 1 && kod <= 7;
}

/** Yarı saydam "hayalet" sürümler için sonuç renginin halka rengi. */
export function halkaRengi(kod: Renk | 0, palet: Palet = 'standart'): string {
  const [ana] = renkUclu(kod, palet);
  return rgbHex(karistir(hexRgb(ana), [243, 233, 210], 0.15));
}
