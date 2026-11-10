/**
 * Açılış (§14.1): FİTİL amblem logosu (`ui/logo.ts`) kısa bir girişle gelir
 * (kemer, fişekler, harfler, İ korları; toplam ~1,2 sn), sonra gökte birkaç
 * havai fişek ve "Dokun ve başla". O dokunuş AudioContext'i açar:
 * `ilkDokunus` geri çağırımı olay işleyicisinin İÇİNDE, eşzamanlı çağrılır
 * (iOS kuralı).
 */
import { h, svg } from '../dom';
import { M } from '../metinler';
import { logoSvg } from '../logo';
import { yildizAlani, kasabaSilueti, havaiFisek, dilekFenerleri } from '../sahne';
import type { Baglam } from '../cekirdek';

/** Logo girişinin süresi (CSS canlandırmaları `f-lg-*` bu sürede biter). */
const TOPLAM_MS = 1200;

export function acilisEkrani(b: Baglam, ilkDokunus?: () => void): Promise<void> {
  return new Promise((coz) => {
    const az = b.az();
    const logo = svg(logoSvg('flg', `f-logo-svg${az ? ' f-lg-hazir' : ''}`, M.oyunAdi));

    const fisekler = h('div', { s: 'f-acilis-fisekler' });
    const dokun = h('div', { s: 'f-dokun' }, h('span', { s: 'f-dokun-cizgi' }), h('span', { t: M.dokunVeBasla }), h('span', { s: 'f-dokun-cizgi' }));
    const ekran = h(
      'div',
      { s: `f-acilis${az ? ' f-hazir' : ''}`, role: 'button', tabindex: '0', 'aria-label': `${M.oyunAdi}. ${M.slogan} ${M.dokunVeBasla}` },
      h('div', { s: 'f-acilis-gok' }),
      yildizAlani('acilis', 120, 16),
      h('div', { s: 'f-acilis-ay' }),
      fisekler,
      // Dilek fenerleri kasabanın arkasından yükselir (siluetten önce eklenir).
      // Yalnız iki kenar bandında: logonun, sloganın ve düğmenin arkasından geçmezler.
      dilekFenerleri('acilis-dilek', 6, [[3, 9], [91, 97]]),
      // Siluet boyu CSS'teki .f-kasaba yüksekliğiyle aynı oran (kısa ekranda %34).
      kasabaSilueti('fener-koyu', 260 * (window.innerWidth / Math.max(1, window.innerHeight * (window.innerHeight <= 700 ? 0.34 : 0.42)))),
      h('div', { s: 'f-acilis-orta' }, h('div', { s: 'f-logo' }, logo), h('p', { s: 'f-slogan', t: M.slogan })),
      dokun,
    );
    b.ekranKatmani.appendChild(ekran);

    let bitti = false;
    const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
    const sonlandir = () => {
      if (bitti) return;
      bitti = true;
      try {
        ilkDokunus?.();
      } catch {
        /* ses açılamadı; oyun sessiz sürer */
      }
      b.ses('ac');
      zamanlayicilar.forEach(clearTimeout);
      ekran.classList.add('f-cikis');
      ekran.style.pointerEvents = 'none';
      setTimeout(() => ekran.remove(), az ? 50 : 420);
      coz();
    };
    ekran.addEventListener('pointerup', sonlandir);
    ekran.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sonlandir();
      }
    });
    requestAnimationFrame(() => ekran.focus({ preventScroll: true }));

    if (az) return;

    // Giriş CSS'te (f-lg-*); bitince slogan ve "Dokun ve başla".
    zamanlayicilar.push(
      setTimeout(() => {
        if (bitti) return;
        logo.classList.add('f-lg-hazir');
        ekran.classList.add('f-hazir');
      }, TOPLAM_MS + 150),
    );

    // Girişten sonra gökte havai fişekler (dokunana kadar arada bir).
    const fisekAt = (gecikme: number) => {
      zamanlayicilar.push(
        setTimeout(() => {
          if (bitti) return;
          const r = fisekler.getBoundingClientRect();
          // Ayın (sağ üst) ve logonun üstüne binmesin: sol/orta gök, logo üstü.
          const x = r.width * (0.12 + Math.random() * 0.5);
          const y = r.height * (0.1 + Math.random() * 0.2);
          havaiFisek(fisekler, x, y, undefined, 46 + Math.random() * 34);
          fisekAt(900 + Math.random() * 1600);
        }, gecikme),
      );
    };
    fisekAt(TOPLAM_MS + 450);
  });
}
