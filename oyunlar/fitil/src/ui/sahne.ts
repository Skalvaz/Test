/**
 * Ekran arka planları için prosedürel gece parçaları (açılış, kartlar):
 * yıldız alanı, kasaba silueti ve deniz, DOM havai fişeği. Tohumlu ve
 * belirlenimli (platform Rng); kare başına bellek ayırmaz (CSS animasyonu).
 */
import { Rng } from '../platform/rng';
import { h, svg, tekilKimlik } from './dom';

const f = (n: number) => n.toFixed(1);

/** Yıldız alanı SVG'si (viewBox 400×800, kaplayarak ölçeklenir). */
export function yildizAlani(tohum: string | number, adet = 110, kipirti = 14): SVGSVGElement {
  const r = new Rng(tohum);
  let s = '';
  for (let i = 0; i < adet; i++) {
    const x = r.float() * 400;
    const y = Math.pow(r.float(), 1.3) * 760;
    const rr = 0.4 + Math.pow(r.float(), 3) * 1.6;
    const o = 0.35 + r.float() * 0.6;
    const kip = i < kipirti ? ` class="f-kipirti" style="animation-delay:${f(-r.float() * 4)}s;animation-duration:${f(2.2 + r.float() * 3)}s"` : '';
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${rr.toFixed(2)}" fill="${r.chance(0.15) ? '#FFE3B0' : '#FFFFFF'}" opacity="${o.toFixed(2)}"${kip}/>`;
  }
  return svg(`<svg class="f-yildiz-alani" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`);
}

/**
 * Fener Koyu kasaba silueti + deniz (yükseklik 260 birim, alta yaslı).
 * Kubbe, minare, saat kulesi, sağ yamaçta dönen ışıklı deniz feneri.
 * `genislik`: geniş ekranda siluet kırpılmasın diye viewBox genişliği
 * (en az 400; kap en/boy oranına göre verilir).
 */
export function kasabaSilueti(tohum: string | number, genislik = 400): SVGSVGElement {
  const W = Math.max(400, Math.round(genislik));
  const k = W / 400;
  const r = new Rng(tohum);
  const tepeY = 150;
  let binalar = '';
  let pencereler = '';
  let yansima = '';
  // Arka tepe
  const arka = `<path d="M0 ${tepeY - 20}C${f(60 * k)} ${tepeY - 46} ${f(120 * k)} ${tepeY - 30} ${f(170 * k)} ${tepeY - 38}S${f(280 * k)} ${tepeY - 60} ${f(330 * k)} ${tepeY - 44} ${W} ${tepeY - 70} ${W} ${tepeY - 70}V260H0z" fill="#1A1030"/>`;
  const kuleX = Math.round(W * 0.375);
  let x = -6;
  while (x < W - 70) {
    if (x > kuleX - 30 && x < kuleX + 26) {
      x = kuleX + 26;
      continue;
    }
    const w = 18 + r.int(24);
    const hh = 26 + r.int(56);
    const y = tepeY - hh + r.int(10);
    const tur = r.int(10);
    let govde = `<rect x="${x}" y="${y}" width="${w}" height="${tepeY + 30 - y}" fill="#120A1E"/>`;
    if (tur < 3) govde += `<path d="M${x - 2} ${y}L${x + w / 2} ${y - 10 - r.int(8)}L${x + w + 2} ${y}z" fill="#120A1E"/>`;
    else if (tur < 5) govde += `<path d="M${x + 2} ${y}a${w / 2 - 2} ${w / 2 - 2} 0 0 1 ${w - 4} 0z" fill="#120A1E"/><rect x="${x + w / 2 - 0.8}" y="${y - w / 2 - 5}" width="1.6" height="6" fill="#120A1E"/>`;
    else if (tur === 5) govde += `<rect x="${x + w / 2 - 3}" y="${y - 36}" width="6" height="36" fill="#120A1E"/><path d="M${x + w / 2 - 3.5} ${y - 36}L${x + w / 2} ${y - 46}L${x + w / 2 + 3.5} ${y - 36}z" fill="#120A1E"/><rect x="${x + w / 2 - 4}" y="${y - 26}" width="8" height="2" fill="#120A1E"/>`;
    binalar += govde;
    const sut = Math.max(1, Math.floor((w - 6) / 7));
    const sat = Math.max(1, Math.floor((tepeY - y - 6) / 10));
    for (let i = 0; i < sut; i++)
      for (let j = 0; j < sat; j++) {
        if (!r.chance(0.42)) continue;
        const px = x + 4 + i * 7;
        const py = y + 6 + j * 10;
        pencereler += `<rect x="${px}" y="${py}" width="3.4" height="5" rx=".6" fill="#FFC86B"/>`;
        if (r.chance(0.5)) yansima += `<rect x="${px - 0.5}" y="${2 * (tepeY + 28) - py - 6 + r.int(4)}" width="4.4" height="${(3 + r.float() * 7).toFixed(1)}" fill="#FFC86B" opacity="${(0.12 + r.float() * 0.2).toFixed(2)}"/>`;
      }
    x += w + 1 + r.int(4);
  }
  // Saat kulesi
  const kx = kuleX - 11;
  binalar += `<rect x="${kx}" y="${tepeY - 96}" width="22" height="126" fill="#120A1E"/><path d="M${kx - 3} ${tepeY - 96}L${kx + 11} ${tepeY - 118}L${kx + 25} ${tepeY - 96}z" fill="#120A1E"/>`;
  pencereler += `<circle cx="${kx + 11}" cy="${tepeY - 80}" r="6.5" fill="#FFE3A0"/><circle cx="${kx + 11}" cy="${tepeY - 80}" r="12" fill="url(#ftl-isik)" opacity=".7"/><path d="M${kx + 11} ${tepeY - 80}V${tepeY - 85}M${kx + 11} ${tepeY - 80}h3.5" stroke="#3A2416" stroke-width="1.2"/>`;
  // Sağ yamaç ve deniz feneri
  const fx = W - 38;
  const yamac = `<path d="M${W - 82} ${tepeY + 30}C${W - 70} ${tepeY - 4} ${W - 50} ${tepeY - 24} ${W - 20} ${tepeY - 30}L${W} ${tepeY - 30}V260H${W - 82}z" fill="#0E0818"/>`;
  const fener = `<path d="M${fx - 8} ${tepeY - 30}L${fx - 5} ${tepeY - 96}H${fx + 5}L${fx + 8} ${tepeY - 30}z" fill="#E8E0F0"/>
    <path d="M${fx - 7.4} ${tepeY - 46}h14.8M${fx - 6.4} ${tepeY - 66}h12.8" stroke="#B8381C" stroke-width="7"/>
    <rect x="${fx - 7}" y="${tepeY - 106}" width="14" height="10" rx="2" fill="#FFF4C2"/><path d="M${fx - 8} ${tepeY - 106}L${fx} ${tepeY - 114}L${fx + 8} ${tepeY - 106}z" fill="#3A2416"/>
    <circle cx="${fx}" cy="${tepeY - 101}" r="18" fill="url(#ftl-koz)"/>`;
  const huzme = Math.min(420, W * 0.65);
  const isik = `<g class="f-fener-isik" style="transform-origin:${fx}px ${tepeY - 101}px"><path d="M${fx} ${tepeY - 101}L${fx - huzme} ${tepeY - 140}L${fx - huzme} ${tepeY - 70}z" fill="url(#f-isik-huzme)"/></g>`;
  // Deniz
  const denizY = tepeY + 28;
  let dalga = '';
  const tekrar = Math.ceil((W + 40) / 30);
  for (let i = 0; i < 7; i++) {
    const y = denizY + 10 + i * 12;
    dalga += `<path class="f-dalga" style="animation-delay:${f(-i * 0.7)}s" d="M-20 ${y}q15 -3 30 0${'t30 0'.repeat(tekrar)}" fill="none" stroke="#3A2A6A" stroke-width="1.2" opacity="${(0.5 - i * 0.05).toFixed(2)}"/>`;
  }
  return svg(tekilKimlik(`<svg class="f-kasaba" viewBox="0 0 ${W} 260" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs><linearGradient id="f-isik-huzme" x1="1" x2="0" y1="0" y2="0"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".55"/><stop offset="1" stop-color="#FFF4C2" stop-opacity="0"/></linearGradient>
    <linearGradient id="f-deniz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1040"/><stop offset="1" stop-color="#0A0E26"/></linearGradient>
    <radialGradient id="f-ufuk" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="#FF8A3C" stop-opacity=".35"/><stop offset="1" stop-color="#FF8A3C" stop-opacity="0"/></radialGradient></defs>
    <rect x="0" y="40" width="${W}" height="${tepeY - 10}" fill="url(#f-ufuk)"/>
    ${isik}${arka}${binalar}${pencereler}${yamac}${fener}
    <rect x="0" y="${denizY}" width="${W}" height="${260 - denizY}" fill="url(#f-deniz)"/>
    <path d="M0 ${denizY}H${W}" stroke="#FFC86B" stroke-opacity=".25" stroke-width="1"/>
    ${yansima}${dalga}</svg>`, ['f-isik-huzme', 'f-deniz', 'f-ufuk']));
}

const FISEK_RENKLERI = ['#FF4D4D', '#FFB020', '#2EE07A', '#3AA8FF', '#B266FF', '#FF5FB4', '#FFF4C2'];

/**
 * DOM havai fişeği: konum (px) ve renk; CSS ile patlar ve söner, sonra
 * kendini kaldırır. 22 parçacık + çekirdek parlaması.
 */
export function havaiFisek(kap: HTMLElement, x: number, y: number, renk?: string, boyut = 70): void {
  const c = renk ?? FISEK_RENKLERI[Math.floor(Math.random() * FISEK_RENKLERI.length)];
  const kok = h('div', { s: 'f-fisek', css: { left: `${x}px`, top: `${y}px`, '--r': `${boyut}px`, '--c': c } });
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 360 + Math.random() * 8;
    kok.appendChild(h('i', { css: { '--a': `${a.toFixed(1)}deg`, '--g': `${(0.8 + Math.random() * 0.3).toFixed(2)}` } }));
  }
  // İç halka: daha kısa, sıcak beyaz kıvılcımlar.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 360 + 15;
    kok.appendChild(h('i', { s: 'f-ic', css: { '--a': `${a.toFixed(1)}deg`, '--g': `${(0.42 + Math.random() * 0.12).toFixed(2)}` } }));
  }
  kok.appendChild(h('b'));
  kap.appendChild(kok);
  setTimeout(() => kok.remove(), 1800);
}
