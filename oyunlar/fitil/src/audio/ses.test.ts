import { afterEach, describe, expect, it } from 'vitest';
import type { Olay, OlayTuru } from '../core/types';
import { PENTATONIK, dalgaIndeksi, notaIndeksi, pariltiVar } from './nota';
import { BIRLESME_SINIRI, HAVUZ_BOYUTU, SesHavuzu } from './havuz';
import { gurultuUret, yankiKanali } from './gurultu';
import { sesMotoruOlustur } from './sesMotoru';
import { OLAY_CESITLERI, ORNEK_OLAYLAR, SESSIZ_OLAYLAR, fitilGosterisi, fitilZamanlari } from './gosteri';
import { SahteBaglam, SahteKaynak, SahteOsilator, baglamOlarak, type SahteDugum, type SahteParam } from './sahteBaglam';

function kur(sampleRate = 8000) {
  const b = new SahteBaglam({ sampleRate });
  const hatalar: unknown[] = [];
  const m = sesMotoruOlustur({ baglam: baglamOlarak(b), tohum: 3, hata: (e) => hatalar.push(e) });
  m.ac();
  m.tahtaBoyutu(7, 9);
  return { b, m, hatalar };
}
const baslayan = (d: SahteDugum[]) => d.filter((x): x is SahteKaynak => x instanceof SahteKaynak && x.baslangic >= 0);
const frek = (o: SahteOsilator) => o.frequency.ilk();
const yakin = (a: number, b: number) => Math.abs(a - b) < 0.01;

describe('nota (§12.3)', () => {
  it('k. düğüm → indeks min(k−1, 10); dizi C5..C7', () => {
    expect(PENTATONIK).toHaveLength(11);
    expect(PENTATONIK[0]).toBe(523.25);
    expect(PENTATONIK[10]).toBe(2093.0);
    expect([1, 2, 6, 11, 12, 20].map(notaIndeksi)).toEqual([0, 1, 5, 10, 10, 10]);
  });
  it('11+ düğümde parıltı; ısı dalgası son notadan devam eder', () => {
    expect(pariltiVar(10)).toBe(false);
    expect(pariltiVar(11)).toBe(true);
    expect(dalgaIndeksi(4, 1)).toBe(5);
    expect(dalgaIndeksi(4, 3)).toBe(7);
    expect(dalgaIndeksi(9, 3)).toBe(10);
  });
});

describe('ses havuzu (§12.3)', () => {
  it('24 sesi aşınca en eski çalınır', () => {
    const calinan: string[] = [];
    const h = new SesHavuzu<string>(HAVUZ_BOYUTU, (s, calindi) => calindi && calinan.push(s.veri));
    for (let i = 0; i < 30; i++) h.ekle('pop', i * 0.001, 10, `s${i}`, 0);
    expect(h.sayi).toBe(24);
    expect(calinan).toEqual(['s0', 's1', 's2', 's3', 's4', 's5']);
  });
  it('15 ms içinde aynı tür birleşir: ×1,2, en fazla 1,6×; başka tür ya da geç gelen birleşmez', () => {
    const h = new SesHavuzu<number>();
    h.ekle('pop:fitil', 1, 1.3, 0, 1);
    expect(h.birlestir('pop:isi', 1.005)).toBeNull();
    expect(h.birlestir('pop:fitil', 1.016)).toBeNull();
    const c: number[] = [];
    for (let i = 0; i < 6; i++) c.push(h.birlestir('pop:fitil', 1.01)!.carpan);
    expect(c[0]).toBeCloseTo(1.2);
    expect(c[1]).toBeCloseTo(1.44);
    expect(c.at(-1)).toBe(BIRLESME_SINIRI);
  });
  it('biten sesler düşer', () => {
    const h = new SesHavuzu<number>();
    h.ekle('a', 0, 0.2, 1, 0);
    h.ekle('b', 0, 0.5, 2, 0);
    h.temizle(0.3);
    expect(h.sesler.map((s) => s.tur)).toEqual(['b']);
  });
});

describe('gürültü ve yankı tamponları', () => {
  it('beyaz/pembe/kahverengi: tepe ≈ 0,98, DC yok, döngü sınırı yumuşak', () => {
    for (const renk of ['beyaz', 'pembe', 'kahve'] as const) {
      const d = gurultuUret(renk, 16000, 5);
      let tepe = 0;
      let ort = 0;
      for (const v of d) {
        tepe = Math.max(tepe, Math.abs(v));
        ort += v;
      }
      expect(tepe).toBeCloseTo(0.98, 5);
      expect(Math.abs(ort / d.length)).toBeLessThan(0.05);
      if (renk !== 'beyaz') {
        // Döngüde son → ilk örnek sıçraması, komşu örnekler arası tipik farktan büyük olmamalı.
        let ortFark = 0;
        for (let i = 1; i < d.length; i++) ortFark += Math.abs(d[i] - d[i - 1]);
        ortFark /= d.length - 1;
        expect(Math.abs(d[0] - d[d.length - 1])).toBeLessThan(ortFark * 6);
      }
    }
    expect(gurultuUret('pembe', 1000, 9)).toEqual(gurultuUret('pembe', 1000, 9));
  });
  it('dürtü yanıtı 1,8 sn, exp(−t/0,45) ile söner', () => {
    const oran = 8000;
    const k = yankiKanali(oran, 1);
    expect(k.length).toBe(Math.floor(oran * 1.8));
    const enerji = (a: number, b: number) => {
      let s = 0;
      for (let i = Math.floor(a * oran); i < Math.floor(b * oran); i++) s += k[i] * k[i];
      return s;
    };
    // Genlik exp(−t/0,45) → enerji exp(−2t/0,45): 0,45 sn sonra ≈ e^−2 kat.
    const oranE = enerji(0.5, 0.6) / enerji(0.05, 0.15);
    expect(oranE).toBeGreaterThan(Math.exp(-2) * 0.6);
    expect(oranE).toBeLessThan(Math.exp(-2) * 1.6);
  });
});

describe('ses motoru — yönlendirme (§12.3)', () => {
  it('kompresör, yollar, yankı ve kırpıcı şartnamedeki gibi', () => {
    const { b } = kur();
    const komp = b.tur<SahteDugum & Record<string, SahteParam>>('kompresor')[0];
    expect([komp.threshold.value, komp.knee.value, komp.ratio.value, komp.attack.value, komp.release.value]).toEqual([-18, 12, 4, 0.003, 0.15]);
    const kazanclar = b.tur<SahteDugum & { gain: SahteParam }>('kazanc').map((g) => g.gain.value);
    for (const v of [0.8, 0.35, 0.25, 0.18]) expect(kazanclar).toContain(v);
    const conv = b.tur<SahteDugum & { buffer: { numberOfChannels: number; duration: number } }>('convolver')[0];
    expect(conv.buffer.numberOfChannels).toBe(2);
    expect(conv.buffer.duration).toBeCloseTo(1.8, 2);
    const kirpici = b.tur<SahteDugum & { curve: Float32Array }>('kirpici')[0];
    expect(Math.max(...Array.from(kirpici.curve, Math.abs))).toBeLessThan(1);
    // Gürültü tamponları: 2 sn, üç renk.
    const tamponlar = b.kaynaklar;
    expect(tamponlar).toHaveLength(0);
  });
  it('yavaş çekim: ana alçak geçiren 1,2 kHz ↔ 18 kHz', () => {
    const { b, m } = kur();
    const alcak = b.tur<SahteDugum & { frequency: SahteParam; type: string }>('filtre').find((f) => f.frequency.value === 18000)!;
    m.yavasCekim(true);
    expect(alcak.frequency.son('exp')).toBe(1200);
    m.yavasCekim(false);
    expect(alcak.frequency.son('exp')).toBe(18000);
  });
});

describe('ses motoru — olay eşlemesi (types.ts her olay türü)', () => {
  const turler = Object.keys(ORNEK_OLAYLAR) as OlayTuru[];
  it('her olay türünün örneği var (tip denetimiyle tam)', () => {
    expect(turler.length).toBe(32);
  });
  it.each(turler)('%s: hatasız; bilinçli sessizlik dışında ses üretir', (tur) => {
    const { b, m, hatalar } = kur();
    const o = ORNEK_OLAYLAR[tur] as Olay;
    const yeni = b.sirasinda(() => m.olay(o));
    expect(hatalar).toEqual([]);
    const sessiz = SESSIZ_OLAYLAR.includes(o);
    expect(baslayan(yeni).length > 0).toBe(!sessiz);
    for (const k of baslayan(yeni)) {
      expect(k.bitis).toBeGreaterThan(k.baslangic);
      expect(k.bitis - k.baslangic).toBeLessThan(4);
    }
  });
  it('çeşitlemeler ve bilinçli sessizlikler', () => {
    for (const c of OLAY_CESITLERI) {
      const { b, m, hatalar } = kur();
      expect(baslayan(b.sirasinda(() => m.olay(c.olay))).length, c.ad).toBeGreaterThan(0);
      expect(hatalar, c.ad).toEqual([]);
    }
    for (const o of SESSIZ_OLAYLAR) {
      const { b, m } = kur();
      expect(baslayan(b.sirasinda(() => m.olay(o))), o.tur).toHaveLength(0);
    }
  });
  it('fitil gösterisi (12 düğüm) baştan sona hatasız', () => {
    const { m, hatalar } = kur();
    for (const o of fitilGosterisi(12)) m.olay(o);
    expect(hatalar).toEqual([]);
    expect(fitilZamanlari(6)).toEqual([0, 103, 199, 288, 370, 445]);
  });
});

describe('ses motoru — notalar', () => {
  it('düğüm k notası; 11+ düğümde bir oktav üstte parıltı', () => {
    for (const k of [1, 5, 10, 11, 12]) {
      const { b, m } = kur();
      const osil = b.sirasinda(() => m.dugumEklendi(k)).filter((d): d is SahteOsilator => d instanceof SahteOsilator);
      const f = PENTATONIK[Math.min(k - 1, 10)];
      expect(osil.some((o) => yakin(frek(o), f)), `k=${k}`).toBe(true);
      const parilti = osil.filter((o) => yakin(frek(o), f * 2) && o.detune.olaylar.length === 0 && o.frequency.olaylar.length === 1);
      // 2f'de kısa "çıt" katmanı her zaman var; parıltı ek bir 2f sesidir (vibratolu).
      const vibratolu = osil.filter((o) => yakin(frek(o), f * 2) && b.dugumler.some((d) => (d as SahteDugum).cikislar.includes(o.detune)));
      expect(vibratolu.length > 0, `parıltı k=${k}`).toBe(k >= 11);
      expect(parilti.length).toBeGreaterThan(0);
    }
  });
  it('fitil pop notası k, ısı dalgası son notadan devam eder (w. dalga → min(son + w, 10))', () => {
    const { b, m } = kur();
    m.olay({ ...ORNEK_OLAYLAR.fitilBasladi, yol: ORNEK_OLAYLAR.fitilBasladi.yol.slice(0, 5) }); // son = 4 (A5)
    const popFrek = (o: Olay) => {
      b.currentTime += 1; // aynı tür pop'lar 15 ms içinde birleşir; zamanı ilerlet
      return b
        .sirasinda(() => m.olay(o))
        .filter((d): d is SahteOsilator => d instanceof SahteOsilator && d.type === 'triangle')
        .map(frek);
    };
    expect(popFrek({ ...ORNEK_OLAYLAR.patlama, k: 3 })[0]).toBeCloseTo(PENTATONIK[2]);
    expect(popFrek({ ...ORNEK_OLAYLAR.patlama, neden: 'isi', nesil: 2, k: 0, t: 1 })[0]).toBeCloseTo(PENTATONIK[6]);
    m.olay({ ...ORNEK_OLAYLAR.fitilBasladi, yol: Array.from({ length: 12 }, (_, i) => ({ x: i % 7, y: 8 - Math.floor(i / 7) })) });
    expect(popFrek({ ...ORNEK_OLAYLAR.patlama, neden: 'isi', nesil: 3, k: 0, t: 2 })[0]).toBeCloseTo(PENTATONIK[10]);
  });
  it('halka iki nota (k, k+2); özel eşiği taşıyıcısı 6/9/12. düğüm notası, FM oranı 3,5', () => {
    const { b, m } = kur();
    const h = b.sirasinda(() => m.halkaKapandi(4)).filter((d): d is SahteOsilator => d instanceof SahteOsilator).map(frek);
    expect(h.some((f) => yakin(f, PENTATONIK[3]))).toBe(true);
    expect(h.some((f) => yakin(f, PENTATONIK[5]))).toBe(true);
    const e = b.sirasinda(() => m.ozelEsigi('kasimpati')).filter((d): d is SahteOsilator => d instanceof SahteOsilator).map(frek);
    expect(e.some((f) => yakin(f, PENTATONIK[8]))).toBe(true);
    expect(e.some((f) => yakin(f, PENTATONIK[8] * 3.5))).toBe(true);
  });
});

describe('ses motoru — havuz, birleşme, ayarlar', () => {
  it('aynı anda 40 pop: aynı tür birleşir, havuz 24 sesi aşmaz', () => {
    const { b, m } = kur();
    const once = b.sirasinda(() => m.olay(ORNEK_OLAYLAR.patlama));
    const ikinci = b.sirasinda(() => m.olay(ORNEK_OLAYLAR.patlama));
    expect(baslayan(once).length).toBeGreaterThan(0);
    expect(baslayan(ikinci)).toHaveLength(0); // 15 ms içinde: birleşti
    for (let i = 0; i < 40; i++) m.olay({ ...ORNEK_OLAYLAR.engelHasar, engel: i % 2 ? 'kaya' : 'kova', hucre: { x: i % 7, y: i % 9 }, kalan: 0 });
    for (let i = 0; i < 40; i++) m.arayuz(i % 2 ? 'dugme' : 'ac');
    expect(m.etkinSes()).toBeLessThanOrEqual(24);
  });
  it('sessiz ayarı ve sfx 0: ses planlanmaz; sfx kazancı 0,8·v', () => {
    const { b, m } = kur();
    const sfx = b.tur<SahteDugum & { gain: SahteParam }>('kazanc').find((g) => g.gain.value === 0.8)!;
    m.ayarla({ sessiz: true });
    expect(baslayan(b.sirasinda(() => m.dugumEklendi(3)))).toHaveLength(0);
    m.ayarla({ sessiz: false, sfx: 0.5 });
    expect(sfx.gain.son('hedef')).toBeCloseTo(0.4);
    expect(baslayan(b.sirasinda(() => m.dugumEklendi(3))).length).toBeGreaterThan(0);
  });
  it('tutuşma çift çalmaz (fitilBasladi + tutusma() aynı anda)', () => {
    const { b, m } = kur();
    const a = baslayan(b.sirasinda(() => m.tutusma())).length;
    expect(a).toBeGreaterThan(0);
    expect(baslayan(b.sirasinda(() => m.olay(ORNEK_OLAYLAR.fitilBasladi)))).toHaveLength(0);
  });
  it('roket: kenarlarda "çat" (25 ms/hücre), iki yönde', () => {
    const { b, m } = kur();
    const yeni = b.sirasinda(() => m.olay({ ...ORNEK_OLAYLAR.ozelTetiklendi, hucre: { x: 1, y: 4 }, eksen: 0 }));
    const kare = yeni.filter((d): d is SahteOsilator => d instanceof SahteOsilator && d.type === 'square');
    const zamanlar = kare.map((o) => o.baslangic).sort((x, y) => x - y);
    expect(zamanlar).toHaveLength(2);
    expect(zamanlar[0]).toBeCloseTo(0.012 + 0.025 * 2, 3); // sola 2 hücre
    expect(zamanlar[1]).toBeCloseTo(0.012 + 0.025 * 6, 3); // sağa 6 hücre
  });
  it('yerçekimi: sütun başına bir tık (son taş 90·√d ms); aynı anda oturan sütunlar birleşir', () => {
    const { b, m } = kur();
    const yeni = b.sirasinda(() => m.olay(ORNEK_OLAYLAR.yercekimi));
    const tiklar = yeni.filter((d): d is SahteOsilator => d instanceof SahteOsilator && d.type === 'triangle');
    // Sütun 2 ve 3: d = 3 (aynı an, birleşik); sütun 4 ve 5: d = 1 (aynı an, birleşik).
    expect(tiklar.map((o) => o.baslangic).sort()).toEqual([0.012 + 0.09, 0.012 + 0.09 * Math.sqrt(3)].map((x) => expect.closeTo(x, 4)));
    const s2 = tiklar.find((o) => yakin(frek(o), 760 + 2 * 45))!;
    expect(s2.baslangic).toBeCloseTo(0.012 + 0.09 * Math.sqrt(3), 3);
  });
  it('müzik pedi: akor başına 3 nota × 2 testere; büyük olayda kısma 0,02/0,05 ve 600 ms dönüş', () => {
    const { b, m } = kur();
    m.muzik(true);
    const testere = b.osilatorler.filter((o) => o.type === 'sawtooth');
    expect(testere.length).toBeGreaterThanOrEqual(6);
    expect(new Set(testere.map((o) => o.detune.value))).toEqual(new Set([-6, 6]));
    const kisma = b.tur<SahteDugum & { gain: SahteParam }>('kazanc').find((g) => g.cikislar.some((c) => (c as { gain?: SahteParam }).gain?.value === 0.35))!;
    m.olay({ ...ORNEK_OLAYLAR.kombinasyon });
    const ol = kisma.gain.olaylar.filter((o) => o.tur === 'lin');
    expect(ol[0].deger).toBeCloseTo(0.4);
    expect(ol[1].deger).toBe(1);
    expect(ol[1].zaman - ol[0].zaman).toBeCloseTo(0.6);
    m.muzik(false);
  });
  it('ortam: kalabalık + deniz kaynakları; kapatınca durur', () => {
    const { b, m } = kur();
    const yeni = b.sirasinda(() => m.ortam(true));
    expect(baslayan(yeni).length).toBeGreaterThanOrEqual(5);
    m.ortam(false);
    for (const k of baslayan(yeni)) expect(k.bitis).toBeGreaterThan(0);
  });
});

describe('ses motoru — gerçek bağlam (iOS / WhatsApp içi tarayıcı)', () => {
  const eskiWindow = (globalThis as Record<string, unknown>).window;
  const eskiDocument = (globalThis as Record<string, unknown>).document;
  afterEach(() => {
    (globalThis as Record<string, unknown>).window = eskiWindow;
    (globalThis as Record<string, unknown>).document = eskiDocument;
  });

  function tarayici(baslangic: AudioContextState | 'interrupted' = 'suspended') {
    const pencere = new Map<string, ((e?: unknown) => void)[]>();
    const belge = new Map<string, (() => void)[]>();
    const ref: { b: SahteBaglam | null } = { b: null };
    class AC extends SahteBaglam {
      constructor(o?: { sampleRate?: number }) {
        super(o);
        this.state = baslangic;
        ref.b = this;
      }
    }
    const dokument = { visibilityState: 'visible', addEventListener: (ad: string, fn: () => void) => belge.set(ad, [...(belge.get(ad) ?? []), fn]) };
    (globalThis as Record<string, unknown>).window = { AudioContext: AC, addEventListener: (ad: string, fn: () => void) => pencere.set(ad, [...(pencere.get(ad) ?? []), fn]) };
    (globalThis as Record<string, unknown>).document = dokument;
    return { ref, pencere, belge, dokument };
  }

  it('AudioContext yoksa her çağrı sessizce hiçbir şey yapmaz', () => {
    (globalThis as Record<string, unknown>).window = {};
    const hatalar: unknown[] = [];
    const m = sesMotoruOlustur({ hata: (e) => hatalar.push(e) });
    m.ac();
    m.olay(ORNEK_OLAYLAR.patlama);
    m.dugumEklendi(3);
    m.arayuz('kazandin');
    m.ortam(true);
    m.muzik(true);
    m.yavasCekim(true);
    m.askiya(true);
    m.ayarla({ sfx: 0.2, sessiz: true });
    expect(hatalar).toEqual([]);
    expect(m.baglam).toBeNull();
  });

  it('ac(): ilk dokunuşta bağlam kurulur, resume edilir, iOS sessiz tamponu çalınır', () => {
    const t = tarayici('suspended');
    const m = sesMotoruOlustur();
    expect(t.ref.b).toBeNull(); // dokunuştan önce bağlam yok
    m.ac();
    const b = t.ref.b!;
    expect(b.resumeSayisi).toBe(1);
    expect(b.state).toBe('running');
    expect(b.tur<SahteKaynak>('tamponKaynak').some((k) => k.baslangic === 0)).toBe(true);
    m.ac(); // ikinci çağrı yeni bağlam açmaz
    expect(t.ref.b).toBe(b);
  });

  it('bağlam çalışmıyorken ses planlanmaz (geri gelince birikmiş patlama yok)', () => {
    const t = tarayici('running');
    const m = sesMotoruOlustur();
    m.ac();
    const b = t.ref.b!;
    b.state = 'suspended';
    expect(baslayan(b.sirasinda(() => m.olay(ORNEK_OLAYLAR.patlama)))).toHaveLength(0);
    b.state = 'running';
    expect(baslayan(b.sirasinda(() => m.olay(ORNEK_OLAYLAR.patlama))).length).toBeGreaterThan(0);
  });

  it('askiya ve sekme gizlenmesi suspend/resume eder; iOS kesintisinden ilk dokunuşta döner', () => {
    const t = tarayici('running');
    const m = sesMotoruOlustur();
    m.ac();
    const b = t.ref.b!;
    m.askiya(true);
    expect(b.state).toBe('suspended');
    m.askiya(false);
    expect(b.state).toBe('running');
    t.dokument.visibilityState = 'hidden';
    for (const fn of t.belge.get('visibilitychange') ?? []) fn();
    expect(b.state).toBe('suspended');
    t.dokument.visibilityState = 'visible';
    for (const fn of t.belge.get('visibilitychange') ?? []) fn();
    expect(b.state).toBe('running');
    // iOS: telefon görüşmesi bağlamı 'interrupted' yapar; sonraki dokunuşta resume.
    b.state = 'interrupted';
    for (const fn of b.dinleyiciler.get('statechange') ?? []) fn();
    const once = b.resumeSayisi;
    for (const fn of t.pencere.get('pointerdown') ?? []) fn();
    expect(b.resumeSayisi).toBe(once + 1);
    expect(b.state).toBe('running');
  });
});
