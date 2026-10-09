/**
 * Mimariden grafik: bağışçı şablon modülleri ve hedef itki/güç için hava
 * akışı (docs/M5A-SPEC.md §2.4). Bağışçılar kalibrasyondan (§4) SONRAKİ
 * şablon değerlerini kullanır: üretilen her mimari uyarısız başlar.
 *
 * Bağışçı = aile şablonu (catalog.ts TEMPLATES). Henüz eklenmemiş aileler
 * (kuru turbojet P5, karışık kaportalı turbofan P6, turboşaft P7) için
 * şartnamenin grafikleri taban şablondan ÇALIŞMA ANINDA türetilir; böylece
 * taban şablon yeniden kalibre edilince (P2) yedek de onu izler, aile
 * şablonu eklenince yedek kendiliğinden devre dışı kalır.
 *
 * Üretilen grafikte `kind` (türetilir) ve `ops` (aile şablonundan
 * ölçeklenir, operability.ts) yoktur: `buildEngine(g, { reference:
 * referenceFor(a) })` ile kurulur.
 */

import { DesignError, sizeEngine } from '../sim/design';
import { architectureOf, normalizeArchitecture, reshapeGraph, type Architecture } from './architecture';
import { TEMPLATES } from './catalog';
import { computeGasPath, FlowpathError } from './flowpath';
import { buildEngine, toEngineDesign, type BuiltEngine } from './graph';
import { knobRange } from './knobs';
import type { TemplateId } from './templates';
import { deriveTraits, type EngineTraits } from './traits';
import type {
  CombustorModule,
  CombustorStyle,
  CompressorModule,
  EngineGraph,
  EngineModule,
  InletModule,
  MixerModule,
  ModuleType,
  NozzleModule,
  PropellerModule,
  ShaftModule,
  TurbineModule,
} from './types';

/** Modül bağışçısı: TJ turbojet, MTF askeri TF, TF yolcu TF, TP turboprop, TS turboşaft, TJD kuru TJ, TFM karışık TF */
export type Donor = 'TJ' | 'MTF' | 'TF' | 'TP' | 'TS' | 'TJD' | 'TFM';

export const DONOR_TEMPLATE: Record<Donor, TemplateId> = {
  TJ: 'turbojet',
  TJD: 'turbojetDry',
  MTF: 'militaryTurbofan',
  TFM: 'turbofanMixed',
  TF: 'turbofan',
  TP: 'turboprop',
  TS: 'turboshaft',
};

const TEMPLATE_DONOR: Record<TemplateId, Donor> = {
  turbojet: 'TJ',
  turbojetDry: 'TJD',
  militaryTurbofan: 'MTF',
  turbofanMixed: 'TFM',
  turbofan: 'TF',
  turboprop: 'TP',
  turboshaft: 'TS',
};

/**
 * Bağışçısı olmayan ya da biçim değiştiren modüllerin varsayılanları
 * (§2.4 dönüşüm tablosu, §6.3): sabit lüle, kutu / kutu-halka yanma odası,
 * düz ve lobe'lu karıştırıcı, çıkış mili.
 */
export const DEFAULT_MODULES = {
  /** Art yakıcısız motorun sabit yakınsak lülesi */
  fixedNozzle: { type: 'nozzle', style: 'fixed', cv: 0.98 } as NozzleModule,
  /** Ayrık akışlı lüle (chevron'suz) */
  separateNozzle: { type: 'nozzle', style: 'separate', cv: 0.985 } as NozzleModule,
  /** Stile göre yanma odası: kutu sayısı, basınç kaybı, en düşük referans hızı, boy oranı */
  combustor: {
    annular: { dp: 0.04, refVelocity: [20, 43] as [number, number] },
    canAnnular: { cans: 8, dp: 0.05, refVelocityMin: 25, refVelocity: 35, lengthHeight: 4.5 },
    can: { cans: 10, dp: 0.06, refVelocityMin: 25, refVelocity: 35, lengthHeight: 4.5 },
  },
  /**
   * Karıştırıcı kayıpları (toplam basınç). Lobe'lu sacın ıslak alanı ve
   * lobe'ların oluşturduğu eksenel girdaplar düz halkadan biraz fazla
   * kayıp verir, ama düz karıştırıcı da aynı karışmayı ancak daha uzun bir
   * boruda (sürtünme) yakalar: fark küçüktür, ikisi de yüzde bir
   * mertebesinde. M5a P6: 0,015 → 0,012. Yüksek baypasta (BPR
   * ~6,5) tam karışma kazancı ~%2,4, karışma verimi farkı (0,97 − 0,85)
   * kazancın yalnız ~%0,3'ünü getirir; 0,015'te lobe'lu düzden kötüydü
   * (başa baş ~0,0126). 0,012 düşük ve yüksek baypasta lobe'luyu öne koyar
   * (turbofanMixed.test.ts).
   */
  mixer: {
    confluent: { type: 'mixer', style: 'confluent', loss: 0.01 } as MixerModule,
    lobed: { type: 'mixer', style: 'lobed', loss: 0.012, lobes: 18 } as MixerModule,
  },
  shaft: { type: 'shaft', rpm: 20900, drive: 'front', reduction: false, transmissionEff: 0.985, gearboxLength: 0.35 } as ShaftModule,
  /**
   * Çıplak (düşük baypaslı) fanlı motora eklenen booster'ın basınç oranı.
   * Yolcu turbofanınınki (1,95) burada fazla: LP mili çalıştırmada marşla
   * dönmediği için ışıklanmada hava az kalır, EGT çalıştırma limitini aşar
   * (askeri TF'de 1,7'de sıcak çalıştırma, 1,3'te tepe 709/800 °C).
   * M5a entegrasyonu: P2 askeri TF fanını karışma dengesine çekince (PR
   * 3,1 → 4,3) fan göbeği LP milinden daha çok iş ister; 1,3'te tepe
   * 872/800 °C (sıcak çalıştırma), 1,15'te 795, 1,1'de 772 °C. HPC PR'ı
   * OPR'yi korumak için bölmek tepeyi yalnız ~30 K indirir, EGT payını
   * 94 → 70 K düşürür; bu yüzden HPC aynı kalır, booster hafifler
   * (OPR 35 → 38,8, T3 926 K).
   */
  bareBoosterPR: 1.1,
  /**
   * Bu fan basınç oranının üstünde (askeri, çıplak sınıf fan; kaportalı fan
   * aralığı knobs.ts'te ayrık 1,4–1,8, karışık 1,4–2,4) eklenen booster da
   * düşük PR'lı (bareBoosterPR) olur: PR 3,1'lik fanın arkasına 1,95'lik
   * booster LPT çıkış kanalını kapatır.
   */
  boosterFanPRMax: 2.0,
} as const;

/* ------------------------------------------------------------------ */
/* Aile şablonları ve yedekleri                                        */
/* ------------------------------------------------------------------ */

const clone = <T>(x: T): T => structuredClone(x);
const modOf = <T extends EngineModule>(g: EngineGraph, type: T['type']) => g.modules.find((m) => m.type === type) as T | undefined;

/** Taban şablon (bugün var olan dört aileden biri) */
function base(id: 'turbojet' | 'militaryTurbofan' | 'turbofan' | 'turboprop'): EngineGraph {
  const g = TEMPLATES[id];
  if (!g) throw new Error(`Taban şablon yok: ${id}`);
  return g;
}

/** Şablon yoksa taban şablonu (çalışabilirlik referansı ve yedek grafiğin kökü) */
const FALLBACK_BASE: Partial<Record<TemplateId, 'turbojet' | 'militaryTurbofan' | 'turbofan' | 'turboprop'>> = {
  turbojetDry: 'turbojet',
  turbofanMixed: 'turbofan',
  turboshaft: 'turboprop',
};

/**
 * Henüz eklenmemiş aile şablonlarının şartname grafikleri (§3.2, §3.4,
 * §3.5): taban şablonun klonu + şartnamede yazılı alanlar. P5/P6/P7 aile
 * şablonunu kalibre edip TEMPLATES'e ekleyince kullanılmaz.
 */
const FALLBACKS: Partial<Record<TemplateId, () => EngineGraph>> = {
  // §3.2: J57/J79-kuru sınıfı; TJ'nin gaz yolu, kutu-halka yanma odası, sabit lüle
  turbojetDry: () => {
    const g = clone(base('turbojet'));
    g.name = 'Sade turbojet';
    g.summary = 'Art yakıcısız tek akışlı turbojet: kutu-halka yanma odası, sabit yakınsak lüle (J57, J79 kuru sınıfı).';
    g.modules = g.modules.filter((m) => m.type !== 'afterburner');
    const c = modOf<CombustorModule>(g, 'combustor')!;
    Object.assign(c, { style: 'canAnnular', cans: 8, dp: 0.05, refVelocity: 35, lengthHeight: 4.5 });
    g.modules[g.modules.length - 1] = clone(DEFAULT_MODULES.fixedNozzle);
    return g;
  },
  // §3.4: CFM56-5C4 sınıfı; TF bağışçısı, lobe'lu karıştırıcı, uzun kanal, ortak sabit lüle
  turbofanMixed: () => {
    const g = clone(base('turbofan'));
    g.name = 'Karışık akışlı turbofan';
    g.summary = 'Kaportalı, uzun kanallı karışık akışlı turbofan: lobe’lu karıştırıcı, ortak sabit lüle (CFM56-5C sınıfı).';
    g.massFlow = 465;
    g.bypassDuct = { dp: 0.02, mach: 0.45 };
    Object.assign(modOf<CompressorModule>(g, 'fan')!, { pr: 1.6, bypassRatio: 6.5, tipSpeed: 430 });
    Object.assign(modOf<CompressorModule>(g, 'lpc')!, { pr: 1.9 });
    Object.assign(modOf<CompressorModule>(g, 'hpc')!, { pr: 12.5 });
    Object.assign(modOf<CombustorModule>(g, 'combustor')!, { tit: 1600, refVelocity: 20, lengthHeight: 2.6 });
    const i = g.modules.findIndex((m) => m.type === 'nozzle');
    g.modules.splice(i, 1, { type: 'mixer', style: 'lobed', lobes: 18, loss: 0.012 }, { type: 'nozzle', style: 'fixed', cv: 0.985 });
    return g;
  },
  // §3.5: T700-GE-701C sınıfı; TP gaz jeneratörü, önden çıkışlı mil, halka giriş
  turboshaft: () => {
    const g = clone(base('turboprop'));
    g.name = 'Turboşaft';
    g.summary = 'Serbest güç türbinli turboşaft: önden çıkışlı mil, halka giriş, eksenel + santrifüj gaz jeneratörü (T700 sınıfı).';
    g.massFlow = 4.5;
    g.accessoryPower = 15e3;
    g.modules = g.modules.filter((m) => m.type !== 'propeller');
    g.modules.unshift(clone(DEFAULT_MODULES.shaft));
    Object.assign(modOf<InletModule>(g, 'inlet')!, { style: 'annular', separator: true, length: 0.3, noseLength: 0, struts: 0 });
    const hpc = modOf<CompressorModule>(g, 'hpc')!;
    Object.assign(hpc, { pr: 17, tipSpeed: 440, mach: [0.45, 0.25], hubTip: 0.5 });
    hpc.centrifugal = { workFraction: 0.45, loading: 0.72, diffuserRatio: 1.6, gap: 1.1 };
    Object.assign(modOf<CombustorModule>(g, 'combustor')!, { style: 'annular', tit: 1500, refVelocity: 20, lengthHeight: 5 });
    Object.assign(modOf<TurbineModule>(g, 'hpt')!, { mach: [0.1, 0.3], hubTip: 0.85, loading: 1.6 });
    Object.assign(modOf<TurbineModule>(g, 'lpt')!, { tipSpeed: 420, mach: [0.15, 0.32] });
    Object.assign(modOf<NozzleModule>(g, 'nozzle')!, { style: 'stub', exitMach: 0.15, pressureRatio: 1.05, cv: 0.97 });
    return g;
  },
};

/** Aile şablonunun grafiği: TEMPLATES'te varsa o, yoksa şartname yedeği (salt okunur) */
export function templateGraph(id: TemplateId): EngineGraph {
  const t = TEMPLATES[id];
  if (t) return t;
  const f = FALLBACKS[id];
  if (!f) throw new Error(`Şablon yok: ${id}`);
  return f();
}

/**
 * Mimarinin ailesi: çalışabilirlik referansı ve modül bağışçısı. Çıplak
 * fanlı motor (art yakıcılı ya da kuru, Spey sınıfı) askeri turbofan
 * ailesindendir.
 */
export function familyOf(a: Architecture): TemplateId {
  switch (a.lpLoad) {
    case 'propeller':
      return 'turboprop';
    case 'shaft':
      return 'turboshaft';
    case 'lpc':
      return a.afterburner ? 'turbojet' : 'turbojetDry';
    case 'fan':
      if (a.installation === 'nacelle') return a.exhaust === 'mixed' ? 'turbofanMixed' : 'turbofan';
      return 'militaryTurbofan';
  }
}

const familyTraitsCache = new Map<TemplateId, EngineTraits>();

/**
 * Mimarinin ailesinin türetilmiş tipi (aile şablonundan): aile düzeyindeki
 * düğme aralıkları (hava akışı, fan) için. Aralıklar tek kaynaktan,
 * knobs.ts `knobRange`'den gelir (§2.10). Yanma odası stiline ya da art
 * yakıcıya bağlı aralıklar için grafiğin kendi tipi kullanılmalı.
 */
function familyTraits(a: Architecture): EngineTraits {
  const fam = familyOf(normalizeArchitecture(a));
  let t = familyTraitsCache.get(fam);
  if (!t) {
    t = deriveTraits(templateGraph(fam));
    familyTraitsCache.set(fam, t);
  }
  return t;
}

/** Mimarinin ailesinin hava akışı aralığı [kg/s] (§2.10 `engine.massFlow`; `solveMassFlow` bu aralıkta arar) */
export function massFlowRangeFor(a: Architecture): [number, number] {
  return knobRange('engine.massFlow', familyTraits(a))!;
}

/** Mimarinin ailesindeki fan basınç oranı ve baypas oranı aralıkları (§2.10 `fan.pr`, `fan.bypassRatio`; fansızda undefined) */
export function fanRangeFor(a: Architecture): { pr: [number, number]; bpr: [number, number] } | undefined {
  const t = familyTraits(a);
  const pr = knobRange('fan.pr', t);
  const bpr = knobRange('fan.bypassRatio', t);
  return pr && bpr ? { pr, bpr } : undefined;
}

/** Modül tipinin bağışçısı (§2.4): çoğu modül ailenin şablonundan */
export function donorFor(m: ModuleType, a: Architecture): Donor {
  const n = normalizeArchitecture(a);
  const fam = TEMPLATE_DONOR[familyOf(n)];
  switch (m) {
    case 'propeller':
      return 'TP';
    case 'shaft':
      return 'TS';
    case 'afterburner':
      return n.lpLoad === 'fan' ? 'MTF' : 'TJ';
    case 'mixer':
      return n.installation === 'nacelle' ? 'TFM' : 'MTF';
    case 'lpc':
      // Fanlı motorda LPC booster'dır: yolcu turbofanının booster'ı
      return n.lpLoad === 'fan' ? (n.installation === 'nacelle' && n.exhaust === 'mixed' ? 'TFM' : 'TF') : fam;
    case 'nozzle':
      if (n.afterburner && (n.lpLoad === 'lpc' || n.lpLoad === 'fan')) return n.lpLoad === 'fan' ? 'MTF' : 'TJ';
      return fam;
    default:
      return fam;
  }
}

/** Bağışçının modülü (klon); bağışçıda yoksa undefined */
export function donorModule<T extends EngineModule>(m: T['type'], a: Architecture): T | undefined {
  const g = templateGraph(DONOR_TEMPLATE[donorFor(m, a)]);
  const x = modOf<T>(g, m);
  return x ? clone(x) : undefined;
}

/** Ailenin `combustor` stili halka ise o modül, değilse halka bağışçısının (boy oranı/ref. hız için) */
export function annularCombustorFor(a: Architecture): CombustorModule {
  const fam = familyOf(a);
  const own = modOf<CombustorModule>(templateGraph(fam), 'combustor')!;
  if (own.style === 'annular') return clone(own);
  const b = FALLBACK_BASE[fam];
  return clone(modOf<CombustorModule>(templateGraph(b ?? fam), 'combustor')!);
}

/* ------------------------------------------------------------------ */
/* Çalışabilirlik referansı                                            */
/* ------------------------------------------------------------------ */

const references = new Map<TemplateId, BuiltEngine>();

/**
 * Mimarinin çalışabilirlik referansı (§2.8: ailenin şablonu; sihirbazda
 * bağışçı). Aile şablonu henüz yoksa ya da yerleşimi hazır değilse taban
 * şablon (kuru TJ → TJ, karışık TF → TF, turboşaft → TP). Önbellekli.
 */
export function referenceFor(a: Architecture): BuiltEngine {
  const fam = familyOf(normalizeArchitecture(a));
  let r = references.get(fam);
  if (r) return r;
  const own = TEMPLATES[fam];
  if (own) {
    try {
      r = buildEngine(own);
    } catch {
      r = undefined;
    }
  }
  r ??= buildEngine(base(FALLBACK_BASE[fam] ?? (fam as 'turbojet')));
  references.set(fam, r);
  return r;
}

/* ------------------------------------------------------------------ */
/* Mimariden grafik                                                    */
/* ------------------------------------------------------------------ */

/** Mimarinin kısa Türkçe tanımı (grafiğin `summary` alanı) */
export function describeArchitecture(a: Architecture): string {
  const n = normalizeArchitecture(a);
  const comb: Record<CombustorStyle, string> = { annular: 'halka', can: 'kutu', canAnnular: 'kutu-halka' };
  const parts: string[] = [];
  switch (n.lpLoad) {
    case 'lpc':
      parts.push('Tek akışlı turbojet');
      break;
    case 'fan':
      parts.push(n.exhaust === 'separate' ? 'Ayrık akışlı turbofan' : `Karışık akışlı turbofan (${n.mixer === 'lobed' ? 'lobe’lu' : 'düz'} karıştırıcı)`);
      if (n.booster) parts.push('booster');
      break;
    case 'propeller':
      parts.push('Turboprop: serbest güç türbini, pervane redüktörü');
      break;
    case 'shaft':
      parts.push('Turboşaft: serbest güç türbini, önden çıkışlı mil');
      break;
  }
  if (n.centrifugal) parts.push('eksenel + santrifüj HPC');
  parts.push(`${comb[n.combustor]} yanma odası`);
  if (n.lpLoad === 'lpc' || n.lpLoad === 'fan') {
    parts.push(n.afterburner ? `art yakıcı, ${n.abNozzle === 'cd' ? 'yakınsak-ıraksak' : 'yakınsak'} değişken lüle` : 'art yakıcısız');
    parts.push(n.installation === 'nacelle' ? 'kaportalı' : 'çıplak');
  }
  return `${parts.join(', ')}.`;
}

/**
 * Hava akışını yazar; pervaneyi gücün karekökü ölçüsünde büyütür (uç hızı
 * sabit: devir çapla ters orantılı). `tplMassFlow`: modül değerlerinin ait
 * olduğu akış.
 */
export function setMassFlow(g: EngineGraph, massFlow: number, tplMassFlow: number): EngineGraph {
  g.massFlow = massFlow;
  const p = modOf<PropellerModule>(g, 'propeller');
  if (p && tplMassFlow > 0) {
    const d = Math.min(5, Math.max(1.5, p.diameter * Math.sqrt(massFlow / tplMassFlow)));
    p.rpm = Math.min(2000, Math.max(900, (p.rpm * p.diameter) / d));
    p.diameter = d;
  }
  return g;
}

/**
 * Kutu referans hızının sığdırmada çıkılabilecek üst sınırı [m/s]: kutu
 * yanma odası uyarısının (combustorVelHigh caution 52) %4 içinde.
 */
export const CAN_FIT_VREF_MAX = 50;
/** Sığdırmada referans hızın en küçük artışı [m/s] */
const FIT_VREF_STEP = 0.1;
/** Sığdırma denemesi üst sınırı: 16 → 6 kutu + 0 → 50 m/s yaklaşık 60 adım */
const FIT_MAX_TRIES = 200;

/**
 * Kutu sayısını çevreye sığacak kadar azaltır (en az 6); 6 kutu da
 * sığmıyorsa referans hızı (kutular incelir) %10'luk adımlarla en çok
 * CAN_FIT_VREF_MAX'a çıkarır. Kutu çapı toplam kesitten (referans hız)
 * çıkar; ortalama yarıçapı küçük motorda (TJ, askeri TF) varsayılan 10/8
 * kutu sığmaz. Sığma ölçekten bağımsızdır (bütün uzunluklar √W ile
 * büyür). Yalnız çevrim + gaz yolu (~0,3 ms/deneme); başka bir hata
 * (geçersiz grafik, hazır olmayan gaz yolu) olduğu gibi bırakılır,
 * buildEngine raporlar.
 *
 * Her adım ilerler (en az FIT_VREF_STEP m/s): dosyadan gelen 0 ya da
 * 0,04 m/s'lik referans hızda %10 adım iki basamağa yuvarlanınca yerinde
 * sayardı (0,04·1,1 → 0,04) ve döngü ana iş parçacığını kilitlerdi. Deneme
 * sayısı da sınırlı (FIT_MAX_TRIES).
 */
export function fitCans(g: EngineGraph, reference?: BuiltEngine): EngineGraph {
  const c = modOf<CombustorModule>(g, 'combustor');
  if (!c || c.style === 'annular' || c.cans === undefined) return g;
  const ref = hasFullOps(g) ? undefined : (reference ?? referenceFor(architectureOf(g)));
  for (let tries = 0; tries < FIT_MAX_TRIES; tries++) {
    try {
      computeGasPath(g, sizeEngine(toEngineDesign(g, { reference: ref })));
      return g;
    } catch (e) {
      if (!(e instanceof FlowpathError && e.code === 'combustor.cansFit')) return g;
      if (c.cans > 6) c.cans--;
      else if (c.refVelocity < CAN_FIT_VREF_MAX) c.refVelocity = nextFitVelocity(c.refVelocity);
      else return g;
    }
  }
  return g;
}

/** Sığdırmada sonraki referans hızı: %10 (iki basamak), en az FIT_VREF_STEP, en çok CAN_FIT_VREF_MAX */
export function nextFitVelocity(v: number): number {
  const base = Number.isFinite(v) && v > 0 ? v : 0;
  return Math.min(CAN_FIT_VREF_MAX, Math.max(Number((base * 1.1).toFixed(2)), base + FIT_VREF_STEP));
}

/**
 * Mimarinin iskelet grafiği: ailenin şablonu + mimarinin geri kalanı
 * (dönüşüm tablosu, architecture.ts reshapeGraph), kutu sığdırması yok.
 * Kural denetimi (checkArchitecture) bunu kullanır: ucuz.
 */
export function graphSkeleton(a: Architecture, size: { massFlow: number; name: string }): EngineGraph {
  const n = normalizeArchitecture(a);
  const tpl = templateGraph(familyOf(n));
  const g = reshapeGraph(clone(tpl), n);
  delete g.kind;
  delete g.ops;
  g.name = size.name;
  g.summary = describeArchitecture(n);
  return setMassFlow(g, size.massFlow, tpl.massFlow);
}

/**
 * Mimariye uygun grafik: iskelet + kutu sığdırması. Geçersiz birleşim
 * olduğu gibi kurulur: `buildEngine` beklenen GraphError'ı verir. Aile
 * şablonunun kendi mimarisinde sonuç şablonla aynıdır (`kind`, `ops`,
 * ad, özet ve akış dışında).
 */
export function graphFromArchitecture(a: Architecture, size: { massFlow: number; name: string }): EngineGraph {
  return fitCans(graphSkeleton(a, size), referenceFor(a));
}

/* ------------------------------------------------------------------ */
/* Hedef itki / güç                                                    */
/* ------------------------------------------------------------------ */

const hasFullOps = (g: EngineGraph) => !!(g.ops?.inertia && g.ops.hpcMap && g.ops.limits && g.ops.start);

/**
 * Hedef itki [N] ya da mil gücü [W] için hava akışı: 30 adımlı ikiye bölme,
 * log uzayında, ailenin hava akışı aralığında (dışındaysa uç değer).
 * Yalnız tasarım noktası çevrimi (yerleşim gerekmez, ~0,05 ms/adım).
 * Tasarım noktası itkisi devirden bağımsızdır; aksesuar gücü referanstan
 * çekirdek akışıyla ölçeklenir (operability.ts). Pervane çapı itkiyi
 * etkilemez (pervane itkisi tasarım noktasında yok): sonucu
 * graphFromArchitecture / setMassFlow ile yaz.
 *
 * Hatalar: geçersiz grafik (GraphError) olduğu gibi fırlar; aralığın üst
 * ucunda bile çıktı yoksa (mil gücü vermeyen motor, çözülemeyen çevrim)
 * DesignError — sessizce aralığın ucunu döndürmez. Aralık içinde hedefe
 * ulaşılamıyorsa uç değer döner (çağıran ölçüp "en çok …" diyebilir).
 */
export function solveMassFlow(g: EngineGraph, target: { thrust?: number; shaftPower?: number }): number {
  const a = architectureOf(g);
  const [lo0, hi0] = massFlowRangeFor(a);
  const reference = hasFullOps(g) ? undefined : referenceFor(a);
  const power = target.shaftPower !== undefined;
  const goal = power ? target.shaftPower! : (target.thrust ?? NaN);
  if (!(goal > 0)) return g.massFlow;
  if (power) {
    const d = toEngineDesign(g, { reference });
    if (!d.prop && !d.shaft) throw new DesignError('Bu motor mil gücü vermiyor: hedefi itki olarak ver ya da LP yükü olarak pervane ya da çıkış mili seç.');
  }
  let failure: DesignError | undefined;
  const measure = (W: number): number => {
    let v: number;
    try {
      const s = sizeEngine(toEngineDesign({ ...g, massFlow: W }, { reference }));
      v = power ? s.ref.shaftPower : s.point.thrust;
    } catch (e) {
      // Yalnız çevrim hatası (ör. çok küçük motorda aksesuar payı HPT'yi
      // aşar): bu akışta "yetersiz" say. Grafik hataları çağırana gider.
      if (!(e instanceof DesignError)) throw e;
      failure = e;
      return -Infinity;
    }
    return Number.isFinite(v) ? v : -Infinity;
  };
  const top = measure(hi0);
  if (!(top > 0)) {
    throw failure ?? new DesignError(power ? 'Tasarım noktasında mil gücü hesaplanamıyor: bu motorun çıkış gücü modellenmiyor.' : 'Tasarım noktasında itki çıkmıyor: hava akışı çözülemedi.');
  }
  let lo = Math.log(lo0);
  let hi = Math.log(hi0);
  if (top <= goal) return hi0;
  if (measure(lo0) >= goal) return lo0;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (measure(Math.exp(mid)) < goal) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}
