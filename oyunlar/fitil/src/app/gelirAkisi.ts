/**
 * Gelir akışı (docs/CAN-REKLAM.md §2–§4, §8; G4): can, ödüllü reklam ve küçük
 * satın almanın uygulama tarafı. Yalnız gelir sağlayıcısı varken kurulur
 * (C1); sağlayıcı yoksa uygulama bu sınıfı hiç oluşturmaz ve oyun bugünkü
 * gibidir (can hapı, Mağaza, reklam düğmesi, gelir olayı yok).
 *
 * Kayıt kuralları saf `meta/can.ts`'te (G1); burada yalnız sıralama, kayıt
 * yazımı ve ölçüm olayları var:
 *
 *  - Her işlemden önce `tazele()`: tembel dolum kayda yazılır, can arttıysa
 *    `can_doldu { neden: 'zaman' }` (önceki → sonraki fark; açılış, harita
 *    hapı, can paneli). Böylece sonraki işlemin farkı yalnız kendi etkisidir.
 *  - Ödül ve can düşüşü kayda HEMEN yazılır (`yaz`: değiştir + hemen yaz;
 *    çökme/kapatma güvenli, §2, §3). Satın almada önce kayıt, SONRA
 *    `tamamla(jeton)` (§4, §13 karar 6).
 *  - `reklam_sonuc` (kart: false) ve `satin_alma`'yı sağlayıcının ölçüm
 *    sarmalayıcısı yazar (G2); burada yalnız `reklam_teklif`, Usta kartıyla
 *    reklamsız ödül (`reklam_sonuc` kart: true) ve `can_*`.
 *  - Reklam açıkken ses kısılır ve çizici durur (`reklamKipi`, §3).
 *  - Can paneli ve Mağaza seçimde kapanır; akış seçimi işleyip yeni modelle
 *    yeniden açar (§13 karar 7). `iptal` → panel yerinde kalır; `yok`/`hata`
 *    → "Şu an reklam yok" bildirimi ve düğme bu panel boyunca gizli.
 */
import * as meta from '../meta';
import type { Kayit } from '../meta';
import type { BolumVerisi } from '../core/types';
import { URUN_IDLERI, type GelirOlayYazici, type GelirSaglayici, type ReklamSonucu, type ReklamYeri, type UrunId } from '../platform/gelir';
import { gelirOlayi } from '../platform/olcum';
import { t } from '../platform/dil';
import { MC, URUN_METINLERI } from '../ui/metinler';
import type { CanPaneliSecimi, CanSayaciVM, CanVM, MagazaSecimi, MagazaUrunVM, MagazaVM } from '../ui/tipler';

/** Gelir akışının bildirimleri (iki dil; İngilizce testi: src/dil/en-oyun.test.ts). */
const G = {
  reklamYok: t('Şu an reklam yok', 'No ad right now'),
  satinAlindi: t('Satın alındı', 'Purchased'),
  satinHata: t('Satın alma tamamlanamadı', 'Purchase didn’t go through'),
  beklemede: t('Ödeme bekleniyor', 'Payment pending'),
  geriYuklendi: t('Satın alımlar geri yüklendi', 'Purchases restored'),
  geriYukleBos: t('Geri yüklenecek satın alım yok', 'Nothing to restore'),
  geriYukleHata: t('Geri yükleme şu an yapılamadı', 'Couldn’t restore right now'),
};

// ─────────────────────────── Görünüm modelleri (saf) ───────────────────────────

/** Harita hapı ve panel sayacı: tembel dolum uygulanmış can. */
export function canSayaciVM(k: Kayit, simdi: number): CanSayaciVM {
  const c = meta.canDurumu(k, simdi);
  return { sayi: c.sayi, enCok: c.enCok, sonrakiMs: c.sonrakiMs };
}

/**
 * Can paneli modeli (§6, §13 karar 5): başlık can 0 ise "Canların bitti",
 * değilse "Canlar n/5". Can doluyken reklam ve doldur satırı yok. Reklam
 * satırında `hak` bugün kalan hak (0 → "Yarın yine"); `hazir` reklam şu an
 * gösterilebilir mi (Usta kartıyla her zaman); `doldur` yalnız fiyat geldiyse.
 */
export function canPaneliVM(k: Kayit, simdi: number, bugun: number, e: { hazir: boolean; kart: boolean; fiyat: string | null }): CanVM {
  const c = meta.canDurumu(k, simdi);
  const dolu = c.sayi >= c.enCok;
  return {
    sayi: c.sayi,
    enCok: c.enCok,
    sonrakiMs: c.sonrakiMs,
    tur: c.sayi <= 0 ? 'bitti' : 'durum',
    reklam: dolu ? null : { hak: meta.reklamCanHakki(k, bugun), hazir: e.kart || e.hazir, kart: e.kart },
    doldur: dolu || !e.fiyat ? null : { fiyat: e.fiyat },
  };
}

/**
 * Mağaza modeli (§4, §6, §13 karar 10): `URUN_IDLERI` sırasıyla. Usta kartı
 * alınmışsa 'sende'; can doluyken `can_doldur` ve paket stok sınırını
 * aşacaksa 'stokDolu' (satılmaz); ürün listesi geldi ama ürün yoksa 'yok';
 * aksi halde 'satilik' (fiyat henüz gelmediyse null: düğme pasif "—").
 * `fiyatlar` null: liste henüz gelmedi.
 */
export function magazaVM(k: Kayit, simdi: number, fiyatlar: ReadonlyMap<UrunId, string> | null): MagazaVM {
  const c = meta.canDurumu(k, simdi);
  const urunler = URUN_IDLERI.map((id): MagazaUrunVM => {
    const m = URUN_METINLERI[id];
    let durum: MagazaUrunVM['durum'] = 'satilik';
    if (id === 'usta_karti' && k.gelir?.ustaKarti === true) durum = 'sende';
    else if (id === 'can_doldur' && c.sayi >= c.enCok) durum = 'stokDolu';
    else if (id === 'guclendirici_paketi' && !meta.paketSigarMi(k)) durum = 'stokDolu';
    else if (fiyatlar && !fiyatlar.has(id)) durum = 'yok';
    return { id, ad: m.ad, aciklama: m.aciklama, fiyat: fiyatlar?.get(id) ?? null, durum };
  });
  return { urunler, geriYukle: true };
}

/**
 * Kayıt kodu içe aktarılırken (Ayarlar > Kayıt kodu; sağlayıcı varken): can
 * ve satın almalar bu cihazın durumudur, koddan gelmez. Kod yalnız ilerlemeyi
 * taşır: eski kodla can doldurulamasın, koddaki Usta kartı (başka cihazda
 * alınmış ya da elle yazılmış) bu cihaza bedava geçmesin, koddaki jetonlar bu
 * cihazınkileri son 50'den atmasın. Usta kartı yeni cihaza mağazanın
 * `geriYukle()`'siyle gelir. Alan eski kayıtta yoksa yeni kayıttan da kalkar
 * (varsayılan sayılır).
 */
export function kayitKoduGelirKoru(yeni: Kayit, eski: Kayit): Kayit {
  const y = meta.kayitKopyala(yeni);
  if (eski.gelir) y.gelir = { ustaKarti: eski.gelir.ustaKarti, jetonlar: [...eski.gelir.jetonlar] };
  else delete y.gelir;
  if (eski.can) y.can = { ...eski.can };
  else delete y.can;
  return y;
}

// ─────────────────────────── Akış ───────────────────────────

/** Kayda yazılı can (tembel dolum UYGULANMADAN): geçersiz saatle `canDurumu` dolum yapmaz (G1 kararı 3). */
function kayittakiCan(k: Kayit): number {
  return meta.canDurumu(k, Number.NaN).sayi;
}

export interface GelirOrtami {
  saglayici: GelirSaglayici;
  /** Güncel kayıt (`Kayitci.kayit`). */
  kayit(): Kayit;
  /**
   * Kaydı değiştir ve HEMEN yaz (ödül, can düşüşü). false: kayıt yalnız
   * bellekte kaldı (depo salt okunur ya da dolu); satın alma tamamlanmaz.
   */
  yaz(k: Kayit): boolean;
  /** Kaydı değiştir, gecikmeli yaz (tembel dolum). */
  degistir(k: Kayit): void;
  ui: {
    canPaneli(vm: CanVM, tazele?: () => CanVM): Promise<CanPaneliSecimi>;
    magaza(vm: MagazaVM, tazele?: () => MagazaVM): Promise<MagazaSecimi>;
  };
  bildir(m: string, sure?: number): void;
  /** Duvar saati ms (`duvarSaati()`). */
  saat(): number;
  /** Yerel takvim günü yyyymmdd (`bugun()`). */
  bugun(): number;
  /** Reklam açılırken true, kapanınca false: ses kısılır, çizici durur. */
  reklamKipi(acik: boolean): void;
  /** Ekran adını ayarla (test kancası), öncekini döndür. */
  ekran?(ad: string): string;
  /** Kayıt satın almayla değişti (oyun içindeyse HUD stokları tazelensin). */
  degisti?(): void;
  /** Ölçüm yazıcısı (varsayılan `gelirOlayi`; testler kendi dizisine yazar). */
  olay?: GelirOlayYazici;
}

/** Can düşüşünün `can_bitti`'si ile kapınınki bu süre içindeyse aynı an sayılır (ms). */
const BITTI_AYNI_AN_MS = 5000;

/** Satın almanın sonucu (akış içi). */
export type SatinAlmaAkisSonucu = 'verildi' | 'tekrar' | 'verilemedi' | 'iptal' | 'beklemede' | 'hata' | 'satilmaz';

export class GelirAkisi {
  /** Mağazanın fiyatları; null: liste henüz gelmedi. */
  private fiyatlar: Map<UrunId, string> | null = null;
  private urunSozu: Promise<void> | null = null;
  private reklamAcik = false;
  private satinAlimda = false;
  /** Süren bekleyen alım işlemi (açılış ve ön plana dönüş aynı anda sormasın). */
  private bekleyenSozu: Promise<number> | null = null;
  /** `baslat` çağrıldı (kayıt hazır; ön plana dönüş ancak bundan sonra sorar). */
  private basladi = false;
  /**
   * Can düşüşünün yazdığı son `can_bitti` (bölüm, duvar saati): hemen ardından
   * gelen kapı (Duraklat > Yeniden başla son canla) aynı anı ikinci kez yazmasın.
   */
  private bittiYazilan: { bolum: number; an: number } | null = null;

  constructor(private o: GelirOrtami) {}

  get ad(): GelirSaglayici['ad'] {
    return this.o.saglayici.ad;
  }

  private olay: GelirOlayYazici = (ad, p) => {
    try {
      (this.o.olay ?? gelirOlayi)(ad, p);
    } catch {
      /* ölçüm oyunu durdurmaz */
    }
  };

  // ─────────────── Can ───────────────

  /** Okuma (kaydı değiştirmez). */
  durum(): meta.CanDurumu {
    return meta.canDurumu(this.o.kayit(), this.o.saat());
  }

  canSayaci(): CanSayaciVM {
    return canSayaciVM(this.o.kayit(), this.o.saat());
  }

  ustaKarti(): boolean {
    return this.o.kayit().gelir?.ustaKarti === true;
  }

  /** Bölüm can harcıyor mu (C3). */
  canGerekirMi(v: Pick<BolumVerisi, 'tur' | 'id'>): boolean {
    return meta.canGerekirMi(v);
  }

  /**
   * Tembel dolumu kayda yazar (`canTazele`); can arttıysa `can_doldu`
   * (zaman). Açılışta, harita hapında, panel açıkken ve her işlemden önce.
   */
  tazele(): meta.CanDurumu {
    const k = this.o.kayit();
    const once = kayittakiCan(k);
    const y = meta.canTazele(k, this.o.saat());
    if (y !== k) {
      this.o.degistir(y);
      if (kayittakiCan(y) > once) this.olay('can_doldu', { neden: 'zaman' });
    }
    return this.durum();
  }

  /**
   * 1 can düşer (kayıp anında ya da onaylı çıkışta; C4): kayıt hemen
   * yazılır, `can_harcandi`; can 0'a indiyse `can_bitti`. Düşen can yoksa
   * (zaten 0) null, varsa kalan can.
   */
  canHarca(v: Pick<BolumVerisi, 'id'>, neden: meta.CanHarcamaNedeni): number | null {
    const once = this.tazele().sayi;
    const k = this.o.kayit();
    const y = meta.canHarca(k, this.o.saat(), neden);
    if (y === k) return null;
    this.o.yaz(y);
    const kalan = this.durum().sayi;
    if (kalan >= once) return null;
    this.olay('can_harcandi', { neden, kalan, bolum: v.id });
    if (kalan <= 0) {
      this.olay('can_bitti', { bolum: v.id });
      this.bittiYazilan = { bolum: v.id, an: this.o.saat() };
    }
    return kalan;
  }

  /** Devamla (Usta'nın Eli ya da reklamla +5) kazanç: kayıpta giden can geri gelir (C4). */
  canIade(): void {
    const once = this.tazele().sayi;
    const k = this.o.kayit();
    const y = meta.canIade(k, this.o.saat());
    if (y === k) return;
    this.o.yaz(y);
    if (this.durum().sayi > once) this.olay('can_doldu', { neden: 'iade' });
  }

  /**
   * 0 canla bölüm başlatılmak istendi (kapı; §2 C5). Aynı bölümün son canı
   * az önce (`BITTI_AYNI_AN_MS` içinde) düştüyse `canHarca` `can_bitti`'yi
   * yazmıştır: aynı an yeniden yazılmaz.
   */
  canBitti(v: Pick<BolumVerisi, 'id'>): void {
    const b = this.bittiYazilan;
    this.bittiYazilan = null;
    const fark = b ? this.o.saat() - b.an : Infinity;
    if (b?.bolum === v.id && fark >= 0 && fark < BITTI_AYNI_AN_MS) return;
    this.olay('can_bitti', { bolum: v.id });
  }

  /** Test kancası (`__fitil.canAyarla`): can sayısını doğrudan yazar (tam nesne; G1 notu). */
  canAyarla(n: number): void {
    const sayi = Math.max(0, Math.min(meta.CAN_ENCOK, Math.round(n)));
    const k = meta.kayitKopyala(this.o.kayit());
    k.can = { ...meta.varsayilanCan(), ...k.can, sayi, dolumBasi: sayi < meta.CAN_ENCOK ? Math.floor(this.o.saat()) : null };
    this.o.yaz(k);
  }

  // ─────────────── Reklam ───────────────

  /** Reklam şu an gösterilebilir mi (sağlayıcı; düğme yalnız true iken). */
  reklamHazir(yer: ReklamYeri): boolean {
    return this.o.saglayici.reklamHazir(yer);
  }

  /** Reklam (ya da Usta kartı) düğmesi oyuncuya gösterildi. */
  reklamTeklif(yer: ReklamYeri): void {
    this.olay('reklam_teklif', { yer });
  }

  /**
   * Ödülü al: Usta kartı varsa reklamsız 'odul' (`reklam_sonuc` kart: true,
   * C9); yoksa reklamı gösterir (ses kısık, çizici durur). `yok`/`hata`
   * → "Şu an reklam yok" bildirimi (düğmeyi çağıran gizler).
   */
  async reklamOdulu(yer: ReklamYeri): Promise<ReklamSonucu> {
    if (this.ustaKarti()) {
      this.olay('reklam_sonuc', { yer, sonuc: 'odul', kart: true });
      return 'odul';
    }
    if (this.reklamAcik) return 'hata';
    this.reklamAcik = true;
    const onceki = this.o.ekran?.('reklam');
    this.o.reklamKipi(true);
    let sonuc: ReklamSonucu;
    try {
      sonuc = await this.o.saglayici.reklamGoster(yer);
    } catch {
      sonuc = 'hata';
    } finally {
      this.reklamAcik = false;
      this.o.reklamKipi(false);
      if (onceki !== undefined) this.o.ekran?.(onceki);
    }
    if (sonuc === 'yok' || sonuc === 'hata') this.o.bildir(G.reklamYok);
    return sonuc;
  }

  /** Can panelinin reklam satırı: ödül gelirse +1 can (günlük hak; C6, C9), kayıt hemen yazılır. */
  private async reklamCan(): Promise<ReklamSonucu> {
    const sonuc = await this.reklamOdulu('can');
    if (sonuc !== 'odul') return sonuc;
    const once = this.tazele().sayi;
    const k = this.o.kayit();
    const y = meta.reklamCanKullan(k, this.o.saat(), this.o.bugun());
    if (y !== k) {
      this.o.yaz(y);
      if (this.durum().sayi > once) this.olay('can_doldu', { neden: 'reklam' });
    }
    return sonuc;
  }

  // ─────────────── Can paneli ───────────────

  private canVM(gizli: boolean): CanVM {
    const kart = this.ustaKarti();
    return canPaneliVM(this.o.kayit(), this.o.saat(), this.o.bugun(), {
      kart,
      hazir: !gizli && this.reklamHazir('can'),
      fiyat: this.fiyatlar?.get('can_doldur') ?? null,
    });
  }

  /**
   * Can paneli / Can bitti (§3, §6): seçimde kapanır, işlenip yeniden açılır;
   * 'kapat' (Bekle, Esc, programlı kapanış) ile biter. `kapi` (0 canla bölüm
   * başlatma): reklam ya da satın alma can verince panel kapanır ('can': bölüm
   * başlar). Dönüş 'kapat': oyuncu Bekle dedi (panel açıkken zamanla can
   * dolmuş olsa da kapı haritaya döner, §13 G4 "Bekle → harita").
   */
  async canPaneliAkisi(o: { kapi?: boolean } = {}): Promise<'kapat' | 'can'> {
    const onceki = this.o.ekran?.('canPaneli');
    if (!this.fiyatlar?.size) void this.urunleriYukle();
    // `yok`/`hata`dan sonra reklam satırı bu panel boyunca gizli (§3).
    let gizli = false;
    // `reklam_teklif` aynı teklif için bir kez: iptal ya da vazgeçilen satın almadan sonra
    // yerinde yeniden açılan panel yeniden saymaz; ödül alınınca sıradaki reklam yeni tekliftir.
    let teklifYazildi = false;
    try {
      for (;;) {
        this.o.ekran?.('canPaneli');
        this.tazele();
        const vm = this.canVM(gizli);
        if (!teklifYazildi && vm.reklam && vm.reklam.hak > 0 && vm.reklam.hazir) {
          teklifYazildi = true;
          this.reklamTeklif('can');
        }
        const s = await this.o.ui.canPaneli(vm, () => {
          this.tazele();
          return this.canVM(gizli);
        });
        if (s === 'kapat') return 'kapat';
        const once = this.durum().sayi;
        if (s === 'reklam') {
          const r = await this.reklamCan();
          if (r === 'yok' || r === 'hata') gizli = true;
          if (r === 'odul') teklifYazildi = false;
        } else if (s === 'doldur') await this.satinAl('can_doldur');
        // Kapı: bölüm 0 canla açılmak istendi; reklam/satın alma can verdiyse bölüm başlasın.
        if (o.kapi && this.durum().sayi > once) return 'can';
      }
    } finally {
      if (onceki !== undefined) this.o.ekran?.(onceki);
    }
  }

  // ─────────────── Mağaza ───────────────

  /** Ürün listesi ve fiyatlar (bir kez; boş geldiyse sonraki Mağaza açılışında yeniden). */
  urunleriYukle(): Promise<void> {
    if (!this.urunSozu) {
      this.urunSozu = (async () => {
        try {
          const liste = await this.o.saglayici.urunler();
          this.fiyatlar = new Map(liste.map((u) => [u.id, u.fiyat] as const));
        } catch {
          this.fiyatlar = new Map();
        } finally {
          this.urunSozu = null;
        }
      })();
    }
    return this.urunSozu;
  }

  magazaModeli(): MagazaVM {
    return magazaVM(this.o.kayit(), this.o.saat(), this.fiyatlar);
  }

  /** Ayarlar > Mağaza (§4): satın alma ve geri yükleme; seçimde kapanır, işlenip yeniden açılır. */
  async magazaAkisi(): Promise<void> {
    const onceki = this.o.ekran?.('magaza');
    if (!this.fiyatlar?.size) void this.urunleriYukle();
    try {
      for (;;) {
        this.o.ekran?.('magaza');
        this.tazele();
        const s = await this.o.ui.magaza(this.magazaModeli(), () => this.magazaModeli());
        if (s.tur === 'kapat') return;
        if (s.tur === 'satinAl') await this.satinAl(s.id);
        else await this.geriYukle();
      }
    } finally {
      if (onceki !== undefined) this.o.ekran?.(onceki);
    }
  }

  /**
   * Satın alma (§4): yalnız 'satilik' ürün (paket stok sınırını aşacaksa,
   * can doluyken, Usta kartı sendeyken satılmaz). Başarılıysa ödül önce
   * kayda (hemen), sonra `tamamla(jeton)`.
   */
  async satinAl(id: UrunId): Promise<SatinAlmaAkisSonucu> {
    if (this.satinAlimda) return 'satilmaz';
    this.tazele();
    const u = this.magazaModeli().urunler.find((x) => x.id === id);
    if (!u || u.durum !== 'satilik') {
      if (u?.durum === 'stokDolu') this.o.bildir(id === 'can_doldur' ? MC.canlarDolu : MC.stokDolu);
      return 'satilmaz';
    }
    this.satinAlimda = true;
    const onceki = this.o.ekran?.('satinAlma');
    try {
      const r = await this.o.saglayici.satinAl(id);
      if (r.durum !== 'basarili') {
        if (r.durum === 'hata') this.o.bildir(G.satinHata);
        else if (r.durum === 'beklemede') this.o.bildir(G.beklemede);
        return r.durum;
      }
      const s = await this.isle(r.urun, r.jeton);
      if (s === 'verildi') this.o.bildir(G.satinAlindi);
      else if (s === 'verilemedi') this.o.bildir(r.urun === 'guclendirici_paketi' ? MC.stokDolu : G.satinHata);
      return s;
    } finally {
      this.satinAlimda = false;
      if (onceki !== undefined) this.o.ekran?.(onceki);
    }
  }

  /**
   * Başarılı satın almanın ödülü (§4, §13 karar 6): verildi → kayıt hemen,
   * SONRA `tamamla` (kayıt kalıcı yazılamadıysa `tamamla` yok: ödül bu
   * oturumda bellekte, satın alma bekleyenlerde kalır); tekrar (jeton
   * işlenmiş) → ödül yok, yine `tamamla`;
   * verilemedi (paket sığmıyor, geçersiz jeton) → `tamamla` yok, satın
   * alma `bekleyenler()`'de kalır.
   */
  private async isle(urun: UrunId, jeton: string): Promise<'verildi' | 'tekrar' | 'verilemedi'> {
    const once = this.tazele().sayi;
    const k = this.o.kayit();
    const r = meta.satinAlmaUygula(k, urun, jeton, this.o.saat());
    // Ödül kalıcı yazılamadıysa (salt okunur ya da dolu depo) `tamamla` yok: satın alma
    // sağlayıcıda bekler, sonraki açılışta `bekleyenler()` ile yeniden işlenir (ödeme boşa gitmez).
    let kalici = true;
    if (r.verildi) {
      kalici = this.o.yaz(r.kayit);
      if (urun === 'can_doldur' && this.durum().sayi > once) this.olay('can_doldu', { neden: 'satin' });
      this.o.degisti?.();
    }
    if (kalici && (r.verildi || r.tekrar)) {
      try {
        await this.o.saglayici.tamamla(jeton);
      } catch {
        /* tamamlanamayan satın alma sonraki açılışta bekleyenlerden yeniden gelir (jeton korur) */
      }
    }
    return r.verildi ? 'verildi' : r.tekrar ? 'tekrar' : 'verilemedi';
  }

  /**
   * Açılışta ve ön plana dönüşte: tamamlanmamış satın almalar yeniden
   * işlenir (§4). Ödül verildiyse kısa bildirim. Sürerken yeniden çağrılırsa
   * aynı işlemi döndürür (jeton zaten çifte vermeyi önler; çift `tamamla` olmasın).
   */
  bekleyenleriIsle(): Promise<number> {
    if (!this.bekleyenSozu) {
      this.bekleyenSozu = this.bekleyenleriSor().finally(() => {
        this.bekleyenSozu = null;
      });
    }
    return this.bekleyenSozu;
  }

  /**
   * (Android) Uygulama ön plana döndü: bekleyen alımlar yeniden sorulur.
   * Gecikmeli ödeme uygulama arkadayken tamamlanabilir; köprü her çağrıdan
   * sonra Play bağlantısını kapattığı için alım güncellemesini dinleyen yok
   * (Google `onResume`'da sormayı önerir; onaylanmayan alım 3 günde iade
   * edilir). Satın alma akışı sürerken sorulmaz (ödeme ekranı kapanınca da
   * dönüş olayı gelir; o alımı akış kendisi işler).
   */
  onPlanaDondu(): void {
    if (!this.basladi || this.satinAlimda) return;
    void this.bekleyenleriIsle();
  }

  private async bekleyenleriSor(): Promise<number> {
    let verilen = 0;
    let liste: { urun: UrunId; jeton: string }[] = [];
    try {
      liste = await this.o.saglayici.bekleyenler();
    } catch {
      return 0;
    }
    for (const b of liste) if ((await this.isle(b.urun, b.jeton)) === 'verildi') verilen++;
    if (verilen) this.o.bildir(G.satinAlindi);
    return verilen;
  }

  /**
   * "Satın alımları geri yükle" (§4): kalıcı ürünler (Usta kartı). Kayıt
   * değiştiyse true. Mağazaya ulaşılamadıysa (sağlayıcı reddetti) "yapılamadı"
   * der: "geri yüklenecek yok" deyip oyuncuyu yeniden satın almaya itmesin.
   */
  async geriYukle(): Promise<boolean> {
    let liste: UrunId[];
    try {
      liste = await this.o.saglayici.geriYukle();
    } catch {
      this.o.bildir(G.geriYukleHata);
      return false;
    }
    const k = this.o.kayit();
    const y = meta.geriYuklemeUygula(k, liste);
    if (y !== k) {
      this.o.yaz(y);
      this.o.degisti?.();
    }
    // Mağaza kalıcı ürün bildirdiyse (zaten sende olsa da) geri yükleme yapılmıştır.
    this.o.bildir(liste.length ? G.geriYuklendi : G.geriYukleBos);
    return y !== k;
  }

  // ─────────────── Açılış ───────────────

  /** Açılış: tembel dolum kayda, fiyatlar ve tamamlanmamış satın almalar arka planda. */
  baslat(): void {
    this.basladi = true;
    this.tazele();
    void this.urunleriYukle();
    void this.bekleyenleriIsle();
  }

  /** Test kancası durumu (`__fitil.gelir()`). */
  ozet(): { saglayici: GelirSaglayici['ad']; can: meta.CanDurumu; reklamHakki: number; ustaKarti: boolean; stok: Record<string, number> } {
    const k = this.o.kayit();
    return {
      saglayici: this.ad,
      can: this.durum(),
      reklamHakki: meta.reklamCanHakki(k, this.o.bugun()),
      ustaKarti: this.ustaKarti(),
      stok: { ...k.guclendiriciler },
    };
  }
}

/** Metin tablosu (İngilizce testi). */
export { G as GELIR_METNI };
