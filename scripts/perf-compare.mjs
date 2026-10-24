/**
 * perf-smoke koşularının çiftli kıyası (Dalga 0 kabulü; paket kapanışlarında
 * kare süresi kapısı). Tek soğuk koşunun kare CPU süresi dizüstünün ısıl
 * durumuna göre %5'ten fazla oynar; bu yüzden iki yapı sırayla dönüşümlü
 * koşulur (önce, sonra, önce, sonra) ve medyanlar kıyaslanır.
 *
 *   node scripts/perf-compare.mjs --once o1.json,o2.json --sonra s1.json,s2.json [--tol 0.05]
 *
 * Kapılar (dışındaysa çıkış kodu 1):
 *   kare CPU p50   evre başına sonra medyanı, önce medyanının ±tol'u içinde
 *   sayımlar       çizim/kare, karede kullanılan program, derlenen program
 *                  (evre başına ve oturum) bütün koşularda aynı (belirlenimli)
 * Yükleme ve ortam geçiş süreleri, üçgen sayısı ve yığın bilgi amaçlıdır.
 *
 * Koşu örneği (PowerShell; önce yapısı 4202'de, sonra 4201'de önizlemede):
 *   foreach ($i in 1..2) { foreach ($p in @(@('once',4202),@('sonra',4201))) {
 *     node scripts/perf-smoke.mjs "http://localhost:$($p[1])/" --out "perf\$($p[0])-$i.json" } }
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};
const list = (n) => (opt(n) ?? '').split(',').filter(Boolean);
const onceFiles = list('--once');
const sonraFiles = list('--sonra');
if (!onceFiles.length || !sonraFiles.length) {
  console.error('Kullanım: node scripts/perf-compare.mjs --once o1.json,o2.json --sonra s1.json,s2.json [--tol 0.05]');
  process.exit(1);
}
const tol = Number(opt('--tol') ?? 0.05);
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const once = onceFiles.map(read);
const sonra = sonraFiles.map(read);
const all = [...once, ...sonra];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b === 0 ? 0 : (a / b - 1) * 100);

let fail = 0;
const rows = [];
const row = (ok, label, text) => {
  if (ok === false) fail++;
  rows.push(`${ok === null ? '  ·' : ok ? '  ✓' : '  ✗'} ${label.padEnd(30)} ${text}`);
};

const phases = Object.keys(once[0].phases ?? {});
for (const k of phases) {
  if (!all.every((r) => r.phases?.[k])) {
    row(false, `${k}`, 'bazı koşularda evre yok');
    continue;
  }
  const a = median(once.map((r) => r.phases[k].frameCpuMs.p50));
  const b = median(sonra.map((r) => r.phases[k].frameCpuMs.p50));
  const d = pct(b, a);
  row(Math.abs(d) <= tol * 100, `${k} kare CPU p50 [ms]`, `${a.toFixed(2)} → ${b.toFixed(2)}  (${d.toFixed(1)} %)  önce [${once.map((r) => r.phases[k].frameCpuMs.p50).join(', ')}] sonra [${sonra.map((r) => r.phases[k].frameCpuMs.p50).join(', ')}]`);
  for (const [key, label] of [
    ['draws', 'çizim/kare'],
    ['programsUsedInFrame', 'karede program'],
    ['programsCompiled', 'derlenen program'],
  ]) {
    const vals = all.map((r) => r.phases[k][key]);
    row(vals.every((v) => v === vals[0]), `${k} ${label}`, vals.join(' / '));
  }
}
const comp = all.map((r) => r.programs?.compiled);
row(comp.every((v) => v === comp[0]), 'oturum derlenen program', comp.join(' / '));
const info = (label, get) => {
  if (![...once, ...sonra].every((r) => typeof get(r) === 'number')) return;
  const a = median(once.map(get));
  const b = median(sonra.map(get));
  const f = (x) => String(+x.toFixed(3));
  row(null, label, `${f(a)} → ${f(b)}  (${pct(b, a).toFixed(1)} %) [bilgi]`);
};
info('yükleme menü [ms]', (r) => r.load.menuMs);
info('yükleme ilk kare [ms]', (r) => r.load.firstFrameMs);
for (const k of Object.keys(once[0].env ?? {})) info(`ortam ${k} [s]`, (r) => r.env[k].wallS);
info('yığın [MB]', (r) => r.heapMB);
const errs = all.flatMap((r) => r.errors ?? []);
row(errs.length === 0, 'sayfa hataları', String(errs.length));

console.log(`Çiftli kıyas: ${once.length} önce, ${sonra.length} sonra koşusu (±%${(tol * 100).toFixed(0)})\n${rows.join('\n')}`);
console.log(fail ? `\n${fail} ölçüt sınır dışında` : '\nBütün ölçütler sınır içinde');
process.exit(fail ? 1 : 0);
