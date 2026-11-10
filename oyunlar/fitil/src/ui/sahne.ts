/**
 * Ekran arka planları için prosedürel gece parçaları (açılış, kartlar):
 * yıldız alanı, kasaba silueti ve deniz, DOM havai fişeği. Tohumlu ve
 * belirlenimli (platform Rng); kare başına bellek ayırmaz (CSS animasyonu).
 */
import { Rng } from '../platform/rng';
import { h, svg, tekilKimlik } from './dom';
import { kiyiSirasi, lamba } from './harita/cizim';

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
 * Dilek fenerleri (Kasım 2026, "cozy"; oyun sahnesindeki `render/gokyuzu.ts`
 * fenerlerinin DOM karşılığı): kabın altından ağır ağır yükselip tepede söner.
 * Yalnız `transform` + `opacity` canlandırılır. Kasaba/harita içeriğinden ÖNCE
 * eklenir ki fenerler yapıların arkasından çıksın. Hareketi azalt açıkken
 * görünmez (canlandırma tek karede biter).
 *
 * `seritler`: fenerlerin yükseleceği yatay bantlar (% cinsinden [sol, sağ]);
 * verilmezse bütün genişlik. Açılış ekranı yalnız iki kenar bandını kullanır:
 * fenerler logonun, sloganın ve düğmenin arkasından geçmez (yazı temiz kalsın).
 */
export function dilekFenerleri(tohum: string | number, adet = 6, seritler?: readonly (readonly [number, number])[]): HTMLElement {
  const r = new Rng(tohum);
  const kap = document.createElement('div');
  kap.className = 'f-dilekler';
  kap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < adet; i++) {
    const el = document.createElement('i');
    el.className = 'f-dilek';
    // Yatayda eşit dilimlere dağıt (üst üste binmesinler), dilim içinde rastgele.
    const serit = seritler?.[i % seritler.length];
    const sol = serit ? serit[0] + r.float() * (serit[1] - serit[0]) : ((i + 0.15 + r.float() * 0.7) / adet) * 100;
    const sure = 62 + r.float() * 34;
    // Aynı şeritteki fenerler süre boyunca eşit aralıkla dizilir (üst üste binmesinler).
    const gec = serit ? -((Math.floor(i / seritler.length) + 0.2 + r.float() * 0.5) / Math.ceil(adet / seritler.length)) * sure : -r.float() * sure;
    el.style.cssText = `left:${f(sol)}%;--df-sure:${f(sure)}s;--df-gec:${f(gec)}s;--df-boy:${f(0.8 + r.float() * 0.5)};--df-sal:${f((r.float() - 0.5) * (serit ? 14 : 36))}px`;
    kap.appendChild(el);
  }
  return kap;
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
  // Arka tepe
  const arka = `<path d="M0 ${tepeY - 20}C${f(60 * k)} ${tepeY - 46} ${f(120 * k)} ${tepeY - 30} ${f(170 * k)} ${tepeY - 38}S${f(280 * k)} ${tepeY - 60} ${f(330 * k)} ${tepeY - 44} ${W} ${tepeY - 70} ${W} ${tepeY - 70}V260H0z" fill="#1A1030"/>`;
  // Kıyı: haritadaki bina dili (İskele, Çarşı, Liman, konaklar, saat kulesi),
  // önünde taş rıhtım ve sokak lambaları.
  const kuleX = Math.round(W * 0.375);
  const t0 = typeof tohum === 'number' ? tohum : r.int(1e6);
  // Arka sıra küçük ve gece mavisiyle örtülü (derinlik); ön sıra tam renk.
  const binalar =
    `<g opacity=".38">${kiyiSirasi(t0 + 7, W - 40, tepeY + 2, 0.6, 1e6)}</g>` +
    kiyiSirasi(t0, W - 84, tepeY + 2, 0.86, kuleX);
  let rihtim = `<rect x="0" y="${tepeY}" width="${W}" height="${28}" fill="#221C30"/>`;
  rihtim += `<path d="M0 ${tepeY - 2}H${W}V${tepeY + 3}H0z" fill="#3A3448"/><path d="M0 ${tepeY - 2}H${W}" stroke="#8A7A9A" stroke-opacity=".55" stroke-width="1.2"/>`;
  for (let k = 0; k < 3; k++) {
    let x = (k % 2) * 9 - 10;
    const yy = tepeY + 8 + k * 7;
    while (x < W) {
      const bw = 14 + r.int(10);
      rihtim += `<path d="M${x} ${yy}h${bw - 1.5}M${x + bw - 1} ${yy}v7" stroke="#000" stroke-opacity=".28" stroke-width="1"/>`;
      x += bw;
    }
  }
  let lambalar = '';
  let pencereler = '';
  let yansima = '';
  for (let lx = 34; lx < W - 90; lx += 96 + r.int(30)) {
    lambalar += lamba(lx, tepeY - 2, true);
    for (let j = 0; j < 4; j++) yansima += `<rect x="${lx - 4 + r.int(3)}" y="${tepeY + 34 + j * 7}" width="${8 - j}" height="1.8" rx=".9" fill="#FFC86B" opacity="${(0.3 - j * 0.06).toFixed(2)}"/>`;
  }
  for (let i = 0; i < Math.round(W / 9); i++) {
    const px = r.int(W);
    yansima += `<rect x="${px}" y="${tepeY + 32 + r.int(44)}" width="${(5 + r.float() * 12).toFixed(1)}" height="1.6" rx=".8" fill="#FFC86B" opacity="${(0.1 + r.float() * 0.2).toFixed(2)}"/>`;
  }
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
    ${isik}${arka}${binalar}${pencereler}${rihtim}${lambalar}${yamac}${fener}
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
