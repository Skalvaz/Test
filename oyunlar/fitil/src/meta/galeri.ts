/**
 * Gece Tablosu kayıtları (GDD §10.3, §13.6).
 *
 * Saklanan şey görüntü değil, patlama kayıtlarıdır: bölümün en büyük 3
 * reaksiyonu ve final gösterisi, toplam en fazla 250 kayıt. Her kayıt 32 bit:
 *
 *   bit  0– 3  x        (0..15)
 *   bit  4– 7  y        (0..15)
 *   bit  8–10  renk     (0..5; 7 = yıldız topu)
 *   bit 11–14  nesil    (0..15, taşan 15'e kırpılır)
 *   bit 15–17  özel     (0 yok, 1 roket, 2 kasımpatı, 3 yıldız)
 *   bit 18–31  t/10     (tik/10, 14 bit; en fazla 16383 → 163,8 sn)
 *
 * Bu yerleşim `src/render/tablo.ts` (`kayitPaketle`/`kayitCoz`) ile birebir
 * aynıdır; çizici `tabloCoz(kod)` çıktısını doğrudan kullanabilir. Kayıtlar
 * 4 bayt küçük uçlu (little-endian) dizilip base64'lenir: 250 kayıt ≈ 1,3 KB.
 *
 * Zaman çizelgesi: reaksiyonlar oyundaki sırayla, aralarında `TABLO_BOSLUK`
 * tik bırakılarak art arda dizilir; final gösterisi en sona gelir.
 */
import { fnv1a } from '../core/rng';
import type { OzelTur } from '../core/types';
import { base64Coz, base64Kodla } from './kodlama';
import type { Nadirlik } from './kayit';
import { NADIRLIK_ADLARI, TABLO_BOSLUK, TABLO_KAYIT_SINIRI, TABLO_REAKSIYON_PAYI } from './sabitler';

export interface TabloKaydi {
  x: number;
  y: number;
  /** 0..5; 7 = yıldız topu. */
  renk: number;
  nesil: number;
  /** 0 yok, 1 roket, 2 kasımpatı, 3 yıldız. */
  ozel: number;
  /** tik/10. */
  t: number;
}

export const OZEL_KODU: Record<OzelTur, number> = { yok: 0, roket: 1, kasimpati: 2, yildiz: 3 };
export const T_EN_FAZLA = 16383;

export function tabloKaydiPaketle(k: TabloKaydi): number {
  const renk = k.renk < 0 || k.renk > 5 ? 7 : k.renk;
  const nesil = Math.min(15, Math.max(0, k.nesil | 0));
  const t = Math.min(T_EN_FAZLA, Math.max(0, Math.floor(k.t)));
  return ((k.x & 15) | ((k.y & 15) << 4) | (renk << 8) | (nesil << 11) | ((k.ozel & 7) << 15) | (t << 18)) >>> 0;
}

export function tabloKaydiCoz(n: number): TabloKaydi {
  return { x: n & 15, y: (n >>> 4) & 15, renk: (n >>> 8) & 7, nesil: (n >>> 11) & 15, ozel: (n >>> 15) & 7, t: (n >>> 18) & T_EN_FAZLA };
}

/** Patlama olayından kayıt; `tTik` tik cinsinden zaman (kayda /10 yazılır). */
export function patlamaKaydi(o: { hucre: { x: number; y: number }; renk: number; nesil: number; ozel: OzelTur }, tTik: number): number {
  return tabloKaydiPaketle({ x: o.hucre.x, y: o.hucre.y, renk: o.renk, nesil: o.nesil, ozel: OZEL_KODU[o.ozel] ?? 0, t: tTik / 10 });
}

/** Kayıtların zamanını `ofsetTik` kadar kaydırır (taşan 16383'te kalır). */
export function kayitKaydir(n: number, ofsetTik: number): number {
  const k = tabloKaydiCoz(n);
  k.t = k.t + Math.floor(ofsetTik / 10);
  return tabloKaydiPaketle(k);
}

export function tabloKodla(kayitlar: readonly number[]): string {
  const b = new Uint8Array(kayitlar.length * 4);
  kayitlar.forEach((n, i) => {
    b[i * 4] = n & 255;
    b[i * 4 + 1] = (n >>> 8) & 255;
    b[i * 4 + 2] = (n >>> 16) & 255;
    b[i * 4 + 3] = (n >>> 24) & 255;
  });
  return base64Kodla(b);
}

/** Tablo kodu → paketli kayıtlar; bozuksa null. */
export function tabloCoz(kod: string): number[] | null {
  const b = base64Coz(kod);
  if (!b || b.length % 4 !== 0 || b.length / 4 > TABLO_KAYIT_SINIRI) return null;
  const out: number[] = [];
  for (let i = 0; i < b.length; i += 4) out.push((b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0);
  return out;
}

export function tabloKayitlari(kod: string): TabloKaydi[] | null {
  return tabloCoz(kod)?.map(tabloKaydiCoz) ?? null;
}

/** Bir reaksiyonun kayıtları (olay özetinde biriktirilir). */
export interface TabloSegmenti {
  /** Reaksiyon boyutu R. */
  boyut: number;
  /** Oyundaki hamle sırası (0 tabanlı). */
  sira: number;
  /** Paketli kayıtlar, zaman segmentin başına göre. */
  kayitlar: number[];
  /** Segmentin süresi (tik). */
  sure: number;
}

export interface TabloHammaddesi {
  /** En büyük 3 reaksiyon (boyuta göre azalan). */
  reaksiyonlar: TabloSegmenti[];
  /** Final gösterisi kayıtları (zaman finalin başına göre). */
  final: number[];
  finalSure: number;
}

/** Diziden `n` öğeyi eşit aralıklarla seçer (belirlenimli). */
export function seyrelt<T>(a: readonly T[], n: number): T[] {
  if (a.length <= n) return [...a];
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(a[Math.floor((i * a.length) / n)]);
  return out;
}

/**
 * Tablo kayıtlarını seçer ve zaman çizelgesine dizer (≤ 250). Reaksiyonlar
 * oyundaki sırayla gelir; final en sonda. Sığmazsa reaksiyonlara en az 150
 * kayıt ayrılır, kalanı finalin; her grup eşit aralıklarla seyreltilir.
 */
export function tabloSec(h: TabloHammaddesi): number[] {
  const sirali = [...h.reaksiyonlar].sort((a, b) => a.sira - b.sira);
  const reak: number[] = [];
  let ofset = 0;
  for (const s of sirali) {
    for (const n of s.kayitlar) reak.push(kayitKaydir(n, ofset));
    ofset += s.sure + TABLO_BOSLUK;
  }
  const final = h.final.map((n) => kayitKaydir(n, ofset));
  if (reak.length + final.length <= TABLO_KAYIT_SINIRI) return [...reak, ...final];
  const reakPay = Math.min(reak.length, Math.max(TABLO_REAKSIYON_PAYI, TABLO_KAYIT_SINIRI - final.length));
  return [...seyrelt(reak, reakPay), ...seyrelt(final, TABLO_KAYIT_SINIRI - reakPay)];
}

/**
 * Nadirlik (§10.3) — yalnız kazanılan bölümde tablo oluşur:
 * Şaheser: Büyük Final kombinasyonu ya da tek hamlede R ≥ 40;
 * Parlak: 3★ ya da tek hamlede R ≥ 25 ya da 2+ halka; değilse Sade.
 */
export function nadirlikHesapla(g: { yildiz: number; enBuyukReaksiyon: number; halka: number; buyukFinal: boolean }): Nadirlik {
  if (g.buyukFinal || g.enBuyukReaksiyon >= 40) return 2;
  if (g.yildiz >= 3 || g.enBuyukReaksiyon >= 25 || g.halka >= 2) return 1;
  return 0;
}

export function nadirlikAdi(n: Nadirlik): string {
  return NADIRLIK_ADLARI[n];
}

/** Çizici tohumu: mulberry32(bolumId ^ gunlukKarmasi) (§13.6). Günlük değilse karma 0. */
export function tabloTohumu(bolumId: number, gunlukTarih?: number): number {
  return (bolumId ^ (gunlukTarih ? fnv1a(String(gunlukTarih)) : 0)) >>> 0;
}

export interface Tablo {
  kod: string;
  nadirlik: Nadirlik;
  kayitSayisi: number;
}

/** Hammaddeden tablo (kayıt yoksa null). */
export function tabloUret(h: TabloHammaddesi, nadirlik: Nadirlik): Tablo | null {
  const kayitlar = tabloSec(h);
  if (kayitlar.length === 0) return null;
  return { kod: tabloKodla(kayitlar), nadirlik, kayitSayisi: kayitlar.length };
}
