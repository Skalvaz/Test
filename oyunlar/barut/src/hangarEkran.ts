/**
 * Hangar ekranı: helikopter hattı (kartlar), seçili helikopterin geliştirmeleri,
 * altta GERİ / OYNA. Çizerken dokunma bölgelerini de döndürür; `main.ts`
 * dokunuşu bu bölgelere göre işler (çizim ve dokunma aynı sayıları kullanır).
 *
 * OKUNABİLİRLİK (kullanıcı: "menüyü daha okunabilir yapalım"): yalnız DÜZ
 * tonlar kullanılır (0, 85, 170, 213, 255). Ara tonlar taranır; taranmış gri
 * yazı ve taranmış zemin küçük yazıyı bulandırıyordu. Sıra: koyu başlık
 * şeridi → beyaz kartlar → koyu bölüm şeridi → satırlar. Adlar ölçek 3–4,
 * açıklamalar ölçek 2 ama koyu gri (85); düğmeler ölçek 3.
 */
import { HELILER, donanimKur, ozet, type Kayit } from './hangar';
import { EK, HELI_CIZIM, type HeliCizim } from './sahne';
import { SPR_ALOUETTE, SPR_HARRIER, SPR_HELI, SPR_KOBRA } from './sprite';
import { KAN, type Tuval, yaziGenislik } from './tuval';

export interface Bolge {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'sec:id', 'ac:id', 'mod:id', 'oyna', 'geri' */
  eylem: string;
}

const SPR = [SPR_ALOUETTE, SPR_HELI, SPR_HARRIER, SPR_KOBRA];
const ZEMIN = 213;
const KART = 255;
const SOLUK = 85; // ikincil yazı: düz koyu gri

/** Düğme. `tur`: 0 açık (beyaz), 1 vurgulu (siyah zemin, beyaz yazı), 2 pasif (alınamıyor). */
function dugme(t: Tuval, b: Bolge[], x: number, y: number, w: number, h: number, metin: string, eylem: string, tur = 0, olcek = 3): void {
  if (tur === 2) {
    t.kutu(x, y, w, h, 170);
    t.kutu(x + 2, y + 2, w - 4, h - 4, ZEMIN);
    t.yazi(metin, x + w / 2, y + Math.round((h - olcek * 5) / 2), { hiza: 0, olcek, ton: SOLUK });
    return;
  }
  t.kutu(x + 3, y + 3, w, h, SOLUK); // gölge
  t.kutu(x, y, w, h, 0);
  if (tur === 0) t.kutu(x + 2, y + 2, w - 4, h - 4, KART);
  t.yazi(metin, x + w / 2, y + Math.round((h - olcek * 5) / 2), { hiza: 0, olcek, ton: tur === 1 ? 255 : 0 });
  b.push({ x, y, w, h, eylem });
}

/** Sığmıyorsa bir ölçek küçülterek yazar. */
function sigdir(t: Tuval, metin: string, x: number, y: number, olcek: number, enCok: number, ton = 0): void {
  while (olcek > 2 && yaziGenislik(metin, olcek) > enCok) olcek--;
  t.yazi(metin, x, y, { olcek, ton });
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

/**
 * Park hâlindeki pervane (kullanıcı: "helikopterlerin pervanesi neden
 * gözükmüyor?"). Oyunda pervane dönerken ayrıca çizilir; sprite'ta yoktur,
 * bu yüzden sprite'ı tek başına basan her yer onu da çizmelidir. Hangarda
 * durgun: uçları hafif sarkmış uzun pal, arkasında kısa gri pal, göbek;
 * kuyrukta çapraz iki pal. (x, y) sprite'ın sol üst köşesi.
 */
function parkPervane(t: Tuval, cz: HeliCizim, x: number, y: number, kat: number): void {
  if (cz.rotor <= 0) return;
  const mx = x + cz.N.direk[0] * kat;
  const my = y + cz.N.direk[1] * kat;
  const R = Math.round(cz.rotor * 0.8);
  const kisa = Math.round(R * 0.42);
  for (let dx = -kisa; dx <= kisa; dx++) t.kutu(mx + dx * kat, my - kat, kat, kat, 85);
  for (let dx = -R; dx <= R; dx++) {
    const sark = Math.round((Math.abs(dx) / R) ** 2 * 1.6);
    t.kutu(mx + dx * kat, my + sark * kat, kat, kat, 0);
  }
  t.kutu(mx - kat, my - kat, kat * 3, kat * 2, 0);
  // Kuyruk pervanesi: çapraz duran iki pal, ortada göbek
  const kx = x + cz.N.kuyruk[0] * kat;
  const ky = y + cz.N.kuyruk[1] * kat;
  for (let i = -cz.kuyruk; i <= cz.kuyruk; i += 0.5) {
    t.kutu(kx + Math.round(i * 0.45) * kat, ky + Math.round(i * 0.9) * kat, kat, kat, 0);
  }
  t.kutu(kx, ky, kat, kat, 170);
}

/** Özellik çubuğu: 10 dilimli, dolu dilimler siyah (uzaktan sayılabilir). */
function cubuk(t: Tuval, x: number, y: number, oran: number): void {
  const dolu = Math.max(1, Math.round(oran * 10));
  for (let k = 0; k < 10; k++) {
    t.kutu(x + k * 7, y, 6, 8, 0);
    if (k >= dolu) t.kutu(x + k * 7 + 1, y + 1, 4, 6, KART);
  }
}

export function hangarCiz(t: Tuval, k: Kayit, zaman: number): Bolge[] {
  const b: Bolge[] = [];
  const H = t.h;
  t.kutu(0, 0, EK, H, ZEMIN);
  for (let i = 0; i < t.v.length; i++) t.v[i] = 0;

  // Başlık şeridi: koyu zemin, beyaz yazı; sağda araştırma puanı rozeti
  t.kutu(0, 0, EK, 46, 0);
  t.yazi('HANGAR', 12, 11, { olcek: 5, ton: 255 });
  const ap = `AP ${k.ap}`;
  const aw = yaziGenislik(ap, 4) + 16;
  t.kutu(EK - 10 - aw, 8, aw, 30, KART);
  t.yazi(ap, EK - 18, 13, { olcek: 4, hiza: 1 });

  // Helikopter kartları. Yer varsa helikopter iki kat büyük çizilir: üstte ad,
  // solda helikopter, sağda çubuklar ve düğme.
  // Kart boyu ekrana göre: dört kart + beş geliştirme satırı sığmalı. İri
  // kartlar yalnız çok uzun ekranda; kısa ekranda kartlar sıkışır.
  const kartSayisi = HELILER.filter((h) => !h.yakinda).length;
  const buyuk = H >= 54 + kartSayisi * 132 + 30 + 5 * 40 + 76;
  const dar = !buyuk && H < 54 + kartSayisi * 86 + 30 + 5 * 34 + 76;
  const KH = buyuk ? 126 : dar ? 72 : 80;
  const ARA = dar ? 4 : 6;
  const YH = 24;
  let y = 54;
  for (const h of HELILER) {
    if (h.yakinda) {
      t.kutu(8, y, EK - 16, YH, 170);
      t.yazi(`KİLİTLİ: ${h.ad} - YAKINDA`, EK / 2, y + 7, { hiza: 0, olcek: 2, ton: 0 });
      y += YH + 6;
      continue;
    }
    const sahip = k.sahip.includes(h.id);
    const secili = k.secili === h.id;
    // Seçili kart kalın çerçeveli; kilitli kart gri zeminli
    t.kutu(8, y, EK - 16, KH, 0);
    const c = secili ? 4 : 2;
    t.kutu(8 + c, y + c, EK - 16 - c * 2, KH - c * 2, sahip ? KART : 170);
    const spr = SPR[h.taban.tur];
    const [can, hiz, ates] = ozet(donanimKur(k, h.id));
    let tx: number;
    let by: number;
    let ba: number;
    if (buyuk) {
      sigdir(t, h.ad, 18, y + 10, 4, EK - 36);
      t.yazi(h.sinif, 18, y + 34, { olcek: 2, ton: SOLUK });
      const sx = Math.min(16 + Math.round((208 - spr.w * 2) / 2), 220 - spr.w * 2);
      const sy = y + 46 + Math.round((76 - spr.h * 2) / 2);
      buyukCiz(t, spr, sx, sy, 2);
      parkPervane(t, HELI_CIZIM[h.taban.tur], sx, sy, 2);
      tx = 232;
      by = y + 40;
      ba = 15;
    } else {
      const sx = 14 + Math.round((106 - spr.w) / 2);
      const sy = y + Math.round((KH - spr.h) / 2);
      t.ciz(spr, sx, sy, false);
      parkPervane(t, HELI_CIZIM[h.taban.tur], sx, sy, 1);
      tx = 126;
      // Kilitliyse adın sağında kilit simgesine yer kalır
      sigdir(t, h.ad, tx, y + 8, 3, EK - 22 - tx - (sahip ? 0 : 22));
      t.yazi(h.sinif, tx, y + 27, { olcek: 2, ton: SOLUK });
      by = y + (dar ? 40 : 44);
      ba = dar ? 10 : 11;
    }
    if (!sahip) {
      // Kilit: asma kilit simgesi
      // Sağ üst köşede (solda helikopterin kuyruğuna biniyordu)
      const kx = EK - 36;
      const ky = y + (buyuk ? 10 : 6);
      t.kutu(kx, ky + 6, 14, 11, 0);
      t.cerceve(kx + 3, ky, 8, 8, 0);
      t.cerceve(kx + 2, ky, 10, 9, 0);
      t.kutu(kx + 6, ky + 10, 2, 4, KART);
    }
    if (buyuk) {
      t.yazi('CAN', tx, by + 1, { olcek: 2 });
      cubuk(t, tx + 46, by, can);
      t.yazi('HIZ', tx, by + ba + 1, { olcek: 2 });
      cubuk(t, tx + 46, by + ba, hiz);
      t.yazi('ATEŞ', tx, by + ba * 2 + 1, { olcek: 2 });
      cubuk(t, tx + 46, by + ba * 2, ates);
    } else {
      t.yazi('CAN', tx, by, { olcek: 2 });
      cubuk(t, tx + 46, by - 1, can);
      t.yazi('HIZ', tx, by + ba, { olcek: 2 });
      cubuk(t, tx + 46, by + ba - 1, hiz);
      t.yazi('ATEŞ', tx, by + ba * 2, { olcek: 2 });
      cubuk(t, tx + 46, by + ba * 2 - 1, ates);
    }
    // Düğme kartın sağ alt köşesinde (dar ekranda çubukların yanında)
    const dw = buyuk ? 116 : 92;
    const dh = buyuk ? 30 : 26;
    const dx = EK - 18 - dw;
    const dy = y + KH - dh - (buyuk ? 10 : dar ? 6 : 8);
    if (secili) {
      t.kutu(dx, dy, dw, dh, 0);
      t.yazi('SEÇİLİ', dx + dw / 2, dy + Math.round((dh - (buyuk ? 15 : 10)) / 2), { hiza: 0, olcek: buyuk ? 3 : 2, ton: 255 });
    } else if (sahip) dugme(t, b, dx, dy, dw, dh, 'SEÇ', `sec:${h.id}`);
    else dugme(t, b, dx, dy, dw, dh, `AÇ ${h.bedel}`, `ac:${h.id}`, k.ap >= h.bedel ? 0 : 2, buyuk ? 3 : 2);
    y += KH + ARA;
  }

  // Seçili helikopterin geliştirmeleri: koyu bölüm şeridi, sonra satırlar
  const sec = HELILER.find((h) => h.id === k.secili)!;
  t.kutu(0, y, EK, 26, 0);
  t.yazi('GELİŞTİRMELER', 12, y + 6, { olcek: 3, ton: 255 });
  // Uzun ad başlığa binmesin: sığmıyorsa yazılmaz (kart zaten seçili görünür)
  if (yaziGenislik(sec.ad, 2) < EK - 30 - yaziGenislik('GELİŞTİRMELER', 3)) t.yazi(sec.ad, EK - 12, y + 8, { olcek: 2, ton: 255, hiza: 1 });
  y += 30;
  const altY = H - 54;
  const MH = Math.max(30, Math.min(58, Math.floor((altY - 22 - y) / Math.max(1, sec.modlar.length))));
  const iri = MH >= 44;
  const dw = iri ? 104 : 88;
  for (const m of sec.modlar) {
    const alindi = k.mod[sec.id]?.includes(m.id) ?? false;
    t.kutu(8, y, EK - 16, MH - 3, KART);
    const yaziEn = EK - 16 - dw - 22;
    if (iri) {
      const ust = y + Math.round((MH - 3 - 30) / 2);
      sigdir(t, m.ad, 16, ust, 3, yaziEn);
      t.yazi(m.aciklama, 16, ust + 20, { olcek: 2, ton: SOLUK });
    } else {
      t.yazi(m.ad, 14, y + 4, { olcek: 2 });
      t.yazi(m.aciklama, 14, y + 16, { olcek: 2, ton: SOLUK });
    }
    const dh = Math.min(32, MH - 11);
    const dx = EK - 14 - dw;
    const dy = y + Math.round((MH - 3 - dh) / 2);
    if (alindi) {
      // Takılı: siyah etiket + onay işareti
      t.kutu(dx, dy, dw, dh, 0);
      t.yazi('TAKILI', dx + 10, dy + Math.round((dh - 10) / 2), { olcek: 2, ton: 255 });
      const ox = dx + dw - 22;
      const oy = dy + Math.round(dh / 2);
      for (let q = 0; q < 2; q++) {
        t.cizgi(ox, oy + q, ox + 4, oy + 4 + q, 255);
        t.cizgi(ox + 4, oy + 4 + q, ox + 12, oy - 5 + q, 255);
      }
    } else dugme(t, b, dx, dy, dw, dh, `AL ${m.bedel}`, `mod:${m.id}`, k.ap >= m.bedel ? 0 : 2, iri ? 3 : 2);
    y += MH;
  }

  // Alt: ipucu ve düğmeler (OYNA vurgulu)
  if (altY - y > 18) t.yazi('AP OYNADIKÇA KAZANILIR: SKOR / 8', EK / 2, altY - 15, { hiza: 0, olcek: 2, ton: SOLUK });
  dugme(t, b, 10, altY, 104, 42, 'GERİ', 'geri');
  dugme(t, b, 126, altY, EK - 139, 42, 'OYNA', 'oyna', 1, 4);
  if (Math.floor(zaman * 2) % 2 === 0) t.kutu(126, altY + 38, EK - 139, 2, 255, KAN);
  return b;
}
