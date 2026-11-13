/**
 * Oynanış denemesi: oyunu GERÇEK dokunma/fare olaylarıyla, gerçek zamanda
 * oynatır (simülasyonu doğrudan sürmez). "Parmak" tuvalin içinde kalmak
 * zorundadır; kenara varınca kaldırıp yeniden basar ve bunu sayar.
 *
 *   node scripts/oynanis.mjs <url> <klasör> [en-çok-sn] [kazanç] [kenar-itme 0|1]
 *
 * Çıktı: klasör/kNNN.jpg (2 sn'de bir kare) ve klasör/ozet.json.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const [url, klasor, enCok = '240', kazancArg = '2.1', kenarArg = '1'] = process.argv.slice(2);
const KAZANC = +kazancArg;
const KENAR_ITME = kenarArg === '1';
mkdirSync(klasor, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ locale: 'tr-TR', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
const page = await ctx.newPage();
const hatalar = [];
page.on('console', (m) => m.type() === 'error' && hatalar.push(m.text()));
page.on('pageerror', (e) => hatalar.push(e.message));
await page.goto(url);
await page.waitForTimeout(700);

const kutu = await page.evaluate(() => {
  const r = document.querySelector('canvas').getBoundingClientRect();
  const c = document.querySelector('canvas');
  return { x: r.left, y: r.top, w: r.width, h: r.height, cw: c.width, ch: c.height };
});
const olcek = kutu.w / kutu.cw; // tuval pikseli → CSS pikseli
const K = kutu.cw / 240;

// Oyunu başlat: ekrana dokun
let fx = kutu.x + kutu.w * 0.5;
let fy = kutu.y + kutu.h * 0.6;
await page.mouse.move(fx, fy);
await page.mouse.down();
await page.waitForTimeout(350);

// Sayfa içi ölçüm: hasar kaynakları, kare hızı, örnekler
await page.evaluate(() => {
  const L = window.__barut;
  const d = L.dunya;
  const P = (window.__pt = { hasar: [], kare: 0, ornek: [], bomba: 0, t0: performance.now() });
  const eski = d.heliHasar.bind(d);
  d.heliHasar = (m) => {
    P.hasar.push([+d.zaman.toFixed(1), +m.toFixed(1)]);
    eski(m);
  };
  const eskiB = d.bombaBirak.bind(d);
  d.bombaBirak = () => {
    const ok = eskiB();
    if (ok) P.bomba++;
    return ok;
  };
  const say = () => {
    P.kare++;
    requestAnimationFrame(say);
  };
  requestAnimationFrame(say);
  setInterval(() => {
    const kam = d.kam.x;
    let gorunen = 0;
    let toplam = 0;
    for (const s of d.askerler) if (!s.dost) { toplam++; if (s.x > kam && s.x < kam + 240) gorunen++; }
    for (const a of d.araclar) { toplam++; if (a.x > kam && a.x < kam + 240) gorunen++; }
    let enYuksek = 0;
    for (let x = 140; x <= 600; x += 4) enYuksek = Math.max(enYuksek, d.zemin - d.yer[x]);
    P.ornek.push({
      t: +d.zaman.toFixed(1), dalga: d.dalga, can: Math.round(d.heli.can), siper: Math.round(d.siperCan), skor: d.skor,
      gorunen, toplam, hx: Math.round(d.heli.x), hy: Math.round(d.zemin - d.heli.y), sinirda: d.heli.hx >= 384,
      bez: d.bezler.length, parca: d.parcalar.length, yigin: Math.round(enYuksek), sandik: d.sandiklar.length,
      guc: (d.guc.cift > 0 ? 'Ç' : '') + (d.guc.hiz > 0 ? 'H' : '') + (d.guc.bomba > 0 ? 'B' : ''),
    });
  }, 500);
});

const say = { kaldirYatay: 0, kaldirDikey: 0, kenardaBekleme: 0, bombaDokunus: 0 };
const bas = Date.now();
let kareNo = 0;
let sonKare = 0;
const solSinir = kutu.x + 14;
const sagSinir = kutu.x + kutu.w - 14;
const ustSinir = kutu.y + 70;
const altSinir = kutu.y + kutu.h - 14;
const bombaD = { x: kutu.x + (kutu.cw - 44) * olcek, y: kutu.y + (kutu.ch - 54) * olcek };
let sonBomba = 0;

for (;;) {
  const gecen = (Date.now() - bas) / 1000;
  if (gecen > +enCok) break;
  const s = await page.evaluate(() => {
    const L = window.__barut;
    const d = L.dunya;
    const h = d.heli;
    let on = 1e9;
    for (const a of d.askerler) if (!a.dost && a.x < on) on = a.x;
    for (const a of d.araclar) if (a.x < on) on = a.x;
    const dusme = Math.sqrt((2 * Math.max(10, d.yerY(h.x) - h.y)) / 280);
    const bx = h.x + h.vx * 0.55 * dusme;
    let altinda = 0;
    for (const a of d.askerler) if (!a.dost && a.x < 538 && Math.abs(a.x - bx) < 14) altinda++;
    for (const a of d.araclar) if (a.x < 538 && Math.abs(a.x - bx) < 16) altinda += 3;
    return {
      durum: L.arayuz.durum, zemin: d.zemin, hx: h.hx, hy: h.hy, x: h.x, y: h.y, can: h.can, on, altinda, bomba: d.bomba.adet, ara: d.ara,
      flak: d.flaklar.map((f) => [f.x, f.y]),
      mermi: d.mermiler.filter((m) => m.tip >= 2 && m.tip <= 6).map((m) => [m.x, m.y, m.vx, m.vy]),
      sandik: d.sandiklar.map((k) => [k.x, k.y, k.tip]),
      gomu: d.gomuler.filter((g) => g.tip === 1 && g.x < 400).map((g) => g.x),
    };
  });
  if (s.durum === 'sonuc') break;

  // Karar: botla aynı mantık, ama çıktısı parmak hareketi
  let tx = Math.max(170, Math.min(385, (s.on < 1e8 ? s.on : 300) - 50));
  let ty = s.zemin - 88 + Math.sin(gecen * 1.7) * 28;
  for (const [x, y] of s.flak) {
    if (Math.hypot(x - s.x, y - s.y) < 40) {
      tx += s.x < x ? -50 : 50;
      ty += s.y < y ? -30 : 30;
    }
  }
  for (const [x, y, vx, vy] of s.mermi) {
    const dx = s.x - x;
    const dy = s.y - y;
    if (Math.hypot(dx, dy) < 60 && dx * vx + dy * vy > 0) ty += dy > 0 ? 26 : -26;
  }
  const sandik = s.sandik.find((k) => k[2] > 0 || s.can < 80);
  if (sandik) {
    tx = sandik[0];
    ty = Math.min(sandik[1] - 30, s.zemin - 40);
  } else if ((s.ara > 0 || s.on > 1e8) && s.gomu.length) {
    const g = s.gomu.sort((a, b) => Math.abs(a - s.x) - Math.abs(b - s.x))[0];
    tx = g;
    ty = s.zemin - 60;
    if (Math.abs(s.x - g) < 4 && s.bomba > 0 && Date.now() - sonBomba > 500) s.altinda = 9;
  }

  // Parmak: istenen dünya farkı → CSS pikseli; hız sınırlı (insan eli)
  let dx = ((tx - s.hx) * K * olcek) / KAZANC;
  let dy = ((ty - s.hy) * K * olcek) / 1.25;
  const enHiz = 70; // tik başına piksel (≈ 1400 px/sn)
  const m = Math.hypot(dx, dy);
  if (m > enHiz) {
    dx *= enHiz / m;
    dy *= enHiz / m;
  }
  let nx = fx + dx;
  let ny = fy + dy;
  // Kenara vardı mı?
  if (nx < solSinir || nx > sagSinir) {
    const kalan = Math.abs(tx - s.hx);
    if (KENAR_ITME && kalan > 4) {
      nx = Math.max(solSinir - 6, Math.min(sagSinir + 6, nx)); // kenarda bekle: oyun götürsün
      say.kenardaBekleme++;
    } else if (kalan > 12) {
      // Kaldır, ortaya getir, yeniden bas
      await page.mouse.up();
      await page.waitForTimeout(140);
      fx = kutu.x + kutu.w * (nx < solSinir ? 0.7 : 0.3);
      await page.mouse.move(fx, fy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      say.kaldirYatay++;
      continue;
    } else nx = Math.max(solSinir, Math.min(sagSinir, nx));
  }
  if (ny < ustSinir || ny > altSinir) {
    if (Math.abs(ty - s.hy) > 12) {
      await page.mouse.up();
      await page.waitForTimeout(140);
      fy = kutu.y + kutu.h * (ny < ustSinir ? 0.7 : 0.4);
      await page.mouse.move(fx, fy);
      await page.mouse.down();
      await page.waitForTimeout(60);
      say.kaldirDikey++;
      continue;
    }
    ny = Math.max(ustSinir, Math.min(altSinir, ny));
  }
  fx = nx;
  fy = ny;
  await page.mouse.move(fx, fy);

  // Bomba: öteki parmakla düğmeye dokun
  if (s.altinda >= 2 && s.bomba > 0 && Date.now() - sonBomba > 350) {
    sonBomba = Date.now();
    await page.touchscreen.tap(bombaD.x, bombaD.y);
    say.bombaDokunus++;
  }

  if (gecen - sonKare >= 2) {
    sonKare = gecen;
    kareNo++;
    await page.screenshot({ path: `${klasor}/k${String(kareNo).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80 });
  }
  await page.waitForTimeout(40);
}
await page.mouse.up();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${klasor}/son.jpg`, type: 'jpeg', quality: 85 });
const olcum = await page.evaluate(() => {
  const P = window.__pt;
  const d = window.__barut.dunya;
  return {
    sure: +d.zaman.toFixed(1), skor: d.skor, dalga: d.dalga, neden: d.bitisNeden, olu: d.olu, can: Math.round(d.heli.can), siper: Math.round(d.siperCan),
    fps: +(P.kare / ((performance.now() - P.t0) / 1000)).toFixed(1), bomba: P.bomba, hasar: P.hasar, ornek: P.ornek,
  };
});
await browser.close();
writeFileSync(`${klasor}/ozet.json`, JSON.stringify({ kazanc: KAZANC, kenarItme: KENAR_ITME, parmak: say, ...olcum, hatalar }, null, 1));
const { hasar, ornek, ...kisa } = olcum;
console.log(JSON.stringify({ kazanc: KAZANC, kenarItme: KENAR_ITME, parmak: say, ...kisa, hasarSayisi: hasar.length, hatalar }));
