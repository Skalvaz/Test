/**
 * Olay oynatıcısı (GDD §13.2, FİTİL dersi 1): çizicinin "görsel tahtası"
 * için saf başvuru indirgeyicisi. Çizici, ses ve arayüz yalnız `Olay[]`
 * tüketir; çizici her olayı zaman çizelgesinde gerçekleştiği anda
 * `olayUygula` ile kendi tahtasına uygular, oynatma sonunda `gorselFark` ile
 * çekirdeğin `sonraki` durumuyla karşılaştırır (geliştirme kipinde fark
 * varsa `console.error`).
 *
 * Katı kipte (testler, geliştirme kipi) her olayın ÖNKOŞULU denetlenir:
 * temizlenen hücrede aynı kimlik/renk/özel; düşen damla var ve hedef yuva
 * boş; hasar alan mermerin canı; vb. Önkoşul bozulursa `OynaticiHatasi`.
 *
 * Olaylardan çıkmayanlar (uygulama `sonraki`den okur): `kalanHamle` (hamle
 * −1, Usta'nın Eli +5, şölen sonunda 0), Usta'nın Eli'nde `bitti = null`,
 * istatistik, RNG, günlük.
 */
import type { Damla, Hucre, Icerik, Konum, Olay, OyunDurumu } from './types';

export class OynaticiHatasi extends Error {}

/** Görsel tahta: çizicinin olaylardan güncellediği kopya. */
export interface GorselTahta {
  w: number;
  h: number;
  hucreler: OyunDurumu['hucreler'];
  puan: number;
  hedefler: { ilerleme: number; gerekli: number; tamam: boolean }[];
  bitti: OyunDurumu['bitti'];
}

function icerikKopya(ic: Icerik | null): Icerik | null {
  if (!ic) return null;
  return ic.tur === 'damla' ? { tur: 'damla', damla: { ...ic.damla } } : { ...ic };
}

/** Bölüm başında (ya da animasyonsuz eşitlemede) görsel tahtayı durumdan kurar. */
export function gorselTahtaKur(d: OyunDurumu): GorselTahta {
  return {
    w: d.w,
    h: d.h,
    hucreler: d.hucreler.map((h) => ({ ...h, icerik: icerikKopya(h.icerik) })),
    puan: d.puan,
    hedefler: d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam })),
    bitti: d.bitti,
  };
}

function damlaMetni(dm: Damla): string {
  return `${dm.id}:${dm.renk}:${dm.ozel}:${dm.yon}`;
}

/**
 * Tek bir olayı görsel tahtaya uygular. `kati` ise önkoşul ihlalinde
 * `OynaticiHatasi` fırlatır. Tahta etkileri `types.ts` Olay belgesindedir.
 */
export function olayUygula(g: GorselTahta, o: Olay, kati = false): void {
  const H = (p: Konum): Hucre => {
    const h = p.x >= 0 && p.y >= 0 && p.x < g.w && p.y < g.h ? g.hucreler[p.y * g.w + p.x] : undefined;
    if (!h) throw new OynaticiHatasi(`${o.tur} t=${o.t}: tahta dışı hücre (${p.x},${p.y})`);
    if (kati && h.delik) throw new OynaticiHatasi(`${o.tur} t=${o.t}: delik hücre (${p.x},${p.y})`);
    return h;
  };
  const on = (kosul: boolean, ne: string, p?: Konum): void => {
    if (kati && !kosul) throw new OynaticiHatasi(`${o.tur} t=${o.t}${p ? ` (${p.x},${p.y})` : ''}: ${ne}`);
  };
  const dm = (h: Hucre): Damla | null => (h.icerik?.tur === 'damla' ? h.icerik.damla : null);
  switch (o.tur) {
    case 'karisti': {
      const hk = H(o.kaynak);
      const he = H(o.hedef);
      const a = dm(hk);
      const b = dm(he);
      on(!!a && a.ozel === 'yok' && a.renk === o.a, `kaynakta ${o.a} renkli düz damla yok`, o.kaynak);
      on(!!b && b.ozel === 'yok' && b.renk === o.b, `hedefte ${o.b} renkli düz damla yok`, o.hedef);
      on(Math.abs(o.kaynak.x - o.hedef.x) + Math.abs(o.kaynak.y - o.hedef.y) === 1, 'komşu değil');
      hk.icerik = null;
      he.icerik = { tur: 'damla', damla: { id: o.yeniId, renk: o.sonuc, ozel: o.sonuc === 7 ? 'murekkep' : 'yok', yon: 'yatay' } };
      return;
    }
    case 'ozelSuruklendi': {
      const hk = H(o.kaynak);
      const he = H(o.hedef);
      const a = dm(hk);
      const b = dm(he);
      on(!!a && !!b, 'kaynak ya da hedef boş');
      if (o.ters) {
        on(!!a && a.ozel === 'yok' && !!b && b.ozel === o.ozel, `ters: hedefte ${o.ozel} yok`, o.hedef);
        return;
      }
      on(!!a && a.ozel === o.ozel, `kaynakta ${o.ozel} yok`, o.kaynak);
      if (o.tasindi) {
        if (o.damla && a) on(damlaMetni(a) === damlaMetni(o.damla), 'taşınan taş olaydakiyle aynı değil', o.kaynak);
        hk.icerik = null;
      }
      return;
    }
    case 'eslesti':
      for (const p of o.hucreler) {
        const d = dm(H(p));
        on(!!d && d.renk === o.renk && (d.ozel === 'yok' || d.ozel === 'tarak' || d.ozel === 'girdap'), `grup hücresinde ${o.renk} renkli damla yok`, p);
      }
      return;
    case 'temizlendi': {
      const h = H(o.hucre);
      const d = dm(h);
      on(!!d, 'temizlenecek damla yok', o.hucre);
      if (d) on(d.id === o.id && d.renk === o.renk && d.ozel === o.ozel, `damla ${damlaMetni(d)} ≠ olay ${o.id}:${o.renk}:${o.ozel}`, o.hucre);
      h.icerik = null;
      g.puan += o.puan;
      return;
    }
    case 'ozelOlustu': {
      const h = H(o.hucre);
      on(h.icerik === null, 'özel taş yeri boş değil', o.hucre);
      h.icerik = { tur: 'damla', damla: { ...o.damla } };
      return;
    }
    case 'ozelTetiklendi':
    case 'birlesim':
      // Ateşlenen taş daha önce (temizlendi ya da ozelSuruklendi{tasindi}) kalktı.
      H(o.hucre);
      return;
    case 'donustu': {
      const h = H(o.hucre);
      const d = dm(h);
      on(!!d && d.id === o.damla.id, 'dönüşecek damla yok', o.hucre);
      h.icerik = { tur: 'damla', damla: { ...o.damla } };
      return;
    }
    case 'mermerHasar': {
      const h = H(o.hucre);
      const ic = h.icerik;
      on(ic?.tur === 'mermer' && ic.can === o.kalan + 1, `mermer canı ${o.kalan + 1} değil`, o.hucre);
      h.icerik = o.kalan <= 0 ? null : { tur: 'mermer', can: o.kalan as 1 | 2 };
      return;
    }
    case 'kagitAlindi': {
      const h = H(o.hucre);
      on(h.kagit === o.kalan + 1, `kâğıt katı ${o.kalan + 1} değil`, o.hucre);
      h.kagit = o.kalan;
      return;
    }
    case 'yagKalkti': {
      const h = H(o.hucre);
      on(h.yag, 'yağ yok', o.hucre);
      h.yag = false;
      return;
    }
    case 'desenBoyandi': {
      const h = H(o.hucre);
      on(h.desen === o.renk && !h.desenBoyali, 'boyanacak desen yok', o.hucre);
      h.desenBoyali = true;
      return;
    }
    case 'yercekimi': {
      // Önce bütün kaynaklar okunur ve boşaltılır, sonra hedeflere yazılır;
      // ardından doğanlar boş yuvalara.
      const tasinan = o.dusenler.map((m) => {
        const h = H(m.den);
        on(h.icerik?.tur === 'damla', 'düşen hücrede damla yok', m.den);
        on(m.e.y > m.den.y, 'düşüş aşağı değil', m.den);
        return h.icerik;
      });
      for (const m of o.dusenler) H(m.den).icerik = null;
      o.dusenler.forEach((m, k) => {
        const h = H(m.e);
        on(h.icerik === null, 'düşülen yuva dolu', m.e);
        h.icerik = tasinan[k];
      });
      for (const dg of o.doganlar) {
        const h = H(dg.hucre);
        on(h.icerik === null, 'doğum yuvası dolu', dg.hucre);
        on(dg.sanalY < 0, 'sanalY tahta üstünde değil', dg.hucre);
        on(dg.damla.ozel === 'yok' && dg.damla.renk >= 1 && dg.damla.renk <= 6, 'doğan damla düz değil', dg.hucre);
        h.icerik = { tur: 'damla', damla: { ...dg.damla } };
      }
      return;
    }
    case 'karistirma': {
      const tasinan = o.esleme.map((m) => {
        const h = H(m.den);
        const d = dm(h);
        on(!!d && d.ozel === 'yok' && !h.yag, 'karıştırılan hücrede yağsız düz damla yok', m.den);
        return h.icerik;
      });
      for (const m of o.esleme) H(m.den).icerik = null;
      o.esleme.forEach((m, k) => {
        const h = H(m.e);
        on(h.icerik === null, 'karıştırma hedefi permütasyon dışında', m.e);
        h.icerik = tasinan[k];
      });
      return;
    }
    case 'hedefIlerledi': {
      const h = g.hedefler[o.indeks];
      on(!!h, `hedef ${o.indeks} yok`);
      if (!h) return;
      on(o.deger >= h.ilerleme, 'hedef ilerlemesi geriledi');
      h.ilerleme = o.deger;
      h.tamam = o.tamam;
      on(h.ilerleme <= h.gerekli && h.tamam === h.ilerleme >= h.gerekli, 'hedef ilerlemesi tutarsız');
      return;
    }
    case 'puanEklendi':
      on(o.miktar > 0, 'puan artışı pozitif değil');
      g.puan += o.miktar;
      return;
    case 'bolumBitti':
      on(g.bitti === null, 'bölüm zaten bitmişti');
      g.bitti = o.sonuc;
      return;
    case 'kaskat':
    case 'solenBasladi':
    case 'hamleOzeti':
      // Yalnız görsel/işitsel; tahtayı değiştirmez.
      return;
  }
}

/** Olay dizisini sırayla uygular (zaman çizelgesi olmadan). */
export function olaylariUygula(g: GorselTahta, olaylar: readonly Olay[], kati = false): GorselTahta {
  for (const o of olaylar) olayUygula(g, o, kati);
  return g;
}

function icerikMetni(ic: Icerik | null): string {
  if (!ic) return '-';
  return ic.tur === 'mermer' ? `mermer:${ic.can}` : damlaMetni(ic.damla);
}

/**
 * Görsel tahta ile durum arasındaki farklar (boş dizi = eşit): hücrelerin
 * bütün katmanları (içerik, kimlik, renk, özel, yön, delik, kâğıt, yağ,
 * desen), puan, hedefler ve bitiş.
 */
export function gorselFark(g: GorselTahta, d: OyunDurumu, enFazla = 20): string[] {
  const f: string[] = [];
  const ekle = (s: string): void => {
    if (f.length < enFazla) f.push(s);
  };
  if (g.w !== d.w || g.h !== d.h) return [`boyut ${g.w}×${g.h} ≠ ${d.w}×${d.h}`];
  for (let i = 0; i < d.hucreler.length; i++) {
    const a = g.hucreler[i];
    const b = d.hucreler[i];
    const yer = `(${i % d.w},${Math.floor(i / d.w)})`;
    const ia = icerikMetni(a.icerik);
    const ib = icerikMetni(b.icerik);
    if (ia !== ib) ekle(`${yer} içerik ${ia} ≠ ${ib}`);
    if (a.delik !== b.delik) ekle(`${yer} delik ${a.delik} ≠ ${b.delik}`);
    if (a.kagit !== b.kagit) ekle(`${yer} kâğıt ${a.kagit} ≠ ${b.kagit}`);
    if (a.yag !== b.yag) ekle(`${yer} yağ ${a.yag} ≠ ${b.yag}`);
    if (a.desen !== b.desen || a.desenBoyali !== b.desenBoyali) ekle(`${yer} desen ${a.desen}/${a.desenBoyali} ≠ ${b.desen}/${b.desenBoyali}`);
  }
  if (g.puan !== d.puan) ekle(`puan ${g.puan} ≠ ${d.puan}`);
  d.hedefler.forEach((h, k) => {
    const a = g.hedefler[k];
    if (!a || a.ilerleme !== h.ilerleme || a.gerekli !== h.gerekli || a.tamam !== h.tamam)
      ekle(`hedef ${k} ${a ? `${a.ilerleme}/${a.gerekli}/${a.tamam}` : '-'} ≠ ${h.ilerleme}/${h.gerekli}/${h.tamam}`);
  });
  if (g.bitti !== d.bitti) ekle(`bitti ${g.bitti} ≠ ${d.bitti}`);
  return f;
}
