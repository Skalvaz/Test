/** Sol panel: ders adımı, hedefler, quiz, parça seçme ve geri bildirim. */

import type { LessonRunner, StepView } from '../game/LessonRunner';
import type { EngineSim } from '../sim';
import { h, icon } from './dom';
import { FlightControls } from './FlightControls';

export class LessonPanel {
  readonly el: HTMLDivElement;
  private body: HTMLDivElement;
  private nextBtn: HTMLButtonElement;
  private retryBtn: HTMLButtonElement;
  private title: HTMLSpanElement;
  private key = '';
  private objEls: { row: HTMLDivElement; text: HTMLSpanElement; hold: HTMLSpanElement }[] = [];
  private flight: FlightControls;
  private runner: LessonRunner | null = null;
  onExit?: () => void;

  constructor(sim: EngineSim) {
    this.flight = new FlightControls(sim);
    this.title = h('span', { class: 'panel-title' });
    this.body = h('div', { class: 'scroll panel-body' });
    this.nextBtn = h('button', {
      class: 'btn primary',
      text: 'Devam',
      on: { click: () => this.runner?.next() },
    });
    this.retryBtn = h('button', {
      class: 'btn small ghost',
      on: { click: () => this.runner?.retry() },
    }, [icon('restart', 14), 'Adımı tekrarla']);
    const exit = h('button', {
      class: 'btn small ghost icon',
      title: 'Dersten çık',
      on: { click: () => this.onExit?.() },
    }, [icon('close', 16)]);

    this.el = h('div', { class: 'side-left panel' }, [
      h('div', { class: 'panel-head' }, [this.title, h('span', { class: 'spacer' }), exit]),
      this.body,
      h('div', { class: 'lesson-foot' }, [this.retryBtn, h('span', { class: 'spacer' }), this.nextBtn]),
    ]);
  }

  attach(runner: LessonRunner, lessonNumber: number) {
    this.runner = runner;
    this.key = '';
    this.title.textContent = `Ders ${lessonNumber} · ${runner.lesson.title}`;
  }

  render(v: StepView) {
    const key = [
      v.index,
      v.quizAnswered,
      v.quizCorrect,
      v.pickDone,
      v.failed,
      v.complete,
      v.feedback?.html,
      v.objectives.map((o) => (o.done ? 1 : 0)).join(''),
      v.doneNote,
    ].join('|');

    if (key !== this.key) {
      this.key = key;
      this.build(v);
    } else {
      // Yalnızca canlı metinleri ve süre göstergelerini güncelle
      v.objectives.forEach((o, i) => {
        const el = this.objEls[i];
        if (!el) return;
        if (el.text.textContent !== o.text) el.text.textContent = o.text;
        el.hold.textContent = o.active && o.holdProgress > 0 ? `${Math.round(o.holdProgress * 100)}%` : '';
      });
    }
    if (v.step.ui?.flightControls) this.flight.refresh();
  }

  private build(v: StepView) {
    const s = v.step;
    const dots = h('div', { class: 'progress-dots' },
      Array.from({ length: v.count }, (_, i) =>
        h('i', { class: i < v.index ? 'done' : i === v.index ? 'now' : '' })),
    );
    const parts: (Node | null)[] = [
      h('div', { class: 'lesson-meta' }, [h('span', { text: `ADIM ${v.index + 1}/${v.count}` }), dots]),
      h('div', { class: 'step-title', text: s.title }),
      h('div', { class: 'step-body', html: s.body }),
    ];

    if (s.ui?.flightControls) parts.push(this.flight.el);

    this.objEls = [];
    if (v.objectives.length) {
      const list = h('div', { class: 'objectives' });
      for (const o of v.objectives) {
        const text = h('span', { text: o.text });
        const hold = h('span', { class: 'hold' });
        const row = h('div', { class: `objective${o.done ? ' done' : o.active ? ' active' : ''}` }, [
          h('span', { class: 'box', text: o.done ? '✓' : '' }),
          text,
          hold,
        ]);
        this.objEls.push({ row, text, hold });
        list.append(row);
      }
      parts.push(list);
    }

    if (s.quiz) {
      const q = s.quiz;
      const quiz = h('div', { class: 'quiz' }, [h('div', { class: 'quiz-q', text: q.question })]);
      q.options.forEach((opt, i) => {
        const cls =
          v.quizAnswered === i ? (i === q.answer ? ' right' : ' wrong') : v.quizCorrect && i === q.answer ? ' right' : '';
        quiz.append(
          h('button', {
            class: `quiz-opt${cls}`,
            text: `${String.fromCharCode(65 + i)}) ${opt}`,
            attrs: v.quizCorrect ? { disabled: 'true' } : {},
            on: { click: () => this.runner?.answerQuiz(i) },
          }),
        );
      });
      parts.push(quiz);
    }

    if (s.pick && !v.pickDone) {
      parts.push(h('div', { class: 'pick-prompt', html: `🎯 ${s.pick.prompt}` }));
    }
    if (v.feedback) parts.push(h('div', { class: `feedback ${v.feedback.kind}`, html: v.feedback.html }));
    if (v.failed) {
      parts.push(
        h('div', { class: 'feedback bad', html: `<b>Adım başarısız.</b> ${v.failed}<br><br>Adımı tekrarlayarak yeniden dene.` }),
      );
    }
    if (v.doneNote) parts.push(h('div', { class: 'feedback info', html: v.doneNote }));

    this.body.replaceChildren(...parts.filter((p): p is Node => !!p));
    this.body.scrollTop = v.failed || v.feedback || v.doneNote ? this.body.scrollHeight : 0;

    const last = v.index === v.count - 1;
    this.nextBtn.textContent = last ? 'Dersi bitir' : 'Devam';
    this.nextBtn.disabled = !v.complete;
    this.retryBtn.classList.toggle('hidden', !v.failed && !(v.step.objectives?.length));
  }
}
