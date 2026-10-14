/**
 * §3.6 yerçekimi ve doldurma, §3.7 düşen taşlar kendiliğinden patlamaz,
 * §3.8 karıştırma.
 */
import { describe, expect, it } from 'vitest';
import { kilitliMi, rngInt } from '../index';
import type { Icerik } from '../index';
import { fitil, hucreAt, ic, kur, sec, uygula } from './kur';

describe('§3.6 yerçekimi ve doldurma', () => {
  // Yol alt satırda (0..4,5). Sütun 1: kaya (1,1) üstünden; sütun 2: kafesli (2,4);
  // sütun 3: delik (3,4).
  const TAHTA = ['. A . . .', '. K3 . . .', '. Z . G .', '. G . M .', '. M C:Z # .', 'R R R R R'];

  it('§3.6 hareketli içerik sabit hücrelerin "arkasından geçer" (kaya)', () => {
    const { durum } = uygula(kur({ tahta: TAHTA }), fitil('0,5 1,5 2,5 3,5 4,5'));
    // sütun 1: M(4)→5, G(3)→4, Z(2)→3, A(0) kayanın arkasından (1,2)'ye; (1,0) yeni doğar.
    expect(ic(durum, 1, 5)).toMatchObject({ tur: 'kapsul', renk: 4 });
    expect(ic(durum, 1, 4)).toMatchObject({ renk: 3 });
    expect(ic(durum, 1, 3)).toMatchObject({ renk: 2 });
    expect(ic(durum, 1, 2)).toMatchObject({ renk: 1 });
    expect(ic(durum, 1, 1)).toEqual({ tur: 'kaya', kat: 3 });
    expect(ic(durum, 1, 0)).toMatchObject({ tur: 'kapsul', renk: 5, isi: 0, ozel: 'yok' });
  });

  it('§2.4 kafesli kapsül sabittir; üstündekiler onun arkasından geçer', () => {
    const { durum } = uygula(kur({ tahta: TAHTA }), fitil('0,5 1,5 2,5 3,5 4,5'));
    expect(hucreAt(durum, 2, 4)).toMatchObject({ kafes: true, icerik: { tur: 'kapsul', renk: 2, isi: 1 } });
    // (2,3) dolgusu (Gül) kafesin altına, (2,5)'e iner.
    expect(ic(durum, 2, 5)).toMatchObject({ tur: 'kapsul', renk: 5 });
  });

  it('§2.1 yerçekimi deliği atlar', () => {
    const { durum } = uygula(kur({ tahta: TAHTA }), fitil('0,5 1,5 2,5 3,5 4,5'));
    expect(hucreAt(durum, 3, 4)).toMatchObject({ delik: true, icerik: null });
    expect(ic(durum, 3, 5)).toMatchObject({ renk: 4 }); // M (3,3) deliğin üstünden (3,5)'e
    expect(ic(durum, 3, 3)).toMatchObject({ renk: 3 }); // G (3,2) → (3,3)
  });

  it('§3.6 yercekimi olayı: düşenler {den, e}, doğanlar {hucre, icerik, sanalY < 0}', () => {
    const { olaylar } = uygula(kur({ tahta: TAHTA }), fitil('0,5 1,5 2,5 3,5 4,5'));
    const y = sec(olaylar, 'yercekimi');
    expect(y.length).toBeGreaterThanOrEqual(1);
    const dusen = y.flatMap((o) => o.dusenler);
    const dogan = y.flatMap((o) => o.doganlar);
    expect(dusen).toContainEqual({ den: { x: 1, y: 0 }, e: { x: 1, y: 2 } });
    expect(dusen).toContainEqual({ den: { x: 3, y: 3 }, e: { x: 3, y: 5 } });
    for (const d of dusen) expect(d.den).not.toEqual(d.e);
    expect(dogan).toHaveLength(5);
    for (const g of dogan) {
      expect(g.hucre.y).toBe(0);
      expect(g.sanalY).toBeLessThan(0);
      expect(g.icerik).toMatchObject({ tur: 'kapsul', renk: 5, isi: 0, ozel: 'yok' });
    }
  });

  it('§3.6 bir sütunda birden çok doğum: alttaki yuvanın sanalY\'si daha büyük (sıra korunur)', () => {
    // §3.6 belirsiz: "sanalY (−1, −2…)" — doğanlar tahta üstünde sıralarını koruyarak
    // düşer; en alta inecek olan −1'e en yakın diye okundu (kesin değerler sınanmaz).
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', 'R . . . .', 'R . . . .', 'R . . . .'] });
    const { olaylar, durum } = uygula(d, fitil('0,5 0,4 0,3'));
    const dogan = sec(olaylar, 'yercekimi').flatMap((o) => o.doganlar);
    const s = (y: number) => dogan.find((g) => g.hucre.x === 0 && g.hucre.y === y)!.sanalY;
    expect(dogan.filter((g) => g.hucre.x === 0)).toHaveLength(3);
    expect(s(2)).toBeGreaterThan(s(1));
    expect(s(1)).toBeGreaterThan(s(0));
    expect(s(2)).toBeLessThan(0);
    for (let y = 0; y < 6; y++) expect(ic(durum, 0, y)).toMatchObject({ tur: 'kapsul', renk: 5 });
  });

  it.each([
    [[1, 1, 1, 1, 1], 'eşit ağırlık'],
    [[0, 0, 3, 0, 1], 'kümülatif ağırlık'],
  ])('§3.6 / §16.3 dolum renkleri oyun RNG\'sinden: sütunlar soldan sağa, yuvalar aşağıdan yukarı (%s)', (agirlik) => {
    // Yol (0,5)(0,4)(1,5): sütun 0'a 2, sütun 1'e 1 doğum. Çekim sırası: (0,1), (0,0), (1,0).
    // §16.3 "kümülatif toplam": r = rngInt(toplam), ilk r < Σağırlık olan renk diye okundu.
    const d = kur({
      tahta: ['G G G G G', 'G G G G G', 'G G G G G', 'G G G G G', 'R G G G G', 'R R G G G'],
      renkSayisi: 5,
      dogumAgirliklari: agirlik,
    });
    const rng = { rng: d.rng };
    const toplam = agirlik.reduce((a, b) => a + b, 0);
    const cek = () => {
      let r = rngInt(rng, toplam);
      for (let i = 0; i < agirlik.length; i++) {
        r -= agirlik[i];
        if (r < 0) return i;
      }
      return agirlik.length - 1;
    };
    const beklenen = [cek(), cek(), cek()];
    const { durum } = uygula(d, fitil('0,5 0,4 1,5'));
    expect([ic(durum, 0, 1), ic(durum, 0, 0), ic(durum, 1, 0)].map((c) => (c as Extract<Icerik, { tur: 'kapsul' }>).renk)).toEqual(beklenen);
    // yardım 0, fener/is/karıştırma yok → akıştan yalnız 3 çekim tüketildi
    expect(durum.rng).toBe(rng.rng);
  });

  it('§3.6 fener doğumu: tek dolum alan sütunun en üst dolum yuvasına kapsül yerine fener', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . R . .', '. . R . .', '. . R . .'],
      fenerDogum: { kalan: 1, sahadaEnFazla: 1 },
      cikislar: [],
    });
    const { olaylar, durum } = uygula(d, fitil('2,5 2,4 2,3'));
    expect(ic(durum, 2, 0)).toEqual({ tur: 'fener' });
    expect(ic(durum, 2, 1)).toMatchObject({ tur: 'kapsul' });
    expect(durum.fenerDogum).toEqual({ kalan: 0, sahadaEnFazla: 1 });
    const dogan = sec(olaylar, 'yercekimi').flatMap((o) => o.doganlar);
    expect(dogan).toContainEqual(expect.objectContaining({ hucre: { x: 2, y: 0 }, icerik: { tur: 'fener' } }));
  });

  it('§3.6 sahadaki fener sahadaEnFazla\'ya ulaşmışsa fener doğmaz', () => {
    const d = kur({
      tahta: ['F . . . .', '. . . . .', '. . . . .', '. . R . .', '. . R . .', '. . R . .'],
      fenerDogum: { kalan: 1, sahadaEnFazla: 1 },
      cikislar: [],
    });
    const { durum } = uygula(d, fitil('2,5 2,4 2,3'));
    expect(durum.hucreler.filter((c) => c.icerik?.tur === 'fener')).toHaveLength(1);
    expect(durum.fenerDogum?.kalan).toBe(1);
  });

  it('§3.6 hareketli içeriklerin (ıslak, fener, kapsül) sırası korunur', () => {
    const d = kur({ tahta: ['. . . . .', '. W:Z . . .', '. F . . .', '. G2 . . .', '. . . . .', 'R R R . .'], cikislar: [] });
    const { durum } = uygula(d, fitil('0,5 1,5 2,5'));
    // sütun 1: (1,4) Gül → 5, G2 → 4, F → 3, W → 2
    expect(ic(durum, 1, 4)).toMatchObject({ renk: 3, isi: 2 });
    expect(ic(durum, 1, 3)).toEqual({ tur: 'fener' });
    expect(ic(durum, 1, 2)).toEqual({ tur: 'islak', renk: 2 });
  });

  it('§3.5.4 hamle sonunda delik olmayan her yuva doludur', () => {
    const { durum } = uygula(kur({ tahta: TAHTA }), fitil('0,5 1,5 2,5 3,5 4,5'));
    expect(durum.hucreler.every((c) => c.delik || c.icerik !== null)).toBe(true);
  });
});

describe('§3.7 kaskad', () => {
  it('§3.7 düşen taşlar kendiliğinden patlamaz: yeni oluşan aynı renk üçlü ve kızgın taş yerinde kalır', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', 'R R R . .', '. G2 . . .', 'R R R . .'] });
    const { olaylar, durum } = uygula(d, fitil('0,5 1,5 2,5'));
    expect(sec(olaylar, 'patlama')).toHaveLength(3);
    const yt = sec(olaylar, 'yercekimi')[0].t;
    for (const p of sec(olaylar, 'patlama')) expect(p.t).toBeLessThanOrEqual(yt);
    // üstteki R üçlüsü bir sıra iner, kızgın G (ısı 3) en alta
    expect([ic(durum, 0, 4), ic(durum, 1, 4), ic(durum, 2, 4)]).toMatchObject([{ renk: 0 }, { renk: 0 }, { renk: 0 }]);
    expect(ic(durum, 1, 5)).toMatchObject({ renk: 3, isi: 3 });
  });
});

describe('§3.8 karıştırma', () => {
  // dortKomsu (U3) altında yol ZZZ patlayınca kalan tahta 4-komşulukla kilitli olur
  // (bkz. hesap: yeni Mor kapsüller (0,0), (1,1), (2,0) birbirine dik komşu değil).
  const KILIT = ['R # G W:Z #', 'G A R F #', 'Z Z Z K3 #', '# # # # #', '# # # # #', '# # # # #'];
  const kurKilit = (hedefler?: Parameters<typeof kur>[0]['hedefler']) =>
    kur({ tahta: KILIT, renkSayisi: 5, dolum: 4, kurallar: { dortKomsu: true }, cikislar: [], hedefler });

  it('§3.8 hamle sonunda kilitli tahta karıştırılır; sonuç kilitsiz ve hamle harcanmaz', () => {
    const d = kurKilit();
    const { olaylar, durum } = uygula(d, fitil('0,2 1,2 2,2'));
    expect(sec(olaylar, 'karistirma')).toHaveLength(1);
    expect(kilitliMi(durum)).toBe(false);
    expect(durum.kalanHamle).toBe(d.kalanHamle - 1);
  });

  it('§3.8 fener ve ıslak yerinde kalır; kapsüller ısı ve özellikleriyle taşınır', () => {
    const d = kurKilit();
    const { olaylar, durum } = uygula(d, fitil('0,2 1,2 2,2'));
    expect(ic(durum, 3, 0)).toEqual({ tur: 'islak', renk: 2 });
    expect(ic(durum, 3, 1)).toEqual({ tur: 'fener' });
    const k = sec(olaylar, 'karistirma')[0];
    for (const e of k.esleme) {
      for (const p of [e.den, e.e]) expect(hucreAt(durum, p.x, p.y).icerik?.tur).toBe('kapsul');
    }
    // ısılar taşınır, yeniden renklendirmede de korunur: G, A, R yoldan +1 almıştı.
    const isi = durum.hucreler.reduce((s, c) => s + (c.icerik?.tur === 'kapsul' ? c.icerik.isi : 0), 0);
    expect(isi).toBe(3);
  });

  it('§3.5.4.7 bölüm bittiyse kilitlenme karıştırması yapılmaz', () => {
    const d = kurKilit([{ tur: 'topla', renk: 2, adet: 3 }]);
    const { olaylar, durum } = uygula(d, fitil('0,2 1,2 2,2'));
    expect(durum.bitti).toBe('kazanc');
    expect(sec(olaylar, 'karistirma')).toEqual([]);
  });

  it('§3.8 karıştırma belirlenimlidir (aynı girdi → aynı eşleme)', () => {
    const a = uygula(kurKilit(), fitil('0,2 1,2 2,2'));
    const b = uygula(kurKilit(), fitil('0,2 1,2 2,2'));
    expect(sec(a.olaylar, 'karistirma')).toEqual(sec(b.olaylar, 'karistirma'));
  });
});
