/**
 * Kayıt şeması (GDD §16.7): tip, varsayılan, sürüm göçü, doğrulama/onarım,
 * ilerleme puanı (`progressScore`) ve kayıt kodu (`FTL1:`).
 *
 * Depolama `src/platform/storage.ts` içindeki `SaveStore` ile yapılır:
 *
 *   const depo = new SaveStore<Kayit>(kayitDeposuAyarlari());
 *   const zarf = depo.loadLocal();
 *   const { kayit } = kayitCoz(zarf?.data, ilkTohum);   // göç + onarım
 *
 * Zarf sürümü (`ZARF_SURUMU`) sabittir; şema değişiklikleri `surum` alanı ve
 * `GOCLER` ile yapılır. Böylece SaveStore eski kaydı hiçbir zaman atmaz.
 *
 * Kayıt her zaman düz JSON'dur (sınıf, Map, undefined yok) — buluta ve koda
 * aynen yazılır.
 */
import { DESENLER, FITILLER, GOKYUZU, GUCLENDIRICI_STOK_SINIRI, GUCLENDIRICILER, MAHALLELER, EN_FAZLA_TAKILI_DESEN } from '../app/katalog';
import type { DesenId, FitilId, GokyuzuId, GuclendiriciId } from '../app/katalog';
import type { Palet } from '../app/sozlesme';
import { fnv1a, mulberry32Bir } from '../core/rng';
import type { Motif } from '../core/types';
import { base64Metin, metinBase64 } from './kodlama';
import {
  GUNLUK_GOREV_SAYISI,
  KAYIT_KODU_ONEKI,
  KAYIT_SURUMU,
  KAYIT_ANAHTARI,
  KOTU_SANS_SINIRI,
  ROZET_IDLERI,
  SERI_BASAMAKLARI,
  SONSUZ_TABANI,
  TOZ_TAVANI,
  VARSAYILAN_META_AYAR,
  ZARF_SURUMU,
  bolumTuru,
  mahalleBolumleri,
  mahalleSayisi,
  metaAyar,
} from './sabitler';
import type { MetaAyar, RozetId } from './sabitler';
import { tarihGecerli } from './takvim';

// ───────────────────────────── Tipler ─────────────────────────────

export type Yildiz = 0 | 1 | 2 | 3;
/** 0 Sade, 1 Parlak, 2 Şaheser (§10.3). */
export type Nadirlik = 0 | 1 | 2;
/** Koleksiyon parçası: `d:<desenId>:<0..2>` ya da `f:<fitilId>:<0..2>`. */
export type ParcaId = string;
/** Kart: `defter:<mahalleId>` (mahalle tamamlama) ya da `efsane:<mahalleId>` (mahallenin tamamı 3★). */
export type KartId = string;
export type MolaDakika = 0 | 30 | 45 | 60;

export interface BolumKaydi {
  /** Yıldız rekoru (0 = hiç kazanılmadı). Kazanılmış bölümde ≥ 1. */
  yildiz: Yildiz;
  /** En iyi kazanç puanı. */
  enIyi: number;
  /** Toplam deneme (her başlatılan oyun; Usta'nın Eli devamı ayrı sayılmaz). */
  deneme: number;
  /** Son kazançtan bu yana üst üste başarısızlık (Usta'nın Eli 4+). */
  basarisizSeri: number;
  /** Kazanç sayısı. */
  kazanc: number;
  /** Gece Tablosu (base64, §10.3) ve nadirliği. */
  tablo?: string;
  nadirlik?: Nadirlik;
}

export interface GorevDurumu {
  /** Şablon numarası 1..20 (§10.5 listesi). */
  sablon: number;
  /** Şablon 3 için renk (0..4). */
  renk?: number;
  ilerleme: number;
  hedef: number;
  tamam: boolean;
}

/** Günün Şenliği sonucu (paylaşım metnini yeniden üretmeye yeter). */
export interface GunlukSonucKaydi {
  puan: number;
  yildiz: Yildiz;
  kazandi: boolean;
  /** Kullanılan / toplam hamle. */
  kullanilan: number;
  toplam: number;
  /** En büyük reaksiyon (tek hamle R). */
  enBuyuk: number;
  /** Hamle başına simge dizisi (● ▲ ■). */
  izgara: string;
  /** O günün kaçıncı denemesi (1 tabanlı). */
  deneme: number;
}

export interface GunlukKaydi {
  /** Görevlerin günü (yyyymmdd); 0 = henüz seçilmedi. */
  tarih: number;
  gorevler: GorevDurumu[];
  /** Bugünün 3/3 görev parlak sandığı verildi mi. */
  ucGorevSandigi: boolean;
  /** yyyymmdd → o günün en iyi sonucu (son 30 gün). */
  enIyi: Record<string, GunlukSonucKaydi>;
  /** Günün Şenliği ilk kazanç sandığının verildiği son gün. */
  ilkKazanc: number;
  /** Fener Nöbeti (§10.5). */
  seri: number;
  enUzunSeri: number;
  /** Affın son kullanıldığı hafta (`haftaNo`); 0 = hiç. */
  affedilenHafta: number;
  /** Son oyun günü (yyyymmdd); 0 = hiç. */
  sonGun: number;
  /** Ödülü verilmiş en yüksek basamak indeksi (−1 = hiçbiri). Basamak ödülü yalnız ilk geçişte. */
  basamakOdulu: number;
}

export interface Rekorlar {
  enUzunZincir: number;
  enBuyukReaksiyon: number;
  enCokNesil: number;
  enIyiGunluk: number;
  enYuksekPuan: number;
}

export interface Istatistik {
  oyun: number;
  kazanc: number;
  kayip: number;
  toplamPatlama: number;
  toplamHalka: number;
  isiPatlamasi: number;
  roket: number;
  kasimpati: number;
  yildiz: number;
  kombinasyon: number;
  kafes: number;
  kaya: number;
  fener: number;
  devFisek: number;
  korukKullanim: number;
  ucYildiz: number;
  gunlukKazanc: number;
  sandik: number;
  parca: number;
}

export interface Ayarlar {
  /** Efekt sesi ve müzik kaydırıcıları 0..1. */
  sfx: number;
  muzik: number;
  ortam: boolean;
  titresim: boolean;
  /** null = otomatik (`prefers-reduced-motion`). */
  hareketiAzalt: boolean | null;
  /** Animasyon hızı: 1 Normal, 1.5 Hızlı. */
  hiz: 1 | 1.5;
  palet: Palet;
  ipuclari: boolean;
  /** 5 sn boşta parıltı ipucu (§15). */
  bostaIpucu: boolean;
  /** Mola hatırlatıcısı dakikası; 0 kapalı (§11 #30). */
  mola: MolaDakika;
}

export interface SandikBekleyen {
  tur: 'normal' | 'parlak';
  neden: SandikNedeni;
}
export type SandikNedeni = 'ilkKazanc' | 'yildiz' | 'gorev' | 'gunluk' | 'seri';

export interface Kayit {
  surum: typeof KAYIT_SURUMU;
  /** Sandık RNG'sinin tohumu (uint32): mulberry32(kayitTohumu ^ sayac). */
  kayitTohumu: number;
  /** Anahtar: bölüm kimliği (ana 1..N, Usta 101.., sonsuz 1 000 000+n). */
  bolumler: Record<string, BolumKaydi>;
  koleksiyon: {
    parcalar: ParcaId[];
    /** Takılı desenler (≤ 6, yalnız açık desenler). */
    takili: DesenId[];
    fitil: FitilId;
    gokyuzu: GokyuzuId;
    /** Mahalle tamamlamayla açılan gökyüzü temaları. Ay Işığı her zaman seçilebilir. */
    gokyuzuler: GokyuzuId[];
    motifler: Motif[];
    kartlar: KartId[];
  };
  toz: number;
  guclendiriciler: Record<GuclendiriciId, number>;
  /** Açılış hediyesi verilmiş güçlendiriciler (hediye bir kez). */
  hediyeler: GuclendiriciId[];
  sandik: {
    sayac: number;
    parcasizSeri: number;
    /** 5. bölümün garanti Kasımpatı parçası verildi mi. */
    kasimpatiVerildi: boolean;
    /** Sandık sistemi açılmadan kazanılan sandıklar (açılınca sırayla açılır). */
    bekleyen: SandikBekleyen[];
  };
  gunluk: GunlukKaydi;
  /** Coşku Serisi: üst üste ilk deneme kazancı. ≥ 3 iken sonraki bölüm hazır roketle başlar. */
  cosku: number;
  rekorlar: Rekorlar;
  rozetler: RozetId[];
  istatistik: Istatistik;
  ayarlar: Ayarlar;
  /** Görülen öğretici balonları ve çift dokunuş ipucu sayacı (§3.3: 3 kez). */
  ipuclari: { gorulen: string[]; ciftDokunus: number };
  /** Kazanılan en yüksek Sonsuz Şenlik bölümü (n). */
  sonsuzEnYuksek: number;
}

// ─────────────────────────── Varsayılan ───────────────────────────

export const VARSAYILAN_AYARLAR: Readonly<Ayarlar> = Object.freeze({
  sfx: 1,
  muzik: 0.6,
  ortam: true,
  titresim: true,
  hareketiAzalt: null,
  hiz: 1,
  palet: 'standart',
  ipuclari: true,
  bostaIpucu: true,
  mola: 45,
});

/** Başlangıçta sahip olunan parçalar: Palmiye ve Halka tam, Kasımpatı 2/3 (3. parça 5. bölümün sandığından). */
export const BASLANGIC_PARCALARI: readonly ParcaId[] = ['d:kasimpati:0', 'd:kasimpati:1', 'd:palmiye:0', 'd:palmiye:1', 'd:palmiye:2', 'd:halka:0', 'd:halka:1', 'd:halka:2'];
export const BASLANGIC_TAKILI: readonly DesenId[] = DESENLER.filter((d) => d.baslangicta).map((d) => d.id);
export const VARSAYILAN_GOKYUZU: GokyuzuId = 'ayIsigi';
export const VARSAYILAN_FITIL: FitilId = 'kenevir';

function bosRekorlar(): Rekorlar {
  return { enUzunZincir: 0, enBuyukReaksiyon: 0, enCokNesil: 0, enIyiGunluk: 0, enYuksekPuan: 0 };
}

function bosIstatistik(): Istatistik {
  return {
    oyun: 0,
    kazanc: 0,
    kayip: 0,
    toplamPatlama: 0,
    toplamHalka: 0,
    isiPatlamasi: 0,
    roket: 0,
    kasimpati: 0,
    yildiz: 0,
    kombinasyon: 0,
    kafes: 0,
    kaya: 0,
    fener: 0,
    devFisek: 0,
    korukKullanim: 0,
    ucYildiz: 0,
    gunlukKazanc: 0,
    sandik: 0,
    parca: 0,
  };
}

function bosGunluk(): GunlukKaydi {
  return { tarih: 0, gorevler: [], ucGorevSandigi: false, enIyi: {}, ilkKazanc: 0, seri: 0, enUzunSeri: 0, affedilenHafta: 0, sonGun: 0, basamakOdulu: -1 };
}

/**
 * Yeni kayıt. `tohum` ilk açılışta uygulamadan gelir (meta `Date`/`crypto`
 * kullanmaz); karıştırılarak `kayitTohumu` olur.
 */
export function yeniKayit(tohum: number): Kayit {
  return {
    surum: KAYIT_SURUMU,
    kayitTohumu: tohumKaristir(tohum),
    bolumler: {},
    koleksiyon: {
      parcalar: [...BASLANGIC_PARCALARI],
      takili: [...BASLANGIC_TAKILI],
      fitil: VARSAYILAN_FITIL,
      gokyuzu: VARSAYILAN_GOKYUZU,
      gokyuzuler: [],
      motifler: [],
      kartlar: [],
    },
    toz: 0,
    guclendiriciler: { kibrit: 0, kalip: 0, geriSar: 0 },
    hediyeler: [],
    sandik: { sayac: 0, parcasizSeri: 0, kasimpatiVerildi: false, bekleyen: [] },
    gunluk: bosGunluk(),
    cosku: 0,
    rekorlar: bosRekorlar(),
    rozetler: [],
    istatistik: bosIstatistik(),
    ayarlar: { ...VARSAYILAN_AYARLAR },
    ipuclari: { gorulen: [], ciftDokunus: 0 },
    sonsuzEnYuksek: 0,
  };
}

/** Dışarıdan gelen tohumu uint32'ye yayar (küçük ardışık tohumlar ilişkisiz olsun). */
export function tohumKaristir(tohum: number): number {
  const t = Number.isFinite(tohum) ? Math.trunc(tohum) >>> 0 : 0;
  return mulberry32Bir((t ^ 0x46544c31) >>> 0);
}

/** Derin kopya (kayıt düz JSON'dur). */
export function kayitKopyala(k: Kayit): Kayit {
  return JSON.parse(JSON.stringify(k)) as Kayit;
}

// ─────────────────────── Türetilmiş değerler ───────────────────────

export function bolumKaydi(k: Kayit, id: number): BolumKaydi | undefined {
  return k.bolumler[String(id)];
}

export function bolumKazanildi(k: Kayit, id: number): boolean {
  return (k.bolumler[String(id)]?.yildiz ?? 0) >= 1;
}

/** Ana yolda açık en yüksek bölüm: kazanılan en yüksek + 1 (en fazla N). Kilit doğrusaldır (§10.1). */
export function acikEnYuksek(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): number {
  let en = 0;
  for (const anahtar of Object.keys(k.bolumler)) {
    const id = Number(anahtar);
    if (bolumTuru(id, ayar) === 'ana' && k.bolumler[anahtar].yildiz >= 1 && id > en) en = id;
  }
  return Math.min(ayar.anaBolumSayisi, en + 1);
}

/** Ana bölümlerin yıldız toplamı (en fazla 3·N; Usta kilitleri buna bakar). */
export function anaYildiz(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): number {
  let s = 0;
  for (const anahtar of Object.keys(k.bolumler)) {
    if (bolumTuru(Number(anahtar), ayar) === 'ana') s += k.bolumler[anahtar].yildiz;
  }
  return s;
}

/** Ana + Usta yıldızları (ilerleme puanı ve harita başlığı). */
export function toplamYildiz(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): number {
  let s = 0;
  for (const anahtar of Object.keys(k.bolumler)) {
    const t = bolumTuru(Number(anahtar), ayar);
    if (t === 'ana' || t === 'usta') s += k.bolumler[anahtar].yildiz;
  }
  return s;
}

/** Ana yolun tamamı kazanıldı mı (Sonsuz Şenlik açılır, §10.7). */
export function sonsuzAcikMi(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): boolean {
  return bolumKazanildi(k, ayar.anaBolumSayisi);
}

/**
 * Bulut ile tarayıcı kaydı arasında "ilerisi kazanır" ölçütü:
 * toplam yıldız·1000 + açık en yüksek bölüm (Sonsuz Şenlik ilerlemesi eklenir).
 */
export function progressScore(k: Kayit, ayar: MetaAyar = VARSAYILAN_META_AYAR): number {
  const acik = acikEnYuksek(k, ayar) + (sonsuzAcikMi(k, ayar) ? 1 + k.sonsuzEnYuksek : 0);
  return toplamYildiz(k, ayar) * 1000 + acik;
}

/** `new SaveStore<Kayit>(kayitDeposuAyarlari())` için seçenekler. */
export function kayitDeposuAyarlari(ayar?: Partial<MetaAyar>): { key: string; version: number; progressScore: (d: Kayit) => number } {
  const a = metaAyar(ayar);
  return { key: KAYIT_ANAHTARI, version: ZARF_SURUMU, progressScore: (d) => progressScore(d, a) };
}

// ─────────────────────── Parça ve koleksiyon kimlikleri ───────────────────────

const DESEN_IDLERI = new Set<string>(DESENLER.map((d) => d.id));
const FITIL_IDLERI = new Set<string>(FITILLER.map((f) => f.id));
const GOKYUZU_IDLERI = new Set<string>(Object.keys(GOKYUZU));
const MOTIF_IDLERI = new Set<string>(['lale', 'kayik', 'mart', 'fener', 'carkifelek', 'burc']);
const MAHALLE_IDLERI = new Set<string>(MAHALLELER.map((m) => m.id));
const ROZET_KUMESI = new Set<string>(ROZET_IDLERI);
const GUC_IDLERI = GUCLENDIRICILER.map((g) => g.id);

export function parcaId(kategori: 'desen' | 'fitil', id: string, i: number): ParcaId {
  return `${kategori === 'desen' ? 'd' : 'f'}:${id}:${i}`;
}

export function parcaCoz(p: string): { kategori: 'desen' | 'fitil'; id: string; i: number } | null {
  const m = /^([df]):([A-Za-z]+):([0-2])$/.exec(p);
  if (!m) return null;
  const kategori = m[1] === 'd' ? 'desen' : 'fitil';
  if (kategori === 'desen' ? !DESEN_IDLERI.has(m[2]) : !FITIL_IDLERI.has(m[2])) return null;
  return { kategori, id: m[2], i: Number(m[3]) };
}

export function parcaGecerli(p: unknown): p is ParcaId {
  return typeof p === 'string' && parcaCoz(p) !== null;
}

export function kartGecerli(k: unknown): k is KartId {
  if (typeof k !== 'string') return false;
  const m = /^(defter|efsane):([A-Za-z]+)$/.exec(k);
  return !!m && MAHALLE_IDLERI.has(m[2]);
}

/** Desenin üç parçası da var mı. */
export function desenTamam(k: Kayit, id: DesenId): boolean {
  const s = new Set(k.koleksiyon.parcalar);
  return s.has(parcaId('desen', id, 0)) && s.has(parcaId('desen', id, 1)) && s.has(parcaId('desen', id, 2));
}

/** Desen kullanılabilir mi (takılabilir): baştan açık ya da tamam. */
export function desenAcik(k: Kayit, id: DesenId): boolean {
  return !!DESENLER.find((d) => d.id === id)?.baslangicta || desenTamam(k, id);
}

export function fitilTamam(k: Kayit, id: FitilId): boolean {
  const s = new Set(k.koleksiyon.parcalar);
  return s.has(parcaId('fitil', id, 0)) && s.has(parcaId('fitil', id, 1)) && s.has(parcaId('fitil', id, 2));
}

export function fitilAcik(k: Kayit, id: FitilId): boolean {
  return !!FITILLER.find((f) => f.id === id)?.baslangicta || fitilTamam(k, id);
}

export function gokyuzuAcik(k: Kayit, id: GokyuzuId): boolean {
  return id === VARSAYILAN_GOKYUZU || k.koleksiyon.gokyuzuler.includes(id);
}

// ───────────────────────────── Göç ─────────────────────────────

/**
 * Sürüm göçleri: `GOCLER[n]` n sürümündeki ham nesneyi n+1'e taşır. Göç
 * yalnız yapıyı dönüştürür; eksik/bozuk alanları sonra `kayitOnar` tamamlar.
 * Yeni sürümde buraya bir fonksiyon ekle ve testini yaz (§16.7).
 */
export const GOCLER: Record<number, (o: Record<string, unknown>) => Record<string, unknown>> = {
  /**
   * 1 → 2. Sürüm 1, GDD §16.7'deki taslak şemadır:
   *  - bölüm kaydında `kazanc` yok (yıldızdan türetilir);
   *  - kartlar mahalle kimliği olarak (`iskele`) tutulabilir → `defter:iskele`;
   *  - `gunluk.enIyi` gün → puan (sayı) → sonuç nesnesi;
   *  - görev biçimi tanımsızdı → görevler yeniden seçilir (tarih 0);
   *  - hediyeler, Kasımpatı garantisi ve seri basamak ödülü ilerlemeden türetilir
   *    (geçmişte verildiği varsayılır, ikinci kez verilmez);
   *  - açılan gökyüzü temaları tamamlanan mahallelerden türetilir.
   */
  1: (o) => {
    const ayar = VARSAYILAN_META_AYAR;
    const bolumler = nesne(o.bolumler);
    const yeniBolumler: Record<string, unknown> = {};
    for (const [anahtar, b] of Object.entries(bolumler)) {
      const bk = nesne(b);
      const yildiz = typeof bk.yildiz === 'number' ? bk.yildiz : 0;
      yeniBolumler[anahtar] = { ...bk, kazanc: typeof bk.kazanc === 'number' ? bk.kazanc : yildiz >= 1 ? 1 : 0 };
    }
    const kazanildi = (id: number) => {
      const b = nesne(bolumler[String(id)]);
      return typeof b.yildiz === 'number' && b.yildiz >= 1;
    };
    const kol = nesne(o.koleksiyon);
    const kartlar = Array.isArray(kol.kartlar) ? kol.kartlar.map((x) => (typeof x === 'string' && MAHALLE_IDLERI.has(x) ? `defter:${x}` : x)) : [];
    const gokyuzuler: string[] = [];
    for (let m = 0; m < mahalleSayisi(ayar); m++) {
      if (mahalleBolumleri(m, ayar).every(kazanildi)) gokyuzuler.push(MAHALLELER[m].gokyuzu);
    }
    let enYuksek = 0;
    for (let id = 1; id <= ayar.anaBolumSayisi; id++) if (kazanildi(id)) enYuksek = id;
    const acik = Math.min(ayar.anaBolumSayisi, enYuksek + 1);
    const hediyeler = GUCLENDIRICILER.filter((g) => acik >= g.acilis).map((g) => g.id);
    const g = nesne(o.gunluk);
    const enIyi: Record<string, unknown> = {};
    for (const [t, v] of Object.entries(nesne(g.enIyi))) {
      if (typeof v === 'number') enIyi[t] = { puan: v, yildiz: 0, kazandi: false, kullanilan: 0, toplam: 0, enBuyuk: 0, izgara: '', deneme: 1 };
      else enIyi[t] = v;
    }
    const seri = typeof g.seri === 'number' ? g.seri : 0;
    const s = nesne(o.sandik);
    return {
      ...o,
      surum: 2,
      bolumler: yeniBolumler,
      koleksiyon: { ...kol, kartlar, gokyuzuler },
      hediyeler,
      sandik: { ...s, kasimpatiVerildi: kazanildi(5), bekleyen: [] },
      gunluk: { ...g, tarih: 0, gorevler: [], enIyi, enUzunSeri: seri, basamakOdulu: seriBasamakIndeksi(seri), ilkKazanc: 0, ucGorevSandigi: false },
    };
  },
};

/** Seri değerinin basamak indeksi (−1 = basamak yok). */
export function seriBasamakIndeksi(seri: number): number {
  let b = -1;
  for (let i = 0; i < SERI_BASAMAKLARI.length; i++) if (seri >= SERI_BASAMAKLARI[i].esik) b = i;
  return b;
}

function nesne(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export interface GocSonucu {
  ham: Record<string, unknown>;
  /** Uygulanan göçler, ör. ['1→2']. */
  gocler: string[];
  /** Kayıt bu istemciden yeni bir sürümden geldi (en iyi çabayla okundu). */
  gelecekSurum: boolean;
}

/** Ham nesneyi güncel sürüme taşır. `surum` yoksa sürüm 1 (GDD taslağı) sayılır. */
export function kayitGoc(ham: Record<string, unknown>): GocSonucu {
  let o = ham;
  let surum = typeof o.surum === 'number' && Number.isInteger(o.surum) ? o.surum : 1;
  const gocler: string[] = [];
  if (surum > KAYIT_SURUMU) return { ham: { ...o, surum: KAYIT_SURUMU }, gocler, gelecekSurum: true };
  if (surum < 1) surum = 1;
  while (surum < KAYIT_SURUMU) {
    const f = GOCLER[surum];
    if (!f) break;
    o = f(o);
    gocler.push(`${surum}→${surum + 1}`);
    surum++;
  }
  return { ham: { ...o, surum: KAYIT_SURUMU }, gocler, gelecekSurum: false };
}

// ─────────────────────────── Onarım ───────────────────────────

export interface OnarimSonucu {
  kayit: Kayit;
  /** Varsayılana çekilen ya da düzeltilen alanlar (ör. 'toz', 'bolumler.7.yildiz'). */
  onarilan: string[];
}

/**
 * Doğrulama ve onarım: her alan tipine ve aralığına göre denetlenir; bozuk
 * olan varsayılana çekilir, kurtarılabilen korunur. Sonuç her zaman geçerli
 * bir `Kayit`tir. `yedekTohum`: kayitTohumu bozuksa kullanılacak tohum.
 */
export function kayitOnar(ham: unknown, yedekTohum = 0): OnarimSonucu {
  const onarilan: string[] = [];
  const o = nesne(ham);
  if (o !== ham) onarilan.push('(kök)');
  const v = yeniKayit(yedekTohum);
  const not = (yol: string) => onarilan.push(yol);

  // kayitTohumu
  if (typeof o.kayitTohumu === 'number' && Number.isInteger(o.kayitTohumu) && o.kayitTohumu >= 0 && o.kayitTohumu <= 0xffffffff) v.kayitTohumu = o.kayitTohumu;
  else not('kayitTohumu');

  // bolumler
  const bolumler = o.bolumler;
  if (bolumler !== undefined && nesne(bolumler) !== bolumler) not('bolumler');
  for (const [anahtar, b] of Object.entries(nesne(bolumler))) {
    const id = Number(anahtar);
    if (!/^[1-9]\d{0,8}$/.test(anahtar) || !Number.isSafeInteger(id)) {
      not(`bolumler.${anahtar}`);
      continue;
    }
    const bk = nesne(b);
    if (bk !== b) {
      not(`bolumler.${anahtar}`);
      continue;
    }
    const yol = `bolumler.${anahtar}`;
    const yildiz = tamsayi(bk.yildiz, 0, 3, 0, `${yol}.yildiz`, not) as Yildiz;
    const kayit: BolumKaydi = {
      yildiz,
      enIyi: tamsayi(bk.enIyi, 0, 1e9, 0, `${yol}.enIyi`, not),
      deneme: tamsayi(bk.deneme, 0, 1e9, 0, `${yol}.deneme`, not),
      basarisizSeri: tamsayi(bk.basarisizSeri, 0, 1e9, 0, `${yol}.basarisizSeri`, not),
      kazanc: tamsayi(bk.kazanc, 0, 1e9, yildiz >= 1 ? 1 : 0, `${yol}.kazanc`, not),
    };
    if (kayit.yildiz >= 1 && kayit.kazanc < 1) {
      kayit.kazanc = 1;
      not(`${yol}.kazanc`);
    }
    if (kayit.deneme < kayit.kazanc) {
      kayit.deneme = kayit.kazanc;
      not(`${yol}.deneme`);
    }
    if (bk.tablo !== undefined) {
      if (typeof bk.tablo === 'string' && tabloKoduGecerli(bk.tablo) && kayit.yildiz >= 1) {
        kayit.tablo = bk.tablo;
        kayit.nadirlik = tamsayi(bk.nadirlik, 0, 2, 0, `${yol}.nadirlik`, not) as Nadirlik;
      } else not(`${yol}.tablo`);
    }
    v.bolumler[anahtar] = kayit;
  }

  // koleksiyon
  const kol = nesne(o.koleksiyon);
  if (o.koleksiyon !== undefined && kol !== o.koleksiyon) not('koleksiyon');
  const parcalar = kumeFiltre(kol.parcalar, parcaGecerli, 'koleksiyon.parcalar', not);
  for (const p of BASLANGIC_PARCALARI) if (!parcalar.includes(p)) parcalar.push(p);
  v.koleksiyon.parcalar = parcalar;
  if (kol.takili !== undefined) {
    const takili = kumeFiltre(kol.takili, (x): x is DesenId => typeof x === 'string' && DESEN_IDLERI.has(x) && desenAcik(v, x as DesenId), 'koleksiyon.takili', not);
    if (takili.length > EN_FAZLA_TAKILI_DESEN) {
      takili.length = EN_FAZLA_TAKILI_DESEN;
      not('koleksiyon.takili');
    }
    v.koleksiyon.takili = takili;
  } else not('koleksiyon.takili');
  v.koleksiyon.motifler = kumeFiltre(kol.motifler, (x): x is Motif => typeof x === 'string' && MOTIF_IDLERI.has(x), 'koleksiyon.motifler', not);
  v.koleksiyon.kartlar = kumeFiltre(kol.kartlar, kartGecerli, 'koleksiyon.kartlar', not);
  v.koleksiyon.gokyuzuler = kumeFiltre(kol.gokyuzuler, (x): x is GokyuzuId => typeof x === 'string' && GOKYUZU_IDLERI.has(x), 'koleksiyon.gokyuzuler', not);
  if (typeof kol.fitil === 'string' && FITIL_IDLERI.has(kol.fitil) && fitilAcik(v, kol.fitil as FitilId)) v.koleksiyon.fitil = kol.fitil as FitilId;
  else not('koleksiyon.fitil');
  if (typeof kol.gokyuzu === 'string' && GOKYUZU_IDLERI.has(kol.gokyuzu) && gokyuzuAcik(v, kol.gokyuzu as GokyuzuId)) v.koleksiyon.gokyuzu = kol.gokyuzu as GokyuzuId;
  else not('koleksiyon.gokyuzu');

  // toz, güçlendiriciler, hediyeler
  v.toz = tamsayi(o.toz, 0, TOZ_TAVANI, 0, 'toz', not);
  const guc = nesne(o.guclendiriciler);
  if (guc !== o.guclendiriciler) not('guclendiriciler');
  for (const id of GUC_IDLERI) v.guclendiriciler[id] = tamsayi(guc[id], 0, GUCLENDIRICI_STOK_SINIRI, 0, `guclendiriciler.${id}`, not);
  v.hediyeler = kumeFiltre(o.hediyeler, (x): x is GuclendiriciId => typeof x === 'string' && (GUC_IDLERI as string[]).includes(x), 'hediyeler', not);

  // sandık
  const s = nesne(o.sandik);
  if (s !== o.sandik) not('sandik');
  v.sandik.sayac = tamsayi(s.sayac, 0, 0xffffffff, 0, 'sandik.sayac', not);
  v.sandik.parcasizSeri = tamsayi(s.parcasizSeri, 0, KOTU_SANS_SINIRI, 0, 'sandik.parcasizSeri', not);
  v.sandik.kasimpatiVerildi = mantiksal(s.kasimpatiVerildi, false, 'sandik.kasimpatiVerildi', not);
  if (Array.isArray(s.bekleyen)) {
    for (const b of s.bekleyen) {
      const bb = nesne(b);
      if ((bb.tur === 'normal' || bb.tur === 'parlak') && ['ilkKazanc', 'yildiz', 'gorev', 'gunluk', 'seri'].includes(bb.neden as string)) {
        if (v.sandik.bekleyen.length < 20) v.sandik.bekleyen.push({ tur: bb.tur, neden: bb.neden as SandikNedeni });
      } else not('sandik.bekleyen');
    }
  } else not('sandik.bekleyen');

  // günlük
  v.gunluk = gunlukOnar(o.gunluk, not);

  v.cosku = tamsayi(o.cosku, 0, 1e6, 0, 'cosku', not);

  // rekorlar ve istatistik: bilinen alanlar, negatif olmayan tamsayı
  const rek = nesne(o.rekorlar);
  for (const alan of Object.keys(v.rekorlar) as (keyof Rekorlar)[]) v.rekorlar[alan] = tamsayi(rek[alan], 0, 1e12, 0, `rekorlar.${alan}`, not);
  const ist = nesne(o.istatistik);
  for (const alan of Object.keys(v.istatistik) as (keyof Istatistik)[]) v.istatistik[alan] = tamsayi(ist[alan], 0, 1e12, 0, `istatistik.${alan}`, not);

  v.rozetler = kumeFiltre(o.rozetler, (x): x is RozetId => typeof x === 'string' && ROZET_KUMESI.has(x), 'rozetler', not);

  v.ayarlar = ayarlarOnar(o.ayarlar, not);

  const ip = nesne(o.ipuclari);
  if (o.ipuclari !== undefined && ip !== o.ipuclari) not('ipuclari');
  v.ipuclari.gorulen = kumeFiltre(ip.gorulen, (x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64, 'ipuclari.gorulen', not).slice(0, 200);
  v.ipuclari.ciftDokunus = tamsayi(ip.ciftDokunus, 0, 1000, 0, 'ipuclari.ciftDokunus', not);

  v.sonsuzEnYuksek = tamsayi(o.sonsuzEnYuksek, 0, 9_000_000 - SONSUZ_TABANI, 0, 'sonsuzEnYuksek', not);

  // Tutarlılık: en az bir desen takılı kalır (gökyüzü boş kalmasın); boşsa başlangıç takılıları.
  if (v.koleksiyon.takili.length === 0) {
    v.koleksiyon.takili = [...BASLANGIC_TAKILI];
    not('koleksiyon.takili');
  }
  return { kayit: v, onarilan: [...new Set(onarilan)] };
}

function gunlukOnar(ham: unknown, not: (y: string) => void): GunlukKaydi {
  const g = nesne(ham);
  if (ham !== undefined && g !== ham) not('gunluk');
  const v = bosGunluk();
  v.tarih = g.tarih === 0 || tarihGecerli(g.tarih) ? (g.tarih as number) : (not('gunluk.tarih'), 0);
  if (Array.isArray(g.gorevler) && g.gorevler.length <= GUNLUK_GOREV_SAYISI) {
    for (const x of g.gorevler) {
      const gx = nesne(x);
      const sablon = gx.sablon;
      if (typeof sablon !== 'number' || !Number.isInteger(sablon) || sablon < 1 || sablon > 20 || typeof gx.hedef !== 'number' || !(gx.hedef >= 1)) {
        not('gunluk.gorevler');
        v.gorevler = [];
        v.tarih = 0;
        break;
      }
      const hedef = Math.floor(gx.hedef);
      const gd: GorevDurumu = {
        sablon,
        ilerleme: tamsayi(gx.ilerleme, 0, hedef, 0, 'gunluk.gorevler.ilerleme', not),
        hedef,
        tamam: false,
      };
      gd.tamam = gd.ilerleme >= hedef;
      if (gx.renk !== undefined) gd.renk = tamsayi(gx.renk, 0, 5, 0, 'gunluk.gorevler.renk', not);
      v.gorevler.push(gd);
    }
  } else {
    if (g.gorevler !== undefined) not('gunluk.gorevler');
    v.tarih = 0;
  }
  if (v.gorevler.length === 0) v.tarih = 0;
  v.ucGorevSandigi = mantiksal(g.ucGorevSandigi, false, 'gunluk.ucGorevSandigi', not);
  for (const [t, x] of Object.entries(nesne(g.enIyi))) {
    if (!tarihGecerli(Number(t))) {
      not('gunluk.enIyi');
      continue;
    }
    const s = nesne(x);
    if (s !== x) {
      not('gunluk.enIyi');
      continue;
    }
    const izgara = typeof s.izgara === 'string' && /^[●▲■]*$/.test(s.izgara) && s.izgara.length <= 200 ? s.izgara : (not('gunluk.enIyi.izgara'), '');
    v.enIyi[t] = {
      puan: tamsayi(s.puan, 0, 1e9, 0, 'gunluk.enIyi.puan', not),
      yildiz: tamsayi(s.yildiz, 0, 3, 0, 'gunluk.enIyi.yildiz', not) as Yildiz,
      kazandi: mantiksal(s.kazandi, false, 'gunluk.enIyi.kazandi', not),
      kullanilan: tamsayi(s.kullanilan, 0, 1000, 0, 'gunluk.enIyi.kullanilan', not),
      toplam: tamsayi(s.toplam, 0, 1000, 0, 'gunluk.enIyi.toplam', not),
      enBuyuk: tamsayi(s.enBuyuk, 0, 1000, 0, 'gunluk.enIyi.enBuyuk', not),
      izgara,
      deneme: tamsayi(s.deneme, 1, 1e6, 1, 'gunluk.enIyi.deneme', not),
    };
  }
  v.ilkKazanc = g.ilkKazanc === 0 || tarihGecerli(g.ilkKazanc) ? (g.ilkKazanc as number) : (not('gunluk.ilkKazanc'), 0);
  v.seri = tamsayi(g.seri, 0, 100_000, 0, 'gunluk.seri', not);
  v.enUzunSeri = tamsayi(g.enUzunSeri, 0, 100_000, v.seri, 'gunluk.enUzunSeri', not);
  if (v.enUzunSeri < v.seri) {
    v.enUzunSeri = v.seri;
    not('gunluk.enUzunSeri');
  }
  v.affedilenHafta = tamsayi(g.affedilenHafta, 0, 1e7, 0, 'gunluk.affedilenHafta', not);
  v.sonGun = g.sonGun === 0 || tarihGecerli(g.sonGun) ? (g.sonGun as number) : (not('gunluk.sonGun'), 0);
  v.basamakOdulu = tamsayi(g.basamakOdulu, -1, SERI_BASAMAKLARI.length - 1, -1, 'gunluk.basamakOdulu', not);
  return v;
}

function ayarlarOnar(ham: unknown, not: (y: string) => void): Ayarlar {
  const a = nesne(ham);
  if (ham !== undefined && a !== ham) not('ayarlar');
  const v: Ayarlar = { ...VARSAYILAN_AYARLAR };
  const oran = (x: unknown, vars: number, yol: string) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1 ? x : (x !== undefined && not(yol), vars));
  v.sfx = oran(a.sfx, v.sfx, 'ayarlar.sfx');
  v.muzik = oran(a.muzik, v.muzik, 'ayarlar.muzik');
  v.ortam = mantiksal(a.ortam, v.ortam, 'ayarlar.ortam', not, true);
  v.titresim = mantiksal(a.titresim, v.titresim, 'ayarlar.titresim', not, true);
  if (a.hareketiAzalt === null || typeof a.hareketiAzalt === 'boolean') v.hareketiAzalt = a.hareketiAzalt;
  else if (a.hareketiAzalt !== undefined) not('ayarlar.hareketiAzalt');
  if (a.hiz === 1 || a.hiz === 1.5) v.hiz = a.hiz;
  else if (a.hiz !== undefined) not('ayarlar.hiz');
  if (a.palet === 'standart' || a.palet === 'renkKoru' || a.palet === 'yuksekKontrast') v.palet = a.palet;
  else if (a.palet !== undefined) not('ayarlar.palet');
  v.ipuclari = mantiksal(a.ipuclari, v.ipuclari, 'ayarlar.ipuclari', not, true);
  v.bostaIpucu = mantiksal(a.bostaIpucu, v.bostaIpucu, 'ayarlar.bostaIpucu', not, true);
  if (a.mola === 0 || a.mola === 30 || a.mola === 45 || a.mola === 60) v.mola = a.mola;
  else if (a.mola !== undefined) not('ayarlar.mola');
  return v;
}

function tamsayi(x: unknown, min: number, max: number, vars: number, yol: string, not: (y: string) => void): number {
  if (typeof x === 'number' && Number.isFinite(x)) {
    const t = Math.trunc(x);
    if (t === x && t >= min && t <= max) return t;
    not(yol);
    return Math.min(max, Math.max(min, t));
  }
  not(yol);
  return vars;
}

function mantiksal(x: unknown, vars: boolean, yol: string, not: (y: string) => void, eksikSessiz = false): boolean {
  if (typeof x === 'boolean') return x;
  if (!(eksikSessiz && x === undefined)) not(yol);
  return vars;
}

/** Diziyi süzer ve tekrarları atar; dizi değilse ya da öğe atıldıysa onarım not edilir. */
function kumeFiltre<T>(x: unknown, gecerli: (v: unknown) => v is T, yol: string, not: (y: string) => void): T[] {
  if (!Array.isArray(x)) {
    not(yol);
    return [];
  }
  const out: T[] = [];
  const gorulen = new Set<unknown>();
  for (const v of x) {
    if (gecerli(v) && !gorulen.has(v)) {
      gorulen.add(v);
      out.push(v);
    } else not(yol);
  }
  return out;
}

/** Gece Tablosu kodu biçim denetimi (base64, 4 baytlık kayıtlar, ≤ 250 kayıt). */
export function tabloKoduGecerli(s: string): boolean {
  if (s.length === 0 || s.length > 1400 || s.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return false;
  const bayt = (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
  return bayt % 4 === 0;
}

// ─────────────────────────── Yükleme ───────────────────────────

export interface KayitCozSonucu extends OnarimSonucu {
  gocler: string[];
  gelecekSurum: boolean;
  /** Ham veri yoktu ya da kullanılamazdı: yeni kayıt oluşturuldu. */
  yeni: boolean;
}

/**
 * Depodan gelen ham veri (zarfın `data`'sı ya da düz nesne / JSON metni) →
 * göç + onarım. Nesne değilse yeni kayıt döner (`yeni: true`).
 */
export function kayitCoz(ham: unknown, yedekTohum = 0): KayitCozSonucu {
  let o: unknown = ham;
  if (typeof o === 'string') {
    try {
      o = JSON.parse(o);
    } catch {
      o = null;
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    return { kayit: yeniKayit(yedekTohum), onarilan: [], gocler: [], gelecekSurum: false, yeni: true };
  }
  // SaveStore zarfı (`{ v, savedAt, progressScore, data }`) verildiyse içindeki veri kullanılır.
  const z = o as Record<string, unknown>;
  if ('data' in z && 'savedAt' in z && !('bolumler' in z)) return kayitCoz(z.data, yedekTohum);
  const g = kayitGoc(o as Record<string, unknown>);
  const r = kayitOnar(g.ham, yedekTohum);
  return { ...r, gocler: g.gocler, gelecekSurum: g.gelecekSurum, yeni: false };
}

/**
 * Ana kayıt ve yedekler (§16.7: `…v1`, `…v1.yedek1`, `…v1.yedek2`) sırayla
 * denenir; ilk çözülebilen kullanılır. `kaynak`: kullanılan adayın indeksi
 * (−1 = hiçbiri, yeni kayıt).
 */
export function kayitYukle(adaylar: readonly unknown[], yedekTohum = 0): KayitCozSonucu & { kaynak: number } {
  for (let i = 0; i < adaylar.length; i++) {
    const a = adaylar[i];
    if (a === null || a === undefined || a === '') continue;
    const r = kayitCoz(a, yedekTohum);
    if (!r.yeni) return { ...r, kaynak: i };
  }
  return { ...kayitCoz(null, yedekTohum), kaynak: -1 };
}

// ─────────────────────────── Kayıt kodu ───────────────────────────

/** 4 haneli onluk sağlama (gövdenin FNV-1a karmasından). */
export function kayitKoduSaglama(govde: string): string {
  return String(fnv1a(govde) % 10000).padStart(4, '0');
}

/**
 * Kayıt kodu: `FTL1:` + base64(JSON, UTF-8) + 4 haneli sağlama (§16.7).
 * `tablolarHaric`: Gece Tablolarını atar (kod kısalır; 40 tablo ≈ 70 KB).
 */
export function kayitKoduUret(k: Kayit, secenek: { tablolarHaric?: boolean } = {}): string {
  let veri: Kayit = k;
  if (secenek.tablolarHaric) {
    veri = kayitKopyala(k);
    for (const b of Object.values(veri.bolumler)) {
      delete b.tablo;
      delete b.nadirlik;
    }
  }
  const govde = metinBase64(JSON.stringify(veri));
  return `${KAYIT_KODU_ONEKI}${govde}${kayitKoduSaglama(govde)}`;
}

export type KayitKoduHatasi = 'bos' | 'onek' | 'saglama' | 'base64' | 'json' | 'sema';

export const KAYIT_KODU_HATA_METINLERI: Record<KayitKoduHatasi, string> = {
  bos: 'Kod boş. Kayıt kodunu yapıştır.',
  onek: 'Bu bir FİTİL kayıt kodu değil (FTL1: ile başlamalı).',
  saglama: 'Kod eksik ya da bozuk kopyalanmış. Tamamını yeniden kopyala.',
  base64: 'Kodda geçersiz karakter var.',
  json: 'Kod çözülemedi.',
  sema: 'Kodun içinde kayıt bulunamadı.',
};

/** İçe aktarma önizlemesi (onaydan önce gösterilir). */
export interface KayitOnizleme {
  /** Ana yol yıldızı / tavanı ("37/120"); Usta yıldızı ayrı. */
  anaYildiz: number;
  enFazlaYildiz: number;
  ustaYildiz: number;
  /** Açık en yüksek ana bölüm ve mahallesi. */
  acikBolum: number;
  mahalle: string;
  kazanilanBolum: number;
  rozet: number;
  /** Tamamlanan desen / toplam desen. */
  desen: number;
  desenToplam: number;
  tablo: number;
  toz: number;
  seri: number;
  sonsuz: number;
  /** Kayıtta onarılan alan sayısı (0 = temiz). */
  onarilan: number;
}

export type KayitKoduSonucu = { tamam: true; kayit: Kayit; onizleme: KayitOnizleme; onarilan: string[]; gocler: string[] } | { tamam: false; hata: KayitKoduHatasi; mesaj: string };

/**
 * Kayıt kodunu doğrular ve çözer. Boşluk ve satır sonları yok sayılır
 * (WhatsApp kodu bölebilir). Başarılıysa önizleme özeti döner; uygulama
 * oyuncuya onaylatıp kaydı yerine koyar.
 */
export function kayitKoduCoz(kod: string, ayar?: Partial<MetaAyar>): KayitKoduSonucu {
  const hata = (h: KayitKoduHatasi): KayitKoduSonucu => ({ tamam: false, hata: h, mesaj: KAYIT_KODU_HATA_METINLERI[h] });
  const temiz = (kod ?? '').replace(/\s+/g, '');
  if (!temiz) return hata('bos');
  if (!temiz.toUpperCase().startsWith(KAYIT_KODU_ONEKI)) return hata('onek');
  const icerik = temiz.slice(KAYIT_KODU_ONEKI.length);
  if (icerik.length < 5) return hata('saglama');
  const govde = icerik.slice(0, -4);
  const saglama = icerik.slice(-4);
  if (kayitKoduSaglama(govde) !== saglama) return hata('saglama');
  const metin = base64Metin(govde);
  if (metin === null) return hata('base64');
  let o: unknown;
  try {
    o = JSON.parse(metin);
  } catch {
    return hata('json');
  }
  if (!o || typeof o !== 'object' || Array.isArray(o) || !('bolumler' in o)) return hata('sema');
  const r = kayitCoz(o);
  return { tamam: true, kayit: r.kayit, onizleme: kayitOnizleme(r.kayit, r.onarilan.length, ayar), onarilan: r.onarilan, gocler: r.gocler };
}

export function kayitOnizleme(k: Kayit, onarilan = 0, ayarK?: Partial<MetaAyar>): KayitOnizleme {
  const ayar = metaAyar(ayarK);
  const acik = acikEnYuksek(k, ayar);
  const m = Math.min(mahalleSayisi(ayar) - 1, Math.floor((acik - 1) / ayar.bolumPerMahalle));
  let kazanilan = 0;
  let tablo = 0;
  for (const [anahtar, b] of Object.entries(k.bolumler)) {
    if (bolumTuru(Number(anahtar), ayar) === 'ana' && b.yildiz >= 1) kazanilan++;
    if (b.tablo) tablo++;
  }
  return {
    anaYildiz: anaYildiz(k, ayar),
    enFazlaYildiz: ayar.anaBolumSayisi * 3,
    ustaYildiz: toplamYildiz(k, ayar) - anaYildiz(k, ayar),
    acikBolum: acik,
    mahalle: MAHALLELER[Math.max(0, m)].ad,
    kazanilanBolum: kazanilan,
    rozet: k.rozetler.length,
    desen: DESENLER.filter((d) => desenTamam(k, d.id)).length,
    desenToplam: DESENLER.length,
    tablo,
    toz: k.toz,
    seri: k.gunluk.seri,
    sonsuz: k.sonsuzEnYuksek,
    onarilan,
  };
}

// ─────────────────────────── Ayar ve ipucu yardımcıları ───────────────────────────

/** Ayar değişikliği (doğrulanır; geçersiz alan eski değerinde kalır). */
export function ayarDegistir(k: Kayit, degisiklik: Partial<Ayarlar>): Kayit {
  const y = kayitKopyala(k);
  const birlesik = { ...y.ayarlar, ...degisiklik };
  const sessiz = () => undefined;
  const yeni = ayarlarOnar(birlesik, sessiz);
  // Geçersiz değer varsayılana değil, önceki değere dönsün.
  for (const anahtar of Object.keys(degisiklik) as (keyof Ayarlar)[]) {
    const tek = ayarlarOnar({ ...VARSAYILAN_AYARLAR, [anahtar]: degisiklik[anahtar] }, sessiz);
    if (tek[anahtar] !== degisiklik[anahtar]) (yeni as unknown as Record<string, unknown>)[anahtar] = y.ayarlar[anahtar];
  }
  y.ayarlar = yeni;
  return y;
}

/** Öğretici balonu görüldü (Ayarlar > İpuçları > "Balonları yeniden izle" listeyi boşaltır). */
export function ipucuGoruldu(k: Kayit, id: string): Kayit {
  if (!id || id.length > 64 || k.ipuclari.gorulen.includes(id)) return k;
  const y = kayitKopyala(k);
  y.ipuclari.gorulen = [...y.ipuclari.gorulen, id].slice(-200);
  return y;
}

/** "Ateşlemek için tekrar dokun" ipucu yalnız 3 kez gösterilir (§3.3). */
export const CIFT_DOKUNUS_IPUCU_SINIRI = 3;
export function ciftDokunusIpucuGoster(k: Kayit): boolean {
  return k.ipuclari.ciftDokunus < CIFT_DOKUNUS_IPUCU_SINIRI;
}
export function ciftDokunusIpucuSay(k: Kayit): Kayit {
  const y = kayitKopyala(k);
  y.ipuclari.ciftDokunus = Math.min(1000, y.ipuclari.ciftDokunus + 1);
  return y;
}

/** Balonları yeniden izle. */
export function ipuclariniSifirla(k: Kayit): Kayit {
  const y = kayitKopyala(k);
  y.ipuclari = { gorulen: [], ciftDokunus: 0 };
  return y;
}

/**
 * İlerlemeyi sıfırla (iki aşamalı onayı arayüz yapar): ayarlar korunur, geri
 * kalan her şey yeni kayıt. `yeniTohum` dışarıdan gelir.
 */
export function ilerlemeyiSifirla(k: Kayit, yeniTohum: number): Kayit {
  const y = yeniKayit(yeniTohum);
  y.ayarlar = { ...k.ayarlar };
  return y;
}
