/**
 * Kayıt yöneticisi (GDD §13.7): SaveStore (bulut `db` + `user` → tarayıcı
 * → bellek) üstünde tek `Kayit`. Okuma her zaman `kayitGoc` ile temizlenir.
 * Değişiklikler 500 ms gecikmeli yazılır; bölüm sonunda hemen.
 */
import { SaveStore } from '../platform/storage';
import { ilerlemePuani, KAYIT_ANAHTARI, KAYIT_SURUMU, kayitGoc, type Kayit } from '../meta/index';

export class Kayitci {
  private store = new SaveStore<Kayit>({ key: KAYIT_ANAHTARI, version: KAYIT_SURUMU, progressScore: ilerlemePuani });
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;
  kayit: Kayit;

  constructor() {
    const env = this.store.loadLocal();
    this.kayit = kayitGoc(env?.data ?? null);
  }

  /** 'bulut' | 'tarayici' | 'bellek'. */
  get arka(): string {
    return this.store.backend;
  }

  /** Bulut kaydı daha ilerideyse onu döndürür (uygulama uygun anda uygular). */
  async bulutaBaglan(): Promise<Kayit | null> {
    const env = await this.store.connectRemote();
    return env ? kayitGoc(env.data) : null;
  }

  guncelle(f: (k: Kayit) => Kayit, hemen = false): void {
    this.kayit = f(this.kayit);
    if (hemen) this.yaz();
    else this.gecikmeli();
  }

  degistir(k: Kayit, hemen = true): void {
    this.kayit = kayitGoc(k);
    if (hemen) this.yaz();
    else this.gecikmeli();
  }

  private gecikmeli(): void {
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = setTimeout(() => this.yaz(), 500);
  }

  yaz(): void {
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    try {
      this.store.save(this.kayit);
    } catch {
      /* depolama yok: bellek kaydı */
    }
  }
}
