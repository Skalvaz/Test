/**
 * Parametre değişikliğinde yeniden üretim süresi (atölye kaydırıcısı
 * senaryosu). Dev sunucusu açıkken:
 *
 *   node scripts/bench-rebuild.mjs [high|medium|low] [--url http://localhost:5173/]
 *   node scripts/bench-rebuild.mjs [kalite] --family [turbojet,turbofan,…] [--url …]
 *
 * Varsayılan kip: şablon yuvalarında (kind) tam üretim. Her satır: tasarım
 * (fizik) + 3B üretim süresi | ardından gelen ilk kare. İlk ölçümler
 * sayfanın ilk shader derlemesine denk gelebilir.
 *
 * `--family` (M5a §6.7 bütçesi): yedi aile şablonunun hazır olanları atölye
 * yuvasında (`workshop`, efektsiz) sürükleme gibi üretilir: art arda taslak
 * (`applyDesign(…, 'draft')`), bırakınca tam ayrıntı, sonra yeniden taslak.
 * Taslak süresi = tasarım + düşük ayrıntılı 3B üretim (App.applyDesign
 * çağrısının tamamı). Bütçe: taslak ≤ 150 ms. Hazır olmayan yerleşim
 * (`READY=false`) atlanır ve öyle yazılır. Liste verilmezse yedi aile.
 */
import { launchBrowser } from './capture/common.mjs';
import { openPage } from './capture/record.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
};
const quality = args.find((a) => ['high', 'medium', 'low'].includes(a)) ?? 'high';
const url = opt('--url') || 'http://localhost:5173/';
const familyArg = opt('--family');

const browser = await launchBrowser(new Set(args.filter((a) => a.startsWith('--') && a !== '--family' && a !== '--url')));
const page = await openPage(browser, url, { quality });

if (familyArg !== undefined) {
  const FAMILIES = ['turbojet', 'turbojetDry', 'militaryTurbofan', 'turbofanMixed', 'turbofan', 'turboprop', 'turboshaft'];
  const families = familyArg ? familyArg.split(',') : FAMILIES;
  const BUDGET = 150;
  const r = await page.evaluate(
    async ({ families, BUDGET }) => {
      const a = window.__app;
      const D = window.__design;
      const frame = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const settle = async (n = 4) => {
        for (let i = 0; i < n; i++) await frame();
      };
      const med = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)];
      const fmt = (xs) => xs.map((x) => x.toFixed(0)).join(' ');
      const out = [];
      let allOk = true;
      for (const id of families) {
        const base = D.TEMPLATES[id];
        if (!base) {
          out.push(`${id}: şablon yok (hazır değil), atlandı`);
          continue;
        }
        // Hava akışı ±%2 (ön uç tutamacı: bütün geometri değişir) ve HPC
        // basınç oranı (kompresör boyu tutamacı: kademe sayısı değişir)
        const variant = (i) => {
          const g = structuredClone(base);
          g.massFlow = base.massFlow * (i % 2 ? 1.02 : 0.98);
          const hpc = g.modules.find((m) => m.type === 'hpc');
          if (hpc && i % 4 >= 2) hpc.pr *= 1.12;
          return g;
        };
        try {
          a.applyDesign('workshop', variant(0), 'full', { effects: false });
        } catch (e) {
          out.push(`${id}: kurulamadı (${String(e.message ?? e).slice(0, 80)}), atlandı`);
          continue;
        }
        await settle(6);
        const draft = (i) => {
          const t0 = performance.now();
          a.applyDesign('workshop', variant(i), 'draft', { effects: false });
          return performance.now() - t0;
        };
        const full = () => {
          const t0 = performance.now();
          a.rebuildVisual('workshop', { effects: false });
          return performance.now() - t0;
        };
        // Isınma: iki taslak (düşük ayrıntı malzemeleri ilk kez derlenir)
        draft(1);
        await settle();
        draft(2);
        await settle();
        const drafts = [];
        const frames = [];
        for (let i = 3; i < 11; i++) {
          drafts.push(draft(i));
          const t = performance.now();
          await frame();
          frames.push(performance.now() - t);
        }
        // Bırakınca tam ayrıntı, sonra yeni sürükleme (taslak ↔ tam önbelleği)
        const fulls = [];
        const after = [];
        for (let i = 0; i < 3; i++) {
          fulls.push(full());
          await settle(2);
          after.push(draft(11 + i));
          await settle(2);
        }
        const worst = Math.max(...drafts, ...after);
        const ok = worst <= BUDGET;
        allOk &&= ok;
        out.push(
          `${id.padEnd(17)} taslak ${fmt(drafts)} (ort. ${med(drafts).toFixed(0)}) · tam→taslak ${fmt(after)} · tam ${fmt(fulls)} · kare ${fmt(frames)} ms · en kötü taslak ${worst.toFixed(0)} ms ${ok ? '≤' : '>'} ${BUDGET} ${ok ? 'GEÇTİ' : 'KALDI'}`,
        );
      }
      D.setSlotGraph('workshop', null);
      a.setEngine('turbofan', true);
      await settle(2);
      return { text: out.join('\n'), allOk };
    },
    { families, BUDGET },
  );
  console.log(r.text);
  console.log(r.allOk ? `Sonuç: bütün hazır ailelerde taslak ≤ ${BUDGET} ms` : `Sonuç: bütçe aşıldı (> ${BUDGET} ms)`);
  if (page.errs.length) console.log('Sayfa hataları:\n' + page.errs.join('\n'));
  await browser.close();
  process.exit(r.allOk && !page.errs.length ? 0 : 1);
}

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
console.log(r);
await browser.close();
