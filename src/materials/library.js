/**
 * Malzeme kütüphanesi.
 *
 * Tamamı fiziksel tabanlı (PBR). Boyalı kaporta için clearcoat (vernik)
 * katmanı, fırçalanmış metaller için anizotropik yansıma, sıcak bölge
 * parçaları için renk sapmalı (tavlanmış) metal kullanılır.
 */

import * as THREE from 'three';
import { createEngineMaterials, capify } from './engine';
import {
  createNacelleMaps,
  createBladeMaps,
  createSpinnerTexture,
  createTarmacMaps,
  albedoWithCavity,
  cavityTexture,
  createHeatTintTexture,
  createPropBladeTexture,
  createCaseMaps,
  createBraidTexture,
  createLinerMaps,
} from './textures.js';
import { scanParams } from './scans.js';

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
 * Kit parçalarının malzemeleri. Gövde yüzeyleri gerçek taramalardan (uv1,
 * metre), küçük detaylar (kaynak dikişi, tırtıl, perçin, etiket) Blender'da
 * pişirilmiş trim sheet'ten (uv, kanal 0) gelir.
 * @param {Record<string, THREE.Texture>} t kit dokuları (loadKit)
 * @param {object | null} sc taramalar (loadScans)
 */
function createKitMaterials(t, sc) {
  const std = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.95, ...o });
  const scan = (name, o, fallback) => (sc?.[name] ? std(scanParams(sc[name], o)) : std(fallback));
  const trim = (extra) =>
    std({ normalMap: t.trimNormal, roughnessMap: t.trimOrm, aoMap: t.trimOrm, aoMapIntensity: 1, roughness: 1, ...extra });
  return {
    kitCast: scan('cast', { color: 0x7c8180, metal: 0.7, rough: 1.8 }, { color: 0x7c8180, metalness: 0.7, roughness: 0.6 }),
    kitIridite: scan('cast', { color: 0x8d8052, metal: 0.8, rough: 1.6 }, { color: 0x8d8052, metalness: 0.8, roughness: 0.5 }),
    kitSteel: scan('brushed', { color: 0x8e949a }, { color: 0x8e949a, metalness: 1, roughness: 0.35 }),
    kitStainless: scan('polished', { color: 0xb9bdc1 }, { color: 0xb9bdc1, metalness: 1, roughness: 0.25 }),
    kitAnodized: scan('smooth', { color: 0x2c5f9e, rough: 1.2 }, { color: 0x2c5f9e, metalness: 0.65, roughness: 0.3 }),
    kitGold: scan('smooth', { color: 0xb8913e }, { color: 0xb8913e, metalness: 1, roughness: 0.3 }),
    kitPaint: scan('paint', { color: 0x3d433c }, { color: 0x3d433c, metalness: 0.25, roughness: 0.5 }),
    kitTank: scan('cast', { color: 0x979da1, metal: 0.9, rough: 1.7 }, { color: 0x979da1, metalness: 0.9, roughness: 0.4 }),
    kitRubber: scan('rubber', { color: 0x151617, rough: 1.1 }, { color: 0x151617, metalness: 0, roughness: 0.85 }),
    kitRed: std({ color: 0xb01a10, metalness: 0.1, roughness: 0.4 }),
    kitYellow: scan('paint', { color: 0xd9a514 }, { color: 0xd9a514, metalness: 0.15, roughness: 0.5 }),
    kitWeld: trim({ color: 0x8b8680, metalness: 1.0 }),
    kitKnurl: trim({ color: 0x9aa0a6, metalness: 1.0 }),
    kitTrimPaint: trim({ color: 0x3d433c, metalness: 0.25 }),
    kitPlacard: trim({ map: t.trimAlbedo, color: 0xffffff, metalness: 0.0 }),
  };
}

/**
 * Gerçek taramaları kütüphane malzemelerine uygular (yalnız normal, pürüzlülük,
 * metallik ve renk ayrıntısı eklenir; mevcut kanal-0 dokuları korunur).
 */
function applyScans(lib, sc) {
  const set = (mat, name, o) => {
    if (!sc[name]) return;
    const p = scanParams(sc[name], o);
    if (o.useMap === false) delete p.color;
    Object.assign(mat, p);
    if (p.normalScale) mat.normalScale = p.normalScale;
    mat.needsUpdate = true;
  };
  // Kaportasız motorların titanyum/çelik gövdesi (eski prosedürel doku yerine)
  set(lib.engineCase, 'case', { color: 0x9aa1a6, normal: 0.8, rough: 1.35 });
  set(lib.castAlu, 'cast', { color: 0x9a9d9c, metal: 0.7, rough: 1.8 });
  set(lib.machinery, 'brushed', { color: 0x5a6068 });
  set(lib.hubMetal, 'brushed', { color: 0x8e959c, normal: 0.5 });
  set(lib.anodized, 'smooth', { color: 0x2c5f9e });
  set(lib.boxPaint, 'paint', { color: 0x3d433c });
  set(lib.standPaint, 'paint', { color: 0xc99a1f });
  set(lib.hose, 'rubber', { color: 0x14171a, rough: 1.1 });
  // Sıcak bölge
  set(lib.inconel, 'hot', { color: 0x554d46 });
  set(lib.sooted, 'hot', { color: 0x2a2622, rough: 1.15 });
  set(lib.superalloy, 'hot', { color: 0x5e5751, normal: 0.5 });
  set(lib.nozzleFlap, 'dark', { color: 0x3b3a3a });
  set(lib.flameHolder, 'dark', { color: 0x4a4540 });
  set(lib.abLiner, 'dark', { color: 0x5a524a });
  // Art yakıcı kanalı: ısı renklenmesi haritası (kanal 0) kalır, taramadan
  // yalnız yüzey kabartısı ve pürüzlülük
  set(lib.abDuct, 'hot', { useMap: false, color: 0xffffff });
}

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {Record<'nacelle'|'core'|'pylon', { normal: THREE.Texture, orm: THREE.Texture }> | null} [details]
 *   Blender'da pişirilmiş panel detayları (bkz. loadPanelDetails).
 * @param {Record<string, THREE.Texture> | null} [kitTex] kit dokuları (loadKit)
 * @param {object | null} [scans] gerçek malzeme taramaları (loadScans)
 */
export function createMaterials(renderer, details = null, kitTex = null, scans = null) {
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
    color: 0xd4d8dc,
    metalness: 1.0,
    roughness: 0.17,
    envMapIntensity: 1.35,
    clearcoat: 0.25,
    clearcoatRoughness: 0.12,
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
  const liner = createLinerMaps();
  const combustorGlow = new THREE.MeshStandardMaterial({
    map: liner.map,
    emissiveMap: liner.emissiveMap,
    color: 0xb8aca2,
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

  /* --- kaportasız askeri motorlar ve turboprop --- */
  // Motor gövdesi: saten titanyum/çelik
  const caseMaps = createCaseMaps();
  for (const t of Object.values(caseMaps)) t.anisotropy = maxAniso;
  const engineCase = new THREE.MeshPhysicalMaterial({
    color: 0xa9b0b5,
    map: caseMaps.map,
    roughnessMap: caseMaps.roughnessMap,
    normalMap: caseMaps.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    metalness: 1.0,
    roughness: 1.0,
    anisotropy: 0.35,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  // Döküm alüminyum (dişli kutusu, pompa gövdeleri): mat, kumlu
  const castAlu = new THREE.MeshStandardMaterial({
    color: 0x9a9d9c,
    map: caseMaps.map,
    metalness: 0.7,
    roughness: 0.62,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
  });
  // Örgülü paslanmaz kablo/hortum kılıfı
  const braid = new THREE.MeshStandardMaterial({ map: createBraidTexture(), metalness: 0.8, roughness: 0.45 });
  // Eloksal kaplamalı bağlantılar (mavi)
  const anodized = new THREE.MeshStandardMaterial({ color: 0x2c5f9e, metalness: 0.6, roughness: 0.35 });
  // Boyalı elektronik kutular (koyu gri-yeşil)
  const boxPaint = new THREE.MeshStandardMaterial({ color: 0x3d433c, metalness: 0.3, roughness: 0.6 });
  // Gözetleme camı (yağ seviyesi)
  const sightGlass = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.1, roughness: 0.1, emissive: new THREE.Color(0x3a2a08) });
  // Art yakıcı kanalı: ısı renklenmesi
  const heatTint = createHeatTintTexture();
  heatTint.anisotropy = maxAniso;
  const abDuct = new THREE.MeshPhysicalMaterial({
    map: heatTint,
    metalness: 1.0,
    roughness: 0.42,
    iridescence: 0.25,
    iridescenceThicknessRange: [180, 520],
    envMapIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  // Art yakıcı gömleği (içeride): yandığında kor parlar
  const abLiner = new THREE.MeshStandardMaterial({
    color: 0x5a524a,
    metalness: 0.6,
    roughness: 0.7,
    emissive: new THREE.Color(0xff6a1a),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  const flameHolder = new THREE.MeshStandardMaterial({
    color: 0x4a4540,
    metalness: 0.8,
    roughness: 0.6,
    emissive: new THREE.Color(0xff7a2a),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  // Lüle yaprakları: dışta koyu, içte seramik kaplama (art yakıcıda kor)
  const nozzleFlap = new THREE.MeshPhysicalMaterial({
    color: 0x3b3a3a,
    metalness: 0.85,
    roughness: 0.5,
    iridescence: 0.2,
    envMapIntensity: 0.7,
  });
  const nozzleCeramic = new THREE.MeshStandardMaterial({
    color: 0x6f6a63,
    metalness: 0.1,
    roughness: 0.85,
    emissive: new THREE.Color(0xff8a3a),
    emissiveIntensity: 0,
  });
  // Test standı: sarı boyalı çelik
  const standPaint = new THREE.MeshStandardMaterial({ color: 0xc99a1f, metalness: 0.2, roughness: 0.55 });
  // Pervane
  const propTex = createPropBladeTexture();
  const propBlade = new THREE.MeshPhysicalMaterial({
    map: propTex,
    metalness: 0.1,
    roughness: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    side: THREE.DoubleSide,
  });
  const propSpinner = new THREE.MeshPhysicalMaterial({
    color: 0x1c1d1f,
    metalness: 0.2,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });

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
    engineCase,
    castAlu,
    braid,
    anodized,
    boxPaint,
    sightGlass,
    abDuct,
    abLiner,
    flameHolder,
    nozzleFlap,
    nozzleCeramic,
    standPaint,
    propBlade,
    propSpinner,
    tarmac: tarmacMat,
    cutawayFace,
    ...(kitTex ? createKitMaterials(kitTex, scans) : {}),
    ...createEngineMaterials(scans),
  };
  if (scans) applyScans(library, scans);
  // Açık yüzeyler için kapaksız kopyalar (kesitte arka yüzleri kırmızı olmasın)
  library.acousticLinerOpen = library.acousticLiner.clone();
  library.engineCaseOpen = library.engineCase.clone();
  // Kapalı katı gövdelere dönüştürülen kabukların malzemeleri: kesit kapaklı
  for (const name of ['polishedLip', 'cowlDetail', 'acousticLiner', 'composite', 'coreDetail', 'sooted', 'inconel', 'spinner', 'nozzleFlap', 'nozzleCeramic', 'engineCase', 'abDuct', 'abLiner', 'propSpinner']) {
    if (library[name]) capify(library[name]);
  }
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
