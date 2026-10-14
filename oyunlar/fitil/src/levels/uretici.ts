/**
 * Bölüm üreticisi: Günün Şenliği (GDD §10.5) ve Sonsuz Şenlik (§10.7).
 *
 * Saf ve belirlenimli (Date/Math.random yok; yalnız çekirdeğin mulberry32'si):
 * aynı tarih (ya da n) her cihazda aynı bölümü verir. Tarayıcıda ana iş
 * parçacığını kilitlememek için üretim bir üretici fonksiyondur
 * (`gunlukUret`, `sonsuzUret`): her bot eyleminden sonra `yield` eder;
 * `zamanDilimli` kare bütçesiyle sürer, Web Worker içinde `gunlukBolum`
 * doğrudan çağrılabilir.
 *
 * §10.5 hattı:
 *  - Aday tohumları: en fazla 50 aday; k. adayın tohumu
 *    `mulberry32(tohum ^ (k+1)·0x9E3779B9)`. P4a sapması: §10.5'in düz
 *    "tohum, tohum+1, …" dizisinde ardışık günlerin aday kümeleri çakışıyor,
 *    D günü elenen ilk aday D+1 gününün seçilen bölümü olabiliyordu.
 *  - Parametreler: w 7, h 8–9, renk 5, eşik 4, hamle 20–25; 1–2 hedef
 *    (topla, kafes, aydınlat, kaya); yalnız 1–15. bölümlerde tanıtılmış
 *    öğeler (kafes, ıslak, tek katlı döşeme, kaya 1–3 kat). Fener (11)
 *    hedef havuzunda olmadığından kullanılmaz; Körük (17), kova (18),
 *    2 katlı döşeme (24) kullanılmaz.
 *  - Süzme: aday başına hafif Usta botuyla 12 koşu (64 aday, 16 tam
 *    çözümleme); kazanma oranı %55–85 bandına giren ilk aday seçilir.
 *    Hiçbiri girmezse banda en yakın aday (eşitlikte ilk) seçilir (P4a eki).
 *  - Yıldız eşikleri bu 12 koşunun kazançlarından (p50, p85, aşağı 100'e).
 *
 * §10.7 (P4a yorumu): bölüm n için tohum ve id 1 000 000 + n. Zorluk n ile
 * yavaşça artar: hamle her 10 bölümde −1 (en az 16), 10'dan sonra 2 katlı
 * döşeme, kaya katları artar, 20'den sonra 6 renk; süzme bandı her 10
 * bölümde 1 puan aşağı kayar (alt sınır %45).
 */
import { mulberry32Bir, rngInt } from '../core/index';
import type { BolumVerisi, Hedef } from '../core/index';
import { oyunAdimlari, type OyunSonucu } from '../bot/simulasyon';
import type { BotSecenek } from '../bot/ortak';
import { bolumDogrula } from './dogrulayici';

export interface UreticiSecenek {
  /** En fazla aday bölüm (§10.5: 50). */
  adaySayisi?: number;
  /** Aday başına bot koşusu (§10.5: 12). */
  kosu?: number;
  /** Hafif Usta: üretilen aday ve tam çözülen aday sayısı (§10.5: 64 / 16). */
  bot?: BotSecenek;
}

export interface UretimIlerleme {
  /** Denenen aday (0 tabanlı) ve o adaydaki koşu. */
  aday: number;
  kosu: number;
  /** Oynanan toplam bot eylemi. */
  eylem: number;
}

const VARSAYILAN = { adaySayisi: 50, kosu: 12, bot: { adaySiniri: 64, tamCozum: 16 } satisfies BotSecenek };

/** Yerel tarihten tohum: yyyymmdd (örn. 20261014). */
export function tarihTohumu(yil: number, ay: number, gun: number): number {
  return yil * 10000 + ay * 100 + gun;
}

export interface Zorluk {
  hamleAlt: number;
  hamleUst: number;
  renk: number;
  dosemeKat2: boolean;
  /** Kaya katı dağılımı: [1, 2, 3] ağırlıkları. */
  kayaKat: [number, number, number];
  bant: [number, number];
}

export const GUNLUK_ZORLUK: Zorluk = { hamleAlt: 20, hamleUst: 25, renk: 5, dosemeKat2: false, kayaKat: [6, 3, 1], bant: [55, 85] };

/** §10.7 zorluk eğrisi (P4a yorumu, dosya başı). */
export function sonsuzZorluk(n: number): Zorluk {
  const k = Math.floor(n / 10);
  return {
    hamleAlt: Math.max(16, 20 - k),
    hamleUst: Math.max(18, 25 - k),
    renk: n >= 20 ? 6 : 5,
    dosemeKat2: n >= 10,
    kayaKat: [Math.max(1, 6 - k), 3 + k, 1 + k],
    bant: [Math.max(45, 55 - k), Math.max(70, 85 - k)],
  };
}

type R = { rng: number };

function karistir<T>(r: R, a: T[]): T[] {
  for (let k = a.length - 1; k > 0; k--) {
    const j = rngInt(r, k + 1);
    const g = a[k];
    a[k] = a[j];
    a[j] = g;
  }
  return a;
}

function agirlikli(r: R, a: readonly number[]): number {
  let t = 0;
  for (const x of a) t += x;
  let k = rngInt(r, t);
  for (let i = 0; i < a.length; i++) {
    k -= a[i];
    if (k < 0) return i;
  }
  return a.length - 1;
}

/** Tek bir aday bölüm (bot süzmesinden önce). */
export function adayBolum(tohum: number, id: number, tur: 'gunluk' | 'sonsuz', z: Zorluk): BolumVerisi {
  const r: R = { rng: mulberry32Bir(tohum >>> 0) };
  const w = 7;
  const h = 8 + rngInt(r, 2);
  const hamle = z.hamleAlt + rngInt(r, z.hamleUst - z.hamleAlt + 1);
  const g: string[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  const bos = (x: number, y: number): boolean => g[y][x] === '.';
  const turler = karistir(r, ['topla', 'kafes', 'aydinlat', 'kaya'] as const as unknown as string[]);
  const hedefSayisi = 1 + rngInt(r, 2);
  const hedefler: Hedef[] = [];
  const onIsi: [number, number, number][] = [];
  const dosemeler: [number, number, 1 | 2][] = [];

  for (const t of turler.slice(0, hedefSayisi)) {
    if (t === 'topla') {
      if (rngInt(r, 4) === 0) hedefler.push({ tur: 'topla', renk: 'hepsi', adet: 55 + 5 * rngInt(r, 7) });
      else hedefler.push({ tur: 'topla', renk: rngInt(r, z.renk) as 0, adet: 22 + 2 * rngInt(r, 8) });
    } else if (t === 'kafes') {
      const n = 3 + rngInt(r, 4);
      for (let k = 0, deneme = 0; k < n && deneme < 200; deneme++) {
        const x = rngInt(r, w);
        const y = 1 + rngInt(r, h - 2);
        // Kafesler birbirine dik komşu olmasın (her biri sarılabilsin).
        if (!bos(x, y) || [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === 'C')) continue;
        g[y][x] = 'C';
        if (rngInt(r, 2) === 0) onIsi.push([x, y, 1]);
        k++;
      }
      hedefler.push({ tur: 'kafes' });
    } else if (t === 'aydinlat') {
      const desen = rngInt(r, 4);
      const kat = (): 1 | 2 => (z.dosemeKat2 && rngInt(r, 3) === 0 ? 2 : 1);
      const ekle = (x: number, y: number): void => {
        if (x >= 0 && y >= 0 && x < w && y < h && !dosemeler.some(([a, b]) => a === x && b === y)) dosemeler.push([x, y, kat()]);
      };
      if (desen === 0) {
        // Alt satırlar.
        const n = 2 + rngInt(r, 2);
        for (let y = h - n; y < h; y++) for (let x = 0; x < w; x++) ekle(x, y);
      } else if (desen === 1) {
        // Artı.
        const cx = 2 + rngInt(r, 3);
        const cy = 2 + rngInt(r, h - 4);
        for (let x = 0; x < w; x++) ekle(x, cy);
        for (let y = 0; y < h; y++) ekle(cx, y);
        ekle(cx - 1, cy - 1);
        ekle(cx + 1, cy + 1);
        ekle(cx - 1, cy + 1);
        ekle(cx + 1, cy - 1);
      } else if (desen === 2) {
        // Dikey şerit (2 geniş) ve kavşak.
        const x0 = 1 + rngInt(r, w - 3);
        for (let y = 0; y < h; y++) {
          ekle(x0, y);
          ekle(x0 + 1, y);
        }
        const cy = 2 + rngInt(r, h - 3);
        for (let x = 0; x < w; x++) ekle(x, cy);
      } else {
        // Dağınık adalar.
        const n = 18 + rngInt(r, 9);
        for (let deneme = 0; dosemeler.length < n && deneme < 400; deneme++) ekle(rngInt(r, w), 2 + rngInt(r, h - 2));
      }
      hedefler.push({ tur: 'aydinlat' });
    } else {
      const n = 6 + rngInt(r, 7);
      for (let k = 0, deneme = 0; k < n && deneme < 300; deneme++) {
        const x = rngInt(r, w);
        const y = 2 + rngInt(r, h - 3);
        if (!bos(x, y)) continue;
        g[y][x] = `K${1 + agirlikli(r, z.kayaKat)}`;
        k++;
      }
      hedefler.push({ tur: 'kaya' });
    }
  }
  // Islak barut süsü (7. bölümden): bazen küçük bir öbek.
  if (rngInt(r, 10) < 3) {
    const cx = 1 + rngInt(r, w - 2);
    const cy = 2 + rngInt(r, h - 4);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (bos(x, y) && rngInt(r, 3) > 0) g[y][x] = 'W';
  }
  // Döşeme yalnız kapsül hücrelerinde (§16.5).
  const dos = dosemeler.filter(([x, y]) => ['.', 'C', 'W'].includes(g[y][x]));
  const sonOnIsi = onIsi.filter(([x, y]) => g[y][x] === 'C');
  const v: BolumVerisi = {
    id,
    ad: tur === 'gunluk' ? 'Günün Şenliği' : `Sonsuz Şenlik ${id - 1_000_000}`,
    mahalle: rngInt(r, 8),
    tur,
    w,
    h,
    renkSayisi: z.renk,
    esik: 4,
    hamle,
    tohum: mulberry32Bir((tohum ^ 0x51ed270b) >>> 0),
    yardim: 0,
    ozelEsikleri: [6, 9, 12],
    hedefler,
    duzen: g.map((s) => s.join(' ')),
    botBandi: [z.bant[0], z.bant[1]],
    yildizEsikleri: [0, 0],
  };
  if (sonOnIsi.length) v.onIsi = sonOnIsi;
  if (dos.length) v.zemin = { dosemeler: dos };
  // Aydınlat hedefi döşemesiz kaldıysa (hepsi engel üstündeydi) hedefi düşür.
  if (!dos.length) v.hedefler = v.hedefler.filter((x) => x.tur !== 'aydinlat');
  if (v.hedefler.length === 0) v.hedefler = [{ tur: 'topla', renk: 'hepsi', adet: 60 }];
  return v;
}

function yuzdelik(a: number[], p: number): number {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}

/** Ortak süzme hattı: ilk bant içi aday, yoksa banda en yakın. */
function* suz(tohum0: number, id: number, tur: 'gunluk' | 'sonsuz', z: Zorluk, s: UreticiSecenek): Generator<UretimIlerleme, BolumVerisi, void> {
  const adaySayisi = s.adaySayisi ?? VARSAYILAN.adaySayisi;
  const kosu = s.kosu ?? VARSAYILAN.kosu;
  const bot = s.bot ?? VARSAYILAN.bot;
  const [bAlt, bUst] = z.bant;
  const merkez = (bAlt + bUst) / 2;
  let en: BolumVerisi | null = null;
  let enFark = Infinity;
  let eylem = 0;
  for (let k = 0; k < adaySayisi; k++) {
    const v = adayBolum(mulberry32Bir((tohum0 ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0), id, tur, z);
    if (bolumDogrula(v).length) continue;
    const kazananlar: OyunSonucu[] = [];
    for (let t = 0; t < kosu; t++) {
      const g = oyunAdimlari(v, t, 'usta', { bot });
      let r = g.next();
      while (!r.done) {
        eylem++;
        yield { aday: k, kosu: t, eylem };
        r = g.next();
      }
      if (r.value.kazandi) kazananlar.push(r.value);
    }
    const oran = (100 * kazananlar.length) / kosu;
    const puan = kazananlar.map((x) => x.puan);
    v.yildizEsikleri = [Math.floor(yuzdelik(puan, 50) / 100) * 100, Math.floor(yuzdelik(puan, 85) / 100) * 100];
    if (oran >= bAlt && oran <= bUst) return v;
    const fark = Math.abs(oran - merkez);
    if (fark < enFark) {
      enFark = fark;
      en = v;
    }
  }
  if (!en) throw new Error(`üretici: geçerli aday yok (tohum ${tohum0})`);
  return en;
}

/** Günün Şenliği üreticisi (§10.5); tarih yyyymmdd. */
export function gunlukUret(tarih: number, s: UreticiSecenek = {}): Generator<UretimIlerleme, BolumVerisi, void> {
  return suz(tarih, tarih, 'gunluk', GUNLUK_ZORLUK, s);
}

/** Sonsuz Şenlik n. bölüm üreticisi (§10.7), n ≥ 1. */
export function sonsuzUret(n: number, s: UreticiSecenek = {}): Generator<UretimIlerleme, BolumVerisi, void> {
  return suz(1_000_000 + n, 1_000_000 + n, 'sonsuz', sonsuzZorluk(n), s);
}

/** Üreticiyi sonuna kadar sür (Web Worker ya da Node). */
export function sonunaKadar<T>(g: Generator<unknown, T, void>): T {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

export function gunlukBolum(tarih: number, s: UreticiSecenek = {}): BolumVerisi {
  return sonunaKadar(gunlukUret(tarih, s));
}

export function sonsuzBolum(n: number, s: UreticiSecenek = {}): BolumVerisi {
  return sonunaKadar(sonsuzUret(n, s));
}

/**
 * Ana iş parçacığında zaman dilimli çalıştırma: her dilimde en fazla
 * `butceMs` çalışır, sonra `bekle()` (örn. requestAnimationFrame sözü) ile
 * sırayı bırakır. Saat ve bekleme dışarıdan verilir (modül saf kalsın).
 */
export async function zamanDilimli<T, Y>(
  g: Generator<Y, T, void>,
  o: { simdi: () => number; bekle: () => Promise<void>; butceMs?: number; ilerleme?: (y: Y) => void },
): Promise<T> {
  const butce = o.butceMs ?? 8;
  for (;;) {
    const bas = o.simdi();
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
      o.ilerleme?.(r.value);
      if (o.simdi() - bas >= butce) break;
    }
    await o.bekle();
  }
}
