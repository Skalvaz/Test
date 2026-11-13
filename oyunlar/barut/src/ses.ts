/**
 * Ses: hepsi WebAudio ile üretilir (dosya yok). Pervane sürekli döner;
 * silahlar, patlamalar, uyarılar kısa üretilmiş seslerdir. İlk dokunuşta başlar.
 */
export class Ses {
  private ctx: AudioContext | null = null;
  private ana: GainNode | null = null;
  private gurultu: AudioBuffer | null = null;
  private pervaneK: GainNode | null = null;
  private sonAtes = 0;
  private sonTufek = 0;
  private sonPatlama = 0;
  private sonOlum = 0;
  acik = true;

  baslat(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.ana = ctx.createGain();
      this.ana.gain.value = this.acik ? 0.75 : 0;
      this.ana.connect(ctx.destination);
      const n = ctx.sampleRate * 2;
      this.gurultu = ctx.createBuffer(1, n, ctx.sampleRate);
      const v = this.gurultu.getChannelData(0);
      for (let i = 0; i < n; i++) v[i] = Math.random() * 2 - 1;

      // Pervane: alçak geçiren gürültü, 13 Hz ile kıyılır
      const src = ctx.createBufferSource();
      src.buffer = this.gurultu;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 260;
      const kiyici = ctx.createGain();
      kiyici.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'sawtooth';
      lfo.frequency.value = 13;
      const lfoK = ctx.createGain();
      lfoK.gain.value = 0.5;
      lfo.connect(lfoK).connect(kiyici.gain);
      this.pervaneK = ctx.createGain();
      this.pervaneK.gain.value = 0;
      src.connect(f).connect(kiyici).connect(this.pervaneK).connect(this.ana);
      src.start();
      lfo.start();
    } catch {
      this.ctx = null;
    }
  }

  sesAc(acik: boolean): void {
    this.acik = acik;
    if (this.ana && this.ctx) this.ana.gain.setTargetAtTime(acik ? 0.75 : 0, this.ctx.currentTime, 0.05);
  }

  /** Her karede: pervane sesi hıza göre. */
  ortam(hiz: number, ucuyor: boolean): void {
    if (!this.ctx || !this.pervaneK) return;
    this.pervaneK.gain.setTargetAtTime(ucuyor ? 0.22 + Math.min(0.12, hiz / 2000) : 0, this.ctx.currentTime, 0.2);
  }

  private bip(f0: number, f1: number, sure: number, tip: OscillatorType, kazanc: number, gecikme = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.ana) return;
    const t = ctx.currentTime + gecikme;
    const o = ctx.createOscillator();
    o.type = tip;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + sure);
    const k = ctx.createGain();
    k.gain.setValueAtTime(0.0001, t);
    k.gain.exponentialRampToValueAtTime(kazanc, t + 0.006);
    k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(k).connect(this.ana);
    o.start(t);
    o.stop(t + sure + 0.02);
  }

  private patla(frekans: number, sure: number, kazanc: number, tip: BiquadFilterType = 'lowpass', son = 0.2): void {
    const ctx = this.ctx;
    if (!ctx || !this.ana || !this.gurultu) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.gurultu;
    const f = ctx.createBiquadFilter();
    f.type = tip;
    f.frequency.setValueAtTime(frekans, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, frekans * son), t + sure);
    const k = ctx.createGain();
    k.gain.setValueAtTime(kazanc, t);
    k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    src.connect(f).connect(k).connect(this.ana);
    src.start(t, Math.random());
    src.stop(t + sure + 0.05);
  }

  private simdi(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  ates(): void {
    if (this.simdi() - this.sonAtes < 0.07) return;
    this.sonAtes = this.simdi();
    this.patla(2400, 0.05, 0.16, 'bandpass', 0.5);
    this.bip(190, 90, 0.04, 'square', 0.05);
  }

  tufek(): void {
    if (this.simdi() - this.sonTufek < 0.09) return;
    this.sonTufek = this.simdi();
    this.patla(1500, 0.07, 0.07, 'bandpass', 0.4);
  }

  roket(): void {
    this.patla(900, 0.45, 0.16, 'bandpass', 3);
  }

  top(): void {
    this.patla(500, 0.3, 0.3);
    this.bip(120, 50, 0.18, 'sine', 0.2);
  }

  patlama(r: number): void {
    if (this.simdi() - this.sonPatlama < 0.05) return;
    this.sonPatlama = this.simdi();
    const k = Math.min(1, r / 34);
    this.patla(700 + 500 * k, 0.5 + k * 0.9, 0.35 + 0.35 * k);
    this.patla(140, 0.8 + k * 1.2, 0.3 + 0.3 * k);
    this.bip(90, 35, 0.3 + k * 0.3, 'sine', 0.25 * k + 0.1);
  }

  isabet(): void {
    this.bip(700, 180, 0.12, 'square', 0.12);
    this.patla(3000, 0.08, 0.15, 'highpass', 0.6);
  }

  olum(): void {
    if (this.simdi() - this.sonOlum < 0.11) return;
    this.sonOlum = this.simdi();
    const f = 520 + Math.random() * 380;
    this.bip(f, f * 0.45, 0.16, 'triangle', 0.07);
  }

  uyari(): void {
    this.bip(880, 880, 0.07, 'square', 0.06);
    this.bip(880, 880, 0.07, 'square', 0.06, 0.12);
  }

  jet(): void {
    this.patla(300, 2.2, 0.3, 'bandpass', 6);
    this.uyari();
  }

  dalga(): void {
    this.bip(196, 196, 0.16, 'square', 0.08);
    this.bip(262, 262, 0.16, 'square', 0.08, 0.16);
    this.bip(330, 330, 0.3, 'square', 0.08, 0.32);
  }

  dalgaBitti(): void {
    [392, 494, 587].forEach((f, i) => this.bip(f, f, 0.16, 'triangle', 0.09, i * 0.12));
  }

  bomba(): void {
    this.bip(1100, 300, 0.5, 'sine', 0.07);
  }

  sandik(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.bip(f, f, 0.1, 'square', 0.07, i * 0.07));
  }

  bitis(): void {
    [330, 262, 220, 165].forEach((f, i) => this.bip(f, f * 0.97, 0.34, 'triangle', 0.1, i * 0.22));
  }

  dokun(): void {
    this.bip(440, 660, 0.06, 'square', 0.05);
  }
}
