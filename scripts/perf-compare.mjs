/**
 * perf-smoke koşularının çiftli kıyası (Dalga 0 kabulü; paket kapanışlarında
 * kare süresi kapısı). Tek soğuk koşunun kare CPU süresi dizüstünün ısıl
 * durumuna göre %5'ten fazla oynar; bu yüzden iki yapı sırayla dönüşümlü
 * koşulur (önce, sonra, önce, sonra) ve medyanlar kıyaslanır.
 *
 *   node scripts/perf-compare.mjs --once o1.json,o2.json --sonra s1.json,s2.json [--tol 0.05] [--expect beklenti.json]
 *
 * Varsayılan kapılar ("davranış değişmez" paketleri; dışındaysa çıkış kodu 1):
 *   kare CPU p50   evre başına sonra medyanı, önce medyanının ±tol'u içinde
 *   sayımlar       çizim/kare, karede kullanılan program, derlenen program
 *                  (evre başına ve oturum) bütün koşularda aynı (belirlenimli)
 * Yükleme ve ortam geçiş süreleri, üçgen sayısı ve yığın bilgi amaçlıdır.
 *
 * --expect: paketin bilerek değiştirdiği ölçüler için beklenti dosyası
 * (`{ "aciklama": "…", "kurallar": { anahtar: kural } }`). Anahtar
 * `<evre>.<ölçü>` (evre menu/hucre/ogle/gece ya da `*`), `oturum.<ölçü>`,
 * `yukleme.<ölçü>`, `ortam.<geçiş|*>.<ölçü>`. Ölçüler: evrede frameCpuP50,
 * draws, programsUsedInFrame, programsCompiled; oturumda programsCompiled,
 * unusedRatio; yüklemede menuMs, readyMs, firstFrameMs, longestTaskMs,
 * longTaskTotalMs (--load-runs koşularının medyanı); ortamda wallS,
 * longestTaskMs, longTaskTotalMs. Kurallar (a önce, b sonra medyanı):
 *   "="                 bütün koşular aynı (sayım varsayılanı)
 *   "≤" / "<="          b ≤ a (artmaz);  "≥" / ">=" b ≥ a (azalmaz)
 *   "≤ 6 ms" / "<= 6"   b ≤ 6 (mutlak; birim yalnız etiket)
 *   "≤ -10%"            b ≤ a × 0,9 (en az %10 azalma); "≥ 5%" en az %5 artış
 *   "+0.3 ms"           b ≤ a + 0,3 (mutlak artış payı)
 *   "±5%" / "5%"        |b/a − 1| ≤ %5 (kare süresi varsayılanı --tol)
 *   "bilgi"             yalnız gösterilir
 * Örnek (1A): `{ "kurallar": { "*.draws": "≤", "*.programsCompiled": "≤",
 * "oturum.programsCompiled": "≤", "oturum.unusedRatio": "≤ 0.1",
 * "ogle.frameCpuP50": "≤ 6 ms", "yukleme.firstFrameMs": "≤ 6000" } }`.
 *
 * Koşu örneği (PowerShell; önce yapısı 4202'de, sonra 4201'de önizlemede):
 *   foreach ($i in 1..2) { foreach ($p in @(@('once',4202),@('sonra',4201))) {
 *     node scripts/perf-smoke.mjs "http://localhost:$($p[1])/" --out "perf\$($p[0])-$i.json" } }
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (a === 0 ? 0 : (b / a - 1) * 100);

/** Kural metni → { op, v, rel } */
export function parseRule(text) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  if (t === 'bilgi') return { op: 'info' };
  if (t === '=') return { op: 'eq' };
  if (t === '≤' || t === '<=') return { op: 'le' };
  if (t === '≥' || t === '>=') return { op: 'ge' };
  let m = t.match(/^(≤|<=|≥|>=) ?(-?[\d.]+) ?(ms|s|%)?$/);
  if (m) return { op: m[1] === '≤' || m[1] === '<=' ? 'leAbs' : 'geAbs', v: Number(m[2]), rel: m[3] === '%' };
  m = t.match(/^\+ ?([\d.]+) ?(ms|s)?$/);
  if (m) return { op: 'plus', v: Number(m[1]) };
  m = t.match(/^±? ?([\d.]+) ?%$/);
  if (m) return { op: 'tol', v: Number(m[1]) / 100 };
  throw new Error(`Anlaşılmayan beklenti kuralı: "${text}"`);
}

/** Kural → [geçti mi (info: null), açıklama] */
export function checkRule(rule, onceVals, sonraVals) {
  const a = median(onceVals);
  const b = median(sonraVals);
  const all = [...onceVals, ...sonraVals];
  switch (rule.op) {
    case 'info':
      return [null, 'bilgi'];
    case 'eq':
      return [all.every((v) => v === all[0]), '='];
    case 'le':
      return [b <= a, '≤ önce'];
    case 'ge':
      return [b >= a, '≥ önce'];
    case 'leAbs':
      return rule.rel ? [pct(a, b) <= rule.v, `≤ ${rule.v} %`] : [b <= rule.v, `≤ ${rule.v}`];
    case 'geAbs':
      return rule.rel ? [pct(a, b) >= rule.v, `≥ ${rule.v} %`] : [b >= rule.v, `≥ ${rule.v}`];
    case 'plus':
      return [b <= a + rule.v, `≤ önce + ${rule.v}`];
    case 'tol':
      return [Math.abs(pct(a, b)) <= rule.v * 100, `±${(rule.v * 100).toFixed(0)} %`];
    default:
      throw new Error(`kural: ${rule.op}`);
  }
}

const COUNT_KEYS = ['draws', 'programsUsedInFrame', 'programsCompiled'];
const LABEL = {
  frameCpuP50: 'kare CPU p50 [ms]',
  draws: 'çizim/kare',
  programsUsedInFrame: 'karede program',
  programsCompiled: 'derlenen program',
  unusedRatio: 'kullanılmayan program oranı',
  menuMs: 'yükleme menü [ms]',
  readyMs: 'yükleme hazır [ms]',
  firstFrameMs: 'yükleme ilk kare [ms]',
  longestTaskMs: 'en uzun görev [ms]',
  longTaskTotalMs: 'uzun görev toplamı [ms]',
  wallS: 'süre [s]',
};

/** Ölçü tablosu: anahtar → { label, get, def (varsayılan kural) } */
function metricTable(sample, tol) {
  const rows = [];
  for (const k of Object.keys(sample.phases ?? {})) {
    rows.push({ key: `${k}.frameCpuP50`, star: `*.frameCpuP50`, label: `${k} ${LABEL.frameCpuP50}`, get: (r) => r.phases?.[k]?.frameCpuMs?.p50, def: `±${tol * 100}%` });
    for (const c of COUNT_KEYS) rows.push({ key: `${k}.${c}`, star: `*.${c}`, label: `${k} ${LABEL[c]}`, get: (r) => r.phases?.[k]?.[c], def: '=' });
  }
  rows.push({ key: 'oturum.programsCompiled', label: `oturum ${LABEL.programsCompiled}`, get: (r) => r.programs?.compiled, def: '=' });
  rows.push({ key: 'oturum.unusedRatio', label: `oturum ${LABEL.unusedRatio}`, get: (r) => r.programs?.unusedRatio, def: 'bilgi' });
  for (const c of ['menuMs', 'readyMs', 'firstFrameMs', 'longestTaskMs', 'longTaskTotalMs']) rows.push({ key: `yukleme.${c}`, label: LABEL[c], get: (r) => r.load?.[c], def: 'bilgi' });
  for (const k of Object.keys(sample.env ?? {})) {
    for (const c of ['wallS', 'longestTaskMs', 'longTaskTotalMs']) rows.push({ key: `ortam.${k}.${c}`, star: `ortam.*.${c}`, label: `ortam ${k} ${LABEL[c]}`, get: (r) => r.env?.[k]?.[c], def: 'bilgi' });
  }
  rows.push({ key: 'yigin', label: 'yığın [MB]', get: (r) => r.heapMB, def: 'bilgi' });
  return rows;
}

/** İki koşu kümesini kıyaslar; { rows, fail, unknown } */
export function compareRuns(once, sonra, { tol = 0.05, expect = null } = {}) {
  const rules = expect?.kurallar ?? {};
  const table = metricTable(once[0], tol);
  const known = new Set(table.flatMap((m) => [m.key, m.star].filter(Boolean)));
  const unknown = Object.keys(rules).filter((k) => !known.has(k));
  let fail = 0;
  const rows = [];
  const fmt = (x) => String(+Number(x).toFixed(3));
  for (const m of table) {
    const ruleText = rules[m.key] ?? (m.star ? rules[m.star] : undefined) ?? m.def;
    const rule = parseRule(ruleText);
    const a = once.map(m.get);
    const b = sonra.map(m.get);
    if (![...a, ...b].every((v) => typeof v === 'number')) {
      if (rule.op !== 'info' && rules[m.key] !== undefined) {
        fail++;
        rows.push(`  ✗ ${m.label.padEnd(34)} bazı koşularda ölçü yok`);
      }
      continue;
    }
    const [ok, desc] = checkRule(rule, a, b);
    if (ok === false) fail++;
    const mark = ok === null ? '  ·' : ok ? '  ✓' : '  ✗';
    const chg = rule.op === 'eq' ? [...a, ...b].join(' / ') : `${fmt(median(a))} → ${fmt(median(b))}  (${pct(median(a), median(b)).toFixed(1)} %)  önce [${a.map(fmt).join(', ')}] sonra [${b.map(fmt).join(', ')}]`;
    rows.push(`${mark} ${m.label.padEnd(34)} ${chg}  [${desc}${rules[m.key] !== undefined || (m.star && rules[m.star] !== undefined) ? ', beklenti' : ''}]`);
  }
  const errs = [...once, ...sonra].flatMap((r) => r.errors ?? []);
  if (errs.length) fail++;
  rows.push(`${errs.length ? '  ✗' : '  ✓'} ${'sayfa hataları'.padEnd(34)} ${errs.length}`);
  if (unknown.length) {
    fail++;
    rows.push(`  ✗ beklenti dosyasında bilinmeyen anahtar: ${unknown.join(', ')}`);
  }
  return { rows, fail, unknown };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : null;
  };
  const list = (n) => (opt(n) ?? '').split(',').filter(Boolean);
  const onceFiles = list('--once');
  const sonraFiles = list('--sonra');
  if (!onceFiles.length || !sonraFiles.length) {
    console.error('Kullanım: node scripts/perf-compare.mjs --once o1.json,o2.json --sonra s1.json,s2.json [--tol 0.05] [--expect beklenti.json]');
    process.exit(1);
  }
  const tol = Number(opt('--tol') ?? 0.05);
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const expect = opt('--expect') ? read(opt('--expect')) : null;
  const { rows, fail } = compareRuns(onceFiles.map(read), sonraFiles.map(read), { tol, expect });
  console.log(`Çiftli kıyas: ${onceFiles.length} önce, ${sonraFiles.length} sonra koşusu (±%${(tol * 100).toFixed(0)}${expect ? `, beklenti: ${opt('--expect')}` : ''})\n${rows.join('\n')}`);
  console.log(fail ? `\n${fail} ölçüt sınır dışında` : '\nBütün ölçütler sınır içinde');
  process.exit(fail ? 1 : 0);
}
