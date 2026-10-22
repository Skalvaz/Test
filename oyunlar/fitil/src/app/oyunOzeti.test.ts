/**
 * Oyun özeti (Ayarlar > Oyun özeti): ölçüm toplamlarından biçimlenmiş VM.
 * Türkçe çıktı (Node'da sayfa dili Türkçe). Zamanlar yerel saatle kurulur:
 * "Bugün / Dün" ve oynanan gün takvim günüyle sayılır (saat diliminden bağımsız test).
 */
import { describe, expect, it } from 'vitest';
import { olaylardanToplam, type OlcumOlayi } from '../platform/olcum';
import { dakikaSaniye, oyunOzetiVM, oyunSuresiMetni, OZET_BOLUM_SINIRI } from './oyunOzeti';

const GUN = 86_400_000;
/** Yerel öğle (gün eklemek takvim gününü kaydırmasın). */
const T0 = new Date(2026, 9, 18, 12, 0, 0).getTime();

/** Olay kurucu: zaman = T0 + gün + sn. */
const o = (a: string, oturum: number, p?: OlcumOlayi['p'], gun = 0, sn = 0): OlcumOlayi => ({ a, t: T0 + gun * GUN + sn * 1000, g: gun, o: oturum, ...(p ? { p } : {}) });
const basla = (id: number, oturum: number, tur = 'ana', gun = 0) => o('bolum_basla', oturum, { id, tur, deneme: 0 }, gun);
const bitti = (id: number, oturum: number, sonuc: 'kazanc' | 'kayip' | 'cikis', sure: number, tur = 'ana', gun = 0) => o('bolum_bitti', oturum, { id, tur, sonuc, sure }, gun);

const vm = (olaylar: readonly OlcumOlayi[], simdi: number, ilk = T0, enYuksek?: number) => oyunOzetiVM(olaylardanToplam(olaylar), simdi, ilk, enYuksek);
const deger = (v: ReturnType<typeof oyunOzetiVM>, anahtar: string) => v.satirlar.find((s) => s.anahtar === anahtar)?.deger;

describe('oyun özeti', () => {
  it('başlık satırları: ilk açılış, oturum, gün, en yüksek bölüm, süre, sürüm + dil', () => {
    const olaylar: OlcumOlayi[] = [
      o('oturum_basla', 1, { dil: 'tr', surum: '1.0', ana: 1 }),
      basla(1, 1),
      bitti(1, 1, 'kazanc', 70),
      basla(2, 1),
      bitti(2, 1, 'kazanc', 95),
      o('oturum_basla', 2, { dil: 'tr', surum: '1.0', ana: 3 }, 2),
      basla(3, 2, 'ana', 2),
      bitti(3, 2, 'kayip', 120, 'ana', 2),
      // Günlük: süre toplama girer, tabloya ve en yükseğe girmez.
      basla(20261014, 2, 'gunluk', 2),
      bitti(20261014, 2, 'kazanc', 200, 'gunluk', 2),
    ];
    const v = vm(olaylar, T0 + 5 * GUN + 3600_000);
    expect(v.bos).toBe(false);
    expect(v.satirlar.map((s) => [s.etiket, s.deger])).toEqual([
      ['İlk açılış', '5 gün önce'],
      ['Oturum', '2'],
      ['Oynanan gün', '2'],
      ['En yüksek bölüm', '2'],
      ['Oyun süresi', '8 dk'],
      ['Sürüm', '1.0 · Türkçe'],
    ]);
    expect(v.bolumler.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(v.oynananBolum).toBe(3);
    expect(deger(vm(olaylar, T0), 'surum')).toBe('1.0 · Türkçe');
    expect(deger(vm([o('oturum_basla', 1, { dil: 'en', surum: '1.0' })], T0), 'surum')).toBe('1.0 · English');
  });

  it('ilk açılış ve oynanan gün takvim günüyle (24 saatlik dilimle değil)', () => {
    const dun20 = new Date(2026, 9, 17, 20, 0, 0).getTime();
    const bugun8 = new Date(2026, 9, 18, 8, 0, 0).getTime();
    const bugun9 = new Date(2026, 9, 18, 9, 0, 0).getTime();
    // 13 saat sonra ama takvimde dün.
    expect(deger(vm([], bugun9, dun20), 'ilkAcilis')).toBe('Dün');
    expect(deger(vm([], new Date(2026, 9, 17, 23, 59, 0).getTime(), new Date(2026, 9, 17, 0, 1, 0).getTime()), 'ilkAcilis')).toBe('Bugün');
    expect(deger(vm([], new Date(2026, 9, 22, 0, 5, 0).getTime(), dun20), 'ilkAcilis')).toBe('5 gün önce');
    // Dün 20:00 ve bugün 08:00 aynı 24 saatlik dilimde (g = 0) ama iki ayrı gün.
    const olaylar: OlcumOlayi[] = [
      { a: 'oturum_basla', t: dun20, g: 0, o: 1 },
      { a: 'oturum_basla', t: bugun8, g: 0, o: 2 },
    ];
    expect(deger(vm(olaylar, bugun9, dun20), 'oynananGun')).toBe('2');
  });

  it('bölüm satırı: deneme, kayıp, bırakma (çıkış + bitmeden kapanan), ortalama süre, kazanıldı', () => {
    const olaylar: OlcumOlayi[] = [
      o('oturum_basla', 1, { ana: 1 }),
      basla(4, 1),
      bitti(4, 1, 'kayip', 100),
      basla(4, 1),
      bitti(4, 1, 'cikis', 20),
      basla(4, 1),
      // Sayfa bölümün ortasında kapandı: yeni oturum → bırakma.
      o('oturum_basla', 2, { ana: 4 }, 1),
      basla(4, 2, 'ana', 1),
      bitti(4, 2, 'kazanc', 90, 'ana', 1),
      // Bitmeden yeni bölüme geçildi (test kancası, yeniden başlatma) → bırakma.
      basla(5, 2, 'ana', 1),
      basla(5, 2, 'ana', 1),
      // Süren deneme: bırakma değil (Ayarlar oyun içinden açıldı).
    ];
    const v = vm(olaylar, T0 + GUN);
    expect(v.bolumler).toEqual([
      { id: 4, deneme: 4, kayip: 1, birakma: 2, ortSure: 70, kazanildi: true, vurgu: true },
      { id: 5, deneme: 2, kayip: 0, birakma: 1, ortSure: null, kazanildi: false, vurgu: false },
    ]);
    expect(deger(v, 'enYuksek')).toBe('4');
  });

  it('başlangıcı günlükten düşmüş bitiş de bir denemedir; usta/sonsuz tabloya girmez', () => {
    const v = vm([bitti(7, 3, 'kayip', 60), basla(103, 3, 'usta'), bitti(103, 3, 'kazanc', 80, 'usta'), basla(1_000_002, 3, 'sonsuz')], T0);
    expect(v.bolumler).toEqual([{ id: 7, deneme: 1, kayip: 1, birakma: 0, ortSure: 60, kazanildi: false, vurgu: true }]);
    expect(deger(v, 'enYuksek')).toBe('—');
    expect(deger(v, 'oturum')).toBe('3');
  });

  it('en yüksek bölüm: kayıttaki değer verilirse o (40. bölüm de)', () => {
    // Kazanç olayı günlükten düşmüş, oturum yalnız açık en yüksek bölümü (40) taşıyor.
    const olaylar = [o('oturum_basla', 9, { ana: 40 })];
    expect(deger(vm(olaylar, T0, T0, 40), 'enYuksek')).toBe('40');
    expect(deger(vm(olaylar, T0, T0, 39), 'enYuksek')).toBe('39');
    expect(deger(vm(olaylar, T0), 'enYuksek')).toBe('—');
  });

  it('bir denemenin süresi en çok 15 dk sayılır (unutulup sonra bitirilen deneme)', () => {
    const v = vm([basla(9, 1), bitti(9, 1, 'kazanc', 3700), basla(9, 1), bitti(9, 1, 'kayip', 120)], T0);
    expect(deger(v, 'oyunSuresi')).toBe('17 dk');
    expect(v.bolumler[0].ortSure).toBe((900 + 120) / 2);
  });

  it(`en son oynanan ${OZET_BOLUM_SINIRI} ana bölüm, numara sırasıyla; vurgu eşitlikte en son oynanan`, () => {
    const olaylar: OlcumOlayi[] = [o('oturum_basla', 1, { ana: 1 })];
    for (let id = 1; id <= 15; id++) {
      olaylar.push(basla(id, 1));
      olaylar.push(bitti(id, 1, id === 3 || id === 9 || id === 11 ? 'kayip' : 'kazanc', 60));
    }
    // 2. bölüm yeniden oynandı: en son oynananlar arasına girer.
    olaylar.push(basla(2, 1), bitti(2, 1, 'kazanc', 60));
    const v = vm(olaylar, T0);
    expect(OZET_BOLUM_SINIRI).toBe(8);
    expect(v.bolumler.map((b) => b.id)).toEqual([2, 9, 10, 11, 12, 13, 14, 15]);
    expect(v.oynananBolum).toBe(15);
    expect(v.bolumler.filter((b) => b.vurgu).map((b) => b.id)).toEqual([11]);
    // Hiç kayıp/bırakma yoksa vurgu yok.
    expect(vm([basla(1, 1), bitti(1, 1, 'kazanc', 30)], T0).bolumler[0].vurgu).toBe(false);
  });

  it('boş günlük: boş durum; süre ve sayı biçimleri', () => {
    const v = vm([], T0);
    expect(v.bos).toBe(true);
    expect(v.bolumler).toEqual([]);
    expect(deger(v, 'ilkAcilis')).toBe('Bugün');
    expect(deger(v, 'surum')).toBe('—');
    expect(dakikaSaniye(48)).toBe('0:48');
    expect(dakikaSaniye(65)).toBe('1:05');
    expect(dakikaSaniye(720)).toBe('12:00');
    expect(oyunSuresiMetni(0)).toBe('0 dk');
    expect(oyunSuresiMetni(20)).toBe('1 dk');
    expect(oyunSuresiMetni(42 * 60)).toBe('42 dk');
    expect(oyunSuresiMetni(65 * 60)).toBe('1 sa 5 dk');
  });
});
