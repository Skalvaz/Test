/**
 * M5a inceleme düzeltmeleri (atölye mağazası): kötü niyetli belge mağazayı
 * çökertmez; geri al yalnız geçmişe ait alanları (aileler, etkin aile,
 * aile yan bilgileri) geri getirir; görev, uzman kipi ve kıyas sabiti
 * dokunulmaz kalır; aile başına haritalar sınırsız büyümez.
 *
 * Değerlendirme ve mimari taklitle (testing.ts FAKE_DEPS).
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { parseProjectDoc } from '../design/engineDoc';
import { evaluate } from '../design/evaluate';
import { buildEngine } from '../design/graph';
import { knobById, knobCtx } from '../design/knobs';
import { TURBOFAN_GRAPH, type TemplateId } from '../design/templates';
import { existingTemplate, referenceBuilt } from './project';
import { WORKSHOP_STORAGE_KEY, WorkshopStore, type WorkshopStoreOptions } from './store';
import { FAKE_DEPS, memoryStorage, rng } from './testing';

let errSpy: MockInstance;

beforeEach(() => {
  errSpy = vi.spyOn(console, 'error');
});

afterEach(() => {
  expect(errSpy).toHaveBeenCalledTimes(0);
  errSpy.mockRestore();
});

function makeStore(o: Partial<WorkshopStoreOptions> = {}): WorkshopStore {
  return new WorkshopStore({ onBuilt: () => {}, storage: memoryStorage(), deps: FAKE_DEPS, ...o });
}

const knob = (s: WorkshopStore, id: string) => knobById(id)!.get(s.state.graph);

/** Başka bir mağazada şablondan kurulup dışa aktarılmış tek motor belgesi (düz nesne) */
/** Belge alanları testte serbestçe bozulur */
type Raw = Record<string, any>;
function engineDoc(t: TemplateId = 'turbojet', edit?: (s: WorkshopStore) => void): Raw {
  const a = makeStore();
  a.startFromTemplate(t);
  edit?.(a);
  return JSON.parse(a.exportDoc()).families[0];
}

/** Mağazanın iç durumu (savunma testleri için) */
const inner = (s: WorkshopStore) => s as unknown as Record<string, any>;

const PROTO = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];

describe('#2 prototip adlı şablon kimliği', () => {
  it('existingTemplate ve referenceBuilt prototip adlarını bilinmeyen şablon sayar', () => {
    for (const id of PROTO) {
      expect(existingTemplate(id as TemplateId), id).toBe('turbofan');
      expect(() => referenceBuilt(id as TemplateId), id).not.toThrow();
    }
    expect(existingTemplate('turbojet')).toBe('turbojet');
    // Şablonu henüz olmayan aile en yakın şablona düşer (P7'ye dek turboprop)
    expect(['turboshaft', 'turboprop']).toContain(existingTemplate('turboshaft'));
  });

  it('origin.template = constructor: içe aktarma atmaz, aile kurulur, devam et çalışır', () => {
    for (const fresh of [true, false]) {
      const storage = memoryStorage();
      const s = makeStore({ storage });
      if (!fresh) s.startFromTemplate('turbofan');
      const d = engineDoc();
      d.family.origin.template = 'constructor';
      let r: ReturnType<WorkshopStore['importDoc']> | undefined;
      expect(() => (r = s.importDoc(JSON.stringify(d)))).not.toThrow();
      expect(r!.errors).toEqual([]);
      expect(s.state.error).toBeNull();
      expect(s.state.last.built.traits.presentation).toBe('turbojet');
      expect(() => s.setExpert(true)).not.toThrow();
      expect(() => s.setGoal('missile')).not.toThrow();
      expect(() => s.resetToTemplate()).not.toThrow();
      const b = makeStore({ storage });
      expect(() => b.resume()).not.toThrow();
      expect(b.state.error).toBeNull();
    }
  });

  it('prototip adlı şablonla başlatma ve "yeni aile" düzenlemesi atmaz, aile açmaz', () => {
    const s = makeStore();
    for (const id of PROTO) {
      expect(() => s.startFromTemplate(id as TemplateId), id).not.toThrow();
      expect(() => s.apply({ t: 'family', op: 'new', id }), id).not.toThrow();
    }
    expect(s.state.project.families).toEqual([]);
    expect(s.state.notice?.text).toMatch(/şablon/);
  });

  it('bellekteki aileye sızmış prototip adı da mağazayı çökertmez (savunma)', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    inner(s).s.project.families[0].origin.template = 'toString';
    expect(() => s.setKnob('hpc.pr', 3.1, 'change')).not.toThrow();
    expect(s.state.error).toBeNull();
    expect(() => s.resetToTemplate()).not.toThrow();
    expect(() => s.buildOptions()).not.toThrow();
  });
});

describe('#9 yinelenen kimlikler', () => {
  it('aynı kimlikli varyantlar: içe aktarınca ayrı kimlik; sil ve seç çalışır', () => {
    const d = engineDoc();
    const v = d.variants[0];
    d.variants = [v, { ...v, name: 'kopya' }];
    const s = makeStore();
    const r = s.importDoc(JSON.stringify(d));
    expect(r.errors).toEqual([]);
    expect(r.notes.join(' ')).toMatch(/kimli/);
    const f = s.state.project.families[0];
    expect(new Set(f.variants.map((x) => x.id)).size).toBe(2);
    const second = f.variants[1].id;
    s.selectVariant(second);
    expect(s.state.project.families[0].active).toBe(second);
    expect(() => s.removeVariant(v.id)).not.toThrow();
    expect(s.state.project.families[0].variants.map((x) => x.id)).toEqual([second]);
  });

  it('proje belgesinde aynı kimlikli aileler ayrı kimlik alır; ikisi de seçilir', () => {
    const a = engineDoc('turbojet');
    const b = engineDoc('turbofan');
    b.family.id = a.family.id;
    const s = makeStore();
    const r = s.importDoc(JSON.stringify({ format: 'tfa-workshop', v: 1, families: [a, b], active: a.family.id, expert: false }));
    expect(r.errors).toEqual([]);
    const ids = s.state.project.families.map((f) => f.id);
    expect(new Set(ids).size).toBe(2);
    s.selectFamily(ids[1]);
    expect(s.state.last.built.traits.presentation).toBe('turbofan');
  });

  it('bellekte yinelenen varyant kimliği: silme aileyi boşaltmaz, atmaz (savunma)', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    const f = inner(s).s.project.families[0];
    f.variants = [f.variants[0], { ...f.variants[0], name: 'kopya' }];
    expect(() => s.removeVariant(f.variants[0].id)).not.toThrow();
    expect(s.state.project.families[0].variants.length).toBeGreaterThan(0);
  });
});

describe('#10 sonsuz sayılar', () => {
  it('tabanda 1e999: içe aktarma reddedilir; sonraki düzenlemeler otomatik kayda girer', () => {
    const storage = memoryStorage();
    const s = makeStore({ storage });
    s.startFromTemplate('turbojet');
    const json = JSON.stringify(engineDoc()).replace('"modules":', '"zz":1e999,"modules":');
    const r = s.importDoc(json);
    expect(r.errors.join(' ')).toMatch(/sonlu olmayan/);
    expect(s.state.project.families.length).toBe(1);
    const before = storage.getItem(WORKSHOP_STORAGE_KEY);
    s.setKnob('hpc.pr', 2.7, 'change');
    expect(storage.getItem(WORKSHOP_STORAGE_KEY)).not.toBe(before);
    expect(() => s.exportDoc()).not.toThrow();
  });

  it('serileşemeyen aile otomatik kaydı ve dışa aktarmayı durdurmaz: son geçerli hali yazılır (savunma)', () => {
    const storage = memoryStorage();
    const s = makeStore({ storage });
    s.startFromTemplate('turbojet');
    s.startFromTemplate('turbofan');
    const [tj] = s.state.project.families;
    // Etkin olmayan aileye bellekte sonsuz sayı sızmış olsun
    inner(s).s.project.families[0].base.massFlow = Infinity;
    s.setKnob('combustor.tit', 1650, 'change');
    expect(s.state.error).toBeNull();
    const saved = parseProjectDoc(storage.getItem(WORKSHOP_STORAGE_KEY)!);
    expect(saved.errors).toEqual([]);
    expect(saved.doc!.families.length).toBe(2);
    expect(knobById('combustor.tit')!.get(saved.doc!.families[1].family.base as never)).toBe(1650);
    let out = '';
    expect(() => (out = s.exportDoc())).not.toThrow();
    const p = parseProjectDoc(out);
    expect(p.errors).toEqual([]);
    expect(p.doc!.families.map((f) => f.family.id)).toContain(tj.id);
  });
});

describe('#11 geri al aile yan bilgilerini korur', () => {
  /** ext, bilinmeyen alan ve eski oluşturma tarihi taşıyan proje belgesi */
  function richProject(): string {
    const d = engineDoc();
    d.ext = { kullanici: 42 };
    d.ozel = 'x';
    d.meta.created = '2020-01-01T00:00:00.000Z';
    return JSON.stringify({ format: 'tfa-workshop', v: 1, families: [d], active: d.family.id, expert: false });
  }

  it('proje içe aktarma geri alınınca ext, bilinmeyen alan ve meta.created geri gelir', () => {
    const s = makeStore();
    s.startFromTemplate('turbofan');
    expect(s.importDoc(richProject()).errors).toEqual([]);
    const other = engineDoc('turbofan');
    expect(s.importDoc(JSON.stringify({ format: 'tfa-workshop', v: 1, families: [other], active: other.family.id, expert: false })).errors).toEqual([]);
    s.undo();
    const fam = JSON.parse(s.exportDoc()).families[0];
    expect(fam.ext).toEqual({ kullanici: 42 });
    expect(fam.ozel).toBe('x');
    expect(fam.meta.created).toBe('2020-01-01T00:00:00.000Z');
    s.redo();
    expect(JSON.parse(s.exportDoc()).families[0].family.id).toBe(other.family.id);
  });

  it('8 aile sınırıyla düşen aile geri alınınca yan bilgileriyle döner', () => {
    const s = makeStore();
    expect(s.importDoc(richProject()).errors).toEqual([]);
    const first = s.state.project.families[0].id;
    for (let i = 0; i < 7; i++) s.startFromTemplate('turbojet');
    expect(s.state.project.families.length).toBe(8);
    s.startFromTemplate('turbojet');
    expect(s.state.project.families.some((f) => f.id === first)).toBe(false);
    s.undo();
    const fam = JSON.parse(s.exportDoc()).families.find((f: Raw) => f.family.id === first);
    expect(fam.ext).toEqual({ kullanici: 42 });
    expect(fam.meta.created).toBe('2020-01-01T00:00:00.000Z');
  });

  it('düşen sihirbaz ailesi geri alınınca "başlangıç değerlerine dön" yine çalışır', () => {
    const s = makeStore();
    s.startWizard();
    s.wizardFinish();
    const wiz = s.state.project.families[0];
    const pr0 = knob(s, 'hpc.pr');
    for (let i = 0; i < 8; i++) s.startFromTemplate('turbojet');
    expect(s.state.project.families.some((f) => f.id === wiz.id)).toBe(false);
    s.undo();
    s.selectFamily(wiz.id);
    s.setKnob('hpc.pr', Number(pr0) * 1.05, 'change');
    s.resetToTemplate();
    expect(s.state.notice?.text ?? '').not.toMatch(/bilinmiyor/);
    expect(knob(s, 'hpc.pr')).toBe(pr0);
  });
});

describe('#12 geri al geçmiş dışı ayarları değiştirmez', () => {
  it('görev, uzman kipi ve kıyas sabiti undo/redo ile değişmez', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.setKnob('combustor.tit', 1400, 'change');
    s.setGoal('missile');
    s.setExpert(true);
    s.pinBaseline();
    const pinned = s.state.project.baseline;
    expect(pinned).toBeDefined();
    s.undo();
    expect(knob(s, 'combustor.tit')).toBe(1230);
    expect(s.state.project.goal?.id).toBe('missile');
    expect(s.state.project.expert).toBe(true);
    expect(s.state.project.baseline).toEqual(pinned);
    s.setGoal(null);
    s.setExpert(false);
    s.unpinBaseline();
    s.redo();
    expect(knob(s, 'combustor.tit')).toBe(1400);
    expect(s.state.project.goal).toBeUndefined();
    expect(s.state.project.expert).toBe(false);
    expect(s.state.project.baseline).toBeUndefined();
  });
});

describe('#13 varyantta aile kapsamlı düğme', () => {
  it('içe aktarılan belgede varyanttaki aile düğmesi kaydırıcıyı kilitlemez', () => {
    const d = engineDoc('turbojet', (a) => a.addVariant());
    for (const v of d.variants) v.values['combustor.dp'] = 0.05;
    const s = makeStore();
    expect(s.importDoc(JSON.stringify(d)).errors).toEqual([]);
    expect(knob(s, 'combustor.dp')).toBe(0.05);
    s.setKnob('combustor.dp', 0.03, 'change');
    expect(knob(s, 'combustor.dp')).toBe(0.03);
    s.selectVariant(s.state.project.families[0].variants[0].id);
    expect(knob(s, 'combustor.dp')).toBe(0.03);
  });

  it('bellekte varyantta kalmış aile düğmesi değeri aile düğmesi yazılınca silinir (savunma)', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    s.addVariant();
    for (const v of inner(s).s.project.families[0].variants) v.values['combustor.dp'] = 0.05;
    s.setKnob('combustor.dp', 0.03, 'change');
    expect(knob(s, 'combustor.dp')).toBe(0.03);
    for (const v of s.state.project.families[0].variants) expect(v.values['combustor.dp']).toBeUndefined();
  });
});

describe('#22 aile başına haritalar sınırlı', () => {
  it('20 kez mimari değiştir + geri al: haritalar projedeki ailelerle sınırlı', () => {
    const s = makeStore();
    s.startFromTemplate('turbojet');
    for (let i = 0; i < 20; i++) {
      s.setArchitecture('combustor', 'canAnnular');
      s.undo();
    }
    const n = s.state.project.families.length;
    expect(n).toBe(1);
    for (const m of ['lastGood', 'extras', 'initialBase']) expect((inner(s)[m] as Map<string, unknown>).size, m).toBeLessThanOrEqual(n);
    // Yinele hâlâ çalışır: yan bilgiler anlık görüntüde
    s.redo();
    expect(s.state.project.families.length).toBe(2);
    expect(s.state.error).toBeNull();
  });
});

describe('#23 zarf var olan varyant değerini kapsar', () => {
  it('tek varyantlı belgede varyant değeri tabandan uzaksa varyant eklemek ilk varyantı değiştirmez', () => {
    const d = engineDoc();
    d.variants[0].values = { 'hpc.pr': 4.06 };
    delete d.family.envelope;
    const s = makeStore();
    expect(s.importDoc(JSON.stringify(d)).errors).toEqual([]);
    expect(knob(s, 'hpc.pr')).toBe(4.06);
    const v0 = s.state.project.families[0].variants[0].id;
    s.addVariant();
    expect(knob(s, 'hpc.pr')).toBe(4.06);
    s.selectVariant(v0);
    expect(knob(s, 'hpc.pr')).toBe(4.06);
    const env = s.state.project.families[0].envelope['hpc.pr'];
    expect(env[0]).toBeLessThanOrEqual(2.9 * 0.9 + 1e-9);
    expect(env[1]).toBeGreaterThanOrEqual(4.06);
  });
});

describe('bulanık testin bulduğu: sıfır kademe yüklemesi', () => {
  it('belgede yükleme "" (0): sonsuz kademe döngüsü yok, taban aralığa kırpılır', () => {
    const d = engineDoc();
    const hpc = d.family.base.modules.find((m: Raw) => m.type === 'hpc');
    hpc.loading = '';
    const s = makeStore();
    s.startFromTemplate('turbofan');
    const r = s.importDoc(JSON.stringify(d));
    expect(r.errors).toEqual([]);
    // Taban düğme aralığına kırpılır ve bildirilir (§2.14, inceleme #5 doğrulaması)
    expect(r.notes.some((n) => n.startsWith('Taban: HPC kademe yüklemesi'))).toBe(true);
    const k = knobById('hpc.loading')!;
    expect(knob(s, 'hpc.loading')).toBe(k.range!(knobCtx(s.state.graph))![0]);
    expect(s.state.error).toBeNull();
    expect(() => s.exportDoc()).not.toThrow();
  });

  it('kırpılmamış grafikte sıfır yükleme: sonsuz döngü yerine hata', () => {
    const g = structuredClone(TURBOFAN_GRAPH);
    (g.modules.find((m) => m.type === 'hpc') as unknown as Raw).loading = 0;
    expect(() => buildEngine(g)).toThrow(/kademe sayısı hesaplanamadı/);
    const r = evaluate(g);
    expect('error' in r && r.error.knobs).toContain('hpc.loading');
  });
});

describe('bulanık: bozuk belge içe aktarma mağazayı çökertmez', () => {
  const HOSTILE: unknown[] = [Infinity, -Infinity, NaN, null, '', 'constructor', '__proto__', 'toString', [], {}, [Infinity], { constructor: 1 }, true, 0, -1, 1e308];
  const KEYS = ['constructor', '__proto__', 'toString', 'valueOf'];

  /** Belgedeki (kap, anahtar) çiftleri */
  function slots(x: unknown, out: { parent: Raw; key: string }[] = []) {
    if (x && typeof x === 'object')
      for (const [k, v] of Object.entries(x)) {
        out.push({ parent: x as Raw, key: k });
        slots(v, out);
      }
    return out;
  }

  it('80 rastgele bozulma: içe aktar, düzenle, geri al, dışa aktar, devam et (tohumlu)', () => {
    const rand = rng(91);
    const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
    const seeds = [engineDoc('turbojet', (a) => a.addVariant()), engineDoc('turbofan')];
    for (let i = 0; i < 80; i++) {
      const d = structuredClone(pick(seeds));
      for (let j = 0, n = 1 + Math.floor(rand() * 3); j < n; j++) {
        const { parent, key } = pick(slots(d));
        const op = rand();
        if (op < 0.6) parent[key] = structuredClone(pick(HOSTILE));
        else if (op < 0.85 && !Array.isArray(parent)) parent[pick(KEYS)] = structuredClone(pick(HOSTILE));
        else delete (parent as Raw)[key];
      }
      const storage = memoryStorage();
      const s = makeStore({ storage });
      if (rand() < 0.5) s.startFromTemplate('turbojet');
      const json = rand() < 0.5 ? JSON.stringify(d) : JSON.stringify({ format: 'tfa-workshop', v: 1, families: [d, d], active: d?.family?.id, expert: false });
      const tag = `#${i} ${json.slice(0, 0)}`;
      expect(() => s.importDoc(json), tag).not.toThrow();
      expect(() => s.setKnob('combustor.tit', 1300, 'change'), tag).not.toThrow();
      expect(() => s.addVariant(), tag).not.toThrow();
      expect(() => s.undo(), tag).not.toThrow();
      expect(() => s.resetToTemplate(), tag).not.toThrow();
      let out = '';
      expect(() => (out = s.exportDoc()), tag).not.toThrow();
      if (s.state.project.families.length) expect(parseProjectDoc(out).errors, tag).toEqual([]);
      expect(() => makeStore({ storage }).resume(), tag).not.toThrow();
    }
    expect(({} as Raw).constructor).toBe(Object);
  });
});