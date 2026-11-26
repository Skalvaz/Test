/** Hangar: kayıt, açma, geliştirme ve donanımın simülasyondaki etkisi. */
import { describe, expect, it } from 'vitest';
import { Dunya, M_AAM, M_ATGM, M_ROKET, VARSAYILAN_DONANIM } from './dunya';
import { HELILER, bosKayit, donanimKur, heliAc, heliSec, kazanc, kayitOku, modAl } from './hangar';
import { M_OBOMBA } from './dunya';

const ADIM = 1 / 60;

describe('hangar', () => {
  it('keşif helikopteriyle başlanır; geliştirme AP ister ve donanımı değiştirir', () => {
    const k = bosKayit();
    expect(k.secili).toBe('kesif');
    const d0 = donanimKur(k);
    expect(d0.roket).toBe(0);
    expect(d0.can).toBeLessThan(VARSAYILAN_DONANIM.can);
    expect(modAl(k, 'roket')).toBe(false); // AP yok
    k.ap = 1000;
    expect(modAl(k, 'roket')).toBe(true);
    expect(modAl(k, 'roket')).toBe(false); // ikinci kez alınmaz
    expect(k.ap).toBe(750);
    expect(modAl(k, 'zirh')).toBe(true);
    const d1 = donanimKur(k);
    expect(d1.roket).toBeGreaterThan(0);
    expect(d1.can).toBe(d0.can + 20);
    expect(d1.zirh).toBeGreaterThan(0);
    // Taban tanım değişmez (her kurulum kopyadan başlar)
    expect(HELILER[0].taban.roket).toBe(0);
  });

  it('helikopter açma: bedeli ödenir, seçilir; yakında olanlar açılamaz', () => {
    const k = bosKayit();
    k.ap = 3400;
    expect(heliAc(k, 'agir')).toBe(false);
    k.ap = 4000;
    expect(heliAc(k, 'hafif')).toBe(false);
    expect(heliAc(k, 'jet')).toBe(false); // AP yetmez
    expect(heliAc(k, 'agir')).toBe(true);
    expect(k.ap).toBe(500);
    expect(k.secili).toBe('agir');
    expect(donanimKur(k)).toEqual(VARSAYILAN_DONANIM); // geliştirmesiz ağır saldırı = eski denge
    expect(heliSec(k, 'kesif')).toBe(true);
    expect(donanimKur(k).tur).toBe(0);
    expect(kazanc(4000)).toBe(500);
  });

  it('keşif roket atmaz; roket yuvası alınınca atar', () => {
    for (const roketli of [false, true]) {
      const k = bosKayit();
      k.ap = 999;
      if (roketli) modAl(k, 'roket');
      const d = new Dunya(566, 71, donanimKur(k));
      d.basla();
      d.ara = 999;
      d.heli.x = d.heli.hx = 640;
      d.araclar.push({ tip: 3, x: 720, y: d.zemin, can: 12, enCan: 12, dur: 720, sayac: 99, nisanT: 0, namlu: 0.2, yuk: 0, t: 0, sars: 0, engelli: false });
      let roket = 0;
      for (let i = 0; i < 4 / ADIM; i++) {
        d.heli.can = 60;
        d.adim(ADIM);
        roket = Math.max(roket, d.mermiler.filter((m) => m.tip === M_ROKET).length);
      }
      expect(roket > 0).toBe(roketli);
      // Minigun tanka işlemez
      if (!roketli) expect(d.araclar[0].can).toBeGreaterThan(10);
    }
  });

  it('tanksavar füze tankı tek atar; hava füzesi düşman helikopterini düşürür', () => {
    const k = bosKayit();
    k.ap = 99999;
    heliAc(k, 'agir');
    modAl(k, 'atgm');
    modAl(k, 'aam');
    const dn = donanimKur(k);
    expect(dn.atgm && dn.aam).toBe(true);
    const d = new Dunya(566, 72, dn);
    d.basla();
    d.ara = 999;
    d.binalar.length = 0; // füze yolda binaya çarpmasın
    d.heli.x = d.heli.hx = 640;
    d.heli.y = d.heli.hy = d.zemin - 120;
    d.heli.roket = 99; // yalnız füzeleri ölçelim
    d.araclar.push({ tip: 3, x: 800, y: d.yerY(800), can: 12, enCan: 12, dur: 800, sayac: 99, nisanT: 0, namlu: 0.2, yuk: 0, t: 0, sars: 0, engelli: false });
    d.havalar.push({ tip: 5, x: 820, y: d.zemin - 150, vx: 0, vy: 0, can: 9, dusuyor: false, t: 0, yon: -1, aci: 0, sayac: 99, seri: 0, birakX: 0, yuk: 0 });
    let atgm = 0;
    let aam = 0;
    for (let i = 0; i < 4 / ADIM; i++) {
      d.heli.can = 100;
      d.heli.roket = 99;
      d.heli.top = 99;
      d.adim(ADIM);
      atgm = Math.max(atgm, d.mermiler.filter((m) => m.tip === M_ATGM).length);
      aam = Math.max(aam, d.mermiler.filter((m) => m.tip === M_AAM).length);
    }
    expect(atgm).toBeGreaterThan(0);
    expect(aam).toBeGreaterThan(0);
    expect(d.olu.arac).toBe(1);
    expect(d.olu.hava).toBe(1);
  });

  it('dikey kalkışlı jet: hızlı, ince zırhlı, bol bombalı; salkım üç bomba bırakır', () => {
    const k = bosKayit();
    k.ap = 99999;
    expect(heliAc(k, 'jet')).toBe(true);
    const cip = donanimKur(k);
    expect(cip.tur).toBe(2);
    expect(cip.hiz).toBeGreaterThan(VARSAYILAN_DONANIM.hiz);
    expect(cip.can).toBeLessThan(VARSAYILAN_DONANIM.can);
    expect(cip.bomba).toBeGreaterThan(VARSAYILAN_DONANIM.bomba);
    for (const salkim of [false, true]) {
      if (salkim) expect(modAl(k, 'salkim')).toBe(true);
      const d = new Dunya(566, 73, donanimKur(k));
      d.basla();
      d.ara = 999;
      expect(d.bombaBirak()).toBe(true);
      expect(d.mermiler.filter((m) => m.tip === M_OBOMBA).length).toBe(salkim ? 3 : 1);
      expect(d.bomba.adet).toBe(5);
    }
  });

  it('eski kayıt (jet eklenmeden önce yazılmış) bozulmadan okunur', () => {
    const depo = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (a: string) => depo.get(a) ?? null,
      setItem: (a: string, v: string) => void depo.set(a, v),
    };
    depo.set('barut.hangar.v1', JSON.stringify({ ap: 1234, sahip: ['kesif', 'agir'], secili: 'agir', mod: { agir: ['atgm', 'zirh'], kesif: ['roket'] } }));
    const k = kayitOku();
    expect(k.ap).toBe(1234);
    expect(k.sahip).toEqual(['kesif', 'agir']);
    expect(k.secili).toBe('agir');
    expect(k.mod.agir).toEqual(['atgm', 'zirh']);
    const dn = donanimKur(k);
    expect(dn.atgm).toBe(true);
    expect(dn.can).toBe(130);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
