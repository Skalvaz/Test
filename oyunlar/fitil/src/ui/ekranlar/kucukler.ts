/**
 * Küçük ekranlar: mola balonu (§11 kanca 30), Fener Koyu Defteri kartı
 * (mahalle tamamlanınca, §10.1), tek başına sandık (günlük görev, seri).
 */
import { h, svg, bekle as bekleme } from '../dom';
import { ustaSvg, sandikSvg } from '../ikonlar';
import { M, DEFTER_KARTLARI } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { odulOgesi } from './ortak';
import { GOKYUZU, MAHALLELER } from '../../app/katalog';
import type { DefterKartiVM, MolaSecimi, SandikVM } from '../tipler';

export function molaEkrani(b: Baglam): { soz: Promise<MolaSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<MolaSecimi>();
  const bitir = (s: MolaSecimi) => {
    if (sec(s)) t.kapat(true);
  };
  const icerik = h(
    'div',
    { s: 'f-mola' },
    h('div', { s: 'f-mola-ust' }, ustaSvg('f-usta-buyuk'), h('div', null, h('strong', { t: M.molaBaslik }), h('p', { t: M.molaMetin }))),
    h('div', { s: 'f-dg-sira' }, dugme(M.molaVer, 'ikincil', () => bitir('mola'), { ikon: 'saat' }), dugme(M.devam, 'birincil', () => bitir('devam'), { odak: true, ikon: 'oynat' })),
  );
  const t = b.modalAc({ icerik, alta: true, seffaf: true, onIptal: () => bitir('devam'), perdeKapatir: true, etiket: M.molaBaslik, sinif: 'f-mola-modal' });
  return { soz, kapat: () => bitir('devam') };
}

export function defterKartiEkrani(b: Baglam, vm: DefterKartiVM): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  const m = MAHALLELER[vm.mahalle] ?? MAHALLELER[0];
  const g = GOKYUZU[m.gokyuzu];
  const kart = DEFTER_KARTLARI[vm.mahalle] ?? DEFTER_KARTLARI[0];
  const kapak = h(
    'div',
    { s: 'f-dk-kapak', css: { '--ust': g.ust, '--alt': g.alt, '--vurgu': m.vurgu } },
    svg(`<svg viewBox="0 0 300 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${Array.from({ length: 24 }, (_, i) => `<circle cx="${(i * 53) % 300}" cy="${(i * 29) % 70}" r="${i % 4 ? 0.8 : 1.4}" fill="#fff" opacity=".75"/>`).join('')}
      <circle cx="240" cy="30" r="14" fill="#FFF4C2" opacity=".9"/><circle cx="246" cy="26" r="13" fill="${g.ust}"/>
      <path d="M0 92h20v-18h12v8h16v-30l8-10 8 10v30h14v-14h12v-8h10v22h18v-34h4v-8h6v8h4v34h22v-12l10-8 10 8v12h16v-20h24v20h14v-8h10v26H0z" fill="#120A1E"/>
      ${Array.from({ length: 16 }, (_, i) => `<rect x="${24 + ((i * 37) % 250)}" y="${66 + ((i * 7) % 18)}" width="3" height="4" fill="#FFC86B"/>`).join('')}</svg>`),
    h('span', { s: 'f-dk-mahalle', t: m.ad }),
  );
  const icerik = h(
    'div',
    { s: 'f-dk' },
    kapak,
    h('span', { s: 'f-etiket', t: M.defterBaslik }),
    h('h2', { s: 'f-baslik', t: kart.baslik }),
    h('p', { s: 'f-govde f-dk-metin', t: kart.metin }),
    vm.oduller.length ? h('div', { s: 'f-dk-oduller' }, vm.oduller.map((o, i) => odulOgesi(o, 200 + i * 120))) : null,
    dugme(M.devam, 'birincil', () => kapat(), { buyuk: true, odak: true }),
  );
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: M.mahalleTamam(m.ad), seritTur: 'altin', onIptal: kapat, sinif: 'f-defter-karti', ses: 'parca' });
  return { soz, kapat };
}

/** Tek başına sandık açma (günlük görev, Fener Nöbeti basamağı). */
export function sandikEkrani(b: Baglam, sandik: SandikVM, baslik?: string): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  let acildi = false;
  const resim = h('span', { s: 'f-sandik-resim' }, sandikSvg(sandik.tur, false));
  const etiket = h('span', { s: 'f-sandik-etiket', t: M.sandikAc });
  const liste = h('div', { s: 'f-sandik-oduller', 'aria-live': 'polite' });
  const dg = h('button', { s: `f-sandik f-sandik-buyuk f-tur-${sandik.tur}`, type: 'button', 'aria-label': M.sandikAc, 'data-odak': '' }, h('span', { s: 'f-sandik-isin' }), resim, etiket);
  const devam = dugme(M.devam, 'birincil', () => kapat(), { buyuk: true });
  devam.style.visibility = 'hidden';
  dg.addEventListener('click', async () => {
    if (acildi) return;
    acildi = true;
    dg.classList.add('f-sallan');
    etiket.textContent = '';
    await bekleme(b.az() ? 0 : 300);
    dg.classList.remove('f-sallan');
    dg.classList.add('f-acik');
    resim.replaceChildren(sandikSvg(sandik.tur, true));
    b.ses('sandik');
    b.titret([20, 40, 30]);
    sandik.oduller.forEach((o, i) => liste.appendChild(odulOgesi(o, 160 + i * 150)));
    devam.style.visibility = 'visible';
    devam.focus({ preventScroll: true });
  });
  const icerik = h('div', { s: 'f-sandik-ekrani' }, dg, liste, devam);
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: baslik ?? 'Sandık', seritTur: 'altin', onIptal: kapat, sinif: 'f-sandik-modal' });
  return { soz, kapat };
}
