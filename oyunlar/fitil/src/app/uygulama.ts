/**
 * FİTİL uygulaması (P5): modülleri birbirine bağlar ve ekran akışını yürütür
 * (GDD §14).
 *
 *   açılış (ilk dokunuş sesi açar)
 *     ├─ ilk açılış → doğrudan Bölüm 1 (öğretim) → kazanınca harita
 *     └─ sonraki açılışlar → harita
 *   harita → bölüm öncesi → oyun → kazandın / kaybettin → harita (sıradaki
 *   bölümün kartı fitil ilerledikten sonra kendiliğinden açılır) ya da tekrar
 *   harita → Günün Şenliği · Fişek Defteri · İstatistik/Rozetler · Ayarlar ·
 *            Nasıl oynanır · Usta Bölümleri · Sonsuz Şenlik (40 sonrası)
 *
 * İlk açılış kararı: WhatsApp'tan gelen bağlantıyı açan oyuncuya ilk
 * 20 saniyede oyunun kendisi gösterilir (K5: "Two Dots farkı ilk 20
 * saniyede hissedilsin"). 39 kilitli düğümlü bir harita ya da bir kart
 * okutmak yerine "Dokun ve başla" doğrudan Bölüm 1'in el animasyonuna gider;
 * harita ilk kazancın ödülü olarak, fitil 2. bölüme yanarak açılır.
 */
import { dilKaydet } from '../platform/dil';
import { Stage } from '../render/stage';
import { oyunCiziciOlustur, type OyunCiziciTam } from '../render/oyunCizici';
import { tabloCiz } from '../render/tablo';
import { sesMotoruOlustur, type SesMotoruAyrintili } from '../audio/sesMotoru';
import { yolCiziciOlustur } from '../input/yolCizici';
import { Arayuz, type AyarDegisikligi, type HaritaSecimi } from '../ui/arayuz';
import { buzz, setHaptics } from '../platform/haptics';
import { prefGet, prefSet } from '../platform/storage';
import { bolumuYukle } from '../core/index';
import type { BolumVerisi, OyunDurumu } from '../core/types';
import * as meta from '../meta';
import type { Kayit } from '../meta';
import { bolumGetir } from '../levels/index';
import { acemiSec, ustaSec } from '../bot/index';
import { MK, tarihUzun } from '../ui/metinler';
import { KAPSUL_RENKLERI, MAHALLELER } from './katalog';
import type { YolCizici } from './sozlesme';
import { Kayitci } from './kayitci';
import { BolumUretici } from './uretim';
import { Oturum } from './oturum';
import {
  ayarlarVM,
  bolumOncesiVM,
  coskuRoketi,
  defterVM,
  fitilGorunumu,
  gokyuzuTemasi,
  gunlukVM,
  haritaVM,
  istatistikVM,
  kasabaVM,
  mahalleOdulleri,
  nasilVM,
  takiliDesenler,
} from './gorunum';
import { bekle, bugun, rastgeleTohum, simdi } from './zaman';

const SURUM = '1.0';
const GORULEN_ANAHTARI = 'fitil.gorulen';

export interface SicakVeri {
  bolum?: number | null;
}

function sistemAzHareket(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export class Uygulama {
  readonly stage: Stage;
  readonly cizici: OyunCiziciTam;
  readonly ses: SesMotoruAyrintili;
  readonly ui: Arayuz;
  readonly yc: YolCizici;
  readonly kayitci: Kayitci;
  readonly uretici = new BolumUretici();
  readonly oturum: Oturum;
  /** Test/inceleme için güncel ekran adı. */
  ekranAdi = 'acilis';
  private ciziciAktif = false;
  private sonKare = 0;
  /** Önceki karede çizici çalışıyor muydu (durunca fişek tuvali boşalır). */
  private oncekiAktif = false;
  private hizliKip = false;
  private sesAcildi = false;
  private istek: { tur: 'bolum'; id: number } | { tur: 'ekran'; ekran: HaritaSecimi } | null = null;
  private haritaAcik = false;
  private molaD = meta.molaBaslat();
  private molaBekliyor = false;
  private bildirimler: { m: string; sure: number }[] = [];
  private bildirimSure: ReturnType<typeof setTimeout> | null = null;
  private otomatikKart: number | null = null;
  private tabloOnbellek = new Map<string, HTMLCanvasElement>();
  private bulutGeldi = false;
  /** Oturum sürerken gelen bulut kaydı: harita dönüşünde uygulanır (sürmekte olan deneme ezilmesin). */
  private bekleyenBulut: Kayit | null = null;
  /** Bellek kaydı uyarısı bu açılışta gösterildi mi. */
  private bellekUyarildi = false;
  /** (Kancalar) Son kazancın ödülleri: haritaya dönüşte balonlar (kasaba açılışı, kandil yetti, sancak). */
  private sonKazanc: meta.Odul[] | null = null;
  /** Kasaba kutlaması sürerken haritada yapılan seçim (kaybolmasın). */
  private bekleyenHaritaSecimi: HaritaSecimi | null = null;

  constructor(private host: HTMLElement) {
    this.stage = new Stage(host, 2);
    this.kayitci = new Kayitci();
    const a = this.kayit.ayarlar;
    const az = a.hareketiAzalt ?? sistemAzHareket();
    this.cizici = oyunCiziciOlustur(this.stage, {
      palet: a.palet,
      hareketiAzalt: az,
      hiz: a.hiz,
      kalite: 'oto',
      desenler: takiliDesenler(this.kayit),
      fitil: fitilGorunumu(this.kayit),
      gokyuzu: gokyuzuTemasi(this.kayit),
    });
    this.ses = sesMotoruOlustur();
    this.ses.ayarla({ sfx: a.sfx, muzik: a.muzik });
    setHaptics(a.titresim);
    this.ui = new Arayuz({
      kok: host,
      ses: this.ses,
      titresim: (p) => buzz(p),
      palet: a.palet,
      hareketiAzalt: az,
      geri: this.geriCagirimlar(),
    });
    // Bulut kaydı (claude.ai, oturum açık) açılış ekranı beklerken yüklensin: ilk açılış kararı ona göre.
    void this.kayitci.bulutaBaglan();
    // Girdi: geri çağırımlar oturuma gider (oturum hemen ardından kurulur).
    this.yc = yolCiziciOlustur({
      hedef: this.stage.canvas,
      geometri: () => this.cizici.geometri(),
      durum: () => this.oturum.girdiDurumu(),
      geriCagirim: {
        yolDegisti: (y, h, d) => this.oturum.yolDegisti(y, h, d),
        birakildi: (y, h) => this.oturum.birakildi(y, h),
        iptal: () => this.oturum.iptal(),
        ciftDokunus: (h) => this.oturum.ciftDokunus(h),
        ozelDokunus: (h) => this.oturum.ozelDokunus(h),
        hucreSecildi: (h) => this.oturum.hucreSecildi(h),
        parmak: (p) => this.oturum.parmak(p),
        dokunuldu: () => this.oturum.dokunuldu(),
        imlecDegisti: (h) => this.oturum.imlecDegisti(h),
        kisitliBasildi: (h) => this.oturum.kisitliBasildi(h),
      },
    });
    this.oturum = new Oturum({
      cizici: this.cizici,
      ses: this.ses,
      ui: this.ui,
      yc: this.yc,
      kayitci: this.kayitci,
      titret: (p) => buzz(p),
      ayarlarAc: () => this.ayarlarAc(),
      bugun: () => bugun(),
      bekle: (ms) => this.bekle(ms),
      tabloTuvali: (kod, mahalle, nadirlik, bolumId, gunluk) => this.tablo(kod, mahalle, nadirlik, bolumId, gunluk),
      ekran: (ad) => (this.ekranAdi = ad),
    });
    this.yc.kipAyarla('kapali');
    this.cizici.olayDinle((o) => {
      // Kesilen eski oynatmanın artık olayları (yeni bölüm kurulurken bildirilir) ses de çalmasın.
      if (this.oturum.olayGecerli()) this.ses.olay(o);
      this.oturum.olay(o);
    });
    this.cizici.kameraDinle((y) => {
      this.ses.yavasCekim(y);
      this.oturum.kamera(y);
    });
    // Gök fişeklerinin HUD'un arkasında kalan kısmı HUD'un üstündeki tuvalde çizilir.
    this.cizici.fisekKatmani(this.ui.fisekKatmani());
    this.cizici.fisekDinle((x) => {
      const w = Math.max(1, this.stage.width);
      this.ses.uzakFisek((x / w - 0.5) * 1.4, 0.8);
    });
    this.ui.yerlesimDinle(() => this.yerlesimTazele());
    document.addEventListener('visibilitychange', () => {
      this.ses.askiya(document.hidden);
      this.molaIlerle();
    });
    setInterval(() => this.molaIlerle(), 5000);
    const dongu = (t: number) => {
      const dt = this.sonKare ? Math.min(100, t - this.sonKare) : 16;
      this.sonKare = t;
      if (this.ciziciAktif) this.cizici.kare(dt);
      else if (this.oncekiAktif) this.cizici.dinlen();
      this.oncekiAktif = this.ciziciAktif;
      // Yedek yol (işçi yok): arka plan üretimi oyun ekranında durur (kare süresi bozulmasın).
      this.uretici.duraklat = this.oturum.durum !== 'kapali' || this.oturum.ciziyor;
      requestAnimationFrame(dongu);
    };
    requestAnimationFrame(dongu);
  }

  get kayit(): Kayit {
    return this.kayitci.kayit;
  }

  bekle(ms: number): Promise<void> {
    return bekle(this.hizliKip ? Math.min(ms, 60) : ms);
  }

  /** Sıcak yeniden yükleme anlık görüntüsü (claude.ai görüntüleyicisi). */
  anlik(): SicakVeri {
    return { bolum: this.oturum.aktifBolum() };
  }

  // ─────────────────────────── Ana akış ───────────────────────────

  async calistir(veri: SicakVeri): Promise<void> {
    this.ekranAdi = 'acilis';
    void this.onIsinma(veri);
    await this.ui.acilis(() => this.sesAc());
    // Bulut bağlantısı açılışta başladı; ilk açılış kararı (öğretim mi harita mı) ondan sonra,
    // en fazla 1,5 sn beklenir. Geç gelirse oturum dışındayken uygulanır.
    const bulut = await Promise.race([this.kayitci.bulutaBaglan(), bekle(1500).then(() => undefined)]);
    if (bulut) this.bulutKaydiUygula(bulut);
    else if (bulut === undefined) void this.kayitci.bulutaBaglan().then((k) => k && this.bulutKaydiGeldi(k));
    this.gunTazele();
    const ilk = !Object.keys(this.kayit.bolumler).length;
    const sicak = veri.bolum ? this.kaynakBolum(veri.bolum) : null;
    if (sicak) {
      const r = await this.bolumAkisi(sicak, { kartAtla: true });
      if (r === 'sonraki') this.sonrakiniAyarla(sicak);
    } else if (ilk) {
      const r = await this.bolumAkisi(this.kaynakBolum(1)!, { kartAtla: true });
      if (r === 'sonraki') this.otomatikKart = 2;
    }
    await this.haritaDongusu();
  }

  /**
   * Açılış ekranı dokunuşu beklerken ilk gidilecek bölümün pişirmeleri
   * (sprite önbelleği, gök, sandık) parça parça yapılır: dokunuşta yalnız
   * tahta kurulur, ekran donmaz (K5 ilk 20 saniye). İlk açılışta Bölüm 1,
   * sonrakilerde sıradaki bölüm (haritadan büyük olasılıkla o seçilir).
   */
  private async onIsinma(veri: SicakVeri): Promise<void> {
    try {
      // Logo tutuşması (1,2 sn) akıcı oynasın; adımlar sonra, her biri ayrı görevde.
      await bekle(1350);
      const iptal = () => this.oturum.durum !== 'kapali' || this.ciziciAktif;
      if (iptal()) return;
      const ilk = !Object.keys(this.kayit.bolumler).length;
      const id = veri.bolum ?? (ilk ? 1 : Math.min(40, meta.acikEnYuksek(this.kayit)));
      const v = this.kaynakBolum(id);
      if (!v) return;
      const cosku = coskuRoketi(v, this.kayit);
      const d0 = bolumuYukle(v, meta.siradakiDenemeNo(this.kayit, v.id), { cosku });
      const a = this.ui.onYerlesim(d0.w, d0.h);
      await this.cizici.onIsit(d0, v, a.tahta, a.gokBandi, () => bekle(60), iptal);
    } catch {
      /* önden ısınma isteğe bağlı: bölüm kurulurken yine pişer */
    }
  }

  private sesAc(): void {
    if (this.sesAcildi) return;
    this.sesAcildi = true;
    this.ses.ac();
    const a = this.kayit.ayarlar;
    this.ses.ayarla({ sfx: a.sfx, muzik: a.muzik });
    this.ses.ortam(a.ortam);
    this.ses.muzik(a.muzik > 0);
  }

  /** Geç gelen bulut kaydı: oturum sürüyorsa harita dönüşüne kadar bekler. */
  private bulutKaydiGeldi(k: Kayit): void {
    if (this.oturum.durum !== 'kapali') {
      this.bekleyenBulut = k;
      return;
    }
    this.bulutKaydiUygula(k);
  }

  private bulutKaydiUygula(k: Kayit): void {
    this.bekleyenBulut = null;
    if (!this.kayitci.bulutUygula(k)) return;
    this.bulutGeldi = true;
    this.tabloOnbellek.clear();
    this.ayarlariUygula();
    if (this.haritaAcik && this.oturum.durum === 'kapali') void this.ui.harita(this.haritaModeli());
    this.bildir('Bulut kaydı yüklendi');
  }

  /**
   * Depolama yoksa (gizli pencere) haritada bir kez, öğretimden sonra: oyun ekranında tahtayı örtmesin.
   * Yeni sürümün kaydı görüldüyse (eski sekme; depo salt okunur) her harita dönüşünde: ilerleme
   * kaydedilmiyor, sayfa yenilenmeli.
   */
  private bellekUyarisi(): void {
    if (this.kayitci.saltOkunur) {
      void this.bekle(900).then(() => {
        if (this.haritaAcik) this.bildir(MK.yeniSurum, 4500);
      });
      return;
    }
    if (this.bellekUyarildi || !this.kayitci.bellekte) return;
    this.bellekUyarildi = true;
    void this.bekle(900).then(() => {
      if (this.haritaAcik) this.bildir('Bu tarayıcı ilerlemeni saklamıyor. Ayarlar > Kayıt kodu ile yedekleyebilirsin.', 4200);
      else this.bellekUyarildi = false;
    });
  }

  private gunTazele(): void {
    const r = meta.gunGiris(this.kayit, bugun());
    if (r.degisti) this.kayitci.degistir(r.kayit);
  }

  private haritaModeli() {
    return haritaVM(this.kayit, prefGet(GORULEN_ANAHTARI, { parca: this.kayit.koleksiyon.parcalar.length, rozet: this.kayit.rozetler.length }));
  }

  private gorulenIsaretle(tur: 'parca' | 'rozet'): void {
    const g = prefGet(GORULEN_ANAHTARI, { parca: 0, rozet: 0 });
    if (tur === 'parca') g.parca = this.kayit.koleksiyon.parcalar.length;
    else g.rozet = this.kayit.rozetler.length;
    prefSet(GORULEN_ANAHTARI, g);
  }

  private async haritaDongusu(): Promise<void> {
    if (!prefGet<{ parca: number; rozet: number } | null>(GORULEN_ANAHTARI, null)) prefSet(GORULEN_ANAHTARI, { parca: this.kayit.koleksiyon.parcalar.length, rozet: this.kayit.rozetler.length });
    for (;;) {
      const istek = this.istek;
      this.istek = null;
      if (istek?.tur === 'bolum') {
        const v = this.kaynakBolum(istek.id);
        if (v) {
          const r = await this.bolumAkisi(v, { kartAtla: true });
          if (r === 'sonraki') this.sonrakiniAyarla(v);
        }
        continue;
      }
      if (istek?.tur === 'ekran') {
        // Harita arkada görünsün (ekranlar haritanın üstünde açılır).
        this.ciziciAktif = false;
        this.haritaAcik = true;
        void this.ui.harita(this.haritaModeli());
        await this.haritaSecimi(istek.ekran);
        this.haritaAcik = false;
        continue;
      }
      if (this.bekleyenBulut) this.bulutKaydiUygula(this.bekleyenBulut);
      this.gunTazele();
      this.ciziciAktif = false;
      this.ekranAdi = 'harita';
      this.haritaAcik = true;
      this.arkaPlanUretim();
      const p = this.ui.harita(this.haritaModeli());
      this.molaGosterBekliyorsa();
      this.bellekUyarisi();
      // (Kancalar §C.1, §C.6) Kıvılcım Usta balonu: kasabanın açılışı, "Kandil yetti", ilk sancak.
      // Balon çıkan dönüşte otomatik bölüm kartı bir kez atlanır.
      if (this.haritaBalonu()) this.otomatikKart = null;
      let secim: HaritaSecimi;
      const oto = this.otomatikKart;
      this.otomatikKart = null;
      if (this.bekleyenHaritaSecimi) {
        secim = this.bekleyenHaritaSecimi;
        this.bekleyenHaritaSecimi = null;
      } else if (oto !== null) {
        secim = await this.otomatikKartAc(p, oto);
      } else secim = await p;
      this.haritaAcik = false;
      if (secim.tur === 'kapandi') continue;
      await this.haritaSecimi(secim);
    }
  }

  /** Kazançtan sonra: fitil haritada ilerlerken bekle, sonra sıradaki bölümün kartını aç. */
  private async otomatikKartAc(p: Promise<HaritaSecimi>, id: number): Promise<HaritaSecimi> {
    const zaman = this.bekle(1500).then(() => null);
    const ilk = await Promise.race([p, zaman]);
    if (ilk) return ilk;
    const v = this.kaynakBolum(id);
    // Bu arada (ör. geç gelen bulut kaydıyla) kazanılmış görünüyorsa kart açılmaz.
    if (!v || !meta.bolumAcikMi(this.kayit, id) || meta.bolumKazanildi(this.kayit, id)) return p;
    return { tur: 'bolum', id };
  }

  private async haritaSecimi(s: HaritaSecimi): Promise<void> {
    switch (s.tur) {
      case 'bolum': {
        const v = this.kaynakBolum(s.id);
        if (!v) return;
        const r = await this.bolumAkisi(v, {});
        if (r === 'sonraki') this.sonrakiniAyarla(v);
        return;
      }
      case 'usta': {
        const v = bolumGetir(s.id);
        if (v) await this.bolumAkisi(v, {});
        return;
      }
      case 'gunluk':
        await this.gunlukAkisi();
        return;
      case 'sonsuz':
        await this.sonsuzAkisi();
        return;
      case 'defter':
        await this.defterAc();
        return;
      case 'istatistik':
        this.ekranAdi = 'istatistik';
        this.gorulenIsaretle('rozet');
        await this.ui.istatistik(istatistikVM(this.kayit));
        return;
      case 'ayarlar':
        await this.ayarlarAc();
        return;
      case 'nasil':
        this.ekranAdi = 'nasil';
        await this.ui.nasilOynanir(nasilVM(this.kayit));
        return;
      case 'kasaba':
        await this.kasabaAkisi();
        return;
      default:
        return;
    }
  }

  // ─────────────────────────── Kasaba (Kancalar §C.1) ───────────────────────────

  /**
   * Kasaba paneli → "Yap": iş kaydedilir, çekmece kapanır (240 ms), harita
   * yeni modelle çizilir ve işin çapasında kutlar (kıvılcımlar, ışıklar,
   * sakin balonu); mahalle 6/6 olduysa Mahalle şenliği ve kasaba kartı.
   * Kandil sıradaki işe de yetiyorsa panel kutlamadan sonra kendiliğinden
   * yeniden açılır (göçle 38–71 kandille gelen oyuncu her iş için Kasaba'ya
   * basmasın); oyuncu kapatınca ya da kandil bitince haritaya dönülür.
   */
  private async kasabaAkisi(): Promise<void> {
    for (;;) {
      if (!meta.kasabaAcikMi(this.kayit)) return;
      this.ekranAdi = 'kasaba';
      const s = await this.ui.kasaba(kasabaVM(this.kayit));
      if (s.tur !== 'yap') return;
      const r = meta.kasabaIsYap(this.kayit, s.id);
      if (!r.tamam) {
        this.bildir('Bu iş şimdi yapılamıyor');
        return;
      }
      this.kayitci.degistir(r.kayit, 0);
      await this.bekle(240);
      this.ekranAdi = 'kasabaKutlama';
      this.haritaAcik = true;
      const p = this.ui.harita(this.haritaModeli());
      const secim = await Promise.race([p, this.ui.haritaKutlamasi().then(() => null)]);
      // Kutlama sürerken haritada seçim yapıldıysa kaybolmasın (döngü işler); kart yine gösterilir.
      if (secim && secim.tur !== 'kapandi') this.bekleyenHaritaSecimi = secim;
      const senlik = r.oduller.find((o): o is Extract<meta.KasabaOdulu, { tur: 'kasabaSenligi' }> => o.tur === 'kasabaSenligi');
      if (senlik) {
        this.ekranAdi = 'defterKarti';
        await this.ui.defterKarti({ mahalle: senlik.mahalle, oduller: [], tur: 'kasaba' });
      }
      // Oyuncu kutlamada başka bir şey seçtiyse ya da kandil yetmiyorsa haritada kal.
      if (this.bekleyenHaritaSecimi || !this.haritaAcik || this.ui.modalAcik) return;
      if (meta.siradakiKasabaIsi(this.kayit)?.durum !== 'yapilabilir') return;
      this.ekranAdi = 'harita';
      // Kısa ara (kutlama sakin balonu kalkınca bitti); oyuncu bu arada haritada bir şeye
      // dokunursa o seçilir, panel açılmaz.
      const ara = await Promise.race([p, this.bekle(this.hizliKip ? 0 : 450).then(() => null)]);
      if (ara && ara.tur !== 'kapandi') {
        this.bekleyenHaritaSecimi = ara;
        return;
      }
      if (this.bekleyenHaritaSecimi || !this.haritaAcik || this.ui.modalAcik) return;
    }
  }

  /**
   * Haritada bir Kıvılcım Usta balonu gerekiyorsa gösterir (true döner):
   *  - kasaba-ilk / kasaba-hosgeldin: kasaba açık, hiç iş yok (3. bölümün ilk
   *    kazancı ya da göçle gelen eski oyuncu; KANCALAR §C.6);
   *  - "Kandil yetti: {iş} yapalım mı?" (kazançtan sonra, iş başına bir kez; §C.1);
   *  - sancak-ilk: ilk 3/3 mühürden sonra sancağın üstünde.
   */
  private haritaBalonu(): boolean {
    const k = this.kayit;
    const oduller = this.sonKazanc;
    this.sonKazanc = null;
    if (!meta.kasabaAcikMi(k)) return false;
    const gorulen = k.ipuclari.gorulen;
    const I = meta.KANCA_IPUCU;
    // İpucu "görüldü" ancak balon gerçekten gösterilince yazılır (harita kapandıysa ya da
    // bir pencere açıldıysa ipucu harcanmaz).
    const goster = (metin: string, yer: 'kasaba' | { bolumId: number }, sure: number, gorundu: (k: Kayit) => Kayit) => {
      void this.bekle(this.hizliKip ? 0 : 650).then(() => {
        if (!this.haritaAcik || this.ui.modalAcik) return;
        this.kayitci.degistir(gorundu(this.kayit), 1500);
        void this.ui.haritaBalonu(metin, yer, sure);
      });
    };
    if (k.ayarlar.ipuclari && k.kasaba.isler.length === 0 && !gorulen.includes(I.kasabaIlk) && !gorulen.includes(I.kasabaHosgeldin)) {
      // Kasaba bu kazançla açıldıysa (ya da oyuncu hâlâ İskele'deyse) ilk kandil, değilse göçle gelen oyuncu.
      const ilk = !!oduller?.some((o) => o.tur === 'kasabaAcildi') || !meta.bolumKazanildi(k, 5);
      const sira = meta.kasabaUyarisi(k);
      goster(ilk ? MK.kasabaIlk : MK.kasabaHosgeldin(meta.kandilBakiyesi(k)), 'kasaba', 4500, (x) => {
        const y = meta.ipucuGoruldu(meta.ipucuGoruldu(x, I.kasabaIlk), I.kasabaHosgeldin);
        return sira ? meta.kasabaUyarildi(y, sira.id) : y;
      });
      return true;
    }
    if (!oduller) return false;
    // (KANCALAR §C.6) İlk sancak, yeni kozmetiğin haritadaki tek tanıtımı: aynı dönüşte
    // "Kandil yetti" de varsa önce sancak (kandil uyarısı bir sonraki dönüşe kalır).
    const sancak = oduller.find((o): o is Extract<meta.Odul, { tur: 'sancak' }> => o.tur === 'sancak');
    if (sancak && k.ayarlar.ipuclari && !gorulen.includes(I.sancakIlk)) {
      goster(MK.sancakIlk, { bolumId: sancak.bolumId }, 3200, (x) => meta.ipucuGoruldu(x, I.sancakIlk));
      return true;
    }
    const is = meta.kasabaUyarisi(k);
    if (is) {
      goster(MK.kandilYetti(is.ad), 'kasaba', 3500, (x) => meta.kasabaUyarildi(x, is.id));
      return true;
    }
    return false;
  }

  private sonrakiniAyarla(v: BolumVerisi): void {
    if (v.tur === 'usta' || v.tur === 'gunluk' || v.tur === 'sonsuz') return;
    // Sıradaki bölüm yalnız ilerleme sınırındaysa (henüz kazanılmamış) kendiliğinden açılır; eski bölüm tekrarında harita sakin kalır.
    if (v.id < 40 && meta.bolumAcikMi(this.kayit, v.id + 1) && !meta.bolumKazanildi(this.kayit, v.id + 1)) this.otomatikKart = v.id + 1;
  }

  private kaynakBolum(id: number): BolumVerisi | null {
    return bolumGetir(id) ?? this.adlandir(this.uretici.hazir(id));
  }

  /** Üretilen bölümlere görünen ad: Günün Şenliği'nde tarih ("14 Ekim 2026"). */
  private adlandir(v: BolumVerisi | null): BolumVerisi | null {
    if (!v) return null;
    return v.tur === 'gunluk' ? { ...v, ad: tarihUzun(v.id) } : v;
  }

  // ─────────────────────────── Bölüm akışı ───────────────────────────

  /**
   * Bir bölümü oynatır: bölüm öncesi kartı (atlanabilir), denemeler, sonuç.
   * Dönüş: 'sonraki' (kazandı, Devam) ya da 'harita'.
   */
  async bolumAkisi(v: BolumVerisi, s: { kartAtla?: boolean }): Promise<'sonraki' | 'harita'> {
    let kart = !s.kartAtla;
    for (;;) {
      const deneme = meta.siradakiDenemeNo(this.kayit, v.id);
      const cosku = coskuRoketi(v, this.kayit);
      let d0: OyunDurumu;
      try {
        d0 = bolumuYukle(v, deneme, { cosku });
      } catch {
        this.bildir('Bu bölüm yüklenemedi');
        return 'harita';
      }
      if (kart) {
        this.ekranAdi = 'bolumOncesi';
        // (Kancalar §C.6 muhur-kart) Mühürlü ilk bölüm öncesi kartında bir kez.
        const k0 = this.kayit;
        const muhurIpucu = k0.ayarlar.ipuclari && v.muhurler && meta.muhurlerGorunur(k0) && !k0.ipuclari.gorulen.includes(meta.KANCA_IPUCU.muhurKart) ? MK.muhurKart : null;
        if (muhurIpucu) this.kayitci.degistir(meta.ipucuGoruldu(k0, meta.KANCA_IPUCU.muhurKart), 1500);
        const c = await this.ui.bolumOncesi(bolumOncesiVM(v, d0, this.kayit, cosku, muhurIpucu));
        if (c === 'geri' || this.istek) return 'harita';
        kart = false;
      }
      this.ui.haritaGizle();
      this.ciziciAktif = true;
      const r = await this.oturum.oyna(v, d0, deneme);
      if (r.tur === 'tekrar') {
        if (this.istek) return 'harita';
        continue;
      }
      this.ui.hudGizle();
      if (r.tur === 'harita') return 'harita';
      await this.odulleriGoster(r.sonuc, v);
      this.sonKazanc = r.sonuc.oduller;
      return 'sonraki';
    }
  }

  /** Kazandın'dan sonra: mahalle tamamlandıysa şov ve Fener Koyu Defteri kartı (§10.1). */
  private async odulleriGoster(sonuc: meta.BolumSonucCiktisi, v: BolumVerisi): Promise<void> {
    let mahalle: number | null = null;
    for (const o of sonuc.oduller) if (o.tur === 'mahalleTamam') mahalle = o.mahalle;
    if (mahalle === null) return;
    // Açılmamış güçlendirici meta'da toza döner: kart gerçekte verileni gösterir.
    const mahalleOdul = mahalleOdulleri(sonuc.oduller);
    await this.mahalleSovu(v, mahalle);
    this.ekranAdi = 'defterKarti';
    await this.ui.defterKarti({ mahalle, oduller: mahalleOdul });
  }

  /**
   * Mahalle tamamlanınca 6 sn'lik şov (§10.1): tahta kararıp çekilir, gök ve
   * kasaba ekranın üçte ikisine açılır; toplanan desenler 3–5'li salvolarla,
   * bütün göğe yayılarak patlar, sonda büyük final salvosu. Mahalle adı
   * altın şeritte. Dokunuş atlar.
   */
  private async mahalleSovu(v: BolumVerisi, mahalle: number): Promise<void> {
    this.ekranAdi = 'mahalleSovu';
    const desenler = meta.desenDurumlari(this.kayit).filter((d) => d.tamam).map((d) => d.id as string);
    const liste = desenler.length ? desenler : takiliDesenler(this.kayit);
    this.ciziciAktif = true;
    let bitti = false;
    const atla = () => (bitti = true);
    this.host.addEventListener('pointerdown', atla, { once: true });
    // Tahta kararır, sonra gök büyür ve aydınlanır.
    this.cizici.karart(0.85);
    await this.bekle(420);
    this.cizici.sov(true);
    this.cizici.karart(0);
    const ad = MAHALLELER[mahalle]?.ad;
    if (ad) void this.ui.bant(`${ad} tamamlandı!`, 'altin');
    const W = this.stage.width;
    const ufuk = Math.max(120, this.cizici.ufuk());
    const sure = this.hizliKip ? 300 : 6000;
    const bas = simdi();
    let i = 0;
    let salvo = 0;
    const patlat = (x: number, y: number) => {
      this.cizici.havaiFisek(x, y, (i + v.mahalle) % 6, liste[i % liste.length]);
      i++;
    };
    while (!bitti && simdi() - bas < sure - 900) {
      // Salvo: 3–5 fişek; yükseklik ve yatay konum altın oranla dağılır, aynı yere yığılmaz.
      const n = 3 + (salvo % 3);
      for (let k = 0; k < n && !bitti; k++) {
        const u = (i * 0.618 + 0.13) % 1;
        const w = (i * 0.382 + salvo * 0.17) % 1;
        patlat(W * (0.1 + 0.8 * u), ufuk * (0.14 + 0.62 * w));
        await this.bekle(90);
      }
      salvo++;
      await this.bekle(520 + (salvo % 2) * 160);
    }
    // Final: ufuk boyunca geniş salvo.
    if (!bitti) {
      for (let k = 0; k < 7 && !bitti; k++) {
        patlat(W * (0.08 + (0.84 * k) / 6), ufuk * (0.22 + 0.3 * ((k * 0.618) % 1)));
        await this.bekle(60);
      }
      await this.bekle(this.hizliKip ? 50 : 900);
    }
    this.host.removeEventListener('pointerdown', atla);
  }

  // ─────────────────────────── Günlük ve Sonsuz ───────────────────────────

  private arkaPlanUretim(): void {
    const t = bugun();
    // İşçi varsa (ana iş parçacığına yük değil) Günün Şenliği açılmadan önce, 7. bölümden
    // itibaren hazırlanır: 10. bölüm kazanılınca tahta beklemeden açılır (§10.5).
    const erken = meta.acikEnYuksek(this.kayit) >= 7 && this.uretici.isciVar;
    if ((meta.gunlukAcik(this.kayit) || erken) && !this.uretici.hazir(t)) void this.uretici.gunluk(t).catch(() => {});
    if (meta.sonsuzAcikMi(this.kayit)) {
      const n = this.kayit.sonsuzEnYuksek + 1;
      if (!this.uretici.hazir(meta.SONSUZ_TABANI + n)) void this.uretici.sonsuz(n).catch(() => {});
    }
  }

  private async uretilmisBolum(tur: 'gunluk' | 'sonsuz', n: number): Promise<BolumVerisi | null> {
    const id = tur === 'gunluk' ? n : meta.SONSUZ_TABANI + n;
    const hazir = this.uretici.hazir(id);
    if (hazir) return this.adlandir(hazir);
    this.ekranAdi = 'bekleme';
    // Kart kapatılırsa (✕ / Esc) beklemeden dönülür; üretim arka planda sürer, sonraki açılışta hazırdır.
    let iptalEt: () => void = () => {};
    const iptalSoz = new Promise<null>((r) => (iptalEt = () => r(null)));
    const b = this.ui.bekleme(
      tur === 'gunluk' ? 'Kıvılcım Usta bugünün tahtasını hazırlıyor…' : `Kıvılcım Usta ${n}. şenliği hazırlıyor…`,
      tur === 'gunluk' ? 'Herkes bugün aynı tahtayı oynar.' : 'Her tahta botla denenip ayarlanır.',
      () => iptalEt(),
    );
    try {
      const p = tur === 'gunluk' ? this.uretici.gunluk(n, { oncelik: 1, ilerleme: (o) => b.ilerleme(o) }) : this.uretici.sonsuz(n, { oncelik: 1, ilerleme: (o) => b.ilerleme(o) });
      const v = await Promise.race([p, iptalSoz]);
      if (!v) return null;
      await this.bekle(250);
      return this.adlandir(v);
    } catch {
      this.bildir('Tahta hazırlanamadı, sonra yeniden dene');
      return null;
    } finally {
      this.uretici.dinleyicileriBirak(id);
      b.kapat();
    }
  }

  private async gunlukAkisi(): Promise<void> {
    for (;;) {
      this.gunTazele();
      const t = bugun();
      this.ekranAdi = 'gunluk';
      const hazir = this.uretici.hazir(t);
      if (!hazir) void this.uretici.gunluk(t).catch(() => {});
      const s = await this.ui.gunluk(gunlukVM(this.kayit, t), { kucukResim: hazir ? kucukResim(hazir) : null });
      if (s.tur === 'geri') return;
      if (!meta.bolumAcikMi(this.kayit, s.tarih, t)) {
        this.bildir('Bu gün artık arşivde değil');
        continue;
      }
      const v = await this.uretilmisBolum('gunluk', s.tarih);
      if (!v) continue;
      const r = await this.bolumAkisi(v, {});
      if (r === 'harita' && this.istek) return;
    }
  }

  private async sonsuzAkisi(): Promise<void> {
    for (;;) {
      const n = this.kayit.sonsuzEnYuksek + 1;
      const v = await this.uretilmisBolum('sonsuz', n);
      if (!v) return;
      // Sıradakini arka planda hazırla (§10.7).
      void this.uretici.sonsuz(n + 1).catch(() => {});
      const r = await this.bolumAkisi(v, {});
      if (r !== 'sonraki') return;
    }
  }

  // ─────────────────────────── Defter, ayarlar ───────────────────────────

  private async defterAc(): Promise<void> {
    this.ekranAdi = 'defter';
    this.gorulenIsaretle('parca');
    await this.ui.defter(defterVM(this.kayit, 'desenler'));
  }

  async ayarlarAc(): Promise<void> {
    const onceki = this.ekranAdi;
    this.ekranAdi = 'ayarlar';
    await this.ui.ayarlar(ayarlarVM(this.kayit, this.kayitci.depo.backend, sistemAzHareket(), SURUM), {
      nasilAc: () => void this.ui.nasilOynanir(nasilVM(this.kayit)),
      defterKartiAc: (m, tur) => void this.ui.defterKarti({ mahalle: m, oduller: [], tur }),
    });
    this.ekranAdi = onceki;
  }

  /** Kayıttaki ayarları bütün modüllere uygular (açılış, içe aktarma, bulut). */
  private ayarlariUygula(): void {
    const a = this.kayit.ayarlar;
    const az = a.hareketiAzalt ?? sistemAzHareket();
    this.ses.ayarla({ sfx: a.sfx, muzik: a.muzik });
    if (this.sesAcildi) {
      this.ses.ortam(a.ortam);
      this.ses.muzik(a.muzik > 0);
    }
    setHaptics(a.titresim);
    this.cizici.secenekAyarla({
      palet: a.palet,
      hareketiAzalt: az,
      hiz: this.hizliKip ? 6 : a.hiz,
      desenler: takiliDesenler(this.kayit),
      fitil: fitilGorunumu(this.kayit),
      gokyuzu: gokyuzuTemasi(this.kayit),
    });
    this.ui.secenekAyarla({ palet: a.palet, hareketiAzalt: az });
    this.molaD = meta.molaAyarDegisti(this.molaD, a.mola);
  }

  private ayarDegisti(d: AyarDegisikligi): void {
    const k = meta.ayarDegistir(this.kayit, d as Partial<meta.Ayarlar>);
    this.kayitci.degistir(k, 500);
    if (d.sfx !== undefined || d.muzik !== undefined) this.ses.ayarla({ sfx: d.sfx, muzik: d.muzik });
    if (d.muzik !== undefined && this.sesAcildi) this.ses.muzik(d.muzik > 0);
    if (d.ortam !== undefined && this.sesAcildi) this.ses.ortam(d.ortam);
    if (d.titresim !== undefined) {
      setHaptics(d.titresim);
      if (d.titresim) buzz(15);
    }
    if (d.hareketiAzalt !== undefined) this.cizici.secenekAyarla({ hareketiAzalt: d.hareketiAzalt });
    if (d.hiz !== undefined && !this.hizliKip) this.cizici.secenekAyarla({ hiz: d.hiz });
    if (d.palet !== undefined) this.cizici.secenekAyarla({ palet: d.palet });
    if (d.ipuclari === false) {
      this.ui.balonKapat();
      this.cizici.elGoster(null);
      this.cizici.vurgula(null, 'ipucu');
      // Oturumun el durumu da kapanır: tek dokunuşla geri gelmesin.
      this.oturum.ipuclariKapat();
    }
    if (d.mola !== undefined) this.molaD = meta.molaAyarDegisti(this.molaD, d.mola);
  }

  private geriCagirimlar(): Parameters<Arayuz['geriCagirimAyarla']>[0] {
    return {
      duraklatIstendi: () => void this.oturum.duraklat(),
      guclendiriciSecildi: (id) => this.oturum.guclendiriciSecildi(id),
      korukSecildi: () => this.oturum.korukSecildi(),
      secimIptal: () => this.oturum.secimIptal(),
      ayarDegisti: (d) => this.ayarDegisti(d),
      dilDegisti: (d) => {
        // Bütün metin tabloları sayfa açılırken kurulur: kaydı hemen yaz, seçimi cihaza yaz, yeniden yükle.
        this.kayitci.hemenYaz();
        dilKaydet(d);
        try {
          window.location.reload();
        } catch {
          /* yeniden yükleme engelli: seçim bir sonraki açılışta geçerli */
        }
      },
      balonlariSifirla: () => this.kayitci.degistir(meta.ipuclariniSifirla(this.kayit)),
      kayitKodu: () => meta.kayitKoduUret(this.kayit),
      kayitOnizle: (kod) => {
        const r = meta.kayitKoduCoz(kod);
        if (!r.tamam) return { gecerli: false, hata: r.mesaj };
        const o = r.onizleme;
        return { gecerli: true, toplamYildiz: o.anaYildiz + o.ustaYildiz, sonBolum: o.acikBolum, desen: o.desen, muhur: o.muhur, kasabaIs: o.kasabaIs, kandil: o.kandil };
      },
      kayitYukle: (kod) => {
        const r = meta.kayitKoduCoz(kod);
        if (!r.tamam) return false;
        // Oyun içinden (Duraklat > Ayarlar): süren deneme yeni kayda yazılmadan biter.
        this.oturum.kayitsizBitir();
        this.kayitci.degistir(r.kayit, 0);
        this.ayarlariUygula();
        this.tabloOnbellek.clear();
        prefSet(GORULEN_ANAHTARI, { parca: r.kayit.koleksiyon.parcalar.length, rozet: r.kayit.rozetler.length });
        if (this.haritaAcik) void this.ui.harita(this.haritaModeli());
        return true;
      },
      ilerlemeyiSifirla: () => {
        this.oturum.kayitsizBitir();
        this.kayitci.degistir(meta.ilerlemeyiSifirla(this.kayit, rastgeleTohum()), 0);
        this.tabloOnbellek.clear();
        prefSet(GORULEN_ANAHTARI, { parca: this.kayit.koleksiyon.parcalar.length, rozet: 0 });
        this.ayarlariUygula();
        if (this.haritaAcik) void this.ui.harita(this.haritaModeli());
      },
      tabloKarari: (id, sakla) => this.oturum.tabloKarari(id, sakla),
      tabloTuvali: (id) => {
        const b = this.kayit.bolumler[String(id)];
        if (!b?.tablo) return null;
        const v = this.kaynakBolum(id);
        return this.tablo(b.tablo, v?.mahalle ?? 0, (b.nadirlik ?? 0) as meta.Nadirlik, id);
      },
      desenTak: (id, tak) => {
        const r = tak ? meta.desenTak(this.kayit, id) : meta.desenCikar(this.kayit, id);
        if (!r.tamam) {
          this.ui.toast(DEFTER_HATA[r.hata] ?? 'Olmadı');
          return;
        }
        this.kayitci.degistir(r.kayit);
        this.cizici.secenekAyarla({ desenler: takiliDesenler(this.kayit) });
        return defterVM(this.kayit, 'desenler');
      },
      fitilSec: (id) => {
        const r = meta.fitilSec(this.kayit, id);
        if (!r.tamam) {
          this.ui.toast(DEFTER_HATA[r.hata] ?? 'Olmadı');
          return;
        }
        this.kayitci.degistir(r.kayit);
        this.cizici.secenekAyarla({ fitil: fitilGorunumu(this.kayit) });
        return defterVM(this.kayit, 'fitiller');
      },
      gokyuzuSec: (id) => {
        const r = meta.gokyuzuSec(this.kayit, id);
        if (!r.tamam) {
          this.ui.toast(DEFTER_HATA[r.hata] ?? 'Olmadı');
          return;
        }
        this.kayitci.degistir(r.kayit);
        this.cizici.secenekAyarla({ gokyuzu: gokyuzuTemasi(this.kayit) });
        return defterVM(this.kayit, 'gokyuzu');
      },
      tozHarca: (h) => {
        const kategori = h.tur;
        let parca: string | null = null;
        for (let i = 0; i < 3; i++) {
          const p = meta.parcaId(kategori, h.id, i);
          if (meta.tozlaAlinabilir(this.kayit, p)) {
            parca = p;
            break;
          }
        }
        if (!parca) {
          this.ui.toast('Bu koleksiyon tamam');
          return;
        }
        const r = meta.tozlaParcaAl(this.kayit, parca);
        if (!r.tamam) {
          this.ui.toast(DEFTER_HATA[r.hata] ?? 'Olmadı');
          return;
        }
        this.kayitci.degistir(r.kayit);
        this.ses.arayuz('parca');
        this.ui.toast(r.cekilis.tur === 'parca' && r.cekilis.tamamlandi ? 'Tamamlandı! Artık takabilirsin' : 'Parça alındı');
        return defterVM(this.kayit, kategori === 'desen' ? 'desenler' : 'fitiller');
      },
    };
  }

  /**
   * Gece Tablosu tuvali. Önbellekteki tuval DOM'a hiç girmez; her gösterim
   * için kopyası verilir: önbellekteki tuval kapanan kartın içinde kalırsa
   * bütün kart ağacını (≈200 düğüm) bellekte tutuyordu (Kazandın → Tekrar oyna).
   */
  private tablo(kod: string, mahalle: number, nadirlik: meta.Nadirlik, bolumId: number, gunluk?: number): HTMLCanvasElement | null {
    const anahtar = `${bolumId}:${nadirlik}:${kod}`;
    let c = this.tabloOnbellek.get(anahtar) ?? null;
    if (!c) {
      const kayitlar = meta.tabloCoz(kod);
      if (!kayitlar) return null;
      try {
        c = tabloCiz(kayitlar, mahalle, nadirlik, 512, 768, meta.tabloTohumu(bolumId, gunluk));
      } catch {
        return null;
      }
      if (this.tabloOnbellek.size > 24) this.tabloOnbellek.clear();
      this.tabloOnbellek.set(anahtar, c);
    }
    try {
      const kopya = document.createElement('canvas');
      kopya.width = c.width;
      kopya.height = c.height;
      kopya.className = c.className;
      kopya.getContext('2d')?.drawImage(c, 0, 0);
      return kopya;
    } catch {
      return null;
    }
  }

  // ─────────────────────────── Yerleşim, mola, bildirim ───────────────────────────

  private yerlesimTazele(): void {
    if (this.oturum.durum === 'kapali') return;
    const a = this.ui.tahtaAlani();
    this.cizici.alanAyarla(a.tahta, a.gokBandi, a.gorunurGok);
    requestAnimationFrame(() => this.oturum.hedefKonumlariniVer());
  }

  private molaIlerle(): void {
    const r = meta.molaIlerle(this.molaD, simdi(), { dakika: this.kayit.ayarlar.mola, gorunur: document.visibilityState !== 'hidden' });
    this.molaD = r.durum;
    if (r.goster) this.molaBekliyor = true;
    this.molaGosterBekliyorsa();
  }

  private molaGosterBekliyorsa(): void {
    if (!this.molaBekliyor) return;
    const oyunda = this.oturum.durum === 'bekliyor';
    if (!oyunda && !(this.haritaAcik && !this.ui.modalAcik)) return;
    this.molaBekliyor = false;
    void (async () => {
      if (oyunda) this.oturum.durum = 'menu';
      if (oyunda) this.yc.kipAyarla('kapali');
      const s = await this.ui.mola();
      this.molaD = meta.molaKapat(this.molaD, simdi());
      if (oyunda && this.oturum.durum === 'menu') {
        this.oturum.durum = 'bekliyor';
        this.yc.kipAyarla('cizim');
        if (s === 'mola') void this.oturum.duraklat();
      }
    })();
  }

  /** Sıralı kısa bildirimler (art arda gelen ödüller üst üste binmesin). */
  bildir(m: string, sure = 2000): void {
    this.bildirimler.push({ m, sure });
    if (!this.bildirimSure) this.bildirimSirasi();
  }

  private bildirimSirasi(): void {
    const b = this.bildirimler.shift();
    if (!b) {
      this.bildirimSure = null;
      return;
    }
    this.ui.toast(b.m, b.sure);
    this.bildirimSure = setTimeout(() => this.bildirimSirasi(), b.sure + 200);
  }

  // ─────────────────────────── Test kancası ───────────────────────────

  /** `window.__fitil` (oynanış testleri, scripts/oynanis.mjs). */
  testKancasi(): Record<string, unknown> {
    return {
      durum: () => ({ ekran: this.ekranAdi, ...this.oturum.ozet(), oynuyor: this.cizici.dev.oynuyor(), modal: this.ui.modalAcik, depo: this.kayitci.depo.backend, bulut: this.bulutGeldi, uretim: this.uretici.durum(), kalite: this.cizici.dev.sayac().kalite }),
      bolum: () => this.oturum.aktifBolum(),
      ekran: () => this.ekranAdi,
      bolumAc: (id: number) => {
        const v = this.kaynakBolum(id);
        if (!v) return false;
        this.istek = { tur: 'bolum', id };
        this.oturum.cik();
        this.ui.ekranlariKapat();
        if (this.haritaAcik) this.ui.haritaGizle();
        return true;
      },
      botHamle: async (tur: 'usta' | 'acemi' = 'usta') => {
        const tohum = (d: OyunDurumu) => (d.hamleNo * 2654435761) >>> 0;
        return this.oturum.botHamlesi((d, izin) => (tur === 'acemi' ? acemiSec(d, tohum(d), { izin }) : ustaSec(d, tohum(d), { izin, tamCozum: 24 })));
      },
      /** Ekranı kilitlerden bağımsız aç (test): 'gunluk' | 'defter' | 'ayarlar' | 'istatistik' | 'nasil' | 'sonsuz'. */
      ac: (ekran: string) => {
        this.istek = { tur: 'ekran', ekran: { tur: ekran } as HaritaSecimi };
        this.oturum.cik();
        this.ui.ekranlariKapat();
        if (this.haritaAcik) this.ui.haritaGizle();
        return true;
      },
      /** Test: otomatik kaliteyi elle düşür/yükselt (ölçüm sonra yine karar verir). */
      kaliteZorla: (dusuk: boolean) => this.cizici.dev.kaliteZorla(!!dusuk),
      /** Test: çizici (`dev.dondur/ilerle` ile zaman dondurulur; fişek ekran görüntüleri için). */
      cizici: () => this.cizici,
      hizli: (on: boolean) => {
        this.hizliKip = !!on;
        this.cizici.secenekAyarla({ hiz: on ? 6 : this.kayit.ayarlar.hiz });
      },
      kayit: () => JSON.parse(JSON.stringify(this.kayit)) as Kayit,
      kaydet: () => this.kayitci.hemenYaz(),
      /** Test: kayda üst düzey alan yaması (iç içe nesneler bir düzey birleşir), ör. stok ya da açık bölüm. */
      kayitYama: (y: Record<string, unknown>) => {
        // Eski şemalı tam kayıt (ör. yayındaki şema 2): gerçek yükleme yolundan (göç + onarım) geçer.
        if (typeof y.surum === 'number' && y.surum < meta.KAYIT_SURUMU) {
          const r = meta.kayitCoz(y);
          this.kayitci.degistir(r.kayit, 0);
          this.tabloOnbellek.clear();
          this.ayarlariUygula();
          return { gocler: r.gocler, onarilan: r.onarilan };
        }
        const k = meta.kayitKopyala(this.kayit) as unknown as Record<string, unknown>;
        for (const [a, d] of Object.entries(y)) {
          const o = k[a];
          k[a] = d && typeof d === 'object' && !Array.isArray(d) && o && typeof o === 'object' ? { ...(o as object), ...(d as object) } : d;
        }
        this.kayitci.degistir(k as unknown as Kayit, 0);
        this.ayarlariUygula();
        this.oturum.hudTazele();
        return true;
      },
      /** Tahtanın ekran geometrisi (dokunmatik sürükleme testleri için hücre merkezleri). */
      geometri: () => this.cizici.geometri(),
      /** Bölümün zorunlu ilk hamle hücreleri ve ilk ipucu el yolu (öğretim testi). */
      ogretim: () => {
        const v = this.oturum.v;
        return { zorunlu: v?.zorunluIlkHamle ?? null, el: v?.ipuclari?.find((t) => t.el)?.el ?? null };
      },
    };
  }
}

const DEFTER_HATA: Record<string, string> = {
  kapali: 'Önce 3 parçayı topla',
  dolu: 'En fazla 6 desen takılır',
  sonDesen: 'En az bir desen takılı kalmalı',
  yetersizToz: '10 toz gerekir',
  sahip: 'Bu parça zaten sende',
  gecersiz: 'Bu parça tozla alınamaz',
};

/** Günün Şenliği kartı için gerçek tahtanın küçük resmi (ilk tahta). */
function kucukResim(v: BolumVerisi): HTMLCanvasElement | null {
  let d: OyunDurumu;
  try {
    d = bolumuYukle(v, 0);
  } catch {
    return null;
  }
  const hucre = 12;
  const pay = 7;
  const w = d.w * hucre + 2 * pay;
  const h = d.h * hucre + 2 * pay;
  const olcek = 3;
  const c = document.createElement('canvas');
  c.width = w * olcek;
  c.height = h * olcek;
  c.className = 'f-gn-tahta';
  const x = c.getContext('2d');
  if (!x) return null;
  x.scale(olcek, olcek);
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#5A3A22');
  g.addColorStop(1, '#2A1A10');
  x.fillStyle = g;
  x.beginPath();
  x.roundRect(0, 0, w, h, 7);
  x.fill();
  x.strokeStyle = '#D9A441';
  x.lineWidth = 1.6;
  x.stroke();
  x.fillStyle = '#160E08';
  x.beginPath();
  x.roundRect(pay - 2, pay - 2, d.w * hucre + 4, d.h * hucre + 4, 4);
  x.fill();
  for (let yy = 0; yy < d.h; yy++)
    for (let xx = 0; xx < d.w; xx++) {
      const hc = d.hucreler[yy * d.w + xx];
      if (hc.delik) continue;
      const cx = pay + xx * hucre + hucre / 2;
      const cy = pay + yy * hucre + hucre / 2;
      if (hc.doseme > 0) {
        x.fillStyle = 'rgba(255,200,107,0.18)';
        x.fillRect(cx - hucre / 2 + 0.5, cy - hucre / 2 + 0.5, hucre - 1, hucre - 1);
      }
      const ic = hc.icerik;
      if (!ic) continue;
      if (ic.tur === 'kapsul') {
        const r = KAPSUL_RENKLERI[Math.max(0, ic.renk)] ?? KAPSUL_RENKLERI[0];
        x.fillStyle = ic.renk < 0 ? '#FFF4C2' : r.ana;
        x.beginPath();
        x.arc(cx, cy, hucre * 0.38, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.35)';
        x.beginPath();
        x.arc(cx - 1.2, cy - 1.4, hucre * 0.13, 0, Math.PI * 2);
        x.fill();
      } else {
        x.fillStyle = ic.tur === 'kaya' ? '#7A7280' : ic.tur === 'fener' ? '#FFD15C' : ic.tur === 'islak' ? '#3A5A8A' : '#5A5060';
        x.beginPath();
        x.roundRect(cx - hucre * 0.38, cy - hucre * 0.38, hucre * 0.76, hucre * 0.76, 2.5);
        x.fill();
      }
      if (hc.kafes) {
        x.strokeStyle = '#D9A441';
        x.lineWidth = 1;
        x.strokeRect(cx - hucre * 0.42, cy - hucre * 0.42, hucre * 0.84, hucre * 0.84);
      }
    }
  return c;
}
