/**
 * Müzikal fitil notaları (GDD §12.3, §11 kanca 1) — saf, testli.
 *
 * Pentatonik dizi (C majör pentatonik, C5 → C7). k. düğüm → indeks
 * min(k−1, 10). Isı dalgaları fitilin son notasından devam eder: w. dalga →
 * min(son + w, 10).
 */

/** §12.3 pentatonik dizi (Hz): C5 D5 E5 G5 A5 C6 D6 E6 G6 A6 C7. */
export const PENTATONIK: readonly number[] = [523.25, 587.33, 659.26, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
export const SON_INDEKS = PENTATONIK.length - 1;

/** Düğüm sırası k (1 tabanlı) → dizi indeksi. */
export function notaIndeksi(k: number): number {
  return Math.max(0, Math.min(Math.floor(k) - 1, SON_INDEKS));
}

/** Düğüm sırası k'nın frekansı. */
export function dugumFrekansi(k: number): number {
  return PENTATONIK[notaIndeksi(k)];
}

/**
 * Parıltı katmanı: perde C7'de durduğunda bir oktav üstte, kazancı 0,15
 * olan ek katman. Yorum (görev metni "11+ düğümde"): k ≥ 11.
 */
export function pariltiVar(k: number): boolean {
  return k >= 11;
}
export const PARILTI_KAZANCI = 0.15;

/** Isı dalgası w (nesil, 1 tabanlı) → indeks min(son + w, 10). */
export function dalgaIndeksi(son: number, w: number): number {
  return Math.max(0, Math.min(son + Math.max(0, Math.floor(w)), SON_INDEKS));
}

/** İndeks sınırlı nota frekansı. */
export function nota(i: number): number {
  return PENTATONIK[Math.max(0, Math.min(Math.round(i), SON_INDEKS))];
}

/** MIDI numarasından frekans (A4 = 69 = 440 Hz). */
export function midiFrekans(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/**
 * Müzik pedi akorları (§12.3): I–vi–IV–V, her 8 sn'de bir. Sesler pentatonik
 * melodiyle çatışmasın diye V akoru sus2 (G–D–A) olarak dizildi (B yok).
 * MIDI: C3 = 48.
 */
export const PED_AKORLARI: readonly (readonly number[])[] = [
  [48, 55, 64], // I   C3 G3 E4
  [45, 52, 60], // vi  A2 E3 C4
  [41, 48, 57], // IV  F2 C3 A3
  [43, 50, 57], // V   G2 D3 A3 (sus2)
];
export const AKOR_SURESI = 8;

/** Akor sırasındaki melodi için uygun pentatonik indeksler (akor tonları önce). */
export const AKOR_MELODI: readonly (readonly number[])[] = [
  [0, 2, 3, 5, 7], // C E G
  [0, 2, 4, 5, 7], // A C E
  [0, 4, 5, 9], // F A C → C A
  [1, 3, 4, 6, 8], // G D A
];

/** Reaksiyon kademesi arpeji (§12.2 "kademeye göre yükselen arpej"). */
export const KADEME_ARPEJ: Record<'guzel' | 'harika' | 'muhtesem' | 'senlik', readonly number[]> = {
  guzel: [0, 2, 4],
  harika: [0, 2, 4, 5],
  muhtesem: [0, 2, 4, 5, 7],
  senlik: [0, 2, 4, 5, 7, 9, 10],
};

/** Kazandın arpeji (§12.2): C5-E5-G5-C6-E6 (pentatonik indeksler). */
export const KAZANC_ARPEJ: readonly number[] = [0, 2, 3, 5, 7];

// ─── Üretken ninni melodisi (Kasım 2026, "cozy") ─────────────────────────
/**
 * Müzik kutusu melodisi: her akor 8 vuruşluk (1 vuruş = 1 sn, ninni temposu)
 * iki ölçüdür. Melodi rastgele notalar değil, tekrar eden küçük motiflerden
 * kurulur (akılda kalsın, sakinleştirsin): dört akorluk döngüde biçim
 * "soru – cevap – soru – kapanış". Motif adımı, akorun `AKOR_MELODI`
 * listesinin ilk dört basamağına indekstir (hep akor tonu: uyumsuzluk olmaz).
 */
export interface MelodiNotasi {
  /** Akor başından vuruş (0–7,5). */
  vurus: number;
  /** Pentatonik dizi indeksi (`nota(i)`). */
  indeks: number;
  /** Vurgu 0–1 (ölçü başı güçlü). */
  guc: number;
  /** true: bir oktav üstte ince "çıngırak" eşlik eder (cümle sonu). */
  parlak: boolean;
}

/** [vuruş, basamak] çiftleri. Soru motifleri (yukarı açılır). */
export const MOTIF_SORU: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0], [1, 1], [2, 2], [4, 1], [5, 2], [6, 3]],
  [[0, 2], [1.5, 1], [2, 2], [4, 3], [6, 2]],
  [[0, 0], [2, 2], [3, 1], [4, 2], [6, 3]],
  [[0.5, 1], [1, 2], [2, 3], [4, 2], [5.5, 1], [6, 2]],
];
/** Cevap motifleri (aşağı iner, dinlenir). */
export const MOTIF_CEVAP: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 3], [1, 2], [2, 1], [4, 2], [5, 1], [6, 0]],
  [[0, 2], [2, 1], [4, 1], [5, 0]],
  [[0, 3], [1.5, 2], [2, 1], [4, 0]],
];
/** Kapanış: uzun, seyrek; son nota akorun kökünde kalır. */
export const MOTIF_KAPANIS: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 2], [2, 1], [4, 0]],
  [[0, 1], [1, 2], [2, 1], [4, 0]],
  [[0, 3], [2, 2], [3, 1], [4, 0]],
];
/** Nefes: tek-iki nota (her üç döngüden biri böyle seyrek geçer). */
export const MOTIF_NEFES: readonly (readonly (readonly [number, number])[])[] = [
  [[0, 0], [4, 1]],
  [[2, 2]],
  [[0, 1], [4, 0]],
];

/**
 * `dongu`. dört akorluk döngünün `sira`. akorunun (0–3) notaları. `sec(n)`
 * 0…n−1 tamsayı verir; aynı döngüde aynı soru/cevap motifi kullanılsın diye
 * çağıran döngü başına sabit bir tohumdan üretir (`donguSecimi`).
 */
export interface DonguSecimi {
  soru: number;
  cevap: number;
  kapanis: number;
  /** Seyrek döngü: bütün akorlarda nefes motifi. */
  nefes: boolean;
  nefesMotifi: number;
}

export function donguSecimi(sec: (n: number) => number): DonguSecimi {
  return {
    soru: sec(MOTIF_SORU.length),
    cevap: sec(MOTIF_CEVAP.length),
    kapanis: sec(MOTIF_KAPANIS.length),
    nefes: sec(3) === 0,
    nefesMotifi: sec(MOTIF_NEFES.length),
  };
}

export function melodiCumlesi(sira: number, d: DonguSecimi): MelodiNotasi[] {
  const a = ((sira % 4) + 4) % 4;
  const motif = d.nefes
    ? MOTIF_NEFES[(d.nefesMotifi + a) % MOTIF_NEFES.length]
    : a === 3
      ? MOTIF_KAPANIS[d.kapanis]
      : a === 1
        ? MOTIF_CEVAP[d.cevap]
        : MOTIF_SORU[d.soru];
  const basamaklar = AKOR_MELODI[a];
  return motif.map(([vurus, b], i) => ({
    vurus,
    indeks: basamaklar[Math.min(b, Math.min(3, basamaklar.length - 1))],
    guc: vurus === 0 ? 1 : vurus === 4 ? 0.85 : 0.7,
    parlak: !d.nefes && a === 3 && i === motif.length - 1,
  }));
}
