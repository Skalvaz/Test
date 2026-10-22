/**
 * Kaybettin (§14.7, §11 kancaları 11, 12, 13, 31): "%92 — 3 kızıl kaldı"
 * çubuğu; hayalet fitil ("Bu çizgi kazandırırdı" / [Tekrar izle]);
 * büyük [Tekrar dene] (< 1 sn), [Haritaya dön]; 4. ve sonraki başarısızlıkta
 * gönüllü Kıvılcım Usta'nın Eli.
 *
 * (CAN-REKLAM §6) Gelir sağlayıcısı varken: başlığın altında tek satır
 * "−1 can · 3 kaldı" (`vm.can`); Usta'nın Eli'nin yerinde "+5 hamle" (reklam
 * simgeli; Usta kartıyla simgesiz "Ücretsiz +5 hamle"; ikisi birlikte olmaz);
 * can kalmadıysa "Tekrar dene" yerine "Can bitti" (seçim 'canBitti'). "Can
 * yok, bekleme yok" notu sağlayıcı varken çıkmaz (yanlış olur). Sağlayıcı
 * yokken ekran eskisiyle birebir.
 *
 * 'hayalet' seçilince kart kapanır; entegratör hayaleti tahtada 2 kez
 * oynatır ve kartı `hayalet: 'izlendi'` ile yeniden açar.
 */
import { h } from '../dom';
import { fitilCanSvg, hedefIkonu, ustaSvg } from '../ikonlar';
import { M, MC, kalanMetni, kayipBasligi, yuzde } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import type { KaybettinSecimi, KaybettinVM } from '../tipler';
import { ikon } from '../ikonlar';

/** Sağlayıcı var mı: açık bayrak ya da can/reklam alanlarından biri dolu. */
export function kaybettinGelirli(vm: KaybettinVM): boolean {
  return !!vm.gelirVar || vm.can != null || vm.reklamHamle != null || !!vm.canBitti;
}

export function kaybettinEkrani(b: Baglam, vm: KaybettinVM): { soz: Promise<KaybettinSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<KaybettinSecimi>();
  const secVeKapat = (s: KaybettinSecimi) => {
    if (sec(s)) t.kapat();
  };
  const o = Math.max(0, Math.min(1, vm.yuzde));

  const cubuk = h(
    'div',
    { s: 'f-kb-cubuk' },
    h('div', { s: 'f-cubuk' }, h('div', { s: 'f-cubuk-dolgu', css: { '--o': '0' } })),
    h('span', { s: 'f-kb-yuzde f-sayi', t: yuzde(o), css: { '--o': String(o) } }),
  );
  const kalan = vm.enZorHedef
    ? h('div', { s: 'f-kb-kalan' }, hedefIkonu(vm.enZorHedef, b.palet), h('span', { t: kalanMetni(vm.enZorHedef) }))
    : null;
  const ilerleme = h('div', { s: 'f-kb-ilerleme', role: 'img', 'aria-label': `${yuzde(o)}${vm.enZorHedef ? `, ${kalanMetni(vm.enZorHedef)}` : ''}` }, cubuk, kalan);

  const icerik = h(
    'div',
    // f-kb-gelirli: alçak ekranda (360×640) can satırı eklenince düğmeler kaydırmasız sığsın (gelir.css).
    { s: kaybettinGelirli(vm) ? 'f-kb f-kb-gelirli' : 'f-kb' },
    h('h2', { s: 'f-baslik f-kb-baslik', t: kayipBasligi(o) }),
    // (CAN-REKLAM §2) Kayıpta düşen can: başlığın hemen altında tek satır.
    vm.can ? h('p', { s: 'f-kb-can', role: 'status' }, fitilCanSvg('f-kb-can-fitil', false), h('span', { s: 'f-sayi', t: MC.kayipCan(vm.can.kalan) })) : null,
    ilerleme,
  );

  if (vm.hayalet !== 'yok') {
    const izlendi = vm.hayalet === 'izlendi';
    const hd = h(
      'button',
      { s: 'f-kb-hayalet', type: 'button' },
      h('span', { s: 'f-kb-hayalet-ikon' }, ikon(izlendi ? 'tekrar' : 'goz')),
      h('span', { s: 'f-kb-hayalet-metin' }, h('strong', { t: izlendi ? M.tekrarIzle : M.buCizgiKazandirirdi }), izlendi ? h('small', { t: M.buCizgiKazandirirdi }) : null),
    );
    hd.addEventListener('click', () => secVeKapat('hayalet'));
    icerik.appendChild(hd);
  }

  // Usta'nın Eli sunuluyorsa reklam teklifi yok (C7); "+5 hamle" Eli'nin yerinde.
  const reklam = !vm.ustaEli && vm.reklamHamle ? vm.reklamHamle : null;
  icerik.appendChild(
    h(
      'div',
      { s: 'f-dg-sutun f-kb-dugmeler' },
      vm.canBitti
        ? dugme(MC.canBitti, 'birincil', () => secVeKapat('canBitti'), { buyuk: true, odak: true, ikon: 'fitil', sinif: 'f-kb-can-bitti' })
        : dugme(M.tekrarDene, 'birincil', () => secVeKapat('tekrar'), { buyuk: true, odak: true, ikon: 'tekrar' }),
      vm.ustaEli ? ustaEliPaneli(() => secVeKapat('ustaEli')) : null,
      reklam
        ? dugme(reklam.kart ? MC.ucretsizBesHamle : MC.artiBesHamle, 'ikincil', () => secVeKapat('reklamHamle'), {
            ikon: reklam.kart ? undefined : 'reklam',
            sinif: 'f-kb-reklam',
            etiket: reklam.kart ? undefined : MC.reklamBesHamle,
          })
        : null,
      dugme(M.haritayaDon, 'ikincil', () => secVeKapat('harita'), { ikon: 'harita' }),
    ),
  );
  if (vm.coskuSifirlandi) icerik.appendChild(h('p', { s: 'f-not', t: M.coskuSifirlandi }));
  if (!kaybettinGelirli(vm)) icerik.appendChild(h('p', { s: 'f-not f-kb-ucretsiz', t: M.ucretsizTekrar }));

  const t = b.modalAc({
    icerik,
    serit: M.hamlelerBitti,
    seritTur: 'kirmizi',
    onIptal: () => secVeKapat('harita'),
    sinif: 'f-kaybettin',
    ses: 'kaybettin',
  });
  // Çubuk dolarak gelsin.
  requestAnimationFrame(() =>
    setTimeout(() => {
      (cubuk.querySelector('.f-cubuk-dolgu') as HTMLElement).style.setProperty('--o', String(o));
      cubuk.classList.add('f-doldu');
    }, b.az() ? 0 : 260),
  );
  return { soz, kapat: () => secVeKapat('harita') };
}

function ustaEliPaneli(tikla: () => void): HTMLElement {
  const dg = dugme(M.ustaEliDugme, 'birincil', tikla, { ikon: 'el', sinif: 'f-usta-eli-dg' });
  return h(
    'div',
    { s: 'f-usta-eli' },
    ustaSvg(),
    h('div', { s: 'f-usta-eli-metin' }, h('strong', { t: M.ustaEliBaslik }), h('span', { t: M.ustaEliMetin })),
    dg,
  );
}
