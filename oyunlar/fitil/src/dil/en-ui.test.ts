/**
 * İngilizce arayüz metinleri (src/ui): metin işlevleri örnek argümanlarla
 * çağrılır; Türkçe harf kalmamalı, dilbilgisi (tekil/çoğul, sayı ve tarih
 * biçimi) doğru olmalı, kısa etiketler Türkçesinden belirgin uzun olmamalı
 * (yerleşim aynı genişliğe göre). Dil modüller yüklenmeden önce açılır:
 * bu dosyada yalnız dinamik içe aktarım; Türkçe karşılaştırma için modüller
 * `vi.resetModules` ile Türkçe yeniden yüklenir.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { HedefVM } from '../ui/tipler';

const g = globalThis as { __FITIL_DIL__?: string };
g.__FITIL_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
/** Çevrilmeyen özel adlar (sakinler, bayramlar, oyunun adı). */
const BEYAZ = [/FİTİL/g, /Rıza/g, /Nazlı/g, /Hüsnü/g, /Gülizar/g, /Ayşe/g, /Hıdırellez/g, /Nevruz/g];
const turkceMi = (s: string): boolean => TR_HARF.test(BEYAZ.reduce((x, b) => x.replace(b, ''), s));

type Mod = typeof import('../ui/metinler');
let en: Mod;
let tr: Mod;
let paylasim: typeof import('../ui/paylasim');
let ikonlar: typeof import('../ui/ikonlar');
let susler: typeof import('../ui/harita/susler');
let cizim: typeof import('../ui/harita/cizim');

beforeAll(async () => {
  en = await import('../ui/metinler');
  paylasim = await import('../ui/paylasim');
  ikonlar = await import('../ui/ikonlar');
  susler = await import('../ui/harita/susler');
  cizim = await import('../ui/harita/cizim');
  vi.resetModules();
  g.__FITIL_DIL__ = 'tr';
  tr = await import('../ui/metinler');
  g.__FITIL_DIL__ = 'en';
});

const ORNEK: unknown[][] = [[1], [3], [16], ['Bazaar'], ['Silver Thread', 3], [12, 5, true], [5, 0, false], [19, 27, true], [23, 17, 6], ['Arch garland', 4, 'ready to build'], ['cirak'], ['kalfa'], ['usta']];

/** Nesnedeki bütün metinleri (işlevleri örnek argümanlarla çağırarak) toplar. */
function topla(deger: unknown, yol: string, out: Map<string, string>): void {
  if (typeof deger === 'string') out.set(yol, deger);
  else if (typeof deger === 'function') {
    for (const a of ORNEK) {
      try {
        const s = (deger as (...x: unknown[]) => unknown)(...a);
        if (typeof s === 'string') out.set(`${yol}(${JSON.stringify(a)})`, s);
      } catch {
        /* uymayan örnek argüman */
      }
    }
  } else if (deger && typeof deger === 'object') for (const [k, v] of Object.entries(deger)) topla(v, `${yol}.${k}`, out);
}

const HEDEFLER: HedefVM[] = [
  ...(['kafes', 'kaya', 'aydinlat', 'is', 'zincirleme', 'puan', 'fener', 'devFisek', 'halka'] as const).map((tur) => ({ tur, gerekli: 12, ilerleme: 3, tamam: false, esik: 20 })),
  { tur: 'desen', gerekli: 4, ilerleme: 4, tamam: true, motif: 'lale' },
  { tur: 'desen', gerekli: 4, ilerleme: 1, tamam: false },
  { tur: 'topla', gerekli: 25, ilerleme: 0, tamam: false, renk: 2 },
  { tur: 'topla', gerekli: 25, ilerleme: 24, tamam: false, renk: 'hepsi' },
  { tur: 'fener', gerekli: 1, ilerleme: 0, tamam: false },
];

describe('İngilizce arayüz metinleri (ui)', () => {
  it('M, MK ve tablolar: Türkçe harf yok, boş metin yok', () => {
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(en)) topla(v, k, out);
    const kalan = [...out].filter(([, s]) => turkceMi(s)).map(([k, s]) => `${k}: ${s}`);
    expect(kalan, kalan.slice(0, 30).join('\n')).toEqual([]);
    // Doğrudan metinler (örnek argümana uymayan işlev çağrıları boş dönebilir).
    const bos = [...out].filter(([k, s]) => s.trim() === '' && !k.includes('(')).map(([k]) => k);
    expect(bos).toEqual([]);
  });

  it('kısa etiketler Türkçesinden belirgin uzun değil (yerleşim sığsın)', () => {
    const e = new Map<string, string>();
    const t = new Map<string, string>();
    for (const k of ['M', 'MK', 'MOTIF_ADLARI', 'GUCLENDIRICI_ADLARI', 'NADIRLIK_ADLARI', 'ENGEL_ADLARI', 'SERI_BASAMAKLARI'] as const) {
      topla(en[k], k, e);
      topla(tr[k], k, t);
    }
    const uzun: string[] = [];
    for (const [k, s] of e) {
      const x = t.get(k);
      // Kısa etiketler (düğme, sekme, başlık): Türkçesi ≤ 16 harf.
      if (x === undefined || x.length > 16) continue;
      if (s.length > Math.max(x.length + 6, x.length * 1.6)) uzun.push(`${k}: "${x}" → "${s}"`);
    }
    expect(uzun, uzun.join('\n')).toEqual([]);
  });

  it('hedef metinleri: tekil/çoğul ve sayı biçimi', () => {
    for (const h of HEDEFLER) {
      for (const s of [en.hedefMetni(h), en.kalanMetni(h), en.hedefEtiketi(h), en.hedefAdi(h)]) {
        expect(turkceMi(s), s).toBe(false);
        expect(s.length).toBeGreaterThan(1);
      }
    }
    expect(en.hedefMetni({ tur: 'kafes', gerekli: 6, ilerleme: 0, tamam: false })).toBe('Break all cages');
    expect(en.hedefMetni({ tur: 'topla', gerekli: 25, ilerleme: 0, tamam: false, renk: 0 })).toBe('25 red');
    expect(en.hedefMetni({ tur: 'topla', gerekli: 25, ilerleme: 0, tamam: false, renk: 'hepsi' })).toBe('25 capsules');
    expect(en.hedefMetni({ tur: 'fener', gerekli: 1, ilerleme: 0, tamam: false })).toBe('Bring down 1 lantern');
    expect(en.hedefMetni({ tur: 'zincirleme', gerekli: 3, ilerleme: 0, tamam: false, esik: 15 })).toBe('15+ reactions, 3 times');
    expect(en.hedefMetni({ tur: 'puan', gerekli: 12450, ilerleme: 0, tamam: false })).toBe('12,450 points');
    expect(en.hedefMetni({ tur: 'desen', gerekli: 4, ilerleme: 0, tamam: false, motif: 'lale' })).toBe('Paint the Tulip pattern');
    expect(en.kalanMetni({ tur: 'kafes', gerekli: 6, ilerleme: 5, tamam: false })).toBe('1 cage left');
    expect(en.kalanMetni({ tur: 'kafes', gerekli: 6, ilerleme: 3, tamam: false })).toBe('3 cages left');
    expect(en.kalanMetni({ tur: 'topla', gerekli: 40, ilerleme: 37, tamam: false, renk: 0 })).toBe('3 red left');
    expect(en.kalanMetni({ tur: 'puan', gerekli: 6000, ilerleme: 4800, tamam: false })).toBe('1,200 points left');
    expect(en.hedefEtiketi({ tur: 'topla', gerekli: 40, ilerleme: 28, tamam: false, renk: 0 })).toBe('Red: 12 left');
    expect(en.hedefEtiketi({ tur: 'kafes', gerekli: 6, ilerleme: 6, tamam: true })).toBe('Cage: done');
  });

  it('sayı, yüzde, tarih ve bölüm başlıkları', () => {
    expect(en.sayi(12450)).toBe('12,450');
    expect(en.yuzde(0.92)).toBe('92%');
    expect(en.tarihUzun(20261014)).toBe('October 14, 2026');
    expect(en.tarihKisa(20261014)).toBe('Oct 14, 2026');
    expect(en.bolumBasligi(12)).toBe('Level 12');
    expect(en.bolumBasligi(103)).toBe('Master 3');
    expect(en.bolumBasligi(20261014, 'gunluk')).toBe('Daily Festival');
    expect(en.bolumBasligi(1_000_005)).toBe('Endless 5');
    expect(en.esikBilgisi(3)).toBe('Dry Night: powder ignites at 3 heat');
  });

  it('Türkçe ek yardımcılarının İngilizce karşılığı', () => {
    expect(en.belirtmeEki(6)).toBe('');
    expect(en.MK.haritaKilitli(16)).toBe('Unlock level 16');
    expect(en.M.kilitliMahalle(16)).toBe('Opens at level 16');
    expect(en.M.kilitliBolum(5)).toBe('Win level 5 first');
    expect(en.MK.sakinIsleri(0)).toBe('Rıza the Boatman’s list');
    expect(en.MK.sakinIsleri(2)).toBe('Captain Yakup’s list');
    expect(en.MK.muhurAdi('kalfa')).toBe('Journeyman seal');
    expect(en.MK.muhurTuttu(en.MK.kademe.usta)).toBe('Master seal!');
    expect(en.M.hamleAdet(1)).toBe('1 move');
    expect(en.M.hamleAdet(20)).toBe('20 moves');
    expect(en.MK.kandilSayisi(1)).toBe('1 lamp');
    expect(en.MK.kandilSayisi(7)).toBe('7 lamps');
    expect(en.M.seriMetni(1)).toBe('1 day');
    expect(en.M.sonrakiBasamak('Torch', 2)).toBe('2 days to Torch');
    expect(en.gorevMetni(3, 0)).toBe('Pop 50 red capsules');
    expect(en.M.kazandinBaslik[1]).toBe('Level complete!');
    expect(en.ROZETLER.senlik.ad).toBe('FESTIVAL!');
  });

  it('paylaşım metni, mühür harfi ve Çarşı mahyası', () => {
    const p = paylasim.paylasimMetni({ tarih: 20261014, yildiz: 2, kullanilanHamle: 18, toplamHamle: 22, enBuyuk: 27, reaksiyonlar: [1, 9, 16] });
    expect(p).toBe('FİTİL · Daily Festival Oct 14, 2026\n★★☆  18/22 moves  Biggest: 27\n●▲■');
    expect(ikonlar.muhurIsaretleme('cirak', true)).toContain('>A</text>');
    expect(ikonlar.muhurIsaretleme('kalfa', false)).toContain('>J</text>');
    expect(ikonlar.muhurIsaretleme('usta', true)).toContain('>M</text>');
    for (const hayalet of [false, true]) {
      const s = susler.mahalleSusleri(cizim.bolgeGeo(1), { yapilan: hayalet ? new Set<string>() : new Set(['carsi.mahyaYazisi']), hayalet, yeni: new Set<string>() });
      const svg = (['arka', 0, 1, 2, 3, 4, 'on'] as const).map((k) => s.katman(k)).join('') + s.canli.map((o) => o.ic).join('');
      const harfler = [...svg.matchAll(/>([A-ZÇĞİÖŞÜ])<\/text>/g)].map((m) => m[1]).join('');
      expect(harfler, `hayalet=${hayalet}`).toContain('FIESTA');
      expect(turkceMi(svg)).toBe(false);
    }
  });
});
