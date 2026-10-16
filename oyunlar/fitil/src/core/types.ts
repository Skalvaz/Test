/**
 * FİTİL çekirdek sözleşmesi (P0). Kaynak: docs/GDD.md §2, §3, §6, §8.1, §16.2.
 *
 * Bu dosya bütün paketlerin ortak dilidir: çekirdek (core) bu tipleri üretir,
 * çizici/ses/arayüz yalnız okur. Alan eklemek serbesttir; var olan alanın
 * anlamını değiştirmek sözleşme değişikliğidir (entegratöre sor).
 *
 * Kurallar:
 *  - Çekirdekte zaman birimi TİK'tir (normal hızda 1 tik = 1 ms). ms sabitleri
 *    yalnız çizicide bulunur.
 *  - Çekirdek DOM, Date, performance, Math.random ve kayan nokta kullanmaz.
 *  - Koordinatlar: x soldan 0..w−1, y yukarıdan 0..h−1; i = y·w + x.
 */

export type Renk = 0 | 1 | 2 | 3 | 4 | 5;
/** 0 yatay (—), 1 dikey (|), 2 çapraz ↗ (x+1, y−1), 3 çapraz ↘ (x+1, y+1). */
export type Eksen = 0 | 1 | 2 | 3;
export interface Konum {
  x: number;
  y: number;
}

export type OzelTur = 'yok' | 'roket' | 'kasimpati' | 'yildiz';

/** Hücre içeriği. Yıldız topunun rengi −1'dir (joker). */
export type Icerik =
  | { tur: 'kapsul'; renk: Renk | -1; isi: number; ozel: OzelTur; eksen: Eksen }
  | { tur: 'islak'; renk: Renk }
  | { tur: 'fener' }
  | { tur: 'kaya'; kat: 1 | 2 | 3 }
  | { tur: 'kova'; kat: 1 | 2 }
  | { tur: 'devFisek'; dolum: number; kapasite: number }
  | { tur: 'is' };

export type IcerikTuru = Icerik['tur'];

export interface Hucre {
  /** Tahta şekli dışında (`#`). Delikte başka katman yoktur. */
  delik: boolean;
  icerik: Icerik | null;
  /** Kafes örtüsü; yalnız kapsülün üstünde olur, kapsülü sabitler. */
  kafes: boolean;
  /** Aydınlatma döşemesi kat sayısı (0 = yok). */
  doseme: 0 | 1 | 2;
  /** Işık Deseni hücresi: istenen renk, yoksa −1. */
  desenRengi: number;
  desenBoyali: boolean;
  /** Barut izi kimliği (`izler` dizisindeki indeks), yoksa −1. */
  izIndeksi: number;
  /** Bu bölümde bu hücrede patlama oldu mu (kalıcı ışık izi, görsel). */
  isikIzi: boolean;
}

export type Hedef =
  | { tur: 'topla'; renk: Renk | 'hepsi'; adet: number }
  | { tur: 'kafes' }
  | { tur: 'kaya' }
  | { tur: 'fener'; adet: number }
  | { tur: 'aydinlat' }
  | { tur: 'desen'; motif?: Motif }
  | { tur: 'devFisek'; adet: number }
  | { tur: 'is' }
  | { tur: 'zincirleme'; esik: number; adet: number }
  | { tur: 'halka'; adet: number }
  | { tur: 'puan'; puan: number };

/**
 * Hedefin canlı durumu. "Hepsini temizle" türlerinde (kafes, kaya, aydinlat,
 * is, desen) `gerekli` başlangıçtaki toplamdır (is yayıldıkça artar),
 * `ilerleme` temizlenen miktardır. Tamamlanınca `ilerleme === gerekli`.
 */
export interface HedefDurumu {
  hedef: Hedef;
  ilerleme: number;
  gerekli: number;
  tamam: boolean;
}

export type Motif = 'lale' | 'kayik' | 'mart' | 'fener' | 'carkifelek' | 'burc';

export interface HavaOlayiVerisi {
  tur: 'meltem' | 'cisenti';
  eksen: 'satir' | 'sutun';
  hatlar: number[];
  periyot: number;
  baslangic: number;
}

export interface HavaDurumu extends HavaOlayiVerisi {
  /** Tetiklenmeye kalan hamle; 1 iken uyarı gösterilir. */
  sayac: number;
  /** `hatlar` içinde sıradaki indeks. */
  sira: number;
}

export interface Kurallar {
  dortKomsu?: boolean;
  yalnizHalka?: boolean;
  gizliIsi?: boolean;
  caprazSiniri?: number | null;
  soguma?: number;
}

export interface BolumIstatistigi {
  enUzunZincir: number;
  enBuyukReaksiyon: number;
  halkaSayisi: number;
  toplamPatlama: number;
  isiPatlamasi: number;
  enCokNesil: number;
  roket: number;
  kasimpati: number;
  yildiz: number;
  kombinasyon: number;
  /** Her oyuncu hamlesinin reaksiyon boyutu R (paylaşım ızgarası için). */
  reaksiyonlar: number[];
  korukKullanim: number;
  kafesKirilan: number;
  kayaKirilan: number;
  fenerToplanan: number;
  devFisekAtesi: number;
  /** Kullanılan güçlendiriciler (yıldız sınırı için). */
  guclendirici: number;
  /** Kıvılcım Usta'nın Eli kullanıldı mı (en fazla 1★). */
  ustaEli: boolean;
}

export interface OyunDurumu {
  bolumId: number;
  denemeNo: number;
  w: number;
  h: number;
  hucreler: Hucre[];
  esik: number;
  renkSayisi: number;
  ozelEsikleri: [number, number, number];
  dogumAgirliklari: number[];
  yardim: number;
  kalanHamle: number;
  /** Bölümün başlangıç hamle sayısı. */
  toplamHamle: number;
  puan: number;
  hedefler: HedefDurumu[];
  korukDolum: number;
  korukKapasite: number;
  /** mulberry32 iç durumu (uint32). Dolum, karıştırma, is, final bu akıştan. */
  rng: number;
  hamleNo: number;
  izler: { hucreler: number[]; yandi: boolean[] }[];
  havaOlaylari: HavaDurumu[];
  fenerDogum: { kalan: number; sahadaEnFazla: number } | null;
  /** Fener çıkış sütunları. */
  cikislar: number[];
  kurallar: Kurallar;
  istatistik: BolumIstatistigi;
  bitti: null | 'kazanc' | 'kayip';
  /** P1 eki: Final Gösterisi (§7.3) çalıştı mı (ikinci kez çalışmaz). */
  finalYapildi?: boolean;
}

export type Hamle =
  | { tur: 'fitil'; yol: Konum[]; halka: boolean }
  | { tur: 'ciftDokunus'; hucre: Konum }
  | { tur: 'koruk'; merkez: Konum }
  | { tur: 'kibrit'; hucre: Konum }
  | { tur: 'kalip'; hucre: Konum; eksen: Eksen };

export type PatlamaNedeni = 'fitil' | 'isi' | 'vurus' | 'iz' | 'devFisek' | 'final' | 'kibrit';
export type KomboTuru = 'yildizHatti' | 'kalinRoket' | 'devKasimpati' | 'roketYagmuru' | 'bahce' | 'buyukFinal';

/**
 * Olaylar `t` (tik) değerine göre azalmayan sırada gelir. Bir hamlenin olayları
 * t = 0'dan başlar. Yerçekimi kuyruk boşaldıktan sonra gelir; ondan sonraki
 * aşamalar (fener toplama, is, hava, final turları) `YERCEKIMI_PAYI` tik
 * sonra başlar, böylece çizici düşmeyi canlandırabilir.
 *
 * Çizici yalnız olaylarla kendi görsel tahtasını güncelleyebilmelidir;
 * oynatma sonunda yine de `sonraki` durumla eşitlenir.
 */
export type Olay = { t: number } & (
  | { tur: 'fitilBasladi'; yol: Konum[]; halka: boolean; renk: number }
  /** Alev k. düğüme (1 tabanlı) ulaştı; ses notası ve alev başı için. */
  | { tur: 'dugumYandi'; hucre: Konum; k: number }
  | {
      tur: 'patlama';
      hucre: Konum;
      renk: number;
      neden: PatlamaNedeni;
      nesil: number;
      puan: number;
      /** Patlayan kapsül özel taşsa türü. */
      ozel: OzelTur;
      /** Fitil düğümüyse sıra (1 tabanlı), değilse 0. */
      k: number;
    }
  | { tur: 'isindi'; hucre: Konum; isi: number; kizgin: boolean }
  /** Hava olayı ya da soğuma gibi doğrudan ısı ataması. */
  | { tur: 'isiDegisti'; hucre: Konum; isi: number }
  /**
   * Hücredeki kapsül özel taşa döndü (dönüşüm, kalıp, kombinasyon, final).
   * P1 eki `isi`: dönüşümden sonraki ısı (dönüşümde 0, diğerlerinde korunur).
   */
  | { tur: 'ozelOlustu'; hucre: Konum; ozel: OzelTur; eksen: Eksen; renk: number; isi?: number }
  | { tur: 'ozelTetiklendi'; hucre: Konum; ozel: OzelTur; eksen: Eksen; hedefRenk?: number }
  | { tur: 'yuklendi'; hucre: Konum; ozel: OzelTur }
  | { tur: 'kombinasyon'; hucre: Konum; kombo: KomboTuru }
  | { tur: 'isiDalgasi'; merkez: Konum; yaricap: number }
  | { tur: 'engelHasar'; hucre: Konum; engel: 'kaya' | 'kova'; kalan: number }
  | { tur: 'kafesKirildi'; hucre: Konum }
  | { tur: 'kurudu'; hucre: Konum; renk: number }
  | { tur: 'dosemeAydinlandi'; hucre: Konum; kalan: number }
  | { tur: 'desenBoyandi'; hucre: Konum; renk: number }
  | { tur: 'izYandi'; hucre: Konum }
  | { tur: 'devFisekDoldu'; hucre: Konum; dolum: number; kapasite: number }
  | { tur: 'devFisekFirladi'; hucre: Konum }
  | { tur: 'isTemizlendi'; hucre: Konum }
  | { tur: 'isYayildi'; hucre: Konum }
  | {
      tur: 'yercekimi';
      dusenler: { den: Konum; e: Konum }[];
      /** sanalY: canlandırma için tahta üstündeki başlangıç satırı (−1, −2…). */
      doganlar: { hucre: Konum; icerik: Icerik; sanalY: number }[];
    }
  | { tur: 'fenerToplandi'; hucre: Konum }
  | { tur: 'havaOlayi'; olay: 'meltem' | 'cisenti'; eksen: 'satir' | 'sutun'; hat: number; uyari: boolean }
  | { tur: 'karistirma'; esleme: { den: Konum; e: Konum }[]; yenidenRenk: { hucre: Konum; renk: number }[] }
  /** P1 eki `gerekli`: hedefin güncel gerekli miktarı (is yayılınca artar). */
  | { tur: 'hedefIlerledi'; indeks: number; deger: number; tamam: boolean; gerekli?: number }
  /**
   * Patlama dışı puan (patlamanın kendi puanı `patlama.puan`'dadır). Toplam:
   * Δpuan = Σ patlama.puan + Σ puanEklendi.miktar. P1 eki `hucre`: puanın
   * kaynağı (engel, kafes, döşeme, desen, oluşum, kombinasyon, fener…).
   */
  | { tur: 'puanEklendi'; miktar: number; neden: 'reaksiyon' | 'halka' | 'kalanHamle' | 'diger'; kademe?: ReaksiyonKademesi; hucre?: Konum }
  /** Körük dolumu arttı (ISI patlamaları, §6 Körük Göstergesi; GDD §3.1 tablosundaki "§6.10" atfı hatalı); dolum === kapasite iken gösterge dolu. */
  | { tur: 'korukDoldu'; dolum: number; kapasite: number }
  | { tur: 'korukKullanildi'; merkez: Konum }
  | { tur: 'guclendirici'; guc: 'kibrit' | 'kalip'; hucre: Konum }
  | { tur: 'finalBasladi'; kalanHamle: number }
  /**
   * Hamle özeti (her eylemin sonunda bir kez). boyut = R: fitil düğümü
   * olmayan kapsül patlamaları. zirveT: en çok patlamanın düştüğü 90 tiklik
   * pencerenin ortası. merkez: o penceredeki patlamaların ağırlık merkezi.
   */
  | { tur: 'reaksiyon'; boyut: number; zirveT: number; merkez: Konum; kombo: boolean; kademe: ReaksiyonKademesi | null }
  | { tur: 'bolumBitti'; sonuc: 'kazanc' | 'kayip' }
);

export type OlayTuru = Olay['tur'];
export type ReaksiyonKademesi = 'guzel' | 'harika' | 'muhtesem' | 'senlik';

export type YolHatasi = 'kisa' | 'renk' | 'komsu' | 'tekrar' | 'halkaGerekli' | 'capraz' | 'zincirlenemez';

/** Çizerken önizleme (§3.9). */
export interface Onizleme {
  /** Yol bırakılırsa geçerli mi (uzunluk ≥ 3 ve kurallar). */
  gecerli: boolean;
  /** Zincir rengi (joker hepsi ise −1). */
  renk: number;
  /** Yalnız yol düğümlerinin ilk dalgasıyla eşiğe ulaşacak, yol dışı hücreler. */
  esikHucreler: Konum[];
  /** Yol dışı hücrelere eklenecek ısı (titreşim/nabız için). */
  isinacaklar: { hucre: Konum; artis: number }[];
  /** Dönüşüm oluşacaksa son düğümdeki özel taş hayaleti. */
  ozelHayalet: { hucre: Konum; ozel: OzelTur; eksen: Eksen } | null;
  /** Yoldaki mevcut özel taşların etki hücreleri (kesik çizgi). */
  etkiAlanlari: { kaynak: Konum; hucreler: Konum[] }[];
  /** Yolda iki özel taş varsa birleşecek kombinasyon. */
  kombo: KomboTuru | null;
}

export interface HamleSonucu {
  durum: OyunDurumu;
  olaylar: Olay[];
}


// ───────────────── Bölüm Mühürleri (docs/KANCALAR.md §A.3) ─────────────────
// Yalnız veri tipleri: çekirdek mühürleri değerlendirmez (meta/muhur.ts).

/**
 * Ölçüler. Her ölçünün izin verilen kapsamı `meta/muhur.ts` `OLCU_KAPSAMLARI`.
 *  - patlama        kapsül patlaması (renk süzgeci: o renkte)
 *  - isiPatlamasi   ısıyla patlayan kapsül
 *  - halka          çizilen halka
 *  - olusum         zincir dönüşümüyle oluşan özel taş (ozel süzgeci)
 *  - ozelAtes       tetiklenen özel taş (ozel süzgeci; yoksa hepsi)
 *  - caprazRoket    tetiklenen ↗/↘ roket
 *  - kombo          kombinasyon (kombo süzgeci)
 *  - kafes kaya engelHasar doseme desen is fener devFisek izliDevFisek
 *    caprazEngel kurutma   engel ve çevre sayaçları (HamleIzi alanları)
 *  - koruk          Körük kullanımı
 *  - guclendirici   kullanılan güçlendirici (Kibrit, Kalıp, Geri Sar; istatistikten)
 *  - R              tek eylemin reaksiyon boyutu
 *  - nesil          tek eylemdeki en yüksek nesil
 *  - zincir         tek fitilin düğüm sayısı (halka süzgeciyle halka boyu)
 *  - kisaZincir     ≤ 3 düğümlü fitil sayısı (kısıt: "hiç 3'lük zincir çizmeden")
 *  - kalanHamle     kazanç anında (final öncesi) kalan hamle
 */
export type MuhurOlcusu =
  | 'patlama'
  | 'isiPatlamasi'
  | 'halka'
  | 'olusum'
  | 'ozelAtes'
  | 'caprazRoket'
  | 'kombo'
  | 'kafes'
  | 'kaya'
  | 'engelHasar'
  | 'doseme'
  | 'desen'
  | 'is'
  | 'fener'
  | 'devFisek'
  | 'izliDevFisek'
  | 'caprazEngel'
  | 'kurutma'
  | 'koruk'
  | 'guclendirici'
  | 'R'
  | 'nesil'
  | 'zincir'
  | 'kisaZincir'
  | 'kalanHamle';

/** oyun: oyun boyunca toplam; hamle: tek eylemde en büyük; son: kazanç anında. */
export type MuhurKapsami = 'oyun' | 'hamle' | 'son';

/** Süzgeç olarak `eylem` alanında kullanılabilecek eylemler. */
export type MuhurEylemi = 'fitil' | 'ciftDokunus' | 'koruk';

/**
 * Bir mühür koşulu (bölüm JSON'unda `muhurler[i]`). `enAz` (≥) ya da
 * `enCok` (≤) alanlarından TAM OLARAK biri bulunur; `enCok` yalnız
 * `kapsam: 'oyun'` ile (kısıt: "en çok n kez", 0 = hiç).
 */
export interface MuhurKosulu {
  olcu: MuhurOlcusu;
  kapsam: MuhurKapsami;
  enAz?: number;
  enCok?: number;
  /** Süzgeçler (yalnız ilgili ölçülerde; `muhurKosuluDogrula` denetler). */
  renk?: Renk;
  halka?: boolean;
  eylem?: MuhurEylemi;
  ozel?: 'roket' | 'kasimpati' | 'yildiz';
  kombo?: KomboTuru;
  /** Tasarımcı işareti: şansa bağlı (dolum/kaskad). Bölüm başına en çok 1. */
  sans?: boolean;
  /** Elle metin (yoksa `muhurMetni` üretir). Tek satır, ≤ 34 karakter. */
  metin?: string;
}

/** Bölüm verisi (§8.1). Anahtarlar ASCII. */
export interface BolumVerisi {
  id: number;
  ad: string;
  mahalle: number;
  tur: 'ogretim' | 'tanitim' | 'normal' | 'zor' | 'rahatlama' | 'final' | 'usta' | 'gunluk' | 'sonsuz';
  w: number;
  h: number;
  renkSayisi: number;
  esik: number;
  hamle: number;
  tohum: number;
  yardim: number;
  ozelEsikleri: [number, number, number];
  dogumAgirliklari?: number[];
  hedefler: Hedef[];
  /** h satır; her satırda tek boşlukla ayrılmış w simge (§8.1 tablosu). */
  duzen: string[];
  sabitKapsuller?: { x: number; y: number; renk: number; ozel?: 'roket' | 'kasimpati' | 'yildiz'; eksen?: Eksen; isi?: number }[];
  onIsi?: [number, number, number][];
  zemin?: {
    dosemeler?: [number, number, 1 | 2][];
    desen?: { motif: Motif; hucreler: [number, number, number][] };
    barutIzleri?: [number, number][][];
  };
  fenerDogum?: { kalan: number; sahadaEnFazla: number };
  cikislar?: number[];
  devFisekKapasite?: number;
  havaOlaylari?: HavaOlayiVerisi[];
  korukKapasitesi?: number;
  kurallar?: Kurallar;
  bayram?: boolean;
  botBandi: [number, number];
  yildizEsikleri: [number, number];
  /**
   * Ek (GDD K22): yıldız eşikleri elle seçildi (öğretim 1–5: Acemi/Usta
   * dağılımından, §7.4'ün Usta p50/p85 kuralından sapma). `npm run kalibre`
   * bu bölümün `yildizEsikleri`'ni yazmaz. Oyun kuralını etkilemez.
   */
  elleEsik?: boolean;
  /**
   * Ek (GDD K24): yıldız eşiği kuralı. `'k24'`: 2★ = min(Usta p50, Acemi
   * kazançlarının p50'si), 3★ = Usta p85 (§7.4'ün 2★'ından sapma; 6–25).
   * `npm run kalibre` bu bayrağı taşıyan bölümde K24'ü uygular
   * (`--kural k24` bayrağı da yazar). Yoksa §7.4 (Usta p50/p85). Oyun
   * kuralını etkilemez; `elleEsik` ile birlikte kullanılmaz.
   */
  esikKurali?: 'k24';
  ipuclari?: { tetik: 'baslangic' | 'ilkHamleSonrasi' | 'bosta5sn' | 'kisaYol' | 'kazanc'; metin: string; el?: [number, number][] }[];
  /** Bölüm 1–2: ilk hamlede yalnız bu hücrelerden yol başlatılabilir (§15). */
  zorunluIlkHamle?: [number, number][];
  sonrakiTanitim?: string;
  /**
   * P4a eki: öğretim senaryosu bayrakları (§15). `ilkReaksiyonVurgusu`:
   * ilk hamlenin reaksiyonunda kural dışı (yalnız görsel) yavaş çekim ve
   * "Harika!" yazısı zorlanır (Bölüm 3, `senaryo.ilkReaksiyonVurgusu`).
   */
  senaryo?: { ilkReaksiyonVurgusu?: boolean };
  /**
   * P4a eki: geçici bölüm (henüz tasarlanmadı). Statik doğrulamadan geçer,
   * bot bantları `npm run dogrula` içinde varsayılan olarak denetlenmez.
   * Bölümü tasarlayan ajan bu alanı siler.
   */
  taslak?: boolean;
  /**
   * Ek (Bölüm Mühürleri, docs/KANCALAR.md §A): [Çırak, Kalfa, Usta]
   * koşulları; yalnız 6–40. Çekirdek kuralını etkilemez (meta değerlendirir).
   */
  muhurler?: readonly MuhurKosulu[];
}

export interface BolumYukleSecenek {
  /** Coşku Serisi: merkeze en yakın düz kapsül yatay roket olarak başlar. */
  cosku?: boolean;
}
