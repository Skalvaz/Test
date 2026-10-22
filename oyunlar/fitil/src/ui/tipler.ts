/**
 * Arayüz görünüm modelleri (P3a). Ekranların ihtiyaç duyduğu DÜZ veriler:
 * kayıt/meta şemasından bağımsızdır, entegratör (src/app) eşler. Çekirdek
 * tiplerine (Hedef türü, Motif) ve katalog kimliklerine dayanır; bunlar
 * sözleşmede sabittir.
 *
 * Kural: görünüm modelinde işlev ya da DOM öğesi yoktur. Geri çağırımlar
 * `ArayuzGeriCagirim` içinde, tuval gibi öğeler ekranın ikinci bağımsız
 * değişkeninde (`ek`) gelir.
 */
import type { Dil } from '../platform/dil';
import type { Hedef, Motif, ReaksiyonKademesi } from '../core/types';
import type { Palet } from '../app/sozlesme';
import type { DesenId, FitilId, GokyuzuId, GuclendiriciId } from '../app/katalog';
import type { UrunId } from '../platform/gelir';

export type { Palet, ReaksiyonKademesi };

export type HedefTuru = Hedef['tur'];
export type Yildiz = 0 | 1 | 2 | 3;
export type Nadirlik = 'sade' | 'parlak' | 'saheser';

/** HUD'da ve kartlarda bir hedef (çekirdekteki `HedefDurumu`nun düz hâli). */
export interface HedefVM {
  tur: HedefTuru;
  /** `topla`: 0..5 ya da 'hepsi'. */
  renk?: number | 'hepsi';
  /** `desen` hedefinin motifi. */
  motif?: Motif;
  /** `zincirleme` hedefinde tek hamlede gereken reaksiyon R. */
  esik?: number;
  /** Gereken toplam ("hepsini temizle" türlerinde başlangıçtaki toplam). */
  gerekli: number;
  /** Şimdiye kadarki ilerleme (0..gerekli). HUD kalanı gösterir. */
  ilerleme: number;
  tamam: boolean;
}

/** Yeni öğe tanıtımları (bölüm öncesi küçük animasyon, "Sıradaki: X!"). */
export type YeniOge =
  | 'cizim' | 'capraz' | 'isi' | 'roket' | 'kafes' | 'nisan' | 'kasimpati' | 'islak' | 'halka'
  | 'doseme' | 'fener' | 'yildiz' | 'kaya' | 'kombo' | 'devFisek' | 'koruk' | 'kova' | 'bayram'
  | 'barutIzi' | 'altiRenk' | 'delik' | 'doseme2' | 'desen' | 'esik5' | 'meltem' | 'is' | 'cisenti';

/** Engel/öğe kimlikleri (Nasıl oynanır > Engeller kartı). */
export type EngelId =
  | 'kafes' | 'islak' | 'doseme' | 'fener' | 'kaya' | 'devFisek' | 'kova' | 'barutIzi'
  | 'delik' | 'desen' | 'meltem' | 'cisenti' | 'is';

export type RozetId =
  | 'ilkKivilcim' | 'caprazNisanci' | 'sarVePisir' | 'halkaci' | 'otuzluk' | 'senlik'
  | 'ucuncuKusak' | 'buyukFinal' | 'roketYagmuru' | 'kilpayi' | 'tutumlu' | 'ustaCirak'
  | 'saheser' | 'defterci' | 'nobetci' | 'denizFeneri' | 'korukcu' | 'domino';

export type SeriBasamagi = 'kivilcim' | 'cira' | 'mesale' | 'fener' | 'denizFeneri';

// ─────────────── Mühürler ve Kasaba (docs/KANCALAR.md §C) ───────────────

export type MuhurKademeVM = 'cirak' | 'kalfa' | 'usta';

/**
 * Bir mühür satırı (bölüm öncesi kartı, Duraklat, Kazandın).
 *  - basili: kayıtta basılı (önceki denemelerden)
 *  - durum: oyun sürerken (HUD/Duraklat) — 'tuttu' koşul sağlandı, kazanınca
 *    basılır; 'bekliyor'; 'korunuyor' kısıt şimdilik tutuyor; 'bozuldu'
 *    bu denemede basılamaz; 'sonda' kazanç anında ölçülür (kalan hamle).
 */
export interface MuhurVM {
  kademe: MuhurKademeVM;
  /** Tek satır koşul metni (≤ 34 karakter). */
  metin: string;
  basili: boolean;
  durum?: 'tuttu' | 'bekliyor' | 'korunuyor' | 'bozuldu' | 'sonda';
  /**
   * (Kancalar §C.4) Sayaç/eşik mühüründe ilerleme (Duraklat): `deger`
   * ölçülen (tek hamle kapsamında bu denemenin en iyisi), `hedef` eşik;
   * `tek`: "tek hamlede" (en iyi) ölçüsü. Eşik 1 olan ve kalan hamle
   * mühürlerinde yok.
   */
  ilerleme?: { deger: number; hedef: number; tek: boolean };
}

/** Kasaba paneli (alt çekmece) iş kartı. */
export interface KasabaIsVM {
  id: string;
  ad: string;
  aciklama: string;
  maliyet: number;
  /** Taç iş (mahallenin 6. işi; öbür beşi bitince açılır). */
  tac: boolean;
  durum: 'yapildi' | 'yapilabilir' | 'yetersiz' | 'tacKilitli' | 'sirada' | 'haritaKilitli' | 'kasabaKapali';
  /** `yetersiz` iken eksik kandil. */
  eksik: number;
}

export interface KasabaMahalleVM {
  indeks: number;
  /** Haritada açık mı (sisli mahalle kilitli sekme). */
  acik: boolean;
  /** Bu mahalleye sıra geldi mi (önceki mahallenin 6 işi bitti). */
  sirada: boolean;
  yapilan: number;
  isler: KasabaIsVM[];
}

export interface KasabaVM {
  kandil: number;
  /** Açılışta seçili mahalle sekmesi (süslenen mahalle). */
  secili: number;
  mahalleler: KasabaMahalleVM[];
  /** İlk kandil öğretimi: ilk işin "Yap" düğmesinde el animasyonu. */
  ogretim: boolean;
}

/** Kasaba panelinde seçim: bir işi yap ya da kapat. */
export type KasabaSecimi = { tur: 'yap'; id: string } | { tur: 'kapat' };

// ───────────────────────────── HUD ─────────────────────────────

export interface GuclendiriciVM {
  id: GuclendiriciId;
  adet: number;
  /** Açılış bölümüne gelindi mi (Kibrit 7, Kalıp 12, Geri Sar 20). */
  acik: boolean;
  /**
   * Şu an basılabilir mi: stok > 0, bu bölümde başka güçlendirici
   * kullanılmadı, Geri Sar için son eylem bir hamle, oynatma sürmüyor.
   */
  kullanilabilir: boolean;
}

export interface HudVM {
  bolumId: number;
  bolumAdi: string;
  /** Tahta boyutu: yerleşim formülü (§13.7) bunu kullanır. */
  tahtaW: number;
  tahtaH: number;
  hedefler: HedefVM[];
  kalanHamle: number;
  toplamHamle: number;
  puan: number;
  /** [2★, 3★] puan eşikleri (§7.4). 1★ = bütün hedefler tamam. */
  yildizEsikleri: [number, number];
  /** Bu denemede alınabilecek en çok yıldız (güçlendirici → 2, Usta'nın Eli → 1). */
  yildizSiniri: 1 | 2 | 3;
  korukDolum: number;
  /** 0 = Körük kapalı (gösterge gizlenir). */
  korukKapasite: number;
  guclendiriciler: GuclendiriciVM[];
  /**
   * (Kancalar) Duraklat düğmesindeki mühür rozeti (●●○): 6–40'ta 3 öğe,
   * mühürler tanıtılmadıysa ya da bölüm mühürsüzse yok.
   */
  muhurler?: MuhurVM[];
}

// ─────────────────────────── Harita ───────────────────────────

export interface BolumDugumuVM {
  id: number;
  yildiz: Yildiz;
  /** 'acik' = kazanılmış; 'simdiki' = oynanacak sıradaki bölüm. */
  durum: 'kilitli' | 'acik' | 'simdiki';
  /** (Kancalar) Basılı mühür sayısı (0..3); mühürsüz bölümde yok. */
  muhur?: number;
  /** (Kancalar) Üç mühür: çatıda mahalle renginde sancak. */
  sancak?: boolean;
}

export interface UstaDugumuVM {
  /** 101..108 */
  id: number;
  acik: boolean;
  yildiz: Yildiz;
  /** Açılış için gereken toplam ★ (15, 30, …). */
  gerekenYildiz: number;
  /** Ana yıldız açığı (0 = yıldız yetiyor). Yoksa yıldız eksik sayılır. */
  eksikYildiz?: number;
  /** Usta kapısı henüz geçilmediyse kazanılması gereken bölüm (12); geçildiyse yok. */
  kapiBolumu?: number;
}

export interface SeriVM {
  /** Fener Nöbeti: ardışık oyun günü. */
  gun: number;
  basamak: SeriBasamagi | null;
}

export interface HaritaVM {
  toplamYildiz: number;
  /** 40 ana bölüm (eksik olanlar kilitli sayılır). */
  bolumler: BolumDugumuVM[];
  /** 8 Usta Bölümü. */
  ustalar: UstaDugumuVM[];
  /** Tamamlanmış Işık Deseni motifleri ve asılacakları mahalle (0..7). */
  motifler: { motif: Motif; mahalle: number }[];
  seri: SeriVM;
  /** Günün Şenliği rozeti: açık mı, bugünkü görevlerden kaç tamam; `acilisBolumu` kilit metni için (14). */
  gunluk: { acik: boolean; tamam: number; toplam: number; acilisBolumu: number };
  /** Fişek Defteri / Rozetler'de görülmemiş yenilik noktası. */
  defterYeni?: boolean;
  rozetYeni?: boolean;
  /** (P5 ek) Sonsuz Şenlik (§10.7): 40. bölümden sonra açılır; sıradaki n. */
  sonsuz?: { acik: boolean; siradaki: number };
  /**
   * (Kancalar §C.1) Kasaba düğmesi ve harita süsleri. `isler`: yapılan işlerin
   * kimlikleri (çizim); `uyari`: "Kandil yetti" balonu gösterilecek iş adı.
   */
  kasaba?: { acik: boolean; kandil: number; isler: string[]; yapilabilir: boolean; uyari?: string | null };
  /**
   * (CAN-REKLAM §6) Can hapı: üst çubukta, yıldızın yanında; yalnız gelir
   * sağlayıcısı varken (yoksa null/yok: hap çizilmez). Dokununca seçim
   * `{ tur: 'can' }`. Canlı sayaç `Arayuz.haritaCanGuncelle` ile tazelenir;
   * "aynı modelle yeniden çizmeme" denetimi bu alanı DIŞARIDA bırakır
   * (saniyelik değişim haritayı yeniden çizdirmesin, kutlamayı kesmesin).
   */
  can?: CanSayaciVM | null;
}

export type HaritaSecimi =
  | { tur: 'bolum'; id: number }
  | { tur: 'usta'; id: number }
  | { tur: 'gunluk' }
  | { tur: 'defter' }
  | { tur: 'istatistik' }
  | { tur: 'ayarlar' }
  | { tur: 'nasil' }
  /** (P5 ek) Sonsuz Şenlik'in sıradaki bölümü. */
  | { tur: 'sonsuz' }
  /** (Kancalar) Kasaba paneli. */
  | { tur: 'kasaba' }
  /** Ayarlar + üstünde Oyun özeti (haritada düğmesi yok; test kancası `ac('oyunOzeti')`). */
  | { tur: 'oyunOzeti' }
  /** (CAN-REKLAM §6) Can hapına dokunuldu: uygulama can panelini açar. */
  | { tur: 'can' }
  /** Harita başka bir ekranla programlı olarak kapatıldı. */
  | { tur: 'kapandi' };

// ─────────────────────── Bölüm öncesi ───────────────────────

export type BolumTuru = 'ogretim' | 'tanitim' | 'normal' | 'zor' | 'rahatlama' | 'final' | 'usta' | 'gunluk' | 'sonsuz';

export interface BolumOncesiVM {
  id: number;
  ad: string;
  /** Mahalle indeksi (0..7). */
  mahalle: number;
  tur: BolumTuru;
  hedefler: HedefVM[];
  hamle: number;
  /** Isı eşiği; 4 değilse bilgi satırı çıkar. */
  esik: number;
  yeniOge?: YeniOge | null;
  /** Usta Bölümü kural açıklaması ("Yalnız halkalar geçerli"). */
  ustaKurali?: string | null;
  enIyi: number | null;
  yildiz: Yildiz;
  /** Saklı Gece Tablosu (küçük resim `tabloTuvali` geri çağırımından). */
  tablo: { nadirlik: Nadirlik } | null;
  /** Coşku Serisi aktif: hazır roketle başlanır. */
  cosku: boolean;
  /** (Kancalar §C.2) Üç mühür (6–40, mühürler tanıtıldıysa). */
  muhurler?: MuhurVM[];
  /** (Kancalar §C.6 `muhur-kart`) Mühür bloğunun üstünde Kıvılcım Usta ipucu (bir kez). */
  muhurIpucu?: string | null;
}

// ───────────────────────── Sonuçlar ─────────────────────────

export type OdulVM =
  | { tur: 'guclendirici'; id: GuclendiriciId; adet: number }
  /** parca: bu parçayla sahip olunan sayı (1..3). tekrar: tekrar eden parça → +3 toz. */
  | { tur: 'desenParcasi'; id: DesenId; parca: number; tekrar?: boolean }
  | { tur: 'fitilParcasi'; id: FitilId; parca: number; tekrar?: boolean }
  | { tur: 'toz'; adet: number }
  | { tur: 'sandik'; adet: number };

export interface SandikVM {
  tur: 'normal' | 'parlak';
  oduller: OdulVM[];
}

export interface KazandinVM {
  bolumId: number;
  bolumAdi: string;
  tur?: BolumTuru;
  /** Bu kazançta alınan yıldız. */
  yildiz: Yildiz;
  /** Bölümün önceki yıldız rekoru. */
  oncekiYildiz: Yildiz;
  puan: number;
  yeniRekor: boolean;
  /** Açılacak sandıklar (boş olabilir). */
  sandiklar: SandikVM[];
  /** Yeni Gece Tablosu. eskiVar: saklı bir tablo var → [Sakla] / [Eskisini koru]. */
  tablo: { nadirlik: Nadirlik; eskiVar: boolean; eskiNadirlik?: Nadirlik } | null;
  /** "Sıradaki: Fener Alayı!" (bölüm verisindeki `sonrakiTanitim`). */
  sonrakiTanitim: string | null;
  sonrakiOge?: YeniOge | null;
  /** Kazanç balonu (ör. 5. bölüm: "Yıldızlar puanından gelir."). */
  ipucu?: string | null;
  /**
   * (P5 ek) Kazançla gelen kısa duyurular (rozet, açılan bölüm/güçlendirici,
   * görev, Usta Bölümü…): kartta küçük çipler. `ikon` çizgi ikon adı.
   */
  duyurular?: { /** Ödül türü (meta `Odul['tur']`): Kazandın haber/kutu ayrımı için. */ tur?: string; ikon: string; metin: string; /** (Kancalar §C.5) Kandilden hemen sonra, "+N daha"ya gömülmez (mühür parçası). */ oncelikli?: boolean }[];
  /**
   * (Kancalar §C.3) Mühürler: yıldızlardan sonra damgalanır; `yeni` olanlar
   * bu kazançta basıldı. `tanitim`: ilk kez (6. bölüm) "Yeni: Mühürler".
   */
  muhurler?: { liste: (MuhurVM & { yeni: boolean })[]; tanitim: boolean; sancak: boolean; /** Usta'nın Eli ile kazanıldı: mühür basılmadı (satırın altında not). */ ustaEli?: boolean } | null;
  /**
   * (Kancalar §C.5) Kandil kazanımı: önceki → yeni bakiye, kazanç şeridinin
   * ilk çipi. `yildiz`/`muhur`: bu kazancın yeni yıldız/mühür kandilleri
   * (her biri için bir kandil çipe uçar); gerisi (mahalle, günlük) sayaca eklenir.
   */
  kandil?: { onceki: number; yeni: number; tanitim: boolean; yildiz?: number; muhur?: number } | null;
  /** (Kancalar §C.5) Kasabada yapılabilir iş var: "Kasabada yapılacak iş hazır!". */
  kasabaHazir?: boolean;
}

export interface KaybettinVM {
  bolumId: number;
  bolumAdi: string;
  /** İlerleme yüzdesi 0..1 (§6). */
  yuzde: number;
  /** En düşük ilerlemeli hedef ("3 kızıl kaldı"). */
  enZorHedef: HedefVM | null;
  /** Hayalet fitil: bulunmadı / bulundu / en az bir kez izlendi. */
  hayalet: 'yok' | 'var' | 'izlendi';
  /** 4. ve sonraki başarısızlıkta Kıvılcım Usta'nın Eli sunulur. */
  ustaEli: boolean;
  /** Coşku Serisi bu kayıpla sıfırlandı. */
  coskuSifirlandi: boolean;
  /**
   * (CAN-REKLAM §6) Bu kayıpta can düştü: başlık altında tek satır
   * "−1 can · 3 kaldı" (`kalan` düşüşten sonraki can). Can harcamayan
   * bölümde, sağlayıcı yokken ya da devamdan sonraki ikinci kayıpta null/yok.
   */
  can?: { kalan: number } | null;
  /**
   * (CAN-REKLAM §3, C7) "+5 hamle" düğmesi (seçim 'reklamHamle'): reklam
   * simgeli; `kart` (Usta kartı) ise simgesiz "Ücretsiz". Yalnız `ustaEli`
   * false iken, denemede bir kez, Günün Şenliği dışında ve reklam hazırken
   * (ya da kartla) verilir; yoksa null/yok.
   */
  reklamHamle?: { kart: boolean } | null;
  /**
   * (CAN-REKLAM §2, C5) Can kalmadı: "Tekrar dene" yerine "Can bitti"
   * düğmesi (seçim 'canBitti'; uygulama can panelini açar).
   */
  canBitti?: boolean;
  /**
   * (G3 eki) Gelir sağlayıcısı var: alttaki "Can yok, bekleme yok: tekrar her
   * zaman ücretsiz." notu çıkmaz (sağlayıcı varken yanlış olur). `can`,
   * `reklamHamle` ya da `canBitti` doluysa da çıkmaz; ücretsiz bölümde ve
   * devamdan sonraki ikinci kayıpta (alanlar boş) uygulama bunu true verir.
   */
  gelirVar?: boolean;
}

export interface DuraklatVM {
  bolumId: number;
  bolumAdi: string;
  hedefler: HedefVM[];
  /** Yeniden başlamak Coşku Serisi'ni bozar uyarısı. */
  coskuAktif: boolean;
  /** (Kancalar) Mühürler ve anlık durumları. */
  muhurler?: MuhurVM[];
  /** (Kancalar §C.3) Usta'nın Eli devamı: "Usta'nın Eli ile mühür basılmaz". */
  ustaEli?: boolean;
}

export type DuraklatSecimi = 'devam' | 'yeniden' | 'ayarlar' | 'harita';
export type KaybettinSecimi = 'tekrar' | 'harita' | 'ustaEli' | 'hayalet' | 'reklamHamle' | 'canBitti';

// ─────────────── Can, reklam, Mağaza (docs/CAN-REKLAM.md §6; G3) ───────────────

/** Can sayacı: harita hapı ve can panelinin büyük sayacı. */
export interface CanSayaciVM {
  sayi: number;
  /** En çok can (5): "3/5". */
  enCok: number;
  /** Sonraki cana kalan ms ("12:31"); can doluysa null (sayaç yok). */
  sonrakiMs: number | null;
}

/**
 * Can paneli / Can bitti (modal, `ekranlar/can.ts`). Satırlar sırayla:
 * reklam, doldur, [Bekle] (her zaman; seçim 'kapat').
 */
export interface CanVM extends CanSayaciVM {
  /** 'bitti': başlık "Canların bitti" (0 can); 'durum': "Canlar 3/5". */
  tur: 'bitti' | 'durum';
  /**
   * "Reklam izle · +1 can" satırı (seçim 'reklam'); null: satır yok (can dolu).
   *  - `hak`: bugün kalan hak; 0 → düğme yerine "Yarın yine" yazısı;
   *  - `hazir`: reklam şu an hazır; hak > 0 iken false → satır gizli;
   *  - `kart`: Usta kartı sahibi → "Ücretsiz +1 can", reklam simgesi yok
   *    (hazır her zaman true).
   */
  reklam: { hak: number; hazir: boolean; kart: boolean } | null;
  /** "Canları doldur · ₺29,99" (seçim 'doldur'); null: satır yok (can dolu ya da fiyat alınamadı). `fiyat` mağazanın yerel metni. */
  doldur: { fiyat: string } | null;
}

export type CanPaneliSecimi = 'reklam' | 'doldur' | 'kapat';

/** Mağaza'da bir ürün satırı: simge (id'den), ad, tek satır açıklama, fiyat düğmesi. */
export interface MagazaUrunVM {
  id: UrunId;
  /** Hazır metin (uygulama verir; iki dil). */
  ad: string;
  aciklama: string;
  /** Mağazanın yerel fiyat metni; null: henüz gelmedi (düğme pasif, "—"). */
  fiyat: string | null;
  /**
   *  - 'satilik': fiyat düğmesi (seçim `satinAl`);
   *  - 'sende': kalıcı ürün alınmış ("Sende var", düğme yok);
   *  - 'stokDolu': şu an verilemez: paket stok sınırını aşar ("Stok dolu"),
   *    `can_doldur` canlar doluyken ("Canların dolu");
   *  - 'yok': mağaza bu ürünü sunmuyor (pasif "Şu an yok").
   */
  durum: 'satilik' | 'sende' | 'stokDolu' | 'yok';
}

/** Mağaza (Ayarlar > Mağaza, `ekranlar/magaza.ts`): üç ürün satırı + altta geri yükleme. */
export interface MagazaVM {
  /** `URUN_IDLERI` sırasıyla. */
  urunler: MagazaUrunVM[];
  /** "Satın alımları geri yükle" düğmesi görünsün mü (seçim `geriYukle`). */
  geriYukle: boolean;
}

export type MagazaSecimi = { tur: 'satinAl'; id: UrunId } | { tur: 'geriYukle' } | { tur: 'kapat' };

// ───────────────────────── Ayarlar ─────────────────────────

export type MolaDakika = 0 | 30 | 45 | 60;

export interface AyarlarVM {
  /** Efekt sesi 0..1. */
  sfx: number;
  /** Müzik 0..1. */
  muzik: number;
  ortam: boolean;
  titresim: boolean;
  hareketiAzalt: boolean;
  /** Animasyon hızı: 1 Normal, 1.5 Hızlı. */
  hiz: 1 | 1.5;
  palet: Palet;
  ipuclari: boolean;
  /** Mola hatırlatıcısı (dakika); 0 = kapalı. */
  mola: MolaDakika;
  /** Mahalle başına Fener Koyu Defteri kartı açık mı (8). */
  defterKartlari: boolean[];
  /** (Kancalar §B.5) Mahalle başına kasaba kartı açık mı (8). */
  kasabaKartlari?: boolean[];
  depolama: 'bulut' | 'tarayici' | 'bellek';
  surum: string;
}

export type AyarDegisikligi = Partial<Pick<AyarlarVM, 'sfx' | 'muzik' | 'ortam' | 'titresim' | 'hareketiAzalt' | 'hiz' | 'palet' | 'ipuclari' | 'mola'>>;

/** Kayıt kodu içe aktarma önizlemesi. */
export type KayitOnizleme =
  | { gecerli: true; toplamYildiz: number; sonBolum: number; desen: number; kayitTarihi?: string; /** (Kancalar §D.6) */ muhur?: number; kasabaIs?: number; kandil?: number }
  | { gecerli: false; hata: string };

// ─────────────────── Oyun özeti (Ayarlar > Oyun özeti) ───────────────────

/** Özetin üst kutularından biri: biçimlenmiş etiket ve değer. */
export interface OyunOzetiSatiri {
  anahtar: 'ilkAcilis' | 'oturum' | 'oynananGun' | 'enYuksek' | 'oyunSuresi' | 'surum';
  etiket: string;
  deger: string;
}

/** Bölüm tablosunun bir satırı (yalnız ana bölümler). */
export interface OyunOzetiBolumu {
  id: number;
  /** Başlanan denemeler (süren deneme dahil). */
  deneme: number;
  kayip: number;
  /** Çıkış + bitmeden kapatılan deneme (süren deneme sayılmaz). */
  birakma: number;
  /** Biten denemelerin ortalama süresi (sn); biten yoksa null. */
  ortSure: number | null;
  kazanildi: boolean;
  /** Tablodaki en çok kayıp + bırakma (> 0) olan satır. */
  vurgu: boolean;
}

export interface OyunOzetiVM {
  /** Günlükte hiç olay yok. */
  bos: boolean;
  satirlar: OyunOzetiSatiri[];
  /** En son oynanan ana bölümler (en çok `OZET_BOLUM_SINIRI`, 8), numara sırasıyla. */
  bolumler: OyunOzetiBolumu[];
  /** Oynanmış ana bölüm sayısı (tabloya sığmayanlar dahil). */
  oynananBolum: number;
}

// ─────────────────── Nasıl oynanır / Defter ───────────────────

export interface NasilVM {
  /** Açılmış engeller (6. kart). */
  acikEngeller: EngelId[];
}

export type DefterSekmesi = 'desenler' | 'fitiller' | 'gokyuzu' | 'tablolar' | 'motifler' | 'defter';

export interface DefterVM {
  toz: number;
  desenler: { id: DesenId; parca: number; takili: boolean }[];
  fitiller: { id: FitilId; parca: number; secili: boolean }[];
  gokyuzleri: { id: GokyuzuId; acik: boolean; secili: boolean }[];
  tablolar: { bolumId: number; ad: string; nadirlik: Nadirlik }[];
  motifler: { motif: Motif; acik: boolean }[];
  /** Mahalle başına defter kartı açık mı (8). */
  kartlar: boolean[];
  /** (Kancalar §B.5) Mahalle başına kasaba kartı (sakinin mektubu) açık mı (8). */
  kasabaKartlari?: boolean[];
  /** Açılışta seçili sekme. */
  sekme?: DefterSekmesi;
}

export type TozHedefi = { tur: 'desen'; id: DesenId } | { tur: 'fitil'; id: FitilId };

// ───────────────────── Günlük / İstatistik ─────────────────────

export interface PaylasimVM {
  /** yyyymmdd */
  tarih: number;
  yildiz: Yildiz;
  kullanilanHamle: number;
  toplamHamle: number;
  /** En büyük reaksiyon R. */
  enBuyuk: number;
  /** Her hamlenin R değeri (●▲■ ızgarası). */
  reaksiyonlar: number[];
}

export interface GorevVM {
  metin: string;
  ilerleme: number;
  gerekli: number;
  tamam: boolean;
}

export interface GunlukVM {
  /** yyyymmdd */
  tarih: number;
  enIyi: number | null;
  yildiz: Yildiz;
  kazanildi: boolean;
  gorevler: GorevVM[];
  seri: SeriVM;
  /** Bugün oynandıysa paylaşım verisi. */
  paylasim: PaylasimVM | null;
  /** Dün ve önceki 6 gün (sandık vermez). */
  arsiv: { tarih: number; enIyi: number | null; yildiz: Yildiz }[];
}

export type GunlukSecimi = { tur: 'oyna'; tarih: number } | { tur: 'geri' };

export interface IstatistikVM {
  enUzunZincir: number;
  enBuyukReaksiyon: number;
  toplamHalka: number;
  toplamPatlama: number;
  enCokNesil: number;
  enIyiGunluk: number | null;
  toplamYildiz: number;
  bolumSkorlari: { id: number; ad: string; enIyi: number; yildiz: Yildiz }[];
  rozetler: { id: RozetId; acik: boolean }[];
}

/** Mahalle tamamlanınca açılan Fener Koyu Defteri kartı. */
export interface DefterKartiVM {
  mahalle: number;
  /** Mahalle ödülleri (her türden 1 güçlendirici). */
  oduller: OdulVM[];
  /** (Kancalar §B.5) `kasaba`: mahallenin 6 işi bitince sakinin mektubu. Varsayılan `defter`. */
  tur?: 'defter' | 'kasaba';
}

export type MolaSecimi = 'mola' | 'devam';

// ───────────────────── Geri çağırımlar ─────────────────────

/**
 * Arayüzün entegratöre bildirdiği eylemler. Hepsi isteğe bağlıdır; eksik
 * olanın düğmesi gizlenir ya da etkisiz kalır.
 */
export interface ArayuzGeriCagirim {
  /** HUD: duraklat düğmesi (ya da P tuşu). */
  duraklatIstendi(): void;
  /** HUD: güçlendirici düğmesi (ya da 1/2/3 tuşu). */
  guclendiriciSecildi(id: GuclendiriciId): void;
  /** HUD: dolu Körük'e dokunuldu (ya da K tuşu). */
  korukSecildi(): void;
  /** HUD: hedef seçimi (körük/kibrit/kalıp) iptal edildi. */
  secimIptal(): void;
  /** Herhangi bir ayar değişti (anında uygula, gecikmeli kaydet). */
  ayarDegisti(d: AyarDegisikligi): void;
  /** Ayarlar > Dil: seçim cihaza yazılır, kayıt hemen yazılır, sayfa yeniden yüklenir. */
  dilDegisti?(d: Dil): void;
  /** Ayarlar > İpuçları > Balonları yeniden izle. */
  balonlariSifirla(): void;
  /** Kayıt kodu (FTL1:…). */
  kayitKodu(): string;
  kayitOnizle(kod: string): KayitOnizleme;
  /** true = yüklendi. */
  kayitYukle(kod: string): boolean;
  ilerlemeyiSifirla(): void;
  /** Kazandın: saklı tablo varken oyuncunun seçimi (Sakla = yenisi). */
  tabloKarari(bolumId: number, sakla: boolean): void;
  /** Saklı Gece Tablosu küçük resmi (bölüm öncesi, defter). */
  tabloTuvali(bolumId: number): HTMLCanvasElement | null;
  /** Defter: desen tak/çıkar. Yeni görünüm modeli dönerse sayfa tazelenir. */
  desenTak(id: DesenId, tak: boolean): DefterVM | void;
  fitilSec(id: FitilId): DefterVM | void;
  gokyuzuSec(id: GokyuzuId): DefterVM | void;
  /** 10 toz = 1 parça. */
  tozHarca(h: TozHedefi): DefterVM | void;
}
