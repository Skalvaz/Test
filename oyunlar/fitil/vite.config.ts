/**
 * Üç derleme kipi:
 *   vite build                → çok dosyalı çıktı (dist/)
 *   vite build --mode single  → tek dosyaya gömülecek IIFE paketi (dist-single/)
 *   vite build --mode android → Capacitor'ün uygulamaya kopyaladığı çok dosyalı
 *                               çıktı (dist-android/; docs/ANDROID.md §2)
 *
 * Tek dosya kipinde IIFE kullanılır: tarayıcılar file:// üzerinden ES modülü
 * yüklemeyi engeller, klasik script ise çift tıklamayla açılan dosyada çalışır.
 * Android kipi normal ES modülü derlemesidir (WebView yerel dosyaları
 * https://localhost'tan sunar; base './'). Bu kipte `.env.android` ve git'e
 * girmeyen `.env.android.local` okunur (VITE_ADMOB_ODULLU).
 */
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true },
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', '.claude/**'],
    // Bot/simülasyon testleri tek başına birkaç saniye; tam koşuda (dosyalar paralel) yük altında 5 sn'yi aşabiliyor.
    testTimeout: 20_000,
  },
  build: mode === 'single'
    ? {
        outDir: 'dist-single',
        emptyOutDir: true,
        assetsInlineLimit: 100 * 1024 * 1024,
        cssCodeSplit: false,
        rolldownOptions: {
          output: {
            format: 'iife',
            inlineDynamicImports: true,
            codeSplitting: false,
            entryFileNames: 'app.js',
            assetFileNames: 'app.[ext]',
          },
        },
      }
    : mode === 'android'
      ? {
          outDir: 'dist-android',
          emptyOutDir: true,
        }
      : {},
}));
