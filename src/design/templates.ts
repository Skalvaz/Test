/**
 * Hazır motor şablonları (modül grafiği). Termodinamik değerler sim/design.ts
 * kataloğundaki motorlarla aynıdır; geometri düğmeleri M4 öncesinin elle
 * ölçülendirilmiş modellerine kalibre edildi (ölçüler ±%5, bkz.
 * templates.test.ts). Düğmelerin hepsi fiziksel olarak makul aralıktadır:
 * fan girişi Mach 0,4–0,6, kompresör yüklemesi 0,23–0,53, türbin 1–2,5.
 */

import { DEFAULT_DESIGN, MILITARY_TURBOFAN, TURBOJET, TURBOPROP } from '../sim/design';
import type { EngineGraph } from './types';

/**
 * Aile şablonları (M5a: 7 aile). Bugün dördü var; kuru turbojet (P5),
 * karışık akışlı kaportalı turbofan (P6) ve turboşaft (P7) eklenecek.
 * `kind` alanı etiket olarak kalır; motor tipi modüllerden türetilir.
 * Çalışabilirlik (`ops`) şablonda tam verilir.
 */
export type TemplateId =
  | 'turbojet'
  | 'turbojetDry'
  | 'militaryTurbofan'
  | 'turbofanMixed'
  | 'turbofan'
  | 'turboprop'
  | 'turboshaft';

export const TURBOJET_GRAPH: EngineGraph = {
  kind: 'turbojet',
  name: TURBOJET.name,
  summary: TURBOJET.summary,
  massFlow: 66,
  mechEff: 0.985,
  accessoryPower: 60e3,
  ops: {
    inertia: { ...TURBOJET.inertia },
    hpcMap: { ...TURBOJET.hpcMap },
    limits: { ...TURBOJET.limits },
    start: { ...TURBOJET.start },
  },
  modules: [
    { type: 'inlet', style: 'bellmouth', length: 0.38, noseLength: 0.76, struts: 6 },
    {
      type: 'lpc',
      spool: 'lp',
      pr: 3.2,
      eff: 0.84,
      tipSpeed: 461,
      mach: [0.41, 0.22],
      hubTip: 0.354,
      taper: 0.911,
      loading: 0.412,
      pitchSpan: 1.036,
      bladeK: [3.64, 3.64],
      vsv: 3,
      firstMaterial: 'titanium',
      firstChord: 1.15,
    },
    {
      type: 'hpc',
      spool: 'hp',
      pr: 2.9,
      eff: 0.84,
      tipSpeed: 418,
      mach: [0.254, 0.173],
      hubTip: 0.6,
      taper: 0.943,
      loading: 0.534,
      pitchSpan: 1.818,
      bladeK: [3.34, 2.28],
      gap: 0.964,
      vsv: 3,
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1230,
      eff: 0.98,
      dp: 0.06,
      refVelocity: 43.4,
      lengthHeight: 5.13,
      meanShift: -0.02,
      gap: 1,
      injectors: 10,
    },
    { type: 'hpt', spool: 'hp', eff: 0.88, mach: [0.207, 0.385], hubTip: 0.722, taper: 1, loading: 1.6, pitchSpan: 1.6, bladeK: [2.98, 2.98], gap: 1 },
    { type: 'lpt', spool: 'lp', eff: 0.88, mach: [0.301, 0.543], hubTip: 0.684, taper: 1, loading: 1.17, pitchSpan: 1.333, bladeK: [3.82, 3.82], gap: 1.375 },
    { type: 'afterburner', t7Max: 1900, eta: 0.88, dpDry: 0.04, dpLit: 0.08, mach: 0.214, lengthDiameter: 2.44 },
    { type: 'nozzle', style: 'convergent', cv: 0.975, flaps: 14 },
  ],
};

/**
 * Art yakıcılı askeri turbofan (F100-PW-229 sınıfı: 112 kg/s, 3 fan + 10 HPC
 * kademesi, 1 HPT + 2 LPT). M5a: karıştırıcı basınç dengesine uyduruldu. M4'te
 * fan PR 3,1 / BPR 0,68 ile baypas çekirdekten çok düşük basınçla
 * karışıyordu (P19t/P5t 0,69; gerçek motorlar ~1'de tasarlanır, aksi halde
 * çekirdek gazı baypas kanalına geri basar). Şimdi fan PR 4,3 / BPR 0,55
 * (OPR 35) ile P19t/P5t ≈ 0,98; aynı kademe sayıları için fan, HPC ve LPT
 * yüklemesi artırıldı. Kuru itki +%3, TSFC −%3 (karışma kaybı azaldı).
 */
export const MILITARY_TURBOFAN_GRAPH: EngineGraph = {
  kind: 'militaryTurbofan',
  name: MILITARY_TURBOFAN.name,
  summary: MILITARY_TURBOFAN.summary,
  massFlow: 112,
  mechEff: 0.99,
  accessoryPower: 120e3,
  bypassDuct: { dp: 0.03, mach: 0.124 },
  ops: {
    inertia: { ...MILITARY_TURBOFAN.inertia },
    hpcMap: { ...MILITARY_TURBOFAN.hpcMap },
    limits: { ...MILITARY_TURBOFAN.limits },
    start: { ...MILITARY_TURBOFAN.start },
  },
  modules: [
    { type: 'inlet', style: 'bellmouth', length: 0.391, noseLength: 0.783, struts: 0 },
    {
      type: 'fan',
      spool: 'lp',
      pr: 4.3,
      eff: 0.86,
      bypassRatio: 0.55,
      hubPRFraction: 1,
      tipSpeed: 501,
      mach: [0.606, 0.3],
      hubTip: 0.413,
      taper: 0.935,
      // M5a: 3 kademede PR 4,3 (kademe başı ~1,63, EJ200 / F119 fanları gibi)
      loading: 0.4,
      pitchSpan: 0.909,
      bladeK: [3.7, 3.61],
      vsv: 2,
      blisk: true,
      firstMaterial: 'titanium',
      firstChord: 1.25,
    },
    {
      type: 'hpc',
      spool: 'hp',
      pr: 8.2,
      eff: 0.87,
      tipSpeed: 498,
      mach: [0.289, 0.202],
      hubTip: 0.597,
      taper: 0.896,
      // M5a: fan çıkışı ısınınca 10 kademe kalsın diye 0,232 → 0,255
      loading: 0.255,
      pitchSpan: 1.293,
      bladeK: [3.21, 1.21],
      gap: 1.957,
      vsv: 4,
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1670,
      eff: 0.995,
      dp: 0.05,
      refVelocity: 27.95,
      lengthHeight: 4,
      meanShift: -0.024,
      gap: 1.5,
      injectors: 18,
    },
    { type: 'hpt', spool: 'hp', eff: 0.89, mach: [0.109, 0.286], hubTip: 0.746, taper: 1, loading: 2.53, pitchSpan: 1.882, bladeK: [2.87, 2.87], gap: 0.875 },
    // M5a: fan işi arttı; 2 kademe için ψ sınırı 0,988 → 1,45 (gerçek ψ ~1,3).
    // Çıkış Mach'ı 0,238 → 0,3: P5 düşünce çıkış kanalı göbeğe doğru açılmasın
    { type: 'lpt', spool: 'lp', eff: 0.9, mach: [0.164, 0.3], hubTip: 0.622, taper: 1.081, loading: 1.45, pitchSpan: 1.29, bladeK: [5.2, 6.53], gap: 0.9 },
    { type: 'mixer', loss: 0.01, style: 'confluent' },
    { type: 'afterburner', t7Max: 2000, eta: 0.9, dpDry: 0.03, dpLit: 0.065, mach: 0.192, lengthDiameter: 1.65 },
    { type: 'nozzle', style: 'cd', cv: 0.98, flaps: 16 },
  ],
};

/**
 * Turboprop: eksenel + santrifüj gaz jeneratörü, serbest güç türbini,
 * pervane redüktörü. M5a: çekirdek fiziğe uyduruldu. M4'te M4 öncesi
 * modele kalibreydi ve 9,5 kg/s'lik akışına göre büyüktü (HPC ilk kademe
 * bağıl Mach 1,86, HPT AN² 7,2e7, HPT girişi Mach 0,05, yanma odası
 * referans hızı 8 m/s). Şimdi T700/PT6 sınıfındaki gibi 5 eksenel kademe +
 * santrifüj son kademe (işin %60'ı, çark ucu ~583 m/s), HPC ilk kademesi
 * Mach 1,48, tek kademeli HPT (girişi Mach 0,11, uç ~543 m/s), HPT ve güç
 * türbini AN² ≤ 4,0e7, yanma odası 20 m/s. Gaz jeneratörü kısalır ve
 * incelir; pervane ve redüktör aynı kalır.
 */
export const TURBOPROP_GRAPH: EngineGraph = {
  kind: 'turboprop',
  name: TURBOPROP.name,
  summary: TURBOPROP.summary,
  massFlow: 9.5,
  mechEff: 0.985,
  accessoryPower: 40e3,
  ops: {
    inertia: { ...TURBOPROP.inertia },
    hpcMap: { ...TURBOPROP.hpcMap },
    limits: { ...TURBOPROP.limits },
    start: { ...TURBOPROP.start },
  },
  modules: [
    { type: 'propeller', diameter: 3.93, blades: 6, rpm: 1200, figureOfMerit: 0.72, efficiency: 0.85, gearboxLength: 1.36 },
    { type: 'inlet', style: 'chin', length: 0, noseLength: 0, struts: 0 },
    {
      type: 'hpc',
      spool: 'hp',
      pr: 15,
      eff: 0.83,
      tipSpeed: 470,
      mach: [0.45, 0.25],
      hubTip: 0.45,
      taper: 0.85,
      loading: 0.3,
      pitchSpan: 1.5,
      bladeK: [2.76, 1.53],
      centrifugal: { workFraction: 0.6, loading: 0.72, diffuserRatio: 1.608, gap: 1.143 },
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1440,
      eff: 0.99,
      dp: 0.05,
      refVelocity: 20,
      lengthHeight: 6,
      meanShift: 0.0325,
      gap: 1.429,
      injectors: 14,
    },
    { type: 'hpt', spool: 'hp', eff: 0.88, mach: [0.11, 0.3], hubTip: 0.8, taper: 1, loading: 1.8, pitchSpan: 2.286, bladeK: [2.65, 2.65], gap: 0.625 },
    {
      type: 'lpt',
      spool: 'lp',
      eff: 0.9,
      tipSpeed: 470,
      mach: [0.129, 0.38],
      hubTip: 0.652,
      taper: 1.13,
      loading: 0.879,
      pitchSpan: 1.684,
      bladeK: [3.49, 4.95],
      gap: 1.125,
    },
    { type: 'nozzle', style: 'stub', cv: 0.97, pressureRatio: 1.1, exitMach: 0.163 },
  ],
};

/**
 * Yüksek baypaslı ayrık akışlı turbofan (BPR 9). Fan, HPC, yanma odası ve
 * HPT M4 öncesi modele kalibre. Booster ve LP türbin fiziğe uyduruldu
 * (kullanıcı kararı, Ekim 2026): eski booster halkası 115 kg/s çekirdek
 * akışında boğuluyordu (Mach 1), eski LPT fan devrinde ψ ≈ 6,6 yüklemeyle
 * çalışıyordu. Şimdi booster Mach 0,42 / ψ 0,9 ile 3 kademe, LPT ince
 * halka halinde dışarı açılıp (göbek/uç 0,9) ψ ≈ 2,9 ile 6 kademe —
 * doğrudan tahrikli büyük turbofanlardaki gibi. M5a'da HPT ve yanma odası
 * da fiziğe uyduruldu (HPT girişi Mach 0,10, yanma odası 20 m/s).
 */
export const TURBOFAN_GRAPH: EngineGraph = {
  kind: 'turbofan',
  name: DEFAULT_DESIGN.name,
  summary: DEFAULT_DESIGN.summary,
  massFlow: 1150,
  mechEff: 0.99,
  accessoryPower: 350e3,
  bypassDuct: { dp: 0.015, mach: 0.45 },
  ops: {
    inertia: { ...DEFAULT_DESIGN.inertia },
    hpcMap: { ...DEFAULT_DESIGN.hpcMap },
    limits: { ...DEFAULT_DESIGN.limits },
    start: { ...DEFAULT_DESIGN.start },
  },
  modules: [
    { type: 'inlet', style: 'nacelle', length: 1.385, noseLength: 0, struts: 0 },
    {
      type: 'fan',
      spool: 'lp',
      pr: 1.55,
      eff: 0.915,
      bypassRatio: 9,
      hubPRFraction: 0.8,
      tipSpeed: 370.1,
      mach: [0.663, 0.389],
      hubTip: 0.3283,
      taper: 1,
      loading: 0.695,
      pitchSpan: 0.5,
      bladeK: [3.541, 3.541],
    },
    {
      type: 'lpc',
      spool: 'lp',
      pr: 1.95,
      eff: 0.89,
      mach: [0.42, 0.38],
      hubTip: 0.8,
      taper: 0.99,
      loading: 0.9,
      pitchSpan: 1.9,
      bladeK: [2.12, 1.44],
      gap: 1.421,
    },
    {
      type: 'hpc',
      spool: 'hp',
      // M5a: 16,5 → 16,3: T3 962 → 958 K (1000 K sınırından ≥ %4 pay)
      pr: 16.3,
      eff: 0.87,
      tipSpeed: 552.1,
      mach: [0.2172, 0.1227],
      hubTip: 0.5977,
      taper: 0.8391,
      loading: 0.317,
      pitchSpan: 0.7172,
      bladeK: [3.527, 0.977],
      gap: 2.5,
      vsv: 4,
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1680,
      eff: 0.995,
      dp: 0.04,
      // M5a: 11,8 → 20 m/s (gerçek halka odalar 15–25 m/s): oda incelir ve kısalır
      refVelocity: 20,
      lengthHeight: 2.6,
      meanShift: 0.014,
      gap: 0.9143,
      injectors: 20,
    },
    // M5a: HPT girişi Mach 0,04 → 0,10 (eski halka 1150 kg/s'e göre genişti):
    // uç 0,49 → 0,47 m, AN² 4,0e7 → 2,3e7; kanat sayısı gerçekçi katılıkta (~110)
    { type: 'hpt', spool: 'hp', eff: 0.9, mach: [0.1, 0.3], hubTip: 0.88, taper: 1, loading: 1.496, pitchSpan: 1.131, bladeK: [2.25, 3], gap: 0.75 },
    // gap: HPT küçülünce türbin geçiş kanalı boyu ≥ 1,2 × yarıçap tırmanışı kalsın
    { type: 'lpt', spool: 'lp', eff: 0.92, mach: [0.3, 0.45], hubTip: 0.9, taper: 1.25, loading: 3.0, pitchSpan: 1.0, bladeK: [1.84, 6.85], gap: 2.4 },
    // cv düz kenarlı lüle için; baypas chevron'larıyla etkin değer 0,985
    { type: 'nozzle', style: 'separate', cv: 0.98747, chevrons: { core: 0, bypass: 18 } },
  ],
};
