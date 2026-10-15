/**
 * Kazandın (§14.6, §12.2): yıldızlar 300 ms arayla mühürlenir, YENİ REKOR,
 * puan sayılarak artar, sandık dokun-aç, Gece Tablosu önizlemesi ve
 * nadirlik etiketi ([Sakla] / [Eskisini koru]), "Sıradaki: X!".
 * Düğmeler: [Devam] (büyük) ve [Tekrar oyna].
 */
import { h, say, bekle } from '../dom';
import { yildizSvg, sandikSvg, ikon, type IkonAdi } from '../ikonlar';
import { M, NADIRLIK_ADLARI, bolumBasligi, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { odulOgesi, tabloCercevesi, yeniOgeOnizleme, ustaIpucu, nadirlikSirasi } from './ortak';
import type { KazandinVM, SandikVM } from '../tipler';

const YILDIZ_ILK = 520;
const YILDIZ_ARA = 300;

export function kazandinEkrani(
  b: Baglam,
  vm: KazandinVM,
  ek: { tablo?: HTMLCanvasElement | null } = {},
): { soz: Promise<'devam' | 'tekrar'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'devam' | 'tekrar'>();
  const az = b.az();
  const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
  const sonra = (ms: number, fn: () => void) => zamanlayicilar.push(setTimeout(fn, az ? 0 : ms));
  let sayimIptal: (() => void) | null = null;

  // ── Yıldızlar
  const yildizlar = [0, 1, 2].map((i) => {
    const altin = yildizSvg(true, 'f-kz-altin');
    const kivilcim = h('span', { s: 'f-kz-kivilcim' }, Array.from({ length: 10 }, (_, k) => h('i', { css: { '--a': `${k * 36 + 8}deg` } })));
    return h('div', { s: `f-kz-yildiz f-y${i}` }, yildizSvg(false, 'f-kz-yuva'), h('span', { s: 'f-kz-halka' }), kivilcim, altin);
  });
  const yildizSira = h('div', { s: 'f-kz-yildizlar', role: 'img', 'aria-label': `${vm.yildiz}/3 yıldız` }, yildizlar);
  const rekor = h('div', { s: `f-kz-rekor${vm.yeniRekor ? '' : ' f-yok'}`, 'aria-hidden': vm.yeniRekor ? undefined : 'true' }, h('span', { t: M.yeniRekor }));
  const puanSayi = h('span', { s: 'f-kz-puan-sayi f-sayi', t: '0' });
  const puan = h('div', { s: 'f-kz-puan' }, h('span', { s: 'f-etiket', t: M.puan }), puanSayi);

  const icerik = h(
    'div',
    { s: 'f-kz' },
    h('div', { s: 'f-kz-bolum' }, h('span', { s: 'f-etiket', t: bolumBasligi(vm.bolumId, vm.tur) }), h('span', { s: 'f-kz-ad', t: vm.bolumAdi })),
    yildizSira,
    h('div', { s: 'f-kz-orta' }, puan, rekor),
  );

  // ── Ödüller: sandık + tablo
  const oduller = h('div', { s: 'f-kz-oduller' });
  if (vm.sandiklar.length > 0) oduller.appendChild(sandikKutusu(b, vm.sandiklar));
  let tabloKarari: boolean | null = null;
  if (vm.tablo) {
    const tb = vm.tablo;
    const kutu = h('div', { s: 'f-kz-tablo' }, tabloCercevesi(tb.nadirlik, ek.tablo ?? null));
    if (tb.eskiVar) {
      const varsayilan = !tb.eskiNadirlik || nadirlikSirasi(tb.nadirlik) >= nadirlikSirasi(tb.eskiNadirlik);
      tabloKarari = varsayilan;
      const sakla = h('button', { type: 'button', role: 'radio', t: M.sakla });
      const koru = h('button', { type: 'button', role: 'radio', t: M.eskisiniKoru });
      const boya = () => {
        sakla.setAttribute('aria-checked', String(tabloKarari === true));
        koru.setAttribute('aria-checked', String(tabloKarari === false));
      };
      sakla.addEventListener('click', () => {
        tabloKarari = true;
        boya();
      });
      koru.addEventListener('click', () => {
        tabloKarari = false;
        boya();
      });
      boya();
      kutu.appendChild(h('div', { s: 'f-parcali f-kz-tablo-sec', role: 'radiogroup', 'aria-label': M.tabloEtiketi }, sakla, koru));
      if (tb.eskiNadirlik) kutu.appendChild(h('small', { s: 'f-kz-eski', t: `Eski: ${NADIRLIK_ADLARI[tb.eskiNadirlik]}` }));
    }
    oduller.appendChild(kutu);
  }
  if (oduller.childElementCount > 0) {
    oduller.classList.add(`f-n${oduller.childElementCount}`);
    icerik.appendChild(oduller);
  }

  if (vm.duyurular && vm.duyurular.length) {
    icerik.appendChild(
      h(
        'ul',
        { s: 'f-kz-duyurular', 'aria-label': 'Kazanılanlar' },
        vm.duyurular.map((d) => h('li', { s: 'f-kz-duyuru' }, ikon(d.ikon as IkonAdi), h('span', { t: d.metin }))),
      ),
    );
  }
  if (vm.sonrakiTanitim) {
    icerik.appendChild(
      h('div', { s: 'f-kz-sonraki' }, vm.sonrakiOge ? yeniOgeOnizleme(vm.sonrakiOge, b.palet) : null, h('span', { t: vm.sonrakiTanitim })),
    );
  }
  if (vm.ipucu) icerik.appendChild(ustaIpucu(vm.ipucu));

  const bitir = (s: 'devam' | 'tekrar') => {
    if (!sec(s)) return;
    zamanlayicilar.forEach(clearTimeout);
    sayimIptal?.();
    if (vm.tablo?.eskiVar && tabloKarari !== null) b.geri.tabloKarari?.(vm.bolumId, tabloKarari);
    t.kapat();
  };
  icerik.appendChild(
    h(
      'div',
      { s: 'f-dg-sira f-kz-dugmeler f-yapiskan-alt' },
      dugme(M.tekrarOyna, 'ikincil', () => bitir('tekrar'), { ikon: 'tekrar' }),
      dugme(M.devam, 'birincil', () => bitir('devam'), { buyuk: true, odak: true }),
    ),
  );

  const baslik = M.kazandinBaslik[Math.max(0, Math.min(3, vm.yildiz))];
  const t = b.modalAc({
    icerik,
    serit: baslik,
    seritTur: 'altin',
    genislik: 'genis',
    onIptal: () => bitir('devam'),
    sinif: 'f-kazandin',
    ses: 'kazandin',
  });
  const isinlar = h('div', { s: 'f-isinlar', 'aria-hidden': 'true' });
  t.modal.insertBefore(isinlar, t.kart);

  // ── Zaman çizelgesi
  for (let i = 0; i < vm.yildiz; i++) {
    sonra(YILDIZ_ILK + i * YILDIZ_ARA, () => {
      yildizlar[i].classList.add('f-muhur');
      b.ses((['yildiz1', 'yildiz2', 'yildiz3'] as const)[i]);
      b.titret(i === 2 ? [25, 30, 40] : 20);
    });
  }
  const yildizSonu = YILDIZ_ILK + Math.max(0, vm.yildiz - 1) * YILDIZ_ARA + 260;
  sonra(380, () => {
    sayimIptal = say(puanSayi, 0, vm.puan, az ? 0 : 1100, sayi);
  });
  if (vm.yeniRekor) {
    sonra(Math.max(yildizSonu, 1500) + 120, () => {
      rekor.classList.add('f-goster');
      b.ses('parca');
      b.duyur(M.yeniRekor);
    });
  }
  sonra(Math.max(yildizSonu, 1500) + 260, () => icerik.classList.add('f-sonraki-goster'));
  return { soz, kapat: () => bitir('devam') };
}

/** Sandık: dokun-aç, birden çok sandıkta sırayla (§10.4). */
function sandikKutusu(b: Baglam, sandiklar: SandikVM[]): HTMLElement {
  let sira = 0;
  let durum: 'kapali' | 'aciliyor' | 'acik' = 'kapali';
  const resimYeri = h('span', { s: 'f-sandik-resim' }, sandikSvg(sandiklar[0].tur, false));
  const etiket = h('span', { s: 'f-sandik-etiket', t: M.sandikAc });
  const sayac = h('span', { s: 'f-sandik-sayac f-sayi' });
  const liste = h('div', { s: 'f-sandik-oduller', 'aria-live': 'polite' });
  const dg = h(
    'button',
    { s: `f-sandik f-tur-${sandiklar[0].tur}`, type: 'button', 'aria-label': M.sandikAc },
    h('span', { s: 'f-sandik-isin', 'aria-hidden': 'true' }),
    resimYeri,
    etiket,
    sayac,
  );
  const sayacYaz = () => {
    sayac.textContent = sandiklar.length > 1 ? `${sira + 1}/${sandiklar.length}` : '';
  };
  sayacYaz();
  dg.addEventListener('click', async () => {
    if (durum === 'aciliyor') return;
    if (durum === 'acik') {
      if (sira + 1 >= sandiklar.length) return;
      sira++;
      liste.textContent = '';
      dg.className = `f-sandik f-tur-${sandiklar[sira].tur}`;
      resimYeri.replaceChildren(sandikSvg(sandiklar[sira].tur, false));
      sayacYaz();
    }
    durum = 'aciliyor';
    const s = sandiklar[sira];
    dg.classList.add('f-sallan');
    etiket.textContent = '';
    await bekle(b.az() ? 0 : 300);
    dg.classList.remove('f-sallan');
    dg.classList.add('f-acik');
    resimYeri.replaceChildren(sandikSvg(s.tur, true));
    b.ses('sandik');
    b.titret([20, 40, 30]);
    s.oduller.forEach((o, i) => {
      liste.appendChild(odulOgesi(o, 160 + i * 150));
      if (o.tur === 'desenParcasi' || o.tur === 'fitilParcasi') setTimeout(() => b.ses('parca'), b.az() ? 0 : 200 + i * 150);
    });
    durum = 'acik';
    if (sira + 1 < sandiklar.length) {
      etiket.textContent = M.sonrakiSandik;
      dg.setAttribute('aria-label', M.sonrakiSandik);
    } else {
      dg.setAttribute('aria-disabled', 'true');
    }
  });
  return h('div', { s: 'f-kz-sandik-kutu' }, dg, liste);
}
