/**
 * Motorun bütünü: parçaların birleştirilmesi ve çalışma modeli.
 *
 * Devir simülasyonu basit ama gerçekçi davranışlıdır: gaz kolu bir hedef N1
 * belirler, N1 birinci dereceden gecikmeyle (spool-up) bu hedefe yaklaşır,
 * N2 N1'i daha hızlı takip eder, EGT ise N2'nin gerisinden gelir. Böylece
 * gaz verince motorun "toparlanması" gözle görülür.
 */

import * as THREE from 'three';
import { buildNacelle } from './nacelle.js';
import { buildFan, FAN_BLADE_COUNT } from './fan.js';
import { buildCore } from './core.js';
import { buildPylon } from './pylon.js';
import { buildExhaustPlume } from './exhaust.js';

// Referans turbofan büyüklükleri (yaklaşık, yüksek baypas sınıfı)
export const SPEC = {
  fanDiameter: 2.77, // m
  n1Max: 2550, // rpm
  n2Max: 10100, // rpm
  egtIdle: 420, // °C
  egtMax: 905, // °C
  thrustMax: 340, // kN
  fuelMax: 2.85, // kg/s
  bypassRatio: 9.2,
};

const RPM_TO_RAD = (Math.PI * 2) / 60;

export function buildEngine(materials) {
  const root = new THREE.Group();
  root.name = 'turbofan';

  const nacelle = buildNacelle(materials);
  const fan = buildFan(materials);
  const core = buildCore(materials);
  const pylon = buildPylon(materials);
  const plume = buildExhaustPlume();

  // Fan rotoru LP milinin ön ucudur
  core.lpSpool.add(fan.group);

  root.add(nacelle, core.group, pylon.group, plume.mesh);

  root.traverse((obj) => {
    if (obj.isMesh || obj.isInstancedMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  plume.mesh.castShadow = false;
  plume.mesh.receiveShadow = false;
  fan.blurDisc.castShadow = false;
  fan.blurDisc.receiveShadow = false;

  /* ---------------- çalışma durumu ---------------- */
  const state = {
    throttle: 0.0, // 0 = rölanti kesik, 1 = tam gaz
    n1: 0.0, // 0..1
    n2: 0.0,
    egt: 20,
    spinScale: 0.055, // görsel devir ölçeği (gerçek devir göz için çok hızlı)
    running: true,
    motionBlur: true,
  };

  const lpAngle = { value: 0 };
  const hpAngle = { value: 0 };

  function update(dt) {
    const idle = state.running ? 0.21 : 0.0;
    const targetN1 = idle + (1 - idle) * state.throttle;

    // Birinci derece gecikme; gaz alırken daha yavaş, keserken daha hızlı
    const accel = targetN1 > state.n1 ? 0.55 : 0.95;
    state.n1 += (targetN1 - state.n1) * Math.min(1, dt * accel);

    const targetN2 = 0.46 + 0.54 * Math.pow(state.n1, 0.72);
    state.n2 += (targetN2 * (state.n1 > 0.01 ? 1 : 0) - state.n2) * Math.min(1, dt * 1.35);

    const targetEgt =
      state.n1 > 0.01
        ? SPEC.egtIdle + (SPEC.egtMax - SPEC.egtIdle) * Math.pow(state.n2, 2.4)
        : 20;
    state.egt += (targetEgt - state.egt) * Math.min(1, dt * 0.5);

    // Mil dönüşleri
    const lpRpm = state.n1 * SPEC.n1Max;
    const hpRpm = state.n2 * SPEC.n2Max;
    lpAngle.value += lpRpm * RPM_TO_RAD * state.spinScale * dt;
    hpAngle.value -= hpRpm * RPM_TO_RAD * state.spinScale * dt * 0.35;
    core.lpSpool.rotation.z = lpAngle.value;
    core.hpSpool.rotation.z = hpAngle.value;

    // Hareket bulanıklığı: devir arttıkça kanatların üzerine bindirilir
    const blurAmount = THREE.MathUtils.smoothstep(state.n1, 0.30, 0.78);
    fan.blurDisc.visible = state.motionBlur && blurAmount > 0.01;
    fan.blurMat.opacity = blurAmount * 0.52;
    fan.blurDisc.rotation.z = lpAngle.value * 0.35;

    // Yanma odası parlaklığı EGT ile
    const glow = THREE.MathUtils.clamp((state.egt - 300) / (SPEC.egtMax - 300), 0, 1);
    // Not: yanma odası kesit görünümünde açığa çıkar. Parlaklık bloom'u
    // taşırmayacak kadar ölçülü tutulur, yoksa tüm kare süte döner.
    materials.combustorGlow.emissiveIntensity = 0.5 + glow * 4.0;
    materials.combustorGlow.emissive.setHSL(
      THREE.MathUtils.lerp(0.055, 0.105, glow),
      1.0,
      THREE.MathUtils.lerp(0.32, 0.62, glow),
    );

    // Egzoz akışı
    plume.material.uniforms.uTime.value += dt;
    plume.material.uniforms.uThrust.value = THREE.MathUtils.smoothstep(state.n1, 0.25, 1.0);

    return state;
  }

  /**
   * Spool gecikmesini atlayıp durumu doğrudan gaz koluna oturtur.
   * (Sabit kare yakalama ve hazır görünüm geçişleri için.)
   */
  function snapToThrottle() {
    const idle = state.running ? 0.21 : 0.0;
    state.n1 = idle + (1 - idle) * state.throttle;
    state.n2 = state.n1 > 0.01 ? 0.46 + 0.54 * Math.pow(state.n1, 0.72) : 0;
    state.egt =
      state.n1 > 0.01
        ? SPEC.egtIdle + (SPEC.egtMax - SPEC.egtIdle) * Math.pow(state.n2, 2.4)
        : 20;
  }

  /** Anlık telemetri (gösterge paneli için). */
  function telemetry() {
    const thrust = SPEC.thrustMax * Math.pow(state.n1, 2.6);
    return {
      n1: state.n1 * 100,
      n2: state.n2 * 100,
      n1rpm: state.n1 * SPEC.n1Max,
      n2rpm: state.n2 * SPEC.n2Max,
      egt: state.egt,
      thrust,
      fuel: SPEC.fuelMax * Math.pow(state.n1, 2.1) * 0.98 + (state.running ? 0.06 : 0),
      tipMach: (state.n1 * SPEC.n1Max * RPM_TO_RAD * (SPEC.fanDiameter / 2)) / 340,
    };
  }

  return {
    root,
    state,
    update,
    snapToThrottle,
    telemetry,
    parts: { nacelle, fan, core, pylon, plume },
    bladeCount: FAN_BLADE_COUNT,
  };
}
