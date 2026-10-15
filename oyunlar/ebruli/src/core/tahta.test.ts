import { describe, expect, it } from 'vitest';
import { bosHucre, durumKopyala, gecerliHamleVar, gruplariBul } from './tahta';
import { bolumuYukle } from './bolumYukle';
import type { BolumVerisi, Damla, Hucre, OyunDurumu, OzelTur, Renk } from './types';
import b001 from '../levels/veri/b001.json';

/** Küçük tahta kurucu: simgeler renk kodu, `.` boş, `T5` tarak (renk 5), `L` lale, `X` mermer. */
function kur(satirlar: string[], murekkep = false): Pick<OyunDurumu, 'w' | 'h' | 'hucreler' | 'kurallar'> {
  const h = satirlar.length;
  const w = satirlar[0].split(' ').length;
  const hucreler: Hucre[] = [];
  let id = 1;
  for (const s of satirlar)
    for (const t of s.split(' ')) {
      const c = bosHucre();
      const dm = (renk: Renk | 0, ozel: OzelTur = 'yok'): Damla => ({ id: id++, renk, ozel, yon: 'yatay' });
      if (t === '.') c.icerik = null;
      else if (t === 'X') c.icerik = { tur: 'mermer', can: 1 };
      else if (t === 'L') c.icerik = { tur: 'damla', damla: dm(0, 'lale') };
      else if (t[0] === 'T') c.icerik = { tur: 'damla', damla: dm(Number(t[1]) as Renk, 'tarak') };
      else if (t[0] === 'G') c.icerik = { tur: 'damla', damla: dm(Number(t[1]) as Renk, 'girdap') };
      else c.icerik = { tur: 'damla', damla: dm(Number(t) as Renk, Number(t) === 7 ? 'murekkep' : 'yok') };
      hucreler.push(c);
    }
  return { w, h, hucreler, kurallar: { murekkep, garanti: 2, ozelEsikleri: [4, 5, 6] } };
}

describe('gruplariBul (§4.3)', () => {
  it('yalnız karışık renkler, 4 komşuluk, en az 3', () => {
    const d = kur(['1 1 1 .', '3 3 . 5', '3 . 5 5', '2 3 . 5']);
    expect(gruplariBul(d)).toEqual([
      { renk: 3, hucreler: [4, 5, 8] },
      { renk: 5, hucreler: [7, 10, 11, 15] },
    ]);
  });

  it('çapraz bağlantı saymaz', () => {
    expect(gruplariBul(kur(['3 . .', '. 3 .', '. . 3']))).toEqual([]);
  });

  it('Tarak/Girdap kendi rengine katılır; Lale ve Mürekkep katılmaz', () => {
    expect(gruplariBul(kur(['6 T6 G6']))).toEqual([{ renk: 6, hucreler: [0, 1, 2] }]);
    expect(gruplariBul(kur(['6 L 6 6']))).toEqual([]);
    expect(gruplariBul(kur(['5 7 5 5']))).toEqual([]);
  });
});

describe('gecerliHamleVar (§4.8)', () => {
  it('iki farklı ham komşu → var', () => {
    expect(gecerliHamleVar(kur(['1 2']))).toBe(true);
  });
  it('aynı renkler, karışık + karışık, mermer arası → yok', () => {
    expect(gecerliHamleVar(kur(['1 1', '1 1']))).toBe(false);
    expect(gecerliHamleVar(kur(['3 5', '6 3']))).toBe(false);
    expect(gecerliHamleVar(kur(['1 X 2']))).toBe(false);
  });
  it('karışık + eksik ham yalnız Mürekkep açıkken', () => {
    expect(gecerliHamleVar(kur(['3 4'], false))).toBe(false);
    expect(gecerliHamleVar(kur(['3 4'], true))).toBe(true);
  });
  it('özel taşa dokunan komşu her zaman geçerli (K9)', () => {
    expect(gecerliHamleVar(kur(['1 L']))).toBe(true);
    expect(gecerliHamleVar(kur(['3 7']))).toBe(true);
  });
  it('yağlı hücredeki damla sayılmaz (§6.3)', () => {
    const d = kur(['1 2']);
    d.hucreler[0].yag = true;
    expect(gecerliHamleVar(d)).toBe(false);
  });
});

describe('durumKopyala', () => {
  it('derin kopya: kopyayı değiştirmek aslını değiştirmez', () => {
    const d = bolumuYukle(b001 as unknown as BolumVerisi, 0);
    const k = durumKopyala(d);
    const ic = k.hucreler[0].icerik;
    if (ic?.tur === 'damla') ic.damla.renk = 7;
    k.hedefler[0].ilerleme = 5;
    k.kurallar.ozelEsikleri[0] = 9;
    expect(JSON.stringify(d)).not.toBe(JSON.stringify(k));
    expect(d.hedefler[0].ilerleme).toBe(0);
    expect(d.kurallar.ozelEsikleri[0]).toBe(4);
    const asil = d.hucreler[0].icerik;
    expect(asil?.tur === 'damla' && asil.damla.renk).not.toBe(7);
  });
});
