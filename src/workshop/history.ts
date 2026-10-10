/**
 * Geri al / yinele (M5a, §9.2 S6): son 30 düzenleme, bellekte. Her kayıt
 * düzenlemeden ÖNCEKİ durumu tutar. `input` aşamasındaki ardışık olaylar
 * (aynı düğme ya da aynı tutamaç) tek kayıtta birleşir; onu kapatan
 * `change` da aynı kayda girer. Yeni düzenleme yinele yığınını boşaltır.
 */

import type { Edit } from '../design/core/edit';

export const HISTORY_LIMIT = 30;

interface Entry<TState> {
  edit: Edit;
  /** Geri alındığında dönülecek durum (undo yığınında) ya da yinelenecek durum (redo yığınında) */
  state: TState;
  /** `input` ile açık: aynı hedefin sonraki olayları bu kayda birleşir */
  open: boolean;
  /** Bu kayıt açılırken boşaltılan yinele yığını ve sınırdan düşen en eski kayıtlar (cancelOpen geri koyar) */
  displaced?: { redo: Entry<TState>[]; evicted: Entry<TState>[] };
}

/** İki düzenleme aynı sürükleme/kaydırma hareketinin parçası mı */
function sameTarget(a: Edit, b: Edit): boolean {
  if (a.t === 'knob' && b.t === 'knob') return a.id === b.id && a.variant === b.variant;
  if (a.t === 'handle' && b.t === 'handle') return a.id === b.id;
  return false;
}

/** Birleşmeyi kapatır: kayıt artık iptal edilemez, sakladıkları bırakılır */
function close<T>(e: Entry<T>): void {
  e.open = false;
  delete e.displaced;
}

export class EditHistory<TState> {
  private undoStack: Entry<TState>[] = [];
  private redoStack: Entry<TState>[] = [];

  constructor(readonly limit = HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Kayıt sayısı (test ve arayüz) */
  get size(): number {
    return this.undoStack.length;
  }

  /** Son düzenleme */
  get last(): Edit | undefined {
    return this.undoStack[this.undoStack.length - 1]?.edit;
  }

  /** Düzenlemeyi ve öncesindeki durumu kaydeder; `input` aşaması son kaydı günceller */
  push(e: Edit, before: TState, phase: 'input' | 'change' = 'change'): void {
    const redo = this.redoStack;
    this.redoStack = [];
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && top.open && sameTarget(top.edit, e)) {
      top.edit = e;
      if (phase !== 'input') close(top);
      return;
    }
    if (top) close(top);
    const entry: Entry<TState> = { edit: e, state: before, open: phase === 'input' };
    this.undoStack.push(entry);
    const evicted = this.undoStack.length > this.limit ? this.undoStack.splice(0, this.undoStack.length - this.limit) : [];
    // Açık (sürükleme) kaydı iptal edilebilir: yerinden ettiklerini saklar
    if (entry.open) entry.displaced = { redo, evicted };
  }

  /**
   * Süren hareketi (açık kayıt, aynı hedef) iz bırakmadan geri alır: kayıt
   * yığından çıkar, yinele yığını ve sınırdan düşen kayıtlar geri gelir.
   * Dönen durum hareketten önceki durumdur; açık kayıt yoksa null (hareket
   * henüz bir şey yazmamış).
   */
  cancelOpen(e: Edit): TState | null {
    const top = this.undoStack[this.undoStack.length - 1];
    if (!top || !top.open || !sameTarget(top.edit, e)) return null;
    this.undoStack.pop();
    const d = top.displaced;
    if (d) {
      this.undoStack.unshift(...d.evicted);
      this.redoStack = d.redo;
    }
    return top.state;
  }

  /** Açık birleşmeyi kapatır (sürükleme bitti, odak değişti) */
  seal(): void {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top) close(top);
  }

  /** Geri alınan düzenlemeden önceki durum; yığın boşsa null */
  undo(current: TState): TState | null {
    const top = this.undoStack.pop();
    if (!top) return null;
    this.redoStack.push({ edit: top.edit, state: current, open: false });
    return top.state;
  }

  redo(current: TState): TState | null {
    const top = this.redoStack.pop();
    if (!top) return null;
    this.undoStack.push({ edit: top.edit, state: current, open: false });
    return top.state;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
