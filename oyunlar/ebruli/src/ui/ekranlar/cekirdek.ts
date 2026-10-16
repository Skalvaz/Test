/**
 * Ekran yöneticisi: tam ekran ya da kart katmanları açar, seçimi Promise
 * ile döndürür. Esc ya da programlı kapatma "geri" değeriyle çözer. Kök
 * işaretçi olaylarını tuvale geçirir; yalnız açık ekranlar dokunulabilir.
 */
import { h, kare } from '../dom';

export interface EkranSecenek<T> {
  /** CSS sınıfı (e-ekran'a ek). */
  sinif: string;
  /** Esc / ekranlariKapat değeri. */
  geri: T;
  /** Arka planı karartan perde (kart ekranları). */
  perde?: boolean;
  /** Perdeye dokunmak geri sayılır. */
  perdeKapatir?: boolean;
}

interface AcikEkran {
  kok: HTMLElement;
  geri: () => void;
}

export class EkranYoneticisi {
  private acik: AcikEkran[] = [];
  /** Hareketi azalt: kapanış animasyonu yok. */
  azalt = false;

  constructor(private readonly kok: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.acik.length) return;
      e.preventDefault();
      this.acik[this.acik.length - 1].geri();
    });
  }

  get sayi(): number {
    return this.acik.length;
  }

  ac<T>(s: EkranSecenek<T>, kur: (bitir: (v: T) => void, kok: HTMLElement) => Node | Node[]): Promise<T> {
    return new Promise<T>((coz) => {
      const kok = h('div', { s: `e-ekran ${s.sinif}${s.perde ? ' e-perdeli' : ''}`, role: 'dialog', 'aria-modal': 'true' });
      let bitti = false;
      const kayit: AcikEkran = { kok, geri: () => bitir(s.geri) };
      const bitir = (v: T): void => {
        if (bitti) return;
        bitti = true;
        this.acik = this.acik.filter((x) => x !== kayit);
        kok.classList.remove('gir');
        kok.classList.add('cik');
        kok.style.pointerEvents = 'none';
        setTimeout(() => kok.remove(), this.azalt ? 0 : 220);
        coz(v);
      };
      if (s.perde && s.perdeKapatir) {
        kok.addEventListener('click', (e) => {
          if (e.target === kok) bitir(s.geri);
        });
      }
      const icerik = kur(bitir, kok);
      if (Array.isArray(icerik)) kok.append(...icerik);
      else kok.appendChild(icerik);
      this.acik.push(kayit);
      this.kok.appendChild(kok);
      void kare().then(() => kok.classList.add('gir'));
      // İlk odaklanabilir düğmeye klavye odağı (masaüstü).
      const ilk = kok.querySelector<HTMLElement>('[data-odak]') ?? null;
      ilk?.focus({ preventScroll: true });
    });
  }

  /** Bütün açık ekranları "geri" değerleriyle kapat. */
  hepsiniKapat(): void {
    for (const e of [...this.acik].reverse()) e.geri();
  }
}
