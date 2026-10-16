/**
 * Bölüm Mühürleri, Kasaba İşleri ve kayıt şeması 3 (docs/KANCALAR.md):
 * koşul dili, eylem izleri, değerlendirme, türetilmiş kandil, iş kuralları,
 * onarım ve 2 → 3 göçü (eski oyuncunun ilerlemesi korunur).
 */
import { describe, expect, it } from 'vitest';
import { KASABA_ISLERI, MAHALLELER } from '../app/katalog';
import type { BolumVerisi, Olay } from '../core/types';
import { BOLUMLER } from '../levels/index';
import {
  bolumMuhurDogrula,
  muhurAnlik,
  muhurBirlestir,
  muhurDegeri,
  muhurKosuluDogrula,
  muhurleriDegerlendir,
  muhurMaskeCoz,
  muhurMaskesi,
  muhurMetni,
  muhurOzeti,
  muhurSayisi,
  MUHUR_METIN_SINIRI,
} from './muhur';
import type { MuhurKosulu, MuhurOzeti } from './muhur';
import { KANDIL, kandilDokumu, kasabaAcikMi, kasabaIsDurumu, kasabaIsYap, kasabaOnar, kasabaUyarildi, kasabaUyarisi, mahalleIsleri, siradakiKasabaIsi } from './kasaba';
import { kayitCoz, kayitGoc, kayitKoduCoz, kayitKoduUret, kayitOnar, progressScore, toplamYildiz, acikEnYuksek, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { haritaVerisi } from './harita';
import { olaylardanOzet, ozetBaslat, ozetFinal, ozetHamle } from './ozet';
import type { HamleIzi } from './ozet';
import { KAYIT_SURUMU } from './sabitler';
import { ilerlet, O } from './_test/yardimci';

// ─────────────────────────── yardımcılar ───────────────────────────

function iz(ek: Partial<HamleIzi> = {}): HamleIzi {
  return {
    eylem: 'fitil',
    zincir: 4,
    renk: 0,
    halka: false,
    R: 0,
    nesil: 0,
    patlama: 4,
    renkPatlama: [4, 0, 0, 0, 0, 0],
    isiPatlamasi: 0,
    olusan: 'yok',
    roket: 0,
    kasimpati: 0,
    yildiz: 0,
    caprazRoket: 0,
    kombolar: [],
    kafes: 0,
    kaya: 0,
    engelHasar: 0,
    doseme: 0,
    desen: 0,
    is: 0,
    fener: 0,
    devFisek: 0,
    izliDevFisek: 0,
    caprazEngel: 0,
    kurutma: 0,
    ...ek,
  };
}

function mo(izler: HamleIzi[], ek: Partial<MuhurOzeti> = {}): MuhurOzeti {
  return { hamleIzleri: izler, kazandi: true, kalanHamle: 0, ustaEli: false, guclendirici: 0, ...ek };
}

const v = (muhurler: MuhurKosulu[]): Pick<BolumVerisi, 'muhurler'> => ({ muhurler });

/** Şema 2 kaydı (bu paketten önceki sürümün yazdığı biçim). */
function sema2(k: Kayit): Record<string, unknown> {
  const o = JSON.parse(JSON.stringify(k)) as Record<string, unknown>;
  delete o.kasaba;
  delete o.muhurOdulleri;
  for (const b of Object.values(o.bolumler as Record<string, Record<string, unknown>>)) delete b.muhur;
  o.surum = 2;
  return o;
}

// ─────────────────────────── eylem izi ───────────────────────────

describe('eylem izi (OyunOzeti.hamleIzleri)', () => {
  it('fitil: zincir, renk, halka, R, nesil, renk patlaması; final iz eklemez', () => {
    const olaylar: Olay[] = [
      O.fitil([[0, 5], [1, 5], [2, 5], [3, 5]], true, 2),
      O.patlama(0, 5, 2, { k: 1 }),
      O.patlama(1, 5, 2, { k: 2, t: 103 }),
      O.patlama(1, 4, 1, { t: 193, neden: 'isi', nesil: 1 }),
      O.patlama(1, 3, 3, { t: 283, neden: 'isi', nesil: 2 }),
      O.kafes(2, 2, 300),
      O.reaksiyon(2, 290),
    ];
    let oz = ozetHamle(ozetBaslat(), olaylar);
    expect(oz.hamleIzleri).toHaveLength(1);
    const i = oz.hamleIzleri[0];
    expect(i).toMatchObject({ eylem: 'fitil', zincir: 4, renk: 2, halka: true, R: 2, nesil: 2, patlama: 4, isiPatlamasi: 2, kafes: 1, olusan: 'yok' });
    expect(i.renkPatlama).toEqual([0, 1, 2, 1, 0, 0]);
    oz = ozetFinal(oz, [O.final(3), O.ozel(1, 1, 'roket', 0, 10), O.patlama(1, 1, 0, { neden: 'final' })]);
    expect(oz.hamleIzleri).toHaveLength(1);
    expect(olaylardanOzet([olaylar]).hamleIzleri).toEqual(ozetHamle(ozetBaslat(), olaylar).hamleIzleri);
  });

  it('zincir dönüşümü: son düğümde k = |yol| anında ozelOlustu → olusan', () => {
    const yol: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
    const olaylar: Olay[] = [
      O.fitil(yol, false, 1),
      { t: 445, tur: 'dugumYandi', hucre: { x: 5, y: 0 }, k: 6 },
      { t: 445, tur: 'ozelOlustu', hucre: { x: 5, y: 0 }, ozel: 'roket', eksen: 0, renk: 1, isi: 0 },
      // Kombinasyonla başka hücrede oluşan roket dönüşüm sayılmaz.
      { t: 500, tur: 'ozelOlustu', hucre: { x: 2, y: 3 }, ozel: 'roket', eksen: 1, renk: 1, isi: 1 },
      O.ozel(4, 4, 'roket', 2, 520),
      O.reaksiyon(0, 600),
    ];
    const i = ozetHamle(ozetBaslat(), olaylar).hamleIzleri[0];
    expect(i.olusan).toBe('roket');
    expect(i.roket).toBe(1);
    expect(i.caprazRoket).toBe(1);
  });

  it('körük ve güçlendirici eylemleri izde türüyle; Geri Sar için özet kopyası bağımsız', () => {
    const o0 = ozetHamle(ozetBaslat(), [O.koruk(), O.patlama(3, 3, 0, { neden: 'isi', nesil: 1 }), O.reaksiyon(1)]);
    expect(o0.hamleIzleri[0]).toMatchObject({ eylem: 'koruk', R: 1, zincir: 0, renk: -1 });
    const o1 = ozetHamle(o0, [{ t: 0, tur: 'guclendirici', guc: 'kibrit', hucre: { x: 1, y: 1 } }, O.patlama(1, 1, 0, { neden: 'kibrit' })]);
    expect(o1.hamleIzleri.map((x) => x.eylem)).toEqual(['koruk', 'kibrit']);
    expect(o0.hamleIzleri).toHaveLength(1);
  });
});

// ─────────────────────────── koşul dili ───────────────────────────

describe('mühür koşulları', () => {
  const izler = [
    iz({ R: 3, nesil: 1, zincir: 5, renk: 1, renkPatlama: [0, 5, 0, 0, 0, 0], patlama: 5, olusan: 'yok' }),
    iz({ halka: true, zincir: 8, R: 16, nesil: 3, isiPatlamasi: 12, kafes: 2 }),
    iz({ eylem: 'koruk', zincir: 0, renk: -1, R: 11, nesil: 2 }),
    iz({ zincir: 9, olusan: 'kasimpati', roket: 2, caprazRoket: 1, caprazEngel: 2, kombolar: ['kalinRoket'], devFisek: 2, izliDevFisek: 1 }),
    iz({ zincir: 3 }),
  ];
  const oz = mo(izler, { kalanHamle: 7 });

  it('kapsam: oyun toplamı, tek hamlede en büyük, son', () => {
    expect(muhurDegeri({ olcu: 'halka', kapsam: 'oyun', enAz: 1 }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'R', kapsam: 'hamle', enAz: 1 }, oz)).toBe(16);
    expect(muhurDegeri({ olcu: 'R', kapsam: 'hamle', enAz: 1, halka: true }, oz)).toBe(16);
    expect(muhurDegeri({ olcu: 'R', kapsam: 'hamle', enAz: 1, eylem: 'koruk' }, oz)).toBe(11);
    expect(muhurDegeri({ olcu: 'zincir', kapsam: 'hamle', enAz: 1 }, oz)).toBe(9);
    expect(muhurDegeri({ olcu: 'zincir', kapsam: 'hamle', enAz: 1, halka: true }, oz)).toBe(8);
    expect(muhurDegeri({ olcu: 'zincir', kapsam: 'hamle', enAz: 1, renk: 1 }, oz)).toBe(5);
    expect(muhurDegeri({ olcu: 'patlama', kapsam: 'oyun', enAz: 1, renk: 1 }, oz)).toBe(5);
    expect(muhurDegeri({ olcu: 'nesil', kapsam: 'hamle', enAz: 1 }, oz)).toBe(3);
    expect(muhurDegeri({ olcu: 'olusum', kapsam: 'oyun', enAz: 1, ozel: 'kasimpati' }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'olusum', kapsam: 'oyun', enAz: 1, ozel: 'roket' }, oz)).toBe(0);
    expect(muhurDegeri({ olcu: 'ozelAtes', kapsam: 'oyun', enAz: 1, ozel: 'roket' }, oz)).toBe(2);
    expect(muhurDegeri({ olcu: 'kombo', kapsam: 'oyun', enAz: 1, kombo: 'kalinRoket' }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'kombo', kapsam: 'oyun', enAz: 1, kombo: 'buyukFinal' }, oz)).toBe(0);
    expect(muhurDegeri({ olcu: 'devFisek', kapsam: 'hamle', enAz: 1 }, oz)).toBe(2);
    expect(muhurDegeri({ olcu: 'izliDevFisek', kapsam: 'oyun', enAz: 1 }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'caprazEngel', kapsam: 'oyun', enAz: 1 }, oz)).toBe(2);
    expect(muhurDegeri({ olcu: 'koruk', kapsam: 'oyun', enCok: 0 }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'kisaZincir', kapsam: 'oyun', enCok: 0 }, oz)).toBe(1);
    expect(muhurDegeri({ olcu: 'kalanHamle', kapsam: 'son', enAz: 5 }, oz)).toBe(7);
  });

  it('güçlendirici eylemi tek hamle sayılmaz, oyun toplamına girer; Körük tek hamledir', () => {
    const g = mo([iz({ eylem: 'kibrit', zincir: 0, renk: -1, kafes: 3, R: 9 }), iz({ eylem: 'koruk', zincir: 0, renk: -1, kafes: 2, R: 5 })]);
    expect(muhurDegeri({ olcu: 'kafes', kapsam: 'hamle', enAz: 1 }, g)).toBe(2);
    expect(muhurDegeri({ olcu: 'kafes', kapsam: 'oyun', enAz: 1 }, g)).toBe(5);
    expect(muhurDegeri({ olcu: 'R', kapsam: 'hamle', enAz: 1 }, g)).toBe(5);
  });

  it('yalnız kazançta ve Usta\'nın Eli olmadan basılır; enAz/enCok', () => {
    const m: MuhurKosulu[] = [
      { olcu: 'halka', kapsam: 'oyun', enAz: 1 },
      { olcu: 'R', kapsam: 'hamle', enAz: 17 },
      { olcu: 'kalanHamle', kapsam: 'son', enAz: 7 },
    ];
    expect(muhurleriDegerlendir(v(m), oz)).toEqual([true, false, true]);
    expect(muhurleriDegerlendir(v(m), { ...oz, kazandi: false })).toEqual([false, false, false]);
    expect(muhurleriDegerlendir(v(m), { ...oz, ustaEli: true })).toEqual([false, false, false]);
    expect(muhurleriDegerlendir({}, oz)).toEqual([false, false, false]);
    const kisit: MuhurKosulu[] = [
      { olcu: 'koruk', kapsam: 'oyun', enCok: 0 },
      { olcu: 'guclendirici', kapsam: 'oyun', enCok: 0 },
      { olcu: 'kisaZincir', kapsam: 'oyun', enCok: 1 },
    ];
    expect(muhurleriDegerlendir(v(kisit), oz)).toEqual([false, true, true]);
    expect(muhurleriDegerlendir(v(kisit), { ...oz, guclendirici: 1 })).toEqual([false, false, true]);
  });

  it('anlık durum (HUD): tuttu / bekliyor / korunuyor / bozuldu / sonda', () => {
    const m: MuhurKosulu[] = [
      { olcu: 'halka', kapsam: 'oyun', enAz: 2 },
      { olcu: 'koruk', kapsam: 'oyun', enCok: 0 },
      { olcu: 'kalanHamle', kapsam: 'son', enAz: 3 },
    ];
    expect(muhurAnlik(v(m), mo([iz()], { kazandi: false }))).toEqual(['bekliyor', 'korunuyor', 'sonda']);
    expect(muhurAnlik(v(m), mo([iz({ halka: true }), iz({ halka: true }), iz({ eylem: 'koruk' })], { kazandi: false }))).toEqual(['tuttu', 'bozuldu', 'sonda']);
    expect(muhurAnlik(v(m), mo([], { ustaEli: true }))).toEqual(['bozuldu', 'bozuldu', 'bozuldu']);
  });

  it('muhurOzeti: kazanç, kalan hamle, Usta\'nın Eli ve güçlendirici durumdan', () => {
    const ist = { ustaEli: false, guclendirici: 1 } as BolumVerisi extends never ? never : Parameters<typeof muhurOzeti>[1]['istatistik'];
    const r = muhurOzeti(ozetBaslat(), { bitti: 'kazanc', kalanHamle: 4, istatistik: ist });
    expect(r).toEqual({ hamleIzleri: [], kazandi: true, kalanHamle: 4, ustaEli: false, guclendirici: 1 });
  });

  it('maske: çöz, birleştir, say', () => {
    expect(muhurMaskeCoz(5)).toEqual([true, false, true]);
    expect(muhurMaskesi([false, true, true])).toBe(6);
    expect(muhurSayisi(7)).toBe(3);
    expect(muhurSayisi(undefined)).toBe(0);
    expect(muhurBirlestir(1, [true, true, false])).toEqual({ maske: 3, yeni: ['kalfa'] });
    expect(muhurBirlestir(undefined, [false, false, false])).toEqual({ maske: 0, yeni: [] });
  });

  it('metin üretimi ve doğrulama', () => {
    expect(muhurMetni({ olcu: 'R', kapsam: 'hamle', enAz: 15, halka: true })).toBe('Halkayla 15+ reaksiyon yap');
    expect(muhurMetni({ olcu: 'koruk', kapsam: 'oyun', enCok: 0 })).toBe('Körük kullanmadan kazan');
    expect(muhurMetni({ olcu: 'kalanHamle', kapsam: 'son', enAz: 6 })).toBe('6 hamle kala kazan');
    expect(muhurMetni({ olcu: 'devFisek', kapsam: 'hamle', enAz: 2 })).toBe('Tek hamlede 2 dev fişek ateşle');
    expect(muhurMetni({ olcu: 'zincir', kapsam: 'hamle', enAz: 8, halka: true, metin: 'Büyük halka' })).toBe('Büyük halka');
    expect(muhurKosuluDogrula({ olcu: 'R', kapsam: 'hamle', enAz: 15 })).toEqual([]);
    expect(muhurKosuluDogrula({ olcu: 'R', kapsam: 'oyun', enAz: 15 }).length).toBe(1);
    expect(muhurKosuluDogrula({ olcu: 'halka', kapsam: 'oyun', enAz: 2, enCok: 3 }).length).toBe(1);
    expect(muhurKosuluDogrula({ olcu: 'kalanHamle', kapsam: 'son', enCok: 0 }).length).toBeGreaterThan(0);
    expect(muhurKosuluDogrula({ olcu: 'patlama', kapsam: 'oyun', enAz: 30, renk: 5 }, 5).length).toBe(1);
    expect(muhurKosuluDogrula({ olcu: 'yok', kapsam: 'oyun', enAz: 1 })).toEqual(['bilinmeyen ölçü "yok"']);
    const uc: MuhurKosulu[] = [
      { olcu: 'R', kapsam: 'hamle', enAz: 10, sans: true },
      { olcu: 'R', kapsam: 'hamle', enAz: 20, sans: true },
      { olcu: 'R', kapsam: 'hamle', enAz: 10 },
    ];
    const h = bolumMuhurDogrula({ id: 12, renkSayisi: 5, muhurler: uc });
    expect(h).toContain('şansa bağlı mühür bölüm başına en çok 1');
    expect(h).toContain('aynı koşul iki kez');
    expect(bolumMuhurDogrula({ id: 3, renkSayisi: 4 })).toEqual([]);
    expect(bolumMuhurDogrula({ id: 3, renkSayisi: 4, muhurler: uc.slice(0, 3) })).toEqual(['mühür yalnız 6–40. bölümlerde']);
  });

  it('bölüm verilerindeki mühürler geçerli (tanımlı olanlar) ve metinleri tek satıra sığar', () => {
    for (const b of BOLUMLER) {
      if (!b.muhurler) continue;
      expect(bolumMuhurDogrula(b), `bölüm ${b.id}`).toEqual([]);
      for (const k of b.muhurler) expect(muhurMetni(k).length, `${b.id}: ${muhurMetni(k)}`).toBeLessThanOrEqual(MUHUR_METIN_SINIRI);
    }
  });
});

// ─────────────────────────── kasaba ───────────────────────────

/** 1..n bölümleri `yildiz` ile kazanılmış; isteğe bağlı mühür maskesi. */
function kayit(n: number, yildiz = 2, muhur = 0): Kayit {
  const k = ilerlet(n, yildiz);
  if (muhur) for (let id = 6; id <= n; id++) k.bolumler[String(id)].muhur = muhur;
  return k;
}

function yap(k: Kayit, ...idler: string[]): Kayit {
  for (const id of idler) {
    const r = kasabaIsYap(k, id);
    if (!r.tamam) throw new Error(`${id}: ${r.hata}`);
    k = r.kayit;
  }
  return k;
}

const iskele = mahalleIsleri(0).map((x) => x.id);
const carsi = mahalleIsleri(1).map((x) => x.id);

describe('kasaba işleri', () => {
  it('katalog: 8 mahalle × 6 iş, toplam 186 kandil, benzersiz kimlik, taç iş en pahalılar arasında', () => {
    expect(KASABA_ISLERI).toHaveLength(48);
    expect(new Set(KASABA_ISLERI.map((x) => x.id)).size).toBe(48);
    expect(KASABA_ISLERI.reduce((s, x) => s + x.maliyet, 0)).toBe(186);
    for (let m = 0; m < 8; m++) {
      const isler = mahalleIsleri(m);
      expect(isler.map((x) => x.sira)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(isler.every((x) => x.id.startsWith(`${MAHALLELER[m].id}.`))).toBe(true);
      expect(Math.max(...isler.map((x) => x.maliyet))).toBe(isler[5].maliyet);
    }
  });

  it('kandil türetilir: yıldız + mühür + 3·mahalle + günlük − harcanan', () => {
    const k = kayit(12, 2, 0b011);
    const d = kandilDokumu(k);
    expect(d).toMatchObject({ yildiz: 24, muhur: 14, mahalle: 2, gunluk: 0, kazanilan: 24 + 14 + 6, harcanan: 0 });
    k.kasaba.gunlukKandil = 3;
    expect(kandilDokumu(k).kazanilan).toBe(24 + 14 + 6 + 3 * KANDIL.gunluk);
  });

  it('kasaba 3. bölümle açılır; mahalleler sırayla, taç iş en son', () => {
    expect(kasabaAcikMi(kayit(2))).toBe(false);
    expect(kasabaIsDurumu(kayit(2), iskele[0]).durum).toBe('kasabaKapali');
    let k = kayit(3, 3); // 9 kandil
    expect(kasabaIsDurumu(k, iskele[5]).durum).toBe('tacKilitli');
    expect(kasabaIsDurumu(k, carsi[0]).durum).toBe('haritaKilitli');
    k = yap(k, iskele[0], iskele[1], iskele[2], iskele[3]); // 1 + 2 + 2 + 2 = 7
    expect(kandilDokumu(k).bakiye).toBe(2);
    expect(kasabaIsDurumu(k, iskele[4])).toEqual({ durum: 'yetersiz', eksik: 1 });
    expect(kasabaIsYap(k, iskele[4])).toEqual({ tamam: false, hata: 'yetersiz' });
    expect(kasabaIsYap(k, iskele[0])).toEqual({ tamam: false, hata: 'yapildi' });
    expect(kasabaIsYap(k, 'iskele.yok')).toEqual({ tamam: false, hata: 'gecersiz' });
  });

  it('6. iş mahalle şenliği ve kasaba kartı verir; sonraki mahalle açılır', () => {
    let k = kayit(6, 3); // 18★ + İskele tamam (3) = 21
    expect(kasabaIsDurumu(k, carsi[0]).durum).toBe('sirada');
    k = yap(k, ...iskele.slice(0, 5));
    const r = kasabaIsYap(k, iskele[5]);
    expect(r.tamam).toBe(true);
    if (!r.tamam) return;
    expect(r.oduller.map((o) => o.tur)).toEqual(['is', 'kasabaSenligi']);
    expect(r.kayit.koleksiyon.kartlar).toContain('kasaba:iskele');
    expect(kasabaIsDurumu(r.kayit, carsi[0]).durum).toBe('yapilabilir');
    expect(kandilDokumu(r.kayit).bakiye).toBe(21 - 14);
    // Kart kayıt onarımından geçer.
    expect(kayitOnar(r.kayit).onarilan).toEqual([]);
  });

  it('sıradaki iş ve "kandil yetti" uyarısı iş başına bir kez', () => {
    let k = kayit(3, 1); // 3 kandil
    expect(siradakiKasabaIsi(k)?.is.id).toBe(iskele[0]);
    const u = kasabaUyarisi(k);
    expect(u?.id).toBe(iskele[0]);
    k = kasabaUyarildi(k, u!.id);
    expect(kasabaUyarisi(k)).toBeNull();
    k = yap(k, iskele[0], iskele[1]); // 3 harcandı
    expect(siradakiKasabaIsi(k)).toMatchObject({ durum: 'yetersiz', eksik: 2 });
    expect(kasabaUyarisi(k)).toBeNull();
  });

  it('onarım: geçersiz/tekrar/kural dışı iş atılır, bütçe aşımı sondan geri alınır', () => {
    const k = kayit(3, 1); // 3 kandil
    const not: string[] = [];
    const r = kasabaOnar({ isler: [iskele[0], 'x.y', iskele[0], iskele[5], carsi[0], iskele[1], iskele[2]], gunlukKandil: 0, uyarilan: ['x'] }, k, (y) => not.push(y));
    // iskele[0] (1) + iskele[1] (2) = 3 ≤ 3; iskele[2] bütçe aşımıyla geri alındı.
    expect(r.isler).toEqual([iskele[0], iskele[1]]);
    expect(r.uyarilan).toEqual([]);
    expect(not).toContain('kasaba.isler');
    expect(kasabaOnar(undefined, k, () => undefined)).toEqual({ isler: [], gunlukKandil: 0, uyarilan: [] });
  });
});

describe('harita verisi (şema 3 alanları)', () => {
  it('mühür maskesi, sancak, mahalle mühür sayısı ve kasaba düğmesi', () => {
    const k = kayit(12, 2, 0b011);
    k.bolumler['7'].muhur = 7;
    const h = haritaVerisi(k);
    const d = (id: number) => h.dugumler.find((x) => x.tur === 'bolum' && x.id === id) as Extract<(typeof h.dugumler)[number], { tur: 'bolum' }>;
    expect(d(3).muhur).toBeNull();
    expect(d(6).muhur).toBe(3);
    expect(d(7).sancak).toBe(true);
    expect(d(8).sancak).toBe(false);
    expect(h.mahalleler[0]).toMatchObject({ muhur: 0, muhurToplam: 0 });
    expect(h.mahalleler[1]).toMatchObject({ muhur: 2 + 3 + 2 + 2 + 2, muhurToplam: 15, kasabaIs: 0, suslendi: false });
    expect(h.kasaba).toMatchObject({ acik: true, kandil: kandilDokumu(k).bakiye, isler: [], yapilabilir: true });
    expect(h.kasaba.siradaki?.id).toBe(iskele[0]);
  });
});

// ─────────────────────────── kayıt şeması 3 ───────────────────────────

describe('kayıt şeması 3 ve göç', () => {
  it('2 → 3: ilerleme aynen kalır, kandil yıldız başına 1 (+ mahalle 3) başlar, mühür verilmez', () => {
    let k = ilerlet(12, 2);
    k = { ...k, rozetler: ['ilkKivilcim', 'halkaci'], toz: 17 };
    k.bolumler['7'].tablo = 'AAAAAA==';
    k.bolumler['7'].nadirlik = 1;
    k.koleksiyon.parcalar = [...k.koleksiyon.parcalar, 'd:sogut:0'];
    const eski = sema2(k);
    const eskiPuan = toplamYildiz(k) * 1000 + acikEnYuksek(k);
    const r = kayitCoz(JSON.parse(JSON.stringify(eski)), 9);
    expect(r.gocler).toEqual(['2→3']);
    expect(r.kayit.surum).toBe(KAYIT_SURUMU);
    expect(r.onarilan).toEqual([]);
    const y = r.kayit;
    // Eski alanlar birebir.
    const { kasaba, muhurOdulleri, surum, ...geri } = y;
    void surum;
    const { surum: _s, ...eskiGeri } = eski;
    void _s;
    expect(geri).toEqual(eskiGeri);
    expect(kasaba).toEqual({ isler: [], gunlukKandil: 0, uyarilan: [] });
    expect(muhurOdulleri).toEqual([]);
    expect(Object.values(y.bolumler).every((b) => b.muhur === undefined)).toBe(true);
    // Başlangıç bakiyesi: 24★ + 2 tamamlanmış mahalle × 3.
    expect(kandilDokumu(y).bakiye).toBe(24 + 2 * KANDIL.mahalle);
    // İlerleme puanı şema 2 formülüyle aynı (eski zarflarla karşılaştırma bozulmaz).
    expect(progressScore(y)).toBe(eskiPuan);
  });

  it('1 → 3: GDD taslağından da kandil türetilir', () => {
    const v1 = { surum: 1, kayitTohumu: 0, bolumler: { '1': { yildiz: 3, enIyi: 6200, deneme: 2, basarisizSeri: 0 }, '2': { yildiz: 2, enIyi: 10, deneme: 1, basarisizSeri: 0 } } };
    const r = kayitCoz(v1);
    expect(r.gocler).toEqual(['1→2', '2→3']);
    expect(kandilDokumu(r.kayit).bakiye).toBe(5);
  });

  it('onarım: mühür yalnız kazanılmış 6–40\'ta 0..7; ödül kimlikleri süzülür', () => {
    const k = kayit(8, 2);
    const ham = JSON.parse(JSON.stringify(k));
    ham.bolumler['3'].muhur = 7; // öğretim: mühürsüz
    ham.bolumler['6'].muhur = 9; // aralık dışı → 7'ye kırpılır
    ham.bolumler['7'].muhur = 5;
    ham.bolumler['20'] = { yildiz: 0, enIyi: 0, deneme: 3, basarisizSeri: 3, kazanc: 0, muhur: 1 }; // kazanılmamış
    ham.muhurOdulleri = ['carsi:5', 'carsi:5', 'iskele:5', 'carsi:7', 'liman:15'];
    const { kayit: y, onarilan } = kayitOnar(ham);
    expect(y.bolumler['3'].muhur).toBeUndefined();
    expect(y.bolumler['6'].muhur).toBe(7);
    expect(y.bolumler['7'].muhur).toBe(5);
    expect(y.bolumler['20'].muhur).toBeUndefined();
    expect(y.muhurOdulleri).toEqual(['carsi:5', 'liman:15']);
    expect(onarilan).toEqual(expect.arrayContaining(['bolumler.3.muhur', 'bolumler.6.muhur', 'bolumler.20.muhur', 'muhurOdulleri']));
  });

  it('ilerleme puanı mühür ve işle artar ama bir yıldızı geçmez', () => {
    const k = kayit(12, 2);
    const p0 = progressScore(k);
    const m = kayit(12, 2, 0b111); // 21 mühür
    expect(progressScore(m)).toBe(p0 + 5 * 21);
    const s = yap(m, ...iskele, carsi[0]);
    expect(progressScore(s)).toBe(p0 + 5 * 21 + 3 * 7);
    // En dolu kasaba + bütün mühürler bile tek yıldızdan küçük.
    expect(5 * 105 + 3 * 48).toBeLessThan(1000);
    const birYildizFazla = kayit(12, 2);
    birYildizFazla.bolumler['12'].yildiz = 3;
    expect(progressScore(birYildizFazla)).toBeGreaterThan(progressScore(s));
  });

  it('kayıt kodu: şema 3 alanları gidip gelir', () => {
    const k = yap(kayit(8, 3, 0b101), ...iskele);
    k.muhurOdulleri = ['carsi:5'];
    const r = kayitKoduCoz(kayitKoduUret(k));
    expect(r.tamam).toBe(true);
    if (!r.tamam) return;
    expect(r.kayit).toEqual(k);
    expect(r.onizleme).toMatchObject({ muhur: 6, kasabaIs: 6, kandil: kandilDokumu(k).bakiye });
  });

  it('yeni kayıt şema 3 alanlarıyla başlar ve onarım istemez', () => {
    const k = yeniKayit(5);
    expect(k.kasaba).toEqual({ isler: [], gunlukKandil: 0, uyarilan: [] });
    expect(k.muhurOdulleri).toEqual([]);
    expect(kayitOnar(k).onarilan).toEqual([]);
    expect(kayitGoc(JSON.parse(JSON.stringify(k))).gocler).toEqual([]);
  });
});
