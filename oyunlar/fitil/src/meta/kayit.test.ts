import { describe, expect, it } from 'vitest';
import { pickBetter } from '../platform/storage';
import type { SaveEnvelope } from '../platform/storage';
import {
  BASLANGIC_PARCALARI,
  ayarDegistir,
  ciftDokunusIpucuGoster,
  ciftDokunusIpucuSay,
  ilerlemeyiSifirla,
  ipucuGoruldu,
  ipuclariniSifirla,
  GOCLER,
  acikEnYuksek,
  anaYildiz,
  desenAcik,
  desenTamam,
  kayitCoz,
  kayitDeposuAyarlari,
  kayitGoc,
  kayitKoduCoz,
  kayitKoduSaglama,
  kayitKoduUret,
  kayitOnar,
  kayitYukle,
  progressScore,
  toplamYildiz,
  yeniKayit,
} from './kayit';
import type { Kayit } from './kayit';
import { KAYIT_ANAHTARI, KAYIT_SURUMU, ZARF_SURUMU } from './sabitler';
import { DESEN_PARCALARI } from './sandik';
import { ilerlet, kazan } from './_test/yardimci';

/** GDD §16.7'deki örnek şema (sürüm 1), birebir. */
const GDD_V1 = {
  surum: 1,
  kayitTohumu: 0,
  bolumler: { '1': { yildiz: 3, enIyi: 6200, deneme: 2, basarisizSeri: 0, tablo: 'AAAAAA==', nadirlik: 1 } },
  koleksiyon: { parcalar: [], takili: [], fitil: 'kenevir', gokyuzu: 'ayIsigi', motifler: [], kartlar: [] },
  toz: 0,
  guclendiriciler: { kibrit: 2, kalip: 0, geriSar: 0 },
  sandik: { sayac: 0, parcasizSeri: 0 },
  gunluk: { tarih: 20261014, gorevler: [], enIyi: {}, seri: 0, affedilenHafta: 0, sonGun: 20261013 },
  cosku: 0,
  rekorlar: {},
  rozetler: [],
  istatistik: {},
  ayarlar: {},
};

describe('varsayılan kayıt', () => {
  it('onarım gerektirmez ve sürüm günceldir', () => {
    const k = yeniKayit(42);
    expect(k.surum).toBe(KAYIT_SURUMU);
    expect(kayitOnar(k).onarilan).toEqual([]);
    expect(kayitOnar(JSON.parse(JSON.stringify(k))).kayit).toEqual(k);
  });

  it('tohum dışarıdan gelir ve yayılır (ardışık tohumlar ilişkisiz)', () => {
    expect(yeniKayit(1).kayitTohumu).toBe(yeniKayit(1).kayitTohumu);
    expect(yeniKayit(1).kayitTohumu).not.toBe(yeniKayit(2).kayitTohumu);
    expect(Number.isInteger(yeniKayit(-5).kayitTohumu)).toBe(true);
    expect(yeniKayit(NaN).kayitTohumu).toBe(yeniKayit(0).kayitTohumu);
  });

  it('başlangıç koleksiyonu: Palmiye ve Halka tam, Kasımpatı 2/3 ama açık', () => {
    const k = yeniKayit(1);
    expect(desenTamam(k, 'palmiye')).toBe(true);
    expect(desenTamam(k, 'halka')).toBe(true);
    expect(desenTamam(k, 'kasimpati')).toBe(false);
    expect(desenAcik(k, 'kasimpati')).toBe(true);
    expect(desenAcik(k, 'sogut')).toBe(false);
    expect(k.koleksiyon.takili).toEqual(['kasimpati', 'palmiye', 'halka']);
    expect(k.guclendiriciler).toEqual({ kibrit: 0, kalip: 0, geriSar: 0 });
  });
});

describe('onarım (bozuk alan → varsayılan)', () => {
  it('nesne olmayan kök', () => {
    for (const ham of [null, 5, 'x', [1, 2]]) {
      const r = kayitOnar(ham, 9);
      expect(r.kayit).toEqual(yeniKayit(9));
      expect(r.onarilan.length).toBeGreaterThan(0);
    }
  });

  it('alan alan onarım; sağlam alanlar korunur', () => {
    const k = ilerlet(6, 2);
    const bozuk = JSON.parse(JSON.stringify(k)) as Record<string, any>;
    bozuk.toz = -40;
    bozuk.guclendiriciler.kibrit = 12;
    bozuk.guclendiriciler.kalip = 'çok';
    bozuk.bolumler['3'].yildiz = 7;
    bozuk.bolumler['4'] = 'bozuk';
    bozuk.bolumler['abc'] = { yildiz: 1 };
    const yeniP = DESEN_PARCALARI.find((p) => !k.koleksiyon.parcalar.includes(p))!;
    bozuk.koleksiyon.parcalar.push('d:yokBoyle:0', 'd:sogut:5', 42, yeniP, yeniP);
    bozuk.koleksiyon.takili = ['palmiye', 'sogut', 'palmiye', 'kalp'];
    bozuk.koleksiyon.fitil = 'ejderKuyrugu';
    bozuk.koleksiyon.gokyuzu = 'kizilDuman';
    bozuk.rozetler = ['ilkKivilcim', 'uydurma', 'ilkKivilcim'];
    bozuk.ayarlar = { sfx: 3, palet: 'mor', mola: 30, hiz: 1.5 };
    bozuk.gunluk.seri = -1;
    bozuk.gunluk.sonGun = 20261332;
    bozuk.sandik = { sayac: 12.5, parcasizSeri: 9, kasimpatiVerildi: 'evet', bekleyen: [{ tur: 'altin', neden: 'gorev' }] };
    delete bozuk.istatistik;
    const { kayit: v, onarilan } = kayitOnar(bozuk);
    expect(v.toz).toBe(0);
    expect(v.guclendiriciler.kibrit).toBe(9); // satın alma sınırı (GUCLENDIRICI_SATIN_SINIRI)
    expect(v.guclendiriciler.kalip).toBe(0);
    expect(v.bolumler['3'].yildiz).toBe(3);
    expect(v.bolumler['4']).toBeUndefined();
    expect(v.bolumler['abc']).toBeUndefined();
    expect(v.bolumler['5']).toEqual(k.bolumler['5']);
    expect(v.koleksiyon.parcalar).toEqual([...k.koleksiyon.parcalar, yeniP]);
    expect(v.koleksiyon.takili).toEqual(['palmiye']);
    expect(v.koleksiyon.fitil).toBe('kenevir');
    expect(v.koleksiyon.gokyuzu).toBe('ayIsigi');
    expect(v.rozetler).toEqual(['ilkKivilcim']);
    expect(v.ayarlar.sfx).toBe(1);
    expect(v.ayarlar.palet).toBe('standart');
    expect(v.ayarlar.mola).toBe(30);
    expect(v.ayarlar.hiz).toBe(1.5);
    expect(v.gunluk.seri).toBe(0);
    expect(v.gunluk.sonGun).toBe(0);
    expect(v.sandik.sayac).toBe(12);
    expect(v.sandik.parcasizSeri).toBe(3);
    expect(v.sandik.kasimpatiVerildi).toBe(false);
    expect(v.sandik.bekleyen).toEqual([]);
    expect(v.istatistik.oyun).toBe(0);
    expect(v.kayitTohumu).toBe(k.kayitTohumu);
    for (const yol of ['toz', 'guclendiriciler.kibrit', 'bolumler.3.yildiz', 'bolumler.4', 'koleksiyon.parcalar', 'koleksiyon.takili', 'koleksiyon.fitil', 'rozetler', 'ayarlar.sfx', 'gunluk.seri', 'sandik.sayac']) {
      expect(onarilan).toContain(yol);
    }
    // Onarılmış kayıt yeniden onarım gerektirmez.
    expect(kayitOnar(v).onarilan).toEqual([]);
  });

  it('başlangıç parçaları silinse de geri gelir; tablo biçimi denetlenir', () => {
    const k = ilerlet(2, 3) as Kayit & Record<string, any>;
    const ham = JSON.parse(JSON.stringify(k));
    ham.koleksiyon.parcalar = [];
    ham.bolumler['1'].tablo = 'bu-tablo-degil';
    ham.bolumler['2'].tablo = 'AAAA'; // 3 bayt: 4'ün katı değil
    const { kayit } = kayitOnar(ham);
    for (const p of BASLANGIC_PARCALARI) expect(kayit.koleksiyon.parcalar).toContain(p);
    expect(kayit.bolumler['1'].tablo).toBeUndefined();
    expect(kayit.bolumler['2'].tablo).toBeUndefined();
  });

  it('tutarlılık: kazanılmış bölümde kazanç ≥ 1, deneme ≥ kazanç; boş takılı → başlangıç', () => {
    const ham = JSON.parse(JSON.stringify(yeniKayit(1)));
    ham.bolumler['1'] = { yildiz: 2, enIyi: 10, deneme: 0, basarisizSeri: 0, kazanc: 0 };
    ham.koleksiyon.takili = ['sogut'];
    const { kayit } = kayitOnar(ham);
    expect(kayit.bolumler['1'].kazanc).toBe(1);
    expect(kayit.bolumler['1'].deneme).toBe(1);
    expect(kayit.koleksiyon.takili).toEqual(['kasimpati', 'palmiye', 'halka']);
  });
});

describe('göç', () => {
  it('her sürümün bir göçü var (1 → güncel)', () => {
    for (let s = 1; s < KAYIT_SURUMU; s++) expect(typeof GOCLER[s]).toBe('function');
  });

  it('GDD §16.7 örneği (sürüm 1) taşınır ve veri korunur', () => {
    const r = kayitCoz(JSON.parse(JSON.stringify(GDD_V1)), 5);
    expect(r.gocler).toEqual(['1→2', '2→3']);
    expect(r.yeni).toBe(false);
    const k = r.kayit;
    expect(k.surum).toBe(KAYIT_SURUMU);
    expect(k.bolumler['1']).toMatchObject({ yildiz: 3, enIyi: 6200, deneme: 2, basarisizSeri: 0, kazanc: 1, nadirlik: 1 });
    expect(k.bolumler['1'].tablo).toBe('AAAAAA==');
    expect(k.guclendiriciler.kibrit).toBe(2);
    expect(k.gunluk.sonGun).toBe(20261013);
    expect(k.gunluk.tarih).toBe(0); // görevler yeniden seçilecek
    expect(k.kayitTohumu).toBe(0);
    // Boş takılı listesi → başlangıç takılıları
    expect(k.koleksiyon.takili.length).toBeGreaterThan(0);
    expect(kayitOnar(k).onarilan).toEqual([]);
  });

  it('1 → 2: türetilen alanlar (hediye, Kasımpatı, gökyüzü, kart, seri basamağı)', () => {
    const v1: Record<string, any> = JSON.parse(JSON.stringify(GDD_V1));
    for (let id = 1; id <= 12; id++) v1.bolumler[String(id)] = { yildiz: 2, enIyi: 100, deneme: 1, basarisizSeri: 0 };
    v1.koleksiyon.kartlar = ['iskele', 'carsi'];
    v1.gunluk.seri = 8;
    v1.gunluk.enIyi = { '20261013': 4200 };
    const g = kayitGoc(v1);
    const k = kayitOnar(g.ham).kayit;
    expect(k.hediyeler).toEqual(['kibrit', 'kalip']); // 13 açık: 7 ve 12 hediyeleri verilmiş say
    expect(k.sandik.kasimpatiVerildi).toBe(true);
    expect(k.koleksiyon.gokyuzuler).toEqual(['ayIsigi', 'laleMoru']);
    expect(k.koleksiyon.kartlar).toEqual(['defter:iskele', 'defter:carsi']);
    expect(k.gunluk.basamakOdulu).toBe(2); // Meşale (7) geçilmiş
    expect(k.gunluk.enUzunSeri).toBe(8);
    expect(k.gunluk.enIyi['20261013']).toMatchObject({ puan: 4200, kazandi: false });
    expect(k.bolumler['12'].kazanc).toBe(1);
  });

  it('sürümsüz nesne sürüm 1 sayılır; gelecek sürüm en iyi çabayla okunur', () => {
    const { surum: _s, ...surumsuz } = GDD_V1;
    void _s;
    expect(kayitGoc(surumsuz).gocler).toEqual(['1→2', '2→3']);
    const gelecek = { ...yeniKayit(3), surum: 99, yeniAlan: { x: 1 } };
    const r = kayitCoz(gelecek);
    expect(r.gelecekSurum).toBe(true);
    expect(r.kayit.surum).toBe(KAYIT_SURUMU);
    expect(r.kayit.kayitTohumu).toBe(yeniKayit(3).kayitTohumu);
  });
});

describe('yükleme ve SaveStore', () => {
  it('JSON metni, bozuk metin ve yedekler', () => {
    const k = ilerlet(3, 2);
    expect(kayitCoz(JSON.stringify(k)).kayit).toEqual(k);
    expect(kayitCoz('{bozuk', 4).yeni).toBe(true);
    const r = kayitYukle(['{bozuk', null, JSON.stringify(k)]);
    expect(r.kaynak).toBe(2);
    expect(r.kayit).toEqual(k);
    const bos = kayitYukle([undefined, '', 'x'], 11);
    expect(bos.kaynak).toBe(-1);
    expect(bos.kayit).toEqual(yeniKayit(11));
  });

  it('depo ayarları: anahtar, sabit zarf sürümü, ilerleme puanı', () => {
    const a = kayitDeposuAyarlari();
    expect(a.key).toBe(KAYIT_ANAHTARI);
    expect(a.version).toBe(ZARF_SURUMU);
    const k = ilerlet(7, 3);
    expect(a.progressScore(k)).toBe(progressScore(k));
  });

  it('progressScore = toplam yıldız·1000 + açık en yüksek bölüm', () => {
    const k0 = yeniKayit(1);
    expect(progressScore(k0)).toBe(1);
    const k = ilerlet(5, 2);
    expect(toplamYildiz(k)).toBe(10);
    expect(acikEnYuksek(k)).toBe(6);
    expect(progressScore(k)).toBe(10006);
    // Usta yıldızı da sayılır; Usta kilidi yalnız ana yıldıza bakar.
    const u = kazan(k, 101, 2).kayit;
    expect(toplamYildiz(u)).toBe(12);
    expect(anaYildiz(u)).toBe(10);
  });

  it('bulut ile tarayıcı arasında ilerisi kazanır (pickBetter)', () => {
    const geri = ilerlet(3, 1);
    const ileri = ilerlet(4, 1);
    const zarf = (k: Kayit, savedAt: number): SaveEnvelope<Kayit> => ({ v: ZARF_SURUMU, savedAt, progressScore: progressScore(k), data: k });
    expect(pickBetter(zarf(ileri, 1), zarf(geri, 999))!.data).toBe(ileri);
    expect(pickBetter(zarf(geri, 999), zarf(ileri, 1))!.data).toBe(ileri);
  });
});

describe('kayıt kodu (FTL1:)', () => {
  it('biçim: önek + base64 + 4 haneli sağlama; gidiş-dönüş', () => {
    const k = ilerlet(12, 3);
    const kod = kayitKoduUret(k);
    expect(kod.startsWith('FTL1:')).toBe(true);
    const govde = kod.slice(5, -4);
    expect(kod.slice(-4)).toMatch(/^\d{4}$/);
    expect(kod.slice(-4)).toBe(kayitKoduSaglama(govde));
    expect(govde).toMatch(/^[A-Za-z0-9+/]+=*$/);
    const r = kayitKoduCoz(kod);
    expect(r.tamam).toBe(true);
    if (!r.tamam) return;
    expect(r.kayit).toEqual(k);
    expect(r.onizleme).toMatchObject({ anaYildiz: 36, ustaYildiz: 0, enFazlaYildiz: 120, acikBolum: 13, mahalle: 'Liman', kazanilanBolum: 12, onarilan: 0 });
    expect(r.onizleme.tablo).toBe(0);
  });

  it('UTF-8 güvenli: Türkçe karakterli alanlar bozulmaz', () => {
    const k = yeniKayit(3);
    k.ipuclari.gorulen = ['Çapraz Yol — ğüşıöç İ', '★●▲■'];
    const r = kayitKoduCoz(kayitKoduUret(k));
    expect(r.tamam && r.kayit.ipuclari.gorulen).toEqual(['Çapraz Yol — ğüşıöç İ', '★●▲■']);
  });

  it('boşluk, satır sonu ve küçük harf önek tolere edilir', () => {
    const k = ilerlet(2, 1);
    const kod = kayitKoduUret(k);
    const bolunmus = 'ftl1:' + kod.slice(5).replace(/(.{40})/g, '$1\n ') + '  ';
    const r = kayitKoduCoz(bolunmus);
    expect(r.tamam).toBe(true);
  });

  it('hatalar: boş, önek, sağlama (tek karakter değişince), şema', () => {
    const kod = kayitKoduUret(ilerlet(2, 1));
    expect(kayitKoduCoz('').tamam).toBe(false);
    const h = (s: string) => {
      const r = kayitKoduCoz(s);
      return r.tamam ? 'tamam' : r.hata;
    };
    expect(h('   ')).toBe('bos');
    expect(h('XYZ1:abcd1234')).toBe('onek');
    expect(h(kod.slice(0, -1))).toBe('saglama');
    const i = 20;
    const degisik = kod.slice(0, i) + (kod[i] === 'A' ? 'B' : 'A') + kod.slice(i + 1);
    expect(h(degisik)).toBe('saglama');
    // Sağlaması doğru ama kayıt olmayan JSON
    const govde = Buffer.from(JSON.stringify({ merhaba: 1 })).toString('base64');
    expect(h(`FTL1:${govde}${kayitKoduSaglama(govde)}`)).toBe('sema');
    const bozukB64 = 'abc$';
    expect(h(`FTL1:${bozukB64}${kayitKoduSaglama(bozukB64)}`)).toBe('base64');
    const json = Buffer.from('{bozuk').toString('base64');
    expect(h(`FTL1:${json}${kayitKoduSaglama(json)}`)).toBe('json');
    const r = kayitKoduCoz('XYZ');
    expect(!r.tamam && r.mesaj.length).toBeGreaterThan(10);
  });

  it('tablolar hariç kod daha kısadır ve tabloları atar', () => {
    let k = yeniKayit(2);
    for (let id = 1; id <= 6; id++) k = kazan(k, id, 3).kayit;
    // Tablo için sahte kayıt (tam tablo testleri galeri testinde)
    k.bolumler['1'].tablo = Buffer.alloc(1000, 7).toString('base64');
    k.bolumler['1'].nadirlik = 1;
    const tam = kayitKoduUret(k);
    const kisa = kayitKoduUret(k, { tablolarHaric: true });
    expect(kisa.length).toBeLessThan(tam.length - 1000);
    const r = kayitKoduCoz(kisa);
    expect(r.tamam && r.kayit.bolumler['1'].tablo).toBeUndefined();
    expect(k.bolumler['1'].tablo).toBeDefined(); // girdi değişmedi
  });

  it('bozuk alanlı kod onarılarak alınır, önizleme onarım sayısını gösterir', () => {
    const k = ilerlet(3, 2) as unknown as Record<string, any>;
    k.toz = -1;
    const govde = Buffer.from(JSON.stringify(k)).toString('base64');
    const r = kayitKoduCoz(`FTL1:${govde}${kayitKoduSaglama(govde)}`);
    expect(r.tamam).toBe(true);
    if (r.tamam) {
      expect(r.kayit.toz).toBe(0);
      expect(r.onizleme.onarilan).toBeGreaterThan(0);
    }
  });
});

describe('ayar ve ipucu yardımcıları', () => {
  it('ayar değişikliği doğrulanır; geçersiz değer öncekinde kalır', () => {
    const k = yeniKayit(1);
    const a = ayarDegistir(k, { mola: 30, palet: 'renkKoru', sfx: 0.4 });
    expect(a.ayarlar).toMatchObject({ mola: 30, palet: 'renkKoru', sfx: 0.4 });
    expect(k.ayarlar.mola).toBe(45);
    const b = ayarDegistir(a, { mola: 17 as 30, sfx: 2, hiz: 1.5 });
    expect(b.ayarlar).toMatchObject({ mola: 30, sfx: 0.4, hiz: 1.5 });
    expect(ayarDegistir(a, { hareketiAzalt: true }).ayarlar.hareketiAzalt).toBe(true);
    expect(kayitOnar(b).onarilan).toEqual([]);
  });

  it('ipuçları: görülen balonlar, çift dokunuş ipucu 3 kez, sıfırlama', () => {
    let k = ipucuGoruldu(yeniKayit(1), 'b1:baslangic');
    expect(ipucuGoruldu(k, 'b1:baslangic')).toBe(k);
    expect(k.ipuclari.gorulen).toEqual(['b1:baslangic']);
    for (let i = 0; i < 3; i++) {
      expect(ciftDokunusIpucuGoster(k)).toBe(true);
      k = ciftDokunusIpucuSay(k);
    }
    expect(ciftDokunusIpucuGoster(k)).toBe(false);
    k = ipuclariniSifirla(k);
    expect(k.ipuclari).toEqual({ gorulen: [], ciftDokunus: 0 });
  });

  it('ilerlemeyi sıfırla ayarları korur', () => {
    const k = ayarDegistir(ilerlet(5, 3), { mola: 60, titresim: false });
    const s = ilerlemeyiSifirla(k, 99);
    expect(s.bolumler).toEqual({});
    expect(s.ayarlar).toEqual(k.ayarlar);
    expect(s.kayitTohumu).toBe(yeniKayit(99).kayitTohumu);
  });

  it('SaveStore zarfı da çözülür', () => {
    const k = ilerlet(3, 2);
    const zarf = { v: ZARF_SURUMU, savedAt: 5, progressScore: progressScore(k), data: k };
    expect(kayitCoz(zarf).kayit).toEqual(k);
    expect(kayitYukle([JSON.stringify(zarf)]).kayit).toEqual(k);
  });
});
