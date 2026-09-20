/**
 * dist-single/ çıktısını tek bir bağımsız HTML dosyasına gömer.
 *
 *   SINGLE=1 vite build && node scripts/bundle-single.mjs
 *
 * Sonuç: turbofan.html — kurulum, sunucu ve internet gerektirmeden
 * çift tıklamayla açılır.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dist-single';
const OUT = process.argv[2] || 'turbofan.html';

if (!existsSync(join(DIR, 'index.html'))) {
  console.error(`${DIR}/index.html yok. Önce: SINGLE=1 npx vite build`);
  process.exit(1);
}

let html = readFileSync(join(DIR, 'index.html'), 'utf8');

// Stil dosyasını <style> olarak göm
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (m, href) => {
  const file = join(DIR, href.replace(/^\.?\//, ''));
  if (!existsSync(file)) return m;
  return `<style>\n${readFileSync(file, 'utf8')}\n</style>`;
});

// Betiği klasik (modül olmayan) satır içi script olarak göm.
// Vite bu etiketi <head> içine koyar; ES modülleri ertelenmiş çalıştığı için
// orada sorun olmaz, ama klasik script hemen çalışır ve #app henüz yokken
// hata verir. Bu yüzden betik </body> hemen öncesine taşınır.
let inlineScript = '';
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>\s*/g, (m, src) => {
  const file = join(DIR, src.replace(/^\.?\//, ''));
  if (!existsSync(file)) return m;
  // Kod içinde geçebilecek </script> dizisi etiketi erken kapatmasın
  const js = readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script');
  inlineScript = `    <script>\n${js}\n    </script>\n`;
  return '';
});

if (!inlineScript) {
  console.error('betik bulunamadı; derleme çıktısı beklenenden farklı.');
  process.exit(1);
}
// Değiştirme metni fonksiyonla verilir: küçültülmüş paket `$&`, `$'` gibi
// diziler içerir ve doğrudan verilseydi String.replace bunları özel değiştirme
// deseni sayıp kodu bozardı.
html = html.replace('</body>', () => `${inlineScript}  </body>`);

writeFileSync(OUT, html);
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(`yazıldı: ${OUT} (${kb} KB)`);

const leftovers = html.match(/(src|href)="\.?\/?assets?\//g);
if (leftovers) {
  console.warn('uyarı: dışarıda kalan kaynak referansı var:', leftovers);
  process.exit(2);
}
