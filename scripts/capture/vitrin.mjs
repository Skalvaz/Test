/**
 * Vitrin kadraj seti (Dalga 0, T-19): sabit kadrajlı referans kareleri.
 *
 *   node scripts/capture/vitrin.mjs <url> <çıktı-kökü> [--sizes 1280x720,2560x1440] [--only 314-tam-guc,322-fan-yakin]
 *        [--set vitrin|arayuz|hepsi] [--headed] [--fresh-profile]
 *
 * Örnek (dev sunucusu 5201'de):
 *   node scripts/capture/vitrin.mjs http://localhost:5201/ capture-output/vitrin/once
 *   node scripts/visual-metrics.mjs capture-output/vitrin/sonra --compare capture-output/vitrin/once
 *
 * Çıktı: <kök>/<GxY>/<sahne>.png ve yanında <sahne>.json (NaN/Inf/negatif
 * piksel sayısı, sim durumu, kamera), kötü piksel varsa maskesi
 * <kök>/<GxY>/_nan/<sahne>.png (beyaz = NaN/sonsuz/negatif; visual-metrics
 * --exclude-nan). `--set arayuz` menü, ders, test hücresi (FADEC manuel
 * dahil) ve atölye arayüzünü (koçluk balonu açık başlangıç dahil) dört ekran
 * genişliğinde kaydeder: <kök>/arayuz/<GxY>/<ad>.png.
 *
 * Uygulama API'leri (Dalga 0 sözleşmesi; 1A post zincirini yeniden düzenlese
 * de araç bozulmaz): hazır olma `window.__loadReady`, saatler
 * `app.resetClocks()`, NaN bekçisi `app.pipeline.probeNonFinite({ runs })`.
 * Bunlar olmayan eski commit'lerde (önce kümesi) eski yollar kullanılır.
 *
 * Belirlenimlilik: sayfa açılır açılmaz App donar (fixedDt, kare yalnız
 * istenince çizilir), Math.random tohumlu bir üreteçle, performance.now
 * yalnız çizilen karelerle ilerleyen sanal saatle değişir; ikisi de her sahne
 * başında sıfırlanır. Ses kapalıdır (rastgele çağrı yapmasın).
 * Birikimli saatler (ısı pusu, yağmur) sahne başında sıfırlanır; rüzgâr
 * tulumu gibi kapalı saatler sıraya bağlı olduğundan set hep aynı sırayla
 * (scenes/vitrin/index.json) ve boyut başına yeni sayfada kaydedilir.
 * Aynı koddan iki kayıt arasında ROI SSIM'i 1,000 olmalıdır (gürültü tabanı).
 *
 * Sahne alanları: id, desc, kind, env, ui (hidden | menu | workshop), cam,
 * tgt, fov, cut, lights (hücre ışığı 0..1), setup (js; `a` App, `sim`),
 * cleanup (js, yakalamadan sonra: kurulumun sahneye kalıcı etkisini geri
 * alır), warm (yakalamadan önce çizilen kare), variants [{ suffix, setup,
 * roi?, … }], extends (başka sahnenin alanlarını devralır; ölçüm tabanları),
 * blades (FFT), roi { ad: şekil }, roiBySize { "GxY": { ad: şekil } }.
 * Şekiller: rect [x0,y0,x1,y1], ellipse, ring, poly, disk (dünya uzayında
 * daire: center, axis, r0, r1 [m]; kamerayla izdüşürülür) ve exclude.
 * Yeni sahne index.json'da EN SONA eklenir (sıraya bağlı saatler).
 * Atölye sahnesi: template, module, drag { handle, dx, dy, steps, hold }.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launchBrowser } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const VITRIN_DIR = path.join(here, 'scenes', 'vitrin');
const SETTINGS_KEY = 'turbofan-akademi:settings:v1';
const COACH_KEY = 'turbofan-akademi:workshop:coach';
const SEED = 20261024;

/** Sahne tanımı; `extends` başka sahnenin alanlarını devralır (id, açıklama, varyantlar hariç) */
export function readScene(id) {
  const sc = JSON.parse(fs.readFileSync(path.join(VITRIN_DIR, `${id}.json`), 'utf8'));
  if (!sc.extends) return sc;
  const { variants: _v, desc: _d, galeri: _g, ...inherit } = readScene(sc.extends);
  return { ...inherit, ...sc };
}

/** index.json + sahne tanımları (variants açılmış: her biri ayrı kare) */
export function loadVitrin() {
  const index = JSON.parse(fs.readFileSync(path.join(VITRIN_DIR, 'index.json'), 'utf8'));
  const scenes = index.sahneler.map((id) => readScene(id));
  return { index, scenes };
}

/** Bir sahnenin kaydedilecek kareleri: kendisi + varyantları */
export function shotsOf(scene) {
  const base = { ...scene };
  delete base.variants;
  return [base, ...(scene.variants ?? []).map((v) => ({ ...base, ...v, id: `${scene.id}${v.suffix}`, scene: scene.id }))];
}

const secs = (t) => `${((Date.now() - t) / 1000).toFixed(1)} s`;

/** Donmuş, tohumlu sayfa (`coach`: atölye koçluk balonları baştan açık) */
async function openFrozenPage(browser, url, { w, h, quality = 'high', coach = false }) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: w, height: h });
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') page.errs.push(m.text().slice(0, 300));
  });
  await page.addInitScript(
    ({ q, seed, settingsKey, coachKey, coach }) => {
      // mulberry32: aynı tohum → aynı dizi
      let s = seed | 0;
      Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      // Sanal saat: performance.now yalnız çizilen karelerle ilerler (1/30 s).
      // Efektlerin duvar saatine bağlı kısımları (zemin girdabının gezinmesi,
      // atölyenin süre bütçeli döngüleri) da belirlenimli olur
      let virt = 0;
      performance.now = () => virt;
      window.__vitrinSeed = (v) => {
        s = v | 0;
        virt = 100000;
      };
      try {
        localStorage.clear();
        localStorage.setItem(settingsKey, JSON.stringify({ quality: q, muted: true, volume: 0 }));
        localStorage.setItem(coachKey, coach ? '0' : '99');
      } catch {
        /* özel kip */
      }
      // App oluşturulur oluşturulmaz donar: gerçek zamanlı kare hiç çizilmez
      Object.defineProperty(window, '__app', {
        configurable: true,
        enumerable: true,
        set(v) {
          Object.defineProperty(window, '__app', { value: v, writable: true, configurable: true, enumerable: true });
          v.fixedDt = 1 / 30;
          v.pendingSteps = 0;
        },
      });
      /** Donmuş kipte n kare çiz */
      window.__vitrinRender = async (n = 1) => {
        const a = window.__app;
        for (let i = 0; i < n; i++) {
          const n0 = a.framesRendered;
          a.pendingSteps = 1;
          await new Promise((res) => {
            const chk = () => (a.framesRendered > n0 ? res() : requestAnimationFrame(chk));
            chk();
          });
          virt += 1000 / 30;
        }
        await new Promise((res) => requestAnimationFrame(() => res()));
      };
      /**
       * NaN bekçisi (WebGL sarmalayıcısı): son kareyi ekrana değil kayan
       * noktalı hedefe yeniden çizer ve okur. Sim ilerlemez (yalnız
       * composer.render); tuvaldeki kare değişmez.
       */
      window.__vitrinNan = (withRuns = false) => {
        const a = window.__app;
        // Sözleşme (Dalga 0 düzeltmesi): uygulama kendi bekçisini verir
        if (a.pipeline?.probeNonFinite) return a.pipeline.probeNonFinite({ runs: withRuns });
        const comp = a.fx.composer;
        const r = a.renderer;
        const gl = r.getContext();
        comp.renderToScreen = false;
        try {
          comp.render(0);
        } finally {
          comp.renderToScreen = true;
        }
        const rt = comp.readBuffer;
        const w = rt.width;
        const h = rt.height;
        r.setRenderTarget(rt);
        let buf = new Float32Array(w * h * 4);
        let half = false;
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, buf);
        if (gl.getError() !== gl.NO_ERROR) {
          // Yarım kayan nokta okuma (bazı sürücüler FLOAT okumayı reddeder)
          buf = new Uint16Array(w * h * 4);
          half = true;
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.HALF_FLOAT, buf);
        }
        r.setRenderTarget(null);
        let nan = 0;
        let inf = 0;
        let neg = 0;
        const runs = [];
        for (let i = 0; i < w * h; i++) {
          let bn = false;
          let bi = false;
          let bg = false;
          for (let c = 0; c < 3; c++) {
            const k = i * 4 + c;
            if (half) {
              const x = buf[k];
              if ((x & 0x7c00) === 0x7c00) {
                if (x & 0x03ff) bn = true;
                else bi = true;
              } else if (x & 0x8000 && x & 0x7fff) bg = true;
            } else {
              const v = buf[k];
              if (v !== v) bn = true;
              else if (!Number.isFinite(v)) bi = true;
              else if (v < 0) bg = true;
            }
          }
          if (bn) nan++;
          if (bi) inf++;
          if (bg) neg++;
          if (withRuns && (bn || bi || bg)) {
            // GL satırı alttan üste: görüntü sırasına çevir
            const p = (h - 1 - Math.floor(i / w)) * w + (i % w);
            runs.push([p, 1]);
          }
        }
        if (withRuns) {
          runs.sort((x, y) => x[0] - y[0]);
          const merged = [];
          for (const r of runs) {
            const l = merged[merged.length - 1];
            if (l && l[0] + l[1] === r[0]) l[1]++;
            else merged.push(r);
          }
          return { nan, inf, neg, w, h, half, runs: merged };
        }
        return { nan, inf, neg, w, h, half };
      };
    },
    { q: quality, seed: SEED, settingsKey: SETTINGS_KEY, coachKey: COACH_KEY, coach },
  );
  await page.goto(url, { waitUntil: 'load' });
  // Hazır: sözleşme `window.__loadReady` (yükleme ekranı ilk tam kareye
  // bağlanınca donmuş sayfada kalkmaz, T-04); eski commit'lerde yükleme
  // ekranının kalkması
  await page.waitForFunction(
    () => window.__app && ('__loadReady' in window ? window.__loadReady === true : !document.getElementById('loading')) && !window.__app.envPending,
    null,
    { timeout: 600000 },
  );
  // Yükleme ekranı kare çizilince kalkıyorsa (T-04) iki kare çiz ve kalkmasını bekle
  if (await page.evaluate(() => !!document.getElementById('loading'))) {
    await page.evaluate(() => window.__vitrinRender(2));
    await page.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 60000 }).catch(() => {
      throw new Error('yükleme ekranı hazır olduktan ve iki kare çizildikten sonra 60 s içinde kalkmadı');
    });
  }
  await page.evaluate(() => {
    const a = window.__app;
    // Ses kapalı: AudioContext kurulmasın, rastgele çağrı yapmasın
    for (const k of ['update', 'bang', 'whoomp', 'resume']) a.audio[k] = () => {};
  });
  return page;
}

/** Ortam değiştir ve derleme bitene kadar bekle */
async function applyEnv(page, env) {
  const s0 = await page.evaluate((e) => {
    const a = window.__app;
    const s = a.envSerial;
    a.applyEnvironment(e);
    return s;
  }, env);
  await page.waitForFunction((s) => window.__app.envSerial > s && !window.__app.envPending, s0, { timeout: 600000 });
}

/** Motor ve kipi sahnenin başlangıcına getirir (kayıt betiğiyle aynı sıfırlama) */
async function resetScene(page, shot) {
  await page.evaluate(
    ([ui, kind]) => {
      const a = window.__app;
      a.timeScale = 1;
      a.autoStart = false;
      a.setCutaway(false);
      if (window.__weather) window.__weather.humidity = 0.6;
      if (ui === 'menu') {
        document.body.classList.remove('ui-hidden');
        a.showMenu();
      } else if (ui === 'hidden') {
        if (a.mode !== 'sandbox') a.openSandbox();
        document.body.classList.add('ui-hidden');
      }
      a.toasts?.clear?.();
      a.sim.setFlight({ altitude: 0, mach: 0, isaDev: 0 }, true);
      if (ui === 'workshop') return;
      if ((a.slot ?? a.sim.kind) === kind) {
        a.sim.setDesign(a.sim.eng.design);
        a.sim.trim(0, 30);
        a.rebuildVisual(kind);
      } else {
        a.setEngine(kind, true);
      }
    },
    [shot.ui ?? 'hidden', shot.kind],
  );
}

/** Tohum ve birikimli saatler (sözleşme: app.resetClocks; eski commit'lerde doğrudan) */
const reseed = (page) =>
  page.evaluate((seed) => {
    const a = window.__app;
    window.__vitrinSeed(seed);
    if (typeof a.resetClocks === 'function') a.resetClocks();
    else {
      a.fx.grade.uniforms.uTime.value = 0;
      if (a.rain?.material?.uniforms?.uTime) a.rain.material.uniforms.uTime.value = 0;
    }
  }, SEED);

/** NaN/sonsuz/negatif piksel maskesi (beyaz = kötü); kötü piksel yoksa eski dosya silinir */
async function writeNanMask(file, probe) {
  if (!probe.runs?.length) {
    fs.rmSync(file, { force: true });
    return;
  }
  const m = Buffer.alloc(probe.w * probe.h);
  for (const [start, len] of probe.runs) m.fill(255, start, start + len);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(m, { raw: { width: probe.w, height: probe.h, channels: 1 } }).png().toFile(file);
}

/** Sahne durumu + kadraj (hidden/menu) */
async function stageShot(page, shot) {
  const bad = await page.evaluate(
    ([s]) => {
      const a = window.__app;
      // eslint-disable-next-line no-unused-vars
      const sim = a.sim;
      eval(s.setup || '');
      if ((s.ui ?? 'hidden') === 'menu') {
        a.rig.autoRotate = false;
        a.rig.go('menu', true);
        return null;
      }
      a.rig.anim.active = false;
      a.rig.bounds = null;
      a.rig.controls.maxDistance = 500;
      a.rig.controls.minDistance = 0.05;
      a.rig.camera.position.set(...s.cam);
      a.rig.controls.target.set(...s.tgt);
      a.rig.camera.fov = s.fov ?? 36;
      a.rig.setInsets({ left: 0, right: 0, top: 0, bottom: 0 });
      a.rig.resize(innerWidth, innerHeight);
      a.rig.camera.updateProjectionMatrix();
      a.rig.controls.update();
      a.setCutaway(!!s.cut);
      const p = a.rig.camera.position;
      const off = Math.max(...s.cam.map((x, i) => Math.abs(x - p.getComponent(i))));
      return off > 1e-6 ? `kamera ${off.toFixed(3)} m kaydı` : null;
    },
    [shot],
  );
  if (bad) throw new Error(`${shot.id}: kadraj kurulamadı: ${bad}`);
}

/** Atölye sahnesi: şablon, modül seçimi, tutamaç sürüklemesi (bırakmadan) */
async function stageWorkshop(page, shot) {
  await page.evaluate(() => {
    document.body.classList.remove('ui-hidden');
    window.__app.openWorkshop();
  });
  await page.waitForSelector(`[data-template="${shot.template}"]`, { timeout: 30000 });
  await page.$eval(`[data-template="${shot.template}"]`, (el) => el.click());
  await page.evaluate(() => window.__app.workshop.store.flush());
  await page.waitForSelector(`[data-module="${shot.module}"]`, { state: 'attached', timeout: 30000 });
  await page.$eval(`[data-module="${shot.module}"]`, (el) => el.click());
  // Kamera uçuşu ve yeniden çerçeveleme biter, tam ayrıntılı model sahnede
  await page.evaluate(async () => {
    const a = window.__app;
    a.workshop.store.flush();
    for (let i = 0; i < 240 && (a.rig.animating || !a.workshop.idle); i++) await window.__vitrinRender(1);
    a.workshop.store.flush();
    await window.__vitrinRender(2);
  });
  await reseed(page);
  const d = shot.drag;
  const h = await page.evaluate((id) => window.__app.workshop.handles().find((x) => x.id === id) ?? null, d.handle);
  if (!h || h.blocked) throw new Error(`${shot.id}: tutamaç yok ya da kilitli: ${d.handle}`);
  await page.mouse.move(h.screen[0], h.screen[1]);
  await page.mouse.down();
  const n = Math.round(d.steps * (d.hold ?? 1));
  for (let i = 1; i <= n; i++) {
    await page.mouse.move(h.screen[0] + (d.dx * i) / d.steps, h.screen[1] + (d.dy * i) / d.steps);
    await page.evaluate(() => window.__vitrinRender(1));
  }
  await page.waitForFunction(() => window.__app.workshop.idle, null, { timeout: 30000 });
  return async () => {
    await page.mouse.up();
    await page.evaluate(() => window.__app.workshop.store.flush());
  };
}

/** Bir kare: kur, çiz, yakala, NaN say, yan dosya */
async function captureShot(page, shot, dir) {
  const t0 = Date.now();
  await resetScene(page, shot);
  await applyEnv(page, shot.env ?? 'Test hücresi');
  // Hücre ışığı her sahnede yeniden (gece sahnesinden sonra açık kalsın)
  await page.evaluate((l) => window.__app.setLights(l), shot.lights ?? 1);
  let release = null;
  if ((shot.ui ?? 'hidden') === 'workshop') {
    release = await stageWorkshop(page, shot);
  } else {
    await reseed(page);
    await stageShot(page, shot);
  }
  await page.evaluate((n) => window.__vitrinRender(n), shot.warm ?? 3);
  // Arayüz geçiş animasyonları (CSS, gerçek zaman) bitsin
  if ((shot.ui ?? 'hidden') !== 'hidden') await page.waitForTimeout(900);
  const file = path.join(dir, `${shot.id}.png`);
  await page.screenshot({ path: file, timeout: 300000 });
  const probe = await page.evaluate(() => {
    const a = window.__app;
    const s = a.sim.snapshot();
    const c = a.rig.camera;
    return {
      nan: window.__vitrinNan(true),
      sim: { kind: s.kind, N1: +s.N1.toFixed(4), N2: +s.N2.toFixed(4), egt: +s.egt.toFixed(1), lit: s.lit, abLevel: +s.abLevel.toFixed(3), time: +s.time.toFixed(3) },
      camera: { position: c.position.toArray().map((v) => +v.toFixed(4)), quaternion: c.quaternion.toArray().map((v) => +v.toFixed(6)), fov: c.fov },
      mode: a.mode,
      framesRendered: a.framesRendered,
    };
  });
  if (release) await release();
  if (shot.cleanup) await page.evaluate((js) => {
    const a = window.__app;
    // eslint-disable-next-line no-unused-vars
    const sim = a.sim;
    eval(js);
  }, shot.cleanup);
  await writeNanMask(path.join(dir, '_nan', `${shot.id}.png`), probe.nan);
  const { runs: _runs, ...readback } = probe.nan;
  const meta = { id: shot.id, scene: shot.scene ?? shot.id, env: shot.env ?? 'Test hücresi', ...probe, nan: probe.nan.nan, inf: probe.nan.inf, neg: probe.nan.neg, readback };
  fs.writeFileSync(path.join(dir, `${shot.id}.json`), JSON.stringify(meta, null, 2));
  console.log(`  ${shot.id}: ${secs(t0)} (NaN ${meta.nan}, negatif ${meta.neg})`);
  return meta;
}

/* ---------------------------- arayüz seti ---------------------------- */

/** CSS bölme denetimi: arayüzün ana ekranları (3B arka plan donmuş ve tohumlu) */
const UI_SHOTS = [
  ['menu', async (page) => page.evaluate(() => window.__app.showMenu())],
  ['ders-secimi', async (page) => page.evaluate(() => window.__app.openLessons())],
  ['bilgi-bankasi', async (page) => page.evaluate(() => window.__app.openGlossary())],
  ['ayarlar', async (page) => page.evaluate(() => window.__app.openSettings())],
  [
    'ders-2',
    async (page) => {
      await page.evaluate(() => window.__app.showMenu());
      await page.click('.menu-item:has-text("Akademi")');
      await page.click('.lesson-card:nth-child(2)');
      await page.evaluate(() => {
        const a = window.__app;
        a.rig.go(a.rig.current, true);
      });
    },
  ],
  [
    'hucre',
    async (page) => {
      await page.evaluate(() => {
        const a = window.__app;
        a.openSandbox();
        a.toasts?.clear?.();
        a.sim.trim(1, 20);
        a.advance(3);
        a.rig.go('front', true);
        a.setDiagram?.(true);
      });
    },
  ],
  [
    'hucre-kesit',
    async (page) => {
      await page.evaluate(() => {
        const a = window.__app;
        a.rig.go('cutaway', true);
      });
    },
  ],
  [
    'atolye-baslangic',
    async (page) => {
      await page.evaluate(() => window.__app.openWorkshop());
      await page.waitForSelector('[data-start]', { timeout: 30000 });
    },
  ],
  [
    'atolye-duzenleme',
    async (page) => {
      await page.$eval('[data-template="turbofan"]', (el) => el.click());
      await page.evaluate(async () => {
        const a = window.__app;
        a.workshop.store.flush();
        for (let i = 0; i < 240 && (a.rig.animating || !a.workshop.idle); i++) await window.__vitrinRender(1);
        a.workshop.store.flush();
      });
      await page.$eval('[data-module="hpc"]', (el) => el.click());
      await page.evaluate(() => window.__app.workshop.store.flush());
    },
  ],
  [
    'atolye-mimari',
    async (page) => {
      await page.click('.ws-tab:has-text("Mimari")');
    },
  ],
  // Dalga 0 denetimi: CSS bölmesi manuel yakıt kaydırıcısının rengini
  // değiştirmişti ve hiçbir karede görünmüyordu. Sona eklendi (öncekiler aynı)
  [
    'hucre-fadec-manuel',
    async (page) => {
      await page.evaluate(() => {
        const a = window.__app;
        a.openSandbox();
        a.toasts?.clear?.();
        a.sim.trim(0.6, 20);
        a.advance(1);
        a.rig.go('front', true);
        // FADEC anahtarının kendisi gibi: valf o anki akışa
        const c = a.sim.controls;
        c.manualFuel = Math.min(1, a.sim.wf / (a.sim.eng.ref.Wf * 1.15));
        c.fadec = 'manual';
        const inp = document.querySelector('.manual-fuel input');
        if (inp) inp.value = String(c.manualFuel);
        a.advance(0.5);
        a.toasts?.clear?.();
      });
    },
  ],
];
/** Ayrı sayfada (koçluk baştan açık): atölye başlangıcı ve koçluk balonu (1G: 7. kart + ipucu) */
const UI_COACH_SHOTS = [
  [
    'atolye-baslangic-kocluk',
    async (page) => {
      await page.evaluate(() => window.__app.openWorkshop());
      await page.waitForSelector('[data-start]', { timeout: 30000 });
    },
  ],
];
const UI_SIZES = ['1440x810', '1280x720', '960x600', '700x900'];

async function captureUi(browser, url, outRoot, sizes) {
  for (const size of sizes) {
    const [w, h] = size.split('x').map(Number);
    const dir = path.join(outRoot, 'arayuz', size);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    for (const [shots, coach] of [
      [UI_SHOTS, false],
      [UI_COACH_SHOTS, true],
    ]) {
      const page = await openFrozenPage(browser, url, { w, h, coach });
      await page.evaluate(() => window.__vitrinRender(2));
      for (const [name, fn] of shots) {
        await reseed(page);
        await fn(page);
        await page.evaluate(() => window.__vitrinRender(3));
        // Menü/modal ve bildirim animasyonları (gerçek zaman) bitsin
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(dir, `${name}.png`), timeout: 300000 });
      }
      if (page.errs.length) console.warn('Sayfa hataları:', page.errs.slice(0, 5));
      await page.close();
    }
    console.log(`arayüz ${size}: ${UI_SHOTS.length + UI_COACH_SHOTS.length} kare, ${secs(t0)}`);
  }
}

/* ------------------------------- ana -------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((s) => s.startsWith('--') && !s.includes('=')));
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const pos = args.filter((s, i) => !s.startsWith('--') && !['--sizes', '--only', '--set'].includes(args[i - 1]));
  const [url, outRoot] = pos;
  if (!url || !outRoot) {
    console.error('Kullanım: node scripts/capture/vitrin.mjs <url> <çıktı-kökü> [--sizes 1280x720,2560x1440] [--only id,…] [--set vitrin|arayuz|hepsi]');
    process.exit(1);
  }
  const set = opt('--set') ?? 'vitrin';
  const only = opt('--only')?.split(',') ?? null;
  const { index, scenes } = loadVitrin();
  const sizes = opt('--sizes')?.split(',') ?? index.boyutlar;
  const t0 = Date.now();
  const browser = await launchBrowser(flags, { profile: 'vitrin-profile' });
  let failed = 0;
  try {
    if (set === 'vitrin' || set === 'hepsi') {
      for (const size of sizes) {
        const [w, h] = size.split('x').map(Number);
        const dir = path.join(outRoot, size);
        fs.mkdirSync(dir, { recursive: true });
        const tp = Date.now();
        const page = await openFrozenPage(browser, url, { w, h });
        console.log(`${size}: sayfa ${secs(tp)}`);
        const metas = [];
        for (const scene of scenes) {
          for (const shot of shotsOf(scene)) {
            if (only && !only.includes(shot.id) && !only.includes(scene.id)) continue;
            try {
              metas.push(await captureShot(page, shot, dir));
            } catch (e) {
              failed++;
              console.error(`  ${shot.id}: ${e.message}`);
            }
          }
        }
        fs.writeFileSync(path.join(dir, '_kayit.json'), JSON.stringify({ url, size, when: new Date().toISOString(), errors: page.errs, shots: metas.map((m) => m.id) }, null, 2));
        if (page.errs.length) console.warn('Sayfa hataları:', page.errs.slice(0, 5));
        console.log(`${size}: ${metas.length} kare, ${secs(tp)}`);
        await page.close();
      }
    }
    if (set === 'arayuz' || set === 'hepsi') await captureUi(browser, url, outRoot, opt('--sizes')?.split(',') ?? UI_SIZES);
  } finally {
    await browser.close();
  }
  console.log(`Toplam ${secs(t0)}, ${failed} hata`);
  process.exit(failed ? 1 : 0);
}
