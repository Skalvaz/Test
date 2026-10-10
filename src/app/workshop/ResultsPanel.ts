/**
 * Atölyenin sonuç paneli (M5a §6.6, `.side-right`): sonuç kartı (delta
 * kıyas noktasına göre; `data-action="pin-baseline"`), sınır çubukları
 * (`data-gauge`), kütle şeridi, uyarılar (`data-warning` +
 * `data-severity`; eylemler `show-part | glossary | lesson | remedy`),
 * görev kartı, ayrıntılar (istasyon tablosu) ve alt şerit
 * (`data-action="run-in-cell"`).
 *
 * Dar ekranda (≤ 1000 px) panel gizlenir; `summaryStrip` üst çubuğun
 * altında tek satır özet (itki, TSFC, kütle, uyarı sayısı) gösterir.
 *
 * Hata durumunda son geçerli tasarım gösterilir ("son geçerli" rozeti).
 */

import type { Finding } from '../../design/core/rules';
import { diffSummary, explainDelta, fmtNum, fmtSci, type DesignSummary, type LimitGauge } from '../../design/summary';
import type { WorkshopStore, WorkshopState } from '../../workshop/store';
import { h, icon } from '../../ui/dom';
import { PART_TAGS, partsOfModule, type ModuleRef, type PartTag } from '../../design/partsMap';
import type { EngineTraits } from '../../design/traits';
import type { StationId } from '../../sim/design';
import { chipDeltas, ROW_LABEL } from './KnobField';
import { GoalCard } from './GoalCard';
import { ATTR } from './selectors';

export interface ResultsCallbacks {
  onRunInCell(): void;
  /** Parçaları 3B'de vurgula (null: kaldır); `transient`: kısa süre sonra kendiliğinden kalkar */
  onHighlight(tags: string[] | null, transient?: boolean): void;
  openGlossary(id: string): void;
  openLesson(id: string): void;
}

/** Kütle şeridinin dilim adları ve renkleri */
export const MASS_NAMES: Record<string, string> = {
  fan: 'Fan', lpc: 'LPC', booster: 'Booster', hpc: 'HPC', combustor: 'Yanma odası', hpt: 'HPT', lpt: 'LPT',
  nozzle: 'Lüle', afterburner: 'Art yakıcı', mixer: 'Karıştırıcı', inlet: 'Giriş', nacelle: 'Kaporta', casing: 'Gövde',
  propeller: 'Pervane', gearbox: 'Redüktör', shafts: 'Miller', accessories: 'Aksesuarlar', shaft: 'Çıkış mili', bypassDuct: 'Baypas kanalı',
  externals: 'Dış donanım', ducts: 'Kanallar', frames: 'Taşıyıcı çerçeveler', other: 'Diğer',
  // Entegrasyon (dalga 2): şablon kütle kalemlerinin eksik adları (şeritte İngilizce anahtar görünüyordu)
  exhaust: 'Egzoz', fanCase: 'Fan muhafazası', jetPipe: 'Jet borusu', outputShaft: 'Çıkış mili',
};
const MASS_COLORS = ['#2ee6d6', '#3d9bff', '#8b7bff', '#ff5cf0', '#ff7a45', '#ffb020', '#d9e36b', '#3ddc84', '#7b8a99', '#c47bff', '#4fd1ff', '#ff4d3d'];

const SEV_LABEL: Record<Finding['severity'], string> = { warning: 'Kırmızı', caution: 'Amber', info: 'Bilgi' };

/** Kütle kalemi → 3B parça etiketleri: kalem adları PartTag değil (lpc, jetPipe, externals…) */
const MASS_ALIAS: Record<string, PartTag[]> = {
  casing: ['casing', 'engineCase'],
  jetPipe: ['exhaust'],
  externals: ['accessories'],
  accessories: ['accessories'],
  shaft: ['outputShaft'],
  frames: ['engineCase'],
  ducts: ['bypassDuct'],
};
const MODULE_KEYS = new Set<string>(['inlet', 'fan', 'lpc', 'hpc', 'combustor', 'hpt', 'lpt', 'mixer', 'afterburner', 'nozzle', 'propeller']);

export function massPartTags(key: string, traits: EngineTraits): PartTag[] {
  if (MASS_ALIAS[key]) return MASS_ALIAS[key];
  if (MODULE_KEYS.has(key)) return partsOfModule(key as ModuleRef, traits);
  return (PART_TAGS as string[]).includes(key) ? [key as PartTag] : [];
}

/**
 * Sınır çubuğu değeri: büyük sayılar (AN² ~2·10⁷ m²·rpm²) bilimsel
 * gösterimde; "22.664.252" okunmuyor ve satıra sığmıyordu.
 */
export function fmtGaugeValue(v: number, digits: number): string {
  return Number.isFinite(v) && Math.abs(v) >= 1e5 ? fmtSci(v, 2) : fmtNum(v, digits);
}

/** Baypas oranı yalnız baypaslı motorda anlamlı (turbojet, turboşaft, turboprop: 0) */
export const hasBypass = (sm: Pick<DesignSummary, 'bpr'>): boolean => Number.isFinite(sm.bpr) && sm.bpr > 0;

/** Ayrıntılar tablosunun istasyonları (§6.6 madde 6) */
export const DETAIL_STATIONS: readonly StationId[] = ['2', '13', '21', '25', '3', '4', '45', '5', '9'];

/** İstasyon satırları: akışı olmayan (ör. baypassız motorda 13) atlanır */
export function stationRows(st: Partial<Record<StationId, { T: number; P: number; W: number }>>): { id: StationId; T: number; P: number; W: number }[] {
  return DETAIL_STATIONS.flatMap((id) => {
    const s = st[id];
    return s && Number.isFinite(s.T) && Number.isFinite(s.P) && s.W > 1e-6 ? [{ id, T: s.T, P: s.P, W: s.W }] : [];
  });
}

export class ResultsPanel {
  readonly el: HTMLDivElement;
  /** Dar ekran özet şeridi */
  readonly summaryStrip: HTMLDivElement;
  private card: HTMLDivElement;
  private gauges: HTMLDivElement;
  private mass: HTMLDivElement;
  private warnings: HTMLDivElement;
  private details: HTMLDetailsElement;
  private detailsBody: HTMLDivElement;
  private body: HTMLDivElement;
  private foot: HTMLDivElement;
  /** Önceki güncellemedeki Uzman kipi: Ayrıntılar yalnız kipe geçişte açılır */
  private expertWas = false;
  /** "Neden?" açıklamasının kıyas çifti (tasarım değişince yeniden yazılır) */
  private explainFor: { a: DesignSummary; b: DesignSummary } | null = null;
  private redNote: HTMLDivElement;
  private explain: HTMLDivElement;
  private badge: HTMLSpanElement;
  private goal: GoalCard;
  private key = '';
  private warnKey = '';
  private gaugeKey = '';

  constructor(
    private store: WorkshopStore,
    private cb: ResultsCallbacks,
  ) {
    this.card = h('div', { class: 'ws-result-card' });
    this.explain = h('div', { class: 'ws-explain hidden' });
    this.gauges = h('div', { class: 'ws-gauges' });
    this.mass = h('div', { class: 'ws-mass' });
    this.warnings = h('div', { class: 'ws-warnings' });
    this.goal = new GoalCard(cb.openLesson);
    this.detailsBody = h('div', { class: 'ws-details-body' });
    // Oyuncu açınca içerik görünür alana kayar: panelin dibinde açılan
    // bölüm "Test hücresinde çalıştır" şeridinin altında kalmasın
    const summary = h('summary', {
      text: 'Ayrıntılar',
      on: {
        click: () => {
          if (this.details.open) return;
          requestAnimationFrame(() => {
            // Bölüm panelin son öğesi: sığıyorsa panelin dibine (tamamı
            // görünür), sığmıyorsa başlığı üste
            const b = this.body;
            if (this.details.offsetHeight <= b.clientHeight) b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' });
            else this.details.scrollIntoView({ block: 'start', behavior: 'smooth' });
          });
        },
      },
    });
    this.details = h('details', { class: 'ws-details' }, [summary, this.detailsBody]);
    this.redNote = h('div', { class: 'ws-red-note hidden' });
    this.badge = h('span', { class: 'ws-lastgood hidden', text: 'son geçerli tasarım' });
    this.foot = h('div', { class: 'ws-run' }, [
      h('button', {
        class: 'btn primary ws-run-btn',
        attrs: { type: 'button', [ATTR.action]: 'run-in-cell' },
        on: { click: () => cb.onRunInCell() },
      }, [icon('play', 14), 'Test hücresinde çalıştır']),
      this.redNote,
    ]);
    this.el = h('div', { class: 'side-right panel ws-results hidden' }, [
      h('div', { class: 'panel-head' }, [
        h('span', { class: 'panel-title', text: 'Sonuç' }),
        this.badge,
        h('span', { class: 'spacer' }),
        h('button', {
          class: 'btn small ghost',
          text: 'Kıyas olarak sabitle',
          title: 'Değişim çipleri bu tasarıma göre hesaplanır',
          attrs: { type: 'button', [ATTR.action]: 'pin-baseline' },
          on: {
            click: () => (this.store.state.project.baseline ? this.store.unpinBaseline() : this.store.pinBaseline()),
          },
        }),
      ]),
      (this.body = h('div', { class: 'scroll panel-body ws-results-body', on: { scroll: () => this.refreshMore() } }, [
        this.card,
        this.explain,
        h('div', { class: 'section-label', text: 'Sınırlar' }),
        this.gauges,
        h('div', { class: 'section-label', text: 'Kütle' }),
        this.mass,
        this.warnings,
        this.goal.el,
        this.details,
      ])),
      this.foot,
    ]);
    this.summaryStrip = h('div', { class: 'ws-summary hidden', attrs: { 'aria-live': 'polite' } });
  }

  update(s: Readonly<WorkshopState> = this.store.state): void {
    if (!s.last || (s.phase !== 'edit' && s.phase !== 'wizard')) return;
    const L = s.last;
    const sm = L.summary;
    const key = `${s.phase}|${s.project.expert}|${s.dragging}|${JSON.stringify(sm)}|${JSON.stringify(s.compare)}|${!!s.project.baseline}`;
    if (key !== this.key) {
      this.key = key;
      this.renderCard(sm, s.compare);
      // Açık "Neden?" açıklaması eski çifti anlatmasın: yeni çiftle yeniden
      // yazılır; kıyas kalktıysa (çip yok) gizlenir
      if (this.explainFor) {
        if (s.compare && s.compare !== sm) this.showExplain(s.compare, sm);
        else this.hideExplain();
      }
      this.renderMass(sm, L.built.traits);
      this.renderDetails(sm, L.built.sized.point.stations);
      const pin = this.el.querySelector(`[${ATTR.action}="pin-baseline"]`);
      if (pin) pin.textContent = s.project.baseline ? 'Kıyası kaldır' : 'Kıyas olarak sabitle';
    }
    const gk = `${s.project.expert}|${JSON.stringify(L.gauges)}`;
    if (gk !== this.gaugeKey) {
      this.gaugeKey = gk;
      this.renderGauges(L.gauges, s.project.expert);
    }
    const wk = JSON.stringify(L.findings.map((f) => [f.id, f.severity, f.title, f.remedy?.value]));
    if (wk !== this.warnKey) {
      this.warnKey = wk;
      this.renderWarnings(L.findings);
    }
    this.goal.update(s);
    this.badge.classList.toggle('hidden', !s.error);
    // Uzman kipine geçişte bir kez açılır; oyuncu sonra kapatabilir
    if (s.project.expert && !this.expertWas) this.details.open = true;
    this.expertWas = s.project.expert;
    const red = L.findings.filter((f) => f.severity === 'warning').length;
    this.redNote.textContent = red ? `${red} kırmızı uyarı: test hücresinde göreceksin.` : '';
    this.redNote.classList.toggle('hidden', red === 0);
    this.foot.classList.toggle('hidden', s.phase !== 'edit');
    // Dar ekran özeti
    const nWarn = L.findings.filter((f) => f.severity !== 'info').length;
    const out = sm.output === 'thrust' ? `İtki ${fmtNum(sm.thrust / 1e3, 1)} kN` : `Güç ${fmtNum((sm.shaftPower ?? 0) / 1e3, 0)} kW`;
    const fuel = sm.tsfc !== undefined ? `TSFC ${fmtNum(sm.tsfc, 2)}` : sm.sfc !== undefined ? `SFC ${fmtNum(sm.sfc, 0)}` : '';
    this.summaryStrip.replaceChildren(
      h('span', { text: out }),
      h('span', { text: fuel }),
      h('span', { text: `Kütle ${fmtNum(sm.mass, 0)} kg` }),
      h('span', { class: nWarn ? 'warn' : 'ok', text: nWarn ? `${nWarn} uyarı` : 'Uyarı yok' }),
    );
    this.refreshMore();
  }

  /** Altta görünmeyen içerik var: alt şeridin üstünde gölge (kaydırma ipucu) */
  private refreshMore(): void {
    const b = this.body;
    this.foot.classList.toggle('has-more', b.scrollTop + b.clientHeight < b.scrollHeight - 4);
  }

  private renderCard(sm: DesignSummary, cmp: DesignSummary | undefined): void {
    const deltas = cmp ? diffSummary(cmp, sm) : [];
    const dOf = (k: string) => deltas.find((d) => d.key === k);
    const row = (label: string, value: string, unit: string, k?: string) => {
      const d = k ? dOf(k) : undefined;
      const chip = d && Math.abs(d.rel) > 5e-4
        ? h('button', {
            class: `ws-delta ${d.better === true ? 'up' : d.better === false ? 'down' : 'neutral'}`,
            text: d.text.replace(/^[^+−\-0-9]*/, ''),
            title: 'Neden? (tıkla)',
            attrs: { type: 'button' },
            on: { click: () => this.showExplain(cmp!, sm) },
          })
        : h('span', { class: 'ws-delta none' });
      return h('div', { class: 'ws-row' }, [
        h('span', { class: 'l', text: label }),
        h('span', { class: 'v mono' }, [value, h('small', { text: unit ? ` ${unit}` : '' })]),
        chip,
      ]);
    };
    const rows: HTMLElement[] = [];
    if (sm.output === 'thrust') {
      rows.push(row('İtki', fmtNum(sm.thrust / 1e3, 1), 'kN', 'thrust'));
      if (sm.thrustWet !== undefined) rows.push(row('İtki (art yakıcı)', fmtNum(sm.thrustWet / 1e3, 1), 'kN', 'thrustWet'));
      if (sm.tsfc !== undefined) rows.push(row('TSFC', fmtNum(sm.tsfc, 2), 'g/kN·s', 'tsfc'));
    } else {
      rows.push(row('Mil gücü', fmtNum((sm.shaftPower ?? 0) / 1e3, 0), 'kW', 'shaftPower'));
      if (sm.sfc !== undefined) rows.push(row('SFC', fmtNum(sm.sfc, 0), 'g/kW·h', 'sfc'));
      if (sm.output === 'propeller') rows.push(row('İtki (durağan)', fmtNum(sm.thrust / 1e3, 1), 'kN', 'thrust'));
    }
    rows.push(row('Kütle', fmtNum(sm.mass, 0), 'kg', 'mass'));
    if (sm.thrustToWeight !== undefined) rows.push(row('İtki/ağırlık', fmtNum(sm.thrustToWeight, 2), '', 'thrustToWeight'));
    if (sm.powerToWeight !== undefined) rows.push(row('Güç/ağırlık', fmtNum(sm.powerToWeight, 2), 'kW/kg', 'powerToWeight'));
    rows.push(row('Çap × boy', `${fmtNum(sm.diameter, 2)} × ${fmtNum(sm.length, 2)}`, 'm', 'diameter'));
    if (hasBypass(sm)) rows.push(row('OPR · BPR', `${fmtNum(sm.opr, 1)} · ${fmtNum(sm.bpr, 2)}`, ''));
    else rows.push(row('OPR', fmtNum(sm.opr, 1), '', 'opr'));
    this.card.replaceChildren(...rows);
    const top = chipDeltas(deltas, 3);
    this.card.title = top.length ? `Kıyasa göre: ${top.map((d) => d.text).join(' · ')}` : '';
  }

  private showExplain(a: DesignSummary, b: DesignSummary): void {
    const lines = explainDelta(a, b);
    if (!lines.length) return this.hideExplain();
    this.explainFor = { a, b };
    this.explain.replaceChildren(...lines.map((l) => h('p', { text: l })));
    this.explain.classList.remove('hidden');
  }

  private hideExplain(): void {
    this.explainFor = null;
    this.explain.replaceChildren();
    this.explain.classList.add('hidden');
  }

  private renderGauges(gs: LimitGauge[], expert: boolean): void {
    const list = gs.filter((g) => expert || g.level !== 'expert');
    this.gauges.replaceChildren(
      ...list.map((g) => {
        // Çubuk ölçeği: sınırın ötesine %30 pay
        const lim = g.warning ?? g.caution;
        const above = g.dir === 'above';
        const max = above ? lim * 1.3 : Math.max(g.value, g.caution) * 1.3;
        const frac = (v: number) => Math.min(1, Math.max(0, v / (max || 1)));
        const state = above
          ? g.warning !== undefined && g.value >= g.warning
            ? 'red'
            : g.value >= g.caution
              ? 'amber'
              : 'green'
          : g.warning !== undefined && g.value <= g.warning
            ? 'red'
            : g.value <= g.caution
              ? 'amber'
              : 'green';
        // Sayım (kademe "adet") tam sayı yazılır: "6,00 adet" değil
        const digits = (g.unit === 'adet' && Number.isInteger(g.value)) || Math.abs(g.value) >= 100 ? 0 : Math.abs(g.value) >= 10 ? 1 : 2;
        const bar = h('div', { class: 'ws-gauge-bar' }, [
          h('i', { class: `fill ${state}`, style: { width: `${(frac(g.value) * 100).toFixed(1)}%` } }),
          h('i', { class: 'mark amber', style: { left: `${(frac(g.caution) * 100).toFixed(1)}%` } }),
          g.warning !== undefined ? h('i', { class: 'mark red', style: { left: `${(frac(g.warning) * 100).toFixed(1)}%` } }) : null,
        ]);
        return h('button', {
          class: `ws-gauge ${state}`,
          attrs: { type: 'button', [ATTR.gauge]: g.id },
          title: `${g.label}: ${above ? 'üst' : 'alt'} sınır ${fmtGaugeValue(g.caution, digits)}${g.warning !== undefined ? ` / ${fmtGaugeValue(g.warning, digits)}` : ''} ${g.unit}`,
          on: {
            click: () => this.cb.onHighlight(g.parts),
            mouseleave: () => this.cb.onHighlight(null),
          },
        }, [
          h('span', { class: 'l', text: g.label }),
          h('span', { class: 'v mono', text: `${fmtGaugeValue(g.value, digits)} ${g.unit}` }),
          bar,
        ]);
      }),
    );
  }

  private renderMass(sm: DesignSummary, traits: EngineTraits): void {
    const parts = Object.entries(sm.massParts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = parts.reduce((a, [, v]) => a + v, 0) || 1;
    const bar = h('div', { class: 'ws-mass-bar' }, parts.map(([k, v], i) =>
      h('i', {
        title: `${MASS_NAMES[k] ?? k}: ${fmtNum(v, 0)} kg (%${fmtNum((v / total) * 100, 0)})`,
        style: { width: `${((v / total) * 100).toFixed(2)}%`, background: MASS_COLORS[i % MASS_COLORS.length] },
        on: {
          mouseenter: () => {
            const tags = massPartTags(k, traits);
            this.cb.onHighlight(tags.length ? tags : null);
          },
          mouseleave: () => this.cb.onHighlight(null),
        },
      }),
    ));
    const legend = h('div', { class: 'ws-mass-legend' }, parts.slice(0, 5).map(([k, v], i) =>
      h('span', {}, [h('i', { style: { background: MASS_COLORS[i % MASS_COLORS.length] } }), `${MASS_NAMES[k] ?? k} ${fmtNum(v, 0)}`]),
    ));
    this.mass.replaceChildren(bar, legend);
  }

  private renderWarnings(fs: Finding[]): void {
    const visible = fs;
    const n = visible.filter((f) => f.severity !== 'info').length;
    const head = h('div', { class: 'section-label', text: `Uyarılar (${n})` });
    if (!visible.length) {
      this.warnings.replaceChildren(head, h('div', { class: 'ws-ok', text: 'Uyarı yok: tasarım sınırlar içinde.' }));
      return;
    }
    this.warnings.replaceChildren(
      head,
      ...visible.map((f) => {
        const acts: (HTMLElement | null)[] = [
          f.tags.length
            ? h('button', {
                class: 'ws-link',
                text: 'Parçayı göster',
                attrs: { type: 'button', [ATTR.action]: 'show-part' },
                // Kısa süreli vurgu (App süreyle ve seçim değişince kaldırır)
                on: { click: () => this.cb.onHighlight(f.tags, true) },
              })
            : null,
          f.glossary
            ? h('button', { class: 'ws-link', text: 'Sözlük', attrs: { type: 'button', [ATTR.action]: 'glossary' }, on: { click: () => this.cb.openGlossary(f.glossary!) } })
            : null,
          f.lesson
            ? h('button', { class: 'ws-link', text: 'Ders', attrs: { type: 'button', [ATTR.action]: 'lesson' }, on: { click: () => this.cb.openLesson(f.lesson!) } })
            : null,
          f.remedy
            ? h('button', {
                class: 'btn small ws-remedy',
                text: `Düzelt: ${f.remedy.label}`,
                title: 'Önerilen değere getirir (geri alınabilir)',
                attrs: { type: 'button', [ATTR.action]: 'remedy' },
                on: { click: () => this.store.applyRemedy(f) },
              })
            : null,
        ];
        return h('div', {
          class: `callout ws-warning ${f.severity === 'warning' ? 'red' : f.severity === 'caution' ? 'warn' : 'info'}`,
          attrs: { [ATTR.warning]: f.id, [ATTR.severity]: f.severity },
        }, [
          h('div', { class: 'ws-warning-head' }, [h('span', { class: 'sev', text: SEV_LABEL[f.severity] }), h('b', { text: f.title })]),
          h('p', { text: f.text }),
          f.fix ? h('p', { class: 'fix', text: f.fix }) : null,
          h('div', { class: 'ws-warning-acts' }, acts),
        ]);
      }),
    );
  }

  private renderDetails(sm: DesignSummary, stations: Partial<Record<StationId, { T: number; P: number; W: number }>>): void {
    // İstasyon tablosu: T [K], P [kPa], W [kg/s] (tasarım noktası, ISA deniz seviyesi)
    const st = stationRows(stations).map((s) =>
      h('tr', {}, [
        h('td', { text: s.id }),
        h('td', { text: fmtNum(s.T, 0) }),
        h('td', { text: fmtNum(s.P / 1e3, 0) }),
        h('td', { text: fmtNum(s.W, 1) }),
      ]),
    );
    const rows = Object.entries(sm.rows).map(([k, r]) =>
      h('tr', {}, [
        h('td', { text: ROW_LABEL[k] ?? k }),
        h('td', { text: String(r!.stages) }),
        h('td', { text: fmtNum(r!.uTip, 0) }),
        h('td', { text: fmtNum(r!.loading, 2) }),
        h('td', { text: fmtNum(r!.rpm, 0) }),
      ]),
    );
    this.detailsBody.replaceChildren(
      h('table', { class: 'st-table' }, [
        h('thead', {}, [h('tr', {}, ['İst.', 'T K', 'P kPa', 'W kg/s'].map((t) => h('th', { text: t })))]),
        h('tbody', {}, st),
      ]),
      h('table', { class: 'st-table ws-rows-table' }, [
        h('thead', {}, [h('tr', {}, ['Sıra', 'Kd', 'Uç m/s', 'ψ', 'rpm'].map((t) => h('th', { text: t })))]),
        h('tbody', {}, rows),
      ]),
      h('div', { class: 'ws-kv mono' }, [
        h('span', { text: `OPR ${fmtNum(sm.opr, 1)}` }),
        hasBypass(sm) ? h('span', { text: `BPR ${fmtNum(sm.bpr, 2)}` }) : null,
        sm.fpr !== undefined ? h('span', { text: `FPR ${fmtNum(sm.fpr, 2)}` }) : null,
        h('span', { text: `T3 ${fmtNum(sm.t3, 0)} K` }),
        h('span', { text: `T4 ${fmtNum(sm.t4, 0)} K` }),
        h('span', { text: `T45 ${fmtNum(sm.t45, 0)} K` }),
        h('span', { text: `EGT payı ${fmtNum(sm.egtMargin, 0)} K` }),
        sm.specificThrust !== undefined ? h('span', { text: `Özgül itki ${fmtNum(sm.specificThrust, 0)} N·s/kg` }) : null,
        h('span', { text: `LP ${fmtNum(sm.rpm.lp, 0)} · HP ${fmtNum(sm.rpm.hp, 0)} rpm` }),
        h('span', { text: `Kademeler ${sm.stagesLabel}` }),
      ]),
    );
  }
}
