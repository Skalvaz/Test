/**
 * Ön yüz modülleri arasındaki sözleşme (P0, GDD §13.1). Uygulamayı (src/app)
 * yazan entegratör bu arayüzlere güvenir:
 *
 *   çekirdek (src/core) ──Olay[]──▶ OyunCizici (src/render) ──olay anı──▶ SesMotoru (src/audio)
 *        ▲                                │ geometri
 *        │ Hamle                          ▼
 *   uygulama (src/app) ◀──sürükleme── SurukleGirdi (src/input)
 *        │
 *        ├──▶ Arayüz (src/ui, DOM) + meta (src/meta, kayıt)
 *        └──▶ TabloCizici (src/tablo): temizlik günlüğünden ebru tablosu
 *
 * Ölçüler CSS pikselidir. Zaman: çekirdek tik, çizici ms (normal hızda eşit).
 * FİTİL dersi 1: çizici YALNIZ olaylarla görsel tahtasını günceller,
 * oynatma sonunda `sonraki` ile eşitler (geliştirme kipinde fark varsa
 * konsola hata yazar).
 */
import type { BolumVerisi, Hamle, Konum, Olay, Onizleme, OyunDurumu, Teknik, TemizlikKaydi } from '../core/types';

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

export type Palet = 'standart' | 'renkKoru';

export interface CiziciSecenek {
  hareketiAzalt: boolean;
  /** Animasyon hızı: 1 Normal, 1.5 Hızlı. */
  hiz: number;
  palet: Palet;
  /** Renk körlüğü motifleri her zaman mı (true) yalnız renk körü palette mi. */
  motifler: boolean;
  /** Otomatik kalite (parçacık sayısı, su dalgası). */
  kalite: 'oto' | 'yuksek' | 'dusuk';
}

/**
 * Oyun sahnesi çizici (src/render). Tek bir <canvas> üzerinde: su (tekne),
 * ceviz çerçeve, kâğıt/yağ/desen zemini, damlalar, önizleme, sudaki tablo
 * izi, parçacıklar, kutlama yazıları. DOM arayüzü bunun üstünde durur.
 */
export interface OyunCizici {
  /** Yeni bölüm: atölye teması (su tonu) ve tahta. */
  bolumKur(d: OyunDurumu, bolum: BolumVerisi): void;
  /** Animasyonsuz eşitleme. */
  durumGoster(d: OyunDurumu): void;
  /**
   * Olayları zaman çizelgesiyle oynatır; söz bittiğinde görsel tahta
   * `sonraki` ile eşitlenmiştir. Oynatma sürerken yeni çağrı gelirse önceki
   * anında bitirilir.
   */
  oynat(onceki: OyunDurumu, olaylar: readonly Olay[], sonraki: OyunDurumu): Promise<void>;
  /** Süren oynatmayı hızlandır (dokunma 2×, şölen 3×). 1 = normal. */
  hizlandir(carpan: number): void;
  /**
   * Sürükleme durumu (§3.5, §10.2):
   *  - kaynak: parmaktaki damla (uzayan metaball), null = sürükleme yok;
   *  - parmak: parmak konumu (CSS px);
   *  - hedefler: kaynağın GEÇERLİ hedefleri (yalnız bunlar hafifçe şişer);
   *  - onizleme: parmak geçerli bir hedefin üstündeyken çekirdeğin önizlemesi
   *    (sonuç rengi hayaleti, parlayan gruplar, özel hayaleti, etki alanı).
   */
  surukleGoster(s: {
    kaynak: Konum | null;
    parmak: { x: number; y: number } | null;
    hedefler: readonly Konum[];
    onizleme: Onizleme | null;
  }): void;
  /** Geçersiz hedefe bırakıldı: kaynak 3 kez titrer (ceza yok). */
  titret(h: Konum): void;
  /**
   * Hücre vurgusu. 'zorunlu': yalnız bunlarla oynanabilir (diğerleri
   * kararır); 'ipucu': boşta ipucu nabzı (iki damla + hayalet ok).
   */
  vurgula(hucreler: readonly Konum[] | null, kip: 'zorunlu' | 'ipucu'): void;
  /** Öğretici saydam el: yol boyunca sürükler (null = kapat). Döngüde oynar. */
  elGoster(yol: readonly Konum[] | null): void;
  /** "Bu hamle kazandırırdı" hayaleti (kaybettin ekranı, null = kapat). */
  hayaletHamle(h: Hamle | null): void;
  /** Klavye imleci (§3.2): 3 px altın odak halkası; null = gizle. */
  imlecGoster(h: Konum | null): void;
  /** Tahtanın ekran geometrisi (girdi isabet testi, arayüz yerleşimi). */
  geometri(): TahtaGeometrisi;
  /** Tahtaya ayrılan alan (HUD'lar çıkarılmış). Su tüm tuvali kaplar. */
  alanAyarla(r: Dikdortgen): void;
  /** Hedef kartlarının ekran konumları: toplanan damla buraya uçar (bezier). */
  hedefKonumlari(k: readonly { x: number; y: number }[]): void;
  secenekAyarla(s: Partial<CiziciSecenek>): void;
  /**
   * Bir olay görsel olarak gerçekleştiğinde (oynatma zaman çizelgesinde)
   * çağrılır: ses, HUD sayacı, titreşim buna bağlanır.
   */
  olayDinle(fn: (o: Olay) => void): void;
  /** Tahtayı karart (0 = açık, ~0,55 = panel arkası); 400 ms'de geçer. */
  karart(alfa: number): void;
  /** Kâğıt çekme anı (§9.5): tablo tuvali suya serilip kaldırılır. */
  kagitCek(tablo: HTMLCanvasElement | OffscreenCanvas | null): Promise<void>;
  /**
   * İlk dokunuşta donma olmasın (FİTİL dersi 3): açılış ekranı beklerken
   * bu bölümün sprite'larını ve su katmanını önden pişirir. Boyut değişirse
   * önbellek anahtarı (hücre boyu × DPR × palet) değişir, yeniden pişer.
   */
  onIsit(bolum: BolumVerisi): Promise<void>;
  /** Her karede uygulama çağırır. */
  kare(dtMs: number): void;
  yokEt(): void;
}

/**
 * Sürükleme girdisi (src/input). Pointer Events; 12 px eşik ve baskın eksen
 * (§3.2); masaüstünde fare sürükleme ya da dokun-dokun; klavye (§3.2).
 * Yalnız ilk pointerId izlenir. Çizim yapmaz: geri çağırımla uygulamaya
 * bildirir, uygulama çiziciyi ve çekirdeği sürer.
 */
export interface SurukleGeriCagirim {
  /** Bir damlaya basıldı (ya da dokun-dokun seçimi). */
  basladi(kaynak: Konum): void;
  /**
   * Parmak hareket etti. `hedef`: baskın eksendeki komşu (12 px eşiği
   * aşılmadıysa null). Uygulama önizlemeyi günceller.
   */
  surukleniyor(kaynak: Konum, hedef: Konum | null, parmak: { x: number; y: number }): void;
  /** Bırakıldı ya da ikinci dokunuş: hamle önerisi (geçerliliği uygulama denetler). */
  birakildi(h: Hamle): void;
  /** Eşik aşılmadan bırakıldı, pointercancel ya da Esc. */
  iptal(): void;
  /** Herhangi bir dokunuş (boşta zamanlayıcısı, oynatmayı hızlandırma, ses kilidi). */
  dokunuldu(): void;
  /** Zorunlu ilk hamle açıkken kümenin dışına basıldı (öğretim hatırlatması). */
  kisitliBasildi?(h: Konum): void;
  /** Klavye imleci değişti (null = gizli). */
  imlecDegisti?(h: Konum | null): void;
}

export interface SurukleGirdiSecenek {
  /** Dinlenecek öğe (tuvalin üstündeki katman). touch-action:none uygulanır. */
  hedef: HTMLElement;
  geometri: () => TahtaGeometrisi;
  /** Güncel durum (seçilebilirlik için). null = girdi kapalı. */
  durum: () => OyunDurumu | null;
  geriCagirim: SurukleGeriCagirim;
}

export interface SurukleGirdi {
  /** 'acik' normal; 'kapali' oynatma sırasında (dokunuş yalnız hızlandırır). */
  kipAyarla(kip: 'acik' | 'kapali'): void;
  /** Öğretim: yalnız bu hamle yapılabilir (null = serbest) (§12.1). */
  zorunluAyarla(h: Hamle | null): void;
  yokEt(): void;
}

/** Arayüz sesleri (§10.3). */
export type ArayuzSesi =
  | 'dugme'
  | 'ac'
  | 'kapa'
  | 'yildiz1'
  | 'yildiz2'
  | 'yildiz3'
  | 'kazandin'
  | 'kaybettin'
  | 'sonHamle'
  | 'hedefTamam'
  | 'kagitCek';

/**
 * Ses motoru (src/audio). Tamamen WebAudio sentezi (§10.3, §10.4); ses
 * dosyası yok. İlk kullanıcı dokunuşunda `ac()` çağrılır (iOS kilidi);
 * ses yoksa her çağrı sessizce hiçbir şey yapmaz.
 */
export interface SesMotoru {
  ac(): void;
  /** Çizici olay anında çağırır; olaydan sese eşleme modülün içindedir. */
  olay(o: Olay): void;
  /** Sürükleme sesleri: damla tutuldu, geçerli hedefe girdi (sonuç rengiyle), geçersiz bırakma. */
  tutuldu(): void;
  hedefeGirdi(sonucRengi: number | null): void;
  gecersiz(): void;
  arayuz(tur: ArayuzSesi): void;
  /** Ortam (su + atölye) ve müzik (isteğe bağlı ud/ney pedi). */
  ortam(acik: boolean, atolye?: 'uskudar' | 'bursa'): void;
  muzik(acik: boolean): void;
  ayarla(s: { sfx?: number; muzik?: number; ortam?: boolean; sessiz?: boolean }): void;
  /** Sekme gizlenince askıya al / geri gelince sürdür. */
  askiya(gizli: boolean): void;
  /** Tahta boyutu: sesler hücre x'ine göre stereoda konumlanır. */
  tahtaBoyutu(w: number, h: number): void;
}

/** Tablo isteği (§9): temizlik günlüğünden belirlenimli ebru tablosu. */
export interface TabloIstegi {
  bolumId: number;
  atolye: 'uskudar' | 'bursa';
  /** Tablo tohumu: `tabloTohumu(bolumId, denemeNo, puan)` (katalog.ts) — aynı günlük + tohum = aynı tablo. */
  tohum: number;
  gunluk: readonly TemizlikKaydi[];
  /** Tahta boyutu (günlük koordinatlarını tuvale eşlemek için). */
  w: number;
  h: number;
  yildiz: 0 | 1 | 2 | 3;
  /** Desen hedefi tamamlandıysa motif (çiçek ebrusu). */
  motif?: 'lale' | 'karanfil';
}

export interface TabloSonucu {
  tuval: HTMLCanvasElement | OffscreenCanvas;
  /** Kullanılan teknikler (galeri künyesi). */
  teknikler: Teknik[];
  nadirlik: 0 | 1 | 2;
}

/**
 * Ebru tablosu çizici (src/tablo). Saf girdiden belirlenimli: aynı istek
 * piksel piksel aynı tabloyu verir (RNG yalnız `tohum`dan; Math.random yok).
 * Bölüm sonunda tek sefer offscreen'de çizilir; galeri küçük resimleri
 * önbelleklenir.
 */
export interface TabloCizici {
  /** Tam tablo, eşzamanlı (testler, galeri büyütme). Varsayılan 512×768 CSS px, DPR ≤ 2. */
  tabloCiz(istek: TabloIstegi, boyut?: { w: number; h: number }): TabloSonucu;
  /**
   * Aynı tablo, kare başına `dilimMs` (varsayılan 8 ms) dilimlerle (§9.3):
   * kâğıt çekme animasyonu sürerken çizilir, kare düşmez. Sonuç
   * `tabloCiz` ile piksel piksel aynıdır.
   */
  tabloCizParcali(istek: TabloIstegi, boyut?: { w: number; h: number }, dilimMs?: number): Promise<TabloSonucu>;
  /** Galeri küçük resmi (önbellekli; anahtar bolumId + tohum + boyut). */
  kucukResim(istek: TabloIstegi, w: number, h: number): HTMLCanvasElement | OffscreenCanvas;
  /** Sudaki canlı iz (§9.3): oyun sırasında temizlikleri suya damga olarak ekler. */
  izEkle?(kayit: TemizlikKaydi): void;
}
