/**
 * Arayüz metinleri (GDD §12). Türkçe; balonlar ≤ 6 kelime, tek satır
 * (bölüm verisindeki `ipuclari` dışındaki sabit metinler burada).
 */
import type { HamleHatasi, KarisikRenk } from '../core/types';
import { RENK_TANIMLARI } from '../app/katalog';

export const M = {
  oyunAdi: 'Ebruli',
  slogan: 'Ham boyaları karıştır, aynı renkleri buluştur, kendi ebru tablonu kâğıda al.',
  altBaslik: 'Ebru atölyesi',
  dokun: 'Dokun ve başla',
  deneme: 'Deneme sürümü',

  // Harita
  galeri: 'Galeri',
  ayarlar: 'Ayarlar',
  nasil: 'Nasıl oynanır',
  devamiYakinda: 'Devamı yakında',
  devamiAlt: 'Kapadokya · Ege · Saray',
  kilitli: 'Kilitli',
  siradaki: 'Sıradaki',

  // Bölüm öncesi
  basla: 'Başla',
  oyna: 'Oyna',
  geri: 'Geri',
  hamle: 'hamle',
  enIyi: 'En iyi',
  yeni: 'Yeni',
  hedefler: 'Hedefler',

  // HUD
  duraklat: 'Duraklat',
  tarifler: 'Tarifler',

  // Duraklat
  duraklatildi: 'Duraklatıldı',
  devam: 'Devam',
  yenidenBasla: 'Yeniden başla',
  haritayaDon: 'Haritaya dön',

  // Kazandın
  kazandin: 'Tablo tamam!',
  galeriyeEklendi: 'Galeriye eklendi',
  ilkTablo: 'Bu tablo senin. Galerine eklendi.',
  buTablo: 'Bunu sakla',
  eskiTablo: 'Eskisini koru',
  tekrarOyna: 'Tekrar oyna',
  puan: 'puan',

  // Kaybettin
  azKaldi: 'Az kaldı!',
  hamleBitti: 'Hamleler bitti',
  tekrarDene: 'Tekrar dene',
  kazandirirdi: 'Bu hamle kazandırırdı',
  ustaEli: "Usta'nın Eli",
  ustaEliMetin: '+5 hamleyle devam et (en fazla 1 yıldız)',
  ustaEliDugme: 'Devam et',

  // Galeri
  ebruDefteri: 'Ebru Defteri',
  galeriBos: 'Bölüm kazandıkça tablolar buraya gelir.',
  kapat: 'Kapat',

  // Ayarlar
  efektSesi: 'Efekt sesi',
  muzik: 'Müzik',
  ortam: 'Ortam sesi',
  titresim: 'Titreşim',
  hareketiAzalt: 'Hareketi azalt',
  hiz: 'Hız',
  hizNormal: 'Normal',
  hizHizli: 'Hızlı',
  palet: 'Renkler',
  paletStandart: 'Standart',
  paletRenkKoru: 'Renk körü',
  motifler: 'Renk motifleri',
  tarifSeridi: 'Tarif şeridi',
  tarifHer: 'Her zaman',
  tarifIlk: 'İlk bölümlerde',
  ipuclari: 'İpuçları',
  sifirla: 'İlerlemeyi sıfırla',
  sifirlaEmin: 'Emin misin? Bütün yıldızlar ve tablolar silinir.',
  sifirlaEvet: 'Evet, sıfırla',
  sifirlaVazgec: 'Vazgeç',
  sifirlandi: 'İlerleme sıfırlandı.',
  hakkinda: 'Hakkında',
  hakkindaMetin:
    'Ebruli bir deneme sürümüdür: 20 bölüm, 2 atölye. Usta kurgusaldır, gerçek bir kişiyi temsil etmez. Bütün sesler ve tablolar kodla üretilir. Yazı tipleri: Cormorant Garamond ve Alegreya Sans (SIL Open Font License 1.1).',
  kayitBellek: 'Kayıt bu tarayıcıda tutulamıyor; sayfa kapanınca ilerleme kaybolur.',

  // Nasıl oynanır
  comert: 'Tekne cömerttir: her zaman hazır bir karışım vardır.',

  // Devamı yakında
  devamiBaslik: 'Devamı yakında',
  devamiMetin: 'Kapadokya, Ege ve Saray atölyeleri hazırlanıyor.',
  galeriyiAc: 'Galeriyi aç',

  // Oyun içi
  hamleKaldi: (n: number) => (n === 1 ? 'Son hamle!' : `${n} hamle kaldı`),
} as const;

/** Geçersiz bırakma balonu (öğretim ve ilk karşılaşma; GDD §12.1). */
export function hataMetni(h: HamleHatasi): string | null {
  switch (h) {
    case 'ayniRenk':
      return 'Aynı renk karışmaz.';
    case 'ortakBilesen':
      return 'Ortak rengi olanlar karışmaz.';
    case 'karisikKarisik':
      return 'İki karışık renk karışmaz.';
    case 'murekkepKapali':
      return 'Önce ham boyaları karıştır.';
    case 'yag':
      return 'Yağlı damla karışmaz.';
    default:
      return null;
  }
}

export const renkAdi = (r: number): string => RENK_TANIMLARI[r as KarisikRenk]?.ad ?? '';

/** Kaybettin: eksik hedef metni ("2 Mor eksikti"). */
export function eksikMetni(eksikler: { tur: string; renk?: number; kalan: number }[]): string {
  const p: string[] = [];
  for (const e of eksikler) {
    if (e.kalan <= 0) continue;
    if (e.tur === 'topla') p.push(`${e.kalan} ${renkAdi(e.renk ?? 0)}`);
    else if (e.tur === 'kagit') p.push(`${e.kalan} kâğıt`);
    else if (e.tur === 'desen') p.push(`${e.kalan} desen hücresi`);
    else if (e.tur === 'puan') p.push(`${e.kalan} puan`);
  }
  if (!p.length) return '';
  return `${p.join(' ve ')} eksikti`;
}

/** Atölye adıyla bölüm künyesi: "Üsküdar · 4 · Kâğıda Al". */
export function kunye(atolye: string, id: number, ad: string): string {
  return `${atolye} · ${id} · ${ad}`;
}

/** Bin ayraçlı sayı (1.250). */
export function sayi(n: number): string {
  const s = String(Math.max(0, Math.round(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Yeni öğe tanıtımları (bölüm öncesi kartı; GDD §12.2). */
export const YENI_OGE: Record<number, { ad: string; metin: string; ikon: 'karisim' | 'mavi' | 'tarak' | 'kagit' | 'girdap' | 'lale' | 'mermer' | 'desen' | 'murekkep' | 'yag' | 'kit' }> = {
  1: { ad: 'Karışım', metin: 'İki boyayı birbirine sürükle, yeni renk olsun.', ikon: 'karisim' },
  2: { ad: 'Mavi boya', metin: 'Üç ham boya, üç karışık renk.', ikon: 'mavi' },
  3: { ad: 'Tarak', metin: 'Dört damla bir arada: satırı ya da sütunu tarar.', ikon: 'tarak' },
  4: { ad: 'Kâğıt', metin: 'Kâğıdın üstünde eşleştir, boya kâğıda geçsin.', ikon: 'kagit' },
  5: { ad: 'Girdap', metin: 'Beş damla: çevresini yutar.', ikon: 'girdap' },
  7: { ad: 'Lale', metin: 'Altı damla: bir rengin hepsini alır.', ikon: 'lale' },
  8: { ad: 'Mermer', metin: 'Yanındaki eşleşmeyle çatlar.', ikon: 'mermer' },
  9: { ad: 'Desen', metin: 'Her desen hücresi kendi rengini ister.', ikon: 'desen' },
  11: { ad: 'Mürekkep', metin: 'Karışık + eksik ham boya: Mürekkep. Yanında eşleşme olunca patlar.', ikon: 'murekkep' },
  13: { ad: 'Yağ', metin: 'Yağlı damla karışmaz. Üstünü temizle.', ikon: 'yag' },
  16: { ad: 'Kıt renk', metin: 'Sarı yağmıyor. Elindekini iyi kullan.', ikon: 'kit' },
};
