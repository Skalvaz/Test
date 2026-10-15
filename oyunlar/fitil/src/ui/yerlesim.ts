/**
 * Ekran yerleşimi (GDD §13.7), saf işlevler — DOM yok, testli.
 *
 * Dikey telefon (en/boy ≤ 0,75): üst bant %0–20 (HUD + gökyüzü), tahta
 * %20–86, alt çubuk %86–100 (güvenli alan dahil). Hücre:
 *   hucre = floor(min((G − 32)/w, (0,66·Y − 24)/h, 64))
 * Hücre 40 px altına düşerse üst bant %14'e iner (tahta bandı %72 olur).
 * Yüzdeler güvenli alan çıkarılmış kullanılabilir yüksekliğe (Y) göredir.
 *
 * Masaüstü / yatay (en/boy > 0,75): sağda 320 px panel, tahta panelin
 * solundaki alanda ortalanır, hucre = min(64, (Y − 160)/h).
 *
 * Görünür gök (fişek ek): dikeyde üst bandın büyük kısmını DOM HUD plakası
 * kaplar; gök fişekleri HUD'un alt kenarı ile tahtanın üstü arasındaki
 * şeritte patlar (`gorunurGok`). HUD'un alt kenarı burada CSS ölçülerinden
 * tahmin edilir (`hudAltTahmini`); arayüz HUD kurulunca gerçeğini ölçer.
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
  kip: 'dikey' | 'yatay';
  ekranW: number;
  ekranH: number;
  guvenli: Kenarlar;
  /** Üst bant oranı (dikeyde 0,20 ya da 0,14; yatayda 0). */
  ustOran: number;
  /** Dikey: HUD'un oturduğu üst bant. Yatay: tahtanın üstündeki kasaba payı. */
  ustBant: Dikdortgen;
  /** Dikey: alt düğme çubuğu (alttaki güvenli alan dahil). Yatay: null. */
  altBant: Dikdortgen | null;
  /** Yatay: sağ panel. Dikey: null. */
  panel: Dikdortgen | null;
  /** Tahtaya ayrılan alan (HUD'lar çıkarılmış). Çizicinin `alanAyarla`'sına gider. */
  tahtaAlani: Dikdortgen;
  /** Gökyüzü bandı: göğe uçan kıvılcımlar ve havai fişekler. */
  gokBandi: Dikdortgen;
  /**
   * (Fişek ek) Dikey: HUD plakası dar kipte mi (`f-dar`: üst bant %14 ya da
   * ekran < 700 px). Yatay: false.
   */
  hudDar: boolean;
  /** (Fişek ek) Dikey: DOM HUD'un (plaka + hamle madalyonu) tahmini alt kenarı. Yatay: güvenli alan üstü. */
  hudAlt: number;
  /**
   * (Fişek ek) Görünür gök: HUD'un alt kenarından tahtanın üst kenarına
   * (yatayda sağ panelin solu). Gök fişekleri burada patlar; üstünde kalan
   * kısım (y < gorunurGok.y) HUD'un arkasıdır.
   */
  gorunurGok: Dikdortgen;
  /** §13.7 hücre boyu (CSS px). */
  hucre: number;
  /** Tahtanın kendisi: alan içinde ortalanmış hücre·w × hücre·h. */
  tahta: Dikdortgen;
}

export const PANEL_GENISLIK = 320;
export const PANEL_PAY = 16;
export const HUCRE_EN_BUYUK = 64;
export const HUCRE_EN_KUCUK = 40;
export const UST_ORAN = 0.2;
export const UST_ORAN_DAR = 0.14;
export const ALT_SINIR = 0.86;

/**
 * HUD plakası ölçüleri (src/ui/stil/hud.css ile aynı tutulmalı): üst pay,
 * plaka yüksekliği, hamle madalyonu çapı ve dış halkası (box-shadow 5 px).
 */
export const HUD_PLAKA = { pay: 8, boy: 62, madalyon: 66, darPay: 5, darBoy: 58, darMadalyon: 60, halka: 5 } as const;

/** Dikey HUD dar kipte mi (hud.css `.f-dar`). */
export function hudDarMi(ustOran: number, ekranH: number): boolean {
  return ustOran < UST_ORAN || ekranH < 700;
}

/** Dikey HUD'un alt kenarı (güvenli alan üstü + pay + plaka ortası + madalyon yarıçapı + halka). */
export function hudAltTahmini(guvenliUst: number, dar: boolean): number {
  const P = HUD_PLAKA;
  return dar ? guvenliUst + P.darPay + P.darBoy / 2 + P.darMadalyon / 2 + P.halka : guvenliUst + P.pay + P.boy / 2 + P.madalyon / 2 + P.halka;
}

/**
 * Görünür gök şeridi: `hudAlt` (ölçülen ya da tahmini) ile tahtanın üstü
 * arası. Yatayda üstte HUD yok; sağ panelin solundaki alan.
 */
export function gorunurGokHesapla(y: Pick<Yerlesim, 'kip' | 'ekranW' | 'guvenli' | 'tahta' | 'panel' | 'hudAlt'>, hudAlt: number | null = null): Dikdortgen {
  if (y.kip === 'yatay') {
    const x = y.guvenli.sol;
    const sag = y.panel ? y.panel.x - PANEL_PAY : y.ekranW - y.guvenli.sag;
    const ust = y.guvenli.ust;
    return { x, y: ust, w: Math.max(1, sag - x), h: Math.max(0, y.tahta.y - ust) };
  }
  const ust = Math.round(hudAlt ?? y.hudAlt);
  return { x: 0, y: ust, w: y.ekranW, h: Math.max(0, y.tahta.y - ust) };
}

/** GDD §13.7: en/boy oranı > 0,75 ise masaüstü/yatay yerleşim. */
export function yatayMi(ekranW: number, ekranH: number): boolean {
  return ekranH > 0 && ekranW / ekranH > 0.75;
}

/** Dikey hücre formülü; `ustOran` üst bandın payı (0,20 / 0,14). */
export function dikeyHucre(G: number, Y: number, tw: number, th: number, ustOran: number): number {
  const bant = (ALT_SINIR - ustOran) * Y;
  return Math.floor(Math.min((G - 32) / tw, (bant - 24) / th, HUCRE_EN_BUYUK));
}

export function yerlesimHesapla(ekranW: number, ekranH: number, tahtaW: number, tahtaH: number, guvenli: Kenarlar = SIFIR_KENAR): Yerlesim {
  const tw = Math.max(1, tahtaW);
  const th = Math.max(1, tahtaH);
  const G = Math.max(1, ekranW - guvenli.sol - guvenli.sag);
  const Y = Math.max(1, ekranH - guvenli.ust - guvenli.alt);

  if (!yatayMi(ekranW, ekranH)) {
    let ustOran = UST_ORAN;
    let hucre = dikeyHucre(G, Y, tw, th, ustOran);
    if (hucre < HUCRE_EN_KUCUK) {
      ustOran = UST_ORAN_DAR;
      hucre = dikeyHucre(G, Y, tw, th, ustOran);
    }
    hucre = Math.max(8, hucre);
    const ustSon = Math.round(guvenli.ust + ustOran * Y);
    const altBas = Math.round(guvenli.ust + ALT_SINIR * Y);
    const tahtaAlani = { x: guvenli.sol, y: ustSon, w: G, h: altBas - ustSon };
    const tW = hucre * tw;
    const tH = hucre * th;
    const tahta = {
      x: Math.round(tahtaAlani.x + (tahtaAlani.w - tW) / 2),
      y: Math.round(tahtaAlani.y + (tahtaAlani.h - tH) / 2),
      w: tW,
      h: tH,
    };
    const hudDar = hudDarMi(ustOran, ekranH);
    const hudAlt = hudAltTahmini(guvenli.ust, hudDar);
    return {
      kip: 'dikey',
      ekranW,
      ekranH,
      guvenli,
      ustOran,
      ustBant: { x: 0, y: 0, w: ekranW, h: ustSon },
      altBant: { x: 0, y: altBas, w: ekranW, h: ekranH - altBas },
      panel: null,
      tahtaAlani,
      gokBandi: { x: 0, y: 0, w: ekranW, h: ustSon },
      hudDar,
      hudAlt,
      gorunurGok: gorunurGokHesapla({ kip: 'dikey', ekranW, guvenli, tahta, panel: null, hudAlt }),
      hucre,
      tahta,
    };
  }

  // Yatay / masaüstü: üst ve alt 80 px pay (Y − 160). Yalnız çok kısa
  // ekranda (yatay telefon, Y < 480) pay orantılı küçülür.
  const pay = Y >= 480 ? 80 : Math.round(Y / 6);
  const panelW = Math.min(PANEL_GENISLIK, Math.max(240, Math.round(G * 0.36)));
  const panel = {
    x: ekranW - guvenli.sag - PANEL_PAY - panelW,
    y: guvenli.ust + PANEL_PAY,
    w: panelW,
    h: Math.max(1, Y - 2 * PANEL_PAY),
  };
  const alanX = guvenli.sol;
  const alanW = Math.max(1, panel.x - PANEL_PAY - alanX);
  const tahtaAlani = { x: alanX, y: guvenli.ust + pay, w: alanW, h: Math.max(1, Y - 2 * pay) };
  const hucre = Math.max(8, Math.floor(Math.min(HUCRE_EN_BUYUK, tahtaAlani.h / th, (alanW - 32) / tw)));
  const tW = hucre * tw;
  const tH = hucre * th;
  const tahta = {
    x: Math.round(tahtaAlani.x + (tahtaAlani.w - tW) / 2),
    y: Math.round(tahtaAlani.y + (tahtaAlani.h - tH) / 2),
    w: tW,
    h: tH,
  };
  const ustSon = guvenli.ust + pay;
  return {
    kip: 'yatay',
    ekranW,
    ekranH,
    guvenli,
    ustOran: 0,
    ustBant: { x: 0, y: 0, w: ekranW, h: ustSon },
    altBant: null,
    panel,
    tahtaAlani,
    gokBandi: { x: 0, y: 0, w: ekranW, h: Math.max(ustSon, tahta.y) },
    hudDar: false,
    hudAlt: guvenli.ust,
    gorunurGok: gorunurGokHesapla({ kip: 'yatay', ekranW, guvenli, tahta, panel, hudAlt: guvenli.ust }),
    hucre,
    tahta,
  };
}
