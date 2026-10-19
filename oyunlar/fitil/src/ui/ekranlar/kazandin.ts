/**
 * Kazandın (§14.6, §12.2; sadeleştirme Ekim 2026): kurdele başlık, tek satır
 * "Bölüm N · Ad", yıldızlar 300 ms arayla mühürlenir, mühürler, puan sayılarak
 * artar (+ küçük "Rekor" etiketi). Altında en çok iki haber satırı (açılan
 * güçlendirici, mahalle, mühür parçası…) ve tek sıra ödül kutusu (kandil,
 * güçlendirici, sandık, tablo). Rozet, görev, coşku, "iş hazır" ve "Sıradaki"
 * burada gösterilmez (harita, defter ve bölüm kartında görünürler): büyük
 * bulmaca oyunlarındaki gibi ekran yıldız + puan + Devam'a odaklanır.
 * Düğmeler: yuvarlak [Tekrar] ve büyük [Devam].
 */
import { h, say, bekle } from '../dom';
import { yildizSvg, sandikSvg, ikon, muhurSvg, kandilSvg, type IkonAdi } from '../ikonlar';
import { M, MK, bolumBasligi, sayi } from '../metinler';
import { kandilUcur, merkez } from '../kanca';
import { dugme, secimSozu, type Baglam } from '../cekirdek';
import { odulOgesi, ustaIpucu, nadirlikSirasi } from './ortak';
import type { KazandinVM, SandikVM } from '../tipler';

const YILDIZ_ILK = 520;
const YILDIZ_ARA = 300;
/** (Kancalar §C.5) Yeni mühürler yıldız sonu + 200 ms'de, 250 ms arayla damgalanır. */
const MUHUR_GECIKME = 200;
const MUHUR_ARA = 250;

export function kazandinEkrani(
  b: Baglam,
  vm: KazandinVM,
  _ek: { tablo?: HTMLCanvasElement | null } = {},
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
  const puan = h('div', { s: 'f-kz-puan', 'aria-label': M.puan }, puanSayi);

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
    h('div', { s: 'f-kz-bolum', t: `${bolumBasligi(vm.bolumId, vm.tur)} · ${vm.bolumAdi}` }),
    yildizSira,
    muhurSira,
    eliNotu,
    h('div', { s: 'f-kz-orta' }, puan, rekor),
  );
  // Öğretim balonu (§15 Bölüm 5: "Yıldızlar puanından gelir.") yıldızların hemen altında:
  // düğmelerin arkasında kalmasın, anlattığı şeyin yanında dursun. Mühür tanıtımı da burada (§C.5).
  const ipucu = vm.ipucu;
  if (ipucu) icerik.appendChild(ustaIpucu(ipucu));

  // ── Haberler: en önemli en çok iki açılış (sıra odulDuyurulari'nin önem sırası).
  const HABER = new Set(['mahalleTamam', 'muhurParcasi', 'guclendiriciAcildi', 'gunlukAcildi', 'sonsuzAcildi', 'ustaAcildi', 'fitil', 'efsane']);
  const haberler = (vm.duyurular ?? []).filter((d) => d.oncelikli || HABER.has(d.tur ?? '')).slice(0, 2);
  if (haberler.length) {
    icerik.appendChild(
      h('ul', { s: 'f-kz-haberler', 'aria-label': 'Haberler' }, haberler.map((d) => h('li', { s: 'f-kz-haber' }, ikon(d.ikon as IkonAdi), h('span', { t: d.metin })))),
    );
  }

  // ── Ödül kutuları: kandil → güçlendirici → sandık → tablo (tek sıra).
  const kutular = h('ul', { s: 'f-kz-kutular', 'aria-label': 'Kazanılanlar' });
  const kv = vm.kandil && vm.kandil.yeni !== vm.kandil.onceki ? vm.kandil : null;
  let kandilKutu: HTMLElement | null = null;
  let kandilSayi: HTMLElement | null = null;
  if (kv) {
    kandilSayi = h('span', { s: 'f-kz-kutu-sayi f-sayi', t: '+0' });
    kandilKutu = h('li', { s: 'f-kz-kutu f-kz-kandil', 'aria-label': `${MK.kandilArti(kv.yeni - kv.onceki)}: ${kv.yeni}` }, kandilSvg(), kandilSayi, h('span', { s: 'f-kz-kutu-ad', t: 'kandil' }));
    kutular.appendChild(kandilKutu);
  }
  for (const d of vm.duyurular ?? []) {
    if (d.tur !== 'guclendirici') continue;
    const [sayiKismi, ...ad] = d.metin.split(' ');
    kutular.appendChild(h('li', { s: 'f-kz-kutu', 'aria-label': d.metin }, ikon(d.ikon as IkonAdi), h('span', { s: 'f-kz-kutu-sayi f-sayi', t: sayiKismi }), h('span', { s: 'f-kz-kutu-ad', t: ad.join(' ').toLocaleLowerCase('tr') })));
  }
  if (vm.sandiklar.length > 0) kutular.appendChild(h('li', { s: 'f-kz-kutu f-kz-kutu-sandik' }, sandikKutusu(b, vm.sandiklar)));
  // Tablo kutusu yok (Defter'de görünür): eski tablo varsa daha nadir olan saklanır.
  const tabloKarari: boolean | null = vm.tablo?.eskiVar ? !vm.tablo.eskiNadirlik || nadirlikSirasi(vm.tablo.nadirlik) >= nadirlikSirasi(vm.tablo.eskiNadirlik) : null;
  if (kutular.childElementCount) icerik.appendChild(kutular);
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
      dugme('', 'ikincil', () => bitir('tekrar'), { ikon: 'tekrar', etiket: M.tekrarOyna, sinif: 'f-kz-tekrar' }),
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
  // Kandil: yeni yıldız ve mühür başına bir kandil kutuya uçar; sayaç +0 → +N.
  if (kv && kandilKutu && kandilSayi) {
    const kutu = kandilKutu;
    const sy = kandilSayi;
    const artis = kv.yeni - kv.onceki;
    sonra(gosterT + 380, () => {
      if (!kutu.isConnected) return;
      const kok = b.kok;
      const kaynaklar: { x: number; y: number }[] = [];
      const yildizKandil = Math.max(0, Math.min(kv.yildiz ?? 0, 3));
      for (let i = vm.yildiz - yildizKandil; i < vm.yildiz; i++) if (yildizlar[i]) kaynaklar.push(merkez(yildizlar[i], kok));
      if (mv) mv.liste.forEach((m, i) => m.yeni && kaynaklar.length < 8 && kaynaklar.push(merkez(muhurKutulari[i], kok)));
      const hedef = merkez(kutu.querySelector('.f-kandil-svg') ?? kutu, kok);
      let sayac = 0;
      void kandilUcur(
        b,
        kaynaklar,
        hedef,
        () => {
          sayac = Math.min(artis, sayac + 1);
          sy.textContent = `+${sayac}`;
          kutu.classList.remove('f-zipla');
          void kutu.offsetWidth;
          kutu.classList.add('f-zipla');
          b.ses('dugme');
        },
        90,
        false,
        ucusIptal.signal,
      ).then(() => {
        if (ucusIptal.signal.aborted) return;
        kandilIptal = say(sy, sayac, artis, az ? 0 : 500, (x) => `+${Math.round(x)}`);
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
