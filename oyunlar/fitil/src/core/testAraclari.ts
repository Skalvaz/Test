/**
 * Test araçları (yalnız vitest kullanır; uygulama içe aktarmaz).
 *
 * Kompakt tahta gösterimi (`kur`): her hücre boşlukla ayrılmış bir simge.
 *   Kapsül: renk harfi R(0) A(1) Z(2) G(3) M(4) P(5), * = yıldız topu;
 *     ardından isteğe bağlı ısı rakamı, ardından isteğe bağlı özel:
 *     r0..r3 roket (eksen), k kasımpatı. Örn. `R`, `A3`, `Gr1`, `Z2k`, `*`.
 *   Önek `c` kafesli (`cR2`), önek `w` ıslak (`wZ`).
 *   Diğerleri bölüm simgeleri: `#`, `F`, `I`, `K1..K3`, `S`, `S1`, `D`, `D4`.
 * Bütün kapsüller `sabitKapsuller` ile belirlenir; dolum `dogumAgirliklari`
 * ile tek renge (varsayılan M) zorlanır.
 */
import { bolumuYukle } from './bolumYukle';
import { rngInt } from './rng';
import { DIK, SEKIZ, zincirlenebilir } from './tahta';
import { yolDogrula } from './yol';
import type { BolumVerisi, Hamle, Hedef, Hucre, Icerik, Konum, Olay, OlayTuru, OyunDurumu } from './types';

export const RENK: Record<string, number> = { R: 0, A: 1, Z: 2, G: 3, M: 4, P: 5 };

export function tekRenk(renk: number, renkSayisi: number): number[] {
  return Array.from({ length: renkSayisi }, (_, i) => (i === renk ? 1 : 0));
}

export function bolum(satirlar: string[], ek: Partial<BolumVerisi> = {}): BolumVerisi {
  const izgara = satirlar.map((s) => s.trim().split(/\s+/));
  const h = izgara.length;
  const w = izgara[0].length;
  const duzen: string[] = [];
  const sabit: NonNullable<BolumVerisi['sabitKapsuller']> = [];
  for (let y = 0; y < h; y++) {
    if (izgara[y].length !== w) throw new Error(`satır ${y}: ${izgara[y].length} simge, w=${w}`);
    const satir: string[] = [];
    for (let x = 0; x < w; x++) {
      const tok = izgara[y][x];
      const m = /^(c|w)?([RAZGMP*])(\d)?(r[0-3]|k)?$/.exec(tok);
      if (!m) {
        satir.push(tok);
        continue;
      }
      const renk = m[2] === '*' ? -1 : RENK[m[2]];
      const isi = m[3] ? Number(m[3]) : 0;
      const ozel = m[4] ? (m[4] === 'k' ? 'kasimpati' : 'roket') : renk === -1 ? 'yildiz' : undefined;
      const eksen = (m[4]?.startsWith('r') ? Number(m[4][1]) : 0) as 0 | 1 | 2 | 3;
      satir.push(m[1] === 'c' ? 'C' : m[1] === 'w' ? 'W' : '.');
      sabit.push({ x, y, renk, isi, ozel, eksen });
    }
    duzen.push(satir.join(' '));
  }
  const renkSayisi = ek.renkSayisi ?? 5;
  return {
    id: 9000,
    ad: 'test',
    mahalle: 0,
    tur: 'normal',
    w,
    h,
    renkSayisi,
    esik: 4,
    hamle: 30,
    tohum: 7,
    yardim: 0,
    ozelEsikleri: [6, 9, 12],
    dogumAgirliklari: tekRenk(4, renkSayisi),
    hedefler: [{ tur: 'topla', renk: 'hepsi', adet: 9999 }],
    duzen,
    sabitKapsuller: sabit,
    botBandi: [0, 100],
    yildizEsikleri: [1000, 2000],
    ...ek,
  };
}

/** Tahtayı kur; karıştırma tahtayı değiştirdiyse hata (test kurulumu kilitli). */
export function kur(satirlar: string[], ek: Partial<BolumVerisi> = {}, denemeNo = 0): OyunDurumu {
  const v = bolum(satirlar, ek);
  const d = bolumuYukle(v, denemeNo);
  for (const s of v.sabitKapsuller ?? []) {
    const ic = d.hucreler[s.y * d.w + s.x].icerik;
    const renk = ic?.tur === 'kapsul' || ic?.tur === 'islak' ? ic.renk : null;
    if (renk !== s.renk) throw new Error(`test tahtası karıştırıldı (${s.x},${s.y}); kilitsiz bir tahta kurun`);
  }
  return d;
}

/** [[x,y],…] → Konum[]. */
export function yol(...p: [number, number][]): Konum[] {
  return p.map(([x, y]) => ({ x, y }));
}

export function fitil(...p: [number, number][]): Hamle {
  return { tur: 'fitil', yol: yol(...p), halka: false };
}

export function halka(...p: [number, number][]): Hamle {
  return { tur: 'fitil', yol: yol(...p), halka: true };
}

export function icerik(d: OyunDurumu, x: number, y: number): Icerik | null {
  return d.hucreler[y * d.w + x].icerik;
}

export function sec<T extends OlayTuru>(olaylar: Olay[], tur: T): Extract<Olay, { tur: T }>[] {
  return olaylar.filter((o): o is Extract<Olay, { tur: T }> => o.tur === tur);
}

/** Patlayan hücreler "x,y" (olay sırasıyla). */
export function patlayanlar(olaylar: Olay[]): string[] {
  return sec(olaylar, 'patlama').map((o) => `${o.hucre.x},${o.hucre.y}`);
}

/** "x,y" → patlama zamanı. */
export function patlamaZamani(olaylar: Olay[]): Record<string, number> {
  const z: Record<string, number> = {};
  for (const o of sec(olaylar, 'patlama')) z[`${o.hucre.x},${o.hucre.y}`] = o.t;
  return z;
}

/**
 * Hiçbir 8-komşusu aynı renk olmayan desen ((x + 2y) mod 4 → R A Z G);
 * `ek` ile "x,y" → simge ezilir. Özel taş yoksa tek başına kilitlidir.
 */
export function desen(w: number, h: number, ek: Record<string, string> = {}): string[] {
  const harf = ['R', 'A', 'Z', 'G'];
  const s: string[] = [];
  for (let y = 0; y < h; y++) {
    const satir: string[] = [];
    for (let x = 0; x < w; x++) satir.push(ek[`${x},${y}`] ?? harf[(x + 2 * y) % 4]);
    s.push(satir.join(' '));
  }
  return s;
}

export function derinDondur<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o as object)) derinDondur((o as Record<string, unknown>)[k]);
  }
  return o;
}

export function kapsulSayisi(d: OyunDurumu): number {
  let n = 0;
  for (const h of d.hucreler) if (!h.delik && h.icerik?.tur === 'kapsul') n++;
  return n;
}

/**
 * Görsel tahta (§16.1 kuralı): yalnız olaylarla önceki durumdan sonrakini
 * kurar. Çizicinin yapacağının başvuru modeli; testler `durum` ile eşitler.
 */
export interface GorselTahta {
  hucreler: Hucre[];
  puan: number;
  korukDolum: number;
  hedefler: { deger: number; tamam: boolean; gerekli: number }[];
  izler: boolean[][];
}

export function gorselUygula(onceki: OyunDurumu, olaylar: readonly Olay[]): GorselTahta {
  const g: GorselTahta = {
    hucreler: structuredClone(onceki.hucreler),
    puan: onceki.puan,
    korukDolum: onceki.korukDolum,
    hedefler: onceki.hedefler.map((h) => ({ deger: h.ilerleme, tamam: h.tamam, gerekli: h.gerekli })),
    izler: onceki.izler.map((iz) => [...iz.yandi]),
  };
  const w = onceki.w;
  const H = (p: Konum): Hucre => g.hucreler[p.y * w + p.x];
  for (const o of olaylar) {
    switch (o.tur) {
      case 'patlama':
        H(o.hucre).icerik = null;
        H(o.hucre).isikIzi = true;
        g.puan += o.puan;
        break;
      case 'puanEklendi':
        g.puan += o.miktar;
        break;
      case 'isindi':
      case 'isiDegisti': {
        const ic = H(o.hucre).icerik;
        if (ic?.tur === 'kapsul') ic.isi = o.isi;
        break;
      }
      case 'ozelOlustu':
        H(o.hucre).icerik = { tur: 'kapsul', renk: o.renk as 0, isi: o.isi ?? 0, ozel: o.ozel, eksen: o.eksen };
        break;
      case 'kafesKirildi':
        H(o.hucre).kafes = false;
        break;
      case 'kurudu':
        H(o.hucre).icerik = { tur: 'kapsul', renk: o.renk as 0, isi: 0, ozel: 'yok', eksen: 0 };
        break;
      case 'dosemeAydinlandi':
        H(o.hucre).doseme = o.kalan as 0 | 1;
        break;
      case 'desenBoyandi':
        H(o.hucre).desenBoyali = true;
        break;
      case 'izYandi': {
        const k = H(o.hucre).izIndeksi;
        const j = onceki.izler[k].hucreler.indexOf(o.hucre.y * w + o.hucre.x);
        g.izler[k][j] = true;
        break;
      }
      case 'engelHasar': {
        const ic = H(o.hucre).icerik;
        if (o.kalan <= 0) H(o.hucre).icerik = null;
        else if (ic?.tur === 'kaya' || ic?.tur === 'kova') ic.kat = o.kalan as 1;
        break;
      }
      case 'devFisekDoldu': {
        const ic = H(o.hucre).icerik;
        if (ic?.tur === 'devFisek') ic.dolum = o.dolum;
        break;
      }
      case 'devFisekFirladi':
      case 'isTemizlendi':
      case 'fenerToplandi':
        H(o.hucre).icerik = null;
        break;
      case 'isYayildi':
        H(o.hucre).icerik = { tur: 'is' };
        break;
      case 'yercekimi': {
        const tasinan = o.dusenler.map((m) => H(m.den).icerik);
        for (const m of o.dusenler) H(m.den).icerik = null;
        o.dusenler.forEach((m, k) => (H(m.e).icerik = tasinan[k]));
        for (const dg of o.doganlar) H(dg.hucre).icerik = structuredClone(dg.icerik);
        break;
      }
      case 'karistirma': {
        const tasinan = o.esleme.map((m) => H(m.den).icerik);
        for (const m of o.esleme) H(m.den).icerik = null;
        o.esleme.forEach((m, k) => (H(m.e).icerik = tasinan[k]));
        for (const r of o.yenidenRenk) {
          const ic = H(r.hucre).icerik;
          if (ic?.tur === 'kapsul') ic.renk = r.renk as 0;
        }
        break;
      }
      case 'hedefIlerledi':
        g.hedefler[o.indeks] = { deger: o.deger, tamam: o.tamam, gerekli: o.gerekli ?? g.hedefler[o.indeks].gerekli };
        break;
      case 'korukDoldu':
        g.korukDolum = o.dolum;
        break;
      case 'korukKullanildi':
        g.korukDolum = 0;
        break;
      default:
        break;
    }
  }
  return g;
}

// ── Rastgele bölüm ve hamle (bulanık test, performans) ──────────────────

type R = { rng: number };

function rastgeleIz(r: R, w: number, h: number, delik: Set<number>, kullanildi: Set<number>): [number, number][] {
  const uzunluk = 3 + rngInt(r, 6);
  let x = rngInt(r, w);
  let y = rngInt(r, h);
  const iz: [number, number][] = [];
  for (let k = 0; k < uzunluk; k++) {
    const i = y * w + x;
    if (delik.has(i) || kullanildi.has(i)) break;
    iz.push([x, y]);
    kullanildi.add(i);
    const yon = SEKIZ[rngInt(r, 8)];
    x = Math.min(w - 1, Math.max(0, x + yon.x));
    y = Math.min(h - 1, Math.max(0, y + yon.y));
  }
  return iz;
}

/** Bütün öğeleri karışık içeren rastgele (geçerli) bölüm verisi. */
export function rastgeleBolum(r: R, id: number, sade = false): BolumVerisi {
  const w = sade ? 7 : 5 + rngInt(r, 4);
  const h = sade ? 9 : 6 + rngInt(r, 5);
  const renkSayisi = sade ? 5 : 3 + rngInt(r, 4);
  const duzen: string[] = [];
  const delik = new Set<number>();
  const bos: number[] = [];
  for (let y = 0; y < h; y++) {
    const s: string[] = [];
    for (let x = 0; x < w; x++) {
      const p = sade ? 99 : rngInt(r, 100);
      let tok = '.';
      if (p < 3) tok = '#';
      else if (p < 7) tok = 'C';
      else if (p < 10) tok = 'W';
      else if (p < 13) tok = `K${1 + rngInt(r, 3)}`;
      else if (p < 15) tok = rngInt(r, 2) ? 'S' : 'S1';
      else if (p < 17) tok = rngInt(r, 2) ? 'D' : 'D2';
      else if (p < 20) tok = 'I';
      else if (p < 22) tok = 'F';
      if (tok === '#') delik.add(y * w + x);
      if (tok === '.') bos.push(y * w + x);
      s.push(tok);
    }
    duzen.push(s.join(' '));
  }
  const sabitKapsuller: NonNullable<BolumVerisi['sabitKapsuller']> = [];
  const onIsi: [number, number, number][] = [];
  const dosemeler: [number, number, 1 | 2][] = [];
  const desenHucreleri: [number, number, number][] = [];
  for (const i of bos) {
    const x = i % w;
    const y = (i - x) / w;
    if (!sade && rngInt(r, 100) < 6) {
      const t = rngInt(r, 3);
      sabitKapsuller.push(
        t === 2 ? { x, y, renk: -1, ozel: 'yildiz' } : { x, y, renk: rngInt(r, renkSayisi), ozel: t === 0 ? 'roket' : 'kasimpati', eksen: rngInt(r, 4) as 0 },
      );
    }
    if (rngInt(r, 100) < 25) onIsi.push([x, y, rngInt(r, 4)]);
    if (!sade && rngInt(r, 100) < 15) dosemeler.push([x, y, (1 + rngInt(r, 2)) as 1 | 2]);
    if (!sade && rngInt(r, 100) < 8) desenHucreleri.push([x, y, rngInt(r, renkSayisi)]);
  }
  const izler: [number, number][][] = [];
  if (!sade) {
    const kullanildi = new Set<number>();
    const n = rngInt(r, 3);
    for (let k = 0; k < n; k++) {
      const iz = rastgeleIz(r, w, h, delik, kullanildi);
      if (iz.length >= 2) izler.push(iz);
    }
  }
  const hedefSecenek: Hedef[] = [
    { tur: 'topla', renk: 'hepsi', adet: 10 + rngInt(r, 40) },
    { tur: 'topla', renk: rngInt(r, renkSayisi) as 0, adet: 5 + rngInt(r, 15) },
    { tur: 'kafes' },
    { tur: 'kaya' },
    { tur: 'aydinlat' },
    { tur: 'desen', motif: 'lale' },
    { tur: 'is' },
    { tur: 'fener', adet: 1 + rngInt(r, 2) },
    { tur: 'devFisek', adet: 1 },
    { tur: 'zincirleme', esik: 3 + rngInt(r, 5), adet: 1 + rngInt(r, 2) },
    { tur: 'halka', adet: 1 },
    { tur: 'puan', puan: 500 + rngInt(r, 3000) },
  ];
  const hedefler: Hedef[] = sade ? [{ tur: 'topla', renk: 'hepsi', adet: 100000 }] : [];
  const hs = sade ? 0 : 1 + rngInt(r, 2);
  for (let k = 0; k < hs; k++) hedefler.push(hedefSecenek[rngInt(r, hedefSecenek.length)]);
  const esikSecenek: [number, number, number][] = [
    [0, 0, 0],
    [6, 0, 0],
    [6, 9, 12],
    [4, 6, 8],
    [3, 4, 5],
  ];
  const hava: BolumVerisi['havaOlaylari'] = [];
  if (!sade) {
    const n = rngInt(r, 3);
    for (let k = 0; k < n; k++) {
      const satir = rngInt(r, 2) === 0;
      hava.push({
        tur: rngInt(r, 2) ? 'meltem' : 'cisenti',
        eksen: satir ? 'satir' : 'sutun',
        hatlar: [rngInt(r, satir ? h : w), rngInt(r, satir ? h : w)],
        periyot: 1 + rngInt(r, 4),
        baslangic: 1 + rngInt(r, 4),
      });
    }
  }
  const kural = sade ? 99 : rngInt(r, 100);
  return {
    id,
    ad: `rastgele ${id}`,
    mahalle: 0,
    tur: 'normal',
    w,
    h,
    renkSayisi,
    esik: sade ? 4 : 2 + rngInt(r, 4),
    hamle: sade ? 1000 : 8 + rngInt(r, 15),
    tohum: rngInt(r, 0x7fffffff),
    yardim: sade ? 0 : rngInt(r, 4),
    ozelEsikleri: sade ? [6, 9, 12] : esikSecenek[rngInt(r, esikSecenek.length)],
    dogumAgirliklari: Array.from({ length: renkSayisi }, () => 1 + (sade ? 0 : rngInt(r, 3))),
    hedefler,
    duzen,
    sabitKapsuller,
    onIsi,
    zemin: { dosemeler, desen: desenHucreleri.length ? { motif: 'lale', hucreler: desenHucreleri } : undefined, barutIzleri: izler },
    fenerDogum: !sade && rngInt(r, 3) === 0 ? { kalan: 1 + rngInt(r, 3), sahadaEnFazla: 1 + rngInt(r, 2) } : undefined,
    cikislar: !sade && rngInt(r, 4) === 0 ? [0, w - 1] : undefined,
    havaOlaylari: hava,
    korukKapasitesi: sade ? 0 : [0, 3, 8][rngInt(r, 3)],
    kurallar: {
      dortKomsu: kural < 8,
      yalnizHalka: kural >= 8 && kural < 12,
      caprazSiniri: kural >= 12 && kural < 18 ? 1 : null,
      soguma: kural >= 18 && kural < 25 ? 2 : 0,
    },
    botBandi: [0, 100],
    yildizEsikleri: [1000, 3000],
  };
}

function komsuListe(d: OyunDurumu): readonly Konum[] {
  return d.kurallar.dortKomsu ? DIK : SEKIZ;
}

/** Rastgele bir yol dene (halka kuralında 4'lü döngü arar). */
function rastgeleYol(d: OyunDurumu, r: R): { yol: Konum[]; halka: boolean } | null {
  const komsu = komsuListe(d);
  const adaylar: number[] = [];
  for (let i = 0; i < d.hucreler.length; i++) {
    const x = i % d.w;
    if (zincirlenebilir(d, x, (i - x) / d.w, -1)) adaylar.push(i);
  }
  if (adaylar.length === 0) return null;
  for (let deneme = 0; deneme < 25; deneme++) {
    const s = adaylar[rngInt(r, adaylar.length)];
    const p: Konum[] = [{ x: s % d.w, y: (s - (s % d.w)) / d.w }];
    let renk = d.hucreler[s].icerik?.tur === 'kapsul' ? (d.hucreler[s].icerik as { renk: number }).renk : -1;
    const hedefUzunluk = 3 + rngInt(r, 12);
    const icinde = new Set<number>([s]);
    while (p.length < hedefUzunluk) {
      const son = p[p.length - 1];
      const sec: Konum[] = [];
      for (const k of komsu) {
        const nx = son.x + k.x;
        const ny = son.y + k.y;
        if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h || icinde.has(ny * d.w + nx)) continue;
        if (zincirlenebilir(d, nx, ny, renk)) sec.push({ x: nx, y: ny });
      }
      if (sec.length === 0) break;
      const n = sec[rngInt(r, sec.length)];
      p.push(n);
      icinde.add(n.y * d.w + n.x);
      const ic = d.hucreler[n.y * d.w + n.x].icerik;
      if (renk === -1 && ic?.tur === 'kapsul' && ic.renk !== -1) renk = ic.renk;
    }
    if (p.length < 3) continue;
    const son = p[p.length - 1];
    const ilk = p[0];
    const bitisik = d.kurallar.dortKomsu ? Math.abs(son.x - ilk.x) + Math.abs(son.y - ilk.y) === 1 : Math.abs(son.x - ilk.x) <= 1 && Math.abs(son.y - ilk.y) <= 1;
    const halkaOl = p.length >= 4 && bitisik && (d.kurallar.yalnizHalka || rngInt(r, 2) === 0);
    if (yolDogrula(d, p, halkaOl) === null) return { yol: p, halka: halkaOl };
  }
  if (d.kurallar.yalnizHalka) return dortluHalka(d);
  return ucluYol(d);
}

/**
 * Rastgele denemeler bulamazsa belirlenimli geçerli 3'lü yol (orta düğüm ve
 * iki komşusu). Bulanık oyunlar "hamle bulunamadı" diye erken bitmesin;
 * kilitsiz tahtada her zaman bulunur (kilitliMi ile aynı tanım).
 */
function ucluYol(d: OyunDurumu): { yol: Konum[]; halka: boolean } | null {
  const komsu = komsuListe(d);
  for (let b = 0; b < d.hucreler.length; b++) {
    const pb = { x: b % d.w, y: (b - (b % d.w)) / d.w };
    if (!zincirlenebilir(d, pb.x, pb.y, -1)) continue;
    for (const ka of komsu) {
      for (const kc of komsu) {
        if (ka === kc) continue;
        const p = [{ x: pb.x + ka.x, y: pb.y + ka.y }, pb, { x: pb.x + kc.x, y: pb.y + kc.y }];
        if (yolDogrula(d, p, false) === null) return { yol: p, halka: false };
      }
    }
  }
  return null;
}

/** yalnizHalka kuralı için ilk 4'lü döngü (belirlenimli). */
function dortluHalka(d: OyunDurumu): { yol: Konum[]; halka: boolean } | null {
  const komsu = komsuListe(d);
  for (let c = 0; c < d.renkSayisi; c++) {
    for (let v0 = 0; v0 < d.hucreler.length; v0++) {
      const p0 = { x: v0 % d.w, y: (v0 - (v0 % d.w)) / d.w };
      if (!zincirlenebilir(d, p0.x, p0.y, c)) continue;
      const ara = (yolP: Konum[]): Konum[] | null => {
        if (yolP.length === 4) return yolDogrula(d, yolP, true) === null ? yolP : null;
        const son = yolP[yolP.length - 1];
        for (const k of komsu) {
          const n = { x: son.x + k.x, y: son.y + k.y };
          if (n.x < 0 || n.y < 0 || n.x >= d.w || n.y >= d.h) continue;
          if (yolP.some((q) => q.x === n.x && q.y === n.y) || !zincirlenebilir(d, n.x, n.y, c)) continue;
          const s = ara([...yolP, n]);
          if (s) return s;
        }
        return null;
      };
      const y = ara([p0]);
      if (y) return { yol: y, halka: true };
    }
  }
  return null;
}

/** Rastgele geçerli hamle (bulunamazsa null). */
export function rastgeleHamle(d: OyunDurumu, r: R, guclendiriciIzin = true): Hamle | null {
  const hucreSec = (): Konum | null => {
    const l: number[] = [];
    for (let i = 0; i < d.hucreler.length; i++) if (!d.hucreler[i].delik) l.push(i);
    if (!l.length) return null;
    const i = l[rngInt(r, l.length)];
    return { x: i % d.w, y: (i - (i % d.w)) / d.w };
  };
  if (d.korukKapasite > 0 && d.korukDolum >= d.korukKapasite && rngInt(r, 2) === 0) {
    const m = hucreSec();
    if (m) return { tur: 'koruk', merkez: m };
  }
  if (guclendiriciIzin && d.istatistik.guclendirici === 0 && rngInt(r, 25) === 0) {
    if (rngInt(r, 2) === 0) {
      const m = hucreSec();
      if (m) return { tur: 'kibrit', hucre: m };
    } else {
      const duz: number[] = [];
      d.hucreler.forEach((h, i) => {
        if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.ozel === 'yok' && h.icerik.renk >= 0) duz.push(i);
      });
      if (duz.length) {
        const i = duz[rngInt(r, duz.length)];
        return { tur: 'kalip', hucre: { x: i % d.w, y: (i - (i % d.w)) / d.w }, eksen: rngInt(r, 4) as 0 };
      }
    }
  }
  const ozeller: number[] = [];
  d.hucreler.forEach((h, i) => {
    if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok') ozeller.push(i);
  });
  if (ozeller.length && rngInt(r, 6) === 0) {
    const i = ozeller[rngInt(r, ozeller.length)];
    return { tur: 'ciftDokunus', hucre: { x: i % d.w, y: (i - (i % d.w)) / d.w } };
  }
  const y = rastgeleYol(d, r);
  if (y) return { tur: 'fitil', yol: y.yol, halka: y.halka };
  if (ozeller.length) {
    const i = ozeller[0];
    return { tur: 'ciftDokunus', hucre: { x: i % d.w, y: (i - (i % d.w)) / d.w } };
  }
  return null;
}

/** Belirlenimli seçici (altın tekrarlar): (y, x) sırasında ilk başlangıçtan açgözlü en uzun yol (≤ 8). */
export function ilkHamle(d: OyunDurumu): Hamle | null {
  const komsu = komsuListe(d);
  for (let s = 0; s < d.hucreler.length; s++) {
    const sx = s % d.w;
    const sy = (s - sx) / d.w;
    if (!zincirlenebilir(d, sx, sy, -1)) continue;
    const p: Konum[] = [{ x: sx, y: sy }];
    const ic0 = d.hucreler[s].icerik;
    let renk = ic0?.tur === 'kapsul' ? ic0.renk : -1;
    while (p.length < 8) {
      const son = p[p.length - 1];
      let eklendi = false;
      for (const k of komsu) {
        const n = { x: son.x + k.x, y: son.y + k.y };
        if (n.x < 0 || n.y < 0 || n.x >= d.w || n.y >= d.h) continue;
        if (p.some((q) => q.x === n.x && q.y === n.y) || !zincirlenebilir(d, n.x, n.y, renk)) continue;
        p.push(n);
        const ic = d.hucreler[n.y * d.w + n.x].icerik;
        if (renk === -1 && ic?.tur === 'kapsul') renk = ic.renk;
        eklendi = true;
        break;
      }
      if (!eklendi) break;
    }
    if (p.length >= 3 && yolDogrula(d, p, false) === null) return { tur: 'fitil', yol: p, halka: false };
  }
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok') return { tur: 'ciftDokunus', hucre: { x: i % d.w, y: (i - (i % d.w)) / d.w } };
  }
  return null;
}
