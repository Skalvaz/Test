/**
 * İki derleme kipi:
 *   vite build              → klasik çok dosyalı çıktı (dist/), sunucu ister
 *   SINGLE=1 vite build     → tek dosyaya gömülecek IIFE paketi (dist-single/)
 *
 * Tek dosya kipinde modül biçimi yerine IIFE kullanılır: tarayıcılar
 * file:// üzerinden ES modülü yüklemeyi güvenlik nedeniyle engeller, klasik
 * script etiketi ise sorunsuz çalışır. Böylece çıkan HTML hiçbir kurulum
 * gerektirmeden çift tıklamayla açılır.
 */

import { defineConfig } from 'vite';

const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  build: single
    ? {
        outDir: 'dist-single',
        emptyOutDir: true,
        assetsInlineLimit: 100 * 1024 * 1024,
        cssCodeSplit: false,
        chunkSizeWarningLimit: 4096,
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
    : {
        chunkSizeWarningLimit: 4096,
      },
});
