/**
 * M5a P4b: parça → modül eşlemesi ve meridyen silueti.
 */

import { describe, expect, it } from 'vitest';
import type { PartId } from '../engine/visual';
import { buildEngine } from './graph';
import { meridionalOutline, outlineBounds, outlineSvg } from './outline';
import { moduleOfPart, PART_MODULE, PART_TAGS, partsOfModule, type PartTag } from './partsMap';
import { MILITARY_TURBOFAN_GRAPH, TURBOFAN_GRAPH, TURBOJET_GRAPH, TURBOPROP_GRAPH } from './templates';
import { deriveTraits } from './traits';

/**
 * Derleme denetimi: engine/visual.ts PartId ile PartTag aynı küme olmalı
 * (biri değişip öteki unutulursa tip denetimi burada kırılır).
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const partTagsMatchPartId: Same<PartId, PartTag> = true;

describe('parça → modül', () => {
  it('PartTag = PartId; her etiket eşlemede', () => {
    expect(partTagsMatchPartId).toBe(true);
    expect(PART_TAGS.length).toBe(28);
    expect(PART_MODULE.pylon).toBeNull();
  });

  it('mimariye göre düzeltmeler', () => {
    const tj = deriveTraits(TURBOJET_GRAPH);
    const tf = deriveTraits(TURBOFAN_GRAPH);
    const tp = deriveTraits(TURBOPROP_GRAPH);
    // Tek akışlı jette ön kompresör 'booster' etiketli → LPC
    expect(moduleOfPart('booster', tj)).toBe('lpc');
    expect(moduleOfPart('booster', tf)).toBe('lpc');
    expect(moduleOfPart('fanCase', tf)).toBe('fan');
    expect(moduleOfPart('fanCase', tj)).toBe('engine');
    expect(moduleOfPart('gearbox', tp)).toBe('propeller');
    expect(moduleOfPart('gearbox', tf)).toBe('engine');
    expect(moduleOfPart('spinner', tp)).toBe('propeller');
    expect(moduleOfPart('spinner', tf)).toBe('inlet');
    expect(moduleOfPart('outputShaft', tp)).toBe('shaft');
    expect(moduleOfPart('stand', tj)).toBeNull();
  });

  it('modülün parçaları: tersine eşleme tutarlı', () => {
    const tf = deriveTraits(TURBOFAN_GRAPH);
    expect(partsOfModule('fan', tf).sort()).toEqual(['fan', 'fanCase', 'ogv']);
    expect(partsOfModule('nozzle', tf).sort()).toEqual(['bypassNozzle', 'exhaust', 'nozzle']);
    for (const t of [tf, deriveTraits(TURBOJET_GRAPH), deriveTraits(TURBOPROP_GRAPH)]) {
      for (const p of PART_TAGS) {
        const m = moduleOfPart(p, t);
        if (m) expect(partsOfModule(m, t)).toContain(p);
      }
    }
  });
});

describe('meridyen silueti', () => {
  it.each([TURBOJET_GRAPH, MILITARY_TURBOFAN_GRAPH, TURBOPROP_GRAPH, TURBOFAN_GRAPH])('%#: çizgiler sonlu, zarf motoru kapsar, < 0,5 ms', (g) => {
    const b = buildEngine(g);
    let lines = meridionalOutline(b);
    // Makine yükünden bağımsız ölçü: beş denemenin en iyisi
    let ms = Infinity;
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      lines = meridionalOutline(b);
      ms = Math.min(ms, performance.now() - t0);
    }
    expect(ms).toBeLessThan(0.5);
    expect(lines.length).toBeGreaterThan(10);
    const bb = outlineBounds(lines);
    expect(bb.z1 - bb.z0).toBeCloseTo(b.flowpath.layout.outerProfile.at(-1)![0] - b.flowpath.layout.outerProfile[0][0], 1);
    expect(bb.r).toBeGreaterThanOrEqual(b.flowpath.metrics.diameter / 2 - 1e-9);
    const svg = outlineSvg(b);
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 240 90"/);
    expect(svg).not.toMatch(/NaN|Infinity/);
  });
});
