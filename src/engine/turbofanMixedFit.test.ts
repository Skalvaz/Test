/**
 * Karışık akışlı turbofanın daralan kaporta payıyla (c < 1) parça
 * çakışmaları (M5a dalga 2 incelemesi): ağlar gerçek üreticilerle
 * (core.js) node'da kurulur, düğme aralığının içindeki küçük ve düşük
 * baypaslı tasarımlarda ölçülür.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FlowpathError, profileAt, type TurbofanLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { MIXED_NOZZLE_CONTRACTION_MAX } from '../design/layouts/turbofan';
import { TURBOFAN_MIXED_GRAPH } from '../design/turbofanMixed';
import type { EngineGraph } from '../design/types';
import { DesignError } from '../sim/design';
import { buildCore } from './core.js';
import { smoothProfile } from './geom.js';
import { longDuctOf } from './turbofanModel';

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

/** nacelle.js baypas kanalı iç duvarının sabit ön kısmı (kaporta referansında, z < 0,55) */
const NACELLE_DUCT_FRONT: [number, number][] = [
  [1.392, -1.35],
  [1.402, -0.95],
  [1.414, -0.6],
  [1.418, -0.3],
  [1.412, 0.1],
  [1.396, 0.55],
];
const smooth = (pts: [number, number][], n: number) => smoothProfile(pts, n).map((v: THREE.Vector2) => [v.x, v.y] as [number, number]);

describe('çekirdek kaportası baypas kanalı astarının içinde (kaporta payı daralsa da)', () => {
  it.each(MIXED_FIT_CASES)('%s', (label, g) => {
    const L = buildEngine(g).flowpath.layout as TurbofanLayout;
    // Profil z'de artar (geri dönen nokta yumuşatılınca kaportayı kendi üstüne kıvırıyordu)
    for (let i = 1; i < L.coreCowl.length; i++) expect(L.coreCowl[i][1], `${label} nokta ${i}`).toBeGreaterThan(L.coreCowl[i - 1][1]);
    // Ağları üreten yumuşatılmış profiller (core.js 170, nacelle.js 220 bölüm)
    // kaporta referansında; astar karıştırıcı başına kadar
    const long = longDuctOf(L)!;
    const ref = smooth(L.coreCowl.map(([r, z]) => [r / L.s, (z - L.fan.z0) / L.s - 0.28] as [number, number]), 170);
    const liner = smooth([...NACELLE_DUCT_FRONT.filter(([, z]) => z < 0.55 - 1e-6), ...long.duct.filter(([, z]) => z < long.mixZ)], 220);
    let worst = Infinity;
    let at = 0;
    for (const [r, z] of ref) {
      if (z < -0.5 || z > long.mixZ) continue;
      const d = (profileAt(liner, z) - r) * L.s;
      if (d < worst) [worst, at] = [d, z];
    }
    // Önceden düşük BPR + küçük hava akışında astar kaportanın 17–35 mm içindeydi
    expect(worst, `${label} z_ref ${at.toFixed(2)}`).toBeGreaterThan(0.01);
  });
});

describe('ortak lüle yakınsak: ağız karıştırma kanalından dar ya da öğretici hata', () => {
  const tryBuild = (g: EngineGraph): { L?: TurbofanLayout; e?: Error } => {
    try {
      return { L: buildEngine(g).flowpath.layout as TurbofanLayout };
    } catch (e) {
      return { e: e as Error };
    }
  };

  it.each([
    ['FPR 1,4, BPR 4', variant(465, { pr: 1.4, bypassRatio: 4 })],
    ['FPR 1,4, BPR 3', variant(465, { pr: 1.4, bypassRatio: 3 })],
    ['FPR 1,4, BPR 3, W 600', variant(600, { pr: 1.4, bypassRatio: 3 })],
  ])('%s: düşük karışma basıncı → mixer.nozzle (önceden ağız kanaldan %%4–29 genişti)', (_l, g) => {
    const e = tryBuild(g).e as FlowpathError;
    expect(e).toBeInstanceOf(FlowpathError);
    expect(e.code).toBe('mixer.nozzle');
    expect(e.knobs).toEqual(['fan.pr', 'fan.bypassRatio']);
    expect(e.message).not.toMatch(/NaN|undefined/);
    expect(e.data!.rExit).toBeGreaterThan(MIXED_NOZZLE_CONTRACTION_MAX * e.data!.rDuct);
  });

  it('öneri doğru yönde: baypas oranı artınca karışma basıncı yükselir, tasarım kurulur', () => {
    expect(tryBuild(variant(465, { pr: 1.4, bypassRatio: 7 })).L).toBeDefined();
    // A9mix hesaplanamazsa (mixer.area) da aynı öneri: BPR artınca alan
    // hesaplanır (ağız hâlâ geniş), fan PR de artınca tasarım kurulur
    const code = (g: EngineGraph) => (tryBuild(g).e as FlowpathError | undefined)?.code;
    expect(code(variant(465, { pr: 1.3, bypassRatio: 4 }))).toBe('mixer.area');
    expect(code(variant(465, { pr: 1.3, bypassRatio: 7 }))).toBe('mixer.nozzle');
    expect(tryBuild(variant(465, { pr: 1.45, bypassRatio: 7 })).L).toBeDefined();
  });

  it('düğme aralığının köşelerinde kurulan her tasarımda lüle yakınsak (ağız ≤ 0,95 kanal, duvar ağza daralır)', () => {
    let built = 0;
    for (const w of [50, 465, 600])
      for (const pr of [1.4, 1.5, 1.64, 2])
        for (const bypassRatio of [2.5, 4, 5.5, 7]) {
          const r = tryBuild(variant(w, { pr, bypassRatio }));
          const label = `W ${w} FPR ${pr} BPR ${bypassRatio}`;
          if (!r.L) {
            // Tipli Türkçe hata (çevrim çözülmezse DesignError)
            expect(r.e instanceof FlowpathError || r.e instanceof DesignError, `${label}: ${String(r.e)}`).toBe(true);
            continue;
          }
          built++;
          const m = r.L.mixed!;
          expect(m.nozzle.rExit, label).toBeLessThanOrEqual(MIXED_NOZZLE_CONTRACTION_MAX * m.ductEnd.r);
          for (let i = 1; i < m.duct.length; i++)
            if (m.duct[i - 1][1] >= m.mixer.z1 - 1e-9) expect(m.duct[i][0], label).toBeLessThanOrEqual(m.duct[i - 1][0] + 1e-9);
        }
    expect(built).toBeGreaterThan(20);
  });
});
