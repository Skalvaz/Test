/**
 * Prosedürel doku üretimi.
 *
 * Harici bir doku dosyasına bağımlı kalmamak için bütün albedo / roughness /
 * normal haritaları çalışma anında canvas üzerinde üretilir. Amaç fotogerçekçi
 * bir yüzey hissi: fırçalanmış metal anizotropisi, panel derzleri, perçin
 * sıraları, akıntı lekeleri, kurum ve mikro çizikler.
 */

import * as THREE from 'three';
import layout from './nacelleLayout.json';
import nacelleNormalUrl from '../assets/nacelle_normal.webp?url';
import nacelleOrmUrl from '../assets/nacelle_orm.webp?url';

/* ------------------------------------------------------------------ */
/* Gürültü (value noise + fbm)                                         */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periyodik (sarmalanabilir) value-noise tablosu. */
function makeLattice(size, rand) {
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return g;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function latticeSample(g, size, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % size) + size) % size;
  const y0 = ((yi % size) + size) % size;
  const x1 = (x0 + 1) % size;
  const y1 = (y0 + 1) % size;
  const u = fade(xf);
  const v = fade(yf);
  const a = g[y0 * size + x0];
  const b = g[y0 * size + x1];
  const c = g[y1 * size + x0];
  const d = g[y1 * size + x1];
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Yatayda sarmalanan fbm. `octaves` katman sayısı, `lacunarity` frekans artışı,
 * `gain` genlik sönümü. Dönüş 0..1.
 */
export function fbm2D(width, height, opts = {}) {
  const {
    octaves = 5,
    frequency = 4,
    lacunarity = 2,
    gain = 0.5,
    seed = 1337,
    stretchX = 1,
    stretchY = 1,
  } = opts;

  const rand = mulberry32(seed);
  const lattices = [];
  for (let o = 0; o < octaves; o++) {
    const size = Math.max(2, Math.round(frequency * Math.pow(lacunarity, o)));
    lattices.push({ size, g: makeLattice(size, rand) });
  }

  const out = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fx = (x / width) * stretchX;
      const fy = (y / height) * stretchY;
      let amp = 1;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves; o++) {
        const { size, g } = lattices[o];
        sum += amp * latticeSample(g, size, fx * size, fy * size);
        norm += amp;
        amp *= gain;
      }
      const v = sum / norm;
      out[y * width + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const range = max - min || 1;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / range;
  return out;
}

/* ------------------------------------------------------------------ */
/* Canvas yardımcıları                                                 */
/* ------------------------------------------------------------------ */

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas, { srgb = false, repeat = [1, 1], aniso = 16 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Yükseklik alanından Sobel türevi ile tanjant uzayı normal haritası üretir.
 * Yatay/dikey sarmalama korunur, böylece silindirik gövdelerde dikiş olmaz.
 */
export function heightToNormalTexture(height, w, h, strength = 2.0) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => height[(((y % h) + h) % h) * w + (((x % w) + w) % w)];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
      const l = at(x - 1, y), r = at(x + 1, y);
      const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function grayCanvas(data, w, h, map = (v) => v) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(1, map(data[i], i % w, (i / w) | 0))) * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* ------------------------------------------------------------------ */
/* Nacelle (motor kaportası) harita seti                               */
/* ------------------------------------------------------------------ */

/**
 * LatheGeometry UV düzeni: u = çevre boyunca (0..1), v = profil boyunca.
 * Panel derzleri bu yüzden v ekseninde yatay çizgiler (çevresel ek yerleri),
 * u ekseninde dikey çizgiler (boylamasına ayrım hatları) olarak çizilir.
 */
export function createNacelleMaps(opts = {}) {
  const {
    size = 2048,
    baseColor = '#e8eaec',
    accent = '#1d2733',
    seed = 91,
    soot = 0.0,
  } = opts;

  const w = size;
  const h = size / 2;

  /* --- albedo --- */
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  // Gövde boyunca çok hafif renk sapması (boya partisi farkı hissi)
  const tint = ctx.createLinearGradient(0, 0, 0, h);
  tint.addColorStop(0, 'rgba(255,255,255,0.10)');
  tint.addColorStop(0.55, 'rgba(226,232,238,0.0)');
  tint.addColorStop(1, 'rgba(120,130,140,0.18)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, w, h);

  // Panel derzleri nacelleLayout.json'dan: aynı yerleşimle Blender'da pişirilen
  // kabartma (perçin, vida, kapak) haritaları bunların üzerine oturur.
  // Yerleşim yarım çevre içindir ve aynalı iki kez sarılır; canvas'ta v ekseni
  // ters (üst satır = v 1, kaportanın arka ucu).
  const seams = [...new Set(layout.seamsU.flatMap((s) => [s / 2, (1 - s / 2) % 1]))];
  ctx.lineWidth = Math.max(1.5, w / 1200);
  ctx.strokeStyle = 'rgba(70,80,90,0.5)';
  for (const s of seams) {
    ctx.beginPath();
    ctx.moveTo(s * w, 0);
    ctx.lineTo(s * w, h);
    ctx.stroke();
  }
  const rings = layout.ringsV.map((v) => 1 - v);
  ctx.strokeStyle = 'rgba(88,98,110,0.45)';
  for (const r of rings) {
    ctx.beginPath();
    ctx.moveTo(0, r * h);
    ctx.lineTo(w, r * h);
    ctx.stroke();
  }

  // Aksan bandı (kuşak boyası) — jenerik, marka içermez
  const [band0, band1] = layout.bandV;
  const bandH = ((band1 - band0) * h) / 1.18;
  const bandTop = (1 - band1) * h;
  ctx.fillStyle = accent;
  ctx.fillRect(0, bandTop, w, bandH);
  ctx.fillStyle = 'rgba(214,168,60,0.95)';
  ctx.fillRect(0, bandTop + bandH, w, bandH * 0.18);

  // Uyarı yazıları (jenerik havacılık ikazları).
  // Lathe UV'sinde u çevre, v eksen yönüdür; yazı gövde boyunca okunsun diye
  // canvas 90° döndürülerek yazılır.
  // Lathe sarımında u = çevre, v = eksen yönüdür. Gövdenin sağ (+X, u≈0.25)
  // ve sol (−X, u≈0.75) yüzünde "yukarı" yönü terstir; gerçek uçaklarda
  // olduğu gibi her yüze kendi yönünde yazı basılır, aksi halde yazı
  // baş aşağı ve ters okunur.
  const label = (text, u, v, color, scale = 1) => {
    const rightSide = u < 0.5;
    ctx.save();
    ctx.translate(u * w, v * h);
    ctx.rotate(rightSide ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.round(w * 0.015 * scale)}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  for (const side of [0.26, 0.76]) {
    const dir = side < 0.5 ? 1 : -1;
    label('NO STEP', side, 0.60 + 0.10 * dir, 'rgba(46,54,62,0.85)');
    label('DANGER — INTAKE HAZARD ZONE', side + 0.055 * dir, 0.44 + 0.22 * dir, 'rgba(46,54,62,0.75)', 0.8);
    label('RESCUE', side + 0.10 * dir, 0.94, 'rgba(186,42,42,0.9)');
    label('OIL — SEE MANUAL', side - 0.075 * dir, 0.74 + 0.06 * dir, 'rgba(46,54,62,0.6)', 0.66);
  }

  // Kurum / akıntı lekeleri (arka tarafa doğru)
  const dirt = fbm2D(w, h, { octaves: 6, frequency: 3, seed, stretchY: 0.35 });
  const dirtCanvas = makeCanvas(w, h);
  const dctx = dirtCanvas.getContext('2d');
  const dimg = dctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const along = y / h;
    const aft = Math.pow(Math.max(0, along - 0.45) / 0.55, 1.6);
    for (let x = 0; x < w; x++) {
      const n = dirt[y * w + x];
      const streak = Math.pow(n, 2.2);
      const a = Math.min(1, (aft * 0.55 + soot * 0.6) * streak * 1.6);
      const i = (y * w + x) * 4;
      dimg.data[i] = 30;
      dimg.data[i + 1] = 30;
      dimg.data[i + 2] = 32;
      dimg.data[i + 3] = a * 255;
    }
  }
  dctx.putImageData(dimg, 0, 0);
  ctx.drawImage(dirtCanvas, 0, 0);

  /* --- roughness --- */
  const micro = fbm2D(w, h, { octaves: 6, frequency: 10, seed: seed + 7 });
  const scratches = fbm2D(w, h, { octaves: 4, frequency: 6, seed: seed + 19, stretchX: 0.08 });
  const roughCanvas = grayCanvas(micro, w, h, (v, x, y) => {
    const along = y / h;
    const base = 0.32 + v * 0.14;
    const aft = Math.pow(Math.max(0, along - 0.5) / 0.5, 2) * 0.22;
    const scr = (scratches[y * w + x] - 0.5) * 0.12;
    return base + aft + scr + soot * 0.2;
  });

  /* --- normal: yalnız boya yüzeyi dalgası (derz ve perçin kabartması
     pişirilmiş haritadan gelir, bkz. loadNacelleDetail) --- */
  const surface = fbm2D(w, h, { octaves: 5, frequency: 24, seed: seed + 3 });
  const normalCanvas = heightToNormalTexture(surface, w, h, 0.9);

  return {
    map: toTexture(canvas, { srgb: true }),
    roughnessMap: toTexture(roughCanvas),
    normalMap: toTexture(normalCanvas),
  };
}

/* ------------------------------------------------------------------ */
/* Titanyum fan kanadı                                                 */
/* ------------------------------------------------------------------ */

export function createBladeMaps(opts = {}) {
  const { size = 1024, seed = 404 } = opts;
  const w = size;
  const h = size;

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#9aa1a8');
  grad.addColorStop(0.5, '#b4bcc3');
  grad.addColorStop(1, '#8d949b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Talaşlı imalat izleri: kanat kordu boyunca ince paralel çizgiler
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#5e666d';
    ctx.lineWidth = Math.random() * 1.4 + 0.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Hücum kenarı aşınma şeridi (titanyum kaplama parlaklığı)
  const edge = ctx.createLinearGradient(0, 0, w * 0.12, 0);
  edge.addColorStop(0, 'rgba(226,232,238,0.95)');
  edge.addColorStop(1, 'rgba(226,232,238,0.0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w * 0.12, h);

  // Kök bölgesinde hafif is ve yağ filmi
  const grime = fbm2D(w, h, { octaves: 5, frequency: 5, seed });
  const gcanvas = makeCanvas(w, h);
  const gctx = gcanvas.getContext('2d');
  const gimg = gctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const span = 1 - y / h; // kök -> uç
      const a = Math.pow(grime[y * w + x], 2.4) * Math.pow(span, 1.5) * 0.5;
      const i = (y * w + x) * 4;
      gimg.data[i] = 52; gimg.data[i + 1] = 48; gimg.data[i + 2] = 44;
      gimg.data[i + 3] = a * 255;
    }
  }
  gctx.putImageData(gimg, 0, 0);
  ctx.drawImage(gcanvas, 0, 0);

  const micro = fbm2D(w, h, { octaves: 5, frequency: 18, seed: seed + 5, stretchX: 0.25 });
  const rough = grayCanvas(micro, w, h, (v, x, y) => {
    const span = 1 - y / h;
    return 0.16 + v * 0.13 + span * 0.14 + (x < w * 0.1 ? -0.06 : 0);
  });

  const bump = fbm2D(w, h, { octaves: 5, frequency: 40, seed: seed + 11, stretchX: 0.12 });
  const normal = heightToNormalTexture(bump, w, h, 1.1);

  return {
    map: toTexture(canvas, { srgb: true }),
    roughnessMap: toTexture(rough),
    normalMap: toTexture(normal),
  };
}

/* ------------------------------------------------------------------ */
/* Spinner (burun konisi) sarmalı                                      */
/* ------------------------------------------------------------------ */

/** Klasik beyaz spiral işareti: dönüş görünürlüğü için kullanılır. */
export function createSpinnerTexture(size = 1024) {
  const w = size;
  const h = size / 2;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2f35';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#f2f4f6';
  ctx.lineWidth = h * 0.085;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Koni açılımında sarmal, UV uzayında eğik bir çizgidir.
  ctx.moveTo(-w * 0.1, h * 1.05);
  ctx.lineTo(w * 0.62, -h * 0.05);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 1.05);
  ctx.lineTo(w * 1.12, -h * 0.05);
  ctx.stroke();

  const wear = fbm2D(w, h, { octaves: 4, frequency: 8, seed: 71 });
  const wc = makeCanvas(w, h);
  const wctx = wc.getContext('2d');
  const wimg = wctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = Math.pow(wear[i], 3) * 0.35;
    wimg.data[i * 4] = 20; wimg.data[i * 4 + 1] = 22; wimg.data[i * 4 + 2] = 24;
    wimg.data[i * 4 + 3] = a * 255;
  }
  wctx.putImageData(wimg, 0, 0);
  ctx.drawImage(wc, 0, 0);

  return toTexture(canvas, { srgb: true });
}

/* ------------------------------------------------------------------ */
/* Zemin (apron asfaltı)                                               */
/* ------------------------------------------------------------------ */

export function createTarmacMaps(size = 1024) {
  const w = size;
  const h = size;
  const coarse = fbm2D(w, h, { octaves: 6, frequency: 8, seed: 5 });
  const fine = fbm2D(w, h, { octaves: 6, frequency: 48, seed: 17 });

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = coarse[i] * 0.55 + fine[i] * 0.45;
    const c = 26 + v * 34;
    img.data[i * 4] = c;
    img.data[i * 4 + 1] = c + 1;
    img.data[i * 4 + 2] = c + 3;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const rough = grayCanvas(fine, w, h, (v) => 0.72 + v * 0.22);
  const normal = heightToNormalTexture(fine, w, h, 1.4);

  return {
    map: toTexture(canvas, { srgb: true, repeat: [8, 8] }),
    roughnessMap: toTexture(rough, { repeat: [8, 8] }),
    normalMap: toTexture(normal, { repeat: [8, 8] }),
  };
}

/* ------------------------------------------------------------------ */
/* Hareket bulanıklığı diski ve ısı gürültüsü                          */
/* ------------------------------------------------------------------ */

/** Yüksek devirde fanın üzerine bindirilen radyal iz dokusu. */
export function createBlurDiscTexture(size = 1024, blades = 22) {
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const c = size / 2;
  const noise = fbm2D(size, size, { octaves: 4, frequency: 30, seed: 23 });

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const i = (y * size + x) * 4;
      if (r > 1) { img.data[i + 3] = 0; continue; }
      // Kanat sayısına bağlı çok ince açısal modülasyon + radyal gradyan
      const band = 0.5 + 0.5 * Math.sin(ang * blades * 2 + r * 6);
      const radial = Math.pow(Math.max(0, 1 - r), 0.35) * Math.min(1, r / 0.18);
      const a = radial * (0.22 + band * 0.16) * (0.65 + noise[y * size + x] * 0.7);
      img.data[i] = 176; img.data[i + 1] = 182; img.data[i + 2] = 190;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Isı dalgalanması ve egzoz türbülansı için sarmalanabilir gürültü. */
export function createNoiseTexture(size = 512, seed = 99) {
  const a = fbm2D(size, size, { octaves: 5, frequency: 6, seed });
  const b = fbm2D(size, size, { octaves: 5, frequency: 11, seed: seed + 1 });
  const c = fbm2D(size, size, { octaves: 4, frequency: 21, seed: seed + 2 });
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = a[i] * 255;
    img.data[i * 4 + 1] = b[i] * 255;
    img.data[i * 4 + 2] = c[i] * 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* Blender'da pişirilmiş kaporta detayları                             */
/* ------------------------------------------------------------------ */

/**
 * blender/nacelle_details.py çıktısını yükler: tanjant uzayı normal haritası
 * ve ORM (R ortam kapanması, G pürüzlülük, B metallik). Haritalar yarım
 * kaporta içindir; çevre boyunca aynalı iki tekrar (sol/sağ kapak) sarılır.
 */
export async function loadNacelleDetail() {
  const loader = new THREE.TextureLoader();
  const [normal, orm] = await Promise.all([
    loader.loadAsync(nacelleNormalUrl),
    loader.loadAsync(nacelleOrmUrl),
  ]);
  for (const tex of [normal, orm]) {
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(2, 1);
    tex.colorSpace = THREE.NoColorSpace;
  }
  return { normal, orm };
}

/**
 * Albedo'nun kopyasına pişirilmiş boşluk gölgesini (derz, perçin çevresi)
 * ve metal bağlantı elemanlarının koyuluğunu işler. AO haritası three.js'te
 * yalnız dolaylı ışığı karartır; doğrudan ışıkta da derzlerin okunması için
 * albedo'ya hafif bir boşluk karartması eklenir.
 */
export function albedoWithCavity(albedo, orm) {
  const src = albedo.image;
  const w = src.width;
  const h = src.height;
  const img = orm.image;
  const tmp = makeCanvas(img.width, img.height);
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  tctx.drawImage(img, 0, 0);
  const data = tctx.getImageData(0, 0, img.width, img.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const ao = px[i] / 255;
    const metal = px[i + 2] / 255;
    const v = 255 * (1 - 0.6 * (1 - ao)) * (1 - 0.3 * metal);
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    px[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);

  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, w / 2, h);
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(tmp, 0, 0, w / 2, h);
  ctx.restore();
  return toTexture(canvas, { srgb: true, aniso: albedo.anisotropy });
}
