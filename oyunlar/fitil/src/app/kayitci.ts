/**
 * Kayıt yöneticisi (GDD §16.7): meta kayıt şeması + `SaveStore`.
 *
 *  - Açılış: ana kayıt, sonra yedekler (`…v1.yedek1`, `…v1.yedek2`) sırayla
 *    denenir (`kayitYukle`: göç + onarım). Hiçbiri yoksa yeni kayıt; ilk
 *    açılış tohumu `rastgeleTohum()`dan.
 *  - Yazma: bölüm sonunda ve ayar değişince ~500 ms gecikmeli, birleştirilmiş.
 *    Her başarılı yazımdan önce önceki ana kayıt yedek1'e, yedek1 yedek2'ye
 *    kayar (son 2 başarılı yazım). Sekme gizlenince bekleyen yazım hemen.
 *  - Bulut (`connectRemote`): claude.ai sayfasında oturum açıksa kişiye özel
 *    belge. Bağlantı açılışta (dokunuştan önce) başlar; bulut daha ilerideyse
 *    (`progressScore`) aday kayıt döner, uygulama onu oturum dışındayken
 *    `bulutUygula` ile yerine koyar (yerele de yazılır).
 *  - Depolama yoksa (gizli pencere) bellek kaydı; uyarıyı uygulama haritada,
 *    öğretim bittikten sonra bir kez gösterir (`bellekte`).
 *
 * Bütün localStorage erişimleri try/catch içinde (WhatsApp içi tarayıcı).
 */
import { SaveStore, kanonikJson } from '../platform/storage';
import { KAYIT_ANAHTARI, KAYIT_YEDEK_ANAHTARLARI, kancaBirlestir, kayitCoz, kayitDeposuAyarlari, kayitYukle, type Kayit } from '../meta';

const ilerlemePuani = kayitDeposuAyarlari().progressScore;
import { rastgeleTohum } from './zaman';

function okuHam(anahtar: string): string | null {
  try {
    return localStorage.getItem(anahtar);
  } catch {
    return null;
  }
}

function yazHam(anahtar: string, deger: string): boolean {
  try {
    localStorage.setItem(anahtar, deger);
    return true;
  } catch {
    return false;
  }
}

/** Yedek anahtarındaki zarfın verisi (SaveStore zarfı ya da düz kayıt). */
function yedekVerisi(anahtar: string): unknown {
  const ham = okuHam(anahtar);
  if (!ham) return null;
  try {
    const o = JSON.parse(ham) as { data?: unknown };
    return o && typeof o === 'object' && 'data' in o ? o.data : o;
  } catch {
    return null;
  }
}

export class Kayitci {
  readonly depo: SaveStore<Kayit>;
  kayit: Kayit;
  /**
   * Göçle gelen ana kayıt (eski sürümün sekmesi yazdı) yedeklerdeki şema 3
   * mühürleri/işleriyle tamamlandı (açılışta; KANCALAR §D.6).
   */
  readonly yedektenTamamlandi: boolean;
  /** İlk açılış mı (hiç kayıt bulunamadı). */
  readonly ilkAcilis: boolean;
  /** Kayıt hangi adaydan geldi (0 ana, 1–2 yedek, −1 yeni). */
  readonly kaynak: number;
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private bekliyor = false;
  /** Son yazım kalıcı mıydı (salt okunur ya da dolu depoda false). */
  private sonYazimKalici = true;
  private bulutSozu: Promise<Kayit | null> | null = null;
  /** Bulut bağlantısı başladığında yerel kayıt (sonra değiştiyse bulut körü körüne ezmesin). */
  private bulutOncesi: Kayit | null = null;

  constructor() {
    this.depo = new SaveStore<Kayit>(kayitDeposuAyarlari());
    const ana = this.depo.loadLocal()?.data ?? null;
    const r = kayitYukle([ana, yedekVerisi(KAYIT_YEDEK_ANAHTARLARI[0]), yedekVerisi(KAYIT_YEDEK_ANAHTARLARI[1])], rastgeleTohum());
    this.kayit = r.kayit;
    this.kaynak = r.kaynak;
    this.ilkAcilis = r.kaynak === -1;
    // Ana kayıt yeni bir şemadan (yeni sürümün sekmesi yazdı): bu sayfa salt okunur.
    if (r.gelecekSurum) this.depo.setReadOnly();
    // Ana kayıt eski şemadan geldiyse ama yedeklerde bu şemanın kaydı varsa, eski sürümün
    // açık kalmış sekmesi şema 3 alanlarını bilmeden yazmıştır: yedeklerin mühürleri ve
    // kasaba işleri geri eklenir (kancaBirlestir: yalnız eklenir, kurallar/bütçe ile).
    let tamam = false;
    if (r.kaynak === 0 && r.gocler.length > 0 && !r.gelecekSurum) {
      for (const a of KAYIT_YEDEK_ANAHTARLARI) {
        const y = kayitCoz(yedekVerisi(a), this.kayit.kayitTohumu);
        if (y.yeni || y.gocler.length > 0 || y.gelecekSurum) continue;
        const b = kancaBirlestir(this.kayit, y.kayit);
        if (JSON.stringify(b) !== JSON.stringify(this.kayit)) {
          this.kayit = b;
          tamam = true;
        }
      }
    }
    this.yedektenTamamlandi = tamam;
    if (tamam) this.planla(0);
    const kapat = () => this.hemenYaz();
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') kapat();
      });
      window.addEventListener('pagehide', kapat);
    } catch {
      /* yok */
    }
  }

  /** Kaydı değiştir ve gecikmeli yaz (varsayılan 500 ms). */
  degistir(k: Kayit, gecikme = 500): void {
    this.kayit = k;
    this.planla(gecikme);
  }

  planla(gecikme = 500): void {
    this.bekliyor = true;
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = setTimeout(() => this.yaz(), gecikme);
  }

  /**
   * Bekleyen yazımı hemen yapar. Dönüş: kayıt kalıcı yazıldı mı (bekleyen
   * yazım yoksa son yazımın sonucu). false: salt okunur depo ya da
   * localStorage yazılamadı; kayıt yalnız bellekte (satın alma bunu bilmeli).
   */
  hemenYaz(): boolean {
    if (!this.bekliyor) return this.sonYazimKalici;
    return this.yaz();
  }

  private yaz(): boolean {
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    this.bekliyor = false;
    this.sonYazimKalici = false;
    // Yeni sürümün kaydı görüldüyse yazılmaz (yedekler de kaymaz).
    if (!this.depo.writable()) return false;
    // Yedek döndürme: önceki ana kayıt → yedek1 → yedek2 (§16.7).
    const onceki = okuHam(KAYIT_ANAHTARI);
    if (onceki) {
      const y1 = okuHam(KAYIT_YEDEK_ANAHTARLARI[0]);
      if (y1) yazHam(KAYIT_YEDEK_ANAHTARLARI[1], y1);
      yazHam(KAYIT_YEDEK_ANAHTARLARI[0], onceki);
    }
    try {
      this.sonYazimKalici = this.depo.save(this.kayit);
    } catch {
      /* SaveStore kendi içinde yutar; yine de oyun durmasın */
    }
    return this.sonYazimKalici;
  }

  /** Kayıt yalnız bellekte mi (gizli pencere, engelli depolama): sayfa kapanınca kaybolur. */
  get bellekte(): boolean {
    return this.depo.backend === 'bellek';
  }

  /** Yeni sürümün kaydı görüldü: bu sayfa kaydetmiyor (sayfayı yenilemek gerekir). */
  get saltOkunur(): boolean {
    return this.depo.readOnly;
  }

  /**
   * Bulut kaydına bağlan (10 sn'ye kadar sürebilir; bir kez başlar, söz
   * paylaşılır). Bulut daha ilerideyse onun kaydı döner (henüz UYGULANMAZ);
   * değilse null.
   */
  bulutaBaglan(): Promise<Kayit | null> {
    if (!this.bulutSozu) {
      this.bulutOncesi = this.kayit;
      this.bulutSozu = (async () => {
        try {
          const zarf = await this.depo.connectRemote();
          if (!zarf) return null;
          const r = kayitYukle([zarf.data], this.kayit.kayitTohumu);
          if (r.gelecekSurum) {
            this.depo.setReadOnly();
            return null;
          }
          return r.kaynak === 0 ? r.kayit : null;
        } catch {
          return null;
        }
      })();
    }
    return this.bulutSozu;
  }

  /**
   * Bulut adayını uygula (oturum dışında çağrılır). Yerel kayıt bağlantıdan
   * sonra değiştiyse ve en az bulut kadar ilerideyse yerel kalır. Uygulanırsa
   * yerele de hemen yazılır (çevrimdışı sonraki açılış aynı kaydı görür).
   */
  bulutUygula(k: Kayit): boolean {
    if (this.depo.readOnly) return false;
    if (this.kayit !== this.bulutOncesi && ilerlemePuani(this.kayit) >= ilerlemePuani(k)) {
      // Yerel kalır; buluttaki mühür ve kasaba işleri kaybolmasın (KANCALAR §D.3).
      const b = kancaBirlestir(this.kayit, k);
      if (kanonikJson(b) !== kanonikJson(this.kayit)) this.degistir(b, 0);
      return false;
    }
    // Bulut seçilse de yereldeki mühürler ve işler eklenir (ör. açılışta yedekten
    // tamamlanan kayıt; depo birleşimi yalnız diskteki ham kaydı görür).
    this.kayit = kancaBirlestir(k, this.kayit);
    this.planla(0);
    return true;
  }
}
