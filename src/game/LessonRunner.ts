/**
 * Ders oynatıcı: adımları sırayla yürütür, hedefleri simülasyona karşı
 * denetler, quiz ve parça seçme cevaplarını değerlendirir, hataları sayar.
 */

import type { PartId } from '../engine/visual';
import type { EngineSim, SimEvent, SimSnapshot } from '../sim';
import type { SwitchId } from '../ui/Cockpit';
import type { Lesson, LessonCtx, Step, StepUi } from './lessons/types';

export interface LessonHost {
  sim: EngineSim;
  applyStepUi(ui: StepUi | undefined): void;
  setPickMode(active: boolean): void;
}

export interface ObjectiveState {
  text: string;
  done: boolean;
  active: boolean;
  holdProgress: number; // 0..1
}

export type Feedback = { kind: 'ok' | 'bad' | 'info'; html: string } | null;

export interface StepView {
  index: number;
  count: number;
  step: Step;
  objectives: ObjectiveState[];
  quizAnswered: number | null;
  quizCorrect: boolean;
  pickDone: boolean;
  failed: string | null;
  feedback: Feedback;
  complete: boolean;
  doneNote: string | null;
}

export interface LessonResult {
  lesson: Lesson;
  stars: number;
  mistakes: number;
  fails: number;
  seconds: number;
}

export class LessonRunner {
  onChange?: (v: StepView) => void;
  onFinish?: (r: LessonResult) => void;

  private index = 0;
  private t = 0;
  private totalT = 0;
  private events: SimEvent[] = [];
  private memo: LessonCtx['memo'] = {};
  private objDone: boolean[] = [];
  private holdT = 0;
  private quizAnswered: number | null = null;
  private quizCorrect = false;
  private pickDone = false;
  private failed: string | null = null;
  private feedback: Feedback = null;
  private mistakes = 0;
  private fails = 0;
  private completeAt = -1;
  private lastSnap: SimSnapshot | null = null;
  private dirty = true;

  constructor(
    readonly lesson: Lesson,
    private host: LessonHost,
  ) {
    lesson.setup(host.sim);
    this.enter(0);
  }

  get step(): Step {
    return this.lesson.steps[this.index];
  }

  private enter(i: number) {
    this.index = i;
    this.t = 0;
    this.events = [];
    this.memo = {};
    this.objDone = (this.step.objectives ?? []).map(() => false);
    this.holdT = 0;
    this.quizAnswered = null;
    this.quizCorrect = false;
    this.pickDone = false;
    this.failed = null;
    this.feedback = null;
    this.completeAt = -1;
    this.step.enter?.(this.host.sim);
    this.host.applyStepUi(this.step.ui);
    this.host.setPickMode(!!this.step.pick);
    this.dirty = true;
  }

  private ctx(snap: SimSnapshot): LessonCtx {
    return {
      sim: this.host.sim,
      snap,
      t: this.t,
      events: this.events,
      had: (type) => this.events.some((e) => e.type === type),
      memo: this.memo,
    };
  }

  get isComplete(): boolean {
    const s = this.step;
    const objs = this.objDone.every(Boolean);
    const quiz = !s.quiz || this.quizCorrect;
    const pick = !s.pick || this.pickDone;
    return objs && quiz && pick && !this.failed;
  }

  onEvent(e: SimEvent) {
    this.events.push(e);
  }

  update(dt: number, snap: SimSnapshot) {
    this.lastSnap = snap;
    this.t += dt;
    this.totalT += dt;
    const ctx = this.ctx(snap);
    const s = this.step;
    s.tick?.(ctx);

    if (!this.failed && !this.isComplete) {
      const msg = s.fail?.(ctx) ?? null;
      if (msg) {
        this.failed = msg;
        this.fails++;
        this.dirty = true;
      }
    }

    if (!this.failed && s.objectives) {
      const i = this.objDone.indexOf(false);
      if (i >= 0) {
        const obj = s.objectives[i];
        if (obj.check(ctx)) {
          this.holdT += dt;
          if (this.holdT >= (obj.hold ?? 0)) {
            this.objDone[i] = true;
            this.holdT = 0;
          }
        } else {
          this.holdT = 0;
        }
        this.dirty = true; // canlı metin ve süre çubuğu
      }
    }

    if (this.isComplete && this.completeAt < 0) {
      this.completeAt = this.t;
      this.dirty = true;
    }
    if (s.auto && this.completeAt >= 0 && this.t - this.completeAt > 1.4) {
      this.next();
      return;
    }
    if (this.dirty) this.emit();
  }

  private emit() {
    this.dirty = false;
    const s = this.step;
    const snap = this.lastSnap;
    const ctx = snap ? this.ctx(snap) : null;
    const firstOpen = this.objDone.indexOf(false);
    const view: StepView = {
      index: this.index,
      count: this.lesson.steps.length,
      step: s,
      objectives: (s.objectives ?? []).map((o, i) => ({
        text: typeof o.text === 'function' ? (ctx ? o.text(ctx) : '') : o.text,
        done: this.objDone[i],
        active: i === firstOpen,
        holdProgress: i === firstOpen && o.hold ? Math.min(1, this.holdT / o.hold) : 0,
      })),
      quizAnswered: this.quizAnswered,
      quizCorrect: this.quizCorrect,
      pickDone: this.pickDone,
      failed: this.failed,
      feedback: this.feedback,
      complete: this.isComplete,
      doneNote: this.isComplete && s.done && ctx ? (typeof s.done === 'function' ? s.done(ctx) : s.done) : null,
    };
    this.onChange?.(view);
  }

  answerQuiz(i: number) {
    const q = this.step.quiz;
    if (!q || this.quizCorrect) return;
    this.quizAnswered = i;
    if (i === q.answer) {
      this.quizCorrect = true;
      this.feedback = { kind: 'ok', html: `<b>Doğru.</b> ${q.explain}` };
    } else {
      this.mistakes++;
      this.feedback = { kind: 'bad', html: 'Bu değil — tekrar düşün. İpucu metnin içinde.' };
    }
    this.emit();
  }

  pick(part: PartId, name: string) {
    const p = this.step.pick;
    if (!p || this.pickDone) return;
    const targets = Array.isArray(p.part) ? p.part : [p.part];
    if (targets.includes(part)) {
      this.pickDone = true;
      this.feedback = { kind: 'ok', html: `<b>Doğru:</b> ${name}.` };
      this.host.setPickMode(false);
    } else {
      this.mistakes++;
      this.feedback = { kind: 'bad', html: `Tıkladığın: <b>${name}</b>. Aradığımız bu değil.` };
    }
    this.emit();
  }

  retry() {
    this.enter(this.index);
  }

  next() {
    if (!this.isComplete) return;
    if (this.index + 1 < this.lesson.steps.length) {
      this.enter(this.index + 1);
    } else {
      const bad = this.mistakes + this.fails;
      const stars = bad === 0 ? 3 : bad <= 2 ? 2 : 1;
      this.onFinish?.({
        lesson: this.lesson,
        stars,
        mistakes: this.mistakes,
        fails: this.fails,
        seconds: this.totalT,
      });
    }
  }

  refresh() {
    this.dirty = true;
  }

  /** Adımın ipucu olarak yanıp sönecek anahtarları. */
  flash(snap: SimSnapshot): SwitchId[] | null {
    const f = this.step.ui?.flash;
    if (!f) return null;
    return typeof f === 'function' ? f(this.ctx(snap)) : f;
  }
}
