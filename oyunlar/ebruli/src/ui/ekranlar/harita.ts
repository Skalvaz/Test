/**
 * Atölye haritası (GDD §12.3 #2): dikey kaydırılan kâğıt rulo. Her atölye
 * bir sayfa: başlık (Cormorant), çiçek motifi, atölyenin tablo şeridi ve
 * atölyenin suyunda mermer bir yol boyunca suya damlamış boya noktaları
 * (açık: renkli + yıldızlar; sıradaki: nabız; kilitli: silik). En altta
 * kilitli "Devamı yakında" sayfası. Üstte toplam yıldız; altta Galeri,
 * Nasıl oynanır, Ayarlar. Son açık bölüme kendiliğinden kayar.
 *
 * Düğüme dokunmak bölüm öncesi kartını haritanın üstünde açar; harita
 * yalnız "Başla" ile çözülür (galeri/ayarlar da harita açıkken üstte açılır).
 */
import { t } from '../../platform/dil';
import { h, svg } from '../dom';
import { IKON, KARANFIL, LALE, RUMI, SILUET, YILDIZ_DOLU } from '../ikonlar';
import { damlaResmi, img } from '../gorsel';
import { M, bolumEtiketi, yildizEtiketi } from '../metinler';
import { dugme, tabloResmi, yildizSirasi } from './ortak';
import type { EkranYoneticisi } from './cekirdek';
import type { HaritaAtolyeVM, HaritaBolumVM, HaritaVM } from '../tipler';

export interface HaritaGeri {
  /** Düğüme dokunuldu: bölüm öncesi kartı (Başla → true). */
  bolumKarti(id: number): Promise<boolean>;
  galeri(): void;
  ayarlar(): void;
  nasil(): void;
  devami(): void;
}

const ARALIK = 92;
const UST_PAY = 64;

function konumlar(n: number): { x: number; y: number }[] {
  const l: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) l.push({ x: 50 + 27 * Math.sin(i * 1.05 + 0.4), y: UST_PAY + i * ARALIK });
  return l;
}

/** Catmull-Rom → kübik Bezier yol (x yüzde, y piksel). */
function yolCiz(p: { x: number; y: number }[]): string {
  if (!p.length) return '';
  let s = `M ${p[0].x} ${p[0].y - 50}`;
  s += ` L ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)];
    const b = p[i];
    const c = p[i + 1];
    const d = p[Math.min(p.length - 1, i + 2)];
    const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 };
    const c2 = { x: c.x - (d.x - b.x) / 6, y: c.y - (d.y - b.y) / 6 };
    s += ` C ${c1.x.toFixed(2)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(1)}, ${c.x.toFixed(2)} ${c.y.toFixed(1)}`;
  }
  const son = p[p.length - 1];
  s += ` L ${son.x} ${son.y + 50}`;
  return s;
}

function dugum(b: HaritaBolumVM, k: { x: number; y: number }, sec: (id: number) => void): HTMLElement {
  const sinif = ['e-dugum', b.acik ? 'acik' : 'kilitli', b.siradaki ? 'siradaki' : '', b.kazanildi ? 'kazanildi' : '', b.tur === 'zor' ? 'zor' : ''].filter(Boolean).join(' ');
  const el = h('button', {
    s: sinif,
    type: 'button',
    'data-id': String(b.id),
    'aria-label': b.acik ? `${bolumEtiketi(b.id)}: ${b.ad}${b.kazanildi ? `, ${yildizEtiketi(b.yildiz)}` : ''}` : `${bolumEtiketi(b.id)}: ${M.kilitli}`,
    css: { left: `${k.x}%`, top: `${k.y}px` },
  });
  el.appendChild(img(damlaResmi(b.renk, 76, 'yok', 'yatay', true), 76, 'e-dugum-damla'));
  el.appendChild(h('b', { s: 'e-dugum-no', t: String(b.id) }));
  if (b.kazanildi) el.appendChild(yildizSirasi(b.yildiz, 'e-dugum-yildiz'));
  if (!b.acik) {
    const kl = svg(IKON.kilit);
    kl.classList.add('e-dugum-kilit');
    el.appendChild(kl);
  }
  if (b.tur === 'zor') el.appendChild(h('span', { s: 'e-dugum-zor', t: 'zor' }));
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.acik) sec(b.id);
    else {
      el.classList.remove('titre');
      void el.offsetWidth;
      el.classList.add('titre');
    }
  });
  return el;
}

function sayfa(a: HaritaAtolyeVM, sec: (id: number) => void): HTMLElement {
  const motif = svg(a.cicek === 'lale' ? LALE : KARANFIL);
  motif.classList.add('e-sayfa-motif');
  const motif2 = svg(a.cicek === 'lale' ? LALE : KARANFIL);
  motif2.classList.add('e-sayfa-motif', 'sag');
  const rumi = svg(RUMI);
  rumi.classList.add('e-rumi');
  const serit = h('div', { s: 'e-serit', 'aria-label': t(`${a.ad} tabloları`, `${a.ad} paintings`) });
  const kazanilan = new Map(a.tablolar.map((t) => [t.id, t]));
  for (const b of a.bolumler) {
    const t = kazanilan.get(b.id);
    if (t) serit.appendChild(tabloResmi(t.ciz, 26, 39, 'e-serit-tablo'));
    else serit.appendChild(h('i', { s: 'e-serit-bos' }));
  }
  const p = konumlar(a.bolumler.length);
  const yukseklik = UST_PAY * 2 + (a.bolumler.length - 1) * ARALIK;
  const yol = svg(
    `<svg class="e-yol" viewBox="0 0 100 ${yukseklik}" preserveAspectRatio="none" aria-hidden="true"><path class="e-yol-kenar" d="${yolCiz(p)}"/><path class="e-yol-govde" d="${yolCiz(p)}"/><path class="e-yol-damar" d="${yolCiz(p)}"/></svg>`,
  );
  const tekne = h('div', { s: 'e-tekne', css: { height: `${yukseklik}px` } }, yol);
  a.bolumler.forEach((b, i) => tekne.appendChild(dugum(b, p[i], sec)));
  return h(
    'section',
    { s: `e-sayfa e-sayfa-${a.id}`, 'data-atolye': a.id },
    h('header', { s: 'e-sayfa-bas' }, motif, motif2, h('div', { s: 'e-sayfa-ad' }, h('h2', { t: a.ad }), h('p', { t: a.altBaslik })), rumi, serit),
    tekne,
  );
}

function yakinda(devamiAcik: boolean, ac: () => void): HTMLElement {
  const sil = h('div', { s: 'e-siluetler', 'aria-hidden': 'true' });
  for (const [ad, s] of [
    ['Kapadokya', SILUET.kapadokya],
    ['Ege', SILUET.ege],
    ['Saray', SILUET.saray],
  ] as const) {
    const k = h('figure', { s: 'e-siluet' });
    k.append(svg(s), h('figcaption', { t: ad }));
    sil.appendChild(k);
  }
  const kl = svg(IKON.kilit);
  kl.classList.add('e-yakinda-kilit');
  const s = h('section', { s: `e-sayfa e-yakinda${devamiAcik ? ' acik' : ''}` }, h('header', { s: 'e-sayfa-bas' }, kl, h('div', { s: 'e-sayfa-ad' }, h('h2', { t: M.devamiYakinda }), h('p', { t: M.devamiAlt }))), sil);
  if (devamiAcik) {
    s.setAttribute('role', 'button');
    s.setAttribute('tabindex', '0');
    s.addEventListener('click', () => ac());
  }
  return s;
}

export function haritaEkrani(y: EkranYoneticisi, vm: HaritaVM, geri: HaritaGeri): Promise<number | null> {
  return y.ac<number | null>({ sinif: 'e-harita', geri: null }, (bitir, kok) => {
    let kartAcik = false;
    const acik = (): boolean => kok.isConnected && !kok.classList.contains('cik');
    const sec = async (id: number): Promise<void> => {
      if (kartAcik || !acik()) return;
      kartAcik = true;
      const basla = await geri.bolumKarti(id);
      kartAcik = false;
      if (basla && acik()) bitir(id);
    };
    const yildiz = svg(YILDIZ_DOLU);
    const ust = h(
      'header',
      { s: 'e-harita-ust' },
      h('div', { s: 'e-logo', t: M.oyunAdi }),
      h('div', { s: 'e-toplam', 'aria-label': yildizEtiketi(vm.toplamYildiz) }, yildiz, h('b', { t: String(vm.toplamYildiz) }), h('small', { t: `/ ${vm.enCokYildiz}` })),
    );
    const rulo = h('div', { s: 'e-rulo' });
    for (const a of vm.atolyeler) rulo.appendChild(sayfa(a, (id) => void sec(id)));
    rulo.appendChild(yakinda(vm.devamiAcik, () => geri.devami()));
    const alt = h(
      'footer',
      { s: 'e-harita-alt' },
      dugme(M.galeri, { tur: 'ikincil', ikon: 'galeri', on: () => geri.galeri() }),
      dugme(M.nasil, { tur: 'ikincil', ikon: 'soru', on: () => geri.nasil(), sinif: 'e-nasil-dugme' }),
      dugme(M.ayarlar, { tur: 'ikincil', ikon: 'ayarlar', on: () => geri.ayarlar() }),
    );
    // Son açık bölüme kay; gerekirse kartı aç.
    requestAnimationFrame(() => {
      const d = rulo.querySelector<HTMLElement>(`.e-dugum[data-id="${vm.odak}"]`);
      if (d) {
        const rr = rulo.getBoundingClientRect();
        const dr = d.getBoundingClientRect();
        rulo.scrollTop += dr.top - rr.top - rr.height * 0.45;
      }
      if (vm.kartAc !== null) {
        const id = vm.kartAc;
        setTimeout(() => void sec(id), 650);
      }
    });
    return [rulo, ust, alt];
  });
}
