/**
 * Hava olayları (§5): Meltem ve Çisenti; yedek düğme `soguma` (K21).
 * Yalnız `fitil` / `ciftDokunus` hamlelerinin sonunda çalışır (§3.5.4 adım 4).
 */
import { kon, type Cozum } from './baglam';
import type { HavaDurumu } from './types';

/** Hattaki hücre indeksleri (satır ya da sütun); geçersiz hat → boş. */
function hatHucreleri(c: Cozum, o: HavaDurumu, hat: number): number[] {
  const d = c.d;
  const l: number[] = [];
  if (o.eksen === 'satir') {
    if (hat < 0 || hat >= d.h) return l;
    for (let x = 0; x < d.w; x++) l.push(hat * d.w + x);
  } else {
    if (hat < 0 || hat >= d.w) return l;
    for (let y = 0; y < d.h; y++) l.push(y * d.w + hat);
  }
  return l;
}

/**
 * Meltem: hattaki ısınabilir kapsüllere +1, en fazla eşik−1'e kadar;
 * tutuşturmaz; hamle başı kalkanı geçerlidir.
 * Çisenti: hattaki bütün kapsüllerin ısısı 0.
 * Her ısı değişikliği `isiDegisti` yazar.
 */
function tetikle(c: Cozum, o: HavaDurumu, hat: number, t: number): void {
  const d = c.d;
  c.olaylar.push({ t, tur: 'havaOlayi', olay: o.tur, eksen: o.eksen, hat, uyari: false });
  for (const i of hatHucreleri(c, o, hat)) {
    const h = d.hucreler[i];
    const ic = h.icerik;
    if (h.delik || ic?.tur !== 'kapsul') continue;
    if (o.tur === 'meltem') {
      if (c.kalkan[i] || ic.isi >= d.esik - 1) continue;
      ic.isi++;
    } else {
      if (ic.isi === 0) continue;
      ic.isi = 0;
    }
    c.olaylar.push({ t, tur: 'isiDegisti', hucre: kon(d, i), isi: ic.isi });
  }
}

/**
 * Sayaçlar −1; 0'a inen sıradaki hattı tetikler (hatlar döngüsel) ve
 * `periyot`a döner. Sayaç 1 olduğunda sıradaki hat için uyarı yazılır.
 */
export function havaUygula(c: Cozum, t: number): void {
  for (const o of c.d.havaOlaylari) {
    if (o.hatlar.length === 0) continue;
    o.sayac--;
    if (o.sayac <= 0) {
      const hat = o.hatlar[o.sira % o.hatlar.length];
      o.sira = (o.sira + 1) % o.hatlar.length;
      o.sayac = Math.max(1, o.periyot);
      tetikle(c, o, hat, t);
    }
    if (o.sayac === 1) c.olaylar.push({ t, tur: 'havaOlayi', olay: o.tur, eksen: o.eksen, hat: o.hatlar[o.sira % o.hatlar.length], uyari: true });
  }
}

/** Soğuma (K21, §5): k > 0 ise her k hamlede bir bütün ısılar 1 azalır. */
export function sogumaUygula(c: Cozum, t: number): void {
  const d = c.d;
  const k = d.kurallar.soguma ?? 0;
  if (k <= 0 || d.hamleNo % k !== 0) return;
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    const ic = h.icerik;
    if (h.delik || ic?.tur !== 'kapsul' || ic.isi <= 0) continue;
    ic.isi--;
    c.olaylar.push({ t, tur: 'isiDegisti', hucre: kon(d, i), isi: ic.isi });
  }
}
