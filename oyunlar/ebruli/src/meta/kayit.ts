/**
 * Oyuncu kaydı (GDD §13.7): sürümlü şema, göç/temizleme ve temizlik
 * günlüğü sıkıştırması (§9.1). Saf; DOM ve depolama yok (SaveStore
 * `src/app/kayitci.ts`'de).
 *
 * Tablo GÖRÜNTÜ olarak saklanmaz: yalnız tohum ve sıkıştırılmış temizlik
 * günlüğü saklanır; galeri tabloyu istendiğinde belirlenimli yeniden çizer
 * (aynı günlük + tohum → aynı tablo).
 */
import type { Teknik, TemizlikKaydi, Yon } from '../core/types';

export const KAYIT_SURUMU = 1;
export const KAYIT_ANAHTARI = 'ebruli.kayit.v1';

export type Yildiz = 0 | 1 | 2 | 3;
export type Nadirlik = 0 | 1 | 2;

/** Galerideki tablo: yeniden çizim için gereken her şey (görüntü değil). */
export interface TabloKaydi {
  /** `tabloTohumu(bolumId, denemeNo, puan)`. */
  tohum: number;
  /** Sıkıştırılmış temizlik günlüğü (`gunlukKodla`). */
  gunluk: string;
  nadirlik: Nadirlik;
  teknikler: Teknik[];
  /** Tablonun çizildiği oyundaki yıldız ve puan (künye, çerçeve). */
  yildiz: Yildiz;
  puan: number;
  /** Desen hedefi tamamlandıysa çiçek motifi. */
  motif?: 'lale' | 'karanfil';
}

export interface BolumKaydi {
  /** En iyi yıldız. */
  yildiz: Yildiz;
  /** En iyi kazanç puanı (kazanılmadıysa 0). */
  enIyi: number;
  /** Başlatılan deneme sayısı (sıradaki denemenin `denemeNo`'su). */
  deneme: number;
  /** Ardışık kayıp (Usta'nın Eli, K16). Kazanınca sıfırlanır. */
  basarisizSeri: number;
  kazanildi: boolean;
  tablo: TabloKaydi | null;
}

export interface Ayarlar {
  /** Efekt sesi 0..1. */
  sfx: number;
  /** Müzik 0..1. */
  muzik: number;
  /** Ortam sesi (su + atölye). */
  ortam: boolean;
  titresim: boolean;
  /** Hareketi azalt; null = sistem ayarı (`prefers-reduced-motion`). */
  hareketiAzalt: boolean | null;
  /** Animasyon hızı: 1 Normal, 1.5 Hızlı. */
  hiz: 1 | 1.5;
  palet: 'standart' | 'renkKoru';
  motifler: boolean;
  /** Tarif şeridi: her zaman açık ya da yalnız ilk bölümlerde (1–5). */
  tarifSeridi: 'her' | 'ilk';
  /** Boşta ipucu. */
  ipuclari: boolean;
}

export interface Istatistik {
  oynanan: number;
  kazanilan: number;
  enUzunKaskat: number;
  lale: number;
}

export interface Kayit {
  surum: 1;
  bolumler: Record<string, BolumKaydi>;
  ogretim: { gorulenBalonlar: string[] };
  /** Deneme sonu ("Devamı yakında") ekranı bir kez kendiliğinden gösterildi. */
  devamiGoruldu: boolean;
  ayarlar: Ayarlar;
  istatistik: Istatistik;
}

export function varsayilanAyarlar(): Ayarlar {
  return { sfx: 0.8, muzik: 0.3, ortam: true, titresim: true, hareketiAzalt: null, hiz: 1, palet: 'standart', motifler: true, tarifSeridi: 'ilk', ipuclari: true };
}

export function varsayilanKayit(): Kayit {
  return {
    surum: 1,
    bolumler: {},
    ogretim: { gorulenBalonlar: [] },
    devamiGoruldu: false,
    ayarlar: varsayilanAyarlar(),
    istatistik: { oynanan: 0, kazanilan: 0, enUzunKaskat: 0, lale: 0 },
  };
}

export function bosBolumKaydi(): BolumKaydi {
  return { yildiz: 0, enIyi: 0, deneme: 0, basarisizSeri: 0, kazanildi: false, tablo: null };
}

// ─── Göç ve temizleme ──────────────────────────────────────────────────

const nesne = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const tamsayi = (x: unknown, enAz: number, enCok: number, yok: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(enAz, Math.min(enCok, Math.round(x))) : yok);
const oran = (x: unknown, yok: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : yok);
const mantik = (x: unknown, yok: boolean): boolean => (typeof x === 'boolean' ? x : yok);

const TEKNIKLER: readonly Teknik[] = ['battal', 'gelgit', 'tarakli', 'sal', 'bulbulYuvasi', 'cicek'];

function tabloTemizle(x: unknown): TabloKaydi | null {
  const o = nesne(x);
  if (!o || typeof o.gunluk !== 'string' || typeof o.tohum !== 'number') return null;
  if (gunlukCozGuvenli(o.gunluk) === null) return null;
  const t: TabloKaydi = {
    tohum: o.tohum >>> 0,
    gunluk: o.gunluk,
    nadirlik: tamsayi(o.nadirlik, 0, 2, 0) as Nadirlik,
    teknikler: Array.isArray(o.teknikler) ? (o.teknikler.filter((k) => TEKNIKLER.includes(k as Teknik)) as Teknik[]) : [],
    yildiz: tamsayi(o.yildiz, 0, 3, 1) as Yildiz,
    puan: tamsayi(o.puan, 0, 1e9, 0),
  };
  if (o.motif === 'lale' || o.motif === 'karanfil') t.motif = o.motif;
  return t;
}

function bolumTemizle(x: unknown): BolumKaydi | null {
  const o = nesne(x);
  if (!o) return null;
  const b: BolumKaydi = {
    yildiz: tamsayi(o.yildiz, 0, 3, 0) as Yildiz,
    enIyi: tamsayi(o.enIyi, 0, 1e9, 0),
    deneme: tamsayi(o.deneme, 0, 1e6, 0),
    basarisizSeri: tamsayi(o.basarisizSeri, 0, 1e6, 0),
    kazanildi: mantik(o.kazanildi, false),
    tablo: tabloTemizle(o.tablo),
  };
  // Eski/eksik kayıt: yıldızı olan bölüm kazanılmıştır.
  if (b.yildiz > 0) b.kazanildi = true;
  if (b.kazanildi && b.yildiz === 0) b.yildiz = 1;
  return b;
}

function ayarlarTemizle(x: unknown): Ayarlar {
  const v = varsayilanAyarlar();
  const o = nesne(x);
  if (!o) return v;
  return {
    sfx: oran(o.sfx, v.sfx),
    muzik: oran(o.muzik, v.muzik),
    ortam: mantik(o.ortam, v.ortam),
    titresim: mantik(o.titresim, v.titresim),
    hareketiAzalt: typeof o.hareketiAzalt === 'boolean' ? o.hareketiAzalt : null,
    hiz: o.hiz === 1.5 ? 1.5 : 1,
    palet: o.palet === 'renkKoru' ? 'renkKoru' : 'standart',
    motifler: mantik(o.motifler, v.motifler),
    tarifSeridi: o.tarifSeridi === 'her' ? 'her' : 'ilk',
    ipuclari: mantik(o.ipuclari, v.ipuclari),
  };
}

/**
 * Herhangi bir girdiyi geçerli bir `Kayit`e çevirir (göç + temizleme). Bilinmeyen
 * ya da bozuk alanlar varsayılana döner; ileride `surum` 2 gelirse burada
 * 1 → 2 göçü yapılır. Saf; girdiyi değiştirmez.
 */
export function kayitGoc(ham: unknown): Kayit {
  const k = varsayilanKayit();
  const o = nesne(ham);
  if (!o) return k;
  // Bilinmeyen (gelecekteki) sürüm: okunabilen alanları al.
  const b = nesne(o.bolumler);
  if (b) {
    for (const [id, x] of Object.entries(b)) {
      const n = Number(id);
      if (!Number.isInteger(n) || n < 1 || n > 999) continue;
      const bk = bolumTemizle(x);
      if (bk) k.bolumler[String(n)] = bk;
    }
  }
  const og = nesne(o.ogretim);
  if (og && Array.isArray(og.gorulenBalonlar)) k.ogretim.gorulenBalonlar = [...new Set(og.gorulenBalonlar.filter((s): s is string => typeof s === 'string'))].slice(0, 200);
  k.devamiGoruldu = mantik(o.devamiGoruldu, false);
  k.ayarlar = ayarlarTemizle(o.ayarlar);
  const ist = nesne(o.istatistik);
  if (ist) {
    k.istatistik = {
      oynanan: tamsayi(ist.oynanan, 0, 1e9, 0),
      kazanilan: tamsayi(ist.kazanilan, 0, 1e9, 0),
      enUzunKaskat: tamsayi(ist.enUzunKaskat, 0, 1000, 0),
      lale: tamsayi(ist.lale, 0, 1e9, 0),
    };
  }
  return k;
}

// ─── Temizlik günlüğü sıkıştırma (§9.1) ────────────────────────────────

const TURLER: readonly TemizlikKaydi['tur'][] = ['grup', 'tarak', 'girdap', 'lale', 'murekkep', 'birlesim'];

function kayitSigar(r: TemizlikKaydi): boolean {
  return (
    Number.isInteger(r.hamle) &&
    r.hamle >= -1 &&
    r.hamle <= 253 &&
    Number.isInteger(r.k) &&
    r.k >= 0 &&
    r.k <= 31 &&
    TURLER.includes(r.tur) &&
    [r.x10, r.y10, r.boyut].every((v) => Number.isInteger(v) && v >= 0 && v <= 255) &&
    Number.isInteger(r.renk) &&
    r.renk >= 0 &&
    r.renk <= 7
  );
}

function base64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function base64Coz(s: string): Uint8Array {
  const ham = atob(s);
  const b = new Uint8Array(ham.length);
  for (let i = 0; i < ham.length; i++) b[i] = ham.charCodeAt(i);
  return b;
}

/**
 * Günlük → metin. Kayıt başına 6 bayt (hamle+1, tür|k≪3, x10, y10,
 * renk|yön≪3, boyut) → "b" + base64. Sığmayan değer varsa (çok uzun kaskat
 * vb.) kayıpsız yedek: "j" + JSON. Her iki biçim de birebir geri döner.
 */
export function gunlukKodla(l: readonly TemizlikKaydi[]): string {
  if (!l.every(kayitSigar)) return 'j' + JSON.stringify(l);
  const b = new Uint8Array(l.length * 6);
  l.forEach((r, i) => {
    const o = i * 6;
    b[o] = r.hamle + 1;
    b[o + 1] = TURLER.indexOf(r.tur) | (r.k << 3);
    b[o + 2] = r.x10;
    b[o + 3] = r.y10;
    b[o + 4] = r.renk | ((r.yon === 'yatay' ? 1 : r.yon === 'dikey' ? 2 : 0) << 3);
    b[o + 5] = r.boyut;
  });
  return 'b' + base64(b);
}

export function gunlukCoz(s: string): TemizlikKaydi[] {
  const r = gunlukCozGuvenli(s);
  if (!r) throw new Error('günlük çözülemedi');
  return r;
}

/** Bozuk girdide null (kayıt temizleme bunu kullanır). */
export function gunlukCozGuvenli(s: string): TemizlikKaydi[] | null {
  try {
    if (s.startsWith('j')) {
      const l = JSON.parse(s.slice(1)) as unknown;
      return Array.isArray(l) ? (l as TemizlikKaydi[]) : null;
    }
    if (!s.startsWith('b')) return null;
    const b = base64Coz(s.slice(1));
    if (b.length % 6) return null;
    const l: TemizlikKaydi[] = [];
    for (let o = 0; o < b.length; o += 6) {
      const tur = TURLER[b[o + 1] & 7];
      if (!tur) return null;
      const yonK = (b[o + 4] >> 3) & 3;
      const r: TemizlikKaydi = { hamle: b[o] - 1, k: b[o + 1] >> 3, tur, x10: b[o + 2], y10: b[o + 3], renk: (b[o + 4] & 7) as TemizlikKaydi['renk'], boyut: b[o + 5] };
      if (yonK) r.yon = (yonK === 1 ? 'yatay' : 'dikey') as Yon;
      l.push(r);
    }
    return l;
  } catch {
    return null;
  }
}
