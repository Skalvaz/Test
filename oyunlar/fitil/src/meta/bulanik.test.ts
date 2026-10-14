/**
 * Bulanık test: rastgele bölüm sonuçları dizisinden sonra kayıt her zaman
 * geçerli kalır ve değişmezler korunur. RNG çekirdeğin mulberry32'si
 * (tohumlu, belirlenimli).
 */
import { describe, expect, it } from 'vitest';
import { GUCLENDIRICI_STOK_SINIRI, EN_FAZLA_TAKILI_DESEN } from '../app/katalog';
import { rngInt } from '../core/rng';
import { bolumAcikMi, bolumSonucu } from './ilerleme';
import { acikEnYuksek, kayitKoduCoz, kayitKoduUret, kayitOnar, progressScore, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { ozetBaslat } from './ozet';
import type { OyunOzeti } from './ozet';
import { tarihEkle } from './takvim';
import { bosIst } from './_test/yardimci';

function rastgeleOzet(r: { rng: number }): OyunOzeti {
  const n = (m: number) => rngInt(r, m);
  return {
    ...ozetBaslat(),
    reaksiyonlar: Array.from({ length: n(25) }, () => n(30)),
    renkPatlama: Array.from({ length: 6 }, () => n(40)),
    toplamPatlama: n(300),
    isiPatlamasi: n(60),
    enCokNesil: n(6),
    enBuyukReaksiyon: n(45),
    enUzunZincir: 3 + n(12),
    halka: n(3),
    roketAtesi: n(6),
    kasimpatiAtesi: n(3),
    kombolar: n(8) === 0 ? ['buyukFinal'] : n(4) === 0 ? ['kalinRoket'] : [],
    kafesKirilan: n(8),
    dosemeAydinlanan: n(25),
    kayaYokEdilen: n(10),
    fenerToplanan: n(3),
    korukKullanim: n(3),
    korukEnBuyukR: n(14),
    caprazRoketKafes: n(4),
    caprazRoketEngel: n(4),
    sarVePisir: n(20) === 0,
    izliDevFisek: n(4),
    finalRoket: n(8),
  };
}

describe('bulanık ilerleme', () => {
  for (const tohum of [1, 2, 3, 4, 5, 6]) {
    it(`tohum ${tohum}: 600 rastgele sonuç`, () => {
      const r = { rng: tohum * 7919 };
      let k: Kayit = yeniKayit(tohum);
      let gun = 20261001;
      let oncekiPuan = progressScore(k);
      for (let i = 0; i < 600; i++) {
        if (rngInt(r, 4) === 0) gun = tarihEkle(gun, 1 + (rngInt(r, 5) === 0 ? rngInt(r, 4) : 0));
        const acik = acikEnYuksek(k);
        // Çoğunlukla sıradaki bölüm, bazen tekrar, bazen günlük/Usta
        const secim = rngInt(r, 10);
        let id = secim < 6 ? acik : secim < 8 ? 1 + rngInt(r, acik) : secim < 9 ? gun : 101 + rngInt(r, 8);
        if (!bolumAcikMi(k, id, gun)) id = acik;
        const kazandi = rngInt(r, 3) !== 0;
        const ist = bosIst({ guclendirici: rngInt(r, 6) === 0 ? 1 : 0, ustaEli: rngInt(r, 15) === 0 });
        const once = JSON.stringify(k);
        const sonuc = bolumSonucu(k, {
          bolumId: id,
          kazandi,
          puan: rngInt(r, 9000),
          yildiz: 1 + rngInt(r, 3),
          istatistik: ist,
          olaylarOzeti: rastgeleOzet(r),
          tarih: gun,
          kalanHamle: rngInt(r, 15),
          toplamHamle: 22,
          deneme: rngInt(r, 3) === 0 ? rngInt(r, 4) : undefined,
        });
        expect(JSON.stringify(k)).toBe(once); // girdi değişmez
        k = sonuc.kayit;
        // Geçerlilik: onarım hiçbir şey bulmaz
        const onarim = kayitOnar(JSON.parse(JSON.stringify(k)));
        if (onarim.onarilan.length) throw new Error(`adım ${i}: onarılan ${onarim.onarilan.join(', ')}`);
        // Değişmezler
        for (const v of Object.values(k.guclendiriciler)) expect(v).toBeLessThanOrEqual(GUCLENDIRICI_STOK_SINIRI);
        expect(k.koleksiyon.takili.length).toBeLessThanOrEqual(EN_FAZLA_TAKILI_DESEN);
        expect(k.toz).toBeGreaterThanOrEqual(0);
        expect(k.sandik.parcasizSeri).toBeLessThanOrEqual(3);
        expect(new Set(k.koleksiyon.parcalar).size).toBe(k.koleksiyon.parcalar.length);
        const p = progressScore(k);
        expect(p).toBeGreaterThanOrEqual(oncekiPuan); // ilerleme geri gitmez
        oncekiPuan = p;
        for (const b of Object.values(k.bolumler)) {
          expect(b.deneme).toBeGreaterThanOrEqual(b.kazanc);
          if (b.yildiz > 0) expect(b.kazanc).toBeGreaterThan(0);
        }
      }
      // Kayıt kodu gidiş-dönüş
      const kod = kayitKoduCoz(kayitKoduUret(k));
      expect(kod.tamam && kod.kayit).toEqual(k);
    });
  }
});
