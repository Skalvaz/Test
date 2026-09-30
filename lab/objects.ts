/** Laboratuvar nesneleri: M2 parçalarını tek başına incelemek için */
import * as THREE from 'three';
import { createBlade } from '../src/engine/blades.js';
import { bladeRow } from '../src/engine/geom.js';
import { compressorModule, turbineModule } from '../src/engine/stages.js';

const deg = THREE.MathUtils.degToRad;
type Mats = Record<string, THREE.Material>;
interface LabDef {
  build(m: Mats, q: URLSearchParams): THREE.Object3D;
  view?: string;
  dist?: number;
  target?: [number, number, number];
}

const hptOpts = {
  hub: 0.352,
  tip: 0.49,
  count: 62,
  chord: [0.105, 0.098],
  beta1: [deg(42), deg(30)],
  beta2: [deg(-66), deg(-62)],
  tmax: [0.3, 0.24],
  te: 0.035,
  xt: 0.3,
  sections: 16,
  samples: 34,
  root: 'firtree',
  tipType: 'squealer',
  platform: { depth: 0.04, over: 0.14 },
  rootDepth: 0.075,
};
const hpcOpts = {
  hub: 0.36,
  tip: 0.47,
  count: 56,
  chord: [0.085, 0.078],
  beta1: [deg(40), deg(58)],
  beta2: [deg(18), deg(40)],
  tmax: [0.09, 0.05],
  te: 0.01,
  xt: 0.42,
  sections: 12,
  samples: 30,
  root: 'dovetail',
  tipType: 'plain',
  rootDepth: 0.04,
};
const lptOpts = {
  hub: 0.345,
  tip: 0.56,
  count: 80,
  chord: [0.09, 0.085],
  beta1: [deg(30), deg(20)],
  beta2: [deg(-60), deg(-58)],
  tmax: [0.2, 0.14],
  te: 0.02,
  xt: 0.32,
  sections: 14,
  samples: 30,
  root: 'firtree',
  tipType: 'shroud',
  rootDepth: 0.05,
};

function one(opts: object, mat: THREE.Material) {
  const g = createBlade(opts);
  const m = new THREE.Mesh(g, mat);
  return m;
}
function row(opts: object, mat: THREE.Material, n: number, count: number) {
  // Halkanın yalnız n kanatlık dilimi (yakın plan)
  const g = createBlade(opts);
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(g, mat);
    m.rotation.z = ((i - n / 2) / count) * Math.PI * 2;
    grp.add(m);
  }
  return grp;
}

function group(...objs: THREE.Object3D[]) {
  const g = new THREE.Group();
  g.add(...objs);
  return g;
}
const hpcSpec = { part: 'hpc', stages: 9, z0: 0.82, z1: 1.52, hub: [0.312, 0.404], tip: [0.522, 0.438], blades: [44, 76], bore: [0.215, 0.035], igv: true, vsv: 4, casing: { flanges: [1.0, 1.36] }, cones: { front: [0.2, 0.7], aft: [0.2, 1.62] } };
const hptSpec = { part: 'hpt', stages: 2, z0: 2.05, z1: 2.21, hub: [0.352, 0.358], tip: [0.49, 0.503], blades: [62, 68], bore: [0.205, 0.06], casing: { flanges: [2.13] }, cones: { front: [0.2, 1.95] } };
const lptSpec = { part: 'lpt', stages: 5, z0: 2.36, z1: 2.84, hub: [0.34, 0.356], tip: [0.512, 0.602], blades: [74, 98], bore: [0.12, 0.03], casing: { flanges: [2.48, 2.72] }, cones: { aft: [0.11, 2.95] } };

export const LAB_OBJECTS: Record<string, LabDef> = {
  hpt: { build: (m) => one(hptOpts, m.superalloy), view: '1,0.35,-0.8', dist: 1.3 },
  hptRow: { build: (m) => row(hptOpts, m.superalloy, 7, 62), view: '1,0.7,-1', dist: 0.9 },
  hpc: { build: (m) => one(hpcOpts, m.hubMetal), view: '1,0.35,-0.8', dist: 1.4 },
  hpcRow: { build: (m) => row(hpcOpts, m.hubMetal, 8, 56), view: '1,0.7,-1', dist: 0.9 },
  lpt: { build: (m) => one(lptOpts, m.superalloy), view: '1,0.35,-0.8', dist: 1.3 },
  lptRow: { build: (m) => row(lptOpts, m.superalloy, 8, 80), view: '1,0.8,-0.6', dist: 0.8 },
  hptTop: { build: (m) => one(hptOpts, m.superalloy), view: '0.1,1,0.05', dist: 1.0 },
  hpcMod: {
    build: (m) => {
      const r = compressorModule(m, hpcSpec);
      return group(r.rotor, r.stator);
    },
    view: '1,0.25,0.1',
    dist: 0.9,
  },
  hptMod: {
    build: (m) => {
      const r = turbineModule(m, hptSpec);
      return group(r.rotor, r.stator);
    },
    view: '1,0.25,0.1',
    dist: 0.9,
  },
  lptMod: {
    build: (m) => {
      const r = turbineModule(m, lptSpec);
      return group(r.rotor, r.stator);
    },
    view: '1,0.25,0.1',
    dist: 0.9,
  },
  full: {
    build: (m) => {
      const g = createBlade(hptOpts);
      return bladeRow(g, m.superalloy, 62, { z: 0 });
    },
    view: '0.2,0.1,-1',
    dist: 0.9,
  },
};
