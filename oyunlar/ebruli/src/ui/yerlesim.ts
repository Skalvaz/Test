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

/**
 * Hücre üst sınırı: telefonda 64, büyük ekranda (tablet, masaüstü; kısa kenar
 * ≥ 600 px) 96. 64'te tablette tahta ekranın ortasında küçük kalıyordu.
 * Çizici (`render/oyunCizici.ts` geometriHesapla) aynı kuralı kullanır.
 */
export function hucreSiniri(W: number, H: number): number {
  return Math.min(W, H) >= 600 ? 96 : 64;
}

function hucreTahmini(r: Dikdortgen, bw: number, bh: number, sinir: number): number {
  return Math.floor(Math.min((r.w - 2 * CERCEVE_PAYI) / bw, (r.h - 2 * CERCEVE_PAYI) / bh, sinir));
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
      hucre: hucreTahmini(tahta, bw, bh, hucreSiniri(W, H)),
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
      hucre: hucreTahmini(tahta, bw, bh, hucreSiniri(W, H)),
    };
  };
  const y = kur(tarifIstegi);
  if (tarifIstegi && y.hucre < 40) return kur(false);
  return y;
}

export interface KazandinYerlesimi {
  yan: boolean;
  /** Tablonun son yeri. */
  tablo: Dikdortgen;
  /** Başlık bloğunun üstü (dikey) ya da bilgi sütununun üstü (yan). */
  baslikY: number;
  muhurY: number;
  /** Alt bilgi bölgesi (puan, etiket, düğmeler). */
  alt: Dikdortgen;
  /** Kısa ekran: künye gizlenir, aralıklar daralır. */
  dar: boolean;
}

export const MUHUR_SATIRI = 66;

/**
 * Kazandın ekranı (GDD §9.5, §12.3 #6): tablo, üstünde başlık, ALTINDA
 * yıldız mühürleri (tablonun künyesini örtmesin), puan, etiket, düğmeler.
 * Masaüstünde tablo solda, bilgi sütunu sağda. Saf, testli: bölgeler
 * çakışmaz ve ekrana sığar.
 */
export function kazandinYerlesimi(W: number, H: number, g: Kenarlar): KazandinYerlesimi {
  const M = MUHUR_SATIRI;
  if (W / Math.max(1, H) > 1.1 && W >= 760) {
    const th = Math.round(Math.min(H - g.ust - g.alt - 60, 620));
    const tw = Math.round(th / 1.5);
    const tablo = { x: Math.round(W / 2 - tw - 28), y: Math.round((H - th) / 2), w: tw, h: th };
    const sw = Math.round(Math.min(400, W / 2 - 60));
    const sx = Math.round(W / 2 + 28);
    const sh = 440;
    const sy = Math.round((H - sh) / 2);
    return { yan: true, tablo, baslikY: sy, muhurY: sy + 100, alt: { x: sx, y: sy + 100 + M + 14, w: sw, h: sh - 100 - M - 14 }, dar: false };
  }
  const dar = H < 720;
  const ust = g.ust + 10;
  const baslikH = dar ? 44 : 60;
  const altH = dar ? 156 : 196;
  const bos = H - ust - baslikH - 8 - 10 - M - 6 - altH - g.alt - 10;
  let tw = Math.min(W * 0.84, Math.max(150, bos) / 1.5, 420);
  tw = Math.round(tw);
  const th = Math.round(tw * 1.5);
  const tablo = { x: Math.round((W - tw) / 2), y: ust + baslikH + 8, w: tw, h: th };
  const muhurY = tablo.y + th + 10;
  const altY = muhurY + M + 6;
  return { yan: false, tablo, baslikY: ust, muhurY, alt: { x: 0, y: altY, w: W, h: Math.max(altH, H - g.alt - 10 - altY) }, dar };
}
