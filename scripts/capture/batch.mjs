/**
 * Birden çok sahneyi sırayla kaydeder (her biri için kare klasörü + GIF).
 *
 *   node scripts/capture/batch.mjs <url> <çıktı-kökü> [sahne ...] [--headed] [--swiftshader]
 *
 * Sahne verilmezse scenes/ altındaki hepsi kaydedilir. Tarayıcı ve sayfa
 * bir kez açılır; sahneler aynı sayfada art arda kaydedilir (yükleme yalnız
 * kalite değişince tekrarlanır).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './common.mjs';
import { loadSpec, openPage, recordScene } from './record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = new Set(args.filter((s) => s.startsWith('--')));
const [url, outRoot, ...names] = args.filter((s) => !s.startsWith('--'));
if (!url || !outRoot) {
  console.error('Kullanım: node scripts/capture/batch.mjs <url> <çıktı-kökü> [sahne ...]');
  process.exit(1);
}
const scenes = names.length
  ? names
  : fs
      .readdirSync(path.join(here, 'scenes'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -5));

const t0 = Date.now();
const browser = await launchBrowser(flags);
let page = null;
let failed = 0;
const gifs = [];
for (const s of scenes) {
  const spec = loadSpec(s);
  try {
    if (!page || page.quality !== (spec.quality ?? 'high')) {
      await page?.close();
      page = await openPage(browser, url, spec);
    }
    const { gif } = await recordScene(page, spec, path.join(outRoot, path.basename(s, '.json')), { gif: true });
    gifs.push(
      gif.catch((e) => {
        console.error(`${s} GIF: ${e.message}`);
        failed++;
      }),
    );
  } catch (e) {
    console.error(`${s}: ${e.message}`);
    failed++;
    // Sayfa bozulmuş olabilir: sonraki sahne yeniden açsın
    await page?.close().catch(() => {});
    page = null;
  }
}
await browser.close();
await Promise.all(gifs);
console.log(`${scenes.length} sahne, ${failed} hata, toplam ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(failed ? 1 : 0);
