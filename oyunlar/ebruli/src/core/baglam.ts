/**
 * Çözümleme bağlamı (GDD §4): bir eylemin (hamle, Ebru Şöleni, Usta'nın Eli)
 * süresince değişen durum kopyası, olay listesi, zaman imleci (tik), adım
 * tamponu ve temizlik yardımcıları. Yalnız çekirdek içinde kullanılır.
 *
 * Adım tamponu: bir temizlik adımının olayları (grup + özel taş zinciri)
 * işlenme sırasıyla tampona yazılır, adım sonunda `t`'ye göre KARARLI
 * sıralanıp listeye eklenir. Sıralamanın tahta etkisini bozmaması için:
 *  - durum, olay işlendiği anda değişir; ateşlemeler artan `t` sırasıyla
 *    işlenir ve her ateşlemenin olayları kendi `t`'sinden sonradır;
 *  - aynı hücreye ait olaylar artan zamandadır (temizlendi → zemin
 *    olayları aynı t'de, ardından en erken +zincir'de ozelTetiklendi);
 *  - hedef ilerlemesi (`hedefIlerledi`) sıralamadan SONRA eklenir (hedef.ts).
 */
import { PUAN, ZAMAN } from './sabitler';
import { damla } from './tahta';
import type { Damla, KomboTuru, Konum, Olay, OyunDurumu, OzelTur, Renk, TemizlikNedeni, Yon } from './types';

type DagitOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Olayın `t`'siz gövdesi. */
export type OlayGovdesi = DagitOmit<Olay, 't'>;

/** Ateşleme kuyruğu öğesi (§4.4 BFS; zaman sıralı). */
export interface Atesleme {
  /** Etkinin merkezi (hücre indeksi). */
  hucre: number;
  /** Ateşlenen taş ya da birleşim. */
  ozel: Exclude<OzelTur, 'yok'> | 'birlesim';
  /** Taşın rengi (birleşimde Tarak/Girdap rengi; yoksa 0). */
  renk: Renk | 0;
  /** Tarak yönü (birleşimde tarağın yönü). */
  yon: Yon;
  /** Taşın kimliği (yerinde ateşlemede taş hâlâ orada mı denetimi). */
  id: number;
  /** Ateşleme anı (tik). */
  t: number;
  /** Eşit t'de ekleniş sırası. */
  sira: number;
  /**
   * Taş ateşleme anında hâlâ tahtadaysa bu nedenle kaldırılır (yerinde
   * ateşleme: Lale/Mürekkep sürüklemesi, ters sürükleme, gruba komşu
   * Mürekkep, şölen ve birleşim tarakları). null: taş zaten kalktı (grupla,
   * alanla ya da `ozelSuruklendi{tasindi}` ile).
   */
  kaldir: TemizlikNedeni | null;
  /** Alanın temizlik nedeni. */
  neden: TemizlikNedeni;
  /** Lale: temizlenecek renk (yoksa ateşleme anında en bol renk). */
  hedefRenk?: Renk;
  kombo?: KomboTuru;
}

export class Baglam {
  olaylar: Olay[] = [];
  /** Zaman imleci (tik): sıradaki aşamanın başlangıcı. */
  t = 0;
  /** Bu hamlenin karışımıyla doğan damla (özel taş yeri, §5.1). */
  yeniId: number | null = null;
  /** Hamlenin ekseni (2×2 tarağın yönü, §5.1). */
  hamleYonu: Yon = 'yatay';
  /** Şu anki temizlik adımı (1 tabanlı). */
  k = 1;
  /** Eylemde temizlenen damla (hamleOzeti). */
  temizlenen = 0;
  eslesme = false;
  enBuyukK = 0;
  sx = 0;
  sy = 0;
  /** Adımın canlandırma sonu (özel taş süreleri). */
  son = 0;
  readonly alinan: Uint8Array;
  readonly alanHasari: Uint8Array;
  readonly kuyruk: Atesleme[] = [];
  private tampon: Olay[] | null = null;
  private siraNo = 0;

  constructor(
    readonly d: OyunDurumu,
    /** Önizleme kipi: dolum yok (§3.5). */
    readonly dogumsuz: boolean,
    /** Temizlik günlüğü için hamle sırası (0 tabanlı; şölen −1). */
    readonly hamleIndeksi: number,
  ) {
    const n = d.w * d.h;
    this.alinan = new Uint8Array(n);
    this.alanHasari = new Uint8Array(n);
  }

  K(i: number): Konum {
    const x = i % this.d.w;
    return { x, y: (i - x) / this.d.w };
  }

  ekle(t: number, govde: OlayGovdesi): void {
    const o = { t, ...govde } as Olay;
    if (this.tampon) {
      this.tampon.push(o);
      return;
    }
    const son = this.olaylar.length ? this.olaylar[this.olaylar.length - 1].t : 0;
    if (o.t < son) o.t = son;
    this.olaylar.push(o);
  }

  adimBasla(k: number): void {
    this.k = k;
    this.alinan.fill(0);
    this.alanHasari.fill(0);
    this.tampon = [];
    this.son = this.t;
  }

  adimBitir(): void {
    const tampon = this.tampon!;
    this.tampon = null;
    tampon.sort((a, b) => a.t - b.t); // kararlı
    let enSon = this.son;
    for (const o of tampon) {
      this.olaylar.push(o);
      if (o.t > enSon) enSon = o.t;
    }
    this.t = enSon + ZAMAN.yayilma;
  }

  puanEkle(t: number, miktar: number, neden: 'ozel' | 'engel' | 'desen' | 'solen' | 'diger', hucre?: Konum): void {
    if (miktar <= 0) return;
    this.d.puan += miktar;
    this.ekle(t, hucre ? { tur: 'puanEklendi', miktar, neden, hucre } : { tur: 'puanEklendi', miktar, neden });
  }

  /**
   * Hücredeki damlayı temizler (§4.4, §6): `temizlendi` + hemen ardından
   * zemin olayları (kâğıt, yağ, desen; puanları). Bir hücre bir adımda
   * yalnız bir kez temizlenir. Temizlenen damlayı (yoksa null) döndürür.
   */
  temizle(i: number, neden: TemizlikNedeni, t: number): Damla | null {
    if (this.alinan[i]) return null;
    const h = this.d.hucreler[i];
    const dm = damla(h);
    if (!dm) return null;
    this.alinan[i] = 1;
    h.icerik = null;
    const puan = neden === 'grup' ? PUAN.grupDamla * this.k : neden === 'murekkep' ? PUAN.murekkepDamla : PUAN.ozelDamla;
    this.d.puan += puan;
    const p = this.K(i);
    this.ekle(t, { tur: 'temizlendi', hucre: p, id: dm.id, renk: dm.renk, ozel: dm.ozel, neden, k: this.k, puan });
    this.sayKaldirilan(p);
    if (h.kagit > 0) {
      h.kagit = (h.kagit - 1) as 0 | 1;
      this.ekle(t, { tur: 'kagitAlindi', hucre: p, kalan: h.kagit as 0 | 1, renk: dm.renk });
      this.puanEkle(t, PUAN.kagitKat, 'engel', p);
    }
    if (h.yag) {
      h.yag = false;
      this.ekle(t, { tur: 'yagKalkti', hucre: p });
      this.puanEkle(t, PUAN.yag, 'engel', p);
    }
    if (h.desen && !h.desenBoyali && dm.renk === h.desen) {
      h.desenBoyali = true;
      this.ekle(t, { tur: 'desenBoyandi', hucre: p, renk: h.desen });
      this.puanEkle(t, PUAN.desen, 'desen', p);
    }
    return dm;
  }

  /** Tahtadan kalkan damla sayımı (temizlik ya da taşınıp tüketilen özel taş). */
  sayKaldirilan(p: Konum): void {
    this.temizlenen++;
    this.sx += p.x;
    this.sy += p.y;
    this.d.istatistik.temizlenenDamla++;
  }

  /**
   * Mermer hasarı (§6.2): −1 can, can başına 40 puan; 0 olunca kalkar.
   * `alan`: özel alan/patlama hasarı (adım başına en fazla bir).
   */
  mermerVur(i: number, t: number, alan: boolean): void {
    const h = this.d.hucreler[i];
    if (h.icerik?.tur !== 'mermer') return;
    if (alan) {
      if (this.alanHasari[i]) return;
      this.alanHasari[i] = 1;
    }
    const kalan = (h.icerik.can - 1) as 0 | 1 | 2;
    h.icerik = kalan <= 0 ? null : { tur: 'mermer', can: kalan as 1 | 2 };
    const p = this.K(i);
    this.ekle(t, { tur: 'mermerHasar', hucre: p, kalan });
    this.puanEkle(t, PUAN.mermerCan, 'engel', p);
  }

  /** Ateşleme kuyruğuna ekler (zaman, sonra ekleniş sırasıyla işlenir). */
  kuyrugaEkle(a: Omit<Atesleme, 'sira'>): void {
    const o: Atesleme = { ...a, sira: this.siraNo++ };
    // Sıralı ekleme (kuyruk küçük).
    let k = this.kuyruk.length;
    while (k > 0 && (this.kuyruk[k - 1].t > o.t || (this.kuyruk[k - 1].t === o.t && this.kuyruk[k - 1].sira > o.sira))) k--;
    this.kuyruk.splice(k, 0, o);
  }

  /** Temizlik günlüğü kaydı (§9.1). */
  gunlukEkle(tur: 'grup' | 'tarak' | 'girdap' | 'lale' | 'murekkep' | 'birlesim', x10: number, y10: number, renk: Renk | 0, boyut: number, yon?: Yon): void {
    if (this.dogumsuz) return;
    const kayit = { hamle: this.hamleIndeksi, k: this.k, tur, x10, y10, renk, boyut } as OyunDurumu['gunluk'][number];
    if (yon) kayit.yon = yon;
    this.d.gunluk.push(kayit);
  }
}

/** Tamsayı yuvarlamalı bölme (b > 0). */
export function yuvarlaBol(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}
