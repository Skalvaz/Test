/**
 * İngilizce (meta grubu): katalog adları, kasaba işleri ve sakin sözleri,
 * günlük görevler, rozetler, Usta Bölümleri, Fener Nöbeti basamakları,
 * nadirlik, motifler, kayıt kodu hataları, mola ve paylaşım metni.
 * Modüller dil belirlendikten SONRA yüklenir (yalnız dinamik içe aktarım);
 * karşılaştırma için Türkçe kopya `vi.resetModules()` ile ayrıca yüklenir.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

type Dil = 'tr' | 'en';
const kuresel = globalThis as { __FITIL_DIL__?: Dil };
kuresel.__FITIL_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
/** Çevrilmeyen özel adlar (sakinler, bayramlar, marka). */
const BEYAZ = [/FİTİL/g, /Rıza/g, /Nazlı/g, /Hüsnü/g, /Gülizar/g, /Ayşe/g, /Hıdırellez/g, /Nevruz/g];
/** Görünen metinde kalmaması gereken sık Türkçe sözcükler (harfsiz olanlar da). */
const TR_SOZ = /(?<![\w'’])(ve|bir|ile|hamle|bölüm|Bolum|kandil|Usta|Kasaba|mahalle|Mahalle|yap|kazan|patlat|Fener|Kale|Liman|Tepe)(?![\w'’])/;

function turkce(s: string): boolean {
  let x = s;
  for (const b of BEYAZ) x = x.replace(b, '');
  return TR_HARF.test(x) || TR_SOZ.test(x);
}

type Moduller = {
  katalog: typeof import('../app/katalog');
  meta: typeof import('../meta/index');
};

async function yukle(dil: Dil): Promise<Moduller> {
  vi.resetModules();
  kuresel.__FITIL_DIL__ = dil;
  const katalog = await import('../app/katalog');
  const meta = await import('../meta/index');
  return { katalog, meta };
}

let en: Moduller;
let tr: Moduller;

beforeAll(async () => {
  tr = await yukle('tr');
  en = await yukle('en');
});

/** Dilin metin örnekleri (yol → metin): iki dilde aynı yollar. */
function ornekler(m: Moduller): Map<string, string> {
  const { katalog: K, meta: M } = m;
  const r = new Map<string, string>();
  const ekle = (yol: string, s: string) => r.set(yol, s);
  for (const [id, g] of Object.entries(K.GOKYUZU)) ekle(`gokyuzu.${id}`, g.ad);
  for (const mh of K.MAHALLELER) {
    ekle(`mahalle.${mh.id}.ad`, mh.ad);
    ekle(`mahalle.${mh.id}.siluet`, mh.siluet);
    ekle(`mahalle.${mh.id}.defter`, mh.defter);
  }
  for (const d of K.DESENLER) ekle(`desen.${d.id}`, d.ad);
  for (const f of K.FITILLER) ekle(`fitil.${f.id}`, f.ad);
  for (const g of K.GUCLENDIRICILER) ekle(`guc.${g.id}`, g.ad);
  K.KAPSUL_RENKLERI.forEach((k, i) => ekle(`renk.${i}`, k.ad));
  K.KASABA_SAKINLERI.forEach((s, i) => ekle(`sakin.${i}`, s));
  for (const is of K.KASABA_ISLERI) {
    ekle(`is.${is.id}.ad`, is.ad);
    ekle(`is.${is.id}.aciklama`, is.aciklama);
    ekle(`is.${is.id}.sakin`, is.sakin);
  }
  for (let s = 1; s <= 20; s++) for (let renk = 0; renk < 6; renk++) ekle(`gorev.${s}.${renk}`, M.gorevMetni({ sablon: s, renk }));
  for (const b of M.ROZETLER) {
    ekle(`rozet.${b.id}.ad`, b.ad);
    ekle(`rozet.${b.id}.aciklama`, b.aciklama);
  }
  M.USTA_BOLUMLERI.forEach((u, i) => {
    ekle(`usta.${i}.ad`, u.ad);
    ekle(`usta.${i}.kural`, u.kural);
  });
  for (const s of M.SERI_BASAMAKLARI) {
    ekle(`seri.${s.id}.ad`, s.ad);
    ekle(`seri.${s.id}.yonelme`, s.yonelme);
  }
  M.NADIRLIK_ADLARI.forEach((n, i) => ekle(`nadirlik.${i}`, n));
  for (const mt of M.MOTIFLER) {
    ekle(`motif.${mt.id}.ad`, mt.ad);
    ekle(`motif.${mt.id}.kaynak`, mt.kaynak);
  }
  for (const [h, s] of Object.entries(M.KAYIT_KODU_HATA_METINLERI)) ekle(`kodHata.${h}`, s);
  ekle('mola', M.MOLA_METNI);
  ekle('paylasim', M.paylasimMetni(20261014, { yildiz: 2, kullanilan: 18, toplam: 22, enBuyuk: 27, izgara: '●▲■' }));
  // Harita verisi ve kayıt kodu çözümü (uygulamanın gösterdiği yoldan).
  const h = M.haritaVerisi(M.yeniKayit(1));
  for (const d of h.dugumler) if (d.tur === 'usta') ekle(`harita.usta.${d.ustaNo}`, `${d.ad} / ${d.kural}`);
  for (const mh of h.mahalleler) ekle(`harita.mahalle.${mh.id}`, mh.ad);
  const bos = M.kayitKoduCoz('');
  ekle('kodCoz.bos', bos.tamam ? '' : bos.mesaj);
  return r;
}

describe('İngilizce: meta ve katalog metinleri', () => {
  it('Türkçe kalıntı yok (özel adlar hariç)', () => {
    const kalinti = [...ornekler(en)].filter(([, s]) => turkce(s)).map(([y, s]) => `${y}: ${s}`);
    expect(kalinti, kalinti.slice(0, 30).join('\n')).toEqual([]);
  });

  it('her metin çevrilmiş ve dolu (aynı kalan yalnız ortak sözcükler)', () => {
    const t = ornekler(tr);
    const e = ornekler(en);
    expect([...e.keys()]).toEqual([...t.keys()]);
    // İki dilde aynı yazılan adlar (Spiral, Domino, sakinin sözü olmayan yollar yok).
    const ayniOlabilir = new Set(['desen.spiral', 'rozet.domino.ad', 'usta.4.ad']);
    const ayni = [...e].filter(([y, s]) => s === t.get(y) && !ayniOlabilir.has(y)).map(([y]) => y);
    expect(ayni).toEqual([]);
    for (const [y, s] of e) expect(s.trim().length, y).toBeGreaterThan(0);
  });

  it('uzunluk: İngilizce Türkçeden belirgin uzun değil (yerleşim sığsın)', () => {
    const t = ornekler(tr);
    const uzun: string[] = [];
    for (const [y, s] of ornekler(en)) {
      const tt = t.get(y)!;
      // Kısa metinlerde 10 harf, uzunlarda ~%35 pay; sakin adı ve balonu rol adı yüzünden
      // ("Barutçu Kemal" → "Kemal the Powder Maker", +9) biraz daha geniş.
      const sakin = y.startsWith('sakin.') || y.endsWith('.sakin');
      const pay = Math.max(sakin ? 12 : 10, Math.ceil(tt.length * 0.35));
      if (s.length > tt.length + pay) uzun.push(`${y}: ${tt.length} → ${s.length} "${s}"`);
    }
    expect(uzun, uzun.join('\n')).toEqual([]);
  });

  it('sakin balonu: İngilizce rol adı + söz; kişi adı korunur', () => {
    const is = en.katalog.KASABA_ISLERI.find((x) => x.id === 'iskele.kayikFenerleri')!;
    expect(is.sakin.startsWith('Rıza the Boatman: ')).toBe(true);
    expect(en.katalog.KASABA_SAKINLERI).toEqual([
      'Rıza the Boatman',
      'Nazlı the Lamplighter',
      'Captain Yakup',
      'Hüsnü the Clockmaker',
      'Gülizar the Gardener',
      'Ayşe the Astronomer',
      'Kemal the Powder Maker',
      'Murat the Wall Guard',
    ]);
    expect(en.katalog.MAHALLELER.map((m) => m.ad)).toEqual(['Pier', 'Bazaar', 'Harbor', 'Clock Tower', 'Gardens', 'Hilltop', 'Factory', 'Castle']);
    expect(en.katalog.GUCLENDIRICILER.map((g) => g.ad)).toEqual(['Match', 'Rocket Mold', 'Undo']);
  });

  it('kimlikler ve sayılar iki dilde aynı (yalnız metin değişir)', () => {
    const kim = (m: Moduller) => ({
      is: m.katalog.KASABA_ISLERI.map((x) => [x.id, x.mahalle, x.sira, x.maliyet, x.cizim, x.yer.x, x.yer.y]),
      mahalle: m.katalog.MAHALLELER.map((x) => [x.id, x.vurgu, x.gokyuzu]),
      desen: m.katalog.DESENLER.map((x) => [x.id, x.baslangicta]),
      seri: m.meta.SERI_BASAMAKLARI.map((x) => [x.id, x.esik]),
    });
    expect(kim(en)).toEqual(kim(tr));
  });

  it('görev ve paylaşım metni: İngilizce biçim', () => {
    expect(en.meta.gorevMetni({ sablon: 3, renk: 3 })).toBe('Pop 50 sky capsules');
    expect(en.meta.gorevMetni({ sablon: 17 })).toBe('Win the Daily Festival');
    expect(en.meta.paylasimMetni(20261014, { yildiz: 2, kullanilan: 18, toplam: 22, enBuyuk: 27, izgara: '●▲■' })).toBe(
      'FİTİL · Daily Festival Oct 14, 2026\n★★☆  18/22 moves  Biggest: 27\n●▲■',
    );
    // Türkçe aynen.
    expect(tr.meta.paylasimMetni(20261014, { yildiz: 2, kullanilan: 18, toplam: 22, enBuyuk: 27, izgara: '●▲■' })).toBe(
      'FİTİL · Günün Şenliği 14.10.2026\n★★☆  18/22 hamle  En büyük: 27\n●▲■',
    );
  });
});
