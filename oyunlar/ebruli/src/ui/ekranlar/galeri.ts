/**
 * Galeri — "Ebru Defteri" (GDD §9.4, §12.3 #8) ve Devamı yakında (#11).
 * Atölye sekmeleri; 4 sütunlu kartlar; kazanılmış kart dokununca tam boy +
 * künye (teknikler, nadirlik). Kilitli kartlar suda silik damla.
 */
import { h, svg } from '../dom';
import { RUMI, SILUET, YILDIZ_DOLU } from '../ikonlar';
import { damlaResmi, img } from '../gorsel';
import { M, sayi } from '../metinler';
import { NADIRLIK, TEKNIKLER } from '../../app/katalog';
import { dugme, kart, tabloResmi, yildizSirasi } from './ortak';
import type { EkranYoneticisi } from './cekirdek';
import type { DevamiVM, GaleriKartVM, GaleriVM } from '../tipler';

function rumi(): SVGSVGElement {
  const r = svg(RUMI);
  r.classList.add('e-rumi');
  return r;
}

function teknikAdi(id: string): string {
  return TEKNIKLER.find((t) => t.id === id)?.ad ?? id;
}

export function tabloBuyukEkrani(y: EkranYoneticisi, k: GaleriKartVM, atolyeAd: string, W: number, H: number): Promise<void> {
  return y.ac<void>({ sinif: 'e-tablo-buyuk', geri: undefined, perde: true, perdeKapatir: true }, (bitir) => {
    const tw = Math.floor(Math.min(W - 48, (H - 260) * (2 / 3), 420));
    const th = Math.floor(tw * 1.5);
    const teknikler = h('ul', { s: 'e-teknikler' });
    for (const t of k.teknikler) {
      const tn = TEKNIKLER.find((x) => x.id === t);
      teknikler.appendChild(h('li', null, h('b', { t: teknikAdi(t) }), tn ? h('span', { t: ` — ${tn.aciklama}` }) : null));
    }
    const kapat = dugme(M.kapat, { tur: 'ana', on: () => bitir() });
    kapat.setAttribute('data-odak', '');
    return h(
      'div',
      { s: 'e-tb-ic' },
      h('div', { s: `e-tb-cerceve n${k.nadirlik}` }, tabloResmi(k.ciz!, tw, th, 'e-tb-tablo')),
      kart(
        'e-tb-kunye',
        h('div', { s: 'e-ust-bilgi', t: `${atolyeAd} · Bölüm ${k.id} · ${NADIRLIK[k.nadirlik] ?? ''}` }),
        h('h3', { t: k.ad }),
        h('div', { s: 'e-tb-satir' }, yildizSirasi(k.yildiz), h('span', { t: `${sayi(k.puan)} ${M.puan}` })),
        teknikler,
        h('div', { s: 'e-dugmeler' }, kapat),
      ),
    );
  });
}

export function galeriEkrani(y: EkranYoneticisi, vm: GaleriVM, W: number, H: number): Promise<void> {
  return y.ac<void>({ sinif: 'e-galeri e-sayfali', geri: undefined }, (bitir) => {
    let secili = vm.atolyeler.find((a) => a.id === vm.baslangic) ?? vm.atolyeler[0];
    const sekmeler = h('div', { s: 'e-segmentli e-sekmeler', role: 'tablist' });
    const izgara = h('div', { s: 'e-izgara', role: 'tabpanel' });
    const sayac = h('div', { s: 'e-galeri-sayac' });
    const ciz = (): void => {
      izgara.textContent = '';
      // Sayfa payı 12+12, kart iç payı 16+16, kenar 2+2.
      const kw = Math.floor(Math.min(110, (Math.min(W - 24, 560) - 36 - 3 * 10) / 4));
      const kh = Math.round(kw * 1.5);
      let n = 0;
      for (const k of secili.kartlar) {
        const el = h('button', { s: `e-gkart${k.ciz ? ' dolu' : ''} n${k.nadirlik}`, type: 'button', 'aria-label': k.ciz ? `Bölüm ${k.id}: ${k.ad}` : `Bölüm ${k.id}: henüz tablo yok` });
        if (k.ciz) {
          n++;
          el.appendChild(tabloResmi(k.ciz, kw, kh, 'e-gkart-tablo'));
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            void tabloBuyukEkrani(y, k, secili.ad, W, H);
          });
        } else {
          const bos = h('div', { s: 'e-gkart-bos', css: { width: `${kw}px`, height: `${kh}px` } });
          bos.appendChild(img(damlaResmi(k.renk, Math.round(kw * 0.5), 'yok', 'yatay', true), Math.round(kw * 0.5)));
          el.appendChild(bos);
        }
        el.appendChild(h('span', { s: 'e-gkart-alt' }, h('b', { t: String(k.id) }), k.ciz ? yildizSirasi(k.yildiz, 'e-gkart-yildiz') : null));
        izgara.appendChild(el);
      }
      sayac.textContent = `${n} / ${secili.kartlar.length}`;
      for (const b of sekmeler.children) b.setAttribute('aria-selected', String((b as HTMLElement).dataset.id === secili.id));
    };
    for (const a of vm.atolyeler) {
      const b = h('button', { s: 'e-seg', type: 'button', role: 'tab', 'data-id': a.id, t: a.ad });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        secili = a;
        ciz();
      });
      sekmeler.appendChild(b);
    }
    ciz();
    const kapat = dugme('', { tur: 'yuvarlak', ikon: 'kapat', ad: M.kapat, sinif: 'e-kose-kapat', on: () => bitir() });
    return h(
      'div',
      { s: 'e-sayfa-ic' },
      kapat,
      h('h2', { t: M.ebruDefteri }),
      rumi(),
      sekmeler,
      sayac,
      izgara,
      h('p', { s: 'e-not', t: M.galeriBos }),
    );
  });
}

export function devamiEkrani(y: EkranYoneticisi, vm: DevamiVM, W: number): Promise<'galeri' | 'harita'> {
  return y.ac<'galeri' | 'harita'>({ sinif: 'e-devami e-sayfali', geri: 'harita' }, (bitir) => {
    const mozaik = h('div', { s: 'e-mozaik' });
    const kw = Math.floor(Math.min(64, (Math.min(W - 24, 560) - 36 - 4 * 6) / 5));
    for (const t of vm.tablolar) {
      if (t.ciz) mozaik.appendChild(tabloResmi(t.ciz, kw, Math.round(kw * 1.5), 'e-mozaik-tablo'));
      else {
        const b = h('div', { s: 'e-mozaik-bos', css: { width: `${kw}px`, height: `${Math.round(kw * 1.5)}px` } });
        b.appendChild(img(damlaResmi(t.renk, Math.round(kw * 0.5)), Math.round(kw * 0.5)));
        mozaik.appendChild(b);
      }
    }
    const sil = h('div', { s: 'e-siluetler dalgali', 'aria-hidden': 'true' });
    for (const [ad, s] of [
      ['Kapadokya', SILUET.kapadokya],
      ['Ege', SILUET.ege],
      ['Saray', SILUET.saray],
    ] as const) {
      const f = h('figure', { s: 'e-siluet' });
      f.append(svg(s), h('figcaption', { t: ad }));
      sil.appendChild(f);
    }
    const yildiz = svg(YILDIZ_DOLU);
    const galeri = dugme(M.galeriyiAc, { tur: 'ana', ikon: 'galeri', on: () => bitir('galeri') });
    galeri.setAttribute('data-odak', '');
    return h(
      'div',
      { s: 'e-sayfa-ic' },
      h('h2', { t: M.devamiBaslik }),
      rumi(),
      mozaik,
      h('div', { s: 'e-toplam koyu' }, yildiz, h('b', { t: String(vm.toplamYildiz) }), h('small', { t: `/ ${vm.enCokYildiz}` })),
      h('p', { s: 'e-devami-metin', t: M.devamiMetin }),
      sil,
      h('div', { s: 'e-dugmeler' }, dugme(M.haritayaDon, { tur: 'ikincil', ikon: 'harita', on: () => bitir('harita') }), galeri),
    );
  });
}
