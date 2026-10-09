/**
 * M5a P4b: atölye mağazası. Hatalar konsola düşmez, son geçerli tasarım
 * korunur; geri al/yinele 30 adım; input olayları tek düzenleme; kısma;
 * tutamaçlar; aile/varyant; belge ve otomatik kayıt; ders yalıtımı.
 *
 * Değerlendirme (P3) ve mimari (P4a) taklitle (testing.ts FAKE_DEPS).
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { architectureOf } from '../design/architecture';
import { builtFor, designFor, setSlotBuilt, setSlotGraph } from '../design/catalog';
import { evaluate } from '../design/evaluate';
import { familyReady } from '../design/fuzz/fuzz';
import { buildEngine, type BuiltEngine } from '../design/graph';
import { knobById } from '../design/knobs';
import { TURBOFAN_GRAPH, TURBOJET_GRAPH } from '../design/templates';
import type { CompressorModule } from '../design/types';
import { WORKSHOP_STORAGE_KEY, WorkshopStore, type WorkshopStoreOptions } from './store';
import { FAKE_DEPS, memoryStorage } from './testing';

let errSpy: MockInstance;
let events: { b: BuiltEngine; detail: 'draft' | 'full' }[];

beforeEach(() => {
  errSpy = vi.spyOn(console, 'error');
  events = [];
});

afterEach(() => {
  // Beklenen tasarım hataları ASLA konsola düşmez
  expect(errSpy).toHaveBeenCalledTimes(0);
  errSpy.mockRestore();
  vi.useRealTimers();
});

function makeStore(o: Partial<WorkshopStoreOptions> = {}): WorkshopStore {
  return new WorkshopStore({ onBuilt: (b, detail) => events.push({ b, detail }), storage: memoryStorage(), deps: FAKE_DEPS, ...o });
}

const knob = (s: WorkshopStore, id: string) => knobById(id)!.get(s.state.graph);

describe('başlangıç', () => {
  it('başlangıç ekranında vitrin değerlendirmesi var, yayın yok', () => {
    const s = makeStore();
    expect(s.state.phase).toBe('start');
    expect(s.state.last.summary.thrust).toBeGreaterThan(100e3);
    expect(s.state.project.families).toEqual([]);
    expect(s.handles()).toEqual([]);
    expect(events).toEqual([]);
  });

  it('şablondan: aile AT-1, otomatik varyant adı, taslak hemen, tam 250 ms sonra', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const st = s.state;
    expect(st.phase).toBe('edit');
    expect(st.error).toBeNull();
    const f = st.project.families[0];
    expect(f.code).toBe('AT-1');
    expect(f.name).toBe('AT-1 Art yakıcılı turbojet');
    expect(f.origin).toEqual({ from: 'template', template: 'turbojet' });
    // Taban şablondan, çalışabilirlik (ops) ve kind olmadan
    expect(f.base.ops).toBeUndefined();
    expect(f.base.kind).toBeUndefined();
    const kN = Math.round(st.last.summary.thrust / 1e3);
    expect(f.variants[0].name).toBe(`AT-1/${kN}`);
    expect(st.graph.name).toBe(`AT-1/${kN}`);
    expect(st.last.built.design.name).toBe(`AT-1/${kN}`);
    expect(events.map((e) => e.detail)).toEqual(['draft']);
    expect(s.idle).toBe(false);
    vi.advanceTimersByTime(250);
    expect(events.map((e) => e.detail)).toEqual(['draft', 'full']);
    expect(s.idle).toBe(true);
    expect(st.canUndo).toBe(false);
  });

  it('henüz olmayan şablon bildirim verir, atmaz', () => {
    const s = makeStore();
    s.startFromTemplate('turboshaft');
    expect(s.state.phase).toBe('start');
    expect(s.state.notice?.text).toMatch(/henüz yok/);
  });

  it('sihirbaz: canlı önizleme, hedef itki, bitirince yeni aile', () => {
    const s = makeStore();
    s.startWizard();
    expect(s.state.phase).toBe('wizard');
    expect(s.state.wizard!.arch.lpLoad).toBe('lpc');
    s.wizardChoose('afterburner', true);
    s.wizardChoose('combustor', 'canAnnular');
    expect(s.state.wizard!.arch).toMatchObject({ afterburner: true, combustor: 'canAnnular' });
    s.wizardSize({ thrust: 30e3 });
    expect(s.state.error).toBeNull();
    expect(Math.abs(s.state.last.summary.thrust / 30e3 - 1)).toBeLessThan(0.02);
    s.wizardChoose('lpLoad', 'gearedFan');
    expect(s.state.wizard!.blocked).toMatch(/M5b/);
    expect(s.state.wizard!.arch.lpLoad).toBe('lpc');
    s.wizardFinish();
    const f = s.state.project.families[0];
    expect(s.state.phase).toBe('edit');
    expect(f.origin).toEqual({ from: 'wizard', template: 'turbojet' });
    expect(s.state.last.built.traits.combustor).toBe('canAnnular');
    expect(Math.abs(s.state.last.summary.thrust / 30e3 - 1)).toBeLessThan(0.02);
  });
});

describe('düğmeler, hatalar, geri al', () => {
  it('hatalı düğme → state.error, last korunur; son geçerliye dön', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const last = s.state.last;
    s.setKnob('fan.pr', 1.78, 'change');
    expect(s.state.error).not.toBeNull();
    expect(s.state.error!.raw).toMatch(/P5/);
    expect(s.state.last).toBe(last);
    expect(knob(s, 'fan.pr')).toBe(1.78);
    const n = events.length;
    // Hatalı tasarım yayınlanmaz
    expect(events.length).toBe(n);
    s.revertToLastGood();
    expect(s.state.error).toBeNull();
    expect(knob(s, 'fan.pr')).toBe(1.55);
    expect(s.state.last.built.rev).toBe(last.built.rev);
  });

  it('beklenmeyen hata da yakalanır (çeviri bile atsa)', () => {
    const s = makeStore({
      deps: {
        ...FAKE_DEPS,
        evaluate: () => {
          throw new TypeError('beklenmedik');
        },
        translateError: () => {
          throw new Error('çeviri yok');
        },
      },
    });
    expect(s.state.error?.raw).toBe('beklenmedik');
    s.startFromTemplate('turbojet');
    expect(s.state.error?.raw).toBe('beklenmedik');
  });

  it('geri al / yinele: 30 adım', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    for (let i = 1; i <= 35; i++) s.setKnob('combustor.tit', 1100 + 5 * i, 'change');
    expect(knob(s, 'combustor.tit')).toBe(1275);
    let n = 0;
    while (s.state.canUndo) {
      s.undo();
      n++;
    }
    expect(n).toBe(30);
    expect(knob(s, 'combustor.tit')).toBe(1125);
    for (let i = 0; i < 30; i++) s.redo();
    expect(knob(s, 'combustor.tit')).toBe(1275);
    expect(s.state.canRedo).toBe(false);
  });

  it('input olayları tek düzenlemede birleşir; kıyas noktası hareketin başı', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const t0 = s.state.last.summary.thrust;
    for (let v = 1240; v <= 1300; v += 10) s.setKnob('combustor.tit', v, 'input');
    expect(s.state.dragging).toBe('combustor.tit');
    expect(s.state.compare.thrust).toBe(t0);
    s.setKnob('combustor.tit', 1300, 'change');
    expect(s.state.dragging).toBeNull();
    expect(s.state.last.summary.thrust).toBeGreaterThan(t0);
    s.undo();
    expect(knob(s, 'combustor.tit')).toBe(1230);
    expect(s.state.canUndo).toBe(false);
  });

  it('kısma: input taslakları son üretim süresi + 16 ms aralıkla, change hemen + 250 ms tam', () => {
    vi.useFakeTimers();
    let clock = 0;
    const s = makeStore({
      now: () => clock,
      onBuilt: (b, detail) => {
        events.push({ b, detail });
        clock += 40; // 3B üretimi 40 ms sürsün
      },
    });
    s.startFromTemplate('turbojet');
    vi.advanceTimersByTime(300);
    events = [];
    clock += 1000;
    // 60 Hz'de 10 olay (16 ms arayla): her biri sayıları hemen hesaplar
    for (let i = 1; i <= 10; i++) {
      s.setKnob('combustor.tit', 1230 + 10 * i, 'input');
      expect(knob(s, 'combustor.tit')).toBe(1230 + 10 * i);
      clock += 16;
      vi.advanceTimersByTime(16);
    }
    const drafts = events.filter((e) => e.detail === 'draft').length;
    expect(drafts).toBeGreaterThanOrEqual(2);
    expect(drafts).toBeLessThanOrEqual(5);
    s.setKnob('combustor.tit', 1330, 'change');
    expect(events.at(-1)!.detail).toBe('draft');
    expect(events.at(-1)!.b.design.tit).toBe(1330);
    vi.advanceTimersByTime(250);
    expect(events.at(-1)!.detail).toBe('full');
    expect(s.idle).toBe(true);
    expect(s.lastBuildMs).toBe(40);
  });

  it('flush bekleyen tam ayrıntıyı hemen yayınlar', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('hpc.pr', 3.4, 'change');
    expect(s.idle).toBe(false);
    s.flush();
    expect(s.idle).toBe(true);
    expect(events.at(-1)!.detail).toBe('full');
  });

  it('uygulanamayan ve bilinmeyen düğme bildirim verir', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('fan.pr', 2, 'change');
    expect(s.state.notice?.text).toMatch(/bu motorda yok/);
    s.setKnob('yok.boyle' as never, 1, 'change');
    expect(s.state.notice?.text).toMatch(/Bilinmeyen düğme/);
    expect(s.state.canUndo).toBe(false);
  });

  it('"Düzelt": önerilen değer uygulanır', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.applyRemedy({ id: 'frontTipMach', severity: 'caution', title: '', text: '', fix: '', group: 'lpc', tags: [], knobs: [], remedy: { knob: 'lpc.tipSpeed', value: 430, label: '430 m/s' } });
    expect(knob(s, 'lpc.tipSpeed')).toBe(430);
  });
});

describe('aile ve varyant', () => {
  it('tek varyantta varyant düğmesi tabanı değiştirir (zarf yok)', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('hpc.pr', 4.5, 'change');
    const f = s.state.project.families[0];
    expect(knobById('hpc.pr')!.get(f.base)).toBe(4.5);
    expect(f.variants[0].values).toEqual({});
  });

  it('çok varyantta zarf: ±%10 PR; zarf dışı kırpılır ve bildirilir; aile düğmesi hepsini etkiler', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.addVariant();
    let f = s.state.project.families[0];
    expect(f.variants.length).toBe(2);
    expect(f.active).toBe(f.variants[1].id);
    expect(f.envelope['hpc.pr'][0]).toBeCloseTo(2.61, 9);
    expect(f.envelope['hpc.pr'][1]).toBeCloseTo(3.19, 9);
    // ±%15 ile düğme aralığının (TJ 1050–1650 K) kesişimi
    expect(f.envelope['combustor.tit']).toEqual([1050, 1230 * 1.15]);
    s.setKnob('hpc.pr', 4.5, 'change');
    f = s.state.project.families[0];
    expect(f.variants[1].values['hpc.pr']).toBeCloseTo(3.19, 9);
    expect(s.state.notice?.text).toMatch(/yeni bir aile ister/);
    // Taban değişmedi; ilk varyant tabanda
    expect(knobById('hpc.pr')!.get(f.base)).toBe(2.9);
    s.setKnob('lpc.tipSpeed', 440, 'change');
    s.selectVariant(f.variants[0].id);
    expect(knob(s, 'lpc.tipSpeed')).toBe(440);
    expect(knob(s, 'hpc.pr')).toBe(2.9);
    // En çok 4 varyant
    for (let i = 0; i < 5; i++) s.addVariant();
    expect(s.state.project.families[0].variants.length).toBe(4);
    expect(s.state.notice?.text).toMatch(/en çok 4/);
  });

  it('ad elle verilince kilitlenir ve tasarım adına girer', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setName('Deneme-1');
    expect(s.state.graph.name).toBe('Deneme-1');
    expect(s.state.last.built.design.name).toBe('Deneme-1');
    s.setKnob('combustor.tit', 1400, 'change');
    expect(s.state.graph.name).toBe('Deneme-1');
  });

  it('mimari değişimi yeni aile açar, eski aile durur', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setArchitecture('combustor', 'canAnnular');
    const p = s.state.project;
    expect(p.families.map((f) => f.code)).toEqual(['AT-1', 'AT-2']);
    expect(p.activeFamily).toBe(p.families[1].id);
    expect(s.state.notice?.text).toMatch(/^Yeni aile AT-2 açıldı; AT-1 duruyor\./);
    expect(s.state.last.built.traits.combustor).toBe('canAnnular');
    s.selectFamily(p.families[0].id);
    expect(s.state.last.built.traits.combustor).toBe('annular');
    s.undo();
    s.undo();
    expect(s.state.project.families.length).toBe(1);
  });
});

describe('tutamaçlar', () => {
  it('dünya konumları ve sürükleme: ön uç → hava akışı ×1,1025, tek düzenleme', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const hs = s.handles();
    expect(hs.map((h) => h.id)).toEqual(['frontTip', 'length:lpc', 'length:hpc', 'nozzleExit']);
    const ft = hs[0];
    expect(ft.world[0]).toBe(0);
    expect(ft.blocked).toBeNull();
    const r0 = ft.world[1];
    const W0 = s.state.graph.massFlow;
    s.dragHandle('frontTip', r0, 'start');
    for (let i = 1; i <= 8; i++) s.dragHandle('frontTip', r0 * (1 + (0.05 * i) / 8), 'move');
    expect(s.state.dragging).toBe('frontTip');
    s.dragHandle('frontTip', r0 * 1.05, 'end');
    expect(s.state.dragging).toBeNull();
    expect(s.state.graph.massFlow / W0).toBeCloseTo(1.1025, 3);
    expect(s.handles()[0].world[1] / r0).toBeCloseTo(1.05, 2);
    s.undo();
    expect(s.state.graph.massFlow).toBe(W0);
    expect(s.state.canUndo).toBe(false);
  });

  it('kompresör boyu +2 kademe; lüle ağzı büyür → T4 düşer (lüle trimi)', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const n0 = s.state.last.built.flowpath.gas.hpc.stages;
    const hpc = s.handles().find((h) => h.id === 'length:hpc')!;
    const pitch = s.state.last.built.flowpath.gas.hpc.pitch;
    s.dragHandle('length:hpc', hpc.world[2], 'start');
    s.dragHandle('length:hpc', hpc.world[2] + pitch, 'move');
    s.dragHandle('length:hpc', hpc.world[2] + 2 * pitch, 'end');
    expect(s.state.last.built.flowpath.gas.hpc.stages).toBe(n0 + 2);
    expect(Number(knob(s, 'hpc.pr'))).toBeGreaterThan(2.9);
    const t0 = s.state.last.summary.t4;
    const nz = s.handles().find((h) => h.id === 'nozzleExit')!;
    expect(nz.coupled).toBe('combustor.tit');
    s.dragHandle('nozzleExit', nz.world[1], 'start');
    s.dragHandle('nozzleExit', nz.world[1] * 1.03, 'end');
    expect(s.state.last.summary.t4).toBeLessThan(t0);
  });

  it('sürüklerken kademe histerezisi, bırakınca kesin kademe', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const ft = s.handles().find((h) => h.id === 'frontTip')!;
    s.dragHandle('frontTip', ft.world[1], 'start');
    s.dragHandle('frontTip', ft.world[1] * 0.9, 'move');
    const during = s.state.last.built;
    s.dragHandle('frontTip', ft.world[1] * 0.9, 'end');
    const after = s.state.last.built;
    const exact = buildEngine(s.state.graph, s.buildOptions());
    expect(after.flowpath.gas.hpc.stages).toBe(exact.flowpath.gas.hpc.stages);
    expect(during.rev).toBe(after.rev);
  });
});

describe('belge, otomatik kayıt, yalıtım', () => {
  it('export → import: hata yok, rev aynı', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('hpc.pr', 3.3, 'change');
    s.setName('Deneme-1');
    const rev = s.state.last.built.rev;
    const j = s.exportDoc();
    const r = s.importDoc(j);
    expect(r.errors).toEqual([]);
    expect(s.state.last.built.rev).toBe(rev);
    expect(s.exportDoc().replace(/"modified":"[^"]+"/g, '')).toBe(j.replace(/"modified":"[^"]+"/g, ''));
    // Bozuk belge: hata, proje değişmez
    expect(s.importDoc('{"format":"tfa-workshop","v":2}').errors[0]).toMatch(/v2/);
    expect(s.state.last.built.rev).toBe(rev);
  });

  it('tek motor belgesi yeni aile olarak eklenir', () => {
    const a = makeStore();
    a.startFromTemplate('turbojet');
    const fam = a.state.project.families[0];
    const engineDoc = JSON.parse(a.exportDoc()).families[0];
    const b = makeStore();
    b.startFromTemplate('turbofan');
    const r = b.importDoc(JSON.stringify(engineDoc));
    expect(r.errors).toEqual([]);
    expect(b.state.project.families.map((f) => f.id)).toEqual([b.state.project.families[0].id, fam.id]);
    expect(b.state.last.built.traits.presentation).toBe('turbojet');
  });

  it('otomatik kayıttan devam; bozuk ya da erişilemeyen kayıt sessizce false', () => {
    const storage = memoryStorage();
    const a = makeStore({ storage });
    a.startFromTemplate('militaryTurbofan');
    a.setKnob('fan.bypassRatio', 0.8, 'change');
    expect(storage.getItem(WORKSHOP_STORAGE_KEY)).toMatch(/"format":"tfa-workshop"/);
    const b = makeStore({ storage });
    expect(b.hasSaved()).toBe(true);
    expect(b.resume()).toBe(true);
    expect(b.state.phase).toBe('edit');
    expect(b.state.last.built.rev).toBe(a.state.last.built.rev);
    storage.setItem(WORKSHOP_STORAGE_KEY, '{bozuk');
    expect(makeStore({ storage }).resume()).toBe(false);
    const throwing = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('erişim yok');
      },
      setItem: () => {
        throw new Error('kota');
      },
    } as Storage;
    const c = makeStore({ storage: throwing });
    expect(c.resume()).toBe(false);
    c.startFromTemplate('turbojet');
    c.setKnob('hpc.pr', 3, 'change');
    expect(c.state.error).toBeNull();
    expect(makeStore({ storage: null }).resume()).toBe(false);
  });

  it('ders yalıtımı: atölye yuvası değişince designFor("turbofan") şablonla aynı', () => {
    const tf = designFor('turbofan');
    const s = makeStore({ onBuilt: (b) => setSlotBuilt('workshop', b) });
    s.startFromTemplate('turbofan');
    s.setKnob('fan.bypassRatio', 7, 'change');
    s.setKnob('hpc.pr', 14, 'change');
    expect(builtFor('workshop')!.design.bypassRatio).toBe(7);
    expect(designFor('turbofan')).toBe(tf);
    expect(designFor('turbofan')).toEqual(buildEngine(TURBOFAN_GRAPH).design);
    expect((builtFor('turbofan')!.graph.modules.find((m) => m.type === 'fan') as CompressorModule).bypassRatio).toBe(9);
    setSlotGraph('workshop', null);
  });

  it('seçim, uzman kipi, kıyas sabiti, görev', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.select('hpc');
    expect(s.state.selected).toBe('hpc');
    s.setExpert(true);
    expect(s.state.project.expert).toBe(true);
    s.pinBaseline();
    const pinned = s.state.compare;
    s.setKnob('combustor.tit', 1300, 'change');
    expect(s.state.compare).toBe(pinned);
    s.unpinBaseline();
    s.setGoal('missile');
    expect(s.state.project.goal?.title).toBe('Füze motoru');
    expect(JSON.parse(s.exportDoc()).goal).toBe('missile');
    s.setTesting(true);
    expect(s.state.phase).toBe('testing');
    s.setTesting(false);
    expect(s.state.phase).toBe('edit');
  });

  it('değerlendiriciye görev ve "Düzelt" bayrağı geçer (input: öneri yok, change: var)', () => {
    const seen: { goal?: string; remedies?: boolean; ref: boolean }[] = [];
    const s = makeStore({
      deps: {
        ...FAKE_DEPS,
        evaluate: (g, o) => {
          seen.push({ goal: o?.goal?.id, remedies: o?.remedies, ref: !!o?.reference });
          return FAKE_DEPS.evaluate(g, o);
        },
      },
    });
    s.startFromTemplate('turbojet');
    s.setGoal('missile');
    seen.length = 0;
    s.setKnob('combustor.tit', 1250, 'input');
    s.setKnob('combustor.tit', 1250, 'change');
    expect(seen[0]).toEqual({ goal: 'missile', remedies: false, ref: true });
    expect(seen.at(-1)).toEqual({ goal: 'missile', remedies: true, ref: true });
  });

  it('çalışabilirlik (trim) bulguları yalnız tam ayrıntıda eklenir; rev başına bir kez; atarsa bulgu yok', () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const surge = { id: 'surgeMargin', severity: 'caution' as const, title: '', text: '', fix: '', group: 'hpc', tags: [], knobs: [] };
    const t4 = { id: 't4', severity: 'warning' as const, title: '', text: '', fix: '', group: 'combustor', tags: [], knobs: [] };
    const s = makeStore({
      deps: {
        ...FAKE_DEPS,
        evaluate: (g, o) => {
          const r = FAKE_DEPS.evaluate(g, o);
          return 'error' in r ? r : { ...r, findings: [t4] };
        },
        evaluateOperability: (b) => {
          calls.push(b.rev);
          return [surge];
        },
      },
    });
    s.startFromTemplate('turbojet');
    // Taslakta trim yok
    expect(calls).toEqual([]);
    expect(s.state.last.findings.map((f) => f.id)).toEqual(['t4']);
    vi.advanceTimersByTime(250);
    expect(calls.length).toBe(1);
    // Önem sırası: warning önce
    expect(s.state.last.findings.map((f) => f.id)).toEqual(['t4', 'surgeMargin']);
    s.setKnob('combustor.tit', 1300, 'change');
    expect(s.state.last.findings.map((f) => f.id)).toEqual(['t4']);
    s.flush();
    expect(calls.length).toBe(2);
    expect(calls[1]).toBe(s.state.last.built.rev);
    // Aynı tasarım yeniden değerlendirilince bulgu önbellekten: hemen var, yeniden trim yok
    s.setKnob('combustor.tit', 1300, 'change');
    expect(s.state.last.findings.map((f) => f.id)).toEqual(['t4', 'surgeMargin']);
    vi.advanceTimersByTime(250);
    expect(calls.length).toBe(2);
    // Değerlendirici atarsa: bulgu eklenmez, hata yok
    const t = makeStore({
      deps: {
        ...FAKE_DEPS,
        evaluateOperability: () => {
          throw new Error('trim yakınsamadı');
        },
      },
    });
    t.startFromTemplate('turbojet');
    t.flush();
    expect(t.state.error).toBeNull();
    expect(t.state.last.findings).toEqual([]);
  });

  it('şablon değerlerine dön: taban ilk haline, varyant değerleri silinir; geri alınabilir', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('hpc.pr', 3.6, 'change');
    s.setKnob('lpc.tipSpeed', 450, 'change');
    s.addVariant();
    s.setKnob('combustor.tit', 1300, 'change');
    s.resetToTemplate();
    const f = s.state.project.families[0];
    expect(knobById('hpc.pr')!.get(f.base)).toBe(2.9);
    expect(knobById('lpc.tipSpeed')!.get(f.base)).toBe(knobById('lpc.tipSpeed')!.get(TURBOJET_GRAPH));
    expect(f.variants.every((v) => Object.keys(v.values).length === 0)).toBe(true);
    expect(knob(s, 'combustor.tit')).toBe(1230);
    s.undo();
    expect(knob(s, 'combustor.tit')).toBe(1300);
  });

  it('çözülebilir aralık ve duyarlılık mağazanın referansıyla', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const f = s.feasible('fan.pr')!;
    expect(f.hi).toBeGreaterThan(1.55);
    expect(f.hi).toBeLessThan(1.7);
    expect(f.hiReason?.raw).toMatch(/P5/);
    const d = s.sensitivity('combustor.tit');
    expect(d.find((x) => x.key === 'thrust')!.abs).toBeGreaterThan(0);
  });
});

describe('aile başına son geçerli', () => {
  /** AT-1 turbojet (geçerli), AT-2 turbofan (fan.pr 1,78: P5 ≤ P0, kurulamaz) */
  function twoFamilies() {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.startFromTemplate('turbofan');
    const [a, b] = s.state.project.families;
    const goodTF = s.state.last;
    s.setKnob('fan.pr', 1.78, 'change');
    expect(s.state.error).not.toBeNull();
    return { s, a, b, goodTF };
  }

  it('hatalı aileye dönünce bağlam, tutamaç ve ters çözüm o ailenin; kaydırıcıyla düzeltilir', () => {
    const { s, a, b, goodTF } = twoFamilies();
    s.selectFamily(a.id);
    expect(s.state.error).toBeNull();
    expect(s.state.last.built.traits.presentation).toBe('turbojet');
    s.selectFamily(b.id);
    expect(s.state.error).not.toBeNull();
    // 3B ve tutamaçlar başka ailenin (TJ) motoru değil: TF'nin son geçerli hali
    expect(s.state.last).toBe(goodTF);
    expect(s.state.lastFor).toEqual({ familyId: b.id, variantId: b.active });
    expect(s.ctx().traits.presentation).toBe('turbofan');
    // TF ile TJ'nin tutamaç kimlikleri aynı; lüle ağzının bağı aileyi ayırır (TF: FPR)
    expect(s.handles().find((h) => h.id === 'nozzleExit')!.coupled).toBe('fan.pr');
    // Ön uç sürüklemesi TF hava akışını ölçekler (TJ'ninkini yazmaz)
    const ft = s.handles().find((h) => h.id === 'frontTip')!;
    const W0 = goodTF.graph.massFlow;
    s.dragHandle('frontTip', ft.world[1] * 1.02, 'start');
    s.dragHandle('frontTip', ft.world[1] * 1.02, 'end');
    expect(s.state.graph.massFlow / W0).toBeCloseTo(1.0404, 3);
    // Hatalı düğme panelden düzeltilir
    s.setKnob('fan.pr', 1.6, 'change');
    expect(s.state.error).toBeNull();
    expect(s.state.last.built.traits.presentation).toBe('turbofan');
  });

  it('son geçerliye dön aile başına: başka ailenin anlık durumunu geri yüklemez', () => {
    const { s, a, b } = twoFamilies();
    s.selectFamily(a.id);
    s.setKnob('combustor.tit', 1300, 'change');
    s.selectFamily(b.id);
    s.revertToLastGood();
    expect(s.state.error).toBeNull();
    expect(knob(s, 'fan.pr')).toBe(1.55);
    // A'nın değişikliği yerinde
    const fa = s.state.project.families.find((f) => f.id === a.id)!;
    expect(knobById('combustor.tit')!.get(fa.base)).toBe(1300);
  });

  it('hiç kurulamamış aile: şablonu gösterilir, tutamaç yok, son geçerliye dön şablona döner', () => {
    const src = makeStore();
    src.startFromTemplate('turbofan');
    src.setKnob('fan.pr', 1.78, 'change');
    const broken = JSON.parse(src.exportDoc()).families[0];
    const s = makeStore();
    s.startFromTemplate('turbojet');
    expect(s.importDoc(JSON.stringify(broken)).errors).toEqual([]);
    expect(s.state.error).not.toBeNull();
    expect(s.state.last.built.traits.presentation).toBe('turbofan');
    expect(s.state.lastFor).toBeNull();
    expect(s.handles()).toEqual([]);
    expect(s.feasible('fan.pr')).toBeNull();
    const before = s.state.graph.massFlow;
    s.dragHandle('frontTip', 2, 'end');
    expect(s.state.graph.massFlow).toBe(before);
    s.revertToLastGood();
    expect(s.state.error).toBeNull();
    expect(knob(s, 'fan.pr')).toBe(1.55);
  });

  it('hatalı son düzenlemeden sonra devam et → ailenin son geçerli motoru, hata yok', () => {
    const storage = memoryStorage();
    const a = makeStore({ storage });
    a.startFromTemplate('turbojet');
    a.setKnob('hpc.pr', 3.4, 'change');
    const tjRev = a.state.last.built.rev;
    a.startFromTemplate('turbofan');
    a.setKnob('fan.pr', 1.6, 'change');
    const tfRev = a.state.last.built.rev;
    a.setKnob('fan.pr', 1.78, 'change');
    expect(a.state.error).not.toBeNull();
    const b = makeStore({ storage });
    expect(b.resume()).toBe(true);
    expect(b.state.error).toBeNull();
    expect(b.state.last.built.traits.presentation).toBe('turbofan');
    expect(b.state.last.built.rev).toBe(tfRev);
    expect(knob(b, 'fan.pr')).toBe(1.6);
    expect(b.state.lastFor?.familyId).toBe(b.state.project.activeFamily);
    b.selectFamily(b.state.project.families[0].id);
    expect(b.state.error).toBeNull();
    expect(b.state.last.built.rev).toBe(tjRev);
  });

  it('bozuk kayıt ve bozuk belge atölyeyi çökertmez', () => {
    const storage = memoryStorage();
    const a = makeStore({ storage });
    a.startFromTemplate('turbojet');
    const doc = JSON.parse(storage.getItem(WORKSHOP_STORAGE_KEY)!);
    doc.families[0].family.base.modules = [null];
    storage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(doc));
    expect(makeStore({ storage }).resume()).toBe(false);
    const r = a.importDoc(JSON.stringify(doc));
    expect(r.errors.join(' ')).toMatch(/modül listesi bozuk/);
    expect(a.importDoc(JSON.stringify(doc.families[0])).errors.join(' ')).toMatch(/modül listesi bozuk/);
    expect(a.state.error).toBeNull();
  });
});

describe('varyant, kıyas, belge ayrıntıları', () => {
  it('tek varyanta inince kalan varyantın değeri tabana katlanır; kaydırıcı etkili', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const v0 = s.state.project.families[0].variants[0].id;
    s.addVariant();
    s.setKnob('combustor.tit', 1600, 'change');
    s.removeVariant(v0);
    let f = s.state.project.families[0];
    expect(f.variants.length).toBe(1);
    expect(f.variants[0].values).toEqual({});
    expect(f.envelope).toEqual({});
    expect(knobById('combustor.tit')!.get(f.base)).toBe(1600);
    expect(knob(s, 'combustor.tit')).toBe(1600);
    s.setKnob('combustor.tit', 1750, 'change');
    f = s.state.project.families[0];
    expect(knob(s, 'combustor.tit')).toBe(1750);
    expect(knobById('combustor.tit')!.get(f.base)).toBe(1750);
  });

  it('kaydırıcı bırakılınca kıyas noktası hareketin başında kalır', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const t0 = s.state.last.summary.thrust;
    s.setKnob('combustor.tit', 1650, 'input');
    s.setKnob('combustor.tit', 1700, 'input');
    s.setKnob('combustor.tit', 1700, 'change');
    expect(s.state.compare.thrust).toBe(t0);
    expect(s.state.last.summary.thrust).toBeGreaterThan(t0);
    // Yeni hareket (tek tık değişim) kıyası o anki değere taşır
    const t1 = s.state.last.summary.thrust;
    s.setKnob('combustor.tit', 1720, 'change');
    expect(s.state.compare.thrust).toBe(t1);
  });

  it('mimari değişimiyle açılan aile sayfa yenilenince de şablona dönerken mimarisini korur', () => {
    const storage = memoryStorage();
    const a = makeStore({ storage });
    a.startFromTemplate('turbojet');
    a.setArchitecture('combustor', 'canAnnular');
    const b = makeStore({ storage });
    expect(b.resume()).toBe(true);
    b.setKnob('hpc.pr', 3.4, 'change');
    b.resetToTemplate();
    expect(b.state.error).toBeNull();
    expect(b.state.last.built.traits.combustor).toBe('canAnnular');
    expect(knob(b, 'hpc.pr')).toBe(2.9);
  });

  it('boş atölyeye içe aktarma geri al yığınına girmez', () => {
    const a = makeStore();
    a.startFromTemplate('turbojet');
    const s = makeStore();
    expect(s.importDoc(a.exportDoc()).errors).toEqual([]);
    expect(s.state.phase).toBe('edit');
    expect(s.state.canUndo).toBe(false);
    expect(s.handles().length).toBeGreaterThan(0);
    const e = makeStore();
    expect(e.importDoc(JSON.stringify(JSON.parse(a.exportDoc()).families[0])).errors).toEqual([]);
    expect(e.state.canUndo).toBe(false);
  });

  it('yalnız ad değişince 3B yeniden üretilmez', () => {
    vi.useFakeTimers();
    const s = makeStore();
    s.startFromTemplate('turbojet');
    vi.advanceTimersByTime(300);
    const n = events.length;
    s.setName('Benim motorum');
    vi.advanceTimersByTime(300);
    expect(events.length).toBe(n);
    s.setKnob('combustor.tit', 1300, 'change');
    expect(events.length).toBe(n + 1);
  });

  it('değeri olmayan düğmenin çözülebilir aralığı yok (null)', () => {
    const s = makeStore();
    s.startFromTemplate('militaryTurbofan');
    expect(knobById('mixer.lobes')!.get(s.state.graph)).toBeUndefined();
    expect(s.feasible('mixer.lobes')).toBeNull();
    expect(s.feasible('propeller.diameter')).toBeNull();
  });
});

/**
 * Gerçek bağımlılıklarla (taklitsiz): değerlendirme P3, mimari P4a.
 * Paketler birleşene dek atlanır; entegrasyonda mağazanın gerçek gövdelerle
 * çalıştığını ve konsola hata düşürmediğini kanıtlar.
 */
const realReady = (() => {
  try {
    evaluate(TURBOJET_GRAPH);
    architectureOf(TURBOJET_GRAPH);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!realReady)('gerçek değerlendirme ve mimari ile', () => {
  const real = (o: Partial<WorkshopStoreOptions> = {}) =>
    new WorkshopStore({ onBuilt: (b, detail) => events.push({ b, detail }), storage: memoryStorage(), ...o });

  it('şablon turbofan: geçerli; hatalı FPR öğretici hatayla, son geçerli korunur', () => {
    vi.useFakeTimers();
    const s = real();
    expect(s.state.last.summary.thrust).toBeGreaterThan(100e3);
    s.startFromTemplate('turbofan');
    expect(s.state.error).toBeNull();
    const last = s.state.last;
    s.setKnob('fan.pr', 1.78, 'change');
    expect(s.state.error).not.toBeNull();
    expect(s.state.error!.raw).toMatch(/P5/);
    expect(s.state.error!.text.length).toBeGreaterThan(20);
    expect(s.state.error!.knobs).toContain('fan.pr');
    expect(s.state.last).toBe(last);
    s.revertToLastGood();
    expect(s.state.error).toBeNull();
    // Tam ayrıntıda trim bulguları eklenir (şablonda trim bulgusu yok)
    s.flush();
    expect(s.state.last.findings.filter((f) => ['surgeMargin', 'idleTrim', 'fullTrim'].includes(f.id))).toEqual([]);
    const f = s.feasible('fan.pr')!;
    expect(f.hi).toBeGreaterThanOrEqual(1.58);
    expect(f.hi).toBeLessThanOrEqual(1.7);
    expect(f.hiReason?.raw).toMatch(/P5/);
    expect(s.sensitivity('combustor.tit').length).toBeGreaterThan(0);
  });

  // Gerileme: öneri yalnız düğme aralığına kırpılarak sınanıyordu; çok
  // varyantlı ailede writeKnob zarfa kırpınca (BPR 0,82 → 0,6325) bulgu
  // sürüyor ve "Bu fark yeni bir aile ister" çıkıyordu
  it('çok varyantlı aile: "Düzelt" önerisi varyant zarfının içinde kalır', () => {
    for (const [knob, value] of [['combustor.tit', 1750], ['fan.eff', 0.94]] as const) {
      const s = real();
      s.startFromTemplate('militaryTurbofan');
      s.addVariant();
      const env = s.activeFamily()!.envelope;
      expect(env['fan.bypassRatio'], knob).toBeDefined();
      s.setKnob(knob, value, 'change');
      expect(s.state.error).toBeNull();
      const fs = s.state.last.findings.filter((f) => f.severity !== 'info' && f.remedy);
      for (const f of fs) {
        const range = env[f.remedy!.knob];
        if (range && typeof f.remedy!.value === 'number') {
          expect(f.remedy!.value, `${knob} ${f.id}`).toBeGreaterThanOrEqual(range[0]);
          expect(f.remedy!.value, `${knob} ${f.id}`).toBeLessThanOrEqual(range[1]);
        }
        const before = s.state.project;
        s.applyRemedy(f);
        expect(s.state.notice?.text ?? '', `${knob} ${f.id}`).not.toMatch(/yeni bir aile/);
        expect(s.state.last.findings.map((x) => x.id), `${knob} ${f.id}`).not.toContain(f.id);
        s.undo();
        expect(s.state.project).toEqual(before);
      }
    }
  });

  it('mimari değişimi yeni aile açar (gerçek dönüşüm)', () => {
    const s = real();
    s.startFromTemplate('turbofan');
    s.setArchitecture('combustor', 'canAnnular');
    expect(s.state.project.families.length).toBe(2);
    expect(s.state.notice?.text).toMatch(/^Yeni aile AT-2 açıldı; AT-1 duruyor\./);
  });

  it.skipIf(!familyReady('turbojetDry'))('§1.3 sihirbazı: art yakıcısız, kutu-halka, çıplak tek akış, 30 kN', () => {
    const s = real();
    s.startWizard();
    s.wizardChoose('output', 'thrust');
    s.wizardChoose('lpLoad', 'lpc');
    s.wizardChoose('combustor', 'canAnnular');
    s.wizardChoose('afterburner', false);
    s.wizardSize({ thrust: 30e3 });
    expect(s.state.error).toBeNull();
    s.wizardFinish();
    expect(s.state.phase).toBe('edit');
    expect(s.state.error).toBeNull();
    const t = s.state.last.built.traits;
    expect([t.combustor, t.afterburner, t.lpLoad, t.exhaust]).toEqual(['canAnnular', false, 'lpc', 'single']);
    expect(Math.abs(s.state.last.summary.thrust / 30e3 - 1)).toBeLessThan(0.02);
    // Üç temel tutamaç kilitsiz
    const hs = s.handles();
    for (const id of ['frontTip', 'length:hpc', 'nozzleExit']) expect(hs.find((h) => h.id === id)?.blocked, id).toBeNull();
  });
});
