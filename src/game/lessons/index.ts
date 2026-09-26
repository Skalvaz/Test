import { anatomy } from './l1-anatomy';
import { start } from './l2-start';
import { brayton } from './l3-brayton';
import { fadec } from './l4-fadec';
import { surge } from './l5-surge';
import { altitude } from './l6-altitude';
import { birdStrike } from './l7-birdstrike';
import type { Lesson } from './types';

export const LESSONS: Lesson[] = [anatomy, start, brayton, fadec, surge, altitude, birdStrike];
