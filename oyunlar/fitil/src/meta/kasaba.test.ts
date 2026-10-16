/**
 * Kasaba ekonomisi (docs/KANCALAR.md §B, §D): kandil kazanımı, harcama, iş
 * sırası, mahalle tamamlanması, ilerleme puanı ve bulut + tarayıcı
 * birleştirmesinde kandil/iş kaybolmaması.
 */
import { describe, expect, it } from 'vitest';
import { KASABA_ISLERI, MAHALLELER } from '../app/katalog';
import { Rng } from '../platform/rng';
import { pickBetter, pickMerged } from '../platform/storage';
import type { SaveEnvelope } from '../platform/storage';
import {
  KANDIL,
  kancaBirlestir,
  kandilDokumu,
  kandilKazanimi,
  kasabaAcildi,
  kasabaIsDurumu,
  kasabaIsYap,
  kasabaOnar,
  kasabaUyarildi,
  kasabaUyarisi,
  mahalleIsleri,
  mahalleSuslendi,
  siradakiKasabaIsi,
  suslenenMahalle,
} from './kasaba';
import { kayitCoz, kayitDeposuAyarlari, kayitOnar, progressScore, yeniKayit } from './kayit';
import type { Kayit } from './kayit';
import { ilerlet, kazan } from './_test/yardimci';

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

/** Yapılabilen en ucuz işleri kandil yettikçe yapar (tipik oyuncu). */
function hepsiniYap(k: Kayit): Kayit {
  for (;;) {
    const s = siradakiKasabaIsi(k);
    if (!s || s.durum !== 'yapilabilir') return k;
    k = yap(k, s.is.id);
  }
}

const isk = mahalleIsleri(0).map((x) => x.id);
const car = mahalleIsleri(1).map((x) => x.id);
const lim = mahalleIsleri(2).map((x) => x.id);

function sema2(k: Kayit): Record<string, unknown> {
  const o = JSON.parse(JSON.stringify(k)) as Record<string, unknown>;
  delete o.kasaba;
  delete o.muhurOdulleri;
  for (const b of Object.values(o.bolumler as Record<string, Record<string, unknown>>)) delete b.muhur;
  o.surum = 2;
  return o;
}

function zarf(k: unknown, savedAt: number, puan?: number): SaveEnvelope<Kayit> {
  const d = k as Kayit;
  return { v: 1, savedAt, progressScore: puan ?? progressScore(kayitCoz(d).kayit), data: d };
}

describe('kandil kazanımı', () => {
  it('yeni yıldız +1, aynı bölümü yıldızsız tekrar 0; mahalle tamamlama +3', () => {
    let k = ilerlet(2, 1);
    let r = kazan(k, 3, 2);
    expect(kandilKazanimi(k, r.kayit)).toEqual({ onceki: 2, yeni: 4, kaynak: { yildiz: 2, muhur: 0, mahalle: 0, gunluk: 0 }, toplam: 2 });
    k = r.kayit;
    // Tekrar: daha az yıldızla kazanmak kandil vermez.
    r = kazan(k, 3, 1);
    expect(kandilKazanimi(k, r.kayit)).toBeNull();
    // Rekor artışı yalnız farkı verir.
    r = kazan(k, 3, 3);
    expect(kandilKazanimi(k, r.kayit)?.kaynak.yildiz).toBe(1);
    k = ilerlet(4, 1);
    r = kazan(k, 5, 1);
    expect(kandilKazanimi(k, r.kayit)).toMatchObject({ kaynak: { yildiz: 1, mahalle: KANDIL.mahalle }, toplam: 1 + KANDIL.mahalle });
  });

  it('yeni mühür +1, günlük 3/3 +1; harcama kazanım sayılmaz', () => {
    const k = kayit(8, 2);
    const y = JSON.parse(JSON.stringify(k)) as Kayit;
    y.bolumler['7'].muhur = 0b101;
    y.kasaba.gunlukKandil = 1;
    expect(kandilKazanimi(k, y)).toMatchObject({ kaynak: { yildiz: 0, muhur: 2, mahalle: 0, gunluk: 1 }, toplam: 3 });
    const harcadi = yap(k, isk[0]);
    expect(kandilKazanimi(k, harcadi)).toBeNull();
    expect(kandilDokumu(harcadi).bakiye).toBe(kandilDokumu(k).bakiye - 1);
  });

  it('kasaba 3. bölümün ilk kazancıyla açılır (bir kez)', () => {
    const k = ilerlet(2, 3);
    const r = kazan(k, 3, 1);
    expect(kasabaAcildi(k, r.kayit)).toBe(true);
    expect(kasabaAcildi(r.kayit, kazan(r.kayit, 3, 3).kayit)).toBe(false);
    expect(kasabaAcildi(ilerlet(1), ilerlet(2))).toBe(false);
  });
});

describe('iş sırası ve kilitler', () => {
  it('"kandil yetti" uyarısı yalnız sıradaki işe; geçilirse o iş yapılana kadar susar, yapılınca sıradakine geçer', () => {
    let k = kayit(3, 3); // 9 kandil
    const u1 = kasabaUyarisi(k)!;
    expect(u1.id).toBe(isk[0]);
    k = kasabaUyarildi(k, u1.id);
    expect(kasabaUyarisi(k)).toBeNull();
    k = yap(k, isk[0]);
    const u2 = kasabaUyarisi(k)!;
    expect(u2.maliyet).toBe(2);
    expect(kasabaIsDurumu(k, u2.id).durum).toBe('yapilabilir');
    // Taç iş öbür beşi bitmeden sıradaki olmaz.
    k = yap(k, isk[1], isk[2], isk[3]);
    expect(siradakiKasabaIsi(k)?.is.id).toBe(isk[4]);
  });

  it('haritaKilitli: mahallenin ilk bölümü açılmadan iş yapılamaz, açılınca yapılır', () => {
    let k = kayit(9, 3, 0b111); // açık en yüksek 10: Çarşı (6) açık, Liman (11) sisli
    k = hepsiniYap(k);
    expect(mahalleSuslendi(k, 0)).toBe(true);
    expect(mahalleSuslendi(k, 1)).toBe(true);
    expect(kasabaIsDurumu(k, lim[0]).durum).toBe('haritaKilitli');
    k = kazan(k, 10, 3).kayit;
    expect(kasabaIsDurumu(k, lim[0]).durum).not.toBe('haritaKilitli');
  });

  it('sirada: sonraki mahalle önceki süslenmeden açılmaz; suslenenMahalle ilerler', () => {
    let k = kayit(15, 3, 0b111);
    expect(suslenenMahalle(k)).toBe(0);
    expect(kasabaIsDurumu(k, car[0]).durum).toBe('sirada');
    k = yap(k, ...isk);
    expect(suslenenMahalle(k)).toBe(1);
    expect(kasabaIsDurumu(k, car[0]).durum).toBe('yapilabilir');
    expect(kasabaIsDurumu(k, lim[0]).durum).toBe('sirada');
  });

  it('tam ekonomi: bütün yıldızlar tek başına kasabayı bitirmez, mühürlerle biter (144 < 186 ≤ 273)', () => {
    const yalnizYildiz = hepsiniYap(kayit(40, 3));
    expect(kandilDokumu(yalnizYildiz).kazanilan).toBe(120 + 8 * KANDIL.mahalle);
    expect(yalnizYildiz.kasaba.isler.length).toBeLessThan(48);
    const tam = hepsiniYap(kayit(40, 3, 0b111));
    expect(kandilDokumu(tam)).toMatchObject({ kazanilan: 120 + 105 + 24, harcanan: 186, bakiye: 120 + 105 + 24 - 186 });
    expect(tam.kasaba.isler).toHaveLength(48);
    expect(suslenenMahalle(tam)).toBe(-1);
    expect(siradakiKasabaIsi(tam)).toBeNull();
    for (const m of MAHALLELER) expect(tam.koleksiyon.kartlar).toContain(`kasaba:${m.id}`);
    expect(kayitOnar(tam).onarilan).toEqual([]);
  });

  it('bulanık: rastgele kazanç/mühür/iş dizilerinde bakiye ≥ 0, onarım değiştirmez, puan azalmaz', () => {
    for (let tohum = 1; tohum <= 25; tohum++) {
      const rng = new Rng(`kasaba-${tohum}`);
      const r = () => rng.float();
      let k = yeniKayit(tohum);
      let puan = progressScore(k);
      let bolum = 1;
      for (let adim = 0; adim < 120; adim++) {
        const s = r();
        if (s < 0.45 && bolum <= 40) {
          const yildiz = (1 + Math.floor(r() * 3)) as 1 | 2 | 3;
          k = kazan(k, bolum, yildiz).kayit;
          if (bolum >= 6 && r() < 0.5) k.bolumler[String(bolum)].muhur = (k.bolumler[String(bolum)].muhur ?? 0) | (1 << Math.floor(r() * 3));
          bolum++;
        } else if (s < 0.55 && bolum > 1) {
          const id = 1 + Math.floor(r() * (bolum - 1));
          k = kazan(k, id, 3).kayit;
        } else if (s < 0.6) {
          k.kasaba.gunlukKandil++;
        } else {
          const is = KASABA_ISLERI[Math.floor(r() * KASABA_ISLERI.length)];
          const d = kasabaIsDurumu(k, is.id);
          const y = kasabaIsYap(k, is.id);
          expect(y.tamam).toBe(d.durum === 'yapilabilir');
          if (y.tamam) k = y.kayit;
        }
        const d = kandilDokumu(k);
        expect(d.bakiye).toBe(d.kazanilan - d.harcanan);
        expect(d.bakiye).toBeGreaterThanOrEqual(0);
        const p = progressScore(k);
        expect(p).toBeGreaterThanOrEqual(puan);
        puan = p;
      }
      expect(kasabaOnar(JSON.parse(JSON.stringify(k.kasaba)), k, (y) => {
        throw new Error(`onarım beklenmiyordu: ${y}`);
      })).toEqual(k.kasaba);
    }
  });
});

describe('bulut + tarayıcı birleştirmesi (kandil ve işler kaybolmaz)', () => {
  it('kancaBirlestir: işler sırayla birleşir, mühürler VEYA, günlük büyük olan, kart eklenir', () => {
    const ortak = kayit(12, 2);
    const a = yap(JSON.parse(JSON.stringify(ortak)), isk[0], isk[1], isk[2]);
    a.bolumler['7'].muhur = 0b001;
    a.kasaba.gunlukKandil = 2;
    const b = yap(JSON.parse(JSON.stringify(ortak)), isk[3], isk[4], isk[0]);
    b.bolumler['7'].muhur = 0b100;
    b.bolumler['8'].muhur = 0b010;
    b.kasaba.gunlukKandil = 1;
    b.kasaba.uyarilan = [isk[3]];
    const y = kancaBirlestir(a, b);
    expect(y.kasaba.isler).toEqual([isk[0], isk[1], isk[2], isk[3], isk[4]]);
    expect(y.bolumler['7'].muhur).toBe(0b101);
    expect(y.bolumler['8'].muhur).toBe(0b010);
    expect(y.kasaba.gunlukKandil).toBe(2);
    expect(y.kasaba.uyarilan).toEqual([isk[3]]);
    expect(kayitOnar(y).onarilan).toEqual([]);
    // Girdiler değişmez; birleşim kendisiyle değişmez (idempotent).
    expect(a.kasaba.isler).toHaveLength(3);
    expect(kancaBirlestir(y, y)).toEqual(y);
    expect(kancaBirlestir(y, a)).toEqual(y);
    // Taç iş öbüründen gelince mahalle süslenir ve kart verilir.
    const c = yap(JSON.parse(JSON.stringify(ortak)), ...isk);
    const z = kancaBirlestir(a, c);
    expect(mahalleSuslendi(z, 0)).toBe(true);
    expect(z.koleksiyon.kartlar).toContain('kasaba:iskele');
  });

  it('bütçe: kazananın kandili yetmeyen işler öbüründen gelmez; kazananın işleri hiç atılmaz', () => {
    const az = kayit(3, 1); // 3 kandil
    const a = yap(JSON.parse(JSON.stringify(az)), isk[1]); // 2 harcandı
    const b = yap(kayit(5, 3), isk[0], isk[2], isk[3], isk[4]);
    const y = kancaBirlestir(a, b);
    // Kazanan (a) 3 kandil kazandı: isk[1] (2) + isk[0] (1) = 3; gerisi sığmaz.
    expect(y.kasaba.isler).toEqual([isk[1], isk[0]]);
    expect(kandilDokumu(y).bakiye).toBe(0);
  });

  it('mühür yalnız kazananda kazanılmış bölüme gelir; kazanılmamış bölüm atlanır', () => {
    const a = kayit(7, 2);
    const b = kayit(9, 2, 0b111);
    const y = kancaBirlestir(a, b);
    expect(y.bolumler['7'].muhur).toBe(7);
    expect(y.bolumler['8']).toBeUndefined();
    expect(kayitOnar(y).onarilan).toEqual([]);
  });

  it('eski sürüm (şema 2) bir yıldız ileride yazdı: işler ve mühürler yerelden korunur', () => {
    let yerel = yap(kayit(12, 2, 0b011), isk[0], isk[1], isk[2], isk[3], isk[4]);
    const eskiK = kazan(kayit(12, 2), 12, 3).kayit; // eski sekme bir yıldız daha aldı
    const eski = sema2(eskiK);
    const ayar = kayitDeposuAyarlari();
    // Eski istemcinin zarf puanı eski formülle (mühür ve iş yok).
    const bulutZarf = zarf(eski, 2000, 25 * 1000 + 13);
    const yerelZarf = zarf(yerel, 1000);
    expect(pickBetter(yerelZarf, bulutZarf)).toBe(bulutZarf);
    const sonuc = pickMerged(yerelZarf, bulutZarf, ayar.merge, (d) => ({ v: 1, savedAt: 3000, progressScore: ayar.progressScore(d), data: d }));
    expect(sonuc).not.toBe(bulutZarf);
    const k = kayitCoz(sonuc!.data).kayit;
    expect(k.bolumler['12'].yildiz).toBe(3);
    expect(k.kasaba.isler).toEqual([isk[0], isk[1], isk[2], isk[3], isk[4]]);
    expect(k.bolumler['8'].muhur).toBe(0b011);
    expect(sonuc!.progressScore).toBeGreaterThan(bulutZarf.progressScore);
    // Kandil kaybolmadı: yerelin kazancı + yeni yıldız.
    expect(kandilDokumu(k).bakiye).toBe(kandilDokumu(yerel).bakiye + 1);
    // Yerel ilerideyse ve bulutta fazladan bir şey yoksa yerel zarf aynen kalır.
    yerel = kazan(yerel, 12, 3).kayit;
    const yz = zarf(yerel, 4000);
    expect(pickMerged(yz, bulutZarf, ayar.merge, () => {
      throw new Error('yeni zarf beklenmiyordu');
    })).toBe(yz);
  });

  it('iki cihaz ayrı mahalle işleri yaptı: ilerisi seçilir, öbürünün işleri eklenir', () => {
    const ortak = kayit(10, 3);
    const tel = hepsiniYap(JSON.parse(JSON.stringify(ortak))); // İskele + Çarşı işleri
    const tablet = kazan(yap(JSON.parse(JSON.stringify(ortak)), isk[0]), 11, 3).kayit; // bir bölüm ileride, tek iş
    const ayar = kayitDeposuAyarlari();
    const s = pickMerged(zarf(tel, 1), zarf(tablet, 2), ayar.merge, (d) => zarf(d, 3))!;
    const k = kayitCoz(s.data).kayit;
    expect(k.bolumler['11']?.yildiz).toBe(3);
    expect(k.kasaba.isler).toEqual(expect.arrayContaining(tel.kasaba.isler));
    expect(k.kasaba.isler).toHaveLength(tel.kasaba.isler.length);
    expect(kandilDokumu(k).bakiye).toBe(kandilDokumu(tel).bakiye + 3 + KANDIL.mahalle * 0);
  });

  it('birleştirme hata verirse seçilen zarf aynen kalır; tek kaynakta birleştirme yok', () => {
    const a = zarf(kayit(3), 1);
    const b = zarf(kayit(4), 2);
    expect(pickMerged(a, b, () => {
      throw new Error('bozuk');
    }, (d) => zarf(d, 9))).toBe(b);
    expect(pickMerged(a, null, () => {
      throw new Error('çağrılmamalı');
    }, (d) => zarf(d, 9))).toBe(a);
  });
});
