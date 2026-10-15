/**
 * FİTİL oyun sahnesi çizicisi (P2a). `OyunCizici` sözleşmesini (src/app/
 * sozlesme.ts) tek bir <canvas> üzerinde uygular.
 *
 * Katmanlar (GDD §16.6):
 *   1 arka plan: gökyüzü + yıldız tozu + deniz (offscreen) → gök parçacıkları
 *     (havai fişekler) → kasaba silueti (offscreen) → deniz şeritleri
 *   2 sandık çerçevesi + yuvalar + kalıcı ışık izi (offscreen)
 *   3 dinamik: zemin, kapsüller, engeller, vurgu, yanan fitil, efektler,
 *     parçacıklar, çizilen fitil + önizleme, öğretici el
 *   ekran üstü: uçan kıvılcımlar, reaksiyon yazısı, vinyet, kararma, flaş
 *
 * Olay oynatıcı: `oynat()` olayları tik zamanında sıralı işler (tik → ms:
 * seçenek hızı × hızlandırma × yönetmen zaman ölçeği); her olay görsel
 * tahtayı günceller, efekt/parçacık/sarsıntı üretir ve `olayDinle`
 * dinleyicilerini çağırır. `hedefIlerledi` bildirimi kıvılcım hedef kartına
 * vardığında yapılır (HUD sayacı o anda zıplasın diye). Oynatma bitince
 * görsel tahta `sonraki` ile karşılaştırılır (geliştirme kipinde fark
 * uyarısı) ve eşitlenir.
 */
import type { CiziciSecenek, Dikdortgen, OyunCizici, TahtaGeometrisi } from '../app/sozlesme';
import type { BolumVerisi, Eksen, Hedef, Icerik, Konum, Olay, Onizleme, OyunDurumu } from '../core/types';
import type { Stage } from './stage';
import { E, Efektler, type Efekt } from './efektler';
import { FisekSistemi } from './fisek';
import { Gokyuzu } from './gokyuzu';
import { IpCizici, type IpRenkleri } from './ip';

import { B, T } from './parcacik';
import { INCI, P, R, efektRengi } from './palet';
import { Sahne, type SahneSecenek } from './sahne';
import { Sandik } from './sandik';
import { TahtaCizimi } from './tahtaCizimi';
import { KOMBO_ADLARI, YolKatmani } from './yolKatmani';
import { STILLER, Yazi } from './yazi';
import { DESENLER } from '../app/katalog';
import { fitilRenkleri } from './fitilGorunumu';
import type { Ctx } from './tuval';

/** Oynatma sonunda son olaydan sonra beklenen pay (tik). */
const KUYRUK = 140;
const simdiMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const REAKSIYON_METNI: Record<string, string> = { guzel: 'Güzel!', harika: 'Harika!', muhtesem: 'Muhteşem!', senlik: 'ŞENLİK!' };

/** Anında bitirmede bile bildirilen (durum taşıyan) olaylar. */
const DURUM_OLAYLARI = new Set(['hedefIlerledi', 'puanEklendi', 'korukDoldu', 'korukKullanildi', 'reaksiyon', 'bolumBitti', 'finalBasladi']);

/** Hedef kıvılcımının kaynağı olabilecek olaylar. */
const KAYNAK_OLAYLARI = new Set(['patlama', 'kafesKirildi', 'engelHasar', 'dosemeAydinlandi', 'desenBoyandi', 'isTemizlendi', 'fenerToplandi', 'devFisekFirladi', 'kurudu']);

interface YananFitil {
  ip: IpCizici;
  t0: number;
  zaman: Float32Array;
  n: number;
  kalin: number;
  renk: IpRenkleri;
  bitis: number;
  birikim: number;
}

interface Oynatma {
  olaylar: Olay[];
  i: number;
  saat: number;
  son: number;
  onceki: OyunDurumu;
  sonraki: OyunDurumu;
  coz: () => void;
  /** hedefIlerledi indeksi → kaynak hücre. */
  kaynak: (Konum | null)[];
  /** patlama indeksi bir hedefe kıvılcım gönderiyor mu. */
  hedefli: Uint8Array;
  /** hedefIlerledi indeksi → eşlenen fenerToplandi olayı (fener uçuşu bildirir). */
  fenerli: Uint8Array;
  yonetmenT: number;
  yonetmenMerkez: Konum;
  fitiller: YananFitil[];
  /** dugumYandi zamanları (fitilBasladi indeksine göre). */
  dugumZaman: Map<number, Float32Array>;
}

interface HavaUyari {
  olay: 'meltem' | 'cisenti';
  eksen: 'satir' | 'sutun';
  hat: number;
}

interface Zamanli {
  kalan: number;
  fn: () => void;
}

export interface CiziciKurulum extends Partial<SahneSecenek> {
  /** Geliştirme kipi: oynatma sonu fark uyarıları (varsayılan import.meta.env.DEV). */
  gelistirme?: boolean;
}

/** Geliştirme ve test kancaları (sözleşme dışı). */
export interface CiziciDev {
  sahne: Sahne;
  /** Zamanı dondur: kare() yalnız çizer. */
  dondur(d: boolean): void;
  /** Sabit 1/60 s adımlarla ilerlet (dondurulmuşken de). */
  ilerle(ms: number): void;
  /** Gökte hemen patlat (desen ızgarası için). */
  fisekPatlat(x: number, y: number, renk: number, desen: string, olcek?: number): void;
  /** Oynatma sürüyor mu. */
  oynuyor(): boolean;
  /** Son oynatmadaki fark sayısı (görsel tahta ≠ sonraki). */
  sonFark(): number;
  /** Anlık sayaçlar. */
  sayac(): { parcacik: number; efekt: number; kalite: string; c: number };
  /** Test: otomatik kaliteyi elle düşür/yükselt (ölçüm sonradan yine karar verir). */
  kaliteZorla(dusuk: boolean): void;
  /** Yalnız gökyüzü ve havai fişekleri çiz (desen ızgarası). */
  yalnizGok(b: boolean): void;
}

export type OyunCiziciTam = OyunCizici & Required<Pick<OyunCizici, 'yonetmenZorla' | 'karart' | 'fisekDinle' | 'imlecGoster' | 'kutla'>> & { dev: CiziciDev } & Pick<OyunCiziciSinifi, 'onIsit' | 'sov' | 'ufuk'>;

export function oyunCiziciOlustur(stage: Stage, secenek?: CiziciKurulum): OyunCiziciTam {
  return new OyunCiziciSinifi(stage, secenek ?? {});
}

class OyunCiziciSinifi implements OyunCizici {
  readonly s = new Sahne();
  private gok = new Gokyuzu();
  private sandik: Sandik;
  private tc: TahtaCizimi;
  private ef: Efektler;
  private yol: YolKatmani;
  private fisek: FisekSistemi;
  private yazi = new Yazi();
  private bilgi = new Yazi();
  private dinleyiciler: ((o: Olay) => void)[] = [];
  private kameraDinleyiciler: ((y: boolean) => void)[] = [];
  private bolum: BolumVerisi | null = null;
  private hedefler: Hedef[] = [];
  private hedefKonum: { x: number; y: number }[] = [];
  private alanVerildi = false;
  private yerlesimGerekli = true;
  private oynatma: Oynatma | null = null;
  private hizCarpani = 1;
  private karanlik = 0;
  private karanlikHedef = 0;
  private parlaHedef = 0;
  private gokSayac = 0;
  private uyarilar: HavaUyari[] = [];
  private zamanlilar: Zamanli[] = [];
  private donuk = false;
  private gelistirme: boolean;
  private sonFark = 0;
  private yonetmenZorlaBayrak = false;
  private yalnizGokBayrak = false;
  /** Mahalle şovu: tahta çizilmez, gök büyük (sov()). */
  private sovAcik = false;
  private yukluEfekt: Efekt | null = null;
  /** Son patlayan içerik (hücre indeksine göre): yüklenme/kombinasyon için. */
  private sonIcerik = new Map<number, Icerik>();
  // Otomatik kalite (§16.6): kare ARALIĞI ekran tazelemesine göre, iş süresi ayrıca ölçülür.
  private dusukKalite = false;
  private sonKareZamani = 0;
  /** Pişirme/takılma sonrası ölçüme katılmayacak kare sayısı. */
  private kaliteAtla = 30;
  private pAralik = 0;
  private pIs = 0;
  private pN = 0;
  /** Ekran tazeleme aralığı tahmini (ms): 60 Hz varsayılır, daha hızlısı görülürse iner. */
  private tazeleme = 1000 / 60;
  private iyiPencere = 0;
  /** Yeniden yükseltmek için gereken art arda iyi pencere (her düşüşte ikiye katlanır). */
  private gerekenIyi = 4;
  private nokta = { x: 0, y: 0 };
  private yokEdildi = false;
  readonly dev: CiziciDev;

  constructor(
    private stage: Stage,
    kurulum: CiziciKurulum,
  ) {
    const s = this.s;
    this.gelistirme = kurulum.gelistirme ?? !!import.meta.env?.DEV;
    const { gelistirme: _g, ...sec } = kurulum;
    void _g;
    Object.assign(s.secenek, sec);
    if (typeof matchMedia !== 'undefined' && kurulum.hareketiAzalt === undefined) {
      try {
        s.secenek.hareketiAzalt = matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        /* yok */
      }
    }
    s.kamera.hareketiAzalt = s.secenek.hareketiAzalt;
    this.sandik = new Sandik(s);
    this.tc = new TahtaCizimi(s);
    this.ef = new Efektler(s);
    this.yol = new YolKatmani(s, this.ef, this.tc);
    this.fisek = new FisekSistemi(s, this.gok);
    s.kamera.dinle = (y) => {
      for (const f of this.kameraDinleyiciler) f(y);
    };
    this.ef.alevBasi = (g, c) => this.alevBasi(g, c);
    this.kaliteUygula();
    stage.onResize(() => {
      this.yerlesimGerekli = true;
    });
    // Yazı tipi yüklenince reaksiyon yazıları doğru ölçülsün.
    try {
      void document.fonts?.load('800 48px "Baloo 2"');
    } catch {
      /* yok */
    }
    const self = this;
    this.dev = {
      sahne: s,
      dondur(d) {
        self.donuk = d;
      },
      ilerle(ms) {
        const eski = self.donuk;
        self.donuk = false;
        let kalan = ms;
        while (kalan > 0) {
          const dt = Math.min(1000 / 60, kalan);
          self.guncelle(dt);
          kalan -= dt;
        }
        self.donuk = eski;
      },
      fisekPatlat(x, y, renk, desen, olcek) {
        self.fisek.patlat(x, y, renk, desen, olcek);
      },
      oynuyor: () => !!self.oynatma,
      sonFark: () => self.sonFark,
      yalnizGok(b) {
        self.yalnizGokBayrak = b;
      },
      sayac: () => ({ parcacik: s.havuz.sayi, efekt: self.ef.liste.filter((e) => e.aktif).length, kalite: self.dusukKalite ? 'dusuk' : 'yuksek', c: s.c }),
      kaliteZorla(dusuk) {
        self.dusukKalite = dusuk;
        self.kaliteUygula();
      },
    };
  }

  // ------------------------------------------------------------------ kurulum

  bolumKur(d: OyunDurumu, bolum: BolumVerisi): void {
    this.bitirAninda();
    this.sovAcik = false;
    this.bolum = bolum;
    this.hedefler = d.hedefler.map((h) => h.hedef);
    const s = this.s;
    s.tahta.uyari = this.gelistirme ? (m) => console.warn('[çizici]', m) : () => {};
    s.tahta.kur(d);
    this.karanlik = 0;
    this.karanlikHedef = 0;
    this.parlaHedef = 0;
    this.sandik.parla = 0;
    this.uyarilar = [];
    this.zamanlilar = [];
    this.sonIcerik.clear();
    this.ef.temizle(true);
    s.havuz.temizle();
    this.fisek.temizle();
    this.yazi.gizle();
    this.bilgi.gizle();
    s.kamera.sifirla();
    this.yol.goster([], false, -1, null);
    this.yol.zorunlu = this.yol.ipucu = this.yol.secim = null;
    this.yol.imlec = null;
    this.yol.elAyarla(null);
    this.yol.hayaletAyarla(null, false);
    this.yerlesim();
  }

  durumGoster(d: OyunDurumu): void {
    this.bitirAninda();
    const s = this.s;
    const boyut = d.w !== s.tahta.w || d.h !== s.tahta.h;
    s.tahta.esitle(d, true);
    for (const h of s.tahta.hucreler) {
      h.isikAcilis = 1;
      h.dosemeAcilis = 1;
      h.desenAcilis = 1;
    }
    this.hedefler = d.hedefler.map((h) => h.hedef);
    if (boyut) this.yerlesim();
    else this.sandik.isikGuncelle(true);
    this.karanlikHedef = d.bitti === 'kayip' ? this.karanlikHedef : 0;
  }

  alanAyarla(r: Dikdortgen, gokBandi: Dikdortgen): void {
    this.s.alan = { ...r };
    this.s.gokBandi = { ...gokBandi };
    this.alanVerildi = true;
    this.yerlesimGerekli = true;
  }

  geometri(): TahtaGeometrisi {
    if (this.yerlesimGerekli && this.s.tahta.w) this.yerlesim();
    const s = this.s;
    return { x: s.gx, y: s.gy, hucre: s.c, w: s.tahta.w, h: s.tahta.h };
  }

  hedefKonumlari(k: readonly { x: number; y: number }[]): void {
    this.hedefKonum = k.map((p) => ({ x: p.x, y: p.y }));
  }

  secenekAyarla(p: Partial<CiziciSecenek> & Partial<Pick<SahneSecenek, 'desenler' | 'fitil'>>): void {
    const s = this.s;
    const paletDegisti = p.palet !== undefined && p.palet !== s.secenek.palet;
    const gokDegisti = p.gokyuzu !== undefined && p.gokyuzu !== s.secenek.gokyuzu;
    Object.assign(s.secenek, p);
    if (gokDegisti) this.yerlesimGerekli = true;
    s.kamera.hareketiAzalt = s.secenek.hareketiAzalt;
    this.kaliteUygula();
    if (paletDegisti) this.yerlesimGerekli = true;
    if (p.fitil !== undefined && this.yol.yol.length) this.yol.goster(this.yol.yol, this.yol.halka, this.yol.renk, this.yol.onizleme);
  }

  olayDinle(fn: (o: Olay) => void): void {
    this.dinleyiciler.push(fn);
  }

  kameraDinle(fn: (yavas: boolean) => void): void {
    this.kameraDinleyiciler.push(fn);
  }

  /** Sonraki oynatmada yönetmen kamerasını koşulsuz çalıştır (öğretim §15). */
  yonetmenZorla(): void {
    this.yonetmenZorlaBayrak = true;
  }

  /** Tahta kararması (ekran üstü panel açılırken). */
  karart(alfa: number): void {
    this.karanlikHedef = Math.max(0, Math.min(0.85, alfa));
  }

  /**
   * (P5 ek) Mahalle şovu (§10.1): tahta çizilmez; gök ve kasaba ekranın
   * üçte ikisine açılır, havai fişekler bütün göğe yayılır. `false` ya da
   * sonraki `bolumKur` normal yerleşime döndürür.
   */
  sov(acik: boolean): void {
    if (this.sovAcik === acik) return;
    this.sovAcik = acik;
    const s = this.s;
    if (acik && s.ekranW > 0) {
      const H = s.ekranH;
      this.gok.kur(s.ekranW, H, Math.min(2, s.dpr), this.bolum?.mahalle ?? 0, { x: 0, y: 0, w: s.ekranW, h: Math.round(H * 0.6) }, null, s.secenek.gokyuzu || undefined);
      this.kaliteAtla = Math.max(this.kaliteAtla, 20);
    } else this.yerlesimGerekli = true;
  }

  /** Şovda gök (ufuk) yüksekliği: fişekler bunun üstünde patlar. */
  ufuk(): number {
    return this.gok.ufuk;
  }

  /** Gökte havai fişek patladığında (ses için). */
  fisekDinle(fn: (x: number, y: number, desen: string) => void): void {
    const once = this.fisek.dinle;
    this.fisek.dinle = (x, y, d) => {
      once(x, y, d);
      fn(x, y, d);
    };
  }

  private kaliteUygula(): void {
    const s = this.s;
    const k = s.secenek.kalite;
    const dusuk = k === 'dusuk' || (k === 'oto' && this.dusukKalite);
    s.havuz.oran = dusuk ? 0.5 : 1;
    s.parilti_ = !dusuk;
    this.gok.durgun = dusuk;
  }

  /** §13.7 yerleşimi ve offscreen katmanların pişirilmesi. */
  private yerlesim(): void {
    this.yerlesimGerekli = false;
    if (!this.yerlesimHesapla()) return;
    this.s.kaynaklariHazirla(this.s.secenek.palet);
    this.gokKur();
    this.sandik.kur();
    this.tc.kur();
    this.yol.yenidenOrnekle();
    // Pişirme takılması otomatik kaliteyi düşürmesin.
    this.kaliteAtla = Math.max(this.kaliteAtla, 30);
  }

  /**
   * (P5 ek) Bölümün pişirmelerini (sprite önbelleği, gök, sandık) önceden ve
   * parça parça yap: açılış ekranı dokunuşu beklerken ilk bölüm hazırlanır,
   * dokunuş anında `bolumKur` önbellekten çizer. `ara` adımlar arasında
   * sırayı bırakır; `iptal` true dönerse (oyun başladı) durur. Çizici bu
   * sırada etkin olmamalı (çizilmez).
   */
  async onIsit(d: OyunDurumu, bolum: BolumVerisi, alan: Dikdortgen, gokBandi: Dikdortgen, ara: () => Promise<void>, iptal: () => boolean): Promise<void> {
    this.alanAyarla(alan, gokBandi);
    this.bolum = bolum;
    this.s.tahta.kur(d);
    if (!this.yerlesimHesapla()) return;
    const s = this.s;
    const adimlar = [() => s.kaynaklariHazirla(s.secenek.palet), () => this.gokKur(), () => this.sandik.kur()];
    for (const a of adimlar) {
      await ara();
      if (iptal() || this.yokEdildi) return;
      a();
    }
    this.yerlesimGerekli = true;
  }

  private gokKur(): void {
    const s = this.s;
    const t = s.tahta;
    const F = s.cerceve;
    const c = s.c;
    this.gok.kur(s.ekranW, s.ekranH, Math.min(2, s.dpr), this.bolum?.mahalle ?? 0, s.gokBandi, { x: s.gx - F, y: s.gy - F, w: t.w * c + 2 * F, h: t.h * c + 2 * F }, s.secenek.gokyuzu || undefined);
  }

  /** Yerleşim hesabı (pişirme yok). Tahta yoksa false. */
  private yerlesimHesapla(): boolean {
    const s = this.s;
    const st = this.stage;
    s.ekranW = st.width;
    s.ekranH = st.height;
    // Dönüşümler sahnenin gerçek DPR'ı ile; offscreen ve sprite çözünürlüğü en fazla 2 (§16.6).
    s.dpr = st.dpr || 1;
    const W = s.ekranW;
    const H = s.ekranH;
    const t = s.tahta;
    if (!t.w) return false;
    if (!this.alanVerildi) {
      const dikey = W / H <= 0.75;
      if (dikey) {
        // §13.7: hücre 40 px'in altına düşerse üst bant %14'e iner.
        const hucre = Math.floor(Math.min((W - 32) / t.w, (0.66 * H - 24) / t.h, 64));
        const ust = Math.round(H * (hucre < 40 ? 0.14 : 0.2));
        s.gokBandi = { x: 0, y: 0, w: W, h: ust };
        s.alan = { x: 0, y: ust, w: W, h: Math.round(H * 0.86) - ust };
      } else {
        s.gokBandi = { x: 0, y: 0, w: W, h: Math.round(H * 0.18) };
        s.alan = { x: 0, y: 80, w: Math.round(W * 0.62), h: H - 160 };
      }
    }
    const a = s.alan;
    const dikeyMi = W / H <= 0.75;
    const c = Math.max(18, Math.floor(Math.min((a.w - 32) / t.w, dikeyMi ? (a.h - 24) / t.h : a.h / t.h, 64)));
    s.c = c;
    s.cerceve = Math.max(10, Math.min(16, Math.round(c * 0.26)));
    s.gx = Math.round(a.x + (a.w - t.w * c) / 2);
    s.gy = Math.round(a.y + (a.h - t.h * c) / 2);
    const n = t.w * t.h;
    if (s.titresim.length !== n) {
      s.titresim = new Float32Array(n);
      s.karartma = new Float32Array(n);
    }
    return true;
  }

  // ------------------------------------------------------------------ çizim katmanı API

  yolGoster(yol: readonly Konum[], halka: boolean, renk: number, onizleme: Onizleme | null): void {
    this.yol.goster(yol, halka, renk, onizleme);
  }

  parmak(p: { x: number; y: number } | null): void {
    this.yol.parmakAyarla(p);
  }

  vurgula(hucreler: readonly Konum[] | null, kip: 'zorunlu' | 'ipucu' | 'secim'): void {
    const k = hucreler ? hucreler.map((p) => ({ x: p.x, y: p.y })) : null;
    if (kip === 'zorunlu') this.yol.zorunlu = k;
    else if (kip === 'ipucu') this.yol.ipucu = k;
    else this.yol.secim = k;
  }

  elGoster(yol: readonly Konum[] | null, secenek?: { geriAl?: boolean }): void {
    this.yol.elAyarla(yol, !!secenek?.geriAl);
  }

  /** (P5 ek) Klavye imleci: 3 px krem odak halkası (§13.7); null = gizle. */
  imlecGoster(h: Konum | null): void {
    this.yol.imlec = h ? { x: h.x, y: h.y } : null;
  }

  /**
   * (P5 ek) Kutlama yazısını hemen göster (öğretim senaryosu, §15 Bölüm 3:
   * kural dışı "Harika!"). Reaksiyon olayının kademesi null olsa da çıkar.
   */
  kutla(kademe: string): void {
    if (!this.s.tahta.w) return;
    this.reaksiyonYazisi(kademe);
  }

  hayaletFitil(yol: readonly Konum[] | null, halka: boolean): void {
    this.yol.hayaletAyarla(yol, halka);
  }

  havaiFisek(x: number, y: number, renk: number, desen?: string): void {
    const s = this.s;
    const d = desen ?? s.secenek.desenler[s.rnd.int(Math.max(1, s.secenek.desenler.length))] ?? 'kasimpati';
    const y0 = Math.min(s.ekranH, Math.max(y + 140, this.gok.ufuk + 10));
    this.fisek.firlat(x + (s.rnd.float() - 0.5) * 40, y0, x, y, renk, d, 520 + s.rnd.float() * 160);
  }

  hizlandir(carpan: number): void {
    this.hizCarpani = Math.max(0.1, carpan);
  }

  // ------------------------------------------------------------------ oynatma

  oynat(onceki: OyunDurumu, olaylar: Olay[], sonraki: OyunDurumu): Promise<void> {
    this.bitirAninda();
    const s = this.s;
    if (s.tahta.w !== onceki.w || s.tahta.h !== onceki.h) {
      s.tahta.kur(onceki);
      this.yerlesimGerekli = true;
    } else if (s.tahta.farklar(onceki).length) {
      // Görsel tahta öncekiyle eşit değilse sessizce eşitle (geri sar vb.).
      s.tahta.esitle(onceki);
      this.sandik.isikGuncelle(true);
    }
    this.hizCarpani = 1;
    const n = olaylar.length;
    const o: Oynatma = {
      olaylar,
      i: 0,
      saat: 0,
      son: n ? olaylar[n - 1].t : 0,
      onceki,
      sonraki,
      coz: () => {},
      kaynak: new Array(n).fill(null),
      hedefli: new Uint8Array(n),
      fenerli: new Uint8Array(n),
      yonetmenT: -1,
      yonetmenMerkez: { x: 0, y: 0 },
      fitiller: [],
      dugumZaman: new Map(),
    };
    this.onTarama(o);
    s.oynuyor = true;
    return new Promise<void>((coz) => {
      o.coz = coz;
      this.oynatma = o;
      if (n === 0) this.bitir(o);
    });
  }

  /** Olay listesini önceden tara: hedef kaynakları, fitil zamanları, yönetmen zirvesi. */
  private onTarama(o: Oynatma): void {
    const ol = o.olaylar;
    // Hedef kıvılcımı kaynakları: aynı t'deki en son, sahiplenilmemiş kaynak olay.
    const sahip = new Uint8Array(ol.length);
    for (let i = 0; i < ol.length; i++) {
      const e = ol[i];
      if (e.tur !== 'hedefIlerledi') continue;
      for (let j = i - 1; j >= 0 && ol[j].t >= e.t - 0; j--) {
        const k = ol[j];
        if (sahip[j] || !KAYNAK_OLAYLARI.has(k.tur)) continue;
        sahip[j] = 1;
        o.kaynak[i] = (k as { hucre: Konum }).hucre;
        if (k.tur === 'patlama') o.hedefli[j] = 1;
        if (k.tur === 'fenerToplandi') {
          o.fenerli[i] = 1;
          o.hedefli[j] = 1;
        }
        break;
      }
    }
    // Fitil düğüm zamanları.
    for (let i = 0; i < ol.length; i++) {
      const e = ol[i];
      if (e.tur !== 'fitilBasladi') continue;
      const n = e.yol.length;
      const z = new Float32Array(n);
      let t = 0;
      for (let k = 0; k < n; k++) {
        if (k > 0) t += Math.max(35, 110 - 7 * k);
        z[k] = e.t + t;
      }
      for (let j = i + 1; j < ol.length; j++) {
        const d = ol[j];
        if (d.tur === 'fitilBasladi') break;
        if (d.tur === 'dugumYandi' && d.k >= 1 && d.k <= n) z[d.k - 1] = d.t;
      }
      o.dugumZaman.set(i, z);
    }
    // Yönetmen kamerası (§12.1): R > 12 ya da kombinasyon.
    let r: Extract<Olay, { tur: 'reaksiyon' }> | null = null;
    let kombo = false;
    for (const e of ol) {
      if (e.tur === 'reaksiyon') r = e;
      if (e.tur === 'kombinasyon') kombo = true;
    }
    let zirve = -1;
    let merkez: Konum = { x: 0, y: 0 };
    if (r && (r.boyut > 12 || r.kombo)) {
      zirve = r.zirveT;
      merkez = r.merkez;
    } else if (kombo || this.yonetmenZorlaBayrak) {
      const pencere = new Map<number, { n: number; x: number; y: number }>();
      for (const e of ol) {
        if (e.tur !== 'patlama') continue;
        const w = Math.floor(e.t / 90);
        const p = pencere.get(w) ?? { n: 0, x: 0, y: 0 };
        p.n++;
        p.x += e.hucre.x;
        p.y += e.hucre.y;
        pencere.set(w, p);
      }
      let en = -1;
      let enN = 0;
      for (const [w, p] of pencere) if (p.n > enN) [en, enN] = [w, p.n];
      if (en >= 0) {
        const p = pencere.get(en)!;
        zirve = en * 90 + 45;
        merkez = { x: p.x / p.n, y: p.y / p.n };
      }
    }
    this.yonetmenZorlaBayrak = false;
    if (zirve >= 0) {
      o.yonetmenT = Math.max(0, zirve - 45 - 24);
      o.yonetmenMerkez = merkez;
    }
  }

  private ilerlet(dt: number): void {
    const o = this.oynatma!;
    o.saat += dt;
    if (o.yonetmenT >= 0 && o.saat >= o.yonetmenT) {
      o.yonetmenT = -1;
      const s = this.s;
      s.kamera.yonet(s.mx(o.yonetmenMerkez.x), s.my(o.yonetmenMerkez.y));
    }
    while (o.i < o.olaylar.length && o.olaylar[o.i].t <= o.saat) {
      const i = o.i++;
      this.olayIsle(o, o.olaylar[i], i);
      if (this.oynatma !== o) return;
    }
  }

  private tamamMi(o: Oynatma): boolean {
    if (o.i < o.olaylar.length) return false;
    if (o.saat < o.son + KUYRUK) return false;
    if (this.s.tahta.hareketVar()) return false;
    if (this.ef.bekleyen > 0) return false;
    for (const f of o.fitiller) if (o.saat - f.t0 < f.bitis + 200) return false;
    return true;
  }

  private bitir(o: Oynatma): void {
    if (this.oynatma === o) this.oynatma = null;
    const s = this.s;
    const fark = s.tahta.farklar(o.sonraki);
    this.sonFark = fark.length;
    if (fark.length && this.gelistirme) console.warn(`[çizici] oynatma sonu görsel tahta ≠ sonraki (${fark.length} fark)`, fark.slice(0, 10));
    s.tahta.esitle(o.sonraki);
    this.sandik.isikGuncelle();
    s.oynuyor = false;
    this.hizCarpani = 1;
    if (this.yukluEfekt) {
      this.yukluEfekt.aktif = false;
      this.yukluEfekt = null;
    }
    o.coz();
  }

  /** Süren oynatmayı anında bitir (yeni çağrı geldi). */
  private bitirAninda(): void {
    const o = this.oynatma;
    if (!o) return;
    const s = this.s;
    // Önce yoldaki (daha eski) hedef bildirimleri, sonra kalan olaylar: sayaçlar geri gitmesin.
    this.ef.bildirimleriBitir();
    this.ef.bekleyen = 0;
    while (o.i < o.olaylar.length) {
      const e = o.olaylar[o.i++];
      s.tahta.uygula(e);
      if (DURUM_OLAYLARI.has(e.tur)) this.bildir(e);
    }
    s.kamera.sifirla();
    this.zamanlilar = [];
    for (const h of s.tahta.hucreler) {
      h.hTur = 0;
      h.ox = 0;
      h.oy = 0;
      h.inis = -1;
    }
    this.bitir(o);
  }

  private bildir(o: Olay): void {
    for (const f of this.dinleyiciler) {
      try {
        f(o);
      } catch (e) {
        if (this.gelistirme) console.error('[çizici] dinleyici hatası', e);
      }
    }
  }

  private zamanla(ms: number, fn: () => void): void {
    this.zamanlilar.push({ kalan: ms, fn });
  }

  // ------------------------------------------------------------------ olay → görsel

  private olayIsle(o: Oynatma, e: Olay, i: number): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    switch (e.tur) {
      case 'fitilBasladi':
        this.fitilBaslat(o, e, i);
        break;
      case 'dugumYandi': {
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        const f = this.ef.ekle(E.HUCRE_ISIK, x, y, 160);
        if (f) {
          f.r1 = hc * 0.55;
          f.renk = R.KOZ;
        }
        break;
      }
      case 'patlama':
        this.patlamaGorsel(o, e, i);
        break;
      case 'isindi': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        this.kozler(x, y, 2);
        if (e.kizgin) {
          const f = this.ef.ekle(E.HUCRE_ISIK, x, y, 220);
          if (f) {
            f.r1 = hc * 0.6;
            f.renk = R.BEYAZ_SICAK;
          }
        }
        break;
      }
      case 'isiDegisti': {
        const ic = t.hucre(e.hucre)?.icerik;
        const once = ic?.tur === 'kapsul' ? ic.isi : 0;
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        if (e.isi < once) this.buhar(x, y, 4);
        else if (e.isi > once) this.kozler(x, y, 2);
        break;
      }
      case 'ozelOlustu': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        const f = this.ef.ekle(E.FLAS, x, y, 320);
        if (f) {
          f.r1 = hc * 1.1;
          f.renk = e.ozel === 'yildiz' ? R.BEYAZ : efektRengi(e.renk);
        }
        const k = this.ef.ekle(E.SOK, x, y, 300);
        if (k) {
          k.r1 = hc * 0.8;
          k.r0 = 4;
          k.renk = R.ALTIN;
        }
        this.serpe(x, y, 10, R.ALTIN, 80, 200, 500, 2.4);
        break;
      }
      case 'ozelTetiklendi':
        this.ozelGorsel(e);
        break;
      case 'yuklendi': {
        const idx = t.idx(e.hucre);
        const ic = this.sonIcerik.get(idx) ?? t.hucreler[idx]?.icerik;
        if (ic?.tur === 'kapsul') {
          const x = s.mx(e.hucre.x);
          const y = s.my(e.hucre.y);
          const f = this.ef.ekle(E.YUKLU, x, y - hc * 0.3, 60000);
          if (f) {
            f.icerik = { ...ic };
            this.yukluEfekt = f;
          }
        }
        break;
      }
      case 'kombinasyon':
        this.komboGorsel(e);
        break;
      case 'isiDalgasi': {
        const f = this.ef.ekle(E.ISI_DALGA, s.mx(e.merkez.x), s.my(e.merkez.y), 320);
        if (f) {
          f.r0 = 0.5;
          f.r1 = e.yaricap + 0.5;
        }
        break;
      }
      case 'engelHasar': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        if (e.engel === 'kaya') {
          this.kirinti(x, y, e.kalan <= 0 ? 14 : 6, e.kalan <= 0);
          s.kamera.sars(0.03);
        } else {
          this.damlalar(x, y - hc * 0.2, 10);
          if (e.kalan <= 0) this.kirinti(x, y, 6, false);
          s.kamera.sars(0.03);
        }
        const f = this.ef.ekle(E.HUCRE_ISIK, x, y, 160);
        if (f) {
          f.r1 = hc * 0.55;
          f.renk = e.engel === 'kova' ? R.SU : R.BEYAZ;
        }
        break;
      }
      case 'kafesKirildi': {
        t.uygula(e);
        this.kafesKir(s.mx(e.hucre.x), s.my(e.hucre.y));
        break;
      }
      case 'kurudu':
        t.uygula(e);
        this.buhar(s.mx(e.hucre.x), s.my(e.hucre.y), 6);
        break;
      case 'dosemeAydinlandi': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        this.serpe(x, y, 4, R.ALTIN, 40, 110, 600, 2.6, -40);
        const f = this.ef.ekle(E.HUCRE_ISIK, x, y, 300);
        if (f) {
          f.r1 = hc * 0.75;
          f.renk = R.SICAK_ISIK;
        }
        break;
      }
      case 'desenBoyandi': {
        t.uygula(e);
        this.serpe(s.mx(e.hucre.x), s.my(e.hucre.y), 6, efektRengi(e.renk), 60, 150, 600, 2.6, -30);
        break;
      }
      case 'izYandi':
        this.izYandi(e.hucre);
        break;
      case 'devFisekDoldu': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        this.serpe(x, y - hc * 0.3, 2, R.ALTIN, 30, 70, 300, 2);
        break;
      }
      case 'devFisekFirladi':
        this.devFisekFirlat(e.hucre);
        break;
      case 'isTemizlendi': {
        t.uygula(e);
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        this.ef.ekle(E.DUMAN, x, y, 300);
        this.dumanlar(x, y, 8, 0.55);
        break;
      }
      case 'isYayildi': {
        t.uygula(e);
        this.dumanlar(s.mx(e.hucre.x), s.my(e.hucre.y), 6, 0.7);
        break;
      }
      case 'yercekimi':
        t.uygula(e);
        break;
      case 'fenerToplandi':
        this.fenerUcur(o, e.hucre, i);
        break;
      case 'havaOlayi':
        this.havaGorsel(e);
        break;
      case 'karistirma': {
        t.uygula(e);
        s.kamera.sars(0.1);
        this.bilgiYaz('Sandık sallanıyor…', s.gy + hc * 0.6);
        break;
      }
      case 'hedefIlerledi':
        this.hedefKivilcimi(o, e, i);
        return; // bildirim varışta
      case 'korukKullanildi': {
        const x = s.mx(e.merkez.x);
        const y = s.my(e.merkez.y);
        const f = this.ef.ekle(E.KORUK, x, y, 300);
        if (f) {
          f.r0 = 0.3;
          f.r1 = 1.5;
        }
        this.kozler(x, y, 20, hc * 1.2);
        s.kamera.sars(0.1);
        break;
      }
      case 'guclendirici': {
        const x = s.mx(e.hucre.x);
        const y = s.my(e.hucre.y);
        if (e.guc === 'kibrit') {
          this.ef.ekle(E.KIBRIT, x, y, 420);
          this.serpe(x, y, 8, R.KOZ, 80, 200, 500, 2.2);
        } else {
          this.ef.ekle(E.KALIP, x, y, 380);
          this.serpe(x, y, 6, R.PIRINC, 60, 140, 500, 2.4);
        }
        break;
      }
      case 'finalBasladi': {
        this.bilgiYaz('Şenlik başlıyor!', s.gy + s.tahta.h * hc * 0.42, 'kombo');
        for (let k = 0; k < 3; k++) this.zamanla(k * 260, () => this.gokFisegi());
        break;
      }
      case 'reaksiyon': {
        if (e.kademe) this.reaksiyonYazisi(e.kademe);
        break;
      }
      case 'puanEklendi': {
        // Reaksiyon olayı yoksa kademe yazısı buradan.
        if (e.kademe && !o.olaylar.some((x) => x.tur === 'reaksiyon' && x.kademe)) this.reaksiyonYazisi(e.kademe);
        break;
      }
      case 'bolumBitti': {
        if (e.sonuc === 'kayip') this.karanlikHedef = 0.62;
        else {
          this.parlaHedef = 1;
          for (let k = 0; k < 5; k++) this.zamanla(200 + k * 380, () => this.gokFisegi());
        }
        break;
      }
      default:
        t.uygula(e);
    }
    this.bildir(e);
  }

  private fitilBaslat(o: Oynatma, e: Extract<Olay, { tur: 'fitilBasladi' }>, i: number): void {
    const s = this.s;
    const n = e.yol.length;
    if (n === 0) return;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    e.yol.forEach((p, k) => {
      xs[k] = s.mx(p.x);
      ys[k] = s.my(p.y);
    });
    const ip = new IpCizici();
    ip.ornekle(xs, ys, n, e.halka, s.c * 0.32);
    const z = o.dugumZaman.get(i) ?? new Float32Array(n);
    const k = e.renk >= 0 && e.renk < 6 ? s.kapsulRenk[e.renk] : INCI;
    const renk = fitilRenkleri(s.secenek.fitil, k, n, e.halka);
    o.fitiller.push({ ip, t0: e.t, zaman: z, n, kalin: Math.min(12, 4 + 0.6 * n), renk, bitis: z[n - 1] - e.t, birikim: 0 });
  }

  /** Yanan fitilin alev başı (s değeri) — τ: fitil başından beri tik. */
  private fitilS(f: YananFitil, tau: number): number {
    const z = f.zaman;
    const ip = f.ip;
    const t = tau + f.t0;
    if (t <= z[0]) return 0;
    for (let k = 0; k + 1 < f.n; k++) {
      if (t < z[k + 1]) {
        const u = (t - z[k]) / Math.max(1, z[k + 1] - z[k]);
        const a = ip.dugumS[k] ?? 0;
        const b = ip.dugumS[k + 1] ?? ip.uzunluk;
        return a + (b - a) * u;
      }
    }
    return ip.dugumS[f.n - 1] ?? ip.uzunluk;
  }

  private alevBasi(gecikme: number, c: { x: number; y: number }): boolean {
    const o = this.oynatma;
    if (!o || !o.fitiller.length) return false;
    const f = o.fitiller[o.fitiller.length - 1];
    const tau = o.saat - gecikme - f.t0;
    f.ip.noktaAl(this.fitilS(f, Math.max(0, tau)), c);
    return true;
  }

  private patlamaGorsel(o: Oynatma, e: Extract<Olay, { tur: 'patlama' }>, i: number): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    const idx = t.idx(e.hucre);
    const h = t.hucreler[idx];
    const ic = h?.icerik ? ({ ...h.icerik } as Icerik) : null;
    if (ic) this.sonIcerik.set(idx, ic);
    // Patlamanın çizim merkezi: hücre + (varsa) ofset.
    const x = s.mx(e.hucre.x) + (h ? h.ox * hc : 0);
    const y = s.my(e.hucre.y) + (h ? h.oy * hc : 0);
    t.uygula(e);
    // Ezilme (80 ms) + 2 kare beyaz çekirdek (r 0,6 hücre) + şok halkası.
    if (ic?.tur === 'kapsul') {
      const f = this.ef.ekle(E.EZILME, x, y, 80);
      if (f) f.icerik = ic;
    }
    const cek = this.ef.ekle(E.CEKIRDEK, x, y, 34);
    if (cek) cek.r1 = hc * 0.6;
    const isi = e.neden === 'isi';
    const renk = e.renk >= 0 && e.renk <= 5 ? (isi ? R.SICAK + e.renk : e.renk) : -1;
    const sok = this.ef.ekle(E.SOK, x, y, 220);
    if (sok) {
      sok.r1 = hc * 0.9;
      sok.r0 = 3;
      sok.renk = renk < 0 ? R.BEYAZ : renk;
    }
    // 14–18 renkli parçacık (ısıda 16 + 4 köz).
    const n = s.havuz.adet(isi ? 16 : 14 + s.rnd.int(5));
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = 120 + s.rnd.float() * 140;
      const cizgi = k % 5 < 3;
      const pr = renk < 0 ? R.GOKKUSAGI + (k % 6) : k % 6 === 0 ? R.BEYAZ_SICAK : renk;
      const j = s.havuz.ekle(cizgi ? T.CIZGI : T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, 450 + s.rnd.float() * 250, 2.2 + s.rnd.float() * 1.3, pr, 2.5, 300);
      if (j >= 0 && cizgi) s.havuz.iz[j] = 0.035;
    }
    if (isi) this.kozler(x, y, 4);
    s.kamera.sars(e.neden === 'fitil' ? 0.06 : 0.1);
    // Göğe kıvılcım (hedef kıvılcımı yoksa).
    if (!o.hedefli[i]) this.gokKivilcimi(x, y, renk < 0 ? R.BEYAZ : renk);
  }

  private ozelGorsel(e: Extract<Olay, { tur: 'ozelTetiklendi' }>): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    const idx = t.idx(e.hucre);
    const ic = t.hucreler[idx]?.icerik ?? this.sonIcerik.get(idx) ?? null;
    const renk = ic?.tur === 'kapsul' && ic.renk >= 0 ? ic.renk : R.BEYAZ;
    const x = s.mx(e.hucre.x);
    const y = s.my(e.hucre.y);
    s.kamera.hitStop(50);
    if (e.ozel === 'roket') {
      const f = this.ef.ekle(E.FLAS, x, y, 200);
      if (f) {
        f.r1 = hc * 1.3;
        f.renk = R.BEYAZ_SICAK;
      }
      this.roketler(e.hucre, e.eksen, renk, 0.26);
      s.kamera.sars(0.25);
    } else if (e.ozel === 'kasimpati') {
      const k = this.ef.ekle(E.SOK, x, y, 300);
      if (k) {
        k.r1 = hc * 1.6;
        k.r0 = 5;
        k.renk = renk;
      }
      const b = this.ef.ekle(E.BOZULMA, x, y, 300, 60);
      if (b) {
        b.r1 = hc * 2.5;
        b.renk = renk;
      }
      // Halka biçimli patlama: 24 radyal + 16 köz.
      const n = s.havuz.adet(24);
      for (let k2 = 0; k2 < n; k2++) {
        const a = (k2 / n) * Math.PI * 2;
        const v = 260 + s.rnd.float() * 120;
        const j = s.havuz.ekle(T.CIZGI, x + Math.cos(a) * hc * 0.3, y + Math.sin(a) * hc * 0.3, Math.cos(a) * v, Math.sin(a) * v, 520 + s.rnd.float() * 200, 2.8, k2 % 3 ? renk : R.BEYAZ_SICAK, 2.6, 160);
        if (j >= 0) s.havuz.iz[j] = 0.05;
      }
      this.kozler(x, y, 16, hc * 0.5);
      s.kamera.sars(0.35);
    } else if (e.ozel === 'yildiz') {
      const hedef = e.hedefRenk ?? this.enCokRenk();
      const liste: { i: number; d: number }[] = [];
      t.hucreler.forEach((h, j) => {
        if (j === idx || h.icerik?.tur !== 'kapsul' || h.icerik.renk !== hedef) return;
        const dx = (j % t.w) - e.hucre.x;
        const dy = ((j / t.w) | 0) - e.hucre.y;
        liste.push({ i: j, d: dx * dx + dy * dy });
      });
      liste.sort((a, b) => a.d - b.d || a.i - b.i);
      liste.forEach((h, k) => {
        const f = this.ef.ekle(E.ISIN, x, y, 220, 20 * (k + 1));
        if (!f) return;
        f.x1 = s.mx(h.i % t.w);
        f.y1 = s.my((h.i / t.w) | 0);
        f.renk = R.GOKKUSAGI + (k % 6);
        f.sayi = k;
      });
      const f = this.ef.ekle(E.FLAS, x, y, 260);
      if (f) {
        f.r1 = hc * 1.4;
        f.renk = R.BEYAZ;
      }
      const n = s.havuz.adet(24);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const v = 140 + s.rnd.float() * 160;
        s.havuz.ekle(T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, 520, 3, R.GOKKUSAGI + (k % 6), 2.4, 80);
      }
      s.kamera.sars(0.3);
    }
  }

  /** Roket başları: eksenin iki yönünde, 25 tik/hücre, tahta kenarına kadar. */
  private roketler(p: Konum, eksen: Eksen, renk: number, kalin: number, adim = 25): void {
    const yon: [number, number] = eksen === 0 ? [1, 0] : eksen === 1 ? [0, 1] : eksen === 2 ? [1, -1] : [1, 1];
    this.roketBasi(p, yon[0], yon[1], renk, kalin, adim);
    this.roketBasi(p, -yon[0], -yon[1], renk, kalin, adim);
  }

  private roketBasi(p: Konum, dx: number, dy: number, renk: number, kalin: number, adim: number): Efekt | null {
    const s = this.s;
    const t = s.tahta;
    if (dx === 0 && dy === 0) return null;
    let d = 0;
    while (p.x + dx * (d + 1) >= 0 && p.x + dx * (d + 1) < t.w && p.y + dy * (d + 1) >= 0 && p.y + dy * (d + 1) < t.h) d++;
    const uz = d + 0.5;
    const f = this.ef.ekle(E.ROKET, s.mx(p.x), s.my(p.y), adim * uz);
    if (!f) return null;
    f.x1 = s.mx(p.x) + dx * uz * s.c;
    f.y1 = s.my(p.y) + dy * uz * s.c;
    f.dx = dx;
    f.dy = dy;
    f.renk = renk < 0 || renk > 28 ? R.BEYAZ : renk;
    f.r0 = kalin;
    f.sayi = 1;
    return f;
  }

  private komboGorsel(e: Extract<Olay, { tur: 'kombinasyon' }>): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    const x = s.mx(e.hucre.x);
    const y = s.my(e.hucre.y);
    s.kamera.hitStop(80);
    s.kamera.flasIste(0.35, 120);
    s.kamera.sars(e.kombo === 'buyukFinal' ? 0.8 : 0.5);
    // Yüklü taş birleşir.
    if (this.yukluEfekt) {
      this.yukluEfekt.aktif = false;
      this.yukluEfekt = null;
    }
    const f = this.ef.ekle(E.FLAS, x, y, 300);
    if (f) {
      f.r1 = hc * 2;
      f.renk = R.BEYAZ_SICAK;
    }
    // 40 parçalık patlama.
    const n = s.havuz.adet(40);
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = 160 + s.rnd.float() * 280;
      const j = s.havuz.ekle(k % 2 ? T.CIZGI : T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, 600 + s.rnd.float() * 300, 3, k % 4 === 0 ? R.BEYAZ_SICAK : k % 4 === 1 ? R.ALTIN : R.GOKKUSAGI + (k % 6), 2.2, 200);
      if (j >= 0) s.havuz.iz[j] = 0.05;
    }
    this.bilgiYaz(`${KOMBO_ADLARI[e.kombo]}!`, s.my(e.hucre.y) - hc * 0.9, 'kombo', s.mx(e.hucre.x));
    const idx = t.idx(e.hucre);
    const roketEksen = (): Eksen => {
      for (const ic of [this.yukluEfekt?.icerik, this.sonIcerik.get(idx), t.hucreler[idx]?.icerik]) {
        if (ic?.tur === 'kapsul' && ic.ozel === 'roket') return ic.eksen;
      }
      for (const ic of this.sonIcerik.values()) if (ic.tur === 'kapsul' && ic.ozel === 'roket') return ic.eksen;
      return 0;
    };
    switch (e.kombo) {
      case 'yildizHatti':
        for (const ek of [0, 1, 2, 3] as Eksen[]) this.roketler(e.hucre, ek, R.ALTIN, 0.28);
        break;
      case 'kalinRoket': {
        const ek = roketEksen();
        const yon: [number, number] = ek === 0 ? [1, 0] : ek === 1 ? [0, 1] : ek === 2 ? [1, -1] : [1, 1];
        const kay: [number, number][] = ek === 0 ? [[0, -1], [0, 0], [0, 1]] : [[-1, 0], [0, 0], [1, 0]];
        for (const [ox, oy] of kay) {
          const p = { x: e.hucre.x + ox, y: e.hucre.y + oy };
          if (!s.icinde(p)) continue;
          for (const sg of [1, -1]) this.roketBasi(p, yon[0] * sg, yon[1] * sg, R.ALTIN, 0.36, 25);
        }
        break;
      }
      case 'devKasimpati': {
        const b = this.ef.ekle(E.BOZULMA, x, y, 420, 40);
        if (b) {
          b.r1 = hc * 3.5;
          b.renk = R.ALTIN;
        }
        const k = this.ef.ekle(E.SOK, x, y, 360);
        if (k) {
          k.r1 = hc * 2.4;
          k.r0 = 6;
          k.renk = R.BEYAZ_SICAK;
        }
        const d = this.ef.ekle(E.ISI_DALGA, x, y, 420, 90);
        if (d) {
          d.r0 = 2.5;
          d.r1 = 3.5;
        }
        break;
      }
      case 'roketYagmuru':
      case 'bahce':
        this.serpe(x, y, 20, R.GOKKUSAGI, 120, 260, 700, 3);
        break;
      case 'buyukFinal': {
        const enUzak = Math.max(e.hucre.x, t.w - 1 - e.hucre.x, e.hucre.y, t.h - 1 - e.hucre.y);
        for (let d = 1; d <= Math.min(8, enUzak); d++) {
          const r = this.ef.ekle(E.FINAL_HALKA, x, y, 280, 40 * d);
          if (r) {
            r.r1 = d;
            r.renk = R.GOKKUSAGI + (d % 6);
          }
          this.zamanla(40 * d, () => {
            const m = s.havuz.adet(30);
            const R0 = (d + 0.5) * hc;
            for (let k = 0; k < m; k++) {
              const u = (k / m) * 8;
              const kenar = Math.floor(u);
              const f2 = u - kenar;
              const px = kenar % 2 === 0 ? -R0 + 2 * R0 * f2 : kenar === 1 || kenar === 5 ? R0 : -R0;
              const py = kenar % 2 === 1 ? -R0 + 2 * R0 * f2 : kenar < 4 ? -R0 : R0;
              const a = Math.atan2(py, px);
              s.havuz.ekle(T.NOKTA, x + px, y + py, Math.cos(a) * 60, Math.sin(a) * 60, 500, 2.6, R.GOKKUSAGI + ((k + d) % 6), 2, 60);
            }
          });
        }
        break;
      }
    }
  }

  private izYandi(p: Konum): void {
    const s = this.s;
    const t = s.tahta;
    t.uygula({ t: 0, tur: 'izYandi', hucre: p });
    const x = s.mx(p.x);
    const y = s.my(p.y);
    this.serpe(x, y, 5, R.KOZ, 50, 140, 420, 2, -20);
    const idx = t.idx(p);
    for (const iz of t.izler) {
      const j = iz.indexOf(idx);
      if (j < 0) continue;
      for (const k of [j - 1, j + 1]) {
        if (k < 0 || k >= iz.length || t.hucreler[iz[k]].izYandi) continue;
        const f = this.ef.ekle(E.IZ_KIVILCIM, x, y, 60);
        if (!f) continue;
        f.x1 = s.mx(iz[k] % t.w);
        f.y1 = s.my((iz[k] / t.w) | 0);
        f.dx = f.x1 - x;
        f.dy = f.y1 - y;
        f.renk = R.KOZ;
      }
    }
  }

  private devFisekFirlat(p: Konum): void {
    const s = this.s;
    const hc = s.c;
    const x = s.mx(p.x);
    const y = s.my(p.y);
    s.tahta.uygula({ t: 0, tur: 'devFisekFirladi', hucre: p });
    s.kamera.sars(0.4);
    const f = this.ef.ekle(E.FLAS, x, y, 260);
    if (f) {
      f.r1 = hc * 1.6;
      f.renk = R.KOZ;
    }
    this.dumanlar(x, y + hc * 0.3, 24, 0.6);
    this.serpe(x, y, 50, R.ALTIN, 80, 300, 700, 2.4);
    // Yukarı iz: 30 tik/hücre, tahtadan çıkıp göğe.
    const uz = p.y + 1.5;
    const r = this.ef.ekle(E.ROKET, x, y, 30 * uz);
    if (!r) return;
    r.x1 = x;
    r.y1 = y - uz * hc;
    r.dx = 0;
    r.dy = -1;
    r.renk = R.ALTIN;
    r.r0 = 0.4;
    r.bitince = () => {
      s.ekrana(x, y - uz * hc, this.nokta);
      const g = s.gokBandi;
      const hx = Math.max(40, Math.min(s.ekranW - 40, this.nokta.x));
      this.fisek.firlat(this.nokta.x, this.nokta.y, hx, g.y + g.h * 0.42, s.rnd.int(6), s.rnd.float() < 0.5 ? 'kasimpati' : 'palmiye', 380, this.fisek.olcek() * 1.25);
    };
  }

  private fenerUcur(o: Oynatma, p: Konum, i: number): void {
    const s = this.s;
    const t = s.tahta;
    const x = s.mx(p.x);
    const y = s.my(p.y);
    t.uygula({ t: 0, tur: 'fenerToplandi', hucre: p });
    s.ekrana(x, y, this.nokta);
    const hedefIndeks = this.hedefler.findIndex((h) => h.tur === 'fener');
    const hk = hedefIndeks >= 0 ? this.hedefKonum[hedefIndeks] : null;
    const f = this.ef.ekle(E.FENER, this.nokta.x, this.nokta.y, 600);
    if (!f) return;
    f.ekran = true;
    f.x1 = hk ? hk.x : this.nokta.x;
    f.y1 = hk ? hk.y : s.gokBandi.y + 20;
    f.cx = (f.x + f.x1) / 2 + 40;
    f.cy = Math.min(f.y, f.y1) - 80;
    // Eşlenen hedef bildirimi fener varınca.
    for (let j = i + 1; j < o.olaylar.length && o.olaylar[j].t === o.olaylar[i].t; j++) {
      const h = o.olaylar[j];
      if (h.tur === 'hedefIlerledi' && o.fenerli[j]) {
        o.fenerli[j] = 2;
        this.ef.bekleyen++;
        f.bitince = () => {
          this.ef.bekleyen = Math.max(0, this.ef.bekleyen - 1);
          this.kartPatlamasi(f.x1, f.y1, h.tamam);
          this.bildir(h);
        };
        break;
      }
    }
  }

  private hedefKivilcimi(o: Oynatma, e: Extract<Olay, { tur: 'hedefIlerledi' }>, i: number): void {
    const s = this.s;
    if (o.fenerli[i] === 2) return; // fener uçuşu bildirecek
    const kaynak = o.kaynak[i];
    const hk = this.hedefKonum[e.indeks];
    if (!kaynak || !hk) {
      if (hk && e.tamam) this.kartPatlamasi(hk.x, hk.y, true);
      this.bildir(e);
      return;
    }
    const h = s.tahta.hucre(kaynak);
    s.ekrana(s.mx(kaynak.x) + (h ? h.ox * s.c : 0), s.my(kaynak.y) + (h ? h.oy * s.c : 0), this.nokta);
    const f = this.ef.ekle(E.KIVILCIM, this.nokta.x, this.nokta.y, 450);
    if (!f) {
      this.bildir(e);
      return;
    }
    f.ekran = true;
    f.x1 = hk.x;
    f.y1 = hk.y;
    f.cx = f.x + (f.x1 - f.x) * 0.25 + (s.rnd.float() - 0.5) * 80;
    f.cy = Math.min(f.y, f.y1) - 60 - s.rnd.float() * 60;
    const hedef = this.hedefler[e.indeks];
    f.renk = hedef?.tur === 'topla' && hedef.renk !== 'hepsi' ? efektRengi(hedef.renk) : R.ALTIN;
    this.ef.bekleyen++;
    f.bitince = () => {
      this.ef.bekleyen = Math.max(0, this.ef.bekleyen - 1);
      this.kartPatlamasi(f.x1, f.y1, e.tamam);
      this.bildir(e);
    };
  }

  /** Hedef kartında küçük patlama; tamamlandıysa 10 altın. */
  private kartPatlamasi(x: number, y: number, tamam: boolean): void {
    const s = this.s;
    const n = s.havuz.adet(tamam ? 10 : 4);
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = (tamam ? 90 : 50) + s.rnd.float() * 90;
      const j = s.havuz.ekle(T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, tamam ? 650 : 360, tamam ? 3 : 2.2, R.ALTIN, 2.5, tamam ? 120 : 0);
      if (j >= 0) s.havuz.bayrak[j] |= B.UST;
    }
  }

  /** Göğe Bezier kıvılcım (700 ms); her 10'da bir gökte havai fişek. */
  private gokKivilcimi(x: number, y: number, renk: number): void {
    const s = this.s;
    s.ekrana(x, y, this.nokta);
    const g = s.gokBandi;
    const f = this.ef.ekle(E.KIVILCIM, this.nokta.x, this.nokta.y, 700);
    if (!f) return;
    f.ekran = true;
    f.renk = renk;
    f.x1 = g.x + g.w * (0.08 + 0.84 * s.rnd.float());
    f.y1 = g.y + g.h * (0.3 + 0.5 * s.rnd.float());
    f.cx = (f.x + f.x1) / 2 + (s.rnd.float() - 0.5) * 120;
    f.cy = Math.min(f.y, f.y1) - 40;
    f.bitince = () => {
      this.gokSayac++;
      const j = s.havuz.ekle(T.NOKTA, f.x1, f.y1, 0, 0, 300, 6, renk, 0, 0);
      if (j >= 0) s.havuz.bayrak[j] = B.GOK | B.SABIT_BOY;
      if (this.gokSayac % 10 === 0) this.gokFisegi(f.x1, f.y1, renk < 6 ? renk : -1);
    };
  }

  /** Gök bandında rastgele (ya da verilen yerde) takılı desenlerden fişek. */
  private gokFisegi(x?: number, y?: number, renk?: number): void {
    const s = this.s;
    const g = s.gokBandi;
    const px = x ?? g.x + g.w * (0.15 + 0.7 * s.rnd.float());
    const py = y ?? g.y + g.h * (0.36 + 0.42 * s.rnd.float());
    const d = s.secenek.desenler[s.rnd.int(Math.max(1, s.secenek.desenler.length))] ?? DESENLER[0].id;
    this.fisek.firlat(px + (s.rnd.float() - 0.5) * 30, Math.min(s.ekranH, this.gok.ufuk + 10), px, py, renk ?? s.rnd.int(6), d, 600);
  }

  private reaksiyonYazisi(kademe: string): void {
    const s = this.s;
    const x = s.gx + (s.tahta.w * s.c) / 2;
    const y = s.gy + s.tahta.h * s.c * 0.38;
    this.yazi.goster(REAKSIYON_METNI[kademe] ?? kademe, STILLER[kademe] ?? STILLER.guzel, x, y, Math.min(2, s.dpr));
    // Yazı çevresinde 20 kıvılcım.
    const n = s.havuz.adet(20);
    const rx = this.yazi.genislik / 2 + 24;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const px = x + Math.cos(a) * rx;
      const py = y + Math.sin(a) * 34;
      const j = s.havuz.ekle(T.CIZGI, px, py, Math.cos(a) * 120, Math.sin(a) * 70 - 30, 600, 2.4, k % 3 ? R.ALTIN : R.BEYAZ_SICAK, 2, 90);
      if (j >= 0) {
        s.havuz.iz[j] = 0.05;
        s.havuz.bayrak[j] |= B.UST;
      }
    }
    if (kademe === 'senlik' || kademe === 'muhtesem') for (let k = 0; k < (kademe === 'senlik' ? 3 : 1); k++) this.zamanla(120 + k * 300, () => this.gokFisegi());
  }

  private bilgiYaz(metin: string, y: number, stil: 'bilgi' | 'kombo' = 'bilgi', x?: number): void {
    const s = this.s;
    const bx = x ?? s.gx + (s.tahta.w * s.c) / 2;
    const yari = (STILLER[stil].boyut * metin.length) / 4;
    const gx = Math.max(s.gx + yari, Math.min(s.gx + s.tahta.w * s.c - yari, bx));
    this.bilgi.goster(metin, STILLER[stil], gx, y, Math.min(2, s.dpr));
  }

  private havaGorsel(e: Extract<Olay, { tur: 'havaOlayi' }>): void {
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    if (e.uyari) {
      if (!this.uyarilar.some((u) => u.eksen === e.eksen && u.hat === e.hat && u.olay === e.olay)) this.uyarilar.push({ olay: e.olay, eksen: e.eksen, hat: e.hat });
      return;
    }
    this.uyarilar = this.uyarilar.filter((u) => !(u.eksen === e.eksen && u.hat === e.hat));
    const satir = e.eksen === 'satir';
    const x0 = satir ? s.gx : s.gx + e.hat * hc;
    const y0 = satir ? s.gy + e.hat * hc : s.gy;
    const w = satir ? t.w * hc : hc;
    const h = satir ? hc : t.h * hc;
    const f = this.ef.ekle(E.HAVA, x0, y0, 520);
    if (f) {
      f.x1 = w;
      f.y1 = h;
      f.renk = e.olay === 'meltem' ? R.KOZ : R.SU;
    }
    const n = s.havuz.adet(18);
    for (let k = 0; k < n; k++) {
      if (e.olay === 'meltem') {
        const px = satir ? x0 - hc * 0.5 : x0 + s.rnd.float() * w;
        const py = satir ? y0 + s.rnd.float() * h : y0 - hc * 0.5;
        const j = s.havuz.ekle(T.CIZGI, px, py, satir ? 420 + s.rnd.float() * 160 : 0, satir ? 0 : 420 + s.rnd.float() * 160, 600 + s.rnd.float() * 300, 2, k % 2 ? R.KOZ : R.SICAK_ISIK, 0.8, 0);
        if (j >= 0) {
          s.havuz.iz[j] = 0.08;
          s.havuz.yas[j] = -s.rnd.float() * 200;
        }
      } else {
        const px = x0 + s.rnd.float() * w;
        const py = y0 + s.rnd.float() * h - hc * 1.2;
        const j = s.havuz.ekle(T.CIZGI, px, py, -20, 380 + s.rnd.float() * 120, 320, 1.6, R.SU, 0, 400);
        if (j >= 0) {
          s.havuz.iz[j] = 0.05;
          s.havuz.yas[j] = -s.rnd.float() * 250;
        }
      }
    }
  }

  // ------------------------------------------------------------------ parçacık yardımcıları

  private serpe(x: number, y: number, n0: number, renk: number, v0: number, v1: number, omur: number, boy: number, yer = 140): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = v0 + s.rnd.float() * (v1 - v0);
      const pr = renk === R.GOKKUSAGI ? R.GOKKUSAGI + (k % 6) : renk;
      s.havuz.ekle(T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, omur * (0.8 + 0.4 * s.rnd.float()), boy, pr, 2.4, yer);
    }
  }

  private kozler(x: number, y: number, n0: number, yayilma = 0): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 2.4;
      const v = 30 + s.rnd.float() * 60;
      s.havuz.ekle(T.KOZ, x + (s.rnd.float() - 0.5) * (8 + yayilma), y + (s.rnd.float() - 0.5) * (8 + yayilma), Math.cos(a) * v, Math.sin(a) * v, 500 + s.rnd.float() * 400, 1.6 + s.rnd.float() * 1.2, R.KOZ, 1.8, -50);
    }
  }

  private buhar(x: number, y: number, n0: number): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const j = s.havuz.ekle(T.DUMAN, x + (s.rnd.float() - 0.5) * s.c * 0.5, y - s.c * 0.1, (s.rnd.float() - 0.5) * 20, -30 - s.rnd.float() * 30, 600 + s.rnd.float() * 300, s.c * 0.22, R.BUHAR, 1.2, -20);
      if (j >= 0) {
        s.havuz.buyume[j] = 1.4;
        s.havuz.alfa[j] = 0.45;
      }
      s.havuz.ekle(T.NOKTA, x, y, (s.rnd.float() - 0.5) * 40, -40 - s.rnd.float() * 40, 500, 2, R.BUHAR, 1.5, -30);
    }
  }

  private dumanlar(x: number, y: number, n0: number, alfa: number): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const a = s.rnd.float() * Math.PI * 2;
      const v = 20 + s.rnd.float() * 70;
      const j = s.havuz.ekle(T.DUMAN, x + Math.cos(a) * s.c * 0.15, y + Math.sin(a) * s.c * 0.15, Math.cos(a) * v, Math.sin(a) * v - 15, 600 + s.rnd.float() * 500, s.c * (0.18 + s.rnd.float() * 0.14), R.DUMAN, 1.6, -15);
      if (j >= 0) {
        s.havuz.buyume[j] = 1.2;
        s.havuz.alfa[j] = alfa;
        s.havuz.donusHizi[j] = (s.rnd.float() - 0.5) * 2;
      }
    }
  }

  private kirinti(x: number, y: number, n0: number, buyuk: boolean): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 2.8;
      const v = 90 + s.rnd.float() * (buyuk ? 220 : 150);
      const j = s.havuz.ekle(T.KIRINTI, x + (s.rnd.float() - 0.5) * s.c * 0.4, y + (s.rnd.float() - 0.5) * s.c * 0.3, Math.cos(a) * v, Math.sin(a) * v, 600 + s.rnd.float() * 300, (buyuk ? 0.62 : 0.42) + s.rnd.float() * 0.3, R.TAS, 1.2, 900);
      if (j >= 0) s.havuz.donusHizi[j] = (s.rnd.float() - 0.5) * 14;
    }
    this.dumanlar(x, y, buyuk ? 6 : 3, 0.35);
  }

  private damlalar(x: number, y: number, n0: number): void {
    const s = this.s;
    const n = s.havuz.adet(n0);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 2;
      const v = 110 + s.rnd.float() * 150;
      s.havuz.ekle(T.NOKTA, x, y, Math.cos(a) * v, Math.sin(a) * v, 520 + s.rnd.float() * 200, 2.6, R.SU, 1, 800);
    }
  }

  private kafesKir(x: number, y: number): void {
    const s = this.s;
    const hc = s.c;
    s.kamera.sars(0.05);
    const ofs = [-0.26, 0, 0.26, 0];
    for (let k = 0; k < 4; k++) {
      const yatay = k === 3;
      const px = x + ofs[k] * hc;
      const j = s.havuz.ekle(T.CUBUK, px, y, (k - 1.5) * 70 + (s.rnd.float() - 0.5) * 40, -160 - s.rnd.float() * 100, 500, (hc * 0.8) / 48, R.PIRINC, 0.5, 1100);
      if (j >= 0) {
        s.havuz.donus[j] = yatay ? Math.PI / 2 : 0;
        s.havuz.donusHizi[j] = (s.rnd.float() < 0.5 ? -1 : 1) * (5 + s.rnd.float() * 5);
      }
    }
    this.serpe(x, y, 6, R.ALTIN, 90, 200, 500, 2.2);
  }

  private enCokRenk(): number {
    const say = [0, 0, 0, 0, 0, 0];
    for (const h of this.s.tahta.hucreler) if (h.icerik?.tur === 'kapsul' && h.icerik.renk >= 0) say[h.icerik.renk]++;
    let en = 0;
    for (let k = 1; k < 6; k++) if (say[k] > say[en]) en = k;
    return en;
  }

  // ------------------------------------------------------------------ kare

  kare(dtMs: number): void {
    if (this.yokEdildi) return;
    const t0 = simdiMs();
    if (!this.donuk) this.guncelle(dtMs);
    else if (this.yerlesimGerekli && this.s.tahta.w) this.yerlesim();
    this.ciz();
    this.kaliteIzle(t0, simdiMs() - t0);
  }

  private guncelle(dtMs: number): void {
    const s = this.s;
    if (this.yerlesimGerekli && this.s.tahta.w) this.yerlesim();
    const gercek = Math.max(0, Math.min(50, dtMs));
    s.zaman += gercek;
    s.kamera.guncelle(gercek);
    const olcek = s.kamera.zamanOlcegi;
    const hiz = s.secenek.hiz * (this.oynatma ? this.hizCarpani : 1);
    const oyunDt = gercek * olcek * hiz;
    const efDt = gercek * olcek * (1 + (hiz - 1) * 0.5);
    s.oyunZamani += oyunDt;
    // Zamanlanmış geri çağrılar (oyun zamanı).
    if (this.zamanlilar.length) {
      for (let k = this.zamanlilar.length - 1; k >= 0; k--) {
        const z = this.zamanlilar[k];
        z.kalan -= oyunDt;
        if (z.kalan <= 0) {
          this.zamanlilar.splice(k, 1);
          z.fn();
        }
      }
    }
    if (this.oynatma) this.ilerlet(oyunDt);
    s.tahta.guncelle(oyunDt);
    this.ef.guncelle(oyunDt);
    s.havuz.guncelle(efDt);
    this.fisek.guncelle(efDt);
    this.gok.guncelle(efDt);
    this.yazi.guncelle(gercek * Math.max(olcek, 0.3));
    this.bilgi.guncelle(gercek * Math.max(olcek, 0.3));
    this.yol.guncelle(gercek);
    this.fitilGuncelle(oyunDt);
    this.kizginKozler(efDt);
    // Kararma ve sandık parlaması
    const k = Math.min(1, gercek / 400);
    this.karanlik += (this.karanlikHedef - this.karanlik) * Math.min(1, k * 3);
    this.sandik.parla += (this.parlaHedef - this.sandik.parla) * Math.min(1, gercek / 600);
    const o = this.oynatma;
    if (o && this.tamamMi(o)) this.bitir(o);
  }

  private fitilGuncelle(dt: number): void {
    const o = this.oynatma;
    if (!o) return;
    const s = this.s;
    for (const f of o.fitiller) {
      const tau = o.saat - f.t0;
      if (tau < 0 || tau > f.bitis + 20) continue;
      // Alev başı 40/sn iz.
      f.birikim += (dt / 1000) * 40;
      if (f.birikim < 1) continue;
      f.ip.noktaAl(this.fitilS(f, tau), this.nokta);
      while (f.birikim >= 1) {
        f.birikim -= 1;
        const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 2.6;
        const v = 40 + s.rnd.float() * 90;
        const j = s.havuz.ekle(s.rnd.float() < 0.5 ? T.KOZ : T.CIZGI, this.nokta.x, this.nokta.y, Math.cos(a) * v, Math.sin(a) * v, 300 + s.rnd.float() * 260, 1.6 + s.rnd.float(), s.rnd.float() < 0.3 ? R.BEYAZ_SICAK : R.KOZ, 2.5, 80);
        if (j >= 0) s.havuz.iz[j] = 0.035;
      }
    }
  }

  /** Kızgın kapsüllerden köz (6/sn); boştayken ısınmışlardan seyrek. */
  private kizginKozler(dt: number): void {
    const s = this.s;
    const t = s.tahta;
    if (dt <= 0 || t.gizliIsi === undefined) return;
    const sn = dt / 1000;
    for (let i = 0; i < t.hucreler.length; i++) {
      const h = t.hucreler[i];
      const ic = h.icerik;
      if (!ic || ic.tur !== 'kapsul' || ic.isi <= 0 || h.gizli) continue;
      const kz = h.kizgin > 0.5;
      if (t.gizliIsi && !kz) continue;
      const oran = kz ? 6 : s.oynuyor ? 0 : 0.5 * ic.isi;
      if (oran <= 0 || s.rnd.float() > oran * sn) continue;
      const x = s.mx(i % t.w) + h.ox * s.c + (s.rnd.float() - 0.5) * s.c * 0.5;
      const y = s.my((i / t.w) | 0) + h.oy * s.c - s.c * 0.2;
      const a = -Math.PI / 2 + (s.rnd.float() - 0.5) * 1.6;
      const v = 25 + s.rnd.float() * 45;
      s.havuz.ekle(T.KOZ, x, y, Math.cos(a) * v, Math.sin(a) * v, 600 + s.rnd.float() * 500, 1.4 + s.rnd.float() * (kz ? 1.4 : 0.6), kz && s.rnd.float() < 0.3 ? R.BEYAZ_SICAK : R.KOZ, 1.6, -40);
    }
  }

  /**
   * Otomatik kalite (§16.6). Ölçüt kare ARALIĞI (rAF), eşik ekran tazelemesine
   * göre: 60 Hz'de 30 karelik ortalama > ~22 ms ise düşer. Yükseltme için kare
   * aralığı tazelemeye yetişmeli VE karenin JS iş süresi aralığın yarısından az
   * olmalı (oynatma yokken); gereken iyi pencere sayısı her düşüşte ikiye
   * katlanır (zorlanan cihazda kalite gidip gelmesin). 100 ms'den uzun kareler
   * (sekme dönüşü, pişirme) ve pişirmeden sonraki 30 kare ölçülmez.
   */
  private kaliteIzle(t0: number, is: number): void {
    const s = this.s;
    const onceki = this.sonKareZamani;
    this.sonKareZamani = t0;
    if (s.secenek.kalite !== 'oto' || !onceki) return;
    const aralik = t0 - onceki;
    if (aralik > 100 || aralik <= 0) {
      this.kaliteAtla = Math.max(this.kaliteAtla, 10);
      this.pAralik = this.pIs = this.pN = 0;
      return;
    }
    if (this.kaliteAtla > 0) {
      this.kaliteAtla--;
      return;
    }
    this.pAralik += aralik;
    this.pIs += is;
    this.pN++;
    if (this.pN < 30) return;
    const ort = this.pAralik / this.pN;
    const isOrt = this.pIs / this.pN;
    this.pAralik = this.pIs = this.pN = 0;
    if (ort < this.tazeleme) this.tazeleme = Math.max(6, ort);
    const esik = Math.max(this.tazeleme * 1.3, this.tazeleme + 5);
    if (!this.dusukKalite) {
      if (ort > esik) {
        this.dusukKalite = true;
        this.iyiPencere = 0;
        this.kaliteUygula();
      }
      return;
    }
    const iyi = !this.oynatma && ort <= this.tazeleme * 1.12 && isOrt < this.tazeleme * 0.5;
    this.iyiPencere = iyi ? this.iyiPencere + 1 : 0;
    if (this.iyiPencere >= this.gerekenIyi) {
      this.dusukKalite = false;
      this.iyiPencere = 0;
      this.gerekenIyi = Math.min(64, this.gerekenIyi * 2);
      this.kaliteUygula();
    }
  }

  private donusumler(): void {
    const s = this.s;
    const d = s.dpr;
    const k = s.kamera;
    s.tEkran.kur(d, 0, 0, d, 0, 0);
    s.tGok.kur(d, 0, 0, d, k.kx * 0.3 * d, k.ky * 0.3 * d);
    const z = k.zoom;
    const fx = k.yonetmenAcik() ? k.odakX : s.gx + (s.tahta.w * s.c) / 2;
    const fy = k.yonetmenAcik() ? k.odakY : s.gy + (s.tahta.h * s.c) / 2;
    const co = Math.cos(k.aci) * z;
    const si = Math.sin(k.aci) * z;
    s.tTahta.kur(d * co, d * si, -d * si, d * co, d * (k.kx + fx - (co * fx - si * fy)), d * (k.ky + fy - (si * fx + co * fy)));
  }

  private ciz(): void {
    const s = this.s;
    const ctx = this.stage.begin();
    if (!s.tahta.w || this.yerlesimGerekli) {
      ctx.fillStyle = P.gokUst;
      ctx.fillRect(0, 0, this.stage.width, this.stage.height);
      return;
    }
    this.donusumler();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // 1. Arka plan
    s.tEkran.uygula(ctx);
    if (this.yalnizGokBayrak) {
      // Desen ızgarası (geliştirme): yalın gece gradyanı.
      const g = ctx.createLinearGradient(0, 0, 0, s.ekranH);
      g.addColorStop(0, P.gokUst);
      g.addColorStop(1, P.gokAlt);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s.ekranW, s.ekranH);
    } else this.gok.cizArka(ctx, s.zaman);
    // Gök ışığı kasabanın arkasında; fişeklerin kendisi kasabanın önünde
    // (telefonda gök bandı dar, HUD kartları da üstünde: fişek görünür kalsın).
    s.tGok.uygula(ctx);
    this.fisek.cizIsik(ctx);
    if (!this.yalnizGokBayrak) {
      s.tEkran.uygula(ctx);
      this.gok.cizOn(ctx, s.zaman);
    }
    s.tGok.uygula(ctx);
    s.havuz.ciz(ctx, s.parilti, s.tGok, B.GOK, s.zaman);
    this.fisek.cizKovan(ctx);
    s.tEkran.uygula(ctx);
    if (this.yalnizGokBayrak) return;
    if (this.sovAcik) {
      this.ortuCiz(ctx);
      return;
    }
    // 2–3. Sandık ve tahta (kamera)
    s.tTahta.uygula(ctx);
    this.sandik.ciz(ctx);
    this.tc.zemin(ctx);
    this.havaUyarilari(ctx);
    this.tc.icerik(ctx);
    this.yol.cizVurgu(ctx);
    this.yananFitiller(ctx);
    this.ef.cizTahta(ctx);
    s.havuz.ciz(ctx, s.parilti, s.tTahta, 0, s.zaman);
    this.yol.ciz(ctx);
    this.yol.cizEl(ctx);
    // Ekran üstü
    s.tEkran.uygula(ctx);
    this.ef.cizEkran(ctx);
    s.havuz.ciz(ctx, s.parilti, s.tEkran, B.UST, s.zaman);
    this.bilgi.ciz(ctx, s.tEkran, s.secenek.hareketiAzalt);
    if (this.yazi.aktif) {
      // Reaksiyon yazısının arkasında sıcak ışık patlaması (lighter, sprite'tan).
      const y = this.yazi;
      const k = Math.min(1, y.t / (y.stil.kalma + y.stil.solma));
      const g = s.parilti.nokta[R.ALTIN];
      const gw = (y.genislik * 0.9 + 80) * (0.85 + 0.3 * Math.min(1, y.t / 160));
      const gh = y.stil.boyut * 2.4;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.32 * (1 - k) * (1 - k);
      ctx.drawImage(g.t, y.x - gw / 2, y.y - gh / 2, gw, gh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    this.yazi.ciz(ctx, s.tEkran, s.secenek.hareketiAzalt);
    this.yol.cizVinyet(ctx);
    this.ortuCiz(ctx);
  }

  /** Kararma ve flaş örtüsü (en üstte). */
  private ortuCiz(ctx: Ctx): void {
    const s = this.s;
    if (this.karanlik > 0.004) {
      ctx.fillStyle = '#05030C';
      ctx.globalAlpha = this.karanlik;
      ctx.fillRect(0, 0, s.ekranW, s.ekranH);
      ctx.globalAlpha = 1;
    }
    if (s.kamera.flas > 0.003) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = s.kamera.flas;
      ctx.fillRect(0, 0, s.ekranW, s.ekranH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private yananFitiller(c: Ctx): void {
    const o = this.oynatma;
    if (!o) return;
    const s = this.s;
    for (const f of o.fitiller) {
      const tau = o.saat - f.t0;
      if (tau < 0) continue;
      const bas = this.fitilS(f, tau);
      const sonra = tau - f.bitis;
      const sonum = sonra > 0 ? Math.max(0, 1 - sonra / 420) : 1;
      if (sonum <= 0) continue;
      f.ip.cizYanmis(c, 0, bas, f.kalin, bas, sonum);
      if (sonra <= 0) {
        f.ip.ciz(c, bas, f.ip.uzunluk, f.kalin, f.renk, s.zaman * -0.006, s.parilti_ ? 1 : 0);
        // Alev başı
        f.ip.noktaAl(bas, this.nokta);
        c.globalCompositeOperation = 'lighter';
        const g = s.parilti.nokta[R.KOZ];
        const r = s.c * 0.55;
        c.drawImage(g.t, this.nokta.x - r, this.nokta.y - r, 2 * r, 2 * r);
        const al = s.parilti.alev;
        const o2 = (s.c / 50) * (0.9 + 0.15 * Math.sin(s.zaman * 0.05));
        c.drawImage(al.t, this.nokta.x - al.ox * o2, this.nokta.y - al.oy * o2 * 0.9, al.w * o2, al.h * o2);
        const w = s.parilti.nokta[R.BEYAZ];
        c.drawImage(w.t, this.nokta.x - 7, this.nokta.y - 7, 14, 14);
        c.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** Hava uyarısı: hat titrer; kenarda bulut/rüzgâr ikonu, kesik çizgili şerit. */
  private havaUyarilari(c: Ctx): void {
    if (!this.uyarilar.length) return;
    const s = this.s;
    const t = s.tahta;
    const hc = s.c;
    const tit = s.secenek.hareketiAzalt ? 0 : Math.sin(s.zaman * 0.05) * 1;
    for (const u of this.uyarilar) {
      const satir = u.eksen === 'satir';
      const x0 = satir ? s.gx + 2 : s.gx + u.hat * hc + 2;
      const y0 = satir ? s.gy + u.hat * hc + 2 : s.gy + 2;
      const w = satir ? t.w * hc - 4 : hc - 4;
      const h = satir ? hc - 4 : t.h * hc - 4;
      const renk = u.olay === 'meltem' ? '#FFB060' : '#8FD0FF';
      c.setLineDash(UYARI_KESIK);
      c.lineDashOffset = -s.zaman * 0.02;
      c.strokeStyle = renk;
      c.globalAlpha = 0.55 + 0.3 * Math.sin(s.zaman * 0.008);
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(x0 + tit, y0, w, h, hc * 0.2);
      c.stroke();
      c.setLineDash(BOS);
      c.globalAlpha = 0.08;
      c.fillStyle = renk;
      c.fill();
      c.globalAlpha = 1;
      // Kenar ikonu
      const ix = satir ? s.gx - s.cerceve * 0.5 : x0 + w / 2;
      const iy = satir ? y0 + h / 2 : s.gy - s.cerceve * 0.5;
      this.havaIkonu(c, ix + tit, iy, u.olay, hc * 0.3);
    }
  }

  private havaIkonu(c: Ctx, x: number, y: number, olay: 'meltem' | 'cisenti', r: number): void {
    c.fillStyle = 'rgba(20,12,30,0.85)';
    c.beginPath();
    c.arc(x, y, r * 1.15, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = olay === 'meltem' ? '#FFB060' : '#8FD0FF';
    c.lineWidth = 1.5;
    c.stroke();
    if (olay === 'cisenti') {
      c.fillStyle = '#DDEEFF';
      c.beginPath();
      c.arc(x - r * 0.3, y - r * 0.1, r * 0.35, 0, Math.PI * 2);
      c.arc(x + r * 0.15, y - r * 0.25, r * 0.42, 0, Math.PI * 2);
      c.arc(x + r * 0.5, y, r * 0.3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#8FD0FF';
      c.lineWidth = 1.4;
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        c.moveTo(x - r * 0.35 + k * r * 0.35, y + r * 0.3);
        c.lineTo(x - r * 0.45 + k * r * 0.35, y + r * 0.62);
      }
      c.stroke();
    } else {
      c.strokeStyle = '#FFD7A0';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const yy = y - r * 0.45 + k * r * 0.45;
        c.moveTo(x - r * 0.6, yy);
        c.lineTo(x + r * 0.3 - k * r * 0.15, yy);
        c.arc(x + r * 0.3 - k * r * 0.15, yy - r * 0.18, r * 0.18, Math.PI / 2, -Math.PI, true);
      }
      c.stroke();
    }
  }

  yokEt(): void {
    this.bitirAninda();
    this.yokEdildi = true;
    this.dinleyiciler = [];
    this.kameraDinleyiciler = [];
    this.ef.temizle(true);
    this.s.havuz.temizle();
  }
}

const UYARI_KESIK = [6, 5];
const BOS: number[] = [];

export type { OyunCizici };
