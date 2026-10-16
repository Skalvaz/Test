/**
 * Kayıt güvenliği (QA düzeltmeleri; KANCALAR §D.6):
 *  - ileri uyumluluk: yeni şemalı kayıt görülünce depo salt okunur (eski
 *    sekme yeni sürümün mühürlerini/işlerini ezmez);
 *  - eski sürümün sekmesi şema 2 yazdıysa açılışta yedeklerin mühürleri ve
 *    işleri geri eklenir;
 *  - yerel = bulut iken birleşim yeni zarf üretmez (anahtar sırası, göç farkı);
 *  - günlük kandil iki cihazda ayrı günlerde kazanılınca kaybolmaz; tavanlı.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KASABA_ISLERI } from './katalog';
import { Kayitci } from './kayitci';
import { SaveStore, kanonikJson, pickMerged } from '../platform/storage';
import type { SaveEnvelope } from '../platform/storage';
import * as meta from '../meta';
import type { Kayit } from '../meta';
import { ilerlet, kazan } from '../meta/_test/yardimci';
import b14 from '../meta/_test/kayitlar/sema2-bolum14.json';

class BellekDepo {
  m = new Map<string, string>();
  getItem(a: string): string | null {
    return this.m.has(a) ? this.m.get(a)! : null;
  }
  setItem(a: string, d: string): void {
    this.m.set(a, String(d));
  }
  removeItem(a: string): void {
    this.m.delete(a);
  }
}

let depo: BellekDepo;
const g = globalThis as unknown as { localStorage?: unknown };
let onceki: unknown;

beforeEach(() => {
  depo = new BellekDepo();
  onceki = g.localStorage;
  g.localStorage = depo;
});
afterEach(() => {
  g.localStorage = onceki;
});

const isk = KASABA_ISLERI.filter((x) => x.mahalle === 0).map((x) => x.id);

function zarf(k: unknown, savedAt = 1): string {
  return JSON.stringify({ v: meta.ZARF_SURUMU, savedAt, progressScore: 1, data: k });
}

/** Şema 3 kayıt: 12 bölüm 2★, İskele'nin üç işi, 8. bölümde iki mühür. */
function sema3(): Kayit {
  let k = ilerlet(12, 2);
  for (const id of isk.slice(0, 3)) {
    const r = meta.kasabaIsYap(k, id);
    if (r.tamam) k = r.kayit;
  }
  k.bolumler['8'].muhur = 0b011;
  return k;
}

/** Eski sürümün (şema 2) yazdığı kayıt: şema 3 alanları yok. */
function sema2Yaz(k: Kayit): Record<string, unknown> {
  const o = JSON.parse(JSON.stringify(k)) as Record<string, unknown>;
  o.surum = 2;
  delete o.kasaba;
  delete o.muhurOdulleri;
  for (const b of Object.values(o.bolumler as Record<string, Record<string, unknown>>)) delete b.muhur;
  return o;
}

describe('ileri uyumluluk: yeni şemalı kayıt ezilmez', () => {
  it('ana kayıt yeni şemadan: Kayitci salt okunur, yazmaz, yedekleri kaydırmaz', () => {
    const yeni = { ...sema3(), surum: meta.KAYIT_SURUMU + 1, gelecekAlan: { x: 1 } };
    depo.setItem(meta.KAYIT_ANAHTARI, zarf(yeni));
    const k = new Kayitci();
    expect(k.saltOkunur).toBe(true);
    const ham = depo.getItem(meta.KAYIT_ANAHTARI);
    k.degistir(kazan(k.kayit, 13, 3).kayit, 0);
    k.hemenYaz();
    expect(depo.getItem(meta.KAYIT_ANAHTARI)).toBe(ham);
    expect(depo.getItem(meta.KAYIT_YEDEK_ANAHTARLARI[0])).toBeNull();
  });

  it('başka sekme bu arada yeni şemayla yazdı: sonraki yazım atlanır, bildirim bir kez', () => {
    depo.setItem(meta.KAYIT_ANAHTARI, zarf(sema3()));
    const k = new Kayitci();
    expect(k.saltOkunur).toBe(false);
    let bildirim = 0;
    k.depo.onReadOnly = () => bildirim++;
    const yeniSekme = zarf({ ...sema3(), surum: meta.KAYIT_SURUMU + 1 }, 99);
    depo.setItem(meta.KAYIT_ANAHTARI, yeniSekme);
    k.degistir(kazan(k.kayit, 13, 3).kayit, 0);
    k.hemenYaz();
    k.depo.save(k.kayit);
    expect(depo.getItem(meta.KAYIT_ANAHTARI)).toBe(yeniSekme);
    expect(k.saltOkunur).toBe(true);
    expect(bildirim).toBe(1);
  });

  it('depo birleşimi yeni şemalı veriyi birleştirmez (bilinmeyen alanlar düşüp yazılmasın)', () => {
    const a = meta.kayitDeposuAyarlari();
    const yeni = { ...sema3(), surum: meta.KAYIT_SURUMU + 1 } as Kayit;
    expect(a.merge(yeni, sema3())).toBe(yeni);
    expect(a.tooNew(yeni)).toBe(true);
    expect(a.tooNew(sema3())).toBe(false);
  });

  it('SaveStore: bulutta yeni şema → bağlanınca salt okunur, buluta ve yerele yazılmaz', async () => {
    const yazilan: unknown[] = [];
    const bulut = { exists: true, data: () => JSON.parse(zarf({ ...sema3(), surum: meta.KAYIT_SURUMU + 1 })) };
    const w = globalThis as unknown as { window?: unknown };
    const eskiW = w.window;
    w.window = {
      claude: {
        use: async (ad: string) =>
          ad === 'db' ? { doc: () => ({ get: async () => bulut, set: async (x: unknown) => void yazilan.push(x) }) } : { id: async () => 'u1' },
      },
    };
    try {
      const s = new SaveStore<Kayit>(meta.kayitDeposuAyarlari());
      expect(await s.connectRemote()).toBeNull();
      expect(s.readOnly).toBe(true);
      s.save(sema3());
      await new Promise((r) => setTimeout(r, 900));
      expect(yazilan).toHaveLength(0);
      expect(depo.getItem(meta.KAYIT_ANAHTARI)).toBeNull();
    } finally {
      w.window = eskiW;
    }
  });
});

describe('eski sürümün sekmesi şema 2 yazdı: açılışta yedekten tamamlanır', () => {
  it('ana şema 2 (işsiz, mühürsüz), yedek1 şema 3: mühürler ve işler geri gelir, yazılır', () => {
    const k3 = sema3();
    const eski = kazan(k3, 13, 2).kayit; // eski sekme bir bölüm daha oynadı
    depo.setItem(meta.KAYIT_ANAHTARI, zarf(sema2Yaz(eski), 5));
    depo.setItem(meta.KAYIT_YEDEK_ANAHTARLARI[0], zarf(k3, 4));
    const k = new Kayitci();
    expect(k.yedektenTamamlandi).toBe(true);
    expect(k.kayit.bolumler['13']?.yildiz).toBe(2);
    expect(k.kayit.kasaba.isler).toEqual(k3.kasaba.isler);
    expect(k.kayit.bolumler['8'].muhur).toBe(0b011);
    k.hemenYaz();
    const yazilan = JSON.parse(depo.getItem(meta.KAYIT_ANAHTARI)!) as SaveEnvelope<Kayit>;
    expect(yazilan.data.kasaba.isler).toEqual(k3.kasaba.isler);
  });

  it('gerçek şema 2 oyuncusu (yedekler de şema 2): hiçbir şey eklenmez, yazım planlanmaz', () => {
    const ls = (b14 as { localStorage: Record<string, string> }).localStorage;
    for (const [a, d] of Object.entries(ls)) depo.setItem(a, d);
    const k = new Kayitci();
    expect(k.yedektenTamamlandi).toBe(false);
    expect(k.kayit.kasaba.isler).toEqual([]);
    expect(Object.values(k.kayit.bolumler).every((b) => !b.muhur)).toBe(true);
  });

  it('ana kayıt şema 3 ise yedekler birleştirilmez (ilerlemeyi sıfırlama geri alınmasın)', () => {
    depo.setItem(meta.KAYIT_ANAHTARI, zarf(meta.yeniKayit(7), 5));
    depo.setItem(meta.KAYIT_YEDEK_ANAHTARLARI[0], zarf(sema3(), 4));
    const k = new Kayitci();
    expect(k.yedektenTamamlandi).toBe(false);
    expect(k.kayit.kasaba.isler).toEqual([]);
  });
});

describe('yerel = bulut: birleşim yeni zarf üretmez', () => {
  it('tablolu bölümde mühür kazanıldı (anahtar sırası kayitOnar ile farklı): aynı zarf', () => {
    const k = ilerlet(7, 2);
    const r = kazan(k, 8, 3, { muhurler: [true, false, false], motif: undefined });
    const veri = r.kayit;
    const yerel: SaveEnvelope<Kayit> = { v: 1, savedAt: 10, progressScore: 1, data: veri };
    const bulut: SaveEnvelope<Kayit> = { v: 1, savedAt: 10, progressScore: 1, data: JSON.parse(JSON.stringify(meta.kayitCoz(veri).kayit)) };
    const a = meta.kayitDeposuAyarlari();
    const s = pickMerged(yerel, bulut, a.merge, () => {
      throw new Error('yeni zarf beklenmiyordu');
    });
    expect(s === yerel || s === bulut).toBe(true);
    expect(kanonikJson({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(kanonikJson({ a: [{ c: 2, d: 1 }], b: 1 }));
  });

  it('şema 2 zarfı iki kaynakta aynı: göç farkı yeni zarf saymaz', () => {
    const ls = (b14 as { localStorage: Record<string, string> }).localStorage;
    const z = JSON.parse(ls[meta.KAYIT_ANAHTARI]) as SaveEnvelope<Kayit>;
    const z2 = JSON.parse(ls[meta.KAYIT_ANAHTARI]) as SaveEnvelope<Kayit>;
    const a = meta.kayitDeposuAyarlari();
    const s = pickMerged(z, z2, a.merge, () => {
      throw new Error('yeni zarf beklenmiyordu');
    });
    expect(s === z || s === z2).toBe(true);
  });
});

describe('günlük kandil: gün kümesi (iki cihaz) ve tavan', () => {
  it('iki cihazda ayrı günlerde kazanılan kandil birleşimde kaybolmaz; aynı gün iki kez sayılmaz', () => {
    const ortak = sema3();
    const a = JSON.parse(JSON.stringify(ortak)) as Kayit;
    const b = JSON.parse(JSON.stringify(ortak)) as Kayit;
    meta.gunlukKandilEkle(a.kasaba, 20261014);
    meta.gunlukKandilEkle(b.kasaba, 20261015);
    meta.gunlukKandilEkle(b.kasaba, 20261015); // aynı gün ikinci kez sayılmaz
    expect(b.kasaba.gunlukKandil).toBe(1);
    const y = meta.kancaBirlestir(a, b);
    expect(y.kasaba.gunlukKandil).toBe(2);
    expect(y.kasaba.kandilGunleri).toEqual([20261014, 20261015]);
    expect(meta.kancaBirlestir(y, a).kasaba.gunlukKandil).toBe(2);
    expect(meta.kayitOnar(y).onarilan).toEqual([]);
    // Ortak gün iki kez sayılmaz.
    meta.gunlukKandilEkle(a.kasaba, 20261015);
    expect(meta.kancaBirlestir(a, b).kasaba.gunlukKandil).toBe(2);
  });

  it('B o kandille iş yaptıysa birleşimde iş geri alınmaz', () => {
    const ortak = ilerlet(3, 1); // 3 kandil
    let a = JSON.parse(JSON.stringify(ortak)) as Kayit;
    let b = JSON.parse(JSON.stringify(ortak)) as Kayit;
    meta.gunlukKandilEkle(a.kasaba, 20261014);
    meta.gunlukKandilEkle(b.kasaba, 20261015);
    // B: 4 kandil → İskele bayrakları (2) + Fener dizisi (2).
    for (const id of [isk[1], isk[2]]) {
      const r = meta.kasabaIsYap(b, id);
      if (!r.tamam) throw new Error(`iş yapılamadı: ${id}`);
      b = r.kayit;
    }
    const ra = meta.kasabaIsYap(a, isk[0]);
    if (!ra.tamam) throw new Error('iş yapılamadı');
    a = ra.kayit;
    // Eski kural (büyük olan) 1 + 3 = 4 kandil verirdi: B'nin son işi geri alınırdı.
    expect(meta.kandilDokumu(meta.kancaBirlestir(a, b)).kazanilan).toBe(5);
    const y = meta.kancaBirlestir(a, b);
    expect(y.kasaba.isler).toEqual(expect.arrayContaining([isk[0], isk[1], isk[2]]));
  });

  it('onarım: sayaç gün sayısının altına inmez, tarihsiz kısım tavanlı (kayıt koduyla sınırsız kandil yok)', () => {
    const k = sema3();
    const not: string[] = [];
    const v = meta.kasabaOnar({ isler: [], gunlukKandil: 100000, uyarilan: [], kandilGunleri: [20261001, 20261001, 'x'] }, k, (y) => not.push(y));
    expect(v.kandilGunleri).toEqual([20261001]);
    expect(v.gunlukKandil).toBe(1 + meta.GUNLUK_KANDIL_TARIHSIZ_TAVANI);
    expect(not).toContain('kasaba.gunlukKandil');
    expect(meta.kasabaOnar({ isler: [], gunlukKandil: 0, uyarilan: [], kandilGunleri: [20261001, 20261002] }, k, () => undefined).gunlukKandil).toBe(2);
    // Gün listesi sınırı: en yeniler kalır.
    const cok = Array.from({ length: meta.KANDIL_GUNU_SINIRI + 5 }, (_, i) => meta.tarihEkle(20240101, i));
    const w = meta.kasabaOnar({ isler: [], gunlukKandil: cok.length, uyarilan: [], kandilGunleri: cok }, k, () => undefined);
    expect(w.kandilGunleri).toHaveLength(meta.KANDIL_GUNU_SINIRI);
    expect(w.gunlukKandil).toBe(cok.length);
  });

  it('gunlukKandilEkle: gün kaydı, aynı gün bir kez', () => {
    const y = sema3();
    meta.gunlukKandilEkle(y.kasaba, 20261016);
    meta.gunlukKandilEkle(y.kasaba, 20261016);
    expect(y.kasaba.gunlukKandil).toBe(1);
    expect(y.kasaba.kandilGunleri).toEqual([20261016]);
  });
});
