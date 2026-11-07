import { describe, expect, it } from 'vitest';
import * as meta from '../meta';
import type { Kayit } from '../meta';
import { yedekEsigi, yedekGoruldu } from './yedek';

function kazanilmis(son: number): Kayit {
  const k = meta.yeniKayit(1);
  for (let i = 1; i <= son; i++) k.bolumler[String(i)] = { ...(k.bolumler[String(i)] ?? {}), yildiz: 1 } as Kayit['bolumler'][string];
  return k;
}

describe('kayıt yedeği hatırlatması', () => {
  it('10. bölümden önce yok, 10 kazanılınca 10', () => {
    expect(yedekEsigi(kazanilmis(9))).toBeNull();
    expect(yedekEsigi(kazanilmis(10))).toBe(10);
  });

  it('gösterilince susar; sıradaki eşikte yeniden', () => {
    const k = yedekGoruldu(kazanilmis(12));
    expect(yedekEsigi(k)).toBeNull();
    const sonra = { ...k, bolumler: { ...k.bolumler, ...kazanilmis(20).bolumler } };
    expect(yedekEsigi(sonra)).toBe(20);
  });

  it('birden çok eşik birikmişse en yükseği bir kez gösterilir', () => {
    const k = kazanilmis(31);
    expect(yedekEsigi(k)).toBe(30);
    expect(yedekEsigi(yedekGoruldu(k))).toBeNull();
  });

  it('oyuncu kendisi yedeklediyse (yedekGoruldu) yalnız kazanılmış eşikler susar', () => {
    const k = yedekGoruldu(kazanilmis(15));
    expect(k.ipuclari.gorulen).toContain('yedek-10');
    expect(k.ipuclari.gorulen).not.toContain('yedek-20');
  });
});
