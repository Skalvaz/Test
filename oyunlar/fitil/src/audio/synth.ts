/**
 * WebAudio ile sentezlenen sesler — harici ses dosyası yok.
 *
 * Tarayıcılar sesi yalnız kullanıcı etkileşiminden sonra başlatır; `unlock()`
 * ilk dokunuşta çağrılır. Zincir: sesler → efekt yolu (kısa yankı) → ana
 * kazanç → sıkıştırıcı → hoparlör. Tüm zamanlamalar AudioContext saatinde.
 */
export interface ToneSpec {
  /** Dalga biçimi. */
  type?: OscillatorType;
  /** Başlangıç frekansı (Hz). */
  freq: number;
  /** Bitiş frekansı (Hz); verilirse üstel kayar. */
  freqEnd?: number;
  /** Atak (s). */
  attack?: number;
  /** Sönüm (s). */
  decay?: number;
  /** Tepe kazanç (0–1). */
  gain?: number;
  /** Başlangıç gecikmesi (s). */
  delay?: number;
  /** Stereo konum (−1…1). */
  pan?: number;
  /** Yankıya giden oran (0–1). */
  wet?: number;
  /** Alçak geçiren süzgeç kesimi (Hz). */
  lowpass?: number;
  /** Cent cinsinden hafif ayar kayması (ikinci osilatör ile koro). */
  detune?: number;
}

export interface NoiseSpec {
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
  decay?: number;
  gain?: number;
  delay?: number;
  pan?: number;
  wet?: number;
}

export class Synth {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fx: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.8;

  /** İlk kullanıcı etkileşiminde çağır. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC({ latencyHint: 'interactive' });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      comp.connect(ctx.destination);
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(comp);
      // Kısa, parlak yankı: üstel sönen gürültüden dürtü yanıtı.
      const conv = ctx.createConvolver();
      conv.buffer = makeImpulse(ctx, 1.6, 3.2);
      const fx = ctx.createGain();
      fx.gain.value = 0.35;
      fx.connect(conv);
      conv.connect(master);
      this.ctx = ctx;
      this.master = master;
      this.fx = fx;
      this.noiseBuf = makeNoise(ctx, 2);
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  tone(s: ToneSpec): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + (s.delay ?? 0);
    const atk = s.attack ?? 0.005;
    const dec = s.decay ?? 0.25;
    const peak = s.gain ?? 0.3;
    const out = this.voiceOut(t0, atk, dec, peak, s.pan ?? 0, s.wet ?? 0.25, s.lowpass);
    const oscs = s.detune ? [-s.detune, s.detune] : [0];
    for (const dt of oscs) {
      const o = ctx.createOscillator();
      o.type = s.type ?? 'sine';
      o.frequency.setValueAtTime(s.freq, t0);
      if (s.freqEnd && s.freqEnd > 0) o.frequency.exponentialRampToValueAtTime(s.freqEnd, t0 + atk + dec);
      o.detune.value = dt;
      o.connect(out);
      o.start(t0);
      o.stop(t0 + atk + dec + 0.05);
    }
  }

  noise(s: NoiseSpec): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf || this.muted) return;
    const t0 = ctx.currentTime + (s.delay ?? 0);
    const atk = s.attack ?? 0.003;
    const dec = s.decay ?? 0.2;
    const out = this.voiceOut(t0, atk, dec, s.gain ?? 0.2, s.pan ?? 0, s.wet ?? 0.2);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = s.filter ?? 'bandpass';
    f.frequency.setValueAtTime(s.freq ?? 1200, t0);
    if (s.freqEnd) f.frequency.exponentialRampToValueAtTime(s.freqEnd, t0 + atk + dec);
    f.Q.value = s.q ?? 1;
    src.connect(f);
    f.connect(out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + atk + dec + 0.05);
  }

  private voiceOut(t0: number, atk: number, dec: number, peak: number, pan: number, wet: number, lowpass?: number): AudioNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
    let head: AudioNode = g;
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      lp.connect(g);
      head = lp;
    }
    let tail: AudioNode = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      tail = p;
    }
    tail.connect(this.master!);
    if (wet > 0 && this.fx) {
      const w = ctx.createGain();
      w.gain.value = wet;
      tail.connect(w);
      w.connect(this.fx);
    }
    return head;
  }
}

/** Yarım ton adımıyla frekans: midi(69) = 440 Hz. */
export function midi(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/** Pentatonik gam üzerinde i. basamak (zincir büyüdükçe yükselen perde için). */
export function pentatonic(root: number, i: number): number {
  const steps = [0, 2, 4, 7, 9];
  const oct = Math.floor(i / steps.length);
  return midi(root + oct * 12 + steps[((i % steps.length) + steps.length) % steps.length]);
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = 777 + ch * 31;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      d[i] = ((seed / 4294967296) * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
