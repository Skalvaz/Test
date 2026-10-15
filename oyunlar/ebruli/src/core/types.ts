/**
 * EBRULİ çekirdek sözleşmesi (P0). Kaynak: docs/GDD.md §2–§9, §13.2, §15.1.
 *
 * Bu dosya bütün paketlerin ortak dilidir: çekirdek (core) bu tipleri üretir,
 * çizici/ses/arayüz/tablo yalnız okur. Alan eklemek serbesttir; var olan
 * alanın anlamını değiştirmek sözleşme değişikliğidir (entegratöre sor).
 *
 * Kurallar (GDD §13.3):
 *  - Çekirdekte zaman birimi TİK'tir (normal hızda 1 tik = 1 ms). ms sabitleri
 *    yalnız çizicide bulunur.
 *  - Çekirdek DOM, Date, performance, Math.random ve kayan nokta sabiti
 *    kullanmaz; yalnız tamsayı.
 *  - Koordinatlar: x soldan 0..w−1, y yukarıdan 0..h−1; i = y·w + x.
 *  - `hamleUygula` girdiyi değiştirmez; aynı (durum, hamle) aynı sonucu verir.
 */

/**
 * Renk kodu (3 bit). Ham boyalar: Kırmızı 1, Sarı 2, Mavi 4. Karışık:
 * Turuncu 3 (K+S), Mor 5 (K+M), Yeşil 6 (S+M). Mürekkep 7. Karışım bit
 * VEYA'dır: iki farklı ham boya `a | b`. Lale renksizdir (renk 0).
 */
export type Renk = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HamRenk = 1 | 2 | 4;
export type KarisikRenk = 3 | 5 | 6;

export interface Konum {
  x: number;
  y: number;
}

/** Özel taşlar (§5). Mürekkep bir özel taştır (renk 7). */
export type OzelTur = 'yok' | 'tarak' | 'girdap' | 'lale' | 'murekkep';
/** Tarak yönü: yatay satırı, dikey sütunu tarar. Diğer türlerde 'yatay'. */
export type Yon = 'yatay' | 'dikey';

/**
 * Tahtadaki damla. `id` bölüm içinde kalıcıdır (yeni doğan ya da karışımla
 * doğan damla yeni id alır); çizici animasyon eşlemesi için kullanır.
 *  - Düz damla: renk 1–6, ozel 'yok'.
 *  - Tarak / Girdap: grubun karışık rengini taşır (3, 5, 6) ve o rengin
 *    gruplarına katılır.
 *  - Lale: renk 0 (renksiz), gruplara katılmaz.
 *  - Mürekkep: renk 7, ozel 'murekkep'; eşleşmez, karışmaz.
 */
export interface Damla {
  id: number;
  renk: Renk | 0;
  ozel: OzelTur;
  yon: Yon;
}

/** Hücre içeriği: damla ya da sabit engel. */
export type Icerik = { tur: 'damla'; damla: Damla } | { tur: 'mermer'; can: 1 | 2 | 3 };
export type IcerikTuru = Icerik['tur'];

/**
 * Hücre katmanları (§2.2): zemin (delik, kâğıt, yağ, desen) + içerik.
 */
export interface Hucre {
  /** Tekne şekli dışında (`#`). Delikte başka katman yoktur. */
  delik: boolean;
  icerik: Icerik | null;
  /** Kâğıt katmanı (§6.1 "kâğıda al"): 0 yok, 1–2 kat. */
  kagit: 0 | 1 | 2;
  /** Yağ lekesi (§6.3): bu hücredeki damla karışıma katılamaz. */
  yag: boolean;
  /** Desen hücresi (§7.3): istenen karışık renk; yoksa 0. */
  desen: KarisikRenk | 0;
  desenBoyali: boolean;
}

export type Hedef =
  /** Renk topla: grup ya da özel güçle temizlenen o renkte damla sayılır (§7.1). */
  | { tur: 'topla'; renk: KarisikRenk; adet: number }
  /** Kâğıda al: bütün kâğıt katlarını kaldır (§7.2). */
  | { tur: 'kagit' }
  /** Desen: bütün desen hücrelerini boya (§7.3). */
  | { tur: 'desen'; motif: Motif }
  /** Puan: en az bu kadar puan (§7.4). */
  | { tur: 'puan'; puan: number };

export type Motif = 'lale' | 'karanfil';

/**
 * Hedefin canlı durumu. "Hepsini temizle" türlerinde (kagit, desen)
 * `gerekli` başlangıçtaki toplamdır, `ilerleme` kaldırılan miktardır.
 */
export interface HedefDurumu {
  hedef: Hedef;
  ilerleme: number;
  gerekli: number;
  tamam: boolean;
}

/**
 * Bölüm kuralları (§3, §4). Bölüm verisinden kopyalanır; oyun boyunca
 * değişmez.
 */
export interface Kurallar {
  /**
   * K1: karışık + eksik ham boya → Mürekkep karışımı açık mı. Kapalıyken
   * yalnız "ham + ham = karışık" geçerlidir (tanıtım: Bölüm 11).
   */
  murekkep: boolean;
  /**
   * K3 garanti (akıllı yardım, §4.7): hamle sonunda tahtada en az bu kadar
   * hazır karışım çifti olsun diye son dolumda doğan damlaların rengi
   * belirlenimli olarak seçilir. 0–3.
   */
  garanti: number;
  /** Özel taş eşikleri [tarak, girdap, lale] (K7: varsayılan [4, 5, 6]). */
  ozelEsikleri: [number, number, number];
}

/**
 * Temizlik günlüğü kaydı (§9.1): ebru tablosunun tek girdisi. Her grup,
 * özel ateşleme ve mürekkep patlaması bir kayıttır; tablo bu listeden
 * belirlenimli olarak yeniden çizilir (görüntü saklanmaz).
 */
export interface TemizlikKaydi {
  /** Hamle sırası (0 tabanlı; Ebru Şöleni −1). */
  hamle: number;
  /** Kaskat adımı (1 tabanlı). */
  k: number;
  tur: 'grup' | 'tarak' | 'girdap' | 'lale' | 'murekkep' | 'birlesim';
  /** Ağırlık merkezi ×10 (tamsayı; tahta koordinatı). */
  x10: number;
  y10: number;
  renk: Renk | 0;
  /** Temizlenen damla sayısı. */
  boyut: number;
  /** Tarak yönü (yalnız tarak). */
  yon?: Yon;
}

export interface BolumIstatistigi {
  /** Eşleşme veren hamle sayısı. */
  eslesenHamle: number;
  enUzunKaskat: number;
  enBuyukGrup: number;
  temizlenenDamla: number;
  tarak: number;
  girdap: number;
  lale: number;
  murekkep: number;
  birlesim: number;
  /** Garanti (akıllı yardım) kaç hamlede devreye girdi. */
  garantiKullanimi: number;
  karistirma: number;
  /** Usta'nın Eli kullanıldı mı (en fazla 1★, §8.4). */
  ustaEli: boolean;
}

export interface OyunDurumu {
  bolumId: number;
  denemeNo: number;
  w: number;
  h: number;
  hucreler: Hucre[];
  /** Doğum ağırlıkları [K, S, M, T, Mo, Y] (tamsayı; 0 = o renk doğmaz). */
  dogumAgirliklari: [number, number, number, number, number, number];
  kurallar: Kurallar;
  kalanHamle: number;
  /** Bölümün başlangıç hamle sayısı. */
  toplamHamle: number;
  puan: number;
  hedefler: HedefDurumu[];
  /** mulberry32 iç durumu (uint32). Dolum, garanti, karıştırma, şölen bu akıştan. */
  rng: number;
  hamleNo: number;
  /** Sıradaki damla kimliği. */
  sonrakiId: number;
  /** Temizlik günlüğü (tablo, §9.1). */
  gunluk: TemizlikKaydi[];
  istatistik: BolumIstatistigi;
  bitti: null | 'kazanc' | 'kayip';
  /** Ebru Şöleni (§8.3) çalıştı mı (ikinci kez çalışmaz). */
  solenYapildi: boolean;
}

/**
 * Hamle (§3.2): kaynak damlayı yatay/dikey komşu hedefe sürükle. Düz damlada
 * karışımdır; özel taşta ateşleme ya da birleşimdir. Dokun-dokun girdisi de
 * aynı hamleye çevrilir.
 */
export type Hamle = { tur: 'surukle'; kaynak: Konum; hedef: Konum };

/** Geçersiz hamle nedeni (§3.3); çekirdek hamle harcamaz, girdi titretir. */
export type HamleHatasi =
  | 'bitti'
  | 'hamleYok'
  | 'konum'
  | 'komsuDegil'
  | 'bos'
  | 'mermer'
  | 'yag'
  | 'ayniRenk'
  | 'ortakBilesen'
  | 'murekkepKapali'
  | 'karisikKarisik'
  | 'karismaz';

export type KomboTuru =
  | 'tarakTarak'
  | 'tarakGirdap'
  | 'girdapGirdap'
  | 'laleTarak'
  | 'laleGirdap'
  | 'laleLale'
  | 'murekkepTarak'
  | 'murekkepGirdap'
  | 'murekkepLale'
  | 'murekkepMurekkep';

/**
 * Temizlik nedeni. Özel güçle temizlenen hücrenin nedeni o gücün türüdür;
 * birleşim alanındakiler 'birlesim'; Ebru Şöleni taraklarının temizledikleri
 * 'solen' (§8.3).
 */
export type TemizlikNedeni = 'grup' | 'tarak' | 'girdap' | 'lale' | 'murekkep' | 'birlesim' | 'solen';

/** Kaskat kutlaması (§8.2): k=2 Güzel, 3 Nefis, 4 Harika, 5+ Şaheser. */
export type KaskatKademesi = 'guzel' | 'nefis' | 'harika' | 'saheser';

/** Ebru tablosu teknikleri (§9.2). */
export type Teknik = 'battal' | 'gelgit' | 'tarakli' | 'sal' | 'bulbulYuvasi' | 'cicek';

/**
 * Olaylar `t` (tik) değerine göre azalmayan sırada gelir; bir hamlenin
 * olayları t = 0'dan başlar. Aynı t'deki olaylar listedeki sırayla uygulanır.
 *
 * ÇİZİCİ YALNIZ OLAYLARLA görsel tahtasını güncelleyebilmelidir (§13.2):
 * her olay, uygulanması için gereken bilgiyi taşır (ör. `yercekimi` doğan
 * damlanın tamamını). Oynatma sonunda yine de `sonraki` durumla eşitlenir;
 * `src/core/oynatici.ts` (P1) başvuru indirgeyicisi ve bulanık testi
 * (görsel tahta == durum) bunu güvenceler.
 *
 * "Tahta" etkisi (olayUygula):
 *  - karisti: kaynak boşalır; hedefteki damla { id: yeniId, renk: sonuc,
 *    ozel: sonuc === 7 ? 'murekkep' : 'yok' } olur.
 *  - ozelSuruklendi: kaynak boşalır; `tasindi` ise özel taş hedef hücreye
 *    geçer (hedefin eski damlası `temizlendi` ile ayrıca kalkar).
 *  - temizlendi: hücre içeriği boşalır.
 *  - ozelOlustu: hücreye yeni özel taş yazılır (hücre o anda boştur).
 *  - mermerHasar: can = kalan; 0 ise içerik boşalır.
 *  - kagitAlindi: kagit = kalan. yagKalkti: yag = false.
 *  - desenBoyandi: desenBoyali = true.
 *  - yercekimi: önce bütün `den`ler okunup boşaltılır, sonra `e`lere yazılır;
 *    ardından doğanlar boş yuvalara yazılır.
 *  - karistirma: eşleme aynı anda uygulanır (permütasyon).
 *  - donustu: hücredeki damla verilen damlaya döner (Lale birleşimi, şölen).
 */
export type Olay = { t: number } & (
  | {
      tur: 'karisti';
      kaynak: Konum;
      hedef: Konum;
      /** Kaynak ve hedefin eski renkleri. */
      a: Renk;
      b: Renk;
      sonuc: Renk;
      yeniId: number;
    }
  /**
   * Özel taşa dokunan sürükleme (§5.3, K9). Üç biçim:
   *  - özel → düz damla: `ozel` kaynağın türü; Tarak/Girdap hedefe taşınır
   *    (`tasindi: true`; hedefin damlası ardından `temizlendi` ile kalkar),
   *    Lale ve Mürekkep yerinde kalır (`tasindi: false`).
   *  - düz damla → özel (`ters: true`): `ozel` HEDEFİN türü; hiçbir şey
   *    taşınmaz, özel taş hedefte (yerinde) ateşlenir; Lale kaynağın rengini alır.
   *  - özel → özel: kaynak hedefe taşınır (`tasindi: true`), ardından
   *    `birlesim` olayı hedefte.
   */
  | {
      tur: 'ozelSuruklendi';
      kaynak: Konum;
      hedef: Konum;
      ozel: OzelTur;
      tasindi: boolean;
      ters?: boolean;
    }
  /** Bir grup eşleşti (aynı adımdaki bütün gruplar aynı t'de). */
  | { tur: 'eslesti'; renk: KarisikRenk; hucreler: Konum[]; k: number; merkez: Konum }
  | {
      tur: 'temizlendi';
      hucre: Konum;
      /** Temizlenen damlanın kimliği, rengi, özel türü. */
      id: number;
      renk: Renk | 0;
      ozel: OzelTur;
      neden: TemizlikNedeni;
      k: number;
      puan: number;
    }
  | { tur: 'ozelOlustu'; hucre: Konum; damla: Damla }
  | {
      tur: 'ozelTetiklendi';
      hucre: Konum;
      ozel: OzelTur;
      yon: Yon;
      /** Lale: temizlenecek renk. */
      hedefRenk?: Renk;
      /** Etki alanı (çizici süpürme/girdap canlandırması için). */
      alan: Konum[];
    }
  | { tur: 'birlesim'; hucre: Konum; kombo: KomboTuru; alan: Konum[] }
  /** Bir hücredeki damla başka bir damlaya döndü (Lale birleşimi, şölen). */
  | { tur: 'donustu'; hucre: Konum; damla: Damla }
  | { tur: 'mermerHasar'; hucre: Konum; kalan: 0 | 1 | 2 }
  | { tur: 'kagitAlindi'; hucre: Konum; kalan: 0 | 1; renk: Renk | 0 }
  | { tur: 'yagKalkti'; hucre: Konum }
  | { tur: 'desenBoyandi'; hucre: Konum; renk: KarisikRenk }
  /** Kaskat adımı başladı (k ≥ 2): kutlama yazısı ve hicaz notası. */
  | { tur: 'kaskat'; k: number; kademe: KaskatKademesi | null }
  | {
      tur: 'yercekimi';
      /** Düşen/kayan damlalar (çapraz kayma dahil: den ve e farklı sütunda olabilir). */
      dusenler: { den: Konum; e: Konum }[];
      /** sanalY: canlandırma için tahta üstündeki başlangıç satırı (−1, −2…). */
      doganlar: { hucre: Konum; damla: Damla; sanalY: number }[];
    }
  /** Ölü tahta (§4.8): geçerli hamle kalmadı, belirlenimli karıştırma. */
  | { tur: 'karistirma'; esleme: { den: Konum; e: Konum }[] }
  | { tur: 'hedefIlerledi'; indeks: number; deger: number; tamam: boolean }
  /** Temizlik dışı puan (özel üretimi, engel, desen, şölen…). */
  | { tur: 'puanEklendi'; miktar: number; neden: 'ozel' | 'engel' | 'desen' | 'solen' | 'diger'; hucre?: Konum }
  | { tur: 'solenBasladi'; kalanHamle: number }
  /**
   * Hamle özeti (her eylemin SON olayı): toplam temizlenen damla, en uzun
   * kaskat, eşleşme oldu mu, ağırlık merkezi (kamera/ses için).
   */
  | { tur: 'hamleOzeti'; temizlenen: number; kaskat: number; eslesme: boolean; merkez: Konum }
  | { tur: 'bolumBitti'; sonuc: 'kazanc' | 'kayip' }
);

export type OlayTuru = Olay['tur'];

/**
 * Sürüklerken önizleme (§3.5): doğumsuz çözümün sonucu. Oyuncu bırakmadan
 * önce sonucu görür ("aha" anı); geçersiz hedefler hiç vurgulanmaz.
 */
export interface Onizleme {
  gecerli: boolean;
  hata: HamleHatasi | null;
  /** Karışım hamlesinde oluşacak renk (özel sürüklemede null). */
  sonuc: Renk | null;
  /** Sonucun düşeceği hücre (kaynak alttaysa hedef bir hücre iner, §3.4). */
  sonucHucre: Konum | null;
  /** Doğumsuz çözümün İLK adımında eşleşecek gruplar (parlar). */
  gruplar: { renk: KarisikRenk; hucreler: Konum[] }[];
  /** Doğumsuz çözümde temizlenecek bütün hücreler (kaskat ve özel dahil). */
  temizlenecek: Konum[];
  /** Grup bir özel taş üretecekse hayaleti. */
  ozelHayalet: { hucre: Konum; ozel: OzelTur; yon: Yon; renk: Renk | 0 } | null;
  /** Özel sürüklemede ya da birleşimde etki alanı (kesik çizgi). */
  etkiAlani: Konum[];
  kombo: KomboTuru | null;
  /** Hedef ilerlemesi tahmini (hedef indeksi → artış), HUD nabzı için. */
  hedefArtisi: number[];
}

/** Hazır (olumlu) hamle: önizlemede en az bir grup eşleşir (§4.7). */
export interface OlumluHamle {
  hamle: Hamle;
  /** Doğumsuz çözümde temizlenen damla sayısı. */
  temizlenen: number;
}

export interface HamleSonucu {
  durum: OyunDurumu;
  olaylar: Olay[];
}

/**
 * Bölüm verisi (§15.1). Anahtarlar ASCII. Düzen simgeleri:
 *   `.` rastgele damla · `#` delik · `1 2 4 3 5 6 7` sabit düz damla (renk
 *   kodu) · `X1 X2 X3` mermer (can).
 * Zemin katmanları ayrı listelerdedir; özel taşlar `damlalar` ile konur.
 */
export interface BolumVerisi {
  id: number;
  ad: string;
  atolye: 'uskudar' | 'bursa';
  tur: 'ogretim' | 'tanitim' | 'normal' | 'zor' | 'rahatlama';
  w: number;
  h: number;
  hamle: number;
  tohum: number;
  /** Doğum ağırlıkları [K, S, M, T, Mo, Y] (K2: varsayılan [20, 20, 20, 11, 11, 11]). */
  dogum: [number, number, number, number, number, number];
  /** K3 garanti (0–3). */
  garanti: number;
  /** K1: Mürekkep karışımı açık mı (Bölüm 11'den sonra true). */
  murekkep: boolean;
  /** K7: [tarak, girdap, lale]; yoksa [4, 5, 6]. */
  ozelEsikleri?: [number, number, number];
  hedefler: Hedef[];
  /** h satır; her satırda tek boşlukla ayrılmış w simge. */
  duzen: string[];
  /** Sabit başlangıç özel taşları (öğretim); hücre düzende bir damla simgesi taşımalı. */
  ozeller?: { x: number; y: number; ozel: Exclude<OzelTur, 'yok'>; renk?: KarisikRenk; yon?: Yon }[];
  zemin?: {
    kagit?: [number, number, 1 | 2][];
    yag?: [number, number][];
    desen?: { motif: Motif; hucreler: [number, number, KarisikRenk][] };
  };
  /** Öğretim: ilk hamle yalnız bu (kaynak → hedef) olabilir (§12.1). */
  zorunluIlkHamle?: { kaynak: [number, number]; hedef: [number, number] };
  ipuclari?: { tetik: 'baslangic' | 'ilkHamleSonrasi' | 'bosta5sn' | 'ozelOlusunca' | 'kazanc'; metin: string; el?: [number, number][] }[];
  sonrakiTanitim?: string;
  /** Usta bot kazanma bandı (%) (§14.4). */
  botBandi: [number, number];
  /** Acemi bot alt sınırı (%) (§14.4, FİTİL dersi 4). */
  acemiAlt: number;
  /** [2★, 3★] puan eşikleri (§8.4). */
  yildizEsikleri: [number, number];
  /** Eşikler elle seçildi (öğretim); `kalibre` yazmaz. */
  elleEsik?: boolean;
  /** Geçici bölüm: statik doğrulamadan geçer, bot bantları denetlenmez. */
  taslak?: boolean;
}
