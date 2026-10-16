/**
 * Kazandın (§14.6, §12.2): yıldızlar 300 ms arayla mühürlenir, YENİ REKOR,
 * puan sayılarak artar, sandık dokun-aç, Gece Tablosu önizlemesi ve
 * nadirlik etiketi ([Sakla] / [Eskisini koru]), "Sıradaki: X!".
 * Düğmeler: [Devam] (büyük) ve [Tekrar oyna].
 */
import { h, say, bekle } from '../dom';
import { yildizSvg, sandikSvg, ikon, muhurSvg, kandilSvg, type IkonAdi } from '../ikonlar';
import { M, MK, NADIRLIK_ADLARI, bolumBasligi, sayi } from '../metinler';
import { kandilUcur, merkez } from '../kanca';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { odulOgesi, tabloCercevesi, yeniOgeOnizleme, ustaIpucu, nadirlikSirasi } from './ortak';
import type { KazandinVM, SandikVM } from '../tipler';

const YILDIZ_ILK = 520;
const YILDIZ_ARA = 300;
/** (Kancalar §C.5) Yeni mühürler yıldız sonu + 200 ms'de, 250 ms arayla damgalanır. */
const MUHUR_GECIKME = 200;
const MUHUR_ARA = 250;

export function kazandinEkrani(
  b: Baglam,
  vm: KazandinVM,
  ek: { tablo?: HTMLCanvasElement | null } = {},
): { soz: Promise<'devam' | 'tekrar'>; kapat: () => void } {
  const { soz, sec } = secimSozu<'devam' | 'tekrar'>();
  const az = b.az();
  const zamanlayicilar: ReturnType<typeof setTimeout>[] = [];
  const sonra = (ms: number, fn: () => void) => zamanlayicilar.push(setTimeout(fn, az ? 0 : ms));
  let sayimIptal: (() => void) | null = null;
  let kandilIptal: (() => void) | null = null;
  // Ekran kapanınca (Devam/Tekrar) uçan kandiller kalkar, sayaç sesi susar.
  const ucusIptal = new AbortController();

  // ── Yıldızlar
  const yildizlar = [0, 1, 2].map((i) => {
    const altin = yildizSvg(true, 'f-kz-altin');
    const kivilcim = h('span', { s: 'f-kz-kivilcim' }, Array.from({ length: 10 }, (_, k) => h('i', { css: { '--a': `${k * 36 + 8}deg` } })));
    return h('div', { s: `f-kz-yildiz f-y${i}` }, yildizSvg(false, 'f-kz-yuva'), h('span', { s: 'f-kz-halka' }), kivilcim, altin);
  });
  const yildizSira = h('div', { s: 'f-kz-yildizlar', role: 'img', 'aria-label': `${vm.yildiz}/3 yıldız` }, yildizlar);
  const rekor = h('div', { s: `f-kz-rekor${vm.yeniRekor ? '' : ' f-yok'}`, 'aria-hidden': vm.yeniRekor ? undefined : 'true' }, h('span', { t: M.yeniRekor }));
  const puanSayi = h('span', { s: 'f-kz-puan-sayi f-sayi', t: '0' });
  const puan = h('div', { s: 'f-kz-puan' }, h('span', { s: 'f-etiket', t: M.puan }), puanSayi);

  // ── (Kancalar §C.5) Mühürler: yıldızların hemen altında 3 mum mühür (32 px).
  const mv = vm.muhurler && vm.muhurler.liste.length ? vm.muhurler : null;
  const muhurKutulari = mv
    ? mv.liste.map((m) =>
        h(
          'span',
          { s: `f-kz-muhur${m.basili && !m.yeni ? ' f-once' : ''}`, role: 'img', 'aria-label': `${MK.kademe[m.kademe]} mührü${m.basili ? '' : ': yok'}${m.yeni ? `, ${MK.yeni}` : ''}` },
          muhurSvg(m.kademe, false),
          muhurSvg(m.kademe, true, 'f-kz-mum'),
          h('span', { s: 'f-kz-toz', 'aria-hidden': 'true' }),
          m.yeni ? h('span', { s: 'f-kz-yeni', t: MK.yeni }) : null,
        ),
      )
    : [];
  const sancakCip = mv?.sancak ? h('span', { s: 'f-kz-sancak', t: MK.sancak }) : null;
  const muhurSira = mv ? h('div', { s: 'f-kz-muhurler', 'aria-label': MK.muhurler }, muhurKutulari, sancakCip) : null;
  // Usta'nın Eli ile kazanç: boş halkalar açıklamasız kalmasın.
  const eliNotu = mv?.ustaEli ? h('small', { s: 'f-kz-muhur-not', t: MK.ustaEliMuhur }) : null;

  const icerik = h(
    'div',
    { s: 'f-kz' },
    h('div', { s: 'f-kz-bolum' }, h('span', { s: 'f-etiket', t: bolumBasligi(vm.bolumId, vm.tur) }), h('span', { s: 'f-kz-ad', t: vm.bolumAdi })),
    yildizSira,
    muhurSira,
    eliNotu,
    h('div', { s: 'f-kz-orta' }, puan, rekor),
  );
  // Öğretim balonu (§15 Bölüm 5: "Yıldızlar puanından gelir.") yıldızların hemen altında:
  // düğmelerin arkasında kalmasın, anlattığı şeyin yanında dursun. Mühür tanıtımı da burada (§C.5).
  const ipucu = [vm.ipucu, mv?.tanitim ? MK.muhurTanitim : null].filter(Boolean).join(' ');
  if (ipucu) icerik.appendChild(ustaIpucu(ipucu));

  // ── Ödüller: sandık + tablo
  const oduller = h('div', { s: 'f-kz-oduller' });
  if (vm.sandiklar.length > 0) oduller.appendChild(sandikKutusu(b, vm.sandiklar));
  let tabloKarari: boolean | null = null;
  if (vm.tablo) {
    const tb = vm.tablo;
    const kutu = h('div', { s: 'f-kz-tablo' }, tabloCercevesi(tb.nadirlik, ek.tablo ?? null));
    if (tb.eskiVar) {
      const varsayilan = !tb.eskiNadirlik || nadirlikSirasi(tb.nadirlik) >= nadirlikSirasi(tb.eskiNadirlik);
      tabloKarari = varsayilan;
      const sakla = h('button', { type: 'button', role: 'radio', t: M.sakla });
      const koru = h('button', { type: 'button', role: 'radio', t: M.eskisiniKoru });
      const boya = () => {
        sakla.setAttribute('aria-checked', String(tabloKarari === true));
        koru.setAttribute('aria-checked', String(tabloKarari === false));
      };
      sakla.addEventListener('click', () => {
        tabloKarari = true;
        boya();
      });
      koru.addEventListener('click', () => {
        tabloKarari = false;
        boya();
      });
      boya();
      kutu.appendChild(h('div', { s: 'f-parcali f-kz-tablo-sec', role: 'radiogroup', 'aria-label': M.tabloEtiketi }, sakla, koru));
      if (tb.eskiNadirlik) kutu.appendChild(h('small', { s: 'f-kz-eski', t: `Eski: ${NADIRLIK_ADLARI[tb.eskiNadirlik]}` }));
    }
    oduller.appendChild(kutu);
  }
  let odullerEl: HTMLElement | null = null;
  if (oduller.childElementCount > 0) {
    oduller.classList.add(`f-n${oduller.childElementCount}`);
    icerik.appendChild(oduller);
    odullerEl = oduller;
  }

  // "Sıradaki: X!" duyurulardan önce: bir bölüm daha hissi düğmelerin üstünde görünsün.
  if (vm.sonrakiTanitim) {
    icerik.appendChild(
      h('div', { s: 'f-kz-sonraki' }, vm.sonrakiOge ? yeniOgeOnizleme(vm.sonrakiOge, b.palet) : null, h('span', { t: vm.sonrakiTanitim })),
    );
  }
  // ── Kazanç şeridi: ilk çip her zaman kandil (§C.5; "+N daha"ya gömülmez).
  const kv = vm.kandil && vm.kandil.yeni !== vm.kandil.onceki ? vm.kandil : null;
  let kandilCip: HTMLElement | null = null;
  let kandilSayi: HTMLElement | null = null;
  if (kv) {
    kandilSayi = h('span', { s: 'f-sayi', t: String(kv.onceki) });
    kandilCip = h(
      'li',
      { s: 'f-kz-duyuru f-kz-kandil', 'aria-label': `${MK.kandilArti(kv.yeni - kv.onceki)}: ${kv.yeni}` },
      kandilSvg(),
      kandilSayi,
      h('span', { s: 'f-kz-kandil-not', t: kv.tanitim ? MK.kandilTanitim : MK.kandilArti(kv.yeni - kv.onceki) }),
    );
  }
  // Şerit sırası (§C.5): kandil → mühür parçası (öncelikli; sınırdan muaf) → "iş hazır" → diğerleri.
  const tum = (vm.duyurular ?? []).map((d) => ({ ...d, hazir: false }));
  const oncelikli = tum.filter((d) => d.oncelikli);
  const duyurular = [...(vm.kasabaHazir ? [{ ikon: 'harita', metin: MK.isHazir, hazir: true }] : []), ...tum.filter((d) => !d.oncelikli)];
  if (duyurular.length || oncelikli.length || kandilCip) {
    // Çok duyuru kartı taşırır (küçük ekranda düğmelerin altında kalır): ilk birkaçı, gerisi "+N" çipinde.
    const sinir = window.innerHeight <= 700 || window.innerWidth > window.innerHeight ? 1 : 3;
    const liste = duyurular;
    const cip = (d: { ikon: string; metin: string; hazir: boolean }) =>
      h('li', { s: `f-kz-duyuru${d.hazir ? ' f-kz-hazir' : ''}` }, d.hazir ? kandilSvg() : ikon(d.ikon as IkonAdi), h('span', { t: d.metin }));
    const ogeler = liste.map(cip);
    // Öncelikliler sınırdan muaf ama yer kaplar: kalan sınır onlardan sonra (kısa ekranda taşmasın).
    const kalan = Math.max(0, sinir - oncelikli.length);
    const sigar = liste.length <= kalan + 1;
    const ul = h('ul', { s: 'f-kz-duyurular', 'aria-label': 'Kazanılanlar' }, kandilCip, oncelikli.map(cip), sigar ? ogeler : ogeler.slice(0, kalan));
    if (!sigar) {
      const fazla = ogeler.slice(kalan);
      const dg = h('button', { s: 'f-kz-duyuru f-kz-daha', type: 'button', 'aria-label': `${fazla.length} kazanım daha` }, h('span', { t: `+${fazla.length} daha` }));
      const li = h('li', { s: 'f-kz-daha-li' }, dg);
      dg.addEventListener('click', () => {
        li.replaceWith(...fazla);
      });
      ul.appendChild(li);
    }
    // (Kancalar §C.5) Kandil varsa kazanç şeridi puanın hemen altında, sandık/tablodan önce:
    // kısa ekranda düğmelerin arkasında kalmasın.
    if (kandilCip) icerik.insertBefore(ul, odullerEl ?? icerik.querySelector('.f-kz-sonraki'));
    else icerik.appendChild(ul);
  }
  if (mv || kv) icerik.classList.add('f-kancali');

  const bitir = (s: 'devam' | 'tekrar') => {
    if (!sec(s)) return;
    zamanlayicilar.forEach(clearTimeout);
    sayimIptal?.();
    kandilIptal?.();
    ucusIptal.abort();
    if (vm.tablo?.eskiVar && tabloKarari !== null) b.geri.tabloKarari?.(vm.bolumId, tabloKarari);
    t.kapat();
  };
  icerik.appendChild(
    h(
      'div',
      { s: 'f-dg-sira f-kz-dugmeler f-yapiskan-alt' },
      dugme(M.tekrarOyna, 'ikincil', () => bitir('tekrar'), { ikon: 'tekrar' }),
      dugme(M.devam, 'birincil', () => bitir('devam'), { buyuk: true, odak: true }),
    ),
  );

  const baslik = M.kazandinBaslik[Math.max(0, Math.min(3, vm.yildiz))];
  const t = b.modalAc({
    icerik,
    serit: baslik,
    seritTur: 'altin',
    genislik: 'genis',
    onIptal: () => bitir('devam'),
    sinif: 'f-kazandin',
    ses: 'kazandin',
  });
  const isinlar = h('div', { s: 'f-isinlar', 'aria-hidden': 'true' });
  t.modal.insertBefore(isinlar, t.kart);

  // ── Zaman çizelgesi
  for (let i = 0; i < vm.yildiz; i++) {
    sonra(YILDIZ_ILK + i * YILDIZ_ARA, () => {
      yildizlar[i].classList.add('f-muhur');
      b.ses((['yildiz1', 'yildiz2', 'yildiz3'] as const)[i]);
      b.titret(i === 2 ? [25, 30, 40] : 20);
    });
  }
  const yildizSonu = YILDIZ_ILK + Math.max(0, vm.yildiz - 1) * YILDIZ_ARA + 260;
  sonra(380, () => {
    sayimIptal = say(puanSayi, 0, vm.puan, az ? 0 : 1100, sayi);
  });
  if (vm.yeniRekor) {
    sonra(Math.max(yildizSonu, 1500) + 120, () => {
      rekor.classList.add('f-goster');
      b.ses('parca');
      b.duyur(M.yeniRekor);
    });
  }
  // Mühürler: önceden basılılar baştan sönük; yeniler yıldız sonu + 200 ms'de, 250 ms arayla.
  let muhurSonu = yildizSonu;
  if (mv) {
    let n = 0;
    mv.liste.forEach((m, i) => {
      if (!m.yeni) return;
      const t = yildizSonu + MUHUR_GECIKME + n * MUHUR_ARA;
      n++;
      muhurSonu = t + 250;
      sonra(t, () => {
        muhurKutulari[i].classList.add('f-bas');
        b.ses('muhur');
        b.titret(20);
        b.duyur(`${MK.kademe[m.kademe]} mührü`);
      });
    });
    if (sancakCip) sonra(muhurSonu + 120, () => sancakCip.classList.add('f-goster'));
  }
  const gosterT = Math.max(muhurSonu, 1500) + 260;
  sonra(gosterT, () => icerik.classList.add('f-sonraki-goster'));
  // Kandil: yeni yıldız ve mühür başına bir kandil çipe uçar; sayaç önceki → yeni.
  if (kv && kandilCip && kandilSayi) {
    const cip = kandilCip;
    const sy = kandilSayi;
    sonra(gosterT + 380, () => {
      if (!cip.isConnected) return;
      const kok = b.kok;
      const kaynaklar: { x: number; y: number }[] = [];
      const yildizKandil = Math.max(0, Math.min(kv.yildiz ?? 0, 3));
      for (let i = vm.yildiz - yildizKandil; i < vm.yildiz; i++) if (yildizlar[i]) kaynaklar.push(merkez(yildizlar[i], kok));
      if (mv) mv.liste.forEach((m, i) => m.yeni && kaynaklar.length < 8 && kaynaklar.push(merkez(muhurKutulari[i], kok)));
      const hedef = merkez(cip.querySelector('.f-kandil-svg') ?? cip, kok);
      let sayac = kv.onceki;
      void kandilUcur(
        b,
        kaynaklar,
        hedef,
        () => {
          sayac = Math.min(kv.yeni, sayac + 1);
          sy.textContent = String(sayac);
          cip.classList.remove('f-zipla');
          void cip.offsetWidth;
          cip.classList.add('f-zipla');
          b.ses('dugme');
        },
        90,
        false,
        ucusIptal.signal,
      ).then(() => {
        if (ucusIptal.signal.aborted) return;
        kandilIptal = say(sy, sayac, kv.yeni, az ? 0 : 500, (x) => String(Math.round(x)));
      });
    });
  }
  return { soz, kapat: () => bitir('devam') };
}

/** Sandık: dokun-aç, birden çok sandıkta sırayla (§10.4). */
function sandikKutusu(b: Baglam, sandiklar: SandikVM[]): HTMLElement {
  let sira = 0;
  let durum: 'kapali' | 'aciliyor' | 'acik' = 'kapali';
  const resimYeri = h('span', { s: 'f-sandik-resim' }, sandikSvg(sandiklar[0].tur, false));
  const etiket = h('span', { s: 'f-sandik-etiket', t: M.sandikAc });
  const sayac = h('span', { s: 'f-sandik-sayac f-sayi' });
  const liste = h('div', { s: 'f-sandik-oduller', 'aria-live': 'polite' });
  const dg = h(
    'button',
    { s: `f-sandik f-tur-${sandiklar[0].tur}`, type: 'button', 'aria-label': M.sandikAc },
    h('span', { s: 'f-sandik-isin', 'aria-hidden': 'true' }),
    resimYeri,
    etiket,
    sayac,
  );
  const sayacYaz = () => {
    sayac.textContent = sandiklar.length > 1 ? `${sira + 1}/${sandiklar.length}` : '';
  };
  sayacYaz();
  dg.addEventListener('click', async () => {
    if (durum === 'aciliyor') return;
    if (durum === 'acik') {
      if (sira + 1 >= sandiklar.length) return;
      sira++;
      liste.textContent = '';
      dg.className = `f-sandik f-tur-${sandiklar[sira].tur}`;
      resimYeri.replaceChildren(sandikSvg(sandiklar[sira].tur, false));
      sayacYaz();
    }
    durum = 'aciliyor';
    const s = sandiklar[sira];
    dg.classList.add('f-sallan');
    etiket.textContent = '';
    await bekle(b.az() ? 0 : 300);
    dg.classList.remove('f-sallan');
    dg.classList.add('f-acik');
    resimYeri.replaceChildren(sandikSvg(s.tur, true));
    b.ses('sandik');
    b.titret([20, 40, 30]);
    s.oduller.forEach((o, i) => {
      liste.appendChild(odulOgesi(o, 160 + i * 150));
      if (o.tur === 'desenParcasi' || o.tur === 'fitilParcasi') setTimeout(() => b.ses('parca'), b.az() ? 0 : 200 + i * 150);
    });
    durum = 'acik';
    if (sira + 1 < sandiklar.length) {
      etiket.textContent = M.sonrakiSandik;
      dg.setAttribute('aria-label', M.sonrakiSandik);
    } else {
      dg.setAttribute('aria-disabled', 'true');
    }
  });
  return h('div', { s: 'f-kz-sandik-kutu' }, dg, liste);
}
