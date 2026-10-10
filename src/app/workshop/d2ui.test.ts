/**
 * Atölye arayüzü (M5a dalga 2 incelemesi) regresyon testleri: DOM
 * davranışları küçük bir DOM taklidiyle (testDom.ts) sınanır. Hata kutusu
 * yenilemede düğmeleri yeniden kurmaz; kart klavye işleyicisi iç
 * bağlantılara karışmaz; varyantlar dar ekranda da seçilebilir; yasak
 * bölge eski tasarımla kısmaz; Ayrıntılar kapatılabilir; "Neden?" bayatlamaz.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asEl, installFakeDom, type FakeEl } from './testDom';
import { ErrorBox } from './WorkshopPanel';

let restore: () => void;
beforeEach(() => {
  restore = installFakeDom();
});
afterEach(() => restore());

describe('hata kutusu (#7)', () => {
  const err = { title: 'Kurulamadı', text: 'HPC basınç oranı çok yüksek.', glossary: 'surge' };

  it('aynı hata sürdükçe düğmeler yeniden kurulmaz; tık eski düğmeye ulaşır', () => {
    let reverts = 0;
    const box = new ErrorBox({ revert: () => reverts++, openGlossary: () => {} });
    const el = asEl(box.el);
    box.update(err);
    const btn = el.querySelector('[data-action="revert"]') as FakeEl;
    const title = el.querySelector('b') as FakeEl;
    // 0,2 s'lik yenileme: aynı içerikle birçok kez
    for (let i = 0; i < 10; i++) box.update({ ...err });
    expect(el.querySelector('[data-action="revert"]')).toBe(btn);
    expect(el.querySelector('b')).toBe(title);
    expect(el.contains(btn)).toBe(true);
    btn.click();
    expect(reverts).toBe(1);
    expect(el.classList.contains('hidden')).toBe(false);
  });

  it('hata değişince yalnız metinler değişir; sözlük düğmesi gizlenir/açılır; hata kalkınca kutu gizlenir', () => {
    const opened: string[] = [];
    const box = new ErrorBox({ revert: () => {}, openGlossary: (id) => opened.push(id) });
    const el = asEl(box.el);
    box.update(err);
    const btn = el.querySelector('[data-action="revert"]');
    const gl = el.querySelector('[data-action="glossary"]') as FakeEl;
    expect(gl.classList.contains('hidden')).toBe(false);
    gl.click();
    expect(opened).toEqual(['surge']);
    box.update({ title: 'Başka', text: 'Türbin yükü çok yüksek.' });
    expect(el.querySelector('b')!.textContent).toBe('Başka');
    expect(el.querySelector('p')!.textContent).toBe('Türbin yükü çok yüksek.');
    expect(el.querySelector('[data-action="revert"]')).toBe(btn);
    expect(gl.classList.contains('hidden')).toBe(true);
    box.update(null);
    expect(el.classList.contains('hidden')).toBe(true);
  });
});
