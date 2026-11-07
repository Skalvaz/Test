/**
 * FİTİL logosu (Kasım 2026, ürün sahibi seçti): sivri kemerli amblem (gece
 * göğünde üç fişek, kasaba silueti, deniz feneri) ve önünde elle çizilmiş,
 * tırnaklı, derinlikli "FİTİL" harfleri; İ noktaları iki eş kor.
 *
 * Tutarlılık kuralları (yeni öğe eklerken uy): ışık sol üstten; tek kontur
 * rengi `KONTUR`; harf yüzü tek degrade; derinlik hep sağ alta; altın çerçeve
 * tek degrade; fişek renkleri oyun paletinden. Harfler aralıklı (ARA) ama
 * kontur arayı kapatır: yazı tek koyu çerçeveli blok okunur, kemerin alt
 * kenarı harflerin üst bandının arkasında kalır.
 *
 * Saf metin üretir (DOM yok): açılış ekranı ve mağaza görselleri aynı çizimi
 * kullanır. Canlandırma sınıfları: f-lg-amblem, f-lg-fisek (--lg-gec),
 * f-lg-yazi, f-lg-kor (--lg-gec), f-lg-hale.
 */

const KONTUR = '#1E0E06';

/** Harfler: büyük harf yüksekliği 100; x = 0 gövdenin sol kenarı; w = [sol, sağ] kapsam. */
const HARF: Record<string, { w: [number, number]; p: string; nokta?: boolean }> = {
  F: { w: [-8, 74], p: '-8,0 74,0 74,36 64,36 64,24 26,24 26,42 54,42 54,36 62,36 62,68 54,68 54,62 26,62 26,88 36,88 36,100 -8,100 -8,88 0,88 0,12 -8,12' },
  I: { w: [-8, 34], p: '-8,0 34,0 34,12 26,12 26,88 34,88 34,100 -8,100 -8,88 0,88 0,12 -8,12', nokta: true },
  T: { w: [0, 86], p: '0,0 86,0 86,36 76,36 76,24 56,24 56,88 66,88 66,100 20,100 20,88 30,88 30,24 10,24 10,36 0,36' },
  L: { w: [-8, 76], p: '-8,0 36,0 36,12 26,12 26,76 66,76 66,64 76,64 76,100 -8,100 -8,88 0,88 0,12 -8,12' },
};
const KELIME = ['F', 'I', 'T', 'I', 'L'];
const ARA = 11;
const OLCEK = 0.88;
/** Harflerin üst kenarı (büyük harf yüksekliğinin başladığı y). */
const UST = 176;
const ORTA = 200;
/** Kemerin alt kenarı: harflerin üst tırnak bandının arkasında. */
const KEMER_ALT = UST + 9;

export const LOGO_GENISLIK = 400;
export const LOGO_YUKSEKLIK = 278;

const f = (n: number) => +n.toFixed(1);

function yerlesim(): number[] {
  const genis = KELIME.reduce((t, h) => t + HARF[h].w[1] - HARF[h].w[0], 0) + ARA * (KELIME.length - 1);
  let x = -genis / 2;
  return KELIME.map((h) => {
    const sol = x - HARF[h].w[0];
    x += HARF[h].w[1] - HARF[h].w[0] + ARA;
    return sol;
  });
}

/** Fişek: konik ışınlar + uç noktaları + hale (merkez etrafında ölçeklenir). */
function fisek(id: string, cx: number, cy: number, r: number, n: number, renk: string, uc: string, aci0: number, kalin: number, gecikme: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = aci0 + (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const si = Math.sin(a);
    const x1 = cx + c * r * 0.28;
    const y1 = cy + si * r * 0.28;
    const x2 = cx + c * r * 0.86;
    const y2 = cy + si * r * 0.86;
    const nx = (-si * kalin) / 2;
    const ny = (c * kalin) / 2;
    s += `<path d="M${f(x1)} ${f(y1)}L${f(x2 + nx)} ${f(y2 + ny)}L${f(x2 - nx)} ${f(y2 - ny)}Z" fill="${renk}"/>`;
    s += `<circle cx="${f(cx + c * r)}" cy="${f(cy + si * r)}" r="${f(kalin * 0.8)}" fill="${uc}"/>`;
  }
  return `<g class="f-lg-fisek" style="--lg-gec:${gecikme}ms"><circle cx="${cx}" cy="${cy}" r="${f(r * 1.25)}" fill="url(#${id}-hale)" opacity=".8"/>${s}<circle cx="${cx}" cy="${cy}" r="${f(r * 0.12)}" fill="#FFF8DC"/></g>`;
}

function kasaba(): string {
  const pencere = (x: number, y: number) => `<rect x="${x}" y="${y}" width="4" height="6" rx="1"/>`;
  // Taban y = 196 (çağıran 20 aşağı kaydırır; kemerin alt kenarında kırpılır).
  return `<g fill="#140A26">
      <path d="M100 196V130L116 120L132 130V196Z"/>
      <path d="M130 196V104H138V82L144 70L150 82V104H158V196Z"/>
      <path d="M156 196V134C156 120 166 112 178 112C190 112 200 120 200 134V196Z"/>
      <rect x="176" y="100" width="4" height="14"/>
      <path d="M198 196V126L216 114L234 126V196Z"/>
      <path d="M232 196V140H262V196Z"/>
      <path d="M262 196V74L266 66H278L282 74V196Z"/>
      <path d="M280 196V130H300V196Z"/>
      <path d="M262 58L272 50L282 58Z"/>
    </g>
    <circle cx="144" cy="94" r="5" fill="#FFD98A"/>
    <path d="M276 64L380 40V90Z" fill="url(#LOGO-huzme)"/>
    <rect x="264" y="58" width="16" height="10" rx="2" fill="#FFE7A0"/>
    <g fill="#FFC85A">${pencere(112, 140)}${pencere(120, 140)}${pencere(164, 150)}${pencere(186, 150)}${pencere(206, 136)}${pencere(220, 136)}${pencere(240, 150)}${pencere(252, 150)}${pencere(288, 142)}${pencere(270, 94)}${pencere(270, 114)}</g>`;
}

/** Kemerin dış ve iç çizgisi (amblem ve mağaza simgesi). */
const KEMER = `M96 ${KEMER_ALT}V108C96 64 142 30 200 10C258 30 304 64 304 108V${KEMER_ALT}Z`;
const KEMER_IC = `M106 ${KEMER_ALT}V109C106 70 148 40 200 22C252 40 294 70 294 109V${KEMER_ALT}Z`;

/** Degrade ve kırpma tanımları (`harfKirp`: harf çokgenleri; amblemde boş). */
function tanimlar(id: string, harfKirp: string): string {
  return `  <defs>
    <linearGradient id="${id}-gok" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1438"/><stop offset=".6" stop-color="#22174A"/><stop offset="1" stop-color="#3A1C52"/></linearGradient>
    <linearGradient id="${id}-cerceve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A8"/><stop offset=".5" stop-color="#E0A04A"/><stop offset="1" stop-color="#A8601E"/></linearGradient>
    <linearGradient id="${id}-yuz" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100"><stop offset="0" stop-color="#FFF4D2"/><stop offset=".38" stop-color="#FFD25E"/><stop offset=".72" stop-color="#FFA22E"/><stop offset="1" stop-color="#E8601C"/></linearGradient>
    <linearGradient id="${id}-huzme" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFE7A0" stop-opacity="0"/></linearGradient>
    <radialGradient id="${id}-hale"><stop offset="0" stop-color="#FFE7A0" stop-opacity=".7"/><stop offset=".4" stop-color="#FFB020" stop-opacity=".3"/><stop offset="1" stop-color="#FF7A1A" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}-koz" cx=".4" cy=".36" r=".64"><stop offset="0" stop-color="#FFFBE6"/><stop offset=".4" stop-color="#FFD15C"/><stop offset=".8" stop-color="#FF7A1A"/><stop offset="1" stop-color="#E8561A"/></radialGradient>
    <clipPath id="${id}-kemer"><path d="${KEMER_IC}"/></clipPath>
    <clipPath id="${id}-harf">${harfKirp}</clipPath>
  </defs>
`;
}

/** Kemerli amblem: altın çerçeve, gece göğü, üç fişek, kasaba ve fener. */
function amblem(id: string): string {
  const kemer = KEMER;
  const kemerIc = KEMER_IC;
  const yildizlar = [[134, 64], [170, 40], [244, 46], [286, 100], [122, 104], [230, 104], [158, 120]]
    .map(([a, b], i) => `<circle cx="${a}" cy="${b}" r="${i % 3 ? 1 : 1.5}" fill="#FFF3D6" opacity="${i % 2 ? 0.55 : 0.85}"/>`)
    .join('');
  return `  <g class="f-lg-amblem">
    <path d="${kemer}" fill="${KONTUR}" stroke="${KONTUR}" stroke-width="10" stroke-linejoin="round"/>
    <path d="${kemer}" fill="url(#${id}-cerceve)"/>
    <path d="${kemerIc}" fill="url(#${id}-gok)"/>
    <g clip-path="url(#${id}-kemer)">
      ${yildizlar}
      ${fisek(id, 200, 80, 44, 18, '#FFD25E', '#FFF1C0', 0.17, 2.9, 420)}
      ${fisek(id, 146, 70, 18, 12, '#FF7A6A', '#FFC2B4', 0.3, 2.1, 620)}
      ${fisek(id, 254, 62, 16, 12, '#6FD6E8', '#C8F4FA', 0.1, 2.1, 780)}
      <g transform="translate(0 20)">${kasaba().replace(/LOGO-/g, `${id}-`)}</g>
    </g>
    <path d="${kemerIc}" fill="none" stroke="#FFE7A8" stroke-opacity=".35" stroke-width="1.5"/>
  </g>
`;
}

/**
 * Yalnız amblem (yazısız; Play simgesi ve uyarlanabilir simgenin ön katmanı,
 * `scripts/logo-yaz.ts`). viewBox kemeri kontur payıyla sarar.
 */
export function amblemSvg(id = 'fam'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${AMBLEM_KUTU.join(' ')}" width="${AMBLEM_KUTU[2]}" height="${AMBLEM_KUTU[3]}">
${tanimlar(id, '')}${amblem(id)}</svg>`;
}

/** Amblemin kutusu [x, y, w, h] (kontur 5 birim taşar). */
export const AMBLEM_KUTU = [90, 4, 220, KEMER_ALT + 2] as const;

/**
 * Logo SVG metni. `id` sayfada tek olmalı (degrade/kırpma kimliklerinin
 * öneki); `sinif` kök öğeye eklenir.
 */
export function logoSvg(id = 'flg', sinif = 'f-logo-svg', etiket = 'FİTİL'): string {
  const yer = yerlesim();
  const kelime = (ic: string) => `<g transform="translate(${ORTA} ${UST}) scale(${OLCEK})">${ic}</g>`;
  const harfler = (oz: string) => KELIME.map((h, i) => `<polygon points="${HARF[h].p}" transform="translate(${f(yer[i])} 0)" ${oz}/>`).join('');
  const noktalar = KELIME.map((h, i) => (HARF[h].nokta ? yer[i] + 13 : null)).filter((v): v is number => v !== null);

  // Derinlik: aynı biçim 8 adımda sağ alta; en dıştaki adımlar koyu.
  let derinlik = '';
  let derinlikKontur = '';
  for (let k = 8; k >= 1; k--) {
    const t = `translate(${f(k * 0.3)} ${f(k * 1.1)})`;
    derinlik += `<g transform="${t}">${harfler(`fill="${k > 5 ? '#4A1F08' : '#7A3812'}"`)}</g>`;
    derinlikKontur += `<g transform="${t}">${harfler('')}</g>`;
  }
  const kor = (cx: number, i: number) => `<g class="f-lg-kor" style="--lg-gec:${1000 + i * 160}ms" transform="translate(${f(cx)} -22)">
      <circle class="f-lg-hale" r="25" fill="url(#${id}-hale)"/>
      <circle r="12.5" fill="${KONTUR}"/>
      <circle r="8.8" fill="url(#${id}-koz)"/>
      <circle cx="-2.9" cy="-3.2" r="2.9" fill="#FFFDF0" opacity=".9"/></g>`;

  return `<svg class="${sinif}" viewBox="0 0 ${LOGO_GENISLIK} ${LOGO_YUKSEKLIK}" role="img" aria-label="${etiket}" overflow="visible">
${tanimlar(id, harfler(''))}${amblem(id)}  <g class="f-lg-yazi">${kelime(`
    <g fill="${KONTUR}" stroke="${KONTUR}" stroke-width="11" stroke-linejoin="round">${derinlikKontur}</g>
    ${derinlik}
    ${harfler(`fill="url(#${id}-yuz)" stroke="${KONTUR}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"`)}
    <g clip-path="url(#${id}-harf)" fill="none" stroke-linejoin="round">
      <g transform="translate(1.6 3)" stroke="#FFFBEA" stroke-opacity=".75" stroke-width="5">${harfler('')}</g>
      <g transform="translate(-1.2 -3)" stroke="#9A3A0E" stroke-opacity=".55" stroke-width="5">${harfler('')}</g>
    </g>
    ${harfler(`fill="none" stroke="${KONTUR}" stroke-width="3" stroke-linejoin="round"`)}
    ${noktalar.map(kor).join('')}`)}</g>
</svg>`;
}
