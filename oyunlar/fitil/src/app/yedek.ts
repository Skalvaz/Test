/**
 * Kayıt yedeği hatırlatması (docs/YASAL-UYUM.md §3): kayıt yalnız cihazda
 * (Android'de Google Drive yedeği kapalı), oyun silinince ilerleme gider.
 * Kazançtan sonra haritaya dönüşte, 10/20/30/40. bölüm ilk kez kazanılınca
 * bir kez "Kaydını yedekle" kartı çıkar. Oyuncu kodu kendisi yedeklerse
 * (Ayarlar'da Kopyala/Paylaş) o ana dek kazanılmış eşikler de görülmüş
 * sayılır. İz `ipuclari.gorulen`'de (`yedek-N`); şema değişmez.
 */
import * as meta from '../meta';
import type { Kayit } from '../meta';

export const YEDEK_ESIKLERI: readonly number[] = [10, 20, 30, 40];

const yedekId = (n: number) => `yedek-${n}`;

/** Hatırlatılacak en yüksek eşik (kazanılmış, görülmemiş); yoksa null. */
export function yedekEsigi(k: Kayit): number | null {
  let r: number | null = null;
  for (const n of YEDEK_ESIKLERI) if (meta.bolumKazanildi(k, n) && !k.ipuclari.gorulen.includes(yedekId(n))) r = n;
  return r;
}

/** Kazanılmış bütün eşikler görüldü (kart gösterildi ya da oyuncu kodu yedekledi). */
export function yedekGoruldu(k: Kayit): Kayit {
  let y = k;
  for (const n of YEDEK_ESIKLERI) if (meta.bolumKazanildi(k, n)) y = meta.ipucuGoruldu(y, yedekId(n));
  return y;
}
