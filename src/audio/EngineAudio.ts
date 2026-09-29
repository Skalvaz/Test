/**
 * Prosedürel motor sesi (Web Audio API, harici ses dosyası yok).
 *
 * Katmanlar gerçek turbofan akustiğine göre seçildi:
 *  - Fan kanat geçiş frekansı: N1 devri × kanat sayısı (100%'de ~935 Hz)
 *  - "Buzz-saw": fan uçları süpersonik olunca mil frekansının harmonikleri
 *  - Çekirdek ıslığı: N2 × HPC ilk kademe kanat sayısı (kHz bölgesi)
 *  - Jet/yanma gürlemesi: filtrelenmiş gürültü, itki ve jet hızıyla
 *  - Marş türbini, ateşleyici tıkırtısı, surge patlaması
 * Kamera öndeyse fan sesleri, arkadaysa jet gürlemesi baskındır.
 */

import type { SimSnapshot } from '../sim';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

interface Voice {
  gain: GainNode;
  osc?: OscillatorNode;
  filter?: BiquadFilterNode;
}

export class EngineAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private v: Record<string, Voice> = {};
  private nextClick = 0;
  private nextCrackle = 0;
  private _volume = 0.7;
  private _muted = false;

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Tarayıcılar sesi ilk kullanıcı etkileşiminden sonra açmaya izin verir. */
  resume() {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  set volume(v: number) {
    this._volume = clamp(v, 0, 1);
    this.applyMaster();
  }
  get volume() {
    return this._volume;
  }
  set muted(m: boolean) {
    this._muted = m;
    this.applyMaster();
  }
  get muted() {
    return this._muted;
  }

  private applyMaster() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this._muted ? 0 : this._volume * 0.9, this.ctx.currentTime, 0.05);
  }

  private build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp).connect(ctx.destination);
    this.applyMaster();

    // Pembe gürültü (Paul Kellet süzgeci), 4 s döngü
    const len = ctx.sampleRate * 4;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }

    const osc = (type: OscillatorType, filterType?: BiquadFilterType, q = 1): Voice => {
      const o = ctx.createOscillator();
      o.type = type;
      const g = ctx.createGain();
      g.gain.value = 0;
      let f: BiquadFilterNode | undefined;
      if (filterType) {
        f = ctx.createBiquadFilter();
        f.type = filterType;
        f.Q.value = q;
        o.connect(f).connect(g);
      } else {
        o.connect(g);
      }
      g.connect(this.master);
      o.start();
      return { osc: o, gain: g, filter: f };
    };
    const noise = (filterType: BiquadFilterType, freq: number, q = 0.7): Voice => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start(0, Math.random() * 3);
      return { gain: g, filter: f };
    };

    this.v.fan = osc('sawtooth', 'lowpass', 1.2);
    this.v.buzz = osc('sawtooth', 'bandpass', 0.8);
    this.v.whine = osc('sine');
    this.v.whine2 = osc('triangle', 'bandpass', 4);
    this.v.roar = noise('lowpass', 400, 0.6);
    this.v.hiss = noise('bandpass', 3500, 0.7);
    this.v.air = noise('bandpass', 600, 1.1);
    this.v.starter = osc('sine');
    // Art yakıcı: derin, geniş bantlı gürleme + çatırtı
    this.v.abRoar = noise('lowpass', 300, 0.5);
    this.v.abBody = noise('bandpass', 90, 0.6);
    // Pervane: pal geçiş frekansı ve harmonikleri (vızıltı / "wub")
    this.v.prop = osc('sawtooth', 'lowpass', 2.5);
    this.v.propSub = osc('sine');
  }

  private set(voice: Voice, gain: number, freq?: number, filterFreq?: number) {
    // Sonlu olmayan değer AudioParam'da istisna fırlatır ve kareyi keser
    if (!Number.isFinite(gain) || (freq !== undefined && !Number.isFinite(freq)) || (filterFreq !== undefined && !Number.isFinite(filterFreq))) return;
    const t = this.ctx!.currentTime;
    voice.gain.gain.setTargetAtTime(gain, t, 0.06);
    if (freq !== undefined && voice.osc) voice.osc.frequency.setTargetAtTime(Math.max(1, freq), t, 0.05);
    if (filterFreq !== undefined && voice.filter) voice.filter.frequency.setTargetAtTime(filterFreq, t, 0.08);
  }

  /**
   * @param frontness −1 (kamera tam arkada) … +1 (kamera tam önde)
   * @param proximity 0 (uzak) … 1 (çok yakın)
   */
  update(
    s: SimSnapshot,
    fanBlades: number,
    fanDiameter: number,
    frontness: number,
    proximity: number,
    designThrust = 320e3,
  ) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const prop = s.kind === 'turboprop';
    const n1rps = s.n1Rpm / 60;
    const n2rps = s.n2Rpm / 60;
    const tipMach = prop ? 0 : (n1rps * Math.PI * fanDiameter) / s.amb.a0;
    const thrustFrac = clamp((prop ? s.thrust - s.propThrust : s.thrust) / designThrust, 0, 1.2);
    const front = 0.55 + 0.45 * clamp(frontness, -1, 1);
    const back = 0.55 - 0.45 * clamp(frontness, -1, 1);
    const near = 0.6 + 0.6 * proximity;

    // Fan kanat geçiş tonu
    const bpf = n1rps * fanBlades;
    this.set(this.v.fan, prop ? 0 : 0.05 * Math.pow(s.N1, 1.4) * front * near, bpf, bpf * 2.5 + 200);

    // Pervane: 6 pal × ~20 dev/s ≈ 120 Hz; pal yükü arttıkça daha sert
    if (prop) {
      const prps = s.propRpm / 60;
      const load = clamp(s.torque, 0, 1.1);
      const pbpf = prps * fanBlades;
      this.set(this.v.prop, (0.05 + 0.13 * load) * clamp(s.propRpm / 600, 0, 1) * near, pbpf, pbpf * (3 + 5 * load));
      this.set(this.v.propSub, 0.08 * load * near, pbpf, undefined);
    } else {
      this.set(this.v.prop, 0);
      this.set(this.v.propSub, 0);
    }

    // Art yakıcı: jet gürlemesinin üstüne derin gürleme ve rastgele çatırtılar
    const ab = clamp(s.abLevel, 0, 1);
    this.set(this.v.abRoar, 0.55 * Math.pow(ab, 0.7) * (0.5 + 0.8 * back) * near, undefined, 260 + 900 * ab);
    this.set(this.v.abBody, 0.5 * Math.pow(ab, 0.8) * near, undefined, 70 + 40 * ab);

    // Buzz-saw: süpersonik fan ucu şok dalgaları → mil frekansı harmonikleri
    const buzz = smooth(tipMach, 0.92, 1.12);
    this.set(this.v.buzz, 0.09 * buzz * front * near, n1rps * 2, n1rps * 18);

    // Çekirdek ıslığı (HPC ilk kademe ~38 kanat) ve dişli kutusu ıslığı
    this.set(this.v.whine, 0.018 * Math.pow(s.N2, 2) * front * near, n2rps * 38);
    this.set(this.v.whine2, 0.03 * Math.pow(s.N2, 1.8) * near, n2rps * 9, n2rps * 9);

    // Jet/yanma gürlemesi: itki ve jet hızıyla; arkada daha güçlü
    const roar = (s.lit ? 0.05 : 0) + 0.42 * Math.pow(thrustFrac, 0.85);
    this.set(this.v.roar, roar * (0.4 + 0.9 * back) * near, undefined, 220 + 2600 * thrustFrac);
    const vj = clamp(s.cycle.V9 / 420, 0, 1.3);
    this.set(this.v.hiss, 0.14 * vj * vj * (0.3 + back) * near, undefined, 2200 + 2200 * vj);

    // Motor içinden geçen hava (motorlama/rüzgârlanma)
    this.set(this.v.air, 0.07 * clamp(s.N2 * 1.6, 0, 1) * near, undefined, 350 + 1800 * s.N2);

    // Hava türbinli marş motoru
    this.set(
      this.v.starter,
      s.starterEngaged ? 0.022 * near : 0,
      900 + 2600 * clamp(s.N2 / 0.56, 0, 1.1),
    );

    // Ateşleyici tıkırtısı (~1.8 Hz)
    const now = this.ctx.currentTime;
    // Yüksek hızlı jetin "çatırtısı" (crackle): süpersonik jette şok dalgaları
    const crack = Math.max(ab, smooth(s.cycle.V9, 480, 720) * 0.5);
    if (crack > 0.05 && now >= this.nextCrackle) {
      this.pop(0.35 * crack * (0.4 + back) * near);
      this.nextCrackle = now + 0.03 + Math.random() * (0.18 - 0.12 * crack);
    }
    if (s.igniting && now >= this.nextClick) {
      this.click(0.16 * near);
      this.nextClick = now + 0.55;
    }
  }

  /** Kısa, alçak frekanslı patlama (art yakıcı çatırtısı) */
  private pop(gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 300 + Math.random() * 900;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.05);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 3, 0.12);
  }

  private click(gain: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 3, 0.05);
  }

  /** Surge patlaması: sert gürültü darbesi + alçak frekanslı gümbürtü. */
  bang(strength = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.4 * strength, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, 0.8);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.4);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.9 * strength, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(og).connect(this.master);
    o.start(t);
    o.stop(t + 0.5);
  }

  /** Torching/light-off için yumuşak "vuuf". */
  whoomp(strength = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.25);
    f.frequency.exponentialRampToValueAtTime(150, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8 * strength, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, 1.4);
  }
}
