/**
 * Bölüm oturumu (P5): tek bir bölüm denemesinin oyun döngüsü (GDD §3, §9,
 * §11, §12, §14.4–§14.7, §15).
 *
 *   yol çizimi → onizle → çizici.yolGoster (ses + titreşim yol değişiminden)
 *   bırakma → yolDogrula → hamleUygula → girdi kapalı → çizici.oynat
 *     (olaylar → ses, HUD sayaçları, titreşim; dokunuş → 2×) → HUD eşitle
 *   kazanç → Final Gösterisi (dokunuş → 4×) → bolumSonucu → Kazandın
 *   kayıp → bolumSonucu → hayalet fitil araması (bütçeli) → Kaybettin
 *
 * Oturum bir Promise ile biter: 'tekrar' (yeni deneme), 'harita' ya da
 * 'devam' (kazanç; ödüller uygulamaya bırakılır). Her yeni deneme `jeton`u
 * artırır; eski oynatmaların devamı jetonla susturulur.
 *
 * Yerleşim kararları:
 *  - Reaksiyon yazısı ve "Şenlik başlıyor!" YALNIZ tuvalde (çizici olay
 *    anında çizer, çevresindeki kıvılcımlarla); arayüzün DOM sürümleri
 *    kullanılmaz (çift çizim olmasın). "Son hamle!" bandı HUD'undur.
 *  - Girdi kipi oturum durumundan türer: yalnız 'bekliyor' çizime, 'secim'
 *    hücre seçimine açıktır; menü/oynatma/bitiş anında klavye ve dokunuş
 *    tahtaya gitmez (HUD kısayollarıyla çakışmaz).
 */
import {
  durumKopyala,
  finalGosterisi,
  hamleHatasi,
  hamleUygula,
  onizle,
  ustaEliUygula,
  yolDogrula,
} from '../core/index';
import type { BolumVerisi, Eksen, Hamle, Konum, Olay, OyunDurumu, OzelTur } from '../core/types';
import * as meta from '../meta';
import type { Kayit, OyunOzeti } from '../meta';
import { acemiEnIyiAday, kazandiranAra, type KazandiranYol } from '../bot/index';
import type { OyunCiziciTam } from '../render/oyunCizici';
import type { SesMotoruAyrintili } from '../audio/sesMotoru';
import type { Arayuz, KazandinVM, KaybettinVM } from '../ui/arayuz';
import type { YolCizici, YolDegisimi } from './sozlesme';
import type { Kayitci } from './kayitci';
import { NADIRLIK, duraklatVM, hudVM, kaybettinVM, odulDuyurulari, sandiklarVM, yeniOge } from './gorunum';
import { kareBekle, simdi } from './zaman';
import { USTA_ELI_HAMLE } from '../core/sabitler';

export type OturumSonucu =
  | { tur: 'tekrar' }
  | { tur: 'harita' }
  | { tur: 'devam'; sonuc: meta.BolumSonucCiktisi; oncekiKayit: Kayit };

export type OturumDurumu = 'kapali' | 'bekliyor' | 'oynuyor' | 'secim' | 'menu' | 'bitti';

export interface OturumOrtami {
  cizici: OyunCiziciTam;
  ses: SesMotoruAyrintili;
  ui: Arayuz;
  yc: YolCizici;
  kayitci: Kayitci;
  titret(p: number | number[]): void;
  /** Duraklat > Ayarlar. */
  ayarlarAc(): Promise<void>;
  /** Yerel gün (yyyymmdd). */
  bugun(): number;
  /** Uygulama içi bekleme (test hızlandırmasında kısalır). */
  bekle(ms: number): Promise<void>;
  /** Gece Tablosu tuvali. */
  tabloTuvali(kod: string, mahalle: number, nadirlik: meta.Nadirlik, bolumId: number, gunlukTarih?: number): HTMLCanvasElement | null;
  /** Ekran adı (test kancası). */
  ekran(ad: string): void;
}

type SecimTuru = 'koruk' | 'kibrit' | 'kalip';

// Dar ekranda (360 px) tek satıra sığsın: "Ne: ne seçilir".
const SECIM_METNI: Record<SecimTuru, string> = {
  koruk: 'Körük: 3×3 alanın ortasını seç',
  kibrit: 'Kibrit: yakılacak hücreyi seç',
  kalip: 'Kalıp: roket olacak kapsülü seç',
};

/** İpucu balonu kimliği (kayıtta "görüldü"). */
function ipucuId(v: BolumVerisi, tetik: string, i: number): string {
  return `b${v.id}:${tetik}:${i}`;
}

export class Oturum {
  durum: OturumDurumu = 'kapali';
  v: BolumVerisi | null = null;
  d: OyunDurumu | null = null;
  private oz: OyunOzeti = meta.ozetBaslat();
  private denemeNo = 0;
  private jeton = 0;
  private coz: ((s: OturumSonucu) => void) | null = null;
  /** Bu denemede yapılan eylem sayısı (öğretim için). */
  private hamleSayisi = 0;
  /** Geri Sar (§9): son eylem bir hamleyse önceki durum ve özet. */
  private geriSarAnlik: { d: OyunDurumu; oz: OyunOzeti } | null = null;
  /** Son hamleden önceki durum ("Bu çizgi kazandırırdı", §14.7). */
  private sonHamleOncesi: OyunDurumu | null = null;
  private secimTuru: SecimTuru | null = null;
  private gPuan = 0;
  private puanBekliyor = false;
  private finalde = false;
  private finalHamle = 0;
  /** Oynatma sırasında olay dinleyicisinin geçerli olduğu jeton. */
  private olayJetonu = -1;
  private sonHayalet: OzelTur | null = null;
  private bostaSure: ReturnType<typeof setTimeout> | null = null;
  private kalpAtisi: ReturnType<typeof setInterval> | null = null;
  private ipucuGosteriliyor = false;
  private elAcik = false;
  /** Gösterilen el yolu: oyuncu çizmeye başlayınca gizlenir, vazgeçerse geri gelir. */
  private elYol: Konum[] | null = null;
  /** Öğretim: yavaş çekime girince gösterilecek zorla kutlama (§15 Bölüm 3). */
  kutlaBekliyor: string | null = null;
  private sonTitresim = 0;
  /** Kazandın'daki Gece Tablosu kararı için. */
  private sonTablo: { bolumId: number; yeni: { kod: string; nadirlik: meta.Nadirlik }; eski: { kod: string; nadirlik: meta.Nadirlik } | null; saklandi: boolean } | null = null;
  /** Oynatılan eylem bölümü bitiriyor mu (oynatma sürerken). */
  private oynatilanBitti: 'kazanc' | 'kayip' | null = null;
  /** Oyuncu şu an yol çiziyor mu (arka plan üretimi bekler). */
  ciziyor = false;
  /** Kazandın/Kaybettin ekranı açık (test kancası). */
  private sonucAcik = false;
  /** Hayalet izlenirken dokunuşla atlama. */
  private hayaletAtla: (() => void) | null = null;
  /** Oynatılan eylemin sonraki durumu (oynatma sürerken Duraklat kartı bunu gösterir). */
  private oynatilanSonraki: OyunDurumu | null = null;
  /** Bu denemenin sonucu meta'ya yazıldı (sıcak yeniden yüklemede bölüme dönülmez). */
  private sonucYazildi = false;
  /** Başlangıç balonu menü/çizim yüzünden gösterilemedi; girdi açılınca gösterilir. */
  private baslangicBekliyor = false;
  /** Balon sırası: kısa balon kapanınca ana talimat yalnız araya başka balon girmediyse döner. */
  private balonSira = 0;
  /** Bölüm 1: 3 sn tereddütte el geri almayı gösterir (§15 Bölüm 1, adım 5). */
  private tereddutSure: ReturnType<typeof setTimeout> | null = null;

  constructor(private o: OturumOrtami) {}

  private get kayit(): Kayit {
    return this.o.kayitci.kayit;
  }

  private get ayar(): meta.Ayarlar {
    return this.kayit.ayarlar;
  }

  /** Girdi modülünün gördüğü durum (null = girdi kapalı). */
  girdiDurumu(): OyunDurumu | null {
    return this.durum === 'bekliyor' || this.durum === 'secim' ? this.d : null;
  }

  /** Süren bölüm (sıcak yeniden yükleme); sonucu yazılmış deneme (Kazandın/Kaybettin, final) sayılmaz. */
  aktifBolum(): number | null {
    return this.durum !== 'kapali' && !this.sonucYazildi && this.v ? this.v.id : null;
  }

  /** Çizici olayı bu oturumun güncel oynatmasına mı ait (eski oynatmanın artığı sesi de çalmasın). */
  olayGecerli(): boolean {
    return this.olayJetonu === this.jeton && this.durum !== 'kapali';
  }

  // ─────────────────────────── Başlat / bitir ───────────────────────────

  oyna(v: BolumVerisi, d0: OyunDurumu, denemeNo: number): Promise<OturumSonucu> {
    const { cizici, ui, ses } = this.o;
    this.jeton++;
    this.coz?.({ tur: 'harita' });
    this.coz = null;
    cizici.dev.dondur(false);
    this.v = v;
    this.d = d0;
    this.oz = meta.ozetBaslat();
    this.denemeNo = denemeNo;
    this.hamleSayisi = 0;
    this.geriSarAnlik = null;
    this.sonHamleOncesi = null;
    this.secimTuru = null;
    this.finalde = false;
    this.kutlaBekliyor = null;
    this.sonTablo = null;
    this.sonHayalet = null;
    this.sonucAcik = false;
    this.ciziyor = false;
    this.oynatilanBitti = null;
    this.elAcik = false;
    this.elYol = null;
    this.ipucuGosteriliyor = false;
    this.oynatilanSonraki = null;
    this.sonucYazildi = false;
    this.baslangicBekliyor = false;
    ses.tahtaBoyutu(d0.w, d0.h);
    ui.hudKur(this.hudModeli());
    const alan = ui.tahtaAlani();
    cizici.alanAyarla(alan.tahta, alan.gokBandi);
    cizici.bolumKur(d0, v);
    cizici.karart(0);
    cizici.hizlandir(1);
    cizici.imlecGoster(null);
    this.hedefKonumlariniVer();
    // Yumuşak zorunlu ilk hamle (§15, bölüm 1–2).
    const zorunlu = this.zorunluHucreler();
    this.o.yc.zorunluAyarla(zorunlu);
    cizici.vurgula(zorunlu, 'zorunlu');
    this.o.ekran('oyun');
    this.durumAyarla('bekliyor');
    void this.baslangicIpuclari(this.jeton);
    return new Promise((r) => (this.coz = r));
  }

  /** Oturumu dışarıdan bitir (test kancası, sıcak yeniden yükleme). */
  cik(): void {
    if (this.durum === 'kapali') return;
    this.o.ui.ekranlariKapat();
    this.o.cizici.karart(0);
    this.bitir({ tur: 'harita' });
  }

  /**
   * Kayıt oyun içinden değişti (Duraklat > Ayarlar: ilerlemeyi sıfırla, kayıt
   * içe aktar): süren deneme yeni kayda YAZILMADAN biter, haritaya dönülür.
   */
  kayitsizBitir(): void {
    this.cik();
  }

  /** Ayarlar > İpuçları kapandı: balon, el ve boşta vurgusu kalıcı olarak kalkar. */
  ipuclariKapat(): void {
    this.elAcik = false;
    this.elYol = null;
    this.baslangicBekliyor = false;
    this.balonSira++;
    if (this.tereddutSure) clearTimeout(this.tereddutSure);
    this.tereddutSure = null;
    this.o.ui.balonKapat();
    this.o.cizici.elGoster(null);
    this.o.cizici.vurgula(null, 'ipucu');
    this.ipucuGosteriliyor = false;
    if (this.bostaSure) clearTimeout(this.bostaSure);
    this.bostaSure = null;
  }

  /** Eylem zinciri güvenliği: beklenmeyen hata oturumu 'bitti'de kilitlemesin, haritaya dönülsün. */
  private guvenli(p: Promise<unknown>): void {
    p.catch((e) => {
      try {
        console.warn('[fitil] oturum hatası', e);
      } catch {
        /* yok */
      }
      if (this.durum === 'kapali') return;
      this.o.ui.ekranlariKapat();
      this.o.cizici.karart(0);
      this.bitir({ tur: 'harita' });
      this.o.ui.toast('Bir aksilik oldu, haritaya dönüldü');
    });
  }

  private bitir(s: OturumSonucu): void {
    this.jeton++;
    this.durumAyarla('kapali');
    this.zamanlayicilariDurdur();
    const { cizici, ui, yc } = this.o;
    cizici.dev.dondur(false);
    cizici.vurgula(null, 'zorunlu');
    cizici.vurgula(null, 'ipucu');
    cizici.vurgula(null, 'secim');
    cizici.elGoster(null);
    cizici.hayaletFitil(null, false);
    cizici.yolGoster([], false, -1, null);
    cizici.imlecGoster(null);
    yc.zorunluAyarla(null);
    ui.balonKapat();
    ui.secimKipi(null);
    const c = this.coz;
    this.coz = null;
    c?.(s);
  }

  private zamanlayicilariDurdur(): void {
    if (this.bostaSure) clearTimeout(this.bostaSure);
    this.bostaSure = null;
    if (this.tereddutSure) clearTimeout(this.tereddutSure);
    this.tereddutSure = null;
    if (this.kalpAtisi) clearInterval(this.kalpAtisi);
    this.kalpAtisi = null;
  }

  private durumAyarla(s: OturumDurumu): void {
    const acikti = this.durum === 'bekliyor' || this.durum === 'secim';
    this.durum = s;
    const { yc, cizici } = this.o;
    // Güçlendirici düğmeleri girdinin açık olup olmamasına bağlı (HUD farkla günceller).
    if (acikti !== (s === 'bekliyor' || s === 'secim') && s !== 'kapali') this.hudTazele();
    yc.kipAyarla(s === 'bekliyor' ? 'cizim' : s === 'secim' ? 'secim' : 'kapali');
    if (s !== 'bekliyor') {
      if (this.bostaSure) clearTimeout(this.bostaSure);
      this.bostaSure = null;
      if (this.ipucuGosteriliyor) {
        cizici.vurgula(null, 'ipucu');
        this.ipucuGosteriliyor = false;
      }
      if (s !== 'secim') cizici.imlecGoster(null);
    } else {
      this.bostaKur();
      this.kalpAtisiKur();
      if (this.baslangicBekliyor) queueMicrotask(() => this.baslangicGoster());
    }
  }

  // ─────────────────────────── HUD ───────────────────────────

  hudModeli(d: OyunDurumu = this.d!) {
    return hudVM({
      v: this.v!,
      d,
      kayit: this.kayit,
      girdiAcik: this.durum === 'bekliyor' || this.durum === 'secim',
      geriSarHazir: !!this.geriSarAnlik && this.d!.istatistik.guclendirici === 0,
    });
  }

  hudTazele(): void {
    if (!this.v || !this.d || this.durum === 'kapali') return;
    this.o.ui.hudGuncelle(this.hudModeli());
  }

  hedefKonumlariniVer(): void {
    try {
      this.o.cizici.hedefKonumlari(this.o.ui.hedefKartKonumlari());
    } catch {
      /* HUD yok */
    }
  }

  private puanPlanla(): void {
    if (this.puanBekliyor) return;
    this.puanBekliyor = true;
    requestAnimationFrame(() => {
      this.puanBekliyor = false;
      if (this.durum !== 'kapali') this.o.ui.puan(this.gPuan);
    });
  }

  private titret(p: number | number[]): void {
    const t = simdi();
    if (t - this.sonTitresim < 90) return;
    this.sonTitresim = t;
    this.o.titret(p);
  }

  // ─────────────────────────── Çizici olayları ───────────────────────────

  /** Çizicinin olay anı bildirimi (olayDinle): HUD sayaçları ve titreşim. */
  olay(e: Olay): void {
    if (this.olayJetonu !== this.jeton) return;
    const ui = this.o.ui;
    switch (e.tur) {
      case 'patlama':
        this.gPuan += e.puan;
        this.puanPlanla();
        break;
      case 'puanEklendi':
        this.gPuan += e.miktar;
        this.puanPlanla();
        break;
      case 'hedefIlerledi':
        ui.hedefSayaci(e.indeks, e.deger, e.tamam, e.gerekli);
        break;
      case 'korukDoldu':
        ui.korukGostergesi(e.dolum, e.kapasite);
        break;
      case 'korukKullanildi':
        ui.korukGostergesi(0, this.d?.korukKapasite ?? 0);
        this.titret(15);
        break;
      case 'ozelTetiklendi':
        this.titret(20);
        break;
      case 'kombinasyon':
        this.titret([30, 20, 60]);
        break;
      case 'devFisekFirladi':
        this.titret([20, 30, 40]);
        break;
      case 'reaksiyon':
        if (e.boyut >= 15) this.titret([30, 20, 60]);
        break;
      case 'ozelOlustu':
        // Final: kalan hamle sayacı roketler doğdukça azalır (1'i atla: "Son hamle!" bandı çıkmasın).
        if (this.finalde && this.finalHamle > 0) {
          this.finalHamle--;
          if (this.finalHamle !== 1) ui.hamleSayaci(this.finalHamle);
        }
        break;
      default:
        break;
    }
  }

  /** Yönetmen kamerası yavaş çekime girdi/çıktı. */
  kamera(yavas: boolean): void {
    if (yavas && this.kutlaBekliyor) {
      this.o.cizici.kutla(this.kutlaBekliyor);
      this.kutlaBekliyor = null;
    }
  }

  // ─────────────────────────── Girdi geri çağırımları ───────────────────────────

  yolDegisti(yol: readonly Konum[], halka: boolean, degisim?: YolDegisimi): void {
    if (this.durum !== 'bekliyor' || !this.d) return;
    this.etkilesim();
    const { cizici, ses } = this.o;
    if (yol.length === 0) {
      cizici.yolGoster([], false, -1, null);
      this.sonHayalet = null;
      // Özel taşa dokunuş 'temizlendi' ile biter (birakildi/iptal gelmez).
      this.ciziyor = false;
      return;
    }
    const on = onizle(this.d, yol as Konum[], halka);
    cizici.yolGoster(yol, halka, on.renk, on);
    this.ciziyor = true;
    if (degisim === 'basladi' && this.elAcik) cizici.elGoster(null);
    switch (degisim) {
      case 'basladi':
      case 'eklendi':
        ses.dugumEklendi(yol.length);
        this.titret(5);
        break;
      case 'geriAlindi':
        ses.geriAlindi(yol.length);
        break;
      case 'halkaKapandi':
        ses.halkaKapandi(yol.length);
        this.titret(15);
        break;
      default:
        break;
    }
    const hay = on.ozelHayalet && on.ozelHayalet.ozel !== 'yok' ? on.ozelHayalet.ozel : null;
    if (hay && hay !== this.sonHayalet) ses.ozelEsigi(hay as 'roket' | 'kasimpati' | 'yildiz');
    this.sonHayalet = hay;
  }

  birakildi(yol: readonly Konum[], halka: boolean): void {
    this.ciziyor = false;
    if (this.durum !== 'bekliyor' || !this.d) return;
    const { cizici, ses } = this.o;
    cizici.parmak(null);
    this.sonHayalet = null;
    const temizle = () => {
      cizici.yolGoster([], false, -1, null);
      if (this.elAcik && this.elYol && this.ayar.ipuclari) cizici.elGoster(this.elYol);
    };
    if (yol.length < 3) {
      temizle();
      ses.iptal();
      if (yol.length === 2) this.tetikIpucu('kisaYol');
      else if (this.baslangicBekliyor) this.baslangicGoster();
      return;
    }
    const hata = yolDogrula(this.d, yol as Konum[], halka);
    if (hata) {
      temizle();
      ses.iptal();
      if (hata === 'kisa') this.tetikIpucu('kisaYol');
      else if (hata === 'halkaGerekli') this.o.ui.toast('Bu bölümde yalnız halka geçerli: başladığın yere dön');
      return;
    }
    ses.tutusma();
    temizle();
    this.guvenli(this.eylem({ tur: 'fitil', yol: yol.map((p) => ({ x: p.x, y: p.y })), halka }));
  }

  iptal(): void {
    this.ciziyor = false;
    this.o.cizici.yolGoster([], false, -1, null);
    if (this.elAcik && this.elYol && this.durum === 'bekliyor' && this.ayar.ipuclari) this.o.cizici.elGoster(this.elYol);
    this.o.cizici.parmak(null);
    this.sonHayalet = null;
    if (this.durum === 'secim') this.secimBitir();
    else if (this.baslangicBekliyor) this.baslangicGoster();
  }

  ciftDokunus(h: Konum): void {
    if (this.durum !== 'bekliyor' || !this.d) return;
    const hamle: Hamle = { tur: 'ciftDokunus', hucre: { x: h.x, y: h.y } };
    if (hamleHatasi(this.d, hamle)) return;
    this.guvenli(this.eylem(hamle));
  }

  /** Zorunlu ilk hamlede kümenin dışına basıldı (§15): fıs, kısa titreşim; vurgu, el ve balon yeniden. */
  kisitliBasildi(_h: Konum): void {
    if (this.durum !== 'bekliyor' || this.hamleSayisi > 0) return;
    this.etkilesim();
    this.o.ses.iptal();
    this.titret(12);
    const z = this.zorunluHucreler();
    // Vurguyu yeniden kur: nabız baştan başlar, göz kümeye döner.
    this.o.cizici.vurgula(null, 'zorunlu');
    this.o.cizici.vurgula(z, 'zorunlu');
    if (this.elAcik && this.elYol && this.ayar.ipuclari) this.o.cizici.elGoster(this.elYol);
    this.baslangicGoster();
  }

  ozelDokunus(_h: Konum): void {
    if (this.durum !== 'bekliyor') return;
    this.etkilesim();
    const k = this.kayit;
    if (meta.ciftDokunusIpucuGoster(k)) {
      this.o.ui.toast('Ateşlemek için tekrar dokun');
      this.o.kayitci.degistir(meta.ciftDokunusIpucuSay(k));
    }
  }

  parmak(p: { x: number; y: number } | null): void {
    if (this.durum === 'bekliyor' || p === null) this.o.cizici.parmak(p);
  }

  dokunuldu(): void {
    this.etkilesim();
    if (this.durum === 'oynuyor') this.o.cizici.hizlandir(this.finalde ? 4 : 2);
    if (this.hayaletAtla) this.hayaletAtla();
  }

  imlecDegisti(h: Konum | null): void {
    this.o.cizici.imlecGoster(this.durum === 'bekliyor' || this.durum === 'secim' ? h : null);
  }

  hucreSecildi(h: Konum): void {
    if (this.durum !== 'secim' || !this.d || !this.secimTuru) return;
    this.guvenli(this.secimHucresi(h));
  }

  // ─────────────────────────── Güçlendiriciler ve Körük ───────────────────────────

  korukSecildi(): void {
    if (!this.d) return;
    if (this.durum === 'secim' && this.secimTuru === 'koruk') {
      this.secimBitir();
      return;
    }
    if (this.durum !== 'bekliyor' && this.durum !== 'secim') return;
    if (this.d.korukKapasite <= 0 || this.d.korukDolum < this.d.korukKapasite) return;
    this.secimBasla('koruk');
  }

  guclendiriciSecildi(id: 'kibrit' | 'kalip' | 'geriSar'): void {
    if (!this.d) return;
    if (this.durum === 'secim' && this.secimTuru === id) {
      this.secimBitir();
      return;
    }
    if (this.durum !== 'bekliyor' && this.durum !== 'secim') return;
    if (this.d.istatistik.guclendirici > 0) {
      this.o.ui.toast('Bölüm başına 1 güçlendirici');
      return;
    }
    if ((this.kayit.guclendiriciler[id] ?? 0) <= 0) {
      this.o.ui.toast('Stok yok');
      return;
    }
    if (id === 'geriSar') {
      this.geriSar();
      return;
    }
    this.secimBasla(id);
  }

  secimIptal(): void {
    if (this.durum === 'secim') this.secimBitir();
  }

  private uygunHucreler(tur: SecimTuru): Konum[] | null {
    const d = this.d!;
    if (tur === 'koruk') return null; // her hücre olur: vurgu gürültü yapar
    const r: Konum[] = [];
    for (let y = 0; y < d.h; y++)
      for (let x = 0; x < d.w; x++) {
        const c = d.hucreler[y * d.w + x];
        if (c.delik || !c.icerik) continue;
        const h: Hamle = tur === 'kibrit' ? { tur: 'kibrit', hucre: { x, y } } : { tur: 'kalip', hucre: { x, y }, eksen: 0 };
        if (!hamleHatasi(d, h)) r.push({ x, y });
      }
    return r;
  }

  private secimBasla(tur: SecimTuru): void {
    if (this.durum === 'secim') this.secimBitir();
    this.secimTuru = tur;
    // Seçim ipucu HUD'da (balonun yerinde) görünsün; öğretici el seçimle karışmasın.
    this.o.ui.balonKapat();
    if (this.elAcik) this.o.cizici.elGoster(null);
    this.o.cizici.yolGoster([], false, -1, null);
    this.o.cizici.vurgula(this.uygunHucreler(tur), 'secim');
    this.o.ui.secimKipi(SECIM_METNI[tur], tur);
    this.durumAyarla('secim');
    this.hudTazele();
  }

  private secimBitir(): void {
    this.secimTuru = null;
    this.o.cizici.vurgula(null, 'secim');
    this.o.ui.secimKipi(null);
    if (this.durum === 'secim') this.durumAyarla('bekliyor');
    this.hudTazele();
  }

  private async secimHucresi(h: Konum): Promise<void> {
    const d = this.d!;
    const tur = this.secimTuru!;
    const ui = this.o.ui;
    if (tur === 'koruk') {
      const hamle: Hamle = { tur: 'koruk', merkez: { x: h.x, y: h.y } };
      if (hamleHatasi(d, hamle)) {
        ui.toast('Tahtanın içinde bir hücre seç');
        return;
      }
      this.secimBitir();
      await this.eylem(hamle);
      return;
    }
    if (tur === 'kibrit') {
      const hamle: Hamle = { tur: 'kibrit', hucre: { x: h.x, y: h.y } };
      if (hamleHatasi(d, hamle) || !d.hucreler[h.y * d.w + h.x].icerik) {
        ui.toast('Dolu bir hücre seç');
        return;
      }
      const k = meta.guclendiriciKullan(this.kayit, 'kibrit');
      if (!k) {
        ui.toast('Stok yok');
        return;
      }
      this.o.kayitci.degistir(k);
      this.secimBitir();
      await this.eylem(hamle);
      return;
    }
    // Fişek Kalıbı: önce kapsül, sonra eksen (§9: 4 eksen).
    if (hamleHatasi(d, { tur: 'kalip', hucre: h, eksen: 0 })) {
      ui.toast('Düz bir kapsül seç');
      return;
    }
    const jeton = this.jeton;
    this.durumAyarla('menu');
    this.o.cizici.vurgula([h], 'secim');
    const g = this.o.cizici.geometri();
    const eksen: Eksen | null = await ui.eksenSec({ x: g.x + (h.x + 0.5) * g.hucre, y: g.y + (h.y + 0.5) * g.hucre }, g.hucre);
    if (jeton !== this.jeton) return;
    if (eksen === null) {
      this.durumAyarla('secim');
      this.o.cizici.vurgula(this.uygunHucreler('kalip'), 'secim');
      return;
    }
    const k = meta.guclendiriciKullan(this.kayit, 'kalip');
    if (!k) {
      ui.toast('Stok yok');
      this.secimBitir();
      return;
    }
    this.o.kayitci.degistir(k);
    this.durum = 'secim';
    this.secimBitir();
    await this.eylem({ tur: 'kalip', hucre: { x: h.x, y: h.y }, eksen });
  }

  private geriSar(): void {
    const a = this.geriSarAnlik;
    if (!a) {
      this.o.ui.toast('Geri Sar yalnız son hamleyi geri alır');
      return;
    }
    const k = meta.guclendiriciKullan(this.kayit, 'geriSar');
    if (!k) {
      this.o.ui.toast('Stok yok');
      return;
    }
    this.o.kayitci.degistir(k);
    // Durum + RNG + özet önceki hâline döner; güçlendirici sınırı uygulamada sayılır (§9, core/README).
    const d = durumKopyala(a.d);
    d.istatistik.guclendirici += 1;
    this.d = d;
    this.oz = a.oz;
    this.geriSarAnlik = null;
    this.sonHamleOncesi = null;
    this.o.cizici.durumGoster(d);
    this.o.ses.arayuz('kapa');
    this.titret([15, 30, 15]);
    this.o.ui.toast('Son hamle geri alındı');
    this.gPuan = d.puan;
    this.hudTazele();
    this.o.ui.puan(d.puan);
  }

  // ─────────────────────────── Eylem ───────────────────────────

  /** Bir eylemi uygular ve oynatır (çizim, çift dokunuş, Körük, Kibrit, Kalıp, bot). */
  async eylem(h: Hamle): Promise<void> {
    if (!this.d || !this.v) return;
    const jeton = this.jeton;
    const onceki = this.d;
    let sonuc;
    try {
      sonuc = hamleUygula(onceki, h);
    } catch {
      this.o.ui.toast('Bu hamle olmaz');
      return;
    }
    const { cizici, ui } = this.o;
    const hamleMi = h.tur === 'fitil' || h.tur === 'ciftDokunus';
    this.geriSarAnlik = hamleMi ? { d: onceki, oz: this.oz } : null;
    if (hamleMi) this.sonHamleOncesi = onceki;
    this.oz = meta.ozetHamle(this.oz, sonuc.olaylar, { hamle: h, onceki });
    const ilk = this.hamleSayisi === 0;
    this.hamleSayisi++;
    if (ilk) {
      this.o.yc.zorunluAyarla(null);
      cizici.vurgula(null, 'zorunlu');
    }
    if (this.elAcik) {
      cizici.elGoster(null);
      this.elAcik = false;
      this.elYol = null;
    }
    ui.balonKapat();
    // Öğretim senaryoları (§15): bölüm 1'in ısı tadında ve bölüm 3'ün ilk reaksiyonunda yavaş çekim zorlanır.
    if (ilk && (this.v.id === 1 || this.v.senaryo?.ilkReaksiyonVurgusu)) {
      cizici.yonetmenZorla();
      if (this.v.senaryo?.ilkReaksiyonVurgusu && !sonuc.olaylar.some((e) => e.tur === 'reaksiyon' && e.kademe)) this.kutlaBekliyor = 'harika';
    }
    this.durumAyarla('oynuyor');
    this.hedefKonumlariniVer();
    if (hamleMi) ui.hamleSayaci(sonuc.durum.kalanHamle);
    this.gPuan = onceki.puan;
    this.olayJetonu = jeton;
    this.oynatilanBitti = sonuc.durum.bitti;
    this.oynatilanSonraki = sonuc.durum;
    await cizici.oynat(onceki, sonuc.olaylar, sonuc.durum);
    this.oynatilanBitti = null;
    this.oynatilanSonraki = null;
    if (jeton !== this.jeton) return;
    if (this.kutlaBekliyor) {
      cizici.kutla(this.kutlaBekliyor);
      this.kutlaBekliyor = null;
    }
    this.d = sonuc.durum;
    this.gPuan = this.d.puan;
    if (this.d.bitti === 'kazanc') {
      await this.kazanc(jeton);
      return;
    }
    if (this.d.bitti === 'kayip') {
      await this.kayip(jeton);
      return;
    }
    this.durumAyarla('bekliyor');
    this.hudTazele();
    if (ilk) void this.tetikIpucu('ilkHamleSonrasi');
  }

  // ─────────────────────────── Duraklat ───────────────────────────

  async duraklat(): Promise<void> {
    if (this.durum === 'menu' || this.durum === 'bitti' || this.durum === 'kapali' || !this.v || !this.d) return;
    // Bölümü bitiren hamlenin ya da finalin oynatması duraklatılmaz (kazanç kayıp diye kaydedilmesin).
    if (this.finalde || this.oynatilanBitti) return;
    const jeton = this.jeton;
    const { cizici, ui } = this.o;
    const oynuyordu = this.durum === 'oynuyor';
    if (this.durum === 'secim') this.secimBitir();
    if (oynuyordu) cizici.dev.dondur(true);
    this.durum = 'menu';
    this.o.yc.kipAyarla('kapali');
    if (this.bostaSure) clearTimeout(this.bostaSure);
    cizici.karart(0.5);
    this.o.ses.arayuz('ac');
    let secim: 'devam' | 'yeniden' | 'ayarlar' | 'harita';
    for (;;) {
      this.o.ekran('duraklat');
      // Coşku Serisi Günün Şenliği'nden etkilenmez (meta: günlük nötr).
      const cosku = this.v.tur !== 'gunluk' && (meta.coskuAktif(this.kayit) || this.kayit.cosku > 0);
      // Oynatma sürerken HUD olaylarla ilerlemiştir: kart hamle SONRASI durumu göstersin.
      secim = await ui.duraklat(duraklatVM(this.v, this.oynatilanSonraki ?? this.d, cosku));
      if (jeton !== this.jeton) return;
      if (secim !== 'ayarlar') break;
      await this.o.ayarlarAc();
      if (jeton !== this.jeton) return;
    }
    cizici.karart(0);
    this.o.ekran('oyun');
    if (secim === 'devam') {
      if (oynuyordu) {
        cizici.dev.dondur(false);
        this.durum = 'oynuyor';
      } else this.durumAyarla('bekliyor');
      return;
    }
    // Yeniden başlamak ve haritaya dönmek kayıp sayılır (§14.5; Coşku bozulur) — hamle yapıldıysa.
    if (this.hamleSayisi > 0) this.sonucKaydet(false);
    this.bitir({ tur: secim === 'yeniden' ? 'tekrar' : 'harita' });
  }

  // ─────────────────────────── Sonuç ───────────────────────────

  private sonucGirdisi(kazandi: boolean, kalanHamle: number): meta.BolumSonucGirdisi {
    const v = this.v!;
    const d = this.d!;
    const motifHedef = v.hedefler.find((x) => x.tur === 'desen');
    return {
      bolumId: v.id,
      kazandi,
      puan: d.puan,
      yildiz: kazandi ? meta.yildizHesapla(d.puan, v.yildizEsikleri, d.istatistik) : 0,
      istatistik: d.istatistik,
      olaylarOzeti: this.oz,
      deneme: this.denemeNo,
      tarih: this.o.bugun(),
      kalanHamle,
      toplamHamle: d.toplamHamle + (d.istatistik.ustaEli ? USTA_ELI_HAMLE : 0),
      motif: kazandi && motifHedef?.tur === 'desen' ? motifHedef.motif : undefined,
      tur: v.tur === 'gunluk' ? 'gunluk' : v.tur === 'sonsuz' ? 'sonsuz' : undefined,
    };
  }

  private sonucKaydet(kazandi: boolean, kalanHamle = this.d?.kalanHamle ?? 0): { sonuc: meta.BolumSonucCiktisi; onceki: Kayit } {
    const onceki = this.kayit;
    const sonuc = meta.bolumSonucu(onceki, this.sonucGirdisi(kazandi, kalanHamle));
    this.o.kayitci.degistir(sonuc.kayit, 500);
    this.sonucYazildi = true;
    return { sonuc, onceki };
  }

  private async kazanc(jeton: number): Promise<void> {
    const { cizici, ui } = this.o;
    const v = this.v!;
    this.durumAyarla('bitti');
    this.zamanlayicilariDurdur();
    ui.secimKipi(null);
    const kazancKalan = this.d!.kalanHamle;
    const kazancIpuclari = this.ayar.ipuclari ? (v.ipuclari ?? []).filter((t) => t.tetik === 'kazanc') : [];
    const finalIpucu = kazancIpuclari.length >= 2 ? kazancIpuclari[kazancIpuclari.length - 1] : null;
    const ekranIpuclari = finalIpucu ? kazancIpuclari.slice(0, -1) : kazancIpuclari;
    // Final Gösterisi (§7.3) saf bir hesaptır: sonuç (puan, yıldız, tablo) gösteriden ÖNCE
    // hesaplanıp kaydedilir — oyuncu final sırasında sayfayı kapatsa da kazanç kaybolmaz.
    const finalOncesi = this.d!;
    let final: ReturnType<typeof finalGosterisi> | null = null;
    try {
      final = finalGosterisi(finalOncesi);
    } catch {
      final = null;
    }
    if (final) {
      this.oz = meta.ozetFinal(this.oz, final.olaylar);
      this.d = final.durum;
    }
    const { sonuc, onceki } = this.sonucKaydet(true, kazancKalan);
    await this.o.bekle(420);
    if (jeton !== this.jeton) return;
    if (final && final.olaylar.length > 2) {
      if (finalIpucu && kazancKalan > 0) void ui.balon(finalIpucu.metin, 2800);
      this.finalde = true;
      this.finalHamle = kazancKalan;
      this.durum = 'oynuyor';
      this.hedefKonumlariniVer();
      this.gPuan = finalOncesi.puan;
      this.olayJetonu = jeton;
      cizici.hizlandir(1);
      this.o.ekran('final');
      await cizici.oynat(finalOncesi, final.olaylar, final.durum);
      if (jeton !== this.jeton) return;
      this.finalde = false;
      this.durum = 'bitti';
      ui.hamleSayaci(0);
      ui.puan(this.d!.puan);
    }
    await this.o.bekle(650);
    if (jeton !== this.jeton) return;
    const vm = this.kazandinModeli(sonuc, onceki, ekranIpuclari.map((t) => t.metin).join(' ') || null);
    const tablo = sonuc.oduller.find((x): x is Extract<meta.Odul, { tur: 'tablo' }> => x.tur === 'tablo');
    const tuval = tablo ? this.o.tabloTuvali(tablo.tablo.kod, v.mahalle, tablo.tablo.nadirlik, v.id, v.tur === 'gunluk' ? v.id : undefined) : null;
    if (tablo) {
      const eskiKod = onceki.bolumler[String(v.id)]?.tablo;
      this.sonTablo = {
        bolumId: v.id,
        yeni: { kod: tablo.tablo.kod, nadirlik: tablo.tablo.nadirlik },
        eski: eskiKod && tablo.eskiNadirlik !== null ? { kod: eskiKod, nadirlik: tablo.eskiNadirlik } : null,
        saklandi: tablo.saklandi,
      };
    }
    cizici.karart(0.38);
    this.o.ekran('kazandin');
    this.sonucAcik = true;
    const secim = await ui.kazandin(vm, { tablo: tuval });
    if (jeton !== this.jeton) return;
    cizici.karart(0);
    this.bitir(secim === 'tekrar' ? { tur: 'tekrar' } : { tur: 'devam', sonuc, oncekiKayit: onceki });
  }

  private kazandinModeli(sonuc: meta.BolumSonucCiktisi, onceki: Kayit, ipucu: string | null): KazandinVM {
    const v = this.v!;
    const d = this.d!;
    const tablo = sonuc.oduller.find((x): x is Extract<meta.Odul, { tur: 'tablo' }> => x.tur === 'tablo');
    const ana = v.tur !== 'gunluk' && v.tur !== 'sonsuz' && v.tur !== 'usta';
    return {
      bolumId: v.id,
      bolumAdi: v.ad,
      tur: v.tur,
      yildiz: sonuc.ozet.yildiz,
      oncekiYildiz: (onceki.bolumler[String(v.id)]?.yildiz ?? 0) as KazandinVM['oncekiYildiz'],
      puan: d.puan,
      yeniRekor: sonuc.ozet.yeniRekor,
      sandiklar: sandiklarVM(onceki, sonuc.oduller),
      tablo: tablo
        ? {
            nadirlik: NADIRLIK[tablo.tablo.nadirlik],
            eskiVar: tablo.eskiNadirlik !== null,
            eskiNadirlik: tablo.eskiNadirlik !== null ? NADIRLIK[tablo.eskiNadirlik] : undefined,
          }
        : null,
      sonrakiTanitim: ana ? (v.sonrakiTanitim ?? null) : null,
      sonrakiOge: ana ? yeniOge(v.id + 1) : null,
      ipucu,
      duyurular: odulDuyurulari(sonuc.oduller),
    };
  }

  /** Kazandın > Sakla / Eskisini koru (§14.6). Meta en nadirini saklar; oyuncu tersini seçebilir. */
  tabloKarari(bolumId: number, sakla: boolean): void {
    const t = this.sonTablo;
    if (!t || t.bolumId !== bolumId) return;
    const k = meta.kayitKopyala(this.kayit);
    const b = k.bolumler[String(bolumId)];
    if (!b) return;
    if (sakla && !t.saklandi) {
      b.tablo = t.yeni.kod;
      b.nadirlik = t.yeni.nadirlik;
    } else if (!sakla && t.saklandi && t.eski) {
      b.tablo = t.eski.kod;
      b.nadirlik = t.eski.nadirlik;
    } else return;
    this.o.kayitci.degistir(k);
  }

  private async kayip(jeton: number): Promise<void> {
    const { cizici, ui } = this.o;
    const v = this.v!;
    this.durumAyarla('bitti');
    this.zamanlayicilariDurdur();
    const coskuOnce = this.kayit.cosku;
    this.sonucKaydet(false);
    // "Bu çizgi kazandırırdı" (§11 kanca 12): son hamleden önceki durumda, bütçeli ve zaman dilimli.
    let hayalet: KazandiranYol | null = null;
    const once = this.sonHamleOncesi;
    if (once && !once.bitti && once.kalanHamle > 0) hayalet = await this.kazandiranAra(once, jeton);
    if (jeton !== this.jeton) return;
    const ustaEli = v.tur !== 'gunluk' && !this.d!.istatistik.ustaEli && meta.ustaEliSunulur(this.kayit, v.id);
    let hayaletDurumu: KaybettinVM['hayalet'] = hayalet ? 'var' : 'yok';
    const coskuSifirlandi = coskuOnce > 0 && this.kayit.cosku === 0;
    for (;;) {
      this.o.ekran('kaybettin');
      this.sonucAcik = true;
      const secim = await ui.kaybettin(kaybettinVM(v, this.d!, hayaletDurumu, ustaEli, coskuSifirlandi));
      if (jeton !== this.jeton) return;
      this.sonucAcik = false;
      if (secim === 'hayalet' && hayalet && once) {
        await this.hayaletGoster(once, hayalet, jeton);
        if (jeton !== this.jeton) return;
        hayaletDurumu = 'izlendi';
        continue;
      }
      if (secim === 'ustaEli' && ustaEli) {
        await this.ustaEli(jeton);
        return;
      }
      cizici.karart(0);
      this.bitir(secim === 'tekrar' ? { tur: 'tekrar' } : { tur: 'harita' });
      return;
    }
  }

  private async kazandiranAra(d: OyunDurumu, jeton: number): Promise<KazandiranYol | null> {
    const g = kazandiranAra(d, { butce: 300 });
    const son = simdi() + 1200;
    for (;;) {
      const bas = simdi();
      let r = g.next();
      while (!r.done && simdi() - bas < 10) r = g.next();
      if (r.done) return r.value;
      if (simdi() > son || jeton !== this.jeton) return null;
      await kareBekle();
    }
  }

  private async hayaletGoster(once: OyunDurumu, yol: KazandiranYol, jeton: number): Promise<void> {
    const { cizici, ui } = this.o;
    cizici.karart(0);
    cizici.durumGoster(once);
    // HUD tahtayla aynı ana dönsün (son hamleden önce): hamle, hedef, puan.
    ui.hudGuncelle(this.hudModeli(once));
    cizici.hayaletFitil(yol.yol, yol.halka);
    this.o.ekran('hayalet');
    // İki tur (2 × 1,8 sn) oynar; dokunuş atlar.
    await new Promise<void>((r) => {
      const t = setTimeout(() => {
        this.hayaletAtla = null;
        r();
      }, 3800);
      this.hayaletAtla = () => {
        clearTimeout(t);
        this.hayaletAtla = null;
        r();
      };
    });
    if (jeton !== this.jeton) return;
    cizici.hayaletFitil(null, false);
    cizici.durumGoster(this.d!);
    ui.hudGuncelle(this.hudModeli());
    cizici.karart(0.55);
  }

  /** Kıvılcım Usta'nın Eli (K16): +5 hamle, en fazla 1★; aynı denemede bir kez. */
  private async ustaEli(jeton: number): Promise<void> {
    const { cizici, ui } = this.o;
    let r;
    try {
      r = ustaEliUygula(this.d!);
    } catch {
      this.bitir({ tur: 'tekrar' });
      return;
    }
    cizici.karart(0);
    this.durum = 'oynuyor';
    this.olayJetonu = jeton;
    if (r.olaylar.length) await cizici.oynat(this.d!, r.olaylar, r.durum);
    else cizici.durumGoster(r.durum);
    if (jeton !== this.jeton) return;
    this.d = r.durum;
    this.geriSarAnlik = null;
    // Kayıp ve o ana kadarki olaylar meta'ya işlendi: devam sonucu yalnız Eli sonrasını taşır.
    this.oz = meta.ozetBaslat();
    this.sonucYazildi = false;
    this.o.ekran('oyun');
    ui.hudGuncelle(this.hudModeli());
    ui.hamleSayaci(this.d.kalanHamle);
    this.durumAyarla('bekliyor');
    this.hudTazele();
    void ui.balon('Kıvılcım Usta yanında: 5 hamle daha!', 2400);
  }

  // ─────────────────────────── Öğretim (§15) ───────────────────────────

  private zorunluHucreler(): Konum[] | null {
    const z = this.v?.zorunluIlkHamle;
    return z && z.length && this.hamleSayisi === 0 ? z.map(([x, y]) => ({ x, y })) : null;
  }

  /** El yolunu doğrula ([x,y] listesi; son = ilk ise halka). Geçersizse null (§15 notu: el yerçekimi sonrası koordinatla yazılmış olabilir). */
  private elYolu(el: [number, number][] | undefined): Konum[] | null {
    if (!el || el.length < 2 || !this.d) return null;
    let yol = el.map(([x, y]) => ({ x, y }));
    let halka = false;
    if (yol.length >= 5 && yol[0].x === yol[yol.length - 1].x && yol[0].y === yol[yol.length - 1].y) {
      yol = yol.slice(0, -1);
      halka = true;
    }
    if (yolDogrula(this.d, yol, halka) !== null) return null;
    return halka ? [...yol, yol[0]] : yol;
  }

  private ipucuGosterilsinMi(tetik: string, i: number): boolean {
    if (!this.ayar.ipuclari || !this.v) return false;
    // Öğretim bölümlerinde her denemede; diğerlerinde bir kez (kayıtta).
    if (this.v.tur === 'ogretim' || tetik === 'kisaYol') return true;
    return !this.kayit.ipuclari.gorulen.includes(ipucuId(this.v, tetik, i));
  }

  private ipucuGoruldu(tetik: string, i: number): void {
    if (!this.v) return;
    const k = meta.ipucuGoruldu(this.kayit, ipucuId(this.v, tetik, i));
    if (k !== this.kayit) this.o.kayitci.degistir(k, 1500);
  }

  private async baslangicIpuclari(jeton: number): Promise<void> {
    await this.o.bekle(550);
    if (jeton !== this.jeton || this.hamleSayisi > 0) return;
    // Duraklat/mola açıkken ya da oyuncu çizmeye başlamışsa balon ve el beklesin (yolun üstüne binmesin).
    if (this.durum !== 'bekliyor' || this.ciziyor) {
      this.baslangicBekliyor = true;
      return;
    }
    this.tetikIpucu('baslangic');
  }

  /** Bekleyen ya da kısa balonla kapanan ana talimatı yeniden göster (yalnız ilk hamleden önce). */
  private baslangicGoster(): void {
    if (this.durum !== 'bekliyor' || this.ciziyor || this.hamleSayisi > 0 || !this.ayar.ipuclari) return;
    const ilk = this.baslangicBekliyor;
    this.baslangicBekliyor = false;
    if (ilk) {
      this.tetikIpucu('baslangic');
      return;
    }
    const t = (this.v?.ipuclari ?? []).find((x) => x.tetik === 'baslangic');
    if (t) void this.balonGoster(t.metin, 0);
  }

  private balonGoster(metin: string, sure: number): Promise<void> {
    this.balonSira++;
    return this.o.ui.balon(metin, sure);
  }

  private tetikIpucu(tetik: 'baslangic' | 'ilkHamleSonrasi' | 'kisaYol'): void {
    const v = this.v;
    if (!v || this.durum === 'kapali') return;
    if (tetik !== 'ilkHamleSonrasi' && (this.durum !== 'bekliyor' || (tetik === 'baslangic' && this.ciziyor))) return;
    const liste = v.ipuclari ?? [];
    const jeton = this.jeton;
    liste.forEach((t, i) => {
      if (t.tetik !== tetik || !this.ipucuGosterilsinMi(tetik, i)) return;
      const sure = tetik === 'kisaYol' ? 2200 : 0;
      const p = this.balonGoster(t.metin, sure);
      if (tetik === 'kisaYol') {
        // "En az 3." kapanınca ana talimat geri gelsin (araya başka balon girmediyse).
        const sira = this.balonSira;
        void p.then(() => {
          if (jeton === this.jeton && sira === this.balonSira) this.baslangicGoster();
        });
      }
      this.ipucuGoruldu(tetik, i);
      const el = this.elYolu(t.el);
      if (el && tetik !== 'kisaYol') {
        this.o.cizici.elGoster(el);
        this.elAcik = true;
        this.elYol = el;
        this.tereddutKur();
      }
    });
  }

  /** §15 Bölüm 1, adım 5: 3 sn tereddütte el bir kez ileri çizip son düğümden geri adım atar (geri alma). */
  private tereddutKur(): void {
    if (this.tereddutSure) clearTimeout(this.tereddutSure);
    this.tereddutSure = null;
    if (this.v?.id !== 1 || this.hamleSayisi > 0 || !this.elAcik) return;
    const jeton = this.jeton;
    this.tereddutSure = setTimeout(() => {
      this.tereddutSure = null;
      if (jeton !== this.jeton || this.durum !== 'bekliyor' || this.ciziyor || this.hamleSayisi > 0 || !this.elAcik || !this.elYol || !this.ayar.ipuclari) return;
      this.o.cizici.elGoster(this.elYol, { geriAl: true });
    }, 3000);
  }

  private etkilesim(): void {
    if (this.ipucuGosteriliyor) {
      this.o.cizici.vurgula(null, 'ipucu');
      this.ipucuGosteriliyor = false;
    }
    if (this.durum === 'bekliyor') {
      this.bostaKur();
      if (this.tereddutSure) this.tereddutKur();
    }
  }

  /** 5 sn hareketsizlikte Acemi botun en iyi adayında parıltı dalgası (§15). */
  private bostaKur(): void {
    if (this.bostaSure) clearTimeout(this.bostaSure);
    this.bostaSure = null;
    if (!this.ayar.ipuclari || !this.ayar.bostaIpucu) return;
    const jeton = this.jeton;
    this.bostaSure = setTimeout(() => {
      this.bostaSure = null;
      if (jeton !== this.jeton || this.durum !== 'bekliyor' || !this.d || this.elAcik) return;
      const izin = this.zorunluHucreler();
      let aday: Konum[] | null = null;
      try {
        aday = acemiEnIyiAday(this.d, 0, izin ? izin.map((p) => [p.x, p.y] as const) : null);
      } catch {
        aday = null;
      }
      if (!aday) return;
      this.o.cizici.vurgula(aday, 'ipucu');
      this.ipucuGosteriliyor = true;
      const bosta = (this.v?.ipuclari ?? []).findIndex((t) => t.tetik === 'bosta5sn');
      if (bosta >= 0 && this.ipucuGosterilsinMi('bosta5sn', bosta)) {
        void this.balonGoster(this.v!.ipuclari![bosta].metin, 2600);
        this.ipucuGoruldu('bosta5sn', bosta);
      }
    }, 5000);
  }

  /** Son hamlede kalp atışı (§12.2): 900 ms'de bir, girdi bekliyorken. */
  private kalpAtisiKur(): void {
    if (this.kalpAtisi) return;
    this.kalpAtisi = setInterval(() => {
      if (this.durum === 'bekliyor' && this.d && this.d.kalanHamle === 1) this.o.ses.arayuz('sonHamle');
    }, 900);
  }

  // ─────────────────────────── Test kancası ───────────────────────────

  /** Bot hamlesi gerçek akıştan (test): Usta botunun seçtiği eylem. */
  async botHamlesi(sec: (d: OyunDurumu, izin: readonly (readonly [number, number])[] | null) => Hamle): Promise<boolean> {
    if (this.durum === 'secim') this.secimBitir();
    if (this.durum !== 'bekliyor' || !this.d) return false;
    const z = this.zorunluHucreler();
    const h = sec(this.d, z ? z.map((p) => [p.x, p.y] as const) : null);
    if (h.tur === 'fitil') this.o.ses.tutusma();
    this.guvenli(this.eylem(h));
    // Oynatma bitene ya da sonuç ekranı açılana kadar bekle (kazanç/kayıp akışı kullanıcı seçimini bekler).
    const son = simdi() + 120000;
    while (simdi() < son) {
      await new Promise((r) => setTimeout(r, 40));
      if (this.durum === 'bekliyor' || this.durum === 'kapali' || this.durum === 'menu') break;
      if (this.durum === 'bitti' && this.sonucAcik) break;
    }
    return true;
  }

  ozet(): Record<string, unknown> {
    const d = this.d;
    return {
      oturum: this.durum,
      bolum: this.v?.id ?? null,
      kalanHamle: d?.kalanHamle ?? null,
      puan: d?.puan ?? null,
      bitti: d?.bitti ?? null,
      hamleNo: d?.hamleNo ?? null,
      hedefler: d ? d.hedefler.map((h) => ({ tur: h.hedef.tur, ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam })) : [],
      korukDolum: d?.korukDolum ?? 0,
      guclendirici: d?.istatistik.guclendirici ?? 0,
    };
  }
}
