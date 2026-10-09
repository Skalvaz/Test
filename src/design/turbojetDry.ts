/**
 * Kuru turbojet şablonu (M5a P5). Diğer aile şablonları `templates.ts`'te;
 * bu şablon o dosyadaki kalibrasyon işleriyle (P2) çakışmasın diye ayrı
 * dosyada. `catalog.ts` `TEMPLATES.turbojetDry` olarak kaydeder.
 */

import { TURBOJET } from '../sim/design';
import type { EngineGraph } from './types';

/**
 * Art yakıcısız turbojet (M5a P5; J57-P-43 / J79 kuru sınıfı). Turbojet
 * şablonunun gaz yolundan: art yakıcı yok, kısa jet borusu ve sabit
 * yakınsak lüle; sekiz kutulu kutu-halka yanma odası (J57, JT8D gibi).
 * Kalibrasyon §4.3 bandına (docs/M5A-SPEC.md): OPR 13 için LPC/HPC PR
 * 3,5/3,7 (kademe yüklemesi değişmeden 3 + 4 kademe), türbinler tek
 * kademe (ψ ≈ 2,2 ve 1,2), T4 1180 K (J57 ~1140, J79 ~1250 K). Kutular
 * çevreye sığsın diye oda ortalama yarıçapı 3 cm dışarıda. Çalışabilirlik
 * turbojetten.
 */
export const TURBOJET_DRY_GRAPH: EngineGraph = {
  kind: 'turbojet',
  name: 'TJ-50 (jenerik art yakıcısız turbojet)',
  summary:
    'Erken jet çağı bombardıman ve yolcu uçağı motoru (J57 sınıfı). Art yakıcı yok: türbinden sonra kısa bir jet borusu ve sabit lüle; sekiz kutulu kutu-halka yanma odası.',
  massFlow: 72,
  mechEff: 0.99,
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
      pr: 3.5,
      eff: 0.87,
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
      pr: 3.7,
      eff: 0.87,
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
      style: 'canAnnular',
      cans: 8,
      tit: 1180,
      eff: 0.99,
      dp: 0.05,
      refVelocity: 35,
      lengthHeight: 4.5,
      meanShift: 0.03,
      gap: 1,
      injectors: 8,
    },
    { type: 'hpt', spool: 'hp', eff: 0.89, mach: [0.207, 0.385], hubTip: 0.722, taper: 1, loading: 2.4, pitchSpan: 1.6, bladeK: [2.98, 2.98], gap: 1 },
    { type: 'lpt', spool: 'lp', eff: 0.89, mach: [0.301, 0.543], hubTip: 0.684, taper: 1, loading: 1.6, pitchSpan: 1.333, bladeK: [3.82, 3.82], gap: 1.375 },
    { type: 'nozzle', style: 'fixed', cv: 0.985 },
  ],
};
