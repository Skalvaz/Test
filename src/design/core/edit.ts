/**
 * Ortak çekirdek: düzenleme kaydı (geri al/yinele yığınının öğesi). Her
 * kullanıcı eylemi tek bir Edit üretir; `input` aşamasındaki ardışık
 * düğme olayları tek Edit'te birleşir.
 */

import type { KnobValue } from './knob';

export type Edit =
  | { t: 'knob'; id: string; value: KnobValue; variant?: string }
  | { t: 'arch'; option: string; value: string | boolean }
  | { t: 'handle'; id: string; target: number }
  | { t: 'variant'; op: 'add' | 'dup' | 'remove' | 'rename' | 'select'; id: string; name?: string }
  | { t: 'family'; op: 'new' | 'select' | 'rename'; id: string; name?: string };
