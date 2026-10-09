/**
 * Artımlı üretim önbelleği (M5a P9): ayrıntı seviyesi başına ayrı nesil.
 * Atölyede taslak (düşük) ↔ tam (seçili kalite) geçişinde her seviye kendi
 * son neslinden yararlanır; taşınmayan parçalar seviyenin yeni üretimi
 * bitince atılır.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { beginBuild, endBuild, isLive, retainDetails, reuse, setDetailTag } from './buildCache.js';

const part = () => new THREE.Mesh(new THREE.BufferGeometry());
const disposed = (o: THREE.Mesh) => {
  const s = { done: false };
  o.geometry.addEventListener('dispose', () => (s.done = true));
  return s;
};

/** Bir model kurulumu: verilen anahtarlarla parça ister */
function build(detail: string, keys: string[]): Record<string, THREE.Mesh> {
  setDetailTag(detail);
  beginBuild();
  const out: Record<string, THREE.Mesh> = {};
  for (const k of keys) out[k] = reuse(k, part) as THREE.Mesh;
  endBuild();
  return out;
}

describe('buildCache: ayrıntı başına nesil', () => {
  it('tam model araya giren taslaklardan sonra kendi son neslinden yararlanır', () => {
    const full1 = build('high', ['fan', 'hpc']);
    const draft1 = build('low', ['fan', 'hpc']);
    expect(draft1.fan).not.toBe(full1.fan); // seviyeler karışmaz
    const draft2 = build('low', ['fan', 'hpc']);
    expect(draft2.fan).toBe(draft1.fan); // taslak ↔ taslak
    const full2 = build('high', ['fan', 'hpc']);
    expect(full2.fan).toBe(full1.fan); // taslaklardan sonra tam ↔ tam
    expect(full2.hpc).toBe(full1.hpc);
    const draft3 = build('low', ['fan', 'hpc']);
    expect(draft3.fan).toBe(draft1.fan); // tamdan sonra taslak ↔ taslak
  });

  it('öteki seviyenin son neslindeki geometriler canlı (eski model atılırken korunur)', () => {
    const full = build('high', ['lpt']);
    const draft = build('low', ['lpt']);
    expect(isLive(full.lpt.geometry)).toBe(true);
    expect(isLive(draft.lpt.geometry)).toBe(true);
    expect(isLive(new THREE.BufferGeometry())).toBe(false);
  });

  it('seviyenin yeni üretiminde taşınmayan parçalar atılır; taşınan ve paylaşılan atılmaz', () => {
    const a = build('medium', ['keep', 'drop', 'shared']);
    a.shared.geometry.userData.shared = true;
    const keep = disposed(a.keep);
    const drop = disposed(a.drop);
    const shared = disposed(a.shared);
    // Araya öteki seviye girer: 'medium' nesli beklemede, hiçbiri atılmaz
    build('low', ['keep', 'drop']);
    expect(drop.done).toBe(false);
    const b = build('medium', ['keep']);
    expect(b.keep).toBe(a.keep);
    expect(keep.done).toBe(false);
    expect(drop.done).toBe(true);
    expect(shared.done).toBe(false);
    expect(isLive(a.drop.geometry)).toBe(false);
  });

  it('kalite değişince bırakılan seviyenin nesli atılır (yalnız yeni kalite + taslak canlı)', () => {
    const hi = build('high', ['kq']);
    const lo = build('low', ['kq']);
    const hiGone = disposed(hi.kq);
    retainDetails(['medium', 'low']);
    const med = build('medium', ['kq']);
    expect(isLive(hi.kq.geometry)).toBe(false);
    expect(hiGone.done).toBe(true);
    expect(isLive(med.kq.geometry)).toBe(true);
    expect(isLive(lo.kq.geometry)).toBe(true); // taslak nesli korunur
    // Kalite taslakla aynı seviyeye inerse yalnız 'low' kalır
    const medGone = disposed(med.kq);
    retainDetails(['low', 'low']);
    expect(medGone.done).toBe(true);
    expect(isLive(lo.kq.geometry)).toBe(true);
  });

  it('aynı nesilde aynı anahtar ikinci kez istenirse yenisi üretilir', () => {
    setDetailTag('high');
    beginBuild();
    const x = reuse('dup', part);
    const y = reuse('dup', part);
    endBuild();
    expect(x).not.toBe(y);
  });
});
