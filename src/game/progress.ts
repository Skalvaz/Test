/** Ders ilerlemesi: oyuncunun tarayıcısında saklanır (erişilemezse sessizce yok sayılır). */

const KEY = 'turbofan-akademi:progress:v1';

export interface LessonProgress {
  stars: number;
  completedAt: number;
}

export type Progress = Record<string, LessonProgress>;

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

export function saveLessonResult(id: string, stars: number): Progress {
  const p = loadProgress();
  const prev = p[id];
  p[id] = { stars: Math.max(stars, prev?.stars ?? 0), completedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* gizli sekme vb. */
  }
  return p;
}

const SETTINGS_KEY = 'turbofan-akademi:settings:v1';

export interface Settings {
  quality: 'low' | 'medium' | 'high';
  volume: number;
  muted: boolean;
  environment: string;
}

export function loadSettings(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Settings>) : {};
  } catch {
    return {};
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* yok say */
  }
}
