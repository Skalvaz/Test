/**
 * Takvim aritmetiği (saf, `Date` yok). Tarihler yerel gün olarak `yyyymmdd`
 * tamsayısıyla taşınır (ör. 20261014); yerel tarihi uygulama verir
 * (`tarihYyyymmdd(y, ay, gün)`).
 *
 * Gün numarası: 1970-01-01'den bu yana gün (proleptik Gregoryen,
 * H. Hinnant'ın days_from_civil algoritması). Haftalar Pazartesi başlar
 * (Türkiye'deki takvim alışkanlığı); Fener Nöbeti affı bu haftalara göredir.
 */

/** Yerel tarih bileşenlerinden yyyymmdd. */
export function tarihYyyymmdd(yil: number, ay: number, gun: number): number {
  return yil * 10000 + ay * 100 + gun;
}

export function tarihBilesenleri(t: number): { yil: number; ay: number; gun: number } {
  const yil = Math.floor(t / 10000);
  const ay = Math.floor(t / 100) % 100;
  const gun = t % 100;
  return { yil, ay, gun };
}

function artikMi(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const AY_GUNU = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Geçerli bir yyyymmdd mi (1900–2999 arası). */
export function tarihGecerli(t: unknown): t is number {
  if (typeof t !== 'number' || !Number.isInteger(t)) return false;
  const { yil, ay, gun } = tarihBilesenleri(t);
  if (yil < 1900 || yil > 2999 || ay < 1 || ay > 12 || gun < 1) return false;
  const son = ay === 2 && artikMi(yil) ? 29 : AY_GUNU[ay - 1];
  return gun <= son;
}

/** yyyymmdd → 1970-01-01'den bu yana gün. */
export function gunNo(t: number): number {
  const { yil, ay, gun } = tarihBilesenleri(t);
  const y = yil - (ay <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (ay + (ay > 2 ? -3 : 9)) + 2) / 5) + gun - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Gün numarası → yyyymmdd. */
export function gundenTarih(n: number): number {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const gun = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const ay = mp + (mp < 10 ? 3 : -9);
  const yil = yoe + era * 400 + (ay <= 2 ? 1 : 0);
  return tarihYyyymmdd(yil, ay, gun);
}

/** t + n gün. */
export function tarihEkle(t: number, n: number): number {
  return gundenTarih(gunNo(t) + n);
}

/** b − a (gün). */
export function gunFarki(a: number, b: number): number {
  return gunNo(b) - gunNo(a);
}

/** Haftanın günü: 0 Pazartesi … 6 Pazar. (1970-01-01 Perşembe.) */
export function haftaGunu(t: number): number {
  return (((gunNo(t) + 3) % 7) + 7) % 7;
}

/** Pazartesi başlangıçlı hafta sayacı (1970-01-05 Pazartesi = 1). */
export function haftaNo(t: number): number {
  return Math.floor((gunNo(t) + 3) / 7);
}

/** Paylaşım biçimi: 14.10.2026. */
export function tarihMetni(t: number): string {
  const { yil, ay, gun } = tarihBilesenleri(t);
  return `${String(gun).padStart(2, '0')}.${String(ay).padStart(2, '0')}.${yil}`;
}
