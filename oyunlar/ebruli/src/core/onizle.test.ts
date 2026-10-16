/**
 * P1 testi (GDD §4.2, §13.4): önizleme = hamlenin ilk dolumdan önceki kısmı.
 * Rastgele oyunlarda her hamle için `onizle` (doğumsuz) ile `hamleUygula`
 * karşılaştırılır: temizlenen hücreler, ilk adım grupları ve özel taş
 * hayaleti BİREBİR aynı. Önizleme saftır (dondurulmuş girdi).
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, hamleUygula, onizle } from './index';
import type { Konum, Olay, OzelTur } from './types';
import { derinDondur, H, kur, rastgeleBolum, rastgeleHamle } from './testAraclari';

const N = Number(process.env.FUZZ_N ?? 300);
const anahtar = (p: Konum) => `${p.x},${p.y}`;

/** Gerçek hamlenin ilk dolumdan (doğan içeren ilk yercekimi) önceki olayları. */
function dolumOncesi(ol: Olay[]): Olay[] {
  const i = ol.findIndex((o) => o.tur === 'yercekimi' && o.doganlar.length > 0);
  return i < 0 ? ol : ol.slice(0, i);
}

const GUC: Record<OzelTur, number> = { yok: 0, tarak: 1, girdap: 2, lale: 3, murekkep: 0 };

describe(`önizleme = ilk dolumdan önceki kısım (${N} oyun)`, () => {
  it('temizlenecek hücreler, ilk adım grupları, özel hayaleti, sonuç rengi', () => {
    let hamle = 0;
    let temizlikli = 0;
    for (let oyun = 0; oyun < N; oyun++) {
      const r = { rng: (oyun * 0x27d4eb2d + 99) >>> 0 };
      const v = rastgeleBolum(r, 9100 + oyun);
      let d = bolumuYukle(v, oyun % 3);
      for (let adim = 0; adim < 40 && !d.bitti; adim++) {
        const h = rastgeleHamle(d, r);
        if (!h) break;
        const o = onizle(d, h);
        const g = hamleUygula(d, h);
        const on = dolumOncesi(g.olaylar);
        const baglam = `oyun ${oyun} adım ${adim} ${JSON.stringify(h)}`;
        const gercek = new Set<string>();
        for (const x of on) if (x.tur === 'temizlendi') gercek.add(anahtar(x.hucre));
        expect(new Set(o.temizlenecek.map(anahtar)), baglam).toEqual(gercek);
        expect(o.temizlenecek.length, baglam).toBe(gercek.size);
        // İlk adım (k = 1) grupları.
        const gruplar = on.filter((x) => x.tur === 'eslesti' && x.k === 1) as Extract<Olay, { tur: 'eslesti' }>[];
        expect(o.gruplar, baglam).toEqual(gruplar.map((x) => ({ renk: x.renk, hucreler: x.hucreler })));
        // Özel taş hayaleti: ilk adımın en güçlü üretimi.
        const ilkAdim = on.slice(0, Math.max(0, on.findIndex((x) => x.tur === 'kaskat')) || on.length);
        let enGuclu: Extract<Olay, { tur: 'ozelOlustu' }> | null = null;
        for (const x of ilkAdim) if (x.tur === 'ozelOlustu' && (!enGuclu || GUC[x.damla.ozel] > GUC[enGuclu.damla.ozel])) enGuclu = x;
        expect(o.ozelHayalet, baglam).toEqual(enGuclu ? { hucre: enGuclu.hucre, ozel: enGuclu.damla.ozel, yon: enGuclu.damla.yon, renk: enGuclu.damla.renk } : null);
        const k = g.olaylar[0];
        expect(o.sonuc, baglam).toBe(k.tur === 'karisti' ? k.sonuc : null);
        hamle++;
        if (gercek.size) temizlikli++;
        d = g.durum;
      }
    }
    expect(hamle).toBeGreaterThan(N * 5);
    expect(temizlikli).toBeGreaterThan(hamle / 4);
  }, Math.max(60_000, N * 400));

  it('saf: dondurulmuş durumda çalışır, RNG tüketmez; geçersizde fırlatmaz', () => {
    const d = derinDondur(kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { dogum: [20, 20, 20, 11, 11, 11], garanti: 3 }));
    const o = onizle(d, H(3, 2, 2, 2));
    expect(o).toMatchObject({ gecerli: true, hata: null, sonuc: 3, sonucHucre: { x: 2, y: 2 }, etkiAlani: [], kombo: null });
    expect(o.temizlenecek).toEqual([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }]);
    expect(o.hedefArtisi).toEqual([90]);
    expect(onizle(d, H(0, 0, 5, 5))).toMatchObject({ gecerli: false, hata: 'konum' });
    expect(onizle(d, H(0, 0, 1, 1))).toMatchObject({ gecerli: false, hata: 'komsuDegil' });
  });
});
