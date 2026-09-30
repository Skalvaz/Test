/**
 * Motor iç parçalarının malzemeleri (M2) ve kesit kapağı.
 *
 * Kesit kapağı ("cap"): kesit düzlemi bir katı parçayı (disk, gövde, kanat)
 * ikiye böldüğünde, kesikten bakan göz parçanın iç (arka) yüzlerini görür.
 * Kapalı katılarda bu arka yüzler tam olarak kesik yüzeyin sınırları içinde
 * kalır. Bu yüzden arka yüzü düz, kesit düzlemine bakan bir yüzey gibi
 * gölgelemek, ek geçiş ya da stencil gerektirmeden dolu bir kesit verir.
 * Renk, müzelerdeki kesit motorlarında olduğu gibi kırmızı boya: ince
 * duvarlı parçalarda (gövde, kanat, bant) kesik kenarında ince kırmızı bir
 * şerit, disk ve millerde dolu kırmızı kesit olarak okunur.
 *
 * Yalnız kapalı (katı) geometri kullanan malzemelere uygulanır; açık
 * kabuklar (kaporta yüzeyleri) arka yüzlerini normal gösterir.
 */

import * as THREE from 'three';
import { addPatch } from './weathering';
import { bladeSurface, turnedSurface } from './bladeShading';

/*
 * three.js anizotropik ortam yansıması: bitanjant bakış yönüne paralel
 * olduğunda cross(bitanjant, bakış) = 0 ve normalize NaN üretir. Disk
 * gövdelerinde (çevresel anizotropi) bu, bakış doğrultusunun yarıçapla
 * çakıştığı bölgelerde olur; bloom NaN pikselleri siyah lekelere yayar.
 * Paylaşılan parça bir kez güvenli hale getirilir (dejenere durumda yüzey
 * normali kullanılır).
 */
{
  const chunk = THREE.ShaderChunk as unknown as Record<string, string>;
  // Dikdörtgen alan ışığı (LTC): normal bakış yönüne paralelken taban
  // vektörü sıfır olur → NaN (kameraya dik bakan parlak metal yüzeylerde
  // siyah leke + bloom halesi)
  const ltc = 'lights_physical_pars_fragment';
  const ltcBad = 'T1 = normalize( V - N * dot( V, N ) );';
  if (chunk[ltc].includes(ltcBad)) {
    chunk[ltc] = chunk[ltc].replace(
      ltcBad,
      'vec3 t1v = V - N * dot( V, N ); T1 = dot( t1v, t1v ) > 1e-8 ? normalize( t1v ) : normalize( cross( N, abs( N.x ) < 0.9 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 ) ) );',
    );
  }
  const key = 'envmap_physical_pars_fragment';
  const bad = 'bentNormal = normalize( cross( bentNormal, bitangent ) );';
  if (chunk[key].includes(bad)) {
    chunk[key] = chunk[key]
      .split(bad)
      .join('bentNormal = cross( bentNormal, bitangent ); bentNormal = dot( bentNormal, bentNormal ) > 1e-8 ? normalize( bentNormal ) : normal;');
  }
}

export const cutUniforms = {
  uCutOn: { value: 0 },
  /** Dünya uzayında kesit yüzeyinin normali (kameraya bakan) */
  uCutN: { value: new THREE.Vector3(1, 0, 0) },
  uCapColor: { value: new THREE.Color(0x9e1b14) },
  /** Kesit düzlemi (dünya): n·p + c < 0 olan taraf kaldırılır */
  uCutPlane: { value: new THREE.Vector4(-1, 0, 0, 0) },
};

/** Kesit uniform'larını düzlemden günceller */
export function setCutPlane(plane: THREE.Plane | null) {
  cutUniforms.uCutOn.value = plane ? 1 : 0;
  if (!plane) return;
  cutUniforms.uCutN.value.copy(plane.normal).negate();
  cutUniforms.uCutPlane.value.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
}

/**
 * Kanat dizileri kesitte ikiye bölünmez: müze kesitlerindeki gibi her kanat
 * ya bütün kalır ya bütünüyle kaldırılır (örnek merkezi düzlemin hangi
 * tarafında). Kesik kanat dilimleri kademe başına kırmızı şeritler halinde
 * görüntüyü kalabalıklaştırırdı. Malzemenin kırpma düzlemi kullanılmaz
 * (userData.wholeCut → visual.setClipping atlar).
 */
export function wholeCut<T extends THREE.Material>(mat: T): T {
  mat.userData.wholeCut = true;
  addPatch(mat, 'wholecut-v1', (sh) => {
    sh.uniforms.uCutOn = cutUniforms.uCutOn;
    sh.uniforms.uCutPlane = cutUniforms.uCutPlane;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCutOn;\nuniform vec4 uCutPlane;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
        if (uCutOn > 0.5) {
          vec4 wc = modelMatrix * instanceMatrix * vec4(0.0, 0.3, 0.0, 1.0);
          if (dot(uCutPlane.xyz, wc.xyz) + uCutPlane.w < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
        #endif`,
      );
  });
  return mat;
}

/** Kesit açıkken arka yüzleri kırmızı düz kapak olarak gölgeler */
export function capify<T extends THREE.Material>(mat: T): T {
  if ((mat as unknown as { userData: Record<string, unknown> }).userData.capped) return mat;
  mat.userData.capped = true;
  addPatch(mat, 'cutcap-v1', (sh) => {
    sh.uniforms.uCutOn = cutUniforms.uCutOn;
    sh.uniforms.uCutN = cutUniforms.uCutN;
    sh.uniforms.uCapColor = cutUniforms.uCapColor;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCutOn;\nuniform vec3 uCutN;\nuniform vec3 uCapColor;')
      .replace(
        '#include <lights_fragment_begin>',
        `if (uCutOn > 0.5 && !gl_FrontFacing) {
          normal = normalize((viewMatrix * vec4(uCutN, 0.0)).xyz);
          material.diffuseColor = uCapColor;
          material.diffuseContribution = uCapColor;
          material.metalness = 0.0;
          material.roughness = 0.46;
          material.specularColor = vec3(0.04);
          material.specularColorBlended = vec3(0.04);
          material.specularF90 = 1.0;
          #ifdef USE_CLEARCOAT
          material.clearcoat = 0.0;
          #endif
          #ifdef USE_IRIDESCENCE
          material.iridescence = 0.0;
          #endif
          #ifdef USE_SHEEN
          material.sheenColor = vec3(0.0);
          #endif
          #ifdef USE_ANISOTROPY
          material.anisotropy = 0.0;
          material.alphaT = pow2(material.roughness);
          #endif
          totalEmissiveRadiance = vec3(0.0);
        }
        #include <lights_fragment_begin>`,
      );
  });
  return mat;
}

/** Yanma odası gömleği geometrisi (combustor.js her yapımda günceller) */
export const linerUniforms = {
  uRMid: { value: 0.4 },
  uZ0: { value: 0 },
  uZ1: { value: 1 },
  uN: { value: 20 },
  uScale: { value: 1 },
};

/**
 * Gömlek yüzeyi: birincil/seyreltme delikleri gerçek açıklık (discard),
 * bindirmeli soğutma halkaları, efüzyon delikleri, alev tarafında TBC,
 * kurum ve enjektör arkasında sıcak çizgiler; kor parlaması yalnız alev
 * tarafında ve bu desene göre.
 */
function linerSurface(mat: THREE.MeshStandardMaterial) {
  addPatch(mat, 'liner-v1', (sh) => {
    Object.assign(sh.uniforms, linerUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLP;\nvarying vec3 vLN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLP = position;\nvLN = objectNormal;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRMid, uZ0, uZ1, uN, uScale;
        varying vec3 vLP;
        varying vec3 vLN;
        float lHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float lNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(lHash(i), lHash(i + vec2(1, 0)), u.x), mix(lHash(i + vec2(0, 1)), lHash(i + vec2(1, 1)), u.x), u.y);
        }`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float lr = length(vLP.xy);
        float lth = atan(vLP.x, vLP.y);
        float lt = (vLP.z - uZ0) / (uZ1 - uZ0);
        float lc = lth * lr;
        // birincil delikler (2N) ve seyreltme delikleri (N, yarım adım kaymış)
        float pP = 6.2832 * lr / (2.0 * uN);
        float sP = mod(lc + 0.5 * pP, pP) - 0.5 * pP;
        float dP = length(vec2(sP, vLP.z - (uZ0 + 0.3 * (uZ1 - uZ0))));
        float pD = 6.2832 * lr / uN;
        float sD = mod(lc, pD) - 0.5 * pD;
        float dD = length(vec2(sD, vLP.z - (uZ0 + 0.56 * (uZ1 - uZ0))));
        float rP = 0.0105 * uScale;
        float rD = 0.016 * uScale;
        bool inLiner = lt > 0.05 && lt < 0.95;
        if (inLiner && (dP < rP || dD < rD)) discard;
        float lRim = inLiner ? max(smoothstep(rP * 1.7, rP, dP), smoothstep(rD * 1.55, rD, dD)) : 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float lSide = dot(normalize(vLN.xy), normalize(vLP.xy));
        float lFlame = lr > uRMid ? step(lSide, -0.3) : step(0.3, lSide);
        float lN = lNoise(vec2(lc * 18.0, lt * 9.0));
        float lRingT = fract(clamp(lt, 0.0, 1.0) * 6.0);
        float lRing = smoothstep(0.08, 0.0, lRingT) + smoothstep(0.93, 1.0, lRingT) * 0.5;
        // efüzyon delikleri: 5 mm ızgara, piksel altında sönük
        float lPx = fwidth(vLP.z);
        vec2 eg = vec2(lc, vLP.z) / 0.005;
        eg.x += floor(eg.y) * 0.5;
        float ed = length(fract(eg) - 0.5) * 0.005;
        float eff = smoothstep(0.0009, 0.0005, ed) * smoothstep(0.0025, 0.0008, lPx) * step(0.08, lt) * step(lt, 0.92);
        vec3 cold = pow(vec3(0.47, 0.44, 0.41), vec3(2.2)) * (0.85 + 0.25 * lN);
        vec3 tbc = pow(vec3(0.66, 0.62, 0.56), vec3(2.2));
        float streak = 0.5 + 0.5 * cos(lth * uN);
        float soot = smoothstep(0.35, 0.0, lt) * (0.4 + 0.6 * lN) + smoothstep(0.6, 0.9, lNoise(vec2(lc * 6.0, lt * 30.0))) * 0.4;
        vec3 hotC = mix(tbc, pow(vec3(0.55, 0.42, 0.34), vec3(2.2)), streak * smoothstep(0.1, 0.5, lt));
        hotC = mix(hotC, pow(vec3(0.16, 0.14, 0.13), vec3(2.2)), clamp(soot, 0.0, 1.0) * 0.8);
        vec3 lc3 = mix(cold, hotC, lFlame);
        lc3 *= 1.0 - 0.45 * lRing;
        lc3 = mix(lc3, lc3 * 0.25, eff);
        lc3 = mix(lc3, lc3 * 0.55, lRim);
        diffuseColor.rgb = lc3;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.42 + 0.15 * lN, 0.75, lFlame);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(1.0, 0.1, lFlame);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float g = (0.35 + 0.65 * streak) * smoothstep(0.0, 0.18, lt) * (1.0 - 0.55 * smoothstep(0.45, 1.0, lt));
          g *= 1.0 - 0.6 * clamp(soot, 0.0, 1.0);
          g += lRing * 0.6 + eff * 1.2 + lRim * 0.8;
          totalEmissiveRadiance *= lFlame * g;
        }`,
      );
  });
  return mat;
}

type Scans = Record<string, { color: THREE.Texture; normal: THREE.Texture; orm: THREE.Texture }> | null;

/**
 * M2 iç parça malzemeleri. Hepsi kesit kapaklıdır; taramalar (uv1, metre)
 * varsa yüzey kabartısı ve pürüzlülük dalgalanması onlardan gelir.
 */
export function createEngineMaterials(scans: Scans) {
  const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ metalness: 1, ...o });
  const scan = (m: THREE.MeshPhysicalMaterial, name: string, normal = 0.5, useColor = false) => {
    const s = scans?.[name];
    if (!s) return m;
    m.normalMap = s.normal;
    m.normalScale = new THREE.Vector2(normal, normal);
    // Yalnız mikro kabartı: pürüzlülük/renk prosedürel yamalardan gelir
    if (useColor) m.map = s.color;
    return m;
  };
  const mats = {
    // Tornalanmış disk ve kollar: çevresel torna izi (anizotropi u = θ)
    diskMetal: scan(phys({ color: 0x9ba1a7, roughness: 0.36, anisotropy: 0.45, envMapIntensity: 1.0 }), 'brushed', 0.35),
    turbineDisk: scan(phys({ color: 0x8a847e, roughness: 0.48, anisotropy: 0.3, envMapIntensity: 0.85 }), 'brushed', 0.35),
    // Gövde iç yüzü: dövme/işlenmiş çelik, yer yer koyu
    caseInner: scan(phys({ color: 0x7a7d80, roughness: 0.46, envMapIntensity: 0.8 }), 'case', 0.6),
    turbineCase: scan(phys({ color: 0x5d5752, roughness: 0.55, envMapIntensity: 0.7 }), 'hot', 0.6),
    // Aşınabilir conta yatakları ve bal peteği: mat açık gri
    sealLand: phys({ color: 0xaaa79f, metalness: 0.35, roughness: 0.78, envMapIntensity: 0.6 }),
    shroudCeramic: phys({ color: 0xa89c8c, metalness: 0.0, roughness: 0.8, envMapIntensity: 0.5 }),
    boltSteel: phys({ color: 0x74777b, roughness: 0.34, envMapIntensity: 0.9 }),
    // Kanatlar (M2 prosedürel yamaları blades.ts'te eklenir)
    combustorGlow: new THREE.MeshPhysicalMaterial({ color: 0xa09890, metalness: 0.6, roughness: 0.55, emissive: new THREE.Color(0xff7a2a), emissiveIntensity: 3.2, envMapIntensity: 0.7 }),
    combustorMetal: scan(phys({ color: 0x7b7169, roughness: 0.45, iridescence: 0.15, iridescenceThicknessRange: [200, 460], envMapIntensity: 0.8 }), 'hot', 0.5),
    nozzleMetal: scan(phys({ color: 0x96928d, roughness: 0.3, envMapIntensity: 0.9 }), 'brushed', 0.3),
    fanBlade: scan(phys({ color: 0xa2a7ab, roughness: 0.3, envMapIntensity: 1.05 }), 'brushed', 0.25),
    compBlade: scan(phys({ color: 0xa4a8ac, roughness: 0.24, envMapIntensity: 1.1 }), 'brushed', 0.2),
    compVane: scan(phys({ color: 0x8e9297, roughness: 0.32, envMapIntensity: 0.95 }), 'brushed', 0.25),
    hptBlade: phys({ color: 0xb7aa95, metalness: 0.0, roughness: 0.72, envMapIntensity: 0.6 }),
    hptVane: phys({ color: 0xa99a84, metalness: 0.0, roughness: 0.76, envMapIntensity: 0.55 }),
    lptBlade: scan(phys({ color: 0x70665d, roughness: 0.42, iridescence: 0.22, iridescenceThicknessRange: [180, 460], envMapIntensity: 0.8 }), 'hot', 0.4),
    lptVane: scan(phys({ color: 0x625a52, roughness: 0.48, iridescence: 0.15, iridescenceThicknessRange: [160, 420], envMapIntensity: 0.7 }), 'hot', 0.4),
  };
  bladeSurface(mats.fanBlade, 'fan');
  bladeSurface(mats.compBlade, 'comp');
  bladeSurface(mats.compVane, 'compVane');
  bladeSurface(mats.hptBlade, 'hpt');
  bladeSurface(mats.hptVane, 'hptVane');
  bladeSurface(mats.lptBlade, 'lpt');
  bladeSurface(mats.lptVane, 'lptVane');
  linerSurface(mats.combustorGlow);
  turnedSurface(mats.diskMetal);
  turnedSurface(mats.turbineDisk, { heat: [0.22, 0.36] });
  const blades = ['fanBlade', 'compBlade', 'compVane', 'hptBlade', 'hptVane', 'lptBlade', 'lptVane'];
  for (const [name, m] of Object.entries(mats)) {
    m.name = name;
    if (blades.includes(name)) wholeCut(m);
    else capify(m);
  }
  return mats;
}
