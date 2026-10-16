/**
 * GEÇİCİ geliştirme vitrini (dev/meta.html): meta katmanının çıktısını telefon
 * düzeninde gösterir — harita verisi, bölüm sonucu ödülleri, sandıklar,
 * günlük görevler, Fener Nöbeti, paylaşım metni, Fişek Defteri, Gece Tabloları,
 * kayıt kodu, onarım ve mola zamanlayıcısı. Asıl arayüz `src/ui` paketindedir;
 * bu sayfa yalnız doğrulama içindir. `window.__meta` ile senaryo kurulur.
 */
import { GOKYUZU, KAPSUL_RENKLERI, MAHALLELER, GUCLENDIRICILER, FITILLER } from '../../app/katalog';
import type { GuclendiriciId } from '../../app/katalog';
import { rngSonraki } from '../../core/rng';
import {
  KARTLAR,
  NADIRLIK_ADLARI,
  SERI_BASAMAKLARI,
  arsivGunleri,
  bolumAcikMi,
  bolumSonucu,
  defterOzeti,
  desenDurumlari,
  eksikParcalar,
  fitilDurumlari,
  gokyuzuDurumlari,
  gorevMetni,
  gunGiris,
  haritaVerisi,
  kartDurumlari,
  kayitKoduCoz,
  kayitKoduUret,
  kayitOnar,
  molaBaslat,
  molaIlerle,
  molaKapat,
  molayaKalan,
  MOLA_METNI,
  paylasimMetni,
  progressScore,
  rozetDurumlari,
  sandikAc,
  seriBasamakIndeksi,
  siradakiDenemeNo,
  sonrakiBasamak,
  tabloKayitlari,
  tabloListesi,
  tarihEkle,
  tarihMetni,
  haftaGunu,
  tozlaParcaAl,
  yeniKayit,
  acikEnYuksek,
  VARSAYILAN_META_AYAR,
  bolumMahallesi,
  MOTIFLER,
  VARSAYILAN_MOTIF_BOLUMLERI,
} from '../index';
import type { Motif } from '../../core/types';
import type { Kayit, Odul, SandikSonucu, HaritaBolumDugumu, HaritaUstaDugumu, MolaDurumu, HaritaVerisi } from '../index';
import { sahteOyun } from './sahteOyun';

// ───────────────────────────── Simgeler ─────────────────────────────

const S = {
  yildiz: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
  alev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 5.6 5 10.2A5 5 0 0 1 12 17a5 5 0 0 1-5-4.8c0-2.4 1.3-3.9 2.4-5 .2 1.6.9 2.7 2 3.2C11 7.6 11.3 4.6 12 2zm0 22c-3.9 0-7-2.6-7-6 0-.6.1-1.2.3-1.7A7 7 0 0 0 12 19.5a7 7 0 0 0 6.7-3.2c.2.5.3 1.1.3 1.7 0 3.4-3.1 6-7 6z"/></svg>',
  sandik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 10V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2"/><path d="M10 10v3h4v-3"/></svg>',
  toz: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z"/></svg>',
  harita: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  sonuc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  takvim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  defter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-2 1"/><path d="M20 4v14h-6"/></svg>',
  kayit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 14h8M8 18h5"/></svg>',
  kilit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  rozet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14l-2 7 5.5-3 5.5 3-2-7"/></svg>',
  roket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2c3 2.5 4 6 4 10l-2 4h-4l-2-4c0-4 1-7.5 4-10z"/><path d="M10 16l-3 3 1-5M14 16l3 3-1-5"/><circle cx="12" cy="9" r="1.6"/></svg>',
  kart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  tablo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M7 16l3-4 3 3 2-2 2 3"/><circle cx="9" cy="8" r="1.3"/></svg>',
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4 10-10"/></svg>',
  el: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7 6 6 0 0 1-5-3l-2.5-4a1.6 1.6 0 0 1 2.6-1.8L8 15"/></svg>',
  gunes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
};

/** Deniz feneri (Usta düğümü). */
function fenerSvg(acik: boolean): string {
  const isik = acik ? '#FFE08A' : 'rgba(255,243,214,.25)';
  return `<svg viewBox="0 0 46 56"><defs><radialGradient id="fi" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${isik}" stop-opacity=".9"/><stop offset="1" stop-color="${isik}" stop-opacity="0"/></radialGradient></defs>${acik ? '<circle cx="23" cy="13" r="14" fill="url(#fi)"/>' : ''}<path d="M17 52l3-32h6l3 32z" fill="#e9e2d6"/><path d="M18.2 40h9.6l.6 6h-10.8zM19.3 28h7.4l.5 5h-8.4z" fill="#c8402f"/><rect x="18" y="14" width="10" height="7" rx="1.5" fill="${acik ? '#FFC86B' : '#5a5060'}"/><path d="M16 14h14l-7-6z" fill="#3a2a52"/><rect x="12" y="51" width="22" height="4" rx="2" fill="#24160D"/></svg>`;
}

/** Desen simgesi: tohumlu küçük havai fişek. */
function desenSvg(i: number, renk: string): string {
  const kol = 8 + (i % 5) * 2;
  let yollar = '';
  for (let k = 0; k < kol; k++) {
    const a = (k / kol) * Math.PI * 2 + i * 0.3;
    const r1 = 5 + ((i * 7 + k * 3) % 4);
    const r2 = 15 + ((i * 3 + k) % 5);
    yollar += `<line x1="${20 + Math.cos(a) * r1}" y1="${20 + Math.sin(a) * r1}" x2="${20 + Math.cos(a) * r2}" y2="${20 + Math.sin(a) * r2 + 1.5}" stroke="${renk}" stroke-width="1.6" stroke-linecap="round"/>`;
    yollar += `<circle cx="${20 + Math.cos(a) * (r2 + 2)}" cy="${20 + Math.sin(a) * (r2 + 2) + 2}" r="1.1" fill="#FFF4C2"/>`;
  }
  return `<svg viewBox="0 0 40 40">${yollar}<circle cx="20" cy="20" r="2.5" fill="#FFF4C2"/></svg>`;
}

// ───────────────────────────── Durum ─────────────────────────────

type Sekme = 'harita' | 'sonuc' | 'gunluk' | 'defter' | 'kayit';
const durum: {
  kayit: Kayit;
  bugun: number;
  sekme: Sekme;
  son: { baslik: string; alt: string; oduller: Odul[] } | null;
  tohum: number;
  mola: MolaDurumu;
  molaSaat: number;
  molaBalon: boolean;
  defterMesaj: string;
} = {
  kayit: yeniKayit(20261014),
  bugun: 20261014,
  sekme: 'harita',
  son: null,
  tohum: 1,
  mola: molaBaslat(),
  molaSaat: 0,
  molaBalon: false,
  defterMesaj: '',
};

const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const sayi = (n: number) => n.toLocaleString('tr-TR');
const yildizMetni = (y: number) => `${'★'.repeat(y)}<span class="bos">${'★'.repeat(3 - y)}</span>`;
const gucAdi = (g: GuclendiriciId) => GUCLENDIRICILER.find((x) => x.id === g)!.ad;

function h(etiket: string, sinif = '', html = ''): HTMLElement {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (html) e.innerHTML = html;
  return e;
}

// ───────────────────────────── Oynatma ─────────────────────────────

const MOTIF_BOLUMU = new Map(Object.entries(VARSAYILAN_MOTIF_BOLUMLERI).map(([m, id]) => [id!, m as Motif]));

function oyna(bolumId: number, kazandi: boolean, yildiz: number, sessiz = false): void {
  const so = sahteOyun(durum.tohum++ * 2654435761, { kazandi, yildiz, hamle: 18 + (bolumId % 8) });
  const r = bolumSonucu(durum.kayit, {
    bolumId,
    kazandi,
    puan: so.puan,
    yildiz,
    istatistik: so.istatistik,
    olaylarOzeti: so.ozet,
    tarih: durum.bugun,
    kalanHamle: so.kalanHamle,
    toplamHamle: so.toplamHamle,
    deneme: siradakiDenemeNo(durum.kayit, bolumId),
    motif: MOTIF_BOLUMU.get(bolumId),
  });
  durum.kayit = r.kayit;
  if (!sessiz) {
    const ad = bolumId > 10_000_000 ? `Günün Şenliği ${tarihMetni(bolumId)}` : bolumId > 100 && bolumId < 200 ? `Usta Bölümü U${bolumId - 100}` : `Bölüm ${bolumId}`;
    durum.son = {
      baslik: `${ad} · ${kazandi ? 'Kazandın' : 'Kaybettin'}`,
      alt: kazandi ? `${yildizMetni(r.ozet.yildiz)} · ${sayi(so.puan)} puan · ${so.kalanHamle} hamle kaldı` : `${sayi(so.puan)} puan · deneme ${r.kayit.bolumler[String(bolumId)]?.deneme ?? ''}`,
      oduller: r.oduller,
    };
  }
}

function gunIlerle(n: number): void {
  durum.bugun = tarihEkle(durum.bugun, n);
  durum.kayit = gunGiris(durum.kayit, durum.bugun).kayit;
}

function senaryo(ad: 'yeni' | 'orta' | 'ileri'): void {
  durum.kayit = yeniKayit(20261014);
  durum.tohum = 1;
  durum.son = null;
  durum.bugun = 20261014;
  if (ad === 'yeni') return;
  const r = { rng: ad === 'orta' ? 77 : 99 };
  const u = () => rngSonraki(r) / 4294967296;
  const hedef = ad === 'orta' ? 16 : 40;
  // Oyuncu ~2 bölüm/gün oynar; tarih bugüne gelsin diye geriden başla.
  const gunSayisi = Math.ceil(hedef / 2) + (ad === 'orta' ? 1 : 6);
  durum.bugun = tarihEkle(20261014, -gunSayisi);
  for (let id = 1; id <= hedef; id++) {
    if (id % 2 === 1 && id > 1) gunIlerle(ad === 'ileri' && id % 9 === 0 ? 2 : 1);
    const zor = id % 5 === 0;
    while (u() < (zor ? 0.45 : 0.15)) oyna(id, false, 0, true);
    const y = ad === 'ileri' ? (u() < 0.75 ? 3 : 2) : u() < 0.35 ? 3 : u() < 0.7 ? 2 : 1;
    oyna(id, true, y, true);
    if (ad === 'ileri' && id === 30) for (let u2 = 101; u2 <= 104; u2++) if (bolumAcikMi(durum.kayit, u2)) oyna(u2, true, 2, true);
    if (id >= 11 && u() < 0.4) oyna(durum.bugun, u() < 0.7, 2, true);
  }
  if (ad === 'ileri') {
    for (let id = 1; id <= 40; id++) if ((durum.kayit.bolumler[String(id)]?.yildiz ?? 0) < 3 && u() < 0.6) oyna(id, true, 3, true);
    for (let u2 = 101; u2 <= 108; u2++) if (bolumAcikMi(durum.kayit, u2)) oyna(u2, true, u() < 0.5 ? 3 : 2, true);
  }
  while (durum.bugun < 20261014) gunIlerle(1);
  // Bugünün ilk oyunu: son sonuç kartları dolu gelsin
  const siradaki = acikEnYuksek(durum.kayit);
  if (ad === 'orta') oyna(siradaki, true, 3);
  else oyna(durum.bugun, true, 3);
}

// ───────────────────────────── Çizim ─────────────────────────────

const kok = document.getElementById('vitrin')!;

let sonSekme: Sekme | null = null;

function ciz(kaydir = false): void {
  const sagEski = kok.querySelector('.sag');
  // Sekme değişince sayfa başına dön; aynı sekmede kaydırma korunur.
  const scroll = sagEski && sonSekme === durum.sekme ? sagEski.scrollTop : 0;
  sonSekme = durum.sekme;
  kok.innerHTML = '';
  const k = durum.kayit;
  const hv = haritaVerisi(k);

  const ust = h('header', 'ust');
  ust.append(h('div', 'logo', `FİTİL<small>Meta vitrini · ${tarihMetni(durum.bugun)}</small>`));
  const cipler = h('div', 'cipler');
  cipler.append(h('span', 'cip yildiz', `${S.yildiz}<span>${hv.anaYildiz}<span class="soluk kucuk">/${hv.enFazlaYildiz}</span></span>`));
  cipler.append(h('span', 'cip alev', `${S.alev}${k.gunluk.seri}`));
  cipler.append(h('span', 'cip', `${S.toz}${k.toz}`));
  ust.append(cipler);
  kok.append(ust);

  const sol = h('aside', 'sol');
  sol.append(haritaCiz(hv));
  kok.append(sol);

  const alt = h('nav', 'alt');
  const sekmeler: [Sekme, string, string][] = [
    ['harita', 'Harita', S.harita],
    ['sonuc', 'Sonuç', S.sonuc],
    ['gunluk', 'Günlük', S.takvim],
    ['defter', 'Defter', S.defter],
    ['kayit', 'Kayıt', S.kayit],
  ];
  const genis = window.matchMedia('(min-width: 900px)').matches;
  if (genis && durum.sekme === 'harita') durum.sekme = 'sonuc';
  for (const [id, ad, simge] of sekmeler) {
    const b = h('button', `sekme ${id === 'harita' ? 'harita-sekme' : ''}`, `${simge}<span>${ad}</span>`);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(durum.sekme === id));
    b.onclick = () => {
      durum.sekme = id;
      ciz(id === 'harita');
    };
    alt.append(b);
  }

  const sag = h('main', 'sag');
  switch (durum.sekme) {
    case 'harita':
      sag.append(haritaCiz(hv));
      break;
    case 'sonuc':
      sonucCiz(sag);
      break;
    case 'gunluk':
      gunlukCiz(sag);
      break;
    case 'defter':
      defterCiz(sag);
      break;
    case 'kayit':
      kayitCiz(sag);
      break;
  }
  kok.append(sag);
  kok.append(alt);
  // Harita sıradaki bölüme kayar (§14.2).
  const siradakineKay = (kap: HTMLElement) => {
    const s = kap.querySelector('.siradaki') as HTMLElement | null;
    if (!s || kap.clientHeight === 0) return;
    kap.scrollTop += s.getBoundingClientRect().top - kap.getBoundingClientRect().top - kap.clientHeight * 0.55;
  };
  if (kaydir || durum.sekme === 'harita') requestAnimationFrame(() => siradakineKay(sag));
  else sag.scrollTop = scroll;
  if (genis) requestAnimationFrame(() => siradakineKay(sol));
}

// Harita ───────────────────────────────────────────────

const SATIR = 84;
const MAHALLE_YUKSEKLIK = 640;

function haritaCiz(hv: HaritaVerisi): HTMLElement {
  const kap = h('div', 'harita');
  // Yukarıdan aşağıya: son mahalle üstte.
  for (let m = hv.mahalleler.length - 1; m >= 0; m--) {
    const mh = hv.mahalleler[m];
    const g = GOKYUZU[mh.gokyuzu];
    const bolum = h('section', 'mahalle');
    bolum.style.background = `linear-gradient(${g.ust}, ${g.alt})`;
    const dugumler = hv.dugumler.filter((d) => d.mahalle === m);
    // Düğüm konumları: alttan yukarı zikzak.
    const konum = (i: number) => ({ x: 50 + Math.sin(i * 1.25 + m) * 26, y: MAHALLE_YUKSEKLIK - 60 - i * SATIR });
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'yol');
    svg.setAttribute('viewBox', `0 0 100 ${MAHALLE_YUKSEKLIK}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    let yol = '';
    dugumler.forEach((_, i) => {
      const p = konum(i);
      yol += `${i ? 'L' : 'M'}${p.x} ${p.y} `;
    });
    const sonAcik = dugumler.filter((d) => d.durum !== 'kilitli').length;
    let acikYol = '';
    dugumler.slice(0, Math.max(0, sonAcik)).forEach((_, i) => {
      const p = konum(i);
      acikYol += `${i ? 'L' : 'M'}${p.x} ${p.y} `;
    });
    svg.innerHTML = `<path d="${yol}" fill="none" stroke="rgba(255,243,214,.18)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${acikYol ? `<path d="${acikYol}" fill="none" stroke="${mh.vurgu}" stroke-opacity=".7" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : ''}`;
    bolum.append(svg);
    bolum.append(siluet(m, mh.vurgu));
    const baslik = h('div', 'baslik', `<div class="ad"><b style="color:${mh.vurgu}">${mh.ad}</b><span class="alt-baslik">${mh.yildiz}/${mh.enFazlaYildiz} ★ · ${g.ad}</span></div>`);
    const roz = h('div', 'rozetler');
    if (mh.tamam) roz.append(h('span', 'etiket', 'Tamamlandı'));
    if (mh.ucYildiz) roz.append(h('span', 'etiket altin', 'Hepsi ★★★'));
    for (const mt of mh.motifler) roz.append(h('span', 'etiket altin', `Işık Deseni: ${MOTIFLER.find((x) => x.id === mt)!.ad}`));
    if (mh.defterKarti) roz.append(h('span', 'etiket', 'Defter kartı'));
    if (mh.efsaneKarti) roz.append(h('span', 'etiket altin', 'Efsane'));
    baslik.append(roz);
    bolum.append(baslik);
    dugumler.forEach((d, i) => {
      const p = konum(i);
      const el = d.tur === 'bolum' ? binaDugumu(d) : ustaDugumu(d);
      el.style.left = `${p.x}%`;
      el.style.top = `${p.y}px`;
      bolum.append(el);
    });
    kap.append(bolum);
  }
  return kap;
}

function siluet(m: number, vurgu: string): SVGElement {
  const r = { rng: (m + 1) * 7919 };
  const u = () => rngSonraki(r) / 4294967296;
  let d = 'M0 60 ';
  let x = 0;
  while (x < 100) {
    const g = 4 + u() * 7;
    const y = 60 - (12 + u() * 34);
    d += `L${x} ${y} L${x + g} ${y} `;
    if (u() < 0.25) d += `L${x + g / 2} ${y - 8} `;
    x += g;
  }
  d += 'L100 60 Z';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'siluet');
  svg.setAttribute('viewBox', '0 0 100 60');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `<path d="${d}" fill="#05050f"/><path d="${d}" fill="${vurgu}" fill-opacity=".06"/>`;
  return svg;
}

function binaDugumu(d: HaritaBolumDugumu): HTMLElement {
  const el = h('div', `dugum ${d.durum}${d.siradaki ? ' siradaki' : ''}`);
  const bina = h('div', 'bina');
  bina.append(h('div', 'cati'));
  const govde = h('div', 'govde');
  const yanik = d.pencerePay * 2;
  for (let i = 0; i < 6; i++) govde.append(h('span', `pencere${i < yanik ? ' yanik' : ''}`));
  bina.append(govde);
  if (d.durum === 'kilitli') bina.append(h('div', 'kilit', S.kilit));
  if (d.catiFisegi) bina.append(h('div', 'cati-fisek', desenSvg(d.id, KAPSUL_RENKLERI[d.id % 6].ana)));
  el.append(bina);
  el.append(h('span', 'no', String(d.id)));
  if (d.durum !== 'kilitli') el.append(h('span', 'yildizlar', yildizMetni(d.yildiz)));
  return el;
}

function ustaDugumu(d: HaritaUstaDugumu): HTMLElement {
  const el = h('div', `dugum usta ${d.durum}`);
  el.append(h('div', 'fener-dugum', fenerSvg(d.durum !== 'kilitli')));
  el.append(h('span', 'no', `U${d.ustaNo}`));
  el.append(h('span', 'ad', d.durum === 'kilitli' ? `${d.ad} · ${d.eksikYildiz}★ kaldı` : `${d.ad}${d.yildiz ? ` · ${'★'.repeat(d.yildiz)}` : ''}`));
  return el;
}

// Sonuç ───────────────────────────────────────────────

function sonucCiz(sag: HTMLElement): void {
  const sayfa = h('div', 'sayfa');
  const k = durum.kayit;
  const siradaki = acikEnYuksek(k);
  const mh = MAHALLELER[bolumMahallesi(siradaki, VARSAYILAN_META_AYAR)];
  sayfa.append(h('h2', '', 'Sıradaki'));
  const kart = h('div', 'kart satir');
  kart.append(h('div', 'simge', S.harita));
  const b = k.bolumler[String(siradaki)];
  kart.append(h('div', '', `<div class="buyuk">Bölüm ${siradaki}</div><div class="soluk kucuk">${mh.ad} · deneme ${b?.deneme ?? 0}${k.cosku >= 3 ? ' · <span style="color:var(--pirinc-acik)">Hazır roketle başlıyorsun!</span>' : k.cosku ? ` · Coşku ${k.cosku}/3` : ''}</div>`));
  sayfa.append(kart);
  if (durum.son) {
    sayfa.append(h('h2', '', 'Son sonuç'));
    const bas = h('div', 'kart');
    bas.innerHTML = `<div class="buyuk">${durum.son.baslik}</div><div class="soluk"><span class="yildizlar">${durum.son.alt}</span></div>`;
    sayfa.append(bas);
    if (durum.son.oduller.length === 0) sayfa.append(h('div', 'kart soluk', 'Bu sonuç ödül getirmedi.'));
    for (const o of durum.son.oduller) sayfa.append(odulKarti(o));
  } else {
    sayfa.append(h('div', 'kart soluk', 'Henüz oyun yok. Aşağıdaki düğmelerle bir bölüm sonucu işle.'));
  }
  sag.append(sayfa);
  const ey = h('div', 'eylemler');
  const d = (metin: string, sinif: string, f: () => void) => {
    const b = h('button', `dugme ${sinif}`, metin);
    b.onclick = () => {
      f();
      ciz();
      document.querySelector('.sag')!.scrollTop = 0;
    };
    return b;
  };
  ey.append(d('Kaybet', 'kirmizi', () => oyna(siradaki, false, 0)));
  ey.append(d('★', '', () => oyna(siradaki, true, 1)));
  ey.append(d('★★', '', () => oyna(siradaki, true, 2)));
  ey.append(d('★★★', 'ana', () => oyna(siradaki, true, 3)));
  sag.append(ey);
}

function odulKarti(o: Odul): HTMLElement {
  const kart = (renk: string, simge: string, baslik: string, alt = '') => {
    const e = h('div', `kart odul ${renk}`);
    e.append(h('div', 'simge', simge));
    e.append(h('div', 'metin', `<b>${baslik}</b>${alt ? `<span>${alt}</span>` : ''}`));
    return e;
  };
  switch (o.tur) {
    case 'yildiz':
      return kart('altin', S.yildiz, `Yıldız rekoru: <span class="yildizlar">${yildizMetni(o.yeni)}</span>`, o.onceki ? `Önceki rekor ${'★'.repeat(o.onceki)}` : 'İlk kazanç');
    case 'yeniRekor': {
      const ad: Record<string, string> = { bolumPuani: 'Bölüm puanı', enBuyukReaksiyon: 'En büyük reaksiyon', enUzunZincir: 'En uzun zincir', enCokNesil: 'En çok nesil', enIyiGunluk: 'Günlük skor', enYuksekPuan: 'En yüksek puan' };
      return kart('altin', S.yildiz, 'YENİ REKOR!', `${ad[o.alan]}: ${sayi(o.onceki)} → ${sayi(o.yeni)}`);
    }
    case 'bolumAcildi':
      return kart('', S.harita, `Bölüm ${o.bolumId} açıldı`, MAHALLELER[bolumMahallesi(o.bolumId, VARSAYILAN_META_AYAR)].ad);
    case 'ustaAcildi':
      return kart('mavi', fenerSvg(true), `Usta Bölümü U${o.ustaNo} açıldı`, `${o.yildiz}★ toplandı`);
    case 'gunlukAcildi':
      return kart('altin', S.takvim, 'Günün Şenliği açıldı!', 'Her gün yeni tahta, 3 görev ve Fener Nöbeti');
    case 'sonsuzAcildi':
      return kart('altin', S.sonuc, 'Sonsuz Şenlik açıldı!');
    case 'guclendiriciAcildi':
      return kart('yesil', S.roket, `Yeni güçlendirici: ${gucAdi(o.guc)}`, `Hediye +${o.verilen.adet}${o.verilen.toz ? ` · stok dolu, +${o.verilen.toz} toz` : ''}`);
    case 'guclendirici':
      return kart('yesil', S.roket, o.verilen.adet ? `+${o.verilen.adet} ${gucAdi(o.verilen.guc)}` : `+${o.verilen.toz} kıvılcım tozu`, `${{ mahalle: 'Mahalle ödülü', rozet: 'Rozet ödülü', seri: 'Fener Nöbeti ödülü' }[o.neden]}${o.verilen.adet ? '' : ` · ${gucAdi(o.verilen.guc)} henüz açık değil ya da stok dolu`}`);
    case 'mahalleTamam': {
      const kartT = KARTLAR.find((c) => c.id === o.kart)!;
      return kart('altin', S.gunes, `${MAHALLELER[o.mahalle].ad} tamamlandı!`, `Gökyüzü: ${GOKYUZU[o.gokyuzu].ad} · Defter kartı: ${kartT.baslik}`);
    }
    case 'efsane':
      return kart('altin', S.kart, `Efsane kartı: ${KARTLAR.find((c) => c.id === o.kart)!.baslik}`, `${MAHALLELER[o.mahalle].ad}: bütün bölümler ★★★`);
    case 'motif':
      return kart('altin', S.gunes, `Işık Deseni asıldı: ${MOTIFLER.find((x) => x.id === o.motif)!.ad}`, 'Haritada ışıklı tabela');
    case 'sandik':
      return sandikKarti(o.sandik);
    case 'sandikBekliyor':
      return kart('', S.sandik, 'Sandık saklandı', '5. bölümde sandıklar açılınca açılacak');
    case 'tablo':
      return tabloKarti(o.tablo.kod, o.tablo.nadirlik, o.saklandi ? (o.eskiNadirlik === null ? 'Galeriye eklendi' : 'Eskisinin yerine saklandı') : `Eskisi korundu (${NADIRLIK_ADLARI[o.eskiNadirlik ?? 0]}) · [Sakla] ile değiştirilebilir`);
    case 'rozet': {
      const r = rozetDurumlari(durum.kayit).find((x) => x.id === o.rozet)!;
      return kart('altin', S.rozet, `Rozet: ${o.ad}`, `${r.aciklama}${o.verilen ? ` · +${o.verilen.adet || 0} ${gucAdi(o.verilen.guc)}${o.verilen.toz ? ` (+${o.verilen.toz} toz)` : ''}` : ''}`);
    }
    case 'cosku':
      return kart(o.bozuldu ? 'kirmizi' : 'yesil', S.roket, o.bozuldu ? 'Coşku Serisi bozuldu' : `Coşku Serisi ${o.seri}`, o.aktif ? 'Sonraki bölüm hazır roketle başlar!' : o.bozuldu ? 'Kaybetmenin tek sonucu bu' : `${3 - o.seri} ilk deneme kazancı daha`);
    case 'gorev':
      return kart('yesil', S.ok, `Görev tamam: ${o.metin}`, `${o.gorev.ilerleme}/${o.gorev.hedef}`);
    case 'seri': {
      const s = o.sonuc;
      const ek = [s.affedilen.length ? `${s.affedilen.length} kaçırılan gün affedildi` : '', s.dusus ? `${s.dusus.den} → ${s.dusus.e} (${s.dusus.kacirma} basamak aşağı, sıfırlanmaz)` : ''].filter(Boolean).join(' · ');
      return kart('', S.alev, `Fener Nöbeti: ${s.seri} gün`, ek || 'Bugün sayıldı');
    }
    case 'seriBasamagi':
      return kart('altin', S.alev, `Yeni basamak: ${o.ad}`, ['', '1 sandık', '1 Kibrit + 1 sandık', 'Her güçlendiriciden 1', '"Deniz Feneri" fitili'][o.basamak]);
    case 'fitil':
      return kart('altin', S.gunes, 'Fitil görünümü: Deniz Feneri');
    case 'ustaEli':
      return kart('mavi', S.el, "Kıvılcım Usta'nın Eli", '+5 hamle ile devam et (en fazla 1★)');
    // Şema 3 (KANCALAR): mühür, sancak, mühür parçası, kandil, kasaba.
    case 'muhur':
      return kart('kirmizi', S.rozet, `Mühür: ${o.yeni.join(', ')}`, `Bölüm ${o.bolumId}${o.tanitim ? ' · mühürler tanıtıldı' : ''}`);
    case 'sancak':
      return kart('altin', S.gunes, `Sancak: Bölüm ${o.bolumId}`, `${MAHALLELER[o.mahalle].ad}: üç mühür tamam`);
    case 'muhurParcasi':
      return kart('altin', S.gunes, `${o.esik} mühür: ${FITILLER.find((f) => f.id === o.fitil)!.ad}`, o.parca ? `Parça ${o.parca}` : `+${o.toz} toz`);
    case 'kandil':
      return kart('altin', S.alev, `Kandil ${o.onceki} → ${o.yeni}`, `yıldız ${o.kaynak.yildiz} · mühür ${o.kaynak.muhur} · mahalle ${o.kaynak.mahalle} · günlük ${o.kaynak.gunluk}`);
    case 'kasabaAcildi':
      return kart('altin', S.harita, 'Kasaba açıldı', `${o.kandil} kandil`);
  }
}

function cekilisMetni(c: SandikSonucu['cekilisler'][number]): { metin: string; sinif: string } {
  if (c.tur === 'guclendirici') return { metin: `+1 ${gucAdi(c.guc)}`, sinif: 'yeni' };
  if (c.tur === 'toz') return { metin: `+${c.adet} toz (stok dolu)`, sinif: '' };
  const ad = c.kategori === 'desen' ? desenDurumlari(durum.kayit).find((d) => d.id === c.hedef)!.ad : FITILLER.find((f) => f.id === c.hedef)!.ad;
  if (!c.yeni) return { metin: `${ad} ${c.indeks + 1}/3 tekrar · +${c.toz} toz`, sinif: '' };
  if (c.tamamlandi) return { metin: `${ad} TAMAMLANDI`, sinif: 'tamam' };
  return { metin: `${c.kategori === 'desen' ? 'Desen' : 'Fitil'}: ${ad} ${c.indeks + 1}/3${c.garanti === 'kotuSans' ? ' · garanti' : ''}`, sinif: 'yeni' };
}

function sandikKarti(s: SandikSonucu): HTMLElement {
  const e = h('div', `kart odul sandik-kart ${s.tur}${s.tur === 'parlak' ? ' altin' : ''}`);
  e.append(h('div', 'simge', S.sandik));
  const neden: Record<string, string> = { ilkKazanc: 'İlk kazanç', yildiz: 'Yıldız rekoru', gorev: 'Günlük görev', gunluk: 'Günün Şenliği', seri: 'Fener Nöbeti' };
  const m = h('div', 'metin', `<b>${s.tur === 'parlak' ? 'Parlak sandık' : 'Sandık'}</b><span>${neden[s.neden]} · #${s.sayac + 1}</span>`);
  const c = h('div', 'cekilisler');
  for (const x of s.cekilisler) {
    const t = cekilisMetni(x);
    c.append(h('span', `cekilis ${t.sinif}`, t.metin));
  }
  m.append(c);
  e.append(m);
  return e;
}

function tabloKarti(kod: string, nadirlik: 0 | 1 | 2, alt: string): HTMLElement {
  const e = h('div', 'kart tablo-kart');
  const cer = h('div', `cerceve n${nadirlik}`);
  cer.append(tabloTuvali(kod, 96, 144));
  e.append(cer);
  e.append(h('div', 'metin', `<b style="font-size:17px">Gece Tablosu · ${NADIRLIK_ADLARI[nadirlik]}</b><div class="soluk kucuk">${tabloKayitlari(kod)?.length ?? 0} patlama kaydı · ${Math.round((kod.length / 1024) * 10) / 10} KB</div><div class="soluk kucuk">${alt}</div>`));
  return e;
}

/** Hızlı Gece Tablosu önizlemesi (asıl çizici src/render/tablo.ts). */
function tabloTuvali(kod: string, w: number, hgt: number, gok = GOKYUZU.ayIsigi): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr;
  c.height = hgt * dpr;
  const x = c.getContext('2d')!;
  x.scale(dpr, dpr);
  const g = x.createLinearGradient(0, 0, 0, hgt);
  g.addColorStop(0, gok.ust);
  g.addColorStop(1, gok.alt);
  x.fillStyle = g;
  x.fillRect(0, 0, w, hgt);
  const kayitlar = tabloKayitlari(kod) ?? [];
  const r = { rng: kod.length * 2654435761 };
  const u = () => rngSonraki(r) / 4294967296;
  x.globalCompositeOperation = 'lighter';
  for (const k of kayitlar) {
    const cx = w * (0.1 + (0.8 * k.x) / 7) + (u() - 0.5) * 6;
    const cy = hgt * (0.08 + (0.6 * k.y) / 9) + (u() - 0.5) * 6;
    const rad = (5 + 3 * k.nesil) * (w / 120);
    const renk = k.renk === 7 ? `hsl(${u() * 360},95%,70%)` : KAPSUL_RENKLERI[Math.min(5, k.renk)].ana;
    const kol = k.ozel === 2 ? 14 : k.ozel === 1 ? 2 : 8;
    x.strokeStyle = renk;
    x.globalAlpha = 0.18;
    x.lineWidth = 0.8;
    const a0 = k.ozel === 1 ? Math.floor(u() * 4) * (Math.PI / 4) : u() * Math.PI;
    for (let i = 0; i < kol; i++) {
      const a = a0 + (i / kol) * Math.PI * 2;
      const L = rad * (k.ozel === 1 ? 2.4 : 1) * (0.7 + u() * 0.5);
      x.beginPath();
      x.moveTo(cx, cy);
      x.quadraticCurveTo(cx + Math.cos(a) * L * 0.6, cy + Math.sin(a) * L * 0.6, cx + Math.cos(a) * L, cy + Math.sin(a) * L + L * 0.25);
      x.stroke();
    }
    x.globalAlpha = 0.35;
    x.fillStyle = '#FFF4C2';
    x.fillRect(cx - 0.6, cy - 0.6, 1.2, 1.2);
  }
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.fillStyle = '#05050f';
  const t = { rng: 5 };
  let bx = 0;
  x.beginPath();
  x.moveTo(0, hgt);
  while (bx < w) {
    const gg = 6 + (rngSonraki(t) / 4294967296) * 12;
    const yy = hgt - 8 - (rngSonraki(t) / 4294967296) * 18;
    x.lineTo(bx, yy);
    x.lineTo(bx + gg, yy);
    bx += gg;
  }
  x.lineTo(w, hgt);
  x.fill();
  return c;
}

// Günlük ───────────────────────────────────────────────

function gunlukCiz(sag: HTMLElement): void {
  const k = durum.kayit;
  const sayfa = h('div', 'sayfa');
  sayfa.append(h('h2', '', `Günün Şenliği · ${tarihMetni(durum.bugun)} ${GUNLER[haftaGunu(durum.bugun)]}`));
  if (!bolumAcikMi(k, durum.bugun, durum.bugun)) {
    sayfa.append(h('div', 'kart soluk', `${S.kilit.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px"')} 10. bölümü kazanınca açılır.`));
  } else {
    const s = k.gunluk.enIyi[String(durum.bugun)];
    const ust = h('div', 'kart satir');
    ust.append(h('div', 'simge', S.takvim));
    ust.append(h('div', '', s ? `<div class="buyuk">En iyi: ${sayi(s.puan)} <span class="yildizlar">${yildizMetni(s.yildiz)}</span></div><div class="soluk kucuk">${s.deneme} deneme · ${s.kazandi ? 'kazanıldı' : 'henüz kazanılmadı'}${k.gunluk.ilkKazanc === durum.bugun ? ' · sandık alındı' : ''}</div>` : '<div class="buyuk">Bugünün tahtası seni bekliyor</div><div class="soluk kucuk">Sınırsız deneme · ilk kazanç sandık verir</div>'));
    sayfa.append(ust);
    sayfa.append(h('h2', '', 'Görevler'));
    const tamam = k.gunluk.gorevler.filter((g) => g.tamam).length;
    for (const g of k.gunluk.gorevler) {
      const e = h('div', `kart gorev${g.tamam ? ' tamam' : ''}`);
      e.innerHTML = `<div class="satir"><div style="flex:1">${gorevMetni(g)}</div><div class="soluk kucuk">${g.ilerleme}/${g.hedef}</div><div class="simge" style="width:30px;height:30px;border-radius:9px">${g.tamam ? S.ok : S.sandik}</div></div><div class="ilerleme"><i style="width:${(100 * g.ilerleme) / g.hedef}%"></i></div>`;
      sayfa.append(e);
    }
    sayfa.append(h('div', 'soluk kucuk', `${tamam}/3 tamam${tamam === 3 ? ' · parlak sandık verildi' : ' · üçü de bitince sonuncusu parlak sandık'}`));
    if (s) {
      sayfa.append(h('h2', '', 'Paylaş'));
      sayfa.append(h('pre', 'paylas', paylasimMetni(durum.bugun, s).replace(/</g, '&lt;')));
    }
  }
  sayfa.append(h('h2', '', 'Fener Nöbeti'));
  const fn = h('div', 'kart');
  const b = seriBasamakIndeksi(k.gunluk.seri);
  const sonraki = sonrakiBasamak(k.gunluk.seri);
  fn.innerHTML = `<div class="satir"><div class="simge" style="color:var(--isi)">${S.alev}</div><div><div class="buyuk">${k.gunluk.seri} gün${b >= 0 ? ` · ${SERI_BASAMAKLARI[b].ad}` : ''}</div><div class="soluk kucuk">${sonraki ? `${sonraki.yonelme} ${sonraki.kalan} gün` : 'En üst basamak'} · en uzun ${k.gunluk.enUzunSeri} · haftada 1 kaçırma affedilir</div></div></div>`;
  const mer = h('div', 'merdiven');
  SERI_BASAMAKLARI.forEach((s, i) => {
    mer.append(h('div', `basamak${i <= b ? ' gecildi' : ''}${i === b ? ' simdiki' : ''}`, `${S.alev}<b>${s.esik}</b>${s.ad}`));
  });
  fn.append(mer);
  sayfa.append(fn);
  sayfa.append(h('h2', '', 'Arşiv · sandık vermez'));
  const ars = h('div', 'arsiv');
  for (const t of arsivGunleri(durum.bugun).reverse()) {
    const s = k.gunluk.enIyi[String(t)];
    ars.append(h('div', `gun${s ? ' oynandi' : ''}`, `<b>${String(t % 100).padStart(2, '0')}</b>${GUN_KISA[haftaGunu(t)]}<div class="yildizlar" style="font-size:10px">${s ? yildizMetni(s.yildiz) : '&nbsp;'}</div>`));
  }
  sayfa.append(ars);
  sag.append(sayfa);
  const ey = h('div', 'eylemler');
  const d = (metin: string, sinif: string, f: () => void) => {
    const bt = h('button', `dugme ${sinif}`, metin);
    bt.onclick = () => {
      f();
      ciz();
    };
    return bt;
  };
  ey.append(d('Ertesi gün', '', () => gunIlerle(1)));
  ey.append(d('2 gün atla<small>kaçırma</small>', '', () => gunIlerle(3)));
  if (bolumAcikMi(k, durum.bugun, durum.bugun)) ey.append(d('Şenliği oyna', 'ana', () => oyna(durum.bugun, durum.tohum % 4 !== 0, 1 + (durum.tohum % 3))));
  else ey.append(d('Bölüm oyna', 'ana', () => oyna(acikEnYuksek(durum.kayit), true, 2)));
  sag.append(ey);
}

// Defter ───────────────────────────────────────────────

function defterCiz(sag: HTMLElement): void {
  const k = durum.kayit;
  const oz = defterOzeti(k);
  const sayfa = h('div', 'sayfa');
  sayfa.append(h('h2', '', `Desenler · ${oz.desen.tamam}/${oz.desen.toplam} · parça ${oz.desen.parca}/${oz.desen.parcaToplam}`));
  const iz = h('div', 'izgara');
  desenDurumlari(k).forEach((d, i) => {
    const e = h('div', `desen${d.acik ? '' : ' kapali'}${d.takili ? ' takili' : ''}`);
    e.innerHTML = `${desenSvg(i, KAPSUL_RENKLERI[i % 6].ana)}${d.ad}<div class="pipler">${d.parcalar.map((p) => `<i class="pip${p ? ' var' : ''}"></i>`).join('')}</div>${d.takili ? '<i class="takili-isaret"></i>' : ''}`;
    iz.append(e);
  });
  sayfa.append(iz);
  sayfa.append(h('div', 'soluk kucuk', `<br>Takılı: ${k.koleksiyon.takili.length}/6 · noktalı kutular gökyüzünde kullanılır`));
  sayfa.append(h('h2', '', `Fitiller · ${oz.fitil.acik}/${oz.fitil.toplam}`));
  const ft = h('div', 'fitiller');
  const ipRenk = ['#c9a36b', '#FFD25E', '#9fd8ff', 'linear-gradient(90deg,#FF4D4D,#FFB020,#2EE07A,#3AA8FF,#B266FF)', '#c6ff7c', '#FF5FB4', '#bff3ff', '#FF7A1A', '#FFF4C2'];
  fitilDurumlari(k).forEach((f, i) => {
    const e = h('div', `fitil${f.acik ? '' : ' kapali'}${f.secili ? ' secili' : ''}`);
    e.innerHTML = `${f.ad}<div class="ip" style="background:${ipRenk[i]};opacity:${f.acik ? 1 : 0.25}"></div><div class="pipler" style="justify-content:flex-start">${f.parcalar.map((p) => `<i class="pip${p ? ' var' : ''}"></i>`).join('')}</div>`;
    ft.append(e);
  });
  sayfa.append(ft);
  sayfa.append(h('h2', '', `Gökyüzü · ${oz.gokyuzu.kazanildi}/${oz.gokyuzu.toplam}`));
  const gk = h('div', 'gokler');
  for (const g of gokyuzuDurumlari(k)) {
    const e = h('div', `gok${g.acik ? '' : ' kapali'}${g.secili ? ' secili' : ''}`, g.ad);
    e.style.background = `linear-gradient(${g.ust}, ${g.alt})`;
    gk.append(e);
  }
  sayfa.append(gk);
  const tablolar = tabloListesi(k);
  sayfa.append(h('h2', '', `Gece Tabloları · ${oz.tablo.sayi} · Parlak ${oz.tablo.parlak} · Şaheser ${oz.tablo.saheser}`));
  if (tablolar.length === 0) sayfa.append(h('div', 'kart soluk', 'Kazandığın her bölüm kendi patlamalarından bir tablo bırakır.'));
  else {
    const gl = h('div', 'galeri');
    for (const t of tablolar.slice(-15)) {
      const f = h('figure', '');
      const cer = h('div', `cerceve n${t.nadirlik}`);
      const m = bolumMahallesi(t.bolumId > 100 ? (t.bolumId - 100) * 5 : t.bolumId, VARSAYILAN_META_AYAR);
      cer.append(tabloTuvali(t.kod, 90, 135, GOKYUZU[MAHALLELER[Math.min(7, m)].gokyuzu]));
      f.append(cer);
      f.append(h('figcaption', '', `${t.bolumId > 100 ? `U${t.bolumId - 100}` : `Bölüm ${t.bolumId}`} · ${NADIRLIK_ADLARI[t.nadirlik]}`));
      gl.append(f);
    }
    sayfa.append(gl);
  }
  sayfa.append(h('h2', '', `Kartlar · ${oz.kart.acik}/${oz.kart.toplam}`));
  const kl = h('div', 'kartlar');
  for (const c of kartDurumlari(k).filter((c) => c.acik).concat(kartDurumlari(k).filter((c) => !c.acik).slice(0, 3))) {
    kl.append(h('div', `kart${c.acik ? '' : ' kilitli'}`, `<div class="satir"><div class="simge" style="width:30px;height:30px">${c.acik ? S.kart : S.kilit}</div><div><b>${c.acik ? c.baslik : '???'}</b><div class="soluk kucuk">${c.acik ? c.metin.split('. ')[0] + '.' : `${MAHALLELER[c.mahalle].ad} · ${c.tur === 'defter' ? 'mahalleyi tamamla' : 'mahallede hepsi ★★★'}`}</div></div></div>`));
  }
  sayfa.append(kl);
  const roz = rozetDurumlari(k);
  sayfa.append(h('h2', '', `Rozetler · ${roz.filter((r) => r.kazanildi).length}/${roz.length}`));
  const rz = h('div', 'cekilisler');
  for (const r of roz) rz.append(h('span', `cekilis${r.kazanildi ? ' tamam' : ''}`, r.ad));
  sayfa.append(rz);
  if (durum.defterMesaj) sayfa.append(h('div', 'kart', durum.defterMesaj));
  sag.append(sayfa);
  const ey = h('div', 'eylemler');
  const tozB = h('button', 'dugme ana', `Toz harca<small>${k.toz} toz · 10 = 1 parça</small>`);
  tozB.onclick = () => {
    const eksik = eksikParcalar(durum.kayit).desen[0];
    const r = eksik ? tozlaParcaAl(durum.kayit, eksik) : null;
    if (r && r.tamam) {
      durum.kayit = r.kayit;
      durum.defterMesaj = `Toz harcandı: ${cekilisMetni(r.cekilis).metin}`;
    } else durum.defterMesaj = r ? 'Yeterli toz yok (10 gerekli).' : 'Bütün desen parçaları toplandı.';
    ciz();
  };
  const sandikB = h('button', 'dugme', 'Sandık aç<small>deneme</small>');
  sandikB.onclick = () => {
    const r = sandikAc(durum.kayit, { tur: 'normal', neden: 'gorev' });
    durum.kayit = r.kayit;
    durum.defterMesaj = `Sandık #${r.sonuc.sayac + 1}: ${r.sonuc.cekilisler.map((c) => cekilisMetni(c).metin).join(', ')}`;
    ciz();
  };
  ey.append(sandikB, tozB);
  sag.append(ey);
}

// Kayıt ───────────────────────────────────────────────

function kayitCiz(sag: HTMLElement): void {
  const k = durum.kayit;
  const sayfa = h('div', 'sayfa');
  const kod = kayitKoduUret(k);
  const kisa = kayitKoduUret(k, { tablolarHaric: true });
  sayfa.append(h('h2', '', 'Kayıt kodu'));
  const kk = h('div', 'kart');
  kk.innerHTML = `<div class="kod">${kod.slice(0, 64)}…${kod.slice(-12)}</div><div class="soluk kucuk" style="margin-top:6px">Tam: ${sayi(kod.length)} karakter · tablolar hariç: ${sayi(kisa.length)} · ilerleme puanı ${sayi(progressScore(k))}</div>`;
  sayfa.append(kk);
  const coz = kayitKoduCoz(kod.replace(/(.{60})/g, '$1\n'));
  sayfa.append(h('h2', '', 'İçe aktarma önizlemesi'));
  if (coz.tamam) {
    const o = coz.onizleme;
    sayfa.append(
      h(
        'div',
        'kart ozet-izgara',
        `<div><span>Yıldız</span><br>${o.anaYildiz}/${o.enFazlaYildiz} ★${o.ustaYildiz ? ` + ${o.ustaYildiz} Usta` : ''}</div><div><span>Bölüm</span><br>${o.acikBolum} · ${o.mahalle}</div><div><span>Desen</span><br>${o.desen}/${o.desenToplam}</div><div><span>Rozet</span><br>${o.rozet}</div><div><span>Tablo</span><br>${o.tablo}</div><div><span>Fener Nöbeti</span><br>${o.seri} gün</div>`,
      ),
    );
  } else sayfa.append(h('div', 'kart', coz.mesaj));
  const bozuk = kayitKoduCoz(kod.slice(0, 40) + 'X' + kod.slice(41));
  sayfa.append(h('div', 'kart soluk kucuk', `Bir karakteri bozulmuş kod: “${bozuk.tamam ? 'kabul edildi' : bozuk.mesaj}”`));
  sayfa.append(h('h2', '', 'Onarım (bozuk alanlar varsayılana)'));
  const ham = JSON.parse(JSON.stringify(k));
  ham.toz = -50;
  ham.guclendiriciler.kibrit = 99;
  ham.koleksiyon.takili = ['palmiye', 'yokBoyle'];
  ham.bolumler['3'] = { yildiz: 9 };
  ham.ayarlar.mola = 17;
  delete ham.istatistik;
  const on = kayitOnar(ham);
  const li = h('ul', 'liste');
  for (const y of on.onarilan.slice(0, 12)) li.append(h('li', '', y));
  if (on.onarilan.length > 12) li.append(h('li', '', `+${on.onarilan.length - 12}`));
  const ok = h('div', 'kart');
  ok.append(h('div', 'soluk kucuk', `${on.onarilan.length} alan onarıldı; geri kalan ilerleme korundu (★ ${on.kayit ? Object.values(on.kayit.bolumler).reduce((s, b) => s + b.yildiz, 0) : 0}).`));
  ok.append(li);
  sayfa.append(ok);
  sayfa.append(h('h2', '', `Mola hatırlatıcısı · ${k.ayarlar.mola} dk`));
  const mk = h('div', 'kart');
  const kalan = molayaKalan(durum.mola, k.ayarlar.mola);
  mk.innerHTML = `<div class="satir"><div class="simge">${S.gunes}</div><div><div class="buyuk">${Math.floor(durum.mola.etkinMs / 60000)} dk oyun</div><div class="soluk kucuk">${kalan === null ? 'Kapalı' : `Hatırlatmaya ${Math.ceil(kalan / 60000)} dk`} · 5 dk+ ara sayacı sıfırlar</div></div></div>`;
  if (durum.molaBalon) mk.append(h('div', 'balon', MOLA_METNI));
  sayfa.append(mk);
  sag.append(sayfa);
  const ey = h('div', 'eylemler');
  const d = (metin: string, sinif: string, f: () => void) => {
    const b = h('button', `dugme ${sinif}`, metin);
    b.onclick = () => {
      f();
      ciz();
    };
    return b;
  };
  const ilerlet = (ms: number, gorunur: boolean) => {
    const adim = 30_000;
    for (let t = 0; t < ms; t += adim) {
      durum.molaSaat += adim;
      const r = molaIlerle(durum.mola, durum.molaSaat, { dakika: durum.kayit.ayarlar.mola, gorunur });
      durum.mola = r.durum;
      if (r.goster) durum.molaBalon = true;
    }
    durum.mola = molaIlerle(durum.mola, durum.molaSaat, { dakika: durum.kayit.ayarlar.mola, gorunur: true }).durum;
  };
  ey.append(d('+15 dk oyun', '', () => ilerlet(15 * 60_000, true)));
  ey.append(d('6 dk ara', '', () => ilerlet(6 * 60_000, false)));
  ey.append(
    d('Balonu kapat', 'ana', () => {
      durum.mola = molaKapat(durum.mola, durum.molaSaat);
      durum.molaBalon = false;
    }),
  );
  sag.append(ey);
}

// ───────────────────────────── Başlat ─────────────────────────────

declare global {
  interface Window {
    __meta: {
      senaryo(ad: 'yeni' | 'orta' | 'ileri'): void;
      sekme(s: Sekme): void;
      oyna(id: number, kazandi: boolean, yildiz: number): void;
      gun(n: number): void;
      mola(dk: number, gorunur?: boolean): void;
      kayit(): Kayit;
    };
  }
}

window.__meta = {
  senaryo(ad) {
    senaryo(ad);
    ciz(true);
  },
  sekme(s) {
    durum.sekme = s;
    ciz(s === 'harita');
  },
  oyna(id, kazandi, yildiz) {
    oyna(id, kazandi, yildiz);
    ciz();
  },
  gun(n) {
    gunIlerle(n);
    ciz();
  },
  mola(dk, gorunur = true) {
    for (let t = 0; t < dk * 60_000; t += 30_000) {
      durum.molaSaat += 30_000;
      const r = molaIlerle(durum.mola, durum.molaSaat, { dakika: durum.kayit.ayarlar.mola, gorunur });
      durum.mola = r.durum;
      if (r.goster) durum.molaBalon = true;
    }
    ciz();
  },
  kayit: () => durum.kayit,
};

senaryo('orta');
ciz(true);
window.addEventListener('resize', () => ciz());
