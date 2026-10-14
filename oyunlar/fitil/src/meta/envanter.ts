/**
 * Güçlendirici stoğu ve kıvılcım tozu (GDD §9, §10.4). Saf; kayıtta
 * YERİNDE değişiklik yapan yardımcılar `_yerinde` ile biter ve yalnız meta
 * içinde, kopya üzerinde çağrılır. Dışa açık olanlar yeni kayıt döndürür.
 */
import { GUCLENDIRICI_STOK_SINIRI, GUCLENDIRICILER } from '../app/katalog';
import type { GuclendiriciId } from '../app/katalog';
import { acikEnYuksek, kayitKopyala } from './kayit';
import type { Kayit } from './kayit';
import { TOZ_STOK_DOLU, TOZ_TAVANI, VARSAYILAN_META_AYAR } from './sabitler';
import type { MetaAyar } from './sabitler';

/** Güçlendirici açık mı: açılış bölümüne ulaşıldı (açılış−1 kazanıldı). "7. bölüm" = 7. bölümde kullanılabilir. */
export function guclendiriciAcik(k: Kayit, id: GuclendiriciId, ayar: MetaAyar = VARSAYILAN_META_AYAR): boolean {
  const g = GUCLENDIRICILER.find((x) => x.id === id);
  return !!g && acikEnYuksek(k, ayar) >= g.acilis;
}

export function acikGuclendiriciler(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): GuclendiriciId[] {
  return GUCLENDIRICILER.filter((g) => guclendiriciAcik(k, g.id, ayar)).map((g) => g.id);
}

export function tozEkle_yerinde(k: Kayit, adet: number): void {
  k.toz = Math.min(TOZ_TAVANI, k.toz + Math.max(0, Math.floor(adet)));
}

export interface GuclendiriciVerildi {
  guc: GuclendiriciId;
  /** Stoğa giren adet. */
  adet: number;
  /** Stok dolu ya da güçlendirici henüz açık değilse adet başına 2 toz. */
  toz: number;
}

/**
 * Güçlendirici verir; stok sınırı 3 (§9). Sığmayan ya da henüz açılmamış
 * güçlendirici kaybolmaz: adet başına 2 kıvılcım tozuna döner (sandıktaki
 * "stoklar doluysa 2 toz" kuralının genellemesi).
 */
export function guclendiriciVer_yerinde(k: Kayit, id: GuclendiriciId, adet: number, ayar: MetaAyar = VARSAYILAN_META_AYAR): GuclendiriciVerildi {
  let giren = 0;
  if (guclendiriciAcik(k, id, ayar)) {
    giren = Math.max(0, Math.min(adet, GUCLENDIRICI_STOK_SINIRI - k.guclendiriciler[id]));
    k.guclendiriciler[id] += giren;
  }
  const toz = (adet - giren) * TOZ_STOK_DOLU;
  if (toz > 0) tozEkle_yerinde(k, toz);
  return { guc: id, adet: giren, toz };
}

/** Bölümde güçlendirici kullanımı: stok 1 düşer. Stok yoksa null. */
export function guclendiriciKullan(k: Kayit, id: GuclendiriciId, ayar: MetaAyar = VARSAYILAN_META_AYAR): Kayit | null {
  if (!guclendiriciAcik(k, id, ayar) || k.guclendiriciler[id] <= 0) return null;
  const y = kayitKopyala(k);
  y.guclendiriciler[id]--;
  return y;
}
