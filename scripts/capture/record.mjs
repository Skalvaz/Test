/**
 * Sahne kaydı: bir sahne tanımını (JSON) oyunda belirlenimli olarak oynatır,
 * her kareyi PNG olarak yazar ve isteğe bağlı GIF üretir.
 *
 *   node scripts/capture/record.mjs <url> <sahne.json | sahne-adı> <çıktı-klasörü> [--gif] [--headed] [--swiftshader]
 *
 * Örnek (dev sunucusu çalışırken):
 *   node scripts/capture/record.mjs http://localhost:5173/ surge capture-output/after/surge --gif
 *
 * Kayıt, App'in test kancasını kullanır: fixedDt ayarlıyken her kare
 * simülasyonu tam dt ilerletir ve yalnız istendiğinde çizilir. Böylece hızlı
 * ya da yavaş makinede aynı kareler çıkar.
 *
 * Sahne alanları: kind, env, quality, w, h, cam, tgt, fov, cut, setup (js),
 * frames, dt, skip, actions { kare: js }. setup ve actions içinde `a`
 * (App) ve `sim` (EngineSim) kullanılabilir.
 *
 * Toplu kayıt (batch.mjs) aynı sayfayı sahneler arasında yeniden kullanır:
 * openPage bir kez çağrılır, recordScene her sahnede motoru ve görseli
 * sayfa yeni açılmış gibi sıfırlar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, toGif } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Sahne adı ya da JSON yolu → sahne tanımı */
export function loadSpec(arg) {
  const file = fs.existsSync(arg) ? arg : path.join(here, 'scenes', `${arg}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const secs = (t) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

/**
 * Oyunu verilen kalite ve boyutta açar, yüklemenin bitmesini bekler ve test
 * hücresi (sandbox) kipine geçer. Sayfa hataları `page.errs` içinde toplanır.
 */
export async function openPage(browser, url, { quality = 'high', w = 960, h = 540 } = {}) {
  const t0 = Date.now();
  const page = await browser.newPage();
  await page.setViewportSize({ width: w, height: h });
  page.errs = [];
  page.quality = quality;
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') page.errs.push(m.text().slice(0, 300));
  });
  await page.addInitScript(
    (q) => localStorage.setItem('turbofan-akademi:settings:v1', JSON.stringify({ quality: q, muted: true, volume: 0 })),
    quality,
  );
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 300000 });
  await page.evaluate(() => {
    window.__app.openSandbox();
    document.body.classList.add('ui-hidden');
  });
  if (!(await page.evaluate(() => 'fixedDt' in window.__app))) {
    throw new Error('Bu sürümde kare yakalama kancası (App.fixedDt) yok.');
  }
  console.log(`Sayfa yüklendi: ${secs(t0)}`);
  return page;
}

/**
 * Bir sahneyi açık sayfada kaydeder. Motor ve görsel her seferinde sıfırdan
 * kurulur (sayfa yeni açılmış gibi): aynı sayfada art arda kaydedilen
 * sahneler birbirinin durumunu (is, ısıl kızıllık, parçacıklar) taşımaz.
 */
export async function recordScene(page, spec, outDir, { gif = false } = {}) {
  const t0 = Date.now();
  const name = path.basename(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const nErr = page.errs.length;
  await page.setViewportSize({ width: spec.w ?? 960, height: spec.h ?? 540 });

  // Gerçek zamanlı döngüye dön ve motoru/görseli açılıştaki hale getir.
  // Ortam hazır sayılmak için yeni bir derleme başlamış (envSerial arttı) ve
  // bitmiş olmalı: eski sürümlerde gökyüzü yüklenirken envPending false kalır.
  const serial0 = await page.evaluate(async ([env, kind]) => {
    const a = window.__app;
    a.fixedDt = null;
    a.pendingSteps = 0;
    a.timeScale = 1;
    a.autoStart = false;
    a.setCutaway(false);
    if (window.__weather) window.__weather.humidity = 0.6;
    a.sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
    if (a.sim.kind === kind) {
      a.sim.setDesign(a.sim.eng.design);
      a.sim.trim(0, 30);
      a.rebuildVisual(kind);
    } else {
      a.setEngine(kind, true);
    }
    const s0 = a.envSerial;
    a.applyEnvironment(env);
    return s0;
  }, [spec.env ?? 'Test hücresi', spec.kind]);
  await page.waitForFunction((s0) => window.__app.envSerial > s0 && !window.__app.envPending, serial0, {
    timeout: 600000,
  });
  const tEnv = secs(t0);

  await page.evaluate(
    ([s, pos, tgt, fov, cut]) => {
      const a = window.__app;
      a.rig.anim.active = false;
      a.rig.bounds = null;
      a.rig.controls.maxDistance = 500;
      a.rig.controls.minDistance = 0.05;
      a.rig.camera.position.set(...pos);
      a.rig.controls.target.set(...tgt);
      a.rig.camera.fov = fov;
      // Paneller gizli: projeksiyon kaydırması/uzaklaştırması olmasın (eski
      // sürümler arayüz gizliyken de panellere yer açıyordu)
      a.rig.setInsets({ left: 0, right: 0, top: 0, bottom: 0 });
      a.rig.resize(innerWidth, innerHeight);
      a.rig.camera.updateProjectionMatrix();
      a.rig.controls.update();
      a.setCutaway(!!cut);
      // eslint-disable-next-line no-unused-vars
      const sim = a.sim;
      eval(s || '');
    },
    [spec.setup, spec.cam, spec.tgt, spec.fov ?? 36, spec.cut ?? 0],
  );
  await page.evaluate((dt) => {
    const a = window.__app;
    a.fixedDt = dt;
    a.pendingSteps = 0;
  }, spec.dt ?? 1 / 15);

  const t1 = Date.now();
  const frames = spec.frames ?? 30;
  const shots = [];
  for (let f = 0; f < frames; f++) {
    await page.evaluate(async (js) => {
      const a = window.__app;
      // eslint-disable-next-line no-unused-vars
      const sim = a.sim;
      if (js) eval(js);
      const n0 = a.framesRendered;
      a.pendingSteps = 1;
      await new Promise((res) => {
        const chk = () => (a.framesRendered > n0 ? res() : requestAnimationFrame(chk));
        chk();
      });
      await new Promise((res) => requestAnimationFrame(() => res()));
    }, spec.actions?.[f] ?? '');
    if (f >= (spec.skip ?? 0)) {
      // PNG sıkıştırması ve dosya yazımı bir sonraki kareyle örtüşsün
      const buf = await page.screenshot({ timeout: 300000 });
      shots.push(fs.promises.writeFile(path.join(outDir, `f${String(f).padStart(3, '0')}.png`), buf));
    }
    process.stdout.write(`\r${name}: ${f + 1}/${frames}`);
  }
  await Promise.all(shots);
  process.stdout.write(`  (ortam ${tEnv}, kareler ${secs(t1)})\n`);
  // Sonraki sahne için gerçek zamanlı döngüye dön
  await page.evaluate(() => {
    window.__app.fixedDt = null;
  });
  const errs = page.errs.slice(nErr);
  if (errs.length) console.warn('Sayfa hataları:', errs);
  console.log(`${name} bitti: ${secs(t0)}`);
  // GIF kodlaması (sharp, ayrı iş parçacıkları) sonraki sahnenin kaydıyla
  // örtüşür. Nesne içinde döner: async fonksiyon promise'i kendisi beklemesin.
  // Tek karelik sahneden animasyon çıkmaz
  if (!gif || shots.length < 2) return { gif: Promise.resolve() };
  const out = `${outDir.replace(/[\\/]+$/, '')}.gif`;
  return { gif: toGif(outDir, out, { width: 480, fps: 12 }).then(() => console.log('GIF:', out)) };
}

// Komut satırından çağrıldıysa tek sahne kaydet
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((s) => s.startsWith('--')));
  const [url, specArg, outDir] = args.filter((s) => !s.startsWith('--'));
  if (!url || !specArg || !outDir) {
    console.error('Kullanım: node scripts/capture/record.mjs <url> <sahne.json|ad> <çıktı> [--gif] [--headed] [--swiftshader]');
    process.exit(1);
  }
  const t0 = Date.now();
  const spec = loadSpec(specArg);
  const browser = await launchBrowser(flags);
  try {
    const page = await openPage(browser, url, spec);
    const { gif } = await recordScene(page, spec, outDir, { gif: flags.has('--gif') });
    await browser.close();
    await gif;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
  console.log(`Toplam: ${secs(t0)}`);
}
