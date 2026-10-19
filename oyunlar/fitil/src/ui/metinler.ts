/**
 * Arayüzün bütün metinleri (GDD §14: "Bütün metinler src/ui/metinler.ts
 * sözlüğünde durur"). Emoji yok; simgeler SVG'dir. Sayı biçimi Türkçe
 * (binlik ayırıcı nokta, yüzde işareti önde: %92).
 */
import type { HedefVM, Nadirlik, RozetId, SeriBasamagi, YeniOge, EngelId, BolumTuru, DefterSekmesi } from './tipler';
import type { GuclendiriciId } from '../app/katalog';
import type { Motif } from '../core/types';

export const M = {
  oyunAdi: 'FİTİL',
  slogan: 'Bir çizgi çek, geceyi tutuştur.',
  dokunVeBasla: 'Dokun ve başla',
  fenerKoyu: 'Fener Koyu',

  // Genel
  geri: 'Geri',
  kapat: 'Kapat',
  devam: 'Devam',
  tamam: 'Tamam',
  basla: 'Başla',
  vazgec: 'Vazgeç',
  evet: 'Evet',
  kilitli: 'Kilitli',
  yeni: 'Yeni',
  hamle: 'hamle',
  hamleBuyuk: 'Hamle',
  puan: 'Puan',
  hedefler: 'Hedefler',
  enIyi: 'En iyi',

  // Harita
  bolum: 'Bölüm',
  usta: 'Usta',
  gununSenligi: 'Günün Şenliği',
  fisekDefteri: 'Fişek Defteri',
  istatistik: 'İstatistik',
  rozetler: 'Rozetler',
  ayarlar: 'Ayarlar',
  nasilOynanir: 'Nasıl oynanır',
  fenerNobeti: 'Fener Nöbeti',
  toplamYildiz: 'Toplam yıldız',
  gunlukGorev: 'Günlük görevler',
  buradasin: 'Buradasın',
  kilitliBolum: (onceki: number) => `Önce ${onceki}. bölümü kazan`,
  kilitliUsta: (gereken: number) => `${gereken} yıldızda açılır`,
  kilitliMahalle: (ilk: number) => `${ilk}. bölümde açılır`,
  gunlukKilitli: '10. bölümden sonra açılır',
  sonsuzSenlik: 'Sonsuz Şenlik',

  // Bölüm öncesi
  hazirRoket: 'Hazır roketle başlıyorsun',
  coskuSerisi: 'Coşku Serisi',
  yeniOge: 'Yeni',
  tabloEtiketi: 'Gece Tablosu',
  ustaKurali: 'Usta kuralı',

  // HUD
  duraklat: 'Duraklat',
  koruk: 'Körük',
  korukDolu: 'Körük dolu: dokun',
  sonHamle: 'Son hamle!',
  senlikBasliyor: 'Şenlik başlıyor!',
  sandikSallaniyor: 'Sandık sallanıyor…',
  iptal: 'İptal',
  secimMetni: {
    koruk: 'Isıtılacak merkezi seç',
    kibrit: 'Kibrit: tutuşturulacak hücreyi seç',
    kalip: 'Kalıp: rokete dönecek kapsülü seç',
  } as Record<string, string>,
  bolumBasina1: 'Bölüm başına 1 güçlendirici',
  guclendiriciAcilis: (n: number) => `${n}. bölümde açılır`,
  stokYok: 'Stok yok',

  // Duraklat
  duraklatildi: 'Duraklatıldı',
  yenidenBasla: 'Yeniden başla',
  haritayaDon: 'Haritaya dön',
  coskuBozulur: 'Yeniden başlamak Coşku Serisi’ni bozar.',

  // Kazandın
  // 1★ da bir kazançtır (bütün hedefler tamam): başlık olumlu; ilk bölümde çoğu oyuncu 1★ alır.
  kazandinBaslik: ['Başardın!', 'Başardın!', 'Harika!', 'Muhteşem!'] as const,
  yeniRekor: 'Yeni rekor',
  sandikAc: 'Aç',
  sonrakiSandik: 'Sonraki sandık',
  tekrarOyna: 'Tekrar oyna',
  sakla: 'Sakla',
  eskisiniKoru: 'Eskisini koru',
  saklandi: 'Saklanacak',
  eskisiKalacak: 'Eskisi kalacak',
  odulBaslik: 'Ödüller',

  // Kaybettin
  hamlelerBitti: 'Hamleler bitti',
  cokYaklastin: 'Çok yaklaştın!',
  azKaldi: 'Az kaldı!',
  birDahaDene: 'Bir daha dene!',
  tekrarDene: 'Tekrar dene',
  buCizgiKazandirirdi: 'Bu çizgi kazandırırdı',
  tekrarIzle: 'Tekrar izle',
  ustaEliBaslik: 'Kıvılcım Usta’nın Eli',
  ustaEliMetin: '+5 hamle ile devam et (en fazla 1★)',
  ustaEliDugme: '+5 hamle',
  coskuSifirlandi: 'Coşku Serisi sıfırlandı.',
  ucretsizTekrar: 'Can yok, bekleme yok: tekrar her zaman ücretsiz.',

  // Ayarlar
  ses: 'Ses',
  efektSesi: 'Efekt sesi',
  muzik: 'Müzik',
  ortamSesi: 'Ortam sesi',
  titresim: 'Titreşim',
  gorunum: 'Görünüm',
  hareketiAzalt: 'Hareketi azalt',
  animasyonHizi: 'Animasyon hızı',
  normal: 'Normal',
  hizli: 'Hızlı',
  renkPaleti: 'Renk paleti',
  // Parçalı seçicide kısa ad (390 px'te 'Yüksek ko…' diye kesiliyordu); ekran okuyucuya uzun ad.
  paletAdlari: { standart: 'Standart', renkKoru: 'Renk körü', yuksekKontrast: 'Kontrast' } as Record<string, string>,
  paletUzunAdlari: { standart: 'Standart', renkKoru: 'Renk körü', yuksekKontrast: 'Yüksek kontrast' } as Record<string, string>,
  yardim: 'Yardım',
  ipuclari: 'İpuçları',
  balonlariYenidenIzle: 'Balonları yeniden izle',
  balonlarSifirlandi: 'Balonlar yeniden gösterilecek',
  saglik: 'Sağlık',
  molaHatirlatici: 'Mola hatırlatıcısı',
  dk: (n: number) => `${n} dk`,
  kapali: 'Kapalı',
  kayit: 'Kayıt',
  kayitKodu: 'Kayıt kodu',
  disaAktar: 'Dışa aktar',
  iceAktar: 'İçe aktar',
  kopyala: 'Kopyala',
  kopyalandi: 'Panoya kopyalandı',
  kopyalanamadi: 'Kopyalanamadı: metin seçildi, elle kopyala',
  koduYapistir: 'Kayıt kodunu buraya yapıştır',
  yukle: 'Yükle',
  yukleOnay: 'Bu kayıt mevcut ilerlemenin yerine geçecek.',
  evetYukle: 'Evet, yükle',
  kayitYuklendi: 'Kayıt yüklendi',
  kayitGecersiz: 'Kod okunamadı',
  ilerlemeyiSifirla: 'İlerlemeyi sıfırla',
  sifirlaUyari1: 'Bütün yıldızlar, desenler ve rekorlar silinir.',
  sifirlaUyari2: 'Son kez: bu işlem geri alınamaz.',
  sifirla: 'Sıfırla',
  evetHepsiniSil: 'Evet, hepsini sil',
  sifirlandi: 'İlerleme sıfırlandı',
  depolama: {
    bulut: 'Kayıt hesabında saklanıyor',
    tarayici: 'Kayıt bu tarayıcıda saklanıyor',
    bellek: 'Kayıt geçici: sayfa kapanınca silinir. Kayıt kodunu dışa aktar.',
  } as Record<string, string>,
  defterKartlari: 'Defter kartları',
  hakkinda: 'Hakkında',
  hakkindaMetin: 'Fener Koyu’nun Işık Şenliği’ni yeniden yak. Can yok, bekleme yok, mağaza yok.',
  yaziTipi: 'Yazı tipi: Baloo 2 (SIL OFL). Sesler ve görüntüler oyun içinde üretilir.',
  surum: (s: string) => `Sürüm ${s}`,

  // Nasıl oynanır
  anladim: 'Anladım',
  sonraki: 'Sonraki',
  onceki: 'Önceki',

  // Defter
  toz: 'Kıvılcım tozu',
  tozHarca: 'Toz harca',
  tozHarcaIpucu: 'Bir parça seç: 10 toz = 1 parça',
  tozYetmez: '10 toz gerekir',
  tozHarcaOnay: '10 toz harca?',
  tak: 'Tak',
  takili: 'Takılı',
  cikar: 'Çıkar',
  sec: 'Seç',
  secili: 'Seçili',
  enFazla6: 'En fazla 6 desen takılır',
  parca: (n: number, t: number) => `${n}/${t}`,
  tabloYok: 'Bölüm kazandıkça Gece Tabloları burada birikir.',
  defterKilitli: 'Mahalleyi tamamlayınca açılır',
  defterBaslik: 'Fener Koyu Defteri',
  sekmeler: {
    desenler: 'Desenler',
    fitiller: 'Fitiller',
    gokyuzu: 'Gökyüzü',
    tablolar: 'Tablolar',
    motifler: 'Motifler',
    defter: 'Defter',
  } as Record<DefterSekmesi, string>,

  // Günlük
  oyna: 'Oyna',
  paylas: 'Paylaş',
  arsiv: 'Arşiv',
  arsivNotu: 'Arşiv bölümleri sandık vermez.',
  bugun: 'Bugün',
  dun: 'Dün',
  henuzOynanmadi: 'Henüz oynanmadı',
  seriMetni: (n: number) => `${n} gün`,
  sonrakiBasamak: (ad: string, kalan: number) => `${ad} için ${kalan} gün`,
  seriNotu: 'Kaçırılan gün seriyi sıfırlamaz, bir basamak düşürür.',
  ilkKazancSandik: 'İlk kazanç sandık verir',

  // İstatistik
  enUzunZincir: 'En uzun zincir',
  enBuyukReaksiyon: 'En büyük reaksiyon',
  toplamHalka: 'Toplam halka',
  toplamPatlama: 'Toplam patlama',
  enCokNesil: 'En çok nesil',
  enIyiGunluk: 'En iyi günlük skor',
  bolumRekorlari: 'Bölüm rekorları',
  rozetKilitli: 'Henüz kazanılmadı',

  // Mola
  molaBaslik: 'Kıvılcım Usta',
  molaMetin: 'Biraz mola? Gözlerini dinlendir, şenlik seni bekler.',
  molaVer: 'Mola ver',

  // Defter kartı
  mahalleTamam: (ad: string) => `${ad} tamamlandı!`,
} as const;

/**
 * Sayının belirtme hâli eki ("Bölüm 6'yı", "Bölüm 11'i"): sayının okunuşunun
 * son sözcüğüne göre (bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz; on,
 * yirmi, otuz, kırk, elli…).
 */
export function belirtmeEki(n: number): string {
  const birler = ["'ı", "'i", "'yi", "'ü", "'ü", "'i", "'yı", "'yi", "'i", "'u"];
  const onlar = ["'ı", "'u", "'yi", "'u", "'ı", "'yi", "'ı", "'i", "'i", "'ı"];
  const b = Math.abs(n) % 10;
  if (b !== 0) return birler[b];
  const o = Math.floor(Math.abs(n) / 10) % 10;
  return o === 0 ? (n === 0 ? "'ı" : "'ü") : onlar[o];
}

/** Sakinlerin iyelik hâli (panelde "Kayıkçı Rıza'nın işleri"; KASABA_SAKINLERI sırası). */
export const SAKIN_IYELIK: readonly string[] = [
  "Kayıkçı Rıza'nın",
  "Kandilci Nazlı'nın",
  "Kaptan Yakup'un",
  "Saatçi Hüsnü Usta'nın",
  "Bahçıvan Gülizar'ın",
  "Gökbilimci Ayşe'nin",
  "Barutçu Kemal'in",
  "Sur Bekçisi Murat'ın",
];

/** (Kancalar §C.7) Bölüm Mühürleri ve Kasaba İşleri metinleri. */
export const MK = {
  muhurler: 'Mühürler',
  kademe: { cirak: 'Çırak', kalfa: 'Kalfa', usta: 'Usta' } as Record<'cirak' | 'kalfa' | 'usta', string>,
  kademeBuyuk: { cirak: 'ÇIRAK', kalfa: 'KALFA', usta: 'USTA' } as Record<'cirak' | 'kalfa' | 'usta', string>,
  muhurTuttu: (kademe: string) => `${kademe} mührü!`,
  sancak: 'Sancak!',
  durum: {
    tuttu: 'Tuttu: kazanırsan basılır',
    bekliyor: 'Henüz değil',
    korunuyor: 'Şimdilik tutuyor',
    bozuldu: 'Bu denemede bozuldu',
    sonda: 'Kazanınca ölçülür',
    basili: 'Basılı',
  } as Record<'tuttu' | 'bekliyor' | 'korunuyor' | 'bozuldu' | 'sonda' | 'basili', string>,
  ustaEliMuhur: "Usta'nın Eli ile mühür basılmaz",
  /** Duraklat ilerlemesi: "2/4" ya da tek hamle ölçüsünde "En iyi 19/27". */
  muhurIlerleme: (deger: number, hedef: number, tek: boolean) => (tek ? `En iyi ${deger}/${hedef}` : `${deger}/${hedef}`),
  rozetEtiket: (n: number) => `Mühürler: ${n}/3`,
  yeni: 'YENİ',
  muhurTanitim: 'Her bölümde üç mühür var. Kazandığın oyunda tutanlar basılır.',
  muhurKart: 'Mühürler bölümü başka bir yolla oynatır. Üçünü ayrı denemelerde toplayabilirsin.',
  muhurHud: 'Mühür tuttu! Kazanırsan basılır.',
  sancakIlk: 'Üç mühür: çatıya sancak!',
  parcaDuyuru: (fitil: string, n: number) => `${fitil} parçası (${n} mühür)`,
  tozDuyuru: (toz: number, n: number) => `+${toz} toz (${n} mühür)`,

  kasaba: 'Kasaba',
  kasabaBaslik: 'Fener Koyu Kasabası',
  kandil: 'Kandil',
  kandilSayisi: (n: number) => `${n} kandil`,
  kandilArti: (n: number) => `+${n} kandil`,
  kandilTanitim: 'Her yeni yıldız bir kandil. Kandille kasabayı süsle.',
  yap: 'Yap',
  yapildi: 'Yapıldı',
  eksik: (n: number) => `${n} eksik`,
  tacKilitli: 'Önce 5 işi bitir',
  sirada: (mahalle: string) => `Önce ${mahalle} süslensin`,
  haritaKilitli: (n: number) => `Bölüm ${n}${belirtmeEki(n)} aç`,
  kasabaKapali: '3. bölümü kazanınca açılır',
  kandilYetti: (is: string) => `Kandil yetti: ${is} yapalım mı?`,
  kasabaIlk: 'Yıldızların kandile döndü! Kasabayı süsleyelim.',
  kasabaHosgeldin: (n: number) => `Fener Koyu seni bekliyordu. ${n} kandilin var.`,
  isHazir: 'Kasabada yapılacak iş hazır!',
  sakinIsleri: (m: number) => `${SAKIN_IYELIK[m] ?? ''} işleri`,
  mahalleSenligi: 'Mahalle şenliği',
  mahalleSuslendi: (ad: string) => `${ad} süslendi!`,
  isEtiketi: (ad: string, maliyet: number, durum: string) => `${ad}, ${maliyet} kandil, ${durum}`,
  isDurumAdi: {
    yapildi: 'yapıldı',
    yapilabilir: 'yapılabilir',
    yetersiz: 'kandil yetmiyor',
    tacKilitli: 'kilitli',
    sirada: 'kilitli',
    haritaKilitli: 'kilitli',
    kasabaKapali: 'kilitli',
  } as Record<string, string>,
  kasabaDugme: (n: number, hazir: boolean) => `Kasaba: ${n} kandil${hazir ? ', yapılacak iş var' : ''}`,
  fenerKoyu: 'Fener Koyu',
  kasabaTamamDugme: 'Fener Koyu: bütün kasaba süslendi',
  yeniSurum: 'Oyunun yeni sürümü açıldı: bu sayfa ilerlemeni kaydetmiyor. Sayfayı yenile.',
  kasabaKartlari: 'Kasaba kartları',
  kayitOzeti: (muhur: number, isler: number, kandil: number) => `Mühür ${muhur} · Kasaba ${isler}/48 işi · ${kandil} kandil`,
} as const;

/** Kapsül renk adları (§2.3); küçük harfli, sayılarla kullanılır. */
export const RENK_ADLARI = ['kızıl', 'kehribar', 'zümrüt', 'gök', 'mor', 'gül'] as const;
export const RENK_ADLARI_BUYUK = ['Kızıl', 'Kehribar', 'Zümrüt', 'Gök', 'Mor', 'Gül'] as const;

export const MOTIF_ADLARI: Record<Motif, string> = {
  lale: 'Lale',
  kayik: 'Kayık',
  mart: 'Martı',
  fener: 'Fener',
  carkifelek: 'Çarkıfelek',
  burc: 'Burç',
};

export const GUCLENDIRICI_ADLARI: Record<GuclendiriciId, string> = {
  kibrit: 'Kibrit',
  kalip: 'Fişek Kalıbı',
  geriSar: 'Geri Sar',
};

export const GUCLENDIRICI_ACIKLAMA: Record<GuclendiriciId, string> = {
  kibrit: 'Seçtiğin hücreyi tutuşturur.',
  kalip: 'Bir kapsülü rokete çevirir.',
  geriSar: 'Son hamleyi geri alır.',
};

export const NADIRLIK_ADLARI: Record<Nadirlik, string> = {
  sade: 'Sade',
  parlak: 'Parlak',
  saheser: 'Şaheser',
};

export const SERI_BASAMAKLARI: readonly { id: SeriBasamagi; ad: string; gun: number }[] = [
  { id: 'kivilcim', ad: 'Kıvılcım', gun: 1 },
  { id: 'cira', ad: 'Çıra', gun: 3 },
  { id: 'mesale', ad: 'Meşale', gun: 7 },
  { id: 'fener', ad: 'Fener', gun: 14 },
  { id: 'denizFeneri', ad: 'Deniz Feneri', gun: 30 },
];

export const YENI_OGE: Record<YeniOge, { ad: string; metin: string }> = {
  cizim: { ad: 'Fitil', metin: 'Aynı renkleri birleştir, bırak.' },
  capraz: { ad: 'Çapraz yol', metin: 'Çapraz da bağlanır.' },
  isi: { ad: 'Isı', metin: 'Kızgın kapsül bir ısıyla tutuşur.' },
  roket: { ad: 'Roket', metin: '6 ve üstü zincir roket olur.' },
  kafes: { ad: 'Kafes', metin: 'Kafes yalnız ısıyla açılır.' },
  nisan: { ad: 'Nişan', metin: 'Roketin yönünü son adım belirler.' },
  kasimpati: { ad: 'Kasımpatı', metin: '9 ve üstü: etrafını da ısıtır.' },
  islak: { ad: 'Islak barut', metin: 'Yanında patlat, kurusun.' },
  halka: { ad: 'Halka', metin: 'Başladığın yere dön: ısı iki kat.' },
  doseme: { ad: 'Döşeme', metin: 'Üstünde patlat, sokak aydınlansın.' },
  fener: { ad: 'Fener', metin: 'Feneri en alt sıraya indir.' },
  yildiz: { ad: 'Yıldız topu', metin: '12 ve üstü: her renge uyar.' },
  kaya: { ad: 'Kaya', metin: 'Yanındaki patlamayla ufalanır.' },
  kombo: { ad: 'Kombinasyon', metin: 'İki özel taş aynı fitilde birleşir.' },
  devFisek: { ad: 'Dev fişek', metin: 'Yanında patlatarak doldur.' },
  koruk: { ad: 'Körük', metin: 'Dolunca dokun, istediğin yeri ısıt.' },
  kova: { ad: 'Su kovası', metin: 'Yanındakileri ısıtmaz.' },
  bayram: { ad: 'Kuru Gece', metin: 'Barut 3 ısıda tutuşur.' },
  barutIzi: { ad: 'Barut izi', metin: 'Değen patlama bütün izi yakar.' },
  altiRenk: { ad: 'Altı renk', metin: 'Gül kapsüller katıldı.' },
  delik: { ad: 'Delikli tahta', metin: 'Tahtanın şekli değişir.' },
  doseme2: { ad: 'Çift kat', metin: 'İki patlama ister.' },
  desen: { ad: 'Işık Deseni', metin: 'Her karo kendi rengini ister.' },
  esik5: { ad: 'Nemli Gece', metin: 'Barut 5 ısıda tutuşur.' },
  meltem: { ad: 'Meltem', metin: 'Satırı kızdırır. Sırasını bekle!' },
  is: { ad: 'İs', metin: 'Yayılır! Her hamle birini temizle.' },
  cisenti: { ad: 'Çisenti', metin: 'Satırı söndürür. Önce orayı ateşle.' },
};

export const ENGEL_ADLARI: Record<EngelId, string> = {
  kafes: 'Kafes',
  islak: 'Islak barut',
  doseme: 'Döşeme',
  fener: 'Fener',
  kaya: 'Kaya',
  devFisek: 'Dev fişek',
  kova: 'Su kovası',
  barutIzi: 'Barut izi',
  delik: 'Delik',
  desen: 'Işık Deseni',
  meltem: 'Meltem',
  cisenti: 'Çisenti',
  is: 'İs',
};

/** Nasıl oynanır: 6 kart (§14.9). */
export const NASIL_KARTLARI = [
  { baslik: 'Çiz ve bırak', metin: 'Aynı renkteki kapsülleri parmağınla birleştir, bırak. En az 3.' },
  { baslik: 'Çapraz ve halka', metin: 'Çapraz da bağlanır. Başladığın yere dönersen HALKA: ısısı iki kat.' },
  { baslik: 'Isı ve kızgınlık', metin: 'Patlayan kapsül komşularını ısıtır. Kızgın olan bir ısı daha alınca kendiliğinden patlar.' },
  { baslik: 'Özel taşlar', metin: '6 zincir ROKET, 9 KASIMPATI, 12 YILDIZ TOPU. Roketin yönünü son adım belirler.' },
  { baslik: 'Kombinasyonlar', metin: 'İki özel taşı aynı fitile kat: birleşip dev bir etki yaparlar.' },
  { baslik: 'Engeller', metin: 'Her engel ısıyla ya da patlamayla konuşur. Açtıkların burada.' },
] as const;

export const ROZETLER: Record<RozetId, { ad: string; kosul: string }> = {
  ilkKivilcim: { ad: 'İlk Kıvılcım', kosul: '1. bölümü kazan' },
  caprazNisanci: { ad: 'Çapraz Nişancı', kosul: 'Çapraz roketle tek oyunda 3 kafes kır' },
  sarVePisir: { ad: 'Sar ve Pişir', kosul: 'Tek zincirle bir kafesi 3 komşusundan ısıt' },
  halkaci: { ad: 'Halkacı', kosul: 'Toplam 50 halka çiz' },
  otuzluk: { ad: 'Otuzluk', kosul: 'Tek hamlede 30 reaksiyon' },
  senlik: { ad: 'ŞENLİK!', kosul: 'Tek hamlede 40 reaksiyon' },
  ucuncuKusak: { ad: 'Üçüncü Kuşak', kosul: 'Bir hamlede 3. nesil patlama' },
  buyukFinal: { ad: 'Büyük Final', kosul: 'Yıldız + Yıldız kombinasyonu' },
  roketYagmuru: { ad: 'Roket Yağmuru', kosul: 'Yıldız + Roket kombinasyonu' },
  kilpayi: { ad: 'Kılpayı', kosul: 'Son hamlede kazan' },
  tutumlu: { ad: 'Tutumlu', kosul: '10+ hamle kalarak kazan' },
  ustaCirak: { ad: 'Usta Çırak', kosul: 'Bir mahallenin tamamında 3★' },
  saheser: { ad: 'Şaheser', kosul: 'İlk Şaheser tablo' },
  defterci: { ad: 'Defterci', kosul: '12 desen tamamla' },
  nobetci: { ad: 'Nöbetçi', kosul: 'Fener Nöbeti 7' },
  denizFeneri: { ad: 'Deniz Feneri', kosul: 'Fener Nöbeti 30' },
  korukcu: { ad: 'Körükçü', kosul: 'Körükle 10+ reaksiyon' },
  domino: { ad: 'Domino', kosul: 'Barut iziyle 3 dev fişek ateşle' },
};

export const ROZET_SIRASI: readonly RozetId[] = [
  'ilkKivilcim', 'caprazNisanci', 'sarVePisir', 'halkaci', 'otuzluk', 'senlik',
  'ucuncuKusak', 'buyukFinal', 'roketYagmuru', 'kilpayi', 'tutumlu', 'ustaCirak',
  'saheser', 'defterci', 'nobetci', 'denizFeneri', 'korukcu', 'domino',
];

/**
 * Fener Koyu Defteri kültür kartları (§10.1): mahalle başına en fazla 4
 * cümle. Son cümleler oyunun dünyasına (Fener Koyu) aittir.
 */
export const DEFTER_KARTLARI: readonly { baslik: string; metin: string }[] = [
  {
    baslik: 'Fener alayı',
    metin:
      'Fener alayı, bayram akşamlarında elde fenerlerle sokak sokak yürüyen kalabalığın adıdır. Cumhuriyet Bayramı’nda bugün de pek çok kentte fener alayı yapılır. Çocuklar kâğıt fenerlerini günler önceden hazırlar. Fener Koyu’nda alay, iskelenin ucunda denize bırakılan fenerlerle biter.',
  },
  {
    baslik: 'Mahya',
    metin:
      'Mahya, iki minare arasına gerilen iplere dizilmiş kandillerle yazılan ışıklı yazıdır. Ramazan’da İstanbul camilerinde kurulur ve uzaktan okunacak kadar büyüktür. Ustalar yazıyı yerde ipe dizer, sonra makaralarla yukarı çeker. Bu sanatın dünyada bir benzeri yoktur.',
  },
  {
    baslik: 'Kayık fenerleri',
    metin:
      'Gece balığına çıkan kayıklar pruvalarına lamba asardı; ışık balığı yüzeye çekerdi. Kıyıdan bakana lambalar denizde yüzen yıldızlar gibi görünürdü. Sıra sıra dizildiklerinde koy bir sokak gibi aydınlanırdı. Fener Koyu’nun balıkçıları hâlâ her kayığa bir fener asar.',
  },
  {
    baslik: 'Saat kuleleri',
    metin:
      'Osmanlı’nın son yüzyılında Anadolu kentlerine pek çok saat kulesi yapıldı. Kule, herkesin aynı saati paylaştığı bir buluşma yeriydi. Çanının sesi çarşının açılışını ve kapanışını haber verirdi. Fener Koyu’nda şenlik gecesi kulenin kadranı kandillerle çevrilir.',
  },
  {
    baslik: 'Hıdırellez',
    metin:
      'Hıdırellez, 6 Mayıs’ta baharın gelişini kutlayan eski bir şenliktir. Geceden ateş yakılır, üzerinden atlanarak dilek tutulur. Dilekler kâğıda yazılıp gül ağacının dalına bağlanır. Sabah ağacın altında toplananlar baharı birlikte karşılar.',
  },
  {
    baslik: 'Nevruz ateşi',
    metin:
      'Nevruz, gece ile gündüzün eşitlendiği 21 Mart’ta baharı karşılar. Tepelerde büyük ateşler yakılır, gençler ateşin üzerinden atlar. Yumurta boyanır, demir dövülür, bereket dilenir. Ateşin ışığı yeni yılın aydınlık geçmesi dileğidir.',
  },
  {
    baslik: 'Baruthaneler',
    metin:
      'Osmanlı’nın barutu Bakırköy ve Azadlı gibi baruthanelerde üretilirdi. Güherçile, kükürt ve kömür büyük havanlarda dövülerek karıştırılırdı. Kıvılcım çıkmasın diye bakır ve ahşap aletler kullanılırdı. Şenlik fişeklerinin barutu da bu ustaların elinden geçerdi.',
  },
  {
    baslik: 'Donanma şenlikleri',
    metin:
      'Osmanlı’da “donanma”, şehri kandiller ve fişeklerle süsleyerek yapılan büyük şenliğin adıydı. Doğumlar ve zaferler günlerce süren donanmalarla kutlanırdı. Haliç’te sallar üzerinde fişek gösterileri yapılır, burçlar ışıkla çevrilirdi. Surname adlı kitaplar bu şenlikleri resimleriyle anlatır.',
  },
];

/** (Kancalar §B.5) Kasaba kartları: mahallenin 6 işi bitince sakinin mektubu (mahalle sırasıyla). */
export const KASABA_KARTLARI: readonly { baslik: string; metin: string }[] = [
  { baslik: 'Kayıkçı Rıza\'nın mektubu', metin: 'Çırak, iskele yeniden ışıl ışıl. Kayıklar artık gece de yolunu buluyor, çocuklar fenerlerin altında oyun kuruyor. Deniz fenerinin döndüğünü gören balıkçılar sabaha kadar türkü söyledi. Babamın feneri sana emanet.' },
  { baslik: 'Kandilci Nazlı\'nın mektubu', metin: 'Dükkânların kapısında kandiller yandığından beri çarşı gece de kapanmıyor. Mahyadaki ŞENLİK yazısını ta tepeden okuyorlarmış. Kandillerin mırıldandığı ezgiyi sen de duydun mu? Bu ışıklar senin elinden.' },
  { baslik: 'Kaptan Yakup\'un mektubu', metin: 'Gemim donandı, vinç bile bayramlık giydi. Mendirekteki fenerler yanınca uzak limanlardan selam geldi. Tayfalar "Fener Koyu yeniden uyandı" diyor. Bir gün seni de denize çıkarırım, çırak.' },
  { baslik: 'Saatçi Hüsnü Usta\'nın mektubu', metin: 'Kadran yeniden aydınlandı, akrep yerine oturdu. Şenlik çanı çaldığında meydandaki herkes saatini düzeltti. Kulenin her kandili bir saniye kadar değerli. Tam zamanında geldin, çırak.' },
  { baslik: 'Bahçıvan Gülizar\'ın mektubu', metin: 'Dut ağacındaki kurdeleler rüzgârda dilekleri fısıldıyor. Havuzdaki kandiller sabaha kadar süzüldü, ateş böcekleri de onlara eşlik etti. Hıdırellez ateşinin üstünden bütün mahalle atladı. Senin dileğin de kabul olsun.' },
  { baslik: 'Gökbilimci Ayşe\'nin mektubu', metin: 'Rasathanenin kubbesinden gök iki kat parlak görünüyor. Değirmenin ışıklı kanatları yıldızlarla dans ediyor. Gök haritasına senin adını da ekledim: küçük ama parlak bir yıldız. Nevruz ateşi bu yıl en güzel burada yandı.' },
  { baslik: 'Barutçu Kemal\'in mektubu', metin: 'Bacalardan artık duman değil altın kıvılcım yükseliyor. Depo kapısındaki fenerler, sabrın ışıkla ödüllendiğini hatırlatıyor. Şenlik düdüğü öttüğünde bütün işçiler gökyüzüne baktı. Barut sabır ister; sen sabrettin.' },
  { baslik: 'Sur Bekçisi Murat\'ın mektubu', metin: 'Surlar yüz yıl sonra yeniden donandı. Burçtaki büyük ateşi uzak köylerden bile görmüşler. Bekçiliğimde ilk kez bütün gece hiç karanlık görmedim. Kıvılcım Usta\'nın sözü yerine geldi, çırak: koy yeniden yandı.' },
];

/** Günlük görev şablonları (§10.5). {n}: sayı, {renk}: renk adı. */
export const GOREV_SABLONLARI: readonly string[] = [
  '2 halka çiz',
  'Tek hamlede 15+ reaksiyon yap',
  '50 {renk} patlat',
  '3 roket ateşle',
  '1 kasımpatı ateşle',
  'Bir kombinasyon yap',
  '5 kafes kır',
  '20 döşeme aydınlat',
  '3 bölümü kazan',
  'Bir bölümü 3★ ile bitir',
  '12+ düğümlü bir zincir çiz',
  'Körük’ü 2 kez kullan',
  'Çapraz roketle 2 engel vur',
  '10 kayayı kır',
  '2 fener indir',
  'Final gösterisinde 5+ roket ateşle',
  'Günün Şenliği’ni kazan',
  '2. nesil bir patlama yap',
  '30 kapsülü ısıyla patlat',
  'Bir bölümü ilk denemede kazan',
];

/** Görev şablonunu doldurur (sablon 1 tabanlı). */
export function gorevMetni(sablon: number, renk = 3): string {
  const s = GOREV_SABLONLARI[sablon - 1] ?? '';
  return s.replace('{renk}', RENK_ADLARI[renk] ?? 'gök');
}

const sayiBicimi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

/** 12450 → "12.450" */
export function sayi(n: number): string {
  return sayiBicimi.format(Math.round(n));
}

/** 0,92 → "%92" */
export function yuzde(o: number): string {
  return `%${Math.max(0, Math.min(100, Math.floor(o * 100 + 1e-9)))}`;
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** 20261014 → "14.10.2026" */
export function tarihKisa(t: number): string {
  const y = Math.floor(t / 10000);
  const a = Math.floor(t / 100) % 100;
  const g = t % 100;
  return `${String(g).padStart(2, '0')}.${String(a).padStart(2, '0')}.${y}`;
}

/** 20261014 → "14 Ekim 2026" */
export function tarihUzun(t: number): string {
  const y = Math.floor(t / 10000);
  const a = Math.floor(t / 100) % 100;
  const g = t % 100;
  return `${g} ${AYLAR[a - 1] ?? ''} ${y}`;
}

/** Bölüm başlığı: 12 → "Bölüm 12", 103 → "Usta 3", 20261014 → "Günün Şenliği". */
export function bolumBasligi(id: number, tur?: BolumTuru): string {
  if (tur === 'gunluk' || id > 1_000_000) return id > 19_000_000 && id < 30_000_000 ? M.gununSenligi : `Sonsuz ${id - 1_000_000}`;
  if (tur === 'usta' || (id > 100 && id < 200)) return `${M.usta} ${id - 100}`;
  return `${M.bolum} ${id}`;
}

/** Eşik varsayılan (4) değilse bilgi satırı (§14.3). */
export function esikBilgisi(esik: number): string | null {
  if (esik === 4) return null;
  if (esik <= 2) return `Kuru Barut: barut ${esik} ısıda tutuşur`;
  if (esik === 3) return 'Kuru Gece: barut 3 ısıda tutuşur';
  return `Nemli Gece: barut ${esik} ısıda tutuşur`;
}

/** Hedefin kalanı (HUD sayacı). */
export function hedefKalan(h: HedefVM): number {
  return Math.max(0, h.gerekli - h.ilerleme);
}

/** Kısa hedef adı (sayısız): "kızıl", "kafes", "döşeme"… */
export function hedefAdi(h: HedefVM): string {
  switch (h.tur) {
    case 'topla':
      return h.renk === 'hepsi' || h.renk === undefined ? 'kapsül' : (RENK_ADLARI[h.renk] ?? 'kapsül');
    case 'kafes':
      return 'kafes';
    case 'kaya':
      return 'kaya';
    case 'fener':
      return 'fener';
    case 'aydinlat':
      return 'döşeme';
    case 'desen':
      return 'desen karosu';
    case 'devFisek':
      return 'dev fişek';
    case 'is':
      return 'is';
    case 'zincirleme':
      return 'zincirleme';
    case 'halka':
      return 'halka';
    case 'puan':
      return 'puan';
  }
}

/** Bölüm öncesi kartında hedef: "25 kapsül", "Bütün kafesler", "3 kez 15+ reaksiyon". */
export function hedefMetni(h: HedefVM): string {
  switch (h.tur) {
    case 'kafes':
      return 'Bütün kafesleri kır';
    case 'kaya':
      return 'Bütün kayaları kır';
    case 'aydinlat':
      return 'Bütün döşemeleri aydınlat';
    case 'is':
      return 'Bütün isi temizle';
    case 'desen':
      return h.motif ? `${MOTIF_ADLARI[h.motif]} desenini boya` : 'Işık Desenini boya';
    case 'zincirleme':
      return `${h.gerekli} kez ${h.esik ?? 15}+ reaksiyon`;
    case 'puan':
      return `${sayi(h.gerekli)} puan`;
    case 'fener':
      return `${h.gerekli} fener indir`;
    case 'devFisek':
      return `${h.gerekli} dev fişek ateşle`;
    case 'halka':
      return `${h.gerekli} halka çiz`;
    case 'topla':
      return `${h.gerekli} ${hedefAdi(h)}`;
  }
}

/** Kayıp ekranı: "3 kızıl kaldı" (§6, §14.7). */
export function kalanMetni(h: HedefVM): string {
  const k = hedefKalan(h);
  if (h.tur === 'puan') return `${sayi(k)} puan kaldı`;
  return `${k} ${hedefAdi(h)} kaldı`;
}

/** Erişilebilirlik etiketi: "Kızıl: 12 kaldı" / "Kafes: tamam". */
export function hedefEtiketi(h: HedefVM): string {
  const ad = hedefAdi(h);
  const bas = ad.charAt(0).toLocaleUpperCase('tr-TR') + ad.slice(1);
  return h.tamam ? `${bas}: tamam` : `${bas}: ${sayi(hedefKalan(h))} kaldı`;
}

/** Kayıp ekranının büyük başlığı, ilerlemeye göre (yalan söylemez). */
export function kayipBasligi(yuzdeDegeri: number): string {
  if (yuzdeDegeri >= 0.8) return M.cokYaklastin;
  if (yuzdeDegeri >= 0.5) return M.azKaldi;
  return M.birDahaDene;
}

/** Fener Nöbeti: sonraki basamak ve kalan gün. */
export function sonrakiSeriBasamagi(gun: number): { ad: string; kalan: number } | null {
  for (const b of SERI_BASAMAKLARI) if (gun < b.gun) return { ad: b.ad, kalan: b.gun - gun };
  return null;
}

export function seriBasamakAdi(b: SeriBasamagi | null): string {
  return SERI_BASAMAKLARI.find((s) => s.id === b)?.ad ?? '';
}
