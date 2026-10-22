/**
 * İngilizce taraması, "oyun" grubu (src/app akış dosyaları + src/render):
 * oyun içi bildirimler, seçim ipuçları, Kazandın duyuruları, tuval yazıları
 * (reaksiyon, kombo adları, "Şenlik başlıyor!"). Sayfa dili İngilizceyken
 * Türkçe harf kalmamalı ve metinler Türkçeden belirgin uzun olmamalı (dar
 * ekran). Modüller dil belirlendikten SONRA yüklenmeli: yalnız dinamik içe
 * aktarım.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Odul } from '../meta';

(globalThis as { __FITIL_DIL__?: string }).__FITIL_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
/** Türkçe harfsiz ama Türkçe kalmış sık sözcükler. */
const TR_SOZCUK = /\b(ve|bir|bu|yok|seç|daha|hamle|bölüm|açıldı|tamam|Harika|Güzel|Sandık|Kibrit|Körük|Kalıp)\b/i;

let gorunum: typeof import('../app/gorunum');
let oturum: typeof import('../app/oturum');
let uygulama: typeof import('../app/uygulama');
let cizici: typeof import('../render/oyunCizici');
let yol: typeof import('../render/yolKatmani');
let palet: typeof import('../render/palet');
let gelir: typeof import('../app/gelirAkisi');
let sahte: typeof import('../platform/gelirSahte');
let ui: typeof import('../ui/metinler');

beforeAll(async () => {
  gorunum = await import('../app/gorunum');
  oturum = await import('../app/oturum');
  uygulama = await import('../app/uygulama');
  cizici = await import('../render/oyunCizici');
  yol = await import('../render/yolKatmani');
  palet = await import('../render/palet');
  gelir = await import('../app/gelirAkisi');
  sahte = await import('../platform/gelirSahte');
  ui = await import('../ui/metinler');
});

/** Tablodaki metinler; işlevler örnek bağımsız değişkenlerle çağrılır. */
function metinler(tablo: Record<string, unknown>): [string, string][] {
  const r: [string, string][] = [];
  for (const [k, v] of Object.entries(tablo)) {
    if (typeof v === 'string') r.push([k, v]);
    else if (typeof v === 'function') r.push([k, String((v as (...a: unknown[]) => unknown)('Pier', 3))]);
  }
  return r;
}

function denetle(ad: string, liste: [string, string][], enUzun = 60): void {
  for (const [k, m] of liste) {
    expect(m, `${ad}.${k}`).not.toMatch(TR_HARF);
    expect(m, `${ad}.${k}`).not.toMatch(TR_SOZCUK);
    expect(m.trim().length, `${ad}.${k} boş`).toBeGreaterThan(0);
    expect(m.length, `${ad}.${k} çok uzun: ${m}`).toBeLessThanOrEqual(enUzun);
  }
}

describe('İngilizce (oyun grubu): metin tabloları', () => {
  it('oturum: seçim ipuçları dar ekranda tek satır, bildirimler kısa', () => {
    denetle('SECIM_METNI', metinler(oturum.SECIM_METNI), 34);
    denetle('OTURUM_BILDIRIMI', metinler(oturum.OTURUM_BILDIRIMI), 52);
    expect(oturum.SECIM_METNI.kibrit).toMatch(/^Match:/);
    expect(oturum.SECIM_METNI.koruk).toMatch(/^Bellows:/);
  });

  it('uygulama: bildirimler ve Defter hataları', () => {
    denetle('UYGULAMA_METNI', metinler(uygulama.UYGULAMA_METNI), 80);
    denetle('DEFTER_HATA', metinler(uygulama.DEFTER_HATA), 40);
    expect(uygulama.UYGULAMA_METNI.mahalleTamam('Pier')).toBe('Pier complete!');
    expect(uygulama.UYGULAMA_METNI.sonsuzHazirlaniyor(12)).toContain('festival 12');
  });

  it('gelir akışı: bildirimler kısa (CAN-REKLAM §3–§4)', () => {
    denetle('GELIR_METNI', metinler(gelir.GELIR_METNI), 32);
    expect(gelir.GELIR_METNI.reklamYok).toBe('No ad right now');
  });

  it('sahte sağlayıcı katmanları (?gelir=sahte): kısa; ürün adları Mağaza satırlarıyla aynı', () => {
    denetle('SAHTE_METNI', metinler(sahte.SAHTE_METNI), 24);
    denetle('SAHTE_METNI.urun', metinler(sahte.SAHTE_METNI.urun), 24);
    for (const [id, ad] of Object.entries(sahte.SAHTE_METNI.urun)) expect(ad, id).toBe(ui.URUN_METINLERI[id as keyof typeof ui.URUN_METINLERI].ad);
    expect(sahte.SAHTE_METNI.urun.usta_karti).toBe('Master’s Card');
  });

  it('tuval: reaksiyon yazıları, kombo adları, bilgi yazıları', () => {
    denetle('REAKSIYON_METNI', metinler(cizici.REAKSIYON_METNI), 12);
    denetle('CIZICI_BILGI', metinler(cizici.CIZICI_BILGI), 24);
    denetle('KOMBO_ADLARI', metinler(yol.KOMBO_ADLARI), 20);
    expect(cizici.REAKSIYON_METNI.senlik).toBe('FESTIVAL!');
    expect(yol.KOMBO_ADLARI.buyukFinal).toBe('GRAND FINALE');
    expect(palet.INCI.ad).toBe('Star');
  });

  it('görünüm: duyuru tablosu, güçlendirici adları, yedek bölüm adı', () => {
    denetle('DUYURU_METNI', metinler(gorunum.DUYURU_METNI), 44);
    expect(gorunum.GUC_ADI).toEqual({ kibrit: 'Match', kalip: 'Rocket Mold', geriSar: 'Undo' });
    expect(gorunum.bolumYedekAdi(12)).toBe('Level 12');
  });
});

describe('İngilizce (oyun grubu): Kazandın duyuruları', () => {
  it('örnek ödüllerin duyuruları İngilizce', () => {
    const verilen = { guc: 'kibrit' as const, adet: 2, toz: 0 };
    const oduller: Odul[] = [
      { tur: 'guclendiriciAcildi', guc: 'kalip', verilen: { guc: 'kalip', adet: 3, toz: 0 } },
      { tur: 'guclendirici', neden: 'rozet', verilen },
      { tur: 'guclendirici', neden: 'seri', verilen: { guc: 'geriSar', adet: 0, toz: 4 } },
      { tur: 'gunlukAcildi' },
      { tur: 'sonsuzAcildi' },
      { tur: 'ustaAcildi', bolumId: 101, ustaNo: 1, yildiz: 15 },
      { tur: 'efsane', mahalle: 0, kart: 'efsane:iskele' as never },
      { tur: 'motif', motif: 'kalp' as never },
      { tur: 'rozet', rozet: 'ilkAdim' as never, ad: 'First Steps' },
      { tur: 'gorev', indeks: 0, gorev: {} as never, metin: 'Make 3 rockets' },
      { tur: 'seriBasamagi', basamak: 1, ad: 'Kindling' },
      { tur: 'fitil', fitil: 'denizFeneri' as never },
      { tur: 'cosku', seri: 3, aktif: true, bozuldu: false },
    ];
    const d = gorunum.odulDuyurulari(oduller);
    const metin = d.map((x) => x.metin);
    expect(metin).toEqual([
      'Rocket Mold unlocked · +3',
      'Daily Festival unlocked',
      'Endless Festival unlocked',
      'Master Level 1 unlocked',
      'Legend card unlocked',
      'Light Pattern on the map',
      'Lighthouse fuse is yours',
      '+2 Match',
      '+4 dust',
      'Cheer: next level starts with a rocket',
      'Lantern Watch: Kindling',
      'Task: Make 3 rockets',
      'Badge: First Steps',
    ]);
    for (const m of metin) expect(m).not.toMatch(TR_HARF);
  });

  it('mahalle duyurusu: ad katalogdan, kalıp İngilizce', () => {
    const d = gorunum.odulDuyurulari([{ tur: 'mahalleTamam', mahalle: 0, gokyuzu: 'ayIsigi' as never, kart: 'defter:iskele' as never }]);
    expect(d[0].metin).toMatch(/ complete$/);
    expect(d[0].metin).not.toMatch(/tamamlandı/);
  });
});
