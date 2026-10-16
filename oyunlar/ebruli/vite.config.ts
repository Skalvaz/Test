/**
 * İki derleme kipi:
 *   vite build               → çok dosyalı çıktı (dist/)
 *   vite build --mode single → tek dosyaya gömülecek IIFE paketi (dist-single/)
 *
 * Tek dosya kipinde IIFE kullanılır: tarayıcılar file:// üzerinden ES modülü
 * yüklemeyi engeller, klasik script ise çift tıklamayla açılan dosyada çalışır.
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
    : {},
}));
