/**
 * İngilizce taraması (vitest): sayfa dili İngilizceyken metin tabloları ve
 * katalog verisinde Türkçe kalıntı (Türkçe harf) var mı. Modüller dil
 * belirlendikten SONRA yüklenmeli: bu dosyada yalnız dinamik içe aktarım.
 * Sakinlerin özel adları (Rıza, Nazlı, Hüsnü, Gülizar, Ayşe), bayram adları ve dil seçicisindeki "Türkçe" beyaz listede.
 */
import { beforeAll, describe, expect, it } from 'vitest';

(globalThis as { __FITIL_DIL__?: string }).__FITIL_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇ]/;
/** Çevrilmeyen özel adlar ve kasıtlı Türkçe sözcükler. */
const BEYAZ = [/Türkçe/g, /FİTİL/g, /Rıza/g, /Nazlı/g, /Hüsnü/g, /Gülizar/g, /Ayşe/g, /Hıdırellez/g, /Nevruz/g];

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

let moduller: Record<string, Record<string, unknown>> = {};

beforeAll(async () => {
  moduller = {
    metinler: await import('../ui/metinler'),
    katalog: await import('../app/katalog'),
    bolumler: await import('../levels/index'),
  };
});

describe('İngilizce: metin tablolarında Türkçe kalıntı yok', () => {
  for (const ad of ['metinler', 'katalog', 'bolumler']) {
    it(ad, () => {
      const out: string[] = [];
      for (const [k, v] of Object.entries(moduller[ad])) {
        // Bölüm verisi: yalnız görünen metinler (ad, tanıtım, ipuçları).
        if (ad === 'bolumler' && Array.isArray(v)) {
          for (const b of v as { id: number; ad: string; sonrakiTanitim?: string; ipuclari?: { metin: string }[] }[])
            kalintilar({ ad: b.ad, sonrakiTanitim: b.sonrakiTanitim, ipuclari: b.ipuclari?.map((x) => x.metin) }, `${k}[${b.id}]`, out);
          continue;
        }
        kalintilar(v, k, out);
      }
      expect(out, out.slice(0, 40).join('\n')).toEqual([]);
    });
  }
});
