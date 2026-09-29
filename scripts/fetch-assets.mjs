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

/** Ortam HDRI'ları (Poly Haven, CC0) */
export const HDRIS = [
  { id: 'hangar_interior', res: '2k' },
  { id: 'hanger_exterior_cloudy', res: '2k' },
  { id: 'machine_shop_02', res: '2k' },
];

/**
 * Malzeme taramaları (ambientCG, CC0). kind: 'color' renk olduğu gibi,
 * 'tint' gri tonlamalı (oyunda renklendirilir). size: dokunun gerçek boyutu (m).
 */
export const SCANS = [
  { name: 'case', id: 'Metal059B', res: '2K', kind: 'tint', size: 1.0, use: 'kaportasız motor gövdesi (titanyum/çelik)' },
  { name: 'hot', id: 'Metal063', res: '2K', kind: 'tint', size: 1.0, use: 'sıcak bölge, egzoz, art yakıcı kanalı' },
  { name: 'dark', id: 'Metal046B', res: '1K', kind: 'tint', size: 0.8, use: 'lüle yaprakları, isli parçalar' },
  { name: 'brushed', id: 'Metal009', res: '1K', kind: 'tint', size: 0.5, use: 'işlenmiş çelik (kit parçaları, flanşlar)' },
  { name: 'polished', id: 'Metal012', res: '1K', kind: 'tint', size: 0.5, use: 'paslanmaz boru, tank' },
  { name: 'smooth', id: 'Metal032', res: '1K', kind: 'tint', size: 0.6, use: 'eloksal, kaplamalı parçalar' },
  { name: 'cast', id: 'Metal041A', res: '1K', kind: 'tint', size: 0.8, use: 'döküm muhafazalar, dişli kutusu' },
  { name: 'paint', id: 'PaintedMetal004', res: '2K', kind: 'tint', size: 1.0, use: 'boyalı kutular, stand, platformlar' },
  { name: 'rubber', id: 'Rubber004', res: '1K', kind: 'tint', size: 0.5, use: 'hortum, izolatör' },
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

async function fetchHdris() {
  mkdirSync(OUT_HDRI, { recursive: true });
  const meta = [];
  for (const h of HDRIS) {
    const files = await json(`https://api.polyhaven.com/files/${h.id}`);
    const info = await json(`https://api.polyhaven.com/info/${h.id}`);
    const f = files.hdri[h.res].hdr;
    const out = path.join(OUT_HDRI, `${h.id}_${h.res}.hdr`);
    await download(f.url, out);
    meta.push({ id: h.id, name: info.name, file: path.basename(out), authors: Object.keys(info.authors ?? {}), url: `https://polyhaven.com/a/${h.id}` });
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
  const W = s.res === '2K' ? 2048 : 1024;
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
    await sharp(gray, { raw: { width: W, height: W, channels: 1 } }).webp({ quality: 86 }).toFile(path.join(OUT_SCANS, `${s.name}_color.webp`));
  } else {
    await sharp(colorF).resize(W, W).webp({ quality: 86 }).toFile(path.join(OUT_SCANS, `${s.name}_color.webp`));
  }
  await sharp(normalF).resize(W, W).webp({ quality: 90 }).toFile(path.join(OUT_SCANS, `${s.name}_normal.webp`));

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
  await sharp(orm, { raw: { width: W, height: W, channels: 3 } }).webp({ quality: 90 }).toFile(path.join(OUT_SCANS, `${s.name}_orm.webp`));
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
  { id: 'overhead_crane', res: '1k' },
];

async function fetchModels() {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { dedup, prune, meshopt, textureCompress, weld, getBounds } = await import('@gltf-transform/functions');
  const { MeshoptEncoder } = await import('meshoptimizer');
  await MeshoptEncoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  mkdirSync(OUT_PROPS, { recursive: true });
  const meta = [];
  for (const m of MODELS) {
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
    await doc.transform(
      dedup(),
      weld(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const out = path.join(OUT_PROPS, `${m.id}.glb`);
    await io.write(out, doc);
    const b = getBounds(doc.getRoot().listScenes()[0]);
    const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
    const { size: bytes } = await import('node:fs').then((fs) => fs.statSync(out));
    console.log(`  ${m.id}: ${(bytes / 1e6).toFixed(2)} MB, boyut ${size.join(' × ')} m`);
    meta.push({ id: m.id, name: info.name, file: path.basename(out), size, min: b.min, authors: Object.keys(info.authors ?? {}), url: `https://polyhaven.com/a/${m.id}` });
  }
  writeFileSync(path.join(OUT_PROPS, 'manifest.json'), JSON.stringify(meta, null, 2));
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
