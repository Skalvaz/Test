/**
 * Parametre değişikliğinde yeniden üretim süresi (atölye kaydırıcısı
 * senaryosu). Dev sunucusu açıkken:
 *
 *   node scripts/bench-rebuild.mjs [high|medium|low]
 *
 * Her satır: tasarım (fizik) + 3B üretim süresi | ardından gelen ilk kare.
 * İlk ölçümler sayfanın ilk shader derlemesine denk gelebilir.
 */
import { launchBrowser } from './capture/common.mjs';
import { openPage } from './capture/record.mjs';
import { writeFileSync } from 'node:fs';

const browser = await launchBrowser(new Set());
const page = await openPage(browser, 'http://localhost:5173/', { quality: process.argv[2] ?? 'high' });
const r = await page.evaluate(async () => {
  const a = window.__app;
  const D = window.__design;
  const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  const out = [];
  const cases = [
    ['turbofan', 'hpc', 'pr', [16.5, 17.5]],
    ['turbofan', 'lpt', 'loading', [3.0, 2.8]],
    ['turbofan', null, 'massFlow', [1150, 1200]],
    ['turbojet', 'hpc', 'pr', [2.9, 3.4]],
    ['militaryTurbofan', 'combustor', 'tit', [1670, 1750]],
    ['turboprop', 'lpt', 'loading', [0.879, 0.95]],
  ];
  for (const [kind, mod, field, vals] of cases) {
    a.setEngine(kind, true);
    await frame();
    const apply = (v) => {
      D.overrideGraph(kind, null);
      const g = structuredClone(D.ENGINE_GRAPHS[kind]);
      if (mod) g.modules.find((m) => m.type === mod)[field] = v;
      else g[field] = v;
      const t0 = performance.now();
      D.overrideGraph(kind, g);
      a.sim.setDesign(D.builtEngine(kind).design);
      const t1 = performance.now();
      a.rebuildVisual(kind);
      return [t1 - t0, performance.now() - t1];
    };
    // ısınma
    apply(vals[1]); await frame(); apply(vals[0]); await frame();
    const ts = [];
    for (let i = 0; i < 6; i++) {
      const [tDesign, tBuild] = apply(vals[i % 2 ? 0 : 1]);
      const t2 = performance.now();
      await frame();
      ts.push(`${tDesign.toFixed(1)}+${tBuild.toFixed(0)}|${(performance.now() - t2).toFixed(0)}`);
    }
    out.push(`${kind} ${mod ?? ''}.${field}: tasarım+üretim|kare ${ts.join('  ')}`);
    D.overrideGraph(kind, null);
    a.sim.setDesign(D.builtEngine(kind).design);
    a.rebuildVisual(kind);
    await frame();
  }
  return out.join('\n');
});
writeFileSync('scripts/bench.out.tmp', r);
console.log(r);
await browser.close();
