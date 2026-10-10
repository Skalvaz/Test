/**
 * Karışık akışlı turbofanın daralan kaporta payıyla (c < 1) parça
 * çakışmaları (M5a dalga 2 incelemesi): ağlar gerçek üreticilerle
 * (core.js) node'da kurulur, düğme aralığının içindeki küçük ve düşük
 * baypaslı tasarımlarda ölçülür.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TurbofanLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { TURBOFAN_MIXED_GRAPH } from '../design/turbofanMixed';
import type { EngineGraph } from '../design/types';
import { buildCore } from './core.js';

/** Kütüphane yerine: her ada kendi adını taşıyan düz malzeme */
function namedMaterials(): Record<string, THREE.MeshStandardMaterial> {
  const cache = new Map<string, THREE.MeshStandardMaterial>();
  return new Proxy({} as Record<string, THREE.MeshStandardMaterial>, {
    get: (_t, k) => {
      if (typeof k !== 'string') return undefined;
      let m = cache.get(k);
      if (!m) cache.set(k, (m = Object.assign(new THREE.MeshStandardMaterial(), { name: k })));
      return m;
    },
  });
}

/** Şablondan hava akışı ve fan düğmeleri değişmiş kopya (hepsi TFM düğme aralığında) */
function variant(w: number, fan: { bypassRatio?: number; pr?: number } = {}): EngineGraph {
  const g = structuredClone(TURBOFAN_MIXED_GRAPH);
  g.massFlow = w;
  g.modules = g.modules.map((m) => (m.type === 'fan' ? { ...m, ...fan } : m));
  return g;
}

/** İncelemede çakışma ölçülen tasarımlar + şablon */
const MIXED_FIT_CASES: [string, EngineGraph][] = [
  ['şablon', variant(465)],
  ['W 250', variant(250)],
  ['W 100', variant(100)],
  ['W 50', variant(50)],
  ['W 100, BPR 4', variant(100, { bypassRatio: 4 })],
  ['W 50, BPR 2,5', variant(50, { bypassRatio: 2.5 })],
  ['W 70, BPR 3', variant(70, { bypassRatio: 3 })],
  ['W 100, BPR 2,5, FPR 1,8', variant(100, { bypassRatio: 2.5, pr: 1.8 })],
  ['FPR 2, BPR 2,5', variant(465, { bypassRatio: 2.5, pr: 2 })],
];

describe('ayırıcı burnu booster gövdesinin dışında (kaporta payı daralsa da)', () => {
  it.each(MIXED_FIT_CASES)('%s', (label, g) => {
    const L = buildEngine(g).flowpath.layout as TurbofanLayout;
    const core = buildCore(namedMaterials(), L);
    let splitter: THREE.Mesh | undefined;
    core.group.traverse((o: THREE.Object3D) => {
      if (o.name === 'flow-splitter') splitter = o as THREE.Mesh;
    });
    expect(splitter, label).toBeDefined();
    const b = L.booster;
    // Booster gövdesinin dış yüzeyi: uç + 0,004 (boşluk + şerit) + 0,008 (et), stages.js
    const caseOuter = (z: number) => b.tip[0] + (b.tip[1] - b.tip[0]) * THREE.MathUtils.clamp((z - b.z0) / (b.z1 - b.z0), 0, 1) + 0.012;
    const pos = splitter!.geometry.attributes.position;
    const p = new THREE.Vector3();
    let n = 0;
    let worst = Infinity;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      // İlk rotor kanadının ön kenarından geriye (burnun booster'la örtüşen kısmı)
      if (p.z < b.z0 - 0.5 * b.pitch) continue;
      worst = Math.min(worst, Math.hypot(p.x, p.y) - caseOuter(p.z));
      n++;
    }
    expect(n, label).toBeGreaterThan(0);
    // Önceden c < 0,69'da burnun iç yüzeyi gövdenin 2–3 cm içindeydi
    expect(worst, label).toBeGreaterThan(0.001);
  });

  it('küçük motorda kaporta payı gerçekten daralır (sınanan dal c < 1)', () => {
    const L = buildEngine(variant(100)).flowpath.layout as TurbofanLayout;
    expect(L.splitter.lip).toBeLessThan(0.75);
  });
});
