/**
 * Çizicinin DOM'suz parçaları: fişek desen tarifleri (§10.3), Gece Tablosu
 * kayıt biçimi ve belirlenimliliği (§13.6), kamera (§12.1), yumuşatma.
 */
import { describe, expect, it } from 'vitest';
import { DESENLER } from '../app/katalog';
import { DESEN_TARIFLERI, desenTarifi } from './fisekDesenleri';
import { B, HAVUZ, ParcacikHavuzu } from './parcacik';
import { kayitCoz, kayitPaketle, tabloPlani, type TabloKaydi } from './tablo';
import { Kamera } from './kamera';
import { inOutCubic, inQuad, outBack, outCubic, perlin1, yayAdim } from './matematik';

const rnd = (() => {
  let s = 12345;
  return () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
})();

describe('havai fişek desenleri', () => {
  it('katalogdaki 24 desenin her birinin tarifi var', () => {
    expect(DESEN_TARIFLERI.length).toBe(24);
    for (const d of DESENLER) expect(desenTarifi(d.id).id).toBe(d.id);
  });

  it('her desen tablodaki sayıda parçacık üretir; düşük kalitede yarısı', () => {
    for (const t of DESEN_TARIFLERI) {
      const h = new ParcacikHavuzu();
      const n = t.uret(h, 100, 100, { olcek: 1, renk: 2, renk2: 8, rnd, gok: true });
      expect(n, t.id).toBe(t.parcacik);
      for (let i = 0; i < HAVUZ; i++) {
        if (!h.aktif[i]) continue;
        expect(Number.isFinite(h.vx[i]) && Number.isFinite(h.vy[i]), t.id).toBe(true);
        expect(h.bayrak[i] & B.GOK).toBe(B.GOK);
      }
      const y = new ParcacikHavuzu();
      y.oran = 0.5;
      expect(t.uret(y, 0, 0, { olcek: 1, renk: -1, renk2: 6, rnd, gok: true }), t.id).toBe(Math.round(t.parcacik / 2));
    }
  });

  it('havuz 800 ile sınırlı; taşma sessizce atlanır', () => {
    const h = new ParcacikHavuzu();
    let toplam = 0;
    for (let k = 0; k < 12; k++) toplam += desenTarifi('karanfil').uret(h, 0, 0, { olcek: 1, renk: 0, renk2: 6, rnd, gok: false });
    expect(toplam).toBe(HAVUZ);
    expect(h.sayi).toBe(HAVUZ);
    h.guncelle(5000);
    expect(h.sayi).toBe(0);
  });
});

describe('Gece Tablosu', () => {
  const kayitlar: TabloKaydi[] = [
    { x: 0, y: 6, renk: 0, nesil: 0, ozel: 0, t: 0 },
    { x: 3, y: 2, renk: 7, nesil: 3, ozel: 3, t: 1500 },
    { x: 6, y: 8, renk: 5, nesil: 15, ozel: 1, t: 16383 },
    { x: 2, y: 4, renk: 2, nesil: 1, ozel: 2, t: 42 },
  ];

  it('32 bit kayıt paketleme gidiş-dönüş', () => {
    for (const k of kayitlar) {
      const n = kayitPaketle(k);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(2 ** 32);
      expect(kayitCoz(n)).toEqual(k);
    }
    expect(kayitCoz(kayitPaketle({ x: 1, y: 1, renk: -1, nesil: 0, ozel: 3, t: 0 })).renk).toBe(7);
  });

  it('plan belirlenimli; yarıçap 18 + 10·nesil; desen özel türüne göre', () => {
    const a = tabloPlani(kayitlar, 512, 614, 99);
    const b = tabloPlani(kayitlar.map(kayitPaketle), 512, 614, 99);
    expect(a).toEqual(b);
    expect(a.length).toBe(kayitlar.length);
    expect(a.map((p) => p.r)).toEqual([18, 48, 168, 28]);
    expect(a.map((p) => p.desen)).toEqual(['sade', 'halka', 'cizgi', 'kure']);
    expect(tabloPlani(kayitlar, 512, 614, 100)).not.toEqual(a);
    // Konum: x → %10–90; alt satırlar alçakta.
    for (const p of a) {
      expect(p.x).toBeGreaterThan(512 * 0.05);
      expect(p.x).toBeLessThan(512 * 0.95);
    }
    expect(a[2].y).toBeGreaterThan(a[1].y);
  });
});

describe('kamera (§12.1)', () => {
  it('travma: üst sınır 1, saniyede 1,6 azalır; hareketi azalt ile sarsıntı yok', () => {
    const k = new Kamera();
    k.sars(0.8);
    k.sars(0.8);
    expect(k.travma).toBe(1);
    k.guncelle(500);
    expect(k.travma).toBeCloseTo(0.2, 5);
    const a = new Kamera();
    a.hareketiAzalt = true;
    a.sars(1);
    a.guncelle(16);
    expect(Math.abs(a.kx)).toBe(0);
    expect(Math.abs(a.aci)).toBe(0);
  });

  it('yönetmen: 80 ms\'de 0,3, 450 ms bekler, 250 ms\'de 1; dinleyici aç/kapa', () => {
    const k = new Kamera();
    const olay: boolean[] = [];
    k.dinle = (y) => olay.push(y);
    k.yonet(100, 100);
    k.guncelle(80);
    expect(k.zamanOlcegi).toBeCloseTo(0.3, 5);
    expect(k.zoom).toBeCloseTo(1.04, 5);
    k.guncelle(440);
    expect(k.zamanOlcegi).toBeCloseTo(0.3, 5);
    k.guncelle(300);
    k.guncelle(16);
    expect(k.zamanOlcegi).toBe(1);
    expect(olay).toEqual([true, false]);
  });

  it('hareketi azalt: ölçek 0,6, yakınlaşma yok', () => {
    const k = new Kamera();
    k.hareketiAzalt = true;
    k.yonet(0, 0);
    k.guncelle(100);
    expect(k.zamanOlcegi).toBeCloseTo(0.6, 5);
    expect(k.zoom).toBe(1);
  });

  it('hit-stop zamanı durdurur; flaş saniyede en fazla 3, alfa ≤ 0,35', () => {
    const k = new Kamera();
    k.hitStop(50);
    k.guncelle(16);
    expect(k.zamanOlcegi).toBe(0);
    k.guncelle(40);
    k.guncelle(16);
    expect(k.zamanOlcegi).toBe(1);
    const sonuc = [k.flasIste(1, 120), k.flasIste(1, 120), k.flasIste(1, 120), k.flasIste(1, 120)];
    expect(sonuc).toEqual([true, true, true, false]);
    expect(k.flas).toBeLessThanOrEqual(0.35);
    k.guncelle(1001);
    expect(k.flasIste(0.2, 120)).toBe(true);
  });
});

describe('yumuşatma ve yay', () => {
  it('uç değerler', () => {
    for (const f of [outCubic, inQuad, inOutCubic, (t: number) => outBack(t)]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
    expect(inQuad(0.5)).toBe(0.25);
  });

  it('düğüm yayı (k400 c18) itkiyle ~1,25 tepeye çıkar, 1,1\'e oturur', () => {
    const y = { x: 1, v: 7 };
    let tepe = 1;
    for (let i = 0; i < 120; i++) {
      yayAdim(y, 1.1, 400, 18, 1 / 120);
      tepe = Math.max(tepe, y.x);
    }
    expect(tepe).toBeGreaterThan(1.22);
    expect(tepe).toBeLessThan(1.28);
    for (let i = 0; i < 240; i++) yayAdim(y, 1.1, 400, 18, 1 / 120);
    expect(y.x).toBeCloseTo(1.1, 3);
  });

  it('Perlin gürültüsü sınırlı', () => {
    let en = 0;
    for (let i = 0; i < 2000; i++) en = Math.max(en, Math.abs(perlin1(i * 0.137, 2)));
    expect(en).toBeLessThanOrEqual(1.2);
    expect(en).toBeGreaterThan(0.2);
  });
});
