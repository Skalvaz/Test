import { describe, expect, it } from 'vitest';
import { Rng, hashString } from './rng';

describe('Rng', () => {
  it('aynı tohum aynı diziyi verir', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('farklı tohum farklı dizi verir', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const sa = Array.from({ length: 8 }, () => a.nextU32());
    const sb = Array.from({ length: 8 }, () => b.nextU32());
    expect(sa).not.toEqual(sb);
  });

  it('durum kaydedilip geri yüklenince devam eder', () => {
    const a = new Rng('günlük');
    a.int(10);
    const st = a.state();
    const b = Rng.fromState(st);
    for (let i = 0; i < 50; i++) expect(b.float()).toBe(a.float());
  });

  it('int aralık içinde ve kabaca düzgün dağılımlı', () => {
    const r = new Rng(7);
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 60000; i++) counts[r.int(6)]++;
    for (const c of counts) {
      expect(c).toBeGreaterThan(9000);
      expect(c).toBeLessThan(11000);
    }
  });

  it('weighted sıfır ağırlıklı öğeyi seçmez', () => {
    const r = new Rng(3);
    for (let i = 0; i < 1000; i++) expect(r.weighted([1, 0, 2])).not.toBe(1);
  });

  it('shuffle permütasyon üretir', () => {
    const r = new Rng(9);
    const arr = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('hashString kararlı', () => {
    expect(hashString('a')).toBe(hashString('a'));
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});
