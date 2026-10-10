/**
 * Turboşaft 3B modeli (M5a dalga 2 incelemesi): çıkış milinin dönüşü,
 * redüktör dişlilerinin kinematiği ve test standı askısının ölçeği.
 *  - Doğrudan tahrikte (redüktörsüz) flanş güç türbini milinde döner; ara
 *    mil ve kaplin de aynı açıda dönmeli (eskiden lpAngle/oran ile kayıyordu).
 *  - Redüktör dişlileri yerleşimin oranına göre boyutlanır: planet takımı
 *    (i = 1 + Rç/Rg) ya da bileşik dizi (i = R2/R1 · R4/R3); dişler kaymaz.
 *  - Askı levhaları küçük motorda incelir, şablonlarda değişmez.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../design/catalog';
import { buildEngine } from '../design/graph';
import type { EngineGraph, ShaftModule } from '../design/types';
import { MODEL_BUILDERS, type Materials } from './models';
import { yokeScale } from './stand.js';
import { PLANET_MIN_RATIO, reductionGears } from './turboshaft.js';

// Tarayıcısız ortamda tuval: her çağrıyı yutan sahte nesne (modelSweep.test.ts gibi)
const sink: unknown = new Proxy(function () {}, {
  get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : sink),
  apply: () => sink,
});
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => sink }) };

const cache = new Map<string, THREE.MeshStandardMaterial>();
const MATS = new Proxy({} as Materials, {
  get: (_t, k) => {
    if (typeof k !== 'string') return undefined;
    let m = cache.get(k);
    if (!m) cache.set(k, (m = Object.assign(new THREE.MeshStandardMaterial(), { name: k })));
    return m;
  },
});

const TS = TEMPLATES.turboshaft!;

function variant(rpm: number, opts: { reduction?: boolean; massFlow?: number } = {}): EngineGraph {
  const g = structuredClone(TS);
  const sh = g.modules.find((m) => m.type === 'shaft') as ShaftModule;
  sh.rpm = rpm;
  if (opts.reduction !== undefined) sh.reduction = opts.reduction;
  if (opts.massFlow !== undefined) g.massFlow = opts.massFlow;
  return g;
}

function model(g: EngineGraph) {
  const b = buildEngine(g);
  const m = MODEL_BUILDERS[b.traits.layout](MATS, { slot: 'workshop', built: b, layout: b.flowpath.layout, traits: b.traits });
  const L = b.flowpath.layout;
  if (L.style !== 'turboshaft') throw new Error('yerleşim');
  return { b, m, L };
}

const byName = (root: THREE.Object3D, name: string) => {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  if (!found) throw new Error(`${name} yok`);
  return found;
};

describe('çıkış mili dönüşü', () => {
  it('doğrudan tahrik (istenen 20 000 rpm, güç türbini ~20 900): flanş, ara mil ve kaplin aynı açıda', () => {
    const { m, L } = model(variant(20000));
    expect(L.output.reduction).toBe(false);
    const out = m.outputShaft as THREE.Object3D;
    // Flanş güç türbini milinin parçası
    expect(out.parent).toBe(m.lpSpool);
    const drive = byName(m.group, 'dyno-drive');
    for (const lpAngle of [0.7, 25 * 2 * Math.PI + 0.3]) {
      m.lpSpool.rotation.z = lpAngle;
      m.tick!(lpAngle, 0);
      // Kaplin ve flanşın mutlak açısı aynı (eskiden %4 kayıyordu: 25 turda bir tur)
      expect(drive.rotation.z).toBeCloseTo(m.lpSpool.rotation.z + out.rotation.z, 9);
    }
  });

  it('redüktörde ara mil çıkış miliyle aynı açıda (lpAngle / oran)', () => {
    const { m, L } = model(variant(6000));
    expect(L.output.reduction).toBe(true);
    const out = m.outputShaft as THREE.Object3D;
    const drive = byName(m.group, 'dyno-drive');
    m.tick!(10, 0);
    expect(out.rotation.z).toBeCloseTo(10 / L.output.gearRatio, 9);
    expect(drive.rotation.z).toBeCloseTo(out.rotation.z, 9);
  });
});

describe('redüktör dişlileri orana göre (kinematik tutarlı)', () => {
  const cases: [string, EngineGraph, 'planet' | 'compound'][] = [
    ['3000 rpm (i ≈ 7)', variant(3000), 'planet'],
    ['6000 rpm (i ≈ 3,5)', variant(6000), 'planet'],
    ['17 000 rpm (i ≈ 1,23)', variant(17000), 'compound'],
    ['zorla redüktör, 20 900 rpm (i ≈ 1)', variant(20900, { reduction: true }), 'compound'],
    ['15 kg/s, 20 900 rpm (devir artırıcı, i ≈ 0,55)', variant(20900, { massFlow: 15 }), 'compound'],
  ];
  it.each(cases)('%s', (_n, g, kind) => {
    const { m, L } = model(g);
    expect(L.output.reduction).toBe(true);
    const i = L.output.gearRatio;
    const info = (m.outputShaft as THREE.Object3D).userData.gears as { kind: string; radii: number[] };
    expect(info.kind).toBe(kind);
    expect(i >= PLANET_MIN_RATIO).toBe(kind === 'planet');
    if (kind === 'planet') {
      const [RS, RP, RR] = info.radii;
      expect(RR).toBeCloseTo(RS + 2 * RP, 12);
      expect(1 + RR / RS).toBeCloseTo(i, 9);
    } else {
      const [R1, R2, R3, R4] = info.radii;
      expect(R1 + R2).toBeCloseTo(R3 + R4, 12);
      expect((R2 / R1) * (R4 / R3)).toBeCloseTo(i, 9);
    }
    // Dişliler redüktör kutusuna sığar
    const box = new THREE.Box3();
    m.group.updateMatrixWorld(true);
    for (const name of ['gear-input', 'gear-fixed', 'gear-output']) box.union(new THREE.Box3().setFromObject(byName(m.group, name)));
    expect(Math.max(box.max.x, box.max.y, -box.min.x, -box.min.y)).toBeLessThan(L.housing.gearboxR);
    expect(box.min.z).toBeGreaterThan(L.housing.gearbox[0]);
    expect(box.max.z).toBeLessThan(L.housing.gearbox[1]);
  });

  it('planet takımı: güneş ve çember kavramalarında kayma yok (dönen çerçevede)', () => {
    for (const i of [2.6, 3.48, 6.96, 12]) {
      const gs = reductionGears(MATS, { z0: 0, z1: 0.1, R: 0.15, ratio: i, part: 'outputShaft' });
      const [RS, RP, RR] = gs.radii;
      const lp = 3.7;
      const carrier = lp / i;
      gs.tick(lp, carrier);
      const planet = gs.output.children.find((c) => (c as THREE.Mesh).isMesh && Math.hypot(c.position.x, c.position.y) > 0.9 * (RS + RP))!;
      const phi = planet.rotation.z;
      // Güneş: Rg·(θg − θt) = −Rp·φ; çember (sabit): Rç·(0 − θt) = Rp·φ
      expect(RS * (lp - carrier)).toBeCloseTo(-RP * phi, 9);
      expect(RR * (0 - carrier)).toBeCloseTo(RP * phi, 9);
    }
  });

  it('bileşik dizi: iki kavramada çevre hızları eşit', () => {
    for (const i of [0.5, 0.95, 1, 1.6, 2.5]) {
      const gs = reductionGears(MATS, { z0: 0, z1: 0.1, R: 0.15, ratio: i, part: 'outputShaft' });
      const [R1, R2, R3, R4] = gs.radii;
      const lp = 2.1;
      const out = lp / i;
      gs.tick(lp, out);
      const lay = gs.fixed.children.find((c) => c.name === 'layshaft')!;
      expect(R1 * lp).toBeCloseTo(-R2 * lay.rotation.z, 9);
      expect(R3 * lay.rotation.z).toBeCloseTo(-R4 * out, 9);
    }
  });
});

describe('test standı askısı motorla ölçeklenir', () => {
  it('askılı şablonlarda ölçek 1 (görünüm değişmez), turboşaftta < 1', () => {
    for (const id of ['turbojet', 'turbojetDry', 'militaryTurbofan', 'turboprop'] as const) {
      const L = buildEngine(TEMPLATES[id]!).flowpath.layout as unknown as { R?: number; engineR?: number };
      expect(yokeScale(L.R ?? L.engineR!), id).toBe(1);
    }
    const { m, L } = model(TS);
    const s = yokeScale(L.engineR);
    expect(s).toBeLessThan(0.8);
    const yoke = byName(m.group, 'stand-yoke');
    m.group.updateMatrixWorld(true);
    // Askı levhaları (uzun dikey kutular): genişlik 0,22·s
    const plates = yoke.children.filter((c) => {
      const g = (c as THREE.Mesh).geometry as THREE.BoxGeometry | undefined;
      return g?.type === 'BoxGeometry' && g.parameters.height > 1;
    }) as THREE.Mesh<THREE.BoxGeometry>[];
    expect(plates.length).toBe(4);
    for (const p of plates) expect(p.geometry.parameters.depth).toBeCloseTo(0.22 * s, 12);
  });
});
