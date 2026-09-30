/**
 * Pencere arkası odalar ("interior mapping"): cephe dokusunun cam maskesi
 * (ORM.b) olan piksellerde, bakış ışını camın arkasındaki hayali bir odanın
 * yan duvarları, tabanı, tavanı ve arka duvarıyla kesiştirilir. Oda boyutu
 * cephe modülüyle aynıdır (bir aks × bir kat), derinlik sabit. Her odanın
 * duvar/taban rengi, tavan lambası, masa/dolap sırası ve jaluzi yüksekliği
 * oda indeksinden türetilir; cam, üstüne PBR yansıması (düşük pürüzlülük)
 * olarak eklenir. Geometri yoktur: tek bir düz duvar, derinliği olan
 * pencereler gibi görünür.
 *
 * Gündüz odalar dışarıdan karanlık görünür (içerisi daha az aydınlık);
 * gece bazı odaların ışığı yanar.
 */

import * as THREE from 'three';
import { addPatch } from './weathering';

/** Tüm cephe malzemelerince paylaşılan: 0 = gündüz, 1 = gece */
export const interiorUniforms = {
  uNight: { value: 0 },
  uDay: { value: 0.16 },
};

export function interiorWindows(mat: THREE.MeshStandardMaterial, orm: THREE.Texture, room = { w: 3.2, h: 3.4, d: 4.6 }) {
  addPatch(mat, 'interior-v1', (sh) => {
    sh.uniforms.uWinOrm = { value: orm };
    sh.uniforms.uNight = interiorUniforms.uNight;
    sh.uniforms.uDay = interiorUniforms.uDay;
    if (!sh.vertexShader.includes('vWxPos')) {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWxPos;\nvarying vec3 vWxNrm;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vWxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWxNrm = normalize(mat3(modelMatrix) * objectNormal);`,
        );
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxPos;\nvarying vec3 vWxNrm;');
    }
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uWinOrm;
        uniform float uNight;
        uniform float uDay;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float wMask = 0.0;
        vec3 wInterior = vec3(0.0);
        float wBlind = 0.0;
        #ifdef USE_MAP
        {
          wMask = smoothstep(0.35, 0.65, texture2D(uWinOrm, vMapUv).b);
          if (wMask > 0.001) {
            vec2 uv = vMapUv;
            vec2 id = floor(uv) + floor(vWxPos.xz * 0.013) * 17.0;
            vec2 f = fract(uv);
            // Modül eksenleri: dünya uzayında dP/du ve dP/dv (türevlerden)
            vec3 dpx = dFdx(vWxPos), dpy = dFdy(vWxPos);
            vec2 dux = dFdx(uv), duy = dFdy(uv);
            vec3 T = normalize(dpx * duy.y - dpy * dux.y);
            vec3 B = normalize(dpy * dux.x - dpx * duy.x);
            vec3 N = normalize(vWxNrm);
            vec3 V = normalize(vWxPos - cameraPosition);
            vec3 r = vec3(dot(V, T), dot(V, B), max(dot(V, -N), 1e-3));
            const vec3 R = vec3(${room.w.toFixed(2)}, ${room.h.toFixed(2)}, ${room.d.toFixed(2)});
            vec3 o = vec3(f * R.xy, 0.0);
            float tx = ((r.x > 0.0 ? R.x : 0.0) - o.x) / (abs(r.x) > 1e-4 ? r.x : 1e-4);
            float ty = ((r.y > 0.0 ? R.y : 0.0) - o.y) / (abs(r.y) > 1e-4 ? r.y : 1e-4);
            float tz = R.z / r.z;
            float t = min(min(tx, ty), tz);
            vec3 p = o + r * t;
            float h = wHash(id);
            float h2 = wHash(id + 7.3);
            vec3 wallC = mix(vec3(0.62, 0.6, 0.55), vec3(0.5, 0.56, 0.52), step(0.6, h));
            vec3 floorC = mix(vec3(0.22, 0.23, 0.26), vec3(0.3, 0.24, 0.18), step(0.5, h2));
            vec3 col;
            if (t == tz) col = wallC * 0.85;
            else if (t == tx) col = wallC;
            else if (r.y > 0.0) {
              // tavan: ortada lamba paneli
              vec2 c = abs(p.xz - vec2(R.x * 0.5, R.z * 0.45));
              float panel = step(c.x, 0.3) * step(c.y, 0.6);
              col = vec3(0.75) + panel * mix(0.6, 2.5, uNight) * vec3(1.0, 0.95, 0.85);
            } else col = floorC;
            // Masa/dolap sırası: derinliğin ortasında alçak bir düzlem
            float zd = R.z * (0.45 + 0.2 * h2);
            float td = zd / r.z;
            if (td < t && (o.y + r.y * td) < 0.8 && (o.y + r.y * td) > 0.0) {
              col = mix(vec3(0.18, 0.16, 0.14), vec3(0.35, 0.36, 0.38), step(0.5, h));
              t = td;
            }
            // Derinlikle kararma (pencereden uzaklaştıkça az ışık)
            col *= mix(1.0, 0.45, clamp(t * length(r) / R.z, 0.0, 1.0));
            // Aydınlatma: gündüz loş, gece bazı odalar yanık
            float lit = step(0.63, wHash(id + 3.1));
            float level = mix(uDay, lit * 0.55 + 0.012, uNight);
            wInterior = col * level * mix(vec3(1.0), vec3(1.0, 0.86, 0.66), uNight);
            // Jaluzi: camın üstünden aşağı, oda başına farklı yükseklikte
            float glassTop = 0.69, glassBot = 0.28;
            float blind = step(0.35, h) * (0.15 + 0.7 * wHash(id + 11.0));
            float fy = (f.y - glassBot) / (glassTop - glassBot);
            wBlind = step(1.0 - blind, fy) * wMask;
          }
        }
        #endif
        vec3 wBase = diffuseColor.rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), wMask * (1.0 - wBlind));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.72, 0.68) * (0.85 + 0.15 * step(0.5, fract(vWxPos.y * 22.0))), wBlind);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.04, wMask * (1.0 - wBlind));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += wInterior * wMask * (1.0 - wBlind);
        totalEmissiveRadiance += vec3(1.0, 0.85, 0.6) * wBlind * uNight * 0.25 * step(0.63, wHash(floor(vMapUv) + floor(vWxPos.xz * 0.013) * 17.0 + 3.1));`,
      );
  });
}
