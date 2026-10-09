/**
 * Baypas–çekirdek karıştırıcısı (M5a: barejet.js'ten taşındı).
 *
 * Lobe'lu karıştırıcı: çiçek biçimli ince sac. Lobe'lar sıcak çekirdek
 * akışını dışa, soğuk baypas akışını içe taşıyarak iki akışı iç içe
 * geçirir. Genlik girişte sıfırdan çıkışta en büyüğe büyür. Çıplak askeri
 * motorda ve (P6) kaportalı karışık akışlı turbofanda kullanılır.
 */

import * as THREE from 'three';

let mixerMat = null;

/**
 * @param m  { lobes, z0, z1, r, amp }: lobe sayısı, eksenel uçlar, ortalama
 *           yarıçap ve çıkıştaki radyal genlik (design/flowpath yerleşimi)
 */
export function lobedMixer(m) {
  const nu = m.lobes * 16;
  const nv = 22;
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
  let k = 0;
  for (let j = 0; j <= nv; j++) {
    const t = j / nv;
    const z = m.z0 + (m.z1 - m.z0) * t;
    const a = m.amp * THREE.MathUtils.smootherstep(t, 0, 1);
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * Math.PI * 2;
      const r = m.r + a * Math.cos(m.lobes * th);
      pos[k * 3] = Math.sin(th) * r;
      pos[k * 3 + 1] = Math.cos(th) * r;
      pos[k * 3 + 2] = z;
      uv[k * 2] = i / nu;
      uv[k * 2 + 1] = t;
      k++;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + nu + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // İnce sac: iki yüzlü, kesit kapağı yok (kütüphane malzemeleri kesitte
  // arka yüzleri kırmızı kesik yüzey boyar); oturum boyunca tek malzeme
  mixerMat ??= new THREE.MeshPhysicalMaterial({
    name: 'lobedMixer',
    color: 0x8c8780,
    metalness: 1,
    roughness: 0.42,
    side: THREE.DoubleSide,
    envMapIntensity: 0.8,
  });
  const mesh = new THREE.Mesh(g, mixerMat);
  mesh.name = 'lobed-mixer';
  return mesh;
}
