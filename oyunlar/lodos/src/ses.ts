/**
 * Ses: hepsi WebAudio ile üretilir (dosya yok). Yağmur/rüzgâr/deniz süzülmüş
 * gürültü; olaylar kısa bipler. İlk dokunuşta başlar (tarayıcı kuralı).
 */
export class Ses {
  private ctx: AudioContext | null = null;
  private ana: GainNode | null = null;
  private yagmurK: GainNode | null = null;
  private ruzgarK: GainNode | null = null;
  private ruzgarF: BiquadFilterNode | null = null;
  private denizK: GainNode | null = null;
  private gurultu: AudioBuffer | null = null;
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
      this.ana.gain.value = this.acik ? 0.7 : 0;
      this.ana.connect(ctx.destination);

      const n = ctx.sampleRate * 2;
      this.gurultu = ctx.createBuffer(1, n, ctx.sampleRate);
      const v = this.gurultu.getChannelData(0);
      for (let i = 0; i < n; i++) v[i] = Math.random() * 2 - 1;

      const katman = (tip: BiquadFilterType, frekans: number, q: number): [GainNode, BiquadFilterNode] => {
        const src = ctx.createBufferSource();
        src.buffer = this.gurultu;
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = tip;
        f.frequency.value = frekans;
        f.Q.value = q;
        const k = ctx.createGain();
        k.gain.value = 0;
        src.connect(f).connect(k).connect(this.ana!);
        src.start(0, Math.random());
        return [k, f];
      };
      [this.yagmurK] = katman('highpass', 2600, 0.4);
      [this.ruzgarK, this.ruzgarF] = katman('bandpass', 420, 1.6);
      [this.denizK] = katman('lowpass', 380, 0.3);
    } catch {
      this.ctx = null;
    }
  }

  sesAc(acik: boolean): void {
    this.acik = acik;
    if (this.ana && this.ctx) this.ana.gain.setTargetAtTime(acik ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  /** Her karede: hava durumuna göre ortam sesleri. */
  ortam(yagmur: number, firtina: number, zaman: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.yagmurK?.gain.setTargetAtTime(yagmur * 0.11, t, 0.3);
    this.ruzgarK?.gain.setTargetAtTime(firtina * 0.16 * (0.7 + 0.3 * Math.sin(zaman * 0.7)), t, 0.3);
    this.ruzgarF?.frequency.setTargetAtTime(380 + 260 * Math.sin(zaman * 0.5) * firtina, t, 0.4);
    this.denizK?.gain.setTargetAtTime(0.05 + firtina * 0.14 + 0.03 * Math.sin(zaman * 1.1), t, 0.3);
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
    k.gain.exponentialRampToValueAtTime(kazanc, t + 0.008);
    k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(k).connect(this.ana);
    o.start(t);
    o.stop(t + sure + 0.02);
  }

  private patla(frekans: number, sure: number, kazanc: number, tip: BiquadFilterType = 'lowpass'): void {
    const ctx = this.ctx;
    if (!ctx || !this.ana || !this.gurultu) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.gurultu;
    const f = ctx.createBiquadFilter();
    f.type = tip;
    f.frequency.setValueAtTime(frekans, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, frekans * 0.25), t + sure);
    const k = ctx.createGain();
    k.gain.setValueAtTime(kazanc, t);
    k.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    src.connect(f).connect(k).connect(this.ana);
    src.start(t, Math.random());
    src.stop(t + sure + 0.05);
  }

  isirma(): void {
    this.bip(660, 990, 0.07, 'square', 0.08);
    this.bip(990, 1320, 0.09, 'square', 0.08, 0.07);
  }

  yutma(zincir: number): void {
    this.bip(180, 90, 0.16, 'sawtooth', 0.12);
    for (let i = 0; i <= Math.min(zincir, 4); i++) this.bip(520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i), 0.09, 'square', 0.07, 0.14 + i * 0.08);
  }

  yakalama(deger: number): void {
    const nota = deger >= 100 ? [523, 659, 784, 1047, 1319] : deger >= 10 ? [523, 659, 784, 1047] : deger > 0 ? [659, 880] : [220, 165];
    nota.forEach((f, i) => this.bip(f, f, 0.12, 'square', 0.08, i * 0.085));
    this.patla(1800, 0.18, 0.1, 'highpass');
  }

  kopma(): void {
    this.bip(900, 120, 0.22, 'sawtooth', 0.14);
    this.patla(3000, 0.12, 0.2, 'highpass');
  }

  carpilma(): void {
    for (let i = 0; i < 5; i++) this.bip(1400 - i * 90, 300, 0.05, 'sawtooth', 0.09, i * 0.045);
  }

  cirpinma(): void {
    this.bip(240, 320, 0.08, 'square', 0.06);
    this.bip(240, 320, 0.08, 'square', 0.06, 0.12);
  }

  gok(): void {
    this.patla(900, 1.6, 0.6);
    this.patla(160, 2.6, 0.5);
  }

  miyav(): void {
    const ctx = this.ctx;
    if (!ctx || !this.ana) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(980, t + 0.12);
    o.frequency.linearRampToValueAtTime(700, t + 0.38);
    const k = ctx.createGain();
    k.gain.setValueAtTime(0.0001, t);
    k.gain.exponentialRampToValueAtTime(0.11, t + 0.04);
    k.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(k).connect(this.ana);
    o.start(t);
    o.stop(t + 0.45);
  }

  duduk(): void {
    this.bip(155, 150, 1.1, 'sawtooth', 0.07);
    this.bip(233, 226, 1.1, 'sawtooth', 0.05);
  }

  faz(): void {
    this.bip(330, 330, 0.18, 'triangle', 0.1);
    this.bip(247, 247, 0.3, 'triangle', 0.1, 0.18);
  }

  bitis(): void {
    [392, 494, 587, 784].forEach((f, i) => this.bip(f, f, 0.3, 'triangle', 0.1, i * 0.16));
  }

  dokun(): void {
    this.bip(440, 660, 0.06, 'square', 0.05);
  }
}
