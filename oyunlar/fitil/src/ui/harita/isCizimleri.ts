/**
 * 48 kasaba işinin harita çizimleri (docs/KANCALAR.md §B.3). Her mahallede:
 *  - "giriş" yuvası: mahalle şeridinin hemen üstü, ortada (kemer, kapı,
 *    çeşme, ateş çanakları…); düğümler arasında kalır, fitil altından geçer;
 *  - "cep ipleri": bir düğümün lamba direğinden karşı kenara gerilen ip
 *    (fener dizisi, flama) — karşıdaki üst terasın yüzünün önünde, alt
 *    binanın çatısının üstündeki boş gökte;
 *  - binalar (kandil, çelenk, baca, burç) ve arka plan simgeleri (Çarşı
 *    kubbesi ve mahyası, saat kulesi, tepe sırtı);
 *  - tepe yuvası (ortada, mahallenin üst kenarı): taç işler için.
 * Koordinatlar mahalle yerelinde yazılır (`P(g, x, y)`); çizim küreseldir.
 */
import { MAHALLELER } from '../../app/katalog';
import type { KasabaIsi } from '../../app/katalog';
import type { Nokta } from './cizim';
import {
  Cizim,
  HAYALET,
  HAYALET_CIZGI,
  ISIK,
  KREM,
  IP_RENGI,
  SICAK,
  alev,
  aralik,
  bayrak,
  dogru,
  f,
  fener,
  hale,
  ip,
  ipCiz,
  isik,
  isiklar,
  kivilcim,
  parilti,
  sekil,
  yay,
  yazi,
} from './susIlkel';
import type { BayrakBicimi, BolgeGeo, FenerBicimi, Katman } from './susIlkel';

/** Çizim bağlamı: başka işlerin durumu (ortak sahne parçaları için). */
export interface CizimBaglami {
  /** İş bu çizimde çiziliyor mu (yapıldı ya da hayalet). */
  ciziliyor(id: string): boolean;
}

export type IsCizici = (c: Cizim, g: BolgeGeo, b: CizimBaglami, is: KasabaIsi) => void;

/** Mahalle yerel koordinatı → küresel nokta. */
const P = (g: BolgeGeo, x: number, y: number): Nokta => ({ x, y: g.ust + y });
const vurgu = (g: BolgeGeo) => MAHALLELER[g.m]?.vurgu ?? '#FFB020';

/** Giriş yuvasının tabanı (mahalle şeridinin üst kenarı, ortada). */
const GIRIS_Y = 612;

// ─────────────────────────── Şablonlar ───────────────────────────

/** Cep ipi: j. düğümün lamba direğinden karşı kenara. */
function cepIpi(g: BolgeGeo, j: number, sarkma: number) {
  const d = g.dugumler[j];
  const a = d.lamba;
  const b = { x: d.taraf === 'sol' ? 412 : -12, y: a.y - 14 };
  return ip(a, b, sarkma);
}

/**
 * Dizinin ipi: canlıyken ip, ampulleri ve üstündeki fener/bayraklar TEK canlı
 * öğedir ('dizi' grubu; uçlar neredeyse sabit, orta rüzgârda sallanır).
 */
function diziIpi(c: Cizim, k: Katman, y: ReturnType<typeof ip>, tur: 'sallan' | 'dalgalan', kalin: number, ampuller: readonly Nokta[] = []): void {
  if (!c.yanik) {
    c.ekle(k, ipCiz(c, y.d, kalin) + isiklar(c, ampuller, 1, ISIK, 3.5));
    return;
  }
  const ps = [...Array.from({ length: 21 }, (_, i) => y.nokta(i / 20)), ...ampuller];
  const x0 = Math.min(...ps.map((p) => p.x)) - 4;
  const y0 = Math.min(...ps.map((p) => p.y)) - 4;
  const x1 = Math.max(...ps.map((p) => p.x)) + 4;
  const y1 = Math.max(...ps.map((p) => p.y)) + 4;
  const ampulSvg = ampuller.map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="3.5" fill="url(#ftl-isik)" opacity=".5"/><circle cx="${f(p.x)}" cy="${f(p.y)}" r="1" fill="${ISIK}"/>`).join('');
  const ipSvg = `<path d="${y.d}" fill="none" stroke="${IP_RENGI}" stroke-width="${kalin}" stroke-linecap="round"/>${ampulSvg}`;
  c.grupla('dizi', { tur, x: x0, y: y0, w: x1 - x0, h: y1 - y0, ic: `<g transform="translate(${f(-x0)} ${f(-y0)})">${ipSvg}</g>`, koken: '50% 0', sure: tur === 'sallan' ? 2.8 : 1.8 }, { k, svg: ipSvg });
}

function fenerDizisi(c: Cizim, g: BolgeGeo, j: number, n: number, bicim: FenerBicimi, renkler: readonly number[], sarkma = 22, olcek = 1): void {
  const y = cepIpi(g, j, sarkma);
  const k = j as Katman;
  diziIpi(c, k, y, 'sallan', 1.1);
  aralik(n, 0.04, 0.92).forEach((t, i) => fener(c, k, y.nokta(t), renkler[i % renkler.length], bicim, i, olcek, true, 'dizi'));
  c.capa = y.nokta(0.42);
}

function flamaDizisi(c: Cizim, g: BolgeGeo, j: number, n: number, bicim: BayrakBicimi, renkler: readonly string[], sarkma = 16, w = 7, h = 9): void {
  const y = cepIpi(g, j, sarkma);
  const k = j as Katman;
  const ts = aralik(n, 0.03, 0.95);
  // Bayrak aralarında küçük ampuller (ipe bağlı, ip ile sallanır).
  const ampul = ts.slice(0, -1).map((t, i) => y.nokta((t + ts[i + 1]) / 2));
  diziIpi(c, k, y, 'dalgalan', 0.9, ampul);
  ts.forEach((t, i) => bayrak(c, k, y.nokta(t), renkler[i % renkler.length], bicim, i, w, h, 'dizi'));
  c.capa = y.nokta(0.42);
}

/** Su yansıması: ışığın altında daralan, kesik yatay çizgiler. */
function yansima(x: number, y: number, renk: string, w: number): string {
  return `<path d="M${f(x - w / 2)} ${f(y)}h${f(w)}M${f(x - w * 0.36)} ${f(y + 3.6)}h${f(w * 0.72)}M${f(x - w * 0.2)} ${f(y + 7.2)}h${f(w * 0.4)}" stroke="${renk}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>`;
}

/** Taş/ahşap sütun. */
function sutun(c: Cizim, x0: number, y0: number, w: number, h: number, renk: string, kenar: string): string {
  if (!c.yanik) return `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".6"/>`;
  return `<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="${renk}"/><path d="M${f(x0 + 0.6)} ${f(y0)}v${f(h)}" stroke="${kenar}" stroke-width="1.2" opacity=".7"/><path d="M${f(x0 + w - 0.6)} ${f(y0)}v${f(h)}" stroke="#000" stroke-width="1.2" opacity=".35"/>`;
}

/**
 * Kayık (su çizgisi y, burnu yön tarafında); `b` ölçek. Yanıkken pruva
 * feneri büyük bir hale ve suda uzun bir yansımayla telefonda da seçilir
 * (yeni oyuncunun ilk kasaba işi, KANCALAR §C.1).
 */
function kayik(c: Cizim, k: Katman, x: number, y: number, yon: 1 | -1, renk: number, i: number, b = 1): void {
  // Ay biçimli gövde: kıç alçak, pruva (yon tarafı) kalkık; küpeşte açık renk.
  const u = (dx: number) => f(x + yon * dx * b);
  const v = (dy: number) => f(y + dy * b);
  const govde = `M${u(-15)} ${v(-4)}Q${u(-13)} ${v(3)} ${u(-6)} ${v(3.4)}H${u(7)}Q${u(14)} ${v(3)} ${u(17)} ${v(-6.5)}Q${u(4)} ${v(-3.4)} ${u(-15)} ${v(-4)}z`;
  const kupeste = `M${u(-15)} ${v(-4)}Q${u(4)} ${v(-3.4)} ${u(17)} ${v(-6.5)}`;
  c.ekle(k, sekil(c, govde, '#3A2638') + `<path d="${kupeste}" fill="none" stroke="${c.yanik ? '#B08A9A' : HAYALET_CIZGI}" stroke-width="1.3" stroke-linecap="round"/>`);
  if (c.yanik) c.ekle(k, `<path d="M${u(-9)} ${v(-0.6)}H${u(9)}" stroke="#1E1424" stroke-width="1" opacity=".7"/><path d="M${f(x - 13 * b)} ${f(y + 4.6 * b)}h${f(26 * b)}" stroke="#FFC86B" stroke-width="1" opacity=".25"/>`);
  // Pruva direği ve fener.
  const dx = x + yon * 13 * b;
  const fx = dx + yon * 3 * b;
  const fy = y - 21 * b;
  c.ekle(k, ipCiz(c, `M${f(dx)} ${f(y - 5 * b)}Q${f(dx + yon * b)} ${f(y - 14 * b)} ${f(fx)} ${f(fy)}`, 1.2 * b, '#3A2416'));
  if (c.yanik) c.ekle(k, hale(c, { x: fx, y: fy + 8 * b }, 16 * b, 0.6) + yansima(fx, y + 6 * b, '#FFC86B', 7 * b));
  fener(c, k, { x: fx, y: fy }, renk, 'kagit', i, 0.8 * b);
}

/**
 * Alt paydaki yelkenlinin (altPayCiz; su çizgisi ortası `y`, burun sağda)
 * pruvasına kâğıt fener: kısa direk, fener, aydınlanan küpeşte ve yansıma.
 */
function yelkenliFeneri(c: Cizim, y: Nokta, renk: number, i: number): void {
  const bx = y.x + 20;
  const fy = y.y - 22;
  if (c.yanik) c.ekle('kiyi', `<path d="M${f(y.x - 23)} ${f(y.y + 0.6)}h46" stroke="#8A6A8A" stroke-width="1.3" stroke-linecap="round"/>` + hale(c, { x: bx + 4, y: fy + 9 }, 18, 0.6) + yansima(bx + 4, y.y + 14, '#FFC86B', 9));
  c.ekle('kiyi', ipCiz(c, `M${f(bx)} ${f(y.y)}Q${f(bx + 1)} ${f(y.y - 12)} ${f(bx + 4)} ${f(fy)}`, 1.4, '#3A2416'));
  fener(c, 'kiyi', { x: bx + 4, y: fy }, renk, 'kagit', i, 1);
}

/** Bina saçağından sarkan küçük fenerler. */
function sacakFenerleri(c: Cizim, g: BolgeGeo, j: number, oranlar: readonly number[], bicim: FenerBicimi, renk: number, olcek: number, dy = 1, i0 = 0): void {
  const b = g.binalar[j];
  const x0 = b.x - b.w / 2;
  oranlar.forEach((o, i) => fener(c, j as Katman, { x: x0 + o * b.w, y: b.ust + dy }, renk, bicim, i0 + i, olcek));
}

/** Tepe sırtı (cizim.ts arkaPlan, mahalle 5): iki kübik parça, yerel koordinat (x0 y0 … x3 y3). */
const TEPE_SIRTI = [
  [0, 380, 80, 330, 160, 360, 220, 340],
  [220, 340, 280, 320, 340, 300, 400, 330],
] as const;

/** Tepe sırtının x'teki yerel y'si (iki kübik de x'te tekdüze: ikiye bölmeyle). */
function tepeSirti(x: number): number {
  const p = x <= 220 ? TEPE_SIRTI[0] : TEPE_SIRTI[1];
  const k = (a: number, b: number, c: number, d: number, t: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (k(p[0], p[2], p[4], p[6], m) < x) lo = m;
    else hi = m;
  }
  return k(p[1], p[3], p[5], p[7], (lo + hi) / 2);
}

/** Tepe sırtının x0 → x1 arasını izleyen çizgi (küresel SVG yolu). */
function tepeSirtYolu(g: BolgeGeo, x0: number, x1: number, dy = 0): string {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 4));
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return `${i ? 'L' : 'M'}${f(x)} ${f(g.ust + tepeSirti(x) + dy)}`;
  }).join('');
}

// ─────────────────────────── Çizimler ───────────────────────────

export const CIZIMLER: Record<string, IsCizici> = {
  // ═════════ İskele ═════════
  // İskele'nin kıyı işleri alt payda (katman `kiyi`): fitilin çıktığı
  // başlangıç iskelesi, yelkenliler ve deniz. Mahallenin içinde düğüm, yol
  // ve şerit arasında sıkışmazlar; denize, iskeleye otururlar.
  'iskele.kayikFenerleri': (c, g) => {
    const k = g.kiyi!;
    // İki yelkenlinin pruvasına fener; iskelenin solunda bağlı bir kayık.
    k.yelkenliler.forEach((y, i) => yelkenliFeneri(c, y, i === 0 ? 1 : 3, i));
    kayik(c, 'kiyi', 112, k.iskele.y - 60, 1, 0, 2, 1.3);
    c.capa = { x: 112, y: k.iskele.y - 70 };
  },
  'iskele.iskeleBayraklari': (c, g) => flamaDizisi(c, g, 2, 9, 'ucgen', [vurgu(g), '#FF4D4D', '#FFB020', KREM, '#2EE07A'], 16),
  'iskele.fenerDizisi': (c, g) => fenerDizisi(c, g, 1, 6, 'kagit', [1, 0, 3, 5, 2, 4], 22),
  // Başlangıç iskelesinin başında, fitil altından geçer (kemer yolun üstüne çizilir).
  'iskele.kandilliKemer': (c, g) => {
    const { x: cx, y: y0 } = g.kiyi!.iskele;
    const sol = cx - 24;
    const sag = cx + 24;
    const omuz = y0 - 40;
    let s = sutun(c, sol - 3, omuz, 6, 40, '#4A2E1A', '#7A5432') + sutun(c, sag - 3, omuz, 6, 40, '#4A2E1A', '#7A5432');
    const kemer = `M${f(sol)} ${f(omuz + 2)}A24 22 0 0 1 ${f(sag)} ${f(omuz + 2)}`;
    s += `<path d="${kemer}" fill="none" stroke="${c.yanik ? '#5A3A22' : HAYALET_CIZGI}" stroke-width="5"/>`;
    if (c.yanik) s += `<path d="${kemer}" fill="none" stroke="#8A6040" stroke-width="1" transform="translate(0 -2)"/>`;
    c.ekle('kiyi', s);
    const ps = yay({ x: cx, y: omuz + 2 }, 27, 25, 180, 360, 11);
    c.ekle('kiyi', isiklar(c, ps, 1.7, '#FFD15C', 5.5));
    fener(c, 'kiyi', { x: cx, y: omuz - 20 }, 0, 'kagit', 0, 0.8);
    parilti(c, ps, 6, 2.2);
    c.capa = { x: cx, y: omuz };
  },
  // Kıyıdaki kayalıkta, sağda; huzme denizin üstünü süpürür.
  'iskele.denizFeneri': (c, g) => {
    const t = g.kiyi!.iskele.y - 54;
    let s = sekil(c, `M346 ${f(t + 10)}Q350 ${f(t - 6)} 364 ${f(t - 8)}Q378 ${f(t - 14)} 392 ${f(t - 8)}Q404 ${f(t - 6)} 412 ${f(t)}V${f(t + 12)}H346z`, '#1A1426');
    s += sekil(c, `M372 ${f(t - 8)}L375 ${f(t - 84)}H385L388 ${f(t - 8)}z`, '#E4DCEA');
    if (c.yanik) s += `<path d="M373.4 ${f(t - 30)}h13.3M374 ${f(t - 56)}h12" stroke="#B8381C" stroke-width="7"/><path d="M376 ${f(t - 84)}V${f(t - 8)}" stroke="#fff" stroke-width="1.4" opacity=".4"/>`;
    s += sekil(c, `M370 ${f(t - 88)}h20v4h-20z`, '#2A2232');
    s += c.yanik ? `<rect ${c.sira()} x="374" y="${f(t - 100)}" width="12" height="12" rx="1.5" fill="#FFF4C2"/>` : `<rect x="374" y="${f(t - 100)}" width="12" height="12" rx="1.5" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".6"/>`;
    s += sekil(c, `M371 ${f(t - 100)}L380 ${f(t - 110)}L389 ${f(t - 100)}z`, '#3A2416');
    s += hale(c, { x: 380, y: t - 94 }, 30, 0.7);
    c.ekle('kiyi', s);
    if (c.yanik) {
      c.ekle('kiyi', yansima(380, t + 14, '#FFE3A0', 12));
      c.oge({ tur: 'huzme', x: 380 - 120, y: t - 108, w: 120, h: 28, ic: `<path d="M120 14L0 0V28Z" fill="url(#hs-huzme)"/>`, koken: '100% 50%', sure: 7 });
      c.oge({ tur: 'nabiz', x: 362, y: t - 112, w: 36, h: 36, ic: `<circle cx="18" cy="18" r="18" fill="url(#hs-parla)"/>`, sure: 1.8 });
    }
    c.capa = { x: 380, y: t - 60 };
  },
  // Taç: alt paydaki "FENER KOYU" tabelası (HTML; ampulleri harita.ts takar).
  'iskele.tabela': (c, g) => {
    if (g.tabela) c.capa = g.tabela;
    // 22 ampul sırayla yanar (harita.ts); kutlama süresi buna göre.
    c.isik = 22;
  },

  // ═════════ Çarşı ═════════
  'carsi.dukkanKandilleri': (c, g) => {
    // Pencere aralarına ve dış köşeye; düğüme bakan köşe boş (küçük ekranda
    // düğüm düğmesi binanın o köşesine taşar).
    sacakFenerleri(c, g, 1, [0.07, 0.335, 0.665], 'kafes', 1, 0.72, 2);
    sacakFenerleri(c, g, 3, [0.07, 0.335, 0.665], 'kafes', 1, 0.72, 2, 3);
    const b = g.binalar[1];
    c.capa = { x: b.x, y: b.ust + 10 };
  },
  'carsi.kemerCelengi': (c, g) => {
    const tum: Nokta[] = [];
    for (const j of [2, 4]) {
      const b = g.binalar[j];
      const x0 = b.x - b.w / 2;
      // Saçak boyunca üç sarkık çelenk.
      for (let k = 0; k < 3; k++) {
        const a = { x: x0 - 3 + (k * (b.w + 6)) / 3, y: b.ust - 3 };
        const e = { x: x0 - 3 + ((k + 1) * (b.w + 6)) / 3, y: b.ust - 3 };
        const y = ip(a, e, 4);
        c.ekle(j as Katman, ipCiz(c, y.d, 1.6, '#2E5A2E'));
        const ps = [0.2, 0.5, 0.8].map((t) => y.nokta(t));
        c.ekle(j as Katman, isiklar(c, ps, 1.2, '#FFE3A0', 3.5));
        tum.push(...ps);
      }
      if (j === 2) {
        // Kemerli pencerelerin üstü (2 sıra × 3 pencere); düğüme bitişik
        // sütun hariç (küçük ekranda düğüm düğmesi o pencerelere değer).
        const yakin = b.taraf === 'sag' ? 0 : 2;
        for (let sat = 0; sat < 2; sat++)
          for (let sut = 0; sut < 3; sut++) {
            if (sut === yakin) continue;
            const wx = x0 + 9 + (sut * (b.w - 26)) / 2 + 4;
            const wy = b.ust + 12 + sat * 22 + 4;
            const ps = yay({ x: wx, y: wy }, 5.6, 5.6, 180, 360, 5);
            c.ekle(j as Katman, isiklar(c, ps, 0.8, '#FFE9B0', 2.5));
            tum.push(ps[2]);
          }
      }
    }
    parilti(c, tum, 5, 2.4);
    const b = g.binalar[2];
    c.capa = { x: b.x, y: b.ust + 10 };
  },
  'carsi.laleFenerleri': (c, g) => fenerDizisi(c, g, 1, 6, 'lale', [4, 5, 1, 4, 5, 1], 22),
  'carsi.kubbeKandilleri': (c, g) => {
    // Arka plandaki büyük kubbenin dış çizgisi: sol etekten tepeye. Sağ yanı
    // 8. düğümün, lambasının ve terasın, yan kubbeler binaların ve terasların
    // arkasında kalır: oralara kandil konmaz (düğüm önde, kubbe arkada).
    const acikta = (p: Nokta) =>
      g.dugumler.every((d) => {
        const dugumde = Math.abs(p.x - d.x) < 38 && p.y > d.y - 38 && p.y < d.y + 50;
        const lambada = Math.abs(p.x - d.lamba.x) < 12 && p.y > d.lamba.y - 16 && p.y < d.zemin;
        return !dugumde && !lambada;
      });
    const ana = yay(P(g, 200, 400), 112, 95, 180, 270, 10).filter(acikta);
    let s = '';
    if (c.yanik) s += `<path d="M88 ${f(g.ust + 400)}A112 95 0 0 1 200 ${f(g.ust + 305)}" fill="none" stroke="#FFB020" stroke-width="5" opacity=".08"/>`;
    s += isiklar(c, ana, 1.4, '#FFE3A0', 4.5);
    // Alem (hilal) ve hale.
    const alem = P(g, 200, 296);
    s += hale(c, alem, 14, 0.7);
    s += c.yanik
      ? `<path d="M200 ${f(g.ust + 305)}v-6" stroke="#D9A441" stroke-width="1.4"/><path ${c.sira()} d="M203.5 ${f(alem.y - 5)}a5 5 0 1 0 0 8a4 4 0 1 1 0-8z" fill="#FFD15C"/>`
      : `<path d="M200 ${f(g.ust + 305)}v-6" stroke="${HAYALET_CIZGI}" stroke-width="1.4"/>`;
    c.ekle('arka', s);
    parilti(c, ana, 5.5, 3);
    c.capa = P(g, 200, 330);
  },
  'carsi.mahyaYazisi': (c, g) => {
    // Harfler minareler arasındaki mahya dizisine asılı; 8. düğümün lambasından
    // uzak, kubbe çizgisi E ile N arasından geçer.
    const harfler = ['Ş', 'E', 'N', 'L', 'İ', 'K'];
    let s = '';
    harfler.forEach((h, i) => {
      const x = 68 + i * 24;
      const ym = 292 + Math.sin((Math.PI * (x - 46)) / 310) * 26;
      const p = P(g, x, ym + 2);
      s += `<path d="M${f(x)} ${f(p.y - 2)}v5" stroke="${c.yanik ? '#8A6A3A' : HAYALET_CIZGI}" stroke-width=".6"/>`;
      if (!c.yanik) {
        s += yazi(h, x, p.y + 16, 14, HAYALET, `stroke="${HAYALET_CIZGI}" stroke-width=".6"`);
        return;
      }
      s += `<circle ${c.sira()} cx="${f(x)}" cy="${f(p.y + 11)}" r="11" fill="url(#ftl-koz)" opacity=".45"/>`;
      // Harfler tek canlı öğede birlikte yanıp söner (mahya ampulleri gibi).
      const harf = yazi(h, 8, 15, 15, '#FFF0C0', 'stroke="#FFB020" stroke-width="3" stroke-opacity=".55" paint-order="stroke"');
      c.grupla('harf', { tur: 'yanip', x: x - 8, y: p.y + 2, w: 16, h: 18, ic: harf, sure: 2.4 }, { k: 3, svg: `<g transform="translate(${f(x - 8)} ${f(p.y + 2)})">${harf}</g>` });
    });
    c.ekle(3, s);
    c.capa = P(g, 128, 318);
  },
  'carsi.carsiKapisi': (c, g) => {
    // Çarşı binasının (6. bölüm, alt terasta) cephesinde taçkapı: terasa
    // basar, geçidi orta pencere sütununun önünde, tepeliği saçağa varır.
    // Çizim kapının taban ortasına göre (y yukarı eksi), `k` ölçeğiyle.
    const b = g.binalar[0];
    const k = 0.6;
    const M = (x: number, y: number): Nokta => ({ x: b.x + x * k, y: b.taban + y * k });
    let s = '';
    // Kapının içi (karanlık geçit), sütunlar, sivri kemer, tepelik.
    if (c.yanik) s += '<path d="M-21 0V-40Q-19 -60 0 -68Q19 -60 21 -40V0z" fill="#140A20"/>';
    s += sutun(c, -30, -40, 9, 40, '#4A3C5C', '#6A5A80') + sutun(c, 21, -40, 9, 40, '#4A3C5C', '#6A5A80');
    s += sekil(c, 'M-32 -44h13v4h-13zM19 -44h13v4h-13z', '#5A4A70');
    s += `<path d="M-25.5 -42Q-24 -64 0 -74Q24 -64 25.5 -42" fill="none" stroke="${c.yanik ? '#5A4A70' : HAYALET_CIZGI}" stroke-width="5"/>`;
    s += sekil(c, 'M-9 -76a9 7 0 0 1 18 0z', '#4A3A60');
    if (c.yanik) s += `<path d="M0 -83v-5" stroke="#D9A441" stroke-width="1.2"/><path ${c.sira()} d="M2.6 -92a3.6 3.6 0 1 0 0 6a3 3 0 1 1 0-6z" fill="#FFD15C"/>`;
    c.ekle(0, `<g transform="translate(${f(b.x)} ${f(b.taban)}) scale(${k})">${s}</g>`);
    const kemer: Nokta[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      // Sivri kemerin iki kolu (ikinci derece Bezier).
      const sol = t <= 0.5;
      const u = sol ? t * 2 : (t - 0.5) * 2;
      const a = sol ? { x: -25.5, y: -42 } : { x: 0, y: -74 };
      const d = sol ? { x: -24, y: -64 } : { x: 24, y: -64 };
      const e = sol ? { x: 0, y: -74 } : { x: 25.5, y: -42 };
      kemer.push(M((1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * d.x + u * u * e.x, (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * d.y + u * u * e.y - 3));
    }
    const sutunlar = [...dogru(M(-32, -36), M(-32, -6), 4), ...dogru(M(32, -36), M(32, -6), 4)];
    c.ekle(0, isiklar(c, kemer, 1.2, '#FFE3A0', 4) + isiklar(c, sutunlar, 1, '#FFC86B', 3.2));
    fener(c, 0, M(0, -66), 1, 'kafes', 0, 0.9 * k);
    parilti(c, [...kemer, ...sutunlar], 4.5, 2);
    c.capa = M(0, -40);
  },

  // ═════════ Liman ═════════
  'liman.direkFenerleri': (c, g, b) => {
    // Gemi 12. bölümün rıhtımının önündeki suda (sağ alt); fenerler direk
    // tepelerinde ve pruvada.
    const M = gemiGovdesi(c, g, b, 'liman.direkFenerleri');
    fener(c, 0, M(300, -76), 1, 'kafes', 0, 0.75);
    fener(c, 0, M(352, -68), 0, 'kafes', 1, 0.75);
    fener(c, 0, M(266, -13), 2, 'kafes', 2, 0.55);
    if (c.yanik) c.ekle(0, yansima(M(300, 0).x, M(0, 9).y, '#FFC86B', 7) + yansima(M(352, 0).x, M(0, 9).y, '#FFC86B', 7));
    c.capa = M(326, -55);
  },
  'liman.halatFlamalari': (c, g) => flamaDizisi(c, g, 4, 8, 'kare', ['#3AA8FF', '#FFB020', '#FF4D4D', '#2EE07A', '#B266FF', '#FFF3D6'], 14, 7, 7),
  'liman.vincIsiklari': (c, g) => {
    const z = g.ust + 463;
    const kol = z - 123;
    let s = '';
    // Kule (kafes), kabin, kol, karşı ağırlık, kanca halatı.
    s += sekil(c, `M380 ${f(z)}L382 ${f(kol)}H390L392 ${f(z)}z`, '#1E3440');
    if (c.yanik) for (let y = z - 8; y > kol + 6; y -= 12) s += `<path d="M381 ${f(y)}L391 ${f(y - 12)}M391 ${f(y)}L381 ${f(y - 12)}" stroke="#2E4A56" stroke-width=".8"/>`;
    s += sekil(c, `M266 ${f(kol)}H412V${f(kol + 4)}H266z`, '#2A4A56');
    s += sekil(c, `M378 ${f(kol + 4)}h16v12h-16z`, '#2A4A56');
    s += sekil(c, `M398 ${f(kol + 4)}h12v8h-12z`, '#16262E');
    s += ipCiz(c, `M386 ${f(kol - 14)}L268 ${f(kol)}M386 ${f(kol - 14)}L410 ${f(kol)}M386 ${f(kol)}V${f(kol - 14)}`, 0.8, '#3A5A66');
    c.ekle(1, s);
    if (c.yanik) c.ekle(1, `<rect ${c.sira()} x="381" y="${f(kol + 7)}" width="10" height="5" rx="1" fill="#FFE3A0"/>`);
    const kolIsik = dogru({ x: 272, y: kol + 2 }, { x: 376, y: kol + 2 }, 11);
    const kuleIsik = dogru({ x: 386, y: z - 10 }, { x: 386, y: kol + 22 }, 7);
    c.ekle(1, isiklar(c, kolIsik, 1.3, '#FFE9B0', 4.5) + isiklar(c, kuleIsik, 1.2, '#FFE9B0', 4));
    parilti(c, [...kolIsik, ...kuleIsik], 5, 2.6);
    // Uç ışıkları (kırmızı, yanıp söner).
    for (const [x, y, i] of [[268, kol - 1, 0], [386, kol - 16, 1]] as const) {
      if (!c.yanik) {
        c.ekle(1, isik(c, { x, y }, 1.6));
        continue;
      }
      c.ekle(1, `<circle ${c.sira()} cx="${x}" cy="${f(y)}" r="1.8" fill="#FF4D4D"/>`);
      void i;
      c.grupla('isaret', { tur: 'yanip', x: x - 6, y: y - 6, w: 12, h: 12, ic: `<circle cx="6" cy="6" r="6" fill="url(#hs-kirmizi)"/><circle cx="6" cy="6" r="2" fill="#FFB3A8"/>`, sure: 1.4 });
    }
    // Kanca ve sandık (salınır).
    const kanca = `<path d="M8 0V26" stroke="#3A5A66" stroke-width=".8"/><path d="M5 26q3 4 6 0" fill="none" stroke="#5A7A86" stroke-width="1.2"/><rect x="0" y="30" width="16" height="11" fill="#5A3A22" stroke="#2A1A10" stroke-width=".8"/><path d="M0 35.5h16M5 30v11M11 30v11" stroke="#3A2416" stroke-width=".7"/>${c.yanik ? '<circle cx="8" cy="30" r="1.2" fill="#FFE9B0"/>' : ''}`;
    if (c.yanik) c.oge({ tur: 'salin', x: 282, y: kol + 4, w: 16, h: 41, ic: kanca, koken: '50% 0', sure: 3.4 }, { k: 1, svg: `<g transform="translate(282 ${f(kol + 4)})">${kanca}</g>` });
    else c.ekle(1, `<g transform="translate(282 ${f(kol + 4)})" opacity=".8">${kanca}</g>`);
    c.capa = P(g, 330, 345);
  },
  'liman.mendirekFenerleri': (c, g) => {
    // Uzaktaki liman ağzı (arka planın denizi): 11. bölümün ambar çatısının
    // ve çatı fişeğinin üstünde, ondan ayrık.
    const y = g.ust + 478;
    let s = sekil(c, `M-12 ${f(y - 2)}H124Q130 ${f(y - 2)} 130 ${f(y + 3)}V${f(y + 7)}H-12z`, '#1A1E2A');
    if (c.yanik) s += `<path d="M-12 ${f(y - 2)}H124" stroke="#4A5A6A" stroke-width="1"/>`;
    for (const [x, renk, i] of [[22, '#FF4D4D', 0], [118, '#2EE07A', 1]] as const) {
      s += sekil(c, `M${x - 4} ${f(y - 2)}L${x - 3} ${f(y - 22)}H${x + 3}L${x + 4} ${f(y - 2)}z`, i === 0 ? '#C8C0D0' : '#C8C0D0');
      if (c.yanik) s += `<path d="M${x - 3.6} ${f(y - 9)}h7.2M${x - 3.3} ${f(y - 16)}h6.6" stroke="${renk}" stroke-width="3"/>`;
      s += sekil(c, `M${x - 5} ${f(y - 24)}h10v2h-10z`, '#2A2232');
      s += c.yanik ? `<circle ${c.sira()} cx="${x}" cy="${f(y - 27)}" r="2.6" fill="${renk}"/>${yansima(x, y + 8, renk, 7)}` : isik(c, { x, y: y - 27 }, 2.2);
      if (c.yanik) c.grupla('isaret', { tur: 'yanip', x: x - 10, y: y - 37, w: 20, h: 20, ic: `<circle cx="10" cy="10" r="10" fill="url(#hs-${i === 0 ? 'kirmizi' : 'yesil'})"/><circle cx="10" cy="10" r="2.8" fill="#fff" opacity=".85"/>`, sure: 2.2 });
    }
    c.ekle('arka', s);
    c.capa = P(g, 70, 464);
  },
  'liman.gemiDonanmasi': (c, g, b) => {
    const M = gemiGovdesi(c, g, b, 'liman.gemiDonanmasi');
    const pruva = M(264, -10);
    const d1 = M(300, -78);
    const d2 = M(352, -70);
    const kic = M(394, -10);
    const a = dogru(pruva, d1, 10).slice(1);
    const m = dogru(d1, d2, 7).slice(1, -1);
    const k = dogru(d2, kic, 10).slice(0, -1);
    c.ekle(0, ipCiz(c, `M${f(pruva.x)} ${f(pruva.y)}L${f(d1.x)} ${f(d1.y)}L${f(d2.x)} ${f(d2.y)}L${f(kic.x)} ${f(kic.y)}`, 0.6, '#3A4A56'));
    const renk = ['#FF4D4D', '#FFB020', '#2EE07A', '#3AA8FF', '#FFE9B0'];
    const hepsi = [...a, ...m, ...k];
    let s = '';
    hepsi.forEach((p, i) => (s += isik(c, p, 1.15, renk[i % renk.length], 3.4)));
    // Lombozlar ve güverte.
    const lomboz = dogru(M(296, -4), M(368, -4), 6);
    s += isiklar(c, lomboz, 1.25, '#FFE3A0', 3.6);
    c.ekle(0, s);
    parilti(c, hepsi, 4, 2);
    c.capa = M(330, -40);
  },
  'liman.limanKapisi': (c, g) => {
    // 14. bölümün ambarının büyük kapısında: sütunlar kapıyı çevreler,
    // ışıklı kiriş kapı kemerinin üstünde, pencere sırasının altında kalır;
    // çapa levhası kapının ağzında asılı. Çizim kapının taban ortasına göre
    // (y yukarı eksi), `k` ölçeğiyle.
    const bn = g.binalar[3];
    const k = 0.72;
    const M = (x: number, y: number): Nokta => ({ x: bn.x + x * k, y: bn.taban + y * k });
    let s = sutun(c, -30, -38, 10, 38, '#3A4A56', '#5A6E7A') + sutun(c, 20, -38, 10, 38, '#3A4A56', '#5A6E7A');
    s += sekil(c, 'M-32 -42h14v4h-14zM18 -42h14v4h-14z', '#2A3A44');
    s += sekil(c, 'M-33 -50H33V-43H-33z', '#4A2E1A');
    if (c.yanik) s += '<path d="M-33 -47H33" stroke="#C8A070" stroke-width="1.6" stroke-dasharray="2 1.4"/>';
    // Çapa levhası.
    s += ipCiz(c, 'M0 -43v5', 0.8, '#8A6A3A');
    s += c.yanik ? `<circle ${c.sira()} cx="0" cy="-27" r="11" fill="#0E2A3A" stroke="#D9A441" stroke-width="1.6"/>` : `<circle cx="0" cy="-27" r="11" fill="${HAYALET}" stroke="${HAYALET_CIZGI}"/>`;
    if (c.yanik) s += '<g fill="none" stroke="#FFD15C" stroke-width="1.5" stroke-linecap="round"><path d="M0 -33v12M-4 -30h8M-6 -24q6 6 12 0"/><circle cx="0" cy="-34.5" r="1.4"/></g>';
    c.ekle(3, `<g transform="translate(${f(bn.x)} ${f(bn.taban)}) scale(${k})">${s}</g>`);
    const ust = dogru(M(-31, -52), M(31, -52), 9);
    c.ekle(3, isiklar(c, ust, 1.2, '#FFE9B0', 3.8));
    parilti(c, ust, 4.5, 2.2);
    const nabiz = M(-16, -43);
    if (c.yanik) c.oge({ tur: 'nabiz', x: nabiz.x, y: nabiz.y, w: 32 * k, h: 32 * k, ic: `<circle cx="${f(16 * k)}" cy="${f(16 * k)}" r="${f(16 * k)}" fill="url(#hs-parla)"/>`, sure: 2.4 });
    fener(c, 3, M(-25, -38), 1, 'kafes', 0, 0.55);
    fener(c, 3, M(25, -38), 1, 'kafes', 1, 0.55);
    c.capa = M(0, -30);
  },

  // ═════════ Saat Kulesi ═════════
  // Kule işleri (çelenk, kadran, çan) 20. bölümün terasındaki saat kulesinde
  // (`binalar[4]`, kadran merkezi `gobek`). Arka plandaki silüet kule fitil
  // yolunun arkasında boydan boya durur (kadranı 19–20 arasındaki yolun
  // üstünde, tepesi mahalle şeridinin altında): süsleri orada yola ve
  // düğümlere binerdi. Çeşme 19. bölümün konağının önünde, sokakta.
  'saatKulesi.sokakLambalari': (c, g) => {
    const basl: Nokta[] = [];
    g.dugumler.forEach((d, j) => {
      const x = d.taraf === 'sol' ? 16 : 384;
      const z = d.zemin - 4;
      let s = '';
      if (c.yanik) s += `<ellipse cx="${x}" cy="${f(z - 1)}" rx="20" ry="5" fill="#FFB020" opacity=".16"/>`;
      s += `<path d="M${x} ${f(z)}v-34M${x - 7} ${f(z - 30)}h14" stroke="${c.yanik ? '#1A1220' : HAYALET_CIZGI}" stroke-width="2.2"/><path d="M${x - 3} ${f(z)}h6" stroke="${c.yanik ? '#1A1220' : HAYALET_CIZGI}" stroke-width="3"/>`;
      c.ekle(j as Katman, s);
      for (const dx of [-7, 7]) {
        fener(c, j as Katman, { x: x + dx, y: z - 30 }, 1, 'kafes', j * 2 + (dx > 0 ? 1 : 0), 0.65, false);
        basl.push({ x: x + dx, y: z - 23 });
      }
    });
    parilti(c, basl, 7, 3);
    const d0 = g.dugumler[0];
    c.capa = { x: d0.taraf === 'sol' ? 16 : 384, y: d0.zemin - 30 };
  },
  'saatKulesi.kuleCelengi': (c, g) => {
    // Kulenin gövdesi: kornişin altından tabana, pencere sıraları arasında
    // dört sarkık çelenk; köşelerden inen ışık dizileri.
    const k = g.binalar[4];
    const x0 = k.x - k.w / 2;
    const x1 = k.x + k.w / 2;
    const tum: Nokta[] = [];
    for (const dy of [38, 63, 89, 118]) {
      const yy = ip({ x: x0 - 2, y: k.ust + dy }, { x: x1 + 2, y: k.ust + dy }, 4);
      c.ekle(4, ipCiz(c, yy.d, 1.7, '#2E5A2E'));
      const ps = aralik(5, 0, 1).map((t) => yy.nokta(t));
      c.ekle(4, isiklar(c, ps, 1.25, '#FFE3A0', 4.5));
      tum.push(...ps);
    }
    const kose = [...dogru({ x: x0, y: k.ust + 37 }, { x: x0, y: k.taban - 3 }, 10), ...dogru({ x: x1, y: k.ust + 37 }, { x: x1, y: k.taban - 3 }, 10)];
    c.ekle(4, isiklar(c, kose, 1.1, '#FFC86B', 3.5));
    parilti(c, tum, 5.5, 2.8);
    c.capa = { x: k.x, y: k.ust + 78 };
  },
  'saatKulesi.balkonFenerleri': (c, g) => fenerDizisi(c, g, 1, 6, 'kure', [1, 0, 1, 5, 1, 0], 22),
  'saatKulesi.cesmeIsiklari': (c, g) => {
    // Duvar çeşmesi: 19. bölümün konağının önünde, sokakta (iki pencere
    // sütununun arasında). Çizim çeşmenin taban ortasına göre yerel
    // birimlerde, `o` ölçeğiyle.
    const b = g.binalar[3];
    const o = 0.66;
    const x = b.x;
    const y0 = b.taban + 3;
    const n = (p: Nokta): Nokta => ({ x: x + p.x * o, y: y0 + p.y * o });
    let s = sekil(c, 'M-22 0V-32H22V0z', '#7A7288');
    s += sekil(c, 'M-26 -36h52v5h-52z', '#8A8298');
    s += sekil(c, 'M-9 -36a9 7 0 0 1 18 0z', '#6A6278');
    s += c.yanik ? '<path d="M-12 -6V-18Q-12 -28 0 -30Q12 -28 12 -18V-6z" fill="#1A1424"/>' : '';
    s += sekil(c, 'M-18 -7h36l-3 7h-30z', '#5A5268');
    if (c.yanik) {
      s += '<path d="M-16 -6h32" stroke="#6AE0FF" stroke-width="2" opacity=".85"/><ellipse cx="0" cy="-6" rx="18" ry="5" fill="#6AE0FF" opacity=".22"/>';
      s += '<path d="M0 -18q3 4 1 12" fill="none" stroke="#BFF4FF" stroke-width="1.4" stroke-linecap="round"/><rect x="-2" y="-20" width="4" height="2.4" rx="1" fill="#D9A441"/>';
    }
    const yayIsik = yay({ x: 0, y: -18 }, 15, 15, 195, 345, 7);
    s += isiklar(c, yayIsik, 1.1, '#BFF4FF', 3.5) + isiklar(c, [{ x: -22, y: -40 }, { x: 22, y: -40 }], 1.8, '#FFE3A0', 6);
    c.ekle(3, `<g transform="translate(${f(x)} ${f(y0)}) scale(${o})">${s}</g>`);
    if (c.yanik) {
      const su = n({ x: -20, y: -16 });
      const dere = n({ x: -6, y: -20 });
      c.grupla('su', { tur: 'nabiz', x: su.x, y: su.y, w: 40 * o, h: 16 * o, ic: `<g transform="scale(${o})"><ellipse cx="20" cy="10" rx="20" ry="6" fill="url(#hs-su)"/></g>`, sure: 1.2 });
      c.grupla('su', { tur: 'nabiz', x: dere.x, y: dere.y, w: 12 * o, h: 16 * o, ic: `<g transform="scale(${o})"><path d="M6 0q4 6 1 14" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/></g>`, sure: 1.2 });
    }
    parilti(c, yayIsik.map(n), 3.4, 2.4);
    c.capa = n({ x: 0, y: -20 });
  },
  'saatKulesi.aydinlikKadran': (c, g) => {
    // Kulenin kendi kadranının üstüne (bina kadranı r 13): içten ışıklı kadran.
    const k = g.binalar[4];
    const m = k.gobek ?? { x: k.x, y: k.ust + 15 };
    let s = hale(c, m, 30, 0.55);
    s += c.yanik
      ? `<circle cx="${f(m.x)}" cy="${f(m.y)}" r="14" fill="url(#hs-kadran)" stroke="#D9A441" stroke-width="2"/><circle cx="${f(m.x)}" cy="${f(m.y)}" r="15.8" fill="none" stroke="#FFD15C" stroke-width=".8" opacity=".7"/>`
      : `<circle cx="${f(m.x)}" cy="${f(m.y)}" r="14" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width="1.2"/>`;
    const saat = Array.from({ length: 12 }, (_, i) => ({ x: m.x + Math.sin((i * Math.PI) / 6) * 11.2, y: m.y - Math.cos((i * Math.PI) / 6) * 11.2 }));
    s += isiklar(c, saat, 0.85, '#B8642E', 0);
    s += `<path d="M${f(m.x)} ${f(m.y)}l-4.8 -3" stroke="${c.yanik ? '#3A2416' : HAYALET_CIZGI}" stroke-width="1.7" stroke-linecap="round"/><circle cx="${f(m.x)}" cy="${f(m.y)}" r="1.3" fill="${c.yanik ? '#3A2416' : HAYALET_CIZGI}"/>`;
    c.ekle(4, s);
    if (c.yanik) {
      const yelkovan = '<path d="M10 10V2.2" stroke="#3A2416" stroke-width="1.3" stroke-linecap="round"/><circle cx="10" cy="2.8" r="1" fill="#FFD15C"/><circle cx="10" cy="10" r="1" fill="#D9A441"/>';
      c.oge({ tur: 'don', x: m.x - 10, y: m.y - 10, w: 20, h: 20, ic: yelkovan, koken: '50% 50%', sure: 24 }, { k: 4, svg: `<g transform="translate(${f(m.x - 10)} ${f(m.y - 10)})">${yelkovan}</g>` });
      c.oge({ tur: 'nabiz', x: m.x - 18, y: m.y - 18, w: 36, h: 36, ic: '<circle cx="18" cy="18" r="18" fill="url(#hs-parla)" opacity=".7"/>', sure: 3.2 });
    }
    // Kadran mahallenin üst sınırının biraz üstünde: çapa sınırın içinde, hemen altında.
    c.capa = { x: m.x, y: Math.max(m.y, g.ust + 2) };
  },
  'saatKulesi.senlikCani': (c, g) => {
    // Kulenin tepesinde, saçağın altındaki demir kolda (kadranın sağında):
    // kubbeli şapkasıyla çan, üstünde ışıklı taç.
    const k = g.binalar[4];
    const x1 = k.x + k.w / 2;
    const ay = k.ust + 10;
    const bx = x1 + 19;
    let s = hale(c, { x: bx, y: ay + 9 }, 24, 0.55);
    s += `<path d="M${f(x1)} ${f(ay)}H${f(bx + 2)}M${f(x1)} ${f(ay + 12)}Q${f(x1 + 3)} ${f(ay + 2)} ${f(bx - 5)} ${f(ay)}" fill="none" stroke="${c.yanik ? '#3A2A2A' : HAYALET_CIZGI}" stroke-width="2" stroke-linecap="round"/>`;
    s += sekil(c, `M${f(bx - 9)} ${f(ay + 0.5)}Q${f(bx)} ${f(ay - 12)} ${f(bx + 9)} ${f(ay + 0.5)}z`, '#5A3A30');
    s += c.yanik ? `<path d="M${f(bx)} ${f(ay - 5)}v-5" stroke="#D9A441" stroke-width="1.2"/><circle ${c.sira()} cx="${f(bx)}" cy="${f(ay - 11)}" r="1.8" fill="#FFD15C"/>` : '';
    c.ekle(4, s);
    const tac = yay({ x: bx, y: ay }, 14, 13, 190, 350, 7);
    c.ekle(4, isiklar(c, tac, 1.25, '#FFE3A0', 4.5));
    const can = `<path d="M7 0v3" stroke="#3A2416" stroke-width="1"/><path d="M2 14Q2 4 7 3Q12 4 12 14L13.4 16H.6Z" fill="url(#ftl-pirinc)" stroke="#8A4E1C" stroke-width=".6"/><circle cx="7" cy="17" r="1.6" fill="#8A4E1C"/>`;
    const cx = bx - 7;
    const cy = ay + 0.5;
    if (c.yanik) c.oge({ tur: 'salin', x: cx, y: cy, w: 14, h: 19, ic: can, koken: '50% 0', sure: 1.6 }, { k: 4, svg: `<g transform="translate(${f(cx)} ${f(cy)})">${can}</g>` });
    else c.ekle(4, `<g transform="translate(${f(cx)} ${f(cy)})" opacity=".6">${can.replace('url(#ftl-pirinc)', HAYALET)}</g>`);
    parilti(c, tac, 5.5, 1.8);
    c.capa = { x: bx, y: Math.max(ay + 10, g.ust + 2) };
  },

  // ═════════ Bahçeler ═════════
  'bahceler.cardakFenerleri': (c, g) => fenerDizisi(c, g, 1, 6, 'kure', [1, 5, 0, 1, 2, 5], 22),
  'bahceler.dilekAgaci': (c, g) => {
    const renk = ['#FF5FB4', '#FFB020', '#3AA8FF', '#2EE07A', '#FF4D4D', '#B266FF', '#FFF3D6'];
    let i = 0;
    for (const j of [1, 3]) {
      const a = g.binalar[j].agac;
      if (!a) continue;
      const ps = [
        { x: a.x - 14, y: a.y + 14 },
        { x: a.x - 5, y: a.y + 19 },
        { x: a.x + 6, y: a.y + 17 },
        { x: a.x + 15, y: a.y + 12 },
        { x: a.x - 1, y: a.y + 4 },
      ];
      ps.forEach((p) => bayrak(c, j as Katman, p, renk[i % renk.length], 'kurdele', i++, 3.6, 13, `agac:${j}`));
      const ampul = [{ x: a.x - 8, y: a.y - 6 }, { x: a.x + 6, y: a.y - 10 }, { x: a.x + 12, y: a.y + 2 }, { x: a.x - 14, y: a.y + 4 }, { x: a.x, y: a.y + 8 }];
      c.ekle(j as Katman, isiklar(c, ampul, 1.1, '#FFF4C2', 4));
      parilti(c, ampul, 5, 2.6);
    }
    const a = g.binalar[1].agac;
    if (a) c.capa = { x: Math.min(a.x, 380), y: a.y + 6 };
  },
  'bahceler.atesBocegiKavanozlari': (c, g) => {
    fenerDizisi(c, g, 3, 7, 'kavanoz', [2], 20, 0.85);
    if (c.yanik) {
      const y = cepIpi(g, 3, 20);
      for (let i = 0; i < 6; i++) {
        const p = y.nokta(0.1 + i * 0.15);
        c.grupla(`bocek:${i % 2}`, { tur: 'suz', x: p.x - 2 + ((i * 7) % 9) - 4, y: p.y + 16 + ((i * 5) % 9), w: 4, h: 4, ic: '<circle cx="2" cy="2" r="2" fill="#E8FF8A" opacity=".4"/><circle cx="2" cy="2" r="1" fill="#F4FFC0"/>', gecikme: -(i % 2) * 1.7, sure: 3.4 });
      }
    }
  },
  'bahceler.gulKemeri': (c, g) => {
    // Bahçeler'in ilk köşkünün (21. bölüm) kapısında: kemer köşkün önünde,
    // terasta durur (alt sıradaki iki pencerenin arasında). Çizim kemerin
    // taban ortasına göre yerel birimlerde, `o` ölçeğiyle.
    const b = g.binalar[0];
    const o = 0.68;
    const x = b.x;
    const y0 = b.taban + 3;
    const n = (p: Nokta): Nokta => ({ x: x + p.x * o, y: y0 + p.y * o });
    let s = '';
    for (const sx of [-27, 21]) {
      s += sutun(c, sx, -36, 6, 36, '#2A4A2E', '#4A7A4E');
      if (c.yanik) for (let y = -32; y < 0; y += 6) s += `<path d="M${sx} ${y}l6 4M${sx + 6} ${y}l-6 4" stroke="#1A3A1E" stroke-width=".7"/>`;
    }
    s += `<path d="M-24 -34A24 24 0 0 1 24 -34" fill="none" stroke="${c.yanik ? '#1E4A26' : HAYALET_CIZGI}" stroke-width="7" stroke-linecap="round"/>`;
    if (c.yanik) {
      // Yaprak kümeleri.
      for (const p of yay({ x: 0, y: -34 }, 24, 24, 175, 365, 12)) s += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="3.6" fill="#2E6A36"/>`;
      for (const p of [...dogru({ x: -24, y: -30 }, { x: -24, y: -6 }, 4), ...dogru({ x: 24, y: -30 }, { x: 24, y: -6 }, 4)]) s += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="3" fill="#2E6A36"/>`;
    }
    // Güller.
    const gul = [...yay({ x: 0, y: -34 }, 25, 25, 185, 355, 9), { x: -25, y: -20 }, { x: -23, y: -9 }, { x: 25, y: -22 }, { x: 23, y: -11 }];
    const gRenk = ['#FF5FB4', '#FF4D4D', '#FFC2E3'];
    gul.forEach((p, i) => {
      s += c.yanik ? `<g ${c.sira()}><circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.6" fill="${gRenk[i % 3]}"/><circle cx="${f(p.x - 0.5)}" cy="${f(p.y - 0.5)}" r="1" fill="#fff" opacity=".55"/></g>` : `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="2.2" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".5"/>`;
    });
    const isikP = yay({ x: 0, y: -34 }, 30, 30, 190, 350, 8);
    s += isiklar(c, isikP, 1.1, '#FFF4C2', 4);
    c.ekle(0, `<g transform="translate(${f(x)} ${f(y0)}) scale(${o})">${s}</g>`);
    parilti(c, isikP.map(n), 3.6, 2);
    c.capa = n({ x: 0, y: -36 });
  },
  'bahceler.yuzenKandiller': (c, g) => {
    // 23. bölümün köşkünün önünde, terasın üstünde süs havuzu (ağaç sağda).
    const b = g.binalar[2];
    const hx = b.x - 11;
    const hy = b.taban + 5;
    let s = '';
    s += sekil(c, `M${f(hx - 31)} ${f(hy)}a31 6 0 1 0 62 0a31 6 0 1 0 -62 0z`, '#3A4A3A');
    s += c.yanik ? `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="28" ry="4.4" fill="#0A1A2A" stroke="#4A7A6A" stroke-width="1.2"/><ellipse cx="${f(hx)}" cy="${f(hy)}" rx="23" ry="2.8" fill="#FFC86B" opacity=".14"/>` : `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="28" ry="4.4" fill="${HAYALET}" stroke="${HAYALET_CIZGI}"/>`;
    if (c.yanik) s += `<ellipse cx="${f(hx - 22)}" cy="${f(hy + 1)}" rx="3.6" ry="1.3" fill="#2E6A36"/><ellipse cx="${f(hx + 23)}" cy="${f(hy - 0.5)}" rx="3.2" ry="1.2" fill="#2E6A36"/>`;
    c.ekle(2, s);
    const kandil = `<path d="M0 6h9l-1.6 2.4H1.6z" fill="#B8642E"/><path d="M4.5 0C3 2 3 4 4.5 5.6C6 4 6 2 4.5 0z" fill="#FFE9A0"/><circle cx="4.5" cy="4" r="4" fill="url(#ftl-koz)" opacity=".7"/>`;
    [-17, -8, 1, 10, 19].forEach((dx, i) => {
      const x = hx + dx;
      const yy = hy - 2 + ((i * 3) % 4) * 0.6;
      if (!c.yanik) {
        c.ekle(2, `<path d="M${f(x - 4.5)} ${f(yy + 1)}h9l-1.6 2.4h-5.8z" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".4"/>`);
        return;
      }
      c.ekle(2, `<circle ${c.sira()} cx="${f(x)}" cy="${f(yy + 1)}" r="7" fill="url(#ftl-isik)" opacity=".45"/><path d="M${f(x)} ${f(yy + 4)}v4" stroke="#FFC86B" stroke-width="2" opacity=".3"/>`);
      c.grupla('kandil', { tur: 'suz', x: x - 4.5, y: yy - 5, w: 9, h: 8.4, ic: kandil, sure: 3 }, { k: 2, svg: `<g transform="translate(${f(x - 4.5)} ${f(yy - 5)})">${kandil}</g>` });
    });
    c.capa = { x: hx, y: hy - 4 };
  },
  'bahceler.hidirellezAtesi': (c, g) => {
    const y = (v: number) => g.ust + v;
    const z = y(100);
    let s = `<path d="M412 ${f(z)}H306Q296 ${f(z)} 299 ${f(z + 8)}L306 ${f(z + 64)}H412z" fill="url(#hb-yuz-sag)"/>`;
    s += sekil(c, `M412 ${f(z - 4)}H306Q297 ${f(z - 4)} 299 ${f(z + 4)}L302 ${f(z + 7)}H412z`, '#1E3A22');
    if (c.yanik) s += `<path d="M412 ${f(z - 4)}H306Q297 ${f(z - 4)} 299 ${f(z + 4)}" fill="none" stroke="#5A8A5A" stroke-opacity=".5" stroke-width="1.2"/><ellipse cx="350" cy="${f(z - 3)}" rx="34" ry="7" fill="#FFB020" opacity=".18"/>`;
    // Taş halka ve odunlar.
    for (const dx of [-14, -8, 8, 14]) s += sekil(c, `M${350 + dx - 3} ${f(z - 2)}a3 2.4 0 1 1 6 0z`, '#4A4250');
    s += `<path d="M338 ${f(z - 3)}L362 ${f(z - 11)}M362 ${f(z - 3)}L338 ${f(z - 11)}" stroke="${c.yanik ? '#4A2A14' : HAYALET_CIZGI}" stroke-width="3.2" stroke-linecap="round"/>`;
    s += hale(c, { x: 350, y: z - 22 }, 52, 0.5);
    c.ekle(4, s);
    alev(c, 4, { x: 350, y: z - 6 }, 30, 0, 1.3);
    alev(c, 4, { x: 342, y: z - 5 }, 19, 1);
    alev(c, 4, { x: 358, y: z - 5 }, 21, 2);
    kivilcim(c, { x: 350, y: z - 26 }, 7, 46, '#FFD15C', 18);
    c.capa = P(g, 350, 84);
  },

  // ═════════ Tepe ═════════
  'tepe.patikaFenerleri': (c, g) => {
    // Arka plandaki tepe sırtında (cizim.ts arkaPlan, mahalle 5) soldan
    // tepedeki ateş yerine çıkan patika. Sırtın sağ yanı 28. düğümün,
    // lambasının ve binasının arkasında kalır: patika oraya uzanmaz.
    const ps = aralik(7, -8, 116).map((x) => P(g, x, tepeSirti(x)));
    let s = `<path d="${tepeSirtYolu(g, 0, 120, 3)}" fill="none" stroke="${c.yanik ? '#3A3060' : HAYALET_CIZGI}" stroke-width="2" stroke-dasharray="3 2" opacity=".8"/>`;
    for (const p of ps) s += `<path d="M${f(p.x)} ${f(p.y + 2)}v-7" stroke="${c.yanik ? '#2A2030' : HAYALET_CIZGI}" stroke-width="1.2"/>`;
    const isikP = ps.map((p) => ({ x: p.x, y: p.y - 6 }));
    s += isiklar(c, isikP, 1.5, '#FFD15C', 5.5);
    c.ekle('arka', s);
    parilti(c, isikP, 6, 3);
    c.capa = P(g, 54, 360);
  },
  'tepe.degirmenKanatlari': (c, g) => {
    // İki değirmen de döner: bu iş iki canlı öğe kullanır (Gök haritası durağan, mahalle ≤ 6).
    c.canliSiniri = 2;
    for (const j of [1, 3]) {
      const b = g.binalar[j];
      if (!b.gobek) continue;
      const h0 = b.gobek;
      if (!c.yanik) continue;
      c.ekle(j as Katman, `<circle ${c.sira()} cx="${f(h0.x)}" cy="${f(h0.y)}" r="48" fill="none" stroke="#FFE3A0" stroke-width="1" opacity=".12"/>` + hale(c, h0, 14, 0.6));
      let ic = '';
      for (const a of [20, 110, 200, 290]) {
        const r = (a * Math.PI) / 180;
        const ux = Math.cos(r);
        const uy = Math.sin(r);
        ic += `<path d="M50 50L${f(50 + ux * 46 - uy * 5)} ${f(50 + uy * 46 + ux * 5)}L${f(50 + ux * 46 + uy * 4)} ${f(50 + uy * 46 - ux * 4)}z" fill="#4A3A3E" stroke="#2A1E22" stroke-width="1"/>`;
        for (let k = 1; k <= 5; k++) ic += `<circle cx="${f(50 + ux * (6 + k * 8))}" cy="${f(50 + uy * (6 + k * 8))}" r="1.3" fill="#FFE9B0"/><circle cx="${f(50 + ux * (6 + k * 8))}" cy="${f(50 + uy * (6 + k * 8))}" r="3" fill="#FFC86B" opacity=".35"/>`;
      }
      ic += '<circle cx="50" cy="50" r="3.5" fill="#D9A441"/><circle cx="50" cy="50" r="1.4" fill="#FFF4C2"/>';
      c.oge({ tur: 'don', x: h0.x - 50, y: h0.y - 50, w: 100, h: 100, ic, koken: '50% 50%', sure: j === 1 ? 16 : 19 }, { k: j as Katman, svg: `<g transform="translate(${f(h0.x - 50)} ${f(h0.y - 50)})">${ic}</g>` });
    }
    const b = g.binalar[1];
    c.capa = b.gobek ?? { x: b.x, y: b.ust };
  },
  // 27. bölümün lamba direğinden sağ kenara: 28. terasın yüzünün önünde,
  // 26. binanın çatısının üstünde (sırt, patika ve ateş tepede serbest kalır).
  'tepe.ruzgarFlamalari': (c, g) => flamaDizisi(c, g, 1, 7, 'uzun', [vurgu(g), '#FFB020', '#3AA8FF', '#2EE07A', '#B266FF'], 12, 5, 15),
  'tepe.rasathaneKubbesi': (c, g) => {
    const b = g.binalar[4];
    const m = b.gobek ?? { x: b.x, y: b.ust };
    const rx = b.w / 2 - 4;
    const ry = b.w / 2 - 6;
    const kenar = yay(m, rx + 1.5, ry + 1.5, 180, 360, 11);
    let s = hale(c, { x: m.x, y: m.y - ry / 2 }, 40, 0.4);
    s += isiklar(c, kenar, 1.2, '#FFE3A0', 4);
    const yildiz = [
      { x: m.x - 16, y: m.y - 8 },
      { x: m.x - 9, y: m.y - 17 },
      { x: m.x + 2, y: m.y - 22 },
      { x: m.x + 13, y: m.y - 14 },
      { x: m.x + 18, y: m.y - 5 },
      { x: m.x - 3, y: m.y - 9 },
    ];
    if (c.yanik) s += `<path d="M${yildiz.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}" fill="none" stroke="#BFD8FF" stroke-width=".5" opacity=".6"/>`;
    s += isiklar(c, yildiz, 1, '#DDEBFF', 3);
    c.ekle(4, s);
    parilti(c, yildiz, 4, 1.8);
    if (c.yanik) c.oge({ tur: 'yanip', x: m.x + 20, y: m.y - 42, w: 10, h: 10, ic: '<path d="M5 0L6 4L10 5L6 6L5 10L4 6L0 5L4 4Z" fill="#fff"/>', sure: 2.2 });
    c.capa = { x: m.x, y: m.y - 16 };
  },
  'tepe.atesCanaklari': (c, g) => {
    // Tepe sırtının doruğunda (arka plan): yel değirmeninin kanatlarıyla 28.
    // düğümün lambası arasındaki açık sırtta çimenli bir tümsek (teraslar
    // gibi yüzü aşağı kararır); çanaklar üçayaklarıyla tümseğe basar, patika
    // buraya çıkar.
    const A = 112;
    const B = 194;
    const zemin = (x: number) => tepeSirti(x) - 9 * Math.sin((Math.PI * Math.min(Math.max(x - A, 0), B - A)) / (B - A));
    const Z = (x: number, dy = 0) => `${f(x)} ${f(g.ust + zemin(x) + dy)}`;
    const xs = Array.from({ length: 21 }, (_, i) => A + ((B - A) * i) / 20);
    // Yüz (aşağı kararır), üst yüzey (çimen) ve kenar ışığı.
    let s = `<path d="M${Z(A, 2)}L${xs.map((x) => Z(x, 2)).join('L')}L${Z(B - 6, 16)}L${f(B - 18)} ${f(g.ust + tepeSirti(B) + 34)}H${f(A + 16)}L${Z(A + 5, 14)}z" fill="url(#hb-yuz-sol)"/>`;
    s += sekil(c, `M${xs.map((x) => Z(x)).join('L')}L${Z(B - 1.5, 5)}L${[...xs].reverse().slice(1, -1).map((x) => Z(x, 6)).join('L')}L${Z(A + 1.5, 5)}z`, '#22381E');
    if (c.yanik) {
      s += `<path d="M${xs.map((x) => Z(x)).join('L')}" fill="none" stroke="#8A7A9A" stroke-opacity=".55" stroke-width="1.4"/>`;
      for (const [x, r] of [[118, 3], [141, 2.5], [166, 3.5], [189, 2.5]] as const) s += `<circle cx="${f(x)}" cy="${f(g.ust + zemin(x))}" r="${r}" fill="#1A3A20"/>`;
      s += `<ellipse cx="${f((A + B) / 2)}" cy="${f(g.ust + zemin((A + B) / 2) + 1)}" rx="40" ry="6" fill="#FFB020" opacity=".16"/>`;
    }
    c.ekle('arka', s);
    [132, 153, 174].forEach((x, i) => {
      const y0 = g.ust + zemin(x);
      const tas = i === 1 ? y0 - 22 : y0 - 15;
      let t = `<path d="M${x - 5} ${f(y0)}L${x} ${f(tas + 4)}L${x + 5} ${f(y0)}M${x} ${f(y0)}V${f(tas + 4)}" stroke="${c.yanik ? '#2A2030' : HAYALET_CIZGI}" stroke-width="1.4"/>`;
      t += sekil(c, `M${x - 7} ${f(tas)}h14q-1 5-7 5t-7-5z`, '#4A3A3E');
      if (c.yanik) t += `<path d="M${x - 7} ${f(tas)}h14" stroke="#D9A441" stroke-width="1"/>`;
      c.ekle('arka', t);
      alev(c, 'arka', { x, y: tas + 1 }, i === 1 ? 16 : 12, i);
      kivilcim(c, { x, y: tas - 10 }, 2, 26, '#FFD15C', 8);
    });
    c.capa = P(g, 153, 318);
  },
  'tepe.gokHaritasi': (c, g) => {
    // Durağan (Tepe'nin canlı öğe payını değirmenler kullanır).
    c.canliSiniri = 0;
    const m = P(g, 140, 56);
    const yildiz: [number, number, number][] = [
      // Lale takımyıldızı: çanak, sap ve yapraklar.
      [-16, -6, 2.2],
      [-10, -22, 1.6],
      [0, -12, 1.4],
      [10, -22, 1.6],
      [16, -6, 2.2],
      [0, 4, 1.8],
      [0, 26, 2.4],
      [-14, 18, 1.4],
      [13, 14, 1.4],
    ];
    const ps = yildiz.map(([x, y]) => ({ x: m.x + x, y: m.y + y }));
    const cizgi = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6], [6, 7], [6, 8]];
    let s = '';
    if (c.yanik) s += `<circle cx="${f(m.x)}" cy="${f(m.y + 2)}" r="34" fill="none" stroke="#BFD8FF" stroke-width=".6" stroke-dasharray="1.5 3" opacity=".35"/><circle cx="${f(m.x)}" cy="${f(m.y + 2)}" r="30" fill="url(#ftl-isik)" opacity=".08"/>`;
    s += cizgi.map(([a, b]) => `<path d="M${f(ps[a].x)} ${f(ps[a].y)}L${f(ps[b].x)} ${f(ps[b].y)}" stroke="${c.yanik ? '#BFD8FF' : HAYALET_CIZGI}" stroke-width=".8" opacity="${c.yanik ? 0.55 : 0.5}"/>`).join('');
    ps.forEach((p, i) => {
      const r = yildiz[i][2];
      s += c.yanik
        ? `<g ${c.sira()}><circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(r * 3)}" fill="url(#hs-parla)" opacity=".7"/><path d="M${f(p.x)} ${f(p.y - r * 2.4)}L${f(p.x + r * 0.5)} ${f(p.y - r * 0.5)}L${f(p.x + r * 2.4)} ${f(p.y)}L${f(p.x + r * 0.5)} ${f(p.y + r * 0.5)}L${f(p.x)} ${f(p.y + r * 2.4)}L${f(p.x - r * 0.5)} ${f(p.y + r * 0.5)}L${f(p.x - r * 2.4)} ${f(p.y)}L${f(p.x - r * 0.5)} ${f(p.y - r * 0.5)}Z" fill="#F4F8FF"/></g>`
        : isik(c, p, r);
    });
    c.ekle('arka', s);
    parilti(c, ps, 6, 2.2);
    c.capa = m;
  },

  // ═════════ Fabrika ═════════
  'fabrika.atolyeLambalari': (c, g) => {
    // 31. ve 33. bölümün atölyelerinde, saçaktan pencere sütunlarının üstüne;
    // düğüme bitişik sütun boş (düğüm düğmesi binanın o köşesine biner).
    for (const j of [0, 2]) {
      const b = g.binalar[j];
      const x0 = b.x - b.w / 2;
      const sutunlar = [x0 + 13, b.x, x0 + b.w - 13];
      const xs = b.taraf === 'sol' ? sutunlar.slice(0, 2) : sutunlar.slice(1);
      c.ekle(j as Katman, `<path d="M${f(xs[0] - 9)} ${f(b.ust + 2)}H${f(xs[1] + 9)}" stroke="${c.yanik ? '#2A2030' : HAYALET_CIZGI}" stroke-width=".8"/>`);
      xs.forEach((x, i) => fener(c, j as Katman, { x, y: b.ust + 2 }, 1, 'koni', j * 3 + i, 0.9));
    }
    const b = g.binalar[0];
    const x0 = b.x - b.w / 2;
    c.capa = { x: b.taraf === 'sol' ? (x0 + 13 + b.x) / 2 : (b.x + x0 + b.w - 13) / 2, y: b.ust + 10 };
  },
  'fabrika.depoKapisi': (c, g) => {
    // 32. bölümün atölyesinin cephesinde (sağ, orta): kapı terasa basar, orta
    // pencere sütununun alt penceresinin yerinde; levha iki pencere sırasının
    // arasında, yan pencereler açıkta. Çizim kapının taban ortasına göre
    // (y yukarı eksi), `k` ölçeğiyle.
    const b = g.binalar[1];
    const k = 0.52;
    const M = (x: number, y: number): Nokta => ({ x: b.x + x * k, y: b.taban + y * k });
    let s = sutun(c, -34, -42, 10, 42, '#5A2A22', '#8A4A3A') + sutun(c, 24, -42, 10, 42, '#5A2A22', '#8A4A3A');
    if (c.yanik) for (let y = -36; y < 0; y += 7) s += `<path d="M-34 ${y}h10M24 ${y}h10" stroke="#3A1A16" stroke-width=".8"/>`;
    s += sekil(c, 'M-38 -48H38V-41H-38z', '#3A3440');
    if (c.yanik) s += dogru({ x: -34, y: -44.5 }, { x: 34, y: -44.5 }, 9).map((p) => `<circle cx="${f(p.x)}" cy="${f(p.y)}" r=".9" fill="#8A8098"/>`).join('');
    // Çift kanatlı ahşap kapı, çapraz kuşaklar.
    s += sekil(c, 'M-24 0V-41H24V0z', '#2A1A12');
    if (c.yanik) s += '<path d="M0 -41V0M-24 -41L0 0M0 -41L-24 0M0 -41L24 0M24 -41L0 0" stroke="#4A2E1A" stroke-width="2"/><path d="M-18 -41V0M-12 -41V0M-6 -41V0M6 -41V0M12 -41V0M18 -41V0" stroke="#1A0E08" stroke-width=".6"/><rect x="-4" y="-24" width="8" height="6" fill="#FFB020" opacity=".25"/>';
    // Lento üstünde barut fişeği levhası.
    s += sekil(c, 'M-12 -58h24v9h-24z', '#4A2622');
    if (c.yanik) s += `<g ${c.sira()}><path d="M-7 -53.5h14" stroke="#FFB020" stroke-width="1.4"/><circle cx="7.5" cy="-53.5" r="1.6" fill="#FFE9A0"/><path d="M9 -56l2-2M9 -51l2 2M10 -53.5h2.6" stroke="#FFE9A0" stroke-width=".7"/></g>`;
    c.ekle(1, `<g transform="translate(${f(b.x)} ${f(b.taban)}) scale(${k})">${s}</g>`);
    const ust = dogru(M(-36, -50), M(36, -50), 10);
    c.ekle(1, isiklar(c, ust, 1, '#FFE9B0', 3.4));
    parilti(c, ust, 4, 2);
    fener(c, 1, M(-29, -40), 1, 'kafes', 0, 0.5);
    fener(c, 1, M(29, -40), 1, 'kafes', 1, 0.5);
    c.capa = M(0, -28);
  },
  'fabrika.rayFenerleri': (c, g) => fenerDizisi(c, g, 1, 6, 'kafes', [0, 1, 2, 1, 0, 1], 20),
  'fabrika.bacaKivilcimlari': (c, g) => {
    for (const b of g.binalar) {
      if (!b.baca) continue;
      const p = { x: b.baca.x, y: b.baca.ust };
      c.ekle(b.j as Katman, hale(c, { x: p.x, y: p.y - 2 }, 10, 0.75) + (c.yanik ? `<rect ${c.sira()} x="${f(p.x - 6)}" y="${f(p.y)}" width="12" height="2.4" fill="#FFB020" opacity=".9"/>` : ''));
      kivilcim(c, p, 4, 38, '#FFD15C', 10);
    }
    const b = g.binalar[1].baca;
    c.capa = b ? { x: b.x, y: b.ust - 10 } : P(g, 300, 340);
  },
  'fabrika.bacaCelengi': (c, g) => {
    const tum: Nokta[] = [];
    for (const b of g.binalar) {
      if (!b.baca) continue;
      const ps: Nokta[] = [];
      let sol = true;
      for (let y = b.baca.ust + 8; y < b.ust - 2; y += 7) {
        ps.push({ x: b.baca.x + (sol ? -6.5 : 6.5), y });
        sol = !sol;
      }
      if (ps.length < 2) continue;
      c.ekle(b.j as Katman, ipCiz(c, `M${ps.map((p) => `${f(p.x)} ${f(p.y)}`).join('L')}`, 0.7, '#2E4A2E'));
      c.ekle(b.j as Katman, isiklar(c, ps, 1.2, ['#FF4D4D', '#FFB020', '#2EE07A'][b.j % 3], 3.8));
      tum.push(...ps);
    }
    parilti(c, tum, 4.5, 1.8);
    const b = g.binalar[2].baca;
    c.capa = b ? { x: b.x, y: b.ust + 20 } : P(g, 100, 260);
  },
  'fabrika.senlikDudugu': (c, g) => {
    // 34. bölümün atölyesinin testere çatısında (sağ üst), bacanın öbür
    // ucundaki dişin yamacında: buhar borusu çatıdan çıkar; Kale şeridinin
    // dibi ve 35. düğümün lambası boş kalır. Çizim borunun dibine göre
    // (y yukarı eksi), `k` ölçeğiyle.
    const bn = g.binalar[3];
    const k = 0.8;
    const dis = bn.baca && bn.baca.x < bn.x ? 2 : 0;
    // Testere dişi: tepe (x0 + dis·w/3, ust − 16) → saçak (x0 + (dis + 1)·w/3, ust + 1).
    const dx = bn.x - bn.w / 2 + ((dis + 0.6) * bn.w) / 3;
    const dy = bn.ust - 16 + 0.6 * 17;
    const M = (x: number, y: number): Nokta => ({ x: dx + x * k, y: dy + y * k });
    // Kaide: tabla ile aşağı inen yamaç arasındaki takoz (tabla çatıya otursun).
    const egim = 17 / (bn.w / 3);
    let s = sekil(c, `M0 0H12V${f(12 * egim)}z`, '#3A3440');
    s += hale(c, { x: 0, y: -56 }, 34, 0.45);
    // Buhar borusu, vana çarkı, pirinç düdük (silindir + bilezikler + kubbe).
    s += sekil(c, 'M-2.5 -4V-38H2.5V-4z', '#4A4250');
    s += sekil(c, 'M-12 -4h24v4h-24z', '#3A3440');
    s += c.yanik ? '<circle cx="7" cy="-24" r="4.4" fill="none" stroke="#B8381C" stroke-width="1.6"/><path d="M2.5 -24h4.5M7 -28.4v8.8M2.6 -24h8.8" stroke="#B8381C" stroke-width=".9"/>' : '';
    s += c.yanik
      ? '<path d="M-6 -38V-64H6V-38z" fill="url(#ftl-pirinc)"/><path d="M-7 -42h14M-7 -54h14M-7 -60h14" stroke="#8A4E1C" stroke-width="1.4"/><path d="M-8 -64Q0 -74 8 -64z" fill="url(#ftl-pirinc)"/><path d="M0 -71v-4" stroke="#8A4E1C" stroke-width="1.4"/><path d="M-4 -48h8" stroke="#FFF4C2" stroke-width="1" opacity=".6"/>'
      : sekil(c, 'M-6 -38V-64H6V-38zM-8 -64Q0 -74 8 -64z', '#4A4250');
    c.ekle(3, `<g transform="translate(${f(dx)} ${f(dy)}) scale(${k})">${s}</g>`);
    const halka = yay(M(0, -52), 16 * k, 18 * k, 0, 330, 12);
    c.ekle(3, isiklar(c, halka, 1.1, '#FFE9B0', 3.6));
    if (c.yanik)
      for (let i = 0; i < 4; i++) {
        const p = M(-8 + ((i * 5) % 9), -78 - i * 8);
        const r = (5 - i * 0.6) * k;
        c.grupla('buhar', { tur: 'yuksel', x: p.x, y: p.y, w: 10 * k, h: 10 * k, ic: `<circle cx="${f(5 * k)}" cy="${f(5 * k)}" r="${f(r)}" fill="#EEE6F6" opacity="${(0.6 - i * 0.1).toFixed(2)}"/>`, sure: 2.4, dy: 30 * k });
      }
    parilti(c, halka, 4.5, 1.6);
    // Bacaların tacı.
    for (const b of g.binalar) {
      if (!b.baca) continue;
      const tac = yay({ x: b.baca.x, y: b.baca.ust - 1 }, 7, 5, 180, 360, 5);
      c.ekle(b.j as Katman, isiklar(c, tac, 1.1, '#FFD15C', 3.5));
    }
    c.capa = M(0, -54);
  },

  // ═════════ Kale ═════════
  'kale.surKandilleri': (c, g) => {
    let i = 0;
    const kandiller: Nokta[] = [];
    for (const b of g.binalar) {
      const x0 = b.x - b.w / 2 - 3;
      const dis = (b.w + 6) / 5;
      for (const k of [1, 3]) {
        const p = { x: x0 + (k + 0.5) * dis, y: b.ust - 2 };
        c.ekle(b.j as Katman, sekil(c, `M${f(p.x - 3)} ${f(p.y)}h6l-1 2h-4z`, '#B8642E'));
        if (c.yanik) alev(c, b.j as Katman, { x: p.x, y: p.y }, 6, i++, 1.6, false);
        else c.ekle(b.j as Katman, isik(c, { x: p.x, y: p.y - 2 }, 1.2));
        kandiller.push({ x: p.x, y: p.y - 3 });
      }
    }
    parilti(c, kandiller, 7, 1.4);
    const b = g.binalar[2];
    c.capa = { x: b.x, y: b.ust - 6 };
  },
  'kale.burcBayraklari': (c, g) => {
    // Ağır sancak kumaşı durağan asılır (Kale'nin canlı payı alevlerde).
    c.canliSiniri = 0;
    let i = 0;
    for (const j of [0, 1, 2, 3]) {
      const b = g.binalar[j];
      for (const dx of [-b.w / 2 + 6, b.w / 2 - 6]) {
        const p = { x: b.x + dx, y: b.ust + 5 };
        c.ekle(j as Katman, `<path d="M${f(p.x - 4.5)} ${f(p.y)}h9" stroke="${c.yanik ? '#D9A441' : HAYALET_CIZGI}" stroke-width="1.4" stroke-linecap="round"/>`);
        bayrak(c, j as Katman, p, i % 2 === 0 ? '#B8381C' : KREM, 'catal', i, 7, 24, `burc:${j}`);
        i++;
      }
    }
    const b = g.binalar[1];
    c.capa = { x: b.x, y: b.ust + 16 };
  },
  'kale.kapiMesaleleri': (c, g) => {
    const y0 = g.ust + GIRIS_Y;
    let s = sekil(c, `M164 ${f(y0)}V${f(y0 - 46)}H236V${f(y0)}z`, '#4A4250');
    if (c.yanik) for (let y = y0 - 38; y < y0; y += 9) s += `<path d="M164 ${f(y)}H236" stroke="#3A3240" stroke-width="1"/>`;
    for (let k = 0; k < 5; k += 2) s += sekil(c, `M${f(162 + (k * 76) / 5)} ${f(y0 - 54)}h${f(76 / 5)}v9h${f(-76 / 5)}z`, '#4A4250');
    s += sekil(c, `M162 ${f(y0 - 47)}h76v4h-76z`, '#5A5260');
    s += c.yanik ? `<path d="M184 ${f(y0)}V${f(y0 - 20)}A16 16 0 0 1 216 ${f(y0 - 20)}V${f(y0)}z" fill="#120C18"/><path d="M188 ${f(y0 - 26)}V${f(y0)}M194 ${f(y0 - 33)}V${f(y0)}M200 ${f(y0 - 35)}V${f(y0)}M206 ${f(y0 - 33)}V${f(y0)}M212 ${f(y0 - 26)}V${f(y0)}M184 ${f(y0 - 18)}H216M184 ${f(y0 - 9)}H216" stroke="#3A3440" stroke-width="1.4"/><rect x="186" y="${f(y0 - 6)}" width="28" height="6" fill="#FFB020" opacity=".12"/>` : sekil(c, `M184 ${f(y0)}V${f(y0 - 20)}A16 16 0 0 1 216 ${f(y0 - 20)}V${f(y0)}z`, '#1A1420');
    // Meşale kolları.
    for (const x of [172, 228]) s += `<path d="M${x} ${f(y0 - 22)}l${x < 200 ? 2 : -2} 6" stroke="${c.yanik ? '#2A1A10' : HAYALET_CIZGI}" stroke-width="1.4"/><path d="M${x - 1.6} ${f(y0 - 34)}h3.2l-.6 12h-2z" fill="${c.yanik ? '#5A3A22' : HAYALET}"/>`;
    c.ekle('on', s);
    alev(c, 'on', { x: 172, y: y0 - 33 }, 13, 0, 1.4);
    alev(c, 'on', { x: 228, y: y0 - 33 }, 13, 1, 1.4);
    kivilcim(c, { x: 172, y: y0 - 44 }, 2, 22, '#FFD15C', 6);
    kivilcim(c, { x: 228, y: y0 - 44 }, 2, 22, '#FFD15C', 6);
    c.capa = P(g, 200, GIRIS_Y - 30);
  },
  'kale.mazgalFenerleri': (c, g) => {
    const ps: Nokta[] = [];
    for (const b of g.binalar) {
      for (const dy of [20, 52]) {
        const p = { x: b.x, y: b.ust + dy };
        if (p.y > b.taban - 26) continue;
        let s = c.yanik ? `<path d="M${f(p.x - 1)} ${f(p.y)}L${f(p.x - 14)} ${f(p.y + 22)}H${f(p.x + 14)}L${f(p.x + 1)} ${f(p.y)}z" fill="url(#hs-mazgal)" opacity=".5"/>` : '';
        s += c.yanik ? `<rect ${c.sira()} x="${f(p.x - 1.4)}" y="${f(p.y - 5)}" width="2.8" height="10" rx="1.2" fill="#FFD15C"/>` : `<rect x="${f(p.x - 1.4)}" y="${f(p.y - 5)}" width="2.8" height="10" rx="1.2" fill="${HAYALET}" stroke="${HAYALET_CIZGI}" stroke-width=".5"/>`;
        c.ekle(b.j as Katman, s);
        ps.push(p);
      }
    }
    parilti(c, ps, 7, 2.6);
    const b = g.binalar[2];
    c.capa = { x: b.x, y: b.ust + 30 };
  },
  'kale.donanmaIsiklari': (c, g) => {
    const tum: Nokta[] = [];
    for (const b of g.binalar) {
      const x0 = b.x - b.w / 2;
      const x1 = b.x + b.w / 2;
      const ps: Nokta[] = [];
      for (let y = b.ust + 6; y < b.taban - 4; y += 9) ps.push({ x: x0 + 1, y }, { x: x1 - 1, y });
      const dis = (b.w + 6) / 5;
      for (let k = 0; k < 5; k += 2) ps.push({ x: x0 - 3 + k * dis + 1, y: b.ust - 9 }, { x: x0 - 3 + (k + 1) * dis - 1, y: b.ust - 9 });
      c.ekle(b.j as Katman, isiklar(c, ps, 1.05, '#FFE9B0', 0));
      tum.push(...ps);
    }
    parilti(c, tum, 4, 2.2);
    const b = g.binalar[2];
    c.capa = { x: b.x, y: b.ust + 20 };
  },
  'kale.burcAtesi': (c, g) => {
    const y = (v: number) => g.ust + v;
    let s = hale(c, P(g, 200, 34), 88, 0.42);
    s += sekil(c, `M184 ${f(y(102))}V${f(y(94))}H216V${f(y(102))}z`, '#3A3446');
    s += sekil(c, `M188 ${f(y(94))}V${f(y(62))}H212V${f(y(94))}z`, '#4A4250');
    if (c.yanik) s += `<path d="M188 ${f(y(70))}h24M188 ${f(y(78))}h24M188 ${f(y(86))}h24M200 ${f(y(62))}v8M194 ${f(y(70))}v8M206 ${f(y(78))}v8" stroke="#3A3240" stroke-width="1"/>`;
    s += sekil(c, `M182 ${f(y(62))}h36l-4-12h-28z`, '#2A2430');
    if (c.yanik) s += `<path d="M186 ${f(y(52))}h28M188 ${f(y(56))}h24" stroke="#5A5060" stroke-width="1"/><ellipse cx="200" cy="${f(y(50))}" rx="14" ry="3" fill="#FFB020" opacity=".6"/>`;
    c.ekle('on', s);
    alev(c, 'on', { x: 200, y: y(52) }, 40, 0, 1.4);
    alev(c, 'on', { x: 190, y: y(53) }, 24, 1);
    alev(c, 'on', { x: 210, y: y(53) }, 26, 2);
    kivilcim(c, { x: 200, y: y(14) }, 8, 60, '#FFD15C', 24);
    c.capa = P(g, 200, 34);
  },
};

/**
 * Liman gemisinin gövdesi (iki iş paylaşır; ilk çizilen iş çizer): sağ alt
 * köşede, 12. bölümün rıhtımının önündeki suda, ölçekli; pruva x 296'da,
 * giriş bölgesine (11. düğümle mahalle şeridi arası) taşmaz. Döner: gemi
 * koordinatı (x: 262 pruva … 396 kıç, dy: su çizgisine göre) → küresel nokta.
 */
function gemiGovdesi(c: Cizim, g: BolgeGeo, b: CizimBaglami, sahip: string): (x: number, dy: number) => Nokta {
  const t = g.ust + 600;
  const k = 0.78;
  const x0 = 296 - 262 * k;
  const M = (x: number, dy: number): Nokta => ({ x: x0 + x * k, y: t + dy * k });
  if (sahip === 'liman.gemiDonanmasi' && b.ciziliyor('liman.direkFenerleri')) return M;
  let s = '<path d="M262 -10L271 5H386L396 -10z" fill="#0E1A22"/><path d="M262 -10H396" stroke="#2A3E4A" stroke-width="1.2"/>';
  s += '<path d="M328 -10V-20H362V-10" fill="#122028"/>';
  s += '<path d="M300 -10V-80M352 -20V-72M290 -64H310M343 -58H361" stroke="#16262E" stroke-width="2.2"/>';
  s += '<path d="M262 -10L300 -80M300 -80L352 -72M352 -72L396 -10" stroke="#1E2E38" stroke-width=".7"/>';
  s += `<path d="M268 7h112" stroke="${SICAK}" stroke-opacity=".12" stroke-width="2"/>`;
  c.ekle(0, `<g transform="translate(${f(x0)} ${f(t)}) scale(${k})">${s}</g>`);
  return M;
}
