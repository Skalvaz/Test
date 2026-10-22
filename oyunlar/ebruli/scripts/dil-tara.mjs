/**
 * İngilizce taraması (dev sunucusu ya da tek dosya): oyunu `?dil=en` ile açar,
 * test kancasıyla (`window.__ebruli`) ekranları sırayla gezer ve görünen
 * metinde/aria-label'larda Türkçe kalıntı arar (Türkçe harf + sık sözcük;
 * yer adları ve dil seçicisi beyaz listede).
 *   node scripts/dil-tara.mjs <url> [çıktı-klasörü]
 * Ekran başına görüntü ve rapor.json; kalıntı varsa çıkış kodu 1.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const [taban, cikti = 'dil-tarama'] = process.argv.slice(2);
mkdirSync(cikti, { recursive: true });
const url = `${taban}${taban.includes('?') ? '&' : '?'}dil=en`;

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
const TR_SOZ = /\b(ve|bir|ile|Devam|Kapat|Oyna|Tamam|Geri|hamle|Bölüm|Ayarlar|Galeri|Yeni|puan|kaldı|eksikti|Tekrar|Tablo|Hedefler)\b/;
const BEYAZ = [/Türkçe/g, /Üsküdar/g];

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ locale: 'tr-TR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const hatalar = [];
page.on('pageerror', (e) => hatalar.push(e.message));

const metinler = () =>
  page.evaluate(() => {
    const out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style')) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (s) out.add(s);
    }
    for (const el of document.querySelectorAll('[aria-label]')) {
      if (el.checkVisibility && !el.checkVisibility()) continue;
      out.add(`[aria] ${el.getAttribute('aria-label')}`);
    }
    return [...out];
  });
const kalinti = (s) => {
  let x = s;
  for (const b of BEYAZ) x = x.replace(b, '');
  return TR_HARF.test(x) || TR_SOZ.test(x);
};
const rapor = {};
let toplam = 0;
const tara = async (ad, bekle = 1200) => {
  await page.waitForTimeout(bekle);
  const b = (await metinler()).filter(kalinti);
  rapor[ad] = b;
  toplam += b.length;
  await page.screenshot({ path: `${cikti}/${ad}.png` });
  console.log(`${b.length ? '✗' : '✓'} ${ad}${b.length ? `  ${b.slice(0, 6).join(' | ')}` : ''}`);
};
const E = (js) => page.evaluate(js);

await page.goto(url);
await tara('acilis', 2500);
await page.mouse.click(195, 600);
await tara('harita', 3000);
await E(() => window.__ebruli.ac('ayarlar'));
await tara('ayarlar');
await page.keyboard.press('Escape');
await E(() => window.__ebruli.ac('nasil'));
await tara('nasil');
await page.keyboard.press('Escape');
await E(() => window.__ebruli.ac('galeri'));
await tara('galeri');
await page.keyboard.press('Escape');
await E(() => window.__ebruli.bolumAc(2));
await tara('oyun-b2', 2500);
await E(async () => {
  const e = window.__ebruli;
  e.hizli(true);
  for (let i = 0; i < 80 && e.ekran() === 'oyun'; i++) {
    await e.botHamle('usta');
    await new Promise((r) => setTimeout(r, 50));
  }
});
await tara('kazandin', 6000);
await E(() => window.__ebruli.bolumAc(6));
await page.waitForTimeout(2000);
await E(async () => {
  const e = window.__ebruli;
  e.hizli(true);
  for (let i = 0; i < 80 && e.ekran() === 'oyun'; i++) {
    await e.botHamle('acemi');
    await new Promise((r) => setTimeout(r, 50));
  }
});
await tara('oyun-sonu-b6', 4000);
await E(() => window.__ebruli.ac('devami'));
await tara('devami');

writeFileSync(`${cikti}/rapor.json`, JSON.stringify(rapor, null, 1));
await browser.close();
for (const e of hatalar) console.log('[pageerror]', e);
console.log(`\n${Object.keys(rapor).length} ekran, ${toplam} Türkçe kalıntı.`);
process.exit(toplam || hatalar.length ? 1 : 0);
