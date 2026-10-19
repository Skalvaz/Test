/**
 * Kasaba süslerinin ilkel çizimleri ve ortak tipleri (susler.ts, isCizimleri.ts).
 * Çıktılar SVG metnidir; canlı öğeler `Cizim.oge` ile toplanır. Koordinatlar
 * küresel harita birimi (genişlik 400).
 */
import type { Nokta } from './cizim';

// ───────────────────────────── Tipler ─────────────────────────────

export interface DugumGeo {
  id: number;
  j: number;
  x: number;
  y: number;
  taraf: 'sol' | 'sag';
  zemin: number;
  /** Lamba direğinde ipin bağlandığı nokta. */
  lamba: Nokta;
}

export interface BinaGeo {
  id: number;
  j: number;
  taraf: 'sol' | 'sag';
  /** Bina merkezi x, genişlik ve taban. */
  x: number;
  w: number;
  taban: number;
  /** Duvarın üst kenarı. */
  ust: number;
  cati: Nokta;
  sancak: Nokta;
  kapi: Nokta | null;
  baca: { x: number; ust: number } | null;
  agac: Nokta | null;
  /** Yel değirmeni göbeği, rasathane kubbesi ya da saat merkezi. */
  gobek: Nokta | null;
}

export interface BolgeGeo {
  m: number;
  /** Mahallenin küresel üst y'si. */
  ust: number;
  dugumler: DugumGeo[];
  binalar: BinaGeo[];
  /** Alt paydaki "Fener Koyu" tabelasının merkezi (yalnız İskele). */
  tabela: Nokta | null;
  /**
   * Alt paydaki kıyı (yalnız İskele): başlangıç iskelesinin başı (fitilin
   * çıktığı nokta, iskele zemini) ve iki yelkenlinin su çizgisindeki ortası.
   */
  kiyi: { iskele: Nokta; yelkenliler: Nokta[] } | null;
}

/**
 * Süs katmanı: `arka` (arka plan yapısının üstü), `0..4` (o terasın
 * lambasından hemen sonra), `on` (en önde) ya da `kiyi`: alt paydaki kıyı
 * (deniz, başlangıç iskelesi; yalnız İskele). Kıyı alt payın SVG'sine,
 * fitil yolunun üstüne çizilir (kemer yolu çerçeveler).
 */
export type Katman = 'arka' | 'on' | 'kiyi' | 0 | 1 | 2 | 3 | 4;

/**
 * Canlı öğe türleri (harita.css `.f-sus-<tur>`):
 *  salin  asılı tek parça salınımı (köken üstte: çan, kanca)
 *  sallan fener grubu salınımı (skewX, köken grubun üstü)
 *  dalga  tek bayrak dalgalanması (sancak)
 *  dalgalan bayrak/flama grubu dalgalanması
 *  titre  alev titremesi (köken altta)
 *  yanip  yanıp sönme (mahya harfi, işaret ışığı)
 *  nabiz  yumuşak parlama (hale)
 *  don    sürekli dönüş (değirmen kanadı, yelkovan)
 *  huzme  deniz feneri huzmesi (süpürür)
 *  suz    suda süzülme / kayık yalpası / ateş böceği
 *  yuksel yükselip sönen kıvılcım ya da buhar
 */
export type CanliTur = 'salin' | 'sallan' | 'dalga' | 'dalgalan' | 'titre' | 'yanip' | 'nabiz' | 'don' | 'huzme' | 'suz' | 'yuksel';

export interface CanliOge {
  /** Sahibi (iş kimliği ya da `sancak:<bölüm>`). */
  sahip: string;
  tur: CanliTur;
  /** Kutunun sol üstü (küresel) ve boyu (birim). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** `viewBox="0 0 w h"` içindeki SVG. */
  ic: string;
  /** CSS transform-origin (kutuya göre), ör. "50% 0". */
  koken?: string;
  /** Saniye (negatif: animasyonun ortasından başlar). */
  gecikme?: number;
  sure?: number;
  /** Yükselme mesafesi (birim; `yuksel`), dönüş yönü (`don`: -1 ters). */
  dy?: number;
  /** Kutlamada sırayla yanma sırası (işin durağan ışıklarıyla aynı sayaç). */
  sira?: number;
  /** Canlı öğe bütçesi aşıldı: aynı öğe animasyonsuz (durağan) çizilir. */
  durgun?: boolean;
}

// ─────────────────────────── Renkler ───────────────────────────

export const ISIK = '#FFE9B0';
export const SICAK = '#FFC86B';
export const IP_RENGI = '#6A4A2E';
export const HAYALET = '#2E2638';
export const HAYALET_CIZGI = '#4A4058';
/** Fener/bayrak renkleri (kapsül paleti; `hs-f<i>` gradyanları susTanimlari'nde). */
export const SUS_RENKLERI = ['#FF4D4D', '#FFB020', '#2EE07A', '#3AA8FF', '#B266FF', '#FF5FB4'] as const;
export const KREM = '#FFF3D6';

export const f = (n: number) => (Math.round(n * 10) / 10).toString();

// ─────────────────────────── Toplayıcı ───────────────────────────

/** Bir işin çizimi: katmanlara ayrılmış durağan SVG, canlı öğeler ve çapa. */
export class Cizim {
  readonly parca = new Map<Katman, string>();
  readonly canli: CanliOge[] = [];
  isik = 0;
  constructor(
    readonly id: string,
    /** Yapıldı (ışıklı); false: hayalet (sönük ön izleme). */
    readonly yanik: boolean,
    public capa: Nokta,
  ) {}

  ekle(k: Katman, svg: string): void {
    if (svg) this.parca.set(k, (this.parca.get(k) ?? '') + svg);
  }

  /** Sırayla yanan ışık özniteliği (kutlamada `--i` sırasıyla yanar). */
  sira(): string {
    return `class="f-sl" style="--i:${this.isik++}"`;
  }

  /**
   * İşin en çok kaç canlı öğesi olur (KANCALAR §B.6: mahalle başına en çok 6
   * canlı öğe → iş başına 1). İlk istenen grup(lar) canlı olur; sonrakiler
   * durağan yedeğiyle çizilir (eski Android'de kaydırma akıcı kalsın).
   */
  canliSiniri = 1;
  private readonly canliAnahtarlar: string[] = [];
  private ogeSayac = 0;

  canliMi(anahtar: string): boolean {
    if (!this.yanik) return false;
    if (this.canliAnahtarlar.includes(anahtar)) return true;
    if (this.canliAnahtarlar.length >= this.canliSiniri) return false;
    this.canliAnahtarlar.push(anahtar);
    return true;
  }

  /** Tek canlı öğe (kendi grubunda); canlı olamazsa `yedek` durağan çizilir. */
  oge(o: Omit<CanliOge, 'sahip'>, yedek?: { k: Katman; svg: string }): void {
    this.grupla(`oge:${this.ogeSayac++}`, o, yedek);
  }

  /**
   * Aynı animasyonu paylaşan parçaları tek canlı öğede toplar (ör. bir ip ve
   * üstündeki bütün fenerler); `bitir` kutuları birleştirir. Grup canlı
   * olamazsa (iş sınırı doldu) parça `yedek` ile durağan çizilir.
   */
  grupla(anahtar: string, o: Omit<CanliOge, 'sahip'>, yedek?: { k: Katman; svg: string }): void {
    if (!this.yanik) return;
    if (!this.canliMi(anahtar)) {
      if (yedek) this.ekle(yedek.k, yedek.svg);
      return;
    }
    const parca = { x: o.x, y: o.y, w: o.w, h: o.h, ic: o.ic };
    const g = this.gruplar.get(anahtar);
    if (g) g.parca.push(parca);
    else this.gruplar.set(anahtar, { o: { tur: o.tur, koken: o.koken, gecikme: o.gecikme, sure: o.sure, dy: o.dy, sira: Math.max(0, this.isik - 1) }, parca: [parca] });
  }

  /** Grupları canlı öğelere çevirir (iş çizimi bitince bir kez). */
  bitir(): void {
    for (const g of this.gruplar.values()) {
      const x0 = Math.min(...g.parca.map((p) => p.x));
      const y0 = Math.min(...g.parca.map((p) => p.y));
      const x1 = Math.max(...g.parca.map((p) => p.x + p.w));
      const y1 = Math.max(...g.parca.map((p) => p.y + p.h));
      const ic = g.parca.map((p) => `<g transform="translate(${f(p.x - x0)} ${f(p.y - y0)})">${p.ic}</g>`).join('');
      this.canli.push({ sahip: this.id, ...g.o, x: x0, y: y0, w: x1 - x0, h: y1 - y0, ic });
    }
    this.gruplar.clear();
  }

  private readonly gruplar = new Map<string, { o: Omit<CanliOge, 'sahip' | 'x' | 'y' | 'w' | 'h' | 'ic'>; parca: { x: number; y: number; w: number; h: number; ic: string }[] }>();
}

// ─────────────────────────── Geometri ───────────────────────────

/** İki nokta arası sarkık ip (ikinci derece Bezier; ortası `sarkma` kadar aşağıda). */
export function ip(a: Nokta, b: Nokta, sarkma: number) {
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 * sarkma };
  return {
    d: `M${f(a.x)} ${f(a.y)}Q${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`,
    nokta: (t: number): Nokta => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }),
  };
}

/** Eşit aralıklı n parametre (uçlar hariç). */
export function aralik(n: number, bas = 0, son = 1): number[] {
  return Array.from({ length: n }, (_, i) => bas + ((son - bas) * (i + 1)) / (n + 1));
}

/** a → b doğrusunda n nokta (uçlar dahil). */
export function dogru(a: Nokta, b: Nokta, n: number): Nokta[] {
  return Array.from({ length: n }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / Math.max(1, n - 1), y: a.y + ((b.y - a.y) * i) / Math.max(1, n - 1) }));
}

/** Elips yayı üstünde n nokta (açılar derece, 0 = sağ, saat yönünde y aşağı). */
export function yay(merkez: Nokta, rx: number, ry: number, a0: number, a1: number, n: number): Nokta[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / Math.max(1, n - 1)) * Math.PI) / 180;
    return { x: merkez.x + Math.cos(a) * rx, y: merkez.y + Math.sin(a) * ry };
  });
}

// ─────────────────────────── İlkel çizimler ───────────────────────────

/** Ip (yanıkken sıcak kahve, hayaletken sönük). */
export function ipCiz(c: Cizim, d: string, kalin = 1.1, renk: string = IP_RENGI): string {
  return `<path d="${d}" fill="none" stroke="${c.yanik ? renk : HAYALET_CIZGI}" stroke-width="${kalin}" stroke-linecap="round"/>`;
}

/** Düz şekil: yanıkken verilen renk, hayaletken sönük. */
export function sekil(c: Cizim, d: string, renk: string, ek = ''): string {
  return `<path d="${d}" fill="${c.yanik ? renk : HAYALET}" ${c.yanik ? '' : `stroke="${HAYALET_CIZGI}" stroke-width=".6"`} ${ek}/>`;
}

/** Işık noktası + hale. */
export function isik(c: Cizim, p: Nokta, r = 1.6, renk: string = ISIK, hale = 5.5): string {
  if (!c.yanik) return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r * 0.85)}" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".5"/>`;
  return `<g ${c.sira()}>${hale > 0 ? `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(hale)}" fill="url(#ftl-isik)" opacity=".5"/>` : ''}<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r)}" fill="${renk}"/></g>`;
}

/** Bir dizi ışık noktası. */
export function isiklar(c: Cizim, ps: readonly Nokta[], r = 1.5, renk: string = ISIK, hale = 5): string {
  return ps.map((p) => isik(c, p, r, renk, hale)).join('');
}

/** Büyük yumuşak hale (yanıkken). */
export function hale(c: Cizim, p: Nokta, r: number, opaklik = 0.55, gradyan = 'ftl-koz'): string {
  if (!c.yanik) return '';
  return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r)}" fill="url(#${gradyan})" opacity="${opaklik}"/>`;
}

/** Işık noktalarının yumuşak parlaması (tek canlı öğe; durağan ampullerin üstünde). */
export function parilti(c: Cizim, ps: readonly Nokta[], r = 6, sure = 2.6): void {
  if (!c.yanik || ps.length === 0) return;
  const x0 = Math.min(...ps.map((p) => p.x)) - r;
  const y0 = Math.min(...ps.map((p) => p.y)) - r;
  const x1 = Math.max(...ps.map((p) => p.x)) + r;
  const y1 = Math.max(...ps.map((p) => p.y)) + r;
  const ic = ps.map((p, i) => `<circle cx="${f(p.x - x0)}" cy="${f(p.y - y0)}" r="${f(i % 2 ? r * 0.8 : r)}" fill="url(#hs-parla)"/>`).join('');
  c.grupla('parilti', { tur: 'nabiz', x: x0, y: y0, w: x1 - x0, h: y1 - y0, ic, sure });
}

export type FenerBicimi = 'kagit' | 'lale' | 'kure' | 'kafes' | 'kavanoz' | 'koni';

/** Fener içi (viewBox 0 0 10 17): tel, kapak, gövde. */
export function fenerIc(renk: number, bicim: FenerBicimi, yanik: boolean): string {
  const g = yanik ? `url(#hs-f${renk})` : HAYALET;
  const kont = yanik ? '#3A1A0A' : HAYALET_CIZGI;
  const pir = yanik ? '#D9A441' : HAYALET_CIZGI;
  let govde: string;
  let kapak = `<rect x="3.4" y="3.6" width="3.2" height="1.6" rx=".5" fill="${pir}"/>`;
  if (bicim === 'lale')
    govde = `<path d="M1.6 7.2Q5 4.6 8.4 7.2L8.2 10.6Q5 15.6 1.8 10.6Z" fill="${g}" stroke="${kont}" stroke-width=".5"/><path d="M1.6 7.2L2.4 4.6L3.9 6.6L5 3.8L6.1 6.6L7.6 4.6L8.4 7.2" fill="${g}" stroke="${kont}" stroke-width=".5" stroke-linejoin="round"/>`;
  else if (bicim === 'kure') govde = `<circle cx="5" cy="9.6" r="4.4" fill="${g}" stroke="${kont}" stroke-width=".5"/><path d="M1.2 9.6h7.6" stroke="${kont}" stroke-width=".4" opacity=".6"/>`;
  else if (bicim === 'kafes')
    govde = `<path d="M2.6 5.6h4.8l.9 7h-6.6z" fill="${g}" stroke="${kont}" stroke-width=".6"/><path d="M5 5.6v7M2.2 9.1h5.6" stroke="${kont}" stroke-width=".5"/><path d="M1.6 12.8h6.8M3 5.4l2-1.4 2 1.4" stroke="${pir}" stroke-width=".9" fill="none"/>`;
  else if (bicim === 'kavanoz') {
    const cam = yanik ? 'url(#hs-kavanoz)' : HAYALET;
    kapak = `<rect x="2.6" y="3.8" width="4.8" height="1.8" rx=".4" fill="${yanik ? '#8A6A3A' : HAYALET_CIZGI}"/>`;
    govde = `<path d="M2.4 5.8h5.2q1 .6 1 2v5q0 1.6-1.6 1.6H3q-1.6 0-1.6-1.6v-5q0-1.4 1-2z" fill="${cam}" stroke="${yanik ? 'rgba(200,255,200,.5)' : HAYALET_CIZGI}" stroke-width=".5"/>${yanik ? '<circle cx="4" cy="10" r=".9" fill="#F4FFB0"/><circle cx="6.4" cy="12" r=".7" fill="#F4FFB0"/><circle cx="5.6" cy="8.4" r=".6" fill="#fff"/>' : ''}`;
  } else if (bicim === 'koni') {
    kapak = '';
    govde = `<path d="M5 0v4" stroke="${kont}" stroke-width=".6"/><path d="M1.2 9.4 3.4 4.6h3.2l2.2 4.8z" fill="${yanik ? '#3A4048' : HAYALET}" stroke="${yanik ? '#5A6470' : HAYALET_CIZGI}" stroke-width=".5"/>${yanik ? '<ellipse cx="5" cy="9.8" rx="2.6" ry="1.6" fill="#FFF4C2"/><path d="M1.6 9.6 0 17h10l-1.6-7.4z" fill="url(#hs-koni)" opacity=".7"/>' : ''}`;
  } else
    govde = `<ellipse cx="5" cy="9.8" rx="4.5" ry="5" fill="${g}" stroke="${kont}" stroke-width=".5"/><path d="M1.2 8.2Q5 9.4 8.8 8.2M1.2 11.4Q5 12.6 8.8 11.4" fill="none" stroke="${kont}" stroke-width=".4" opacity=".55"/><path d="M5 14.6v2" stroke="${pir}" stroke-width=".8"/>`;
  return `${bicim === 'koni' ? '' : `<path d="M5 0v4" stroke="${yanik ? '#2A1A10' : HAYALET_CIZGI}" stroke-width=".6"/>`}${kapak}${govde}`;
}

/** Asılı fener: hale durağan, fener canlı (salınır). Hayalet: durağan sönük fener. */
export function fener(c: Cizim, k: Katman, p: Nokta, renk: number, bicim: FenerBicimi, i: number, olcek = 1, canli = true, grup?: string): void {
  const w = 10 * olcek;
  const h = 17 * olcek;
  if (!c.yanik) {
    c.ekle(k, `<g transform="translate(${f(p.x - w / 2)} ${f(p.y)}) scale(${olcek})">${fenerIc(renk, bicim, false)}</g>`);
    return;
  }
  const haleR = bicim === 'koni' ? 0 : 10 * olcek;
  if (haleR) c.ekle(k, `<circle ${c.sira()} cx="${f(p.x)}" cy="${f(p.y + h * 0.58)}" r="${f(haleR)}" fill="url(#${bicim === 'kavanoz' ? 'hs-yesil' : 'ftl-koz'})" opacity=".5"/>`);
  else c.isik++;
  const ic = `<g transform="scale(${olcek})">${fenerIc(renk, bicim, true)}</g>`;
  const durgun = `<g class="f-sl" style="--i:${c.isik - 1}" transform="translate(${f(p.x - w / 2)} ${f(p.y)})">${ic}</g>`;
  // Durağan fener (sokak lambası gibi sabit olanlar).
  if (!canli) {
    c.ekle(k, durgun);
    return;
  }
  void i;
  c.grupla(grup ?? `fener:${k}`, { tur: 'sallan', x: p.x - w / 2, y: p.y, w, h, ic, koken: '50% 0', sure: 2.8 }, { k, svg: durgun });
}

export type BayrakBicimi = 'ucgen' | 'kare' | 'kurdele' | 'uzun' | 'catal';

/** Bayrak içi (viewBox 0 0 w h; üst kenar ipte). */
export function bayrakIc(renk: string, bicim: BayrakBicimi, yanik: boolean, w: number, h: number): string {
  const g = yanik ? renk : HAYALET;
  const kont = yanik ? 'rgba(0,0,0,.35)' : HAYALET_CIZGI;
  if (bicim === 'kare') return `<rect x=".4" y=".4" width="${f(w - 0.8)}" height="${f(h - 0.8)}" fill="${g}" stroke="${kont}" stroke-width=".5"/>${yanik ? `<path d="M${f(w / 2)} .4V${f(h - 0.4)}" stroke="${KREM}" stroke-width="${f(w * 0.24)}" opacity=".85"/>` : ''}`;
  if (bicim === 'kurdele') return `<path d="M${f(w * 0.5)} 0C${f(w * 0.95)} ${f(h * 0.3)} ${f(w * 0.05)} ${f(h * 0.62)} ${f(w * 0.55)} ${f(h)}" fill="none" stroke="${g}" stroke-width="${f(w * 0.4)}" stroke-linecap="round"/>`;
  if (bicim === 'uzun') return `<path d="M0 0H${f(w)}L${f(w * 0.62)} ${f(h)}L${f(w * 0.38)} ${f(h * 0.8)}Z" fill="${g}" stroke="${kont}" stroke-width=".5"/>`;
  if (bicim === 'catal') return `<path d="M0 0H${f(w)}V${f(h)}L${f(w / 2)} ${f(h * 0.72)}L0 ${f(h)}Z" fill="${g}" stroke="${kont}" stroke-width=".5"/>${yanik ? `<path d="M${f(w * 0.5)} ${f(h * 0.18)}v${f(h * 0.3)}" stroke="${KREM}" stroke-width="${f(w * 0.22)}" opacity=".7"/>` : ''}`;
  return `<path d="M0 0H${f(w)}L${f(w / 2)} ${f(h)}Z" fill="${g}" stroke="${kont}" stroke-width=".5"/>${yanik ? `<path d="M${f(w * 0.2)} 1.2H${f(w * 0.8)}" stroke="#fff" stroke-width=".7" opacity=".35"/>` : ''}`;
}

/** Asılı bayrak (canlı; hayalet durağan). */
export function bayrak(c: Cizim, k: Katman, p: Nokta, renk: string, bicim: BayrakBicimi, i: number, w = 7, h = 9, grup?: string): void {
  if (!c.yanik) {
    c.ekle(k, `<g transform="translate(${f(p.x - w / 2)} ${f(p.y)})">${bayrakIc(renk, bicim, false, w, h)}</g>`);
    return;
  }
  c.isik++;
  void i;
  const ic = bayrakIc(renk, bicim, true, w, h);
  c.grupla(grup ?? `bayrak:${k}`, { tur: 'dalgalan', x: p.x - w / 2, y: p.y, w, h, ic, koken: '50% 0', sure: 1.8 }, { k, svg: `<g transform="translate(${f(p.x - w / 2)} ${f(p.y)})">${ic}</g>` });
}

/** Alev içi (viewBox 0 0 12 20; dip ortası 6,20). */
export function alevIc(): string {
  return `<path d="M6 20C1 20 .4 14.6 2.6 11 3.6 13 4.4 13.4 4.6 12.2 4 8.6 6 4.6 7 0 7.6 4 11.8 8.6 11 14.6 10.6 18 8.6 20 6 20Z" fill="url(#hs-alev)"/><path d="M6 20C3.6 20 3.4 16.8 4.8 14.6 5.2 15.8 5.8 15.8 6 15 6 13 6.6 11 7.4 9.6 8 12 9.4 14.4 8.8 17.2 8.4 19 7.4 20 6 20Z" fill="#FFE9A0"/>`;
}

/** Titreyen alev: dip noktası p, yükseklik h. Hale durağan. Hayalet: çizilmez (söndü). */
export function alev(c: Cizim, k: Katman, p: Nokta, h: number, i: number, haleOlcek = 1.1, canli = true): void {
  const w = h * 0.6;
  if (!c.yanik) return;
  c.ekle(k, `<circle ${c.sira()} cx="${f(p.x)}" cy="${f(p.y - h * 0.45)}" r="${f(h * haleOlcek)}" fill="url(#ftl-koz)" opacity=".62"/>`);
  const durgun = `<g class="f-sl" style="--i:${c.isik - 1}" transform="translate(${f(p.x - w / 2)} ${f(p.y - h)}) scale(${f(w / 12)} ${f(h / 20)})">${alevIc()}</g>`;
  if (!canli) {
    c.ekle(k, durgun);
    return;
  }
  void i;
  // Bir işin bütün alevleri tek canlı öğede titrer.
  c.grupla('alev', { tur: 'titre', x: p.x - w / 2, y: p.y - h, w, h, ic: `<g transform="scale(${f(w / 12)} ${f(h / 20)})">${alevIc()}</g>`, koken: '50% 100%', sure: 1.1 }, { k, svg: durgun });
}

/** Yükselen kıvılcımlar (alev ya da baca üstü). */
export function kivilcim(c: Cizim, p: Nokta, n: number, yukseklik: number, renk = '#FFD15C', yayilma = 10): void {
  if (!c.yanik) return;
  for (let i = 0; i < n; i++) {
    const dx = (((i * 37) % 11) / 10 - 0.5) * yayilma;
    // Bir işin bütün kıvılcımları tek canlı öğede yükselir (dikey kaymalı).
    c.grupla('kivilcim', {
      tur: 'yuksel',
      x: p.x + dx - 1.5,
      y: p.y - 3,
      w: 3,
      h: 3,
      ic: `<g transform="translate(0 ${f(((i * 7) % 5) * -yukseklik * 0.12)})"><circle cx="1.5" cy="1.5" r="1.5" fill="${renk}" opacity=".35"/><circle cx="1.5" cy="1.5" r=".9" fill="#FFF4C2"/></g>`,
      sure: 1.8,
      dy: yukseklik,
    });
  }
}

/** Yazı (Nunito; mahya harfi, tabela). */
export function yazi(metin: string, x: number, y: number, boy: number, renk: string, ek = ''): string {
  return `<text x="${f(x)}" y="${f(y)}" font-family="'Nunito', ui-rounded, sans-serif" font-weight="800" font-size="${f(boy)}" text-anchor="middle" fill="${renk}" ${ek}>${metin}</text>`;
}
