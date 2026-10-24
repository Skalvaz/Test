/**
 * Ayar kayıt defteri (Dalga 0 sözleşmesi): paketler yeni ayarlarını kendi
 * dosyalarından kaydeder; Ayarlar penceresi (Menus.settingsModal, 1D)
 * kayıtlı ayarları sekmesine göre çizer, değerler `Settings.extra`'da
 * kalıcıdır (src/game/progress.ts). Kimse App.ts'e, Menus.ts'e ya da
 * progress.ts'e dokunmaz:
 *
 *   // 1I, src/engine/… ya da src/app/camera/shake.ts içinde
 *   const shakeAmt = registerSetting({
 *     key: 'camera.shake', label: 'Kamera sarsıntısı', tab: 'kamera',
 *     control: { type: 'range', min: 0, max: 1, step: 0.05 }, default: 1,
 *     apply: (v) => (shakeScale = v),
 *   });
 *
 * Kurallar: anahtar `alan.ad` biçiminde ve benzersizdir (ikinci kayıt
 * atar). `apply` kayıtta, App ayar deposunu bağlayınca ve her değişimde
 * çağrılır; erken çağrılabilir (App kurulmadan): yalnız kendi modülünün
 * durumunu yazmalıdır. Kayıtlı değerin türü varsayılanınkiyle uyuşmazsa ya
 * da aralık dışındaysa varsayılan/kırpılmış değer kullanılır. "Sıfırla"
 * (`resetSetting`) varsayılana döner.
 */

/** Ayarlar penceresinin sekmeleri (1D sekmeli pencere; bugün başlıklı bölümler) */
export type SettingTab = 'grafik' | 'ses' | 'kamera' | 'oynanis' | 'erisilebilirlik';
export const SETTING_TABS: Readonly<Record<SettingTab, string>> = {
  grafik: 'Grafik',
  ses: 'Ses',
  kamera: 'Kamera',
  oynanis: 'Oynanış',
  erisilebilirlik: 'Erişilebilirlik',
};

export type SettingValue = number | boolean | string;

export type SettingControl =
  | { type: 'range'; min: number; max: number; step: number; /** Değer yazısı (ör. dB) */ format?: (v: number) => string }
  | { type: 'toggle' }
  | { type: 'select'; options: readonly (readonly [string, string])[] };

export interface SettingDef<T extends SettingValue = SettingValue> {
  /** Benzersiz anahtar: `alan.ad` (kalıcı depoda bu adla) */
  key: string;
  label: string;
  /** Satırın altındaki kısa açıklama */
  hint?: string;
  tab: SettingTab;
  control: SettingControl;
  default: T;
  /** Değer değişince (ve kayıtta) çağrılır */
  apply?: (v: T) => void;
}

export interface SettingHandle<T extends SettingValue> {
  get(): T;
  set(v: T): void;
  reset(): void;
}

interface Store {
  values: Record<string, unknown>;
  save: () => void;
}

const defs = new Map<string, SettingDef>();
let store: Store | null = null;
/** Depo bağlanmadan önce ayarlanan değerler (bağlanınca depoya yazılır) */
const pending = new Map<string, SettingValue>();
const listeners = new Set<() => void>();

function sanitize(def: SettingDef, v: unknown): SettingValue {
  if (typeof v !== typeof def.default) return def.default;
  const c = def.control;
  if (c.type === 'range' && typeof v === 'number') {
    if (!Number.isFinite(v)) return def.default;
    return Math.min(c.max, Math.max(c.min, v));
  }
  if (c.type === 'select' && !c.options.some(([o]) => o === v)) return def.default;
  return v as SettingValue;
}

function callApply(def: SettingDef, v: SettingValue) {
  try {
    def.apply?.(v);
  } catch (err) {
    console.error('Ayar uygulanamadı', def.key, err);
  }
}

/** Ayarın şu anki değeri (kayıtlı değilse hata) */
export function getSetting<T extends SettingValue = SettingValue>(key: string): T {
  const def = defs.get(key);
  if (!def) throw new Error(`Kayıtsız ayar: ${key}`);
  const raw = store ? store.values[key] : pending.get(key);
  return sanitize(def, raw === undefined ? def.default : raw) as T;
}

/** Değeri yazar, kalıcı kılar ve uygular */
export function setSetting(key: string, v: SettingValue) {
  const def = defs.get(key);
  if (!def) throw new Error(`Kayıtsız ayar: ${key}`);
  const val = sanitize(def, v);
  if (store) {
    store.values[key] = val;
    store.save();
  } else pending.set(key, val);
  callApply(def, val);
  for (const fn of listeners) fn();
}

/** Varsayılana döner ("Sıfırla") */
export function resetSetting(key: string) {
  const def = defs.get(key);
  if (!def) throw new Error(`Kayıtsız ayar: ${key}`);
  if (store) {
    delete store.values[key];
    store.save();
  } else pending.delete(key);
  callApply(def, def.default);
  for (const fn of listeners) fn();
}

/** Değişmez türü genişlet (`default: 1` → number) */
type Widen<T> = T extends number ? number : T extends string ? string : T extends boolean ? boolean : never;

/** Ayar kaydeder; kalıcı değer varsa hemen uygular */
export function registerSetting<D extends SettingValue>(def: SettingDef<Widen<D>> & { default: D }): SettingHandle<Widen<D>> {
  type T = Widen<D>;
  if (!/^[a-z][\w]*(\.[a-z][\w]*)+$/i.test(def.key)) throw new Error(`Ayar anahtarı 'alan.ad' biçiminde olmalı: ${def.key}`);
  if (defs.has(def.key)) throw new Error(`Ayar iki kez kaydedildi: ${def.key}`);
  defs.set(def.key, def as unknown as SettingDef);
  callApply(def as unknown as SettingDef, getSetting(def.key));
  for (const fn of listeners) fn();
  return {
    get: () => getSetting<T>(def.key),
    set: (v) => setSetting(def.key, v),
    reset: () => resetSetting(def.key),
  };
}

/** Kayıtlı ayarlar (kayıt sırasıyla); sekme verilirse yalnız o sekme */
export function registeredSettings(tab?: SettingTab): readonly SettingDef[] {
  const all = [...defs.values()];
  return tab ? all.filter((d) => d.tab === tab) : all;
}

/**
 * Kalıcı depoyu bağlar (App kurucusu: `settings.extra` ve saveSettings).
 * Bağlamadan önce ayarlanan değerler depoya yazılır; bütün kayıtlı ayarlar
 * depodaki değerle uygulanır.
 */
export function bindSettingsStore(values: Record<string, unknown>, save: () => void) {
  store = { values, save };
  let dirty = false;
  for (const [k, v] of pending) {
    values[k] = v;
    dirty = true;
  }
  pending.clear();
  if (dirty) save();
  for (const def of defs.values()) callApply(def, getSetting(def.key));
}

/** Kayıt ya da değer değişimini dinler (açık Ayarlar penceresi) */
export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Testler için: kayıt defterini boşalt */
export function clearSettingsRegistry() {
  defs.clear();
  pending.clear();
  listeners.clear();
  store = null;
}
