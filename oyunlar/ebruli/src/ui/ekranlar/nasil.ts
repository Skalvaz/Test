/**
 * Nasıl oynanır (GDD §12.3 #10): 5 canlandırmalı kart — Karıştır, Eşleştir,
 * Yön, Özel taşlar, Engeller (açılmış olanlar). Altta: "Tekne cömerttir".
 * Canlandırmalar CSS (transform/opacity); damlalar oyunun çizim tarifinden.
 */
import { h, svg } from '../dom';
import { RUMI } from '../ikonlar';
import { damlaResmi, desenResmi, img, kagitResmi, mermerResmi, yagResmi, type Resim } from '../gorsel';
import { M } from '../metinler';
import { TARIFLER } from '../../app/katalog';
import { dugme } from './ortak';
import type { EkranYoneticisi } from './cekirdek';

export interface NasilVM {
  /** Açılmış öğeler (bölüm öncesi "yeni" ikonları): 'tarak', 'girdap', 'lale', 'murekkep', 'kagit', 'mermer', 'yag', 'desen'. */
  acik: ReadonlySet<string>;
}

const D = 40;

function sahne(sinif: string, ...c: Node[]): HTMLElement {
  return h('div', { s: `e-n-sahne ${sinif}`, 'aria-hidden': 'true' }, ...c);
}

function dimg(kod: Parameters<typeof damlaResmi>[0], sinif: string, ozel: Parameters<typeof damlaResmi>[2] = 'yok'): HTMLCanvasElement {
  return img(damlaResmi(kod, D, ozel), D, sinif);
}

function oge(src: Resim, ad: string, acik: boolean): HTMLElement {
  return h('figure', { s: `e-n-oge${acik ? '' : ' kilitli'}` }, img(src, 40), h('figcaption', { t: acik ? ad : '?' }));
}

export function nasilEkrani(y: EkranYoneticisi, vm: NasilVM): Promise<void> {
  return y.ac<void>({ sinif: 'e-nasil e-sayfali', geri: undefined }, (bitir) => {
    const tarifler = h('div', { s: 'e-n-tarifler' });
    for (const t of TARIFLER) tarifler.appendChild(h('span', { s: 'e-cip' }, img(damlaResmi(t.a, 20), 20), h('i', { t: '+' }), img(damlaResmi(t.b, 20), 20), h('i', { t: '=' }), img(damlaResmi(t.sonuc, 22), 22)));
    const ring = (): HTMLElement => h('i', { s: 'e-n-halka' });
    const kartlar: [string, string, HTMLElement, HTMLElement | null][] = [
      ['Karıştır', 'Bir ham boyayı farklı bir ham boyaya sürükle: yeni renk hedefte doğar.', sahne('karistir', dimg(1, 'a'), dimg(2, 'b'), dimg(3, 'c'), ring()), tarifler],
      ['Eşleştir', 'Aynı karışık renkten 3 damla değince boya suya açılır ve kâğıda geçer. Ham boyalar eşleşmez.', sahne('eslestir', dimg(3, 'a'), dimg(3, 'b'), dimg(3, 'c'), ring(), ring(), ring()), null],
      ['Yön', 'Sonuç hedefte doğar; kaynak boşalır, üstündeki damlalar bir hücre iner.', sahne('yon', dimg(5, 'u1'), dimg(4, 'u2'), dimg(1, 'k'), dimg(2, 'h'), dimg(3, 's')), null],
      [
        'Özel taşlar',
        '4 damla Tarak, 5 damla Girdap, 6 damla Lale doğurur. Özel taşı bir komşuya sürükle; iki özel taşı birbirine sürükle!',
        h(
          'div',
          { s: 'e-n-ogeler' },
          oge(damlaResmi(5, D, 'tarak'), '4: Tarak', true),
          oge(damlaResmi(6, D, 'girdap'), '5: Girdap', vm.acik.has('girdap')),
          oge(damlaResmi(0, D, 'lale'), '6: Lale', vm.acik.has('lale')),
          oge(damlaResmi(7, D, 'murekkep'), 'Mürekkep', vm.acik.has('murekkep')),
        ),
        null,
      ],
      [
        'Engeller',
        'Kâğıdın üstünde eşleştir; mermer yanındaki eşleşmeyle çatlar; yağlı damla karışmaz; desen hücresi kendi rengini ister.',
        h(
          'div',
          { s: 'e-n-ogeler' },
          oge(kagitResmi(D), 'Kâğıt', vm.acik.has('kagit')),
          oge(mermerResmi(D, 2), 'Mermer', vm.acik.has('mermer')),
          oge(yagResmi(D), 'Yağ', vm.acik.has('yag')),
          oge(desenResmi(D, 5), 'Desen', vm.acik.has('desen')),
        ),
        null,
      ],
    ];
    const liste = h('ol', { s: 'e-n-liste' });
    kartlar.forEach(([baslik, metin, gorsel, ek], i) => {
      liste.appendChild(h('li', { s: 'e-n-kart e-kart' }, h('div', { s: 'e-n-no', t: String(i + 1) }), h('h3', { t: baslik }), gorsel, h('p', { t: metin }), ek));
    });
    const r = svg(RUMI);
    r.classList.add('e-rumi');
    const kapat = dugme('', { tur: 'yuvarlak', ikon: 'kapat', ad: M.kapat, sinif: 'e-kose-kapat', on: () => bitir() });
    const tamam = dugme(M.kapat, { tur: 'ana', on: () => bitir() });
    tamam.setAttribute('data-odak', '');
    return h('div', { s: 'e-sayfa-ic' }, kapat, h('h2', { t: M.nasil }), r, liste, h('p', { s: 'e-comert', t: M.comert }), h('div', { s: 'e-dugmeler tek' }, tamam));
  });
}
