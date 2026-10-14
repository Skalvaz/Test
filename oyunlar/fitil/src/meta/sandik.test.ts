import { describe, expect, it } from 'vitest';
import { kayitKopyala, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { DESEN_PARCALARI, FITIL_PARCALARI, eksikParcalar, sandikAc, sandikAcik } from './sandik';
import type { SandikCekilisi } from './sandik';
import { tozlaParcaAl } from './defter';
import { ilerlet } from './_test/yardimci';

const onbellek = new Map<number, Kayit>();
/** Sandık sistemi açık, bütün güçlendiriciler açık bir kayıt (sandıkları sıfırlanmış). */
function acikKayit(tohum = 3): Kayit {
  if (!onbellek.has(tohum)) onbellek.set(tohum, ilerlet(25, 1, yeniKayit(tohum)));
  const k = kayitKopyala(onbellek.get(tohum)!);
  k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
  k.sandik.sayac = 0;
  k.sandik.parcasizSeri = 0;
  k.sandik.kasimpatiVerildi = true;
  k.toz = 0;
  return k;
}

describe('sandık sayısı ve koleksiyon havuzu', () => {
  it('72 desen parçası, 21 fitil parçası (Kenevir ve Deniz Feneri sandıktan çıkmaz)', () => {
    expect(DESEN_PARCALARI.length).toBe(72);
    expect(FITIL_PARCALARI.length).toBe(21);
    expect(FITIL_PARCALARI.some((p) => p.includes('denizFeneri') || p.includes('kenevir'))).toBe(false);
  });

  it('sistem 5. bölümle açılır', () => {
    expect(sandikAcik(ilerlet(4))).toBe(false);
    expect(sandikAcik(ilerlet(5))).toBe(true);
  });
});

describe('belirlenimlilik', () => {
  it('aynı tohum + sayaç → aynı sonuç; sayaç ilerler', () => {
    const k = acikKayit();
    const a = sandikAc(k, { tur: 'normal', neden: 'gorev' });
    const b = sandikAc(k, { tur: 'normal', neden: 'gorev' });
    expect(a.sonuc).toEqual(b.sonuc);
    expect(a.kayit).toEqual(b.kayit);
    expect(a.kayit.sandik.sayac).toBe(k.sandik.sayac + 1);
    expect(k.sandik.sayac).toBe(0); // girdi değişmez
  });

  it('kayıt yeniden yüklense de (JSON) sonuç aynı', () => {
    const k = acikKayit();
    const yeniden = JSON.parse(JSON.stringify(k)) as Kayit;
    expect(sandikAc(yeniden, { tur: 'parlak', neden: 'yildiz' }).sonuc).toEqual(sandikAc(k, { tur: 'parlak', neden: 'yildiz' }).sonuc);
  });

  it('farklı kayıt tohumları farklı akış', () => {
    const s1 = Array.from({ length: 20 }, (_, i) => {
      const k = acikKayit(1);
      k.sandik.sayac = i;
      return JSON.stringify(sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler);
    });
    const s2 = Array.from({ length: 20 }, (_, i) => {
      const k = acikKayit(2);
      k.sandik.sayac = i;
      return JSON.stringify(sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler);
    });
    expect(s1).not.toEqual(s2);
  });
});

describe('oranlar (§10.4)', () => {
  it('%35 güçlendirici / %50 desen / %15 fitil (4000 sandık, ±2,5)', () => {
    const n = 4000;
    const say = { guclendirici: 0, desen: 0, fitil: 0 };
    let eksiktenYeni = 0;
    let parcaSayisi = 0;
    for (let i = 0; i < n; i++) {
      const k = acikKayit(11);
      k.sandik.sayac = i;
      const c = sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0];
      if (c.tur === 'guclendirici' || c.tur === 'toz') say.guclendirici++;
      else if (c.tur === 'parca') {
        say[c.kategori]++;
        parcaSayisi++;
        if (c.yeni) eksiktenYeni++;
      }
    }
    expect((say.guclendirici / n) * 100).toBeGreaterThan(32.5);
    expect((say.guclendirici / n) * 100).toBeLessThan(37.5);
    expect((say.desen / n) * 100).toBeGreaterThan(47.5);
    expect((say.desen / n) * 100).toBeLessThan(52.5);
    expect((say.fitil / n) * 100).toBeGreaterThan(12.5);
    expect((say.fitil / n) * 100).toBeLessThan(17.5);
    // Koleksiyon neredeyse boşken parçaların ≥ %80'i yeni (sahip olunmayandan seçim + şans)
    expect(eksiktenYeni / parcaSayisi).toBeGreaterThan(0.85);
  });

  it('%80 sahip olunmayandan: koleksiyonun yarısı doluyken yeni parça oranı ≈ 0,8 + 0,2·0,5 = 0,9', () => {
    const tam = acikKayit(5);
    // Desen havuzunun yarısını doldur
    const yarim = DESEN_PARCALARI.filter((_, i) => i % 2 === 0);
    tam.koleksiyon.parcalar = [...new Set([...tam.koleksiyon.parcalar, ...yarim])];
    const sahipOrani = DESEN_PARCALARI.filter((p) => tam.koleksiyon.parcalar.includes(p)).length / DESEN_PARCALARI.length;
    let desen = 0;
    let yeni = 0;
    for (let i = 0; i < 6000; i++) {
      const k = kayitKopyala(tam);
      k.sandik.sayac = i;
      const c = sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0];
      if (c.tur === 'parca' && c.kategori === 'desen') {
        desen++;
        if (c.yeni) yeni++;
      }
    }
    const beklenen = 0.8 + 0.2 * (1 - sahipOrani);
    expect(Math.abs(yeni / desen - beklenen)).toBeLessThan(0.03);
  });
});

describe('güçlendirici çekilişi', () => {
  function guclendiriciSayaci(k: Kayit): number {
    for (let i = 0; i < 500; i++) {
      const y = kayitKopyala(k);
      y.sandik.sayac = i;
      const c = sandikAc(y, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0];
      if (c.tur === 'guclendirici' || c.tur === 'toz') return i;
    }
    throw new Error('güçlendirici çıkmadı');
  }

  it('stoğu en düşük açık güçlendirici; eşitlikte katalog sırası', () => {
    const k = acikKayit();
    const i = guclendiriciSayaci(k);
    k.sandik.sayac = i;
    k.guclendiriciler = { kibrit: 2, kalip: 1, geriSar: 1 };
    const c = sandikAc(k, { tur: 'normal', neden: 'gorev' });
    expect(c.sonuc.cekilisler[0]).toEqual({ tur: 'guclendirici', guc: 'kalip', adet: 1 });
    expect(c.kayit.guclendiriciler).toEqual({ kibrit: 2, kalip: 2, geriSar: 1 });
  });

  it('stok dolu olan atlanır; hepsi doluysa 2 toz', () => {
    const k = acikKayit();
    k.sandik.sayac = guclendiriciSayaci(k);
    k.guclendiriciler = { kibrit: 3, kalip: 3, geriSar: 2 };
    expect(sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0]).toMatchObject({ tur: 'guclendirici', guc: 'geriSar' });
    k.guclendiriciler = { kibrit: 3, kalip: 3, geriSar: 3 };
    const r = sandikAc(k, { tur: 'normal', neden: 'gorev' });
    expect(r.sonuc.cekilisler[0]).toEqual({ tur: 'toz', adet: 2, neden: 'stokDolu' });
    expect(r.kayit.toz).toBe(k.toz + 2);
    expect(r.kayit.guclendiriciler).toEqual({ kibrit: 3, kalip: 3, geriSar: 3 });
  });

  it('henüz açılmamış güçlendirici verilmez (5–6. bölüm: hiçbiri açık değil → 2 toz)', () => {
    const k = ilerlet(5, 1);
    expect(k.hediyeler).toEqual([]);
    k.sandik.sayac = guclendiriciSayaci(k);
    expect(sandikAc(k, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0]).toMatchObject({ tur: 'toz', adet: 2 });
    // 11 kazanılınca kibrit açık, kalıp (12) açık, geri sar (20) kapalı
    const k2 = ilerlet(11, 1);
    k2.guclendiriciler = { kibrit: 3, kalip: 3, geriSar: 0 };
    k2.sandik.sayac = guclendiriciSayaci(k2);
    expect(sandikAc(k2, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0]).toMatchObject({ tur: 'toz' });
  });
});

describe('parça, tekrar ve toz', () => {
  it('tekrar eden parça 3 toz verir', () => {
    const k = acikKayit();
    k.koleksiyon.parcalar = [...new Set([...k.koleksiyon.parcalar, ...DESEN_PARCALARI, ...FITIL_PARCALARI])];
    let parca: SandikCekilisi | null = null;
    for (let i = 0; i < 50 && !parca; i++) {
      const y = kayitKopyala(k);
      y.sandik.sayac = i;
      const r = sandikAc(y, { tur: 'normal', neden: 'gorev' });
      const c = r.sonuc.cekilisler[0];
      if (c.tur === 'parca') {
        parca = c;
        expect(c.yeni).toBe(false);
        expect(c.toz).toBe(3);
        expect(r.kayit.toz).toBe(k.toz + 3);
        expect(r.kayit.koleksiyon.parcalar.length).toBe(k.koleksiyon.parcalar.length);
      }
    }
    expect(parca).not.toBeNull();
  });

  it('desen tamamlanınca bildirir', () => {
    const k = acikKayit();
    // Söğüt'ün iki parçası var; üçüncüsünü çıkaracak sayacı bul
    k.koleksiyon.parcalar.push('d:sogut:0', 'd:sogut:1');
    for (let i = 0; i < 3000; i++) {
      const y = kayitKopyala(k);
      y.sandik.sayac = i;
      const c = sandikAc(y, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0];
      if (c.tur === 'parca' && c.parca === 'd:sogut:2') {
        expect(c.tamamlandi).toBe(true);
        return;
      }
    }
    throw new Error('söğüt parçası bulunamadı');
  });

  it('10 toz = seçilen 1 parça; yetersiz toz, sahip olunan ve Deniz Feneri reddedilir', () => {
    const k = acikKayit();
    k.toz = 9;
    expect(tozlaParcaAl(k, 'd:kalp:0')).toEqual({ tamam: false, hata: 'yetersizToz' });
    k.toz = 23;
    const r = tozlaParcaAl(k, 'd:kalp:0');
    expect(r.tamam).toBe(true);
    if (!r.tamam) return;
    expect(r.kayit.toz).toBe(13);
    expect(r.kayit.koleksiyon.parcalar).toContain('d:kalp:0');
    expect(r.cekilis).toMatchObject({ tur: 'parca', yeni: true, toz: 0 });
    expect(tozlaParcaAl(r.kayit, 'd:kalp:0')).toEqual({ tamam: false, hata: 'sahip' });
    expect(tozlaParcaAl(r.kayit, 'f:denizFeneri:0')).toEqual({ tamam: false, hata: 'gecersiz' });
    expect(tozlaParcaAl(r.kayit, 'f:altinTel:2')).toMatchObject({ tamam: true });
    expect(tozlaParcaAl(r.kayit, 'x:bilinmez:9')).toEqual({ tamam: false, hata: 'gecersiz' });
  });
});

describe('kötü şans koruması', () => {
  it('3 parçasız sandıktan sonra 4. sandık garanti (yeni) parça verir', () => {
    // Parçasız 3 sandık üreten bir başlangıç sayacı ara, sonra 4.'yü aç.
    let bulundu = 0;
    for (let bas = 0; bas < 3000 && bulundu < 5; bas++) {
      let k = acikKayit(17);
      k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
      k.sandik.sayac = bas;
      let parcasiz = true;
      for (let j = 0; j < 3; j++) {
        const r = sandikAc(k, { tur: 'normal', neden: 'gorev' });
        if (r.sonuc.cekilisler.some((c) => c.tur === 'parca')) parcasiz = false;
        k = r.kayit;
      }
      if (!parcasiz) continue;
      bulundu++;
      expect(k.sandik.parcasizSeri).toBe(3);
      const r4 = sandikAc(k, { tur: 'normal', neden: 'gorev' });
      const c = r4.sonuc.cekilisler[0];
      expect(c.tur).toBe('parca');
      expect(c.tur === 'parca' && c.yeni).toBe(true);
      expect(c.tur === 'parca' && c.garanti).toBe('kotuSans');
      expect(r4.kayit.sandik.parcasizSeri).toBe(0);
    }
    expect(bulundu).toBeGreaterThan(0);
  });

  it('garanti, kategorisinde eksik kalmadıysa öbür kategoriden seçer', () => {
    const k = acikKayit();
    k.koleksiyon.parcalar = [...new Set([...k.koleksiyon.parcalar, ...FITIL_PARCALARI])];
    for (let i = 0; i < 40; i++) {
      const y = kayitKopyala(k);
      y.sandik.sayac = i;
      y.sandik.parcasizSeri = 3;
      const c = sandikAc(y, { tur: 'normal', neden: 'gorev' }).sonuc.cekilisler[0];
      expect(c.tur).toBe('parca');
      expect(c.tur === 'parca' && c.kategori).toBe('desen');
      expect(c.tur === 'parca' && c.yeni).toBe(true);
    }
  });

  it('parça çıkınca seri sıfırlanır; parçasız sandık seriyi artırır (en fazla 3)', () => {
    let k = acikKayit(21);
    k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
    for (let i = 0; i < 200; i++) {
      const once = k.sandik.parcasizSeri;
      const r = sandikAc(k, { tur: 'normal', neden: 'gorev' });
      const parca = r.sonuc.cekilisler.some((c) => c.tur === 'parca');
      expect(r.kayit.sandik.parcasizSeri).toBe(parca ? 0 : Math.min(3, once + 1));
      if (once >= 3) expect(parca).toBe(true);
      k = r.kayit;
      if (k.guclendiriciler.kibrit + k.guclendiriciler.kalip + k.guclendiriciler.geriSar >= 6) k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
    }
  });
});

describe('parlak sandık ve Kasımpatı garantisi', () => {
  it('parlak sandık iki çekiliş yapar', () => {
    for (let i = 0; i < 30; i++) {
      const k = acikKayit();
      k.sandik.sayac = i;
      expect(sandikAc(k, { tur: 'parlak', neden: 'yildiz' }).sonuc.cekilisler.length).toBe(2);
      expect(sandikAc(k, { tur: 'normal', neden: 'yildiz' }).sonuc.cekilisler.length).toBe(1);
    }
  });

  it('5. bölümün ilk sandığı Kasımpatı\'nın eksik 3. parçasını verir ve deseni tamamlar', () => {
    const k = ilerlet(4);
    for (let sayac = 0; sayac < 20; sayac++) {
      const y = kayitKopyala(k);
      y.sandik.sayac = sayac;
      const r = sandikAc(y, { tur: 'normal', neden: 'ilkKazanc', bolumId: 5 });
      expect(r.sonuc.cekilisler[0]).toMatchObject({ tur: 'parca', parca: 'd:kasimpati:2', yeni: true, tamamlandi: true, garanti: 'kasimpati' });
      expect(r.kayit.sandik.kasimpatiVerildi).toBe(true);
      // İkinci sandık artık garanti değil
      const r2 = sandikAc(r.kayit, { tur: 'normal', neden: 'yildiz', bolumId: 5 });
      expect((r2.sonuc.cekilisler[0] as { garanti?: string }).garanti).not.toBe('kasimpati');
    }
  });

  it('eksik parça sayımı', () => {
    const k = yeniKayit(1);
    const e = eksikParcalar(k);
    expect(e.desen.length).toBe(72 - 8);
    expect(e.fitil.length).toBe(21);
  });
});
