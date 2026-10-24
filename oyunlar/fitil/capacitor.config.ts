/**
 * Capacitor (Android) ayarları — docs/ANDROID.md §1 (A1–A3, A6, A7, A10), §2, §3.
 *
 * - appId ilk Play yüklemesinden sonra DEĞİŞMEZ; o zamana dek burada ve
 *   android/app/build.gradle'da (namespace, applicationId) birlikte değişir.
 * - webDir: `vite build --mode android` çıktısı (`npm run build:android`).
 * - Bu dosyayı Capacitor CLI okur; TypeScript 7'de derleyici API'si olmadığı
 *   için Node'un yerleşik tür ayıklamasıyla (Node ≥ 22.18). Yalnız silinebilir
 *   TS sözdizimi (tür içe aktarımı, tür notu) kullan; enum/namespace yok.
 *   Oyunun tür denetimine (tsconfig `include: src`) girmez.
 */
import type { CapacitorConfig } from '@capacitor/cli';

/** Oyunun açılış zemini (index.html `theme-color`, style.css `:root`). */
const GECE = '#0B1030';

const config: CapacitorConfig = {
  appId: 'com.fenerkoyu.fitil',
  appName: 'Fitil',
  webDir: 'dist-android',
  // WebView zemini: sayfa çizilmeden önce beyaz parlama olmasın.
  backgroundColor: GECE,
  android: {
    // Yalnız paketteki yerel dosyalar yüklenir (https://localhost); http karışık içerik yok.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // Kenardan kenara (docs/ANDROID.md §3 "Güvenli alan"): index.html'de
      // viewport-fit=cover var; WebView ≥ 140'ta sayfa tam ekran çizilir ve
      // oyunun env(safe-area-inset-*) payları (ui/stil/temel.css --guv-*)
      // doğru değeri alır. Daha eski WebView'da Capacitor WebView'ı çubukların
      // içine yerleştirir ve env() 0 olur: iki durumda da çift pay yok.
      // 'css' (varsayılan) ayrıca --safe-area-inset-* değişkenleri ekler;
      // oyun bunları kullanmadığı için 'native'.
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      // Koyu zemin: açık renkli saat/pil simgeleri (cihaz açık temada da).
      style: 'DARK',
    },
    SplashScreen: {
      // Açılış ekranı hazır olunca köprü (A2, platform/android/yasam.ts) SplashScreen.hide()
      // çağırır (erken çağrı yerel zamanlayıcıdan önce perdeyi kaldırır). Yerel süre sınırı
      // yedektir: JS hiç çalışmazsa (eski WebView paketi ayrıştıramaz, köprü modülü
      // yüklenemez) perde 8 sn sonra yine kalkar ve index.html'in yedek ekranı ya da oyun
      // görünür. launchAutoHide false olsaydı perdeyi kaldıracak tek şey JS olurdu.
      launchAutoHide: true,
      launchShowDuration: 8000,
      launchFadeOutDuration: 250,
      backgroundColor: GECE,
      showSpinner: false,
      // Eklentinin eski yolu (Android 12 API'si başarısızsa) ve SplashScreen.show():
      // splash.png (düz zemin + ortada simge) gerilmeden kırpılır; varsayılan FIT_XY
      // simgeyi ekran oranına göre basardı (docs/ANDROID.md §4).
      androidScaleType: 'CENTER_CROP',
    },
    NativePurchases: {
      // Elle tamamlama (A2, platform/android/satin.ts): oyun ödülü kayda yazdıktan sonra
      // tüketir/onaylar. Açıkken restorePurchases ödülü verilmemiş alımları da onaylardı.
      autoFinishTransactions: false,
    },
  },
};

export default config;
