/**
 * Geri al / yinele (M5a, §9.2 S6): son 30 düzenleme, bellekte. `input`
 * aşamasındaki ardışık düğme olayları tek Edit'te birleşir.
 *
 * P0: imzalar. Gövdeleri P4b yazar.
 */

import type { Edit } from '../design/core/edit';

export const HISTORY_LIMIT = 30;

export class EditHistory<TState> {
  constructor(readonly limit = HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return false;
  }

  get canRedo(): boolean {
    return false;
  }

  /** Düzenlemeyi ve öncesindeki durumu kaydeder; `input` aşaması son kaydı günceller */
  push(_e: Edit, _before: TState, _phase: 'input' | 'change' = 'change'): void {
    throw new Error('P4b: geri al yığını henüz yok.');
  }

  /** Geri alınan düzenlemeden önceki durum; yığın boşsa null */
  undo(_current: TState): TState | null {
    throw new Error('P4b: geri al yığını henüz yok.');
  }

  redo(_current: TState): TState | null {
    throw new Error('P4b: geri al yığını henüz yok.');
  }

  clear(): void {
    throw new Error('P4b: geri al yığını henüz yok.');
  }
}
