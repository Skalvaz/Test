import { describe, expect, it } from 'vitest';
import { KARTLAR, MOTIFLER, defterOzeti, desenCikar, desenDurumlari, desenTak, fitilDurumlari, fitilSec, gokyuzuDurumlari, gokyuzuSec, kartDurumlari, motifDurumlari, tabloListesi, takiliAyarla, toplananDesenSayisi } from './defter';
import { haritaVerisi, USTA_BOLUMLERI } from './harita';
import { kayitOnar, yeniKayit } from './kayit';
import { MOLA_ARA_MS, molaAyarDegisti, molaBaslat, molaIlerle, molaKapat, molayaKalan } from './mola';
import type { MolaDurumu } from './mola';
import { ilerlet, kaybet, kazan } from './_test/yardimci';
import { MAHALLELER } from '../app/katalog';

describe('Fişek Defteri', () => {
  it('başlangıç görünümü', () => {
    const k = yeniKayit(1);
    const d = desenDurumlari(k);
    expect(d.length).toBe(24);
    expect(d.filter((x) => x.acik).map((x) => x.id)).toEqual(['kasimpati', 'palmiye', 'halka']);
    expect(d.find((x) => x.id === 'kasimpati')).toMatchObject({ parcalar: [true, true, false], tamam: false, acik: true, takili: true });
    const f = fitilDurumlari(k);
    expect(f.filter((x) => x.acik).map((x) => x.id)).toEqual(['kenevir']);
    expect(f.find((x) => x.id === 'kenevir')).toMatchObject({ secili: true, tamam: true });
    expect(gokyuzuDurumlari(k).filter((x) => x.acik).map((x) => x.id)).toEqual(['ayIsigi']);
    expect(defterOzeti(k)).toMatchObject({ desen: { tamam: 2, toplam: 24, parca: 8, parcaToplam: 72 }, fitil: { acik: 1, toplam: 9 }, gokyuzu: { kazanildi: 0, toplam: 8 }, kart: { acik: 0, toplam: 16 }, toz: 0, tozParca: 0 });
    expect(toplananDesenSayisi(k)).toBe(0);
  });

  it('takılı desenler: en fazla 6, yalnız açık, en az 1', () => {
    let k = yeniKayit(1);
    expect(desenTak(k, 'sogut')).toEqual({ tamam: false, hata: 'kapali' });
    for (const id of ['sogut', 'ciftHalka', 'kalp', 'spiral'] as const) for (let i = 0; i < 3; i++) k.koleksiyon.parcalar.push(`d:${id}:${i}`);
    for (const id of ['sogut', 'ciftHalka', 'kalp'] as const) {
      const r = desenTak(k, id);
      expect(r.tamam).toBe(true);
      if (r.tamam) k = r.kayit;
    }
    expect(k.koleksiyon.takili.length).toBe(6);
    expect(desenTak(k, 'spiral')).toEqual({ tamam: false, hata: 'dolu' });
    const c = desenCikar(k, 'palmiye');
    expect(c.tamam && c.kayit.koleksiyon.takili).toEqual(['kasimpati', 'halka', 'sogut', 'ciftHalka', 'kalp']);
    expect(takiliAyarla(k, [])).toEqual({ tamam: false, hata: 'sonDesen' });
    expect(takiliAyarla(k, ['palmiye', 'palmiye'])).toMatchObject({ tamam: true });
    const tek = takiliAyarla(k, ['halka']);
    expect(tek.tamam && desenCikar(tek.kayit, 'halka')).toEqual({ tamam: false, hata: 'sonDesen' });
    expect(takiliAyarla(k, ['yildiz'])).toEqual({ tamam: false, hata: 'kapali' });
    expect(takiliAyarla(k, ['kasimpati', 'palmiye', 'halka', 'sogut', 'ciftHalka', 'kalp', 'spiral'])).toEqual({ tamam: false, hata: 'dolu' });
  });

  it('fitil ve gökyüzü seçimi yalnız açık olanlar', () => {
    const k = yeniKayit(1);
    expect(fitilSec(k, 'altinTel')).toEqual({ tamam: false, hata: 'kapali' });
    k.koleksiyon.parcalar.push('f:altinTel:0', 'f:altinTel:1', 'f:altinTel:2');
    const f = fitilSec(k, 'altinTel');
    expect(f.tamam && f.kayit.koleksiyon.fitil).toBe('altinTel');
    expect(gokyuzuSec(k, 'laleMoru')).toEqual({ tamam: false, hata: 'kapali' });
    const m = ilerlet(10);
    const g = gokyuzuSec(m, 'laleMoru');
    expect(g.tamam && g.kayit.koleksiyon.gokyuzu).toBe('laleMoru');
    expect(gokyuzuSec(m, 'ayIsigi').tamam).toBe(true);
  });

  it('kartlar: 8 defter + 8 efsane, her biri ≤ 4 cümle; mahalle tamamlanınca açılır', () => {
    expect(KARTLAR.length).toBe(16);
    for (const c of KARTLAR) {
      // Cümle sonu: rakam/Roma rakamından sonra gelmeyen nokta + boşluk + büyük harf (ya da metin sonu).
      const cumle = c.metin.split(/(?<![0-9IVX])[.!?](?=\s+[A-ZÇĞİÖŞÜ]|$)/).filter((x) => x.trim().length > 0);
      expect(cumle.length).toBeLessThanOrEqual(4);
      expect(c.id).toBe(`${c.tur}:${MAHALLELER[c.mahalle].id}`);
    }
    const k = ilerlet(5);
    expect(kartDurumlari(k).filter((x) => x.acik).map((x) => x.id)).toEqual(['defter:iskele']);
    // Onarım kart kimliklerini tanır
    expect(kayitOnar(k).onarilan).toEqual([]);
  });

  it('motifler ve tablolar', () => {
    expect(MOTIFLER.map((m) => m.id)).toEqual(['lale', 'kayik', 'fener', 'carkifelek', 'mart', 'burc']);
    const k = kazan(ilerlet(25), 26, 1, { motif: 'lale' }).kayit;
    expect(motifDurumlari(k).filter((m) => m.asili).map((m) => m.id)).toEqual(['lale']);
    k.bolumler['3'].tablo = 'AAAAAA==';
    k.bolumler['3'].nadirlik = 2;
    k.bolumler['1'].tablo = 'AAAAAA==';
    expect(tabloListesi(k).map((t) => [t.bolumId, t.nadirlik])).toEqual([
      [1, 0],
      [3, 2],
    ]);
    expect(defterOzeti(k).tablo).toEqual({ sayi: 2, parlak: 0, saheser: 1 });
  });
});

describe('harita görünüm verisi', () => {
  it('düğüm sırası: 5 bölüm + Usta, 8 mahalle', () => {
    const h = haritaVerisi(yeniKayit(1));
    expect(h.dugumler.length).toBe(48);
    expect(h.dugumler.slice(0, 6).map((d) => (d.tur === 'usta' ? `U${d.ustaNo}` : d.id))).toEqual([1, 2, 3, 4, 5, 'U1']);
    expect(h.dugumler.map((d) => d.yolSirasi)).toEqual(Array.from({ length: 48 }, (_, i) => i));
    expect(h.dugumler[0]).toMatchObject({ tur: 'bolum', durum: 'acik', siradaki: true, pencere: 0 });
    expect(h.dugumler[1]).toMatchObject({ durum: 'kilitli' });
    expect(h.mahalleler.length).toBe(8);
    expect(h.enFazlaYildiz).toBe(120);
    expect(USTA_BOLUMLERI.length).toBe(8);
  });

  it('yıldızlar, pencere oranları, çatı fişeği, Usta kilidi, mahalle tamamlanma', () => {
    let k = ilerlet(4, 3);
    k = kazan(k, 5, 2).kayit;
    k = kazan(k, 6, 1).kayit;
    const h = haritaVerisi(k);
    const b = (id: number) => h.dugumler.find((d) => d.tur === 'bolum' && d.id === id)!;
    expect(b(1)).toMatchObject({ durum: 'kazanildi', yildiz: 3, pencere: 1, pencerePay: 3, catiFisegi: true });
    expect(b(5)).toMatchObject({ yildiz: 2, pencerePay: 2, catiFisegi: false });
    expect((b(5) as { pencere: number }).pencere).toBeCloseTo(2 / 3);
    expect(b(6)).toMatchObject({ yildiz: 1, siradaki: false });
    expect(b(7)).toMatchObject({ durum: 'acik', siradaki: true });
    expect(h.siradaki).toBe(7);
    const u1 = h.dugumler.find((d) => d.tur === 'usta' && d.ustaNo === 1)!;
    expect(u1).toMatchObject({ durum: 'acik', gerekenYildiz: 15, eksikYildiz: 0 });
    const u2 = h.dugumler.find((d) => d.tur === 'usta' && d.ustaNo === 2)!;
    expect(u2).toMatchObject({ durum: 'kilitli', gerekenYildiz: 30, eksikYildiz: 15 });
    expect(h.mahalleler[0]).toMatchObject({ tamam: true, ucYildiz: false, yildiz: 14, enFazlaYildiz: 15, defterKarti: true });
    expect(h.mahalleler[1]).toMatchObject({ acik: true, tamam: false });
    expect(h.mahalleler[2].acik).toBe(false);
    expect(h.anaYildiz).toBe(15);
  });

  it('motif tabelası mahallesinde; günlük ve coşku başlığı', () => {
    const k = kazan(ilerlet(25, 1, yeniKayit(2), { tarih: 20261014 }), 26, 1, { motif: 'lale', tarih: 20261014 }).kayit;
    const h = haritaVerisi(k);
    expect(h.mahalleler[5].motifler).toEqual(['lale']);
    expect(h.mahalleler[4].motifler).toEqual([]);
    expect(h.gunluk.acik).toBe(true);
    expect(h.gunluk.gorevToplam).toBe(3);
    expect(h.gunluk.seri).toBe(1);
    expect(h.gunluk.basamak).toBe('Kıvılcım');
    expect(h.gunluk.sonrakiBasamak).toEqual({ ad: 'Çıra', yonelme: "Çıra'ya", kalan: 2 });
    expect(h.cosku.aktif).toBe(true);
    expect(haritaVerisi(kaybet(k, 27).kayit).cosku).toEqual({ seri: 0, aktif: false });
  });

  it('bölüm sayısı parametre: 20 bölüm × 4 mahalle', () => {
    const ayar = { anaBolumSayisi: 20, bolumPerMahalle: 5, ustaIdleri: [101, 102] };
    const h = haritaVerisi(yeniKayit(1), { ayar });
    expect(h.mahalleler.length).toBe(4);
    expect(h.dugumler.filter((d) => d.tur === 'bolum').length).toBe(20);
    expect(h.dugumler.filter((d) => d.tur === 'usta').length).toBe(2);
    expect(h.enFazlaYildiz).toBe(60);
  });
});

describe('mola hatırlatıcısı', () => {
  const dk = 60_000;
  function oyna(d: MolaDurumu, bas: number, sure: number, adim = 1000, dakika: 0 | 30 | 45 | 60 = 45) {
    let goster = 0;
    for (let t = bas; t <= bas + sure; t += adim) {
      const r = molaIlerle(d, t, { dakika, gorunur: true });
      d = r.durum;
      if (r.goster) goster++;
    }
    return { d, goster };
  }

  it('45 dakika kesintisiz oyundan sonra bir kez gösterilir', () => {
    let r = oyna(molaBaslat(), 0, 44 * dk);
    expect(r.goster).toBe(0);
    r = oyna(r.d, 44 * dk + 1000, 2 * dk);
    expect(r.goster).toBe(1);
    r = oyna(r.d, 47 * dk, 30 * dk);
    expect(r.goster).toBe(0); // kapatılana dek tekrar yok
    // Kapatınca sayaç sıfırlanır; 45 dk sonra yeniden
    const d = molaKapat(r.d, 77 * dk);
    expect(molayaKalan(d, 45)).toBe(45 * dk);
    expect(oyna(d, 77 * dk, 46 * dk).goster).toBe(1);
  });

  it('30 / 60 / kapalı', () => {
    expect(oyna(molaBaslat(), 0, 31 * dk, 1000, 30).goster).toBe(1);
    expect(oyna(molaBaslat(), 0, 59 * dk, 1000, 60).goster).toBe(0);
    expect(oyna(molaBaslat(), 0, 120 * dk, 1000, 0).goster).toBe(0);
    expect(molayaKalan(molaBaslat(), 0)).toBeNull();
    expect(molaAyarDegisti({ ...molaBaslat(), gosterildi: true }, 0).gosterildi).toBe(false);
  });

  it('kısa gizlenme süreye eklenmez; 5 dk+ gizlilik ya da uyku gerçek moladır', () => {
    let d = oyna(molaBaslat(), 0, 40 * dk).d;
    expect(d.etkinMs).toBe(40 * dk);
    d = molaIlerle(d, 40 * dk + 1000, { dakika: 45, gorunur: false }).durum;
    d = molaIlerle(d, 43 * dk, { dakika: 45, gorunur: true }).durum;
    expect(d.etkinMs).toBe(40 * dk); // 3 dk gizli: eklenmedi, sıfırlanmadı
    d = molaIlerle(d, 43 * dk + 1000, { dakika: 45, gorunur: false }).durum;
    d = molaIlerle(d, 43 * dk + 1000 + MOLA_ARA_MS, { dakika: 45, gorunur: true }).durum;
    expect(d.etkinMs).toBe(0);
    // Cihaz uyudu (çağrılar arası uzun boşluk)
    d = oyna(molaBaslat(), 0, 30 * dk).d;
    d = molaIlerle(d, 30 * dk + MOLA_ARA_MS + 1, { dakika: 45, gorunur: true }).durum;
    expect(d.etkinMs).toBe(0);
  });
});
