/**
 * BARUT simülasyonu: helikopter, siper, düşman dalgaları, mermiler,
 * patlamalar, çöp adam (bez bebek) fiziği, yıkılan zemin.
 * Çizim ve ses bilmez; olanları `olaylar` kuyruğuna yazar. Rastgelelik
 * tohumlu, adım sabit (1/60 s).
 */

export const G = 240; // ekran genişliği (mantıksal piksel)
/**
 * İKİ CEPHE: siper dünyanın ortasında, düşman iki yandan gelir. Bir birliğin
 * hangi yandan geldiği konumundan okunur (`yanOf`): siperi geçemedikleri için
 * yan hiç değişmez. Yan +1 = sağ (sola yürür), −1 = sol (sağa yürür).
 */
export const DUNYA_G = 960;
/** Siperin ortası. */
export const SIPER_X = 480;
/** Siperin yarı genişliği: ön kenarlar `SIPER_X ± SIPER_YARI`. */
export const SIPER_YARI = 60;
const SIPER_SOL = SIPER_X - SIPER_YARI;
const SIPER_SAG = SIPER_X + SIPER_YARI;
/** Kamera doğum şeritlerini göstermez. */
const KAM_SOL = 44;
const KAM_SAG = DUNYA_G - G - 44;
/** Kenara bundan yakın düşman henüz sahneye girmemiştir: hedef alınmaz, vurulmaz. */
const GIRIS = 62;
/** Helikopter kenarlara bu kadar yaklaşabilir (kullanıcı: "sağa sola daha çok gidilebilsin"; eskiden 215). */
const HELI_KENAR = 96;

/** Birliğin geldiği yan: +1 sağ, −1 sol. */
export const yanOf = (x: number): 1 | -1 => (x > SIPER_X ? 1 : -1);
/** Siperin o yandaki ön kenarına uzaklık (içerideyse eksi). */
export const onMesafe = (x: number): number => (x > SIPER_X ? x - SIPER_SAG : SIPER_SOL - x);
const sahnede = (x: number): boolean => x >= GIRIS && x <= DUNYA_G - GIRIS;

export const T_TUFEK = 0;
export const T_ROKET = 1;
export const T_KAMYON = 2;
export const T_TANK = 3;
export const T_UCAKSAVAR = 4;
export const T_HELI = 5;
export const T_JET = 6;
export const T_NAKLIYE = 7;
/** Piyade çeşitleri (tüfekçi ve roketçiye ek). */
export const T_MAKINELI = 8;
export const T_NISANCI = 9;
export const T_SUBAY = 10;
/** Köprü seren zırhlı: çukur başında durup köprü kurar. */
export const T_KOPRUCU = 11;
/** Makineli cip: hızlıdır, sipere sokulup seri atar; öbür cephedeyken geri dönmeye zorlar. */
export const T_JEEP = 12;

export const piyadeMi = (tip: number): boolean => tip === T_TUFEK || tip === T_ROKET || (tip >= T_MAKINELI && tip <= T_SUBAY);

const PUAN = [10, 20, 50, 100, 80, 150, 200, 0, 25, 45, 60, 120, 70];

// Asker durumları
export const KOS = 0;
export const NISAN = 1;
export const PANIK = 2;
export const YANIYOR = 3;

// Mermi tipleri
export const M_KURSUN = 0;
export const M_ROKET = 1;
export const M_DKURSUN = 2;
export const M_DRPG = 3;
export const M_TOP = 4;
export const M_HAVAN = 5;
export const M_BOMBA = 6;
/** Oyuncunun elle bıraktığı bomba: toprağı derin oyar. */
export const M_OBOMBA = 7;
/** Keskin nişancı mermisi: hızlı, kaçması zor; önceden lazer çizgisiyle haber verir. */
export const M_NISANCI = 8;

// Sandık (ödül) tipleri
export const O_TAMIR = 0;
export const O_CIFT = 1;
export const O_HIZ = 2;
export const O_BOMBA = 3;

// Toprağa gömülü şeyler
export const G_MAYIN = 0;
export const G_SANDIK = 1;

// Parça tipleri
export const P_KAN = 0;
export const P_DUMAN = 1;
export const P_ATES = 2;
export const P_KIVILCIM = 3;
export const P_TOPRAK = 4;
export const P_ENKAZ = 5;
export const P_KOVAN = 6;
export const P_TOZ = 7;
export const P_KULE = 8;
export const P_KASK = 9;
export const P_TUGLA = 10;

/** Yıkılabilir binaların hücre boyu (dünya birimi). */
export const HUCRE = 4;
// Bina hücreleri
/** Yol kenarında araba hurdası duran yerler: zemin burada düzlenir (çizim `sahne.ts` SUSLER). */
export const PARK_X = [240, 710];
export const B_DUVAR = 1;
export const B_PENCERE = 2;
export const B_CATI = 3;
export const B_KAPI = 4;
export const B_MOLOZ = 5;

export interface Asker {
  x: number;
  y: number;
  tip: number;
  dost: boolean;
  durum: number;
  t: number;
  faz: number;
  sayac: number;
  hiz: number;
  menzil: number;
  nisanAci: number;
  /** Roketçi: 1 helikoptere, 2 sipere nişan alıyor. */
  hedef: number;
  yon: 1 | -1;
  /** Görünüş tohumu: başlık, çanta, atkı (çizim buna bakar). */
  kilik: number;
  /** Yerden yükseklik (gözetleme kulesindeki nöbetçi). */
  yukseklik: number;
  /** Seri atış sayacı (makineli) ya da nişan durumu (keskin nişancı: 1 = nişan alıyor). */
  seri: number;
  /** Önü derin çukur ya da duvar: yürüyemiyor, köprü bekliyor. */
  engelli: boolean;
  /** Dostlarda görev: 0 tüfekçi, 1 makineli yuvası, 2 kule nöbetçisi, 3 subay. */
  rol: number;
  /** > 0 iken namlu alevi görünür. */
  atis: number;
}

export interface Arac {
  tip: number;
  x: number;
  y: number;
  can: number;
  enCan: number;
  dur: number;
  sayac: number;
  nisanT: number;
  namlu: number;
  yuk: number;
  t: number;
  sars: number;
  /** Önünde aşamadığı çukur ya da yamaç var: bekliyor. */
  engelli: boolean;
}

/** Köprücünün serdiği köprü: araçlar ve askerler üstünden geçer; patlamayla çöker. */
export interface Kopru {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  can: number;
  /** Açılma: 0 → 1; 1 olunca geçilebilir. */
  t: number;
  /** Köprücünün durduğu uç: +1 ise x1 (sağ), −1 ise x0 (sol). Köprü oradan açılır. */
  kok: 1 | -1;
}

/**
 * Yıkılabilir küçük bina: hücre ızgarası (satır 0 en altta). Patlama hücreleri
 * yok eder, üstte kalanlar aşağı çöker. İçindeki askerler pencerelerden ateş eder.
 */
export interface Bina {
  x: number;
  /** 0 ev, 1 dükkân, 2 atölye (çizimdeki deriyi seçer). */
  tur: number;
  sutun: number;
  satir: number;
  h: Uint8Array;
  /** Düşmekte olan hücrenin yerine varana kadarki yüksekliği. */
  dy: Float32Array;
  vy: Float32Array;
  /** İçerideki asker sayısı. Bina boş kurulur; sahadan gelen askerler kapıdan girer. */
  asker: number;
  /** Kapının bina soluna uzaklığı (dünya birimi). */
  kapi: number;
  sayac: number;
  ilk: number;
  /** Son atış yapılan pencere ve namlu alevi süresi. */
  atisHucre: number;
  atisT: number;
  /** Her sütunun kurulduğu andaki zemin kotu: zemin oynarsa sütun moloza döner. */
  kot: Float32Array;
}

export interface Hava {
  tip: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  can: number;
  dusuyor: boolean;
  t: number;
  yon: 1 | -1;
  aci: number;
  sayac: number;
  seri: number;
  birakX: number;
  yuk: number;
}

export interface Mermi {
  tip: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  omur: number;
  yas: number;
  hedef: Arac | Hava | null;
}

/** Bez bebek: 0 baş, 1 boyun, 2 kalça, 3-4 eller, 5-6 ayaklar. */
export interface Bez {
  x: Float32Array;
  y: Float32Array;
  px: Float32Array;
  py: Float32Array;
  /** Sağlam bağların bit maskesi (BAGLAR sırasıyla). */
  bag: number;
  t: number;
  kan: number;
  yanik: boolean;
  uyku: boolean;
  dost: boolean;
}
export const BAGLAR: [number, number, number][] = [
  [0, 1, 3],
  [1, 2, 6],
  [1, 3, 6],
  [1, 4, 6],
  [2, 5, 7],
  [2, 6, 7],
];

export interface Parca {
  tip: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  omur: number;
  omur0: number;
  boy: number;
  aci: number;
  donus: number;
}

export interface Patlama {
  x: number;
  y: number;
  r: number;
  t: number;
}

export interface Flak {
  x: number;
  y: number;
  t: number;
}

export interface Sandik {
  x: number;
  y: number;
  vy: number;
  yerde: number;
  /** O_TAMIR, O_CIFT, O_HIZ, O_BOMBA */
  tip: number;
  parasut: boolean;
  /** Helikopter üstünde: halatla yukarı çekiliyor. */
  cekiliyor: boolean;
}

/** Toprağın altında bekleyen mayın ya da sandık; üstü kazılınca ortaya çıkar. */
export interface Gomu {
  x: number;
  y: number;
  tip: number;
  /** < 0: gömülü. ≥ 0: mayının fitili yanıyor (saniye). */
  fitil: number;
}

export interface Enkaz {
  tip: number;
  x: number;
  y: number;
  t: number;
  aci: number;
}

export interface Iz {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
}

export interface Soz {
  metin: string;
  x: number;
  y: number;
  t: number;
  vurgu: boolean;
}

export type Olay =
  | { tip: 'ates' }
  | { tip: 'roket' }
  | { tip: 'patlama'; r: number }
  | { tip: 'isabet' }
  | { tip: 'olum' }
  | { tip: 'tufek' }
  | { tip: 'top' }
  | { tip: 'dalga'; no: number; yan: -1 | 0 | 1 }
  | { tip: 'dalgaBitti' }
  | { tip: 'uyari' }
  | { tip: 'jet' }
  | { tip: 'sandik' }
  | { tip: 'bomba' }
  | { tip: 'mayin' }
  | { tip: 'cokus' }
  | { tip: 'bitti' };

export function rng32(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sinirla = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

// Dalga içeriği: tüfek, roketçi, kamyon, tank, uçaksavar, helikopter, jet
const DALGALAR: number[][] = [
  [14, 0, 0, 0, 0, 0, 0],
  [16, 3, 1, 0, 0, 0, 0],
  [18, 3, 1, 1, 0, 0, 1],
  [20, 4, 2, 1, 1, 1, 1],
  [22, 5, 2, 2, 1, 1, 1],
  [24, 6, 2, 2, 2, 2, 2],
  [26, 6, 3, 3, 2, 2, 2],
  [30, 8, 3, 3, 2, 3, 3],
];

const PANIK_SOZ = ['KAÇ!', 'ANNE!', 'YAT!', 'HELİKOPTER!', 'BEN GELMEDİM!', 'İZNE ÇIKACAKTIM!'];
const YANIK_SOZ = ['YANIYORUM!', 'SU!', 'AAAH!'];

export class Dunya {
  readonly zemin: number;
  yer: Float32Array;
  kanIz: Uint8Array;
  is: Uint8Array;
  /** Leş yığını izi: ceset ve hurdanın zemine karıştığı yerler (doku için). */
  les: Uint8Array;
  rng: () => number;

  zaman = 0;
  oyunda = false;
  bitti = false;
  bitisNeden: '' | 'heli' | 'siper' = '';
  private bitisSayac = 0;

  heli = {
    x: SIPER_X, y: 0, vx: 0, vy: 0, hx: SIPER_X, hy: 0, egim: 0, yon: 1 as 1 | -1, can: 100,
    top: 0, roket: 0, roketYan: 1, olu: false, patladi: false, donus: 0, darbe: 0, namlu: 0,
  };
  siperCan = 100;
  /** `oran`: helikopterin ekrandaki yeri (0 sol … 1 sağ); bulunduğu cepheye göre yavaşça kayar. */
  kam = { x: SIPER_X - G / 2, oran: 0.5 };

  askerler: Asker[] = [];
  araclar: Arac[] = [];
  havalar: Hava[] = [];
  mermiler: Mermi[] = [];
  bezler: Bez[] = [];
  parcalar: Parca[] = [];
  patlamalar: Patlama[] = [];
  flaklar: Flak[] = [];
  sandiklar: Sandik[] = [];
  gomuler: Gomu[] = [];
  kopruler: Kopru[] = [];
  binalar: Bina[] = [];
  /** Köprücü sayacı ve çukur başında bekleyen asker: [sol cephe, sağ cephe]. */
  private kopruSayac = [6, 6];
  private askerBekliyor = [false, false];
  /** Elle bırakılan bombalar: `dolum` dolunca bir tane eklenir. */
  bomba = { adet: 3, enCok: 3, dolum: 0 };
  /** Süreli güçlendirmeler (kalan saniye). */
  guc = { cift: 0, hiz: 0, bomba: 0 };
  enkazlar: Enkaz[] = [];
  izler: Iz[] = [];
  sozler: Soz[] = [];
  olaylar: Olay[] = [];

  skor = 0;
  seri = 0;
  seriT = 0;
  dalga = 0;
  private kuyruk: { tip: number; yan: 1 | -1 }[] = [];
  private dogumSayac = 0;
  private dogumAra = 1;
  /** Dalgalar arası dinlenme; > 0 iken yeni dalga beklenir. */
  ara = 2.2;
  private dalgaT = 0;
  olu = { piyade: 0, arac: 0, hava: 0 };

  sarsinti = 0;
  parla = 0;
  jetUyari = 0;
  jetUyariY = 0;
  /** Uçağın geldiği yan (uyarı o kenarda çıkar). */
  jetUyariYan: 1 | -1 = 1;
  private sozSayac = 0;
  private kanSayac = 0;

  constructor(
    public readonly yuk: number,
    tohum = 1,
  ) {
    this.rng = rng32(tohum);
    // Toprak kesiti ekranın alt %30'u: derin kazılabilir
    this.zemin = Math.round(yuk * 0.7);
    const n = DUNYA_G + 1;
    this.yer = new Float32Array(n);
    this.kanIz = new Uint8Array(n);
    this.is = new Uint8Array(n);
    this.les = new Uint8Array(n);
    for (let x = 0; x < n; x++) {
      const k = sinirla(onMesafe(x) / 80, 0, 1);
      this.yer[x] = this.zemin + k * (6 * Math.sin(x * 0.013 + 1) + 3.5 * Math.sin(x * 0.041) + 1.5 * Math.sin(x * 0.11 + 2));
    }
    this.heli.y = this.heli.hy = this.zemin - 110;
    for (let i = 0; i < 10; i++) this.gomEkle(G_MAYIN);
    for (let i = 0; i < 8; i++) this.gomEkle(G_SANDIK);
    // Sol cephe: ev, dükkân. Sağ cephe: ev, atölye.
    this.binaKur(150, 0);
    this.binaKur(286, 1);
    this.binaKur(620, 0);
    this.binaKur(770, 2);
    for (const x of PARK_X) this.duzlestir(x - 16, x + 16);
    // Siperdeki dostlar: [x farkı, görev, yükseklik, baktığı yan]. Her duvarda iki
    // tüfekçi ve bir makineli; kuledeki nöbetçi iki yana da ateş eder.
    const kadro: [number, number, number, 1 | -1][] = [
      [42, 0, 6, 1], [54, 0, 6, 1], [27, 1, 0, 1], [-42, 0, 6, -1], [-54, 0, 6, -1], [-27, 1, 0, -1], [0, 2, 44, 1], [13, 3, 0, 1],
    ];
    for (const [dx, rol, yukseklik, yon] of kadro) {
      this.askerler.push({
        x: SIPER_X + dx, y: this.zemin, tip: T_TUFEK, dost: true, durum: NISAN, t: this.rng() * 5, faz: 0,
        sayac: 1 + this.rng(), hiz: 0, menzil: 0, nisanAci: yon > 0 ? -0.1 : Math.PI + 0.1, hedef: 0, yon,
        kilik: (this.rng() * 4096) | 0, yukseklik, seri: 0, rol, atis: 0, engelli: false,
      });
    }
  }

  /** Araçların ve askerlerin bastığı yükseklik: zemin ya da üstündeki köprü. */
  yolY(x: number): number {
    const g = this.yerY(x);
    for (const k of this.kopruler) {
      if (k.t < 1 || x < k.x0 || x > k.x1) continue;
      const y = k.y0 + ((k.y1 - k.y0) * (x - k.x0)) / (k.x1 - k.x0) - 1;
      if (y < g) return y;
    }
    return g;
  }

  /**
   * Yürüyen araç ya da asker için: önünde aşılmaz bir iniş (derin çukur) ya da
   * dik bir duvar var mı? Tek bomba çukuru geçilir; üst üste bombalanmış çukur
   * geçilmez. Askerler de aynı kurala uyar (kullanıcı: "askerler geçebiliyorsa
   * köprünün mantığı yok").
   */
  private engel(x: number, yon = -1): boolean {
    const simdi = this.yolY(x);
    const ileri = this.yolY(x + yon * 16);
    // İniş yalnız gerçekten çukura iniyorsa engeldir: leş yığınının öbür yüzü
    // dik olsa da düz zemine iner, oradan kayarak inilir (köprü çağırmaz).
    return (ileri - simdi > 14 && ileri > this.zemin + 18) || simdi - ileri > 34;
  }

  /** Köprücü köprüsünü serer: gidiş yönünde çukurun karşı yakasını bulur. Bulamazsa false. */
  private kopruKur(a: Arac): boolean {
    const g = -yanOf(a.x); // gidiş yönü
    const xa = Math.round(a.x + g * 5);
    const ya = this.yerY(xa);
    for (let n = 14; n < 110; n++) {
      const x = xa + g * n;
      if (onMesafe(x) < 12) break;
      if (this.yerY(x) <= ya + 6 && this.yerY(x + g * 6) <= ya + 8) {
        const xb = x + g * 3;
        const x0 = Math.min(xa, xb);
        const x1 = Math.max(xa, xb);
        this.kopruler.push({ x0, x1, y0: this.yerY(x0), y1: this.yerY(x1), can: 7, t: 0, kok: g < 0 ? 1 : -1 });
        return true;
      }
    }
    return false;
  }

  /** Köprü çöker: üstündeki araçlar ve askerler çukura düşer. */
  private kopruYik(i: number): void {
    const k = this.kopruler[i];
    this.kopruler.splice(i, 1);
    const r = this.rng;
    for (let x = k.x0; x <= k.x1; x += 4) {
      const y = k.y0 + ((k.y1 - k.y0) * (x - k.x0)) / (k.x1 - k.x0);
      this.parca(P_ENKAZ, x, y, (r() - 0.5) * 70, -30 - r() * 80, 4.5, 3.5, (r() - 0.5) * 12);
    }
    this.sozler.push({ metin: 'KÖPRÜ ÇÖKTÜ!', x: (k.x0 + k.x1) / 2, y: k.y1 - 20, t: 0, vurgu: true });
    this.olaylar.push({ tip: 'cokus' });
    for (let j = this.askerler.length - 1; j >= 0; j--) {
      const s = this.askerler[j];
      if (!s || s.dost || s.x < k.x0 || s.x > k.x1 || this.yerY(s.x) - s.y < 7) continue;
      this.oldur(j, (r() - 0.5) * 60, 40, false);
    }
    for (let j = this.araclar.length - 1; j >= 0; j--) {
      const a = this.araclar[j];
      if (!a || a.x < k.x0 + 2 || a.x > k.x1 - 2 || this.yerY(a.x) - a.y < 7) continue;
      a.y = this.yerY(a.x);
      this.aracHasar(j, 999);
    }
  }

  /** [x0, x1] arasını orta noktanın kotunda düzler; iki yanda 12 birimlik rampa bırakır. */
  private duzlestir(x0: number, x1: number): void {
    const kot = this.yerY((x0 + x1) / 2);
    for (let i = x0 - 14; i <= x1 + 14; i++) {
      if (i < 0 || i > DUNYA_G) continue;
      const k = sinirla(Math.min(i - (x0 - 14), x1 + 14 - i) / 12, 0, 1);
      this.yer[i] += (kot - this.yer[i]) * k;
    }
  }

  /**
   * Küçük bina kurar. Şablon: [sütun, satır, boş hücreler, atış pencereleri]
   * (hücre = [sütun, satır], satır 0 en altta). Ölçüler `dekor.ts`'teki
   * derilerle aynı olmalı (hücre başına 6 piksel): ev 72×60, dükkân 72×42,
   * atölye 84×48. Temelin altı düzlenir ki cephe dilim dilim kaymasın.
   */
  private binaKur(x: number, tur: number): void {
    // [sütun, satır, boş hücreler, atış pencereleri, kapının x'i]
    const SABLON: [number, number, [number, number][], [number, number][], number][] = [
      [12, 10, [[0, 9], [11, 9]], [[2, 5], [8, 5], [8, 2]], 16],
      [12, 7, [], [[2, 2], [8, 2]], 33],
      [14, 8, [[0, 7], [1, 7], [12, 7], [13, 7]], [[9, 4], [12, 4]], 39],
    ];
    const [sutun, satir, bos, pencere, kapi] = SABLON[tur];
    const h = new Uint8Array(sutun * satir).fill(B_DUVAR);
    for (const [c, r] of bos) h[r * sutun + c] = 0;
    for (const [c, r] of pencere) h[r * sutun + c] = B_PENCERE;
    this.duzlestir(x, x + sutun * HUCRE);
    this.binalar.push({
      x, tur, sutun, satir, h, dy: new Float32Array(sutun * satir), vy: new Float32Array(sutun * satir),
      asker: 0, kapi, sayac: 2 + this.rng() * 2, ilk: h.reduce((n, v) => n + (v ? 1 : 0), 0), atisHucre: -1, atisT: 0,
      kot: Float32Array.from({ length: sutun }, (_, c) => this.yerY(x + (c + 0.5) * HUCRE)),
    });
  }

  /**
   * Koşan asker bir binanın kapısındaysa ve bina uygunsa içeri girer (en çok
   * 3 kişi; bina yarıdan çok ayaktaysa ve atış penceresi kaldıysa). Her
   * asker her bina için bir kez karar verir (kılığından): %45'i girer.
   * Kullanıcı isteği: "binalarda ilk başta asker olmasın, sahadan gelenler
   * girsin de öyle yıkılsın."
   */
  private binayaGir(s: Asker): boolean {
    if (s.tip !== T_TUFEK && s.tip !== T_MAKINELI) return false;
    for (let n = 0; n < this.binalar.length; n++) {
      const b = this.binalar[n];
      if (b.asker >= 3 || Math.abs(s.x - (b.x + b.kapi)) > 1.2) continue;
      if ((s.kilik * 7 + n * 13) % 20 >= 9) continue;
      let ayakta = 0;
      let pencere = 0;
      for (const v of b.h) {
        if (v && v !== B_MOLOZ) ayakta++;
        if (v === B_PENCERE) pencere++;
      }
      if (pencere === 0 || ayakta < b.ilk * 0.6) continue;
      b.asker++;
      b.sayac = Math.min(b.sayac, 1.2);
      this.parca(P_TOZ, s.x, s.y - 4, 0, -6, 0.5, 3);
      return true;
    }
    return false;
  }

  /** (x, y) bir binanın ayakta duran hücresinin içinde mi? */
  private binaCarp(x: number, y: number): boolean {
    for (const b of this.binalar) {
      const c = Math.floor((x - b.x) / HUCRE);
      if (c < 0 || c >= b.sutun) continue;
      const taban = this.yerY(b.x + (c + 0.5) * HUCRE);
      const r = Math.floor((taban - y) / HUCRE);
      if (r >= 0 && r < b.satir && b.h[r * b.sutun + c]) return true;
    }
    return false;
  }

  /** Patlama binaların yakın hücrelerini yok eder; üsttekiler çöker. */
  private binaHasar(x: number, y: number, r: number): void {
    const etki = r * 0.45 + 2;
    const rr = this.rng;
    for (const b of this.binalar) {
      if (x < b.x - etki || x > b.x + b.sutun * HUCRE + etki) continue;
      let degisti = false;
      for (let c = 0; c < b.sutun; c++) {
        const cx = b.x + (c + 0.5) * HUCRE;
        if (Math.abs(cx - x) > etki) continue;
        const taban = this.yerY(cx);
        for (let k = 0; k < b.satir; k++) {
          const i = k * b.sutun + c;
          if (!b.h[i]) continue;
          const cy = taban - (k + 0.5) * HUCRE - b.dy[i];
          if (Math.hypot(cx - x, cy - y) >= etki) continue;
          b.h[i] = 0;
          b.dy[i] = 0;
          degisti = true;
          if (rr() < 0.75) this.parca(P_TUGLA, cx, cy, (cx - x) * 7 + (rr() - 0.5) * 70, -50 - rr() * 110, 4, 1.5, (rr() - 0.5) * 14);
        }
      }
      if (!degisti) continue;
      this.sac(P_TOZ, x, y, 5, 40, 0.9, 5);
      // Sütunları aşağı sıkıştır: altı boşalan hücre düşer ve moloza döner
      let canli = 0;
      for (let c = 0; c < b.sutun; c++) {
        let w = 0;
        for (let k = 0; k < b.satir; k++) {
          const i = k * b.sutun + c;
          if (!b.h[i]) continue;
          if (k !== w) {
            const j = w * b.sutun + c;
            b.h[j] = B_MOLOZ;
            b.dy[j] = (k - w) * HUCRE + b.dy[i];
            b.vy[j] = b.vy[i];
            b.h[i] = 0;
            b.dy[i] = 0;
            b.vy[i] = 0;
          }
          w++;
          canli++;
        }
      }
      if (b.asker > 0 && canli < b.ilk * 0.45) {
        // İçindekiler enkazla birlikte savrulur
        for (let k = 0; k < b.asker; k++) {
          this.askerEkle(T_TUFEK, b.x + (0.2 + rr() * 0.6) * b.sutun * HUCRE);
          this.oldur(this.askerler.length - 1, (rr() - 0.5) * 220, -160 - rr() * 140, true);
        }
        b.asker = 0;
        const mx = b.x + (b.sutun * HUCRE) / 2;
        this.sozler.push({ metin: 'BİNA ÇÖKTÜ!', x: mx, y: this.yerY(mx) - b.satir * HUCRE - 8, t: 0, vurgu: false });
        this.olaylar.push({ tip: 'cokus' });
        if (rr() < 0.5) this.sandiklar.push({ x: mx, y: this.yerY(mx) - 14, vy: -120, yerde: 0, tip: 1 + ((rr() * 3) | 0), parasut: false, cekiliyor: false });
      }
    }
  }

  private binaAdim(dt: number): void {
    const r = this.rng;
    const h = this.heli;
    for (const b of this.binalar) {
      if (b.atisT > 0) b.atisT -= dt;
      // Altı oyulan (ya da leş yığınıyla kalkan) sütun bütün kalamaz: moloza döner.
      // Yoksa cephe dilim dilim kayar (tabela, vitrin birbirinden kopuk görünüyordu).
      for (let c = 0; c < b.sutun; c++) {
        if (Math.abs(this.yerY(b.x + (c + 0.5) * HUCRE) - b.kot[c]) < 2.5) continue;
        b.kot[c] = 1e9;
        for (let k = 0; k < b.satir; k++) if (b.h[k * b.sutun + c]) b.h[k * b.sutun + c] = B_MOLOZ;
      }
      for (let i = 0; i < b.h.length; i++) {
        if (b.dy[i] <= 0) continue;
        b.vy[i] += 260 * dt;
        b.dy[i] -= b.vy[i] * dt;
        if (b.dy[i] <= 0) {
          b.dy[i] = 0;
          b.vy[i] = 0;
          if (r() < 0.25) {
            const c = i % b.sutun;
            const cx = b.x + (c + 0.5) * HUCRE;
            this.parca(P_TOZ, cx, this.yerY(cx) - Math.floor(i / b.sutun) * HUCRE, 0, -6, 0.6, 3);
          }
        }
      }
      if (b.asker <= 0 || !this.oyunda || this.bitisNeden || h.olu) continue;
      b.sayac -= dt;
      if (b.sayac > 0) continue;
      b.sayac = 1.7 / b.asker + r() * 0.9;
      // Ayakta kalan pencerelerden birinden ateş
      let secilen = -1;
      let say = 0;
      for (let i = 0; i < b.h.length; i++) {
        if (b.h[i] === B_PENCERE && b.dy[i] === 0 && r() < 1 / ++say) secilen = i;
      }
      if (secilen < 0) continue;
      const cx = b.x + ((secilen % b.sutun) + 0.5) * HUCRE;
      const cy = this.yerY(cx) - (Math.floor(secilen / b.sutun) + 0.5) * HUCRE;
      if (Math.hypot(h.x - cx, h.y - cy) > 150) continue;
      const aci = Math.atan2(h.y + h.vy * 0.4 - cy, h.x + h.vx * 0.4 - cx) + (r() - 0.5) * 0.2;
      this.mermiler.push({ tip: M_DKURSUN, x: cx, y: cy, vx: Math.cos(aci) * 150, vy: Math.sin(aci) * 150, omur: 1.5, yas: 0, hedef: null });
      this.olaylar.push({ tip: 'tufek' });
      b.atisHucre = secilen;
      b.atisT = 0.09;
    }
    for (const k of this.kopruler) if (k.t < 1) k.t = Math.min(1, k.t + dt / 1.2);
  }

  /** Toprağa bir mayın ya da sandık gömer (ötekilerden uzak bir yere). */
  private gomEkle(tip: number): void {
    const r = this.rng;
    for (let deneme = 0; deneme < 12; deneme++) {
      // İki cepheye eşit dağılır; siperin dibine ve doğum şeridine gömülmez
      const uzak = 46 + r() * (SIPER_SOL - 150);
      const x = Math.round(r() < 0.5 ? SIPER_SAG + uzak : SIPER_SOL - uzak);
      // Derinlik çeşitli: sığ olanı 1–2 bomba açar, derindeki emek ister
      const derin = tip === G_MAYIN ? 15 + r() * r() * 60 : 11 + r() * r() * 56;
      if (this.gomuler.some((g) => Math.abs(g.x - x) < 22 && Math.abs(g.y - (this.yerY(x) + derin)) < 18)) continue;
      if (this.yerY(x) > this.zemin + 8) continue; // zaten oyulmuş yer
      this.gomuler.push({ x, y: this.yerY(x) + derin, tip, fitil: -1 });
      return;
    }
  }

  /** Üstü yeterince kazılan gömüler ortaya çıkar: mayının fitili yanar, sandık fırlar. */
  private gomuKontrol(): void {
    for (let i = this.gomuler.length - 1; i >= 0; i--) {
      const g = this.gomuler[i];
      if (g.fitil >= 0 || this.yerY(g.x) < g.y - 5) continue;
      if (g.tip === G_MAYIN) {
        g.fitil = 0.4;
      } else {
        this.gomuler.splice(i, 1);
        this.sandiklar.push({ x: g.x, y: this.yerY(g.x) - 7, vy: -105, yerde: 0, tip: 1 + ((this.rng() * 3) | 0), parasut: false, cekiliyor: false });
        this.sac(P_TOPRAK, g.x, this.yerY(g.x) - 2, 10, 90, 0.8, 1, 90);
        this.sozler.push({ metin: 'SANDIK! ÜSTÜNE UÇ', x: g.x, y: this.yerY(g.x) - 26, t: 0, vurgu: false });
      }
    }
  }

  /** Elle bomba bırak. */
  bombaBirak(): boolean {
    const h = this.heli;
    if (!this.oyunda || this.bitti || this.bitisNeden || h.olu || this.bomba.adet <= 0) return false;
    this.bomba.adet--;
    this.mermiler.push({ tip: M_OBOMBA, x: h.x, y: h.y + 9, vx: h.vx * 0.55, vy: 40, omur: 6, yas: 0, hedef: null });
    this.olaylar.push({ tip: 'bomba' });
    return true;
  }

  yerY(x: number): number {
    const i = x < 0 ? 0 : x > DUNYA_G ? DUNYA_G : Math.round(x);
    return this.yer[i];
  }

  basla(): void {
    this.oyunda = true;
  }

  /** Parmak hareketi: helikopterin hedefini kaydırır (parmağın altında kalmasın diye göreli). */
  surukle(dx: number, dy: number): void {
    const h = this.heli;
    h.hx = sinirla(h.hx + dx, HELI_KENAR, DUNYA_G - HELI_KENAR);
    h.hy = sinirla(h.hy + dy, 36, this.zemin - 18);
  }

  dusmanSayisi(): number {
    let n = this.araclar.length;
    for (const b of this.binalar) n += b.asker; // binaya girenler de düşman
    for (const s of this.askerler) if (!s.dost) n++;
    for (const h of this.havalar) if (h.tip !== T_NAKLIYE) n++;
    return n;
  }

  // ---- Yardımcılar ----

  private parca(tip: number, x: number, y: number, vx: number, vy: number, omur: number, boy = 1, donus = 0): void {
    if (this.parcalar.length > 900) this.parcalar.splice(0, 60);
    this.parcalar.push({ tip, x, y, vx, vy, omur, omur0: omur, boy, aci: this.rng() * 6.28, donus });
  }

  private sac(tip: number, x: number, y: number, adet: number, guc: number, omur: number, boy = 1, yukari = 0): void {
    const r = this.rng;
    for (let i = 0; i < adet; i++) {
      const a = r() * Math.PI * 2;
      const h = guc * (0.25 + r() * 0.75);
      this.parca(tip, x + (r() - 0.5) * 4, y + (r() - 0.5) * 4, Math.cos(a) * h, Math.sin(a) * h - yukari * (0.4 + r() * 0.6), omur * (0.5 + r() * 0.5), boy * (0.6 + r() * 0.6), (r() - 0.5) * 14);
    }
  }

  private bagir(x: number, y: number, metin: string, vurgu = false): void {
    if (this.sozSayac > 0 || this.sozler.length >= 3) return;
    this.sozSayac = 0.7;
    this.sozler.push({ metin, x, y, t: 0, vurgu });
  }

  private puan(tip: number, x: number, y: number): void {
    this.seri++;
    this.seriT = 2.6;
    const kat = 1 + Math.min(this.seri - 1, 20) * 0.1;
    const p = Math.round(PUAN[tip] * kat);
    this.skor += p;
    if (PUAN[tip] >= 50) this.sozler.push({ metin: `+${p}`, x, y, t: 0, vurgu: false });
  }

  private krater(x: number, r: number, derin: number, sinir = 11): void {
    const x0 = Math.max(0, Math.floor(x - r));
    const x1 = Math.min(DUNYA_G, Math.ceil(x + r));
    for (let xi = x0; xi <= x1; xi++) {
      if (onMesafe(xi) < 6) continue; // siperin altı oyulmaz
      const d = (xi - x) / r;
      const k = 1 - d * d;
      if (k <= 0) continue;
      this.yer[xi] = Math.max(this.yer[xi], Math.min(this.zemin + sinir, this.yer[xi] + derin * k));
      this.is[xi] = Math.max(this.is[xi], Math.round(255 * Math.min(1, k * 1.6)));
      this.kanIz[xi] = Math.round(this.kanIz[xi] * (1 - k * 0.8));
      this.les[xi] = Math.round(this.les[xi] * (1 - k * 0.7));
    }
    // Altı oyulan cesetler uyanır (yoksa havada asılı kalırlar)
    for (const b of this.bezler) {
      if (b.uyku && Math.abs(b.x[2] - x) < r + 10) {
        b.uyku = false;
        b.t = 0.5;
      }
    }
    this.gomuKontrol();
  }

  /** Ceset ve hurda zemine karışır: araziyi yükseltir (leş yığını). */
  private yigin(x: number, r: number, yukseklik: number): void {
    const x0 = Math.max(1, Math.floor(x - r));
    const x1 = Math.min(DUNYA_G, Math.ceil(x + r));
    if (x1 <= x0) return;
    for (let xi = x0; xi <= x1; xi++) {
      if (onMesafe(xi) < 10) continue; // siperin içine yığılmaz
      const d = (xi - x) / r;
      const k = 1 - d * d;
      if (k <= 0) continue;
      this.yer[xi] = Math.max(this.zemin - 46, this.yer[xi] - yukseklik * k);
      this.les[xi] = Math.min(255, this.les[xi] + Math.round(210 * k));
    }
    // Sivri uçları yumuşat
    let once = this.yer[x0 - 1];
    for (let xi = x0; xi < x1; xi++) {
      const simdi = this.yer[xi];
      if (onMesafe(xi) >= 10) this.yer[xi] = (once + 2 * simdi + this.yer[xi + 1]) / 4;
      once = simdi;
    }
  }

  /**
   * Patlama. `dost`: oyuncunun yaptığı (oyuncuya ve sipere zarar vermez, puan
   * getirir). `guc`: araçlara verilen hasar; düşman patlamasında helikoptere 4 katı.
   * `kazi`: toprağı derin oyar (bomba, mayın).
   */
  patlat(x: number, y: number, r: number, dost: boolean, guc: number, kazi = false): void {
    const rr = this.rng;
    this.patlamalar.push({ x, y, r, t: 0 });
    this.olaylar.push({ tip: 'patlama', r });
    this.sarsinti = Math.max(this.sarsinti, Math.min(1.4, r / 24));
    this.parla = Math.max(this.parla, Math.min(1, r / 40));
    this.sac(P_ATES, x, y, Math.round(r * 0.5), r * 2.2, 0.5, r * 0.3, r);
    this.sac(P_DUMAN, x, y, Math.round(r * 0.45), r * 1.4, 1.9, r * 0.34, r * 0.6);
    this.sac(P_KIVILCIM, x, y, Math.round(r * 0.7), r * 7, 0.7, 1, r * 3);
    const gy = this.yerY(x);
    if (y > gy - r * 0.8) {
      this.sac(P_TOPRAK, x, gy - 1, Math.round(r * 1.1), r * 5, 1.1, 1, r * 6);
      this.sac(P_TOZ, x, gy - 2, Math.round(r * 0.3), r * 1.6, 1.1, r * 0.3, r * 0.4);
      this.krater(x, r * 0.85, kazi ? r * 0.5 : r * 0.2, kazi ? 88 : 11);
    }

    for (let i = this.askerler.length - 1; i >= 0; i--) {
      const s = this.askerler[i];
      if (!s || s.dost || !sahnede(s.x)) continue;
      const dx = s.x - x;
      const dy = s.y - 7 - y;
      const d = Math.hypot(dx, dy);
      if (d < r + 3) {
        const k = 1 - d / (r + 3);
        const f = 110 + 230 * k;
        const nx = d > 0.5 ? dx / d : rr() - 0.5;
        this.oldur(i, nx * f + (rr() - 0.5) * 60, -f * (0.6 + rr() * 0.7), true);
      } else if (d < r * 2.4 && s.durum !== YANIYOR) {
        if (d < r * 1.5 && rr() < 0.4) {
          s.durum = YANIYOR;
          s.t = 0;
          s.yon = dx > 0 ? 1 : -1;
          this.bagir(s.x, s.y - 20, YANIK_SOZ[(rr() * YANIK_SOZ.length) | 0], true);
        } else if (rr() < 0.7) {
          s.durum = PANIK;
          s.t = 0;
          s.yon = dx > 0 ? 1 : -1;
          if (rr() < 0.5) this.bagir(s.x, s.y - 20, PANIK_SOZ[(rr() * PANIK_SOZ.length) | 0]);
        }
      }
    }
    for (let i = this.araclar.length - 1; i >= 0; i--) {
      const a = this.araclar[i];
      // Zincirleme patlama diziyi kısaltmış olabilir
      if (!a) continue;
      if (Math.hypot(a.x - x, a.y - 9 - y) < r + 16) this.aracHasar(i, dost ? guc : guc * 0.6);
    }
    for (const h of this.havalar) {
      if (h.tip === T_NAKLIYE || h.dusuyor) continue;
      if (Math.hypot(h.x - x, h.y - y) < r + 14) this.havaHasar(h, guc);
    }
    if (!dost) {
      const h = this.heli;
      if (!h.olu && Math.hypot(h.x - x, h.y - y) < r + 13) this.heliHasar(guc * 4);
      if (onMesafe(x) < 16 && y > this.zemin - 44) this.siperHasar(guc * 2);
    }
    this.binaHasar(x, y, r);
    for (let i = this.kopruler.length - 1; i >= 0; i--) {
      const k = this.kopruler[i];
      if (!k || k.t < 1 || guc <= 0) continue;
      const px = sinirla(x, k.x0, k.x1);
      const py = k.y0 + ((k.y1 - k.y0) * (px - k.x0)) / (k.x1 - k.x0);
      if (Math.hypot(x - px, y - py) > r + 5) continue;
      k.can -= dost ? guc : guc * 0.5;
      if (k.can <= 0) this.kopruYik(i);
    }
  }

  heliHasar(d: number): void {
    const h = this.heli;
    if (h.olu || this.bitti || !this.oyunda) return;
    h.can -= d;
    h.darbe = 0.25;
    this.sarsinti = Math.max(this.sarsinti, 0.5);
    this.olaylar.push({ tip: 'isabet' });
    this.sac(P_KIVILCIM, h.x, h.y, 6, 90, 0.4);
    if (h.can <= 0) {
      h.can = 0;
      h.olu = true;
      h.vy = -40;
      this.bitisNeden = 'heli';
      this.patlat(h.x, h.y, 16, true, 0);
    }
  }

  private siperHasar(d: number): void {
    if (this.siperCan <= 0 || !this.oyunda) return;
    this.siperCan -= d;
    if (this.siperCan <= 0) {
      this.siperCan = 0;
      this.bitisNeden = this.bitisNeden || 'siper';
      this.bitisSayac = 1.6;
      for (let k = 0; k < 5; k++) this.patlat(SIPER_X - 48 + k * 24, this.zemin - 8, 24, true, 0);
      for (let i = this.askerler.length - 1; i >= 0; i--) {
        if (this.askerler[i].dost) this.oldur(i, (this.rng() - 0.5) * 200, -260, true);
      }
    }
  }

  private aracHasar(i: number, d: number): void {
    const a = this.araclar[i];
    a.can -= d;
    a.sars = 0.14;
    if (a.can > 0) return;
    this.araclar.splice(i, 1);
    this.olu.arac++;
    this.puan(a.tip, a.x, a.y - 30);
    this.enkazlar.push({ tip: a.tip, x: a.x, y: a.y, t: 0, aci: (this.rng() - 0.5) * 0.25 });
    if (this.enkazlar.length > 7) this.enkazlar.shift();
    this.sac(P_ENKAZ, a.x, a.y - 10, 9, 190, 5, 3, 170);
    if (a.tip === T_TANK) this.parca(P_KULE, a.x, a.y - 18, (this.rng() - 0.5) * 120, -260 - this.rng() * 90, 7, 1, (this.rng() - 0.5) * 12);
    // Kamyondakiler dışarı saçılır
    for (let k = 0; k < a.yuk; k++) {
      this.askerEkle(T_TUFEK, a.x + (this.rng() - 0.5) * 20);
      this.oldur(this.askerler.length - 1, (this.rng() - 0.5) * 300, -200 - this.rng() * 160, true);
    }
    if (a.tip !== T_UCAKSAVAR && this.rng() < 0.22) {
      this.sandiklar.push({ x: a.x, y: a.y - 12, vy: -120, yerde: 0, tip: 1 + ((this.rng() * 3) | 0), parasut: false, cekiliyor: false });
    }
    this.patlat(a.x, a.y - 8, a.tip === T_JEEP ? 20 : a.tip === T_KAMYON ? 26 : 32, true, 3);
  }

  private havaHasar(h: Hava, d: number): void {
    h.can -= d;
    this.sac(P_KIVILCIM, h.x, h.y, 3, 70, 0.3);
    if (h.can > 0 || h.dusuyor) return;
    h.dusuyor = true;
    h.t = 0;
    this.olu.hava++;
    this.puan(h.tip, h.x, h.y - 16);
    this.patlat(h.x, h.y, 15, true, 0);
    if (h.tip === T_HELI) {
      h.vy = -30;
      h.vx *= 0.5;
    }
  }

  /** Askeri öldürür ve yerine bez bebek bırakır. */
  private oldur(i: number, ix: number, iy: number, patlama: boolean, yanik = false): void {
    const s = this.askerler[i];
    this.askerler.splice(i, 1);
    const r = this.rng;
    const b: Bez = {
      x: new Float32Array(7), y: new Float32Array(7), px: new Float32Array(7), py: new Float32Array(7),
      bag: 63, t: 0, kan: yanik ? 0 : 1.4, yanik, uyku: false, dost: s.dost,
    };
    const ox = [0, 0, 0, -3, 3, -2, 2];
    const oy = [-14, -11, -6, -7, -7, 0, 0];
    for (let k = 0; k < 7; k++) {
      b.x[k] = s.x + ox[k];
      b.y[k] = s.y + oy[k];
      const cev = patlama ? 70 : 25;
      b.px[k] = b.x[k] - (ix + (r() - 0.5) * cev) / 60;
      b.py[k] = b.y[k] - (iy + (r() - 0.5) * cev) / 60;
    }
    if (patlama && !yanik) {
      // Parçalanma: bağların bir kısmı kopar
      for (let k = 0; k < 6; k++) if (r() < (k === 1 ? 0.18 : 0.3)) b.bag &= ~(1 << k);
    }
    this.bezler.push(b);
    if (this.bezler.length > 44) this.bezler.shift();
    if (!yanik) this.sac(P_KAN, s.x, s.y - 8, patlama ? 16 : 9, patlama ? 150 : 80, 1.2, 1, patlama ? 110 : 50);
    // Miğfer başından fırlar
    if (!s.dost && !yanik) this.parca(P_KASK, s.x, s.y - 14, ix * 0.4 + (r() - 0.5) * 60, iy * 0.5 - 70 - r() * 60, 6, 1, (r() - 0.5) * 16);
    if (!s.dost) {
      this.olu.piyade++;
      this.puan(s.tip, s.x, s.y - 22);
      if (s.tip === T_SUBAY) {
        // Subay vurulunca çevresindekiler dağılır
        for (const o of this.askerler) {
          if (o.dost || o.durum === YANIYOR || Math.abs(o.x - s.x) > 60) continue;
          o.durum = PANIK;
          o.t = -0.8;
          o.yon = yanOf(o.x); // siperden uzağa kaçar
        }
        this.sozSayac = 0;
        this.bagir(s.x, s.y - 24, 'SUBAY VURULDU!', true);
      }
    }
    this.olaylar.push({ tip: 'olum' });
  }

  private askerEkle(tip: number, x: number): Asker {
    const r = this.rng;
    // Ağır silah taşıyan yavaş yürür; keskin nişancı uzakta mevzilenir
    const hiz = tip === T_MAKINELI ? 19 + r() * 7 : tip === T_NISANCI ? 22 + r() * 8 : tip === T_SUBAY ? 27 + r() * 6 : 25 + r() * 14;
    const s: Asker = {
      x, y: this.yerY(x), tip, dost: false, durum: KOS, t: 0, faz: r() * 6, sayac: 0.6 + r() * 1.2,
      hiz, menzil: tip === T_NISANCI ? 215 + r() * 70 : 30 + r() * 70, nisanAci: x > SIPER_X ? Math.PI : 0, hedef: 0, yon: x > SIPER_X ? -1 : 1,
      kilik: (r() * 4096) | 0, yukseklik: 0, seri: 0, rol: 0, atis: 0, engelli: false,
    };
    this.askerler.push(s);
    return s;
  }

  // ---- Adım ----

  adim(dt: number): void {
    this.zaman += dt;
    if (this.oyunda && !this.bitti) this.dalgaAdim(dt);
    this.heliAdim(dt);
    this.askerAdim(dt);
    this.aracAdim(dt);
    this.havaAdim(dt);
    this.mermiAdim(dt);
    this.flakAdim(dt);
    this.bezAdim(dt);
    this.binaAdim(dt);
    this.parcaAdim(dt);
    this.digerAdim(dt);

    const h = this.heli;
    // Kamera: helikopter ekranda bir kuşakta serbestçe gezer (parmağa bire bir
    // karşılık görünür); kuşağın dışına çıkınca kamera peşinden gelir.
    // İki cephe: helikopter siperin sağındaysa ekranın sol %36'sında durur (sağdan
    // gelen düşman görünsün), solundaysa sağ %36'sında. Geçiş helikopterin
    // yönüne değil KONUMUNA bağlı ve yavaş (yöne göre öne atlama sürüklerken
    // helikopteri ekranda geri kaydırıp "takılıyor" hissi veriyordu).
    const hedefOran = 0.5 - 0.14 * sinirla((h.x - SIPER_X) / 70, -1, 1);
    this.kam.oran += sinirla(hedefOran - this.kam.oran, -0.09 * dt, 0.09 * dt);
    const fark = h.x - G * this.kam.oran - this.kam.x;
    const BOSLUK = 16;
    if (fark > BOSLUK) this.kam.x += (fark - BOSLUK) * Math.min(1, dt * 5);
    else if (fark < -BOSLUK) this.kam.x += (fark + BOSLUK) * Math.min(1, dt * 5);
    this.kam.x = sinirla(this.kam.x, KAM_SOL, KAM_SAG);

    if (this.oyunda && !this.bitti) {
      const g = this.guc;
      if (g.cift > 0) g.cift -= dt;
      if (g.hiz > 0) g.hiz -= dt;
      if (g.bomba > 0) g.bomba -= dt;
      const b = this.bomba;
      b.enCok = g.bomba > 0 ? 6 : 3;
      if (b.adet < b.enCok) {
        b.dolum += dt / (g.bomba > 0 ? 0.9 : 2.6);
        if (b.dolum >= 1) {
          b.dolum = 0;
          b.adet++;
        }
      } else b.dolum = 0;
    }
    // Kan zamanla kurur ve silinir (yoksa birkaç dalgada bütün zemin kırmızı olur)
    this.kanSayac -= dt;
    if (this.kanSayac <= 0) {
      this.kanSayac = 0.22;
      const k = this.kanIz;
      for (let i = 0; i < k.length; i++) if (k[i] > 0) k[i]--;
    }
    if (this.sarsinti > 0) this.sarsinti = Math.max(0, this.sarsinti - dt * 3.2);
    if (this.parla > 0) this.parla = Math.max(0, this.parla - dt * 7);
    if (this.jetUyari > 0) this.jetUyari -= dt;
    if (this.sozSayac > 0) this.sozSayac -= dt;
    if (this.seriT > 0) {
      this.seriT -= dt;
      if (this.seriT <= 0) this.seri = 0;
    }
    if (this.bitisSayac > 0 && !this.bitti) {
      this.bitisSayac -= dt;
      if (this.bitisSayac <= 0) {
        this.bitti = true;
        this.olaylar.push({ tip: 'bitti' });
      }
    }
  }

  private dalgaAdim(dt: number): void {
    if (this.bitisNeden) return;
    if (this.ara > 0) {
      this.ara -= dt;
      if (this.ara <= 0) this.dalgaBaslat();
      return;
    }
    this.dalgaT += dt;
    if (this.kuyruk.length) {
      this.dogumSayac -= dt;
      if (this.dogumSayac <= 0) {
        // Piyade manga hâlinde gelir (art arda en çok 5)
        const ilk = this.kuyruk.shift()!;
        this.dogur(ilk.tip, 0, ilk.yan);
        let adet = 1;
        if (piyadeMi(ilk.tip)) {
          while (adet < 5 && this.kuyruk.length && piyadeMi(this.kuyruk[0].tip) && this.kuyruk[0].yan === ilk.yan) this.dogur(this.kuyruk.shift()!.tip, adet++, ilk.yan);
        }
        this.dogumSayac = this.dogumAra * adet * (0.6 + this.rng() * 0.8);
      }
    } else if (this.dusmanSayisi() <= 1 || this.dalgaT > 70) {
      this.ara = 4.5;
      this.olaylar.push({ tip: 'dalgaBitti' });
      this.sozler.push({ metin: 'SAĞ OL PİLOT!', x: SIPER_X, y: this.zemin - 44, t: 0, vurgu: false });
      // İkmal: hasar varsa dost uçak sandık atar
      if (this.heli.can < 80 || this.siperCan < 80) {
        this.havalar.push({
          tip: T_NAKLIYE, x: -70, y: 52, vx: 135, vy: 0, can: 99, dusuyor: false, t: 0, yon: 1, aci: 0, sayac: 0, seri: 0,
          birakX: sinirla(this.heli.x - 30, 120, DUNYA_G - 140), yuk: 1,
        });
      }
    }
  }

  private dalgaBaslat(): void {
    this.dalga++;
    this.dalgaT = 0;
    const n = this.dalga;
    const taban = DALGALAR[Math.min(n, DALGALAR.length) - 1];
    const kat = n > DALGALAR.length ? 1 + (n - DALGALAR.length) * 0.22 : 1;
    const liste: number[] = [];
    taban.forEach((adet, tip) => {
      for (let i = 0; i < Math.round(adet * kat); i++) liste.push(tip);
    });
    // Tüfekçilerin bir kısmı makineli; ilerleyen dalgalarda keskin nişancı ve subay
    if (n >= 2) {
      let makineli = Math.floor(liste.filter((t) => t === T_TUFEK).length / 6);
      for (let i = 0; i < liste.length && makineli > 0; i++) {
        if (liste[i] === T_TUFEK && i % 3 === 0) {
          liste[i] = T_MAKINELI;
          makineli--;
        }
      }
      liste.push(T_SUBAY);
      if (n >= 6) liste.push(T_SUBAY);
    }
    if (n >= 3) for (let i = 0; i < Math.min(4, 1 + Math.floor((n - 3) / 2)); i++) liste.push(T_NISANCI);
    if (n >= 3) for (let i = 0; i < Math.min(3, 1 + Math.floor((n - 3) / 3)); i++) liste.push(T_JEEP);
    // Karıştır; ilk ikisi piyade olsun
    for (let i = liste.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [liste[i], liste[j]] = [liste[j], liste[i]];
    }
    for (let k = 0; k < 2; k++) {
      const j = liste.indexOf(T_TUFEK, k);
      if (j > k) [liste[k], liste[j]] = [liste[j], liste[k]];
    }
    // Cephe: 1. dalga sağdan, 2. dalga soldan (oyuncu iki yanı da öğrensin);
    // sonrakiler iki yandan birden, 4–8'lik öbekler hâlinde yan değiştirerek.
    let yan: 1 | -1 = n === 2 ? -1 : n === 1 ? 1 : this.rng() < 0.5 ? 1 : -1;
    let kalan = 0;
    this.kuyruk = liste.map((tip) => {
      if (n >= 3 && kalan-- <= 0) {
        yan = -yan as 1 | -1;
        kalan = 3 + ((this.rng() * 5) | 0);
      }
      return { tip, yan };
    });
    this.dogumAra = sinirla(20 / liste.length, 0.32, 1.2);
    this.dogumSayac = 0.4;
    if (this.gomuler.length < 22) {
      this.gomEkle(G_MAYIN);
      if (n % 2 === 0) this.gomEkle(G_SANDIK);
    }
    this.olaylar.push({ tip: 'dalga', no: n, yan: n === 1 ? 1 : n === 2 ? -1 : 0 });
  }

  /** `yan`: +1 sağ kenardan, −1 sol kenardan girer. */
  private dogur(tip: number, sira: number, yan: 1 | -1): void {
    const r = this.rng;
    // Kenardan içeri doğru ölçülen x
    const kenar = (ic: number): number => (yan > 0 ? DUNYA_G - ic : ic);
    const on = yan > 0 ? SIPER_SAG : SIPER_SOL;
    if (piyadeMi(tip)) {
      this.askerEkle(tip, kenar(36 - sira * 8 - r() * 4));
    } else if (tip === T_KAMYON || tip === T_TANK || tip === T_UCAKSAVAR || tip === T_JEEP) {
      const can = tip === T_TANK ? 12 : tip === T_UCAKSAVAR ? 7 : tip === T_JEEP ? 3 : 5;
      const uzak = tip === T_TANK ? 80 + r() * 60 : tip === T_UCAKSAVAR ? 140 + r() * 100 : tip === T_JEEP ? 50 + r() * 40 : 130 + r() * 100;
      this.araclar.push({
        // Cipin `namlu`su dünya açısıdır (makineli nereye bakıyor); `yuk`: vurulunca savrulan iki kişi
        tip, x: kenar(-4), y: this.yerY(kenar(0)), can, enCan: can, dur: on + yan * uzak, sayac: 2 + r() * 2, nisanT: 0,
        namlu: tip === T_JEEP ? (yan > 0 ? Math.PI : 0) : 0.2, yuk: tip === T_KAMYON ? 5 : tip === T_JEEP ? 2 : 0, t: 0, sars: 0, engelli: false,
      });
    } else if (tip === T_HELI) {
      this.havalar.push({
        tip, x: kenar(-10), y: 90 + r() * 80, vx: -60 * yan, vy: 0, can: 9, dusuyor: false, t: r() * 6, yon: -yan as 1 | -1, aci: 0,
        sayac: 2, seri: 0, birakX: 0, yuk: 0,
      });
    } else if (tip === T_JET) {
      const y = 58 + r() * 50;
      const hedef = r() < 0.5 ? SIPER_X + (r() - 0.5) * 60 : this.heli.x;
      const vx = -280 * yan;
      const dusme = Math.sqrt((2 * (this.zemin - y)) / 210);
      this.havalar.push({
        tip, x: yan > 0 ? this.kam.x + G + 350 : this.kam.x - 350, y, vx, vy: 0, can: 4, dusuyor: false, t: 0, yon: -yan as 1 | -1, aci: 0, sayac: 0, seri: 0,
        // Bomba hedefe varmadan bırakılır (uçuş yönünün tersinde)
        birakX: hedef + yan * 280 * 0.4 * dusme, yuk: 3,
      });
      this.jetUyari = 1.3;
      this.jetUyariY = y;
      this.jetUyariYan = yan;
      this.olaylar.push({ tip: 'jet' });
    }
  }

  // ---- Helikopter ----

  private heliAdim(dt: number): void {
    const h = this.heli;
    const r = this.rng;
    if (h.darbe > 0) h.darbe -= dt;
    if (h.olu) {
      h.vy += 250 * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.donus += dt * 10;
      h.egim = Math.sin(h.donus) * 0.6;
      if (!h.patladi) {
        if (r() < 0.7) this.parca(P_DUMAN, h.x, h.y, (r() - 0.5) * 20, -10, 1.4, 5);
        if (r() < 0.4) this.parca(P_ATES, h.x, h.y, (r() - 0.5) * 30, -20, 0.4, 4);
        if (h.y >= this.yerY(h.x) - 6) {
          h.patladi = true;
          this.patlat(h.x, this.yerY(h.x) - 4, 36, true, 3);
          this.sac(P_ENKAZ, h.x, h.y - 6, 12, 220, 5, 3, 200);
          this.enkazlar.push({ tip: T_NAKLIYE, x: h.x, y: this.yerY(h.x), t: 0, aci: 0.3 });
          this.bitisSayac = 1.7;
        }
      }
      return;
    }
    if (!this.oyunda) {
      // Başlık ekranı: yerinde süzülür
      h.hx = SIPER_X + 40 + Math.sin(this.zaman * 0.5) * 18;
      h.hy = this.zemin - 110 + Math.sin(this.zaman * 0.9) * 8;
    }
    const yay = this.guc.hiz > 0 ? 50 : 34;
    const enHiz = this.guc.hiz > 0 ? 330 : 240;
    h.vx += ((h.hx - h.x) * yay - h.vx * 10) * dt;
    h.vy += ((h.hy - h.y) * yay - h.vy * 10) * dt;
    const hiz = Math.hypot(h.vx, h.vy);
    if (hiz > enHiz) {
      h.vx *= enHiz / hiz;
      h.vy *= enHiz / hiz;
    }
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    const alt = this.yerY(h.x) - 15;
    if (h.y > alt) {
      h.y = alt;
      h.vy = Math.min(0, h.vy);
    }
    h.egim += (sinirla(h.vx / 210, -1, 1) * 0.28 - h.egim) * Math.min(1, dt * 8);
    // Hasarlıyken duman
    if (h.can < 40 && r() < (h.can < 20 ? 0.5 : 0.2)) this.parca(P_DUMAN, h.x - h.yon * 12, h.y - 2, -h.yon * 14, -8, 1.1, 3.5);

    if (!this.oyunda || this.bitti || this.bitisNeden) return;
    h.top -= dt;
    h.roket -= dt;
    const mx = h.x + h.yon * 14;
    const my = h.y + 6;

    // Top: en yakın hedef (piyade öncelikli)
    let ex = 0;
    let ey = 0;
    let evx = 0;
    let enP = 1e9;
    for (const s of this.askerler) {
      if (s.dost || !sahnede(s.x)) continue;
      const d = Math.hypot(s.x - mx, s.y - 7 - my);
      if (d < 118 && d < enP) {
        enP = d;
        ex = s.x;
        ey = s.y - 7;
        evx = s.durum === KOS && !s.engelli ? -yanOf(s.x) * s.hiz : 0;
      }
    }
    for (const a of this.araclar) {
      if (!sahnede(a.x)) continue;
      const d = Math.hypot(a.x - mx, a.y - 9 - my);
      const p = d + (a.tip === T_TANK ? 240 : 50);
      if (d < 118 && p < enP) {
        enP = p;
        ex = a.x;
        ey = a.y - 9;
        evx = 0;
      }
    }
    for (const o of this.havalar) {
      if (o.tip === T_NAKLIYE || o.dusuyor) continue;
      const d = Math.hypot(o.x - mx, o.y - my);
      const p = d + 20;
      if (d < 135 && p < enP) {
        enP = p;
        ex = o.x;
        ey = o.y;
        evx = o.vx;
      }
    }
    if (enP < 1e8) {
      if (Math.abs(ex - h.x) > 16) h.yon = ex > h.x ? 1 : -1;
      const d = Math.hypot(ex - mx, ey - my);
      const tt = d / 440;
      const aci = Math.atan2(ey - my, ex + evx * tt - mx);
      h.namlu = aci;
      if (h.top <= 0) {
        h.top = 0.13;
        const a2 = aci + (r() - 0.5) * 0.2;
        this.mermiler.push({ tip: M_KURSUN, x: mx, y: my, vx: Math.cos(a2) * 440 + h.vx * 0.3, vy: Math.sin(a2) * 440, omur: 0.5, yas: 0, hedef: null });
        if (this.guc.cift > 0) {
          const a3 = aci + (r() - 0.5) * 0.2;
          this.mermiler.push({ tip: M_KURSUN, x: mx, y: my - 3, vx: Math.cos(a3) * 440 + h.vx * 0.3, vy: Math.sin(a3) * 440, omur: 0.5, yas: 0, hedef: null });
        }
        this.parca(P_KOVAN, mx - h.yon * 4, my, -h.yon * (20 + r() * 30) + h.vx * 0.5, -40 - r() * 30, 0.9);
        this.olaylar.push({ tip: 'ates' });
      }
    } else if (Math.abs(h.vx) > 70) {
      h.yon = h.vx > 0 ? 1 : -1;
    }

    // Roket: araçlar ve hava hedefleri, yoksa piyade kümesi
    if (h.roket <= 0) {
      let hedef: Arac | Hava | null = null;
      let hx = 0;
      let hy = 0;
      let enR = 1e9;
      // Roket menzili ekranda kalır (iki cephede kamera daha ortada)
      const RM = 150;
      for (const a of this.araclar) {
        if (!sahnede(a.x)) continue;
        const d = Math.hypot(a.x - h.x, a.y - 9 - h.y);
        const p = d + (a.tip === T_TANK ? 0 : a.tip === T_UCAKSAVAR ? 20 : 90);
        if (d < RM && p < enR) {
          enR = p;
          hedef = a;
          hx = a.x;
          hy = a.y - 9;
        }
      }
      for (const o of this.havalar) {
        if (o.tip === T_NAKLIYE || o.dusuyor) continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        const p = d + 30;
        if (d < RM && p < enR) {
          enR = p;
          hedef = o;
          hx = o.x + o.vx * 0.5;
          hy = o.y;
        }
      }
      if (!hedef) {
        // İçinden ateş edilen bina
        for (const b of this.binalar) {
          if (b.asker <= 0) continue;
          const bx = b.x + (b.sutun * HUCRE) / 2;
          const by = this.yerY(bx) - b.satir * HUCRE * 0.45;
          const d = Math.hypot(bx - h.x, by - h.y);
          if (d < RM && d + 60 < enR) {
            enR = d + 60;
            hx = bx;
            hy = by;
          }
        }
        // Kalabalık piyade
        for (const s of this.askerler) {
          if (s.dost || !sahnede(s.x)) continue;
          const d = Math.hypot(s.x - h.x, s.y - h.y);
          if (d > RM - 8 || d > enR) continue;
          let komsu = 0;
          for (const o of this.askerler) if (!o.dost && Math.abs(o.x - s.x) < 22) komsu++;
          if (komsu >= 3) {
            enR = d;
            hx = s.x;
            hy = s.y - 4;
          }
        }
      }
      if (enR < 1e8) {
        h.roket = 1.15;
        h.roketYan = -h.roketYan;
        const ox = h.x - h.yon * 2;
        const oy = h.y + 8;
        const aci = Math.atan2(hy - oy, hx - ox);
        this.mermiler.push({ tip: M_ROKET, x: ox, y: oy, vx: Math.cos(aci) * 130 + h.vx * 0.5, vy: Math.sin(aci) * 130 + 20, omur: 1.6, yas: 0, hedef });
        this.olaylar.push({ tip: 'roket' });
      }
    }
  }

  // ---- Askerler ----

  private askerAdim(dt: number): void {
    const r = this.rng;
    const h = this.heli;
    this.askerBekliyor = [false, false];
    for (let i = this.askerler.length - 1; i >= 0; i--) {
      const s = this.askerler[i];
      if (!s) continue; // siper düşünce dizi kısalmış olabilir
      s.t += dt;
      s.sayac -= dt;
      if (s.atis > 0) s.atis -= dt;
      s.y = s.dost ? this.yerY(s.x) : this.yolY(s.x);

      if (s.dost) {
        // Siperdekiler: subay yalnız gözetler; ötekiler menzildeki en yakın düşmana ateş eder
        if (s.rol === 3) s.yon = h.x > s.x ? 1 : -1; // subay helikopteri izler
        if (s.rol === 3 || s.sayac > 0 || !this.oyunda || this.bitisNeden) continue;
        const menzil = s.rol === 2 ? 170 : s.rol === 1 ? 150 : 135;
        let en = -1;
        let enD = menzil;
        for (let k = 0; k < this.askerler.length; k++) {
          const o = this.askerler[k];
          if (o.dost) continue;
          // Duvardakiler kendi cephesine, kuledeki nöbetçi iki yana da bakar
          const d = s.rol === 2 ? Math.abs(o.x - s.x) : (o.x - s.x) * s.yon;
          if (d > 0 && d < enD) {
            enD = d;
            en = k;
          }
        }
        if (en < 0) {
          s.seri = 0;
          s.sayac = 0.3;
          continue;
        }
        const o = this.askerler[en];
        const oy = s.y - 10 - s.yukseklik;
        s.yon = o.x > s.x ? 1 : -1;
        s.nisanAci = Math.atan2(o.y - 8 - oy, o.x - s.x);
        let isabet: number;
        if (s.rol === 1) {
          // Makineli yuvası: 6'lık seri
          if (s.seri <= 0) s.seri = 6;
          s.seri--;
          s.sayac = s.seri > 0 ? 0.1 : 1.5 + r() * 0.8;
          isabet = 0.07;
        } else {
          s.sayac = 1.0 + r() * 0.7;
          isabet = s.rol === 2 ? 0.3 : 0.24;
        }
        s.atis = 0.07;
        this.izler.push({ x0: s.x + s.yon * 8, y0: oy, x1: o.x + (r() - 0.5) * 8, y1: o.y - 4 - r() * 8, t: 0 });
        this.olaylar.push({ tip: 'tufek' });
        if (r() < isabet) {
          this.oldur(en, s.yon * (50 + r() * 40), -30, false);
          if (en < i) i--;
        }
        continue;
      }

      const dxh = h.x - s.x;
      const dyh = h.y - (s.y - 10);
      const dh = Math.hypot(dxh, dyh);
      const yan = yanOf(s.x);
      const gid = -yan as 1 | -1; // sipere doğru yürüyüş yönü
      const mesafe = onMesafe(s.x);
      const siperde = mesafe < s.menzil + 30;

      if (s.durum === KOS) {
        // Derin çukurun ya da dik duvarın başında durur, köprü bekler
        // (kılığa göre kenardan 0–28 birim geride: hepsi aynı noktaya yığılmasın)
        if (this.binayaGir(s)) {
          this.askerler.splice(i, 1);
          continue;
        }
        const geri = (s.kilik % 8) * 4;
        const engelli = mesafe > s.menzil && this.engel(s.x + gid * geri, gid);
        if (engelli && !s.engelli && r() < 0.25) this.sozler.push({ metin: 'GEÇİT YOK!', x: s.x, y: s.y - 26, t: 0, vurgu: false });
        s.engelli = engelli;
        if (engelli && this.yolY(s.x + gid * (geri + 16)) > s.y) this.askerBekliyor[yan > 0 ? 1 : 0] = true;
        else {
          s.x += gid * s.hiz * dt;
          s.faz += dt * s.hiz * 0.42;
        }
        s.yon = gid;
        if (s.tip === T_ROKET && !h.olu && dh < 150 && dyh < -24 && s.sayac <= 0) {
          s.durum = NISAN;
          s.t = 0;
          s.hedef = 1;
        } else if ((s.tip === T_TUFEK || s.tip === T_MAKINELI) && !h.olu && dh < (s.tip === T_MAKINELI ? 140 : 125) && s.sayac <= 0 && mesafe > s.menzil) {
          // Durup helikoptere nişan alır (makineli çatalını açar: biraz daha uzun sürer)
          s.durum = NISAN;
          s.t = 0;
          s.hedef = 1;
          s.seri = 0;
          s.sayac = s.tip === T_MAKINELI ? 0.5 : 0.3 + r() * 0.25;
        } else if (mesafe < s.menzil) {
          s.durum = NISAN;
          s.t = 0;
          s.hedef = s.tip === T_NISANCI ? 0 : 2;
          s.seri = 0;
          s.sayac = Math.max(s.sayac, 0.3 + r() * 0.6);
        }
      } else if (s.durum === NISAN) {
        if (s.tip === T_ROKET) {
          const heliye = s.hedef === 1;
          const tx = heliye ? h.x + h.vx * 0.5 : SIPER_X + yan * 30;
          const ty = heliye ? h.y + h.vy * 0.3 : this.zemin - 10;
          s.nisanAci = Math.atan2(ty - (s.y - 9), tx - s.x);
          s.yon = tx > s.x ? 1 : -1;
          if (heliye ? s.t > 0.85 : s.sayac <= 0 && s.t > 0.85) {
            const hiz = 125;
            this.mermiler.push({
              tip: M_DRPG, x: s.x + Math.cos(s.nisanAci) * 8, y: s.y - 9 + Math.sin(s.nisanAci) * 8,
              vx: Math.cos(s.nisanAci) * hiz, vy: Math.sin(s.nisanAci) * hiz, omur: 3, yas: 0, hedef: null,
            });
            this.sac(P_TOZ, s.x - Math.cos(s.nisanAci) * 6, s.y - 9, 3, 30, 0.5, 3);
            this.olaylar.push({ tip: 'top' });
            s.atis = 0.1;
            s.sayac = 3.4 + r();
            s.t = 0;
            if (heliye && mesafe > s.menzil) s.durum = KOS;
            else s.hedef = 2;
          }
        } else if (s.tip === T_NISANCI) {
          // Keskin nişancı: mevzilenir, helikopteri izler, lazerle nişan alıp tek atar
          const gorur = !h.olu && dh < 235;
          if (gorur) {
            s.nisanAci = Math.atan2(dyh + h.vy * 0.12, dxh + h.vx * 0.12);
            s.yon = dxh > 0 ? 1 : -1;
          }
          if (s.seri === 1) {
            if (!gorur) s.seri = 0;
            else if (s.t > 1.05) {
              this.mermiler.push({ tip: M_NISANCI, x: s.x, y: s.y - 9, vx: Math.cos(s.nisanAci) * 520, vy: Math.sin(s.nisanAci) * 520, omur: 0.7, yas: 0, hedef: null });
              this.olaylar.push({ tip: 'top' });
              s.atis = 0.1;
              s.seri = 0;
              s.sayac = 3.4 + r() * 1.2;
            }
          } else if (gorur && s.sayac <= 0) {
            s.seri = 1;
            s.t = 0;
            this.olaylar.push({ tip: 'uyari' });
          }
        } else if (s.tip === T_MAKINELI) {
          if (s.sayac <= 0) {
            if (s.seri > 0) {
              // Seri: dört mermi art arda
              s.seri--;
              s.sayac = s.seri > 0 ? 0.13 : 2 + r();
              const aci = Math.atan2(dyh + h.vy * 0.4, dxh + h.vx * 0.4) + (r() - 0.5) * 0.17;
              s.nisanAci = aci;
              this.mermiler.push({ tip: M_DKURSUN, x: s.x, y: s.y - 8, vx: Math.cos(aci) * 165, vy: Math.sin(aci) * 165, omur: 1.5, yas: 0, hedef: null });
              this.olaylar.push({ tip: 'tufek' });
              s.atis = 0.07;
              if (s.seri === 0 && !siperde && r() < 0.5) s.durum = KOS;
            } else if (!h.olu && dh < 148 && (!siperde || r() < 0.6)) {
              s.seri = 4;
              s.yon = dxh > 0 ? 1 : -1;
            } else if (siperde) {
              s.yon = gid;
              s.sayac = 1.1 + r() * 0.6;
              const ty = this.zemin - 4 - r() * 14;
              s.nisanAci = Math.atan2(ty - (s.y - 8), SIPER_X + yan * 20 - s.x);
              for (let k = 0; k < 3; k++) this.izler.push({ x0: s.x + gid * 7, y0: s.y - 8, x1: SIPER_X + yan * (40 - r() * 60), y1: ty + (r() - 0.5) * 8, t: -k * 0.02 });
              this.siperHasar(1.3);
              this.olaylar.push({ tip: 'tufek' });
              s.atis = 0.1;
            } else s.durum = KOS;
          }
        } else if (s.sayac <= 0) {
          // Tüfekçi ve subay (subayın tabancası zayıftır)
          const subay = s.tip === T_SUBAY;
          s.sayac = 1.1 + r() * 0.8;
          if (!h.olu && dh < (subay ? 80 : 135) && (!siperde || r() < 0.55)) {
            // Helikoptere: kaçılabilir mermi
            const aci = Math.atan2(dyh + h.vy * 0.4, dxh + h.vx * 0.4) + (r() - 0.5) * (subay ? 0.4 : 0.2);
            s.nisanAci = aci;
            s.yon = dxh > 0 ? 1 : -1;
            this.mermiler.push({ tip: M_DKURSUN, x: s.x, y: s.y - 10, vx: Math.cos(aci) * 150, vy: Math.sin(aci) * 150, omur: 1.5, yas: 0, hedef: null });
            this.olaylar.push({ tip: 'tufek' });
            s.atis = 0.07;
            if (!siperde && r() < 0.5) s.durum = KOS;
          } else if (siperde) {
            s.yon = gid;
            const tx = SIPER_X + yan * (34 - r() * 60);
            const ty = this.zemin - 4 - r() * 14;
            s.nisanAci = Math.atan2(ty - (s.y - 10), tx - s.x);
            this.izler.push({ x0: s.x + gid * 5, y0: s.y - 10, x1: tx, y1: ty, t: 0 });
            this.parca(P_TOZ, tx, ty, 0, -6, 0.4, 2);
            this.siperHasar(subay ? 0.4 : 0.7);
            this.olaylar.push({ tip: 'tufek' });
            s.atis = 0.07;
          } else {
            s.durum = KOS;
          }
        }
      } else if (s.durum === PANIK) {
        if (this.engel(s.x, s.yon)) s.yon = -s.yon as 1 | -1; // çukura atlamaz, geri döner
        s.x += s.yon * s.hiz * 2.1 * dt;
        s.faz += dt * s.hiz * 0.9;
        if (s.t > 1.3) {
          s.durum = KOS;
          s.t = 0;
        }
      } else if (s.durum === YANIYOR) {
        if (this.engel(s.x, s.yon)) s.yon = -s.yon as 1 | -1;
        s.x += s.yon * 46 * dt;
        s.faz += dt * 22;
        if (r() < 2.5 * dt) s.yon = -s.yon as 1 | -1;
        if (r() < 0.75) this.parca(P_ATES, s.x + (r() - 0.5) * 4, s.y - 4 - r() * 10, (r() - 0.5) * 16, -26 - r() * 20, 0.35, 2.4);
        if (r() < 0.2) this.parca(P_DUMAN, s.x, s.y - 14, (r() - 0.5) * 10, -18, 0.9, 2.5);
        if (s.t > 2.3) {
          this.oldur(i, s.yon * 30, -20, false, true);
          continue;
        }
      }
      // Siperi geçemez: geldiği yanda kalır
      s.x = yan > 0 ? sinirla(s.x, SIPER_SAG + 4, DUNYA_G + 6) : sinirla(s.x, -6, SIPER_SOL - 4);
    }
  }

  // ---- Araçlar ----

  private aracAdim(dt: number): void {
    const r = this.rng;
    const h = this.heli;
    // Çukur başında bekleyen asker de köprücüyü çağırır (duvar dibinde sıkışan çağırmaz)
    const engelliVar = [this.askerBekliyor[0], this.askerBekliyor[1]];
    for (let i = this.araclar.length - 1; i >= 0; i--) {
      const a = this.araclar[i];
      a.t += dt;
      a.sayac -= dt;
      if (a.sars > 0) a.sars -= dt;
      const yan = yanOf(a.x);
      const gid = -yan as 1 | -1;
      // Gidecek yolu var mı, önü açık mı?
      const isteyen = (a.x - a.dur) * yan > 0;
      a.engelli = isteyen && this.engel(a.x, gid);
      const gidiyor = isteyen && !a.engelli;
      if (a.engelli && (a.tip !== T_KOPRUCU || a.yuk === 0)) engelliVar[yan > 0 ? 1 : 0] = true;
      if (gidiyor) {
        a.x += gid * (a.tip === T_TANK ? 15 : a.tip === T_UCAKSAVAR ? 20 : a.tip === T_KOPRUCU ? 17 : a.tip === T_JEEP ? 58 : 27) * dt;
        if (r() < 0.12) this.parca(P_TOZ, a.x + yan * 18, a.y - 1, yan * 8, -4, 0.6, 2.5);
      }
      a.y = this.yolY(a.x);
      if (a.can < a.enCan * 0.45 && r() < 0.25) this.parca(P_DUMAN, a.x + (r() - 0.5) * 12, a.y - 14, (r() - 0.5) * 8, -16, 1.2, 3.5);
      if (!this.oyunda || this.bitisNeden) continue;

      const dxh = h.x - a.x;
      const yuks = a.y - 16 - h.y;
      const dh = Math.hypot(dxh, yuks);

      if (a.tip === T_TANK) {
        const gorur = !h.olu && dh < 150 && yuks > 4 && yuks < Math.abs(dxh) * 1.5 + 24;
        let hedefNamlu = 0.16;
        if (a.nisanT > 0) {
          a.nisanT -= dt;
          hedefNamlu = Math.atan2(yuks, Math.abs(dxh));
          if (a.nisanT <= 0) {
            const yon = dxh > 0 ? 1 : -1;
            const aci = a.namlu;
            const ox = a.x + yon * Math.cos(aci) * 22;
            const oy = a.y - 16 - Math.sin(aci) * 22;
            this.mermiler.push({ tip: M_TOP, x: ox, y: oy, vx: yon * Math.cos(aci) * 270, vy: -Math.sin(aci) * 270, omur: 1.4, yas: 0, hedef: null });
            this.sac(P_TOZ, ox, oy, 4, 40, 0.5, 4);
            this.sac(P_ATES, ox, oy, 3, 30, 0.2, 3);
            this.olaylar.push({ tip: 'top' });
            a.sayac = 3.6 + r();
            a.sars = 0.2;
          }
        } else if (gorur && a.sayac <= 0 && r() < 0.6) {
          a.nisanT = 0.8;
          this.olaylar.push({ tip: 'uyari' });
        } else if ((!isteyen || (a.engelli && onMesafe(a.x) < 300)) && a.sayac <= 0) {
          // Sipere havan atışı (balistik); çukur başında bekleyen de menzildeyse atar
          const tx = SIPER_X + yan * (30 - r() * 70);
          const ty = this.zemin - 4;
          const ox = a.x + gid * 22;
          const oy = a.y - 22;
          const T = 1.5 + r() * 0.3;
          this.mermiler.push({ tip: M_HAVAN, x: ox, y: oy, vx: (tx - ox) / T, vy: (ty - oy) / T - 0.5 * 170 * T, omur: 4, yas: 0, hedef: null });
          this.sac(P_TOZ, ox, oy, 4, 40, 0.5, 4);
          this.sac(P_ATES, ox, oy, 3, 30, 0.2, 3);
          this.olaylar.push({ tip: 'top' });
          a.sayac = 3.8 + r() * 1.2;
          a.sars = 0.2;
          hedefNamlu = 0.5;
        }
        a.namlu += (hedefNamlu - a.namlu) * Math.min(1, dt * 5);
      } else if (a.tip === T_UCAKSAVAR) {
        if (!h.olu && dh < 200) {
          a.namlu += (Math.atan2(Math.max(4, yuks), dxh) - a.namlu) * Math.min(1, dt * 4);
          if (a.sayac <= 0) {
            a.sayac = 2.3 + r() * 0.8;
            this.flaklar.push({ x: h.x + h.vx * 0.8 + (r() - 0.5) * 26, y: h.y + h.vy * 0.8 + (r() - 0.5) * 20, t: 0 });
            this.olaylar.push({ tip: 'uyari' });
          }
        }
      } else if (a.tip === T_KAMYON) {
        // Yerine varınca ya da çukur başında kalınca askerler iner
        if (!gidiyor && a.yuk > 0 && a.sayac <= 0) {
          a.sayac = 0.5;
          a.yuk--;
          const s = this.askerEkle(T_TUFEK, a.x + yan * (20 + r() * 4));
          s.sayac = 1;
        }
      } else if (a.tip === T_JEEP) {
        // Makineli cip: helikopter menzildeyse ona, değilse yerine varınca sipere 5'lik seri atar
        const oy = a.y - 15;
        const heliye = !h.olu && dh < 135;
        const sipere = !gidiyor && onMesafe(a.x) < 150;
        const tx = heliye ? h.x + h.vx * 0.35 : SIPER_X + yan * 30;
        const ty = heliye ? h.y + h.vy * 0.35 : this.zemin - 8;
        let fark = (heliye || sipere ? Math.atan2(ty - oy, tx - a.x) : gid < 0 ? Math.PI : 0) - a.namlu;
        while (fark > Math.PI) fark -= Math.PI * 2;
        while (fark < -Math.PI) fark += Math.PI * 2;
        a.namlu += fark * Math.min(1, dt * 9);
        if (a.sayac <= 0 && (heliye || sipere)) {
          if (a.nisanT <= 0) a.nisanT = 5;
          a.nisanT--;
          a.sayac = a.nisanT > 0 ? 0.11 : 1.5 + r() * 0.7;
          a.sars = 0.07;
          const aci = a.namlu + (r() - 0.5) * 0.2;
          const ox = a.x + Math.cos(a.namlu) * 9;
          const oy2 = oy + Math.sin(a.namlu) * 9;
          if (heliye) this.mermiler.push({ tip: M_DKURSUN, x: ox, y: oy2, vx: Math.cos(aci) * 170, vy: Math.sin(aci) * 170, omur: 1.5, yas: 0, hedef: null });
          else {
            this.izler.push({ x0: ox, y0: oy2, x1: tx + (r() - 0.5) * 40, y1: ty + (r() - 0.5) * 10, t: 0 });
            this.siperHasar(0.5);
          }
          this.olaylar.push({ tip: 'tufek' });
        }
      } else if (a.tip === T_KOPRUCU) {
        if (a.yuk > 0 && a.engelli) {
          // Köprüyü açar (2 sn); karşı yaka çok uzaksa bekler, yeniden dener
          a.nisanT += dt;
          if (a.nisanT > 2) {
            if (this.kopruKur(a)) {
              a.yuk = 0;
              a.dur = a.x;
              this.kopruSayac[yan > 0 ? 1 : 0] = 16; // köprü açılırken bekleyenler yeni köprücü çağırmasın
              a.nisanT = 0;
              this.sozler.push({ metin: 'KÖPRÜ KURULDU', x: a.x + gid * 30, y: a.y - 34, t: 0, vurgu: true });
            } else a.nisanT = -5;
          }
        } else if (a.yuk > 0) a.nisanT = 0;
      }
    }
    // Çukur başında bekleyen varsa o cepheye köprücü gelir
    for (const yan of [-1, 1] as const) {
      const k = yan > 0 ? 1 : 0;
      this.kopruSayac[k] -= dt;
      if (!engelliVar[k] || this.kopruSayac[k] > 0 || !this.oyunda || this.bitisNeden) continue;
      if (this.araclar.some((a) => a.tip === T_KOPRUCU && a.yuk > 0 && yanOf(a.x) === yan)) continue;
      this.kopruSayac[k] = 16;
      const x = yan > 0 ? DUNYA_G + 4 : -4;
      this.araclar.push({
        tip: T_KOPRUCU, x, y: this.yerY(x), can: 9, enCan: 9, dur: SIPER_X + yan * (SIPER_YARI + 60), sayac: 9, nisanT: 0, namlu: 0, yuk: 1, t: 0,
        sars: 0, engelli: false,
      });
      this.olaylar.push({ tip: 'uyari' });
    }
  }

  // ---- Hava araçları ----

  private havaAdim(dt: number): void {
    const r = this.rng;
    const h = this.heli;
    for (let i = this.havalar.length - 1; i >= 0; i--) {
      const o = this.havalar[i];
      o.t += dt;
      o.sayac -= dt;
      if (o.dusuyor) {
        o.vy += 230 * dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.aci += dt * (o.tip === T_HELI ? 9 : 1.6) * o.yon;
        if (r() < 0.8) this.parca(P_DUMAN, o.x, o.y, (r() - 0.5) * 20, -8, 1.5, 5);
        if (r() < 0.5) this.parca(P_ATES, o.x, o.y, (r() - 0.5) * 30, -10, 0.4, 4);
        if (o.y >= this.yerY(o.x) - 5 || o.x < -80 || o.x > DUNYA_G + 80) {
          this.patlat(o.x, this.yerY(o.x) - 4, 34, true, 4);
          this.sac(P_ENKAZ, o.x, o.y - 6, 10, 220, 5, 3, 190);
          this.enkazlar.push({ tip: o.tip, x: o.x, y: this.yerY(o.x), t: 0, aci: (r() - 0.5) * 0.6 });
          if (this.enkazlar.length > 7) this.enkazlar.shift();
          this.havalar.splice(i, 1);
        }
        continue;
      }
      if (o.tip === T_HELI) {
        const yan = o.x >= h.x ? 1 : -1;
        const tx = sinirla(h.x + yan * 104, 30, DUNYA_G - 30);
        const ty = sinirla(h.y - 14 + Math.sin(o.t * 1.3) * 26, 50, this.zemin - 70);
        o.vx += ((tx - o.x) * 1.6 - o.vx * 1.8) * dt;
        o.vy += ((ty - o.y) * 2 - o.vy * 2) * dt;
        o.vx = sinirla(o.vx, -95, 95);
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.yon = h.x > o.x ? 1 : -1;
        o.aci = sinirla(o.vx / 95, -1, 1) * 0.28;
        const d = Math.hypot(h.x - o.x, h.y - o.y);
        if (!h.olu && this.oyunda && !this.bitisNeden && d < 180) {
          if (o.seri > 0 && o.sayac <= 0) {
            o.seri--;
            o.sayac = o.seri > 0 ? 0.13 : 2 + r();
            const aci = Math.atan2(h.y + h.vy * 0.35 - o.y, h.x + h.vx * 0.35 - o.x) + (r() - 0.5) * 0.16;
            this.mermiler.push({ tip: M_DKURSUN, x: o.x + o.yon * 16, y: o.y + 5, vx: Math.cos(aci) * 190, vy: Math.sin(aci) * 190, omur: 1.6, yas: 0, hedef: null });
            this.olaylar.push({ tip: 'tufek' });
          } else if (o.seri === 0 && o.sayac <= 0) {
            o.seri = 4;
          }
        }
        if (o.can < 4 && r() < 0.3) this.parca(P_DUMAN, o.x - o.yon * 10, o.y, 0, -10, 1.1, 3.5);
      } else if (o.tip === T_JET) {
        o.x += o.vx * dt;
        if (o.yuk > 0 && (o.x - o.birakX) * o.vx >= 0 && o.sayac <= 0) {
          o.yuk--;
          o.sayac = 0.13;
          this.mermiler.push({ tip: M_BOMBA, x: o.x, y: o.y + 6, vx: o.vx * 0.4, vy: 20, omur: 6, yas: 0, hedef: null });
        }
        if (o.vx < 0 ? o.x < -70 : o.x > DUNYA_G + 70) this.havalar.splice(i, 1);
      } else {
        // Dost nakliye: sandık bırakır
        o.x += o.vx * dt;
        if (o.yuk > 0 && o.x >= o.birakX) {
          o.yuk = 0;
          this.sandiklar.push({ x: o.x, y: o.y + 8, vy: 20, yerde: 0, tip: O_TAMIR, parasut: true, cekiliyor: false });
        }
        if (o.x > DUNYA_G + 90) this.havalar.splice(i, 1);
      }
    }
  }

  // ---- Mermiler ----

  private mermiAdim(dt: number): void {
    const r = this.rng;
    const h = this.heli;
    for (let i = this.mermiler.length - 1; i >= 0; i--) {
      const m = this.mermiler[i];
      m.yas += dt;
      m.omur -= dt;
      let bitti = m.omur <= 0;
      let patla = bitti && (m.tip === M_ROKET || m.tip === M_DRPG || m.tip === M_TOP);

      if (m.tip === M_ROKET) {
        // Hızlanır, hedefe hafifçe döner
        let aci = Math.atan2(m.vy, m.vx);
        const t = m.hedef;
        if (t && t.can > 0 && m.yas > 0.12) {
          const ty = 'dusuyor' in t ? t.y : t.y - 9;
          let fark = Math.atan2(ty - m.y, t.x - m.x) - aci;
          while (fark > Math.PI) fark -= Math.PI * 2;
          while (fark < -Math.PI) fark += Math.PI * 2;
          aci += sinirla(fark, -3.2 * dt, 3.2 * dt);
        }
        const hiz = Math.min(400, Math.hypot(m.vx, m.vy) + 520 * dt);
        m.vx = Math.cos(aci) * hiz;
        m.vy = Math.sin(aci) * hiz;
        this.parca(P_DUMAN, m.x, m.y, (r() - 0.5) * 8, (r() - 0.5) * 8, 0.5, 1.8);
      } else if (m.tip === M_DRPG) {
        if (r() < 0.8) this.parca(P_DUMAN, m.x, m.y, (r() - 0.5) * 6, (r() - 0.5) * 6, 0.6, 1.8);
      } else if (m.tip === M_HAVAN) {
        m.vy += 170 * dt;
      } else if (m.tip === M_BOMBA) {
        m.vy += 210 * dt;
      } else if (m.tip === M_OBOMBA) {
        m.vy += 280 * dt;
      }

      // İki alt adımda ilerlet (hızlı mermiler hedefin içinden geçmesin)
      for (let alt = 0; alt < 2 && !bitti; alt++) {
        m.x += m.vx * dt * 0.5;
        m.y += m.vy * dt * 0.5;
        const gy = this.yerY(m.x);
        const patlar = m.tip === M_ROKET || m.tip === M_OBOMBA;
        const dostMermi = m.tip === M_KURSUN || patlar;

        if (dostMermi) {
          for (let k = this.askerler.length - 1; k >= 0 && !bitti; k--) {
            const s = this.askerler[k];
            if (s.dost || !sahnede(s.x)) continue;
            if (Math.abs(m.x - s.x) < 3.6 && m.y > s.y - 15 && m.y < s.y + 1) {
              bitti = true;
              if (patlar) patla = true;
              else this.oldur(k, m.vx * 0.22 + (r() - 0.5) * 30, m.vy * 0.12 - 30, false);
            }
          }
          for (let k = this.araclar.length - 1; k >= 0 && !bitti; k--) {
            const a = this.araclar[k];
            if (Math.abs(m.x - a.x) < 22 && m.y > a.y - 20 && m.y < a.y) {
              bitti = true;
              if (patlar) patla = true;
              else {
                this.parca(P_KIVILCIM, m.x, m.y, -m.vx * 0.2 + (r() - 0.5) * 60, -60 - r() * 60, 0.3);
                this.aracHasar(k, a.tip === T_TANK ? 0.12 : 0.5);
              }
            }
          }
          for (const o of this.havalar) {
            if (bitti || o.tip === T_NAKLIYE || o.dusuyor) continue;
            if (Math.abs(m.x - o.x) < 21 && Math.abs(m.y - o.y) < 8) {
              bitti = true;
              if (patlar) patla = true;
              else this.havaHasar(o, 0.5);
            }
          }
          if (!bitti && patlar && this.binaCarp(m.x, m.y)) {
            bitti = true;
            patla = true;
          }
        } else if (!h.olu) {
          const yakin = m.tip === M_BOMBA ? Math.hypot(m.x - h.x, m.y - h.y) < 13 : Math.abs(m.x - h.x) < 19 && Math.abs(m.y - (h.y + 1)) < 8;
          if (yakin) {
            bitti = true;
            if (m.tip === M_DKURSUN) this.heliHasar(3.5);
            else if (m.tip === M_NISANCI) this.heliHasar(9);
            else patla = true;
          }
        }
        if (!bitti && m.y >= gy) {
          bitti = true;
          m.y = gy;
          if (m.tip === M_KURSUN || m.tip === M_DKURSUN || m.tip === M_NISANCI) this.parca(P_TOZ, m.x, gy - 1, 0, -10, 0.35, 2);
          else patla = true;
        }
      }
      if (m.x < -400 || m.x > DUNYA_G + 400 || m.y < -200) bitti = true;

      if (patla) {
        if (m.tip === M_ROKET) this.patlat(m.x, m.y, 21, true, 4);
        else if (m.tip === M_DRPG) this.patlat(m.x, m.y, 15, false, 4.2);
        else if (m.tip === M_TOP) this.patlat(m.x, m.y, 17, false, 5.5);
        else if (m.tip === M_HAVAN) this.patlat(m.x, m.y, 17, false, 3.2);
        else if (m.tip === M_BOMBA) this.patlat(m.x, m.y, 26, false, 5);
        else if (m.tip === M_OBOMBA) this.patlat(m.x, m.y, 25, true, 5, true);
      }
      if (bitti) this.mermiler.splice(i, 1);
    }
  }

  private flakAdim(dt: number): void {
    for (let i = this.flaklar.length - 1; i >= 0; i--) {
      const f = this.flaklar[i];
      f.t += dt;
      if (f.t >= 0.95) {
        this.flaklar.splice(i, 1);
        this.patlat(f.x, f.y, 19, false, 3.8);
      }
    }
  }

  // ---- Bez bebekler ----

  private bezAdim(dt: number): void {
    const r = this.rng;
    for (let n = this.bezler.length - 1; n >= 0; n--) {
      const b = this.bezler[n];
      if (b.uyku) {
        b.t += dt;
        // Bir süre yattıktan sonra zemine karışır
        if (b.t > 7 || this.bezler.length > 30) {
          this.bezler.splice(n, 1);
          this.yigin(b.x[2], 8, 1.5);
        }
        continue;
      }
      b.t += dt;
      let hareket = 0;
      for (let k = 0; k < 7; k++) {
        const vx = (b.x[k] - b.px[k]) * 0.992;
        const vy = (b.y[k] - b.py[k]) * 0.992;
        b.px[k] = b.x[k];
        b.py[k] = b.y[k];
        b.x[k] += vx;
        b.y[k] += vy + 520 * dt * dt;
        hareket += Math.abs(vx) + Math.abs(vy);
      }
      for (let it = 0; it < 3; it++) {
        for (let m = 0; m < 6; m++) {
          if (!(b.bag & (1 << m))) continue;
          const [i0, i1, uz] = BAGLAR[m];
          const dx = b.x[i1] - b.x[i0];
          const dy = b.y[i1] - b.y[i0];
          const d = Math.hypot(dx, dy) || 0.001;
          const f = ((d - uz) / d) * 0.5;
          b.x[i0] += dx * f;
          b.y[i0] += dy * f;
          b.x[i1] -= dx * f;
          b.y[i1] -= dy * f;
        }
      }
      for (let k = 0; k < 7; k++) {
        if (b.x[k] < 2) b.x[k] = 2;
        if (b.x[k] > DUNYA_G - 2) b.x[k] = DUNYA_G - 2;
        const gy = this.yerY(b.x[k]) - (k === 0 ? 2 : 0.5);
        if (b.y[k] > gy) {
          const vy = b.y[k] - b.py[k];
          b.y[k] = gy;
          b.py[k] = gy + vy * 0.25;
          b.px[k] = b.x[k] - (b.x[k] - b.px[k]) * 0.5;
        }
      }
      if (b.kan > 0) {
        b.kan -= dt;
        if (r() < b.kan * 0.9) {
          const k = b.bag & 1 ? 2 : 1;
          this.parca(P_KAN, b.x[k], b.y[k], (b.x[k] - b.px[k]) * 30 + (r() - 0.5) * 30, (b.y[k] - b.py[k]) * 30 - r() * 40, 1.2);
        }
      }
      if (b.t > 6 || (b.t > 1.2 && hareket < 0.35)) {
        b.uyku = true;
        b.t = 0;
        if (!b.yanik) {
          // Altında kan gölü
          const cx = Math.round(b.x[2]);
          for (let x = cx - 5; x <= cx + 5; x++) {
            if (x >= 0 && x <= DUNYA_G) this.kanIz[x] = Math.min(255, this.kanIz[x] + 130 - Math.abs(x - cx) * 18);
          }
        }
      }
    }
  }

  // ---- Parçalar ----

  private parcaAdim(dt: number): void {
    const P = this.parcalar;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.omur -= dt;
      const tip = p.tip;
      if (tip === P_DUMAN) {
        p.vx += (9 - p.vx) * dt * 1.5;
        p.vy += (-16 - p.vy) * dt * 1.5;
        p.boy += dt * 4.5;
      } else if (tip === P_ATES) {
        p.vx *= 1 - dt * 3.5;
        p.vy += (-34 - p.vy) * dt * 3;
      } else if (tip === P_TOZ) {
        p.vx *= 1 - dt * 3;
        p.vy += (-7 - p.vy) * dt * 3;
        p.boy += dt * 5;
      } else {
        p.vy += (tip === P_KIVILCIM ? 300 : 430) * dt;
        p.aci += p.donus * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (tip !== P_DUMAN && tip !== P_ATES && tip !== P_TOZ) {
        const gy = this.yerY(p.x);
        if (p.y >= gy) {
          if (tip === P_KAN) {
            const xi = Math.round(p.x);
            if (xi >= 0 && xi <= DUNYA_G) this.kanIz[xi] = Math.min(255, this.kanIz[xi] + 70);
            p.omur = 0;
          } else if (tip === P_ENKAZ || tip === P_KULE || tip === P_KASK || tip === P_TUGLA) {
            p.y = gy;
            if (Math.abs(p.vy) > 40) {
              p.vy = -p.vy * 0.36;
              p.vx *= 0.6;
              p.donus *= 0.6;
            } else {
              p.vy = 0;
              p.vx = 0;
              p.donus = 0;
            }
          } else p.omur = 0;
        }
      }
      if (p.omur <= 0) {
        P[i] = P[P.length - 1];
        P.pop();
      }
    }
  }

  private digerAdim(dt: number): void {
    for (let i = this.patlamalar.length - 1; i >= 0; i--) {
      this.patlamalar[i].t += dt;
      if (this.patlamalar[i].t > 0.55) this.patlamalar.splice(i, 1);
    }
    for (let i = this.izler.length - 1; i >= 0; i--) {
      this.izler[i].t += dt;
      if (this.izler[i].t > 0.07) this.izler.splice(i, 1);
    }
    for (let i = this.sozler.length - 1; i >= 0; i--) {
      const s = this.sozler[i];
      s.t += dt;
      s.y -= 12 * dt;
      if (s.t > 1.3) this.sozler.splice(i, 1);
    }
    for (let i = this.enkazlar.length - 1; i >= 0; i--) {
      const e = this.enkazlar[i];
      e.t += dt;
      e.y = this.yerY(e.x);
      if (e.t < 9 && this.rng() < 0.22) this.parca(P_DUMAN, e.x + (this.rng() - 0.5) * 16, e.y - 10, 0, -14, 1.6, 4);
      if (e.t < 3 && this.rng() < 0.3) this.parca(P_ATES, e.x + (this.rng() - 0.5) * 18, e.y - 8, 0, -20, 0.4, 3);
      if (e.t > 15) {
        this.enkazlar.splice(i, 1);
        this.yigin(e.x, 18, 6);
      }
    }
    for (let i = this.gomuler.length - 1; i >= 0; i--) {
      const g = this.gomuler[i];
      if (g.fitil < 0) continue;
      g.fitil -= dt;
      if (g.fitil <= 0) {
        this.gomuler.splice(i, 1);
        this.sozler.push({ metin: 'MAYIN!', x: g.x, y: this.yerY(g.x) - 30, t: 0, vurgu: true });
        this.olaylar.push({ tip: 'mayin' });
        this.patlat(g.x, this.yerY(g.x) - 2, 40, true, 8, true);
      }
    }
    const h = this.heli;
    for (let i = this.sandiklar.length - 1; i >= 0; i--) {
      const s = this.sandiklar[i];
      const gy = this.yerY(s.x) - 5;
      // Helikopter üstündeyse halatla yukarı çekilir (çukura inmek gerekmez)
      const kx = h.x;
      const ky = h.y + 10;
      const asagida = s.y - ky;
      s.cekiliyor = !h.olu && this.oyunda && Math.abs(kx - s.x) < 30 && asagida > -12 && asagida < 150;
      if (s.cekiliyor) {
        const uz = Math.hypot(kx - s.x, ky - s.y) || 1;
        const adim = Math.min(uz, 170 * dt);
        s.x += ((kx - s.x) / uz) * adim;
        s.y += ((ky - s.y) / uz) * adim;
        s.vy = 0;
        s.yerde = Math.min(s.yerde, 8);
      } else if (s.y < gy) {
        s.vy += (32 - s.vy) * dt * 2;
        s.y += s.vy * dt;
        if (s.parasut) s.x += Math.sin(this.zaman * 2 + s.x) * 5 * dt;
      } else {
        s.y = gy;
        s.yerde += dt;
      }
      if (!h.olu && Math.hypot(kx - s.x, ky - s.y) < 13) {
        let metin = 'TAMİR +35';
        if (s.tip === O_TAMIR) {
          h.can = Math.min(100, h.can + 35);
          this.siperCan = Math.min(100, this.siperCan + 15);
        } else if (s.tip === O_CIFT) {
          this.guc.cift = 22;
          metin = 'ÇİFT TOP!';
        } else if (s.tip === O_HIZ) {
          this.guc.hiz = 22;
          metin = 'HIZ!';
        } else {
          this.guc.bomba = 24;
          this.bomba.adet = 6;
          metin = 'BOMBA YAĞMURU!';
        }
        this.sozler.push({ metin, x: s.x, y: s.y - 14, t: 0, vurgu: false });
        this.olaylar.push({ tip: 'sandik' });
        this.sandiklar.splice(i, 1);
      } else if (s.yerde > 22) this.sandiklar.splice(i, 1);
    }
  }
}
