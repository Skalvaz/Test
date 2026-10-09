/**
 * Altın sayı testi (M5a P0): dört şablonun bugünkü tasarım noktası, tasarım
 * dışı çevrim ve simülasyon sonuçları 5 anlamlı basamakla sabitlenir.
 * Yeniden düzenlemeler (P0 bölmesi) ve simülasyon ekleri (P1) bu sayıları
 * değiştirmeden geçmek zorundadır. Yalnız şablon uydurma paketi (P2)
 * gerekçeli bir commit ile günceller; TJ satırları değişmemeli.
 *
 * M5a P2 güncellemesi: TP çekirdeği (§4.1) ve TF HPT/yanma odası (§4.2)
 * fiziğe uyduruldu; TF HPC PR 16,5 → 16,3 (T3 ≤ 960 K) ve MTF fan PR/BPR
 * 3,1/0,68 → 4,3/0,55 (karıştırıcıda P19t/P5t 0,69 → 0,98), §2.11 uyarı
 * eşiklerinden ≥ %4 pay için (S5: eşik gevşetilmez, şablon uydurulur).
 */

import { describe, expect, it } from 'vitest';
import { ambient } from '../sim/atmosphere';
import { computeCycle } from '../sim/cycle';
import { EngineSim } from '../sim/engineSim';
import { buildEngine } from './graph';
import { opsOf } from './operability';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph } from './types';

/** 5 anlamlı basamak */
const r5 = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(5)));

function golden(g: EngineGraph) {
  const b = buildEngine(g);
  const { point, ref } = b.sized;
  const gp = b.flowpath.gas;
  const m = b.flowpath.metrics;
  const design = {
    thrust: r5(point.thrust),
    thrustWet: r5(point.thrustWet),
    wf: r5(point.wf),
    opr: r5(point.opr),
    A8dry: r5(ref.A8dry),
    A9: r5(ref.A9),
    A19: r5(ref.A19),
    shaftPower: r5(ref.shaftPower),
    stages: [gp.front?.stages ?? 0, gp.booster?.stages ?? 0, gp.hpc.stages, gp.hpt.stages, gp.lpt.stages],
    n1Rpm: r5(b.design.n1Rpm),
    n2Rpm: r5(b.design.n2Rpm),
    fanBlades: b.design.fanBlades,
    mass: r5(m.mass.total),
    diameter: r5(m.diameter),
    length: r5(m.length),
    tipMach: [r5(m.tipMachRel.lp), r5(m.tipMachRel.hp)],
    an2: [r5(m.an2.hpt), r5(m.an2.lpt)],
  };

  // Tasarım dışı çevrim: tasarım noktası ve kısmi güç
  const amb = ambient();
  const cyc = (N1: number, N2: number, wf: number) => {
    const c = computeCycle({ eng: b.sized, amb, N1, N2, wf, lit: true, surging: false });
    return [r5(c.netThrust), r5(c.stations['45'].T), r5(c.surgeMargin), r5(c.opr)];
  };
  const cycle = { full: cyc(1, 1, point.wf), part: cyc(0.85, 0.93, 0.6 * point.wf) };

  // Simülasyon: rölanti ve tam güç trim'i (+ art yakıcı)
  const sim = new EngineSim(b.design);
  const snap = () => {
    const s = sim.snapshot();
    return [r5(s.N1), r5(s.N2), r5(s.cycle.netThrust), r5(s.wf), r5(sim.egtSensor), r5(sim.propPower)];
  };
  sim.trim(0, 30);
  const idle = snap();
  sim.trim(1, 30);
  const full = snap();
  let wet: number[] | null = null;
  if (b.design.afterburner) {
    sim.controls.reheat = 1;
    for (let t = 0; t < 10; t += 1 / 60) sim.step(1 / 60);
    wet = snap();
  }
  return { design, cycle, sim: { idle, full, wet } };
}

describe('altın sayılar (şablonlar)', () => {
  it('turbojet', () => {
    expect(golden(TURBOJET_GRAPH)).toMatchInlineSnapshot(`
      {
        "cycle": {
          "full": [
            44877,
            1073.1,
            0.29564,
            9.28,
          ],
          "part": [
            25524,
            891.02,
            0.38605,
            6.5395,
          ],
        },
        "design": {
          "A19": 0,
          "A8dry": 0.19781,
          "A9": 0.1899,
          "an2": [
            25298000,
            29967000,
          ],
          "diameter": 0.78985,
          "fanBlades": 24,
          "length": 5.0989,
          "mass": 1456.9,
          "n1Rpm": 11147,
          "n2Rpm": 11398,
          "opr": 9.28,
          "shaftPower": 0,
          "stages": [
            3,
            0,
            3,
            1,
            1,
          ],
          "thrust": 44877,
          "thrustWet": 63910,
          "tipMach": [
            1.437,
            1.051,
          ],
          "wf": 1.3042,
        },
        "sim": {
          "full": [
            1,
            0.99915,
            44846,
            1.309,
            803.37,
            0,
          ],
          "idle": [
            0.18,
            0.7461,
            2472.4,
            0.17081,
            283.16,
            0,
          ],
          "wet": [
            1,
            0.99915,
            63815,
            3.3465,
            803.37,
            0,
          ],
        },
      }
    `);
  });
  it('askeri turbofan', () => {
    expect(golden(MILITARY_TURBOFAN_GRAPH)).toMatchInlineSnapshot(`
      {
        "cycle": {
          "full": [
            83431,
            1291.6,
            0.33269,
            35.26,
          ],
          "part": [
            56338,
            1090.5,
            0.38788,
            24.429,
          ],
        },
        "design": {
          "A19": 0.050229,
          "A8dry": 0.20203,
          "A9": 0.14174,
          "an2": [
            33706000,
            31403000,
          ],
          "diameter": 0.91982,
          "fanBlades": 28,
          "length": 5.0967,
          "mass": 1800.7,
          "n1Rpm": 10403,
          "n2Rpm": 15661,
          "opr": 35.26,
          "shaftPower": 0,
          "stages": [
            3,
            0,
            10,
            1,
            2,
          ],
          "thrust": 83431,
          "thrustWet": 132860,
          "tipMach": [
            1.6413,
            1.2014,
          ],
          "wf": 1.7896,
        },
        "sim": {
          "full": [
            1,
            0.99955,
            83582,
            1.802,
            1024.1,
            0,
          ],
          "idle": [
            0.20761,
            0.64,
            1920.4,
            0.10771,
            266.56,
            0,
          ],
          "wet": [
            1,
            0.99955,
            132980,
            5.9872,
            1024.1,
            0,
          ],
        },
      }
    `);
  });
  it('turboprop', () => {
    expect(golden(TURBOPROP_GRAPH)).toMatchInlineSnapshot(`
      {
        "cycle": {
          "full": [
            1990.9,
            1084.4,
            0.33949,
            15,
          ],
          "part": [
            1215.5,
            866.84,
            0.45805,
            11.455,
          ],
        },
        "design": {
          "A19": NaN,
          "A8dry": 0,
          "A9": 0.105,
          "an2": [
            37766000,
            39982000,
          ],
          "diameter": 3.93,
          "fanBlades": 6,
          "length": 3.9621,
          "mass": 860.91,
          "n1Rpm": 19504,
          "n2Rpm": 29669,
          "opr": 15,
          "shaftPower": 2854100,
          "stages": [
            0,
            0,
            5,
            1,
            2,
          ],
          "thrust": 1990.9,
          "thrustWet": 1990.9,
          "tipMach": [
            0.72564,
            1.479,
          ],
          "wf": 0.22152,
        },
        "sim": {
          "full": [
            1,
            1,
            1999.4,
            0.2233,
            816.65,
            2862600,
          ],
          "idle": [
            0.62577,
            0.62,
            150.6,
            0.026144,
            263.27,
            20982,
          ],
          "wet": null,
        },
      }
    `);
  });
  it('turbofan', () => {
    expect(golden(TURBOFAN_GRAPH)).toMatchInlineSnapshot(`
      {
        "cycle": {
          "full": [
            319200,
            1194.3,
            0.34014,
            45.77,
          ],
          "part": [
            223710,
            1011.5,
            0.38845,
            31.792,
          ],
        },
        "design": {
          "A19": 3.1431,
          "A8dry": 0,
          "A9": 0.68498,
          "an2": [
            22760000,
            5773300,
          ],
          "diameter": 2.772,
          "fanBlades": 22,
          "length": 7.3111,
          "mass": 5643.5,
          "n1Rpm": 2549.9,
          "n2Rpm": 10100,
          "opr": 45.77,
          "shaftPower": 0,
          "stages": [
            1,
            3,
            9,
            2,
            6,
          ],
          "thrust": 319200,
          "thrustWet": 319200,
          "tipMach": [
            1.3139,
            1.4022,
          ],
          "wf": 2.7122,
        },
        "sim": {
          "full": [
            1,
            0.99949,
            319300,
            2.7308,
            926.16,
            0,
          ],
          "idle": [
            0.21892,
            0.62,
            7155.8,
            0.18532,
            254.56,
            0,
          ],
          "wet": null,
        },
      }
    `);
  });
});

/**
 * Yerleşim ve çalışabilirlik bekçisi: 3B yerleşimin bütün sayısal alanları
 * (P0'da yaklaşık olan outerProfile ve mounts hariç), `ops`'a taşınan
 * çalışabilirlik alanları ve geçiş serileri (atalet, marş sistemi). Trim
 * kararlı hal olduğu için atalet ve marş ancak geçişte görünür.
 */
const LAYOUT_SKIP = new Set(['outerProfile', 'mounts']);

/** Sayıları r5'le yuvarlayan derin kopya (fonksiyon ve undefined atlanır) */
function roundDeep(v: unknown, skip?: Set<string>): unknown {
  if (typeof v === 'number') return r5(v);
  if (Array.isArray(v)) return v.map((x) => roundDeep(x));
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (skip?.has(k) || x === undefined || typeof x === 'function') continue;
      o[k] = roundDeep(x);
    }
    return o;
  }
  return v;
}

function transients(g: EngineGraph) {
  const b = buildEngine(g);
  // Rölanti → tam güç: 10 s, 0,5 s aralıkla N1/N2
  const sim = new EngineSim(b.design);
  sim.trim(0, 30);
  sim.controls.throttle = 1;
  const accel: number[][] = [];
  for (let i = 1; i <= 600; i++) {
    sim.step(1 / 60);
    if (i % 30 === 0) accel.push([r5(sim.N1), r5(sim.N2)]);
  }
  // Soğuk marş: APU bleed + marş + ateşleme, fuelOnMinN2'de yakıt; 50 s, 2 s aralıkla
  const cold = new EngineSim(b.design);
  Object.assign(cold.controls, { apuBleed: true, starter: true, ignition: true });
  const start: number[][] = [];
  for (let i = 1; i <= 3000; i++) {
    if (!cold.controls.fuelRun && cold.N2 >= cold.limits.fuelOnMinN2 + 0.02) cold.controls.fuelRun = true;
    cold.step(1 / 60);
    if (i % 120 === 0) start.push([r5(cold.N1), r5(cold.N2), r5(cold.egtSensor), cold.lit ? 1 : 0]);
  }
  return { layout: roundDeep(b.flowpath.layout, LAYOUT_SKIP), ops: roundDeep(opsOf(b.design)), accel, start };
}

describe('altın yerleşim, çalışabilirlik ve geçişler (şablonlar)', () => {
  it.each([
    ['turbojet', TURBOJET_GRAPH],
    ['askeri turbofan', MILITARY_TURBOFAN_GRAPH],
    ['turboprop', TURBOPROP_GRAPH],
    ['turbofan', TURBOFAN_GRAPH],
  ] as const)('%s', (_name, g) => {
    expect(transients(g)).toMatchSnapshot();
  });
});
