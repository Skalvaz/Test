/**
 * Ses ölçümü (P5): sesleri OfflineAudioContext'te gerçek motorla işler,
 * tepe / RMS ölçer; kırpılma (|örnek| > 1) ve sessizlik denetler.
 *
 * Node'da OfflineAudioContext yok; ölçüm tarayıcıda çalışır:
 *   dev/ses.html → "Ölç" ya da `window.__olc()` (sonuç konsola ve sayfaya).
 */
import type { ArayuzSesi } from '../app/sozlesme';
import { sesMotoruOlustur, type SesMotoruAyrintili } from './sesMotoru';
import { OLAY_CESITLERI, ORNEK_OLAYLAR, SESSIZ_OLAYLAR, hamleGosterisi } from './gosteri';
import type { Olay } from '../core/types';

export interface OlcumSenaryosu {
  ad: string;
  sure: number;
  sessizBeklenir?: boolean;
  calis(m: SesMotoruAyrintili, zamanla: (t: number, fn: () => void) => void): void;
}

export interface OlcumSonucu {
  ad: string;
  tepe: number;
  tepeDb: number;
  rmsDb: number;
  /** En gürültülü 50 ms penceresinin RMS'i (dBFS). */
  pencereDb: number;
  kirpilan: number;
  bozulma: number;
  sessiz: boolean;
  tamam: boolean;
}

const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);

type CevrimdisiSinif = new (kanal: number, uzunluk: number, oran: number) => OfflineAudioContext;

export async function senaryoOlc(s: OlcumSenaryosu, oran = 44100): Promise<OlcumSonucu> {
  const g = globalThis as unknown as { OfflineAudioContext?: CevrimdisiSinif; webkitOfflineAudioContext?: CevrimdisiSinif };
  const OAC = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
  if (!OAC) throw new Error('OfflineAudioContext yok');
  const ctx = new OAC(2, Math.ceil(s.sure * oran), oran);
  const m = sesMotoruOlustur({ baglam: ctx, tohum: 7 });
  m.ac();
  m.tahtaBoyutu(7, 9);
  const dilim = 128 / oran;
  const bekleyen = new Map<number, (() => void)[]>();
  const simdi: (() => void)[] = [];
  s.calis(m, (t, fn) => {
    if (t <= 0) {
      simdi.push(fn);
      return;
    }
    const k = Math.max(1, Math.round(t / dilim));
    const l = bekleyen.get(k);
    if (l) l.push(fn);
    else bekleyen.set(k, [fn]);
  });
  for (const fn of simdi) fn();
  for (const [k, l] of bekleyen) {
    if (k * dilim >= s.sure) continue;
    void ctx.suspend(k * dilim).then(() => {
      for (const fn of l) fn();
      return ctx.resume();
    });
  }
  const buf = await ctx.startRendering();
  let tepe = 0;
  let kare = 0;
  let kirpilan = 0;
  let bozulma = 0;
  const n = buf.length;
  const pencere = Math.max(1, Math.floor(oran * 0.05));
  const pencereKare = new Float64Array(Math.ceil(n / pencere));
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const v = d[i];
      const a = Math.abs(v);
      if (a > tepe) tepe = a;
      if (a > 1) kirpilan++;
      if (a > 0.8) bozulma++;
      kare += v * v;
      pencereKare[(i / pencere) | 0] += v * v;
    }
  }
  let enPencere = 0;
  for (const v of pencereKare) enPencere = Math.max(enPencere, v);
  const sessiz = tepe < 1e-3;
  return {
    ad: s.ad,
    tepe,
    tepeDb: db(tepe),
    rmsDb: db(Math.sqrt(kare / (n * buf.numberOfChannels))),
    pencereDb: db(Math.sqrt(enPencere / (pencere * buf.numberOfChannels))),
    kirpilan,
    bozulma,
    sessiz,
    tamam: kirpilan === 0 && sessiz === !!s.sessizBeklenir,
  };
}

const tek = (ad: string, sure: number, fn: (m: SesMotoruAyrintili) => void, sessizBeklenir = false): OlcumSenaryosu => ({ ad, sure, sessizBeklenir, calis: (m, z) => z(0, () => fn(m)) });

export function varsayilanSenaryolar(): OlcumSenaryosu[] {
  const s: OlcumSenaryosu[] = [];
  s.push(tek('sürükle · tutuldu', 0.3, (m) => m.tutuldu()));
  s.push(tek('sürükle · hedefe girdi (Yeşil)', 0.4, (m) => m.hedefeGirdi(6)));
  s.push(tek('sürükle · geçersiz', 0.4, (m) => m.gecersiz()));
  for (const o of Object.values(ORNEK_OLAYLAR) as Olay[]) s.push(tek(`olay · ${o.tur}`, 2.2, (m) => m.olay(o)));
  for (const o of SESSIZ_OLAYLAR) s.push(tek(`olay · ${o.tur} (sessiz)`, 0.8, (m) => m.olay(o), true));
  for (const c of OLAY_CESITLERI) s.push(tek(`olay · ${c.ad}`, 2.2, (m) => m.olay(c.olay)));
  for (const a of ['dugme', 'ac', 'kapa', 'yildiz1', 'yildiz2', 'yildiz3', 'kazandin', 'kaybettin', 'sonHamle', 'hedefTamam', 'kagitCek'] as ArayuzSesi[]) {
    s.push(tek(`arayüz · ${a}`, 2.4, (m) => m.arayuz(a)));
  }
  s.push({ ad: 'dizi · eşleşme + kaskat hamlesi', sure: 3, calis: (m, z) => hamleGosterisi().forEach((o) => z(o.t / 1000, () => m.olay(o))) });
  s.push({
    ad: 'zorlama · 30 koparma + birleşim + lale + girdap',
    sure: 3,
    calis: (m, z) =>
      z(0, () => {
        for (let i = 0; i < 30; i++) m.olay({ t: 0, tur: 'temizlendi', hucre: { x: i % 7, y: i % 9 }, id: i, renk: ([3, 5, 6] as const)[i % 3], ozel: 'yok', neden: 'birlesim', k: 1, puan: 20 });
        m.olay(ORNEK_OLAYLAR.birlesim!);
        m.olay({ t: 0, tur: 'ozelTetiklendi', hucre: { x: 3, y: 3 }, ozel: 'lale', yon: 'yatay', alan: [] });
        m.olay({ t: 0, tur: 'ozelTetiklendi', hucre: { x: 3, y: 3 }, ozel: 'girdap', yon: 'yatay', alan: [] });
        m.olay({ t: 0, tur: 'kaskat', k: 9, kademe: 'saheser' });
      }),
  });
  s.push({
    ad: 'zorlama · şölen (10 tarak, 160 ms arayla)',
    sure: 3,
    calis: (m, z) => {
      z(0, () => m.olay(ORNEK_OLAYLAR.solenBasladi!));
      for (let i = 0; i < 10; i++) z(0.16 * i, () => m.olay({ t: 0, tur: 'ozelTetiklendi', hucre: { x: i % 7, y: i }, ozel: 'tarak', yon: i % 2 ? 'dikey' : 'yatay', alan: [] }));
    },
  });
  s.push({ ad: 'ortam · Üsküdar (liman) 5 sn', sure: 5, calis: (m, z) => z(0, () => m.ortam(true, 'uskudar')) });
  s.push({ ad: 'ortam · Bursa (han) 5 sn', sure: 5, calis: (m, z) => z(0, () => m.ortam(true, 'bursa')) });
  s.push({ ad: 'müzik · dron + ud cümlesi 6 sn', sure: 6, calis: (m, z) => z(0, () => m.muzik(true)) });
  s.push({
    ad: 'karışım · ortam + müzik + hamle + kısma',
    sure: 6,
    calis: (m, z) => {
      z(0, () => {
        m.ortam(true, 'uskudar');
        m.muzik(true);
      });
      hamleGosterisi().forEach((o) => z(2 + o.t / 1000, () => m.olay(o)));
    },
  });
  s.push({
    ad: 'sessiz ayarı · hiç ses yok',
    sure: 1,
    sessizBeklenir: true,
    calis: (m, z) =>
      z(0, () => {
        m.ayarla({ sessiz: true });
        m.olay(ORNEK_OLAYLAR.birlesim!);
        m.arayuz('kazandin');
      }),
  });
  return s;
}

export async function olc(senaryolar: OlcumSenaryosu[] = varsayilanSenaryolar(), oran = 44100, ilerleme?: (r: OlcumSonucu, i: number) => void): Promise<OlcumSonucu[]> {
  const out: OlcumSonucu[] = [];
  for (let i = 0; i < senaryolar.length; i++) {
    const r = await senaryoOlc(senaryolar[i], oran);
    out.push(r);
    ilerleme?.(r, i);
  }
  return out;
}
