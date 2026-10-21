/**
 * İngilizce taraması (dev sunucusu açıkken): önizleme ekranlarını, kasaba
 * haritasını ve oyunun kendisini `?dil=en` ile açar, görünen metinde ve
 * aria-label'larda Türkçe kalıntı arar (Türkçe harfler + sık Türkçe
 * sözcükler; özel adlar beyaz listede).
 *   node scripts/dil-tara.mjs [taban-url] [çıktı-klasörü]
 * Varsayılan http://localhost:5173, dil-tarama/. Ekran başına görüntü
 * (<ekran>.png) ve rapor.json yazar; kalıntı varsa çıkış kodu 1.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const [taban = 'http://localhost:5173', cikti = 'dil-tarama'] = process.argv.slice(2);
mkdirSync(cikti, { recursive: true });

const EKRANLAR = [
  'acilis', 'harita', 'bolumOncesi', 'bolumOncesi&v=m', 'bolumOncesi&v=mi', 'hud', 'hud&v=muhur', 'ucus', 'kasaba', 'kasaba&ogretim=1', 'haritaBalon',
  'kasabaKarti&m=0', 'kasabaKarti&m=3', 'secim', 'duraklat', 'duraklat&v=m', 'kazandin', 'kazandin&v=m', 'kazandin&v=mt', 'kazandin&v=mk', 'kazandin&v=me',
  'kaybettin', 'ayarlar', 'nasil', 'defter', 'gunluk', 'istatistik', 'mola', 'defterKarti', 'sandik', 'balon', 'bant', 'kutlama', 'toast',
];

// Türkçe harfler ve harfsiz sık sözcükler (bütün sözcük, büyük/küçük harf duyarsız).
const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
const TR_SOZ = /\b(ve|bir|ile|icin|için|Devam|Kapat|Oyna|Yap|Tamam|Geri|hamle|Hamle|Kasaba|Mahalle|Bolum|Ayarlar|Yeni|Sandik|Puan|kandil|Kandil|Muhur|Usta|Kilitli|eksik|kalan|Tekrar|Kazandin|Kaybettin|Gunun|Defter|Fisek|Sonsuz|Coskun|yildiz|Yildiz|Ses|Muzik|Titresim)\b/;
// Özel adlar ve dil seçicisi.
const BEYAZ = [/Türkçe/, /FİTİL/, /Rıza/, /Nazlı/, /Hüsnü/, /Gülizar/, /Ayşe/, /Hıdırellez/i, /Nevruz/i];

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const hatalar = [];
page.on('pageerror', (e) => hatalar.push(e.message));

const metinler = () =>
  page.evaluate(() => {
    const out = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,svg defs')) continue;
      if (el.checkVisibility ? !el.checkVisibility({ visibilityProperty: true }) : getComputedStyle(el).visibility === 'hidden') continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (s) out.add(s);
    }
    for (const el of document.querySelectorAll('[aria-label],[title]')) {
      if (el.checkVisibility && !el.checkVisibility()) continue;
      const s = (el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
      if (s) out.add(`[aria] ${s}`);
    }
    return [...out];
  });

const kalinti = (s) => {
  let x = s;
  for (const b of BEYAZ) x = x.replace(new RegExp(b.source, `g${b.flags.replace('g', '')}`), '');
  return TR_HARF.test(x) || TR_SOZ.test(x);
};

const rapor = {};
let toplam = 0;
const tara = async (ad, url, bekle = 2200) => {
  if (url) await page.goto(url);
  await page.waitForTimeout(bekle);
  const bulgu = (await metinler()).filter(kalinti);
  rapor[ad] = bulgu;
  toplam += bulgu.length;
  await page.screenshot({ path: `${cikti}/${ad.replace(/[&=]/g, '_')}.png` });
  console.log(`${bulgu.length ? '✗' : '✓'} ${ad}${bulgu.length ? `  ${bulgu.slice(0, 6).join(' | ')}${bulgu.length > 6 ? ` … (+${bulgu.length - 6})` : ''}` : ''}`);
};

for (const e of EKRANLAR) await tara(e, `${taban}/dev/arayuz.html?ekran=${e}&dil=en`);
await tara('kasaba-harita', `${taban}/dev/kasaba.html?isler=yarim&simdiki=12&dil=en`, 3500);
// Oyunun kendisi: açılış → dokun → harita → bölüm kartı → ilk bölüm.
await page.goto(`${taban}/?dil=en`);
await page.evaluate(() => localStorage.clear());
await tara('oyun-acilis', `${taban}/?dil=en`, 3000);
await page.mouse.click(195, 600);
await page.waitForTimeout(3500);
await tara('oyun-sonrasi', null, 500);

writeFileSync(`${cikti}/rapor.json`, JSON.stringify(rapor, null, 1));
await browser.close();
for (const e of hatalar) console.log('[pageerror]', e);
console.log(`\n${Object.keys(rapor).length} ekran, ${toplam} Türkçe kalıntı. Görüntüler: ${cikti}/`);
process.exit(toplam || hatalar.length ? 1 : 0);
