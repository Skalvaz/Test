import { describe, expect, it } from 'vitest';
import type { BolumVerisi } from '../core/index';
import { bolumDogrula, listeDogrula } from './dogrulayici';
import { BOLUMLER } from './index';
import b001 from './veri/b001.json';

const b1 = b001 as unknown as BolumVerisi;

describe('statik bölüm doğrulayıcı (§14.5)', () => {
  it('bütün bölümler geçer; kimlikler eşsiz', () => {
    for (const v of BOLUMLER) expect(bolumDogrula(v), `bölüm ${v.id}`).toEqual([]);
    expect(listeDogrula(BOLUMLER)).toEqual([]);
    expect(listeDogrula([b1, b1])).toEqual(['bölüm 1 iki kez']);
  });

  it('kurallara aykırı bölümleri yakalar', () => {
    const hata = (ek: Partial<BolumVerisi>): string => bolumDogrula({ ...b1, ...ek }).join(' | ');
    expect(hata({ w: 3 })).toMatch(/boyut/);
    expect(hata({ garanti: 4 })).toMatch(/garanti/);
    expect(hata({ murekkep: true })).toMatch(/Mürekkep/);
    expect(hata({ dogum: [0, 0, 0, 0, 0, 0] })).toMatch(/doğum/);
    expect(hata({ yildizEsikleri: [2000, 1000] })).toMatch(/yıldız/);
    expect(hata({ hedefler: [{ tur: 'kagit' }] })).toMatch(/kâğıt hedefi/);
    expect(hata({ hedefler: [{ tur: 'topla', renk: 5, adet: 4 }] })).toMatch(/topla rengi 5/);
    expect(hata({ hedefler: [{ tur: 'desen', motif: 'lale' }] })).toMatch(/desen hücresi yok/);
    expect(hata({ zemin: { desen: { motif: 'lale', hucreler: [[0, 0, 6]] } }, hedefler: [{ tur: 'desen', motif: 'lale' }] })).toMatch(/yaratılamaz/);
    expect(hata({ zorunluIlkHamle: { kaynak: [0, 5], hedef: [1, 5] } })).toMatch(/zorunlu ilk hamle geçersiz/);
    expect(hata({ duzen: [...b1.duzen.slice(0, 5), '3 3 3 1 .'] })).toMatch(/sabit damlalar/);
    expect(hata({ zemin: { kagit: [[9, 9, 1]] }, hedefler: [{ tur: 'kagit' }] })).toMatch(/tahta dışında/);
  });

  it('uyarılar: tür–garanti uyumu', () => {
    const u: string[] = [];
    expect(bolumDogrula({ ...b1, garanti: 2 }, u)).toEqual([]);
    expect(u.join(' ')).toMatch(/garanti 2/);
  });
});
