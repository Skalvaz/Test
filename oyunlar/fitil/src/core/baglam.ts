/**
 * Çözümleme bağlamı (§3.5): değiştirilebilir durum kopyası, olay listesi,
 * min-yığın kuyruk ve hamle başına sıfırlanan bayraklar.
 */
import { MinYigin } from './yigin';
import type { Eksen, Konum, Olay, OyunDurumu, OzelTur, PatlamaNedeni } from './types';

/**
 * Kuyruk öğesi türleri (§3.5.2).
 *  - FITIL, ISI, VURUS, TETIK: patlama türleri (hücre `patladi` ise atlanır).
 *    TETIK: kendi planını taşıyan patlama (çift dokunuş, roket yağmuru,
 *    bahçe, final roketleri ve final özel turları); hücre `planli` olduğu
 *    hâlde patlar.
 *  - DONUSUM: son düğüm özel taşa döner.
 *  - ISI_DALGASI: hedef hücreye +1 ısı (patlama değil).
 *  - DALGA: yalnız `isiDalgasi` olayını yazar (görsel).
 *  - IZ_ILERLE: barut izi adımı; DEVFISEK_ATES: dev fişek fırlar.
 */
export type KuyrukTuru = 'FITIL' | 'DONUSUM' | 'ISI' | 'VURUS' | 'TETIK' | 'ISI_DALGASI' | 'DALGA' | 'IZ_ILERLE' | 'DEVFISEK_ATES';

export interface KuyrukOgesi {
  t: number;
  y: number;
  x: number;
  sira: number;
  tur: KuyrukTuru;
  /** Hedef hücre indeksi. */
  i: number;
  nesil: number;
  /** Patlamanın komşulara verdiği ısı (fitil düğümü: halka ? 2 : 1). */
  isiMiktari: number;
  /** VURUS/TETIK: patlama nedeni. */
  neden: PatlamaNedeni;
  /** FITIL/DONUSUM: düğüm sırası (1 tabanlı). */
  k: number;
  /** FITIL: S1 (etki yüklenir) / S2 (birleşik etki). */
  yukle: boolean;
  kombo: boolean;
  /** IZ_ILERLE: iz indeksi, izdeki sıra, yön (±1). */
  iz: number;
  izSira: number;
  yon: number;
  /** DALGA: yarıçap. */
  yaricap: number;
  /** DONUSUM: oluşacak özel tür ve eksen. */
  ozel: OzelTur;
  eksen: Eksen;
}

export interface Cozum {
  d: OyunDurumu;
  olaylar: Olay[];
  yigin: MinYigin<KuyrukOgesi>;
  sira: number;
  /** Hamle başına bayraklar (§3.5). */
  planli: Uint8Array;
  patladi: Uint8Array;
  kalkan: Uint8Array;
  /** Hamle bir zincir mi; zincir rengi (hepsi joker ise bırakma anındaki en çok renk). */
  zincirVar: boolean;
  zincirRengi: number;
  /** Son işlenen olayın zamanı. */
  saat: number;
  /** Bu eylemdeki ISI patlamaları (Körük dolumu, §6 Körük Göstergesi). */
  isiPatlamasi: number;
  /** Reaksiyon boyutu R: fitil düğümü olmayan kapsül patlamaları (§6.9). */
  R: number;
  /** Patlama kayıtları: (t, x, y) üçlüleri (zirve ve merkez için). */
  patlamalar: number[];
  /** Bu hamlede is temizlendi mi (§5 yayılma). */
  isTemizlendi: boolean;
  /** Bu eylemde kombinasyon oldu mu. */
  kombo: boolean;
  /** S1'in yüklenen etkisi (§4.4). */
  yuklu: { ozel: OzelTur; eksen: Eksen } | null;
  /** Final Gösterisi çözümlemesi (§7.3): reaksiyon bonusu yok. */
  final: boolean;
}

/** Hamle başında kova kalkanı (§5): bir kovaya dik komşu hücreler. */
export function kalkanHesapla(d: OyunDurumu): Uint8Array {
  const k = new Uint8Array(d.w * d.h);
  for (let y = 0; y < d.h; y++) {
    for (let x = 0; x < d.w; x++) {
      const h = d.hucreler[y * d.w + x];
      if (h.delik || h.icerik?.tur !== 'kova') continue;
      if (y > 0) k[(y - 1) * d.w + x] = 1;
      if (y < d.h - 1) k[(y + 1) * d.w + x] = 1;
      if (x > 0) k[y * d.w + x - 1] = 1;
      if (x < d.w - 1) k[y * d.w + x + 1] = 1;
    }
  }
  return k;
}

export function cozumOlustur(d: OyunDurumu): Cozum {
  const n = d.w * d.h;
  return {
    d,
    olaylar: [],
    yigin: new MinYigin<KuyrukOgesi>(),
    sira: 0,
    planli: new Uint8Array(n),
    patladi: new Uint8Array(n),
    kalkan: kalkanHesapla(d),
    zincirVar: false,
    zincirRengi: -1,
    saat: 0,
    isiPatlamasi: 0,
    R: 0,
    patlamalar: [],
    isTemizlendi: false,
    kombo: false,
    yuklu: null,
    final: false,
  };
}

/** Bayrakları sıfırla (final turlarında yerçekiminden sonra). */
export function bayraklariSifirla(c: Cozum): void {
  c.planli.fill(0);
  c.patladi.fill(0);
  c.kalkan = kalkanHesapla(c.d);
}

/** Kuyruğa öğe ekle; anahtar (t, y, x, sıra). */
export function ekle(c: Cozum, t: number, i: number, tur: KuyrukTuru, ek: Partial<KuyrukOgesi> = {}): void {
  const x = i % c.d.w;
  const o: KuyrukOgesi = {
    t,
    y: (i - x) / c.d.w,
    x,
    sira: c.sira++,
    tur,
    i,
    nesil: 0,
    isiMiktari: 1,
    neden: 'vurus',
    k: 0,
    yukle: false,
    kombo: false,
    iz: -1,
    izSira: -1,
    yon: 0,
    yaricap: 0,
    ozel: 'yok',
    eksen: 0,
    ...ek,
  };
  c.yigin.ekle(o);
}

/** Hücre indeksinden yeni bir Konum nesnesi (olaylar paylaşılmış nesne taşımaz). */
export function kon(d: { w: number }, i: number): Konum {
  const x = i % d.w;
  return { x, y: (i - x) / d.w };
}

/** Patlama dışı puan ekle ve `puanEklendi` yaz (§7.1). */
export function puanEkle(c: Cozum, t: number, miktar: number, neden: 'reaksiyon' | 'halka' | 'kalanHamle' | 'diger', hucreIdx = -1): void {
  if (miktar === 0) return;
  c.d.puan += miktar;
  const o: Olay = { t, tur: 'puanEklendi', miktar, neden };
  if (hucreIdx >= 0) o.hucre = kon(c.d, hucreIdx);
  c.olaylar.push(o);
}
