/**
 * BARUT — açılış, döngü, girdi. Simülasyon sabit 1/60 s adımla ilerler;
 * çizim her karede bir kez. `window.__barut` deneme/kayıt kancasıdır.
 */
import { Dunya, G } from './dunya';
import { EK, K, Sahne, bombaDugme, sesDugme, type Arayuz } from './sahne';
import { Ses } from './ses';
import { Tuval } from './tuval';

const ADIM = 1 / 60;
/**
 * Yatay sürükleme kazancı parmağın hızına göre artar (fare ivmesi gibi):
 * yavaş hareket hassas, hızlı çekiş uzağa götürür. Dünya ekrandan geniş
 * olduğu için sabit düşük kazançta parmak kenara varır, yol bitmez.
 */
const KAZANC_YAVAS = 1.35;
const KAZANC_HIZLI = 2.6;
/** Parmak ekranın bu kadar kenarındaysa helikopter o yöne gitmeye devam eder. */
const KENAR = 34;
const REKOR_ANAHTAR = 'barut-rekor';

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

/** Dünya yüksekliği (birim) ve tuvalin piksel yüksekliği. */
let yuk = 0;
let ey = 0;
let tuval!: Tuval;
let dunya!: Dunya;
let sahne!: Sahne;
let goruntu!: ImageData;
let pikseller!: Uint32Array;

const ses = new Ses();
const arayuz: Arayuz = { durum: 'baslik', rekor: rekorOku(), yeniRekor: false, sesAcik: true, duyuru: '', duyuruT: 9, sonucT: 0, ipucuT: 0 };
/** `id`: helikopteri süren parmak. `t0`/`yol`: kısa dokunuşu sürüklemeden ayırmak için. */
const parmak = { basili: false, x: 0, y: 0, id: -1, t0: 0, yol: 0, sonT: 0 };
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
    ey = Math.round(yuk * K);
    kanvas.width = EK;
    kanvas.height = ey;
    tuval = new Tuval(EK, ey);
    goruntu = ctx.createImageData(EK, ey);
    pikseller = new Uint32Array(goruntu.data.buffer);
    yeniDunya();
  }
  const olcek = Math.min(gw / EK, gh / ey);
  kanvas.style.width = `${Math.floor(EK * olcek)}px`;
  kanvas.style.height = `${Math.floor(ey * olcek)}px`;
}
window.addEventListener('resize', boyutla);
boyutla();

// ---- Girdi ----

function ekrandan(e: PointerEvent): { x: number; y: number } {
  const r = kanvas.getBoundingClientRect();
  // Ekran pikseli (tuval çözünürlüğünde)
  return { x: ((e.clientX - r.left) / r.width) * EK, y: ((e.clientY - r.top) / r.height) * ey };
}

function basla(): void {
  if (arayuz.durum === 'sonuc') yeniDunya();
  arayuz.durum = 'oyun';
  arayuz.yeniRekor = false;
  arayuz.duyuruT = 9;
  arayuz.ipucuT = 0;
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
  const sd = sesDugme();
  if (p.x > sd.x - 8 && p.y > sd.y - 8 && p.y < sd.y + sd.h + 8) {
    sesDegistir();
    return;
  }
  if (arayuz.durum === 'baslik') {
    basla();
  } else if (arayuz.durum === 'sonuc') {
    if (arayuz.sonucT > 1.6) basla();
    return;
  } else {
    // Bomba: düğmeye dokunmak ya da helikopteri sürerken ikinci parmakla dokunmak
    const b = bombaDugme(ey);
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 8 || parmak.basili) {
      dunya.bombaBirak();
      return;
    }
  }
  try {
    kanvas.setPointerCapture(e.pointerId);
  } catch {
    /* yoksa da olur */
  }
  parmak.basili = true;
  parmak.id = e.pointerId;
  parmak.x = p.x;
  parmak.y = p.y;
  parmak.t0 = performance.now();
  parmak.sonT = parmak.t0;
  parmak.yol = 0;
});
kanvas.addEventListener('pointermove', (e) => {
  if (!parmak.basili || e.pointerId !== parmak.id || arayuz.durum !== 'oyun') return;
  const p = ekrandan(e);
  // Göreli sürükleme: helikopter parmağın altında kalmaz.
  // Yatayda dünya ekrandan geniş: kazanç yüksek olmazsa parmak ekranın kenarına
  // varır, yol bitmez, kaldırıp yeniden sürüklemek gerekir.
  const simdi = performance.now();
  const gecen = Math.max(4, simdi - parmak.sonT);
  parmak.sonT = simdi;
  const hiz = (Math.abs(p.x - parmak.x) / gecen) * 1000; // tuval pikseli / sn
  const kazanc = KAZANC_YAVAS + (KAZANC_HIZLI - KAZANC_YAVAS) * Math.min(1, Math.max(0, (hiz - 150) / 700));
  dunya.surukle(((p.x - parmak.x) / K) * kazanc, ((p.y - parmak.y) / K) * 1.25);
  parmak.yol += Math.abs(p.x - parmak.x) + Math.abs(p.y - parmak.y);
  parmak.x = p.x;
  parmak.y = p.y;
});
const birak = (e: PointerEvent): void => {
  if (e.pointerId !== parmak.id) return;
  // Sürüklemeden kısa bir dokunuş: bomba
  if (parmak.basili && arayuz.durum === 'oyun' && e.type === 'pointerup' && parmak.yol < 8 && performance.now() - parmak.t0 < 240 && arayuz.ipucuT > 0.4) {
    dunya.bombaBirak();
  }
  parmak.basili = false;
  parmak.id = -1;
};
kanvas.addEventListener('pointerup', birak);
kanvas.addEventListener('pointercancel', birak);
kanvas.addEventListener('contextmenu', (e) => e.preventDefault());

const tusla = (e: KeyboardEvent, bas: boolean): void => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') tus.sol = bas;
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') tus.sag = bas;
  else if (k === 'ArrowDown' || k === 's' || k === 'S') tus.asagi = bas;
  else if (k === 'ArrowUp' || k === 'w' || k === 'W') tus.yukari = bas;
  else if (bas && (k === 'm' || k === 'M')) sesDegistir();
  else if (bas && (k === ' ' || k === 'Enter' || k === 'b' || k === 'B')) {
    if (arayuz.durum === 'oyun' && !e.repeat) dunya.bombaBirak();
  } else return;
  e.preventDefault();
  if (bas) {
    ses.baslat();
    if (arayuz.durum === 'baslik' || (arayuz.durum === 'sonuc' && arayuz.sonucT > 1.6)) basla();
  }
};
window.addEventListener('keydown', (e) => tusla(e, true));
window.addEventListener('keyup', (e) => tusla(e, false));

// ---- Olaylar → ses, arayüz ----

function olaylar(): void {
  for (const o of dunya.olaylar) {
    switch (o.tip) {
      case 'ates':
        ses.ates();
        break;
      case 'tufek':
        ses.tufek();
        break;
      case 'roket':
        ses.roket();
        break;
      case 'top':
        ses.top();
        break;
      case 'patlama':
        ses.patlama(o.r);
        break;
      case 'isabet':
        ses.isabet();
        break;
      case 'olum':
        ses.olum();
        break;
      case 'uyari':
        ses.uyari();
        break;
      case 'jet':
        ses.jet();
        break;
      case 'sandik':
        ses.sandik();
        break;
      case 'bomba':
        ses.bomba();
        break;
      case 'mayin':
        ses.uyari();
        break;
      case 'dalga':
        arayuz.duyuru = `DALGA ${o.no}`;
        arayuz.duyuruT = 0;
        ses.dalga();
        break;
      case 'dalgaBitti':
        arayuz.duyuru = 'TEMİZLENDİ';
        arayuz.duyuruT = 0;
        ses.dalgaBitti();
        break;
      case 'bitti':
        arayuz.durum = 'sonuc';
        arayuz.sonucT = 0;
        parmak.basili = false;
        parmak.id = -1;
        if (dunya.skor > arayuz.rekor) {
          arayuz.rekor = dunya.skor;
          arayuz.yeniRekor = true;
          rekorYaz(dunya.skor);
        }
        ses.bitis();
        break;
    }
  }
  dunya.olaylar.length = 0;
}

function adimAt(dt: number): void {
  if (arayuz.durum === 'oyun') {
    const yatay = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
    const dikey = (tus.asagi ? 1 : 0) - (tus.yukari ? 1 : 0);
    if (yatay || dikey) dunya.surukle(yatay * 230 * dt, dikey * 200 * dt);
    // Kenar itme: parmak ekranın kenarında bekliyorsa yolculuk sürer
    if (parmak.basili) {
      if (parmak.x < KENAR) dunya.surukle(-190 * dt, 0);
      else if (parmak.x > EK - KENAR) dunya.surukle(190 * dt, 0);
    }
  }
  dunya.adim(dt);
  sahne.guncelle(dt);
  arayuz.duyuruT += dt;
  if (arayuz.durum === 'oyun') arayuz.ipucuT += dt;
  if (arayuz.durum === 'sonuc') arayuz.sonucT += dt;
  olaylar();
}

function ciz(): void {
  sahne.ciz(arayuz);
  tuval.sun(pikseller, dunya.parla * 0.5);
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
  while (birikim >= ADIM && n++ < 5) {
    adimAt(ADIM);
    birikim -= ADIM;
  }
  const h = dunya.heli;
  ses.ortam(Math.hypot(h.vx, h.vy), arayuz.durum === 'oyun' && !h.olu);
  ciz();
}
requestAnimationFrame(kare);

// Deneme / kayıt kancası
(window as unknown as { __barut: unknown }).__barut = {
  get dunya() {
    return dunya;
  },
  arayuz,
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
