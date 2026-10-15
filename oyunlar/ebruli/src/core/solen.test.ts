import { describe, expect, it } from 'vitest';
import { Baglam } from './baglam';
import { oluysaKaristir } from './karistir';
import { EylemHatasi, ebruSoleni, gecerliHamleVar, gruplariBul, hamleUygula, ustaEliUygula, yildizHesapla } from './index';
import type { BolumVerisi, Olay, OyunDurumu } from './types';
import { bolum, H, kur, tahtaMetni } from './testAraclari';

const tur = <T extends Olay['tur']>(ol: Olay[], t: T) => ol.filter((o) => o.tur === t) as Extract<Olay, { tur: T }>[];

function kazanilmis(kalan: number, satir: string[]): OyunDurumu {
  const d = kur(satir, { hamle: kalan + 1, hedefler: [{ tur: 'topla', renk: 3, adet: 3 }] });
  const r = hamleUygula(d, H(3, 2, 2, 2));
  expect(r.durum.bitti).toBe('kazanc');
  return r.durum;
}

describe('Ebru Şöleni (§8.3)', () => {
  it('kalan hamle başına +300; her biri bir karışık damlayı tarağa çevirip 160·i tikte ateşler', () => {
    const d = kazanilmis(3, ['4 5 4 6 4', '6 4 5 4 4', '3 3 2 1 4']);
    const s = ebruSoleni(d);
    const ol = s.olaylar;
    expect(ol[0]).toEqual({ t: 0, tur: 'solenBasladi', kalanHamle: 3 });
    expect(ol[1]).toEqual({ t: 0, tur: 'puanEklendi', miktar: 900, neden: 'solen' });
    const dn = tur(ol, 'donustu');
    expect(dn).toHaveLength(3);
    expect(dn.map((o) => [o.damla.ozel, o.damla.yon])).toEqual([
      ['tarak', 'yatay'],
      ['tarak', 'dikey'],
      ['tarak', 'yatay'],
    ]);
    for (const o of dn) expect([3, 5, 6]).toContain(o.damla.renk);
    const ilk = tur(ol, 'ozelTetiklendi')[0];
    expect(ilk.t).toBe(160);
    expect(tur(ol, 'temizlendi')[0]).toMatchObject({ t: 160, neden: 'solen', ozel: 'tarak' });
    expect(s.durum).toMatchObject({ kalanHamle: 0, solenYapildi: true, bitti: 'kazanc' });
    expect(s.durum.puan).toBeGreaterThan(d.puan + 900);
    expect(s.durum.gunluk.filter((g) => g.hamle === -1).length).toBeGreaterThan(0);
    expect(ol[ol.length - 1].tur).toBe('hamleOzeti');
    expect(() => ebruSoleni(s.durum)).toThrow(EylemHatasi);
  });

  it('en fazla 15 tarak; karışık yoksa ham damla seçilir; kazanılmadan çağrılamaz', () => {
    const d = kazanilmis(20, ['1 2 1 2', '2 1 2 4', '3 3 2 1']);
    const s = ebruSoleni(d);
    expect(tur(s.olaylar, 'puanEklendi')[0].miktar).toBe(20 * 300);
    expect(tur(s.olaylar, 'donustu').length).toBeLessThanOrEqual(15);
    expect(tur(s.olaylar, 'donustu').length).toBeGreaterThan(0);
    expect(() => ebruSoleni(kur(['1 2 1 2']))).toThrow(EylemHatasi);
  });
});

describe("Usta'nın Eli (§8.4, K16)", () => {
  it('kayıptan +5 hamle, bitti sıfırlanır, en fazla 1★, bir kez', () => {
    const v: BolumVerisi = bolum(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { hamle: 1, hedefler: [{ tur: 'topla', renk: 6, adet: 9 }] });
    const d = hamleUygula(kur(['4 4 4 4', '4 4 4 4', '3 3 2 1'], { hamle: 1, hedefler: [{ tur: 'topla', renk: 6, adet: 9 }] }), H(3, 2, 2, 2)).durum;
    expect(d.bitti).toBe('kayip');
    const u = ustaEliUygula(d);
    expect(u.durum).toMatchObject({ kalanHamle: 5, bitti: null });
    expect(u.durum.istatistik.ustaEli).toBe(true);
    expect(u.olaylar[u.olaylar.length - 1].tur).toBe('hamleOzeti');
    expect(() => ustaEliUygula(u.durum)).toThrow(EylemHatasi);
    expect(yildizHesapla({ ...u.durum, bitti: 'kazanc', puan: 1e9 }, v)).toBe(1);
    expect(() => ustaEliUygula({ ...d, istatistik: { ...d.istatistik, ustaEli: true } })).toThrow(EylemHatasi);
  });
});

describe('ölü tahta ve karıştırma (§4.8)', () => {
  it('Kırmızı ile Sarı yalnız çaprazda: karıştırma geçerli hamle verir, grup doğurmaz', () => {
    const d = kur(['1 3 1 3', '3 2 3 2', '1 3 1 3', '3 2 3 2']);
    expect(gecerliHamleVar(d)).toBe(false);
    const c = new Baglam(d, false, 0);
    expect(oluysaKaristir(c)).toBe(true);
    const k = tur(c.olaylar, 'karistirma');
    expect(k).toHaveLength(1);
    expect(k[0].esleme.length).toBeGreaterThan(0);
    expect(gruplariBul(d)).toEqual([]);
    expect(gecerliHamleVar(d)).toBe(true);
    expect(d.istatistik.karistirma).toBe(1);
  });

  it('karışabilir renk yoksa son çare: komşusuyla karışabilecek ilk damla ham renge boyanır', () => {
    const d = kur(['1 6 1 6', '6 1 6 1', '1 6 1 6', '6 1 6 1']);
    const c = new Baglam(d, false, 0);
    expect(oluysaKaristir(c)).toBe(true);
    expect(c.olaylar.map((o) => o.tur)).toEqual(['karistirma', 'donustu']);
    expect(c.olaylar[1]).toMatchObject({ hucre: { x: 1, y: 0 }, damla: { renk: 2, ozel: 'yok' } });
    expect(tahtaMetni(d)[0]).toBe('1 2 1 6');
    expect(gecerliHamleVar(d)).toBe(true);
  });

  it('canlı tahtada hiçbir şey yapmaz', () => {
    const d = kur(['1 2', '4 4']);
    expect(oluysaKaristir(new Baglam(d, false, 0))).toBe(false);
  });
});
