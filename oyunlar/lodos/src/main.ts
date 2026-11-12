/**
 * LODOS — açılış, döngü, girdi. Simülasyon sabit 1/60 s adımla ilerler;
 * çizim her karede bir kez. `window.__lodos` deneme/kayıt kancasıdır.
 */
import { Dunya, G, TUR, type Girdi } from './dunya';
import { Sahne, type Arayuz } from './sahne';
import { Ses } from './ses';
import { Tuval } from './tuval';

const ADIM = 1 / 60;
const REKOR_ANAHTAR = 'lodos-rekor';

function rekorOku(): number {
  try {
    return Number(localStorage.getItem(REKOR_ANAHTAR)) || 0;
  } catch {
    return 0;
  }
}
function rekorYaz(v: number): void {
  try {
    localStorage.setItem(REKOR_ANAHTAR, String(v));
  } catch {
    /* özel pencere: kayıt yok, oyun yine çalışır */
  }
}

const kok = document.getElementById('app')!;
const kanvas = document.createElement('canvas');
kanvas.tabIndex = 0;
kok.appendChild(kanvas);
const ctx = kanvas.getContext('2d', { alpha: false })!;

let yuk = 0;
let tuval!: Tuval;
let dunya!: Dunya;
let sahne!: Sahne;
let goruntu!: ImageData;
let pikseller!: Uint32Array;

const ses = new Ses();
const arayuz: Arayuz = { durum: 'baslik', rekor: rekorOku(), yeniRekor: false, sesAcik: true, fazYazi: '', fazT: 9, sonucT: 0 };
const girdi: Girdi = { basili: false, x: 0, y: 0 };
/** Parmağın ekrandaki yeri (mantıksal piksel); kamera kayınca dünya yeri değişir. */
const parmak = { basili: false, x: 0, y: 0 };
const tus = { sol: false, sag: false, asagi: false, yukari: false };

function yeniDunya(): void {
  dunya = new Dunya(yuk, (Math.random() * 1e9) | 0);
  sahne = new Sahne(tuval, dunya);
}

function boyutla(): void {
  // Kutunun iç ölçüsü: yan boşluklar ve telefonun güvenli alanı düşülmüş hali.
  const gw = kok.clientWidth || window.innerWidth;
  const gh = kok.clientHeight || window.innerHeight;
  const oran = Math.min(0.62, Math.max(0.42, gw / gh));
  const yeniYuk = Math.round(G / oran);
  if (yeniYuk !== yuk && (yuk === 0 || arayuz.durum === 'baslik')) {
    yuk = yeniYuk;
    kanvas.width = G;
    kanvas.height = yuk;
    tuval = new Tuval(G, yuk);
    goruntu = ctx.createImageData(G, yuk);
    pikseller = new Uint32Array(goruntu.data.buffer);
    yeniDunya();
  }
  const olcek = Math.min(gw / G, gh / yuk);
  kanvas.style.width = `${Math.floor(G * olcek)}px`;
  kanvas.style.height = `${Math.floor(yuk * olcek)}px`;
}
window.addEventListener('resize', boyutla);
boyutla();

// ---- Girdi ----

function ekrandan(e: PointerEvent): { x: number; y: number } {
  const r = kanvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * G, y: ((e.clientY - r.top) / r.height) * yuk };
}

function basla(): void {
  if (arayuz.durum === 'sonuc') yeniDunya();
  arayuz.durum = 'oyun';
  arayuz.yeniRekor = false;
  arayuz.fazT = 9;
  dunya.basla();
  ses.dokun();
}

function sesDegistir(): void {
  arayuz.sesAcik = !arayuz.sesAcik;
  ses.sesAc(arayuz.sesAcik);
}

kanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  ses.baslat();
  const p = ekrandan(e);
  if (p.x > G - 20 && p.y < 18) {
    sesDegistir();
    return;
  }
  if (arayuz.durum === 'baslik') {
    basla();
    return;
  }
  if (arayuz.durum === 'sonuc') {
    if (arayuz.sonucT > 1.6) basla();
    return;
  }
  try {
    kanvas.setPointerCapture(e.pointerId);
  } catch {
    /* yoksa da olur */
  }
  parmak.basili = true;
  parmak.x = p.x;
  parmak.y = p.y;
});
kanvas.addEventListener('pointermove', (e) => {
  if (!parmak.basili) return;
  const p = ekrandan(e);
  parmak.x = p.x;
  parmak.y = p.y;
});
const birak = (): void => {
  parmak.basili = false;
};
kanvas.addEventListener('pointerup', birak);
kanvas.addEventListener('pointercancel', birak);
kanvas.addEventListener('contextmenu', (e) => e.preventDefault());

const tusla = (e: KeyboardEvent, bas: boolean): void => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') tus.sol = bas;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') tus.sag = bas;
  else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === ' ') tus.asagi = bas;
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') tus.yukari = bas;
  else if (bas && (k === 'm' || k === 'M')) sesDegistir();
  else return;
  e.preventDefault();
  if (bas) {
    ses.baslat();
    if (arayuz.durum === 'baslik' || (arayuz.durum === 'sonuc' && arayuz.sonucT > 1.6)) basla();
  }
};
window.addEventListener('keydown', (e) => tusla(e, true));
window.addEventListener('keyup', (e) => tusla(e, false));

/** Klavye: oklar sanal bir parmağı kancaya göre oynatır. */
function girdiHazirla(): void {
  if (parmak.basili) {
    girdi.basili = true;
    girdi.x = parmak.x + dunya.kam.x;
    girdi.y = parmak.y;
    return;
  }
  const yatay = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
  const dikey = (tus.asagi ? 1 : 0) - (tus.yukari ? 1 : 0);
  if (!yatay && !tus.asagi && !tus.yukari) {
    girdi.basili = false;
    return;
  }
  girdi.basili = true;
  girdi.x = dunya.ucX() + yatay * 34;
  const suda = dunya.kancaY > dunya.yuzey(dunya.kancaX) + 3 || tus.asagi;
  girdi.y = suda ? Math.max(dunya.kancaY + dikey * 40, tus.yukari ? 0 : dunya.deniz + 12) : 0;
}

// ---- Olaylar → ses, arayüz ----

function olaylar(): void {
  for (const o of dunya.olaylar) {
    switch (o.tip) {
      case 'isirdi':
        ses.isirma();
        break;
      case 'yutuldu':
        ses.yutma(o.zincir);
        break;
      case 'yakalandi':
        ses.yakalama(o.deger);
        if (TUR[o.tur].sira >= 3) ses.miyav();
        break;
      case 'kedi':
        ses.miyav();
        break;
      case 'koptu':
        ses.kopma();
        break;
      case 'carpildi':
        ses.carpilma();
        break;
      case 'cirpin':
        ses.cirpinma();
        break;
      case 'simsek':
        ses.gok();
        break;
      case 'vapur':
        ses.duduk();
        break;
      case 'faz':
        arayuz.fazYazi = o.ad;
        arayuz.fazT = 0;
        ses.faz();
        break;
      case 'bitti':
        arayuz.durum = 'sonuc';
        arayuz.sonucT = 0;
        parmak.basili = false;
        if (dunya.para > arayuz.rekor) {
          arayuz.rekor = dunya.para;
          arayuz.yeniRekor = true;
          rekorYaz(dunya.para);
        }
        ses.bitis();
        break;
    }
  }
  dunya.olaylar.length = 0;
}

function adimAt(dt: number): void {
  girdiHazirla();
  dunya.adim(dt, girdi);
  sahne.guncelle(dt);
  arayuz.fazT += dt;
  if (arayuz.durum === 'sonuc') arayuz.sonucT += dt;
  olaylar();
}

function ciz(): void {
  sahne.ciz(arayuz);
  tuval.sun(pikseller, dunya.flas > 0);
  ctx.putImageData(goruntu, 0, 0);
}

let son = performance.now();
let birikim = 0;
let dondur = false;
function kare(simdi: number): void {
  requestAnimationFrame(kare);
  if (dondur) return;
  birikim += Math.min(0.1, (simdi - son) / 1000);
  son = simdi;
  let n = 0;
  while (birikim >= ADIM && n++ < 6) {
    adimAt(ADIM);
    birikim -= ADIM;
  }
  ses.ortam(dunya.yagmur, dunya.firtina, dunya.zaman);
  ciz();
}
requestAnimationFrame(kare);

// Deneme / kayıt kancası
(window as unknown as { __lodos: unknown }).__lodos = {
  get dunya() {
    return dunya;
  },
  arayuz,
  parmak,
  basla,
  /** Döngüyü durdurup elle ilerlet (belirlenimli kayıt). */
  dondur(v: boolean) {
    dondur = v;
  },
  ilerlet(saniye: number) {
    const n = Math.round(saniye / ADIM);
    for (let i = 0; i < n; i++) adimAt(ADIM);
    ciz();
  },
  ciz,
};
