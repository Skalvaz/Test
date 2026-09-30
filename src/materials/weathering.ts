/**
 * Yıpranma (weathering) shader yamaları: dış mekân yüzeylerini "yeni
 * render" görüntüsünden çıkarıp kullanılmış, havaya maruz kalmış hale
 * getirir. Hepsi dünya konumundan hesaplanır (UV'den bağımsız), bu yüzden
 * Blender'da üretilen herhangi bir ağa doğrudan uygulanabilir.
 *
 *   Taban kiri      duvarların zemine yakın kısmı: yağmur sıçraması, toz
 *   Yağmur izleri   düşey, dar, üstten aşağı zayıflayan koyu çizgiler
 *   Leke/solma      büyük ölçekli ton ve pürüzlülük dalgalanması
 *   Pas             yağmur izlerine karışan kahverengi (metal yüzeyler)
 *   Boya aşınması   işaretler saydamlaşır, alttaki beton görünür
 *   Apron ayrıntısı derz dolgusu taşması, kılcal çatlaklar, yağ lekeleri,
 *                   tekerlek izleri (bilinen araç yolları boyunca)
 *
 * Aynı malzemeye birden çok yama eklenebilir (addPatch zinciri).
 */

import * as THREE from 'three';

type Patch = { key: string; apply: (sh: THREE.WebGLProgramParametersWithUniforms) => void };

/** Malzemeye onBeforeCompile yaması ekler; mevcut yamalar korunur */
export function addPatch(mat: THREE.Material, key: string, apply: Patch['apply']) {
  const list: Patch[] = (mat.userData.patches ??= []);
  const prev = mat.onBeforeCompile;
  if (!list.length && prev && prev !== THREE.Material.prototype.onBeforeCompile) {
    // Önceden atanmış tek yama (ör. makro varyasyon): zincirin başına al
    const prevKey = mat.customProgramCacheKey();
    list.push({ key: prevKey, apply: (sh) => prev.call(mat, sh, null as unknown as THREE.WebGLRenderer) });
  }
  list.push({ key, apply });
  mat.onBeforeCompile = (sh) => {
    for (const p of list) p.apply(sh);
  };
  mat.customProgramCacheKey = () => list.map((p) => p.key).join('|');
  mat.needsUpdate = true;
}

/**
 * Yamalı malzemeyi klonlar. Material.clone() onBeforeCompile'ı kopyalamaz
 * ve userData'yı JSON üzerinden kopyaladığı için yama listesindeki
 * fonksiyonlar kaybolur; klon yamasız (ör. kesit kapaksız) derlenirdi.
 */
export function clonePatched<T extends THREE.Material>(src: T): T {
  const m = src.clone() as T;
  const list = src.userData.patches as Patch[] | undefined;
  if (list?.length) {
    const copy = list.slice();
    m.userData.patches = copy;
    m.onBeforeCompile = (sh) => {
      for (const p of copy) p.apply(sh);
    };
    m.customProgramCacheKey = () => copy.map((p) => p.key).join('|');
  } else if (src.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) {
    m.onBeforeCompile = src.onBeforeCompile;
    m.customProgramCacheKey = src.customProgramCacheKey;
  }
  return m;
}

/** Dünya konumu ve normali varyingleri (bir kez eklenir) */
function worldVaryings(sh: THREE.WebGLProgramParametersWithUniforms) {
  if (sh.vertexShader.includes('vWxPos')) return;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWxPos;\nvarying vec3 vWxNrm;')
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        vWxPos = (modelMatrix * wp).xyz;
        vWxNrm = normalize(mat3(modelMatrix) * wn);
      }`,
    );
  sh.fragmentShader = sh.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWxPos;
    varying vec3 vWxNrm;`,
  );
}

function noiseUniform(sh: THREE.WebGLProgramParametersWithUniforms, noise: THREE.Texture) {
  if (sh.uniforms.uWxNoise) return;
  sh.uniforms.uWxNoise = { value: noise };
  sh.fragmentShader = sh.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    uniform sampler2D uWxNoise;
    float wxN(vec2 p) { return texture2D(uWxNoise, p).r; }
    float wxN2(vec2 p) { return texture2D(uWxNoise, p).g; }
    float wxN3(vec2 p) { return texture2D(uWxNoise, p).b; }
    float wxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
  );
}

export interface WeatherOpts {
  /** Zemin kotu (taban kiri buradan ölçülür) */
  floorY?: number;
  /** Taban kiri şiddeti ve yüksekliği (m) */
  base?: number;
  baseHeight?: number;
  /** Yağmur izleri şiddeti */
  streaks?: number;
  /** Büyük ölçekli leke/solma şiddeti */
  mottle?: number;
  /** İzlere karışan pas miktarı (0 = gri kir) */
  rust?: number;
  /** Yatay yüzeylerde (çatı, üst yüzey) kir birikimi */
  top?: number;
}

/** Duvar, çatı, kapı, tank gibi yapı yüzeyleri için yıpranma */
export function weather(mat: THREE.MeshStandardMaterial, noise: THREE.Texture, o: WeatherOpts = {}) {
  const { floorY = -2.4, base = 0.3, baseHeight = 1.4, streaks = 0.3, mottle = 0.15, rust = 0.2, top = 0.2 } = o;
  const f = (v: number) => v.toFixed(3);
  addPatch(mat, `wx-${[floorY, base, baseHeight, streaks, mottle, rust, top].join(',')}`, (sh) => {
    worldVaryings(sh);
    noiseUniform(sh, noise);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      {
        vec3 P = vWxPos;
        vec3 N = normalize(vWxNrm);
        float vert = 1.0 - smoothstep(0.35, 0.75, abs(N.y));
        // Duvar boyunca yatay koordinat: normal x'e yakınsa z, değilse x
        float u = abs(N.x) > abs(N.z) ? P.z : P.x;
        float h = P.y - (${f(floorY)});
        // Leke/solma: iki ölçek
        float m = wxN(P.xz * 0.013 + P.y * 0.02) * 0.6 + wxN2(vec2(u, P.y) * 0.09) * 0.4;
        float tone = mix(1.0 - ${f(mottle)}, 1.0 + ${f(mottle)} * 0.5, m);
        // Taban kiri: düzensiz üst sınır
        float edge = ${f(baseHeight)} * (0.55 + 0.7 * wxN2(vec2(u * 0.35, 0.3)));
        float baseD = (1.0 - smoothstep(0.0, edge, h)) * vert * ${f(base)};
        // Yağmur izleri: dar düşey şeritler, üst kenardan aşağı zayıflar
        float sA = wxN3(vec2(u * 0.9, h * 0.035));
        float sB = wxN(vec2(u * 2.7 + 13.0, h * 0.05));
        float streak = smoothstep(0.52, 0.8, sA * 0.6 + sB * 0.4);
        streak *= vert * ${f(streaks)} * (0.55 + 0.45 * wxN2(vec2(u * 0.05, 7.0)));
        // Yatay yüzeyler: toz, yosun izi
        float topD = smoothstep(0.7, 0.95, N.y) * ${f(top)} * smoothstep(0.35, 0.7, wxN(P.xz * 0.21));
        vec3 dirtCol = mix(vec3(0.42, 0.40, 0.36), vec3(0.55, 0.33, 0.18), ${f(rust)} * smoothstep(0.4, 0.8, sB));
        vec3 c = diffuseColor.rgb * tone;
        c = mix(c, c * dirtCol * 1.2, clamp(streak, 0.0, 1.0));
        c = mix(c, c * vec3(0.55, 0.52, 0.47), clamp(baseD, 0.0, 1.0));
        c = mix(c, c * vec3(0.6, 0.6, 0.55), clamp(topD, 0.0, 1.0));
        diffuseColor.rgb = c;
        roughnessFactor = clamp(roughnessFactor * (1.0 + 0.25 * (streak + baseD + topD)) * mix(0.9, 1.1, m), 0.04, 1.0);
      }`,
    );
  });
}

/**
 * Boya aşınması: zemin işaretleri saydamlaşır (alttaki beton görünür),
 * lastik geçen yerlerde kararır. Malzeme saydam çizilir (derinlik yazmaz).
 */
export function wornPaint(mat: THREE.MeshStandardMaterial, noise: THREE.Texture, wear = 0.35) {
  mat.transparent = true;
  mat.depthWrite = false;
  addPatch(mat, `paint-${wear}`, (sh) => {
    worldVaryings(sh);
    noiseUniform(sh, noise);
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <alphamap_fragment>',
      `#include <alphamap_fragment>
      {
        // Zeminde x/z; düşey yüzeylerde (kapı numaraları) yükseklik de katılır
        vec2 p = vWxPos.xz + vWxPos.y * vec2(0.73, 1.37);
        float coarse = wxN(p * 0.045);
        float fine = wxN3(p * 0.9) * 0.6 + wxHash(floor(p * 40.0)) * 0.4;
        float keep = smoothstep(${(wear * 0.9).toFixed(3)}, ${(wear * 0.9 + 0.3).toFixed(3)}, coarse * 0.55 + fine * 0.45 + 0.1);
        diffuseColor.a *= mix(0.4, 0.95, keep);
        diffuseColor.rgb *= mix(0.78, 1.0, wxN2(p * 0.12));
      }`,
    );
  });
}

/** Araç yolları: (x0, z0, x1, z1) doğru parçaları — tekerlek izleri bunlar boyunca */
export const TIRE_PATHS: [number, number, number, number][] = [
  [48, 40, 48, -10], // taksi yolu ekseni
  [48, -10, 10, -10], // çalıştırma alanına dönüş
  [-50, -30, -20, -30], // hangar A kurşun çizgisi
  [-50, 18, -20, 18], // hangar B
  [-20, -30, 48, -10],
  [-20, 18, 48, 10],
  [67, -58, 67, 38], // servis yolu (apron doğu kenarı)
];

/** Yağ lekesi yoğunluk merkezleri (x, z, yarıçap) */
export const STAIN_SPOTS: [number, number, number][] = [
  [0, 0, 9], [0, 6, 6], [-1, -4, 5], [-34, -30, 10], [-34, 18, 10], [48, -10, 8], [-10, -2, 4], [-11, 3, 4],
];

/**
 * Apron betonuna ayrıntı: derz dolgusu taşması (koyu, parlak bant),
 * kılcal çatlaklar, yağ/yakıt lekeleri, tekerlek izleri, pas lekeleri.
 * `joints`: derz ızgarasının başlangıcı ve aralığı (m).
 */
export function apronDetail(mat: THREE.MeshStandardMaterial, noise: THREE.Texture, joints: { x0: number; z0: number; step: number }) {
  const paths = TIRE_PATHS.map((s) => `vec4(${s.map((v) => v.toFixed(1)).join(',')})`).join(',');
  const spots = STAIN_SPOTS.map((s) => `vec3(${s.map((v) => v.toFixed(1)).join(',')})`).join(',');
  addPatch(mat, 'apron-detail-v1', (sh) => {
    worldVaryings(sh);
    noiseUniform(sh, noise);
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        const vec4 TIRE[${TIRE_PATHS.length}] = vec4[](${paths});
        const vec3 SPOT[${STAIN_SPOTS.length}] = vec3[](${spots});
        float segD(vec2 p, vec4 s) {
          vec2 a = s.xy, b = s.zw;
          vec2 pa = p - a, ba = b - a;
          float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          return length(pa - ba * h);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          vec2 p = vWxPos.xz;
          // Derz dolgusu: derzden taşan koyu, düzensiz genişlikte bant
          vec2 g = (p - vec2(${joints.x0.toFixed(2)}, ${joints.z0.toFixed(2)})) / ${joints.step.toFixed(2)};
          vec2 f = abs(fract(g + 0.5) - 0.5) * ${joints.step.toFixed(2)};
          float wob = 0.025 + 0.04 * wxN3(p * 0.6);
          float dj = min(f.x, f.y);
          float aa = max(fwidth(dj), 1e-4);
          float seal = 1.0 - smoothstep(wob - aa, wob + aa, dj);
          // Uzakta piksel altına düşen bant sönmeli (yoksa ızgara kalınlaşır)
          seal *= clamp(wob / (aa * 3.0), 0.0, 1.0);
          // Kılcal çatlaklar: gürültü sırtları, seyrek
          float cr = abs(wxN(p * 0.19 + 3.1) - 0.5);
          float craa = max(fwidth(cr), 1e-4);
          float crack = (1.0 - smoothstep(0.004, 0.004 + craa * 1.5, cr)) * smoothstep(0.55, 0.75, wxN2(p * 0.05)) * clamp(0.006 / craa, 0.0, 1.0);
          // Yağ lekeleri: yoğunluk merkezleri etrafında düzensiz lekeler
          float dens = 0.0;
          for (int i = 0; i < ${STAIN_SPOTS.length}; i++) {
            vec3 s = SPOT[i];
            dens += exp(-dot(p - s.xy, p - s.xy) / (s.z * s.z));
          }
          float blob = wxN(p * 0.23) * 0.65 + wxN3(p * 0.9) * 0.35;
          float dc = clamp(dens, 0.0, 1.0);
          float oil = smoothstep(0.64 - 0.14 * dc, 0.67 - 0.14 * dc, blob) * smoothstep(0.05, 0.5, dens);
          // Tekerlek izleri: yolun iki yanında 1,1 m aralıklı iki şerit
          float tire = 0.0;
          for (int i = 0; i < ${TIRE_PATHS.length}; i++) {
            float d = segD(p, TIRE[i]);
            float w = abs(d - 1.1);
            tire = max(tire, (1.0 - smoothstep(0.08, 0.28, w)) * (1.0 - smoothstep(4.0, 5.0, d)));
          }
          tire *= smoothstep(0.3, 0.7, wxN2(p * vec2(0.08, 0.08) + 5.0)) * 0.9;
          vec3 c = diffuseColor.rgb;
          c = mix(c, vec3(0.07, 0.07, 0.07), seal * 0.7);
          c = mix(c, c * 0.45, crack * 0.8);
          c = mix(c, c * vec3(0.5, 0.48, 0.45), oil * 0.7);
          c = mix(c, c * 0.62, tire);
          diffuseColor.rgb = c;
          roughnessFactor = mix(roughnessFactor, 0.35, seal * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.28, oil * 0.8);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.85, tire);
        }`,
      );
  });
}

/**
 * Pişirilmiş zemin AO haritası (blender/airfield.py --ao): dünya x/z
 * bölgesine yayılır; yalnız dolaylı ışığı (gökyüzü, yansıma) karartır —
 * güneş ışığı gölge haritasından gelir. Binaların, duvarların, çitin
 * dibinde yumuşak temas gölgesi.
 */
export function groundAO(mat: THREE.MeshStandardMaterial, tex: THREE.Texture, region: [number, number, number, number], strength = 1) {
  const [x0, x1, z0, z1] = region;
  addPatch(mat, `gao-${strength}`, (sh) => {
    worldVaryings(sh);
    sh.uniforms.uGroundAO = { value: tex };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGroundAO;')
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        {
          vec2 guv = (vWxPos.xz - vec2(${x0.toFixed(1)}, ${z0.toFixed(1)})) / vec2(${(x1 - x0).toFixed(1)}, ${(z1 - z0).toFixed(1)});
          vec2 inb = step(vec2(0.0), guv) * step(guv, vec2(1.0));
          float g = mix(1.0, texture2D(uGroundAO, guv).r, inb.x * inb.y * ${strength.toFixed(2)});
          reflectedLight.indirectDiffuse *= g;
          reflectedLight.indirectSpecular *= g;
        }`,
      );
  });
}
