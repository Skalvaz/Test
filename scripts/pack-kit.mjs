/**
 * Kit glb paketleyici: Blender çıktısını oyuna uygun hale getirir.
 *  - aynı malzemeleri/erişimcileri birleştirir
 *  - köşe verisini nicemler (KHR_mesh_quantization: konum 16 bit, normal 8 bit)
 *  - meshopt ile sıkıştırır (EXT_meshopt_compression; three.js MeshoptDecoder
 *    ile açılır, çözücü tek dosya paketine gömülüdür)
 *
 *   node scripts/pack-kit.mjs build/kit_raw.glb src/assets/kit.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { stat } from 'node:fs/promises';

const [src = 'build/kit_raw.glb', dst = 'src/assets/kit.glb'] = process.argv.slice(2);
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
await doc.transform(
  dedup(),
  weld(),
  prune({ keepAttributes: true }),
  // Kit parçaları küçük (≤ 0.4 m): 14 bit konum ~0.03 mm hassasiyet verir
  quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 12 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(dst, doc);
const a = (await stat(src)).size;
const b = (await stat(dst)).size;
console.log(`${src} ${(a / 1024).toFixed(0)} KB → ${dst} ${(b / 1024).toFixed(0)} KB`);
