/**
 * Kasaba İşleri süsleri (docs/KANCALAR.md §B.3, §B.6): 8 mahalle × 6 işin
 * haritadaki prosedürel çizimi — dışa açık yüz.
 *
 * Her iş üç parça üretir (isCizimleri.ts):
 *  - durağan SVG (ip, direk, ışık noktası, hale), katmanına göre mahallenin
 *    SVG'sine girer: `arka` (arka plan yapısının üstü, terasların altı),
 *    `0..4` (o terasın lambasından hemen sonra: üstteki terasın önünde,
 *    alttakinin arkasında) ya da `on` (en önde);
 *  - canlı öğeler (salınan fener, dalgalanan bayrak, titreyen alev, dönen
 *    kanat, yanıp sönen harf…): HTML katmanında, yalnız transform/opacity;
 *    görünmeyen mahallede `.f-harita-bolge:not(.f-gorunur)` ile durur;
 *  - çapa (iş yapılınca harita oraya kayar, kutlama orada patlar).
 * Yapılmamış iş "hayalet" çizilebilir (sönük ip ve fenerler: buraya ne
 * geleceğini sezdirir; yalnız süslenen mahallede). Kilitli (sisli) mahallede
 * hiç çizilmez. Var olan çizimler (İskele kayıkları, Çarşı mahyası, kadran)
 * kalır; işler üstüne ekler.
 */
import { KASABA_ISLERI, MAHALLELER } from '../../app/katalog';
import type { KasabaIsi } from '../../app/katalog';
import type { Nokta } from './cizim';
import { CIZIMLER } from './isCizimleri';
import type { CizimBaglami } from './isCizimleri';
import { Cizim, SUS_RENKLERI, isiklar } from './susIlkel';
import type { BolgeGeo, CanliOge, Katman } from './susIlkel';

export type { BinaGeo, BolgeGeo, CanliOge, CanliTur, DugumGeo, Katman } from './susIlkel';

export interface SusSecenek {
  /** Yapılmış işler (kimlik). */
  yapilan: ReadonlySet<string>;
  /** Yapılmamış işlerin sönük ön izlemesi. */
  hayalet: boolean;
  /** Bu çizimde YENİ yapılan işler: durağan parçaları kutlama katmanına gider. */
  yeni: ReadonlySet<string>;
}

export interface KutlamaCizimi {
  id: string;
  /** Kutlama katmanındaki SVG (mahallenin küresel viewBox'ıyla). */
  svg: string;
  capa: Nokta;
  /** Sırayla yanan ışık sayısı (süre hesabı). */
  isik: number;
}

export interface MahalleSusleri {
  katman(k: Katman): string;
  canli: CanliOge[];
  kutla: KutlamaCizimi[];
  /** Binada çizilmeyecek durağan parçalar (ör. ışıklı kanat dönerken eski kanat). */
  gizle: Set<string>;
}

const KATMAN_SIRASI: readonly Katman[] = ['arka', 4, 3, 2, 1, 0, 'on'];

/** Kimliği çizimde olmayan (sonradan eklenen) iş: çapasında küçük bir ışık kümesi. */
function yedekCizim(c: Cizim, g: BolgeGeo, is: KasabaIsi): void {
  const p = { x: is.yer.x, y: g.ust + is.yer.y };
  c.capa = p;
  c.ekle('on', isiklar(c, [p, { x: p.x - 8, y: p.y + 3 }, { x: p.x + 8, y: p.y + 3 }]));
}

function isCiz(is: KasabaIsi, g: BolgeGeo, yanik: boolean, b: CizimBaglami): Cizim {
  const c = new Cizim(is.id, yanik, { x: is.yer.x, y: g.ust + is.yer.y });
  const ciz = CIZIMLER[is.id];
  if (ciz) ciz(c, g, b, is);
  else yedekCizim(c, g, is);
  return c;
}

const HEPSI: CizimBaglami = { ciziliyor: () => true };

/** İşin haritadaki çapası (küresel): kutlama ve "Yap" akışında harita buraya kayar. */
export function isCapasi(id: string, g: BolgeGeo): Nokta | null {
  const is = KASABA_ISLERI.find((x) => x.id === id);
  if (!is || is.mahalle !== g.m) return null;
  return isCiz(is, g, true, HEPSI).capa;
}

/** Mahallenin süsleri: durağan katmanlar, canlı öğeler, kutlama çizimleri. */
export function mahalleSusleri(g: BolgeGeo, s: SusSecenek): MahalleSusleri {
  const katmanlar = new Map<Katman, string>();
  const canli: CanliOge[] = [];
  const kutla: KutlamaCizimi[] = [];
  const gizle = new Set<string>();
  const ciziliyor = (id: string) => s.yapilan.has(id) || s.hayalet;
  const baglam: CizimBaglami = { ciziliyor };
  for (const is of KASABA_ISLERI) {
    if (is.mahalle !== g.m) continue;
    const yapildi = s.yapilan.has(is.id);
    if (!yapildi && !s.hayalet) continue;
    const c = isCiz(is, g, yapildi, baglam);
    if (yapildi && is.id === 'tepe.degirmenKanatlari') for (const b of g.binalar) if (b.gobek && (b.j === 1 || b.j === 3)) gizle.add(`kanat-${b.j}`);
    if (yapildi && s.yeni.has(is.id)) {
      let svg = '';
      for (const k of KATMAN_SIRASI) svg += c.parca.get(k) ?? '';
      kutla.push({ id: is.id, svg, capa: c.capa, isik: c.isik });
    } else
      for (const [k, v] of c.parca) katmanlar.set(k, (katmanlar.get(k) ?? '') + (yapildi ? v : `<g class="f-sus-hayalet" opacity=".55">${v}</g>`));
    canli.push(...c.canli);
  }
  return { katman: (k) => katmanlar.get(k) ?? '', canli, kutla, gizle };
}

/** Haritanın ortak süs tanımları (<defs> içeriği): fener gradyanları, alev, parıltı. */
export function susTanimlari(): string {
  const koyu = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const k = (s: number) => Math.round(((n >> s) & 255) * 0.45);
    return `#${((1 << 24) | (k(16) << 16) | (k(8) << 8) | k(0)).toString(16).slice(1)}`;
  };
  return `${SUS_RENKLERI.map((r, i) => `<radialGradient id="hs-f${i}" cx=".5" cy=".46" r=".62"><stop offset="0" stop-color="#FFF6D0"/><stop offset=".38" stop-color="${r}"/><stop offset="1" stop-color="${koyu(r)}"/></radialGradient>`).join('')}
    <linearGradient id="hs-alev" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF7A1A"/><stop offset=".55" stop-color="#FFB020"/><stop offset="1" stop-color="#FF5A1A" stop-opacity=".2"/></linearGradient>
    <radialGradient id="hs-parla" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".9"/><stop offset=".4" stop-color="#FFC86B" stop-opacity=".35"/><stop offset="1" stop-color="#FFB020" stop-opacity="0"/></radialGradient>
    <radialGradient id="hs-kirmizi" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF8A7A" stop-opacity=".95"/><stop offset=".4" stop-color="#FF4D4D" stop-opacity=".45"/><stop offset="1" stop-color="#FF4D4D" stop-opacity="0"/></radialGradient>
    <radialGradient id="hs-yesil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#C8FFB0" stop-opacity=".95"/><stop offset=".4" stop-color="#5AE07A" stop-opacity=".45"/><stop offset="1" stop-color="#2EE07A" stop-opacity="0"/></radialGradient>
    <radialGradient id="hs-su" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#E0FAFF" stop-opacity=".8"/><stop offset="1" stop-color="#6AE0FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="hs-kavanoz" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#F4FFB0"/><stop offset=".5" stop-color="#B8E05A" stop-opacity=".8"/><stop offset="1" stop-color="#3A5A2A" stop-opacity=".7"/></radialGradient>
    <radialGradient id="hs-kadran" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#FFFBEA"/><stop offset=".7" stop-color="#FFE3A0"/><stop offset="1" stop-color="#E8B860"/></radialGradient>
    <linearGradient id="hs-koni" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".8"/><stop offset="1" stop-color="#FFC86B" stop-opacity="0"/></linearGradient>
    <linearGradient id="hs-mazgal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD15C" stop-opacity=".8"/><stop offset="1" stop-color="#FFB020" stop-opacity="0"/></linearGradient>
    <linearGradient id="hs-huzme" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFF4C2" stop-opacity=".85"/><stop offset=".6" stop-color="#FFE3A0" stop-opacity=".25"/><stop offset="1" stop-color="#FFE3A0" stop-opacity="0"/></linearGradient>`;
}

/** Sancak bayrağı (canlı; direk durağan, cizim.ts). Kale kremi için koyu kontur. */
export function sancakOgesi(id: number, p: Nokta, m: number): CanliOge {
  const renk = MAHALLELER[m]?.vurgu ?? '#FFB020';
  const kontur = m === 7 ? '#3A2A20' : 'rgba(0,0,0,.4)';
  return {
    sahip: `sancak:${id}`,
    tur: 'dalga',
    x: p.x,
    y: p.y - 17,
    w: 14,
    h: 10,
    ic: `<path d="M0 .5L13.4 5 0 9.5Z" fill="${renk}" stroke="${kontur}" stroke-width=".8" stroke-linejoin="round"/><path d="M1.2 2.4 7 4.4" stroke="#fff" stroke-width=".8" opacity=".45"/>`,
    koken: '0 50%',
    gecikme: -((id * 0.37) % 1.5),
    sure: 1.5,
  };
}

/** Süslenmiş mahallenin işleri (kimlik → iş). */
export function mahalleIsKimlikleri(m: number): string[] {
  return KASABA_ISLERI.filter((x) => x.mahalle === m).map((x) => x.id);
}
