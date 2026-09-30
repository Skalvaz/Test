/**
 * Kanat ve disk yüzeyleri için prosedürel shader yamaları (M2).
 *
 * blades.js'in ürettiği nitelikler kullanılır:
 *   uv     u: profil çevresi (0 firar/emme → 0.5 hücum → 1 firar/basınç),
 *          v: açıklık (0 kök → 1 uç)
 *   uv1    metre: u = yay uzunluğu, v = yarıçap (delik ve çizgiler gerçek
 *          boyutta, kanat boyundan bağımsız)
 *   aZone  0 profil, 1 platform, 2 uç (squealer/örtü), 3 kök
 * ve örnek (instance) rengi veri taşıyıcı olarak: r = kademe ısısı,
 * g = kanat başına rastgele, b = kademe konumu. Renk olarak kullanılmaz;
 * albedo yeniden hesaplanır.
 *
 * Türler:
 *   comp      kompresör rotoru: titanyum/çelik, hücum kenarı erozyonu,
 *             arka kademelerde saman sarısı ısı renklenmesi, göbekte kir
 *   compVane  kompresör statoru: mat gri, kir filmi
 *   fan       fan kanadı: saten titanyum, hücum kenarı erozyonu
 *   hpt       HP türbin rotoru: termal bariyer kaplama (TBC), hücum
 *             kenarında "duş başlığı" delikleri, basınç yüzünde film
 *             soğutma sıraları, firar kenarında kesik yarıklar, uçta
 *             kırmızı-mor ısı tonu, kurum çizgileri, kaplama dökülmesi
 *   hptVane   HP türbin NGV: daha yoğun delik sıraları, daha isli
 *   lpt       LP türbin rotoru: kaplamasız nikel, kademe ısısına göre
 *             saman → bronz → mor → mavi ince film renkleri
 *   lptVane   LP türbin statoru: aynı, daha koyu
 *
 * Delikler: gerçek boyutta (≈1–2 mm) olduklarından normal mesafede piksel
 * altıdır; fwidth ile piksel boyutu ölçülür, delik aralığı birkaç pikselin
 * altına düşünce desen ortalama koyulaşmaya dönüşür (titreşim olmaz).
 */

import * as THREE from 'three';
import { addPatch } from './weathering';

export type BladeKind = 'comp' | 'compVane' | 'fan' | 'hpt' | 'hptVane' | 'lpt' | 'lptVane';
const KIND_ID: Record<BladeKind, number> = { comp: 0, compVane: 1, fan: 2, hpt: 3, hptVane: 4, lpt: 5, lptVane: 6 };

const COMMON = /* glsl */ `
float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1, 0)), u.x), mix(bHash(i + vec2(0, 1)), bHash(i + vec2(1, 1)), u.x), u.y);
}
float bFbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * bNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
vec3 bLin(vec3 c) { return pow(c, vec3(2.2)); }
/* Isıl oksit (ince film) rengi: 0 metal → saman → bronz → mor → mavi */
vec3 bTemper(float h) {
  vec3 c0 = bLin(vec3(0.60, 0.58, 0.55));
  vec3 c1 = bLin(vec3(0.68, 0.62, 0.50));
  vec3 c2 = bLin(vec3(0.58, 0.47, 0.38));
  vec3 c3 = bLin(vec3(0.47, 0.40, 0.45));
  vec3 c4 = bLin(vec3(0.40, 0.45, 0.56));
  h = clamp(h, 0.0, 1.0) * 4.0;
  if (h < 1.0) return mix(c0, c1, h);
  if (h < 2.0) return mix(c1, c2, h - 1.0);
  if (h < 3.0) return mix(c2, c3, h - 2.0);
  return mix(c3, c4, h - 3.0);
}
/*
 * Delik sırası: s (m, çevre boyunca), r (m, açıklık boyunca). sRow sıranın
 * çevresel konumu, sp aralık, rad yarıçap, stretch delik boyunun akış
 * yönünde uzaması (şekilli film delikleri), off sıra kaydırması.
 * Dönüş: x = delik içi (0..1), y = kenar halkası (kabartı için)
 */
vec2 bHoles(float s, float r, float sRow, float sp, float rad, float stretch, float off, float px) {
  float ds = (s - sRow) / stretch;
  float cell = r / sp + off;
  float dr = (fract(cell) - 0.5) * sp;
  float d = length(vec2(ds, dr));
  float w = max(px, rad * 0.15);
  float hole = 1.0 - smoothstep(rad - w, rad + w, d);
  float rim = smoothstep(rad * 1.9, rad, d) * (1.0 - hole);
  // piksel aralığı küçükse ortalama (alan oranı) → titreşimsiz
  float fade = smoothstep(sp * 0.45, sp * 0.18, px);
  float avg = (3.1416 * rad * rad * stretch) / (sp * rad * 6.0);
  return vec2(mix(avg * step(abs(s - sRow), rad * stretch * 3.0), hole, fade), rim * fade);
}
vec3 bPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

/** Kanat malzemesine yüzey yaması ekler */
export function bladeSurface<T extends THREE.MeshStandardMaterial>(mat: T, kind: BladeKind): T {
  addPatch(mat, `blade-v1-${kind}`, (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        #ifndef USE_UV1
        attribute vec2 uv1;
        #endif
        attribute float aZone;
        varying vec2 vBUv;
        varying vec2 vBM;
        varying float vBZone;
        varying vec3 vBData;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBUv = uv;
        vBM = uv1;
        vBZone = aZone;
        #ifdef USE_INSTANCING_COLOR
        vBData = instanceColor;
        #else
        vBData = vec3(0.2, 0.5, 0.0);
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        #define BLADE_KIND ${KIND_ID[kind]}
        varying vec2 vBUv;
        varying vec2 vBM;
        varying float vBZone;
        varying vec3 vBData;
        ${COMMON}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // --- kanat yüzeyi ---
        float bU = vBUv.x;         // 0.5 = hücum kenarı
        float bV = clamp(vBUv.y, 0.0, 1.0);
        float bS = vBM.x;          // çevre boyunca metre
        float bR = vBM.y;          // yarıçap (m)
        float bHeat = vBData.x;
        float bRnd = vBData.y;
        float zAir = 1.0 - step(0.5, vBZone);
        float zPlat = step(0.5, vBZone) * (1.0 - step(1.5, vBZone));
        float zTip = step(1.5, vBZone) * (1.0 - step(2.5, vBZone));
        float zRoot = step(2.5, vBZone);
        float bPx = max(fwidth(bR), fwidth(bS));
        float bLE = abs(bU - 0.5);                 // hücum kenarına uzaklık (u)
        float bPS = step(0.5, bU);                  // basınç yüzü
        vec3 bBase = diffuse;
        vec3 bAlb = bBase;
        float bRough = roughness;
        float bMetal = metalness;
        float bH = 0.0;                            // kabartı yüksekliği
        float bN = bFbm(vec2(bU * 9.0, bV * 5.0) + bRnd * 31.0);
        float bStreak = bFbm(vec2(bU * 2.5 + bRnd * 7.0, bV * 16.0));

        #if BLADE_KIND == 0 || BLADE_KIND == 1 || BLADE_KIND == 2
        {
          // Kompresör/fan: parlatılmış metal, kademe ısısıyla saman rengi
          vec3 base = bBase * (0.92 + 0.12 * bN);
          vec3 tint = bTemper(bHeat * (0.75 + 0.5 * bV));
          bAlb = mix(base, base * tint / bLin(vec3(0.60, 0.58, 0.55)), smoothstep(0.05, 0.35, bHeat));
          // göbek yakınında kir/yağ filmi (basınç yüzü ve kök)
          float grime = (1.0 - smoothstep(0.0, 0.35, bV)) * (0.35 + 0.65 * bPS) * (0.4 + 0.6 * bStreak);
          #if BLADE_KIND == 1
          grime = 0.35 + 0.45 * grime + 0.2 * bStreak;
          #endif
          bAlb = mix(bAlb, bAlb * bLin(vec3(0.55, 0.5, 0.42)), clamp(grime, 0.0, 1.0) * 0.7);
          bRough = roughness + grime * 0.18 + 0.06 * bN;
          // hücum kenarı erozyonu: parlak, pürüzlü şerit (uca doğru geniş)
          float ero = (1.0 - smoothstep(0.004, 0.012 + 0.02 * bV, bLE)) * smoothstep(0.1, 0.8, bV);
          ero *= 0.6 + 0.4 * bNoise(vec2(bR * 900.0, bU * 40.0));
          bAlb = mix(bAlb, bBase * 1.15, ero * 0.8);
          bRough = mix(bRough, 0.42, ero);
          bH += ero * 0.3 * bNoise(vec2(bR * 3000.0, bS * 3000.0));
        }
        #endif

        #if BLADE_KIND == 3 || BLADE_KIND == 4
        {
          // Termal bariyer kaplama (TBC): açık bej seramik, sıcaklıkla koyulaşır
          vec3 tbc = bLin(vec3(0.72, 0.68, 0.60));
          vec3 aged = bLin(vec3(0.54, 0.46, 0.38));
          vec3 hot = bLin(vec3(0.50, 0.33, 0.28));
          vec3 soot = bLin(vec3(0.17, 0.15, 0.14));
          // sıcak bölge: orta-uç açıklık, basınç yüzü, uç kenarı
          float heat = smoothstep(0.25, 0.85, bV) * (0.55 + 0.45 * bPS) + smoothstep(0.86, 1.0, bV) * 0.8;
          heat *= 0.75 + 0.5 * bN;
          #if BLADE_KIND == 4
          heat = heat * 0.8 + 0.25 * bStreak;
          #endif
          vec3 c = mix(tbc, aged, clamp(heat * 0.9 + 0.2 * bN, 0.0, 1.0));
          c = mix(c, hot, smoothstep(0.55, 1.1, heat) * (0.6 + 0.4 * bRnd));
          // hücum kenarı film soğutmayla korunur (açık), akış yönünde kurum
          c = mix(c, tbc * 0.95, (1.0 - smoothstep(0.0, 0.05, bLE)) * 0.5);
          float sootAmt = smoothstep(0.45, 0.8, bStreak) * smoothstep(0.02, 0.2, bLE);
          #if BLADE_KIND == 4
          sootAmt = sootAmt * 1.4 + 0.15;
          #endif
          c = mix(c, soot, clamp(sootAmt, 0.0, 1.0) * 0.35);
          // kaplama dökülmesi (spallation): uç ve hücum kenarı yakınında
          float spall = smoothstep(0.72, 0.8, bFbm(vec2(bS * 180.0, bR * 180.0) + bRnd * 13.0)) * smoothstep(0.55, 0.95, bV);
          c = mix(c, bLin(vec3(0.42, 0.42, 0.45)), spall);
          bAlb = c;
          bMetal = spall * 0.9;
          bRough = mix(0.74 + 0.1 * bN, 0.4, spall);
          bH -= spall * 0.4;

          // --- soğutma delikleri ---
          float hole = 0.0;
          float rim = 0.0;
          // yarım çevre uzunluğu (m): uv1.x = u · çevre
          float perim = bS / max(bU, 0.05);
          // hücum kenarı: "duş başlığı" (5 sıra, şaşırtmalı)
          for (int k = -2; k <= 2; k++) {
            float row = float(k) * 0.0028;
            vec2 hh = bHoles((bU - 0.5) * perim, bR, row, 0.0042, 0.00048, 1.0, float(k) * 0.5, bPx);
            hole = max(hole, hh.x);
            rim = max(rim, hh.y);
          }
          // basınç yüzü film delikleri (şekilli: akış yönünde uzun)
          #if BLADE_KIND == 3
          const int NR = 2;
          #else
          const int NR = 4;
          #endif
          for (int k = 0; k < NR; k++) {
            float uRow = 0.6 + float(k) * 0.075;
            vec2 hh = bHoles((bU - uRow) * perim, bR, 0.0, 0.0065, 0.00045, 2.2, float(k) * 0.5, bPx);
            hole = max(hole, hh.x * bPS);
            rim = max(rim, hh.y * bPS);
          }
          // emme yüzünde tek sıra (hücuma yakın)
          vec2 hs = bHoles((bU - 0.43) * perim, bR, 0.0, 0.007, 0.00045, 1.8, 0.25, bPx);
          hole = max(hole, hs.x * (1.0 - bPS));
          // firar kenarı kesik yarıkları (basınç yüzü, u ≈ 0.93–0.99)
          float slotCell = fract(bR / 0.0042);
          float slot = step(0.915, bU) * step(bU, 0.985) * smoothstep(0.62, 0.5, abs(slotCell - 0.5) * 2.0 + 0.2);
          float slotFade = smoothstep(0.0042 * 0.4, 0.0042 * 0.15, bPx);
          slot *= slotFade;
          hole = max(hole, slot * 0.85);
          hole *= zAir * step(0.04, bV) * step(bV, 0.97);
          rim *= zAir;
          bAlb = mix(bAlb, bAlb * bLin(vec3(0.22, 0.18, 0.16)), hole);
          bRough = mix(bRough, 0.9, hole);
          bH += rim * 0.25 - hole * 0.8;
          // kurum lekeleri deliklerin akış aşağısında
          bAlb *= 1.0 - 0.15 * rim;
        }
        #endif

        #if BLADE_KIND == 5 || BLADE_KIND == 6
        {
          // Kaplamasız nikel süper alaşım: ısı renklenmesi (ince oksit filmi)
          float h = bHeat * (0.7 + 0.55 * sin(3.1416 * clamp(bV * 0.9 + 0.1, 0.0, 1.0))) + 0.12 * (bN - 0.5);
          #if BLADE_KIND == 6
          h += 0.08;
          #endif
          vec3 c = bTemper(h) * (0.85 + 0.2 * bN);
          // akış yönünde koyu çizgiler (kurum/oksit)
          c *= 1.0 - 0.28 * smoothstep(0.5, 0.85, bStreak);
          bAlb = c;
          bRough = 0.34 + 0.18 * bN + 0.1 * smoothstep(0.5, 0.85, bStreak);
        }
        #endif

        // Platform: türbinde kaplamalı/oksitli, kompresörde işlenmiş metal.
        // Kök: işlenmiş çıplak metal (diş yüzeyleri parlak)
        {
          vec3 plat;
          float platMetal = 1.0;
          #if BLADE_KIND == 3 || BLADE_KIND == 4
          plat = mix(bLin(vec3(0.62, 0.55, 0.47)), bLin(vec3(0.45, 0.36, 0.3)), bN);
          platMetal = 0.0;
          #elif BLADE_KIND >= 5
          plat = bTemper(bHeat * 0.45 + 0.1) * (0.85 + 0.2 * bN);
          #else
          plat = bBase * 0.9;
          #endif
          bAlb = mix(bAlb, plat, zPlat);
          bMetal = mix(bMetal, platMetal, zPlat);
          bRough = mix(bRough, platMetal > 0.5 ? 0.3 + 0.1 * bN : 0.7, zPlat);
          vec3 rootC = bLin(vec3(0.66, 0.65, 0.63)) * (0.9 + 0.15 * bN);
          #if BLADE_KIND >= 3
          rootC = mix(rootC, rootC * bTemper(0.1 + 0.15 * bHeat) / bLin(vec3(0.60, 0.58, 0.55)), 0.5);
          #endif
          bAlb = mix(bAlb, rootC, zRoot);
          bMetal = mix(bMetal, 1.0, zRoot);
          bRough = mix(bRough, 0.26, zRoot);
          // Uç: squealer / örtü, oksitli koyu; sürtünme izleri parlak
          vec3 tipC;
          #if BLADE_KIND == 3 || BLADE_KIND == 4
          tipC = mix(bLin(vec3(0.34, 0.26, 0.26)), bLin(vec3(0.62, 0.6, 0.58)), smoothstep(0.985, 1.0, bV) * 0.8);
          #elif BLADE_KIND >= 5
          tipC = bTemper(bHeat * 0.5 + 0.35) * 0.7;
          #else
          tipC = bAlb;
          #endif
          bAlb = mix(bAlb, tipC, zTip);
          bMetal = mix(bMetal, 1.0, zTip);
          bRough = mix(bRough, 0.45, zTip);
        }
        diffuseColor.rgb = bAlb;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(bRough, 0.05, 1.0);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = bMetal;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float hs = bH * 0.0012;
          vec2 dH = vec2(dFdx(hs), dFdy(hs));
          normal = bPerturb(-vViewPosition, normal, dH, faceDirection);
        }`,
      );
  });
  return mat;
}

/**
 * Disk ve dönel parçalar: çevresel torna izleri (profil yay uzunluğu
 * boyunca ince pürüzlülük halkaları) ve türbin disklerinde jantta ısı
 * renklenmesi (yarıçapla artar).
 */
export function turnedSurface<T extends THREE.MeshStandardMaterial>(mat: T, opts: { heat?: [number, number] } = {}): T {
  const [r0, r1] = opts.heat ?? [0, 0];
  addPatch(mat, `turned-v1-${r0}-${r1}`, (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        #ifndef USE_UV1
        attribute vec2 uv1;
        #endif
        varying vec2 vTM;
        varying float vTR;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTM = uv1;
        vTR = length(position.xy);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vTM;
        varying float vTR;
        ${COMMON}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float tS = vTM.y;
        float tPx = fwidth(tS);
        // torna izleri: 0.35 mm adım; piksel altına inince söner
        float lathe = sin(tS * 6.2832 / 0.00035) * smoothstep(0.00035, 0.00008, tPx);
        float tBand = bNoise(vec2(tS * 60.0, vTM.x * 3.0));
        diffuseColor.rgb *= 0.94 + 0.1 * tBand;
        ${r1 > r0 ? `diffuseColor.rgb *= bTemper(smoothstep(${r0.toFixed(3)}, ${r1.toFixed(3)}, vTR) * 0.55 + 0.05 * tBand) / bLin(vec3(0.60, 0.58, 0.55));` : ''}
        float tRough = 0.05 * lathe + 0.06 * (tBand - 0.5);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + tRough, 0.05, 1.0);`,
      );
  });
  return mat;
}
