/**
 * Sandık (GDD §10.4).
 *
 *  - Normal sandık: %35 güçlendirici, %50 desen parçası, %15 fitil parçası.
 *    Güçlendirici: açık olanlardan stoğu en düşük olan (eşitlikte katalog
 *    sırası); hepsi doluysa (ya da hiçbiri açık değilse) 2 toz.
 *  - Parlak sandık: iki ayrı çekiliş (3★ ya da 3/3 günlük görev).
 *  - Parça: %80 sahip olunmayanlardan, %20 hepsinden tekdüze. Tekrar = 3 toz.
 *  - Kötü şans koruması: üst üste 3 sandıkta parça çıkmazsa sonraki sandığın
 *    ilk çekilişi parça olur (sahip olunmayanlardan; o kategoride kalmadıysa
 *    öbür kategoriden).
 *  - 5. bölümün ilk sandığı garanti Kasımpatı parçası.
 *  - RNG: mulberry32(kayitTohumu ^ sandikSayaci) — çekirdeğin rngInt'i.
 *    Sayaç kayıtta; yeniden yüklemek sonucu değiştirmez.
 *
 * Tasarım kararı: tekrar eden parça (toza dönen) de "parça çıktı" sayılır
 * (literal okuma); kötü şans garantisi ise sahip olunmayan parça seçer.
 */
import { DESEN_PARCA, DESENLER, FITILLER, GUCLENDIRICI_STOK_SINIRI, GUCLENDIRICILER } from '../app/katalog';
import type { DesenId, FitilId, GuclendiriciId } from '../app/katalog';
import { rngInt } from '../core/rng';
import { acikGuclendiriciler, guclendiriciVer_yerinde, tozEkle_yerinde } from './envanter';
import { bolumKazanildi, desenTamam, fitilTamam, kayitKopyala, parcaCoz, parcaId } from './kayit';
import type { Kayit, ParcaId, SandikNedeni } from './kayit';
import { KASIMPATI_GARANTI_BOLUMU, KOTU_SANS_SINIRI, SAHIP_OLUNMAYAN_ORANI, SANDIK_ACILIS_BOLUMU, SANDIK_ORAN, TOZ_STOK_DOLU, TOZ_TEKRAR, VARSAYILAN_META_AYAR } from './sabitler';
import type { MetaAyar } from './sabitler';

export type SandikTuru = 'normal' | 'parlak';

export type SandikCekilisi =
  | { tur: 'guclendirici'; guc: GuclendiriciId; adet: number }
  | { tur: 'toz'; adet: number; neden: 'stokDolu' }
  | {
      tur: 'parca';
      parca: ParcaId;
      kategori: 'desen' | 'fitil';
      /** Desen ya da fitil kimliği. */
      hedef: DesenId | FitilId;
      /** Parça indeksi 0..2. */
      indeks: number;
      /** Yeni parça mı; değilse `toz` kadar kıvılcım tozuna döndü. */
      yeni: boolean;
      toz: number;
      /** Bu parçayla desen/fitil tamamlandı mı. */
      tamamlandi: boolean;
      garanti?: 'kotuSans' | 'kasimpati';
    };

export interface SandikIstegi {
  tur: SandikTuru;
  neden: SandikNedeni;
  /** Sandığı veren bölüm (Kasımpatı garantisi için). */
  bolumId?: number;
}

export interface SandikSonucu {
  tur: SandikTuru;
  neden: SandikNedeni;
  /** Bu sandığın RNG'sinde kullanılan sayaç değeri. */
  sayac: number;
  cekilisler: SandikCekilisi[];
}

/** Bütün desen parçaları (72) ve sandıktan çıkan fitil parçaları (21). */
export const DESEN_PARCALARI: readonly ParcaId[] = DESENLER.flatMap((d) => Array.from({ length: DESEN_PARCA }, (_, i) => parcaId('desen', d.id, i)));
export const FITIL_PARCALARI: readonly ParcaId[] = FITILLER.filter((f) => f.sandiktan).flatMap((f) => Array.from({ length: 3 }, (_, i) => parcaId('fitil', f.id, i)));

/** Sandık sistemi açık mı (5. bölüm kazanıldı). */
export function sandikAcik(k: Kayit): boolean {
  return bolumKazanildi(k, SANDIK_ACILIS_BOLUMU);
}

/**
 * Bir sandık açar (kopya üzerinde). Sonuç tamamen `kayitTohumu` ve
 * `sandik.sayac` ile belirlenir.
 */
export function sandikAc(k: Kayit, istek: SandikIstegi, ayar: MetaAyar = VARSAYILAN_META_AYAR): { kayit: Kayit; sonuc: SandikSonucu } {
  const y = kayitKopyala(k);
  const sonuc = sandikAc_yerinde(y, istek, ayar);
  return { kayit: y, sonuc };
}

export function sandikAc_yerinde(k: Kayit, istek: SandikIstegi, ayar: MetaAyar = VARSAYILAN_META_AYAR): SandikSonucu {
  const sayac = k.sandik.sayac;
  const r = { rng: (k.kayitTohumu ^ sayac) >>> 0 };
  k.sandik.sayac = (sayac + 1) >>> 0;
  k.istatistik.sandik++;
  const cekilisler: SandikCekilisi[] = [];
  const adet = istek.tur === 'parlak' ? 2 : 1;
  for (let i = 0; i < adet; i++) {
    let c: SandikCekilisi | null = null;
    if (i === 0 && istek.bolumId === KASIMPATI_GARANTI_BOLUMU && !k.sandik.kasimpatiVerildi) {
      k.sandik.kasimpatiVerildi = true;
      c = kasimpatiGarantisi(k);
    }
    if (!c) c = cekilis(k, r, i === 0 && k.sandik.parcasizSeri >= KOTU_SANS_SINIRI, ayar);
    cekilisler.push(c);
  }
  const parcaCikti = cekilisler.some((c) => c.tur === 'parca');
  k.sandik.parcasizSeri = parcaCikti ? 0 : Math.min(KOTU_SANS_SINIRI, k.sandik.parcasizSeri + 1);
  return { tur: istek.tur, neden: istek.neden, sayac, cekilisler };
}

function kasimpatiGarantisi(k: Kayit): SandikCekilisi | null {
  const sahip = new Set(k.koleksiyon.parcalar);
  for (let i = DESEN_PARCA - 1; i >= 0; i--) {
    // Önce eksik olan (başlangıçta 3. parça eksiktir).
    const p = parcaId('desen', 'kasimpati', i);
    if (!sahip.has(p)) return parcaVer(k, p, 'kasimpati');
  }
  return null;
}

function cekilis(k: Kayit, r: { rng: number }, zorunluParca: boolean, ayar: MetaAyar): SandikCekilisi {
  if (zorunluParca) {
    // Desen:fitil oranı 50:15 korunur.
    const desenMi = rngInt(r, SANDIK_ORAN.desen + SANDIK_ORAN.fitil) < SANDIK_ORAN.desen;
    let havuz = desenMi ? DESEN_PARCALARI : FITIL_PARCALARI;
    const sahip = new Set(k.koleksiyon.parcalar);
    let eksik = havuz.filter((p) => !sahip.has(p));
    if (eksik.length === 0) {
      havuz = desenMi ? FITIL_PARCALARI : DESEN_PARCALARI;
      eksik = havuz.filter((p) => !sahip.has(p));
    }
    const secim = eksik.length > 0 ? eksik[rngInt(r, eksik.length)] : havuz[rngInt(r, havuz.length)];
    return parcaVer(k, secim, 'kotuSans');
  }
  const zar = rngInt(r, 100);
  if (zar < SANDIK_ORAN.guclendirici) return guclendiriciCekilisi(k, ayar);
  const havuz = zar < SANDIK_ORAN.guclendirici + SANDIK_ORAN.desen ? DESEN_PARCALARI : FITIL_PARCALARI;
  const sahip = new Set(k.koleksiyon.parcalar);
  const eksik = havuz.filter((p) => !sahip.has(p));
  const eksiktenMi = eksik.length > 0 && rngInt(r, 100) < SAHIP_OLUNMAYAN_ORANI;
  const secim = eksiktenMi ? eksik[rngInt(r, eksik.length)] : havuz[rngInt(r, havuz.length)];
  return parcaVer(k, secim);
}

function guclendiriciCekilisi(k: Kayit, ayar: MetaAyar): SandikCekilisi {
  const acik = acikGuclendiriciler(k, ayar);
  let en: GuclendiriciId | null = null;
  for (const g of GUCLENDIRICILER) {
    if (!acik.includes(g.id)) continue;
    const stok = k.guclendiriciler[g.id];
    if (stok >= GUCLENDIRICI_STOK_SINIRI) continue;
    if (en === null || stok < k.guclendiriciler[en]) en = g.id;
  }
  if (en === null) {
    tozEkle_yerinde(k, TOZ_STOK_DOLU);
    return { tur: 'toz', adet: TOZ_STOK_DOLU, neden: 'stokDolu' };
  }
  const v = guclendiriciVer_yerinde(k, en, 1, ayar);
  return { tur: 'guclendirici', guc: en, adet: v.adet };
}

/** Parçayı verir (yeni ise koleksiyona, tekrarsa 3 toz). */
export function parcaVer(k: Kayit, p: ParcaId, garanti?: 'kotuSans' | 'kasimpati'): SandikCekilisi {
  const c = parcaCoz(p)!;
  const yeni = !k.koleksiyon.parcalar.includes(p);
  let toz = 0;
  if (yeni) {
    k.koleksiyon.parcalar.push(p);
    k.istatistik.parca++;
  } else {
    toz = TOZ_TEKRAR;
    tozEkle_yerinde(k, toz);
  }
  const tamamlandi = yeni && (c.kategori === 'desen' ? desenTamam(k, c.id as DesenId) : fitilTamam(k, c.id as FitilId));
  const sonuc: SandikCekilisi = { tur: 'parca', parca: p, kategori: c.kategori, hedef: c.id as DesenId | FitilId, indeks: c.i, yeni, toz, tamamlandi };
  if (garanti) sonuc.garanti = garanti;
  return sonuc;
}

/** Sahip olunmayan parça sayıları (Defter ve test için). */
export function eksikParcalar(k: Kayit): { desen: ParcaId[]; fitil: ParcaId[] } {
  const sahip = new Set(k.koleksiyon.parcalar);
  return { desen: DESEN_PARCALARI.filter((p) => !sahip.has(p)), fitil: FITIL_PARCALARI.filter((p) => !sahip.has(p)) };
}
