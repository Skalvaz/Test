/**
 * Oyun özeti (Ayarlar > Oyun özeti): ölçüm olaylarından biçimlenmiş VM.
 * Türkçe çıktı (Node'da sayfa dili Türkçe).
 */
import { describe, expect, it } from 'vitest';
import type { OlcumOlayi } from '../platform/olcum';
import { dakikaSaniye, oyunOzetiVM, oyunSuresiMetni, OZET_BOLUM_SINIRI } from './oyunOzeti';

const GUN = 86_400_000;
const T0 = 1_760_000_000_000;

/** Olay kurucu: zaman = T0 + gün + sn. */
const o = (a: string, oturum: number, p?: OlcumOlayi['p'], gun = 0, sn = 0): OlcumOlayi => ({ a, t: T0 + gun * GUN + sn * 1000, g: gun, o: oturum, ...(p ? { p } : {}) });
const basla = (id: number, oturum: number, tur = 'ana', gun = 0) => o('bolum_basla', oturum, { id, tur, deneme: 0 }, gun);
const bitti = (id: number, oturum: number, sonuc: 'kazanc' | 'kayip' | 'cikis', sure: number, tur = 'ana', gun = 0) => o('bolum_bitti', oturum, { id, tur, sonuc, sure }, gun);

const deger = (vm: ReturnType<typeof oyunOzetiVM>, anahtar: string) => vm.satirlar.find((s) => s.anahtar === anahtar)?.deger;

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
    const vm = oyunOzetiVM(olaylar, T0 + 5 * GUN + 3600_000, T0);
    expect(vm.bos).toBe(false);
    expect(vm.satirlar.map((s) => [s.etiket, s.deger])).toEqual([
      ['İlk açılış', '5 gün önce'],
      ['Oturum', '2'],
      ['Oynanan gün', '2'],
      ['En yüksek bölüm', '2'],
      ['Oyun süresi', '8 dk'],
      ['Sürüm', '1.0 · Türkçe'],
    ]);
    expect(vm.bolumler.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(vm.oynananBolum).toBe(3);
  });

  it('ilk açılış: bugün / dün; verilmezse olaylardan tahmin', () => {
    const olaylar = [o('oturum_basla', 1, { dil: 'en', surum: '1.0' })];
    expect(deger(oyunOzetiVM(olaylar, T0 + 1000), 'ilkAcilis')).toBe('Bugün');
    expect(deger(oyunOzetiVM(olaylar, T0 + GUN + 5), 'ilkAcilis')).toBe('Dün');
    // Halka günlük eski olayları düşürmüş: en eski kalan olay 3. günden.
    expect(deger(oyunOzetiVM([o('oturum_basla', 9, undefined, 3, 10)], T0 + 4 * GUN + 20_000), 'ilkAcilis')).toBe('4 gün önce');
    expect(deger(oyunOzetiVM(olaylar, T0), 'surum')).toBe('1.0 · English');
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
    const vm = oyunOzetiVM(olaylar, T0 + GUN);
    expect(vm.bolumler).toEqual([
      { id: 4, deneme: 4, kayip: 1, birakma: 2, ortSure: 70, kazanildi: true, vurgu: true },
      { id: 5, deneme: 2, kayip: 0, birakma: 1, ortSure: null, kazanildi: false, vurgu: false },
    ]);
    expect(deger(vm, 'enYuksek')).toBe('4');
  });

  it('başlangıcı günlükten düşmüş bitiş de bir denemedir; usta/sonsuz tabloya girmez', () => {
    const vm = oyunOzetiVM([bitti(7, 3, 'kayip', 60), basla(103, 3, 'usta'), bitti(103, 3, 'kazanc', 80, 'usta'), basla(1_000_002, 3, 'sonsuz')], T0);
    expect(vm.bolumler).toEqual([{ id: 7, deneme: 1, kayip: 1, birakma: 0, ortSure: 60, kazanildi: false, vurgu: true }]);
    expect(deger(vm, 'enYuksek')).toBe('—');
    expect(deger(vm, 'oturum')).toBe('3');
  });

  it('en son oynanan 12 ana bölüm, numara sırasıyla; vurgu eşitlikte en son oynanan', () => {
    const olaylar: OlcumOlayi[] = [o('oturum_basla', 1, { ana: 1 })];
    for (let id = 1; id <= 15; id++) {
      olaylar.push(basla(id, 1));
      olaylar.push(bitti(id, 1, id === 3 || id === 9 || id === 11 ? 'kayip' : 'kazanc', 60));
    }
    // 2. bölüm yeniden oynandı: en son oynananlar arasına girer.
    olaylar.push(basla(2, 1), bitti(2, 1, 'kazanc', 60));
    const vm = oyunOzetiVM(olaylar, T0);
    expect(vm.bolumler).toHaveLength(OZET_BOLUM_SINIRI);
    expect(vm.bolumler.map((b) => b.id)).toEqual([2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(vm.oynananBolum).toBe(15);
    expect(vm.bolumler.filter((b) => b.vurgu).map((b) => b.id)).toEqual([11]);
    // Hiç kayıp/bırakma yoksa vurgu yok.
    expect(oyunOzetiVM([basla(1, 1), bitti(1, 1, 'kazanc', 30)], T0).bolumler[0].vurgu).toBe(false);
  });

  it('boş günlük: boş durum; süre ve sayı biçimleri', () => {
    const vm = oyunOzetiVM([], T0);
    expect(vm.bos).toBe(true);
    expect(vm.bolumler).toEqual([]);
    expect(deger(vm, 'ilkAcilis')).toBe('Bugün');
    expect(deger(vm, 'surum')).toBe('—');
    expect(dakikaSaniye(48)).toBe('0:48');
    expect(dakikaSaniye(65)).toBe('1:05');
    expect(dakikaSaniye(720)).toBe('12:00');
    expect(oyunSuresiMetni(0)).toBe('0 dk');
    expect(oyunSuresiMetni(20)).toBe('1 dk');
    expect(oyunSuresiMetni(42 * 60)).toBe('42 dk');
    expect(oyunSuresiMetni(65 * 60)).toBe('1 sa 5 dk');
  });
});
