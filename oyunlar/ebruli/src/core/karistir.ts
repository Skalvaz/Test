/**
 * Ölü tahta ve karıştırma (GDD §4.8). Hamle sonunda hiç geçerli hamle
 * yoksa bütün düz, yağsız damlalar `d.rng` ile karıştırılır (Fisher–Yates);
 * grup oluşturan ya da yine geçerli hamle vermeyen permütasyon reddedilir
 * (en fazla 100 deneme). Bulunamazsa son çare: komşusuyla karışabilecek ilk
 * düz damla, `DOGUM_SIRASI`'nda ilk uygun ham renge boyanır (`donustu`).
 * Olay: `karistirma{esleme}` (son çarede boş eşleme + `donustu`).
 */
import type { Baglam } from './baglam';
import { rngInt } from './rng';
import { DIK, damla, gecerliHamleVar, gruplariBul, karisimSonucu } from './tahta';
import type { Damla, Icerik, Konum, Renk } from './types';

const KARISTIRMA_DENEMESI = 100;
const HAM_SIRASI: readonly Renk[] = [1, 2, 4];

/** Tahta ölüyse karıştırır; olayları `c.t`'de yazar. Karıştırdıysa true. */
export function oluysaKaristir(c: Baglam): boolean {
  const d = c.d;
  if (gecerliHamleVar(d)) return false;
  const hs = d.hucreler;
  const yerler: number[] = [];
  for (let i = 0; i < hs.length; i++) {
    const dm = damla(hs[i]);
    if (dm && dm.ozel === 'yok' && !hs[i].yag) yerler.push(i);
  }
  const asil: Icerik[] = yerler.map((i) => hs[i].icerik!);
  const K = (i: number): Konum => c.K(i);
  for (let deneme = 0; deneme < KARISTIRMA_DENEMESI && yerler.length > 1; deneme++) {
    const sira = yerler.map((_, k) => k);
    for (let k = sira.length - 1; k > 0; k--) {
      const j = rngInt(d, k + 1);
      const g = sira[k];
      sira[k] = sira[j];
      sira[j] = g;
    }
    // sira[k]: k. yere gelen damlanın eski yeri.
    yerler.forEach((i, k) => (hs[i].icerik = asil[sira[k]]));
    if (gruplariBul(d).length === 0 && gecerliHamleVar(d)) {
      const esleme: { den: Konum; e: Konum }[] = [];
      yerler.forEach((i, k) => {
        const den = yerler[sira[k]];
        if (den !== i) esleme.push({ den: K(den), e: K(i) });
      });
      c.ekle(c.t, { tur: 'karistirma', esleme });
      d.istatistik.karistirma++;
      return true;
    }
  }
  yerler.forEach((i, k) => (hs[i].icerik = asil[k]));
  // Son çare.
  for (const i of yerler) {
    const dm = damla(hs[i]) as Damla;
    const x = i % d.w;
    const y = (i - x) / d.w;
    for (const r of HAM_SIRASI) {
      if (r === dm.renk) continue;
      let uygun = false;
      for (const o of DIK) {
        const xx = x + o.x;
        const yy = y + o.y;
        if (xx < 0 || yy < 0 || xx >= d.w || yy >= d.h) continue;
        const hb = hs[yy * d.w + xx];
        const b = damla(hb);
        if (!b || b.ozel !== 'yok' || hb.yag) continue;
        if ('sonuc' in karisimSonucu(r, b.renk as Renk, d.kurallar.murekkep)) uygun = true;
      }
      if (!uygun) continue;
      const yeni: Damla = { ...dm, renk: r };
      hs[i].icerik = { tur: 'damla', damla: yeni };
      if (gruplariBul(d).length > 0) {
        hs[i].icerik = { tur: 'damla', damla: dm };
        continue;
      }
      c.ekle(c.t, { tur: 'karistirma', esleme: [] });
      c.ekle(c.t, { tur: 'donustu', hucre: K(i), damla: { ...yeni } });
      d.istatistik.karistirma++;
      return true;
    }
  }
  return false;
}
