/**
 * Ortak çekirdek: kararlı (kanonik) JSON ve kısa özet (hash). Aynı model her
 * zaman aynı dizgeyi verir: tasarım kimliği (`rev`), paylaşım ve belge
 * karşılaştırması buna dayanır.
 *
 * Kurallar:
 *  - nesne anahtarları sıralı; `order[anahtar]` verilmişse o anahtarın
 *    altındaki nesnenin anahtarları önce bu sırada, kalanlar sıralı gelir;
 *    altındaki dizi `type` alanlı nesnelerden oluşuyorsa öğeler `type`'ın
 *    bu listedeki sırasına dizilir (motor grafiğinde `modules: ORDER`)
 *  - sayılar Number(x.toPrecision(7)), -0 → 0; NaN/∞ hata
 *  - undefined atılır (dizide null); dizgeler NFC
 */

export interface Migrator {
  from: number;
  migrate(doc: unknown): unknown;
}

export type CanonicalOrder = Record<string, readonly string[]>;

function num(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`Kanonik JSON: sonlu olmayan sayı (${x}).`);
  const v = Number(x.toPrecision(7));
  return JSON.stringify(v === 0 ? 0 : v);
}

function emit(v: unknown, order: CanonicalOrder | undefined, keyOrder: readonly string[] | undefined): string {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'number':
      return num(v);
    case 'string':
      return JSON.stringify(v.normalize('NFC'));
    case 'boolean':
      return v ? 'true' : 'false';
    case 'object':
      break;
    default:
      // undefined, fonksiyon, sembol: JSON'daki gibi null (nesne alanlarında atlanır)
      return 'null';
  }
  if (Array.isArray(v)) {
    let items = v;
    if (keyOrder && v.every((x) => x !== null && typeof x === 'object' && typeof (x as { type?: unknown }).type === 'string')) {
      const rank = (x: unknown) => {
        const i = keyOrder.indexOf((x as { type: string }).type);
        return i < 0 ? keyOrder.length : i;
      };
      // Kararlı sıralama: aynı sıradaki öğeler yerini korur
      items = v.map((x, i) => [x, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((p) => p[0]);
    }
    return `[${items.map((x) => emit(x, order, undefined)).join(',')}]`;
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  if (keyOrder) {
    const first = keyOrder.filter((k) => keys.includes(k));
    keys.splice(0, keys.length, ...first, ...keys.filter((k) => !first.includes(k)));
  }
  return `{${keys.map((k) => `${JSON.stringify(k.normalize('NFC'))}:${emit(o[k], order, order?.[k])}`).join(',')}}`;
}

export function canonicalJson(v: unknown, opts?: { order?: CanonicalOrder }): string {
  return emit(v, opts?.order, undefined);
}

const encoder = new TextEncoder();

/**
 * 64 bit FNV-1a (UTF-8 baytları üzerinde), base36. Çarpma 16 bitlik dört
 * parça ile yapılır (BigInt yalnız sonda): sürükleme sırasında her
 * üretimde çağrılır.
 */
export function fnv1a64(s: string): string {
  const bytes = encoder.encode(s);
  // Başlangıç değeri 0xcbf29ce484222325
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (let i = 0; i < bytes.length; i++) {
    h0 ^= bytes[i];
    // h · 0x100000001b3 = h·0x1b3 + (h << 40)
    let t0 = h0 * 0x1b3;
    let t1 = h1 * 0x1b3;
    let t2 = h2 * 0x1b3 + (h0 << 8);
    let t3 = h3 * 0x1b3 + (h1 << 8);
    t1 += t0 >>> 16;
    h0 = t0 & 0xffff;
    t2 += t1 >>> 16;
    h1 = t1 & 0xffff;
    t3 += t2 >>> 16;
    h2 = t2 & 0xffff;
    h3 = t3 & 0xffff;
  }
  return ((BigInt(h3) << 48n) | (BigInt(h2) << 32n) | (BigInt(h1) << 16n) | BigInt(h0)).toString(36);
}
