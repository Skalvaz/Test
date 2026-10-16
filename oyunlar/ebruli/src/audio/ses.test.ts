import { describe, expect, it } from 'vitest';
import type { Olay } from '../core/types';
import { HICAZ, PENTATONIK, RENK_NOTASI, UD_NOTALARI, enYakinUd, kaskatBasamagi, kaskatParilti } from './nota';
import { udTeli } from './ud';
import { kirpiciEgrisi, sesMotoruOlustur } from './sesMotoru';
import { OLAY_CESITLERI, ORNEK_OLAYLAR, SESSIZ_OLAYLAR, hamleGosterisi } from './gosteri';
import { SahteBaglam, SahteKaynak, SahteOsilator, SahteTamponKaynak, baglamOlarak, type SahteDugum } from './sahteBaglam';

function kur(sampleRate = 8000) {
  const b = new SahteBaglam({ sampleRate });
  const hatalar: unknown[] = [];
  const m = sesMotoruOlustur({ baglam: baglamOlarak(b), tohum: 3, hata: (e) => hatalar.push(e) });
  m.ac();
  m.tahtaBoyutu(7, 9);
  return { b, m, hatalar };
}
const baslayan = (d: SahteDugum[]) => d.filter((x): x is SahteKaynak => x instanceof SahteKaynak && x.baslangic >= 0);

describe('nota (§10.3, K18)', () => {
  it('renk notaları Re üzerinde konsonans; hicaz yalnız merdivende', () => {
    expect(RENK_NOTASI[1]).toBeCloseTo(293.66);
    expect(RENK_NOTASI[3]).toBeCloseTo(392.0);
    expect(RENK_NOTASI[7]).toBeCloseTo(146.83);
    // Gündelik renk notalarında E♭ (311,13) yok.
    expect(Object.values(RENK_NOTASI).some((f) => Math.abs(f - 311.13) < 1)).toBe(false);
    expect(HICAZ).toHaveLength(8);
    expect([1, 2, 3, 8, 9, 20].map(kaskatBasamagi)).toEqual([0, 1, 2, 7, 7, 7]);
    expect(kaskatParilti(8)).toBe(false);
    expect(kaskatParilti(9)).toBe(true);
    expect(PENTATONIK.every((f) => f > 100 && f < 600)).toBe(true);
  });
  it('en yakın ud tamponu', () => {
    expect(UD_NOTALARI).toHaveLength(16);
    const r = enYakinUd(392);
    expect(UD_NOTALARI[r.i]).toBeCloseTo(392);
    expect(r.oran).toBeCloseTo(1);
    // D3–D5 arasında oran en çok bir buçuk ton (hicazın artık ikilisi) değişir.
    for (const f of [150, 200, 333, 480, 560]) expect(Math.abs(Math.log2(enYakinUd(f).oran))).toBeLessThan(1.5 / 12 + 1e-9);
  });
});

describe('ud (Karplus–Strong)', () => {
  it('belirlenimli, sonlu, tepe 0,9, söner', () => {
    const a = udTeli(293.66, 22050, { tohum: 4 });
    const b = udTeli(293.66, 22050, { tohum: 4 });
    expect(a).toEqual(b);
    let tepe = 0;
    for (const v of a) {
      expect(Number.isFinite(v)).toBe(true);
      tepe = Math.max(tepe, Math.abs(v));
    }
    expect(tepe).toBeCloseTo(0.9, 5);
    const rms = (x: Float32Array, i0: number, i1: number) => {
      let s = 0;
      for (let i = i0; i < i1; i++) s += x[i] * x[i];
      return Math.sqrt(s / (i1 - i0));
    };
    const n = a.length;
    expect(rms(a, Math.floor(n * 0.7), Math.floor(n * 0.8))).toBeLessThan(rms(a, 0, Math.floor(n * 0.1)) * 0.5);
  });
  it('perde: özilinti tepesi oran/f örnekte (tel boyu)', () => {
    const oran = 22050;
    for (const f of [146.83, 293.66, 587.33]) {
      const x = udTeli(f, oran);
      const L = Math.round(oran / f);
      const i0 = Math.floor(oran * 0.1);
      const N = Math.floor(oran * 0.1);
      let en = 0;
      let enLag = 0;
      for (let lag = Math.floor(L * 0.6); lag <= Math.floor(L * 1.6); lag++) {
        let s = 0;
        for (let i = i0; i < i0 + N; i++) s += x[i] * x[i + lag];
        if (s > en) {
          en = s;
          enLag = lag;
        }
      }
      expect(Math.abs(enLag - L)).toBeLessThanOrEqual(1);
    }
  });
});

describe('ses motoru (sahte bağlam)', () => {
  it('kırpıcı eğrisi: |çıkış| < 1, ±0,8 içinde doğrusal', () => {
    const e = kirpiciEgrisi();
    for (const v of e) expect(Math.abs(v)).toBeLessThan(1);
    expect(e[Math.round((0.5 + 0.25) * (e.length - 1))]).toBeCloseTo(0.5, 2);
  });

  it('her örnek olay hatasız ses üretir; bilinçli sessizler üretmez', () => {
    const { b, m, hatalar } = kur();
    for (const o of Object.values(ORNEK_OLAYLAR) as Olay[]) {
      const yeni = b.sirasinda(() => m.olay(o));
      expect(baslayan(yeni).length, o.tur).toBeGreaterThan(0);
      b.currentTime += 0.5;
    }
    for (const c of OLAY_CESITLERI) {
      expect(baslayan(b.sirasinda(() => m.olay(c.olay))).length, c.ad).toBeGreaterThan(0);
      b.currentTime += 0.5;
    }
    for (const o of SESSIZ_OLAYLAR) expect(baslayan(b.sirasinda(() => m.olay(o))).length, o.tur).toBe(0);
    expect(hatalar).toEqual([]);
  });

  it('temizlendi: ud tamponu rengin notasına oranlanır; 15 ms içinde aynı renk birleşir', () => {
    const { b, m } = kur();
    expect(m.udHazir()).toBe(true);
    const o = { ...ORNEK_OLAYLAR.temizlendi!, renk: 6 } as Olay;
    const ilk = b.sirasinda(() => m.olay(o));
    const ud = ilk.filter((d): d is SahteTamponKaynak => d instanceof SahteTamponKaynak && d.buffer !== null && d.buffer.length === Math.floor(8000 * 1.2));
    expect(ud.length).toBe(1);
    const f = UD_NOTALARI[enYakinUd(523.25).i] * ud[0].playbackRate.value;
    expect(f).toBeCloseTo(523.25, 1);
    // Aynı anda gelen ikinci koparma birleşir: yeni kaynak yok.
    expect(baslayan(b.sirasinda(() => m.olay(o))).length).toBe(0);
    // Başka renk birleşmez.
    expect(baslayan(b.sirasinda(() => m.olay({ ...o, renk: 3 } as Olay))).length).toBeGreaterThan(0);
  });

  it('havuz en fazla 24 ses', () => {
    const { b, m } = kur();
    for (let i = 0; i < 60; i++) {
      m.olay({ ...ORNEK_OLAYLAR.karisti!, hedef: { x: i % 7, y: 1 } } as Olay);
      b.currentTime += 0.002;
    }
    expect(m.etkinSes()).toBeLessThanOrEqual(24);
  });

  it('kaskat merdiveni: k. kaskat hicaz basamağı (k=3 → F♯4)', () => {
    const { b, m } = kur();
    const yeni = b.sirasinda(() => m.olay({ t: 0, tur: 'kaskat', k: 3, kademe: 'nefis' }));
    const ud = yeni.filter((d): d is SahteTamponKaynak => d instanceof SahteTamponKaynak && d.buffer?.length === Math.floor(8000 * 1.2));
    const frek = ud.map((d) => UD_NOTALARI[UD_NOTALARI.findIndex((_, i) => b.dugumler.includes(d) && i >= 0)] * 0 + d.playbackRate.value);
    expect(frek.length).toBeGreaterThan(0);
    const osil = yeni.filter((d): d is SahteOsilator => d instanceof SahteOsilator);
    // FM çanı oktav üstü: 2 × F♯4.
    expect(osil.some((o) => Math.abs(o.frequency.value - HICAZ[2] * 2) < 0.5 || Math.abs(o.frequency.ilk() - HICAZ[2] * 2) < 0.5)).toBe(true);
  });

  it('sessiz ayarı: hiçbir ses planlanmaz; ayar geri açılınca çalar', () => {
    const { b, m } = kur();
    m.ayarla({ sessiz: true });
    expect(baslayan(b.sirasinda(() => m.olay(ORNEK_OLAYLAR.birlesim!))).length).toBe(0);
    expect(baslayan(b.sirasinda(() => m.arayuz('kazandin'))).length).toBe(0);
    m.ayarla({ sessiz: false });
    expect(baslayan(b.sirasinda(() => m.arayuz('kazandin'))).length).toBeGreaterThan(0);
  });

  it('bütün arayüz sesleri', () => {
    const { b, m, hatalar } = kur();
    for (const a of ['dugme', 'ac', 'kapa', 'yildiz1', 'yildiz2', 'yildiz3', 'kazandin', 'kaybettin', 'sonHamle', 'hedefTamam', 'kagitCek'] as const) {
      expect(baslayan(b.sirasinda(() => m.arayuz(a))).length, a).toBeGreaterThan(0);
      b.currentTime += 1;
    }
    expect(hatalar).toEqual([]);
  });

  it('ortam ve müzik açılıp kapanır (Üsküdar ve Bursa)', () => {
    const { b, m, hatalar } = kur();
    const acilan = b.sirasinda(() => m.ortam(true, 'uskudar'));
    expect(baslayan(acilan).length).toBeGreaterThan(2);
    m.ortam(true, 'bursa');
    m.muzik(true);
    m.ortam(false);
    m.muzik(false);
    expect(hatalar).toEqual([]);
  });

  it('hamle dizisi ve stereo konum: sol hücre solda', () => {
    const { b, m, hatalar } = kur();
    for (const o of hamleGosterisi()) m.olay(o);
    expect(hatalar).toEqual([]);
    const yeni = b.sirasinda(() => m.olay({ ...ORNEK_OLAYLAR.mermerHasar!, hucre: { x: 0, y: 2 } } as Olay));
    const pan = yeni.find((d) => d.tip === 'pan') as (SahteDugum & { pan: { value: number } }) | undefined;
    expect(pan?.pan.value).toBeLessThan(0);
  });

  it('bağlam yoksa (Node) sessizce hiçbir şey yapmaz', () => {
    const m = sesMotoruOlustur();
    m.ac();
    m.olay(ORNEK_OLAYLAR.karisti!);
    m.arayuz('dugme');
    m.ortam(true);
    expect(m.etkinSes()).toBe(0);
  });
});
