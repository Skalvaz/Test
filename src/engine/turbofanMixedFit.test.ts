/**
 * Karışık akışlı turbofanın daralan kaporta payıyla (c < 1) parça
 * çakışmaları, ortak lülenin yakınsaklığı ve fan kanalının Mach'ı (M5a
 * dalga 2 incelemesi): ağlar gerçek üreticilerle (core.js) node'da kurulur,
 * düğme aralığının içindeki küçük ve düşük baypaslı tasarımlarda ölçülür.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FlowpathError, machFromFlow, profileAt, type TurbofanLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { FAN_DUCT_MACH_MAX, MIXED_NOZZLE_CONTRACTION_MAX } from '../design/layouts/turbofan';
import { TURBOFAN_MIXED_GRAPH } from '../design/turbofanMixed';
import type { EngineGraph } from '../design/types';
import { DesignError } from '../sim/design';
import { AIR } from '../sim/gas';
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
  // Kısa LPT: HPT arkasındaki kaporta noktası egzoz kanalının üstüne düşer
  ['W 50, FPR 1,5, BPR 2,5', variant(50, { bypassRatio: 2.5, pr: 1.5 })],
  ['W 50, FPR 1,4, BPR 4', variant(50, { bypassRatio: 4, pr: 1.4 })],
  ['W 80, FPR 1,5, BPR 3', variant(80, { bypassRatio: 3, pr: 1.5 })],
];

/** Nesnenin bütün ağ köşeleri dünya uzayında [r, z] (örnekli ağda tek örnek: dönel simetri) */
function radialVerts(o: THREE.Object3D): [number, number][] {
  const out: [number, number][] = [];
  const v = new THREE.Vector3();
  const mi = new THREE.Matrix4();
  o.updateWorldMatrix(true, true);
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    const im = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh) : null;
    if (im) im.getMatrixAt(0, mi);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (im) v.applyMatrix4(mi);
      v.applyMatrix4(m.matrixWorld);
      out.push([Math.hypot(v.x, v.y), v.z]);
    }
  });
  return out;
}

/** z kutularında (4 mm) en büyük ya da en küçük yarıçap */
function binR(pts: [number, number][], agg: 'max' | 'min'): Map<number, number> {
  const m = new Map<number, number>();
  for (const [r, z] of pts) {
    const k = Math.round(z / 0.004);
    const cur = m.get(k);
    if (cur === undefined || (agg === 'max' ? r > cur : r < cur)) m.set(k, r);
  }
  return m;
}

const childNamed = (root: THREE.Object3D, name: string) => {
  let f: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!f && o.name === name) f = o;
  });
  return f!;
};

describe('ayırıcı burnu booster gövdesinin dışında (kaporta payı daralsa da)', () => {
  it.each(MIXED_FIT_CASES)('%s', (label, g) => {
    const L = buildEngine(g).flowpath.layout as TurbofanLayout;
    const core = buildCore(namedMaterials(), L);
    const splitter = childNamed(core.group, 'flow-splitter');
    expect(splitter, label).toBeDefined();
    // Booster'ın sabit kısmı ağdan: gövde kabuğu, orta flanş ve cıvataları
    // (flanş gövdeden ~2 cm taşar), stator kanatları
    const stator = binR(radialVerts(childNamed(core.group, 'booster-stator')), 'max');
    let n = 0;
    let worst = Infinity;
    for (const [r, z] of radialVerts(splitter)) {
      const k = Math.round(z / 0.004);
      for (const kk of [k - 1, k, k + 1]) {
        const c = stator.get(kk);
        if (c === undefined) continue;
        worst = Math.min(worst, r - c);
        n++;
      }
    }
    expect(n, label).toBeGreaterThan(0);
    // Önceden c < 0,69'da burnun iç yüzeyi gövdenin 2–5 cm içindeydi; gövde
    // payı düzelince kısa booster'da orta flanş burnu ~1,5 cm deliyordu
    expect(worst, label).toBeGreaterThan(0.001);
  });

  it('flanş burnun altına düşmeyen tasarımda yerinde (şablon: gövdenin ortası)', () => {
    const L = buildEngine(variant(465)).flowpath.layout as TurbofanLayout;
    const core = buildCore(namedMaterials(), L);
    const b = L.booster;
    // Flanşın cıvata halkaları (flanşın iki yüzünde): ortalama z gövdenin ortası
    const bolts: number[] = [];
    childNamed(core.group, 'booster-stator').traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name === 'boltSteel') for (const [, z] of radialVerts(m)) bolts.push(z);
    });
    expect(bolts.length).toBeGreaterThan(0);
    expect(Math.abs(bolts.reduce((a, z) => a + z, 0) / bolts.length - (b.z0 + b.z1) / 2)).toBeLessThan(0.005);
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

describe('çekirdek parçaları çekirdek kaportasının içinde (kaporta payı daralsa da)', () => {
  it.each(MIXED_FIT_CASES)('%s', (label, g) => {
    const L = buildEngine(g).flowpath.layout as TurbofanLayout;
    const core = buildCore(namedMaterials(), L);
    // Kaportanın (ve ayırıcı burnunun) iç yüzü: kutudaki en küçük yarıçap
    const shell = binR([...radialVerts(childNamed(core.group, 'core-cowl')), ...radialVerts(childNamed(core.group, 'flow-splitter'))], 'min');
    // Egzoz kanalı karıştırıcı başında kaportanın arka kenarına değer (tasarım gereği)
    const zEnd = L.mixed!.mixer.z0 - 0.02;
    for (const name of ['booster-stator', 'hpc-stator', 'hpt-stator', 'lpt-stator', 'exhaust-duct']) {
      let worst = Infinity;
      let at = 0;
      for (const [r, z] of radialVerts(childNamed(core.group, name))) {
        if (z < L.splitter.z || z > zEnd) continue;
        const s = shell.get(Math.round(z / 0.004));
        if (s !== undefined && s - r < worst) [worst, at] = [s - r, z];
      }
      // Önceden kısa LPT'de egzoz kanalı kaportayı ~2 cm, LPT gövdesi ~4 mm deliyordu
      expect(worst, `${label}: ${name} z ${at.toFixed(3)}`).toBeGreaterThan(0.001);
    }
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

describe('fan kanalında gerçekçi baypas Mach’ı (CFM56-5C ~0,5)', () => {
  /** OGV'den karıştırıcıya gerçek kanal duvarıyla (sabit ön kısım + alan kuralı) baypas Mach'ı */
  function ductMach(g: EngineGraph) {
    const b = buildEngine(g);
    const L = b.flowpath.layout as TurbofanLayout;
    const m = L.mixed!;
    const z0 = L.fan.z0 + 0.28 * L.s;
    const wall = [...NACELLE_DUCT_FRONT.filter(([, z]) => z < 0.55 - 1e-6).map(([r, z]) => [r * L.s, z0 + z * L.s] as [number, number]), ...m.duct];
    const st = b.sized.point.stations['13'];
    const machAt = (z: number) => {
      const ro = profileAt(wall, z);
      const ri = profileAt(L.coreCowl, z);
      return machFromFlow((st.W * Math.sqrt(st.T)) / (st.P * Math.PI * (ro * ro - ri * ri)), AIR);
    };
    const zs = [...Array.from({ length: 401 }, (_, i) => L.ogv.z + ((m.mixer.z0 - L.ogv.z) * i) / 400), ...L.coreCowl.map(([, z]) => z), ...m.duct.map(([, z]) => z)].filter(
      (z) => z >= L.ogv.z && z <= m.mixer.z0,
    );
    return { L, max: Math.max(...zs.map(machAt)), zA: machAt(m.duct[0][1]) };
  }

  it('şablon: fan kaportası sonunda ~0,5, karıştırıcıya dek hiçbir yerde 0,52’yi aşmaz; çekirdek kaportası daralır', () => {
    const r = ductMach(TURBOFAN_MIXED_GRAPH);
    // Önceden kaportanın sonunda 0,61, astarın örneklenmediği tümsekte 0,64
    expect(r.zA).toBeGreaterThan(0.47);
    expect(r.zA).toBeLessThanOrEqual(FAN_DUCT_MACH_MAX + 0.005);
    expect(r.max).toBeLessThan(0.52);
    // Çekirdek kaportası fan ucunun 0,79'uydu; şimdi LPT kasasının hemen üstünde
    const L = r.L;
    expect(Math.max(...L.coreCowl.map(([rr]) => rr)) / L.fan.tip[0]).toBeLessThan(0.75);
    expect(L.splitter.lip).toBeLessThan(1);
    expect(L.splitter.lip).toBeGreaterThan(0.5);
  });

  it.each([
    ['W 250', variant(250)],
    ['W 600', variant(600)],
    ['BPR 7', variant(465, { bypassRatio: 7 })],
    ['FPR 2, BPR 4', variant(465, { bypassRatio: 4, pr: 2 })],
  ])('%s: kaporta payı hedefi sağlarken kanal ≤ 0,52', (_l, g) => {
    expect(ductMach(g).max).toBeLessThan(0.52);
  });
});
