/**
 * Bot ile oynatıp kare kaydeder (GIF ve oynanış denetimi için):
 *   node scripts/kayit.mjs <url> <klasör> [başlangıç-sn] [süre-sn] [fps] [tohum-dene]
 * Çıktı: klasör/k0001.png … ve sonda özet (para, yakalanan, kopan).
 * GIF: ffmpeg -framerate 20 -i klasör/k%04d.png -vf "scale=360:-1:flags=neighbor" cikti.gif
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const [url, klasor, basSn = '0', sureSn = '20', fps = '20'] = process.argv.slice(2);
mkdirSync(klasor, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ locale: 'tr-TR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForTimeout(500);

await page.evaluate(() => {
  const L = window.__lodos;
  L.dondur(true);
  const SIRA = [1, 2, 3, 4, 5, 0, 0];
  const AGIR = [0.1, 0.2, 0.42, 0.6, 0.8, 0.3, 0.5];
  // Basit oyuncu: uygun en yakın balığa kancayı götürür; büyük balık
  // çırpınırken bekler, yoksa sarar. Gece ilerledikçe daha uzun zincir dener.
  window.__bot = () => {
    const d = L.dunya;
    const p = L.parmak;
    if (L.arayuz.durum !== 'oyun') return;
    const kam = d.kam.x;
    const yem = d.kancadaki;
    const yemSira = yem ? SIRA[yem.tur] : 0;
    const hedefSira = d.t < 25 ? 2 : d.t < 60 ? 3 : d.t < 85 ? 4 : 5;
    let en = null;
    let enUz = 1e9;
    for (const b of d.baliklar) {
      if (b.durum !== 'yuz' && b.durum !== 'ilgi') continue;
      const s = SIRA[b.tur];
      const fark = s - yemSira;
      if (s === 0 || fark < 1 || fark > 2) continue;
      const uz = Math.hypot(b.x - d.kancaX, (b.y - d.kancaY) * 0.7);
      if (uz < enUz) {
        enUz = uz;
        en = b;
      }
    }
    if (yem) {
      const agir = AGIR[yem.tur] >= 0.4;
      if (agir && yem.cirp > 0) {
        p.basili = true;
        p.x = d.kancaX - kam;
        p.y = d.kancaY + 2;
        return;
      }
      if (yemSira >= hedefSira || yemSira === 0) {
        p.basili = false;
        return;
      }
    }
    if (!en) {
      // Uygun av yok: yem varsa sar, yoksa bekle.
      p.basili = false;
      return;
    }
    p.basili = true;
    p.x = Math.max(8, Math.min(172, en.x + en.vx * 0.5 - kam));
    p.y = en.y + 1;
  };
  L.basla();
});

const adim = 1 / +fps;
const bas = +basSn;
// Kayıt başlangıcına kadar botla hızlı ilerle.
await page.evaluate(({ bas }) => {
  const L = window.__lodos;
  for (let t = 0; t < bas; t += 1 / 30) {
    window.__bot();
    L.ilerlet(1 / 30);
  }
}, { bas });

const n = Math.round(+sureSn * +fps);
for (let i = 0; i < n; i++) {
  const veri = await page.evaluate(({ adim }) => {
    const L = window.__lodos;
    const alt = Math.round(adim * 60);
    for (let k = 0; k < alt; k++) {
      window.__bot();
      L.ilerlet(1 / 60);
    }
    return document.querySelector('canvas').toDataURL('image/png');
  }, { adim });
  writeFileSync(`${klasor}/k${String(i + 1).padStart(4, '0')}.png`, Buffer.from(veri.split(',')[1], 'base64'));
}
const ozet = await page.evaluate(() => {
  const d = window.__lodos.dunya;
  return { t: +d.t.toFixed(1), para: d.para, yakalanan: d.yakalanan, kedi: d.kediPayi, zincir: d.enZincir, kopan: d.kopan, durum: window.__lodos.arayuz.durum };
});
await browser.close();
for (const l of logs) console.log(l);
console.log(JSON.stringify(ozet));
