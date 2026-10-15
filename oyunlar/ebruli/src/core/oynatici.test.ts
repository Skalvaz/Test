/**
 * Olay eksiksizliği (GDD §13.2, P1 zorunlu testi): çizici yalnız olaylarla
 * görsel tahtasını güncelleyebilmeli. 300 rastgele oyunda (FUZZ_N ile
 * ölçeklenir) görsel tahta YALNIZ bölüm başındaki durumdan kurulur ve oyun
 * boyunca hiç yeniden eşitlenmeden olaylarla ilerler (hamleler, Usta'nın
 * Eli, Ebru Şöleni). Her eylemden sonra:
 *  - görsel tahta sonraki durumla katman katman aynı (içerik, kimlik, renk,
 *    özel, yön, kâğıt, yağ, desen; puan, hedefler, bitiş);
 *  - katı kip: her olay görsel tahtada önkoşulunu bulur;
 *  - olaylar t'ye göre azalmayan; `hamleOzeti` her eylemin son olayı;
 *  - kalanHamle yalnız geçerli hamlede 1 düşer.
 * Sonunda her olay türünün en az bir kez oynatıldığı denetlenir.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, ebruSoleni, gorselFark, gorselTahtaKur, hamleUygula, olayUygula, ustaEliUygula, SABIT } from './index';
import type { GorselTahta, HamleSonucu, OlayTuru, OyunDurumu } from './index';
import { rngInt } from './rng';
import { rastgeleBolum, rastgeleHamle } from './testAraclari';

const N = Number(process.env.FUZZ_N ?? 300);

const TUM_OLAYLAR: OlayTuru[] = [
  'karisti', 'ozelSuruklendi', 'eslesti', 'temizlendi', 'ozelOlustu', 'ozelTetiklendi', 'birlesim', 'donustu',
  'mermerHasar', 'kagitAlindi', 'yagKalkti', 'desenBoyandi', 'kaskat', 'yercekimi', 'karistirma', 'hedefIlerledi',
  'puanEklendi', 'solenBasladi', 'hamleOzeti', 'bolumBitti',
];

describe(`oynatıcı: ${N} rastgele oyun, görsel tahta yalnız olaylarla`, () => {
  it('her eylemden sonra görsel tahta = sonraki durum; her olay önkoşulunu bulur', () => {
    const gorulen = new Set<OlayTuru>();
    let eylem = 0;
    for (let oyun = 0; oyun < N; oyun++) {
      const r = { rng: (oyun * 0x85ebca6b + 0x1234567) >>> 0 };
      const v = rastgeleBolum(r, 7000 + oyun);
      let d = bolumuYukle(v, rngInt(r, 3));
      const g: GorselTahta = gorselTahtaKur(d);
      let kalanHamle = d.kalanHamle;

      const oynat = (ad: string, sonuc: HamleSonucu, hamleFarki: number | 'sifir'): void => {
        const baglam = `oyun ${oyun} (bölüm ${v.id}) eylem ${eylem} ${ad}`;
        let t = 0;
        for (const o of sonuc.olaylar) {
          gorulen.add(o.tur);
          expect(o.t, `${baglam}: ${o.tur} zamanı geriledi`).toBeGreaterThanOrEqual(t);
          t = o.t;
          try {
            olayUygula(g, o, true);
          } catch (e) {
            throw new Error(`${baglam}: ${(e as Error).message}`);
          }
        }
        expect(gorselFark(g, sonuc.durum), baglam).toEqual([]);
        expect(sonuc.olaylar[sonuc.olaylar.length - 1]?.tur, baglam).toBe('hamleOzeti');
        kalanHamle = hamleFarki === 'sifir' ? 0 : kalanHamle + hamleFarki;
        expect(sonuc.durum.kalanHamle, baglam).toBe(kalanHamle);
        eylem++;
      };

      let ustaEliHakki = true;
      for (let adim = 0; adim < 60; adim++) {
        if (d.bitti === 'kayip' && ustaEliHakki && rngInt(r, 2) === 0) {
          ustaEliHakki = false;
          const u = ustaEliUygula(d);
          // Usta'nın Eli uygulamanın eylemidir (K16): bitişi uygulama sıfırlar.
          g.bitti = null;
          oynat('ustaEli', u, SABIT.USTA_ELI_HAMLE);
          d = u.durum;
        }
        if (d.bitti) break;
        const h = rastgeleHamle(d, r);
        if (!h) break; // yalnız kurtarılamaz ölü tahta (son çare bulunamadı)
        const sonuc = hamleUygula(d, h);
        oynat(JSON.stringify(h), sonuc, -1);
        d = sonuc.durum;
      }
      if (d.bitti === 'kazanc') {
        const f = ebruSoleni(d);
        oynat('şölen', f, 'sifir');
        d = f.durum as OyunDurumu;
      }
    }
    expect(eylem).toBeGreaterThan(N * 5);
    if (N >= 300) expect(TUM_OLAYLAR.filter((t) => !gorulen.has(t))).toEqual([]);
  }, Math.max(60_000, N * 400));
});
