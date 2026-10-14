/**
 * Altın tekrarlar (§16.4): (bölüm, deneme, hamle dizisi) → beklenen
 * `durumKarmasi` ve olay listesi anlık görüntüsü. Hamleler belirlenimli
 * seçiciyle (`ilkHamle`) üretilir. Bir kural bilerek değiştiğinde
 * `npx vitest run -u` ile güncellenir ve fark gözden geçirilir.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from './bolumYukle';
import { finalGosterisi } from './final';
import { hamleUygula } from './hamle';
import { durumKarmasi } from './index';
import { ilkHamle, rastgeleBolum } from './testAraclari';
import type { BolumVerisi, Olay } from './types';
import b001 from '../levels/veri/b001.json';

function ozet(o: Olay): string {
  const { t, tur, ...geri } = o as Olay & Record<string, unknown>;
  return `${t} ${tur} ${JSON.stringify(geri)}`;
}

function tekrar(v: BolumVerisi, denemeNo: number, enFazla: number): { karmalar: number[]; olaylar: string[][] } {
  let d = bolumuYukle(v, denemeNo);
  const karmalar = [durumKarmasi(d)];
  const olaylar: string[][] = [];
  for (let k = 0; k < enFazla && !d.bitti; k++) {
    const h = ilkHamle(d);
    if (!h) break;
    const r = hamleUygula(d, h);
    karmalar.push(durumKarmasi(r.durum));
    olaylar.push([JSON.stringify(h), ...r.olaylar.map(ozet)]);
    d = r.durum;
  }
  if (d.bitti === 'kazanc') {
    const f = finalGosterisi(d);
    karmalar.push(durumKarmasi(f.durum));
    olaylar.push(['final', ...f.olaylar.map(ozet)]);
  }
  return { karmalar, olaylar };
}

describe('altın tekrarlar', () => {
  it('bölüm 1 (İlk Kıvılcım), deneme 0: öğretici hamle + belirlenimli seçici', () => {
    const v = b001 as unknown as BolumVerisi;
    let d = bolumuYukle(v, 0);
    const ilk = hamleUygula(d, { tur: 'fitil', yol: [0, 1, 2, 3].map((x) => ({ x, y: 5 })), halka: false });
    // §15: A³ (1,4), (1,5) patlayınca 90 tik sonra kendiliğinden patlar.
    expect(ilk.olaylar.find((o) => o.tur === 'patlama' && o.neden === 'isi')).toMatchObject({ t: 193, hucre: { x: 1, y: 4 }, nesil: 1 });
    d = ilk.durum;
    const sonra = tekrar({ ...v }, 0, 0);
    expect(sonra.karmalar[0]).toBe(durumKarmasi(bolumuYukle(v, 0)));
    const karmalar = [durumKarmasi(d)];
    const olaylar = [ilk.olaylar.map(ozet)];
    for (let k = 0; k < 11 && !d.bitti; k++) {
      const h = ilkHamle(d);
      if (!h) break;
      const r = hamleUygula(d, h);
      karmalar.push(durumKarmasi(r.durum));
      olaylar.push([JSON.stringify(h), ...r.olaylar.map(ozet)]);
      d = r.durum;
    }
    expect({ karmalar, bitti: d.bitti, puan: d.puan }).toMatchSnapshot('karmalar');
    expect(olaylar).toMatchSnapshot('olaylar');
  });

  it('bölüm 1, deneme 1: aynı ilk tahta, farklı dolum', () => {
    const v = b001 as unknown as BolumVerisi;
    const a = tekrar(v, 0, 3);
    const b = tekrar(v, 1, 3);
    expect(a.karmalar[0]).not.toBe(b.karmalar[0]); // rng farklı
    expect(b.karmalar).toMatchSnapshot();
  });

  it.each([11, 23, 47])('karışık öğeli sentetik bölüm (tohum %i)', (tohum) => {
    const v = rastgeleBolum({ rng: tohum }, 7000 + tohum);
    const s = tekrar(v, 0, 12);
    expect(s.karmalar).toMatchSnapshot('karmalar');
    expect(s.olaylar).toMatchSnapshot('olaylar');
    // Aynı girdi aynı sonuç.
    expect(tekrar(v, 0, 12).karmalar).toEqual(s.karmalar);
  });
});
