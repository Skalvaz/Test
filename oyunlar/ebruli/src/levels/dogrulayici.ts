/**
 * Bölüm verisinin statik doğrulaması (GDD §14.5, §15.1). Saf; bot
 * gerektirmez (bantlar sim-cli `--dogrula`'da). Boş dizi = geçti.
 *
 * Denetimler:
 *  - boyut ve aralıklar (4–8 × 4–10, hamle 1–60, garanti 0–3, doğum 6
 *    negatif olmayan tamsayı, toplam > 0, bant ve eşikler);
 *  - simge geçerliliği, zemin katmanları delikte değil, yağ/desen mermerin
 *    altında değil (bolumuYukle);
 *  - desen renkleri karışık ve bölümde yaratılabilir (iki ebeveyninin
 *    doğum ağırlığı > 0); "topla" rengi yaratılabilir ya da doğabilir;
 *  - hedefin nesnesi tahtada var (kâğıt, desen hücreleri, motif);
 *  - başlangıç tahtası grupsuz ve geçerli hamleli (bolumuYukle);
 *  - `murekkep` yalnız id ≥ 11; `zorunluIlkHamle` geçerli ve hazır;
 *  - özel taş, ipucu eli konumları tahtada; tür–garanti uyumu uyarı.
 */
import { BolumHatasi, bolumuYukle, gecerliHamleVar, gruplariBul, hamleHatasi, onizle } from '../core/index';
import type { BolumVerisi, KarisikRenk } from '../core/index';

const EBEVEYN: Record<KarisikRenk, [number, number]> = { 3: [0, 1], 5: [0, 2], 6: [1, 2] };
const TUR_GARANTI: Record<BolumVerisi['tur'], number> = { ogretim: 3, tanitim: 2, normal: 2, rahatlama: 2, zor: 1 };

/** Karışık renk bu bölümde yaratılabilir mi (iki ebeveyn doğuyor). */
function yaratilabilir(v: BolumVerisi, r: KarisikRenk): boolean {
  const [a, b] = EBEVEYN[r];
  return v.dogum[a] > 0 && v.dogum[b] > 0;
}

export function bolumDogrula(v: BolumVerisi, uyarilar: string[] = []): string[] {
  const h: string[] = [];
  const e = (s: string): void => {
    h.push(s);
  };
  const icinde = (x: number, y: number): boolean => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < v.w && y < v.h;
  if (!Number.isInteger(v.id) || v.id < 1) e(`id ${v.id} geçersiz`);
  if (!v.ad || !v.ad.trim()) e('ad boş');
  if (!(v.w >= 4 && v.w <= 8 && v.h >= 4 && v.h <= 10)) e(`boyut ${v.w}×${v.h} (4–8 × 4–10)`);
  if (!Number.isInteger(v.hamle) || v.hamle < 1 || v.hamle > 60) e(`hamle ${v.hamle} (1–60)`);
  if (!Number.isInteger(v.garanti) || v.garanti < 0 || v.garanti > 3) e(`garanti ${v.garanti} (0–3)`);
  else if (v.garanti !== TUR_GARANTI[v.tur]) uyarilar.push(`garanti ${v.garanti}, ${v.tur} için önerilen ${TUR_GARANTI[v.tur]} (K3)`);
  if (v.dogum.length !== 6 || v.dogum.some((a) => !Number.isInteger(a) || a < 0) || v.dogum.reduce((s, a) => s + a, 0) <= 0) e('doğum ağırlıkları 6 negatif olmayan tamsayı, toplam > 0');
  if (v.murekkep && v.id < 11 && !v.taslak) e(`Mürekkep karışımı yalnız bölüm 11'den sonra (K1)`);
  if (v.ozelEsikleri && !(v.ozelEsikleri[0] >= 3 && v.ozelEsikleri[0] < v.ozelEsikleri[1] && v.ozelEsikleri[1] < v.ozelEsikleri[2])) e(`özel eşikleri ${v.ozelEsikleri} artan ve ≥ 3 olmalı`);
  const [b0, b1] = v.botBandi ?? [];
  if (!(b0 >= 0 && b1 <= 100 && b0 <= b1)) e(`botBandi [${b0}, ${b1}] geçersiz`);
  if (!(v.acemiAlt >= 0 && v.acemiAlt <= 100)) e(`acemiAlt ${v.acemiAlt} geçersiz`);
  const [y2, y3] = v.yildizEsikleri ?? [];
  if (!(y2 > 0 && y3 >= y2)) e(`yıldız eşikleri [${y2}, ${y3}] geçersiz`);
  if (!v.hedefler?.length || v.hedefler.length > 2) e('1–2 hedef olmalı (§7)');
  if (h.length) return h;

  // Yükleme: simgeler, zemin, özel taşlar, grupsuz ve oynanabilir ilk tahta.
  let d;
  try {
    d = bolumuYukle(v, 0);
  } catch (x) {
    if (x instanceof BolumHatasi) return [...h, x.message];
    throw x;
  }
  if (gruplariBul(d).length) e('ilk tahtada grup var');
  if (!gecerliHamleVar(d)) e('ilk tahtada geçerli hamle yok');
  for (const [x, y] of v.zemin?.kagit ?? []) if (d.hucreler[y * v.w + x].delik) e(`kâğıt (${x},${y}) delikte`);
  // Desen.
  const desen = v.zemin?.desen;
  for (const [x, y, r] of desen?.hucreler ?? []) if (!yaratilabilir(v, r)) e(`desen (${x},${y}) rengi ${r} bu bölümde yaratılamaz (ebeveyn doğmuyor)`);
  // Hedefler.
  let kagitVar = false;
  for (const c of d.hucreler) if (c.kagit > 0) kagitVar = true;
  for (const g of v.hedefler) {
    if (g.tur === 'topla') {
      if (![3, 5, 6].includes(g.renk)) e(`topla rengi ${g.renk} karışık değil`);
      else if (!yaratilabilir(v, g.renk) && v.dogum[[3, 5, 6].indexOf(g.renk) + 3] <= 0) e(`topla rengi ${g.renk} bu bölümde ne doğar ne yaratılır`);
      if (!(g.adet > 0)) e('topla adedi > 0 olmalı');
    } else if (g.tur === 'kagit') {
      if (!kagitVar) e('kâğıt hedefi var ama tahtada kâğıt yok');
    } else if (g.tur === 'desen') {
      if (!desen?.hucreler.length) e('desen hedefi var ama desen hücresi yok');
      else if (desen.motif !== g.motif) e(`desen motifi ${desen.motif} ≠ hedef ${g.motif}`);
    } else if (g.tur === 'puan') {
      if (!(g.puan > 0)) e('puan hedefi > 0 olmalı');
      if (v.hedefler.length === 1) uyarilar.push('puan hedefi yalnız ikinci hedef olarak önerilir (§7.4)');
    }
  }
  // Zorunlu ilk hamle: geçerli ve hazır.
  const z = v.zorunluIlkHamle;
  if (z) {
    const hm = { tur: 'surukle' as const, kaynak: { x: z.kaynak[0], y: z.kaynak[1] }, hedef: { x: z.hedef[0], y: z.hedef[1] } };
    const hata = hamleHatasi(d, hm);
    if (hata) e(`zorunlu ilk hamle geçersiz (${hata})`);
    else if (onizle(d, hm).gruplar.length === 0) e('zorunlu ilk hamle hazır değil (ilk adımda grup yok)');
  }
  for (const ip of v.ipuclari ?? []) for (const [x, y] of ip.el ?? []) if (!icinde(x, y)) e(`ipucu eli (${x},${y}) tahta dışında`);
  if (v.tur === 'ogretim' && !v.elleEsik) uyarilar.push('öğretim bölümünde elleEsik önerilir (§14.4)');
  return h;
}

/** Bölüm listesi denetimi: kimlikler eşsiz ve sıralı. */
export function listeDogrula(l: readonly BolumVerisi[]): string[] {
  const h: string[] = [];
  const g = new Set<number>();
  for (const v of l) {
    if (g.has(v.id)) h.push(`bölüm ${v.id} iki kez`);
    g.add(v.id);
  }
  return h;
}
