/**
 * Malzeme kütüphanesi.
 *
 * Tamamı fiziksel tabanlı (PBR). Boyalı kaporta için clearcoat (vernik)
 * katmanı, fırçalanmış metaller için anizotropik yansıma, sıcak bölge
 * parçaları için renk sapmalı (tavlanmış) metal kullanılır.
 */

import * as THREE from 'three';
import {
  createNacelleMaps,
  createBladeMaps,
  createSpinnerTexture,
  createTarmacMaps,
  albedoWithCavity,
  cavityTexture,
} from './textures.js';

/**
 * Pişirilmiş panel detayını (normal + ORM) malzemeye bağlar. Pürüzlülük ve
 * metallik tamamen haritadan gelir; vernik katmanı da kabartmayı izler.
 */
function applyPanelDetail(mat, detail) {
  mat.normalMap = detail.normal;
  mat.normalScale = new THREE.Vector2(1, 1);
  if (mat.clearcoat > 0) {
    mat.clearcoatNormalMap = detail.normal;
    mat.clearcoatNormalScale = new THREE.Vector2(0.8, 0.8);
  }
  mat.roughnessMap = detail.orm;
  mat.metalnessMap = detail.orm;
  mat.aoMap = detail.orm;
  mat.roughness = 1;
  mat.metalness = 1;
  mat.aoMapIntensity = 1;
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {Record<'nacelle'|'core'|'pylon', { normal: THREE.Texture, orm: THREE.Texture }> | null} [details]
 *   Blender'da pişirilmiş panel detayları (bkz. loadPanelDetails).
 */
export function createMaterials(renderer, details = null) {
  const maxAnisoAll = renderer.capabilities.getMaxAnisotropy();
  for (const d of Object.values(details ?? {})) {
    for (const tex of Object.values(d)) tex.anisotropy = maxAnisoAll;
  }
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const nacelleMaps = createNacelleMaps({ size: 2048 });
  const bladeMaps = createBladeMaps({ size: 1024 });
  const tarmac = createTarmacMaps(1024);

  for (const set of [nacelleMaps, bladeMaps, tarmac]) {
    for (const tex of Object.values(set)) tex.anisotropy = maxAniso;
  }

  /* --- boyalı dış kaporta: vernikli beyaz --- */
  const cowlPaint = new THREE.MeshPhysicalMaterial({
    map: nacelleMaps.map,
    roughnessMap: nacelleMaps.roughnessMap,
    normalMap: nacelleMaps.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    metalness: 0.12,
    roughness: 0.34,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.15,
    side: THREE.DoubleSide,
  });

  /* --- fan kaportası: aynı boya + pişirilmiş derz/perçin/kapak detayı --- */
  const cowlDetail = cowlPaint.clone();
  if (details) {
    cowlDetail.map = albedoWithCavity(nacelleMaps.map, details.nacelle.orm);
    applyPanelDetail(cowlDetail, details.nacelle);
  }

  /* --- küçük kabartılar (aktüatör muhafazaları): dokusuz aynı boya --- */
  const fairingPaint = new THREE.MeshPhysicalMaterial({
    color: 0xe4e6e8,
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.15,
  });

  /* --- giriş ağzı: parlatılmış alüminyum halka --- */
  const polishedLip = new THREE.MeshPhysicalMaterial({
    color: 0xd9dde1,
    metalness: 1.0,
    roughness: 0.075,
    envMapIntensity: 1.6,
    clearcoat: 0.3,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
  });

  /* --- hava yolu iç yüzeyi: akustik astar --- */
  const acousticLiner = new THREE.MeshStandardMaterial({
    color: 0x30363c,
    metalness: 0.45,
    roughness: 0.68,
    envMapIntensity: 0.75,
    side: THREE.DoubleSide,
  });

  /* --- fan kanadı: geniş kordlu titanyum --- */
  const titanium = new THREE.MeshPhysicalMaterial({
    map: bladeMaps.map,
    roughnessMap: bladeMaps.roughnessMap,
    normalMap: bladeMaps.normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    metalness: 1.0,
    roughness: 0.22,
    anisotropy: 0.65,
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
  });

  /* --- fan göbeği / platform --- */
  const hubMetal = new THREE.MeshPhysicalMaterial({
    color: 0x8e959c,
    metalness: 1.0,
    roughness: 0.32,
    anisotropy: 0.4,
    envMapIntensity: 0.95,
    side: THREE.DoubleSide,
  });

  /* --- burun konisi: sarmal işaretli boyalı koni --- */
  const spinner = new THREE.MeshPhysicalMaterial({
    map: createSpinnerTexture(1024),
    metalness: 0.3,
    roughness: 0.28,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  spinner.map.anisotropy = maxAniso;

  /* --- kompozit / grafit parçalar --- */
  const composite = new THREE.MeshPhysicalMaterial({
    color: 0x22262b,
    metalness: 0.25,
    roughness: 0.45,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.95,
    side: THREE.DoubleSide,
  });

  /* --- çekirdek kaportası: ısıya maruz kalmış paslanmaz --- */
  const heatedSteel = new THREE.MeshPhysicalMaterial({
    color: 0x74716c,
    metalness: 1.0,
    roughness: 0.52,
    envMapIntensity: 0.85,
    side: THREE.DoubleSide,
  });

  /* --- egzoz konisi: tavlanmış inconel (renk sapmalı) --- */
  const inconel = new THREE.MeshPhysicalMaterial({
    color: 0x554d46,
    metalness: 1.0,
    roughness: 0.54,
    iridescence: 0.18,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [200, 520],
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });

  /* --- egzoz kanalı iç yüzeyi: kalın kurum tabakası --- */
  const sooted = new THREE.MeshStandardMaterial({
    color: 0x24211e,
    metalness: 0.85,
    roughness: 0.78,
    envMapIntensity: 0.35,
    side: THREE.DoubleSide,
  });

  /* --- türbin kanatları: nikel süper alaşım, ısı kararması --- */
  const superalloy = new THREE.MeshPhysicalMaterial({
    color: 0x5e5751,
    metalness: 1.0,
    roughness: 0.44,
    iridescence: 0.12,
    iridescenceThicknessRange: [120, 420],
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
  });

  /* --- yanma odası iç yüzeyi: kor halindeki seramik kaplama --- */
  const combustorGlow = new THREE.MeshStandardMaterial({
    color: 0x2a1a12,
    emissive: new THREE.Color(0xff7a2a),
    emissiveIntensity: 3.2,
    metalness: 0.6,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });

  /* --- koyu makine aksamı (dişli kutusu, aksesuar) --- */
  const machinery = new THREE.MeshStandardMaterial({
    color: 0x3a3f45,
    metalness: 0.85,
    roughness: 0.45,
    envMapIntensity: 0.9,
  });

  /* --- hidrolik / yakıt hatları --- */
  const hose = new THREE.MeshStandardMaterial({
    color: 0x14171a,
    metalness: 0.2,
    roughness: 0.72,
  });

  const brassFitting = new THREE.MeshStandardMaterial({
    color: 0xb08c4a,
    metalness: 1.0,
    roughness: 0.28,
    envMapIntensity: 1.2,
  });

  /* --- pilon kaplaması --- */
  const pylonSkin = new THREE.MeshPhysicalMaterial({
    color: 0xdfe3e6,
    metalness: 0.25,
    roughness: 0.38,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
  });

  /* --- pişirilmiş panel detaylı çekirdek kaportası ve pilon --- */
  const coreDetail = heatedSteel.clone();
  const pylonDetail = pylonSkin.clone();
  if (details) {
    coreDetail.map = cavityTexture(details.core.orm);
    applyPanelDetail(coreDetail, details.core);
    pylonDetail.map = cavityTexture(details.pylon.orm);
    applyPanelDetail(pylonDetail, details.pylon);
  }

  /* --- zemin --- */
  const tarmacMat = new THREE.MeshStandardMaterial({
    map: tarmac.map,
    roughnessMap: tarmac.roughnessMap,
    normalMap: tarmac.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    metalness: 0.0,
    roughness: 0.92,
    envMapIntensity: 0.6,
  });

  /* --- kesit görünümünde açığa çıkan yüzeyler --- */
  const cutawayFace = new THREE.MeshStandardMaterial({
    color: 0xb04a2a,
    metalness: 0.2,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  const library = {
    cowlPaint,
    cowlDetail,
    fairingPaint,
    polishedLip,
    acousticLiner,
    titanium,
    hubMetal,
    spinner,
    composite,
    heatedSteel,
    sooted,
    inconel,
    superalloy,
    combustorGlow,
    machinery,
    hose,
    brassFitting,
    pylonSkin,
    pylonDetail,
    coreDetail,
    tarmac: tarmacMat,
    cutawayFace,
  };
  // İsimler, parça başına klonlanan malzemelerin kaynağını tanımak için
  for (const [name, mat] of Object.entries(library)) mat.name = name;
  return library;
}

/** Kesit (cutaway) kırpma düzlemlerini bütün malzemelere uygular. */
export function applyClipping(materials, planes) {
  for (const mat of Object.values(materials)) {
    if (!mat || !mat.isMaterial) continue;
    mat.clippingPlanes = planes;
    mat.clipShadows = true;
    mat.needsUpdate = true;
  }
}
