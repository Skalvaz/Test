/**
 * Performans dumanı (Dalga 0 iskeleti; 1A genişletir): yükleme, ortam
 * geçişleri ve kare bütçesi tek betikte, JSON çıktılı.
 *
 *   node scripts/perf-smoke.mjs <url> [--out sonuç.json] [--compare scripts/referans/perf-smoke.json]
 *        [--tol 0.05] [--gate-frame] [--warm] [--first-visit] [--quality high] [--headed]
 *
 * Varsayılan soğuk profildir (her koşuda silinir): GPU shader önbelleği boş,
 * ilk ziyaretçinin derleme süreleri. --warm profili korur (sıcak ölçüm).
 * --first-visit ayar yazmaz (oyunun varsayılan kalitesi); yoksa --quality
 * (varsayılan high, denetim ölçümleriyle aynı).
 *
 * Ölçülenler (WebGL sarmalayıcısı sayfa betiklerinden önce kurulur):
 *   yükleme   menü tıklanabilir (yükleme ekranı kalktı), ilk tam kare
 *             (ortam derlemesi bitti ve kare çizildi), bu sürede uzun görevler
 *   ortam     geçiş başına duvar saati, en uzun görev, uzun görev toplamı
 *             (PerformanceObserver longtask)
 *   kare      gerçek zamanlı döngüde App.frame'in CPU süresi (p50/p95; 3
 *             pencerenin en düşük p50'lisi, --windows),
 *             kare aralığı, karedeki toplam çizim çağrısı ve üçgen (bütün
 *             geçişler: renderer.info.autoReset kapalı), karede kullanılan
 *             program sayısı (gl.useProgram, durum önbelleği sıfırlanarak)
 *   program   derlenen (renderer.info.programs), oturumda en az bir kez
 *             kullanılan ve kullanılmayan oranı
 * --compare: çizim ve program sayıları referansın ±tol'u içinde mi
 * (dışındaysa çıkış kodu 1). Kare CPU p50 burada bilgi amaçlıdır (tek soğuk
 * koşu ısıl duruma göre %5'ten çok oynar; --gate-frame ile kapıya girer):
 * kare süresi kapısı dönüşümlü koşuların çiftli kıyasıdır
 * (scripts/perf-compare.mjs). Yük ve derleme süreleri bilgi amaçlıdır.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './capture/common.mjs';

const SETTINGS_KEY = 'turbofan-akademi:settings:v1';

const args = process.argv.slice(2);
const valued = new Set(['--out', '--compare', '--tol', '--quality', '--frames', '--windows']);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const flags = new Set(args.filter((s, i) => s.startsWith('--') && !valued.has(s) && !valued.has(args[i - 1])));
const [url] = args.filter((s, i) => !s.startsWith('--') && !valued.has(args[i - 1]));
if (!url) {
  console.error('Kullanım: node scripts/perf-smoke.mjs <url> [--out x.json] [--compare ref.json] [--tol 0.05] [--warm] [--first-visit]');
  process.exit(1);
}
const quality = opt('--quality') ?? 'high';
const FRAMES = Number(opt('--frames') ?? 200);
const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const log = (...a) => console.log(`[${secs()}]`, ...a);

if (!flags.has('--warm')) fs.rmSync(path.resolve('node_modules', '.cache', 'perf-smoke-profile'), { recursive: true, force: true });
const browser = await launchBrowser(flags, { profile: 'perf-smoke-profile', args: ['--enable-precise-memory-info'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 810 });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 300)));

await page.addInitScript(
  ([firstVisit, q, key]) => {
    try {
      localStorage.clear();
      if (!firstVisit) localStorage.setItem(key, JSON.stringify({ quality: q, muted: true, volume: 0 }));
    } catch {
      /* özel kip */
    }
    // Uzun görevler
    window.__lt = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]);
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* desteklenmiyor */
    }
    // Oturumda kullanılan programlar ve kare başına sayım
    const used = new WeakSet();
    let everUsed = 0;
    let frameSet = null;
    const wrap = (proto) => {
      const orig = proto.useProgram;
      proto.useProgram = function (p) {
        if (p && !used.has(p)) {
          used.add(p);
          everUsed++;
        }
        if (frameSet && p) frameSet.add(p);
        return orig.call(this, p);
      };
    };
    wrap(WebGL2RenderingContext.prototype);
    window.__perf = {
      used,
      everUsed: () => everUsed,
      beginFrameSet: () => (frameSet = new Set()),
      endFrameSet: () => {
        const n = frameSet ? frameSet.size : 0;
        frameSet = null;
        return n;
      },
    };
    // Yükleme zaman çizelgesi
    window.__load = {};
    const tick = () => {
      const a = window.__app;
      const now = performance.now();
      if (!window.__load.menu && document.readyState !== 'loading' && !document.getElementById('loading')) window.__load.menu = now;
      if (!window.__load.firstFrame && a && !a.envPending && a.framesRendered > 1 && !document.getElementById('loading')) window.__load.firstFrame = now;
      if (!window.__load.firstFrame) setTimeout(tick, 16);
    };
    tick();
  },
  [flags.has('--first-visit'), quality, SETTINGS_KEY],
);

const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'bilinmiyor';
});

/* ------------------------------ yükleme ------------------------------ */
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__load.firstFrame, null, { timeout: 600000 });
const load = await page.evaluate(() => {
  const lt = window.__lt.filter(([s]) => s <= window.__load.firstFrame);
  return {
    menuMs: Math.round(window.__load.menu),
    firstFrameMs: Math.round(window.__load.firstFrame),
    longestTaskMs: Math.round(Math.max(0, ...lt.map((x) => x[1]))),
    longTaskTotalMs: Math.round(lt.reduce((s, x) => s + x[1], 0)),
    programs: window.__app.renderer.info.programs?.length ?? null,
  };
});
log('yükleme', JSON.stringify(load));

/** Gerçek zamanlı döngüde n kare: CPU süresi, aralık, çizim, kullanılan program */
async function frameWindow(n) {
  return page.evaluate(async (N) => {
    const a = window.__app;
    const r = a.renderer;
    const orig = a.frame;
    const cpu = [];
    const intervals = [];
    const draws = [];
    const tris = [];
    let last = null;
    let progFrame = null;
    let sample = 0;
    r.info.autoReset = false;
    a.frame = function (now) {
      const t = performance.now();
      if (last !== null) intervals.push(t - last);
      last = t;
      r.info.reset();
      // Bir kare: durum önbelleği sıfırlanır, karede bağlanan her program sayılır
      const probe = sample++ === Math.floor(N / 2);
      if (probe) {
        r.state.reset();
        window.__perf.beginFrameSet();
      }
      orig.call(a, now);
      cpu.push(performance.now() - t);
      if (probe) progFrame = window.__perf.endFrameSet();
      draws.push(r.info.render.calls);
      tris.push(r.info.render.triangles);
    };
    await new Promise((res) => {
      const chk = () => (cpu.length >= N ? res() : setTimeout(chk, 50));
      chk();
    });
    a.frame = orig;
    r.info.autoReset = true;
    const st = (arr) => {
      const s = [...arr].sort((x, y) => x - y);
      const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
      return { n: s.length, avg: +(s.reduce((p, c) => p + c, 0) / s.length).toFixed(3), p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), max: +s[s.length - 1].toFixed(3) };
    };
    return {
      frameCpuMs: st(cpu),
      intervalMs: st(intervals),
      draws: Math.round(st(draws).p50),
      triangles: Math.round(st(tris).p50),
      programsUsedInFrame: progFrame,
      programsCompiled: r.info.programs?.length ?? null,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
    };
  }, n);
}

/** Ortam geçişi: duvar saati ve bu süredeki uzun görevler */
async function switchEnv(name) {
  const tStart = await page.evaluate((e) => {
    const a = window.__app;
    window.__envS0 = a.envSerial;
    const t = performance.now();
    a.applyEnvironment(e);
    return t;
  }, name);
  await page.waitForFunction(() => window.__app.envSerial > window.__envS0 && !window.__app.envPending, null, { timeout: 600000 });
  // Derlemenin ardından ilk kare çizilsin
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  return page.evaluate((ts) => {
    const now = performance.now();
    const lt = window.__lt.filter(([s, d]) => s + d >= ts && s <= now);
    return {
      wallS: +((now - ts) / 1000).toFixed(3),
      longestTaskMs: Math.round(Math.max(0, ...lt.map((x) => x[1]))),
      longTaskTotalMs: Math.round(lt.reduce((s, x) => s + x[1], 0)),
      programs: window.__app.renderer.info.programs?.length ?? null,
    };
  }, tStart);
}

/**
 * Kare ölçümü: WINDOWS pencere × n kare, aralarında kısa bekleme. Rapor en
 * düşük CPU p50'li pencere (geçici GC/ısıl sıçramalara karşı); bütün
 * pencerelerin p50'leri `frameCpuP50s`'te.
 */
const WINDOWS = Number(opt('--windows') ?? 3);
async function frames(n) {
  const all = [];
  for (let i = 0; i < WINDOWS; i++) {
    if (i) await page.waitForTimeout(300);
    all.push(await frameWindow(n));
  }
  const best = all.reduce((b, w) => (w.frameCpuMs.p50 < b.frameCpuMs.p50 ? w : b));
  return { ...best, frameCpuP50s: all.map((w) => w.frameCpuMs.p50) };
}

const settle = (ms) => page.waitForTimeout(ms);
const phases = {};
const env = {};

// Menü (hücre, rölanti, otomatik dönüş)
await settle(1500);
phases.menu = await frames(Math.min(FRAMES, 180));
log('menü', JSON.stringify(phases.menu.frameCpuMs), 'çizim', phases.menu.draws);

// Test hücresi: tam güç, arayüz açık, açı 1
await page.evaluate(() => {
  const a = window.__app;
  a.openSandbox();
  a.sim.trim(1, 10);
  a.rig.go('front', true);
});
await settle(1500);
phases.hucre = await frames(FRAMES);
log('hücre', JSON.stringify(phases.hucre.frameCpuMs), 'çizim', phases.hucre.draws);

for (const [key, name] of [
  ['ogle', 'Havaalanı — öğle'],
  ['gece', 'Havaalanı — gece'],
]) {
  env[key] = await switchEnv(name);
  log(`ortam ${name}`, JSON.stringify(env[key]));
  await settle(1500);
  phases[key] = await frames(FRAMES);
  log(key, JSON.stringify(phases[key].frameCpuMs), 'çizim', phases[key].draws);
}
env.hucreDonus = await switchEnv('Test hücresi');
log('ortam hücreye dönüş', JSON.stringify(env.hucreDonus));

const programs = await page.evaluate(() => {
  const r = window.__app.renderer;
  const list = r.info.programs ?? [];
  const unused = list.filter((p) => !window.__perf.used.has(p.program)).length;
  return { compiled: list.length, everUsed: window.__perf.everUsed(), unused, unusedRatio: list.length ? +(unused / list.length).toFixed(3) : null };
});
log('programlar', JSON.stringify(programs));
const heap = await page.evaluate(() => (performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null));
await browser.close();

const result = {
  tool: 'perf-smoke',
  version: 1,
  when: new Date().toISOString(),
  url,
  gpu,
  profile: flags.has('--warm') ? 'warm' : 'cold',
  quality: flags.has('--first-visit') ? 'varsayılan (ilk ziyaret)' : quality,
  viewport: '1440x810',
  load,
  env,
  phases,
  programs,
  heapMB: heap,
  errors: errs.slice(0, 20),
};
if (opt('--out')) {
  fs.mkdirSync(path.dirname(path.resolve(opt('--out'))), { recursive: true });
  fs.writeFileSync(opt('--out'), JSON.stringify(result, null, 2));
  log('yazıldı', opt('--out'));
}

/* ------------------------------ kıyas ------------------------------ */
let fail = 0;
if (opt('--compare')) {
  const ref = JSON.parse(fs.readFileSync(opt('--compare'), 'utf8'));
  const tol = Number(opt('--tol') ?? 0.05);
  const rows = [];
  const cmp = (label, a, b, gate = true) => {
    if (a == null || b == null) return;
    const d = b === 0 ? 0 : a / b - 1;
    const ok = !gate || Math.abs(d) <= tol;
    if (!ok) fail++;
    rows.push(`${ok ? '  ✓' : '  ✗'} ${label.padEnd(34)} ${String(b).padStart(9)} → ${String(a).padStart(9)}  (${(d * 100).toFixed(1)} %)${gate ? '' : ' [bilgi]'}`);
  };
  for (const k of Object.keys(result.phases)) {
    const p = result.phases[k];
    const q = ref.phases?.[k];
    if (!q) continue;
    // Tek koşunun kare süresi ısıl duruma göre %5'ten çok oynar: kapı çiftli
    // kıyastadır (scripts/perf-compare.mjs); burada --gate-frame ile
    cmp(`${k} kare CPU p50 [ms]`, p.frameCpuMs.p50, q.frameCpuMs.p50, flags.has('--gate-frame'));
    cmp(`${k} çizim/kare`, p.draws, q.draws);
    cmp(`${k} karede program`, p.programsUsedInFrame, q.programsUsedInFrame);
    cmp(`${k} derlenen program`, p.programsCompiled, q.programsCompiled);
  }
  cmp('oturum derlenen program', result.programs.compiled, ref.programs?.compiled);
  cmp('yükleme menü [ms]', result.load.menuMs, ref.load?.menuMs, false);
  cmp('yükleme ilk kare [ms]', result.load.firstFrameMs, ref.load?.firstFrameMs, false);
  for (const k of Object.keys(result.env)) cmp(`ortam ${k} [s]`, result.env[k].wallS, ref.env?.[k]?.wallS, false);
  console.log(`\nKıyas (±%${(tol * 100).toFixed(0)}):\n${rows.join('\n')}`);
  console.log(fail ? `\n${fail} ölçüt sınır dışında` : '\nBütün ölçütler sınır içinde');
}
if (errs.length) console.warn('Sayfa hataları:', errs.slice(0, 5));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(fail ? 1 : 0);
