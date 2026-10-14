/**
 * Ön yüz modülleri arasındaki sözleşme (P0). Uygulamayı (src/app) yazan
 * entegratör bu arayüzlere güvenir:
 *
 *   çekirdek (src/core) ──Olay[]──▶ OyunCizici (src/render) ──olay anı──▶ SesMotoru (src/audio)
 *        ▲                                │ geometri
 *        │ Hamle                          ▼
 *   uygulama (src/app) ◀──yol/dokunuş── YolCizici (src/input)
 *        │
 *        └──▶ Arayüz (src/ui, DOM) + meta (src/meta, kayıt)
 *
 * Ölçüler CSS pikselidir. Zaman: çekirdek tik, çizici ms (normal hızda eşit).
 */
import type { BolumVerisi, Konum, Olay, Onizleme, OyunDurumu } from '../core/types';

export interface Dikdortgen {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tahtanın ekrandaki yeri: sol üst köşe ve hücre boyu. */
export interface TahtaGeometrisi {
  x: number;
  y: number;
  /** Hücre kenarı (CSS px). */
  hucre: number;
  w: number;
  h: number;
}

export type Palet = 'standart' | 'renkKoru' | 'yuksekKontrast';

export interface CiziciSecenek {
  hareketiAzalt: boolean;
  /** Animasyon hızı: 1 Normal, 1.5 Hızlı. */
  hiz: number;
  palet: Palet;
  /** Otomatik kalite (parçacık sayısı, parıltı). */
  kalite: 'oto' | 'yuksek' | 'dusuk';
  /** (P2a ek) Takılı havai fişek desenleri (katalog DesenId); gökte bunlardan seçilir. */
  desenler?: readonly string[];
  /** (P2a ek) Fitil görünümü (katalog FitilId); yalnız fitil katmanını değiştirir. */
  fitil?: string;
}

/**
 * Oyun sahnesi çizici (P2). Tek bir <canvas> üzerinde: gökyüzü, kasaba,
 * deniz, fişek sandığı (tahta), kapsüller, fitil, önizleme, efektler,
 * kamera. DOM arayüzü bunun üstünde durur.
 */
export interface OyunCizici {
  /** Yeni bölüm: sahneyi (mahalle teması) ve tahtayı kur. */
  bolumKur(d: OyunDurumu, bolum: BolumVerisi): void;
  /** Animasyonsuz eşitleme. */
  durumGoster(d: OyunDurumu): void;
  /**
   * Olayları zaman çizelgesiyle oynatır; söz bittiğinde görsel tahta
   * `sonraki` ile eşitlenmiştir. Oynatma sürerken yeni çağrı gelirse önceki
   * anında bitirilir.
   */
  oynat(onceki: OyunDurumu, olaylar: Olay[], sonraki: OyunDurumu): Promise<void>;
  /** Süren oynatmayı hızlandır (dokunma 2×, final 4×). 1 = normal. */
  hizlandir(carpan: number): void;
  /** Çizilen yol ve önizleme; boş yol = temizle. */
  yolGoster(yol: readonly Konum[], halka: boolean, renk: number, onizleme: Onizleme | null): void;
  /** Parmak ucu (köz parçacıkları); null = parmak kalktı. */
  parmak(p: { x: number; y: number } | null): void;
  /**
   * Hücre vurgusu. 'zorunlu': yalnız bunlar başlatılabilir (diğerleri
   * kararır); 'ipucu': parıltı dalgası; 'secim': güçlendirici/körük hedefi.
   */
  vurgula(hucreler: readonly Konum[] | null, kip: 'zorunlu' | 'ipucu' | 'secim'): void;
  /** Öğretici saydam el animasyonu (null = kapat). Döngüde oynar. */
  elGoster(yol: readonly Konum[] | null): void;
  /** "Bu çizgi kazandırırdı" hayalet fitili (null = kapat). */
  hayaletFitil(yol: readonly Konum[] | null, halka: boolean): void;
  /** Tahtanın ekran geometrisi (girdi isabet testi, arayüz yerleşimi). */
  geometri(): TahtaGeometrisi;
  /** Tahtaya ayrılan alan (HUD'lar çıkarılmış). Gökyüzü/kasaba tüm tuvali kaplar. */
  alanAyarla(r: Dikdortgen, gokBandi: Dikdortgen): void;
  /** Hedef kartlarının ekran konumları: patlayan kapsülden kıvılcım uçuşu için. */
  hedefKonumlari(k: readonly { x: number; y: number }[]): void;
  secenekAyarla(s: Partial<CiziciSecenek>): void;
  /**
   * Bir olay görsel olarak gerçekleştiğinde (oynatma zaman çizelgesinde)
   * çağrılır: ses, HUD sayacı, titreşim buna bağlanır.
   */
  olayDinle(fn: (o: Olay) => void): void;
  /** Yönetmen kamerası yavaş çekime girip çıktığında (ses alçak geçiren için). */
  kameraDinle(fn: (yavas: boolean) => void): void;
  /** Gökyüzünde havai fişek (kazanç, mahalle şovu, harita). */
  havaiFisek(x: number, y: number, renk: number, desen?: string): void;
  /** Her karede uygulama çağırır. */
  kare(dtMs: number): void;
  yokEt(): void;
  /**
   * (P2a ek) Sonraki `oynat` çağrısında yönetmen kamerasını koşulsuz
   * çalıştır (öğretim: bölüm 1 ısı tadı ve bölüm 3 ilk reaksiyon, §15).
   */
  yonetmenZorla?(): void;
  /** (P2a ek) Tahtayı karart (0 = açık, ~0,6 = panel arkası); 400 ms'de geçer. */
  karart?(alfa: number): void;
  /** (P2a ek) Gökte bir havai fişek patladığında (uzak patlama sesi için). */
  fisekDinle?(fn: (x: number, y: number, desen: string) => void): void;
}

/**
 * P2b ekledi: yolun neden değiştiği (ses ve görsel tepki için). Her değişim
 * ayrı bir `yolDegisti` çağrısıdır; hızlı kaydırmada atlanan hücreler de
 * tek tek bildirilir, böylece her düğüm kendi notasını çalar.
 *  - basladi: ilk düğüm (|yol| = 1)
 *  - eklendi / geriAlindi: |yol| bir arttı / azaldı (ses: dugumEklendi(|yol|) / geriAlindi(|yol|))
 *  - halkaKapandi / halkaAcildi: `halka` değişti, düğümler aynı
 *  - temizlendi: yol sessizce boşaldı (özel taşa dokunuş, kip değişimi); `birakildi`/`iptal` gelmez
 */
export type YolDegisimi = 'basladi' | 'eklendi' | 'geriAlindi' | 'halkaKapandi' | 'halkaAcildi' | 'temizlendi';

export interface YolGeriCagirim {
  /** Yol her değiştiğinde (ekleme, geri alma, halka aç/kapa). `degisim` P2b eki. */
  yolDegisti(yol: readonly Konum[], halka: boolean, degisim?: YolDegisimi): void;
  /** Parmak kalktı; uygulama geçerliliği doğrular (|yol| < 3 → iptal sesi). */
  birakildi(yol: readonly Konum[], halka: boolean): void;
  /** pointercancel / Esc. */
  iptal(): void;
  /** Özel taşa 300 ms içinde iki dokunuş (≤ 0,3 hücre hareket). */
  ciftDokunus(h: Konum): void;
  /** Özel taşa ilk dokunuş (ipucu balonu için). */
  ozelDokunus?(h: Konum): void;
  /** 'secim' kipinde dokunulan hücre (körük/kibrit/kalıp hedefi). */
  hucreSecildi(h: Konum): void;
  /** Parmak ucu konumu (CSS px); null = kalktı. */
  parmak(p: { x: number; y: number } | null): void;
  /** Herhangi bir dokunuş (boşta zamanlayıcısı, oynatmayı hızlandırma). */
  dokunuldu?(): void;
  /**
   * P2b eki — klavye imleci (§13.7) değişti; null = gizli (fare/dokunuş
   * kullanılınca gizlenir). Çizici imleç hücresine 3 px krem odak halkası çizer.
   */
  imlecDegisti?(h: Konum | null): void;
}

/**
 * Yol çizici (P2, src/input). Pointer Events + klavye; §3.3 kuralları
 * (0,42 hücre isabet dairesi, 0,25 hücre örnekleme, 0,6 hücre/22,5° yapışma,
 * geri alma, halka, çaprazSiniri, dortKomsu). Yalnız ilk pointerId izlenir.
 */
export interface YolCiziciSecenek {
  /** Dinlenecek öğe (tuvalin üstündeki katman). touch-action:none uygulanır. */
  hedef: HTMLElement;
  geometri: () => TahtaGeometrisi;
  /** Güncel durum (zincirlenebilirlik için). null = girdi kapalı. */
  durum: () => OyunDurumu | null;
  geriCagirim: YolGeriCagirim;
}

export interface YolCizici {
  /** 'cizim' normal; 'secim' hedef hücre seçimi; 'kapali' oynatma sırasında. */
  kipAyarla(kip: 'cizim' | 'secim' | 'kapali'): void;
  /**
   * İlk hamle kısıtı (§15): yalnız bu hücrelerden yol başlatılabilir. P2b
   * yorumu: "vurgulu küme içindeki her geçerli yol" — kısıt açıkken yol
   * kümenin dışına da uzatılamaz.
   */
  zorunluAyarla(hucreler: readonly Konum[] | null): void;
  /** P2b eki — klavye imlecinin hücresi; null = imleç gizli. */
  imlec?(): Konum | null;
  yokEt(): void;
}

/**
 * Ses motoru (P2, src/audio). Tamamen WebAudio sentezi (§12.3). İlk
 * kullanıcı dokunuşunda `ac()` çağrılır; ses yoksa her çağrı sessizce
 * hiçbir şey yapmaz.
 */
export interface SesMotoru {
  ac(): void;
  /** Çizici olay anında çağırır; olaydan sese eşleme modülün içindedir. */
  olay(o: Olay): void;
  /** Çizim sesleri. k: düğüm sırası (1 tabanlı). */
  dugumEklendi(k: number): void;
  geriAlindi(k: number): void;
  halkaKapandi(k: number): void;
  ozelEsigi(tur: 'roket' | 'kasimpati' | 'yildiz'): void;
  iptal(): void;
  tutusma(): void;
  /** Arayüz sesleri. */
  arayuz(tur: 'dugme' | 'ac' | 'kapa' | 'yildiz1' | 'yildiz2' | 'yildiz3' | 'kazandin' | 'kaybettin' | 'sandik' | 'parca' | 'sonHamle' | 'hedefTamam' | 'korukDoldu'): void;
  /** Yönetmen kamerası: ana yolu alçak geçirenden geçir. */
  yavasCekim(acik: boolean): void;
  /** Ortam (kalabalık + deniz) ve üretken müzik. */
  ortam(acik: boolean): void;
  muzik(acik: boolean): void;
  ayarla(s: { sfx?: number; muzik?: number; ortam?: boolean; sessiz?: boolean }): void;
  /** Sekme gizlenince askıya al / geri gelince sürdür. */
  askiya(gizli: boolean): void;
  /**
   * P2b eki — tahta boyutu (bolumKur'da çağrılır): sesler hücre x'ine göre
   * stereoda konumlanır, roketin kenara çarpma ("çat") anı hesaplanır.
   * Çağrılmazsa varsayılan 7×9 (§2.1) kabul edilir.
   */
  tahtaBoyutu?(w: number, h: number): void;
}
