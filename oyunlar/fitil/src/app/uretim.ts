/**
 * Günün Şenliği ve Sonsuz Şenlik bölüm üretimi (GDD §10.5, §10.7).
 *
 * Üretici (levels/uretici) belirlenimli ama pahalıdır: her aday için hafif
 * Usta botuyla 12 koşu (masaüstünde 1–20 sn, telefonda birkaç katı).
 *
 *  - Öncelikli yol: Web Worker (§10.5). Üretim ayrı iş parçacığında, ana
 *    iş parçacığının karelerine dokunmadan, tam hızla sürer. Tek dosya
 *    derlemesinde işçi Blob URL ile satır içi gelir.
 *  - Yedek yol (işçi kurulamazsa: CSP, eski tarayıcı): üretici fonksiyon ana
 *    iş parçacığında ZAMAN DİLİMLİ sürülür. Her karede en fazla `butce` ms;
 *    bir sonraki adımın tahmini süresi bütçeyi aşacaksa o karede durur (kare
 *    taşmasın). Oyuncu bekliyorsa (bekleme kartı) bütçe büyür; oyun ekranında
 *    arka plan üretimi durur.
 *
 * Sonuçlar bellekte ve tarayıcı deposunda (anahtar başına küçük bir JSON)
 * önbelleklenir: aynı gün ikinci açılışta tahta anında hazırdır. Günlükler
 * ve sonsuzlar ayrı sınırla saklanır (biri ötekini silmesin).
 */
import { gunlukUret, sonsuzUret, uretilenBolumAdi, type UretimIlerleme } from '../levels/uretici';
import type { BolumVerisi } from '../core/types';
import { SONSUZ_TABANI } from '../meta';
import { simdi } from './zaman';
import type { IsciIstegi, IsciYaniti } from './uretimIsci';
import UretimIscisi from './uretimIsci?worker&inline';

const ONEK = 'fitil.uretim.';
/** Depoda tutulan en fazla günlük (bugün + 6 günlük arşiv + yarın) ve sonsuz üretim. */
const EN_FAZLA_GUNLUK = 8;
const EN_FAZLA_SONSUZ = 4;
const SURUM = 1;

interface Is {
  id: number;
  /** Yedek yolda üretici; işçide çalışan işte null. */
  g: Generator<UretimIlerleme, BolumVerisi, void> | null;
  yap: () => Generator<UretimIlerleme, BolumVerisi, void>;
  kip: 'gunluk' | 'sonsuz';
  n: number;
  oncelik: number;
  eylem: number;
  sozler: { coz: (v: BolumVerisi) => void; red: (e: unknown) => void }[];
  ilerleme: ((o: number) => void)[];
}

/**
 * Üretilen bölümün adı sayfanın dilinde: işçi (Web Worker) sayfa dilini
 * bilmez ve önbellekteki bölüm başka dilde üretilmiş olabilir.
 */
function adla(v: BolumVerisi): BolumVerisi {
  return v.tur === 'gunluk' || v.tur === 'sonsuz' ? { ...v, ad: uretilenBolumAdi(v.tur, v.id) } : v;
}

function depoOku(id: number): BolumVerisi | null {
  try {
    const ham = localStorage.getItem(ONEK + id);
    if (!ham) return null;
    const o = JSON.parse(ham) as { s: number; v: BolumVerisi };
    return o && o.s === SURUM && o.v && o.v.id === id ? o.v : null;
  } catch {
    return null;
  }
}

/** Saklanan üretim kimliklerinden silinecekler: günlük ve sonsuz ayrı gruplarda, en eskiler (küçükler). */
export function silinecekUretimler(idler: readonly number[]): number[] {
  const gunluk = idler.filter((i) => i >= 19000101).sort((a, b) => a - b);
  const sonsuz = idler.filter((i) => i >= SONSUZ_TABANI && i < 19000101).sort((a, b) => a - b);
  return [...gunluk.slice(0, Math.max(0, gunluk.length - EN_FAZLA_GUNLUK)), ...sonsuz.slice(0, Math.max(0, sonsuz.length - EN_FAZLA_SONSUZ))];
}

function depoYaz(id: number, v: BolumVerisi): void {
  try {
    localStorage.setItem(ONEK + id, JSON.stringify({ s: SURUM, v }));
    const idler: number[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ONEK)) {
        const n = Number(k.slice(ONEK.length));
        if (Number.isFinite(n)) idler.push(n);
      }
    }
    for (const s of silinecekUretimler(idler)) localStorage.removeItem(ONEK + s);
  } catch {
    /* depo yok: yalnız bellek */
  }
}

/** Bekleme kartındaki tahmini ilerleme (monoton, 1'e yaklaşır). */
function oran(eylem: number): number {
  return 1 - Math.exp(-eylem / 1400);
}

export class BolumUretici {
  private bellek = new Map<number, BolumVerisi>();
  private isler: Is[] = [];
  private calisiyor = false;
  /** undefined: henüz denenmedi; null: kurulamadı (yedek yol). */
  private isci: Worker | null | undefined = undefined;
  /** Yedek yol: oyuncu bekliyorken kare başına bütçe (ms). */
  butceOn = 34;
  /** Yedek yol: arka planda kare başına bütçe (ms). */
  butceArka = 6;
  /** Yedek yol: oyun ekranında arka plan üretimi durur (kare süresi bozulmasın). */
  duraklat = false;
  /** Yedek yol: bir üretim adımının (bot eylemi) süre tahmini (ms, yavaş sönen tepe). */
  private adimTahmini = 4;

  hazir(id: number): BolumVerisi | null {
    const b = this.bellek.get(id);
    if (b) return b;
    const d = depoOku(id);
    if (!d) return null;
    const v = adla(d);
    this.bellek.set(id, v);
    return v;
  }

  /** Üretim işçide mi çalışıyor (arka plan üretimi ana iş parçacığına yük değil). */
  get isciVar(): boolean {
    return !!this.isciAl();
  }

  /** Test/inceleme: işçi durumu (kurmaya çalışmaz) ve bekleyen işler. */
  durum(): { isci: 'denenmedi' | 'var' | 'yok'; isler: { id: number; eylem: number; yerel: boolean }[] } {
    return { isci: this.isci === undefined ? 'denenmedi' : this.isci ? 'var' : 'yok', isler: this.isler.map((x) => ({ id: x.id, eylem: x.eylem, yerel: !!x.g })) };
  }

  gunluk(tarih: number, s: { oncelik?: number; ilerleme?: (o: number) => void } = {}): Promise<BolumVerisi> {
    return this.iste(tarih, 'gunluk', tarih, () => gunlukUret(tarih), s);
  }

  sonsuz(n: number, s: { oncelik?: number; ilerleme?: (o: number) => void } = {}): Promise<BolumVerisi> {
    return this.iste(SONSUZ_TABANI + n, 'sonsuz', n, () => sonsuzUret(n), s);
  }

  private isciAl(): Worker | null {
    if (this.isci !== undefined) return this.isci;
    try {
      if (typeof Worker === 'undefined') throw new Error('Worker yok');
      const w = new UretimIscisi();
      w.onmessage = (e: MessageEvent<IsciYaniti>) => this.isciYaniti(e.data);
      w.onerror = (e) => {
        e.preventDefault?.();
        this.isciCoktu();
      };
      this.isci = w;
    } catch {
      this.isci = null;
    }
    return this.isci;
  }

  private isciGonder(m: IsciIstegi): void {
    try {
      this.isci?.postMessage(m);
    } catch {
      this.isciCoktu();
    }
  }

  /** İşçi yüklenemedi ya da çöktü: bekleyen işler ana iş parçacığında baştan sürer. */
  private isciCoktu(): void {
    try {
      this.isci?.terminate();
    } catch {
      /* zaten yok */
    }
    this.isci = null;
    for (const is of this.isler) if (!is.g) is.g = is.yap();
    this.baslat();
  }

  private isciYaniti(m: IsciYaniti): void {
    const is = this.isler.find((x) => x.id === m.id);
    if (!is) return;
    if (m.tur === 'ilerleme') {
      is.eylem = m.eylem;
      const o = oran(is.eylem);
      for (const f of is.ilerleme) f(o);
    } else if (m.tur === 'bitti') this.bitir(is, m.v);
    else {
      this.isler = this.isler.filter((x) => x !== is);
      for (const s of is.sozler) s.red(new Error(m.mesaj));
    }
  }

  private iste(id: number, kip: 'gunluk' | 'sonsuz', n: number, yap: () => Generator<UretimIlerleme, BolumVerisi, void>, s: { oncelik?: number; ilerleme?: (o: number) => void }): Promise<BolumVerisi> {
    const h = this.hazir(id);
    if (h) {
      s.ilerleme?.(1);
      return Promise.resolve(h);
    }
    let is = this.isler.find((x) => x.id === id);
    const isci = this.isciAl();
    if (!is) {
      is = { id, g: isci ? null : yap(), yap, kip, n, oncelik: 0, eylem: 0, sozler: [], ilerleme: [] };
      this.isler.push(is);
    }
    const eskiOncelik = is.oncelik;
    is.oncelik = Math.max(is.oncelik, s.oncelik ?? 0);
    if (s.ilerleme) {
      is.ilerleme.push(s.ilerleme);
      s.ilerleme(oran(is.eylem));
    }
    const p = new Promise<BolumVerisi>((coz, red) => is!.sozler.push({ coz, red }));
    if (!is.g && isci) {
      if (is.sozler.length === 1) this.isciGonder({ tur: 'uret', id, kip, n, oncelik: is.oncelik });
      else if (is.oncelik !== eskiOncelik) this.isciGonder({ tur: 'oncelik', id, oncelik: is.oncelik });
    } else this.baslat();
    return p;
  }

  /** Bekleyen işin ilerleme dinleyicilerini bırak (bekleme kartı kapandı); iş arka planda sürer. */
  dinleyicileriBirak(id: number): void {
    const is = this.isler.find((x) => x.id === id);
    if (!is) return;
    is.ilerleme = [];
    is.oncelik = 0;
    if (!is.g && this.isci) this.isciGonder({ tur: 'oncelik', id, oncelik: 0 });
  }

  /** Yedek yol: ana iş parçacığında zaman dilimli sürüş. */
  private baslat(): void {
    if (this.calisiyor) return;
    this.calisiyor = true;
    const adim = () => {
      const yerel = this.isler.filter((x) => x.g);
      if (yerel.length === 0) {
        this.calisiyor = false;
        return;
      }
      // En yüksek öncelikli iş (eşitlikte ilk gelen).
      let is = yerel[0];
      for (const x of yerel) if (x.oncelik > is.oncelik) is = x;
      if (this.duraklat && is.oncelik <= 0) {
        setTimeout(adim, 250);
        return;
      }
      const butce = is.oncelik > 0 ? this.butceOn : this.butceArka;
      const bas = simdi();
      try {
        for (;;) {
          const a = simdi();
          const r = is.g!.next();
          const sure = simdi() - a;
          // Tepe izleyen tahmin: uzun adım hemen yansır, yavaş söner.
          this.adimTahmini = Math.max(sure, this.adimTahmini * 0.9 + sure * 0.1);
          if (r.done) {
            this.bitir(is, r.value);
            break;
          }
          is.eylem = r.value.eylem;
          // Sıradaki adım bütçeyi aşacaksa bu karede dur (kare taşmasın).
          if (simdi() - bas + this.adimTahmini >= butce) break;
        }
        const o = oran(is.eylem);
        for (const f of is.ilerleme) f(o);
      } catch (e) {
        this.isler = this.isler.filter((x) => x !== is);
        for (const s of is.sozler) s.red(e);
      }
      requestAnimationFrame(adim);
    };
    requestAnimationFrame(adim);
  }

  private bitir(is: Is, uretilen: BolumVerisi): void {
    const v = adla(uretilen);
    this.isler = this.isler.filter((x) => x !== is);
    this.bellek.set(is.id, v);
    depoYaz(is.id, v);
    for (const f of is.ilerleme) f(1);
    for (const s of is.sozler) s.coz(v);
  }
}
