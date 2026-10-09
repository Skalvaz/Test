/**
 * Görev kartı (M5a, §9.2 S7; kesilebilir paket): üç tasarım görevi ve
 * hedef zarf. "Füze motoru" (çap ≤ 0,5 m, 4 kN), "Bölgesel jet"
 * (≥ 80 kN, TSFC ≤ 11), "Helikopter" (≥ 1,2 MW, ≤ 250 kg).
 */

import type { Finding } from '../design/core/rules';
import type { DesignSummary } from '../design/summary';
import type { DesignGoal } from '../design/warnings';

export type { DesignGoal } from '../design/warnings';

export const GOALS: readonly DesignGoal[] = [
  {
    id: 'missile',
    title: 'Füze motoru',
    brief: 'Seyir füzesine 0,5 m çaplı gövdeye sığan, en az 4 kN itkili küçük bir jet motoru tasarla.',
    require: { thrustMin: 4e3, diameterMax: 0.5 },
    hint: 'Hava akışını küçült; çap hava akışının karekökü ile küçülür. Kısa ömür için T4 yüksek olabilir.',
    lesson: 'brayton',
  },
  {
    id: 'regional',
    title: 'Bölgesel jet',
    brief: 'Bölgesel yolcu uçağına en az 80 kN itkili, yakıt tüketimi (TSFC) 11 g/(kN·s) altında, uyarısız bir turbofan tasarla.',
    require: { thrustMin: 80e3, tsfcMax: 11, noWarnings: true },
    hint: 'Yüksek baypas oranı TSFC’yi düşürür; LPT kademe sayısına ve fan ucuna dikkat.',
    lesson: 'anatomy',
  },
  {
    id: 'helicopter',
    title: 'Helikopter',
    brief: 'Orta sınıf helikoptere en az 1,2 MW mil gücü veren, 250 kg’dan hafif bir turboşaft tasarla.',
    require: { shaftPowerMin: 1.2e6, massMax: 250 },
    hint: 'Santrifüj son kademe küçük motorda verimi korur; yüksek T4 güç/ağırlığı artırır.',
    lesson: 'fadec',
  },
];

const fmt = (v: number, d = 1) => v.toLocaleString('tr-TR', { maximumFractionDigits: d, minimumFractionDigits: d });

/** Görevin satır satır denetimi (✓/✗) */
export function checkGoal(
  g: DesignGoal,
  s: DesignSummary,
  f: Finding[],
): { met: boolean; rows: { label: string; ok: boolean; text: string }[] } {
  const rows: { label: string; ok: boolean; text: string }[] = [];
  const r = g.require;
  const row = (label: string, ok: boolean, text: string) => rows.push({ label, ok, text });
  if (r.thrustMin !== undefined) row('İtki', s.thrust >= r.thrustMin, `${fmt(s.thrust / 1e3)} kN ≥ ${fmt(r.thrustMin / 1e3)} kN`);
  if (r.shaftPowerMin !== undefined) {
    const p = s.shaftPower ?? 0;
    row('Mil gücü', p >= r.shaftPowerMin, `${fmt(p / 1e6, 2)} MW ≥ ${fmt(r.shaftPowerMin / 1e6, 2)} MW`);
  }
  if (r.tsfcMax !== undefined) {
    const v = s.tsfc;
    row('TSFC', v !== undefined && v <= r.tsfcMax, `${v === undefined ? '—' : fmt(v)} ≤ ${fmt(r.tsfcMax)} g/(kN·s)`);
  }
  if (r.sfcMax !== undefined) {
    const v = s.sfc;
    row('SFC', v !== undefined && v <= r.sfcMax, `${v === undefined ? '—' : fmt(v, 0)} ≤ ${fmt(r.sfcMax, 0)} g/(kW·h)`);
  }
  if (r.massMax !== undefined) row('Kütle', s.mass <= r.massMax, `${fmt(s.mass, 0)} kg ≤ ${fmt(r.massMax, 0)} kg`);
  if (r.diameterMax !== undefined) row('Çap', s.diameter <= r.diameterMax, `${fmt(s.diameter, 2)} m ≤ ${fmt(r.diameterMax, 2)} m`);
  if (r.lengthMax !== undefined) row('Boy', s.length <= r.lengthMax, `${fmt(s.length, 2)} m ≤ ${fmt(r.lengthMax, 2)} m`);
  if (r.noWarnings) {
    const n = f.filter((x) => x.severity !== 'info').length;
    row('Uyarı', n === 0, n === 0 ? 'Uyarı yok' : `${n} uyarı`);
  }
  return { met: rows.every((x) => x.ok), rows };
}

export function goalById(id: string): DesignGoal | undefined {
  return GOALS.find((g) => g.id === id);
}
