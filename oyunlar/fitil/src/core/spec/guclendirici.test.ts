/**
 * §9 güçlendiriciler (hamle harcamaz): Kibrit (t = 0'da 0. nesil vuruş),
 * Fişek Kalıbı (düz kapsül → roket, ateşlemez).
 */
import { describe, expect, it } from 'vitest';
import { fitil, hucrede, ic, kalip, kibrit, kur, patlamaAt, sec, uygula } from './kur';

const BOS = ['. . . . .', '. . . . .', '. . . . .', '. . . . .'];
const HAVA = [{ tur: 'meltem' as const, eksen: 'satir' as const, hatlar: [0], periyot: 3, baslangic: 2 }];

describe('§9 güçlendiriciler', () => {
  it('§9 kibrit: seçilen kapsül t = 0\'da 0. nesil patlar; hamle harcamaz', () => {
    const d = kur({ tahta: [...BOS, '. G . . .', 'R R R . .'], hamle: 9 });
    const { olaylar, durum } = uygula(d, kibrit(1, 4));
    expect(patlamaAt(olaylar, 1, 4)).toMatchObject({ t: 0, nesil: 0, neden: 'kibrit' });
    expect(durum.kalanHamle).toBe(9);
  });

  it('§9 kibrit: engel 1 hasar alır, ıslak kurur, özel taş tetiklenir', () => {
    const d = kur({ tahta: [...BOS, 'K2 W:G R| . .', '. . . . .'] });
    expect(hucrede(uygula(d, kibrit(0, 4)).olaylar, 'engelHasar', 0, 4)).toMatchObject([{ t: 0, engel: 'kaya', kalan: 1 }]);
    expect(hucrede(uygula(d, kibrit(1, 4)).olaylar, 'kurudu', 1, 4)).toMatchObject([{ t: 0, renk: 3 }]);
    expect(hucrede(uygula(d, kibrit(2, 4)).olaylar, 'ozelTetiklendi', 2, 4)).toMatchObject([{ t: 0, ozel: 'roket', eksen: 1 }]);
  });

  it('§9 fişek kalıbı: düz kapsülü seçilen eksende rokete çevirir, ateşlemez, hamle harcamaz', () => {
    const d = kur({ tahta: [...BOS, '. G . . .', 'R R R . .'], hamle: 9 });
    const { olaylar, durum } = uygula(d, kalip(1, 4, 3));
    expect(sec(olaylar, 'patlama')).toEqual([]);
    expect(ic(durum, 1, 4)).toMatchObject({ tur: 'kapsul', renk: 3, ozel: 'roket', eksen: 3 });
    expect(durum.kalanHamle).toBe(9);
  });

  it('§3.5.4 güçlendiricilerde hava sayacı inmez (yalnız fitil / çift dokunuş)', () => {
    const d = kur({ tahta: [...BOS, '. G . . .', 'R R R . .'], havaOlaylari: HAVA });
    expect(uygula(d, kibrit(1, 4)).durum.havaOlaylari[0].sayac).toBe(2);
    expect(uygula(d, kalip(1, 4, 0)).durum.havaOlaylari[0].sayac).toBe(2);
    expect(uygula(d, fitil('0,5 1,5 2,5')).durum.havaOlaylari[0].sayac).toBe(1);
  });
});
