/**
 * Çizici geliştirme sayfası (dev/cizici.html). Bölüm 1'i ya da elle
 * kurulmuş zengin tahtayı gösterir; URL parametreleriyle sahte olay dizisi
 * oynatır. Yalnız geliştirme içindir (sahte HUD, sahte olaylar).
 *
 * URL:
 *   ?tahta=zengin|b1        tahta (varsayılan zengin)
 *   ?senaryo=buyuk|roket|kasimpati|yildiz|kombo|halka|final|karistir|hava|devfisek|iz|kazanc|kayip|b1
 *   ?gecikme=600            senaryo başlamadan önce ms
 *   ?dongu=1                senaryoyu döngüde oynat
 *   ?palet=renkKoru|yuksekKontrast
 *   ?mahalle=0..7           gökyüzü/siluet teması
 *   ?cizim=6                ilk n düğümü çizilmiş göster (önizleme)
 *   ?el=1  ?hayalet=1  ?vurgu=zorunlu|ipucu|secim
 *   ?fisek=izgara           24 desenin ızgarası
 *   ?tablo=1                Gece Tablosu örnekleri
 *   ?hud=0                  sahte HUD'u gizle
 *   ?azalt=1                hareketi azalt
 *
 * Test kancası: window.__cizici (senaryo, cizim, dev.ilerle, dev.dondur…).
 */
import { Stage } from '../stage';
import { oyunCiziciOlustur, type OyunCiziciTam } from '../oyunCizici';
import { bolumuYukle } from '../../core/bolumYukle';
import type { BolumVerisi, Hamle, Icerik, Konum, Olay, OyunDurumu } from '../../core/types';
import type { Palet } from '../../app/sozlesme';
import { DESENLER, KAPSUL_RENKLERI } from '../../app/katalog';
import { sahteFinal, sahteHamle, sahteOnizle } from './sahteOlaylar';
import { BUYUK_YOL, ONIZLEME_YOL, ZENGIN } from './zenginTahta';
import b001 from '../../levels/veri/b001.json';
import { tabloCiz, type TabloKaydi } from '../tablo';

const q = new URLSearchParams(location.search);
const tahtaAd = q.get('tahta') ?? (q.get('senaryo') === 'b1' ? 'b1' : 'zengin');
const veri: BolumVerisi = structuredClone(tahtaAd === 'b1' ? (b001 as unknown as BolumVerisi) : ZENGIN);
if (q.has('mahalle')) veri.mahalle = Number(q.get('mahalle'));
const hudGoster = q.get('hud') !== '0';

const host = document.getElementById('app')!;
const hudEl = document.getElementById('hud')!;
const stage = new Stage(host, 2);
const cizici: OyunCiziciTam = oyunCiziciOlustur(stage, {
  kalite: 'yuksek',
  palet: (q.get('palet') as Palet) ?? 'standart',
  hareketiAzalt: q.get('azalt') === '1',
  desenler: ['kasimpati', 'palmiye', 'halka', 'ciftHalka', 'sogut', 'kalp'],
  gelistirme: true,
});

let ilk = bolumuYukle(veri, 0);
let durum: OyunDurumu = ilk;

// ------------------------------------------------------------------ sahte HUD
const kartlar: HTMLDivElement[] = [];
const hamleEl = document.createElement('div');
const puanEl = document.createElement('div');
let puan = 0;

function hudKur(): void {
  hudEl.innerHTML = '';
  kartlar.length = 0;
  if (!hudGoster) return;
  durum.hedefler.forEach((h) => {
    const k = document.createElement('div');
    k.className = 'kart';
    const ik = document.createElement('i');
    const hd = h.hedef;
    ik.style.background = hd.tur === 'topla' && hd.renk !== 'hepsi' ? KAPSUL_RENKLERI[hd.renk].ana : hd.tur === 'kafes' ? '#D9A441' : hd.tur === 'aydinlat' ? '#FFC86B' : '#FFF3D6';
    k.appendChild(ik);
    const sp = document.createElement('span');
    sp.textContent = String(h.gerekli - h.ilerleme);
    k.appendChild(sp);
    hudEl.appendChild(k);
    kartlar.push(k);
  });
  hamleEl.id = 'hamle';
  hamleEl.textContent = String(durum.kalanHamle);
  puanEl.id = 'puan';
  puanEl.textContent = String(puan);
  hudEl.appendChild(hamleEl);
  hudEl.appendChild(puanEl);
  const alt = document.createElement('div');
  alt.id = 'alt';
  alt.innerHTML = '<div class="d"></div><div class="orta"><div class="d"></div><div class="d"></div><div class="d"></div></div><div class="k"></div>';
  hudEl.appendChild(alt);
  if (document.body.classList.contains('yan')) {
    const p = document.createElement('div');
    p.id = 'panel';
    hudEl.insertBefore(p, hudEl.firstChild);
  }
}

/** §13.7 yerleşimi: dikeyde üst bant %20, tahta %20–86, alt çubuk; yatayda solda %62 + sağ panel. */
function yerlesim(): void {
  const W = stage.width;
  const H = stage.height;
  const dikey = W / H <= 0.75;
  document.body.classList.toggle('yan', !dikey);
  hudKur();
  let ust = Math.round(H * 0.2);
  if (dikey) {
    const hucre = Math.floor(Math.min((W - 32) / durum.w, (0.66 * H - 24) / durum.h, 64));
    if (hucre < 40) ust = Math.round(H * 0.14);
    const alt = Math.round(H * 0.86);
    cizici.alanAyarla({ x: 0, y: ust, w: W, h: alt - ust }, { x: 0, y: 0, w: W, h: ust });
    // Kartlar: solda en fazla 3 (64×48), ortada hamle dairesi, sağda puan.
    const y = Math.max(10, ust * 0.42 - 24);
    kartlar.forEach((k, i) => {
      k.style.left = `${8 + i * 68}px`;
      k.style.top = `${y}px`;
    });
    const hx = Math.max(W / 2 - 28, 8 + kartlar.length * 68 + 2);
    hamleEl.style.left = `${hx}px`;
    hamleEl.style.top = `${y - 4}px`;
    puanEl.style.width = `${Math.min(120, W - hx - 56 - 16)}px`;
    puanEl.style.left = `${W - 8 - Math.min(120, W - hx - 56 - 16)}px`;
    puanEl.style.top = `${y + 4}px`;
  } else {
    cizici.alanAyarla({ x: 0, y: 80, w: Math.round(W * 0.62), h: H - 160 }, { x: 0, y: 0, w: W, h: Math.round(H * 0.18) });
    kartlar.forEach((k, i) => {
      k.style.left = `${W - 296 + i * 72}px`;
      k.style.top = `110px`;
    });
    hamleEl.style.left = `${W - 296}px`;
    hamleEl.style.top = `190px`;
    puanEl.style.left = `${W - 200}px`;
    puanEl.style.top = `198px`;
  }
  // Hedef kartlarının merkezleri → kıvılcım uçuşu.
  requestAnimationFrame(() => {
    cizici.hedefKonumlari(
      kartlar.map((k) => {
        const r = k.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }),
    );
  });
}

cizici.olayDinle((o: Olay) => {
  if (o.tur === 'hedefIlerledi') {
    const k = kartlar[o.indeks];
    if (!k) return;
    const h = durum.hedefler[o.indeks] ?? ilk.hedefler[o.indeks];
    (k.querySelector('span') as HTMLSpanElement).textContent = String(Math.max(0, (h?.gerekli ?? 0) - o.deger));
    k.classList.add('zipla');
    setTimeout(() => k.classList.remove('zipla'), 150);
    if (o.tamam) k.classList.add('tamam');
  } else if (o.tur === 'patlama' || o.tur === 'puanEklendi') {
    puan += o.tur === 'patlama' ? o.puan : o.miktar;
    puanEl.textContent = String(puan);
  }
});

cizici.bolumKur(durum, veri);
stage.onResize(() => yerlesim());

// ------------------------------------------------------------------ döngü
let son = performance.now();
function dongu(t: number): void {
  const dt = t - son;
  son = t;
  cizici.kare(dt);
  requestAnimationFrame(dongu);
}
requestAnimationFrame(dongu);

// ------------------------------------------------------------------ senaryolar
function hucreIcerik(d: OyunDurumu, x: number, y: number): Icerik | null {
  return d.hucreler[y * d.w + x].icerik;
}

async function oyna(h: Hamle | 'final' | Olay[], d0: OyunDurumu = durum): Promise<void> {
  let sonuc: { durum: OyunDurumu; olaylar: Olay[] };
  if (h === 'final') sonuc = sahteFinal(d0);
  else if (Array.isArray(h)) sonuc = { durum: d0, olaylar: h };
  else sonuc = sahteHamle(d0, h);
  hamleEl.textContent = String(sonuc.durum.kalanHamle);
  await cizici.oynat(d0, sonuc.olaylar, sonuc.durum);
  durum = sonuc.durum;
}

function degistir(f: (d: OyunDurumu) => void): OyunDurumu {
  const d = structuredClone(durum);
  f(d);
  cizici.durumGoster(d);
  durum = d;
  return d;
}

const kapsul = (renk: number, ek: Partial<Extract<Icerik, { tur: 'kapsul' }>> = {}): Icerik => ({ tur: 'kapsul', renk: renk as 0, isi: 0, ozel: 'yok', eksen: 0, ...ek });

const SENARYOLAR: Record<string, () => Promise<void>> = {
  async buyuk() {
    await oyna({ tur: 'fitil', yol: BUYUK_YOL, halka: false });
  },
  async b1() {
    await oyna({ tur: 'fitil', yol: [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }], halka: false });
  },
  async roket() {
    await oyna({ tur: 'ciftDokunus', hucre: { x: 2, y: 4 } });
  },
  async kasimpati() {
    await oyna({ tur: 'ciftDokunus', hucre: { x: 5, y: 4 } });
  },
  async yildiz() {
    await oyna({ tur: 'ciftDokunus', hucre: { x: 3, y: 7 } });
  },
  async kombo() {
    const d = degistir((d) => {
      d.hucreler[4 * d.w + 3].icerik = kapsul(2);
      d.hucreler[4 * d.w + 4].icerik = kapsul(2);
      d.hucreler[4 * d.w + 5].icerik = kapsul(2, { ozel: 'kasimpati' });
    });
    await oyna({ tur: 'fitil', yol: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }], halka: false }, d);
  },
  async halka() {
    const d = degistir((d) => {
      for (const [x, y] of [[1, 2], [2, 2], [2, 3], [1, 3]]) d.hucreler[y * d.w + x].icerik = kapsul(3);
    });
    await oyna({ tur: 'fitil', yol: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }], halka: true }, d);
  },
  async final() {
    await oyna('final');
  },
  async karistir() {
    const d0 = durum;
    const d = structuredClone(d0);
    const yerler: Konum[] = [];
    d.hucreler.forEach((h, i) => {
      if (h.icerik?.tur === 'kapsul' && !h.kafes) yerler.push({ x: i % d.w, y: (i / d.w) | 0 });
    });
    const karisik = [...yerler];
    for (let i = karisik.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1);
      [karisik[i], karisik[j]] = [karisik[j], karisik[i]];
    }
    const esleme = yerler.map((den, k) => ({ den, e: karisik[k] }));
    const icerikler = yerler.map((p) => d0.hucreler[p.y * d.w + p.x].icerik);
    esleme.forEach((m, k) => (d.hucreler[m.e.y * d.w + m.e.x].icerik = structuredClone(icerikler[k])));
    await oyna([{ t: 0, tur: 'karistirma', esleme, yenidenRenk: [] }], d0).then(() => undefined);
    durum = d;
    cizici.durumGoster(d);
  },
  async hava() {
    await oyna([{ t: 0, tur: 'havaOlayi', olay: 'meltem', eksen: 'satir', hat: 3, uyari: true }, { t: 0, tur: 'havaOlayi', olay: 'cisenti', eksen: 'sutun', hat: 6, uyari: true }]);
    await new Promise((r) => setTimeout(r, 1500));
    const d = structuredClone(durum);
    const ol: Olay[] = [{ t: 0, tur: 'havaOlayi', olay: 'meltem', eksen: 'satir', hat: 3, uyari: false }];
    for (let x = 0; x < d.w; x++) {
      const c = d.hucreler[3 * d.w + x].icerik;
      if (c?.tur === 'kapsul' && c.isi < d.esik - 1) {
        c.isi++;
        ol.push({ t: 80 + x * 40, tur: 'isiDegisti', hucre: { x, y: 3 }, isi: c.isi });
      }
    }
    const s = await cizici.oynat(durum, ol, d);
    void s;
    durum = d;
  },
  async devfisek() {
    const d = degistir((d) => {
      const c = d.hucreler[0 * d.w + 3].icerik;
      if (c?.tur === 'devFisek') c.dolum = 4;
      d.hucreler[1 * d.w + 3].icerik = kapsul(2);
    });
    await oyna({ tur: 'kibrit', hucre: { x: 3, y: 1 } }, d);
  },
  async iz() {
    await oyna({ tur: 'kibrit', hucre: { x: 1, y: 3 } });
  },
  async kazanc() {
    await oyna([{ t: 0, tur: 'bolumBitti', sonuc: 'kazanc' }]);
  },
  async kayip() {
    await oyna([{ t: 0, tur: 'bolumBitti', sonuc: 'kayip' }]);
  },
};

async function senaryo(ad: string): Promise<void> {
  const f = SENARYOLAR[ad];
  if (!f) throw new Error(`senaryo yok: ${ad}`);
  await f();
}

function sifirla(): void {
  ilk = bolumuYukle(veri, 0);
  durum = ilk;
  puan = 0;
  cizici.bolumKur(durum, veri);
  yerlesim();
}

/** İlk n düğümü çizilmiş göster (önizleme dahil); parmak son düğümün biraz ötesinde. */
function cizim(n: number, yol: Konum[] = ONIZLEME_YOL, halka = false): void {
  const p = yol.slice(0, n);
  const renk = (() => {
    for (const k of p) {
      const c = hucreIcerik(durum, k.x, k.y);
      if (c?.tur === 'kapsul' && c.renk >= 0) return c.renk;
    }
    return -1;
  })();
  const g = cizici.geometri();
  if (p.length) {
    const s = p[p.length - 1];
    cizici.parmak({ x: g.x + (s.x + 0.78) * g.hucre, y: g.y + (s.y + 0.32) * g.hucre });
  } else cizici.parmak(null);
  cizici.yolGoster(p, halka, renk, p.length ? sahteOnizle(durum, p, halka) : null);
}

/** Düğüm düğüm canlı çizim (yay ve kıvılcımları görmek için). */
async function canliCizim(yol: Konum[] = ONIZLEME_YOL, aralik = 260): Promise<void> {
  for (let n = 1; n <= yol.length; n++) {
    cizim(n, yol);
    await new Promise((r) => setTimeout(r, aralik));
  }
}

// ------------------------------------------------------------------ fişek ızgarası ve tablolar
/**
 * Desen ızgarası. Parçacık havuzu 800 olduğu için 24 desen aynı anda sığmaz:
 * `sayfa` 0..2 sekizer desen gösterir (ekran görüntüleri birleştirilir).
 */
function fisekIzgarasi(an = 520, sayfa = 0): void {
  const W = stage.width;
  const H = stage.height;
  const sut = W > H ? 4 : 2;
  const sat = 8 / sut;
  const hw = W / sut;
  const hh = H / sat;
  cizici.dev.yalnizGok(true);
  hudEl.innerHTML = '';
  DESENLER.slice(sayfa * 8, sayfa * 8 + 8).forEach((d, i) => {
    const x = (i % sut) * hw + hw / 2;
    const y = Math.floor(i / sut) * hh + hh * 0.46;
    cizici.dev.fisekPatlat(x, y, (i + sayfa * 8) % 6, d.id, Math.min(hw, hh) / 300);
    const e = document.createElement('div');
    e.className = 'etiket';
    e.style.left = `${x}px`;
    e.style.top = `${Math.floor(i / sut) * hh + hh - 18}px`;
    e.textContent = d.ad;
    hudEl.appendChild(e);
  });
  cizici.dev.ilerle(an);
  cizici.dev.dondur(true);
}

function tablolar(): void {
  const kap = document.getElementById('tablolar')!;
  kap.style.display = 'flex';
  const kayitlar: TabloKaydi[] = [];
  // Bir zincir + ısı kaskadı + roket + kasımpatı + final benzeri dağılım.
  for (let i = 0; i < 6; i++) kayitlar.push({ x: i, y: 6, renk: 0, nesil: 0, ozel: 0, t: i * 9 });
  for (let i = 0; i < 7; i++) kayitlar.push({ x: i, y: 5 - (i % 2), renk: (i % 5) + 0, nesil: 1 + (i % 3), ozel: 0, t: 30 + i * 9 });
  kayitlar.push({ x: 2, y: 4, renk: 2, nesil: 2, ozel: 1, t: 60 });
  kayitlar.push({ x: 5, y: 4, renk: 1, nesil: 2, ozel: 2, t: 70 });
  kayitlar.push({ x: 3, y: 2, renk: 7, nesil: 3, ozel: 3, t: 90 });
  for (let i = 0; i < 20; i++) kayitlar.push({ x: (i * 3) % 7, y: (i * 5) % 9, renk: i % 6, nesil: i % 4, ozel: i % 7 === 0 ? 1 : 0, t: 100 + i * 7 });
  ['sade', 'parlak', 'saheser'].forEach((n, k) => {
    const c = tabloCiz(kayitlar.slice(0, 12 + k * 12), veri.mahalle + k, n as 'sade', 512, 768, 9001);
    kap.appendChild(c);
  });
}

// ------------------------------------------------------------------ test kancası
declare global {
  interface Window {
    __cizici: unknown;
  }
}
window.__cizici = {
  cizici,
  stage,
  dev: cizici.dev,
  durum: () => durum,
  senaryo,
  sifirla,
  cizim,
  canliCizim,
  fisekIzgarasi,
  tablolar,
  degistir,
};

// ------------------------------------------------------------------ URL ile başlat
yerlesim();
if (q.get('vurgu') === 'zorunlu') cizici.vurgula(BUYUK_YOL, 'zorunlu');
if (q.get('vurgu') === 'ipucu') cizici.vurgula(BUYUK_YOL, 'ipucu');
if (q.get('vurgu') === 'secim') cizici.vurgula([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }], 'secim');
if (q.get('el') === '1') cizici.elGoster(tahtaAd === 'b1' ? [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }] : BUYUK_YOL);
if (q.get('hayalet') === '1') cizici.hayaletFitil(BUYUK_YOL, false);
if (q.has('cizim')) cizim(Number(q.get('cizim')));
if (q.get('fisek') === 'izgara') setTimeout(() => fisekIzgarasi(Number(q.get('an') ?? 520), Number(q.get('sayfa') ?? 0)), 300);
if (q.get('tablo') === '1') tablolar();
const sen = q.get('senaryo');
if (sen) {
  const gecikme = Number(q.get('gecikme') ?? 600);
  const calis = async () => {
    await new Promise((r) => setTimeout(r, gecikme));
    await senaryo(sen);
    if (q.get('dongu') === '1') {
      await new Promise((r) => setTimeout(r, 1500));
      sifirla();
      void calis();
    }
  };
  void calis();
}
