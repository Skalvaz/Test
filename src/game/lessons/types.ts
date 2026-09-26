/** Ders tanım tipleri. Dersler saf veridir; LessonRunner onları oynatır. */

import type { ViewName } from '../../app/CameraRig';
import type { PartId } from '../../engine/visual';
import type { EngineSim, SimEvent, SimEventType, SimSnapshot } from '../../sim';
import type { SwitchId } from '../../ui/Cockpit';

export interface LessonCtx {
  sim: EngineSim;
  snap: SimSnapshot;
  /** Adıma girildiğinden beri geçen süre [s] */
  t: number;
  /** Adıma girildiğinden beri gelen simülasyon olayları */
  events: SimEvent[];
  had(type: SimEventType): boolean;
  /** Adım boyunca serbestçe kullanılabilen not defteri */
  memo: Record<string, number | boolean | undefined>;
}

export interface Objective {
  text: string | ((ctx: LessonCtx) => string);
  check(ctx: LessonCtx): boolean;
  /** Koşulun kesintisiz sağlanması gereken süre [s] */
  hold?: number;
}

export interface Quiz {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface Pick {
  part: PartId | PartId[];
  prompt: string;
}

export interface StepUi {
  view?: ViewName;
  cutaway?: boolean;
  highlight?: PartId | null;
  /** Sağ panel (motor içi) */
  diagram?: boolean;
  /** Alt konsol (çalıştırma paneli, EICAS, gaz kolu) */
  cockpit?: boolean;
  /** Görünen anahtarlar (varsayılan: FADEC hariç hepsi) */
  switches?: SwitchId[];
  flash?: SwitchId[] | ((ctx: LessonCtx) => SwitchId[] | null);
  throttleLocked?: boolean;
  /** Ders panelinde irtifa/Mach/ISA kontrolleri */
  flightControls?: boolean;
}

export interface Step {
  title: string;
  /** HTML; canlı değer göstermek için fonksiyon olabilir */
  body: string;
  ui?: StepUi;
  /** Adıma girişte (ve tekrarda) motor durumunu hazırlar */
  enter?(sim: EngineSim): void;
  /** Her karede çağrılır (senaryo tetikleri için) */
  tick?(ctx: LessonCtx): void;
  objectives?: Objective[];
  quiz?: Quiz;
  pick?: Pick;
  /** Mesaj dönerse adım başarısız olur ve tekrarlanır */
  fail?(ctx: LessonCtx): string | null;
  /** Adım tamamlanınca gösterilecek not */
  done?: string | ((ctx: LessonCtx) => string);
  /** Hedefler bitince kendiliğinden ilerle */
  auto?: boolean;
}

export type Level = 'Başlangıç' | 'Orta' | 'İleri';

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: Level;
  setup(sim: EngineSim): void;
  steps: Step[];
}
