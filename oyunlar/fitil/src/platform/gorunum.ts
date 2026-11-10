/**
 * Tablet görünümü (Kasım 2026): tablette arayüzün tamamı (HUD, pencereler,
 * harita, yazılar) telefon boyunda kalıp ekranın ortasında küçük duruyordu.
 * Çözüm tek yerde: sayfanın görünüm alanı (viewport meta) kısa kenarı 600 dp'lik
 * bir cihaza göre kurulur; tarayıcı her şeyi orantılı büyütür (tuval dahil).
 * Yerleşim kodu ve CSS değişmez, hiçbir ekran ayrıca ölçeklenmez.
 *
 *  - Telefon (kısa kenar ≤ 600 dp): dokunulmaz.
 *  - Tablet: ölçek = kısa kenar / 600, en çok 1,5 (10" tablet 800 dp → 1,33;
 *    13" tablet 1024 dp → 1,5: yerleşim 683 dp).
 *  - Yalnız dokunmatik cihazda ve sayfa en üstteyken (Android uygulaması,
 *    telefon/tablet tarayıcısı). Çerçeve içinde (claude.ai) ve masaüstü
 *    tarayıcıda viewport meta zaten etkisizdir; oradaki tablet için
 *    `ui/yerlesim.ts` `hudOlcegi` HUD'u ayrıca büyütür.
 *  - Ekran dönünce yeniden hesaplanır.
 */

export const TABLET_KISA_KENAR = 600;
export const TABLET_OLCEK_EN_COK = 1.5;

/** Kısa kenarı `kisa` dp olan cihazın büyütme oranı (telefon 1). */
export function tabletOlcegi(kisa: number): number {
  if (!(kisa > TABLET_KISA_KENAR)) return 1;
  return Math.min(TABLET_OLCEK_EN_COK, kisa / TABLET_KISA_KENAR);
}

/**
 * Cihazın şu anki (yöne göre) genişliği `genislik` dp, kısa kenarı `kisa` dp
 * iken viewport genişliği; null = değişiklik gerekmez (telefon).
 */
export function gorunumGenisligi(genislik: number, kisa: number): number | null {
  const o = tabletOlcegi(kisa);
  if (o <= 1.001 || !(genislik > 0)) return null;
  return Math.round(genislik / o);
}

/** Uygulanan büyütme oranı (viewport meta değiştirildiyse > 1). */
let uygulanan = 1;

/**
 * Uygulanan tablet ölçeği. Sayfa büyütülünce 1 CSS pikseli `devicePixelRatio`
 * × bu oran kadar fiziksel piksel eder; tuval ve sprite'lar bununla çarpılmış
 * çözünürlükte hazırlanmazsa görüntü bulanır (`render/stage.ts`, `dprTavani`).
 */
export function gorunumOlcegi(): number {
  return uygulanan;
}

/** Sprite/tuval çözünürlük tavanı: telefonda `taban` (2), tablette ölçekle çarpılır. */
export function dprTavani(taban = 2): number {
  return taban * uygulanan;
}

/** Sayfa açılırken bir kez çağrılır (ilk yerleşimden önce). Hata oyunu durdurmaz. */
export function tabletGorunumuKur(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.self !== window.top) return;
    if (!(navigator.maxTouchPoints > 0)) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const ilk = meta.content;
    const uygula = () => {
      const kisa = Math.min(screen.width, screen.height);
      const uzun = Math.max(screen.width, screen.height);
      const yatay = typeof matchMedia === 'function' && matchMedia('(orientation: landscape)').matches;
      const g = gorunumGenisligi(yatay ? uzun : kisa, kisa);
      const icerik = g === null ? ilk : `width=${g}, viewport-fit=cover`;
      uygulanan = g === null ? 1 : tabletOlcegi(kisa);
      if (meta.content !== icerik) meta.content = icerik;
    };
    uygula();
    if (typeof matchMedia === 'function') matchMedia('(orientation: landscape)').addEventListener?.('change', uygula);
  } catch {
    /* görünüm ayarlanamadı: sayfa cihaz genişliğinde kalır */
  }
}
