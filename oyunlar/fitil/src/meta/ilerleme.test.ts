import { describe, expect, it } from 'vitest';
import { bolumAcikMi, bolumSonucu, coskuAktif, gunGiris, siradakiDenemeNo, ustaEliSunulur, yildizHesapla, yildizSiniri } from './ilerleme';
import type { Odul } from './ilerleme';
import { acikEnYuksek, anaYildiz, desenTamam, fitilAcik, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { guclendiriciKullan } from './envanter';
import { ozetBaslat, ozetHamle } from './ozet';
import type { OyunOzeti } from './ozet';
import { DESENLER } from '../app/katalog';
import { tarihEkle } from './takvim';
import { O, bosIst, ilerlet, kaybet, kazan } from './_test/yardimci';

const BUGUN = 20261014;

const tur = <T extends Odul['tur']>(o: Odul[], t: T) => o.filter((x): x is Extract<Odul, { tur: T }> => x.tur === t);

function derinDondur<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) derinDondur(v);
  }
  return o;
}

function oz(ek: Partial<OyunOzeti>): OyunOzeti {
  return { ...ozetBaslat(), ...ek };
}

describe('ilk kazanç, kilit, deneme', () => {
  it('1. bölüm: yıldız, sonraki bölüm, rozet; 1–4 sandık vermez', () => {
    const k0 = yeniKayit(1);
    const r = kazan(k0, 1, 2);
    expect(r.kayit.bolumler['1']).toMatchObject({ yildiz: 2, enIyi: 2000, deneme: 1, basarisizSeri: 0, kazanc: 1 });
    expect(tur(r.oduller, 'yildiz')).toEqual([{ tur: 'yildiz', bolumId: 1, onceki: 0, yeni: 2 }]);
    expect(tur(r.oduller, 'bolumAcildi')).toEqual([{ tur: 'bolumAcildi', bolumId: 2 }]);
    expect(tur(r.oduller, 'rozet').map((x) => x.rozet)).toEqual(['ilkKivilcim']);
    expect(tur(r.oduller, 'sandik')).toEqual([]);
    expect(tur(r.oduller, 'sandikBekliyor')).toEqual([]);
    expect(r.ozet).toMatchObject({ ilkKazanc: true, ilkDeneme: true, yildiz: 2, sandik: 0 });
    expect(acikEnYuksek(r.kayit)).toBe(2);
  });

  it('kilit doğrusal: kazanılmayan bölümün sonrası kapalı; yıldız ana yolu kilitlemez', () => {
    const k = ilerlet(3, 1);
    expect(bolumAcikMi(k, 4)).toBe(true);
    expect(bolumAcikMi(k, 5)).toBe(false);
    expect(acikEnYuksek(kaybet(k, 4).kayit)).toBe(4);
    expect(bolumAcikMi(k, 101)).toBe(false);
  });

  it('girdi kaydı değişmez (derin dondurulmuş)', () => {
    const k = derinDondur(ilerlet(9, 2));
    const once = JSON.stringify(k);
    expect(() => kazan(k, 10, 3, { tarih: BUGUN })).not.toThrow();
    expect(() => kaybet(k, 10, { tarih: BUGUN })).not.toThrow();
    expect(JSON.stringify(k)).toBe(once);
  });

  it('deneme sayacı ve siradakiDenemeNo; uygulamanın denemeNo\'su daha büyükse ona uyar', () => {
    let k = ilerlet(2, 1);
    expect(siradakiDenemeNo(k, 3)).toBe(0);
    k = kaybet(k, 3).kayit;
    k = kaybet(k, 3).kayit;
    expect(siradakiDenemeNo(k, 3)).toBe(2);
    k = kaybet(k, 3, { deneme: 9 }).kayit;
    expect(k.bolumler['3'].deneme).toBe(10);
  });

  it('Günün Şenliği: her deneme yeni denemeNo alır (K15 taze dolum)', () => {
    let k = ilerlet(10, 1);
    const gun = 20261015;
    expect(siradakiDenemeNo(k, gun)).toBe(0);
    k = kaybet(k, gun, { tarih: gun, tur: 'gunluk' }).kayit;
    expect(siradakiDenemeNo(k, gun)).toBe(1);
    k = kaybet(k, gun, { tarih: gun, tur: 'gunluk' }).kayit;
    expect(siradakiDenemeNo(k, gun)).toBe(2);
    expect(k.bolumler[String(gun)]).toBeUndefined();
  });

  it('yıldız sınırları: güçlendirici ≤ 2, Usta\'nın Eli ≤ 1, kayıpta 0', () => {
    expect(yildizSiniri(bosIst())).toBe(3);
    expect(yildizSiniri(bosIst({ guclendirici: 1 }))).toBe(2);
    expect(yildizSiniri(bosIst({ guclendirici: 1, ustaEli: true }))).toBe(1);
    expect(yildizHesapla(9000, [5200, 7400], bosIst())).toBe(3);
    expect(yildizHesapla(6000, [5200, 7400], bosIst())).toBe(2);
    expect(yildizHesapla(100, [5200, 7400], bosIst())).toBe(1);
    expect(yildizHesapla(9000, [5200, 7400], bosIst({ guclendirici: 1 }))).toBe(2);
    const k = ilerlet(1);
    expect(kazan(k, 2, 3, { ist: { guclendirici: 1 } }).kayit.bolumler['2'].yildiz).toBe(2);
    expect(kazan(k, 2, 9).kayit.bolumler['2'].yildiz).toBe(3);
  });
});

describe('sandık hakları (§10.4)', () => {
  it('5. bölümün ilk kazancı: sistem açılır, ilk sandık Kasımpatı (tamamlanır)', () => {
    const k = ilerlet(4);
    const r = kazan(k, 5, 1);
    const s = tur(r.oduller, 'sandik');
    expect(s.length).toBe(1);
    expect(s[0].sandik.neden).toBe('ilkKazanc');
    expect(s[0].sandik.cekilisler[0]).toMatchObject({ tur: 'parca', parca: 'd:kasimpati:2', tamamlandi: true, garanti: 'kasimpati' });
    expect(desenTamam(r.kayit, 'kasimpati')).toBe(true);
  });

  it('ilk kazanç 1★ → 1 sandık; sonra 3★ → 2 sandık (3. yıldızınki parlak); tekrar 3★ → yok', () => {
    let k = ilerlet(6);
    let r = kazan(k, 7, 1);
    expect(tur(r.oduller, 'sandik').map((x) => [x.sandik.neden, x.sandik.tur])).toEqual([['ilkKazanc', 'normal']]);
    k = r.kayit;
    r = kazan(k, 7, 3);
    expect(tur(r.oduller, 'sandik').map((x) => [x.sandik.neden, x.sandik.tur])).toEqual([
      ['yildiz', 'normal'],
      ['yildiz', 'parlak'],
    ]);
    expect(tur(r.oduller, 'sandik')[1].sandik.cekilisler.length).toBe(2);
    r = kazan(r.kayit, 7, 3);
    expect(tur(r.oduller, 'sandik')).toEqual([]);
    expect(tur(r.oduller, 'yildiz')).toEqual([]);
  });

  it('3★ ile ilk kazanç = 3 sandık (sonradan yükseltmekle aynı toplam)', () => {
    const r = kazan(ilerlet(6), 7, 3);
    expect(tur(r.oduller, 'sandik').map((x) => [x.sandik.neden, x.sandik.tur])).toEqual([
      ['ilkKazanc', 'normal'],
      ['yildiz', 'normal'],
      ['yildiz', 'parlak'],
    ]);
    expect(r.ozet.sandik).toBe(3);
  });

  it('kayıp sandık vermez; sayaç her sandıkta bir artar', () => {
    const k = ilerlet(6);
    expect(tur(kaybet(k, 7).oduller, 'sandik')).toEqual([]);
    const r = kazan(k, 7, 3);
    expect(r.kayit.sandik.sayac).toBe(k.sandik.sayac + 3);
  });
});

describe('Usta\'nın Eli ve Coşku Serisi', () => {
  it('4. başarısızlıkta Usta\'nın Eli sunulur; devam eden oyun yeni deneme sayılmaz, en fazla 1★', () => {
    let k = ilerlet(8);
    for (let i = 1; i <= 3; i++) {
      const r = kaybet(k, 9);
      expect(tur(r.oduller, 'ustaEli')).toEqual([]);
      k = r.kayit;
    }
    const r4 = kaybet(k, 9);
    expect(tur(r4.oduller, 'ustaEli').length).toBe(1);
    expect(r4.ozet.ustaEli).toBe(true);
    expect(ustaEliSunulur(r4.kayit, 9)).toBe(true);
    k = r4.kayit;
    expect(k.bolumler['9']).toMatchObject({ deneme: 4, basarisizSeri: 4 });
    // Eli ile devam edip kazandı
    const r5 = kazan(k, 9, 3, { ist: { ustaEli: true } });
    expect(r5.kayit.bolumler['9']).toMatchObject({ deneme: 4, basarisizSeri: 0, yildiz: 1 });
    expect(ustaEliSunulur(r5.kayit, 9)).toBe(false);
    // Eli ile devam edip yine kaybetti: ikinci kez sunulmaz, sayaçlar değişmez
    const r6 = kaybet(k, 9, { ist: { ustaEli: true } });
    expect(tur(r6.oduller, 'ustaEli')).toEqual([]);
    expect(r6.kayit.bolumler['9']).toMatchObject({ deneme: 4, basarisizSeri: 4 });
  });

  it('Eli devamı istatistiği ve görevleri ikinci kez saymaz (özet yalnız Eli sonrası)', () => {
    let k = ilerlet(8);
    for (let i = 1; i <= 4; i++) k = kaybet(k, 9, { ist: { toplamPatlama: 90 }, oz: { ...ozetBaslat(), toplamPatlama: 90 } }).kayit;
    const once = k.istatistik;
    // Devam: hiç hamle yapmadan bırakıldı (Duraklat > Haritaya dön) → hiçbir sayaç artmaz.
    const bos = kaybet(k, 9, { ist: { ustaEli: true, toplamPatlama: 90 }, oz: ozetBaslat() }).kayit;
    expect(bos.istatistik).toEqual(once);
    // Devam: 12 patlamayla kazandı → yalnız 12 eklenir, kayıp kazanca döner.
    const kaz = kazan(k, 9, 1, { ist: { ustaEli: true, toplamPatlama: 102 }, oz: { ...ozetBaslat(), toplamPatlama: 12 } }).kayit;
    expect(kaz.istatistik.toplamPatlama).toBe(once.toplamPatlama + 12);
    expect(kaz.istatistik.oyun).toBe(once.oyun);
    expect(kaz.istatistik.kazanc).toBe(once.kazanc + 1);
    expect(kaz.istatistik.kayip).toBe(once.kayip - 1);
  });

  it('üst üste 3 ilk deneme kazancı → hazır roket; kayıp sıfırlar; tekrar oynanış nötr', () => {
    let k = ilerlet(2, 1);
    expect(k.cosku).toBe(2);
    expect(coskuAktif(k)).toBe(false);
    let r = kazan(k, 3, 1);
    expect(tur(r.oduller, 'cosku')).toEqual([{ tur: 'cosku', seri: 3, aktif: true, bozuldu: false }]);
    k = r.kayit;
    expect(coskuAktif(k)).toBe(true);
    // Eski bölümü tekrar kazanmak seriyi değiştirmez
    r = kazan(k, 1, 3);
    expect(r.kayit.cosku).toBe(3);
    expect(tur(r.oduller, 'cosku')).toEqual([]);
    // Kayıp (ya da yeniden başlatma) sıfırlar
    r = kaybet(r.kayit, 4);
    expect(tur(r.oduller, 'cosku')).toEqual([{ tur: 'cosku', seri: 0, aktif: false, bozuldu: true }]);
    k = r.kayit;
    // İkinci denemede kazanmak seriyi başlatmaz
    r = kazan(k, 4, 1);
    expect(r.kayit.cosku).toBe(0);
    expect(r.ozet.ilkDeneme).toBe(false);
  });

  it('günlük bölüm Coşku\'ya dokunmaz', () => {
    let k = ilerlet(10, 1, yeniKayit(1), { tarih: BUGUN });
    const c = k.cosku;
    k = kaybet(k, BUGUN, { tarih: BUGUN }).kayit;
    expect(k.cosku).toBe(c);
  });
});

describe('açılışlar ve hediyeler', () => {
  it('Kibrit 6. bölüm kazanılınca açılır (7. bölümde kullanılır) ve 2 hediye; Kalıp 11, Geri Sar 19', () => {
    let k = ilerlet(5);
    let r = kazan(k, 6, 1);
    expect(tur(r.oduller, 'guclendiriciAcildi')).toEqual([{ tur: 'guclendiriciAcildi', guc: 'kibrit', verilen: { guc: 'kibrit', adet: 2, toz: 0 } }]);
    expect(r.kayit.guclendiriciler.kibrit).toBe(2);
    k = ilerlet(10, 1, r.kayit);
    r = kazan(k, 11, 1);
    expect(tur(r.oduller, 'guclendiriciAcildi')).toEqual([{ tur: 'guclendiriciAcildi', guc: 'kalip', verilen: { guc: 'kalip', adet: 1, toz: 0 } }]);
    expect(r.kayit.guclendiriciler.kalip).toBeGreaterThanOrEqual(1); // sandıktan da gelebilir
    k = ilerlet(18, 1, r.kayit);
    r = kazan(k, 19, 1);
    expect(tur(r.oduller, 'guclendiriciAcildi').map((x) => x.guc)).toEqual(['geriSar']);
    // Hediye bir kez
    expect(tur(kazan(r.kayit, 19, 3).oduller, 'guclendiriciAcildi')).toEqual([]);
  });

  it('stok sınırı 3: taşan hediye adet başına 2 toza döner', () => {
    const k = ilerlet(5);
    k.hediyeler = [];
    const r = kazan(k, 6, 1);
    expect(r.kayit.guclendiriciler.kibrit).toBe(2);
    const k2 = ilerlet(5);
    k2.hediyeler = [];
    k2.guclendiriciler.kibrit = 0;
    // Stokta 2 varken 2 hediye: 1 girer, 1 → 2 toz
    const k3 = { ...k2, guclendiriciler: { ...k2.guclendiriciler, kibrit: 2 } } as Kayit;
    const r3 = kazan(k3, 6, 1);
    expect(r3.kayit.guclendiriciler.kibrit).toBe(3);
    expect(tur(r3.oduller, 'guclendiriciAcildi')[0].verilen).toEqual({ guc: 'kibrit', adet: 1, toz: 2 });
  });

  it('güçlendirici kullanımı stoğu düşürür; stok yoksa null', () => {
    const k = ilerlet(6);
    const y = guclendiriciKullan(k, 'kibrit')!;
    expect(y.guclendiriciler.kibrit).toBe(1);
    expect(k.guclendiriciler.kibrit).toBe(2);
    expect(guclendiriciKullan(k, 'kalip')).toBeNull();
  });

  it('mahalle tamamlama: gökyüzü, defter kartı, her güçlendiriciden 1 (kapalılar toza)', () => {
    const k = ilerlet(4);
    const r = kazan(k, 5, 1);
    const m = tur(r.oduller, 'mahalleTamam');
    expect(m).toEqual([{ tur: 'mahalleTamam', mahalle: 0, gokyuzu: 'ayIsigi', kart: 'defter:iskele' }]);
    expect(tur(r.oduller, 'guclendirici').map((x) => x.verilen)).toEqual([
      { guc: 'kibrit', adet: 0, toz: 2 },
      { guc: 'kalip', adet: 0, toz: 2 },
      { guc: 'geriSar', adet: 0, toz: 2 },
    ]);
    expect(r.kayit.koleksiyon.gokyuzuler).toEqual(['ayIsigi']);
    expect(r.kayit.koleksiyon.kartlar).toEqual(['defter:iskele']);
    // Çarşı: kibrit açık → stoğa, kalıp/geri sar kapalı → toz
    const r2 = kazan(ilerlet(9), 10, 1);
    expect(tur(r2.oduller, 'mahalleTamam')[0]).toMatchObject({ mahalle: 1, gokyuzu: 'laleMoru' });
    expect(tur(r2.oduller, 'guclendirici').map((x) => [x.verilen.guc, x.verilen.adet])).toEqual([
      ['kibrit', 1],
      ['kalip', 0],
      ['geriSar', 0],
    ]);
  });

  it('efsane kartı: mahallenin tamamı 3★ (Usta Çırak rozetiyle)', () => {
    let k = ilerlet(5, 2);
    expect(k.koleksiyon.kartlar).toEqual(['defter:iskele']);
    for (let id = 1; id <= 4; id++) k = kazan(k, id, 3).kayit;
    const r = kazan(k, 5, 3);
    expect(tur(r.oduller, 'efsane')).toEqual([{ tur: 'efsane', mahalle: 0, kart: 'efsane:iskele' }]);
    expect(tur(r.oduller, 'rozet').map((x) => x.rozet)).toContain('ustaCirak');
  });

  it('Usta Bölümleri her 15★ (ana yıldız)', () => {
    let k = ilerlet(4, 3); // 12★
    let r = kazan(k, 5, 3); // 15★
    expect(tur(r.oduller, 'ustaAcildi')).toEqual([{ tur: 'ustaAcildi', bolumId: 101, ustaNo: 1, yildiz: 15 }]);
    expect(bolumAcikMi(r.kayit, 101)).toBe(true);
    expect(bolumAcikMi(r.kayit, 102)).toBe(false);
    k = ilerlet(10, 3, r.kayit);
    expect(anaYildiz(k)).toBe(30);
    expect(bolumAcikMi(k, 102)).toBe(true);
    // Usta kazancı Usta kilidini etkilemez
    r = kazan(k, 101, 3);
    expect(tur(r.oduller, 'ustaAcildi')).toEqual([]);
    expect(r.kayit.bolumler['101'].yildiz).toBe(3);
  });

  it('Günün Şenliği 10. bölümle, Sonsuz Şenlik 40. bölümle açılır', () => {
    const r = kazan(ilerlet(9), 10, 1, { tarih: BUGUN });
    expect(tur(r.oduller, 'gunlukAcildi').length).toBe(1);
    expect(r.kayit.gunluk.tarih).toBe(BUGUN);
    expect(r.kayit.gunluk.gorevler.length).toBe(3);
    const k40 = ilerlet(39);
    const r40 = kazan(k40, 40, 1);
    expect(tur(r40.oduller, 'sonsuzAcildi').length).toBe(1);
    expect(tur(r40.oduller, 'bolumAcildi')).toEqual([]);
    expect(bolumAcikMi(r40.kayit, 1_000_001)).toBe(true);
    expect(bolumAcikMi(r40.kayit, 1_000_002)).toBe(false);
    const s = kazan(r40.kayit, 1_000_001, 2);
    expect(s.kayit.sonsuzEnYuksek).toBe(1);
    expect(bolumAcikMi(s.kayit, 1_000_002)).toBe(true);
  });

  it('Işık Deseni motifi kazançta asılır (bir kez)', () => {
    const k = ilerlet(25);
    const r = kazan(k, 26, 1, { motif: 'lale' });
    expect(tur(r.oduller, 'motif')).toEqual([{ tur: 'motif', motif: 'lale' }]);
    expect(tur(kazan(r.kayit, 26, 2, { motif: 'lale' }).oduller, 'motif')).toEqual([]);
    expect(tur(kaybet(k, 26, { motif: 'lale' }).oduller, 'motif')).toEqual([]);
  });
});

describe('rekorlar ve istatistik', () => {
  it('bölüm puanı rekoru ve tek hamle rekorları (önceki > 0 iken YENİ REKOR)', () => {
    let k = ilerlet(3);
    let r = bolumSonucu(k, { bolumId: 3, kazandi: true, puan: 5000, yildiz: 2, istatistik: bosIst(), olaylarOzeti: oz({ enBuyukReaksiyon: 12, enUzunZincir: 7 }) });
    expect(tur(r.oduller, 'yeniRekor')).toEqual([{ tur: 'yeniRekor', alan: 'bolumPuani', onceki: 1000, yeni: 5000 }]);
    expect(r.kayit.rekorlar.enBuyukReaksiyon).toBe(12);
    k = r.kayit;
    r = bolumSonucu(k, { bolumId: 2, kazandi: true, puan: 10, yildiz: 1, istatistik: bosIst(), olaylarOzeti: oz({ enBuyukReaksiyon: 20 }) });
    expect(tur(r.oduller, 'yeniRekor')).toEqual([{ tur: 'yeniRekor', alan: 'enBuyukReaksiyon', onceki: 12, yeni: 20 }]);
    expect(r.ozet.yeniRekor).toBe(true);
  });

  it('istatistik toplamları (özet + çekirdek istatistiği, büyük olan)', () => {
    const k = ilerlet(3);
    const r = bolumSonucu(k, {
      bolumId: 4,
      kazandi: true,
      puan: 100,
      yildiz: 3,
      istatistik: bosIst({ halkaSayisi: 2, kafesKirilan: 3 }),
      olaylarOzeti: oz({ toplamPatlama: 40, halka: 1, roketAtesi: 2, kombolar: ['bahce'] }),
    });
    expect(r.kayit.istatistik).toMatchObject({ oyun: 4, kazanc: 4, toplamPatlama: 40, toplamHalka: 2, roket: 2, kombinasyon: 1, kafes: 3, ucYildiz: 1 });
  });
});

describe('Gece Tablosu saklama', () => {
  const tabloOzeti = (n: number, R: number): OyunOzeti => {
    let o = ozetBaslat();
    const ol = [O.fitil([[0, 0], [1, 0], [2, 0]])];
    for (let i = 0; i < n; i++) ol.push(O.patlama(i % 7, i % 9, i % 5, { t: i * 20, neden: 'isi', nesil: 1 }));
    ol.push(O.reaksiyon(R));
    o = ozetHamle(o, ol);
    return o;
  };

  it('ilk kazançta saklanır; daha nadir gelirse değişir, değilse eskisi korunur (seçim arayüzde)', () => {
    const k = ilerlet(2);
    let r = kazan(k, 3, 1, { oz: tabloOzeti(10, 5) });
    let t = tur(r.oduller, 'tablo')[0];
    expect(t).toMatchObject({ saklandi: true, eskiNadirlik: null });
    expect(r.kayit.bolumler['3'].tablo).toBe(t.tablo.kod);
    expect(r.kayit.bolumler['3'].nadirlik).toBe(0);
    const ilk = r.kayit.bolumler['3'].tablo;
    // Aynı nadirlik: eskisi kalır
    r = kazan(r.kayit, 3, 1, { oz: tabloOzeti(12, 6) });
    t = tur(r.oduller, 'tablo')[0];
    expect(t).toMatchObject({ saklandi: false, eskiNadirlik: 0 });
    expect(r.kayit.bolumler['3'].tablo).toBe(ilk);
    // Şaheser (R ≥ 40): değişir ve rozet
    r = kazan(r.kayit, 3, 1, { oz: tabloOzeti(45, 41) });
    t = tur(r.oduller, 'tablo')[0];
    expect(t).toMatchObject({ saklandi: true, eskiNadirlik: 0 });
    expect(r.kayit.bolumler['3'].nadirlik).toBe(2);
    expect(tur(r.oduller, 'rozet').map((x) => x.rozet)).toEqual(expect.arrayContaining(['saheser', 'otuzluk', 'senlik']));
  });

  it('kayıpta ve tablo hammaddesi yokken tablo yok', () => {
    const k = ilerlet(2);
    expect(tur(kaybet(k, 3, { oz: tabloOzeti(10, 5) }).oduller, 'tablo')).toEqual([]);
    expect(tur(kazan(k, 3, 1).oduller, 'tablo')).toEqual([]);
  });
});

describe('Günün Şenliği, görevler, Fener Nöbeti', () => {
  const k10 = () => ilerlet(10, 1, yeniKayit(5), { tarih: BUGUN });

  it('ilk kazanç sandığı günde 1; 3★ ise parlak; arşiv sandık vermez ama en iyi skoru tutar', () => {
    const k = k10();
    const r = kazan(k, BUGUN, 3, { tarih: BUGUN, kalanHamle: 4, toplamHamle: 22, oz: oz({ reaksiyonlar: [1, 9, 16], enBuyukReaksiyon: 16 }) });
    const s = tur(r.oduller, 'sandik').filter((x) => x.sandik.neden === 'gunluk');
    expect(s.map((x) => x.sandik.tur)).toEqual(['parlak']);
    expect(r.kayit.gunluk.ilkKazanc).toBe(BUGUN);
    expect(r.kayit.gunluk.enIyi[String(BUGUN)]).toMatchObject({ puan: 3000, yildiz: 3, kazandi: true, kullanilan: 18, toplam: 22, enBuyuk: 16, izgara: '●▲■', deneme: 1 });
    expect(r.kayit.rekorlar.enIyiGunluk).toBe(3000);
    expect(r.kayit.istatistik.gunlukKazanc).toBe(1);
    // Aynı gün ikinci kazanç: sandık yok; daha düşük puan en iyiyi değiştirmez ama deneme sayılır
    const r2 = bolumSonucu(r.kayit, { bolumId: BUGUN, kazandi: true, puan: 100, yildiz: 1, istatistik: bosIst(), tarih: BUGUN });
    expect(tur(r2.oduller, 'sandik').filter((x) => x.sandik.neden === 'gunluk')).toEqual([]);
    expect(r2.kayit.gunluk.enIyi[String(BUGUN)]).toMatchObject({ puan: 3000, deneme: 2 });
    // Arşiv (dün): sandık yok, skor kaydedilir
    const dun = tarihEkle(BUGUN, -1);
    const r3 = kazan(r2.kayit, dun, 2, { tarih: BUGUN });
    expect(tur(r3.oduller, 'sandik').filter((x) => x.sandik.neden === 'gunluk')).toEqual([]);
    expect(r3.kayit.gunluk.enIyi[String(dun)]).toMatchObject({ kazandi: true, yildiz: 2 });
    expect(bolumAcikMi(r3.kayit, dun, BUGUN)).toBe(true);
    expect(bolumAcikMi(r3.kayit, tarihEkle(BUGUN, -8), BUGUN)).toBe(false);
    // Kayıp, kazançtan iyi sayılmaz
    const r4 = bolumSonucu(r3.kayit, { bolumId: BUGUN, kazandi: false, puan: 99999, yildiz: 0, istatistik: bosIst(), tarih: BUGUN });
    expect(r4.kayit.gunluk.enIyi[String(BUGUN)].puan).toBe(3000);
  });

  it('görev tamamlanınca sandık; üçü de tamamlanınca sonuncusu parlak (günde bir kez)', () => {
    let k = k10();
    // Bütün görevleri tek oyunda tamamlayacak bir özet
    const hepsi = oz({
      halka: 9,
      enBuyukReaksiyon: 50,
      renkPatlama: [99, 99, 99, 99, 99, 99],
      roketAtesi: 9,
      kasimpatiAtesi: 9,
      kombolar: ['bahce'],
      kafesKirilan: 9,
      dosemeAydinlanan: 99,
      enUzunZincir: 20,
      korukKullanim: 9,
      caprazRoketEngel: 9,
      kayaYokEdilen: 99,
      fenerToplanan: 9,
      finalRoket: 9,
      enCokNesil: 5,
      isiPatlamasi: 99,
    });
    // 9 ("3 bölüm kazan") için üç kazanç gerekebilir; 3 kez oyna
    const sandiklar: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = kazan(k, BUGUN, 3, { tarih: BUGUN, oz: hepsi });
      for (const s of tur(r.oduller, 'sandik').filter((x) => x.sandik.neden === 'gorev')) sandiklar.push(s.sandik.tur);
      k = r.kayit;
    }
    expect(k.gunluk.gorevler.every((g) => g.tamam)).toBe(true);
    expect(sandiklar.length).toBe(3);
    expect(sandiklar[2]).toBe('parlak');
    expect(sandiklar.slice(0, 2)).toEqual(['normal', 'normal']);
    expect(k.gunluk.ucGorevSandigi).toBe(true);
  });

  it('gün değişince görevler yenilenir (gunGiris); Fener Nöbeti oynanınca sayılır', () => {
    const k = k10();
    expect(k.gunluk.seri).toBe(1);
    const yarin = tarihEkle(BUGUN, 1);
    const g = gunGiris(k, yarin);
    expect(g.degisti).toBe(true);
    expect(g.kayit.gunluk.tarih).toBe(yarin);
    expect(g.kayit.gunluk.seri).toBe(1); // giriş seriyi saymaz
    const r = kaybet(g.kayit, 11, { tarih: yarin });
    expect(r.kayit.gunluk.seri).toBe(2);
    expect(tur(r.oduller, 'seri')[0].sonuc).toMatchObject({ onceki: 1, seri: 2 });
    expect(gunGiris(g.kayit, yarin).degisti).toBe(false);
  });

  it('basamak ödülleri: Çıra sandık, Meşale Kibrit + sandık, Fener her güçlendirici, Deniz Feneri fitili', () => {
    let k = ilerlet(25, 1);
    k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
    const odul: Odul[] = [];
    for (let i = 0; i < 30; i++) {
      const r = kaybet(k, 26, { tarih: tarihEkle(BUGUN, i) });
      odul.push(...r.oduller);
      k = r.kayit;
    }
    expect(tur(odul, 'seriBasamagi').map((x) => x.ad)).toEqual(['Kıvılcım', 'Çıra', 'Meşale', 'Fener', 'Deniz Feneri']);
    expect(tur(odul, 'sandik').filter((x) => x.sandik.neden === 'seri').length).toBe(2);
    expect(tur(odul, 'guclendirici').filter((x) => x.neden === 'seri').map((x) => x.verilen.guc)).toEqual(['kibrit', 'kibrit', 'kalip', 'geriSar']);
    expect(tur(odul, 'fitil')).toEqual([{ tur: 'fitil', fitil: 'denizFeneri' }]);
    expect(fitilAcik(k, 'denizFeneri')).toBe(true);
    expect(k.rozetler).toEqual(expect.arrayContaining(['nobetci', 'denizFeneri']));
  });

  it('sandık sistemi açılmadan gelen seri sandığı bekler; 5. bölümde Kasımpatı\'dan sonra açılır', () => {
    let k = yeniKayit(3);
    for (let i = 0; i < 3; i++) k = kaybet(k, 1, { tarih: tarihEkle(BUGUN, i) }).kayit;
    expect(k.sandik.bekleyen).toEqual([{ tur: 'normal', neden: 'seri' }]);
    k = ilerlet(4, 1, k);
    const r = kazan(k, 5, 1);
    const s = tur(r.oduller, 'sandik');
    expect(s.map((x) => x.sandik.neden)).toEqual(['ilkKazanc', 'seri']);
    expect(s[0].sandik.cekilisler[0]).toMatchObject({ parca: 'd:kasimpati:2' });
    expect(r.kayit.sandik.bekleyen).toEqual([]);
  });
});

describe('rozetler (§10.6)', () => {
  const rozetler = (r: { oduller: Odul[] }) => tur(r.oduller, 'rozet').map((x) => x.rozet);

  it('olay özetinden: Çapraz Nişancı, Sar ve Pişir, Büyük Final, Roket Yağmuru, Körükçü, Domino', () => {
    const k = ilerlet(20);
    k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
    expect(rozetler(kazan(k, 21, 1, { oz: oz({ caprazRoketKafes: 3 }) }))).toContain('caprazNisanci');
    expect(rozetler(kazan(k, 21, 1, { oz: oz({ caprazRoketKafes: 2 }) }))).not.toContain('caprazNisanci');
    expect(rozetler(kaybet(k, 21, { oz: oz({ sarVePisir: true }) }))).toContain('sarVePisir');
    expect(rozetler(kaybet(k, 21, { oz: oz({ kombolar: ['buyukFinal', 'roketYagmuru'] }) }))).toEqual(expect.arrayContaining(['buyukFinal', 'roketYagmuru']));
    expect(rozetler(kaybet(k, 21, { oz: oz({ korukEnBuyukR: 10 }) }))).toContain('korukcu');
    expect(rozetler(kaybet(k, 21, { oz: oz({ korukEnBuyukR: 9 }) }))).not.toContain('korukcu');
    const d = kazan(k, 21, 1, { oz: oz({ izliDevFisek: 3 }) });
    expect(rozetler(d)).toContain('domino');
    expect(tur(d.oduller, 'rozet').find((x) => x.rozet === 'domino')!.verilen).toMatchObject({ guc: 'kalip', adet: 1 });
  });

  it('Kılpayı (son hamlede) ve Tutumlu (10+ kalan) yalnız kazançta', () => {
    const k = ilerlet(5);
    expect(rozetler(kazan(k, 6, 1, { kalanHamle: 0 }))).toContain('kilpayi');
    expect(rozetler(kazan(k, 6, 1, { kalanHamle: 1 }))).not.toContain('kilpayi');
    expect(rozetler(kazan(k, 6, 1))).not.toContain('kilpayi'); // bilinmiyor
    expect(rozetler(kazan(k, 6, 1, { kalanHamle: 10 }))).toContain('tutumlu');
    expect(rozetler(kaybet(k, 6, { kalanHamle: 0 }))).not.toContain('kilpayi');
  });

  it('kayıttan: Halkacı (toplam 50), Üçüncü Kuşak, Otuzluk/ŞENLİK!, Defterci; bir kez verilir', () => {
    let k = ilerlet(5);
    let r = kaybet(k, 6, { oz: oz({ halka: 30 }) });
    expect(rozetler(r)).not.toContain('halkaci');
    r = kaybet(r.kayit, 6, { oz: oz({ halka: 20 }) });
    expect(rozetler(r)).toContain('halkaci');
    r = kaybet(r.kayit, 6, { oz: oz({ halka: 20 }) });
    expect(rozetler(r)).not.toContain('halkaci');
    expect(rozetler(kaybet(k, 6, { oz: oz({ enCokNesil: 3 }) }))).toContain('ucuncuKusak');
    expect(rozetler(kaybet(k, 6, { oz: oz({ enBuyukReaksiyon: 30 }) }))).toEqual(['otuzluk']);
    // Defterci: baştan açık üçü dışında 12 desen
    k = ilerlet(6);
    const toplanacak = DESENLER.filter((d) => !d.baslangicta).slice(0, 12);
    for (const d of toplanacak.slice(0, 11)) for (let i = 0; i < 3; i++) k.koleksiyon.parcalar.push(`d:${d.id}:${i}`);
    expect(rozetler(kaybet(k, 7))).not.toContain('defterci');
    for (let i = 0; i < 3; i++) k.koleksiyon.parcalar.push(`d:${toplanacak[11].id}:${i}`);
    expect(rozetler(kaybet(k, 7))).toContain('defterci');
  });
});
