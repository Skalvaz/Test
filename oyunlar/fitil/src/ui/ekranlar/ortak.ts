/**
 * Ekranların paylaştığı küçük bileşenler: yıldız sırası, hedef kutucukları,
 * ödül etiketleri, yeni öğe önizlemesi (küçük CSS animasyonu), Gece Tablosu
 * çerçevesi, mahalle çipi, satır düzenleri.
 */
import { h, svg, tekilKimlik } from '../dom';
import { kapsulIsaretleme, hedefIkonu, odulIkonu, yildizSvg, kucukYildiz, motifIsaretleme, guclendiriciIsaretleme, ustaSvg } from '../ikonlar';
import { hedefMetni, NADIRLIK_ADLARI, GUCLENDIRICI_ADLARI, YENI_OGE } from '../metinler';
import { DESENLER, FITILLER, MAHALLELER } from '../../app/katalog';
import type { HedefVM, Nadirlik, OdulVM, Palet, YeniOge, Yildiz } from '../tipler';

export function yildizSirasi(n: Yildiz, sinif = ''): HTMLElement {
  return h('div', { s: `f-yildiz-sira ${sinif}`, role: 'img', 'aria-label': `${n}/3 yıldız` }, [0, 1, 2].map((i) => yildizSvg(i < n)));
}

export function kucukYildizlar(n: Yildiz): HTMLElement {
  return h('span', { s: 'f-kyildizlar', role: 'img', 'aria-label': `${n}/3 yıldız` }, [0, 1, 2].map((i) => kucukYildiz(i < n)));
}

/** Bölüm öncesi / duraklat hedef kutucuğu. */
export function hedefKutusu(hd: HedefVM, palet: Palet, kucuk = false): HTMLElement {
  return h(
    'div',
    { s: `f-hedef-kutu${kucuk ? ' f-kucuk' : ''}${hd.tamam ? ' f-tamam' : ''}` },
    h('span', { s: 'f-hedef-kutu-ikon f-yuva' }, hedefIkonu(hd, palet)),
    h('span', { s: 'f-hedef-kutu-metin', t: hedefMetni(hd) }),
  );
}

export function odulMetni(o: OdulVM): string {
  switch (o.tur) {
    case 'guclendirici':
      return `${GUCLENDIRICI_ADLARI[o.id]} +${o.adet}`;
    case 'desenParcasi': {
      const ad = DESENLER.find((d) => d.id === o.id)?.ad ?? o.id;
      return o.tekrar ? `${ad}: +3 toz` : `${ad} ${o.parca}/3`;
    }
    case 'fitilParcasi': {
      const ad = FITILLER.find((d) => d.id === o.id)?.ad ?? o.id;
      return o.tekrar ? `${ad}: +3 toz` : `${ad} ${o.parca}/3`;
    }
    case 'toz':
      return `+${o.adet} toz`;
    case 'sandik':
      return `Sandık +${o.adet}`;
  }
}

export function odulOgesi(o: OdulVM, gecikme = 0): HTMLElement {
  return h(
    'div',
    { s: 'f-odul', css: { '--gecikme': `${gecikme}ms` } },
    h('span', { s: 'f-odul-ikon' }, odulIkonu(o)),
    h('span', { s: 'f-odul-metin', t: odulMetni(o) }),
  );
}

export function mahalleCipi(mahalle: number): HTMLElement {
  const m = MAHALLELER[mahalle] ?? MAHALLELER[0];
  return h('span', { s: 'f-mahalle-cip', css: { '--vurgu': m.vurgu } }, h('i'), h('span', { t: m.ad }));
}

const NADIR_SIRA: Record<Nadirlik, number> = { sade: 0, parlak: 1, saheser: 2 };
export function nadirlikSirasi(n: Nadirlik): number {
  return NADIR_SIRA[n];
}

/** Gece Tablosu çerçevesi: Sade ahşap, Parlak pirinç, Şaheser altın varak (§13.6). */
export function tabloCercevesi(nadirlik: Nadirlik, tuval: HTMLCanvasElement | null, etiketli = true): HTMLElement {
  const ic = h('div', { s: 'f-tablo-ic' });
  if (tuval) {
    tuval.classList.add('f-tablo-tuval');
    ic.appendChild(tuval);
  } else ic.appendChild(tabloYerTutucu());
  return h(
    'div',
    { s: `f-tablo f-nadir-${nadirlik}` },
    ic,
    nadirlik === 'saheser' ? h('span', { s: 'f-tablo-suzme', 'aria-hidden': 'true' }) : null,
    etiketli ? h('span', { s: 'f-tablo-etiket', t: NADIRLIK_ADLARI[nadirlik] }) : null,
  );
}

/** Tuval verilmezse: gece göğünde birkaç uzun pozlama izi (yer tutucu). */
function tabloYerTutucu(): SVGSVGElement {
  let s = '';
  const renk = ['#FF4D4D', '#FFB020', '#2EE07A', '#3AA8FF', '#B266FF', '#FF5FB4'];
  for (let k = 0; k < 5; k++) {
    const cx = 20 + ((k * 37) % 60);
    const cy = 20 + ((k * 23) % 40);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 8 + (k % 3) * 4;
      s += `<path d="M${cx} ${cy}L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}" stroke="${renk[k % 6]}" stroke-width=".8" opacity=".7" stroke-linecap="round"/>`;
    }
  }
  return svg(tekilKimlik(`<svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" class="f-tablo-tuval" aria-hidden="true">
    <defs><linearGradient id="f-tb-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B1030"/><stop offset="1" stop-color="#2A1450"/></linearGradient></defs>
    <rect width="100" height="150" fill="url(#f-tb-g)"/>${s}
    <path d="M0 128h12v-14h8v10h10v-20h6v-6h4v6h6v20h10v-12h8v16h12v-22l6-6 6 6v22h12v22H0z" fill="#120A1E"/></svg>`, ['f-tb-g']));
}

/** Kıvılcım Usta ipucu satırı (kart içinde). */
export function ustaIpucu(metin: string): HTMLElement {
  return h('div', { s: 'f-usta-ipucu' }, ustaSvg(), h('span', { t: metin }));
}

/** Ayarlar/istatistik satırı: sol etiket + sağ kontrol. */
export function satir(etiket: string, kontrol: HTMLElement, ikonEl?: Element | null, aciklama?: string): HTMLElement {
  return h(
    'div',
    { s: 'f-satir' },
    ikonEl ? h('span', { s: 'f-satir-ikon' }, ikonEl) : null,
    h('span', { s: 'f-satir-etiket' }, h('span', { t: etiket }), aciklama ? h('small', { t: aciklama }) : null),
    kontrol,
  );
}

// ─────────────────────── Yeni öğe önizlemesi ───────────────────────

/**
 * Bölüm öncesi ve "Sıradaki" için küçük animasyonlu önizleme (72×72 SVG,
 * CSS animasyonu; hareketi azaltta durağan).
 */
export function yeniOgeOnizleme(oge: YeniOge, palet: Palet): HTMLElement {
  const k = (r: number, renk: number, x: number, y: number, s = '') => `<g class="${s}" style="transform-origin:${x}px ${y}px">${kapsulIsaretleme(renk, r, palet, x, y)}</g>`;
  let ic = '';
  switch (oge) {
    case 'cizim':
      ic = `${k(8, 0, -22, 6)}${k(8, 0, 0, 6)}${k(8, 0, 22, 6)}<path class="f-yo-fitil" d="M-22 6H22" pathLength="1" stroke="#FFB020" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
      break;
    case 'capraz':
      ic = `${k(8, 3, -20, 16)}${k(8, 3, 0, -2)}${k(8, 3, 20, -20)}<path class="f-yo-fitil" d="M-20 16L0-2 20-20" pathLength="1" stroke="#B5E0FF" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
      break;
    case 'isi':
    case 'bayram':
    case 'esik5':
      ic = `${k(15, 1, 0, 2, 'f-yo-nabiz')}<g class="f-yo-koz" fill="none" stroke="#FF9A3C" stroke-width="3.4" stroke-linecap="round"><path d="M0-19a21 21 0 0 1 18 11"/><path d="M19 7a21 21 0 0 1-11 13"/><path d="M-9 20a21 21 0 0 1-11-14"/></g>`;
      break;
    case 'roket':
    case 'nisan':
      ic = `<path class="f-yo-iz" d="M-30 0H30" stroke="#FFF4C2" stroke-width="5" stroke-linecap="round" opacity=".5"/>${k(14, 0, 0, 0)}<path d="M-13 0H13M13 0l-5-4M13 0l-5 4M-13 0l5-4M-13 0l5 4" stroke="url(#ftl-pirinc)" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
      if (oge === 'nisan') ic = `<g transform="rotate(-45)">${ic}</g>`;
      break;
    case 'kafes':
      ic = `<g class="f-yo-salla">${hedefIc({ tur: 'kafes' }, palet)}</g>`;
      break;
    case 'kasimpati':
      ic = `${k(15, 2, 0, 0)}<g class="f-yo-don"><path d="M0-10L2-2 10 0 2 2 0 10-2 2-10 0-2-2zM-7-7l5 3M7-7l-3 5M7 7l-5-3M-7 7l3-5" fill="#FFF3D6" stroke="#FFF3D6" stroke-width="1"/></g><circle class="f-yo-halka" r="22" fill="none" stroke="#2EE07A" stroke-width="2"/>`;
      break;
    case 'islak':
      ic = `<g opacity=".6">${kapsulIsaretleme(0, 14, palet, 0, 4)}</g><g class="f-yo-damla" fill="#3AA8FF"><path d="M-10-24c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z"/><path d="M8-28c3 5 4 7 4 9a4 4 0 0 1-8 0c0-2 1-4 4-9z"/></g>`;
      break;
    case 'halka':
      ic = `<g class="f-yo-don-yavas">${hedefIc({ tur: 'halka' }, palet)}</g>`;
      break;
    case 'doseme':
    case 'doseme2':
      ic = `<g class="f-yo-nabiz">${hedefIc({ tur: 'aydinlat' }, palet)}</g>${oge === 'doseme2' ? '<rect x="-21" y="-21" width="42" height="42" rx="7" fill="none" stroke="url(#ftl-pirinc)" stroke-width="2"/>' : ''}`;
      break;
    case 'fener':
      ic = `<g class="f-yo-sarkac">${hedefIc({ tur: 'fener' }, palet)}</g>`;
      break;
    case 'yildiz':
      ic = `<g class="f-yo-don">${kapsulIsaretleme(-1, 16, palet)}</g>`;
      break;
    case 'kaya':
      ic = `<g class="f-yo-salla">${hedefIc({ tur: 'kaya' }, palet)}</g>`;
      break;
    case 'kombo':
      ic = `<g class="f-yo-sol">${k(11, 0, -16, 0)}</g><g class="f-yo-sag">${k(11, 2, 16, 0)}</g><circle class="f-yo-flas" r="20" fill="url(#ftl-koz)"/>`;
      break;
    case 'devFisek':
      ic = `<g class="f-yo-zipla">${hedefIc({ tur: 'devFisek' }, palet)}</g>`;
      break;
    case 'koruk':
      ic = `<g class="f-yo-pompa"><path d="M-20-10 6-16c8-2 14 3 14 9v14c0 6-6 11-14 9l-26-6z" fill="url(#ftl-ahsap)" stroke="url(#ftl-pirinc)" stroke-width="2.4"/><path d="M-11-12v24M-3-14v28" stroke="#D9A441" stroke-width="1.6"/></g><path d="M20 0h8" stroke="url(#ftl-pirinc)" stroke-width="4" stroke-linecap="round"/><circle class="f-yo-flas" cx="30" r="6" fill="url(#ftl-koz)"/>`;
      break;
    case 'kova':
      ic = `<rect x="-24" y="-24" width="48" height="48" rx="8" fill="none" stroke="#3AA8FF" stroke-opacity=".4" stroke-width="3" class="f-yo-nabiz"/><path d="M-12-10h24l-3 24h-18z" fill="url(#ftl-ahsap)" stroke="#2A1408" stroke-width="1.6"/><path d="M-12-4h24M-11 6h22" stroke="url(#ftl-pirinc)" stroke-width="2.2"/><ellipse cx="0" cy="-10" rx="12" ry="3" fill="#3AA8FF"/><path d="M-12-10c0-12 24-12 24 0" fill="none" stroke="#7A5A3A" stroke-width="1.6"/>`;
      break;
    case 'barutIzi':
      ic = `<path d="M-26 16C-12-8 0 20 12-4S26-18 26-18" fill="none" stroke="#2A1408" stroke-width="7" stroke-linecap="round"/><path d="M-26 16C-12-8 0 20 12-4S26-18 26-18" fill="none" stroke="#5A5560" stroke-width="4" stroke-dasharray="3 2.4" stroke-linecap="round"/><path class="f-yo-fitil" pathLength="1" d="M-26 16C-12-8 0 20 12-4S26-18 26-18" fill="none" stroke="#FF9A3C" stroke-width="3" stroke-linecap="round"/>`;
      break;
    case 'altiRenk':
      for (let i = 0; i < 6; i++) ic += k(7.5, i, Math.cos((i / 6) * Math.PI * 2 - Math.PI / 2) * 19, Math.sin((i / 6) * Math.PI * 2 - Math.PI / 2) * 19, i === 5 ? 'f-yo-nabiz' : '');
      break;
    case 'delik':
      for (let i = 0; i < 9; i++) {
        const x = -18 + (i % 3) * 18;
        const y = -18 + Math.floor(i / 3) * 18;
        ic += i === 4 || i === 0 ? `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" fill="#05030A" stroke="#3A2416" stroke-dasharray="2 2"/>` : k(6.5, i % 4, x, y);
      }
      break;
    case 'desen':
      ic = `<g class="f-yo-nabiz">${motifIsaretleme('lale', 1.3)}</g>`;
      break;
    case 'meltem':
      ic = `${k(9, 1, -16, 8)}${k(9, 0, 4, 8)}${k(9, 3, 24, 8)}<g class="f-yo-ruzgar" fill="none" stroke="#B5E0FF" stroke-width="2.4" stroke-linecap="round"><path d="M-30-12h22c6 0 6-8 0-8"/><path d="M-24-4h34c6 0 6 8 0 8"/></g>`;
      break;
    case 'cisenti':
      ic = `${k(9, 1, -16, 12)}${k(9, 0, 4, 12)}${k(9, 3, 24, 12)}<g fill="#5A5A7A"><circle cx="-8" cy="-18" r="9"/><circle cx="6" cy="-20" r="11"/><circle cx="18" cy="-16" r="8"/></g><g class="f-yo-yagmur" stroke="#B5E0FF" stroke-width="2" stroke-linecap="round"><path d="M-10-6l-2 6M2-6l-2 6M14-6l-2 6"/></g>`;
      break;
    case 'is':
      ic = `<g class="f-yo-nabiz">${hedefIc({ tur: 'is' }, palet)}</g>`;
      break;
  }
  const kutu = h(
    'div',
    { s: 'f-yeni-oge', role: 'img', 'aria-label': YENI_OGE[oge].ad },
    svg(`<svg class="f-yo-svg" viewBox="-32 -32 64 64" aria-hidden="true">${ic}</svg>`),
  );
  return kutu;
}

function hedefIc(hd: Pick<HedefVM, 'tur'>, palet: Palet): string {
  const s = hedefIkonu({ ...hd, gerekli: 1, ilerleme: 0, tamam: false } as HedefVM, palet);
  return s.innerHTML;
}

/** Güçlendirici küçük resmi (ödül, tanıtım). */
export function guclendiriciResmi(id: Parameters<typeof guclendiriciIsaretleme>[0]): SVGSVGElement {
  return svg(`<svg class="f-resim" viewBox="-24 -24 48 48" aria-hidden="true">${guclendiriciIsaretleme(id)}</svg>`);
}

