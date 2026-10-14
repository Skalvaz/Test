/**
 * Ortak katalog (P0): mahalleler, gökyüzü temaları, havai fişek desenleri,
 * fitil görünümleri, güçlendiriciler. Kimlikler (id) kayıtta saklanır;
 * DEĞİŞTİRME, yalnız ekle. Kaynak: GDD §9, §10.1, §10.3, §13.1.
 */

export interface Mahalle {
  id: string;
  ad: string;
  /** Siluet ve vurgu rengi. */
  vurgu: string;
  gokyuzu: GokyuzuId;
  /** Haritada/tabloda siluet öğeleri (çizim ipucu). */
  siluet: string;
  /** Fener Koyu Defteri kartı başlığı. */
  defter: string;
}

export type GokyuzuId = 'ayIsigi' | 'laleMoru' | 'denizMavisi' | 'bakirSaat' | 'atesBocegi' | 'yildizYagmuru' | 'kizilDuman' | 'altinSafak';

export const GOKYUZU: Record<GokyuzuId, { ad: string; ust: string; alt: string }> = {
  ayIsigi: { ad: 'Ay Işığı', ust: '#0B1030', alt: '#1E2A5A' },
  laleMoru: { ad: 'Lale Moru', ust: '#1A0F33', alt: '#3A1A5C' },
  denizMavisi: { ad: 'Deniz Mavisi', ust: '#081A2E', alt: '#123A4F' },
  bakirSaat: { ad: 'Bakır Saat', ust: '#1A1020', alt: '#4A2A1A' },
  atesBocegi: { ad: 'Ateş Böceği', ust: '#0A1A12', alt: '#1F3A22' },
  yildizYagmuru: { ad: 'Yıldız Yağmuru', ust: '#0B0B2A', alt: '#2A1450' },
  kizilDuman: { ad: 'Kızıl Duman', ust: '#1A0A0A', alt: '#4A1A14' },
  altinSafak: { ad: 'Altın Şafak', ust: '#1A1030', alt: '#5A3A1A' },
};

/** 8 mahalle × 5 bölüm (mahalle indeksi = BolumVerisi.mahalle). */
export const MAHALLELER: readonly Mahalle[] = [
  { id: 'iskele', ad: 'İskele', vurgu: '#3AA8FF', gokyuzu: 'ayIsigi', siluet: 'ahşap iskele, kayıklar', defter: 'Fener alayı geleneği' },
  { id: 'carsi', ad: 'Çarşı', vurgu: '#B266FF', gokyuzu: 'laleMoru', siluet: 'kubbeler, kemerler', defter: 'Mahya: minareler arasına gerilen ışık yazıları' },
  { id: 'liman', ad: 'Liman', vurgu: '#2EE07A', gokyuzu: 'denizMavisi', siluet: 'vinçler, gemi direkleri', defter: 'Liman gecelerinde kayık fenerleri' },
  { id: 'saatKulesi', ad: 'Saat Kulesi', vurgu: '#D9A441', gokyuzu: 'bakirSaat', siluet: 'kule, kadran', defter: 'Kasaba saat kulelerinin hikâyesi' },
  { id: 'bahceler', ad: 'Bahçeler', vurgu: '#FFB020', gokyuzu: 'atesBocegi', siluet: 'çardaklar, ağaçlar', defter: 'Hıdırellez ateşi ve dilek ağaçları' },
  { id: 'tepe', ad: 'Tepe', vurgu: '#FF5FB4', gokyuzu: 'yildizYagmuru', siluet: 'yel değirmeni, rasathane', defter: 'Nevruz ateşi' },
  { id: 'fabrika', ad: 'Fabrika', vurgu: '#FF4D4D', gokyuzu: 'kizilDuman', siluet: 'bacalar, depo', defter: 'Osmanlı baruthaneleri' },
  { id: 'kale', ad: 'Kale', vurgu: '#FFF3D6', gokyuzu: 'altinSafak', siluet: 'surlar, burçlar', defter: 'Donanma şenlikleri: şehri ışıklarla süsleme' },
];

export const BOLUM_PER_MAHALLE = 5;
export const ANA_BOLUM_SAYISI = 40;
/** Usta bölümleri: id 101..108, her 15★'da bir açılır. */
export const USTA_BOLUM_IDLERI = [101, 102, 103, 104, 105, 106, 107, 108] as const;
export const USTA_YILDIZ_ADIMI = 15;

export type DesenId =
  | 'kasimpati' | 'palmiye' | 'sogut' | 'halka' | 'ciftHalka' | 'kalp' | 'spiral' | 'yildiz'
  | 'selale' | 'marti' | 'lale' | 'karanfil' | 'papatya' | 'kuyrukluYildiz' | 'carkifelek' | 'atesBocegi'
  | 'gul' | 'yagmur' | 'tac' | 'hilal' | 'dalga' | 'kelebek' | 'fenerAlayi' | 'saat';

/** 24 havai fişek deseni (§10.3); ilk üçü baştan açık. Her desen 3 parça. */
export const DESENLER: readonly { id: DesenId; ad: string; baslangicta: boolean }[] = [
  { id: 'kasimpati', ad: 'Kasımpatı', baslangicta: true },
  { id: 'palmiye', ad: 'Palmiye', baslangicta: true },
  { id: 'halka', ad: 'Halka', baslangicta: true },
  { id: 'sogut', ad: 'Söğüt', baslangicta: false },
  { id: 'ciftHalka', ad: 'Çift Halka', baslangicta: false },
  { id: 'kalp', ad: 'Kalp', baslangicta: false },
  { id: 'spiral', ad: 'Spiral', baslangicta: false },
  { id: 'yildiz', ad: 'Yıldız', baslangicta: false },
  { id: 'selale', ad: 'Şelale', baslangicta: false },
  { id: 'marti', ad: 'Martı', baslangicta: false },
  { id: 'lale', ad: 'Lale', baslangicta: false },
  { id: 'karanfil', ad: 'Karanfil', baslangicta: false },
  { id: 'papatya', ad: 'Papatya', baslangicta: false },
  { id: 'kuyrukluYildiz', ad: 'Kuyruklu Yıldız', baslangicta: false },
  { id: 'carkifelek', ad: 'Çarkıfelek', baslangicta: false },
  { id: 'atesBocegi', ad: 'Ateş Böceği', baslangicta: false },
  { id: 'gul', ad: 'Gül', baslangicta: false },
  { id: 'yagmur', ad: 'Yağmur', baslangicta: false },
  { id: 'tac', ad: 'Taç', baslangicta: false },
  { id: 'hilal', ad: 'Hilal', baslangicta: false },
  { id: 'dalga', ad: 'Dalga', baslangicta: false },
  { id: 'kelebek', ad: 'Kelebek', baslangicta: false },
  { id: 'fenerAlayi', ad: 'Fener Alayı', baslangicta: false },
  { id: 'saat', ad: 'Saat', baslangicta: false },
];
export const DESEN_PARCA = 3;
export const EN_FAZLA_TAKILI_DESEN = 6;

export type FitilId = 'kenevir' | 'altinTel' | 'simsek' | 'gokkusagi' | 'atesBocegi' | 'laleDali' | 'denizKopugu' | 'ejderKuyrugu' | 'denizFeneri';

/** Fitil görünümleri (§10.3); `denizFeneri` yalnız Fener Nöbeti 30 ödülü. */
export const FITILLER: readonly { id: FitilId; ad: string; baslangicta: boolean; sandiktan: boolean }[] = [
  { id: 'kenevir', ad: 'Kenevir İp', baslangicta: true, sandiktan: false },
  { id: 'altinTel', ad: 'Altın Tel', baslangicta: false, sandiktan: true },
  { id: 'simsek', ad: 'Şimşek', baslangicta: false, sandiktan: true },
  { id: 'gokkusagi', ad: 'Gökkuşağı', baslangicta: false, sandiktan: true },
  { id: 'atesBocegi', ad: 'Ateş Böceği', baslangicta: false, sandiktan: true },
  { id: 'laleDali', ad: 'Lale Dalı', baslangicta: false, sandiktan: true },
  { id: 'denizKopugu', ad: 'Deniz Köpüğü', baslangicta: false, sandiktan: true },
  { id: 'ejderKuyrugu', ad: 'Ejder Kuyruğu', baslangicta: false, sandiktan: true },
  { id: 'denizFeneri', ad: 'Deniz Feneri', baslangicta: false, sandiktan: false },
];

export type GuclendiriciId = 'kibrit' | 'kalip' | 'geriSar';
export const GUCLENDIRICILER: readonly { id: GuclendiriciId; ad: string; acilis: number; hediye: number }[] = [
  { id: 'kibrit', ad: 'Kibrit', acilis: 7, hediye: 2 },
  { id: 'kalip', ad: 'Fişek Kalıbı', acilis: 12, hediye: 1 },
  { id: 'geriSar', ad: 'Geri Sar', acilis: 20, hediye: 1 },
];
export const GUCLENDIRICI_STOK_SINIRI = 3;

/** Kapsül renkleri (§2.3, §13.1). */
export const KAPSUL_RENKLERI = [
  { ad: 'Kızıl', sekil: 'daire', ana: '#FF4D4D', acik: '#FFB3A8', koyu: '#8A1C1C', renkKoru: '#E8631C' },
  { ad: 'Kehribar', sekil: 'yildiz', ana: '#FFB020', acik: '#FFE08A', koyu: '#8A5A00', renkKoru: '#F0C419' },
  { ad: 'Zümrüt', sekil: 'damla', ana: '#2EE07A', acik: '#A8FFD0', koyu: '#0E6B37', renkKoru: '#1BB38A' },
  { ad: 'Gök', sekil: 'elmas', ana: '#3AA8FF', acik: '#B5E0FF', koyu: '#0F4A80', renkKoru: '#6CC6F5' },
  { ad: 'Mor', sekil: 'altigen', ana: '#B266FF', acik: '#E3C7FF', koyu: '#4E1F8A', renkKoru: '#8C7CF0' },
  { ad: 'Gül', sekil: 'ucgen', ana: '#FF5FB4', acik: '#FFC2E3', koyu: '#8A1F5A', renkKoru: '#E07BC0' },
] as const;
