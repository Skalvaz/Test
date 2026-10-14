/**
 * Açılış (§14.1): FİTİL logosu — ip harfler sırayla tutuşur (toplam 1,2 sn),
 * kıvılcım başı ip boyunca koşar, sonra gökte birkaç havai fişek ve
 * "Dokun ve başla". O dokunuş AudioContext'i açar: `ilkDokunus` geri
 * çağırımı olay işleyicisinin İÇİNDE, eşzamanlı çağrılır (iOS kuralı).
 */
import { h, svg } from '../dom';
import { M } from '../metinler';
import { yildizAlani, kasabaSilueti, havaiFisek } from '../sahne';
import type { Baglam } from '../cekirdek';

/** Harf vuruşları (viewBox 300×120). Sıra = tutuşma sırası. */
const VURUSLAR: { d: string; nokta?: [number, number] }[] = [
  { d: 'M30 100V24H72' }, // F gövde + üst
  { d: 'M30 61H63' }, // F orta
  { d: 'M106 100V48', nokta: [106, 25] }, // İ
  { d: 'M128 24H176' }, // T üst
  { d: 'M152 24V100' }, // T gövde
  { d: 'M204 100V48', nokta: [204, 25] }, // İ
  { d: 'M232 24V100H270' }, // L
];
const TOPLAM_MS = 1200;

export function acilisEkrani(b: Baglam, ilkDokunus?: () => void): Promise<void> {
  return new Promise((coz) => {
    const az = b.az();
    const ipler = VURUSLAR.map((v) => `<path d="${v.d}"/>`).join('');
    const noktalar = VURUSLAR.filter((v) => v.nokta)
      .map((v) => `<circle cx="${v.nokta![0]}" cy="${v.nokta![1]}" r="7.5"/>`)
      .join('');
    const yanma = VURUSLAR.map((v, i) => `<path class="f-yanma" data-i="${i}" d="${v.d}" pathLength="1"/>`).join('');
    const noktaYanma = VURUSLAR.map((v, i) => (v.nokta ? `<circle class="f-nokta-yanma" data-i="${i}" cx="${v.nokta[0]}" cy="${v.nokta[1]}" r="7.5"/>` : '')).join('');
    const logo = svg(`<svg class="f-logo-svg${az ? ' f-yandi' : ''}" viewBox="0 0 300 124" role="img" aria-label="${M.oyunAdi}">
      <defs>
        <linearGradient id="f-logo-alev" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="106"><stop offset="0" stop-color="#FFFBE6"/><stop offset=".35" stop-color="#FFD15C"/><stop offset=".75" stop-color="#FF9A2C"/><stop offset="1" stop-color="#E8561A"/></linearGradient>
        <filter id="f-logo-bulanik" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
        <radialGradient id="f-kivilcim-g"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFF4C2"/><stop offset=".6" stop-color="#FFB020" stop-opacity=".7"/><stop offset="1" stop-color="#FF7A1A" stop-opacity="0"/></radialGradient>
      </defs>
      <g class="f-ip-golge" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 4)">${ipler}</g>
      <g fill="#000" fill-opacity=".5" transform="translate(0 4)">${noktalar.replace(/r="7.5"/g, 'r="9.5"')}</g>
      <g class="f-ip-kenar" fill="none" stroke="#2A1408" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">${ipler}</g>
      <g fill="#2A1408">${noktalar.replace(/r="7.5"/g, 'r="9.5"')}</g>
      <g class="f-ip" fill="none" stroke="url(#ftl-ip)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${ipler}</g>
      <g fill="url(#ftl-ip)">${noktalar}</g>
      <g class="f-parilti-katman" filter="url(#f-logo-bulanik)" fill="none" stroke="#FF9A2C" stroke-width="20" stroke-linecap="round" stroke-linejoin="round">${yanma.replace(/f-yanma/g, 'f-yanma f-yanma-parilti')}</g>
      <g class="f-alev-katman" fill="none" stroke="url(#f-logo-alev)" stroke-width="11.5" stroke-linecap="round" stroke-linejoin="round">${yanma}</g>
      <g class="f-alev-katman" fill="url(#f-logo-alev)">${noktaYanma}</g>
      <circle class="f-kivilcim-bas" r="13" fill="url(#f-kivilcim-g)" cx="30" cy="100" opacity="0"/>
      <g class="f-kivilcimlar"></g>
    </svg>`);

    const fisekler = h('div', { s: 'f-acilis-fisekler' });
    const dokun = h('div', { s: 'f-dokun' }, h('span', { s: 'f-dokun-cizgi' }), h('span', { t: M.dokunVeBasla }), h('span', { s: 'f-dokun-cizgi' }));
    const ekran = h(
      'div',
      { s: `f-acilis${az ? ' f-hazir' : ''}`, role: 'button', tabindex: '0', 'aria-label': `${M.oyunAdi}. ${M.slogan} ${M.dokunVeBasla}` },
      h('div', { s: 'f-acilis-gok' }),
      yildizAlani('acilis', 120, 16),
      h('div', { s: 'f-acilis-ay' }),
      fisekler,
      kasabaSilueti('fener-koyu', 260 * (window.innerWidth / Math.max(1, window.innerHeight * 0.42))),
      h('div', { s: 'f-acilis-orta' }, h('div', { s: 'f-logo' }, logo), h('p', { s: 'f-slogan', t: M.slogan })),
      dokun,
    );
    b.ekranKatmani.appendChild(ekran);

    let bitti = false;
    let rafId = 0;
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
      cancelAnimationFrame(rafId);
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

    // Tutuşma zaman çizelgesi: vuruşlar uzunluklarıyla orantılı süre alır.
    const yollar = Array.from(logo.querySelectorAll<SVGPathElement>('.f-alev-katman .f-yanma'));
    const parilti = Array.from(logo.querySelectorAll<SVGPathElement>('.f-yanma-parilti'));
    const nokYanma = Array.from(logo.querySelectorAll<SVGCircleElement>('.f-nokta-yanma'));
    const bas = logo.querySelector<SVGCircleElement>('.f-kivilcim-bas')!;
    const kivilcimlar = logo.querySelector<SVGGElement>('.f-kivilcimlar')!;
    const uzunluklar = yollar.map((p) => {
      try {
        return p.getTotalLength();
      } catch {
        return 50;
      }
    });
    const toplam = uzunluklar.reduce((a, c) => a + c, 0) || 1;
    const dilimler: { bas: number; son: number }[] = [];
    let t = 0;
    for (const u of uzunluklar) {
      const sure = (u / toplam) * TOPLAM_MS;
      dilimler.push({ bas: t, son: t + sure });
      t += sure;
    }
    const t0 = performance.now() + 250;
    let sonKivilcim = 0;
    const kare = (simdi: number) => {
      if (bitti) return;
      const g = simdi - t0;
      let aktif = -1;
      dilimler.forEach((d, i) => {
        const o = Math.max(0, Math.min(1, (g - d.bas) / (d.son - d.bas)));
        const off = String(1 - o);
        yollar[i].style.strokeDashoffset = off;
        parilti[i].style.strokeDashoffset = off;
        if (o > 0 && o < 1) aktif = i;
        const n = nokYanma.find((c) => c.dataset.i === String(i));
        if (n && o >= 1 && !n.classList.contains('f-yandi')) n.classList.add('f-yandi');
      });
      if (aktif >= 0) {
        const d = dilimler[aktif];
        const o = (g - d.bas) / (d.son - d.bas);
        let p = { x: 0, y: 0 };
        try {
          p = yollar[aktif].getPointAtLength(o * uzunluklar[aktif]);
        } catch {
          /* yok say */
        }
        bas.setAttribute('cx', p.x.toFixed(1));
        bas.setAttribute('cy', p.y.toFixed(1));
        bas.setAttribute('opacity', '1');
        if (simdi - sonKivilcim > 28) {
          sonKivilcim = simdi;
          const k = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          k.setAttribute('cx', p.x.toFixed(1));
          k.setAttribute('cy', p.y.toFixed(1));
          k.setAttribute('r', (1 + Math.random() * 1.6).toFixed(1));
          k.setAttribute('class', 'f-kivilcim');
          k.style.setProperty('--dx', `${(Math.random() * 30 - 15).toFixed(1)}px`);
          k.style.setProperty('--dy', `${(Math.random() * 18 + 6).toFixed(1)}px`);
          kivilcimlar.appendChild(k);
          setTimeout(() => k.remove(), 650);
        }
      } else if (g > TOPLAM_MS) {
        bas.setAttribute('opacity', '0');
      }
      if (g <= TOPLAM_MS + 60) rafId = requestAnimationFrame(kare);
      else {
        logo.classList.add('f-yandi');
        ekran.classList.add('f-hazir');
      }
    };
    rafId = requestAnimationFrame(kare);

    // Tutuşmadan sonra gökte havai fişekler (dokunana kadar arada bir).
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
