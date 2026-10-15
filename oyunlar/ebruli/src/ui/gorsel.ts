/**
 * Arayüz simgeleri oyunun kendi çizim tarifinden (src/render/damla.ts,
 * zemin.ts): hedef kartı, tarif şeridi, harita düğümü ve "Nasıl oynanır"
 * kartlarındaki damlalar oyundakilerle birebir aynı görünür. Bir kez
 * offscreen tuvale çizilip önbelleklenir (anahtar: tür × boyut × DPR ×
 * palet × motif); her kullanım küçük bir <canvas> kopyasıdır (data: URL
 * yok: sayfa çerçevesinin CSP'sinden bağımsız, toDataURL maliyeti yok).
 */
import type { OzelTur, Renk, Yon } from '../core/types';
import type { Palet } from '../app/sozlesme';
import { girdapKolCiz, govdeCiz, haleCiz, laleSiluetCiz, mermerCiz } from '../render/damla';
import { desenCiz, kagitCiz } from '../render/zemin';

export type Resim = HTMLCanvasElement;

const onbellek = new Map<string, Resim>();
let ayar: { palet: Palet; motifler: boolean } = { palet: 'standart', motifler: true };

export function gorselAyarla(palet: Palet, motifler: boolean): void {
  if (palet === ayar.palet && motifler === ayar.motifler) return;
  ayar = { palet, motifler };
  onbellek.clear();
}

function dpr(): number {
  return Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
}

function resim(anahtar: string, boyut: number, ciz: (c: CanvasRenderingContext2D, s: number) => void): Resim {
  const d = dpr();
  const k = `${anahtar}|${boyut}|${d}|${ayar.palet}|${ayar.motifler}`;
  const v = onbellek.get(k);
  if (v) return v;
  const t = document.createElement('canvas');
  t.width = Math.round(boyut * d);
  t.height = Math.round(boyut * d);
  const c = t.getContext('2d');
  if (c) {
    c.scale(d, d);
    c.translate(boyut / 2, boyut / 2);
    ciz(c, boyut);
  }
  if (onbellek.size > 160) onbellek.clear();
  onbellek.set(k, t);
  return t;
}

/** Damla (özel taş dahil). `hale`: suya yayılan leke (harita düğümü). */
export function damlaResmi(kod: Renk | 0, boyut: number, ozel: OzelTur = 'yok', yon: Yon = 'yatay', hale = false): Resim {
  return resim(`d${kod}${ozel}${yon}${hale ? 'h' : ''}`, boyut, (c, s) => {
    const h = hale ? s * 0.78 : s * 1.08;
    if (hale) haleCiz(c, h, kod, ayar.palet);
    govdeCiz(c, h, kod, ozel, yon, { palet: ayar.palet, motifler: ayar.motifler });
    if (ozel === 'girdap') girdapKolCiz(c, h);
    if (ozel === 'lale') laleSiluetCiz(c, h);
  });
}

export function mermerResmi(boyut: number, can = 2): Resim {
  return resim(`m${can}`, boyut, (c, s) => mermerCiz(c, s * 1.1, can, 0, 7));
}

export function kagitResmi(boyut: number, kat = 1): Resim {
  return resim(`k${kat}`, boyut, (c, s) => kagitCiz(c, s * 1.05, kat, 3));
}

export function desenResmi(boyut: number, renk: 3 | 5 | 6, boyali = false): Resim {
  return resim(`p${renk}${boyali ? 1 : 0}`, boyut, (c, s) => {
    c.fillStyle = 'rgba(11,43,46,0.9)';
    c.beginPath();
    c.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    c.fill();
    desenCiz(c, s * 1.02, renk, boyali, ayar.palet, 5);
  });
}

/** Yağ lekesi simgesi: koyu zemin + yanardöner halka. */
export function yagResmi(boyut: number): Resim {
  return resim('y', boyut, (c, s) => {
    const r = s * 0.44;
    c.fillStyle = 'rgba(42,47,30,0.85)';
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fill();
    const renkler = ['#9FF0DA', '#F5E38A', '#F5A3C8', '#A3BCF8'];
    c.lineWidth = Math.max(1.5, s * 0.06);
    renkler.forEach((k, i) => {
      c.strokeStyle = k;
      c.globalAlpha = 0.75;
      c.beginPath();
      c.arc(0, 0, r * 0.82, (i / 4) * Math.PI * 2, ((i + 1) / 4) * Math.PI * 2);
      c.stroke();
    });
    c.globalAlpha = 1;
  });
}

export function img(src: Resim, boyut: number, sinif = '', alt = ''): HTMLCanvasElement {
  const e = document.createElement('canvas');
  e.width = src.width;
  e.height = src.height;
  e.style.width = `${boyut}px`;
  e.style.height = `${boyut}px`;
  e.className = sinif ? `e-resim ${sinif}` : 'e-resim';
  if (alt) {
    e.setAttribute('role', 'img');
    e.setAttribute('aria-label', alt);
  } else e.setAttribute('aria-hidden', 'true');
  e.getContext('2d')?.drawImage(src, 0, 0);
  return e;
}
