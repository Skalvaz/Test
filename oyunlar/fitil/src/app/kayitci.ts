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
 *    belge. Bulut daha ilerideyse (`progressScore`) yüklenir.
 *  - Depolama yoksa (gizli pencere) bellek kaydı + tek seferlik uyarı.
 *
 * Bütün localStorage erişimleri try/catch içinde (WhatsApp içi tarayıcı).
 */
import { SaveStore } from '../platform/storage';
import { KAYIT_ANAHTARI, KAYIT_YEDEK_ANAHTARLARI, kayitDeposuAyarlari, kayitYukle, type Kayit } from '../meta';
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
  /** İlk açılış mı (hiç kayıt bulunamadı). */
  readonly ilkAcilis: boolean;
  /** Kayıt hangi adaydan geldi (0 ana, 1–2 yedek, −1 yeni). */
  readonly kaynak: number;
  /** Bellek kaydı uyarısı (tek seferlik). */
  uyari: ((metin: string) => void) | null = null;
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private bekliyor = false;
  private bellekUyarildi = false;

  constructor() {
    this.depo = new SaveStore<Kayit>(kayitDeposuAyarlari());
    const ana = this.depo.loadLocal()?.data ?? null;
    const r = kayitYukle([ana, yedekVerisi(KAYIT_YEDEK_ANAHTARLARI[0]), yedekVerisi(KAYIT_YEDEK_ANAHTARLARI[1])], rastgeleTohum());
    this.kayit = r.kayit;
    this.kaynak = r.kaynak;
    this.ilkAcilis = r.kaynak === -1;
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

  hemenYaz(): void {
    if (!this.bekliyor) return;
    this.yaz();
  }

  private yaz(): void {
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    this.bekliyor = false;
    // Yedek döndürme: önceki ana kayıt → yedek1 → yedek2 (§16.7).
    const onceki = okuHam(KAYIT_ANAHTARI);
    if (onceki) {
      const y1 = okuHam(KAYIT_YEDEK_ANAHTARLARI[0]);
      if (y1) yazHam(KAYIT_YEDEK_ANAHTARLARI[1], y1);
      yazHam(KAYIT_YEDEK_ANAHTARLARI[0], onceki);
    }
    try {
      this.depo.save(this.kayit);
    } catch {
      /* SaveStore kendi içinde yutar; yine de oyun durmasın */
    }
    if (this.depo.backend === 'bellek' && !this.bellekUyarildi) {
      this.bellekUyarildi = true;
      this.uyari?.('Bu tarayıcı kaydı saklamıyor. İlerlemeni Ayarlar > Kayıt kodu ile yedekleyebilirsin.');
    }
  }

  /**
   * Bulut kaydına bağlan (10 sn'ye kadar sürebilir). Bulut daha ilerideyse
   * yerel kaydın yerine geçer ve yeni kayıt döner; değilse null.
   */
  async bulutaBaglan(): Promise<Kayit | null> {
    try {
      const zarf = await this.depo.connectRemote();
      if (!zarf) return null;
      const r = kayitYukle([zarf.data], this.kayit.kayitTohumu);
      if (r.kaynak !== 0) return null;
      this.kayit = r.kayit;
      return r.kayit;
    } catch {
      return null;
    }
  }
}
