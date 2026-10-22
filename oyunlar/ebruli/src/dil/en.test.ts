/**
 * İngilizce taraması (vitest): sayfa dili İngilizceyken metin tabloları,
 * katalog, bölüm metinleri ve metin üreten işlevlerde Türkçe kalıntı
 * (Türkçe harf) var mı. Modüller dil belirlendikten SONRA yüklenmeli:
 * bu dosyada yalnız dinamik içe aktarım. Yer adları (Üsküdar) ve dil
 * seçicisindeki "Türkçe" beyaz listede.
 */
import { beforeAll, describe, expect, it } from 'vitest';

(globalThis as { __EBRULI_DIL__?: string }).__EBRULI_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
const BEYAZ = [/Türkçe/g, /Üsküdar/g];

function kalintilar(deger: unknown, yol: string, out: string[], gorulen = new Set<unknown>()): void {
  if (typeof deger === 'string') {
    let x = deger;
    for (const b of BEYAZ) x = x.replace(b, '');
    if (TR_HARF.test(x)) out.push(`${yol}: ${deger}`);
    return;
  }
  if (!deger || typeof deger !== 'object' || gorulen.has(deger)) return;
  gorulen.add(deger);
  for (const [k, v] of Object.entries(deger as Record<string, unknown>)) kalintilar(v, `${yol}.${k}`, out, gorulen);
}

type Mod = Record<string, unknown>;
let metinler: Mod;
let katalog: Mod;
let bolumler: Mod;
let cizici: Mod;

beforeAll(async () => {
  metinler = await import('../ui/metinler');
  katalog = await import('../app/katalog');
  bolumler = await import('../levels/index');
  cizici = await import('../render/oyunCizici');
});

describe('İngilizce: Türkçe kalıntı yok', () => {
  it('arayüz metinleri ve metin işlevleri', () => {
    const out: string[] = [];
    kalintilar(metinler, 'metinler', out);
    const m = metinler as {
      M: { hamleKaldi: (n: number) => string };
      hataMetni: (h: string) => string | null;
      eksikMetni: (e: { tur: string; renk?: number; kalan: number }[]) => string;
      bolumEtiketi: (n: number) => string;
      yildizEtiketi: (n: number) => string;
      sayi: (n: number) => string;
    };
    const ornek = [
      m.M.hamleKaldi(1),
      m.M.hamleKaldi(5),
      ...['ayniRenk', 'ortakBilesen', 'karisikKarisik', 'murekkepKapali', 'yag'].map((h) => m.hataMetni(h) ?? ''),
      m.eksikMetni([{ tur: 'topla', renk: 6, kalan: 3 }, { tur: 'kagit', kalan: 1 }, { tur: 'desen', kalan: 2 }]),
      m.bolumEtiketi(4),
      m.yildizEtiketi(1),
    ];
    kalintilar(ornek, 'islevler', out);
    expect(out, out.join('\n')).toEqual([]);
    expect(m.eksikMetni([{ tur: 'topla', renk: 6, kalan: 3 }, { tur: 'kagit', kalan: 1 }])).toBe('3 Green and 1 paper still needed');
    expect(m.sayi(12450)).toBe('12,450');
    expect(m.bolumEtiketi(4)).toBe('Level 4');
  });

  it('katalog ve tuval yazıları', () => {
    const out: string[] = [];
    const k = katalog as { RENK_TANIMLARI: Record<string, { ad: string }>; OZEL_TANIMLARI: Record<string, { ad: string; aciklama: string }>; ATOLYELER: { ad: string; altBaslik: string }[]; TEKNIKLER?: { ad: string; aciklama: string }[]; NADIRLIK: readonly string[] };
    kalintilar(Object.values(k.RENK_TANIMLARI).map((r) => r.ad), 'renk', out);
    kalintilar(Object.values(k.OZEL_TANIMLARI).map((o) => [o.ad, o.aciklama]), 'ozel', out);
    kalintilar(k.ATOLYELER.map((a) => [a.ad, a.altBaslik]), 'atolye', out);
    kalintilar(k.NADIRLIK, 'nadirlik', out);
    kalintilar(k.TEKNIKLER?.map((x) => [x.ad, x.aciklama]), 'teknik', out);
    kalintilar((cizici as { KADEME_METNI: unknown }).KADEME_METNI, 'kademe', out);
    kalintilar((cizici as { KOMBO_ADLARI: unknown }).KOMBO_ADLARI, 'kombo', out);
    expect(out, out.join('\n')).toEqual([]);
  });

  it('bölüm metinleri (ad, tanıtım, ipuçları) hepsi çevrili', () => {
    const out: string[] = [];
    for (const b of (bolumler as { BOLUMLER: { id: number; ad: string; sonrakiTanitim?: string; ipuclari?: { metin: string }[] }[] }).BOLUMLER)
      kalintilar({ ad: b.ad, sonrakiTanitim: b.sonrakiTanitim, ipuclari: b.ipuclari?.map((x) => x.metin) }, `bolum ${b.id}`, out);
    expect(out, out.join('\n')).toEqual([]);
  });
});
