/**
 * Motor mimarisi (M5a): sihirbazın ve mimari kartlarının eksenleri. Mimari
 * saklanmaz; grafikten `architectureOf` ile türetilir. Mimari değişimi
 * grafiğe `applyArchitecture` dönüşüm tablosuyla uygulanır
 * (docs/M5A-SPEC.md §2.4).
 *
 * Geçerlilik tek kaynaktan gelir: mimariden kurulan grafik GRAPH_RULES'tan
 * geçmeli (kilitli kartın metni kuralın öğretici mesajıdır). Grafikle
 * anlatılamayan birkaç birleşim (pervaneli motorda art yakıcı, fansız
 * booster…) burada yerel olarak denetlenir. Yerleşimi henüz olmayan
 * mimariler (layouts READY=false) "yakında" diye kilitlidir.
 */

import { sizeEngine } from '../sim/design';
import {
  DEFAULT_MODULES,
  annularCombustorFor,
  describeArchitecture,
  donorModule,
  familyOf,
  fanRangeFor,
  fitCans,
  graphFromArchitecture,
  graphSkeleton,
  massFlowRangeFor,
  referenceFor,
  setMassFlow,
  templateGraph,
} from './defaults';
import { GraphError } from './errors';
import { computeGasPath, FlowpathError } from './flowpath';
import { buildEngine, checkGraph, GRAPH_RULES, toEngineDesign, type BuiltEngine } from './graph';
import { layoutNotReady } from './layouts/index';
import { deriveTraits } from './traits';
import { MODULE_ORDER } from './types';
import type { CombustorModule, CombustorStyle, CompressorModule, EngineGraph, EngineModule, InletModule, MixerModule, NozzleModule, NozzleStyle } from './types';

/** LP milini ne çeviriyor: alçak basınç kompresörü, fan, pervane ya da çıkış mili */
export type LpLoad = 'lpc' | 'fan' | 'propeller' | 'shaft';

export interface Architecture {
  /** Sihirbazın 1. sorusu; pervane 'shaft' çıkışlı sayılmaz (itki + mil) */
  output: 'thrust' | 'shaft';
  lpLoad: LpLoad;
  /** Yalnız lpLoad 'fan' */
  booster: boolean;
  /** HPC son kademe santrifüj */
  centrifugal: boolean;
  combustor: CombustorStyle;
  exhaust: 'single' | 'separate' | 'mixed';
  /** exhaust 'mixed' iken anlamlı */
  mixer: 'confluent' | 'lobed';
  afterburner: boolean;
  /** Art yakıcı varken değişken lüle */
  abNozzle: 'convergent' | 'cd';
  /** prop/shaft'ta yok sayılır */
  installation: 'bare' | 'nacelle';
}

export interface ArchCard {
  title: string;
  does: string;
  gains: string;
  costs: string;
  examples: string;
  lesson?: string;
  glossary?: string;
}

export interface ArchOption {
  axis: keyof Architecture;
  value: string | boolean;
  card: ArchCard;
  /** Zorunlu eşlik eden değişiklikler (kartta "Şunlar da değişir: …") */
  implies(a: Architecture): Partial<Architecture>;
  /** Hâlâ geçersizse GRAPH_RULES metni (kart kilitli, nedeni öğretir); M5b/M5c ise o metin */
  blocked(a: Architecture): string | null;
}

export type ArchChange =
  | { arch: Architecture; implied: { axis: keyof Architecture; from: unknown; to: unknown; reason: string }[] }
  | { blocked: string };

/**
 * Mimari uygulanırken seed'deki değeri korunamayan düğme (kırpıldı, motor
 * onunla kurulamadı ya da kutular sığmadı). Kartın eksen listesi bunları
 * göremez (grafiğe bağlı): atölye "Şunlar da değişti" bildiriminde gösterir.
 */
export interface ArchNote {
  knob: string;
  from: number;
  to: number;
  reason: string;
}

/* ------------------------------------------------------------------ */
/* Grafik → mimari                                                     */
/* ------------------------------------------------------------------ */

const AXES: readonly (keyof Architecture)[] = [
  'output',
  'lpLoad',
  'booster',
  'centrifugal',
  'combustor',
  'exhaust',
  'mixer',
  'afterburner',
  'abNozzle',
  'installation',
];

const freeTurbine = (a: Pick<Architecture, 'lpLoad'>) => a.lpLoad === 'propeller' || a.lpLoad === 'shaft';

/**
 * Anlamsız eksenleri kanonik değere çeker (karşılaştırma ve anahtar için):
 * çıkış LP yükünden; booster yalnız fanlı motorda; karıştırıcı stili
 * yalnız karışık akışta (yoksa 'confluent'); değişken lüle yalnız art
 * yakıcıyla (yoksa 'convergent'); serbest türbinli motorda egzoz tek ve
 * kurulum 'bare'. Gerçek (kuralla denetlenen) eksenlere dokunmaz.
 */
export function normalizeArchitecture(a: Architecture): Architecture {
  const ft = freeTurbine(a);
  return {
    output: a.lpLoad === 'shaft' ? 'shaft' : 'thrust',
    lpLoad: a.lpLoad,
    booster: a.lpLoad === 'fan' && a.booster,
    centrifugal: a.centrifugal,
    combustor: a.combustor,
    exhaust: ft ? 'single' : a.exhaust,
    mixer: !ft && a.exhaust === 'mixed' ? a.mixer : 'confluent',
    afterburner: a.afterburner,
    abNozzle: a.afterburner ? a.abNozzle : 'convergent',
    installation: ft ? 'bare' : a.installation,
  };
}

export function architectureOf(g: EngineGraph): Architecture {
  const t = deriveTraits(g);
  const mixer = g.modules.find((m) => m.type === 'mixer') as MixerModule | undefined;
  return normalizeArchitecture({
    output: t.lpLoad === 'shaft' ? 'shaft' : 'thrust',
    lpLoad: t.lpLoad,
    booster: t.booster,
    centrifugal: t.centrifugal,
    combustor: t.combustor,
    // Karıştırıcı varsa (baypassız geçersiz grafikte de) karışık sayılır
    exhaust: mixer ? 'mixed' : t.exhaust,
    mixer: mixer?.style ?? 'confluent',
    afterburner: t.afterburner,
    abNozzle: t.nozzle === 'cd' ? 'cd' : 'convergent',
    installation: g.modules.some((m) => m.type === 'inlet' && (m as InletModule).style === 'nacelle') ? 'nacelle' : 'bare',
  });
}

const COMB_KEY: Record<CombustorStyle, string> = { annular: 'ann', can: 'can', canAnnular: 'cna' };
const EXHAUST_KEY = { single: 'sgl', separate: 'sep', mixed: 'mix' } as const;

/** Aile gruplama anahtarı: 'fan+b|cf0|ann|mix:lobed|dry|nac' */
export function archKey(a: Architecture): string {
  const n = normalizeArchitecture(a);
  return [
    `${n.lpLoad}${n.booster ? '+b' : ''}`,
    `cf${n.centrifugal ? 1 : 0}`,
    COMB_KEY[n.combustor],
    n.exhaust === 'mixed' ? `mix:${n.mixer}` : EXHAUST_KEY[n.exhaust],
    n.afterburner ? `ab:${n.abNozzle}` : 'dry',
    n.installation === 'nacelle' ? 'nac' : 'bare',
  ].join('|');
}

/* ------------------------------------------------------------------ */
/* Dönüşüm tablosu (grafik üzerinde)                                   */
/* ------------------------------------------------------------------ */

const clone = <T>(x: T): T => structuredClone(x);
const find = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;
const bprOf = (g: EngineGraph) => find<CompressorModule>(g, 'fan')?.bypassRatio ?? 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Modülü akış sırasındaki yerine koyar (aynı tipteki eskisinin yerine) */
function put(g: EngineGraph, m: EngineModule): void {
  const i = g.modules.findIndex((x) => x.type === m.type);
  if (i >= 0) {
    g.modules[i] = m;
    return;
  }
  const k = MODULE_ORDER.indexOf(m.type);
  const j = g.modules.findIndex((x) => MODULE_ORDER.indexOf(x.type) > k);
  if (j < 0) g.modules.push(m);
  else g.modules.splice(j, 0, m);
}

function drop(g: EngineGraph, type: EngineModule['type']): void {
  g.modules = g.modules.filter((m) => m.type !== type);
}

/**
 * Yanma odası stil değişimi (§2.4): kutu sayısı (kutu 10, kutu-halka 8),
 * basınç kaybı (halka .04 / kutu-halka .05 / kutu .06), referans hız (halka
 * 20–43 arasında korunur, kutu ≥ 25), boy oranı (kutuda boy / kutu çapı:
 * 4,5; halkaya dönüşte ailenin halka yanma odasınınki).
 */
function convertCombustor(c: CombustorModule, to: Architecture): void {
  const D = DEFAULT_MODULES.combustor;
  if (to.combustor === 'annular') {
    const ann = annularCombustorFor(to);
    c.style = 'annular';
    delete c.cans;
    c.dp = D.annular.dp;
    c.refVelocity = clamp(c.refVelocity, D.annular.refVelocity[0], D.annular.refVelocity[1]);
    c.lengthHeight = ann.lengthHeight;
    c.injectors = ann.injectors;
    return;
  }
  const d = D[to.combustor];
  c.style = to.combustor;
  c.cans = d.cans;
  c.dp = d.dp;
  c.refVelocity = Math.max(c.refVelocity, d.refVelocityMin);
  c.lengthHeight = d.lengthHeight;
}

/** Mimarinin istediği lüle stili */
function nozzleStyleFor(a: Architecture): NozzleStyle {
  if (freeTurbine(a)) return 'stub';
  if (a.exhaust === 'separate') return 'separate';
  return a.afterburner ? a.abNozzle : 'fixed';
}

/**
 * Grafiği (yerinde) aynı LP yükündeki başka bir mimariye getirir: booster,
 * santrifüj kademe, yanma odası stili, egzoz/karıştırıcı, art yakıcı,
 * kurulum ve lüle (§2.4 dönüşüm tablosu). Geçersiz hedef olduğu gibi
 * kurulur; kurallar buildEngine'de öğretici hata verir.
 * LP yükü değişimi burada değil (applyArchitecture: yeni gaz jeneratörü).
 * `notes` verilirse korunamayan düğmeler (fan PR'ı, BPR) oraya yazılır.
 */
export function reshapeGraph(g: EngineGraph, next: Architecture, notes?: ArchNote[]): EngineGraph {
  const to = normalizeArchitecture(next);
  const hpc = find<CompressorModule>(g, 'hpc');

  // Kurulum: giriş biçimi; fan PR'ı ve BPR ailenin aralığına (§2.10: çıplak
  // PR 1,8–4,5 · BPR ≤ 1,5; kaportalı PR 1,3–2,0 · BPR ≥ 1; karışık
  // kaportalı PR 1,4–2,4 · BPR 1–7). Çekirdek akışı korunur. Askeri fan
  // (PR 3,1) kaportaya PR'ıyla girseydi BPR 1'de LPT çıkış kanalı kapanırdı.
  const inlet = find<InletModule>(g, 'inlet');
  if (inlet && !freeTurbine(to)) {
    const want = to.installation === 'nacelle' ? 'nacelle' : 'bellmouth';
    if (inlet.style !== want) {
      const src = want === 'nacelle' ? templateGraph('turbofan') : templateGraph(to.lpLoad === 'fan' ? 'militaryTurbofan' : 'turbojet');
      put(g, clone(find<InletModule>(src, 'inlet')!));
    }
    const fan = find<CompressorModule>(g, 'fan');
    const range = fanRangeFor(to);
    if (fan && range) {
      const pr = clamp(fan.pr, range.pr[0], range.pr[1]);
      if (pr !== fan.pr) {
        notes?.push({ knob: 'fan.pr', from: fan.pr, to: pr, reason: `Bu kurulumda fan basınç oranı ${fmt(range.pr[0])}–${fmt(range.pr[1])}: sınıra çekildi.` });
        fan.pr = pr;
      }
      const bpr = fan.bypassRatio ?? 0;
      const nb = clamp(bpr, range.bpr[0], range.bpr[1]);
      if (nb !== bpr) {
        notes?.push({ knob: 'fan.bypassRatio', from: bpr, to: nb, reason: `Bu kurulumda baypas oranı ${fmt(range.bpr[0])}–${fmt(range.bpr[1])}: sınıra çekildi (çekirdek akışı korunur).` });
        g.massFlow *= (1 + nb) / (1 + bpr);
        fan.bypassRatio = nb;
      }
    }
  }

  // Booster: çekirdeği önden besler, OPR onun basınç oranı kadar artar.
  // HPC basınç oranı ve fan.hubPRFraction olduğu gibi kalır: HP işi (dolayısıyla
  // T45 ve EGT payı) değişmez. (OPR'yi koruyup HPC'yi kısaltmak HP işini
  // LP miline kaydırır: askeri TF'de T45 29 K artıp EGT payı 44 → 15 K'e iner.)
  if (to.lpLoad === 'fan') {
    const lpc = find<CompressorModule>(g, 'lpc');
    if (to.booster && !lpc) {
      const b = donorModule<CompressorModule>('lpc', to)!;
      delete b.tipSpeed;
      // Booster PR'ı mevcut fana göre: çıplak motorda ya da yüksek PR'lı
      // (askeri) fanın arkasında yolcu TF booster'ı (1,95) fazla — askeri
      // TF kaportaya alınınca (BPR 1) LPT çıkış kanalı kapanırdı.
      const fanPR = find<CompressorModule>(g, 'fan')?.pr ?? 0;
      if (to.installation === 'bare' || fanPR > DEFAULT_MODULES.boosterFanPRMax) b.pr = DEFAULT_MODULES.bareBoosterPR;
      put(g, b);
    } else if (!to.booster && lpc) {
      drop(g, 'lpc');
    }
  }

  // Santrifüj son kademe: çark ve HPC uç hızı turboprop bağışçısından
  if (hpc && to.centrifugal && !hpc.centrifugal) {
    const d = find<CompressorModule>(templateGraph('turboprop'), 'hpc')!;
    hpc.centrifugal = clone(d.centrifugal!);
    hpc.tipSpeed = d.tipSpeed;
  } else if (hpc && !to.centrifugal && hpc.centrifugal) {
    delete hpc.centrifugal;
  }

  const c = find<CombustorModule>(g, 'combustor');
  if (c && c.style !== to.combustor) convertCombustor(c, to);

  // Egzoz: karıştırıcı (stil değişince önce bağışçınınki — stili tutuyorsa
  // kalibre kaybıyla, sihirbazla aynı motor — yoksa varsayılan), baypas kanalı
  const mixer = find<MixerModule>(g, 'mixer');
  if (to.exhaust === 'mixed') {
    if (!mixer || (mixer.style ?? 'confluent') !== to.mixer) {
      const d = donorModule<MixerModule>('mixer', to);
      put(g, d && (d.style ?? 'confluent') === to.mixer ? d : clone(DEFAULT_MODULES.mixer[to.mixer]));
    }
  } else if (mixer) {
    drop(g, 'mixer');
  }
  if (to.lpLoad === 'fan' && !g.bypassDuct) g.bypassDuct = clone(templateGraph(familyOf(to)).bypassDuct ?? { dp: 0.02, mach: 0.45 });
  if (to.lpLoad !== 'fan') delete g.bypassDuct;

  // Art yakıcı: baypaslıda askeri turbofanın, değilse turbojetin
  if (to.afterburner && !find(g, 'afterburner')) {
    const ab = donorModule('afterburner', to);
    if (ab) put(g, ab);
  } else if (!to.afterburner) {
    drop(g, 'afterburner');
  }

  // Lüle: stil değişince bağışçıdan ya da varsayılandan
  const noz = find<NozzleModule>(g, 'nozzle');
  const style = nozzleStyleFor(to);
  if (noz && noz.style !== style) {
    let n: NozzleModule;
    if (style === 'separate') n = clone(DEFAULT_MODULES.separateNozzle);
    else if (style === 'fixed') n = clone(DEFAULT_MODULES.fixedNozzle);
    else {
      n = donorModule<NozzleModule>('nozzle', to) ?? clone(DEFAULT_MODULES.fixedNozzle);
      n.style = style;
      if (noz.flaps !== undefined && style !== 'stub') n.flaps = noz.flaps;
    }
    put(g, n);
  } else if (noz && style !== 'separate') {
    delete noz.chevrons;
  }
  return g;
}

/**
 * Aileler arası anlamlı düğmeler (§2.10 kimlikleri ve aralıkları): LP yükü
 * değişince yeni gaz jeneratörüne seed'den taşınır, yeni ailenin aralığına
 * kırpılır. Geometri düğmeleri (Mach, göbek/uç, yükleme, boy oranı, uç
 * hızları) ailenin yerleşimine kalibre olduğu için bağışçıdan kalır.
 */
interface CarriedKnob {
  id: string;
  get(g: EngineGraph): number | undefined;
  set(g: EngineGraph, v: number): void;
  range(a: Architecture): [number, number];
  int?: boolean;
  /** Yanma odası stiline bağlı: yalnız seed'in stili hedefle aynıysa */
  sameCombustor?: boolean;
}

function moduleKnob(type: EngineModule['type'], key: string, range: CarriedKnob['range'], extra: Partial<CarriedKnob> = {}): CarriedKnob {
  const rec = (g: EngineGraph) => g.modules.find((m) => m.type === type) as unknown as Record<string, unknown> | undefined;
  return {
    id: `${type}.${key}`,
    get: (g) => {
      const v = rec(g)?.[key];
      return typeof v === 'number' ? v : undefined;
    },
    set: (g, v) => {
      const m = rec(g);
      if (m) m[key] = v;
    },
    range,
    ...extra,
  };
}

const CARRIED: readonly CarriedKnob[] = [
  moduleKnob('combustor', 'tit', () => [1000, 1900]),
  moduleKnob('hpc', 'pr', (a) => (freeTurbine(a) ? [6, 20] : [2, 25])),
  moduleKnob('hpc', 'eff', () => [0.8, 0.94]),
  moduleKnob('hpt', 'eff', () => [0.82, 0.94]),
  moduleKnob('lpt', 'eff', () => [0.82, 0.94]),
  moduleKnob('combustor', 'eff', () => [0.97, 0.999]),
  // Referans hız taşınmaz: aileye özgü boyutlandırma (TJ 43, TF/TP 8–20 m/s);
  // turbofanınki turbojete taşınınca yanma odası iki kat büyür, kutular sığmaz.
  moduleKnob('combustor', 'dp', () => [0.02, 0.08], { sameCombustor: true }),
  moduleKnob('combustor', 'cans', () => [6, 16], { sameCombustor: true, int: true }),
  moduleKnob('afterburner', 't7Max', () => [1600, 2200]),
  moduleKnob('afterburner', 'eta', () => [0.8, 0.95]),
  {
    id: 'engine.mechEff',
    get: (g) => g.mechEff,
    set: (g, v) => {
      g.mechEff = v;
    },
    range: () => [0.97, 0.995],
  },
];

const fmt = (v: number) => Number(v.toPrecision(4)).toLocaleString('tr-TR');

/**
 * Grafik kurulabiliyor mu (kutular sığdırılmış kopyada). Yerleşimi henüz
 * olmayan ailede gaz yoluna kadar denetlenir; o da yoksa doğrulanamaz.
 */
function buildCheck(g: EngineGraph, reference: BuiltEngine): { ok: true } | { ok: false; why: string } | { ok: null } {
  const t = fitCans(clone(g), reference);
  try {
    buildEngine(t, { reference });
    return { ok: true };
  } catch (e) {
    if (!(e instanceof FlowpathError && e.code === 'layout.notReady')) return { ok: false, why: (e as Error).message };
  }
  try {
    computeGasPath(t, sizeEngine(toEngineDesign(t, { reference })));
    return { ok: true };
  } catch {
    return { ok: null };
  }
}

/**
 * LP yükü değişimi: gaz jeneratörü yeni ailenin bağışçısından (fanlı
 * turbofanın HPC'si turboprobun santrifüjlü HPC'sine dönüşemez), ortak
 * düğmeler (CARRIED) seed'den. Taşınan değerle motor kurulamıyorsa
 * bağışçının değeri kalır ve nedeni nota yazılır.
 */
function changeLpLoad(seed: EngineGraph, from: Architecture, to: Architecture, notes: ArchNote[]): EngineGraph {
  const tpl = templateGraph(familyOf(to));
  const g = graphFromArchitecture(to, { massFlow: tpl.massFlow, name: seed.name });
  const reference = referenceFor(to);

  // Yeni fanın baypas oranı tablodan (çıplak 0,6 / kaportalı 6)
  const fan = find<CompressorModule>(g, 'fan');
  if (fan && from.lpLoad !== 'fan') fan.bypassRatio = DEFAULT_MODULES.newFanBPR[to.installation];

  // Çekirdek akışı korunur; ailenin hava akışı aralığına kırpılır (§2.10)
  const want = (seed.massFlow / (1 + bprOf(seed))) * (1 + bprOf(g));
  const [lo, hi] = massFlowRangeFor(to);
  const W = clamp(want, lo, hi);
  setMassFlow(g, W, tpl.massFlow);
  if (Math.abs(W / want - 1) > 1e-9) {
    notes.push({ knob: 'engine.massFlow', from: want, to: W, reason: `Yeni ailenin hava akışı aralığı ${fmt(lo)}–${fmt(hi)} kg/s: çekirdek akışı korunamadı.` });
  }

  // LPC ↔ fan uç hızı
  const oldFront = find<CompressorModule>(seed, from.lpLoad === 'fan' ? 'fan' : 'lpc');
  if (from.lpLoad === 'lpc' && to.lpLoad === 'fan' && oldFront?.tipSpeed) fan!.tipSpeed = clamp(oldFront.tipSpeed, 300, 560);
  if (from.lpLoad === 'fan' && to.lpLoad === 'lpc' && oldFront?.tipSpeed) find<CompressorModule>(g, 'lpc')!.tipSpeed = clamp(oldFront.tipSpeed, 300, 520);

  // Ortak düğmeler: önce bağışçı değerleriyle kurulabiliyor mu (değilse doğrulanamaz, hepsi taşınır)
  const verify = buildCheck(g, reference).ok === true;
  const sameComb = find<CombustorModule>(seed, 'combustor')?.style === to.combustor;
  for (const k of CARRIED) {
    if (k.sameCombustor && !sameComb) continue;
    const old = k.get(seed);
    const donor = k.get(g);
    if (old === undefined || donor === undefined) continue;
    const [a, b] = k.range(to);
    let v = clamp(old, a, b);
    if (k.int) v = Math.round(v);
    if (v !== donor) {
      k.set(g, v);
      if (verify) {
        const r = buildCheck(g, reference);
        if (r.ok === false) {
          k.set(g, donor);
          notes.push({ knob: k.id, from: old, to: donor, reason: `Bu değerle yeni motor kurulamıyor (${r.why}): ailenin değeri kullanıldı.` });
          continue;
        }
      }
    }
    if (v !== old) notes.push({ knob: k.id, from: old, to: v, reason: `Yeni ailenin aralığı ${fmt(a)}–${fmt(b)}: sınıra çekildi.` });
  }
  return g;
}

/**
 * Mimariye uygun grafik: modül ekler/çıkarır, ortak düğmeleri `seed`den
 * taşır. Çekirdek akışı korunur: massFlow' = massFlow·(1+bpr')/(1+bpr).
 *
 * LP yükü değişince gaz jeneratörü yeni ailenin şablonundan gelir, ortak
 * düğmeler (T4, HPC PR, verimler, yanma odası) seed'den taşınır; tablodaki
 * taşımalar (LPC↔fan uç hızı, yeni fanın BPR'ı) uygulanır. Aile değişince
 * `ops` atılır: çalışabilirlik yeni ailenin şablonundan ölçeklenir.
 * Korunamayan değerler `notes`'ta (kırpma, kurulamama, kutu sayısı).
 */
export function applyArchitectureReport(seed: EngineGraph, next: Architecture): { graph: EngineGraph; notes: ArchNote[] } {
  const from = architectureOf(seed);
  const to = normalizeArchitecture(next);
  const notes: ArchNote[] = [];
  let g: EngineGraph;
  if (from.lpLoad !== to.lpLoad) {
    g = changeLpLoad(seed, from, to, notes);
  } else {
    g = reshapeGraph(clone(seed), to, notes);
    delete g.kind;
    if (familyOf(from) !== familyOf(to)) delete g.ops;
    if (archKey(from) !== archKey(to)) g.summary = describeArchitecture(to);
  }
  // Kutular her mimari değişiminde yeniden sığdırılır: booster, kurulum ya da
  // akış değişimi çekirdeğin ortalama yarıçapını değiştirir
  const c = find<CombustorModule>(g, 'combustor');
  if (c && c.style !== 'annular') {
    const sc = find<CombustorModule>(seed, 'combustor');
    const seedCans = sc?.style === c.style ? sc.cans : undefined;
    const vref = c.refVelocity;
    fitCans(g, referenceFor(to));
    if (seedCans !== undefined && c.cans !== undefined && c.cans < seedCans) {
      addNote(notes, { knob: 'combustor.cans', from: seedCans, to: c.cans, reason: `${seedCans} kutu yeni çekirdeğin çevresine sığmıyor: sığana dek azaltıldı.` });
    }
    if (c.refVelocity > vref) {
      // Aynı LP yükünde kullanıcının değerinden (stil dönüşümü de onu değiştirmiş olabilir)
      const was = from.lpLoad === to.lpLoad && sc ? sc.refVelocity : vref;
      addNote(notes, { knob: 'combustor.refVelocity', from: was, to: c.refVelocity, reason: 'En az kutuyla bile çevreye sığmıyor: kutular incelsin diye referans hız artırıldı.' });
    }
  }
  return { graph: g, notes };
}

/** Aynı düğmenin notu varsa ilk değeri korunur, son değer ve neden güncellenir */
function addNote(notes: ArchNote[], n: ArchNote): void {
  const i = notes.findIndex((x) => x.knob === n.knob);
  if (i < 0) notes.push(n);
  else notes[i] = { ...n, from: notes[i].from };
}

/** applyArchitectureReport'un grafiği (§2.4 sözleşmesi) */
export function applyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph {
  return applyArchitectureReport(seed, next).graph;
}

/* ------------------------------------------------------------------ */
/* Geçerlilik                                                          */
/* ------------------------------------------------------------------ */

const ruleMsg = (id: string) => GRAPH_RULES.find((r) => r.id === id)!.msg;

/** Grafikle anlatılamayan ya da anlamsız seçimlerin metinleri */
const ARCH_MSG = {
  freeTurbineAb: 'Art yakıcı jet itkisini artırır: pervaneli ya da çıkış milli motorda gücün çoğu mile gider, egzoz kısa bir borudur.',
  booster: 'Booster fanın arkasındaki alçak basınç kompresörüdür: önce LP yükü olarak fanı seç.',
  freeTurbineExhaust: 'Pervaneli ve çıkış milli motorda baypas yok: egzoz kısa bir borudur.',
  mixerNoBypass: ruleMsg('mixer.bypass'),
} as const;

/**
 * Mimari kurulabilir mi: yerel kurallar → GRAPH_RULES (mimariden kurulan
 * grafikte) → yerleşim hazır mı. Geçerliyse null; değilse tipli hata
 * (GraphError.ruleId ya da FlowpathError.code = 'layout.notReady').
 */
export function checkArchitecture(a: Architecture): GraphError | FlowpathError | null {
  const n = normalizeArchitecture(a);
  // Önce GRAPH_RULES: buildEngine ile aynı kural ve metin (yerel kural ancak
  // kurallar sessizse; GRAPH_RULES'a eklenince kendiliğinden devre dışı kalır)
  const g = graphSkeleton(n, { massFlow: templateGraph(familyOf(n)).massFlow, name: '' });
  const e = checkGraph(g);
  if (e) return e;
  if (n.afterburner && freeTurbine(n)) return new GraphError(ARCH_MSG.freeTurbineAb, 'arch.freeTurbineAb', 'afterburner');
  const why = layoutNotReady(g);
  if (why) return new FlowpathError(why, 'layout.notReady', 'engine');
  return null;
}

/* ------------------------------------------------------------------ */
/* Seçenekler (mimari kartları)                                        */
/* ------------------------------------------------------------------ */

interface OptionSpec {
  axis: keyof Architecture;
  value: string | boolean;
  card: ArchCard;
  /** Seçenek uygulanmış mimaride zorunlu eşlik edenler */
  requires?(a: Architecture): Partial<Architecture>;
  /** Eşlik edenlerin nedeni (kartta "çünkü …") */
  why?: string;
  /** Gelecek kilometre taşı (kart hep kilitli) */
  future?: string;
}

const SPECS: readonly OptionSpec[] = [
  /* --- çıkış --- */
  {
    axis: 'output',
    value: 'thrust',
    card: {
      title: 'İtki',
      does: 'Motor gücünü jetle (ya da pervaneyle) itkiye çevirir.',
      gains: 'Uçağı doğrudan iter.',
      costs: 'Jet hızı yüksekse verim düşer.',
      examples: 'J79, CFM56, PW150',
      lesson: 'brayton',
    },
    requires: (a) => (a.lpLoad === 'shaft' ? { lpLoad: 'lpc' } : {}),
    why: 'itki üreten motorun LP mili kompresör, fan ya da pervane çevirir',
  },
  {
    axis: 'output',
    value: 'shaft',
    card: {
      title: 'Mil gücü',
      does: 'Gaz jeneratörünün gücü serbest türbinden bir mile verilir.',
      gains: 'Helikopter rotoru, jeneratör ya da pompa çevirir.',
      costs: 'Jet itkisi neredeyse yok.',
      examples: 'T700, Makila',
      glossary: 'shaftPower',
    },
    requires: () => ({ lpLoad: 'shaft' }),
    why: 'mil gücü serbest güç türbininin çıkış milinden alınır',
  },
  /* --- LP yükü --- */
  {
    axis: 'lpLoad',
    value: 'lpc',
    card: {
      title: 'Tek akış (turbojet)',
      does: 'LP mili yalnız alçak basınç kompresörünü çevirir; bütün hava çekirdekten geçer.',
      gains: 'Küçük çap, yüksek özgül itki, basit yapı.',
      costs: 'Yüksek jet hızı: TSFC ve jet gürültüsü yüksek.',
      examples: 'J79, J57',
      lesson: 'brayton',
      glossary: 'brayton',
    },
    requires: () => ({ output: 'thrust', booster: false, centrifugal: false, exhaust: 'single', installation: 'bare' }),
    why: 'baypassız motorda tek jet borusu var, kaporta fanlı motor içindir',
  },
  {
    axis: 'lpLoad',
    value: 'fan',
    card: {
      title: 'Fan (turbofan)',
      does: 'LP mili önde bir fan çevirir; havanın bir kısmı çekirdeğin yanından (baypas) geçer.',
      gains: 'Daha çok havayı daha yavaş itmek: TSFC ve gürültü düşer.',
      costs: 'Çap ve LPT büyür; yüksek hızda özgül itki düşer.',
      examples: 'CFM56, F100',
      lesson: 'anatomy',
      glossary: 'bpr',
    },
    requires: (a) => ({
      output: 'thrust',
      centrifugal: false,
      exhaust: a.exhaust === 'single' ? (a.installation === 'nacelle' ? 'separate' : 'mixed') : a.exhaust,
      ...(a.installation === 'nacelle' ? { booster: true } : {}),
    }),
    why: 'baypas havası ya ayrı lüleden çıkar ya da çekirdekle karışır',
  },
  {
    axis: 'lpLoad',
    value: 'propeller',
    card: {
      title: 'Pervane + redüktör (turboprop)',
      does: 'Serbest güç türbini, dişli kutusuyla yavaş dönen büyük bir pervaneyi çevirir.',
      gains: 'Düşük hızda en verimli itki; kısa pistten kalkış.',
      costs: 'Pervane ucu Mach sınırı yüksek hızı keser; redüktör ağır.',
      examples: 'PW150, T56',
      lesson: 'altitude',
      glossary: 'shaftPower',
    },
    requires: () => ({ output: 'thrust', centrifugal: true, booster: false, exhaust: 'single', afterburner: false, installation: 'bare' }),
    why: 'küçük gaz jeneratörü santrifüj son kademe ister, egzoz kısa bir borudur',
  },
  {
    axis: 'lpLoad',
    value: 'shaft',
    card: {
      title: 'Çıkış mili (turboşaft)',
      does: 'Serbest güç türbini gücü önden çıkan bir milden verir.',
      gains: 'Hafif ve küçük: helikopter rotoru ya da jeneratör çevirir.',
      costs: 'İtki yok; çıkış devri yükün valisine bağlı.',
      examples: 'T700, Makila',
      glossary: 'turboshaft',
    },
    requires: () => ({ output: 'shaft', centrifugal: true, booster: false, exhaust: 'single', afterburner: false, installation: 'bare' }),
    why: 'küçük gaz jeneratörü santrifüj son kademe ister, egzoz kısa bir borudur',
  },
  {
    axis: 'lpLoad',
    value: 'gearedFan',
    card: {
      title: 'Dişli fan',
      does: 'Fan, LPT’den bir redüktörle daha yavaş döner.',
      gains: 'Fan ve LPT kendi en iyi devrinde: daha az LPT kademesi, daha yüksek BPR.',
      costs: 'Redüktör ağır ve ısınır.',
      examples: 'PW1000G',
      glossary: 'bpr',
    },
    future: "Dişli fan M5b'de.",
  },
  {
    axis: 'lpLoad',
    value: 'openRotor',
    card: {
      title: 'Açık rotor',
      does: 'Kaportasız, karşıt dönen iki sıra geniş pal.',
      gains: 'Çok yüksek baypas: turboprop verimi, jete yakın hız.',
      costs: 'Gürültü ve kanat yerleşimi zor.',
      examples: 'GE36 UDF, CFM RISE',
    },
    future: "Açık rotor M5c'de.",
  },
  /* --- booster --- */
  {
    axis: 'booster',
    value: true,
    card: {
      title: 'Booster var',
      does: 'Fanın arkasında, fan miliyle dönen birkaç kademelik alçak basınç kompresörü.',
      gains: 'Çekirdeğe giren havayı önceden sıkıştırır: HPC kısalır.',
      costs: 'LP miline ek kademe ve kütle.',
      examples: 'CFM56',
      lesson: 'anatomy',
    },
  },
  {
    axis: 'booster',
    value: false,
    card: {
      title: 'Booster yok',
      does: 'Fanın göbek bölgesi çekirdeği doğrudan besler.',
      gains: 'Kısa ve hafif LP mili.',
      costs: 'Basıncın tamamını HPC yapar: daha çok HP kademesi.',
      examples: 'F100, F110',
    },
  },
  /* --- HPC --- */
  {
    axis: 'centrifugal',
    value: false,
    card: {
      title: 'Eksenel HPC',
      does: 'Bütün kademeler eksenel.',
      gains: 'Büyük akışta verimli ve ince.',
      costs: 'Küçük motorda son kanatlar çok kısalır, uç boşluğu verimi düşürür.',
      examples: 'CFM56, J79',
      glossary: 'opr',
    },
  },
  {
    axis: 'centrifugal',
    value: true,
    card: {
      title: 'Eksenel + santrifüj',
      does: 'Son kademe bir santrifüj çark: havayı dışa doğru savurarak sıkıştırır.',
      gains: 'Küçük akışta kısa kanat sorunu yok; sağlam ve kısa.',
      costs: 'Çap büyür; büyük motorda verimsiz.',
      examples: 'T700, PW100',
      glossary: 'opr',
    },
  },
  /* --- yanma odası --- */
  {
    axis: 'combustor',
    value: 'annular',
    card: {
      title: 'Halka',
      does: 'Tek halka biçimli gömlek, çevresinde yakıt enjektörleri.',
      gains: 'Kısa, hafif, basınç kaybı düşük; türbine düzgün sıcaklık.',
      costs: 'Bakımda bütün oda birlikte sökülür.',
      examples: 'CFM56, F100',
      lesson: 'brayton',
    },
  },
  {
    axis: 'combustor',
    value: 'can',
    card: {
      title: 'Kutu',
      does: 'Ayrı ayrı kutu gömlekler, her biri kendi basınç kabında; ateşleme geçiş borularıyla birbirine bağlı.',
      gains: 'Tek kutu test edilip değiştirilebilir; sağlam.',
      costs: 'Ağır, uzun, basınç kaybı yüksek.',
      examples: 'RR Dart, J33',
      lesson: 'start',
    },
  },
  {
    axis: 'combustor',
    value: 'canAnnular',
    card: {
      title: 'Kutu-halka',
      does: 'Kutu gömlekler ortak bir halka kasanın içinde.',
      gains: 'Kutunun kolay geliştirilmesi, halkanın hafif kasası.',
      costs: 'Halkadan ağır ve uzun; çıkışta sıcaklık daha düzensiz.',
      examples: 'J57, JT8D, J79',
      lesson: 'start',
    },
  },
  /* --- egzoz --- */
  {
    axis: 'exhaust',
    value: 'single',
    card: {
      title: 'Tek jet',
      does: 'Bütün gaz tek lüleden çıkar (baypas yok).',
      gains: 'Basit egzoz.',
      costs: 'Baypaslı motorda kullanılamaz.',
      examples: 'J79, PW150',
    },
  },
  {
    axis: 'exhaust',
    value: 'separate',
    card: {
      title: 'Ayrık akış',
      does: 'Baypas havası fan kanalının kendi lülesinden, çekirdek gazı iç lüleden çıkar.',
      gains: 'Kısa kaporta, hafif.',
      costs: 'Karışmadan kalan sıcak çekirdek jeti biraz verim ve ses bedeli.',
      examples: 'CFM56-7',
      glossary: 'bpr',
    },
    requires: () => ({ afterburner: false, installation: 'nacelle' }),
    why: 'ayrık lüleli motor kaportalıdır ve art yakıcısı olmaz',
  },
  {
    axis: 'exhaust',
    value: 'mixed',
    card: {
      title: 'Karışık akış',
      does: 'Baypas ve çekirdek akışı karıştırıcıda buluşur, ortak lüleden çıkar.',
      gains: 'Sıcak ve soğuk akış ısıyı paylaşır: TSFC %1–3 iyi, jet sesi düşer.',
      costs: 'Uzun kanal ve karıştırıcı: kütle artar.',
      examples: 'CFM56-5C, F100, TFE731',
      glossary: 'mixer',
    },
  },
  {
    axis: 'mixer',
    value: 'confluent',
    card: {
      title: 'Düz karıştırıcı',
      does: 'İki akış düz bir halkada yan yana buluşur, jet borusunda kısmen karışır.',
      gains: 'Basit ve hafif; sürtünme kaybı az.',
      costs: 'Karışma eksik kalır (verim ~%85).',
      examples: 'F100, CFM56-5C',
      glossary: 'mixer',
    },
    requires: () => ({ exhaust: 'mixed' }),
    why: 'karıştırıcı karışık akışlı egzozun parçasıdır',
  },
  {
    axis: 'mixer',
    value: 'lobed',
    card: {
      title: "Lobe'lu karıştırıcı",
      does: 'Çiçek biçimli lobe’lar akışları iç içe geçirir.',
      gains: 'Karışma neredeyse tam (verim ~%97): TSFC ve ses düşer.',
      costs: 'Ek sürtünme kaybı ve kütle.',
      examples: 'TFE731, PW300',
      glossary: 'mixer',
    },
    requires: () => ({ exhaust: 'mixed' }),
    why: 'karıştırıcı karışık akışlı egzozun parçasıdır',
  },
  /* --- art yakıcı --- */
  {
    axis: 'afterburner',
    value: true,
    card: {
      title: 'Art yakıcı var',
      does: 'Türbinden sonra jet borusunda ikinci kez yakıt yakılır.',
      gains: 'Kısa süreli %40–70 ek itki (kalkış, ses üstü hız).',
      costs: 'Yakıt tüketimi 2–3 kat; değişken lüle ve uzun jet borusu ağır.',
      examples: 'J79, F100',
      lesson: 'fadec',
    },
    requires: (a) => ({ installation: 'bare', ...(a.lpLoad === 'fan' ? { exhaust: 'mixed', abNozzle: 'cd' } : {}) }),
    why: 'art yakıcı tek bir jet borusunda yanar ve değişken lüle ister; kaportalı motorda yer yok',
  },
  {
    axis: 'afterburner',
    value: false,
    card: {
      title: 'Art yakıcı yok',
      does: 'Lüle sabit yakınsak.',
      gains: 'Hafif, kısa, ekonomik.',
      costs: 'İtki çekirdekle sınırlı.',
      examples: 'J57, CFM56',
    },
  },
  {
    axis: 'abNozzle',
    value: 'convergent',
    card: {
      title: 'Değişken yakınsak lüle',
      does: 'Yapraklar art yakıcı yanınca açılır; ağız boğazdır.',
      gains: 'Basit, hafif.',
      costs: 'Yüksek basınç oranında jet tam genleşmez.',
      examples: 'J79',
    },
    requires: () => ({ afterburner: true }),
    why: 'değişken kesitli lüle yalnız art yakıcıyla gerekir',
  },
  {
    axis: 'abNozzle',
    value: 'cd',
    card: {
      title: 'Yakınsak-ıraksak lüle',
      does: 'Boğazdan sonra açılan ikinci yaprak sırası jeti ses üstüne genleştirir.',
      gains: 'Yüksek basınç oranında daha çok itki.',
      costs: 'Ağır ve karmaşık.',
      examples: 'F100, F110',
    },
    requires: () => ({ afterburner: true }),
    why: 'değişken kesitli lüle yalnız art yakıcıyla gerekir',
  },
  /* --- kurulum --- */
  {
    axis: 'installation',
    value: 'nacelle',
    card: {
      title: 'Kaportalı',
      does: 'Fan ve motor, kanattan sarkan bir kaportanın içinde; giriş dudaklı.',
      gains: 'Yolcu uçağı yerleşimi; fan kanalı baypas akışını taşır.',
      costs: 'Kaporta kütlesi ve sürtünmesi.',
      examples: 'CFM56, CF6',
      glossary: 'bpr',
    },
    requires: () => ({ booster: true, afterburner: false }),
    why: 'kaportalı turbofan şimdilik booster ister ve art yakıcısı olmaz',
  },
  {
    axis: 'installation',
    value: 'bare',
    card: {
      title: 'Çıplak',
      does: 'Motor gövdenin içine gömülür; test hücresinde ağızlık (bellmouth) takılır.',
      gains: 'Kısa ve dar: savaş uçağı gövdesine sığar.',
      costs: 'Yüksek baypas oranı için kaporta gerekir.',
      examples: 'J79, F100',
    },
    requires: (a) => (a.exhaust === 'separate' ? { exhaust: 'mixed' } : {}),
    why: 'çıplak motorda baypas akışı karıştırılır',
  },
];

const specOf = (axis: keyof Architecture, value: unknown) => SPECS.find((s) => s.axis === axis && s.value === value);

/** Seçim normalleştirmede anlamını yitirirse (ör. fansız booster) öğretici metin */
function meaningless(n: Architecture, axis: keyof Architecture): string {
  switch (axis) {
    case 'booster':
      return ARCH_MSG.booster;
    case 'exhaust':
      return ARCH_MSG.freeTurbineExhaust;
    case 'mixer':
      return freeTurbine(n) ? ARCH_MSG.freeTurbineExhaust : ARCH_MSG.mixerNoBypass;
    case 'installation':
      return ruleMsg('inlet.nacelle');
    case 'abNozzle':
      return freeTurbine(n) ? ARCH_MSG.freeTurbineAb : ruleMsg('nozzle.variableNeedsAb');
    default:
      return 'Bu seçenek bu mimaride anlamsız.';
  }
}

/**
 * Bir eksen değişimi: seçimi uygular, zorunlu eşlik edenleri zincir halinde
 * ekler (kullanıcının seçtiği eksen asla geri çevrilmez), sonra mimariyi
 * denetler. Geçersizse kuralın öğretici metniyle `{ blocked }`.
 */
export function resolveChange(a: Architecture, axis: keyof Architecture, value: unknown): ArchChange {
  const spec = specOf(axis, value);
  if (!spec) return { blocked: `Bilinmeyen mimari seçeneği: ${String(axis)} = ${String(value)}.` };
  if (spec.future) return { blocked: spec.future };
  const start = normalizeArchitecture(a);
  const cur: Architecture = { ...start, [axis]: value } as Architecture;
  const reasons = new Map<keyof Architecture, string>();
  const queue: (keyof Architecture)[] = [axis];
  for (let guard = 0; queue.length && guard < 32; guard++) {
    const ax = queue.shift()!;
    const s = specOf(ax, cur[ax]);
    const req = s?.requires?.(cur) ?? {};
    for (const k of Object.keys(req) as (keyof Architecture)[]) {
      if (k === axis || cur[k] === req[k]) continue;
      (cur as unknown as Record<string, unknown>)[k] = req[k];
      reasons.set(k, `${s!.card.title}: ${s!.why ?? 'zorunlu eşlik eden değişiklik'}`);
      queue.push(k);
    }
  }
  const n = normalizeArchitecture(cur);
  if (n[axis] !== value) return { blocked: meaningless(n, axis) };
  const err = checkArchitecture(n);
  if (err) return { blocked: err.message };
  const implied = AXES.filter((k) => k !== axis && n[k] !== start[k]).map((k) => ({
    axis: k,
    from: start[k] as unknown,
    to: n[k] as unknown,
    reason: reasons.get(k) ?? 'Mimari tutarlılığı',
  }));
  return { arch: n, implied };
}

/** Mimari kartları: eksen başına seçenekler; kilitli kart nedenini öğretir */
export const ARCH_OPTIONS: readonly ArchOption[] = SPECS.map(
  (s): ArchOption => ({
    axis: s.axis,
    value: s.value,
    card: s.card,
    implies(a) {
      const r = resolveChange(a, s.axis, s.value);
      if ('blocked' in r) return {};
      return Object.fromEntries(r.implied.map((i) => [i.axis, i.to])) as Partial<Architecture>;
    },
    blocked(a) {
      if (s.future) return s.future;
      const r = resolveChange(a, s.axis, s.value);
      return 'blocked' in r ? r.blocked : null;
    },
  }),
);
