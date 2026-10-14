/**
 * GEÇİCİ sahte olay üreticisi (yalnız dev/ses.html ve ölçüm için).
 *
 * Çekirdeğin `hamleUygula`sı henüz yazılmadığından (P1), ses motorunu gerçek
 * bir hamleye benzeyen olay dizileriyle sınamak için kullanılır. Zamanlar
 * §3.5.1'deki fitil hızlanmasına (max(35, 110 − 7k)) ve ısı gecikmesine
 * (90 tik) uyar. Çekirdek hazır olunca bu dosya silinebilir.
 */
import type { Konum, Olay, OlayTuru, Renk } from '../core/types';

type OlayOf<K extends OlayTuru> = Extract<Olay, { tur: K }>;

const K = (x: number, y: number): Konum => ({ x, y });

/** Her olay türü için örnek (tip denetimi: yeni tür eklenirse burada hata verir). */
export const ORNEK_OLAYLAR: { [T in OlayTuru]: OlayOf<T> } = {
  fitilBasladi: { t: 0, tur: 'fitilBasladi', yol: [K(0, 8), K(1, 8), K(2, 8), K(3, 8), K(4, 8), K(5, 8)], halka: false, renk: 3 },
  dugumYandi: { t: 0, tur: 'dugumYandi', hucre: K(2, 8), k: 3 },
  patlama: { t: 0, tur: 'patlama', hucre: K(3, 4), renk: 0, neden: 'fitil', nesil: 0, puan: 30, ozel: 'yok', k: 3 },
  isindi: { t: 0, tur: 'isindi', hucre: K(3, 3), isi: 2, kizgin: false },
  isiDegisti: { t: 0, tur: 'isiDegisti', hucre: K(3, 3), isi: 3 },
  ozelOlustu: { t: 0, tur: 'ozelOlustu', hucre: K(5, 8), ozel: 'roket', eksen: 0, renk: 3 },
  ozelTetiklendi: { t: 0, tur: 'ozelTetiklendi', hucre: K(3, 4), ozel: 'roket', eksen: 0 },
  yuklendi: { t: 0, tur: 'yuklendi', hucre: K(2, 4), ozel: 'roket' },
  kombinasyon: { t: 0, tur: 'kombinasyon', hucre: K(3, 4), kombo: 'yildizHatti' },
  isiDalgasi: { t: 0, tur: 'isiDalgasi', merkez: K(3, 4), yaricap: 2 },
  engelHasar: { t: 0, tur: 'engelHasar', hucre: K(1, 2), engel: 'kaya', kalan: 1 },
  kafesKirildi: { t: 0, tur: 'kafesKirildi', hucre: K(4, 2) },
  kurudu: { t: 0, tur: 'kurudu', hucre: K(2, 2), renk: 1 },
  dosemeAydinlandi: { t: 0, tur: 'dosemeAydinlandi', hucre: K(3, 6), kalan: 12 },
  desenBoyandi: { t: 0, tur: 'desenBoyandi', hucre: K(3, 6), renk: 2 },
  izYandi: { t: 0, tur: 'izYandi', hucre: K(1, 1) },
  devFisekDoldu: { t: 0, tur: 'devFisekDoldu', hucre: K(6, 5), dolum: 3, kapasite: 5 },
  devFisekFirladi: { t: 0, tur: 'devFisekFirladi', hucre: K(6, 5) },
  isTemizlendi: { t: 0, tur: 'isTemizlendi', hucre: K(0, 3) },
  isYayildi: { t: 0, tur: 'isYayildi', hucre: K(0, 4) },
  yercekimi: {
    t: 0,
    tur: 'yercekimi',
    dusenler: [
      { den: K(2, 2), e: K(2, 5) },
      { den: K(3, 1), e: K(3, 4) },
      { den: K(4, 3), e: K(4, 4) },
    ],
    doganlar: [
      { hucre: K(2, 1), icerik: { tur: 'kapsul', renk: 0, isi: 0, ozel: 'yok', eksen: 0 }, sanalY: -1 },
      { hucre: K(2, 0), icerik: { tur: 'kapsul', renk: 1, isi: 0, ozel: 'yok', eksen: 0 }, sanalY: -2 },
      { hucre: K(5, 0), icerik: { tur: 'kapsul', renk: 2, isi: 0, ozel: 'yok', eksen: 0 }, sanalY: -1 },
    ],
  },
  fenerToplandi: { t: 0, tur: 'fenerToplandi', hucre: K(3, 8) },
  havaOlayi: { t: 0, tur: 'havaOlayi', olay: 'meltem', eksen: 'satir', hat: 3, uyari: false },
  karistirma: { t: 0, tur: 'karistirma', esleme: [{ den: K(0, 0), e: K(3, 3) }], yenidenRenk: [] },
  hedefIlerledi: { t: 0, tur: 'hedefIlerledi', indeks: 0, deger: 12, tamam: false },
  puanEklendi: { t: 0, tur: 'puanEklendi', miktar: 100, neden: 'halka' },
  korukDoldu: { t: 0, tur: 'korukDoldu', dolum: 20, kapasite: 20 },
  korukKullanildi: { t: 0, tur: 'korukKullanildi', merkez: K(3, 4) },
  guclendirici: { t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: K(3, 4) },
  finalBasladi: { t: 0, tur: 'finalBasladi', kalanHamle: 4 },
  reaksiyon: { t: 0, tur: 'reaksiyon', boyut: 16, zirveT: 600, merkez: K(3, 4), kombo: false, kademe: 'harika' },
  bolumBitti: { t: 0, tur: 'bolumBitti', sonuc: 'kazanc' },
};

/** Bilinçli olarak sessiz bırakılan olaylar (sesMotoru.ts başı). */
export const SESSIZ_OLAYLAR: readonly Olay[] = [
  ORNEK_OLAYLAR.isiDegisti,
  { t: 0, tur: 'puanEklendi', miktar: 300, neden: 'reaksiyon', kademe: 'harika' },
  { t: 0, tur: 'puanEklendi', miktar: 20, neden: 'diger' },
  { t: 0, tur: 'bolumBitti', sonuc: 'kayip' },
];

/** Dev sayfası için olay çeşitlemeleri (aynı türün farklı sesleri). */
export const OLAY_CESITLERI: { ad: string; olay: Olay }[] = [
  { ad: 'patlama · fitil k=1', olay: { ...ORNEK_OLAYLAR.patlama, k: 1 } },
  { ad: 'patlama · fitil k=8', olay: { ...ORNEK_OLAYLAR.patlama, k: 8 } },
  { ad: 'patlama · ısı g=2', olay: { ...ORNEK_OLAYLAR.patlama, neden: 'isi', nesil: 2, k: 0 } },
  { ad: 'patlama · vuruş', olay: { ...ORNEK_OLAYLAR.patlama, neden: 'vurus', nesil: 0, k: 0 } },
  { ad: 'patlama · final', olay: { ...ORNEK_OLAYLAR.patlama, neden: 'final', k: 0 } },
  { ad: 'patlama · kibrit', olay: { ...ORNEK_OLAYLAR.patlama, neden: 'kibrit', k: 0 } },
  { ad: 'ısındı · kızgın', olay: { ...ORNEK_OLAYLAR.isindi, isi: 3, kizgin: true } },
  { ad: 'özel oluştu · kasımpatı', olay: { ...ORNEK_OLAYLAR.ozelOlustu, ozel: 'kasimpati' } },
  { ad: 'özel oluştu · yıldız', olay: { ...ORNEK_OLAYLAR.ozelOlustu, ozel: 'yildiz', renk: -1 } },
  { ad: 'roket · çapraz ↗', olay: { ...ORNEK_OLAYLAR.ozelTetiklendi, eksen: 2 } },
  { ad: 'kasımpatı', olay: { ...ORNEK_OLAYLAR.ozelTetiklendi, ozel: 'kasimpati' } },
  { ad: 'yıldız topu', olay: { ...ORNEK_OLAYLAR.ozelTetiklendi, ozel: 'yildiz', hedefRenk: 2 } },
  { ad: 'kombo · dev kasımpatı', olay: { ...ORNEK_OLAYLAR.kombinasyon, kombo: 'devKasimpati' } },
  { ad: 'kombo · BÜYÜK FİNAL', olay: { ...ORNEK_OLAYLAR.kombinasyon, kombo: 'buyukFinal' } },
  { ad: 'kaya yok oldu', olay: { ...ORNEK_OLAYLAR.engelHasar, kalan: 0 } },
  { ad: 'kova hasarı', olay: { ...ORNEK_OLAYLAR.engelHasar, engel: 'kova', kalan: 1 } },
  { ad: 'meltem uyarısı', olay: { ...ORNEK_OLAYLAR.havaOlayi, uyari: true } },
  { ad: 'çisenti', olay: { ...ORNEK_OLAYLAR.havaOlayi, olay: 'cisenti' } },
  { ad: 'çisenti uyarısı', olay: { ...ORNEK_OLAYLAR.havaOlayi, olay: 'cisenti', uyari: true } },
  { ad: 'hedef tamam', olay: { ...ORNEK_OLAYLAR.hedefIlerledi, tamam: true } },
  { ad: 'puan · kalan hamle', olay: { ...ORNEK_OLAYLAR.puanEklendi, neden: 'kalanHamle' } },
  { ad: 'körük dolumu 7/20', olay: { ...ORNEK_OLAYLAR.korukDoldu, dolum: 7 } },
  { ad: 'kalıp', olay: { ...ORNEK_OLAYLAR.guclendirici, guc: 'kalip' } },
  { ad: 'reaksiyon · güzel', olay: { ...ORNEK_OLAYLAR.reaksiyon, kademe: 'guzel', boyut: 9 } },
  { ad: 'reaksiyon · muhteşem', olay: { ...ORNEK_OLAYLAR.reaksiyon, kademe: 'muhtesem', boyut: 28 } },
  { ad: 'reaksiyon · ŞENLİK', olay: { ...ORNEK_OLAYLAR.reaksiyon, kademe: 'senlik', boyut: 44, kombo: true } },
];

/** §3.5.1 fitil düğüm zamanları (tik). */
export function fitilZamanlari(n: number): number[] {
  const t: number[] = [];
  let s = 0;
  for (let k = 0; k < n; k++) {
    if (k > 0) s += Math.max(35, 110 - 7 * k);
    t.push(s);
  }
  return t;
}

/** Yılan biçimli yol (7 sütunlu tahtanın alt satırları). */
function yilan(n: number): Konum[] {
  const yol: Konum[] = [];
  for (let i = 0; i < n; i++) {
    const satir = Math.floor(i / 7);
    const x = satir % 2 === 0 ? i % 7 : 6 - (i % 7);
    yol.push(K(x, 8 - satir));
  }
  return yol;
}

/**
 * Sahte "fitil çiz" hamlesi: n düğümlü zincir, ardından üç ısı dalgası,
 * engel/kafes/döşeme tepkileri, yerçekimi ve reaksiyon özeti.
 */
export function fitilGosterisi(n: number, renk: Renk = 3): Olay[] {
  const yol = yilan(Math.max(1, Math.min(12, n)));
  const z = fitilZamanlari(yol.length);
  const o: Olay[] = [{ t: 0, tur: 'fitilBasladi', yol, halka: false, renk }];
  const donusum = yol.length >= 6;
  yol.forEach((h, i) => {
    const k = i + 1;
    o.push({ t: z[i], tur: 'dugumYandi', hucre: h, k });
    if (donusum && k === yol.length) {
      const ozel = k >= 12 ? 'yildiz' : k >= 9 ? 'kasimpati' : 'roket';
      o.push({ t: z[i], tur: 'ozelOlustu', hucre: h, ozel, eksen: 0, renk: ozel === 'yildiz' ? -1 : renk });
      return;
    }
    o.push({ t: z[i], tur: 'patlama', hucre: h, renk, neden: 'fitil', nesil: 0, puan: 10 * k, ozel: 'yok', k });
    o.push({ t: z[i], tur: 'isindi', hucre: K(h.x, h.y - 1), isi: 1 + (k % 3), kizgin: k % 3 === 2 });
    o.push({ t: z[i], tur: 'hedefIlerledi', indeks: 0, deger: k, tamam: false });
  });
  const son = z[z.length - 1];
  // Isı dalgaları: kızgın komşular sırayla tutuşur (90 tik).
  const dalgalar = n >= 3 ? [3, 4, 2] : [1];
  let t = son;
  dalgalar.forEach((adet, w) => {
    t += 90;
    for (let j = 0; j < adet; j++) {
      const h = K((j * 2 + w) % 7, 6 - w);
      o.push({ t, tur: 'patlama', hucre: h, renk: (j + w) % 5, neden: 'isi', nesil: w + 1, puan: 20 * (w + 1), ozel: 'yok', k: 0 });
      o.push({ t, tur: 'isindi', hucre: K(h.x, h.y - 1), isi: 3, kizgin: true });
    }
    if (w === 0) o.push({ t, tur: 'dosemeAydinlandi', hucre: K(1, 6), kalan: 9 });
    if (w === 1) o.push({ t, tur: 'engelHasar', hucre: K(3, 5), engel: 'kaya', kalan: 0 });
    if (w === 2) o.push({ t, tur: 'kafesKirildi', hucre: K(4, 4) });
  });
  const reak = dalgalar.reduce((a, b) => a + b, 0);
  t += 120;
  o.push({ ...ORNEK_OLAYLAR.yercekimi, t });
  t += 350;
  o.push({ t, tur: 'reaksiyon', boyut: reak, zirveT: son + 90, merkez: K(3, 6), kombo: false, kademe: reak >= 8 ? 'guzel' : null });
  return o.sort((a, b) => a.t - b.t);
}
