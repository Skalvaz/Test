/**
 * Gelir akışı (docs/CAN-REKLAM.md §2–§4, §8; G4): görünüm modelleri (can
 * paneli, Mağaza) ve akış sıralaması sahte sağlayıcı + sahte arayüzle (DOM'suz):
 * ödül önce kayda sonra `tamamla`, stok dolu paket satılmaz, jeton tekrarı,
 * bekleyenler, can harcama/iade olayları, tembel dolum (zaman), Usta kartı,
 * reklam sonuçları, can paneli döngüsü ve kapı.
 */
import { describe, expect, it } from 'vitest';
import * as meta from '../meta';
import type { Kayit } from '../meta';
import type { GelirSaglayici, ReklamSonucu, SatinAlmaSonucu, UrunId } from '../platform/gelir';
import type { OlcumGelirOzellikleri } from '../platform/olcum';
import type { CanPaneliSecimi, CanVM, MagazaSecimi, MagazaVM } from '../ui/tipler';
import { GelirAkisi, canPaneliVM, kayitKoduGelirKoru, magazaVM, type GelirOrtami } from './gelirAkisi';

const T0 = Date.UTC(2026, 9, 22, 9, 0, 0);
const GUN = 20261022;
const FIYAT = new Map<UrunId, string>([
  ['baslangic_paketi', '₺49,99'],
  ['can_doldur', '₺29,99'],
  ['guclendirici_paketi', '₺59,99'],
  ['buyuk_paket', '₺99,99'],
  ['usta_karti', '₺149,99'],
]);

function kayitCanli(sayi: number, ek: Partial<Kayit> = {}): Kayit {
  const k = meta.yeniKayit(7);
  if (sayi < meta.CAN_ENCOK) k.can = { ...meta.varsayilanCan(), sayi, dolumBasi: T0 };
  return { ...k, ...ek };
}

interface Kayitlar {
  adimlar: string[];
  olaylar: { ad: string; p: unknown }[];
  bildirimler: string[];
}

/** Sahte sağlayıcı: sonuçlar ayarlanabilir, her çağrı adımlara yazılır. */
function sahteSaglayici(r: Kayitlar, ayar: { reklam?: ReklamSonucu; hazir?: boolean; satin?: SatinAlmaSonucu | ((id: UrunId) => SatinAlmaSonucu); bekleyen?: { urun: UrunId; jeton: string }[]; geri?: UrunId[] | 'hata' } = {}): GelirSaglayici {
  let n = 0;
  return {
    ad: 'sahte',
    reklamHazir: () => ayar.hazir ?? true,
    async reklamGoster(yer) {
      r.adimlar.push(`reklam:${yer}`);
      return ayar.reklam ?? 'odul';
    },
    async urunler() {
      return [...FIYAT].map(([id, fiyat]) => ({ id, fiyat }));
    },
    async satinAl(id) {
      r.adimlar.push(`satinAl:${id}`);
      const s = ayar.satin;
      if (typeof s === 'function') return s(id);
      return s ?? { durum: 'basarili', urun: id, jeton: `j${++n}` };
    },
    async tamamla(jeton) {
      r.adimlar.push(`tamamla:${jeton}`);
    },
    async bekleyenler() {
      return ayar.bekleyen ?? [];
    },
    async geriYukle() {
      if (ayar.geri === 'hata') throw new Error('mağazaya ulaşılamadı');
      return ayar.geri ?? [];
    },
  };
}

function kur(
  k0: Kayit,
  ayar: Parameters<typeof sahteSaglayici>[1] = {},
  ui: Partial<GelirOrtami['ui']> = {},
  ek: { yazilamaz?: boolean } = {},
): { g: GelirAkisi; r: Kayitlar; kayit: () => Kayit; saat: { t: number } } {
  const r: Kayitlar = { adimlar: [], olaylar: [], bildirimler: [] };
  let k = k0;
  const saat = { t: T0 };
  const o: GelirOrtami = {
    saglayici: sahteSaglayici(r, ayar),
    kayit: () => k,
    yaz: (y) => {
      k = y;
      r.adimlar.push('yaz');
      return !ek.yazilamaz;
    },
    degistir: (y) => {
      k = y;
      r.adimlar.push('degistir');
    },
    ui: {
      canPaneli: ui.canPaneli ?? (async () => 'kapat' as CanPaneliSecimi),
      magaza: ui.magaza ?? (async () => ({ tur: 'kapat' }) as MagazaSecimi),
    },
    bildir: (m) => r.bildirimler.push(m),
    saat: () => saat.t,
    bugun: () => GUN,
    reklamKipi: (a) => r.adimlar.push(`kip:${a}`),
    olay: <A extends keyof OlcumGelirOzellikleri>(ad: A, p: OlcumGelirOzellikleri[A]) => r.olaylar.push({ ad, p }),
  };
  return { g: new GelirAkisi(o), r, kayit: () => k, saat };
}

const adlar = (r: Kayitlar) => r.olaylar.map((x) => x.ad);

describe('canPaneliVM', () => {
  it('dolu: reklam ve doldur satırı yok, sayaç yok', () => {
    const vm = canPaneliVM(meta.yeniKayit(1), T0, GUN, { hazir: true, kart: false, fiyat: '₺29,99' });
    expect(vm).toMatchObject({ sayi: 5, enCok: 5, sonrakiMs: null, tur: 'durum', reklam: null, doldur: null });
  });
  it('0 can: "bitti", 3 hak, fiyat varsa doldur; kart her zaman hazır', () => {
    const k = kayitCanli(0);
    expect(canPaneliVM(k, T0, GUN, { hazir: true, kart: false, fiyat: '₺29,99' })).toMatchObject({
      tur: 'bitti',
      sayi: 0,
      sonrakiMs: meta.CAN_DOLUM_MS,
      reklam: { hak: 3, hazir: true, kart: false },
      doldur: { fiyat: '₺29,99' },
    });
    expect(canPaneliVM(k, T0, GUN, { hazir: false, kart: true, fiyat: null })).toMatchObject({ reklam: { hazir: true, kart: true }, doldur: null });
    expect(canPaneliVM(k, T0, GUN, { hazir: false, kart: false, fiyat: null }).reklam?.hazir).toBe(false);
  });
  it('hak biter: hak 0 ("Yarın yine")', () => {
    let k = kayitCanli(1);
    for (let i = 0; i < 3; i++) k = meta.reklamCanKullan(k, T0, GUN);
    const vm = canPaneliVM(k, T0, GUN, { hazir: true, kart: false, fiyat: null });
    expect(vm.sayi).toBe(4);
    expect(vm.reklam?.hak).toBe(0);
  });
});

describe('magazaVM', () => {
  it('sırası URUN_IDLERI; yeni kayıtta can dolu (stokDolu), paket ve kart satılık', () => {
    const vm = magazaVM(meta.yeniKayit(1), T0, FIYAT);
    expect(vm.urunler.map((u) => [u.id, u.durum, u.fiyat])).toEqual([
      ['baslangic_paketi', 'satilik', '₺49,99'],
      ['can_doldur', 'stokDolu', '₺29,99'],
      ['guclendirici_paketi', 'satilik', '₺59,99'],
      ['buyuk_paket', 'satilik', '₺99,99'],
      ['usta_karti', 'satilik', '₺149,99'],
    ]);
    expect(vm.urunler.filter((u) => u.birKez).map((u) => u.id)).toEqual(['baslangic_paketi']);
    expect(vm.geriYukle).toBe(true);
    expect(vm.urunler.every((u) => u.ad.length > 0 && u.aciklama.length > 0)).toBe(true);
  });
  it('paket stok sınırını aşacaksa stokDolu, Usta kartı sende, fiyat gelmediyse null, listede yoksa yok', () => {
    const k = kayitCanli(2, { gelir: { ustaKarti: true, jetonlar: [] } });
    // Satın alma sınırı 15: 13 Kibrit'e paketlerin hiçbiri sığmaz.
    k.guclendiriciler = { kibrit: 13, kalip: 0, geriSar: 0 };
    expect(magazaVM(k, T0, FIYAT).urunler.map((u) => u.durum)).toEqual(['stokDolu', 'satilik', 'stokDolu', 'stokDolu', 'sende']);
    // 10 Kibrit: küçük paket ve başlangıç sığar, büyük paket (6) sığmaz.
    k.guclendiriciler = { kibrit: 10, kalip: 0, geriSar: 0 };
    expect(magazaVM(k, T0, FIYAT).urunler.map((u) => u.durum)).toEqual(['satilik', 'satilik', 'satilik', 'stokDolu', 'sende']);
    k.guclendiriciler = { kibrit: 0, kalip: 0, geriSar: 0 };
    expect(magazaVM(k, T0, null).urunler.map((u) => [u.durum, u.fiyat])).toEqual([
      ['satilik', null],
      ['satilik', null],
      ['satilik', null],
      ['satilik', null],
      ['sende', null],
    ]);
    expect(magazaVM(k, T0, new Map([['can_doldur', '$0.99']])).urunler.map((u) => u.durum)).toEqual(['yok', 'satilik', 'yok', 'yok', 'sende']);
  });
  it('başlangıç paketi alındıktan sonra listede yok (§14 E1)', () => {
    const k = kayitCanli(2, { gelir: { ustaKarti: false, jetonlar: ['x'], baslangic: true } });
    expect(magazaVM(k, T0, FIYAT).urunler.map((u) => u.id)).toEqual(['can_doldur', 'guclendirici_paketi', 'buyuk_paket', 'usta_karti']);
  });
});

describe('GelirAkisi: satın alma', () => {
  it('can_doldur: ödül önce kayda, sonra tamamla; can_doldu satin; bildirim', async () => {
    const { g, r, kayit } = kur(kayitCanli(2));
    await g.urunleriYukle();
    expect(await g.satinAl('can_doldur')).toBe('verildi');
    expect(r.adimlar.filter((a) => a !== 'degistir')).toEqual(['satinAl:can_doldur', 'yaz', 'tamamla:j1']);
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    expect(kayit().gelir?.jetonlar).toEqual(['j1']);
    expect(r.olaylar).toContainEqual({ ad: 'can_doldu', p: { neden: 'satin' } });
    expect(r.bildirimler).toEqual(['Satın alındı']);
  });
  it('ödül kalıcı yazılamadıysa (salt okunur/dolu depo) tamamla yok: satın alma bekleyenlerde kalır', async () => {
    const { g, r, kayit } = kur(kayitCanli(2), {}, {}, { yazilamaz: true });
    await g.urunleriYukle();
    expect(await g.satinAl('can_doldur')).toBe('verildi');
    // Ödül bu oturumda bellekte; jeton da (aynı oturumda ikinci kez verilmez).
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    expect(r.adimlar.some((a) => a.startsWith('tamamla'))).toBe(false);
    const b = kur(kayitCanli(2), { bekleyen: [{ urun: 'can_doldur', jeton: 'b1' }] }, {}, { yazilamaz: true });
    await b.g.bekleyenleriIsle();
    expect(b.r.adimlar.some((a) => a.startsWith('tamamla'))).toBe(false);
  });
  it('stok dolu paket ve dolu can satılmaz (sağlayıcıya gidilmez); Usta kartı sendeyken de', async () => {
    const k = kayitCanli(5, { gelir: { ustaKarti: true, jetonlar: [] } });
    k.guclendiriciler = { kibrit: 13, kalip: 0, geriSar: 0 };
    const { g, r } = kur(k);
    await g.urunleriYukle();
    expect(await g.satinAl('guclendirici_paketi')).toBe('satilmaz');
    expect(await g.satinAl('can_doldur')).toBe('satilmaz');
    expect(await g.satinAl('usta_karti')).toBe('satilmaz');
    expect(r.adimlar.some((a) => a.startsWith('satinAl'))).toBe(false);
    expect(r.bildirimler).toEqual(['Stok dolu', 'Canların dolu']);
  });
  it('paket stoğa eklenir (açılmamış güçlendiriciye de; C13), Usta kartı kayda', async () => {
    const { g, kayit } = kur(meta.yeniKayit(3));
    await g.urunleriYukle();
    expect(await g.satinAl('guclendirici_paketi')).toBe('verildi');
    expect(kayit().guclendiriciler).toEqual(meta.GUCLENDIRICI_PAKETI);
    expect(await g.satinAl('usta_karti')).toBe('verildi');
    expect(g.ustaKarti()).toBe(true);
    // Can alanı yoktu, yine yok (web/varsayılan kayıt can alanı kazanmaz).
    expect(kayit().can).toBeUndefined();
  });
  it('işlenmiş jeton: ödül yok, yine tamamla; iptal/hata/beklemede: kayıt değişmez, tamamla yok', async () => {
    const k = kayitCanli(1, { gelir: { ustaKarti: false, jetonlar: ['eski'] } });
    const { g, r, kayit } = kur(k, { satin: { durum: 'basarili', urun: 'can_doldur', jeton: 'eski' } });
    await g.urunleriYukle();
    expect(await g.satinAl('can_doldur')).toBe('tekrar');
    expect(r.adimlar).toContain('tamamla:eski');
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(1);
    for (const durum of ['iptal', 'hata', 'beklemede'] as const) {
      const x = kur(kayitCanli(1), { satin: { durum } });
      await x.g.urunleriYukle();
      expect(await x.g.satinAl('can_doldur')).toBe(durum);
      expect(x.r.adimlar.some((a) => a === 'yaz' || a.startsWith('tamamla'))).toBe(false);
    }
  });
  it('bekleyenler: verilen ve tekrar tamamlanır, sığmayan paket beklemede kalır', async () => {
    const k = kayitCanli(2, { gelir: { ustaKarti: false, jetonlar: ['b0'] } });
    k.guclendiriciler = { kibrit: 13, kalip: 0, geriSar: 0 };
    const { g, r, kayit } = kur(k, {
      bekleyen: [
        { urun: 'can_doldur', jeton: 'b1' },
        { urun: 'can_doldur', jeton: 'b0' },
        { urun: 'guclendirici_paketi', jeton: 'b2' },
      ],
    });
    expect(await g.bekleyenleriIsle()).toBe(1);
    expect(r.adimlar.filter((a) => a.startsWith('tamamla'))).toEqual(['tamamla:b1', 'tamamla:b0']);
    expect(r.adimlar.indexOf('yaz')).toBeLessThan(r.adimlar.indexOf('tamamla:b1'));
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    expect(kayit().guclendiriciler.kibrit).toBe(13);
    expect(r.bildirimler).toEqual(['Satın alındı']);
  });
  it('ön plana dönüş (Android): baslat sonrası bekleyenler yeniden sorulur; satın alma sürerken sorulmaz; eş zamanlı çağrı tek işlem', async () => {
    const ayar: { bekleyen: { urun: UrunId; jeton: string }[] } = { bekleyen: [] };
    const { g, r, kayit } = kur(kayitCanli(2), ayar);
    // Kayıt hazır değilken (baslat öncesi) sorulmaz.
    ayar.bekleyen.push({ urun: 'can_doldur', jeton: 'gec1' });
    g.onPlanaDondu();
    await Promise.resolve();
    expect(r.adimlar.some((a) => a.startsWith('tamamla'))).toBe(false);
    // baslat + aynı anda dönüş: tek bekleyenler işlemi (çift tamamla yok).
    g.baslat();
    g.onPlanaDondu();
    await g.bekleyenleriIsle();
    expect(r.adimlar.filter((a) => a.startsWith('tamamla'))).toEqual(['tamamla:gec1']);
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    // Uygulama arkadayken tamamlanan gecikmeli ödeme: dönüşte verilir ve tamamlanır.
    ayar.bekleyen = [{ urun: 'guclendirici_paketi', jeton: 'gec2' }];
    g.onPlanaDondu();
    await g.bekleyenleriIsle();
    expect(r.adimlar.filter((a) => a.startsWith('tamamla'))).toEqual(['tamamla:gec1', 'tamamla:gec2']);
    expect(kayit().guclendiriciler).toEqual(meta.GUCLENDIRICI_PAKETI);
  });
  it('ön plana dönüş satın alma akışı sürerken bekleyenleri sormaz', async () => {
    let bitir!: (s: SatinAlmaSonucu) => void;
    const ayar = { bekleyen: [{ urun: 'guclendirici_paketi' as UrunId, jeton: 'x1' }] };
    const { g, r } = kur(kayitCanli(2), ayar);
    g.baslat();
    await g.bekleyenleriIsle();
    const once = r.adimlar.length;
    await g.urunleriYukle();
    // Ödeme ekranı açık: satinAl çözülmeden dönüş olayı gelir.
    const o = (g as unknown as { o: GelirOrtami }).o;
    const asil = o.saglayici.satinAl;
    o.saglayici.satinAl = (id) => {
      r.adimlar.push(`satinAl:${id}`);
      return new Promise<SatinAlmaSonucu>((c) => (bitir = c));
    };
    const s = g.satinAl('can_doldur');
    await Promise.resolve();
    ayar.bekleyen = [{ urun: 'guclendirici_paketi', jeton: 'x2' }];
    g.onPlanaDondu();
    await Promise.resolve();
    bitir({ durum: 'iptal' });
    expect(await s).toBe('iptal');
    expect(r.adimlar.slice(once)).toEqual(['satinAl:can_doldur']);
    o.saglayici.satinAl = asil;
  });
  it('geri yükleme yalnız kalıcı ürünü verir; zaten sendeyse kayıt aynı; boş liste ayrı bildirim', async () => {
    const { g, kayit, r } = kur(meta.yeniKayit(1), { geri: ['usta_karti'] });
    expect(await g.geriYukle()).toBe(true);
    expect(kayit().gelir?.ustaKarti).toBe(true);
    const k1 = kayit();
    expect(await g.geriYukle()).toBe(false);
    expect(kayit()).toBe(k1);
    const bos = kur(meta.yeniKayit(1), { geri: [] });
    expect(await bos.g.geriYukle()).toBe(false);
    expect(bos.kayit().gelir).toBeUndefined();
    expect([...r.bildirimler, ...bos.r.bildirimler]).toEqual(['Satın alımlar geri yüklendi', 'Satın alımlar geri yüklendi', 'Geri yüklenecek satın alım yok']);
  });
  it('geri yükleme yapılamadı (sağlayıcı reddetti): "yok" değil "yapılamadı"; kayıt aynı', async () => {
    const k = meta.yeniKayit(1);
    const { g, kayit, r } = kur(k, { geri: 'hata' });
    expect(await g.geriYukle()).toBe(false);
    expect(kayit()).toBe(k);
    expect(r.bildirimler).toEqual(['Geri yükleme şu an yapılamadı']);
  });
});

describe('GelirAkisi: can', () => {
  it('canHarca: kayıt hemen yazılır, can_harcandi; 0\'a inerse can_bitti; 0\'da düşmez', () => {
    const { g, r, kayit } = kur(kayitCanli(1));
    expect(g.canHarca({ id: 9 }, 'kayip')).toBe(0);
    expect(r.adimlar).toContain('yaz');
    expect(r.olaylar).toEqual([
      { ad: 'can_harcandi', p: { neden: 'kayip', kalan: 0, bolum: 9 } },
      { ad: 'can_bitti', p: { bolum: 9 } },
    ]);
    expect(g.canHarca({ id: 9 }, 'cikis')).toBeNull();
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(0);
  });
  it('can_bitti aynı an için bir kez: son canla çıkışın hemen ardından gelen kapı yeniden yazmaz', () => {
    const { g, r, saat } = kur(kayitCanli(1));
    g.canHarca({ id: 9 }, 'cikis');
    saat.t += 50;
    g.canBitti({ id: 9 });
    expect(adlar(r).filter((a) => a === 'can_bitti')).toHaveLength(1);
    // Sonraki deneme (başka an ya da başka bölüm) yine yazılır.
    g.canBitti({ id: 9 });
    saat.t += 60_000;
    g.canBitti({ id: 10 });
    expect(adlar(r).filter((a) => a === 'can_bitti')).toHaveLength(3);
  });
  it('tembel dolum: 30 dk sonra +1 kayda yazılır, can_doldu zaman bir kez', () => {
    const { g, r, kayit, saat } = kur(kayitCanli(3));
    saat.t = T0 + meta.CAN_DOLUM_MS + 5;
    expect(g.tazele().sayi).toBe(4);
    expect(kayit().can?.sayi).toBe(4);
    expect(g.tazele().sayi).toBe(4);
    expect(adlar(r)).toEqual(['can_doldu']);
    expect(r.olaylar[0].p).toEqual({ neden: 'zaman' });
  });
  it('dolum işlemden önce yazılır: harcama farkı yalnız kendi etkisi', () => {
    const { g, r, saat } = kur(kayitCanli(3));
    saat.t = T0 + meta.CAN_DOLUM_MS;
    expect(g.canHarca({ id: 12 }, 'cikis')).toBe(3);
    expect(adlar(r)).toEqual(['can_doldu', 'can_harcandi']);
  });
  it('canIade: +1, can_doldu iade; 5\'te bir şey yapmaz', () => {
    const { g, r, kayit } = kur(kayitCanli(4));
    g.canIade();
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    g.canIade();
    expect(r.olaylar).toEqual([{ ad: 'can_doldu', p: { neden: 'iade' } }]);
  });
  it('varsayılan kayıtta (can alanı yok) tazele ve iade kaydı değiştirmez', () => {
    const k = meta.yeniKayit(5);
    const { g, r, kayit } = kur(k);
    g.tazele();
    g.canIade();
    expect(kayit()).toBe(k);
    expect(r.adimlar).toEqual([]);
  });
  it('canAyarla tam nesne yazar (dolum saati şimdi)', () => {
    const { g, kayit } = kur(meta.yeniKayit(5));
    g.canAyarla(2);
    expect(kayit().can).toEqual({ sayi: 2, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    g.canAyarla(5);
    expect(kayit().can?.dolumBasi).toBeNull();
  });
});

describe('GelirAkisi: reklam ve can paneli', () => {
  it('Usta kartı: reklamsız ödül, reklam_sonuc kart: true; reklam gösterilmez', async () => {
    const { g, r } = kur(kayitCanli(2, { gelir: { ustaKarti: true, jetonlar: [] } }));
    expect(await g.reklamOdulu('hamle')).toBe('odul');
    expect(r.adimlar).toEqual([]);
    expect(r.olaylar).toEqual([{ ad: 'reklam_sonuc', p: { yer: 'hamle', sonuc: 'odul', kart: true } }]);
  });
  it('reklam açıkken ses/çizici kipi; yok ve hata → "Şu an reklam yok"', async () => {
    const a = kur(kayitCanli(2));
    expect(await a.g.reklamOdulu('hamle')).toBe('odul');
    expect(a.r.adimlar).toEqual(['kip:true', 'reklam:hamle', 'kip:false']);
    expect(a.r.bildirimler).toEqual([]);
    for (const s of ['yok', 'hata'] as const) {
      const b = kur(kayitCanli(2), { reklam: s });
      expect(await b.g.reklamOdulu('can')).toBe(s);
      expect(b.r.bildirimler).toEqual(['Şu an reklam yok']);
    }
  });
  it('panel döngüsü: üç reklam +3 can, sonra "Yarın yine" (teklif yok); kapat ile biter', async () => {
    const vmler: CanVM[] = [];
    const secimler: CanPaneliSecimi[] = ['reklam', 'reklam', 'reklam', 'kapat'];
    const { g, r, kayit } = kur(kayitCanli(0), {}, {
      canPaneli: async (vm) => {
        vmler.push(vm);
        return secimler.shift() ?? 'kapat';
      },
    });
    await g.canPaneliAkisi();
    expect(vmler.map((v) => [v.tur, v.sayi, v.reklam?.hak])).toEqual([
      ['bitti', 0, 3],
      ['durum', 1, 2],
      ['durum', 2, 1],
      ['durum', 3, 0],
    ]);
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(3);
    expect(adlar(r).filter((a) => a === 'reklam_teklif')).toHaveLength(3);
    expect(adlar(r).filter((a) => a === 'can_doldu')).toHaveLength(3);
  });
  it('iptal: panel yerinde (yeniden açılır, satır durur); yok: satır gizlenir', async () => {
    const vmler: CanVM[] = [];
    const secimler: CanPaneliSecimi[] = ['reklam', 'kapat'];
    const a = kur(kayitCanli(1), { reklam: 'iptal' }, {
      canPaneli: async (vm) => {
        vmler.push(vm);
        return secimler.shift() ?? 'kapat';
      },
    });
    await a.g.canPaneliAkisi();
    expect(vmler.map((v) => v.reklam?.hazir)).toEqual([true, true]);
    const vmler2: CanVM[] = [];
    const secimler2: CanPaneliSecimi[] = ['reklam', 'kapat'];
    const b = kur(kayitCanli(1), { reklam: 'yok' }, {
      canPaneli: async (vm) => {
        vmler2.push(vm);
        return secimler2.shift() ?? 'kapat';
      },
    });
    await b.g.canPaneliAkisi();
    expect(vmler2.map((v) => v.reklam?.hazir)).toEqual([true, false]);
  });
  it('reklam_teklif aynı teklif için bir kez: iptal ve vazgeçilen satın almadan sonra yeniden sayılmaz', async () => {
    const secimler: CanPaneliSecimi[] = ['reklam', 'doldur', 'kapat'];
    const { g, r } = kur(kayitCanli(1), { reklam: 'iptal', satin: { durum: 'iptal' } }, { canPaneli: async () => secimler.shift() ?? 'kapat' });
    await g.urunleriYukle();
    await g.canPaneliAkisi();
    expect(adlar(r).filter((a) => a === 'reklam_teklif')).toHaveLength(1);
  });
  it('kapı: Bekle haritaya döner, panel açıkken zamanla can dolmuş olsa da', async () => {
    const a = kur(kayitCanli(0));
    a.saat.t = T0 + meta.CAN_DOLUM_MS + 1;
    expect(await a.g.canPaneliAkisi({ kapi: true })).toBe('kapat');
    expect(a.g.durum().sayi).toBe(1);
    const b = kur(kayitCanli(0), {}, { canPaneli: async () => 'reklam' });
    expect(await b.g.canPaneliAkisi({ kapi: true })).toBe('can');
  });
  it('kapı: reklam can verince panel kapanır (bölüm başlar)', async () => {
    let acilis = 0;
    const { g } = kur(kayitCanli(0), {}, {
      canPaneli: async () => {
        acilis++;
        return 'reklam';
      },
    });
    await g.canPaneliAkisi({ kapi: true });
    expect(acilis).toBe(1);
    expect(g.durum().sayi).toBe(1);
  });
  it('panelden doldur: satın alma, can 5', async () => {
    const secimler: CanPaneliSecimi[] = ['doldur', 'kapat'];
    const { g, kayit } = kur(kayitCanli(0), {}, { canPaneli: async () => secimler.shift() ?? 'kapat' });
    await g.urunleriYukle();
    await g.canPaneliAkisi();
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
  });
  it('Mağaza döngüsü: satın al → yeniden açılır (Usta kartı "sende"), kapat', async () => {
    const vmler: MagazaVM[] = [];
    const secimler: MagazaSecimi[] = [{ tur: 'satinAl', id: 'usta_karti' }, { tur: 'kapat' }];
    const { g } = kur(meta.yeniKayit(2), {}, {
      magaza: async (vm) => {
        vmler.push(vm);
        return secimler.shift() ?? { tur: 'kapat' };
      },
    });
    await g.urunleriYukle();
    await g.magazaAkisi();
    expect(vmler.map((v) => v.urunler.find((u) => u.id === 'usta_karti')?.durum)).toEqual(['satilik', 'sende']);
  });
});

describe('kayitKoduGelirKoru', () => {
  it('can ve satın almalar cihazda kalır: kod yalnız ilerlemeyi taşır', () => {
    const eski = kayitCanli(1, { gelir: { ustaKarti: true, jetonlar: ['a'] } });
    const kod = kayitCanli(5, { gelir: { ustaKarti: false, jetonlar: ['b'] } });
    kod.can = { sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 };
    const y = kayitKoduGelirKoru(kod, eski);
    expect(y.can).toEqual(eski.can);
    expect(y.gelir).toEqual({ ustaKarti: true, jetonlar: ['a'] });
    expect(y.gelir).not.toBe(eski.gelir);
    expect(kod.can.sayi).toBe(5);
  });
  it('koddaki Usta kartı ve jetonlar bu cihaza geçmez (bedava kart, jeton taşması yok)', () => {
    const cihazJetonlari = Array.from({ length: 50 }, (_, i) => `c${i}`);
    const eski = kayitCanli(3, { gelir: { ustaKarti: false, jetonlar: cihazJetonlari } });
    const kod = kayitCanli(5, { gelir: { ustaKarti: true, jetonlar: Array.from({ length: 50 }, (_, i) => `k${i}`) } });
    const y = kayitKoduGelirKoru(kod, eski);
    expect(y.gelir).toEqual({ ustaKarti: false, jetonlar: cihazJetonlari });
    // Cihazda satın alma yoksa koddan da gelmez.
    expect(kayitKoduGelirKoru(kod, meta.yeniKayit(2)).gelir).toBeUndefined();
  });
  it('eski kayıtta alan yoksa yeni kayıttan da kalkar', () => {
    const kod = kayitCanli(0, { gelir: { ustaKarti: false, jetonlar: [] } });
    const y = kayitKoduGelirKoru(kod, meta.yeniKayit(2));
    expect(y.can).toBeUndefined();
    expect(y.gelir).toBeUndefined();
  });
});

describe('Aşama 2b (§14): başlangıç paketi, büyük paket, hediye sandığı', () => {
  it('başlangıç paketi: canlar dolar + 3/3/3, bir kez; ikinci jeton ödül vermez ama tamamlanır', async () => {
    const { g, r, kayit } = kur(kayitCanli(1));
    await g.urunleriYukle();
    expect(await g.satinAl('baslangic_paketi')).toBe('verildi');
    expect(meta.canDurumu(kayit(), T0).sayi).toBe(5);
    expect(kayit().guclendiriciler).toEqual(meta.BASLANGIC_PAKETI);
    expect(kayit().gelir?.baslangic).toBe(true);
    // Mağaza artık teklif etmez; yine de gelen (ör. ikinci cihaz) satın alma tamamlanır, ödül tekrar verilmez.
    expect(await g.satinAl('baslangic_paketi')).toBe('satilmaz');
    const once = kayit().guclendiriciler.kibrit;
    const x = meta.satinAlmaUygula(kayit(), 'baslangic_paketi', 'ikinci', T0);
    expect(x).toMatchObject({ verildi: false, tekrar: true });
    expect(x.kayit.guclendiriciler.kibrit).toBe(once);
    expect(r.adimlar).toContain('tamamla:j1');
  });
  it('büyük paket: 6/5/5 stoğa; sınır 15 aşılırsa satılmaz', async () => {
    const { g, kayit } = kur(meta.yeniKayit(3));
    await g.urunleriYukle();
    expect(await g.satinAl('buyuk_paket')).toBe('verildi');
    expect(kayit().guclendiriciler).toEqual(meta.BUYUK_PAKET);
    expect(await g.satinAl('buyuk_paket')).toBe('verildi');
    expect(kayit().guclendiriciler).toEqual({ kibrit: 12, kalip: 10, geriSar: 10 });
    expect(await g.satinAl('buyuk_paket')).toBe('satilmaz');
  });
  it('hediye sandığı: sandık sistemi kapalıyken, günlük/sonsuzda ve bugün kullanıldıysa teklif yok', async () => {
    const kapali = kur(kayitCanli(5));
    expect(kapali.g.hediyeSandikTeklif({ tur: 'normal' })).toBeNull();
    const k = kayitCanli(5);
    for (let i = 1; i <= meta.SANDIK_ACILIS_BOLUMU; i++) k.bolumler[String(i)] = { yildiz: 1, enIyi: 100, deneme: 1, basarisizSeri: 0, kazanc: 1 } as never;
    const { g, r, kayit } = kur(k);
    expect(g.hediyeSandikTeklif({ tur: 'gunluk' })).toBeNull();
    expect(g.hediyeSandikTeklif({ tur: 'normal' })).toEqual({ kart: false });
    expect(r.olaylar).toContainEqual({ ad: 'reklam_teklif', p: { yer: 'sandik' } });
    const sayac = kayit().sandik.sayac;
    const s = await g.hediyeSandikAl();
    expect(s?.tur).toBe('normal');
    expect(s?.oduller.length).toBeGreaterThan(0);
    expect(r.adimlar).toContain('reklam:sandik');
    expect(kayit().sandik.sayac).toBe(sayac + 1);
    expect(kayit().can?.sandikGun).toBe(GUN);
    expect(g.hediyeSandikTeklif({ tur: 'normal' })).toBeNull();
    expect(await g.hediyeSandikAl()).toBeNull();
  });
  it('hediye sandığı: reklam iptal/yok → sandık yok, gün işaretlenmez; Usta kartıyla reklamsız', async () => {
    const k = kayitCanli(5);
    for (let i = 1; i <= meta.SANDIK_ACILIS_BOLUMU; i++) k.bolumler[String(i)] = { yildiz: 1, enIyi: 100, deneme: 1, basarisizSeri: 0, kazanc: 1 } as never;
    const iptal = kur(k, { reklam: 'iptal' });
    expect(await iptal.g.hediyeSandikAl()).toBeNull();
    expect(iptal.kayit().can?.sandikGun).toBeUndefined();
    const hazirDegil = kur(k, { hazir: false });
    expect(hazirDegil.g.hediyeSandikTeklif({ tur: 'usta' })).toBeNull();
    const kartli = kur({ ...k, gelir: { ustaKarti: true, jetonlar: [] } }, { hazir: false });
    expect(kartli.g.hediyeSandikTeklif({ tur: 'usta' })).toEqual({ kart: true });
    expect(await kartli.g.hediyeSandikAl()).not.toBeNull();
    expect(kartli.r.adimlar.some((a) => a.startsWith('reklam:'))).toBe(false);
  });
});
