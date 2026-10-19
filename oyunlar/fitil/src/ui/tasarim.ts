/**
 * GEÇİCİ (Ekim 2026): menü düzeni için üç alternatif, `?tasarim=1|2|3`
 * (varsayılan 2). Kullanıcı birini seçince bu modül ve diğer iki dal kalkar.
 *  1 Sade: hedefler + hamle + Oyna; mühürler yazısız; mekanik/coşku kartı yok.
 *  2 Dengeli: şimdiki düzen, büyük yazı, daha az satır.
 *  3 Liste: hedefler büyük yazılı liste; mühürler tek satır "Mühürler 1/3".
 */
export type Tasarim = '1' | '2' | '3';
let secili: Tasarim | null = null;

export function tasarim(): Tasarim {
  if (secili) return secili;
  let q: string | null = null;
  try {
    q = new URLSearchParams(location.search).get('tasarim');
  } catch {
    /* adres yok (test) */
  }
  secili = q === '1' || q === '3' ? q : '2';
  try {
    document.documentElement.dataset.tasarim = secili;
  } catch {
    /* DOM yok */
  }
  return secili;
}
