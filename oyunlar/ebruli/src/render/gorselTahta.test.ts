/**
 * Görsel tahta olaylarla `sonraki` duruma ulaşır (GDD §13.2, FİTİL dersi 1).
 * Olaylar sahte çözücüden (dev/sahteCozum.ts) gelir; gerçek çekirdek (P1)
 * bağlanınca aynı test `hamleUygula` ile de koşturulabilir (aşağıda
 * `cekirdekVarMi`).
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, hamleUygula } from '../core/index';
import type { BolumVerisi, Hamle, OyunDurumu } from '../core/types';
import b001 from '../levels/veri/b001.json';
import { GorselTahta, damlaOlcegi, gDamla } from './gorselTahta';
import { gecerliHamleler, sahteHamle, sahteOnizle } from './dev/sahteCozum';
import { SADE, VITRIN } from './dev/ornekBolumler';

function mulberry(t: number): () => number {
  let s = t >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function cekirdekVarMi(): boolean {
  try {
    const d = bolumuYukle(SADE, 0);
    const h = gecerliHamleler(d)[0];
    hamleUygula(d, h);
    return true;
  } catch {
    return false;
  }
}

function oyna(v: BolumVerisi, tohum: number, hamleSayisi: number, coz: (d: OyunDurumu, h: Hamle) => { durum: OyunDurumu; olaylar: import('../core/types').Olay[] }) {
  const rnd = mulberry(tohum);
  let d = bolumuYukle(v, tohum % 5);
  const g = new GorselTahta();
  g.kur(d);
  const turler = new Set<string>();
  for (let i = 0; i < hamleSayisi && !d.bitti; i++) {
    const hs = gecerliHamleler(d);
    if (!hs.length) break;
    const h = hs[Math.floor(rnd() * hs.length)];
    const r = coz(d, h);
    for (const o of r.olaylar) {
      turler.add(o.tur);
      g.uygula(o);
      // Canlandırmalar arada ilerlesin (mantıksal durumu bozmamalı).
      g.guncelle(rnd() * 40);
    }
    const fark = g.farklar(r.durum);
    if (fark.length) return { fark, i, turler, uyumsuz: g.uyumsuz };
    d = r.durum;
  }
  return { fark: [] as string[], i: -1, turler, uyumsuz: g.uyumsuz };
}

describe('GorselTahta (sahte çözücüyle)', () => {
  it('bölüm 1: 40 rastgele oyun boyunca olaylarla durumla eşit kalır', () => {
    for (let t = 1; t <= 40; t++) {
      const r = oyna(b001 as unknown as BolumVerisi, t, 12, sahteHamle);
      expect(r.fark, `tohum ${t}, hamle ${r.i}`).toEqual([]);
    }
  });

  it('vitrin (özel taş, kâğıt, mermer, yağ, desen, delik): 60 oyun eşit, önkoşul ihlali yok', () => {
    const tum = new Set<string>();
    for (let t = 1; t <= 60; t++) {
      const r = oyna(VITRIN, t, 18, sahteHamle);
      expect(r.fark, `tohum ${t}, hamle ${r.i}`).toEqual([]);
      expect(r.uyumsuz, `tohum ${t}`).toBe(0);
      for (const k of r.turler) tum.add(k);
    }
    for (const tur of ['karisti', 'ozelSuruklendi', 'eslesti', 'temizlendi', 'ozelOlustu', 'ozelTetiklendi', 'yercekimi', 'mermerHasar', 'kagitAlindi', 'hedefIlerledi', 'puanEklendi', 'hamleOzeti'])
      expect(tum.has(tur), tur).toBe(true);
  });

  it.runIf(cekirdekVarMi())('gerçek çekirdek (P1) olaylarıyla da eşit', () => {
    for (let t = 1; t <= 30; t++) {
      const r = oyna(VITRIN, t, 18, hamleUygula);
      expect(r.fark, `tohum ${t}, hamle ${r.i}`).toEqual([]);
    }
  });

  it('esitle: aynı kimlikli damlanın canlandırması korunur, farklı olan yenilenir', () => {
    const d = bolumuYukle(SADE, 0);
    const g = new GorselTahta();
    g.kur(d);
    const ilk = g.damla({ x: 0, y: 8 })!;
    ilk.oy = -2;
    ilk.hTur = 1;
    ilk.hSure = 100;
    ilk.hy0 = -2;
    g.esitle(d);
    expect(g.damla({ x: 0, y: 8 })).toBe(ilk);
    const d2 = structuredClone(d);
    const c = d2.hucreler[8 * 7];
    if (c.icerik?.tur === 'damla') c.icerik.damla.id = 9999;
    g.esitle(d2);
    expect(g.damla({ x: 0, y: 8 })!.id).toBe(9999);
    expect(g.farklar(d2)).toEqual([]);
  });

  it('düşme canlandırması: ofset sıfıra iner, iniş ezilmesi olur', () => {
    const g = gDamla({ id: 1, renk: 3, ozel: 'yok', yon: 'yatay' });
    const t = new GorselTahta();
    t.w = 1;
    t.h = 1;
    t.hucreler = [{ delik: false, icerik: { tur: 'damla', d: g }, kagit: 0, yag: false, desen: 0, desenBoyali: false, desenAcilis: 0 }];
    g.hTur = 1;
    g.hSure = 90 * 2;
    g.hy0 = -4;
    g.oy = -4;
    t.guncelle(90);
    expect(g.oy).toBeLessThan(0);
    expect(g.oy).toBeGreaterThan(-4);
    t.guncelle(100);
    expect(g.oy).toBe(0);
    expect(g.inis).toBeGreaterThanOrEqual(0);
    t.guncelle(40);
    const { sx, sy } = damlaOlcegi(g);
    expect(sy).toBeLessThan(1);
    expect(sx).toBeGreaterThan(1);
  });
});

describe('sahte önizleme', () => {
  it('doğumsuz: temizlenecekler hamlenin ilk dolumdan önceki temizlikleriyle aynı', () => {
    let kontrol = 0;
    for (let t = 1; t <= 20; t++) {
      const d = bolumuYukle(VITRIN, t % 3);
      for (const h of gecerliHamleler(d).slice(0, 25)) {
        const o = sahteOnizle(d, h);
        const r = sahteHamle(d, h);
        const ilkDolum = r.olaylar.findIndex((x) => x.tur === 'yercekimi' && x.doganlar.length > 0);
        const once = (ilkDolum < 0 ? r.olaylar : r.olaylar.slice(0, ilkDolum)).filter((x) => x.tur === 'temizlendi');
        expect(o.temizlenecek.length).toBe(once.length);
        kontrol++;
      }
    }
    expect(kontrol).toBeGreaterThan(100);
  });
});
