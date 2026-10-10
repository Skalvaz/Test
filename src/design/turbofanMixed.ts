/**
 * Karışık akışlı kaportalı turbofan şablonu (M5a P6). Diğer aile şablonları
 * `templates.ts`'te; bu şablon o dosyadaki kalibrasyon işleriyle (P2)
 * çakışmasın diye ayrı dosyada. `catalog.ts` `TEMPLATES.turbofanMixed`
 * olarak kaydeder.
 */

import { DEFAULT_DESIGN } from '../sim/design';
import type { EngineGraph } from './types';

/**
 * Kaportalı karışık akışlı turbofan (M5a P6; CFM56-5C4 sınıfı, A340-200/300).
 * Yolcu turbofanının gaz yolu düğmelerinden (fan, booster, HPC, yanma
 * odası, türbinler), §3.4 değerleriyle: 465 kg/s, BPR 6,5, HPC PR 12,5,
 * T4 1600 K, lobe'lu karıştırıcı (18 lobe), ortak sabit yakınsak lüle.
 * Kalibrasyon §4.3 bandına (docs/M5A-SPEC.md):
 *  - Fan PR 1,6 → 1,64: karıştırıcıda P19t/P5t 0,90 → 1,03 (bant 0,98–1,06;
 *    gerçek motorlar akışları eşit basınçta buluşturur). OPR 35,9.
 *  - Fan girişi Mach 0,663 → 0,59: fan çapı 1,76 → 1,82 m (CFM56-5C 1,836)
 *    ve uç bağıl Mach'ı 1,47 → 1,43 (fanTipMach caution 1,50'den ≥ %4 pay).
 *  - Kademe yüklemeleri gerçek motorun kademe sayılarına: booster ψ 0,42
 *    (4 kademe), HPC 0,28 (9), HPT 1,8 (tek kademe), LPT 1,7 (5 kademe) —
 *    CFM56-5C: 1+4 · 9 · 1+5. Yolcu turbofanının düğmeleriyle 1+2 · 8 · 2+3
 *    çıkıyordu (motor kısa ve hafif kalıyordu: 1817 kg).
 *  - Lobe'lu karıştırıcı kaybı sihirbaz varsayılanıyla aynı (0,012,
 *    defaults.ts): yüksek baypasta lobe'lu düzden ancak bu kayıpla iyi.
 * Sonuç (ISA SLS): itki 145 kN, TSFC 9,80 g/(kN·s), kütle 2394 kg, fan çapı
 * 1,82 m, N1 4510 / N2 13 880 rpm, EGT payı 74 K. Aynı akışta ayrık akışlı
 * eşinden TSFC %1,2 iyi, 225 kg ağır (karıştırıcı + ortak lüle + uzun koni).
 */
export const TURBOFAN_MIXED_GRAPH: EngineGraph = {
  kind: 'turbofan',
  name: 'TFM-150 (jenerik karışık akışlı turbofan)',
  summary:
    'Uzun menzilli dört motorlu yolcu uçağı motoru (CFM56-5C sınıfı). Uzun kanallı kaporta baypas havasını motorun sonuna taşır; lobe’lu karıştırıcı iki akışı karıştırır, ortak sabit lüleden çıkarır.',
  massFlow: 465,
  mechEff: 0.99,
  accessoryPower: 189e3,
  bypassDuct: { dp: 0.02, mach: 0.45 },
  // Çalışabilirlik yolcu turbofanından (§2.8 operability.ts ölçeğiyle bir
  // kez hesaplanıp yazıldı): atalet rotor ataletiyle, marş torku HP ataleti
  // × devirle ölçeklendi; harita, limitler (EGT malzeme sınırı) aynen
  ops: {
    inertia: { lp: 126, hp: 5.37 },
    hpcMap: { ...DEFAULT_DESIGN.hpcMap },
    limits: { ...DEFAULT_DESIGN.limits },
    start: { ...DEFAULT_DESIGN.start, starterTorque: 137 },
  },
  modules: [
    { type: 'inlet', style: 'nacelle', length: 1.385, noseLength: 0, struts: 0 },
    {
      type: 'fan',
      spool: 'lp',
      pr: 1.64,
      eff: 0.9,
      bypassRatio: 6.5,
      hubPRFraction: 0.8,
      tipSpeed: 430,
      mach: [0.59, 0.389],
      hubTip: 0.3283,
      taper: 1,
      loading: 0.695,
      pitchSpan: 0.5,
      bladeK: [3.541, 3.541],
    },
    {
      type: 'lpc',
      spool: 'lp',
      pr: 1.9,
      eff: 0.89,
      mach: [0.42, 0.38],
      hubTip: 0.8,
      taper: 0.99,
      loading: 0.42,
      pitchSpan: 1.9,
      bladeK: [2.12, 1.44],
      gap: 1.421,
    },
    {
      type: 'hpc',
      spool: 'hp',
      pr: 12.5,
      eff: 0.87,
      tipSpeed: 552.1,
      mach: [0.2172, 0.1227],
      hubTip: 0.5977,
      taper: 0.8391,
      loading: 0.28,
      pitchSpan: 0.7172,
      bladeK: [3.527, 0.977],
      gap: 2.5,
      vsv: 4,
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1600,
      eff: 0.995,
      dp: 0.04,
      refVelocity: 20,
      lengthHeight: 2.6,
      meanShift: 0.014,
      gap: 0.9143,
      injectors: 20,
    },
    { type: 'hpt', spool: 'hp', eff: 0.9, mach: [0.1, 0.3], hubTip: 0.88, taper: 1, loading: 1.8, pitchSpan: 1.131, bladeK: [2.25, 3], gap: 0.75 },
    { type: 'lpt', spool: 'lp', eff: 0.92, mach: [0.3, 0.45], hubTip: 0.9, taper: 1.25, loading: 1.7, pitchSpan: 1.0, bladeK: [1.84, 6.85], gap: 2.4 },
    { type: 'mixer', style: 'lobed', lobes: 18, loss: 0.012 },
    { type: 'nozzle', style: 'fixed', cv: 0.985 },
  ],
};
