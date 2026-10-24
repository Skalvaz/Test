/**
 * Android (Capacitor) önyüklemesi — aşama 3, `docs/ANDROID.md` §3.
 *
 * Yalnız `vite build --mode android` derlemesinde `main.ts` bu modülü dinamik
 * içe aktarır ve oyun başlamadan önce `androidKur()`'u bekler. Web
 * derlemelerinde (`build`, `build:single`) dal ölü koddur; bu dosya ve
 * Capacitor eklentileri pakete girmez.
 *
 * `androidKur` `window.FitilYerel`'i EŞZAMANLI kurar (uygulama kurulurken
 * `gelirSaglayici()` sayfa başına bir kez seçer, köprü o anda hazır olmalı)
 * ve hemen döner; onay (UMP), reklam ön yüklemesi ve eklenti dinleyicileri
 * arkada sürer. Hiçbir hata oyunu durdurmaz.
 *
 * Modüller: `reklam.ts` (AdMob + UMP), `satin.ts` (Play Billing),
 * `kopru.ts` (`FitilYerel.gelir` JSON biçimi), `yasam.ts` (açılış perdesi,
 * geri tuşu, yaşam döngüsü). Uygulama tarafı `platform/yerel.ts`.
 */
import { gelirKoprusu } from './kopru';
import { reklamKur, TEST_ODULLU } from './reklam';
import { satinAlmaKur } from './satin';
import { perdeKur, yasamKur } from './yasam';

declare global {
  interface ImportMetaEnv {
    /** Ödüllü reklam birimi (`.env.android` test kimliği; gerçeği `.env.android.local`). */
    readonly VITE_ADMOB_ODULLU?: string;
  }
}

/** Ödüllü reklam birimi: ortamdan, boşsa Google'ın test birimi (A7). */
export function odulluBirim(): string {
  const v = import.meta.env.VITE_ADMOB_ODULLU;
  return typeof v === 'string' && v.trim() ? v.trim() : TEST_ODULLU;
}

export async function androidKur(): Promise<void> {
  // İlk iş perde: güvenlik zamanlayıcısı aşağıdaki her şeyden önce kurulsun.
  const perde = perdeKur();
  const reklam = reklamKur({ birim: odulluBirim(), hazir: perde.kalkti });
  const satin = satinAlmaKur();
  window.FitilYerel = {
    ...window.FitilYerel,
    // A8: Firebase ertelendi; olay yalnız yerel günlükte kalır (olcum.ts zaten yazar).
    olay: () => undefined,
    gelir: gelirKoprusu(reklam, satin),
    gizlilik: { gerekli: () => reklam.gizlilikGerekli(), ac: () => reklam.gizlilikAc() },
    hazir: () => perde.hazir(),
  };
  void yasamKur().catch((e: unknown) => console.error('[fitil] geri tuşu / yaşam döngüsü kurulamadı', e));
  void reklam.baslat();
}
