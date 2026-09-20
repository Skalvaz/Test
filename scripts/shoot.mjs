/**
 * Hazır kamera açılarından PNG render alır (headless Chromium + WebGL).
 *
 *   node scripts/shoot.mjs [çıktı-klasörü]
 *
 * Önce `npm run build && npm run preview` çalışıyor olmalıdır.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] || 'renders';
const URL_BASE = process.env.SHOT_URL || 'http://localhost:4173/';
const W = Number(process.env.SHOT_W || 1920);
const H = Number(process.env.SHOT_H || 1080);
// SHOT_FORMAT=jpeg → depoya koyacak kadar küçük dosyalar
const FORMAT = process.env.SHOT_FORMAT === 'jpeg' ? 'jpeg' : 'png';
const QUALITY = Number(process.env.SHOT_QUALITY || 88);

const SHOTS = [
  { file: '01-uc-ceyrek.png', view: 'Üç çeyrek ön', throttle: 0.85, preset: 'Altın saat' },
  { file: '02-hava-girisi.png', view: 'Hava girişi', throttle: 0.15, preset: 'Öğle güneşi' },
  { file: '03-fan-detay.png', view: 'Fan detayı', throttle: 0.0, preset: 'Altın saat' },
  { file: '04-yan-profil.png', view: 'Yan profil', throttle: 1.0, preset: 'Kapalı hava' },
  { file: '05-egzoz.png', view: 'Egzoz', throttle: 1.0, preset: 'Öğle güneşi' },
  { file: '06-kesit.png', view: 'Kesit', throttle: 0.75, preset: 'Öğle güneşi' },
  { file: '07-gece.png', view: 'Üç çeyrek ön', throttle: 0.95, preset: 'Gece apronu' },
];

// SHOT_FILTER=01,06 → yalnızca eşleşen kareleri al
const FILTER = (process.env.SHOT_FILTER || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);
const SELECTED = FILTER.length
  ? SHOTS.filter((s) => FILTER.some((f) => s.file.includes(f)))
  : SHOTS;

await mkdir(OUT, { recursive: true });

// Ortamda kurulu Chromium sürümü Playwright'ın beklediğinden farklı olabilir;
// bu yüzden yol açıkça verilir (indirme yapılmaz).
const EXECUTABLE =
  process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--disable-dev-shm-usage',
  ],
});

const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[sayfa hatası]', m.text());
});
page.on('pageerror', (e) => console.log('[istisna]', e.message));

await page.goto(URL_BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__engineApp, null, { timeout: 180000 });
console.log('sahne hazır');

// Kontrol panelini render dışında bırak
await page.evaluate(() => {
  document.querySelectorAll('.lil-gui').forEach((el) => {
    el.style.setProperty('display', 'none', 'important');
  });
});

for (const shot of SELECTED) {
  await page.evaluate(({ view, throttle, preset }) => {
    const app = window.__engineApp;
    app.env.setPreset(preset);
    app.goToView(view, true);
    app.engine.state.running = true;
    app.engine.state.throttle = throttle;
    app.engine.snapToThrottle();
    app.options.autoRotate = false;
  }, shot);

  // Kamera geçişi + birkaç kare yerleşsin
  await page.waitForTimeout(Number(process.env.SHOT_SETTLE || 2500));
  const file = FORMAT === 'jpeg' ? shot.file.replace(/\.png$/, '.jpg') : shot.file;
  await page.screenshot({
    path: `${OUT}/${file}`,
    timeout: 240000,
    ...(FORMAT === 'jpeg' ? { type: 'jpeg', quality: QUALITY } : {}),
  });
  console.log('yazıldı:', file);
}

await browser.close();
console.log('tamam');
