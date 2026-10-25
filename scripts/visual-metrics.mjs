/**
 * Görsel ölçümler (T-19): vitrin kadraj setinin karelerinden sayısal
 * kabul ölçütleri.
 *
 *   node scripts/visual-metrics.mjs <küme> [--compare <referans-küme>] [--out sonuç.json]
 *        [--overlay <klasör>] [--gate 0.995] [--exact | --max-changed N] [--changed-tol 2.5]
 *        [--exclude-nan] [--only id,…] [--sizes 1280x720,…]
 *
 * <küme>: scripts/capture/vitrin.mjs çıktısı (<küme>/<GxY>/<sahne>.png ve
 * <sahne>.json). ROI'ler sahne tanımlarından (scripts/capture/scenes/vitrin,
 * `roi` ve `roiBySize`) okunur. Arayüz kümesi (<küme>/arayuz/<GxY>/*.png)
 * yalnız karşılaştırmada kullanılır (bütün kare SSIM'i ve piksel farkı).
 *
 * Her kare ve ROI için:
 *   L        ekran parlaklığı: sRGB kodlu değerlerin Rec.709 ağırlıklı
 *            toplamı (0..1, görüntülenen değer; doğrusal ışık değil)
 *   mean, hist (16 kutu), dark10 (L < 0,1), hi90 (L ≥ 0,9), hi98 (L ≥ 0,98),
 *   lstd     parlaklığın standart sapması
 *   hf       ayrıntı enerjisi: L'nin 5×5 yerel ortalamadan farkının RMS'i
 *            (krom aynadaki keskin çevre yansıması yüksek, fırçalanmış/saten
 *            yüzey düşük; 1F speküler ölçütü)
 *   clip     herhangi bir kanalı ≥ 0,99 olan piksel oranı (kırpılmış)
 *   hue, sat HSV ton (doygunluk·parlaklık ağırlıklı dairesel ortalama, °)
 *            ve ortalama doygunluk
 *   fft      halka ROI'de (type "ring" ya da "disk", sahnede `blades`) polar örnekleme.
 *            "disk": dünya uzayında rotor düzlemi (center, axis, r0, r1 [m]),
 *            kayıttaki kamerayla izdüşürülür: açı rotorun kendi açısıdır,
 *            kanat aralığı perspektifte de eşittir (elips halka eksen dışı
 *            kamerada kanat frekansını yayar);
 *            (ROI'nin `exclude` şekilleri örneklenmez, boşluk kenarları
 *            yumuşatılır): yarıçaplar üzerinden ortalama açısal güç
 *            spektrumunda `peak` = kanat frekansı tepe fazlalığı (k, 2k, 3k
 *            çevresindeki ±2 kutunun gücü − 5 × k±3..8 kutularının medyanı;
 *            geniş bantlı taban ve dönmeyen yapı düşülür), `peakK` yalnız k;
 *            eski `band` (k, 2k, 3k ± 2 toplam güç), `power`, `ac`, `rel`
 * ROI şekli `maskFrom` { frame, minDiff? }: aynı kümede, aynı durumun kesit
 * kapağı anahtar renkle (yeşil) çizilmiş eşinden (ör. 326-kesit-kapak)
 * kapak pikselleri: anahtar karede yeşil baskın ve bu kareden farklı olanlar.
 * ROI olarak (kapağın kendisi) ya da `exclude` içinde (kızıllıktan kapağı
 * düşmek için) kullanılır. Anahtar kare yoksa boş maske.
 * Kare başına: nan / inf / neg (kayıt anında WebGL okumasıyla sayılır, yan
 * dosyadan) ve nanLike (karede yalıtık siyah/mor nokta sezgisi; yan dosyası
 * olmayan eski kareler için).
 * --compare: ROI başına ve bütün kare SSIM'i (parlaklık, 7×7 kutu pencere),
 * bütün karede renk kanallarının en düşük SSIM'i (`kareRgb`; yalnız rengi
 * değişen regresyon parlaklıkta görünmez), ortalama/en büyük mutlak fark,
 * değişen piksel oranı (`changed`, > 1,5/255) ve sayısı (`changedPx`, en
 * büyük kanal farkı > --changed-tol/255, varsayılan 2,5: gürültü tabanının
 * üstü).
 * --exclude-nan: kayıt anındaki NaN/sonsuz/negatif piksel maskeleri
 * (<küme>/<GxY>/_nan/<sahne>.png, iki kümenin birleşimi) 7×7 genişletilip
 * SSIM'den ve piksel farkından dışlanır (1A: NaN giderilince görüntü doğru
 * olsa da o bölgelerin SSIM'i düşer).
 * --gate: herhangi bir ROI SSIM'i ya da kare RGB SSIM'i (arayüz kümesinde
 * bütün kare) eşiğin altındaysa çıkış kodu 1. Karşılaştırılamayan kare de
 * (referansta olup kümede olmayan ya da tersi, boyut farklı;
 * `summary.errors`) kapıdan geçemez. --max-changed N: herhangi bir karede
 * (vitrin ve arayüz) changedPx > N ise çıkış kodu 1; --exact = N 0
 * ("görüntü değişmez" adımları: CSS bölmesi, sözleşme taşımaları).
 * --overlay: ROI'leri kare üstüne çizip <klasör>/<GxY>/<sahne>.png yazar
 * (ROI yerleşimini göz ile doğrulamak için).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as THREE from 'three';

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

/**
 * Sahne tanımı: `extends` başka bir sahnenin alanlarını devralır (id,
 * açıklama ve varyantlar hariç; ölçüm tabanı sahneleri). scripts/capture/
 * vitrin.mjs ile aynı kural.
 */
export function readScene(id, dir = VITRIN_DIR) {
  const sc = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
  if (!sc.extends) return sc;
  const base = readScene(sc.extends, dir);
  const { variants: _v, desc: _d, galeri: _g, ...inherit } = base;
  return { ...inherit, ...sc };
}

/**
 * Vitrin sahneleri: id → { scene, roi(size) }. Varyantlar sahnenin ROI'sini
 * paylaşır; varyant kendi `roi`/`roiBySize`'ını verirse onunki geçer.
 */
export function loadScenes() {
  const map = new Map();
  if (!fs.existsSync(VITRIN_DIR)) return map;
  const index = JSON.parse(fs.readFileSync(path.join(VITRIN_DIR, 'index.json'), 'utf8'));
  const roiOf = (o, size) => ({ ...(o.roi ?? {}), ...(o.roiBySize?.[size] ?? {}) });
  for (const id of index.sahneler) {
    const sc = readScene(id);
    map.set(sc.id, { scene: sc, roiFor: (size) => roiOf(sc, size) });
    for (const v of sc.variants ?? []) {
      const own = v.roi || v.roiBySize;
      map.set(`${sc.id}${v.suffix}`, { scene: { ...sc, ...v }, roiFor: (size) => (own ? roiOf(v, size) : roiOf(sc, size)) });
    }
  }
  return map;
}

/* ------------------------------- ROI ------------------------------- */

/** Şekil (normalize koordinat) → piksel testi */
export function shapeTest(sh, w, h) {
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
    case 'bitmap':
      return (x, y) => sh.mask[Math.floor(y) * sh.w + Math.floor(x)] === 1;
    case 'maskFrom':
      throw new Error('maskFrom şekli önce çözülmeli (resolveMaskFrom)');
    case 'polyRing': {
      const outer = shapeTest({ type: 'poly', pts: sh.outer }, w, h);
      const inner = shapeTest({ type: 'poly', pts: sh.inner }, w, h);
      return (x, y) => outer(x, y) && !inner(x, y);
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

/**
 * Kaydın kamerası: yan dosyadaki konum ve yönelim (yoksa sahnenin cam/tgt'si),
 * görüş açısı; kayıt panelsiz (setViewOffset birim) olduğundan izdüşüm tam.
 */
export function shotCamera(scene, meta, w, h) {
  // Kadrajı sahneyle kurulmayan kare (menü açısı) ve yönelimsiz eski yan dosya: izdüşüm yok
  if (!meta?.camera?.quaternion && !(scene.cam && scene.tgt)) return null;
  const cam = new THREE.PerspectiveCamera(meta?.camera?.fov ?? scene.fov ?? 36, w / h, 0.1, 14000);
  if (meta?.camera?.position) cam.position.fromArray(meta.camera.position);
  else cam.position.fromArray(scene.cam);
  if (meta?.camera?.quaternion) cam.quaternion.fromArray(meta.camera.quaternion);
  else cam.lookAt(new THREE.Vector3(...scene.tgt));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

/** Disk (dünya uzayında daire) → (t [m], açı) → piksel izdüşümü */
export function diskProjector(sh, cam, w, h) {
  const c = new THREE.Vector3(...sh.center);
  const ax = new THREE.Vector3(...(sh.axis ?? [0, 0, 1])).normalize();
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(u.dot(ax)) > 0.9) u.set(0, 1, 0);
  u.addScaledVector(ax, -u.dot(ax)).normalize();
  const v = new THREE.Vector3().crossVectors(ax, u);
  const p = new THREE.Vector3();
  return (t, ang) => {
    p.copy(c).addScaledVector(u, t * Math.cos(ang)).addScaledVector(v, t * Math.sin(ang)).project(cam);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h];
  };
}

/** Disk ROI → normalize çokgen halka (maske ve kaplama için) */
function diskToPolyRing(sh, cam, w, h, n = 192) {
  const proj = diskProjector(sh, cam, w, h);
  const circle = (t) => Array.from({ length: n }, (_, i) => {
    const [x, y] = proj(t, (2 * Math.PI * i) / n);
    return [x / w, y / h];
  });
  return { type: 'polyRing', outer: circle(sh.r1), inner: circle(sh.r0) };
}

/**
 * `maskFrom` şekli → bitmap: anahtar renkli karede yeşil baskın (G − max(R, B)
 * > 0,15) ve bu kareden en büyük kanal farkı > minDiff olan pikseller.
 */
export async function resolveMaskFrom(sh, img, setDir, cache) {
  const file = path.join(setDir, `${sh.frame}.png`);
  if (!cache.has(file)) cache.set(file, fs.existsSync(file) ? await readImage(file) : null);
  const key = cache.get(file);
  const n = img.w * img.h;
  const mask = new Uint8Array(n);
  let count = 0;
  if (key && key.w === img.w && key.h === img.h) {
    const minDiff = sh.minDiff ?? 0.06;
    for (let i = 0; i < n; i++) {
      const r = key.data[i * 3];
      const g = key.data[i * 3 + 1];
      const b = key.data[i * 3 + 2];
      if (g - Math.max(r, b) <= 0.15) continue;
      let m = 0;
      for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(key.data[i * 3 + c] - img.data[i * 3 + c]));
      if (m > minDiff) {
        mask[i] = 1;
        count++;
      }
    }
  }
  return { type: 'bitmap', mask, w: img.w, h: img.h, from: sh.frame, px: count, missing: !key };
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

/** Kutu ortalaması (integral görüntüden), kenarda kırpılmış pencere */
function boxMean(I, w, h, x, y, r) {
  const x0 = Math.max(0, x - r);
  const y0 = Math.max(0, y - r);
  const x1 = Math.min(w, x + r + 1);
  const y1 = Math.min(h, y + r + 1);
  const W1 = w + 1;
  return (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0));
}

/**
 * Bölge istatistikleri (maske null → bütün kare). `IL`: parlaklığın
 * integral görüntüsü (hf için; verilmezse hf hesaplanmaz).
 */
export function regionStats(img, L, mask, IL = null) {
  const n = img.w * img.h;
  const d = img.data;
  let cnt = 0;
  let sum = 0;
  let sum2 = 0;
  let hfSum = 0;
  let hi90 = 0;
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
    sum2 += l * l;
    if (l < 0.1) dark++;
    if (l >= 0.9) hi90++;
    if (l >= 0.98) hi++;
    if (IL) {
      const dl = l - boxMean(IL, img.w, img.h, i % img.w, Math.floor(i / img.w), 2);
      hfSum += dl * dl;
    }
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
  const mean = sum / cnt;
  return {
    px: cnt,
    mean: r4(mean),
    lstd: r4(Math.sqrt(Math.max(0, sum2 / cnt - mean * mean))),
    ...(IL ? { hf: r4(Math.sqrt(hfSum / cnt)) } : {}),
    dark10: r4(dark / cnt),
    hi90: r4(hi90 / cnt),
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

/** Medyan */
const median = (xs) => {
  const a = [...xs].sort((p, q) => p - q);
  const m = a.length >> 1;
  return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : 0;
};

/**
 * Kanat frekansı tepe fazlalığı: c çevresindeki ±2 kutunun gücü − 5 ×
 * (c±3..8 kutularının medyanı). Geniş bantlı taban (elips/perspektif
 * sızıntısı, görüntü dokusu) ve tek tük dönmeyen yapı bileşenleri düşülür.
 */
export function peakExcess(P, c) {
  let peak = 0;
  for (let m = c - 2; m <= c + 2; m++) if (m >= 1 && m < P.length) peak += P[m];
  const side = [];
  for (let d = 3; d <= 8; d++) for (const m of [c - d, c + d]) if (m >= 1 && m < P.length) side.push(P[m]);
  const floor = median(side);
  return { excess: Math.max(0, peak - 5 * floor), peak, floor };
}

/**
 * Halka ROI'de polar FFT: elips açısına göre N noktada örnekler (afin
 * eşlemede kanat sayısı korunur) ve her yarıçapta açısal güç spektrumunu
 * çıkarır; spektrumlar yarıçaplar üzerinden ortalanır.
 *
 * `exclude` (piksel testleri): bu noktalar örneklenmez (göbek, gövde,
 * sehpa); boşluk kenarları N/32 örneklik yükseltilmiş kosinüsle yumuşatılır
 * (Hann kenarı: kesik sızıntısı yok). Boşluksuz tam halka zaten periyodiktir,
 * pencere gerekmez (ağırlık 1). Geçerli örneği yarıdan az olan yarıçap atlanır.
 *
 * Çıktı: `peak` (k, 2k, 3k tepe fazlalıklarının toplamı; peakExcess),
 * `peakK` (yalnız k), `floorK` (k'nin taban medyanı), eski ölçüler `band`
 * (k, 2k, 3k ± 2 toplam güç), `power` (k), `ac` (bütün AC), `rel` (band/ac).
 * 1I ölçütü taban kareyle (kanatlar gizli) oranlanır: (tam − taban) /
 * (rölanti − taban).
 */
export function polarFft(L, w, h, sh, blades, { N = 512, radii = 24, exclude = [], camera = null } = {}) {
  const proj = sh.type === 'disk' ? diskProjector(sh, camera, w, h) : null;
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
  const wgt = new Float64Array(N);
  const at = (t, i) => {
    if (proj) return proj(t, (2 * Math.PI * i) / N);
    const u = t * rx * cos[i];
    const v = t * ry * sin[i];
    return [cx + u * ca - v * sa, cy + u * sa + v * ca];
  };
  const valid = new Uint8Array(N);
  const cos = new Float64Array(N);
  const sin = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / N);
    sin[i] = Math.sin((2 * Math.PI * i) / N);
  }
  const M = N / 2;
  const spec = new Float64Array(M + 1);
  const T = Math.max(2, Math.round(N / 32));
  let used = 0;
  let validFrac = 0;
  for (let j = 0; j < radii; j++) {
    const t = r0 + ((r1 - r0) * (j + 0.5)) / radii;
    let nValid = 0;
    for (let i = 0; i < N; i++) {
      const [x, y] = at(t, i);
      const ok = !(x < 0 || y < 0 || x > w - 1 || y > h - 1) && !exclude.some((f) => f(x + 0.5, y + 0.5));
      valid[i] = ok ? 1 : 0;
      row[i] = ok ? sample(L, w, h, x, y) : 0;
      nValid += valid[i];
    }
    if (nValid < N / 2) continue;
    // Ağırlık: boşluğa uzaklığa göre yükseltilmiş kosinüs (boşluk yoksa 1)
    if (nValid === N) wgt.fill(1);
    else {
      for (let i = 0; i < N; i++) {
        if (!valid[i]) {
          wgt[i] = 0;
          continue;
        }
        let d = 1;
        while (d < T && valid[(i + d) % N] && valid[(i - d + N) % N]) d++;
        wgt[i] = d >= T ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * d) / T);
      }
    }
    let sw = 0;
    let sw2 = 0;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      sw += wgt[i];
      sw2 += wgt[i] * wgt[i];
      mean += wgt[i] * row[i];
    }
    mean /= sw;
    for (let m = 1; m <= M; m++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < N; i++) {
        if (!wgt[i]) continue;
        const k = (m * i) % N;
        const y = wgt[i] * (row[i] - mean);
        re += y * cos[k];
        im -= y * sin[k];
      }
      // Boşluksuzda |X|²/N² (eski ölçüyle aynı); ağırlıkta enerji düzeltmesi
      spec[m] += (re * re + im * im) / (N * sw2);
    }
    used++;
    validFrac += nValid / N;
  }
  if (!used) return { blades, radii: 0 };
  for (let m = 1; m <= M; m++) spec[m] /= used;
  const bandBins = new Set();
  for (const c of [blades, 2 * blades, 3 * blades]) for (let m = c - 2; m <= c + 2; m++) if (m >= 1 && m <= M) bandBins.add(m);
  let band = 0;
  let total = 0;
  for (let m = 1; m <= M; m++) {
    total += spec[m];
    if (bandBins.has(m)) band += spec[m];
  }
  let peak = 0;
  for (const c of [blades, 2 * blades, 3 * blades]) if (c + 8 <= M) peak += peakExcess(spec, c).excess;
  const pk = peakExcess(spec, blades);
  const e = (v) => +v.toExponential(4);
  return {
    blades,
    radii: used,
    valid: r4(validFrac / used),
    peak: e(peak),
    peakK: e(pk.excess),
    floorK: e(pk.floor),
    band: e(band),
    power: e(spec[blades] ?? 0),
    ac: e(total),
    rel: r4(band / Math.max(total, 1e-12)),
  };
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

/**
 * İki parlaklık görüntüsünün SSIM'i; maskeler başına ortalama (null: bütün
 * kare). `excl`: merkezi bu piksellerde olan pencereler sayılmaz (NaN maskesi).
 */
export function ssimByMask(A, B, w, h, masks, win = 7, excl = null) {
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
      if (excl && excl[i]) continue;
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

/**
 * Piksel farkı (RGB 0..1). `changed`: en büyük kanal farkı > 1,5/255 olan
 * piksel oranı; `changedPx`: > tol olan piksel sayısı (kapı); `excl`
 * pikselleri sayılmaz.
 */
export function pixelDiff(a, b, mask, excl = null, tol = 2.5 / 255) {
  let sum = 0;
  let max = 0;
  let changed = 0;
  let changedPx = 0;
  let cnt = 0;
  const n = a.w * a.h;
  for (let i = 0; i < n; i++) {
    if (mask && !mask[i]) continue;
    if (excl && excl[i]) continue;
    cnt++;
    let m = 0;
    for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(a.data[i * 3 + c] - b.data[i * 3 + c]));
    sum += m;
    if (m > max) max = m;
    if (m > 1.5 / 255) changed++;
    if (m > tol) changedPx++;
  }
  return { meanAbs: r4(sum / Math.max(cnt, 1)), maxAbs: r4(max), changed: r4(changed / Math.max(cnt, 1)), changedPx };
}

/** Renk kanalı (0 R, 1 G, 2 B) */
function channel(img, c) {
  const n = img.w * img.h;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = img.data[i * 3 + c];
  return out;
}

/** Bütün karede renk kanallarının en düşük SSIM'i */
export function ssimRgb(a, b, excl = null) {
  let min = 1;
  for (let c = 0; c < 3; c++) min = Math.min(min, ssimByMask(channel(a, c), channel(b, c), a.w, a.h, { kare: null }, 7, excl).kare ?? 1);
  return +min.toFixed(5);
}

/** NaN maskesi (kayıt: <kök>/<GxY>/_nan/<sahne>.png; beyaz = kötü piksel) → Uint8Array (görüntü boyutunda) */
export async function readNanMask(file, w, h) {
  if (!fs.existsSync(file)) return null;
  const { data, info } = await sharp(file).greyscale().resize(w, h, { kernel: 'nearest', fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = data[i * info.channels] > 127 ? 1 : 0;
  return m;
}

/** Maskeyi r piksel genişlet (Chebyshev; 7×7 SSIM penceresi için r = 3) */
export function dilate(m, w, h, r = 3) {
  if (!m) return null;
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -Infinity;
    for (let x = 0; x < w; x++) {
      if (m[y * w + x]) last = x;
      if (x - last <= r) tmp[y * w + x] = 1;
    }
    last = Infinity;
    for (let x = w - 1; x >= 0; x--) {
      if (m[y * w + x]) last = x;
      if (last - x <= r) tmp[y * w + x] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -Infinity;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= r) out[y * w + x] = 1;
    }
    last = Infinity;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= r) out[y * w + x] = 1;
    }
  }
  return out;
}

/** İki maskenin birleşimi */
const union = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  const o = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] | b[i];
  return o;
};
const countOnes = (m) => (m ? m.reduce((s, v) => s + v, 0) : 0);

/* ------------------------------ kaplama ------------------------------ */

const COLORS = ['#ff4d3d', '#2ee6d6', '#ffb020', '#3ddc84', '#ff5cf0', '#7fa7c9', '#f2c14e', '#e8eef4'];

function shapeSvg(sh, w, h, color) {
  if (Array.isArray(sh)) sh = { type: 'rect', x0: sh[0], y0: sh[1], x1: sh[2], y1: sh[3] };
  if (sh.type === 'bitmap') return '';
  const st = `fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="2"`;
  if (sh.type === 'rect') return `<rect x="${sh.x0 * w}" y="${sh.y0 * h}" width="${(sh.x1 - sh.x0) * w}" height="${(sh.y1 - sh.y0) * h}" ${st}/>`;
  if (sh.type === 'poly') return `<polygon points="${sh.pts.map(([x, y]) => `${x * w},${y * h}`).join(' ')}" ${st}/>`;
  if (sh.type === 'polyRing') {
    const pts = (a) => a.map(([x, y]) => `${x * w},${y * h}`).join(' ');
    return `<polygon points="${pts(sh.outer)}" ${st}/><polygon points="${pts(sh.inner)}" ${st.replace('fill-opacity="0.18"', 'fill-opacity="0"')}/>`;
  }
  const rot = `rotate(${sh.rot ?? 0} ${sh.cx * w} ${sh.cy * h})`;
  const el = (k) => `<ellipse cx="${sh.cx * w}" cy="${sh.cy * h}" rx="${sh.rx * w * k}" ry="${sh.ry * h * k}" transform="${rot}" ${st}/>`;
  return sh.type === 'ring' ? el(sh.r1 ?? 1) + el(sh.r0 ?? 0).replace('fill-opacity="0.18"', 'fill-opacity="0"') : el(1);
}

/** Bitmap şekli → yarı saydam renkli katman (sharp composite) */
function bitmapLayer(sh, color, alpha) {
  const buf = Buffer.alloc(sh.w * sh.h * 4);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  for (let i = 0; i < sh.w * sh.h; i++) {
    if (!sh.mask[i]) continue;
    buf[i * 4] = r;
    buf[i * 4 + 1] = g;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = alpha;
  }
  return { input: buf, raw: { width: sh.w, height: sh.h, channels: 4 }, top: 0, left: 0 };
}

async function writeOverlay(file, out, rois, w, h) {
  let i = 0;
  const parts = [];
  const layers = [];
  for (const [name, roi] of Object.entries(rois)) {
    const c = COLORS[i++ % COLORS.length];
    const sh = roi.shape ?? roi;
    if (sh.type === 'bitmap') layers.push(bitmapLayer(sh, c, 110));
    else parts.push(shapeSvg(sh, w, h, c));
    for (const ex of roi.exclude ?? []) {
      if (ex.type === 'bitmap') layers.push(bitmapLayer(ex, '#000000', 150));
      else parts.push(shapeSvg(ex, w, h, '#000'));
    }
    const ax = Array.isArray(sh) ? sh[0] : sh.x0 ?? sh.cx ?? sh.pts?.[0]?.[0] ?? sh.outer?.[0]?.[0] ?? 0;
    const ay = Array.isArray(sh) ? sh[1] : sh.y0 ?? sh.cy ?? sh.pts?.[0]?.[1] ?? sh.outer?.[0]?.[1] ?? 0;
    parts.push(`<text x="${ax * w + 4}" y="${ay * h + 16}" font-family="Segoe UI, Arial" font-size="${Math.round(h / 45)}" font-weight="bold" fill="${c}" stroke="#000" stroke-width="0.6">${name}</text>`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${parts.join('')}</svg>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(file).composite([...layers, { input: svg, top: 0, left: 0 }]).png().toFile(out);
}

/* ------------------------------- ana ------------------------------- */

const listPng = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);
const sizeDirs = (root) => (fs.existsSync(root) ? fs.readdirSync(root).filter((d) => /^\d+x\d+$/.test(d)).sort() : []);

export async function measureSet(root, { ref = null, overlay = null, only = null, sizes = null, excludeNan = false, changedTol = 2.5 / 255 } = {}) {
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
      const IL = integral(L, img.w, img.h);
      const side = path.join(root, size, `${id}.json`);
      const meta = fs.existsSync(side) ? JSON.parse(fs.readFileSync(side, 'utf8')) : null;
      const entry = scenes.get(id);
      const rois = entry ? entry.roiFor(size) : {};
      // Disk ROI'leri kaydın kamerasıyla çokgen halkaya (maske, kaplama)
      const hasDisk = Object.values(rois).some((r) => (r.shape ?? r).type === 'disk');
      const cam = entry && hasDisk ? shotCamera(entry.scene, meta, img.w, img.h) : null;
      const shapes = Object.fromEntries(
        Object.entries(rois)
          .filter(([, r]) => (r.shape ?? r).type !== 'disk' || cam)
          .map(([k, r]) => {
            const sh = r.shape ?? r;
            return [k, sh.type === 'disk' ? { ...r, shape: diskToPolyRing(sh, cam, img.w, img.h), disk: sh } : r];
          }),
      );
      // Anahtar renkli eşten kapak maskeleri (ROI ya da exclude)
      const keyCache = new Map();
      for (const [k, r] of Object.entries(shapes)) {
        const sh = r.shape ?? r;
        const exc = r.exclude ?? [];
        if (sh.type !== 'maskFrom' && !exc.some((e) => e.type === 'maskFrom')) continue;
        const shape = sh.type === 'maskFrom' ? await resolveMaskFrom(sh, img, path.join(root, size), keyCache) : sh;
        const exclude = await Promise.all(exc.map((e) => (e.type === 'maskFrom' ? resolveMaskFrom(e, img, path.join(root, size), keyCache) : e)));
        shapes[k] = { ...(r.shape ? r : {}), shape, exclude };
      }
      const masks = Object.fromEntries(Object.entries(shapes).map(([k, r]) => [k, roiMask(r, img.w, img.h)]));
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
        rec.roi[k] = regionStats(img, L, m, IL);
        const sh = shapes[k].disk ?? shapes[k].shape ?? shapes[k];
        if ((sh.type === 'ring' || sh.type === 'disk') && entry?.scene.blades) {
          const exclude = (shapes[k].exclude ?? []).map((e) => shapeTest(e, img.w, img.h));
          rec.roi[k].fft = polarFft(L, img.w, img.h, sh, entry.scene.blades, { exclude, camera: cam });
        }
      }
      if (ref) {
        const rf = path.join(ref, size, f);
        if (fs.existsSync(rf)) {
          const rimg = await readImage(rf);
          if (rimg.w === img.w && rimg.h === img.h) {
            let excl = null;
            if (excludeNan) {
              const nm = union(await readNanMask(path.join(root, size, '_nan', f), img.w, img.h), await readNanMask(path.join(ref, size, '_nan', f), img.w, img.h));
              excl = dilate(nm, img.w, img.h, 3);
              rec.nanExcludedPx = countOnes(excl);
            }
            rec.ssim = ssimByMask(luma(rimg), L, img.w, img.h, { kare: null, ...masks }, 7, excl);
            rec.ssim.kareRgb = ssimRgb(rimg, img, excl);
            rec.diff = pixelDiff(rimg, img, null, excl, changedTol);
          } else rec.ssim = { hata: `boyut farklı ${rimg.w}x${rimg.h}` };
        } else rec.ssim = { hata: 'referans kare yok' };
      }
      if (overlay) await writeOverlay(file, path.join(overlay, size, f), shapes, img.w, img.h);
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
        ui[`${size}/${f.slice(0, -4)}`] = { ssim: ssimByMask(luma(a), luma(b), a.w, a.h, { kare: null }).kare, ssimRgb: ssimRgb(a, b), diff: pixelDiff(a, b, null, null, changedTol) };
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
    .map(([k, v]) => ({ kare: k, ssim: Math.min(v.ssim, v.ssimRgb ?? 1), changed: v.diff.changed, changedPx: v.diff.changedPx }))
    .sort((a, b) => a.ssim - b.ssim);
  // Değişen piksel sayısı (vitrin + arayüz): --exact / --max-changed kapısı
  const changedRows = [
    ...Object.entries(frames)
      .filter(([, r]) => r.diff)
      .map(([k, r]) => ({ kare: k, changedPx: r.diff.changedPx, maxAbs: r.diff.maxAbs })),
    ...Object.entries(ui)
      .filter(([, v]) => v.diff)
      .map(([k, v]) => ({ kare: `arayuz/${k}`, changedPx: v.diff.changedPx, maxAbs: v.diff.maxAbs })),
  ].sort((a, b) => b.changedPx - a.changedPx);
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
    maxChangedPx: changedRows.length ? changedRows[0].changedPx : null,
    worstChanged: changedRows.filter((r) => r.changedPx > 0).slice(0, 8),
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
  const valued = new Set(['--compare', '--out', '--overlay', '--gate', '--only', '--sizes', '--max-changed', '--changed-tol']);
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
    excludeNan: args.includes('--exclude-nan'),
    changedTol: Number(opt('--changed-tol') ?? 2.5) / 255,
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
  const maxChanged = args.includes('--exact') ? 0 : opt('--max-changed') !== null ? Number(opt('--max-changed')) : null;
  if (maxChanged !== null) {
    if (!opt('--compare')) {
      console.error('EŞİK: --exact / --max-changed için --compare <referans> gerekir');
      process.exit(1);
    }
    if (summary.errors.length) {
      console.error(`EŞİK: ${summary.errors.length} kare karşılaştırılamadı`);
      process.exit(1);
    }
    const over = summary.worstChanged.filter((r) => r.changedPx > maxChanged);
    if (over.length) {
      console.error(`EŞİK: ${over.length} karede değişen piksel > ${maxChanged}:\n  ${over.map((r) => `${r.kare}: ${r.changedPx} px (en büyük fark ${r.maxAbs})`).join('\n  ')}`);
      process.exit(1);
    }
    console.log(`Değişen piksel ≤ ${maxChanged}: geçti`);
  }
}

