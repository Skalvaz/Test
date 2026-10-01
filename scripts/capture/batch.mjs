/**
 * Birden çok sahneyi sırayla kaydeder (her biri için kare klasörü + GIF).
 *
 *   node scripts/capture/batch.mjs <url> <çıktı-kökü> [sahne ...] [--headed] [--swiftshader]
 *
 * Sahne verilmezse scenes/ altındaki hepsi kaydedilir.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flags = args.filter((s) => s.startsWith('--'));
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
let failed = 0;
for (const s of scenes) {
  const r = spawnSync(process.execPath, [path.join(here, 'record.mjs'), url, s, path.join(outRoot, s), '--gif', ...flags], {
    stdio: 'inherit',
  });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
