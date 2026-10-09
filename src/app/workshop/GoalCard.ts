/**
 * Görev kartı (M5a §6.6 madde 5, §9.2 S7): seçili görevin satır satır
 * ✓/✗ denetimi. Kart `data-goal="<görev>"`, satırlar
 * `data-goal="<görev>:<sıra>"` ve `.ok` / `.bad`.
 */

import type { WorkshopState } from '../../workshop/store';
import { checkGoal } from '../../workshop/goals';
import { h } from '../../ui/dom';
import { ATTR } from './selectors';

export class GoalCard {
  readonly el: HTMLDivElement;
  private key = '';

  constructor(private onLesson: (id: string) => void) {
    this.el = h('div', { class: 'ws-goal hidden' });
  }

  update(s: Readonly<WorkshopState>): void {
    const g = s.project.goal;
    if (!g || !s.last) {
      this.el.classList.add('hidden');
      this.key = '';
      return;
    }
    const r = checkGoal(g, s.last.summary, s.last.findings);
    const key = JSON.stringify([g.id, r.rows]);
    if (key === this.key) return;
    this.key = key;
    this.el.classList.remove('hidden');
    this.el.setAttribute(ATTR.goal, g.id);
    this.el.classList.toggle('met', r.met);
    const kids: (Node | null)[] = [
      h('div', { class: 'ws-goal-head' }, [
        h('span', { class: 'ws-goal-title', text: `Görev · ${g.title}` }),
        h('span', { class: `ws-goal-state ${r.met ? 'ok' : 'bad'}`, text: r.met ? 'TAMAM' : 'SÜRÜYOR' }),
      ]),
      ...r.rows.map((row, i) =>
        h('div', { class: `ws-goal-row ${row.ok ? 'ok' : 'bad'}`, attrs: { [ATTR.goal]: `${g.id}:${i}` } }, [
          h('span', { class: 'ws-goal-mark', text: row.ok ? '✓' : '✗' }),
          h('span', { text: row.label }),
          h('span', { class: 'mono', text: row.text }),
        ]),
      ),
      g.hint && !r.met ? h('p', { class: 'ws-goal-hint', text: g.hint }) : null,
      g.lesson && !r.met
        ? h('button', { class: 'ws-link', text: 'İlgili ders', attrs: { type: 'button', [ATTR.action]: 'lesson' }, on: { click: () => this.onLesson(g.lesson!) } })
        : null,
    ];
    this.el.replaceChildren(...kids.filter((x): x is Node => x !== null));
  }
}
