/**
 * GEÇİCİ arayüz önizleme sayfası: dev/arayuz.html?ekran=<ad>[&v=..]
 * Arkada koyu gece gradyanı ve sahte tahta (yerleşim formülünün verdiği
 * dikdörtgende) çizilir; ekranlar sahte görünüm modelleriyle açılır.
 *
 * Ekranlar: acilis, harita, bolumOncesi, hud, duraklat, kazandin,
 * kaybettin, ayarlar, oyunOzeti (v=bos|az), nasil, defter, gunluk, istatistik, mola,
 * defterKarti, sandik, balon, bant, kutlama, secim.
 * Can, reklam, Mağaza (CAN-REKLAM §6): can (v=bitti|durum|kart|hakyok|
 * hazirdegil|dolu), magaza (v=sende|stok|bekle|yok), kaybettin (v=can|can0|
 * reklam|kart|canUsta), cikisOnayi (v=yeniden), harita&can=0..5, ayarlar&gelir=1
 * (&gizlilik=1: Android UMP "Reklam gizlilik seçenekleri" satırı).
 * Parametreler: v (çeşit), w/h (tahta), simdiki (harita), guvenli=47,0,34,0,
 * az=1 (hareketi azalt), palet=renkKoru|yuksekKontrast, tema=gece, panel, sekme, kart.
 */
import '../../style.css';
import { Arayuz } from '../arayuz';
import { kapsulYolu, kapsulRenkleri } from '../ikonlar';
import { Rng } from '../../platform/rng';
import * as O from './ornekler';
import { KASABA_ISLERI } from '../../app/katalog';
import type { Kenarlar, Yerlesim } from '../yerlesim';
import type { CanVM, HaritaSecimi, MagazaVM, Palet } from '../tipler';
import { M, MC, MK, tarihKisa } from '../metinler';
import { DIL, t } from '../../platform/dil';

// Oyundaki gibi (main.ts): büyük harfe çevirme dile göre (English'te I, Türkçede İ).
document.documentElement.lang = DIL;
const p = new URLSearchParams(location.search);
const ekran = p.get('ekran') ?? 'harita';
const v = p.get('v') ?? '1';
const tw = Number(p.get('w') ?? 7);
const th = Number(p.get('h') ?? 9);
const palet = (p.get('palet') ?? 'standart') as Palet;
const guvenliP = p.get('guvenli');
const guvenli: Kenarlar | undefined = guvenliP
  ? (([ust, sag, alt, sol]) => ({ ust, sag, alt, sol }))(guvenliP.split(',').map(Number))
  : undefined;

const app = document.getElementById('app')!;
const tuval = document.createElement('canvas');
tuval.className = 'sahne';
tuval.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
app.appendChild(tuval);

const log = (...a: unknown[]) => console.log('[ui]', ...a);

const ui = new Arayuz({
  kok: app,
  palet,
  hareketiAzalt: p.get('az') === '1',
  tema: p.get('tema') === 'gece' ? 'gece' : 'ahsap',
  guvenliAlan: guvenli,
  ses: { arayuz: (t) => log('ses', t) },
  titresim: (x) => log('titreşim', x),
  geri: {
    duraklatIstendi: () => void duraklatAc(),
    guclendiriciSecildi: (id) => {
      ui.secimKipi(id === 'kibrit' ? M.secimMetni.kibrit : M.secimMetni.kalip, id);
    },
    korukSecildi: () => ui.secimKipi(M.secimMetni.koruk, 'koruk'),
    secimIptal: () => ui.secimKipi(null),
    ayarDegisti: (d) => log('ayar', d),
    balonlariSifirla: () => log('balonlar'),
    kayitKodu: () => 'FTL1:eyJzdXJ1bSI6MSwia2F5aXRUb2h1bXUiOjQ4MTIzLCJib2x1bWxlciI6eyIxIjp7InlpbGRpeiI6MywiZW5JeWkiOjI0NTB9fX0=:7F3A',
    kayitOnizle: (k) => (k.startsWith('FTL1:') ? { gecerli: true, toplamYildiz: 37, sonBolum: 14, desen: 6, kayitTarihi: tarihKisa(20261012) } : { gecerli: false, hata: t('Kod “FTL1:” ile başlamalı', 'The code must start with “FTL1:”') }),
    kayitYukle: () => true,
    ilerlemeyiSifirla: () => log('sıfırla'),
    tabloKarari: (id, s) => log('tablo', id, s),
    tabloTuvali: () => sahteTablo(),
    desenTak: (id, t) => log('desen', id, t),
    fitilSec: (id) => log('fitil', id),
    gokyuzuSec: (id) => log('gök', id),
    tozHarca: (h) => log('toz', h),
  },
});
(window as unknown as { __ui: Arayuz }).__ui = ui;

// ─────────────── Sahte sahne (tuval) ───────────────
let tahtaGoster = false;
function sahneCiz(y: Yerlesim): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  tuval.width = Math.round(y.ekranW * dpr);
  tuval.height = Math.round(y.ekranH * dpr);
  const c = tuval.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, y.ekranH);
  g.addColorStop(0, '#0B1030');
  g.addColorStop(0.6, '#1E1A50');
  g.addColorStop(1, '#2A1450');
  c.fillStyle = g;
  c.fillRect(0, 0, y.ekranW, y.ekranH);
  const r = new Rng(7);
  for (let i = 0; i < 90; i++) {
    c.globalAlpha = 0.3 + r.float() * 0.6;
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(r.float() * y.ekranW, r.float() * y.ekranH * 0.5, 0.5 + r.float() * 1.2, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  // Kasaba silueti (üst bant altı)
  const tabanY = Math.max(y.gokBandi.h + 6, 60);
  c.fillStyle = '#120A1E';
  let x = 0;
  while (x < y.ekranW) {
    const w = 16 + r.int(26);
    const hh = 14 + r.int(36);
    c.fillRect(x, tabanY - hh, w, hh + 400);
    c.fillStyle = '#FFC86B';
    for (let k = 0; k < 3; k++) if (r.chance(0.5)) c.fillRect(x + 3 + r.int(Math.max(1, w - 8)), tabanY - hh + 4 + r.int(Math.max(1, hh - 8)), 3, 4);
    c.fillStyle = '#120A1E';
    x += w + 2;
  }
  // Deniz
  const dg = c.createLinearGradient(0, y.ekranH * 0.8, 0, y.ekranH);
  dg.addColorStop(0, '#1B1040');
  dg.addColorStop(1, '#0A0E26');
  c.fillStyle = dg;
  c.fillRect(0, y.ekranH * 0.82, y.ekranW, y.ekranH);
  if (!tahtaGoster) return;
  // Tahta (sandık)
  const t = y.tahta;
  const pay = Math.max(8, y.hucre * 0.22);
  c.fillStyle = '#3A2416';
  yuvarlak(c, t.x - pay, t.y - pay, t.w + pay * 2, t.h + pay * 2, 14);
  c.fill();
  c.strokeStyle = '#D9A441';
  c.lineWidth = 2;
  c.stroke();
  const tr = new Rng(12);
  for (let j = 0; j < th; j++)
    for (let i = 0; i < tw; i++) {
      const cx = t.x + i * y.hucre + y.hucre / 2;
      const cy = t.y + j * y.hucre + y.hucre / 2;
      const rg = c.createRadialGradient(cx, cy, 2, cx, cy, y.hucre * 0.6);
      rg.addColorStop(0, '#160E08');
      rg.addColorStop(1, '#24160D');
      c.fillStyle = rg;
      c.fillRect(t.x + i * y.hucre + 1, t.y + j * y.hucre + 1, y.hucre - 2, y.hucre - 2);
      const renk = tr.int(5);
      const [acik, ana, koyu] = kapsulRenkleri(renk, palet);
      const rr = y.hucre * 0.38;
      c.save();
      c.translate(cx, cy);
      const pth = new Path2D(kapsulYolu(renk, rr));
      const cg = c.createRadialGradient(-rr * 0.3, -rr * 0.35, 1, 0, 0, rr * 1.2);
      cg.addColorStop(0, acik);
      cg.addColorStop(0.45, ana);
      cg.addColorStop(1, koyu);
      c.fillStyle = cg;
      c.fill(pth);
      c.lineWidth = 1.5;
      c.strokeStyle = koyu;
      c.stroke(pth);
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.beginPath();
      c.ellipse(-rr * 0.35, -rr * 0.42, rr * 0.4, rr * 0.18, -0.5, 0, 7);
      c.fill();
      c.restore();
    }
}

function yuvarlak(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function sahteTablo(): HTMLCanvasElement {
  const t = document.createElement('canvas');
  t.width = 256;
  t.height = 384;
  const c = t.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, '#0B1030');
  g.addColorStop(1, '#3A1A5C');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 384);
  const r = new Rng(3);
  c.globalCompositeOperation = 'lighter';
  const renkler = ['#FF4D4D', '#FFB020', '#2EE07A', '#3AA8FF', '#B266FF', '#FF5FB4'];
  for (let k = 0; k < 9; k++) {
    const cx = 30 + r.float() * 196;
    const cy = 40 + r.float() * 200;
    const rr = 20 + r.float() * 40;
    c.strokeStyle = renkler[k % 6];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      c.globalAlpha = 0.15 + r.float() * 0.25;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.quadraticCurveTo(cx + Math.cos(a) * rr * 0.7, cy + Math.sin(a) * rr * 0.7, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr + rr * 0.25);
      c.stroke();
    }
  }
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.fillStyle = '#120A1E';
  let x = 0;
  while (x < 256) {
    const w = 14 + r.int(24);
    const hh = 20 + r.int(50);
    c.fillRect(x, 384 - 40 - hh, w, hh + 40);
    x += w + 1;
  }
  return t;
}

// ─────────────── Senaryolar ───────────────
async function oyunSahnesi(varyant = ''): Promise<void> {
  tahtaGoster = true;
  ui.hudKur(O.hudVm(tw, th, varyant));
  sahneCiz(ui.yerlesim());
  ui.yerlesimDinle((y) => sahneCiz(y));
}

async function haritaSahnesi(canSayisi: number | null = p.get('can') === null ? null : Number(p.get('can'))): Promise<void> {
  tahtaGoster = false;
  sahneCiz(ui.yerlesim());
  const kasaba = p.get('kasaba');
  let vm = O.haritaVm(Number(p.get('simdiki') ?? 14), kasaba ? { kandil: 7, isler: kasaba === 'bos' ? [] : KASABA_ISLERI.filter((x) => x.mahalle === 0 || x.id === 'carsi.dukkanKandilleri').map((x) => x.id), yapilabilir: kasaba !== 'yok' } : null, canSayisi === null ? null : O.canSayaciVm(canSayisi));
  // Üst çubuk sığma denetimi: yildiz=<toplam ★>, seri=<gün>.
  if (p.get('yildiz')) vm = { ...vm, toplamYildiz: Number(p.get('yildiz')) };
  if (p.get('seri')) vm = { ...vm, seri: { ...vm.seri, gun: Number(p.get('seri')) } };
  for (;;) {
    const s: HaritaSecimi = await ui.harita(vm);
    log('harita seçimi', s);
    // (CAN-REKLAM §6) Can hapı: uygulamanın yapacağı gibi can panelini açar, kapanınca haritaya döner.
    if (s.tur !== 'can' || canSayisi === null) return;
    canSayisi = await canPaneliDongusu(canVmSayidan(canSayisi));
    vm = { ...vm, can: O.canSayaciVm(canSayisi) };
  }
}

function canVmSayidan(sayi: number): CanVM {
  const c = O.canSayaciVm(sayi);
  const dolu = sayi >= c.enCok;
  return { ...c, tur: sayi <= 0 ? 'bitti' : 'durum', reklam: dolu ? null : { hak: 2, hazir: true, kart: false }, doldur: dolu ? null : { fiyat: '₺29,99' } };
}

/**
 * (CAN-REKLAM §13 karar 7) Uygulamanın can paneli döngüsünü taklit eder:
 * seçimde kapanır, sahte reklam/satın alma (300 ms) işlenir, yeni modelle
 * yeniden açılır (1 sn içinde: giriş animasyonsuz). Son can sayısını döndürür.
 */
async function canPaneliDongusu(ilk: CanVM): Promise<number> {
  let vm = ilk;
  for (;;) {
    const bas = performance.now();
    const temel = vm;
    const s = await ui.canPaneli(vm, () => ({ ...temel, sonrakiMs: temel.sonrakiMs === null ? null : Math.max(0, temel.sonrakiMs - (performance.now() - bas)) }));
    log('can paneli', s);
    if (s === 'kapat') return vm.sayi;
    await new Promise((r) => setTimeout(r, 300));
    const sayi = s === 'doldur' ? vm.enCok : Math.min(vm.enCok, vm.sayi + 1);
    const dolu = sayi >= vm.enCok;
    vm = {
      ...vm,
      sayi,
      tur: sayi <= 0 ? 'bitti' : 'durum',
      sonrakiMs: dolu ? null : vm.sonrakiMs,
      reklam: dolu || !vm.reklam ? null : { ...vm.reklam, hak: s === 'reklam' ? vm.reklam.hak - 1 : vm.reklam.hak },
      doldur: dolu ? null : vm.doldur,
    };
    ui.haritaCanGuncelle(O.canSayaciVm(sayi));
  }
}

/** (CAN-REKLAM §4) Mağaza döngüsü: satın alınca kapanır, işlenir, yeniden açılır. */
async function magazaDongusu(ilk: MagazaVM): Promise<void> {
  let vm = ilk;
  for (;;) {
    const s = await ui.magaza(vm);
    log('mağaza', s);
    if (s.tur === 'kapat') return;
    await new Promise((r) => setTimeout(r, 300));
    const sende = s.tur === 'geriYukle' ? 'usta_karti' : s.id === 'usta_karti' ? 'usta_karti' : null;
    vm = {
      ...vm,
      urunler: vm.urunler.map((u) => (u.id === sende ? { ...u, durum: 'sende' as const } : s.tur === 'satinAl' && s.id === 'can_doldur' && u.id === 'can_doldur' ? { ...u, durum: 'stokDolu' as const } : u)),
    };
  }
}

async function duraklatAc(): Promise<void> {
  const s = await ui.duraklat(O.duraklatVm(v));
  log('duraklat', s);
  if (s === 'ayarlar') {
    await ui.ayarlar(O.ayarlarVm());
    void duraklatAc();
  }
}

async function calistir(): Promise<void> {
  switch (ekran) {
    case 'acilis':
      await ui.acilis(() => log('ilk dokunuş: ses açıldı'));
      void haritaSahnesi();
      break;
    case 'harita': {
      if (p.get('yeni') === '1') {
        const sim = Number(p.get('simdiki') ?? 14);
        void ui.harita(O.haritaVm(sim - 1));
        setTimeout(() => void ui.harita(O.haritaVm(sim)), 700);
        return;
      }
      void haritaSahnesi();
      break;
    }
    case 'bolumOncesi':
      void haritaSahnesi();
      log('bölüm öncesi', await ui.bolumOncesi(O.bolumOncesiVm(v)));
      break;
    case 'hud':
      await oyunSahnesi(v === '1' ? '' : v);
      break;
    case 'ucus': {
      // (Kancalar §C.3) Mühür uçuşu: ?dondur=ms ile uçuşun ortasında kare.
      await oyunSahnesi('muhur');
      const y = ui.yerlesim();
      const bekle = Number(p.get('bekle') ?? 400);
      setTimeout(() => void ui.muhurTuttu([{ indeks: 1, kademe: 'kalfa' }], { x: y.tahta.x + y.tahta.w * 0.6, y: y.tahta.y + y.tahta.h * 0.4 }), bekle);
      break;
    }
    case 'kasaba':
      void haritaSahnesi();
      log('kasaba', await ui.kasaba(O.kasabaVm(p.get('ogretim') === '1')));
      break;
    case 'haritaBalon':
      void haritaSahnesi();
      setTimeout(() => void ui.haritaBalonu(p.get('m') ?? MK.kandilYetti(t('Kemer çelengi', 'Arch garland')), 'kasaba', 0), 900);
      break;
    case 'kasabaKarti':
      void haritaSahnesi();
      await ui.defterKarti({ mahalle: Number(p.get('m') ?? 0), oduller: [], tur: 'kasaba' });
      break;
    case 'secim':
      await oyunSahnesi('koruk');
      ui.secimKipi(M.secimMetni.koruk, 'koruk');
      break;
    case 'duraklat':
      await oyunSahnesi();
      void duraklatAc();
      break;
    case 'kazandin':
      await oyunSahnesi();
      {
        // hediye=1|kart: günlük hediye sandığı satırı (CAN-REKLAM §14 E3).
        const hd = p.get('hediye');
        const kvm = { ...O.kazandinVm(v), hediyeSandik: hd ? { kart: hd === 'kart' } : null };
        const hediyeSandik = hd
          ? async () => {
              await ui.sandikAc({ tur: 'normal', oduller: [{ tur: 'toz', adet: 3 }, { tur: 'guclendirici', id: 'kibrit', adet: 1 }] }, MC.hediyeSandik);
              return true;
            }
          : undefined;
        log('kazandın', await ui.kazandin(kvm, { tablo: sahteTablo(), hediyeSandik }));
      }
      break;
    case 'kaybettin':
      await oyunSahnesi('son1');
      log('kaybettin', await ui.kaybettin(O.kaybettinVm(v)));
      break;
    case 'ayarlar': {
      // gelir=1: sağlayıcı varken (Mağaza satırı, Hakkında'da can cümlesi).
      // gizlilik=1: Android köprüsü UMP gizlilik seçenekleri istiyor (Mağaza'nın altında satır).
      const gelir = p.get('gelir') === '1';
      const gizlilik = p.get('gizlilik') === '1';
      void haritaSahnesi(gelir ? 3 : null);
      await ui.ayarlar(O.ayarlarVm(), {
        nasilAc: () => void ui.nasilOynanir({ acikEngeller: ['kafes', 'islak', 'doseme', 'fener', 'kaya'] }),
        oyunOzetiAc: () => void ui.oyunOzeti(O.oyunOzetiVm()),
        ...(gelir ? { magazaAc: () => void magazaDongusu(O.magazaVm()), gelirVar: true } : {}),
        ...(gizlilik ? { gizlilikAc: () => log('gizlilik seçenekleri') } : {}),
      });
      break;
    }
    // ─────────────── Can, reklam, Mağaza (CAN-REKLAM §6) ───────────────
    case 'can': {
      // v=bitti | durum (kalan) | kart | hakyok | hazirdegil | dolu; panel seçimde kapanır, döngü yeniden açar.
      const vm = O.canVm(v === 'kalan' ? 'durum' : v === '1' ? 'bitti' : v);
      void haritaSahnesi(vm.sayi);
      await canPaneliDongusu(vm);
      break;
    }
    case 'magaza':
      // Ayarlar'ın üstünde (gerçek akış); v=1 | sende | stok | bekle.
      void haritaSahnesi(3);
      void ui.ayarlar(O.ayarlarVm(), { magazaAc: () => void magazaDongusu(O.magazaVm(v)), gelirVar: true });
      await magazaDongusu(O.magazaVm(v));
      break;
    case 'cikisOnayi':
      // v=yeniden: "Yeniden başlarsan 1 can gider."
      await oyunSahnesi();
      log('çıkış onayı', await ui.cikisOnayi(v === 'yeniden' ? 'yeniden' : 'harita'));
      break;
    case 'oyunOzeti':
      // Ayarlar'ın üstünde (gerçek akış); v=bos | az | 1.
      void haritaSahnesi();
      void ui.ayarlar(O.ayarlarVm(), { oyunOzetiAc: () => void ui.oyunOzeti(O.oyunOzetiVm(v)) });
      await ui.oyunOzeti(O.oyunOzetiVm(v));
      break;
    case 'nasil':
      void haritaSahnesi();
      await ui.nasilOynanir({ acikEngeller: ['kafes', 'islak', 'doseme', 'fener', 'kaya', 'devFisek', 'kova'] });
      break;
    case 'defter':
      void haritaSahnesi();
      await ui.defter({ ...O.defterVm(), sekme: (p.get('sekme') as never) ?? 'desenler' });
      break;
    case 'gunluk':
      void haritaSahnesi();
      log('günlük', await ui.gunluk(O.gunlukVm()));
      break;
    case 'istatistik':
      void haritaSahnesi();
      await ui.istatistik(O.istatistikVm(), (p.get('sekme') as 'istatistik' | 'rozetler') ?? 'istatistik');
      break;
    case 'mola':
      await oyunSahnesi();
      log('mola', await ui.mola());
      break;
    case 'defterKarti':
      void haritaSahnesi();
      await ui.defterKarti({ mahalle: Number(p.get('m') ?? 1), oduller: [{ tur: 'guclendirici', id: 'kibrit', adet: 1 }, { tur: 'guclendirici', id: 'kalip', adet: 1 }, { tur: 'guclendirici', id: 'geriSar', adet: 1 }] });
      break;
    case 'sandik':
      void haritaSahnesi();
      await ui.sandikAc({ tur: 'parlak', oduller: [{ tur: 'desenParcasi', id: 'spiral', parca: 1 }, { tur: 'toz', adet: 3 }] }, t('Günlük görev', 'Daily task'));
      break;
    case 'balon':
      await oyunSahnesi();
      void ui.balon(t('Aynı renkleri parmağınla birleştir, bırak.', 'Join matching colors with your finger, let go.'));
      break;
    case 'bant':
      await oyunSahnesi('son1');
      void ui.bant(M.sonHamle);
      break;
    case 'kutlama':
      await oyunSahnesi();
      ui.reaksiyonYazisi((p.get('k') as never) ?? 'harika');
      break;
    case 'toast':
      void haritaSahnesi();
      ui.toast(M.kopyalandi);
      break;
  }
}
void calistir();
