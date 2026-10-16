/**
 * Bölüm öncesi kartı (§14.3): ad, mahalle, hedefler, hamle; eşik bilgisi;
 * yeni öğe önizlemesi; en iyi skor, yıldızlar, tablo küçük resmi; Coşku
 * Serisi. [Başla] ve [Geri].
 */
import { h } from '../dom';
import { ikon, kapsulIsaretleme } from '../ikonlar';
import { M, YENI_OGE, bolumBasligi, esikBilgisi, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { hedefKutusu, mahalleCipi, tabloCercevesi, yeniOgeOnizleme, kucukYildizlar } from './ortak';
import { svg } from '../dom';
import type { BolumOncesiVM } from '../tipler';
import { muhurListesi } from '../kanca';
import { MK } from '../metinler';
import { ustaIpucu } from './ortak';

export function bolumOncesiEkrani(b: Baglam, vm: BolumOncesiVM): { soz: Promise<'basla' | 'geri'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'basla' | 'geri'>();

  const ust = h('div', { s: 'f-bo-ust' }, mahalleCipi(vm.mahalle));
  const ad = h('h2', { s: 'f-baslik f-bo-ad', t: vm.ad });

  // Yıldızlar + en iyi + tablo
  const rekor = h(
    'div',
    { s: 'f-bo-rekor' },
    h('div', { s: 'f-bo-rekor-sol' }, kucukYildizlar(vm.yildiz), h('span', { s: 'f-bo-eniyi f-sayi', t: vm.enIyi != null ? `${M.enIyi}: ${sayi(vm.enIyi)}` : M.henuzOynanmadi })),
  );
  if (vm.tablo) {
    const tuval = b.geri.tabloTuvali?.(vm.id) ?? null;
    rekor.appendChild(h('div', { s: 'f-bo-tablo', title: M.tabloEtiketi }, tabloCercevesi(vm.tablo.nadirlik, tuval, false)));
  }

  const hedefler = h(
    'div',
    { s: 'f-bo-hedefler' },
    h('div', { s: 'f-etiket', t: M.hedefler }),
    h('div', { s: `f-bo-hedef-sira f-n${vm.hedefler.length}` }, vm.hedefler.map((x) => hedefKutusu(x, b.palet))),
  );

  const bilgiler = h('div', { s: 'f-bo-bilgiler' }, h('span', { s: 'f-cip' }, ikon('hamle'), h('span', { s: 'f-sayi', t: `${vm.hamle} ${M.hamle}` })));
  const esik = esikBilgisi(vm.esik);
  if (esik) bilgiler.appendChild(h('span', { s: 'f-cip f-cip-sicak' }, ikon('alev'), h('span', { t: esik })));
  if (vm.ustaKurali) bilgiler.appendChild(h('span', { s: 'f-cip f-cip-usta' }, ikon('sapka'), h('span', { t: vm.ustaKurali })));

  // (Kancalar §C.2) Hedeflerden sonra, hamle çipinden önce MÜHÜRLER bloğu.
  const muhurlu = !!vm.muhurler && vm.muhurler.length > 0;
  const muhurler = muhurlu
    ? h(
        'div',
        { s: 'f-bo-muhurler' },
        vm.muhurIpucu ? ustaIpucu(vm.muhurIpucu) : null,
        h('div', { s: 'f-etiket', t: MK.muhurler }),
        muhurListesi(vm.muhurler!),
      )
    : null;
  const icerik = h('div', { s: `f-bo${muhurlu ? ' f-muhurlu' : ''}` }, ust, ad, rekor, hedefler, muhurler, bilgiler);

  if (vm.yeniOge) {
    const yo = YENI_OGE[vm.yeniOge];
    icerik.appendChild(
      h(
        'div',
        { s: 'f-bo-yeni' },
        yeniOgeOnizleme(vm.yeniOge, b.palet),
        h('div', { s: 'f-bo-yeni-metin' }, h('span', { s: 'f-yeni-rozet', t: M.yeniOge }), h('strong', { t: yo.ad }), h('span', { t: yo.metin })),
      ),
    );
  }
  if (vm.cosku) {
    icerik.appendChild(
      h(
        'div',
        { s: 'f-bo-cosku' },
        svg(`<svg class="f-resim" viewBox="-24 -24 48 48" aria-hidden="true">${kapsulIsaretleme(0, 13, b.palet)}<path d="M-12 0H12M12 0l-5-4M12 0l-5 4M-12 0l5-4M-12 0l5 4" stroke="url(#ftl-pirinc)" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg>`),
        h('div', null, h('strong', { t: M.coskuSerisi }), h('span', { t: M.hazirRoket })),
      ),
    );
  }

  const basla = dugme(M.basla, 'birincil', () => {
    if (sec('basla')) t.kapat();
  }, { buyuk: true, odak: true, ikon: 'oynat' });
  const geri = dugme(M.geri, 'ikincil', () => {
    if (sec('geri')) t.kapat(true);
  });
  icerik.appendChild(h('div', { s: 'f-dg-sira f-bo-dugmeler f-yapiskan-alt' }, geri, basla));

  const t = b.modalAc({
    icerik,
    serit: bolumBasligi(vm.id, vm.tur),
    seritTur: vm.tur === 'usta' ? 'gece' : vm.tur === 'zor' || vm.tur === 'final' ? 'kirmizi' : 'altin',
    kapatDugmesi: true,
    perdeKapatir: true,
    onIptal: () => {
      if (sec('geri')) t.kapat(true);
    },
    sinif: `f-bolum-oncesi f-tur-${vm.tur}`,
  });
  return {
    soz,
    kapat: () => {
      if (sec('geri')) t.kapat();
    },
  };
}
