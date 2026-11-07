/**
 * Mağaza kaynaklarını oyunun logosundan üretir (src/ui/logo.ts; elle çizim yok):
 *   magaza/kaynak/logo.svg        tam logo (öne çıkan görsel)
 *   magaza/kaynak/simge-on.svg    uyarlanabilir simgenin ön katmanı: amblem
 *   magaza/kaynak/simge-tekrenk.svg  Android 13+ temalı simge (yalnız alfa)
 * Çalıştır: npx tsx scripts/logo-yaz.ts (magaza-gorselleri.mjs kendisi çağırır).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AMBLEM_KUTU, amblemSvg, LOGO_GENISLIK, LOGO_YUKSEKLIK, logoSvg } from '../src/ui/logo';

const KAYNAK = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'magaza', 'kaynak');
const BASLIK = (ad: string, ne: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!--
  FİTİL ${ad}: ${ne}
  ÜRETİLİR (scripts/logo-yaz.ts, kaynak src/ui/logo.ts); elle düzenleme.
-->
`;

const ic = (svg: string) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// Tam logo: kök öğe bağımsız dosya olarak açılsın (xmlns, boyut).
const logo = logoSvg('lg', '', 'FİTİL').replace(/^<svg class=""/, `<svg xmlns="http://www.w3.org/2000/svg" width="${LOGO_GENISLIK}" height="${LOGO_YUKSEKLIK}"`);
writeFileSync(join(KAYNAK, 'logo.svg'), BASLIK('logosu', 'açılış ekranındaki logonun aynısı (öne çıkan görsel).') + logo + '\n');

/*
 * Simge ön katmanı: 108 dp tuval, her şey ortadaki 66 dp güvenli dairede
 * (yarıçap ≤ 33). En uzak noktalar kemerin alt köşeleri (x 91/309, y 190) ve
 * tepesi (y 5): ölçek 0,25 ve merkez y 118 ile köşe 32,7 dp, tepe 28,3 dp.
 */
const K = 0.25;
const MX = 200;
const MY = 118;
const amblem = amblemSvg('o');
const on = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <g transform="translate(54 54) scale(${K}) translate(${-MX} ${-MY})">${ic(amblem)}</g>
</svg>`;
writeFileSync(join(KAYNAK, 'simge-on.svg'), BASLIK('uygulama simgesi — ÖN katman', 'kemerli amblem (logodan), 66 dp güvenli dairenin içinde.') + on + '\n');

/*
 * Temalı simge (sistem yalnız alfayı boyar): kemer çerçevesi halka olarak,
 * içinde büyük fişek ve kasaba çizgisi. Ayrıntı küçük boyda leke olmasın diye az.
 */
const KEMER_ALT = AMBLEM_KUTU[3] - 2;
const kemer = `M96 ${KEMER_ALT}V108C96 64 142 30 200 10C258 30 304 64 304 108V${KEMER_ALT}Z`;
const kemerIc = `M110 ${KEMER_ALT}V110C110 74 150 46 200 27C250 46 290 74 290 110V${KEMER_ALT}Z`;
let isinlar = '';
for (let i = 0; i < 12; i++) {
  const a = 0.17 + (i / 12) * Math.PI * 2;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x1 = 200 + c * 14;
  const y1 = 84 + s * 14;
  const x2 = 200 + c * 40;
  const y2 = 84 + s * 40;
  isinlar += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
}
const tek = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">
  <g transform="translate(54 54) scale(${K}) translate(${-MX} ${-MY})" fill="#fff">
    <path d="${kemer} ${kemerIc}" fill-rule="evenodd" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
    <g stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none">${isinlar}</g>
    <circle cx="200" cy="84" r="7"/>
    <path d="M110 ${KEMER_ALT}V160L126 150L142 160V136H150V118L156 106L162 118V136H170V160C170 150 180 144 190 144C200 144 208 150 208 160L226 148L244 160H262V112L272 102L282 112V158H290V${KEMER_ALT}Z"/>
  </g>
</svg>`;
writeFileSync(join(KAYNAK, 'simge-tekrenk.svg'), BASLIK('uygulama simgesi — TEK RENK katman', 'Android 13+ temalı simge; amblemin sade hâli (çerçeve, fişek, kasaba).') + tek + '\n');

console.log('yazıldı: magaza/kaynak/logo.svg, simge-on.svg, simge-tekrenk.svg');
