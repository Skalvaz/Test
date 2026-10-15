/** Titreşim (yalnız destekleyen telefonlarda; ayarlardan kapatılabilir). */
let enabled = true;

export function setHaptics(on: boolean): void {
  enabled = on;
}

export function buzz(pattern: number | number[]): void {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* desteklenmiyor */
  }
}
