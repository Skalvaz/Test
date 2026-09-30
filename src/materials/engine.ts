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
    diskMetal: scan(phys({ color: 0x9ba1a7, roughness: 0.3, anisotropy: 0.55, envMapIntensity: 1.0 }), 'brushed', 0.35),
    turbineDisk: scan(phys({ color: 0x8c8781, roughness: 0.36, anisotropy: 0.5, envMapIntensity: 0.9 }), 'brushed', 0.35),
    // Gövde iç yüzü: dövme/işlenmiş çelik, yer yer koyu
    caseInner: scan(phys({ color: 0x7a7d80, roughness: 0.46, envMapIntensity: 0.8 }), 'case', 0.6),
    turbineCase: scan(phys({ color: 0x5d5752, roughness: 0.55, envMapIntensity: 0.7 }), 'hot', 0.6),
    // Aşınabilir conta yatakları ve bal peteği: mat açık gri
    sealLand: phys({ color: 0xaaa79f, metalness: 0.35, roughness: 0.78, envMapIntensity: 0.6 }),
    shroudCeramic: phys({ color: 0xa89c8c, metalness: 0.0, roughness: 0.8, envMapIntensity: 0.5 }),
    boltSteel: phys({ color: 0x74777b, roughness: 0.34, envMapIntensity: 0.9 }),
    // Kanatlar (M2 prosedürel yamaları blades.ts'te eklenir)
    fanBlade: phys({ color: 0x9fa5aa, roughness: 0.2, anisotropy: 0.5, anisotropyRotation: Math.PI / 2, envMapIntensity: 1.2 }),
    compBlade: scan(phys({ color: 0xa4a8ac, roughness: 0.24, envMapIntensity: 1.1 }), 'brushed', 0.2),
    compVane: scan(phys({ color: 0x8e9297, roughness: 0.32, envMapIntensity: 0.95 }), 'brushed', 0.25),
    hptBlade: phys({ color: 0xb7aa95, metalness: 0.0, roughness: 0.72, envMapIntensity: 0.6 }),
    hptVane: phys({ color: 0xa99a84, metalness: 0.0, roughness: 0.76, envMapIntensity: 0.55 }),
    lptBlade: scan(phys({ color: 0x70665d, roughness: 0.42, iridescence: 0.22, iridescenceThicknessRange: [180, 460], envMapIntensity: 0.8 }), 'hot', 0.4),
    lptVane: scan(phys({ color: 0x625a52, roughness: 0.48, iridescence: 0.15, iridescenceThicknessRange: [160, 420], envMapIntensity: 0.7 }), 'hot', 0.4),
  };
  const blades = ['fanBlade', 'compBlade', 'compVane', 'hptBlade', 'hptVane', 'lptBlade', 'lptVane'];
  for (const [name, m] of Object.entries(mats)) {
    m.name = name;
    if (blades.includes(name)) wholeCut(m);
    else capify(m);
  }
  return mats;
}
