/**
 * Turboşaft şablonu (M5a P7). Diğer aile şablonları `templates.ts`'te; bu
 * şablon o dosyadaki kalibrasyon işleriyle çakışmasın diye ayrı dosyada.
 * `catalog.ts` `TEMPLATES.turboshaft` olarak kaydeder; turboşaft tipi el
 * yazımı katalogda yok, `ENGINE_CATALOG.turboshaft` bu grafikten üretilir.
 */

import { TURBOPROP } from '../sim/design';
import type { EngineGraph } from './types';

/**
 * Helikopter turboşaftı (T700-GE-701C sınıfı: 4,5 kg/s, ~1,4 MW, 5 eksenel
 * + 1 santrifüj kompresör, halka yanma odası, 2 kademe HPT, 2 kademe
 * serbest güç türbini, 20 900 rpm önden çıkışlı mil, entegre parçacık
 * ayırıcılı halka giriş).
 */
export const TURBOSHAFT_GRAPH: EngineGraph = {
  kind: 'turboshaft',
  name: 'TS-14 (jenerik helikopter turboşaftı)',
  summary:
    'Helikopter motoru (T700 sınıfı). Serbest güç türbini milin içinden öne uzanır ve rotor dişli kutusunu çevirir; itki yok. Test hücresinde gücü su freni (dinamometre) emer.',
  massFlow: 4.5,
  mechEff: 0.985,
  accessoryPower: 15e3,
  ops: {
    inertia: { lp: 0.2, hp: 0.1 },
    hpcMap: { ...TURBOPROP.hpcMap },
    limits: { ...TURBOPROP.limits, egtRedline: 940, egtAmber: 900, egtDamage: 1050, n1Redline: 1.07 },
    start: { ...TURBOPROP.start, starterTorque: 7 },
  },
  modules: [
    { type: 'shaft', rpm: 20900, drive: 'front', reduction: false, transmissionEff: 0.985, gearboxLength: 0.2 },
    { type: 'inlet', style: 'annular', separator: true, length: 1.6, noseLength: 0, struts: 0 },
    {
      type: 'hpc',
      spool: 'hp',
      pr: 17,
      eff: 0.81,
      tipSpeed: 440,
      mach: [0.45, 0.25],
      hubTip: 0.5,
      taper: 0.85,
      loading: 0.37,
      pitchSpan: 1.5,
      bladeK: [2.76, 1.53],
      centrifugal: { workFraction: 0.55, loading: 0.72, diffuserRatio: 1.6, gap: 1.1 },
    },
    {
      type: 'combustor',
      style: 'annular',
      tit: 1480,
      eff: 0.99,
      dp: 0.05,
      refVelocity: 20,
      lengthHeight: 5,
      meanShift: 0.02,
      gap: 1.4,
      injectors: 12,
    },
    { type: 'hpt', spool: 'hp', eff: 0.87, mach: [0.1, 0.3], hubTip: 0.85, taper: 1, loading: 1.6, pitchSpan: 2.2, bladeK: [2.65, 2.65], gap: 0.625 },
    {
      type: 'lpt',
      spool: 'lp',
      eff: 0.89,
      tipSpeed: 370,
      mach: [0.12, 0.32],
      hubTip: 0.68,
      taper: 1.1,
      loading: 1.9,
      pitchSpan: 1.7,
      bladeK: [3.49, 4.95],
      gap: 1.125,
    },
    { type: 'nozzle', style: 'stub', cv: 0.97, pressureRatio: 1.05, exitMach: 0.15 },
  ],
};
