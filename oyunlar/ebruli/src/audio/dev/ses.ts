/**
 * Ses denemesi (dev/ses.html): her olay/arayüz sesi için düğme, ortam ve
 * müzik anahtarları, ayarlar, çıkış dalga biçimi ve OfflineAudioContext
 * ölçümü. Kanca: `window.__olc()` (ölçüm sonuçlarını döndürür).
 */
import { yaziTipiniGom } from '../../ui/yazitipi';
import type { ArayuzSesi } from '../../app/sozlesme';
import type { Olay } from '../../core/types';
import { sesMotoruOlustur } from '../sesMotoru';
import { OLAY_CESITLERI, ORNEK_OLAYLAR, hamleGosterisi } from '../gosteri';
import { olc, type OlcumSonucu } from '../olcum';

declare global {
  interface Window {
    __olc?: () => Promise<OlcumSonucu[]>;
  }
}

void yaziTipiniGom();
const m = sesMotoruOlustur({ hata: (e) => console.warn('[ses]', e) });
const kok = document.getElementById('kok')!;
const durum = document.getElementById('durum')!;

const bolum = (baslik: string, dugmeler: [string, () => void][]) => {
  const s = document.createElement('section');
  s.innerHTML = `<h2>${baslik}</h2>`;
  const iz = document.createElement('div');
  iz.className = 'izgara';
  for (const [ad, fn] of dugmeler) {
    const b = document.createElement('button');
    b.textContent = ad;
    b.addEventListener('click', () => {
      m.ac();
      fn();
    });
    iz.appendChild(b);
  }
  s.appendChild(iz);
  kok.appendChild(s);
  return s;
};

bolum('Sürükleme', [
  ['tutuldu', () => m.tutuldu()],
  ['hedef: Turuncu', () => m.hedefeGirdi(3)],
  ['hedef: Mor', () => m.hedefeGirdi(5)],
  ['hedef: Yeşil', () => m.hedefeGirdi(6)],
  ['geçersiz', () => m.gecersiz()],
]);
bolum('Olaylar', [
  ...(Object.values(ORNEK_OLAYLAR) as Olay[]).map((o): [string, () => void] => [o.tur, () => m.olay(o)]),
  ...OLAY_CESITLERI.map((c): [string, () => void] => [c.ad, () => m.olay(c.olay)]),
  [
    'hamle dizisi',
    () => {
      for (const o of hamleGosterisi()) setTimeout(() => m.olay(o), o.t);
    },
  ],
]);
bolum(
  'Arayüz',
  (['dugme', 'ac', 'kapa', 'yildiz1', 'yildiz2', 'yildiz3', 'kazandin', 'kaybettin', 'sonHamle', 'hedefTamam', 'kagitCek'] as ArayuzSesi[]).map((a): [string, () => void] => [a, () => m.arayuz(a)]),
);
const anahtar = (s: HTMLElement, ad: string, fn: (acik: boolean) => void) => {
  const b = document.createElement('button');
  b.className = 'koyu';
  b.textContent = ad;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => {
    m.ac();
    const acik = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(acik));
    fn(acik);
  });
  s.querySelector('.izgara')!.appendChild(b);
};
const ortam = bolum('Ortam ve müzik', []);
anahtar(ortam, 'Su · Üsküdar', (a) => m.ortam(a, 'uskudar'));
anahtar(ortam, 'Su · Bursa', (a) => m.ortam(a, 'bursa'));
anahtar(ortam, 'Müzik', (a) => m.muzik(a));
anahtar(ortam, 'Sessiz', (a) => m.ayarla({ sessiz: a }));
const ayar = document.createElement('div');
ayar.className = 'ayar';
ayar.innerHTML = '<label>Efekt <input type="range" min="0" max="1" step="0.05" value="0.8" id="sfx"></label><label>Müzik <input type="range" min="0" max="1" step="0.05" value="0.3" id="muz"></label>';
ortam.appendChild(ayar);
(document.getElementById('sfx') as HTMLInputElement).addEventListener('input', (e) => m.ayarla({ sfx: Number((e.target as HTMLInputElement).value) / 0.8 }));
(document.getElementById('muz') as HTMLInputElement).addEventListener('input', (e) => m.ayarla({ muzik: Number((e.target as HTMLInputElement).value) / 0.3 }));
window.addEventListener('pointerdown', () => m.ac(), { once: true });

// Dalga biçimi.
const tuval = document.getElementById('dalga') as HTMLCanvasElement;
const c = tuval.getContext('2d')!;
const veri = new Float32Array(1024);
const ciz = () => {
  const w = (tuval.width = tuval.clientWidth * 2);
  const h = (tuval.height = tuval.clientHeight * 2);
  c.fillStyle = '#0A1E33';
  c.fillRect(0, 0, w, h);
  const a = m.cozumleyici();
  const b = m.baglam;
  durum.textContent = b ? `Bağlam: ${(b as AudioContext).state} · ${b.sampleRate} Hz · etkin ses ${m.etkinSes()} · ud ${m.udHazir() ? 'hazır' : 'hazırlanıyor'}` : 'Bağlam kapalı — ilk dokunuşla açılır.';
  if (a) {
    a.getFloatTimeDomainData(veri);
    c.strokeStyle = '#E8CD6A';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < veri.length; i++) {
      const x = (i / veri.length) * w;
      const y = h / 2 - veri[i] * h * 0.45;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  requestAnimationFrame(ciz);
};
requestAnimationFrame(ciz);

// Ölçüm.
const govde = document.querySelector('#tablo tbody')!;
const ozet = document.getElementById('ozet')!;
async function olcVeYaz(): Promise<OlcumSonucu[]> {
  govde.innerHTML = '';
  ozet.textContent = 'ölçülüyor…';
  const f = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '−∞');
  const r = await olc(undefined, 44100, (x) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${x.ad}</td><td>${f(x.tepeDb)}</td><td>${f(x.pencereDb)}</td><td>${f(x.rmsDb)}</td><td>${x.kirpilan}</td><td>${x.bozulma}</td><td class="${x.tamam ? 'iyi' : 'kotu'}">${x.tamam ? 'tamam' : x.sessiz ? 'SESSİZ' : 'KIRPILMA'}</td>`;
    govde.appendChild(tr);
  });
  const kotu = r.filter((x) => !x.tamam);
  const enTepe = Math.max(...r.map((x) => x.tepe));
  ozet.textContent = `${r.length} senaryo · ${kotu.length} sorun · en yüksek tepe ${(20 * Math.log10(enTepe)).toFixed(1)} dBFS`;
  console.log(JSON.stringify(r.map((x) => [x.ad, +x.tepeDb.toFixed(1), +x.pencereDb.toFixed(1), x.kirpilan, x.tamam])));
  return r;
}
document.getElementById('olcDugme')!.addEventListener('click', () => void olcVeYaz());
window.__olc = olcVeYaz;
