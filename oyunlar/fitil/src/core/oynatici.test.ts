/**
 * Olay eksiksizliği (§16.1, §12.4): çizici yalnız olaylarla görsel tahtasını
 * güncelleyebilmeli. 300 rastgele oyunda (FUZZ_N ile ölçeklenir) görsel
 * tahta YALNIZ bölüm başındaki durumdan kurulur ve oyun boyunca hiç yeniden
 * eşitlenmeden yalnız olaylarla ilerler (fitil, çift dokunuş, körük, kibrit,
 * kalıp, Usta'nın Eli, Final Gösterisi). Her eylemden sonra:
 *  - görsel tahta sonraki durumla katman katman aynı (içerik, ısı, özel,
 *    eksen, kafes, döşeme, desen, iz, ışık izi; puan, körük, hedefler);
 *  - katı kip: her olay görsel tahtada önkoşulunu bulur (patlayan hücrede
 *    aynı renk/özel kapsül, hasar alan kayanın katı, düşen taş, …);
 *  - ısı patlaması, eşiği geçiren `isindi`den tam 90 tik sonra gelir (§3.5.2);
 *  - eylem sonunda hiçbir kapsülün ısısı eşikte değil, hiçbir dev fişek dolu
 *    beklemiyor (bekleyen patlama kalmadı), kafes yalnız kapsül üstünde;
 *  - bitmemiş tahtada her zaman geçerli bir hamle bulunur (kilitliMi +
 *    karıştırma; `caprazSiniri` açığı bununla yakalandı);
 *  - `reaksiyon` her eylemin son olayı.
 * Sonunda her olay türünün en az bir kez oynatıldığı denetlenir.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, finalGosterisi, gorselFark, gorselTahtaKur, hamleUygula, olayUygula, ustaEliUygula } from './index';
import type { GorselTahta, Hamle, Olay, OlayTuru, OyunDurumu } from './index';
import { rngInt } from './rng';
import { SABIT } from './index';
import { rastgeleBolum, rastgeleHamle } from './testAraclari';

const N = Number(process.env.FUZZ_N ?? 300);

const TUM_OLAYLAR: OlayTuru[] = [
  'fitilBasladi', 'dugumYandi', 'patlama', 'isindi', 'isiDegisti', 'ozelOlustu', 'ozelTetiklendi', 'yuklendi',
  'kombinasyon', 'isiDalgasi', 'engelHasar', 'kafesKirildi', 'kurudu', 'dosemeAydinlandi', 'desenBoyandi',
  'izYandi', 'devFisekDoldu', 'devFisekFirladi', 'isTemizlendi', 'isYayildi', 'yercekimi', 'fenerToplandi',
  'havaOlayi', 'karistirma', 'hedefIlerledi', 'puanEklendi', 'korukDoldu', 'korukKullanildi', 'guclendirici',
  'finalBasladi', 'reaksiyon', 'bolumBitti',
];

/** Eylem sonu değişmezleri (bekleyen patlama yok). */
function eylemSonu(d: OyunDurumu): string | null {
  for (let i = 0; i < d.hucreler.length; i++) {
    const h = d.hucreler[i];
    const ic = h.icerik;
    if (h.kafes && ic?.tur !== 'kapsul') return `(${i % d.w},${Math.floor(i / d.w)}) kafes kapsülsüz`;
    if (ic?.tur === 'kapsul' && ic.isi >= d.esik) return `(${i % d.w},${Math.floor(i / d.w)}) ısı ${ic.isi} ≥ eşik ${d.esik}`;
    if (ic?.tur === 'devFisek' && ic.dolum >= ic.kapasite) return `(${i % d.w},${Math.floor(i / d.w)}) dev fişek dolu bekliyor`;
  }
  return null;
}

/** ISI patlaması, aynı hücreyi eşiğe taşıyan `isindi`den ISI_GECIKME sonra (§3.5.2). */
function isiZamanlari(olaylar: readonly Olay[], esik: number): string | null {
  const esikAni = new Map<string, number>();
  for (const o of olaylar) {
    if (o.tur === 'yercekimi') esikAni.clear(); // final turları: bayraklar yenilenir
    if (o.tur === 'isindi' && o.isi >= esik) esikAni.set(`${o.hucre.x},${o.hucre.y}`, o.t);
    if (o.tur === 'patlama' && o.neden === 'isi') {
      const t0 = esikAni.get(`${o.hucre.x},${o.hucre.y}`);
      if (t0 === undefined || o.t !== t0 + SABIT.ISI_GECIKME) return `(${o.hucre.x},${o.hucre.y}) ısı patlaması t=${o.t}, eşik anı ${t0}`;
    }
  }
  return null;
}

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

      const oynat = (ad: string, onceki: OyunDurumu, sonuc: { durum: OyunDurumu; olaylar: Olay[] }, hamleFarki: number | 'sifir'): void => {
        const baglam = `oyun ${oyun} (bölüm ${v.id}) eylem ${eylem} ${ad}`;
        for (const o of sonuc.olaylar) {
          gorulen.add(o.tur);
          try {
            olayUygula(g, o, true);
          } catch (e) {
            throw new Error(`${baglam}: ${(e as Error).message}`);
          }
        }
        expect(gorselFark(g, sonuc.durum), baglam).toEqual([]);
        // README: `reaksiyon` her eylemin son olayıdır (Usta'nın Eli hariç).
        if (ad !== 'ustaEli') expect(sonuc.olaylar[sonuc.olaylar.length - 1]?.tur, baglam).toBe('reaksiyon');
        kalanHamle = hamleFarki === 'sifir' ? 0 : kalanHamle + hamleFarki;
        expect(sonuc.durum.kalanHamle, baglam).toBe(kalanHamle);
        expect(eylemSonu(sonuc.durum), baglam).toBeNull();
        expect(isiZamanlari(sonuc.olaylar, onceki.esik), baglam).toBeNull();
        eylem++;
      };

      let ustaEliHakki = true;
      for (let adim = 0; adim < 50; adim++) {
        if (d.bitti === 'kayip' && ustaEliHakki && !d.istatistik.ustaEli && rngInt(r, 2) === 0) {
          ustaEliHakki = false;
          const u = ustaEliUygula(d);
          // Usta'nın Eli uygulamanın eylemidir (K16): bitişi uygulama sıfırlar,
          // tahta değişikliği (karıştırma) olaylarla gelir.
          g.bitti = null;
          oynat('ustaEli', d, u, SABIT.USTA_ELI_HAMLE);
          d = u.durum;
        }
        if (d.bitti) break;
        const h: Hamle | null = rastgeleHamle(d, r);
        // Bitmemiş tahta kilitsizdir (§3.4, §3.8): her zaman geçerli bir hamle bulunur.
        expect(h, `oyun ${oyun} adım ${adim}: kilitsiz tahtada hamle yok`).not.toBeNull();
        if (!h) break;
        const sonuc = hamleUygula(d, h);
        oynat(JSON.stringify(h), d, sonuc, h.tur === 'fitil' || h.tur === 'ciftDokunus' ? -1 : 0);
        d = sonuc.durum;
      }
      if (d.bitti === 'kazanc') {
        const f = finalGosterisi(d);
        oynat('final', d, f, 'sifir');
      }
    }
    expect(eylem).toBeGreaterThan(N * 5);
    if (N >= 300) expect(TUM_OLAYLAR.filter((t) => !gorulen.has(t))).toEqual([]);
  }, Math.max(60_000, N * 150));
});
