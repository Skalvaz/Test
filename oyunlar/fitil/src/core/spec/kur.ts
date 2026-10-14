/**
 * Şartname testleri için tahta kurucu ve yardımcılar (GDD §8.1 biçimine çevirir).
 *
 * Bu dosya çekirdeğin İÇİNE bakmaz: yalnız `src/core/index.ts` API'sini ve
 * sözleşme tiplerini kullanır. Testler GDD'yi kara kutu olarak sabitler.
 *
 * ── Mini dil (`tahta` satırları; simgeler tek boşlukla ayrılır) ──────────
 *   R A Z G M P    kapsül rengi: 0 Kızıl, 1 Kehribar, 2 Zümrüt, 3 Gök, 4 Mor, 5 Gül
 *   *              yıldız topu (renk −1, joker)
 *   renk ardından: rakam = ısı; '-' '|' '/' '\' = roket ekseni 0/1/2/3; '@' = kasımpatı
 *                  örn. "R", "G3", "R-", "Z2|", "M@", "*", "*2"
 *   .              dolum renginde düz kapsül (varsayılan Gül = 5)
 *   C:<kapsül>     kafesli kapsül, örn. "C:R", "C:G3"
 *   W:<renk>       ıslak barut, örn. "W:G"
 *   F fener · I is · # delik · _ boş hücre (yüklemeden sonra boşaltılır)
 *   K1 K2 K3 kaya · S (= S2) / S1 kova · D / D<n> dev fişek (kapasite n)
 *   D<n>:<m>       dolumu m olan dev fişek (yüklemeden sonra yazılır)
 *
 * ── Zemin (`zemin` satırları, isteğe bağlı; parçalar '+' ile birleşir) ────
 *   .              zemin yok
 *   1 / 2          döşeme katı
 *   d<renk>        desen hücresi, örn. "dR"
 *   i<n> / j<n>    0. / 1. barut izinin n. hücresi (iz sırası n ile verilir)
 *
 * Dolum rengi `dogumAgirliklari` ile tek renge zorlanır (varsayılan Gül),
 * böylece yerçekiminden sonra doğan kapsüller belirlenimli ve tahmin edilebilir.
 *
 * `kur()` bölüm verisini `bolumuYukle` ile yükler, sonra içerik katmanını
 * çizimdeki hâliyle yeniden yazar: başlangıç tahtası kilitli olsa bile
 * (§8.1 adım 4 yeniden renklendirme) test tam olarak çizilen tahtayla başlar.
 */
import { bolumuYukle, hamleUygula, yolDogrula } from '../index';
import type {
  BolumVerisi,
  Eksen,
  Hamle,
  HamleSonucu,
  HavaOlayiVerisi,
  Hedef,
  Icerik,
  Konum,
  Kurallar,
  Olay,
  OlayTuru,
  OyunDurumu,
  OzelTur,
  Renk,
} from '../index';

export const KIZIL = 0;
export const KEHRIBAR = 1;
export const ZUMRUT = 2;
export const GOK = 3;
export const MOR = 4;
export const GUL = 5;

const RENK_HARFI: Record<string, Renk> = { R: 0, A: 1, Z: 2, G: 3, M: 4, P: 5 };
const EKSEN_SIMGESI: Record<string, Eksen> = { '-': 0, '|': 1, '/': 2, '\\': 3 };
const VARSAYILAN_DOLUM = GUL;
const VARSAYILAN_DEV_FISEK = 5;

export interface Kurulum {
  /** İçerik katmanı (H satır × W simge). */
  tahta: string[];
  /** Zemin katmanı (isteğe bağlı, aynı boyut). */
  zemin?: string[];
  renkSayisi?: number;
  /** Tek renk dolum (dogumAgirliklari tek sıcak). Varsayılan Gül (5). */
  dolum?: number;
  /** Açık doğum ağırlıkları (verilirse `dolum` yalnız '.' simgesinin rengidir). */
  dogumAgirliklari?: number[];
  esik?: number;
  hamle?: number;
  tohum?: number;
  denemeNo?: number;
  yardim?: number;
  ozelEsikleri?: [number, number, number];
  hedefler?: Hedef[];
  havaOlaylari?: HavaOlayiVerisi[];
  korukKapasitesi?: number;
  /** Yüklemeden sonra Körük dolumu (tam dolu körük testleri için). */
  korukDolum?: number;
  kurallar?: Kurallar;
  fenerDogum?: { kalan: number; sahadaEnFazla: number };
  cikislar?: number[];
  devFisekKapasite?: number;
}

type Simge = { delik: boolean; bos: boolean; kafes: boolean; icerik: Icerik | null };

function kapsulCoz(s: string, dolum: number): Icerik {
  if (s === '.') return { tur: 'kapsul', renk: dolum as Renk, isi: 0, ozel: 'yok', eksen: 0 };
  const m = /^([RAZGMP*])(\d?)([-|/\\@]?)$/.exec(s);
  if (!m) throw new Error(`kur: bilinmeyen simge "${s}"`);
  const yildiz = m[1] === '*';
  const isi = m[2] ? Number(m[2]) : 0;
  let ozel: OzelTur = yildiz ? 'yildiz' : 'yok';
  let eksen: Eksen = 0;
  if (m[3]) {
    if (yildiz) throw new Error(`kur: yıldız topuna eksen/tür verilemez "${s}"`);
    if (m[3] === '@') ozel = 'kasimpati';
    else {
      ozel = 'roket';
      eksen = EKSEN_SIMGESI[m[3]];
    }
  }
  return { tur: 'kapsul', renk: yildiz ? -1 : RENK_HARFI[m[1]], isi, ozel, eksen };
}

function simgeCoz(s: string, dolum: number, devKap: number): Simge {
  const yalin = (icerik: Icerik | null, kafes = false): Simge => ({ delik: false, bos: false, kafes, icerik });
  if (s === '#') return { delik: true, bos: false, kafes: false, icerik: null };
  if (s === '_') return { delik: false, bos: true, kafes: false, icerik: null };
  if (s === 'F') return yalin({ tur: 'fener' });
  if (s === 'I') return yalin({ tur: 'is' });
  if (s === 'K1' || s === 'K2' || s === 'K3') return yalin({ tur: 'kaya', kat: Number(s[1]) as 1 | 2 | 3 });
  if (s === 'S' || s === 'S2') return yalin({ tur: 'kova', kat: 2 });
  if (s === 'S1') return yalin({ tur: 'kova', kat: 1 });
  const dev = /^D(\d+)?(?::(\d+))?$/.exec(s);
  if (dev) return yalin({ tur: 'devFisek', kapasite: dev[1] ? Number(dev[1]) : devKap, dolum: dev[2] ? Number(dev[2]) : 0 });
  if (s.startsWith('C:')) return yalin(kapsulCoz(s.slice(2), dolum), true);
  if (s.startsWith('W:')) {
    const renk = RENK_HARFI[s.slice(2)];
    if (renk === undefined) throw new Error(`kur: ıslak rengi "${s}"`);
    return yalin({ tur: 'islak', renk });
  }
  return yalin(kapsulCoz(s, dolum));
}

function satirlariCoz(satirlar: readonly string[]): string[][] {
  const t = satirlar.map((r) => r.trim().split(/\s+/));
  const w = t[0]?.length ?? 0;
  t.forEach((r, y) => {
    if (r.length !== w) throw new Error(`kur: satır ${y} ${r.length} simge, beklenen ${w}`);
  });
  return t;
}

function duzenSimgesi(sg: Simge, devKap: number): string {
  if (sg.delik) return '#';
  if (sg.bos || !sg.icerik) return '.';
  const ic = sg.icerik;
  switch (ic.tur) {
    case 'kapsul':
      return sg.kafes ? 'C' : '.';
    case 'islak':
      return 'W';
    case 'fener':
      return 'F';
    case 'is':
      return 'I';
    case 'kaya':
      return `K${ic.kat}`;
    case 'kova':
      return ic.kat === 2 ? 'S' : 'S1';
    case 'devFisek':
      return ic.kapasite === devKap ? 'D' : `D${ic.kapasite}`;
  }
}

/** Mini dilden bölüm verisi (§8.1). */
export function kurBolum(k: Kurulum): BolumVerisi {
  const dolum = k.dolum ?? VARSAYILAN_DOLUM;
  const renkSayisi = k.renkSayisi ?? 6;
  const devKap = k.devFisekKapasite ?? VARSAYILAN_DEV_FISEK;
  const t = satirlariCoz(k.tahta);
  const h = t.length;
  const w = t[0].length;
  const agirlik = k.dogumAgirliklari ?? Array.from({ length: renkSayisi }, (_, i) => (i === dolum ? 1 : 0));
  if (agirlik.length !== renkSayisi) throw new Error('kur: dogumAgirliklari uzunluğu renkSayisi olmalı');

  const duzen: string[] = [];
  const sabitKapsuller: NonNullable<BolumVerisi['sabitKapsuller']> = [];
  for (let y = 0; y < h; y++) {
    const satir: string[] = [];
    for (let x = 0; x < w; x++) {
      const sg = simgeCoz(t[y][x], dolum, devKap);
      satir.push(duzenSimgesi(sg, devKap));
      const ic = sg.icerik;
      if (ic?.tur === 'kapsul') {
        const s: NonNullable<BolumVerisi['sabitKapsuller']>[number] = { x, y, renk: ic.renk };
        if (ic.ozel !== 'yok') s.ozel = ic.ozel;
        if (ic.ozel === 'roket') s.eksen = ic.eksen;
        if (ic.isi > 0) s.isi = ic.isi;
        sabitKapsuller.push(s);
      } else if (ic?.tur === 'islak') {
        sabitKapsuller.push({ x, y, renk: ic.renk });
      }
    }
    duzen.push(satir.join(' '));
  }

  const dosemeler: [number, number, 1 | 2][] = [];
  const desen: [number, number, number][] = [];
  const izler: [number, number, number][][] = [[], []];
  if (k.zemin) {
    const z = satirlariCoz(k.zemin);
    if (z.length !== h || z[0].length !== w) throw new Error('kur: zemin boyutu tahtayla aynı olmalı');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (z[y][x] === '.') continue;
        for (const p of z[y][x].split('+')) {
          let m: RegExpExecArray | null;
          if (p === '1' || p === '2') dosemeler.push([x, y, Number(p) as 1 | 2]);
          else if ((m = /^d([RAZGMP])$/.exec(p))) desen.push([x, y, RENK_HARFI[m[1]]]);
          else if ((m = /^([ij])(\d+)$/.exec(p))) izler[m[1] === 'i' ? 0 : 1].push([Number(m[2]), x, y]);
          else throw new Error(`kur: bilinmeyen zemin parçası "${p}"`);
        }
      }
    }
  }
  const barutIzleri = izler.filter((iz) => iz.length > 0).map((iz) => iz.sort((a, b) => a[0] - b[0]).map(([, x, y]) => [x, y] as [number, number]));

  const v: BolumVerisi = {
    id: 9000,
    ad: 'şartname',
    mahalle: 0,
    tur: 'normal',
    w,
    h,
    renkSayisi,
    esik: k.esik ?? 4,
    hamle: k.hamle ?? 20,
    tohum: k.tohum ?? 12345,
    yardim: k.yardim ?? 0,
    ozelEsikleri: k.ozelEsikleri ?? [6, 9, 12],
    dogumAgirliklari: agirlik,
    hedefler: k.hedefler ?? [{ tur: 'puan', puan: 999999 }],
    duzen,
    sabitKapsuller,
    zemin: {
      dosemeler,
      ...(desen.length ? { desen: { motif: 'lale' as const, hucreler: desen } } : {}),
      barutIzleri,
    },
    korukKapasitesi: k.korukKapasitesi ?? 0,
    botBandi: [0, 100],
    yildizEsikleri: [1000, 2000],
  };
  if (k.havaOlaylari) v.havaOlaylari = k.havaOlaylari;
  if (k.kurallar) v.kurallar = k.kurallar;
  if (k.fenerDogum) v.fenerDogum = k.fenerDogum;
  if (k.cikislar) v.cikislar = k.cikislar;
  if (k.devFisekKapasite !== undefined) v.devFisekKapasite = k.devFisekKapasite;
  return v;
}

/** Durumun içerik katmanını mini dildeki satırlarla doğrudan yazar (zemin dokunulmaz). */
export function tahtaYaz(d: OyunDurumu, satirlar: readonly string[], dolum = VARSAYILAN_DOLUM, devKap = VARSAYILAN_DEV_FISEK): void {
  const t = satirlariCoz(satirlar);
  if (t.length !== d.h || t[0].length !== d.w) throw new Error('tahtaYaz: boyut uyuşmuyor');
  for (let y = 0; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) {
      const sg = simgeCoz(t[y][x], dolum, devKap);
      const c = d.hucreler[y * d.w + x];
      c.delik = sg.delik;
      c.kafes = sg.kafes;
      c.icerik = sg.icerik;
    }
  }
}

/** Bölümü yükler ve tahtayı çizimdeki hâline getirir. */
export function kur(k: Kurulum): OyunDurumu {
  const v = kurBolum(k);
  const d = bolumuYukle(v, k.denemeNo ?? 0);
  tahtaYaz(d, k.tahta, k.dolum ?? VARSAYILAN_DOLUM, k.devFisekKapasite ?? VARSAYILAN_DEV_FISEK);
  if (k.korukDolum !== undefined) d.korukDolum = k.korukDolum;
  return d;
}

// ── Hamleler ────────────────────────────────────────────────────────────

/** "x,y x,y …" → Konum[]. */
export function yol(s: string): Konum[] {
  const t = s.trim();
  if (!t) return [];
  return t.split(/\s+/).map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });
}

export const fitil = (s: string, halka = false): Hamle => ({ tur: 'fitil', yol: yol(s), halka });
export const cift = (x: number, y: number): Hamle => ({ tur: 'ciftDokunus', hucre: { x, y } });
export const koruk = (x: number, y: number): Hamle => ({ tur: 'koruk', merkez: { x, y } });
export const kibrit = (x: number, y: number): Hamle => ({ tur: 'kibrit', hucre: { x, y } });
export const kalip = (x: number, y: number, eksen: Eksen): Hamle => ({ tur: 'kalip', hucre: { x, y }, eksen });

export function uygula(d: OyunDurumu, h: Hamle): HamleSonucu {
  return hamleUygula(d, h);
}

// ── Olay süzgeçleri ─────────────────────────────────────────────────────

export type OlayT<T extends OlayTuru> = Extract<Olay, { tur: T }>;

export function sec<T extends OlayTuru>(ol: readonly Olay[], tur: T): OlayT<T>[] {
  return ol.filter((o): o is OlayT<T> => o.tur === tur);
}

function olayHucresi(o: Olay): Konum | undefined {
  return (o as { hucre?: Konum }).hucre;
}

/** `tur` olaylarından hücresi (x, y) olanlar. */
export function hucrede<T extends OlayTuru>(ol: readonly Olay[], tur: T, x: number, y: number): OlayT<T>[] {
  return sec(ol, tur).filter((o) => {
    const h = olayHucresi(o);
    return !!h && h.x === x && h.y === y;
  });
}

export const anahtar = (p: Konum): string => `${p.x},${p.y}`;

/** Patlamaları hücreye göre eşler; bir hücre iki kez patlarsa hata (§3.5 ilk plan kazanır). */
export function patlamaHaritasi(ol: readonly Olay[]): Map<string, OlayT<'patlama'>> {
  const m = new Map<string, OlayT<'patlama'>>();
  for (const p of sec(ol, 'patlama')) {
    const a = anahtar(p.hucre);
    if (m.has(a)) throw new Error(`hücre ${a} bir hamlede iki kez patladı`);
    m.set(a, p);
  }
  return m;
}

/** (x, y) hücresindeki tek patlama (yoksa undefined). */
export function patlamaAt(ol: readonly Olay[], x: number, y: number): OlayT<'patlama'> | undefined {
  return patlamaHaritasi(ol).get(`${x},${y}`);
}

/** Olayların t değerleri azalmayan mı (types.ts Olay belgesi). */
export function tAzalmayan(ol: readonly Olay[]): boolean {
  for (let i = 1; i < ol.length; i++) if (ol[i].t < ol[i - 1].t) return false;
  return true;
}

// ── Durum okuyucular ────────────────────────────────────────────────────

export function ic(d: OyunDurumu, x: number, y: number): Icerik | null {
  return d.hucreler[y * d.w + x].icerik;
}

export function hucreAt(d: OyunDurumu, x: number, y: number) {
  return d.hucreler[y * d.w + x];
}

export function kapsulSayisi(d: OyunDurumu): number {
  return d.hucreler.reduce((s, c) => s + (!c.delik && c.icerik?.tur === 'kapsul' ? 1 : 0), 0);
}

export function ozelSayisi(d: OyunDurumu): number {
  return d.hucreler.reduce((s, c) => s + (!c.delik && c.icerik?.tur === 'kapsul' && c.icerik.ozel !== 'yok' ? 1 : 0), 0);
}

export function cheb(a: Konum, b: Konum): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Tahtadaki bütün konumlar (y, x) sırasıyla. */
export function konumlar(d: { w: number; h: number }): Konum[] {
  const r: Konum[] = [];
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) r.push({ x, y });
  return r;
}

/**
 * §3.5.1 fitil zamanları, GDD formülünden bağımsız hesap:
 * t0 = 0; k > 0 için t_k = t_{k−1} + max(35, 110 − 7·k) (k 0 tabanlı).
 */
export function fitilZamanlari(n: number): number[] {
  const r: number[] = [];
  let t = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) t += Math.max(35, 110 - 7 * k);
    r.push(t);
  }
  return r;
}

/** §7.2 reaksiyon bonusu (yalnız en yüksek kademe). */
export function reaksiyonBonusu(R: number): { kademe: 'guzel' | 'harika' | 'muhtesem' | 'senlik' | null; bonus: number } {
  if (R >= 40) return { kademe: 'senlik', bonus: 1200 };
  if (R >= 25) return { kademe: 'muhtesem', bonus: 600 };
  if (R >= 15) return { kademe: 'harika', bonus: 300 };
  if (R >= 8) return { kademe: 'guzel', bonus: 100 };
  return { kademe: null, bonus: 0 };
}

/** Derin dondurma (§16.4: hamleUygula girdiyi değiştirmez, Object.freeze ile). */
export function derinDondur<T>(o: T): T {
  if (o !== null && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) derinDondur(v);
  }
  return o;
}

// ── Bulanık oyun için aday yol (yalnız API: yolDogrula) ─────────────────

const SEKIZ_YON: readonly Konum[] = [
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
];

function zincireUygun(d: OyunDurumu, p: Konum, renk: number): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= d.w || p.y >= d.h) return false;
  const c = d.hucreler[p.y * d.w + p.x];
  if (c.delik || c.kafes || c.icerik?.tur !== 'kapsul') return false;
  return renk === -1 || c.icerik.renk === -1 || c.icerik.renk === renk;
}

/**
 * Tohuma göre belirlenimli, açgözlü bir geçerli yol arar (uzunluk 3..8).
 * Bulamazsa null. Doğrulama çekirdeğin `yolDogrula`sına bırakılır.
 */
export function adayYol(d: OyunDurumu, tohum: number): Konum[] | null {
  const n = d.w * d.h;
  const hedefUzunluk = 3 + (tohum % 6);
  for (let s = 0; s < n; s++) {
    const i = (s + tohum * 7) % n;
    const p0 = { x: i % d.w, y: Math.floor(i / d.w) };
    if (!zincireUygun(d, p0, -1)) continue;
    const c0 = d.hucreler[i].icerik;
    let renk = c0?.tur === 'kapsul' ? c0.renk : -1;
    const P: Konum[] = [p0];
    while (P.length < hedefUzunluk) {
      const son = P[P.length - 1];
      let eklendi = false;
      for (let r = 0; r < 8; r++) {
        const yon = SEKIZ_YON[(r + tohum + P.length) % 8];
        const q = { x: son.x + yon.x, y: son.y + yon.y };
        if (P.some((p) => p.x === q.x && p.y === q.y)) continue;
        if (!zincireUygun(d, q, renk)) continue;
        if (renk === -1) {
          const cq = d.hucreler[q.y * d.w + q.x].icerik;
          if (cq?.tur === 'kapsul') renk = cq.renk;
        }
        P.push(q);
        eklendi = true;
        break;
      }
      if (!eklendi) break;
    }
    if (P.length >= 3 && yolDogrula(d, P, false) === null) return P;
  }
  return null;
}
