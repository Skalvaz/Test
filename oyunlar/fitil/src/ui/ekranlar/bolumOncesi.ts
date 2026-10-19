/**
 * Bölüm öncesi kartı (§14.3; sadeleştirme Ekim 2026): ad, hedefler ve hamle,
 * mühürler; büyük yazı. Mahalle çipi, en iyi puan, tablo küçük resmi ve
 * Coşku kartı yok (harita/tahtada görünür). Üç düzen (`tasarim.ts`, geçici).
 * Büyük bulmaca oyunlarındaki gibi tek büyük [Oyna]; geri dönüş köşedeki X
 * (ve perde/Esc).
 */
import { h } from '../dom';
import { ikon } from '../ikonlar';
import { M, YENI_OGE, bolumBasligi, esikBilgisi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { hedefKutusu, yeniOgeOnizleme, kucukYildizlar } from './ortak';
import type { BolumOncesiVM } from '../tipler';
import { muhurListesi } from '../kanca';
import { ustaIpucu } from './ortak';
import { tasarim } from '../tasarim';
import { muhurSvg } from '../ikonlar';
import { MK, hedefMetni } from '../metinler';

export function bolumOncesiEkrani(b: Baglam, vm: BolumOncesiVM): { soz: Promise<'basla' | 'geri'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'basla' | 'geri'>();

  const ad = h('h2', { s: 'f-baslik f-bo-ad', t: vm.ad });

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
  const ts = tasarim();
  // Mühürler yazısız sıra (1, 3): basılı dolu, bekleyen boş halka; kart sadeleşir.
  const muhurSirasi = muhurlu
    ? h(
        'div',
        { s: 'f-bo-muhur-sira', role: 'img', 'aria-label': `${MK.muhurler}: ${vm.muhurler!.filter((m) => m.basili).length}/3` },
        ts === '3' ? h('span', { s: 'f-bo-muhur-yazi', t: `${MK.muhurler} ${vm.muhurler!.filter((m) => m.basili).length}/3` }) : null,
        vm.muhurler!.map((m) => h('span', { s: `f-bo-muhur-tek${m.basili ? ' f-basili' : ''}` }, muhurSvg(m.kademe, m.basili))),
      )
    : null;
  // 3: hedefler büyük yazılı liste (ikon + metin), altında hamle satırı.
  const liste =
    ts === '3'
      ? h(
          'ul',
          { s: 'f-bo-liste', 'aria-label': M.hedefler },
          vm.hedefler.map((x) => h('li', null, h('span', { s: 'f-bo-liste-ikon' }, hedefKutusu(x, b.palet).firstElementChild!), h('span', { t: hedefMetni(x) }))),
          h('li', { s: 'f-bo-liste-hamle' }, h('span', { s: 'f-bo-liste-ikon' }, ikon('hamle')), h('span', { t: `${vm.hamle} ${M.hamle}` })),
        )
      : null;
  const icerik =
    ts === '1'
      ? h('div', { s: 'f-bo f-bo-t1' }, ad, hedefler, muhurSirasi)
      : ts === '3'
        ? h('div', { s: 'f-bo f-bo-t3' }, ad, liste, muhurSirasi)
        : h('div', { s: `f-bo f-bo-t2${muhurlu ? ' f-muhurlu' : ''}` }, ad, h('div', { s: 'f-bo-rekor' }, kucukYildizlar(vm.yildiz)), hedefler, muhurler);

  if (vm.yeniOge && ts === '2') {
    const yo = YENI_OGE[vm.yeniOge];
    icerik.appendChild(
      h(
        'div',
        { s: 'f-bo-yeni' },
        yeniOgeOnizleme(vm.yeniOge, b.palet),
        h('div', { s: 'f-bo-yeni-metin' }, h('strong', { t: `${M.yeniOge}: ${yo.ad}` }), h('span', { t: yo.metin })),
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
