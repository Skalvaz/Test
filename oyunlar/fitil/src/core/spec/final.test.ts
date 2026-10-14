/**
 * §7.3 Final Gösterisi: kalan hamle başına roket (t = 120·i), tahtadaki
 * özel taşların tetiklenmesi, kalan hamle başına +100.
 */
import { describe, expect, it } from 'vitest';
import { durumKarmasi, finalGosterisi } from '../index';
import type { OyunDurumu } from '../index';
import { derinDondur, fitil, hucreAt, hucrede, kur, ozelSayisi, sec, tAzalmayan, uygula } from './kur';

const BOS = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .'];

/** Kızıl 3'lü ile kazanılan bölüm: kalan hamle = hamle − 1. */
function kazanilmis(hamle: number, ust = '. . . . . . .'): OyunDurumu {
  const d = kur({ tahta: [ust, ...BOS.slice(1), 'R R R . . . .'], hamle, hedefler: [{ tur: 'topla', renk: 0, adet: 3 }] });
  const { durum } = uygula(d, fitil('0,5 1,5 2,5'));
  expect(durum.bitti).toBe('kazanc');
  return durum;
}

describe('§7.3 Final Gösterisi', () => {
  it('§7.3 kalan m hamle için m roket, i. roket t = 120·i anında tetiklenir', () => {
    const d = kazanilmis(5);
    expect(d.kalanHamle).toBe(4);
    const { olaylar } = finalGosterisi(d);
    expect(sec(olaylar, 'finalBasladi')).toMatchObject([{ kalanHamle: 4 }]);
    for (let i = 0; i < 4; i++) {
      const r = sec(olaylar, 'ozelTetiklendi').filter((o) => o.ozel === 'roket' && o.t === 120 * i);
      expect(r, `roket ${i}`).toHaveLength(1);
      expect([0, 1, 2, 3]).toContain(r[0].eksen);
      // seçilen hücre düz (kafessiz, özel olmayan) kapsüldü
      const c = hucreAt(d, r[0].hucre.x, r[0].hucre.y);
      expect(c.kafes).toBe(false);
      expect(c.icerik).toMatchObject({ tur: 'kapsul', ozel: 'yok' });
    }
  });

  it('§7.3.4 kalan her hamle için ayrıca +100', () => {
    const d = kazanilmis(5);
    const { olaylar, durum } = finalGosterisi(d);
    const kh = sec(olaylar, 'puanEklendi').filter((p) => p.neden === 'kalanHamle');
    expect(kh.reduce((s, p) => s + p.miktar, 0)).toBe(400);
    expect(durum.puan).toBeGreaterThanOrEqual(d.puan + 400);
  });

  it('§7.3.3 tahtadaki özel taşlar tetiklenir; final sonunda özel taş kalmaz (m = 0)', () => {
    const d = kazanilmis(1, '. . . . . . G|');
    expect(d.kalanHamle).toBe(0);
    expect(ozelSayisi(d)).toBe(1);
    const { olaylar, durum } = finalGosterisi(d);
    expect(hucrede(olaylar, 'ozelTetiklendi', 6, 0)).toMatchObject([{ ozel: 'roket', eksen: 1 }]);
    expect(sec(olaylar, 'puanEklendi').filter((p) => p.neden === 'kalanHamle' && p.miktar > 0)).toEqual([]);
    expect(ozelSayisi(durum)).toBe(0);
  });

  it('§7.3 final olayları zaman sırasında ve belirlenimli; girdiyi değiştirmez', () => {
    const d = kazanilmis(4);
    const once = JSON.stringify(d);
    const a = finalGosterisi(derinDondur(d));
    expect(JSON.stringify(d)).toBe(once);
    expect(tAzalmayan(a.olaylar)).toBe(true);
    const b = finalGosterisi(d);
    expect(durumKarmasi(a.durum)).toBe(durumKarmasi(b.durum));
    expect(JSON.stringify(a.olaylar)).toBe(JSON.stringify(b.olaylar));
  });
});
