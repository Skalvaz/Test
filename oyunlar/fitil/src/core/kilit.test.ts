/** Kilitlenme testi (§3.4) ve karıştırma (§3.8): sonlanma, kilitsizlik, bolumuYukle adım 4. */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from './bolumYukle';
import { hamleUygula } from './hamle';
import { karistir } from './karistir';
import { halkaVar, kilitliMi } from './kilit';
import { bolum, desen, fitil, gorselUygula, kur, sec } from './testAraclari';
import type { OyunDurumu } from './types';

/** Özel taşı düz kapsüle çevirerek kilitli tahta elde et (kur kilitli tahtayı karıştırırdı). */
function duzlestir(d: OyunDurumu, x: number, y: number, renk: number): OyunDurumu {
  const ic = d.hucreler[y * d.w + x].icerik;
  if (ic?.tur === 'kapsul') {
    ic.ozel = 'yok';
    ic.renk = renk as 0;
  }
  return d;
}

describe('kilitliMi (§3.4)', () => {
  it('komşu aynı renk olmayan desen kilitli; özel taş varsa kilitli değil', () => {
    const d = kur(desen(5, 5, { '2,2': 'Zr0' }));
    expect(kilitliMi(d)).toBe(false);
    expect(kilitliMi(duzlestir(d, 2, 2, 2))).toBe(true);
  });

  it('çapraz 3\'lü bileşen kilidi açar; dortKomsu kuralında açmaz', () => {
    const satir = desen(4, 4, { '0,0': 'M', '1,1': 'M', '2,2': 'M', '3,3': 'Zr0' });
    const d = duzlestir(kur(satir), 3, 3, 1);
    expect(kilitliMi(d)).toBe(false);
    const d4 = duzlestir(kur(satir, { kurallar: { dortKomsu: true } }), 3, 3, 1);
    expect(kilitliMi(d4)).toBe(true);
  });

  it('yıldız topu jokerdir ama kendisi özel taş olduğundan tahta kilitsizdir', () => {
    const d = kur(desen(4, 4, { '1,1': '*' }));
    expect(kilitliMi(d)).toBe(false);
  });

  it('kafesli kapsül bileşene girmez', () => {
    const d = duzlestir(kur(desen(4, 4, { '0,0': 'M', '1,0': 'cM', '2,0': 'M', '3,3': 'Zr0' })), 3, 3, 1);
    expect(kilitliMi(d)).toBe(true);
  });

  it('yalnizHalka: 3\'lü yetmez, 4\'lü döngü (2×2) gerekir', () => {
    const uc = duzlestir(kur(desen(4, 4, { '0,0': 'M', '1,0': 'M', '2,0': 'M', '3,3': 'Zr0' }), { kurallar: { yalnizHalka: true } }), 3, 3, 1);
    expect(halkaVar(uc)).toBe(false);
    expect(kilitliMi(uc)).toBe(true);
    const kare = duzlestir(kur(desen(4, 4, { '0,0': 'M', '1,0': 'M', '0,1': 'M', '1,1': 'M', '3,3': 'Zr0' }), { kurallar: { yalnizHalka: true } }), 3, 3, 1);
    expect(kilitliMi(kare)).toBe(false);
    // 8-komşulukta elmas da 4'lü döngüdür.
    const elmas = duzlestir(kur(desen(4, 4, { '1,0': 'M', '0,1': 'M', '2,1': 'M', '1,2': 'M', '3,3': 'Zr0' }), { kurallar: { yalnizHalka: true } }), 3, 3, 1);
    expect(kilitliMi(elmas)).toBe(false);
  });
});

describe('karıştırma (§3.8)', () => {
  it('kilitli tahta: karıştırma sonlanır ve kilitsiz bırakır; kafesli/fener/ıslak yerinde kalır', () => {
    const d = duzlestir(kur(desen(5, 5, { '0,0': 'cR', '4,0': 'F', '4,4': 'wZ', '2,2': 'Ar0' }), { cikislar: [] }), 2, 2, 2);
    expect(kilitliMi(d)).toBe(true);
    const once = structuredClone(d.hucreler);
    const s = karistir(d);
    expect(kilitliMi(d)).toBe(false);
    expect(d.hucreler[0]).toEqual(once[0]);
    expect(d.hucreler[4]).toEqual(once[4]);
    expect(d.hucreler[24]).toEqual(once[24]);
    // Eşleme bir permütasyondur.
    expect(new Set(s.esleme.map((m) => `${m.e.x},${m.e.y}`)).size).toBe(s.esleme.length);
  });

  it('çok az kapsül: yeniden renklendirme ya da son çare sonlanır', () => {
    const d = duzlestir(kur(['K1 Ar0 K1', 'K1 K1 K1', 'Z # R']), 1, 0, 1);
    expect(kilitliMi(d)).toBe(true);
    const s = karistir(d);
    expect(kilitliMi(d)).toBe(false);
    expect(s.roket).not.toBeNull();
    const bos = kur(['K1 K1 K1', 'Rr0 # K1']);
    bos.hucreler[3].icerik = { tur: 'kaya', kat: 1 };
    expect(kilitliMi(bos)).toBe(true);
    expect(() => karistir(bos)).not.toThrow();
  });

  it('hamle sonunda tahta kilitliyse karıştırma olayı; sonuç kilitsiz; görsel tahta eşitlenir', () => {
    // renkSayisi 4, dolum rengi 4 (kilit testine girmeyen renk): hamleden sonra tahta kilitlenir.
    const d = kur(['R A Z G', 'Z G R A', 'R A Z G', 'R R R A'], { renkSayisi: 4, dogumAgirliklari: [0, 0, 0, 0, 1] });
    const r = hamleUygula(d, fitil([0, 3], [1, 3], [2, 3]));
    const k = sec(r.olaylar, 'karistirma');
    expect(k).toHaveLength(1);
    expect(kilitliMi(r.durum)).toBe(false);
    expect(r.durum.kalanHamle).toBe(d.kalanHamle - 1); // karıştırma hamle harcamaz
    expect(gorselUygula(d, r.olaylar).hucreler).toEqual(r.durum.hucreler);
    const sira = r.olaylar.map((o) => o.tur);
    expect(sira.indexOf('karistirma')).toBeLessThan(sira.indexOf('reaksiyon'));
  });

  it('bolumuYukle: kilitli ilk tahta §3.8 ile karıştırılır, her denemede aynı', () => {
    const v = bolum(desen(5, 5));
    const a = bolumuYukle(v, 0);
    const b = bolumuYukle(v, 3);
    expect(kilitliMi(a)).toBe(false);
    expect(JSON.stringify(a.hucreler)).toBe(JSON.stringify(b.hucreler));
    expect(a.rng).not.toBe(b.rng);
  });
});
