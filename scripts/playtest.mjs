/**
 * Otomatik oynanış testi: dersleri gerçek arayüz etkileşimleriyle oynar.
 *
 *   npm run build && npx vite preview --port 4173 &
 *   node scripts/playtest.mjs [ekran-görüntüsü-klasörü]
 *
 * Anahtarlara, gaz koluna, quiz seçeneklerine ve 3B parçalara gerçek fare
 * tıklamalarıyla basar. Yazılım rasterleştiricide kareler yavaş olduğundan
 * simülasyon, uygulamanın `advance()` test kancasıyla ileri sarılır.
 */

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = process.argv[2] || 'playtest';
// ONLY=2,5,sandbox → yalnızca bu bölümleri oynat
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const URL = process.env.PLAYTEST_URL || 'http://localhost:4173/';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript((quality) => {
  localStorage.clear();
  localStorage.setItem('turbofan-akademi:settings:v1', JSON.stringify({ quality, volume: 0.5, muted: true }));
}, process.env.QUALITY || 'low');

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`);
  if (!ok) failures++;
};
// SHOT_JPEG=1 → depoya konacak kadar küçük JPEG ekran görüntüleri
const JPEG = process.env.SHOT_JPEG === '1';
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/${name}.${JPEG ? 'jpg' : 'png'}`,
    timeout: 240000,
    ...(JPEG ? { type: 'jpeg', quality: 84 } : {}),
  });
  console.log(`  📷 ${name}`);
};
const advance = (s) => page.evaluate((sec) => window.__app.advance(sec), s);
const until = async (fn, arg, maxSec = 120, step = 0.5) => {
  for (let t = 0; t < maxSec; t += step) {
    if (await page.evaluate(fn, arg)) return true;
    await advance(step);
  }
  return false;
};
const stepTitle = () => page.textContent('.side-left:not(.hidden) .step-title');
const next = async () => {
  await page.click('.lesson-foot .btn.primary:not([disabled])', { timeout: 20000 });
  await advance(0.1);
};
const quiz = async (answerText) => {
  await page.click(`.quiz-opt:has-text("${answerText}")`);
  await advance(0.1);
};
const startLesson = async (n) => {
  await page.evaluate(() => window.__app.showMenu());
  await page.click('.menu-item:has-text("Akademi")');
  await page.click(`.lesson-card:nth-child(${n})`);
  await advance(0.2);
};
/**
 * Kesit görünümünde parçaların görünen bir noktası (dünya koordinatı).
 * Oyuncunun tıklayacağı yer: kanat/liner bölgesi, eksenin (miller) üstü.
 */
const PART_POINTS = {
  combustor: [-0.03, 0.43, 1.78],
  hpc: [-0.03, 0.47, 1.15],
  lpt: [-0.03, 0.5, 2.55],
  gearbox: [-0.1, -0.94, 0.85],
};

/** 3B parçanın ekran konumunu bulup gerçekten tıklar. */
const clickPart = async (part) => {
  if (PART_POINTS[part]) {
    const pos = await page.evaluate(([x, y, z]) => {
      const app = window.__app;
      const cam = app.rig.camera;
      const v = cam.position.clone().set(x, y, z).project(cam);
      const r = app.renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    }, PART_POINTS[part]);
    await page.mouse.click(pos.x, pos.y);
    await advance(0.1);
    return true;
  }
  const pos = await page.evaluate((p) => {
    const app = window.__app;
    const cam = app.rig.camera;
    const root = app.visual.root;
    root.updateMatrixWorld(true);
    const candidates = [];
    root.traverse((o) => {
      if (o.userData.part !== p || !o.isMesh || !o.visible) return;
      const THREE = Object.getPrototypeOf(cam.position).constructor;
      o.geometry.computeBoundingBox();
      const c = o.geometry.boundingBox.getCenter(new THREE());
      // InstancedMesh: ilk örneğin dönüşünü uygula
      if (o.isInstancedMesh) {
        const m = new cam.matrixWorld.constructor();
        o.getMatrixAt(0, m);
        c.applyMatrix4(m);
      }
      c.applyMatrix4(o.matrixWorld);
      candidates.push(c);
    });
    // Kesit tarafında kalan (x < 0) ve kameraya bakan noktayı seç
    const r = app.renderer.domElement.getBoundingClientRect();
    for (const c of candidates) {
      const v = c.clone();
      v.x = Math.min(v.x, -0.02);
      v.project(cam);
      if (Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95) {
        return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
      }
    }
    return null;
  }, part);
  if (!pos) return false;
  await page.mouse.click(pos.x, pos.y);
  await advance(0.1);
  return true;
};

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 300000 });
await shot('01-menu');

/* ------------------------------------------------------------------ */
if (want('2')) {
console.log('\nDers 2 — motoru çalıştırmak');
await startLesson(2);
check((await stepTitle()).includes('kendi kendine'), 'ilk adım açıldı');
await next();
await page.click('[data-sw="apuBleed"]');
check(await until(() => window.__app.runner.index === 2, null, 5), 'APU BLEED → sonraki adım');
await page.click('[data-sw="ignition"]');
check(await until(() => window.__app.runner.index === 3, null, 5), 'ATEŞLEME → sonraki adım');
await page.click('[data-sw="starter"]');
await advance(6);
await shot('02-start-motoring');
check(await until(() => window.__app.runner.isComplete, null, 60), 'marş: N2 %20\'yi geçti');
await next();
await page.click('[data-sw="fuelRun"]');
check(await until(() => window.__app.sim.lit, null, 20), 'light-off');
await advance(2);
await shot('03-start-lightoff');
check(await until(() => window.__app.runner.isComplete, null, 20), 'yakıt adımı tamam');
await next();
check(await until(() => window.__app.runner.isComplete, null, 90), 'rölanti: marş ayrıldı, N2 ≥ %60');
await shot('04-start-idle');
await next();
await quiz('sıcak çalıştırma');
check(await page.evaluate(() => window.__app.runner.isComplete), 'quiz 1 doğru');
await next();
await quiz('ıslak çalıştırma');
await next();
await next();
check(await page.isVisible('.result-stars'), 'ders sonucu gösterildi');
await shot('05-start-result');

/* ------------------------------------------------------------------ */
}
if (want('2')) {
console.log('\nDers 2 — yanlış prosedür: erken yakıt');
await startLesson(2);
await next();
await page.click('[data-sw="apuBleed"]');
await until(() => window.__app.runner.index === 2, null, 5);
await page.click('[data-sw="ignition"]');
await until(() => window.__app.runner.index === 3, null, 5);
await page.click('[data-sw="starter"]');
await advance(3);
await page.click('[data-sw="fuelRun"]');
await advance(1);
check(await page.isVisible('.feedback.bad'), 'erken yakıt adımı başarısız saydı');
await shot('06-start-fail');

/* ------------------------------------------------------------------ */
}
if (want('1')) {
console.log('\nDers 1 — anatomi (3B parça seçme)');
await startLesson(1);
for (let i = 0; i < 2; i++) await next();
await quiz('%10');
for (let i = 0; i < 3; i++) await next();
await quiz('Alçak basınç türbini');
await next();
await advance(2);
await shot('07-anatomy-pick');
const picks = [['combustor', 'yanma odası'], ['hpc', 'HPC'], ['lpt', 'LPT'], ['gearbox', 'dişli kutusu']];
for (const [part, name] of picks) {
  await advance(2); // kamera geçişi
  const clicked = await clickPart(part);
  const ok = await page.evaluate(() => window.__app.runner.isComplete);
  check(clicked && ok, `3B tıklama ile doğru parça seçildi: ${name}`);
  if (!ok) {
    const fb = await page.textContent('.feedback').catch(() => '');
    console.log('     geri bildirim:', fb);
    await page.evaluate((p) => window.__app.runner.pick(p, p), part);
  }
  await next();
}
await next();
check(await page.isVisible('.result-stars'), 'anatomi dersi bitti');

/* ------------------------------------------------------------------ */
}
if (want('5')) {
console.log('\nDers 5 — surge (manuel yakıt)');
await startLesson(5);
await next();
await page.click('[data-sw="fadec"]');
check(await until(() => window.__app.runner.index === 2, null, 5), 'FADEC → MANUEL');
// yavaş artış
for (let v = 0.06; v <= 0.34; v += 0.02) {
  await page.evaluate((x) => {
    const el = document.querySelector('.manual-fuel input');
    el.value = String(x);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  await advance(2.5);
}
check(await until(() => window.__app.runner.isComplete, null, 30), 'yavaş artışla %50 N1, surge yok');
await next();
await page.evaluate(() => {
  const el = document.querySelector('.manual-fuel input');
  el.value = '1';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
check(await until(() => window.__app.sim.surgeCount > 0, null, 5, 0.1), 'ani artış surge ettirdi');
await advance(0.15);
await shot('08-surge');
await page.evaluate(() => {
  const el = document.querySelector('.manual-fuel input');
  el.value = '0.15';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
check(await until(() => window.__app.runner.isComplete, null, 30), 'yakıt azaltılınca surge\'den çıkıldı');

/* ------------------------------------------------------------------ */
}
if (want('3')) {
console.log('\nDers 3 — Brayton çevrimi');
await startLesson(3);
await next();
await page.locator('.throttle-track').focus();
for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowUp');
check(await until(() => window.__app.runner.isComplete, null, 40), 'gaz kolu (klavye) ile N1 ≥ %60');
await next();
await quiz('iç enerjisine');
await next();
await page.keyboard.press('PageUp');
check(await until(() => window.__app.runner.isComplete, null, 40), 'kalkış gücü 3 s');
await shot('10-brayton-takeoff');
await next();
await quiz('45');
await next();
await quiz('Fan (baypas)');
await next();
await page.keyboard.press('PageDown');
check(await until(() => window.__app.runner.isComplete, null, 40), 'rölantiye dönüş');
await next();
check(await page.isVisible('.result-stars'), 'Brayton dersi bitti');

}
if (want('4')) {
console.log('\nDers 4 — FADEC');
await startLesson(4);
await next();
await page.keyboard.press('PageUp');
check(await until(() => window.__app.runner.isComplete, null, 40), 'kalkışa hızlanma ölçüldü');
const note = await page.textContent('.feedback.info');
check(/\d+\.\d s/.test(note ?? ''), `süre raporlandı: ${(note ?? '').slice(0, 40)}…`);
await next();
await page.keyboard.press('PageDown');
check(await until(() => window.__app.runner.isComplete, null, 40), 'rölantiye dönüş');
await next();
await quiz('surge hattını');
await next();
await page.evaluate(() => { window.__app.sim.controls.throttle = (0.8 / Math.sqrt(window.__app.sim.ambientState.T2 / window.__app.sim.eng.ref.T2) - 0.18) / 0.82; });
check(await until(() => window.__app.runner.isComplete, null, 40), 'N1 %80 ± 2\'de 5 s');
await next();
await next();
check(await page.isVisible('.result-stars'), 'FADEC dersi bitti');

}
if (want('6')) {
console.log('\nDers 6 — irtifa');
await startLesson(6);
await advance(1);
await next();
const setSlider = (idx, v) => page.evaluate(([i, x]) => {
  const el = document.querySelectorAll('.side-left:not(.hidden) .field input')[i];
  el.value = String(x);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, [idx, v]);
await setSlider(0, 10700);
await setSlider(1, 0.8);
check(await until(() => window.__app.runner.isComplete, null, 90), 'seyir irtifası ve dengelenme');
await shot('11-altitude-cruise');
await next();
await quiz('%15–20');
await next();
await setSlider(0, 0);
await setSlider(1, 0);
await setSlider(2, 30);
check(await until(() => window.__app.runner.isComplete, null, 120), 'sıcak günde EGT sınırlaması');
await next();
await quiz('EGT sınırına');
await next();
await next();
check(await page.isVisible('.result-stars'), 'irtifa dersi bitti');

}
if (want('7')) {
console.log('\nDers 7 — kuş çarpması');
await startLesson(7);
await next();
check(await until(() => window.__app.sim.fanDamage > 0, null, 10), 'kuş çarptı');
await shot('12-birdstrike');
await page.keyboard.press('PageDown');
check(await until(() => window.__app.runner.isComplete, null, 40), 'güç rölantiye alındı');
await next();
await page.click('[data-sw="fuelRun"]');
check(await until(() => window.__app.runner.isComplete, null, 60), 'motor kapatıldı');
await next();
await quiz('kısmi itki');
await next();
await next();
check(await page.isVisible('.result-stars'), 'kuş çarpması senaryosu bitti');

/* ------------------------------------------------------------------ */
}
if (want('sandbox')) {
console.log('\nTest hücresi');
await page.evaluate(() => window.__app.showMenu());
await page.click('.menu-item:has-text("Test hücresi")');
await page.click('button:has-text("Kalkış")');
await advance(12);
await page.keyboard.press('c');
await advance(2);
await shot('09-sandbox-cutaway-takeoff');
check(await page.evaluate(() => window.__app.sim.N1 > 0.95), 'kalkış gücü');

}
console.log(`\nHatalar (konsol/istisna): ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  -', e));
console.log(failures === 0 && errors.length === 0 ? '\nOYNANIŞ TESTİ GEÇTİ' : `\nOYNANIŞ TESTİ: ${failures} başarısız kontrol`);
await browser.close();
process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
