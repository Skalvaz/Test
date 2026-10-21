/**
 * Bölüm öncesi kartı (§14.3; "Liste" düzeni, Ekim 2026): ad; hedefler büyük
 * yazılı liste (ikon + metin), hamle ve bölüm kuralları aynı listede;
 * mühürler tek satır "Mühürler 1/3" (görev metinleri Duraklat'ta). Mahalle
 * çipi, yıldızlar/en iyi, tablo, yeni öğe ve Coşku kartları yok.
 * Büyük bulmaca oyunlarındaki gibi tek büyük [Oyna]; geri dönüş köşedeki X
 * (ve perde/Esc).
 */
import { h } from '../dom';
import { ikon, muhurSvg } from '../ikonlar';
import { M, MK, bolumBasligi, esikBilgisi, hedefMetni } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { hedefKutusu, ustaIpucu } from './ortak';
import type { BolumOncesiVM } from '../tipler';

export function bolumOncesiEkrani(b: Baglam, vm: BolumOncesiVM): { soz: Promise<'basla' | 'geri'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'basla' | 'geri'>();

  const ad = h('h2', { s: 'f-baslik f-bo-ad', t: vm.ad });

  // Hedefler büyük yazılı liste (ikon + metin); altında hamle ve varsa bölüm kuralları.
  const satir = (ikonEl: Element, metin: string, sinif?: string) =>
    h('li', { s: sinif }, h('span', { s: 'f-bo-liste-ikon' }, ikonEl), h('span', { t: metin }));
  const liste = h(
    'ul',
    { s: 'f-bo-liste', 'aria-label': M.hedefler },
    vm.hedefler.map((x) => satir(hedefKutusu(x, b.palet).firstElementChild!, hedefMetni(x))),
    satir(ikon('hamle'), M.hamleAdet(vm.hamle), 'f-bo-liste-hamle'),
  );
  const esik = esikBilgisi(vm.esik);
  if (esik) liste.appendChild(satir(ikon('alev'), esik, 'f-bo-liste-kural'));
  if (vm.ustaKurali) liste.appendChild(satir(ikon('sapka'), vm.ustaKurali, 'f-bo-liste-kural'));

  // (Kancalar §C.2) Mühürler tek satır: "Mühürler 1/3" + üç işaret; görev metinleri Duraklat'ta.
  const muhurler = vm.muhurler && vm.muhurler.length ? vm.muhurler : null;
  const basili = muhurler ? muhurler.filter((m) => m.basili).length : 0;
  const muhurBlok = muhurler
    ? h(
        'div',
        { s: 'f-bo-muhurler' },
        vm.muhurIpucu ? ustaIpucu(vm.muhurIpucu) : null,
        h(
          'div',
          { s: 'f-bo-muhur-sira', role: 'img', 'aria-label': `${MK.muhurler}: ${basili}/3` },
          h('span', { s: 'f-bo-muhur-yazi', t: `${MK.muhurler} ${basili}/3` }),
          muhurler.map((m) => h('span', { s: `f-bo-muhur-tek${m.basili ? ' f-basili' : ''}` }, muhurSvg(m.kademe, m.basili))),
        ),
      )
    : null;
  const icerik = h('div', { s: 'f-bo' }, ad, liste, muhurBlok);
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
