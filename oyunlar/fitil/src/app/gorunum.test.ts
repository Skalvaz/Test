/**
 * Uygulama görünüm modeli eşlemeleri (P5): meta/çekirdek → arayüz VM.
 * DOM'suz; gerçek bölüm verisi ve meta kayıt akışıyla.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from '../core/index';
import { bolumGetir } from '../levels/index';
import * as meta from '../meta';
import { ilerlet, kazan } from '../meta/_test/yardimci';
import { bolumOncesiVM, coskuRoketi, gunlukVM, haritaVM, hedefVM, hudVM, kaybettinVM, mahalleOdulleri, nasilVM, odulDuyurulari, sandiklarVM, yeniOge } from './gorunum';

describe('harita eşlemesi', () => {
  it('kazanılan → acik, sıradaki → simdiki, gerisi kilitli; 40 düğüm ve 8 Usta', () => {
    const k = ilerlet(3, 2);
    const vm = haritaVM(k, { parca: 0, rozet: 0 });
    expect(vm.bolumler).toHaveLength(40);
    expect(vm.ustalar).toHaveLength(8);
    expect(vm.bolumler.slice(0, 4).map((b) => b.durum)).toEqual(['acik', 'acik', 'acik', 'simdiki']);
    expect(vm.bolumler[4].durum).toBe('kilitli');
    expect(vm.toplamYildiz).toBe(6);
    expect(vm.sonsuz?.acik).toBe(false);
  });

  it('yenilik noktaları görülen sayılara göre', () => {
    const k = meta.yeniKayit(1);
    const vm = haritaVM(k, { parca: k.koleksiyon.parcalar.length - 1, rozet: 0 });
    expect(vm.defterYeni).toBe(true);
    expect(vm.rozetYeni).toBe(false);
  });
});

describe('oyun ve sonuç modelleri', () => {
  it('HUD: güçlendirici yalnız açık, stoklu ve girdi açıkken basılabilir; kullanıldıysa sınır 2★', () => {
    const v = bolumGetir(8)!;
    const d = bolumuYukle(v, 0);
    const k = { ...ilerlet(7), guclendiriciler: { kibrit: 2, kalip: 0, geriSar: 0 } };
    const vm = hudVM({ v, d, kayit: k, girdiAcik: true, geriSarHazir: false });
    const kib = vm.guclendiriciler.find((g) => g.id === 'kibrit')!;
    expect(kib.acik && kib.kullanilabilir).toBe(true);
    expect(vm.guclendiriciler.find((g) => g.id === 'kalip')!.acik).toBe(false);
    expect(hudVM({ v, d, kayit: k, girdiAcik: false, geriSarHazir: false }).guclendiriciler[0].kullanilabilir).toBe(false);
    const d2 = { ...d, istatistik: { ...d.istatistik, guclendirici: 1 } };
    const vm2 = hudVM({ v, d: d2, kayit: k, girdiAcik: true, geriSarHazir: false });
    expect(vm2.yildizSiniri).toBe(2);
    expect(vm2.guclendiriciler.every((g) => !g.kullanilabilir)).toBe(true);
  });

  it('bölüm öncesi: gerçek hedef sayıları ve yeni öğe', () => {
    const v = bolumGetir(4)!;
    const d0 = bolumuYukle(v, 0);
    const vm = bolumOncesiVM(v, d0, meta.yeniKayit(1), false);
    expect(vm.hedefler[0]).toMatchObject({ tur: 'kafes', gerekli: 3, ilerleme: 0 });
    expect(vm.yeniOge).toBe('kafes');
    expect(vm.enIyi).toBeNull();
    expect(yeniOge(40)).toBeNull();
  });

  it('kaybettin: en az ilerlemeli hedef ve yüzde', () => {
    const v = bolumGetir(2)!;
    const d = bolumuYukle(v, 0);
    d.hedefler[0].ilerleme = 14;
    d.hedefler[1].ilerleme = 3;
    const vm = kaybettinVM(v, d, 'yok', false, false);
    expect(vm.enZorHedef).toMatchObject({ renk: 0, ilerleme: 3, gerekli: 15 });
    expect(vm.yuzde).toBeCloseTo((14 / 15 + 3 / 15) / 2);
  });

  it('hedef eşlemesi: renk, motif, eşik', () => {
    expect(hedefVM({ hedef: { tur: 'zincirleme', esik: 15, adet: 3 }, ilerleme: 1, gerekli: 3, tamam: false })).toMatchObject({ tur: 'zincirleme', esik: 15, gerekli: 3 });
    expect(hedefVM({ hedef: { tur: 'desen', motif: 'lale' }, ilerleme: 0, gerekli: 18, tamam: false }).motif).toBe('lale');
  });
});

describe('ödüller', () => {
  it('sandık parçaları adım adım sayılır; duyurular rozet ve açılışları içerir', () => {
    // 1–4 kazanılır, 5. bölümün ilk kazancı garanti Kasımpatı parçası verir (§10.4).
    const k4 = ilerlet(4, 1);
    const r = kazan(k4, 5, 1);
    const s = sandiklarVM(k4, r.oduller);
    expect(s.length).toBeGreaterThan(0);
    const kasimpati = s.flatMap((x) => x.oduller).find((o) => o.tur === 'desenParcasi' && o.id === 'kasimpati');
    expect(kasimpati).toMatchObject({ parca: 3, tekrar: false });
    const ilk = kazan(meta.yeniKayit(3), 1, 1);
    expect(odulDuyurulari(ilk.oduller).some((d) => d.metin.startsWith('Rozet:'))).toBe(true);
  });
});

describe('günlük ve nasıl oynanır', () => {
  it('günlük: bugünün sonucu paylaşım verisine, arşiv 7 güne', () => {
    let k = ilerlet(10, 1);
    const bugun = meta.tarihYyyymmdd(2026, 10, 14);
    k = meta.gunGiris(k, bugun).kayit;
    k = meta.bolumSonucu(k, { bolumId: bugun, kazandi: true, puan: 5000, yildiz: 2, istatistik: { ...bolumuYukle(bolumGetir(1)!, 0).istatistik, reaksiyonlar: [3, 9, 20] }, tarih: bugun, kalanHamle: 4, toplamHamle: 20 }).kayit;
    const vm = gunlukVM(k, bugun);
    expect(vm.kazanildi).toBe(true);
    expect(vm.paylasim).toMatchObject({ kullanilanHamle: 16, toplamHamle: 20 });
    expect(vm.paylasim!.reaksiyonlar).toEqual([0, 8, 15]);
    expect(vm.arsiv).toHaveLength(7);
    expect(vm.gorevler).toHaveLength(3);
  });

  it('nasıl oynanır: engeller ulaşılan bölüme göre açılır', () => {
    expect(nasilVM(meta.yeniKayit(1)).acikEngeller).toEqual([]);
    expect(nasilVM(ilerlet(11)).acikEngeller).toEqual(expect.arrayContaining(['kafes', 'islak', 'doseme', 'fener']));
    expect(nasilVM(ilerlet(11)).acikEngeller).not.toContain('kaya');
  });
});

describe('Coşku Serisi ve öğretim (§15)', () => {
  it('hazır roket öğretim bölümünde verilmez, tanıtımda verilir; duyuru da buna uyar', () => {
    const k = { ...ilerlet(3), cosku: 3 };
    expect(coskuRoketi(bolumGetir(4)!, k)).toBe(false);
    expect(coskuRoketi(bolumGetir(6)!, k)).toBe(true);
    const o: meta.Odul = { tur: 'cosku', seri: 3, aktif: true, bozuldu: false };
    expect(odulDuyurulari([o], { sonrakiBolum: 4 })).toEqual([]);
    expect(odulDuyurulari([o], { sonrakiBolum: 6 })).toHaveLength(1);
  });

  it('duyurular önem sırasıyla: mahalle ve açılanlar rozetten önce', () => {
    const d = odulDuyurulari([
      { tur: 'rozet', rozet: 'ilkKivilcim', ad: 'İlk Kıvılcım' },
      { tur: 'cosku', seri: 3, aktif: true, bozuldu: false },
      { tur: 'gunlukAcildi' },
    ]);
    expect(d.map((x) => x.ikon)).toEqual(['takvim', 'roket', 'rozet']);
  });
});

describe('mahalle ödülleri (Fener Koyu Defteri kartı)', () => {
  it('açılmamış güçlendirici "+1" görünmez; toz tek satırda toplanır', () => {
    const v = (guc: 'kibrit' | 'kalip' | 'geriSar', adet: number, toz: number): meta.Odul => ({ tur: 'guclendirici', neden: 'mahalle', verilen: { guc, adet, toz } });
    expect(mahalleOdulleri([v('kibrit', 0, 2), v('kalip', 0, 2), v('geriSar', 0, 2)])).toEqual([{ tur: 'toz', adet: 6 }]);
    expect(mahalleOdulleri([v('kibrit', 1, 0), v('kalip', 0, 2), v('geriSar', 0, 2), { tur: 'guclendirici', neden: 'rozet', verilen: { guc: 'kibrit', adet: 1, toz: 0 } }])).toEqual([
      { tur: 'guclendirici', id: 'kibrit', adet: 1 },
      { tur: 'toz', adet: 4 },
    ]);
  });

  it('gerçek akış: İskele (1–5) bitince kart kayıttaki stok ve tozla tutarlı', () => {
    const k0 = ilerlet(4);
    const r = kazan(k0, 5);
    const odul = mahalleOdulleri(r.oduller);
    const gucler = odul.filter((o) => o.tur === 'guclendirici');
    const toz = odul.find((o) => o.tur === 'toz');
    for (const g of gucler) if (g.tur === 'guclendirici') expect(r.kayit.guclendiriciler[g.id]).toBeGreaterThanOrEqual(g.adet);
    expect(gucler.length).toBe(0);
    expect(toz).toBeDefined();
  });
});
