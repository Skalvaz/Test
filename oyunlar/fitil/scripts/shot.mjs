/**
 * Telefon görünümünde ekran görüntüsü:
 *   node scripts/shot.mjs <url> <çıktı.png> [genişlik] [yükseklik] [bekleme-ms] [js]
 * Varsayılan 390×844 (DPR 3, dokunmatik). `js` sayfada çalıştırılır
 * (ör. "window.__game.debug.loadLevel(3)").
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// Windows'ta Playwright'ın kendi tarayıcısı; Linux bulut ortamında hazır Chromium.
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const [url, out, w = '390', h = '844', wait = '1500', js] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({
  locale: 'tr-TR',
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 3,
  isMobile: +w < 700,
  hasTouch: true,
});
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) {
  await page.evaluate(js);
  await page.waitForTimeout(+wait);
}
await page.screenshot({ path: out });
await browser.close();
for (const l of logs) console.log(l);
console.log(`yazıldı: ${out}`);
