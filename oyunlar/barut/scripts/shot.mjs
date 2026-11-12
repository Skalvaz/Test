/**
 * Telefon görünümünde ekran görüntüsü:
 *   node scripts/shot.mjs <url> <çıktı.png> [genişlik] [yükseklik] [js]
 * `js` sayfada çalıştırılır; `window.__barut` ile oyun ilerletilebilir
 * (ör. "L.basla(); L.ilerlet(80)" — L = window.__barut).
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const [url, out, w = '390', h = '844', js] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ locale: 'tr-TR', viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(600);
if (js) {
  const sonuc = await page.evaluate(`(() => { const L = window.__barut; L.dondur(true); ${js}; L.ciz(); })()`);
  if (sonuc !== undefined) console.log(JSON.stringify(sonuc));
}
await page.screenshot({ path: out });
await browser.close();
for (const l of logs) console.log(l);
console.log(`yazıldı: ${out}`);
