/**
 * GEÇİCİ dev sayfası (yalnız dev/kasaba.html): haritada Kasaba İşleri
 * süsleri, çatı sancakları, iş kutlaması ve Mahalle şenliği.
 *
 * Parametreler:
 *  - mahalle=0..7   harita bu mahalleye kaydırılır (varsayılan 0)
 *  - isler=bos|yarim|tam|<n>|<id,id,…>   yapılmış işler (her mahallede ilk n iş;
 *                   yarim = 3, tam = 6; varsayılan tam)
 *  - simdiki=1..41  oynanacak bölüm (41 = hepsi açık)
 *  - sancak=1       6–40'ın hepsine sancak; sancak=yarim: tek bölümlere
 *  - kutla=<iş id>  yükledikten sonra bu iş "yeni yapıldı" (kutlama)
 *  - senlik=0..7    yükledikten sonra o mahallede Mahalle şenliği
 *  - temiz=1        üst/alt çubuklar gizli (bütün mahalle tek karede)
 *  - az=1           hareketi azalt
 * `window.__kasaba`: { ui, vm(isler), goster(isler), kaydir(m) }.
 */
import '../../style.css';
import { Arayuz } from '../arayuz';
import { KASABA_ISLERI } from '../../app/katalog';
import { BOLGE_H, HARITA_W, bolgeUst } from '../harita/cizim';
import type { BolumDugumuVM, HaritaVM, Yildiz } from '../tipler';

const p = new URLSearchParams(location.search);
const mahalle = Math.max(0, Math.min(7, Number(p.get('mahalle') ?? 0)));
const simdiki = Number(p.get('simdiki') ?? 41);

const app = document.getElementById('app')!;
document.body.style.cssText = 'margin:0;background:#05040E';
if (p.get('temiz') === '1') {
  const st = document.createElement('style');
  st.textContent = '.f-harita-ust,.f-harita-alt-kap{display:none!important}.f-harita-kaydir{padding-top:0!important;padding-bottom:0!important}';
  document.head.appendChild(st);
}

const log = (...a: unknown[]) => console.log('[kasaba]', ...a);
const ui = new Arayuz({
  kok: app,
  palet: 'standart',
  hareketiAzalt: p.get('az') === '1',
  ses: { arayuz: (t) => log('ses', t) },
  titresim: (x) => log('titreşim', x),
  geri: {
    duraklatIstendi: () => undefined,
    guclendiriciSecildi: () => undefined,
    korukSecildi: () => undefined,
    secimIptal: () => undefined,
    ayarDegisti: () => undefined,
    balonlariSifirla: () => undefined,
    kayitKodu: () => '',
    kayitOnizle: () => ({ gecerli: false, hata: '' }),
    kayitYukle: () => false,
    ilerlemeyiSifirla: () => undefined,
    tabloKarari: () => undefined,
    tabloTuvali: () => document.createElement('canvas'),
    desenTak: () => undefined,
    fitilSec: () => undefined,
    gokyuzuSec: () => undefined,
    tozHarca: () => undefined,
  },
});

const YILDIZ: Yildiz[] = [3, 3, 2, 3, 1, 2, 3, 3, 2, 1, 3, 2, 3, 3, 2, 3, 2, 1, 3, 3, 2, 3, 3, 2, 1, 3, 3, 2, 3, 3, 2, 3, 3, 3, 2, 3, 2, 3, 3, 3];

function islerParam(s: string | null): string[] {
  const v = s ?? 'tam';
  const n = v === 'bos' ? 0 : v === 'yarim' ? 3 : v === 'tam' ? 6 : /^\d+$/.test(v) ? Number(v) : -1;
  if (n < 0) return v.split(',').filter(Boolean);
  return KASABA_ISLERI.filter((x) => x.sira < n).map((x) => x.id);
}

function vm(isler: string[]): HaritaVM {
  const sancak = p.get('sancak');
  const bolumler: BolumDugumuVM[] = Array.from({ length: 40 }, (_, i) => {
    const id = i + 1;
    const muhurlu = id >= 6;
    const s = muhurlu && (sancak === '1' || (sancak === 'yarim' && id % 2 === 1));
    if (id < simdiki) return { id, yildiz: YILDIZ[i], durum: 'acik', muhur: muhurlu ? (s ? 3 : id % 3) : undefined, sancak: s };
    if (id === simdiki) return { id, yildiz: 0, durum: 'simdiki' };
    return { id, yildiz: 0, durum: 'kilitli' };
  });
  const toplam = bolumler.reduce((a, b) => a + b.yildiz, 0);
  return {
    toplamYildiz: toplam,
    bolumler,
    ustalar: Array.from({ length: 8 }, (_, i) => ({ id: 101 + i, acik: toplam >= (i + 1) * 15 && simdiki > 12, yildiz: 0 as Yildiz, gerekenYildiz: (i + 1) * 15, eksikYildiz: Math.max(0, (i + 1) * 15 - toplam), ...(simdiki > 12 ? {} : { kapiBolumu: 12 }) })),
    motifler: [],
    seri: { gun: 5, basamak: 'cira' },
    gunluk: { acik: true, tamam: 1, toplam: 3, acilisBolumu: 14 },
    sonsuz: { acik: false, siradaki: 1 },
    kasaba: { acik: true, kandil: 7, isler, yapilabilir: true },
  };
}

/** Haritayı mahallenin ortasına kaydırır (mahalle tek karede görünsün). */
function kaydir(m: number): void {
  const k = document.querySelector<HTMLElement>('.f-harita-kaydir');
  const ic = document.querySelector<HTMLElement>('.f-harita-icerik');
  if (!k || !ic) return;
  const olcek = ic.clientWidth / HARITA_W;
  const orta = ic.offsetTop + (bolgeUst(m) + BOLGE_H / 2) * olcek;
  k.scrollTop = Math.max(0, orta - k.clientHeight / 2);
}

let isler = islerParam(p.get('isler'));
const kutla = p.get('kutla');
if (kutla) isler = isler.filter((x) => x !== kutla);
void ui.harita(vm(isler));
// Açılıştaki süzülüş (900 ms, yavaş makinede daha uzun) bitince de kaydır.
// Kutlama/şenlikte harita kendisi kayar: dev kaydırması yalnız ondan önce.
const kendiKayar = p.get('kutla') !== null || p.get('senlik') !== null;
for (const t of kendiKayar ? [1200, 1600] : [1200, 2000, 2600, 3200]) setTimeout(() => kaydir(mahalle), t);
if (kutla)
  setTimeout(() => {
    isler = [...isler, kutla];
    void ui.harita(vm(isler));
  }, 1800);
const senlik = p.get('senlik');
if (senlik !== null)
  setTimeout(() => {
    const ek = ui as unknown as { haritaSenligi?: (m: number) => Promise<void> };
    void ek.haritaSenligi?.(Number(senlik));
  }, 1800);

(window as unknown as Record<string, unknown>).__kasaba = {
  ui,
  vm,
  kaydir,
  goster: (yeni: string[]) => {
    isler = yeni;
    return ui.harita(vm(isler));
  },
};
