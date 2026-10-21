/**
 * Mola hatırlatıcısı (GDD §11 #30, §14.8): kesintisiz oyun süresi ayardaki
 * dakikaya (30 / 45 / 60) ulaşınca "Kıvılcım Usta: Biraz mola?" balonu bir
 * kez gösterilir. Kapatılınca sayaç sıfırlanır; sonraki hatırlatma bir tam
 * periyot sonradır. Ayar 0 = kapalı.
 *
 * Saf zamanlayıcı: `simdiMs` dışarıdan gelir (performance.now() ya da
 * Date.now(); yalnız farklar kullanılır). Uygulama her saniye ya da
 * görünürlük değişiminde `molaIlerle` çağırır.
 *
 * Gerçek mola algısı: sayfa 5 dakikadan uzun gizli kaldıysa ya da iki çağrı
 * arasında 5 dakikadan uzun boşluk varsa (cihaz uyudu) oyuncu zaten mola
 * vermiştir: sayaç sıfırlanır. Kısa gizlenmeler süreye eklenmez.
 */
import { t } from '../platform/dil';
import type { MolaDakika } from './kayit';

/** Bu süreden uzun ara gerçek moladır. */
export const MOLA_ARA_MS = 5 * 60_000;

export interface MolaDurumu {
  /** Biriken etkin oyun süresi (ms). */
  etkinMs: number;
  /** Son çağrının zamanı; null = başlamadı. */
  sonMs: number | null;
  /** Sayfa gizlendiği an (gizliyken); null = görünür. */
  gizliBasi: number | null;
  /** Balon bu periyotta gösterildi mi. */
  gosterildi: boolean;
}

export function molaBaslat(): MolaDurumu {
  return { etkinMs: 0, sonMs: null, gizliBasi: null, gosterildi: false };
}

export interface MolaGirdisi {
  /** Ayar: dakika (0 = kapalı). */
  dakika: MolaDakika;
  /** Sayfa görünür mü (document.visibilityState === 'visible'). */
  gorunur: boolean;
}

/**
 * Zamanlayıcıyı ilerletir. `goster`: balon şimdi gösterilmeli (periyot başına
 * bir kez true döner).
 */
export function molaIlerle(d: MolaDurumu, simdiMs: number, g: MolaGirdisi): { durum: MolaDurumu; goster: boolean } {
  const y: MolaDurumu = { ...d };
  if (!g.gorunur) {
    if (y.gizliBasi === null) y.gizliBasi = simdiMs;
    y.sonMs = simdiMs;
    return { durum: y, goster: false };
  }
  if (y.gizliBasi !== null) {
    if (simdiMs - y.gizliBasi >= MOLA_ARA_MS) {
      y.etkinMs = 0;
      y.gosterildi = false;
    }
    y.gizliBasi = null;
    y.sonMs = simdiMs;
    return { durum: y, goster: false };
  }
  if (y.sonMs === null) {
    y.sonMs = simdiMs;
    return { durum: y, goster: false };
  }
  const fark = simdiMs - y.sonMs;
  y.sonMs = simdiMs;
  if (fark >= MOLA_ARA_MS) {
    y.etkinMs = 0;
    y.gosterildi = false;
    return { durum: y, goster: false };
  }
  if (fark > 0) y.etkinMs += fark;
  if (g.dakika > 0 && !y.gosterildi && y.etkinMs >= g.dakika * 60_000) {
    y.gosterildi = true;
    return { durum: y, goster: true };
  }
  return { durum: y, goster: false };
}

/** Balon kapatıldı: yeni periyot başlar. */
export function molaKapat(d: MolaDurumu, simdiMs: number): MolaDurumu {
  return { ...d, etkinMs: 0, gosterildi: false, sonMs: simdiMs, gizliBasi: null };
}

/** Ayar değişti: süre korunur; kapalıya alınırsa balon durumu sıfırlanır. */
export function molaAyarDegisti(d: MolaDurumu, dakika: MolaDakika): MolaDurumu {
  return dakika === 0 ? { ...d, gosterildi: false } : d;
}

/** Sonraki hatırlatmaya kalan süre (ms); kapalıysa null. */
export function molayaKalan(d: MolaDurumu, dakika: MolaDakika): number | null {
  if (dakika === 0) return null;
  return Math.max(0, dakika * 60_000 - d.etkinMs);
}

/** Balon metni (§11 #30). */
export const MOLA_METNI = t('Kıvılcım Usta: Biraz mola?', 'Master Spark: Time for a break?');
