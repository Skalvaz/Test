/**
 * Gömülü "Nunito" (SIL OFL) — GDD §13.5 (Ekim 2026: Baloo 2 yerine; daha
 * okunaklı, yuvarlak uçlu): değişken ağırlık 200–1000 tek dosyada, Latin +
 * Latin Extended (ğ ş ı İ ç ö ü), woff2; çalışma anında ağ isteği yok.
 *
 * Yazı tipleri JS içinde base64 gelir ve FontFace API'sine İKİLİ VERİ olarak
 * verilir (URL değil): claude.ai sayfasının CSP'si font-src'yi yalnız
 * fonts.gstatic.com'a açsa da (data: yazı tipi reddedilir) ikili kaynak bir
 * yükleme sayılmaz. Çift tıklanan çevrimdışı fitil.html'de de aynı görünüm.
 */
import latin from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?inline';
import latinExt from '@fontsource-variable/nunito/files/nunito-latin-ext-wght-normal.woff2?inline';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

/** data:…;base64,… → ArrayBuffer. */
function ikili(veriUrl: string): ArrayBuffer {
  const b64 = veriUrl.slice(veriUrl.indexOf(',') + 1);
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a.buffer;
}

let kuruldu = false;

/** Gömülü yazı tiplerini belgeye ekler (bir kez; desteklenmiyorsa yedek yığın kalır). */
export function yaziTipiniGom(): void {
  if (kuruldu || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return;
  kuruldu = true;
  const yuzler: [string, string, string][] = [
    [latin, '200 1000', LATIN],
    [latinExt, '200 1000', LATIN_EXT],
  ];
  for (const [veri, agirlik, aralik] of yuzler) {
    try {
      const f = new FontFace('Nunito', ikili(veri), { weight: agirlik, style: 'normal', unicodeRange: aralik, display: 'swap' });
      document.fonts.add(f);
      void f.load().catch(() => {});
    } catch {
      /* yedek yığın: ui-rounded, system-ui… */
    }
  }
}
