/**
 * §3.2–§3.4 şartname testleri: zincirlenebilirlik, yol doğrulama, kilit.
 * `yolDogrula` ve `kilitliMi` P0 başvuru uygulamasıdır; bu testler şimdiden
 * yeşil olmalı. Tek istisna §3.4 `yalnizHalka` döngü araması (P0 notu:
 * "döngü araması P1'de") — o iki test P1 gelene kadar kırmızıdır.
 */
import { describe, expect, it } from 'vitest';
import { kilitliMi, yolDogrula } from '../index';
import type { Kurallar, OyunDurumu } from '../index';
import { kur, tahtaYaz, yol } from './kur';

// Koordinatlar: x soldan, y yukarıdan (§2.1).
const YOL_TAHTASI = [
  'R R R * *', //   y0
  'R R * G R', //   y1
  'R * R C:R R', // y2
  'F K1 _ # W:R', // y3
  'G A G A G', //   y4
  'A G A G A', //   y5
];

const tahta = (kurallar?: Kurallar): OyunDurumu => kur({ tahta: YOL_TAHTASI, kurallar });

describe('§3.3 yol doğrulama (yolDogrula)', () => {
  it('§3.3 düz 3 düğümlü aynı renk yol geçerlidir', () => {
    expect(yolDogrula(tahta(), yol('0,0 1,0 2,0'), false)).toBeNull();
  });

  it('§3.3 8-komşuluk: çapraz adımlar geçerlidir (§2.1)', () => {
    expect(yolDogrula(tahta(), yol('0,0 1,1 2,2'), false)).toBeNull();
  });

  it('§3.3.6 kesişen çapraz segmentler serbesttir', () => {
    expect(yolDogrula(tahta(), yol('0,0 1,1 1,0 0,1'), false)).toBeNull();
  });

  it("§3.3 komşu olmayan adım → 'komsu'", () => {
    expect(yolDogrula(tahta(), yol('0,0 2,0 1,1'), false)).toBe('komsu');
  });

  it("§3.3.2 aynı hücre iki kez → 'tekrar'", () => {
    expect(yolDogrula(tahta(), yol('0,0 1,0 0,0'), false)).toBe('tekrar');
    expect(yolDogrula(tahta(), yol('0,0 1,0 1,1 0,0'), false)).toBe('tekrar');
  });

  it("§3.3.2 zincir rengine uymayan kapsül → 'renk'", () => {
    expect(yolDogrula(tahta(), yol('1,0 2,0 3,1'), false)).toBe('renk');
  });

  it('§3.2 joker: yıldız topu her renge katılır (başta, ortada)', () => {
    const d = tahta();
    expect(yolDogrula(d, yol('1,1 2,1 2,2'), false)).toBeNull();
    expect(yolDogrula(d, yol('2,1 2,2 1,1'), false)).toBeNull();
  });

  it("§3.3.1 zincir rengi ilk joker olmayan kapsülün rengidir: * R G → 'renk', G * R → 'renk'", () => {
    const d = tahta();
    expect(yolDogrula(d, yol('2,1 2,2 3,1'), false)).toBe('renk');
    expect(yolDogrula(d, yol('3,1 2,1 1,1'), false)).toBe('renk');
  });

  it('§3.3.1 tamamı joker yol geçerlidir', () => {
    expect(yolDogrula(tahta(), yol('4,0 3,0 2,1'), false)).toBeNull();
  });

  it("§3.3.5 |P| < 3 → 'kisa'", () => {
    const d = tahta();
    expect(yolDogrula(d, [], false)).toBe('kisa');
    expect(yolDogrula(d, yol('0,0'), false)).toBe('kisa');
    expect(yolDogrula(d, yol('0,0 1,0'), false)).toBe('kisa');
  });

  it.each([
    ['kafesli kapsül', '3,2'],
    ['kaya', '1,3'],
    ['boş hücre', '2,3'],
    ['delik', '3,3'],
  ])('§3.2 %s zincire katılamaz', (_ad, son) => {
    expect(yolDogrula(tahta(), yol(`1,1 2,2 ${son}`), false)).not.toBeNull();
  });

  it('§3.2 fener ve ıslak barut zincire katılamaz', () => {
    const d = tahta();
    expect(yolDogrula(d, yol('1,1 0,2 0,3'), false)).not.toBeNull();
    expect(yolDogrula(d, yol('4,1 4,2 4,3'), false)).not.toBeNull();
  });

  it('§2.1 tahta dışındaki konum geçersizdir', () => {
    expect(yolDogrula(tahta(), yol('1,0 0,0 -1,0'), false)).not.toBeNull();
  });

  it('§3.3.4 halka: |P| = 4, son düğüm ilke 8-komşu → geçerli (2×2 kare)', () => {
    expect(yolDogrula(tahta(), yol('0,0 1,0 1,1 0,1'), true)).toBeNull();
  });

  it('§3.3.4 halka: çapraz kapanış da 8-komşudur (eşkenar dörtgen, jokerli)', () => {
    expect(yolDogrula(tahta(), yol('1,0 2,1 1,2 0,1'), true)).toBeNull();
  });

  it('§3.3.4 halka |P| ≥ 4 ister: 3 düğümlü üçgen halka geçersiz', () => {
    expect(yolDogrula(tahta(), yol('0,0 1,0 1,1'), true)).not.toBeNull();
  });

  it('§3.3.4 halka: son düğüm ilke komşu değilse geçersiz (aynı yol halkasız geçerli)', () => {
    const d = tahta();
    expect(yolDogrula(d, yol('0,0 1,0 2,0 3,0'), true)).not.toBeNull();
    expect(yolDogrula(d, yol('0,0 1,0 2,0 3,0'), false)).toBeNull();
  });

  it("§3.3.5 yalnizHalka (U2): halka olmayan yol → 'halkaGerekli', halka geçerli", () => {
    const d = tahta({ yalnizHalka: true });
    expect(yolDogrula(d, yol('0,0 1,0 2,0'), false)).toBe('halkaGerekli');
    expect(yolDogrula(d, yol('0,0 1,0 1,1 0,1'), true)).toBeNull();
  });

  it("§3.3.7 caprazSiniri = 1: iki çapraz adım → 'capraz', bir çapraz geçerli", () => {
    const d = tahta({ caprazSiniri: 1 });
    expect(yolDogrula(d, yol('0,0 1,1 2,2'), false)).toBe('capraz');
    expect(yolDogrula(d, yol('0,0 1,0 2,1'), false)).toBeNull();
  });

  it("§3.3.7 caprazSiniri = 0: tek çapraz adım bile → 'capraz'; null sınırsız", () => {
    expect(yolDogrula(tahta({ caprazSiniri: 0 }), yol('0,0 1,0 2,1'), false)).toBe('capraz');
    expect(yolDogrula(tahta({ caprazSiniri: null }), yol('0,0 1,1 2,2'), false)).toBeNull();
  });

  it("§10.2 U3 dortKomsu: çapraz adım → 'komsu', dik yol ve dik kapanışlı halka geçerli", () => {
    const d = tahta({ dortKomsu: true });
    expect(yolDogrula(d, yol('0,0 1,1 2,2'), false)).toBe('komsu');
    expect(yolDogrula(d, yol('0,0 1,0 2,0'), false)).toBeNull();
    expect(yolDogrula(d, yol('0,0 1,0 1,1 0,1'), true)).toBeNull();
    expect(yolDogrula(d, yol('1,0 2,1 1,2 0,1'), true)).not.toBeNull();
  });
});

// ── §3.4 kilitlenme ─────────────────────────────────────────────────────

const HARF = ['R', 'A', 'Z', 'G', 'M', 'P'];
/**
 * Renk = (x + 3y) mod 6: yatay fark 1, dikey 3, çaprazlar 2 ve 4 → hiçbir
 * 8-komşu aynı renk değil, bütün bileşenler 1'lik → kilitli (§3.4).
 */
const KILITLI = Array.from({ length: 6 }, (_, y) => Array.from({ length: 5 }, (_, x) => HARF[(x + 3 * y) % 6]));

function kilitTahtasi(degisiklik: Record<string, string>, kurallar?: Kurallar): OyunDurumu {
  const satirlar = KILITLI.map((r, y) => r.map((s, x) => degisiklik[`${x},${y}`] ?? s).join(' '));
  // Kilitli başlangıç tahtasını yükleyici yeniden renklendirebilir (§8.1 adım 4);
  // kur() içerik katmanını çizimden geri yazar.
  const d = kur({ tahta: KILITLI.map((r) => r.join(' ')), kurallar });
  tahtaYaz(d, satirlar);
  return d;
}

describe('§3.4 kilitlenme algılama (kilitliMi)', () => {
  it('§3.4 hiçbir renkte ≥3 bileşen ve özel taş yoksa kilitli', () => {
    expect(kilitliMi(kilitTahtasi({}))).toBe(true);
  });

  it('§3.4 2 düğümlü bileşen yetmez (kilitli kalır)', () => {
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R' }))).toBe(true);
  });

  it('§3.4 8-komşulukla bağlı ≥3 aynı renk bileşen → kilitli değil', () => {
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '2,0': 'R' }))).toBe(false);
    // çapraz zincir (0,0)-(1,1)-(2,2)
    expect(kilitliMi(kilitTahtasi({ '1,1': 'R', '2,2': 'R' }))).toBe(false);
  });

  it('§3.4 tahtada özel taş varsa her zaman kilitsiz (çift dokunuş geçerli hamle)', () => {
    expect(kilitliMi(kilitTahtasi({ '2,2': 'Z-' }))).toBe(false);
    expect(kilitliMi(kilitTahtasi({ '2,2': 'Z@' }))).toBe(false);
    expect(kilitliMi(kilitTahtasi({ '2,2': '*' }))).toBe(false);
  });

  it('§3.2 kafesli ve ıslak kapsül bileşene katılmaz', () => {
    expect(kilitliMi(kilitTahtasi({ '1,0': 'C:R', '2,0': 'R' }))).toBe(true);
    expect(kilitliMi(kilitTahtasi({ '1,0': 'W:R', '2,0': 'R' }))).toBe(true);
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '2,0': 'R' }))).toBe(false);
  });

  it('§3.4 dortKomsu: yalnız dik bağlantı sayılır (çapraz üçlü kilitli)', () => {
    const capraz = { '1,1': 'R', '2,2': 'R' };
    expect(kilitliMi(kilitTahtasi(capraz))).toBe(false);
    expect(kilitliMi(kilitTahtasi(capraz, { dortKomsu: true }))).toBe(true);
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '2,0': 'R' }, { dortKomsu: true }))).toBe(false);
  });

  it('§3.4 yalnizHalka: 4\'lü döngü (2×2 kare) varsa kilitsiz', () => {
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '0,1': 'R', '1,1': 'R' }, { yalnizHalka: true }))).toBe(false);
  });

  it('§3.4 yalnizHalka: döngüsüz ≥3 bileşen kilitlidir (P1: döngü araması)', () => {
    // (0,0)-(1,0)-(2,0)-(3,1) bir yol; döngü yok → halka çizilemez.
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '2,0': 'R' }, { yalnizHalka: true }))).toBe(true);
  });

  it('§3.4 yalnizHalka: üçgen (3\'lü döngü) halka sayılmaz, |P| ≥ 4 gerekir (P1)', () => {
    // {(0,0),(1,0),(0,1)} üçgen + (0,2) uç; 4 düğümlü kapalı yol yok.
    expect(kilitliMi(kilitTahtasi({ '1,0': 'R', '0,1': 'R' }, { yalnizHalka: true }))).toBe(true);
  });
});
