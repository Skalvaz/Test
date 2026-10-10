/**
 * Sonuç özeti (M5a): üretilmiş motordan sonuç panelinin, uyarıların ve
 * görevlerin okuduğu sayılar (docs/M5A-SPEC.md §2.12).
 *
 * Tasarım noktası ISA deniz seviyesi statiktir (sizeEngine varsayılanı).
 * Birimler SI: itki N, güç W, sıcaklık K, boy m; yalnız yakıt tüketimleri
 * alışılmış birimlerde (TSFC g/(kN·s), SFC g/(kW·h)).
 */

import { AIR, GAS, type GasProps } from '../sim/gas';
import type { RowKey } from './flowpath';
import type { BuiltEngine } from './graph';
import type { CombustorStyle, CompressorModule } from './types';

/** Turbomakine sırası özeti */
export interface RowSummary {
  stages: number;
  uTip: number;
  uMean: number;
  loading: number;
  hExitMm: number;
  rpm: number;
  mrelTip?: number;
  an2?: number;
}

export interface DesignSummary {
  output: 'thrust' | 'propeller' | 'shaft';
  /**
   * N, N, W. Pervaneli motorda `thrust` jet artığı + durağan pervane itkisi
   * (simülasyonun anlık itkisiyle aynı tanım).
   */
  thrust: number;
  thrustWet?: number;
  /** Çıkış mil gücü [W] (turboşaftta çıkış flanşında, ×transmissionEff) */
  shaftPower?: number;
  /** g/(kN·s) */
  tsfc?: number;
  /** g/(kW·h) */
  sfc?: number;
  mass: number;
  massParts: Record<string, number>;
  cgZ: number;
  /** Azami (art yakıcılıda yaş) itki / ağırlık */
  thrustToWeight?: number;
  /** kW/kg */
  powerToWeight?: number;
  /** Kuru itki / hava akışı [N·s/kg] */
  specificThrust?: number;
  diameter: number;
  length: number;
  opr: number;
  bpr: number;
  fpr?: number;
  t3: number;
  t4: number;
  t45: number;
  /** limits.egtAmber − (T45 − 273,15) [K] */
  egtMargin: number;
  rpm: { lp: number; hp: number };
  gearRatio?: number;
  rows: Partial<Record<'front' | 'booster' | 'hpc' | 'hpt' | 'lpt', RowSummary>>;
  impellerUTip?: number;
  hptInletMach: number;
  combustor: { style: CombustorStyle; vref: number; length: number; height: number; cans?: number };
  mixerPR?: number;
  velocityRatio?: number;
  /** "1+3 · 9 · 2+6" */
  stagesLabel: string;
}

export interface SummaryDelta {
  key: keyof DesignSummary | string;
  abs: number;
  rel: number;
  /** true: iyileşme, false: kötüleşme, null: nötr (çap/boy) */
  better: boolean | null;
  text: string;
}

/** Sonuç panelindeki sınır çubuğu */
export interface LimitGauge {
  id: string;
  label: string;
  unit: string;
  value: number;
  caution: number;
  warning?: number;
  dir: 'above' | 'below';
  parts: string[];
  glossary?: string;
  /** Temel görünümde mi, yalnız uzmanda mı (M5a P3 eki) */
  level?: 'basic' | 'expert';
}

const G0 = 9.80665;
const KELVIN = 273.15;

/* ------------------------------------------------------------------ */
/* Sayı biçimi (tr-TR)                                                 */
/* ------------------------------------------------------------------ */

/** Biçimlendiriciler basamak sayısına göre önbellekte (her çağrıda kurmak ~50 µs) */
const FORMATS = new Map<number, Intl.NumberFormat>();

/** tr-TR sayı: ondalık virgül, binlik nokta; −0 yazılmaz */
export function fmtNum(v: number, digits = 0): string {
  let f = FORMATS.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    FORMATS.set(digits, f);
  }
  const r = Number(v.toFixed(digits));
  return f.format(Object.is(r, -0) ? 0 : r);
}

/** İşaretli (+/−) sayı; değişim çipleri için */
export function fmtSigned(v: number, digits = 0): string {
  const r = Number(Math.abs(v).toFixed(digits));
  const s = fmtNum(r, digits);
  return r === 0 ? s : (v > 0 ? '+' : '−') + s;
}

/** Bilimsel gösterim: 4,20·10⁷ */
export function fmtSci(v: number, digits = 2): string {
  if (v === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(v)));
  // Mantis yuvarlanınca 10'a ulaşırsa üs kayar (9,996·10⁷ → 1,00·10⁸)
  if (Math.abs(Number((v / 10 ** e).toFixed(digits))) >= 10) e++;
  const sup = String(e)
    .split('')
    .map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(c)] ?? (c === '-' ? '⁻' : c))
    .join('');
  return `${fmtNum(v / 10 ** e, digits)}·10${sup}`;
}

/* ------------------------------------------------------------------ */
/* Özet                                                                */
/* ------------------------------------------------------------------ */

/** Toplam koşullardan statik basınca ideal genişleme hızı [m/s] */
function jetVelocity(pt: number, tt: number, p0: number, g: GasProps): number {
  if (!(pt > p0)) return 0;
  return Math.sqrt(2 * g.cp * tt * (1 - Math.pow(p0 / pt, (g.gamma - 1) / g.gamma)));
}

/** Kademe etiketi: "1+3 · 9 · 2+6" (LP kompresörleri · HPC · türbinler) */
function stagesLabelOf(rows: DesignSummary['rows'], centrifugal: boolean): string {
  const parts: string[] = [];
  const lp = [rows.front?.stages, rows.booster?.stages].filter((n): n is number => n !== undefined);
  if (lp.length) parts.push(lp.join('+'));
  if (rows.hpc) parts.push(centrifugal ? `${rows.hpc.stages}+çark` : String(rows.hpc.stages));
  parts.push(`${rows.hpt?.stages ?? 0}+${rows.lpt?.stages ?? 0}`);
  return parts.join(' · ');
}

export function summarize(b: BuiltEngine): DesignSummary {
  const { design: d, sized, flowpath: fp, traits: t } = b;
  const st = sized.point.stations;
  const m = fp.metrics;
  const W2 = d.massFlow;
  const Wf = sized.point.wf;

  // Pervane: durağan itki momentum teorisinden (başarı katsayısıyla), simülasyonla aynı
  let propThrust = 0;
  if (d.prop) {
    const rho0 = st['0'].P / (AIR.R * st['0'].T);
    const area = (Math.PI * d.prop.diameter ** 2) / 4;
    propThrust = Math.cbrt((d.prop.figureOfMerit * Math.max(sized.ref.shaftPower, 0)) ** 2 * 2 * rho0 * area);
  }
  const thrust = sized.point.thrust + propThrust;
  const jet = t.output === 'thrust';
  // Mil gücü çıkışta: turboşaftta aktarma kaybı sonrası (ref.outputPower),
  // turbopropta güç türbini gücü (pervane itkisi yukarıda ondan)
  const shaftPower = jet ? undefined : sized.ref.outputPower;
  const thrustWet = d.afterburner ? sized.point.thrustWet : undefined;
  const mass = m.mass.total;

  const rows: DesignSummary['rows'] = {};
  for (const k of Object.keys(m.rows) as RowKey[]) {
    const r = m.rows[k]!;
    rows[k] = { stages: r.stages, uTip: r.uTip, uMean: r.uMean, loading: r.loading, hExitMm: r.hExit * 1000, rpm: r.rpm };
  }
  if (rows.front) rows.front.mrelTip = m.tipMachRel.lp;
  if (rows.hpc) rows.hpc.mrelTip = m.tipMachRel.hp;
  if (rows.hpt) rows.hpt.an2 = m.an2.hpt;
  if (rows.lpt) rows.lpt.an2 = m.an2.lpt;

  // Karıştırıcı düzleminde baypas / çekirdek toplam basınç oranı
  const P19t = st['13'].P * (1 - d.bypassDuctDP);
  const hasMixer = t.exhaust === 'mixed';
  const mixerPR = hasMixer ? P19t / st['5'].P : undefined;
  // Ayrık akış: baypas / çekirdek jet hızı oranı (ideal genişleme)
  const velocityRatio =
    t.exhaust === 'separate' ? jetVelocity(P19t, st['13'].T, st['0'].P, AIR) / Math.max(jetVelocity(st['5'].P, st['5'].T, st['0'].P, GAS), 1e-9) : undefined;

  const fan = b.graph.modules.find((x): x is CompressorModule => x.type === 'fan');

  return {
    output: t.output,
    thrust,
    thrustWet,
    shaftPower,
    tsfc: jet && thrust > 0 ? (Wf / thrust) * 1e6 : undefined,
    sfc: !jet && shaftPower && shaftPower > 0 ? (Wf / shaftPower) * 3.6e9 : undefined,
    mass,
    massParts: { ...m.mass.parts },
    cgZ: m.mass.cgZ,
    thrustToWeight: jet ? (thrustWet ?? thrust) / (mass * G0) : undefined,
    powerToWeight: shaftPower !== undefined ? shaftPower / 1000 / mass : undefined,
    specificThrust: jet ? sized.point.thrust / W2 : undefined,
    diameter: m.diameter,
    length: m.length,
    opr: sized.point.opr,
    bpr: d.bypassRatio,
    fpr: fan ? fan.pr : undefined,
    t3: st['3'].T,
    t4: st['4'].T,
    t45: st['45'].T,
    egtMargin: d.limits.egtAmber - (st['45'].T - KELVIN),
    rpm: { lp: fp.rpm.lp, hp: fp.rpm.hp },
    gearRatio: m.gearRatio,
    rows,
    impellerUTip: m.impellerUTip,
    hptInletMach: m.hptInletMach,
    combustor: { ...m.combustor },
    mixerPR,
    velocityRatio,
    stagesLabel: stagesLabelOf(rows, t.centrifugal),
  };
}

/* ------------------------------------------------------------------ */
/* Karşılaştırma                                                       */
/* ------------------------------------------------------------------ */

interface DeltaSpec {
  key: keyof DesignSummary;
  label: string;
  /** Gösterim: çarpan, birim, basamak */
  factor: number;
  unit: string;
  digits: number;
  /** Artış iyi mi (true), kötü mü (false), nötr mü (null) */
  up: boolean | null;
  /** Yüzde olarak yaz */
  percent?: boolean;
}

const DELTAS: readonly DeltaSpec[] = [
  { key: 'thrust', label: 'İtki', factor: 1e-3, unit: 'kN', digits: 1, up: true },
  { key: 'thrustWet', label: 'Art yakıcılı itki', factor: 1e-3, unit: 'kN', digits: 1, up: true },
  { key: 'shaftPower', label: 'Mil gücü', factor: 1e-3, unit: 'kW', digits: 0, up: true },
  { key: 'tsfc', label: 'TSFC', factor: 1, unit: '%', digits: 1, up: false, percent: true },
  { key: 'sfc', label: 'SFC', factor: 1, unit: '%', digits: 1, up: false, percent: true },
  { key: 'mass', label: 'kütle', factor: 1, unit: 'kg', digits: 0, up: false },
  { key: 'thrustToWeight', label: 'T/W', factor: 1, unit: '', digits: 2, up: true },
  { key: 'powerToWeight', label: 'güç/ağırlık', factor: 1, unit: 'kW/kg', digits: 2, up: true },
  { key: 'diameter', label: 'çap', factor: 1, unit: 'm', digits: 2, up: null },
  { key: 'length', label: 'boy', factor: 1, unit: 'm', digits: 2, up: null },
  { key: 'opr', label: 'OPR', factor: 1, unit: '', digits: 1, up: null },
  { key: 't4', label: 'T4', factor: 1, unit: 'K', digits: 0, up: null },
  { key: 'egtMargin', label: 'EGT payı', factor: 1, unit: 'K', digits: 0, up: true },
];

/** a → b değişimi (kıyas noktası a). Değişmeyen büyüklükler listede yok. */
export function diffSummary(a: DesignSummary, b: DesignSummary): SummaryDelta[] {
  const out: SummaryDelta[] = [];
  for (const s of DELTAS) {
    const va = a[s.key] as number | undefined;
    const vb = b[s.key] as number | undefined;
    if (typeof va !== 'number' || typeof vb !== 'number' || !Number.isFinite(va) || !Number.isFinite(vb)) continue;
    const abs = vb - va;
    const rel = va !== 0 ? abs / Math.abs(va) : 0;
    // Gösterimde sıfıra yuvarlanan değişim yazılmaz
    const shown = s.percent ? rel * 100 : abs * s.factor;
    if (Math.abs(shown) < 0.5 * 10 ** -s.digits) continue;
    const better = s.up === null ? null : s.up ? abs > 0 : abs < 0;
    const unit = s.unit ? (s.unit === '%' ? ' %' : ` ${s.unit}`) : '';
    out.push({ key: s.key, abs, rel, better, text: `${s.label} ${fmtSigned(shown, s.digits)}${unit}` });
  }
  return out;
}

const ROW_NAMES: Record<RowKey, string> = { front: 'Ön kompresör', booster: 'Booster', hpc: 'HPC', hpt: 'HPT', lpt: 'LPT' };
const PART_NAMES: Record<string, string> = {
  lpc: 'LPC',
  booster: 'Booster',
  hpc: 'HPC',
  combustor: 'Yanma odası',
  hpt: 'HPT',
  lpt: 'LPT',
  shafts: 'Miller',
  externals: 'Dış donanım',
  fan: 'Fan',
  fanCase: 'Fan muhafazası',
  casing: 'Gövde',
  afterburner: 'Art yakıcı',
  nozzle: 'Lüle',
  exhaust: 'Egzoz',
  gearbox: 'Redüktör',
  propeller: 'Pervane',
  // Turboşaft (M5a P7)
  inlet: 'Giriş çerçevesi',
  outputShaft: 'Çıkış mili',
};

/** Neden zinciri: kademe ve devir değişimleri, en büyük 3 kütle katkısı */
export function explainDelta(a: DesignSummary, b: DesignSummary): string[] {
  const out: string[] = [];
  for (const k of Object.keys(ROW_NAMES) as RowKey[]) {
    const ra = a.rows[k];
    const rb = b.rows[k];
    if (ra && rb && ra.stages !== rb.stages) out.push(`${ROW_NAMES[k]} ${ra.stages} → ${rb.stages} kademe`);
    else if (!ra && rb) out.push(`${ROW_NAMES[k]} eklendi (${rb.stages} kademe)`);
    else if (ra && !rb) out.push(`${ROW_NAMES[k]} kalktı`);
  }
  for (const [spool, name] of [
    ['lp', 'LP'],
    ['hp', 'HP'],
  ] as const) {
    const ra = a.rpm[spool];
    const rb = b.rpm[spool];
    if (ra > 0 && Math.abs(rb / ra - 1) > 0.01) out.push(`${name} devri ${fmtNum(ra)} → ${fmtNum(rb)} rpm`);
  }
  const keys = new Set([...Object.keys(a.massParts), ...Object.keys(b.massParts)]);
  const dm = [...keys]
    .map((k) => ({ k, d: (b.massParts[k] ?? 0) - (a.massParts[k] ?? 0) }))
    .filter((x) => Math.abs(x.d) >= 0.5)
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .slice(0, 3);
  for (const { k, d } of dm) out.push(`${PART_NAMES[k] ?? k} ${fmtSigned(d)} kg`);
  return out;
}
