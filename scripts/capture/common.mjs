/** Kayıt araçlarının ortak parçaları: tarayıcı açma ve GIF yazma. */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

/**
 * Chromium'u ekran kartıyla açar. --swiftshader yazılımsal çizime zorlar
 * (GPU'suz sunucular için), --headed pencereli açar (bazı sürücülerde
 * görünmez kipte GPU kapalı kalırsa).
 *
 * Profil klasörü kalıcıdır (node_modules/.cache/capture-profile): Chrome'un GPU shader
 * önbelleği kayıtlar arasında korunur. Havaalanı + motor malzemelerinin
 * D3D11 derlemesi boş önbellekle sahne başına bir dakikayı bulur.
 * --fresh-profile önbelleği silip baştan başlar.
 */
export async function launchBrowser(flags) {
  const soft = flags.has('--swiftshader');
  const args = soft
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])];
  // node_modules altında: Vite izleyicisi Chrome'un kilitli dosyalarına takılıp çökmesin
  const profile = path.resolve('node_modules', '.cache', soft ? 'capture-profile-swiftshader' : 'capture-profile');
  if (flags.has('--fresh-profile')) fs.rmSync(profile, { recursive: true, force: true });
  // Kalıcı bağlam: browser.newPage / close ile aynı biçimde kullanılır
  const browser = await chromium.launchPersistentContext(profile, {
    headless: !flags.has('--headed'),
    // 'chromium' kanalı yeni görünmez kipi kullanır: GPU hızlandırması açık
    channel: soft || flags.has('--headed') ? undefined : 'chromium',
    executablePath: process.env.CAPTURE_CHROMIUM || undefined,
    viewport: null,
    args,
  });
  const probe = await browser.newPage();
  const gpu = await probe.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'bilinmiyor';
  });
  await probe.close();
  console.log('Çizici:', gpu);
  if (!soft && /swiftshader|llvmpipe|software/i.test(gpu)) {
    console.warn('Uyarı: GPU kullanılmıyor (yazılımsal çizim). --headed ile deneyin.');
  }
  return browser;
}

const frameFiles = (dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => /^f\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(dir, f));

/** Kare PNG'lerinden döngülü GIF. */
export async function toGif(dir, out, { width = 480, fps = 12 } = {}) {
  const frames = await Promise.all(frameFiles(dir).map((f) => sharp(f).resize({ width }).png().toBuffer()));
  await writeGif(frames, out, fps);
}

/** Sıralı PNG tamponlarını animasyonlu GIF olarak yazar. */
export async function writeGif(frames, out, fps) {
  if (!frames.length) throw new Error('Kare yok');
  await sharp(frames, { join: { animated: true } })
    .gif({ loop: 0, delay: Math.round(1000 / fps), effort: 7, dither: 0.6, interFrameMaxError: 6, interPaletteMaxError: 4 })
    .toFile(out);
  return fs.statSync(out).size;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Sol üst köşeye etiket (SVG kaplama) */
export function labelSvg(text, w, h) {
  const tw = Math.round(text.length * 7.6 + 16);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect x="6" y="6" width="${tw}" height="22" fill="#000" fill-opacity="0.85"/>` +
      `<text x="14" y="22" font-family="DejaVu Sans, Segoe UI, Arial, sans-serif" font-size="13" font-weight="bold" fill="#fff">${esc(text)}</text>` +
      `</svg>`,
  );
}

export { frameFiles };
