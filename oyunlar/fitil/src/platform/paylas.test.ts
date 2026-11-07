import { afterEach, describe, expect, it, vi } from 'vitest';
import { paylas, paylasDestekli } from './paylas';

// Node ortamı: pencere, gezgin ve belge taklit edilir.
function kur(o: { yerel?: unknown; share?: unknown; politika?: boolean } = {}): void {
  vi.stubGlobal('window', o.yerel ? { FitilYerel: { paylas: o.yerel } } : {});
  vi.stubGlobal('navigator', o.share ? { share: o.share } : {});
  vi.stubGlobal('document', o.politika === undefined ? {} : { permissionsPolicy: { allowsFeature: () => o.politika } });
}

afterEach(() => vi.unstubAllGlobals());

describe('paylas', () => {
  it('yol yoksa yok', async () => {
    kur();
    expect(paylasDestekli()).toBe(false);
    expect(await paylas('FTL1:x', 'b')).toBe('yok');
  });

  it('Android köprüsü önce gelir', async () => {
    const yerel = vi.fn(async () => 'tamam' as const);
    const share = vi.fn();
    kur({ yerel, share });
    expect(paylasDestekli()).toBe(true);
    expect(await paylas('FTL1:x', 'b')).toBe('tamam');
    expect(yerel).toHaveBeenCalledWith('FTL1:x', 'b');
    expect(share).not.toHaveBeenCalled();
  });

  it('köprü fırlatırsa yok (çağıran kopyalar)', async () => {
    kur({ yerel: () => Promise.reject(new Error('x')) });
    expect(await paylas('k', 'b')).toBe('yok');
  });

  it('çerçeve web-share izni vermiyorsa Web Share yok sayılır', () => {
    kur({ share: vi.fn(), politika: false });
    expect(paylasDestekli()).toBe(false);
  });

  it('Web Share: vazgeçme iptal, izin yok yok', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('a'), { name: 'AbortError' }))
      .mockRejectedValueOnce(Object.assign(new Error('n'), { name: 'NotAllowedError' }))
      .mockResolvedValueOnce(undefined);
    kur({ share, politika: true });
    expect(paylasDestekli()).toBe(true);
    expect(await paylas('k', 'b')).toBe('iptal');
    expect(await paylas('k', 'b')).toBe('yok');
    expect(await paylas('k', 'b')).toBe('tamam');
    expect(share).toHaveBeenLastCalledWith({ title: 'b', text: 'k' });
  });
});
