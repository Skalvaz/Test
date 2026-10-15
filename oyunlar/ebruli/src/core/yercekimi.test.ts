import { describe, expect, it } from 'vitest';
import { damla } from './tahta';
import { kur, tahtaMetni } from './testAraclari';
import { dogumYerleri, YerTuru } from './yercekimi';
import type { Olay } from './types';

describe('yerçekimi (§4.5)', () => {
  it('düz düşme; beslenen boşluklar dolumsuz turda boş kalır', () => {
    const d = kur(['4 5', '- 6', '3 -']);
    const tur = new YerTuru(d);
    expect(tur.dus()).toBe(true);
    expect(tahtaMetni(d)).toEqual(['- -', '4 5', '3 6']);
    const o = tur.olay(100) as Extract<Olay, { tur: 'yercekimi' }>;
    expect(o.t).toBe(100);
    expect(o.doganlar).toEqual([]);
    expect(o.dusenler).toEqual(
      expect.arrayContaining([
        { den: { x: 0, y: 0 }, e: { x: 0, y: 1 } },
        { den: { x: 1, y: 1 }, e: { x: 1, y: 2 } },
        { den: { x: 1, y: 0 }, e: { x: 1, y: 1 } },
      ]),
    );
    expect(o.dusenler).toHaveLength(3);
  });

  it('mermer altı çapraz kayma: önce sol-üst, sonra sağ-üst; kayan sütun yeniden iner', () => {
    const d = kur(['1 X1 2', '1 - 2', '1 - 2']);
    const id = (x: number, y: number) => damla(d.hucreler[y * d.w + x])!.id;
    const a = id(0, 1);
    const b = id(0, 0);
    const c = id(2, 0);
    const tur = new YerTuru(d);
    tur.dus();
    expect(tahtaMetni(d)).toEqual(['- X1 -', '1 2 2', '1 1 2']);
    expect(id(1, 2)).toBe(a);
    expect(id(0, 1)).toBe(b);
    expect(id(1, 1)).toBe(c);
    // İlk ve son konum (çapraz dahil).
    expect(tur.hareket.get(a)).toEqual({ den: 3, e: 7 });
    expect(tur.hareket.get(c)).toEqual({ den: 2, e: 4 });
  });

  it('damla kendi sütununda düşebiliyorsa çapraz kaymaz; delik de engeldir', () => {
    // (1,1) ve (1,2) deliğin altında (beslenmez). Sol sütunda (0,1) boş: (0,0)
    // önce kendi sütununda iner, sonra çapraz kayma (1,2)'ye.
    const d = kur(['1 # 4', '- - 4', '1 - 4']);
    new YerTuru(d).dus();
    // Sol-üst önce: (1,2) ← (0,1); sonra (1,1) ← sağ-üst (2,0) (sol-üst boş).
    expect(tahtaMetni(d)).toEqual(['- # -', '- 4 4', '1 1 4']);
  });

  it('beslenen hücreler: tepeden engelsiz ulaşılanlar', () => {
    const engel = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0, 1]);
    expect([...dogumYerleri(3, 3, engel)]).toEqual([1, 0, 1, 1, 0, 1, 1, 0, 0]);
  });

  it('dolum: soldan sağa sütun, aşağıdan yukarı; sanalY −1, −2…; doğanlar düz', () => {
    const d = kur(['- 4 -', '- 4 -', '5 4 -'], { dogum: [1, 1, 1, 0, 0, 0] });
    const ilkId = d.sonrakiId;
    const tur = new YerTuru(d);
    tur.dus();
    expect(tur.doldur()).toBe(5);
    const o = tur.olay(0) as Extract<Olay, { tur: 'yercekimi' }>;
    expect(o.doganlar.map((g) => [g.hucre.x, g.hucre.y, g.sanalY, g.damla.id - ilkId])).toEqual([
      [0, 1, -1, 0],
      [0, 0, -2, 1],
      [2, 2, -1, 2],
      [2, 1, -2, 3],
      [2, 0, -3, 4],
    ]);
    for (const g of o.doganlar) {
      expect(g.damla.ozel).toBe('yok');
      expect([1, 2, 4]).toContain(g.damla.renk);
    }
    expect(d.hucreler.every((c) => c.icerik)).toBe(true);
  });

  it('dolum turu: çapraz kayma beslenen sütundan çekerse yeniden doğum', () => {
    const d = kur(['1 X1', '1 -'], { dogum: [1, 0, 0, 0, 0, 0] });
    const tur = new YerTuru(d);
    tur.dus();
    expect(tahtaMetni(d)).toEqual(['- X1', '1 1']);
    expect(tur.doldur()).toBe(1);
    expect(tahtaMetni(d)).toEqual(['1 X1', '1 1']);
  });

  it('beslenmeyen ve kaymayla da ulaşılamayan hücre boş kalır (mermer satırı)', () => {
    const d = kur(['1 1 1', 'X1 X1 X1', '- - -']);
    const tur = new YerTuru(d);
    tur.dus();
    tur.doldur();
    expect(tahtaMetni(d)).toEqual(['1 1 1', 'X1 X1 X1', '- - -']);
    expect(tur.bos()).toBe(true);
    expect(tur.olay(0)).toBeNull();
  });
});
