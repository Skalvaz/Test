/**
 * Arayüz dili (Ekim 2026: Türkçe + İngilizce). Sayfa açılırken bir kez
 * belirlenir ve sayfa ömrü boyunca sabittir; bütün metin tabloları modül
 * yüklenirken bu dille kurulur. Sıra: `?dil=tr|en` (geliştirme), bu cihazda
 * seçilen dil (`fitil-dil`), cihaz dili (tr… → Türkçe, gerisi İngilizce).
 * Ayarlar'da dil değişince seçim yazılır ve sayfa yeniden yüklenir.
 * Node'da (vitest, bot) Türkçe.
 */
export type Dil = 'tr' | 'en';

export const DILLER: readonly Dil[] = ['tr', 'en'];

const ANAHTAR = 'fitil-dil';

const gecerli = (x: unknown): x is Dil => x === 'tr' || x === 'en';

function ilkDil(): Dil {
  // Testler İngilizceyi modülleri yüklemeden önce `globalThis.__FITIL_DIL__ = 'en'` ile açar.
  const zorla = (globalThis as { __FITIL_DIL__?: unknown }).__FITIL_DIL__;
  if (gecerli(zorla)) return zorla;
  if (typeof window === 'undefined') return 'tr';
  try {
    const p = new URLSearchParams(window.location.search).get('dil');
    if (gecerli(p)) return p;
  } catch {
    /* adres okunamadı */
  }
  try {
    const k = window.localStorage.getItem(ANAHTAR);
    if (gecerli(k)) return k;
  } catch {
    /* depolama kapalı */
  }
  const n = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return n.some((x) => /^tr\b/i.test(x ?? '')) ? 'tr' : 'en';
}

/** Bu sayfanın dili. */
export const DIL: Dil = ilkDil();

/** Sayı, tarih ve büyük/küçük harf için yerel ayar. */
export const YEREL = DIL === 'en' ? 'en-US' : 'tr-TR';

/** İki dilli değer (metin ya da metin üreten işlev): önce Türkçe, sonra İngilizce. */
export function t<T>(tr: T, en: T): T {
  return DIL === 'en' ? en : tr;
}

/** Dile göre büyük harf (Türkçede i → İ, İngilizcede i → I). */
export const buyukHarf = (s: string): string => s.toLocaleUpperCase(YEREL);

/** Dile göre küçük harf. */
export const kucukHarf = (s: string): string => s.toLocaleLowerCase(YEREL);

/** Seçilen dili bu cihaza yazar (yeniden yüklemeden sonra geçerli olur). */
export function dilKaydet(d: Dil): void {
  try {
    window.localStorage.setItem(ANAHTAR, d);
  } catch {
    /* depolama kapalı: yalnız bu oturum (adres parametresi yok) → cihaz dili */
  }
}
