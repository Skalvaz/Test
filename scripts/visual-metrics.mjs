/**
 * Görsel ölçümler (T-19): vitrin kadraj setinin karelerinden sayısal
 * kabul ölçütleri.
 *
 *   node scripts/visual-metrics.mjs <küme> [--compare <referans-küme>] [--out sonuç.json]
 *        [--overlay <klasör>] [--gate 0.995] [--only id,…] [--sizes 1280x720,…]
 *
 * <küme>: scripts/capture/vitrin.mjs çıktısı (<küme>/<GxY>/<sahne>.png ve
 * <sahne>.json). ROI'ler sahne tanımlarından (scripts/capture/scenes/vitrin,
 * `roi` ve `roiBySize`) okunur. Arayüz kümesi (<küme>/arayuz/<GxY>/*.png)
 * yalnız karşılaştırmada kullanılır (bütün kare SSIM'i ve piksel farkı).
 *
 * Her kare ve ROI için:
 *   L        ekran parlaklığı: sRGB kodlu değerlerin Rec.709 ağırlıklı
 *            toplamı (0..1, görüntülenen değer; doğrusal ışık değil)
 *   mean, hist (16 kutu), dark10 (L < 0,1), hi98 (L ≥ 0,98),
 *   clip     herhangi bir kanalı ≥ 0,99 olan piksel oranı (kırpılmış)
 *   hue, sat HSV ton (doygunluk·parlaklık ağırlıklı dairesel ortalama, °)
 *            ve ortalama doygunluk
 *   fft      halka ROI'de (type "ring", sahnede `blades`) polar örnekleme:
 *            kanat frekansı bandındaki (k, 2k, 3k ± 2) açısal güç, yalnız k
 *            ve bütün AC gücüne oranı; yarıçaplar üzerinden ortalama
 * Kare başına: nan / inf / neg (kayıt anında WebGL okumasıyla sayılır, yan
 * dosyadan) ve nanLike (karede yalıtık siyah/mor nokta sezgisi; yan dosyası
 * olmayan eski kareler için).
 * --compare: ROI başına ve bütün kare SSIM'i (parlaklık, 7×7 kutu pencere),
 * ortalama/en büyük mutlak fark, değişen piksel oranı.
 * --gate: herhangi bir ROI SSIM'i (arayüz kümesinde bütün kare) eşiğin
 * altındaysa çıkış kodu 1. Karşılaştırılamayan kare de (referansta olup
 * kümede olmayan ya da tersi, boyut farklı; `summary.errors`) kapıdan geçemez.
 * --overlay: ROI'leri kare üstüne çizip <klasör>/<GxY>/<sahne>.png yazar
 * (ROI yerleşimini göz ile doğrulamak için).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const VITRIN_DIR = path.join(here, 'capture', 'scenes', 'vitrin');

/* ------------------------------- okuma ------------------------------- */

/** PNG → { w, h, data: Float32Array RGB 0..1 } */
export async function readImage(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) out[i] = data[i] / 255;
  return { w: info.width, h: info.height, data: out };
}

export function luma(img) {
  const n = img.w * img.h;
  const L = new Float32Array(n);
  const d = img.data;
  for (let i = 0; i < n; i++) L[i] = 0.2126 * d[i * 3] + 0.7152 * d[i * 3 + 1] + 0.0722 * d[i * 3 + 2];
  return L;
}

/** Vitrin sahneleri: id → { scene, roi(size) } (varyantlar sahnenin ROI'sini paylaşır) */
export function loadScenes() {
  const map = new Map();
  if (!fs.existsSync(VITRIN_DIR)) return map;
  const index = JSON.parse(fs.readFileSync(path.join(VITRIN_DIR, 'index.json'), 'utf8'));
  for (const id of index.sahneler) {
    const sc = JSON.parse(fs.readFileSync(path.join(VITRIN_DIR, `${id}.json`), 'utf8'));
    const entry = { scene: sc, roiFor: (size) => ({ ...(sc.roi ?? {}), ...(sc.roiBySize?.[size] ?? {}) }) };
    map.set(sc.id, entry);
    for (const v of sc.variants ?? []) map.set(`${sc.id}${v.suffix}`, entry);
  }
  return map;
}

/* ------------------------------- ROI ------------------------------- */

/** Şekil (normalize koordinat) → piksel testi */
function shapeTest(sh, w, h) {
  if (Array.isArray(sh)) sh = { type: 'rect', x0: sh[0], y0: sh[1], x1: sh[2], y1: sh[3] };
  switch (sh.type) {
    case 'rect': {
      const x0 = sh.x0 * w;
      const x1 = sh.x1 * w;
      const y0 = sh.y0 * h;
      const y1 = sh.y1 * h;
      return (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
    }
    case 'poly': {
      const p = sh.pts.map(([x, y]) => [x * w, y * h]);
      return (x, y) => {
        let inside = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
          const [xi, yi] = p[i];
          const [xj, yj] = p[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      };
    }
    case 'ellipse':
    case 'ring': {
      const cx = sh.cx * w;
      const cy = sh.cy * h;
      const rx = sh.rx * w;
      const ry = sh.ry * h;
      const a = ((sh.rot ?? 0) * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const r0 = sh.type === 'ring' ? (sh.r0 ?? 0) : 0;
      const r1 = sh.type === 'ring' ? (sh.r1 ?? 1) : 1;
      return (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * ca + dy * sa) / rx;
        const v = (-dx * sa + dy * ca) / ry;
        const rho = Math.sqrt(u * u + v * v);
        return rho >= r0 && rho <= r1;
      };
    }
    default:
      throw new Error(`Bilinmeyen ROI şekli: ${sh.type}`);
  }
}

/** ROI → Uint8Array maske (piksel merkezleri) */
export function roiMask(roi, w, h) {
  const inc = shapeTest(roi.shape ?? roi, w, h);
  const exc = (roi.exclude ?? []).map((s) => shapeTest(s, w, h));
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (inc(px, py) && !exc.some((t) => t(px, py))) m[y * w + x] = 1;
    }
  }
  return m;
}

/* ------------------------------ ölçümler ------------------------------ */

const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : v);

/** Bölge istatistikleri (maske null → bütün kare) */
export function regionStats(img, L, mask) {
  const n = img.w * img.h;
  const d = img.data;
  let cnt = 0;
  let sum = 0;
  let dark = 0;
  let hi = 0;
  let clip = 0;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  let ssat = 0;
  const hist = new Array(16).fill(0);
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    cnt++;
    const l = L[i];
    sum += l;
    if (l < 0.1) dark++;
    if (l >= 0.98) hi++;
    hist[Math.min(15, Math.floor(l * 16))]++;
    const r = d[i * 3];
    const g = d[i * 3 + 1];
    const b = d[i * 3 + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    if (mx >= 0.99) clip++;
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    ssat += sat;
    if (mx > mn) {
      let hh;
      if (mx === r) hh = ((g - b) / (mx - mn)) % 6;
      else if (mx === g) hh = (b - r) / (mx - mn) + 2;
      else hh = (r - g) / (mx - mn) + 4;
      const ang = (hh * Math.PI) / 3;
      const wgt = sat * mx;
      sx += Math.cos(ang) * wgt;
      sy += Math.sin(ang) * wgt;
      sw += wgt;
    }
  }
  if (!cnt) return { px: 0 };
  let hue = sw > 1e-9 ? (Math.atan2(sy, sx) * 180) / Math.PI : null;
  if (hue !== null && hue < 0) hue += 360;
  return {
    px: cnt,
    mean: r4(sum / cnt),
    dark10: r4(dark / cnt),
    hi98: r4(hi / cnt),
    clip: r4(clip / cnt),
    hue: hue === null ? null : +hue.toFixed(1),
    hueStrength: r4(sw / cnt),
    sat: r4(ssat / cnt),
    hist: hist.map((c) => r4(c / cnt)),
  };
}

/**
 * Yalıtık siyah/mor nokta sezgisi (NaN izleri): neredeyse siyah ya da
 * yeşili bastırılmış mor piksel ve 8 komşusunun ortalama parlaklığı ≥ 0,2
 * fazlası. Kayıt anındaki WebGL sayımının (yan dosya) yerine geçmez.
 */
export function nanLike(img, L) {
  const { w, h, data: d } = img;
  let c = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const r = d[i * 3];
      const g = d[i * 3 + 1];
      const b = d[i * 3 + 2];
      const black = Math.max(r, g, b) < 0.03;
      const purple = r > 0.3 && b > 0.3 && g < 0.5 * Math.min(r, b);
      if (!black && !purple) continue;
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += L[i + dy * w + dx];
      if (s / 8 - L[i] >= 0.2) c++;
    }
  }
  return c;
}

/** Bilineer örnekleme (parlaklık) */
function sample(L, w, h, x, y) {
  const x0 = Math.max(0, Math.min(w - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 2, Math.floor(y)));
  const fx = Math.min(1, Math.max(0, x - x0));
  const fy = Math.min(1, Math.max(0, y - y0));
  const i = y0 * w + x0;
  return (L[i] * (1 - fx) + L[i + 1] * fx) * (1 - fy) + (L[i + w] * (1 - fx) + L[i + w + 1] * fx) * fy;
}

/**
 * Halka ROI'de polar FFT: elips açısına göre N noktada örnekler (afin
 * eşlemede kanat sayısı korunur) ve her yarıçapta açısal güç spektrumunu
 * çıkarır. `band`: kanat frekansı ve iki harmoniği çevresindeki güç
 * (k, 2k, 3k ± 2; elips/perspektif sızıntısını toplar), `power`: yalnız k,
 * `rel`: band / bütün AC gücü. Durağan disk farklı dönme açılarında band
 * gücü ±%30 oynar (322 rölanti/tam güç, bugün); dönme bulanıklığı ölçütü
 * (1I: tam güçte ≥ %70 düşüş) bunun üstünde anlamlıdır.
 */
export function polarFft(L, w, h, sh, blades, { N = 512, radii = 24 } = {}) {
  const cx = sh.cx * w;
  const cy = sh.cy * h;
  const rx = sh.rx * w;
  const ry = sh.ry * h;
  const a = ((sh.rot ?? 0) * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r0 = sh.r0 ?? 0.4;
  const r1 = sh.r1 ?? 0.95;
  const row = new Float64Array(N);
  const cos = new Float64Array(N);
  const sin = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / N);
    sin[i] = Math.sin((2 * Math.PI * i) / N);
  }
  const bandBins = new Set();
  for (const c of [blades, 2 * blades, 3 * blades]) for (let m = c - 2; m <= c + 2; m++) if (m >= 1 && m <= N / 2) bandBins.add(m);
  let pk = 0;
  let band = 0;
  let total = 0;
  let used = 0;
  for (let j = 0; j < radii; j++) {
    const t = r0 + ((r1 - r0) * (j + 0.5)) / radii;
    let mean = 0;
    let ok = true;
    for (let i = 0; i < N; i++) {
      const u = t * rx * cos[i];
      const v = t * ry * sin[i];
      const x = cx + u * ca - v * sa;
      const y = cy + u * sa + v * ca;
      if (x < 0 || y < 0 || x > w - 1 || y > h - 1) ok = false;
      row[i] = sample(L, w, h, x, y);
      mean += row[i];
    }
    if (!ok) continue;
    mean /= N;
    for (let m = 1; m <= N / 2; m++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < N; i++) {
        const k = (m * i) % N;
        re += (row[i] - mean) * cos[k];
        im -= (row[i] - mean) * sin[k];
      }
      const p = (re * re + im * im) / (N * N);
      total += p;
      if (m === blades) pk += p;
      if (bandBins.has(m)) band += p;
    }
    used++;
  }
  if (!used) return { blades, radii: 0 };
  const e = (v) => +(v / used).toExponential(4);
  return { blades, radii: used, band: e(band), power: e(pk), ac: e(total), rel: r4(band / Math.max(total, 1e-12)) };
}

/** Kutu pencereli SSIM haritası için integral görüntüler */
function integral(a, w, h) {
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += a[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
    }
  }
  return I;
}

/** İki parlaklık görüntüsünün SSIM'i; maskeler başına ortalama (null: bütün kare) */
export function ssimByMask(A, B, w, h, masks, win = 7) {
  const AA = new Float32Array(A.length);
  const BB = new Float32Array(A.length);
  const AB = new Float32Array(A.length);
  for (let i = 0; i < A.length; i++) {
    AA[i] = A[i] * A[i];
    BB[i] = B[i] * B[i];
    AB[i] = A[i] * B[i];
  }
  const Ia = integral(A, w, h);
  const Ib = integral(B, w, h);
  const Iaa = integral(AA, w, h);
  const Ibb = integral(BB, w, h);
  const Iab = integral(AB, w, h);
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  const rr = Math.floor(win / 2);
  const W1 = w + 1;
  const box = (I, x0, y0, x1, y1) => I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
  const out = {};
  const acc = Object.fromEntries(Object.keys(masks).map((k) => [k, [0, 0]]));
  const keys = Object.keys(masks);
  for (let y = rr; y < h - rr; y++) {
    for (let x = rr; x < w - rr; x++) {
      const i = y * w + x;
      let any = false;
      for (const k of keys) if (!masks[k] || masks[k][i]) any = true;
      if (!any) continue;
      const x0 = x - rr;
      const y0 = y - rr;
      const x1 = x + rr + 1;
      const y1 = y + rr + 1;
      const n = win * win;
      const ma = box(Ia, x0, y0, x1, y1) / n;
      const mb = box(Ib, x0, y0, x1, y1) / n;
      const va = Math.max(0, box(Iaa, x0, y0, x1, y1) / n - ma * ma);
      const vb = Math.max(0, box(Ibb, x0, y0, x1, y1) / n - mb * mb);
      const cov = box(Iab, x0, y0, x1, y1) / n - ma * mb;
      const s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      for (const k of keys) {
        if (masks[k] && !masks[k][i]) continue;
        acc[k][0] += s;
        acc[k][1]++;
      }
    }
  }
  for (const k of keys) out[k] = acc[k][1] ? +(acc[k][0] / acc[k][1]).toFixed(5) : null;
  return out;
}

/** Piksel farkı (RGB 0..1) */
function pixelDiff(a, b, mask) {
  let sum = 0;
  let max = 0;
  let changed = 0;
  let cnt = 0;
  const n = a.w * a.h;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    cnt++;
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.data[i * 3 + c] - b.data[i * 3 + c]));
    sum += m;
    if (m > max) max = m;
    if (m > 1.5 / 255) changed++;
  }
  return { meanAbs: r4(sum / Math.max(cnt, 1)), maxAbs: r4(max), changed: r4(changed / Math.max(cnt, 1)) };
}

/* ------------------------------ kaplama ------------------------------ */

const COLORS = ['#ff4d3d', '#2ee6d6', '#ffb020', '#3ddc84', '#ff5cf0', '#7fa7c9', '#f2c14e', '#e8eef4'];

function shapeSvg(sh, w, h, color) {
  if (Array.isArray(sh)) sh = { type: 'rect', x0: sh[0], y0: sh[1], x1: sh[2], y1: sh[3] };
  const st = `fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2"`;
  if (sh.type === 'rect') return `<rect x="${sh.x0 * w}" y="${sh.y0 * h}" width="${(sh.x1 - sh.x0) * w}" height="${(sh.y1 - sh.y0) * h}" ${st}/>`;
  if (sh.type === 'poly') return `<polygon points="${sh.pts.map(([x, y]) => `${x * w},${y * h}`).join(' ')}" ${st}/>`;
  const rot = `rotate(${sh.rot ?? 0} ${sh.cx * w} ${sh.cy * h})`;
  const el = (k) => `<ellipse cx="${sh.cx * w}" cy="${sh.cy * h}" rx="${sh.rx * w * k}" ry="${sh.ry * h * k}" transform="${rot}" ${st}/>`;
  return sh.type === 'ring' ? el(sh.r1 ?? 1) + el(sh.r0 ?? 0).replace('fill-opacity="0.18"', 'fill-opacity="0"') : el(1);
}

async function writeOverlay(file, out, rois, w, h) {
  let i = 0;
  const parts = [];
  for (const [name, roi] of Object.entries(rois)) {
    const c = COLORS[i++ % COLORS.length];
    const sh = roi.shape ?? roi;
    parts.push(shapeSvg(sh, w, h, c));
    for (const ex of roi.exclude ?? []) parts.push(shapeSvg(ex, w, h, '#000'));
    const ax = Array.isArray(sh) ? sh[0] : sh.x0 ?? sh.cx ?? sh.pts?.[0]?.[0] ?? 0;
    const ay = Array.isArray(sh) ? sh[1] : sh.y0 ?? sh.cy ?? sh.pts?.[0]?.[1] ?? 0;
    parts.push(`<text x="${ax * w + 4}" y="${ay * h + 16}" font-family="Segoe UI, Arial" font-size="${Math.round(h / 45)}" font-weight="bold" fill="${c}" stroke="#000" stroke-width="0.6">${name}</text>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${parts.join('')}</svg>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(file).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(out);
}

/* ------------------------------- ana ------------------------------- */

const listPng = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);
const sizeDirs = (root) => (fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^\d+x\d+$/.test(d)).sort() : []);

export async function measureSet(root, { ref = null, overlay = null, only = null, sizes = null } = {}) {
  const scenes = loadScenes();
  const frames = {};
  for (const size of sizeDirs(root)) {
    if (sizes && !sizes.includes(size)) continue;
    for (const f of listPng(path.join(root, size))) {
      const id = f.slice(0, -4);
      if (only && !only.some((o) => id === o || id.startsWith(`${o}-`))) continue;
      const file = path.join(root, size, f);
      const img = await readImage(file);
      const L = luma(img);
      const side = path.join(root, size, `${id}.json`);
      const meta = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, 'utf8')) : null;
      const entry = scenes.get(id);
      const rois = entry ? entry.roiFor(size) : {};
      const masks = Object.fromEntries(Object.entries(rois).map(([k, r]) => [k, roiMask(r, img.w, img.h)]));
      const rec = {
        size,
        nan: meta?.nan ?? null,
        inf: meta?.inf ?? null,
        neg: meta?.neg ?? null,
        nanLike: nanLike(img, L),
        kare: regionStats(img, L, null),
        roi: {},
      };
      for (const [k, m] of Object.entries(masks)) {
        rec.roi[k] = regionStats(img, L, m);
        const sh = rois[k].shape ?? rois[k];
        if (sh.type === 'ring' && entry?.scene.blades) rec.roi[k].fft = polarFft(L, img.w, img.h, sh, entry.scene.blades);
      }
      if (ref) {
        const rf = path.join(ref, size, f);
        if (fs.existsSync(rf)) {
          const rimg = await readImage(rf);
          if (rimg.w === img.w && rimg.h === img.h) {
            rec.ssim = ssimByMask(luma(rimg), L, img.w, img.h, { kare: null, ...masks });
            rec.diff = pixelDiff(rimg, img, null);
          } else rec.ssim = { hata: `boyut farklı ${rimg.w}x${rimg.h}` };
        } else rec.ssim = { hata: 'referans kare yok' };
      }
      if (overlay) await writeOverlay(file, path.join(overlay, size, f), rois, img.w, img.h);
      frames[`${size}/${id}`] = rec;
    }
  }
  // Referansta olup kümede olmayan kareler (kayıt yarıda kaldı, sahne
  // düştü): kapı bunları sessizce geçmesin
  if (ref) {
    for (const size of sizeDirs(ref)) {
      if (sizes && !sizes.includes(size)) continue;
      for (const f of listPng(path.join(ref, size))) {
        const id = f.slice(0, -4);
        if (only && !only.some((o) => id === o || id.startsWith(`${o}-`))) continue;
        if (!frames[`${size}/${id}`]) frames[`${size}/${id}`] = { size, ssim: { hata: 'kümede kare yok' } };
      }
    }
  }
  // Arayüz kümesi: yalnız karşılaştırma
  const ui = {};
  if (ref) {
    for (const size of new Set([...sizeDirs(path.join(ref, 'arayuz')), ...sizeDirs(path.join(root, 'arayuz'))])) {
      for (const f of listPng(path.join(ref, 'arayuz', size))) {
        if (!fs.existsSync(path.join(root, 'arayuz', size, f))) ui[`${size}/${f.slice(0, -4)}`] = { hata: 'kümede kare yok' };
      }
      for (const f of listPng(path.join(root, 'arayuz', size))) {
        const rf = path.join(ref, 'arayuz', size, f);
        if (!fs.existsSync(rf)) {
          ui[`${size}/${f.slice(0, -4)}`] = { hata: 'referans kare yok' };
          continue;
        }
        const a = await readImage(rf);
        const b = await readImage(path.join(root, 'arayuz', size, f));
        if (a.w !== b.w || a.h !== b.h) {
          ui[`${size}/${f.slice(0, -4)}`] = { hata: 'boyut farklı' };
          continue;
        }
        ui[`${size}/${f.slice(0, -4)}`] = { ssim: ssimByMask(luma(a), luma(b), a.w, a.h, { kare: null }).kare, diff: pixelDiff(a, b, null) };
      }
    }
  }
  return { frames, ui };
}

function summarize({ frames, ui }) {
  const rows = [];
  for (const [k, r] of Object.entries(frames)) {
    if (!r.ssim || r.ssim.hata) continue;
    for (const [roi, v] of Object.entries(r.ssim)) if (v !== null) rows.push({ kare: k, roi, ssim: v });
  }
  rows.sort((a, b) => a.ssim - b.ssim);
  const uiRows = Object.entries(ui)
    .filter(([, v]) => !v.hata)
    .map(([k, v]) => ({ kare: k, ssim: v.ssim, changed: v.diff.changed }))
    .sort((a, b) => a.ssim - b.ssim);
  const nan = Object.entries(frames).map(([k, r]) => [k, r.nan]);
  // Karşılaştırılamayan kareler (eksik, boyut farklı): kapıdan geçemez
  const errors = [
    ...Object.entries(frames)
      .filter(([, r]) => r.ssim?.hata)
      .map(([k, r]) => `${k}: ${r.ssim.hata}`),
    ...Object.entries(ui)
      .filter(([, v]) => v.hata)
      .map(([k, v]) => `arayuz/${k}: ${v.hata}`),
  ];
  return {
    errors,
    minRoiSsim: rows.length ? rows[0].ssim : null,
    worstRoi: rows.slice(0, 8),
    minUiSsim: uiRows.length ? uiRows[0].ssim : null,
    worstUi: uiRows.slice(0, 5),
    nanTotal: nan.reduce((s, [, v]) => s + (v ?? 0), 0),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
  };
  const valued = new Set(['--compare', '--out', '--overlay', '--gate', '--only', '--sizes']);
  const pos = args.filter((s, i) => !s.startsWith('--') && !valued.has(args[i - 1]));
  const root = pos[0];
  if (!root) {
    console.error('Kullanım: node scripts/visual-metrics.mjs <küme> [--compare <referans>] [--out x.json] [--overlay klasör] [--gate 0.995]');
    process.exit(1);
  }
  const t0 = Date.now();
  const res = await measureSet(root, {
    ref: opt('--compare'),
    overlay: opt('--overlay'),
    only: opt('--only')?.split(',') ?? null,
    sizes: opt('--sizes')?.split(',') ?? null,
  });
  const summary = summarize(res);
  const out = { tool: 'visual-metrics', version: 1, set: root, ref: opt('--compare'), when: new Date().toISOString(), summary, ...res };
  if (opt('--out')) {
    fs.mkdirSync(path.dirname(path.resolve(opt('--out'))), { recursive: true });
    fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 2));
  }
  console.log(JSON.stringify(summary, null, 2));
  console.log(`${Object.keys(res.frames).length} kare, ${Object.keys(res.ui).length} arayüz karesi, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const gate = opt('--gate');
  if (gate) {
    const g = Number(gate);
    if (!opt('--compare') || summary.minRoiSsim === null) {
      console.error('EŞİK: --gate için --compare <referans> ve en az bir ortak kare gerekir');
      process.exit(1);
    }
    if (summary.errors.length) {
      console.error(`EŞİK: ${summary.errors.length} kare karşılaştırılamadı:\n  ${summary.errors.slice(0, 20).join('\n  ')}`);
      process.exit(1);
    }
    const bad = summary.minRoiSsim < g || (summary.minUiSsim !== null && summary.minUiSsim < g);
    if (bad) {
      console.error(`EŞİK: en düşük SSIM ${summary.minRoiSsim} / arayüz ${summary.minUiSsim} < ${g}`);
      process.exit(1);
    }
    console.log(`Eşik ${g}: geçti`);
  }
}
