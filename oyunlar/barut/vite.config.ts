/**
 * İki derleme kipi (FİTİL/EBRULİ ile aynı):
 *   vite build               → çok dosyalı çıktı (dist/)
 *   vite build --mode single → tek dosyaya gömülecek IIFE paketi (dist-single/)
 */
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true },
  test: { exclude: ['**/node_modules/**', '**/.git/**'] },
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
