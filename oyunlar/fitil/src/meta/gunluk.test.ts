import { describe, expect, it } from 'vitest';
import {
  GOREV_SABLONLARI,
  arsivGunleri,
  arsivdeMi,
  gorevIlerlet,
  gorevMetni,
  gunlukGorevSec,
  izgaraMetni,
  paylasimMetni,
  reaksiyonSimgesi,
  seriDusur,
  seriIlerle,
  sonrakiBasamak,
} from './gunluk';
import type { GorevBaglami } from './gunluk';
import { seriBasamakIndeksi, yeniKayit } from './kayit';
import type { GunlukKaydi } from './kayit';
import { ozetBaslat } from './ozet';
import type { OyunOzeti } from './ozet';
import { haftaNo, tarihEkle } from './takvim';

const BUGUN = 20261014; // Çarşamba

function baglam(ek: Partial<GorevBaglami> = {}, oz: Partial<OyunOzeti> = {}): GorevBaglami {
  return { kazandi: false, yildiz: 0, ilkDeneme: false, gununSenligi: false, ozet: { ...ozetBaslat(), ...oz }, ...ek };
}

describe('görev şablonları ve seçim (§10.5)', () => {
  it('20 şablon, numara sırasıyla, hepsinin metni var', () => {
    expect(GOREV_SABLONLARI.map((s) => s.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const s of GOREV_SABLONLARI) expect(gorevMetni({ sablon: s.no, renk: 2 }).length).toBeGreaterThan(5);
    expect(gorevMetni({ sablon: 3, renk: 3 })).toBe('50 gök patlat');
    expect(gorevMetni({ sablon: 3, renk: 0 })).toBe('50 kızıl patlat');
  });

  it('aynı gün herkese aynı; günler arasında değişir; 3 farklı görev', () => {
    const a = gunlukGorevSec(BUGUN, 40);
    expect(a).toEqual(gunlukGorevSec(BUGUN, 40));
    expect(a.length).toBe(3);
    expect(new Set(a.map((g) => g.sablon)).size).toBe(3);
    const farkli = new Set<string>();
    for (let i = 0; i < 30; i++) farkli.add(JSON.stringify(gunlukGorevSec(tarihEkle(BUGUN, i), 40).map((g) => g.sablon)));
    expect(farkli.size).toBeGreaterThan(20);
  });

  it('bir yıl boyunca her şablon seçilir, dağılım makul', () => {
    const say = new Array(21).fill(0);
    for (let i = 0; i < 365; i++) for (const g of gunlukGorevSec(tarihEkle(20260101, i), 40)) say[g.sablon]++;
    for (let n = 1; n <= 20; n++) {
      expect(say[n]).toBeGreaterThan(25); // beklenen ≈ 55
      expect(say[n]).toBeLessThan(95);
    }
  });

  it('henüz tanıtılmamış mekaniğin görevi seçilmez (11. bölümdeki oyuncu)', () => {
    for (let i = 0; i < 200; i++) {
      for (const g of gunlukGorevSec(tarihEkle(BUGUN, i), 11)) {
        const s = GOREV_SABLONLARI[g.sablon - 1];
        expect(s.acilis).toBeLessThanOrEqual(11);
        expect([6, 12, 14]).not.toContain(g.sablon);
      }
    }
  });

  it('renk görevi tohumdan renk alır (0..4) ve hedefleri şablondan', () => {
    for (let i = 0; i < 400; i++) {
      for (const g of gunlukGorevSec(tarihEkle(BUGUN, i), 40)) {
        expect(g.hedef).toBe(GOREV_SABLONLARI[g.sablon - 1].hedef);
        expect(g.ilerleme).toBe(0);
        if (g.sablon === 3) {
          expect(g.renk).toBeGreaterThanOrEqual(0);
          expect(g.renk).toBeLessThan(5);
        } else expect(g.renk).toBeUndefined();
      }
    }
  });
});

describe('görev ilerlemesi', () => {
  it('toplam türü görevler birikir ve hedefte durur', () => {
    const g0 = [{ sablon: 3, renk: 3, ilerleme: 0, hedef: 50, tamam: false }];
    const oz = { renkPatlama: [5, 0, 0, 30, 0, 0] };
    const r1 = gorevIlerlet(g0, baglam({}, oz));
    expect(r1.gorevler[0]).toMatchObject({ ilerleme: 30, tamam: false });
    expect(r1.tamamlanan).toEqual([]);
    const r2 = gorevIlerlet(r1.gorevler, baglam({}, oz));
    expect(r2.gorevler[0]).toMatchObject({ ilerleme: 50, tamam: true });
    expect(r2.tamamlanan).toEqual([0]);
    const r3 = gorevIlerlet(r2.gorevler, baglam({}, oz));
    expect(r3.tamamlanan).toEqual([]); // tamamlanan bir daha bildirilmez
    expect(g0[0].ilerleme).toBe(0); // girdi değişmez
  });

  const tek = (sablon: number, b: GorevBaglami) => gorevIlerlet([{ sablon, ilerleme: 0, hedef: GOREV_SABLONLARI[sablon - 1].hedef, tamam: false }], b).gorevler[0];

  it('her şablonun ölçütü', () => {
    expect(tek(1, baglam({}, { halka: 2 })).tamam).toBe(true);
    expect(tek(2, baglam({}, { enBuyukReaksiyon: 14 })).tamam).toBe(false);
    expect(tek(2, baglam({}, { enBuyukReaksiyon: 15 })).tamam).toBe(true);
    expect(tek(4, baglam({}, { roketAtesi: 3 })).tamam).toBe(true);
    expect(tek(5, baglam({}, { kasimpatiAtesi: 1 })).tamam).toBe(true);
    expect(tek(6, baglam({}, { kombolar: ['kalinRoket'] })).tamam).toBe(true);
    expect(tek(7, baglam({}, { kafesKirilan: 5 })).tamam).toBe(true);
    expect(tek(8, baglam({}, { dosemeAydinlanan: 19 })).tamam).toBe(false);
    expect(tek(9, baglam({ kazandi: true })).ilerleme).toBe(1);
    expect(tek(9, baglam({ kazandi: false })).ilerleme).toBe(0);
    expect(tek(10, baglam({ kazandi: true, yildiz: 2 })).tamam).toBe(false);
    expect(tek(10, baglam({ kazandi: true, yildiz: 3 })).tamam).toBe(true);
    expect(tek(11, baglam({}, { enUzunZincir: 12 })).tamam).toBe(true);
    expect(tek(12, baglam({}, { korukKullanim: 2 })).tamam).toBe(true);
    expect(tek(13, baglam({}, { caprazRoketEngel: 2 })).tamam).toBe(true);
    expect(tek(14, baglam({}, { kayaYokEdilen: 10 })).tamam).toBe(true);
    expect(tek(15, baglam({}, { fenerToplanan: 2 })).tamam).toBe(true);
    expect(tek(16, baglam({}, { finalRoket: 4 })).tamam).toBe(false);
    expect(tek(16, baglam({}, { finalRoket: 5 })).tamam).toBe(true);
    expect(tek(17, baglam({ kazandi: true, gununSenligi: false })).tamam).toBe(false);
    expect(tek(17, baglam({ kazandi: true, gununSenligi: true })).tamam).toBe(true);
    expect(tek(18, baglam({}, { enCokNesil: 2 })).tamam).toBe(true);
    expect(tek(19, baglam({}, { isiPatlamasi: 30 })).tamam).toBe(true);
    expect(tek(20, baglam({ kazandi: true, ilkDeneme: false })).tamam).toBe(false);
    expect(tek(20, baglam({ kazandi: true, ilkDeneme: true })).tamam).toBe(true);
  });
});

function seri(ek: Partial<GunlukKaydi> = {}): GunlukKaydi {
  return { ...yeniKayit(1).gunluk, ...ek };
}

/** Günleri art arda oynat (kaçırılanlar atlanır). */
function oyna(g: GunlukKaydi, gunler: number[]) {
  const sonuclar = [];
  for (const t of gunler) {
    const r = seriIlerle(g, t);
    g = r.gunluk;
    sonuclar.push(r.sonuc);
  }
  return { g, sonuclar };
}

describe('Fener Nöbeti (§10.5)', () => {
  it('basamaklar ve düşüş değerleri (12 → 3)', () => {
    expect([0, 1, 2, 3, 6, 7, 13, 14, 29, 30, 99].map(seriBasamakIndeksi)).toEqual([-1, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(seriDusur(12)).toBe(3);
    expect(seriDusur(7)).toBe(3);
    expect(seriDusur(6)).toBe(1);
    expect(seriDusur(3)).toBe(1);
    expect(seriDusur(2)).toBe(1);
    expect(seriDusur(1)).toBe(1);
    expect(seriDusur(14)).toBe(7);
    expect(seriDusur(45)).toBe(14);
    expect(sonrakiBasamak(5)).toEqual({ indeks: 2, ad: 'Meşale', yonelme: "Meşale'ye", kalan: 2 });
    expect(sonrakiBasamak(1)!.yonelme).toBe("Çıra'ya");
    expect(sonrakiBasamak(20)!.yonelme).toBe("Deniz Feneri'ne");
    expect(sonrakiBasamak(30)).toBeNull();
  });

  it('ilk gün 1; aynı gün tekrar sayılmaz; ardışık gün +1', () => {
    const { g, sonuclar } = oyna(seri(), [BUGUN, BUGUN, tarihEkle(BUGUN, 1), tarihEkle(BUGUN, 2)]);
    expect(sonuclar.map((s) => s.seri)).toEqual([1, 1, 2, 3]);
    expect(sonuclar[1].ayniGun).toBe(true);
    expect(g.seri).toBe(3);
    expect(g.enUzunSeri).toBe(3);
    expect(g.sonGun).toBe(tarihEkle(BUGUN, 2));
  });

  it('haftada 1 kaçırma affedilir; aynı haftada ikinci kaçırma bir basamak düşürür', () => {
    // Pazartesi 12.10 başlayıp 11 gün → seri 11 (Meşale), sonGun 22.10 Perşembe
    let g = oyna(seri(), Array.from({ length: 11 }, (_, i) => tarihEkle(20261012, i))).g;
    expect(g.seri).toBe(11);
    // Cuma 23.10 kaçırıldı (affedilir), Cumartesi 24.10 oynandı → 12
    let r = seriIlerle(g, 20261024);
    expect(r.sonuc.affedilen).toEqual([20261023]);
    expect(r.sonuc.dusus).toBeNull();
    expect(r.gunluk.seri).toBe(12);
    g = r.gunluk;
    // Pazar 25.10 kaçırıldı: aynı hafta, af kullanıldı → 12 → 3 (Meşale → Çıra başlangıcı)
    r = seriIlerle(g, 20261026);
    expect(r.sonuc.affedilen).toEqual([]);
    expect(r.sonuc.dusus).toEqual({ kacirma: 1, den: 12, e: 3 });
    expect(r.gunluk.seri).toBe(3);
    expect(r.gunluk.enUzunSeri).toBe(12);
  });

  it('hafta sınırı: Pazar ve Pazartesi ayrı haftalardır, ikisi de affedilir', () => {
    const g = seri({ seri: 5, enUzunSeri: 5, sonGun: 20261017, basamakOdulu: 1 }); // Cumartesi
    const r = seriIlerle(g, 20261020); // Pazar 18 ve Pazartesi 19 kaçırıldı, Salı oynandı
    expect(r.sonuc.affedilen).toEqual([20261018, 20261019]);
    expect(r.sonuc.dusus).toBeNull();
    expect(r.gunluk.seri).toBe(6);
  });

  it('hafta içi iki kaçırma: biri affedilir, biri düşürür', () => {
    const g = seri({ seri: 5, enUzunSeri: 5, sonGun: 20261013, basamakOdulu: 1 }); // Salı
    const r = seriIlerle(g, 20261016); // Çarşamba, Perşembe kaçırıldı; Cuma
    expect(r.sonuc.affedilen).toEqual([20261014]);
    expect(r.sonuc.dusus).toEqual({ kacirma: 1, den: 5, e: 1 });
    expect(r.gunluk.seri).toBe(1);
  });

  it('af haftası kaydı korunur: önceki gün affı kullanılmış haftada yeni kaçırma düşürür', () => {
    const g = seri({ seri: 20, enUzunSeri: 20, sonGun: 20261015, affedilenHafta: haftaNo(20261013), basamakOdulu: 3 });
    const r = seriIlerle(g, 20261017); // Cuma kaçırıldı, haftanın affı zaten kullanılmış
    expect(r.sonuc.dusus).toEqual({ kacirma: 1, den: 20, e: 7 });
  });

  it('her affedilmeyen kaçırma bir basamak düşürür; en alt Kıvılcım (1)', () => {
    const g = seri({ seri: 40, enUzunSeri: 40, sonGun: 20261011, basamakOdulu: 4 }); // Pazar
    // 12–16 Ekim (Pzt–Cuma) kaçırıldı: 12'si affedilir, 4 kaçırma: 40→14→7→3→1
    const r = seriIlerle(g, 20261017);
    expect(r.sonuc.affedilen).toEqual([20261012]);
    expect(r.sonuc.dusus).toEqual({ kacirma: 4, den: 40, e: 1 });
    // Uzun yokluk (1 yıl) da sıfırlamaz: 1'e iner, enUzunSeri korunur
    const u = seriIlerle(g, 20271017);
    expect(u.gunluk.seri).toBe(1);
    expect(u.gunluk.enUzunSeri).toBe(40);
  });

  it('basamak ödülleri yalnız ilk geçişte', () => {
    let g = seri();
    const yeni: number[] = [];
    for (let i = 0; i < 31; i++) {
      const r = seriIlerle(g, tarihEkle(20261012, i));
      yeni.push(...r.sonuc.yeniBasamaklar);
      g = r.gunluk;
    }
    expect(yeni).toEqual([0, 1, 2, 3, 4]);
    expect(g.seri).toBe(31);
    // Düşüp yeniden tırmanınca ödül tekrarlanmaz
    let d = seriIlerle({ ...g, affedilenHafta: 999999 }, tarihEkle(g.sonGun, 3)).gunluk;
    expect(d.seri).toBeLessThan(14);
    const tekrar: number[] = [];
    for (let i = 1; i < 40; i++) {
      const r = seriIlerle(d, tarihEkle(d.sonGun, 1));
      tekrar.push(...r.sonuc.yeniBasamaklar);
      d = r.gunluk;
    }
    expect(tekrar).toEqual([]);
  });

  it('saat geri alınırsa değişiklik yok', () => {
    const g = seri({ seri: 4, sonGun: BUGUN });
    const r = seriIlerle(g, tarihEkle(BUGUN, -3));
    expect(r.sonuc.ayniGun).toBe(true);
    expect(r.gunluk).toEqual(g);
  });
});

describe('arşiv ve paylaşım', () => {
  it('arşiv: dün ve önceki 6 gün', () => {
    expect(arsivGunleri(20261001)).toEqual([20260930, 20260929, 20260928, 20260927, 20260926, 20260925, 20260924]);
    expect(arsivdeMi(20261013, BUGUN)).toBe(true);
    expect(arsivdeMi(20261007, BUGUN)).toBe(true);
    expect(arsivdeMi(20261006, BUGUN)).toBe(false);
    expect(arsivdeMi(BUGUN, BUGUN)).toBe(false);
    expect(arsivdeMi(20261015, BUGUN)).toBe(false);
  });

  it('simgeler: ● R<8, ▲ 8≤R<15, ■ R≥15', () => {
    expect([0, 7, 8, 14, 15, 40].map(reaksiyonSimgesi).join('')).toBe('●●▲▲■■');
    expect(izgaraMetni([1, 9, 20])).toBe('●▲■');
  });

  it('GDD örneğiyle birebir paylaşım metni (emoji yok)', () => {
    const R = [1, 2, 9, 0, 16, 10, 3, 4, 8, 12, 5, 30, 2, 11, 1, 0, 9, 13];
    const metin = paylasimMetni(BUGUN, { yildiz: 2, kullanilan: 18, toplam: 22, enBuyuk: 27, izgara: izgaraMetni(R) });
    expect(metin).toBe('FİTİL · Günün Şenliği 14.10.2026\n★★☆  18/22 hamle  En büyük: 27\n●●▲●■▲●●▲▲●■●▲●●▲▲');
    // Emoji aralıkları yok (★☆●▲■ metin simgeleri)
    expect(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(metin.replace(/[★☆]/g, ''))).toBe(false);
    expect(paylasimMetni(20270105, { yildiz: 0, kullanilan: 22, toplam: 22, enBuyuk: 4, izgara: '●' }).split('\n')[1]).toBe('☆☆☆  22/22 hamle  En büyük: 4');
  });
});
