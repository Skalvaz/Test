/**
 * M5a P8: arayüz, ses, efekt ve kamera motor tipini (kind) değil türetilmiş
 * tipi (traits) okur. Dört şablonda düzen eskisiyle aynı kalmalı; kuru
 * turbojette art yakıcı kademesi/satırı, turboşaftta fan tonu olmamalı.
 */

import { describe, expect, it } from 'vitest';
import { SHAFT_WHINE_DIV, voiceTargets, type AudioEngine } from '../audio/EngineAudio';
import { fitViews, frameDesign, frameOf, KIND_VIEWS, scaleViews, VIEWS, viewsFor, type CameraView, type ViewName } from '../app/CameraRig';
import { CELL_BOUNDS } from '../core/testCell';
import { builtFor, TEMPLATES } from '../design/catalog';
import { deriveTraits, type EngineTraits } from '../design/traits';
import type { EngineGraph, EngineModule, ShaftModule } from '../design/types';
import type { PartId } from '../engine/visual';
import { PARTS, partInfo } from '../game/parts';
import { EngineSim, type EngineKind } from '../sim';
import { detentsFor } from './Cockpit';
import { cycleRows, hasStation19, stationIds } from './CycleDiagram';
import { eicasLayout } from './Eicas';

const KINDS = ['turbofan', 'militaryTurbofan', 'turbojet', 'turboprop'] as const;
const traitsOf = (k: (typeof KINDS)[number]) => builtFor(k)!.traits;

/** Art yakıcısız (kuru) turbojet: TJ şablonu, art yakıcı yok, sabit lüle (P5 şablonunun özü) */
function dryTurbojet(): EngineGraph {
  const g = structuredClone(TEMPLATES.turbojet!) as EngineGraph;
  g.modules = g.modules
    .filter((m) => m.type !== 'afterburner')
    .map((m) => (m.type === 'nozzle' ? { ...m, style: 'fixed' as const, cv: 0.98 } : m));
  return g;
}

/** Turboşaft (§3.5): TP gaz jeneratörü, pervane yerine önden çıkışlı mil, halka giriş */
function turboshaft(): EngineGraph {
  const g = structuredClone(TEMPLATES.turboprop!) as EngineGraph;
  const shaft: ShaftModule = { type: 'shaft', rpm: 20900, drive: 'front', reduction: false, transmissionEff: 0.985, gearboxLength: 0.35 };
  g.modules = g.modules.map((m): EngineModule => {
    if (m.type === 'propeller') return shaft;
    if (m.type === 'inlet') return { ...m, style: 'annular', separator: true };
    return m;
  });
  return g;
}

/** Trim edilmiş anlık durum (önbellekli: trim pahalı) */
const snaps = new Map<string, ReturnType<EngineSim['snapshot']>>();
function snapshotAt(kind: (typeof KINDS)[number], throttle: number) {
  const key = `${kind}@${throttle}`;
  let s = snaps.get(key);
  if (!s) {
    const sim = new EngineSim();
    sim.setDesign(builtFor(kind)!.design);
    sim.trim(throttle, 30);
    s = sim.snapshot();
    snaps.set(key, s);
  }
  return s;
}
/** Trim içeren testler yüklü makinede 5 s'yi aşabilir */
const SLOW = 60_000;

describe('gaz kolu kademeleri', () => {
  // Eski DETENTS[kind] tablosu (P8 öncesi)
  const OLD: Record<(typeof KINDS)[number], string> = {
    turbofan: 'IDLE@0 CL@0.82 TO@1',
    militaryTurbofan: 'IDLE@0 MIL@1 MAX@1.3',
    turbojet: 'IDLE@0 MIL@1 MAX@1.3',
    turboprop: 'G.IDLE@0 CLB@0.75 MAX@1',
  };
  const str = (d: { v: number; label: string }[]) => d.map((x) => `${x.label}@${x.v}`).join(' ');

  it.each(KINDS)('%s şablonunda eskisiyle aynı', (k) => {
    expect(str(detentsFor(traitsOf(k), builtFor(k)!.design))).toBe(OLD[k]);
  });

  it('kuru turbojette art yakıcı kademesi yok', () => {
    const t = deriveTraits(dryTurbojet());
    expect(t.presentation).toBe('turbojet');
    expect(t.afterburner).toBe(false);
    const d = detentsFor(t);
    expect(str(d)).toBe('IDLE@0 MIL@1');
    expect(d.every((x) => x.v <= 1)).toBe(true);
  });

  it('turboşaftta rölanti / uçuş, art yakıcı ve beta yok', () => {
    const t = deriveTraits(turboshaft());
    expect(t.presentation).toBe('turboshaft');
    expect(str(detentsFor(t))).toBe('IDLE@0 FLY@1');
  });

  it('art yakıcı traits\'te var ama simülasyon tasarımında yoksa kademe yok', () => {
    const t = traitsOf('turbojet');
    expect(str(detentsFor(t, { afterburner: undefined }))).toBe('IDLE@0 MIL@1');
  });
});

describe('EICAS düzeni', () => {
  const EXPECT: Record<(typeof KINDS)[number], ReturnType<typeof eicasLayout>> = {
    turbofan: { primary: 'n1', n1Label: 'N1', egtLabel: 'EGT', n2Label: 'N2', rows: { np: false, shp: false, ab: false, noz: false, thrust: true } },
    militaryTurbofan: { primary: 'n1', n1Label: 'N1', egtLabel: 'FTIT', n2Label: 'N2', rows: { np: false, shp: false, ab: true, noz: true, thrust: true } },
    turbojet: { primary: 'n1', n1Label: 'N1 LP', egtLabel: 'EGT', n2Label: 'N2', rows: { np: false, shp: false, ab: true, noz: true, thrust: true } },
    turboprop: { primary: 'torque', n1Label: 'N1', egtLabel: 'ITT', n2Label: 'NG', rows: { np: true, shp: true, ab: false, noz: false, thrust: true } },
  };
  it.each(KINDS)('%s şablonunda eskisiyle aynı', (k) => {
    expect(eicasLayout(traitsOf(k))).toEqual(EXPECT[k]);
  });

  it('kuru turbojette AB ve NOZ satırı yok', () => {
    const L = eicasLayout(deriveTraits(dryTurbojet()));
    expect(L.rows.ab).toBe(false);
    expect(L.rows.noz).toBe(false);
    expect(L.n1Label).toBe('N1 LP');
    expect(L.egtLabel).toBe('EGT');
  });

  it('turboşaftta TRQ, ITT, NG kadranları; NP ve SHP satırları; itki satırı yok', () => {
    const L = eicasLayout(deriveTraits(turboshaft()));
    expect(L).toEqual({ primary: 'torque', n1Label: 'N1', egtLabel: 'ITT', n2Label: 'NG', rows: { np: true, shp: true, ab: false, noz: false, thrust: false } });
  });
});

describe('motor içi diyagramı', () => {
  it('istasyon 7 ve art yakıcı satırları şablonlarda eskisiyle aynı', () => {
    for (const k of KINDS) {
      const t = traitsOf(k);
      const s = snapshotAt(k, 1);
      const bypass = s.cycle.bypassRatio > 0.05;
      const ab = k === 'militaryTurbofan' || k === 'turbojet';
      expect(stationIds(t, bypass).includes('7'), k).toBe(ab);
      const keys = cycleRows(s, t, bypass).map((r) => r[0]);
      expect(keys.includes('Art yakıcı'), k).toBe(ab);
      expect(keys.includes('Karışım / art yakıcı T7'), k).toBe(ab);
      expect(keys.includes('Mil gücü'), k).toBe(k === 'turboprop');
      expect(keys.includes('Pervane devri'), k).toBe(k === 'turboprop');
    }
  }, SLOW);

  it('kuru turbojette art yakıcı ve istasyon 7 yok; karışık akışta T7 var', () => {
    const s = snapshotAt('turbojet', 1);
    const dry = deriveTraits(dryTurbojet());
    expect(stationIds(dry, false)).not.toContain('7');
    const keys = cycleRows(s, dry, false).map((r) => r[0]);
    expect(keys).not.toContain('Art yakıcı');
    expect(keys).not.toContain('Lüle alanı A8');
    const mixedDry = { ...dry, exhaust: 'mixed' as const };
    expect(stationIds(mixedDry, true)).toContain('7');
    expect(cycleRows(s, mixedDry, true).map((r) => r[0])).toContain('Karışım T7');
  }, SLOW);

  it('baypas lülesi (19, V19) ayrık akışta ve şablonlarda var; art yakıcısız karışık akışta yok', () => {
    for (const k of ['turbofan', 'militaryTurbofan'] as const) {
      const t = traitsOf(k);
      expect(hasStation19(t, true), k).toBe(true);
      expect(cycleRows(snapshotAt(k, 1), t, true).map((r) => r[0]), k).toContain('Fan jet hızı V19');
    }
    const mixed = { ...traitsOf('turbofan'), exhaust: 'mixed' as const };
    expect(hasStation19(mixed, true)).toBe(false);
    const keys = cycleRows(snapshotAt('turbofan', 1), mixed, true).map((r) => r[0]);
    expect(keys).not.toContain('Fan jet hızı V19');
    expect(keys).toContain('Karışık jet hızı V9');
    expect(keys).toContain('Karışım T7');
  }, SLOW);

  it('turboşaftta mil gücü, NP ve tork satırları', () => {
    const s = snapshotAt('turboprop', 1);
    const keys = cycleRows(s, deriveTraits(turboshaft()), false).map((r) => r[0]);
    expect(keys).toContain('Mil gücü');
    expect(keys).toContain('Güç türbini devri NP');
    expect(keys).toContain('Çıkış torku');
    expect(keys).not.toContain('Pervane devri');
  }, SLOW);
});

describe('ses', () => {
  const engineOf = (k: (typeof KINDS)[number], output: EngineTraits['output']): AudioEngine => {
    const b = builtFor(k)!;
    return { output, fanBlades: b.design.fanBlades, fanDiameter: b.design.fanDiameter, turbineBlades: b.flowpath.gas.lpt.blades[1] };
  };

  it('turboşaftta fan tonu ve buzz-saw yok; güç türbini ve çekirdek ıslığı var', () => {
    // Turboşaft şablonu P7'de; ses yalnız çıkış tipine ve anlık değerlere bakar
    const s = snapshotAt('turboprop', 1);
    const b = builtFor('turboprop')!;
    const e: AudioEngine = { output: 'shaft', fanBlades: b.flowpath.gas.hpc.blades[0], fanDiameter: 2 * b.flowpath.gas.hpc.tip[0], turbineBlades: b.flowpath.gas.lpt.blades[1] };
    const v = voiceTargets(s, e, 1, 1);
    expect(v.fan.gain).toBe(0);
    expect(v.buzz.gain).toBe(0);
    expect(v.prop.gain).toBe(0);
    expect(v.pt.gain).toBeGreaterThan(0.02);
    expect(v.whine.gain).toBeGreaterThan(0.01);
    // Çekirdek ıslığı HPC ilk kademe kanat sayısından (alt harmoniği)
    expect(v.whine.freq).toBeCloseTo(((s.n2Rpm / 60) * e.fanBlades) / SHAFT_WHINE_DIV, 6);
    // Islıklar duyulur bantta (gerçek BPF ~13–20 kHz; T700 NG ~45 bin dev/dk'da da)
    expect(v.pt.freq).toBeLessThan(8000);
    expect(v.whine.freq).toBeLessThan(8000);
    const t700 = voiceTargets({ ...s, n2Rpm: 45000 }, e, 1, 1);
    expect(t700.whine.freq).toBeLessThan(8000);
  }, SLOW);

  it('turbofanda fan tonu, pervanede pal vızıltısı; ikisinde de güç türbini ıslığı yok', () => {
    const tf = voiceTargets(snapshotAt('turbofan', 1), engineOf('turbofan', 'thrust'), 1, 1, builtFor('turbofan')!.sized.point.thrust);
    expect(tf.fan.gain).toBeGreaterThan(0.02);
    expect(tf.prop.gain).toBe(0);
    expect(tf.pt.gain).toBe(0);
    // Yolcu turbofanında fan ucu süpersonik: buzz-saw duyulur
    expect(tf.buzz.gain).toBeGreaterThan(0);
    const tp = voiceTargets(snapshotAt('turboprop', 1), engineOf('turboprop', 'propeller'), 1, 1);
    expect(tp.fan.gain).toBe(0);
    expect(tp.prop.gain).toBeGreaterThan(0.05);
    expect(tp.pt.gain).toBe(0);
    // Çekirdek ıslığı şablonlarda eskisi gibi 38 kanat
    expect(tp.whine.freq).toBeCloseTo((snapshotAt('turboprop', 1).n2Rpm / 60) * 38, 6);
  }, SLOW);
});

describe('kamera açıları', () => {
  const src = (k: (typeof KINDS)[number], slot: 'workshop' | EngineKind = k) => {
    const b = builtFor(k)!;
    return { slot, traits: b.traits, layout: b.flowpath.layout, built: b };
  };

  it.each(KINDS)('%s şablon yuvasında elle ayarlı açılar aynen', (k) => {
    expect(viewsFor(src(k))).toBe(KIND_VIEWS[k]);
  });

  it('atölyede şablonla aynı motor aynı açıları alır, büyük motor uzaktan çekilir', () => {
    for (const k of KINDS) {
      // Şablon açılarının hepsi hücrenin içinde: sığdırma onları değiştirmez
      const ws = viewsFor(src(k, 'workshop'), src(k), { bounds: CELL_BOUNDS, maxDistance: 18 });
      for (const name of Object.keys(VIEWS) as ViewName[]) {
        if (name === 'menu') continue;
        const want = KIND_VIEWS[k][name] ?? VIEWS[name];
        ws[name]!.position.forEach((x, i) => expect(x).toBeCloseTo(want.position[i], 9));
        ws[name]!.target.forEach((x, i) => expect(x).toBeCloseTo(want.target[i], 9));
      }
    }
    const f = frameOf(src('turbojet'));
    const big = scaleViews(KIND_VIEWS.turbojet, f, { ...f, length: f.length * 2, diameter: f.diameter * 2 });
    const d = (v: { position: number[]; target: number[] }) => Math.hypot(...v.position.map((p, i) => p - v.target[i]));
    expect(d(big.side!)).toBeCloseTo(2 * d(KIND_VIEWS.turbojet.side!), 6);
    // Hücreye sığdırınca kamera yaklaşır, görüş açısı genişler: tan(fov/2)·uzaklık aynı
    const fit = fitViews(big, { bounds: CELL_BOUNDS, maxDistance: 18 });
    const s = fit.side!;
    expect(s.position[0]).toBeLessThanOrEqual(CELL_BOUNDS.max.x);
    expect(s.fov).toBeGreaterThan(big.side!.fov);
    const tanD = (v: CameraView) => Math.tan((v.fov * Math.PI) / 360) * d(v);
    expect(tanD(s)).toBeCloseTo(tanD(big.side!), 6);
  });

  it('elle ayarlı açısı olmayan tip (turboşaft) yerleşimden çerçevelenir; TJ çerçevesinde BARE açıları', () => {
    const tj = frameDesign(frameOf(src('turbojet')));
    const want = KIND_VIEWS.turbojet.side!;
    tj.side!.position.forEach((x, i) => expect(x).toBeCloseTo(want.position[i], 2));
    const ts = { ...src('turboprop'), traits: deriveTraits(turboshaft()) };
    const v = viewsFor(ts);
    expect(v).not.toBe(KIND_VIEWS.turboshaft);
    expect(Number.isFinite(v.front!.position[0])).toBe(true);
  });
});

describe('parça kartları', () => {
  it('şablonlarda kart traits ile de sunum tipiyle de aynı', () => {
    for (const k of KINDS) {
      for (const p of Object.keys(PARTS) as PartId[]) expect(partInfo(p, traitsOf(k))).toBe(partInfo(p, k));
    }
  });

  it('kuru turbojette sabit lüle, turboşaftta serbest güç türbini kartı', () => {
    expect(partInfo('nozzle', deriveTraits(dryTurbojet())).name).toBe('Sabit yakınsak lüle');
    expect(partInfo('lpt', deriveTraits(turboshaft())).name).toBe('Serbest güç türbini');
    expect(partInfo('combustor', { ...traitsOf('turbojet'), combustor: 'canAnnular' }).name).toBe('Kutu-halka yanma odası');
  });
});
