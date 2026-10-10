/**
 * Atölye arayüzü (M5a dalga 2 incelemesi) regresyon testleri: DOM
 * davranışları küçük bir DOM taklidiyle (testDom.ts) sınanır. Hata kutusu
 * yenilemede düğmeleri yeniden kurmaz; kart klavye işleyicisi iç
 * bağlantılara karışmaz; varyantlar dar ekranda da seçilebilir; yasak
 * bölge eski tasarımla kısmaz; Ayrıntılar kapatılabilir; "Neden?" bayatlamaz.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkshopStore } from '../../workshop/store';
import { memoryStorage } from '../../workshop/testing';
import { ArchitectureCards } from './ArchitectureCards';
import { asEl, FakeEvent, installFakeDom, type FakeEl } from './testDom';
import { ErrorBox, familyViewKey, WorkshopPanel } from './WorkshopPanel';

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

const makeStore = () => new WorkshopStore({ onBuilt: () => {}, storage: memoryStorage() });

describe('mimari kartı klavyesi (#8)', () => {
  it('kart içindeki Ders/Sözlük düğmesinde Enter mimariyi değiştirmez ve engellenmez; kartın kendisinde değiştirir', () => {
    const store = makeStore();
    store.startFromTemplate('turbofan');
    const calls: unknown[] = [];
    store.setArchitecture = ((axis: unknown, value: unknown) => calls.push([axis, value])) as typeof store.setArchitecture;
    const lessons: string[] = [];
    const cards = new ArchitectureCards(store, { openLesson: (id) => lessons.push(id), openGlossary: (id) => lessons.push(id) });
    cards.update(store.state);
    const el = asEl(cards.el);
    // Seçilebilir (tabindex 0) ve iç bağlantısı olan bir kart
    const card = el.querySelectorAll('[data-arch]').find((c) => c.getAttribute('tabindex') === '0' && c.querySelector('.ws-link'))!;
    expect(card).toBeTruthy();
    const link = card.querySelector('.ws-link')!;
    for (const key of ['Enter', ' ']) {
      const e = new FakeEvent('keydown', { key });
      link.dispatchEvent(e);
      expect(e.defaultPrevented, `bağlantıda ${JSON.stringify(key)}`).toBe(false);
    }
    expect(calls).toEqual([]);
    // Fareyle tıklama da kartı tetiklemez (stopPropagation), bağlantıyı açar
    link.click();
    expect(calls).toEqual([]);
    expect(lessons.length).toBe(1);
    const e = new FakeEvent('keydown', { key: 'Enter' });
    card.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(calls.length).toBe(1);
  });
});
const panelCb = { onExit() {}, onNewFromTemplate() {}, onWizardCancel() {}, openLesson() {}, openGlossary() {}, onKnobDrag() {} };

describe('varyant seçimi Aile sekmesinde (#9)', () => {
  it('ikinci varyant eklenince ilkine Aile sekmesinden dönülür (üst çubuk dar ekranda gizli)', () => {
    const store = makeStore();
    store.startFromTemplate('turbofan');
    const panel = new WorkshopPanel(store, panelCb);
    panel.update(store.state);
    store.addVariant();
    const fam = () => store.activeFamily()!;
    const [v1, v2] = fam().variants;
    expect(fam().active).toBe(v2.id);
    panel.setTab('family');
    const rows = () => asEl(panel.el).querySelectorAll('.ws-var-row');
    expect(rows().length).toBe(2);
    expect(rows()[1].classList.contains('sel')).toBe(true);
    expect(rows()[0].textContent).toContain(v1.name);
    rows()[0].click();
    expect(fam().active).toBe(v1.id);
    panel.update(store.state);
    expect(rows()[0].classList.contains('sel')).toBe(true);
    expect(rows()[0].getAttribute('aria-pressed')).toBe('true');
    expect(rows()[1].classList.contains('sel')).toBe(false);
  });

  it('aile görünüm anahtarı etkin varyant ve varyant adı değişince değişir', () => {
    const st = (active: string, names: string[]) =>
      ({ project: { families: [{ id: 'f', code: 'AT-1', name: 'AT-1', active, variants: names.map((n, i) => ({ id: `v${i}`, name: n })) }], activeFamily: 'f' } }) as unknown as Parameters<typeof familyViewKey>[0];
    expect(familyViewKey(st('v0', ['A', 'B']))).toBe(familyViewKey(st('v0', ['A', 'B'])));
    expect(familyViewKey(st('v0', ['A', 'B']))).not.toBe(familyViewKey(st('v1', ['A', 'B'])));
    expect(familyViewKey(st('v0', ['A', 'B']))).not.toBe(familyViewKey(st('v0', ['A', 'C'])));
  });
});