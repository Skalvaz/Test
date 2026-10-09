/**
 * Karışık akışlı kaportalı turbofanın görsel modeli (M5a P6): çekirdek
 * lülesi yerine karıştırıcı, uzun kanallı kaporta ve ortak lüle. Ağlar
 * node'da gerçek üreticilerle kurulur (bareJet.test.ts gibi); fan (DOM'lu
 * bulanıklık dokusu) ve pilon dışarıda.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { TurbofanLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { TURBOFAN_GRAPH } from '../design/templates';
import { TURBOFAN_MIXED_GRAPH } from '../design/turbofanMixed';
import type { EngineGraph, MixerModule } from '../design/types';
import { buildCore } from './core.js';
import { buildNacelle } from './nacelle.js';
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

/** turbofanModel.ts ile aynı yerleşim: çekirdek dünya koordinatında, kaporta fan ucu oranında ölçekli */
function model(g: EngineGraph) {
  const L = buildEngine(g).flowpath.layout as TurbofanLayout;
  const mats = namedMaterials();
  const long = longDuctOf(L);
  const core = buildCore(mats, L);
  const nacelle = buildNacelle(mats, long ? { long, chevrons: L.chevrons.bypass } : { ductExitR: L.bypassExit.rDuct / L.s, chevrons: L.chevrons.bypass });
  nacelle.scale.setScalar(L.s);
  nacelle.position.z = L.fan.z0 + 0.28 * L.s;
  const group = new THREE.Group().add(core.group, nacelle);
  group.updateMatrixWorld(true);
  const parts = new Map<string, THREE.Mesh[]>();
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const p = String(o.userData.part);
    parts.set(p, [...(parts.get(p) ?? []), mesh]);
  });
  return { L, core, parts };
}

/** Ağların dünya uzayındaki sınır kutusu */
function boxOf(meshes: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const o of meshes) box.expandByObject(o);
  return box;
}

describe('karışık akışlı turbofan modeli', () => {
  const { L, core, parts } = model(TURBOFAN_MIXED_GRAPH);
  const M = L.mixed!;

  it('karıştırıcı `mixer` parçası; lobe’lu sac yamasız iki yüzlü malzeme (kesitte kırmızı kapak yok)', () => {
    const mixer = parts.get('mixer') ?? [];
    expect(mixer.length).toBe(1);
    expect(core.mixer).toBe(mixer[0]);
    expect(mixer[0].name).toBe('lobed-mixer');
    const mat = mixer[0].material as THREE.Material;
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.userData.capped).toBeFalsy();
    // Lobe'lar yerleşimin karıştırıcısında: eksenel uçlar ve tepe yarıçapı
    const box = boxOf(mixer);
    expect(box.min.z).toBeCloseTo(M.mixer.z0, 3);
    expect(box.max.z).toBeCloseTo(M.mixer.z1, 3);
    expect(box.max.y).toBeCloseTo(M.mixer.r + M.mixer.amp, 2);
  });

  it('çekirdek lülesi yok: egzoz grubunda yalnız koni ve takviye halkaları', () => {
    const names = core.exhaust.children.map((o: THREE.Object3D) => o.name || o.type);
    expect(names).toContain('exhaust-plug');
    expect(core.exhaust.children.filter((o: THREE.Object3D) => (o as THREE.Mesh).geometry?.type === 'BufferGeometry' && o.name !== 'exhaust-plug')).toEqual([]);
  });

  it('ortak lüle (`nozzle`) ve uzun kaporta (`nacelle`) lüle ağzına kadar; arka kaporta boyası kesit kapaklı', () => {
    const nozzle = parts.get('nozzle') ?? [];
    expect(nozzle.some((o) => o.name === 'common-nozzle')).toBe(true);
    expect(boxOf(nozzle).max.z).toBeCloseTo(M.nozzle.z1, 2);
    const nacelle = parts.get('nacelle') ?? [];
    expect(boxOf(nacelle).max.z).toBeCloseTo(M.nozzle.z1, 2);
    const aft = nacelle.find((o) => o.name === 'aft-cowl')!;
    expect((aft.material as THREE.Material).userData.capped).toBe(true);
    // Lüle ağzı yarıçapı (ölçekli kaporta) yerleşimle aynı
    expect(boxOf(nozzle).max.y).toBeGreaterThan(M.nozzle.rExit);
  });

  it('düz karıştırıcı: ince kenarlı kısa halka, aynı parça', () => {
    const g = structuredClone(TURBOFAN_MIXED_GRAPH);
    (g.modules.find((x) => x.type === 'mixer') as MixerModule).style = 'confluent';
    const c = model(g);
    expect(c.parts.get('mixer')?.[0].name).toBe('confluent-mixer');
    expect(c.L.mixed!.mixer.amp).toBe(0);
  });

  it('ayrık akışlı turbofan: karıştırıcı ve uzun kanal yok, baypas lülesi fan kaportasında', () => {
    const s = model(TURBOFAN_GRAPH);
    expect(s.parts.get('mixer')).toBeUndefined();
    expect(s.core.mixer).toBeNull();
    expect((s.parts.get('nacelle') ?? []).some((o) => o.name === 'aft-cowl')).toBe(false);
    expect((s.parts.get('bypassNozzle') ?? []).length).toBeGreaterThan(0);
    expect((s.parts.get('nozzle') ?? []).length).toBe(0);
  });
});
