/**
 * Bot aday üretimi (GDD §16.5 "Aday üretimi", adım 1–5).
 *
 *  1. Renk bileşenleri (G_c = c renkli zincirlenebilir kapsüller ∪ yıldız
 *     topları; zincir komşuluğu, `dortKomsu`'da 4-komşu).
 *  2. Boyutu ≥ 3 olan her bileşende bot RNG'siyle sıralanmış tohumlu DFS;
 *     uzunluğu ≥ 3 olan her ön ek aday. Bileşen başına ≤ 300 aday ve ≤ 5000
 *     DFS düğümü. DFS sırasında 4–8 düğümlü halkalar da toplanır (3c).
 *  3. Şablonlar: (a) Warnsdorff en uzun yollar (en iyi 10), (b) hedef sarma,
 *     (c) 2×2 halkalar, (d) roket nişan varyantları (farklı son adım).
 *  4. Yinelenen eleme: (düğüm kümesi, son düğüm, son eksen, halka). Toplam
 *     ≤ 2000 aday.
 *  5. Ucuz puan (`ucuzPuanla`): önizlemenin ilk dalgası, hedef hücreleri,
 *     uzunluk, özel taş. En iyi K aday tam `hamleUygula` ile çözülür (usta.ts).
 *
 * Saf: DOM/Date/Math.random yok; bütün rastgelelik verilen bot RNG'sinden.
 * Adaylar hücre indeksleriyle (i = y·w + x) tutulur.
 */
import { mulberry32Bir, rngInt, ozelTuruBul } from '../core/index';
import type { OyunDurumu } from '../core/index';
import AG from './agirliklar.json';

export interface Aday {
  /** Yol düğümleri (hücre indeksi). */
  yol: number[];
  halka: boolean;
  /** Ucuz puan (adım 5); `ucuzPuanla` yazar. */
  ucuz: number;
}

export interface BotRng {
  rng: number;
}

/** §16.5 sınırları. */
export const SINIR = {
  dfsAday: 300,
  dfsDugum: 5000,
  warnsdorff: 10,
  toplam: 2000,
  halkaEnAz: 4,
  halkaEnCok: 8,
} as const;

/** Hamle başına bir kez hesaplanan tahta özeti (adaylar ve ucuz puan için). */
export interface TahtaBilgi {
  d: OyunDurumu;
  w: number;
  h: number;
  n: number;
  /** −2: zincire giremez, −1: joker (yıldız topu), 0..5: renk. */
  renk: Int8Array;
  /** Zincir komşuları: komsu[i·8 + k], k < komsuSay[i]. */
  komsu: Int16Array;
  komsuSay: Uint8Array;
  /** Dik komşular (delik dışı): dik[i·4 + k], k < dikSay[i]. */
  dik: Int16Array;
  dikSay: Uint8Array;
  /** Yoldaki en fazla çapraz adım (yoksa sonsuz). */
  caprazSiniri: number;
  /** İlk hamle kısıtı (§15): 1 olan hücreler kullanılabilir; null = serbest. */
  izin: Uint8Array | null;
  /** Kova kalkanı (§5): hamle başında kovaya dik komşu. */
  kalkan: Uint8Array;
  /** Isınabilir kapsülün ısısı; ısınamazsa −1. */
  isi: Int8Array;
  /** En küçük açık özel taş eşiği (yoksa sonsuz). */
  enKucukOzel: number;
}

const ZOBRIST = new Map<number, Uint32Array>();
function zobrist(n: number): Uint32Array {
  let z = ZOBRIST.get(n);
  if (!z) {
    z = new Uint32Array(2 * n);
    const r = { rng: 0x2545f491 };
    for (let k = 0; k < z.length; k++) z[k] = mulberry32Bir((r.rng = (r.rng + 0x9e3779b9) >>> 0));
    ZOBRIST.set(n, z);
  }
  return z;
}

export function tahtaBilgi(d: OyunDurumu, izinListesi: readonly (readonly [number, number])[] | null = null): TahtaBilgi {
  const { w, h } = d;
  const n = w * h;
  const renk = new Int8Array(n).fill(-2);
  const isi = new Int8Array(n).fill(-1);
  const kalkan = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = d.hucreler[i];
    if (c.delik) continue;
    const ic = c.icerik;
    if (ic?.tur === 'kapsul') {
      isi[i] = ic.isi;
      if (!c.kafes) renk[i] = ic.renk;
    } else if (ic?.tur === 'kova') {
      const x = i % w;
      const y = (i - x) / w;
      if (y > 0) kalkan[i - w] = 1;
      if (y < h - 1) kalkan[i + w] = 1;
      if (x > 0) kalkan[i - 1] = 1;
      if (x < w - 1) kalkan[i + 1] = 1;
    }
  }
  const dort = !!d.kurallar.dortKomsu;
  const komsu = new Int16Array(8 * n);
  const komsuSay = new Uint8Array(n);
  const dik = new Int16Array(4 * n);
  const dikSay = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (d.hucreler[i].delik) continue;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (d.hucreler[j].delik) continue;
        const dikMi = dx === 0 || dy === 0;
        if (dikMi) dik[4 * i + dikSay[i]++] = j;
        if (dikMi || !dort) komsu[8 * i + komsuSay[i]++] = j;
      }
    }
  }
  let izin: Uint8Array | null = null;
  if (izinListesi && izinListesi.length > 0) {
    izin = new Uint8Array(n);
    for (const [x, y] of izinListesi) if (x >= 0 && y >= 0 && x < w && y < h) izin[y * w + x] = 1;
  }
  const [r, k, y] = d.ozelEsikleri;
  const acik = [r, k, y].filter((e) => e > 0);
  return {
    d,
    w,
    h,
    n,
    renk,
    komsu,
    komsuSay,
    dik,
    dikSay,
    caprazSiniri: d.kurallar.caprazSiniri ?? Infinity,
    izin,
    kalkan,
    isi,
    enKucukOzel: acik.length ? Math.min(...acik) : Infinity,
  };
}

/** c rengindeki (ya da joker) ve izinli hücre mi. */
function uygun(b: TahtaBilgi, i: number, c: number): boolean {
  const r = b.renk[i];
  return (r === c || r === -1) && (!b.izin || b.izin[i] === 1);
}

function capraz(w: number, a: number, b: number): boolean {
  return a % w !== b % w && Math.floor(a / w) !== Math.floor(b / w);
}

function komsuMu(b: TahtaBilgi, a: number, c: number): boolean {
  for (let k = 0; k < b.komsuSay[a]; k++) if (b.komsu[8 * a + k] === c) return true;
  return false;
}

/** Fisher–Yates (bot RNG). */
function karistir<T>(dizi: T[], r: BotRng): T[] {
  for (let k = dizi.length - 1; k > 0; k--) {
    const j = rngInt(r, k + 1);
    const g = dizi[k];
    dizi[k] = dizi[j];
    dizi[j] = g;
  }
  return dizi;
}

/** Son segmentten roket ekseni (§2.3). */
export function sonEksen(w: number, a: number, b: number): number {
  const dx = (b % w) - (a % w);
  const dy = Math.floor(b / w) - Math.floor(a / w);
  if (dy === 0) return 0;
  if (dx === 0) return 1;
  return dx * dy < 0 ? 2 : 3;
}

/** Aday toplayıcı: yinelenen eleme (adım 4) ve toplam sınırı. */
export class Toplayici {
  readonly adaylar: Aday[] = [];
  private readonly anahtarlar = new Set<string>();
  private readonly z: Uint32Array;
  constructor(
    private readonly b: TahtaBilgi,
    private readonly sinir: number = SINIR.toplam,
  ) {
    this.z = zobrist(b.n);
  }
  get dolu(): boolean {
    return this.adaylar.length >= this.sinir;
  }
  /**
   * Anahtar (§16.5 adım 4): (düğüm kümesi, son düğüm, son eksen, halka).
   * Özel taş oluşturmayan kısa yollarda ve halkalarda son düğüm ve eksen
   * sonucu değiştirmediğinden anahtara girmez (ters çevrilmiş eş yollar elenir).
   */
  ekle(yol: readonly number[], halka: boolean): boolean {
    if (this.dolu || yol.length < 3) return false;
    let z1 = 0;
    let z2 = 0;
    for (const i of yol) {
      z1 ^= this.z[2 * i];
      z2 ^= this.z[2 * i + 1];
    }
    const n = yol.length;
    const anahtar = halka || n < this.b.enKucukOzel ? `${z1}:${z2}:${halka ? 'h' : 'y'}` : `${z1}:${z2}:${yol[n - 1]}:${sonEksen(this.b.w, yol[n - 2], yol[n - 1])}`;
    if (this.anahtarlar.has(anahtar)) return false;
    this.anahtarlar.add(anahtar);
    this.adaylar.push({ yol: yol.slice(), halka, ucuz: 0 });
    return true;
  }
}

export interface Bilesen {
  renk: number;
  hucreler: number[];
}

/** Adım 1: boyutu ≥ 3 olan renk bileşenleri. */
export function bilesenler(b: TahtaBilgi): Bilesen[] {
  const sonuc: Bilesen[] = [];
  const gorulen = new Uint8Array(b.n);
  const kuyruk: number[] = [];
  for (let c = 0; c < b.d.renkSayisi; c++) {
    gorulen.fill(0);
    for (let s = 0; s < b.n; s++) {
      if (gorulen[s] || !uygun(b, s, c)) continue;
      const hucreler: number[] = [];
      kuyruk.length = 0;
      kuyruk.push(s);
      gorulen[s] = 1;
      while (kuyruk.length) {
        const i = kuyruk.pop() as number;
        hucreler.push(i);
        for (let k = 0; k < b.komsuSay[i]; k++) {
          const j = b.komsu[8 * i + k];
          if (gorulen[j] || !uygun(b, j, c)) continue;
          gorulen[j] = 1;
          kuyruk.push(j);
        }
      }
      if (hucreler.length >= 3) sonuc.push({ renk: c, hucreler: hucreler.sort((a, z) => a - z) });
    }
  }
  return sonuc;
}

/**
 * Adım 2: tohumlu DFS. Başlangıçlar ve komşu sırası bot RNG'siyle karışır;
 * her başlangıç adil pay alsın diye başlangıç başına aday sınırı vardır.
 * DFS sırasında 4–8 düğümlü kapanabilen yollar halka adayı olur (3c).
 */
function dfsAdaylari(b: TahtaBilgi, bil: Bilesen, r: BotRng, t: Toplayici): void {
  const icinde = new Uint8Array(b.n);
  for (const i of bil.hucreler) icinde[i] = 1;
  const baslar = karistir(bil.hucreler.slice(), r);
  const pay = Math.max(8, Math.ceil((2 * SINIR.dfsAday) / baslar.length));
  const ziyaret = new Uint8Array(b.n);
  let aday = 0;
  let dugum = 0;
  const yol: number[] = [];
  const sira: number[][] = [];
  const kSay: number[] = [];
  const caprazYigin: number[] = [];
  for (const s of baslar) {
    if (aday >= SINIR.dfsAday || dugum >= SINIR.dfsDugum || t.dolu) break;
    let buBas = 0;
    yol.length = 0;
    sira.length = 0;
    kSay.length = 0;
    caprazYigin.length = 0;
    const it = (i: number): number[] => {
      const l: number[] = [];
      for (let k = 0; k < b.komsuSay[i]; k++) l.push(b.komsu[8 * i + k]);
      return karistir(l, r);
    };
    yol.push(s);
    ziyaret[s] = 1;
    sira.push(it(s));
    kSay.push(0);
    caprazYigin.push(0);
    dugum++;
    while (yol.length > 0) {
      if (aday >= SINIR.dfsAday || dugum >= SINIR.dfsDugum || buBas >= pay || t.dolu) break;
      const ust = yol.length - 1;
      const liste = sira[ust];
      if (kSay[ust] >= liste.length) {
        ziyaret[yol[ust]] = 0;
        yol.pop();
        sira.pop();
        kSay.pop();
        caprazYigin.pop();
        continue;
      }
      const j = liste[kSay[ust]++];
      if (!icinde[j] || ziyaret[j]) continue;
      const cp = caprazYigin[ust] + (capraz(b.w, yol[ust], j) ? 1 : 0);
      if (cp > b.caprazSiniri) continue;
      yol.push(j);
      ziyaret[j] = 1;
      sira.push(it(j));
      kSay.push(0);
      caprazYigin.push(cp);
      dugum++;
      if (yol.length >= 3 && t.ekle(yol, false)) {
        aday++;
        buBas++;
      }
      if (yol.length >= SINIR.halkaEnAz && yol.length <= SINIR.halkaEnCok && komsuMu(b, j, s) && t.ekle(yol, true)) {
        aday++;
        buBas++;
      }
    }
    for (const i of yol) ziyaret[i] = 0;
  }
}

/** Adım 3a: Warnsdorff açgözlü en uzun yol (en az ileri derece; eşitlikte bot önceliği). */
function warnsdorff(b: TahtaBilgi, icinde: Uint8Array, s: number, oncelik: Uint32Array, ziyaret: Uint8Array): number[] {
  const yol = [s];
  ziyaret[s] = 1;
  let cp = 0;
  let son = s;
  for (;;) {
    let en = -1;
    let enDer = 99;
    let enCp = 0;
    for (let k = 0; k < b.komsuSay[son]; k++) {
      const j = b.komsu[8 * son + k];
      if (!icinde[j] || ziyaret[j]) continue;
      const c = cp + (capraz(b.w, son, j) ? 1 : 0);
      if (c > b.caprazSiniri) continue;
      let der = 0;
      for (let m = 0; m < b.komsuSay[j]; m++) {
        const q = b.komsu[8 * j + m];
        if (icinde[q] && !ziyaret[q]) der++;
      }
      if (der < enDer || (der === enDer && oncelik[j] < oncelik[en])) {
        en = j;
        enDer = der;
        enCp = c;
      }
    }
    if (en < 0) break;
    yol.push(en);
    ziyaret[en] = 1;
    cp = enCp;
    son = en;
  }
  for (const i of yol) ziyaret[i] = 0;
  return yol;
}

/** İki hücre arasında bileşen içinde en kısa yol (BFS; `yasak` hücrelerden geçmez). */
function enKisaYol(b: TahtaBilgi, icinde: Uint8Array, a: number, z: number, yasak: Uint8Array): number[] | null {
  if (a === z) return [a];
  const onceki = new Int16Array(b.n).fill(-1);
  onceki[a] = a;
  const kuyruk = [a];
  for (let q = 0; q < kuyruk.length; q++) {
    const i = kuyruk[q];
    for (let k = 0; k < b.komsuSay[i]; k++) {
      const j = b.komsu[8 * i + k];
      if (onceki[j] >= 0 || !icinde[j] || (yasak[j] && j !== z)) continue;
      onceki[j] = i;
      if (j === z) {
        const yol = [z];
        let c = z;
        while (c !== a) {
          c = onceki[c];
          yol.push(c);
        }
        return yol.reverse();
      }
      kuyruk.push(j);
    }
  }
  return null;
}

/** Çapraz sınırına uyuyor mu. */
function caprazUygun(b: TahtaBilgi, yol: readonly number[]): boolean {
  if (b.caprazSiniri === Infinity) return true;
  let c = 0;
  for (let k = 1; k < yol.length; k++) if (capraz(b.w, yol[k - 1], yol[k])) c++;
  return c <= b.caprazSiniri;
}

/** Yolu bir uçtan bileşen içinde açgözlü uzat (hedef uzunluğa kadar). */
function uzat(b: TahtaBilgi, icinde: Uint8Array, yol: number[], hedefN: number, oncelik: Uint32Array): number[] {
  const y = yol.slice();
  const icerde = new Uint8Array(b.n);
  for (const i of y) icerde[i] = 1;
  while (y.length < hedefN) {
    const son = y[y.length - 1];
    let en = -1;
    for (let k = 0; k < b.komsuSay[son]; k++) {
      const j = b.komsu[8 * son + k];
      if (!icinde[j] || icerde[j]) continue;
      if (en < 0 || oncelik[j] < oncelik[en]) en = j;
    }
    if (en < 0) break;
    y.push(en);
    icerde[en] = 1;
  }
  return y;
}

/** Hücre bir hedef mi (sarma şablonu için): kafes, kızgın kapsül, engel. */
function sarmaHedefi(b: TahtaBilgi, i: number): boolean {
  const c = b.d.hucreler[i];
  if (c.delik || !c.icerik) return false;
  const ic = c.icerik;
  if (ic.tur === 'kapsul') return c.kafes || ic.isi >= b.d.esik - 1;
  return ic.tur === 'kaya' || ic.tur === 'kova' || ic.tur === 'is' || ic.tur === 'islak' || ic.tur === 'devFisek';
}

/** Zemin hedefi mi (döşeme ya da boyanmamış desen). */
function zeminHedefi(b: TahtaBilgi, i: number): boolean {
  const c = b.d.hucreler[i];
  return !c.delik && (c.doseme > 0 || (c.desenRengi >= 0 && !c.desenBoyali));
}

/**
 * Adım 3b: hedef hücrelerin en az 2 dik komşusunu içeren yollar. Komşular
 * bileşen içinde en kısa yollarla birleştirilir; kısa kalırsa uzatılır.
 * Ayrıca özel taş eşiğine uzatılmış varyant eklenir. Zemin hedefleri
 * (döşeme, desen) için yolun kendisi hedef hücrelerden geçer: zemin
 * hücrelerini önceleyen açgözlü yol.
 */
function sarmaSablonlari(b: TahtaBilgi, bil: Bilesen, icinde: Uint8Array, oncelik: Uint32Array, t: Toplayici): void {
  const yasak = new Uint8Array(b.n);
  const hedefler = new Set<number>();
  for (const i of bil.hucreler) {
    for (let k = 0; k < b.dikSay[i]; k++) {
      const m = b.dik[4 * i + k];
      if (sarmaHedefi(b, m)) hedefler.add(m);
    }
  }
  for (const T of hedefler) {
    const A: number[] = [];
    for (let k = 0; k < b.dikSay[T]; k++) {
      const m = b.dik[4 * T + k];
      if (icinde[m]) A.push(m);
    }
    if (A.length < 2) continue;
    for (const sira of [A, A.slice().reverse()]) {
      yasak.fill(0);
      yasak[T] = 1;
      let yol: number[] = [sira[0]];
      yasak[sira[0]] = 1;
      let kapsanan = 1;
      for (let j = 1; j < sira.length; j++) {
        if (yasak[sira[j]]) {
          kapsanan++;
          continue;
        }
        const ara = enKisaYol(b, icinde, yol[yol.length - 1], sira[j], yasak);
        if (!ara || ara.length > 8) continue;
        for (let q = 1; q < ara.length; q++) {
          yol.push(ara[q]);
          yasak[ara[q]] = 1;
        }
        kapsanan++;
      }
      if (kapsanan < 2) continue;
      if (yol.length < 3) {
        const u = uzat(b, icinde, yol, 3, oncelik);
        yol = u.length >= 3 ? u : uzat(b, icinde, yol.slice().reverse(), 3, oncelik);
      }
      if (!caprazUygun(b, yol)) continue;
      t.ekle(yol, false);
      if (yol.length < b.enKucukOzel && b.enKucukOzel < Infinity) {
        const u = uzat(b, icinde, yol, b.enKucukOzel, oncelik);
        if (u.length >= b.enKucukOzel && caprazUygun(b, u)) t.ekle(u, false);
      }
    }
  }
  // Zemin hedefleri: zemin hücrelerinden başlayan açgözlü yollar.
  for (const s of bil.hucreler) {
    if (!zeminHedefi(b, s)) continue;
    const yol = [s];
    const icerde = new Uint8Array(b.n);
    icerde[s] = 1;
    for (;;) {
      const son = yol[yol.length - 1];
      let en = -1;
      let enP = -1;
      for (let k = 0; k < b.komsuSay[son]; k++) {
        const j = b.komsu[8 * son + k];
        if (!icinde[j] || icerde[j]) continue;
        let p = zeminHedefi(b, j) ? 10 : 0;
        for (let m = 0; m < b.komsuSay[j]; m++) {
          const q = b.komsu[8 * j + m];
          if (icinde[q] && !icerde[q] && zeminHedefi(b, q)) p++;
        }
        if (p > enP || (p === enP && oncelik[j] < oncelik[en])) {
          en = j;
          enP = p;
        }
      }
      if (en < 0 || (enP === 0 && yol.length >= 3) || yol.length >= 12) break;
      yol.push(en);
      icerde[en] = 1;
    }
    if (yol.length >= 3 && caprazUygun(b, yol)) t.ekle(yol, false);
  }
}

/** Adım 3c: 2×2 halkalar (dört dik komşu; `dortKomsu`'da da geçerli). */
function kareHalkalar(b: TahtaBilgi, c: number, t: Toplayici): void {
  const { w, h } = b;
  for (let y = 0; y + 1 < h; y++) {
    for (let x = 0; x + 1 < w; x++) {
      const a = y * w + x;
      const kare = [a, a + 1, a + 1 + w, a + w];
      if (kare.every((i) => uygun(b, i, c))) t.ekle(kare, true);
    }
  }
}

/** Adım 3d: uzunluğu ≥ eşik olan yolların farklı son adımlı varyantları (roket nişanı). */
function nisanVaryantlari(b: TahtaBilgi, t: Toplayici): void {
  const esik = b.d.ozelEsikleri[0] > 0 ? b.d.ozelEsikleri[0] : b.enKucukOzel;
  if (esik === Infinity) return;
  const mevcut = t.adaylar.slice();
  const icerde = new Uint8Array(b.n);
  for (const a of mevcut) {
    if (t.dolu) return;
    const n = a.yol.length;
    if (a.halka || n < esik) continue;
    // Zincir rengi: ilk joker olmayan düğüm (hepsi jokerse varyant yok).
    let c = -1;
    for (const i of a.yol) {
      if (b.renk[i] >= 0) {
        c = b.renk[i];
        break;
      }
    }
    if (c < 0) continue;
    for (const i of a.yol) icerde[i] = 1;
    const onceki = a.yol[n - 2];
    const eskiEksen = sonEksen(b.w, onceki, a.yol[n - 1]);
    for (let k = 0; k < b.komsuSay[onceki]; k++) {
      const q = b.komsu[8 * onceki + k];
      if (icerde[q] || !uygun(b, q, c)) continue;
      if (sonEksen(b.w, onceki, q) === eskiEksen) continue;
      const v = a.yol.slice(0, n - 1);
      v.push(q);
      if (caprazUygun(b, v)) t.ekle(v, false);
    }
    for (const i of a.yol) icerde[i] = 0;
  }
}

/**
 * Bütün adaylar (adım 1–4). Şablonlar önce toplanır (toplam sınırında
 * kesilmesinler), sonra bileşen DFS'leri, en son nişan varyantları.
 * `yalnizHalka` kuralında yalnız halkalar döner.
 */
export function adaylariUret(b: TahtaBilgi, r: BotRng, sinir: number = SINIR.toplam): Aday[] {
  const t = new Toplayici(b, sinir);
  const bils = bilesenler(b);
  const oncelik = new Uint32Array(b.n);
  for (let i = 0; i < b.n; i++) oncelik[i] = rngInt(r, 0x7fffffff);
  const ziyaret = new Uint8Array(b.n);
  const icinde = new Uint8Array(b.n);

  // 3a. Warnsdorff: her başlangıçtan; en uzun 10 (ve özel eşiklerindeki ön ekler).
  const uzunlar: number[][] = [];
  for (const bil of bils) {
    icinde.fill(0);
    for (const i of bil.hucreler) icinde[i] = 1;
    for (const s of bil.hucreler) uzunlar.push(warnsdorff(b, icinde, s, oncelik, ziyaret));
  }
  uzunlar.sort((a, z) => z.length - a.length);
  const esikler = b.d.ozelEsikleri.filter((e) => e > 0);
  for (const yol of uzunlar.slice(0, SINIR.warnsdorff)) {
    t.ekle(yol, false);
    for (const e of esikler) if (e < yol.length) t.ekle(yol.slice(0, e), false);
  }

  // 3b–3c. Hedef sarma ve 2×2 halkalar.
  for (const bil of bils) {
    icinde.fill(0);
    for (const i of bil.hucreler) icinde[i] = 1;
    sarmaSablonlari(b, bil, icinde, oncelik, t);
  }
  for (let c = 0; c < b.d.renkSayisi; c++) kareHalkalar(b, c, t);

  // 2. Bileşen DFS'leri (4–8 halkalar dahil).
  for (const bil of bils) dfsAdaylari(b, bil, r, t);

  // 3d. Roket nişan varyantları.
  nisanVaryantlari(b, t);

  let sonuc = t.adaylar;
  if (b.d.kurallar.yalnizHalka) sonuc = sonuc.filter((a) => a.halka);
  return sonuc;
}

/** Bir hedefin kalan payı (0 = tamam). */
function kalan(d: OyunDurumu, k: number): number {
  const h = d.hedefler[k];
  return h.tamam ? 0 : Math.max(0, h.gerekli - h.ilerleme);
}

/**
 * Ucuz puan bağlamı: hedeflerin hücre başına değerleri (ilerleme oranı
 * birimiyle) — hamle başına bir kez.
 */
export interface UcuzBaglam {
  b: TahtaBilgi;
  /** Patlayan kapsülün rengi başına ilerleme değeri ([6] = joker, yalnız 'hepsi'). */
  renkDeger: Float64Array;
  aydinlat: number;
  desen: number;
  kafes: number;
  kaya: number;
  is: number;
  devFisek: number;
  halka: number;
  zincirleme: { esik: number; deger: number }[];
  fener: number;
  /** Ortalama patlama değeri (özel taş etkisi kestirimi). */
  ortalama: number;
}

export function ucuzBaglam(b: TahtaBilgi): UcuzBaglam {
  const d = b.d;
  const G = Math.max(1, d.hedefler.length);
  const renkDeger = new Float64Array(7);
  const u: UcuzBaglam = { b, renkDeger, aydinlat: 0, desen: 0, kafes: 0, kaya: 0, is: 0, devFisek: 0, halka: 0, zincirleme: [], fener: 0, ortalama: 0 };
  d.hedefler.forEach((hd, k) => {
    if (kalan(d, k) <= 0) return;
    const birim = 1 / (G * Math.max(1, hd.gerekli));
    const h = hd.hedef;
    switch (h.tur) {
      case 'topla':
        if (h.renk === 'hepsi') for (let c = 0; c < 7; c++) renkDeger[c] += birim;
        else renkDeger[h.renk] += birim;
        break;
      case 'kafes':
        u.kafes += birim;
        break;
      case 'kaya':
        u.kaya += birim;
        break;
      case 'aydinlat':
        u.aydinlat += birim;
        break;
      case 'desen':
        u.desen += birim;
        break;
      case 'is':
        u.is += birim;
        break;
      case 'devFisek':
        u.devFisek += birim;
        break;
      case 'halka':
        u.halka += birim;
        break;
      case 'zincirleme':
        u.zincirleme.push({ esik: h.esik, deger: birim });
        break;
      case 'fener':
        u.fener += birim;
        break;
      case 'puan':
        break;
    }
  });
  // Ortalama patlama değeri: tahtadaki kapsüllerin değer ortalaması.
  let s = 0;
  let say = 0;
  for (let i = 0; i < b.n; i++) {
    if (b.isi[i] < 0) continue;
    s += patlamaDegeri(u, i);
    say++;
  }
  u.ortalama = say ? s / say : 0;
  return u;
}

/** i hücresindeki kapsül patlarsa hedef ilerlemesi (oran birimi). */
function patlamaDegeri(u: UcuzBaglam, i: number): number {
  const c = u.b.d.hucreler[i];
  const ic = c.icerik;
  if (ic?.tur !== 'kapsul') return 0;
  let v = u.renkDeger[ic.renk < 0 ? 6 : ic.renk];
  if (c.doseme > 0) v += u.aydinlat;
  if (c.desenRengi >= 0 && !c.desenBoyali && (c.desenRengi === ic.renk || ic.renk === -1)) v += u.desen;
  if (c.kafes) v += u.kafes;
  return v;
}

/** Bitişik patlama/vuruşun engeldeki değeri: [ilerleme, puan]. */
function engelDegeri(u: UcuzBaglam, m: number, vurus: number): [number, number] {
  const ic = u.b.d.hucreler[m].icerik;
  if (!ic) return [0, 0];
  switch (ic.tur) {
    case 'kaya': {
      const n = Math.min(vurus, ic.kat);
      return [u.kaya * (n >= ic.kat ? 1 : n / (ic.kat + 1)), 20 * n + (n >= ic.kat ? 50 : 0)];
    }
    case 'kova': {
      const n = Math.min(vurus, ic.kat);
      return [0, 20 * n + (n >= ic.kat ? 50 : 0)];
    }
    case 'is':
      return [u.is, 30];
    case 'devFisek': {
      const kalanDolum = Math.max(1, ic.kapasite - ic.dolum);
      return vurus >= kalanDolum ? [u.devFisek, 300] : [(u.devFisek * vurus) / (kalanDolum + 1), 0];
    }
    case 'islak':
      return [u.ortalama * 0.5, 0];
    default:
      return [0, 0];
  }
}

const OZEL_PUAN: Record<string, number> = { roket: 60, kasimpati: 120, yildiz: 200 };
/** Özel taş ateşlenince kestirilen patlama sayısı. */
const OZEL_ALAN: Record<string, number> = { roket: 6, kasimpati: 10, yildiz: 10 };

/**
 * Adım 5: ucuz puan. Önizlemenin ilk dalgası (yol düğümlerinin dik
 * komşularına ısı; halkada +2; kalkan ve yoldaki hücreler hariç), eşiğe
 * ulaşanların patlama değeri, hedef hücreleri (döşeme, desen, kafes, engel),
 * uzunluk (fitil puanı 5·n·(n+1)) ve özel taş (oluşum ve yoldaki taşların
 * etkisi). V formülünün (usta.ts) ucuz kestirimidir.
 */
export function ucuzPuanla(u: UcuzBaglam, adaylar: Aday[], W: typeof AG.ucuz = AG.ucuz): void {
  const b = u.b;
  const d = b.d;
  const ek = new Uint8Array(b.n);
  const vurus = new Uint8Array(b.n);
  const yolda = new Uint8Array(b.n);
  const dokunulan: number[] = [];
  const esik = d.esik;
  for (const a of adaylar) {
    const yol = a.yol;
    const n = yol.length;
    for (const i of yol) yolda[i] = 1;
    const carpan = a.halka ? 2 : 1;
    const sonIc = d.hucreler[yol[n - 1]].icerik;
    const donusum = !a.halka && sonIc?.tur === 'kapsul' && sonIc.ozel === 'yok' ? ozelTuruBul(d.ozelEsikleri, n) : 'yok';
    let ilerleme = 0;
    let puan = 5 * n * (n + 1);
    let ozel = 0;
    let R = 0;
    if (a.halka) {
      puan += 100;
      ilerleme += u.halka;
    }
    if (donusum !== 'yok') {
      puan += OZEL_PUAN[donusum];
      ozel += W.ozel;
    }
    dokunulan.length = 0;
    for (let k = 0; k < n; k++) {
      const i = yol[k];
      if (k === n - 1 && donusum !== 'yok') break;
      ilerleme += patlamaDegeri(u, i);
      const ic = d.hucreler[i].icerik;
      if (ic?.tur === 'kapsul' && ic.ozel !== 'yok') {
        const alan = OZEL_ALAN[ic.ozel];
        ilerleme += alan * u.ortalama;
        puan += 15 * alan;
        R += alan;
        ozel += W.ozelAtes * alan * 10;
      }
      for (let q = 0; q < b.dikSay[i]; q++) {
        const m = b.dik[4 * i + q];
        if (yolda[m]) continue;
        if (b.isi[m] >= 0) {
          if (b.kalkan[m]) continue;
          if (ek[m] === 0 && vurus[m] === 0) dokunulan.push(m);
          ek[m] += carpan;
        } else if (d.hucreler[m].icerik) {
          if (ek[m] === 0 && vurus[m] === 0) dokunulan.push(m);
          vurus[m]++;
        }
      }
    }
    let kizgin = 0;
    for (const m of dokunulan) {
      if (vurus[m]) {
        const [p, s] = engelDegeri(u, m, vurus[m]);
        ilerleme += p;
        puan += s;
      }
      if (ek[m]) {
        const yeni = b.isi[m] + ek[m];
        if (yeni >= esik) {
          R++;
          ilerleme += patlamaDegeri(u, m);
          puan += 20 + (d.hucreler[m].kafes ? 50 : 0);
        } else if (yeni === esik - 1) kizgin++;
      }
      ek[m] = 0;
      vurus[m] = 0;
    }
    for (const z of u.zincirleme) if (R >= z.esik) ilerleme += z.deger;
    for (const i of yol) yolda[i] = 0;
    a.ucuz = W.hedef * ilerleme + W.puan * puan + W.kizgin * kizgin + ozel + W.uzunluk * n;
  }
}

/** En iyi k aday (ucuz puana göre; eşitlikte üretim sırası). */
export function enIyiler(adaylar: Aday[], k: number): Aday[] {
  const sirali = adaylar.map((a, i) => [a, i] as const);
  sirali.sort((x, y) => y[0].ucuz - x[0].ucuz || x[1] - y[1]);
  return sirali.slice(0, k).map((x) => x[0]);
}
