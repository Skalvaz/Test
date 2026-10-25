/**
 * Gerçek şema 2 kayıtlarıyla göç (docs/KANCALAR.md §D.2): örnekler, yayındaki
 * şema 2 sürümünün (`fitil.html` @5c88078) Usta botuyla oynanıp tarayıcı
 * deposundan olduğu gibi alınmış zarflarıdır (`_test/kayitlar/`). Oyuncunun
 * yıldızları, rozetleri, defteri, tabloları ve sandığı KESİNLİKLE aynen kalmalı;
 * kandil yıldız başına 1 (+ tamamlanmış mahalle başına 3) ile başlamalı.
 */
import { describe, expect, it } from 'vitest';
import { pickBetter, pickMerged } from '../platform/storage';
import type { SaveEnvelope } from '../platform/storage';
import b03 from './_test/kayitlar/sema2-bolum03.json';
import b14 from './_test/kayitlar/sema2-bolum14.json';
import b27 from './_test/kayitlar/sema2-bolum27.json';
import { KANDIL, kandilDokumu, kasabaAcikMi, kasabaIsYap, mahalleIsleri, siradakiKasabaIsi, tamamlananMahalle } from './kasaba';
import { KAYIT_ANAHTARI, KAYIT_YEDEK_ANAHTARLARI, KAYIT_SURUMU, ZARF_SURUMU } from './sabitler';
import { kayitCoz, kayitDeposuAyarlari, kayitKoduCoz, kayitKoduUret, kayitYukle, progressScore } from './kayit';
import type { Kayit } from './kayit';
import { haritaVerisi } from './harita';

interface Ornek {
  kaynak: string;
  localStorage: Record<string, string>;
}

const ORNEKLER: [string, Ornek, { yildiz: number; mahalle: number; bolum: number }][] = [
  ['3. bölüm (kasaba açılışı)', b03, { yildiz: 8, mahalle: 0, bolum: 3 }],
  ['14. bölüm (İskele + Çarşı tamam)', b14, { yildiz: 32, mahalle: 2, bolum: 14 }],
  ['27. bölüm (beş mahalle, Usta açık)', b27, { yildiz: 56, mahalle: 5, bolum: 27 }],
];

function zarf(o: Ornek, anahtar: string): SaveEnvelope<Kayit> {
  return JSON.parse(o.localStorage[anahtar]) as SaveEnvelope<Kayit>;
}

/** Kayitci'nin açılış yolu: ana zarfın verisi, sonra yedekler. */
function yukle(o: Ornek) {
  const adaylar = [KAYIT_ANAHTARI, ...KAYIT_YEDEK_ANAHTARLARI].map((a) => zarf(o, a).data);
  return kayitYukle(adaylar, 12345);
}

function hepsiniYap(k: Kayit): Kayit {
  for (;;) {
    const s = siradakiKasabaIsi(k);
    if (!s || s.durum !== 'yapilabilir') return k;
    const r = kasabaIsYap(k, s.is.id);
    if (!r.tamam) throw new Error(r.hata);
    k = r.kayit;
  }
}

describe.each(ORNEKLER)('gerçek şema 2 kaydı: %s', (_ad, o, beklenen) => {
  const ham = zarf(o, KAYIT_ANAHTARI);

  it('zarf eski sürümün yazdığı biçimde (v 1, şema 2) ve SaveStore onu okur', () => {
    expect(ham.v).toBe(ZARF_SURUMU);
    expect((ham.data as unknown as { surum: number }).surum).toBe(2);
  });

  it('göç 2 → 3 onarımsız; eski alanlar birebir aynı (yıldız, rozet, defter, tablo, sandık, günlük)', () => {
    const r = yukle(o);
    expect(r.kaynak).toBe(0);
    expect(r.gocler).toEqual(['2→3']);
    expect(r.onarilan).toEqual([]);
    expect(r.gelecekSurum).toBe(false);
    const { kasaba, muhurOdulleri, surum, ...yeni } = r.kayit;
    expect(surum).toBe(KAYIT_SURUMU);
    const { surum: eskiSurum, ...eski } = ham.data as unknown as Record<string, unknown>;
    expect(eskiSurum).toBe(2);
    // Menü görünümü (Ekim 2026) eski kayıtta yok: onarım sessizce varsayılanı (Ahşap) ekler.
    expect(yeni).toEqual({ ...eski, ayarlar: { ...(eski.ayarlar as object), tema: 'ahsap' } });
    expect(kasaba).toEqual({ isler: [], gunlukKandil: 0, uyarilan: [] });
    expect(muhurOdulleri).toEqual([]);
    // Mühür geriye dönük verilmez.
    expect(Object.values(r.kayit.bolumler).every((b) => b.muhur === undefined)).toBe(true);
    // Tablolar korunur (Gece Tabloları en büyük veri).
    expect(Object.values(r.kayit.bolumler).filter((b) => b.tablo).length).toBe(beklenen.bolum);
  });

  it('yedekler de onarımsız taşınır', () => {
    for (const a of KAYIT_YEDEK_ANAHTARLARI) {
      const r = kayitCoz(zarf(o, a).data);
      expect(r.gocler).toEqual(['2→3']);
      expect(r.onarilan).toEqual([]);
    }
  });

  it('kandil türetilir: yıldız başına 1 + tamamlanmış mahalle başına 3; kasaba açık', () => {
    const k = yukle(o).kayit;
    const d = kandilDokumu(k);
    expect(d).toMatchObject({ yildiz: beklenen.yildiz, muhur: 0, mahalle: beklenen.mahalle, gunluk: 0, harcanan: 0 });
    expect(d.bakiye).toBe(beklenen.yildiz * KANDIL.yildiz + beklenen.mahalle * KANDIL.mahalle);
    expect(tamamlananMahalle(k)).toBe(beklenen.mahalle);
    expect(kasabaAcikMi(k)).toBe(true);
    const h = haritaVerisi(k);
    expect(h.kasaba).toMatchObject({ acik: true, kandil: d.bakiye, isler: [], yapilabilir: true });
    expect(h.dugumler.some((x) => x.tur === 'bolum' && x.sancak)).toBe(false);
  });

  it('ilerleme puanı eski zarfın puanıyla aynı (bulut karşılaştırması bozulmaz)', () => {
    expect(progressScore(yukle(o).kayit)).toBe(ham.progressScore);
  });

  it('göç sonrası işler yapılır; yeni zarf eski zarfı yener, kayıt kodu ve zarf gidiş-dönüş eşit', () => {
    const k0 = yukle(o).kayit;
    const k = hepsiniYap(k0);
    expect(k.kasaba.isler.length).toBeGreaterThan(0);
    // İskele'nin ilk 4 işi (1 + 2 + 2 + 2) en küçük kayıtta bile yapılır.
    expect(k.kasaba.isler).toEqual(expect.arrayContaining(mahalleIsleri(0).slice(0, 4).map((x) => x.id)));
    expect(kandilDokumu(k).bakiye).toBeGreaterThanOrEqual(0);
    const ayar = kayitDeposuAyarlari();
    const yeniZarf: SaveEnvelope<Kayit> = { v: ZARF_SURUMU, savedAt: ham.savedAt + 1, progressScore: ayar.progressScore(k), data: k };
    expect(yeniZarf.progressScore).toBe(ham.progressScore + 3 * k.kasaba.isler.length);
    // Eski sürüm daha sonra (aynı ilerlemeyle) yazmış olsa bile işli kayıt kazanır.
    const eskiSonra = { ...ham, savedAt: ham.savedAt + 99 };
    expect(pickBetter(yeniZarf, eskiSonra)).toBe(yeniZarf);
    // JSON gidiş-dönüş (localStorage / bulut) ve kayıt kodu.
    expect(kayitCoz(JSON.parse(JSON.stringify(yeniZarf))).kayit).toEqual(k);
    const kod = kayitKoduCoz(kayitKoduUret(k));
    expect(kod.tamam && kod.kayit).toEqual(k);
  });

  it('eski sürüm bir bölüm daha kazanıp buluta yazdı: işler korunur, yeni yıldızın kandili eklenir', () => {
    const k = hepsiniYap(yukle(o).kayit);
    // Eski istemcinin yazdığı kayıt: şema 2, bir yıldız fazla (eski formüllü puan).
    const eskiVeri = JSON.parse(JSON.stringify(ham.data)) as Record<string, unknown>;
    const bolumler = eskiVeri.bolumler as Record<string, { yildiz: number }>;
    const son = String(beklenen.bolum);
    const artis = bolumler[son].yildiz < 3 ? 1 : 0;
    bolumler[son].yildiz += artis;
    const eskiZarf = { ...ham, savedAt: ham.savedAt + 500, progressScore: ham.progressScore + 1000 * artis, data: eskiVeri as unknown as Kayit };
    const ayar = kayitDeposuAyarlari();
    const yerel: SaveEnvelope<Kayit> = { v: ZARF_SURUMU, savedAt: ham.savedAt + 1, progressScore: ayar.progressScore(k), data: k };
    const s = pickMerged(yerel, eskiZarf, ayar.merge, (d) => ({ v: ZARF_SURUMU, savedAt: 1, progressScore: ayar.progressScore(d), data: d }))!;
    const y = kayitCoz(s.data).kayit;
    expect(y.kasaba.isler).toEqual(k.kasaba.isler);
    expect(y.bolumler[son].yildiz).toBe(k.bolumler[son].yildiz + artis);
    expect(kandilDokumu(y).bakiye).toBe(kandilDokumu(k).bakiye + artis);
    expect(y.rozetler).toEqual(k.rozetler);
    expect(y.koleksiyon).toEqual(k.koleksiyon);
  });
});
