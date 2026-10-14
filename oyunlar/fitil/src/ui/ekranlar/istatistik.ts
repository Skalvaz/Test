/** İstatistik ve Rozetler (§14.12, §10.6). */
import { h } from '../dom';
import { ikon, rozetSvg } from '../ikonlar';
import { M, ROZETLER, ROZET_SIRASI, sayi } from '../metinler';
import { secimSozu, type Baglam } from '../cekirdek';
import { kucukYildizlar } from './ortak';
import type { IstatistikVM, RozetId } from '../tipler';

export function istatistikEkrani(b: Baglam, vm: IstatistikVM, ilkSekme: 'istatistik' | 'rozetler' = 'istatistik'): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  let sekme = ilkSekme;
  const govde = h('div', { s: 'f-is-govde', role: 'tabpanel' });
  const sekmeler = h('div', { s: 'f-sekmeler f-sekmeler-orta', role: 'tablist' });

  const ciz = () => {
    sekmeler.replaceChildren(
      ...(['istatistik', 'rozetler'] as const).map((s) => {
        const acikRozet = vm.rozetler.filter((r) => r.acik).length;
        const d = h('button', { type: 'button', role: 'tab', 'aria-selected': String(s === sekme), t: s === 'istatistik' ? M.istatistik : `${M.rozetler} ${acikRozet}/${ROZET_SIRASI.length}` });
        d.addEventListener('click', () => {
          sekme = s;
          ciz();
        });
        return d;
      }),
    );
    govde.replaceChildren(sekme === 'istatistik' ? istatistikler(vm) : rozetler(vm, b));
  };

  const icerik = h('div', { s: 'f-is' }, sekmeler, govde);
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: M.istatistik, seritTur: 'gece', genislik: 'genis', kapatDugmesi: true, onIptal: kapat, sinif: 'f-istatistik' });
  ciz();
  return { soz, kapat };
}

function istatistikler(vm: IstatistikVM): HTMLElement {
  const kutu = (deger: string, etiket: string, ik: Parameters<typeof ikon>[0]) =>
    h('div', { s: 'f-is-kutu' }, ikon(ik), h('strong', { s: 'f-sayi', t: deger }), h('span', { t: etiket }));
  return h(
    'div',
    null,
    h(
      'div',
      { s: 'f-is-izgara' },
      kutu(String(vm.toplamYildiz), M.toplamYildiz, 'yildizDolu'),
      kutu(String(vm.enUzunZincir), M.enUzunZincir, 'hamle'),
      kutu(String(vm.enBuyukReaksiyon), M.enBuyukReaksiyon, 'patlama'),
      kutu(sayi(vm.toplamHalka), M.toplamHalka, 'halka'),
      kutu(sayi(vm.toplamPatlama), M.toplamPatlama, 'alev'),
      kutu(String(vm.enCokNesil), M.enCokNesil, 'dalga'),
      kutu(vm.enIyiGunluk != null ? sayi(vm.enIyiGunluk) : '—', M.enIyiGunluk, 'takvim'),
    ),
    vm.bolumSkorlari.length > 0
      ? h(
          'section',
          { s: 'f-is-rekorlar' },
          h('h3', { s: 'f-etiket', t: M.bolumRekorlari }),
          h(
            'ol',
            null,
            vm.bolumSkorlari.map((s) =>
              h('li', null, h('span', { s: 'f-is-no f-sayi', t: String(s.id) }), h('span', { s: 'f-is-ad', t: s.ad }), kucukYildizlar(s.yildiz), h('span', { s: 'f-sayi f-is-skor', t: sayi(s.enIyi) })),
            ),
          ),
        )
      : null,
  );
}

function rozetler(vm: IstatistikVM, b: Baglam): HTMLElement {
  const aciklama = h('p', { s: 'f-is-rozet-aciklama', 'aria-live': 'polite' });
  const izgara = h(
    'div',
    { s: 'f-is-rozetler' },
    ROZET_SIRASI.map((id: RozetId) => {
      const acik = vm.rozetler.find((r) => r.id === id)?.acik ?? false;
      const r = ROZETLER[id];
      const d = h('button', { s: `f-is-rozet${acik ? ' f-acik' : ''}`, type: 'button', 'aria-label': `${r.ad}: ${acik ? r.kosul : M.rozetKilitli}` }, rozetSvg(id, acik), h('span', { t: r.ad }));
      d.addEventListener('click', () => {
        izgara.querySelectorAll('.f-secili').forEach((x) => x.classList.remove('f-secili'));
        d.classList.add('f-secili');
        aciklama.replaceChildren(h('strong', { t: r.ad }), h('span', { t: r.kosul }), h('small', { t: acik ? '' : M.rozetKilitli }));
        b.ses('dugme');
      });
      return d;
    }),
  );
  return h('div', null, aciklama, izgara);
}
