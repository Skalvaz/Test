/**
 * Günün Şenliği paylaşım metni (§10.5): sunucusuz, panoya kopyalanır,
 * emoji yok. Her hamle bir simge: ● R < 8, ▲ 8 ≤ R < 15, ■ R ≥ 15.
 *
 *   FİTİL · Günün Şenliği 14.10.2026
 *   ★★☆  18/22 hamle  En büyük: 27
 *   ●●▲●■▲●●▲▲●■●▲●●▲▲
 */
import { M, tarihKisa } from './metinler';
import { t } from '../platform/dil';
import type { PaylasimVM } from './tipler';

export function hamleSimgesi(r: number): string {
  if (r >= 15) return '■';
  if (r >= 8) return '▲';
  return '●';
}

export function paylasimMetni(p: PaylasimVM): string {
  const y = Math.max(0, Math.min(3, p.yildiz));
  const yildizlar = '★'.repeat(y) + '☆'.repeat(3 - y);
  const satir1 = `${M.oyunAdi} · ${M.gununSenligi} ${tarihKisa(p.tarih)}`;
  const satir2 = `${yildizlar}  ${p.kullanilanHamle}/${p.toplamHamle} ${M.hamle}  ${t('En büyük', 'Biggest')}: ${p.enBuyuk}`;
  const satir3 = p.reaksiyonlar.map(hamleSimgesi).join('');
  return [satir1, satir2, satir3].filter((s) => s.length > 0).join('\n');
}
