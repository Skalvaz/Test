/**
 * Bot ile oynatıp kare kaydeder (GIF ve oynanış denetimi için):
 *   node scripts/kayit.mjs <url> <klasör> [başlangıç-sn] [süre-sn] [fps]
 * Çıktı: klasör/k0001.png … ve sonda özet.
 * GIF: ffmpeg -framerate 20 -i klasör/k%04d.png -vf "scale=480:-1:flags=neighbor" cikti.gif
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
  const L = window.__barut;
  L.dondur(true);
  // Basit pilot: en öndeki düşmanın biraz gerisinde, alçakta süzülür;
  // uçaksavar halkasından ve yaklaşan mermilerden kaçar.
  window.__bot = () => {
    const d = L.dunya;
    const h = d.heli;
    let on = 1e9;
    for (const s of d.askerler) if (!s.dost && s.x < on) on = s.x;
    for (const a of d.araclar) if (a.x < on) on = a.x;
    let tx = Math.max(170, Math.min(385, (on < 1e8 ? on : 300) - 50));
    let ty = d.zemin - 88 + Math.sin(d.zaman * 1.7) * 28;
    for (const f of d.flaklar) {
      if (Math.hypot(f.x - h.x, f.y - h.y) < 40) {
        tx += h.x < f.x ? -50 : 50;
        ty += h.y < f.y ? -30 : 30;
      }
    }
    for (const m of d.mermiler) {
      if (m.tip < 2) continue;
      const dx = h.x - m.x;
      const dy = h.y - m.y;
      if (Math.hypot(dx, dy) < 60 && dx * m.vx + dy * m.vy > 0) ty += dy > 0 ? 26 : -26;
    }
    // Dalga arasında en yakın gömülü sandığın üstüne gidip kazar; yere inen sandığı toplar.
    const sandik = d.sandiklar.find((k) => k.tip > 0 || h.can < 80);
    if (sandik) {
      tx = sandik.x;
      ty = sandik.y - 12;
    } else if (d.ara > 0 || on > 1e8) {
      const g = d.gomuler.filter((k) => k.tip === 1 && k.x < 400).sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
      if (g) {
        tx = g.x;
        ty = d.zemin - 60;
        if (Math.abs(h.x - g.x) < 3 && Math.abs(h.vx) < 20) d.bombaBirak();
      }
    }
    // Bomba: düşeceği yerde düşman varsa bırak
    if (d.bomba.adet > 0) {
      const dusme = Math.sqrt((2 * Math.max(10, d.yerY(h.x) - h.y)) / 280);
      const bx = h.x + h.vx * 0.55 * dusme;
      let yakin = 0;
      for (const s of d.askerler) if (!s.dost && s.x < 538 && Math.abs(s.x - bx) < 14) yakin++;
      for (const a of d.araclar) if (a.x < 538 && Math.abs(a.x - bx) < 16) yakin += 3;
      if (yakin >= 2) d.bombaBirak();
    }
    d.surukle((tx - h.hx) * 0.2, (ty - h.hy) * 0.2);
  };
  L.basla();
});

const bas = +basSn;
await page.evaluate(({ bas }) => {
  const L = window.__barut;
  for (let t = 0; t < bas && !L.dunya.bitti; t += 1 / 60) {
    window.__bot();
    L.ilerlet(1 / 60);
  }
}, { bas });

const n = Math.round(+sureSn * +fps);
const alt = Math.round(60 / +fps);
for (let i = 0; i < n; i++) {
  const veri = await page.evaluate(({ alt }) => {
    const L = window.__barut;
    for (let k = 0; k < alt; k++) {
      window.__bot();
      L.ilerlet(1 / 60);
    }
    return document.querySelector('canvas').toDataURL('image/png');
  }, { alt });
  writeFileSync(`${klasor}/k${String(i + 1).padStart(4, '0')}.png`, Buffer.from(veri.split(',')[1], 'base64'));
}
const ozet = await page.evaluate(() => {
  const d = window.__barut.dunya;
  return { t: Math.round(d.zaman), skor: d.skor, dalga: d.dalga, can: Math.round(d.heli.can), siper: Math.round(d.siperCan), olu: d.olu, neden: d.bitisNeden, durum: window.__barut.arayuz.durum };
});
await browser.close();
for (const l of logs) console.log(l);
console.log(JSON.stringify(ozet));
