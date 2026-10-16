/**
 * Tahta yardımcıları ve P0'ın küçük saf kuralları: karışım tablosu (§3.3),
 * grup bulma (§4.3), geçerli hamle varlığı (§4.8). Çekirdek paketi (P1)
 * bunları kullanır ve genişletir; anlamlarını değiştirmez.
 */
import { ESLESME_ESIGI } from './sabitler';
import type { Damla, Hucre, KarisikRenk, Konum, OyunDurumu, Renk } from './types';

export const DIK: readonly Konum[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const idx = (d: { w: number }, x: number, y: number): number => y * d.w + x;
export const konum = (d: { w: number }, i: number): Konum => ({ x: i % d.w, y: Math.floor(i / d.w) });
export const icinde = (d: { w: number; h: number }, x: number, y: number): boolean => x >= 0 && y >= 0 && x < d.w && y < d.h;

export function bosHucre(): Hucre {
  return { delik: false, icerik: null, kagit: 0, yag: false, desen: 0, desenBoyali: false };
}

export const hamMi = (r: number): r is 1 | 2 | 4 => r === 1 || r === 2 || r === 4;
export const karisikMi = (r: number): r is KarisikRenk => r === 3 || r === 5 || r === 6;

/** Hücredeki damla (yoksa null). */
export function damla(h: Hucre): Damla | null {
  return h.icerik && h.icerik.tur === 'damla' ? h.icerik.damla : null;
}

/**
 * Karışım tablosu (§3.3, K1). Kaynak `a` hedef `b`'ye sürüklenir; ikisi de
 * düz damladır (özel taş değil). Sonuç ya da geçersizlik nedeni döner.
 *  - ham + farklı ham → karışık (a | b)
 *  - karışık + eksik ham (her iki yönde) → Mürekkep 7, yalnız `murekkep` açıkken
 *  - aynı renk, ortak bileşen, karışık + karışık, Mürekkep → geçersiz
 */
export function karisimSonucu(
  a: Renk,
  b: Renk,
  murekkep: boolean,
): { sonuc: Renk } | { hata: 'ayniRenk' | 'ortakBilesen' | 'murekkepKapali' | 'karisikKarisik' | 'karismaz' } {
  if (a === 7 || b === 7) return { hata: 'karismaz' };
  if (a === b) return { hata: 'ayniRenk' };
  if (karisikMi(a) && karisikMi(b)) return { hata: 'karisikKarisik' };
  if ((a & b) !== 0) return { hata: 'ortakBilesen' };
  const sonuc = (a | b) as Renk;
  if (sonuc === 7 && !murekkep) return { hata: 'murekkepKapali' };
  return { sonuc };
}

/** Damla bir gruba katılabilir mi: karışık renkli düz damla, Tarak ya da Girdap. */
export function gruplanir(dm: Damla | null): boolean {
  if (!dm) return false;
  if (dm.ozel === 'lale' || dm.ozel === 'murekkep') return false;
  return karisikMi(dm.renk);
}

/**
 * Eşleşen gruplar (§4.3): aynı karışık renkten yatay/dikey bağlı, en az
 * `ESLESME_ESIGI` damlalık her bileşen. Tarak ve Girdap kendi renklerinin
 * grubuna katılır; ham boya, Lale ve Mürekkep katılmaz. Gruplar en küçük
 * hücre indeksine göre sıralı, hücreler artan indeksle döner.
 */
export function gruplariBul(d: Pick<OyunDurumu, 'w' | 'h' | 'hucreler'>): { renk: KarisikRenk; hucreler: number[] }[] {
  const n = d.w * d.h;
  const gor = new Uint8Array(n);
  const out: { renk: KarisikRenk; hucreler: number[] }[] = [];
  const yigin: number[] = [];
  for (let i = 0; i < n; i++) {
    if (gor[i]) continue;
    const dm = damla(d.hucreler[i]);
    if (!gruplanir(dm)) continue;
    const renk = dm!.renk as KarisikRenk;
    const grup: number[] = [];
    yigin.length = 0;
    yigin.push(i);
    gor[i] = 1;
    while (yigin.length) {
      const k = yigin.pop()!;
      grup.push(k);
      const x = k % d.w;
      const y = (k - x) / d.w;
      for (const o of DIK) {
        const xx = x + o.x;
        const yy = y + o.y;
        if (!icinde(d, xx, yy)) continue;
        const j = yy * d.w + xx;
        if (gor[j]) continue;
        const dj = damla(d.hucreler[j]);
        if (gruplanir(dj) && dj!.renk === renk) {
          gor[j] = 1;
          yigin.push(j);
        }
      }
    }
    if (grup.length >= ESLESME_ESIGI) out.push({ renk, hucreler: grup.sort((p, q) => p - q) });
  }
  return out;
}

/**
 * Tahtada en az bir geçerli hamle var mı (§4.8, ölü tahta testi): bir özel
 * taş komşusunda damla varsa ya da iki komşu düz damla karışabiliyorsa.
 * Yağlı hücredeki damla karışıma katılamaz (§6.3).
 */
export function gecerliHamleVar(d: Pick<OyunDurumu, 'w' | 'h' | 'hucreler' | 'kurallar'>): boolean {
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < d.w; x++) {
      const h = d.hucreler[y * d.w + x];
      const a = damla(h);
      if (!a || h.yag) continue;
      for (const o of DIK) {
        const xx = x + o.x;
        const yy = y + o.y;
        if (!icinde(d, xx, yy)) continue;
        const hb = d.hucreler[yy * d.w + xx];
        const b = damla(hb);
        if (!b || hb.yag) continue;
        if (a.ozel !== 'yok' || b.ozel !== 'yok') return true;
        if ('sonuc' in karisimSonucu(a.renk as Renk, b.renk as Renk, d.kurallar.murekkep)) return true;
      }
    }
  return false;
}

/** Derin kopya (hamleUygula girdiyi değiştirmez). */
export function durumKopyala(d: OyunDurumu): OyunDurumu {
  return {
    ...d,
    hucreler: d.hucreler.map((h) => ({
      ...h,
      icerik: h.icerik ? (h.icerik.tur === 'damla' ? { tur: 'damla', damla: { ...h.icerik.damla } } : { ...h.icerik }) : null,
    })),
    dogumAgirliklari: [...d.dogumAgirliklari] as OyunDurumu['dogumAgirliklari'],
    kurallar: { ...d.kurallar, ozelEsikleri: [...d.kurallar.ozelEsikleri] as [number, number, number] },
    hedefler: d.hedefler.map((h) => ({ ...h, hedef: { ...h.hedef } })),
    gunluk: d.gunluk.map((g) => ({ ...g })),
    istatistik: { ...d.istatistik },
  };
}
