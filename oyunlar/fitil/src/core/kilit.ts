/**
 * Kilitlenme testi (§3.4) ve bileşen yardımcıları.
 *
 * G_c = {renk = c olan zincirlenebilir kapsüller} ∪ {yıldız topları};
 * komşuluk zincir komşuluğudur (8-komşu, `dortKomsu` kuralında 4-komşu).
 */
import { DIK, SEKIZ, zincirlenebilir } from './tahta';
import type { Konum, OyunDurumu } from './types';

function komsular(d: OyunDurumu): readonly Konum[] {
  return d.kurallar.dortKomsu ? DIK : SEKIZ;
}

/** Tahtada çift dokunulabilir (kafessiz) özel taş var mı. */
export function ozelVar(d: OyunDurumu): boolean {
  for (const h of d.hucreler) {
    if (!h.delik && !h.kafes && h.icerik?.tur === 'kapsul' && h.icerik.ozel !== 'yok') return true;
  }
  return false;
}

/** Herhangi bir renk için boyutu ≥ enAz olan bağlı bileşen var mı (BFS, O(hücre·renk)). */
export function bilesenVar(d: OyunDurumu, enAz: number): boolean {
  const komsu = komsular(d);
  const gorulen = new Uint8Array(d.w * d.h);
  const kuyruk: number[] = [];
  for (let c = 0; c < d.renkSayisi; c++) {
    gorulen.fill(0);
    for (let y = 0; y < d.h; y++) {
      for (let x = 0; x < d.w; x++) {
        const i = y * d.w + x;
        if (gorulen[i] || !zincirlenebilir(d, x, y, c)) continue;
        let boyut = 0;
        kuyruk.length = 0;
        kuyruk.push(i);
        gorulen[i] = 1;
        while (kuyruk.length) {
          const j = kuyruk.pop() as number;
          boyut++;
          const jx = j % d.w;
          const jy = (j - jx) / d.w;
          for (const k of komsu) {
            const nx = jx + k.x;
            const ny = jy + k.y;
            if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
            const n = ny * d.w + nx;
            if (gorulen[n] || !zincirlenebilir(d, nx, ny, c)) continue;
            gorulen[n] = 1;
            kuyruk.push(n);
          }
        }
        if (boyut >= enAz) return true;
      }
    }
  }
  return false;
}

/**
 * En az bir 4'lü döngü (halka) var mı (§3.4, `yalnizHalka`): her düğümden
 * derinlik 3'e kadar DFS; v0–v1–v2–v3 ayrık ve v3, v0'a komşuysa döngü vardır.
 */
export function halkaVar(d: OyunDurumu): boolean {
  const komsu = komsular(d);
  const w = d.w;
  // caprazSiniri (§3.3.7) yolun adımlarını sayar (kapanış segmenti hariç):
  // v0–v1, v1–v2, v2–v3 adımlarındaki çaprazlar sınırı aşmamalı.
  const sinir = d.kurallar.caprazSiniri ?? 3;
  const capraz = (a: number, b: number): number => (a % w !== b % w && (a - (a % w)) / w !== (b - (b % w)) / w ? 1 : 0);
  const komsuListesi = (i: number, c: number, cikti: number[]): void => {
    cikti.length = 0;
    const x = i % w;
    const y = (i - x) / w;
    for (const k of komsu) {
      const nx = x + k.x;
      const ny = y + k.y;
      if (nx < 0 || ny < 0 || nx >= d.w || ny >= d.h) continue;
      if (zincirlenebilir(d, nx, ny, c)) cikti.push(ny * w + nx);
    }
  };
  const k1: number[] = [];
  const k2: number[] = [];
  const k3: number[] = [];
  for (let c = 0; c < d.renkSayisi; c++) {
    for (let v0 = 0; v0 < d.hucreler.length; v0++) {
      const x0 = v0 % w;
      const y0 = (v0 - x0) / w;
      if (!zincirlenebilir(d, x0, y0, c)) continue;
      komsuListesi(v0, c, k1);
      for (const v1 of k1) {
        komsuListesi(v1, c, k2);
        for (const v2 of k2) {
          if (v2 === v0) continue;
          komsuListesi(v2, c, k3);
          for (const v3 of k3) {
            if (v3 === v0 || v3 === v1) continue;
            if (capraz(v0, v1) + capraz(v1, v2) + capraz(v2, v3) > sinir) continue;
            const x3 = v3 % w;
            const y3 = (v3 - x3) / w;
            const dx = Math.abs(x3 - x0);
            const dy = Math.abs(y3 - y0);
            const bitisik = d.kurallar.dortKomsu ? dx + dy === 1 : dx <= 1 && dy <= 1;
            if (bitisik) return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * `caprazSiniri` < 2 iken geçerli 3'lü yol var mı (uzlaştırma eki, §3.3.7 +
 * §3.4). Her 3 düğümlü basit yolun bir orta düğümü b ve onun iki komşusu
 * vardır; yol, b'nin dik komşu sayısı o ve çapraz komşu sayısı g ile:
 *   o ≥ 2 (0 çapraz) ya da o ≥ 1, g ≥ 1 (1 çapraz) ya da g ≥ 2 (2 çapraz).
 * Bileşen testi (§3.4) çapraz sınırını görmez: yalnız çaprazla bağlı
 * (0,0)–(1,1)–(2,0) bileşeni "kilitsiz" sayılır ama sınır 1'de oynanamaz.
 */
export function ucluYolVar(d: OyunDurumu): boolean {
  const sinir = d.kurallar.caprazSiniri ?? 2;
  const caprazAcik = !d.kurallar.dortKomsu;
  for (let c = 0; c < d.renkSayisi; c++) {
    for (let y = 0; y < d.h; y++) {
      for (let x = 0; x < d.w; x++) {
        if (!zincirlenebilir(d, x, y, c)) continue;
        let o = 0;
        let g = 0;
        for (const k of SEKIZ) {
          const dik = k.x === 0 || k.y === 0;
          if (!dik && !caprazAcik) continue;
          if (zincirlenebilir(d, x + k.x, y + k.y, c)) {
            if (dik) o++;
            else g++;
          }
        }
        if (o >= 2 || (sinir >= 1 && o >= 1 && g >= 1) || (sinir >= 2 && g >= 2)) return true;
      }
    }
  }
  return false;
}

/**
 * kilitliMi (§3.4): tahtada (kafessiz) özel taş varsa false (çift dokunuş her
 * zaman geçerli hamledir); yoksa her renk için ≥ 3 düğümlü bileşen aranır.
 * `yalnizHalka` kuralında yalnız halkalar geçerli olduğundan 4'lü döngü aranır.
 * Uzlaştırma eki: `caprazSiniri` 0 ya da 1 iken bileşen yerine sınırı
 * sağlayan bir 3'lü yol aranır (`ucluYolVar`); yoksa tahta oynanamaz ama
 * karıştırılmazdı (bulanık testte yakalandı).
 */
export function kilitliMi(d: OyunDurumu): boolean {
  if (ozelVar(d)) return false;
  if (d.kurallar.yalnizHalka) return !halkaVar(d);
  const sinir = d.kurallar.caprazSiniri;
  if (sinir != null && sinir < 2 && !d.kurallar.dortKomsu) return !ucluYolVar(d);
  return !bilesenVar(d, 3);
}
