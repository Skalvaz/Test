/**
 * Yol çizim mantığı (GDD §3.3) — saf, DOM yok, testli.
 *
 * Koordinatlar "hücre birimi"dir: (cx, cy) hücresi [cx, cx+1) × [cy, cy+1)
 * aralığını kaplar, merkezi (cx + 0,5, cy + 0,5)'tir. DOM katmanı
 * (`yolCizici.ts`) CSS pikselini bu birime çevirir.
 *
 * Kurallar (§3.3 AYNEN):
 *  - Ekleme: işaretçi son düğümün 8 komşusundan birinin merkezindeki 0,42·hücre
 *    yarıçaplı daireye girerse ve hücre zincirlenebilir, renge uygun ve yolda
 *    değilse eklenir (`dortKomsu` kuralında 4 komşu).
 *  - Önceki ve şimdiki konum arası 0,25 hücre adımlarla örneklenir; her örnek
 *    ayrı işlenir (hızlı kaydırmada hücre atlanmaz).
 *  - Yapışma: işaretçi son düğümden 0,6 hücre uzaklaşmış ama hiçbir daireye
 *    girmemişse, son düğümden işaretçiye giden vektöre açıca en yakın komşu
 *    bulunur; açı farkı ≤ 22,5° ve hücre uygunsa eklenir.
 *  - Geri alma: P[n−2]'nin dairesine girince son düğüm silinir.
 *  - Halka: |P| ≥ 4, son düğüm P[0]'a komşu ve işaretçi P[0]'ın dairesine
 *    girerse halka kapanır; kapalıyken ekleme yok; P[n−1]'in dairesine dönmek
 *    halkayı açar.
 *  - `caprazSiniri`: yoldaki çapraz adım sayısı sınırı aşamaz (halkayı kapatan
 *    adım sayılmaz; çekirdeğin `yolDogrula`sı ile aynı).
 *
 * Yorum kararları (dönüşte "deviations"):
 *  - "Hiçbir daireye girmemiş" = son düğümün komşularından hiçbirinin dairesinde
 *    değil (uygun olsun olmasın). Uygunsuz bir komşunun dairesindeki parmak
 *    yapışma tetiklemez.
 *  - Eşit açılı iki yön (tam 22,5° sınırı) varsa uygun olan seçilir.
 *  - Bir örnek bir değişime yol açtıysa aynı örnek en fazla 3 kez yeniden
 *    işlenir (parmak durunca da bekleyen ekleme kaybolmasın).
 */
import { DIK, SEKIZ, icinde, zincirKomsusu, zincirRengi, zincirlenebilir } from '../core/index';
import type { Konum, OyunDurumu } from '../core/types';
import type { YolDegisimi } from '../app/sozlesme';

/** İsabet dairesi yarıçapı (hücre). */
export const ISABET_YARICAPI = 0.42;
/** Hızlı kaydırma örnekleme adımı (hücre). */
export const ORNEK_ADIMI = 0.25;
/** Yapışmanın başladığı uzaklık (hücre). */
export const YAPISMA_UZAKLIGI = 0.6;
/** Yapışma açı toleransı: 22,5° (radyan). */
export const YAPISMA_ACISI = Math.PI / 8;
/** Çift dokunuş: iki dokunuş arası en fazla (ms). */
export const CIFT_DOKUNUS_SURESI = 300;
/** Çift dokunuş: dokunuş başına en fazla hareket (hücre). */
export const CIFT_DOKUNUS_HAREKETI = 0.3;

/** Hücre biriminde nokta. */
export interface Nokta {
  x: number;
  y: number;
}

export interface YolDurumu {
  readonly yol: readonly Konum[];
  readonly halka: boolean;
}

/** Bir örneğin sonucu: yeni durum ve değişim (null = değişmedi). */
export interface YolAdimSonucu extends YolDurumu {
  degisim: YolDegisimi | null;
}

export interface YolKisiti {
  /** §15 zorunlu ilk hamle: yalnız bu hücreler (anahtar: `hucreAnahtari`). */
  zorunlu?: ReadonlySet<number> | null;
}

const BOS_KISIT: YolKisiti = {};
const R2 = ISABET_YARICAPI * ISABET_YARICAPI;
/** Yeniden işleme sınırı (bkz. dosya başı). */
const AYNI_ORNEK_TEKRAR = 3;

export function hucreAnahtari(x: number, y: number): number {
  return (y << 8) | (x & 0xff);
}

export function ayniHucre(a: Konum, b: Konum): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Noktanın altındaki (delik olmayan) hücre; tahta dışıysa null. */
export function noktadakiHucre(d: OyunDurumu, p: Nokta): Konum | null {
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (!icinde(d, x, y) || d.hucreler[y * d.w + x].delik) return null;
  return { x, y };
}

/** Nokta, hücre merkezindeki isabet dairesinin içinde mi. */
export function dairede(p: Nokta, h: Konum): boolean {
  const dx = p.x - (h.x + 0.5);
  const dy = p.y - (h.y + 0.5);
  return dx * dx + dy * dy <= R2;
}

export function yoldaMi(yol: readonly Konum[], x: number, y: number): boolean {
  for (const p of yol) if (p.x === x && p.y === y) return true;
  return false;
}

export function caprazAdimSayisi(yol: readonly Konum[]): number {
  let n = 0;
  for (let k = 1; k < yol.length; k++) if (yol[k - 1].x !== yol[k].x && yol[k - 1].y !== yol[k].y) n++;
  return n;
}

/** Kurala göre zincir komşuluk yönleri (8 ya da `dortKomsu` ile 4). */
export function komsuYonleri(d: OyunDurumu): readonly Konum[] {
  return d.kurallar.dortKomsu ? DIK : SEKIZ;
}

/** Yol bu hücreden başlatılabilir mi (§3.3.1 + §15 zorunlu küme). */
export function baslatilabilir(d: OyunDurumu, h: Konum, kisit: YolKisiti = BOS_KISIT): boolean {
  if (!zincirlenebilir(d, h.x, h.y, -1)) return false;
  if (kisit.zorunlu && !kisit.zorunlu.has(hucreAnahtari(h.x, h.y))) return false;
  return true;
}

/**
 * Hücre yolun sonuna eklenebilir mi: tahtada, yolda değil, son düğüme
 * komşu, zincir rengine uygun (joker kuralıyla), zorunlu kümede ve çapraz
 * sınırı aşılmıyor.
 */
export function eklenebilir(d: OyunDurumu, yol: readonly Konum[], h: Konum, kisit: YolKisiti = BOS_KISIT): boolean {
  const n = yol.length;
  if (n === 0 || !icinde(d, h.x, h.y) || yoldaMi(yol, h.x, h.y)) return false;
  const son = yol[n - 1];
  if (!zincirKomsusu(d, son, h)) return false;
  if (!zincirlenebilir(d, h.x, h.y, zincirRengi(d, yol))) return false;
  if (kisit.zorunlu && !kisit.zorunlu.has(hucreAnahtari(h.x, h.y))) return false;
  const sinir = d.kurallar.caprazSiniri;
  if (sinir != null && son.x !== h.x && son.y !== h.y && caprazAdimSayisi(yol) + 1 > sinir) return false;
  return true;
}

/** Halka kapatılabilir mi: |P| ≥ 4 ve son düğüm P[0]'a zincir komşusu. */
export function halkaKapanabilir(d: OyunDurumu, yol: readonly Konum[]): boolean {
  return yol.length >= 4 && zincirKomsusu(d, yol[yol.length - 1], yol[0]);
}

/** Basılan noktadan yol başlat (§3.3.1). Hücre zincirlenebilir değilse null. */
export function yolBaslat(d: OyunDurumu, p: Nokta, kisit: YolKisiti = BOS_KISIT): YolAdimSonucu | null {
  const h = noktadakiHucre(d, p);
  if (!h || !baslatilabilir(d, h, kisit)) return null;
  return { yol: [h], halka: false, degisim: 'basladi' };
}

/** Tek bir işaretçi örneğini işler (§3.3.2–4). */
export function yolAdimi(d: OyunDurumu, durum: YolDurumu, p: Nokta, kisit: YolKisiti = BOS_KISIT): YolAdimSonucu {
  const { yol, halka } = durum;
  const n = yol.length;
  const degismedi: YolAdimSonucu = { yol, halka, degisim: null };
  if (n === 0) return degismedi;
  const son = yol[n - 1];

  // Halka kapalıyken yalnız P[n−1]'in dairesine dönmek halkayı açar.
  if (halka) return dairede(p, son) ? { yol, halka: false, degisim: 'halkaAcildi' } : degismedi;

  // Geri alma: P[n−2]'nin dairesi.
  if (n >= 2 && dairede(p, yol[n - 2])) return { yol: yol.slice(0, n - 1), halka: false, degisim: 'geriAlindi' };

  // Halka: P[0]'ın dairesi.
  if (halkaKapanabilir(d, yol) && dairede(p, yol[0])) return { yol, halka: true, degisim: 'halkaKapandi' };

  // Ekleme: komşu dairesi.
  let daireVar = false;
  for (const yon of komsuYonleri(d)) {
    const h = { x: son.x + yon.x, y: son.y + yon.y };
    if (!icinde(d, h.x, h.y) || !dairede(p, h)) continue;
    daireVar = true;
    if (eklenebilir(d, yol, h, kisit)) return { yol: [...yol, h], halka: false, degisim: 'eklendi' };
  }
  if (daireVar) return degismedi;

  // Yapışma: 0,6 hücre uzakta ve hiçbir dairede değil.
  const vx = p.x - (son.x + 0.5);
  const vy = p.y - (son.y + 0.5);
  const uz = Math.hypot(vx, vy);
  if (uz <= YAPISMA_UZAKLIGI) return degismedi;
  let enIyi: Konum | null = null;
  let enIyiAci = Infinity;
  let enIyiUygun = false;
  for (const yon of komsuYonleri(d)) {
    const cos = (vx * yon.x + vy * yon.y) / (uz * Math.hypot(yon.x, yon.y));
    const aci = Math.acos(Math.max(-1, Math.min(1, cos)));
    const h = { x: son.x + yon.x, y: son.y + yon.y };
    const uygun = eklenebilir(d, yol, h, kisit);
    // Eşit açıda (tam sınır) uygun olan kazanır.
    if (aci < enIyiAci - 1e-9 || (Math.abs(aci - enIyiAci) <= 1e-9 && uygun && !enIyiUygun)) {
      enIyi = h;
      enIyiAci = aci;
      enIyiUygun = uygun;
    }
  }
  if (enIyi && enIyiUygun && enIyiAci <= YAPISMA_ACISI + 1e-9) return { yol: [...yol, enIyi], halka: false, degisim: 'eklendi' };
  return degismedi;
}

/**
 * İşaretçi `onceki`den `simdiki`ye gitti: aradaki doğru 0,25 hücre adımlarla
 * örneklenir (§3.3.2). Her değişim ayrı ayrı döner (ses ve önizleme için).
 */
export function yolSurukle(
  d: OyunDurumu,
  durum: YolDurumu,
  onceki: Nokta,
  simdiki: Nokta,
  kisit: YolKisiti = BOS_KISIT,
): { durum: YolDurumu; adimlar: YolAdimSonucu[] } {
  const dx = simdiki.x - onceki.x;
  const dy = simdiki.y - onceki.y;
  const parca = Math.max(1, Math.ceil(Math.hypot(dx, dy) / ORNEK_ADIMI));
  const adimlar: YolAdimSonucu[] = [];
  let cur: YolDurumu = durum;
  for (let i = 1; i <= parca; i++) {
    const p = { x: onceki.x + (dx * i) / parca, y: onceki.y + (dy * i) / parca };
    for (let tekrar = 0; tekrar < AYNI_ORNEK_TEKRAR; tekrar++) {
      const r = yolAdimi(d, cur, p, kisit);
      if (!r.degisim) break;
      adimlar.push(r);
      cur = r;
    }
  }
  return { durum: cur, adimlar };
}

// ─── Klavye (§13.7) ──────────────────────────────────────────────────────

/**
 * Boşluk tuşu: yol yoksa imleçteki hücreden başlatır; varsa yolu imlece
 * uzatır. İmleç P[n−2]'deyse geri alır, P[0]'daysa (koşullar uygunsa) halkayı
 * kapatır, halka kapalıyken P[n−1]'deyse halkayı açar (dokunmatikle aynı
 * kurallar). Uygun değilse null.
 */
export function boslukAdimi(d: OyunDurumu, durum: YolDurumu | null, imlec: Konum, kisit: YolKisiti = BOS_KISIT): YolAdimSonucu | null {
  if (!durum || durum.yol.length === 0) {
    if (!icinde(d, imlec.x, imlec.y) || !baslatilabilir(d, imlec, kisit)) return null;
    return { yol: [{ x: imlec.x, y: imlec.y }], halka: false, degisim: 'basladi' };
  }
  const { yol, halka } = durum;
  const n = yol.length;
  const son = yol[n - 1];
  if (halka) return ayniHucre(imlec, son) ? { yol, halka: false, degisim: 'halkaAcildi' } : null;
  if (n >= 2 && ayniHucre(imlec, yol[n - 2])) return { yol: yol.slice(0, n - 1), halka: false, degisim: 'geriAlindi' };
  if (ayniHucre(imlec, yol[0]) && halkaKapanabilir(d, yol)) return { yol, halka: true, degisim: 'halkaKapandi' };
  if (eklenebilir(d, yol, imlec, kisit)) return { yol: [...yol, { x: imlec.x, y: imlec.y }], halka: false, degisim: 'eklendi' };
  return null;
}

/** Backspace: halkayı açar ya da son düğümü siler. |P| = 1 ise null (çağıran iptal eder). */
export function geriAlAdimi(durum: YolDurumu): YolAdimSonucu | null {
  const n = durum.yol.length;
  if (durum.halka) return { yol: durum.yol, halka: false, degisim: 'halkaAcildi' };
  if (n <= 1) return null;
  return { yol: durum.yol.slice(0, n - 1), halka: false, degisim: 'geriAlindi' };
}

/** İmleci (dx, dy) yönünde bir hücre taşır; delikler atlanır, tahta dışına çıkmaz. */
export function imlecTasi(d: OyunDurumu, imlec: Konum, dx: number, dy: number): Konum {
  let x = imlec.x + dx;
  let y = imlec.y + dy;
  while (icinde(d, x, y)) {
    if (!d.hucreler[y * d.w + x].delik) return { x, y };
    x += dx;
    y += dy;
  }
  return imlec;
}

/** İmlecin ilk konumu: yolun sonu, zorunlu kümenin ilki ya da merkeze en yakın delik olmayan hücre. */
export function imlecBaslangici(d: OyunDurumu, yol: readonly Konum[] | null, zorunlu: readonly Konum[] | null): Konum {
  if (yol && yol.length) return { ...yol[yol.length - 1] };
  if (zorunlu && zorunlu.length) return { ...zorunlu[0] };
  let en: Konum = { x: 0, y: 0 };
  let enU = Infinity;
  for (let y = 0; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) {
      if (d.hucreler[y * d.w + x].delik) continue;
      const u = (2 * x - (d.w - 1)) ** 2 + (2 * y - (d.h - 1)) ** 2;
      if (u < enU) {
        enU = u;
        en = { x, y };
      }
    }
  }
  return en;
}

// ─── Çift dokunuş (§3.3 son paragraf) ────────────────────────────────────

/**
 * Özel taşa dokunuşları izler. Bir "dokunuş" sürüklemesiz (≤ 0,3 hücre)
 * bas-bırak'tır. İkinci dokunuş aynı hücrede ve ilk dokunuşun bırakılmasından
 * en fazla 300 ms sonra basıldıysa çift dokunuştur.
 *
 * Yorum: "300 ms içinde" iki dokunuş arasındaki boşluk (ilk bırakma → ikinci
 * basma) olarak ölçülür; uzun basılan ilk dokunuş da sayılır. "≤ 0,3 hücre
 * hareket" her dokunuşun kendi hareketi için uygulanır.
 */
export class CiftDokunusTakibi {
  private onceki: { hucre: Konum; birakma: number } | null = null;

  /** Dokunuş bitti. Dönüş: 'cift' (ateşle), 'ilk' (ipucu), 'yok' (dokunuş sayılmaz). */
  dokunus(hucre: Konum, basma: number, birakma: number, hareket: number): 'cift' | 'ilk' | 'yok' {
    if (hareket > CIFT_DOKUNUS_HAREKETI) {
      this.onceki = null;
      return 'yok';
    }
    const o = this.onceki;
    if (o && ayniHucre(o.hucre, hucre) && basma - o.birakma <= CIFT_DOKUNUS_SURESI && basma >= o.birakma) {
      this.onceki = null;
      return 'cift';
    }
    this.onceki = { hucre: { ...hucre }, birakma };
    return 'ilk';
  }

  sifirla(): void {
    this.onceki = null;
  }
}
