/**
 * Günün Şenliği / Sonsuz Şenlik üretim işçisi (GDD §10.5: "Web Worker içinde
 * bot süzmesi"). Üretim ana iş parçacığının karelerine hiç dokunmaz; sonuç
 * ana iş parçacığındaki zaman dilimli üretimle birebir aynıdır (üretici
 * belirlenimli). Tek dosya derlemesinde Vite işçiyi satır içi (Blob URL)
 * gömer; CSP Blob işçiyi engellerse `BolumUretici` ana iş parçacığına döner.
 *
 * İletiler:
 *   ana → işçi  { tur: 'uret', id, kip: 'gunluk' | 'sonsuz', n, oncelik }
 *               { tur: 'oncelik', id, oncelik }
 *   işçi → ana  { tur: 'ilerleme', id, eylem } | { tur: 'bitti', id, v } | { tur: 'hata', id, mesaj }
 */
import { gunlukUret, sonsuzUret, type UretimIlerleme } from '../levels/uretici';
import type { BolumVerisi } from '../core/types';

export type IsciIstegi = { tur: 'uret'; id: number; kip: 'gunluk' | 'sonsuz'; n: number; oncelik: number } | { tur: 'oncelik'; id: number; oncelik: number };
export type IsciYaniti = { tur: 'ilerleme'; id: number; eylem: number } | { tur: 'bitti'; id: number; v: BolumVerisi } | { tur: 'hata'; id: number; mesaj: string };

interface Is {
  id: number;
  g: Generator<UretimIlerleme, BolumVerisi, void>;
  oncelik: number;
  eylem: number;
  bildirilen: number;
}

const kapsam = self as unknown as { postMessage(m: IsciYaniti): void; onmessage: ((e: MessageEvent<IsciIstegi>) => void) | null };
const isler: Is[] = [];
let calisiyor = false;
// Dilimler arası sıfır gecikmeli sıra (setTimeout iç içe 4 ms'ye kısılır).
const kanal = new MessageChannel();
kanal.port1.onmessage = () => dilim();
const sonraki = () => kanal.port2.postMessage(0);

kapsam.onmessage = (e) => {
  const m = e.data;
  const mevcut = isler.find((x) => x.id === m.id);
  if (m.tur === 'oncelik') {
    if (mevcut) mevcut.oncelik = m.oncelik;
    return;
  }
  if (mevcut) mevcut.oncelik = Math.max(mevcut.oncelik, m.oncelik);
  else isler.push({ id: m.id, g: m.kip === 'gunluk' ? gunlukUret(m.n) : sonsuzUret(m.n), oncelik: m.oncelik, eylem: 0, bildirilen: 0 });
  if (!calisiyor) {
    calisiyor = true;
    sonraki();
  }
};

function dilim(): void {
  if (!isler.length) {
    calisiyor = false;
    return;
  }
  // En yüksek öncelikli iş (eşitlikte ilk gelen); 40 ms'lik dilim, sonra iletilere sıra.
  let is = isler[0];
  for (const x of isler) if (x.oncelik > is.oncelik) is = x;
  const bas = performance.now();
  try {
    for (;;) {
      const r = is.g.next();
      if (r.done) {
        isler.splice(isler.indexOf(is), 1);
        kapsam.postMessage({ tur: 'bitti', id: is.id, v: r.value });
        break;
      }
      is.eylem = r.value.eylem;
      if (performance.now() - bas > 40) break;
    }
    if (isler.includes(is) && is.eylem - is.bildirilen >= 15) {
      is.bildirilen = is.eylem;
      kapsam.postMessage({ tur: 'ilerleme', id: is.id, eylem: is.eylem });
    }
  } catch (err) {
    const i = isler.indexOf(is);
    if (i >= 0) isler.splice(i, 1);
    kapsam.postMessage({ tur: 'hata', id: is.id, mesaj: String(err) });
  }
  sonraki();
}
