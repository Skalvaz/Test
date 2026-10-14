/**
 * Ses havuzu (GDD §12.3) — saf, testli.
 *
 *  - En fazla 24 eşzamanlı ses; doluysa EN ESKİ ses susturulup yeri açılır.
 *  - 15 ms içinde gelen aynı tür pop'lar birleşir: yeni ses açılmaz, mevcut
 *    sesin kazancı %20 artar (en fazla 1,6×).
 *
 * Zaman saniyedir (AudioContext saati). `T` WebAudio düğümlerini taşır; havuz
 * yalnız zaman ve tür bilgisine bakar.
 */
export const HAVUZ_BOYUTU = 24;
export const BIRLESME_PENCERESI = 0.015;
export const BIRLESME_ARTISI = 1.2;
export const BIRLESME_SINIRI = 1.6;

export interface HavuzSesi<T> {
  tur: string;
  /** Başlangıç (s). */
  bas: number;
  /** Bitiş (s): bundan sonra ses biter, havuzdan düşer. */
  bit: number;
  /** Birleşme kazancı (1..1,6). */
  carpan: number;
  veri: T;
}

export class SesHavuzu<T> {
  readonly sesler: HavuzSesi<T>[] = [];
  constructor(
    readonly boyut = HAVUZ_BOYUTU,
    /** Havuzdan düşen (biten ya da çalınan) ses için. */
    private readonly birak: (s: HavuzSesi<T>, calindi: boolean, simdi: number) => void = () => {},
  ) {}

  /** Bitmiş sesleri düşürür. */
  temizle(simdi: number): void {
    for (let i = this.sesler.length - 1; i >= 0; i--) {
      const s = this.sesler[i];
      if (s.bit <= simdi) {
        this.sesler.splice(i, 1);
        this.birak(s, false, simdi);
      }
    }
  }

  /**
   * Aynı türde, başlangıcı `bas`a `pencere` saniyeden yakın ses varsa onu
   * güçlendirip döndürür (yeni ses açılmamalı); yoksa null.
   */
  birlestir(tur: string, bas: number, pencere = BIRLESME_PENCERESI): HavuzSesi<T> | null {
    let en: HavuzSesi<T> | null = null;
    for (const s of this.sesler) {
      if (s.tur !== tur || Math.abs(s.bas - bas) > pencere) continue;
      if (!en || s.bas > en.bas) en = s;
    }
    if (!en) return null;
    en.carpan = Math.min(BIRLESME_SINIRI, en.carpan * BIRLESME_ARTISI);
    return en;
  }

  /** Yeni ses ekler; havuz doluysa en eski ses çalınır (susturulur). */
  ekle(tur: string, bas: number, bit: number, veri: T, simdi: number): HavuzSesi<T> {
    this.temizle(simdi);
    while (this.sesler.length >= this.boyut) {
      let ei = 0;
      for (let i = 1; i < this.sesler.length; i++) if (this.sesler[i].bas < this.sesler[ei].bas) ei = i;
      const [eski] = this.sesler.splice(ei, 1);
      this.birak(eski, true, simdi);
    }
    const s: HavuzSesi<T> = { tur, bas, bit, carpan: 1, veri };
    this.sesler.push(s);
    return s;
  }

  get sayi(): number {
    return this.sesler.length;
  }

  /** Hepsini bırakır (bağlam kapanırken). */
  bosalt(simdi: number): void {
    for (const s of this.sesler.splice(0)) this.birak(s, true, simdi);
  }
}
