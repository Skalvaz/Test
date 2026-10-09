/**
 * Çıplak motor görsel geometrisi (dalga 1 inceleme düzeltmeleri):
 * baypas ayırıcısı çizilen çekirdek gövdesinin dışında kalır ve türbine
 * girmez (#14); kuru motorun sabit lülesi jet borusuyla birlikte kızarır
 * (#25). Ağlar node'da gerçek üreticilerle kurulur, ölçüm çizilen
 * köşelerden yapılır.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BareJetLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { MILITARY_TURBOFAN_GRAPH } from '../design/templates';
import { TURBOJET_DRY_GRAPH } from '../design/turbojetDry';
import type { CompressorModule, EngineGraph, NozzleModule } from '../design/types';
import { splitterProfile } from './barejet.js';
import { buildGasPath } from './gaspath.js';
import { buildFixedNozzle, buildNozzle } from './nozzle.js';
import { tagPart } from './geom.js';
import { pipeGlowWeight, type PartId } from './visual';

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

function variant(bpr: number, dry: boolean, fpr?: number): EngineGraph {
  const g = structuredClone(MILITARY_TURBOFAN_GRAPH);
  if (dry) {
    g.modules = g.modules.filter((m) => m.type !== 'afterburner');
    const n = g.modules.find((m) => m.type === 'nozzle') as NozzleModule;
    n.style = 'fixed';
    delete n.flaps;
  }
  const fan = g.modules.find((m) => m.type === 'fan') as CompressorModule;
  fan.bypassRatio = bpr;
  // Şablonun FPR'ı (4,3) BPR ≳ 0,8'de LPT diskini mile sığdırmaz
  // (layouts/bare.ts checkLptDisk, tipli hata): yüksek BPR'da fiziksel FPR
  if (bpr > 0.8) fan.pr = 3;
  if (fpr !== undefined) fan.pr = fpr;
  return g;
}

/**
 * Çekirdek gaz yolunun sabit (dönmeyen) ağlarının 1 cm'lik eksenel
 * dilimlerdeki en büyük yarıçapı. Fan (ayırıcı dudağı fan çıkış kanatlarının
 * arkasında başlar) ve gövdeyi delip dışarı çıkan yakıt enjektörü/buji
 * sapları (çelik) sayılmaz.
 */
function coreEnvelope(L: BareJetLayout) {
  const gas = buildGasPath(namedMaterials(), L.gas);
  const spin = new Set<THREE.Object3D>();
  gas.lpSpool.traverse((o: THREE.Object3D) => spin.add(o));
  gas.hpSpool.traverse((o: THREE.Object3D) => spin.add(o));
  gas.group.updateMatrixWorld(true);
  const env = new Map<number, number>();
  const v = new THREE.Vector3();
  const M = new THREE.Matrix4();
  gas.group.traverse((o: THREE.Object3D) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || spin.has(o) || o.userData.part === 'fan') return;
    const name = (mesh.material as THREE.Material).name;
    if (name === 'nozzleMetal' || name === 'machinery') return;
    const inst = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh) : null;
    if (inst) inst.getMatrixAt(0, M);
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (inst) v.applyMatrix4(M);
      v.applyMatrix4(mesh.matrixWorld);
      const k = Math.round(v.z * 100);
      env.set(k, Math.max(env.get(k) ?? 0, Math.hypot(v.x, v.y)));
    }
  });
  return (z: number) => {
    const k = Math.round(z * 100);
    return Math.max(env.get(k - 1) ?? 0, env.get(k) ?? 0, env.get(k + 1) ?? 0);
  };
}

describe('baypas ayırıcısı (inceleme #14)', () => {
  const cases: [string, EngineGraph][] = [
    ['askeri TF şablonu', MILITARY_TURBOFAN_GRAPH],
    ['art yakıcılı BPR 0,1', variant(0.1, false)],
    ['kuru BPR 0,1', variant(0.1, true)],
    ['kuru BPR 0,3', variant(0.3, true)],
    ['kuru BPR 0,55', variant(0.55, true)],
    ['kuru BPR 1,0 (FPR 3)', variant(1.0, true)],
    ['kuru BPR 1,5 (FPR 3)', variant(1.5, true)],
    ['kuru BPR 1,5 (FPR 2,2)', variant(1.5, true, 2.2)],
    ['art yakıcılı BPR 1,5 (FPR 2,6)', variant(1.5, false, 2.6)],
  ];

  it.each(cases)('%s: çekirdek gövdesinin dışında, türbinden önce biter, kabuğun içinde', (_n, g) => {
    const L = buildEngine(g).flowpath.layout as BareJetLayout;
    const env = coreEnvelope(L);
    const p = splitterProfile(L, 1);
    expect(p[0].y).toBeCloseTo(L.splitterZ!, 9);
    // Yanma odası çıkışında gövdeye oturur: HPT/LPT kanat sıralarına girmez
    const zEnd = p[p.length - 1].y;
    expect(zEnd).toBeLessThanOrEqual(L.gas.combustor.z1 + 1e-9);
    expect(zEnd).toBeLessThan(L.gas.hpt.z0);
    for (const q of p) {
      expect(q.x, `z = ${q.y.toFixed(3)}`).toBeGreaterThan(env(q.y) + 0.002);
      expect(q.x).toBeLessThan(L.R - 0.03);
    }
    // Sonda gövdeye yakın (asılı bir sac kenarı değil)
    expect(p[p.length - 1].x - env(zEnd)).toBeLessThan(0.012);
    // Flanş payı yumuşak girer: sacta tek segmentlik radyal kırık yok
    // (eskiden sert eşikle BPR 1,5 / FPR 2,2'de 14 mm, kesitte ~30° basamak)
    let jump = 0;
    for (let i = 1; i < p.length; i++) jump = Math.max(jump, Math.abs(p[i].x - p[i - 1].x));
    expect(jump).toBeLessThan(0.0075);
  });
});

describe('sabit lüle ısıl kızıllığı (inceleme #25)', () => {
  it('kuru motorun sabit lülesi (nozzle parçası) jet borusuyla aynı malzemelerle kızarır', () => {
    const L = buildEngine(TURBOJET_DRY_GRAPH).flowpath.layout as BareJetLayout;
    if (L.nozzle.kind !== 'fixed') throw new Error('sabit lüle bekleniyordu');
    const nz = buildFixedNozzle(namedMaterials(), L.nozzle);
    // barejet.js lüle grubunu böyle etiketler
    tagPart(nz.group, 'nozzle');
    const glow = new Map<string, number>();
    nz.group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) glow.set(m.name || (m.material as THREE.Material).name, pipeGlowWeight(o.userData.part as PartId, (m.material as THREE.Material).name));
    });
    // Kurumlu iç yüz jet borusu kaplamasıyla (exhaust|sooted) aynı şiddette
    expect(glow.get('fixed-nozzle-liner')).toBe(pipeGlowWeight('exhaust', 'sooted'));
    expect(glow.get('fixed-nozzle-shell')).toBe(pipeGlowWeight('exhaust', 'inconel'));
    expect(glow.get('fixed-nozzle-liner')).toBeGreaterThan(0);
    expect(glow.get('fixed-nozzle-shell')).toBeGreaterThan(0);
  });

  it('art yakıcılı değişken lülenin malzemeleri bu yoldan kızarmaz (şablon görünümü aynı)', () => {
    const L = buildEngine(MILITARY_TURBOFAN_GRAPH).flowpath.layout as BareJetLayout;
    if (L.nozzle.kind === 'fixed' || !L.ab) throw new Error('değişken lüle bekleniyordu');
    const nz = buildNozzle(namedMaterials(), L.ab.z1, L.nozzle);
    tagPart(nz.group, 'nozzle');
    nz.group.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) expect(pipeGlowWeight('nozzle', (m.material as THREE.Material).name)).toBe(0);
    });
  });
});
