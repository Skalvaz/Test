/**
 * Dış varlık hattı: CC0 kaynaklardan (Poly Haven, ambientCG) indirir ve oyuna
 * uygun biçime dönüştürür. Her varlığın kaynağı ASSETS.md'ye yazılır.
 *
 *   npm run assets:fetch                     # hepsi
 *   npm run assets:fetch -- hdri             # yalnız HDRI'lar
 *   npm run assets:fetch -- scans            # yalnız malzeme taramaları
 *
 * İndirilen ham dosyalar build/dl/ altında önbelleğe alınır (git dışı).
 *
 * Taramalar üç dokuya paketlenir:
 *   <ad>_color.webp   renk (sRGB). "tint" türünde gri tonlamalı: oyun kendi
 *                     rengiyle çarpar, taramadan yalnız çizik/leke kalır
 *   <ad>_normal.webp  tanjant uzayı normal (OpenGL, Y+)
 *   <ad>_orm.webp     R = ortam kapanması, G = pürüzlülük, B = metallik
 * Ayrıca src/assets/scans/manifest.json: kaynak, boyut, gri tonlamanın
 * doğrusal ortalaması (renk düzeltmesi için).
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const DL = 'build/dl';
const OUT_SCANS = 'src/assets/scans';
const OUT_HDRI = 'src/assets/hdri';

/**
 * Gökyüzü HDRI'ları (Poly Haven, CC0). Yalnız "puresky" türü: fotoğrafta
 * zemin yoktur, ufkun altı oyunun 3B havaalanıdır. Gökyüzü arka planda
 * yumuşak görüneceği için 2K yeterli.
 */
export const HDRIS = [
  { id: 'kloofendal_48d_partly_cloudy_puresky', res: '2k' },
  { id: 'overcast_soil_puresky', res: '2k' },
  { id: 'industrial_sunset_puresky', res: '2k' },
];

/**
 * Malzeme taramaları (ambientCG, CC0). kind: 'color' renk olduğu gibi,
 * 'tint' gri tonlamalı (oyunda renklendirilir). size: dokunun gerçek boyutu (m).
 */
export const SCANS = [
  // px: oyundaki çözünürlük. Yalnız büyük yüzeylerde (motor gövdesi) 2K;
  // küçük parçalarda 1K ya da 512 yeterli (boyut ile keskinlik dengesi)
  { name: 'case', id: 'Metal059B', res: '2K', px: 2048, kind: 'tint', size: 1.0, use: 'kaportasız motor gövdesi (titanyum/çelik)' },
  { name: 'hot', id: 'Metal063', res: '1K', px: 1024, kind: 'tint', size: 1.0, use: 'sıcak bölge, egzoz, art yakıcı kanalı' },
  { name: 'dark', id: 'Metal046B', res: '1K', px: 1024, kind: 'tint', size: 0.8, use: 'lüle yaprakları, isli parçalar' },
  { name: 'brushed', id: 'Metal009', res: '1K', px: 1024, kind: 'tint', size: 0.5, use: 'işlenmiş çelik (kit parçaları, flanşlar)' },
  { name: 'polished', id: 'Metal012', res: '1K', px: 1024, kind: 'tint', size: 0.5, use: 'paslanmaz boru, tank' },
  { name: 'smooth', id: 'Metal032', res: '1K', px: 512, kind: 'tint', size: 0.6, use: 'eloksal, kaplamalı parçalar' },
  { name: 'cast', id: 'Metal041A', res: '1K', px: 1024, kind: 'tint', size: 0.8, use: 'döküm muhafazalar, dişli kutusu' },
  { name: 'paint', id: 'PaintedMetal004', res: '1K', px: 1024, kind: 'tint', size: 1.0, use: 'boyalı kutular, stand, platformlar' },
  { name: 'rubber', id: 'Rubber004', res: '1K', px: 512, kind: 'tint', size: 0.5, use: 'hortum, izolatör' },
  // Havaalanı zemini ve binaları (renk olduğu gibi)
  { name: 'apron', id: 'Concrete047A', res: '1K', px: 1024, kind: 'tint', size: 4.0, use: 'apron beton plakaları (gri tonlamalı, oyunda renklenir)' },
  { name: 'asphalt', id: 'Asphalt031', res: '1K', px: 1024, kind: 'color', size: 3.0, use: 'pist asfaltı' },
  { name: 'taxiway', id: 'Road012A', res: '1K', px: 1024, kind: 'color', size: 4.0, use: 'taksi yolu, yıpranmış asfalt' },
  { name: 'grass', id: 'Grass004', res: '1K', px: 1024, kind: 'color', size: 2.5, use: 'çimen alanlar' },
  { name: 'gravel', id: 'Gravel043', res: '1K', px: 512, kind: 'color', size: 1.5, use: 'pist omuzları, çakıl' },
  { name: 'corrugated', id: 'CorrugatedSteel005', res: '1K', px: 1024, kind: 'tint', size: 2.0, use: 'hangar duvar/çatısı, blast duvarı (gri tonlamalı)' },
  { name: 'shutter', id: 'CorrugatedSteel009', res: '1K', px: 512, kind: 'tint', size: 1.5, use: 'hangar kapıları (gri tonlamalı)' },
];

// Poly Haven API tanımlayıcı bir User-Agent ister. Proxy arkasında:
// NODE_USE_ENV_PROXY=1 (npm run assets:fetch bunu ayarlar)
const headers = { 'User-Agent': 'TurbofanAkademi-asset-pipeline/1.0' };

async function download(url, file) {
  if (existsSync(file)) return file;
  const res = await fetch(url, { redirect: 'follow', headers });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  console.log(`  indirildi ${file}`);
  return file;
}

async function json(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */

/**
 * HDR kodlaması ("RGB + log parlaklık"): Radiance .hdr (2K ≈ 6,5 MB) iki
 * WebP'ye bölünür:
 *   <id>_rgb.webp  renk / 2^L (0–1, sRGB eğrisiyle 8 bit, kayıplı)
 *   <id>_l.webp    L = log2(en parlak kanal), [L_MIN, L_MAX] → 8 bit (kayıpsız)
 * Tarayıcıda hdr = rgb · 2^L olarak geri çözülür (core/environment.js).
 * 24 durak aralık / 256 adım ≈ 0,09 durak çözünürlük; ortam ışığı ve
 * yansımalarda fark edilmez, dosya ~6–10× küçülür.
 */
export const L_MIN = -10;
export const L_MAX = 14;

async function encodeHdr(file, outBase) {
  const THREE = await import('three');
  const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
  const { readFileSync } = await import('node:fs');
  const buf = readFileSync(file);
  const loader = new HDRLoader();
  loader.setDataType(THREE.FloatType);
  const { width: W, height: H, data } = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const rgb = Buffer.alloc(W * H * 3);
  const lum = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const m = Math.max(r, g, b, 1e-9);
    const L = Math.min(L_MAX, Math.max(L_MIN, Math.log2(m)));
    const q = Math.round(((L - L_MIN) / (L_MAX - L_MIN)) * 255);
    lum[i] = q;
    const scale = 2 ** (L_MIN + (q / 255) * (L_MAX - L_MIN));
    rgb[i * 3] = Math.round(toSrgb(Math.min(1, r / scale)) * 255);
    rgb[i * 3 + 1] = Math.round(toSrgb(Math.min(1, g / scale)) * 255);
    rgb[i * 3 + 2] = Math.round(toSrgb(Math.min(1, b / scale)) * 255);
  }
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 88, smartSubsample: true }).toFile(`${outBase}_rgb.webp`);
  await sharp(lum, { raw: { width: W, height: H, channels: 1 } }).webp({ lossless: true }).toFile(`${outBase}_l.webp`);
}

async function fetchHdris() {
  mkdirSync(OUT_HDRI, { recursive: true });
  mkdirSync(path.join(DL, 'hdri'), { recursive: true });
  const meta = [];
  for (const h of HDRIS) {
    const files = await json(`https://api.polyhaven.com/files/${h.id}`);
    const info = await json(`https://api.polyhaven.com/info/${h.id}`);
    const f = files.hdri[h.res].hdr;
    const raw = path.join(DL, 'hdri', `${h.id}_${h.res}.hdr`);
    await download(f.url, raw);
    const base = path.join(OUT_HDRI, h.id);
    await encodeHdr(raw, base);
    const { statSync } = await import('node:fs');
    const kb = (statSync(`${base}_rgb.webp`).size + statSync(`${base}_l.webp`).size) / 1024;
    console.log(`  ${h.id}: ${(statSync(raw).size / 1e6).toFixed(1)} MB .hdr → ${kb.toFixed(0)} KB (RGB + L WebP)`);
    meta.push({ id: h.id, name: info.name, files: [`${h.id}_rgb.webp`, `${h.id}_l.webp`], lRange: [L_MIN, L_MAX], authors: Object.keys(info.authors ?? {}), url: `https://polyhaven.com/a/${h.id}` });
  }
  writeFileSync(path.join(OUT_HDRI, 'manifest.json'), JSON.stringify(meta, null, 2));
}

/* ------------------------------------------------------------------ */

function find(dir, suffix) {
  const f = readdirSync(dir).find((n) => n.toLowerCase().endsWith(suffix.toLowerCase()));
  return f ? path.join(dir, f) : null;
}

async function raw(file, w) {
  const { data, info } = await sharp(file).resize(w, w, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, channels: info.channels };
}

const toSrgb = (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
const toLin = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

async function processScan(s) {
  const dl = path.join(DL, s.id);
  mkdirSync(dl, { recursive: true });
  const zip = path.join(DL, `${s.id}_${s.res}-JPG.zip`);
  await download(`https://ambientcg.com/get?file=${s.id}_${s.res}-JPG.zip`, zip);
  execFileSync('unzip', ['-o', '-q', zip, '-d', dl]);
  const colorF = find(dl, '_Color.jpg');
  const normalF = find(dl, '_NormalGL.jpg');
  const roughF = find(dl, '_Roughness.jpg');
  const metalF = find(dl, '_Metalness.jpg');
  const aoF = find(dl, '_AmbientOcclusion.jpg');
  const W = s.px;
  mkdirSync(OUT_SCANS, { recursive: true });

  // Renk (tint türünde gri tonlama + doğrusal ortalama)
  let mean = null;
  if (s.kind === 'tint') {
    // Gri tonlama, doğrusal ortalaması 0.5 olacak şekilde ölçeklenir: oyun
    // kendi rengini ×2 ile çarpar; çizik/leke oranları korunur, koyu
    // taramalarda parlak noktalar patlamaz (en fazla 2× renk)
    const { data, channels } = await raw(colorF, W);
    const n = data.length / channels;
    const lin = new Float32Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const l = 0.2126 * data[i * channels] + 0.7152 * data[i * channels + 1] + 0.0722 * data[i * channels + 2];
      lin[i] = toLin(l);
      acc += lin[i];
    }
    const k = 0.5 / Math.max(acc / n, 1e-4);
    const gray = Buffer.alloc(n);
    for (let i = 0; i < n; i++) gray[i] = Math.round(toSrgb(Math.min(1, lin[i] * k)) * 255);
    mean = 0.5;
    await sharp(gray, { raw: { width: W, height: W, channels: 1 } }).webp({ quality: 80 }).toFile(path.join(OUT_SCANS, `${s.name}_color.webp`));
  } else {
    await sharp(colorF).resize(W, W).webp({ quality: 80 }).toFile(path.join(OUT_SCANS, `${s.name}_color.webp`));
  }
  await sharp(normalF).resize(W, W).webp({ quality: 85 }).toFile(path.join(OUT_SCANS, `${s.name}_normal.webp`));

  // ORM paketleme
  const rough = await raw(roughF, W);
  const metal = metalF ? await raw(metalF, W) : null;
  const ao = aoF ? await raw(aoF, W) : null;
  const n = W * W;
  const orm = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) {
    orm[i * 3] = ao ? ao.data[i * ao.channels] : 255;
    orm[i * 3 + 1] = rough.data[i * rough.channels];
    orm[i * 3 + 2] = metal ? metal.data[i * metal.channels] : 0;
  }
  await sharp(orm, { raw: { width: W, height: W, channels: 3 } }).webp({ quality: 80 }).toFile(path.join(OUT_SCANS, `${s.name}_orm.webp`));
  console.log(`  ${s.name} ← ${s.id} (${W}px${mean !== null ? `, ortalama ${mean.toFixed(3)}` : ''}${metal ? '' : ', metallik haritası yok'})`);
  return { name: s.name, id: s.id, kind: s.kind, size: s.size, res: W, mean, hasMetal: !!metal, hasAO: !!ao, use: s.use, url: `https://ambientcg.com/view?id=${s.id}` };
}

async function fetchScans() {
  const meta = [];
  for (const s of SCANS) meta.push(await processScan(s));
  writeFileSync(path.join(OUT_SCANS, 'manifest.json'), JSON.stringify(meta, null, 2));
}

/* ------------------------------------------------------------------ */
/* 3B modeller (Poly Haven, CC0): glTF 1K → WebP dokular + meshopt glb     */
/* ------------------------------------------------------------------ */

const OUT_PROPS = 'src/assets/props';
export const MODELS = [
  { id: 'metal_tool_chest', res: '1k' },
  { id: 'tool_cart', res: '1k' },
  { id: 'portable_welding_cart', res: '1k' },
  { id: 'hand_truck', res: '1k' },
  { id: 'steel_frame_shelves_01', res: '1k' },
  { id: 'korean_fire_extinguisher_01', res: '1k' },
  { id: 'barrel_03', res: '1k' },
  { id: 'industrial_storage_cart', res: '1k' },
  { id: 'power_box_01', res: '1k' },
  // Vinç tavanda, uzakta: üçgen sayısı ~%35'e indirilir
  { id: 'overhead_crane', res: '1k', simplify: 0.35 },
];

/**
 * Havaalanı donanımı (Poly Haven, CC0). keep: yalnız adı bu öneklerle
 * başlayan kök düğümler kalır (modüler setlerden parça seçimi); center:
 * seçilen düğümler orijine alınır (tek parçalar); simplify: üçgen oranı.
 * Havaalanında modeller kameradan metrelerce uzakta: 512 px doku yeter.
 */
export const AF_MODELS = [
  { id: 'concrete_road_barrier', res: '1k', simplify: 0.08 },
  { id: 'concrete_road_barrier_02', res: '1k', simplify: 0.12 },
  // Modüler setler: parçalar ayrı ayrı orijine alınır (y korunur)
  { id: 'modular_chainlink_fence', res: '1k', keep: ['modular_chainlink_fence_double', 'modular_chainlink_fence_post', 'modular_chainlink_fence_door_frame', 'modular_chainlink_fence_door_gate'], drop: ['_bracket'], center: 'each', simplify: 0.5, err: 0.005 },
  { id: 'modular_electricity_poles', res: '1k', keep: ['preset_01_', 'preset_02_', 'preset_03_'], drop: ['bolt', 'nail', 'nut'], simplify: 0.2, err: 0.012 },
  { id: 'portable_generator', res: '1k', simplify: 0.4, err: 0.005 },
  // Varyant setlerinden biri seçilir, grup olarak ortalanır
  { id: 'exterior_aircon_unit', res: '1k', keep: ['exterior_aircon_unit_rusted'], center: 'group', simplify: 0.5 },
  { id: 'utility_box_01', res: '1k' },
  { id: 'utility_box_02', res: '1k' },
  { id: 'fire_hydrant', res: '1k', keep: ['fire_hydrant'], drop: ['_aged'], center: 'group', simplify: 0.12 },
  { id: 'water_manhole_cover', res: '1k', simplify: 0.4, px: 256 },
  { id: 'metal_trash_can', res: '1k', keep: ['metal_trash_can_rust'], center: 'group', simplify: 0.5, px: 256 },
  { id: 'old_tyre', res: '1k', px: 256 },
  { id: 'covered_car', res: '1k', simplify: 0.6 },
  { id: 'wooden_crate_01', res: '1k', px: 256 },
  { id: 'wooden_military_crate', res: '1k', simplify: 0.4 },
  { id: 'metal_jerrycan', res: '1k', simplify: 0.4, px: 256 },
  { id: 'old_military_compressor', res: '1k', simplify: 0.15, err: 0.005 },
  { id: 'cardboard_box_01', res: '1k', simplify: 0.25, px: 256 },
  { id: 'Barrel_01', res: '1k', px: 256 },
  { id: 'ladder_sectioned_01', res: '1k', simplify: 0.3, px: 256 },
  { id: 'security_light', res: '1k', px: 256 },
];
const OUT_AFPROPS = 'src/assets/afprops';

async function fetchModels(list = MODELS, outDir = OUT_PROPS) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { dedup, prune, meshopt, textureCompress, weld, getBounds, simplify, quantize } = await import('@gltf-transform/functions');
  const { MeshoptEncoder, MeshoptSimplifier } = await import('meshoptimizer');
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  mkdirSync(outDir, { recursive: true });
  const meta = [];
  for (const m of list) {
    const files = await json(`https://api.polyhaven.com/files/${m.id}`);
    const info = await json(`https://api.polyhaven.com/info/${m.id}`);
    const g = files.gltf[m.res].gltf;
    const dir = path.join(DL, 'models', m.id);
    mkdirSync(dir, { recursive: true });
    const main = path.join(dir, path.basename(g.url));
    await download(g.url, main);
    for (const [rel, f] of Object.entries(g.include ?? {})) {
      const out = path.join(dir, rel);
      mkdirSync(path.dirname(out), { recursive: true });
      await download(f.url, out);
    }
    const doc = await io.read(main);
    if (m.keep) {
      const scene = doc.getRoot().listScenes()[0];
      for (const node of scene.listChildren()) {
        const name = node.getName();
        if (!m.keep.some((k) => name.startsWith(k)) || m.drop?.some((d) => name.includes(d))) node.dispose();
        else if (m.center === 'each') {
          const [, y] = node.getTranslation();
          node.setTranslation([0, y, 0]);
        }
      }
      if (m.center === 'group') {
        const b = getBounds(scene);
        const cx = (b.min[0] + b.max[0]) / 2;
        const cz = (b.min[2] + b.max[2]) / 2;
        for (const node of scene.listChildren()) {
          const [x, y, z] = node.getTranslation();
          node.setTranslation([x - cx, y, z - cz]);
        }
      }
    }
    await doc.transform(
      dedup(),
      weld(),
      ...(m.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: m.simplify, error: m.err ?? 0.002 })] : []),
      prune(),
      // Hücre donanımı motordan metrelerce uzakta: 512 px doku yeterli
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 80, resize: [m.px ?? 512, m.px ?? 512] }),
      ...(outDir === OUT_AFPROPS ? [quantize()] : []),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const out = path.join(outDir, `${m.id}.glb`);
    await io.write(out, doc);
    const b = getBounds(doc.getRoot().listScenes()[0]);
    const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
    const { size: bytes } = await import('node:fs').then((fs) => fs.statSync(out));
    console.log(`  ${m.id}: ${(bytes / 1e6).toFixed(2)} MB, boyut ${size.join(' × ')} m`);
    meta.push({ id: m.id, name: info.name, file: path.basename(out), size, min: b.min, authors: Object.keys(info.authors ?? {}), url: `https://polyhaven.com/a/${m.id}` });
  }
  writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(meta, null, 2));
}

/* ------------------------------------------------------------------ */

mkdirSync(DL, { recursive: true });
const what = process.argv[2] ?? 'all';
if (what === 'all' || what === 'hdri') {
  console.log('HDRI');
  await fetchHdris();
}
if (what === 'all' || what === 'scans') {
  console.log('Taramalar');
  await fetchScans();
}
if (what === 'all' || what === 'models') {
  console.log('Modeller');
  await fetchModels();
}
if (what === 'all' || what === 'afprops') {
  console.log('Havaalanı donanımı');
  await fetchModels(AF_MODELS, OUT_AFPROPS);
}
