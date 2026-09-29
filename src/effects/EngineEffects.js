/**
 * Motor efektleri: simülasyon durumunu görsel olaylara çevirir.
 *
 * Çalıştırma: yakıt verilip tutuşma olmadan egzozdan beyaz yakıt buharı;
 *   light-off anında kısa is (siyah duman) bulutu, turuncu parlama ve
 *   kıvılcımlar; hızlanırken incelen gri duman; torching'de ateş topu.
 * Kapatma / alev sönmesi: dönerek yavaşlayan motordan yakıt buharı.
 * Surge: girişten ve egzozdan ateş patlaması, kıvılcım, duman.
 * Art yakıcı: hacimsel alev (şok elmasları), tutuşma parlaması, zemine
 *   vuran turuncu ışık.
 * Hava: giriş yere yakınsa yerden girişe kıvrılan yoğuşma girdabı (ground
 *   vortex), yüksek akışta giriş dudağında yoğuşma, egzozun zeminden
 *   kaldırdığı toz, pervane uçlarında sarmal yoğuşma izleri.
 * Eski turbojetler (düşük basınç oranı, zengin yanma) belirgin is bırakır.
 */

import * as THREE from 'three';
import { ParticleSystem } from './Particles.js';
import { AfterburnerFlame } from './AfterburnerFlame.js';

const FLOOR_Y = -3.35;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;

/** Zemine düşen art yakıcı ışığı: pişmiş (ışıksız) hücrede dinamik ışığın yerine */
function floorGlow() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: new THREE.Color(1.0, 0.45, 0.12),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = FLOOR_Y + 0.015;
  mesh.renderOrder = 3;
  mesh.name = 'ab-floor-glow';
  return { mesh, mat };
}

export class EngineEffects {
  /**
   * @param {object} geo { kind, intake:{z,radius,y}, exhaust:{z,radius} (canlı), prop?:{z,radius,blades} }
   * @param {THREE.Texture} noise
   */
  constructor(geo, noise) {
    this.geo = geo;
    this.group = new THREE.Group();
    this.group.name = 'engine-effects';
    this.smoke = new ParticleSystem('smoke', noise, 4500);
    this.glow = new ParticleSystem('glow', noise, 1400);
    this.smoke.floorY = this.glow.floorY = FLOOR_Y + 0.03;
    this.flame = new AfterburnerFlame(geo.kind === 'turbojet' ? 'sooty' : 'clean');
    this.floor = floorGlow();
    // Art yakıcı alevinin motoru aydınlatan ışığı
    this.abLight = new THREE.PointLight(0xff8a3a, 0, 12, 2);
    this.group.add(this.smoke.mesh, this.glow.mesh, this.flame.mesh, this.floor.mesh, this.abLight);

    // Girdap ekseni: girişin önünde, zeminden girişe
    const inl = geo.intake;
    this.smoke.vortexA.set(0, FLOOR_Y + 0.02, inl.z - inl.radius * 1.1);
    this.smoke.vortexB.set(0, inl.y ?? 0, inl.z + 0.2);

    this.acc = {};
    this.prev = { lit: false, surge: 0, ab: false, fuelRun: false, phase: 'off' };
    this.shutdownTimer = 0;
    this.vortexStrength = 0;
    /** Kaldırılabilir: kullanıcı ayarı */
    this.enabled = true;
  }

  /** dt içinde ortalama `rate` adet/s olayı için tetikleme sayısı */
  count(key, rate, dt) {
    const a = (this.acc[key] ?? 0) + rate * dt;
    const n = Math.floor(a);
    this.acc[key] = a - n;
    return n;
  }

  /** Lüle ağzında, çevre boyunca rastgele bir nokta */
  exitPoint(spread = 0.7) {
    const ex = this.geo.exhaust;
    const a = Math.random() * Math.PI * 2;
    const r = ex.radius * Math.sqrt(Math.random()) * spread;
    return [Math.cos(a) * r, Math.sin(a) * r, ex.z + 0.05];
  }

  puff(sys, n, opts) {
    for (let i = 0; i < n; i++) sys.emit(opts());
  }

  update(snap, dt, camera, propAngle = 0) {
    if (!this.enabled) {
      this.smoke.clear();
      this.glow.clear();
      this.flame.mesh.visible = false;
      this.floor.mat.opacity = 0;
      this.abLight.intensity = 0;
      return;
    }
    const g = this.geo;
    const ex = g.exhaust;
    const R = ex.radius;
    const kind = g.kind;
    const c = snap.controls;
    const prev = this.prev;
    const jetSpeed = clamp(4 + snap.thrustFrac * 22, 4, 30); // görsel akış hızı [m/s]

    /* ---------------- olay geçişleri ---------------- */
    if (snap.lit && !prev.lit && (snap.phase === 'lightoff' || snap.phase === 'accelerating')) {
      // Light-off: is bulutu + parlama + kıvılcım
      this.puff(this.smoke, 26, () => ({
        pos: this.exitPoint(),
        vel: [rand(-0.6, 0.6), rand(-0.2, 0.8), rand(3, 9)],
        life: rand(1.6, 3),
        size: [R * 0.6, R * rand(3, 5)],
        color: [0.12, 0.11, 0.1, 0.55],
        drag: 1.1,
        lift: 0.35,
      }));
      this.puff(this.glow, 10, () => ({
        pos: this.exitPoint(0.5),
        vel: [rand(-0.5, 0.5), rand(-0.5, 0.5), rand(4, 10)],
        life: rand(0.2, 0.45),
        size: [R * 0.5, R * 1.8],
        color: [1.0, 0.45, 0.12, 1.4],
        drag: 2,
        fadeIn: 0.02,
      }));
      this.sparks(28, 1);
    }
    if (snap.surgeCount > prev.surge) {
      // Surge: girişten geri tepen ateş + egzozdan patlama
      const inl = g.intake;
      this.puff(this.glow, 36, () => {
        const a = Math.random() * Math.PI * 2;
        const r = inl.radius * Math.sqrt(Math.random()) * 0.8;
        return {
          pos: [Math.cos(a) * r, (inl.y ?? 0) + Math.sin(a) * r, inl.z + 0.3],
          vel: [rand(-1.5, 1.5), rand(-1, 1.5), -rand(5, 14)],
          life: rand(0.25, 0.55),
          size: [inl.radius * 0.3, inl.radius * rand(0.9, 1.6)],
          color: [1.0, 0.42, 0.1, 1.6],
          drag: 2.2,
          fadeIn: 0.02,
        };
      });
      this.puff(this.glow, 30, () => ({
        pos: this.exitPoint(),
        vel: [rand(-1, 1), rand(-1, 1), rand(8, 18)],
        life: rand(0.3, 0.6),
        size: [R * 0.6, R * 2.4],
        color: [1.0, 0.5, 0.15, 1.6],
        drag: 1.8,
        fadeIn: 0.02,
      }));
      this.puff(this.smoke, 18, () => ({
        pos: this.exitPoint(),
        vel: [rand(-1, 1), rand(0, 1), rand(4, 10)],
        life: rand(1.5, 2.8),
        size: [R, R * 5],
        color: [0.2, 0.19, 0.18, 0.45],
        drag: 1,
        lift: 0.3,
      }));
      this.sparks(40, 1.4);
    }
    if (snap.abLit && !prev.ab) {
      this.flame.trigger();
      this.puff(this.glow, 14, () => ({
        pos: this.exitPoint(0.6),
        vel: [rand(-0.8, 0.8), rand(-0.8, 0.8), rand(10, 20)],
        life: rand(0.2, 0.4),
        size: [R * 0.8, R * 2.6],
        color: [1.0, 0.6, 0.3, 1.8],
        drag: 1.5,
        fadeIn: 0.02,
      }));
    }
    // Kapatma / sönme sonrası: sıcak motordan yakıt buharı çıkar
    if (!snap.lit && prev.lit) this.shutdownTimer = 7;
    this.shutdownTimer = Math.max(0, this.shutdownTimer - dt);
    prev.lit = snap.lit;
    prev.surge = snap.surgeCount;
    prev.ab = snap.abLit;

    /* ---------------- sürekli yayıcılar ---------------- */
    // Tutuşmadan önce verilen yakıt: beyaz buhar (ıslak çalıştırma belirtisi)
    if (!snap.lit && c.fuelRun && snap.wf > 1e-4 && snap.N2 > 0.05) {
      const n = this.count('vapor', 10 + 26 * clamp(snap.fuelPuddle * 8, 0, 1), dt);
      this.puff(this.smoke, n, () => ({
        pos: this.exitPoint(),
        vel: [rand(-0.3, 0.3), rand(0, 0.4), rand(1.5, 3) + snap.N2 * 8],
        life: rand(2.2, 3.4),
        size: [R * 0.4, R * rand(3, 5)],
        color: [0.86, 0.88, 0.9, 0.24],
        drag: 0.7,
        lift: 0.25,
      }));
    }
    if (this.shutdownTimer > 0 && snap.N2 > 0.08) {
      const k = this.shutdownTimer / 7;
      const n = this.count('shut', 14 * k, dt);
      this.puff(this.smoke, n, () => ({
        pos: this.exitPoint(),
        vel: [rand(-0.3, 0.3), rand(0.1, 0.5), rand(1, 2) + snap.N2 * 6],
        life: rand(2.5, 4),
        size: [R * 0.5, R * 4],
        color: [0.78, 0.8, 0.82, 0.16 * k],
        drag: 0.8,
        lift: 0.3,
      }));
    }
    // Hızlanma sırasında gri duman; eski turbojet çalışırken is bırakır
    const accel = snap.phase === 'lightoff' || snap.phase === 'accelerating';
    let smokeRate = accel ? 30 : 0;
    let smokeCol = [0.42, 0.41, 0.4, 0.2];
    if (kind === 'turbojet' && snap.lit && !snap.abLit) {
      smokeRate = Math.max(smokeRate, 20 + 70 * smooth(snap.N1, 0.4, 1));
      smokeCol = [0.24, 0.22, 0.2, 0.22 + 0.16 * snap.N1];
    }
    if (smokeRate > 0) {
      const n = this.count('smoke', smokeRate, dt);
      this.puff(this.smoke, n, () => ({
        pos: this.exitPoint(),
        // Jet çevre havayı sürükleyerek hızla yavaşlar: duman lüle arkasında
        // yoğun bir kuyruk oluşturur, sonra yükselip dağılır
        vel: [rand(-0.4, 0.4), rand(-0.1, 0.4), jetSpeed * rand(0.5, 0.8)],
        life: rand(2.5, 4.5),
        size: [R * 0.8, R * rand(5, 8)],
        color: smokeCol,
        drag: 1.3,
        lift: 0.35,
      }));
    }
    // Torching / sıcak çalıştırma: egzozdan alev topları
    const torch = snap.lit && snap.N2 < 0.55 ? clamp((snap.egtTrue - 900) / 600, 0, 1) : 0;
    if (torch > 0.05) {
      const n = this.count('torch', 70 * torch, dt);
      this.puff(this.glow, n, () => ({
        pos: this.exitPoint(),
        vel: [rand(-0.8, 0.8), rand(0, 1.2), rand(3, 8)],
        life: rand(0.3, 0.7),
        size: [R * 0.6, R * rand(2, 3.5)],
        color: [1.0, 0.4, 0.1, 1.3 * torch],
        drag: 1.4,
        lift: 1.5,
        fadeIn: 0.05,
      }));
      const m = this.count('torchSmoke', 20 * torch, dt);
      this.puff(this.smoke, m, () => ({
        pos: this.exitPoint(),
        vel: [rand(-0.5, 0.5), rand(0.3, 1), rand(2, 5)],
        life: rand(2, 3.5),
        size: [R, R * 6],
        color: [0.1, 0.09, 0.08, 0.5 * torch],
        drag: 0.8,
        lift: 0.6,
      }));
    }

    /* ---------------- art yakıcı ---------------- */
    const ab = snap.abLevel;
    this.flame.update(dt, camera, ab, ex.z, R, Math.max(1.05, snap.cycle.jetMach));
    const flicker = 0.85 + 0.3 * Math.random();
    const flameLen = R * (6 + 11 * Math.pow(ab, 0.8));
    this.floor.mesh.position.z = ex.z + flameLen * 0.45;
    this.floor.mesh.scale.set(4 + 6 * ab, flameLen * 1.4 + 4, 1);
    this.floor.mat.opacity = Math.pow(ab, 0.8) * 0.32 * flicker + this.flame.pop * 0.3;
    this.abLight.position.set(0, 0, ex.z + flameLen * 0.25);
    this.abLight.intensity = (Math.pow(ab, 0.8) * 60 + this.flame.pop * 80) * flicker;
    // Duman ve toz alevin ışığını alır
    const glowAmt = Math.pow(ab, 0.8) * 1.3 + torch * 1.6 + this.flame.pop * 1.2;
    const su = this.smoke.material.uniforms;
    su.uGlowPos.value.set(0, 0, ex.z + flameLen * 0.3);
    su.uGlowColor.value.setRGB(1.0, 0.45, 0.15).multiplyScalar(glowAmt * flicker);
    su.uGlowRadius.value = 1.5 + flameLen * 0.35;

    /* ---------------- hava efektleri ---------------- */
    // Yerden girişe yoğuşma girdabı: giriş yüksekliği/çap < ~1.6 ve yüksek akışta
    const inl = g.intake;
    const hOverD = ((inl.y ?? 0) - FLOOR_Y) / (2 * inl.radius);
    const vortexTarget = kind === 'turboprop' ? 0 : smooth(snap.airflow, 0.55, 0.92) * smooth(2.0 - hOverD, 0, 0.6);
    this.vortexStrength += (vortexTarget - this.vortexStrength) * Math.min(1, dt * 1.5);
    if (this.vortexStrength > 0.02) {
      // Girdap yerde gezinir: gerçek zemin girdabı sabit durmaz
      const t = performance.now() * 0.0004;
      this.smoke.vortexA.x = Math.sin(t * 1.3) * inl.radius * 0.4;
      this.smoke.vortexA.z = inl.z - inl.radius * (1.0 + 0.3 * Math.sin(t));
      const n = this.count('vortex', 260 * this.vortexStrength, dt);
      this.puff(this.smoke, n, () => ({
        pos: [0, FLOOR_Y, 0],
        life: 4,
        size: [inl.radius * 0.14, inl.radius * 0.4],
        color: [0.92, 0.94, 0.96, 0.13 * this.vortexStrength],
        vortex: { omega: 9, rho: inl.radius * rand(0.25, 0.5) },
        fadeIn: 0.15,
      }));
    }
    // Giriş dudağında yoğuşma: yüksek akışta statik basınç/sıcaklık düşer
    const lip = smooth(snap.airflow, 0.75, 1.0) * (kind === 'turboprop' ? 0 : 1);
    if (lip > 0.02) {
      const n = this.count('lip', 220 * lip, dt);
      this.puff(this.smoke, n, () => {
        const a = Math.random() * Math.PI * 2;
        const r = inl.radius * rand(0.8, 0.97);
        return {
          pos: [Math.cos(a) * r, (inl.y ?? 0) + Math.sin(a) * r, inl.z - 0.05],
          vel: [-Math.cos(a) * 0.6, -Math.sin(a) * 0.6, rand(4, 8)],
          life: rand(0.18, 0.35),
          size: [inl.radius * 0.12, inl.radius * 0.34],
          color: [0.95, 0.96, 0.98, 0.1 * lip],
          drag: 0.5,
          fadeIn: 0.2,
        };
      });
    }
    // Egzozun zeminden kaldırdığı toz: jet genişleyip zemine değdiği yerde
    const dust = smooth(snap.thrustFrac, 0.35, 1.1) + 0.8 * ab;
    if (dust > 0.02) {
      const n = this.count('dust', 50 * dust, dt);
      const reach = ex.z + 3 + 4 * snap.thrustFrac;
      this.puff(this.smoke, n, () => ({
        pos: [rand(-1.6, 1.6), FLOOR_Y + 0.05, reach + rand(-1.5, 3)],
        vel: [rand(-1.5, 1.5), rand(0.4, 1.6), jetSpeed * rand(0.4, 0.8)],
        life: rand(1.5, 2.8),
        size: [0.25, rand(1.2, 2.2)],
        color: [0.5, 0.47, 0.42, 0.1 * Math.min(1, dust)],
        drag: 0.9,
        grav: 0.4,
      }));
    }
    // Pervane: uç girdabı yoğuşması (sarmal iz) ve pervane rüzgârının tozu
    if (g.prop) {
      const p = g.prop;
      const load = clamp(snap.torque, 0, 1.1) * smooth(snap.propRpm / 1200, 0.6, 0.95);
      if (load > 0.35) {
        // Kare başına pervane büyük bir açı döner; iz sürekli bir sarmal
        // olsun diye önceki ve şimdiki pal açısı arası ara noktalarla doldurulur
        const k = (load - 0.35) / 0.75;
        const prevA = this.prevPropAngle ?? propAngle;
        const sweep = propAngle - prevA;
        const steps = Math.min(24, Math.max(1, Math.ceil(Math.abs(sweep) / 0.1)));
        const v = 4 + 7 * load;
        for (let b = 0; b < p.blades; b++) {
          for (let j = 1; j <= steps; j++) {
            const f = j / steps;
            const a = prevA + sweep * f + (b / p.blades) * Math.PI * 2 + Math.PI / 2;
            this.smoke.emit({
              pos: [Math.cos(a) * p.radius * 0.99, Math.sin(a) * p.radius * 0.99, p.z + 0.1 + v * dt * (1 - f)],
              vel: [0, 0, v],
              life: rand(0.45, 0.7),
              size: [0.07, 0.22],
              color: [0.96, 0.97, 0.99, 0.32 * k],
              drag: 0.6,
              fadeIn: 0.05,
              spin: 0,
            });
          }
        }
      }
      this.prevPropAngle = propAngle;
      const wash = load;
      if (wash > 0.2) {
        const n = this.count('wash', 45 * wash, dt);
        this.puff(this.smoke, n, () => ({
          pos: [rand(-2, 2), FLOOR_Y + 0.05, p.z + rand(-0.5, 2.5)],
          vel: [rand(-2, 2), rand(0.3, 1.2), 8 * wash * rand(0.6, 1)],
          life: rand(1.2, 2.2),
          size: [0.2, rand(1, 1.8)],
          color: [0.5, 0.47, 0.42, 0.09 * wash],
          drag: 0.9,
          grav: 0.3,
        }));
      }
    }

    this.smoke.update(dt);
    this.glow.update(dt);
  }

  /** Egzozdan savrulan parlak kıvılcımlar (yerçekimiyle düşer, zeminde seker) */
  sparks(n, speed) {
    this.puff(this.glow, n, () => ({
      pos: this.exitPoint(0.6),
      vel: [rand(-2, 2) * speed, rand(-0.5, 3) * speed, rand(6, 16) * speed],
      life: rand(0.5, 1.2),
      size: [0.035, 0.02],
      color: [1.0, 0.72, 0.3, 2.2],
      drag: 0.4,
      grav: 9.8,
      fadeIn: 0.01,
    }));
  }

  dispose() {
    this.smoke.dispose();
    this.glow.dispose();
    this.flame.material.dispose();
    this.flame.mesh.geometry.dispose();
    this.floor.mat.map.dispose();
    this.floor.mat.dispose();
    this.floor.mesh.geometry.dispose();
  }
}
