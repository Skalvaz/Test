/**
 * Kanca bileşenleri (docs/KANCALAR.md §C): mühür satırları (bölüm öncesi,
 * Duraklat, Kazandın), HUD'daki mühür rozeti ve "tuttu" uçuşu, kandil
 * çipi ve uçan kandiller. Saf DOM; yalnız transform/opacity canlandırılır.
 */
import { h, egri } from './dom';
import { muhurSvg, kandilSvg } from './ikonlar';
import { MK } from './metinler';
import type { Baglam } from './cekirdek';
import type { MuhurVM } from './tipler';

type Nokta = { x: number; y: number };

// ─────────────────────── Mühür satırları ───────────────────────

/**
 * Üç mühür satırı (KANCALAR §C.2): [22 px mum mühür] [KADEME] [koşul].
 * `durumlu`: Duraklat (§C.4) — koşulun altında anlık durum yazısı.
 */
export function muhurListesi(liste: readonly MuhurVM[], o: { durumlu?: boolean; ustaEli?: boolean; sinif?: string } = {}): HTMLElement {
  return h(
    'div',
    { s: `f-muhur-liste${o.durumlu ? ' f-durumlu' : ''}${o.sinif ? ` ${o.sinif}` : ''}`, role: 'list', 'aria-label': MK.muhurler },
    liste.map((m) => {
      const durum = m.basili ? 'basili' : (m.durum ?? null);
      const yazi = o.durumlu && durum ? (o.ustaEli && !m.basili ? MK.ustaEliMuhur : MK.durum[durum]) : null;
      return h(
        'div',
        {
          s: `f-muhur-satir f-k-${m.kademe}${m.basili ? ' f-basili' : ''}${m.durum ? ` f-d-${m.durum}` : ''}`,
          role: 'listitem',
          'aria-label': `${MK.kademe[m.kademe]} mührü: ${m.metin}${m.basili ? `, ${MK.durum.basili}` : yazi ? `, ${yazi}` : ''}`,
        },
        h('span', { s: 'f-muhur-yuva' }, muhurSvg(m.kademe, m.basili || m.durum === 'tuttu')),
        h('span', { s: 'f-muhur-kademe', t: MK.kademeBuyuk[m.kademe] }),
        h('span', { s: 'f-muhur-metin' }, h('span', { t: m.metin }), yazi ? h('small', { s: 'f-muhur-durum', t: yazi }) : null),
      );
    }),
  );
}

// ─────────────────────── HUD rozeti ───────────────────────

/**
 * Duraklat düğmesinin sağ üst köşesine yapışık 38×16 px hap (§C.3): üç
 * nokta. Basılı (önceki deneme) dolu kırmızı mum; bu denemede tuttu dolu +
 * parıltı; bekliyor/sonda boş halka; korunuyor ince altın halka; bozuldu
 * boş + gri çizgi.
 */
export class MuhurRozeti {
  readonly el: HTMLElement;
  private noktalar: HTMLElement[];
  private liste: MuhurVM[] = [];

  constructor() {
    this.noktalar = [0, 1, 2].map(() => h('i', { s: 'f-mr-nokta' }));
    this.el = h('span', { s: 'f-muhur-rozet', role: 'img' }, this.noktalar);
  }

  guncelle(liste: readonly MuhurVM[], ucusta: ReadonlySet<number> = new Set()): void {
    this.liste = liste.map((x) => ({ ...x }));
    let tutan = 0;
    this.noktalar.forEach((n, i) => {
      const m = liste[i];
      const d = !m ? 'bekliyor' : m.basili ? 'basili' : (m.durum ?? 'bekliyor');
      // Uçuş sürerken nokta boş kalır; damgayla dolar.
      n.className = `f-mr-nokta f-mr-${ucusta.has(i) ? 'bekliyor' : d}`;
      if (m && (m.basili || m.durum === 'tuttu')) tutan++;
    });
    this.el.setAttribute('aria-label', MK.rozetEtiket(tutan));
  }

  /** Noktanın merkezi (arayüz köküne göre CSS px). */
  noktaKonumu(i: number, kok: HTMLElement): Nokta | null {
    const n = this.noktalar[i];
    if (!n || !n.isConnected) return null;
    const r = n.getBoundingClientRect();
    const k = kok.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left - k.left + r.width / 2, y: r.top - k.top + r.height / 2 };
  }

  /** Nokta damgası: ölçek 1 → 1,4 → 1 (yay). */
  damgala(i: number): void {
    const n = this.noktalar[i];
    if (!n) return;
    const m = this.liste[i];
    n.className = `f-mr-nokta f-mr-${m?.basili ? 'basili' : 'tuttu'} f-mr-damga`;
  }
}

/**
 * "Tuttu" uçuşu (§C.3): kaynakta 28 px mum mühür belirir (120 ms), Bezier
 * 600 ms `inOutCubic` ile hedefe uçar. Hareketi azaltta uçmaz. Kare başına
 * bellek ayırmaz (yalnız transform yazılır).
 */
export function muhurUcur(b: Baglam, kademe: string, kaynak: Nokta, hedef: Nokta): Promise<void> {
  if (b.az()) return Promise.resolve();
  const el = h('span', { s: 'f-muhur-ucan', 'aria-hidden': 'true' }, muhurSvg(kademe, true));
  el.style.transform = `translate(${kaynak.x}px, ${kaynak.y}px) scale(0.2)`;
  b.ustKatman.appendChild(el);
  // Kontrol noktası: iki noktanın ortasının yukarısı (yay).
  const kx = (kaynak.x + hedef.x) / 2 + (hedef.x < kaynak.x ? 40 : -40);
  const ky = Math.min(kaynak.y, hedef.y) - 90;
  return new Promise((coz) => {
    const t0 = performance.now();
    const BELIR = 120;
    const UC = 600;
    const adim = (t: number) => {
      const g = t - t0;
      if (g < BELIR) {
        const u = egri.outBack(g / BELIR);
        el.style.transform = `translate(${kaynak.x}px, ${kaynak.y}px) scale(${(0.2 + 0.8 * u).toFixed(3)})`;
        requestAnimationFrame(adim);
        return;
      }
      const u = Math.min(1, (g - BELIR) / UC);
      const e = egri.inOutCubic(u);
      const a = 1 - e;
      const x = a * a * kaynak.x + 2 * a * e * kx + e * e * hedef.x;
      const y = a * a * kaynak.y + 2 * a * e * ky + e * e * hedef.y;
      // 28 px → 8 px nokta
      const s = 1 - 0.68 * e;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
      if (u < 1) requestAnimationFrame(adim);
      else {
        el.remove();
        coz();
      }
    };
    requestAnimationFrame(adim);
  });
}

/** Rozetin üstünde 900 ms "Kalfa mührü!" etiketi (alt bantta). */
export function muhurEtiketi(b: Baglam, metin: string, konum: Nokta): void {
  const el = h('span', { s: 'f-muhur-etiket', role: 'status', t: metin, css: { left: `${Math.round(konum.x)}px`, top: `${Math.round(konum.y)}px` } });
  b.ustKatman.appendChild(el);
  b.duyur(metin);
  setTimeout(() => el.remove(), b.az() ? 900 : 1100);
}

// ─────────────────────── Kandil ───────────────────────

/** Kandil hapı: ikon + sayı (kazanç şeridi, panel başlığı). */
export function kandilHapi(n: number, sinif = ''): { el: HTMLElement; sayi: HTMLElement; ikon: Element } {
  const sayi = h('span', { s: 'f-sayi', t: String(n) });
  const ikon = kandilSvg('f-kandil-ikon');
  const el = h('span', { s: `f-kandil-hap ${sinif}`, 'aria-label': MK.kandilSayisi(n) }, ikon, sayi);
  return { el, sayi, ikon };
}

/**
 * Küçük kandiller kaynaklardan hedefe uçar (Kazandın: yıldız/mühür başına
 * bir kandil). Her kandil vardığında `vardi(i)` çağrılır (sayaç artar).
 */
export function kandilUcur(b: Baglam, kaynaklar: readonly Nokta[], hedef: Nokta, vardi: (i: number) => void, ara = 90, kivilcim = false): Promise<void> {
  if (b.az() || kaynaklar.length === 0) {
    kaynaklar.forEach((_, i) => vardi(i));
    return Promise.resolve();
  }
  const sure = kivilcim ? 450 : 520;
  return new Promise((coz) => {
    let kalan = kaynaklar.length;
    kaynaklar.forEach((k, i) => {
      setTimeout(() => {
        const el = kivilcim ? h('span', { s: 'f-kivilcim-ucan', 'aria-hidden': 'true' }) : h('span', { s: 'f-kandil-ucan', 'aria-hidden': 'true' }, kandilSvg());
        b.ustKatman.appendChild(el);
        const kx = (k.x + hedef.x) / 2 + ((i % 2) * 2 - 1) * (kivilcim ? 18 + (i % 3) * 14 : 30);
        const ky = Math.min(k.y, hedef.y) - (kivilcim ? 70 : 50);
        const t0 = performance.now();
        const adim = (t: number) => {
          const u = Math.min(1, (t - t0) / sure);
          const e = egri.inOutCubic(u);
          const a = 1 - e;
          const x = a * a * k.x + 2 * a * e * kx + e * e * hedef.x;
          const y = a * a * k.y + 2 * a * e * ky + e * e * hedef.y;
          el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(0.7 + 0.5 * Math.sin(Math.PI * u)).toFixed(3)})`;
          el.style.opacity = u < 0.08 ? String(u / 0.08) : '1';
          if (u < 1) requestAnimationFrame(adim);
          else {
            el.remove();
            vardi(i);
            if (--kalan === 0) coz();
          }
        };
        requestAnimationFrame(adim);
      }, i * ara);
    });
  });
}

/** Öğenin merkezi (arayüz köküne göre CSS px). */
export function merkez(el: Element, kok: HTMLElement): Nokta {
  const r = el.getBoundingClientRect();
  const k = kok.getBoundingClientRect();
  return { x: r.left - k.left + r.width / 2, y: r.top - k.top + r.height / 2 };
}
