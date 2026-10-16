/**
 * Bölüm Mühürleri (docs/KANCALAR.md Bölüm A): 6–40. bölümlerde bölüm başına
 * üç isteğe bağlı görev — Çırak, Kalfa, Usta. Saf, belirlenimli, DOM'suz.
 *
 * Kurallar (KANCALAR §A.1):
 *  - Mühür yalnız KAZANILAN oyunda basılır, yıldızdan bağımsızdır.
 *  - Üç mühür ayrı denemelerde toplanabilir (kayıtta 3 bitlik maske).
 *  - Kıvılcım Usta'nın Eli ile kazanılan oyunda mühür basılmaz.
 *  - Koşullar tek oyun içinde ölçülür (oyunlar arasında birikmez); final
 *    gösterisi sayılmaz (`HamleIzi` finalde eklenmez).
 *  - 6. bölüm kazanılınca tanıtılır; o oyuna geriye dönük uygulanır.
 *
 * Tanımlar bölüm JSON'unda durur (`BolumVerisi.muhurler`, sıra Çırak,
 * Kalfa, Usta). Koşul dili (KANCALAR §A.3):
 *
 *   { "olcu": "R", "kapsam": "hamle", "enAz": 15, "halka": true }
 *     → "Halkayla tek hamlede 15+ reaksiyon"
 *   { "olcu": "koruk", "kapsam": "oyun", "enCok": 0 }
 *     → "Körük kullanmadan kazan"
 *
 * Akış (uygulama):
 *   let oz = ozetBaslat(); oz = ozetHamle(oz, olaylar, { hamle, onceki });
 *   const anlik = muhurAnlik(v, muhurOzeti(oz, d));       // HUD rozeti (●●○)
 *   const bas = muhurleriDegerlendir(v, muhurOzeti(oz, d)); // kazanç: [ç, k, u]
 */
import type { BolumVerisi, KomboTuru, MuhurKapsami, MuhurKosulu, MuhurOlcusu, OyunDurumu } from '../core/types';

export type { MuhurEylemi, MuhurKapsami, MuhurKosulu, MuhurOlcusu } from '../core/types';
import type { HamleIzi, OyunOzeti } from './ozet';

// ───────────────────────────── Sabitler ─────────────────────────────

export type MuhurKademe = 'cirak' | 'kalfa' | 'usta';
/** Sıra kayıttaki bit sırasıdır (bit 0 Çırak, 1 Kalfa, 2 Usta). DEĞİŞTİRME. */
export const MUHUR_KADEMELERI: readonly MuhurKademe[] = ['cirak', 'kalfa', 'usta'];
export const MUHUR_KADEME_ADLARI: Readonly<Record<MuhurKademe, string>> = { cirak: 'Çırak', kalfa: 'Kalfa', usta: 'Usta' };
/** Mühürlü ilk bölüm; bu bölümün ilk kazancında mühürler tanıtılır. */
export const MUHUR_ACILIS_BOLUMU = 6;
/** Mühürlü son ana bölüm. */
export const MUHUR_SON_BOLUM = 40;
/** Bölüm başına mühür. */
export const MUHUR_SAYISI = 3;
/** Kayıttaki maskenin üst sınırı (3 bit). */
export const MUHUR_MASKE_TAVANI = 7;
/** Bir mahallede bu mühür sayılarında fitil görünümü parçası (KANCALAR §A.6). */
export const MUHUR_PARCA_ESIKLERI = [5, 10, 15] as const;

// ─────────────────────────── Koşul dili ───────────────────────────

export const OLCU_KAPSAMLARI: Readonly<Record<MuhurOlcusu, readonly MuhurKapsami[]>> = {
  patlama: ['oyun', 'hamle'],
  isiPatlamasi: ['oyun', 'hamle'],
  halka: ['oyun'],
  olusum: ['oyun'],
  ozelAtes: ['oyun', 'hamle'],
  caprazRoket: ['oyun', 'hamle'],
  kombo: ['oyun', 'hamle'],
  kafes: ['oyun', 'hamle'],
  kaya: ['oyun', 'hamle'],
  engelHasar: ['oyun', 'hamle'],
  doseme: ['oyun', 'hamle'],
  desen: ['oyun', 'hamle'],
  is: ['oyun', 'hamle'],
  fener: ['oyun', 'hamle'],
  devFisek: ['oyun', 'hamle'],
  izliDevFisek: ['oyun', 'hamle'],
  caprazEngel: ['oyun', 'hamle'],
  kurutma: ['oyun', 'hamle'],
  koruk: ['oyun'],
  guclendirici: ['oyun'],
  R: ['hamle'],
  nesil: ['hamle'],
  zincir: ['hamle'],
  kisaZincir: ['oyun'],
  kalanHamle: ['son'],
};

/** Bölüm verisindeki üçlü: [Çırak, Kalfa, Usta]. */
export type MuhurUclusu = readonly [MuhurKosulu, MuhurKosulu, MuhurKosulu];

// ──────────────────────────── Özet ────────────────────────────

/**
 * Mühür değerlendirmesinin girdisi: meta olay özetinden (`OyunOzeti`)
 * türer; kazanç bağlamı çekirdek durumundan eklenir.
 */
export interface MuhurOzeti extends Pick<OyunOzeti, 'hamleIzleri'> {
  kazandi: boolean;
  /** Kazanç anında (final öncesi) kalan hamle; oyun sürerken güncel kalan. */
  kalanHamle: number;
  /** Kıvılcım Usta'nın Eli kullanıldı (mühür yok). */
  ustaEli: boolean;
  /** Kullanılan güçlendirici (Kibrit, Kalıp, Geri Sar). */
  guclendirici: number;
}

/**
 * Özet + durum → mühür özeti. Kazançta FİNAL ÖNCESİ durumu ver (final
 * gösterisi kalan hamleyi 0'a indirir).
 */
export function muhurOzeti(oz: Pick<OyunOzeti, 'hamleIzleri'>, d: Pick<OyunDurumu, 'bitti' | 'kalanHamle' | 'istatistik'>): MuhurOzeti {
  return {
    hamleIzleri: oz.hamleIzleri ?? [],
    kazandi: d.bitti === 'kazanc',
    kalanHamle: d.kalanHamle,
    ustaEli: d.istatistik.ustaEli === true,
    guclendirici: d.istatistik.guclendirici ?? 0,
  };
}

// ─────────────────────────── Değerlendirme ───────────────────────────

/**
 * "Tek hamle" (kapsam `hamle`) = tek oyuncu eylemi: fitil, çift dokunuş ya da
 * Körük. Güçlendirici eylemleri (Kibrit, Kalıp) tek hamle sayılmaz; oyun
 * toplamına (kapsam `oyun`) girer.
 */
function izSuzgeci(k: MuhurKosulu, iz: HamleIzi): boolean {
  if (k.kapsam === 'hamle' && (iz.eylem === 'kibrit' || iz.eylem === 'kalip')) return false;
  if (k.halka !== undefined && iz.halka !== k.halka) return false;
  if (k.eylem !== undefined && iz.eylem !== k.eylem) return false;
  if (k.olcu === 'zincir' && k.renk !== undefined && iz.renk !== k.renk) return false;
  return true;
}

/** Tek bir izin ölçü değeri (süzgeçler uygulanmış). */
function izDegeri(k: MuhurKosulu, iz: HamleIzi): number {
  switch (k.olcu) {
    case 'patlama':
      return k.renk !== undefined ? (iz.renkPatlama[k.renk] ?? 0) : iz.patlama;
    case 'isiPatlamasi':
      return iz.isiPatlamasi;
    case 'halka':
      return iz.eylem === 'fitil' && iz.halka ? 1 : 0;
    case 'olusum':
      return iz.olusan !== 'yok' && (k.ozel === undefined || iz.olusan === k.ozel) ? 1 : 0;
    case 'ozelAtes':
      return k.ozel === 'roket' ? iz.roket : k.ozel === 'kasimpati' ? iz.kasimpati : k.ozel === 'yildiz' ? iz.yildiz : iz.roket + iz.kasimpati + iz.yildiz;
    case 'caprazRoket':
      return iz.caprazRoket;
    case 'kombo':
      return k.kombo !== undefined ? iz.kombolar.filter((x) => x === k.kombo).length : iz.kombolar.length;
    case 'kafes':
    case 'kaya':
    case 'engelHasar':
    case 'doseme':
    case 'desen':
    case 'is':
    case 'fener':
    case 'devFisek':
    case 'izliDevFisek':
    case 'caprazEngel':
    case 'kurutma':
      return iz[k.olcu];
    case 'koruk':
      return iz.eylem === 'koruk' ? 1 : 0;
    case 'R':
      return iz.R;
    case 'nesil':
      return iz.nesil;
    case 'zincir':
      return iz.eylem === 'fitil' ? iz.zincir : 0;
    case 'kisaZincir':
      return iz.eylem === 'fitil' && iz.zincir <= 3 ? 1 : 0;
    default:
      return 0;
  }
}

/** Koşulun ölçülen değeri (toplam, tek eylemde en büyük ya da son durum). */
export function muhurDegeri(k: MuhurKosulu, oz: MuhurOzeti): number {
  if (k.kapsam === 'son') return k.olcu === 'kalanHamle' ? oz.kalanHamle : 0;
  if (k.olcu === 'guclendirici') return oz.guclendirici;
  let toplam = 0;
  let enBuyuk = 0;
  for (const iz of oz.hamleIzleri) {
    if (!izSuzgeci(k, iz)) continue;
    const v = izDegeri(k, iz);
    toplam += v;
    if (v > enBuyuk) enBuyuk = v;
  }
  return k.kapsam === 'hamle' ? enBuyuk : toplam;
}

/** Koşul bu özet için sağlanıyor mu (kazanç denetimi ayrı). */
export function muhurKosuluSaglandi(k: MuhurKosulu, oz: MuhurOzeti): boolean {
  const v = muhurDegeri(k, oz);
  if (k.enAz !== undefined && v < k.enAz) return false;
  if (k.enCok !== undefined && v > k.enCok) return false;
  return true;
}

/**
 * Biten oyunun mühürleri [Çırak, Kalfa, Usta]: yalnız kazançta ve Usta'nın
 * Eli kullanılmadıysa. Bölümde mühür yoksa hepsi false.
 */
export function muhurleriDegerlendir(v: Pick<BolumVerisi, 'muhurler'>, oz: MuhurOzeti): [boolean, boolean, boolean] {
  const m = v.muhurler;
  if (!m || m.length !== MUHUR_SAYISI || !oz.kazandi || oz.ustaEli) return [false, false, false];
  return [muhurKosuluSaglandi(m[0], oz), muhurKosuluSaglandi(m[1], oz), muhurKosuluSaglandi(m[2], oz)];
}

/**
 * Oyun sürerken mühürün durumu (HUD rozeti, Duraklat listesi):
 *  - 'tuttu'      enAz koşulu sağlandı (artık bozulamaz; kazanınca basılır)
 *  - 'bekliyor'   enAz koşulu henüz sağlanmadı
 *  - 'korunuyor'  enCok kısıtı şimdilik tutuyor (kazanınca basılır)
 *  - 'bozuldu'    enCok kısıtı aşıldı (bu denemede basılamaz)
 *  - 'sonda'      kalan hamle gibi kazanç anında ölçülen koşul
 * Usta'nın Eli devamında hepsi 'bozuldu'.
 */
export type MuhurAnlikDurumu = 'tuttu' | 'bekliyor' | 'korunuyor' | 'bozuldu' | 'sonda';

export function muhurAnlik(v: Pick<BolumVerisi, 'muhurler'>, oz: MuhurOzeti): MuhurAnlikDurumu[] {
  const m = v.muhurler;
  if (!m) return [];
  return m.map((k) => {
    if (oz.ustaEli) return 'bozuldu';
    if (k.kapsam === 'son') return 'sonda';
    const ok = muhurKosuluSaglandi(k, oz);
    if (k.enCok !== undefined) return ok ? 'korunuyor' : 'bozuldu';
    return ok ? 'tuttu' : 'bekliyor';
  });
}

/**
 * Mühür arayüzü (bölüm öncesi satırları, HUD rozeti, Duraklat) yalnız 6.
 * bölüm kazanılmışsa görünür (KANCALAR §A.2). 6. bölümün ilk oyununda
 * değerlendirme sessizce yapılır, kazanınca Kazandın'da tanıtılır.
 */
export function muhurlerGorunur(k: { bolumler: Record<string, { yildiz: number } | undefined> }): boolean {
  return (k.bolumler[String(MUHUR_ACILIS_BOLUMU)]?.yildiz ?? 0) >= 1;
}

// ─────────────────────────── Kayıt maskesi ───────────────────────────

/** Maske → [Çırak, Kalfa, Usta]. */
export function muhurMaskeCoz(maske: number | undefined): [boolean, boolean, boolean] {
  const m = (maske ?? 0) & MUHUR_MASKE_TAVANI;
  return [(m & 1) !== 0, (m & 2) !== 0, (m & 4) !== 0];
}

/** [Çırak, Kalfa, Usta] → maske. */
export function muhurMaskesi(b: readonly boolean[]): number {
  return (b[0] ? 1 : 0) | (b[1] ? 2 : 0) | (b[2] ? 4 : 0);
}

/** Maskedeki mühür sayısı (0..3). */
export function muhurSayisi(maske: number | undefined): number {
  const m = (maske ?? 0) & MUHUR_MASKE_TAVANI;
  return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
}

/** Eski maske + bu oyunun sonucu → yeni maske ve yeni basılan kademeler. */
export function muhurBirlestir(eski: number | undefined, bu: readonly boolean[]): { maske: number; yeni: MuhurKademe[] } {
  const once = muhurMaskeCoz(eski);
  const yeni: MuhurKademe[] = [];
  MUHUR_KADEMELERI.forEach((kd, i) => {
    if (bu[i] && !once[i]) yeni.push(kd);
  });
  return { maske: muhurMaskesi(once.map((x, i) => x || !!bu[i])), yeni };
}

// ─────────────────────────── Metin ───────────────────────────

const RENK_ADI = ['kızıl', 'kehribar', 'zümrüt', 'gök', 'mor', 'gül'] as const;
const OZEL_ADI = { roket: 'roket', kasimpati: 'kasımpatı', yildiz: 'yıldız topu' } as const;
export const KOMBO_ADLARI: Readonly<Record<KomboTuru, string>> = {
  yildizHatti: 'Yıldız Hattı',
  kalinRoket: 'Kalın Roket',
  devKasimpati: 'Dev Kasımpatı',
  roketYagmuru: 'Roket Yağmuru',
  bahce: 'Bahçe',
  buyukFinal: 'Büyük Final',
};

/**
 * Koşulun tek satırlık Türkçe metni (bölüm öncesi kartı, Duraklat,
 * Kazandın). `metin` alanı verilmişse o kullanılır.
 */
export function muhurMetni(k: MuhurKosulu): string {
  if (k.metin) return k.metin;
  const n = k.enAz ?? 0;
  const tek = k.kapsam === 'hamle';
  const th = tek ? 'Tek hamlede ' : '';
  if (k.enCok !== undefined) {
    const hic = k.enCok === 0;
    switch (k.olcu) {
      case 'koruk':
        return hic ? 'Körük kullanmadan kazan' : `Körük'ü en çok ${k.enCok} kez kullan`;
      case 'guclendirici':
        return hic ? 'Güçlendirici kullanmadan kazan' : `En çok ${k.enCok} güçlendirici kullan`;
      case 'kisaZincir':
        return hic ? "Hiç 3'lük zincir çizmeden kazan" : `En çok ${k.enCok} kez 3'lük zincir çiz`;
      case 'halka':
        return hic ? 'Halka çizmeden kazan' : `En çok ${k.enCok} halka çiz`;
      default:
        return `${olcuAdi(k)}: en çok ${k.enCok}`;
    }
  }
  switch (k.olcu) {
    case 'R':
      if (k.eylem === 'koruk') return `Körükle ${n}+ reaksiyon yap`;
      if (k.halka) return `Halkayla ${n}+ reaksiyon yap`;
      return `Tek hamlede ${n}+ reaksiyon yap`;
    case 'nesil':
      return `${n}. nesil bir patlama yap`;
    case 'zincir':
      if (k.halka) return `${n}+ düğümlü bir halka kapat`;
      if (k.renk !== undefined) return `${n}+ düğümlü ${RENK_ADI[k.renk]} zincir çiz`;
      return `${n}+ düğümlü bir zincir çiz`;
    case 'kalanHamle':
      return `${n} hamle kala kazan`;
    case 'halka':
      return n === 1 ? 'Bir halka çiz' : `${n} halka çiz`;
    case 'patlama':
      return k.renk !== undefined ? `${th}${n} ${RENK_ADI[k.renk]} patlat` : `${th}${n} kapsül patlat`;
    case 'isiPatlamasi':
      return tek ? `Tek hamlede ${n} ısı patlaması yap` : `${n} kapsülü ısıyla patlat`;
    case 'olusum':
      return `${n === 1 ? 'Bir' : n} ${k.ozel ? OZEL_ADI[k.ozel] : 'özel taş'} yap`;
    case 'ozelAtes':
      return `${th}${n === 1 && !tek ? 'Bir' : n} ${k.ozel ? OZEL_ADI[k.ozel] : 'özel taş'} ateşle`;
    case 'caprazRoket':
      return `${th}${n} çapraz roket ateşle`;
    case 'kombo':
      if (k.kombo) return n <= 1 ? `${KOMBO_ADLARI[k.kombo]} yap` : `${n} ${KOMBO_ADLARI[k.kombo]} yap`;
      return n <= 1 ? `${th}Bir kombinasyon yap` : `${th}${n} kombinasyon yap`;
    case 'kafes':
      return `${th}${n} kafes kır`;
    case 'kaya':
      return `${th}${n} kaya yok et`;
    case 'engelHasar':
      return `${th}${n} kez engel vur`;
    case 'doseme':
      return `${th}${n} döşeme aydınlat`;
    case 'desen':
      return `${th}${n} desen karosu boya`;
    case 'is':
      return `${th}${n} is temizle`;
    case 'fener':
      return `${th}${n} fener indir`;
    case 'devFisek':
      return `${th}${n} dev fişek ateşle`;
    case 'izliDevFisek':
      return n === 1 ? 'Barut iziyle dev fişek ateşle' : `Barut iziyle ${n} dev fişek ateşle`;
    case 'caprazEngel':
      return n === 1 ? 'Çapraz roketle bir engel vur' : `Çapraz roketle ${n} engel vur`;
    case 'kurutma':
      return `${th}${n} ıslak barutu kurut`;
    case 'koruk':
      return n === 1 ? "Körük'ü kullan" : `Körük'ü ${n} kez kullan`;
    default:
      return olcuAdi(k);
  }
}

function olcuAdi(k: MuhurKosulu): string {
  return k.olcu;
}

// ─────────────────────────── Doğrulama ───────────────────────────

const RENKLI = new Set<MuhurOlcusu>(['patlama', 'zincir']);
const OZELLI = new Set<MuhurOlcusu>(['olusum', 'ozelAtes']);
const HALKALI = new Set<MuhurOlcusu>(['R', 'zincir', 'nesil', 'patlama', 'isiPatlamasi']);
const EYLEMLI = new Set<MuhurOlcusu>(['R', 'nesil', 'patlama', 'isiPatlamasi', 'ozelAtes', 'kafes', 'kaya', 'doseme', 'desen', 'is', 'devFisek']);
const KOMBOLAR = new Set<string>(Object.keys(KOMBO_ADLARI));
/** Metin üst sınırı: 360 px kartta tek satır. */
export const MUHUR_METIN_SINIRI = 34;

/**
 * Tek koşulun biçim denetimi (statik doğrulayıcı ve kayıt dışı veri için).
 * Boş dizi = geçerli.
 */
export function muhurKosuluDogrula(k: unknown, renkSayisi = 6): string[] {
  const h: string[] = [];
  if (!k || typeof k !== 'object' || Array.isArray(k)) return ['koşul nesne değil'];
  const o = k as Partial<MuhurKosulu> & Record<string, unknown>;
  const olcu = o.olcu as MuhurOlcusu;
  if (!olcu || !(olcu in OLCU_KAPSAMLARI)) return [`bilinmeyen ölçü "${String(o.olcu)}"`];
  if (!o.kapsam || !OLCU_KAPSAMLARI[olcu].includes(o.kapsam)) h.push(`${olcu}: kapsam "${String(o.kapsam)}" olamaz (${OLCU_KAPSAMLARI[olcu].join('/')})`);
  const az = o.enAz !== undefined;
  const cok = o.enCok !== undefined;
  if (az === cok) h.push(`${olcu}: enAz ya da enCok'tan tam olarak biri olmalı`);
  if (az && (!Number.isInteger(o.enAz) || (o.enAz as number) < 1)) h.push(`${olcu}: enAz ≥ 1 tamsayı olmalı`);
  if (cok && (!Number.isInteger(o.enCok) || (o.enCok as number) < 0)) h.push(`${olcu}: enCok ≥ 0 tamsayı olmalı`);
  if (cok && o.kapsam !== 'oyun') h.push(`${olcu}: enCok yalnız kapsam "oyun" ile`);
  if (o.renk !== undefined && (!RENKLI.has(olcu) || !Number.isInteger(o.renk) || (o.renk as number) < 0 || (o.renk as number) >= renkSayisi)) h.push(`${olcu}: geçersiz renk süzgeci`);
  if (o.ozel !== undefined && (!OZELLI.has(olcu) || !['roket', 'kasimpati', 'yildiz'].includes(o.ozel))) h.push(`${olcu}: geçersiz ozel süzgeci`);
  if (o.kombo !== undefined && (olcu !== 'kombo' || !KOMBOLAR.has(o.kombo))) h.push(`${olcu}: geçersiz kombo süzgeci`);
  if (o.halka !== undefined && (typeof o.halka !== 'boolean' || !HALKALI.has(olcu))) h.push(`${olcu}: halka süzgeci olamaz`);
  if (o.eylem !== undefined && (!EYLEMLI.has(olcu) || !['fitil', 'ciftDokunus', 'koruk'].includes(o.eylem))) h.push(`${olcu}: geçersiz eylem süzgeci`);
  if (o.sans !== undefined && typeof o.sans !== 'boolean') h.push(`${olcu}: sans mantıksal olmalı`);
  if (o.metin !== undefined && (typeof o.metin !== 'string' || o.metin.length === 0)) h.push(`${olcu}: metin boş olamaz`);
  const metin = h.length === 0 ? muhurMetni(o as MuhurKosulu) : '';
  if (metin.length > MUHUR_METIN_SINIRI) h.push(`${olcu}: metin ${metin.length} karakter (≤ ${MUHUR_METIN_SINIRI}): "${metin}"`);
  return h;
}

/** Şansa bağlı sayılan süzgeçsiz ölçüler (KA5): `sans: true` zorunlu. */
const SANSA_BAGLI = new Set<MuhurOlcusu>(['R', 'nesil']);

/**
 * Bölümün mühür üçlüsünün denetimi (doğrulayıcı): 6–40'ta tam 3 koşul,
 * öğretimde (1–5) yok, şansa bağlı en çok 1 ve süzgeçsiz R/nesil şansa
 * bağlı işaretli, aynı koşul ya da aynı metin iki kez yok, aynı ölçünün
 * eşiği kademeyle artar (Çırak < Kalfa < Usta).
 */
export function bolumMuhurDogrula(v: Pick<BolumVerisi, 'id' | 'renkSayisi' | 'muhurler'>): string[] {
  const h: string[] = [];
  const m = v.muhurler as unknown;
  const muhurlu = v.id >= MUHUR_ACILIS_BOLUMU && v.id <= MUHUR_SON_BOLUM;
  if (m === undefined) return muhurlu ? ['mühür tanımı yok (6–40 için 3 mühür gerekli)'] : [];
  if (!muhurlu) return ['mühür yalnız 6–40. bölümlerde'];
  if (!Array.isArray(m) || m.length !== MUHUR_SAYISI) return ['muhurler tam 3 öğeli dizi olmalı (Çırak, Kalfa, Usta)'];
  const ad = (i: number): string => MUHUR_KADEME_ADLARI[MUHUR_KADEMELERI[i]];
  m.forEach((k, i) => muhurKosuluDogrula(k, v.renkSayisi).forEach((x) => h.push(`${ad(i)}: ${x}`)));
  if (h.length) return h;
  const l = m as MuhurKosulu[];
  if (l.filter((k) => k.sans).length > 1) h.push('şansa bağlı mühür bölüm başına en çok 1');
  l.forEach((k, i) => {
    if (SANSA_BAGLI.has(k.olcu) && k.halka === undefined && k.eylem === undefined && !k.sans) h.push(`${ad(i)}: süzgeçsiz ${k.olcu} şansa bağlıdır ("sans": true)`);
  });
  const anahtar = (k: MuhurKosulu) => JSON.stringify({ ...k, metin: undefined, sans: undefined });
  if (new Set(l.map(anahtar)).size !== l.length) h.push('aynı koşul iki kez');
  else if (new Set(l.map(muhurMetni)).size !== l.length) h.push('aynı metin iki kez');
  // Aynı ölçü (aynı süzgeçlerle) birden çok kademede: eşik kademeyle artar.
  const tur = (k: MuhurKosulu) => JSON.stringify({ ...k, enAz: undefined, enCok: undefined, metin: undefined, sans: undefined });
  for (let i = 0; i < l.length; i++)
    for (let j = i + 1; j < l.length; j++) {
      if (tur(l[i]) !== tur(l[j])) continue;
      const a = l[i].enAz ?? -(l[i].enCok ?? 0);
      const b = l[j].enAz ?? -(l[j].enCok ?? 0);
      if (b <= a) h.push(`${ad(j)} mühürü ${['Çırak\'tan', 'Kalfa\'dan', 'Usta\'dan'][i]} zor olmalı (aynı ölçüde eşik artmalı)`);
    }
  return h;
}

/**
 * Mühürlerin bölüm içeriğiyle uyumu (statik doğrulayıcı): ölçünün nesnesi
 * bölümde var (kafes, kaya, döşeme, desen, is, fener, dev fişek, barut izi,
 * ıslak barut, Körük), özel taş türü açık, çapraz roket mümkün, eşikler
 * erişilebilir (kalan hamle < hamle, zincir ≤ hücre). Boş = uyumlu.
 */
export function bolumMuhurUyumu(v: BolumVerisi): string[] {
  const m = v.muhurler;
  if (!m || !Array.isArray(m)) return [];
  const h: string[] = [];
  const simgeler = v.duzen.flatMap((r) => r.trim().split(/\s+/));
  const var_ = (re: RegExp) => simgeler.some((s) => re.test(s));
  const hucre = simgeler.filter((s) => s !== '#').length;
  const kafes = var_(/^C$/);
  const kaya = var_(/^K[123]$/);
  const kova = var_(/^S[12]?$/);
  const is = var_(/^I$/);
  const dev = var_(/^D\d*$/);
  const islak = var_(/^W$/);
  const fener = var_(/^F$/) || (v.fenerDogum?.kalan ?? 0) > 0;
  const koruk = (v.korukKapasitesi ?? 0) > 0;
  const iz = (v.zemin?.barutIzleri?.length ?? 0) > 0;
  const sabit = v.sabitKapsuller ?? [];
  const OZEL_SIRA = { roket: 0, kasimpati: 1, yildiz: 2 } as const;
  const ozelAcik = (o: keyof typeof OZEL_SIRA) => v.ozelEsikleri[OZEL_SIRA[o]] > 0 || sabit.some((s) => s.ozel === o);
  const kur = v.kurallar ?? {};
  const caprazYol = !kur.dortKomsu && kur.caprazSiniri !== 0;
  const caprazRoket = (v.ozelEsikleri[0] > 0 && caprazYol) || sabit.some((s) => s.ozel === 'roket' && (s.eksen === 2 || s.eksen === 3));
  m.forEach((k, i) => {
    const ad = `${MUHUR_KADEME_ADLARI[MUHUR_KADEMELERI[i]] ?? i} "${muhurMetni(k)}"`;
    const yok = (neden: string) => h.push(`${ad}: ${neden}`);
    const ozel: keyof typeof OZEL_SIRA | undefined = k.ozel;
    switch (k.olcu) {
      case 'kafes':
        if (!kafes) yok('bölümde kafes yok');
        break;
      case 'kaya':
        if (!kaya) yok('bölümde kaya yok');
        break;
      case 'engelHasar':
        if (!kaya && !kova) yok('bölümde kaya/kova yok');
        break;
      case 'doseme':
        if (!v.zemin?.dosemeler?.length) yok('bölümde döşeme yok');
        break;
      case 'desen':
        if (!v.zemin?.desen?.hucreler.length) yok('bölümde desen yok');
        break;
      case 'is':
        if (!is) yok('bölümde is yok');
        break;
      case 'fener':
        if (!fener) yok('bölümde fener yok');
        break;
      case 'devFisek':
        if (!dev) yok('bölümde dev fişek yok');
        break;
      case 'izliDevFisek':
        if (!dev || !iz) yok('bölümde barut izi ya da dev fişek yok');
        break;
      case 'kurutma':
        if (!islak) yok('bölümde ıslak barut yok');
        break;
      case 'koruk':
        if (!koruk) yok('bölümde Körük yok');
        break;
      case 'caprazRoket':
      case 'caprazEngel':
        if (!caprazRoket) yok('bölümde çapraz roket oluşamaz');
        if (k.olcu === 'caprazEngel' && !kafes && !kaya && !kova && !is && !dev) yok('bölümde engel yok');
        break;
      case 'olusum':
        if (ozel ? v.ozelEsikleri[OZEL_SIRA[ozel]] <= 0 : v.ozelEsikleri.every((e) => e <= 0)) yok('bu özel taş zincirle oluşmaz (ozelEsikleri)');
        break;
      case 'ozelAtes':
        if (ozel ? !ozelAcik(ozel) : !(['roket', 'kasimpati', 'yildiz'] as const).some(ozelAcik)) yok('bölümde bu özel taş yok');
        break;
      case 'kalanHamle':
        if ((k.enAz ?? 0) >= v.hamle) yok(`kalan hamle eşiği hamle sayısından (${v.hamle}) küçük olmalı`);
        break;
      case 'zincir':
      case 'R':
        if ((k.enAz ?? 0) > hucre) yok(`eşik hücre sayısını (${hucre}) aşıyor`);
        break;
      default:
        break;
    }
    if (k.eylem === 'koruk' && !koruk) yok('bölümde Körük yok');
    if (k.renk !== undefined && v.dogumAgirliklari && v.dogumAgirliklari[k.renk] === 0 && !sabit.some((s) => s.renk === k.renk)) yok('bu renk bölümde yok');
  });
  return h;
}
