/**
 * Duraklat (§14.5; sadeleştirme Ekim 2026): tek satır bölüm, hedefler, mühürler;
 * büyük [Devam] ve altında yuvarlak simge düğmeleri [Yeniden] [Ayarlar] [Harita]
 * (büyük bulmaca oyunlarındaki küçük duraklat kutusu gibi).
 */
import { h } from '../dom';
import { hedefIkonu } from '../ikonlar';
import { M, bolumBasligi, hedefKalan, hedefEtiketi, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { DuraklatSecimi, DuraklatVM } from '../tipler';
import { ikon } from '../ikonlar';
import { muhurListesi } from '../kanca';
import { t as tt } from '../../platform/dil';

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
  const ikonDugme = (ad: string, etiket: string, ik: Parameters<typeof ikon>[0], fn: () => void) => {
    const d = h('button', { type: 'button', s: 'f-dr-ikon-dg', 'aria-label': etiket }, h('span', { s: 'f-dr-ikon-yuva' }, ikon(ik)), h('span', { s: 'f-dr-ikon-ad', t: ad }));
    d.addEventListener('click', fn);
    return d;
  };
  const icerik = h(
    'div',
    { s: 'f-dr' },
    h('div', { s: 'f-dr-bolum f-kz-bolum', t: `${bolumBasligi(vm.bolumId)} · ${vm.bolumAdi}` }),
    hedefler,
    // (Kancalar §C.4) Hedeflerin altında üç mühür ve anlık durumları.
    vm.muhurler && vm.muhurler.length ? muhurListesi(vm.muhurler, { durumlu: true, ustaEli: !!vm.ustaEli, sinif: 'f-dr-muhurler' }) : null,
    h(
      'div',
      { s: 'f-dg-sutun' },
      dugme(M.devam, 'birincil', () => secVeKapat('devam', true), { buyuk: true, odak: true, ikon: 'oynat' }),
      h(
        'div',
        { s: 'f-dr-ikonlar' },
        ikonDugme(tt('Yeniden', 'Restart'), M.yenidenBasla, 'tekrar', () => secVeKapat('yeniden')),
        ikonDugme(M.ayarlar, M.ayarlar, 'ayar', () => secVeKapat('ayarlar')),
        ikonDugme(tt('Harita', 'Map'), M.haritayaDon, 'harita', () => secVeKapat('harita')),
      ),
      vm.coskuAktif ? h('p', { s: 'f-not f-not-uyari', t: M.coskuBozulur }) : null,
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
