/**
 * Hızlı hazır hamle sayımı (GDD §4.7, §14.4). "Hazır" hamle: önizlemede
 * (doğumsuz) İLK adımda en az bir grup eşleştiren geçerli karışım hamlesi.
 *
 * İlk adımın grupları yalnız eyleme ve dolumsuz yerçekimine bağlıdır (özel
 * taş ateşlemesi ilk adımdan sonra gelir), bu yüzden tam çözüm yerine renk
 * dizileri üstünde hafif bir benzetim yeterlidir. Yerçekimi `yercekimi.ts`
 * ile ORTAKTIR; `onizle(...).gruplar.length > 0` ile eşdeğerliği testlidir.
 */
import { DIK, damla, gruplanir, karisikMi, karisimSonucu } from './tahta';
import { dogumYerleri, yercekimiUygula } from './yercekimi';
import type { OyunDurumu, Renk } from './types';

type TahtaParcasi = Pick<OyunDurumu, 'w' | 'h' | 'hucreler' | 'kurallar'>;

/** Yönlü karışım hamlesi (hücre indeksleri). */
export interface IndeksHamle {
  k: number;
  e: number;
}

/**
 * Bütün geçerli yönlü KARIŞIM hamleleri (iki düz, yağsız damla; özel taş
 * sürüklemeleri hariç), kaynak indeksi sonra DIK sırasıyla.
 */
export function karisimHamleleri(d: TahtaParcasi): (IndeksHamle & { sonuc: Renk })[] {
  const { w, h } = d;
  const out: (IndeksHamle & { sonuc: Renk })[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const ci = d.hucreler[i];
      const a = damla(ci);
      if (!a || a.ozel !== 'yok' || ci.yag) continue;
      for (const o of DIK) {
        const xx = x + o.x;
        const yy = y + o.y;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        const cj = d.hucreler[j];
        const b = damla(cj);
        if (!b || b.ozel !== 'yok' || cj.yag) continue;
        const s = karisimSonucu(a.renk as Renk, b.renk as Renk, d.kurallar.murekkep);
        if ('sonuc' in s) out.push({ k: i, e: j, sonuc: s.sonuc });
      }
    }
  return out;
}

/** Hazır yönlü hamleler (ilk adımda grup veren karışımlar). */
export function hazirHamleler(d: TahtaParcasi): IndeksHamle[] {
  const { w, h } = d;
  const n = w * h;
  const engel = new Uint8Array(n);
  const dolu = new Uint8Array(n);
  const grup = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = d.hucreler[i];
    if (c.delik || c.icerik?.tur === 'mermer') {
      engel[i] = 1;
      continue;
    }
    const dm = damla(c);
    if (!dm) continue;
    dolu[i] = 1;
    if (gruplanir(dm)) grup[i] = dm.renk;
  }
  const besli = dogumYerleri(w, h, engel);
  const dolu2 = new Uint8Array(n);
  const grup2 = new Uint8Array(n);
  const gor = new Uint8Array(n);
  const yigin = new Int32Array(n);
  const tasi = (a: number, b: number): void => {
    grup2[b] = grup2[a];
    grup2[a] = 0;
  };
  const out: IndeksHamle[] = [];
  for (const m of karisimHamleleri(d)) {
    dolu2.set(dolu);
    grup2.set(grup);
    dolu2[m.k] = 0;
    grup2[m.k] = 0;
    grup2[m.e] = karisikMi(m.sonuc) ? m.sonuc : 0;
    yercekimiUygula(w, h, engel, dolu2, besli, tasi);
    if (grupVar(w, h, grup2, gor, yigin)) out.push({ k: m.k, e: m.e });
  }
  return out;
}

/** Hazır hamlelerin eşsiz (yönsüz) hücre çifti sayısı (§4.7 `hazirCiftSayisi`). */
export function hazirCiftSayisi(d: TahtaParcasi): number {
  const n = d.w * d.h;
  const s = new Set<number>();
  for (const m of hazirHamleler(d)) s.add(m.k < m.e ? m.k * n + m.e : m.e * n + m.k);
  return s.size;
}

/** Grup renk dizisinde ≥ 3'lük bağlı bileşen var mı. */
function grupVar(w: number, h: number, grup: Uint8Array, gor: Uint8Array, yigin: Int32Array): boolean {
  gor.fill(0);
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const r = grup[i];
    if (!r || gor[i]) continue;
    let ust = 0;
    let boy = 0;
    yigin[ust++] = i;
    gor[i] = 1;
    while (ust) {
      const k = yigin[--ust];
      if (++boy >= 3) return true;
      const x = k % w;
      if (x > 0 && !gor[k - 1] && grup[k - 1] === r) {
        gor[k - 1] = 1;
        yigin[ust++] = k - 1;
      }
      if (x < w - 1 && !gor[k + 1] && grup[k + 1] === r) {
        gor[k + 1] = 1;
        yigin[ust++] = k + 1;
      }
      if (k >= w && !gor[k - w] && grup[k - w] === r) {
        gor[k - w] = 1;
        yigin[ust++] = k - w;
      }
      if (k + w < n && !gor[k + w] && grup[k + w] === r) {
        gor[k + w] = 1;
        yigin[ust++] = k + w;
      }
    }
  }
  return false;
}

/** `i` hücresindeki damlanın bileşeni ≥ 3 mü (garanti: renk değişimi grup doğurdu mu). */
export function hucredeGrupVar(d: Pick<OyunDurumu, 'w' | 'h' | 'hucreler'>, i: number): boolean {
  const ilk = damla(d.hucreler[i]);
  if (!gruplanir(ilk)) return false;
  const r = ilk!.renk;
  const { w, h } = d;
  const gor = new Set<number>([i]);
  const yigin = [i];
  while (yigin.length) {
    const k = yigin.pop()!;
    if (gor.size >= 3) return true;
    const x = k % w;
    const y = (k - x) / w;
    for (const o of DIK) {
      const xx = x + o.x;
      const yy = y + o.y;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (gor.has(j)) continue;
      const dj = damla(d.hucreler[j]);
      if (gruplanir(dj) && dj!.renk === r) {
        gor.add(j);
        yigin.push(j);
      }
    }
  }
  return gor.size >= 3;
}
