/**
 * Mühürlerin statik kuralları (docs/KANCALAR.md §A.3, §A.5): kademe sırası,
 * şansa bağlı işareti, metin tekliği, bölüm içeriğiyle uyum ve 105 mühürün
 * bölüm verisindeki genel kuralları.
 */
import { describe, expect, it } from 'vitest';
import type { BolumVerisi, MuhurKosulu } from '../core/types';
import { bolumDogrula } from '../levels/dogrulayici';
import { BOLUMLER, bolumGetir } from '../levels/index';
import { bolumMuhurDogrula, bolumMuhurUyumu, MUHUR_METIN_SINIRI, muhurMetni } from './muhur';

const uc = (a: MuhurKosulu, b: MuhurKosulu, c: MuhurKosulu): MuhurKosulu[] => [a, b, c];

describe('mühür üçlüsü kuralları', () => {
  it('aynı ölçüde eşik kademeyle artar', () => {
    const k = (n: number): MuhurKosulu => ({ olcu: 'kafes', kapsam: 'hamle', enAz: n });
    const halka: MuhurKosulu = { olcu: 'halka', kapsam: 'oyun', enAz: 2 };
    expect(bolumMuhurDogrula({ id: 12, renkSayisi: 5, muhurler: uc(k(2), halka, k(3)) })).toEqual([]);
    expect(bolumMuhurDogrula({ id: 12, renkSayisi: 5, muhurler: uc(k(3), halka, k(2)) })).toEqual(["Usta mühürü Çırak'tan zor olmalı (aynı ölçüde eşik artmalı)"]);
    // Süzgeç farklıysa (halkayla R ve süzgeçsiz R) ayrı ölçü sayılır.
    const R = (n: number, ek: Partial<MuhurKosulu> = {}): MuhurKosulu => ({ olcu: 'R', kapsam: 'hamle', enAz: n, ...ek });
    expect(bolumMuhurDogrula({ id: 12, renkSayisi: 5, muhurler: uc(R(12, { halka: true }), halka, R(8, { sans: true })) })).toEqual([]);
  });

  it('süzgeçsiz R ve nesil şansa bağlı işaretlenir; süzgeçli R gerekmez', () => {
    const halka: MuhurKosulu = { olcu: 'halka', kapsam: 'oyun', enAz: 2 };
    const zincir: MuhurKosulu = { olcu: 'zincir', kapsam: 'hamle', enAz: 9 };
    expect(bolumMuhurDogrula({ id: 9, renkSayisi: 5, muhurler: uc(halka, zincir, { olcu: 'nesil', kapsam: 'hamle', enAz: 9 }) })).toEqual(['Usta: süzgeçsiz nesil şansa bağlıdır ("sans": true)']);
    expect(bolumMuhurDogrula({ id: 9, renkSayisi: 5, muhurler: uc(halka, zincir, { olcu: 'R', kapsam: 'hamle', enAz: 9, eylem: 'koruk' }) })).toEqual([]);
  });

  it('aynı metin iki kez olmaz (süzgeç metne yansımıyorsa)', () => {
    const a: MuhurKosulu = { olcu: 'zincir', kapsam: 'hamle', enAz: 9 };
    const b: MuhurKosulu = { olcu: 'zincir', kapsam: 'hamle', enAz: 9, halka: false };
    expect(bolumMuhurDogrula({ id: 9, renkSayisi: 5, muhurler: uc({ olcu: 'halka', kapsam: 'oyun', enAz: 1 }, a, b) })).toContain('aynı metin iki kez');
  });
});

describe('mühür ↔ bölüm içeriği', () => {
  const temel = (ek: Partial<BolumVerisi>): BolumVerisi => ({ ...bolumGetir(8)!, ...ek });

  it('ölçünün nesnesi bölümde yoksa hata', () => {
    const v = temel({
      muhurler: uc({ olcu: 'kafes', kapsam: 'hamle', enAz: 2 }, { olcu: 'koruk', kapsam: 'oyun', enAz: 1 }, { olcu: 'izliDevFisek', kapsam: 'oyun', enAz: 1 }),
    });
    const h = bolumMuhurUyumu(v);
    expect(h).toHaveLength(3);
    expect(h[0]).toContain('kafes yok');
    expect(h[1]).toContain('Körük yok');
    expect(h[2]).toContain('barut izi');
    // Statik doğrulayıcı da aynı hatayı verir.
    expect(bolumDogrula(v).some((x) => x.includes('mühür: Çırak "Tek hamlede 2 kafes kır": bölümde kafes yok'))).toBe(true);
  });

  it('özel taş türü kapalıysa, çapraz yol yoksa, kalan hamle erişilemezse hata', () => {
    const v = temel({
      ozelEsikleri: [6, 9, 0],
      kurallar: { caprazSiniri: 0 },
      muhurler: uc({ olcu: 'olusum', kapsam: 'oyun', enAz: 1, ozel: 'yildiz' }, { olcu: 'caprazRoket', kapsam: 'oyun', enAz: 2 }, { olcu: 'kalanHamle', kapsam: 'son', enAz: 30 }),
    });
    const h = bolumMuhurUyumu(v);
    expect(h).toHaveLength(3);
    expect(h[0]).toContain('zincirle oluşmaz');
    expect(h[1]).toContain('çapraz roket oluşamaz');
    expect(h[2]).toContain('kalan hamle');
    // Sabit çapraz roket varsa çapraz roket mümkün.
    expect(bolumMuhurUyumu({ ...v, sabitKapsuller: [{ x: 0, y: 0, renk: 1, ozel: 'roket', eksen: 3 }] }).some((x) => x.includes('çapraz'))).toBe(false);
  });
});

describe('bölüm verisindeki 105 mühür', () => {
  const muhurlu = BOLUMLER.filter((v) => v.id >= 6 && v.id <= 40);

  it('6–40 her bölümde geçerli, içerikle uyumlu üç mühür; metinler tek satır', () => {
    expect(muhurlu).toHaveLength(35);
    for (const v of muhurlu) {
      expect(bolumMuhurDogrula(v), `bölüm ${v.id}`).toEqual([]);
      expect(bolumMuhurUyumu(v), `bölüm ${v.id}`).toEqual([]);
      for (const k of v.muhurler!) expect(muhurMetni(k).length, `${v.id}: ${muhurMetni(k)}`).toBeLessThanOrEqual(MUHUR_METIN_SINIRI);
    }
  });

  it('genel denge: "kalan hamle" en çok 11 mühürde, şansa bağlı bölüm başına ≤ 1, kısıt mühürü az', () => {
    const tum = muhurlu.flatMap((v) => v.muhurler!);
    expect(tum).toHaveLength(105);
    expect(tum.filter((k) => k.olcu === 'kalanHamle').length).toBeLessThanOrEqual(11);
    expect(tum.filter((k) => k.enCok !== undefined).length).toBeLessThanOrEqual(4);
    // Çırak hiçbir bölümde şansa bağlı değil (ilk mühür ustalıkla değil, bölümün öğesiyle gelir).
    for (const v of muhurlu) expect(v.muhurler![0].sans, `bölüm ${v.id}`).toBeFalsy();
  });
});
