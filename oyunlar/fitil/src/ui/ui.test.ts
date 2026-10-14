import { describe, expect, it } from 'vitest';
import { yerlesimHesapla, yatayMi, dikeyHucre } from './yerlesim';
import { paylasimMetni, hamleSimgesi } from './paylasim';
import { kalanMetni, hedefMetni, yuzde, sayi, tarihKisa, tarihUzun, bolumBasligi, esikBilgisi, kayipBasligi, sonrakiSeriBasamagi, gorevMetni } from './metinler';
import type { HedefVM } from './tipler';

describe('yerleşim (§13.7)', () => {
  it('390×844, 7×9: hücre = floor(min(358/7, (0,66·844−24)/9, 64)) = 51', () => {
    const y = yerlesimHesapla(390, 844, 7, 9);
    expect(y.kip).toBe('dikey');
    expect(y.hucre).toBe(51);
    expect(y.ustOran).toBe(0.2);
    expect(y.tahta.w).toBe(357);
    // 16 px kenar boşluğu, yatayda ortalı
    expect(y.tahta.x).toBe(17);
    // Tahta %20–%86 bandında ortalanır
    expect(y.tahtaAlani.y).toBe(Math.round(0.2 * 844));
    expect(y.altBant!.y).toBe(Math.round(0.86 * 844));
    expect(y.tahta.y).toBeGreaterThanOrEqual(y.tahtaAlani.y);
    expect(y.tahta.y + y.tahta.h).toBeLessThanOrEqual(y.tahtaAlani.y + y.tahtaAlani.h);
  });

  it('360×640, 7×9: hücre 44 (alt sınır 40 üstü, üst bant %20)', () => {
    const y = yerlesimHesapla(360, 640, 7, 9);
    expect(y.hucre).toBe(44);
    expect(y.ustOran).toBe(0.2);
  });

  it('360×640, 8×10: hücre 40 altına düşer → üst bant %14', () => {
    expect(dikeyHucre(360, 640, 8, 10, 0.2)).toBe(39);
    const y = yerlesimHesapla(360, 640, 8, 10);
    expect(y.ustOran).toBe(0.14);
    expect(y.hucre).toBe(41);
    expect(y.hucre).toBeGreaterThanOrEqual(40);
  });

  it('güvenli alan payları yüksekliği daraltır, alt çubuk güvenli alanı içerir', () => {
    const y = yerlesimHesapla(390, 844, 7, 9, { ust: 47, sag: 0, alt: 34, sol: 0 });
    const Y = 844 - 47 - 34;
    expect(y.tahtaAlani.y).toBe(Math.round(47 + 0.2 * Y));
    expect(y.altBant!.y + y.altBant!.h).toBe(844);
    expect(y.hucre).toBe(51);
  });

  it('64 px üst sınırı', () => {
    const y = yerlesimHesapla(700, 1000, 5, 6);
    expect(y.hucre).toBe(64);
  });

  it('1280×800 yatay: sağ panel 320 px, hücre = min(64, (Y−160)/h)', () => {
    expect(yatayMi(1280, 800)).toBe(true);
    expect(yatayMi(390, 844)).toBe(false);
    expect(yatayMi(768, 1024)).toBe(false);
    const y = yerlesimHesapla(1280, 800, 7, 9);
    expect(y.kip).toBe('yatay');
    expect(y.panel!.w).toBe(320);
    expect(y.panel!.x + y.panel!.w).toBe(1280 - 16);
    expect(y.hucre).toBe(64);
    // Tahta panelin solunda
    expect(y.tahta.x + y.tahta.w).toBeLessThan(y.panel!.x);
    const k = yerlesimHesapla(1280, 600, 8, 10);
    expect(k.hucre).toBe(Math.floor((600 - 160) / 10));
  });
});

describe('paylaşım metni (§10.5)', () => {
  it('örnek biçim', () => {
    const r = [1, 2, 9, 0, 16, 8, 3, 2, 10, 12, 4, 20, 1, 9, 2, 3, 11, 14];
    const m = paylasimMetni({ tarih: 20261014, yildiz: 2, kullanilanHamle: 18, toplamHamle: 22, enBuyuk: 27, reaksiyonlar: r });
    expect(m).toBe('FİTİL · Günün Şenliği 14.10.2026\n★★☆  18/22 hamle  En büyük: 27\n●●▲●■▲●●▲▲●■●▲●●▲▲');
  });
  it('simge sınırları', () => {
    expect(hamleSimgesi(7)).toBe('●');
    expect(hamleSimgesi(8)).toBe('▲');
    expect(hamleSimgesi(14)).toBe('▲');
    expect(hamleSimgesi(15)).toBe('■');
  });
  it('emoji içermez', () => {
    const m = paylasimMetni({ tarih: 20260101, yildiz: 3, kullanilanHamle: 1, toplamHamle: 20, enBuyuk: 0, reaksiyonlar: [0] });
    expect(/\p{Extended_Pictographic}/u.test(m.replace(/[★☆●▲■]/g, ''))).toBe(false);
  });
});

describe('metinler', () => {
  const h = (o: Partial<HedefVM>): HedefVM => ({ tur: 'topla', gerekli: 10, ilerleme: 0, tamam: false, ...o });
  it('kalan metni: "3 kızıl kaldı"', () => {
    expect(kalanMetni(h({ renk: 0, gerekli: 40, ilerleme: 37 }))).toBe('3 kızıl kaldı');
    expect(kalanMetni(h({ renk: 'hepsi', gerekli: 25, ilerleme: 20 }))).toBe('5 kapsül kaldı');
    expect(kalanMetni(h({ tur: 'kafes', gerekli: 6, ilerleme: 4 }))).toBe('2 kafes kaldı');
    expect(kalanMetni(h({ tur: 'aydinlat', gerekli: 30, ilerleme: 29 }))).toBe('1 döşeme kaldı');
    expect(kalanMetni(h({ tur: 'puan', gerekli: 5000, ilerleme: 3800 }))).toBe('1.200 puan kaldı');
  });
  it('hedef metni', () => {
    expect(hedefMetni(h({ renk: 3, gerekli: 15 }))).toBe('15 gök');
    expect(hedefMetni(h({ tur: 'zincirleme', esik: 15, gerekli: 3 }))).toBe('3 kez 15+ reaksiyon');
    expect(hedefMetni(h({ tur: 'desen', motif: 'lale', gerekli: 18 }))).toBe('Lale desenini boya');
  });
  it('sayı, yüzde, tarih', () => {
    expect(sayi(12450)).toBe('12.450');
    expect(yuzde(0.92)).toBe('%92');
    expect(yuzde(1)).toBe('%100');
    expect(tarihKisa(20261014)).toBe('14.10.2026');
    expect(tarihUzun(20261014)).toBe('14 Ekim 2026');
  });
  it('başlıklar ve bilgi satırları', () => {
    expect(bolumBasligi(12)).toBe('Bölüm 12');
    expect(bolumBasligi(103, 'usta')).toBe('Usta 3');
    expect(bolumBasligi(20261014, 'gunluk')).toBe('Günün Şenliği');
    expect(esikBilgisi(4)).toBeNull();
    expect(esikBilgisi(3)).toBe('Kuru Gece: barut 3 ısıda tutuşur');
    expect(kayipBasligi(0.92)).toBe('Çok yaklaştın!');
    expect(kayipBasligi(0.3)).toBe('Bir daha dene!');
    expect(sonrakiSeriBasamagi(5)).toEqual({ ad: 'Meşale', kalan: 2 });
    expect(sonrakiSeriBasamagi(30)).toBeNull();
    expect(gorevMetni(3, 0)).toBe('50 kızıl patlat');
  });
});
