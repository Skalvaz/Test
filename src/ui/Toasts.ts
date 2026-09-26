/** Ekranın üst ortasında kısa süreli olay bildirimleri. */

import type { Severity } from '../sim';
import { h } from './dom';

const TAGS: Record<Severity, string> = { info: 'BİLGİ', caution: 'DİKKAT', warning: 'UYARI' };

export class Toasts {
  readonly el = h('div', { class: 'toasts', attrs: { 'aria-live': 'polite' } });
  private recent = new Map<string, number>();

  show(message: string, severity: Severity = 'info', ms = 4200) {
    // Aynı mesaj kısa süre içinde tekrar gelirse yığılmasın
    const now = performance.now();
    if ((this.recent.get(message) ?? 0) > now - 1500) return;
    this.recent.set(message, now);

    const t = h('div', { class: `toast ${severity}` }, [
      h('span', { class: 'tag', text: TAGS[severity] }),
      h('span', { text: message }),
    ]);
    this.el.prepend(t);
    while (this.el.children.length > 4) this.el.lastElementChild?.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, ms);
  }
}
