/** Ekranın üst ortasında kısa süreli olay bildirimleri. */

import type { Severity } from '../sim';
import { h } from './dom';

const TAGS: Record<Severity, string> = { info: 'BİLGİ', caution: 'DİKKAT', warning: 'UYARI' };

export class Toasts {
  readonly el = h('div', { class: 'toasts', attrs: { 'aria-live': 'polite' } });
  private recent = new Map<string, number>();

  /**
   * `detail`: uzun açıklama (atölyenin mimari değişimi notları) kapalı
   * "Ayrıntılar" bölümünde; bildirim kısa kalır, 3B modeli kapatmaz. Bölüm
   * açıkken ya da imleç bildirimin üstündeyken bildirim kapanmaz.
   */
  show(message: string, severity: Severity = 'info', ms = 4200, detail?: string) {
    // Aynı mesaj kısa süre içinde tekrar gelirse yığılmasın
    const now = performance.now();
    const key = detail ? `${message}\n${detail}` : message;
    if ((this.recent.get(key) ?? 0) > now - 1500) return;
    this.recent.set(key, now);

    const det = detail
      ? h('details', { class: 'toast-detail' }, [h('summary', { text: 'Ayrıntılar' }), h('p', { text: detail })])
      : null;
    const t = h('div', { class: `toast ${severity}${det ? ' has-detail' : ''}` }, [
      h('span', { class: 'tag', text: TAGS[severity] }),
      det ? h('div', { class: 'toast-body' }, [h('span', { text: message }), det]) : h('span', { text: message }),
    ]);
    this.el.prepend(t);
    while (this.el.children.length > 4) this.el.lastElementChild?.remove();
    const out = () => {
      // Temizlenen/taşan bildirim: bekleme döngüsü sürmesin
      if (!t.isConnected) return;
      if (det && (det.open || t.matches(':hover'))) {
        setTimeout(out, 1500);
        return;
      }
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    };
    setTimeout(out, ms);
  }

  /**
   * Bütün bildirimleri kaldırır (mod değişimi). Tekrar eleme belleği de
   * sıfırlanır: temizlenen bir mesaj hemen yeniden gelirse (menüden aynı
   * moda dönüş) gösterilir, görünmeyen bir kopyası yüzünden yutulmaz.
   */
  clear() {
    this.el.replaceChildren();
    this.recent.clear();
  }
}
