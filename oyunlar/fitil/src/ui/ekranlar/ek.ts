/**
 * Entegrasyonun (P5) eklediği küçük arayüz parçaları:
 *  - bekleme: Günün Şenliği / Sonsuz Şenlik tahtası üretilirken ilerleme kartı
 *    (üretim zaman dilimli çalışır, ana iş parçacığı kilitlenmez).
 *  - eksen seçici: Fişek Kalıbı'nda roketin eksenini seçmek için hücrenin
 *    yanında 4 yön düğmesi (§9; dokunmatikte sürükleme yerine tek dokunuş).
 */
import { h, svg } from '../dom';
import { ikon, ustaSvg } from '../ikonlar';
import { M } from '../metinler';
import { secimSozu, type Baglam } from '../cekirdek';
import type { Eksen } from '../../core/types';
import { t as tt } from '../../platform/dil';

export interface BeklemeTutamak {
  /** 0..1 */
  ilerleme(o: number): void;
  kapat(): void;
}

export function beklemeEkrani(b: Baglam, metin: string, alt?: string, iptal?: () => void): BeklemeTutamak {
  const dolgu = h('div', { s: 'f-cubuk-dolgu', css: { '--o': '0.04' } });
  const icerik = h(
    'div',
    { s: 'f-bekleme' },
    h('div', { s: 'f-bekleme-ust' }, ustaSvg('f-usta-buyuk'), h('div', null, h('strong', { t: metin }), alt ? h('p', { t: alt }) : null)),
    h('div', { s: 'f-cubuk f-bekleme-cubuk', role: 'progressbar', 'aria-label': metin }, dolgu),
  );
  const t = b.modalAc({ icerik, etiket: metin, sinif: 'f-bekleme-modal', kapatDugmesi: !!iptal, onIptal: iptal ? () => iptal() : undefined });
  b.duyur(metin);
  let son = 0.04;
  return {
    ilerleme(o: number) {
      const v = Math.max(son, Math.min(1, o));
      if (v - son < 0.01 && v < 1) return;
      son = v;
      dolgu.style.setProperty('--o', v.toFixed(3));
    },
    kapat() {
      t.kapat();
    },
  };
}

const EKSEN_ACI: Record<Eksen, number> = { 0: 0, 1: 90, 2: -45, 3: 45 };
const EKSEN_ADI: Record<Eksen, string> = tt<Record<Eksen, string>>(
  { 0: 'Yatay', 1: 'Dikey', 2: 'Çapraz ↗', 3: 'Çapraz ↘' },
  { 0: 'Horizontal', 1: 'Vertical', 2: 'Diagonal ↗', 3: 'Diagonal ↘' },
);
const YON_SEC = tt('Roketin yönünü seç', 'Pick the rocket’s direction');
const ROKET = tt('Roket', 'Rocket');

function okSvg(aci: number): SVGSVGElement {
  return svg(`<svg class="f-eksen-ok" viewBox="-20 -20 40 40" aria-hidden="true"><g transform="rotate(${aci})">
    <path d="M-13 0H13" stroke="#1A0C04" stroke-width="7" stroke-linecap="round"/>
    <path d="M-13 0H13" stroke="url(#ftl-altin)" stroke-width="4" stroke-linecap="round"/>
    <path d="M7-6 14 0 7 6M-7-6-14 0-7 6" fill="none" stroke="#1A0C04" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M7-6 14 0 7 6M-7-6-14 0-7 6" fill="none" stroke="#FFF4C2" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`);
}

/**
 * Fişek Kalıbı ekseni: hücre merkezinin (kök öğeye göre CSS px) üstünde ya
 * da altında 4 yön düğmesi. Boşluğa dokunmak ya da Esc iptal eder (null).
 */
export function eksenSecici(b: Baglam, merkez: { x: number; y: number }, hucre: number, ekranW: number): { soz: Promise<Eksen | null>; kapat: () => void } {
  const { soz, sec } = secimSozu<Eksen | null>();
  const bitir = (e: Eksen | null) => {
    if (!sec(e)) return;
    kok.classList.add('f-cikis');
    document.removeEventListener('keydown', tus, true);
    setTimeout(() => kok.remove(), 160);
  };
  const tus = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      bitir(null);
    }
  };
  const dugmeler = ([0, 1, 2, 3] as Eksen[]).map((e) => {
    const d = h('button', { s: 'f-yuvarlak f-eksen-dg', type: 'button', 'aria-label': `${ROKET}: ${EKSEN_ADI[e]}` }, okSvg(EKSEN_ACI[e]));
    d.addEventListener('click', (ev) => {
      ev.stopPropagation();
      bitir(e);
    });
    return d;
  });
  const iptal = h('button', { s: 'f-yuvarlak f-eksen-iptal', type: 'button', 'aria-label': M.iptal }, ikon('kapat'));
  iptal.addEventListener('click', (ev) => {
    ev.stopPropagation();
    bitir(null);
  });
  const genislik = 4 * 52 + 44 + 4 * 8 + 20;
  const ustte = merkez.y - hucre * 0.6 - 64 > 70;
  const sol = Math.max(8, Math.min(ekranW - genislik - 8, merkez.x - genislik / 2));
  const ust = ustte ? merkez.y - hucre * 0.6 - 64 : merkez.y + hucre * 0.6 + 8;
  const serit = h(
    'div',
    { s: 'f-eksen-serit', role: 'group', 'aria-label': YON_SEC, css: { left: `${Math.round(sol)}px`, top: `${Math.round(ust)}px` } },
    dugmeler,
    iptal,
  );
  const etiket = h('div', { s: 'f-eksen-etiket', t: YON_SEC, css: { left: `${Math.round(sol + genislik / 2)}px`, top: `${Math.round(ustte ? ust - 30 : ust + 64)}px` } });
  const kok = h('div', { s: 'f-eksen-kok' }, serit, etiket);
  kok.addEventListener('pointerup', (e) => {
    if (e.target === kok) bitir(null);
  });
  b.ustKatman.appendChild(kok);
  document.addEventListener('keydown', tus, true);
  requestAnimationFrame(() => {
    kok.classList.add('f-giris');
    dugmeler[0].focus({ preventScroll: true });
  });
  return { soz, kapat: () => bitir(null) };
}
