/**
 * Kasaba paneli (KANCALAR §C.1): alttan açılan çekmece — başlık + kandil
 * hapı + [X]; yatay kaydırılan mahalle sekmeleri; sakin satırı ve 6 bölmeli
 * ilerleme; 6 iş kartı (işin haritadaki küçük resmi · ad · iki satıra kadar
 * açıklama · durum). Küçük resim yapılmamış işte sönük (ne geleceğini gösterir).
 * "Yap" seçimle çözülür; panel kapanır (240 ms), uygulama haritada kutlar.
 */
import { h, svg } from '../dom';
import { ikon, kandilSvg } from '../ikonlar';
import { M, MK } from '../metinler';
import { t as tt } from '../../platform/dil';
import { secimSozu, type Baglam } from '../cekirdek';
import { KASABA_ISLERI, MAHALLELER } from '../../app/katalog';
import { isOnizlemesi, onizlemeKaynagi } from '../harita/onizleme';
import type { KasabaCizimi } from '../../app/katalog';
import type { KasabaIsVM, KasabaSecimi, KasabaVM } from '../tipler';

const CIZIM: ReadonlyMap<string, KasabaCizimi> = new Map(KASABA_ISLERI.map((x) => [x.id, x.cizim]));

export function kasabaEkrani(b: Baglam, vm: KasabaVM): { soz: Promise<KasabaSecimi>; kapat: () => void } {
  const { soz, sec } = secimSozu<KasabaSecimi>();
  let secili = Math.max(0, Math.min(MAHALLELER.length - 1, vm.secili));

  const kapatDg = h('button', { s: 'f-yuvarlak f-ks-kapat', type: 'button', 'aria-label': M.kapat }, ikon('kapat'));
  kapatDg.addEventListener('click', () => kapat());
  const baslik = h(
    'header',
    { s: 'f-ks-baslik' },
    h('h2', { s: 'f-ks-ad', t: MK.kasabaBaslik }),
    h('span', { s: 'f-kandil-hap f-ks-kandil', 'aria-label': MK.kandilSayisi(vm.kandil) }, kandilSvg(), h('span', { s: 'f-sayi', t: String(vm.kandil) })),
    kapatDg,
  );

  const sekmeler = h('div', { s: 'f-ks-sekmeler f-kaydir', role: 'tablist', 'aria-label': tt('Mahalleler', 'Districts') });
  const sakin = h('div', { s: 'f-ks-sakin' });
  const liste = h('div', { s: 'f-ks-liste f-kaydir', role: 'list' });

  const sekmeCiz = () => {
    sekmeler.replaceChildren(
      ...vm.mahalleler.map((m) => {
        const mh = MAHALLELER[m.indeks];
        const kilitli = !m.acik || !m.sirada;
        const d = h(
          'button',
          {
            s: `f-ks-sekme${m.indeks === secili ? ' f-secili' : ''}${kilitli ? ' f-kilitli' : ''}${m.yapilan >= 6 ? ' f-tamam' : ''}`,
            type: 'button',
            role: 'tab',
            'aria-selected': String(m.indeks === secili),
            css: { '--vurgu': mh.vurgu },
          },
          kilitli ? ikon('kilit') : h('i', { s: 'f-ks-nokta' }),
          h('span', { t: mh.ad }),
          h('small', { s: 'f-sayi', t: `${m.yapilan}/6` }),
        );
        d.addEventListener('click', () => {
          if (secili === m.indeks) return;
          secili = m.indeks;
          sekmeCiz();
          icerikCiz();
        });
        return d;
      }),
    );
    // Seçili sekme görünür alana kaysın.
    requestAnimationFrame(() => {
      const s = sekmeler.querySelector<HTMLElement>('.f-secili');
      if (s) sekmeler.scrollLeft = Math.max(0, s.offsetLeft - (sekmeler.clientWidth - s.offsetWidth) / 2);
    });
  };

  let el: HTMLElement | null = null;
  const icerikCiz = () => {
    const m = vm.mahalleler.find((x) => x.indeks === secili) ?? vm.mahalleler[0];
    const mh = MAHALLELER[m.indeks];
    sakin.replaceChildren(
      h('span', { t: MK.sakinIsleri(m.indeks) }),
      h('span', { s: 'f-ks-ilerleme', role: 'img', 'aria-label': `${m.yapilan}/6`, css: { '--vurgu': mh.vurgu } }, Array.from({ length: 6 }, (_, i) => h('i', { s: i < m.yapilan ? 'f-dolu' : '' }))),
    );
    let ilkYap: HTMLElement | null = null;
    liste.replaceChildren(
      onizlemeKaynagi(m.indeks),
      ...m.isler.map((is) => {
        const k = isKarti(is, mh.vurgu, m.indeks);
        if (!ilkYap && is.durum === 'yapilabilir') ilkYap = k.querySelector('.f-ks-yap');
        return k;
      }),
    );
    liste.scrollTop = 0;
    el?.remove();
    el = null;
    // İlk kandil öğretimi: ilk işin "Yap"ında el animasyonu (§C.6 kasaba-ilk).
    if (vm.ogretim && ilkYap) {
      el = h('span', { s: 'f-ks-el', 'aria-hidden': 'true' }, ikon('el'));
      (ilkYap as HTMLElement).appendChild(el);
    }
  };

  const isKarti = (is: KasabaIsVM, vurgu: string, mahalle: number): HTMLElement => {
    const kart = h(
      'div',
      { s: `f-ks-is f-d-${is.durum}${is.tac ? ' f-tac' : ''}`, role: 'listitem', 'aria-label': MK.isEtiketi(is.ad, is.maliyet, MK.isDurumAdi[is.durum] ?? '') },
      h('span', { s: `f-ks-ikon${is.durum === 'yapildi' || is.durum === 'yapilabilir' ? '' : ' f-sonuk'}`, css: { '--vurgu': vurgu } }, isOnizlemesi(is.id, mahalle) ?? isIkonu(CIZIM.get(is.id) ?? 'parilti', vurgu, is.durum === 'yapildi')),
      h('span', { s: 'f-ks-metin' }, h('strong', { t: is.ad }), h('small', { t: is.aciklama })),
      isDurumu(is, mahalle),
    );
    return kart;
  };

  const isDurumu = (is: KasabaIsVM, mahalle: number): HTMLElement => {
    switch (is.durum) {
      case 'yapildi':
        return h('span', { s: 'f-ks-durum f-ks-yapildi' }, ikon('tik'), h('span', { t: MK.yapildi }));
      case 'yapilabilir': {
        const d = h('button', { s: 'f-dg f-dg-birincil f-ks-yap', type: 'button', 'aria-label': `${MK.yap}: ${is.ad}, ${MK.kandilSayisi(is.maliyet)}` }, h('span', { t: MK.yap }), h('span', { s: 'f-ks-bedel' }, kandilSvg(), h('span', { s: 'f-sayi', t: String(is.maliyet) })));
        d.addEventListener('click', () => {
          if (sec({ tur: 'yap', id: is.id })) t.kapat();
        });
        return d;
      }
      case 'yetersiz':
        return h('span', { s: 'f-ks-durum f-ks-yetersiz' }, h('span', { s: 'f-ks-bedel f-sonuk' }, kandilSvg('', false), h('span', { s: 'f-sayi', t: String(is.maliyet) })), h('small', { t: MK.eksik(is.eksik) }));
      case 'tacKilitli':
        return kilitDurumu(MK.tacKilitli);
      case 'sirada':
        return kilitDurumu(MK.sirada(MAHALLELER[Math.max(0, mahalle - 1)].ad));
      case 'haritaKilitli':
        return kilitDurumu(MK.haritaKilitli(mahalle * 5 + 1));
      default:
        return kilitDurumu(MK.kasabaKapali);
    }
  };

  const icerik = h('div', { s: 'f-ks' }, baslik, sekmeler, sakin, liste);
  sekmeCiz();
  icerikCiz();

  const kapat = () => {
    if (sec({ tur: 'kapat' })) t.kapat(true);
  };
  const t = b.modalAc({ icerik, alta: true, onIptal: kapat, perdeKapatir: true, etiket: MK.kasabaBaslik, sinif: 'f-kasaba-modal', ses: 'ac' });
  return { soz, kapat };
}

function kilitDurumu(metin: string): HTMLElement {
  return h('span', { s: 'f-ks-durum f-ks-kilit' }, ikon('kilit'), h('small', { t: metin }));
}

/**
 * İş kartı ikonu (40×40): katalogdaki çizim şablonuna göre küçük resim
 * (fener dizisi, flama, kandil dizisi, kemer, yapı ışığı, tabela, ateş,
 * parıltı). Yapılmamış işte sönük.
 */
export function isIkonu(cizim: KasabaCizimi, vurgu: string, yanik: boolean): SVGSVGElement {
  const isik = yanik ? '#FFE3A0' : '#8A6A4A';
  const kor = yanik ? 'url(#ftl-koz)' : 'none';
  let ic = '';
  switch (cizim) {
    case 'fenerDizisi':
      ic = `<path d="M2 9Q20 22 38 9" fill="none" stroke="#C9A27A" stroke-width="1.2"/>
        ${[8, 20, 32].map((x, i) => `<circle cx="${x}" cy="${i === 1 ? 20 : 17}" r="7" fill="${kor}"/><rect x="${x - 3.6}" y="${(i === 1 ? 15.5 : 12.5)}" width="7.2" height="9" rx="3" fill="${yanik ? (i === 1 ? vurgu : '#FF7A3A') : '#5A4030'}" stroke="#2A1408" stroke-width=".8"/>`).join('')}`;
      break;
    case 'flama':
      ic = `<path d="M2 8Q20 18 38 8" fill="none" stroke="#C9A27A" stroke-width="1.2"/>
        ${[6, 13, 20, 27, 34].map((x, i) => {
          const y = 8 + 10 * Math.sin((x / 40) * Math.PI) * 0.95;
          const r = yanik ? [vurgu, '#FFB020', '#FF5FB4', '#3AA8FF', vurgu][i] : '#5A4030';
          return `<path d="M${x - 3} ${y.toFixed(1)}l3 9 3-9z" fill="${r}" stroke="#2A1408" stroke-width=".6"/>`;
        }).join('')}`;
      break;
    case 'kandilDizisi':
      ic = `<path d="M4 30L36 30M8 30v-8M32 30v-8" stroke="#6A4428" stroke-width="2"/><path d="M6 22L34 22" stroke="#C9A27A" stroke-width="1"/>
        ${[8, 14, 20, 26, 32].map((x) => `<circle cx="${x}" cy="22" r="3.6" fill="${kor}"/><circle cx="${x}" cy="22" r="1.8" fill="${isik}"/>`).join('')}
        <rect x="10" y="30" width="20" height="6" fill="#3A2416"/>`;
      break;
    case 'kemer':
      ic = `<path d="M7 36V20a13 13 0 0 1 26 0v16" fill="none" stroke="#6A4428" stroke-width="4"/>
        ${Array.from({ length: 7 }, (_, i) => {
          const a = Math.PI + (i / 6) * Math.PI;
          const x = 20 + 13 * Math.cos(a);
          const y = 20 + 13 * Math.sin(a);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${kor}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.7" fill="${i % 2 ? vurgu : isik}"/>`;
        }).join('')}`;
      break;
    case 'yapiIsigi':
      ic = `${yanik ? '<circle cx="20" cy="14" r="14" fill="url(#ftl-koz)" opacity=".8"/>' : ''}<path d="M11 36V16l9-9 9 9v20z" fill="#2A1A2E" stroke="#6A4428" stroke-width="1.4"/>
        <rect x="16.5" y="17" width="7" height="8" rx="3.5" fill="${yanik ? '#FFD15C' : '#4A3A40'}"/><rect x="17.5" y="29" width="5" height="7" fill="#140C14"/>`;
      break;
    case 'tabela':
      ic = `<path d="M10 36V22M30 36V22" stroke="#6A4428" stroke-width="2.4"/><rect x="4" y="9" width="32" height="15" rx="3" fill="#3A2416" stroke="${yanik ? '#FFD15C' : '#6A4428'}" stroke-width="1.6"/>
        ${[8, 14, 20, 26, 32].map((x) => `<circle cx="${x}" cy="9" r="1.6" fill="${isik}"/><circle cx="${x}" cy="24" r="1.6" fill="${isik}"/>`).join('')}
        <path d="M10 16.5h20" stroke="${yanik ? vurgu : '#5A4030'}" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 2"/>`;
      break;
    case 'ates':
      ic = `${yanik ? '<circle cx="20" cy="18" r="15" fill="url(#ftl-koz)"/>' : ''}<path d="M9 28h22l-4 7H13z" fill="#5A3A22" stroke="#2A1408" stroke-width="1"/>
        <path d="M20 28c-6 0-8-4-7-8 1-3 4-5 4-10 3 2 5 5 5 8 1-1 2-2 2-4 3 3 4 6 3 9-1 3-3 5-7 5z" fill="${yanik ? 'url(#ftl-altin)' : '#5A4030'}" stroke="${yanik ? '#B8381C' : '#3A2416'}" stroke-width="1"/>`;
      break;
    default:
      ic = [
        [12, 12, 4],
        [28, 10, 3],
        [20, 22, 5],
        [9, 30, 3],
        [31, 28, 3.5],
      ]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 2.2}" fill="${kor}"/><path d="M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3} ${x + r} ${y} ${x + r * 0.3} ${y + r * 0.3} ${x} ${y + r} ${x - r * 0.3} ${y + r * 0.3} ${x - r} ${y} ${x - r * 0.3} ${y - r * 0.3}z" fill="${isik}"/>`)
        .join('');
      break;
  }
  return svg(`<svg class="f-ks-resim" viewBox="0 0 40 40" aria-hidden="true">${ic}</svg>`);
}
