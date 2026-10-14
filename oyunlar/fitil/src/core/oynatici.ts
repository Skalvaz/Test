/**
 * Olay oynatıcısı (§12.4, §16.1): çizicinin "görsel tahtası" için saf
 * indirgeyici. Çizici, ses ve arayüz yalnız `Olay[]` tüketir; çizici her
 * olayı oynatma zaman çizelgesinde gerçekleştiği anda `olayUygula` ile kendi
 * tahtasına uygular. Geliştirme kipinde oynatma sonunda `gorselFark` ile
 * çekirdeğin `sonraki` durumuyla karşılaştırır (§16.1: "bu tahta çekirdeğin
 * durum' değeriyle karşılaştırılır").
 *
 * Katı kipte (testler, geliştirme kipi) her olayın ÖNKOŞULU denetlenir: olay,
 * görsel tahtada beklediği içeriği bulamazsa `OynaticiHatasi` fırlatılır.
 * Böylece çizici bir olayı canlandırırken kaynağını (patlayan kapsülün rengi,
 * düşen taşın içeriği, hasar alan kayanın katı) her zaman kendi tahtasında
 * bulur; yalnız sonucu değil, olay sırasını da doğrular.
 *
 * `kalanHamle` olaylardan çıkmaz: uygulama gönderdiği hamleyi bilir (fitil ve
 * çift dokunuş −1, Usta'nın Eli +5, final sonunda 0); HUD `sonraki`den okur.
 * İstatistik, RNG, hava sayaçları ve fener doğum sayacı görsel değildir.
 */
import type { Hucre, Icerik, Konum, Olay, OyunDurumu } from './types';

export class OynaticiHatasi extends Error {}

export interface GorselTahta {
  w: number;
  h: number;
  esik: number;
  hucreler: Hucre[];
  puan: number;
  korukDolum: number;
  korukKapasite: number;
  hedefler: { ilerleme: number; gerekli: number; tamam: boolean }[];
  /** izler[k][j]: k. barut izinin j. hücresi yandı mı. */
  izler: boolean[][];
  /** izHucreleri[k]: k. izin hücre indeksleri (iz sırasıyla). */
  izHucreleri: number[][];
  bitti: null | 'kazanc' | 'kayip';
}

function icerikKopya(ic: Icerik | null): Icerik | null {
  return ic ? ({ ...ic } as Icerik) : null;
}

/** Bölüm başında (ya da animasyonsuz eşitlemede) görsel tahtayı durumdan kurar. */
export function gorselTahtaKur(d: OyunDurumu): GorselTahta {
  return {
    w: d.w,
    h: d.h,
    esik: d.esik,
    hucreler: d.hucreler.map((h) => ({ ...h, icerik: icerikKopya(h.icerik) })),
    puan: d.puan,
    korukDolum: d.korukDolum,
    korukKapasite: d.korukKapasite,
    hedefler: d.hedefler.map((h) => ({ ilerleme: h.ilerleme, gerekli: h.gerekli, tamam: h.tamam })),
    izler: d.izler.map((iz) => [...iz.yandi]),
    izHucreleri: d.izler.map((iz) => [...iz.hucreler]),
    bitti: d.bitti,
  };
}

function hareketli(h: Hucre): boolean {
  const ic = h.icerik;
  if (!ic) return false;
  return (ic.tur === 'kapsul' && !h.kafes) || ic.tur === 'islak' || ic.tur === 'fener';
}

/**
 * Tek bir olayı görsel tahtaya uygular. `kati` ise önkoşul ihlalinde
 * `OynaticiHatasi` fırlatır (olay tahtada beklediğini bulamadı).
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
  switch (o.tur) {
    case 'fitilBasladi':
      for (const p of o.yol) on(H(p).icerik?.tur === 'kapsul' && !H(p).kafes, 'yol düğümü kafessiz kapsül değil', p);
      return;
    case 'dugumYandi': {
      // Dönüşen son düğüm de yanar; düğüm henüz patlamadı.
      on(H(o.hucre).icerik?.tur === 'kapsul', 'yanan düğümde kapsül yok', o.hucre);
      return;
    }
    case 'patlama': {
      const h = H(o.hucre);
      const ic = h.icerik;
      on(ic?.tur === 'kapsul', 'patlayan hücrede kapsül yok', o.hucre);
      if (ic?.tur === 'kapsul') {
        on(ic.renk === o.renk, `renk ${ic.renk} ≠ olay ${o.renk}`, o.hucre);
        on(ic.ozel === o.ozel, `özel ${ic.ozel} ≠ olay ${o.ozel}`, o.hucre);
      }
      h.icerik = null;
      h.isikIzi = true;
      g.puan += o.puan;
      return;
    }
    case 'isindi':
    case 'isiDegisti': {
      const ic = H(o.hucre).icerik;
      on(ic?.tur === 'kapsul', 'ısınan hücrede kapsül yok', o.hucre);
      if (o.tur === 'isindi') {
        on(o.kizgin === o.isi >= g.esik - 1, 'kizgin bayrağı eşik−1 ile uyuşmuyor', o.hucre);
        if (ic?.tur === 'kapsul') on(o.isi > ic.isi, 'isindi ısıyı artırmadı', o.hucre);
      }
      if (ic?.tur === 'kapsul') ic.isi = o.isi;
      return;
    }
    case 'ozelOlustu': {
      const h = H(o.hucre);
      const ic = h.icerik;
      on(ic?.tur === 'kapsul', 'özel taşa dönen hücrede kapsül yok', o.hucre);
      const isi = o.isi ?? (ic?.tur === 'kapsul' ? ic.isi : 0);
      h.icerik = { tur: 'kapsul', renk: o.renk as 0, isi, ozel: o.ozel, eksen: o.eksen };
      return;
    }
    case 'ozelTetiklendi':
    case 'yuklendi':
      // Özel taş, kendi `patlama` olayının hemen ardından tetiklenir/yüklenir.
      on(H(o.hucre).icerik === null, 'tetiklenen özel taşın hücresi boşalmadı', o.hucre);
      return;
    case 'engelHasar': {
      const h = H(o.hucre);
      const ic = h.icerik;
      on(ic?.tur === o.engel && ic.kat === o.kalan + 1, `${o.engel} katı ${o.kalan + 1} değil`, o.hucre);
      if (o.kalan <= 0) h.icerik = null;
      else if (ic?.tur === 'kaya' || ic?.tur === 'kova') ic.kat = o.kalan as 1;
      return;
    }
    case 'kafesKirildi': {
      const h = H(o.hucre);
      on(h.kafes, 'kafes yok', o.hucre);
      h.kafes = false;
      return;
    }
    case 'kurudu': {
      const h = H(o.hucre);
      on(h.icerik?.tur === 'islak' && h.icerik.renk === o.renk, 'kuruyan ıslak barut yok', o.hucre);
      h.icerik = { tur: 'kapsul', renk: o.renk as 0, isi: 0, ozel: 'yok', eksen: 0 };
      return;
    }
    case 'dosemeAydinlandi': {
      const h = H(o.hucre);
      on(h.doseme === o.kalan + 1, `döşeme katı ${o.kalan + 1} değil`, o.hucre);
      h.doseme = o.kalan as 0 | 1;
      return;
    }
    case 'desenBoyandi': {
      const h = H(o.hucre);
      on(h.desenRengi === o.renk && !h.desenBoyali, 'boyanacak desen yok', o.hucre);
      h.desenBoyali = true;
      return;
    }
    case 'izYandi': {
      const k = H(o.hucre).izIndeksi;
      const j = k >= 0 ? g.izHucreleri[k].indexOf(o.hucre.y * g.w + o.hucre.x) : -1;
      on(j >= 0 && !g.izler[k][j], 'yanmamış iz hücresi değil', o.hucre);
      if (j >= 0) g.izler[k][j] = true;
      return;
    }
    case 'devFisekDoldu': {
      const ic = H(o.hucre).icerik;
      on(ic?.tur === 'devFisek' && ic.dolum === o.dolum - 1 && ic.kapasite === o.kapasite && o.dolum <= o.kapasite, 'dev fişek dolumu bir artmadı', o.hucre);
      if (ic?.tur === 'devFisek') ic.dolum = o.dolum;
      return;
    }
    case 'devFisekFirladi': {
      const h = H(o.hucre);
      on(h.icerik?.tur === 'devFisek' && h.icerik.dolum >= h.icerik.kapasite, 'dolu dev fişek yok', o.hucre);
      h.icerik = null;
      return;
    }
    case 'isTemizlendi': {
      const h = H(o.hucre);
      on(h.icerik?.tur === 'is', 'temizlenen is yok', o.hucre);
      h.icerik = null;
      return;
    }
    case 'isYayildi': {
      const h = H(o.hucre);
      on(h.icerik?.tur === 'kapsul' && !h.kafes && h.icerik.ozel === 'yok', 'ise dönen düz kapsül yok', o.hucre);
      h.icerik = { tur: 'is' };
      return;
    }
    case 'fenerToplandi': {
      const h = H(o.hucre);
      on(h.icerik?.tur === 'fener', 'toplanan fener yok', o.hucre);
      h.icerik = null;
      return;
    }
    case 'yercekimi': {
      // Önce bütün kaynaklar okunur ve boşaltılır, sonra hedeflere yazılır
      // (aynı sütunda zincirleme kaymalar birbirini ezmez).
      const tasinan = o.dusenler.map((m) => {
        const h = H(m.den);
        on(hareketli(h), 'düşen hücrede hareketli içerik yok', m.den);
        on(m.den.x === m.e.x && m.e.y > m.den.y, 'düşüş aynı sütunda aşağı değil', m.den);
        return h.icerik;
      });
      for (const m of o.dusenler) H(m.den).icerik = null;
      o.dusenler.forEach((m, k) => {
        const h = H(m.e);
        on(h.icerik === null && !h.kafes, 'düşülen yuva dolu', m.e);
        h.icerik = tasinan[k];
      });
      for (const dg of o.doganlar) {
        const h = H(dg.hucre);
        on(h.icerik === null && !h.kafes, 'doğum yuvası dolu', dg.hucre);
        on(dg.sanalY < 0, 'sanalY tahta üstünde değil', dg.hucre);
        on(dg.icerik.tur === 'fener' || (dg.icerik.tur === 'kapsul' && dg.icerik.isi === 0 && dg.icerik.ozel === 'yok'), 'doğan içerik düz kapsül ya da fener değil', dg.hucre);
        h.icerik = icerikKopya(dg.icerik);
      }
      return;
    }
    case 'karistirma': {
      const tasinan = o.esleme.map((m) => {
        const h = H(m.den);
        on(h.icerik?.tur === 'kapsul' && !h.kafes, 'karıştırılan hücrede kafessiz kapsül yok', m.den);
        return h.icerik;
      });
      for (const m of o.esleme) H(m.den).icerik = null;
      o.esleme.forEach((m, k) => {
        const h = H(m.e);
        on(h.icerik === null && !h.kafes, 'karıştırma hedefi permütasyon dışında', m.e);
        h.icerik = tasinan[k];
      });
      for (const r of o.yenidenRenk) {
        const ic = H(r.hucre).icerik;
        on(ic?.tur === 'kapsul' && ic.ozel === 'yok', 'yeniden renklenen düz kapsül yok', r.hucre);
        if (ic?.tur === 'kapsul') ic.renk = r.renk as 0;
      }
      return;
    }
    case 'hedefIlerledi': {
      const h = g.hedefler[o.indeks];
      on(!!h, `hedef ${o.indeks} yok`);
      if (!h) return;
      h.ilerleme = o.deger;
      h.tamam = o.tamam;
      if (o.gerekli !== undefined) h.gerekli = o.gerekli;
      on(h.ilerleme <= h.gerekli && h.tamam === h.ilerleme >= h.gerekli, 'hedef ilerlemesi tutarsız');
      return;
    }
    case 'puanEklendi':
      on(o.miktar > 0, 'puan artışı pozitif değil');
      g.puan += o.miktar;
      return;
    case 'korukDoldu':
      on(o.dolum > g.korukDolum && o.dolum <= o.kapasite && o.kapasite === g.korukKapasite, 'körük dolumu artmadı ya da taştı');
      g.korukDolum = o.dolum;
      return;
    case 'korukKullanildi':
      on(g.korukKapasite > 0 && g.korukDolum >= g.korukKapasite, 'körük dolu değilken kullanıldı');
      g.korukDolum = 0;
      return;
    case 'bolumBitti':
      on(g.bitti === null, 'bölüm zaten bitmişti');
      g.bitti = o.sonuc;
      return;
    case 'kombinasyon':
    case 'isiDalgasi':
    case 'havaOlayi':
    case 'guclendirici':
    case 'finalBasladi':
    case 'reaksiyon':
      // Yalnız görsel/işitsel; tahta durumunu değiştirmez.
      return;
  }
}

/** Olay dizisini sırayla uygular (zaman çizelgesi olmadan). */
export function olaylariUygula(g: GorselTahta, olaylar: readonly Olay[], kati = false): GorselTahta {
  for (const o of olaylar) olayUygula(g, o, kati);
  return g;
}

/** İçeriğin alan sırasından bağımsız metni (karşılaştırma için). */
function icerikMetni(ic: Icerik | null): string {
  if (!ic) return '-';
  switch (ic.tur) {
    case 'kapsul':
      return `kapsul:${ic.renk}:${ic.isi}:${ic.ozel}:${ic.eksen}`;
    case 'islak':
      return `islak:${ic.renk}`;
    case 'fener':
    case 'is':
      return ic.tur;
    case 'kaya':
    case 'kova':
      return `${ic.tur}:${ic.kat}`;
    case 'devFisek':
      return `devFisek:${ic.dolum}/${ic.kapasite}`;
  }
}

/**
 * Görsel tahta ile durum arasındaki farklar (boş dizi = eşit). Hücrelerin
 * bütün katmanları (içerik, ısı, özel, kafes, zemin, ışık izi), puan, körük,
 * hedefler, barut izleri ve bitiş karşılaştırılır.
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
    if (a.kafes !== b.kafes) ekle(`${yer} kafes ${a.kafes} ≠ ${b.kafes}`);
    if (a.doseme !== b.doseme) ekle(`${yer} döşeme ${a.doseme} ≠ ${b.doseme}`);
    if (a.desenRengi !== b.desenRengi || a.desenBoyali !== b.desenBoyali) ekle(`${yer} desen ${a.desenRengi}/${a.desenBoyali} ≠ ${b.desenRengi}/${b.desenBoyali}`);
    if (a.izIndeksi !== b.izIndeksi) ekle(`${yer} iz ${a.izIndeksi} ≠ ${b.izIndeksi}`);
    if (a.isikIzi !== b.isikIzi) ekle(`${yer} ışık izi ${a.isikIzi} ≠ ${b.isikIzi}`);
  }
  if (g.puan !== d.puan) ekle(`puan ${g.puan} ≠ ${d.puan}`);
  if (g.korukDolum !== d.korukDolum) ekle(`körük ${g.korukDolum} ≠ ${d.korukDolum}`);
  d.hedefler.forEach((h, k) => {
    const a = g.hedefler[k];
    if (!a || a.ilerleme !== h.ilerleme || a.gerekli !== h.gerekli || a.tamam !== h.tamam)
      ekle(`hedef ${k} ${a ? `${a.ilerleme}/${a.gerekli}/${a.tamam}` : '-'} ≠ ${h.ilerleme}/${h.gerekli}/${h.tamam}`);
  });
  d.izler.forEach((iz, k) => {
    if (iz.yandi.some((y, j) => g.izler[k]?.[j] !== y)) ekle(`iz ${k} yanma ${JSON.stringify(g.izler[k])} ≠ ${JSON.stringify(iz.yandi)}`);
  });
  if (g.bitti !== d.bitti) ekle(`bitti ${g.bitti} ≠ ${d.bitti}`);
  return f;
}
