/**
 * Yalnız testler için sahte WebAudio bağlamı (Node'da AudioContext yok).
 *
 * Gerçek tarayıcıların hata verdiği durumları burada da hata yapar: sonlu
 * olmayan değer/zaman, sıfır ya da negatif üstel rampa, iki kez `start`,
 * `start`tan önce `stop`. Oluşturulan her düğüm kaydedilir; testler hangi
 * seslerin hangi frekansta, ne zaman çaldığını buradan okur.
 */
export class SahteParam {
  value: number;
  readonly olaylar: { tur: string; deger: number; zaman: number }[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  private kaydet(tur: string, deger: number, zaman: number): this {
    if (!Number.isFinite(deger) || !Number.isFinite(zaman)) throw new TypeError(`${tur}: sonlu olmayan değer ${deger} @ ${zaman}`);
    if (zaman < 0) throw new RangeError(`${tur}: negatif zaman ${zaman}`);
    this.olaylar.push({ tur, deger, zaman });
    this.value = deger;
    return this;
  }
  setValueAtTime(v: number, t: number) {
    return this.kaydet('set', v, t);
  }
  linearRampToValueAtTime(v: number, t: number) {
    return this.kaydet('lin', v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0) && !(v < 0)) throw new RangeError(`üstel rampa hedefi ${v}`);
    return this.kaydet('exp', v, t);
  }
  setTargetAtTime(v: number, t: number, c: number) {
    if (!(c > 0)) throw new RangeError(`zaman sabiti ${c}`);
    return this.kaydet('hedef', v, t);
  }
  cancelScheduledValues(t: number) {
    if (!Number.isFinite(t)) throw new TypeError('iptal zamanı');
    return this;
  }
  cancelAndHoldAtTime(t: number) {
    return this.cancelScheduledValues(t);
  }
  /** Belli bir türdeki son hedef değer. */
  son(tur?: string): number | undefined {
    for (let i = this.olaylar.length - 1; i >= 0; i--) if (!tur || this.olaylar[i].tur === tur) return this.olaylar[i].deger;
    return undefined;
  }
  /** İlk ayarlanan değer (yoksa başlangıç). */
  ilk(): number {
    return this.olaylar.find((o) => o.tur === 'set')?.deger ?? this.value;
  }
}

export class SahteDugum {
  readonly cikislar: unknown[] = [];
  constructor(readonly baglam: SahteBaglam, readonly tip: string) {
    baglam.dugumler.push(this);
  }
  connect<T>(d: T): T {
    if (!d) throw new TypeError('connect: hedef yok');
    this.cikislar.push(d);
    return d;
  }
  disconnect(): void {
    this.cikislar.length = 0;
  }
}

export class SahteKaynak extends SahteDugum {
  baslangic = -1;
  bitis = -1;
  onended: (() => void) | null = null;
  start(t = 0): void {
    if (this.baslangic >= 0) throw new Error('InvalidStateError: iki kez start');
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`start ${t}`);
    this.baslangic = t;
  }
  stop(t = 0): void {
    if (this.baslangic < 0) throw new Error('InvalidStateError: start olmadan stop');
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`stop ${t}`);
    this.bitis = t;
  }
}

export class SahteOsilator extends SahteKaynak {
  type: OscillatorType = 'sine';
  readonly frequency = new SahteParam(440);
  readonly detune = new SahteParam(0);
  constructor(b: SahteBaglam) {
    super(b, 'osilator');
  }
}

export class SahteTamponKaynak extends SahteKaynak {
  buffer: SahteTampon | null = null;
  loop = false;
  readonly playbackRate = new SahteParam(1);
  constructor(b: SahteBaglam) {
    super(b, 'tamponKaynak');
  }
}

export class SahteTampon {
  private readonly kanallar: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    if (length <= 0) throw new RangeError('tampon uzunluğu');
    this.kanallar = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(i: number): Float32Array {
    return this.kanallar[i];
  }
}

export class SahteBaglam {
  currentTime = 0;
  sampleRate: number;
  state: AudioContextState | 'interrupted' = 'running';
  readonly dugumler: SahteDugum[] = [];
  readonly destination: SahteDugum;
  resumeSayisi = 0;
  suspendSayisi = 0;
  readonly dinleyiciler = new Map<string, (() => void)[]>();
  constructor(o?: { sampleRate?: number }) {
    this.sampleRate = o?.sampleRate ?? 8000;
    this.destination = new SahteDugum(this, 'cikis');
  }
  createGain() {
    const d = new SahteDugum(this, 'kazanc') as SahteDugum & { gain: SahteParam };
    d.gain = new SahteParam(1);
    return d;
  }
  createOscillator() {
    return new SahteOsilator(this);
  }
  createBufferSource() {
    return new SahteTamponKaynak(this);
  }
  createBiquadFilter() {
    const d = new SahteDugum(this, 'filtre') as SahteDugum & { type: BiquadFilterType; frequency: SahteParam; Q: SahteParam; gain: SahteParam };
    d.type = 'lowpass';
    d.frequency = new SahteParam(350);
    d.Q = new SahteParam(1);
    d.gain = new SahteParam(0);
    return d;
  }
  createDynamicsCompressor() {
    const d = new SahteDugum(this, 'kompresor') as SahteDugum & Record<'threshold' | 'knee' | 'ratio' | 'attack' | 'release', SahteParam>;
    d.threshold = new SahteParam(-24);
    d.knee = new SahteParam(30);
    d.ratio = new SahteParam(12);
    d.attack = new SahteParam(0.003);
    d.release = new SahteParam(0.25);
    return d;
  }
  createConvolver() {
    const d = new SahteDugum(this, 'convolver') as SahteDugum & { buffer: SahteTampon | null; normalize: boolean };
    d.buffer = null;
    d.normalize = true;
    return d;
  }
  createStereoPanner() {
    const d = new SahteDugum(this, 'pan') as SahteDugum & { pan: SahteParam };
    d.pan = new SahteParam(0);
    return d;
  }
  createWaveShaper() {
    const d = new SahteDugum(this, 'kirpici') as SahteDugum & { curve: Float32Array | null; oversample: string };
    d.curve = null;
    d.oversample = 'none';
    return d;
  }
  createAnalyser() {
    const d = new SahteDugum(this, 'cozumleyici') as SahteDugum & { fftSize: number; smoothingTimeConstant: number };
    d.fftSize = 2048;
    d.smoothingTimeConstant = 0.8;
    return d;
  }
  createBuffer(kanal: number, uzunluk: number, oran: number) {
    return new SahteTampon(kanal, uzunluk, oran);
  }
  resume(): Promise<void> {
    this.resumeSayisi++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendSayisi++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  addEventListener(ad: string, fn: () => void): void {
    const l = this.dinleyiciler.get(ad) ?? [];
    l.push(fn);
    this.dinleyiciler.set(ad, l);
  }

  // ── Test yardımcıları ──
  tur<T extends SahteDugum>(tip: string): T[] {
    return this.dugumler.filter((d) => d.tip === tip) as T[];
  }
  get osilatorler(): SahteOsilator[] {
    return this.tur<SahteOsilator>('osilator');
  }
  get kaynaklar(): SahteKaynak[] {
    return this.dugumler.filter((d): d is SahteKaynak => d instanceof SahteKaynak);
  }
  /** `fn` sırasında oluşturulan düğümler. */
  sirasinda(fn: () => void): SahteDugum[] {
    const n = this.dugumler.length;
    fn();
    return this.dugumler.slice(n);
  }
}

/** Sahte bağlamı motorun beklediği tipe çevirir. */
export function baglamOlarak(b: SahteBaglam): BaseAudioContext {
  return b as unknown as BaseAudioContext;
}
