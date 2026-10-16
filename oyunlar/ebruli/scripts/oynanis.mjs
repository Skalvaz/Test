/**
 * EBRULİ oynanış duman testi (Playwright, gerçek tarayıcı; GDD §13.6).
 *
 *   npx vite --port 5285 --strictPort          (ya da tek dosya: file://…/ebruli.html)
 *   node scripts/oynanis.mjs [url] [çıktı-klasörü] [profil]
 *
 * Profiller: telefon 390×844 (dokunmatik; CDP Input.dispatchTouchEvent ile
 * gerçek sürükleme), kucuk 360×640 (dokunmatik), masaustu 1280×800 (fare).
 *
 * Akış: açılış → Bölüm 1 öğretimi (zorunlu küme dışı sürükleme REDDEDİLMELİ;
 * zorunlu ilk hamle GERÇEK sürüklemeyle) → bot ile 1, 2, 3, 5, 10 →
 * kazandın (kâğıt çekme, tablo DOM'da ve boş değil, galeriye girdi) /
 * kaybettin (Tekrar dene < 1 sn; 3. kayıpta Usta'nın Eli; "Bu hamle
 * kazandırırdı" hayaleti) → harita →
 * bölüm öncesi → duraklat → galeri → ayarlar (palet kayda geçer) → nasıl
 * oynanır → deneme sonu. Her aşamada ekran görüntüsü. pageerror ya da
 * console.error → başarısız (çıkış kodu 1).
 *
 * Test kancası: window.__ebruli (src/app/uygulama.ts testKancasi).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:5285/';
const OUT = process.argv[3] || 'playtest-output';
const SADECE = process.argv[4] || '';
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(OUT, { recursive: true });

const PROFILLER = [
  { ad: 'telefon', w: 390, h: 844, dokunmatik: true, tam: true },
  { ad: 'kucuk', w: 360, h: 640, dokunmatik: true, tam: false },
  { ad: 'masaustu', w: 1280, h: 800, dokunmatik: false, tam: true },
].filter((p) => !SADECE || p.ad === SADECE);

const hatalar = [];
const notlar = [];
const not = (m) => {
  notlar.push(m);
  console.log(m);
};

async function bekleKosul(page, fn, arg, sure = 30000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    const ok = await page.evaluate(fn, arg).catch(() => false);
    if (ok) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama || fn.toString()}`);
    await page.waitForTimeout(60);
  }
}

const ekran = (page) => page.evaluate(() => window.__ebruli?.ekran?.() ?? 'yok');

async function profilKos(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2, isMobile: p.dokunmatik, hasTouch: p.dokunmatik });
  const page = await ctx.newPage();
  const dir = join(OUT, p.ad);
  mkdirSync(dir, { recursive: true });
  let sira = 0;
  const kare = async (ad) => {
    sira++;
    await page.screenshot({ path: join(dir, `${String(sira).padStart(2, '0')}-${ad}.png`) });
  };
  page.on('pageerror', (e) => hatalar.push(`[${p.ad}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`[${p.ad}] console.error: ${m.text()}`);
  });
  // Harici ağ isteği yok (her şey gömülü): sayfanın kendi kaynağı dışındaki her istek hatadır.
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    const yerel = URL.startsWith('file:') ? u.startsWith('file:') : new globalThis.URL(u).origin === new globalThis.URL(URL).origin;
    if (!yerel) hatalar.push(`[${p.ad}] harici istek: ${u}`);
  });
  const cdp = p.dokunmatik ? await ctx.newCDPSession(page) : null;
  const dokun = async (x, y) => {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.mouse.click(x, y);
  };
  /** Hücreden komşuya GERÇEK sürükleme (dokunmatikte touch, masaüstünde fare). */
  const surukle = async (a, b) => {
    const g = await page.evaluate(() => window.__ebruli.geometri());
    const P = ([x, y]) => ({ x: g.x + (x + 0.5) * g.hucre, y: g.y + (y + 0.5) * g.hucre });
    const s = P(a);
    const e = P(b);
    const bas = async (q) => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }) : (await page.mouse.move(q.x, q.y), page.mouse.down()));
    const git = (q) => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }) : page.mouse.move(q.x, q.y));
    const birak = () => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up());
    await bas(s);
    await page.waitForTimeout(60);
    for (let k = 1; k <= 8; k++) {
      await git({ x: s.x + ((e.x - s.x) * k) / 8, y: s.y + ((e.y - s.y) * k) / 8 });
      await page.waitForTimeout(18);
    }
    await page.waitForTimeout(80);
    await birak();
  };
  const dugme = (ad) => page.getByRole('button', { name: ad, exact: true }).first();

  /** Bölümü bot ile sonuna kadar oyna; Kazandın ya da Kaybettin ekranında döner. */
  const botlaBitir = async (etiket, bot = 'usta') => {
    for (let i = 0; i < 90; i++) {
      const e = await ekran(page);
      if (e !== 'oyun') {
        if (['kazandin', 'kaybettin'].includes(e)) break;
        if (e === 'kagitCekme') break;
        await page.waitForTimeout(120);
        continue;
      }
      await page.evaluate((b) => window.__ebruli.botHamle(b), bot);
      await page.waitForTimeout(30);
    }
    await bekleKosul(page, () => ['kazandin', 'kaybettin'].includes(window.__ebruli.ekran()), null, 60000, `${etiket} sonuç ekranı`);
    await page.waitForTimeout(1800);
    const e = await ekran(page);
    const d = await page.evaluate(() => window.__ebruli.durum());
    not(`[${p.ad}] ${etiket}: ${e} (puan ${d?.puan}, kalan ${d?.kalanHamle}, hamle ${d?.hamleNo})`);
    const f = await page.evaluate(() => window.__ebruli.cizici().fark);
    if (f) hatalar.push(`[${p.ad}] ${etiket}: görsel tahta ≠ durum (${f} fark)`);
    await kare(`${etiket}-${e}`);
    if (e === 'kazandin') {
      // Tablo DOM'da ve boş değil.
      const dolu = await page.evaluate(() => {
        const t = document.querySelector('.e-kz-tablo');
        if (!t) return false;
        const c = t.getContext('2d');
        const d = c.getImageData(Math.floor(t.width / 2), Math.floor(t.height / 2), 6, 6).data;
        let s = 0;
        for (let i = 3; i < d.length; i += 4) s += d[i];
        return s > 0;
      });
      if (!dolu) hatalar.push(`[${p.ad}] ${etiket}: kazandın tablosu boş`);
    }
    return e;
  };

  // ── 1. Açılış
  await page.goto(URL);
  await page.waitForSelector('.e-acilis', { timeout: 20000 });
  const yedek = await page.evaluate(() => getComputedStyle(document.getElementById('jsyok')).display);
  if (yedek !== 'none') hatalar.push(`[${p.ad}] yedek ekran görünüyor (${yedek})`);
  await page.waitForTimeout(1900);
  await kare('acilis');
  await dokun(p.w / 2, p.h * 0.72);
  await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 1, null, 15000, 'bölüm 1 açıldı');
  await page.waitForTimeout(1300);
  await kare('bolum1-ogretim');

  // ── 2. Bölüm 1: zorunlu ilk hamle gerçek sürüklemeyle
  const og = await page.evaluate(() => window.__ebruli.ogretim());
  if (!og.zorunlu || !og.el) hatalar.push(`[${p.ad}] bölüm 1 zorunlu ilk hamle/el yolu yok`);
  if (!og.balon) hatalar.push(`[${p.ad}] bölüm 1 Usta balonu görünmüyor`);
  await surukle([0, 4], [1, 4]);
  await page.waitForTimeout(500);
  const d0 = await page.evaluate(() => window.__ebruli.durum());
  if (d0.hamleNo !== 0) hatalar.push(`[${p.ad}] zorunlu küme dışından hamle kabul edildi`);
  // Önizleme: sürüklerken bırakmadan kare.
  const g = await page.evaluate(() => window.__ebruli.geometri());
  if (cdp && og.el) {
    const [a, b] = og.el;
    const ax = g.x + (a[0] + 0.5) * g.hucre;
    const ay = g.y + (a[1] + 0.5) * g.hucre;
    const bx = g.x + (b[0] + 0.5) * g.hucre;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay, id: 1 }] });
    for (let k = 1; k <= 6; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax + ((bx - ax) * k) / 7, y: ay, id: 1 }] });
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(250);
    await kare('bolum1-onizleme');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (og.el) await surukle(og.el[0], og.el[1]);
  await bekleKosul(page, () => window.__ebruli.durum().hamleNo === 1, null, 10000, 'ilk hamle kabul edildi');
  await page.waitForTimeout(260);
  await kare('bolum1-oynatma');
  await bekleKosul(page, () => window.__ebruli.durum().oturum === 'bekliyor' || window.__ebruli.ekran() !== 'oyun', null, 20000, 'ilk hamle oynatıldı');
  await page.waitForTimeout(500);
  await kare('bolum1-ilk-hamle-sonrasi');

  // ── 3. Bölüm 1'i bot ile bitir → kazandın → harita (sıradaki kart kendiliğinden)
  await page.evaluate(() => window.__ebruli.hizli(true));
  const s1 = await botlaBitir('b1');
  if (s1 !== 'kazandin') hatalar.push(`[${p.ad}] bölüm 1 kazanılmadı (öğretim)`);
  const k1 = await page.evaluate(() => window.__ebruli.kayit());
  if (!k1.bolumler['1']?.tablo) hatalar.push(`[${p.ad}] bölüm 1 tablosu galeriye girmedi`);
  if (s1 === 'kazandin') {
    await dugme('Devam').click();
    await bekleKosul(page, () => window.__ebruli.ekran() === 'bolumOncesi', null, 15000, 'harita + bölüm 2 kartı');
    await page.waitForTimeout(700);
    await kare('bolum2-karti');
    await dugme('Geri').click();
    await page.waitForTimeout(700);
    await kare('harita');
  }

  if (!p.tam) {
    await dugme('Ayarlar').click();
    await page.waitForTimeout(800);
    await kare('ayarlar');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__ebruli.bolumAc(6));
    await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 6, null, 15000, 'bölüm 6');
    await page.waitForTimeout(1200);
    await kare('b6');
    await botlaBitir('b6-acemi', 'acemi');
    await ctx.close();
    return;
  }

  // ── 4. Bot ile diğer bölümler; Bölüm 10'da Acemi ile kayıp ve Tekrar dene ölçümü
  let tekrarOlculdu = false;
  const PLAN = [
    [2, 'usta'],
    [3, 'usta'],
    [5, 'usta'],
    [10, 'acemi'],
    [10, 'usta'],
  ];
  for (const [n, bot] of PLAN) {
    await page.evaluate((id) => window.__ebruli.bolumAc(id), n);
    await bekleKosul(page, (id) => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === id, n, 20000, `bölüm ${n} açıldı`);
    await page.waitForTimeout(900);
    await kare(`b${n}-baslangic`);
    const s = await botlaBitir(`b${n}-${bot}`, bot);
    if (s === 'kaybettin' && !tekrarOlculdu) {
      tekrarOlculdu = true;
      // Süre sayfanın içinde ölçülür (düğmeye basıştan yeni denemenin girdi beklemesine); test aracının gecikmesi sayılmaz.
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Tekrar dene');
        b?.addEventListener('click', () => (window.__t0 = performance.now()), { capture: true });
      });
      const t0 = Date.now();
      await dugme('Tekrar dene').click();
      const ms = await page.evaluate(
        (id) =>
          new Promise((coz) => {
            const bak = () => {
              const d = window.__ebruli.durum();
              if (window.__ebruli.ekran() === 'oyun' && d?.oturum === 'bekliyor' && d.hamleNo === 0 && window.__ebruli.bolum() === id) coz(Math.round(performance.now() - window.__t0));
              else requestAnimationFrame(bak);
            };
            bak();
          }),
        n,
      );
      not(`[${p.ad}] Tekrar dene → yeni deneme: ${ms} ms (araç dahil ${Date.now() - t0} ms)`);
      if (ms > 1000) hatalar.push(`[${p.ad}] Tekrar dene 1 sn'den uzun sürdü (${ms} ms)`);
      await kare(`b${n}-tekrar`);
      continue;
    }
    if (s === 'kazandin') await dugme('Devam').click();
    else await dugme('Haritaya dön').click();
    await bekleKosul(page, () => ['harita', 'bolumOncesi', 'devami'].includes(window.__ebruli.ekran()), null, 20000, 'harita');
    if ((await ekran(page)) === 'bolumOncesi') await dugme('Geri').click();
    await page.waitForTimeout(500);
  }

  // ── 5. Usta'nın Eli (3. ardışık kayıp; yalnız telefon)
  if (p.ad === 'telefon') {
    await page.evaluate(() => {
      const k = window.__ebruli.kayit();
      k.bolumler['6'] = { ...(k.bolumler['6'] ?? { yildiz: 0, enIyi: 0, deneme: 0, kazanildi: false, tablo: null }), basarisizSeri: 2 };
      window.__ebruli.kayitYama({ bolumler: k.bolumler });
    });
    await page.evaluate(() => window.__ebruli.bolumAc(6));
    await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 6, null, 20000, 'bölüm 6');
    const s6 = await botlaBitir('b6-acemi', 'acemi');
    if (s6 === 'kaybettin') {
      const el = dugme('Devam et');
      if (!(await el.count())) hatalar.push(`[${p.ad}] 3. kayıpta Usta'nın Eli önerilmedi`);
      else {
        await el.click();
        await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.durum().oturum === 'bekliyor', null, 10000, "Usta'nın Eli devam");
        const d = await page.evaluate(() => window.__ebruli.durum());
        if (d.kalanHamle !== 5) hatalar.push(`[${p.ad}] Usta'nın Eli: kalan hamle ${d.kalanHamle} ≠ 5`);
        await page.waitForTimeout(600);
        await kare('b6-usta-eli');
      }
    }
  }

  // ── 5b. Yakın kaçış: hedefe yaklaşınca tek hamle bırakılır, Acemi kaybeder →
  // "Bu hamle kazandırırdı" hayaleti (yalnız telefon; bulunamazsa not düşülür).
  if (p.ad === 'telefon') {
    let bulundu = false;
    for (let deneme = 0; deneme < 6 && !bulundu; deneme++) {
      await page.evaluate(() => window.__ebruli.bolumAc(2));
      await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 2, null, 15000, 'bölüm 2 (hayalet)');
      await page.evaluate(() => window.__ebruli.hizli(true));
      for (let i = 0; i < 30; i++) {
        const d = await page.evaluate(() => window.__ebruli.durum());
        if (!d || d.bitti || (await ekran(page)) !== 'oyun') break;
        const il = d.hedefler.reduce((s, h) => s + Math.min(1, h.ilerleme / h.gerekli), 0) / d.hedefler.length;
        if (il >= 0.7 + deneme * 0.04 && d.hamleNo > 0) {
          await page.evaluate(() => window.__ebruli.kalanHamle(1));
          await page.evaluate(() => window.__ebruli.botHamle('acemi'));
          break;
        }
        await page.evaluate(() => window.__ebruli.botHamle('usta'));
      }
      await page.evaluate(() => window.__ebruli.hizli(false));
      await page.waitForTimeout(1600);
      bulundu = (await ekran(page)) === 'kaybettin' && (await page.evaluate(() => !!document.querySelector('.e-kb-hayalet.gor')));
    }
    if (bulundu) {
      await kare('kaybettin-hayalet');
      not(`[${p.ad}] "Bu hamle kazandırırdı" hayaleti görüldü`);
    } else not(`[${p.ad}] hayalet senaryosu kurulamadı (kazandıran hamle yoktu)`);
  }

  // ── 6. Duraklat
  await page.evaluate(() => window.__ebruli.bolumAc(2));
  await bekleKosul(page, () => window.__ebruli.ekran() === 'oyun' && window.__ebruli.bolum() === 2, null, 20000, 'bölüm 2');
  await page.evaluate(() => window.__ebruli.hizli(false));
  await page.waitForTimeout(800);
  await dugme('Duraklat').click();
  await bekleKosul(page, () => window.__ebruli.ekran() === 'duraklat', null, 5000, 'duraklat');
  await page.waitForTimeout(500);
  await kare('duraklat');
  await dugme('Haritaya dön').click();
  await bekleKosul(page, () => window.__ebruli.ekran() === 'harita', null, 10000, 'duraklat → harita');
  await page.waitForTimeout(900);
  await kare('harita-2');

  // ── 7. Galeri, ayarlar, nasıl oynanır, deneme sonu
  await dugme('Galeri').click();
  await bekleKosul(page, () => window.__ebruli.ekran() === 'galeri', null, 5000, 'galeri');
  await page.waitForTimeout(800);
  await kare('galeri');
  const kart = page.locator('.e-gkart.dolu').first();
  if (await kart.count()) {
    await kart.click();
    await page.waitForTimeout(800);
    await kare('galeri-tablo');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else hatalar.push(`[${p.ad}] galeride tablo yok`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await dugme('Ayarlar').click();
  await page.waitForTimeout(800);
  await kare('ayarlar');
  await page.getByRole('radio', { name: 'Renk körü' }).first().click();
  await page.waitForTimeout(700);
  const pal = await page.evaluate(() => window.__ebruli.kayit().ayarlar.palet);
  if (pal !== 'renkKoru') hatalar.push(`[${p.ad}] palet ayarı kayda geçmedi (${pal})`);
  await page.getByRole('radio', { name: 'Standart' }).first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await dugme('Nasıl oynanır').click();
  await page.waitForTimeout(900);
  await kare('nasil');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ebruli.ac('devami'));
  await bekleKosul(page, () => window.__ebruli.ekran() === 'devami', null, 5000, 'devamı yakında');
  await page.waitForTimeout(900);
  await kare('devami');
  await dugme('Haritaya dön').click();
  await page.waitForTimeout(500);
  await ctx.close();
}

const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const p of PROFILLER) {
  const t0 = Date.now();
  try {
    await profilKos(browser, p);
  } catch (e) {
    hatalar.push(`[${p.ad}] akış durdu: ${e.message}`);
  }
  not(`[${p.ad}] süre ${((Date.now() - t0) / 1000).toFixed(0)} sn`);
}
await browser.close();
if (hatalar.length) {
  console.log(`\nBAŞARISIZ (${hatalar.length}):`);
  for (const h of hatalar) console.log(' - ' + h);
  process.exit(1);
}
console.log(`\nTAMAM — görüntüler: ${OUT}`);
