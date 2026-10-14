/**
 * FİTİL ses motoru (P2b, GDD §12.2, §12.3, §12.4) — tamamen WebAudio sentezi,
 * harici ses dosyası yok.
 *
 * Yönlendirme (§12.3):
 *
 *   sesler ─▶ sfx (0,8) ──┬────────────────────────────▶ ana giriş
 *                         └▶ yankı gönder (0,18) ─▶ Convolver ─▶ ┘   (1,8 sn, exp(−t/0,45))
 *   müzik pedi ─▶ kısma ─▶ müzik (0,35) ─┬──────────────────────▶ ana giriş
 *                                        └▶ yankı gönder ───────┘
 *   kalabalık + deniz ─▶ ortam (0,25) ────────────────────────────▶ ana giriş
 *
 *   ana giriş ─▶ alçak geçiren (18 kHz; yavaş çekimde 1,2 kHz)
 *             ─▶ DynamicsCompressor (−18 dB, diz 12, oran 4, 3 ms, 150 ms)
 *             ─▶ çıkış kazancı (sessiz) ─▶ yumuşak kırpıcı ─▶ hoparlör
 *
 * Telefon / WhatsApp içi tarayıcı:
 *  - `ac()` ilk dokunuşta AudioContext'i kurar ve `resume()` eder; iOS için
 *    tek örnekli sessiz tampon çalar. Bağlam kurulamazsa her çağrı sessizce
 *    hiçbir şey yapmaz (oyun sessiz çalışır).
 *  - iOS 17+ `navigator.audioSession.type = 'ambient'`: sessiz anahtarına
 *    uyar, oyuncunun dinlediği müziği kesmez.
 *  - Sekme gizlenince `suspend()`, görünür olunca `resume()`; iOS'ta çağrı
 *    gibi kesintilerden ('interrupted') sonra ilk dokunuşta yeniden açılır.
 *  - Bağlam çalışmıyorken ses planlanmaz (geri gelince birikmiş sesler bir
 *    anda patlamasın).
 *
 * Kalite notları (§12.2 tarifleri temel alınıp katmanlandı):
 *  - Çıt/pop: sinüs + üçgen + kısa üst kısmi (kalimba/marimba vuruşu) + gürültü
 *    "puf" + alçak gövde; tek bip değil, sıcak bir vuruş.
 *  - Çan: FM (oran 3,5, indeks 2→0) + alt oktav gövdesi; yankıya ek gönderim.
 *  - Güm/bum: perde düşüşlü sinüs (vuruş) + kahverengi gürültü.
 *  - Son aşamada yumuşak kırpıcı: |örnek| hiçbir koşulda 1'i aşmaz.
 *
 * Bilinçli sessizlikler: `isiDegisti` (hava olayının kendi sesi var),
 * `puanEklendi` reaksiyon/diger (reaksiyon arpeji `reaksiyon` olayında),
 * `bolumBitti` kayıp ("Kaybettin" sesini arayüz `arayuz('kaybettin')` ile
 * ekranla birlikte çalar).
 */
import type { Konum, Olay } from '../core/types';
import type { SesMotoru } from '../app/sozlesme';
import { SesHavuzu, type HavuzSesi } from './havuz';
import { gurultuUret, rastgeleUretici, yankiKanali, type GurultuRengi } from './gurultu';
import {
  AKOR_MELODI,
  AKOR_SURESI,
  KADEME_ARPEJ,
  KAZANC_ARPEJ,
  PARILTI_KAZANCI,
  PED_AKORLARI,
  SON_INDEKS,
  dalgaIndeksi,
  midiFrekans,
  nota,
  notaIndeksi,
  pariltiVar,
} from './nota';

// ─── Sabitler (§12.3) ──────────────────────────────────────────────────────
const SFX_KAZANCI = 0.8;
const MUZIK_KAZANCI = 0.35;
const ORTAM_KAZANCI = 0.25;
const YANKI_ISLAK = 0.18;
const ALCAK_ACIK = 18000;
const ALCAK_YAVAS = 1200;
/** En fazla ileri planlama (§12.4: ≤ 30 ms). */
const PLAN = 0.012;
const GURULTU_SURESI = 2;
const PED_KAZANCI = 0.05;
const KISMA_ORANI = 0.02 / PED_KAZANCI;
const KISMA_DONUS = 0.6;
/** Yönetmen kamerası zaman ölçeği (§12.1): alt olayların gecikmesi buna bölünür. */
const YAVAS_OLCEK = 0.3;

type ArayuzSesi = Parameters<SesMotoru['arayuz']>[0];

export interface SesMotoruSecenek {
  /**
   * Hazır bağlam (ölçüm/test: OfflineAudioContext). Verilirse `ac()` yeni
   * bağlam açmaz; durum denetimi atlanır (çevrimdışı bağlam başlamadan
   * 'suspended' görünür).
   */
  baglam?: BaseAudioContext;
  /** Gürültü ve rastgele ayrıntılar için tohum (ölçüm tekrarlanabilsin). */
  tohum?: number;
  /** Yutulan ses hataları (oyunu durdurmazlar); testler ve dev sayfası dinler. */
  hata?: (e: unknown) => void;
}

/** Sözleşmenin üstüne geliştirme/test yardımcıları. */
export interface SesMotoruAyrintili extends SesMotoru {
  tahtaBoyutu(w: number, h: number): void;
  /** Etkin bağlam (yoksa null). */
  readonly baglam: BaseAudioContext | null;
  /** Havuzdaki etkin ses sayısı. */
  etkinSes(): number;
  /** Dev: çıkışın çözümleyicisi (görselleştirme için). */
  cozumleyici(): AnalyserNode | null;
}

interface Dugumler {
  giris: GainNode;
  birlesme: GainNode;
  cikis: AudioNode;
  kaynaklar: AudioScheduledSourceNode[];
}
type Ses = HavuzSesi<Dugumler>;

interface TonTarifi {
  dalga?: OscillatorType;
  f: number;
  /** Bitiş frekansı (üstel kayma). */
  f2?: number;
  /** Kayma süresi (s); verilmezse atak + sönüm. */
  kayma?: number;
  a?: number;
  d: number;
  g: number;
  gec?: number;
  sent?: number;
  /** Vibrato [Hz, sent]. */
  vib?: [number, number];
  /** Alçak geçiren (Hz). */
  lp?: number;
  hedef?: AudioNode;
}

interface GurTarifi {
  renk: GurultuRengi;
  filtre?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  a?: number;
  d: number;
  g: number;
  gec?: number;
  hedef?: AudioNode;
  hiz?: number;
}

interface FmTarifi {
  f: number;
  oran: number;
  /** Modülasyon indeksi başlangıç → bitiş. */
  i1: number;
  i2?: number;
  a?: number;
  d: number;
  g: number;
  gec?: number;
  hedef?: AudioNode;
}

interface SesSecenek {
  pan?: number;
  kazanc?: number;
  /** Ek yankı gönderimi (çanlar için; yol gönderimine eklenir). */
  yanki?: number;
  /** Birleşme penceresi (s): aynı tür bu kadar yakınsa yeni ses açılmaz. */
  birlestir?: number;
  /** Başlangıç gecikmesi (s). */
  gec?: number;
}

interface Yollar {
  sfx: GainNode;
  muzik: GainNode;
  kisma: GainNode;
  ortam: GainNode;
  yankiGiris: GainNode;
  ana: GainNode;
  alcak: BiquadFilterNode;
  komp: DynamicsCompressorNode;
  cikis: GainNode;
  kirpici: WaveShaperNode;
  gurultu: Record<GurultuRengi, AudioBuffer>;
}

type AcSinifi = new (o?: AudioContextOptions) => AudioContext;

function acSinifi(): AcSinifi | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AcSinifi; webkitAudioContext?: AcSinifi };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const sinirla = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function sesMotoruOlustur(secenek: SesMotoruSecenek = {}): SesMotoruAyrintili {
  const cevrimdisi = !!secenek.baglam;
  let ctx: BaseAudioContext | null = secenek.baglam ?? null;
  let gercek: AudioContext | null = null;
  let yol: Yollar | null = null;
  let kurulamadi = false;
  let kilitAcildi = false;
  const rnd = rastgeleUretici(secenek.tohum ?? 0x5eed);
  const r01 = () => (rnd() + 1) / 2;

  const ayar = { sfx: 1, muzik: 1, sessiz: false };
  let ortamIstendi = false;
  let muzikIstendi = false;
  let disAskida = false;
  let yavas = false;
  let tahta = { w: 7, h: 9 };
  /** Fitilin son notasının indeksi (ısı dalgaları buradan devam eder). */
  let sonNota = 0;
  /** Son çalınan pop notası (döşeme çanı k+5 vb.). */
  let sonPop = 0;
  const sonCalinma = new Map<string, number>();
  let analiz: AnalyserNode | null = null;

  const havuz = new SesHavuzu<Dugumler>(24, (s, calindi, simdi) => {
    if (calindi) sustur(s.veri, simdi);
    else
      try {
        s.veri.cikis.disconnect();
      } catch {
        /* zaten kopuk */
      }
  });

  // ─── Kurulum ─────────────────────────────────────────────────────────

  function kur(): void {
    if (yol || kurulamadi) return;
    try {
      if (!ctx) {
        const AC = acSinifi();
        if (!AC) {
          kurulamadi = true;
          return;
        }
        try {
          // iOS 17+: sessiz anahtara uy, oyuncunun müziğini kesme.
          const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
          if (as) as.type = 'ambient';
        } catch {
          /* desteklenmiyor */
        }
        try {
          gercek = new AC({ latencyHint: 'interactive' });
        } catch {
          gercek = new AC();
        }
        ctx = gercek;
      }
      yolKur(ctx);
      if (gercek) {
        gercek.addEventListener?.('statechange', () => {
          if (gercek && gercek.state !== 'running' && !askidaOlmali()) bekleyenAcilis = true;
        });
        for (const ad of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(ad, kesintidenDon, { capture: true, passive: true });
        document.addEventListener('visibilitychange', gorunurluk);
      }
      if (ortamIstendi) ortamBaslat();
      if (muzikIstendi) muzikBaslat();
    } catch {
      kurulamadi = !yol;
    }
  }

  function yolKur(c: BaseAudioContext): void {
    const kazanc = (v: number) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const oran = c.sampleRate;
    const tampon = (renk: GurultuRengi, tohum: number) => {
      const n = Math.floor(oran * GURULTU_SURESI);
      const b = c.createBuffer(1, n, oran);
      b.getChannelData(0).set(gurultuUret(renk, n, tohum));
      return b;
    };
    const gurultu = { beyaz: tampon('beyaz', 11), pembe: tampon('pembe', 23), kahve: tampon('kahve', 37) };

    const ana = kazanc(1);
    const alcak = c.createBiquadFilter();
    alcak.type = 'lowpass';
    alcak.frequency.value = ALCAK_ACIK;
    alcak.Q.value = 0.5;
    const komp = c.createDynamicsCompressor();
    komp.threshold.value = -18;
    komp.knee.value = 12;
    komp.ratio.value = 4;
    komp.attack.value = 0.003;
    komp.release.value = 0.15;
    const cikis = kazanc(ayar.sessiz ? 0 : 1);
    const kirpici = c.createWaveShaper();
    kirpici.curve = kirpiciEgrisi();
    kirpici.oversample = '2x';
    ana.connect(alcak);
    alcak.connect(komp);
    komp.connect(cikis);
    cikis.connect(kirpici);
    kirpici.connect(c.destination);

    // Yankı: 1,8 sn stereo gürültü, exp(−t/0,45). Dönüşte yumuşak süzgeç (sıcak kuyruk).
    const conv = c.createConvolver();
    const ir = c.createBuffer(2, Math.floor(oran * 1.8), oran);
    ir.getChannelData(0).set(yankiKanali(oran, 101));
    ir.getChannelData(1).set(yankiKanali(oran, 202));
    conv.buffer = ir;
    const yankiGiris = kazanc(1);
    const donusAlcak = c.createBiquadFilter();
    donusAlcak.type = 'lowpass';
    donusAlcak.frequency.value = 6500;
    const donusYuksek = c.createBiquadFilter();
    donusYuksek.type = 'highpass';
    donusYuksek.frequency.value = 140;
    yankiGiris.connect(conv);
    conv.connect(donusAlcak);
    donusAlcak.connect(donusYuksek);
    donusYuksek.connect(ana);

    const sfx = kazanc(SFX_KAZANCI * ayar.sfx);
    sfx.connect(ana);
    const sfxYanki = kazanc(YANKI_ISLAK);
    sfx.connect(sfxYanki);
    sfxYanki.connect(yankiGiris);

    const muzik = kazanc(MUZIK_KAZANCI * ayar.muzik);
    const kisma = kazanc(1);
    kisma.connect(muzik);
    muzik.connect(ana);
    const muzikYanki = kazanc(YANKI_ISLAK * 1.6);
    muzik.connect(muzikYanki);
    muzikYanki.connect(yankiGiris);

    const ortam = kazanc(ORTAM_KAZANCI);
    ortam.connect(ana);

    yol = { sfx, muzik, kisma, ortam, yankiGiris, ana, alcak, komp, cikis, kirpici, gurultu };
    if (yavas) alcak.frequency.value = ALCAK_YAVAS;
  }

  /** |x| ≤ 0,8 doğrusal; üstü tanh ile 0,95'e yumuşak yaklaşır. */
  function kirpiciEgrisi(): Float32Array<ArrayBuffer> {
    const n = 4096;
    const e = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const m = Math.abs(x);
      const y = m <= 0.8 ? m : 0.8 + 0.19 * Math.tanh((m - 0.8) / 0.19);
      e[i] = Math.sign(x) * y;
    }
    return e;
  }

  // ─── Askı / kesinti ──────────────────────────────────────────────────

  let bekleyenAcilis = false;
  const gizli = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const askidaOlmali = () => disAskida || gizli();

  function durumUygula(): void {
    const g = gercek;
    if (!g) return;
    try {
      if (askidaOlmali()) {
        if (g.state === 'running') void g.suspend().catch(() => {});
      } else if (g.state !== 'running' && kilitAcildi) {
        void g.resume().catch(() => {});
      }
    } catch {
      /* bağlam kapanmış */
    }
  }

  function gorunurluk(): void {
    durumUygula();
  }

  /** iOS kesintisinden ('interrupted') sonra ilk dokunuşta sürdür. */
  function kesintidenDon(): void {
    if (!gercek || askidaOlmali()) return;
    if (gercek.state !== 'running' || bekleyenAcilis) {
      bekleyenAcilis = false;
      try {
        void gercek.resume().catch(() => {});
      } catch {
        /* yok */
      }
    }
  }

  function kilidiAc(): void {
    const g = gercek;
    if (!g || kilitAcildi) return;
    kilitAcildi = true;
    try {
      // iOS eski sürümler: dokunuş içinde bir tampon çalmak çıkışı açar.
      const b = g.createBuffer(1, 1, g.sampleRate);
      const s = g.createBufferSource();
      s.buffer = b;
      s.connect(g.destination);
      s.start(0);
    } catch {
      /* gerek yok */
    }
  }

  // ─── Ses altyapısı ───────────────────────────────────────────────────

  function calabilir(): boolean {
    if (!ctx || !yol || ayar.sessiz) return false;
    if (cevrimdisi) return true;
    return ctx.state === 'running';
  }

  const simdi = () => (ctx ? ctx.currentTime + PLAN : 0);
  const olcek = () => (yavas ? 1 / YAVAS_OLCEK : 1);

  /** Aynı anahtar `pencere` saniye içinde çalındıysa true (çift çalmayı önler). */
  function yakindaCalindi(anahtar: string, pencere: number): boolean {
    const t = ctx ? ctx.currentTime : 0;
    const son = sonCalinma.get(anahtar);
    if (son !== undefined && t - son < pencere && t >= son) return true;
    sonCalinma.set(anahtar, t);
    return false;
  }

  function sustur(d: Dugumler, t: number): void {
    try {
      const g = d.birlesme.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.015);
      for (const k of d.kaynaklar) {
        try {
          k.stop(t + 0.03);
        } catch {
          /* zaten durmuş */
        }
      }
    } catch {
      /* bağlam kapandı */
    }
  }

  /** Yeni ses (havuzda bir yer). Birleşirse null döner. */
  function sesAc(tur: string, sure: number, o: SesSecenek = {}): Ses | null {
    if (!calabilir()) return null;
    const c = ctx!;
    const y = yol!;
    const t = simdi() + (o.gec ?? 0);
    if (o.birlestir) {
      const m = havuz.birlestir(tur, t, o.birlestir);
      if (m) {
        try {
          m.veri.birlesme.gain.setValueAtTime(m.carpan, Math.max(t, m.bas));
        } catch {
          /* yok */
        }
        return null;
      }
    }
    const giris = c.createGain();
    giris.gain.value = o.kazanc ?? 1;
    const birlesme = c.createGain();
    birlesme.gain.value = 1;
    giris.connect(birlesme);
    let cikis: AudioNode = birlesme;
    if (o.pan && typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = sinirla(o.pan, -1, 1);
      birlesme.connect(p);
      cikis = p;
    }
    cikis.connect(y.sfx);
    if (o.yanki) {
      const w = c.createGain();
      w.gain.value = o.yanki;
      cikis.connect(w);
      w.connect(y.yankiGiris);
    }
    return havuz.ekle(tur, t, t + sure + 0.05, { giris, birlesme, cikis, kaynaklar: [] }, c.currentTime);
  }

  /** Zarf: doğrusal atak, üstel sönüm (−60 dB'ye `d`'de), sonra 0. */
  function zarf(p: AudioParam, t0: number, a: number, d: number, tepe: number): void {
    p.setValueAtTime(0, t0);
    p.linearRampToValueAtTime(tepe, t0 + a);
    p.exponentialRampToValueAtTime(Math.max(1e-6, tepe * 1e-3), t0 + a + d);
    p.linearRampToValueAtTime(0, t0 + a + d + 0.008);
  }

  function ton(s: Ses, r: TonTarifi): void {
    const c = ctx!;
    const t0 = s.bas + (r.gec ?? 0);
    const a = r.a ?? 0.002;
    const bit = t0 + a + r.d + 0.012;
    const o = c.createOscillator();
    o.type = r.dalga ?? 'sine';
    o.frequency.setValueAtTime(r.f, t0);
    if (r.f2 && r.f2 > 0) o.frequency.exponentialRampToValueAtTime(r.f2, t0 + (r.kayma ?? a + r.d));
    if (r.sent) o.detune.value = r.sent;
    if (r.vib) {
      const l = c.createOscillator();
      l.frequency.value = r.vib[0];
      const lg = c.createGain();
      lg.gain.value = r.vib[1];
      l.connect(lg);
      lg.connect(o.detune);
      l.start(t0);
      l.stop(bit);
      s.veri.kaynaklar.push(l);
    }
    const g = c.createGain();
    zarf(g.gain, t0, a, r.d, r.g);
    let bas: AudioNode = g;
    if (r.lp) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = r.lp;
      f.connect(g);
      bas = f;
    }
    o.connect(bas);
    g.connect(r.hedef ?? s.veri.giris);
    o.start(t0);
    o.stop(bit);
    s.veri.kaynaklar.push(o);
  }

  function gur(s: Ses, r: GurTarifi): void {
    const c = ctx!;
    const t0 = s.bas + (r.gec ?? 0);
    const a = r.a ?? 0.002;
    const src = c.createBufferSource();
    src.buffer = yol!.gurultu[r.renk];
    src.loop = true;
    if (r.hiz) src.playbackRate.value = r.hiz;
    let son: AudioNode = src;
    if (r.filtre) {
      const f = c.createBiquadFilter();
      f.type = r.filtre;
      f.frequency.setValueAtTime(r.f ?? 1000, t0);
      if (r.f2 && r.f2 > 0) f.frequency.exponentialRampToValueAtTime(r.f2, t0 + a + r.d);
      f.Q.value = r.q ?? 0.8;
      src.connect(f);
      son = f;
    }
    const g = c.createGain();
    zarf(g.gain, t0, a, r.d, r.g);
    son.connect(g);
    g.connect(r.hedef ?? s.veri.giris);
    src.start(t0, r01() * (GURULTU_SURESI - 0.2));
    src.stop(t0 + a + r.d + 0.012);
    s.veri.kaynaklar.push(src);
  }

  function fm(s: Ses, r: FmTarifi): void {
    const c = ctx!;
    const t0 = s.bas + (r.gec ?? 0);
    const a = r.a ?? 0.003;
    const bit = t0 + a + r.d + 0.012;
    const tas = c.createOscillator();
    tas.frequency.value = r.f;
    const mod = c.createOscillator();
    mod.frequency.value = r.f * r.oran;
    const mg = c.createGain();
    // Frekans sapması = indeks × modülatör frekansı.
    mg.gain.setValueAtTime(r.i1 * r.f * r.oran, t0);
    mg.gain.linearRampToValueAtTime((r.i2 ?? 0) * r.f * r.oran, t0 + a + r.d);
    mod.connect(mg);
    mg.connect(tas.frequency);
    const g = c.createGain();
    zarf(g.gain, t0, a, r.d, r.g);
    tas.connect(g);
    g.connect(r.hedef ?? s.veri.giris);
    tas.start(t0);
    mod.start(t0);
    tas.stop(bit);
    mod.stop(bit);
    s.veri.kaynaklar.push(tas, mod);
  }

  /** Rastgele zamanlı kısa tıkırtılar (çıtırtı, kıvılcım). */
  function citirti(s: Ses, adet: number, bas: number, sure: number, g: number, f = 3500): void {
    for (let i = 0; i < adet; i++) {
      gur(s, { renk: 'beyaz', filtre: 'highpass', f: f * (0.8 + 0.5 * r01()), a: 0.0005, d: 0.004 + 0.004 * r01(), g: g * (0.5 + 0.5 * r01()), gec: bas + r01() * sure });
    }
  }

  /** Müziği büyük olaylarda kıs (§12.3): 0,05 → 0,02, 600 ms'de döner. */
  function kis(): void {
    if (!yol || !ctx) return;
    const p = yol.kisma.gain;
    const t = ctx.currentTime;
    try {
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(KISMA_ORANI, t + 0.03);
      p.linearRampToValueAtTime(1, t + 0.03 + KISMA_DONUS);
    } catch {
      /* yok */
    }
  }

  function panX(h: Konum | undefined): number {
    if (!h) return 0;
    return sinirla(((h.x + 0.5) / tahta.w - 0.5) * 1.1, -0.55, 0.55);
  }

  // ─── Ses tarifleri ───────────────────────────────────────────────────

  /** Düğüm "çıt"ı (§12.2): nota k, sinüs + üçgen, A2 D60; sıcak kuyruk ve kalimba çıtı katmanı. */
  function cit(k: number): void {
    const f = nota(notaIndeksi(k));
    const s = sesAc('cit', 0.45, { kazanc: 0.34, yanki: 0.1 });
    if (!s) return;
    ton(s, { f, a: 0.002, d: 0.06, g: 1 });
    ton(s, { dalga: 'triangle', f, a: 0.002, d: 0.06, g: 0.45 });
    ton(s, { f, a: 0.004, d: 0.24, g: 0.2 });
    ton(s, { f: f * 2, a: 0.001, d: 0.022, g: 0.22 });
    if (pariltiVar(k)) ton(s, { f: f * 2, a: 0.012, d: 0.38, g: PARILTI_KAZANCI, vib: [6, 10] });
  }

  /** "Pop" (§12.2): sinüs + üçgen, nota, 80 ms'de ×0,9439 düşüş, A2 D120; gürültü 30 ms 2 kHz; gövde. */
  function pop(i: number, pan: number, guc: number, tur: string): void {
    const f = nota(i);
    sonPop = i;
    const s = sesAc(tur, 0.35, { pan, kazanc: 0.4 * guc, yanki: 0.06, birlestir: 0.015 });
    if (!s) return;
    ton(s, { f, f2: f * 0.9439, kayma: 0.08, a: 0.002, d: 0.12, g: 1 });
    ton(s, { dalga: 'triangle', f, f2: f * 0.9439, kayma: 0.08, a: 0.002, d: 0.12, g: 0.4 });
    ton(s, { f: f * 2.01, a: 0.001, d: 0.03, g: 0.14 });
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 2000, q: 1.2, a: 0.001, d: 0.03, g: 0.42 });
    ton(s, { f: 190, f2: 70, kayma: 0.07, a: 0.001, d: 0.08, g: 0.32 });
  }

  /** "Güm" (§12.2 ısı patlaması): sinüs 55 Hz, A5 D180; vuruş için perde düşüşü. */
  function gum(f: number, guc: number, gec = 0): void {
    const s = sesAc('gum', 0.3, { kazanc: 0.5 * guc, birlestir: 0.05, gec });
    if (!s) return;
    ton(s, { f: f * 2, f2: f, kayma: 0.05, a: 0.005, d: 0.18, g: 1 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 220, a: 0.004, d: 0.09, g: 0.35 });
  }

  /** FM çan (§12.2 özel eşiği): taşıyıcı nota, oran 3,5, indeks 2→0, 600 ms. */
  function can(s: Ses, f: number, gec = 0, g = 1, d = 0.6): void {
    fm(s, { f, oran: 3.5, i1: 2, i2: 0, a: 0.003, d, g, gec });
    ton(s, { f: f / 2, a: 0.006, d: d * 0.8, g: g * 0.28, gec });
  }

  function fis(gucu: number): void {
    const s = sesAc('fis', 0.2, { kazanc: 1 });
    if (!s) return;
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 1500, q: 1, a: 0.004, d: 0.06, g: 0.15 * gucu });
  }

  function kalabalik(sure: number, guc: number): void {
    const s = sesAc('kalabalik', sure + 0.4, { kazanc: 0.2 * guc, yanki: 0.15 });
    if (!s) return;
    const c = ctx!;
    // Alkış/tezahürat: biçimlendirici bantlarda pembe gürültü + hızlı genlik titreşimi.
    const am = c.createGain();
    am.gain.value = 0.7;
    const lfo = c.createOscillator();
    lfo.frequency.value = 7 + 3 * r01();
    const lg = c.createGain();
    lg.gain.value = 0.3;
    lfo.connect(lg);
    lg.connect(am.gain);
    am.connect(s.veri.giris);
    lfo.start(s.bas);
    lfo.stop(s.bas + sure + 0.3);
    s.veri.kaynaklar.push(lfo);
    for (const [f, g] of [[520, 0.7], [1150, 0.55], [2600, 0.35]] as const) {
      gur(s, { renk: 'pembe', filtre: 'bandpass', f, q: 1.1, a: sure * 0.25, d: sure * 0.75, g, hedef: am, hiz: 0.9 + 0.2 * r01() });
    }
    citirti(s, Math.round(sure * 14), 0.05, sure * 0.8, 0.25, 2200);
  }

  function tutusma(): void {
    if (yakindaCalindi('tutusma', 0.12)) return;
    const s = sesAc('tutusma', 0.45, { kazanc: 1, yanki: 0.08 });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 3000, f2: 6000, q: 1.4, a: 0.01, d: 0.2, g: 0.22 });
    gur(s, { renk: 'pembe', filtre: 'lowpass', f: 900, a: 0.006, d: 0.16, g: 0.2 });
    ton(s, { f: 140, f2: 70, a: 0.003, d: 0.12, g: 0.16 });
    citirti(s, 4, 0.02, 0.16, 0.35);
  }

  function hedefTamam(): void {
    if (yakindaCalindi('hedefTamam', 0.15)) return;
    const s = sesAc('hedefTamam', 1.3, { kazanc: 0.2, yanki: 0.25 });
    if (!s) return;
    [5, 7, 8].forEach((i, n) => can(s, nota(i), n * 0.02, 0.8, 0.9));
    ton(s, { f: nota(10) * 2, a: 0.01, d: 0.5, g: 0.1, gec: 0.05, vib: [7, 12] });
  }

  function korukDolu(): void {
    if (yakindaCalindi('korukDolu', 0.3)) return;
    const s = sesAc('koruk', 1.1, { kazanc: 0.32, yanki: 0.2 });
    if (!s) return;
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 600, q: 1, a: 0.12, d: 0.28, g: 1 });
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 1300, q: 2, a: 0.1, d: 0.25, g: 0.3 });
    can(s, nota(7), 0.25, 0.45, 0.6);
  }

  function arpej(s: Ses, indeksler: readonly number[], aralik: number, g: number, d = 0.5, gec = 0): void {
    indeksler.forEach((i, n) => {
      const f = nota(i);
      fm(s, { f, oran: 3.5, i1: 1.2, i2: 0, a: 0.002, d, g, gec: gec + n * aralik });
      ton(s, { dalga: 'triangle', f, a: 0.002, d: d * 0.4, g: g * 0.35, gec: gec + n * aralik });
    });
  }

  function roketCat(gec: number, pan: number): void {
    const s = sesAc('cat', 0.1, { pan, kazanc: 0.3, gec });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 1800, q: 0.9, a: 0.001, d: 0.04, g: 0.9 });
    ton(s, { dalga: 'square', f: 220, a: 0.001, d: 0.03, g: 0.25, lp: 2600 });
  }

  /** Roket ekseni boyunca iki yöndeki kenara uzaklık (hücre) ve yönün x işareti. */
  function kenarlar(h: Konum, eksen: number): [number, number][] {
    const { w, h: hh } = tahta;
    const { x, y } = h;
    switch (eksen) {
      case 0:
        return [[x + 1, -1], [w - x, 1]];
      case 1:
        return [[y + 1, 0], [hh - y, 0]];
      case 2:
        return [[Math.min(w - x, y + 1), 1], [Math.min(x + 1, hh - y), -1]];
      default:
        return [[Math.min(w - x, hh - y), 1], [Math.min(x + 1, y + 1), -1]];
    }
  }

  function roket(h: Konum, eksen: number): void {
    const pan = panX(h);
    const s = sesAc('roket', 0.6, { pan, kazanc: 0.26, yanki: 0.1 });
    if (s) {
      ton(s, { f: 800, f2: 2400, kayma: 0.4, a: 0.01, d: 0.4, g: 1, vib: [12, 30] });
      gur(s, { renk: 'beyaz', filtre: 'highpass', f: 3000, a: 0.01, d: 0.4, g: 0.42 });
      ton(s, { f: 160, f2: 60, a: 0.002, d: 0.1, g: 0.5 });
    }
    // "Çat": roket başı tahta kenarına ulaşınca (25 tik/hücre).
    for (const [d, yon] of kenarlar(h, eksen)) roketCat(0.025 * d * olcek(), yon === 0 ? pan : sinirla(pan + yon * 0.35, -0.7, 0.7));
  }

  function kasimpati(h: Konum): void {
    kis();
    const s = sesAc('kasimpati', 0.9, { pan: panX(h), kazanc: 0.34, yanki: 0.22 });
    if (!s) return;
    gur(s, { renk: 'pembe', filtre: 'lowpass', f: 4000, f2: 300, q: 0.7, a: 0.004, d: 0.4, g: 0.95 });
    ton(s, { f: 140, f2: 70, kayma: 0.06, a: 0.004, d: 0.3, g: 0.85 });
    can(s, nota(8), 0.02, 0.32);
    citirti(s, 10, 0.06, 0.45, 0.4, 2600);
  }

  function yildiz(h: Konum): void {
    kis();
    const s = sesAc('yildiz', 1.3, { pan: panX(h), kazanc: 0.22, yanki: 0.3 });
    if (!s) return;
    // Pırıltı (§12.2): akor tonlarında 6 sinüs, ±7 sent, 30 ms aralı, 900 ms sönüm.
    const akor = [5, 7, 8, 10, 10, 10];
    akor.forEach((i, n) => {
      const f = nota(i) * (n >= 4 ? (n === 4 ? 1.25 : 1.5) : 1);
      ton(s, { f, a: 0.004, d: 0.9, g: 0.5, gec: n * 0.03, sent: (r01() * 2 - 1) * 7 });
    });
    ton(s, { f: 110, f2: 55, a: 0.004, d: 0.25, g: 0.6 });
  }

  function kombinasyon(h: Konum, kombo: string): void {
    kis();
    const buyuk = kombo === 'buyukFinal';
    const s = sesAc('kombo', buyuk ? 2.2 : 1.2, { pan: panX(h) * 0.5, kazanc: buyuk ? 0.5 : 0.44, yanki: 0.2 });
    if (!s) return;
    // Bum (§12.2): sinüs 45 Hz 400 ms + gürültü 600 ms, alçak geçiren 800 Hz.
    ton(s, { f: 95, f2: 45, kayma: 0.09, a: 0.004, d: 0.4, g: 1 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 800, a: 0.008, d: 0.6, g: 0.9 });
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 1600, q: 0.7, a: 0.001, d: 0.06, g: 0.35 });
    citirti(s, buyuk ? 26 : 14, 0.12, buyuk ? 1.4 : 0.7, 0.32, 2400);
    if (buyuk) arpej(s, [0, 2, 3, 5, 7, 8, 10], 0.06, 0.32, 0.7, 0.1);
    else can(s, nota(kombo === 'devKasimpati' ? 7 : kombo.startsWith('roket') || kombo === 'bahce' ? 9 : 8), 0.05, 0.3);
  }

  function devFisekFirladi(h: Konum): void {
    kis();
    const pan = panX(h);
    const s = sesAc('devFisek', 1.7, { pan, kazanc: 0.42, yanki: 0.28 });
    if (!s) return;
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 320, a: 0.02, d: 0.15, g: 0.8 });
    ton(s, { f: 500, f2: 2600, kayma: 0.7, gec: 0.15, a: 0.02, d: 0.7, g: 0.3, vib: [9, 25] });
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 2500, f2: 5000, q: 3, gec: 0.15, a: 0.02, d: 0.7, g: 0.12 });
    ton(s, { f: 110, f2: 45, kayma: 0.08, gec: 0.9, a: 0.004, d: 0.5, g: 1 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 900, gec: 0.9, a: 0.006, d: 0.7, g: 0.9 });
    citirti(s, 14, 0.98, 0.65, 0.35, 2600);
  }

  function yercekimi(o: Extract<Olay, { tur: 'yercekimi' }>): void {
    // Sütun başına bir tık (§12.2): sütunun son taşı oturduğunda (90·√d ms).
    const sutun = new Map<number, number>();
    const ekle = (x: number, d: number) => {
      if (d <= 0) return;
      const t = 0.09 * Math.sqrt(d);
      if ((sutun.get(x) ?? 0) < t) sutun.set(x, t);
    };
    for (const d of o.dusenler) ekle(d.e.x, d.e.y - d.den.y);
    for (const d of o.doganlar) ekle(d.hucre.x, d.hucre.y - d.sanalY);
    for (const [x, t] of sutun) {
      const s = sesAc('tik', 0.08, { pan: panX({ x, y: 0 }), kazanc: 0.07, birlestir: 0.015, gec: t * olcek() });
      if (!s) continue;
      ton(s, { dalga: 'triangle', f: 760 + x * 45, a: 0.001, d: 0.03, g: 1 });
      gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 3200, q: 1.5, a: 0.0005, d: 0.012, g: 0.5 });
    }
  }

  function havaOlayi(o: Extract<Olay, { tur: 'havaOlayi' }>): void {
    if (o.olay === 'meltem') {
      const s = sesAc('meltem', o.uyari ? 0.8 : 1.4, { kazanc: o.uyari ? 0.15 : 0.2, yanki: 0.1 });
      if (!s) return;
      if (o.uyari) {
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 700, f2: 1100, q: 2, a: 0.2, d: 0.5, g: 1 });
      } else {
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 400, f2: 1600, q: 1.6, a: 0.25, d: 0.55, g: 1 });
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 1500, f2: 600, q: 1.6, a: 0.2, d: 0.6, g: 0.7, gec: 0.45 });
        ton(s, { f: 220, f2: 330, a: 0.2, d: 0.6, g: 0.18 });
      }
      return;
    }
    const s = sesAc('cisenti', o.uyari ? 0.6 : 1.1, { kazanc: o.uyari ? 0.12 : 0.16, yanki: 0.12 });
    if (!s) return;
    const damla = o.uyari ? 3 : 14;
    for (let i = 0; i < damla; i++) {
      const f = 1100 + 900 * r01();
      ton(s, { f, f2: f * 0.5, kayma: 0.03, a: 0.001, d: 0.04, g: 0.5, gec: r01() * (o.uyari ? 0.4 : 0.8) });
    }
    if (!o.uyari) {
      gur(s, { renk: 'beyaz', filtre: 'highpass', f: 6000, a: 0.1, d: 0.7, g: 0.35 });
      gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 4000, q: 1.2, a: 0.05, d: 0.5, g: 0.3, gec: 0.2 });
    }
  }

  function karistirma(): void {
    const s = sesAc('karistirma', 0.6, { kazanc: 0.5, yanki: 0.12 });
    if (!s) return;
    const c = ctx!;
    let hedef: AudioNode = s.veri.giris;
    if (typeof c.createStereoPanner === 'function') {
      // Dönen gürültü süpürmesi: stereo konum 4 Hz LFO ile döner.
      const p = c.createStereoPanner();
      const lfo = c.createOscillator();
      lfo.frequency.value = 4;
      const lg = c.createGain();
      lg.gain.value = 0.6;
      lfo.connect(lg);
      lg.connect(p.pan);
      p.connect(s.veri.giris);
      lfo.start(s.bas);
      lfo.stop(s.bas + 0.6);
      s.veri.kaynaklar.push(lfo);
      hedef = p;
    }
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 400, f2: 2400, q: 1.5, a: 0.05, d: 0.25, g: 1, hedef });
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 2400, f2: 500, q: 1.5, a: 0.03, d: 0.25, g: 0.9, gec: 0.25, hedef });
    citirti(s, 5, 0.05, 0.45, 0.2, 1800);
  }

  function reaksiyonArpeji(kademe: 'guzel' | 'harika' | 'muhtesem' | 'senlik'): void {
    if (kademe !== 'guzel') kis();
    const notalar = KADEME_ARPEJ[kademe];
    const s = sesAc('reaksiyon', 0.07 * notalar.length + 1, { kazanc: 0.22, yanki: 0.25 });
    if (s) arpej(s, notalar, 0.07, 0.6, 0.6);
    if (kademe === 'muhtesem' || kademe === 'senlik') kalabalik(kademe === 'senlik' ? 1.8 : 1.1, kademe === 'senlik' ? 1 : 0.7);
    if (kademe === 'senlik') gum(50, 1);
  }

  // ─── Olay eşlemesi (§12.2, §12.4) ────────────────────────────────────

  function olay(o: Olay): void {
    if (!calabilir()) {
      // Durum notaları yine izlenir (ses açılınca doğru notadan devam).
      if (o.tur === 'fitilBasladi') sonNota = notaIndeksi(o.yol.length);
      else if (o.tur === 'reaksiyon') sonNota = 0;
      return;
    }
    switch (o.tur) {
      case 'fitilBasladi':
        sonNota = notaIndeksi(o.yol.length);
        tutusma();
        return;
      case 'dugumYandi': {
        // Alev düğüme vardı: fitil çıtırtısı (nota, aynı anki `patlama`da).
        const s = sesAc('fitilCitirti', 0.06, { pan: panX(o.hucre), kazanc: 0.14 });
        if (s) citirti(s, 2, 0, 0.03, 1, 3500);
        return;
      }
      case 'patlama': {
        const pan = panX(o.hucre);
        switch (o.neden) {
          case 'fitil':
            pop(notaIndeksi(o.k || 1), pan, 1, 'pop:fitil');
            return;
          case 'isi':
            pop(dalgaIndeksi(sonNota, o.nesil), pan, 0.9, 'pop:isi');
            gum(55, 0.9);
            return;
          case 'kibrit':
            pop(sinirla(sonNota + 2, 0, SON_INDEKS), pan, 0.9, 'pop:kibrit');
            gum(70, 0.7);
            return;
          default: {
            // Vuruş/iz/dev fişek/final: konuma göre pentatonik çeşitleme, daha hafif.
            const i = sinirla(sonNota + 1 + ((o.hucre.x * 3 + o.hucre.y * 5) % 4), 0, SON_INDEKS);
            pop(i, pan, o.neden === 'final' ? 0.55 : 0.62, `pop:${o.neden}`);
            return;
          }
        }
      }
      case 'isindi': {
        // §12.2: sinüs 2 kHz (C7 = 2093 Hz, dizinin tepesi), 15 ms, 0,05; 15 ms'de birleşir.
        const s = sesAc('isindi', 0.04, { pan: panX(o.hucre), kazanc: 0.05, birlestir: 0.015 });
        if (s) ton(s, { f: nota(SON_INDEKS), a: 0.001, d: 0.015, g: 1 });
        if (o.kizgin) {
          const k = sesAc('kizgin', 0.16, { pan: panX(o.hucre), kazanc: 0.09, birlestir: 0.03 });
          if (k) {
            gur(k, { renk: 'beyaz', filtre: 'highpass', f: 5000, a: 0.004, d: 0.12, g: 1 });
            citirti(k, 3, 0.01, 0.1, 0.6, 6000);
          }
        }
        return;
      }
      case 'isiDegisti':
        return; // bilinçli sessizlik: hava olayının kendi sesi var
      case 'ozelOlustu': {
        const i = o.ozel === 'kasimpati' ? notaIndeksi(9) : o.ozel === 'yildiz' ? notaIndeksi(12) : notaIndeksi(6);
        const s = sesAc('ozelOlustu', 1.1, { pan: panX(o.hucre), kazanc: 0.26, yanki: 0.25 });
        if (!s) return;
        const f = nota(i);
        can(s, f, 0, 1, 0.7);
        ton(s, { f: f * 1.5, a: 0.003, d: 0.25, g: 0.22, gec: 0.06 });
        ton(s, { f: f * 2, a: 0.003, d: 0.3, g: 0.18, gec: 0.12 });
        if (o.ozel === 'roket') gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 2000, f2: 5000, q: 1.2, a: 0.02, d: 0.25, g: 0.18 });
        if (o.ozel === 'yildiz') for (let n = 0; n < 4; n++) ton(s, { f: nota(7 + n) * 2, a: 0.003, d: 0.4, g: 0.12, gec: 0.15 + n * 0.05 });
        return;
      }
      case 'ozelTetiklendi':
        if (o.ozel === 'roket') roket(o.hucre, o.eksen);
        else if (o.ozel === 'kasimpati') kasimpati(o.hucre);
        else if (o.ozel === 'yildiz') yildiz(o.hucre);
        return;
      case 'yuklendi': {
        const s = sesAc('yuklendi', 0.4, { pan: panX(o.hucre), kazanc: 0.16, yanki: 0.12 });
        if (!s) return;
        ton(s, { f: 300, f2: 900, kayma: 0.3, a: 0.02, d: 0.3, g: 1, vib: [14, 20] });
        ton(s, { dalga: 'triangle', f: 600, f2: 1800, kayma: 0.3, a: 0.02, d: 0.3, g: 0.3 });
        return;
      }
      case 'kombinasyon':
        kombinasyon(o.hucre, o.kombo);
        return;
      case 'isiDalgasi': {
        const s = sesAc('isiDalgasi', 0.35, { pan: panX(o.merkez), kazanc: 0.12, birlestir: 0.03 });
        if (s) gur(s, { renk: 'pembe', filtre: 'lowpass', f: 1400, f2: 400, a: 0.04, d: 0.26, g: 1 });
        return;
      }
      case 'engelHasar': {
        const pan = panX(o.hucre);
        if (o.engel === 'kaya') {
          // "Tok" (§12.2): gürültü 800 Hz alçak geçiren 60 ms + sinüs 140 Hz 50 ms.
          const s = sesAc('kaya', o.kalan === 0 ? 0.3 : 0.1, { pan, kazanc: 0.42, birlestir: 0.015 });
          if (!s) return;
          gur(s, { renk: 'beyaz', filtre: 'lowpass', f: 800, a: 0.001, d: 0.06, g: 0.7 });
          ton(s, { f: 140, a: 0.001, d: 0.05, g: 0.8 });
          if (o.kalan === 0) {
            ton(s, { f: 95, f2: 60, a: 0.002, d: 0.15, g: 0.6, gec: 0.02 });
            for (let i = 0; i < 6; i++) gur(s, { renk: 'beyaz', filtre: 'lowpass', f: 1200 + 800 * r01(), a: 0.001, d: 0.02, g: 0.4, gec: 0.03 + r01() * 0.17 });
          }
        } else {
          // Kova: bant geçiren 1 kHz aşağı süpürme, 150 ms + damla "plip".
          const s = sesAc('kova', 0.2, { pan, kazanc: 0.6, yanki: 0.12, birlestir: 0.015 });
          if (!s) return;
          gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 1500, f2: 600, q: 2, a: 0.004, d: 0.15, g: 0.9 });
          ton(s, { f: 1200, f2: 420, kayma: 0.06, a: 0.001, d: 0.07, g: 0.35 });
          if (o.kalan === 0) gur(s, { renk: 'pembe', filtre: 'lowpass', f: 1800, a: 0.01, d: 0.2, g: 0.6, gec: 0.03 });
        }
        return;
      }
      case 'kafesKirildi': {
        // Metal "çın" (§12.2): FM oran 1,4, 2,4 kHz, 200 ms; düşen çubuk tıkırtıları.
        const s = sesAc('kafes', 0.5, { pan: panX(o.hucre), kazanc: 0.2, yanki: 0.15 });
        if (!s) return;
        fm(s, { f: 2400, oran: 1.4, i1: 1.5, i2: 0.2, a: 0.001, d: 0.2, g: 1 });
        ton(s, { f: 2400 * 2.76, a: 0.001, d: 0.08, g: 0.12 });
        [0.14, 0.22, 0.3].forEach((gec, n) => fm(s, { f: 1700 - n * 220, oran: 1.4, i1: 1, i2: 0.1, a: 0.001, d: 0.05, g: 0.35, gec }));
        return;
      }
      case 'kurudu': {
        const s = sesAc('kurudu', 0.14, { pan: panX(o.hucre), kazanc: 0.22, birlestir: 0.015 });
        if (!s) return;
        gur(s, { renk: 'beyaz', filtre: 'highpass', f: 3500, a: 0.005, d: 0.1, g: 1 });
        citirti(s, 4, 0, 0.09, 0.5, 5000);
        return;
      }
      case 'dosemeAydinlandi': {
        // Yumuşak çan, nota k+5, kazanç 0,1.
        const s = sesAc('doseme', 0.6, { pan: panX(o.hucre), kazanc: 0.1, yanki: 0.25, birlestir: 0.02 });
        if (s) fm(s, { f: nota(sonPop + 5), oran: 2, i1: 0.6, i2: 0, a: 0.004, d: 0.5, g: 1 });
        return;
      }
      case 'desenBoyandi': {
        // Marimba: üçgen, nota, A1 D250.
        const f = nota(sonPop + 2);
        const s = sesAc('desen', 0.35, { pan: panX(o.hucre), kazanc: 0.24, yanki: 0.15, birlestir: 0.015 });
        if (!s) return;
        ton(s, { dalga: 'triangle', f, a: 0.001, d: 0.25, g: 1 });
        ton(s, { f: f * 3.9, a: 0.001, d: 0.035, g: 0.12 });
        return;
      }
      case 'izYandi': {
        // Çıtırtı: rastgele 4 ms tıklar, 20/sn (60 tiklik adım başına ~2).
        const s = sesAc('iz', 0.09, { pan: panX(o.hucre), kazanc: 0.26 });
        if (!s) return;
        citirti(s, 2, 0, 0.055, 1, 2500);
        gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 6000, q: 1, a: 0.01, d: 0.05, g: 0.12 });
        return;
      }
      case 'devFisekDoldu': {
        const s = sesAc('devFisekDoldu', 0.06, { pan: panX(o.hucre), kazanc: 0.2 });
        if (!s) return;
        const f = 1500 * (1 + 0.5 * (o.dolum / Math.max(1, o.kapasite)));
        ton(s, { f, a: 0.001, d: 0.025, g: 1 });
        gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 4000, q: 2, a: 0.0005, d: 0.008, g: 0.5 });
        return;
      }
      case 'devFisekFirladi':
        devFisekFirladi(o.hucre);
        return;
      case 'isTemizlendi': {
        const s = sesAc('isTemizlendi', 0.18, { pan: panX(o.hucre), kazanc: 0.35, birlestir: 0.015 });
        if (!s) return;
        gur(s, { renk: 'pembe', filtre: 'lowpass', f: 1200, a: 0.02, d: 0.12, g: 1 });
        gur(s, { renk: 'beyaz', filtre: 'highpass', f: 5000, a: 0.01, d: 0.06, g: 0.15 });
        return;
      }
      case 'isYayildi': {
        const s = sesAc('isYayildi', 0.4, { pan: panX(o.hucre), kazanc: 0.22 });
        if (!s) return;
        gur(s, { renk: 'kahve', filtre: 'lowpass', f: 500, f2: 250, a: 0.06, d: 0.3, g: 1 });
        ton(s, { f: 110, f2: 82, a: 0.03, d: 0.3, g: 0.3 });
        return;
      }
      case 'yercekimi':
        yercekimi(o);
        return;
      case 'fenerToplandi': {
        // 3 notalı çan arpeji (G5, C6, E6).
        const s = sesAc('fener', 0.9, { pan: panX(o.hucre), kazanc: 0.22, yanki: 0.25 });
        if (s) arpej(s, [3, 5, 7], 0.08, 0.8, 0.5);
        return;
      }
      case 'havaOlayi':
        havaOlayi(o);
        return;
      case 'karistirma':
        karistirma();
        return;
      case 'hedefIlerledi': {
        if (o.tamam) {
          hedefTamam();
          return;
        }
        const s = sesAc('hedefTik', 0.06, { kazanc: 0.09, birlestir: 0.015 });
        if (!s) return;
        ton(s, { f: 1760, a: 0.001, d: 0.04, g: 1 });
        ton(s, { dalga: 'triangle', f: 880, a: 0.001, d: 0.05, g: 0.4 });
        return;
      }
      case 'puanEklendi': {
        if (o.neden === 'halka') {
          const s = sesAc('puanHalka', 0.3, { kazanc: 0.1, yanki: 0.2 });
          if (s) ton(s, { f: nota(9), a: 0.003, d: 0.2, g: 1 });
        } else if (o.neden === 'kalanHamle') {
          const s = sesAc('puanKalan', 0.15, { kazanc: 0.12, birlestir: 0.015 });
          if (s) {
            ton(s, { f: nota(7), a: 0.001, d: 0.05, g: 1 });
            ton(s, { f: nota(9), a: 0.001, d: 0.08, g: 1, gec: 0.05 });
          }
        }
        return; // reaksiyon/diger: bilinçli sessizlik (arpej `reaksiyon` olayında)
      }
      case 'korukDoldu': {
        if (o.dolum >= o.kapasite && o.kapasite > 0) {
          korukDolu();
          return;
        }
        const s = sesAc('korukTik', 0.06, { kazanc: 0.06, birlestir: 0.03 });
        if (s) ton(s, { f: 600 + 600 * (o.dolum / Math.max(1, o.kapasite)), a: 0.002, d: 0.04, g: 1 });
        return;
      }
      case 'korukKullanildi': {
        kis();
        const s = sesAc('korukKullanildi', 0.9, { pan: panX(o.merkez), kazanc: 0.3, yanki: 0.2 });
        if (!s) return;
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 600, f2: 1200, q: 1, a: 0.05, d: 0.35, g: 1 });
        ton(s, { f: 330, f2: 660, a: 0.05, d: 0.35, g: 0.3 });
        can(s, nota(5), 0.2, 0.4);
        return;
      }
      case 'guclendirici': {
        const s = sesAc('guc', 0.7, { pan: panX(o.hucre), kazanc: 0.5, yanki: 0.12 });
        if (!s) return;
        if (o.guc === 'kibrit') {
          // Kibrit çakma + parlama.
          gur(s, { renk: 'beyaz', filtre: 'highpass', f: 2500, a: 0.002, d: 0.08, g: 1 });
          gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 3500, q: 2, a: 0.02, d: 0.35, g: 0.4, gec: 0.06 });
          gur(s, { renk: 'pembe', filtre: 'lowpass', f: 700, a: 0.01, d: 0.3, g: 0.5, gec: 0.05 });
        } else {
          fm(s, { f: 900, oran: 1.4, i1: 2, i2: 0.2, a: 0.001, d: 0.3, g: 0.7 });
          ton(s, { f: 450, a: 0.002, d: 0.2, g: 0.4 });
          can(s, nota(5), 0.12, 0.35);
        }
        return;
      }
      case 'finalBasladi': {
        kis();
        const s = sesAc('final', 1.6, { kazanc: 0.3, yanki: 0.2 });
        if (s) {
          gur(s, { renk: 'pembe', filtre: 'bandpass', f: 300, f2: 3000, q: 1, a: 0.3, d: 0.5, g: 0.7 });
          // Trampet sarması: hızlanan yumuşak vuruşlar.
          let t = 0;
          for (let i = 0; i < 10; i++) {
            ton(s, { f: 90, f2: 55, a: 0.002, d: 0.08, g: 0.25 + 0.05 * i, gec: t });
            t += 0.11 - i * 0.008;
          }
        }
        kalabalik(1.5, 0.8);
        return;
      }
      case 'reaksiyon':
        if (o.kademe) reaksiyonArpeji(o.kademe);
        sonNota = 0;
        return;
      case 'bolumBitti':
        if (o.sonuc === 'kazanc') kalabalik(1.6, 0.6);
        return; // kayıp: arayüz 'kaybettin' çalar
      default: {
        const yok: never = o;
        void yok;
      }
    }
  }

  // ─── Arayüz sesleri (§12.2) ──────────────────────────────────────────

  function arayuz(tur: ArayuzSesi): void {
    if (!calabilir()) return;
    switch (tur) {
      case 'dugme': {
        const s = sesAc('dugme', 0.08, { kazanc: 0.2 });
        if (!s) return;
        ton(s, { dalga: 'triangle', f: 880, a: 0.001, d: 0.05, g: 1 });
        ton(s, { f: 1760, a: 0.001, d: 0.02, g: 0.3 });
        gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 4000, q: 1.5, a: 0.0005, d: 0.008, g: 0.35 });
        return;
      }
      case 'ac':
      case 'kapa': {
        const s = sesAc('panel', 0.3, { kazanc: 0.13, yanki: 0.1 });
        if (!s) return;
        const [a, b] = tur === 'ac' ? [3, 5] : [5, 3];
        ton(s, { f: nota(a), a: 0.002, d: 0.1, g: 1 });
        ton(s, { dalga: 'triangle', f: nota(b), a: 0.002, d: 0.14, g: 1, gec: 0.06 });
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: tur === 'ac' ? 900 : 2200, f2: tur === 'ac' ? 2200 : 900, q: 1.2, a: 0.02, d: 0.12, g: 0.25 });
        return;
      }
      case 'yildiz1':
      case 'yildiz2':
      case 'yildiz3': {
        // Yıldız damgası: 90 Hz güm + çan (G5, C6, E6).
        const i = tur === 'yildiz1' ? 3 : tur === 'yildiz2' ? 5 : 7;
        gum(90, 0.9);
        const s = sesAc('yildizDamga', 1.1, { kazanc: 0.3, yanki: 0.28 });
        if (!s) return;
        can(s, nota(i), 0.01, 1, 0.9);
        ton(s, { f: nota(i) * 2, a: 0.01, d: 0.5, g: 0.12, gec: 0.04, vib: [7, 12] });
        return;
      }
      case 'kazandin': {
        // Arpej C5-E5-G5-C6-E6 (90 ms) + çan akoru.
        const s = sesAc('kazandin', 2, { kazanc: 0.28, yanki: 0.3 });
        if (!s) return;
        arpej(s, KAZANC_ARPEJ, 0.09, 0.7, 0.5);
        [5, 7, 8].forEach((i) => can(s, nota(i), 0.47, 0.5, 1.2));
        return;
      }
      case 'kaybettin': {
        // E5 → C5, iki yumuşak sinüs, her biri 300 ms.
        const s = sesAc('kaybettin', 0.75, { kazanc: 0.15, yanki: 0.22 });
        if (!s) return;
        ton(s, { f: nota(2), a: 0.03, d: 0.3, g: 1 });
        ton(s, { dalga: 'triangle', f: nota(2), a: 0.03, d: 0.3, g: 0.3, lp: 1200 });
        ton(s, { f: nota(0), a: 0.03, d: 0.3, g: 1, gec: 0.3 });
        ton(s, { dalga: 'triangle', f: nota(0), a: 0.03, d: 0.3, g: 0.3, lp: 1200, gec: 0.3 });
        return;
      }
      case 'sandik': {
        const s = sesAc('sandik', 1.3, { kazanc: 0.3, yanki: 0.22 });
        if (!s) return;
        // Menteşe gıcırtısı + kilit tıkı + pırıltı.
        ton(s, { dalga: 'sawtooth', f: 70, f2: 115, a: 0.05, d: 0.32, g: 0.25, lp: 900, vib: [23, 60] });
        gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 2500, q: 2, a: 0.0005, d: 0.02, g: 0.7, gec: 0.36 });
        ton(s, { f: 160, f2: 80, a: 0.002, d: 0.1, g: 0.5, gec: 0.36 });
        arpej(s, [5, 7, 8, 10], 0.06, 0.5, 0.6, 0.42);
        return;
      }
      case 'parca': {
        const s = sesAc('parca', 1.2, { kazanc: 0.28, yanki: 0.3 });
        if (!s) return;
        can(s, nota(7), 0, 0.8, 0.9);
        for (let n = 0; n < 4; n++) ton(s, { f: nota(6 + n) * 2, a: 0.003, d: 0.35, g: 0.14, gec: 0.08 + n * 0.05 });
        return;
      }
      case 'sonHamle': {
        // Kalp atışı: sinüs 50 Hz, iki vuruş 120 ms arayla (900 ms'lik bir döngü).
        const s = sesAc('kalp', 0.4, { kazanc: 0.6 });
        if (!s) return;
        ton(s, { f: 72, f2: 50, kayma: 0.04, a: 0.006, d: 0.12, g: 1 });
        ton(s, { f: 68, f2: 48, kayma: 0.04, a: 0.006, d: 0.12, g: 0.7, gec: 0.12 });
        return;
      }
      case 'hedefTamam':
        hedefTamam();
        return;
      case 'korukDoldu':
        korukDolu();
        return;
      default: {
        const yok: never = tur;
        void yok;
      }
    }
  }

  // ─── Ortam: kalabalık uğultusu + deniz (§12.3) ───────────────────────

  let ortamDugum: { kok: GainNode; kaynaklar: AudioScheduledSourceNode[] } | null = null;

  function ortamBaslat(): void {
    if (!ctx || !yol || ortamDugum) return;
    const c = ctx;
    const t = c.currentTime + PLAN;
    const kok = c.createGain();
    kok.gain.setValueAtTime(0, t);
    kok.gain.linearRampToValueAtTime(1, t + 2.5);
    kok.connect(yol.ortam);
    const kaynaklar: AudioScheduledSourceNode[] = [];
    const kaynak = (renk: GurultuRengi, hiz: number) => {
      const s = c.createBufferSource();
      s.buffer = yol!.gurultu[renk];
      s.loop = true;
      s.playbackRate.value = hiz;
      s.start(t, r01() * 1.8);
      kaynaklar.push(s);
      return s;
    };
    const lfo = (hz: number, derinlik: number, hedef: AudioParam) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      const g = c.createGain();
      g.gain.value = derinlik;
      o.connect(g);
      g.connect(hedef);
      o.start(t);
      kaynaklar.push(o);
    };
    const pan = (v: number, hedef: AudioNode) => {
      if (typeof c.createStereoPanner !== 'function') return hedef;
      const p = c.createStereoPanner();
      p.pan.value = v;
      p.connect(hedef);
      return p;
    };
    // Kalabalık uğultusu: pembe gürültü, bant geçiren 400 Hz Q0,5, kazanç 0,02, LFO 0,1 Hz ±%30.
    // Gürültü tamponu tepe 1'e normalize olduğundan (pembe RMS ≈ 0,2) temel kazanç ×4 düzeltildi.
    const KALABALIK = 0.02 * 4;
    const kal = c.createGain();
    kal.gain.value = KALABALIK;
    lfo(0.1, KALABALIK * 0.3, kal.gain);
    kal.connect(kok);
    [-0.45, 0.45].forEach((p, n) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 400;
      bp.Q.value = 0.5;
      kaynak('pembe', n ? 0.83 : 1).connect(bp);
      bp.connect(pan(p, kal));
    });
    // Mırıltı dokusu: konuşma biçimlendiricisi bandında yavaşça gezinen ikinci katman.
    const mir = c.createBiquadFilter();
    mir.type = 'bandpass';
    mir.frequency.value = 900;
    mir.Q.value = 1.6;
    lfo(0.23, 260, mir.frequency);
    const mirG = c.createGain();
    mirG.gain.value = 0.35;
    lfo(0.37, 0.15, mirG.gain);
    kaynak('pembe', 1.13).connect(mir);
    mir.connect(mirG);
    mirG.connect(kal);
    // Deniz: kahverengi gürültü, alçak geçiren 500 Hz, kazanç LFO'su 0,08 Hz (dalga kabarması).
    // Ölçümle ayarlandı: ortamın toplam RMS'i ≈ −40 dBFS (patlamaların ~20 dB altında).
    const DENIZ = 0.045;
    const den = c.createGain();
    den.gain.value = DENIZ;
    lfo(0.08, DENIZ * 0.55, den.gain);
    lfo(0.031, DENIZ * 0.2, den.gain);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lfo(0.08, 120, lp.frequency);
    [-0.3, 0.3].forEach((p, n) => kaynak('kahve', n ? 0.91 : 1).connect(pan(p, lp)));
    lp.connect(den);
    den.connect(kok);
    ortamDugum = { kok, kaynaklar };
  }

  function ortamDurdur(): void {
    const o = ortamDugum;
    if (!o || !ctx) return;
    ortamDugum = null;
    const t = ctx.currentTime;
    try {
      o.kok.gain.cancelScheduledValues(t);
      o.kok.gain.setValueAtTime(o.kok.gain.value, t);
      o.kok.gain.linearRampToValueAtTime(0, t + 0.6);
      for (const k of o.kaynaklar) k.stop(t + 0.7);
    } catch {
      /* yok */
    }
  }

  // ─── Müzik: üretken pentatonik ped (§12.3) ───────────────────────────

  let muzikDugum: { kok: GainNode; filtre: BiquadFilterNode; ped: GainNode; sira: number; sonraki: number; zamanlayici: ReturnType<typeof setInterval> | null } | null = null;

  function akorCal(m: NonNullable<typeof muzikDugum>, sira: number, t: number): void {
    const c = ctx!;
    const yukselme = 2.2;
    const birakma = 2.6;
    const bit = t + AKOR_SURESI + birakma;
    for (const n of PED_AKORLARI[sira]) {
      const f = midiFrekans(n);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1 / 3, t + yukselme);
      g.gain.setValueAtTime(1 / 3, t + AKOR_SURESI);
      g.gain.linearRampToValueAtTime(0, bit);
      g.connect(m.filtre);
      // İki testere dalga ±6 sent.
      for (const sent of [-6, 6]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = sent;
        o.connect(g);
        o.start(t);
        o.stop(bit + 0.05);
      }
    }
    // Üretken melodi: akor tonlarında seyrek, yumuşak marimba notaları.
    const melodi = AKOR_MELODI[sira];
    const adet = 2 + Math.floor(r01() * 3);
    for (let i = 0; i < adet; i++) {
      const gec = 0.6 + r01() * (AKOR_SURESI - 1.2);
      const f = nota(melodi[Math.floor(r01() * melodi.length)]) / (r01() < 0.5 ? 2 : 1);
      const g = c.createGain();
      g.connect(m.kok);
      zarf(g.gain, t + gec, 0.004, 1.1, 0.05);
      for (const [dalga, k] of [['triangle', 1], ['sine', 0.6]] as const) {
        const o = c.createOscillator();
        o.type = dalga;
        o.frequency.value = f * k * (dalga === 'sine' ? 2 : 1);
        const og = c.createGain();
        og.gain.value = k;
        o.connect(og);
        og.connect(g);
        o.start(t + gec);
        o.stop(t + gec + 1.2);
      }
    }
  }

  function akorPlanla(ufuk: number): void {
    const m = muzikDugum;
    if (!m || !ctx) return;
    while (m.sonraki < ctx.currentTime + ufuk) {
      akorCal(m, m.sira, m.sonraki);
      m.sira = (m.sira + 1) % PED_AKORLARI.length;
      m.sonraki += AKOR_SURESI;
    }
  }

  function muzikBaslat(): void {
    if (!ctx || !yol || muzikDugum) return;
    const c = ctx;
    const t = c.currentTime + PLAN;
    const kok = c.createGain();
    kok.gain.setValueAtTime(0, t);
    kok.gain.linearRampToValueAtTime(1, t + 3);
    kok.connect(yol.kisma);
    const filtre = c.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 900;
    filtre.Q.value = 0.6;
    const ped = c.createGain();
    ped.gain.value = PED_KAZANCI;
    filtre.connect(ped);
    ped.connect(kok);
    muzikDugum = { kok, filtre, ped, sira: 0, sonraki: t, zamanlayici: null };
    if (cevrimdisi) akorPlanla(60);
    else {
      akorPlanla(1.5);
      muzikDugum.zamanlayici = setInterval(() => akorPlanla(1.5), 500);
    }
  }

  function muzikDurdur(): void {
    const m = muzikDugum;
    if (!m || !ctx) return;
    muzikDugum = null;
    if (m.zamanlayici) clearInterval(m.zamanlayici);
    const t = ctx.currentTime;
    try {
      m.kok.gain.cancelScheduledValues(t);
      m.kok.gain.setValueAtTime(m.kok.gain.value, t);
      m.kok.gain.linearRampToValueAtTime(0, t + 1.2);
      // Planlanmış sesler kendi stop zamanlarında biter; kök kapanınca duyulmaz.
      setTimeout(() => {
        try {
          m.kok.disconnect();
        } catch {
          /* yok */
        }
      }, cevrimdisi ? 0 : 1500);
    } catch {
      /* yok */
    }
  }

  // ─── Genel arayüz ────────────────────────────────────────────────────

  const sarmala =
    <A extends unknown[]>(fn: (...a: A) => void) =>
    (...a: A): void => {
      try {
        fn(...a);
      } catch (e) {
        // Ses hatası oyunu durdurmaz.
        secenek.hata?.(e);
      }
    };

  const motor: SesMotoruAyrintili = {
    get baglam() {
      return ctx;
    },
    ac: sarmala(() => {
      kur();
      if (gercek) {
        kilidiAc();
        bekleyenAcilis = false;
        if (gercek.state !== 'running' && !askidaOlmali()) void gercek.resume().catch(() => {});
      }
    }),
    olay: sarmala(olay),
    dugumEklendi: sarmala((k: number) => cit(k)),
    geriAlindi: sarmala((k: number) => {
      if (!calabilir()) return;
      fis(1);
      // Ardından bir alt nota: yeni son düğümün notası.
      const f = nota(notaIndeksi(k));
      const s = sesAc('geriNota', 0.25, { kazanc: 0.16, gec: 0.045 });
      if (!s) return;
      ton(s, { f, a: 0.003, d: 0.09, g: 1 });
      ton(s, { dalga: 'triangle', f, a: 0.003, d: 0.09, g: 0.4 });
    }),
    halkaKapandi: sarmala((k: number) => {
      // İki nota (k, k+2), FM çan.
      const s = sesAc('halka', 1, { kazanc: 0.24, yanki: 0.28 });
      if (!s) return;
      can(s, nota(notaIndeksi(k)), 0, 1, 0.6);
      can(s, nota(notaIndeksi(k + 2)), 0.09, 0.9, 0.7);
      ton(s, { f: nota(notaIndeksi(k + 2)) * 2, a: 0.01, d: 0.4, g: 0.1, gec: 0.12 });
    }),
    ozelEsigi: sarmala((tur: 'roket' | 'kasimpati' | 'yildiz') => {
      // FM çan, taşıyıcı = eşik düğümünün notası (6 / 9 / 12).
      const k = tur === 'roket' ? 6 : tur === 'kasimpati' ? 9 : 12;
      const s = sesAc('ozelEsigi', 0.9, { kazanc: 0.24, yanki: 0.3 });
      if (!s) return;
      can(s, nota(notaIndeksi(k)));
      if (tur === 'yildiz') for (let n = 0; n < 4; n++) ton(s, { f: nota(7 + n) * 2, a: 0.003, d: 0.35, g: 0.12, gec: 0.08 + n * 0.05 });
    }),
    iptal: sarmala(() => {
      if (!calabilir()) return;
      fis(0.8);
      const s = sesAc('iptalNota', 0.2, { kazanc: 0.05 });
      if (s) ton(s, { f: 330, f2: 220, a: 0.005, d: 0.12, g: 1 });
    }),
    tutusma: sarmala(tutusma),
    arayuz: sarmala(arayuz),
    yavasCekim: sarmala((acik: boolean) => {
      yavas = acik;
      if (!yol || !ctx) return;
      const p = yol.alcak.frequency;
      const t = ctx.currentTime;
      p.cancelScheduledValues(t);
      p.setValueAtTime(Math.max(20, p.value), t);
      // Kamera: 80 ms'de iner, 250 ms'de açılır (§12.1).
      p.exponentialRampToValueAtTime(acik ? ALCAK_YAVAS : ALCAK_ACIK, t + (acik ? 0.08 : 0.25));
    }),
    ortam: sarmala((acik: boolean) => {
      ortamIstendi = acik;
      if (acik) ortamBaslat();
      else ortamDurdur();
    }),
    muzik: sarmala((acik: boolean) => {
      muzikIstendi = acik;
      if (acik) muzikBaslat();
      else muzikDurdur();
    }),
    ayarla: sarmala((s: { sfx?: number; muzik?: number; ortam?: boolean; sessiz?: boolean }) => {
      if (s.sfx !== undefined) ayar.sfx = sinirla(s.sfx, 0, 1);
      if (s.muzik !== undefined) ayar.muzik = sinirla(s.muzik, 0, 1);
      if (s.sessiz !== undefined) ayar.sessiz = s.sessiz;
      if (s.ortam !== undefined) motor.ortam(s.ortam);
      if (!yol || !ctx) return;
      const t = ctx.currentTime;
      yol.sfx.gain.setTargetAtTime(SFX_KAZANCI * ayar.sfx, t, 0.03);
      yol.muzik.gain.setTargetAtTime(MUZIK_KAZANCI * ayar.muzik, t, 0.03);
      yol.cikis.gain.setTargetAtTime(ayar.sessiz ? 0 : 1, t, 0.02);
      if (ayar.sessiz) havuz.bosalt(t);
    }),
    askiya: sarmala((g: boolean) => {
      disAskida = g;
      durumUygula();
    }),
    tahtaBoyutu: sarmala((w: number, h: number) => {
      if (w > 0 && h > 0) tahta = { w, h };
    }),
    etkinSes() {
      if (ctx) havuz.temizle(ctx.currentTime);
      return havuz.sayi;
    },
    cozumleyici() {
      if (!ctx || !yol) return null;
      if (!analiz) {
        analiz = ctx.createAnalyser();
        analiz.fftSize = 2048;
        analiz.smoothingTimeConstant = 0.6;
        yol.kirpici.connect(analiz);
      }
      return analiz;
    },
  };
  return motor;
}
