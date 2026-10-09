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

import { DEFAULT_MODULES, annularCombustorFor, describeArchitecture, donorModule, familyOf, fitCans, graphFromArchitecture, graphSkeleton, referenceFor, setMassFlow, templateGraph } from './defaults';
import { GraphError } from './errors';
import { FlowpathError } from './flowpath';
import { checkGraph, GRAPH_RULES } from './graph';
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
 */
export function reshapeGraph(g: EngineGraph, next: Architecture): EngineGraph {
  const to = normalizeArchitecture(next);
  const hpc = find<CompressorModule>(g, 'hpc');

  // Booster: çekirdeği önden besler, OPR onun basınç oranı kadar artar.
  // HPC basınç oranı ve fan.hubPRFraction olduğu gibi kalır: HP işi (dolayısıyla
  // T45 ve EGT payı) değişmez. (OPR'yi koruyup HPC'yi kısaltmak HP işini
  // LP miline kaydırır: askeri TF'de T45 29 K artıp EGT payı 44 → 15 K'e iner.)
  if (to.lpLoad === 'fan') {
    const lpc = find<CompressorModule>(g, 'lpc');
    if (to.booster && !lpc) {
      const b = donorModule<CompressorModule>('lpc', to)!;
      delete b.tipSpeed;
      if (to.installation === 'bare') b.pr = DEFAULT_MODULES.bareBoosterPR;
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

  // Egzoz: karıştırıcı (stil değişince varsayılanları), baypas kanalı
  const mixer = find<MixerModule>(g, 'mixer');
  if (to.exhaust === 'mixed') {
    if (!mixer || (mixer.style ?? 'confluent') !== to.mixer) put(g, clone(DEFAULT_MODULES.mixer[to.mixer]));
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

  // Kurulum: giriş biçimi; BPR kaportada ≥ 1, çıplakta ≤ 1,5 (çekirdek akışı korunur)
  const inlet = find<InletModule>(g, 'inlet');
  if (inlet && !freeTurbine(to)) {
    const want = to.installation === 'nacelle' ? 'nacelle' : 'bellmouth';
    if (inlet.style !== want) {
      const src = want === 'nacelle' ? templateGraph('turbofan') : templateGraph(to.lpLoad === 'fan' ? 'militaryTurbofan' : 'turbojet');
      put(g, clone(find<InletModule>(src, 'inlet')!));
    }
    const fan = find<CompressorModule>(g, 'fan');
    if (fan) {
      const bpr = fan.bypassRatio ?? 0;
      const next = to.installation === 'nacelle' ? Math.max(bpr, 1) : Math.min(bpr, 1.5);
      if (next !== bpr) {
        g.massFlow *= (1 + next) / (1 + bpr);
        fan.bypassRatio = next;
      }
    }
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
 * Mimariye uygun grafik: modül ekler/çıkarır, ortak düğmeleri `seed`den
 * taşır. Çekirdek akışı korunur: massFlow' = massFlow·(1+bpr')/(1+bpr).
 *
 * LP yükü değişince gaz jeneratörü yeni ailenin şablonundan gelir (fanlı
 * turbofanın HPC'si turboprobun santrifüjlü HPC'sine dönüşemez); tablodaki
 * taşımalar uygulanır (LPC↔fan uç hızı). Aile değişince `ops` atılır:
 * çalışabilirlik yeni ailenin şablonundan ölçeklenir.
 */
export function applyArchitecture(seed: EngineGraph, next: Architecture): EngineGraph {
  const from = architectureOf(seed);
  const to = normalizeArchitecture(next);
  if (from.lpLoad !== to.lpLoad) {
    const core = seed.massFlow / (1 + bprOf(seed));
    const tpl = templateGraph(familyOf(to));
    const g = graphFromArchitecture(to, { massFlow: tpl.massFlow, name: seed.name });
    setMassFlow(g, core * (1 + bprOf(g)), tpl.massFlow);
    const oldFront = find<CompressorModule>(seed, from.lpLoad === 'fan' ? 'fan' : 'lpc');
    if (from.lpLoad === 'lpc' && to.lpLoad === 'fan' && oldFront?.tipSpeed) find<CompressorModule>(g, 'fan')!.tipSpeed = clamp(oldFront.tipSpeed, 300, 560);
    if (from.lpLoad === 'fan' && to.lpLoad === 'lpc' && oldFront?.tipSpeed) find<CompressorModule>(g, 'lpc')!.tipSpeed = clamp(oldFront.tipSpeed, 300, 520);
    return g;
  }
  const g = reshapeGraph(clone(seed), to);
  delete g.kind;
  if (familyOf(from) !== familyOf(to)) delete g.ops;
  if (from.combustor !== to.combustor) fitCans(g, referenceFor(to));
  if (archKey(from) !== archKey(to)) g.summary = describeArchitecture(to);
  return g;
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
  if (n.afterburner && freeTurbine(n)) return new GraphError(ARCH_MSG.freeTurbineAb, 'arch.freeTurbineAb', 'afterburner');
  const g = graphSkeleton(n, { massFlow: templateGraph(familyOf(n)).massFlow, name: '' });
  const e = checkGraph(g);
  if (e) return e;
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
