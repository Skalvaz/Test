/**
 * GEÇİCİ önizleme verisi (yalnız dev/arayuz.html): her ekran için sahte
 * görünüm modelleri. Oyun bunları kullanmaz; entegratör gerçek modelleri
 * meta/kayıttan eşler.
 */
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
import { DESENLER, FITILLER, MAHALLELER } from '../../app/katalog';
import { ROZET_SIRASI, gorevMetni } from '../metinler';

export function haritaVm(simdiki = 14): HaritaVM {
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
    ustalar: Array.from({ length: 8 }, (_, i) => ({ id: 101 + i, acik: toplam >= (i + 1) * 15, yildiz: (i === 0 ? 2 : 0) as Yildiz, gerekenYildiz: (i + 1) * 15 })),
    motifler: simdiki > 26 ? [{ motif: 'lale', mahalle: 5 }] : [],
    seri: { gun: 5, basamak: 'cira' },
    gunluk: { acik: simdiki > 10, tamam: 1, toplam: 3 },
    defterYeni: true,
  };
}

const hedef = (o: Partial<HedefVM>): HedefVM => ({ tur: 'topla', gerekli: 10, ilerleme: 0, tamam: false, ...o });

export function hudVm(w = 7, h = 9, varyant = ''): HudVM {
  return {
    bolumId: 12,
    bolumAdi: 'Yıldız Topu',
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
  if (v === '2')
    return {
      id: 19,
      ad: 'Kuru Gece',
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
      ad: 'Yalnız Halka',
      mahalle: 1,
      tur: 'usta',
      hedefler: [hedef({ tur: 'halka', gerekli: 6 }), hedef({ tur: 'puan', gerekli: 6000 })],
      hamle: 18,
      esik: 4,
      ustaKurali: 'Yalnız halkalar geçerli hamledir',
      enIyi: 5400,
      yildiz: 1,
      tablo: { nadirlik: 'sade' },
      cosku: false,
    };
  return {
    id: 12,
    ad: 'Yıldız Topu',
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

export function duraklatVm(): DuraklatVM {
  return { bolumId: 12, bolumAdi: 'Yıldız Topu', hedefler: hudVm().hedefler, coskuAktif: true };
}

export function kazandinVm(v = '1'): KazandinVM {
  return {
    bolumId: 10,
    bolumAdi: 'Çarşı Gecesi',
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
    sonrakiTanitim: 'Sıradaki: Fener Alayı!',
    sonrakiOge: 'fener',
    ipucu: v === '2' ? 'Yıldızlar puanından gelir.' : null,
  };
}

export function kaybettinVm(v = '1'): KaybettinVM {
  return {
    bolumId: 15,
    bolumAdi: 'Liman Fırtınası',
    yuzde: 0.92,
    enZorHedef: hedef({ renk: 0, gerekli: 40, ilerleme: 37 }),
    hayalet: v === 'izlendi' ? 'izlendi' : 'var',
    ustaEli: v === 'usta' || v === 'izlendi',
    coskuSifirlandi: v === '1',
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
      { bolumId: 1, ad: 'İlk Kıvılcım', nadirlik: 'sade' },
      { bolumId: 5, ad: 'Nişan', nadirlik: 'parlak' },
      { bolumId: 10, ad: 'Çarşı Gecesi', nadirlik: 'saheser' },
      { bolumId: 11, ad: 'Fener Alayı', nadirlik: 'sade' },
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
      { id: 1, ad: 'İlk Kıvılcım', enIyi: 2450, yildiz: 3 },
      { id: 2, ad: 'Çapraz Yol', enIyi: 3120, yildiz: 3 },
      { id: 3, ad: 'Isınma', enIyi: 3980, yildiz: 2 },
      { id: 4, ad: 'Sar ve Pişir', enIyi: 4410, yildiz: 3 },
      { id: 5, ad: 'Nişan', enIyi: 5230, yildiz: 1 },
    ],
    rozetler: ROZET_SIRASI.map((id, i) => ({ id, acik: [0, 3, 4, 6, 9, 10, 14].includes(i) })),
  };
}
