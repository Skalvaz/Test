/**
 * Ekran yerleşimi (GDD §11.6). Saf (DOM yok, testli).
 *
 * Dikey telefon (tasarım 390×844, alt sınır 360×640): üst kâğıt bant
 * (hedefler, hamle mührü, puan çubuğu; güvenli alan dahil), tarif şeridi,
 * tahta, alt bant (Duraklat). Tahta hücresi 40 px'in altına düşerse tarif
 * şeridi gizlenir.
 *
 * Masaüstü / yatay (en/boy > 0,75): tahta solda %62'lik alanda, sağda
 * 300 px kâğıt panel (hedefler, hamle, puan, tarif, duraklat).
 */
import type { Dikdortgen } from '../app/sozlesme';

export interface Kenarlar {
  ust: number;
  sag: number;
  alt: number;
  sol: number;
}

export const SIFIR_KENAR: Kenarlar = { ust: 0, sag: 0, alt: 0, sol: 0 };

export interface Yerlesim {
  kip: 'dikey' | 'yan';
  W: number;
  H: number;
  /** Dikey: üst bant (güvenli alan dahil). Yan: panel içindeki üst kısım yok (0 yükseklik). */
  ust: Dikdortgen;
  /** Tarif şeridi (gizliyse null). */
  tarif: Dikdortgen | null;
  /** Tahtaya ayrılan alan (çizici `alanAyarla`). */
  tahta: Dikdortgen;
  /** Dikey: alt bant. Yan: 0 yükseklik. */
  alt: Dikdortgen;
  /** Yan kipte sağ panel. */
  panel: Dikdortgen | null;
  /** Tahmini hücre boyu (çizici kendi çerçeve payıyla yeniden hesaplar). */
  hucre: number;
}

export const PANEL_W = 300;
/** Çizicinin çerçeve payı (bant + 8) için kaba tahmin. */
const CERCEVE_PAYI = 22;

const sinirla = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

function hucreTahmini(r: Dikdortgen, bw: number, bh: number): number {
  return Math.floor(Math.min((r.w - 2 * CERCEVE_PAYI) / bw, (r.h - 2 * CERCEVE_PAYI) / bh, 64));
}

export function yanKipMi(W: number, H: number): boolean {
  return W / Math.max(1, H) > 0.75 && W >= 640;
}

/**
 * @param bw, bh tahta boyutu (sütun × satır)
 * @param tarifIstegi tarif şeridi gösterilmek isteniyor mu (bölüm 1–5 ya da ayar "her zaman")
 */
export function yerlesimHesapla(W: number, H: number, g: Kenarlar, bw: number, bh: number, tarifIstegi: boolean): Yerlesim {
  if (yanKipMi(W, H)) {
    const tahtaW = Math.max(W * 0.62, 320);
    let px = Math.round(tahtaW + (W - tahtaW - PANEL_W) / 2);
    let solW = tahtaW;
    if (W - tahtaW < PANEL_W + 32) {
      px = W - g.sag - PANEL_W - 20;
      solW = px - 16;
    }
    const ph = Math.min(H - g.ust - g.alt - 40, 640);
    const panel = { x: px, y: Math.round(g.ust + (H - g.ust - g.alt - ph) / 2), w: PANEL_W, h: ph };
    const tahta = { x: g.sol, y: g.ust, w: Math.round(solW - g.sol), h: H - g.ust - g.alt };
    return {
      kip: 'yan',
      W,
      H,
      ust: { x: 0, y: 0, w: W, h: 0 },
      tarif: tarifIstegi ? { x: panel.x, y: panel.y, w: PANEL_W, h: 0 } : null,
      tahta,
      alt: { x: 0, y: H, w: W, h: 0 },
      panel,
      hucre: hucreTahmini(tahta, bw, bh),
    };
  }
  const ustH = g.ust + Math.round(sinirla(H * 0.12, 70, 100));
  const altH = g.alt + Math.round(sinirla(H * 0.1, 58, 84));
  const tarifH = Math.round(sinirla(H * 0.045, 28, 36));
  const kur = (tarifVar: boolean): Yerlesim => {
    const ty = ustH + (tarifVar ? tarifH : 0);
    const tahta = { x: g.sol, y: ty, w: W - g.sol - g.sag, h: Math.max(80, H - ty - altH) };
    return {
      kip: 'dikey',
      W,
      H,
      ust: { x: 0, y: 0, w: W, h: ustH },
      tarif: tarifVar ? { x: 0, y: ustH, w: W, h: tarifH } : null,
      tahta,
      alt: { x: 0, y: H - altH, w: W, h: altH },
      panel: null,
      hucre: hucreTahmini(tahta, bw, bh),
    };
  };
  const y = kur(tarifIstegi);
  if (tarifIstegi && y.hucre < 40) return kur(false);
  return y;
}
