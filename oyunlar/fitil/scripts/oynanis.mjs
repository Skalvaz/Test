/**
 * FİTİL oynanış duman testi (Playwright, gerçek tarayıcı).
 *
 *   npx vite --port 5185 --strictPort          (ya da: npm run build && npx vite preview --port 4185)
 *   node scripts/oynanis.mjs [url] [çıktı-klasörü] [profil]
 *
 * Varsayılan url http://127.0.0.1:5173/, çıktı playtest-output/, profil
 * hepsi ('telefon' | 'masaustu' | 'kucuk' ile tek profil). `file://…/fitil.html`
 * de verilebilir (tek dosya sürümü).
 *
 * Profiller:
 *  - telefon  390×844, dokunmatik (CDP Input.dispatchTouchEvent ile gerçek sürükleme)
 *  - masaustu 1280×800, fare
 *  - kucuk    360×640, dokunmatik (yalnız açılış, bölüm 1, harita, ayarlar)
 *  - goc      390×700, dokunmatik: yayındaki şema 2 sürümünün gerçek kaydı
 *             (src/meta/_test/kayitlar/sema2-bolum14.json, localStorage olduğu
 *             gibi) yüklenir → göç denetimi (yıldız/rozet/defter aynen) →
 *             "Fener Koyu seni bekliyordu" balonu → Kasaba paneli → İskele'nin
 *             6 işi (son iş Mahalle şenliği + kasaba kartı) → 15. bölüm kazancı
 *             (mühür satırı, kandil çipi) → `kayitYama` ile şema 2 kaydı (27).
 *  - goc600   375×600: aynı denetim 27. bölüme kadar oynanmış kayıtla (panel,
 *             Kazandın kısa ekranda).
 *
 * Kanca adımları (telefon/masaüstü): 3. bölüm kazancından sonra ilk kandil
 * balonu → Kasaba paneli → ilk iş (kıvılcımlar, ışıklar, sakin balonu); 6.
 * bölüm Kazandın'da mühür tanıtımı; 7. bölüm kartında mühür bloğu ve oyunda
 * mühür rozeti/uçuşu.
 *
 * Akış: açılış → Bölüm 1 (öğretim; zorunlu ilk hamle GERÇEK sürüklemeyle)
 * → bot ile 1, 2, 5, 6, 10 (kazanç ya da kayıp) → Kazandın / Kaybettin
 * (Tekrar dene < 1 sn ölçülür) → harita → ayarlar → Fişek Defteri →
 * Günün Şenliği (üretim + bölüm başlangıcı). Her aşamada ekran görüntüsü.
 * pageerror ya da console.error → başarısız (çıkış kodu 1).
 *
 * Test kancası: window.__fitil (src/app/uygulama.ts testKancasi).
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:5173/';
const OUT = process.argv[3] || 'playtest-output';
const SADECE = process.argv[4] || '';
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
mkdirSync(OUT, { recursive: true });

const PROFILLER = [
  { ad: 'telefon', w: 390, h: 844, dokunmatik: true, tam: true },
  { ad: 'masaustu', w: 1280, h: 800, dokunmatik: false, tam: true },
  { ad: 'kucuk', w: 360, h: 640, dokunmatik: true, tam: false },
  { ad: 'goc', w: 390, h: 700, dokunmatik: true, tam: false, goc: 'sema2-bolum14.json' },
  { ad: 'goc600', w: 375, h: 600, dokunmatik: true, tam: false, goc: 'sema2-bolum27.json' },
].filter((p) => (SADECE ? SADECE.split(',').includes(p.ad) : !p.goc));

const KAYIT_KLASORU = new globalThis.URL('../src/meta/_test/kayitlar/', import.meta.url);
const eskiKayit = (ad) => JSON.parse(readFileSync(new globalThis.URL(ad, KAYIT_KLASORU), 'utf-8'));

const hatalar = [];
const notlar = [];

function not(m) {
  notlar.push(m);
  console.log(m);
}

async function bekleKosul(page, fn, arg, sure = 30000, aciklama = '') {
  const son = Date.now() + sure;
  for (;;) {
    const ok = await page.evaluate(fn, arg).catch(() => false);
    if (ok) return true;
    if (Date.now() > son) throw new Error(`zaman aşımı: ${aciklama || fn.toString()}`);
    await page.waitForTimeout(80);
  }
}

const ekran = (page) => page.evaluate(() => window.__fitil?.ekran?.() ?? 'yok');

async function profilKos(browser, p) {
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: 2,
    isMobile: p.dokunmatik,
    hasTouch: p.dokunmatik,
  });
  // Göç profili: yayındaki şema 2 sürümünün localStorage'ı sayfa açılmadan kurulur (yalnız ilk açılışta).
  if (p.goc) {
    const ls = eskiKayit(p.goc).localStorage;
    await ctx.addInitScript((veri) => {
      try {
        if (!localStorage.getItem('fitil.kayit.v1')) for (const [a, d] of Object.entries(veri)) localStorage.setItem(a, d);
      } catch {
        /* yok */
      }
    }, ls);
  }
  const page = await ctx.newPage();
  const dir = join(OUT, p.ad);
  mkdirSync(dir, { recursive: true });
  let sira = 0;
  const kare = async (ad) => {
    sira++;
    const yol = join(dir, `${String(sira).padStart(2, '0')}-${ad}.png`);
    await page.screenshot({ path: yol });
    return yol;
  };
  page.on('pageerror', (e) => hatalar.push(`[${p.ad}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`[${p.ad}] console.error: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('fonts.g')) hatalar.push(`[${p.ad}] HTTP ${r.status()} ${r.url()}`);
  });
  const cdp = p.dokunmatik ? await ctx.newCDPSession(page) : null;
  const dokun = async (x, y) => {
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      await page.waitForTimeout(40);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else await page.mouse.click(x, y);
  };
  /** Hücre yolunu gerçek işaretçiyle çiz (dokunmatikte touch, masaüstünde fare). */
  const surukle = async (hucreler) => {
    const g = await page.evaluate(() => window.__fitil.geometri());
    const pt = hucreler.map(([x, y]) => ({ x: g.x + (x + 0.5) * g.hucre, y: g.y + (y + 0.5) * g.hucre }));
    const bas = async (q) => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }) : (await page.mouse.move(q.x, q.y), page.mouse.down()));
    const git = (q) => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x, y: q.y, id: 1 }] }) : page.mouse.move(q.x, q.y));
    const birak = () => (cdp ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) : page.mouse.up());
    await bas(pt[0]);
    for (let i = 1; i < pt.length; i++) {
      for (let k = 1; k <= 6; k++) {
        await git({ x: pt[i - 1].x + ((pt[i].x - pt[i - 1].x) * k) / 6, y: pt[i - 1].y + ((pt[i].y - pt[i - 1].y) * k) / 6 });
        await page.waitForTimeout(14);
      }
    }
    await page.waitForTimeout(60);
    await birak();
  };
  const dugme = (ad) => page.getByRole('button', { name: ad, exact: true }).first();

  /** Bölümü bot ile sonuna kadar oyna; Kazandın ya da Kaybettin ekranında döner. */
  const botlaBitir = async (etiket, bot = 'usta') => {
    for (let i = 0; i < 60; i++) {
      const e = await ekran(page);
      if (e === 'kazandin' || e === 'kaybettin') break;
      if (e !== 'oyun') {
        await page.waitForTimeout(150);
        continue;
      }
      await page.evaluate((b) => window.__fitil.botHamle(b), bot);
    }
    await bekleKosul(page, () => ['kazandin', 'kaybettin'].includes(window.__fitil.ekran()), null, 60000, `${etiket} sonuç ekranı`);
    await page.waitForTimeout(2300);
    const e = await ekran(page);
    const d = await page.evaluate(() => window.__fitil.durum());
    not(`[${p.ad}] ${etiket}: ${e} (puan ${d.puan}, kalan ${d.kalanHamle}, hamle ${d.hamleNo})`);
    await kare(`${etiket}-${e}`);
    return e;
  };

  /** Sonuç ekranından haritaya (kazançta Devam + otomatik kart kapatılır). */
  const haritayaDon = async () => {
    const e = await ekran(page);
    if (e === 'kazandin') await dugme('Devam').click();
    else if (e === 'kaybettin') await dugme('Haritaya dön').click();
    await bekleKosul(page, () => ['harita', 'bolumOncesi', 'defterKarti'].includes(window.__fitil.ekran()), null, 20000, 'harita');
    for (let i = 0; i < 20; i++) {
      const s = await ekran(page);
      if (s === 'mahalleSovu') {
        await page.waitForTimeout(150);
        await kare('mahalle-sovu');
        await page.waitForTimeout(500);
        continue;
      }
      if (s === 'defterKarti') {
        await kare('defter-karti');
        await dugme('Devam').click();
      } else if (s === 'bolumOncesi') {
        await dugme('Kapat').click();
      } else if (s === 'harita') {
        await page.waitForTimeout(1700);
        if ((await ekran(page)) === 'harita') break;
      }
      await page.waitForTimeout(300);
    }
  };

  /**
   * (Kancalar §C.1) Kasaba düğmesi → panel → ilk "Yap" → kutlama (kıvılcım, ışıklar, sakin) ve şenlik/kart.
   * Kandil sıradaki işe yetiyorsa panel kutlamadan sonra kendiliğinden yeniden açılır: açık panel
   * sonraki çağrıda doğrudan kullanılır; işler bitince `kasabaPaneliKapat`.
   */
  const kasabaPaneliAcik = () => page.evaluate(() => window.__fitil.ekran() === 'kasaba' && !!document.querySelector('.f-kasaba-modal.f-giris'));
  const kasabaPaneliKapat = async () => {
    if (!(await kasabaPaneliAcik())) return;
    await page.locator('.f-ks-kapat').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'harita' && !document.querySelector('.f-kasaba-modal'), null, 8000, 'Kasaba paneli kapandı');
  };
  const kasabaIsYap = async (etiket, kareler = true) => {
    const acik = await kasabaPaneliAcik();
    if (!acik) await bekleKosul(page, () => window.__fitil.ekran() === 'harita' && !!document.querySelector('.f-harita-kasaba:not([hidden])'), null, 15000, 'Kasaba düğmesi');
    const once = await page.evaluate(() => window.__fitil.kayit().kasaba.isler.length);
    if (!acik) await page.locator('.f-harita-kasaba').click();
    await bekleKosul(page, () => !!document.querySelector('.f-kasaba-modal.f-giris'), null, 8000, 'Kasaba paneli');
    await page.waitForTimeout(450);
    if (kareler) await kare(`${etiket}-panel`);
    const yap = page.locator('.f-ks-yap').first();
    if (!(await yap.count())) {
      hatalar.push(`[${p.ad}] ${etiket}: yapılabilir iş yok`);
      await page.keyboard.press('Escape');
      return false;
    }
    await yap.click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'kasabaKutlama', null, 8000, 'kasaba kutlaması');
    if (kareler) {
      await page.waitForTimeout(900);
      await kare(`${etiket}-kiviclim`);
      await page.waitForTimeout(800);
      await kare(`${etiket}-isiklar`);
      await page.waitForTimeout(900);
      await kare(`${etiket}-sakin`);
    }
    const sonra = await page.evaluate(() => window.__fitil.kayit().kasaba.isler.length);
    if (sonra !== once + 1) hatalar.push(`[${p.ad}] ${etiket}: iş kayda geçmedi (${once} → ${sonra})`);
    // Kutlama (ve gerekiyorsa şenlik + kasaba kartı) bitene kadar.
    for (let i = 0; i < 80; i++) {
      const e = await ekran(page);
      if (e === 'defterKarti') {
        await page.waitForTimeout(500);
        await kare(`${etiket}-kasaba-karti`);
        await dugme('Devam').click();
        await page.waitForTimeout(500);
        continue;
      }
      if (e === 'harita' || e === 'kasaba') break;
      if (i === 12 && (await page.locator('.f-senlik-bant').count())) await kare(`${etiket}-senlik`);
      await page.waitForTimeout(250);
    }
    await bekleKosul(page, () => window.__fitil.ekran() === 'harita' || window.__fitil.ekran() === 'kasaba', null, 20000, 'kutlamadan haritaya');
    // Kandil sıradaki işe yetiyorsa panel kutlamadan ~1,4 sn sonra kendiliğinden açılır: bekle (en çok 4 sn).
    await bekleKosul(page, () => window.__fitil.ekran() === 'kasaba' && !!document.querySelector('.f-kasaba-modal.f-giris'), null, 4000, 'panel yeniden').catch(() => undefined);
    await page.waitForTimeout(400);
    return true;
  };

  // ── 0. Göç profili (yayındaki şema 2 kaydı)
  if (p.goc) {
    const eski = JSON.parse(eskiKayit(p.goc).localStorage['fitil.kayit.v1']).data;
    await page.goto(URL);
    await page.waitForSelector('.f-acilis', { timeout: 20000 });
    await page.waitForTimeout(1500);
    await dokun(p.w / 2, p.h * 0.72);
    await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'göç: harita');
    const k = await page.evaluate(() => window.__fitil.kayit());
    const yildiz = (x) => Object.values(x.bolumler).reduce((a, b) => a + b.yildiz, 0);
    if (k.surum !== 3) hatalar.push(`[${p.ad}] göç: şema ${k.surum}`);
    if (yildiz(k) !== yildiz(eski)) hatalar.push(`[${p.ad}] göç: yıldız ${yildiz(eski)} → ${yildiz(k)}`);
    if (JSON.stringify(k.rozetler) !== JSON.stringify(eski.rozetler)) hatalar.push(`[${p.ad}] göç: rozetler değişti`);
    if (JSON.stringify(k.koleksiyon) !== JSON.stringify(eski.koleksiyon)) hatalar.push(`[${p.ad}] göç: koleksiyon/defter değişti`);
    if (JSON.stringify(k.istatistik) !== JSON.stringify(eski.istatistik)) hatalar.push(`[${p.ad}] göç: istatistik değişti`);
    if (Object.values(k.bolumler).some((b) => b.muhur)) hatalar.push(`[${p.ad}] göç: mühür geriye dönük verildi`);
    not(`[${p.ad}] göç: şema ${eski.surum} → ${k.surum}, ${yildiz(k)}★, ${k.rozetler.length} rozet, kartlar ${k.koleksiyon.kartlar.join(',')}`);
    await page.waitForTimeout(900);
    const balon = await page.locator('.f-harita-balon').count();
    if (!balon) hatalar.push(`[${p.ad}] göç: "Fener Koyu seni bekliyordu" balonu yok`);
    await kare('goc-harita-balon');
    await page.waitForTimeout(3800);
    // Kasaba: ilk iş kareli, sonra İskele'nin geri kalanı (6. iş: Mahalle şenliği + kasaba kartı).
    await kasabaIsYap('kasaba1');
    for (let i = 2; i <= 6; i++) await kasabaIsYap(`kasaba${i}`, i === 6);
    // 6. işten sonra kandil Çarşı'ya yetiyor: panel kendiliğinden yeniden açılmış olmalı (§C.1).
    if (!(await kasabaPaneliAcik())) hatalar.push(`[${p.ad}] kandil yettiği halde Kasaba paneli kendiliğinden yeniden açılmadı`);
    else await kare('kasaba-yeniden-acildi');
    await kasabaPaneliKapat();
    await page.waitForTimeout(800);
    await kare('kasaba-iskele-tamam');
    const kk = await page.evaluate(() => window.__fitil.kayit());
    if (!kk.koleksiyon.kartlar.includes('kasaba:iskele')) hatalar.push(`[${p.ad}] kasaba:iskele kartı verilmedi`);
    // Sıradaki bölüm: mühür bloğu (bölüm öncesi), oyunda rozet, Kazandın'da mühür satırı + kandil çipi.
    const sira = Object.keys(kk.bolumler).map(Number).filter((x) => x <= 40).reduce((a, b) => Math.max(a, b), 0) + 1;
    await page.locator(`.f-dugum[data-id="${sira}"]`).click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 10000, 'bölüm öncesi');
    await page.waitForTimeout(800);
    if (!(await page.locator('.f-bo-muhurler').count())) hatalar.push(`[${p.ad}] b${sira} kartında mühür bloğu yok`);
    await kare(`b${sira}-karti-muhur`);
    await dugme('Oyna').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'oyun', null, 10000, 'oyun');
    await page.waitForTimeout(800);
    if (!(await page.locator('.f-muhur-rozet').count())) hatalar.push(`[${p.ad}] HUD'da mühür rozeti yok`);
    await kare(`b${sira}-hud-rozet`);
    await page.evaluate(() => window.__fitil.hizli(true));
    const s = await botlaBitir(`b${sira}-usta`);
    if (s === 'kazandin') {
      await page.waitForTimeout(1800);
      if (!(await page.locator('.f-kz-muhurler').count())) hatalar.push(`[${p.ad}] Kazandın'da mühür satırı yok`);
      await kare(`b${sira}-kazandin-muhur-kandil`);
    }
    // `kayitYama` ile şema 2 kaydı: gerçek göç yolundan geçer.
    const eski27 = JSON.parse(eskiKayit('sema2-bolum27.json').localStorage['fitil.kayit.v1']).data;
    const r = await page.evaluate((y) => window.__fitil.kayitYama(y), eski27);
    const k27 = await page.evaluate(() => window.__fitil.kayit());
    if (k27.surum !== 3 || yildiz(k27) !== yildiz(eski27) || JSON.stringify(k27.koleksiyon) !== JSON.stringify(eski27.koleksiyon)) hatalar.push(`[${p.ad}] kayitYama göçü bozuk`);
    not(`[${p.ad}] kayitYama şema 2 → 3: göçler ${JSON.stringify(r?.gocler)}, onarılan ${JSON.stringify(r?.onarilan)}`);
    await ctx.close();
    return;
  }

  // ── 1. Açılış
  await page.goto(URL);
  await page.waitForSelector('.f-acilis', { timeout: 20000 });
  await page.waitForTimeout(1800);
  await kare('acilis');
  await dokun(p.w / 2, p.h * 0.72);
  await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 1, null, 15000, 'bölüm 1 açıldı');
  await page.waitForTimeout(1200);
  await kare('bolum1-ogretim');

  // ── 2. Bölüm 1: zorunlu ilk hamle gerçek sürüklemeyle
  const og = await page.evaluate(() => window.__fitil.ogretim());
  if (!og.zorunlu || !og.el) hatalar.push(`[${p.ad}] bölüm 1 zorunlu ilk hamle/el yolu yok`);
  // Önce zorunlu kümenin DIŞINDAN başlamayı dene: kabul edilmemeli.
  await surukle([[4, 5], [4, 4], [4, 3]]);
  await page.waitForTimeout(500);
  const d0 = await page.evaluate(() => window.__fitil.durum());
  if (d0.hamleNo !== 0) hatalar.push(`[${p.ad}] zorunlu küme dışından hamle kabul edildi`);
  await surukle(og.el);
  await page.waitForTimeout(450);
  await kare('bolum1-oynatma');
  await bekleKosul(page, () => window.__fitil.durum().hamleNo === 1 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'ilk hamle oynatıldı');
  await page.waitForTimeout(600);
  await kare('bolum1-ilk-hamle-sonrasi');

  if (!p.tam) {
    await page.evaluate(() => window.__fitil.hizli(true));
    await botlaBitir('b1');
    await haritayaDon();
    await kare('harita');
    await dugme('Ayarlar').click();
    await page.waitForTimeout(700);
    await kare('ayarlar');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await ctx.close();
    return;
  }

  // ── 3. Bölüm 1'i bot ile bitir
  await page.evaluate(() => window.__fitil.hizli(true));
  const s1 = await botlaBitir('b1');
  if (s1 === 'kazandin') {
    await dugme('Devam').click();
    await page.waitForTimeout(900);
    await kare('harita-fitil');
    await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 15000, 'otomatik bölüm 2 kartı');
    await page.waitForTimeout(700);
    await kare('bolum2-karti');
    await dugme('Kapat').click();
    await page.waitForTimeout(600);
  } else await haritayaDon();

  // ── 4. Bot ile diğer bölümler
  let tekrarOlculdu = false;
  // 1–5 kazanılınca İskele tamamlanır (mahalle şovu + defter kartı); 10'da Acemi botla kayıp denenir.
  const PLAN = [[2, 'usta'], [3, 'usta'], [4, 'usta'], [5, 'usta'], [6, 'usta'], [10, 'acemi'], [10, 'usta']];
  for (const [n, bot] of PLAN) {
    await page.evaluate((id) => window.__fitil.bolumAc(id), n);
    await bekleKosul(page, (id) => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === id, n, 20000, `bölüm ${n} açıldı`);
    await page.waitForTimeout(900);
    await kare(`b${n}-baslangic`);
    const s = await botlaBitir(`b${n}-${bot}`, bot);
    if (s === 'kaybettin' && !tekrarOlculdu) {
      tekrarOlculdu = true;
      const t0 = Date.now();
      await dugme('Tekrar dene').click();
      await bekleKosul(page, (id) => window.__fitil.ekran() === 'oyun' && window.__fitil.durum().oturum === 'bekliyor' && window.__fitil.durum().hamleNo === 0 && window.__fitil.bolum() === id, n, 5000, 'tekrar dene');
      const ms = Date.now() - t0;
      not(`[${p.ad}] Tekrar dene → yeni deneme: ${ms} ms`);
      if (ms > 1000) hatalar.push(`[${p.ad}] Tekrar dene 1 sn'den uzun sürdü (${ms} ms)`);
      await kare(`b${n}-tekrar`);
      continue;
    }
    if (s === 'kazandin' && n === 6) {
      // (Kancalar §C.5) Mühürlerin tanıtımı: yıldızlardan sonra mühür satırı + Kıvılcım Usta ipucu.
      await page.waitForTimeout(1500);
      if (!(await page.locator('.f-kz-muhurler').count())) hatalar.push(`[${p.ad}] b6 Kazandın'da mühür satırı yok`);
      await kare('b6-muhur-tanitim');
    }
    if (s === 'kazandin' && n === 3) {
      // (Kancalar §C.6) İlk kandil: haritada balon, Kasaba paneli, ilk iş kutlaması.
      await dugme('Devam').click();
      await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'b3 sonrası harita');
      await bekleKosul(page, () => !!document.querySelector('.f-harita-balon.f-giris'), null, 6000, 'ilk kandil balonu').catch(() => hatalar.push(`[${p.ad}] ilk kandil balonu yok`));
      await page.waitForTimeout(300);
      await kare('kasaba-ilk-balon');
      if ((await ekran(page)) === 'bolumOncesi') hatalar.push(`[${p.ad}] ilk kandil balonunda otomatik kart atlanmadı`);
      await kasabaIsYap('kasaba-ilk');
      await kasabaPaneliKapat();
      continue;
    }
    if (s === 'kazandin' && n === 5) {
      // Sandık dokun-aç
      const sandik = page.locator('.f-sandik').first();
      if (await sandik.count()) {
        await sandik.click();
        await page.waitForTimeout(900);
        await kare('b5-sandik-acildi');
      }
    }
    await haritayaDon();
  }

  // ── 4a. (Kancalar §C.2–§C.3) 7. bölüm: kartta mühür bloğu, oyunda rozet ve "tuttu" uçuşu.
  {
    await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita (b7)');
    await page.locator('.f-dugum[data-id="7"]').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 10000, 'b7 kartı');
    await page.waitForTimeout(800);
    if (!(await page.locator('.f-bo-muhurler').count())) hatalar.push(`[${p.ad}] b7 kartında mühür bloğu yok`);
    // Mühür tanıtımı ilk mühürlü kartta bir kez (b6 sonrası otomatik b7 kartında görülmüş olabilir).
    const muhurIpucuGoruldu = await page.evaluate(() => window.__fitil.kayit().ipuclari.gorulen.includes('muhur-kart'));
    if (!muhurIpucuGoruldu && !(await page.getByText('Her bölümde 3 mühür görevi var').count())) hatalar.push(`[${p.ad}] b7 kartında mühür tanıtımı yok`);
    await kare('b7-karti-muhur');
    await dugme('Oyna').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'oyun', null, 10000, 'b7 oyun');
    await page.waitForTimeout(700);
    if (!(await page.locator('.f-muhur-rozet').count())) hatalar.push(`[${p.ad}] b7 HUD'da mühür rozeti yok`);
    let ucusKaresi = false;
    for (let i = 0; i < 60; i++) {
      const e = await ekran(page);
      if (e === 'kazandin' || e === 'kaybettin') break;
      if (e !== 'oyun') {
        await page.waitForTimeout(150);
        continue;
      }
      await page.evaluate(() => window.__fitil.botHamle('usta'));
      if (!ucusKaresi && (await page.locator('.f-muhur-ucan, .f-muhur-etiket').count())) {
        ucusKaresi = true;
        await kare('b7-muhur-ucusu');
        await page.waitForTimeout(900);
        await kare('b7-muhur-rozet');
      }
    }
    if (!ucusKaresi) not(`[${p.ad}] b7: oyunda mühür tutmadı (uçuş karesi yok)`);
    const s7 = await botlaBitir('b7-usta');
    if (s7 === 'kazandin') {
      await page.waitForTimeout(1500);
      await kare('b7-kazandin-muhur');
    }
    await haritayaDon();
  }

  // ── 4b. Usta Bölümü ve Sonsuz Şenlik başlangıcı (yalnız telefon profilinde; üretim uzun sürebilir)
  if (p.ad === 'telefon') {
    await page.evaluate(() => window.__fitil.bolumAc(101));
    await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 101, null, 20000, 'Usta 1');
    await page.waitForTimeout(900);
    await kare('usta1');
    await page.evaluate(() => window.__fitil.ac('sonsuz'));
    await bekleKosul(page, () => ['bekleme', 'bolumOncesi'].includes(window.__fitil.ekran()), null, 20000, 'sonsuz bekleme');
    await page.waitForTimeout(600);
    await kare('sonsuz-hazirlaniyor');
    await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 180000, 'sonsuz bölüm üretildi');
    await page.waitForTimeout(700);
    await kare('sonsuz-karti');
    await dugme('Kapat').click();
    await page.waitForTimeout(800);
  }

  // ── 5. Harita, ayarlar, defter
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'harita');
  await page.waitForTimeout(800);
  await kare('harita');
  await dugme('Ayarlar').click();
  await page.waitForTimeout(800);
  await kare('ayarlar');
  // Ayar gerçekten etkili mi: renk paleti → renk körü, sonra geri.
  const renkKoru = page.getByRole('radio', { name: 'Renk körü' }).first();
  if (await renkKoru.count()) {
    await renkKoru.click();
    await page.waitForTimeout(700);
    const k = await page.evaluate(() => window.__fitil.kayit().ayarlar.palet);
    if (k !== 'renkKoru') hatalar.push(`[${p.ad}] palet ayarı kayda geçmedi (${k})`);
    await kare('ayarlar-renk-koru');
    await page.getByRole('radio', { name: 'Standart' }).first().click();
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await dugme('Fişek Defteri').click();
  await page.waitForTimeout(900);
  await kare('defter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // ── 6. Günün Şenliği (kilitliyse test kancasıyla açılır)
  await page.evaluate(() => window.__fitil.ac('gunluk'));
  await bekleKosul(page, () => window.__fitil.ekran() === 'gunluk', null, 10000, 'günlük ekranı');
  await page.waitForTimeout(900);
  await kare('gunluk');
  await dugme('Oyna').click();
  await page.waitForTimeout(700);
  if ((await ekran(page)) === 'bekleme') await kare('gunluk-hazirlaniyor');
  await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 120000, 'günlük bölüm üretildi');
  await page.waitForTimeout(700);
  await kare('gunluk-karti');
  await dugme('Oyna').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'oyun', null, 10000, 'günlük bölüm başladı');
  await page.waitForTimeout(900);
  await kare('gunluk-oyun');
  await page.evaluate(() => window.__fitil.botHamle());
  await page.waitForTimeout(400);
  // Duraklat menüsü
  await dugme('Duraklat').click();
  await page.waitForTimeout(700);
  await kare('duraklat');
  await dugme('Haritaya dön').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'gunluk' || window.__fitil.ekran() === 'harita', null, 10000, 'duraklat → harita');
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
