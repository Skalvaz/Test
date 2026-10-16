/**
 * Mühür değerlendirme motoru gerçek oyunlarla (docs/KANCALAR.md §A.3–§A.4,
 * §A.7): eylem izleri (`HamleIzi`) çekirdeğin durum ve istatistik
 * farklarından BAĞIMSIZ hesaplanan değerlerle karşılaştırılır; koşul dilinin
 * her ölçü × kapsam çifti bu bağımsız değerlerden yeniden toplanır. Hedefli
 * tahtalar atıf kurallarını (çapraz roket, barut izi dev fişeği, kombinasyon)
 * sınar. Ölçüm aracının bant, öneri ve kısıtlı bot mantığı da burada.
 */
import { describe, expect, it } from 'vitest';
import { bolumuYukle, finalGosterisi, hamleUygula, rngInt, ustaEliUygula } from '../core/index';
import type { BolumVerisi, Hamle, Hucre, MuhurKosulu, MuhurOlcusu, Olay, OyunDurumu, OzelTur } from '../core/index';
import { fitil, kur, rastgeleBolum, rastgeleHamle } from '../core/testAraclari';
import { bolumGetir } from '../levels/index';
import { muhurAnlik, muhurDegeri, muhurleriDegerlendir, muhurOzeti, OLCU_KAPSAMLARI } from '../meta/muhur';
import { ozetBaslat, ozetFinal, ozetHamle, olaylardanOzet, type HamleIzi, type OyunOzeti } from '../meta/ozet';
import {
  adayKatalogu,
  bantDurumu,
  CIRAK_YEDEK_BANDI,
  esikOnerisi,
  kosulKisiti,
  kosulTutar,
  MUHUR_BANTLARI,
  muhurluOyun,
  muhurOlc,
  oyunDegerleri,
  type DegerliOyun,
} from './muhurOlcum';
import { oyunOyna } from './simulasyon';

// ───────────────────── bağımsız eylem kaydı (durum farkından) ─────────────────────

const OZELLER = ['roket', 'kasimpati', 'yildiz'] as const;

function say(d: OyunDurumu, f: (h: Hucre) => number): number {
  let n = 0;
  for (const h of d.hucreler) if (!h.delik) n += f(h);
  return n;
}

function ozelSay(d: OyunDurumu, tur: OzelTur): number {
  return say(d, (h) => (h.icerik?.tur === 'kapsul' && h.icerik.ozel === tur ? 1 : 0));
}

/** Bir eylemin çekirdek DURUM ve İSTATİSTİK farkından ölçüleri (ozet.ts'ten bağımsız). */
interface Bagimsiz {
  eylem: Hamle['tur'];
  zincir: number;
  halka: boolean;
  R: number;
  nesil: number;
  patlama: number;
  isiPatlamasi: number;
  olusan: OzelTur;
  /** Patlayan özel taş (tür başına); kombinasyonla yeniden boyanan taş varsa doğrulanamaz (null). */
  ozel: Record<(typeof OZELLER)[number], number> | null;
  kombo: number;
  kafes: number;
  kaya: number;
  engelHasar: number;
  doseme: number;
  desen: number;
  is: number;
  fener: number;
  devFisek: number;
  kurutma: number;
  /** Dev fişek dolumu (çapraz engel üst sınırı için; olaydan). */
  devDoldu: number;
}

function bagimsiz(d: OyunDurumu, h: Hamle, olaylar: readonly Olay[], s: OyunDurumu): Bagimsiz {
  const ist = <K extends 'toplamPatlama' | 'isiPatlamasi' | 'kafesKirilan' | 'kayaKirilan' | 'fenerToplanan' | 'devFisekAtesi' | 'kombinasyon' | 'roket' | 'kasimpati' | 'yildiz'>(k: K): number =>
    s.istatistik[k] - d.istatistik[k];
  const tur = <T extends Olay['tur']>(t: T) => olaylar.filter((o): o is Extract<Olay, { tur: T }> => o.tur === t);
  const reak = tur('reaksiyon');
  expect(reak).toHaveLength(1);
  const patlamalar = tur('patlama');
  // Çekirdek değişmezi: R = fitil düğümü olmayan patlama.
  expect(reak[0].boyut).toBe(patlamalar.filter((p) => p.neden !== 'fitil').length);
  const olusanlar = OZELLER.filter((t) => ist(t) > 0);
  expect(olusanlar.reduce((n, t) => n + ist(t), 0)).toBeLessThanOrEqual(1);
  const kat = (x: OyunDurumu): number => say(x, (c) => (c.icerik?.tur === 'kaya' || c.icerik?.tur === 'kova' ? c.icerik.kat : 0));
  const icerikSay = (x: OyunDurumu, t: string): number => say(x, (c) => (c.icerik?.tur === t ? 1 : 0));
  // Patlayan özel taş: önce + oluşan − sonra (roket yağmuru/bahçe var olan özel taşı yeniden boyayabilir).
  const yeniden = tur('kombinasyon').some((k) => k.kombo === 'roketYagmuru' || k.kombo === 'bahce');
  const olusanSay = (t: OzelTur): number => tur('ozelOlustu').filter((o) => o.ozel === t).length;
  return {
    eylem: h.tur,
    zincir: h.tur === 'fitil' ? h.yol.length : 0,
    halka: h.tur === 'fitil' && h.halka,
    R: reak[0].boyut,
    nesil: patlamalar.reduce((m, p) => Math.max(m, p.nesil), 0),
    patlama: ist('toplamPatlama'),
    isiPatlamasi: ist('isiPatlamasi'),
    olusan: olusanlar[0] ?? 'yok',
    ozel: yeniden ? null : { roket: ozelSay(d, 'roket') + olusanSay('roket') - ozelSay(s, 'roket'), kasimpati: ozelSay(d, 'kasimpati') + olusanSay('kasimpati') - ozelSay(s, 'kasimpati'), yildiz: ozelSay(d, 'yildiz') + olusanSay('yildiz') - ozelSay(s, 'yildiz') },
    kombo: ist('kombinasyon'),
    kafes: ist('kafesKirilan'),
    kaya: ist('kayaKirilan'),
    engelHasar: kat(d) - kat(s),
    doseme: say(d, (c) => c.doseme) - say(s, (c) => c.doseme),
    desen: say(s, (c) => (c.desenBoyali ? 1 : 0)) - say(d, (c) => (c.desenBoyali ? 1 : 0)),
    is: icerikSay(d, 'is') - icerikSay(s, 'is') + tur('isYayildi').length,
    fener: ist('fenerToplanan'),
    devFisek: ist('devFisekAtesi'),
    kurutma: icerikSay(d, 'islak') - icerikSay(s, 'islak'),
    devDoldu: tur('devFisekDoldu').length,
  };
}

/** İz ile bağımsız kayıt aynı mı (alan alan; bağlam mesajıyla). */
function izDenetle(iz: HamleIzi, b: Bagimsiz, baglam: string): void {
  const { ozel, kombo, devDoldu, ...duz } = b;
  for (const [k, beklenen] of Object.entries(duz)) expect(iz[k as keyof HamleIzi], `${baglam}: ${k}`).toEqual(beklenen);
  expect(iz.kombolar.length, `${baglam}: kombo`).toBe(kombo);
  expect(iz.renkPatlama.reduce((t, n) => t + n, 0), `${baglam}: renkPatlama`).toBeLessThanOrEqual(iz.patlama);
  if (ozel) for (const t of OZELLER) expect(iz[t], `${baglam}: patlayan ${t}`).toBe(ozel[t]);
  // Atıflı sayaçlar üst sınırla.
  expect(iz.izliDevFisek, `${baglam}: izliDevFisek`).toBeLessThanOrEqual(iz.devFisek);
  expect(iz.caprazEngel, `${baglam}: caprazEngel`).toBeLessThanOrEqual(iz.kafes + iz.engelHasar + iz.is + devDoldu);
  if (iz.caprazRoket === 0) expect(iz.caprazEngel, `${baglam}: caprazEngel çapraz roketsiz`).toBe(0);
  expect(iz.caprazRoket, `${baglam}: caprazRoket`).toBeLessThanOrEqual(iz.roket);
}

/** Koşul dilinin her (ölçü, kapsam) çifti için bağımsız kayıtlardan beklenen değer; ölçülemeyende null. */
function beklenenDeger(olcu: MuhurOlcusu, kapsam: MuhurKosulu['kapsam'], kayitlar: readonly Bagimsiz[], son: { kalan: number; guclendirici: number }): number | null {
  if (kapsam === 'son') return son.kalan;
  if (olcu === 'guclendirici') return son.guclendirici;
  const tekHamle = kayitlar.filter((b) => b.eylem !== 'kibrit' && b.eylem !== 'kalip');
  const l = kapsam === 'hamle' ? tekHamle : kayitlar;
  const deger = (b: Bagimsiz): number | null => {
    switch (olcu) {
      case 'halka':
        return b.eylem === 'fitil' && b.halka ? 1 : 0;
      case 'olusum':
        return b.olusan !== 'yok' ? 1 : 0;
      case 'ozelAtes':
        return b.ozel ? b.ozel.roket + b.ozel.kasimpati + b.ozel.yildiz : null;
      case 'kombo':
        return b.kombo;
      case 'koruk':
        return b.eylem === 'koruk' ? 1 : 0;
      case 'zincir':
        return b.eylem === 'fitil' ? b.zincir : 0;
      case 'kisaZincir':
        return b.eylem === 'fitil' && b.zincir <= 3 ? 1 : 0;
      case 'R':
      case 'nesil':
      case 'patlama':
      case 'isiPatlamasi':
      case 'kafes':
      case 'kaya':
      case 'engelHasar':
      case 'doseme':
      case 'desen':
      case 'is':
      case 'fener':
      case 'devFisek':
      case 'kurutma':
        return b[olcu];
      default:
        return null; // atıflı ölçüler (çapraz roket, izli dev fişek, çapraz engel) hedefli testlerde
    }
  };
  let toplam = 0;
  let enBuyuk = 0;
  for (const b of l) {
    const v = deger(b);
    if (v === null) return null;
    toplam += v;
    enBuyuk = Math.max(enBuyuk, v);
  }
  return kapsam === 'hamle' ? enBuyuk : toplam;
}

interface IzliOyun {
  oz: OyunOzeti;
  kayitlar: Bagimsiz[];
  son: OyunDurumu;
  /** Kazanç anındaki (final öncesi) durum. */
  finalOncesi: OyunDurumu | null;
}

/** Hamle seçiciyle oyna; her eylemde uygulamanın yaptığı gibi `ozetHamle` ve bağımsız kayıt. */
function izliOyna(d0: OyunDurumu, sec: (d: OyunDurumu) => Hamle | null, enCok = 200): IzliOyun {
  let d = d0;
  let oz = ozetBaslat();
  const kayitlar: Bagimsiz[] = [];
  for (let k = 0; k < enCok && !d.bitti; k++) {
    const h = sec(d);
    if (!h) break;
    const r = hamleUygula(d, h);
    oz = ozetHamle(oz, r.olaylar, { hamle: h, onceki: d });
    const b = bagimsiz(d, h, r.olaylar, r.durum);
    izDenetle(oz.hamleIzleri[oz.hamleIzleri.length - 1], b, `bölüm ${d.bolumId} eylem ${k} ${h.tur}`);
    kayitlar.push(b);
    d = r.durum;
  }
  return { oz, kayitlar, son: d, finalOncesi: d.bitti === 'kazanc' ? d : null };
}

/** Bütün (ölçü, kapsam) çiftlerinde muhurDegeri = bağımsız toplam. */
function kosullariDenetle(o: IzliOyun, baglam: string): number {
  const mo = muhurOzeti(o.oz, o.son);
  let denetlenen = 0;
  for (const [olcu, kapsamlar] of Object.entries(OLCU_KAPSAMLARI) as [MuhurOlcusu, readonly MuhurKosulu['kapsam'][]][]) {
    for (const kapsam of kapsamlar) {
      const beklenen = beklenenDeger(olcu, kapsam, o.kayitlar, { kalan: o.son.kalanHamle, guclendirici: o.son.istatistik.guclendirici });
      if (beklenen === null) continue;
      expect(muhurDegeri({ olcu, kapsam, enAz: 1 }, mo), `${baglam}: ${olcu}/${kapsam}`).toBe(beklenen);
      denetlenen++;
    }
  }
  return denetlenen;
}

// ───────────────────────────── gerçek bölümler ─────────────────────────────

describe('eylem izi gerçek bölüm oyunlarında çekirdekle tutarlı', () => {
  // Her öğe en az bir bölümde: kasımpatı, ıslak, halka, döşeme, fener, yıldız
  // topu + kafes, kaya, kombinasyon, dev fişek, Körük, kova, bayram, barut
  // izi, desen, meltem, is, çisenti, barut deposu.
  const BOLUMLER = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 21, 26, 29, 31, 33, 37];

  it('Usta ve Acemi oyunları: her eylemde iz = durum/istatistik farkı; her koşul türü', () => {
    let eylem = 0;
    let kosul = 0;
    for (const id of BOLUMLER) {
      const v = bolumGetir(id)!;
      for (const [bot, tohum] of [['usta', 11], ['acemi', 12], ['acemi', 13]] as const) {
        // Botun seçtiği hamleler gerçek oyun akışında (oyunOyna'nın kaydı).
        const hamleler: Hamle[] = [];
        oyunOyna(v, tohum, bot, { kayit: (k) => hamleler.push(k.hamle) });
        let i = 0;
        const o = izliOyna(bolumuYukle(v, tohum), () => hamleler[i++] ?? null);
        eylem += o.oz.hamleIzleri.length;
        kosul += kosullariDenetle(o, `bölüm ${id} ${bot} ${tohum}`);
      }
    }
    expect(eylem).toBeGreaterThan(400);
    expect(kosul).toBeGreaterThan(BOLUMLER.length * 3 * 25);
  }, 120_000);

  it('muhurluOyun (ölçüm aracı) uygulamayla aynı izi üretir; final iz eklemez, kalan hamle final öncesi', () => {
    const v = bolumGetir(8)!;
    const hamleler: Hamle[] = [];
    const { sonuc, oyun } = muhurluOyun(v, 21, 'usta', { kayit: (k) => hamleler.push(k.hamle) });
    expect(sonuc.kazandi).toBe(true);
    let i = 0;
    const o = izliOyna(bolumuYukle(v, 21), () => hamleler[i++] ?? null);
    expect(oyun.izler).toEqual(o.oz.hamleIzleri);
    expect(oyun.kalanHamle).toBe(o.finalOncesi!.kalanHamle);
    expect(oyun.kalanHamle).toBeGreaterThan(0);
    // Final gösterisi: kalan hamle 0'a iner, özet izi değişmez, mühür final öncesi durumla.
    const f = finalGosterisi(o.finalOncesi!);
    const ozF = ozetFinal(o.oz, f.olaylar);
    expect(f.durum.kalanHamle).toBe(0);
    expect(ozF.hamleIzleri).toEqual(o.oz.hamleIzleri);
    expect(ozF.finalPatlama).toBeGreaterThan(0);
    const k: MuhurKosulu = { olcu: 'kalanHamle', kapsam: 'son', enAz: oyun.kalanHamle };
    expect(muhurleriDegerlendir({ muhurler: [k, k, k] }, muhurOzeti(ozF, o.finalOncesi!))).toEqual([true, true, true]);
    expect(muhurleriDegerlendir({ muhurler: [k, k, k] }, muhurOzeti(ozF, f.durum))).toEqual([false, false, false]);
    // Bölüm verisinin kendi mühürleri bu oyunda değerlendirilebilir.
    expect(muhurleriDegerlendir(v, muhurOzeti(o.oz, o.finalOncesi!))).toHaveLength(3);
  });

  it('Usta\'nın Eli ile devam eden oyunda mühür yok, HUD hepsini bozuk gösterir', () => {
    const v = bolumGetir(10)!;
    // Kaybedilen bir Acemi oyunu bul ve Usta'nın Eli ile sürdür.
    for (let t = 0; t < 40; t++) {
      const hamleler: Hamle[] = [];
      if (oyunOyna(v, t, 'acemi', { kayit: (k) => hamleler.push(k.hamle) }).kazandi) continue;
      let i = 0;
      const o = izliOyna(bolumuYukle(v, t), () => hamleler[i++] ?? null);
      expect(o.son.bitti).toBe('kayip');
      const devam = ustaEliUygula(o.son).durum;
      const mo = muhurOzeti(o.oz, { ...devam, bitti: 'kazanc' });
      expect(mo.ustaEli).toBe(true);
      expect(muhurleriDegerlendir(v, mo)).toEqual([false, false, false]);
      expect(muhurAnlik(v, mo)).toEqual(['bozuldu', 'bozuldu', 'bozuldu']);
      return;
    }
    throw new Error('kaybedilen Acemi oyunu bulunamadı');
  });
});

describe('eylem izi rastgele bölümlerde (güçlendirici ve Körük dahil)', () => {
  it('her öğe karışık 60 rastgele oyun: iz = durum farkı; Kibrit/Kalıp tek hamle sayılmaz', () => {
    let guc = 0;
    let koruk = 0;
    for (let oyun = 0; oyun < 60; oyun++) {
      const r = { rng: (oyun * 2246822519 + 7) >>> 0 };
      const v = { ...rastgeleBolum(r, 7000 + oyun), korukKapasitesi: 6 };
      const o = izliOyna(bolumuYukle(v, rngInt(r, 3)), (d) => rastgeleHamle(d, r), 40);
      kosullariDenetle(o, `rastgele ${oyun}`);
      guc += o.kayitlar.filter((b) => b.eylem === 'kibrit' || b.eylem === 'kalip').length;
      koruk += o.kayitlar.filter((b) => b.eylem === 'koruk').length;
    }
    expect(guc).toBeGreaterThan(0);
    expect(koruk).toBeGreaterThan(0);
  }, 60_000);
});

// ───────────────────────────── hedefli tahtalar ─────────────────────────────

describe('atıflı ölçüler hedefli tahtalarda', () => {
  it('çapraz roket: ekseninde kırdığı kafes çapraz engel sayılır; dik roket sayılmaz', () => {
    const d = kur([
      'R  A  Z  G  M', //
      'A  Z  G  M  R',
      'Z  G  cA R  A',
      'G  M  R  A  Z',
      'Gr2 R A  Z  G',
    ]);
    const h: Hamle = { tur: 'ciftDokunus', hucre: { x: 0, y: 4 } };
    const r = hamleUygula(d, h);
    const iz = ozetHamle(ozetBaslat(), r.olaylar, { hamle: h, onceki: d }).hamleIzleri[0];
    expect(iz).toMatchObject({ eylem: 'ciftDokunus', roket: 1, caprazRoket: 1, caprazEngel: 1, kafes: 1, zincir: 0, halka: false });
    const mo = muhurOzeti({ hamleIzleri: [iz] }, { ...r.durum, bitti: 'kazanc' });
    expect(muhurDegeri({ olcu: 'caprazRoket', kapsam: 'hamle', enAz: 1 }, mo)).toBe(1);
    expect(muhurDegeri({ olcu: 'caprazEngel', kapsam: 'oyun', enAz: 1 }, mo)).toBe(1);
    expect(muhurDegeri({ olcu: 'ozelAtes', kapsam: 'hamle', enAz: 1, ozel: 'roket' }, mo)).toBe(1);

    // Aynı kafes yatay roketle kırılırsa çapraz değil.
    const d2 = kur([
      'R  A  Z  G  M', //
      'A  Z  G  M  R',
      'Zr0 G cA R  A',
      'G  M  R  A  Z',
      'A  R  A  Z  G',
    ]);
    const h2: Hamle = { tur: 'ciftDokunus', hucre: { x: 0, y: 2 } };
    const iz2 = ozetHamle(ozetBaslat(), hamleUygula(d2, h2).olaylar, { hamle: h2, onceki: d2 }).hamleIzleri[0];
    expect(iz2).toMatchObject({ roket: 1, caprazRoket: 0, caprazEngel: 0, kafes: 1 });
  });

  it('kombinasyon: iki özel taş da ateşlenmiş sayılır; kombinasyona giren çapraz roket çapraz roket sayılır', () => {
    const d = kur([
      'Rr2 Rr0 R  G  M', //
      'A  Z  G  M  A',
      'Z  G  A  R  Z',
      'G  M  R  A  G',
      'A  R  Z  G  M',
    ]);
    const h = fitil([0, 0], [1, 0], [2, 0]);
    const r = hamleUygula(d, h);
    expect(r.olaylar.some((o) => o.tur === 'kombinasyon' && o.kombo === 'yildizHatti')).toBe(true);
    const iz = ozetHamle(ozetBaslat(), r.olaylar, { hamle: h, onceki: d }).hamleIzleri[0];
    expect(iz.kombolar).toEqual(['yildizHatti']);
    expect(iz.roket).toBe(2);
    expect(iz.caprazRoket).toBe(1);
    const mo = muhurOzeti({ hamleIzleri: [iz] }, { ...r.durum, bitti: 'kazanc' });
    expect(muhurDegeri({ olcu: 'ozelAtes', kapsam: 'hamle', enAz: 1 }, mo)).toBe(2);
    expect(muhurDegeri({ olcu: 'kombo', kapsam: 'oyun', enAz: 1, kombo: 'yildizHatti' }, mo)).toBe(1);
    // Eylem öncesi durum verilmezse (olaylardanOzet) kombinasyondaki eksen bilinmez.
    expect(olaylardanOzet([r.olaylar]).hamleIzleri[0].caprazRoket).toBe(0);
  });

  it('barut izi dev fişeği: iz yanarak dolduran dev fişek izli sayılır, doğrudan vuruşla dolan sayılmaz', () => {
    const satirlar = [
      'R  A  Z  G  M', //
      'R  Z  G  M  A',
      'R  G  A  Z  D1',
      'G  M  R  A  Z',
      'A  R  Z  G  M',
    ];
    const d = kur(satirlar, { zemin: { barutIzleri: [[[0, 2], [1, 2], [2, 2], [3, 2]]] } });
    const h = fitil([0, 0], [0, 1], [0, 2]);
    const r = hamleUygula(d, h);
    const iz = ozetHamle(ozetBaslat(), r.olaylar, { hamle: h, onceki: d }).hamleIzleri[0];
    expect(iz).toMatchObject({ devFisek: 1, izliDevFisek: 1 });
    // İz yok: aynı dev fişek komşu zincirle doğrudan dolar.
    const d2 = kur([
      'R  A  Z  Z  M', //
      'R  M  G  Z  A',
      'G  R  A  Z  D1',
      'G  M  R  A  Z',
      'A  R  Z  G  M',
    ]);
    const h2 = fitil([3, 0], [3, 1], [3, 2]);
    expect(hamleUygula(d2, h2).olaylar.some((o) => o.tur === 'devFisekFirladi')).toBe(true);
    const iz2 = ozetHamle(ozetBaslat(), hamleUygula(d2, h2).olaylar, { hamle: h2, onceki: d2 }).hamleIzleri[0];
    expect(iz2).toMatchObject({ devFisek: 1, izliDevFisek: 0 });
  });

  it('zincir dönüşümü ve halka: oluşan özel taş, halka boyu, kısa zincir', () => {
    const d = kur([
      'R  R  R  R  R  R  A', //
      'A  Z  G  M  A  Z  G',
      'Z  G  A  A  Z  G  M',
      'G  M  A  A  G  M  A',
      'A  R  Z  G  M  A  Z',
    ]);
    const h6 = fitil([0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]);
    const r6 = hamleUygula(d, h6);
    const i6 = ozetHamle(ozetBaslat(), r6.olaylar, { hamle: h6, onceki: d }).hamleIzleri[0];
    expect(i6).toMatchObject({ olusan: 'roket', zincir: 6, halka: false });
    const hh: Hamle = { tur: 'fitil', yol: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }], halka: true };
    const rh = hamleUygula(d, hh);
    const ih = ozetHamle(ozetBaslat(), rh.olaylar, { hamle: hh, onceki: d }).hamleIzleri[0];
    expect(ih).toMatchObject({ halka: true, zincir: 4, olusan: 'yok' });
    const mo = muhurOzeti({ hamleIzleri: [i6, ih] }, { ...rh.durum, bitti: 'kazanc' });
    expect(muhurDegeri({ olcu: 'olusum', kapsam: 'oyun', enAz: 1, ozel: 'roket' }, mo)).toBe(1);
    expect(muhurDegeri({ olcu: 'halka', kapsam: 'oyun', enAz: 1 }, mo)).toBe(1);
    expect(muhurDegeri({ olcu: 'zincir', kapsam: 'hamle', enAz: 1, halka: true }, mo)).toBe(4);
    expect(muhurDegeri({ olcu: 'zincir', kapsam: 'hamle', enAz: 1, halka: false }, mo)).toBe(6);
    expect(muhurDegeri({ olcu: 'R', kapsam: 'hamle', enAz: 1, halka: true }, mo)).toBe(ih.R);
    expect(muhurDegeri({ olcu: 'kisaZincir', kapsam: 'oyun', enCok: 0 }, mo)).toBe(0);
  });
});

// ───────────────────────────── ölçüm aracı ─────────────────────────────

describe('ölçüm aracı: bant, öneri, kısıtlı bot', () => {
  const kz = (degerler: number[]): DegerliOyun => ({ kazandi: true, degerler });
  const ky = (degerler: number[]): DegerliOyun => ({ kazandi: false, degerler });

  it('oranlar yalnız kazançlarda; Çırak Acemi ile, az Acemi kazancında Usta yedeği', () => {
    const v = {
      muhurler: [
        { olcu: 'halka', kapsam: 'oyun', enAz: 1 },
        { olcu: 'R', kapsam: 'hamle', enAz: 10 },
        { olcu: 'kalanHamle', kapsam: 'son', enAz: 5 },
      ] as MuhurKosulu[],
    };
    // Usta: 10 kazanç (Kalfa 4/10, Usta 2/10) + 5 kayıp (sayılmaz).
    const usta = [
      ...Array.from({ length: 10 }, (_, i) => kz([1, i < 4 ? 12 : 3, i < 2 ? 6 : 1])),
      ...Array.from({ length: 5 }, () => ky([1, 30, 9])),
    ];
    const acemi = Array.from({ length: 25 }, (_, i) => kz([i < 12 ? 1 : 0, 0, 0]));
    const o = muhurOlc(v, { usta, acemi });
    expect(o.map((x) => [x.kademe, Math.round(x.oran!), x.durum, x.yedek])).toEqual([
      ['cirak', 48, 'bantta', false],
      ['kalfa', 40, 'bantta', false],
      ['usta', 20, 'bantta', false],
    ]);
    expect(o[1].usta).toMatchObject({ oyun: 15, kazanc: 10, tutan: 4 });
    // Acemi 19 kazanç (< 20): Çırak Usta ≥ 85 yedeğiyle (Usta 10/10 = 100).
    const y = muhurOlc(v, { usta, acemi: acemi.slice(0, 19) });
    expect(y[0]).toMatchObject({ yedek: true, oran: 100, durum: 'bantta', bant: CIRAK_YEDEK_BANDI });
    expect(bantDurumu(63, MUHUR_BANTLARI.kalfa)).toBe('payda');
    expect(bantDurumu(66, MUHUR_BANTLARI.kalfa)).toBe('disinda');
    expect(bantDurumu(null, MUHUR_BANTLARI.kalfa)).toBe('olculemedi');
  });

  it('kısıt mühürü: kısıtlı botun tutan kazancı / normal kazanç; kısıtlı oyun yoksa ölçülemez', () => {
    const v = { muhurler: [{ olcu: 'halka', kapsam: 'oyun', enAz: 1 }, { olcu: 'koruk', kapsam: 'oyun', enCok: 0 }, { olcu: 'R', kapsam: 'hamle', enAz: 9 }] as MuhurKosulu[] };
    const usta = Array.from({ length: 10 }, () => kz([1, 2, 0]));
    const kisitli = [...Array.from({ length: 5 }, () => kz([1, 0, 0])), kz([1, 1, 0]), ky([1, 0, 0])];
    const o = muhurOlc(v, { usta, kisitli: [undefined, { usta: kisitli }, undefined] });
    expect(o[1].usta.oran).toBe(0); // doğal: Usta Körük'ü hep kullanır
    expect(o[1].oran).toBe(50); // 5 / 10
    expect(o[1].durum).toBe('bantta');
    expect(muhurOlc(v, { usta })[1].durum).toBe('olculemedi');
    expect(kosulKisiti({ olcu: 'koruk', kapsam: 'oyun', enCok: 0 })).toEqual({ koruk: 0 });
    expect(kosulKisiti({ olcu: 'kisaZincir', kapsam: 'oyun', enCok: 1 })).toEqual({ kisaZincir: 1 });
    expect(kosulKisiti({ olcu: 'halka', kapsam: 'oyun', enAz: 1 })).toBeNull();
    expect(kosulTutar({ enCok: 0 }, 0)).toBe(true);
    expect(kosulTutar({ enCok: 0 }, 1)).toBe(false);
    expect(kosulTutar({ enAz: 3 }, 3)).toBe(true);
  });

  it('eşik önerisi: Kalfa ~%45, Usta ~%16, Çırak alt sınıra pay bırakan en zor eşik', () => {
    const dU = Array.from({ length: 100 }, (_, i) => i % 20); // 0..19 eşit dağılım
    const dA = Array.from({ length: 40 }, (_, i) => i % 10);
    expect(esikOnerisi('kalfa', dU, dA)).toMatchObject({ enAz: 11, oran: 45 });
    expect(esikOnerisi('usta', dU, dA)).toMatchObject({ enAz: 17 });
    // Çırak: Acemi'de ≥ t oranı ≥ 45 olan en büyük t (t = 5: %50).
    expect(esikOnerisi('cirak', dU, dA)).toMatchObject({ enAz: 5, oran: 50 });
    // Acemi kazancı az: Usta yedeği (≥ %85 + 5 pay → t = 2: %90).
    expect(esikOnerisi('cirak', dU, dA.slice(0, 10))).toMatchObject({ enAz: 2, oran: 90 });
    expect(esikOnerisi('kalfa', [], null)).toBeNull();
  });

  it('kısıtlı bot: Körük ve 3\'lük zincir sınırına uyar (gerçek oyun)', () => {
    const v = bolumGetir(17)!; // Körük kapasitesi 12
    let normal = 0;
    for (const t of [3, 4]) {
      const hamleler: Hamle[] = [];
      oyunOyna(v, t, 'usta', { kayit: (k) => hamleler.push(k.hamle) });
      normal += hamleler.filter((h) => h.tur === 'koruk').length;
      const kisitli: Hamle[] = [];
      oyunOyna(v, t, 'usta', { kisit: { koruk: 0, kisaZincir: 0 }, kayit: (k) => kisitli.push(k.hamle) });
      expect(kisitli.filter((h) => h.tur === 'koruk')).toHaveLength(0);
      expect(kisitli.filter((h) => h.tur === 'fitil' && h.yol.length <= 3)).toHaveLength(0);
      const acemi: Hamle[] = [];
      oyunOyna(v, t, 'acemi', { kisit: { koruk: 1 }, kayit: (k) => acemi.push(k.hamle) });
      expect(acemi.filter((h) => h.tur === 'koruk').length).toBeLessThanOrEqual(1);
    }
    expect(normal).toBeGreaterThan(0);
  }, 60_000);

  it('aday kataloğu bölüm öğelerine göre; oyun değerleri koşul sırasıyla', () => {
    const olc = (id: number): string[] => adayKatalogu(bolumGetir(id)!).map((k) => `${k.olcu}/${k.kapsam}`);
    expect(olc(7)).toContain('kurutma/hamle');
    expect(olc(7)).not.toContain('kafes/oyun');
    expect(olc(31)).toContain('is/hamle');
    expect(olc(37)).toContain('izliDevFisek/oyun');
    expect(olc(26)).toContain('desen/hamle');
    expect(olc(6)).not.toContain('koruk/oyun');
    const v: BolumVerisi = bolumGetir(8)!;
    const { oyun } = muhurluOyun(v, 2, 'acemi');
    const d = oyunDegerleri(v.muhurler!, oyun);
    expect(d.degerler).toHaveLength(3);
    expect(d.kazandi).toBe(oyun.kazandi);
  });
});
