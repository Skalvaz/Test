/**
 * Atölyenin başlangıç ekranı (M5a §6.3): modal (`data-start`). **Devam et**
 * (`data-action="resume"`, kayıt varsa), **Şablondan başla** (7 kart,
 * `data-template="<TemplateId>"`; meridyen silueti `outlineSvg`, gerçek
 * örnek, mini istatistik) ve **Sıfırdan tasarla**
 * (`data-action="start-scratch"`).
 */

import { TEMPLATES } from '../../design/catalog';
import { buildEngine } from '../../design/graph';
import { outlineSvg } from '../../design/outline';
import { fmtNum, summarize, type DesignSummary } from '../../design/summary';
import { TEMPLATE_IDS, existingTemplate, type TemplateId } from '../../workshop/project';
import { h, icon } from '../../ui/dom';
import { modal } from '../../ui/Menus';
import { ATTR } from './selectors';

/** Kart metinleri: ad, gerçek örnek, kısa tanım */
const CARD: Record<TemplateId, { title: string; example: string; does: string }> = {
  turbojet: { title: 'Art yakıcılı turbojet', example: 'J79, Atar 9K50 sınıfı', does: 'Tek akış, art yakıcı ve değişken lüle: hızlı ve susuz değil.' },
  turbojetDry: { title: 'Sade turbojet', example: 'J85, Viper sınıfı', does: 'En yalın gaz türbini: kompresör, yanma odası, türbin, lüle.' },
  militaryTurbofan: { title: 'Askeri turbofan', example: 'F100, EJ200 sınıfı', does: 'Düşük baypas, karışık akış ve art yakıcı: savaş uçağı motoru.' },
  turbofanMixed: { title: 'Karışık akışlı turbofan', example: 'CFM56-5C, TFE731 sınıfı', does: 'Kaportalı turbofan; baypas ve çekirdek ortak lüleden çıkar.' },
  turbofan: { title: 'Yüksek baypaslı turbofan', example: 'CFM56-7, LEAP sınıfı', does: 'Büyük fan, ayrık lüleler: yolcu uçaklarının verimli motoru.' },
  turboprop: { title: 'Turboprop', example: 'PW150, T56 sınıfı', does: 'Serbest türbin redüktörle pervaneyi çevirir.' },
  turboshaft: { title: 'Turboşaft', example: 'T700, Makila sınıfı', does: 'Serbest türbin çıkış milini çevirir: helikopter rotoru.' },
} as Record<TemplateId, { title: string; example: string; does: string }>;

export interface StartCallbacks {
  hasSaved: boolean;
  onResume(): void;
  onTemplate(id: TemplateId): void;
  onScratch(): void;
  onClose(): void;
}

/** Şablon başına üretim ve özet (bir kez) */
const cache = new Map<TemplateId, { svg: string; s: DesignSummary } | null>();
function templateInfo(id: TemplateId): { svg: string; s: DesignSummary } | null {
  if (cache.has(id)) return cache.get(id)!;
  let r: { svg: string; s: DesignSummary } | null = null;
  try {
    const g = TEMPLATES[existingTemplate(id)];
    if (g) {
      const b = buildEngine(g);
      r = { svg: outlineSvg(b, { width: 220, height: 64, pad: 4 }), s: summarize(b) };
    }
  } catch {
    r = null;
  }
  cache.set(id, r);
  return r;
}

function stat(s: DesignSummary): string {
  const out = s.output === 'thrust' ? `${fmtNum((s.thrustWet ?? s.thrust) / 1e3, 0)} kN` : `${fmtNum((s.shaftPower ?? 0) / 1e3, 0)} kW`;
  const ratio = s.thrustToWeight !== undefined ? `T/W ${fmtNum(s.thrustToWeight, 1)}` : s.powerToWeight !== undefined ? `${fmtNum(s.powerToWeight, 1)} kW/kg` : '';
  const fuel = s.tsfc !== undefined ? `TSFC ${fmtNum(s.tsfc, 1)}` : s.sfc !== undefined ? `SFC ${fmtNum(s.sfc, 0)}` : '';
  return [out, ratio, fuel].filter(Boolean).join(' · ');
}

export function startScreen(cb: StartCallbacks): HTMLElement {
  const cards = TEMPLATE_IDS.map((id) => {
    const info = templateInfo(id);
    const c = CARD[id];
    const sil = h('div', { class: 'ws-sil' });
    // Siluet kendi ürettiğimiz SVG dizgesidir (oyuncu metni değil)
    if (info) sil.innerHTML = info.svg;
    return h('button', {
      class: 'lesson-card ws-tpl',
      attrs: { type: 'button', [ATTR.template]: id },
      on: { click: () => cb.onTemplate(id) },
    }, [
      sil,
      h('div', { class: 't', text: c.title }),
      h('div', { class: 'd', text: c.does }),
      h('div', { class: 'meta' }, [h('span', { text: c.example }), h('span', { style: { flex: '1' } }), h('span', { class: 'mono', text: info ? stat(info.s) : '' })]),
    ]);
  });
  const body = h('div', { class: 'ws-start', attrs: { [ATTR.start]: '' } }, [
    h('div', { class: 'ws-start-actions' }, [
      cb.hasSaved
        ? h('button', { class: 'btn primary', attrs: { type: 'button', [ATTR.action]: 'resume' }, on: { click: cb.onResume } }, [icon('play', 14), 'Devam et'])
        : null,
      h('button', { class: `btn${cb.hasSaved ? '' : ' primary'}`, attrs: { type: 'button', [ATTR.action]: 'start-scratch' }, on: { click: cb.onScratch } }, [icon('wrench', 16), 'Sıfırdan tasarla']),
      h('span', { class: 'ws-start-note', text: 'Ya da bir şablondan başla: gerçek motorlara kalibre edilmiş yedi aile.' }),
    ]),
    h('div', { class: 'section-label', text: 'Şablondan başla' }),
    h('div', { class: 'lesson-grid ws-tpl-grid' }, cards),
  ]);
  const m = modal('Motor tasarım atölyesi', body, cb.onClose);
  m.classList.add('ws-start-overlay');
  return m;
}
