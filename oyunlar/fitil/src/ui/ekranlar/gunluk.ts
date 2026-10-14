/**
 * Günün Şenliği (§14.11, §10.5): bugünün tahtası küçük resmi, en iyi skor,
 * görevler, Fener Nöbeti, [Oyna] [Paylaş] [Arşiv]. Paylaşım metni panoya
 * kopyalanır; reddedilirse metin seçili gösterilir.
 */
import { h, panoyaKopyala, metniSec, svg } from '../dom';
import { ikon, alevSvg, kapsulIsaretleme } from '../ikonlar';
import { M, SERI_BASAMAKLARI, sayi, tarihUzun, tarihKisa, sonrakiSeriBasamagi, seriBasamakAdi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { kucukYildizlar } from './ortak';
import { paylasimMetni } from '../paylasim';
import { Rng } from '../../platform/rng';
import type { GunlukSecimi, GunlukVM, Palet } from '../tipler';

export function gunlukEkrani(b: Baglam, vm: GunlukVM, ek: { kucukResim?: HTMLCanvasElement | null } = {}): { soz: Promise<GunlukSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<GunlukSecimi>();
  const bitir = (s: GunlukSecimi, sesli = false) => {
    if (sec(s)) t.kapat(sesli);
  };

  const resim = h('div', { s: 'f-gn-resim' }, ek.kucukResim ?? tahtaOnizleme(vm.tarih, b.palet));
  const ozet = h(
    'div',
    { s: 'f-gn-ozet' },
    h('span', { s: 'f-etiket', t: tarihUzun(vm.tarih) }),
    kucukYildizlar(vm.yildiz),
    h('span', { s: 'f-gn-eniyi f-sayi', t: vm.enIyi != null ? `${M.enIyi}: ${sayi(vm.enIyi)}` : M.henuzOynanmadi }),
    !vm.kazanildi ? h('small', { s: 'f-gn-sandik' }, ikon('sandik'), h('span', { t: M.ilkKazancSandik })) : null,
  );

  const gorevler = h(
    'section',
    { s: 'f-gn-bolum' },
    h('h3', { s: 'f-etiket', t: M.gunlukGorev }),
    h(
      'ul',
      { s: 'f-gn-gorevler' },
      vm.gorevler.map((g) =>
        h(
          'li',
          { s: `f-gn-gorev${g.tamam ? ' f-tamam' : ''}` },
          h('span', { s: 'f-gn-gorev-tik' }, ikon(g.tamam ? 'tik' : 'sandik')),
          h(
            'span',
            { s: 'f-gn-gorev-metin' },
            h('span', { t: g.metin }),
            h('span', { s: 'f-gn-gorev-cubuk' }, h('i', { css: { '--o': String(Math.min(1, g.gerekli > 0 ? g.ilerleme / g.gerekli : 0)) } })),
          ),
          h('span', { s: 'f-gn-gorev-sayi f-sayi', t: `${Math.min(g.ilerleme, g.gerekli)}/${g.gerekli}` }),
        ),
      ),
    ),
  );

  // Fener Nöbeti merdiveni
  const sonraki = sonrakiSeriBasamagi(vm.seri.gun);
  const seri = h(
    'section',
    { s: 'f-gn-bolum f-gn-seri' },
    h('h3', { s: 'f-etiket', t: M.fenerNobeti }),
    h(
      'div',
      { s: 'f-gn-seri-ust' },
      alevSvg('f-gn-alev'),
      h('div', null, h('strong', { s: 'f-sayi', t: M.seriMetni(vm.seri.gun) }), h('small', { t: vm.seri.basamak ? seriBasamakAdi(vm.seri.basamak) : '' })),
    ),
    h(
      'ol',
      { s: 'f-gn-merdiven' },
      SERI_BASAMAKLARI.map((s) => h('li', { s: vm.seri.gun >= s.gun ? 'f-gecti' : '' }, h('i'), h('span', { t: s.ad }), h('small', { s: 'f-sayi', t: String(s.gun) }))),
    ),
    sonraki ? h('p', { s: 'f-not', t: M.sonrakiBasamak(sonraki.ad, sonraki.kalan) }) : null,
    h('p', { s: 'f-not', t: M.seriNotu }),
  );

  // Paylaşım ve arşiv paneli
  const panel = h('div', { s: 'f-gn-panel' });
  const paylas = vm.paylasim
    ? dugme(M.paylas, 'ikincil', async () => {
        const metin = paylasimMetni(vm.paylasim!);
        const alan = h('textarea', { s: 'f-kod f-paylasim', readonly: true, rows: String(metin.split('\n').length), wrap: 'off', spellcheck: 'false', 'aria-label': M.paylas }) as HTMLTextAreaElement;
        alan.value = metin;
        panel.replaceChildren(alan);
        if (await panoyaKopyala(metin)) b.toast(M.kopyalandi);
        else {
          metniSec(alan);
          b.toast(M.kopyalanamadi, 2600);
        }
      }, { ikon: 'paylas' })
    : null;
  const arsiv = dugme(M.arsiv, 'ikincil', () => {
    if (panel.dataset.acik === 'arsiv') {
      panel.replaceChildren();
      panel.dataset.acik = '';
      return;
    }
    panel.dataset.acik = 'arsiv';
    panel.replaceChildren(
      h(
        'div',
        { s: 'f-gn-arsiv' },
        h('p', { s: 'f-not', t: M.arsivNotu }),
        vm.arsiv.map((a, i) => {
          const dg = h(
            'button',
            { s: 'f-gn-arsiv-satir', type: 'button' },
            h('span', { s: 'f-sayi', t: i === 0 ? `${M.dun} · ${tarihKisa(a.tarih)}` : tarihKisa(a.tarih) }),
            kucukYildizlar(a.yildiz),
            h('span', { s: 'f-sayi f-ikincil', t: a.enIyi != null ? sayi(a.enIyi) : '—' }),
            ikon('oynat'),
          );
          dg.addEventListener('click', () => bitir({ tur: 'oyna', tarih: a.tarih }));
          return dg;
        }),
      ),
    );
  }, { ikon: 'arsiv' });

  const icerik = h(
    'div',
    { s: 'f-gn' },
    h('div', { s: 'f-gn-ust' }, resim, ozet),
    dugme(M.oyna, 'birincil', () => bitir({ tur: 'oyna', tarih: vm.tarih }), { buyuk: true, odak: true, ikon: 'oynat', sinif: 'f-gn-oyna' }),
    h('div', { s: 'f-dg-sira' }, paylas, arsiv),
    panel,
    gorevler,
    seri,
  );
  const t = b.modalAc({ icerik, serit: M.gununSenligi, seritTur: 'altin', genislik: 'genis', kapatDugmesi: true, onIptal: () => bitir({ tur: 'geri' }, true), sinif: 'f-gunluk' });
  return { soz, kapat: () => bitir({ tur: 'geri' }) };
}

/** Tarih tohumuyla süs amaçlı küçük tahta (gerçek tahta verilmezse). */
function tahtaOnizleme(tarih: number, palet: Palet): SVGSVGElement {
  const r = new Rng(tarih);
  let s = '';
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 7; x++) s += kapsulIsaretleme(r.int(5), 4.6, palet, 7 + x * 12, 7 + y * 12);
  return svg(`<svg class="f-gn-tahta" viewBox="0 0 86 110" aria-hidden="true">
    <rect x="-2" y="-2" width="90" height="114" rx="8" fill="url(#ftl-ahsap)" stroke="url(#ftl-pirinc)" stroke-width="2.5"/>
    <rect x="1" y="1" width="84" height="108" rx="5" fill="#160E08"/>${s}</svg>`);
}
