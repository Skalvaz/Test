/**
 * Arayüz bağlamı: katmanlar, modal yığını (odak tuzağı, Esc, giriş/çıkış
 * animasyonu), bildirimler, ses ve titreşim köprüsü. Ekran modülleri yalnız
 * bu bağlamı kullanır; `Arayuz` sınıfı bunu kurar.
 */
import { h, kare, sistemAzHareket } from './dom';
import { ikon } from './ikonlar';
import { M } from './metinler';
import type { ArayuzGeriCagirim, Palet } from './tipler';
import type { SesMotoru } from '../app/sozlesme';

export type ArayuzSesi = Parameters<SesMotoru['arayuz']>[0];

export interface ModalSecenek {
  /** Kartın iç içeriği. */
  icerik: HTMLElement;
  /** Şerit başlık. */
  serit?: string;
  seritTur?: 'kirmizi' | 'altin' | 'gece';
  genislik?: 'normal' | 'genis' | 'tam';
  /** Sağ üstte kapat düğmesi. */
  kapatDugmesi?: boolean;
  /** Esc, perdeye dokunma ya da kapat düğmesi. Verilmezse Esc etkisizdir. */
  onIptal?: () => void;
  /** Perdeye dokunmak iptal sayılır mı. */
  perdeKapatir?: boolean;
  /** Ekranın altına yasla (mola balonu gibi). */
  alta?: boolean;
  /** Arkadaki tahta görünsün diye hafif perde. */
  seffaf?: boolean;
  sinif?: string;
  /** Ekran okuyucu başlığı (şerit yoksa). */
  etiket?: string;
  /** Açılış sesi (varsayılan yok: düğme tıkı yeter). */
  ses?: ArayuzSesi | null;
  /**
   * (CAN-REKLAM §13 karar 7) Giriş animasyonu yok: kart ve perde ilk karede
   * yerinde (kapanıp hemen yeniden açılan panel "yerinde kalmış" görünür).
   * Kapanış animasyonu yine oynar.
   */
  girisYok?: boolean;
}

export interface ModalTutamak {
  modal: HTMLElement;
  kart: HTMLElement;
  ic: HTMLElement;
  /** Kapat (animasyonlu). Birden çok çağrı güvenli. `sesli` geriye uyum içindir. */
  kapat(sesli?: boolean): void;
  readonly kapali: boolean;
}

export interface BaglamSecenek {
  kok: HTMLElement;
  ses?: Pick<SesMotoru, 'arayuz'> | null;
  titresim?: ((p: number | number[]) => void) | null;
}

let modalSayaci = 0;

export class Baglam {
  readonly kok: HTMLElement;
  readonly ekranKatmani: HTMLElement;
  readonly hudKatmani: HTMLElement;
  readonly ustKatman: HTMLElement;
  readonly modalKatmani: HTMLElement;
  /**
   * (Fişek ek) HUD'un üstünde, balon/bant/modal katmanlarının altında:
   * çizicinin fişek tuvali buraya eklenir (HUD'un arkasında kalan gök
   * fişekleri). Yalnız HUD açıkken görünür (`f-acik`).
   */
  readonly fisekKatmani: HTMLElement;
  readonly bildirimKatmani: HTMLElement;
  readonly canli: HTMLElement;
  palet: Palet = 'standart';
  hareketiAzalt = false;
  geri: Partial<ArayuzGeriCagirim> = {};
  private sesMotoru: Pick<SesMotoru, 'arayuz'> | null;
  private titresim: ((p: number | number[]) => void) | null;
  private yigin: { t: ModalTutamak; s: ModalSecenek; onceki: Element | null }[] = [];
  private toastSure: ReturnType<typeof setTimeout> | null = null;
  private toastEl: HTMLElement | null = null;
  private tusDinleyici: (e: KeyboardEvent) => void;
  /** Modal açıkken HUD kısayolları kapalıdır. */
  tusBaskasi: ((e: KeyboardEvent) => boolean) | null = null;
  /** (P5) Bildirimin üst konumu (px; oyun ekranında gök bandı). null = varsayılan (alt). */
  toastKonumu: (() => number | null) | null = null;

  constructor(s: BaglamSecenek) {
    this.sesMotoru = s.ses ?? null;
    this.titresim = s.titresim ?? null;
    this.kok = h('div', { s: 'f-kok', 'data-fitil-arayuz': '' });
    this.ekranKatmani = h('div', { s: 'f-ekran-katman' });
    this.hudKatmani = h('div', { s: 'f-hud-katman f-hud' });
    this.fisekKatmani = h('div', { s: 'f-fisek-katman', 'aria-hidden': 'true' });
    this.ustKatman = h('div', { s: 'f-ust-katman' });
    this.modalKatmani = h('div', { s: 'f-modal-katman' });
    this.bildirimKatmani = h('div', { s: 'f-bildirim-katman' });
    this.canli = h('div', { s: 'f-gizli', 'aria-live': 'polite', role: 'status' });
    this.kok.append(this.ekranKatmani, this.hudKatmani, this.fisekKatmani, this.ustKatman, this.modalKatmani, this.bildirimKatmani, this.canli);
    s.kok.appendChild(this.kok);
    this.tusDinleyici = (e) => this.tusa(e);
    document.addEventListener('keydown', this.tusDinleyici);
  }

  /** "Hareketi azalt": ayar ya da sistem tercihi. */
  az(): boolean {
    return this.hareketiAzalt || sistemAzHareket();
  }

  ses(tur: ArayuzSesi): void {
    try {
      this.sesMotoru?.arayuz(tur);
    } catch {
      /* ses isteğe bağlı */
    }
  }

  titret(p: number | number[]): void {
    try {
      this.titresim?.(p);
    } catch {
      /* desteklenmiyor */
    }
  }

  duyur(metin: string): void {
    this.canli.textContent = '';
    this.canli.textContent = metin;
  }

  get modalAcik(): boolean {
    return this.yigin.length > 0;
  }

  // ─────────────────────── Modal ───────────────────────

  modalAc(s: ModalSecenek): ModalTutamak {
    const id = `f-modal-${++modalSayaci}`;
    const perde = h('div', { s: 'f-perde' });
    const ic = h('div', { s: 'f-kart-ic' });
    ic.appendChild(s.icerik);
    const genislik = s.genislik === 'genis' ? ' f-kart-genis' : s.genislik === 'tam' ? ' f-kart-tam' : '';
    const kart = h('div', { s: `f-kart${genislik}`, tabindex: '-1' });
    if (s.serit) {
      const tur = s.seritTur === 'altin' ? ' f-serit-yesil' : s.seritTur === 'gece' ? ' f-serit-gece' : '';
      kart.appendChild(h('div', { s: 'f-serit-yer' }, h('div', { s: `f-serit${tur}` }, h('span', { s: 'f-serit-metin', id: `${id}-b`, t: s.serit }))));
    }
    kart.appendChild(ic);
    if (s.kapatDugmesi && s.onIptal) {
      const k = h('button', { s: 'f-yuvarlak f-kapat-dg', 'aria-label': M.kapat, type: 'button' }, ikon('kapat'));
      k.addEventListener('click', () => s.onIptal?.());
      kart.appendChild(k);
    }
    const modal = h(
      'div',
      {
        s: `f-modal${s.alta ? ' f-modal-alt' : ''}${s.seffaf ? ' f-seffaf' : ''}${s.sinif ? ` ${s.sinif}` : ''}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': s.serit ? `${id}-b` : undefined,
        'aria-label': s.serit ? undefined : (s.etiket ?? undefined),
      },
      perde,
      kart,
    );
    if (s.perdeKapatir && s.onIptal) perde.addEventListener('click', () => s.onIptal?.());
    // Modal açıkken sayfa kaydırması/çift dokunma yakınlaştırması olmasın.
    modal.addEventListener('touchmove', (e) => {
      if (!(e.target as Element).closest('.f-kart-ic, .f-kaydir')) e.preventDefault();
    }, { passive: false });

    let kapali = false;
    const onceki = document.activeElement;
    const t: ModalTutamak = {
      modal,
      kart,
      ic,
      get kapali() {
        return kapali;
      },
      // Kapanış sesi ayrıca çalınmaz: düğme tıkı (Arayuz) yeter.
      kapat: () => {
        if (kapali) return;
        kapali = true;
        const i = this.yigin.findIndex((y) => y.t === t);
        const kayit = i >= 0 ? this.yigin.splice(i, 1)[0] : null;
        modal.classList.remove('f-giris');
        modal.classList.add('f-cikis');
        modal.style.pointerEvents = 'none';
        setTimeout(() => modal.remove(), this.az() ? 30 : 220);
        const hedef = kayit?.onceki as HTMLElement | null;
        if (hedef && typeof hedef.focus === 'function' && document.contains(hedef)) {
          try {
            hedef.focus({ preventScroll: true });
          } catch {
            /* yok say */
          }
        }
      },
    };
    this.yigin.push({ t, s, onceki });
    // Girişsiz: geçişler kapalıyken son hâl (f-giris) hemen; bir kare sonra geçişler geri gelir (kapanış animasyonlu).
    if (s.girisYok) modal.classList.add('f-giris', 'f-hemen');
    this.modalKatmani.appendChild(modal);
    if (s.ses) this.ses(s.ses);
    void kare().then(() => {
      modal.classList.remove('f-hemen');
      if (kapali) return;
      modal.classList.add('f-giris');
      // Belirtilmiş birincil eylem yoksa kartın kendisi odaklanır (dokunmatikte
      // ilk anahtarın üstünde odak halkası belirmesin; klavye Tab ile girer).
      const odak = (kart.querySelector('[data-odak]') ?? kart) as HTMLElement;
      try {
        odak?.focus({ preventScroll: true });
      } catch {
        /* yok say */
      }
    });
    return t;
  }

  /** Bütün modalları kapatır (programlı ekran değişimi). */
  modallariKapat(): void {
    for (const y of [...this.yigin].reverse()) {
      y.s.onIptal?.();
      y.t.kapat();
    }
  }

  private tusa(e: KeyboardEvent): void {
    const ust = this.yigin[this.yigin.length - 1];
    if (ust) {
      if (e.key === 'Escape') {
        if (ust.s.onIptal) {
          e.preventDefault();
          ust.s.onIptal();
        }
        return;
      }
      if (e.key === 'Tab') this.odakTuzagi(e, ust.t.modal);
      return;
    }
    this.tusBaskasi?.(e);
  }

  private odakTuzagi(e: KeyboardEvent, modal: HTMLElement): void {
    const ogeler = Array.from(
      modal.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]'),
    ).filter((o) => o.offsetParent !== null || o === document.activeElement);
    if (ogeler.length === 0) return;
    const ilk = ogeler[0];
    const son = ogeler[ogeler.length - 1];
    const aktif = document.activeElement;
    if (e.shiftKey && (aktif === ilk || !modal.contains(aktif))) {
      e.preventDefault();
      son.focus();
    } else if (!e.shiftKey && (aktif === son || !modal.contains(aktif))) {
      e.preventDefault();
      ilk.focus();
    }
  }

  // ─────────────────────── Bildirim ───────────────────────

  toast(metin: string, ms = 1900): void {
    if (this.toastEl) {
      const eski = this.toastEl;
      eski.classList.add('f-cikis');
      setTimeout(() => eski.remove(), 220);
    }
    if (this.toastSure) clearTimeout(this.toastSure);
    const t = h('div', { s: 'f-toast', role: 'status', t: metin });
    const ust = this.toastKonumu?.() ?? null;
    if (ust !== null) {
      t.style.top = `${ust}px`;
      t.style.bottom = 'auto';
    }
    this.bildirimKatmani.appendChild(t);
    this.toastEl = t;
    this.duyur(metin);
    void kare().then(() => t.classList.add('f-giris'));
    this.toastSure = setTimeout(() => {
      t.classList.add('f-cikis');
      t.classList.remove('f-giris');
      setTimeout(() => t.remove(), 260);
      if (this.toastEl === t) this.toastEl = null;
    }, ms);
  }

  yokEt(): void {
    document.removeEventListener('keydown', this.tusDinleyici);
    this.kok.remove();
  }
}

/** Bir düğme üretir. tur: 'birincil' | 'ikincil' | 'tehlike' | 'metin'. */
export function dugme(
  metin: string,
  tur: 'birincil' | 'ikincil' | 'tehlike' | 'metin',
  tikla: () => void,
  o: { ikon?: Parameters<typeof ikon>[0]; buyuk?: boolean; odak?: boolean; sinif?: string; etiket?: string } = {},
): HTMLButtonElement {
  const d = h(
    'button',
    {
      type: 'button',
      s: `f-dg f-dg-${tur}${o.buyuk ? ' f-dg-buyuk' : ''}${o.sinif ? ` ${o.sinif}` : ''}`,
      'data-odak': o.odak ? '' : undefined,
      'aria-label': o.etiket,
    },
    o.ikon ? ikon(o.ikon) : null,
    h('span', { t: metin }),
  );
  d.addEventListener('click', tikla);
  return d;
}

/** Tek seferlik çözülen söz + seçim yardımcısı. */
export function secimSozu<T>(): { soz: Promise<T>; sec: (d: T) => boolean; secildi: () => boolean } {
  let coz!: (d: T) => void;
  let bitti = false;
  const soz = new Promise<T>((r) => (coz = r));
  return {
    soz,
    sec: (d: T) => {
      if (bitti) return false;
      bitti = true;
      coz(d);
      return true;
    },
    secildi: () => bitti,
  };
}
