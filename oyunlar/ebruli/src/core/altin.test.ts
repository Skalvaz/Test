/**
 * Altın tekrarlar (GDD §13.4): (bölüm, deneme, hamle dizisi) → beklenen
 * `durumKarmasi` dizisi ve olay listesi anlık görüntüsü. Hamleler
 * belirlenimli seçicilerle üretilir. Bir kural bilerek değiştiğinde
 * `npx vitest run -u` ile güncellenir ve fark gözden geçirilir.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, durumKarmasi, ebruSoleni, hamleUygula, olumluHamleler } from './index';
import type { BolumVerisi, Hamle, Olay, OyunDurumu } from './types';
import { ilkHamle, rastgeleBolum } from './testAraclari';
import b001 from '../levels/veri/b001.json';

function ozet(o: Olay): string {
  const { t, tur, ...geri } = o as Olay & Record<string, unknown>;
  return `${t} ${tur} ${JSON.stringify(geri)}`;
}

function tekrar(v: BolumVerisi, denemeNo: number, sec: (d: OyunDurumu) => Hamle | null, ilk?: Hamle): { karmalar: number[]; olaylar: string[][]; son: OyunDurumu } {
  let d = bolumuYukle(v, denemeNo);
  const karmalar = [durumKarmasi(d)];
  const olaylar: string[][] = [];
  for (let k = 0; k < v.hamle + 5 && !d.bitti; k++) {
    const h = k === 0 && ilk ? ilk : sec(d);
    if (!h) break;
    const r = hamleUygula(d, h);
    karmalar.push(durumKarmasi(r.durum));
    olaylar.push([JSON.stringify(h), ...r.olaylar.map(ozet)]);
    d = r.durum;
  }
  if (d.bitti === 'kazanc') {
    const f = ebruSoleni(d);
    karmalar.push(durumKarmasi(f.durum));
    olaylar.push(['şölen', ...f.olaylar.map(ozet)]);
    d = f.durum;
  }
  return { karmalar, olaylar, son: d };
}

const enIyiHazir = (d: OyunDurumu): Hamle | null => olumluHamleler(d)[0]?.hamle ?? ilkHamle(d);

describe('altın tekrarlar', () => {
  it('bölüm 1 (İlk Damla), deneme 0: zorunlu ilk hamle + en iyi hazır hamle seçicisi', () => {
    const v = b001 as unknown as BolumVerisi;
    const z = v.zorunluIlkHamle!;
    const ilk: Hamle = { tur: 'surukle', kaynak: { x: z.kaynak[0], y: z.kaynak[1] }, hedef: { x: z.hedef[0], y: z.hedef[1] } };
    const a = tekrar(v, 0, enIyiHazir, ilk);
    // Zorunlu ilk hamle Turuncu üçlüsünü temizler (§12.1 adım 3).
    expect(a.olaylar[0].filter((s) => s.includes(' eslesti ')).length).toBeGreaterThanOrEqual(1);
    expect(a.son.bitti).toBe('kazanc');
    expect(a).toMatchSnapshot();
    // Aynı girdi, aynı tekrar.
    expect(tekrar(v, 0, enIyiHazir, ilk).karmalar).toEqual(a.karmalar);
  });

  it('bölüm 1, deneme 1: ilk tahta aynı, dolum farklı', () => {
    const v = b001 as unknown as BolumVerisi;
    const a = tekrar(v, 1, enIyiHazir);
    expect(a.karmalar[0]).not.toBe(tekrar(v, 0, enIyiHazir).karmalar[0]); // rng farklı
    expect(a.karmalar).toMatchSnapshot();
  });

  it('rastgele 7×9 engelli bölüm, ilk geçerli hamle seçicisi', () => {
    const r = { rng: 424242 };
    let v = rastgeleBolum(r, 4242);
    v = { ...v, hamle: 15 };
    const a = tekrar(v, 0, ilkHamle);
    expect(a.karmalar).toMatchSnapshot();
    expect(a.olaylar.slice(0, 4)).toMatchSnapshot();
  });
});
