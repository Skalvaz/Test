/**
 * EBRULİ oynanış duman testi (Playwright, gerçek tarayıcı) — P0 iskeleti.
 *
 *   npx vite --port 5190 --strictPort        (ya da tek dosya: file://…/ebruli.html)
 *   node scripts/oynanis.mjs [url] [çıktı-klasörü] [profil]
 *
 * Profiller: telefon 390×844 (dokunmatik), kucuk 360×640 (dokunmatik),
 * masaustu 1280×800 (fare). pageerror ya da console.error → başarısız
 * (çıkış kodu 1).
 *
 * P0 akışı: açılış → yedek ekran gizli mi → test kancası `window.__ebruli`
 * (`ekran()`, `boyut()`, `yaziHazir()`) → ekran görüntüsü. Uygulama paketi
 * (P-app) akışı GDD §13.6'ya göre genişletir: açılış → bölüm 1 öğretimi
 * (zorunlu ilk hamle GERÇEK dokunmatik sürüklemeyle) → bot ile 1–3, 5, 10 →
 * kazandın (kâğıt çekme, tablo) / kaybettin (Tekrar dene < 1 sn) → atölye
 * haritası → galeri → ayarlar → nasıl oynanır → deneme sonu ekranı.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = process.argv[3] || 'playtest-output';
const SADECE = process.argv[4] || '';
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(OUT, { recursive: true });

const PROFILLER = [
  { ad: 'telefon', w: 390, h: 844, dokunmatik: true },
  { ad: 'kucuk', w: 360, h: 640, dokunmatik: true },
  { ad: 'masaustu', w: 1280, h: 800, dokunmatik: false },
].filter((p) => !SADECE || p.ad === SADECE);

const hatalar = [];

async function bekleKosul(page, fn, sure = 15000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    const ok = await page.evaluate(fn).catch(() => false);
    if (ok) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama || fn.toString()}`);
    await page.waitForTimeout(80);
  }
}

async function profilKos(browser, p) {
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: 2,
    isMobile: p.dokunmatik,
    hasTouch: p.dokunmatik,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hatalar.push(`[${p.ad}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`[${p.ad}] console.error: ${m.text()}`);
  });
  const dir = join(OUT, p.ad);
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  await page.goto(URL);
  await bekleKosul(page, () => window.__ebruliAcildi === true, 15000, 'paket çalıştı');
  await bekleKosul(page, () => typeof window.__ebruli?.ekran === 'function', 15000, 'test kancası');
  await page.evaluate(() => window.__ebruli.yaziHazir?.());
  const yedekGorunur = await page.evaluate(() => getComputedStyle(document.getElementById('jsyok')).display !== 'none');
  if (yedekGorunur) hatalar.push(`[${p.ad}] yedek ekran görünür`);
  const ekran = await page.evaluate(() => window.__ebruli.ekran());
  const boyut = await page.evaluate(() => window.__ebruli.boyut?.());
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(dir, '01-acilis.png') });
  console.log(`[${p.ad}] ekran=${ekran} boyut=${JSON.stringify(boyut)} açılış ${Date.now() - t0} ms`);
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
try {
  for (const p of PROFILLER) await profilKos(browser, p);
} catch (e) {
  hatalar.push(`akış: ${e.message}`);
} finally {
  await browser.close();
}
if (hatalar.length) {
  console.error('BAŞARISIZ:\n' + hatalar.join('\n'));
  process.exit(1);
}
console.log(`tamam: ${PROFILLER.length} profil, çıktı ${OUT}/`);
