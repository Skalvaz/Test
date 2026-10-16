/**
 * Tablo denemesi (dev/tablo.html): 12 farklı ebru tablosu ızgarası
 * (teknikler ve nadirlikler), dokununca tam boy. Kanca: `window.__tablo`.
 */
import { yaziTipiniGom } from '../../ui/yazitipi';
import type { TabloIstegi } from '../../app/sozlesme';
import { NADIRLIK, TEKNIKLER } from '../../app/katalog';
import { tabloCiziciOlustur, TABLO_H, TABLO_W } from '../tablo';
import { ornekGunluk, type GunlukAyari } from './ornekGunluk';

declare global {
  interface Window {
    __tablo?: Record<string, unknown>;
  }
}

const ORNEKLER: { ad: string; atolye: 'uskudar' | 'bursa'; bolum: number; yildiz: 0 | 1 | 2 | 3; ayar: GunlukAyari; motif?: 'lale' | 'karanfil' }[] = [
  { ad: 'Battal (sade)', atolye: 'uskudar', bolum: 1, yildiz: 1, ayar: { hamle: 12, renkler: [3] } },
  { ad: 'Battal, üç renk', atolye: 'uskudar', bolum: 2, yildiz: 2, ayar: { hamle: 16 } },
  { ad: 'Taraklı', atolye: 'uskudar', bolum: 3, yildiz: 2, ayar: { hamle: 16, tarak: 2, renkler: [5, 6] } },
  { ad: 'Gelgit', atolye: 'uskudar', bolum: 4, yildiz: 2, ayar: { hamle: 18, kaskat: 1 } },
  { ad: 'Bülbül yuvası', atolye: 'uskudar', bolum: 5, yildiz: 2, ayar: { hamle: 18, girdap: 2, renkler: [6, 3] } },
  { ad: 'Şal', atolye: 'uskudar', bolum: 6, yildiz: 3, ayar: { hamle: 22, kaskat: 1, tarak: 1 } },
  { ad: 'Lale ebrusu', atolye: 'uskudar', bolum: 7, yildiz: 3, ayar: { hamle: 18, lale: true, renkler: [5, 6, 3] } },
  { ad: 'Lale deseni', atolye: 'uskudar', bolum: 9, yildiz: 2, ayar: { hamle: 20, renkler: [5, 6] }, motif: 'lale' },
  { ad: 'Is serpintisi', atolye: 'bursa', bolum: 11, yildiz: 1, ayar: { hamle: 20, murekkep: 3 } },
  { ad: 'Karanfil', atolye: 'bursa', bolum: 17, yildiz: 3, ayar: { hamle: 22, renkler: [3, 6], girdap: 1 }, motif: 'karanfil' },
  { ad: 'Bursa şalı', atolye: 'bursa', bolum: 19, yildiz: 3, ayar: { hamle: 24, tarak: 3, kaskat: 2, girdap: 1 } },
  { ad: 'Şaheser', atolye: 'bursa', bolum: 20, yildiz: 3, ayar: { hamle: 26, saheser: true, birlesim: true, tarak: 1, girdap: 1, lale: true } },
];

const izgara = document.getElementById('izgara')!;
const bilgi = document.getElementById('bilgi')!;
const buyuk = document.getElementById('buyuk')!;
buyuk.addEventListener('click', () => buyuk.classList.remove('acik'));
const cizici = tabloCiziciOlustur({ dpr: Math.min(2, window.devicePixelRatio || 1) });

function istek(i: number): TabloIstegi {
  const o = ORNEKLER[i];
  return { bolumId: o.bolum, atolye: o.atolye, tohum: 1000 + i * 7919, gunluk: ornekGunluk(77 + i * 31, o.ayar), w: 7, h: 9, yildiz: o.yildiz, motif: o.motif };
}

async function ciz(): Promise<void> {
  await yaziTipiniGom();
  const sureler: number[] = [];
  for (let i = 0; i < ORNEKLER.length; i++) {
    const t0 = performance.now();
    const r = cizici.tabloCiz(istek(i), { w: TABLO_W / 2, h: TABLO_H / 2 });
    sureler.push(performance.now() - t0);
    const kart = document.createElement('div');
    kart.className = 'kart';
    const c = r.tuval as HTMLCanvasElement;
    kart.appendChild(c);
    const ad = document.createElement('b');
    ad.textContent = `${ORNEKLER[i].ad} · ${NADIRLIK[r.nadirlik]}`;
    const tek = document.createElement('span');
    tek.textContent = r.teknikler.map((t) => TEKNIKLER.find((x) => x.id === t)!.ad).join(', ');
    kart.append(ad, tek);
    kart.addEventListener('click', () => {
      const b = cizici.tabloCiz(istek(i)).tuval as HTMLCanvasElement;
      buyuk.innerHTML = '';
      buyuk.appendChild(b);
      buyuk.classList.add('acik');
    });
    izgara.appendChild(kart);
    await new Promise((r2) => setTimeout(r2, 0));
  }
  const ort = sureler.reduce((a, b) => a + b, 0) / sureler.length;
  bilgi.textContent = `Günlükten belirlenimli ebru · ${ORNEKLER.length} tablo · ort. ${ort.toFixed(0)} ms, en çok ${Math.max(...sureler).toFixed(0)} ms (model + çizim)`;
  window.__tablo!.hazir = true;
}

window.__tablo = {
  hazir: false,
  buyut: (i: number) => {
    const b = cizici.tabloCiz(istek(i)).tuval as HTMLCanvasElement;
    buyuk.innerHTML = '';
    buyuk.appendChild(b);
    buyuk.classList.add('acik');
  },
  kapat: () => buyuk.classList.remove('acik'),
  istek,
  cizici,
};
void ciz();
