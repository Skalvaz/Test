/**
 * Başarımlar (GDD §10.6). Her rozetin koşulu, güncellenmiş kayıt ve son
 * oyunun bağlamı üzerinden değerlendirilir; kazanılan rozet bir daha
 * değerlendirilmez.
 *
 * Kararlar:
 *  - "Tek oyunda" yazanlar ve tek olay gerektirenler son oyunun olay
 *    özetinden, "toplam" yazanlar kayıttaki istatistikten okunur.
 *  - Domino (barut iziyle 3 dev fişek) tek oyunda sayılır: 37. bölüm bunun
 *    için tasarlanmış (5 dev fişek izlerle bağlı).
 *  - Defterci: baştan açık üç desen dışında 12 desen toplamak.
 *  - "Bazı rozetler" güçlendirici verir (§9): Halkacı, Otuzluk, ŞENLİK!,
 *    Usta Çırak, Domino — birer adet (stok doluysa toza döner).
 *  - Öğretim bölümleri (§15, 1–5) önceden ısıtılmış, kurgulu tahtalardır:
 *    Üçüncü Kuşak ve Tutumlu orada kendiliğinden düşüyordu (rozet
 *    değersizleşir). Bu iki beceri rozeti öğretim oyunlarında sayılmaz;
 *    Üçüncü Kuşak bu yüzden kayıt rekorundan değil oyunun özetinden okunur.
 */
import type { GuclendiriciId } from '../app/katalog';
import { t } from '../platform/dil';
import { toplananDesenSayisi } from './defter';
import type { Kayit, Nadirlik } from './kayit';
import type { OyunOzeti } from './ozet';
import { ROZET_IDLERI, mahalleBolumleri, mahalleSayisi } from './sabitler';
import type { MetaAyar, RozetId } from './sabitler';

export interface RozetBaglami {
  /** Güncellenmiş kayıt (bu oyunun sonucu işlenmiş). */
  kayit: Kayit;
  /** Son oyun (yoksa yalnız kayıt temelli rozetler değerlendirilir). */
  oyun: {
    bolumId: number;
    kazandi: boolean;
    /** Kazanç anında kalan hamle (final öncesi); bilinmiyorsa null. */
    kalanHamle: number | null;
    ozet: OyunOzeti;
    nadirlik: Nadirlik | null;
  } | null;
  ayar: MetaAyar;
}

export interface RozetTanimi {
  id: RozetId;
  ad: string;
  aciklama: string;
  odul?: { guc: GuclendiriciId; adet: number };
  kosul(b: RozetBaglami): boolean;
}

/** §15: ilk 5 bölüm öğretim. */
const OGRETIM_SON = 5;
const ogretimOyunu = (b: RozetBaglami): boolean => !!b.oyun && b.oyun.bolumId >= 1 && b.oyun.bolumId <= OGRETIM_SON;

function mahalleUcYildiz(k: Kayit, ayar: MetaAyar): boolean {
  for (let m = 0; m < mahalleSayisi(ayar); m++) {
    const ids = mahalleBolumleri(m, ayar);
    if (ids.length > 0 && ids.every((id) => (k.bolumler[String(id)]?.yildiz ?? 0) >= 3)) return true;
  }
  return false;
}

const TANIMLAR: Record<RozetId, Omit<RozetTanimi, 'id'>> = {
  ilkKivilcim: { ad: t('İlk Kıvılcım', 'First Spark'), aciklama: t('1. bölümü kazan', 'Win level 1'), kosul: (b) => (b.kayit.bolumler['1']?.yildiz ?? 0) >= 1 },
  caprazNisanci: { ad: t('Çapraz Nişancı', 'Diagonal Ace'), aciklama: t('Çapraz roketle 3 kafes kır (tek oyunda)', 'Break 3 cages with diagonal rockets (one game)'), kosul: (b) => (b.oyun?.ozet.caprazRoketKafes ?? 0) >= 3 },
  sarVePisir: { ad: t('Sar ve Pişir', 'Wrap and Bake'), aciklama: t('Tek zincirle bir kafesi 3 komşusundan ısıt', 'Heat a cage from 3 sides with one chain'), kosul: (b) => !!b.oyun?.ozet.sarVePisir },
  halkaci: { ad: t('Halkacı', 'Loop Maker'), aciklama: t('Toplam 50 halka çiz', 'Draw 50 loops in total'), odul: { guc: 'kibrit', adet: 1 }, kosul: (b) => b.kayit.istatistik.toplamHalka >= 50 },
  otuzluk: { ad: t('Otuzluk', 'Thirty Club'), aciklama: t('Tek hamlede 30+ reaksiyon', '30+ reaction in one move'), odul: { guc: 'kalip', adet: 1 }, kosul: (b) => b.kayit.rekorlar.enBuyukReaksiyon >= 30 },
  senlik: { ad: t('ŞENLİK!', 'FESTIVAL!'), aciklama: t('Tek hamlede 40+ reaksiyon', '40+ reaction in one move'), odul: { guc: 'geriSar', adet: 1 }, kosul: (b) => b.kayit.rekorlar.enBuyukReaksiyon >= 40 },
  ucuncuKusak: { ad: t('Üçüncü Kuşak', 'Third Generation'), aciklama: t('Bir hamlede 3. nesil patlama', '3rd-generation blast in one move'), kosul: (b) => !!b.oyun && !ogretimOyunu(b) && b.oyun.ozet.enCokNesil >= 3 },
  buyukFinal: { ad: t('Büyük Final', 'Grand Finale'), aciklama: t('Yıldız + Yıldız kombinasyonu', 'Star + Star combo'), kosul: (b) => !!b.oyun?.ozet.kombolar.includes('buyukFinal') },
  roketYagmuru: { ad: t('Roket Yağmuru', 'Rocket Rain'), aciklama: t('Yıldız + Roket kombinasyonu', 'Star + Rocket combo'), kosul: (b) => !!b.oyun?.ozet.kombolar.includes('roketYagmuru') },
  kilpayi: { ad: t('Kılpayı', 'Close Call'), aciklama: t('Son hamlede kazan', 'Win on the last move'), kosul: (b) => !!b.oyun?.kazandi && b.oyun.kalanHamle === 0 },
  tutumlu: { ad: t('Tutumlu', 'Thrifty'), aciklama: t('10+ hamle kalarak kazan', 'Win with 10+ moves left'), kosul: (b) => !!b.oyun?.kazandi && !ogretimOyunu(b) && (b.oyun.kalanHamle ?? 0) >= 10 },
  ustaCirak: { ad: t('Usta Çırak', 'Top Apprentice'), aciklama: t('Bir mahallenin tamamında 3★', '3★ on every level of a district'), odul: { guc: 'kibrit', adet: 1 }, kosul: (b) => mahalleUcYildiz(b.kayit, b.ayar) },
  saheser: {
    ad: t('Şaheser', 'Masterpiece'),
    aciklama: t('İlk Şaheser tablo', 'First Masterpiece'),
    kosul: (b) => b.oyun?.nadirlik === 2 || Object.values(b.kayit.bolumler).some((x) => x.nadirlik === 2),
  },
  defterci: { ad: t('Defterci', 'Collector'), aciklama: t('12 desen tamamla', 'Complete 12 patterns'), kosul: (b) => toplananDesenSayisi(b.kayit) >= 12 },
  nobetci: { ad: t('Nöbetçi', 'Night Watch'), aciklama: t('Fener Nöbeti 7', 'Lantern Watch 7'), kosul: (b) => b.kayit.gunluk.enUzunSeri >= 7 },
  denizFeneri: { ad: t('Deniz Feneri', 'Lighthouse'), aciklama: t('Fener Nöbeti 30', 'Lantern Watch 30'), kosul: (b) => b.kayit.gunluk.enUzunSeri >= 30 },
  korukcu: { ad: t('Körükçü', 'Bellows Pro'), aciklama: t('Körükle 10+ reaksiyon', '10+ reaction with the Bellows'), kosul: (b) => (b.oyun?.ozet.korukEnBuyukR ?? 0) >= 10 },
  domino: { ad: t('Domino', 'Domino'), aciklama: t('Barut iziyle 3 dev fişek ateşle (tek oyunda)', 'Fire 3 giant fireworks via powder trails (one game)'), odul: { guc: 'kalip', adet: 1 }, kosul: (b) => (b.oyun?.ozet.izliDevFisek ?? 0) >= 3 },
};

/** Rozetler gösterim sırasıyla. */
export const ROZETLER: readonly RozetTanimi[] = ROZET_IDLERI.map((id) => ({ id, ...TANIMLAR[id] }));

export function rozetTanimi(id: RozetId): RozetTanimi {
  return ROZETLER.find((r) => r.id === id)!;
}

/** Henüz kazanılmamış ve koşulu sağlanan rozetler (gösterim sırasıyla). */
export function yeniRozetler(b: RozetBaglami): RozetId[] {
  const sahip = new Set(b.kayit.rozetler);
  return ROZETLER.filter((r) => !sahip.has(r.id) && r.kosul(b)).map((r) => r.id);
}

/** Arayüz için: bütün rozetler ve durumları. */
export function rozetDurumlari(k: Kayit): { id: RozetId; ad: string; aciklama: string; kazanildi: boolean; odul?: { guc: GuclendiriciId; adet: number } }[] {
  return ROZETLER.map((r) => ({ id: r.id, ad: r.ad, aciklama: r.aciklama, kazanildi: k.rozetler.includes(r.id), odul: r.odul }));
}
