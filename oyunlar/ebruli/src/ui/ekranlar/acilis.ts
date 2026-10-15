/**
 * Açılış (GDD §12.3 #1): "Ebruli" yazısı suya damlayan boyadan açılır
 * (damla → halkalar → harfler, 1,2 sn); altında "Dokun ve başla". Bu
 * dokunuş sesi açar (iOS kilidi). Beklerken uygulama ilk bölümü önden
 * pişirir (`cizici.onIsit`).
 */
import { h, svg } from '../dom';
import { RUMI } from '../ikonlar';
import { M } from '../metinler';
import type { EkranYoneticisi } from './cekirdek';

export function acilisEkrani(y: EkranYoneticisi, ilkDokunus: () => void): Promise<void> {
  return y.ac<void>({ sinif: 'e-acilis', geri: undefined }, (bitir, kok) => {
    const harfler = h('h1', { s: 'e-acilis-baslik', 'aria-label': M.oyunAdi });
    [...M.oyunAdi].forEach((c, i) => harfler.appendChild(h('span', { t: c, css: { '--i': String(i) }, 'aria-hidden': 'true' })));
    const leke = h('div', { s: 'e-acilis-leke', 'aria-hidden': 'true' });
    for (let i = 0; i < 5; i++) leke.appendChild(h('i', { css: { '--i': String(i) } }));
    const halkalar = h('div', { s: 'e-acilis-halkalar', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
    const rumi = svg(RUMI);
    rumi.classList.add('e-rumi');
    const surukle = h('div', { s: 'e-acilis-yuzen', 'aria-hidden': 'true' });
    const renkler = ['#D6423A', '#F0C23B', '#4A86D4', '#EE7F2D', '#9A5CC6', '#3FA86B'];
    for (let i = 0; i < 9; i++)
      surukle.appendChild(
        h('i', {
          css: {
            '--x': `${(i * 37 + 11) % 100}%`,
            '--y': `${(i * 53 + 7) % 100}%`,
            '--r': `${10 + ((i * 7) % 14)}px`,
            '--c': renkler[i % renkler.length],
            '--d': `${14 + (i % 5) * 3}s`,
            '--g': `${-i * 1.7}s`,
          },
        }),
      );
    let basti = false;
    const dokun = (e: Event): void => {
      if (basti) return;
      if (e instanceof KeyboardEvent && !['Enter', ' ', 'Spacebar'].includes(e.key)) return;
      basti = true;
      ilkDokunus();
      window.removeEventListener('keydown', dokun);
      bitir();
    };
    kok.addEventListener('pointerup', dokun);
    window.addEventListener('keydown', dokun);
    return [
      surukle,
      h(
        'div',
        { s: 'e-acilis-merkez' },
        h('div', { s: 'e-acilis-damla', 'aria-hidden': 'true' }),
        halkalar,
        leke,
        harfler,
        h('p', { s: 'e-acilis-alt', t: M.altBaslik }),
        rumi,
      ),
      h('div', { s: 'e-acilis-dokun', t: M.dokun }),
      h('div', { s: 'e-acilis-surum', t: M.deneme }),
    ];
  });
}
