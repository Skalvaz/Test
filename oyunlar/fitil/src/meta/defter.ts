/**
 * Fişek Defteri (GDD §10.3, §14.10): desenler, fitiller, gökyüzü temaları,
 * Gece Tabloları, Işık Deseni motifleri, kartlar ve kıvılcım tozu.
 *
 * Kararlar:
 *  - Kasımpatı baştan açıktır (takılabilir) ama 2/3 parçayla başlar; 3.
 *    parça 5. bölümün garanti sandığından gelir. Böylece "baştan açık" ve
 *    "5. bölümün ilk sandığı garanti Kasımpatı parçası" (§10.4) birlikte
 *    anlam kazanır: Defter bir tamamlama anıyla tanıtılır.
 *  - En az 1 desen takılı kalır (gökyüzü boş kalmasın).
 *  - Toz yalnız sahip olunmayan parçaya harcanır; "Deniz Feneri" fitili
 *    tozla alınamaz (yalnız Fener Nöbeti 30).
 *  - Kartlar: `defter:<mahalle>` mahalle tamamlanınca (kültür notu, §10.1),
 *    `efsane:<mahalle>` mahallenin 5 bölümü de 3★ olunca (Fener Koyu
 *    efsanesi). §10.3 "Efsane kartları: mahalle başına 1" böyle yorumlandı.
 */
import { DESEN_PARCA, DESENLER, EN_FAZLA_TAKILI_DESEN, FITILLER, GOKYUZU, MAHALLELER } from '../app/katalog';
import type { DesenId, FitilId, GokyuzuId } from '../app/katalog';
import type { Motif } from '../core/types';
import { desenAcik, desenTamam, fitilAcik, fitilTamam, gokyuzuAcik, kayitKopyala, parcaCoz, parcaId } from './kayit';
import type { KartId, Kayit, Nadirlik, ParcaId } from './kayit';
import { parcaVer } from './sandik';
import type { SandikCekilisi } from './sandik';
import { TOZ_PARCA_BEDELI } from './sabitler';

// ─────────────────────────── Görünüm verisi ───────────────────────────

export interface DesenDurumu {
  id: DesenId;
  ad: string;
  /** Parça sahipliği [0, 1, 2]. */
  parcalar: boolean[];
  tamam: boolean;
  acik: boolean;
  takili: boolean;
  baslangicta: boolean;
}

export function desenDurumlari(k: Kayit): DesenDurumu[] {
  const sahip = new Set(k.koleksiyon.parcalar);
  return DESENLER.map((d) => ({
    id: d.id,
    ad: d.ad,
    parcalar: Array.from({ length: DESEN_PARCA }, (_, i) => sahip.has(parcaId('desen', d.id, i))),
    tamam: desenTamam(k, d.id),
    acik: desenAcik(k, d.id),
    takili: k.koleksiyon.takili.includes(d.id),
    baslangicta: d.baslangicta,
  }));
}

export interface FitilDurumu {
  id: FitilId;
  ad: string;
  parcalar: boolean[];
  tamam: boolean;
  acik: boolean;
  secili: boolean;
  /** Sandıktan ve tozla elde edilebilir mi. */
  sandiktan: boolean;
}

export function fitilDurumlari(k: Kayit): FitilDurumu[] {
  const sahip = new Set(k.koleksiyon.parcalar);
  return FITILLER.map((f) => ({
    id: f.id,
    ad: f.ad,
    parcalar: [0, 1, 2].map((i) => f.baslangicta || sahip.has(parcaId('fitil', f.id, i))),
    tamam: f.baslangicta || fitilTamam(k, f.id),
    acik: fitilAcik(k, f.id),
    secili: k.koleksiyon.fitil === f.id,
    sandiktan: f.sandiktan,
  }));
}

export interface GokyuzuDurumu {
  id: GokyuzuId;
  ad: string;
  ust: string;
  alt: string;
  acik: boolean;
  /** Koleksiyona girdi mi (mahalle tamamlandı). Ay Işığı açık olsa da girmemiş olabilir. */
  kazanildi: boolean;
  secili: boolean;
  /** Teması gelen mahalle (0 tabanlı). */
  mahalle: number;
}

export function gokyuzuDurumlari(k: Kayit): GokyuzuDurumu[] {
  return MAHALLELER.map((m, i) => {
    const g = GOKYUZU[m.gokyuzu];
    return {
      id: m.gokyuzu,
      ad: g.ad,
      ust: g.ust,
      alt: g.alt,
      acik: gokyuzuAcik(k, m.gokyuzu),
      kazanildi: k.koleksiyon.gokyuzuler.includes(m.gokyuzu),
      secili: k.koleksiyon.gokyuzu === m.gokyuzu,
      mahalle: i,
    };
  });
}

/** Işık Deseni motifleri ve geldikleri yer (§10.3). `mart` ve `burc` Usta Bölümü motifleridir. */
export const MOTIFLER: readonly { id: Motif; ad: string; kaynak: string }[] = [
  { id: 'lale', ad: 'Lale', kaynak: '26. bölüm' },
  { id: 'kayik', ad: 'Kayık', kaynak: '30. bölüm' },
  { id: 'fener', ad: 'Fener', kaynak: '38. bölüm' },
  { id: 'carkifelek', ad: 'Çarkıfelek', kaynak: '40. bölüm' },
  { id: 'mart', ad: 'Martı', kaynak: 'Usta Bölümü' },
  { id: 'burc', ad: 'Burç', kaynak: 'Usta Bölümü' },
];

export function motifDurumlari(k: Kayit): { id: Motif; ad: string; kaynak: string; asili: boolean }[] {
  return MOTIFLER.map((m) => ({ ...m, asili: k.koleksiyon.motifler.includes(m.id) }));
}

export interface KartTanimi {
  id: KartId;
  /** `kasaba`: mahallenin 6 kasaba işi bitince sakinin mektubu (KANCALAR §B.5). */
  tur: 'defter' | 'efsane' | 'kasaba';
  mahalle: number;
  baslik: string;
  /** En fazla 4 cümle (§10.1). */
  metin: string;
}

/**
 * Fener Koyu Defteri kültür kartları (gerçek gelenekler) ve Fener Koyu
 * efsaneleri (oyun dünyasına ait kurgu). Sıra mahalle sırasıdır.
 */
export const KARTLAR: readonly KartTanimi[] = [
  {
    id: 'defter:iskele',
    tur: 'defter',
    mahalle: 0,
    baslik: 'Fener alayı geleneği',
    metin:
      'Fener alayı, bayram ve şenlik akşamlarında ellerde kâğıt fenerlerle yapılan neşeli bir yürüyüştür. Türkiye\'de en çok Cumhuriyet Bayramı akşamı, davul zurna eşliğinde sokakları dolaşır. Her fenerin içinde küçük bir ışık yanar; alay uzadıkça sokak bir ışık ırmağına döner. Fener Koyu\'nun alayı her yıl iskeleden başlar.',
  },
  {
    id: 'defter:carsi',
    tur: 'defter',
    mahalle: 1,
    baslik: 'Mahya',
    metin:
      'Mahya, iki minare arasına gerilen iplere dizilen ışıklarla gökyüzüne yazı ya da resim çizme sanatıdır. Ramazan gecelerinde kurulur; uzaktan okunan yazılar şehre selam verir. Bu gelenek yalnız Türkiye\'de yaşar ve yüzyıllardır sürer. Eskiden kandillerle yapılırdı, bugün ampuller kullanılıyor.',
  },
  {
    id: 'defter:liman',
    tur: 'defter',
    mahalle: 2,
    baslik: 'Liman gecelerinde kayık fenerleri',
    metin:
      'Kayıkçılar gece denize açılırken teknenin başına fener asardı; hem yollarını görür hem de yerlerini birbirlerine bildirirlerdi. Bazı balıkçılar ışığa toplanan balıkları yakalamak için kayığa güçlü lambalar asar; buna lambalı avcılık denir. Uzaktan bakınca koy, denize dökülmüş yıldızlara benzer.',
  },
  {
    id: 'defter:saatKulesi',
    tur: 'defter',
    mahalle: 3,
    baslik: 'Kasaba saat kulelerinin hikâyesi',
    metin:
      'Osmanlı kasabalarında saat kuleleri 19. yüzyılın sonunda yaygınlaştı; birçoğu II. Abdülhamid\'in tahttaki 25. yılı anısına yaptırıldı. Kuleler kasabaya ortak bir zaman verdi: çarşının açılışı, okulun zili, trenin kalkışı ona göre ayarlandı. İzmir\'in Konak meydanındaki saat kulesi bunların en tanınmışlarındandır.',
  },
  {
    id: 'defter:bahceler',
    tur: 'defter',
    mahalle: 4,
    baslik: 'Hıdırellez ateşi ve dilek ağaçları',
    metin:
      'Hıdırellez, baharın ve bereketin gelişini kutlayan 6 Mayıs şenliğidir; Hızır ile İlyas\'ın o gün yeryüzünde buluştuğuna inanılır. 5 Mayıs gecesi ateş yakılır, gençler üzerinden atlar. Dilekler kâğıda yazılıp ya da çizilip gül dallarına bağlanır. Bu bahar kutlaması UNESCO\'nun somut olmayan kültürel miras listesindedir.',
  },
  {
    id: 'defter:tepe',
    tur: 'defter',
    mahalle: 5,
    baslik: 'Nevruz ateşi',
    metin:
      'Nevruz, gece ile gündüzün eşitlendiği 21 Mart\'ta baharın başlangıcını kutlar. Anadolu\'da ve Orta Asya\'da ateş yakılır, üzerinden atlanarak kışın ağırlığı geride bırakılır. Bazı yerlerde demir örse vurularak Ergenekon\'dan çıkış canlandırılır. Nevruz, pek çok ülkenin ortak mirası olarak UNESCO listesindedir.',
  },
  {
    id: 'defter:fabrika',
    tur: 'defter',
    mahalle: 6,
    baslik: 'Osmanlı baruthaneleri',
    metin:
      'Osmanlı ordusunun barutu baruthanelerde üretilirdi; İstanbul\'daki Bakırköy ve Azadlı baruthaneleri bunların en bilinenleridir. Barut; güherçile, kükürt ve odun kömürünün sabırla ince ince karıştırılmasıyla yapılır. Kazalara karşı baruthaneler şehrin dışına, su kenarlarına kurulurdu. Şenlik gecelerini süsleyen fişeklerin barutu da aynı ustalıkla hazırlanırdı.',
  },
  {
    id: 'defter:kale',
    tur: 'defter',
    mahalle: 7,
    baslik: 'Donanma şenlikleri',
    metin:
      'Osmanlı\'da "donanma", şehrin kandiller, fenerler ve fişeklerle süslenmesi demekti. Bir zafer, bir doğum ya da bir düğün haberinde şenlik günlerce sürerdi. Pencerelere kandiller dizilir, kayıklar ışıklandırılır, gökyüzünde fişekler patlardı. Surname-i Hümayun minyatürleri bu gecelerin renkli bir kaydıdır.',
  },
  {
    id: 'efsane:iskele',
    tur: 'efsane',
    mahalle: 0,
    baslik: 'İlk Fener',
    metin:
      'Kıvılcım Usta çocukken bir fırtına gecesi babasının kayığı koya dönemez olmuş. Küçük Kıvılcım iskelenin ucunda elindeki tek mumu bir kâğıt fenere koymuş ve sabaha kadar sallamış. Kayık o ışığı izleyip eve dönmüş. Koyun adı o geceden kalmadır.',
  },
  {
    id: 'efsane:carsi',
    tur: 'efsane',
    mahalle: 1,
    baslik: 'Kandilci Nazlı',
    metin:
      'Çarşının en eski dükkânında Nazlı adında bir kandilci yaşarmış. Söylenene göre her kandile bir ezgi fısıldar, kandiller de yanarken o ezgiyi mırıldanırmış. Şenlik gecesi bütün kandiller aynı anda yandığında çarşıdan bir şarkı yükselirmiş. Fitilin her düğümde bir nota yükselmesi ondan kalmadır.',
  },
  {
    id: 'efsane:liman',
    tur: 'efsane',
    mahalle: 2,
    baslik: 'Işıklı Gemi',
    metin:
      'Her şenlik sabahı ufukta, direklerinden fişek ışıkları sarkan bir gemi görünürmüş. Kimse ona yetişememiş, ama gördüğü gece fişeği tutuşmayan usta yokmuş. Liman bekçileri, geminin Fener Koyu\'nun sönmüş ışıklarını topladığını anlatır. Usta emekli olduğu yıl gemi bir daha görünmemiş.',
  },
  {
    id: 'efsane:saatKulesi',
    tur: 'efsane',
    mahalle: 3,
    baslik: 'Durmayan Saat',
    metin:
      'Saat kulesinin kadranı yüz yıl boyunca bir kez bile durmamış. Rivayete göre saatçi, kuleye her şenlikten bir kıvılcım saklarmış; saat o kıvılcımlarla kurulurmuş. Şenlik sönünce saat geri kalmaya başlamış. Her yeni gösteriden sonra akrebin biraz daha doğrulduğu söylenir.',
  },
  {
    id: 'efsane:bahceler',
    tur: 'efsane',
    mahalle: 4,
    baslik: 'Ateş Böceklerinin Bahçesi',
    metin:
      'Bahçelerdeki yaşlı dut ağacının dallarına asılan dilekler, gece ateş böceğine dönüşürmüş. Bir dilek gerçek olunca böcek gökyüzüne yükselip küçük bir fişek gibi patlarmış. Bahçıvanlar Hıdırellez sabahı çimenlerde altın tozları bulurmuş. Kıvılcım Usta ilk barutunu o tozdan yaptığını söyler.',
  },
  {
    id: 'efsane:tepe',
    tur: 'efsane',
    mahalle: 5,
    baslik: 'Yıldız Toplayıcı',
    metin:
      'Tepedeki rasathanede yaşlı bir gökbilimci, düşen yıldızları bir cam kavanozda toplarmış. Her Nevruz gecesi kavanozun kapağını açar, yıldızlar yeniden göğe dağılırmış. Bir yıl kavanoz kırılmış ve yıldızlar kapsüllere saklanmış. Kapsüllerin içinde yanan ışığın oradan geldiğine inanılır.',
  },
  {
    id: 'efsane:fabrika',
    tur: 'efsane',
    mahalle: 6,
    baslik: 'Sabırlı Usta',
    metin:
      'Baruthanede çalışan Selim Usta, barutu her gün aynı türküyü söyleyerek karıştırırmış. Bir gün acele eden bir çırak türküyü yarıda kesmiş ve bütün depo tek bir kıvılcımla göğe yükselmiş. Selim Usta o gece gökyüzünde kendi türküsünün notalarını görmüş. O günden beri ustalar "Barut sabır ister" der.',
  },
  {
    id: 'efsane:kale',
    tur: 'efsane',
    mahalle: 7,
    baslik: 'Kıvılcım Usta\'nın Sözü',
    metin:
      'Kıvılcım Usta son gösterisinden sonra kale burcuna çıkıp bir söz vermiş: "Bir çırak bu koyu yeniden tutuşturursa, ben de bir kez daha bakacağım." O gece surlarda tek bir kıvılcım yanık kalmış. Şimdi her büyük şenlikte burçta küçük bir ışık göz kırpar. Kimileri onun ustanın gözü olduğunu söyler.',
  },
  // Kasaba kartları: mahallenin 6 işi bitince sakinin mektubu (KANCALAR §B.5).
  {
    id: 'kasaba:iskele',
    tur: 'kasaba',
    mahalle: 0,
    baslik: 'Kayıkçı Rıza\'nın mektubu',
    metin:
      'Çırak, iskele yeniden ışıl ışıl. Kayıklar artık gece de yolunu buluyor, çocuklar fenerlerin altında oyun kuruyor. Deniz fenerinin döndüğünü gören balıkçılar sabaha kadar türkü söyledi. Babamın feneri sana emanet.',
  },
  {
    id: 'kasaba:carsi',
    tur: 'kasaba',
    mahalle: 1,
    baslik: 'Kandilci Nazlı\'nın mektubu',
    metin:
      'Dükkânların kapısında kandiller yandığından beri çarşı gece de kapanmıyor. Mahyadaki ŞENLİK yazısını ta tepeden okuyorlarmış. Kandillerin mırıldandığı ezgiyi sen de duydun mu? Bu ışıklar senin elinden.',
  },
  {
    id: 'kasaba:liman',
    tur: 'kasaba',
    mahalle: 2,
    baslik: 'Kaptan Yakup\'un mektubu',
    metin:
      'Gemim donandı, vinç bile bayramlık giydi. Mendirekteki fenerler yanınca uzak limanlardan selam geldi. Tayfalar "Fener Koyu yeniden uyandı" diyor. Bir gün seni de denize çıkarırım, çırak.',
  },
  {
    id: 'kasaba:saatKulesi',
    tur: 'kasaba',
    mahalle: 3,
    baslik: 'Saatçi Hüsnü Usta\'nın mektubu',
    metin:
      'Kadran yeniden aydınlandı, akrep yerine oturdu. Şenlik çanı çaldığında meydandaki herkes saatini düzeltti. Kulenin her kandili bir saniye kadar değerli. Tam zamanında geldin, çırak.',
  },
  {
    id: 'kasaba:bahceler',
    tur: 'kasaba',
    mahalle: 4,
    baslik: 'Bahçıvan Gülizar\'ın mektubu',
    metin:
      'Dut ağacındaki kurdeleler rüzgârda dilekleri fısıldıyor. Havuzdaki kandiller sabaha kadar süzüldü, ateş böcekleri de onlara eşlik etti. Hıdırellez ateşinin üstünden bütün mahalle atladı. Senin dileğin de kabul olsun.',
  },
  {
    id: 'kasaba:tepe',
    tur: 'kasaba',
    mahalle: 5,
    baslik: 'Gökbilimci Ayşe\'nin mektubu',
    metin:
      'Rasathanenin kubbesinden gök iki kat parlak görünüyor. Değirmenin ışıklı kanatları yıldızlarla dans ediyor. Gök haritasına senin adını da ekledim: küçük ama parlak bir yıldız. Nevruz ateşi bu yıl en güzel burada yandı.',
  },
  {
    id: 'kasaba:fabrika',
    tur: 'kasaba',
    mahalle: 6,
    baslik: 'Barutçu Kemal\'in mektubu',
    metin:
      'Bacalardan artık duman değil altın kıvılcım yükseliyor. Depo kapısındaki fenerler, sabrın ışıkla ödüllendiğini hatırlatıyor. Şenlik düdüğü öttüğünde bütün işçiler gökyüzüne baktı. Barut sabır ister; sen sabrettin.',
  },
  {
    id: 'kasaba:kale',
    tur: 'kasaba',
    mahalle: 7,
    baslik: 'Sur Bekçisi Murat\'ın mektubu',
    metin:
      'Surlar yüz yıl sonra yeniden donandı. Burçtaki büyük ateşi uzak köylerden bile görmüşler. Bekçiliğimde ilk kez bütün gece hiç karanlık görmedim. Kıvılcım Usta\'nın sözü yerine geldi, çırak: koy yeniden yandı.',
  },
];

export interface KartDurumu extends KartTanimi {
  acik: boolean;
}

export function kartDurumlari(k: Kayit): KartDurumu[] {
  return KARTLAR.map((c) => ({ ...c, acik: k.koleksiyon.kartlar.includes(c.id) }));
}

export interface TabloOgesi {
  bolumId: number;
  kod: string;
  nadirlik: Nadirlik;
}

/** Galeri: tablosu olan bölümler (kimliğe göre sıralı). */
export function tabloListesi(k: Kayit): TabloOgesi[] {
  return Object.entries(k.bolumler)
    .filter(([, b]) => !!b.tablo)
    .map(([id, b]) => ({ bolumId: Number(id), kod: b.tablo!, nadirlik: (b.nadirlik ?? 0) as Nadirlik }))
    .sort((a, b) => a.bolumId - b.bolumId);
}

export interface DefterOzeti {
  desen: { tamam: number; toplam: number; parca: number; parcaToplam: number };
  fitil: { acik: number; toplam: number };
  gokyuzu: { kazanildi: number; toplam: number };
  tablo: { sayi: number; parlak: number; saheser: number };
  motif: { asili: number; toplam: number };
  kart: { acik: number; toplam: number };
  toz: number;
  /** Tozla alınabilecek parça sayısı (toz/10). */
  tozParca: number;
}

export function defterOzeti(k: Kayit): DefterOzeti {
  const d = desenDurumlari(k);
  const tablolar = tabloListesi(k);
  return {
    desen: { tamam: d.filter((x) => x.tamam).length, toplam: d.length, parca: d.reduce((s, x) => s + x.parcalar.filter(Boolean).length, 0), parcaToplam: d.length * DESEN_PARCA },
    fitil: { acik: FITILLER.filter((f) => fitilAcik(k, f.id)).length, toplam: FITILLER.length },
    gokyuzu: { kazanildi: k.koleksiyon.gokyuzuler.length, toplam: MAHALLELER.length },
    tablo: { sayi: tablolar.length, parlak: tablolar.filter((t) => t.nadirlik === 1).length, saheser: tablolar.filter((t) => t.nadirlik === 2).length },
    motif: { asili: k.koleksiyon.motifler.length, toplam: MOTIFLER.length },
    kart: { acik: k.koleksiyon.kartlar.length, toplam: KARTLAR.length },
    toz: k.toz,
    tozParca: Math.floor(k.toz / TOZ_PARCA_BEDELI),
  };
}

/** Koleksiyonla tamamlanan desen sayısı (baştan açık üçü sayılmaz; Defterci rozeti). */
export function toplananDesenSayisi(k: Kayit): number {
  return DESENLER.filter((d) => !d.baslangicta && desenTamam(k, d.id)).length;
}

// ─────────────────────────── Eylemler ───────────────────────────

export type DefterHatasi = 'kapali' | 'dolu' | 'sonDesen' | 'yetersizToz' | 'sahip' | 'gecersiz';

export type DefterSonucu = { tamam: true; kayit: Kayit } | { tamam: false; hata: DefterHatasi };

/** Deseni tak (≤ 6). */
export function desenTak(k: Kayit, id: DesenId): DefterSonucu {
  if (!desenAcik(k, id)) return { tamam: false, hata: 'kapali' };
  if (k.koleksiyon.takili.includes(id)) return { tamam: true, kayit: k };
  if (k.koleksiyon.takili.length >= EN_FAZLA_TAKILI_DESEN) return { tamam: false, hata: 'dolu' };
  const y = kayitKopyala(k);
  y.koleksiyon.takili.push(id);
  return { tamam: true, kayit: y };
}

/** Deseni çıkar (en az 1 kalır). */
export function desenCikar(k: Kayit, id: DesenId): DefterSonucu {
  if (!k.koleksiyon.takili.includes(id)) return { tamam: true, kayit: k };
  if (k.koleksiyon.takili.length <= 1) return { tamam: false, hata: 'sonDesen' };
  const y = kayitKopyala(k);
  y.koleksiyon.takili = y.koleksiyon.takili.filter((x) => x !== id);
  return { tamam: true, kayit: y };
}

/** Takılı listeyi toptan ayarla (1..6 açık desen, tekrar yok). */
export function takiliAyarla(k: Kayit, ids: readonly DesenId[]): DefterSonucu {
  const temiz = [...new Set(ids)];
  if (temiz.length === 0) return { tamam: false, hata: 'sonDesen' };
  if (temiz.length > EN_FAZLA_TAKILI_DESEN) return { tamam: false, hata: 'dolu' };
  if (temiz.some((d) => !DESENLER.some((x) => x.id === d))) return { tamam: false, hata: 'gecersiz' };
  if (temiz.some((d) => !desenAcik(k, d))) return { tamam: false, hata: 'kapali' };
  const y = kayitKopyala(k);
  y.koleksiyon.takili = temiz;
  return { tamam: true, kayit: y };
}

export function fitilSec(k: Kayit, id: FitilId): DefterSonucu {
  if (!FITILLER.some((f) => f.id === id)) return { tamam: false, hata: 'gecersiz' };
  if (!fitilAcik(k, id)) return { tamam: false, hata: 'kapali' };
  const y = kayitKopyala(k);
  y.koleksiyon.fitil = id;
  return { tamam: true, kayit: y };
}

export function gokyuzuSec(k: Kayit, id: GokyuzuId): DefterSonucu {
  if (!(id in GOKYUZU)) return { tamam: false, hata: 'gecersiz' };
  if (!gokyuzuAcik(k, id)) return { tamam: false, hata: 'kapali' };
  const y = kayitKopyala(k);
  y.koleksiyon.gokyuzu = id;
  return { tamam: true, kayit: y };
}

/** Tozla alınabilir mi: geçerli, sahip olunmayan, sandıktan çıkabilen parça. */
export function tozlaAlinabilir(k: Kayit, p: ParcaId): boolean {
  const c = parcaCoz(p);
  if (!c || k.koleksiyon.parcalar.includes(p)) return false;
  if (c.kategori === 'fitil') return !!FITILLER.find((f) => f.id === c.id)?.sandiktan;
  return true;
}

/** 10 toz = seçilen 1 parça (§10.4). */
export function tozlaParcaAl(k: Kayit, p: ParcaId): { tamam: true; kayit: Kayit; cekilis: SandikCekilisi } | { tamam: false; hata: DefterHatasi } {
  const c = parcaCoz(p);
  if (!c) return { tamam: false, hata: 'gecersiz' };
  if (k.koleksiyon.parcalar.includes(p)) return { tamam: false, hata: 'sahip' };
  if (!tozlaAlinabilir(k, p)) return { tamam: false, hata: 'gecersiz' };
  if (k.toz < TOZ_PARCA_BEDELI) return { tamam: false, hata: 'yetersizToz' };
  const y = kayitKopyala(k);
  y.toz -= TOZ_PARCA_BEDELI;
  const cekilis = parcaVer(y, p);
  return { tamam: true, kayit: y, cekilis };
}
