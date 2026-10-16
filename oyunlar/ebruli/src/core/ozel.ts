/**
 * Özel taşlar (GDD §5): etki alanları, ateşleme kuyruğu (BFS, §4.4 adım 4–6),
 * birleşimler (§5.4) ve özel taşa dokunan sürükleme eylemi (§5.3, K9).
 *
 * Zaman (§4.9): Tarak hücre başına 25·d; Girdap hücreleri +120 (çöküş 400);
 * Lale i. hedef 300 + 30·i; Mürekkep 3×3 anında (patlama 200); alanda
 * kalkan özel taş +150 (zincir) sonra ateşlenir; birleşim +150 yavaşlatma;
 * Lale birleşiminin tarakları/girdapları 80 tik arayla.
 */
import type { Atesleme, Baglam } from './baglam';
import { DOGUM_SIRASI, GIRDAP_YARICAPI, PUAN, ZAMAN } from './sabitler';
import { damla, hamMi, idx } from './tahta';
import type { Damla, Hamle, KomboTuru, OzelTur, Renk } from './types';

/** Alan hücresi: indeks ve ateşleme anına göre gecikme (tik). */
interface AlanHucresi {
  i: number;
  g: number;
}

/** Ek zaman sabitleri (tik; sabitler.ZAMAN'ı tamamlar, §4.9). */
export const OZEL_ZAMAN = {
  /** Girdap: baklavadaki hücreler ateşlemeden bu kadar sonra temizlenir. */
  girdapHucre: 120,
  /** Lale: taç açılışı; i. hedef 300 + 30·i. */
  laleAcilis: 300,
  /** Lale birleşimi: dönüşen taraklar/girdaplar bu aralıkla ateşlenir. */
  laleDonusum: 80,
} as const;

const KOMBO_ADI: Record<string, KomboTuru> = {
  'tarak|tarak': 'tarakTarak',
  'girdap|tarak': 'tarakGirdap',
  'girdap|girdap': 'girdapGirdap',
  'lale|tarak': 'laleTarak',
  'girdap|lale': 'laleGirdap',
  'lale|lale': 'laleLale',
  'murekkep|tarak': 'murekkepTarak',
  'girdap|murekkep': 'murekkepGirdap',
  'lale|murekkep': 'murekkepLale',
  'murekkep|murekkep': 'murekkepMurekkep',
};

/** İki özel taşın birleşim türü (sırasız). */
export function komboTuru(a: OzelTur, b: OzelTur): KomboTuru {
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  const t = KOMBO_ADI[k];
  if (!t) throw new Error(`birleşim yok: ${a} + ${b}`);
  return t;
}

/** Lale içeren birleşimler +600, diğerleri +300 (§5.4). */
export function komboPuani(k: KomboTuru): number {
  return k === 'laleTarak' || k === 'laleGirdap' || k === 'laleLale' || k === 'murekkepLale' ? 600 : 300;
}

// ─── Alanlar ────────────────────────────────────────────────────────────

/** Toplayıcı: hücre başına en küçük gecikme; delikler atlanır. */
class AlanToplayici {
  private readonly g: Int32Array;
  private readonly sira: number[] = [];
  constructor(private readonly c: Baglam) {
    this.g = new Int32Array(c.d.w * c.d.h).fill(-1);
  }
  ekle(x: number, y: number, g: number): void {
    const { w, h, hucreler } = this.c.d;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (hucreler[i].delik) return;
    if (this.g[i] < 0) {
      this.g[i] = g;
      this.sira.push(i);
    } else if (g < this.g[i]) this.g[i] = g;
  }
  liste(): AlanHucresi[] {
    return this.sira.map((i) => ({ i, g: this.g[i] })).sort((a, b) => a.g - b.g || a.i - b.i);
  }
}

function hatEkle(t: AlanToplayici, w: number, h: number, x0: number, y0: number, yatay: boolean, g0: number): void {
  if (yatay) for (let x = 0; x < w; x++) t.ekle(x, y0, g0 + ZAMAN.tarakHucre * Math.abs(x - x0));
  else for (let y = 0; y < h; y++) t.ekle(x0, y, g0 + ZAMAN.tarakHucre * Math.abs(y - y0));
}

function baklavaEkle(t: AlanToplayici, x0: number, y0: number, r: number, g: number): void {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r) t.ekle(x0 + dx, y0 + dy, g);
}

function kareEkle(t: AlanToplayici, x0: number, y0: number, r: number, g: number): void {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) t.ekle(x0 + dx, y0 + dy, g);
}

/** Merkezden Manhattan uzaklığına, sonra indekse göre sıralı hücreler. */
function uzakligaGore(c: Baglam, merkez: number, hucreler: number[]): number[] {
  const w = c.d.w;
  const mx = merkez % w;
  const my = (merkez - mx) / w;
  const u = (i: number): number => Math.abs((i % w) - mx) + Math.abs((i - (i % w)) / w - my);
  return hucreler.sort((a, b) => u(a) - u(b) || a - b);
}

/** Alınmamış, verilen renkteki damla hücreleri (Lale hedefleri). */
function renkHucreleri(c: Baglam, renk: Renk | 0, merkez: number): number[] {
  const l: number[] = [];
  const hs = c.d.hucreler;
  for (let i = 0; i < hs.length; i++) {
    if (c.alinan[i]) continue;
    const dm = damla(hs[i]);
    if (dm && dm.renk === renk) l.push(i);
  }
  return uzakligaGore(c, merkez, l);
}

/** Tahtada en bol renk (eşitlikte DOGUM_SIRASI; alana giren Lale, §5.2). */
function enBolRenk(c: Baglam): Renk | null {
  const sayi = new Int32Array(8);
  const hs = c.d.hucreler;
  for (let i = 0; i < hs.length; i++) {
    if (c.alinan[i]) continue;
    const dm = damla(hs[i]);
    if (dm && dm.renk >= 1 && dm.renk <= 6) sayi[dm.renk]++;
  }
  let en: Renk | null = null;
  for (const r of DOGUM_SIRASI) if (sayi[r] > 0 && (en === null || sayi[r] > sayi[en])) en = r;
  return en;
}

// ─── Ateşleme ───────────────────────────────────────────────────────────

/** Alan hücresine vuruş: mermere alan hasarı, damlaya temizlik; kalkan özel taş zincire girer. */
function alanVur(c: Baglam, i: number, t: number, neden: Atesleme['neden']): boolean {
  const h = c.d.hucreler[i];
  if (h.icerik?.tur === 'mermer') {
    c.mermerVur(i, t, true);
    return false;
  }
  const dm = c.temizle(i, neden, t);
  if (!dm) return false;
  if (dm.ozel !== 'yok') zincireEkle(c, i, dm, t + ZAMAN.zincir);
  return true;
}

/** Temizlenmiş bir özel taşı (taş tahtadan kalktı) ateşleme kuyruğuna ekler. */
export function zincireEkle(c: Baglam, i: number, dm: Damla, t: number): void {
  if (dm.ozel === 'yok') return;
  c.kuyrugaEkle({ hucre: i, ozel: dm.ozel, renk: dm.renk, yon: dm.yon, id: dm.id, t, kaldir: null, neden: dm.ozel });
}

/** Kuyruğu boşalana kadar zaman sırasıyla işler (§4.4 BFS). */
export function kuyruguIsle(c: Baglam): void {
  while (c.kuyruk.length) atesle(c, c.kuyruk.shift()!);
}

function atesle(c: Baglam, a: Atesleme): void {
  const d = c.d;
  if (a.kaldir) {
    const dm = damla(d.hucreler[a.hucre]);
    if (!dm || dm.id !== a.id || c.alinan[a.hucre]) return; // bu arada bir alanla kalktı (orada zincire girdi)
    c.temizle(a.hucre, a.kaldir, a.t);
  }
  if (a.ozel === 'birlesim') {
    birlesimAtesle(c, a);
    return;
  }
  const p = c.K(a.hucre);
  const top = new AlanToplayici(c);
  let sure = 0;
  let hedefRenk: Renk | null = null;
  let alan: AlanHucresi[];
  switch (a.ozel) {
    case 'tarak':
      hatEkle(top, d.w, d.h, p.x, p.y, a.yon === 'yatay', 0);
      alan = top.liste();
      sure = alan.length ? alan[alan.length - 1].g : 0;
      break;
    case 'girdap':
      baklavaEkle(top, p.x, p.y, GIRDAP_YARICAPI, OZEL_ZAMAN.girdapHucre);
      alan = top.liste();
      sure = ZAMAN.girdap;
      break;
    case 'murekkep':
      kareEkle(top, p.x, p.y, 1, 0);
      alan = top.liste();
      sure = ZAMAN.murekkep;
      break;
    case 'lale': {
      hedefRenk = a.hedefRenk ?? enBolRenk(c);
      const l = hedefRenk === null ? [] : renkHucreleri(c, hedefRenk, a.hucre);
      alan = l.map((i, k) => ({ i, g: OZEL_ZAMAN.laleAcilis + ZAMAN.laleYaprak * k }));
      sure = OZEL_ZAMAN.laleAcilis + ZAMAN.laleYaprak * l.length;
      break;
    }
  }
  const govde = {
    tur: 'ozelTetiklendi' as const,
    hucre: p,
    ozel: a.ozel,
    yon: a.yon,
    alan: alan.map((x) => c.K(x.i)),
  };
  c.ekle(a.t, hedefRenk !== null ? { ...govde, hedefRenk } : govde);
  let boyut = 0;
  for (const x of alan) if (alanVur(c, x.i, a.t + x.g, a.neden)) boyut++;
  if (a.t + sure > c.son) c.son = a.t + sure;
  c.gunlukEkle(a.ozel, p.x * 10, p.y * 10, a.ozel === 'lale' ? (hedefRenk ?? 0) : a.renk, boyut, a.ozel === 'tarak' ? a.yon : undefined);
}

function birlesimAtesle(c: Baglam, a: Atesleme): void {
  const d = c.d;
  const kombo = a.kombo!;
  const p = c.K(a.hucre);
  const T = a.t;
  const g0 = ZAMAN.birlesim;
  const top = new AlanToplayici(c);
  let donusum: 'tarak' | 'girdap' | null = null;
  let alan: AlanHucresi[] = [];
  switch (kombo) {
    case 'tarakTarak':
      hatEkle(top, d.w, d.h, p.x, p.y, true, g0);
      hatEkle(top, d.w, d.h, p.x, p.y, false, g0);
      alan = top.liste();
      break;
    case 'tarakGirdap':
      for (let s = -1; s <= 1; s++) {
        if (p.y + s >= 0 && p.y + s < d.h) hatEkle(top, d.w, d.h, p.x, p.y + s, true, g0);
        if (p.x + s >= 0 && p.x + s < d.w) hatEkle(top, d.w, d.h, p.x + s, p.y, false, g0);
      }
      alan = top.liste();
      break;
    case 'murekkepTarak':
      for (let s = -1; s <= 1; s++) {
        if (a.yon === 'yatay' && p.y + s >= 0 && p.y + s < d.h) hatEkle(top, d.w, d.h, p.x, p.y + s, true, g0);
        if (a.yon === 'dikey' && p.x + s >= 0 && p.x + s < d.w) hatEkle(top, d.w, d.h, p.x + s, p.y, false, g0);
      }
      alan = top.liste();
      break;
    case 'girdapGirdap':
      baklavaEkle(top, p.x, p.y, 4, g0 + OZEL_ZAMAN.girdapHucre);
      alan = top.liste();
      break;
    case 'murekkepGirdap':
      baklavaEkle(top, p.x, p.y, 3, g0 + OZEL_ZAMAN.girdapHucre);
      alan = top.liste();
      break;
    case 'murekkepMurekkep':
      kareEkle(top, p.x, p.y, 2, g0);
      alan = top.liste();
      break;
    case 'laleLale':
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) top.ekle(x, y, g0 + OZEL_ZAMAN.laleAcilis + ZAMAN.tarakHucre * (Math.abs(x - p.x) + Math.abs(y - p.y)));
      alan = top.liste();
      break;
    case 'murekkepLale': {
      const hs = d.hucreler;
      for (let i = 0; i < hs.length; i++) {
        const dm = damla(hs[i]);
        if (!c.alinan[i] && dm && dm.ozel === 'yok' && hamMi(dm.renk)) {
          const x = i % d.w;
          const y = (i - x) / d.w;
          top.ekle(x, y, g0 + OZEL_ZAMAN.laleAcilis + ZAMAN.tarakHucre * (Math.abs(x - p.x) + Math.abs(y - p.y)));
        }
      }
      alan = top.liste();
      break;
    }
    case 'laleTarak':
    case 'laleGirdap':
      donusum = kombo === 'laleTarak' ? 'tarak' : 'girdap';
      alan = renkHucreleri(c, a.renk, a.hucre).map((i, k) => ({ i, g: g0 + OZEL_ZAMAN.laleAcilis + OZEL_ZAMAN.laleDonusum * k }));
      break;
  }
  c.ekle(T, { tur: 'birlesim', hucre: p, kombo, alan: alan.map((x) => c.K(x.i)) });
  c.puanEkle(T, komboPuani(kombo), 'ozel', p);
  if (!c.dogumsuz) d.istatistik.birlesim++;
  let boyut = 0;
  let sure = 0;
  if (donusum) {
    // Rengin bütün düz damlaları tarağa/girdaba döner (anında), sonra 80 tik
    // arayla ateşlenir; o renkteki özel taşlar kendi etkisiyle ateşlenir.
    alan.forEach((x, k) => {
      const h = d.hucreler[x.i];
      const dm = damla(h)!;
      let tas = dm;
      if (dm.ozel === 'yok') {
        tas = { id: dm.id, renk: dm.renk, ozel: donusum!, yon: donusum === 'tarak' && k % 2 === 1 ? 'dikey' : 'yatay' };
        h.icerik = { tur: 'damla', damla: tas };
        c.ekle(T, { tur: 'donustu', hucre: c.K(x.i), damla: { ...tas } });
      }
      c.kuyrugaEkle({ hucre: x.i, ozel: tas.ozel as Exclude<OzelTur, 'yok'>, renk: tas.renk, yon: tas.yon, id: tas.id, t: T + x.g, kaldir: 'birlesim', neden: tas.ozel as Atesleme['neden'] });
      sure = x.g;
    });
  } else {
    for (const x of alan) {
      if (alanVur(c, x.i, T + x.g, 'birlesim')) boyut++;
      if (x.g > sure) sure = x.g;
    }
  }
  if (T + sure > c.son) c.son = T + sure;
  c.gunlukEkle('birlesim', p.x * 10, p.y * 10, a.renk, boyut);
}

// ─── Sürükleme eylemi (§5.3) ───────────────────────────────────────────

/**
 * Özel taşa dokunan sürükleme: `ozelSuruklendi` (t = 0) ve adım 1
 * (ateşleme + zincir). Sonra çözümleme döngüsü k = 2'den sürer.
 *  - özel → özel: kaynak hedefe taşınır (tüketilir), hedefteki taş
 *    `temizlendi{birlesim}` ile kalkar, birleşim hedefte.
 *  - Tarak/Girdap → düz: taş hedefe taşınır (tüketilir), hedefin damlası
 *    `temizlendi` ile kalkar, taş hedefte ateşlenir.
 *  - Lale/Mürekkep → düz: taş yerinde açılır/patlar (kendi `temizlendi`si
 *    ateşlemeyle); Lale hedefin rengini temizler.
 *  - düz → özel (ters): hedefteki taş yerinde ateşlenir; Lale kaynağın
 *    rengini temizler; kaynak damla alanda değilse kalır.
 */
export function ozelEylem(c: Baglam, h: Hamle): void {
  const d = c.d;
  const ki = idx(d, h.kaynak.x, h.kaynak.y);
  const ei = idx(d, h.hedef.x, h.hedef.y);
  const a = damla(d.hucreler[ki])!;
  const b = damla(d.hucreler[ei])!;
  const T1 = ZAMAN.ozelKayma;
  const tasi = (): void => {
    c.ekle(0, { tur: 'ozelSuruklendi', kaynak: h.kaynak, hedef: h.hedef, ozel: a.ozel, tasindi: true, ters: false, damla: { ...a } });
    d.hucreler[ki].icerik = null;
    c.sayKaldirilan(h.hedef);
  };
  if (a.ozel !== 'yok' && b.ozel !== 'yok') {
    tasi();
    c.adimBasla(1);
    c.temizle(ei, 'birlesim', T1);
    const kombo = komboTuru(a.ozel, b.ozel);
    const renkli = [a, b].find((x) => x.ozel === 'tarak' || x.ozel === 'girdap');
    const tarak = [a, b].find((x) => x.ozel === 'tarak');
    c.kuyrugaEkle({
      hucre: ei,
      ozel: 'birlesim',
      kombo,
      renk: renkli ? renkli.renk : 0,
      yon: tarak ? tarak.yon : 'yatay',
      id: b.id,
      t: T1,
      kaldir: null,
      neden: 'birlesim',
    });
  } else if (a.ozel === 'tarak' || a.ozel === 'girdap') {
    tasi();
    c.adimBasla(1);
    c.temizle(ei, a.ozel, T1);
    c.kuyrugaEkle({ hucre: ei, ozel: a.ozel, renk: a.renk, yon: a.yon, id: a.id, t: T1, kaldir: null, neden: a.ozel });
  } else if (a.ozel !== 'yok') {
    c.ekle(0, { tur: 'ozelSuruklendi', kaynak: h.kaynak, hedef: h.hedef, ozel: a.ozel, tasindi: false, ters: false });
    c.adimBasla(1);
    c.kuyrugaEkle({
      hucre: ki,
      ozel: a.ozel,
      renk: a.renk,
      yon: a.yon,
      id: a.id,
      t: T1,
      kaldir: a.ozel,
      neden: a.ozel,
      ...(a.ozel === 'lale' ? { hedefRenk: b.renk as Renk } : {}),
    });
  } else {
    c.ekle(0, { tur: 'ozelSuruklendi', kaynak: h.kaynak, hedef: h.hedef, ozel: b.ozel, tasindi: false, ters: true });
    c.adimBasla(1);
    c.kuyrugaEkle({
      hucre: ei,
      ozel: b.ozel as Exclude<OzelTur, 'yok'>,
      renk: b.renk,
      yon: b.yon,
      id: b.id,
      t: T1,
      kaldir: b.ozel as Atesleme['neden'],
      neden: b.ozel as Atesleme['neden'],
      ...(b.ozel === 'lale' ? { hedefRenk: a.renk as Renk } : {}),
    });
  }
  kuyruguIsle(c);
  c.adimBitir();
}

/** Özel taş üretim puanı (§5.1). */
export function uretimPuani(o: OzelTur): number {
  return o === 'tarak' ? PUAN.tarak : o === 'girdap' ? PUAN.girdap : o === 'lale' ? PUAN.lale : 0;
}

/** Grup boyundan özel taş (K7 eşikleri; büyük olan kazanır). */
export function ozelTuruBul(esikler: readonly [number, number, number], boy: number): OzelTur {
  if (boy >= esikler[2]) return 'lale';
  if (boy >= esikler[1]) return 'girdap';
  if (boy >= esikler[0]) return 'tarak';
  return 'yok';
}

