/** Duraklat (§14.5): [Devam] [Yeniden başla] [Ayarlar] [Haritaya dön]. */
import { h } from '../dom';
import { hedefIkonu } from '../ikonlar';
import { M, bolumBasligi, hedefKalan, hedefEtiketi, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { DuraklatSecimi, DuraklatVM } from '../tipler';
import { ikon } from '../ikonlar';
import { muhurListesi } from '../kanca';

export function duraklatEkrani(b: Baglam, vm: DuraklatVM): { soz: Promise<DuraklatSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<DuraklatSecimi>();
  const secVeKapat = (s: DuraklatSecimi, sesli = false) => {
    if (sec(s)) t.kapat(sesli);
  };

  const hedefler = h(
    'div',
    { s: 'f-dr-hedefler' },
    vm.hedefler.map((x) =>
      h(
        'div',
        { s: `f-dr-hedef${x.tamam ? ' f-tamam' : ''}`, 'aria-label': hedefEtiketi(x) },
        hedefIkonu(x, b.palet),
        x.tamam ? h('span', { s: 'f-dr-tik' }, ikon('tik')) : h('span', { s: 'f-sayi', t: sayi(hedefKalan(x)) }),
      ),
    ),
  );
  const yeniden = dugme(M.yenidenBasla, 'ikincil', () => secVeKapat('yeniden'), { ikon: 'tekrar' });
  const icerik = h(
    'div',
    { s: 'f-dr' },
    h('div', { s: 'f-dr-bolum' }, h('span', { s: 'f-etiket', t: bolumBasligi(vm.bolumId) }), h('h2', { s: 'f-baslik', t: vm.bolumAdi })),
    hedefler,
    // (Kancalar §C.4) Hedeflerin altında üç mühür ve anlık durumları.
    vm.muhurler && vm.muhurler.length ? muhurListesi(vm.muhurler, { durumlu: true, ustaEli: !!vm.ustaEli, sinif: 'f-dr-muhurler' }) : null,
    h(
      'div',
      { s: 'f-dg-sutun' },
      dugme(M.devam, 'birincil', () => secVeKapat('devam', true), { buyuk: true, odak: true, ikon: 'oynat' }),
      yeniden,
      vm.coskuAktif ? h('p', { s: 'f-not f-not-uyari', t: M.coskuBozulur }) : null,
      dugme(M.ayarlar, 'ikincil', () => secVeKapat('ayarlar'), { ikon: 'ayar' }),
      dugme(M.haritayaDon, 'ikincil', () => secVeKapat('harita'), { ikon: 'harita' }),
    ),
  );
  const t = b.modalAc({
    icerik,
    serit: M.duraklatildi,
    seritTur: 'gece',
    kapatDugmesi: true,
    onIptal: () => secVeKapat('devam', true),
    sinif: 'f-duraklat',
  });
  return { soz, kapat: () => secVeKapat('devam') };
}
