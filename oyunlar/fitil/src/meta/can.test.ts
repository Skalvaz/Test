/**
 * Can, ödüllü reklam hakkı ve satın alma ödülü (docs/CAN-REKLAM.md §2–§4, §7,
 * §13 G1): dolum sınırları, saat geri, gün değişimi, tavan, jeton tekrarı,
 * paket stok sınırı, açılmamış güçlendirici, onarım, birleştirme, eski kayıt.
 */
import { describe, expect, it } from 'vitest';
import { GUCLENDIRICI_STOK_SINIRI } from '../app/katalog';
import { rngInt } from '../core/rng';
import { TUM_BOLUMLER } from '../levels';
import { URUN_IDLERI, URUN_TURLERI } from '../platform/gelir';
import type { UrunId } from '../platform/gelir';
import b03 from './_test/kayitlar/sema2-bolum03.json';
import b14 from './_test/kayitlar/sema2-bolum14.json';
import b27 from './_test/kayitlar/sema2-bolum27.json';
import { ilerlet, kazan } from './_test/yardimci';
import {
  CAN_DOLUM_MS,
  CAN_ENCOK,
  CAN_UCRETSIZ_SON_BOLUM,
  GUCLENDIRICI_PAKETI,
  JETON_EN_UZUN,
  JETON_SINIRI,
  REKLAM_CAN_GUNLUK,
  canDoldur,
  canDurumu,
  canEkle,
  canGerekirMi,
  canHarca,
  canIade,
  canOnar,
  canTazele,
  gelirBirlestir,
  gelirOnar,
  geriYuklemeUygula,
  jetonGecerli,
  paketSigarMi,
  reklamCanHakki,
  reklamCanKullan,
  satinAlmaUygula,
  varsayilanCan,
  varsayilanGelir,
} from './can';
import type { CanKaydi } from './can';
import { kancaBirlestir } from './kasaba';
import { KAYIT_ANAHTARI, KAYIT_YEDEK_ANAHTARLARI } from './sabitler';
import { ilerlemeyiSifirla, kayitCoz, kayitDeposuAyarlari, kayitKoduCoz, kayitKoduUret, kayitKopyala, kayitOnar, kayitYukle, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { tarihEkle } from './takvim';

/** Sabit bir duvar saati (22 Ekim 2026 öğle, UTC; meta Date kullanmaz). */
const T0 = 1_792_670_400_000;
const D = 20261022;
const DK = 60 * 1000;

function canli(c: Partial<CanKaydi>, k: Kayit = yeniKayit(1)): Kayit {
  return { ...kayitKopyala(k), can: { ...varsayilanCan(), ...c } };
}

function anlik(k: Kayit): string {
  return JSON.stringify(k);
}

describe('sabitler ve canGerekirMi (C2, C3)', () => {
  it('5 can, 30 dk dolum, 1–5 ücretsiz, günde 3 reklam, paket 3/2/2, 50 jeton', () => {
    expect(CAN_ENCOK).toBe(5);
    expect(CAN_DOLUM_MS).toBe(1_800_000);
    expect(CAN_UCRETSIZ_SON_BOLUM).toBe(5);
    expect(REKLAM_CAN_GUNLUK).toBe(3);
    expect(GUCLENDIRICI_PAKETI).toEqual({ kibrit: 3, kalip: 2, geriSar: 2 });
    expect(JETON_SINIRI).toBe(50);
    expect(varsayilanCan()).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    expect(varsayilanGelir()).toEqual({ ustaKarti: false, jetonlar: [] });
    // Her çağrı yeni nesne (paylaşılan varsayılan değişmesin).
    expect(varsayilanCan()).not.toBe(varsayilanCan());
    expect(varsayilanGelir().jetonlar).not.toBe(varsayilanGelir().jetonlar);
  });

  it('gerçek bölümler: ana ≥ 6 ve Usta can harcar; öğretim + İskele (1–5) ücretsiz', () => {
    let ana = 0;
    let usta = 0;
    for (const v of TUM_BOLUMLER) {
      if (v.tur === 'usta') {
        usta++;
        expect(canGerekirMi(v)).toBe(true);
      } else {
        ana++;
        expect(canGerekirMi(v), `bölüm ${v.id} (${v.tur})`).toBe(v.id >= 6);
      }
    }
    expect(ana).toBeGreaterThanOrEqual(40);
    expect(usta).toBeGreaterThanOrEqual(8);
  });

  it('Günün Şenliği ve Sonsuz Şenlik ücretsiz; tür kimlikten önce gelir', () => {
    expect(canGerekirMi({ tur: 'gunluk', id: 20261022 })).toBe(false);
    expect(canGerekirMi({ tur: 'sonsuz', id: 1_000_007 })).toBe(false);
    expect(canGerekirMi({ tur: 'ogretim', id: 5 })).toBe(false);
    expect(canGerekirMi({ tur: 'tanitim', id: 6 })).toBe(true);
    expect(canGerekirMi({ tur: 'usta', id: 101 })).toBe(true);
    expect(canGerekirMi({ tur: 'final', id: 40 })).toBe(true);
    // Bilinmeyen tür (ileriki sürüm) oyunu kilitlemez.
    expect(canGerekirMi({ tur: 'yeniTur' as 'normal', id: 30 })).toBe(false);
  });
});

describe('dolum (§2: tembel, 30 dk, tavan 5, saat geri)', () => {
  it('can alanı yoksa 5 dolu, sayaç yok', () => {
    const k = yeniKayit(1);
    expect(k.can).toBeUndefined();
    expect(canDurumu(k, T0)).toEqual({ sayi: 5, enCok: 5, sonrakiMs: null });
  });

  it('sınırlar: 29:59 → aynı, 30:00 → +1, 2 saat → tavan', () => {
    const k = canli({ sayi: 3, dolumBasi: T0 });
    const once = anlik(k);
    expect(canDurumu(k, T0)).toEqual({ sayi: 3, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    expect(canDurumu(k, T0 + 29 * DK + 59_000)).toEqual({ sayi: 3, enCok: 5, sonrakiMs: 1000 });
    expect(canDurumu(k, T0 + CAN_DOLUM_MS - 1)).toEqual({ sayi: 3, enCok: 5, sonrakiMs: 1 });
    expect(canDurumu(k, T0 + 30 * DK)).toEqual({ sayi: 4, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    expect(canDurumu(k, T0 + 59 * DK + 59_000)).toEqual({ sayi: 4, enCok: 5, sonrakiMs: 1000 });
    expect(canDurumu(k, T0 + 60 * DK)).toEqual({ sayi: 5, enCok: 5, sonrakiMs: null });
    expect(canDurumu(k, T0 + 120 * DK)).toEqual({ sayi: 5, enCok: 5, sonrakiMs: null });
    expect(anlik(k)).toBe(once); // okuma kaydı değiştirmez
  });

  it('0 candan 2 saatte 4 can, 2,5 saatte 5; dolumBasi tam dönemlerle kayar', () => {
    const k = canli({ sayi: 0, dolumBasi: T0 });
    expect(canDurumu(k, T0 + 120 * DK)).toEqual({ sayi: 4, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    expect(canDurumu(k, T0 + 130 * DK).sonrakiMs).toBe(20 * DK);
    const t = canTazele(k, T0 + 130 * DK);
    expect(t.can).toEqual({ sayi: 4, dolumBasi: T0 + 120 * DK, reklamGun: 0, reklamSayisi: 0 });
    expect(canDurumu(k, T0 + 150 * DK)).toEqual({ sayi: 5, enCok: 5, sonrakiMs: null });
    expect(canTazele(k, T0 + 150 * DK).can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
  });

  it('saat geri: eksi süre ve ceza yok, dolum şimdiden başlar (kayda canTazele yazar)', () => {
    const k = canli({ sayi: 2, dolumBasi: T0 });
    const geri = T0 - 60 * DK;
    expect(canDurumu(k, geri)).toEqual({ sayi: 2, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    const t = canTazele(k, geri);
    expect(t).not.toBe(k);
    expect(t.can).toEqual({ sayi: 2, dolumBasi: geri, reklamGun: 0, reklamSayisi: 0 });
    // Saat yeniden ileri: yeni başlangıçtan 30 dk sonra +1 (geri sarılan süre can vermez).
    expect(canDurumu(t, geri + 30 * DK).sayi).toBe(3);
    expect(canDurumu(t, T0).sayi).toBe(4);
    // Saat geri gidip can doluysa hiçbir şey değişmez.
    expect(canTazele(canli({ sayi: 5 }), 0)).toEqual(canli({ sayi: 5 }));
  });

  it('can < 5 ama dolum başlamamışsa (elle yamalanmış kayıt) dolum şimdi başlar', () => {
    const k = canli({ sayi: 1, dolumBasi: null });
    expect(canDurumu(k, T0)).toEqual({ sayi: 1, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    expect(canTazele(k, T0).can?.dolumBasi).toBe(T0);
  });

  it('canTazele: değişiklik yoksa aynı nesne; varsayılan can alanı eklenmez', () => {
    const bos = yeniKayit(2);
    expect(canTazele(bos, T0)).toBe(bos);
    const dolu = canli({ sayi: 5 });
    expect(canTazele(dolu, T0)).toBe(dolu);
    const suren = canli({ sayi: 3, dolumBasi: T0 });
    expect(canTazele(suren, T0 + 10 * DK)).toBe(suren);
    expect(canTazele(suren, T0 + 30 * DK)).not.toBe(suren);
    // Kesirli saat aşağı yuvarlanır; geçersiz saat dokunmaz.
    expect(canTazele(canli({ sayi: 4, dolumBasi: null }), T0 + 0.7).can?.dolumBasi).toBe(T0);
    for (const kotu of [NaN, Infinity, -1]) {
      expect(canTazele(suren, kotu)).toBe(suren);
      expect(canDurumu(suren, kotu)).toEqual({ sayi: 3, enCok: 5, sonrakiMs: CAN_DOLUM_MS });
    }
  });
});

describe('harcama, iade, ekleme (C4)', () => {
  it('kayıp: 5 → 4 dolumu başlatır; dolum sürerken sayaç baştan başlamaz; 0 → aynı nesne', () => {
    const k0 = yeniKayit(3);
    const once = anlik(k0);
    const k1 = canHarca(k0, T0, 'kayip');
    expect(anlik(k0)).toBe(once); // girdi değişmez
    expect(k1.can).toEqual({ sayi: 4, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    const k2 = canHarca(k1, T0 + 10 * DK, 'cikis');
    expect(k2.can).toEqual({ sayi: 3, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    expect(canDurumu(k2, T0 + 10 * DK).sonrakiMs).toBe(20 * DK);
    let k = k2;
    for (let i = 0; i < 3; i++) k = canHarca(k, T0 + 11 * DK, 'kayip');
    expect(canDurumu(k, T0 + 11 * DK).sayi).toBe(0);
    expect(canHarca(k, T0 + 11 * DK, 'kayip')).toBe(k);
  });

  it('harcamadan önce tembel dolum uygulanır (dolan can harcanır, ikinci kez sayılmaz)', () => {
    const k = canli({ sayi: 0, dolumBasi: T0 });
    const h = canHarca(k, T0 + 45 * DK, 'kayip');
    expect(h.can).toEqual({ sayi: 0, dolumBasi: T0 + 30 * DK, reklamGun: 0, reklamSayisi: 0 });
    // 4 can + 30 dk dolum → 5 (dolum durur) → harca → 4, sayaç harcama anında başlar.
    const d = canHarca(canli({ sayi: 4, dolumBasi: T0 }), T0 + 31 * DK, 'kayip');
    expect(d.can).toEqual({ sayi: 4, dolumBasi: T0 + 31 * DK, reklamGun: 0, reklamSayisi: 0 });
  });

  it('iade: +1, 5 aşılmaz, 5te dolum durur; dolu iken aynı nesne', () => {
    const k = canHarca(yeniKayit(4), T0, 'kayip');
    const i = canIade(k, T0 + 2 * DK);
    expect(i.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    expect(canIade(i, T0 + 3 * DK)).toBe(i);
    expect(canIade(yeniKayit(4), T0)).toEqual(yeniKayit(4));
    // Dolum sürerken iade sayacı korur.
    const u = canIade(canli({ sayi: 2, dolumBasi: T0 }), T0 + 5 * DK);
    expect(u.can).toEqual({ sayi: 3, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    // Uzun devamda dolum zaten 5'e getirdiyse iade fazla vermez.
    expect(canDurumu(canIade(canli({ sayi: 4, dolumBasi: T0 }), T0 + 31 * DK), T0 + 31 * DK).sayi).toBe(5);
  });

  it('canEkle: tavanı aşmaz; geçersiz n → aynı nesne', () => {
    const k = canli({ sayi: 2, dolumBasi: T0 });
    expect(canEkle(k, T0, 2).can).toEqual({ sayi: 4, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    expect(canEkle(k, T0, 10).can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    for (const n of [0, -1, 1.5, NaN, Infinity]) expect(canEkle(k, T0, n)).toBe(k);
  });

  it('canDoldur: 5 can, dolum durur, reklam sayacı korunur; doluyken aynı nesne', () => {
    const k = canli({ sayi: 1, dolumBasi: T0, reklamGun: D, reklamSayisi: 2 });
    expect(canDoldur(k, T0).can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: D, reklamSayisi: 2 });
    const bos = yeniKayit(5);
    expect(canDoldur(bos, T0)).toBe(bos);
  });
});

describe('ödüllü reklam hakkı (C6, C9)', () => {
  it('günde 3; can 5 iken hak harcanmaz; hak bitince aynı nesne; ertesi gün sıfırlanır', () => {
    let k = yeniKayit(6);
    for (let i = 0; i < 4; i++) k = canHarca(k, T0, 'kayip');
    expect(canDurumu(k, T0).sayi).toBe(1);
    expect(reklamCanHakki(k, D)).toBe(3);
    k = reklamCanKullan(k, T0 + DK, D);
    expect(canDurumu(k, T0 + DK).sayi).toBe(2);
    expect(reklamCanHakki(k, D)).toBe(2);
    expect(k.can).toMatchObject({ reklamGun: D, reklamSayisi: 1, dolumBasi: T0 });
    k = reklamCanKullan(k, T0 + 2 * DK, D);
    k = reklamCanKullan(k, T0 + 3 * DK, D);
    expect(canDurumu(k, T0 + 3 * DK).sayi).toBe(4);
    expect(reklamCanHakki(k, D)).toBe(0);
    expect(reklamCanKullan(k, T0 + 4 * DK, D)).toBe(k); // "Yarın yine"
    // Ertesi gün (yerel takvim günü değişti): hak yeniden 3.
    const yarin = tarihEkle(D, 1);
    expect(reklamCanHakki(k, yarin)).toBe(3);
    const y = reklamCanKullan(k, T0 + 5 * DK, yarin);
    expect(y.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: yarin, reklamSayisi: 1 });
    // Can 5: hak harcanmaz, aynı nesne.
    expect(reklamCanKullan(y, T0 + 6 * DK, yarin)).toBe(y);
    expect(reklamCanHakki(y, yarin)).toBe(2);
  });

  it('hak can doluluğuna bakmaz; gün yalnız eşitlikle karşılaştırılır (geri saat de "başka gün")', () => {
    const k = canli({ sayi: 5, reklamGun: D, reklamSayisi: 3 });
    expect(reklamCanHakki(k, D)).toBe(0);
    expect(reklamCanHakki(k, tarihEkle(D, -1))).toBe(3);
    expect(reklamCanHakki(yeniKayit(1), D)).toBe(3);
  });

  it('reklam ödülü önce tembel dolumu uygular (dolan can tavanı aşmaz)', () => {
    const k = canli({ sayi: 4, dolumBasi: T0 });
    // 30 dk geçti: dolum 5'e getirdi, reklam canı verilmez, hak harcanmaz, dolum yazılır.
    const r = reklamCanKullan(k, T0 + 30 * DK, D);
    expect(r.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    expect(reklamCanHakki(r, D)).toBe(3);
  });

  it('geçersiz gün ya da saat hak vermez, kayda dokunmaz', () => {
    const k = canli({ sayi: 2, dolumBasi: T0 });
    for (const g of [0, 20261332, 1.5, NaN]) {
      expect(reklamCanHakki(k, g)).toBe(0);
      expect(reklamCanKullan(k, T0, g)).toBe(k);
    }
    expect(reklamCanKullan(k, NaN, D)).toBe(k);
  });
});

describe('satın alma (§4, C8, C13): jeton korumalı', () => {
  it('can_doldur: 5 can; aynı jeton ikinci kez vermez (tekrar); dolu iken de verildi', () => {
    const k = canli({ sayi: 1, dolumBasi: T0 });
    const once = anlik(k);
    const r = satinAlmaUygula(k, 'can_doldur', 'jeton-1', T0 + DK);
    expect(anlik(k)).toBe(once);
    expect(r.verildi).toBe(true);
    expect(r.tekrar).toBe(false);
    expect(r.kayit.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    expect(r.kayit.gelir).toEqual({ ustaKarti: false, jetonlar: ['jeton-1'] });
    const t = satinAlmaUygula(canHarca(r.kayit, T0 + 2 * DK, 'kayip'), 'can_doldur', 'jeton-1', T0 + 3 * DK);
    expect(t.tekrar).toBe(true);
    expect(t.verildi).toBe(false);
    expect(canDurumu(t.kayit, T0 + 3 * DK).sayi).toBe(4); // ödül yok
    // Dolu canla satın alma (ödeme alınmış): verildi, jeton yazılır.
    const d = satinAlmaUygula(yeniKayit(1), 'can_doldur', 'jeton-2', T0);
    expect(d.verildi).toBe(true);
    expect(d.kayit.gelir?.jetonlar).toEqual(['jeton-2']);
    expect(d.kayit.can).toBeUndefined(); // varsayılan can alanı eklenmez
  });

  it('güçlendirici paketi açılmamış güçlendiriciye de stok verir, toza dönmez (C13)', () => {
    const k = yeniKayit(8); // hiçbir güçlendirici açık değil
    expect(paketSigarMi(k)).toBe(true);
    const r = satinAlmaUygula(k, 'guclendirici_paketi', 'p1', T0);
    expect(r.verildi).toBe(true);
    expect(r.kayit.guclendiriciler).toEqual({ kibrit: 3, kalip: 2, geriSar: 2 });
    expect(r.kayit.toz).toBe(0);
    expect(r.kayit.can).toBeUndefined();
    // Onarım stoğu korur (stok sınırı açılmadan bağımsız).
    expect(kayitOnar(JSON.parse(anlik(r.kayit))).onarilan).toEqual([]);
    // İkinci paket sığmaz: verilmez, kayıt aynen döner, jeton yazılmaz (tamamla çağrılmaz).
    expect(paketSigarMi(r.kayit)).toBe(false);
    const s = satinAlmaUygula(r.kayit, 'guclendirici_paketi', 'p2', T0);
    expect(s).toEqual({ kayit: r.kayit, verildi: false, tekrar: false });
    expect(s.kayit).toBe(r.kayit);
    // Kibrit 7. bölümde açılınca satın alınan stok yerinde kalır; açılış hediyesi sığmayan kısmı toza döner.
    const a = ilerlet(6, 1, r.kayit);
    expect(a.guclendiriciler.kibrit).toBe(GUCLENDIRICI_STOK_SINIRI);
    expect(a.toz).toBeGreaterThan(0);
  });

  it('paketSigarMi: her güçlendirici için stok + paket ≤ sınır', () => {
    const k = yeniKayit(9);
    const st = (kibrit: number, kalip: number, geriSar: number) => ({ ...kayitKopyala(k), guclendiriciler: { kibrit, kalip, geriSar } });
    expect(paketSigarMi(st(0, 1, 1))).toBe(true);
    expect(paketSigarMi(st(1, 0, 0))).toBe(false);
    expect(paketSigarMi(st(0, 2, 0))).toBe(false);
    expect(paketSigarMi(st(0, 0, 2))).toBe(false);
    // Açık oyuncu: 7. bölümde kibrit hediyesi (2) gelir; paket sığmaz ("Stok dolu").
    const acik = ilerlet(6, 1);
    expect(acik.guclendiriciler.kibrit).toBe(2);
    expect(paketSigarMi(acik)).toBe(false);
  });

  it('Usta kartı: kalıcı bayrak; zaten varken jeton yine yazılır', () => {
    const r = satinAlmaUygula(yeniKayit(2), 'usta_karti', 'u1', T0);
    expect(r.verildi).toBe(true);
    expect(r.kayit.gelir).toEqual({ ustaKarti: true, jetonlar: ['u1'] });
    const r2 = satinAlmaUygula(r.kayit, 'usta_karti', 'u2', T0);
    expect(r2.verildi).toBe(true);
    expect(r2.kayit.gelir).toEqual({ ustaKarti: true, jetonlar: ['u1', 'u2'] });
    expect(r2.kayit.can).toBeUndefined();
  });

  it('boş/geçersiz jeton ve bilinmeyen ürün verilmez (kayıt aynen)', () => {
    const k = canli({ sayi: 2, dolumBasi: T0 });
    for (const j of ['', '   ', 'x'.repeat(JETON_EN_UZUN + 1), undefined as unknown as string, 7 as unknown as string]) {
      expect(satinAlmaUygula(k, 'can_doldur', j, T0)).toEqual({ kayit: k, verildi: false, tekrar: false });
    }
    expect(satinAlmaUygula(k, 'yok_boyle' as UrunId, 'j', T0)).toEqual({ kayit: k, verildi: false, tekrar: false });
    expect(jetonGecerli('x'.repeat(JETON_EN_UZUN))).toBe(true);
  });

  it('jetonlar son 50 (eskiden yeniye); tembel dolum da yazılır', () => {
    let k = canli({ sayi: 3, dolumBasi: T0 });
    for (let i = 0; i < 60; i++) k = satinAlmaUygula(k, 'usta_karti', `j${i}`, T0).kayit;
    expect(k.gelir?.jetonlar).toHaveLength(JETON_SINIRI);
    expect(k.gelir?.jetonlar[0]).toBe('j10');
    expect(k.gelir?.jetonlar[JETON_SINIRI - 1]).toBe('j59');
    // Paket alırken 2 saat geçmişse dolum kayda yazılır.
    const p = satinAlmaUygula(canli({ sayi: 3, dolumBasi: T0 }), 'guclendirici_paketi', 'p', T0 + 120 * DK);
    expect(p.kayit.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
  });

  it('geri yükleme: yalnız kalıcı ürün, jetonsuz; değişiklik yoksa aynı nesne', () => {
    const k = yeniKayit(3);
    const g = geriYuklemeUygula(k, ['can_doldur', 'usta_karti']);
    expect(g.gelir).toEqual({ ustaKarti: true, jetonlar: [] });
    expect(geriYuklemeUygula(g, ['usta_karti'])).toBe(g);
    expect(geriYuklemeUygula(k, [])).toBe(k);
    expect(geriYuklemeUygula(k, ['can_doldur', 'guclendirici_paketi'])).toBe(k);
    expect(k.gelir).toBeUndefined();
  });

  it('ürün türleri: kalıcı yalnız usta_karti (geriYuklemeUygula buna göre)', () => {
    expect(URUN_IDLERI.filter((u) => URUN_TURLERI[u] === 'kalici')).toEqual(['usta_karti']);
  });
});

describe('kayıt onarımı ve kopya (§7)', () => {
  it('alan yoksa eklenmez, onarım sayılmaz; sağlam alan aynen kalır', () => {
    const k = yeniKayit(4);
    const r = kayitOnar(JSON.parse(anlik(k)));
    expect(r.onarilan).toEqual([]);
    expect('can' in r.kayit).toBe(false);
    expect('gelir' in r.kayit).toBe(false);
    const dolu: Kayit = { ...canli({ sayi: 2, dolumBasi: T0, reklamGun: D, reklamSayisi: 1 }), gelir: { ustaKarti: true, jetonlar: ['a', 'b'] } };
    const r2 = kayitOnar(JSON.parse(anlik(dolu)));
    expect(r2.onarilan).toEqual([]);
    expect(r2.kayit).toEqual(dolu);
  });

  it('bozuk can → varsayılan ya da aralığa çekilir', () => {
    const tam = (can: unknown) => kayitOnar({ ...JSON.parse(anlik(yeniKayit(1))), can });
    let r = tam('bozuk');
    expect(r.kayit.can).toEqual(varsayilanCan());
    expect(r.onarilan).toContain('can');
    r = tam(null);
    expect(r.kayit.can).toEqual(varsayilanCan());
    r = tam({ sayi: 9, dolumBasi: -5, reklamGun: 20261399, reklamSayisi: 7, fazla: 1 });
    expect(r.kayit.can).toEqual({ sayi: 5, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    expect(r.onarilan).toEqual(expect.arrayContaining(['can.sayi', 'can.dolumBasi', 'can.reklamGun', 'can.reklamSayisi']));
    r = tam({ sayi: 2.7, dolumBasi: T0 + 0.5, reklamGun: D, reklamSayisi: 2 });
    expect(r.kayit.can).toEqual({ sayi: 2, dolumBasi: T0, reklamGun: D, reklamSayisi: 2 });
    r = tam({ sayi: -3, dolumBasi: 'dün', reklamGun: 0, reklamSayisi: 0 });
    expect(r.kayit.can).toEqual({ sayi: 0, dolumBasi: null, reklamGun: 0, reklamSayisi: 0 });
    // Can doluyken dolum sürmez; eksik alt alan varsayılan (bozuk kayıt can kaybettirmez).
    r = tam({ sayi: 5, dolumBasi: T0 });
    expect(r.kayit.can).toEqual(varsayilanCan());
    expect(r.onarilan).toContain('can.dolumBasi');
    r = tam({});
    expect(r.kayit.can).toEqual(varsayilanCan());
    expect(r.onarilan).toContain('can.sayi');
    // Onarılmış kayıt yeniden onarım gerektirmez.
    expect(kayitOnar(r.kayit).onarilan).toEqual([]);
    expect(canOnar({ sayi: 3, dolumBasi: T0, reklamGun: D, reklamSayisi: 3 })).toEqual({ sayi: 3, dolumBasi: T0, reklamGun: D, reklamSayisi: 3 });
  });

  it('bozuk gelir → varsayılan; jetonlar süzülür, tekrarsız, son 50', () => {
    const tam = (gelir: unknown) => kayitOnar({ ...JSON.parse(anlik(yeniKayit(1))), gelir });
    let r = tam([1, 2]);
    expect(r.kayit.gelir).toEqual(varsayilanGelir());
    expect(r.onarilan).toContain('gelir');
    r = tam({ ustaKarti: 'evet', jetonlar: ['a', '', 'a', 5, 'b', ' '] });
    expect(r.kayit.gelir).toEqual({ ustaKarti: false, jetonlar: ['a', 'b'] });
    expect(r.onarilan).toEqual(expect.arrayContaining(['gelir.ustaKarti', 'gelir.jetonlar']));
    r = tam({ ustaKarti: true, jetonlar: Array.from({ length: 60 }, (_, i) => `j${i}`) });
    expect(r.kayit.gelir?.jetonlar).toHaveLength(50);
    expect(r.kayit.gelir?.jetonlar[0]).toBe('j10');
    expect(r.kayit.gelir?.ustaKarti).toBe(true);
    r = tam({ ustaKarti: true, jetonlar: 'j1' });
    expect(r.kayit.gelir).toEqual({ ustaKarti: true, jetonlar: [] });
    expect(kayitOnar(r.kayit).onarilan).toEqual([]);
    expect(gelirOnar({ ustaKarti: true, jetonlar: ['x'] })).toEqual({ ustaKarti: true, jetonlar: ['x'] });
  });

  it('kayitKopyala derin kopya; kayıt kodu can ve geliri taşır', () => {
    const k: Kayit = { ...canli({ sayi: 3, dolumBasi: T0 }), gelir: { ustaKarti: true, jetonlar: ['a'] } };
    const y = kayitKopyala(k);
    y.can!.sayi = 0;
    y.gelir!.jetonlar.push('b');
    expect(k.can?.sayi).toBe(3);
    expect(k.gelir?.jetonlar).toEqual(['a']);
    const kod = kayitKoduCoz(kayitKoduUret(k));
    expect(kod.tamam && kod.kayit).toEqual(k);
  });

  it('ilerlemeyi sıfırla canı ve satın almaları korur', () => {
    const k: Kayit = { ...canli({ sayi: 1, dolumBasi: T0, reklamGun: D, reklamSayisi: 2 }, ilerlet(8, 2)), gelir: { ustaKarti: true, jetonlar: ['a'] } };
    const s = ilerlemeyiSifirla(k, 5);
    expect(s.bolumler).toEqual({});
    expect(s.can).toEqual(k.can);
    expect(s.gelir).toEqual(k.gelir);
    expect(s.can).not.toBe(k.can);
    expect('can' in ilerlemeyiSifirla(yeniKayit(1), 5)).toBe(false);
  });

  it('ilerlemeyi sıfırla: satın alma yapılmış kayıtta güçlendirici stoğu korunur, gelirsiz kayıtta sıfırlanır', () => {
    // Paket satın alındı (3/2/2), kullanılmadan sıfırlandı: jeton işlenmiş olduğundan stok yeniden verilmez.
    const r = satinAlmaUygula(yeniKayit(1), 'guclendirici_paketi', 'j-paket', T0);
    expect(r.verildi).toBe(true);
    const s = ilerlemeyiSifirla(r.kayit, 5);
    expect(s.guclendiriciler).toEqual({ kibrit: 3, kalip: 2, geriSar: 2 });
    expect(s.gelir?.jetonlar).toEqual(['j-paket']);
    expect(satinAlmaUygula(s, 'guclendirici_paketi', 'j-paket', T0).tekrar).toBe(true);
    // Sağlayıcısız sürümün kaydı (gelir yok): stok eskisi gibi sıfırlanır.
    const w = yeniKayit(2);
    w.guclendiriciler = { kibrit: 2, kalip: 1, geriSar: 1 };
    expect(ilerlemeyiSifirla(w, 5).guclendiriciler).toEqual({ kibrit: 0, kalip: 0, geriSar: 0 });
  });
});

describe('bulut + tarayıcı birleştirmesi (kancaBirlestir, §13 öneri)', () => {
  it('can seçilen kayıttan; Usta kartı VEYA; jetonlar birleşimi (kazananınkiler önce)', () => {
    const ortak = ilerlet(8, 2);
    const a: Kayit = { ...canli({ sayi: 2, dolumBasi: T0 }, ortak), gelir: { ustaKarti: false, jetonlar: ['j1', 'j2'] } };
    const b: Kayit = { ...canli({ sayi: 5 }, ortak), gelir: { ustaKarti: true, jetonlar: ['j2', 'j3'] } };
    const y = kancaBirlestir(a, b);
    expect(y.can).toEqual(a.can);
    expect(y.gelir).toEqual({ ustaKarti: true, jetonlar: ['j1', 'j2', 'j3'] });
    expect(kayitOnar(JSON.parse(anlik(y))).onarilan).toEqual([]);
    const z = kancaBirlestir(b, a);
    expect(z.can).toEqual(b.can);
    expect(z.gelir).toEqual({ ustaKarti: true, jetonlar: ['j2', 'j3', 'j1'] });
    // İdempotent; girdiler değişmez.
    expect(kancaBirlestir(y, y)).toEqual(y);
    expect(kancaBirlestir(y, a)).toEqual(y);
    expect(a.gelir).toEqual({ ustaKarti: false, jetonlar: ['j1', 'j2'] });
  });

  it('kazananda alan yoksa can eklenmez; gelir yalnız bir şey taşıyorsa eklenir; son 50', () => {
    const a = ilerlet(4, 1);
    const b: Kayit = { ...canli({ sayi: 0, dolumBasi: T0 }, a), gelir: { ustaKarti: false, jetonlar: [] } };
    const y = kancaBirlestir(a, b);
    expect('can' in y).toBe(false);
    expect('gelir' in y).toBe(false);
    expect(kancaBirlestir(a, a)).toEqual(a);
    const c: Kayit = { ...kayitKopyala(a), gelir: { ustaKarti: false, jetonlar: Array.from({ length: 40 }, (_, i) => `c${i}`) } };
    const d: Kayit = { ...kayitKopyala(a), gelir: { ustaKarti: false, jetonlar: Array.from({ length: 40 }, (_, i) => `d${i}`) } };
    const e = kancaBirlestir(c, d);
    expect(e.gelir?.jetonlar).toHaveLength(JETON_SINIRI);
    expect(e.gelir?.jetonlar.at(-1)).toBe('d39');
    expect(new Set(e.gelir?.jetonlar).size).toBe(JETON_SINIRI);
    expect(gelirBirlestir({}, {})).toBeUndefined();
    expect(gelirBirlestir({}, { gelir: { ustaKarti: true, jetonlar: [] } })).toEqual({ ustaKarti: true, jetonlar: [] });
  });

  it('depo birleşimi (SaveStore merge): öbür kaydın Usta kartı kaybolmaz; değişiklik yoksa seçilen aynen', () => {
    const ayar = kayitDeposuAyarlari();
    const secilen = ilerlet(10, 3);
    const diger: Kayit = { ...ilerlet(6, 1), gelir: { ustaKarti: true, jetonlar: ['u1'] } };
    const m = ayar.merge(secilen, diger);
    expect(m.gelir).toEqual({ ustaKarti: true, jetonlar: ['u1'] });
    expect(m.bolumler).toEqual(secilen.bolumler);
    const ayni = ayar.merge(secilen, ilerlet(6, 1));
    expect(ayni).toBe(secilen);
  });
});

interface Ornek {
  localStorage: Record<string, string>;
}

describe.each([
  ['3. bölüm', b03],
  ['14. bölüm', b14],
  ['27. bölüm', b27],
] as [string, Ornek][])('eski kayıt (gerçek şema 2 örneği, %s)', (_ad, o) => {
  const veri = (a: string) => (JSON.parse(o.localStorage[a]) as { data: Record<string, unknown> }).data;

  it('yüklenince can 5 dolu, reklam hakkı 3, satın alma yok; alan eklenmez, onarım yok', () => {
    const r = kayitYukle([KAYIT_ANAHTARI, ...KAYIT_YEDEK_ANAHTARLARI].map(veri), 1);
    expect(r.onarilan).toEqual([]);
    expect(r.kayit.can).toBeUndefined();
    expect(r.kayit.gelir).toBeUndefined();
    expect(canDurumu(r.kayit, T0)).toEqual({ sayi: 5, enCok: 5, sonrakiMs: null });
    expect(reklamCanHakki(r.kayit, D)).toBe(3);
    expect(paketSigarMi(r.kayit)).toBe(r.kayit.guclendiriciler.kibrit === 0 && r.kayit.guclendiriciler.kalip <= 1 && r.kayit.guclendiriciler.geriSar <= 1);
    expect(canTazele(r.kayit, T0)).toBe(r.kayit);
    // İlk kayıp can alanını kurar; kayıt yeniden yüklenince aynen gelir.
    const h = canHarca(r.kayit, T0, 'kayip');
    expect(h.can).toEqual({ sayi: 4, dolumBasi: T0, reklamGun: 0, reklamSayisi: 0 });
    const g = kayitCoz(JSON.parse(anlik(h)));
    expect(g.onarilan).toEqual([]);
    expect(g.gocler).toEqual([]);
    expect(g.kayit).toEqual(h);
  });

  it('şema 2 verisinde (yeni sekme yazmış gibi) can/gelir varsa göçte korunur', () => {
    const ham = { ...veri(KAYIT_ANAHTARI), can: { sayi: 2, dolumBasi: T0, reklamGun: D, reklamSayisi: 1 }, gelir: { ustaKarti: true, jetonlar: ['u'] } };
    const r = kayitCoz(ham);
    expect(r.gocler).toEqual(['2→3']);
    expect(r.onarilan).toEqual([]);
    expect(r.kayit.can).toEqual(ham.can);
    expect(r.kayit.gelir).toEqual(ham.gelir);
  });
});

describe('bulanık: rastgele can/reklam/satın alma dizisi', () => {
  const URUNLER: UrunId[] = ['can_doldur', 'guclendirici_paketi', 'usta_karti'];
  for (const tohum of [1, 2, 3, 4, 5]) {
    it(`tohum ${tohum}: kayıt geçerli kalır, girdi değişmez, gereksiz kopya yok`, () => {
      const r = { rng: tohum * 7919 };
      let k: Kayit = tohum % 2 ? yeniKayit(tohum) : ilerlet(7, 1, yeniKayit(tohum));
      let t = T0;
      let gun = D;
      let oncekiDurum = canDurumu(k, t);
      const sayilar = [0, 0, 0, 0, 0, 0];
      const d0 = (x: Kayit, an: number) => canDurumu(x, an).sayi;
      for (let i = 0; i < 600; i++) {
        // Zaman: çoğu ileri (saniyeler–saatler), bazen geri; gün ara sıra değişir.
        const z = rngInt(r, 10);
        t += z === 0 ? -rngInt(r, 3 * 3600_000) : z < 7 ? rngInt(r, 5 * DK) : z < 9 ? rngInt(r, 45 * DK) : rngInt(r, 3 * 3600_000);
        t = Math.max(0, t);
        if (rngInt(r, 12) === 0) gun = tarihEkle(gun, rngInt(r, 4) - 1);
        const once = anlik(k);
        const durum = canDurumu(k, t);
        let y: Kayit;
        switch (rngInt(r, 12)) {
          case 0:
            y = canTazele(k, t);
            break;
          case 1:
          case 2:
          case 3:
          case 4:
            y = canHarca(k, t, rngInt(r, 2) ? 'kayip' : 'cikis');
            break;
          case 5:
            y = canIade(k, t);
            break;
          case 6:
          case 7:
            y = reklamCanKullan(k, t, gun);
            break;
          case 8:
            y = canEkle(k, t, rngInt(r, 4));
            break;
          case 9:
            y = satinAlmaUygula(k, URUNLER[rngInt(r, 3)], `j${rngInt(r, 70)}`, t).kayit;
            break;
          case 10:
            y = rngInt(r, 4) ? canTazele(k, t) : canDoldur(k, t);
            break;
          default:
            y = geriYuklemeUygula(k, rngInt(r, 2) ? ['usta_karti'] : ['can_doldur']);
        }
        sayilar[d0(y, t)]++;
        expect(anlik(k)).toBe(once); // girdi değişmez
        if (y !== k) expect(anlik(y)).not.toBe(once); // yeni nesne yalnız değişince
        const onarim = kayitOnar(JSON.parse(anlik(y)));
        if (onarim.onarilan.length) throw new Error(`adım ${i}: onarılan ${onarim.onarilan.join(', ')}`);
        const d = canDurumu(y, t);
        expect(d.sayi).toBeGreaterThanOrEqual(0);
        expect(d.sayi).toBeLessThanOrEqual(CAN_ENCOK);
        expect(d.sonrakiMs === null).toBe(d.sayi === CAN_ENCOK);
        if (d.sonrakiMs !== null) {
          expect(d.sonrakiMs).toBeGreaterThanOrEqual(1);
          expect(d.sonrakiMs).toBeLessThanOrEqual(CAN_DOLUM_MS);
        }
        // İşlemler canı en çok 1 düşürür (harcama), okumayla yazma aynı sayıyı verir.
        expect(d.sayi).toBeGreaterThanOrEqual(durum.sayi - 1);
        const tz = canTazele(y, t);
        expect(canDurumu(tz, t)).toEqual(d);
        expect(canTazele(tz, t)).toBe(tz);
        expect(reklamCanHakki(y, gun)).toBeGreaterThanOrEqual(0);
        expect(reklamCanHakki(y, gun)).toBeLessThanOrEqual(REKLAM_CAN_GUNLUK);
        for (const v of Object.values(y.guclendiriciler)) expect(v).toBeLessThanOrEqual(GUCLENDIRICI_STOK_SINIRI);
        const j = y.gelir?.jetonlar ?? [];
        expect(j.length).toBeLessThanOrEqual(JETON_SINIRI);
        expect(new Set(j).size).toBe(j.length);
        // Zaman geçtikçe (işlemsiz) can azalmaz.
        expect(canDurumu(y, t + rngInt(r, 4 * 3600_000)).sayi).toBeGreaterThanOrEqual(d.sayi);
        oncekiDurum = d;
        k = y;
      }
      expect(oncekiDurum.enCok).toBe(CAN_ENCOK);
      // Dizi bütün can düzeylerinden geçer (0 ve tavan dahil).
      for (const n of sayilar) expect(n).toBeGreaterThanOrEqual(2);
      // Kayıt kodu gidiş-dönüş.
      const kod = kayitKoduCoz(kayitKoduUret(k));
      expect(kod.tamam && kod.kayit).toEqual(k);
    });
  }
});

describe('bölüm sonucu can alanına dokunmaz', () => {
  it('kazanç/kayıp kaydı can ve geliri aynen taşır (can kuralı oturumda, G4)', () => {
    const k: Kayit = { ...canli({ sayi: 2, dolumBasi: T0 }, ilerlet(6, 1)), gelir: { ustaKarti: true, jetonlar: ['a'] } };
    const r = kazan(k, 7, 2).kayit;
    expect(r.can).toEqual(k.can);
    expect(r.gelir).toEqual(k.gelir);
  });
});
