/**
 * Uygulama görünüm modeli eşlemeleri (P5): meta/çekirdek → arayüz VM.
 * DOM'suz; gerçek bölüm verisi ve meta kayıt akışıyla.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle } from '../core/index';
import { bolumGetir } from '../levels/index';
import * as meta from '../meta';
import { ilerlet, kazan } from '../meta/_test/yardimci';
import { bolumOncesiVM, coskuRoketi, gunlukVM, haritaVM, hedefVM, hudVM, kasabaVM, kaybettinVM, kazandinKancalari, mahalleOdulleri, muhurVMleri, nasilVM, odulDuyurulari, sandiklarVM, yeniOge } from './gorunum';

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

  it('(Kancalar) mühür sayısı, sancak ve kasaba süsleri haritaya taşınır', () => {
    let k = ilerlet(8, 3);
    k.bolumler['6'].muhur = 7;
    k.bolumler['7'].muhur = 0b010;
    const r = meta.kasabaIsYap(k, 'iskele.kayikFenerleri');
    if (!r.tamam) throw new Error(r.hata);
    k = r.kayit;
    const vm = haritaVM(k, { parca: 0, rozet: 0 });
    expect(vm.bolumler[2]).toEqual({ id: 3, yildiz: 3, durum: 'acik' });
    expect(vm.bolumler[5]).toMatchObject({ id: 6, muhur: 3, sancak: true });
    expect(vm.bolumler[6]).toMatchObject({ id: 7, muhur: 1, sancak: false });
    expect(vm.kasaba).toEqual({ acik: true, kandil: meta.kandilBakiyesi(k), isler: ['iskele.kayikFenerleri'], yapilabilir: true });
  });

  it('Usta ve Günün Şenliği kilitleri: yıldız açığı, 12. bölüm kapısı, 14. bölüm', () => {
    let k = ilerlet(11, 3); // 33★, 12 kazanılmadı
    let vm = haritaVM(k, { parca: 0, rozet: 0 });
    expect(vm.ustalar[0]).toEqual({ id: 101, acik: false, yildiz: 0, gerekenYildiz: 15, eksikYildiz: 0, kapiBolumu: 12 });
    expect(vm.ustalar[2]).toMatchObject({ acik: false, eksikYildiz: 12, kapiBolumu: 12 });
    expect(vm.gunluk).toEqual({ acik: false, tamam: 0, toplam: 0, acilisBolumu: 14 });
    k = kazan(k, 12, 1).kayit;
    vm = haritaVM(k, { parca: 0, rozet: 0 });
    expect(vm.ustalar.slice(0, 3).map((u) => u.acik)).toEqual([true, true, false]);
    expect(vm.ustalar[0].kapiBolumu).toBeUndefined();
    expect(vm.ustalar[2]).toMatchObject({ eksikYildiz: 11 });
    k = kazan(kazan(k, 13, 1).kayit, 14, 1, { tarih: 20261014 }).kayit;
    expect(haritaVM(k, { parca: 0, rozet: 0 }).gunluk).toMatchObject({ acik: true, toplam: 3 });
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
    let k = ilerlet(14, 1);
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

describe('(Kancalar) mühür, kasaba ve Kazandın eşlemeleri', () => {
  it('mühür satırları yalnız 6. bölüm kazanılınca ve mühürlü ana bölümde; anlık durum özetten', () => {
    const v7 = bolumGetir(7)!;
    const once = ilerlet(5, 2);
    expect(muhurVMleri(v7, once)).toBeUndefined();
    const k = ilerlet(7, 2);
    k.bolumler['7'].muhur = 0b001;
    const m = muhurVMleri(v7, k)!;
    expect(m.map((x) => [x.kademe, x.basili])).toEqual([['cirak', true], ['kalfa', false], ['usta', false]]);
    expect(m.every((x) => x.metin.length > 0 && x.durum === undefined)).toBe(true);
    const d0 = bolumuYukle(v7, 0);
    const anlik = muhurVMleri(v7, k, { oz: meta.ozetBaslat(), d: d0 })!;
    expect(anlik.every((x) => x.durum !== undefined)).toBe(true);
    expect(muhurVMleri(bolumGetir(3)!, k)).toBeUndefined();
    // HUD ve bölüm öncesi aynı satırları taşır.
    expect(bolumOncesiVM(v7, d0, k, false, 'ipucu').muhurler).toHaveLength(3);
    expect(bolumOncesiVM(v7, d0, k, false, 'ipucu').muhurIpucu).toBe('ipucu');
    expect(hudVM({ v: v7, d: d0, kayit: k, girdiAcik: true, geriSarHazir: false }).muhurler).toHaveLength(3);
    expect(hudVM({ v: v7, d: d0, kayit: once, girdiAcik: true, geriSarHazir: false }).muhurler).toBeUndefined();
  });

  it('Kazandın: yeni mühürler, tanıtım bir kez, sancak, kandil çipi', () => {
    const v6 = bolumGetir(6)!;
    const k = ilerlet(5, 3);
    const r = kazan(k, 6, 3, { muhurler: [true, false, false] });
    const vm = kazandinKancalari(v6, r, []);
    expect(vm.muhurler?.liste.map((x) => [x.basili, x.yeni])).toEqual([[true, true], [false, false], [false, false]]);
    expect(vm.muhurler?.tanitim).toBe(true);
    expect(kazandinKancalari(v6, r, [meta.KANCA_IPUCU.muhurTanitim]).muhurler?.tanitim).toBe(false);
    expect(vm.kandil).toMatchObject({ yeni: meta.kandilBakiyesi(r.kayit), tanitim: false, muhur: 1 });
    // 3. bölüm: kasaba açılır, tanıtım 0'dan sayar.
    const r3 = kazan(ilerlet(2, 2), 3, 3);
    const k3 = kazandinKancalari(bolumGetir(3)!, r3, []);
    expect(k3.kandil).toMatchObject({ onceki: 0, yeni: 7, tanitim: true });
    expect(k3.muhurler).toBeNull();
    expect(k3.kasabaHazir).toBe(false);
    // Tanıtım kazancında mühür basılmadıysa satır yok (7. bölüm kartı anlatır).
    expect(kazandinKancalari(v6, kazan(ilerlet(5, 3), 6, 3, { muhurler: [false, false, false] }), []).muhurler).toBeNull();
    // Sancak (3/3)
    const k7 = ilerlet(7, 2);
    k7.bolumler['7'].muhur = 0b011;
    const r7 = kazan(k7, 7, 2, { muhurler: [true, true, true] });
    expect(kazandinKancalari(bolumGetir(7)!, r7, []).muhurler?.sancak).toBe(true);
  });

  it('Kazandın tanıtımı: ipuçları kapalıyken ve muhur-kart görülmüşse (göç) yok; Eli notu', () => {
    const v6 = bolumGetir(6)!;
    const r = kazan(ilerlet(5, 3), 6, 3, { muhurler: [true, false, false] });
    expect(kazandinKancalari(v6, r, [], { ipuclari: false }).muhurler?.tanitim).toBe(false);
    expect(kazandinKancalari(v6, r, [meta.KANCA_IPUCU.muhurKart]).muhurler?.tanitim).toBe(false);
    expect(kazandinKancalari(v6, r, []).muhurler?.ustaEli).toBeUndefined();
    expect(kazandinKancalari(v6, r, [], { ustaEli: true }).muhurler?.ustaEli).toBe(true);
  });

  it('Duraklat ilerlemesi: bekleyen sayaçta değer/eşik, tek hamlede en iyi; tutanda yok', () => {
    const v21 = bolumGetir(21)!;
    const k = ilerlet(21, 2);
    const d0 = bolumuYukle(v21, 0);
    const iz = (halka: boolean, doseme: number): meta.HamleIzi[] => [
      {
        eylem: 'fitil', zincir: 5, renk: 0, halka, R: 0, nesil: 0, patlama: 5, renkPatlama: [5, 0, 0, 0, 0, 0], isiPatlamasi: 0, olusan: 'yok',
        roket: 0, kasimpati: 0, yildiz: 0, caprazRoket: 0, kombolar: [], kafes: 0, kaya: 0, engelHasar: 0, doseme, desen: 0, is: 0, fener: 0,
        devFisek: 0, izliDevFisek: 0, caprazEngel: 0, kurutma: 0,
      },
    ];
    const oz = { ...meta.ozetBaslat(), hamleIzleri: [...iz(true, 4), ...iz(true, 7)] };
    const m = muhurVMleri(v21, k, { oz, d: d0 })!;
    // Çırak "Tek hamlede 10 döşeme": en iyi 7/10; Usta "4 halka çiz": 2/4.
    expect(m[0].durum).toBe('bekliyor');
    expect(m[0].ilerleme).toEqual({ deger: 7, hedef: 10, tek: true });
    expect(m[2].ilerleme).toEqual({ deger: 2, hedef: 4, tek: false });
    // Bölüm öncesi (özetsiz) satırlarda ilerleme yok.
    expect(muhurVMleri(v21, k)!.every((x) => x.ilerleme === undefined)).toBe(true);
    // Tutunca ilerleme yazısı kalkar.
    const tam = { ...meta.ozetBaslat(), hamleIzleri: [...iz(true, 10), ...iz(true, 0), ...iz(true, 0), ...iz(true, 0)] };
    const m2 = muhurVMleri(v21, k, { oz: tam, d: d0 })!;
    expect(m2[0].durum).toBe('tuttu');
    expect(m2[0].ilerleme).toBeUndefined();
    expect(m2[2].durum).toBe('tuttu');
  });

  it('kasaba paneli: süslenen mahalle seçili, durumlar meta ile aynı, sıra ve harita kilidi', () => {
    let k = ilerlet(7, 3);
    let vm = kasabaVM(k);
    expect(vm.secili).toBe(0);
    expect(vm.ogretim).toBe(true);
    expect(vm.kandil).toBe(meta.kandilBakiyesi(k));
    expect(vm.mahalleler).toHaveLength(8);
    expect(vm.mahalleler[0].isler.map((x) => x.durum)).toEqual(['yapilabilir', 'yapilabilir', 'yapilabilir', 'yapilabilir', 'yapilabilir', 'tacKilitli']);
    expect(vm.mahalleler[0].isler[5].tac).toBe(true);
    expect(vm.mahalleler[1]).toMatchObject({ acik: true, sirada: false });
    expect(vm.mahalleler[2].acik).toBe(false);
    for (const is of meta.mahalleIsleri(0)) {
      const r = meta.kasabaIsYap(k, is.id);
      if (!r.tamam) throw new Error(r.hata);
      k = r.kayit;
    }
    vm = kasabaVM(k);
    expect(vm.secili).toBe(1);
    expect(vm.ogretim).toBe(false);
    expect(vm.mahalleler[0].yapilan).toBe(6);
    expect(vm.mahalleler[1].sirada).toBe(true);
  });

  it('mühür parçası Kazandın duyurusunda ilk sırada', () => {
    const d = odulDuyurulari([
      { tur: 'rozet', rozet: 'halkaci', ad: 'Halkacı' },
      { tur: 'muhurParcasi', mahalle: 1, esik: 5, fitil: 'laleDali', parca: 'f:laleDali:0', toz: 0 },
    ]);
    expect(d[0].metin).toBe('Lale Dalı parçası (5 mühür)');
  });
});
