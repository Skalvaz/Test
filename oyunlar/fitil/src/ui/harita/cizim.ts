/**
 * Fener Koyu haritasının prosedürel çizimi (§10.1, §11 kanca 20–21).
 *
 * Koy denizden (altta) kaleye (üstte) tırmanan bir yamaç kasabasıdır:
 * her bölüm bir terasın üstündeki bir binadır; teraslar sağlı sollu dizilir,
 * aralarından fitil (ip) yol kıvrılarak çıkar. Kazanılan yollar akkor
 * yanar. Yıldıza göre pencereler yanar (1★ 1/3, 2★ 2/3, 3★ hepsi).
 *
 * Koordinatlar: genişlik 400 birim, her mahalle `BOLGE_H` yüksekliğinde;
 * küresel y yukarıdan aşağı artar (mahalle 0 en altta). Her mahalle kendi
 * SVG'sinde, aynı küresel koordinatlarla (viewBox kaydırılarak) çizilir.
 * Durağan çizimdir; canlı öğeler (çatı fişeği, nabız) HTML katmanındadır.
 */
import { Rng } from '../../platform/rng';
import { GOKYUZU, MAHALLELER } from '../../app/katalog';
import { motifIsaretleme } from '../ikonlar';
import type { Motif } from '../../core/types';
import type { BolumDugumuVM } from '../tipler';

export const HARITA_W = 400;
export const BOLGE_H = 660;
export const UST_PAY = 280;
export const ALT_PAY = 300;
export const MAHALLE_SAYISI = 8;
export const HARITA_H = UST_PAY + MAHALLE_SAYISI * BOLGE_H + ALT_PAY;

const f = (n: number) => (Math.round(n * 10) / 10).toString();

export interface Nokta {
  x: number;
  y: number;
}

/** Mahallenin küresel üst y'si. */
export function bolgeUst(m: number): number {
  return UST_PAY + (MAHALLE_SAYISI - 1 - m) * BOLGE_H;
}

/** Bölüm düğümünün yeri (id 1..40). */
export function dugumKonumu(id: number): Nokta & { taraf: 'sol' | 'sag' } {
  const g = id - 1;
  const m = Math.floor(g / 5);
  const j = g % 5;
  const r = new Rng(`dugum-${id}`);
  const taraf = g % 2 === 0 ? 'sol' : 'sag';
  const x = (taraf === 'sol' ? 136 : 264) + (r.float() * 16 - 8);
  const y = bolgeUst(m) + BOLGE_H - 92 - j * ((BOLGE_H - 184) / 4);
  return { x, y, taraf };
}

/** Usta Bölümü (sıra 1..8) deniz feneri: mahalle sırasının üst sınırında, üst düğümün tarafında. */
export function ustaKonumu(sira: number): Nokta {
  const m = sira - 1;
  const ust = dugumKonumu(Math.min(40, m * 5 + 6));
  const sol = m === 7 ? false : ust.taraf === 'sol';
  return { x: sol ? 60 : 340, y: bolgeUst(m) + 6 };
}

/** Başlangıç iskelesi (fitilin ucu). */
export function baslangicKonumu(): Nokta {
  return { x: 200, y: HARITA_H - ALT_PAY + 150 };
}

function karistir(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const m = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}

function gok(m: number) {
  return GOKYUZU[MAHALLELER[Math.max(0, Math.min(7, m))].gokyuzu];
}

/** Mahalle sınırındaki gök rengi (iki tema yarı yarıya). */
function sinirRengi(alttaki: number): string {
  if (alttaki < 0) return gok(0).alt;
  if (alttaki >= 7) return gok(7).ust;
  return karistir(gok(alttaki).ust, gok(alttaki + 1).alt, 0.5);
}

/** İki düğüm arası S eğrisi. */
export function yolParcasi(a: Nokta, b: Nokta): string {
  const d = Math.abs(a.y - b.y) * 0.55;
  return `M${f(a.x)} ${f(a.y)}C${f(a.x)} ${f(a.y - d)} ${f(b.x)} ${f(b.y + d)} ${f(b.x)} ${f(b.y)}`;
}

// ───────────────────────── Bina ve teras ─────────────────────────

interface BinaSonucu {
  svg: string;
  cati: Nokta;
}

type Durum = BolumDugumuVM['durum'];

const PENCERE_ISIK = '#FFC86B';

function pencereler(r: Rng, x0: number, y0: number, sut: number, sat: number, aralikX: number, aralikY: number, pw: number, ph: number, yanik: number, kemer = false, kilitli = false): string {
  let s = '';
  const toplam = sut * sat;
  // Yanacak pencereler belirlenimli sırayla dağıtılır.
  const sira = Array.from({ length: toplam }, (_, i) => i);
  for (let i = toplam - 1; i > 0; i--) {
    const j = r.int(i + 1);
    [sira[i], sira[j]] = [sira[j], sira[i]];
  }
  const yanar = new Set(sira.slice(0, yanik));
  for (let i = 0; i < sut; i++)
    for (let j = 0; j < sat; j++) {
      const k = j * sut + i;
      const x = x0 + i * aralikX;
      const y = y0 + j * aralikY;
      const yan = yanar.has(k);
      const yol = kemer
        ? `M${f(x)} ${f(y + ph)}V${f(y + pw / 2)}a${f(pw / 2)} ${f(pw / 2)} 0 0 1 ${f(pw)} 0V${f(y + ph)}z`
        : `M${f(x)} ${f(y)}h${f(pw)}v${f(ph)}h${f(-pw)}z`;
      if (yan) {
        s += `<rect x="${f(x - pw * 0.7)}" y="${f(y - ph * 0.4)}" width="${f(pw * 2.4)}" height="${f(ph * 1.8)}" rx="${f(pw)}" fill="#FFB020" opacity=".16"/>`;
        s += `<path d="${yol}" fill="${PENCERE_ISIK}"/>`;
        if (!kemer) s += `<path d="M${f(x + pw / 2)} ${f(y)}v${f(ph)}M${f(x)} ${f(y + ph / 2)}h${f(pw)}" stroke="#8A5A20" stroke-width=".7" opacity=".7"/>`;
      } else {
        s += `<path d="${yol}" fill="${kilitli ? '#0C0814' : '#160F22'}" stroke="#3A3048" stroke-width=".6" opacity=".9"/>`;
      }
    }
  return s;
}

/** Pencere sayısı 3'ün katı tutulur: 1★ = 1/3, 2★ = 2/3, 3★ = hepsi. */
function yanikSayisi(toplam: number, yildiz: number, durum: Durum): number {
  if (durum !== 'acik') return 0;
  return Math.round((toplam * yildiz) / 3);
}

function bina(tema: number, cx: number, taban: number, r: Rng, yildiz: number, durum: Durum, ozel: number): BinaSonucu {
  const kil = durum === 'kilitli';
  const kat = (c: string) => (kil ? karistir(c, '#05030A', 0.55) : c);
  let s = '';
  let cati: Nokta = { x: cx, y: taban - 80 };
  switch (tema) {
    case 0: {
      // İskele: ahşap ev, kırma çatı, tahta kaplama.
      const w = 66 + r.int(14);
      const hh = 56 + r.int(14);
      const x = cx - w / 2;
      const y = taban - hh;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#3A2618')}"/>`;
      for (let k = 1; k < hh / 7; k++) s += `<path d="M${f(x)} ${f(y + k * 7)}h${w}" stroke="${kat('#24160D')}" stroke-width="1"/>`;
      s += `<path d="M${f(x - 7)} ${f(y + 2)}L${f(cx)} ${f(y - 30)}L${f(x + w + 7)} ${f(y + 2)}z" fill="${kat('#5A1E14')}"/>`;
      s += `<path d="M${f(x - 7)} ${f(y + 2)}L${f(cx)} ${f(y - 30)}L${f(x + w + 7)} ${f(y + 2)}" fill="none" stroke="${kat('#2A0E08')}" stroke-width="2.4"/>`;
      s += `<rect x="${f(cx + w * 0.2)}" y="${f(y - 26)}" width="7" height="16" fill="${kat('#2A1A14')}"/>`;
      s += pencereler(r, x + 9, y + 10, 3, 2, (w - 26) / 2, 22, 8, 11, yanikSayisi(6, yildiz, durum), false, kil);
      s += `<rect x="${f(cx - 6)}" y="${f(taban - 18)}" width="12" height="18" fill="${kat('#1A0E06')}"/>`;
      cati = { x: cx, y: y - 34 };
      break;
    }
    case 1: {
      // Çarşı: kubbeli taş yapı, kemerli pencereler.
      const w = 70 + r.int(12);
      const hh = 54 + r.int(10);
      const x = cx - w / 2;
      const y = taban - hh;
      const kr = w * 0.3;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#3A2E4A')}"/>`;
      s += `<rect x="${f(x - 3)}" y="${f(y - 4)}" width="${w + 6}" height="6" fill="${kat('#4A3C5C')}"/>`;
      s += `<path d="M${f(cx - kr)} ${f(y - 4)}a${f(kr)} ${f(kr * 0.95)} 0 0 1 ${f(kr * 2)} 0z" fill="${kat('#4A3A60')}"/>`;
      s += `<path d="M${f(cx - kr * 0.55)} ${f(y - kr * 0.75)}a${f(kr * 0.6)} ${f(kr * 0.4)} 0 0 1 ${f(kr * 0.5)} -${f(kr * 0.15)}" stroke="#fff" stroke-opacity=".12" stroke-width="2" fill="none"/>`;
      s += `<path d="M${f(cx)} ${f(y - 4 - kr * 0.95)}v-9" stroke="${kat('#D9A441')}" stroke-width="1.6"/><circle cx="${f(cx)}" cy="${f(y - 15 - kr * 0.95)}" r="2.2" fill="${kat('#D9A441')}"/>`;
      if (ozel % 2 === 0) {
        const mx = x + w + 6;
        s += `<rect x="${f(mx)}" y="${f(taban - hh - 54)}" width="7" height="${hh + 54}" fill="${kat('#3A2E4A')}"/><path d="M${f(mx - 1)} ${f(taban - hh - 54)}l4.5 -14 4.5 14z" fill="${kat('#4A3A60')}"/><rect x="${f(mx - 2)}" y="${f(taban - hh - 30)}" width="11" height="3" fill="${kat('#4A3C5C')}"/>`;
      }
      s += pencereler(r, x + 9, y + 12, 3, 2, (w - 26) / 2, 22, 8, 13, yanikSayisi(6, yildiz, durum), true, kil);
      cati = { x: cx, y: y - 4 - kr - 16 };
      break;
    }
    case 2: {
      // Liman: ambar, alçak üçgen alınlık, büyük kapı.
      const w = 82 + r.int(10);
      const hh = 52 + r.int(8);
      const x = cx - w / 2;
      const y = taban - hh;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#1E3440')}"/>`;
      s += `<path d="M${f(x - 5)} ${f(y + 1)}L${f(cx)} ${f(y - 18)}L${f(x + w + 5)} ${f(y + 1)}z" fill="${kat('#2A4A56')}"/>`;
      s += `<path d="M${f(cx - 13)} ${f(taban)}v-24a13 13 0 0 1 26 0v24z" fill="${kat('#0E1A22')}"/><path d="M${f(cx - 13)} ${f(taban - 12)}h26M${f(cx)} ${f(taban - 37)}v37" stroke="${kat('#2A4A56')}" stroke-width="1.2"/>`;
      s += pencereler(r, x + 7, y + 8, 6, 1, (w - 22) / 5, 0, 7, 9, yanikSayisi(6, yildiz, durum), false, kil);
      s += `<circle cx="${f(cx)}" cy="${f(y - 7)}" r="3.5" fill="${kil ? '#0C0814' : yildiz > 0 ? PENCERE_ISIK : '#160F22'}"/>`;
      cati = { x: cx, y: y - 24 };
      break;
    }
    case 3: {
      // Saat Kulesi mahallesi: dar uzun konaklar; zor bölümde saat kulesinin kendisi.
      if (ozel === 4) {
        const w = 40;
        const hh = 138;
        const x = cx - w / 2;
        const y = taban - hh;
        s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#4A2E26')}"/>`;
        s += `<rect x="${f(x - 4)}" y="${f(y + 30)}" width="${w + 8}" height="5" fill="${kat('#5A3A30')}"/>`;
        s += `<path d="M${f(x - 5)} ${f(y)}L${f(cx)} ${f(y - 34)}L${f(x + w + 5)} ${f(y)}z" fill="${kat('#2A1A1A')}"/>`;
        const saatIsik = !kil && yildiz > 0;
        s += `<circle cx="${f(cx)}" cy="${f(y + 15)}" r="13" fill="${saatIsik ? '#FFE3A0' : kat('#1A1220')}" stroke="${kat('#D9A441')}" stroke-width="2"/>`;
        if (saatIsik) s += `<circle cx="${f(cx)}" cy="${f(y + 15)}" r="24" fill="#FFB020" opacity=".18"/>`;
        s += `<path d="M${f(cx)} ${f(y + 15)}v-9M${f(cx)} ${f(y + 15)}h6" stroke="#3A2416" stroke-width="1.8" stroke-linecap="round"/>`;
        s += pencereler(r, x + 8, y + 46, 2, 3, 16, 26, 8, 14, yanikSayisi(6, yildiz, durum), true, kil);
        cati = { x: cx, y: y - 38 };
      } else {
        const w = 56 + r.int(10);
        const hh = 74 + r.int(18);
        const x = cx - w / 2;
        const y = taban - hh;
        s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#4A2A22')}"/>`;
        s += `<path d="M${f(x - 5)} ${f(y + 2)}L${f(x + 10)} ${f(y - 20)}H${f(x + w - 10)}L${f(x + w + 5)} ${f(y + 2)}z" fill="${kat('#2A1616')}"/>`;
        s += `<rect x="${f(x)}" y="${f(y + hh * 0.48)}" width="${w}" height="4" fill="${kat('#5A3A30')}"/>`;
        s += pencereler(r, x + 9, y + 10, 2, 3, w - 26, 24, 9, 14, yanikSayisi(6, yildiz, durum), false, kil);
        cati = { x: cx, y: y - 24 };
      }
      break;
    }
    case 4: {
      // Bahçeler: köşk, iki kat geniş saçak; yanında ağaçlar.
      const w = 82 + r.int(10);
      const hh = 50 + r.int(8);
      const x = cx - w / 2;
      const y = taban - hh;
      const agacX = cx + (r.chance(0.5) ? -1 : 1) * (w / 2 + 6);
      s += `<g fill="${kat('#16301C')}"><circle cx="${f(agacX)}" cy="${f(taban - 34)}" r="17"/><circle cx="${f(agacX - 9)}" cy="${f(taban - 22)}" r="13"/><circle cx="${f(agacX + 10)}" cy="${f(taban - 24)}" r="12"/></g><rect x="${f(agacX - 2)}" y="${f(taban - 14)}" width="4" height="14" fill="${kat('#2A1A10')}"/>`;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#3A3222')}"/>`;
      s += `<path d="M${f(x - 12)} ${f(y + 4)}L${f(x + 8)} ${f(y - 10)}H${f(x + w - 8)}L${f(x + w + 12)} ${f(y + 4)}z" fill="${kat('#2A1E12')}"/>`;
      s += `<path d="M${f(x + 6)} ${f(y - 10)}L${f(x + 22)} ${f(y - 24)}H${f(x + w - 22)}L${f(x + w - 6)} ${f(y - 10)}z" fill="${kat('#3A2A18')}"/>`;
      s += pencereler(r, x + 8, y + 10, 4, 1, (w - 24) / 3, 0, 8, 14, yanikSayisi(4, yildiz, durum) , false, kil);
      s += pencereler(r, x + 14, y + 30, 2, 1, w - 36, 0, 8, 10, Math.max(0, yanikSayisi(6, yildiz, durum) - yanikSayisi(4, yildiz, durum)), false, kil);
      cati = { x: cx, y: y - 30 };
      break;
    }
    case 5: {
      // Tepe: yel değirmeni, rasathane, taş evler.
      if (ozel === 1 || ozel === 3) {
        const y = taban - 80;
        s += `<path d="M${f(cx - 18)} ${f(taban)}L${f(cx - 12)} ${f(y)}H${f(cx + 12)}L${f(cx + 18)} ${f(taban)}z" fill="${kat('#3A2E3E')}"/>`;
        s += `<path d="M${f(cx - 15)} ${f(y + 1)}a15 13 0 0 1 30 0z" fill="${kat('#2A1E2A')}"/>`;
        const kanat = (a: number) => {
          const rad = (a * Math.PI) / 180;
          const ux = Math.cos(rad);
          const uy = Math.sin(rad);
          return `<path d="M${f(cx)} ${f(y - 4)}L${f(cx + ux * 46 - uy * 5)} ${f(y - 4 + uy * 46 + ux * 5)}L${f(cx + ux * 46 + uy * 4)} ${f(y - 4 + uy * 46 - ux * 4)}z" fill="${kat('#4A3A3E')}" stroke="${kat('#2A1E22')}" stroke-width="1"/>`;
        };
        s += kanat(20) + kanat(110) + kanat(200) + kanat(290);
        s += `<circle cx="${f(cx)}" cy="${f(y - 4)}" r="3.5" fill="${kat('#D9A441')}"/>`;
        s += pencereler(r, cx - 4, y + 16, 1, 3, 0, 18, 8, 11, yanikSayisi(3, yildiz, durum), true, kil);
        cati = { x: cx, y: y - 50 };
      } else if (ozel === 4) {
        const w = 66;
        const hh = 46;
        const x = cx - w / 2;
        const y = taban - hh;
        s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#3A3048')}"/>`;
        s += `<path d="M${f(x + 4)} ${f(y)}a${f(w / 2 - 4)} ${f(w / 2 - 6)} 0 0 1 ${f(w - 8)} 0z" fill="${kat('#5A5070')}"/>`;
        s += `<path d="M${f(cx - 3)} ${f(y - w / 2 + 8)}h6v${f(w / 2 - 8)}h-6z" fill="${kil ? '#0C0814' : yildiz > 0 ? PENCERE_ISIK : '#160F22'}"/>`;
        s += `<path d="M${f(cx + 4)} ${f(y - 20)}l20 -16" stroke="${kat('#8A80A0')}" stroke-width="4" stroke-linecap="round"/>`;
        s += pencereler(r, x + 8, y + 14, 3, 2, (w - 24) / 2, 14, 8, 8, yanikSayisi(6, yildiz, durum), false, kil);
        cati = { x: cx, y: y - w / 2 - 6 };
      } else {
        const w = 58 + r.int(10);
        const hh = 54 + r.int(10);
        const x = cx - w / 2;
        const y = taban - hh;
        s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#3E3446')}"/>`;
        s += `<path d="M${f(x - 5)} ${f(y + 2)}L${f(cx)} ${f(y - 24)}L${f(x + w + 5)} ${f(y + 2)}z" fill="${kat('#2A1E30')}"/>`;
        s += pencereler(r, x + 8, y + 10, 3, 2, (w - 24) / 2, 20, 8, 11, yanikSayisi(6, yildiz, durum), false, kil);
        cati = { x: cx, y: y - 28 };
      }
      break;
    }
    case 6: {
      // Fabrika: tuğla, testere çatı, baca ve duman.
      const w = 84 + r.int(10);
      const hh = 52 + r.int(10);
      const x = cx - w / 2;
      const y = taban - hh;
      const bx = cx + (r.chance(0.5) ? -1 : 1) * (w / 2 - 10);
      s += `<rect x="${f(bx - 6)}" y="${f(y - 58)}" width="12" height="${hh + 58}" fill="${kat('#4A2420')}"/><rect x="${f(bx - 7.5)}" y="${f(y - 60)}" width="15" height="5" fill="${kat('#3A1A16')}"/>`;
      s += `<path d="M${f(bx - 6)} ${f(y - 40)}h12M${f(bx - 6)} ${f(y - 22)}h12" stroke="${kat('#FFB020')}" stroke-opacity="${kil ? 0 : 0.35}" stroke-width="1.6"/>`;
      if (!kil) s += `<g fill="#6A6070" opacity=".35"><circle cx="${f(bx + 4)}" cy="${f(y - 72)}" r="8"/><circle cx="${f(bx + 14)}" cy="${f(y - 86)}" r="11"/><circle cx="${f(bx + 28)}" cy="${f(y - 100)}" r="14"/></g>`;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#4A2622')}"/>`;
      const dis = 3;
      let tes = `M${f(x)} ${f(y + 1)}`;
      for (let k = 0; k < dis; k++) tes += `L${f(x + (k * w) / dis)} ${f(y - 16)}L${f(x + ((k + 1) * w) / dis)} ${f(y + 1)}`;
      s += `<path d="${tes}z" fill="${kat('#2A1614')}"/>`;
      for (let k = 0; k < dis; k++) s += `<path d="M${f(x + (k * w) / dis + 2)} ${f(y - 12)}l${f(w / dis - 6)} 11" stroke="${kil ? '#0C0814' : yildiz > 0 ? '#FFC86B' : '#2A2030'}" stroke-width="2.4" opacity=".75"/>`;
      for (let k = 1; k < hh / 8; k++) s += `<path d="M${f(x)} ${f(y + k * 8)}h${w}" stroke="${kat('#3A1A18')}" stroke-width=".8"/>`;
      s += pencereler(r, x + 8, y + 10, 3, 2, (w - 26) / 2, 20, 10, 12, yanikSayisi(6, yildiz, durum), false, kil);
      cati = { x: bx, y: y - 70 };
      break;
    }
    default: {
      // Kale: mazgallı kule.
      const w = 52 + r.int(10);
      const hh = 82 + r.int(18) + (ozel === 4 ? 30 : 0);
      const x = cx - w / 2;
      const y = taban - hh;
      s += `<rect x="${f(x)}" y="${f(y)}" width="${w}" height="${hh}" fill="${kat('#4A4250')}"/>`;
      for (let k = 1; k < hh / 12; k++) s += `<path d="M${f(x)} ${f(y + k * 12)}h${w}" stroke="${kat('#3A3240')}" stroke-width="1"/>`;
      const diş = 5;
      for (let k = 0; k < diş; k++) if (k % 2 === 0) s += `<rect x="${f(x - 3 + (k * (w + 6)) / diş)}" y="${f(y - 9)}" width="${f((w + 6) / diş)}" height="10" fill="${kat('#4A4250')}"/>`;
      s += `<rect x="${f(x - 3)}" y="${f(y - 1)}" width="${w + 6}" height="5" fill="${kat('#5A5260')}"/>`;
      s += `<path d="M${f(cx)} ${f(y - 9)}v-26" stroke="${kat('#2A2230')}" stroke-width="1.6"/><path d="M${f(cx)} ${f(y - 35)}l16 5-16 5z" fill="${kat('#B8381C')}"/>`;
      s += pencereler(r, x + 10, y + 14, 2, 3, w - 28, (hh - 40) / 3, 8, 13, yanikSayisi(6, yildiz, durum), true, kil);
      s += `<path d="M${f(cx - 9)} ${f(taban)}v-14a9 9 0 0 1 18 0v14z" fill="${kat('#1A1420')}"/>`;
      cati = { x: cx, y: y - 40 };
      break;
    }
  }
  return { svg: s, cati };
}

/** Teras (bina ve düğümün durduğu set). */
function teras(tema: number, taraf: 'sol' | 'sag', ucX: number, zemin: number, r: Rng, kilitli: boolean): string {
  const kat = (c: string) => (kilitli ? karistir(c, '#05030A', 0.5) : c);
  const ust = ['#3A2A1C', '#3A3448', '#2A3A40', '#3A2A2A', '#1E3A22', '#22381E', '#3A1E1A', '#3A3646'][tema];
  const yuz = ['#24160D', '#221C30', '#18262C', '#241818', '#16241A', '#182818', '#24120E', '#26222E'][tema];
  const dx = taraf === 'sol' ? 1 : -1;
  const kenar = taraf === 'sol' ? -12 : 412;
  const uc = ucX + dx * 14;
  let s = '';
  // Gövde (aşağı doğru kararır)
  s += `<path d="M${kenar} ${f(zemin)}H${f(uc - dx * 12)}Q${f(uc)} ${f(zemin)} ${f(uc - dx * 4)} ${f(zemin + 18)}L${f(uc - dx * 18)} ${f(zemin + 96)}H${kenar}z" fill="url(#hb-yuz-${taraf})" />`;
  s += `<path d="M${kenar} ${f(zemin)}H${f(uc - dx * 12)}Q${f(uc)} ${f(zemin)} ${f(uc - dx * 4)} ${f(zemin + 18)}L${f(uc - dx * 7)} ${f(zemin + 30)}H${kenar}z" fill="${kat(yuz)}"/>`;
  // Taş/tahta dokusu
  if (tema === 0) {
    for (let k = 0; k < 9; k++) {
      const px = taraf === 'sol' ? 4 + k * ((uc - 20) / 9) : uc + 16 + k * ((396 - uc - 16) / 9);
      s += `<path d="M${f(px)} ${f(zemin + 6)}v${f(60 + r.int(30))}" stroke="${kat('#1A0E06')}" stroke-width="4" opacity=".8"/>`;
    }
  } else {
    for (let k = 0; k < 3; k++) {
      const yy = zemin + 8 + k * 8;
      let x = taraf === 'sol' ? -10 + (k % 2) * 9 : uc + 4 + (k % 2) * 9;
      const son = taraf === 'sol' ? uc - 8 : 410;
      while (x < son) {
        const bw = 14 + r.int(10);
        s += `<path d="M${f(x)} ${f(yy)}h${f(Math.min(bw, son - x) - 1.5)}" stroke="${kat('#000000')}" stroke-opacity=".28" stroke-width="1"/>`;
        s += `<path d="M${f(x + bw - 1)} ${f(yy)}v8" stroke="#000" stroke-opacity=".25" stroke-width="1"/>`;
        x += bw;
      }
    }
  }
  // Üst yüzey ve kenar ışığı
  s += `<path d="M${kenar} ${f(zemin - 4)}H${f(uc - dx * 12)}Q${f(uc)} ${f(zemin - 4)} ${f(uc - dx * 2)} ${f(zemin + 4)}L${f(uc - dx * 4)} ${f(zemin + 6)}H${kenar}z" fill="${kat(ust)}"/>`;
  s += `<path d="M${kenar} ${f(zemin - 4)}H${f(uc - dx * 12)}Q${f(uc)} ${f(zemin - 4)} ${f(uc - dx * 2)} ${f(zemin + 4)}" fill="none" stroke="${kilitli ? '#2A2436' : '#8A7A9A'}" stroke-opacity=".55" stroke-width="1.4"/>`;
  if (tema === 4 || tema === 5) {
    for (let k = 0; k < 7; k++) {
      const bx = taraf === 'sol' ? 10 + r.int(Math.max(1, uc - 40)) : uc + 20 + r.int(Math.max(1, 380 - uc));
      s += `<circle cx="${f(bx)}" cy="${f(zemin - 4)}" r="${3 + r.int(4)}" fill="${kat('#1A3A20')}"/>`;
    }
  }
  return s;
}

/** Sokak lambası (terasın ucunda, sıcak ışık havuzu). */
function lamba(x: number, zemin: number, yanik: boolean): string {
  return `${yanik ? `<ellipse cx="${f(x)}" cy="${f(zemin - 2)}" rx="22" ry="6" fill="#FFB020" opacity=".18"/><circle cx="${f(x)}" cy="${f(zemin - 34)}" r="16" fill="url(#ftl-koz)" opacity=".7"/>` : ''}
    <path d="M${f(x)} ${f(zemin)}v-30" stroke="#1A1220" stroke-width="2.6"/><path d="M${f(x - 4)} ${f(zemin - 30)}h8l-1.5 -8h-5z" fill="${yanik ? '#FFE3A0' : '#2A2232'}" stroke="#1A1220" stroke-width="1.2"/>`;
}

// ───────────────────────── Arka plan ─────────────────────────

function yildizlar(r: Rng, y0: number, y1: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = r.float() * 400;
    const y = y0 + r.float() * (y1 - y0);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${(0.4 + Math.pow(r.float(), 3) * 1.5).toFixed(2)}" fill="#fff" opacity="${(0.3 + r.float() * 0.6).toFixed(2)}"/>`;
  }
  return s;
}

function arkaPlan(m: number, ust: number, r: Rng, kilitli: boolean): string {
  const c = (k: string, o = 1) => `fill="${kilitli ? karistir(k, '#05030A', 0.5) : k}" opacity="${o}"`;
  const yk = ust + BOLGE_H;
  let s = '';
  switch (m) {
    case 0: {
      // Ufuk ve deniz, fenerli kayıklar.
      const uf = ust + 470;
      s += `<rect x="0" y="${uf}" width="400" height="${yk - uf}" fill="url(#hb-deniz)"/>`;
      s += `<path d="M0 ${uf}H400" stroke="#FFC86B" stroke-opacity=".2"/>`;
      for (let k = 0; k < 6; k++) s += `<path d="M${r.int(400)} ${uf + 20 + k * 26}h${30 + r.int(60)}" stroke="#4A3A8A" stroke-opacity=".35" stroke-width="1.2"/>`;
      for (const kx of [92, 300]) {
        const ky = uf + 60 + r.int(60);
        s += `<path d="M${kx - 18} ${ky}h36l-6 8h-24z" ${c('#140C1E')}/><path d="M${kx} ${ky}v-26l14 20h-14" ${c('#1E1430')}/>`;
        if (!kilitli) s += `<circle cx="${kx + 16}" cy="${ky - 4}" r="2.4" fill="#FFC86B"/><circle cx="${kx + 16}" cy="${ky - 4}" r="9" fill="url(#ftl-koz)" opacity=".6"/><path d="M${kx + 16} ${ky + 10}v24" stroke="#FFC86B" stroke-opacity=".25" stroke-width="3"/>`;
      }
      break;
    }
    case 1: {
      // Uzakta büyük cami silueti ve mahya.
      const ty = ust + 400;
      s += `<path d="M90 ${ty}a110 92 0 0 1 220 0z" ${c('#1E1434', 0.9)}/><rect x="70" y="${ty}" width="260" height="${yk - ty}" ${c('#1E1434', 0.9)}/>`;
      s += `<path d="M50 ${ty + 30}a36 30 0 0 1 72 0zM278 ${ty + 30}a36 30 0 0 1 72 0z" ${c('#1A1030', 0.9)}/>`;
      for (const mx of [40, 352]) s += `<rect x="${mx}" y="${ty - 150}" width="9" height="${yk - ty + 150}" ${c('#1A1030', 0.95)}/><path d="M${mx - 2} ${ty - 150}l6.5 -30 6.5 30z" ${c('#1A1030', 0.95)}/><rect x="${mx - 3}" y="${ty - 110}" width="15" height="4" ${c('#22163A')}/>`;
      if (!kilitli) {
        let mahya = '';
        for (let k = 0; k <= 30; k++) {
          const t = k / 30;
          const x = 46 + t * 310;
          const y = ty - 108 + Math.sin(t * Math.PI) * 26;
          mahya += `<circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="#FFE3A0" opacity=".85"/>`;
        }
        s += mahya;
      }
      break;
    }
    case 2: {
      const uf = ust + 360;
      s += `<rect x="0" y="${uf}" width="400" height="${yk - uf}" fill="url(#hb-deniz)" opacity=".85"/>`;
      // Gemi direkleri ve vinç
      s += `<path d="M60 ${uf + 30}h120l-12 18H74z" ${c('#0E1A22')}/><path d="M96 ${uf + 30}V${uf - 70}M140 ${uf + 30}V${uf - 50}M96 ${uf - 50}L140 ${uf - 30}" stroke="#0E1A22" stroke-width="3" fill="none"/>`;
      s += `<path d="M300 ${uf + 40}V${uf - 120}l70 0M300 ${uf - 120}l-24 18M352 ${uf - 120}v40" stroke="${kilitli ? '#0A0E14' : '#16262E'}" stroke-width="5" fill="none"/><rect x="342" y="${uf - 80}" width="20" height="12" ${c('#16262E')}/>`;
      if (!kilitli) s += `<circle cx="96" cy="${uf - 70}" r="2.4" fill="#FF4D4D"/><circle cx="370" cy="${uf - 120}" r="2.4" fill="#FF4D4D"/>`;
      break;
    }
    case 3: {
      const kx = 200;
      const ty = ust + 120;
      s += `<rect x="${kx - 34}" y="${ty}" width="68" height="${yk - ty}" ${c('#24161E', 0.9)}/><path d="M${kx - 40} ${ty}L${kx} ${ty - 70}L${kx + 40} ${ty}z" ${c('#1E1218', 0.9)}/>`;
      s += `<circle cx="${kx}" cy="${ty + 40}" r="24" fill="${kilitli ? '#120A12' : '#FFE3A0'}" opacity="${kilitli ? 1 : 0.85}"/>`;
      if (!kilitli) s += `<circle cx="${kx}" cy="${ty + 40}" r="46" fill="url(#ftl-koz)" opacity=".5"/>`;
      s += `<path d="M${kx} ${ty + 40}v-16M${kx} ${ty + 40}h11" stroke="#3A2416" stroke-width="3" stroke-linecap="round"/>`;
      break;
    }
    case 4: {
      for (let k = 0; k < 9; k++) {
        const ax = r.int(400);
        const ay = ust + 140 + r.int(440);
        s += `<circle cx="${ax}" cy="${ay}" r="${26 + r.int(30)}" ${c('#0E2014', 0.75)}/>`;
      }
      if (!kilitli) for (let k = 0; k < 26; k++) s += `<circle cx="${r.int(400)}" cy="${ust + 60 + r.int(560)}" r="1.4" fill="#E8FF8A" opacity="${(0.4 + r.float() * 0.5).toFixed(2)}"/>`;
      break;
    }
    case 5: {
      s += `<path d="M0 ${ust + 380}C80 ${ust + 330} 160 ${ust + 360} 220 ${ust + 340}S340 ${ust + 300} 400 ${ust + 330}V${yk}H0z" ${c('#141030', 0.9)}/>`;
      if (!kilitli)
        for (let k = 0; k < 3; k++) {
          const sx = 60 + r.int(280);
          const sy = ust + 60 + r.int(200);
          s += `<path d="M${sx} ${sy}l-46 22" stroke="#FFF4C2" stroke-width="1.6" stroke-linecap="round" opacity=".6"/><circle cx="${sx}" cy="${sy}" r="1.8" fill="#fff"/>`;
        }
      break;
    }
    case 6: {
      for (const [bx, bh] of [[70, 300], [130, 360], [330, 330]] as [number, number][]) {
        s += `<rect x="${bx}" y="${yk - bh}" width="18" height="${bh}" ${c('#200E10', 0.9)}/>`;
        if (!kilitli) s += `<g fill="#5A4A58" opacity=".22"><circle cx="${bx + 14}" cy="${yk - bh - 20}" r="16"/><circle cx="${bx + 34}" cy="${yk - bh - 46}" r="22"/><circle cx="${bx + 62}" cy="${yk - bh - 70}" r="28"/></g>`;
      }
      break;
    }
    default: {
      const ty = ust + 260;
      s += `<rect x="0" y="${ty}" width="400" height="${yk - ty}" ${c('#1C1626', 0.85)}/>`;
      for (let k = 0; k < 14; k++) if (k % 2 === 0) s += `<rect x="${k * 30}" y="${ty - 12}" width="30" height="12" ${c('#1C1626', 0.85)}/>`;
      for (const tx of [40, 330]) s += `<rect x="${tx}" y="${ty - 90}" width="44" height="${yk - ty + 90}" ${c('#1A1424', 0.9)}/><path d="M${tx - 4} ${ty - 90}L${tx + 22} ${ty - 130}L${tx + 48} ${ty - 90}z" ${c('#1A1424', 0.9)}/>`;
      break;
    }
  }
  return s;
}

// ───────────────────────── Mahalle SVG'si ─────────────────────────

export interface BolgeCizimi {
  svg: string;
  /** 3★ binalarda çatı fişeği yerleri. */
  catilar: { id: number; x: number; y: number }[];
}

/**
 * Bir mahallenin SVG'si. `bolumler`: 40 düğüm (id sırasıyla), `motifler`:
 * bu mahallede asılı motifler.
 */
export function bolgeCiz(m: number, bolumler: readonly BolumDugumuVM[], motifler: readonly Motif[]): BolgeCizimi {
  const ust = bolgeUst(m);
  const r = new Rng(`mahalle-${m}`);
  const dugum = (id: number): BolumDugumuVM => bolumler[id - 1] ?? { id, yildiz: 0, durum: 'kilitli' };
  const ilk = dugum(m * 5 + 1);
  const kilitli = ilk.durum === 'kilitli';
  const alt = sinirRengi(m - 1);
  const ustRenk = sinirRengi(m);
  const g = gok(m);
  const id = `hb${m}`;
  let s = `<defs>
    <linearGradient id="${id}-gok" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ustRenk}"/><stop offset=".3" stop-color="${g.ust}"/><stop offset=".78" stop-color="${g.alt}"/><stop offset="1" stop-color="${alt}"/></linearGradient>
  </defs>`;
  s += `<rect x="0" y="${ust - 2}" width="400" height="${BOLGE_H + 4}" fill="url(#${id}-gok)"/>`;
  s += yildizlar(r, ust, ust + BOLGE_H * 0.8, 46);
  s += arkaPlan(m, ust, r, kilitli);

  // Motif tabelaları
  motifler.forEach((mo, k) => {
    const mx = k % 2 === 0 ? 200 : 110;
    const my = ust + 250 + k * 40;
    s += `<g transform="translate(${mx} ${my})"><rect x="-26" y="-26" width="52" height="52" rx="8" fill="#120A1E" stroke="#D9A441" stroke-width="2"/>
      <path d="M-20-26v-14M20-26v-14" stroke="#3A2416" stroke-width="2"/>${motifIsaretleme(mo, 1.3, !kilitli)}</g>`;
  });

  // Teraslar, binalar, lambalar (üstten alta: alttakiler önde)
  const catilar: { id: number; x: number; y: number }[] = [];
  for (let j = 4; j >= 0; j--) {
    const bid = m * 5 + j + 1;
    const d = dugum(bid);
    const k = dugumKonumu(bid);
    const zemin = k.y + 18;
    const br = new Rng(`bina-${bid}`);
    s += teras(m, k.taraf, k.x + (k.taraf === 'sol' ? 46 : -46), zemin, br, d.durum === 'kilitli');
    const bx = k.x + (k.taraf === 'sol' ? -64 : 64);
    const b = bina(m, bx, zemin - 4, br, d.yildiz, d.durum, j);
    s += b.svg;
    s += lamba(k.x + (k.taraf === 'sol' ? 40 : -40), zemin - 4, d.durum !== 'kilitli');
    if (d.durum === 'acik' && d.yildiz >= 3) catilar.push({ id: bid, x: b.cati.x, y: b.cati.y });
  }
  return { svg: s, catilar };
}

/** Ortak <defs>: teras yüzü kararması, deniz. Haritada bir kez. */
export function haritaTanimlari(): string {
  return `<defs>
    <linearGradient id="hb-yuz-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140E1C"/><stop offset=".55" stop-color="#0C0812" stop-opacity=".9"/><stop offset="1" stop-color="#0C0812" stop-opacity="0"/></linearGradient>
    <linearGradient id="hb-yuz-sag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140E1C"/><stop offset=".55" stop-color="#0C0812" stop-opacity=".9"/><stop offset="1" stop-color="#0C0812" stop-opacity="0"/></linearGradient>
    <linearGradient id="hb-deniz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1040"/><stop offset="1" stop-color="#0A0E26"/></linearGradient>
    <clipPath id="hb-yatay" clipPathUnits="userSpaceOnUse"><rect x="0" y="-2000" width="${HARITA_W}" height="${HARITA_H + 4000}"/></clipPath>
    <linearGradient id="hb-sis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0614" stop-opacity=".25"/><stop offset=".5" stop-color="#0A0614" stop-opacity=".55"/><stop offset="1" stop-color="#0A0614" stop-opacity=".35"/></linearGradient>
  </defs>`;
}

/** Fitil yolu: parça k = bölüm k'dan k+1'e (k=0: iskeleden 1. bölüme). */
export function yolParcalari(): { k: number; d: string; y0: number; y1: number }[] {
  const p: { k: number; d: string; y0: number; y1: number }[] = [];
  let onceki: Nokta = baslangicKonumu();
  for (let id = 1; id <= 40; id++) {
    const n = dugumKonumu(id);
    p.push({ k: id - 1, d: yolParcasi(onceki, n), y0: n.y, y1: onceki.y });
    onceki = n;
  }
  return p;
}

/** Üst pay: son gök, büyük ay, durağan şenlik fişekleri. */
export function ustPayCiz(): string {
  const r = new Rng('ust-pay');
  const g = gok(7);
  let s = `<defs><linearGradient id="hb-ust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040E"/><stop offset=".6" stop-color="${g.ust}"/><stop offset="1" stop-color="${sinirRengi(7)}"/></linearGradient></defs>
    <rect x="0" y="-2" width="400" height="${UST_PAY + 4}" fill="url(#hb-ust)"/>${yildizlar(r, 0, UST_PAY, 60)}
    <circle cx="300" cy="96" r="60" fill="url(#ftl-koz)" opacity=".25"/><circle cx="300" cy="96" r="30" fill="#FFF4DA"/><circle cx="290" cy="88" r="6" fill="#E8DCC0" opacity=".6"/><circle cx="312" cy="106" r="4" fill="#E8DCC0" opacity=".5"/>`;
  const renk = ['#FF5FB4', '#FFB020', '#3AA8FF', '#2EE07A', '#B266FF'];
  for (let k = 0; k < 4; k++) {
    const cx = 50 + k * 70 + r.int(30);
    const cy = 70 + r.int(110);
    const rr = 20 + r.int(16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      s += `<path d="M${f(cx + Math.cos(a) * rr * 0.3)} ${f(cy + Math.sin(a) * rr * 0.3)}L${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}" stroke="${renk[k % 5]}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
    }
  }
  return s;
}

/** Alt pay: deniz, iskele, kayıklar. */
export function altPayCiz(): string {
  const ust = HARITA_H - ALT_PAY;
  const r = new Rng('alt-pay');
  const b = baslangicKonumu();
  let s = `<rect x="0" y="${ust - 2}" width="400" height="${ALT_PAY + 4}" fill="url(#hb-deniz)"/>
    <rect x="0" y="${ust - 2}" width="400" height="40" fill="${gok(0).alt}" opacity=".6"/>`;
  for (let k = 0; k < 12; k++) s += `<path d="M${r.int(400)} ${ust + 30 + k * 22}h${30 + r.int(70)}" stroke="#4A3A8A" stroke-opacity=".35" stroke-width="1.2"/>`;
  // İskele
  s += `<path d="M${b.x - 26} ${HARITA_H}V${b.y + 4}H${b.x + 26}V${HARITA_H}z" fill="#3A2618"/>`;
  for (let k = 0; k < 8; k++) s += `<path d="M${b.x - 26} ${b.y + 10 + k * 18}h52" stroke="#24160D" stroke-width="2"/>`;
  s += `<path d="M${b.x - 30} ${b.y + 4}v${ALT_PAY}M${b.x + 30} ${b.y + 4}v${ALT_PAY}" stroke="#1A0E06" stroke-width="5"/>`;
  s += lamba(b.x - 30, b.y + 4, true) + lamba(b.x + 30, b.y + 4, true);
  for (const kx of [70, 330]) {
    const ky = ust + 140 + r.int(60);
    s += `<path d="M${kx - 24} ${ky}h48l-8 11h-32z" fill="#140C1E"/><path d="M${kx} ${ky}v-34l18 26h-18" fill="#1E1430"/><circle cx="${kx + 20}" cy="${ky - 5}" r="2.6" fill="#FFC86B"/><circle cx="${kx + 20}" cy="${ky - 5}" r="10" fill="url(#ftl-koz)" opacity=".6"/>`;
  }
  return s;
}

/** Kilitli mahalle sisi. */
export function sisCiz(m: number): string {
  const ust = bolgeUst(m);
  return `<rect x="0" y="${ust - 2}" width="400" height="${BOLGE_H + 4}" fill="url(#hb-sis)"/>`;
}
