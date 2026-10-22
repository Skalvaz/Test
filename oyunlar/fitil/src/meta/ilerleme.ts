/**
 * Bölüm sonucu işleme (GDD §9, §10, §15 Coşku). Tek giriş noktası:
 *
 *   const { kayit, oduller } = bolumSonucu(kayit, {
 *     bolumId, kazandi, puan, yildiz, istatistik: d.istatistik,
 *     olaylarOzeti: oz, deneme: denemeNo, tarih: bugun,
 *     kalanHamle, toplamHamle, motif,
 *   });
 *
 * Saf: girdiyi değiştirmez, yeni kayıt döner. Ödüller (`Odul[]`) oluştukları
 * sırayla gelir; arayüz kazandın/kaybettin ekranında türlerine göre gösterir.
 * Sandıklar burada AÇILIR (sonuç `kayitTohumu ^ sayac` ile kesinleşir ve
 * kayda yazılır; "dokun-aç" yalnız canlandırmadır, yeniden yüklemek sonucu
 * değiştirmez).
 *
 * İşlem sırası:
 *  1. Günlük görevlerin günü tazelenir, Fener Nöbeti bugünü sayar.
 *  2. Bölüm kaydı: deneme, başarısız seri, en iyi puan, yıldız rekoru.
 *  3. Coşku Serisi (ana, Usta, sonsuz; günlük nötr).
 *  4. Kilitler: sonraki bölüm, Günün Şenliği (14), Sonsuz Şenlik (40),
 *     güçlendirici açılış hediyeleri, mahalle tamamlama, efsane kartı,
 *     motif, Usta Bölümleri (her 15★, 12. bölüm kazanıldıktan sonra).
 *  5. Toplam istatistik ve rekorlar ("YENİ REKOR!").
 *  6. Gece Tablosu (kazanç).
 *  7. Günün Şenliği sonucu ve ilk kazanç sandığı; görev ilerlemesi.
 *  8. Fener Nöbeti basamak ödülleri.
 *  9. Sandıklar: ilk kazanç, artan her yıldız (3. yıldız parlak), günlük,
 *     görevler (3/3 olanı parlak), seri; sistem kapalıysa bekletilir.
 * 10. Rozetler.
 * 11. (Şema 3, KANCALAR §D.4) Kandil kazanımı ve kasabanın açılışı.
 *
 * Şema 3 ek adımları (KANCALAR §D.4):
 *  2b. Mühürler (kazanç, ana 6–40, Usta'nın Eli yok, `g.muhurler` var):
 *      maske birleşir; yeni mühür ya da mühürlerin tanıtımı (ilk mühürlü
 *      kazanç) → `muhur`; maske bu kazançla 3/3 olduysa → `sancak`.
 *  2c. Mahallenin mühür sayısı 5/10/15 basamağını ilk kez geçtiyse
 *      (`muhurOdulleri`'nde yoksa): mahalle fitilinin en küçük eksik parçası,
 *      üçü de varsa toz → `muhurParcasi`. Kendini onarır (birleştirmeyle
 *      gelen mühürler sonraki kazançta sayılır).
 *  7b. 3/3 görev parlak sandığı verildiği anda +1 günlük kandil.
 *  11. Kasaba açıksa ve kandil kazanıldıysa → `kandil`; kasaba bu kazançla
 *      açıldıysa → `kasabaAcildi`. Kasaba açılmadan (1–2. bölüm) kandil
 *      ödülü çıkmaz (birim henüz tanıtılmadı; bakiye yine türetilir).
 *
 * Kararlar (GDD yorumu):
 *  - Yıldız sandıkları: ilk kazanç 1. yıldızı karşılar; 2. ve 3. yıldız ayrı
 *    sandık verir (3★ ile ilk kazanç = 3 sandık, sonradan yükseltmek de aynı
 *    toplamı verir — hemen 3★ almak cezalandırılmaz).
 *  - Sandıklar 5. bölümle tanıtılır (§15): 1–4. bölümlerin ilk kazanç sandığı
 *    yoktur; sistem açılmadan gelen seri sandıkları bekletilir.
 *  - "İlk deneme": bölümün ilk kez oynanışı kazanıldı (deneme sayacı 0'dı).
 *  - Usta'nın Eli ile devam eden oyunun sonucu (`istatistik.ustaEli`) yeni
 *    deneme sayılmaz; kaybı zaten işlenmiştir. Devam sonucunun olay özeti
 *    yalnız Eli'den sonrasını taşır (istatistikle tamamlanmaz), oyun sayısı
 *    artmaz; kazanılırsa sayılmış kayıp kazanca döner.
 *  - Yeniden başlatma uygulamada kayıp olarak bildirilir (§14.5: Coşku bozulur).
 */
import { GUCLENDIRICILER, MAHALLELER, MUHUR_FITILLERI } from '../app/katalog';
import type { FitilId, GokyuzuId, GuclendiriciId } from '../app/katalog';
import type { BolumIstatistigi, Motif } from '../core/types';
import { guclendiriciAcik, guclendiriciVer_yerinde, tozEkle_yerinde } from './envanter';
import type { GuclendiriciVerildi } from './envanter';
import { nadirlikHesapla, tabloUret } from './galeri';
import type { Tablo } from './galeri';
import { arsivdeMi, gorevIlerlet, gorevMetni, gunlukAcik, gunlukDahaIyi, gunlukTazele_yerinde, izgaraMetni, seriIlerle } from './gunluk';
import type { SeriSonucu } from './gunluk';
import { acikEnYuksek, anaYildiz, bolumKazanildi, kayitKopyala, parcaId, sonsuzAcikMi } from './kayit';
import type { BolumKaydi, GorevDurumu, GunlukSonucKaydi, KartId, Kayit, Nadirlik, ParcaId, Rekorlar, SandikNedeni, Yildiz } from './kayit';
import { gunlukKandilEkle, kandilKazanimi, kasabaAcikMi, toplamMuhur } from './kasaba';
import { MUHUR_ACILIS_BOLUMU, MUHUR_MASKE_TAVANI, MUHUR_PARCA_ESIKLERI, MUHUR_SON_BOLUM, muhurBirlestir, muhurSayisi } from './muhur';
import type { MuhurKademe } from './muhur';
import { ozetBaslat } from './ozet';
import type { OyunOzeti } from './ozet';
import { rozetTanimi, yeniRozetler } from './rozetler';
import { sandikAc_yerinde, sandikAcik } from './sandik';
import type { SandikIstegi, SandikSonucu } from './sandik';
import {
  COSKU_ESIGI,
  SANDIK_ACILIS_BOLUMU,
  SERI_BASAMAKLARI,
  SONSUZ_TABANI,
  TOZ_PARCA_BEDELI,
  USTA_ACILIS_BOLUMU,
  USTA_ELI_ESIGI,
  bolumMahallesi,
  bolumTuru,
  mahalleBolumleri,
  mahalleSayisi,
  metaAyar,
} from './sabitler';
import type { BolumTuru, MetaAyar, RozetId } from './sabitler';
import { tarihGecerli } from './takvim';

// ─────────────────────────── Tipler ───────────────────────────

export interface BolumSonucGirdisi {
  bolumId: number;
  kazandi: boolean;
  /** Final dahil son puan. */
  puan: number;
  /** Uygulamanın eşiklerden hesapladığı yıldız; güçlendirici (≤ 2) ve Usta'nın Eli (≤ 1) sınırı burada da uygulanır. */
  yildiz: number;
  /** Çekirdeğin bölüm istatistiği (`OyunDurumu.istatistik`). */
  istatistik: BolumIstatistigi;
  /** Olay özeti (`ozet.ts`); yoksa istatistikten türetilir (görev/rozetlerin bir kısmı sayılmaz). */
  olaylarOzeti?: OyunOzeti;
  /** `bolumuYukle`'ye verilen denemeNo (0 tabanlı). Verilmezse kayıttaki sayaç. */
  deneme?: number;
  /** Yerel gün (yyyymmdd). Verilmezse günlük görev ve Fener Nöbeti işlenmez. */
  tarih?: number;
  /** Kazanç anında (final öncesi) kalan hamle; Kılpayı/Tutumlu ve paylaşım için. */
  kalanHamle?: number;
  /** Bölümün toplam hamlesi (Usta'nın Eli dahil). */
  toplamHamle?: number;
  /** Tamamlanan Işık Deseni motifi (desen hedefi; yalnız kazançta işlenir). */
  motif?: Motif;
  /** Kimlikten çıkarılamıyorsa bölüm türü. */
  tur?: BolumTuru;
  /**
   * Şema 3 (KANCALAR §A.4, §D.4): bu oyunun mühürleri [Çırak, Kalfa, Usta].
   * Uygulama `muhurleriDegerlendir(v, muhurOzeti(oz, finalOncesiDurum))` ile
   * hesaplar (meta bölüm verisini görmez). Kayıpta, Usta'nın Eli devamında
   * ya da 1–5 / 41+ bölümlerde meta yok sayar.
   */
  muhurler?: readonly boolean[];
  /**
   * (CAN-REKLAM §3) Bu sonuç, kaybı zaten işlenmiş denemenin devamı:
   * reklamla (ya da Usta kartıyla) +5 hamle. `istatistik.ustaEli` ile
   * birlikte Usta'nın Eli devamı gibi işlenir (yeni deneme sayılmaz, kayıp
   * sayaçları ikinci kez artmaz). Eli'nin kendisi için gerekmez (seri ≥ eşik).
   */
  devam?: boolean;
}

export type RekorAlani = 'bolumPuani' | keyof Rekorlar;

export type Odul =
  | { tur: 'yildiz'; bolumId: number; onceki: Yildiz; yeni: Yildiz }
  | { tur: 'yeniRekor'; alan: RekorAlani; onceki: number; yeni: number }
  | { tur: 'bolumAcildi'; bolumId: number }
  | { tur: 'ustaAcildi'; bolumId: number; ustaNo: number; yildiz: number }
  | { tur: 'gunlukAcildi' }
  | { tur: 'sonsuzAcildi' }
  | { tur: 'guclendiriciAcildi'; guc: GuclendiriciId; verilen: GuclendiriciVerildi }
  | { tur: 'guclendirici'; neden: 'mahalle' | 'rozet' | 'seri'; verilen: GuclendiriciVerildi }
  | { tur: 'mahalleTamam'; mahalle: number; gokyuzu: GokyuzuId; kart: KartId }
  | { tur: 'efsane'; mahalle: number; kart: KartId }
  | { tur: 'motif'; motif: Motif }
  | { tur: 'sandik'; sandik: SandikSonucu }
  | { tur: 'sandikBekliyor'; neden: SandikNedeni }
  | { tur: 'tablo'; tablo: Tablo; saklandi: boolean; eskiNadirlik: Nadirlik | null }
  | { tur: 'rozet'; rozet: RozetId; ad: string; verilen?: GuclendiriciVerildi }
  | { tur: 'cosku'; seri: number; aktif: boolean; bozuldu: boolean }
  | { tur: 'gorev'; indeks: number; gorev: GorevDurumu; metin: string }
  | { tur: 'seri'; sonuc: SeriSonucu }
  | { tur: 'seriBasamagi'; basamak: number; ad: string }
  | { tur: 'fitil'; fitil: FitilId }
  | { tur: 'ustaEli' }
  /**
   * Şema 3 (KANCALAR §A, §B; kazandın ekranı sırası §C.3):
   *  - muhur: bu kazançta YENİ basılan mühürler (`maske` güncel üçlü maske);
   *    `tanitim`: mühürler bu kazançla tanıtılıyor (6. bölümün ilk kazancı).
   *  - sancak: bölümün üç mührü tamamlandı (haritada çatıda sancak).
   *  - muhurParcasi: mahallenin 5/10/15. mührü; fitil parçası ya da (üçü de
   *    varsa) toz.
   *  - kandil: kandil bakiyesi değişti (kaynaklara göre dökümüyle).
   *  - kasabaAcildi: kasaba bu kazançla açıldı (3. bölüm; ilk kandil balonu).
   */
  | { tur: 'muhur'; bolumId: number; yeni: MuhurKademe[]; maske: number; tanitim: boolean }
  | { tur: 'sancak'; bolumId: number; mahalle: number }
  | { tur: 'muhurParcasi'; mahalle: number; esik: number; fitil: FitilId; parca: ParcaId | null; toz: number }
  | { tur: 'kandil'; onceki: number; yeni: number; kaynak: { yildiz: number; muhur: number; mahalle: number; gunluk: number } }
  | { tur: 'kasabaAcildi'; kandil: number };

export type OdulTuru = Odul['tur'];

export interface BolumSonucCiktisi {
  kayit: Kayit;
  oduller: Odul[];
  /** Kısayollar (arayüz akışı için). */
  ozet: {
    yildiz: Yildiz;
    ilkKazanc: boolean;
    ilkDeneme: boolean;
    yeniRekor: boolean;
    sandik: number;
    ustaEli: boolean;
    cosku: boolean;
  };
}

// ─────────────────────────── Yardımcılar ───────────────────────────

/** Güçlendirici / Usta'nın Eli yıldız sınırı (§7.4). */
export function yildizSiniri(ist: Pick<BolumIstatistigi, 'guclendirici' | 'ustaEli'>): Yildiz {
  if (ist.ustaEli) return 1;
  if ((ist.guclendirici ?? 0) > 0) return 2;
  return 3;
}

/** Puan ve eşiklerden yıldız (kazançta ≥ 1), sınırlar uygulanmış. */
export function yildizHesapla(puan: number, esikler: readonly [number, number], ist: Pick<BolumIstatistigi, 'guclendirici' | 'ustaEli'>): Yildiz {
  const y = 1 + (puan >= esikler[0] ? 1 : 0) + (puan >= esikler[1] ? 1 : 0);
  return Math.min(y, yildizSiniri(ist)) as Yildiz;
}

/** `bolumuYukle(v, siradakiDenemeNo(k, id))`: her deneme taze dolum akışı alır, oturumlar arasında da. */
export function siradakiDenemeNo(k: Kayit, bolumId: number): number {
  const b = k.bolumler[String(bolumId)];
  if (b) return b.deneme;
  // Günün Şenliği bölüm kaydı tutmaz; denemeler o günün sonuç kaydında sayılır
  // (K15, §8.1: plan öğrenilebilir, her deneme taze dolum).
  if (tarihGecerli(bolumId)) return k.gunluk.enIyi[String(bolumId)]?.deneme ?? 0;
  return 0;
}

/** Coşku Serisi aktif mi: `bolumuYukle(v, n, { cosku: coskuAktif(k) })` (§15). */
export function coskuAktif(k: Kayit): boolean {
  return k.cosku >= COSKU_ESIGI;
}

/** Kaybettin ekranında Kıvılcım Usta'nın Eli sunulur mu (§14.7: 4. ve sonraki başarısızlıklar). */
export function ustaEliSunulur(k: Kayit, bolumId: number): boolean {
  return (k.bolumler[String(bolumId)]?.basarisizSeri ?? 0) >= USTA_ELI_ESIGI;
}

/** Usta Bölümü no (1 tabanlı) → gereken ana yıldız. */
export function ustaGerekenYildiz(ustaNo: number, ayar: MetaAyar): number {
  return ustaNo * ayar.ustaYildizAdimi;
}

/** Usta Bölümünün kilit durumu (harita, bölüm açıklığı ve ödül aynı kuraldan). */
export interface UstaKilidi {
  acik: boolean;
  gerekenYildiz: number;
  /** Ana yıldız açığı (0 = yıldız yetiyor). */
  eksikYildiz: number;
  /** `USTA_ACILIS_BOLUMU` kapısı henüz geçilmedi (bölüm kazanılmadı, eski kayıt izi yok). */
  bolumKapisi: boolean;
}

/** Usta Bölümü bu kayıtta oynanmış mı (eski kayıt izi: deneme ya da yıldız). */
function ustaOynandi(k: Kayit, id: number): boolean {
  const b = k.bolumler[String(id)];
  return !!b && (b.deneme > 0 || b.yildiz > 0);
}

/**
 * Usta n (1 tabanlı) açık ⇔ ana yıldız ≥ `ustaGerekenYildiz(n)` VE
 * `USTA_ACILIS_BOLUMU` (12) kazanıldı (§10.2; Ekim 2026). Eski kayıt koruması
 * (göç değişmedi): bir Usta Bölümü oynamış oyuncuda kapı geçilmiş sayılır
 * (yıldızı yeten bütün Ustalar açık), oynanmış Usta her durumda açık kalır.
 * Eski kuralla açılıp hiç oynanmamış Usta 12 kazanılana dek yeniden kilitlenir
 * (kayıtta açılış izi yok; GDD K25 "bilinen bedel").
 */
export function ustaKilidi(k: Kayit, ustaNo: number, ayarK?: Partial<MetaAyar>): UstaKilidi {
  const ayar = metaAyar(ayarK);
  const gerek = ustaGerekenYildiz(ustaNo, ayar);
  const eksik = Math.max(0, gerek - anaYildiz(k, ayar));
  const kapi = !bolumKazanildi(k, Math.min(USTA_ACILIS_BOLUMU, ayar.anaBolumSayisi)) && !ayar.ustaIdleri.some((id) => ustaOynandi(k, id));
  const id = ayar.ustaIdleri[ustaNo - 1];
  const acik = (eksik === 0 && !kapi) || (id !== undefined && ustaOynandi(k, id));
  return { acik, gerekenYildiz: gerek, eksikYildiz: eksik, bolumKapisi: kapi };
}

/** Usta n (1 tabanlı) oynanabilir mi (`ustaKilidi(...).acik`). */
export function ustaAcikMi(k: Kayit, ustaNo: number, ayarK?: Partial<MetaAyar>): boolean {
  return ustaKilidi(k, ustaNo, ayarK).acik;
}

/** Bölüm oynanabilir mi. Günlük için `bugun` gerekir (bugün ya da arşiv). */
export function bolumAcikMi(k: Kayit, bolumId: number, bugun?: number, ayarK?: Partial<MetaAyar>): boolean {
  const ayar = metaAyar(ayarK);
  switch (bolumTuru(bolumId, ayar)) {
    case 'ana':
      return bolumId <= acikEnYuksek(k, ayar);
    case 'usta':
      return ustaAcikMi(k, ayar.ustaIdleri.indexOf(bolumId) + 1, ayar);
    case 'gunluk':
      return gunlukAcik(k) && bugun !== undefined && (bolumId === bugun || arsivdeMi(bolumId, bugun));
    case 'sonsuz':
      return sonsuzAcikMi(k, ayar) && bolumId - SONSUZ_TABANI <= k.sonsuzEnYuksek + 1;
    default:
      return false;
  }
}

/** Özet verilmediyse çekirdek istatistiğinden türetilir (kombinasyon türleri, atıflar ve tablo eksik kalır). */
export function istatistiktenOzet(ist: BolumIstatistigi): OyunOzeti {
  const oz = ozetBaslat();
  return ozetIstatistikleTamamla(oz, ist);
}

/** Özetteki en büyük/toplam değerleri çekirdek istatistiğiyle tamamlar (hangisi büyükse). */
function ozetIstatistikleTamamla(oz: OyunOzeti, ist: Partial<BolumIstatistigi>): OyunOzeti {
  const m = (a: number, b: number | undefined) => Math.max(a, b ?? 0);
  return {
    ...oz,
    enUzunZincir: m(oz.enUzunZincir, ist.enUzunZincir),
    enBuyukReaksiyon: m(oz.enBuyukReaksiyon, ist.enBuyukReaksiyon),
    enCokNesil: m(oz.enCokNesil, ist.enCokNesil),
    halka: m(oz.halka, ist.halkaSayisi),
    toplamPatlama: m(oz.toplamPatlama, ist.toplamPatlama),
    isiPatlamasi: m(oz.isiPatlamasi, ist.isiPatlamasi),
    roketAtesi: m(oz.roketAtesi, ist.roket),
    kasimpatiAtesi: m(oz.kasimpatiAtesi, ist.kasimpati),
    yildizAtesi: m(oz.yildizAtesi, ist.yildiz),
    korukKullanim: m(oz.korukKullanim, ist.korukKullanim),
    kafesKirilan: m(oz.kafesKirilan, ist.kafesKirilan),
    kayaYokEdilen: m(oz.kayaYokEdilen, ist.kayaKirilan),
    fenerToplanan: m(oz.fenerToplanan, ist.fenerToplanan),
    devFisekAtesi: m(oz.devFisekAtesi, ist.devFisekAtesi),
    reaksiyonlar: oz.reaksiyonlar.length > 0 ? oz.reaksiyonlar : [...(ist.reaksiyonlar ?? [])],
  };
}

function tamsayi(x: unknown, vars = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : vars;
}

// ─────────────────────────── Ana fonksiyon ───────────────────────────

export function bolumSonucu(kayit: Kayit, g: BolumSonucGirdisi, ayarK?: Partial<MetaAyar>): BolumSonucCiktisi {
  const ayar = metaAyar(ayarK);
  const k = kayitKopyala(kayit);
  const oduller: Odul[] = [];
  const bolumId = g.bolumId;
  const oncekiMuhur = toplamMuhur(kayit, ayar);
  const anahtar = String(bolumId);
  const tur = g.tur ?? bolumTuru(bolumId, ayar);
  const ist = g.istatistik ?? ({} as BolumIstatistigi);
  // Usta'nın Eli devamı: yalnız Eli gerçekten sunulmuşsa (4+ başarısızlık) ya da uygulama
  // reklamla +5 devamını bildirdiyse (`devam`; Eli kurallarıyla, CAN-REKLAM §3) yeni deneme sayılmaz.
  const ustaEliDevami = ist.ustaEli === true && tur !== 'gunluk' && (g.devam === true || (k.bolumler[anahtar]?.basarisizSeri ?? 0) >= USTA_ELI_ESIGI);
  // Devamda uygulama yalnız Eli'den sonraki olayların özetini verir; denemenin
  // tamamını taşıyan istatistikle tamamlanırsa kayıpta işlenmiş sayaçlar
  // (patlama, roket, görevler) ikinci kez eklenir.
  const ozet = ustaEliDevami && g.olaylarOzeti ? g.olaylarOzeti : ozetIstatistikleTamamla(g.olaylarOzeti ?? ozetBaslat(), ist);
  const kazandi = g.kazandi === true;
  const yildiz: Yildiz = kazandi ? (Math.min(Math.max(1, Math.floor(g.yildiz || 1)), 3, yildizSiniri(ist)) as Yildiz) : 0;
  const puan = tamsayi(g.puan);
  const tarih = tarihGecerli(g.tarih) ? g.tarih : null;
  const kalanHamle = g.kalanHamle === undefined ? null : tamsayi(g.kalanHamle);

  const oncekiAcik = acikEnYuksek(k, ayar);
  const oncekiUstaAcik = ayar.ustaIdleri.map((_, i) => ustaAcikMi(k, i + 1, ayar));
  const oncekiGunlukAcik = gunlukAcik(k);
  const oncekiSonsuzAcik = sonsuzAcikMi(k, ayar);

  const bolumSandiklari: SandikIstegi[] = [];
  const gunlukSandiklari: SandikIstegi[] = [];
  const gorevSandiklari: SandikIstegi[] = [];
  const seriSandiklari: SandikIstegi[] = [];

  // 1. Günlük görev günü ve Fener Nöbeti.
  let seri: SeriSonucu | null = null;
  if (tarih) {
    gunlukTazele_yerinde(k, tarih, oncekiAcik);
    const s = seriIlerle(k.gunluk, tarih);
    k.gunluk = s.gunluk;
    if (!s.sonuc.ayniGun) {
      seri = s.sonuc;
      oduller.push({ tur: 'seri', sonuc: s.sonuc });
    }
  }

  // 2. Bölüm kaydı.
  let ilkKazanc = false;
  let ilkDeneme = false;
  let oncekiYildiz: Yildiz = 0;
  let yeniRekor = false;
  let ustaEli = false;
  if (tur !== 'gunluk') {
    const b: BolumKaydi = k.bolumler[anahtar] ?? { yildiz: 0, enIyi: 0, deneme: 0, basarisizSeri: 0, kazanc: 0 };
    oncekiYildiz = b.yildiz;
    const oncekiDeneme = b.deneme;
    if (!ustaEliDevami) {
      b.deneme = Math.max(b.deneme, g.deneme !== undefined ? tamsayi(g.deneme) : 0) + 1;
      ilkDeneme = oncekiDeneme === 0 && (g.deneme === undefined || tamsayi(g.deneme) === 0);
    }
    if (kazandi) {
      b.kazanc++;
      b.basarisizSeri = 0;
      ilkKazanc = oncekiYildiz === 0;
      if (puan > b.enIyi) {
        if (b.enIyi > 0) {
          oduller.push({ tur: 'yeniRekor', alan: 'bolumPuani', onceki: b.enIyi, yeni: puan });
          yeniRekor = true;
        }
        b.enIyi = puan;
      }
      if (yildiz > b.yildiz) {
        oduller.push({ tur: 'yildiz', bolumId, onceki: b.yildiz, yeni: yildiz });
        b.yildiz = yildiz;
      }
      if (tur === 'sonsuz') k.sonsuzEnYuksek = Math.max(k.sonsuzEnYuksek, bolumId - SONSUZ_TABANI);
    } else if (!ustaEliDevami) {
      b.basarisizSeri++;
      if (b.basarisizSeri >= USTA_ELI_ESIGI) {
        ustaEli = true;
        oduller.push({ tur: 'ustaEli' });
      }
    }
    k.bolumler[anahtar] = b;

    // 2b–2c. Mühürler ve mahalle mühür ödülleri (KANCALAR §D.4).
    if (kazandi && tur === 'ana' && bolumId >= MUHUR_ACILIS_BOLUMU && bolumId <= MUHUR_SON_BOLUM && ist.ustaEli !== true && g.muhurler) {
      const eski = (b.muhur ?? 0) & MUHUR_MASKE_TAVANI;
      const r = muhurBirlestir(eski, g.muhurler);
      if (r.maske > 0) b.muhur = r.maske;
      // Tanıtım: hiç mühür basılmamış oyuncunun ilk mühürlü kazancı (6. bölüm
      // için tutan olmasa da satır gösterilir: "Yeni: Mühürler").
      const tanitim = oncekiMuhur === 0 && (r.yeni.length > 0 || (bolumId === MUHUR_ACILIS_BOLUMU && ilkKazanc));
      if (r.yeni.length > 0 || tanitim) oduller.push({ tur: 'muhur', bolumId, yeni: r.yeni, maske: r.maske, tanitim });
      if (r.maske === MUHUR_MASKE_TAVANI && eski !== MUHUR_MASKE_TAVANI) oduller.push({ tur: 'sancak', bolumId, mahalle: bolumMahallesi(bolumId, ayar) });
    }
    if (kazandi && tur === 'ana') muhurParcaOdulleri(k, bolumId, ayar, oduller);

    // 3. Coşku Serisi.
    const onceki = k.cosku;
    if (!kazandi) k.cosku = 0;
    else if (ilkDeneme) k.cosku++;
    if (k.cosku !== onceki) oduller.push({ tur: 'cosku', seri: k.cosku, aktif: k.cosku >= COSKU_ESIGI, bozuldu: k.cosku < onceki });
  }

  // 4. Kilitler ve tamamlama ödülleri.
  if (kazandi && tur === 'ana') {
    const yeniAcik = acikEnYuksek(k, ayar);
    if (yeniAcik > oncekiAcik) oduller.push({ tur: 'bolumAcildi', bolumId: yeniAcik });
    if (!oncekiGunlukAcik && gunlukAcik(k)) {
      oduller.push({ tur: 'gunlukAcildi' });
      if (tarih) gunlukTazele_yerinde(k, tarih, yeniAcik);
    }
    if (!oncekiSonsuzAcik && sonsuzAcikMi(k, ayar)) oduller.push({ tur: 'sonsuzAcildi' });
    mahalleOdulleri(k, bolumId, ayar, oduller);
  }
  // Güçlendirici açılışları (kendini onaran: hediye bir kez).
  for (const gc of GUCLENDIRICILER) {
    if (!k.hediyeler.includes(gc.id) && guclendiriciAcik(k, gc.id, ayar)) {
      k.hediyeler.push(gc.id);
      oduller.push({ tur: 'guclendiriciAcildi', guc: gc.id, verilen: guclendiriciVer_yerinde(k, gc.id, gc.hediye, ayar) });
    }
  }
  if (kazandi && g.motif && !k.koleksiyon.motifler.includes(g.motif)) {
    k.koleksiyon.motifler.push(g.motif);
    oduller.push({ tur: 'motif', motif: g.motif });
  }
  // Usta Bölümleri: birleşik koşulun (yıldız + 12. bölüm) geçişi. 12. bölümün
  // kazancında yıldızı zaten yeten birden çok Usta birlikte açılabilir. Yalnız
  // ana kazanç açar (Usta'nın kendi kaydı eski kayıt izidir, açılış değil).
  if (kazandi && tur === 'ana')
    ayar.ustaIdleri.forEach((id, i) => {
      if (!oncekiUstaAcik[i] && ustaAcikMi(k, i + 1, ayar)) oduller.push({ tur: 'ustaAcildi', bolumId: id, ustaNo: i + 1, yildiz: ustaGerekenYildiz(i + 1, ayar) });
    });

  // 5. İstatistik ve rekorlar.
  const s = k.istatistik;
  if (!ustaEliDevami) {
    s.oyun++;
    if (kazandi) s.kazanc++;
    else s.kayip++;
  } else if (kazandi) {
    // Kayıp zaten sayılmıştı; Eli ile kazanılınca aynı oyun kazanç olur.
    s.kazanc++;
    s.kayip = Math.max(0, s.kayip - 1);
  }
  s.toplamPatlama += ozet.toplamPatlama;
  s.toplamHalka += ozet.halka;
  s.isiPatlamasi += ozet.isiPatlamasi;
  s.roket += ozet.roketAtesi;
  s.kasimpati += ozet.kasimpatiAtesi;
  s.yildiz += ozet.yildizAtesi;
  s.kombinasyon += ustaEliDevami ? ozet.kombolar.length : Math.max(ozet.kombolar.length, ist.kombinasyon ?? 0);
  s.kafes += ozet.kafesKirilan;
  s.kaya += ozet.kayaYokEdilen;
  s.fener += ozet.fenerToplanan;
  s.devFisek += ozet.devFisekAtesi;
  s.korukKullanim += ozet.korukKullanim;
  if (kazandi && yildiz === 3) s.ucYildiz++;
  if (kazandi && tur === 'gunluk') s.gunlukKazanc++;
  /** Rekor güncelle; `bildir` ise (önceki > 0 iken) "YENİ REKOR!" ödülü. */
  const rekor = (alan: keyof Rekorlar, deger: number, bildir: boolean) => {
    const onceki = k.rekorlar[alan];
    if (deger <= onceki) return;
    k.rekorlar[alan] = deger;
    if (bildir && onceki > 0) {
      oduller.push({ tur: 'yeniRekor', alan, onceki, yeni: deger });
      yeniRekor = true;
    }
  };
  rekor('enBuyukReaksiyon', ozet.enBuyukReaksiyon, true);
  rekor('enUzunZincir', ozet.enUzunZincir, true);
  rekor('enCokNesil', ozet.enCokNesil, true);
  // Bölümler arası puan karşılaştırması anlamsız: sessiz tutulur (istatistik sayfası).
  if (kazandi) rekor('enYuksekPuan', puan, false);
  if (kazandi && tur === 'gunluk') rekor('enIyiGunluk', puan, false);

  // 6. Gece Tablosu.
  let nadirlik: Nadirlik | null = null;
  if (kazandi) {
    nadirlik = nadirlikHesapla({ yildiz, enBuyukReaksiyon: ozet.enBuyukReaksiyon, halka: ozet.halka, buyukFinal: ozet.kombolar.includes('buyukFinal') });
    if (tur === 'ana' || tur === 'usta') {
      const tablo = tabloUret(ozet.tablo, nadirlik);
      const b = k.bolumler[anahtar];
      if (tablo && b) {
        const eski = b.tablo ? ((b.nadirlik ?? 0) as Nadirlik) : null;
        const sakla = eski === null || nadirlik > eski;
        if (sakla) {
          b.tablo = tablo.kod;
          b.nadirlik = nadirlik;
        }
        oduller.push({ tur: 'tablo', tablo, saklandi: sakla, eskiNadirlik: eski });
      }
    }
  }

  // 7. Günün Şenliği ve görevler.
  const gununSenligi = tur === 'gunluk' && tarih !== null && bolumId === tarih;
  if (tur === 'gunluk' && tarihGecerli(bolumId)) {
    const t = String(bolumId);
    const eski = k.gunluk.enIyi[t];
    const reak = ozet.reaksiyonlar;
    const toplam = tamsayi(g.toplamHamle, reak.length);
    const kullanilan = kalanHamle !== null && toplam > 0 ? Math.max(0, toplam - kalanHamle) : reak.length;
    const yeni: GunlukSonucKaydi = { puan, yildiz, kazandi, kullanilan, toplam, enBuyuk: ozet.enBuyukReaksiyon, izgara: izgaraMetni(reak).slice(0, 200), deneme: (eski?.deneme ?? 0) + 1 };
    if (gunlukDahaIyi(yeni, eski)) {
      // O günün önceki kazancı geçildiyse "YENİ REKOR!" (bölüm puanı gibi).
      if (kazandi && eski?.kazandi && eski.puan > 0) {
        oduller.push({ tur: 'yeniRekor', alan: 'bolumPuani', onceki: eski.puan, yeni: puan });
        yeniRekor = true;
      }
      k.gunluk.enIyi[t] = yeni;
    } else k.gunluk.enIyi[t] = { ...eski, deneme: yeni.deneme };
    if (kazandi && gununSenligi && k.gunluk.ilkKazanc !== bolumId) {
      k.gunluk.ilkKazanc = bolumId;
      gunlukSandiklari.push({ tur: yildiz >= 3 ? 'parlak' : 'normal', neden: 'gunluk', bolumId });
    }
  }
  if (tarih && gunlukAcik(k) && k.gunluk.tarih === tarih && k.gunluk.gorevler.length > 0) {
    const r = gorevIlerlet(k.gunluk.gorevler, { kazandi, yildiz, ilkDeneme: kazandi && ilkDeneme, gununSenligi, ozet });
    k.gunluk.gorevler = r.gorevler;
    const hepsi = r.gorevler.every((x) => x.tamam);
    r.tamamlanan.forEach((i, j) => {
      oduller.push({ tur: 'gorev', indeks: i, gorev: r.gorevler[i], metin: gorevMetni(r.gorevler[i]) });
      const parlak = hepsi && j === r.tamamlanan.length - 1 && !k.gunluk.ucGorevSandigi;
      if (parlak) {
        k.gunluk.ucGorevSandigi = true;
        // 7b. Günün üç görevi: günde en çok 1 kandil (parlak sandık bir kez verilir);
        // gün kaydedilir (iki cihazın birleşiminde ayrı günler korunur).
        gunlukKandilEkle(k.kasaba, tarih);
      }
      gorevSandiklari.push({ tur: parlak ? 'parlak' : 'normal', neden: 'gorev' });
    });
  }

  // 8. Fener Nöbeti basamak ödülleri (açılışlardan sonra: kilitler güncel).
  if (seri) for (const b of seri.yeniBasamaklar) seriBasamakOdulu(k, b, ayar, oduller, seriSandiklari);

  // 9. Sandıklar.
  if (kazandi && tur !== 'gunluk') {
    if (ilkKazanc) bolumSandiklari.push({ tur: 'normal', neden: 'ilkKazanc', bolumId });
    for (let y = Math.max(oncekiYildiz, 1) + 1; y <= yildiz; y++) bolumSandiklari.push({ tur: y === 3 ? 'parlak' : 'normal', neden: 'yildiz', bolumId });
  }
  const hepsi = [...bolumSandiklari, ...gunlukSandiklari, ...gorevSandiklari, ...seriSandiklari];
  let sandikSayisi = 0;
  if (sandikAcik(k)) {
    const bekleyen = k.sandik.bekleyen;
    k.sandik.bekleyen = [];
    for (const istek of [...hepsi, ...bekleyen]) {
      oduller.push({ tur: 'sandik', sandik: sandikAc_yerinde(k, istek, ayar) });
      sandikSayisi++;
    }
  } else if (tur === 'ana' && bolumId < SANDIK_ACILIS_BOLUMU) {
    // 1–4. bölümler sandık vermez (öğretim); yalnız seri sandıkları bekletilir.
    for (const istek of seriSandiklari) bekleyenEkle(k, istek, oduller);
  } else {
    for (const istek of hepsi) bekleyenEkle(k, istek, oduller);
  }

  // 10. Rozetler.
  for (const id of yeniRozetler({ kayit: k, oyun: { bolumId, kazandi, kalanHamle: kazandi ? kalanHamle : null, ozet, nadirlik }, ayar })) {
    k.rozetler.push(id);
    const t = rozetTanimi(id);
    const o: Odul = { tur: 'rozet', rozet: id, ad: t.ad };
    if (t.odul) o.verilen = guclendiriciVer_yerinde(k, t.odul.guc, t.odul.adet, ayar);
    oduller.push(o);
  }

  // 11. Kandil (türetilmiş bakiyenin kazanımı) ve kasabanın açılışı.
  if (kasabaAcikMi(k)) {
    const kz = kandilKazanimi(kayit, k, ayar);
    if (kz) oduller.push({ tur: 'kandil', onceki: kz.onceki, yeni: kz.yeni, kaynak: kz.kaynak });
    if (!kasabaAcikMi(kayit)) oduller.push({ tur: 'kasabaAcildi', kandil: kz?.yeni ?? 0 });
  }

  return {
    kayit: k,
    oduller,
    ozet: { yildiz, ilkKazanc, ilkDeneme: kazandi && ilkDeneme, yeniRekor, sandik: sandikSayisi, ustaEli, cosku: coskuAktif(k) },
  };
}

function bekleyenEkle(k: Kayit, istek: SandikIstegi, oduller: Odul[]): void {
  if (k.sandik.bekleyen.length >= 20) return;
  k.sandik.bekleyen.push({ tur: istek.tur, neden: istek.neden });
  oduller.push({ tur: 'sandikBekliyor', neden: istek.neden });
}

/** Mahalle tamamlama (§10.1) ve efsane kartı (mahallenin tamamı 3★). Kendini onarır: kart yoksa verir. */
function mahalleOdulleri(k: Kayit, bolumId: number, ayar: MetaAyar, oduller: Odul[]): void {
  const m = bolumMahallesi(bolumId, ayar);
  if (m < 0 || m >= mahalleSayisi(ayar)) return;
  const mh = MAHALLELER[m];
  const ids = mahalleBolumleri(m, ayar);
  const defterKarti = `defter:${mh.id}`;
  if (ids.every((id) => bolumKazanildi(k, id)) && !k.koleksiyon.kartlar.includes(defterKarti)) {
    k.koleksiyon.kartlar.push(defterKarti);
    if (!k.koleksiyon.gokyuzuler.includes(mh.gokyuzu)) k.koleksiyon.gokyuzuler.push(mh.gokyuzu);
    oduller.push({ tur: 'mahalleTamam', mahalle: m, gokyuzu: mh.gokyuzu, kart: defterKarti });
    for (const gc of GUCLENDIRICILER) oduller.push({ tur: 'guclendirici', neden: 'mahalle', verilen: guclendiriciVer_yerinde(k, gc.id, 1, ayar) });
  }
  const efsane = `efsane:${mh.id}`;
  if (ids.every((id) => (k.bolumler[String(id)]?.yildiz ?? 0) >= 3) && !k.koleksiyon.kartlar.includes(efsane)) {
    k.koleksiyon.kartlar.push(efsane);
    oduller.push({ tur: 'efsane', mahalle: m, kart: efsane });
  }
}

/**
 * Mahallenin mühür sayısı 5/10/15 basamağını geçtiyse (verilmemişse) mahalle
 * fitilinin en küçük eksik parçası; üçü de varsa `TOZ_PARCA_BEDELI` toz
 * (KANCALAR §A.6, §D.4 2c). Basamak `muhurOdulleri`'ne yazılır.
 */
function muhurParcaOdulleri(k: Kayit, bolumId: number, ayar: MetaAyar, oduller: Odul[]): void {
  const m = bolumMahallesi(bolumId, ayar);
  const fitil = MUHUR_FITILLERI[m];
  if (!fitil || m < 0 || m >= MAHALLELER.length) return;
  let sayi = 0;
  for (const id of mahalleBolumleri(m, ayar)) if (id >= MUHUR_ACILIS_BOLUMU && id <= MUHUR_SON_BOLUM) sayi += muhurSayisi(k.bolumler[String(id)]?.muhur);
  for (const esik of MUHUR_PARCA_ESIKLERI) {
    const anahtar = `${MAHALLELER[m].id}:${esik}`;
    if (sayi < esik || k.muhurOdulleri.includes(anahtar)) continue;
    k.muhurOdulleri.push(anahtar);
    let parca: ParcaId | null = null;
    for (let i = 0; i < 3 && !parca; i++) {
      const p = parcaId('fitil', fitil, i);
      if (!k.koleksiyon.parcalar.includes(p)) parca = p;
    }
    if (parca) {
      k.koleksiyon.parcalar.push(parca);
      k.istatistik.parca++;
      oduller.push({ tur: 'muhurParcasi', mahalle: m, esik, fitil, parca, toz: 0 });
    } else {
      tozEkle_yerinde(k, TOZ_PARCA_BEDELI);
      oduller.push({ tur: 'muhurParcasi', mahalle: m, esik, fitil, parca: null, toz: TOZ_PARCA_BEDELI });
    }
  }
}

/** Fener Nöbeti basamağı ilk kez geçildi (§10.5). */
function seriBasamakOdulu(k: Kayit, b: number, ayar: MetaAyar, oduller: Odul[], sandiklar: SandikIstegi[]): void {
  const basamak = SERI_BASAMAKLARI[b];
  if (!basamak) return;
  oduller.push({ tur: 'seriBasamagi', basamak: b, ad: basamak.ad });
  switch (basamak.id) {
    case 'cira':
      sandiklar.push({ tur: 'normal', neden: 'seri' });
      break;
    case 'mesale':
      oduller.push({ tur: 'guclendirici', neden: 'seri', verilen: guclendiriciVer_yerinde(k, 'kibrit', 1, ayar) });
      sandiklar.push({ tur: 'normal', neden: 'seri' });
      break;
    case 'fener':
      for (const gc of GUCLENDIRICILER) oduller.push({ tur: 'guclendirici', neden: 'seri', verilen: guclendiriciVer_yerinde(k, gc.id, 1, ayar) });
      break;
    case 'denizFeneri':
      for (let i = 0; i < 3; i++) {
        const p = parcaId('fitil', 'denizFeneri', i);
        if (!k.koleksiyon.parcalar.includes(p)) k.koleksiyon.parcalar.push(p);
      }
      oduller.push({ tur: 'fitil', fitil: 'denizFeneri' });
      break;
    default:
      break;
  }
}

/**
 * Uygulama açılışında ya da gün değişince (bölüm oynamadan): günlük
 * görevleri tazeler. Fener Nöbeti yalnız oynanınca sayılır.
 */
export function gunGiris(k: Kayit, bugun: number, ayarK?: Partial<MetaAyar>): { kayit: Kayit; degisti: boolean } {
  const ayar = metaAyar(ayarK);
  const y = kayitKopyala(k);
  const degisti = gunlukTazele_yerinde(y, bugun, acikEnYuksek(y, ayar));
  return { kayit: degisti ? y : k, degisti };
}
