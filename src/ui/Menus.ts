/** Ana menü ve modal pencereler. */

import { GLOSSARY } from '../game/glossary';
import type { LessonResult } from '../game/LessonRunner';
import type { Lesson } from '../game/lessons/types';
import type { Progress, Settings } from '../game/progress';
import { h, icon } from './dom';

export interface MenuCallbacks {
  onLessons(): void;
  onSandbox(): void;
  onGlossary(): void;
  onSettings(): void;
  /** Motor tasarım atölyesi (M5a) */
  onWorkshop(): void;
}

function stars(n: number, max = 3) {
  return h('span', { class: 'stars' }, Array.from({ length: max }, (_, i) =>
    h('span', { class: i < n ? '' : 'off', text: '★' })));
}

export function mainMenu(cb: MenuCallbacks, progress: Progress, lessonCount: number): HTMLElement {
  const done = Object.keys(progress).length;
  const item = (ico: Parameters<typeof icon>[0], title: string, desc: string, badge: string | null, action?: () => void, menu?: string) =>
    h('button', {
      class: `menu-item${action ? '' : ' locked'}`,
      attrs: { type: 'button', ...(action ? {} : { 'aria-disabled': 'true' }), ...(menu ? { 'data-menu': menu } : {}) },
      on: action ? { click: action } : {},
    }, [
      h('span', { class: 'ico' }, [icon(ico, 20)]),
      h('span', {}, [h('div', { class: 't', text: title }), h('div', { class: 'd', text: desc })]),
      badge ? h('span', { class: 'badge', text: badge }) : null,
    ]);

  return h('div', { class: 'overlay clear' }, [
    h('div', { class: 'hero' }, [
      h('div', { class: 'hero-kicker', text: 'Etkileşimli jet motoru eğitimi' }),
      h('h1', { html: 'TURBOFAN<br>AKADEMİ' }),
      h('p', {
        text: 'Gerçek termodinamikle çalışan bir turbofanı parça parça tanı, kokpitten çalıştır, sınırlarına kadar zorla. Her gösterge bir fizik modelinden geliyor.',
      }),
      h('div', { class: 'menu-list' }, [
        item('book', 'Akademi', 'Adım adım dersler: anatomi, çalıştırma, çevrim, arızalar', `${done}/${lessonCount}`, cb.onLessons),
        item('flask', 'Test hücresi', 'Serbest mod: tüm kontroller, uçuş koşulları, arıza enjeksiyonu', null, cb.onSandbox),
        item('info', 'Bilgi bankası', 'N1, EGT, surge, Brayton… terimler ve açıklamalar', null, cb.onGlossary),
        item('gear', 'Ayarlar', 'Grafik kalitesi, ses, ortam', null, cb.onSettings),
        item('wrench', 'Motor tasarım atölyesi', 'Kendi motorunu tasarla: mimari, kompresör, türbin, lüle — sonra test hücresinde çalıştır', 'YENİ', cb.onWorkshop, 'workshop'),
      ]),
      h('div', { class: 'menu-foot', html: 'Sürükle: döndür · Tekerlek: yakınlaş · Çift tık: parçaya odaklan · <kbd>Esc</kbd> menü · <kbd>H</kbd> arayüzü gizle' }),
    ]),
  ]);
}

export function modal(title: string, body: HTMLElement, onClose: () => void, narrow = false): HTMLElement {
  const overlay = h('div', { class: 'overlay' }, [
    h('div', { class: `modal panel${narrow ? ' narrow' : ''}`, attrs: { role: 'dialog', 'aria-label': title } }, [
      h('div', { class: 'modal-head' }, [
        h('h2', { text: title }),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost icon', title: 'Kapat', on: { click: onClose } }, [icon('close')]),
      ]),
      h('div', { class: 'modal-body' }, [body]),
    ]),
  ]);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });
  return overlay;
}

export function lessonSelect(
  lessons: Lesson[],
  progress: Progress,
  onPick: (l: Lesson) => void,
  onClose: () => void,
): HTMLElement {
  const grid = h('div', { class: 'lesson-grid' }, lessons.map((l, i) => {
    const p = progress[l.id];
    return h('button', { class: 'lesson-card', on: { click: () => onPick(l) } }, [
      h('div', { class: 'num', text: `DERS ${i + 1} · ${l.level.toUpperCase()}` }),
      h('div', { class: 't', text: l.title }),
      h('div', { class: 'd', text: l.summary }),
      h('div', { class: 'meta' }, [
        h('span', { text: `~${l.minutes} dk` }),
        h('span', { style: { flex: '1' } }),
        p ? stars(p.stars) : h('span', { text: 'başlanmadı' }),
      ]),
    ]);
  }));
  return modal('Akademi', grid, onClose);
}

export function resultModal(
  r: LessonResult,
  hasNext: boolean,
  cb: { next(): void; retry(): void; list(): void },
): HTMLElement {
  const mins = Math.floor(r.seconds / 60);
  const secs = Math.round(r.seconds % 60);
  const body = h('div', {}, [
    h('div', { class: 'result-stars' }, [stars(r.stars)]),
    h('div', {
      class: 'result-sub',
      html: `<b>${r.lesson.title}</b> tamamlandı · ${mins} dk ${secs} s<br>${
        r.mistakes + r.fails === 0 ? 'Hatasız!' : `${r.mistakes} yanlış cevap · ${r.fails} başarısız deneme`
      }`,
    }),
    h('div', { class: 'result-actions' }, [
      h('button', { class: 'btn', on: { click: cb.retry } }, [icon('restart', 16), 'Tekrarla']),
      h('button', { class: 'btn', on: { click: cb.list } }, ['Ders listesi']),
      hasNext ? h('button', { class: 'btn primary', on: { click: cb.next } }, ['Sonraki ders', icon('play', 14)]) : null,
    ]),
  ]);
  return modal('Ders tamamlandı', body, cb.list, true);
}

export function glossaryModal(onClose: () => void, initial?: string): HTMLElement {
  const entry = h('div', { class: 'glossary-entry' });
  const list = h('div', { class: 'glossary-list' });
  const show = (id: string) => {
    const g = GLOSSARY.find((x) => x.id === id) ?? GLOSSARY[0];
    entry.replaceChildren(
      h('h3', { text: g.term }),
      g.abbr ? h('div', { class: 'abbr', text: g.abbr }) : null as unknown as Node,
      h('div', { html: g.body }),
    );
    for (const b of list.querySelectorAll('button')) b.classList.toggle('sel', b.dataset.id === g.id);
  };
  for (const g of GLOSSARY) {
    const b = h('button', { text: g.term, on: { click: () => show(g.id) } });
    b.dataset.id = g.id;
    list.append(b);
  }
  show(initial ?? GLOSSARY[0].id);
  return modal('Bilgi bankası', h('div', { class: 'glossary' }, [list, entry]), onClose);
}

/** Bölümlü seçici (ayarlar, atölye üst çubuğu) */
export function seg<T extends string>(options: [T, string][], value: T, onPick: (v: T) => void): HTMLElement {
  const el = h('div', { class: 'seg' });
  for (const [v, label] of options) {
    const b = h('button', { text: label, class: v === value ? 'sel' : '' });
    b.addEventListener('click', () => {
      for (const x of el.children) x.classList.remove('sel');
      b.classList.add('sel');
      onPick(v);
    });
    el.append(b);
  }
  return el;
}

export interface SettingsCallbacks {
  onQuality(q: Settings['quality']): void;
  onVolume(v: number): void;
  onMute(m: boolean): void;
  onEnvironment(name: string): void;
}

export function settingsModal(
  current: Settings,
  environments: string[],
  currentEnv: string,
  cb: SettingsCallbacks,
  onClose: () => void,
): HTMLElement {
  const row = (label: string, hint: string, control: HTMLElement) =>
    h('div', { class: 'settings-row' }, [
      h('div', { class: 'l' }, [h('span', { text: label }), h('small', { text: hint })]),
      control,
    ]);

  const vol = h('input', {
    attrs: { type: 'range', min: '0', max: '1', step: '0.01', value: String(current.volume), 'aria-label': 'Ses düzeyi' },
    style: { width: '180px' },
    on: { input: () => cb.onVolume(Number(vol.value)) },
  });
  const envSelect = h('select', {
    class: 'btn',
    style: { width: '180px' },
    on: { change: () => cb.onEnvironment(envSelect.value) },
  }, environments.map((e) => h('option', { text: e, attrs: e === currentEnv ? { value: e, selected: 'true' } : { value: e } })));

  const body = h('div', {}, [
    row('Grafik kalitesi', 'Düşük: dizüstü ve eski ekran kartları için', seg<Settings['quality']>(
      [['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek']], current.quality, cb.onQuality)),
    row('Ortam', 'Gökyüzü, güneş ve ışık', envSelect),
    row('Ses düzeyi', 'Motor sesi tamamen sentezlenir', vol),
    row('Ses', '', seg<'on' | 'off'>([['on', 'Açık'], ['off', 'Kapalı']], current.muted ? 'off' : 'on', (v) => cb.onMute(v === 'off'))),
    h('div', { class: 'section-label', text: 'Kısayollar', style: { marginTop: '18px' } }),
    h('div', {
      class: 'step-body',
      html: `<p><kbd>W</kbd>/<kbd>S</kbd> ya da <kbd>↑</kbd>/<kbd>↓</kbd> gaz kolu (<kbd>Shift</kbd> ile ince ayar) · <kbd>PgUp</kbd> kalkış · <kbd>PgDn</kbd> rölanti<br>
<kbd>1</kbd>–<kbd>7</kbd> kamera açıları · <kbd>C</kbd> kesit · <kbd>D</kbd> motor içi paneli · <kbd>H</kbd> arayüzü gizle · <kbd>M</kbd> ses · <kbd>Esc</kbd> menü</p>`,
    }),
  ]);
  return modal('Ayarlar', body, onClose, true);
}
