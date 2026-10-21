/**
 * Nasıl oynanır (§14.9): 6 animasyonlu kart — Çiz ve bırak · Çapraz ve
 * halka · Isı ve kızgınlık · Özel taşlar (6/9/12) · Kombinasyonlar ·
 * Engeller (açılmış olanlar). Kaydırma (parmak), ok tuşları, noktalar.
 */
import { h, svg } from '../dom';
import { ikon, kapsulIsaretleme } from '../ikonlar';
import { M, NASIL_KARTLARI, ENGEL_ADLARI } from '../metinler';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { yeniOgeOnizleme } from './ortak';
import type { EngelId, NasilVM, Palet, YeniOge } from '../tipler';
import { t as tt } from '../../platform/dil';

const ENGEL_SIRASI: EngelId[] = ['kafes', 'islak', 'doseme', 'fener', 'kaya', 'devFisek', 'kova', 'barutIzi', 'delik', 'desen', 'meltem', 'is', 'cisenti'];
const ENGEL_ONIZLEME: Record<EngelId, YeniOge> = {
  kafes: 'kafes',
  islak: 'islak',
  doseme: 'doseme',
  fener: 'fener',
  kaya: 'kaya',
  devFisek: 'devFisek',
  kova: 'kova',
  barutIzi: 'barutIzi',
  delik: 'delik',
  desen: 'desen',
  meltem: 'meltem',
  is: 'is',
  cisenti: 'cisenti',
};

function sahne(i: number, palet: Palet): SVGSVGElement {
  const k = (r: number, renk: number, x: number, y: number, s = '', gec = 0) =>
    `<g class="${s}" style="transform-origin:${x}px ${y}px;animation-delay:${gec}ms">${kapsulIsaretleme(renk, r, palet, x, y)}</g>`;
  let ic = '';
  switch (i) {
    case 0: {
      // Bir sıra kızıl; fitil geçer, sırayla patlar.
      const xs = [50, 90, 130, 170];
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 5; x++) {
          const cx = 40 + x * 40;
          const cy = 35 + y * 40;
          if (y === 1 && x < 4) continue;
          ic += k(13, [1, 2, 3, 1, 2][(x + y * 2) % 5], cx, cy, '', 0);
        }
      xs.forEach((_, j) => {
        ic += `<g class="f-nk-pat" style="animation-delay:${j * 110}ms">${k(13, 0, 40 + j * 40, 75)}</g><circle class="f-nk-halka" style="animation-delay:${j * 110}ms" cx="${40 + j * 40}" cy="75" r="16" fill="none" stroke="#FFB3A8" stroke-width="3"/>`;
      });
      ic += `<path class="f-nk-fitil" d="M40 75H160" pathLength="1" stroke="#FFF4C2" stroke-width="5" stroke-linecap="round" fill="none"/>`;
      ic += `<g class="f-nk-el"><circle cx="160" cy="75" r="9" fill="#fff" opacity=".85"/><circle cx="160" cy="75" r="15" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/></g>`;
      break;
    }
    case 1: {
      ic += k(13, 3, 30, 115) + k(13, 3, 70, 75) + k(13, 3, 110, 115) + k(13, 3, 150, 75);
      ic += `<path class="f-nk-fitil" d="M30 115L70 75 110 115 150 75" pathLength="1" stroke="#B5E0FF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
      ic += `<g class="f-nk-halka2">${k(11, 1, 180, 30)}${k(11, 1, 215, 30)}${k(11, 1, 215, 65)}${k(11, 1, 180, 65)}<rect x="180" y="30" width="35" height="35" fill="none" stroke="#FFD15C" stroke-width="4" rx="2"/></g>`;
      ic += `<text x="197" y="100" text-anchor="middle" font-size="15" font-weight="800" fill="#FFD15C" font-family="inherit">×2</text>`;
      break;
    }
    case 2: {
      ic += `<g class="f-nk-tetik">${k(14, 0, 60, 75)}</g>`;
      ic += k(18, 1, 130, 75, 'f-nk-kizgin');
      ic += `<g class="f-nk-yuvalar" fill="none" stroke-width="4" stroke-linecap="round">
        <path class="f-nk-y1" d="M130 50a25 25 0 0 1 22 13" stroke="#FF9A3C"/>
        <path class="f-nk-y2" d="M154 82a25 25 0 0 1-15 17" stroke="#FF9A3C"/>
        <path class="f-nk-y3" d="M120 98a25 25 0 0 1-15-17" stroke="#FF9A3C"/></g>`;
      ic += `<circle class="f-nk-cekirdek" cx="130" cy="75" r="9" fill="#FFF4C2"/>`;
      ic += `<circle class="f-nk-patla" cx="130" cy="75" r="30" fill="none" stroke="#FFD15C" stroke-width="4"/>`;
      ic += k(13, 2, 190, 75) + k(13, 3, 130, 125);
      break;
    }
    case 3: {
      const sut = [
        { x: 45, renk: 0, n: '6', s: `<path d="M-11 0H11M11 0l-5-4M11 0l-5 4M-11 0l5-4M-11 0l5 4" stroke="url(#ftl-pirinc)" stroke-width="2.6" stroke-linecap="round" fill="none"/>` },
        { x: 120, renk: 2, n: '9', s: `<path d="M0-9 2-2 9 0 2 2 0 9-2 2-9 0-2-2z" fill="#FFF3D6"/>` },
        { x: 195, renk: -1, n: '12', s: '' },
      ];
      sut.forEach((c, j) => {
        ic += `<g class="f-nk-ozel" style="animation-delay:${j * 600}ms;transform-origin:${c.x}px 65px">${kapsulIsaretleme(c.renk, 22, palet, c.x, 65)}<g transform="translate(${c.x} 65)">${c.s}</g></g>`;
        ic += `<text x="${c.x}" y="122" text-anchor="middle" font-size="22" font-weight="800" fill="#FFF3D6" font-family="inherit">${c.n}+</text>`;
      });
      break;
    }
    case 4: {
      ic += `<g class="f-nk-sol">${k(18, 0, 70, 75)}<path d="M55 75H85" stroke="url(#ftl-pirinc)" stroke-width="3" stroke-linecap="round"/></g>`;
      ic += `<g class="f-nk-sag">${k(18, 2, 170, 75)}<path d="M170 66 172 73 179 75 172 77 170 84 168 77 161 75 168 73z" fill="#FFF3D6"/></g>`;
      ic += `<g class="f-nk-flas"><circle cx="120" cy="75" r="56" fill="url(#ftl-koz)"/><path d="M120 75H0M120 75H240M120 75V0M120 75V150" stroke="#FFF4C2" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M120 75H0M120 75H240" stroke="#FFD15C" stroke-width="22" opacity=".25"/></g>`;
      break;
    }
  }
  return svg(`<svg class="f-nk-svg f-nk-${i}" viewBox="0 0 240 150" aria-hidden="true">${ic}</svg>`);
}

export function nasilEkrani(b: Baglam, vm: NasilVM): { soz: Promise<void>; kapat: () => void } {
  const { soz, sec } = secimSozu<void>();
  let sira = 0;
  const kartlar = NASIL_KARTLARI.map((k, i) => {
    let resim: Element;
    if (i === 5) {
      const izgara = h('div', { s: 'f-nk-engeller' });
      ENGEL_SIRASI.forEach((e) => {
        const acik = vm.acikEngeller.includes(e);
        izgara.appendChild(
          h(
            'div',
            { s: `f-nk-engel${acik ? '' : ' f-kilitli'}` },
            acik ? yeniOgeOnizleme(ENGEL_ONIZLEME[e], b.palet) : h('span', { s: 'f-nk-soru' }, ikon('kilit')),
            h('span', { t: acik ? ENGEL_ADLARI[e] : '?' }),
          ),
        );
      });
      resim = izgara;
    } else resim = h('div', { s: 'f-nk-resim' }, sahne(i, b.palet));
    return h(
      'div',
      { s: 'f-nk-kart', role: 'group', 'aria-roledescription': tt('kart', 'card'), 'aria-label': `${i + 1}/6 ${k.baslik}` },
      resim,
      h('h3', { s: 'f-nk-baslik', t: k.baslik }),
      h('p', { s: 'f-govde f-nk-metin', t: k.metin }),
    );
  });
  const serit = h('div', { s: 'f-nk-serit' }, kartlar);
  const noktalar = h('div', { s: 'f-nk-noktalar', 'aria-hidden': 'true' }, kartlar.map(() => h('i')));
  const onceki = h('button', { s: 'f-yuvarlak', type: 'button', 'aria-label': M.onceki }, ikon('geri'));
  const sonrakiDg = dugme(M.sonraki, 'birincil', () => git(sira + 1), { odak: true, ikon: 'ileri' });

  const git = (n: number) => {
    if (n >= kartlar.length) {
      bitir();
      return;
    }
    sira = Math.max(0, Math.min(kartlar.length - 1, n));
    serit.style.transform = `translateX(${-sira * 100}%)`;
    kartlar.forEach((k, i) => {
      k.classList.toggle('f-aktif', i === sira);
      k.setAttribute('aria-hidden', String(i !== sira));
    });
    Array.from(noktalar.children).forEach((n, i) => n.classList.toggle('f-aktif', i === sira));
    // Pencere etkin kartın yüksekliğini alır (uzun Engeller kartı diğerlerini şişirmesin).
    requestAnimationFrame(() => (pencere.style.height = `${kartlar[sira].offsetHeight}px`));
    onceki.style.visibility = sira === 0 ? 'hidden' : 'visible';
    const etiket = sonrakiDg.querySelector('span')!;
    etiket.textContent = sira === kartlar.length - 1 ? M.anladim : M.sonraki;
    b.duyur(`${sira + 1}/6 ${NASIL_KARTLARI[sira].baslik}`);
  };
  onceki.addEventListener('click', () => git(sira - 1));

  // Parmakla kaydırma
  const pencere = h('div', { s: 'f-nk-pencere' }, serit);
  let x0: number | null = null;
  pencere.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
  });
  pencere.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 40) git(sira + (dx < 0 ? 1 : -1));
  });
  pencere.addEventListener('pointercancel', () => (x0 = null));
  pencere.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') git(sira + 1);
    if (e.key === 'ArrowLeft') git(sira - 1);
  });
  pencere.tabIndex = 0;

  const icerik = h('div', { s: 'f-nk' }, pencere, noktalar, h('div', { s: 'f-nk-alt' }, onceki, sonrakiDg));
  const bitir = () => {
    if (sec()) t.kapat(true);
  };
  const t = b.modalAc({ icerik, serit: M.nasilOynanir, seritTur: 'altin', kapatDugmesi: true, onIptal: bitir, sinif: 'f-nasil' });
  git(0);
  return { soz, kapat: bitir };
}
