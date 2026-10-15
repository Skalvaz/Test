/**
 * Harita görünüm verisi (GDD §10.1, §10.2, §14.2): Fener Koyu düğümleri,
 * kilitler, yıldızlar, pencere oranları, Usta düğümleri, mahalle tamamlanma.
 *
 * Arayüzün tiplerine bağlı değildir: kendi düz tipini döndürür, entegratör
 * `ui/harita` modeline eşler. Düğümler yol sırasıyladır (aşağıdan yukarıya):
 * mahalle 1'in 5 bölümü, U1, mahalle 2'nin 5 bölümü, U2, …
 */
import { MAHALLELER } from '../app/katalog';
import type { GokyuzuId } from '../app/katalog';
import { fnv1a } from '../core/rng';
import type { Motif } from '../core/types';
import { gunlukAcik, sonrakiBasamak } from './gunluk';
import { coskuAktif, ustaGerekenYildiz } from './ilerleme';
import { acikEnYuksek, anaYildiz, bolumKaydi, seriBasamakIndeksi, sonsuzAcikMi, toplamYildiz } from './kayit';
import type { Kayit, Nadirlik, Yildiz } from './kayit';
import { SERI_BASAMAKLARI, mahalleBolumleri, mahalleSayisi, metaAyar } from './sabitler';
import type { MetaAyar } from './sabitler';

export type DugumDurumu = 'kilitli' | 'acik' | 'kazanildi';

export interface HaritaBolumDugumu {
  tur: 'bolum';
  id: number;
  mahalle: number;
  /** Mahalle içindeki sıra (0 tabanlı). */
  sira: number;
  /** Bütün yol boyunca sıra (aşağıdan yukarı, 0 tabanlı). */
  yolSirasi: number;
  durum: DugumDurumu;
  yildiz: Yildiz;
  /** Yanan pencere oranı: 0, 1/3, 2/3, 1 (§10.1). */
  pencere: number;
  /** Pencere payı (0..3) — kesirsiz kullanım için. */
  pencerePay: number;
  /** 3★: binanın çatısında dönen küçük havai fişek. */
  catiFisegi: boolean;
  enIyi: number;
  /** Oynanacak sıradaki bölüm (harita otomatik buraya kayar). */
  siradaki: boolean;
  tablo: boolean;
  nadirlik: Nadirlik | null;
  /** Kasaba silueti için bina tohumu (belirlenimli). */
  tohum: number;
}

export interface HaritaUstaDugumu {
  tur: 'usta';
  id: number;
  /** 1 tabanlı (U1…U8). */
  ustaNo: number;
  ad: string;
  kural: string;
  /** Hangi mahallenin ardında durur. */
  mahalle: number;
  yolSirasi: number;
  durum: DugumDurumu;
  yildiz: Yildiz;
  gerekenYildiz: number;
  eksikYildiz: number;
  tohum: number;
}

export type HaritaDugumu = HaritaBolumDugumu | HaritaUstaDugumu;

export interface HaritaMahallesi {
  indeks: number;
  id: string;
  ad: string;
  vurgu: string;
  gokyuzu: GokyuzuId;
  bolumler: number[];
  /** İlk bölümü açık mı. */
  acik: boolean;
  /** 5 bölümün hepsi kazanıldı. */
  tamam: boolean;
  /** 5 bölümün hepsi 3★. */
  ucYildiz: boolean;
  yildiz: number;
  enFazlaYildiz: number;
  /** Bu mahallede asılı Işık Deseni motifleri. */
  motifler: Motif[];
  defterKarti: boolean;
  efsaneKarti: boolean;
}

export interface HaritaVerisi {
  /** Ana yol yıldızı ve tavanı (başlıkta "37/120"; Usta kilitleri buna bakar, §10.2). */
  anaYildiz: number;
  enFazlaYildiz: number;
  /** Usta Bölümü yıldızları (bonus, tavanın dışında). */
  ustaYildiz: number;
  /** Ana + Usta (ilerleme puanı). */
  toplamYildiz: number;
  acikEnYuksek: number;
  /** Oynanacak bölüm (hepsi kazanıldıysa son bölüm). */
  siradaki: number;
  dugumler: HaritaDugumu[];
  mahalleler: HaritaMahallesi[];
  gunluk: { acik: boolean; gorevTamam: number; gorevToplam: number; seri: number; basamak: string | null; sonrakiBasamak: { ad: string; yonelme: string; kalan: number } | null };
  sonsuz: { acik: boolean; siradaki: number };
  cosku: { seri: number; aktif: boolean };
}

/** Usta Bölümleri (§10.2). */
export const USTA_BOLUMLERI: readonly { ad: string; kural: string }[] = [
  { ad: 'Kuru Barut', kural: 'Eşik 2, 14 hamle, puan hedefi' },
  { ad: 'Yalnız Halka', kural: 'Yalnız halkalar geçerli hamledir' },
  { ad: 'Dört Yön', kural: 'Çapraz bağlantı yok' },
  { ad: 'Gizli Isı', kural: 'Yalnız kızgın kapsüller görünür' },
  { ad: 'Domino', kural: 'Barut izi ve dev fişek düzeneği, 19 hamle' },
  { ad: 'Dev Sandık', kural: '8×10, 6 renk, 3 hedef' },
  { ad: 'Çisenti Fırtınası', kural: 'İki çisenti her hamle bir hattı söndürür' },
  { ad: "Kıvılcım Usta'nın Sınavı", kural: 'Bütün öğeler, 30 hamle' },
];

/** Motiflerin geldiği bölümler (§8.3 planı); bölüm paketi farklıysa `haritaVerisi`'ne verilir. */
export const VARSAYILAN_MOTIF_BOLUMLERI: Partial<Record<Motif, number>> = { lale: 26, kayik: 30, fener: 38, carkifelek: 40 };

function durum(acik: boolean, kazanildi: boolean): DugumDurumu {
  return kazanildi ? 'kazanildi' : acik ? 'acik' : 'kilitli';
}

export function haritaVerisi(k: Kayit, secenek: { ayar?: Partial<MetaAyar>; motifBolumleri?: Partial<Record<Motif, number>> } = {}): HaritaVerisi {
  const ayar = metaAyar(secenek.ayar);
  const motifBolumleri = secenek.motifBolumleri ?? VARSAYILAN_MOTIF_BOLUMLERI;
  const acik = acikEnYuksek(k, ayar);
  const ana = anaYildiz(k, ayar);
  const ms = mahalleSayisi(ayar);
  const dugumler: HaritaDugumu[] = [];
  const mahalleler: HaritaMahallesi[] = [];
  // Doğrusal kilit: açık en yüksek bölüm oynanacak olandır (hepsi kazanıldıysa son bölüm).
  const siradaki = acik;
  let yol = 0;
  for (let m = 0; m < ms; m++) {
    const mh = MAHALLELER[m];
    const ids = mahalleBolumleri(m, ayar);
    let yildiz = 0;
    ids.forEach((id, sira) => {
      const b = bolumKaydi(k, id);
      const y = (b?.yildiz ?? 0) as Yildiz;
      yildiz += y;
      dugumler.push({
        tur: 'bolum',
        id,
        mahalle: m,
        sira,
        yolSirasi: yol++,
        durum: durum(id <= acik, y >= 1),
        yildiz: y,
        pencere: y / 3,
        pencerePay: y,
        catiFisegi: y >= 3,
        enIyi: b?.enIyi ?? 0,
        siradaki: id === siradaki && y === 0,
        tablo: !!b?.tablo,
        nadirlik: b?.tablo ? ((b.nadirlik ?? 0) as Nadirlik) : null,
        tohum: fnv1a(`bina:${id}`),
      });
    });
    const motifler = (Object.keys(motifBolumleri) as Motif[]).filter((mt) => {
      const bid = motifBolumleri[mt]!;
      return k.koleksiyon.motifler.includes(mt) && ids.includes(bid);
    });
    mahalleler.push({
      indeks: m,
      id: mh.id,
      ad: mh.ad,
      vurgu: mh.vurgu,
      gokyuzu: mh.gokyuzu,
      bolumler: ids,
      acik: ids.length > 0 && ids[0] <= acik,
      tamam: ids.every((id) => (bolumKaydi(k, id)?.yildiz ?? 0) >= 1),
      ucYildiz: ids.every((id) => (bolumKaydi(k, id)?.yildiz ?? 0) >= 3),
      yildiz,
      enFazlaYildiz: ids.length * 3,
      motifler,
      defterKarti: k.koleksiyon.kartlar.includes(`defter:${mh.id}`),
      efsaneKarti: k.koleksiyon.kartlar.includes(`efsane:${mh.id}`),
    });
    const ustaId = ayar.ustaIdleri[m];
    if (ustaId !== undefined) {
      const ub = bolumKaydi(k, ustaId);
      const uy = (ub?.yildiz ?? 0) as Yildiz;
      const gerek = ustaGerekenYildiz(m + 1, ayar);
      const u = USTA_BOLUMLERI[m] ?? { ad: `Usta ${m + 1}`, kural: '' };
      dugumler.push({
        tur: 'usta',
        id: ustaId,
        ustaNo: m + 1,
        ad: u.ad,
        kural: u.kural,
        mahalle: m,
        yolSirasi: yol++,
        durum: durum(ana >= gerek, uy >= 1),
        yildiz: uy,
        gerekenYildiz: gerek,
        eksikYildiz: Math.max(0, gerek - ana),
        tohum: fnv1a(`usta:${ustaId}`),
      });
    }
  }
  const gorevler = k.gunluk.gorevler;
  const b = seriBasamakIndeksi(k.gunluk.seri);
  const sonraki = sonrakiBasamak(k.gunluk.seri);
  return {
    anaYildiz: ana,
    enFazlaYildiz: ayar.anaBolumSayisi * 3,
    ustaYildiz: toplamYildiz(k, ayar) - ana,
    toplamYildiz: toplamYildiz(k, ayar),
    acikEnYuksek: acik,
    siradaki,
    dugumler,
    mahalleler,
    gunluk: {
      acik: gunlukAcik(k),
      gorevTamam: gorevler.filter((g) => g.tamam).length,
      gorevToplam: gorevler.length,
      seri: k.gunluk.seri,
      basamak: b >= 0 ? SERI_BASAMAKLARI[b].ad : null,
      sonrakiBasamak: sonraki ? { ad: sonraki.ad, yonelme: sonraki.yonelme, kalan: sonraki.kalan } : null,
    },
    sonsuz: { acik: sonsuzAcikMi(k, ayar), siradaki: k.sonsuzEnYuksek + 1 },
    cosku: { seri: k.cosku, aktif: coskuAktif(k) },
  };
}
