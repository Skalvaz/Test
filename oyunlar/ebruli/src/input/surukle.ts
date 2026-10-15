/**
 * `SurukleGirdi` DOM bağlayıcısı (GDD §3.2): Pointer Events (yalnız ilk
 * pointerId, `setPointerCapture`), `touch-action: none`, klavye. Mantık
 * `surukleMantigi.ts`'de (saf, testli); burası yalnız olay çevirisi.
 *
 * Koordinatlar dinlenen öğeye görelidir (CSS px); öğe tuvalle aynı yeri
 * kaplamalıdır (çizici geometrisi tuval koordinatındadır).
 */
import type { SurukleGirdi, SurukleGirdiSecenek } from '../app/sozlesme';
import type { Hamle, Konum } from '../core/types';
import { SurukleMantigi } from './surukleMantigi';

export interface SurukleGirdiTam extends SurukleGirdi {
  /** Saf mantık (test ve hata ayıklama). */
  readonly mantik: SurukleMantigi;
  /** Seçimi ve imleci sessizce bırak (yeni bölüm, ekran değişimi). */
  sifirla(): void;
}

function damlaVar(d: ReturnType<SurukleGirdiSecenek['durum']>, k: Konum): boolean | null {
  if (!d) return null;
  if (k.x < 0 || k.y < 0 || k.x >= d.w || k.y >= d.h) return false;
  const h = d.hucreler[k.y * d.w + k.x];
  return !!h && !h.delik && h.icerik?.tur === 'damla';
}

export function surukleGirdiOlustur(s: SurukleGirdiSecenek): SurukleGirdiTam {
  const el = s.hedef;
  const mantik = new SurukleMantigi(
    {
      geometri: s.geometri,
      secilebilir: (k) => damlaVar(s.durum(), k),
    },
    s.geriCagirim,
  );
  el.style.touchAction = 'none';
  (el.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
  el.style.userSelect = 'none';

  const konum = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = konum(e);
    const onceki = mantik.basili;
    mantik.bas(e.pointerId, p.x, p.y);
    if (!onceki && mantik.basili) {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* yakalama desteklenmiyor */
      }
    }
    if (e.cancelable) e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!mantik.basili) return;
    const p = konum(e);
    mantik.hareket(e.pointerId, p.x, p.y);
    if (e.cancelable) e.preventDefault();
  };
  const up = (e: PointerEvent) => {
    const p = konum(e);
    mantik.birak(e.pointerId, p.x, p.y);
    try {
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    } catch {
      /* yok */
    }
  };
  const cancel = (e: PointerEvent) => mantik.iptalEt(e.pointerId);
  const key = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const a = document.activeElement as HTMLElement | null;
    // Arayüz düğmesi ya da metin alanı odaktaysa klavye onundur.
    if (a && a !== document.body && a !== el && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(a.tagName)) return;
    if (!s.durum()) return;
    if (mantik.tus(e.key)) e.preventDefault();
  };
  const ctx = (e: Event) => e.preventDefault();

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('lostpointercapture', cancel);
  el.addEventListener('contextmenu', ctx);
  window.addEventListener('keydown', key);

  return {
    mantik,
    kipAyarla: (k) => mantik.kipAyarla(k),
    zorunluAyarla: (h: Hamle | null) => mantik.zorunluAyarla(h),
    sifirla: () => mantik.sifirla(),
    yokEt() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.removeEventListener('lostpointercapture', cancel);
      el.removeEventListener('contextmenu', ctx);
      window.removeEventListener('keydown', key);
      mantik.sifirla();
    },
  };
}
