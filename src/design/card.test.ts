/**
 * M5a P4b: motor kartı (Faz 4 temeli). Alanlar sonlu, en az iki bağlantı,
 * dış zarf z'de tekdüze.
 */

import { describe, expect, it } from 'vitest';
import { fakeArchitectureOf } from '../workshop/testing';
import { buildEngineCard, massCentroidZ } from './card';
import { familyToDoc } from './engineDoc';
import { buildEngine } from './graph';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import type { EngineGraph } from './types';

/** P4a birleşene dek aile anahtarı taklitle */
const archKey = (b: { graph: EngineGraph }) => JSON.stringify(fakeArchitectureOf(b.graph));

function docFor(g: EngineGraph) {
  return familyToDoc({
    id: 'f_0000000001',
    code: 'AT-1',
    name: 'AT-1 Deneme',
    base: g,
    envelope: {},
    variants: [{ id: 'v_00000001', name: 'AT-1/45', nameLocked: false, values: {} }],
    active: 'v_00000001',
    origin: { from: 'template', template: 'turbojet' },
  });
}

/** Nesnedeki bütün sayılar sonlu */
function finiteDeep(x: unknown, path = ''): string[] {
  if (typeof x === 'number') return Number.isFinite(x) ? [] : [path];
  if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => finiteDeep(v, `${path}.${k}`));
  return [];
}

describe('motor kartı', () => {
  it.each([
    ['turbojet', TURBOJET_GRAPH],
    ['militaryTurbofan', MILITARY_TURBOFAN_GRAPH],
    ['turboprop', TURBOPROP_GRAPH],
    ['turbofan', TURBOFAN_GRAPH],
  ] as [string, EngineGraph][])('%s: alanlar sonlu, mounts ≥ 2, zarf z artan', (kind, g) => {
    const b = buildEngine(g);
    const doc = docFor(g);
    const c = buildEngineCard(doc, 'v_00000001', b, { archKey });
    expect(finiteDeep(c)).toEqual([]);
    expect(c.format).toBe('tfa-engine-card');
    expect(c.ref).toEqual({ familyId: 'f_0000000001', variantId: 'v_00000001', rev: b.rev, family: 'AT-1 Deneme', variant: 'AT-1/45' });
    expect(c.presentation).toBe(kind);
    expect(c.mounts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < c.dims.envelope.length; i++) expect(c.dims.envelope[i][0]).toBeGreaterThan(c.dims.envelope[i - 1][0]);
    expect(c.dims.maxRadius).toBeGreaterThan(0);
    expect(c.mass.dry).toBe(b.flowpath.metrics.mass.total);
    // Ağırlık merkezi motorun boyu içinde
    expect(c.mass.cgZ).toBeGreaterThan(c.dims.envelope[0][0]);
    expect(c.mass.cgZ).toBeLessThan(c.dims.envelope.at(-1)![0]);
    expect(c.ratings.takeoff.thrust).toBe(b.sized.point.thrust);
    expect(c.spools.hpRpm).toBeGreaterThan(c.spools.lpRpm * 0.5);
    if (b.design.afterburner) expect(c.ratings.maxAB!.thrust).toBeGreaterThan(c.ratings.takeoff.thrust);
    else expect(c.ratings.maxAB).toBeUndefined();
    if (kind === 'turboprop') {
      expect(c.dims.propDiameter).toBeCloseTo(3.93, 9);
      expect(c.ratings.takeoff.shaftPower).toBeGreaterThan(1e6);
    }
  });

  it('ağırlık merkezi: parça başına merkez verilirse onu kullanır', () => {
    const b = buildEngine(TURBOJET_GRAPH);
    const z = massCentroidZ(b);
    const parts = b.flowpath.metrics.mass.parts;
    const centroids = Object.fromEntries(Object.keys(parts).map((k) => [k, 1.5]));
    const withC = { ...b, flowpath: { ...b.flowpath, metrics: { ...b.flowpath.metrics, mass: { ...b.flowpath.metrics.mass, centroids } } } };
    expect(massCentroidZ(withC)).toBeCloseTo(1.5, 9);
    expect(z).not.toBeCloseTo(1.5, 3);
  });
});
