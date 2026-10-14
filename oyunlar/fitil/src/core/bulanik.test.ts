/**
 * Özellik ve bulanık testler (§16.4). Varsayılan 300 rastgele oyun; ortam
 * değişkeni FUZZ_N verilirse o kadar (ör. FUZZ_N=10000).
 *
 * Her hamlede:
 *  - girdi değişmez (derin Object.freeze; yazma TypeError fırlatır);
 *  - aynı girdi aynı karma ve aynı olaylar;
 *  - hiçbir hücre bir hamlede iki kez patlamaz; çözümleme sonlanır;
 *  - olaylar t'ye göre azalmayan sırada;
 *  - hamle sonunda delik olmayan her yuva dolu;
 *  - kapsül korunumu: sonra = önce − patlayan + doğan + kuruyan − ise dönen
 *    (dönüşen kapsül tahtada kalır);
 *  - puan = önce + Σ patlama.puan + Σ puanEklendi;
 *  - görsel tahta (yalnız olaylarla) sonraki durumla aynı;
 *  - bölüm bitmediyse tahta kilitli değil (karıştırma kilitsiz bırakır).
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from './bolumYukle';
import { finalGosterisi } from './final';
import { hamleUygula } from './hamle';
import { durumKarmasi } from './index';
import { kilitliMi } from './kilit';
import { rngInt } from './rng';
import { derinDondur, gorselUygula, kapsulSayisi, rastgeleBolum, rastgeleHamle, sec } from './testAraclari';
import type { Olay, OyunDurumu } from './types';

const N = Number(process.env.FUZZ_N ?? 300);

function siraliMi(olaylar: readonly Olay[]): boolean {
  for (let k = 1; k < olaylar.length; k++) if (olaylar[k].t < olaylar[k - 1].t) return false;
  return true;
}

/** Yerçekimi olayları arasında kalan her bölümde bir hücre en fazla bir kez patlar. */
function ikiKezPatlayan(olaylar: readonly Olay[]): string | null {
  let gorulen = new Set<string>();
  for (const o of olaylar) {
    if (o.tur === 'yercekimi') gorulen = new Set();
    if (o.tur !== 'patlama') continue;
    const k = `${o.hucre.x},${o.hucre.y}`;
    if (gorulen.has(k)) return k;
    gorulen.add(k);
  }
  return null;
}

function tahtaDolu(d: OyunDurumu): boolean {
  return d.hucreler.every((h) => h.delik || h.icerik !== null);
}

function gorselEsit(onceki: OyunDurumu, olaylar: Olay[], sonraki: OyunDurumu): void {
  const g = gorselUygula(onceki, olaylar);
  const beklenen = {
    hucreler: sonraki.hucreler,
    puan: sonraki.puan,
    korukDolum: sonraki.korukDolum,
    hedefler: sonraki.hedefler.map((h) => ({ deger: h.ilerleme, tamam: h.tamam, gerekli: h.gerekli })),
    izler: sonraki.izler.map((iz) => iz.yandi),
  };
  // Hızlı yol: JSON eşitse derin karşılaştırmaya gerek yok (fark varsa okunur diff).
  if (JSON.stringify(g) !== JSON.stringify(beklenen)) expect(g).toEqual(beklenen);
}

describe(`bulanık: ${N} rastgele oyun`, () => {
  it('özellikler her hamlede tutar', () => {
    let hamleSayisi = 0;
    let kazanc = 0;
    let karistirma = 0;
    let kombo = 0;
    for (let oyun = 0; oyun < N; oyun++) {
      const r = { rng: (oyun * 2654435761) >>> 0 };
      const v = rastgeleBolum(r, 5000 + oyun);
      let d = bolumuYukle(v, rngInt(r, 3));
      for (let adim = 0; adim < 40 && !d.bitti; adim++) {
        const h = rastgeleHamle(d, r);
        if (!h) break;
        derinDondur(d);
        derinDondur(h);
        const karmaOnce = durumKarmasi(d);
        const sonuc = hamleUygula(d, h);
        const ikinci = hamleUygula(d, h);
        const baglam = `oyun ${oyun} adım ${adim} ${JSON.stringify(h)}`;
        expect(durumKarmasi(d), baglam).toBe(karmaOnce);
        expect(durumKarmasi(ikinci.durum), baglam).toBe(durumKarmasi(sonuc.durum));
        expect(JSON.stringify(ikinci.olaylar), baglam).toBe(JSON.stringify(sonuc.olaylar));
        const o = sonuc.olaylar;
        expect(o.length, baglam).toBeLessThan(100000);
        expect(siraliMi(o), baglam).toBe(true);
        expect(ikiKezPatlayan(o), baglam).toBeNull();
        expect(tahtaDolu(sonuc.durum), baglam).toBe(true);
        const patlayan = sec(o, 'patlama').length;
        const dogan = sec(o, 'yercekimi').reduce((s, y) => s + y.doganlar.filter((g) => g.icerik.tur === 'kapsul').length, 0);
        const kuruyan = sec(o, 'kurudu').length;
        const ise = sec(o, 'isYayildi').length;
        expect(kapsulSayisi(sonuc.durum), baglam).toBe(kapsulSayisi(d) - patlayan + dogan + kuruyan - ise);
        gorselEsit(d, o, sonuc.durum);
        if (!sonuc.durum.bitti) expect(kilitliMi(sonuc.durum), baglam).toBe(false);
        if (sec(o, 'karistirma').length) karistirma++;
        if (sec(o, 'kombinasyon').length) kombo++;
        expect(sec(o, 'reaksiyon'), baglam).toHaveLength(1);
        hamleSayisi++;
        d = sonuc.durum;
      }
      if (d.bitti === 'kazanc') {
        kazanc++;
        derinDondur(d);
        const f = finalGosterisi(d);
        const baglam = `oyun ${oyun} final`;
        expect(siraliMi(f.olaylar), baglam).toBe(true);
        expect(ikiKezPatlayan(f.olaylar), baglam).toBeNull();
        expect(tahtaDolu(f.durum), baglam).toBe(true);
        expect(f.durum.kalanHamle).toBe(0);
        gorselEsit(d, f.olaylar, f.durum);
        expect(() => finalGosterisi(f.durum)).toThrow();
      }
    }
    // Bulanık üretici gerçekten çeşitli durumlara ulaşıyor mu.
    expect(hamleSayisi).toBeGreaterThan(N * 5);
    if (N >= 100) {
      expect(kazanc).toBeGreaterThan(0);
      expect(kombo).toBeGreaterThan(0);
    }
    void karistirma;
  }, Math.max(60_000, N * 100));
});
