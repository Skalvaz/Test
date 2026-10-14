/** Puanlama (§7.1–§7.2) ve yıldız hesabı (§7.4). */
import { PUAN, REAKSIYON_KADEMELERI } from './sabitler';
import type { OyunDurumu, PatlamaNedeni, ReaksiyonKademesi } from './types';

/**
 * Bir kapsül patlamasının taban puanı (§7.1):
 *  - fitil düğümü, k. sırada: 10·k
 *  - ısı patlaması, nesil g ≥ 1: 20·g
 *  - vuruşla patlayan (özel, iz, dev fişek, final, kibrit; çift dokunulan taş): 15
 */
export function patlamaPuani(neden: PatlamaNedeni, nesil: number, k: number): number {
  if (neden === 'fitil') return PUAN.fitilDugum * k;
  if (neden === 'isi') return PUAN.isiPatlamasi * nesil;
  return PUAN.vurus;
}

/** Reaksiyon bonusu (§7.2): yalnız en yüksek kademe verilir. R < 8 → null. */
export function reaksiyonKademesi(R: number): { kademe: ReaksiyonKademesi; bonus: number } | null {
  for (const k of REAKSIYON_KADEMELERI) if (R >= k.esik) return { kademe: k.kademe, bonus: k.bonus };
  return null;
}

/**
 * Yıldız sayısı (§7.4): hedefler tamamsa 1★; puan ≥ p50 → 2★; puan ≥ p85 → 3★.
 * Güçlendirici kullanıldıysa en fazla 2★, Kıvılcım Usta'nın Eli kullanıldıysa
 * en fazla 1★. Kazanılmamış bölüm 0★.
 */
export function yildizHesapla(d: OyunDurumu, bolum: { yildizEsikleri: readonly [number, number] }): 0 | 1 | 2 | 3 {
  if (d.bitti !== 'kazanc') return 0;
  for (const h of d.hedefler) if (!h.tamam) return 0;
  let y: 0 | 1 | 2 | 3 = 1;
  const [p50, p85] = bolum.yildizEsikleri;
  if (d.puan >= p50) y = 2;
  if (d.puan >= p85) y = 3;
  if (d.istatistik.guclendirici > 0 && y > 2) y = 2;
  if (d.istatistik.ustaEli && y > 1) y = 1;
  return y;
}
