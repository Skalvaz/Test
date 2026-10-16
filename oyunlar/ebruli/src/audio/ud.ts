/**
 * Ud koparma (GDD §10.3): Karplus–Strong tel benzetimi — saf örnek üretimi,
 * testli. Gecikme hattı tohumlu gürültüyle (koparma noktası süzgeçli)
 * doldurulur; her turda iki komşu örneğin ortalaması × sönüm (0,996) geri
 * beslenir. Ardından gövde rezonansı: tepe süzgeci 220 Hz, Q 2, +4 dB
 * (ud'un armut gövdesi). Tepe 0,9'a normalize edilir.
 *
 * Belirlenimli: aynı (frekans, oran, tohum) aynı tamponu verir.
 */
import { rastgeleUretici } from './gurultu';

export interface UdSecenek {
  sure?: number;
  /** Geri besleme sönümü (tel kaybı). */
  sonum?: number;
  tohum?: number;
  /** Koparma parlaklığı 0..1 (düşük = yumuşak, mızrap yerine parmak). */
  parlaklik?: number;
}

/** RBJ tepe (peaking) süzgeci katsayıları. */
function tepeSuzgeci(f0: number, oran: number, q: number, dbKazanc: number): [number, number, number, number, number] {
  const A = Math.pow(10, dbKazanc / 40);
  const w0 = (2 * Math.PI * f0) / oran;
  const al = Math.sin(w0) / (2 * q);
  const cs = Math.cos(w0);
  const b0 = 1 + al * A;
  const b1 = -2 * cs;
  const b2 = 1 - al * A;
  const a0 = 1 + al / A;
  const a1 = -2 * cs;
  const a2 = 1 - al / A;
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/** Bir ud teli koparması: `f` Hz, `oran` örnekleme hızı. */
export function udTeli(f: number, oran: number, s: UdSecenek = {}): Float32Array {
  const sure = s.sure ?? 1.2;
  const sonum = s.sonum ?? 0.996;
  const n = Math.max(1, Math.floor(oran * sure));
  const out = new Float32Array(n);
  const L = Math.max(2, Math.round(oran / f));
  const hat = new Float32Array(L);
  const r = rastgeleUretici((s.tohum ?? 7) * 2654435761 + Math.round(f * 100));
  // Koparma: gürültü, tek kutuplu alçak geçirenle yumuşatılmış (parlaklık).
  const p = s.parlaklik ?? 0.6;
  let lp = 0;
  for (let i = 0; i < L; i++) {
    lp += (r() - lp) * (0.25 + 0.7 * p);
    hat[i] = lp;
  }
  // Doğru akımı çıkar (tel sabit başlasın).
  let ort = 0;
  for (let i = 0; i < L; i++) ort += hat[i];
  ort /= L;
  for (let i = 0; i < L; i++) hat[i] -= ort;
  let j = 0;
  let onceki = hat[L - 1];
  for (let i = 0; i < n; i++) {
    const v = hat[j];
    out[i] = v;
    const yeni = sonum * 0.5 * (v + onceki);
    onceki = v;
    hat[j] = yeni;
    j++;
    if (j >= L) j = 0;
  }
  // Gövde rezonansı.
  const [b0, b1, b2, a1, a2] = tepeSuzgeci(220, oran, 2, 4);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = out[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  // Atak tıkırtısı olmasın (1 ms giriş), sonda 30 ms çıkış.
  const giris = Math.max(1, Math.floor(oran * 0.001));
  for (let i = 0; i < giris && i < n; i++) out[i] *= i / giris;
  const cikis = Math.max(1, Math.floor(oran * 0.03));
  for (let i = 0; i < cikis && i < n; i++) out[n - 1 - i] *= i / cikis;
  let tepe = 0;
  for (let i = 0; i < n; i++) tepe = Math.max(tepe, Math.abs(out[i]));
  const k = tepe > 0 ? 0.9 / tepe : 1;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}
