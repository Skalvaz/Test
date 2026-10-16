/**
 * dist-single/ çıktısından iki dosya üretir:
 *
 *   <slug>.html          — bağımsız tek dosya; kurulum ve sunucu olmadan
 *                          çift tıklamayla açılır.
 *   dist-single/artifact.html — claude.ai sayfası olarak yayınlanacak gövde:
 *                          yayın sırasında doctype/html/head/body iskeleti
 *                          platform tarafından eklendiği için bu etiketler
 *                          ve charset/viewport metaları çıkarılır.
 *
 *   npm run build:single
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dist-single';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const slug = pkg.config?.slug ?? 'oyun';
const OUT = process.argv[2] || `${slug}.html`;

if (!existsSync(join(DIR, 'index.html'))) {
  console.error(`${DIR}/index.html yok. Önce: npx vite build --mode single`);
  process.exit(1);
}

let html = readFileSync(join(DIR, 'index.html'), 'utf8');

// Stil dosyasını <style> olarak göm
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="(\.?\/?[^"]+\.css)"[^>]*>/g, (m, href) => {
  const file = join(DIR, href.replace(/^\.?\//, ''));
  if (!existsSync(file)) return m;
  return `<style>\n${readFileSync(file, 'utf8')}\n</style>`;
});

// Betiği klasik satır içi script olarak </body> öncesine taşı: IIFE hemen
// çalışır ve #app'in var olması gerekir.
let inlineScript = '';
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>\s*/g, (m, src) => {
  const file = join(DIR, src.replace(/^\.?\//, ''));
  if (!existsSync(file)) return m;
  const js = readFileSync(file, 'utf8').replace(/<\/script/gi, '<\\/script');
  inlineScript = `<script>\n${js}\n</script>\n`;
  return '';
});
if (!inlineScript) {
  console.error('betik bulunamadı; derleme çıktısı beklenenden farklı.');
  process.exit(1);
}
// Değiştirme fonksiyonla: küçültülmüş kod `$&` gibi diziler içerebilir.
html = html.replace('</body>', () => `${inlineScript}</body>`);

writeFileSync(OUT, html);
console.log(`yazıldı: ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`);

// claude.ai sayfası: <title> ilk 8 KB içinde olmalı; title + metalar + stil
// başa, gövde içeriği ve betik sona.
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const headKept = head
  .replace(/<meta[^>]*charset[^>]*>\s*/gi, '')
  .replace(/<meta[^>]*name="viewport"[^>]*>\s*/gi, '')
  .trim();
const title = headKept.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '';
const rest = headKept.replace(title, '').trim();
const artifact = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${rest}\n${body.trim()}\n`;
writeFileSync(join(DIR, 'artifact.html'), artifact);
console.log(`yazıldı: ${join(DIR, 'artifact.html')} (${(statSync(join(DIR, 'artifact.html')).size / 1024).toFixed(0)} KB)`);

const leftovers = html.match(/(src|href)="\.?\/?assets?\//g);
if (leftovers) {
  console.warn('uyarı: dışarıda kalan kaynak referansı var:', leftovers);
  process.exit(2);
}
