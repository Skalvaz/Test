/**
 * Kasaba süsleri (docs/KANCALAR.md §B.6): 48 işin çizimi, canlı öğe bütçesi,
 * hayalet, kutlama katmanı, çapa ve sancak.
 */
import { describe, expect, it } from 'vitest';
import { KASABA_ISLERI, MAHALLELER } from '../../app/katalog';
import type { BolumDugumuVM, Yildiz } from '../tipler';
import { BOLGE_H, HARITA_H, bolgeCiz, bolgeGeo, bolgeUst } from './cizim';
import { CIZIMLER } from './isCizimleri';
import { isCapasi, mahalleSusleri } from './susler';

const HEPSI = new Set(KASABA_ISLERI.map((x) => x.id));
const bos = new Set<string>();

function bolumler(simdiki: number, yildiz: Yildiz = 3, sancak = false): BolumDugumuVM[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    yildiz: i + 1 < simdiki ? yildiz : 0,
    durum: i + 1 < simdiki ? 'acik' : i + 1 === simdiki ? 'simdiki' : 'kilitli',
    ...(i + 1 >= 6 ? { muhur: sancak ? 3 : 1, sancak } : {}),
  }));
}

describe('kasaba süsleri', () => {
  it('48 işin her birinin çizimi var; yapılınca durağan parça ya da canlı öğe üretir', () => {
    for (const is of KASABA_ISLERI) {
      expect(CIZIMLER[is.id], is.id).toBeTypeOf('function');
      const s = mahalleSusleri(bolgeGeo(is.mahalle), { yapilan: new Set([is.id]), hayalet: false, yeni: bos });
      const svg = (['arka', 0, 1, 2, 3, 4, 'on'] as const).map((k) => s.katman(k)).join('');
      // İskele tabelası HTML tabelaya ampul takar (harita.ts), SVG'si yoktur.
      if (is.id !== 'iskele.tabela') expect(svg.length + s.canli.length, is.id).toBeGreaterThan(0);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      for (const o of s.canli) {
        expect(Number.isFinite(o.x) && Number.isFinite(o.y) && o.w > 0 && o.h > 0, `${is.id} ${o.tur}`).toBe(true);
        expect(o.ic).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('canlı öğe bütçesi: mahalle başına en çok 6, iş başına 1 (iki değirmen 2)', () => {
    for (let m = 0; m < MAHALLELER.length; m++) {
      const s = mahalleSusleri(bolgeGeo(m), { yapilan: HEPSI, hayalet: false, yeni: bos });
      expect(s.canli.length, MAHALLELER[m].id).toBeLessThanOrEqual(6);
      const isBasina = new Map<string, number>();
      for (const o of s.canli) isBasina.set(o.sahip, (isBasina.get(o.sahip) ?? 0) + 1);
      for (const [id, n] of isBasina) expect(n, id).toBeLessThanOrEqual(id === 'tepe.degirmenKanatlari' ? 2 : 1);
    }
  });

  it('hayalet: yapılmamış işler sönük durağan çizilir, canlı öğe yok', () => {
    const s = mahalleSusleri(bolgeGeo(0), { yapilan: bos, hayalet: true, yeni: bos });
    const svg = (['arka', 0, 1, 2, 3, 4, 'on'] as const).map((k) => s.katman(k)).join('');
    expect(svg).toContain('f-sus-hayalet');
    expect(svg).not.toContain('f-sl');
    expect(s.canli).toHaveLength(0);
    expect(mahalleSusleri(bolgeGeo(0), { yapilan: bos, hayalet: false, yeni: bos }).katman(1)).toBe('');
  });

  it('kutlama: yeni iş durağan katmana değil kutlama çizimine gider, ışıkları sıralıdır', () => {
    const id = 'iskele.fenerDizisi';
    const eski = mahalleSusleri(bolgeGeo(0), { yapilan: new Set([id]), hayalet: false, yeni: bos });
    const yeni = mahalleSusleri(bolgeGeo(0), { yapilan: new Set([id]), hayalet: false, yeni: new Set([id]) });
    expect(eski.kutla).toHaveLength(0);
    expect(yeni.kutla).toHaveLength(1);
    expect(yeni.kutla[0]).toMatchObject({ id });
    expect(yeni.kutla[0].isik).toBeGreaterThanOrEqual(6);
    expect(yeni.kutla[0].svg).toContain('class="f-sl"');
    expect(yeni.katman(1)).toBe('');
    expect(eski.katman(1)).not.toBe('');
    // Canlı öğe yine üretilir (kutlamada sırası gelince belirir).
    expect(yeni.canli.map((o) => o.sahip)).toEqual([id]);
  });

  it('çapa mahallenin içinde ve katalogdaki `yer` ile aynı (İskele tabelası alt payda)', () => {
    for (const is of KASABA_ISLERI) {
      const g = bolgeGeo(is.mahalle);
      const c = isCapasi(is.id, g)!;
      expect(Math.abs(c.x - is.yer.x), is.id).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - g.ust - is.yer.y), is.id).toBeLessThanOrEqual(1);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(400);
      if (is.id === 'iskele.tabela') expect(c.y).toBeGreaterThan(bolgeUst(0) + BOLGE_H);
      else {
        expect(c.y, is.id).toBeGreaterThanOrEqual(bolgeUst(is.mahalle));
        expect(c.y, is.id).toBeLessThanOrEqual(bolgeUst(is.mahalle) + BOLGE_H);
      }
      expect(c.y).toBeLessThan(HARITA_H);
    }
  });

  it('bolgeCiz: kilitli mahallede süs yok; sancak 3/3 binada; ışıklı kanat dönerken durağan kanat gizli', () => {
    const sus = { yapilan: HEPSI, hayalet: false, yeni: bos };
    const kilitli = bolgeCiz(5, bolumler(12), [], sus);
    expect(kilitli.canli).toHaveLength(0);
    expect(kilitli.svg).not.toContain('f-sl');
    const acik = bolgeCiz(1, bolumler(41, 3, true), [], sus);
    expect(acik.sancaklar.map((x) => x.id)).toEqual([10, 9, 8, 7, 6]);
    expect(acik.canli.length).toBeGreaterThan(0);
    expect(bolgeCiz(1, bolumler(41, 3, false), [], sus).sancaklar).toHaveLength(0);
    // Sancak yalnız kazanılmış (açık) bölümde.
    expect(bolgeCiz(1, bolumler(8, 3, true), [], sus).sancaklar.map((x) => x.id)).toEqual([7, 6]);
    const kanat = (svg: string) => (svg.match(/fill="#4A3A3E" stroke="#2A1E22"/g) ?? []).length;
    const tepeYok = bolgeCiz(5, bolumler(41), []);
    const tepeVar = bolgeCiz(5, bolumler(41), [], { yapilan: new Set(['tepe.degirmenKanatlari']), hayalet: false, yeni: bos });
    expect(kanat(tepeYok.svg)).toBe(8);
    expect(kanat(tepeVar.svg)).toBe(0);
    expect(tepeVar.canli.filter((o) => o.tur === 'don')).toHaveLength(2);
  });

  it('süssüz çağrı eski çizimle aynı (eski oyuncunun gördüğü hiçbir şey değişmez)', () => {
    for (let m = 0; m < 8; m++) {
      const a = bolgeCiz(m, bolumler(41), []);
      const b = bolgeCiz(m, bolumler(41), [], { yapilan: bos, hayalet: false, yeni: bos });
      expect(b.svg).toBe(a.svg);
      expect(a.canli).toHaveLength(0);
    }
  });
});
