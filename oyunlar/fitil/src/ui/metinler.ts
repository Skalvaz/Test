/**
 * Arayüzün bütün metinleri (GDD §14: "Bütün metinler src/ui/metinler.ts
 * sözlüğünde durur"). Emoji yok; simgeler SVG'dir. İki dil (Ekim 2026):
 * her metin `t(türkçe, ingilizce)`; sayfa dili açılışta bir kez belirlenir
 * (`platform/dil.ts`), tablolar modül yüklenirken o dille kurulur. Türkçe
 * sayı biçimi binlik ayırıcı nokta, yüzde işareti önde (%92); İngilizcede
 * 1,234 ve 92%. Türkçe ek yardımcılarının (belirtme eki, iyelik) İngilizcede
 * karşılığı ayrı kurulur (sözcük sözcük çeviri değil).
 */
import type { HedefVM, Nadirlik, RozetId, SeriBasamagi, YeniOge, EngelId, BolumTuru, DefterSekmesi } from './tipler';
import type { GuclendiriciId } from '../app/katalog';
import type { Motif } from '../core/types';
import type { UrunId } from '../platform/gelir';
import { DIL, t, YEREL, buyukHarf } from '../platform/dil';

/** Sayfa İngilizce mi (dilbilgisi yollarını ayırmak için). */
const EN = DIL === 'en';

/** İngilizce tekil/çoğul ("1 move", "3 moves"). */
const cogul = (n: number, tek: string, cok: string): string => (n === 1 ? tek : cok);

export const M = {
  oyunAdi: 'FİTİL',
  slogan: t('Bir çizgi çek, geceyi tutuştur.', 'Draw a line, light up the night.'),
  dokunVeBasla: t('Dokun ve başla', 'Tap to start'),
  fenerKoyu: t('Fener Koyu', 'Lantern Cove'),

  // Genel
  geri: t('Geri', 'Back'),
  kapat: t('Kapat', 'Close'),
  devam: t('Devam', 'Continue'),
  tamam: t('Tamam', 'OK'),
  basla: t('Başla', 'Start'),
  vazgec: t('Vazgeç', 'Cancel'),
  evet: t('Evet', 'Yes'),
  kilitli: t('Kilitli', 'Locked'),
  yeni: t('Yeni', 'New'),
  hamle: t('hamle', 'moves'),
  hamleBuyuk: t('Hamle', 'Moves'),
  /** "12 hamle" / "12 moves", "1 move". */
  hamleAdet: t(
    (n: number) => `${n} hamle`,
    (n: number) => `${n} ${cogul(n, 'move', 'moves')}`,
  ),
  puan: t('Puan', 'Score'),
  hedefler: t('Hedefler', 'Goals'),
  enIyi: t('En iyi', 'Best'),
  /** Yıldız sırası etiketi: "2/3 yıldız". */
  yildizEtiketi: t(
    (n: number) => `${n}/3 yıldız`,
    (n: number) => `${n}/3 stars`,
  ),
  /** "2 yıldız" / "2 stars", "1 star". */
  yildizAdet: t(
    (n: number) => `${n} yıldız`,
    (n: number) => `${n} ${cogul(n, 'star', 'stars')}`,
  ),
  sandik: t('Sandık', 'Chest'),
  /** "+3 toz" (Kıvılcım tozu). */
  tozArti: t(
    (n: number) => `+${n} toz`,
    (n: number) => `+${n} dust`,
  ),

  // Harita
  bolum: t('Bölüm', 'Level'),
  usta: t('Usta', 'Master'),
  /** Usta Bölümü rozetinin harfi: "U3" / "M3". */
  ustaKisa: t('U', 'M'),
  /** Rehberin adı (balon etiketi). */
  ustaAdi: t('Kıvılcım Usta', 'Master Spark'),
  gununSenligi: t('Günün Şenliği', 'Daily Festival'),
  fisekDefteri: t('Fişek Defteri', 'Firework Album'),
  istatistik: t('İstatistik', 'Stats'),
  rozetler: t('Rozetler', 'Badges'),
  ayarlar: t('Ayarlar', 'Settings'),
  nasilOynanir: t('Nasıl oynanır', 'How to play'),
  fenerNobeti: t('Fener Nöbeti', 'Lantern Watch'),
  toplamYildiz: t('Toplam yıldız', 'Total stars'),
  gunlukGorev: t('Günlük görevler', 'Daily tasks'),
  buradasin: t('Buradasın', 'You are here'),
  kilitliBolum: t(
    (onceki: number) => `Önce ${onceki}. bölümü kazan`,
    (onceki: number) => `Win level ${onceki} first`,
  ),
  kilitliUsta: t(
    (gereken: number) => `${gereken} yıldızda açılır`,
    (gereken: number) => `Opens at ${gereken} stars`,
  ),
  /** Usta: yıldız yetiyor, yalnız bölüm kapısı (12) kaldı. */
  kilitliUstaBolum: t(
    (bolum: number) => `${bolum}. bölümden sonra açılır`,
    (bolum: number) => `Opens after level ${bolum}`,
  ),
  /** Usta: yıldız da bölüm kapısı da eksik. */
  kilitliUstaIkisi: t(
    (gereken: number, bolum: number) => `${gereken} yıldız ve ${bolum}. bölüm gerekir`,
    (gereken: number, bolum: number) => `Needs ${gereken} stars and level ${bolum}`,
  ),
  /** Usta düğümünün kilit etiketi (yalnız bölüm kapısı kaldıysa; iki satır). */
  ustaKapiEtiket: t(
    (bolum: number): [string, string] => [`${bolum}. bölümden`, 'sonra'],
    (bolum: number): [string, string] => ['After', `level ${bolum}`],
  ),
  kilitliMahalle: t(
    (ilk: number) => `${ilk}. bölümde açılır`,
    (ilk: number) => `Opens at level ${ilk}`,
  ),
  gunlukKilitli: t(
    (bolum: number) => `${bolum}. bölümden sonra açılır`,
    (bolum: number) => `Opens after level ${bolum}`,
  ),
  sonsuzSenlik: t('Sonsuz Şenlik', 'Endless Festival'),

  // Bölüm öncesi
  hazirRoket: t('Hazır roketle başlıyorsun', 'You start with a rocket'),
  coskuSerisi: t('Coşku Serisi', 'Cheer Streak'),
  yeniOge: t('Yeni', 'New'),
  tabloEtiketi: t('Gece Tablosu', 'Night Painting'),
  ustaKurali: t('Usta kuralı', 'Master rule'),

  // HUD
  duraklat: t('Duraklat', 'Pause'),
  koruk: t('Körük', 'Bellows'),
  korukDolu: t('Körük dolu: dokun', 'Bellows full: tap'),
  sonHamle: t('Son hamle!', 'Last move!'),
  senlikBasliyor: t('Şenlik başlıyor!', 'Festival begins!'),
  sandikSallaniyor: t('Sandık sallanıyor…', 'The chest is shaking…'),
  iptal: t('İptal', 'Cancel'),
  secimMetni: t<Record<string, string>>(
    {
      koruk: 'Isıtılacak merkezi seç',
      kibrit: 'Kibrit: tutuşturulacak hücreyi seç',
      kalip: 'Kalıp: rokete dönecek kapsülü seç',
    },
    {
      koruk: 'Pick a center to heat',
      kibrit: 'Match: pick a cell to ignite',
      kalip: 'Mold: pick a capsule for a rocket',
    },
  ),
  bolumBasina1: t('Bölüm başına 1 güçlendirici', '1 booster per level'),
  guclendiriciAcilis: t(
    (n: number) => `${n}. bölümde açılır`,
    (n: number) => `Opens at level ${n}`,
  ),
  stokYok: t('Stok yok', 'None left'),

  // Duraklat
  duraklatildi: t('Duraklatıldı', 'Paused'),
  yenidenBasla: t('Yeniden başla', 'Restart'),
  haritayaDon: t('Haritaya dön', 'Back to map'),
  coskuBozulur: t('Yeniden başlamak Coşku Serisi’ni bozar.', 'Restarting breaks your Cheer Streak.'),

  // Kazandın
  // 1★ da bir kazançtır (bütün hedefler tamam): başlık olumlu; ilk bölümde çoğu oyuncu 1★ alır.
  kazandinBaslik: t<readonly string[]>(['Başardın!', 'Başardın!', 'Harika!', 'Muhteşem!'], ['Level complete!', 'Level complete!', 'Great!', 'Amazing!']),
  yeniRekor: t('Yeni rekor', 'New record'),
  sandikAc: t('Sandığı aç', 'Open chest'),
  sonrakiSandik: t('Sonraki sandık', 'Next chest'),
  tekrarOyna: t('Tekrar oyna', 'Play again'),
  sakla: t('Sakla', 'Keep'),
  eskisiniKoru: t('Eskisini koru', 'Keep the old one'),
  saklandi: t('Saklanacak', 'Will be kept'),
  eskisiKalacak: t('Eskisi kalacak', 'Old one stays'),
  odulBaslik: t('Ödüller', 'Rewards'),

  // Kaybettin
  hamlelerBitti: t('Hamleler bitti', 'Out of moves'),
  cokYaklastin: t('Çok yaklaştın!', 'So close!'),
  azKaldi: t('Az kaldı!', 'Almost there!'),
  birDahaDene: t('Bir daha dene!', 'One more try!'),
  tekrarDene: t('Tekrar dene', 'Try again'),
  buCizgiKazandirirdi: t('Bu çizgi kazandırırdı', 'This line would win'),
  tekrarIzle: t('Tekrar izle', 'Watch again'),
  ustaEliBaslik: t('Kıvılcım Usta’nın Eli', 'Master Spark’s Hand'),
  ustaEliMetin: t('+5 hamle ile devam et (en fazla 1★)', 'Continue with +5 moves (max 1★)'),
  ustaEliDugme: t('+5 hamle', '+5 moves'),
  coskuSifirlandi: t('Coşku Serisi sıfırlandı.', 'Cheer Streak reset.'),
  ucretsizTekrar: t('Can yok, bekleme yok: tekrar her zaman ücretsiz.', 'No lives, no waiting: retries are always free.'),

  // Ayarlar
  ses: t('Ses', 'Sound'),
  efektSesi: t('Efekt sesi', 'Effects'),
  muzik: t('Müzik', 'Music'),
  ortamSesi: t('Ortam sesi', 'Ambience'),
  titresim: t('Titreşim', 'Vibration'),
  gorunum: t('Görünüm', 'Display'),
  dil: t('Dil', 'Language'),
  hareketiAzalt: t('Hareketi azalt', 'Reduce motion'),
  animasyonHizi: t('Animasyon hızı', 'Animation speed'),
  normal: t('Normal', 'Normal'),
  hizli: t('Hızlı', 'Fast'),
  renkPaleti: t('Renk paleti', 'Color palette'),
  // Parçalı seçicide kısa ad (390 px'te 'Yüksek ko…' diye kesiliyordu); ekran okuyucuya uzun ad.
  paletAdlari: t<Record<string, string>>(
    { standart: 'Standart', renkKoru: 'Renk körü', yuksekKontrast: 'Kontrast' },
    { standart: 'Standard', renkKoru: 'Colorblind', yuksekKontrast: 'Contrast' },
  ),
  paletUzunAdlari: t<Record<string, string>>(
    { standart: 'Standart', renkKoru: 'Renk körü', yuksekKontrast: 'Yüksek kontrast' },
    { standart: 'Standard', renkKoru: 'Colorblind', yuksekKontrast: 'High contrast' },
  ),
  yardim: t('Yardım', 'Help'),
  ipuclari: t('İpuçları', 'Hints'),
  balonlariYenidenIzle: t('Balonları yeniden izle', 'Show tips again'),
  balonlarSifirlandi: t('Balonlar yeniden gösterilecek', 'Tips will show again'),
  saglik: t('Sağlık', 'Health'),
  molaHatirlatici: t('Mola hatırlatıcısı', 'Break reminder'),
  dk: t(
    (n: number) => `${n} dk`,
    (n: number) => `${n} min`,
  ),
  kapali: t('Kapalı', 'Off'),
  kayit: t('Kayıt', 'Save'),
  kayitKodu: t('Kayıt kodu', 'Save code'),
  disaAktar: t('Dışa aktar', 'Export'),
  iceAktar: t('İçe aktar', 'Import'),
  kopyala: t('Kopyala', 'Copy'),
  kopyalandi: t('Panoya kopyalandı', 'Copied'),
  kopyalanamadi: t('Kopyalanamadı: metin seçildi, elle kopyala', 'Couldn’t copy: text selected, copy it yourself'),
  koduYapistir: t('Kayıt kodunu buraya yapıştır', 'Paste your save code here'),
  yukle: t('Yükle', 'Load'),
  yukleOnay: t('Bu kayıt mevcut ilerlemenin yerine geçecek.', 'This save will replace your current progress.'),
  evetYukle: t('Evet, yükle', 'Yes, load'),
  kayitYuklendi: t('Kayıt yüklendi', 'Save loaded'),
  kayitGecersiz: t('Kod okunamadı', 'Invalid code'),
  ilerlemeyiSifirla: t('İlerlemeyi sıfırla', 'Reset progress'),
  sifirlaUyari1: t('Bütün yıldızlar, desenler ve rekorlar silinir.', 'All stars, patterns and records will be deleted.'),
  sifirlaUyari2: t('Son kez: bu işlem geri alınamaz.', 'Last chance: this can’t be undone.'),
  sifirla: t('Sıfırla', 'Reset'),
  evetHepsiniSil: t('Evet, hepsini sil', 'Yes, delete all'),
  sifirlandi: t('İlerleme sıfırlandı', 'Progress reset'),
  depolama: t<Record<string, string>>(
    {
      bulut: 'Kayıt hesabında saklanıyor',
      tarayici: 'Kayıt bu tarayıcıda saklanıyor',
      bellek: 'Kayıt geçici: sayfa kapanınca silinir. Kayıt kodunu dışa aktar.',
    },
    {
      bulut: 'Saved to your account',
      tarayici: 'Saved in this browser',
      bellek: 'Temporary save: lost when the page closes. Export your save code.',
    },
  ),
  defterKartlari: t('Defter kartları', 'Journal cards'),
  hakkinda: t('Hakkında', 'About'),
  hakkindaMetin: t(
    'Fener Koyu’nun Işık Şenliği’ni yeniden yak. Can yok, bekleme yok, mağaza yok.',
    'Relight Lantern Cove’s Festival of Lights. No lives, no waiting, no shop.',
  ),
  /** (CAN-REKLAM §6) Gelir sağlayıcısı varken Hakkında metni ("Can yok…" cümlesinin yerine). */
  hakkindaMetinGelir: t(
    'Fener Koyu’nun Işık Şenliği’ni yeniden yak. Canlar 30 dakikada dolar; reklam yalnız sen isteyince.',
    'Relight Lantern Cove’s Festival of Lights. A life refills every 30 minutes; ads only when you ask.',
  ),
  yaziTipi: t('Yazı tipi: Nunito (SIL OFL). Sesler ve görüntüler oyun içinde üretilir.', 'Font: Nunito (SIL OFL). Sounds and pictures are made by the game.'),
  surum: t(
    (s: string) => `Sürüm ${s}`,
    (s: string) => `Version ${s}`,
  ),

  // Nasıl oynanır
  anladim: t('Anladım', 'Got it'),
  sonraki: t('Sonraki', 'Next'),
  onceki: t('Önceki', 'Back'),

  // Defter
  toz: t('Kıvılcım tozu', 'Spark dust'),
  tozHarca: t('Toz harca', 'Spend dust'),
  tozHarcaIpucu: t('Bir parça seç: 10 toz = 1 parça', 'Pick a piece: 10 dust = 1 piece'),
  tozYetmez: t('10 toz gerekir', 'Needs 10 dust'),
  tozHarcaOnay: t('10 toz harca?', 'Spend 10 dust?'),
  tak: t('Tak', 'Use'),
  takili: t('Takılı', 'In use'),
  cikar: t('Çıkar', 'Remove'),
  sec: t('Seç', 'Pick'),
  secili: t('Seçili', 'Picked'),
  enFazla6: t('En fazla 6 desen takılır', 'Up to 6 patterns in use'),
  parca: (n: number, toplam: number) => `${n}/${toplam}`,
  tabloYok: t('Bölüm kazandıkça Gece Tabloları burada birikir.', 'Win levels to collect Night Paintings here.'),
  defterKilitli: t('Mahalleyi tamamlayınca açılır', 'Opens when the district is complete'),
  defterBaslik: t('Fener Koyu Defteri', 'Lantern Cove Journal'),
  sekmeler: t<Record<DefterSekmesi, string>>(
    {
      desenler: 'Desenler',
      fitiller: 'Fitiller',
      gokyuzu: 'Gökyüzü',
      tablolar: 'Tablolar',
      motifler: 'Motifler',
      defter: 'Defter',
    },
    {
      desenler: 'Patterns',
      fitiller: 'Fuses',
      gokyuzu: 'Skies',
      tablolar: 'Paintings',
      motifler: 'Motifs',
      defter: 'Journal',
    },
  ),

  // Günlük
  oyna: t('Oyna', 'Play'),
  paylas: t('Paylaş', 'Share'),
  arsiv: t('Arşiv', 'Archive'),
  arsivNotu: t('Arşiv bölümleri sandık vermez.', 'Archive levels don’t give chests.'),
  bugun: t('Bugün', 'Today'),
  dun: t('Dün', 'Yesterday'),
  henuzOynanmadi: t('Henüz oynanmadı', 'Not played yet'),
  seriMetni: t(
    (n: number) => `${n} gün`,
    (n: number) => `${n} ${cogul(n, 'day', 'days')}`,
  ),
  sonrakiBasamak: t(
    (ad: string, kalan: number) => `${ad} için ${kalan} gün`,
    (ad: string, kalan: number) => `${kalan} ${cogul(kalan, 'day', 'days')} to ${ad}`,
  ),
  seriNotu: t('Kaçırılan gün seriyi sıfırlamaz, bir basamak düşürür.', 'A missed day won’t reset your streak, it drops one step.'),
  ilkKazancSandik: t('İlk kazanç sandık verir', 'First win gives a chest'),

  // İstatistik
  enUzunZincir: t('En uzun zincir', 'Longest chain'),
  enBuyukReaksiyon: t('En büyük reaksiyon', 'Biggest reaction'),
  toplamHalka: t('Toplam halka', 'Total loops'),
  toplamPatlama: t('Toplam patlama', 'Total pops'),
  enCokNesil: t('En çok nesil', 'Most generations'),
  enIyiGunluk: t('En iyi günlük skor', 'Best daily score'),
  bolumRekorlari: t('Bölüm rekorları', 'Level records'),
  rozetKilitli: t('Henüz kazanılmadı', 'Not earned yet'),
  rozeteDokun: t('Bir rozete dokun', 'Tap a badge'),

  // Mola
  molaBaslik: t('Kıvılcım Usta', 'Master Spark'),
  molaMetin: t('Biraz mola? Gözlerini dinlendir, şenlik seni bekler.', 'Time for a break? Rest your eyes, the festival will wait.'),
  molaVer: t('Mola ver', 'Take a break'),

  // Defter kartı
  mahalleTamam: t(
    (ad: string) => `${ad} tamamlandı!`,
    (ad: string) => `${ad} complete!`,
  ),
} as const;

/**
 * Sayının belirtme hâli eki ("Bölüm 6'yı", "Bölüm 11'i"): sayının okunuşunun
 * son sözcüğüne göre (bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz; on,
 * yirmi, otuz, kırk, elli…). Yalnız Türkçe metinlerde kullanılır; İngilizcede
 * ek yoktur (boş döner).
 */
export function belirtmeEki(n: number): string {
  if (EN) return '';
  const birler = ["'ı", "'i", "'yi", "'ü", "'ü", "'i", "'yı", "'yi", "'i", "'u"];
  const onlar = ["'ı", "'u", "'yi", "'u", "'ı", "'yi", "'ı", "'i", "'i", "'ı"];
  const b = Math.abs(n) % 10;
  if (b !== 0) return birler[b];
  const o = Math.floor(Math.abs(n) / 10) % 10;
  return o === 0 ? (n === 0 ? "'ı" : "'ü") : onlar[o];
}

/**
 * Sakinlerin iyelik hâli (panelde "Kayıkçı Rıza'nın işleri"; KASABA_SAKINLERI
 * sırası). İngilizcede özel ad korunur, meslek çevrilir: "Rıza the Boatman’s".
 */
export const SAKIN_IYELIK: readonly string[] = t(
  [
    "Kayıkçı Rıza'nın",
    "Kandilci Nazlı'nın",
    "Kaptan Yakup'un",
    "Saatçi Hüsnü Usta'nın",
    "Bahçıvan Gülizar'ın",
    "Gökbilimci Ayşe'nin",
    "Barutçu Kemal'in",
    "Sur Bekçisi Murat'ın",
  ],
  [
    'Rıza the Boatman’s',
    'Nazlı the Lamplighter’s',
    'Captain Yakup’s',
    'Hüsnü the Clockmaker’s',
    'Gülizar the Gardener’s',
    'Ayşe the Astronomer’s',
    'Kemal the Powder Maker’s',
    'Murat the Wall Guard’s',
  ],
);

type Kademe = 'cirak' | 'kalfa' | 'usta';
const KADEME: Record<Kademe, string> = t({ cirak: 'Çırak', kalfa: 'Kalfa', usta: 'Usta' }, { cirak: 'Apprentice', kalfa: 'Journeyman', usta: 'Master' });

/** (Kancalar §C.7) Bölüm Mühürleri ve Kasaba İşleri metinleri. */
export const MK = {
  muhurler: t('Mühürler', 'Seals'),
  kademe: KADEME,
  kademeBuyuk: t<Record<Kademe, string>>({ cirak: 'ÇIRAK', kalfa: 'KALFA', usta: 'USTA' }, { cirak: 'APPRENTICE', kalfa: 'JOURNEYMAN', usta: 'MASTER' }),
  muhurTuttu: t(
    (kademe: string) => `${kademe} mührü!`,
    (kademe: string) => `${kademe} seal!`,
  ),
  /** Kademenin mühür adı: "Kalfa mührü" / "Journeyman seal". */
  muhurAdi: t(
    (k: Kademe) => `${KADEME[k]} mührü`,
    (k: Kademe) => `${KADEME[k]} seal`,
  ),
  /** Basılmamış mühür (ekran okuyucu): "Kalfa mührü: yok". */
  muhurYok: t(': yok', ': none'),
  /** Haritada mahalle şeridinin mühür çipi: "Mühür 9/15". */
  muhurSayac: t(
    (n: number, toplam: number) => `Mühür ${n}/${toplam}`,
    (n: number, toplam: number) => `Seals ${n}/${toplam}`,
  ),
  sancak: t('Sancak!', 'Banner!'),
  durum: t<Record<'tuttu' | 'bekliyor' | 'korunuyor' | 'bozuldu' | 'sonda' | 'basili', string>>(
    {
      tuttu: 'Tuttu: kazanırsan basılır',
      bekliyor: 'Henüz değil',
      korunuyor: 'Şimdilik tutuyor',
      bozuldu: 'Bu denemede bozuldu',
      sonda: 'Kazanınca ölçülür',
      basili: 'Basılı',
    },
    {
      tuttu: 'Held: stamped if you win',
      bekliyor: 'Not yet',
      korunuyor: 'Holding for now',
      bozuldu: 'Broken this try',
      sonda: 'Checked when you win',
      basili: 'Stamped',
    },
  ),
  ustaEliMuhur: t("Usta'nın Eli ile mühür basılmaz", 'No seals with Master’s Hand'),
  /** Duraklat ilerlemesi: "2/4" ya da tek hamle ölçüsünde "En iyi 19/27". */
  muhurIlerleme: (deger: number, hedef: number, tek: boolean) => (tek ? `${t('En iyi', 'Best')} ${deger}/${hedef}` : `${deger}/${hedef}`),
  rozetEtiket: t(
    (n: number) => `Mühürler: ${n}/3`,
    (n: number) => `Seals: ${n}/3`,
  ),
  yeni: t('YENİ', 'NEW'),
  muhurTanitim: t('Her bölümde üç mühür var. Kazandığın oyunda tutanlar basılır.', 'Each level has three seals. The ones you hold are stamped when you win.'),
  muhurKart: t('Her bölümde 3 mühür görevi var. Görevleri oyunda Duraklat menüsünde görürsün.', 'Each level has 3 seal tasks. You can see them in the Pause menu.'),
  muhurHud: t('Mühür tuttu! Kazanırsan basılır.', 'Seal held! Win to stamp it.'),
  sancakIlk: t('Üç mühür: çatıya sancak!', 'Three seals: a banner on the roof!'),
  parcaDuyuru: t(
    (fitil: string, n: number) => `${fitil} parçası (${n} mühür)`,
    (fitil: string, n: number) => `${fitil} piece (${n} seals)`,
  ),
  tozDuyuru: t(
    (toz: number, n: number) => `+${toz} toz (${n} mühür)`,
    (toz: number, n: number) => `+${toz} dust (${n} seals)`,
  ),

  kasaba: t('Kasaba', 'Town'),
  kasabaBaslik: t('Fener Koyu Kasabası', 'Lantern Cove Town'),
  kandil: t('Kandil', 'Lamps'),
  kandilSayisi: t(
    (n: number) => `${n} kandil`,
    (n: number) => `${n} ${cogul(n, 'lamp', 'lamps')}`,
  ),
  kandilArti: t(
    (n: number) => `+${n} kandil`,
    (n: number) => `+${n} ${cogul(n, 'lamp', 'lamps')}`,
  ),
  /** Kazandın ödül kutusunun altındaki küçük ad ("+3 kandil"). */
  kandilKutuAdi: t('kandil', 'lamps'),
  kandilTanitim: t('Her yeni yıldız bir kandil. Kandille kasabayı süsle.', 'Every new star is a lamp. Use lamps to decorate the town.'),
  yap: t('Yap', 'Build'),
  yapildi: t('Yapıldı', 'Built'),
  eksik: t(
    (n: number) => `${n} eksik`,
    (n: number) => `${n} more`,
  ),
  tacKilitli: t('Önce 5 işi bitir', 'Build 5 first'),
  sirada: t(
    (mahalle: string) => `Önce ${mahalle} süslensin`,
    (mahalle: string) => `Decorate ${mahalle} first`,
  ),
  haritaKilitli: t(
    (n: number) => `Bölüm ${n}${belirtmeEki(n)} aç`,
    (n: number) => `Unlock level ${n}`,
  ),
  kasabaKapali: t('3. bölümü kazanınca açılır', 'Opens when you win level 3'),
  kandilYetti: t(
    (is: string) => `Kandil yetti: ${is} yapalım mı?`,
    (is: string) => `Enough lamps! Build “${is}”?`,
  ),
  kasabaIlk: t('Yıldızların kandile döndü! Kasabayı süsleyelim.', 'Your stars turned into lamps! Let’s decorate the town.'),
  kasabaHosgeldin: t(
    (n: number) => `Fener Koyu seni bekliyordu. ${n} kandilin var.`,
    (n: number) => `Lantern Cove was waiting for you. You have ${n} ${cogul(n, 'lamp', 'lamps')}.`,
  ),
  isHazir: t('Kasabada yapılacak iş hazır!', 'A town decoration is ready to build!'),
  sakinIsleri: t(
    (m: number) => `${SAKIN_IYELIK[m] ?? ''} işleri`,
    (m: number) => `${SAKIN_IYELIK[m] ?? ''} list`,
  ),
  mahalleSenligi: t('Mahalle şenliği', 'District festival'),
  /** Ekran okuyucu duyurusu: "Çarşı mahalle şenliği". */
  mahalleSenligiDuyuru: t(
    (ad: string) => `${ad} mahalle şenliği`,
    (ad: string) => `${ad} district festival`,
  ),
  mahalleSuslendi: t(
    (ad: string) => `${ad} süslendi!`,
    (ad: string) => `${ad} decorated!`,
  ),
  /** Haritada yeni iş kutlaması (ekran okuyucu): "Mahya yazısı yapıldı". */
  isYapildi: t(
    (ad: string) => `${ad} yapıldı`,
    (ad: string) => `${ad} built`,
  ),
  isEtiketi: t(
    (ad: string, maliyet: number, durum: string) => `${ad}, ${maliyet} kandil, ${durum}`,
    (ad: string, maliyet: number, durum: string) => `${ad}, ${maliyet} ${cogul(maliyet, 'lamp', 'lamps')}, ${durum}`,
  ),
  isDurumAdi: t<Record<string, string>>(
    {
      yapildi: 'yapıldı',
      yapilabilir: 'yapılabilir',
      yetersiz: 'kandil yetmiyor',
      tacKilitli: 'kilitli',
      sirada: 'kilitli',
      haritaKilitli: 'kilitli',
      kasabaKapali: 'kilitli',
    },
    {
      yapildi: 'built',
      yapilabilir: 'ready to build',
      yetersiz: 'not enough lamps',
      tacKilitli: 'locked',
      sirada: 'locked',
      haritaKilitli: 'locked',
      kasabaKapali: 'locked',
    },
  ),
  kasabaDugme: t(
    (n: number, hazir: boolean) => `Kasaba: ${n} kandil${hazir ? ', yapılacak iş var' : ''}`,
    (n: number, hazir: boolean) => `Town: ${n} ${cogul(n, 'lamp', 'lamps')}${hazir ? ', ready to build' : ''}`,
  ),
  fenerKoyu: t('Fener Koyu', 'Lantern Cove'),
  kasabaTamamDugme: t('Fener Koyu: bütün kasaba süslendi', 'Lantern Cove: the whole town is decorated'),
  yeniSurum: t(
    'Oyunun yeni sürümü açıldı: bu sayfa ilerlemeni kaydetmiyor. Sayfayı yenile.',
    'A newer version of the game is open: this page isn’t saving your progress. Reload the page.',
  ),
  kasabaKartlari: t('Kasaba kartları', 'Town letters'),
  kayitOzeti: t(
    (muhur: number, isler: number, kandil: number) => `Mühür ${muhur} · Kasaba ${isler}/48 işi · ${kandil} kandil`,
    (muhur: number, isler: number, kandil: number) => `Seals ${muhur} · Town ${isler}/48 · ${kandil} ${cogul(kandil, 'lamp', 'lamps')}`,
  ),
} as const;

/**
 * Oyun özeti ekranı (Ayarlar > Oyun özeti; aile testi: oyuncu ekran
 * görüntüsünü gönderir). Sütun adları kısa: tablo 360 px'te sığsın.
 */
export const MO = {
  baslik: t('Oyun özeti', 'Game summary'),
  ilkAcilis: t('İlk açılış', 'First opened'),
  /** İlk açılıştan bu yana gün: "Bugün", "Dün", "5 gün önce". */
  gunOnce: t(
    (n: number) => (n <= 0 ? 'Bugün' : n === 1 ? 'Dün' : `${n} gün önce`),
    (n: number) => (n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`),
  ),
  oturum: t('Oturum', 'Sessions'),
  oynananGun: t('Oynanan gün', 'Days played'),
  enYuksek: t('En yüksek bölüm', 'Highest level'),
  oyunSuresi: t('Oyun süresi', 'Play time'),
  saatDakika: t(
    (sa: number, dk: number) => `${sa} sa ${dk} dk`,
    (sa: number, dk: number) => `${sa} h ${dk} min`,
  ),
  surum: t('Sürüm', 'Version'),
  bolumler: t('Bölümler', 'Levels'),
  sonBolumler: t(
    (n: number) => `Son ${n} bölüm`,
    (n: number) => `Last ${n} levels`,
  ),
  bolum: t('Bölüm', 'Level'),
  deneme: t('Deneme', 'Tries'),
  kayip: t('Kayıp', 'Losses'),
  birakma: t('Bırakma', 'Quits'),
  sure: t('Süre', 'Time'),
  /** Ekran okuyucu (satır başlığında gizli): yıldızın ve vurgunun anlamı. */
  kazanildi: t('kazanıldı', 'won'),
  enCokTakilan: t('en çok takılınan bölüm', 'hardest level so far'),
  bos: t('Henüz oyun kaydı yok. Bir bölüm oynayınca burada görünür.', 'Nothing played yet. Play a level and it shows up here.'),
  bolumYok: t('Henüz bölüm oynanmadı.', 'No levels played yet.'),
  not: t(
    'Bu özet yalnız bu cihazda tutulur. Ekran görüntüsünü bize gönderebilirsin.',
    'This summary stays on this device. You can send us a screenshot.',
  ),
} as const;

/**
 * (CAN-REKLAM §6) Can, ödüllü reklam ve Mağaza metinleri. Yalnız gelir
 * sağlayıcısı varken görünür; kısa tutulur ("Liste": satır sayısı artmasın).
 */
export const MC = {
  canlarBitti: t('Canların bitti', 'Out of lives'),
  /** Can paneli başlığı: "Canlar 3/5". */
  canlarDurum: t(
    (n: number, enCok: number) => `Canlar ${n}/${enCok}`,
    (n: number, enCok: number) => `Lives ${n}/${enCok}`,
  ),
  canlarDolu: t('Canların dolu', 'Lives full'),
  sonrakiCan: t('Sonraki can', 'Next life'),
  reklamIzle: t('Reklam izle', 'Watch ad'),
  artiBirCan: t('+1 can', '+1 life'),
  ucretsizBirCan: t('Ücretsiz +1 can', 'Free +1 life'),
  /** Reklam satırının altında bugün kalan hak: "2 hak kaldı". */
  hakKaldi: t(
    (n: number) => `${n} hak kaldı`,
    (n: number) => `${n} left today`,
  ),
  yarinYine: t('Yarın yine', 'More tomorrow'),
  canlariDoldur: t('Canları doldur', 'Refill lives'),
  bekle: t('Bekle', 'Wait'),
  /** Harita can hapı (ekran okuyucu): "Canlar 3/5, sonraki can 12:31". */
  hapEtiketi: t(
    (n: number, enCok: number, sure: string | null) => `Canlar ${n}/${enCok}${sure ? `, sonraki can ${sure}` : ''}`,
    (n: number, enCok: number, sure: string | null) => `Lives ${n}/${enCok}${sure ? `, next life ${sure}` : ''}`,
  ),
  /** Kaybettin başlığının altı: "−1 can · 3 kaldı". */
  kayipCan: t(
    (kalan: number) => `−1 can · ${kalan} kaldı`,
    (kalan: number) => `−1 life · ${kalan} left`,
  ),
  artiBesHamle: t('+5 hamle', '+5 moves'),
  ucretsizBesHamle: t('Ücretsiz +5 hamle', 'Free +5 moves'),
  /** "+5 hamle" reklam düğmesinin ekran okuyucu adı. */
  reklamBesHamle: t('Reklam izle: +5 hamle', 'Watch an ad: +5 moves'),
  /** Kaybettin: can kalmayınca "Tekrar dene"nin yerine. */
  canBitti: t('Can bitti', 'Out of lives'),
  // "1 can" bölünmesin (bölünmez boşluk).
  cikisMetni: t('Bölümden çıkarsan 1 can gider.', 'Leaving the level costs 1 life.'),
  yenidenMetni: t('Yeniden başlarsan 1 can gider.', 'Restarting costs 1 life.'),
  cik: t('Çık', 'Leave'),
  magaza: t('Mağaza', 'Shop'),
  geriYukle: t('Satın alımları geri yükle', 'Restore purchases'),
  sendeVar: t('Sende var', 'Owned'),
  stokDolu: t('Stok dolu', 'Stock full'),
  suAnYok: t('Şu an yok', 'Unavailable'),
  /** Fiyat mağazadan henüz gelmedi (düğme pasif). */
  fiyatYok: '—',
} as const;

/** (CAN-REKLAM §4) Mağaza ürünlerinin adı ve tek satır açıklaması (G4 `MagazaVM`'i buradan doldurur). */
export const URUN_METINLERI: Record<UrunId, { ad: string; aciklama: string }> = t<Record<UrunId, { ad: string; aciklama: string }>>(
  {
    can_doldur: { ad: 'Canları doldur', aciklama: 'Canlar hemen 5’e dolar' },
    guclendirici_paketi: { ad: 'Güçlendirici paketi', aciklama: '3 Kibrit, 2 Fişek Kalıbı, 2 Geri Sar' },
    usta_karti: { ad: 'Usta kartı', aciklama: 'Reklamlı ödüller reklamsız gelir' },
  },
  {
    can_doldur: { ad: 'Refill lives', aciklama: 'Lives refill to 5 at once' },
    guclendirici_paketi: { ad: 'Booster pack', aciklama: '3 Matches, 2 Rocket Molds, 2 Undos' },
    usta_karti: { ad: 'Master’s Card', aciklama: 'Ad rewards without the ads' },
  },
);

/**
 * Geri sayım metni ("12:31", bir saati aşarsa "1:05:09"): saniye yukarı
 * yuvarlanır (son saniyede "0:01"), eksi süre "0:00". Dilden bağımsız.
 */
export function geriSayim(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  const sn = s % 60;
  const iki = (n: number) => String(n).padStart(2, '0');
  return sa > 0 ? `${sa}:${iki(dk)}:${iki(sn)}` : `${dk}:${iki(sn)}`;
}

/** Kapsül renk adları (§2.3); küçük harfli, sayılarla kullanılır. */
export const RENK_ADLARI: readonly string[] = t(['kızıl', 'kehribar', 'zümrüt', 'gök', 'mor', 'gül'], ['red', 'amber', 'emerald', 'sky', 'purple', 'rose']);
export const RENK_ADLARI_BUYUK: readonly string[] = t(['Kızıl', 'Kehribar', 'Zümrüt', 'Gök', 'Mor', 'Gül'], ['Red', 'Amber', 'Emerald', 'Sky', 'Purple', 'Rose']);

export const MOTIF_ADLARI: Record<Motif, string> = t<Record<Motif, string>>(
  {
    lale: 'Lale',
    kayik: 'Kayık',
    mart: 'Martı',
    fener: 'Fener',
    carkifelek: 'Çarkıfelek',
    burc: 'Burç',
  },
  {
    lale: 'Tulip',
    kayik: 'Boat',
    mart: 'Gull',
    fener: 'Lantern',
    carkifelek: 'Pinwheel',
    burc: 'Tower',
  },
);

export const GUCLENDIRICI_ADLARI: Record<GuclendiriciId, string> = t<Record<GuclendiriciId, string>>(
  {
    kibrit: 'Kibrit',
    kalip: 'Fişek Kalıbı',
    geriSar: 'Geri Sar',
  },
  {
    kibrit: 'Match',
    kalip: 'Rocket Mold',
    geriSar: 'Undo',
  },
);

export const GUCLENDIRICI_ACIKLAMA: Record<GuclendiriciId, string> = t<Record<GuclendiriciId, string>>(
  {
    kibrit: 'Seçtiğin hücreyi tutuşturur.',
    kalip: 'Bir kapsülü rokete çevirir.',
    geriSar: 'Son hamleyi geri alır.',
  },
  {
    kibrit: 'Ignites the cell you pick.',
    kalip: 'Turns a capsule into a rocket.',
    geriSar: 'Takes back your last move.',
  },
);

export const NADIRLIK_ADLARI: Record<Nadirlik, string> = t<Record<Nadirlik, string>>(
  {
    sade: 'Sade',
    parlak: 'Parlak',
    saheser: 'Şaheser',
  },
  {
    sade: 'Plain',
    parlak: 'Bright',
    saheser: 'Masterpiece',
  },
);

export const SERI_BASAMAKLARI: readonly { id: SeriBasamagi; ad: string; gun: number }[] = [
  { id: 'kivilcim', ad: t('Kıvılcım', 'Spark'), gun: 1 },
  { id: 'cira', ad: t('Çıra', 'Kindling'), gun: 3 },
  { id: 'mesale', ad: t('Meşale', 'Torch'), gun: 7 },
  { id: 'fener', ad: t('Fener', 'Lantern'), gun: 14 },
  { id: 'denizFeneri', ad: t('Deniz Feneri', 'Lighthouse'), gun: 30 },
];

export const YENI_OGE: Record<YeniOge, { ad: string; metin: string }> = t<Record<YeniOge, { ad: string; metin: string }>>(
  {
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
  },
  {
    cizim: { ad: 'Fuse', metin: 'Join matching colors, let go.' },
    capraz: { ad: 'Diagonals', metin: 'Diagonals connect too.' },
    isi: { ad: 'Heat', metin: 'A hot capsule ignites with 1 heat.' },
    roket: { ad: 'Rocket', metin: 'A chain of 6+ makes a rocket.' },
    kafes: { ad: 'Cage', metin: 'Only heat opens a cage.' },
    nisan: { ad: 'Aim', metin: 'The last step aims the rocket.' },
    kasimpati: { ad: 'Chrysanthemum', metin: '9 or more: heats around it too.' },
    islak: { ad: 'Wet Powder', metin: 'Pop next to it to dry it.' },
    halka: { ad: 'Loop', metin: 'Return to the start: double heat.' },
    doseme: { ad: 'Tile', metin: 'Pop on it to light the street.' },
    fener: { ad: 'Lantern', metin: 'Bring the lantern to the bottom.' },
    yildiz: { ad: 'Star Ball', metin: '12 or more: matches any color.' },
    kaya: { ad: 'Rock', metin: 'Crumbles when a pop is next to it.' },
    kombo: { ad: 'Combo', metin: 'Two specials in one fuse combine.' },
    devFisek: { ad: 'Giant Firework', metin: 'Pop next to it to fill it.' },
    koruk: { ad: 'Bellows', metin: 'Tap when full, heat any spot.' },
    kova: { ad: 'Water Bucket', metin: 'Doesn’t heat its neighbors.' },
    bayram: { ad: 'Dry Night', metin: 'Powder ignites at 3 heat.' },
    barutIzi: { ad: 'Powder Trail', metin: 'A pop touching it burns it all.' },
    altiRenk: { ad: 'Six colors', metin: 'Rose capsules join in.' },
    delik: { ad: 'Holes', metin: 'The board changes shape.' },
    doseme2: { ad: 'Double tile', metin: 'Needs two pops.' },
    desen: { ad: 'Light Pattern', metin: 'Each tile wants its own color.' },
    esik5: { ad: 'Damp Night', metin: 'Powder ignites at 5 heat.' },
    meltem: { ad: 'Breeze', metin: 'Heats a row. Wait for its turn!' },
    is: { ad: 'Soot', metin: 'It spreads! Clear one each move.' },
    cisenti: { ad: 'Drizzle', metin: 'Puts out a row. Fire there first.' },
  },
);

export const ENGEL_ADLARI: Record<EngelId, string> = t<Record<EngelId, string>>(
  {
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
  },
  {
    kafes: 'Cage',
    islak: 'Wet Powder',
    doseme: 'Tile',
    fener: 'Lantern',
    kaya: 'Rock',
    devFisek: 'Giant Firework',
    kova: 'Water Bucket',
    barutIzi: 'Powder Trail',
    delik: 'Hole',
    desen: 'Light Pattern',
    meltem: 'Breeze',
    cisenti: 'Drizzle',
    is: 'Soot',
  },
);

/** Nasıl oynanır: 6 kart (§14.9). */
export const NASIL_KARTLARI: readonly { baslik: string; metin: string }[] = t(
  [
    { baslik: 'Çiz ve bırak', metin: 'Aynı renkteki kapsülleri parmağınla birleştir, bırak. En az 3.' },
    { baslik: 'Çapraz ve halka', metin: 'Çapraz da bağlanır. Başladığın yere dönersen HALKA: ısısı iki kat.' },
    { baslik: 'Isı ve kızgınlık', metin: 'Patlayan kapsül komşularını ısıtır. Kızgın olan bir ısı daha alınca kendiliğinden patlar.' },
    { baslik: 'Özel taşlar', metin: '6 zincir ROKET, 9 KASIMPATI, 12 YILDIZ TOPU. Roketin yönünü son adım belirler.' },
    { baslik: 'Kombinasyonlar', metin: 'İki özel taşı aynı fitile kat: birleşip dev bir etki yaparlar.' },
    { baslik: 'Engeller', metin: 'Her engel ısıyla ya da patlamayla konuşur. Açtıkların burada.' },
  ],
  [
    { baslik: 'Draw and let go', metin: 'Join capsules of the same color with your finger, then let go. At least 3.' },
    { baslik: 'Diagonals and loops', metin: 'Diagonals connect too. End where you started for a LOOP: double heat.' },
    { baslik: 'Heat and hot capsules', metin: 'A popping capsule heats its neighbors. A hot one pops by itself with one more heat.' },
    { baslik: 'Special pieces', metin: 'Chain 6 for a ROCKET, 9 for a CHRYSANTHEMUM, 12 for a STAR BALL. The last step aims the rocket.' },
    { baslik: 'Combos', metin: 'Put two specials in one fuse: they join into one huge blast.' },
    { baslik: 'Obstacles', metin: 'Every obstacle reacts to heat or pops. The ones you know are shown here.' },
  ],
);

export const ROZETLER: Record<RozetId, { ad: string; kosul: string }> = t<Record<RozetId, { ad: string; kosul: string }>>(
  {
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
  },
  {
    ilkKivilcim: { ad: 'First Spark', kosul: 'Win level 1' },
    caprazNisanci: { ad: 'Diagonal Ace', kosul: 'Break 3 cages with diagonal rockets in one game' },
    sarVePisir: { ad: 'Wrap and Bake', kosul: 'Heat a cage from 3 sides with one chain' },
    halkaci: { ad: 'Loop Maker', kosul: 'Draw 50 loops in total' },
    otuzluk: { ad: 'Thirty Club', kosul: '30+ reaction in one move' },
    senlik: { ad: 'FESTIVAL!', kosul: '40 reactions in one move' },
    ucuncuKusak: { ad: 'Third Generation', kosul: '3rd-generation blast in one move' },
    buyukFinal: { ad: 'Grand Finale', kosul: 'Star + Star combo' },
    roketYagmuru: { ad: 'Rocket Rain', kosul: 'Star + Rocket combo' },
    kilpayi: { ad: 'Close Call', kosul: 'Win on the last move' },
    tutumlu: { ad: 'Thrifty', kosul: 'Win with 10+ moves left' },
    ustaCirak: { ad: 'Top Apprentice', kosul: '3★ on every level of a district' },
    saheser: { ad: 'Masterpiece', kosul: 'Your first Masterpiece painting' },
    defterci: { ad: 'Collector', kosul: 'Complete 12 patterns' },
    nobetci: { ad: 'Night Watch', kosul: 'Lantern Watch 7' },
    denizFeneri: { ad: 'Lighthouse', kosul: 'Lantern Watch 30' },
    korukcu: { ad: 'Bellows Pro', kosul: '10+ reactions with the Bellows' },
    domino: { ad: 'Domino', kosul: 'Fire 3 giant fireworks with a powder trail' },
  },
);

export const ROZET_SIRASI: readonly RozetId[] = [
  'ilkKivilcim', 'caprazNisanci', 'sarVePisir', 'halkaci', 'otuzluk', 'senlik',
  'ucuncuKusak', 'buyukFinal', 'roketYagmuru', 'kilpayi', 'tutumlu', 'ustaCirak',
  'saheser', 'defterci', 'nobetci', 'denizFeneri', 'korukcu', 'domino',
];

/**
 * Fener Koyu Defteri kültür kartları (§10.1): mahalle başına en fazla 4
 * cümle. Son cümleler oyunun dünyasına (Fener Koyu) aittir.
 */
export const DEFTER_KARTLARI: readonly { baslik: string; metin: string }[] = t(
  [
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
  ],
  [
    {
      baslik: 'Lantern processions',
      metin:
        'A lantern procession is a crowd walking from street to street with lanterns on festival evenings. Many Turkish towns still hold one on Republic Day. Children make their paper lanterns days ahead. In Lantern Cove, the procession ends at the tip of the pier, with lanterns set afloat on the sea.',
    },
    {
      baslik: 'Mahya',
      metin:
        'A mahya is a message written in oil lamps strung on ropes between two minarets. It is hung at Istanbul’s mosques during Ramadan and is big enough to read from far away. Masters string the words on the ground, then pull them up with pulleys. There is no other art like it in the world.',
    },
    {
      baslik: 'Boat lanterns',
      metin:
        'Boats going out to fish at night hung lamps on their bows; the light drew the fish to the surface. From the shore, the lamps looked like stars floating on the sea. Lined up in rows, they lit the cove like a street. Lantern Cove’s fishermen still hang a lantern on every boat.',
    },
    {
      baslik: 'Clock towers',
      metin:
        'In the last century of the Ottoman Empire, many clock towers were built in Anatolian towns. A tower was a meeting place where everyone shared the same time. Its bell told the town when the bazaar opened and closed. On festival night in Lantern Cove, the clock face is ringed with lamps.',
    },
    {
      baslik: 'Hıdırellez',
      metin:
        'Hıdırellez is an old festival on May 6 that celebrates the coming of spring. Fires are lit the night before, and people jump over them to make a wish. Wishes are written on paper and tied to a branch of a rose tree. In the morning, everyone gathers under the tree to greet spring together.',
    },
    {
      baslik: 'Nevruz fires',
      metin:
        'Nevruz welcomes spring on March 21, when night and day are equal. Big fires are lit on the hills, and young people leap over the flames. Eggs are painted, iron is hammered and people wish for plenty. The firelight is a wish for a bright new year.',
    },
    {
      baslik: 'Powder works',
      metin:
        'Ottoman gunpowder was made in powder works near Istanbul and in other cities. Saltpeter, sulfur and charcoal were pounded together in big mortars. Copper and wooden tools were used so that no spark would fly. The powder for festival fireworks also passed through these masters’ hands.',
    },
    {
      baslik: 'Donanma festivals',
      metin:
        'In Ottoman times, “donanma” was the name of a great festival that decked the city out in lamps and fireworks. Births and victories were celebrated with donanmas that lasted for days. Firework shows were held on rafts in the Golden Horn, and towers were ringed with light. Books called Surname tell of these festivals in pictures.',
    },
  ],
);

/** (Kancalar §B.5) Kasaba kartları: mahallenin 6 işi bitince sakinin mektubu (mahalle sırasıyla). */
export const KASABA_KARTLARI: readonly { baslik: string; metin: string }[] = t(
  [
    { baslik: 'Kayıkçı Rıza\'nın mektubu', metin: 'Çırak, iskele yeniden ışıl ışıl. Kayıklar artık gece de yolunu buluyor, çocuklar fenerlerin altında oyun kuruyor. Deniz fenerinin döndüğünü gören balıkçılar sabaha kadar türkü söyledi. Babamın feneri sana emanet.' },
    { baslik: 'Kandilci Nazlı\'nın mektubu', metin: 'Dükkânların kapısında kandiller yandığından beri çarşı gece de kapanmıyor. Mahyadaki ŞENLİK yazısını ta tepeden okuyorlarmış. Kandillerin mırıldandığı ezgiyi sen de duydun mu? Bu ışıklar senin elinden.' },
    { baslik: 'Kaptan Yakup\'un mektubu', metin: 'Gemim donandı, vinç bile bayramlık giydi. Mendirekteki fenerler yanınca uzak limanlardan selam geldi. Tayfalar "Fener Koyu yeniden uyandı" diyor. Bir gün seni de denize çıkarırım, çırak.' },
    { baslik: 'Saatçi Hüsnü Usta\'nın mektubu', metin: 'Kadran yeniden aydınlandı, akrep yerine oturdu. Şenlik çanı çaldığında meydandaki herkes saatini düzeltti. Kulenin her kandili bir saniye kadar değerli. Tam zamanında geldin, çırak.' },
    { baslik: 'Bahçıvan Gülizar\'ın mektubu', metin: 'Dut ağacındaki kurdeleler rüzgârda dilekleri fısıldıyor. Havuzdaki kandiller sabaha kadar süzüldü, ateş böcekleri de onlara eşlik etti. Hıdırellez ateşinin üstünden bütün mahalle atladı. Senin dileğin de kabul olsun.' },
    { baslik: 'Gökbilimci Ayşe\'nin mektubu', metin: 'Rasathanenin kubbesinden gök iki kat parlak görünüyor. Değirmenin ışıklı kanatları yıldızlarla dans ediyor. Gök haritasına senin adını da ekledim: küçük ama parlak bir yıldız. Nevruz ateşi bu yıl en güzel burada yandı.' },
    { baslik: 'Barutçu Kemal\'in mektubu', metin: 'Bacalardan artık duman değil altın kıvılcım yükseliyor. Depo kapısındaki fenerler, sabrın ışıkla ödüllendiğini hatırlatıyor. Şenlik düdüğü öttüğünde bütün işçiler gökyüzüne baktı. Barut sabır ister; sen sabrettin.' },
    { baslik: 'Sur Bekçisi Murat\'ın mektubu', metin: 'Surlar yüz yıl sonra yeniden donandı. Burçtaki büyük ateşi uzak köylerden bile görmüşler. Bekçiliğimde ilk kez bütün gece hiç karanlık görmedim. Kıvılcım Usta\'nın sözü yerine geldi, çırak: koy yeniden yandı.' },
  ],
  [
    { baslik: 'From Rıza the Boatman', metin: 'Apprentice, the pier is all aglow again. The boats find their way even at night, and children play under the lanterns. The fishermen who saw the lighthouse turn sang folk songs until morning. I leave my father’s lighthouse in your hands.' },
    { baslik: 'From Nazlı the Lamplighter', metin: 'Since the lamps were lit at the shop doors, the bazaar stays open all night. They say you can read the FIESTA sign on the mahya from the hilltop. Did you hear the tune the lamps were humming too? These lights came from your hands.' },
    { baslik: 'From Captain Yakup', metin: 'My ship is dressed up, even the crane is in its festival best. When the lanterns on the breakwater lit up, greetings came from faraway harbors. The crew say "Lantern Cove is awake again." One day I’ll take you out to sea too, apprentice.' },
    { baslik: 'From Hüsnü the Clockmaker', metin: 'The clock face is lit again and the hour hand is back in place. When the festival bell rang, everyone in the square set their watches. Every lamp on the tower is worth a second. You came right on time, apprentice.' },
    { baslik: 'From Gülizar the Gardener', metin: 'The ribbons on the mulberry tree whisper wishes in the wind. The lamps on the pool drifted until morning, with fireflies for company. The whole district jumped over the Hıdırellez fire. May your wish come true too.' },
    { baslik: 'From Ayşe the Astronomer', metin: 'From the observatory dome, the sky looks twice as bright. The lit sails of the windmill dance with the stars. I added your name to the star map too: a small but bright star. This year the Nevruz fire burned brightest here.' },
    { baslik: 'From Kemal the Powder Maker', metin: 'Golden sparks rise from the chimneys now, not smoke. The lanterns at the depot door remind us that patience is rewarded with light. When the festival whistle blew, every worker looked up at the sky. Powder takes patience, and you were patient.' },
    { baslik: 'From Murat the Wall Guard', metin: 'The walls are dressed in lights again after a hundred years. They saw the great fire on the tower even from faraway villages. For the first time in all my years on watch, I saw no darkness all night. Master Spark kept his word, apprentice: the cove is alight again.' },
  ],
);

/** Günlük görev şablonları (§10.5). {n}: sayı, {renk}: renk adı. */
export const GOREV_SABLONLARI: readonly string[] = t(
  [
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
  ],
  [
    'Draw 2 loops',
    'Make a 15+ reaction in one move',
    'Pop 50 {renk} capsules',
    'Fire 3 rockets',
    'Fire 1 chrysanthemum',
    'Make a combo',
    'Break 5 cages',
    'Light 20 tiles',
    'Win 3 levels',
    'Finish a level with 3★',
    'Draw a chain of 12+',
    'Use the Bellows twice',
    'Hit 2 obstacles with a diagonal rocket',
    'Break 10 rocks',
    'Bring down 2 lanterns',
    'Fire 5+ rockets in the finale',
    'Win the Daily Festival',
    'Make a 2nd-generation pop',
    'Pop 30 capsules with heat',
    'Win a level on the first try',
  ],
);

/** Görev şablonunu doldurur (sablon 1 tabanlı). */
export function gorevMetni(sablon: number, renk = 3): string {
  const s = GOREV_SABLONLARI[sablon - 1] ?? '';
  return s.replace('{renk}', RENK_ADLARI[renk] ?? t('gök', 'sky'));
}

const sayiBicimi = new Intl.NumberFormat(YEREL, { maximumFractionDigits: 0 });

/** 12450 → "12.450" (İngilizcede "12,450") */
export function sayi(n: number): string {
  return sayiBicimi.format(Math.round(n));
}

/** 0,92 → "%92" (İngilizcede "92%") */
export function yuzde(o: number): string {
  const n = Math.max(0, Math.min(100, Math.floor(o * 100 + 1e-9)));
  return t(`%${n}`, `${n}%`);
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AYLAR_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 20261014 → "14.10.2026" (İngilizcede "Oct 14, 2026": gün/ay sırası karışmasın) */
export function tarihKisa(tarih: number): string {
  const y = Math.floor(tarih / 10000);
  const a = Math.floor(tarih / 100) % 100;
  const g = tarih % 100;
  return t(`${String(g).padStart(2, '0')}.${String(a).padStart(2, '0')}.${y}`, `${(AYLAR_EN[a - 1] ?? '').slice(0, 3)} ${g}, ${y}`);
}

/** 20261014 → "14 Ekim 2026" (İngilizcede "October 14, 2026") */
export function tarihUzun(tarih: number): string {
  const y = Math.floor(tarih / 10000);
  const a = Math.floor(tarih / 100) % 100;
  const g = tarih % 100;
  return t(`${g} ${AYLAR[a - 1] ?? ''} ${y}`, `${AYLAR_EN[a - 1] ?? ''} ${g}, ${y}`);
}

/** Bölüm başlığı: 12 → "Bölüm 12", 103 → "Usta 3", 20261014 → "Günün Şenliği". */
export function bolumBasligi(id: number, tur?: BolumTuru): string {
  if (tur === 'gunluk' || id > 1_000_000) return id > 19_000_000 && id < 30_000_000 ? M.gununSenligi : `${t('Sonsuz', 'Endless')} ${id - 1_000_000}`;
  if (tur === 'usta' || (id > 100 && id < 200)) return `${M.usta} ${id - 100}`;
  return `${M.bolum} ${id}`;
}

/** Eşik varsayılan (4) değilse bilgi satırı (§14.3). */
export function esikBilgisi(esik: number): string | null {
  if (esik === 4) return null;
  if (esik <= 2) return t(`Kuru Barut: barut ${esik} ısıda tutuşur`, `Dry Powder: powder ignites at ${esik} heat`);
  if (esik === 3) return t('Kuru Gece: barut 3 ısıda tutuşur', 'Dry Night: powder ignites at 3 heat');
  return t(`Nemli Gece: barut ${esik} ısıda tutuşur`, `Damp Night: powder ignites at ${esik} heat`);
}

/** Hedefin kalanı (HUD sayacı). */
export function hedefKalan(h: HedefVM): number {
  return Math.max(0, h.gerekli - h.ilerleme);
}

/** İngilizce hedef adları: tekil ve çoğul (renk adları ve "soot" değişmez). */
const HEDEF_EN: Record<Exclude<HedefVM['tur'], 'topla'>, [string, string]> = {
  kafes: ['cage', 'cages'],
  kaya: ['rock', 'rocks'],
  fener: ['lantern', 'lanterns'],
  aydinlat: ['tile', 'tiles'],
  desen: ['pattern tile', 'pattern tiles'],
  devFisek: ['giant firework', 'giant fireworks'],
  is: ['soot', 'soot'],
  zincirleme: ['chain reaction', 'chain reactions'],
  halka: ['loop', 'loops'],
  puan: ['point', 'points'],
};

/** İngilizce hedef adı, sayıya göre tekil/çoğul ("3 cages", "1 cage", "12 red"). */
function hedefAdiEn(h: HedefVM, n: number): string {
  if (h.tur === 'topla') return h.renk === 'hepsi' || h.renk === undefined ? cogul(n, 'capsule', 'capsules') : (RENK_ADLARI[h.renk] ?? 'capsule');
  const [tek, cok] = HEDEF_EN[h.tur];
  return cogul(n, tek, cok);
}

/** Kısa hedef adı (sayısız): "kızıl", "kafes", "döşeme"… */
export function hedefAdi(h: HedefVM): string {
  if (EN) return hedefAdiEn(h, 1);
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

/** İngilizce bölüm öncesi hedef metni. */
function hedefMetniEn(h: HedefVM): string {
  const n = h.gerekli;
  switch (h.tur) {
    case 'kafes':
      return 'Break all cages';
    case 'kaya':
      return 'Break all rocks';
    case 'aydinlat':
      return 'Light all tiles';
    case 'is':
      return 'Clear all soot';
    case 'desen':
      return h.motif ? `Paint the ${MOTIF_ADLARI[h.motif]} pattern` : 'Paint the Light Pattern';
    case 'zincirleme':
      return `${h.esik ?? 15}+ reactions, ${n} ${cogul(n, 'time', 'times')}`;
    case 'puan':
      return `${sayi(n)} points`;
    case 'fener':
      return `Bring down ${n} ${hedefAdiEn(h, n)}`;
    case 'devFisek':
      return `Fire ${n} ${hedefAdiEn(h, n)}`;
    case 'halka':
      return `Draw ${n} ${hedefAdiEn(h, n)}`;
    case 'topla':
      return `${n} ${hedefAdiEn(h, n)}`;
  }
}

/** Bölüm öncesi kartında hedef: "25 kapsül", "Bütün kafesler", "3 kez 15+ reaksiyon". */
export function hedefMetni(h: HedefVM): string {
  if (EN) return hedefMetniEn(h);
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

/** Kayıp ekranı: "3 kızıl kaldı" (§6, §14.7); İngilizcede "3 red left". */
export function kalanMetni(h: HedefVM): string {
  const k = hedefKalan(h);
  if (EN) return `${sayi(k)} ${hedefAdiEn(h, k)} left`;
  if (h.tur === 'puan') return `${sayi(k)} puan kaldı`;
  return `${k} ${hedefAdi(h)} kaldı`;
}

/** Erişilebilirlik etiketi: "Kızıl: 12 kaldı" / "Kafes: tamam" (İngilizcede "Red: 12 left" / "Cage: done"). */
export function hedefEtiketi(h: HedefVM): string {
  const ad = hedefAdi(h);
  const bas = buyukHarf(ad.charAt(0)) + ad.slice(1);
  return h.tamam ? `${bas}: ${t('tamam', 'done')}` : `${bas}: ${t(`${sayi(hedefKalan(h))} kaldı`, `${sayi(hedefKalan(h))} left`)}`;
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
