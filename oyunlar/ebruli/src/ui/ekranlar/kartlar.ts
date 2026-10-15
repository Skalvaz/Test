/**
 * Kart ekranları: bölüm öncesi (GDD §12.3 #3), duraklat (#5), bilgi kartı.
 */
import { h, svg } from '../dom';
import { RUMI } from '../ikonlar';
import { damlaResmi, desenResmi, img, kagitResmi, mermerResmi, yagResmi, type Resim } from '../gorsel';
import { M, sayi } from '../metinler';
import { dugme, hedefIkonu, hedefMetni, kart, tabloResmi, yildizSirasi } from './ortak';
import type { EkranYoneticisi } from './cekirdek';
import type { BolumOncesiVM, DuraklatSecimi } from '../tipler';

function rumi(): SVGSVGElement {
  const r = svg(RUMI);
  r.classList.add('e-rumi');
  return r;
}

/** Yeni öğe simgesi (oyun çizim tarifinden). */
export function yeniOgeIkonu(ikon: string, boyut: number): HTMLElement {
  const k = h('span', { s: 'e-yeni-ikon' });
  const ekle = (src: Resim, b = boyut) => k.appendChild(img(src, b));
  switch (ikon) {
    case 'karisim':
      ekle(damlaResmi(1, boyut * 0.7), boyut * 0.7);
      k.appendChild(h('i', { t: '+' }));
      ekle(damlaResmi(2, boyut * 0.7), boyut * 0.7);
      break;
    case 'mavi':
      ekle(damlaResmi(4, boyut));
      break;
    case 'tarak':
      ekle(damlaResmi(5, boyut, 'tarak', 'yatay'));
      break;
    case 'girdap':
      ekle(damlaResmi(6, boyut, 'girdap'));
      break;
    case 'lale':
      ekle(damlaResmi(0, boyut, 'lale'));
      break;
    case 'murekkep':
      ekle(damlaResmi(7, boyut, 'murekkep'));
      break;
    case 'kagit':
      ekle(kagitResmi(boyut));
      break;
    case 'mermer':
      ekle(mermerResmi(boyut, 2));
      break;
    case 'desen':
      ekle(desenResmi(boyut, 5, false));
      break;
    case 'yag':
      ekle(yagResmi(boyut));
      break;
    case 'kit':
      ekle(damlaResmi(2, boyut));
      k.classList.add('kit');
      break;
  }
  return k;
}

export function bolumOncesiEkrani(y: EkranYoneticisi, vm: BolumOncesiVM): Promise<'basla' | 'geri'> {
  return y.ac<'basla' | 'geri'>({ sinif: 'e-bolum-oncesi', geri: 'geri', perde: true, perdeKapatir: true }, (bitir) => {
    const hedefler = h('ul', { s: 'e-hedef-listesi' });
    for (const hd of vm.hedefler) hedefler.appendChild(h('li', null, hedefIkonu(hd, 34), h('span', { t: hedefMetni(hd) })));
    const bilgi = h(
      'div',
      { s: 'e-bo-bilgi' },
      h('div', { s: 'e-bo-hamle' }, h('b', { t: String(vm.hamle) }), h('small', { t: M.hamle })),
      vm.enIyi > 0 ? h('div', { s: 'e-bo-eniyi' }, h('small', { t: M.enIyi }), h('b', { t: sayi(vm.enIyi) }), yildizSirasi(vm.yildiz)) : null,
    );
    const govde = h('div', { s: 'e-bo-govde' }, h('div', { s: 'e-bo-sol' }, h('h3', { t: M.hedefler }), hedefler, bilgi));
    if (vm.tablo) govde.appendChild(h('div', { s: 'e-bo-tablo' }, tabloResmi(vm.tablo, 84, 126)));
    const yeni = vm.yeni
      ? h('div', { s: 'e-bo-yeni' }, yeniOgeIkonu(vm.yeni.ikon, 44), h('div', null, h('small', { t: `${M.yeni}: ${vm.yeni.ad}` }), h('p', { t: vm.yeni.metin })))
      : null;
    const basla = dugme(M.basla, { tur: 'ana', ikon: 'oynat', on: () => bitir('basla') });
    basla.setAttribute('data-odak', '');
    return kart(
      'e-bo-kart',
      h('div', { s: 'e-ust-bilgi', t: `${vm.atolyeAd} · Bölüm ${vm.id}${vm.tur === 'zor' ? ' · zor' : ''}` }),
      h('h2', { t: vm.ad }),
      rumi(),
      govde,
      yeni,
      h('div', { s: 'e-dugmeler' }, dugme(M.geri, { tur: 'ikincil', on: () => bitir('geri') }), basla),
    );
  });
}

export function duraklatEkrani(y: EkranYoneticisi, ad: string): Promise<DuraklatSecimi> {
  return y.ac<DuraklatSecimi>({ sinif: 'e-duraklat', geri: 'devam', perde: true, perdeKapatir: true }, (bitir) => {
    const devam = dugme(M.devam, { tur: 'ana', ikon: 'oynat', on: () => bitir('devam') });
    devam.setAttribute('data-odak', '');
    return kart(
      'e-dur-kart',
      h('div', { s: 'e-ust-bilgi', t: ad }),
      h('h2', { t: M.duraklatildi }),
      rumi(),
      h(
        'div',
        { s: 'e-dikey-dugmeler' },
        devam,
        dugme(M.yenidenBasla, { tur: 'ikincil', ikon: 'yeniden', on: () => bitir('yeniden') }),
        dugme(M.ayarlar, { tur: 'ikincil', ikon: 'ayarlar', on: () => bitir('ayarlar') }),
        dugme(M.haritayaDon, { tur: 'ikincil', ikon: 'harita', on: () => bitir('harita') }),
      ),
    );
  });
}
