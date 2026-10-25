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
import { t } from '../platform/dil';
import type { Motif } from '../core/types';
import { gunlukAcik, sonrakiBasamak } from './gunluk';
import { coskuAktif, ustaKilidi } from './ilerleme';
import { acikEnYuksek, anaYildiz, bolumKaydi, seriBasamakIndeksi, sonsuzAcikMi, toplamYildiz } from './kayit';
import type { Kayit, Nadirlik, Yildiz } from './kayit';
import { SERI_BASAMAKLARI, mahalleBolumleri, mahalleSayisi, metaAyar } from './sabitler';
import type { MetaAyar } from './sabitler';
import { KASABA_IS_PER_MAHALLE } from '../app/katalog';
import { kandilDokumu, kasabaAcikMi, mahalleSuslendi, siradakiKasabaIsi } from './kasaba';
import { MUHUR_ACILIS_BOLUMU, MUHUR_SON_BOLUM, muhurSayisi } from './muhur';

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
  /** Şema 3: mühür maskesi (bit 0 Çırak, 1 Kalfa, 2 Usta); mühürsüz bölümde null. */
  muhur: number | null;
  /** Üç mühür tamam: çatıda mahalle renginde sancak (KANCALAR §A.6). */
  sancak: boolean;
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
  /** Usta kapısı (`USTA_ACILIS_BOLUMU`) henüz geçilmedi (`ustaKilidi`). */
  bolumKapisi: boolean;
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
  /** Şema 3: mahallenin mühürleri (0..15; İskele mühürsüz → 0/0). */
  muhur: number;
  muhurToplam: number;
  /** Yapılan kasaba işi (0..6) ve 6/6 süslendi mi. */
  kasabaIs: number;
  suslendi: boolean;
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
  /**
   * Şema 3 (KANCALAR §C.1): Kasaba düğmesi. `acik` 3. bölümden sonra;
   * `siradaki` en ucuz açık iş ve eksik kandil; `isler` yapılan işlerin
   * kimlikleri (harita süsleri).
   */
  kasaba: { acik: boolean; kandil: number; isler: string[]; siradaki: { id: string; ad: string; maliyet: number; eksik: number } | null; yapilabilir: boolean };
}

/** Usta Bölümleri (§10.2). */
export const USTA_BOLUMLERI: readonly { ad: string; kural: string }[] = [
  { ad: t('Kuru Barut', 'Dry Powder'), kural: t('Eşik 2, 14 hamle, puan hedefi', 'Ignites at 2 heat, 14 moves, score goal') },
  { ad: t('Yalnız Halka', 'Loops Only'), kural: t('Yalnız halkalar geçerli hamledir', 'Only loops count as moves') },
  { ad: t('Dört Yön', 'Four Ways'), kural: t('Çapraz bağlantı yok', 'No diagonal links') },
  { ad: t('Gizli Isı', 'Hidden Heat'), kural: t('Yalnız kızgın kapsüller görünür', 'Only hot capsules show their heat') },
  { ad: t('Domino', 'Domino'), kural: t('Barut izi ve dev fişek düzeneği, 25 hamle', 'Powder trails and giant fireworks, 25 moves') },
  { ad: t('Dev Sandık', 'Giant Chest'), kural: t('8×10, 6 renk, 3 hedef', '8×10, 6 colors, 3 goals') },
  { ad: t('Çisenti Fırtınası', 'Drizzle Storm'), kural: t('İki çisenti her hamle bir hattı söndürür', 'Two drizzles douse a line every move') },
  { ad: t("Kıvılcım Usta'nın Sınavı", "Master Spark's Trial"), kural: t('Bütün öğeler, 30 hamle', 'Everything at once, 30 moves') },
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
        muhur: id >= MUHUR_ACILIS_BOLUMU && id <= MUHUR_SON_BOLUM ? (b?.muhur ?? 0) : null,
        sancak: id >= MUHUR_ACILIS_BOLUMU && id <= MUHUR_SON_BOLUM && muhurSayisi(b?.muhur) === 3,
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
      muhur: ids.reduce((t, id) => t + (id >= MUHUR_ACILIS_BOLUMU && id <= MUHUR_SON_BOLUM ? muhurSayisi(bolumKaydi(k, id)?.muhur) : 0), 0),
      muhurToplam: ids.filter((id) => id >= MUHUR_ACILIS_BOLUMU && id <= MUHUR_SON_BOLUM).length * 3,
      kasabaIs: (k.kasaba?.isler ?? []).filter((x) => x.startsWith(`${mh.id}.`)).length,
      suslendi: (k.kasaba?.isler ?? []).filter((x) => x.startsWith(`${mh.id}.`)).length >= KASABA_IS_PER_MAHALLE && mahalleSuslendi(k, m),
    });
    const ustaId = ayar.ustaIdleri[m];
    if (ustaId !== undefined) {
      const ub = bolumKaydi(k, ustaId);
      const uy = (ub?.yildiz ?? 0) as Yildiz;
      const kilit = ustaKilidi(k, m + 1, ayar);
      const u = USTA_BOLUMLERI[m] ?? { ad: t(`Usta ${m + 1}`, `Master ${m + 1}`), kural: '' };
      dugumler.push({
        tur: 'usta',
        id: ustaId,
        ustaNo: m + 1,
        ad: u.ad,
        kural: u.kural,
        mahalle: m,
        yolSirasi: yol++,
        durum: durum(kilit.acik, uy >= 1),
        yildiz: uy,
        gerekenYildiz: kilit.gerekenYildiz,
        eksikYildiz: kilit.eksikYildiz,
        bolumKapisi: kilit.bolumKapisi,
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
    kasaba: kasabaHaritasi(k, ayar),
  };
}

function kasabaHaritasi(k: Kayit, ayar: MetaAyar): HaritaVerisi['kasaba'] {
  const s = siradakiKasabaIsi(k, ayar);
  return {
    acik: kasabaAcikMi(k),
    kandil: kandilDokumu(k, ayar).bakiye,
    isler: [...(k.kasaba?.isler ?? [])],
    siradaki: s ? { id: s.is.id, ad: s.is.ad, maliyet: s.is.maliyet, eksik: s.eksik } : null,
    yapilabilir: s?.durum === 'yapilabilir',
  };
}
