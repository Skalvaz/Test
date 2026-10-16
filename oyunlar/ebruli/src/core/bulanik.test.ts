/**
 * Özellik / bulanık testleri (GDD §13.4): rastgele bölümlerde rastgele
 * oyunlar (FUZZ_N, varsayılan 300). Her eylemden sonra:
 *  - bir hücre bir adımda (aynı k) iki kez temizlenmez;
 *  - çözümleme sonlanır (kaskat ≤ 50);
 *  - tahta kararlı: dolumsuz yerçekimi bir şey kıpırdatmaz, beslenen boş
 *    hücre kalmaz; tahta grupsuz;
 *  - damla korunur: önce + (doğan + üretilen özel) − (temizlenen +
 *    taşınıp tüketilen + karışımda kaybolan) = sonra; kimlikler eşsiz;
 *  - aynı girdi aynı karma ve olaylar; `hamleUygula` girdiyi değiştirmez
 *    (derin dondurulmuş durum);
 *  - hamle sayacı yalnız geçerli hamlede düşer.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi, ebruSoleni, gruplariBul, hamleHatasi, hamleUygula, ustaEliUygula } from './index';
import type { HamleSonucu, OyunDurumu } from './types';
import { rngInt } from './rng';
import { derinDondur, rastgeleBolum, rastgeleHamle } from './testAraclari';
import { tahtaDizileri, YerTuru } from './yercekimi';
import { durumKopyala } from './tahta';

const N = Number(process.env.FUZZ_N ?? 300);

function damlaSayisi(d: OyunDurumu): number {
  let n = 0;
  for (const c of d.hucreler) if (c.icerik?.tur === 'damla') n++;
  return n;
}

function denetle(once: OyunDurumu, s: HamleSonucu, baglam: string): void {
  const d = s.durum;
  const ol = s.olaylar;
  // Bir hücre bir adımda bir kez.
  const goruldu = new Set<string>();
  let dogan = 0;
  let giden = 0;
  for (const o of ol) {
    if (o.tur === 'temizlendi') {
      const a = `${o.k}|${o.hucre.x},${o.hucre.y}`;
      expect(goruldu.has(a), `${baglam}: ${a} iki kez temizlendi`).toBe(false);
      goruldu.add(a);
      giden++;
    } else if (o.tur === 'yercekimi') dogan += o.doganlar.length;
    else if (o.tur === 'ozelOlustu') dogan++;
    else if (o.tur === 'karisti') giden++;
    else if (o.tur === 'ozelSuruklendi' && o.tasindi) giden++;
  }
  const oz = ol[ol.length - 1];
  expect(oz.tur, baglam).toBe('hamleOzeti');
  if (oz.tur === 'hamleOzeti') expect(oz.kaskat, baglam).toBeLessThanOrEqual(50);
  expect(damlaSayisi(d), `${baglam}: korunum`).toBe(damlaSayisi(once) + dogan - giden);
  // Kararlı ve grupsuz.
  const k = durumKopyala(d);
  expect(new YerTuru(k).dus(), `${baglam}: tahta kararlı değil`).toBe(false);
  const { dolu, besli } = tahtaDizileri(d);
  for (let i = 0; i < besli.length; i++) expect(besli[i] && !dolu[i], `${baglam}: (${i % d.w},${Math.floor(i / d.w)}) beslenen hücre boş`).toBeFalsy();
  expect(gruplariBul(d), baglam).toEqual([]);
  // Kimlikler eşsiz ve sonrakiId'den küçük.
  const idler = new Set<number>();
  for (const c of d.hucreler)
    if (c.icerik?.tur === 'damla') {
      expect(idler.has(c.icerik.damla.id), baglam).toBe(false);
      expect(c.icerik.damla.id).toBeLessThan(d.sonrakiId);
      idler.add(c.icerik.damla.id);
    }
}

describe(`bulanık değişmezler (${N} oyun)`, () => {
  it('hücre bir kez, sonlanma, kararlılık, korunum, belirlenimlilik, saflık', () => {
    let eylem = 0;
    for (let oyun = 0; oyun < N; oyun++) {
      const r = { rng: (oyun * 0x165667b1 + 5) >>> 0 };
      const v = rastgeleBolum(r, 9500 + oyun);
      let d = bolumuYukle(v, oyun % 2);
      expect(gruplariBul(d)).toEqual([]);
      for (let adim = 0; adim < 50; adim++) {
        if (d.bitti === 'kayip' && !d.istatistik.ustaEli && rngInt(r, 3) === 0) d = ustaEliUygula(d).durum;
        if (d.bitti) break;
        const h = rastgeleHamle(d, r);
        if (!h) break;
        const baglam = `oyun ${oyun} adım ${adim} ${JSON.stringify(h)}`;
        const dondur = oyun % 4 === 0;
        const girdi = dondur ? derinDondur(durumKopyala(d)) : d;
        const karma = durumKarmasi(d);
        const s = hamleUygula(girdi, h);
        expect(durumKarmasi(d), `${baglam}: girdi değişti`).toBe(karma);
        if (oyun % 5 === 0) {
          const s2 = hamleUygula(d, h);
          expect(durumKarmasi(s2.durum), baglam).toBe(durumKarmasi(s.durum));
          expect(JSON.stringify(s2.olaylar), baglam).toBe(JSON.stringify(s.olaylar));
        }
        expect(s.durum.kalanHamle, baglam).toBe(d.kalanHamle - 1);
        expect(s.durum.hamleNo, baglam).toBe(d.hamleNo + 1);
        denetle(d, s, baglam);
        // Geçersiz hamle sayacı düşürmez (fırlatır).
        const gecersiz = { tur: 'surukle' as const, kaynak: { x: 0, y: 0 }, hedef: { x: 2, y: 0 } };
        expect(hamleHatasi(s.durum, gecersiz)).not.toBeNull();
        d = s.durum;
        eylem++;
      }
      if (d.bitti === 'kazanc') {
        const f = ebruSoleni(d);
        denetle(d, f, `oyun ${oyun} şölen`);
        expect(f.durum.kalanHamle).toBe(0);
      }
    }
    expect(eylem).toBeGreaterThan(N * 5);
  }, Math.max(60_000, N * 500));
});
