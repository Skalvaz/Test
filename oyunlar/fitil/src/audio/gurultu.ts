/**
 * Gürültü ve yankı tamponları (GDD §12.3) — saf örnek üretimi, testli.
 *
 *  - Beyaz, pembe (Paul Kellet'in yöntemi), kahverengi (sızıntılı integral)
 *    gürültü; 2 sn, açılışta bir kez. Döngüde tıkırtı olmasın diye uçlar
 *    çapraz geçişle birleştirilir (kahverengi ve pembe gürültüde döngü
 *    sınırındaki sıçrama her 2 sn'de "tık" diye duyulurdu).
 *  - Yankı dürtü yanıtı: 1,8 sn stereo gürültü, exp(−t/0,45) ile söner.
 *
 * Belirlenimli: aynı tohum aynı tamponu verir (ölçüm tekrarlanabilir).
 */
export type GurultuRengi = 'beyaz' | 'pembe' | 'kahve';

/** Küçük, hızlı, belirlenimli RNG (xorshift32) → [−1, 1). */
export function rastgeleUretici(tohum: number): () => number {
  let s = tohum >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s / 4294967296) * 2 - 1;
  };
}

/** Uzunluk `n` gürültü; tepe 1'e normalize, döngü sınırı yumuşatılmış. */
export function gurultuUret(renk: GurultuRengi, n: number, tohum = 1): Float32Array {
  const gecis = Math.min(2048, Math.floor(n / 8));
  const ham = new Float32Array(n + gecis);
  const r = rastgeleUretici(tohum);
  if (renk === 'beyaz') {
    for (let i = 0; i < ham.length; i++) ham[i] = r();
  } else if (renk === 'pembe') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < ham.length; i++) {
      const w = r();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      ham[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    let son = 0;
    for (let i = 0; i < ham.length; i++) {
      son = (son + 0.02 * r()) / 1.02;
      ham[i] = son;
    }
  }
  // Doğru akım bileşenini çıkar (kahverengi gürültü kayar).
  let ort = 0;
  for (let i = 0; i < ham.length; i++) ort += ham[i];
  ort /= ham.length;
  // Döngü: son `gecis` örneği başa eşit güçle karıştır.
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ham[i] - ort;
  for (let i = 0; i < gecis; i++) {
    const a = (i + 0.5) / gecis;
    const ka = Math.sin((a * Math.PI) / 2);
    const kb = Math.cos((a * Math.PI) / 2);
    out[i] = (ham[i] - ort) * ka + (ham[n + i] - ort) * kb;
  }
  let tepe = 0;
  for (let i = 0; i < n; i++) tepe = Math.max(tepe, Math.abs(out[i]));
  const k = tepe > 0 ? 0.98 / tepe : 1;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

export const YANKI_SURESI = 1.8;
export const YANKI_SONUM = 0.45;

/** Yankı dürtü yanıtı kanalı: gürültü × exp(−t/0,45), 1,8 sn. */
export function yankiKanali(oran: number, tohum: number): Float32Array {
  const n = Math.floor(oran * YANKI_SURESI);
  const out = new Float32Array(n);
  const r = rastgeleUretici(tohum);
  // İlk 2 ms'de yumuşak giriş (ön yankı tıkırtısı olmasın).
  const giris = Math.max(1, Math.floor(oran * 0.002));
  for (let i = 0; i < n; i++) {
    const t = i / oran;
    out[i] = r() * Math.exp(-t / YANKI_SONUM) * Math.min(1, i / giris);
  }
  return out;
}
