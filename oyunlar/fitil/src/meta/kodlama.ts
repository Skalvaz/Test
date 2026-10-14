/**
 * UTF-8 ve base64 kodlama (saf; `btoa`/`atob` gerektirmez, Türkçe karakter
 * ve ★●▲■ gibi simgelerde güvenli). Kayıt kodu ve Gece Tablosu kullanır.
 */

const ALFABE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TERS = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALFABE.length; i++) t[ALFABE.charCodeAt(i)] = i;
  return t;
})();

export function utf8Kodla(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Geçersiz UTF-8'de null. */
export function utf8Coz(b: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return null;
  }
}

export function base64Kodla(b: Uint8Array): string {
  let s = '';
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    s += ALFABE[(n >>> 18) & 63] + ALFABE[(n >>> 12) & 63] + ALFABE[(n >>> 6) & 63] + ALFABE[n & 63];
  }
  const kalan = b.length - i;
  if (kalan === 1) {
    const n = b[i] << 16;
    s += ALFABE[(n >>> 18) & 63] + ALFABE[(n >>> 12) & 63] + '==';
  } else if (kalan === 2) {
    const n = (b[i] << 16) | (b[i + 1] << 8);
    s += ALFABE[(n >>> 18) & 63] + ALFABE[(n >>> 12) & 63] + ALFABE[(n >>> 6) & 63] + '=';
  }
  return s;
}

/** Katı çözümleme: alfabe dışı karakter, yanlış uzunluk ya da dolgu → null. */
export function base64Coz(s: string): Uint8Array | null {
  if (s.length % 4 !== 0) return null;
  let dolgu = 0;
  if (s.endsWith('==')) dolgu = 2;
  else if (s.endsWith('=')) dolgu = 1;
  const n = (s.length / 4) * 3 - dolgu;
  const out = new Uint8Array(n);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let v = 0;
    for (let j = 0; j < 4; j++) {
      const c = s.charCodeAt(i + j);
      let d: number;
      if (c === 61 /* = */) {
        if (i + 4 !== s.length || j < 4 - dolgu) return null;
        d = 0;
      } else {
        d = c < 128 ? TERS[c] : -1;
        if (d < 0) return null;
      }
      v = (v << 6) | d;
    }
    if (o < n) out[o++] = (v >>> 16) & 255;
    if (o < n) out[o++] = (v >>> 8) & 255;
    if (o < n) out[o++] = v & 255;
  }
  return out;
}

/** Metin → base64 (UTF-8 güvenli). */
export function metinBase64(s: string): string {
  return base64Kodla(utf8Kodla(s));
}

/** base64 → metin; geçersizse null. */
export function base64Metin(s: string): string | null {
  const b = base64Coz(s);
  return b ? utf8Coz(b) : null;
}
