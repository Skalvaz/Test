/**
 * GEÇİCİ önizleme verisi (yalnız dev/arayuz.html): her ekran için sahte
 * görünüm modelleri. Oyun bunları kullanmaz; entegratör gerçek modelleri
 * meta/kayıttan eşler.
 */
import type { MuhurVM } from '../tipler';
import type {
  AyarlarVM,
  BolumDugumuVM,
  BolumOncesiVM,
  DefterVM,
  DuraklatVM,
  GunlukVM,
  HaritaVM,
  HedefVM,
  HudVM,
  IstatistikVM,
  KaybettinVM,
  KazandinVM,
  Yildiz,
} from '../tipler';
import { DESENLER, FITILLER, KASABA_ISLERI, MAHALLELER } from '../../app/katalog';
import type { KasabaIsVM, KasabaVM } from '../tipler';
import { MK, ROZET_SIRASI, URUN_METINLERI, gorevMetni } from '../metinler';
import type { CanSayaciVM, CanVM, MagazaUrunVM, MagazaVM } from '../tipler';
import { URUN_IDLERI, type UrunId } from '../../platform/gelir';
import { DIL, t } from '../../platform/dil';
import { oyunOzetiVM } from '../../app/oyunOzeti';
import { olaylardanToplam, type OlcumOlayi } from '../../platform/olcum';

// ─────────────── Can, reklam, Mağaza (CAN-REKLAM §6) ───────────────

/** Örnek "sonraki can" süresi: 12:31. */
export const ORNEK_SONRAKI_MS = (12 * 60 + 31) * 1000;

/** Harita can hapı: `sayi` 0..5 (5'te sayaç yok). */
export function canSayaciVm(sayi: number): CanSayaciVM {
  return { sayi, enCok: 5, sonrakiMs: sayi < 5 ? ORNEK_SONRAKI_MS : null };
}

/**
 * Can paneli çeşitleri: bitti (0 can, reklam hazır, 2 hak), durum|kalan (3/5),
 * kart (Usta kartı: "Ücretsiz +1 can"), hakyok (bugünkü hak bitti: "Yarın
 * yine"), hazirdegil (reklam yok: satır gizli), dolu (5/5).
 */
export function canVm(v = 'bitti'): CanVM {
  const sayi = v === 'bitti' || v === 'hakyok' || v === 'hazirdegil' ? 0 : v === 'kart' ? 1 : v === 'dolu' ? 5 : 3;
  const dolu = sayi >= 5;
  return {
    ...canSayaciVm(sayi),
    tur: sayi === 0 ? 'bitti' : 'durum',
    reklam: dolu ? null : { hak: v === 'hakyok' ? 0 : 2, hazir: v !== 'hazirdegil', kart: v === 'kart' },
    doldur: dolu ? null : { fiyat: '₺29,99' },
  };
}

/** Mağaza çeşitleri: 1 (hepsi satılık), sende (Usta kartı alınmış), stok (paket sığmıyor, canlar dolu), bekle (fiyatlar gelmedi). */
export function magazaVm(v = '1'): MagazaVM {
  const fiyat: Record<UrunId, string> = { can_doldur: '₺29,99', guclendirici_paketi: '₺59,99', usta_karti: '₺149,99' };
  return {
    urunler: URUN_IDLERI.map((id) => {
      let durum: MagazaUrunVM['durum'] = 'satilik';
      if (v === 'sende' && id === 'usta_karti') durum = 'sende';
      if (v === 'stok' && id !== 'usta_karti') durum = 'stokDolu';
      if (v === 'yok' && id === 'guclendirici_paketi') durum = 'yok';
      return { id, ad: URUN_METINLERI[id].ad, aciklama: URUN_METINLERI[id].aciklama, fiyat: v === 'bekle' ? null : fiyat[id], durum };
    }),
    geriYukle: true,
  };
}

export function haritaVm(simdiki = 14, kasaba: { isler: string[]; kandil: number; yapilabilir: boolean } | null = null, can: CanSayaciVM | null = null): HaritaVM {
  const yildizlar: Yildiz[] = [3, 3, 2, 3, 1, 2, 3, 3, 2, 1, 3, 2, 3, 3, 2, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 3, 3, 2, 3, 3, 2, 3, 3, 3, 2, 3, 2, 3, 3, 3];
  const bolumler: BolumDugumuVM[] = Array.from({ length: 40 }, (_, i) => {
    const id = i + 1;
    if (id < simdiki) return { id, yildiz: yildizlar[i], durum: 'acik' };
    if (id === simdiki) return { id, yildiz: 0, durum: 'simdiki' };
    return { id, yildiz: 0, durum: 'kilitli' };
  });
  const toplam = bolumler.reduce((a, b) => a + b.yildiz, 0);
  return {
    toplamYildiz: toplam,
    bolumler,
    // Usta: (i+1)·15★ ve 12. bölüm kazanılmış olmalı (kapı geçilmediyse kapiBolumu).
    ustalar: Array.from({ length: 8 }, (_, i) => ({ id: 101 + i, acik: toplam >= (i + 1) * 15 && simdiki > 12, yildiz: (i === 0 && simdiki > 12 ? 2 : 0) as Yildiz, gerekenYildiz: (i + 1) * 15, eksikYildiz: Math.max(0, (i + 1) * 15 - toplam), ...(simdiki > 12 ? {} : { kapiBolumu: 12 }) })),
    motifler: simdiki > 26 ? [{ motif: 'lale', mahalle: 5 }] : [],
    seri: { gun: 5, basamak: 'cira' },
    gunluk: { acik: simdiki > 14, tamam: 1, toplam: 3, acilisBolumu: 14 },
    defterYeni: true,
    ...(kasaba ? { kasaba: { acik: true, kandil: kasaba.kandil, isler: kasaba.isler, yapilabilir: kasaba.yapilabilir } } : {}),
    ...(can ? { can } : {}),
  };
}

const hedef = (o: Partial<HedefVM>): HedefVM => ({ tur: 'topla', gerekli: 10, ilerleme: 0, tamam: false, ...o });

/** (Kancalar §C.1) Örnek kasaba paneli: İskele bitti, Çarşı'da 2 iş, Liman açık değil. */
export function kasabaVm(ogretim = false): KasabaVM {
  const durumlar: KasabaIsVM['durum'][][] = [
    ogretim ? ['yapilabilir', 'yapilabilir', 'yapilabilir', 'yapilabilir', 'yetersiz', 'tacKilitli'] : ['yapildi', 'yapildi', 'yapildi', 'yapildi', 'yapildi', 'yapildi'],
    ['yapildi', 'yapildi', 'yapilabilir', 'yetersiz', 'yetersiz', 'tacKilitli'],
  ];
  return {
    kandil: ogretim ? 7 : 3,
    secili: ogretim ? 0 : 1,
    ogretim,
    mahalleler: MAHALLELER.map((_, m) => {
      const isler = KASABA_ISLERI.filter((x) => x.mahalle === m).map((x, i) => {
        const d = durumlar[m]?.[i] ?? (m === 2 ? 'haritaKilitli' : 'sirada');
        return { id: x.id, ad: x.ad, aciklama: x.aciklama, maliyet: x.maliyet, tac: x.sira === 5, durum: d, eksik: d === 'yetersiz' ? x.maliyet - (ogretim ? 7 : 3) : 0 };
      });
      return { indeks: m, acik: m <= 1, sirada: m <= (ogretim ? 0 : 1), yapilan: isler.filter((x) => x.durum === 'yapildi').length, isler };
    }),
  };
}

/** (Kancalar) Örnek mühür satırları. */
export function muhurlerVm(durumlu = false): MuhurVM[] {
  return [
    { kademe: 'cirak', metin: t('2 kasımpatı yap', 'Make 2 chrysanthemums'), basili: true, ...(durumlu ? { durum: 'tuttu' as const } : {}) },
    { kademe: 'kalfa', metin: t('Tek hamlede 3 özel taş ateşle', 'Fire 3 specials in one move'), basili: false, ...(durumlu ? { durum: 'tuttu' as const } : {}) },
    { kademe: 'usta', metin: t('8 hamle kala kazan', 'Win with 8 moves left'), basili: false, ...(durumlu ? { durum: 'sonda' as const } : {}) },
  ];
}

export function hudVm(w = 7, h = 9, varyant = ''): HudVM {
  return {
    ...(varyant === 'muhur' ? { muhurler: muhurlerVm(true) } : {}),
    bolumId: 12,
    bolumAdi: t('Yıldız Topu', 'Star Ball'),
    tahtaW: w,
    tahtaH: h,
    hedefler:
      varyant === 'tek'
        ? [hedef({ tur: 'kafes', gerekli: 6, ilerleme: 2 })]
        : [hedef({ renk: 0, gerekli: 40, ilerleme: 28 }), hedef({ renk: 3, gerekli: 40, ilerleme: 40, tamam: true }), hedef({ tur: 'kafes', gerekli: 6, ilerleme: 2 })],
    kalanHamle: varyant === 'son5' ? 4 : varyant === 'son1' ? 1 : 14,
    toplamHamle: 20,
    puan: 4820,
    yildizEsikleri: [5200, 7400],
    yildizSiniri: 3,
    korukDolum: varyant === 'koruk' ? 20 : 13,
    korukKapasite: 20,
    guclendiriciler: [
      { id: 'kibrit', adet: 2, acik: true, kullanilabilir: true },
      { id: 'kalip', adet: 1, acik: true, kullanilabilir: true },
      { id: 'geriSar', adet: 0, acik: false, kullanilabilir: false },
    ],
  };
}

export function bolumOncesiVm(v = '1'): BolumOncesiVM {
  if (v === 'm' || v === 'mi')
    return {
      id: 14,
      ad: t('Kombinasyon', 'Combo'),
      mahalle: 2,
      tur: 'tanitim',
      hedefler: [hedef({ renk: 0, gerekli: 30 }), hedef({ tur: 'kafes', gerekli: 6 })],
      hamle: 22,
      esik: 4,
      yeniOge: 'kombo',
      enIyi: 6200,
      yildiz: 2,
      tablo: { nadirlik: 'parlak' },
      cosku: true,
      muhurler: muhurlerVm(),
      muhurIpucu: v === 'mi' ? MK.muhurKart : null,
    };
  if (v === '2')
    return {
      id: 19,
      ad: t('Kuru Gece', 'Dry Night'),
      mahalle: 3,
      tur: 'rahatlama',
      hedefler: [hedef({ tur: 'zincirleme', esik: 15, gerekli: 3 })],
      hamle: 20,
      esik: 3,
      yeniOge: 'bayram',
      enIyi: null,
      yildiz: 0,
      tablo: null,
      cosku: true,
    };
  if (v === '3')
    return {
      id: 102,
      ad: t('Yalnız Halka', 'Loops Only'),
      mahalle: 1,
      tur: 'usta',
      hedefler: [hedef({ tur: 'halka', gerekli: 6 }), hedef({ tur: 'puan', gerekli: 6000 })],
      hamle: 18,
      esik: 4,
      ustaKurali: t('Yalnız halkalar geçerli hamledir', 'Only loops count as moves'),
      enIyi: 5400,
      yildiz: 1,
      tablo: { nadirlik: 'sade' },
      cosku: false,
    };
  return {
    id: 12,
    ad: t('Yıldız Topu', 'Star Ball'),
    mahalle: 2,
    tur: 'tanitim',
    hedefler: [hedef({ renk: 0, gerekli: 40 }), hedef({ renk: 3, gerekli: 40 })],
    hamle: 20,
    esik: 4,
    yeniOge: 'yildiz',
    enIyi: 6200,
    yildiz: 2,
    tablo: { nadirlik: 'parlak' },
    cosku: false,
  };
}

export function duraklatVm(v = '1'): DuraklatVM {
  const m = muhurlerVm(true);
  if (v === 'm') m[2] = { ...m[2], durum: 'bekliyor' };
  return { bolumId: 12, bolumAdi: t('Yıldız Topu', 'Star Ball'), hedefler: hudVm().hedefler, coskuAktif: true, ...(v === 'm' ? { muhurler: m } : {}) };
}

export function kazandinVm(v = '1'): KazandinVM {
  return {
    bolumId: 10,
    bolumAdi: t('Çarşı Gecesi', 'Bazaar Night'),
    yildiz: v === '2' ? 2 : 3,
    oncekiYildiz: 1,
    puan: 8640,
    yeniRekor: true,
    sandiklar:
      v === '2'
        ? []
        : [
            { tur: 'parlak', oduller: [{ tur: 'desenParcasi', id: 'kalp', parca: 2 }, { tur: 'guclendirici', id: 'kibrit', adet: 1 }] },
            { tur: 'normal', oduller: [{ tur: 'fitilParcasi', id: 'altinTel', parca: 1 }] },
          ],
    tablo: { nadirlik: v === '2' ? 'sade' : 'saheser', eskiVar: true, eskiNadirlik: 'parlak' },
    sonrakiTanitim: t('Sıradaki: Fener Alayı!', 'Next: Lantern Parade!'),
    sonrakiOge: 'fener',
    ipucu: v === '2' ? t('Yıldızlar puanından gelir.', 'Stars come from your score.') : null,
    ...(v === 'm' || v === 'mt'
      ? {
          muhurler: {
            liste: muhurlerVm().map((m, i) => ({ ...m, basili: v === 'm' ? true : i < 2, yeni: i > 0 && (v === 'm' || i < 2) })),
            tanitim: v === 'mt',
            sancak: v === 'm',
          },
          kandil: v === 'mt' ? { onceki: 0, yeni: 8, tanitim: true, yildiz: 3, muhur: 0 } : { onceki: 14, yeni: 21, tanitim: false, yildiz: 2, muhur: 2 },
          kasabaHazir: v === 'm',
          duyurular: v === 'm' ? [{ ikon: 'alev', metin: t('Lale Dalı parçası (5 mühür)', 'Tulip Branch piece (5 seals)'), oncelikli: true }, { ikon: 'rozet', metin: t('Rozet: Halkacı', 'Badge: Looper') }] : [],
        }
      : {}),
    // (QA) Kalabalık ilk mühürlü kazanç (360×640): tanıtım + kandil + iş hazır + 3 duyuru + sandık + tablo.
    ...(v === 'mk'
      ? {
          sandiklar: [{ tur: 'normal' as const, oduller: [{ tur: 'fitilParcasi' as const, id: 'altinTel' as const, parca: 1 }] }],
          tablo: { nadirlik: 'parlak' as const, eskiVar: false },
          sonrakiTanitim: t('Sıradaki: Dev Fişek!', 'Next: Giant Firework!'),
          muhurler: { liste: muhurlerVm().map((m, i) => ({ ...m, basili: i === 0, yeni: i === 0 })), tanitim: true, sancak: false },
          kandil: { onceki: 31, yeni: 35, tanitim: false, yildiz: 3, muhur: 1 },
          kasabaHazir: true,
          duyurular: [
            { ikon: 'rozet', metin: t('Rozet: Halkacı', 'Badge: Looper') },
            { ikon: 'tik', metin: t('Görev: 3 bölüm kazan', 'Task: Win 3 levels') },
            { ikon: 'alev', metin: t('Fener Nöbeti: Çıra', 'Lantern Watch: Kindling') },
          ],
        }
      : {}),
    // (QA) Usta'nın Eli ile kazanç: boş halkalar ve açıklama.
    ...(v === 'me'
      ? { muhurler: { liste: muhurlerVm().map((m) => ({ ...m, basili: false, yeni: false })), tanitim: false, sancak: false, ustaEli: true }, yildiz: 1 as const }
      : {}),
  };
}

export function kaybettinVm(v = '1'): KaybettinVM {
  return {
    bolumId: 15,
    bolumAdi: t('Liman Fırtınası', 'Harbor Storm'),
    yuzde: 0.92,
    enZorHedef: hedef({ renk: 0, gerekli: 40, ilerleme: 37 }),
    hayalet: v === 'izlendi' ? 'izlendi' : 'var',
    ustaEli: v === 'usta' || v === 'izlendi' || v === 'canUsta',
    coskuSifirlandi: v === '1',
    // (CAN-REKLAM §6) can: −1 can + reklamla +5; can0: can bitti; reklam: ücretsiz bölümde
    // yalnız +5 (can satırı yok); kart: Usta kartıyla ücretsiz +5; canUsta: Eli varken reklam yok.
    ...(v === 'can' || v === 'kart' || v === 'canUsta' ? { can: { kalan: 3 } } : {}),
    ...(v === 'can0' ? { can: { kalan: 0 }, canBitti: true } : {}),
    ...(v === 'can' || v === 'can0' || v === 'reklam' || v === 'canUsta' ? { reklamHamle: { kart: false } } : {}),
    ...(v === 'kart' ? { reklamHamle: { kart: true } } : {}),
    ...(v === 'reklam' ? { gelirVar: true } : {}),
  };
}

export function ayarlarVm(): AyarlarVM {
  return {
    sfx: 0.8,
    muzik: 0.35,
    ortam: true,
    titresim: true,
    hareketiAzalt: false,
    hiz: 1,
    palet: 'standart',
    ipuclari: true,
    mola: 45,
    defterKartlari: [true, true, false, false, false, false, false, false],
    depolama: 'tarayici',
    surum: '0.1.0',
  };
}

export function defterVm(): DefterVM {
  return {
    toz: 23,
    desenler: DESENLER.map((d, i) => ({ id: d.id, parca: d.baslangicta ? 3 : [0, 1, 2, 3, 0, 1][i % 6], takili: i < 3 || i === 9 })),
    fitiller: FITILLER.map((f, i) => ({ id: f.id, parca: f.baslangicta ? 3 : [1, 3, 0, 2][i % 4], secili: i === 0 })),
    gokyuzleri: MAHALLELER.map((m, i) => ({ id: m.gokyuzu, acik: i < 3, secili: i === 1 })),
    tablolar: [
      { bolumId: 1, ad: t('İlk Kıvılcım', 'First Spark'), nadirlik: 'sade' },
      { bolumId: 5, ad: t('Nişan', 'Aim'), nadirlik: 'parlak' },
      { bolumId: 10, ad: t('Çarşı Gecesi', 'Bazaar Night'), nadirlik: 'saheser' },
      { bolumId: 11, ad: t('Fener Alayı', 'Lantern Parade'), nadirlik: 'sade' },
    ],
    motifler: [{ motif: 'lale', acik: true }, { motif: 'kayik', acik: false }, { motif: 'fener', acik: false }, { motif: 'carkifelek', acik: false }],
    kartlar: [true, true, false, false, false, false, false, false],
  };
}

export function gunlukVm(): GunlukVM {
  return {
    tarih: 20261014,
    enIyi: 6840,
    yildiz: 2,
    kazanildi: true,
    gorevler: [
      { metin: gorevMetni(1), ilerleme: 2, gerekli: 2, tamam: true },
      { metin: gorevMetni(3, 3), ilerleme: 31, gerekli: 50, tamam: false },
      { metin: gorevMetni(12), ilerleme: 0, gerekli: 2, tamam: false },
    ],
    seri: { gun: 5, basamak: 'cira' },
    paylasim: { tarih: 20261014, yildiz: 2, kullanilanHamle: 18, toplamHamle: 22, enBuyuk: 27, reaksiyonlar: [1, 2, 9, 0, 16, 8, 3, 2, 10, 12, 4, 20, 1, 9, 2, 3, 11, 14] },
    arsiv: Array.from({ length: 7 }, (_, i) => ({ tarih: 20261013 - i, enIyi: i % 3 === 2 ? null : 5200 + i * 310, yildiz: (i % 3 === 2 ? 0 : (3 - (i % 3)) as Yildiz) })),
  };
}

export function istatistikVm(): IstatistikVM {
  return {
    enUzunZincir: 17,
    enBuyukReaksiyon: 42,
    toplamHalka: 63,
    toplamPatlama: 12480,
    enCokNesil: 5,
    enIyiGunluk: 9120,
    toplamYildiz: 37,
    bolumSkorlari: [
      { id: 1, ad: t('İlk Kıvılcım', 'First Spark'), enIyi: 2450, yildiz: 3 },
      { id: 2, ad: t('Çapraz Yol', 'Diagonals'), enIyi: 3120, yildiz: 3 },
      { id: 3, ad: t('Isınma', 'Warming Up'), enIyi: 3980, yildiz: 2 },
      { id: 4, ad: t('Sar ve Pişir', 'Wrap and Bake'), enIyi: 4410, yildiz: 3 },
      { id: 5, ad: t('Nişan', 'Aim'), enIyi: 5230, yildiz: 1 },
    ],
    rozetler: ROZET_SIRASI.map((id, i) => ({ id, acik: [0, 3, 4, 6, 9, 10, 14].includes(i) })),
  };
}

/**
 * Oyun özeti: gerçek eşleme (`oyunOzetiVM`) sahte ölçüm olaylarıyla.
 * v=bos: boş günlük; v=az: yalnız açılış (bölüm yok); v=1: 3 gün, 15 bölüm,
 * 9. bölümde takılma.
 */
export function oyunOzetiVm(v = '1'): ReturnType<typeof oyunOzetiVM> {
  const GUN = 86_400_000;
  const t0 = Date.UTC(2026, 9, 18, 17, 0, 0);
  const olaylar: OlcumOlayi[] = [];
  let t = t0;
  const ekle = (a: string, gun: number, oturum: number, p?: OlcumOlayi['p'], sn = 5) => {
    t = Math.max(t + sn * 1000, t0 + gun * GUN);
    olaylar.push({ a, t, g: gun, o: oturum, ...(p ? { p } : {}) });
  };
  if (v === 'bos') return oyunOzetiVM(olaylardanToplam([]), t0, t0);
  ekle('oturum_basla', 0, 1, { dil: DIL, surum: '1.0', ana: 1 });
  if (v !== 'az') {
    const oyna = (id: number, gun: number, oturum: number, sonuc: 'kazanc' | 'kayip' | 'cikis', sure: number) => {
      ekle('bolum_basla', gun, oturum, { id, tur: 'ana', deneme: 0 });
      ekle('bolum_bitti', gun, oturum, { id, tur: 'ana', sonuc, sure }, sure);
    };
    for (let id = 1; id <= 7; id++) oyna(id, 0, 1, id === 5 ? 'kayip' : 'kazanc', 60 + id * 9);
    oyna(5, 0, 1, 'kazanc', 104);
    ekle('oturum_basla', 1, 2, { dil: DIL, surum: '1.0', ana: 8 });
    for (const [id, s] of [[8, 'kazanc'], [9, 'kayip'], [9, 'kayip'], [9, 'cikis'], [9, 'kayip'], [9, 'kazanc'], [10, 'kazanc'], [11, 'kayip'], [11, 'kazanc']] as const) oyna(id, 1, 2, s, 95 + id * 4);
    ekle('oturum_basla', 3, 3, { dil: DIL, surum: '1.0', ana: 12 });
    for (const id of [12, 13, 14]) oyna(id, 3, 3, 'kazanc', 110 + id);
    oyna(15, 3, 3, 'kayip', 168);
    ekle('bolum_basla', 3, 3, { id: 15, tur: 'ana', deneme: 1 });
    ekle('oturum_basla', 4, 4, { dil: DIL, surum: '1.0', ana: 15 });
  }
  return oyunOzetiVM(olaylardanToplam(olaylar), t0 + 4 * GUN + 600_000, t0);
}
