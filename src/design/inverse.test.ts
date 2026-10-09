/**
 * M5a P4b: tutamaçlar ve ters eşleme (§6.7). Ön uç kapalı biçim, kompresör
 * boyu kademe sayısı, lüle eşlemelerinin tekdüzeliği ve gidiş-dönüşü,
 * adım süresi.
 */

import { describe, expect, it } from 'vitest';
import { buildEngine, type BuiltEngine } from './graph';
import { ENGINE_HANDLES, handleFor, handlesFor, nozzleExplain, type HandleId } from './handles';
import {
  frontTipAnchor,
  nozzleAnchor,
  nozzleCoupling,
  nozzleRange,
  rebuilderFor,
  solveFrontTip,
  solveMonotone,
  solveNozzleExit,
  solvePropTip,
  solveStages,
  stageRange,
  stageRow,
  type StageModule,
} from './inverse';
import { knobById, knobCtx } from './knobs';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph } from './types';

const T: Record<string, EngineGraph> = {
  turbojet: TURBOJET_GRAPH,
  militaryTurbofan: MILITARY_TURBOFAN_GRAPH,
  turbofan: TURBOFAN_GRAPH,
  turboprop: TURBOPROP_GRAPH,
};
const built: Record<string, BuiltEngine> = Object.fromEntries(Object.entries(T).map(([k, g]) => [k, buildEngine(g)]));

/** Atölye grafiği: ops'suz, şablon referanslı */
function workshop(kind: string): { g: EngineGraph; b: BuiltEngine } {
  const g = structuredClone(T[kind]);
  delete g.ops;
  delete g.kind;
  return { g, b: buildEngine(g, { reference: built[kind] }) };
}

describe('tutamaç tanımları', () => {
  it('kimlikler ve mimariye göre geçerli tanım', () => {
    expect(new Set(ENGINE_HANDLES.map((h) => h.id))).toEqual(new Set(['frontTip', 'propTip', 'length:fan', 'length:lpc', 'length:hpc', 'nozzleExit']));
    const ids = (k: string) => handlesFor(knobCtx(T[k])).map((h) => h.id);
    expect(ids('turbojet')).toEqual(['frontTip', 'length:lpc', 'length:hpc', 'nozzleExit']);
    expect(ids('militaryTurbofan')).toEqual(['frontTip', 'length:fan', 'length:hpc', 'nozzleExit']);
    expect(ids('turbofan')).toEqual(['frontTip', 'length:fan', 'length:lpc', 'length:hpc', 'nozzleExit']);
    expect(ids('turboprop')).toEqual(['propTip', 'length:hpc', 'nozzleExit']);
    // Lüle ağzı: her mimaride tek tanım, bağlı düğme mimariden
    const coupled = (k: string) => handleFor('nozzleExit', knobCtx(T[k]))!.coupled;
    expect(['turbojet', 'militaryTurbofan', 'turbofan', 'turboprop'].map(coupled)).toEqual(['combustor.tit', 'fan.bypassRatio', 'fan.pr', 'nozzle.exitMach']);
    expect(nozzleCoupling(built.turbojet.traits)).toBe('combustor.tit');
  });

  it.each(Object.keys(T))('%s: konum sınır içinde, kilit yok, çentikler sıralı', (k) => {
    const g = T[k];
    const b = built[k];
    for (const h of handlesFor(knobCtx(g))) {
      const a = h.anchor(b);
      // TF tek kademeli fan: boy tutamacı yok
      if (h.id === 'length:fan' && k === 'turbofan') {
        expect(a).toBeNull();
        continue;
      }
      expect(a, h.id).not.toBeNull();
      const r = h.range(g, b);
      const pos = h.axis === 'radial' ? a!.r : a!.z;
      expect(r.lo, h.id).toBeLessThanOrEqual(pos + 1e-9);
      expect(r.hi, h.id).toBeGreaterThanOrEqual(pos - 1e-9);
      expect(h.blockedReason?.(g, b) ?? null, h.id).toBeNull();
      const snaps = h.snaps?.(g, b);
      if (snaps) {
        expect(snaps.length).toBeGreaterThan(1);
        for (let i = 1; i < snaps.length; i++) expect(snaps[i]).toBeGreaterThan(snaps[i - 1]);
      }
    }
  });
});

describe('ön uç ve pervane', () => {
  it.each(['turbojet', 'militaryTurbofan', 'turbofan'])('%s: r ×1,05 → W ×1,1025 (±%0,5), uç yarıçapı ±%1', (k) => {
    for (const { g, b } of [{ g: T[k], b: built[k] }, workshop(k)]) {
      const a = frontTipAnchor(b)!;
      const s = solveFrontTip(g, b, a.r * 1.05);
      expect(s.model.massFlow / g.massFlow).toBeCloseTo(1.1025, 2);
      expect(Math.abs(s.model.massFlow / g.massFlow / 1.1025 - 1)).toBeLessThan(0.005);
      const b2 = rebuilderFor(b)(s.model);
      expect(Math.abs(frontTipAnchor(b2)!.r / (a.r * 1.05) - 1)).toBeLessThan(0.01);
      expect(s.snapped).toBeCloseTo(a.r * 1.05, 9);
    }
  });

  it('aralık sonunda kırpılır; pervanelide ön uç yok, pervane ucu çap', () => {
    const b = built.turbojet;
    const s = solveFrontTip(TURBOJET_GRAPH, b, frontTipAnchor(b)!.r * 10);
    expect(s.model.massFlow).toBe(200);
    expect(frontTipAnchor(built.turboprop)).toBeNull();
    const p = solvePropTip(TURBOPROP_GRAPH, built.turboprop, 1.6);
    expect(knobById('propeller.diameter')!.get(p.model)).toBe(3.2);
    expect(solvePropTip(TURBOPROP_GRAPH, built.turboprop, 9).snapped).toBe(2.5);
  });
});

describe('kompresör boyu (kademe sayısı)', () => {
  const cases: [string, StageModule, number][] = [
    ['turbojet', 'hpc', 2],
    ['turbojet', 'lpc', 1],
    ['militaryTurbofan', 'hpc', 2],
    ['militaryTurbofan', 'fan', -1],
    ['turbofan', 'hpc', 2],
    ['turbofan', 'lpc', -1],
    // Turbopropta HPC basınç oranı aralığı (6–20) en çok bir kademe ekler
    ['turboprop', 'hpc', 1],
  ];
  it.each(cases)('%s %s: %i kademe → kademe sayısı aynı kadar değişir, gerçek ψ ≈ 0,95·ψ', (k, m, dn) => {
    for (const { g, b } of [{ g: T[k], b: built[k] }, workshop(k)]) {
      const row = stageRow(b, m)!;
      const s = solveStages(g, b, m, row.z1 + dn * row.pitch);
      const b2 = rebuilderFor(b)(s.model);
      const row2 = stageRow(b2, m)!;
      expect(row2.stages).toBe(row.stages + dn);
      const psi = (s.model.modules.find((x) => x.type === m) as { loading: number }).loading;
      // Basınç oranı aralığın ucuna dayanmadıysa gerçek yükleme düğmenin 0,95'i
      const pr = knobById(`${m}.pr`)!;
      const r = pr.range(knobCtx(g))!;
      if (s.value > r[0] + 1e-6 && s.value < r[1] - 1e-6) expect(Math.abs(row2.loading / psi - 0.95)).toBeLessThan(0.01);
      expect(s.snapped).toBeCloseTo(row2.z1, 9);
      // Basınç oranı kademeyle aynı yönde
      expect(Math.sign(s.value - Number(knobById(`${m}.pr`)!.get(g)))).toBe(Math.sign(dn));
    }
  });

  it('aynı kademede tıklamak grafiği değiştirmez; sınır kademe çentiklerinden', () => {
    const b = built.turbojet;
    const row = stageRow(b, 'hpc')!;
    expect(solveStages(TURBOJET_GRAPH, b, 'hpc', row.z1 + 0.3 * row.pitch).model).toBe(TURBOJET_GRAPH);
    const r = stageRange(TURBOJET_GRAPH, b, 'hpc');
    expect(r.snaps[0]).toBeCloseTo(r.lo, 9);
    expect(r.snaps[r.snaps.length - 1]).toBeCloseTo(r.hi, 9);
    expect(r.snaps.length).toBeGreaterThanOrEqual(3);
  });
});

describe('lüle ağzı', () => {
  const kinds = ['turbojet', 'militaryTurbofan', 'turbofan', 'turboprop'];

  it.each(kinds)('%s: eşleme tekdüze, gidiş-dönüş ±%1', (k) => {
    const { g, b } = workshop(k);
    const id = nozzleCoupling(b.traits);
    const knob = knobById(id)!;
    const v0 = Number(knob.get(g));
    const r0 = nozzleAnchor(b).r;
    const range = nozzleRange(g, b);
    expect(range.blocked).toBeNull();
    // Aralık içinde beş hedef: bağlı değer tek yönde değişir, ağız hedefe ±%1 oturur
    const targets = [0.15, 0.35, 0.5, 0.65, 0.85].map((f) => range.lo + f * (range.hi - range.lo));
    const values: number[] = [];
    for (const r of targets) {
      const s = solveNozzleExit(g, b, r);
      values.push(s.value);
      const got = nozzleAnchor(rebuilderFor(b)(s.model)).r;
      expect(Math.abs(got / r - 1), `${k} hedef ${r.toFixed(4)}`).toBeLessThan(0.01);
    }
    const d = values.slice(1).map((v, i) => v - values[i]);
    expect(d.every((x) => x > 0) || d.every((x) => x < 0), values.join(', ')).toBe(true);
    // Gidiş-dönüş: %2 büyüt, sonra eski ağza dön → değer başa döner
    const up = solveNozzleExit(g, b, r0 * (range.hi > r0 * 1.02 ? 1.02 : 0.98));
    const b2 = rebuilderFor(b)(up.model);
    const back = solveNozzleExit(up.model, b2, r0);
    expect(Math.abs(back.value / v0 - 1)).toBeLessThan(0.01);
    expect(Math.abs(nozzleAnchor(rebuilderFor(b)(back.model)).r / r0 - 1)).toBeLessThan(0.01);
  });

  it('lüle trimi okuması bağı açıkça yazar', () => {
    expect(nozzleExplain('combustor.tit', 1230, 1180)).toMatch(/^Lüle trimi: daha geniş ağız → türbin daha az genişletir → .*T4 1230 → 1180 K/);
    expect(nozzleExplain('fan.bypassRatio', 0.68, 0.8)).toMatch(/BPR 0,68 → 0,8/);
  });
});

describe('çözücü ve süre', () => {
  it('solveMonotone: kurulamayan nokta hedefin ötesi sayılır, uca kırpar', () => {
    const f = (x: number) => (x > 8 ? null : { f: x * 2, model: TURBOJET_GRAPH, b: built.turbojet });
    // Hedef 12 → x = 6
    expect(solveMonotone(f, 1, 2, 10, 12).x).toBeCloseTo(6, 3);
    // Hedef 30 ulaşılamaz: çözülebilir sınıra (8) yapışır
    expect(solveMonotone(f, 1, 2, 10, 30).x).toBeCloseTo(8, 2);
    // Hedef geri yönde: x0 kalır
    expect(solveMonotone(f, 5, 10, 10, 4).x).toBe(5);
  });

  it('bir tutamaç adımı ≤ 20 ms (ısınmış)', () => {
    const steps: [string, HandleId, (b: BuiltEngine) => number][] = [
      ['turbojet', 'nozzleExit', (b) => nozzleAnchor(b).r * 0.97],
      ['militaryTurbofan', 'nozzleExit', (b) => nozzleAnchor(b).r * 1.03],
      ['turbofan', 'nozzleExit', (b) => nozzleAnchor(b).r * 1.01],
      ['turbojet', 'length:hpc', (b) => stageRow(b, 'hpc')!.z1 + 2 * stageRow(b, 'hpc')!.pitch],
      ['turbofan', 'length:hpc', (b) => stageRow(b, 'hpc')!.z1 + 2 * stageRow(b, 'hpc')!.pitch],
      ['turbofan', 'frontTip', (b) => frontTipAnchor(b)!.r * 1.05],
    ];
    const times: string[] = [];
    let worst = 0;
    for (const [k, id, target] of steps) {
      const { g, b } = workshop(k);
      const h = handleFor(id, knobCtx(g))!;
      h.solve(g, b, target(b)); // ısınma
      // Makine yükünden bağımsız ölçü: yedi denemenin en iyisi
      let ms = Infinity;
      for (let i = 0; i < 7; i++) {
        const t0 = performance.now();
        h.solve(g, b, target(b) * (1 + i * 1e-4));
        ms = Math.min(ms, performance.now() - t0);
      }
      worst = Math.max(worst, ms);
      times.push(`${k} ${id} ${ms.toFixed(2)} ms`);
    }
    expect(worst, times.join('; ')).toBeLessThanOrEqual(20);
  });
});
