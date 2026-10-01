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
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, toGif } from './common.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((s) => s.startsWith('--')));
const [url, specArg, outDir] = args.filter((s) => !s.startsWith('--'));
if (!url || !specArg || !outDir) {
  console.error('Kullanım: node scripts/capture/record.mjs <url> <sahne.json|ad> <çıktı> [--gif] [--headed] [--swiftshader]');
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const specFile = fs.existsSync(specArg) ? specArg : path.join(here, 'scenes', `${specArg}.json`);
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await launchBrowser(flags);
const page = await browser.newPage({ viewport: { width: spec.w ?? 960, height: spec.h ?? 540 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 300));
});
await page.addInitScript(
  (q) => localStorage.setItem('turbofan-akademi:settings:v1', JSON.stringify({ quality: q, muted: true, volume: 0 })),
  spec.quality ?? 'high',
);
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 300000 });
await page.evaluate(async (env) => {
  const a = window.__app;
  a.openSandbox();
  document.body.classList.add('ui-hidden');
  a.applyEnvironment(env);
  await new Promise((r) => setTimeout(r, 1500));
}, spec.env ?? 'Test hücresi');
await page.waitForFunction(() => !window.__app.envPending, null, { timeout: 600000 });
await page.evaluate((k) => window.__app.setEngine(k, true), spec.kind);
await page.waitForFunction(() => !window.__app.envPending, null, { timeout: 600000 });
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
    a.rig.camera.updateProjectionMatrix();
    a.rig.controls.update();
    a.setCutaway(!!cut);
    // eslint-disable-next-line no-unused-vars
    const sim = a.sim;
    eval(s || '');
  },
  [spec.setup, spec.cam, spec.tgt, spec.fov ?? 36, spec.cut ?? 0],
);
if (!(await page.evaluate(() => 'fixedDt' in window.__app))) {
  console.error('Bu sürümde kare yakalama kancası (App.fixedDt) yok.');
  process.exit(2);
}
await page.evaluate((dt) => {
  const a = window.__app;
  a.fixedDt = dt;
  a.pendingSteps = 0;
}, spec.dt ?? 1 / 15);

const frames = spec.frames ?? 30;
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
    await page.screenshot({ path: path.join(outDir, `f${String(f).padStart(3, '0')}.png`), timeout: 300000 });
  }
  process.stdout.write(`\r${path.basename(outDir)}: ${f + 1}/${frames}`);
}
process.stdout.write('\n');
await browser.close();
if (errs.length) console.warn('Sayfa hataları:', errs);
if (flags.has('--gif')) {
  const out = `${outDir.replace(/[\\/]+$/, '')}.gif`;
  await toGif(outDir, out, { width: 480, fps: 12 });
  console.log('GIF:', out);
}
console.log(`Bitti: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
