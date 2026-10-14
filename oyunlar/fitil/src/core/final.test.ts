/** Final Gösterisi (§7.3). */
import { describe, expect, it } from 'vitest';
import { finalGosterisi } from './final';
import { hamleUygula } from './hamle';
import { desen, derinDondur, fitil, kur, sec } from './testAraclari';

function kazanilmis(hamle: number, ek: Record<string, string> = {}) {
  const d = kur(desen(6, 6, { '0,5': 'R', '1,5': 'R', '2,5': 'R', ...ek }), { hamle, hedefler: [{ tur: 'topla', renk: 'hepsi', adet: 3 }] });
  const r = hamleUygula(d, fitil([0, 5], [1, 5], [2, 5]));
  expect(r.durum.bitti).toBe('kazanc');
  return r.durum;
}

describe('Final Gösterisi (§7.3)', () => {
  it('kalan hamle kadar roket: (y,x) sıralı düz kapsüllerden rngInt, eksen rngInt(4), t = 120·i; +100/hamle', () => {
    const d = derinDondur(kazanilmis(5));
    expect(d.kalanHamle).toBe(4);
    const f = finalGosterisi(d);
    expect(f.olaylar[0]).toEqual({ t: 0, tur: 'finalBasladi', kalanHamle: 4 });
    const roketler = sec(f.olaylar, 'ozelOlustu').filter((o) => o.t === 0);
    expect(roketler).toHaveLength(4);
    for (const o of roketler) expect(o.ozel).toBe('roket');
    const p = sec(f.olaylar, 'patlama');
    const zaman = roketler.map((o) => p.find((q) => q.hucre.x === o.hucre.x && q.hucre.y === o.hucre.y && q.ozel === 'roket'));
    expect(zaman.map((q) => q?.t)).toEqual([0, 120, 240, 360]);
    for (const q of zaman) expect(q).toMatchObject({ neden: 'final', puan: 15 });
    expect(sec(f.olaylar, 'puanEklendi')).toContainEqual(expect.objectContaining({ neden: 'kalanHamle', miktar: 400 }));
    expect(f.durum.kalanHamle).toBe(0);
    expect(f.durum.finalYapildi).toBe(true);
    expect(f.durum.puan).toBeGreaterThan(d.puan + 400);
    // Sonunda tahtada özel taş kalmaz (turlar tetikledi), tahta dolu.
    expect(f.durum.hucreler.some((h) => h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok')).toBe(false);
    expect(f.durum.hucreler.every((h) => h.delik || h.icerik)).toBe(true);
    expect(sec(f.olaylar, 'reaksiyon')).toHaveLength(1);
    // Belirlenimli.
    expect(JSON.stringify(finalGosterisi(d).olaylar)).toBe(JSON.stringify(f.olaylar));
  });

  it('tahtadaki özel taşlar (y,x) sırasıyla 80 tik arayla tetiklenir (m = 0)', () => {
    // Özel taşlar zincirin (0–2. sütunlar) kaydırmadığı sütunlarda.
    const d = kazanilmis(1, { '4,0': 'Ar1', '5,2': 'Gk' });
    expect(d.kalanHamle).toBe(0);
    const f = finalGosterisi(d);
    const t = sec(f.olaylar, 'ozelTetiklendi').map((o) => `${o.hucre.x},${o.hucre.y}@${o.t}`);
    expect(t).toEqual(['4,0@0', '5,2@80']);
    expect(sec(f.olaylar, 'patlama').find((o) => o.hucre.x === 5 && o.hucre.y === 2)).toMatchObject({ neden: 'final', t: 80 });
    expect(sec(f.olaylar, 'puanEklendi').some((o) => o.neden === 'kalanHamle')).toBe(false);
  });

  it('kazanılmamış bölümde ya da ikinci kez çağrılınca hata', () => {
    const d = kur(desen(4, 4, { '0,3': 'R', '1,3': 'R', '2,3': 'R' }));
    expect(() => finalGosterisi(d)).toThrow();
    const f = finalGosterisi(kazanilmis(3));
    expect(() => finalGosterisi(f.durum)).toThrow();
  });
});
