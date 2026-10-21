/**
 * Fişek Defteri (§14.10, §10.3): sekmeler Desenler · Fitiller · Gökyüzü ·
 * Tablolar · Motifler · Defter. Toz miktarı ve [Toz harca] (10 toz = 1 parça).
 * En fazla 6 desen takılır.
 */
import { h } from '../dom';
import { ikon, desenSvg, fitilSvg, motifIsaretleme } from '../ikonlar';
import { M, MOTIF_ADLARI, DEFTER_KARTLARI, NADIRLIK_ADLARI, sayi } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { tabloCercevesi, kasabaKartSatirlari } from './ortak';
import { svg } from '../dom';
import { DESENLER, FITILLER, GOKYUZU, MAHALLELER, DESEN_PARCA, EN_FAZLA_TAKILI_DESEN } from '../../app/katalog';
import type { DefterSekmesi, DefterVM, TozHedefi } from '../tipler';
import type { Motif } from '../../core/types';

const SEKMELER: DefterSekmesi[] = ['desenler', 'fitiller', 'gokyuzu', 'tablolar', 'motifler', 'defter'];
const TOZ_BEDEL = 10;

export function defterEkrani(b: Baglam, ilkVm: DefterVM, ek: { defterKartiAc?: (m: number, tur?: 'defter' | 'kasaba') => void } = {}): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  let vm = ilkVm;
  let sekme: DefterSekmesi = vm.sekme ?? 'desenler';
  let harcamaKipi = false;
  let onayBekleyen: string | null = null;

  const tozSayi = h('span', { s: 'f-sayi', t: sayi(vm.toz) });
  const tozDg = dugme(M.tozHarca, 'ikincil', () => {
    if (vm.toz < TOZ_BEDEL) {
      b.toast(M.tozYetmez);
      return;
    }
    harcamaKipi = !harcamaKipi;
    onayBekleyen = null;
    if (harcamaKipi && sekme !== 'desenler' && sekme !== 'fitiller') sekme = 'desenler';
    ciz();
  }, { ikon: 'toz', sinif: 'f-toz-dg' });
  const ust = h('div', { s: 'f-df-ust' }, h('span', { s: 'f-toz', title: M.toz }, ikon('toz'), tozSayi, h('span', { s: 'f-gizli', t: M.toz })), tozDg);
  const sekmeler = h('div', { s: 'f-sekmeler', role: 'tablist' });
  const ipucu = h('p', { s: 'f-df-ipucu', 'aria-live': 'polite' });
  const govde = h('div', { s: 'f-df-govde', role: 'tabpanel' });

  const yenile = (yeni: DefterVM | void) => {
    if (yeni) vm = yeni;
    ciz();
  };
  const harca = (hedef: TozHedefi) => {
    const yeni = b.geri.tozHarca?.(hedef);
    harcamaKipi = false;
    onayBekleyen = null;
    b.ses('parca');
    yenile(yeni);
  };

  const ciz = () => {
    tozSayi.textContent = sayi(vm.toz);
    tozDg.classList.toggle('f-secili', harcamaKipi);
    tozDg.disabled = false;
    sekmeler.replaceChildren(
      ...SEKMELER.map((s) => {
        const d = h('button', { type: 'button', role: 'tab', 'aria-selected': String(s === sekme), t: M.sekmeler[s] });
        d.addEventListener('click', () => {
          sekme = s;
          if (s !== 'desenler' && s !== 'fitiller') harcamaKipi = false;
          onayBekleyen = null;
          ciz();
        });
        return d;
      }),
    );
    const secili = sekmeler.querySelector<HTMLElement>('[aria-selected="true"]');
    if (secili) sekmeler.scrollLeft = Math.max(0, secili.offsetLeft - (sekmeler.clientWidth - secili.offsetWidth) / 2);
    ipucu.textContent = harcamaKipi ? M.tozHarcaIpucu : '';
    ipucu.classList.toggle('f-goster', harcamaKipi);
    govde.replaceChildren(sekmeIcerigi());
    govde.scrollTop = 0;
  };

  const sekmeIcerigi = (): HTMLElement => {
    switch (sekme) {
      case 'desenler': {
        const takiliSayi = vm.desenler.filter((d) => d.takili).length;
        return h(
          'div',
          { s: 'f-df-izgara' },
          DESENLER.map((d, i) => {
            const v = vm.desenler.find((x) => x.id === d.id) ?? { id: d.id, parca: 0, takili: false };
            const tam = v.parca >= DESEN_PARCA;
            const kart = h(
              'div',
              { s: `f-df-kart${tam ? ' f-tam' : ''}${v.takili ? ' f-takili' : ''}` },
              h('div', { s: 'f-df-resim' }, desenSvg(d.id, tam || v.parca > 0, i)),
              h('strong', { s: 'f-df-ad', t: d.ad }),
              parcaNoktalari(v.parca),
            );
            if (harcamaKipi && !tam) kart.appendChild(harcamaDugmesi(`d:${d.id}`, () => harca({ tur: 'desen', id: d.id })));
            else if (tam) {
              const tak = h('button', { s: `f-df-tak${v.takili ? ' f-takili' : ''}`, type: 'button', 'aria-pressed': String(v.takili), t: v.takili ? M.takili : M.tak });
              tak.addEventListener('click', () => {
                if (!v.takili && takiliSayi >= EN_FAZLA_TAKILI_DESEN) {
                  b.toast(M.enFazla6);
                  return;
                }
                yenile(b.geri.desenTak?.(d.id, !v.takili));
              });
              kart.appendChild(tak);
            }
            return kart;
          }),
        );
      }
      case 'fitiller':
        return h(
          'div',
          { s: 'f-df-liste' },
          FITILLER.map((d) => {
            const v = vm.fitiller.find((x) => x.id === d.id) ?? { id: d.id, parca: d.baslangicta ? 3 : 0, secili: false };
            const tam = v.parca >= DESEN_PARCA;
            const satir = h(
              'div',
              { s: `f-df-satir${tam ? ' f-tam' : ''}${v.secili ? ' f-secili' : ''}` },
              h('div', { s: 'f-df-fitil' }, fitilSvg(d.id, tam || v.parca > 0)),
              h('div', { s: 'f-df-satir-metin' }, h('strong', { t: d.ad }), d.sandiktan || tam ? parcaNoktalari(v.parca) : h('small', { t: `${M.fenerNobeti} 30` })),
            );
            if (harcamaKipi && !tam && d.sandiktan) satir.appendChild(harcamaDugmesi(`f:${d.id}`, () => harca({ tur: 'fitil', id: d.id })));
            else if (tam) {
              const s = h('button', { s: `f-df-tak${v.secili ? ' f-takili' : ''}`, type: 'button', 'aria-pressed': String(v.secili), t: v.secili ? M.secili : M.sec });
              s.addEventListener('click', () => {
                if (!v.secili) yenile(b.geri.fitilSec?.(d.id));
              });
              satir.appendChild(s);
            }
            return satir;
          }),
        );
      case 'gokyuzu':
        return h(
          'div',
          { s: 'f-df-gok-izgara' },
          MAHALLELER.map((m) => {
            const g = GOKYUZU[m.gokyuzu];
            const v = vm.gokyuzleri.find((x) => x.id === m.gokyuzu) ?? { id: m.gokyuzu, acik: false, secili: false };
            const kart = h(
              'button',
              { s: `f-df-gok${v.acik ? '' : ' f-kilitli'}${v.secili ? ' f-secili' : ''}`, type: 'button', 'aria-pressed': String(v.secili), css: { '--ust': g.ust, '--alt': g.alt } },
              gokOnizleme(m.vurgu),
              h('span', { s: 'f-df-gok-ad' }, h('strong', { t: g.ad }), h('small', { t: v.acik ? (v.secili ? M.secili : m.ad) : M.kilitli })),
              v.acik ? null : h('span', { s: 'f-df-kilit' }, ikon('kilit')),
            );
            kart.addEventListener('click', () => {
              if (!v.acik) b.toast(`${m.ad}: ${M.defterKilitli}`);
              else if (!v.secili) yenile(b.geri.gokyuzuSec?.(m.gokyuzu));
            });
            return kart;
          }),
        );
      case 'tablolar':
        if (vm.tablolar.length === 0) return h('p', { s: 'f-bos-metin', t: M.tabloYok });
        return h(
          'div',
          { s: 'f-df-tablolar' },
          vm.tablolar.map((t) =>
            h(
              'figure',
              { s: 'f-df-tablo' },
              tabloCercevesi(t.nadirlik, b.geri.tabloTuvali?.(t.bolumId) ?? null, false),
              h('figcaption', null, h('strong', { t: t.ad }), h('small', { t: NADIRLIK_ADLARI[t.nadirlik] })),
            ),
          ),
        );
      case 'motifler':
        return h(
          'div',
          { s: 'f-df-motifler' },
          (['lale', 'kayik', 'fener', 'carkifelek', 'mart', 'burc'] as Motif[]).map((m) => {
            const acik = vm.motifler.find((x) => x.motif === m)?.acik ?? false;
            return h(
              'div',
              { s: `f-df-motif${acik ? ' f-acik' : ''}` },
              svg(`<svg viewBox="-24 -24 48 48" class="f-resim" aria-hidden="true"><rect x="-22" y="-22" width="44" height="44" rx="9" fill="#120A1E"/>${motifIsaretleme(m, 1.15, acik)}</svg>`),
              h('span', { t: acik ? MOTIF_ADLARI[m] : '?' }),
            );
          }),
        );
      case 'defter':
        return h(
          'div',
          { s: 'f-kart-liste' },
          MAHALLELER.map((m, i) => {
            const acik = !!vm.kartlar[i];
            const dg = h(
              'button',
              { s: `f-kart-satir${acik ? '' : ' f-kilitli'}`, type: 'button', css: { '--vurgu': m.vurgu } },
              h('i'),
              h('span', null, h('strong', { t: acik ? DEFTER_KARTLARI[i].baslik : m.ad }), h('small', { t: acik ? m.ad : M.defterKilitli })),
              ikon(acik ? 'ileri' : 'kilit'),
            );
            dg.addEventListener('click', () => (acik ? ek.defterKartiAc?.(i) : b.toast(M.defterKilitli)));
            return dg;
          }),
          // (Kancalar §B.5) Süslenen mahallelerin kasaba kartları (sakinin mektubu).
          kasabaKartSatirlari(vm.kasabaKartlari, (i) => ek.defterKartiAc?.(i, 'kasaba')),
        );
    }
  };

  const harcamaDugmesi = (anahtar: string, onayla: () => void): HTMLElement => {
    if (onayBekleyen === anahtar) {
      const evet = h('button', { s: 'f-df-harca f-onayla', type: 'button' }, ikon('tik'), h('span', { t: M.tozHarcaOnay }));
      evet.addEventListener('click', onayla);
      return evet;
    }
    const d = h('button', { s: 'f-df-harca', type: 'button', 'aria-label': `${M.tozHarca}: +1` }, ikon('toz'), h('span', { s: 'f-sayi', t: `+1 · ${TOZ_BEDEL}` }));
    d.addEventListener('click', () => {
      onayBekleyen = anahtar;
      ciz();
    });
    return d;
  };

  const icerik = h('div', { s: 'f-df' }, ust, sekmeler, ipucu, govde);
  const kapat = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: M.fisekDefteri, seritTur: 'gece', genislik: 'tam', kapatDugmesi: true, onIptal: kapat, sinif: 'f-defter' });
  ciz();
  return { soz, kapat };
}

function parcaNoktalari(n: number): HTMLElement {
  return h(
    'span',
    { s: 'f-parca-noktalar', role: 'img', 'aria-label': M.parca(Math.min(n, DESEN_PARCA), DESEN_PARCA) },
    Array.from({ length: DESEN_PARCA }, (_, i) => h('i', { s: i < n ? 'f-dolu' : '' })),
  );
}

function gokOnizleme(vurgu: string): SVGSVGElement {
  let y = '';
  for (let i = 0; i < 14; i++) y += `<circle cx="${(i * 37) % 100}" cy="${(i * 17) % 34}" r="${i % 3 ? 0.7 : 1.1}" fill="#fff" opacity=".7"/>`;
  return svg(`<svg class="f-df-gok-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">${y}
    <path d="M0 48h10v-8h6v4h8v-12h4v12h10v-6h8v-6l4-4 4 4v6h12v6h10v-14h4v14h20v12H0z" fill="#120A1E"/>
    <circle cx="70" cy="18" r="5" fill="${vurgu}" opacity=".9"/><circle cx="70" cy="18" r="12" fill="${vurgu}" opacity=".2"/></svg>`);
}
