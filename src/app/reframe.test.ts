import { describe, expect, it } from 'vitest';
import { CELL_BOUNDS } from '../core/testCell';
import { builtFor, TEMPLATES } from '../design/catalog';
import { buildEngine } from '../design/graph';
import { KIND_VIEWS, viewsFor } from './CameraRig';
import { needsReframe } from './reframe';

/*
 * Motor değişince yeniden kadraj (App.setEngine, inceleme bulgusu 27).
 * Atölye yuvasında bütün açılar motora göre ölçeklenir ve hücreye sığdırılır;
 * şablon yuvasında yalnız elle ayarlı açılar (turbojet: BARE, turbofan: hiç).
 */

const FIT = { bounds: CELL_BOUNDS, maxDistance: 18 };

/** Atölyede 10 kg/s'lik küçük kuru turbojet (TJ şablonuna göre ölçekli açılar) */
function smallWorkshopViews() {
  const t = TEMPLATES.turbojetDry!;
  const { ops: _ops, ...g } = t;
  // Çalışabilirlik alanları şablondan (kayıt sahnesi m5a-kuru-turbojet gibi)
  const b = buildEngine({ ...g, massFlow: 10 }, { reference: buildEngine(t) });
  const ref = builtFor('turbojet')!;
  return viewsFor(
    { slot: 'workshop', traits: b.traits, layout: b.flowpath.layout, built: b },
    { layout: ref.flowpath.layout, built: ref },
    FIT,
  );
}

describe('motor değişince yeniden kadraj', () => {
  it('atölyeden şablon yuvasına dönüş: eski takımda olan açı yeniden kadrajlanır', () => {
    const ws = smallWorkshopViews();
    // Atölye takımında 'front' motora göre; şablon turbojette yok (VIEWS)
    expect(ws.front).toBeDefined();
    expect(KIND_VIEWS.turbojet.front).toBeUndefined();
    expect(ws.front!.position).not.toEqual([6.4, 1.9, -6.6]);
    expect(needsReframe('front', ws, KIND_VIEWS.turbojet)).toBe(true);
    expect(needsReframe('top', ws, KIND_VIEWS.turbojet)).toBe(true);
    // Yolcu turbofanının takımı boş: yan profil de atölye motorundan kalırdı
    expect(needsReframe('side', ws, KIND_VIEWS.turbofan)).toBe(true);
  });

  it('şablon yuvasından atölyeye geçiş yeniden kadrajlanır', () => {
    expect(needsReframe('front', KIND_VIEWS.turbojet, smallWorkshopViews())).toBe(true);
  });

  it('iki takımda da olmayan açı motorla değişmez; menü kadrajlanmaz; yakın açılar hep', () => {
    expect(needsReframe('front', KIND_VIEWS.turbojet, KIND_VIEWS.turbofan)).toBe(false);
    expect(needsReframe('side', KIND_VIEWS.turbofan, KIND_VIEWS.turbofan)).toBe(false);
    expect(needsReframe('side', KIND_VIEWS.turbofan, KIND_VIEWS.turbojet)).toBe(true);
    expect(needsReframe('menu', smallWorkshopViews(), KIND_VIEWS.turbojet)).toBe(false);
    expect(needsReframe('fan', KIND_VIEWS.turbofan, KIND_VIEWS.turbofan)).toBe(true);
    expect(needsReframe('inlet', KIND_VIEWS.turbofan, KIND_VIEWS.turbofan)).toBe(true);
  });
});
