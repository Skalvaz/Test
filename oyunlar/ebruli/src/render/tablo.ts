/**
 * Ebru tablosu (GDD §9, K11) — oyunun imzası. Bölümün temizlik günlüğünden
 * belirlenimli, prosedürel bir ebru: aynı istek → piksel piksel aynı tablo
 * (RNG yalnız `istek.tohum`; Math.random yok).
 *
 * Akış: `tabloPlani(istek)` (saf) günlüğü ebru işlemlerine çevirir →
 * `EbruModeli` (src/render/ebru.ts, saf) işlemleri sırayla uygular →
 * `tabloyuCiz` tuvale basar (paspartu, aharlı kâğıt, damarlı boya
 * çokgenleri, kâğıt dokusu, altın çerçeve, künye).
 *
 * Teknikler (§9.2): battal (her grup bir damla; önce zemine serpinti),
 * gelgit (k ≥ 3 kaskatlı hamleden sonra ileri-geri biz), taraklı (Tarak:
 * gidiş-dönüş ince tarak), şal (gelgit + tarak varsa sinüs kayması), bülbül
 * yuvası (Girdap: iç içe damlalar + girdap), çiçek ebrusu (Lale ya da desen
 * hedefi: lale / karanfil, biz çekmeyle), is serpintisi (Mürekkep).
 */
import type { TabloCizici, TabloIstegi, TabloSonucu } from '../app/sozlesme';
import type { Renk, Teknik, TemizlikKaydi } from '../core/types';
import { ATOLYELER, PALET, TEKNIKLER } from '../app/katalog';
import { EbruModeli, SINIR_SADE, SINIR_TAM, tabloRng } from './ebru';
import { hexRgb, karistir, rgbHex, rgba } from './palet';
import { tuvalOlustur, type Ctx } from './tuval';
import { rumi, yildiz8 } from './cerceve';

/** Model koordinatı: tablo her zaman 512×768 mantıksal birimde kurulur. */
export const TABLO_W = 512;
export const TABLO_H = 768;
/** Boyalı alan (paspartunun içi). */
export const ALAN = { x: 22, y: 22, w: TABLO_W - 44, h: TABLO_H - 22 - 58 } as const;

export type Islem =
  | { t: 'damla'; x: number; y: number; r: number; renk: string; kenar: string }
  | { t: 'tarak'; yatay: boolean; aralik: number; z: number; l: number; ofset: number; ters: boolean }
  | { t: 'gelgit'; aralik: number; z: number; l: number }
  | { t: 'biz'; ax: number; ay: number; bx: number; by: number; z: number; l: number }
  | { t: 'girdap'; x: number; y: number; a: number; s: number }
  | { t: 'sinus'; mx: number; my: number; A: number; lambda: number; faz: number };

export interface TabloPlani {
  islemler: Islem[];
  teknikler: Teknik[];
  nadirlik: 0 | 1 | 2;
  zemin: string;
  kunye: string;
  /** Şaheser altın pulları ve kâğıt lifleri için tohum. */
  tohum: number;
}

/**
 * Ebru boyaları: oyun paletinin topraksı, kâğıtla uyumlu karşılıkları
 * (doğal pigment: çivit, lal, zerrin, aşı boyası, menekşe, zümrüt, is).
 */
const BOYA: Record<number, string> = {
  0: '#EDE3CC',
  1: '#B5443A',
  2: '#E0AE3E',
  3: '#D8783A',
  4: '#3E5F93',
  5: '#7A5AA3',
  6: '#4D8E66',
  7: '#2B231D',
};

/** Ton çeşitlemesi: açık/koyu ±, kâğıda hafif karışım (ebru boyası saydamdır). */
function boyaTonu(kod: number, rnd: () => number, acik = 0): { renk: string; kenar: string } {
  const taban = hexRgb(BOYA[kod] ?? BOYA[0]);
  const v = (rnd() - 0.5) * 0.16 + acik;
  const ton = v >= 0 ? karistir(taban, [250, 244, 230], v) : karistir(taban, [20, 14, 10], -v);
  const kenar = karistir(ton, [24, 16, 10], 0.35);
  return { renk: rgbHex(ton), kenar: rgbHex(kenar) };
}

function yerlestir(k: TemizlikKaydi, w: number, h: number, rnd: () => number): { x: number; y: number } {
  const bx = (k.x10 / 10 + 0.5) / w;
  const by = (k.y10 / 10 + 0.5) / h;
  return {
    x: ALAN.x + ALAN.w * (0.08 + 0.84 * bx) + (rnd() - 0.5) * 0.7 * ((ALAN.w * 0.84) / w),
    y: ALAN.y + ALAN.h * (0.08 + 0.72 * by) + (rnd() - 0.5) * 0.7 * ((ALAN.h * 0.72) / h),
  };
}

/** Günlükten ebru işlemleri (saf, belirlenimli). */
export function tabloPlani(istek: TabloIstegi): TabloPlani {
  const rnd = tabloRng(istek.tohum);
  const islemler: Islem[] = [];
  const teknik = new Set<Teknik>(['battal']);
  const gunluk = istek.gunluk;
  const w = Math.max(1, istek.w);
  const h = Math.max(1, istek.h);
  const atolye = ATOLYELER.find((a) => a.id === istek.atolye) ?? ATOLYELER[0];
  const olcek = ALAN.w / 512;

  // Renk sıklığı: serpinti ve çiçek renkleri buradan.
  const siklik = new Map<number, number>();
  for (const k of gunluk) if (k.renk) siklik.set(k.renk, (siklik.get(k.renk) ?? 0) + k.boyut);
  const sirali = [...siklik.entries()].filter(([r]) => r !== 7).sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([r]) => r);
  const ana = sirali[0] ?? 5;
  const ikinci = sirali[1] ?? (ana === 3 ? 6 : 3);

  // Zemin (teknedeki ilk boya): atölyenin açık tonu.
  // Zemin bir BOYADIR (teknedeki ilk kat), kâğıt rengi değil: açık ama renkli.
  const zeminler = atolye.id === 'bursa' ? ['#D9C3CE', '#CEC2DC', '#E3CBA8'] : ['#C5D5D9', '#DCCB9C', '#CAD8C2'];
  const zemin = zeminler[Math.floor(rnd() * zeminler.length)];

  // 1. Battal serpintisi (iki kat): bütün yüzeye, kenarların biraz dışına da,
  //    seyrek ızgarada titrek damlalar. Sonraki her damla bunları iter: ilk
  //    katlar ince damarlara, ikinciler hücrelere döner (battalın görünüşü).
  const damarRengi = atolye.id === 'bursa' ? 1 : 4;
  const katlar: { kod: number; acik: number; sutun: number; satir: number; rMin: number; rMax: number; kay: number }[] = [
    { kod: damarRengi, acik: 0.1, sutun: 7, satir: 10, rMin: 28, rMax: 36, kay: 0 },
    { kod: 2, acik: 0.16, sutun: 7, satir: 10, rMin: 24, rMax: 32, kay: 0.5 },
    { kod: ikinci, acik: 0.24, sutun: 6, satir: 8, rMin: 20, rMax: 28, kay: 0.25 },
  ];
  for (const kat of katlar) {
    const hw = (ALAN.w + 40) / kat.sutun;
    const hh = (ALAN.h + 40) / kat.satir;
    for (let j = 0; j < kat.satir; j++)
      for (let i = 0; i < kat.sutun; i++) {
        // Kaydırılmış ızgara: her kat bir öncekinin boşluklarına düşer ve onu damara sıkıştırır.
        const x = ALAN.x - 20 + (i + kat.kay + 0.5 * (j % 2) * 0.5 + (rnd() - 0.5) * 0.7) * hw;
        const y = ALAN.y - 20 + (j + kat.kay + (rnd() - 0.5) * 0.7) * hh;
        islemler.push({ t: 'damla', x, y, r: (kat.rMin + rnd() * (kat.rMax - kat.rMin)) * olcek, ...boyaTonu(kat.kod, rnd, kat.acik + (rnd() - 0.5) * 0.12) });
      }
  }

  // 2. Günlük, oluşum sırasıyla.
  let tarakSayisi = 0;
  let gelgitSayisi = 0;
  let sonTarakYatay = true;
  let lale = false;
  let enK = 0;
  let laleLale = false;
  const hamleSonu = (i: number) => i === gunluk.length - 1 || gunluk[i + 1].hamle !== gunluk[i].hamle;
  let hamleK = 0;
  gunluk.forEach((k, i) => {
    const p = yerlestir(k, w, h, rnd);
    hamleK = Math.max(hamleK, k.k);
    enK = Math.max(enK, k.k);
    const kod = k.renk || ana;
    switch (k.tur) {
      case 'grup': {
        const r = 22 * Math.sqrt(Math.max(1, k.boyut)) * olcek;
        islemler.push({ t: 'damla', x: p.x, y: p.y, r, ...boyaTonu(kod, rnd) });
        // Battal "göz": bazen merkeze daha küçük, başka tonda ikinci damla.
        if (rnd() < 0.34) islemler.push({ t: 'damla', x: p.x, y: p.y, r: r * (0.38 + rnd() * 0.2), ...boyaTonu(rnd() < 0.5 ? kod : ikinci, rnd, rnd() < 0.5 ? 0.3 : -0.12) });
        break;
      }
      case 'tarak': {
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 20 * olcek, ...boyaTonu(kod, rnd) });
        if (tarakSayisi < 3) {
          tarakSayisi++;
          teknik.add('tarakli');
          const yatay = k.yon !== 'dikey';
          sonTarakYatay = yatay;
          const ofset = rnd() * 16;
          islemler.push({ t: 'tarak', yatay, aralik: 16 * olcek, z: 24 * olcek, l: 10 * olcek, ofset, ters: rnd() < 0.5 });
        }
        break;
      }
      case 'girdap': {
        teknik.add('bulbulYuvasi');
        const c1 = boyaTonu(kod, rnd);
        const c2 = boyaTonu(kod, rnd, 0.45);
        const c3 = boyaTonu(ikinci === kod ? ana : ikinci, rnd, -0.05);
        // Bülbül yuvası: iç içe dört damla (koyu/açık/karşı renk), sonra biz ile çevrilir.
        const c4 = boyaTonu(kod, rnd, 0.6);
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 54 * olcek, ...c1 });
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 41 * olcek, ...c2 });
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 28 * olcek, ...c3 });
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 14 * olcek, ...c4 });
        // İç içe halkalar kendi merkezinde dönünce değişmez: önce içlerinden biz geçir, sonra çevir.
        const bA = rnd() * Math.PI * 2;
        islemler.push({ t: 'biz', ax: p.x - Math.cos(bA) * 40 * olcek, ay: p.y - Math.sin(bA) * 40 * olcek, bx: p.x + Math.cos(bA) * 56 * olcek, by: p.y + Math.sin(bA) * 56 * olcek, z: 36 * olcek, l: 10 * olcek });
        islemler.push({ t: 'girdap', x: p.x, y: p.y, a: 8.5, s: 38 * olcek });
        break;
      }
      case 'lale':
        lale = true;
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 24 * olcek, ...boyaTonu(k.renk || 0, rnd, k.renk ? 0 : 0.1) });
        break;
      case 'murekkep': {
        const n = 5 + Math.floor(rnd() * 5);
        for (let j = 0; j < n; j++) {
          const a = rnd() * Math.PI * 2;
          const d = (10 + rnd() * 34) * olcek;
          islemler.push({ t: 'damla', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, r: (6 + rnd() * 4) * olcek, ...boyaTonu(7, rnd, rnd() * 0.1) });
        }
        break;
      }
      case 'birlesim': {
        if (k.boyut >= w * h * 0.75) laleLale = true;
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: Math.min(70, 14 * Math.sqrt(k.boyut)) * olcek, ...boyaTonu(kod, rnd) });
        islemler.push({ t: 'damla', x: p.x, y: p.y, r: 16 * olcek, ...boyaTonu(ikinci, rnd, 0.35) });
        islemler.push({ t: 'girdap', x: p.x, y: p.y, a: 1.6, s: 60 * olcek });
        break;
      }
    }
    // Gelgit: uzun kaskatlı (k ≥ 3) hamleden sonra (en çok 2 kez).
    if (hamleSonu(i)) {
      if (hamleK >= 3 && gelgitSayisi < 2) {
        gelgitSayisi++;
        teknik.add('gelgit');
        islemler.push({ t: 'gelgit', aralik: 48 * olcek, z: 40 * olcek, l: 20 * olcek });
      }
      hamleK = 0;
    }
  });

  // 3. Şal: gelgit üstünden geçen tarak → dik yönde sinüs kayması.
  if (teknik.has('gelgit') && teknik.has('tarakli')) {
    teknik.add('sal');
    const yatay = !sonTarakYatay;
    islemler.push({ t: 'sinus', mx: yatay ? 1 : 0, my: yatay ? 0 : 1, A: 20 * olcek, lambda: 96 * olcek, faz: rnd() * Math.PI * 2 });
  }

  // 4. Çiçek ebrusu: Lale kullanıldıysa ya da desen hedefi tamamlandıysa.
  const motif = istek.motif ?? (lale ? atolye.cicek : undefined);
  if (motif) {
    teknik.add('cicek');
    const cx = ALAN.x + ALAN.w * (0.5 + (rnd() - 0.5) * 0.16);
    const cy = ALAN.y + ALAN.h * 0.6;
    const tac = motif === 'lale' ? (siklik.has(5) ? 5 : ana) : siklik.has(3) ? 3 : ana;
    cicekPlani(islemler, motif, cx, cy, olcek, tac, zemin, rnd);
  }

  // Nadirlik (§9.4).
  const tekSay = teknik.size;
  let nadirlik: 0 | 1 | 2 = 0;
  if (lale || istek.yildiz === 3 || istek.motif) nadirlik = 1;
  if (laleLale || enK >= 5 || (istek.yildiz === 3 && tekSay >= 3)) nadirlik = 2;

  const teknikler = TEKNIKLER.map((t) => t.id).filter((t) => teknik.has(t));
  const oncelik: Teknik[] = ['sal', 'cicek', 'bulbulYuvasi', 'tarakli', 'gelgit', 'battal'];
  const bas = oncelik.find((t) => teknik.has(t)) ?? 'battal';
  const ad = TEKNIKLER.find((t) => t.id === bas)!.ad;
  const kunye = `${atolye.ad} · Bölüm ${istek.bolumId} · ${ad}`;
  return { islemler, teknikler, nadirlik, zemin, kunye, tohum: istek.tohum };
}

/**
 * Lale ya da karanfil (Necmeddin Okyay geleneği): önce çiçeğin oturacağı
 * sakin, açık bir zemin damlası (madalyon), sonra sap (sık küçük yeşil
 * damlalar + aşağı biz), yapraklar (damla + dışa biz) ve taç (damlalar +
 * aşağıdan yukarı biz çekmeleri). Ölçek F ≈ 1,75 × alan ölçeği.
 */
function cicekPlani(is: Islem[], motif: 'lale' | 'karanfil', cx: number, cy: number, s: number, tac: number, zemin: string, rnd: () => number): void {
  const F = s * 1.75;
  const yesil = (a = 0) => boyaTonu(6, rnd, a);
  const tacT = (a = 0) => boyaTonu(tac, rnd, a);
  // Madalyon: çiçeğin çevresi sakin ve açık.
  const acik = rgbHex(karistir(zemin, [250, 244, 230], 0.55));
  is.push({ t: 'damla', x: cx, y: cy + 46 * F, r: 84 * F, renk: acik, kenar: rgbHex(karistir(acik, [40, 30, 20], 0.3)) });
  if (motif === 'lale') {
    is.push({ t: 'damla', x: cx, y: cy, r: 34 * F, ...tacT(-0.04) });
    is.push({ t: 'damla', x: cx, y: cy - 4 * F, r: 21 * F, ...tacT(0.3) });
    is.push({ t: 'damla', x: cx, y: cy - 2 * F, r: 9 * F, ...tacT(-0.12) });
    // Taç: biz çanağın İÇİNDEN yukarı (alt kenar yuvarlak kalır): ortada sivri uç, yanlarda iki uç.
    is.push({ t: 'biz', ax: cx, ay: cy + 8 * F, bx: cx, by: cy - 64 * F, z: 66 * F, l: 12 * F });
    for (const yon of [-1, 1]) is.push({ t: 'biz', ax: cx + yon * 17 * F, ay: cy + 6 * F, bx: cx + yon * 36 * F, by: cy - 44 * F, z: 44 * F, l: 9 * F });
  } else {
    // Yelpaze taç: üç iç içe geçen damla (koyu/açık), tepede tırtıklı saçak, altta yeşil çanak.
    is.push({ t: 'damla', x: cx - 17 * F, y: cy + 5 * F, r: 19 * F, ...tacT(0.22) });
    is.push({ t: 'damla', x: cx + 17 * F, y: cy + 5 * F, r: 19 * F, ...tacT(0.22) });
    is.push({ t: 'damla', x: cx, y: cy, r: 26 * F, ...tacT(-0.06) });
    const aci = (i: number) => -Math.PI + 0.2 + (i / 11) * (Math.PI - 0.4);
    for (let i = 0; i < 12; i++) {
      const a = aci(i);
      is.push({ t: 'damla', x: cx + Math.cos(a) * 30 * F, y: cy + Math.sin(a) * 30 * F, r: 8 * F, ...tacT(i % 2 ? 0.32 : -0.14) });
    }
    for (let i = 0; i < 12; i++) {
      const a = aci(i);
      is.push({ t: 'biz', ax: cx + Math.cos(a) * 22 * F, ay: cy + Math.sin(a) * 22 * F, bx: cx + Math.cos(a) * 52 * F, by: cy + Math.sin(a) * 52 * F, z: 22 * F, l: 6 * F });
    }
    is.push({ t: 'damla', x: cx, y: cy + 30 * F, r: 12 * F, ...yesil(-0.02) });
    is.push({ t: 'biz', ax: cx, ay: cy + 24 * F, bx: cx, by: cy + 56 * F, z: 22 * F, l: 7 * F });
  }
  // Sap ve yapraklar taçtan SONRA (taç damlaları onları itmesin): taç
  // altından tek yeşil damla, içinden uzun ve ince biz (incelen sap).
  is.push({ t: 'damla', x: cx, y: cy + 44 * F, r: 6 * F, ...yesil(-0.06) });
  is.push({ t: 'damla', x: cx + 2 * F, y: cy + 66 * F, r: 6 * F, ...yesil(-0.02) });
  is.push({ t: 'biz', ax: cx, ay: cy + 38 * F, bx: cx + 3 * F, by: cy + 122 * F, z: 70 * F, l: 3.6 * F });
  // Yapraklar: damla + içinden dışa-yukarı biz; ℓ ≈ yarıçap → bütün damla uzar, ucu sivrilir.
  for (const yon of [-1, 1]) {
    const ly = cy + (yon < 0 ? 92 : 80) * F;
    is.push({ t: 'damla', x: cx + yon * 14 * F, y: ly, r: 13 * F, ...yesil(yon < 0 ? 0.02 : 0.14) });
    is.push({ t: 'biz', ax: cx + yon * 8 * F, ay: ly + 6 * F, bx: cx + yon * 62 * F, by: ly - 40 * F, z: 38 * F, l: 15 * F });
  }
}

/** Tek işlemi modele uygula. */
export function islemUygula(m: EbruModeli, is: Islem): void {
  switch (is.t) {
    case 'damla':
      m.damla(is.x, is.y, is.r, is.renk, is.kenar);
      return;
    case 'tarak': {
      // Ebruda tarak şeritlenmiş yüzeye çekilir: önce dik yönde geniş biz
      // (ileri-geri, aralık 40), sonra tarağın ince hatları (aralık 16).
      {
        const bas0 = (is.yatay ? ALAN.x : ALAN.y) + is.ofset;
        const son0 = is.yatay ? ALAN.x + ALAN.w : ALAN.y + ALAN.h;
        let j = 0;
        for (let v = bas0; v < son0; v += is.aralik * 2.5, j++) {
          if (is.yatay) m.tarama(v, ALAN.y, 0, j % 2 ? -1 : 1, is.z * 1.3, is.l * 1.6, 0.5, false);
          else m.tarama(ALAN.x, v, j % 2 ? -1 : 1, 0, is.z * 1.3, is.l * 1.6, 0.5, false);
          m.yenidenOrnekle();
        }
      }
      // Tarak: bütün alan boyunca paralel hatlar, tek yönde.
      const yon = is.ters ? -1 : 1;
      const bas = (is.yatay ? ALAN.y : ALAN.x) - is.aralik * 2 + is.ofset;
      const son = (is.yatay ? ALAN.y + ALAN.h : ALAN.x + ALAN.w) + is.aralik * 2;
      let i = 0;
      for (let v = bas; v <= son; v += is.aralik, i++) {
        if (is.yatay) m.tarama(ALAN.x, v, yon, 0, is.z, is.l, 0.5, false);
        else m.tarama(v, ALAN.y, 0, yon, is.z, is.l, 0.5, false);
        if (i % 4 === 3) m.yenidenOrnekle();
      }
      m.yenidenOrnekle();
      return;
    }
    case 'gelgit': {
      // Dikey ileri-geri çizgiler: her çizgide yön ters.
      let i = 0;
      for (let x = ALAN.x + is.aralik / 2; x < ALAN.x + ALAN.w; x += is.aralik, i++) {
        m.tarama(x, ALAN.y, 0, i % 2 ? -1 : 1, is.z, is.l, 0.5, false);
        m.yenidenOrnekle();
      }
      return;
    }
    case 'biz':
      m.biz(is.ax, is.ay, is.bx, is.by, is.z, is.l);
      return;
    case 'girdap':
      m.girdap(is.x, is.y, is.a, is.s);
      return;
    case 'sinus':
      m.sinus(is.mx, is.my, is.A, is.lambda, is.faz);
      return;
  }
}

/** Planı modele uygula (eşzamanlı). */
export function modelKur(plan: TabloPlani, sade = false): EbruModeli {
  const m = new EbruModeli(sade ? SINIR_SADE : SINIR_TAM);
  for (const is of plan.islemler) islemUygula(m, is);
  return m;
}

// ─── Çizim ─────────────────────────────────────────────────────────────

const dokuOnbellek = new Map<string, HTMLCanvasElement>();

/** Aharlı kâğıt dokusu (tohumlu lifler + benekler), 256×256 döşenir. */
function kagitDokusu(tohum: number): HTMLCanvasElement {
  const k = `${tohum >>> 0}`;
  let t = dokuOnbellek.get(k);
  if (t) return t;
  const N = 256;
  const { tuval, ctx } = tuvalOlustur(N, N);
  const rnd = tabloRng(tohum ^ 0x5eed);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, N, N);
  // Benekler (ahar dalgalanması).
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 6 + rnd() * 26;
    for (const dx of [-N, 0, N])
      for (const dy of [-N, 0, N]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, `rgba(150,120,80,${(0.05 + rnd() * 0.05).toFixed(3)})`);
        g.addColorStop(1, 'rgba(150,120,80,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, 2 * r, 2 * r);
      }
  }
  // Lifler.
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const a = rnd() * Math.PI;
    const L = 3 + rnd() * 12;
    ctx.strokeStyle = `rgba(110,85,55,${(0.18 + rnd() * 0.25).toFixed(3)})`;
    ctx.lineWidth = 0.5 + rnd() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (rnd() - 0.5) * 3, y + Math.sin(a) * L * 0.5 + (rnd() - 0.5) * 3, x + Math.cos(a) * L, y + Math.sin(a) * L);
    ctx.stroke();
  }
  t = tuval;
  if (dokuOnbellek.size > 8) dokuOnbellek.clear();
  dokuOnbellek.set(k, t);
  return t;
}

export interface CizimSecenek {
  /** Çıktı piksel ölçeği (mantıksal 512 → w). */
  olcek: number;
  /** Küçük resim: künye ve ince ayrıntı yok. */
  kucuk?: boolean;
}

/** Modeli ve çerçeveyi tuvale bas (c: mantıksal 512×768 × olcek). */
export function tabloyuCiz(c: Ctx, m: EbruModeli, plan: TabloPlani, s: CizimSecenek): void {
  const k = s.olcek;
  c.save();
  c.setTransform(k, 0, 0, k, 0, 0);
  // Paspartu (krem kâğıt).
  const pg = c.createLinearGradient(0, 0, TABLO_W, TABLO_H);
  pg.addColorStop(0, '#F7EFDB');
  pg.addColorStop(0.6, PALET.kagit);
  pg.addColorStop(1, '#EADDBF');
  c.fillStyle = pg;
  c.fillRect(0, 0, TABLO_W, TABLO_H);
  // Boyalı alan: zemin + çokgenler.
  c.save();
  c.beginPath();
  c.rect(ALAN.x, ALAN.y, ALAN.w, ALAN.h);
  c.clip();
  c.fillStyle = plan.zemin;
  c.fillRect(ALAN.x, ALAN.y, ALAN.w, ALAN.h);
  const kenarKal = (s.kucuk ? 1.1 : 0.85) / Math.max(0.35, Math.min(1, k));
  c.lineJoin = 'round';
  for (const p of m.cokgenler) {
    const v = p.k;
    c.beginPath();
    c.moveTo(v[0], v[1]);
    for (let i = 1; i < p.n; i++) c.lineTo(v[2 * i], v[2 * i + 1]);
    c.closePath();
    c.fillStyle = p.renk;
    c.fill();
    // Ebru damarı: renkler arasında ince, açık bir çizgi (öd suyunun ayırdığı kenar).
    c.strokeStyle = rgba(p.kenar, 0.22);
    c.lineWidth = kenarKal * 1.6;
    c.stroke();
    c.strokeStyle = 'rgba(252,247,234,0.55)';
    c.lineWidth = kenarKal * 0.75;
    c.stroke();
  }
  // Kâğıt dokusu: çarpma (multiply) alfa 0,12 — boya kâğıda işlemiş görünsün.
  if (!s.kucuk) {
    const doku = kagitDokusu(plan.tohum);
    const desen = c.createPattern(doku, 'repeat');
    if (desen) {
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = 0.12 * 3;
      c.fillStyle = desen;
      c.fillRect(ALAN.x, ALAN.y, ALAN.w, ALAN.h);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    // Islak parıltı: üstten çok hafif ışık, kenarlarda hafif koyuluk.
    const ig = c.createLinearGradient(0, ALAN.y, 0, ALAN.y + ALAN.h);
    ig.addColorStop(0, 'rgba(255,255,255,0.08)');
    ig.addColorStop(0.5, 'rgba(255,255,255,0)');
    ig.addColorStop(1, 'rgba(60,40,20,0.06)');
    c.fillStyle = ig;
    c.fillRect(ALAN.x, ALAN.y, ALAN.w, ALAN.h);
  }
  c.restore();
  // Paspartu dokusu (lifler) — boyalı alanın dışında da.
  if (!s.kucuk) {
    const rnd = tabloRng(plan.tohum ^ 0x11b);
    c.lineCap = 'round';
    c.lineWidth = 0.6;
    for (let i = 0; i < 600; i++) {
      const x = rnd() * TABLO_W;
      const y = rnd() * TABLO_H;
      if (x > ALAN.x && x < ALAN.x + ALAN.w && y > ALAN.y && y < ALAN.y + ALAN.h) continue;
      const a = rnd() * Math.PI;
      const L = 2 + rnd() * 7;
      c.strokeStyle = 'rgba(90,70,40,0.16)';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
      c.stroke();
    }
  }
  // Boyalı alanın kenarı: ince gölge + altın çizgi; nadirliğe göre çift çerçeve.
  c.strokeStyle = 'rgba(70,50,20,0.25)';
  c.lineWidth = 2;
  c.strokeRect(ALAN.x - 1, ALAN.y - 1, ALAN.w + 2, ALAN.h + 2);
  c.strokeStyle = PALET.altin;
  c.lineWidth = 1.4;
  c.strokeRect(ALAN.x - 3.5, ALAN.y - 3.5, ALAN.w + 7, ALAN.h + 7);
  if (plan.nadirlik >= 1) {
    c.strokeStyle = PALET.altinKoyu;
    c.lineWidth = 1;
    c.strokeRect(9.5, 9.5, TABLO_W - 19, TABLO_H - 19);
    c.strokeStyle = PALET.altin;
    c.lineWidth = 2.2;
    c.strokeRect(12.5, 12.5, TABLO_W - 25, TABLO_H - 25);
    // Köşelerde sekiz köşeli yıldız, üst ortada rumi.
    for (const [x, y] of [
      [12.5, 12.5],
      [TABLO_W - 12.5, 12.5],
      [12.5, TABLO_H - 12.5],
      [TABLO_W - 12.5, TABLO_H - 12.5],
    ])
      yildiz8(c, x, y, 18);
    rumi(c, TABLO_W / 2, 12.5, 16, 0);
  }
  if (plan.nadirlik >= 2) {
    // Altın varak tozu: tohumlu 140 pul.
    const rnd = tabloRng(plan.tohum ^ 0xa17);
    for (let i = 0; i < 140; i++) {
      const kenarda = rnd() < 0.7;
      let x = rnd() * TABLO_W;
      let y = rnd() * TABLO_H;
      if (kenarda && x > ALAN.x && x < ALAN.x + ALAN.w && y > ALAN.y && y < ALAN.y + ALAN.h) {
        // Çoğu pul paspartuya ve kenara yakın.
        if (rnd() < 0.5) x = rnd() < 0.5 ? ALAN.x + rnd() * 30 : ALAN.x + ALAN.w - rnd() * 30;
        else y = rnd() < 0.5 ? ALAN.y + rnd() * 30 : ALAN.y + ALAN.h - rnd() * 30;
      }
      const r = 0.6 + rnd() * 2.2;
      c.fillStyle = rnd() < 0.5 ? PALET.altinAcik : PALET.altin;
      c.globalAlpha = 0.55 + rnd() * 0.45;
      c.beginPath();
      const a = rnd() * Math.PI;
      c.ellipse(x, y, r * 1.6, r, a, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // Künye.
  if (!s.kucuk) {
    c.fillStyle = '#5A4E3F';
    c.font = '500 13px "Alegreya Sans", "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(plan.kunye, TABLO_W / 2, ALAN.y + ALAN.h + 29);
  }
  c.restore();
}

// ─── TabloCizici ─────────────────────────────────────────────────────────

export interface TabloCiziciSecenek {
  /** Çıktı DPR'si (≤ 2). */
  dpr?: number;
  /** Zayıf cihaz sade modu (§9.3): 32 köşeli daire, ≤ 6 000 köşe. */
  sade?: boolean;
}

export interface TabloCiziciTam extends TabloCizici {
  /** Plan (test ve galeri künyesi). */
  plan(istek: TabloIstegi): TabloPlani;
  /** Son çizimin model karması (belirlenimlilik). */
  sonKarma(): number;
}

function istekAnahtari(i: TabloIstegi): string {
  let h = 0x811c9dc5;
  const s = JSON.stringify([i.bolumId, i.atolye, i.tohum, i.w, i.h, i.yildiz, i.motif ?? '', i.gunluk]);
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 0x01000193);
  }
  return `${i.bolumId}|${i.tohum}|${h >>> 0}`;
}

export function tabloCiziciOlustur(sec: TabloCiziciSecenek = {}): TabloCiziciTam {
  const dpr = Math.min(2, sec.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
  const sade = !!sec.sade;
  const modeller = new Map<string, { plan: TabloPlani; model: EbruModeli }>();
  const kucukler = new Map<string, HTMLCanvasElement>();
  let karma = 0;

  const modelAl = (istek: TabloIstegi): { plan: TabloPlani; model: EbruModeli } => {
    const a = istekAnahtari(istek);
    let v = modeller.get(a);
    if (!v) {
      const plan = tabloPlani(istek);
      v = { plan, model: modelKur(plan, sade) };
      if (modeller.size >= 6) modeller.delete(modeller.keys().next().value!);
      modeller.set(a, v);
    }
    return v;
  };

  const bas = (plan: TabloPlani, model: EbruModeli, w: number, h: number, kucuk = false): HTMLCanvasElement => {
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    const { tuval, ctx } = tuvalOlustur(pw, ph);
    tabloyuCiz(ctx, model, plan, { olcek: pw / TABLO_W, kucuk });
    karma = model.karma();
    return tuval;
  };

  const sonuc = (plan: TabloPlani, tuval: HTMLCanvasElement): TabloSonucu => ({ tuval, teknikler: plan.teknikler, nadirlik: plan.nadirlik });

  return {
    plan: tabloPlani,
    sonKarma: () => karma,
    tabloCiz(istek, boyut = { w: TABLO_W, h: TABLO_H }) {
      const { plan, model } = modelAl(istek);
      return sonuc(plan, bas(plan, model, boyut.w, boyut.h));
    },
    async tabloCizParcali(istek, boyut = { w: TABLO_W, h: TABLO_H }, dilimMs = 8) {
      const a = istekAnahtari(istek);
      const hazir = modeller.get(a);
      if (hazir) return sonuc(hazir.plan, bas(hazir.plan, hazir.model, boyut.w, boyut.h));
      const plan = tabloPlani(istek);
      const model = new EbruModeli(sade ? SINIR_SADE : SINIR_TAM);
      const simdi = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const bekle = () => new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));
      let t0 = simdi();
      for (const is of plan.islemler) {
        islemUygula(model, is);
        if (simdi() - t0 > dilimMs) {
          await bekle();
          t0 = simdi();
        }
      }
      if (modeller.size >= 6) modeller.delete(modeller.keys().next().value!);
      modeller.set(a, { plan, model });
      await bekle();
      return sonuc(plan, bas(plan, model, boyut.w, boyut.h));
    },
    kucukResim(istek, w, h) {
      const k = `${istekAnahtari(istek)}|${w}|${h}|${dpr}`;
      let t = kucukler.get(k);
      if (!t) {
        const { plan, model } = modelAl(istek);
        t = bas(plan, model, w, h, w < 200);
        if (kucukler.size >= 40) kucukler.delete(kucukler.keys().next().value!);
        kucukler.set(k, t);
      }
      return t;
    },
  };
}

/** Renk kodundan tablo boyası (galeri ve dev için). */
export function tabloBoyasi(kod: Renk | 0): string {
  return BOYA[kod] ?? BOYA[0];
}
