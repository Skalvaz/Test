/**
 * Meta katmanının kural sabitleri (GDD §9, §10, §15 Coşku, §16.7).
 *
 * Bölüm sayısı ve sıralaması bölüm paketinden gelir; burada yalnız katalog
 * varsayılanları durur. Bölüm verisine dayanan bütün fonksiyonlar isteğe bağlı
 * bir `MetaAyar` alır, böylece bölüm listesi değişse de meta mantığı değişmez.
 */
import { ANA_BOLUM_SAYISI, BOLUM_PER_MAHALLE, MAHALLELER, USTA_BOLUM_IDLERI, USTA_YILDIZ_ADIMI } from '../app/katalog';

/**
 * Kayıt şeması sürümü (veri içindeki `surum`). 1 = GDD §16.7 taslağı,
 * 2 = meta paketi, 3 = Bölüm Mühürleri + Kasaba İşleri (docs/KANCALAR.md §D).
 */
export const KAYIT_SURUMU = 3 as const;
/** Depolama anahtarı ve yedekleri (§16.7). */
export const KAYIT_ANAHTARI = 'fitil.kayit.v1';
export const KAYIT_YEDEK_ANAHTARLARI = ['fitil.kayit.v1.yedek1', 'fitil.kayit.v1.yedek2'] as const;
/**
 * `SaveStore` zarf sürümü. SABİT kalmalı: zarf sürümü değişirse SaveStore eski
 * kaydı okumaz (veri kaybı). Şema değişiklikleri `surum` + göçle yapılır.
 */
export const ZARF_SURUMU = 1;
/** Kayıt kodu öneki (§16.7). */
export const KAYIT_KODU_ONEKI = 'FTL1:';

/** Sandık sistemi bu bölümün ilk kazancıyla tanıtılır (§15 Bölüm 5). 1–4 sandık vermez. */
export const SANDIK_ACILIS_BOLUMU = 5;
/** Bu bölümün ilk sandığı garanti Kasımpatı parçası verir (§10.4). */
export const KASIMPATI_GARANTI_BOLUMU = 5;
/** Günün Şenliği ve günlük görevler bu bölüm kazanılınca açılır (§10.5). */
export const GUNLUK_ACILIS_BOLUMU = 10;
/** Coşku Serisi: üst üste bu kadar ilk deneme kazancı hazır roket verir (§15). */
export const COSKU_ESIGI = 3;
/** Kıvılcım Usta'nın Eli: aynı bölümde bu sayıda ve sonraki başarısızlıklarda sunulur (§14.7). */
export const USTA_ELI_ESIGI = 4;
/** Usta'nın Eli ile eklenen hamle (bilgi amaçlı; uygulama kullanır). */
export const USTA_ELI_HAMLE = 5;

/** Sandık (§10.4). */
export const SANDIK_ORAN = { guclendirici: 35, desen: 50, fitil: 15 } as const;
export const SAHIP_OLUNMAYAN_ORANI = 80;
export const TOZ_TEKRAR = 3;
export const TOZ_PARCA_BEDELI = 10;
export const TOZ_STOK_DOLU = 2;
/** Üst üste bu kadar parçasız sandıktan sonraki sandık garanti parça verir. */
export const KOTU_SANS_SINIRI = 3;
export const TOZ_TAVANI = 999_999;

/** Günlük (§10.5). */
export const ARSIV_GUN = 7;
export const GUNLUK_GOREV_SAYISI = 3;
/** Günlük sonuçlar bu kadar gün saklanır (arşiv 7 gün + pay). */
export const GUNLUK_SAKLAMA_GUN = 30;

/** Fener Nöbeti basamakları (§10.5). `yonelme`: "Meşale'ye 2 gün" gibi metinler için yönelme hâli. */
export const SERI_BASAMAKLARI = [
  { id: 'kivilcim', ad: 'Kıvılcım', yonelme: "Kıvılcım'a", esik: 1 },
  { id: 'cira', ad: 'Çıra', yonelme: "Çıra'ya", esik: 3 },
  { id: 'mesale', ad: 'Meşale', yonelme: "Meşale'ye", esik: 7 },
  { id: 'fener', ad: 'Fener', yonelme: "Fener'e", esik: 14 },
  { id: 'denizFeneri', ad: 'Deniz Feneri', yonelme: "Deniz Feneri'ne", esik: 30 },
] as const;
export type SeriBasamakId = (typeof SERI_BASAMAKLARI)[number]['id'];

/** Gece Tablosu (§10.3). */
export const TABLO_KAYIT_SINIRI = 250;
export const TABLO_REAKSIYON_SAYISI = 3;
/** En büyük reaksiyonlara ayrılan en fazla kayıt; kalanı final gösterisinindir. */
export const TABLO_REAKSIYON_PAYI = 150;
/** Tablo zaman çizelgesinde bölümler arası boşluk (tik). */
export const TABLO_BOSLUK = 400;
export const NADIRLIK_ADLARI = ['Sade', 'Parlak', 'Şaheser'] as const;

/** Rozet kimlikleri (§10.6). Sıra arayüzde gösterim sırasıdır; kimlikler kayıtta saklanır. */
export const ROZET_IDLERI = [
  'ilkKivilcim',
  'caprazNisanci',
  'sarVePisir',
  'halkaci',
  'otuzluk',
  'senlik',
  'ucuncuKusak',
  'buyukFinal',
  'roketYagmuru',
  'kilpayi',
  'tutumlu',
  'ustaCirak',
  'saheser',
  'defterci',
  'nobetci',
  'denizFeneri',
  'korukcu',
  'domino',
] as const;
export type RozetId = (typeof ROZET_IDLERI)[number];

/** Bölüm listesine bağlı ayarlar (bölüm paketi farklı sayı verirse geçilir). */
export interface MetaAyar {
  anaBolumSayisi: number;
  bolumPerMahalle: number;
  ustaIdleri: readonly number[];
  ustaYildizAdimi: number;
}

export const VARSAYILAN_META_AYAR: MetaAyar = {
  anaBolumSayisi: ANA_BOLUM_SAYISI,
  bolumPerMahalle: BOLUM_PER_MAHALLE,
  ustaIdleri: USTA_BOLUM_IDLERI,
  ustaYildizAdimi: USTA_YILDIZ_ADIMI,
};

export function metaAyar(a?: Partial<MetaAyar>): MetaAyar {
  return a ? { ...VARSAYILAN_META_AYAR, ...a } : VARSAYILAN_META_AYAR;
}

/** Mahalle sayısı (katalogdaki mahalle sayısıyla sınırlı). */
export function mahalleSayisi(a: MetaAyar): number {
  return Math.min(MAHALLELER.length, Math.ceil(a.anaBolumSayisi / a.bolumPerMahalle));
}

/** Ana bölümün mahalle indeksi (0 tabanlı). */
export function bolumMahallesi(id: number, a: MetaAyar): number {
  return Math.floor((id - 1) / a.bolumPerMahalle);
}

/** Mahallenin ana bölüm kimlikleri. */
export function mahalleBolumleri(m: number, a: MetaAyar): number[] {
  const ilk = m * a.bolumPerMahalle + 1;
  const son = Math.min(a.anaBolumSayisi, ilk + a.bolumPerMahalle - 1);
  const r: number[] = [];
  for (let id = ilk; id <= son; id++) r.push(id);
  return r;
}

export type BolumTuru = 'ana' | 'usta' | 'gunluk' | 'sonsuz' | 'diger';

/** Sonsuz Şenlik bölüm kimliği tabanı (§10.7: tohum 1 000 000 + n). */
export const SONSUZ_TABANI = 1_000_000;

/**
 * Bölüm türü kimlikten: 1..N ana, Usta kimlikleri, yyyymmdd günlük
 * (8 hane), 1 000 000 + n sonsuz.
 */
export function bolumTuru(id: number, a: MetaAyar): BolumTuru {
  if (!Number.isInteger(id) || id <= 0) return 'diger';
  if (id <= a.anaBolumSayisi) return 'ana';
  if (a.ustaIdleri.includes(id)) return 'usta';
  if (id >= 10_000_000 && id < 100_000_000) return 'gunluk';
  if (id > SONSUZ_TABANI && id < 10_000_000) return 'sonsuz';
  return 'diger';
}
