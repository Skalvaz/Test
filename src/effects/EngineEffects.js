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
import { cutUniforms } from '../materials/engine';
import { effectiveHumidity, weather } from '../core/weather';

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

/**
 * Egzoz arkasında zeminde biriken kurum: jetin genişleyip zemine değdiği
 * yerden başlayan, akış yönünde uzayan koyu iz. Yoğunluğu çalışma boyunca
 * birikir (eski turbojet ve art yakıcı hızlı karartır, modern turbofan
 * rölantide neredeyse hiç).
 */
function sootDecal(noise) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uAmount: { value: 0 }, uNoise: { value: noise } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAmount;
      uniform sampler2D uNoise;
      varying vec2 vUv;
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float along = vUv.y;
        // iz genişler: jet zemine yayılır
        float width = mix(0.3, 1.0, smoothstep(0.0, 0.6, along));
        float lateral = 1.0 - smoothstep(width * 0.35, width, abs(x));
        float lengthwise = smoothstep(0.0, 0.18, along) * (1.0 - smoothstep(0.55, 1.0, along));
        float n = texture2D(uNoise, vec2(vUv.x * 1.5, vUv.y * 0.6)).r * 0.6 + texture2D(uNoise, vUv * vec2(4.0, 1.2)).g * 0.4;
        float streak = texture2D(uNoise, vec2(vUv.x * 7.0, vUv.y * 0.22)).b;
        float a = uAmount * 1.5 * lateral * lengthwise * (0.5 + 0.7 * n) * (0.75 + 0.5 * streak);
        gl_FragColor = vec4(vec3(0.035, 0.03, 0.027), clamp(a, 0.0, 0.82));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(Math.PI / 2); // v akış yönünde (+z)
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  mesh.name = 'exhaust-soot';
  mesh.visible = false;
  return { mesh, mat };
}

/**
 * Surge basınç dalgası: girişten öne doğru genişleyen yoğuşma halkası
 * (geri tepen akışın önündeki basınç cephesi nemli havayı bir anlığına
 * yoğuşturur). Halka düzlemi motor eksenine dik.
 */
function shockRing() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      uniform float uTime;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float ring = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.88, 1.0, r));
        float a = atan(vP.y, vP.x);
        float ragged = 0.65 + 0.35 * sin(a * 23.0 + uTime * 40.0) * sin(a * 7.0 - uTime * 15.0);
        gl_FragColor = vec4(vec3(0.95, 0.96, 0.98), ring * ragged * uAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat);
  mesh.visible = false;
  mesh.renderOrder = 5;
  mesh.name = 'surge-shock-ring';
  return { mesh, mat, t: 1 };
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
    this.floorY = FLOOR_Y;
    this.smoke.floorY = this.glow.floorY = FLOOR_Y + 0.03;
    this.flame = new AfterburnerFlame(geo.kind === 'turbojet' ? 'sooty' : 'clean');
    this.floor = floorGlow();
    this.sootDecal = sootDecal(noise);
    this.shock = shockRing();
    /** Zeminde birikmiş kurum 0..1 */
    this.soot = 0;
    // Art yakıcı alevinin motoru aydınlatan ışığı
    this.abLight = new THREE.PointLight(0xff8a3a, 0, 12, 2);
    this.group.add(this.smoke.mesh, this.glow.mesh, this.flame.mesh, this.floor.mesh, this.sootDecal.mesh, this.shock.mesh, this.abLight);

    // Girdap ekseni: girişin önünde, zeminden girişe
    const inl = geo.intake;
    this.smoke.vortexA.set(0, this.floorY + 0.02, inl.z - inl.radius * 1.1);
    this.smoke.vortexB.set(0, inl.y ?? 0, inl.z + 0.2);

    this.acc = {};
    this.prev = { lit: false, surge: 0, ab: false, fuelRun: false, phase: 'off' };
    this.shutdownTimer = 0;
    /** Art yakıcı: tutuşmuş zon sayısı (0..5, sürekli) ve hedef */
    this.abZones = 0;
    this.abZoneTarget = 0;
    /** Her yeni zon tutuşmasında artar (ses için) */
    this.zoneEvents = 0;
    this.vortexStrength = 0;
    /** Kaldırılabilir: kullanıcı ayarı */
    this.enabled = true;
    /** Yanma odası iç noktaları (setCombustor) ve buji tıkırtı zamanlayıcısı */
    this.comb = null;
    this.ignT = 0;
  }

  /**
   * Yanma odası içindeki efekt noktaları (efekt grubunun yerel uzayında):
   * buji uçları, enjektör/swirler çıkışları, alev bölgesi
   */
  setCombustor(c) {
    this.comb = c;
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

  /**
   * Zemin yüksekliği (ortama göre değişir: test hücresi −3.35 m, fotoğraf
   * ortamlarında motor yere daha yakın). Toz, yer girdabı, art yakıcı
   * yansıması ve parçacık çarpışması buna göre çalışır.
   */
  setFloor(y) {
    this.floorY = y;
    this.smoke.floorY = this.glow.floorY = y + 0.03;
    this.floor.mesh.position.y = y + 0.015;
    this.smoke.vortexA.y = y + 0.02;
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
    // Bağıl nem: yoğuşma efektleri (giriş girdabı, dudak, pervane ucu,
    // surge halkası, soğuk havada buhar) buna bağlı
    this.humidity = effectiveHumidity();
    const hum = this.humidity;
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
      // Surge: kompresörde akış tersine döner; yanma odasındaki alev
      // girişten öne doğru tükürülür, önünde bir basınç dalgası gider
      const inl = g.intake;
      this.shock.t = 0;
      this.puff(this.glow, 70, () => {
        const a = Math.random() * Math.PI * 2;
        const r = inl.radius * Math.sqrt(Math.random()) * 0.75;
        const core = Math.random() < 0.3;
        return {
          pos: [Math.cos(a) * r, (inl.y ?? 0) + Math.sin(a) * r, inl.z + 0.4],
          vel: [Math.cos(a) * rand(0, 3), Math.sin(a) * rand(0, 3) + rand(0, 1.5), -rand(8, 22)],
          life: rand(0.3, 0.7),
          size: [inl.radius * 0.3, inl.radius * rand(1.0, 2.0)],
          color: core ? [1.0, 0.8, 0.5, 2.0] : [1.0, 0.4, 0.09, 1.6],
          drag: 2.6,
          lift: 1.5,
          fadeIn: 0.02,
        };
      });
      // ardından girişten çıkan kirli duman
      this.puff(this.smoke, 30, () => {
        const a = Math.random() * Math.PI * 2;
        const r = inl.radius * Math.sqrt(Math.random()) * 0.7;
        return {
          pos: [Math.cos(a) * r, (inl.y ?? 0) + Math.sin(a) * r, inl.z + 0.2],
          vel: [rand(-1, 1), rand(0, 1.2), -rand(3, 8)],
          life: rand(1.5, 3),
          size: [inl.radius * 0.5, inl.radius * rand(2, 3.5)],
          color: [0.22, 0.2, 0.19, 0.4],
          drag: 1.5,
          lift: 0.4,
          fadeIn: 0.1,
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
      this.flame.trigger(0.8);
      this.puff(this.glow, 10, () => ({
        pos: this.exitPoint(0.6),
        vel: [rand(-0.8, 0.8), rand(-0.8, 0.8), rand(10, 20)],
        life: rand(0.15, 0.3),
        size: [R * 0.5, R * 1.6],
        color: [1.0, 0.6, 0.3, 0.9],
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

    /* ---------------- yanma odası içi (yalnız kesitte görünür) ---------------- */
    if (this.comb && cutUniforms.uCutOn.value > 0.5) this.combustorFx(snap, dt);

    /* ---------------- soğuk havada egzoz buharı ---------------- */
    // Yanma ürünlerindeki su buharı soğuk ve nemli havada yoğuşur: beyaz,
    // lülenin biraz gerisinde başlayan bulut (düşük güçte daha yoğun)
    const steam = snap.lit ? clamp((281 - snap.amb.T0) / 18, 0, 1) * (0.35 + 0.65 * this.humidity) : 0;
    if (steam > 0.02) {
      const n = this.count('steam', 45 * steam, dt);
      this.puff(this.smoke, n, () => {
        const p = this.exitPoint(0.8);
        p[2] += R * (2 + 4 * snap.thrustFrac) * rand(0.6, 1.2);
        return {
          pos: p,
          vel: [rand(-0.4, 0.4), rand(0, 0.5), jetSpeed * rand(0.35, 0.6)],
          life: rand(1.8, 3.2),
          size: [R * 0.9, R * rand(4, 7)],
          color: [0.93, 0.95, 0.97, 0.3 * steam],
          drag: 1.2,
          lift: 0.4,
          fadeIn: 0.25,
        };
      });
    }

    // Yağmurda sıcak lüle ve egzoz konisi üzerine düşen damlalar buharlaşır
    const hotPipe = smooth(snap.cycle.stations['7'].T, 600, 950);
    if (weather.rain > 0.05 && hotPipe > 0.02) {
      const n = this.count('rainSteam', 30 * weather.rain * hotPipe, dt);
      this.puff(this.smoke, n, () => {
        const a = rand(0.3, Math.PI - 0.3);
        const r = R * rand(1.0, 1.15);
        return {
          pos: [Math.cos(a) * r, Math.sin(a) * r, ex.z - rand(0, R * 1.5)],
          vel: [rand(-0.2, 0.2), rand(0.4, 0.9), rand(0.5, 2)],
          life: rand(0.8, 1.6),
          size: [R * 0.2, R * rand(0.8, 1.4)],
          color: [0.92, 0.93, 0.95, 0.18 * weather.rain],
          drag: 1,
          lift: 0.6,
          fadeIn: 0.2,
        };
      });
    }

    /* ---------------- art yakıcı ---------------- */
    // Kademeli yanma: zonlar sırayla (≈0,4 s arayla) tutuşur; gaz kolunun
    // art yakıcı bölümü kaç zonun yanacağını belirler. Kapanırken hızla söner.
    this.abZoneTarget = snap.abLit ? 1 + 4 * clamp(c.reheat ?? 1, 0, 1) : 0;
    const prevZones = this.abZones;
    if (this.abZones < this.abZoneTarget) this.abZones = Math.min(this.abZoneTarget, this.abZones + dt * 2.6);
    else this.abZones = Math.max(this.abZoneTarget, this.abZones - dt * 6);
    if (Math.floor(this.abZones) > Math.floor(prevZones) && this.abZones >= 1) {
      const k = Math.floor(this.abZones);
      this.zoneEvents++;
      this.flame.trigger(0.35 + 0.06 * k);
      // Tutuşan zonun halkasında kısa parlama
      this.puff(this.glow, 10 + 3 * k, () => {
        const a = Math.random() * Math.PI * 2;
        const rr = R * ((k - 0.5) / 5) * rand(0.85, 1.15);
        return {
          pos: [Math.cos(a) * rr, Math.sin(a) * rr, ex.z + 0.05],
          vel: [Math.cos(a) * rand(0, 1), Math.sin(a) * rand(0, 1), rand(8, 16)],
          life: rand(0.12, 0.3),
          size: [R * 0.25, R * 1.1],
          color: [1.0, 0.62, 0.32, 1.4],
          drag: 1.6,
          fadeIn: 0.02,
        };
      });
    }
    const ab = snap.abLevel * clamp(this.abZones / 5 + 0.2, 0, 1);
    this.flame.update(dt, camera, ab, ex.z, R, Math.max(1.05, snap.cycle.jetMach), this.abZones);
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

    /* ---------------- surge basınç dalgası ---------------- */
    {
      const sh = this.shock;
      sh.t += dt;
      const life = 0.38;
      sh.mesh.visible = sh.t < life;
      if (sh.mesh.visible) {
        const inl = g.intake;
        const k = sh.t / life;
        sh.mesh.position.set(0, inl.y ?? 0, inl.z - 0.3 - k * 1.2);
        sh.mesh.scale.setScalar(inl.radius * (1.05 + 3.2 * Math.sqrt(k)));
        sh.mat.uniforms.uAlpha.value = Math.pow(1 - k, 2) * (0.25 + 0.6 * this.humidity);
        sh.mat.uniforms.uTime.value += dt;
      }
    }

    /* ---------------- zeminde kurum ---------------- */
    {
      const sootRate = !snap.lit
        ? 0
        : (kind === 'turbojet' ? 0.6 + 0.8 * snap.N1 : kind === 'turboprop' ? 0.2 * snap.thrustFrac : 0.1 + 0.3 * snap.thrustFrac) + 1.6 * ab;
      this.soot += (sootRate * dt * (1 - this.soot)) / 300;
      // Jet (karışma katmanı ≈11° yarı açıyla genişler) zemine lüle yüksekliğine göre değer
      const h = Math.max(0.2, -this.floorY - R);
      const z0 = ex.z + h / 0.2;
      const len = 10 + 8 * ab;
      const d = this.sootDecal;
      d.mesh.visible = this.soot > 0.005 && h < 3;
      d.mesh.position.set(0, this.floorY + 0.03, z0 + len / 2 - 1.5);
      d.mesh.scale.set(R * 7 + 1.2, 1, len);
      d.mat.uniforms.uAmount.value = this.soot * THREE.MathUtils.clamp(1.6 - h / 2.5, 0.3, 1.2);
    }

    /* ---------------- hava efektleri ---------------- */
    // Yerden girişe yoğuşma girdabı: giriş yüksekliği/çap < ~1.6 ve yüksek akışta
    const inl = g.intake;
    const hOverD = ((inl.y ?? 0) - this.floorY) / (2 * inl.radius);
    const vortexTarget = kind === 'turboprop' ? 0 : smooth(snap.airflow, 0.55, 0.92) * smooth(2.0 - hOverD, 0, 0.6) * smooth(hum, 0.25, 0.75);
    this.vortexStrength += (vortexTarget - this.vortexStrength) * Math.min(1, dt * 1.5);
    if (this.vortexStrength > 0.02) {
      // Girdap yerde gezinir: gerçek zemin girdabı sabit durmaz
      const t = performance.now() * 0.0004;
      this.smoke.vortexA.x = Math.sin(t * 1.3) * inl.radius * 0.4;
      this.smoke.vortexA.z = inl.z - inl.radius * (1.0 + 0.3 * Math.sin(t));
      const n = this.count('vortex', 260 * this.vortexStrength, dt);
      this.puff(this.smoke, n, () => ({
        pos: [0, this.floorY, 0],
        life: 4,
        size: [inl.radius * 0.14, inl.radius * 0.4],
        color: [0.92, 0.94, 0.96, 0.13 * this.vortexStrength],
        vortex: { omega: 9, rho: inl.radius * rand(0.25, 0.5) },
        fadeIn: 0.15,
      }));
    }
    // Giriş dudağında yoğuşma: yüksek akışta statik basınç/sıcaklık düşer
    // Dudakta statik sıcaklık düşer; ancak nemli havada çiy noktasının altına iner
    const lip = smooth(snap.airflow, 0.75, 1.0) * (kind === 'turboprop' ? 0 : 1) * smooth(hum, 0.45, 0.9) * 1.4;
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
        pos: [rand(-1.6, 1.6), this.floorY + 0.05, reach + rand(-1.5, 3)],
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
      const load = clamp(snap.torque, 0, 1.1) * smooth(snap.propRpm / 1200, 0.6, 0.95) * (0.4 + 0.75 * smooth(hum, 0.4, 0.9));
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
          pos: [rand(-2, 2), this.floorY + 0.05, p.z + rand(-0.5, 2.5)],
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

  /**
   * Yanma odası içi: bujilerin tıkırtılı kıvılcımı (ateşleme açıkken ~2 Hz),
   * tutuşmadan önce enjektörlerden yakıt sisi, yanarken swirler çıkışlarında
   * mavi çekirdekli turuncu alev dilleri. Kesit düzleminin kaldırılan
   * tarafındaki noktalar atlanır (efektler kırpılmaz).
   */
  combustorFx(snap, dt) {
    const c = this.comb;
    const P = cutUniforms.uCutPlane.value;
    const w = new THREE.Vector3();
    const M = this.group.matrixWorld;
    const kept = (p) => {
      w.set(p[0], p[1], p[2]).applyMatrix4(M);
      return P.x * w.x + P.y * w.y + P.z * w.z + P.w > 0.02;
    };
    const h = c.flameZone.h;
    if (snap.igniting) {
      this.ignT += dt;
      while (this.ignT > 0.45) {
        this.ignT -= 0.45;
        for (const p of c.igniters) {
          if (!kept(p)) continue;
          this.glow.emit({ pos: p, life: 0.12, size: [h * 0.1, h * 0.3], color: [0.7, 0.8, 1.0, 2.5], fadeIn: 0.01 });
          for (let k = 0; k < 14; k++) {
            this.glow.emit({
              pos: p,
              vel: [rand(-1.5, 1.5), -rand(0.5, 2.5) * Math.sign(p[1] || 1), rand(-1, 2)],
              life: rand(0.1, 0.28),
              size: [h * 0.02, h * 0.008],
              color: [1.0, 0.9, 0.7, 2.2],
              drag: 3,
              fadeIn: 0.01,
            });
          }
        }
      }
    } else this.ignT = 0.44;
    const mist = !snap.lit && snap.controls.fuelRun && snap.wf > 1e-5;
    if (mist) {
      for (const [i, p] of c.injectors.entries()) {
        if (!kept(p)) continue;
        const n = this.count(`mist${i}`, 40, dt);
        for (let k = 0; k < n; k++) {
          this.smoke.emit({
            pos: [p[0], p[1], p[2]],
            vel: [rand(-0.35, 0.35), rand(-0.35, 0.35), rand(0.6, 1.4)],
            life: rand(0.4, 0.8),
            size: [h * 0.04, h * 0.3],
            color: [0.88, 0.9, 0.93, 0.55],
            drag: 2.2,
            fadeIn: 0.05,
          });
        }
      }
    }
    if (snap.lit) {
      // Alev dilleri gömleğin birincil bölgesinde kalır (≈ ilk %40):
      // seyreltme havası alevi orada keser
      const f = clamp(0.35 + snap.thrustFrac, 0.35, 1.3);
      const reach = (c.flameZone.z1 - c.flameZone.zDome) * 0.55;
      for (const [i, p] of c.injectors.entries()) {
        if (!kept(p)) continue;
        const n = this.count(`fl${i}`, 90 * f, dt);
        for (let k = 0; k < n; k++) {
          const blue = Math.random() < 0.35;
          const life = rand(0.1, 0.2);
          this.glow.emit({
            pos: [p[0] + rand(-0.15, 0.15) * h * 0.2, p[1] + rand(-0.15, 0.15) * h * 0.2, p[2] + (blue ? 0 : h * 0.08)],
            vel: [rand(-0.25, 0.25) * h, rand(-0.25, 0.25) * h, (reach / life) * rand(0.5, 1) * (blue ? 0.4 : 1)],
            life,
            size: blue ? [h * 0.06, h * 0.14] : [h * 0.1, h * 0.38],
            color: blue ? [0.35, 0.45, 1.0, 1.4] : [1.0, 0.48, 0.14, 1.5 * (0.6 + 0.4 * f)],
            drag: 1.2,
            fadeIn: 0.03,
          });
        }
      }
    }
  }

  /** Tutuşmuş zonların hedefe oranı (lüle açılması bununla senkron) */
  get abZoneFrac() {
    return this.abZoneTarget > 0 ? clamp(this.abZones / this.abZoneTarget, 0, 1) : 0;
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
    this.sootDecal.mat.dispose();
    this.shock.mat.dispose();
    this.shock.mesh.geometry.dispose();
    this.sootDecal.mesh.geometry.dispose();
  }
}
