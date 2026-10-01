/**
 * Önce/sonra karşılaştırma GIF'i: iki kare klasörünü yan yana koyar.
 *
 *   node scripts/capture/compare.mjs <önce-klasörü> <sonra-klasörü> <çıktı.gif> "<etiket>" [genişlik=400] [fps=10]
 */

import sharp from 'sharp';
import { frameFiles, labelSvg, writeGif } from './common.mjs';

const [beforeDir, afterDir, out, label = '', w = '400', fps = '10'] = process.argv.slice(2);
if (!beforeDir || !afterDir || !out) {
  console.error('Kullanım: node scripts/capture/compare.mjs <önce> <sonra> <çıktı.gif> "<etiket>" [genişlik] [fps]');
  process.exit(1);
}
const W = Number(w);
const B = frameFiles(beforeDir);
const A = frameFiles(afterDir);
const n = Math.min(B.length, A.length);
if (B.length !== A.length) console.warn(`Kare sayıları farklı (${B.length} / ${A.length}); ilk ${n} kare kullanılıyor.`);

const meta = await sharp(B[0]).metadata();
const H = Math.round((meta.height * W) / meta.width);
const gap = 4;
const frames = [];
for (let i = 0; i < n; i++) {
  const side = async (file, tag) =>
    sharp(file)
      .resize(W, H)
      .composite([{ input: labelSvg(`${tag}${label ? ` · ${label}` : ''}`, W, H), top: 0, left: 0 }])
      .png()
      .toBuffer();
  const [b, a] = await Promise.all([side(B[i], 'ÖNCE'), side(A[i], 'SONRA')]);
  frames.push(
    await sharp({ create: { width: W * 2 + gap, height: H, channels: 3, background: '#111' } })
      .composite([
        { input: b, left: 0, top: 0 },
        { input: a, left: W + gap, top: 0 },
      ])
      .png()
      .toBuffer(),
  );
}
const size = await writeGif(frames, out, Number(fps));
console.log(out, n, 'kare', Math.round(size / 1024), 'KB');
