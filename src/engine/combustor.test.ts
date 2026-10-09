/**
 * Kutu ve kutu-halka yanma odasında gömlek kor parlamasının alev tarafı
 * (dalga 1 inceleme #26). Gömlek shader'ı (materials/engine.ts
 * linerSurface) alev tarafını yerel konum ve normalden kestirir; kutu
 * gömleği kendi ekseninde, geçiş parçaları ve kanalları motor ekseni
 * çerçevesinde kurulur. Bu test, her yüzeyin parlayan tarafının gaz
 * (boşluk) tarafı olduğunu çizilen köşelerden doğrular.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BareJetLayout } from '../design/flowpath';
import { buildEngine } from '../design/graph';
import { TURBOJET_DRY_GRAPH } from '../design/turbojetDry';
import type { CombustorModule, EngineGraph } from '../design/types';
import { createEngineMaterials, linerUniforms } from '../materials/engine';
import { buildGasPath } from './gaspath.js';

const lib = createEngineMaterials(null);

/** Gömlek kütüphaneden (yamalı), geri kalanı adını taşıyan düz malzeme */
function materials(): Record<string, THREE.Material> {
  const cache = new Map<string, THREE.Material>();
  return new Proxy({} as Record<string, THREE.Material>, {
    get: (_t, k) => {
      if (typeof k !== 'string') return undefined;
      if (k in lib) return (lib as Record<string, THREE.Material>)[k];
      let m = cache.get(k);
      if (!m) cache.set(k, (m = Object.assign(new THREE.MeshStandardMaterial(), { name: k })));
      return m;
    },
  });
}

/** Kutu stilinde kurulabilen kuru turbojet (kutular çevreye sığana dek ayar) */
function styled(style: 'can' | 'canAnnular'): BareJetLayout {
  for (const cans of [8, 6]) {
    for (let v = 25; v < 52; v += 5) {
      const g: EngineGraph = structuredClone(TURBOJET_DRY_GRAPH);
      const c = g.modules.find((m) => m.type === 'combustor') as CombustorModule;
      c.style = style;
      c.cans = cans;
      c.refVelocity = Math.max(c.refVelocity, v);
      try {
        return buildEngine(g).flowpath.layout as BareJetLayout;
      } catch {
        /* sığmadı: bir sonraki ayar */
      }
    }
  }
  throw new Error('kutular sığmadı');
}

/** Yanma odası grubundaki gömlek malzemeli ağlar */
function linerMeshes(L: BareJetLayout) {
  const gas = buildGasPath(materials(), L.gas);
  const out: THREE.Mesh[] = [];
  gas.group.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name === 'combustorGlow') out.push(m);
  });
  return out;
}

/** materials/engine.ts linerSurface'teki alev tarafı kuralının JS karşılığı */
function shaderFlame(p: THREE.Vector3, n: THREE.Vector3, uRMid: number) {
  const lr = Math.hypot(p.x, p.y);
  const lSide = (n.x * p.x + n.y * p.y) / (Math.hypot(n.x, n.y) * lr || 1);
  return lr > uRMid ? lSide <= -0.3 : lSide >= 0.3;
}

/**
 * Köşelerin z dilimlerine göre gaz tarafı: normal, dilimin (dışbükey kesit)
 * merkezine bakıyorsa boşluğa bakan yüzdür. Kapak köşeleri (|n.z| büyük)
 * ve ilk/son dilim sayılmaz.
 */
function gasSideByGeometry(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const slices = new Map<number, { x: number; y: number; k: number; zs: number }>();
  const key = (z: number) => Math.round(z * 1e5);
  for (let i = 0; i < p.count; i++) {
    const s = slices.get(key(p.getZ(i))) ?? { x: 0, y: 0, k: 0, zs: p.getZ(i) };
    s.x += p.getX(i);
    s.y += p.getY(i);
    s.k++;
    slices.set(key(p.getZ(i)), s);
  }
  const zs = [...slices.values()].map((s) => s.zs).sort((a, b) => a - b);
  const res: { i: number; gas: boolean }[] = [];
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z <= zs[0] + 1e-6 || z >= zs[zs.length - 1] - 1e-6) continue;
    if (Math.abs(nr.getZ(i)) > 0.5) continue;
    const s = slices.get(key(z))!;
    const d = (s.x / s.k - p.getX(i)) * nr.getX(i) + (s.y / s.k - p.getY(i)) * nr.getY(i);
    res.push({ i, gas: d > 0 });
  }
  return res;
}

describe('kutu-halka geçiş parçası (inceleme #26)', () => {
  const L = styled('canAnnular');
  const meshes = linerMeshes(L);
  const tp = meshes.find((m) => (m as THREE.InstancedMesh).isInstancedMesh && m.geometry.attributes.gasSide)!;

  it('geçiş parçası alev tarafını öznitelikle bildirir: iç yüz 1, iç kasaya bakan dış yüz 0', () => {
    expect(tp).toBeDefined();
    const attr = tp.geometry.attributes.gasSide;
    const checks = gasSideByGeometry(tp.geometry);
    expect(checks.length).toBeGreaterThan(500);
    for (const { i, gas } of checks) expect(attr.getX(i)).toBe(gas ? 1 : 0);
    // Eski kural (motor ekseni çerçevesinde uRMid = kutu yarıçapı) bu yüzlerin bir kısmını ters parlatıyordu
    const rc = (L.gas.combustor.rOut - L.gas.combustor.rIn) / 2;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const wrong = checks.filter(({ i, gas }) => {
      p.fromBufferAttribute(tp.geometry.attributes.position, i);
      n.fromBufferAttribute(tp.geometry.attributes.normal, i);
      return shaderFlame(p, n, rc) !== gas;
    });
    expect(wrong.length).toBeGreaterThan(checks.length * 0.2);
  });

  it('malzemesi gömlek yamalarını korur, alev tarafını öznitelikten alır; adı combustorGlow (T4 parlaması)', () => {
    const mat = tp.material as THREE.MeshPhysicalMaterial;
    expect(mat.name).toBe('combustorGlow');
    expect(mat).not.toBe(lib.combustorGlow);
    const compile = (m: THREE.Material) => {
      const sh = {
        vertexShader: THREE.ShaderLib.physical.vertexShader,
        fragmentShader: THREE.ShaderLib.physical.fragmentShader,
        uniforms: {},
      } as unknown as THREE.WebGLProgramParametersWithUniforms;
      m.onBeforeCompile(sh, null as unknown as THREE.WebGLRenderer);
      return sh;
    };
    const sh = compile(mat);
    expect(sh.vertexShader).toContain('attribute float gasSide;');
    expect(sh.fragmentShader).toContain('float lFlame = step(0.5, vLGas);');
    expect(sh.fragmentShader).not.toContain('lr > uRMid');
    // Gömlek deseni (delikler, halkalar) duruyor; kütüphane malzemesi değişmedi
    expect(sh.fragmentShader).toContain('discard');
    expect(compile(lib.combustorGlow).fragmentShader).toContain('lr > uRMid');
    expect(mat.customProgramCacheKey()).not.toBe(lib.combustorGlow.customProgramCacheKey());
  });

  it('kutu gömleği (kendi ekseninde) her yerde içten parlar: kubbe ve daralan çıkış dahil', () => {
    const can = meshes.find((m) => (m as THREE.InstancedMesh).isInstancedMesh && m.material === lib.combustorGlow)!;
    expect(can).toBeDefined();
    const pos = can.geometry.attributes.position;
    const nor = can.geometry.attributes.normal;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    let inner = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      const lSide = (n.x * p.x + n.y * p.y) / (Math.hypot(n.x, n.y) * Math.hypot(p.x, p.y) || 1);
      if (Math.abs(lSide) < 0.5) continue;
      const gas = lSide < 0; // eksene bakan yüz
      if (gas) inner++;
      expect(shaderFlame(p, n, linerUniforms.uRMid.value)).toBe(gas);
    }
    expect(inner).toBeGreaterThan(100);
  });
});

describe('kutu stili geçiş kanalı', () => {
  it('iç ve dış kanalda yalnız gaz tarafı parlar', () => {
    const meshes = linerMeshes(styled('can'));
    const ducts = meshes.filter((m) => !(m as THREE.InstancedMesh).isInstancedMesh && m.geometry.attributes.gasSide);
    expect(ducts.length).toBeGreaterThan(0);
    for (const d of ducts) {
      const pos = d.geometry.attributes.position;
      const nor = d.geometry.attributes.normal;
      const attr = d.geometry.attributes.gasSide;
      // Dilim başına iki kanalın ortası: gaz tarafı oraya bakar
      const lo = new Map<number, number>();
      const hi = new Map<number, number>();
      const key = (z: number) => Math.round(z * 1e4);
      for (let i = 0; i < pos.count; i++) {
        const r = Math.hypot(pos.getX(i), pos.getY(i));
        const k = key(pos.getZ(i));
        lo.set(k, Math.min(lo.get(k) ?? Infinity, r));
        hi.set(k, Math.max(hi.get(k) ?? 0, r));
      }
      let n = 0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.hypot(x, y);
        const nr = (nor.getX(i) * x + nor.getY(i) * y) / r;
        if (Math.abs(nr) < 0.7) continue;
        const k = key(pos.getZ(i));
        const c = (lo.get(k)! + hi.get(k)!) / 2;
        expect(attr.getX(i)).toBe(nr * (c - r) > 0 ? 1 : 0);
        n++;
      }
      expect(n).toBeGreaterThan(50);
    }
  });
});
