/**
 * §3.9 çizerken önizleme: eşik hücreleri (yalnız ilk dalga, kalkan, halka +2),
 * özel taş hayaleti, etki alanları, kombinasyon.
 */
import { describe, expect, it } from 'vitest';
import { onizle } from '../index';
import { anahtar, derinDondur, kur, yol } from './kur';

const UC = yol('0,5 1,5 2,5');
const BOS = ['. . . . .', '. . . . .', '. . . . .', '. . . . .'];

describe('§3.9 önizleme', () => {
  it('§3.9 esikHucreler: yalnız yol düğümlerinin ilk dalgasıyla eşiğe ulaşan yol dışı hücreler; kalkan dikkate alınır', () => {
    // (1,4) G3 → 4 eşik; (0,4) G2 → 3 değil; (2,4) G3 kovaya komşu (kalkan); (1,3) G3 ancak 2. dalgada.
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. G3 . . .', 'G2 G3 G3 S .', 'R R R . .'] });
    const o = onizle(d, UC, false);
    expect(o.gecerli).toBe(true);
    expect(o.renk).toBe(0);
    expect(o.esikHucreler).toEqual([{ x: 1, y: 4 }]);
    expect(o.isinacaklar).toContainEqual({ hucre: { x: 1, y: 4 }, artis: 1 });
    expect(o.isinacaklar.some((i) => i.hucre.x === 2 && i.hucre.y === 4)).toBe(false);
  });

  it('§3.9 halka: yol düğümleri +2 verir', () => {
    const d = kur({ tahta: [...BOS, 'R R . . .', 'R R G2 . .'] });
    const o = onizle(d, yol('0,4 1,4 1,5 0,5'), true);
    expect(o.esikHucreler).toEqual([{ x: 2, y: 5 }]);
    expect(o.isinacaklar).toContainEqual({ hucre: { x: 2, y: 5 }, artis: 2 });
  });

  it('§3.9 ozelHayalet: dönüşüm oluşacaksa tür ve eksen; yoksa null', () => {
    const tahta = ['. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', 'R R R R R R G'];
    const alti = yol('0,5 1,5 2,5 3,5 4,5 5,5');
    expect(onizle(kur({ tahta }), alti, false).ozelHayalet).toEqual({ hucre: { x: 5, y: 5 }, ozel: 'roket', eksen: 0 });
    expect(onizle(kur({ tahta }), alti.slice(0, 5), false).ozelHayalet).toBeNull();
    expect(onizle(kur({ tahta, ozelEsikleri: [0, 0, 0] }), alti, false).ozelHayalet).toBeNull();
  });

  it('§3.9 etkiAlanlari: yoldaki mevcut özel taşın etki hücreleri', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', 'R R- R . .'] });
    const o = onizle(d, UC, false);
    const alan = o.etkiAlanlari.find((e) => e.kaynak.x === 1 && e.kaynak.y === 5);
    expect(alan).toBeDefined();
    const k = new Set(alan!.hucreler.map(anahtar));
    expect(k.has('3,5')).toBe(true);
    expect(k.has('4,5')).toBe(true);
    expect(k.has('1,4')).toBe(false);
  });

  it('§3.9 / §4.4 yolda iki özel taş varsa birleşecek kombinasyon', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', 'R R| R- . .'] });
    expect(onizle(d, UC, false).kombo).toBe('yildizHatti');
    expect(onizle(kur({ tahta: [...BOS, '. . . . .', 'R R R- . .'] }), UC, false).kombo).toBeNull();
  });

  it('§3.9 geçersiz (kısa) yol: gecerli false', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', 'R R R . .'] });
    expect(onizle(d, UC.slice(0, 2), false).gecerli).toBe(false);
  });

  it('§3.3.1 / types.ts tamamı joker yolda önizleme rengi −1', () => {
    const d = kur({ tahta: [...BOS, '. . . . .', '* * * . .'] });
    expect(onizle(d, UC, false).renk).toBe(-1);
  });

  it('§3.9 önizleme durumu değiştirmez', () => {
    const d = kur({ tahta: [...BOS, 'G3 . . . .', 'R R R . .'] });
    const once = JSON.stringify(d);
    onizle(derinDondur(d), UC, false);
    expect(JSON.stringify(d)).toBe(once);
  });
});
