/**
 * Geliştirme sahnesi (dev/sahne.html): çizici + girdi + SAHTE çözücü.
 * Çekirdek (P1) gelmeden olay oynatıcıyı, önizlemeyi, efektleri ve kâğıt
 * çekmeyi denemek, telefon/masaüstü ekran görüntüsü almak için.
 *
 * Test kancası `window.__sahne`: senaryo(ad), ilerle(ms), dondur(b),
 * hamle(kx, ky, hx, hy), bot(), surukle(kx, ky, hx, hy, yakinlik),
 * kagit(), bolum(ad).
 */
import '../../style.css';
import { yaziTipiniGom } from '../../ui/yazitipi';
import { Stage } from '../stage';
import { oyunCiziciOlustur } from '../oyunCizici';
import { surukleGirdiOlustur } from '../../input/surukle';
import * as cekirdek from '../../core/index';
import { bolumuYukle, gecerliHedefler, hamleHatasi } from '../../core/index';
import type { BolumVerisi, Hamle, HamleSonucu, Konum, Olay, Onizleme, OyunDurumu } from '../../core/types';
import { sahteBotHamle, sahteHamle as sahteHamle0, sahteOnizle as sahteOnizle0 } from './sahteCozum';
import { SADE, VITRIN } from './ornekBolumler';
import { RENK_TANIMLARI } from '../../app/katalog';
import b001 from '../../levels/veri/b001.json';
import { tabloCiziciOlustur } from '../tablo';

/**
 * Gerçek çekirdek (P1) varsa onu, yoksa sahte çözücüyü kullan: entegrasyondan
 * sonra bu sayfa kendiliğinden gerçek olaylarla oynar.
 */
const gercek = (() => {
  try {
    const d0 = bolumuYukle(VITRIN, 0);
    (cekirdek as unknown as { onizle: (d: OyunDurumu, h: Hamle) => Onizleme }).onizle(d0, { tur: 'surukle', kaynak: { x: 0, y: 0 }, hedef: { x: 1, y: 0 } });
    return true;
  } catch (e) {
    return !(e instanceof cekirdek.UygulanmadiHatasi);
  }
})();
const sahteHamle = (d: OyunDurumu, h: Hamle): HamleSonucu => (gercek ? cekirdek.hamleUygula(d, h) : sahteHamle0(d, h));
const sahteOnizle = (d: OyunDurumu, h: Hamle): Onizleme => (gercek ? cekirdek.onizle(d, h) : sahteOnizle0(d, h));
console.info(`[sahne] çözücü: ${gercek ? 'gerçek çekirdek' : 'sahte'}`);

declare global {
  interface Window {
    __sahne?: Record<string, unknown>;
  }
}

const BOLUMLER: Record<string, BolumVerisi> = { vitrin: VITRIN, sade: SADE, b001: b001 as unknown as BolumVerisi };

const host = document.getElementById('app')!;
const arac = document.getElementById('arac')!;
const hud = document.getElementById('hud')!;
const yazi = yaziTipiniGom();
const stage = new Stage(host, 2);
const cizici = oyunCiziciOlustur(stage, { gelistirme: true });
const tablo = tabloCiziciOlustur();

let v: BolumVerisi = VITRIN;
let d: OyunDurumu = bolumuYukle(v, 0);
let oynuyor = false;
let rndS = 12345;
const rnd = () => {
  rndS = (Math.imul(rndS, 1103515245) + 12345) >>> 0;
  return rndS / 4294967296;
};

function hudKur(): void {
  hud.innerHTML = '';
  v.hedefler.forEach((h, i) => {
    const k = document.createElement('div');
    k.className = 'kart';
    k.dataset.i = String(i);
    const renk = h.tur === 'topla' ? RENK_TANIMLARI[h.renk].standart[0] : h.tur === 'kagit' ? '#F3E9D2' : '#C9A227';
    k.innerHTML = `<div><i style="background:${renk};${h.tur === 'kagit' ? 'border:1.5px solid #8A6D12;border-radius:3px' : ''}"></i><span>${d.hedefler[i].gerekli - d.hedefler[i].ilerleme}</span></div>`;
    hud.appendChild(k);
  });
  const p = document.createElement('div');
  p.className = 'puan';
  p.id = 'puan';
  p.textContent = String(d.puan);
  hud.appendChild(p);
  requestAnimationFrame(yerlesim);
}

function yerlesim(): void {
  const W = stage.width;
  const H = stage.height;
  const ust = 44 + 62;
  const alt = 24;
  if (W / H > 0.75) cizici.alanAyarla({ x: 0, y: ust, w: W * 0.62, h: H - ust - alt });
  else cizici.alanAyarla({ x: 0, y: ust, w: W, h: H - ust - alt });
  const kartlar = [...hud.querySelectorAll<HTMLElement>('.kart')];
  const sr = host.getBoundingClientRect();
  cizici.hedefKonumlari(
    kartlar.map((k) => {
      const r = k.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
    }),
  );
}
stage.onResize(() => requestAnimationFrame(yerlesim));

cizici.olayDinle((o) => {
  if (o.tur === 'hedefIlerledi') {
    const k = hud.querySelector<HTMLElement>(`.kart[data-i="${o.indeks}"] span`);
    if (k) {
      k.textContent = String(d.hedefler[o.indeks].gerekli - o.deger);
      const kart = k.closest('.kart')!;
      kart.classList.add('zipla');
      setTimeout(() => kart.classList.remove('zipla'), 120);
    }
  }
  if (o.tur === 'temizlendi' || o.tur === 'puanEklendi') {
    const p = document.getElementById('puan');
    if (p) p.textContent = String(Number(p.textContent) + (o.tur === 'temizlendi' ? o.puan : o.miktar));
  }
});

function bolumAc(ad: string, deneme = 0): void {
  v = BOLUMLER[ad] ?? VITRIN;
  d = bolumuYukle(v, deneme);
  cizici.bolumKur(d, v);
  hudKur();
}

let surKaynak: Konum | null = null;
let surHedefler: Konum[] = [];
const girdi = surukleGirdiOlustur({
  hedef: host,
  geometri: () => cizici.geometri(),
  durum: () => (oynuyor ? null : d),
  geriCagirim: {
    basladi(k) {
      surKaynak = k;
      surHedefler = gecerliHedefler(d, k);
      cizici.surukleGoster({ kaynak: k, parmak: null, hedefler: surHedefler, onizleme: null });
    },
    surukleniyor(k, h, p) {
      const on = h && surHedefler.some((x) => x.x === h.x && x.y === h.y) ? sahteOnizle(d, { tur: 'surukle', kaynak: k, hedef: h }) : null;
      cizici.surukleGoster({ kaynak: k, parmak: p, hedefler: surHedefler, onizleme: on });
    },
    birakildi(h) {
      cizici.surukleGoster({ kaynak: null, parmak: null, hedefler: [], onizleme: null });
      void oyna(h);
    },
    iptal() {
      surKaynak = null;
      cizici.surukleGoster({ kaynak: null, parmak: null, hedefler: [], onizleme: null });
    },
    dokunuldu() {
      if (oynuyor) cizici.hizlandir(2);
    },
    imlecDegisti(k) {
      cizici.imlecGoster(k);
    },
    kisitliBasildi(k) {
      cizici.titret(k);
    },
  },
});

async function oyna(h: Hamle): Promise<void> {
  if (oynuyor) return;
  if (hamleHatasi(d, h)) {
    cizici.titret(h.kaynak);
    return;
  }
  oynuyor = true;
  girdi.kipAyarla('kapali');
  const r = sahteHamle(d, h);
  const once = d;
  d = r.durum;
  await cizici.oynat(once, r.olaylar, r.durum);
  oynuyor = false;
  girdi.kipAyarla('acik');
  void surKaynak;
}

async function kagit(): Promise<void> {
  const t = tablo.tabloCiz({ bolumId: v.id, atolye: v.atolye, tohum: 99 + d.puan, gunluk: d.gunluk.length ? d.gunluk : ORNEK_GUNLUK, w: v.w, h: v.h, yildiz: 3 });
  await cizici.kagitCek(t.tuval);
}

const ORNEK_GUNLUK = Array.from({ length: 40 }, (_, i) => ({ hamle: i >> 1, k: 1 + (i % 3 === 0 ? 1 : 0), tur: (i % 9 === 4 ? 'tarak' : 'grup') as 'grup', x10: (i * 37) % 70, y10: (i * 53) % 90, renk: ([3, 5, 6] as const)[i % 3], boyut: 3 + (i % 3), yon: (i % 2 ? 'yatay' : 'dikey') as 'yatay' }));

const dugme = (ad: string, fn: () => void) => {
  const b = document.createElement('button');
  b.textContent = ad;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    fn();
  });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  arac.appendChild(b);
};
dugme('Vitrin', () => bolumAc('vitrin'));
dugme('Sade', () => bolumAc('sade'));
dugme('B1', () => bolumAc('b001'));
dugme('Bot', () => {
  const h = sahteBotHamle(d, rnd);
  if (h) void oyna(h);
});
dugme('Kâğıt', () => void kagit());
dugme('Kaldır', () => cizici.kagitKaldir());
let renkKoru = false;
dugme('Palet', () => {
  renkKoru = !renkKoru;
  cizici.secenekAyarla({ palet: renkKoru ? 'renkKoru' : 'standart' });
});
dugme('El', () => cizici.elGoster([{ x: 3, y: 5 }, { x: 2, y: 5 }]));

/** Önizleme senaryosu: (kx,ky)→(hx,hy) sürüklemesini yakınlıkla (0..1) göster. */
function surukle(kx: number, ky: number, hx: number, hy: number, yakin = 0.85): void {
  const k = { x: kx, y: ky };
  const h = { x: hx, y: hy };
  const g = cizici.geometri();
  const ax = g.x + (kx + 0.5) * g.hucre;
  const ay = g.y + (ky + 0.5) * g.hucre;
  const bx = g.x + (hx + 0.5) * g.hucre;
  const by = g.y + (hy + 0.5) * g.hucre;
  surHedefler = gecerliHedefler(d, k);
  const on = sahteOnizle(d, { tur: 'surukle', kaynak: k, hedef: h });
  cizici.surukleGoster({ kaynak: k, parmak: { x: ax + (bx - ax) * yakin, y: ay + (by - ay) * yakin }, hedefler: surHedefler, onizleme: on.gecerli ? on : null });
}

/** Önizlemede grup oluşturan ilk hamleyi bul. */
function olumluBul(enAz = 3): Hamle | null {
  for (let y = d.h - 1; y >= 0; y--)
    for (let x = 0; x < d.w; x++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const h: Hamle = { tur: 'surukle', kaynak: { x, y }, hedef: { x: x + dx, y: y + dy } };
        if (hamleHatasi(d, h)) continue;
        const o = sahteOnizle(d, h);
        if (o.sonuc !== null && o.gruplar.length && o.temizlenecek.length >= enAz) return h;
      }
  return null;
}

async function senaryo(ad: string): Promise<string> {
  cizici.surukleGoster({ kaynak: null, parmak: null, hedefler: [], onizleme: null });
  cizici.vurgula(null, 'ipucu');
  cizici.elGoster(null);
  cizici.hayaletHamle(null);
  cizici.imlecGoster(null);
  cizici.karart(0);
  cizici.kagitKaldir();
  girdi.zorunluAyarla(null);
  switch (ad) {
    case 'tahta':
      bolumAc('vitrin');
      return 'tahta';
    case 'onizleme': {
      bolumAc('vitrin');
      const h = olumluBul(4) ?? olumluBul(3);
      if (!h) return 'yok';
      surukle(h.kaynak.x, h.kaynak.y, h.hedef.x, h.hedef.y, 0.72);
      return JSON.stringify(h);
    }
    case 'ozelOnizleme':
      bolumAc('vitrin');
      surukle(1, 7, 1, 6, 0.8);
      return 'girdap';
    case 'birlesimOnizleme':
      bolumAc('vitrin');
      surukle(0, 7, 1, 7, 0.8);
      return 'birlesim';
    case 'zorunlu':
      bolumAc('b001');
      cizici.vurgula([{ x: 3, y: 5 }, { x: 2, y: 5 }], 'zorunlu');
      cizici.elGoster([{ x: 3, y: 5 }, { x: 2, y: 5 }]);
      girdi.zorunluAyarla({ tur: 'surukle', kaynak: { x: 3, y: 5 }, hedef: { x: 2, y: 5 } });
      return 'zorunlu';
    case 'kaskat':
    case 'saheser':
    case 'solen': {
      bolumAc('vitrin');
      cizici.dev.dondur(true);
      const o: Olay[] =
        ad === 'solen' ? [{ t: 0, tur: 'solenBasladi', kalanHamle: 5 }] : [{ t: 0, tur: 'kaskat', k: ad === 'kaskat' ? 3 : 5, kademe: ad === 'kaskat' ? 'nefis' : 'saheser' }];
      void cizici.oynat(d, o, d);
      return ad;
    }
    case 'hayalet':
      bolumAc('vitrin');
      cizici.hayaletHamle({ tur: 'surukle', kaynak: { x: 2, y: 5 }, hedef: { x: 3, y: 5 } });
      cizici.imlecGoster({ x: 5, y: 2 });
      return 'hayalet';
    case 'kararma':
      bolumAc('sade');
      cizici.karart(0.55);
      return 'kararma';
    case 'ipucu': {
      bolumAc('sade');
      const h = olumluBul(3);
      if (h) cizici.vurgula([h.kaynak, h.hedef], 'ipucu');
      return 'ipucu';
    }
    default: {
      // Hamle senaryoları: (bölüm, hamle) oynat; çağıran ilerle(ms) ile istenen ana gider.
      const tablo: Record<string, [string, Hamle]> = {
        tarak: ['vitrin', { tur: 'surukle', kaynak: { x: 5, y: 5 }, hedef: { x: 5, y: 4 } }],
        girdap: ['vitrin', { tur: 'surukle', kaynak: { x: 1, y: 7 }, hedef: { x: 1, y: 6 } }],
        lale: ['vitrin', { tur: 'surukle', kaynak: { x: 6, y: 6 }, hedef: { x: 6, y: 5 } }],
        murekkep: ['vitrin', { tur: 'surukle', kaynak: { x: 3, y: 4 }, hedef: { x: 3, y: 3 } }],
        birlesim: ['vitrin', { tur: 'surukle', kaynak: { x: 0, y: 7 }, hedef: { x: 1, y: 7 } }],
      };
      const s = tablo[ad];
      if (s) {
        bolumAc(s[0]);
        cizici.dev.dondur(true);
        void oyna(s[1]);
        return ad;
      }
      if (ad === 'karisim' || ad === 'eslesme') {
        bolumAc('vitrin');
        const h = olumluBul(3);
        if (!h) return 'yok';
        cizici.dev.dondur(true);
        void oyna(h);
        return JSON.stringify(h);
      }
      return 'bilinmeyen';
    }
  }
}

bolumAc('vitrin');
let son = 0;
const dongu = (t: number) => {
  const dt = son ? t - son : 16;
  son = t;
  cizici.kare(dt);
  requestAnimationFrame(dongu);
};
requestAnimationFrame(dongu);

window.__sahne = {
  cizici,
  durum: () => d,
  senaryo,
  ilerle: (ms: number) => cizici.dev.ilerle(ms),
  dondur: (b: boolean) => cizici.dev.dondur(b),
  hamle: (kx: number, ky: number, hx: number, hy: number) => oyna({ tur: 'surukle', kaynak: { x: kx, y: ky }, hedef: { x: hx, y: hy } }),
  bot: async (n = 1) => {
    for (let i = 0; i < n; i++) {
      const h = sahteBotHamle(d, rnd);
      if (!h) break;
      await oyna(h);
    }
  },
  surukle,
  kagit,
  bolum: bolumAc,
  sayac: () => cizici.dev.sayac(),
  onIsit: async (ad: string) => {
    const t0 = performance.now();
    await cizici.onIsit(BOLUMLER[ad] ?? VITRIN);
    return { ms: Math.round(performance.now() - t0), ...cizici.dev.sayac() };
  },
  yazi: () => yazi.then(() => true),
};
