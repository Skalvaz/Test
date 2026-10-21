/**
 * Kasaba önizlemeleri: işin haritadaki yerinden kırpılmış küçük resmi
 * (Kasaba paneli) ve süslenmiş mahallenin kartpostalı (kasaba kartı).
 * Haritanın kendi çizimini kullanır; yol, düğüm ve yazılar yoktur.
 *
 * Panelde sahne bir kez gizli kaynakta tanımlanır (`onizlemeKaynagi`), her
 * küçük resim onu `<use>` ile katman katman kullanır: işin parçaları harita-
 * daki gibi terasların arasına girer (önündeki teras önde kalır).
 */
import { KASABA_ISLERI } from '../../app/katalog';
import { svg } from '../dom';
import { M } from '../metinler';
import type { BolumDugumuVM } from '../tipler';
import { ALT_PAY, BOLGE_H, HARITA_H, HARITA_W, altPayCiz, bolgeCiz, bolgeGeo, bolgeUst, haritaTanimlari, sahneParcalari } from './cizim';
import { canliDuragan, isCapasi, isCizimi } from './susler';
import type { Nokta } from './cizim';

const KAYNAK = 'f-onz';
const KATLAR = [4, 3, 2, 1, 0] as const;
/** Küçük resim oranı (en / boy) ve kırpma sınırları (harita birimi). */
const ORAN = 4 / 3;
const EN_AZ = 110;
const EN_COK = 230;

const TUM_ACIK: readonly BolumDugumuVM[] = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, yildiz: 3, durum: 'acik' as const }));

/** Mahallenin gizli sahne kaynağı: panelde bir kez, küçük resimlerden önce DOM'a girer. */
export function onizlemeKaynagi(m: number): SVGSVGElement {
  const p = sahneParcalari(m);
  return svg(
    `<svg class="f-onz-kaynak" width="0" height="0" aria-hidden="true" focusable="false">${haritaTanimlari()}<defs><g id="${KAYNAK}-arka">${p.arka}</g>${p.teras.map((t, j) => `<g id="${KAYNAK}-t${j}">${t}</g>`).join('')}<g id="${KAYNAK}-alt">${p.altPay}</g></defs></svg>`,
  );
}

const KIRPMA = new Map<string, string>();

/**
 * İşin küçük resmi: kaynaktaki sahne + işin yanık çizimi, işin kutusuna göre
 * 4:3 kırpılmış. Kaynak (`onizlemeKaynagi`) aynı belgede olmalı.
 */
export function isOnizlemesi(id: string, m: number): SVGSVGElement | null {
  const g = bolgeGeo(m);
  const c = isCizimi(id, g);
  if (!c) return null;
  const is = (k: Parameters<typeof c.katman>[0]) => c.katman(k);
  const tum = `${is('arka')}${KATLAR.map((j) => is(j)).join('')}${is('on')}${is('kiyi')}${c.canli}`;
  let vb = KIRPMA.get(id);
  if (!vb) {
    vb = kirp(olc(tum), c.capa);
    KIRPMA.set(id, vb);
  }
  const ic = `${m === 0 ? `<use href="#${KAYNAK}-alt"/>` : ''}<use href="#${KAYNAK}-arka"/>${is('arka')}${KATLAR.map((j) => `<use href="#${KAYNAK}-t${j}"/>${is(j)}`).join('')}${is('on')}${is('kiyi')}${c.canli}${id === 'iskele.tabela' ? tabelaSvg(c.capa) : ''}`;
  return svg(`<svg class="f-onz" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${ic}</svg>`);
}

/**
 * "Fener Koyu" tabelası (haritada HTML; önizlemede küçük SVG eşi): altın
 * levha ve çevresinde yanan ampuller.
 */
function tabelaSvg(p: Nokta): string {
  const w = 96;
  const h = 24;
  const x0 = p.x - w / 2;
  const y0 = p.y - h / 2;
  let ampul = '';
  for (let i = 0; i <= 8; i++) for (const y of [y0 - 5, y0 + h + 5]) ampul += `<circle cx="${(x0 + (w * i) / 8).toFixed(1)}" cy="${y}" r="1.6" fill="#FFF4C2"/>`;
  return `<defs><linearGradient id="f-onz-tabela" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A8"/><stop offset=".55" stop-color="#D9A441"/><stop offset="1" stop-color="#9A5A22"/></linearGradient></defs><circle cx="${p.x}" cy="${p.y}" r="${w * 0.7}" fill="url(#ftl-koz)" opacity=".35"/><rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="5" fill="url(#f-onz-tabela)" stroke="#4A2208" stroke-width="1.5"/><text x="${p.x}" y="${p.y + 4.2}" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="1.4" fill="#3A1606" font-family="Nunito, sans-serif">${tabelaYazisi()}</text>${ampul}`;
}

/** Tabela yazısı (büyük harf, dile göre). */
function tabelaYazisi(): string {
  return M.fenerKoyu.toLocaleUpperCase('tr');
}

/** Çizimin kutusu (DOM'da ölçülür; ölçülemezse null → çapa çevresi). */
function olc(isaretleme: string): DOMRect | null {
  if (typeof document === 'undefined') return null;
  const s = svg(`<svg style="position:absolute;left:0;top:0;width:0;height:0;overflow:hidden" aria-hidden="true"><g>${isaretleme}</g></svg>`);
  document.body.appendChild(s);
  try {
    const b = (s.firstElementChild as SVGGElement).getBBox();
    return b.width > 0 && b.height > 0 ? b : null;
  } catch {
    return null;
  } finally {
    s.remove();
  }
}

/** Kutuyu 4:3'e, [EN_AZ, EN_COK] genişliğe getirir; çok büyükse çapaya ortalar. */
function kirp(b: DOMRect | null, capa: Nokta): string {
  let w = b ? b.width + 24 : EN_AZ;
  let h = b ? b.height + 24 : EN_AZ / ORAN;
  let cx = b ? b.x + b.width / 2 : capa.x;
  let cy = b ? b.y + b.height / 2 : capa.y;
  if (w > EN_COK || h * ORAN > EN_COK) {
    cx = capa.x;
    cy = capa.y;
    w = EN_COK;
    h = EN_COK / ORAN;
  } else {
    if (w / h < ORAN) w = h * ORAN;
    else h = w / ORAN;
    if (w < EN_AZ) {
      w = EN_AZ;
      h = EN_AZ / ORAN;
    }
  }
  const x0 = Math.max(0, Math.min(HARITA_W - w, cx - w / 2));
  const y0 = Math.min(HARITA_H - h, cy - h / 2);
  const r = (n: number) => Math.round(n * 10) / 10;
  return `${r(x0)} ${r(y0)} ${r(w)} ${r(h)}`;
}

/**
 * Süslenmiş mahallenin kartpostalı (kasaba kartı kapağı): altı iş yanık,
 * bant işlerin çapalarının ortancası çevresinde (`oran` = en / boy).
 */
export function mahalleKartpostali(m: number, oran = 2): SVGSVGElement {
  const g = bolgeGeo(m);
  const ids = KASABA_ISLERI.filter((x) => x.mahalle === m).map((x) => x.id);
  const c = bolgeCiz(m, TUM_ACIK, [], { yapilan: new Set(ids), hayalet: false, yeni: new Set() });
  const ys = ids
    .map((id) => isCapasi(id, g)?.y)
    .filter((y): y is number => y !== undefined)
    .sort((a, b) => a - b);
  const h = HARITA_W / oran;
  const orta = ys.length ? ys[Math.floor(ys.length / 2)] : g.ust + BOLGE_H / 2;
  const ust = bolgeUst(m);
  const alt = m === 0 ? HARITA_H - ALT_PAY + 220 : ust + BOLGE_H;
  // En çok işi (çapa) içine alan bant; eşitlikte ortancaya yakın olan.
  let y0 = Math.max(ust - 40, Math.min(alt - h, orta - h / 2));
  let enIyi = -1;
  for (let y = ust - 40; y <= alt - h; y += 4) {
    const n = ys.filter((v) => v >= y + 18 && v <= y + h - 12).length;
    const daha = n > enIyi || (n === enIyi && Math.abs(y + h / 2 - orta) < Math.abs(y0 + h / 2 - orta));
    if (daha) {
      enIyi = n;
      y0 = y;
    }
  }
  return svg(
    `<svg class="f-onz-kart" viewBox="0 ${Math.round(y0)} ${HARITA_W} ${Math.round(h)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${haritaTanimlari()}${m === 0 ? altPayCiz() : ''}${c.svg}${c.canli.map(canliDuragan).join('')}${c.kiyi}</svg>`,
  );
}
