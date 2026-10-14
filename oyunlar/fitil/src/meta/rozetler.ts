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
 */
import type { GuclendiriciId } from '../app/katalog';
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

function mahalleUcYildiz(k: Kayit, ayar: MetaAyar): boolean {
  for (let m = 0; m < mahalleSayisi(ayar); m++) {
    const ids = mahalleBolumleri(m, ayar);
    if (ids.length > 0 && ids.every((id) => (k.bolumler[String(id)]?.yildiz ?? 0) >= 3)) return true;
  }
  return false;
}

const TANIMLAR: Record<RozetId, Omit<RozetTanimi, 'id'>> = {
  ilkKivilcim: { ad: 'İlk Kıvılcım', aciklama: '1. bölümü kazan', kosul: (b) => (b.kayit.bolumler['1']?.yildiz ?? 0) >= 1 },
  caprazNisanci: { ad: 'Çapraz Nişancı', aciklama: 'Çapraz roketle 3 kafes kır (tek oyunda)', kosul: (b) => (b.oyun?.ozet.caprazRoketKafes ?? 0) >= 3 },
  sarVePisir: { ad: 'Sar ve Pişir', aciklama: 'Tek zincirle bir kafesi 3 komşusundan ısıt', kosul: (b) => !!b.oyun?.ozet.sarVePisir },
  halkaci: { ad: 'Halkacı', aciklama: 'Toplam 50 halka çiz', odul: { guc: 'kibrit', adet: 1 }, kosul: (b) => b.kayit.istatistik.toplamHalka >= 50 },
  otuzluk: { ad: 'Otuzluk', aciklama: 'Tek hamlede 30+ reaksiyon', odul: { guc: 'kalip', adet: 1 }, kosul: (b) => b.kayit.rekorlar.enBuyukReaksiyon >= 30 },
  senlik: { ad: 'ŞENLİK!', aciklama: 'Tek hamlede 40+ reaksiyon', odul: { guc: 'geriSar', adet: 1 }, kosul: (b) => b.kayit.rekorlar.enBuyukReaksiyon >= 40 },
  ucuncuKusak: { ad: 'Üçüncü Kuşak', aciklama: 'Bir hamlede 3. nesil patlama', kosul: (b) => b.kayit.rekorlar.enCokNesil >= 3 },
  buyukFinal: { ad: 'Büyük Final', aciklama: 'Yıldız + Yıldız kombinasyonu', kosul: (b) => !!b.oyun?.ozet.kombolar.includes('buyukFinal') },
  roketYagmuru: { ad: 'Roket Yağmuru', aciklama: 'Yıldız + Roket kombinasyonu', kosul: (b) => !!b.oyun?.ozet.kombolar.includes('roketYagmuru') },
  kilpayi: { ad: 'Kılpayı', aciklama: 'Son hamlede kazan', kosul: (b) => !!b.oyun?.kazandi && b.oyun.kalanHamle === 0 },
  tutumlu: { ad: 'Tutumlu', aciklama: '10+ hamle kalarak kazan', kosul: (b) => !!b.oyun?.kazandi && (b.oyun.kalanHamle ?? 0) >= 10 },
  ustaCirak: { ad: 'Usta Çırak', aciklama: 'Bir mahallenin tamamında 3★', odul: { guc: 'kibrit', adet: 1 }, kosul: (b) => mahalleUcYildiz(b.kayit, b.ayar) },
  saheser: {
    ad: 'Şaheser',
    aciklama: 'İlk Şaheser tablo',
    kosul: (b) => b.oyun?.nadirlik === 2 || Object.values(b.kayit.bolumler).some((x) => x.nadirlik === 2),
  },
  defterci: { ad: 'Defterci', aciklama: '12 desen tamamla', kosul: (b) => toplananDesenSayisi(b.kayit) >= 12 },
  nobetci: { ad: 'Nöbetçi', aciklama: 'Fener Nöbeti 7', kosul: (b) => b.kayit.gunluk.enUzunSeri >= 7 },
  denizFeneri: { ad: 'Deniz Feneri', aciklama: 'Fener Nöbeti 30', kosul: (b) => b.kayit.gunluk.enUzunSeri >= 30 },
  korukcu: { ad: 'Körükçü', aciklama: 'Körükle 10+ reaksiyon', kosul: (b) => (b.oyun?.ozet.korukEnBuyukR ?? 0) >= 10 },
  domino: { ad: 'Domino', aciklama: 'Barut iziyle 3 dev fişek ateşle (tek oyunda)', odul: { guc: 'kalip', adet: 1 }, kosul: (b) => (b.oyun?.ozet.izliDevFisek ?? 0) >= 3 },
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
