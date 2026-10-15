/**
 * Günün Şenliği ve Sonsuz Şenlik bölüm üretimi (GDD §10.5, §10.7).
 *
 * Üretici (levels/uretici) belirlenimli ama pahalıdır: her aday için hafif
 * Usta botuyla 12 koşu (masaüstünde 1–11 sn, telefonda birkaç katı). Ana iş
 * parçacığını kilitlememek için üretici fonksiyon ZAMAN DİLİMLİ sürülür:
 * her karede en fazla `butce` ms çalışır, sonra sırayı bırakır. Oyuncu
 * bekliyorsa (bekleme kartı açık) bütçe büyür, arka planda küçüktür.
 *
 * Sonuçlar bellekte ve tarayıcı deposunda (anahtar başına küçük bir JSON)
 * önbelleklenir: aynı gün ikinci açılışta tahta anında hazırdır.
 */
import { gunlukUret, sonsuzUret, type UretimIlerleme } from '../levels/uretici';
import type { BolumVerisi } from '../core/types';
import { SONSUZ_TABANI } from '../meta';
import { simdi } from './zaman';

const ONEK = 'fitil.uretim.';
/** Depoda tutulan en fazla üretim (eski günler silinir). */
const EN_FAZLA_SAKLI = 12;
const SURUM = 1;

interface Is {
  id: number;
  g: Generator<UretimIlerleme, BolumVerisi, void>;
  oncelik: number;
  eylem: number;
  sozler: { coz: (v: BolumVerisi) => void; red: (e: unknown) => void }[];
  ilerleme: ((o: number) => void)[];
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

function depoYaz(id: number, v: BolumVerisi): void {
  try {
    localStorage.setItem(ONEK + id, JSON.stringify({ s: SURUM, v }));
    // Eski üretimleri temizle (en yeni EN_FAZLA_SAKLI kalsın).
    const anahtarlar: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ONEK)) anahtarlar.push(k);
    }
    if (anahtarlar.length > EN_FAZLA_SAKLI) {
      anahtarlar.sort((a, b) => Number(a.slice(ONEK.length)) - Number(b.slice(ONEK.length)));
      // Günlükler (yyyymmdd) ve sonsuzlar (1 000 000+n) ayrı sıralanır; en küçükler (en eskiler) silinir.
      for (const k of anahtarlar.slice(0, anahtarlar.length - EN_FAZLA_SAKLI)) localStorage.removeItem(k);
    }
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
  /** Oyuncu bekliyorken kare başına bütçe (ms). */
  butceOn = 34;
  /** Arka planda kare başına bütçe (ms). */
  butceArka = 7;
  /** Oyun oynanırken arka plan üretimi durur (kare süresi bozulmasın). */
  duraklat = false;

  hazir(id: number): BolumVerisi | null {
    const b = this.bellek.get(id);
    if (b) return b;
    const d = depoOku(id);
    if (d) this.bellek.set(id, d);
    return d;
  }

  gunluk(tarih: number, s: { oncelik?: number; ilerleme?: (o: number) => void } = {}): Promise<BolumVerisi> {
    return this.iste(tarih, () => gunlukUret(tarih), s);
  }

  sonsuz(n: number, s: { oncelik?: number; ilerleme?: (o: number) => void } = {}): Promise<BolumVerisi> {
    return this.iste(SONSUZ_TABANI + n, () => sonsuzUret(n), s);
  }

  private iste(id: number, yap: () => Generator<UretimIlerleme, BolumVerisi, void>, s: { oncelik?: number; ilerleme?: (o: number) => void }): Promise<BolumVerisi> {
    const h = this.hazir(id);
    if (h) {
      s.ilerleme?.(1);
      return Promise.resolve(h);
    }
    let is = this.isler.find((x) => x.id === id);
    if (!is) {
      is = { id, g: yap(), oncelik: 0, eylem: 0, sozler: [], ilerleme: [] };
      this.isler.push(is);
    }
    is.oncelik = Math.max(is.oncelik, s.oncelik ?? 0);
    if (s.ilerleme) {
      is.ilerleme.push(s.ilerleme);
      s.ilerleme(oran(is.eylem));
    }
    const p = new Promise<BolumVerisi>((coz, red) => is!.sozler.push({ coz, red }));
    this.baslat();
    return p;
  }

  /** Bekleyen işin ilerleme dinleyicilerini bırak (bekleme kartı kapandı). */
  dinleyicileriBirak(id: number): void {
    const is = this.isler.find((x) => x.id === id);
    if (is) {
      is.ilerleme = [];
      is.oncelik = 0;
    }
  }

  private baslat(): void {
    if (this.calisiyor) return;
    this.calisiyor = true;
    const adim = () => {
      if (this.isler.length === 0) {
        this.calisiyor = false;
        return;
      }
      // En yüksek öncelikli iş (eşitlikte ilk gelen).
      let is = this.isler[0];
      for (const x of this.isler) if (x.oncelik > is.oncelik) is = x;
      if (this.duraklat && is.oncelik <= 0) {
        setTimeout(adim, 250);
        return;
      }
      const butce = is.oncelik > 0 ? this.butceOn : this.butceArka;
      const bas = simdi();
      try {
        for (;;) {
          const r = is.g.next();
          if (r.done) {
            this.bitir(is, r.value);
            break;
          }
          is.eylem = r.value.eylem;
          if (simdi() - bas >= butce) break;
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

  private bitir(is: Is, v: BolumVerisi): void {
    this.isler = this.isler.filter((x) => x !== is);
    this.bellek.set(is.id, v);
    depoYaz(is.id, v);
    for (const f of is.ilerleme) f(1);
    for (const s of is.sozler) s.coz(v);
  }
}
