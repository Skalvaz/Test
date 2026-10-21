/**
 * İngilizce: mühür metinleri, bölüm metinleri (metin.en.json) ve üretilen
 * bölüm adları. Modüller dil belirlendikten SONRA yüklenmeli: bu dosyada
 * yalnız dinamik içe aktarım.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { BolumVerisi, MuhurKosulu, MuhurOlcusu } from '../core/types';

(globalThis as { __FITIL_DIL__?: string }).__FITIL_DIL__ = 'en';

const TR_HARF = /[ğüşıöçĞÜŞİÖÇâÂ]/;
/** Çevrilmeyen özel adlar. */
const BEYAZ = [/FİTİL/g, /Rıza/g, /Nazlı/g, /Hüsnü/g, /Gülizar/g, /Ayşe/g];
const turkceVar = (s: string): boolean => TR_HARF.test(BEYAZ.reduce((x, b) => x.replace(b, ''), s));

type Muhur = typeof import('../meta/muhur');
let M: Muhur;
let TUM: readonly BolumVerisi[];
let uretilenBolumAdi: (tur: 'gunluk' | 'sonsuz', id: number) => string;
/** Türkçe veri (çeviri uygulanmamış), kimliğe göre. */
const TR = new Map<number, BolumVerisi>();

beforeAll(async () => {
  M = await import('../meta/muhur');
  TUM = (await import('../levels/index')).TUM_BOLUMLER;
  uretilenBolumAdi = (await import('../levels/uretici')).uretilenBolumAdi;
  const veri = import.meta.glob<BolumVerisi>('../levels/veri/*.json', { eager: true, import: 'default' });
  for (const v of Object.values(veri)) TR.set(v.id, v);
});

describe('İngilizce mühür metinleri', () => {
  it('bütün bölümlerin bütün mühürleri: ≤ 29 karakter, Türkçe harf yok, bölüm içinde tekil', () => {
    const hatalar: string[] = [];
    let sayi = 0;
    for (const v of TUM) {
      if (!v.muhurler) continue;
      const metinler = v.muhurler.map((k) => M.muhurMetni(k));
      for (const m of metinler) {
        sayi++;
        // Kesin sınır 34; İngilizce sözcükler geniş düştüğünden 360 px ekranda Duraklat
        // satırına (≈ 186 px) sığsın diye gerçek mühürler 29 karakterde (en geniş ≈ 188 px).
        if (m.length > Math.min(29, M.MUHUR_METIN_SINIRI)) hatalar.push(`${v.id}: ${m.length} karakter "${m}"`);
        if (turkceVar(m)) hatalar.push(`${v.id}: Türkçe "${m}"`);
        if (!/^[A-Z0-9]/.test(m) || /undefined|NaN|\s{2}/.test(m)) hatalar.push(`${v.id}: biçim "${m}"`);
      }
      if (new Set(metinler).size !== metinler.length) hatalar.push(`${v.id}: aynı metin iki kez ${JSON.stringify(metinler)}`);
    }
    expect(sayi).toBe(105);
    expect(hatalar, hatalar.join('\n')).toEqual([]);
  });

  it('elle verilen Türkçe `metin` İngilizcede kullanılmaz', () => {
    expect(M.muhurMetni({ olcu: 'zincir', kapsam: 'hamle', enAz: 8, halka: true, metin: 'Büyük halka' })).toBe('Close a loop of 8+');
  });

  it('örnek biçimler', () => {
    const ornek: [MuhurKosulu, string][] = [
      [{ olcu: 'R', kapsam: 'hamle', enAz: 15, halka: true }, '15+ reaction with a loop'],
      [{ olcu: 'R', kapsam: 'hamle', enAz: 27 }, '27+ reaction in one move'],
      [{ olcu: 'R', kapsam: 'hamle', enAz: 21, eylem: 'koruk' }, '21+ reaction with Bellows'],
      [{ olcu: 'koruk', kapsam: 'oyun', enCok: 0 }, 'Win without the Bellows'],
      [{ olcu: 'koruk', kapsam: 'oyun', enAz: 2 }, 'Use the Bellows twice'],
      [{ olcu: 'kalanHamle', kapsam: 'son', enAz: 6 }, 'Win with 6+ moves left'],
      [{ olcu: 'nesil', kapsam: 'hamle', enAz: 8 }, 'Make an 8th-generation blast'],
      [{ olcu: 'nesil', kapsam: 'hamle', enAz: 2 }, 'Make a 2nd-generation blast'],
      [{ olcu: 'devFisek', kapsam: 'hamle', enAz: 2 }, '2 giant fireworks at once'],
      [{ olcu: 'devFisek', kapsam: 'oyun', enAz: 3 }, 'Fire 3 giant fireworks'],
      [{ olcu: 'kafes', kapsam: 'hamle', enAz: 4 }, 'Break 4 cages at once'],
      [{ olcu: 'kafes', kapsam: 'oyun', enAz: 1 }, 'Break 1 cage'],
      [{ olcu: 'olusum', kapsam: 'oyun', enAz: 1, ozel: 'kasimpati' }, 'Make a chrysanthemum'],
      [{ olcu: 'ozelAtes', kapsam: 'oyun', enAz: 4 }, 'Fire 4 special pieces'],
      [{ olcu: 'zincir', kapsam: 'hamle', enAz: 9, renk: 1 }, 'Draw an amber chain of 9+'],
      [{ olcu: 'patlama', kapsam: 'hamle', enAz: 6, renk: 4 }, 'Pop 6 purple at once'],
      [{ olcu: 'kombo', kapsam: 'oyun', enAz: 1, kombo: 'devKasimpati' }, 'Make a Giant Chrysanthemum combo'],
      [{ olcu: 'caprazEngel', kapsam: 'oyun', enAz: 1 }, 'Hit an obstacle diagonally'],
      [{ olcu: 'kisaZincir', kapsam: 'oyun', enCok: 0 }, 'Win with no chains of just 3'],
    ];
    for (const [k, beklenen] of ornek) expect(M.muhurMetni(k)).toBe(beklenen);
  });

  it('bütün ölçü × kapsam × süzgeç birleşimleri (eşik 1–40): ≤ 34, Türkçe yok', () => {
    const hatalar: string[] = [];
    const sayilar = [1, 2, 3, 8, 11, 18, 24, 40];
    const suzgecler: Partial<MuhurKosulu>[] = [
      {},
      ...[0, 1, 2, 3, 4, 5].map((renk) => ({ renk }) as Partial<MuhurKosulu>),
      ...(['roket', 'kasimpati', 'yildiz'] as const).map((ozel) => ({ ozel })),
      ...Object.keys(M.KOMBO_ADLARI).map((kombo) => ({ kombo }) as Partial<MuhurKosulu>),
      { halka: true },
      { halka: false },
      ...(['fitil', 'ciftDokunus', 'koruk'] as const).map((eylem) => ({ eylem })),
    ];
    let sayi = 0;
    for (const [olcu, kapsamlar] of Object.entries(M.OLCU_KAPSAMLARI) as [MuhurOlcusu, readonly MuhurKosulu['kapsam'][]][])
      for (const kapsam of kapsamlar)
        for (const s of suzgecler)
          for (const n of sayilar)
            for (const sinir of ['enAz', 'enCok'] as const) {
              const k = { olcu, kapsam, ...s, [sinir]: sinir === 'enCok' ? n - 1 : n } as MuhurKosulu;
              if (M.muhurKosuluDogrula(k).length) continue; // Türkçe doğrulayıcıdan geçmeyen koşul veri olamaz
              sayi++;
              const m = M.muhurMetni(k);
              if (m.length > M.MUHUR_METIN_SINIRI) hatalar.push(`${m.length} "${m}" ${JSON.stringify(k)}`);
              if (turkceVar(m) || /undefined|NaN/.test(m)) hatalar.push(`"${m}" ${JSON.stringify(k)}`);
            }
    expect(sayi).toBeGreaterThan(300);
    expect([...new Set(hatalar)].slice(0, 30), hatalar.join('\n')).toEqual([]);
  });

  it('kademe ve kombinasyon adları İngilizce', () => {
    expect(Object.values(M.MUHUR_KADEME_ADLARI)).toEqual(['Apprentice', 'Journeyman', 'Master']);
    for (const ad of Object.values(M.KOMBO_ADLARI)) expect(turkceVar(ad), ad).toBe(false);
  });
});

/** İki dilde aynı yazılan adlar. */
const IKI_DILDE_AYNI = new Set(['Domino']);

describe('İngilizce bölüm metinleri (metin.en.json)', () => {
  it('her bölümün adı, tanıtımı ve bütün ipuçları çevrilmiş', () => {
    const hatalar: string[] = [];
    expect(TUM.length).toBe(48);
    for (const v of TUM) {
      const tr = TR.get(v.id)!;
      const kontrol = (ne: string, en: string | undefined, trm: string | undefined) => {
        if (trm === undefined) return;
        if (!en || (en === trm && !IKI_DILDE_AYNI.has(trm))) hatalar.push(`${v.id} ${ne}: çevrilmemiş "${trm}"`);
        else if (turkceVar(en)) hatalar.push(`${v.id} ${ne}: Türkçe "${en}"`);
        // Yerleşim payı: Türkçeden en çok %25 + 6 karakter uzun.
        else if (en.length > trm.length * 1.25 + 6) hatalar.push(`${v.id} ${ne}: uzun (${en.length} > ${trm.length}) "${en}"`);
      };
      kontrol('ad', v.ad, tr.ad);
      kontrol('tanıtım', v.sonrakiTanitim, tr.sonrakiTanitim);
      if (v.sonrakiTanitim && !v.sonrakiTanitim.startsWith('Next: ')) hatalar.push(`${v.id}: tanıtım biçimi "${v.sonrakiTanitim}"`);
      expect(v.ipuclari?.length ?? 0).toBe(tr.ipuclari?.length ?? 0);
      tr.ipuclari?.forEach((x, i) => {
        kontrol(`ipucu ${i}`, v.ipuclari![i].metin, x.metin);
        // Tetik, el ve diğer alanlar aynen kalır.
        expect({ ...v.ipuclari![i], metin: '' }).toEqual({ ...x, metin: '' });
      });
    }
    expect(hatalar, hatalar.join('\n')).toEqual([]);
  });

  it('tanıtım bir sonraki bölümün adını söylüyorsa İngilizcede de aynı adı söyler', () => {
    const ad = new Map(TUM.map((v) => [v.id, v.ad]));
    for (const v of TUM) {
      const tr = TR.get(v.id)!;
      const sonraki = TR.get(v.id + 1);
      if (!tr.sonrakiTanitim || !sonraki || tr.sonrakiTanitim !== `Sıradaki: ${sonraki.ad}!`) continue;
      expect(v.sonrakiTanitim).toBe(`Next: ${ad.get(v.id + 1)}!`);
    }
  });

  it('JSON yalnız var olan bölümleri ve alanları içerir', async () => {
    const en = (await import('../levels/metin.en.json')).default as Record<string, Record<string, unknown>>;
    for (const [id, e] of Object.entries(en)) {
      expect(TR.has(Number(id)), id).toBe(true);
      for (const alan of Object.keys(e)) expect(['ad', 'sonrakiTanitim', 'ipuclari']).toContain(alan);
      if (e.ipuclari) expect((e.ipuclari as string[]).length, id).toBe(TR.get(Number(id))!.ipuclari?.length);
    }
  });
});

describe('İngilizce üretilen bölüm adları', () => {
  it('Daily Festival, Endless Festival n', () => {
    expect(uretilenBolumAdi('gunluk', 20261014)).toBe('Daily Festival');
    expect(uretilenBolumAdi('sonsuz', 1_000_012)).toBe('Endless Festival 12');
  });
});
