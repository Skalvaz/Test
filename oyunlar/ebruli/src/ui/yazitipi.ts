/**
 * Gömülü yazı tipleri (SIL OFL) — GDD §11.5:
 *  - "Cormorant Garamond" 700: başlıklar, bölüm adları, kutlama yazıları
 *    (hat ve yazma kitap havası; yalnız ≥ 22 px kullanılır).
 *  - "Alegreya Sans" 500 ve 800: arayüz, düğmeler, sayılar, balonlar
 *    (hümanist, kaligrafik kökenli, küçük boyda okunaklı).
 * Latin + Latin Extended (ğ ş ı İ ç ö ü), woff2; çalışma anında ağ isteği yok.
 *
 * Yazı tipleri JS içinde base64 gelir ve FontFace API'sine İKİLİ VERİ olarak
 * verilir (URL değil): claude.ai sayfasının CSP'si font-src'de data:'yı
 * reddeder; ikili kaynak bir yükleme sayılmaz. Çift tıklanan çevrimdışı
 * ebruli.html'de de aynı görünüm (FİTİL dersi 2).
 */
import baslikLatin from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2?inline';
import baslikLatinExt from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-ext-700-normal.woff2?inline';
import govdeLatin500 from '@fontsource/alegreya-sans/files/alegreya-sans-latin-500-normal.woff2?inline';
import govdeLatinExt500 from '@fontsource/alegreya-sans/files/alegreya-sans-latin-ext-500-normal.woff2?inline';
import govdeLatin800 from '@fontsource/alegreya-sans/files/alegreya-sans-latin-800-normal.woff2?inline';
import govdeLatinExt800 from '@fontsource/alegreya-sans/files/alegreya-sans-latin-ext-800-normal.woff2?inline';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

/** CSS yığınları (style.css ve tuval yazıları aynı adları kullanır). */
export const BASLIK_YIGINI = '"Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
export const GOVDE_YIGINI = '"Alegreya Sans", "Segoe UI", system-ui, sans-serif';

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
export function yaziTipiniGom(): Promise<void> {
  if (kuruldu || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  kuruldu = true;
  const yuzler: [string, string, string, string][] = [
    ['Cormorant Garamond', baslikLatin, '700', LATIN],
    ['Cormorant Garamond', baslikLatinExt, '700', LATIN_EXT],
    ['Alegreya Sans', govdeLatin500, '500', LATIN],
    ['Alegreya Sans', govdeLatinExt500, '500', LATIN_EXT],
    ['Alegreya Sans', govdeLatin800, '800', LATIN],
    ['Alegreya Sans', govdeLatinExt800, '800', LATIN_EXT],
  ];
  const sozler: Promise<unknown>[] = [];
  for (const [aile, veri, agirlik, aralik] of yuzler) {
    try {
      const f = new FontFace(aile, ikili(veri), { weight: agirlik, style: 'normal', unicodeRange: aralik, display: 'swap' });
      document.fonts.add(f);
      sozler.push(f.load().catch(() => {}));
    } catch {
      /* yedek yığın */
    }
  }
  return Promise.all(sozler).then(() => {});
}
