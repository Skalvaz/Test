import { afterEach, describe, expect, it, vi } from 'vitest';
import { geriTusuBildir, geriTusunuDinle, gizlilikSecenekleri, yasamBildir, yasamDinle, yerelHazir } from './yerel';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('geri tuşu', () => {
  it('dinleyen yoksa işlenmedi; true dönen dinleyici işler; false ve fırlatan işlemez', () => {
    const p = new EventTarget();
    expect(geriTusuBildir(p)).toBe(false);
    let yanit: boolean | 'firlat' = true;
    const kaldir = geriTusunuDinle(() => {
      if (yanit === 'firlat') throw new Error('x');
      return yanit;
    }, p);
    expect(geriTusuBildir(p)).toBe(true);
    yanit = false;
    expect(geriTusuBildir(p)).toBe(false);
    yanit = 'firlat';
    expect(geriTusuBildir(p)).toBe(false);
    yanit = true;
    kaldir();
    expect(geriTusuBildir(p)).toBe(false);
  });

  it('pencere yoksa (Node, test) etkisiz', () => {
    expect(geriTusuBildir()).toBe(false);
    expect(() => geriTusunuDinle(() => true)()).not.toThrow();
  });
});

describe('yaşam döngüsü', () => {
  it('aktif bilgisi dinleyiciye gider; kaldırınca gelmez', () => {
    const p = new EventTarget();
    const gelen: boolean[] = [];
    const kaldir = yasamDinle((a) => gelen.push(a), p);
    yasamBildir(false, p);
    yasamBildir(true, p);
    kaldir();
    yasamBildir(false, p);
    expect(gelen).toEqual([false, true]);
  });
});

describe('köprü erişimi', () => {
  it('köprü yoksa: hazır etkisiz, gizlilik satırı yok', () => {
    vi.stubGlobal('window', {});
    expect(() => yerelHazir()).not.toThrow();
    expect(gizlilikSecenekleri()).toBeNull();
  });

  it('hazır köprüye iletilir; köprü fırlatırsa yutulur', () => {
    const hazir = vi.fn();
    vi.stubGlobal('window', { FitilYerel: { hazir } });
    yerelHazir();
    expect(hazir).toHaveBeenCalledTimes(1);
    vi.stubGlobal('window', {
      FitilYerel: {
        hazir: () => {
          throw new Error('x');
        },
      },
    });
    expect(() => yerelHazir()).not.toThrow();
  });

  it('gizlilik: yalnız gerekli() true iken işlev; çağrı formu açar, ret yutulur', async () => {
    const ac = vi.fn(async () => undefined);
    let gerekli = false;
    vi.stubGlobal('window', { FitilYerel: { gizlilik: { gerekli: () => gerekli, ac } } });
    expect(gizlilikSecenekleri()).toBeNull();
    gerekli = true;
    const f = gizlilikSecenekleri();
    expect(f).toBeTypeOf('function');
    f!();
    expect(ac).toHaveBeenCalledTimes(1);
    ac.mockRejectedValueOnce(new Error('form'));
    expect(() => f!()).not.toThrow();
    await Promise.resolve();
    vi.stubGlobal('window', {
      FitilYerel: {
        gizlilik: {
          gerekli: () => {
            throw new Error('x');
          },
          ac,
        },
      },
    });
    expect(gizlilikSecenekleri()).toBeNull();
  });
});
