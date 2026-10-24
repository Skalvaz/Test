/**
 * Yerel sarmalayıcı (Android, Capacitor) ile uygulama arasındaki küçük
 * bağlantı — docs/ANDROID.md §3. Bu dosya Capacitor İÇE AKTARMAZ: web
 * derlemesine de girer, ama olaylar yalnız Android köprüsü
 * (`platform/android`) gönderince gelir; `window.FitilYerel` yoksa her işlev
 * etkisizdir (claude.ai, `fitil.html`, tarayıcı).
 *
 *  - Geri tuşu: köprü `geriTusuBildir()` ile sorar; uygulama işlediyse
 *    (açık pencere kapandı, oyun duraklatıldı) true, değilse köprü uygulamayı
 *    arka plana alır.
 *  - Yaşam döngüsü: köprü uygulama ön plandan çıkınca / dönünce
 *    `yasamBildir(aktif)` gönderir (`visibilitychange` her WebView'da
 *    gelmeyebilir; ikisi birlikte de zararsız).
 *  - Açılış perdesi: uygulama açılış ekranını kurunca `yerelHazir()`.
 *  - Reklam gizlilik seçenekleri (UMP): `gizlilikSecenekleri()`.
 *  - Pakete gömülü gizlilik politikası: `gizlilikPolitikasi()`.
 */

/** Geri tuşu olayı (window, iptal edilebilir: `preventDefault` = işlendi). */
export const GERI_OLAYI = 'fitil-geri';
/** Yaşam döngüsü olayı (window; `detail.aktif`). */
export const YASAM_OLAYI = 'fitil-yasam';

function pencere(): EventTarget | null {
  return typeof window !== 'undefined' ? window : null;
}

/**
 * (Köprü) Geri tuşuna basıldı. Uygulama işlediyse true; dinleyen yoksa ya da
 * işlemediyse false (köprü uygulamayı arka plana alır).
 */
export function geriTusuBildir(hedef: EventTarget | null = pencere()): boolean {
  if (!hedef) return false;
  try {
    return !hedef.dispatchEvent(new CustomEvent(GERI_OLAYI, { cancelable: true }));
  } catch {
    return false;
  }
}

/**
 * (Uygulama) Geri tuşunu dinle: `fn` true dönerse işlendi sayılır. Dinleyici
 * fırlatırsa işlenmedi sayılır. Dönen işlev dinleyiciyi kaldırır.
 */
export function geriTusunuDinle(fn: () => boolean, hedef: EventTarget | null = pencere()): () => void {
  if (!hedef) return () => undefined;
  const d = (e: Event) => {
    let islendi = false;
    try {
      islendi = fn() === true;
    } catch {
      islendi = false;
    }
    if (islendi) e.preventDefault();
  };
  hedef.addEventListener(GERI_OLAYI, d);
  return () => hedef.removeEventListener(GERI_OLAYI, d);
}

/** (Köprü) Uygulama ön plana döndü (`true`) ya da ön plandan çıktı (`false`). */
export function yasamBildir(aktif: boolean, hedef: EventTarget | null = pencere()): void {
  if (!hedef) return;
  try {
    hedef.dispatchEvent(new CustomEvent(YASAM_OLAYI, { detail: { aktif } }));
  } catch {
    /* olay gönderilemedi: visibilitychange yolu yine çalışır */
  }
}

/** (Uygulama) Yaşam döngüsünü dinle. Dönen işlev dinleyiciyi kaldırır. */
export function yasamDinle(fn: (aktif: boolean) => void, hedef: EventTarget | null = pencere()): () => void {
  if (!hedef) return () => undefined;
  const d = (e: Event) => {
    const aktif = (e as CustomEvent<{ aktif?: unknown }>).detail?.aktif;
    if (typeof aktif === 'boolean') fn(aktif);
  };
  hedef.addEventListener(YASAM_OLAYI, d);
  return () => hedef.removeEventListener(YASAM_OLAYI, d);
}

/** (Uygulama) Açılış ekranı kuruldu: Android'de yerel açılış perdesi kalkar; web'de etkisiz. */
export function yerelHazir(): void {
  try {
    if (typeof window !== 'undefined') window.FitilYerel?.hazir?.();
  } catch {
    /* köprü hatası oyunu durdurmaz (köprünün güvenlik zamanlayıcısı perdeyi yine kaldırır) */
  }
}

/**
 * (Uygulama) Pakete gömülü gizlilik politikası (HTML, `docs/gizlilik.html`).
 * Yalnız Android köprüsü verir (Play: politika uygulamanın içinde de
 * yayımlanır); köprü yoksa (web, claude.ai) null: Ayarlar'da satır yok.
 */
export function gizlilikPolitikasi(): string | null {
  try {
    const p = typeof window !== 'undefined' ? window.FitilYerel?.politika?.() : undefined;
    return typeof p === 'string' && p.trim() ? p : null;
  } catch {
    return null;
  }
}

/**
 * (Uygulama) Reklam gizlilik seçenekleri formunu açan işlev; köprü yoksa ya
 * da UMP giriş noktası istemiyorsa (`privacyOptionsRequirementStatus` ≠
 * REQUIRED) null. Ayarlar her açılışta yeniden sorar (onay bilgisi açılıştan
 * sonra gelir).
 */
export function gizlilikSecenekleri(): (() => void) | null {
  try {
    const g = typeof window !== 'undefined' ? window.FitilYerel?.gizlilik : undefined;
    if (!g || g.gerekli() !== true) return null;
    return () => {
      try {
        void Promise.resolve(g.ac()).catch(() => undefined);
      } catch {
        /* form açılamadı */
      }
    };
  } catch {
    return null;
  }
}
