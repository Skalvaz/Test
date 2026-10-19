/**
 * Bölüm öncesi kartı (§14.3; sadeleştirme Ekim 2026): ad, mahalle, yıldızlar
 * + en iyi, hedefler ve hamle, mühürler, yeni öğe tek satır, Coşku tek satır.
 * Büyük bulmaca oyunlarındaki gibi tek büyük [Oyna]; geri dönüş köşedeki X
 * (ve perde/Esc).
 */
import { h } from '../dom';
import { ikon, kapsulIsaretleme } from '../ikonlar';
import { M, YENI_OGE, bolumBasligi, esikBilgisi, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { hedefKutusu, mahalleCipi, tabloCercevesi, yeniOgeOnizleme, kucukYildizlar } from './ortak';
import { svg } from '../dom';
import type { BolumOncesiVM } from '../tipler';
import { muhurListesi } from '../kanca';
import { ustaIpucu } from './ortak';

export function bolumOncesiEkrani(b: Baglam, vm: BolumOncesiVM): { soz: Promise<'basla' | 'geri'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'basla' | 'geri'>();

  const ust = h('div', { s: 'f-bo-ust' }, mahalleCipi(vm.mahalle));
  const ad = h('h2', { s: 'f-baslik f-bo-ad', t: vm.ad });

  // Yıldızlar + en iyi + tablo
  const rekor = h(
    'div',
    { s: 'f-bo-rekor' },
    h('div', { s: 'f-bo-rekor-sol' }, kucukYildizlar(vm.yildiz), vm.enIyi != null ? h('span', { s: 'f-bo-eniyi f-sayi', t: `${M.enIyi}: ${sayi(vm.enIyi)}` }) : null),
  );
  if (vm.tablo) {
    const tuval = b.geri.tabloTuvali?.(vm.id) ?? null;
    rekor.appendChild(h('div', { s: 'f-bo-tablo', title: M.tabloEtiketi }, tabloCercevesi(vm.tablo.nadirlik, tuval, false)));
  }

  const bilgiler = h('div', { s: 'f-bo-bilgiler' }, h('span', { s: 'f-cip' }, ikon('hamle'), h('span', { s: 'f-sayi', t: `${vm.hamle} ${M.hamle}` })));
  const esik = esikBilgisi(vm.esik);
  if (esik) bilgiler.appendChild(h('span', { s: 'f-cip f-cip-sicak' }, ikon('alev'), h('span', { t: esik })));
  if (vm.ustaKurali) bilgiler.appendChild(h('span', { s: 'f-cip f-cip-usta' }, ikon('sapka'), h('span', { t: vm.ustaKurali })));
  const hedefler = h(
    'div',
    { s: 'f-bo-hedefler', 'aria-label': M.hedefler },
    h('div', { s: `f-bo-hedef-sira f-n${vm.hedefler.length}` }, vm.hedefler.map((x) => hedefKutusu(x, b.palet))),
    bilgiler,
  );


  // (Kancalar §C.2) Hedeflerden sonra, hamle çipinden önce MÜHÜRLER bloğu.
  const muhurlu = !!vm.muhurler && vm.muhurler.length > 0;
  const muhurler = muhurlu
    ? h(
        'div',
        { s: 'f-bo-muhurler' },
        vm.muhurIpucu ? ustaIpucu(vm.muhurIpucu) : null,
        muhurListesi(vm.muhurler!),
      )
    : null;
  const icerik = h('div', { s: `f-bo${muhurlu ? ' f-muhurlu' : ''}` }, ust, ad, rekor, hedefler, muhurler);

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
        h('span', { t: M.hazirRoket }),
      ),
    );
  }

  const basla = dugme(M.oyna, 'birincil', () => {
    if (sec('basla')) t.kapat();
  }, { buyuk: true, odak: true, ikon: 'oynat' });
  icerik.appendChild(h('div', { s: 'f-dg-sira f-bo-dugmeler f-yapiskan-alt' }, basla));

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
