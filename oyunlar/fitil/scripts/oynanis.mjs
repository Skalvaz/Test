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
 *             "Hoş geldin, çırak! N kandilin birikmiş" balonu → Kasaba paneli → İskele'nin
 *             6 işi (son iş Mahalle şenliği + kasaba kartı) → 15. bölüm kazancı
 *             (mühür satırı, kandil çipi) → `kayitYama` ile şema 2 kaydı (27).
 *  - goc600   375×600: aynı denetim 27. bölüme kadar oynanmış kayıtla (panel,
 *             Kazandın kısa ekranda).
 *  - gelir    390×844, dokunmatik, `?gelir=sahte&reklam=hizli` (CAN-REKLAM §11;
 *             yalnız adıyla seçilince koşar): harita can hapı → kayıpta −1 can →
 *             reklamla +5 hamle → 1 canla kayıp → "Can bitti" paneli, üç reklam,
 *             "Yarın yine" → Mağaza (canları doldur, paket, Usta kartı) →
 *             "Ücretsiz +1 can" → Duraklat çıkış onayı (Vazgeç, Çık) → `?gelir`
 *             olmadan hiçbir gelir öğesi yok → §8 ölçüm olayları.
 *
 * Gelirsiz profillerde (web/claude.ai) can hapı, Mağaza satırı ve Kaybettin'de
 * can/reklam öğesi YOK denetlenir (CAN-REKLAM §1, C1).
 *
 * Kanca adımları (telefon/masaüstü): 3. bölüm kazancından sonra ilk kandil
 * balonu → Kasaba paneli → ilk iş (kıvılcımlar, ışıklar, sakin balonu); 6.
 * bölüm Kazandın'da mühür tanıtımı; 7. bölüm kartında mühür bloğu ve oyunda
 * mühür rozeti/uçuşu.
 *
 * Akış: açılış → Bölüm 1 (öğretim; zorunlu ilk hamle GERÇEK sürüklemeyle)
 * → bot ile 1, 2, 5, 6, 10 (kazanç ya da kayıp) → Kazandın / Kaybettin
 * (Tekrar dene < 1 sn ölçülür) → harita → ayarlar → Fişek Defteri →
 * Günün Şenliği (14. bölümden önce kilit metni ve kilitli U1; 11–14 `kayitYama`
 * ile kazanılınca üretim + bölüm başlangıcı). Her aşamada ekran görüntüsü.
 * pageerror ya da console.error → başarısız (çıkış kodu 1).
 *
 * Test kancası: window.__fitil (src/app/uygulama.ts testKancasi).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  { ad: 'gelir', w: 390, h: 844, dokunmatik: true, tam: false, gelir: true },
].filter((p) => (SADECE ? SADECE.split(',').includes(p.ad) : !p.goc && !p.gelir));

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
    locale: 'tr-TR',
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

  /** (CAN-REKLAM §1, C1) Sağlayıcı yokken hiçbir gelir öğesi görünmez. */
  const gelirsizDenetle = async (yer) => {
    const r = await page.evaluate(() => ({
      gelir: window.__fitil.gelir?.() ?? null,
      hap: document.querySelectorAll('.f-can-hap').length,
      magaza: document.querySelectorAll('.f-ay-magaza').length,
      kb: document.querySelectorAll('.f-kb-can, .f-kb-reklam, .f-kb-can-bitti').length,
      panel: document.querySelectorAll('.f-can-modal, .f-magaza-modal, .f-cikis-modal, .fs-kok').length,
    }));
    if (r.gelir !== null || r.hap || r.magaza || r.kb || r.panel) hatalar.push(`[${p.ad}] ${yer}: sağlayıcı yokken gelir öğesi görünüyor ${JSON.stringify(r)}`);
  };

  // ── 0a. Gelir profili (CAN-REKLAM §11; sahte sağlayıcı, hızlı reklam)
  if (p.gelir) {
    await gelirProfili({ page, p, kare, dokun, dugme, botlaBitir, haritayaDon });
    await ctx.close();
    return;
  }

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
    if (!balon) hatalar.push(`[${p.ad}] göç: kasaba hoş geldin balonu yok`);
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
    await gelirsizDenetle('harita');
    await dugme('Ayarlar').click();
    await page.waitForTimeout(700);
    await kare('ayarlar');
    await gelirsizDenetle('ayarlar');
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
    if (s === 'kaybettin') await gelirsizDenetle(`b${n} Kaybettin`);
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
      // (Kancalar §C.5) Mühürlerin tanıtımı: basılan mühür varsa yıldızlardan sonra mühür satırı;
      // hiçbiri basılmadıysa satır yok (açıklama 7. bölüm kartında).
      await page.waitForTimeout(1500);
      const basilan = await page.evaluate(() => window.__fitil.kayit().bolumler['6']?.muhur ?? 0);
      if (!!basilan !== (await page.locator('.f-kz-muhurler').count()) > 0) hatalar.push(`[${p.ad}] b6 Kazandın mühür satırı (basılan maske ${basilan})`);
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
  await gelirsizDenetle('harita');
  await dugme('Ayarlar').click();
  await page.waitForTimeout(800);
  await kare('ayarlar');
  await gelirsizDenetle('ayarlar');
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

  // ── 6. Günün Şenliği: 14. bölüm kazanılmadan kilitli (Ekim 2026; Usta Bölümleri de
  // 12'den önce). Kilit metinleri denetlenir, sonra 11–14 `kayitYama` ile kazanılmış
  // sayılır: günlük gerçek kilit yolundan açılır (test kancası Oyna'da kilidi atlatmaz).
  {
    const k6 = await page.evaluate(() => window.__fitil.kayit());
    if (!k6.bolumler['14']) {
      const hap = page.locator('.f-gunluk-hap');
      if (!(await hap.evaluate((e) => e.classList.contains('f-kilitli')))) hatalar.push(`[${p.ad}] Günün Şenliği 14. bölümden önce açık`);
      await hap.click();
      await page.waitForTimeout(400);
      const toast = await page.evaluate(() => [...document.querySelectorAll('.f-toast')].map((e) => e.textContent).join(' | '));
      if (!toast.includes('14. bölümden sonra açılır')) hatalar.push(`[${p.ad}] günlük kilit metni: "${toast}"`);
      await kare('gunluk-kilitli');
      const ana = Object.entries(k6.bolumler).filter(([id]) => +id <= 40).reduce((a, [, b]) => a + b.yildiz, 0);
      const ustaOynandi = Object.keys(k6.bolumler).some((id) => +id > 100 && +id < 200);
      if (!k6.bolumler['12'] && !ustaOynandi && ana >= 15) {
        const u1 = await page.locator('.f-usta-dugum').first().evaluate((e) => ({ acik: e.classList.contains('f-acik'), etiket: e.textContent }));
        if (u1.acik || !u1.etiket.includes('12. bölümden')) hatalar.push(`[${p.ad}] U1 12. bölümden önce: ${JSON.stringify(u1)}`);
      }
      const kb = { yildiz: 1, enIyi: 1000, deneme: 1, basarisizSeri: 0, kazanc: 1 };
      await page.evaluate((b) => window.__fitil.kayitYama({ bolumler: b }), { 11: kb, 12: kb, 13: kb, 14: kb });
      await page.waitForTimeout(2000);
    }
  }
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
  // Ölçüm (docs/OLCUM.md): oturumun olayları ve özeti; bölüm olayları eşleşmeli.
  const olc = await page.evaluate(() => window.__fitil.olcum());
  writeFileSync(`${dir}/olcum.json`, JSON.stringify(olc, null, 1));
  const basla = olc.olaylar.filter((x) => x.a === 'bolum_basla').length;
  const bitti = olc.olaylar.filter((x) => x.a === 'bolum_bitti').length;
  if (!olc.olaylar.some((x) => x.a === 'oturum_basla')) hatalar.push(`[${p.ad}] ölçüm: oturum_basla yok`);
  if (basla === 0 || bitti === 0) hatalar.push(`[${p.ad}] ölçüm: bölüm olayları eksik (başla ${basla}, bitti ${bitti})`);
  console.log(`[${p.ad}] ölçüm: ${olc.olaylar.length} olay, bölüm başla ${basla} / bitti ${bitti}, ekranlar ${Object.keys(olc.ozet.ekranlar).length}`);
  await ctx.close();
}

/**
 * (CAN-REKLAM §11) Gelir profili: `?gelir=sahte&reklam=hizli`, 390×844. Adımlar
 * şartnamedeki sırayla; kayıp için Acemi bot 10. bölümde (zor; Acemi ~%15–25
 * kazanır, kazanırsa yeniden denenir: kazanç can yemez). Şartname "bölüm 9"
 * diyor; 9 tanıtım bölümü, Acemi çoğunlukla kazanır, deneme uzar.
 */
async function gelirProfili({ page, p, kare, dokun, dugme, botlaBitir, haritayaDon }) {
  const ek = (url, q) => url + (url.includes('?') ? '&' : '?') + q;
  const gelir = () => page.evaluate(() => window.__fitil.gelir());
  const canSayi = async () => (await gelir())?.can?.sayi;
  const bekleCan = (n, aciklama) => bekleKosul(page, (x) => window.__fitil.gelir()?.can?.sayi === x, n, 15000, aciklama);
  /** Sahte reklam katmanı: geri sayım biter, "Ödülü al". */
  const reklamIzle = async (etiket) => {
    await bekleKosul(page, () => !!document.querySelector('.fs-reklam'), null, 8000, `${etiket}: reklam katmanı`);
    const ekr = await ekran(page);
    if (ekr !== 'reklam') hatalar.push(`[${p.ad}] ${etiket}: reklam açıkken ekran "${ekr}"`);
    await bekleKosul(page, () => !!document.querySelector('.fs-reklam .fs-al:not([disabled])'), null, 8000, `${etiket}: Ödülü al`);
    if (etiket) await kare(`${etiket}-reklam`);
    await page.locator('.fs-reklam .fs-al').click();
    await bekleKosul(page, () => !document.querySelector('.fs-reklam'), null, 5000, `${etiket}: reklam kapandı`);
  };
  /** Sahte satın alma kartı: "Satın al". */
  const satinOnayla = async (etiket) => {
    await bekleKosul(page, () => !!document.querySelector('.fs-satin.fs-giris'), null, 8000, `${etiket}: onay kartı`);
    await page.waitForTimeout(350);
    if (etiket) await kare(`${etiket}-onay`);
    await page.locator('.fs-satin .fs-dg-birincil').click();
    await bekleKosul(page, () => !document.querySelector('.fs-satin'), null, 5000, `${etiket}: onay kapandı`);
  };
  const panelAcik = () => bekleKosul(page, () => window.__fitil.ekran() === 'canPaneli' && !!document.querySelector('.f-can-modal:not(.f-cikis)'), null, 8000, 'can paneli');
  /** Bölümü Acemi ile kaybet (kazanırsa yeniden; kazanç can yemez). */
  const kaybet = async (etiket, n = 10) => {
    for (let i = 0; i < 6; i++) {
      await page.evaluate((id) => window.__fitil.bolumAc(id), n);
      await bekleKosul(page, (id) => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === id && window.__fitil.durum().oturum === 'bekliyor', n, 20000, `bölüm ${n}`);
      await page.evaluate(() => window.__fitil.hizli(true));
      const s = await botlaBitir(`${etiket}-${i}`, 'acemi');
      if (s === 'kaybettin') return true;
    }
    hatalar.push(`[${p.ad}] ${etiket}: Acemi 6 denemede kaybetmedi`);
    return false;
  };

  // 1. Aç; 8 bölüm kazanılmış kayıt (ipuçları kapalı: balonlar akışı kesmesin).
  await page.goto(ek(URL, 'gelir=sahte&reklam=hizli'));
  await page.waitForSelector('.f-acilis', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await dokun(p.w / 2, p.h * 0.72);
  await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 1, null, 15000, 'bölüm 1');
  const g0 = await gelir();
  if (g0?.saglayici !== 'sahte') hatalar.push(`[${p.ad}] sağlayıcı: ${JSON.stringify(g0)}`);
  const kb = { yildiz: 2, enIyi: 1000, deneme: 1, basarisizSeri: 0, kazanc: 1 };
  await page.evaluate((b) => window.__fitil.kayitYama({ bolumler: b, ayarlar: { ipuclari: false } }), Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((i) => [i, kb])));
  await page.waitForTimeout(600);
  await dugme('Duraklat').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'duraklat', null, 8000, 'duraklat');
  await page.waitForTimeout(400);
  await dugme('Haritaya dön').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 15000, 'harita');
  await page.waitForTimeout(1200);

  // 2. Haritada can hapı "5"; bölümü kaybet → "−1 can · 4 kaldı".
  const hap = await page.evaluate(() => document.querySelector('.f-can-hap .f-can-hap-sayi')?.textContent ?? null);
  if (hap !== '5') hatalar.push(`[${p.ad}] haritada can hapı "${hap}" (5 bekleniyordu)`);
  await kare('harita-can-hapi');
  // 3. "+5 hamle" → sahte reklam → oyun 5 hamleyle sürer; kazanırsa can geri gelir. Usta botu 5
  // hamlede her bölümde kazanmaz: devam kaybederse (ikinci kayıp can düşürmez) sonraki bölüm denenir.
  let devamKazandi = false;
  for (const [sira, n] of [10, 12, 13].entries()) {
    const once = await canSayi();
    if (!(await kaybet(`b${n}-kayip`, n))) break;
    const satir = await page.evaluate(() => document.querySelector('.f-kb-can')?.textContent ?? '');
    if (!satir.includes(`−1 can · ${once - 1} kaldı`)) hatalar.push(`[${p.ad}] b${n} Kaybettin can satırı: "${satir}" (önce ${once})`);
    if ((await canSayi()) !== once - 1) hatalar.push(`[${p.ad}] b${n} kayıpta can ${once} → ${await canSayi()}`);
    if (!(await page.locator('.f-kb-reklam').count())) hatalar.push(`[${p.ad}] b${n} Kaybettin'de "+5 hamle" yok`);
    if (sira === 0) await kare('kaybettin-can-reklam');
    // Reklamla devam aynı denemedir (Eli gibi): deneme ve başarısızlık serisi devamın sonucuyla artmaz.
    const kayipKaydi = await page.evaluate((id) => window.__fitil.kayit().bolumler[id], n);
    await page.locator('.f-kb-reklam').click();
    await reklamIzle(sira === 0 ? 'hamle' : '');
    await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.durum().oturum === 'bekliyor', null, 15000, 'reklamdan sonra oyun');
    const d = await page.evaluate(() => window.__fitil.durum());
    if (d.kalanHamle !== 5) hatalar.push(`[${p.ad}] b${n} reklamla devam: kalan hamle ${d.kalanHamle}`);
    if (sira === 0) await kare('reklam-devam-oyun');
    const s3 = await botlaBitir(`b${n}-reklam-devam`, 'usta');
    const c3 = await canSayi();
    const devamKaydi = await page.evaluate((id) => window.__fitil.kayit().bolumler[id], n);
    if (devamKaydi?.deneme !== kayipKaydi?.deneme) hatalar.push(`[${p.ad}] b${n} reklamla devam yeni deneme sayıldı (${kayipKaydi?.deneme} → ${devamKaydi?.deneme})`);
    if (s3 !== 'kazandin' && devamKaydi?.basarisizSeri !== kayipKaydi?.basarisizSeri) hatalar.push(`[${p.ad}] b${n} devamdan sonraki kayıp seriyi artırdı`);
    not(`[${p.ad}] b${n} reklamla +5 hamle: ${s3}, can ${once} → ${c3}`);
    if (s3 === 'kazandin') {
      // Devamla kazanç: kayıpta giden can geri gelir (C4).
      if (c3 !== once) hatalar.push(`[${p.ad}] b${n} devamla kazanç: can iade edilmedi (${once} → ${c3})`);
      devamKazandi = true;
      await haritayaDon();
      break;
    }
    if (c3 !== once - 1) hatalar.push(`[${p.ad}] b${n} devamdan sonraki kayıp yeniden can düşürdü (${c3})`);
    if (await page.locator('.f-kb-can, .f-kb-reklam').count()) hatalar.push(`[${p.ad}] b${n} devamdan sonraki Kaybettin'de can satırı ya da +5 hamle var`);
    await haritayaDon();
  }
  if (!devamKazandi) not(`[${p.ad}] reklamla devam hiçbir bölümde kazanmadı: iade yalnız birim testte (gelirAkisi.test.ts)`);

  // 4. canAyarla(1); kaybet → "Can bitti" → panel: sayaç, üç reklam → "Yarın yine".
  await page.evaluate(() => window.__fitil.canAyarla(1));
  if (await kaybet('b10-son-can')) {
    if ((await canSayi()) !== 0) hatalar.push(`[${p.ad}] son can düşmedi: ${await canSayi()}`);
    if (!(await page.locator('.f-kb-can-bitti').count())) hatalar.push(`[${p.ad}] 0 canda "Can bitti" düğmesi yok`);
    if (await dugme('Tekrar dene').count()) hatalar.push(`[${p.ad}] 0 canda "Tekrar dene" görünüyor`);
    await kare('kaybettin-can-bitti');
    await page.locator('.f-kb-can-bitti').click();
    await panelAcik();
    await page.waitForTimeout(500);
    const sayac = await page.evaluate(() => document.querySelector('.f-can-sure')?.textContent ?? '');
    if (!/^\d+:\d\d$/.test(sayac)) hatalar.push(`[${p.ad}] can paneli sayacı: "${sayac}"`);
    await kare('can-paneli-bitti');
    for (let i = 1; i <= 3; i++) {
      await page.locator('.f-can-modal:not(.f-cikis) .f-can-reklam').click();
      await reklamIzle(i === 1 ? 'can' : '');
      await bekleCan(i, `reklamla can ${i}`);
      await panelAcik();
      await page.waitForTimeout(400);
      if (i === 1) await kare('can-paneli-1-can');
    }
    if (!(await page.locator('.f-can-modal:not(.f-cikis) .f-can-yarin').count())) hatalar.push(`[${p.ad}] üç reklamdan sonra "Yarın yine" yok`);
    if (await page.locator('.f-can-modal:not(.f-cikis) .f-can-reklam').count()) hatalar.push(`[${p.ad}] üç reklamdan sonra reklam düğmesi duruyor`);
    await kare('can-paneli-yarin-yine');
    await page.locator('.f-can-modal:not(.f-cikis) .f-can-bekle').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'kaybettin', null, 8000, 'panelden Kaybettin');
    await page.waitForTimeout(600);
    if (!(await dugme('Tekrar dene').count())) hatalar.push(`[${p.ad}] can gelince Kaybettin'de "Tekrar dene" yok`);
    await kare('kaybettin-can-geldi');
    await haritayaDon();
  }

  // 5. Ayarlar > Mağaza: canları doldur, güçlendirici paketi (+3/+2/+2), Usta kartı → "Sende var".
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 15000, 'harita (mağaza)');
  await page.evaluate(() => window.__fitil.kayitYama({ guclendiriciler: { kibrit: 0, kalip: 0, geriSar: 0 } }));
  await page.evaluate(() => window.__fitil.canAyarla(2));
  await dugme('Ayarlar').click();
  await page.waitForTimeout(700);
  await page.locator('.f-ay-magaza').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await kare('ayarlar-magaza-satiri');
  await page.locator('.f-ay-magaza').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'magaza' && document.querySelectorAll('.f-magaza-modal .f-mg-fiyat:not([disabled])').length >= 3, null, 8000, 'Mağaza fiyatları');
  await page.waitForTimeout(400);
  await kare('magaza');
  const satinAl = async (sira, etiket) => {
    await bekleKosul(page, () => window.__fitil.ekran() === 'magaza' && !!document.querySelector('.f-magaza-modal:not(.f-cikis)'), null, 8000, `${etiket}: Mağaza`);
    await page.locator('.f-magaza-modal:not(.f-cikis) .f-mg-urun').nth(sira).locator('.f-mg-fiyat').click();
    await satinOnayla(etiket);
  };
  await satinAl(0, 'can-doldur');
  await bekleCan(5, 'canları doldur');
  await satinAl(1, 'paket');
  await bekleKosul(page, () => JSON.stringify(window.__fitil.gelir().stok) === JSON.stringify({ kibrit: 3, kalip: 2, geriSar: 2 }), null, 8000, 'paket stoğu');
  await satinAl(2, 'usta-karti');
  await bekleKosul(page, () => window.__fitil.gelir().ustaKarti === true, null, 8000, 'Usta kartı');
  await bekleKosul(page, () => !!document.querySelector('.f-magaza-modal:not(.f-cikis) .f-mg-d-sende'), null, 8000, 'Sende var');
  await page.waitForTimeout(500);
  const durumlar = await page.evaluate(() => [...document.querySelectorAll('.f-magaza-modal:not(.f-cikis) .f-mg-urun')].map((e) => [...e.classList].find((c) => c.startsWith('f-mg-d-'))));
  if (JSON.stringify(durumlar) !== JSON.stringify(['f-mg-d-stokDolu', 'f-mg-d-satilik', 'f-mg-d-sende'])) hatalar.push(`[${p.ad}] Mağaza durumları: ${durumlar}`);
  await kare('magaza-sende');
  await page.locator('.f-magaza-modal:not(.f-cikis) .f-mg-geri').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'magaza' && !!document.querySelector('.f-magaza-modal:not(.f-cikis)'), null, 8000, 'geri yükleme → Mağaza');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await bekleKosul(page, () => window.__fitil.ekran() === 'ayarlar', null, 8000, 'Mağaza → Ayarlar');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita' && !window.__fitil.durum().modal, null, 8000, 'Ayarlar → harita');

  // Usta kartı: reklam satırı "Ücretsiz +1 can" (aynı günlük hakla; hak sıfırlanır, can 3).
  await page.evaluate(() => window.__fitil.kayitYama({ can: { reklamGun: 0, reklamSayisi: 0 } }));
  await page.evaluate(() => window.__fitil.canAyarla(3));
  await page.waitForTimeout(1200);
  await page.locator('.f-can-hap').click();
  await panelAcik();
  await page.waitForTimeout(500);
  const ucretsiz = await page.evaluate(() => document.querySelector('.f-can-modal:not(.f-cikis) .f-can-reklam')?.textContent ?? '');
  if (!ucretsiz.includes('Ücretsiz +1 can')) hatalar.push(`[${p.ad}] Usta kartıyla reklam satırı: "${ucretsiz}"`);
  await kare('can-paneli-usta-karti');
  await page.locator('.f-can-modal:not(.f-cikis) .f-can-reklam').click();
  await bekleCan(4, 'Usta kartıyla +1 can');
  if (await page.locator('.fs-reklam').count()) hatalar.push(`[${p.ad}] Usta kartıyla reklam gösterildi`);
  await panelAcik();
  await page.locator('.f-can-modal:not(.f-cikis) .f-can-bekle').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 8000, 'panel → harita');

  // 6. Duraklat (≥ 1 hamle) > Haritaya dön → onay kartı (Vazgeç → Duraklat; Çık → −1 can).
  const c6 = await canSayi();
  await page.evaluate(() => window.__fitil.bolumAc(10));
  await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 10 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'bölüm 10 (çıkış)');
  await page.evaluate(() => window.__fitil.botHamle('usta'));
  await bekleKosul(page, () => window.__fitil.durum().oturum === 'bekliyor', null, 15000, 'hamle bitti');
  await dugme('Duraklat').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'duraklat', null, 8000, 'duraklat');
  await page.waitForTimeout(400);
  await dugme('Haritaya dön').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'cikisOnayi' && !!document.querySelector('.f-cikis-modal'), null, 8000, 'çıkış onayı');
  await page.waitForTimeout(500);
  await kare('cikis-onayi');
  await dugme('Vazgeç').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'duraklat', null, 8000, 'Vazgeç → Duraklat');
  if ((await canSayi()) !== c6) hatalar.push(`[${p.ad}] Vazgeç can düşürdü`);
  await page.waitForTimeout(400);
  await dugme('Haritaya dön').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'cikisOnayi', null, 8000, 'çıkış onayı (2)');
  await page.locator('.f-co-onay').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 15000, 'Çık → harita');
  if ((await canSayi()) !== c6 - 1) hatalar.push(`[${p.ad}] onaylı çıkış: can ${c6} → ${await canSayi()}`);
  await page.waitForTimeout(900);
  await kare('cikis-sonrasi-harita');

  // 6b. Bölüm başlatma kapısı (§2, C5): 0 canla kart > Oyna → "Canların bitti" paneli, bölüm
  // başlamaz (Bekle → harita); can gelince (Usta kartıyla ücretsiz +1) bölüm başlar.
  await page.evaluate(() => window.__fitil.canAyarla(0));
  await page.waitForTimeout(1200);
  const kapiBolumu = async () => {
    await page.locator('.f-dugum[data-id="9"]').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'bolumOncesi', null, 10000, 'kapı: bölüm kartı');
    await page.waitForTimeout(500);
    await dugme('Oyna').click();
    await panelAcik();
  };
  await kapiBolumu();
  await page.waitForTimeout(400);
  const kapiBaslik = await page.evaluate(() => document.querySelector('.f-can-modal .f-serit-metin')?.textContent ?? '');
  if (kapiBaslik !== 'Canların bitti') hatalar.push(`[${p.ad}] kapı paneli başlığı: "${kapiBaslik}"`);
  await kare('kapi-can-paneli');
  await page.locator('.f-can-modal:not(.f-cikis) .f-can-bekle').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 10000, 'kapı: Bekle → harita');
  if ((await page.evaluate(() => window.__fitil.durum().oturum)) !== 'kapali') hatalar.push(`[${p.ad}] 0 canla bölüm başladı`);
  await kapiBolumu();
  await page.locator('.f-can-modal:not(.f-cikis) .f-can-reklam').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 9, null, 15000, 'kapı: can gelince bölüm başlar');
  if ((await canSayi()) !== 1) hatalar.push(`[${p.ad}] kapı: can ${await canSayi()} (1 bekleniyordu)`);
  await page.waitForTimeout(600);
  await dugme('Duraklat').click();
  await bekleKosul(page, () => window.__fitil.ekran() === 'duraklat', null, 8000, 'kapı: duraklat');
  await dugme('Haritaya dön').click();
  // Hamle yapılmadı: çıkış onayı yok, can düşmez.
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 10000, 'kapı: hamlesiz çıkış');
  if ((await canSayi()) !== 1) hatalar.push(`[${p.ad}] hamlesiz çıkış can düşürdü`);

  // 8. Ölçüm: §8 olayları ve `bolum_bitti.reklam`.
  const olc = await page.evaluate(() => window.__fitil.olcum());
  writeFileSync(join(OUT, p.ad, 'olcum.json'), JSON.stringify(olc, null, 1));
  const adlar = new Set(olc.olaylar.map((x) => x.a));
  for (const a of ['can_harcandi', 'can_bitti', 'can_doldu', 'reklam_teklif', 'reklam_sonuc', 'satin_alma']) if (!adlar.has(a)) hatalar.push(`[${p.ad}] ölçüm: ${a} yok`);
  const ozellik = (x) => x.p ?? x;
  if (!olc.olaylar.some((x) => x.a === 'bolum_bitti' && ozellik(x).reklam === true)) hatalar.push(`[${p.ad}] ölçüm: bolum_bitti.reklam yok`);
  if (!olc.olaylar.some((x) => x.a === 'reklam_sonuc' && ozellik(x).kart === true)) hatalar.push(`[${p.ad}] ölçüm: Usta kartıyla reklam_sonuc (kart) yok`);
  not(`[${p.ad}] ölçüm: ${[...adlar].filter((a) => /^(can_|reklam_|satin_)/.test(a)).join(', ')}`);

  // 7a. `?reklam=hata` (aynı kayıt, sayfa yeniden): "+5 hamle" → "Şu an reklam yok", düğme gizlenir.
  await page.goto(ek(URL, 'gelir=sahte&reklam=hata'));
  await page.waitForSelector('.f-acilis', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await dokun(p.w / 2, p.h * 0.72);
  await bekleKosul(page, () => window.__fitil.ekran() === 'harita', null, 20000, 'reklam=hata: harita');
  // Usta kartı reklamsız ödül verir: hata yolu için kart kaldırılır. Önceki kayıplar (son can,
  // onaylı çıkış) 10'un serisini Eli eşiğine taşımasın: Eli sunulursa reklam teklifi çıkmaz (§3).
  await page.evaluate(() => window.__fitil.kayitYama({ gelir: { ustaKarti: false, jetonlar: [] } }));
  await page.evaluate(() => {
    const b = window.__fitil.kayit().bolumler['10'];
    if (b) window.__fitil.kayitYama({ bolumler: { 10: { ...b, basarisizSeri: 0 } } });
  });
  await page.evaluate(() => window.__fitil.canAyarla(5));
  if (await kaybet('b10-reklam-hata')) {
    await page.locator('.f-kb-reklam').click();
    await bekleKosul(page, () => window.__fitil.ekran() === 'kaybettin' && !!document.querySelector('.f-kaybettin:not(.f-cikis)'), null, 8000, 'reklam=hata: Kaybettin');
    await page.waitForTimeout(400);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.f-toast')].map((e) => e.textContent).join(' | '));
    if (!toast.includes('Şu an reklam yok')) hatalar.push(`[${p.ad}] reklam hata: bildirim "${toast}"`);
    if (await page.locator('.f-kaybettin:not(.f-cikis) .f-kb-reklam').count()) hatalar.push(`[${p.ad}] reklam hata: "+5 hamle" düğmesi gizlenmedi`);
    await kare('reklam-hata');
    await haritayaDon();
  }

  // 7. `?gelir` olmadan: can hapı, Mağaza, reklam düğmesi YOK (yeni bağlam, temiz kayıt).
  const ctx2 = await browser.newContext({ locale: 'tr-TR', viewport: { width: p.w, height: p.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', (e) => hatalar.push(`[${p.ad}/web] pageerror: ${e.message}`));
  page2.on('console', (m) => {
    if (m.type() === 'error') hatalar.push(`[${p.ad}/web] console.error: ${m.text()}`);
  });
  await page2.goto(URL);
  await page2.waitForSelector('.f-acilis', { timeout: 20000 });
  await page2.waitForTimeout(1500);
  await page2.mouse.click(p.w / 2, p.h * 0.72);
  await bekleKosul(page2, () => window.__fitil.ekran() === 'oyun', null, 15000, 'web: bölüm 1');
  await page2.waitForTimeout(800);
  await page2.getByRole('button', { name: 'Duraklat', exact: true }).first().click();
  await bekleKosul(page2, () => window.__fitil.ekran() === 'duraklat', null, 8000, 'web: duraklat');
  await page2.getByRole('button', { name: 'Haritaya dön', exact: true }).first().click();
  await bekleKosul(page2, () => window.__fitil.ekran() === 'harita', null, 15000, 'web: harita');
  await page2.waitForTimeout(900);
  const web = await page2.evaluate(() => ({ gelir: window.__fitil.gelir(), hap: document.querySelectorAll('.f-can-hap').length, canAyarla: window.__fitil.canAyarla(2) }));
  await page2.getByRole('button', { name: 'Ayarlar', exact: true }).first().click();
  await page2.waitForTimeout(700);
  const web2 = await page2.evaluate(() => ({ magaza: document.querySelectorAll('.f-ay-magaza').length, hakkinda: document.querySelector('.f-hakkinda')?.textContent ?? '', kayitCan: 'can' in window.__fitil.kayit() }));
  if (web.gelir !== null || web.hap || web.canAyarla !== false || web2.magaza || web2.kayitCan || !web2.hakkinda.includes('Can yok, bekleme yok, mağaza yok.')) hatalar.push(`[${p.ad}/web] gelir öğesi: ${JSON.stringify({ ...web, ...web2 })}`);
  await page2.locator('.f-hakkinda').scrollIntoViewIfNeeded();
  await page2.waitForTimeout(300);
  await page2.screenshot({ path: join(OUT, p.ad, '98-web-ayarlar.png') });
  await page2.keyboard.press('Escape');
  // Web Kaybettin: can satırı, "+5 hamle", "Can bitti" yok; "Can yok, bekleme yok" notu var.
  const kb2 = { yildiz: 2, enIyi: 1000, deneme: 1, basarisizSeri: 0, kazanc: 1 };
  await page2.evaluate((b) => window.__fitil.kayitYama({ bolumler: b, ayarlar: { ipuclari: false } }), Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => [i, kb2])));
  let webKayip = false;
  for (let i = 0; i < 6 && !webKayip; i++) {
    await page2.evaluate(() => window.__fitil.bolumAc(10));
    await bekleKosul(page2, () => window.__fitil.ekran() === 'oyun' && window.__fitil.bolum() === 10 && window.__fitil.durum().oturum === 'bekliyor', null, 20000, 'web: bölüm 10');
    await page2.evaluate(() => window.__fitil.hizli(true));
    for (let j = 0; j < 80; j++) {
      const e = await page2.evaluate(() => window.__fitil.ekran());
      if (e === 'kazandin' || e === 'kaybettin') break;
      if (e !== 'oyun') {
        await page2.waitForTimeout(150);
        continue;
      }
      await page2.evaluate(() => window.__fitil.botHamle('acemi'));
    }
    await bekleKosul(page2, () => ['kazandin', 'kaybettin'].includes(window.__fitil.ekran()), null, 60000, 'web: sonuç');
    webKayip = (await page2.evaluate(() => window.__fitil.ekran())) === 'kaybettin';
  }
  if (webKayip) {
    await page2.waitForTimeout(2300);
    const kbWeb = await page2.evaluate(() => ({ gelir: document.querySelectorAll('.f-kb-can, .f-kb-reklam, .f-kb-can-bitti').length, not: !!document.querySelector('.f-kb-ucretsiz') }));
    if (kbWeb.gelir || !kbWeb.not) hatalar.push(`[${p.ad}/web] Kaybettin: ${JSON.stringify(kbWeb)}`);
    await page2.screenshot({ path: join(OUT, p.ad, '99-web-kaybettin.png') });
  } else hatalar.push(`[${p.ad}/web] Acemi 6 denemede kaybetmedi`);
  await ctx2.close();
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
