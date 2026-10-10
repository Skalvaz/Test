/**
 * Klavye kısayollarının odak kuralları (App.onKey; saf, testli).
 *
 * - Metin/sayı kutusu, açılır liste, çok satırlı alan: bütün tuşlar onların
 *   (Esc yalnız odağı bırakır).
 * - Kaydırıcı (range): yalnız gezinme tuşları (oklar, PgUp/PgDn, Home/End)
 *   onun; Ctrl+Z, Esc ve harf kısayolları atölyeye gider (kaydırıcı
 *   sürüklendikten sonra odak orada kalsa da geri al çalışır).
 * - Onay kutusu, radyo, düğme: Boşluk/Enter onların.
 * - Tutamaç okları ve Tab (sonraki modül) yalnız odak tuvaldeyken (body ya
 *   da çizim yüzeyi); bir panel düğmesine odaklanıp ok tuşuna basmak
 *   tasarımı sessizce değiştirmez.
 */

export interface KeyTarget {
  tagName: string;
  type?: string;
  isContentEditable?: boolean;
}

const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);
const PRESS_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/** Tuş odaktaki öğenin kendi işi mi (kısayol olarak işlenmez) */
export function keyOwnedByTarget(t: KeyTarget | null | undefined, key: string): boolean {
  if (!t) return false;
  const tag = t.tagName.toUpperCase();
  if (tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable) return true;
  if (tag === 'INPUT') {
    const type = (t.type ?? 'text').toLowerCase();
    if (type === 'range') return NAV_KEYS.has(key);
    if (PRESS_TYPES.has(type)) return key === ' ' || key === 'Enter';
    return true; // metin, sayı, arama…
  }
  if (tag === 'BUTTON') return key === ' ' || key === 'Enter';
  return false;
}

/** Değiştiricisiz tuş (Ctrl+C kopyalama kesiti açmasın) */
export const plainKey = (e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean => !e.ctrlKey && !e.metaKey && !e.altKey;

/** Odak tuvalde mi (tutamaç okları ve Tab gezintisi yalnız o zaman) */
export function focusOnCanvas(t: unknown, body: unknown, canvas: unknown): boolean {
  return t === null || t === undefined || t === body || t === canvas;
}
