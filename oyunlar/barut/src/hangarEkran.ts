/**
 * Hangar ekranı: helikopter hattı (kartlar), seçili helikopterin geliştirmeleri,
 * altta GERİ / OYNA. Çizerken dokunma bölgelerini de döndürür; `main.ts`
 * dokunuşu bu bölgelere göre işler (çizim ve dokunma aynı sayıları kullanır).
 */
import { HELILER, donanimKur, ozet, type Kayit } from './hangar';
import { EK } from './sahne';
import { SPR_ALOUETTE, SPR_HELI } from './sprite';
import { KAN, type Tuval } from './tuval';

export interface Bolge {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'sec:id', 'ac:id', 'mod:id', 'oyna', 'geri' */
  eylem: string;
}

const SPR = [SPR_ALOUETTE, SPR_HELI];
const KAGIT = 236;

function dugme(t: Tuval, b: Bolge[], x: number, y: number, w: number, h: number, metin: string, eylem: string, etkin = true, olcek = 3): void {
  t.kutu(x + 2, y + 2, w, h, etkin ? 0 : 150);
  t.kutu(x, y, w, h, etkin ? 0 : 128);
  t.kutu(x + 2, y + 2, w - 4, h - 4, etkin ? 254 : 213);
  t.yazi(metin, x + w / 2, y + Math.round((h - olcek * 5) / 2), { hiza: 0, olcek, ton: etkin ? 0 : 128 });
  if (etkin) b.push({ x, y, w, h, eylem });
}

/** Sprite'ı tam sayı katıyla büyüterek basar (hangar kartında helikopter iri görünsün). */
function buyukCiz(t: Tuval, s: { w: number; h: number; d: Uint8Array; v: Uint8Array }, x: number, y: number, kat: number): void {
  for (let sy = 0; sy < s.h; sy++) {
    for (let sx = 0; sx < s.w; sx++) {
      const c = s.d[sy * s.w + sx];
      if (c) t.kutu(x + sx * kat, y + sy * kat, kat, kat, c - 1, s.v[sy * s.w + sx]);
    }
  }
}

function cubuk(t: Tuval, x: number, y: number, oran: number): void {
  const W = 64;
  t.kutu(x, y, W, 6, 0);
  t.kutu(x + 1, y + 1, W - 2, 4, 213);
  t.kutu(x + 1, y + 1, Math.max(1, Math.round((W - 2) * oran)), 4, 42);
}

export function hangarCiz(t: Tuval, k: Kayit, zaman: number): Bolge[] {
  const b: Bolge[] = [];
  const H = t.h;
  const dar = H < 680;
  t.kutu(0, 0, EK, H, KAGIT);
  for (let i = 0; i < t.v.length; i++) t.v[i] = 0;

  // Başlık ve araştırma puanı
  t.yazi('HANGAR', 12, 12, { olcek: 5 });
  t.yazi(`AP ${k.ap}`, EK - 12, 16, { olcek: 4, hiza: 1 });
  t.kutu(8, 44, EK - 16, 2, 0);

  // Helikopter kartları. Yer varsa helikopter iki kat büyük çizilir: üstte ad,
  // solda helikopter, sağda çubuklar ve düğme.
  const buyuk = H >= 700;
  const KH = buyuk ? 122 : 76;
  const YH = buyuk ? 26 : 22;
  let y = 52;
  for (const h of HELILER) {
    if (h.yakinda) {
      t.kutu(8, y, EK - 16, YH, 128);
      t.kutu(9, y + 1, EK - 18, YH - 2, 213);
      t.yazi(`? ${h.ad}: YAKINDA`, EK / 2, y + Math.round((YH - 10) / 2), { hiza: 0, olcek: 2, ton: 100 });
      y += YH + 5;
      continue;
    }
    const sahip = k.sahip.includes(h.id);
    const secili = k.secili === h.id;
    t.kutu(8, y, EK - 16, KH, 0);
    t.kutu(secili ? 11 : 9, y + (secili ? 3 : 1), EK - (secili ? 22 : 18), KH - (secili ? 6 : 2), sahip ? 254 : 213);
    const spr = SPR[h.taban.tur];
    const [can, hiz, ates] = ozet(donanimKur(k, h.id));
    let tx: number;
    let by: number;
    let ba: number;
    if (buyuk) {
      t.yazi(h.ad, 18, y + 8, { olcek: 3 });
      t.yazi(h.sinif, 18, y + 26, { olcek: 2, ton: 100 });
      buyukCiz(t, spr, 16 + Math.round((208 - spr.w * 2) / 2), y + 40 + Math.round((76 - spr.h * 2) / 2), 2);
      tx = 234;
      by = y + 40;
      ba = 13;
    } else {
      t.ciz(spr, 14 + Math.round((106 - spr.w) / 2), y + Math.round((KH - spr.h) / 2), false);
      tx = 128;
      t.yazi(h.ad, tx, y + 6, { olcek: 3 });
      t.yazi(h.sinif, tx, y + 25, { olcek: 2, ton: 100 });
      by = y + 40;
      ba = 11;
    }
    if (!sahip) {
      // Kilit: asma kilit simgesi
      const kx = buyuk ? 196 : 18;
      const ky = buyuk ? y + 44 : y + 8;
      t.kutu(kx, ky + 5, 12, 9, 0);
      t.cerceve(kx + 2, ky, 8, 8, 0);
      t.nokta(kx + 6, ky + 9, 254);
    }
    const cw = buyuk ? 0 : 0;
    t.yazi('CAN', tx, by, { olcek: 2 });
    cubuk(t, tx + 42 + cw, by + 2, can);
    t.yazi('HIZ', tx, by + ba, { olcek: 2 });
    cubuk(t, tx + 42 + cw, by + ba + 2, hiz);
    t.yazi('ATEŞ', tx, by + ba * 2, { olcek: 2 });
    cubuk(t, tx + 42 + cw, by + ba * 2 + 2, ates);
    const dw = buyuk ? 112 : 98;
    const dx = EK - 16 - dw;
    const dy = y + KH - 34;
    if (secili) {
      t.kutu(dx, dy + 4, dw - 2, 20, 0);
      t.yazi('SEÇİLİ', dx + (dw - 2) / 2, dy + 9, { hiza: 0, olcek: 2, ton: 254 });
    } else if (sahip) dugme(t, b, dx, dy, dw - 2, 26, 'SEÇ', `sec:${h.id}`);
    else dugme(t, b, dx, dy, dw - 2, 26, `AÇ ${h.bedel}`, `ac:${h.id}`, k.ap >= h.bedel, 2);
    y += KH + 5;
  }

  // Seçili helikopterin geliştirmeleri
  const sec = HELILER.find((h) => h.id === k.secili)!;
  t.yazi('GELİŞTİRMELER', 12, y + 4, { olcek: 3 });
  t.kutu(8, y + 23, EK - 16, 1, 0);
  y += 28;
  const altY = H - 54;
  const MH = Math.min(38, Math.floor((altY - 6 - y) / Math.max(1, sec.modlar.length)));
  for (const m of sec.modlar) {
    const alindi = k.mod[sec.id]?.includes(m.id) ?? false;
    t.kutu(8, y + MH - 2, EK - 16, 1, 170);
    t.yazi(m.ad, 12, y + 3, { olcek: 2 });
    t.yazi(m.aciklama, 12, y + 16, { olcek: 2, ton: 100 });
    if (alindi) {
      // Takılı: onay işareti
      t.yazi('TAKILI', EK - 30, y + 9, { hiza: 1, olcek: 2 });
      t.cizgi(EK - 24, y + 14, EK - 21, y + 17, 0);
      t.cizgi(EK - 21, y + 17, EK - 14, y + 8, 0);
      t.cizgi(EK - 24, y + 15, EK - 21, y + 18, 0);
      t.cizgi(EK - 21, y + 18, EK - 14, y + 9, 0);
    } else dugme(t, b, EK - 12 - 84, y + 3, 84, Math.min(26, MH - 8), `AL ${m.bedel}`, `mod:${m.id}`, k.ap >= m.bedel, 2);
    y += MH;
  }

  if (altY - y > 22) t.yazi('AP OYNADIKÇA KAZANILIR: SKOR / 8', EK / 2, altY - 16, { hiza: 0, olcek: 2, ton: 128 });
  // Alt düğmeler
  dugme(t, b, 10, altY, 104, 42, 'GERİ', 'geri');
  dugme(t, b, 124, altY, EK - 134, 42, 'OYNA', 'oyna', true, 4);
  if (Math.floor(zaman * 2) % 2 === 0) t.kutu(124, altY + 40, EK - 134, 2, 0, KAN);
  return b;
}
