/**
 * FİTİL ilk dakikalar denetimi (docs/YAYIN.md aşama 1): yeni bir oyuncunun ilk
 * oturumunu (bölüm 1–10) gerçek hızda oynar ve araya giren her şeyi kaydeder:
 * Usta balonu, bant, bildirim (toast), harita balonu, modal/ekran (bölüm
 * kartı, Kazandın, Kaybettin, defter kartı, Kasaba…). Her öğe için metin,
 * kelime sayısı, bölüm ve zaman; sonunda süre tahmini (ölçülen süre + hamle
 * başına düşünme + okuma süresi) ve ölçüm özeti (`__fitil.olcum()`).
 *
 *   npx vite --port 5185 --strictPort
 *   node scripts/ilk-dakikalar.mjs [url] [çıktı-klasörü] [son-bölüm]
 *
 * Çıktı: `<klasör>/zaman-cizelgesi.json`, `<klasör>/rapor.md`, ekran
 * görüntüleri. Oyuncu gibi davranır: bölüm 1'in zorunlu ilk hamlesi gerçek
 * sürüklemeyle, sonra Acemi bot; kaybedince "Tekrar dene" (3 denemeden sonra
 * Usta bot), kazanınca "Devam", bölüm kartında "Oyna"; 3. bölümden sonra
 * kandil balonu Kasaba'yı gösterince bir iş yapılır.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:5185/';
const OUT = process.argv[3] || 'ilk-dakikalar-output';
const SON = Number(process.argv[4] || 10);
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(OUT, { recursive: true });

/** Varsayımlar: hamle başına düşünme (sn) ve okuma hızı (kelime/sn; yaşlı/gündelik oyuncu). */
const DUSUNME = 4;
const OKUMA = 2;

const hatalar = [];
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ locale: 'tr-TR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// Sayfaya gözlemci: araya giren öğeler eklendikçe kaydedilir; metin, öğe yaşadıkça güncellenir.
await ctx.addInitScript(() => {
  const SECICI = [
    ['balon', '.f-balon'],
    ['bant', '.f-bant'],
    ['toast', '.f-toast'],
    ['haritaBalon', '.f-harita-balon'],
    ['modal', '.f-modal'],
    ['kutlama', '.f-kutlama'],
  ];
  const kayit = [];
  window.__ilk = kayit;
  const metinAl = (el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  const ekle = (el) => {
    for (const [tur, s] of SECICI) {
      if (!el.matches?.(s)) continue;
      const g = { tur, sinif: el.className, t: Date.now(), bitis: null, ekran: window.__fitil?.ekran?.() ?? '', bolum: window.__fitil?.bolum?.() ?? null, metin: '' };
      kayit.push(g);
      const bak = () => {
        if (!el.isConnected) {
          g.bitis = g.bitis ?? Date.now();
          return;
        }
        const m = metinAl(el);
        if (m.length > g.metin.length) g.metin = m;
        setTimeout(bak, 250);
      };
      setTimeout(bak, 60);
      return;
    }
  };
  const basla = () =>
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) ekle(n);
    }).observe(document.body, { childList: true, subtree: true });
  if (document.body) basla();
  else document.addEventListener('DOMContentLoaded', basla);
});

const page = await ctx.newPage();
page.on('pageerror', (e) => hatalar.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') hatalar.push(`console.error: ${m.text()}`);
});
const cdp = await ctx.newCDPSession(page);
const W = 390;
const H = 844;
let sira = 0;
const kare = async (ad) => {
  sira++;
  await page.screenshot({ path: join(OUT, `${String(sira).padStart(2, '0')}-${ad}.png`) });
};
const ekran = () => page.evaluate(() => window.__fitil?.ekran?.() ?? 'yok');
async function bekleKosul(fn, arg, sure = 30000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    if (await page.evaluate(fn, arg).catch(() => false)) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama}`);
    await page.waitForTimeout(80);
  }
}
const dokun = async (x, y) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const surukle = async (hucreler) => {
  const g = await page.evaluate(() => window.__fitil.geometri());
  const pt = hucreler.map(([x, y]) => ({ x: g.x + (x + 0.5) * g.hucre, y: g.y + (y + 0.5) * g.hucre }));
  const git = (q, type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x: q.x, y: q.y, id: 1 }] });
  await git(pt[0], 'touchStart');
  for (let i = 1; i < pt.length; i++) {
    for (let k = 1; k <= 6; k++) {
      await git({ x: pt[i - 1].x + ((pt[i].x - pt[i - 1].x) * k) / 6, y: pt[i - 1].y + ((pt[i].y - pt[i - 1].y) * k) / 6 }, 'touchMove');
      await page.waitForTimeout(14);
    }
  }
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const dugme = (ad) => page.getByRole('button', { name: ad, exact: true }).first();
const dugmeVar = async (ad) => (await page.getByRole('button', { name: ad, exact: true }).count()) > 0;

const bolumler = [];
const t0 = Date.now();

// ── Açılış
await page.goto(URL);
await page.waitForSelector('.f-acilis', { timeout: 30000 });
await page.waitForTimeout(1800);
await kare('acilis');
await dokun(W / 2, H * 0.72);

let kasabaYapildi = false;
for (let id = 1; id <= SON; id++) {
  await bekleKosul((i) => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === i, id, 30000, `bölüm ${id} oyunu`);
  const bas = Date.now();
  const b = { id, basla: bas - t0, denemeler: [] };
  bolumler.push(b);
  await page.waitForTimeout(1500);
  await kare(`b${id}-basla`);
  let deneme = 0;
  for (;;) {
    deneme++;
    const dBas = Date.now();
    let hamle = 0;
    for (let i = 0; i < 80; i++) {
      const e = await ekran();
      if (e === 'kazandin' || e === 'kaybettin') break;
      if (e !== 'oyun') {
        await page.waitForTimeout(150);
        continue;
      }
      const d = await page.evaluate(() => window.__fitil.durum());
      if (d.oturum !== 'bekliyor') {
        await page.waitForTimeout(120);
        continue;
      }
      const og = await page.evaluate(() => window.__fitil.ogretim());
      if (og.zorunlu && og.el && d.hamleNo === 0) await surukle(og.el);
      else await page.evaluate((bot) => window.__fitil.botHamle(bot), deneme > 3 ? 'usta' : 'acemi');
      hamle++;
      if (hamle === 1) {
        await page.waitForTimeout(700);
        await kare(`b${id}-d${deneme}-ilk-hamle`);
      }
    }
    await bekleKosul(() => ['kazandin', 'kaybettin'].includes(window.__fitil.ekran()), null, 90000, `bölüm ${id} sonucu`);
    const sonuc = await ekran();
    // Sonuç ekranı animasyonları (yıldızlar, kandil, mühür) bitsin: oyuncu düğmeyi ancak o zaman görür.
    await page.waitForTimeout(3200);
    await kare(`b${id}-d${deneme}-${sonuc}`);
    b.denemeler.push({ sonuc, hamle, sure: Math.round((Date.now() - dBas) / 100) / 10 });
    if (sonuc === 'kazandin') {
      await dugme('Devam').click();
      break;
    }
    await dugme('Tekrar dene').click();
    await bekleKosul(() => window.__fitil.ekran() === 'oyun' || window.__fitil.ekran() === 'bolumOncesi', null, 20000, 'tekrar');
    if ((await ekran()) === 'bolumOncesi') await dugme('Oyna').click();
    await bekleKosul(() => window.__fitil.ekran() === 'oyun' && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'tekrar oyun');
  }
  b.sure = Math.round((Date.now() - bas) / 100) / 10;
  if (id === SON) break;

  // ── Kazandın → harita → sıradaki bölüm (oyuncunun karşılaştığı her şeyi geçerek)
  const sonrakiBas = Date.now();
  let haritaBos = 0;
  for (let i = 0; i < 200; i++) {
    const e = await ekran();
    if (e === 'oyun' && (await page.evaluate(() => window.__fitil.bolum())) === id + 1) break;
    if (e === 'defterKarti') {
      await page.waitForTimeout(900);
      await kare(`b${id}-sonra-defter-karti`);
      await dugme('Devam').click();
    } else if (e === 'bolumOncesi') {
      await page.waitForTimeout(900);
      await kare(`b${id + 1}-karti`);
      await dugme('Oyna').click();
    } else if (e === 'harita') {
      // Kandil Kasaba'ya yetiyorsa oyuncu balonu izleyip bir iş yapar (bir kez).
      const kasabaHazir = await page.evaluate(() => !!document.querySelector('.f-harita-kasaba:not([hidden])') && !!document.querySelector('.f-harita-balon'));
      if (!kasabaYapildi && kasabaHazir) {
        await page.waitForTimeout(1500);
        await kare(`b${id}-sonra-kandil-balonu`);
        await page.locator('.f-harita-kasaba').click();
        await bekleKosul(() => !!document.querySelector('.f-kasaba-modal.f-giris'), null, 8000, 'Kasaba paneli');
        await page.waitForTimeout(800);
        await kare('kasaba-panel');
        const yap = page.locator('.f-ks-yap').first();
        if (await yap.count()) {
          await yap.click();
          kasabaYapildi = true;
          await bekleKosul(() => window.__fitil.ekran() === 'harita' || window.__fitil.ekran() === 'kasaba', null, 30000, 'kasaba kutlaması');
          await page.waitForTimeout(1500);
          if ((await ekran()) === 'kasaba' && (await page.locator('.f-ks-kapat').count())) await page.locator('.f-ks-kapat').click();
        } else await page.keyboard.press('Escape');
        continue;
      }
      haritaBos++;
      // Kart kendiliğinden açılmadıysa (2,5 sn) oyuncu sıradaki düğüme dokunur.
      if (haritaBos > 10) {
        haritaBos = 0;
        await page.locator(`.f-dugum[data-id="${id + 1}"]`).click();
      }
    } else if (e === 'kasaba' && (await page.locator('.f-ks-kapat').count())) {
      await page.locator('.f-ks-kapat').click();
    } else if (e === 'kazandin' && (await dugmeVar('Devam'))) {
      await dugme('Devam').click();
    }
    await page.waitForTimeout(250);
  }
  b.sonraki = Math.round((Date.now() - sonrakiBas) / 100) / 10;
}
const toplam = Math.round((Date.now() - t0) / 1000);
await page.waitForTimeout(500);

const ham = await page.evaluate(() => window.__ilk);
const olcum = await page.evaluate(() => window.__fitil.olcum());
await browser.close();

// ── Rapor
const kelime = (m) => (m ? m.split(/\s+/).filter(Boolean).length : 0);
const ogeler = ham
  .filter((g) => g.tur !== 'kutlama')
  .map((g) => ({ ...g, t: Math.round((g.t - t0) / 100) / 10, kalma: g.bitis ? Math.round((g.bitis - g.t) / 100) / 10 : null, kelime: kelime(g.metin) }));
const kutlama = ham.filter((g) => g.tur === 'kutlama').length;
const hamleToplam = bolumler.reduce((a, b) => a + b.denemeler.reduce((x, d) => x + d.hamle, 0), 0);
const okunacak = ogeler.filter((g) => g.tur !== 'bant').reduce((a, g) => a + g.kelime, 0);
const tahmin = toplam + hamleToplam * DUSUNME + Math.round(okunacak / OKUMA);
const dk = (s) => `${Math.floor(s / 60)} dk ${String(s % 60).padStart(2, '0')} sn`;

const satirlar = [
  '# FİTİL ilk dakikalar denetimi',
  '',
  `Bölüm 1–${SON}, yeni oyuncu (390×844, tr). Ölçülen süre ${dk(toplam)} (bot hamleleri anında); tahmini gerçek süre ${dk(tahmin)} (hamle başına ${DUSUNME} sn düşünme + ${OKUMA} kelime/sn okuma).`,
  '',
  `- Hamle: ${hamleToplam}; araya giren öğe: ${ogeler.length} (balon ${ogeler.filter((g) => g.tur === 'balon').length}, modal/ekran ${ogeler.filter((g) => g.tur === 'modal').length}, bildirim ${ogeler.filter((g) => g.tur === 'toast').length}, harita balonu ${ogeler.filter((g) => g.tur === 'haritaBalon').length}, bant ${ogeler.filter((g) => g.tur === 'bant').length}); okunacak kelime ${okunacak}; tepki yazısı ${kutlama}.`,
  `- Ölçüm özeti: ilk oturumda en yüksek bölüm ${olcum.ozet.ilkOturumEnYuksek}, 5. bölüm kazancı ${olcum.ozet.bolum5Suresi ?? '—'} sn (bot hızında).`,
  '',
  '## Bölümler',
  '',
  '| Bölüm | Başlangıç | Denemeler | Bölüm süresi | Sonraki bölüme geçiş |',
  '|---|---|---|---|---|',
  ...bolumler.map((b) => `| ${b.id} | ${dk(Math.round(b.basla / 1000))} | ${b.denemeler.map((d) => `${d.sonuc === 'kazandin' ? 'K' : 'X'} ${d.hamle} hamle ${d.sure} sn`).join(', ')} | ${b.sure} sn | ${b.sonraki ?? '—'} sn |`),
  '',
  '## Araya girenler (sırayla)',
  '',
  '| t (sn) | Bölüm | Ekran | Tür | Kelime | Kalma (sn) | Metin |',
  '|---|---|---|---|---|---|---|',
  ...ogeler.map((g) => `| ${g.t} | ${g.bolum ?? ''} | ${g.ekran} | ${g.tur}${g.tur === 'modal' ? ` (${String(g.sinif).replace(/f-modal|f-seffaf|f-modal-alt|f-giris/g, '').trim()})` : ''} | ${g.kelime} | ${g.kalma ?? ''} | ${g.metin.replace(/\|/g, '/').slice(0, 220)} |`),
  '',
];
if (hatalar.length) satirlar.push('## Hatalar', '', ...hatalar.map((h) => `- ${h}`), '');
writeFileSync(join(OUT, 'rapor.md'), satirlar.join('\n'));
writeFileSync(join(OUT, 'zaman-cizelgesi.json'), JSON.stringify({ toplam, tahmin, hamleToplam, okunacak, bolumler, ogeler, olcum: olcum.ozet, hatalar }, null, 1));
console.log(satirlar.slice(0, 16).join('\n'));
if (hatalar.length) {
  console.error(hatalar.join('\n'));
  process.exitCode = 1;
}
