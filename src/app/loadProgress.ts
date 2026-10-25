/**
 * Yükleme sözleşmesi (Dalga 0, T-04): App.init her aşamada `loadProgress`
 * olayı yayar; yükleme ekranı (index.html + src/styles/loader.css) bunu
 * çizer. **1A** bu dosyanın sahibidir (Dalga 1): ağırlıkları ölçümle
 * ayarlar, havaalanını ilk kareden sonraya alır ve yükleme ekranını ilk tam
 * kareye bağlar (`firstFrame`); **1C** çizimi yapar (çubuk, istasyon çizgisi
 * motifi). Yayıcı ile çizici birbirini içe aktarmaz: olay `window` üzerinden
 * de gider (`addEventListener('loadProgress', e => e.detail)`).
 *
 * Kurallar (1C ve araçlar bunlara güvenir):
 * - `fraction` ağırlıklı ilerlemedir (0..1) ve azalmaz.
 * - `ready` (menü tıklanabilir) bir kez gelir; o andan sonra `fraction` 1'e
 *   kilitlenir ve her olay `done: true` taşır. `ready`'den sonra gelen aşama
 *   olayları arka plan yüklemesidir (T-04: havaalanı ilk kareden sonra);
 *   yükleme ekranı bunları çizmez.
 * - `ready`'den önceki aşamaların sırası `LOAD_WEIGHTS` sırasıdır; 1A bir
 *   aşamayı ready sonrasına alınca onu ağırlıklardan çıkarır.
 * - Araçlar (vitrin, oynanış testi, perf-smoke) yükleme ekranını değil
 *   `window.__loadReady`'yi (ya da `app.ready` sözünü) bekler: yükleme ekranı
 *   ilk tam kareye bağlanınca donmuş kayıtta (fixedDt) hiç kare çizilmeden
 *   kalkmaz.
 *
 * Ağırlıklar bugünkü soğuk açılışın kabaca süre payları (denetim, 1440×810,
 * RTX 4070): 1A yeniden ölçer.
 */

export type LoadStage =
  | 'textures'
  | 'kit'
  | 'scans'
  | 'environment'
  | 'cell'
  | 'cellProps'
  | 'airfield'
  | 'engine'
  | 'sim'
  | 'post'
  /** init bitti, menü tıklanabilir (yükleme ekranı solmaya başlar) */
  | 'ready'
  /** İlk tam kare çizildi (ortam derlemesi bitti) */
  | 'firstFrame';

export interface LoadProgress {
  stage: LoadStage;
  /** Ekranda gösterilecek Türkçe metin */
  label: string;
  /** Ağırlıklı ilerleme 0..1 (aşama başladığında) */
  fraction: number;
  /** ready ve firstFrame'de true */
  done: boolean;
}

/** Aşamaların göreli ağırlıkları (toplam 1; ready öncesi) */
export const LOAD_WEIGHTS: Readonly<Record<Exclude<LoadStage, 'ready' | 'firstFrame'>, number>> = {
  textures: 0.12,
  kit: 0.08,
  scans: 0.1,
  environment: 0.05,
  cell: 0.15,
  cellProps: 0.05,
  airfield: 0.35,
  engine: 0.06,
  sim: 0.02,
  post: 0.02,
};

const ORDER = Object.keys(LOAD_WEIGHTS) as (keyof typeof LOAD_WEIGHTS)[];

/** Aşama başlangıcındaki ağırlıklı ilerleme */
export function stageFraction(stage: LoadStage): number {
  if (stage === 'ready' || stage === 'firstFrame') return 1;
  let f = 0;
  for (const s of ORDER) {
    if (s === stage) break;
    f += LOAD_WEIGHTS[s];
  }
  return Math.min(1, f);
}

export const LOAD_EVENT = 'loadProgress';

const listeners = new Set<(p: LoadProgress) => void>();
let last: LoadProgress | null = null;
let readyReached = false;

/** Araçların beklediği bayrak: `ready` yayıldı mı (sayfada `window.__loadReady`) */
function publishReady(v: boolean) {
  readyReached = v;
  if (typeof window !== 'undefined') (window as unknown as { __loadReady?: boolean }).__loadReady = v;
}
publishReady(false);

/** `ready` yayıldı mı (menü tıklanabilir; sonra gelen aşamalar arka plan yüklemesi) */
export function isLoadReady(): boolean {
  return readyReached;
}

/** Olayı yayar (dinleyiciler + window CustomEvent) */
export function emitLoadProgress(stage: LoadStage, label: string) {
  if (stage === 'ready') publishReady(true);
  const p: LoadProgress = {
    stage,
    label,
    fraction: readyReached ? 1 : Math.max(last?.fraction ?? 0, stageFraction(stage)),
    done: readyReached || stage === 'firstFrame',
  };
  last = p;
  for (const fn of listeners) {
    try {
      fn(p);
    } catch (err) {
      console.error('Yükleme dinleyicisi hata verdi', err);
    }
  }
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent<LoadProgress>(LOAD_EVENT, { detail: p }));
}

/** Yükleme olaylarını dinler; dönen işlev aboneliği kaldırır. Son olay hemen bildirilir. */
export function onLoadProgress(fn: (p: LoadProgress) => void): () => void {
  listeners.add(fn);
  if (last) fn(last);
  return () => listeners.delete(fn);
}

/** Son yayılan olay (yoksa null) */
export function lastLoadProgress(): LoadProgress | null {
  return last;
}

/** Testler için: durumu sıfırla */
export function resetLoadProgress() {
  last = null;
  listeners.clear();
  publishReady(false);
}
