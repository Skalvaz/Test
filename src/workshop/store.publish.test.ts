/**
 * M5a dalga 2 inceleme bulguları (uygulama grubu): mağazanın yayın ve
 * evre sözleşmeleri. Sahnedeki modeli App değiştirince (`invalidateShown`)
 * aynı tasarım yeniden yayınlanır; 3B üretimi atarsa mağaza atmaz ve
 * tasarımı yeniden dener; geri al yalnız düzenleme evresinde; mimari
 * değişiminin notları oyuncuya ulaşır; içe aktarma seçimi korur.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { BuiltEngine } from '../design/graph';
import { knobById } from '../design/knobs';
import { archNotesText, WORKSHOP_STORAGE_KEY, WorkshopStore, type WorkshopStoreOptions } from './store';
import { FAKE_DEPS, memoryStorage } from './testing';

let errSpy: MockInstance;
let events: { b: BuiltEngine; detail: 'draft' | 'full' }[];

beforeEach(() => {
  errSpy = vi.spyOn(console, 'error');
  events = [];
});

afterEach(() => {
  expect(errSpy).toHaveBeenCalledTimes(0);
  errSpy.mockRestore();
  vi.useRealTimers();
});

function makeStore(o: Partial<WorkshopStoreOptions> = {}): WorkshopStore {
  return new WorkshopStore({ onBuilt: (b, detail) => void events.push({ b, detail }), storage: memoryStorage(), deps: FAKE_DEPS, ...o });
}

describe('#11 sahne değişince yeniden yayın', () => {
  it('aynı varsayılan sihirbaz ikinci kez açılınca invalidateShown sonrası yeniden yayınlanır', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startWizard();
    s.flush();
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
    // App atölyeden çıktı: sahneye katalog motoru kuruldu
    s.invalidateShown();
    events = [];
    s.startWizard();
    s.flush();
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
  });

  it('aynı şablondan yeni aile (AT-2) da yeniden yayınlanır', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startFromTemplate('turbofan');
    s.flush();
    s.invalidateShown();
    events = [];
    s.startFromTemplate('turbofan');
    s.flush();
    expect(s.state.project.families.length).toBe(2);
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
  });

  it('onBuilt false dönerse (sahneye konmadı) yayın gösterilmiş sayılmaz', () => {
    vi.useFakeTimers();
    let accept = false;
    const s = makeStore({
      onBuilt: (b, detail) => {
        events.push({ b, detail });
        return accept;
      },
    });
    s.startFromTemplate('turbojet');
    s.flush();
    expect(events.length).toBe(2);
    accept = true;
    // Aynı tasarım: önceki yayın kabul edilmediği için yeniden denenir
    s.setGoal(null);
    s.flush();
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full', 'draft', 'full']);
    // Kabul edildikten sonra aynı tasarım yeniden yayınlanmaz
    s.setGoal(null);
    s.flush();
    expect(events.length).toBe(4);
  });
});

describe('#13 3B üretimi atarsa mağaza atmaz', () => {
  it('onBuilt atınca kullanıcı olayı atmaz, otomatik kayıt yapılır, tasarım yeniden denenir', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    let fail = false;
    const s = makeStore({
      storage,
      onBuilt: (b, detail) => {
        events.push({ b, detail });
        if (fail) throw new RangeError('disk ters döndü');
      },
    });
    s.startFromTemplate('turbojet');
    s.flush();
    fail = true;
    events = [];
    const k = knobById('hpc.pr')!;
    const v = Number(k.get(s.state.graph)) * 1.05;
    const savedBefore = storage.getItem(WORKSHOP_STORAGE_KEY);
    expect(() => s.setKnob('hpc.pr', v, 'change')).not.toThrow();
    expect(() => s.flush()).not.toThrow();
    // Değişiklik kaydedildi (commit'in autosave'i atlanmadı)
    expect(Number(k.get(s.state.graph))).toBeCloseTo(v, 6);
    expect(storage.getItem(WORKSHOP_STORAGE_KEY)).not.toBe(savedBefore);
    // Taslak ve tam ayrıntı ayrı ayrı denendi (başarısız imza "gösterildi" sayılmadı)
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
    fail = false;
    events = [];
    // Aynı tasarım yeniden yayınlanabilir
    s.setGoal(null);
    s.flush();
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
  });
});

describe('#12 geri al yalnız düzenleme evresinde', () => {
  it('sihirbazda undo/redo eski ailenin düzenlemesini geri almaz', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const s = makeStore({ storage });
    s.startFromTemplate('turbojet');
    const k = knobById('hpc.pr')!;
    s.setKnob('hpc.pr', Number(k.get(s.state.graph)) * 1.05, 'change');
    s.flush();
    s.startWizard();
    s.flush();
    const preview = s.state.last;
    const savedBefore = storage.getItem(WORKSHOP_STORAGE_KEY);
    expect(s.state.canUndo).toBe(true);
    s.undo();
    s.redo();
    expect(s.state.phase).toBe('wizard');
    expect(s.state.last).toBe(preview);
    expect(storage.getItem(WORKSHOP_STORAGE_KEY)).toBe(savedBefore);
    // Bitir sihirbazın seçimini aile yapar (eski ailenin kopyası değil)
    s.wizardFinish();
    expect(s.state.project.families.length).toBe(2);
    const fresh = s.state.project.families[1].base;
    expect(fresh.massFlow).toBeCloseTo(preview.graph.massFlow, 6);
    expect(Number(k.get(fresh))).toBeCloseTo(Number(k.get(preview.graph)), 6);
    // Düzenleme evresinde geri al yine çalışır
    s.undo();
    expect(s.state.project.families.length).toBe(1);
  });
});

describe('#23 mimari notları oyuncuya', () => {
  it('applyArchitectureReport notları bildirime girer (geri alınan düğmeler ve kalan uyarı)', () => {
    const s = makeStore({
      deps: {
        ...FAKE_DEPS,
        applyArchitectureReport: (seed, next) => ({
          graph: FAKE_DEPS.applyArchitecture(seed, next),
          notes: [
            { knob: 'combustor.tit', from: 1700, to: 1550, reason: 'Bu değerle yeni motor sınırı aşıyor (EGT payı): ailenin değeri kullanıldı.' },
            { knob: 'hpc.pr', from: 22, to: 18, reason: 'Bu değerle yeni motor sınırı aşıyor (EGT payı): ailenin değeri kullanıldı.' },
            { knob: 'engine.massFlow', from: 40, to: 40, residual: true, reason: 'Yeni motor bu mimaride uyarı veriyor (HPC son kanadı kısa); ailenin değerlerine dönmek bunu gidermiyor. Hava akışını artır.' },
          ],
        }),
      },
    });
    s.startFromTemplate('turbojet');
    s.setArchitecture('combustor', 'canAnnular');
    const text = s.state.notice!.text;
    expect(text).toContain('Yeni aile AT-2 açıldı; AT-1 duruyor.');
    expect(text).toContain('Şunlar da değişti: T4 (türbin giriş sıcaklığı) 1.700 → 1.550 K, HPC basınç oranı 22,0 → 18,0: ');
    expect(text).toContain('HPC son kanadı kısa');
    // Aynı nedenli notlar bir kez yazılır
    expect(text.split('ailenin değeri kullanıldı').length - 1).toBe(1);
  });

  it('gerçek mimari: TP → fan → ayrık akışta geri alınan değerler ve kalan uyarı bildirilir', () => {
    const s = new WorkshopStore({ onBuilt: () => true, storage: null });
    s.startFromTemplate('turboprop');
    s.setArchitecture('lpLoad', 'fan');
    s.setArchitecture('exhaust', 'separate');
    const text = s.state.notice!.text;
    expect(text).toMatch(/^Yeni aile AT-3 açıldı; AT-2 duruyor\./);
    expect(text).toContain('Şunlar da değişti: ');
    expect(text).toMatch(/HPC son kanadı .* gidermiyor\. Daha büyük motor/);
  }, 120_000);

  it('yalnız applyArchitecture veren testler (taklit) notsuz çalışır', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setArchitecture('combustor', 'canAnnular');
    expect(s.state.notice!.text).toBe('Yeni aile AT-2 açıldı; AT-1 duruyor.');
  });

  it('archNotesText: değer değişmeyen not yalnız nedeniyle, bilinmeyen düğme kimliğiyle', () => {
    expect(archNotesText([])).toBe('');
    const t = archNotesText([
      { knob: 'yok.boyle', from: 1, to: 2, reason: 'Neden A.' },
      { knob: 'engine.massFlow', from: 40, to: 40, residual: true, reason: 'Kalan uyarı.' },
    ]);
    expect(t).toContain('yok.boyle 1 → 2');
    expect(t).toContain('Kalan uyarı.');
    expect(t).not.toContain('40 → 40');
  });
});

describe('içe aktarma seçimi korur', () => {
  it('yeni etkin ailede de olan modül seçili kalır; olmayan kalkar', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const engineDoc = (() => {
      const t = makeStore();
      t.startFromTemplate('turbofan');
      return t.exportDoc();
    })();
    s.select('hpc');
    expect(s.importDoc(engineDoc).errors).toEqual([]);
    expect(s.state.selected).toBe('hpc');
    // Turbojette fan yok: seçim kalkar
    const jetDoc = (() => {
      const t = makeStore();
      t.startFromTemplate('turbojet');
      return t.exportDoc();
    })();
    s.select('fan');
    expect(s.importDoc(jetDoc).errors).toEqual([]);
    expect(s.state.selected).toBe(null);
  });
});
