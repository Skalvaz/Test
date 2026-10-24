/**
 * Kip denetleyicisi (T-17 ilk adımı, Dalga 0): menü / ders / test hücresi /
 * atölye kipinin tek sahibi ve değişim bildirimi. Bugün geçişlerin kendisi
 * (showMenu, startLesson, openSandbox, openWorkshop) App'tedir ve kipi
 * geçişin başında yazar; bildirim o anda gider (geçiş henüz bitmemiştir).
 * Geçişler Dalga 2'de (2E arayüz kabuğu, 2F vitrin/soğuk açılış) buraya
 * taşınır; yeni kipler (vitrin, fotoğraf) buraya eklenir.
 *
 * Paketler App.ts'e dokunmadan dinler: `app.modes.onChange(({ from, to }) => …)`.
 */

export type Mode = 'menu' | 'lesson' | 'sandbox' | 'workshop';

export interface ModeChange {
  from: Mode;
  to: Mode;
}

export class ModeController {
  private cur: Mode;
  private listeners = new Set<(c: ModeChange) => void>();

  constructor(initial: Mode = 'menu') {
    this.cur = initial;
  }

  get current(): Mode {
    return this.cur;
  }

  /** Kipi yazar; değiştiyse dinleyicilere bildirir (aynı kip: sessiz) */
  set(next: Mode) {
    if (next === this.cur) return;
    const from = this.cur;
    this.cur = next;
    for (const fn of this.listeners) {
      try {
        fn({ from, to: next });
      } catch (err) {
        console.error('Kip dinleyicisi hata verdi', err);
      }
    }
  }

  /** Kip değişimini dinler; dönen işlev aboneliği kaldırır */
  onChange(fn: (c: ModeChange) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
