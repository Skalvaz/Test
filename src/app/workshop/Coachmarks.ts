/**
 * İlk açılış koçluk balonları (M5a §6.8): "Bir modüle tıkla" → "Turkuaz
 * noktayı sürükle" → "Sağdaki sayılara bak"; her biri kendi eylemiyle
 * kapanır, `data-action="coach-skip"` hepsini kapatır. localStorage'da bir
 * kez (try/catch; depolama yoksa her açılışta görünür).
 */

import type { WorkshopState } from '../../workshop/store';
import { h } from '../../ui/dom';
import { ATTR } from './selectors';

const KEY = 'turbofan-akademi:workshop:coach';

const STEPS = [
  { text: 'Bir modüle tıkla: 3B modelde ya da soldaki listede. Seçili modül nabız gibi parlar.', where: 'center' },
  { text: 'Turkuaz noktayı sürükle: motoru doğrudan büyüt, kompresörü uzat, lüle ağzını aç.', where: 'center' },
  { text: 'Sağdaki sayılara bak: itki, yakıt tüketimi, kütle ve sınırlar anında değişir.', where: 'right' },
] as const;

function load(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function save(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    // depolama yok: yalnız bu oturumda
  }
}

export class Coachmarks {
  readonly el: HTMLDivElement;
  private step = load();
  private text: HTMLParagraphElement;
  private count: HTMLSpanElement;
  private shownAt = 0;

  constructor() {
    this.text = h('p');
    this.count = h('span', { class: 'ws-coach-n mono' });
    this.el = h('div', { class: 'ws-coach hidden', attrs: { role: 'status' } }, [
      this.count,
      this.text,
      h('button', { class: 'btn small ghost', text: 'Geç', attrs: { type: 'button', [ATTR.action]: 'coach-skip' }, on: { click: () => this.skip() } }),
    ]);
  }

  get done(): boolean {
    return this.step >= STEPS.length;
  }

  skip(): void {
    this.step = STEPS.length;
    save(this.step);
    this.el.classList.add('hidden');
  }

  private advance(): void {
    this.step++;
    this.shownAt = performance.now();
    save(this.step);
  }

  /** Durumdan: kendi eylemi gerçekleşen balon kapanır */
  update(s: Readonly<WorkshopState>, visible: boolean): void {
    if (this.done || !visible) {
      this.el.classList.add('hidden');
      return;
    }
    if (this.step === 0 && s.selected) this.advance();
    else if (this.step === 1 && s.dragging) this.advance();
    else if (this.step === 2 && performance.now() - this.shownAt > 7000 && s.phase === 'edit') this.advance();
    if (this.done) {
      this.el.classList.add('hidden');
      return;
    }
    const st = STEPS[this.step];
    this.text.textContent = s.phase === 'edit' ? st.text : 'Atölyeye hoş geldin: bir şablon seç ya da sıfırdan tasarla. İpuçları burada.';
    this.count.textContent = `${this.step + 1}/${STEPS.length}`;
    this.el.dataset.where = st.where;
    this.el.classList.remove('hidden');
    if (!this.shownAt) this.shownAt = performance.now();
  }
}
