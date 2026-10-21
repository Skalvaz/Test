/**
 * Ortak katalog (P0): mahalleler, gökyüzü temaları, havai fişek desenleri,
 * fitil görünümleri, güçlendiriciler. Kimlikler (id) kayıtta saklanır;
 * DEĞİŞTİRME, yalnız ekle. Kaynak: GDD §9, §10.1, §10.3, §13.1.
 * Görünen adlar iki dilli: `t(türkçe, ingilizce)` (sayfa dili açılışta sabit).
 */
import { t } from '../platform/dil';

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
  ayIsigi: { ad: t('Ay Işığı', 'Moonlight'), ust: '#0B1030', alt: '#1E2A5A' },
  laleMoru: { ad: t('Lale Moru', 'Tulip Purple'), ust: '#1A0F33', alt: '#3A1A5C' },
  denizMavisi: { ad: t('Deniz Mavisi', 'Sea Blue'), ust: '#081A2E', alt: '#123A4F' },
  bakirSaat: { ad: t('Bakır Saat', 'Copper Clock'), ust: '#1A1020', alt: '#4A2A1A' },
  atesBocegi: { ad: t('Ateş Böceği', 'Firefly'), ust: '#0A1A12', alt: '#1F3A22' },
  yildizYagmuru: { ad: t('Yıldız Yağmuru', 'Star Shower'), ust: '#0B0B2A', alt: '#2A1450' },
  kizilDuman: { ad: t('Kızıl Duman', 'Red Smoke'), ust: '#1A0A0A', alt: '#4A1A14' },
  altinSafak: { ad: t('Altın Şafak', 'Golden Dawn'), ust: '#1A1030', alt: '#5A3A1A' },
};

/** 8 mahalle × 5 bölüm (mahalle indeksi = BolumVerisi.mahalle). */
export const MAHALLELER: readonly Mahalle[] = [
  { id: 'iskele', ad: t('İskele', 'Pier'), vurgu: '#3AA8FF', gokyuzu: 'ayIsigi', siluet: t('ahşap iskele, kayıklar', 'wooden pier, boats'), defter: t('Fener alayı geleneği', 'The lantern parade') },
  { id: 'carsi', ad: t('Çarşı', 'Bazaar'), vurgu: '#B266FF', gokyuzu: 'laleMoru', siluet: t('kubbeler, kemerler', 'domes, arches'), defter: t('Mahya: minareler arasına gerilen ışık yazıları', 'Mahya: words of light between minarets') },
  { id: 'liman', ad: t('Liman', 'Harbor'), vurgu: '#2EE07A', gokyuzu: 'denizMavisi', siluet: t('vinçler, gemi direkleri', 'cranes, ship masts'), defter: t('Liman gecelerinde kayık fenerleri', 'Boat lanterns on harbor nights') },
  { id: 'saatKulesi', ad: t('Saat Kulesi', 'Clock Tower'), vurgu: '#D9A441', gokyuzu: 'bakirSaat', siluet: t('kule, kadran', 'tower, clock face'), defter: t('Kasaba saat kulelerinin hikâyesi', 'The story of town clock towers') },
  { id: 'bahceler', ad: t('Bahçeler', 'Gardens'), vurgu: '#FFB020', gokyuzu: 'atesBocegi', siluet: t('çardaklar, ağaçlar', 'arbors, trees'), defter: t('Hıdırellez ateşi ve dilek ağaçları', 'Hıdırellez fires and wishing trees') },
  { id: 'tepe', ad: t('Tepe', 'Hilltop'), vurgu: '#FF5FB4', gokyuzu: 'yildizYagmuru', siluet: t('yel değirmeni, rasathane', 'windmill, observatory'), defter: t('Nevruz ateşi', 'The Nevruz fire') },
  { id: 'fabrika', ad: t('Fabrika', 'Factory'), vurgu: '#FF4D4D', gokyuzu: 'kizilDuman', siluet: t('bacalar, depo', 'chimneys, storehouse'), defter: t('Osmanlı baruthaneleri', 'Ottoman powder works') },
  { id: 'kale', ad: t('Kale', 'Castle'), vurgu: '#FFF3D6', gokyuzu: 'altinSafak', siluet: t('surlar, burçlar', 'walls, towers'), defter: t('Donanma şenlikleri: şehri ışıklarla süsleme', 'Festival nights: a city dressed in lights') },
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
  // İngilizce ad Defter kartına tek sözcük sığmıyor: yumuşak tire (yalnız gerekirse "Chrysan-themum" diye kırılır).
  { id: 'kasimpati', ad: t('Kasımpatı', 'Chrysan\u00ADthemum'), baslangicta: true },
  { id: 'palmiye', ad: t('Palmiye', 'Palm'), baslangicta: true },
  { id: 'halka', ad: t('Halka', 'Ring'), baslangicta: true },
  { id: 'sogut', ad: t('Söğüt', 'Willow'), baslangicta: false },
  { id: 'ciftHalka', ad: t('Çift Halka', 'Double Ring'), baslangicta: false },
  { id: 'kalp', ad: t('Kalp', 'Heart'), baslangicta: false },
  { id: 'spiral', ad: t('Spiral', 'Spiral'), baslangicta: false },
  { id: 'yildiz', ad: t('Yıldız', 'Star'), baslangicta: false },
  { id: 'selale', ad: t('Şelale', 'Waterfall'), baslangicta: false },
  { id: 'marti', ad: t('Martı', 'Seagull'), baslangicta: false },
  { id: 'lale', ad: t('Lale', 'Tulip'), baslangicta: false },
  { id: 'karanfil', ad: t('Karanfil', 'Carnation'), baslangicta: false },
  { id: 'papatya', ad: t('Papatya', 'Daisy'), baslangicta: false },
  { id: 'kuyrukluYildiz', ad: t('Kuyruklu Yıldız', 'Comet'), baslangicta: false },
  { id: 'carkifelek', ad: t('Çarkıfelek', 'Pinwheel'), baslangicta: false },
  { id: 'atesBocegi', ad: t('Ateş Böceği', 'Firefly'), baslangicta: false },
  { id: 'gul', ad: t('Gül', 'Rose'), baslangicta: false },
  { id: 'yagmur', ad: t('Yağmur', 'Rain'), baslangicta: false },
  { id: 'tac', ad: t('Taç', 'Crown'), baslangicta: false },
  { id: 'hilal', ad: t('Hilal', 'Crescent'), baslangicta: false },
  { id: 'dalga', ad: t('Dalga', 'Wave'), baslangicta: false },
  { id: 'kelebek', ad: t('Kelebek', 'Butterfly'), baslangicta: false },
  { id: 'fenerAlayi', ad: t('Fener Alayı', 'Lantern Parade'), baslangicta: false },
  { id: 'saat', ad: t('Saat', 'Clock'), baslangicta: false },
];
export const DESEN_PARCA = 3;
export const EN_FAZLA_TAKILI_DESEN = 6;

export type FitilId = 'kenevir' | 'altinTel' | 'simsek' | 'gokkusagi' | 'atesBocegi' | 'laleDali' | 'denizKopugu' | 'ejderKuyrugu' | 'denizFeneri';

/** Fitil görünümleri (§10.3); `denizFeneri` yalnız Fener Nöbeti 30 ödülü. */
export const FITILLER: readonly { id: FitilId; ad: string; baslangicta: boolean; sandiktan: boolean }[] = [
  { id: 'kenevir', ad: t('Kenevir İp', 'Hemp Cord'), baslangicta: true, sandiktan: false },
  { id: 'altinTel', ad: t('Altın Tel', 'Gold Wire'), baslangicta: false, sandiktan: true },
  { id: 'simsek', ad: t('Şimşek', 'Lightning'), baslangicta: false, sandiktan: true },
  { id: 'gokkusagi', ad: t('Gökkuşağı', 'Rainbow'), baslangicta: false, sandiktan: true },
  { id: 'atesBocegi', ad: t('Ateş Böceği', 'Firefly'), baslangicta: false, sandiktan: true },
  { id: 'laleDali', ad: t('Lale Dalı', 'Tulip Stem'), baslangicta: false, sandiktan: true },
  { id: 'denizKopugu', ad: t('Deniz Köpüğü', 'Sea Foam'), baslangicta: false, sandiktan: true },
  { id: 'ejderKuyrugu', ad: t('Ejder Kuyruğu', 'Dragon Tail'), baslangicta: false, sandiktan: true },
  { id: 'denizFeneri', ad: t('Deniz Feneri', 'Lighthouse'), baslangicta: false, sandiktan: false },
];

export type GuclendiriciId = 'kibrit' | 'kalip' | 'geriSar';
export const GUCLENDIRICILER: readonly { id: GuclendiriciId; ad: string; acilis: number; hediye: number }[] = [
  { id: 'kibrit', ad: t('Kibrit', 'Match'), acilis: 7, hediye: 2 },
  { id: 'kalip', ad: t('Fişek Kalıbı', 'Rocket Mold'), acilis: 12, hediye: 1 },
  { id: 'geriSar', ad: t('Geri Sar', 'Undo'), acilis: 20, hediye: 1 },
];
export const GUCLENDIRICI_STOK_SINIRI = 3;

/** Kapsül renkleri (§2.3, §13.1). */
export const KAPSUL_RENKLERI = [
  { ad: t('Kızıl', 'Red'), sekil: 'daire', ana: '#FF4D4D', acik: '#FFB3A8', koyu: '#8A1C1C', renkKoru: '#E8631C' },
  { ad: t('Kehribar', 'Amber'), sekil: 'yildiz', ana: '#FFB020', acik: '#FFE08A', koyu: '#8A5A00', renkKoru: '#F0C419' },
  { ad: t('Zümrüt', 'Emerald'), sekil: 'damla', ana: '#2EE07A', acik: '#A8FFD0', koyu: '#0E6B37', renkKoru: '#1BB38A' },
  { ad: t('Gök', 'Sky'), sekil: 'elmas', ana: '#3AA8FF', acik: '#B5E0FF', koyu: '#0F4A80', renkKoru: '#6CC6F5' },
  { ad: t('Mor', 'Purple'), sekil: 'altigen', ana: '#B266FF', acik: '#E3C7FF', koyu: '#4E1F8A', renkKoru: '#8C7CF0' },
  { ad: t('Gül', 'Rose'), sekil: 'ucgen', ana: '#FF5FB4', acik: '#FFC2E3', koyu: '#8A1F5A', renkKoru: '#E07BC0' },
] as const;

// ─────────────────────── Kasaba İşleri (docs/KANCALAR.md §B) ───────────────────────

/**
 * Kasaba işinin harita çizim şablonu (çizici bu şablonları mahalle rengiyle
 * ve `yer` çapasıyla çizer):
 *  - fenerDizisi   iki nokta arasına sarkık ip + kâğıt fenerler (salınım)
 *  - flama         sarkık ip + üçgen bayraklar (3 renk, mahalle vurgusu ağırlıklı)
 *  - kandilDizisi  bir hat ya da kenar boyunca küçük sıcak ışık noktaları
 *  - kemer         ışıklı kemer/çelenk (yarım daire üstünde ışık noktaları)
 *  - yapiIsigi     var olan bir yapıyı aydınlatma (fener camı, kadran, vinç, kubbe)
 *  - tabela        ışıklı yazı ya da tabela (mahya, kapı, şenlik yazısı)
 *  - ates          ateş, çanak, meşale (titreyen alev)
 *  - parilti       serbest ışıklar (yüzen kandil, ateş böceği, kıvılcım)
 */
export type KasabaCizimi = 'fenerDizisi' | 'flama' | 'kandilDizisi' | 'kemer' | 'yapiIsigi' | 'tabela' | 'ates' | 'parilti';

export interface KasabaIsi {
  /** Kayıtta saklanır: `<mahalleId>.<isAdi>`. DEĞİŞTİRME, yalnız ekle. */
  id: string;
  /** Mahalle indeksi (0..7). */
  mahalle: number;
  /** Mahalle içindeki sıra (0..5); 5 = taç iş (öbür beşi bitince açılır). */
  sira: number;
  ad: string;
  /** Kartta tek satır açıklama. */
  aciklama: string;
  /** Kandil bedeli (KANCALAR §B.3). */
  maliyet: number;
  /** İş yapılınca konuşan sakinin balonu ("Ad: söz"). */
  sakin: string;
  cizim: KasabaCizimi;
  /**
   * Çizim çapası, mahalle bölgesinin yerel koordinatında (x 0..400, y 0..660,
   * bölge üstünden; İskele tabelası alt paydadır, y > 660). Harita süsleriyle
   * eşleşir (`ui/harita/susler.ts` `isCapasi`; cizim.test denetler): iş
   * yapılınca harita buraya kayar, kandil kıvılcımları buraya uçar.
   */
  yer: { x: number; y: number };
}

/** Mahalle sakinleri (iş balonlarının sahibi). */
export const KASABA_SAKINLERI: readonly string[] = [
  t('Kayıkçı Rıza', 'Rıza the Boatman'),
  t('Kandilci Nazlı', 'Nazlı the Lamplighter'),
  t('Kaptan Yakup', 'Captain Yakup'),
  t('Saatçi Hüsnü Usta', 'Hüsnü the Clockmaker'),
  t('Bahçıvan Gülizar', 'Gülizar the Gardener'),
  t('Gökbilimci Ayşe', 'Ayşe the Astronomer'),
  t('Barutçu Kemal', 'Kemal the Powder Maker'),
  t('Sur Bekçisi Murat', 'Murat the Wall Guard'),
];

function kasabaIsi(mahalle: number, sira: number, ad: string, isAdi: string, maliyet: number, cizim: KasabaCizimi, yer: [number, number], aciklama: string, soz: string): KasabaIsi {
  return {
    id: `${MAHALLELER[mahalle].id}.${isAdi}`,
    mahalle,
    sira,
    ad,
    aciklama,
    maliyet,
    sakin: `${KASABA_SAKINLERI[mahalle]}: ${soz}`,
    cizim,
    yer: { x: yer[0], y: yer[1] },
  };
}

/**
 * 8 mahalle × 6 iş = 48 iş, toplam 186 kandil (KANCALAR §B.3). Mahalle içinde
 * ilk beş iş serbest sırayla, taç iş (sira 5) en son. Mahalleler sırayla
 * süslenir: mahallenin işleri, önceki mahallenin 6 işi bitince ve mahallenin
 * ilk bölümü haritada açıkken açılır.
 */
export const KASABA_ISLERI: readonly KasabaIsi[] = [
  // İskele (14)
  kasabaIsi(0, 0, t('Pruva fenerleri', 'Bow lanterns'), 'kayikFenerleri', 1, 'parilti', [112, 744], t('Kıyıdaki kayıkların pruvasına kâğıt fenerler asılır.', 'Paper lanterns hang from the bows of the boats.'), t('Fenerler yanınca kayıklar yolunu bulur!', 'With lanterns lit, boats find their way!')),
  kasabaIsi(0, 1, t('İskele bayrakları', 'Pier flags'), 'iskeleBayraklari', 2, 'flama', [278, 324], t('İskele babalarına rengârenk flamalar gerilir.', 'Colorful pennants fly from the pier posts.'), t('Rüzgâr bayrakları görünce şenliği anladı!', 'The wind saw the flags and knew: festival!')),
  kasabaIsi(0, 2, t('Fener dizisi', 'Lantern string'), 'fenerDizisi', 2, 'fenerDizisi', [129, 449], t('Teraslar arasına ip gerilir, kâğıt fenerler asılır.', 'Paper lanterns hang on a line between the terraces.'), t('Merdivenleri artık gözü kapalı çıkarım.', 'Now I can climb these stairs blindfolded.')),
  kasabaIsi(0, 3, t('Kandilli kemer', 'Lamp arch'), 'kandilliKemer', 2, 'kemer', [200, 774], t('İskele girişine kandillerle süslü bir kemer kurulur.', 'An arch hung with lamps goes up at the pier gate.'), t('Koya gelen herkes bu kemerin altından geçecek.', 'All who come to the cove will pass under it.')),
  kasabaIsi(0, 4, t('Deniz feneri', 'Lighthouse'), 'denizFeneri', 3, 'yapiIsigi', [380, 700], t('Kayalıktaki eski deniz fenerinin ışığı yeniden döner.', 'The old lighthouse on the rocks shines again.'), t('Babam o ışığı görmeden denize açılmazdı.', 'My father never sailed without that light.')),
  kasabaIsi(0, 5, t('İskele tabelası', 'Pier sign'), 'tabela', 4, 'tabela', [200, 884], t('İskelenin üstünde "Fener Koyu" yazısı ışıl ışıl yanar.', 'A bright "Lantern Cove" sign glows over the pier.'), t('İşte şimdi burası gerçekten Fener Koyu!', 'Now this really is Lantern Cove!')),
  // Çarşı (18)
  kasabaIsi(1, 0, t('Dükkân kandilleri', 'Shop lamps'), 'dukkanKandilleri', 2, 'kandilDizisi', [71, 411], t('Dükkân kapılarına birer bakır kandil asılır.', 'A copper lamp hangs at every shop door.'), t('Her kandil bir ezgi mırıldanıyor, duyuyor musun?', 'Each lamp hums a tune. Can you hear it?')),
  kasabaIsi(1, 1, t('Kemer çelengi', 'Arch garland'), 'kemerCelengi', 2, 'kemer', [331, 296], t('Çarşı kemerlerine ışıklı çelenkler dolanır.', 'Garlands of light wrap the bazaar arches.'), t('Kemerler gelin gibi oldu!', 'The arches look like brides!')),
  kasabaIsi(1, 2, t('Lale fenerleri', 'Tulip lanterns'), 'laleFenerleri', 3, 'fenerDizisi', [275, 449], t('Sokak boyunca lale biçimli renkli fenerler yanar.', 'Colorful tulip-shaped lanterns light the street.'), t('Her lale başka bir renge bürünüyor.', 'Every tulip glows a different color.')),
  kasabaIsi(1, 3, t('Kubbe kandilleri', 'Dome lamps'), 'kubbeKandilleri', 3, 'yapiIsigi', [200, 330], t('Büyük kubbenin eteğine kandil dizileri sıralanır.', 'Rows of lamps ring the base of the great dome.'), t('Kubbe gökyüzüne ışık serpiyor.', 'The dome scatters light into the sky.')),
  kasabaIsi(1, 4, t('Mahya yazısı', 'Mahya lights'), 'mahyaYazisi', 4, 'tabela', [128, 318], t('Minareler arasına "ŞENLİK" yazan ışıklı mahya gerilir.', 'Lights between the minarets spell a festive word.'), t('Yazıyı ta iskeleden okuyorlarmış!', 'They can read it from the pier!')),
  kasabaIsi(1, 5, t('Çarşı kapısı', 'Bazaar gate'), 'carsiKapisi', 4, 'kemer', [326, 558], t('Büyük çarşı kapısı baştan aşağı ışıklarla donanır.', 'The great bazaar gate is covered in lights.'), t('Çarşı hiç bu kadar kalabalık olmamıştı.', 'The bazaar has never been this busy.')),
  // Liman (20)
  kasabaIsi(2, 0, t('Direk fenerleri', 'Mast lanterns'), 'direkFenerleri', 2, 'parilti', [346, 557], t('Gemi direklerinin tepesine birer fener çekilir.', 'A lantern is hoisted to the top of each mast.'), t('Direkler yıldızlara uzanıyor.', 'The masts reach for the stars.')),
  kasabaIsi(2, 1, t('Halat flamaları', 'Rope pennants'), 'halatFlamalari', 3, 'flama', [272, 84], t('Palamar halatlarına işaret flamaları dizilir.', 'Signal flags line the mooring ropes.'), t('Her flama bir selam, okumasını bilene!', 'Every flag says hello, if you can read it!')),
  kasabaIsi(2, 2, t('Vinç ışıkları', 'Crane lights'), 'vincIsiklari', 3, 'yapiIsigi', [330, 345], t('Büyük vincin kolu boydan boya ışıklarla çizilir.', "Lights trace the great crane's arm end to end."), t('Vinç bu gece yük değil ışık taşıyor.', 'Tonight the crane carries light, not cargo.')),
  kasabaIsi(2, 3, t('Mendirek fenerleri', 'Breakwater lights'), 'mendirekFenerleri', 4, 'parilti', [70, 464], t('Liman ağzında kırmızı ve yeşil fenerler yanar.', 'Red and green lights glow at the harbor mouth.'), t('Gemiler artık limanı ıskalamaz.', 'No ship will miss the harbor now.')),
  kasabaIsi(2, 4, t('Gemi donanması', 'Ship lights'), 'gemiDonanmasi', 4, 'kandilDizisi', [349, 569], t('Rıhtımdaki gemi baştan kıça ışıklarla donanır.', 'The ship at the quay is lit from bow to stern.'), t('Gemim hiç bu kadar yakışıklı olmamıştı!', 'My ship has never looked so handsome!')),
  kasabaIsi(2, 5, t('Liman kapısı', 'Harbor gate'), 'limanKapisi', 4, 'tabela', [326, 203], t('Rıhtım girişine ışıklı bir liman kapısı kurulur.', 'A gate of lights rises at the entrance to the quay.'), t('Hoş geldin, demek ki şenliğe geldin!', "Welcome! You've come for the festival!")),
  // Saat Kulesi (22)
  kasabaIsi(3, 0, t('Sokak lambaları', 'Street lamps'), 'sokakLambalari', 3, 'kandilDizisi', [384, 556], t('Meydan yolundaki eski lambalar yeniden yakılır.', 'Old lamps on the way to the square glow again.'), t('Lambalar tam vaktinde yandı, saniyesi saniyesine.', 'The lamps came on right on time, to the second.')),
  kasabaIsi(3, 1, t('Kule çelengi', 'Tower garland'), 'kuleCelengi', 3, 'kemer', [326, 46], t('Kulenin gövdesine ışıklı bir çelenk sarılır.', 'A garland of lights wraps around the tower.'), t('Kule bayramlığını giydi.', 'The tower put on its holiday best.')),
  kasabaIsi(3, 2, t('Balkon fenerleri', 'Balcony lanterns'), 'balkonFenerleri', 3, 'fenerDizisi', [271, 449], t('Meydanı çevreleyen balkonlara fenerler asılır.', 'Lanterns hang from the balconies on the square.'), t('Balkonlardan herkes kuleyi seyrediyor.', 'All the balconies are watching the tower.')),
  kasabaIsi(3, 3, t('Çeşme ışıkları', 'Fountain lights'), 'cesmeIsiklari', 4, 'parilti', [74, 215], t('Meydan çeşmesinin suyu altından aydınlatılır.', "The square's fountain is lit from below."), t('Su bile ışıl ışıl akıyor.', 'Even the water sparkles.')),
  kasabaIsi(3, 4, t('Aydınlık kadran', 'Lit clock face'), 'aydinlikKadran', 4, 'yapiIsigi', [326, 2], t('Saatin kadranı içten ışıklanır, akrebi parlar.', 'The clock face glows and its hands shine.'), t('Artık gece de herkes saati görecek.', 'Now everyone can tell the time at night.')),
  kasabaIsi(3, 5, t('Şenlik çanı', 'Festival bell'), 'senlikCani', 5, 'yapiIsigi', [365, 2], t('Kulenin tepesindeki çan ışıklı bir taçla asılır.', 'The bell atop the tower gets a crown of lights.'), t('Çan çaldı: şenlik vakti!', 'The bell rang: festival time!')),
  // Bahçeler (24)
  kasabaIsi(4, 0, t('Çardak fenerleri', 'Arbor lanterns'), 'cardakFenerleri', 3, 'fenerDizisi', [122, 449], t('Asmalı çardağa yuvarlak fenerler asılır.', 'Round lanterns hang in the vine arbor.'), t('Çardağın altı ışıktan bir bahçe oldu.', 'Under the arbor is now a garden of light.')),
  kasabaIsi(4, 1, t('Dilek ağacı', 'Wishing tree'), 'dilekAgaci', 3, 'flama', [374, 439], t('Yaşlı dut ağacına renkli dilek kurdeleleri bağlanır.', 'Wish ribbons are tied to the old mulberry tree.'), t('Senin dileğin de bir kurdelede, biliyorum.', 'Your wish is on a ribbon too, I know it.')),
  kasabaIsi(4, 2, t('Ateş böceği kavanozları', 'Firefly jars'), 'atesBocegiKavanozlari', 4, 'parilti', [127, 209], t('Patikalara ışıldayan kavanozlar dizilir.', 'Glowing jars line the garden paths.'), t('Ateş böcekleri bu gece misafirimiz.', 'The fireflies are our guests tonight.')),
  kasabaIsi(4, 3, t('Gül kemeri', 'Rose arch'), 'gulKemeri', 4, 'kemer', [69, 561], t('Bahçe girişine ışıklı bir gül kemeri kurulur.', 'A glowing rose arch goes up at the garden gate.'), t('Güller bile gece açtı.', 'Even the roses bloomed tonight.')),
  kasabaIsi(4, 4, t('Yüzen kandiller', 'Floating lamps'), 'yuzenKandiller', 5, 'parilti', [67, 345], t('Havuza küçük kandiller bırakılır, suda süzülür.', 'Little lamps are set to drift across the pond.'), t('Her kandil bir dilek taşıyor.', 'Each lamp carries a wish.')),
  kasabaIsi(4, 5, t('Hıdırellez ateşi', 'Hıdırellez fire'), 'hidirellezAtesi', 5, 'ates', [350, 84], t('Bahçenin ortasında Hıdırellez ateşi yakılır.', 'A Hıdırellez fire burns in the garden.'), t('Atla bakalım, bütün dileklerin kabul olsun!', 'Jump over, and may your wishes come true!')),
  // Tepe (26)
  kasabaIsi(5, 0, t('Patika fenerleri', 'Path lanterns'), 'patikaFenerleri', 3, 'kandilDizisi', [54, 360], t('Tepeye çıkan patika fenerlerle çizilir.', 'Lanterns line the path up the hill.'), t('Yolu artık yıldızlar değil fenerler gösteriyor.', 'Now lanterns show the way, not the stars.')),
  kasabaIsi(5, 1, t('Değirmen kanatları', 'Windmill sails'), 'degirmenKanatlari', 4, 'yapiIsigi', [71, 379], t('Yel değirmeninin kanatları ışık dizileriyle döner.', "The windmill's sails turn with strings of light."), t('Rüzgâr ışığı da çeviriyor!', 'The wind spins the light too!')),
  kasabaIsi(5, 2, t('Rüzgâr flamaları', 'Wind pennants'), 'ruzgarFlamalari', 4, 'flama', [275, 439], t('Tepedeki direklere uzun rüzgâr flamaları çekilir.', 'Long pennants fly from the poles on the hill.'), t('Flamalar rüzgârın yönünü söylüyor.', 'The pennants show where the wind blows.')),
  kasabaIsi(5, 3, t('Rasathane kubbesi', 'Observatory dome'), 'rasathaneKubbesi', 5, 'yapiIsigi', [334, 44], t('Rasathanenin kubbesi yıldız haritasıyla aydınlanır.', 'The observatory dome lights up with a star map.'), t('Kubbeden bakınca gök iki kat parlak.', 'From the dome, the sky is twice as bright.')),
  kasabaIsi(5, 4, t('Ateş çanakları', 'Fire bowls'), 'atesCanaklari', 5, 'ates', [157, 318], t('Tepeye Nevruz ateş çanakları dizilir.', 'Nevruz fire bowls are set along the hill.'), t('Kışı ateşin üstünden atlayıp uğurladık.', 'We leapt the fire and sent winter away.')),
  kasabaIsi(5, 5, t('Gök haritası', 'Sky map'), 'gokHaritasi', 5, 'tabela', [140, 56], t('Tepenin üstüne ışıktan bir takımyıldız çizilir.', 'A constellation of light is drawn above the hill.'), t('Bak, şu yıldızlar senin adını yazıyor!', 'Look, those stars spell your name!')),
  // Fabrika (28)
  kasabaIsi(6, 0, t('Atölye lambaları', 'Workshop lamps'), 'atolyeLambalari', 4, 'kandilDizisi', [51, 536], t('Atölye pencerelerine sıcak lambalar asılır.', 'Warm lamps hang in the workshop windows.'), t('Barut sabır ister, ışık da öyle.', 'Powder needs patience. So does light.')),
  kasabaIsi(6, 1, t('Depo kapısı', 'Storehouse door'), 'depoKapisi', 4, 'kemer', [330, 448], t('Barut deposunun kapısı fenerlerle çevrilir.', 'Lanterns frame the door of the powder store.'), t('Kapıyı ben açarım, ışığı sen yaktın.', 'I open the door; you lit the light.')),
  kasabaIsi(6, 2, t('Ray fenerleri', 'Rail lanterns'), 'rayFenerleri', 5, 'fenerDizisi', [126, 447], t('Vagon rayları boyunca fenerler dizilir.', 'Lanterns line the wagon rails.'), t('Vagonlar bu gece fişek taşıyor.', 'Tonight the wagons carry fireworks.')),
  kasabaIsi(6, 3, t('Baca kıvılcımları', 'Chimney sparks'), 'bacaKivilcimlari', 5, 'parilti', [298, 341], t('Bacalardan zararsız altın kıvılcımlar yükselir.', 'Harmless golden sparks rise from the chimneys.'), t('Duman değil, kıvılcım çıkıyor artık!', 'Sparks now, not smoke!')),
  kasabaIsi(6, 4, t('Baca çelengi', 'Chimney garland'), 'bacaCelengi', 5, 'kandilDizisi', [109, 248], t('Uzun bacalar tepeden tırnağa ışıklarla sarılır.', 'The tall chimneys are wrapped in lights.'), t('Bacalar mum gibi yanıyor.', 'Chimneys glow like candles!')),
  kasabaIsi(6, 5, t('Şenlik düdüğü', 'Festival whistle'), 'senlikDudugu', 5, 'tabela', [361, 124], t('Fabrika düdüğü şenliği haber verir, bacalar taçlanır.', 'The whistle calls the festival; the chimneys wear crowns.'), t('Düdük öttü: bu gece iş yok, şenlik var!', 'The whistle blew: no work tonight, only fun!')),
  // Kale (34)
  kasabaIsi(7, 0, t('Sur kandilleri', 'Wall lamps'), 'surKandilleri', 4, 'kandilDizisi', [329, 256], t('Sur dişlerinin arasına kandiller dizilir.', 'Lamps line the gaps in the battlements.'), t('Surlar yüz yıl sonra yeniden yandı.', 'The walls glow again after a century.')),
  kasabaIsi(7, 1, t('Burç bayrakları', 'Tower flags'), 'burcBayraklari', 5, 'flama', [76, 386], t('Burçların tepesine uzun bayraklar çekilir.', 'Long flags are raised atop the towers.'), t('Bayraklar şafakla yarışıyor.', 'The flags are racing the dawn.')),
  kasabaIsi(7, 2, t('Kapı meşaleleri', 'Gate torches'), 'kapiMesaleleri', 5, 'ates', [332, 562], t('Kale kapısının iki yanında meşaleler yanar.', 'Torches burn on both sides of the castle gate.'), t('Meşaleler kapıyı bekliyor, ben de.', 'The torches guard the gate, and so do I.')),
  kasabaIsi(7, 3, t('Mazgal fenerleri', 'Arrow-slit lights'), 'mazgalFenerleri', 6, 'parilti', [329, 292], t('Mazgal deliklerinden fener ışığı süzülür.', 'Lantern light glows through the arrow slits.'), t('Kale gözlerini açtı.', 'The castle opened its eyes.')),
  kasabaIsi(7, 4, t('Donanma ışıkları', 'Festival lights'), 'donanmaIsiklari', 6, 'kandilDizisi', [329, 282], t('Surların bütün kenarları ışıkla çizilir: kale donanır.', 'Lights trace every edge of the walls: the castle shines.'), t('İşte gerçek bir donanma gecesi!', 'Now that is a real night of lights!')),
  kasabaIsi(7, 5, t('Büyük burç ateşi', 'Great tower fire'), 'burcAtesi', 8, 'ates', [24, 92], t('Gözcü burcunda büyük şenlik ateşi yakılır.', 'A great festival fire is lit on the watchtower.'), t('Kıvılcım Usta bu ateşi görüyordur.', 'Master Spark must see this fire.')),
];

/** Mahalle başına iş (son iş taç iştir). */
export const KASABA_IS_PER_MAHALLE = 6;

/**
 * Mahalle → mühür ödülü fitil görünümü (KANCALAR §A.6): mahallenin 5., 10.
 * ve 15. mühüründe bu fitilin sıradaki eksik parçası; üçü de varsa 10 toz.
 * İskele (1–5 öğretim) mühürsüz.
 */
export const MUHUR_FITILLERI: Readonly<Partial<Record<number, FitilId>>> = {
  1: 'laleDali',
  2: 'denizKopugu',
  3: 'altinTel',
  4: 'atesBocegi',
  5: 'gokkusagi',
  6: 'ejderKuyrugu',
  7: 'simsek',
};
