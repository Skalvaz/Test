/**
 * Metin paylaşma (kayıt kodu yedeği; docs/YASAL-UYUM.md §3). Sıra:
 *  1. Android köprüsü (`window.FitilYerel.paylas`, `@capacitor/share`):
 *     sistemin paylaş penceresi;
 *  2. Web Share API (telefon tarayıcıları; çerçeve izin vermiyorsa yok);
 *  3. hiçbiri yoksa `'yok'`: çağıran panoya kopyalar.
 * Metni yalnız oyuncunun seçtiği uygulama alır; oyun hiçbir yere göndermez.
 * Bu dosya Capacitor İÇE AKTARMAZ (web derlemesine de girer).
 */

/** `tamam`: paylaş penceresi kullanıldı; `iptal`: oyuncu vazgeçti; `yok`: paylaşma yolu yok. */
export type PaylasSonucu = 'tamam' | 'iptal' | 'yok';

interface PaylasNavigator {
  share?: (veri: { title?: string; text?: string }) => Promise<void>;
}

function webPaylasIzinli(): boolean {
  try {
    const d = document as unknown as { permissionsPolicy?: { allowsFeature(f: string): boolean }; featurePolicy?: { allowsFeature(f: string): boolean } };
    const p = d.permissionsPolicy ?? d.featurePolicy;
    return p ? p.allowsFeature('web-share') : true;
  } catch {
    return true;
  }
}

function webPaylas(): PaylasNavigator['share'] | null {
  try {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') return null;
    const s = (navigator as PaylasNavigator).share;
    return typeof s === 'function' && webPaylasIzinli() ? s.bind(navigator) : null;
  } catch {
    return null;
  }
}

/** Paylaş penceresi açılabilir mi (değilse arayüz yalnız "Kopyala" gösterir). */
export function paylasDestekli(): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.FitilYerel?.paylas === 'function') return true;
  } catch {
    /* köprü okunamadı */
  }
  return webPaylas() !== null;
}

/** Metni paylaşır; asla fırlatmaz. */
export async function paylas(metin: string, baslik: string): Promise<PaylasSonucu> {
  try {
    const yerel = typeof window !== 'undefined' ? window.FitilYerel?.paylas : undefined;
    if (typeof yerel === 'function') {
      const r = await yerel(metin, baslik);
      return r === 'tamam' || r === 'iptal' ? r : 'yok';
    }
  } catch {
    return 'yok';
  }
  const s = webPaylas();
  if (!s) return 'yok';
  try {
    await s({ title: baslik, text: metin });
    return 'tamam';
  } catch (e) {
    return (e as { name?: unknown } | null)?.name === 'AbortError' ? 'iptal' : 'yok';
  }
}
