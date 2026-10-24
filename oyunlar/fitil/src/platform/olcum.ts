/**
 * Ölçüm (docs/OLCUM.md, docs/YAYIN.md aşama 1): kişisel veri toplamayan oyun
 * olayları. Kimlik, cihaz bilgisi, konum YOK; yalnız oyunun kendi olayları
 * (bölüm başladı/bitti, ekran, kasaba işi…), kurulumdan bu yana gün ve
 * oturum sırası.
 *
 * Uçlar:
 *  - yerel halka günlük: `localStorage` `fitil.olcum.v1`, son `EN_COK` olay
 *    (oyun testleri ve `__fitil.olcum()` raporu için; ağ isteği yok);
 *  - Android köprüsü: `window.FitilYerel.olay(ad, json)` varsa (Capacitor
 *    eklentisi Firebase Analytics'e iletir; web ve claude.ai sürümünde yok).
 */
import { DIL } from './dil';
import type { AndroidGelirKoprusu, ReklamSonucu, ReklamYeri, UrunId } from './gelir';

export type OlcumDegeri = string | number | boolean;

/** Bir olay: ad, zaman (ms), kurulumdan bu yana gün, oturum sırası, özellikler. */
export interface OlcumOlayi {
  a: string;
  t: number;
  g: number;
  o: number;
  p?: Record<string, OlcumDegeri>;
}

interface Kayit {
  /** İlk açılış zamanı (ms). */
  ilk: number;
  /** Açılış (oturum) sayısı. */
  oturum: number;
  olaylar: OlcumOlayi[];
  /** Ömür boyu toplamlar (Oyun özeti; halka günlükten bağımsız). */
  toplam: OlcumToplami;
}

const ANAHTAR = 'fitil.olcum.v1';
export const EN_COK = 600;
const GUN_MS = 86_400_000;

interface Depo {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

declare global {
  interface Window {
    /** Android sarmalayıcının yerel köprüsü (Capacitor; yalnız uygulamada). */
    FitilYerel?: {
      olay?: (ad: string, ozellik: string) => void;
      /** Ödüllü reklam + satın alma köprüsü (docs/CAN-REKLAM.md §5.1; aşama 3). */
      gelir?: AndroidGelirKoprusu;
      /**
       * (docs/ANDROID.md §3) Reklam gizlilik seçenekleri (UMP): `gerekli()`
       * giriş noktası isteniyorsa true; `ac()` formu gösterir. Uygulama
       * `platform/yerel.ts` `gizlilikSecenekleri()` ile okur.
       */
      gizlilik?: { gerekli(): boolean; ac(): Promise<void> };
      /** (docs/ANDROID.md §3) Açılış ekranı kuruldu: yerel açılış perdesi kalkar (`yerelHazir()`). */
      hazir?: () => void;
    };
  }
}

/** Ölçüm günlüğü. Saf mantık + depo; uygulama tek örnek (`olcum`) kullanır. */
export class Olcum {
  private k: Kayit;
  private yazZamanlayici: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly depo: Depo | null,
    private readonly simdi: () => number = () => Date.now(),
  ) {
    this.k = this.oku();
  }

  /** Sayfa açıldı: oturum sayacı artar, `oturum_basla` yazılır. */
  basla(ozellik: Record<string, OlcumDegeri> = {}): void {
    this.k.oturum++;
    this.olay('oturum_basla', { dil: DIL, ...ozellik });
    this.yaz();
  }

  olay(ad: string, p?: Record<string, OlcumDegeri>): void {
    const t = this.simdi();
    const o: OlcumOlayi = { a: ad, t, g: Math.max(0, Math.floor((t - this.k.ilk) / GUN_MS)), o: this.k.oturum };
    if (p && Object.keys(p).length) o.p = p;
    this.k.olaylar.push(o);
    toplamaEkle(this.k.toplam, o);
    if (this.k.olaylar.length > EN_COK) this.k.olaylar.splice(0, this.k.olaylar.length - EN_COK);
    try {
      if (typeof window !== 'undefined') window.FitilYerel?.olay?.(ad, JSON.stringify({ ...p, gun: o.g, oturum: o.o }));
    } catch {
      /* köprü hatası oyunu durdurmasın */
    }
    this.planla();
  }

  /** Günlükteki olaylar (eskiden yeniye). */
  olaylar(): readonly OlcumOlayi[] {
    return this.k.olaylar;
  }

  /** İlk açılış zamanı (ms; halka günlükten düşen olaylardan bağımsız). */
  ilkAcilis(): number {
    return this.k.ilk;
  }

  /** Ömür boyu toplamlar (halka günlükten düşen olaylar dahil). */
  toplam(): Readonly<OlcumToplami> {
    return this.k.toplam;
  }

  /** Bekleyen yazımı hemen yap (sayfa kapanırken). */
  yaz(): void {
    if (this.yazZamanlayici) clearTimeout(this.yazZamanlayici);
    this.yazZamanlayici = null;
    try {
      this.depo?.setItem(ANAHTAR, JSON.stringify(this.k));
    } catch {
      /* depolama dolu ya da kapalı: ölçüm oyunu durdurmaz */
    }
  }

  private planla(): void {
    if (this.yazZamanlayici) return;
    this.yazZamanlayici = setTimeout(() => this.yaz(), 1000);
  }

  private oku(): Kayit {
    try {
      const ham = this.depo?.getItem(ANAHTAR);
      if (ham) {
        const k = JSON.parse(ham) as Partial<Kayit>;
        if (typeof k.ilk === 'number' && typeof k.oturum === 'number' && Array.isArray(k.olaylar)) {
          const olaylar = k.olaylar.slice(-EN_COK);
          // Toplamsız (eski) ya da bozuk toplam: günlükte kalan olaylardan kurulur.
          return { ilk: k.ilk, oturum: k.oturum, olaylar, toplam: toplamGecerli(k.toplam) ? k.toplam : olaylardanToplam(olaylar) };
        }
      }
    } catch {
      /* bozuk ölçüm kaydı: baştan */
    }
    return { ilk: this.simdi(), oturum: 0, olaylar: [], toplam: bosToplam() };
  }
}

// ─────────────────────────── Ömür boyu toplamlar ───────────────────────────

/** Bir denemenin süresi en çok bu kadar sayılır (sn): unutulup sonra bitirilen deneme özeti şişirmesin. */
export const DENEME_SURE_SINIRI = 15 * 60;

/** Yerel takvim günü numarası (cihazın saat diliminde gece yarısından gece yarısına). */
export function yerelGun(ms: number): number {
  return Math.floor((ms - new Date(ms).getTimezoneOffset() * 60_000) / GUN_MS);
}

/** Bir ana bölümün ömür boyu sayaçları. */
export interface BolumToplami {
  /** Başlanan denemeler (başlangıcı görülmemiş bitiş dahil). */
  deneme: number;
  kayip: number;
  /** Çıkış + bitmeden kapatılan deneme (süren deneme sayılmaz). */
  birakma: number;
  kazanildi: boolean;
  /** Biten denemelerin süre toplamı (sn) ve sayısı. */
  sure: number;
  biten: number;
  /** Bölümün son olayının sırası (en son oynananları seçmek için). */
  son: number;
}

/**
 * Ömür boyu toplamlar (Ayarlar > Oyun özeti): halka günlük eski olayları
 * düşürse de sayılar baştan beri doğru kalsın diye her olayda güncellenir ve
 * günlükle birlikte saklanır. Tablo yalnız ana bölümleri sayar (`tur` 'ana').
 */
export interface OlcumToplami {
  /** İşlenen olay sayısı (0: hiç olay yok). */
  sira: number;
  /** En büyük oturum sırası. */
  oturum: number;
  /** Oynanan yerel takvim günleri (`yerelGun`). */
  gunler: number[];
  /** Biten denemelerin süre toplamı (sn; deneme başına en çok `DENEME_SURE_SINIRI`). */
  sure: number;
  /** Kazanılan en yüksek ana bölüm (0: yok). */
  enYuksek: number;
  /** Son `oturum_basla`'nın sürümü ve dili. */
  surum: string;
  dil: string;
  /** Ana bölümler (anahtar: bölüm numarası). */
  bolum: Record<string, BolumToplami>;
  /** Başlamış, henüz bitmemiş deneme (bir anda en çok bir bölüm oynanır). */
  suren: { id: number; ana: boolean } | null;
}

export function bosToplam(): OlcumToplami {
  return { sira: 0, oturum: 0, gunler: [], sure: 0, enYuksek: 0, surum: '', dil: '', bolum: {}, suren: null };
}

function toplamGecerli(x: unknown): x is OlcumToplami {
  const t = x as Partial<OlcumToplami> | null;
  return (
    !!t &&
    typeof t === 'object' &&
    typeof t.sira === 'number' &&
    typeof t.oturum === 'number' &&
    typeof t.sure === 'number' &&
    typeof t.enYuksek === 'number' &&
    Array.isArray(t.gunler) &&
    !!t.bolum &&
    typeof t.bolum === 'object'
  );
}

/** Olay ana bölüme mi ait (eski olaylarda `tur` yoksa numaradan: 1–100). */
function anaMi(o: OlcumOlayi): boolean {
  const tur = o.p?.tur;
  if (tur !== undefined) return tur === 'ana';
  const id = Number(o.p?.id);
  return id >= 1 && id <= 100;
}

/**
 * Toplamlara bir olay ekler (yerinde). Bırakma = çıkış + bitmeden kapatılan
 * deneme (`bolum_basla`'dan sonra `bolum_bitti` gelmeden yeni bir deneme ya
 * da oturum başladı); süren deneme bırakma sayılmaz (Ayarlar oyun içinden de
 * açılır).
 */
export function toplamaEkle(T: OlcumToplami, o: OlcumOlayi): void {
  const sira = ++T.sira;
  const gun = yerelGun(o.t);
  if (!T.gunler.includes(gun)) T.gunler.push(gun);
  if (o.o > T.oturum) T.oturum = o.o;
  const al = (id: number): BolumToplami => {
    const b = (T.bolum[id] ??= { deneme: 0, kayip: 0, birakma: 0, kazanildi: false, sure: 0, biten: 0, son: sira });
    b.son = sira;
    return b;
  };
  const terk = () => {
    const s = T.suren;
    if (s?.ana && T.bolum[s.id]) T.bolum[s.id].birakma++;
    T.suren = null;
  };
  if (o.a === 'oturum_basla') {
    terk();
    if (typeof o.p?.surum === 'string') T.surum = o.p.surum;
    if (typeof o.p?.dil === 'string') T.dil = o.p.dil;
  } else if (o.a === 'bolum_basla') {
    terk();
    const id = Number(o.p?.id);
    const ana = anaMi(o);
    T.suren = { id, ana };
    if (ana) al(id).deneme++;
  } else if (o.a === 'bolum_bitti') {
    const id = Number(o.p?.id);
    // Başlangıcı halka günlükten düşmüş deneme (eski kayıttan kurulurken) yine bir deneme sayılır.
    const eslesti = T.suren !== null && T.suren.id === id;
    if (!eslesti) terk();
    T.suren = null;
    const sure = typeof o.p?.sure === 'number' ? Math.min(DENEME_SURE_SINIRI, Math.max(0, o.p.sure)) : null;
    if (sure !== null) T.sure += sure;
    if (!anaMi(o)) return;
    const b = al(id);
    if (!eslesti) b.deneme++;
    const sonuc = o.p?.sonuc;
    if (sonuc === 'kazanc') {
      b.kazanildi = true;
      if (id > T.enYuksek) T.enYuksek = id;
    } else if (sonuc === 'cikis') b.birakma++;
    else b.kayip++;
    if (sure !== null) {
      b.sure += sure;
      b.biten++;
    }
  }
}

/** Olaylardan toplamlar (eski kayıt, önizleme, testler). */
export function olaylardanToplam(olaylar: readonly OlcumOlayi[]): OlcumToplami {
  const T = bosToplam();
  for (const o of olaylar) toplamaEkle(T, o);
  return T;
}

function yerelDepo(): Depo | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Uygulamanın ölçüm günlüğü. */
export const olcum = new Olcum(yerelDepo());

/** Kısa yol: `olcumOlayi('bolum_basla', { id: 3 })`. */
export function olcumOlayi(ad: string, p?: Record<string, OlcumDegeri>): void {
  olcum.olay(ad, p);
}

// ─────────────── Aşama 2: can, reklam, satın alma (docs/CAN-REKLAM.md §8) ───────────────

/**
 * Gelir olaylarının özellikleri (docs/OLCUM.md "Aşama 2"). Ölçümde kişisel
 * veri yok: jeton, fiyat ve tutar YAZILMAZ.
 */
export interface OlcumGelirOzellikleri {
  /** `kalan`: harcamadan sonraki can; `bolum`: bölüm kimliği. */
  can_harcandi: { neden: 'kayip' | 'cikis'; kalan: number; bolum: number };
  /** 0 canla bölüm başlatılmak istendi ya da kayıpla can 0'a indi. */
  can_bitti: { bolum: number };
  /** Can arttı: `zaman` (tembel dolum), `reklam` (+1; Usta kartı da), `satin` (can_doldur), `iade` (devamla kazanç). */
  can_doldu: { neden: 'zaman' | 'reklam' | 'satin' | 'iade' };
  /** Reklam (ya da Usta kartı) düğmesi oyuncuya gösterildi. */
  reklam_teklif: { yer: ReklamYeri };
  /** `kart`: Usta kartıyla reklamsız verildi (sonuç o zaman 'odul'). */
  reklam_sonuc: { yer: ReklamYeri; sonuc: ReklamSonucu; kart: boolean };
  /** `geri_yukle`: geri yüklenen her kalıcı ürün için bir olay. */
  satin_alma: { urun: UrunId; durum: 'basla' | 'basarili' | 'iptal' | 'beklemede' | 'hata' | 'geri_yukle' };
}

/** Aşama 2 olay adları. */
export type OlcumGelirOlayi = keyof OlcumGelirOzellikleri;

export const OLCUM_GELIR_OLAYLARI: readonly OlcumGelirOlayi[] = Object.freeze([
  'can_harcandi',
  'can_bitti',
  'can_doldu',
  'reklam_teklif',
  'reklam_sonuc',
  'satin_alma',
] as const);

/** Tür denetimli kısa yol: `gelirOlayi('can_harcandi', { neden: 'kayip', kalan: 3, bolum: 9 })`. */
export function gelirOlayi<A extends OlcumGelirOlayi>(ad: A, p: OlcumGelirOzellikleri[A]): void {
  olcum.olay(ad, p);
}

// ─────────────────────────── Özet (rapor) ───────────────────────────

export interface BolumOzeti {
  id: number;
  basla: number;
  kazanc: number;
  kayip: number;
  cikis: number;
  /** İlk kazanca kadar deneme (kazanılmadıysa null). */
  ilkKazancDenemesi: number | null;
  /** Bitmiş denemelerin ortalama süresi (sn). */
  ortSure: number;
}

export interface OlcumOzeti {
  oturumlar: number;
  /** Oyuncunun açtığı günler (kurulumdan bu yana gün numaraları). */
  gunler: number[];
  bolumler: BolumOzeti[];
  /** İlk oturumda varılan en yüksek ana bölüm (kazanılmış). */
  ilkOturumEnYuksek: number;
  /** İlk açılıştan 5. bölümün ilk kazancına kadar geçen süre (sn; yoksa null). */
  bolum5Suresi: number | null;
  ekranlar: Record<string, number>;
}

/** Olaylardan oyuncu özeti (saf; test edilir, `__fitil.olcum()` ve rapor betiği kullanır). */
export function olcumOzeti(olaylar: readonly OlcumOlayi[]): OlcumOzeti {
  const bolum = new Map<number, BolumOzeti & { sureler: number[] }>();
  const al = (id: number) => {
    let b = bolum.get(id);
    if (!b) bolum.set(id, (b = { id, basla: 0, kazanc: 0, kayip: 0, cikis: 0, ilkKazancDenemesi: null, ortSure: 0, sureler: [] }));
    return b;
  };
  const gunler = new Set<number>();
  const ekranlar: Record<string, number> = {};
  let oturumlar = 0;
  let ilkOturum = -1;
  let ilkOturumEnYuksek = 0;
  let bolum5Suresi: number | null = null;
  const ilkZaman = olaylar[0]?.t ?? 0;
  for (const o of olaylar) {
    gunler.add(o.g);
    if (o.a === 'oturum_basla') {
      oturumlar++;
      if (ilkOturum < 0) ilkOturum = o.o;
    } else if (o.a === 'ekran') {
      const ad = String(o.p?.ad ?? '');
      ekranlar[ad] = (ekranlar[ad] ?? 0) + 1;
    } else if (o.a === 'bolum_basla') {
      al(Number(o.p?.id)).basla++;
    } else if (o.a === 'bolum_bitti') {
      const id = Number(o.p?.id);
      const b = al(id);
      const sonuc = o.p?.sonuc;
      if (sonuc === 'kazanc') {
        b.kazanc++;
        if (b.ilkKazancDenemesi === null) b.ilkKazancDenemesi = b.basla || 1;
        if (o.o === ilkOturum && o.p?.tur === 'ana' && id > ilkOturumEnYuksek) ilkOturumEnYuksek = id;
        if (id === 5 && o.p?.tur === 'ana' && bolum5Suresi === null) bolum5Suresi = Math.round((o.t - ilkZaman) / 1000);
      } else if (sonuc === 'cikis') b.cikis++;
      else b.kayip++;
      if (typeof o.p?.sure === 'number') b.sureler.push(o.p.sure);
    }
  }
  const bolumler = [...bolum.values()]
    .sort((a, b) => a.id - b.id)
    .map(({ sureler, ...b }) => ({ ...b, ortSure: sureler.length ? Math.round(sureler.reduce((x, y) => x + y, 0) / sureler.length) : 0 }));
  return { oturumlar, gunler: [...gunler].sort((a, b) => a - b), bolumler, ilkOturumEnYuksek, bolum5Suresi, ekranlar };
}
