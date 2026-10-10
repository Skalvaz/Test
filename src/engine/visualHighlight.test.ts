/**
 * Vurgu (M5a dalga 2 incelemesi #19) ve x-ışını: highlight() kümeye giren
 * parçaları update'i beklemeden boyar (sürüklerken yeniden kurulan taslak
 * model vurgusuz çizilmez); yeni model son vurguyu devralır; kesit
 * kapalıyken seçili iç parça x-ışını ikiziyle kabuğun içinden görünür.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  EngineVisual,
  XRAY_PARTS,
  highlightPulse,
  inheritedHighlight,
  stripXrayTwins,
  type PartId,
} from './visual';

const HL = 0x2ee6d6;

/** WebGL'siz yarım model: yalnız parça tablosu ve kök */
function fakeVisual(layout = 'bare') {
  const v = Object.create(EngineVisual.prototype) as EngineVisual & Record<string, unknown>;
  const root = new THREE.Group();
  const parts = new Map<PartId, { meshes: THREE.Object3D[]; materials: Set<THREE.MeshStandardMaterial> }>();
  const add = (p: PartId, instanced = false) => {
    const mat = new THREE.MeshStandardMaterial({ emissive: 0x000000 });
    mat.userData.baseEmissive = mat.emissive.clone();
    mat.userData.baseEmissiveIntensity = 1;
    const geo = new THREE.BoxGeometry();
    const mesh = instanced ? new THREE.InstancedMesh(geo, mat, 3) : new THREE.Mesh(geo, mat);
    mesh.userData.part = p;
    root.add(mesh);
    parts.set(p, { meshes: [mesh], materials: new Set([mat]) });
    return { mesh, mat };
  };
  Object.assign(v, {
    root,
    parts,
    highlighted: new Set<PartId>(),
    cut: false,
    hiddenInterior: new Set<PartId>(),
    xray: new Map(),
    source: { traits: { layout } },
  });
  return { v, add };
}

describe('vurgu: yeni parçalar hemen boyanır (#19)', () => {
  it('highlight() kümeye giren parçayı update beklemeden nabız değeriyle boyar', () => {
    const { v, add } = fakeVisual();
    const { mat } = add('hpc', true);
    v.highlight(['hpc']);
    expect(mat.emissive.getHex()).toBe(HL);
    expect(mat.emissiveIntensity).toBeCloseTo(highlightPulse(), 9);
    // Kümeden çıkınca eski ışımaya döner
    v.highlight(null);
    expect(mat.emissive.getHex()).toBe(0);
    expect(mat.emissiveIntensity).toBe(1);
  });

  it('son vurgu kümesi yeni modele devredilir (taslak modelin ilk karesi)', () => {
    const { v, add } = fakeVisual();
    add('hpc');
    v.highlight(['hpc', 'combustor']);
    expect([...inheritedHighlight()]).toEqual(['hpc', 'combustor']);
    v.highlight(null);
    expect(inheritedHighlight().length).toBe(0);
    // Kurucu devralmayı uyguluyor
    expect(EngineVisual.toString()).toMatch(/lastHighlight\.length\) this\.highlight\(/);
  });

  it('nabız saati modelden bağımsız: update modül saatini ilerletir', () => {
    expect(highlightPulse(0)).toBeCloseTo(0.35, 9);
    expect(highlightPulse(Math.PI / 10)).toBeCloseTo(0.6, 9);
  });
});

describe('x-ışını: kesit kapalıyken seçili iç modül görünür', () => {
  it('iç parça seçilince ikiz eklenir; gizli iç parça görünür olur; seçim kalkınca geri gizlenir', () => {
    const { v, add } = fakeVisual();
    const { mesh } = add('hpc', true);
    v.setInteriorVisible(false);
    expect(mesh.visible).toBe(false);
    v.highlight(['hpc']);
    expect(v.xrayParts).toEqual(['hpc']);
    expect(mesh.visible).toBe(true);
    const twin = mesh.children.find((c) => c.userData.xray) as THREE.InstancedMesh;
    expect(twin).toBeTruthy();
    expect(twin.isInstancedMesh).toBe(true);
    expect(twin.instanceMatrix).toBe((mesh as THREE.InstancedMesh).instanceMatrix);
    expect(twin.userData.noClip).toBe(true);
    // Işın seçimine girmez
    const hits: THREE.Intersection[] = [];
    twin.raycast(new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)), hits);
    expect(hits.length).toBe(0);
    // setInteriorVisible(false) seçili parçayı yeniden gizlemez
    v.setInteriorVisible(false);
    expect(mesh.visible).toBe(true);
    v.highlight(null);
    expect(v.xrayParts).toEqual([]);
    expect(mesh.children.some((c) => c.userData.xray)).toBe(false);
    expect(mesh.visible).toBe(false);
  });

  it('kesit açıkken x-ışını yok; dış kabuk parçası x-ışınına girmez', () => {
    const { v, add } = fakeVisual();
    add('hpc');
    add('nacelle');
    v.highlight(['hpc', 'nacelle']);
    expect(v.xrayParts).toEqual(['hpc']);
    expect(XRAY_PARTS.has('nacelle')).toBe(false);
    v.setClipping([new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)]);
    expect(v.xrayParts).toEqual([]);
    v.setClipping([]);
    expect(v.xrayParts).toEqual(['hpc']);
  });
});

describe('x-ışını: taşınan ağlarda ikiz birikmez (dalga 2 doğrulaması, ek c)', () => {
  const twinsOf = (o: THREE.Object3D) => o.children.filter((c) => c.userData.xray).length;

  /** Artımlı üretim: aynı parça ağı yeni modelin köküne taşınır (buildCache reuse) */
  function carried(mesh: THREE.Object3D) {
    const { v } = fakeVisual();
    (v.root as THREE.Group).add(mesh);
    (v as unknown as { parts: Map<PartId, unknown> }).parts.set('hpc', { meshes: [mesh], materials: new Set() });
    Object.assign(v, { plume: { material: { dispose() {} } }, effects: { dispose() {} } });
    // Kurucunun yaptığı: taşınan ağlardaki eski ikizleri sök, son vurguyu devral
    stripXrayTwins(v.root as THREE.Group);
    if (inheritedHighlight().length) v.highlight(inheritedHighlight());
    return v;
  }

  it('aynı tasarımla art arda kurulumda ağ başına en çok 1 ikiz; eski modeller atılınca da', () => {
    const { v: first, add } = fakeVisual();
    Object.assign(first, { plume: { material: { dispose() {} } }, effects: { dispose() {} } });
    const { mesh } = add('hpc', true);
    first.highlight(['hpc']);
    expect(twinsOf(mesh)).toBe(1);
    const models = [first];
    for (let i = 0; i < 4; i++) {
      const next = carried(mesh);
      expect(next.xrayParts).toEqual(['hpc']);
      expect(twinsOf(mesh)).toBe(1);
      // Eski model yeni model çizildikten sonra atılır: yenisinin ikizine dokunmaz
      models.at(-1)!.dispose();
      expect(twinsOf(mesh)).toBe(1);
      models.push(next);
    }
    // Seçim kalkınca sahipsiz ikiz kalmaz (kesitte hayalet çizmezler)
    models.at(-1)!.highlight(null);
    expect(twinsOf(mesh)).toBe(0);
  });

  it('kurucu taşınan ağlardaki ikizleri söker; dispose kendi ikizlerini kaldırır', () => {
    expect(EngineVisual.toString()).toMatch(/endBuild\)?\(\);[\s\S]*?stripXrayTwins\(this\.model\.group\)/);
    const { v, add } = fakeVisual();
    Object.assign(v, { plume: { material: { dispose() {} } }, effects: { dispose() {} } });
    const { mesh } = add('hpc');
    v.highlight(['hpc']);
    expect(twinsOf(mesh)).toBe(1);
    v.dispose();
    expect(twinsOf(mesh)).toBe(0);
    expect(v.xrayParts).toEqual([]);
    v.highlight(null);
  });
});
