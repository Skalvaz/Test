/**
 * EBRULİ ses motoru (P5, GDD §10.2–§10.4) — tamamen WebAudio sentezi, ses
 * dosyası yok. Yapı FİTİL'in ses motorundan (yollar, kompresör, yankı, ses
 * havuzu, iOS kilidi) uyarlandı; sesler ebruya özgü: su damlası, boyanın
 * süzülmesi, ud koparması (Karplus–Strong), hicaz merdiveni, ney nefesi.
 *
 * Yönlendirme (§10.3):
 *
 *   sesler ─▶ sfx (0,8) ──┬──────────────────────────────▶ ana
 *                         └▶ yankı (0,18) ─▶ Convolver ─▶ ┘   (1,6 sn, exp(−t/0,4))
 *   müzik ─▶ kısma ─▶ müzik (0,3) ─┬─────────────────────▶ ana
 *                                  └▶ yankı ─────────────┘
 *   su + atölye ─▶ ortam (0,25) ─────────────────────────▶ ana
 *
 *   ana ─▶ alçak geçiren 18 kHz ─▶ DynamicsCompressor (−18 dB, diz 12, oran 4,
 *         3 ms, 150 ms) ─▶ çıkış (sessiz) ─▶ yumuşak kırpıcı ─▶ hoparlör
 *
 * Telefon: `ac()` ilk dokunuşta bağlamı kurar ve `resume()` eder, iOS için
 * tek örnekli sessiz tampon çalar; iOS 17+ `audioSession.type = 'ambient'`.
 * Sekme gizlenince `suspend()`. Bağlam çalışmıyorsa ses planlanmaz. Ağır
 * tamponlar (gürültü, yankı, ud) dokunuş olayında değil, ardından boşta
 * dilimlerle üretilir (ilk dokunuşta donma yok); hazır olmadan çalınan ud
 * üçgen + üstel sönüm yedeğine düşer.
 *
 * Bilinçli sessizlikler: `eslesti` (toplanma; ses `temizlendi`de), `puanEklendi`,
 * `hamleOzeti`, `donustu` dışı durum olayları, `bolumBitti{kayip}` (arayüz
 * `arayuz('kaybettin')` ile çalar).
 */
import type { Konum, Olay } from '../core/types';
import type { ArayuzSesi, SesMotoru } from '../app/sozlesme';
import { SesHavuzu, type HavuzSesi } from './havuz';
import { gurultuUret, rastgeleUretici, type GurultuRengi } from './gurultu';
import { HICAZ, PENTATONIK, UD_NOTALARI, enYakinUd, kaskatBasamagi, kaskatParilti, renkNotasi } from './nota';
import { udTeli } from './ud';

// ─── Sabitler (§10.3) ─────────────────────────────────────────────────────
const SFX_KAZANCI = 0.8;
const MUZIK_KAZANCI = 0.3;
const ORTAM_KAZANCI = 0.25;
const YANKI_ISLAK = 0.18;
const YANKI_SURE = 1.6;
const YANKI_SONUM = 0.4;
const PLAN = 0.012;
const GURULTU_SURESI = 2;
const UD_SURE = 1.2;
/** Müzik kısma (büyük olaylarda 0,02 → 0,01; 600 ms'de döner). */
const KISMA_ORANI = 0.5;
const KISMA_DONUS = 0.6;

export interface SesMotoruSecenek {
  /** Hazır bağlam (ölçüm/test: OfflineAudioContext ya da sahte bağlam). */
  baglam?: BaseAudioContext;
  /** Gürültü ve rastgele ayrıntılar için tohum. */
  tohum?: number;
  /** Yutulan ses hataları (oyunu durdurmaz). */
  hata?: (e: unknown) => void;
}

export interface SesMotoruAyrintili extends SesMotoru {
  readonly baglam: BaseAudioContext | null;
  /** Havuzdaki etkin ses sayısı. */
  etkinSes(): number;
  /** Dev: çıkış çözümleyicisi. */
  cozumleyici(): AnalyserNode | null;
  /** Ud tamponları hazır mı. */
  udHazir(): boolean;
  /** Ud tamponlarını hemen üret (ölçüm/test). */
  udPisir(): void;
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
  f2?: number;
  kayma?: number;
  a?: number;
  d: number;
  g: number;
  gec?: number;
  sent?: number;
  vib?: [number, number];
  vibGec?: number;
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
  yanki?: number;
  birlestir?: number;
  gec?: number;
}

interface Yollar {
  sfx: GainNode;
  muzik: GainNode;
  kisma: GainNode;
  ortam: GainNode;
  yankiGiris: GainNode;
  ana: GainNode;
  komp: DynamicsCompressorNode;
  cikis: GainNode;
  analiz: AnalyserNode | null;
  gurultu: Partial<Record<GurultuRengi, AudioBuffer>>;
  ud: (AudioBuffer | null)[];
}

type AcSinifi = new (o?: AudioContextOptions) => AudioContext;

function acSinifi(): AcSinifi | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AcSinifi; webkitAudioContext?: AcSinifi };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const sinirla = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** |x| ≤ 0,8 doğrusal; üstü tanh ile 0,99'a yumuşak yaklaşır: çıkış hiçbir koşulda 1'i aşmaz. */
export function kirpiciEgrisi(): Float32Array<ArrayBuffer> {
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

export function sesMotoruOlustur(secenek: SesMotoruSecenek = {}): SesMotoruAyrintili {
  const cevrimdisi = !!secenek.baglam;
  let ctx: BaseAudioContext | null = secenek.baglam ?? null;
  let gercek: AudioContext | null = null;
  let yol: Yollar | null = null;
  let kurulamadi = false;
  let kilitAcildi = false;
  const rnd = rastgeleUretici(secenek.tohum ?? 0xeb2);
  const r01 = () => (rnd() + 1) / 2;
  const ayar = { sfx: 1, muzik: 1, ortam: true, sessiz: false };
  let ortamIstendi = false;
  let atolye: 'uskudar' | 'bursa' = 'uskudar';
  let muzikIstendi = false;
  let disAskida = false;
  let tahta = { w: 7, h: 9 };
  const sonCalinma = new Map<string, number>();
  let ortamDugum: { kok: GainNode; kaynaklar: AudioScheduledSourceNode[]; zaman: ReturnType<typeof setTimeout> | null } | null = null;
  let muzikDugum: { kok: GainNode; kaynaklar: AudioScheduledSourceNode[]; zaman: ReturnType<typeof setTimeout> | null } | null = null;
  const hata = (e: unknown) => secenek.hata?.(e);

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
      yolKur(ctx, !!gercek);
      if (gercek) {
        gercek.addEventListener?.('statechange', () => {
          if (gercek && gercek.state !== 'running' && !askidaOlmali()) bekleyenAcilis = true;
        });
        for (const ad of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(ad, kesintidenDon, { capture: true, passive: true });
        document.addEventListener('visibilitychange', durumUygula);
      }
      if (ortamIstendi) ortamBaslat();
      if (muzikIstendi) muzikBaslat();
    } catch (e) {
      hata(e);
      kurulamadi = !yol;
    }
  }

  function yolKur(c: BaseAudioContext, ertele: boolean): void {
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
    const TOHUM: Record<GurultuRengi, number> = { beyaz: 11, pembe: 23, kahve: 37 };
    const gurultu: Partial<Record<GurultuRengi, AudioBuffer>> = {};

    const ana = kazanc(1);
    const alcak = c.createBiquadFilter();
    alcak.type = 'lowpass';
    alcak.frequency.value = 18000;
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
    let analiz: AnalyserNode | null = null;
    if (!cevrimdisi && typeof (c as AudioContext).createAnalyser === 'function') {
      analiz = (c as AudioContext).createAnalyser();
      analiz.fftSize = 1024;
      kirpici.connect(analiz);
    }

    // Yankı: 1,6 sn stereo gürültü, exp(−t/0,4); dönüşte yumuşak süzgeç.
    const conv = c.createConvolver();
    const irN = Math.floor(oran * YANKI_SURE);
    const ir = c.createBuffer(2, irN, oran);
    const yankiKanal = (k: 0 | 1) => {
      const d = ir.getChannelData(k);
      const r = rastgeleUretici(k === 0 ? 101 : 202);
      const giris = Math.max(1, Math.floor(oran * 0.002));
      for (let i = 0; i < irN; i++) d[i] = r() * Math.exp(-i / oran / YANKI_SONUM) * Math.min(1, i / giris);
    };
    const yankiGiris = kazanc(1);
    const donusAlcak = c.createBiquadFilter();
    donusAlcak.type = 'lowpass';
    donusAlcak.frequency.value = 5200;
    const donusYuksek = c.createBiquadFilter();
    donusYuksek.type = 'highpass';
    donusYuksek.frequency.value = 160;
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
    const muzikYanki = kazanc(YANKI_ISLAK * 1.8);
    muzik.connect(muzikYanki);
    muzikYanki.connect(yankiGiris);
    const ortam = kazanc(ayar.ortam ? ORTAM_KAZANCI : 0);
    ortam.connect(ana);

    yol = { sfx, muzik, kisma, ortam, yankiGiris, ana, komp, cikis, analiz, gurultu, ud: UD_NOTALARI.map(() => null) };
    const adimlar: (() => void)[] = [
      () => (gurultu.pembe = tampon('pembe', TOHUM.pembe)),
      () => (gurultu.beyaz = tampon('beyaz', TOHUM.beyaz)),
      () => (gurultu.kahve = tampon('kahve', TOHUM.kahve)),
      () => yankiKanal(0),
      () => {
        yankiKanal(1);
        conv.buffer = ir;
      },
      ...UD_NOTALARI.map((_, i) => () => udUret(i)),
    ];
    if (!ertele) {
      for (const a of adimlar) a();
      return;
    }
    // Gerçek bağlamda: her tampon ayrı görevde (telefonda birkaç ms), ilk kareden sonra.
    let i = 0;
    const sira = (fn: () => void, ms: number) => {
      const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === 'function') setTimeout(() => w.requestIdleCallback!(fn, { timeout: 300 }), ms);
      else setTimeout(fn, ms);
    };
    const sonraki = () => {
      try {
        adimlar[i++]();
        if (i < adimlar.length) adimlar[i++]();
      } catch (e) {
        hata(e);
      }
      if (i === 5 || i === 6) {
        if (ortamIstendi) ortamBaslat();
        if (muzikIstendi) muzikBaslat();
      }
      if (i < adimlar.length) sira(sonraki, 20);
      else {
        if (ortamIstendi) ortamBaslat();
        if (muzikIstendi) muzikBaslat();
      }
    };
    sira(sonraki, 350);
  }

  function udUret(i: number): void {
    if (!yol || !ctx) return;
    const oran = ctx.sampleRate;
    const veri = udTeli(UD_NOTALARI[i], oran, { sure: UD_SURE, tohum: 3 + i, parlaklik: 0.55 });
    const b = ctx.createBuffer(1, veri.length, oran);
    b.getChannelData(0).set(veri);
    yol.ud[i] = b;
  }

  const gurultuHazir = () => !!(yol && yol.gurultu.beyaz && yol.gurultu.pembe && yol.gurultu.kahve);

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
      } else if (g.state !== 'running' && kilitAcildi) void g.resume().catch(() => {});
    } catch {
      /* kapanmış */
    }
  }

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
      /* kapandı */
    }
  }

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
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(0, t0 + (r.vibGec ?? 0));
      lg.gain.linearRampToValueAtTime(r.vib[1], t0 + (r.vibGec ?? 0) + 0.15);
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
    const tamponu = yol!.gurultu[r.renk];
    if (!tamponu) return;
    const src = c.createBufferSource();
    src.buffer = tamponu;
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
    src.start(t0, r01() * (GURULTU_SURESI - 0.3));
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

  /** Ud koparması: hazır tampondan (oranla perde), değilse üçgen + üstel sönüm yedeği. */
  function ud(s: Ses, f: number, g: number, gec = 0, sure = 1.1): void {
    const c = ctx!;
    const t0 = s.bas + gec;
    const { i, oran } = enYakinUd(f);
    const b = yol!.ud[i];
    if (!b) {
      ton(s, { dalga: 'triangle', f, a: 0.002, d: Math.min(0.6, sure * 0.6), g: g * 0.55, gec, lp: 2600 });
      ton(s, { f: f * 2, a: 0.001, d: 0.12, g: g * 0.12, gec });
      return;
    }
    const src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = oran;
    const gg = c.createGain();
    gg.gain.setValueAtTime(g, t0);
    gg.gain.setValueAtTime(g, t0 + Math.max(0.01, sure - 0.05));
    gg.gain.linearRampToValueAtTime(0, t0 + sure);
    src.connect(gg);
    gg.connect(s.veri.giris);
    src.start(t0);
    src.stop(t0 + sure + 0.01);
    s.veri.kaynaklar.push(src);
  }

  function can(s: Ses, f: number, gec = 0, g = 1, d = 0.5): void {
    fm(s, { f, oran: 3.5, i1: 2, i2: 0, a: 0.003, d, g, gec });
    ton(s, { f: f / 2, a: 0.006, d: d * 0.8, g: g * 0.25, gec });
  }

  /** Su damlası "plip": sinüs, perde düşen (×0,6), 40 ms. */
  function plip(s: Ses, f: number, g: number, gec = 0): void {
    ton(s, { f, f2: f * 0.6, kayma: 0.04, a: 0.001, d: 0.045, g, gec });
    ton(s, { f: f * 1.5, f2: f * 0.9, kayma: 0.03, a: 0.001, d: 0.02, g: g * 0.3, gec: gec + 0.004 });
  }

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

  function panX(h: Konum | undefined | null): number {
    if (!h) return 0;
    return sinirla(((h.x + 0.5) / tahta.w - 0.5) * 1.1, -0.55, 0.55);
  }

  // ─── Ses tarifleri (§10.2) ────────────────────────────────────────────

  function tutuldu(): void {
    if (yakindaCalindi('tut', 0.04)) return;
    const s = sesAc('tut', 0.08, { kazanc: 1 });
    if (!s) return;
    ton(s, { f: 1600, a: 0.001, d: 0.012, g: 0.08 });
    ton(s, { f: 820, f2: 640, a: 0.001, d: 0.03, g: 0.04 });
  }

  function hedefeGirdi(sonuc: number | null): void {
    if (yakindaCalindi('hedef', 0.06)) return;
    const s = sesAc('hedef', 0.25, { kazanc: 1, yanki: 0.08 });
    if (!s) return;
    const f = sonuc ? renkNotasi(sonuc) : 880;
    ton(s, { f, a: 0.004, d: 0.04, g: 0.06 });
    ton(s, { f: f * 2, a: 0.004, d: 0.08, g: 0.02 });
    plip(s, 2000, 0.02, 0.01);
  }

  function gecersiz(): void {
    if (yakindaCalindi('gecersiz', 0.08)) return;
    const s = sesAc('gecersiz', 0.12, { kazanc: 1 });
    if (!s) return;
    ton(s, { dalga: 'triangle', f: 180, a: 0.002, d: 0.05, g: 0.22, lp: 600 });
    ton(s, { dalga: 'triangle', f: 150, a: 0.002, d: 0.04, g: 0.12, lp: 600, gec: 0.055 });
  }

  /** Karışım: bant geçiren gürültü süpürmesi 400→1600 Hz + iki sinüs a ve b notasından sonuca kayar. */
  function karisim(a: number, b: number, sonuc: number, pan: number): void {
    const s = sesAc('karisim', 0.5, { pan, kazanc: 1, yanki: 0.12 });
    if (!s) return;
    const fs = renkNotasi(sonuc);
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 400, f2: 1600, q: 1.6, a: 0.04, d: 0.16, g: 0.16 });
    ton(s, { f: renkNotasi(a), f2: fs, kayma: 0.18, a: 0.02, d: 0.22, g: 0.07 });
    ton(s, { f: renkNotasi(b), f2: fs, kayma: 0.18, a: 0.02, d: 0.22, g: 0.07 });
    // Boyanın suya değdiği an: yumuşak "blop".
    ton(s, { f: 520, f2: 260, kayma: 0.06, a: 0.002, d: 0.08, g: 0.12 });
    if (sonuc === 7) ton(s, { f: 110, f2: 80, kayma: 0.16, a: 0.004, d: 0.16, g: 0.2, gec: 0.18 });
  }

  /** Temizlendi: ud koparması, rengin notası; 15 ms içinde gelenler birleşir. */
  function koparma(renk: number, pan: number, ozelden: boolean): void {
    const tur = `ud:${renk}`;
    const s = sesAc(tur, 1.15, { pan, kazanc: ozelden ? 0.2 : 0.28, yanki: 0.12, birlestir: 0.015 });
    if (!s) return;
    const f = renkNotasi(renk);
    ud(s, f, 1, 0, 1.1);
    if (!ozelden) plip(s, 1700 + r01() * 600, 0.05, 0.005);
  }

  function kaskat(k: number): void {
    kis();
    const s = sesAc('kaskat', 1.4, { kazanc: 0.32, yanki: 0.25 });
    if (!s) return;
    const f = HICAZ[kaskatBasamagi(k)];
    ud(s, f, 0.9, 0, 1.2);
    ud(s, f * 2, 0.35, 0.01, 0.9);
    can(s, f * 2, 0.02, 0.18, 0.8);
    if (kaskatParilti(k)) ton(s, { f: f * 4, a: 0.01, d: 0.5, g: 0.04, vib: [6, 10] });
  }

  function ozelOlustu(renk: number, pan: number): void {
    const s = sesAc('ozel', 0.7, { pan, kazanc: 0.28, yanki: 0.25 });
    if (!s) return;
    can(s, renkNotasi(renk || 2) * 2, 0, 1, 0.5);
  }

  function tarak(pan: number): void {
    kis();
    const s = sesAc('tarak', 0.6, { pan, kazanc: 1, yanki: 0.18 });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 2000, f2: 5000, q: 1.4, a: 0.02, d: 0.28, g: 0.14 });
    // "Şıngır": 6 tel, 25 ms arayla (D majör/pentatonik).
    const teller = [587.33, 739.99, 880, 987.77, 1174.66, 1479.98];
    teller.forEach((f, i) => ud(s, f, 0.18, i * 0.025, 0.5));
  }

  function girdap(pan: number): void {
    kis();
    const s = sesAc('girdap', 0.7, { pan, kazanc: 1, yanki: 0.15 });
    if (!s) return;
    gur(s, { renk: 'pembe', filtre: 'lowpass', f: 3000, f2: 300, q: 2.2, a: 0.03, d: 0.37, g: 0.3 });
    ton(s, { f: 140, f2: 70, kayma: 0.08, a: 0.004, d: 0.22, g: 0.45 });
  }

  function lale(): void {
    kis();
    const s = sesAc('lale', 1.2, { kazanc: 0.12, yanki: 0.35 });
    if (!s) return;
    // D akor tonları, 6 sinüs ±7 sent, 30 ms aralı, 900 ms.
    const tonlar = [587.33, 739.99, 880, 1174.66, 1479.98, 1760];
    tonlar.forEach((f, i) => ton(s, { f, a: 0.01, d: 0.9 - i * 0.05, g: 0.6, gec: i * 0.03, sent: i % 2 ? 7 : -7 }));
  }

  function murekkep(pan: number): void {
    kis();
    const s = sesAc('murekkep', 0.5, { pan, kazanc: 1, yanki: 0.1, birlestir: 0.03 });
    if (!s) return;
    ton(s, { f: 110, f2: 55, kayma: 0.05, a: 0.004, d: 0.22, g: 0.55 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 500, a: 0.005, d: 0.3, g: 0.4 });
  }

  function birlesim(): void {
    kis();
    const s = sesAc('birlesim', 1.1, { kazanc: 1, yanki: 0.3 });
    if (!s) return;
    ton(s, { f: 90, f2: 45, kayma: 0.06, a: 0.005, d: 0.4, g: 0.55 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 800, a: 0.01, d: 0.6, g: 0.45 });
    can(s, 587.33, 0.05, 0.22, 0.9);
    can(s, 880, 0.08, 0.14, 0.9);
  }

  function mermer(pan: number, kirildi: boolean): void {
    const s = sesAc('mermer', 0.25, { pan, kazanc: 1, birlestir: 0.02 });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'lowpass', f: 900, a: 0.001, d: 0.06, g: 0.35 });
    ton(s, { f: 160, a: 0.001, d: 0.05, g: 0.3 });
    if (kirildi) gur(s, { renk: 'beyaz', filtre: 'highpass', f: 2500, a: 0.001, d: 0.12, g: 0.12, gec: 0.03 });
  }

  function kagit(pan: number): void {
    const s = sesAc('kagit', 0.2, { pan, kazanc: 1, birlestir: 0.02 });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'highpass', f: 3000, a: 0.01, d: 0.11, g: 0.12 });
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 1800, q: 0.8, a: 0.005, d: 0.06, g: 0.06, gec: 0.03 });
  }

  function yag(pan: number): void {
    const s = sesAc('yag', 0.16, { pan, kazanc: 1, birlestir: 0.02 });
    if (!s) return;
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 1200, q: 1.2, a: 0.008, d: 0.09, g: 0.3 });
  }

  function desen(renk: number, pan: number): void {
    const s = sesAc('desen', 0.35, { pan, kazanc: 0.3, yanki: 0.15, birlestir: 0.02 });
    if (!s) return;
    const f = renkNotasi(renk) * 2;
    ton(s, { dalga: 'triangle', f, a: 0.001, d: 0.25, g: 0.8 });
    ton(s, { f: f * 4, a: 0.001, d: 0.04, g: 0.15 });
  }

  function dusme(n: number): void {
    if (n <= 0) return;
    const s = sesAc('dusme', 0.12, { kazanc: Math.min(1, 0.4 + n * 0.03), birlestir: 0.04 });
    if (!s) return;
    ton(s, { f: 340, f2: 190, kayma: 0.04, a: 0.002, d: 0.05, g: 0.05 });
  }

  function karistirma(): void {
    const s = sesAc('karistirma', 0.8, { kazanc: 1, yanki: 0.2 });
    if (!s) return;
    gur(s, { renk: 'pembe', filtre: 'bandpass', f: 300, f2: 1400, q: 2, a: 0.2, d: 0.45, g: 0.25 });
    gur(s, { renk: 'kahve', filtre: 'lowpass', f: 400, a: 0.1, d: 0.5, g: 0.2 });
  }

  function hedefIlerledi(tamam: boolean): void {
    if (tamam) {
      if (yakindaCalindi('hedefTamam', 0.2)) return;
      const s = sesAc('hedefTamam', 1.2, { kazanc: 0.2, yanki: 0.3 });
      if (!s) return;
      [293.66, 369.99, 440].forEach((f, i) => can(s, f * 2, i * 0.025, 0.8, 0.9));
      return;
    }
    const s = sesAc('kart', 0.08, { kazanc: 1, birlestir: 0.03 });
    if (!s) return;
    ton(s, { f: 2400, a: 0.001, d: 0.015, g: 0.04 });
  }

  function solen(): void {
    kis();
    const s = sesAc('solen', 2.2, { kazanc: 0.3, yanki: 0.3 });
    if (!s) return;
    // Hızlanan ud arpeji (pentatonik, yukarı).
    let t = 0;
    let ara = 0.16;
    for (let i = 0; i < 10; i++) {
      ud(s, PENTATONIK[i] * 2, 0.6, t, 0.8);
      t += ara;
      ara *= 0.86;
    }
  }

  /** Ney motifi (§10.3): A4→D5 portamento, sinüs + %30 üçgen, nefes gürültüsü, vibrato 300 ms'den sonra. */
  function ney(gec = 0, kazanc = 0.22): void {
    kis();
    const s = sesAc('ney', 2.3, { kazanc, yanki: 0.3, gec });
    if (!s) return;
    const d = 1.6 - 0.18;
    ton(s, { f: 440, f2: 587.33, kayma: 0.12, a: 0.18, d, g: 0.7, vib: [5, 15], vibGec: 0.3 });
    ton(s, { dalga: 'triangle', f: 440, f2: 587.33, kayma: 0.12, a: 0.18, d, g: 0.21, vib: [5, 15], vibGec: 0.3 });
    // Hicaz süsü: kısa E♭–F♯ geçişi (yalnız burada ve kaskat merdiveninde).
    ton(s, { f: 311.13 * 2, f2: 369.99 * 2, kayma: 0.08, a: 0.04, d: 0.25, g: 0.12, gec: 0.9 });
    gur(s, { renk: 'beyaz', filtre: 'bandpass', f: 1200, q: 0.8, a: 0.18, d, g: 0.25 * 0.7 });
  }

  function arayuz(tur: ArayuzSesi): void {
    switch (tur) {
      case 'dugme': {
        const s = sesAc('dugme', 0.1, { kazanc: 1 });
        if (!s) return;
        ton(s, { f: 900, f2: 700, a: 0.001, d: 0.03, g: 0.08 });
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 2200, q: 2, a: 0.001, d: 0.02, g: 0.05 });
        return;
      }
      case 'ac': {
        const s = sesAc('ac', 0.6, { kazanc: 1, yanki: 0.2 });
        if (!s) return;
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 600, f2: 2400, q: 0.9, a: 0.05, d: 0.25, g: 0.1 });
        can(s, 880, 0.12, 0.08, 0.4);
        return;
      }
      case 'kapa': {
        const s = sesAc('kapa', 0.4, { kazanc: 1 });
        if (!s) return;
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 2200, f2: 600, q: 0.9, a: 0.02, d: 0.2, g: 0.08 });
        return;
      }
      case 'yildiz1':
      case 'yildiz2':
      case 'yildiz3': {
        const n = Number(tur.slice(-1));
        const s = sesAc('yildiz', 1.2, { kazanc: 0.3, yanki: 0.3 });
        if (!s) return;
        ton(s, { f: 90, f2: 60, kayma: 0.1, a: 0.003, d: 0.3, g: 0.8 });
        can(s, [587.33, 739.99, 880][n - 1], 0.02, 0.5, 0.9);
        return;
      }
      case 'kazandin':
        ney(0, 0.22);
        return;
      case 'kaybettin': {
        const s = sesAc('kaybettin', 0.9, { kazanc: 0.16, yanki: 0.25 });
        if (!s) return;
        ton(s, { f: 440, a: 0.03, d: 0.3, g: 0.8 });
        ton(s, { f: 369.99, a: 0.03, d: 0.4, g: 0.8, gec: 0.3 });
        return;
      }
      case 'sonHamle': {
        const s = sesAc('sonHamle', 0.6, { kazanc: 0.25, yanki: 0.1 });
        if (!s) return;
        ud(s, 146.83, 0.8, 0, 0.5);
        ud(s, 146.83, 0.6, 0.18, 0.5);
        return;
      }
      case 'hedefTamam':
        hedefIlerledi(true);
        return;
      case 'kagitCek': {
        const s = sesAc('kagitCek', 2, { kazanc: 1, yanki: 0.25 });
        if (!s) return;
        // Kâğıt suya serilir (yumuşak hışırtı + su), sonra kalkar (yükselen süpürme + damlalar).
        gur(s, { renk: 'pembe', filtre: 'bandpass', f: 900, q: 0.7, a: 0.15, d: 0.45, g: 0.1 });
        gur(s, { renk: 'beyaz', filtre: 'highpass', f: 2600, f2: 4200, a: 0.3, d: 0.9, g: 0.05, gec: 0.9 });
        for (let i = 0; i < 4; i++) plip(s, 1700 + i * 260, 0.035, 1.1 + i * 0.18 + r01() * 0.05);
        return;
      }
    }
  }

  function olay(o: Olay): void {
    if (!calabilir()) return;
    try {
      switch (o.tur) {
        case 'karisti':
          karisim(o.a, o.b, o.sonuc, panX(o.hedef));
          return;
        case 'ozelSuruklendi': {
          const s = sesAc('kayma', 0.2, { pan: panX(o.hedef), kazanc: 1 });
          if (s) gur(s, { renk: 'pembe', filtre: 'bandpass', f: 800, f2: 1800, q: 1.2, a: 0.02, d: 0.1, g: 0.18 });
          return;
        }
        case 'temizlendi':
          koparma(o.renk, panX(o.hucre), o.neden !== 'grup');
          return;
        case 'ozelOlustu':
          ozelOlustu(o.damla.renk, panX(o.hucre));
          return;
        case 'ozelTetiklendi':
          if (o.ozel === 'tarak') tarak(panX(o.hucre));
          else if (o.ozel === 'girdap') girdap(panX(o.hucre));
          else if (o.ozel === 'lale') lale();
          else if (o.ozel === 'murekkep') murekkep(panX(o.hucre));
          return;
        case 'birlesim':
          birlesim();
          return;
        case 'donustu': {
          const s = sesAc('donustu', 0.4, { kazanc: 0.12, yanki: 0.2, birlestir: 0.05 });
          if (s) can(s, 1174.66, 0, 0.5, 0.3);
          return;
        }
        case 'mermerHasar':
          mermer(panX(o.hucre), o.kalan === 0);
          return;
        case 'kagitAlindi':
          kagit(panX(o.hucre));
          return;
        case 'yagKalkti':
          yag(panX(o.hucre));
          return;
        case 'desenBoyandi':
          desen(o.renk, panX(o.hucre));
          return;
        case 'kaskat':
          if (o.k >= 2) kaskat(o.k);
          return;
        case 'yercekimi':
          dusme(o.dusenler.length + o.doganlar.length);
          return;
        case 'karistirma':
          karistirma();
          return;
        case 'hedefIlerledi':
          hedefIlerledi(o.tamam);
          return;
        case 'solenBasladi':
          solen();
          return;
        case 'bolumBitti':
          if (o.sonuc === 'kazanc') {
            const s = sesAc('bitti', 1.4, { kazanc: 0.2, yanki: 0.3 });
            if (s) [146.83, 220, 293.66, 369.99, 440].forEach((f, i) => ud(s, f, 0.7, i * 0.05, 1.2));
          }
          return;
        default:
          return;
      }
    } catch (e) {
      hata(e);
    }
  }

  // ─── Ortam ve müzik (§10.4) ─────────────────────────────────────────────

  function ortamBaslat(): void {
    if (!ctx || !yol || ortamDugum || !gurultuHazir()) return;
    const c = ctx;
    const t = c.currentTime + PLAN;
    const kok = c.createGain();
    kok.gain.setValueAtTime(0, t);
    kok.gain.linearRampToValueAtTime(1, t + 2);
    kok.connect(yol.ortam);
    const kaynaklar: AudioScheduledSourceNode[] = [];
    const kaynak = (renk: GurultuRengi, hiz: number) => {
      const s = c.createBufferSource();
      s.buffer = yol!.gurultu[renk]!;
      s.loop = true;
      s.playbackRate.value = hiz;
      s.start(t, r01() * 1.6);
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
    // Su: kahverengi gürültü, alçak geçiren 400 Hz, kazanç 0,03 (tampon tepesi 1'e normalize: ×3), LFO 0,1 Hz ±%30.
    const SU = 0.03 * 3;
    const su = c.createGain();
    su.gain.value = SU;
    lfo(0.1, SU * 0.3, su.gain);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    kaynak('kahve', 1).connect(lp);
    lp.connect(su);
    su.connect(kok);
    if (atolye === 'uskudar') {
      // Liman: çok uzak, alçak dalga şırıltısı (pembe gürültü bant 300 Hz, LFO 0,07 Hz).
      const L = 0.05;
      const lg = c.createGain();
      lg.gain.value = L;
      lfo(0.07, L * 0.6, lg.gain);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 300;
      bp.Q.value = 0.7;
      kaynak('pembe', 0.9).connect(bp);
      bp.connect(lg);
      lg.connect(kok);
    } else {
      // Han: şadırvan şırıltısı (beyaz gürültü bant 2,5 kHz Q3, hızlı kazanç titreşimi 8–14 Hz).
      const S = 0.015 * 3;
      const sg = c.createGain();
      sg.gain.value = S;
      lfo(8.7, S * 0.35, sg.gain);
      lfo(13.1, S * 0.25, sg.gain);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      bp.Q.value = 3;
      kaynak('beyaz', 1).connect(bp);
      bp.connect(sg);
      sg.connect(kok);
    }
    ortamDugum = { kok, kaynaklar, zaman: null };
    // 2–6 sn aralı tek damla "plip"i (gerçek bağlamda zamanlayıcıyla).
    const damlat = () => {
      if (!ortamDugum) return;
      if (calabilir()) {
        const s = sesAc('plip', 0.08, { kazanc: 1, pan: (r01() - 0.5) * 0.8, yanki: 0.3 });
        if (s) {
          // Ortam yolundan değil sfx'ten: çok kısık.
          plip(s, 1600 + r01() * 800, 0.04);
        }
      }
      if (!cevrimdisi) ortamDugum.zaman = setTimeout(damlat, 2000 + r01() * 4000);
    };
    if (!cevrimdisi) ortamDugum.zaman = setTimeout(damlat, 1500 + r01() * 2000);
    else damlat();
  }

  function ortamDurdur(): void {
    const o = ortamDugum;
    if (!o || !ctx) return;
    ortamDugum = null;
    if (o.zaman) clearTimeout(o.zaman);
    const t = ctx.currentTime;
    try {
      o.kok.gain.cancelScheduledValues(t);
      o.kok.gain.setValueAtTime(o.kok.gain.value, t);
      o.kok.gain.linearRampToValueAtTime(0, t + 0.8);
      for (const k of o.kaynaklar) k.stop(t + 0.85);
    } catch {
      /* yok */
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
    const kaynaklar: AudioScheduledSourceNode[] = [];
    // D dronu: sinüs D2 + D3, 0,02 (müzik yolu 0,3 ile çarpılır → ×3).
    for (const [f, g] of [
      [73.42, 0.06],
      [146.83, 0.04],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const gg = c.createGain();
      gg.gain.value = g;
      o.connect(gg);
      gg.connect(kok);
      o.start(t);
      kaynaklar.push(o);
    }
    muzikDugum = { kok, kaynaklar, zaman: null };
    const cumle = () => {
      if (!muzikDugum) return;
      if (calabilir() && yol) {
        // 3–5 notalık pentatonik cümle, ud koparmalarıyla; müzik yoluna.
        const n = 3 + Math.floor(r01() * 3);
        let i = 2 + Math.floor(r01() * 4);
        const s0 = simdi();
        for (let k = 0; k < n; k++) {
          const f = PENTATONIK[Math.max(0, Math.min(PENTATONIK.length - 1, i))];
          const tt = s0 + k * (0.32 + r01() * 0.18);
          udMuzik(f, 0.32, tt, kok);
          i += Math.floor(r01() * 3) - 1;
        }
      }
      if (!cevrimdisi) muzikDugum.zaman = setTimeout(cumle, 6000 + r01() * 4000);
    };
    if (!cevrimdisi) muzikDugum.zaman = setTimeout(cumle, 2500);
    else cumle();
  }

  /** Müzik yoluna ud koparması (havuz dışı; müzik yolu ayrı ve az sayıda). */
  function udMuzik(f: number, g: number, t0: number, hedef: AudioNode): void {
    const c = ctx!;
    const { i, oran } = enYakinUd(f);
    const b = yol!.ud[i];
    const gg = c.createGain();
    gg.connect(hedef);
    if (b) {
      const src = c.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = oran;
      gg.gain.setValueAtTime(g, t0);
      src.connect(gg);
      src.start(t0);
      src.stop(t0 + UD_SURE);
    } else {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      zarf(gg.gain, t0, 0.003, 0.7, g * 0.5);
      o.connect(gg);
      o.start(t0);
      o.stop(t0 + 0.75);
    }
  }

  function muzikDurdur(): void {
    const m = muzikDugum;
    if (!m || !ctx) return;
    muzikDugum = null;
    if (m.zaman) clearTimeout(m.zaman);
    const t = ctx.currentTime;
    try {
      m.kok.gain.cancelScheduledValues(t);
      m.kok.gain.setValueAtTime(m.kok.gain.value, t);
      m.kok.gain.linearRampToValueAtTime(0, t + 1);
      for (const k of m.kaynaklar) k.stop(t + 1.05);
    } catch {
      /* yok */
    }
  }

  // ─── Sözleşme ─────────────────────────────────────────────────────────

  return {
    get baglam() {
      return ctx;
    },
    ac() {
      kur();
      if (gercek) {
        kilidiAc();
        try {
          if (gercek.state !== 'running' && !askidaOlmali()) void gercek.resume().catch(() => {});
        } catch {
          /* yok */
        }
      }
    },
    olay,
    tutuldu,
    hedefeGirdi,
    gecersiz,
    arayuz(tur) {
      if (!calabilir()) return;
      try {
        arayuz(tur);
      } catch (e) {
        hata(e);
      }
    },
    ortam(acik, at) {
      if (at && at !== atolye) {
        atolye = at;
        if (ortamDugum) ortamDurdur();
      }
      ortamIstendi = acik;
      if (acik && ayar.ortam) ortamBaslat();
      else ortamDurdur();
    },
    muzik(acik) {
      muzikIstendi = acik;
      if (acik) muzikBaslat();
      else muzikDurdur();
    },
    ayarla(s) {
      if (s.sfx !== undefined) ayar.sfx = sinirla(s.sfx, 0, 1);
      if (s.muzik !== undefined) ayar.muzik = sinirla(s.muzik, 0, 1);
      if (s.ortam !== undefined) ayar.ortam = s.ortam;
      if (s.sessiz !== undefined) ayar.sessiz = s.sessiz;
      if (!yol || !ctx) return;
      const t = ctx.currentTime;
      try {
        yol.sfx.gain.setTargetAtTime(SFX_KAZANCI * ayar.sfx, t, 0.03);
        yol.muzik.gain.setTargetAtTime(MUZIK_KAZANCI * ayar.muzik, t, 0.05);
        yol.ortam.gain.setTargetAtTime(ayar.ortam ? ORTAM_KAZANCI : 0, t, 0.1);
        yol.cikis.gain.setTargetAtTime(ayar.sessiz ? 0 : 1, t, 0.02);
      } catch (e) {
        hata(e);
      }
      if (ayar.ortam && ortamIstendi) ortamBaslat();
    },
    askiya(g) {
      disAskida = g;
      durumUygula();
    },
    tahtaBoyutu(w, h) {
      tahta = { w: Math.max(1, w), h: Math.max(1, h) };
    },
    etkinSes: () => havuz.sayi,
    cozumleyici: () => yol?.analiz ?? null,
    udHazir: () => !!yol && yol.ud.every((b) => !!b),
    udPisir() {
      if (!yol) return;
      for (let i = 0; i < UD_NOTALARI.length; i++) if (!yol.ud[i]) udUret(i);
    },
  };
}
