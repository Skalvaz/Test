/**
 * Zamana bağlı motor simülatörü.
 *
 * Durum değişkenleri mil açısal hızları, yanma durumu ve yakıt akışıdır.
 * Her alt adımda `computeCycle` bütün istasyonları ve bileşen güçlerini verir;
 * türbin ile kompresör arasındaki güç farkı milleri hızlandırır ya da
 * yavaşlatır:  I · dω/dt = (P_türbin·η_mek − P_kompresör − P_kayıp) / ω + τ_marş
 *
 * FADEC, gerçek motor kontrol birimlerindeki min/max seçimli yapıyla
 * modellenmiştir: N1 izleme ve N2 rölanti döngüleri hız biçiminde PI
 * denetleyicilerdir; sonuç ivmelenme (surge) ve yavaşlama (sönme) sınırları
 * arasına kırpılır.
 */

import { ambient, type Ambient } from './atmosphere';
import { computeCycle, HEALTHY, surgeFuelFlow, type CycleResult, type Health } from './cycle';
import {
  DEFAULT_DESIGN,
  sizeEngine,
  TURBOFAN_LIMITS,
  type EngineDesign,
  type EngineKind,
  type EngineLimits,
  type SizedEngine,
} from './design';

export type FadecMode = 'normal' | 'manual';

export interface Controls {
  /** APU'dan marş havası (bleed) */
  apuBleed: boolean;
  /** Marş anahtarı (GRD) — %56 N2'de otomatik kapanır */
  starter: boolean;
  ignition: boolean;
  /** Yakıt kontrol / start kolu: false = CUTOFF, true = RUN (IDLE) */
  fuelRun: boolean;
  /** Gaz kolu açısı 0 (rölanti) … 1 (kalkış) */
  throttle: number;
  fadec: FadecMode;
  /** Manuel yakıt modunda dozaj valfi 0..1 (tasarım yakıtının 1.15 katına kadar) */
  manualFuel: number;
  /** Art yakıcı kademesi 0 (kapalı) … 1 (tam); gaz kolu MIL'deyken etkin */
  reheat: number;
}

export interface Flight {
  altitude: number;
  mach: number;
  isaDev: number;
}

export interface Failures {
  starter: boolean;
  igniter: boolean;
}

export type StartPhase = 'off' | 'motoring' | 'lightoff' | 'accelerating' | 'running' | 'spooldown';

export type SimEventType =
  | 'lightoff'
  | 'flameout'
  | 'shutdown'
  | 'surge'
  | 'hotStart'
  | 'hungStart'
  | 'wetStart'
  | 'torching'
  | 'starterCutout'
  | 'noBleed'
  | 'idle'
  | 'egtRedline'
  | 'n1Overspeed'
  | 'n2Overspeed'
  | 'birdStrike'
  | 'turbineDamage'
  | 'egtLimiting'
  | 'abLight'
  | 'abOff';

export type Severity = 'info' | 'caution' | 'warning';

export interface SimEvent {
  type: SimEventType;
  time: number;
  severity: Severity;
  message: string;
}

/**
 * Varsayılan (yüksek baypaslı turbofan) sınırları. Dersler bu motorla yazıldı;
 * seçilen motorun sınırları için `EngineSim.limits` kullanılır.
 */
export const LIMITS: EngineLimits = TURBOFAN_LIMITS;

const SUBSTEP = 1 / 240;
const KELVIN = 273.15;
const EGT_SENSOR_TAU = 0.9; // s — termokupl gecikmesi
/*
 * Aşağıdaki katsayılar ilk (yüksek baypaslı) motorda ayarlandı ve motorun
 * tasarım yakıt akışı ya da çekirdek akışıyla ölçeklenir; böylece aynı FADEC
 * ve çalıştırma mantığı 9 kg/s'lik turboproptan 1150 kg/s'lik turbofana kadar
 * aynı davranır.
 */
const WF_MIN_START_PER_CORE = 4.78e-4; // (kg/s yakıt) / (kg/s çekirdek havası)
const START_SLEW_PER_WF = 0.0925; // 1/s — tasarım yakıtının oranı
const FADEC_GAIN_PER_WF = 0.936; // hız biçimli PI çıkışını yakıta çevirir
const LIGHT_MIN_W3_PER_CORE = 0.0026;
const PUDDLE_TORCH_PER_CORE = 0.00217; // kg / (kg/s)
const PUDDLE_WET_PER_CORE = 0.0039;
const LP_FRICTION = 2.84e-4; // LP mil sürtünmesi / tasarım torku
/** Pervane valisi (turboprop) */
const PITCH_MIN = 0.03;
const PITCH_MAX = 1.8;
/** Test hücresinde uçuş koşullarının değişim hızı (oyun zamanı) */
const FLIGHT_SLEW = { altitude: 450, mach: 0.12, isaDev: 6 };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface SimSnapshot {
  time: number;
  N1: number;
  N2: number;
  n1Rpm: number;
  n2Rpm: number;
  egt: number; // °C (sensör)
  egtTrue: number; // °C
  wf: number; // kg/s
  thrust: number; // N
  tsfc: number; // kg/(N·s)
  lit: boolean;
  surging: boolean;
  phase: StartPhase;
  starterEngaged: boolean;
  igniting: boolean;
  oilPressure: number; // psi
  vibration: number; // birim
  cycle: CycleResult;
  amb: Ambient;
  controls: Readonly<Controls>;
  fuelPuddle: number;
  surgeCount: number;
  /** FADEC'in N1 hedefi (EICAS'ta magenta imleç) — manuel modda null */
  n1Command: number | null;
  egtLimited: boolean;
  turbineDamaged: boolean;
  /** Yakıt açık ama alev yok ve motor yavaşlıyor */
  flamedOut: boolean;
  kind: EngineKind;
  limits: EngineLimits;
  /** FADEC'in N2 hedefi (turboprop gaz jeneratörü yönetimi) */
  n2Command: number | null;
  /** Art yakıcı */
  abLit: boolean;
  wfAb: number;
  /** Art yakıcı yanma oranı 0..1 */
  abLevel: number;
  /** Lüle boğaz alanı / kuru tasarım (rölantide açık, MIL'de kapalı, AB'de açık) */
  nozzleArea: number;
  /** Turboprop */
  propRpm: number;
  /** Tork, tasarımın oranı (1 = %100) */
  torque: number;
  shaftPower: number;
  propThrust: number;
  /** Pervane pal yükü (vali çıkışı), 0 = ince pal … */
  propPitch: number;
  /** Giriş hava akışı / tasarım akışı (efektler için) */
  airflow: number;
  /** Net itki / tasarım (kuru) itkisi */
  thrustFrac: number;
}

type Listener = (e: SimEvent) => void;

export class EngineSim {
  eng: SizedEngine;
  controls: Controls = {
    apuBleed: false,
    starter: false,
    ignition: false,
    fuelRun: false,
    throttle: 0,
    fadec: 'normal',
    manualFuel: 0,
    reheat: 0,
  };
  /** Anlık uçuş koşulları (hedefe doğru kademeli ilerler) */
  flight: Flight = { altitude: 0, mach: 0, isaDev: 0 };
  /** Hedef uçuş koşulları */
  flightTarget: Flight = { altitude: 0, mach: 0, isaDev: 0 };
  health: Health = { ...HEALTHY };
  failures: Failures = { starter: false, igniter: false };
  /** Fan hasarı (kuş çarpması): titreşim göstergesini etkiler */
  fanDamage = 0;
  /** Aşırı sıcaklıktan kalıcı türbin hasarı oldu mu */
  turbineDamaged = false;
  /** FADEC şu an EGT sınırlaması yapıyor mu */
  egtLimited = false;
  /** FADEC'in son N1 hedefi */
  n1Command: number | null = null;

  time = 0;
  N1 = 0;
  N2 = 0;
  wf = 0;
  lit = false;
  surging = false;
  phase: StartPhase = 'off';
  egtSensor: number;
  fuelPuddle = 0;
  surgeCount = 0;
  /** Art yakıcı */
  wfAb = 0;
  abLit = false;
  /** FADEC'in N2 hedefi (turboprop) */
  n2Command: number | null = null;
  /** Pervane */
  propPitch = PITCH_MIN;
  propPower = 0;
  propThrust = 0;

  private amb: Ambient;
  private last: CycleResult;
  private listeners: Listener[] = [];
  private surgeTimer = 0;
  private recoveryTimer = 0;
  private ignitionTimer = 0;
  private torchTimer = 0;
  private hungTimer = 0;
  private prevN2 = 0;
  private prevN1Err = 0;
  private prevN2Err = 0;
  private governing = false;
  private overTempTime = 0;
  private surgeWfCache = Infinity;
  private surgeWfAge = 99;
  private flags = new Set<SimEventType>();
  private abTimer = 0;
  private prevNpErr = 0;

  constructor(design: EngineDesign = DEFAULT_DESIGN) {
    this.eng = sizeEngine(design);
    this.amb = ambient(0, 0, 0);
    this.egtSensor = this.amb.T0 - KELVIN;
    this.last = this.evaluate();
  }

  /** Seçili motorun sınırları */
  get limits(): EngineLimits {
    return this.eng.design.limits;
  }

  get kind(): EngineKind {
    return this.eng.design.kind;
  }

  /** Başka bir motora geçer: yeniden boyutlandırır ve soğuk, durmuş hale getirir. */
  setDesign(design: EngineDesign) {
    this.eng = sizeEngine(design);
    this.reset();
  }

  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /**
   * Uçuş koşullarını değiştirir. Varsayılan olarak koşullar hedefe doğru
   * kademeli ilerler (tırmanma/hızlanma gibi); `immediate` ile anında atlar.
   */
  setFlight(f: Partial<Flight>, immediate = false) {
    Object.assign(this.flightTarget, f);
    if (immediate) this.snapFlight();
  }

  private snapFlight() {
    Object.assign(this.flight, this.flightTarget);
    this.updateAmbient();
  }

  private updateAmbient() {
    this.amb = ambient(this.flight.altitude, this.flight.mach, this.flight.isaDev);
  }

  private slewFlight(dt: number) {
    const f = this.flight;
    const t = this.flightTarget;
    if (f.altitude === t.altitude && f.mach === t.mach && f.isaDev === t.isaDev) return;
    const step = (cur: number, tgt: number, rate: number) =>
      cur + clamp(tgt - cur, -rate * dt, rate * dt);
    f.altitude = step(f.altitude, t.altitude, FLIGHT_SLEW.altitude);
    f.mach = step(f.mach, t.mach, FLIGHT_SLEW.mach);
    f.isaDev = step(f.isaDev, t.isaDev, FLIGHT_SLEW.isaDev);
    this.updateAmbient();
  }

  get ambientState(): Ambient {
    return this.amb;
  }

  get cycle(): CycleResult {
    return this.last;
  }

  /* ------------------------------------------------------------------ */

  private emit(type: SimEventType, severity: Severity, message: string) {
    const e: SimEvent = { type, time: this.time, severity, message };
    for (const l of this.listeners) l(e);
  }

  /** Aynı olay koşul sürdükçe bir kez bildirilir; koşul kalkınca sıfırlanır. */
  private latch(type: SimEventType, active: boolean, severity: Severity, message: string) {
    if (active && !this.flags.has(type)) {
      this.flags.add(type);
      this.emit(type, severity, message);
    } else if (!active) {
      this.flags.delete(type);
    }
  }

  private evaluate(wfExtra = 0): CycleResult {
    return computeCycle({
      eng: this.eng,
      amb: this.amb,
      N1: this.N1,
      N2: this.N2,
      wf: this.wf + wfExtra,
      lit: this.lit,
      surging: this.surging,
      health: this.health,
      wfAb: this.wfAb,
    });
  }

  get starterEngaged(): boolean {
    return (
      this.controls.starter &&
      this.controls.apuBleed &&
      !this.failures.starter &&
      this.N2 < this.limits.starterCutout + 0.02
    );
  }

  /** FADEC surge anında ve sonrasında ateşleyicileri otomatik açar (auto-relight). */
  get autoRelight(): boolean {
    return this.controls.fadec === 'normal' && (this.surging || this.recoveryTimer > 0);
  }

  get igniting(): boolean {
    return (
      (this.controls.ignition || this.autoRelight) &&
      !this.failures.igniter &&
      this.controls.fuelRun
    );
  }

  /* ------------------------------------------------------------------ */

  step(dt: number) {
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP, remaining);
      this.substep(h);
      remaining -= h;
    }
  }

  private substep(dt: number) {
    const d = this.eng.design;
    const r = this.eng.ref;
    const c = this.controls;
    const L = this.limits;
    this.time += dt;
    this.slewFlight(dt);

    /* ---------- yakıt kontrolü ---------- */
    this.updateFuel(dt);
    this.updateAfterburner(dt);

    /* ---------- birikmiş yakıtın alev alması (torching) ---------- */
    let wfExtra = 0;
    if (this.torchTimer > 0) {
      const burn = Math.min(this.fuelPuddle, (this.fuelPuddle / this.torchTimer) * dt);
      wfExtra = burn / dt;
      this.fuelPuddle -= burn;
      this.torchTimer = Math.max(0, this.torchTimer - dt);
    }

    /* ---------- çevrim ---------- */
    const cyc = this.evaluate(wfExtra);
    this.last = cyc;
    const W3 = cyc.stations['3'].W;
    const farFed = W3 > 1e-6 ? this.wf / W3 : 0;

    /* ---------- ateşleme / sönme ---------- */
    if (!this.lit) {
      const canLight =
        this.igniting &&
        this.wf > 1e-4 &&
        W3 > LIGHT_MIN_W3_PER_CORE * r.coreFlow &&
        farFed > L.ignitionMinFar;
      this.ignitionTimer = canLight ? this.ignitionTimer + dt : 0;
      if (this.ignitionTimer > 1.1) {
        this.lit = true;
        this.ignitionTimer = 0;
        this.phase = 'lightoff';
        this.emit('lightoff', 'info', 'Ateşleme gerçekleşti (light-off). EGT yükseliyor.');
        if (this.fuelPuddle > PUDDLE_TORCH_PER_CORE * r.coreFlow) {
          this.torchTimer = 1.4;
          this.emit(
            'torching',
            'warning',
            'Birikmiş yakıt tutuştu: egzozdan alev çıkışı (torching)!',
          );
        }
      }
      // Yanmayan yakıt yanma odasında birikir
      if (this.wf > 0) this.fuelPuddle += this.wf * dt;
      else this.fuelPuddle = Math.max(0, this.fuelPuddle - 0.012 * W3 * dt); // kuru motorlama havalandırır
      this.latch(
        'wetStart',
        this.fuelPuddle > PUDDLE_WET_PER_CORE * r.coreFlow && !this.lit,
        'warning',
        'Islak çalıştırma: yakıt veriliyor ama ateşleme yok. Yakıtı kesip motoru kuru çevirin.',
      );
    } else {
      const noFuel = !c.fuelRun || this.wf < 1e-4;
      // Surge sırasında akış geçici olarak çöker; oran anlamsızdır
      const lean =
        farFed < L.leanBlowoutFar && this.N2 > 0.3 && !this.surging && this.recoveryTimer <= 0;
      if (noFuel || lean) {
        this.lit = false;
        this.phase = 'spooldown';
        if (!c.fuelRun) {
          this.emit('shutdown', 'info', 'Yakıt kesildi, motor duruyor.');
        } else {
          this.emit('flameout', 'warning', 'ALEV SÖNMESİ (flameout)! Yakıt/hava oranı çok düşük.');
        }
      }
    }

    /* ---------- surge ---------- */
    if (this.surging) {
      this.surgeTimer -= dt;
      if (this.surgeTimer <= 0) this.surging = false;
    } else if (cyc.surgeRequired && this.lit && this.N2 > 0.45) {
      this.surging = true;
      this.surgeTimer = 0.32;
      this.surgeCount++;
      this.recoveryTimer = 1.6;
      this.emit(
        'surge',
        'warning',
        'KOMPRESÖR SURGE! Akış tersine döndü — yakıtı azaltın, EGT\'yi izleyin.',
      );
    }

    /* ---------- mil dinamiği ---------- */
    const eta = d.eff.mech;
    const w1 = this.N1 * r.omega1;
    const w2 = this.N2 * r.omega2;
    const w1f = Math.max(w1, 0.04 * r.omega1);
    const w2f = Math.max(w2, 0.04 * r.omega2);

    // Kayıplar doğrudan tork olarak: duruşta yalnızca yatak/conta sürtünmesi,
    // devirle artan aksesuar yükü (yağ/yakıt pompaları, jeneratör) ve rüzgarlanma.
    // (Gücü düşük devirde ω'ya bölmek duruşta sahte, çok büyük bir tork verir.)
    const accTorque = d.accessoryPower / r.omega2;
    const hpTorqueLoss =
      accTorque * (0.12 + 0.88 * this.N2) + ((0.004 * r.hpPower) / r.omega2) * this.N2;
    const lpDesignTorque = r.lpPower / r.omega1;
    const lpTorqueLoss = lpDesignTorque * (LP_FRICTION + 0.003 * this.N1);
    const hpTorqueAero = (cyc.hptPower * eta - cyc.hpcPower) / w2f;
    this.updatePropeller(dt);
    const lpTorqueAero =
      (cyc.lptPower * eta - cyc.fanPower - cyc.boosterPower - this.propPower) / w1f;

    // Marş motoru: tork hızla doğrusal azalır
    const starterTorque = this.starterEngaged
      ? d.start.starterTorque * Math.max(0, 1 - this.N2 / d.start.starterFadeN2)
      : 0;

    let a2 = (hpTorqueAero - hpTorqueLoss + starterTorque) / d.inertia.hp;
    let a1 = (lpTorqueAero - lpTorqueLoss) / d.inertia.lp;
    // Dururken sürtünme ters yönde döndüremez
    if (this.N2 <= 0 && a2 < 0) a2 = 0;
    if (this.N1 <= 0 && a1 < 0) a1 = 0;

    this.prevN2 = this.N2;
    this.N2 = Math.max(0, this.N2 + (a2 * dt) / r.omega2);
    this.N1 = Math.max(0, this.N1 + (a1 * dt) / r.omega1);

    /* ---------- sensörler ---------- */
    const egtTrue = cyc.stations['45'].T - KELVIN;
    this.egtSensor += (egtTrue - this.egtSensor) * Math.min(1, dt / EGT_SENSOR_TAU);

    /* ---------- aşırı sıcaklık hasarı ---------- */
    if (egtTrue > L.egtDamage) this.overTempTime += dt;
    else this.overTempTime = Math.max(0, this.overTempTime - dt * 0.5);
    if (!this.turbineDamaged && this.overTempTime > L.egtDamageSeconds) {
      this.turbineDamaged = true;
      this.health.hptEta *= 0.9;
      this.health.lptEta *= 0.93;
      this.emit(
        'turbineDamage',
        'warning',
        'TÜRBİN HASARI: kanatlar aşırı ısındı ve deforme oldu. Motor verimi kalıcı olarak düştü.',
      );
    }

    /* ---------- faz ve olaylar ---------- */
    this.updatePhase(dt);
    this.checkLimits();
  }

  private updatePhase(dt: number) {
    const c = this.controls;
    const LIMITS = this.limits;

    if (c.starter && !c.apuBleed) {
      this.latch('noBleed', true, 'caution', 'Marş için hava yok: önce APU BLEED açılmalı.');
    } else {
      this.latch('noBleed', false, 'info', '');
    }

    if (c.starter && this.N2 >= LIMITS.starterCutout) {
      c.starter = false;
      this.emit('starterCutout', 'info', `Marş motoru %${Math.round(LIMITS.starterCutout * 100)} N2'de devreden çıktı.`);
    }

    if (this.lit) {
      if (this.phase === 'lightoff' || this.phase === 'accelerating') {
        this.phase = 'accelerating';
        if (this.N2 >= LIMITS.idleN2 - 0.015) {
          this.phase = 'running';
          this.emit('idle', 'info', 'Motor rölantide dengelendi. Çalıştırma tamamlandı.');
        }
        // Takılı çalıştırma: N2 artmıyor
        const rate = (this.N2 - this.prevN2) / dt;
        this.hungTimer = rate < 0.002 && this.N2 < 0.55 ? this.hungTimer + dt : 0;
        this.latch(
          'hungStart',
          this.hungTimer > 6,
          'warning',
          'Takılı çalıştırma (hung start): N2 rölantiye çıkamıyor. Yakıtı kesin.',
        );
        this.latch(
          'hotStart',
          this.egtSensor > LIMITS.egtStart,
          'warning',
          `Sıcak çalıştırma (hot start): EGT ${LIMITS.egtStart}°C çalıştırma limitini aştı!`,
        );
      } else if (this.phase !== 'running') {
        this.phase = 'running';
      }
    } else {
      this.hungTimer = 0;
      if (this.starterEngaged && this.N2 > 0.01) this.phase = 'motoring';
      else if (this.N2 > 0.02) this.phase = 'spooldown';
      else {
        this.phase = 'off';
      }
    }
  }

  private checkLimits() {
    const LIMITS = this.limits;
    this.latch(
      'egtRedline',
      this.egtSensor > LIMITS.egtRedline,
      'warning',
      `EGT KIRMIZI ÇİZGİ AŞILDI (${LIMITS.egtRedline}°C)! Gücü azaltın.`,
    );
    this.latch('n1Overspeed', this.N1 > LIMITS.n1Redline, 'warning', 'N1 AŞIRI DEVİR!');
    this.latch('n2Overspeed', this.N2 > LIMITS.n2Redline, 'warning', 'N2 AŞIRI DEVİR!');
  }

  /* ------------------------------------------------------------------ */
  /* FADEC                                                               */
  /* ------------------------------------------------------------------ */

  private updateFuel(dt: number) {
    const c = this.controls;
    const d = this.eng.design;
    const r = this.eng.ref;
    const LIMITS = this.limits;
    const W3 = this.last.stations['3'].W;
    const wfMax = r.Wf * 1.15;

    if (!c.fuelRun || c.fadec === 'manual') this.governing = false;
    if (!c.fuelRun) {
      // Yakıt kesme valfi hızla kapanır
      this.wf = Math.max(0, this.wf - wfMax * 4 * dt);
      return;
    }

    if (c.fadec === 'manual' || !this.lit) {
      this.n1Command = null;
      this.n2Command = null;
    }
    if (c.fadec === 'manual') {
      // Doğrudan dozaj valfi: koruma yok, yalnızca valf hız sınırı
      const target = clamp(c.manualFuel, 0, 1) * wfMax;
      const slew = wfMax * 2.5 * dt;
      this.wf += clamp(target - this.wf, -slew, slew);
      return;
    }

    // Surge sınırındaki yakıt; hesap pahalı olduğundan birkaç adımda bir
    this.surgeWfAge += dt;
    if (this.surgeWfAge > 0.02) {
      this.surgeWfCache = surgeFuelFlow(this.eng, this.amb, this.N1, this.N2);
      this.surgeWfAge = 0;
    }
    const accelLimit = Math.min(wfMax, 0.82 * this.surgeWfCache);
    const decelLimit = 1.6 * LIMITS.leanBlowoutFar * W3;

    if (!this.lit || this.phase === 'lightoff' || this.phase === 'accelerating') {
      // Çalıştırma programı: N2 arttıkça yakıt/hava oranı düşer
      const t = clamp((this.N2 - 0.2) / (LIMITS.idleN2 - 0.2), 0, 1);
      const far = lerp(d.start.farHigh, d.start.farLow, t);
      let target = Math.max(WF_MIN_START_PER_CORE * r.coreFlow, far * W3);
      if (this.lit) target = Math.min(target, accelLimit);
      const slew = START_SLEW_PER_WF * r.Wf * dt;
      this.wf += clamp(target - this.wf, -slew, slew);
      this.governing = false;
      this.n1Command = null;
      this.n2Command = null;
      return;
    }

    // --- Yönetim (governing): hız biçimli PI döngüleri, min/max seçimi ---
    const theta2 = Math.sqrt(this.amb.T2 / r.T2);
    // Turboprop'ta pervane devrini vali tutar; FADEC gaz jeneratörünü (N2)
    // yönetir. Jet motorlarında itkiyi belirleyen N1 yönetilir.
    const gasGen = d.kind === 'turboprop';
    let e1: number;
    if (gasGen) {
      const n2Target = Math.min(
        lerp(LIMITS.idleN2, 1.0, clamp(c.throttle, 0, 1)) * theta2,
        LIMITS.n2Redline - 0.02,
      );
      this.n2Command = n2Target;
      this.n1Command = null;
      e1 = n2Target - this.N2;
    } else {
      const n1Target = lerp(0.18, 1.0, clamp(c.throttle, 0, 1)) * theta2;
      this.n1Command = Math.min(n1Target, LIMITS.n1Redline - 0.02);
      this.n2Command = null;
      e1 = Math.min(n1Target, LIMITS.n1Redline - 0.02) - this.N1;
    }
    const e2 = LIMITS.idleN2 - this.N2;
    const eN2max = LIMITS.n2Redline - 0.015 - this.N2;
    if (!this.governing) {
      // Döngüye ilk girişte önceki hata = şimdiki hata; aksi halde hız
      // biçimli PI tek adımda dev bir yakıt sıçraması üretir.
      this.prevN1Err = e1;
      this.prevN2Err = e2;
      this.governing = true;
    }

    const rateN1 = 4.0 * (e1 - this.prevN1Err) / dt + 3.5 * e1;
    const rateIdle = 2.5 * (e2 - this.prevN2Err) / dt + 1.6 * e2;
    const rateN2max = 3.0 * eN2max;
    // EGT sınırlayıcı: sıcak günde ya da yıpranmış motorda itkiyi kısar
    const rateEgt = 0.012 * (LIMITS.egtAmber - 5 - this.egtSensor);
    this.prevN1Err = e1;
    this.prevN2Err = e2;

    let rate = Math.max(rateN1, rateIdle);
    rate = Math.min(rate, rateN2max);
    const limitedByEgt = rateEgt < rate && this.N2 > 0.8;
    if (limitedByEgt) rate = rateEgt;
    this.latch(
      'egtLimiting',
      limitedByEgt && this.egtSensor > LIMITS.egtAmber - 25,
      'caution',
      'FADEC EGT sınırlamasında: türbini korumak için itki kısıldı.',
    );
    this.egtLimited = limitedByEgt;
    let wf = this.wf + rate * dt * r.Wf * FADEC_GAIN_PER_WF;

    if (this.recoveryTimer > 0) {
      this.recoveryTimer -= dt;
      wf = Math.min(wf, decelLimit * 1.4);
    }
    this.wf = clamp(wf, decelLimit, accelLimit);
  }

  /**
   * Art yakıcı: gaz kolu MIL'de, motor kararlı ve N1 yüksekken ateşlenir.
   * Yakıt püskürtme halkaları kademeli açılır; değişken lüle eşzamanlı
   * açılarak türbin çıkış basıncını sabit tutar (çekirdek bundan etkilenmez).
   */
  private updateAfterburner(dt: number) {
    const ab = this.eng.design.afterburner;
    if (!ab) return;
    const c = this.controls;
    const r = this.eng.ref;
    const theta2 = Math.sqrt(this.amb.T2 / r.T2);
    const want =
      c.reheat > 0.02 &&
      c.fuelRun &&
      this.lit &&
      !this.surging &&
      this.phase === 'running' &&
      c.throttle >= 0.97 &&
      this.N1 >= 0.9 * theta2;

    if (want && !this.abLit) {
      this.abTimer += dt;
      if (this.abTimer > 0.35) {
        this.abLit = true;
        this.abTimer = 0;
        this.emit('abLight', 'info', 'Art yakıcı yandı: lüle açılıyor, itki artıyor.');
      }
    } else if (!want) {
      this.abTimer = 0;
      if (this.abLit) {
        this.abLit = false;
        this.emit('abOff', 'info', 'Art yakıcı kapandı.');
      }
    }
    const flowScale = this.last.stations['2'].W / this.eng.design.massFlow;
    const target = this.abLit ? r.wfAbMax * lerp(0.2, 1, clamp(c.reheat, 0, 1)) * flowScale : 0;
    const up = r.wfAbMax * 1.6 * dt;
    const down = r.wfAbMax * 5 * dt;
    this.wfAb += clamp(target - this.wfAb, -down, up);
    if (this.wfAb < 1e-5) this.wfAb = 0;
  }

  /**
   * Turboprop pervanesi ve sabit devir valisi. Vali pal açısını değiştirerek
   * pervanenin çektiği gücü güç türbininin ürettiğine eşitler ve NP'yi %100'de
   * tutar. Güç yetmediğinde pal en ince konumda kalır ve NP düşer.
   */
  private updatePropeller(dt: number) {
    const d = this.eng.design;
    const prop = d.prop;
    if (!prop) {
      this.propPower = 0;
      this.propThrust = 0;
      return;
    }
    const r = this.eng.ref;
    const sigma = this.amb.rho0 / 1.225;
    const governing = this.lit && this.N1 > 0.5;
    const e = this.N1 - 1.0;
    if (governing) {
      this.propPitch += 3.0 * (e - this.prevNpErr) + 4.0 * e * dt;
    } else {
      // Çalıştırma ve duruşta ince pal (yük az)
      this.propPitch += (PITCH_MIN - this.propPitch) * Math.min(1, dt * 2);
    }
    this.prevNpErr = e;
    this.propPitch = clamp(this.propPitch, PITCH_MIN, PITCH_MAX);
    const n = Math.max(this.N1, 0);
    this.propPower = r.shaftPower * this.propPitch * n * n * n * sigma;

    // İtki: statikte momentum teorisi (başarı katsayısıyla), ileri uçuşta ηP/V
    const area = (Math.PI * prop.diameter * prop.diameter) / 4;
    const P = Math.max(this.propPower, 0);
    const staticT = Math.cbrt((prop.figureOfMerit * P) ** 2 * 2 * this.amb.rho0 * area);
    const V = this.amb.V0;
    this.propThrust = V > 1 ? Math.min(staticT, (prop.efficiency * P) / V) : staticT;
  }

  /* ------------------------------------------------------------------ */
  /* Yardımcılar                                                         */
  /* ------------------------------------------------------------------ */

  /** Motoru soğuk, durmuş ve yeni (hasarsız) hale getirir. */
  reset() {
    this.health = { ...HEALTHY };
    this.failures = { starter: false, igniter: false };
    this.fanDamage = 0;
    this.turbineDamaged = false;
    this.egtLimited = false;
    this.N1 = 0;
    this.N2 = 0;
    this.wf = 0;
    this.lit = false;
    this.surging = false;
    this.phase = 'off';
    this.fuelPuddle = 0;
    this.surgeCount = 0;
    this.wfAb = 0;
    this.abLit = false;
    this.abTimer = 0;
    this.propPitch = PITCH_MIN;
    this.propPower = 0;
    this.propThrust = 0;
    this.prevNpErr = 0;
    this.n1Command = null;
    this.n2Command = null;
    this.torchTimer = 0;
    this.recoveryTimer = 0;
    this.overTempTime = 0;
    this.governing = false;
    // Önceki motordan kalan zamanlayıcı ve önbellekler: pompalama yakıt
    // sınırı önbelleği kalırsa (ör. turboproptan turbofana) yeni motorun
    // ilk adımında küçük eski sınır yakıtı keser ve motor söner
    this.surgeTimer = 0;
    this.ignitionTimer = 0;
    this.hungTimer = 0;
    this.prevN2 = 0;
    this.prevN1Err = 0;
    this.prevN2Err = 0;
    this.surgeWfCache = Infinity;
    this.surgeWfAge = 99;
    this.flags.clear();
    Object.assign(this.controls, {
      apuBleed: false,
      starter: false,
      ignition: false,
      fuelRun: false,
      throttle: 0,
      manualFuel: 0,
      reheat: 0,
    });
    this.last = this.evaluate();
    this.egtSensor = this.amb.T0 - KELVIN;
  }

  /**
   * Motoru çalışır ve verilen gaz kolunda kararlı hale getirir (olay
   * bildirmeden hızlı ileri sarar). Ders başlangıçları ve ekran görüntüleri
   * için.
   */
  trim(throttle: number, seconds = 45) {
    const saved = this.listeners;
    this.listeners = [];
    this.snapFlight();
    this.lit = true;
    this.phase = 'running';
    Object.assign(this.controls, {
      apuBleed: false,
      starter: false,
      ignition: false,
      fuelRun: true,
      throttle,
      fadec: 'normal',
    });
    if (this.N2 < 0.5) {
      this.N2 = this.limits.idleN2;
      this.N1 = this.eng.design.prop ? 0.9 : 0.22;
      this.wf = 0.07 * this.eng.ref.Wf;
    }
    this.governing = false;
    this.last = this.evaluate();
    for (let t = 0; t < seconds; t += 1 / 60) this.step(1 / 60);
    this.egtSensor = this.last.stations['45'].T - KELVIN;
    this.flags.clear();
    this.surgeCount = 0;
    this.listeners = saved;
  }

  snapshot(): SimSnapshot {
    const cyc = this.last;
    const d = this.eng.design;
    return {
      time: this.time,
      N1: this.N1,
      N2: this.N2,
      n1Rpm: this.N1 * d.n1Rpm,
      n2Rpm: this.N2 * d.n2Rpm,
      egt: this.egtSensor,
      egtTrue: cyc.stations['45'].T - KELVIN,
      wf: this.wf + this.wfAb,
      thrust: cyc.netThrust + this.propThrust,
      tsfc:
        cyc.netThrust + this.propThrust > 100
          ? (this.wf + this.wfAb) / (cyc.netThrust + this.propThrust)
          : 0,
      lit: this.lit,
      surging: this.surging,
      phase: this.phase,
      starterEngaged: this.starterEngaged,
      igniting: this.igniting,
      oilPressure: 18 + 62 * clamp(this.N2, 0, 1.05) ** 1.6,
      vibration: 0.15 + this.N1 * (0.35 + this.fanDamage * 4.5) + (this.surging ? 2.5 : 0),
      cycle: cyc,
      amb: this.amb,
      controls: { ...this.controls },
      fuelPuddle: this.fuelPuddle,
      surgeCount: this.surgeCount,
      n1Command: this.n1Command,
      egtLimited: this.egtLimited,
      turbineDamaged: this.turbineDamaged,
      flamedOut: !this.lit && this.controls.fuelRun && this.phase === 'spooldown' && this.N2 > 0.25,
      kind: d.kind,
      limits: this.limits,
      n2Command: this.n2Command,
      abLit: this.abLit,
      wfAb: this.wfAb,
      abLevel: cyc.abFraction,
      nozzleArea: this.nozzleSchedule(cyc),
      propRpm: d.prop ? this.N1 * d.prop.rpm : 0,
      torque: d.prop ? this.propPower / Math.max(this.eng.ref.shaftPower, 1) / Math.max(this.N1, 0.05) : 0,
      shaftPower: this.propPower,
      propThrust: this.propThrust,
      propPitch: this.propPitch,
      airflow: cyc.stations['2'].W / d.massFlow,
      thrustFrac: (cyc.netThrust + this.propThrust) / Math.max(1, this.eng.point.thrust + (d.prop ? 5e4 : 0)),
    };
  }

  /**
   * Değişken lülenin konumu (görsel ve gösterge için): askeri motorlarda
   * rölantide lüle açıktır (rölanti itkisini azaltır), güç arttıkça kapanır,
   * art yakıcıda yanma arttıkça yeniden açılır.
   */
  private nozzleSchedule(cyc: CycleResult): number {
    if (!this.eng.design.afterburner) return 1;
    const idleOpen = lerp(1.45, 1, clamp((this.N1 - 0.55) / 0.35, 0, 1));
    // Hesaplanan boğaz alanı yalnız akış varken anlamlıdır (durmuş motorda
    // sıfıra yakın akı alanı sonsuza götürür)
    const abArea = this.abLit && this.lit ? clamp(cyc.nozzleArea, 0.9, 2.0) : 1;
    return Math.max(idleOpen, abArea);
  }

  /** Kuş çarpması: fan verimi ve akışı düşer, titreşim artar, HPC payı azalır. */
  birdStrike() {
    this.health.fanEta = 0.9;
    this.health.fanFlow = 0.96;
    this.health.hpcSurgeMargin = Math.min(this.health.hpcSurgeMargin, 0.55);
    this.fanDamage = 1;
    this.emit('birdStrike', 'warning', 'KUŞ ÇARPMASI! Fan hasarlı, titreşim yüksek.');
  }
}

