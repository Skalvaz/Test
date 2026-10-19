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
  'Kayıkçı Rıza',
  'Kandilci Nazlı',
  'Kaptan Yakup',
  'Saatçi Hüsnü Usta',
  'Bahçıvan Gülizar',
  'Gökbilimci Ayşe',
  'Barutçu Kemal',
  'Sur Bekçisi Murat',
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
  kasabaIsi(0, 0, 'Pruva fenerleri', 'kayikFenerleri', 1, 'parilti', [112, 744], 'Kıyıdaki kayıkların pruvasına kâğıt fenerler asılır.', 'Fenerler yanınca kayıklar yolunu bulur!'),
  kasabaIsi(0, 1, 'İskele bayrakları', 'iskeleBayraklari', 2, 'flama', [278, 324], 'İskele babalarına rengârenk flamalar gerilir.', 'Rüzgâr bayrakları görünce şenliği anladı!'),
  kasabaIsi(0, 2, 'Fener dizisi', 'fenerDizisi', 2, 'fenerDizisi', [129, 449], 'Teraslar arasına ip gerilir, kâğıt fenerler asılır.', 'Merdivenleri artık gözü kapalı çıkarım.'),
  kasabaIsi(0, 3, 'Kandilli kemer', 'kandilliKemer', 2, 'kemer', [200, 774], 'İskele girişine kandillerle süslü bir kemer kurulur.', 'Koya gelen herkes bu kemerin altından geçecek.'),
  kasabaIsi(0, 4, 'Deniz feneri', 'denizFeneri', 3, 'yapiIsigi', [380, 700], 'Kayalıktaki eski deniz fenerinin ışığı yeniden döner.', 'Babam o ışığı görmeden denize açılmazdı.'),
  kasabaIsi(0, 5, 'İskele tabelası', 'tabela', 4, 'tabela', [200, 884], 'İskelenin üstünde "Fener Koyu" yazısı ışıl ışıl yanar.', 'İşte şimdi burası gerçekten Fener Koyu!'),
  // Çarşı (18)
  kasabaIsi(1, 0, 'Dükkân kandilleri', 'dukkanKandilleri', 2, 'kandilDizisi', [71, 411], 'Dükkân kapılarına birer bakır kandil asılır.', 'Her kandil bir ezgi mırıldanıyor, duyuyor musun?'),
  kasabaIsi(1, 1, 'Kemer çelengi', 'kemerCelengi', 2, 'kemer', [331, 296], 'Çarşı kemerlerine ışıklı çelenkler dolanır.', 'Kemerler gelin gibi oldu!'),
  kasabaIsi(1, 2, 'Lale fenerleri', 'laleFenerleri', 3, 'fenerDizisi', [275, 449], 'Sokak boyunca lale biçimli renkli fenerler yanar.', 'Her lale başka bir renge bürünüyor.'),
  kasabaIsi(1, 3, 'Kubbe kandilleri', 'kubbeKandilleri', 3, 'yapiIsigi', [200, 330], 'Büyük kubbenin eteğine kandil dizileri sıralanır.', 'Kubbe gökyüzüne ışık serpiyor.'),
  kasabaIsi(1, 4, 'Mahya yazısı', 'mahyaYazisi', 4, 'tabela', [128, 318], 'Minareler arasına "ŞENLİK" yazan ışıklı mahya gerilir.', 'Yazıyı ta iskeleden okuyorlarmış!'),
  kasabaIsi(1, 5, 'Çarşı kapısı', 'carsiKapisi', 4, 'kemer', [326, 558], 'Büyük çarşı kapısı baştan aşağı ışıklarla donanır.', 'Çarşı hiç bu kadar kalabalık olmamıştı.'),
  // Liman (20)
  kasabaIsi(2, 0, 'Direk fenerleri', 'direkFenerleri', 2, 'parilti', [346, 557], 'Gemi direklerinin tepesine birer fener çekilir.', 'Direkler yıldızlara uzanıyor.'),
  kasabaIsi(2, 1, 'Halat flamaları', 'halatFlamalari', 3, 'flama', [272, 84], 'Palamar halatlarına işaret flamaları dizilir.', 'Her flama bir selam, okumasını bilene!'),
  kasabaIsi(2, 2, 'Vinç ışıkları', 'vincIsiklari', 3, 'yapiIsigi', [330, 345], 'Büyük vincin kolu boydan boya ışıklarla çizilir.', 'Vinç bu gece yük değil ışık taşıyor.'),
  kasabaIsi(2, 3, 'Mendirek fenerleri', 'mendirekFenerleri', 4, 'parilti', [70, 464], 'Liman ağzında kırmızı ve yeşil fenerler yanar.', 'Gemiler artık limanı ıskalamaz.'),
  kasabaIsi(2, 4, 'Gemi donanması', 'gemiDonanmasi', 4, 'kandilDizisi', [349, 569], 'Rıhtımdaki gemi baştan kıça ışıklarla donanır.', 'Gemim hiç bu kadar yakışıklı olmamıştı!'),
  kasabaIsi(2, 5, 'Liman kapısı', 'limanKapisi', 4, 'tabela', [326, 203], 'Rıhtım girişine ışıklı bir liman kapısı kurulur.', 'Hoş geldin, demek ki şenliğe geldin!'),
  // Saat Kulesi (22)
  kasabaIsi(3, 0, 'Sokak lambaları', 'sokakLambalari', 3, 'kandilDizisi', [384, 556], 'Meydan yolundaki eski lambalar yeniden yakılır.', 'Lambalar tam vaktinde yandı, saniyesi saniyesine.'),
  kasabaIsi(3, 1, 'Kule çelengi', 'kuleCelengi', 3, 'kemer', [326, 46], 'Kulenin gövdesine ışıklı bir çelenk sarılır.', 'Kule bayramlığını giydi.'),
  kasabaIsi(3, 2, 'Balkon fenerleri', 'balkonFenerleri', 3, 'fenerDizisi', [271, 449], 'Meydanı çevreleyen balkonlara fenerler asılır.', 'Balkonlardan herkes kuleyi seyrediyor.'),
  kasabaIsi(3, 3, 'Çeşme ışıkları', 'cesmeIsiklari', 4, 'parilti', [74, 215], 'Meydan çeşmesinin suyu altından aydınlatılır.', 'Su bile ışıl ışıl akıyor.'),
  kasabaIsi(3, 4, 'Aydınlık kadran', 'aydinlikKadran', 4, 'yapiIsigi', [326, 2], 'Saatin kadranı içten ışıklanır, akrebi parlar.', 'Artık gece de herkes saati görecek.'),
  kasabaIsi(3, 5, 'Şenlik çanı', 'senlikCani', 5, 'yapiIsigi', [365, 2], 'Kulenin tepesindeki çan ışıklı bir taçla asılır.', 'Çan çaldı: şenlik vakti!'),
  // Bahçeler (24)
  kasabaIsi(4, 0, 'Çardak fenerleri', 'cardakFenerleri', 3, 'fenerDizisi', [122, 449], 'Asmalı çardağa yuvarlak fenerler asılır.', 'Çardağın altı ışıktan bir bahçe oldu.'),
  kasabaIsi(4, 1, 'Dilek ağacı', 'dilekAgaci', 3, 'flama', [374, 439], 'Yaşlı dut ağacına renkli dilek kurdeleleri bağlanır.', 'Senin dileğin de bir kurdelede, biliyorum.'),
  kasabaIsi(4, 2, 'Ateş böceği kavanozları', 'atesBocegiKavanozlari', 4, 'parilti', [127, 209], 'Patikalara ışıldayan kavanozlar dizilir.', 'Ateş böcekleri bu gece misafirimiz.'),
  kasabaIsi(4, 3, 'Gül kemeri', 'gulKemeri', 4, 'kemer', [69, 561], 'Bahçe girişine ışıklı bir gül kemeri kurulur.', 'Güller bile gece açtı.'),
  kasabaIsi(4, 4, 'Yüzen kandiller', 'yuzenKandiller', 5, 'parilti', [67, 345], 'Havuza küçük kandiller bırakılır, suda süzülür.', 'Her kandil bir dilek taşıyor.'),
  kasabaIsi(4, 5, 'Hıdırellez ateşi', 'hidirellezAtesi', 5, 'ates', [350, 84], 'Bahçenin ortasında Hıdırellez ateşi yakılır.', 'Atla bakalım, bütün dileklerin kabul olsun!'),
  // Tepe (26)
  kasabaIsi(5, 0, 'Patika fenerleri', 'patikaFenerleri', 3, 'kandilDizisi', [200, 340], 'Tepeye çıkan patika fenerlerle çizilir.', 'Yolu artık yıldızlar değil fenerler gösteriyor.'),
  kasabaIsi(5, 1, 'Değirmen kanatları', 'degirmenKanatlari', 4, 'yapiIsigi', [71, 379], 'Yel değirmeninin kanatları ışık dizileriyle döner.', 'Rüzgâr ışığı da çeviriyor!'),
  kasabaIsi(5, 2, 'Rüzgâr flamaları', 'ruzgarFlamalari', 4, 'flama', [122, 320], 'Tepedeki direklere uzun rüzgâr flamaları çekilir.', 'Flamalar rüzgârın yönünü söylüyor.'),
  kasabaIsi(5, 3, 'Rasathane kubbesi', 'rasathaneKubbesi', 5, 'yapiIsigi', [334, 44], 'Rasathanenin kubbesi yıldız haritasıyla aydınlanır.', 'Kubbeden bakınca gök iki kat parlak.'),
  kasabaIsi(5, 4, 'Ateş çanakları', 'atesCanaklari', 5, 'ates', [200, 586], 'Tepeye Nevruz ateş çanakları dizilir.', 'Kışı ateşin üstünden atlayıp uğurladık.'),
  kasabaIsi(5, 5, 'Gök haritası', 'gokHaritasi', 5, 'tabela', [140, 56], 'Tepenin üstüne ışıktan bir takımyıldız çizilir.', 'Bak, şu yıldızlar senin adını yazıyor!'),
  // Fabrika (28)
  kasabaIsi(6, 0, 'Atölye lambaları', 'atolyeLambalari', 4, 'kandilDizisi', [67, 536], 'Atölye pencerelerine sıcak lambalar asılır.', 'Barut sabır ister, ışık da öyle.'),
  kasabaIsi(6, 1, 'Depo kapısı', 'depoKapisi', 4, 'kemer', [200, 584], 'Barut deposunun kapısı fenerlerle çevrilir.', 'Kapıyı ben açarım, ışığı sen yaktın.'),
  kasabaIsi(6, 2, 'Ray fenerleri', 'rayFenerleri', 5, 'fenerDizisi', [126, 447], 'Vagon rayları boyunca fenerler dizilir.', 'Vagonlar bu gece fişek taşıyor.'),
  kasabaIsi(6, 3, 'Baca kıvılcımları', 'bacaKivilcimlari', 5, 'parilti', [298, 341], 'Bacalardan zararsız altın kıvılcımlar yükselir.', 'Duman değil, kıvılcım çıkıyor artık!'),
  kasabaIsi(6, 4, 'Baca çelengi', 'bacaCelengi', 5, 'kandilDizisi', [109, 248], 'Uzun bacalar tepeden tırnağa ışıklarla sarılır.', 'Bacalar mum gibi yanıyor.'),
  kasabaIsi(6, 5, 'Şenlik düdüğü', 'senlikDudugu', 5, 'tabela', [200, 50], 'Fabrika düdüğü şenliği haber verir, bacalar taçlanır.', 'Düdük öttü: bu gece iş yok, şenlik var!'),
  // Kale (34)
  kasabaIsi(7, 0, 'Sur kandilleri', 'surKandilleri', 4, 'kandilDizisi', [329, 256], 'Sur dişlerinin arasına kandiller dizilir.', 'Surlar yüz yıl sonra yeniden yandı.'),
  kasabaIsi(7, 1, 'Burç bayrakları', 'burcBayraklari', 5, 'flama', [76, 386], 'Burçların tepesine uzun bayraklar çekilir.', 'Bayraklar şafakla yarışıyor.'),
  kasabaIsi(7, 2, 'Kapı meşaleleri', 'kapiMesaleleri', 5, 'ates', [200, 582], 'Kale kapısının iki yanında meşaleler yanar.', 'Meşaleler kapıyı bekliyor, ben de.'),
  kasabaIsi(7, 3, 'Mazgal fenerleri', 'mazgalFenerleri', 6, 'parilti', [329, 292], 'Mazgal deliklerinden fener ışığı süzülür.', 'Kale gözlerini açtı.'),
  kasabaIsi(7, 4, 'Donanma ışıkları', 'donanmaIsiklari', 6, 'kandilDizisi', [329, 282], 'Surların bütün kenarları ışıkla çizilir: kale donanır.', 'İşte gerçek bir donanma gecesi!'),
  kasabaIsi(7, 5, 'Büyük burç ateşi', 'burcAtesi', 8, 'ates', [200, 34], 'En yüksek burçta büyük şenlik ateşi yakılır.', 'Kıvılcım Usta bu ateşi görüyordur.'),
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
