import { idleEngine, pct } from './helpers';
import type { Lesson } from './types';

const K = 273.15;

export const brayton: Lesson = {
  id: 'brayton',
  title: 'Motorun içinde: Brayton çevrimi',
  summary: 'Sıkıştırma, yanma, genişleme. Gücü artırırken sıcaklık ve basıncın motor boyunca nasıl değiştiğini canlı T–s diyagramında izle.',
  minutes: 7,
  level: 'Orta',
  setup: idleEngine,
  steps: [
    {
      title: 'Dört süreç, bir çevrim',
      body: `<p>Her gaz türbini <b>Brayton çevrimi</b> ile çalışır:</p>
<ul>
<li><b>Sıkıştırma (2 → 3):</b> fan ve kompresörler iş harcayarak basıncı ve sıcaklığı artırır</li>
<li><b>Isı ekleme (3 → 4):</b> yanma odasında, neredeyse sabit basınçta</li>
<li><b>Genişleme (4 → 5):</b> türbinler gazdan iş çeker — kompresörleri ve fanı döndürecek kadar</li>
<li><b>Atım (5 → 9):</b> lüle, kalan enerjiyle gazı hızlandırır: itki</li>
</ul>
<p>Sağdaki paneli aç: üstte motorun şeması <b>sıcaklığa göre</b> renkleniyor, altında <b>T–s diyagramı</b> var. Mavi çizgi sıkıştırmayı, turuncu yanmayı, sarı genişlemeyi gösterir. Kesikli eğriler sabit basınç hatlarıdır (P0 dış hava, P3 kompresör çıkışı).</p>
<div class="callout">Şemadaki bir bölgenin üzerine gelirsen 3B motorda o parça yanar.</div>`,
      ui: { view: 'cutawayCore', cutaway: true, diagram: true, cockpit: true, switches: [] },
    },
    {
      title: 'Gücü artır, basıncı izle',
      body: `<p>Gaz kolunu ileri it (sürükle, ya da <kbd>W</kbd>/<kbd>↑</kbd>). Motor yavaş yavaş hızlanacak.</p>
<p>İzle:</p>
<ul>
<li>İstasyon <b>3</b>'ün basıncı (HPC çıkışı) — rölantide birkaç bar, yüksek güçte 40 barın üstü</li>
<li><b>OPR</b> — toplam basınç oranı</li>
<li>T–s diyagramındaki döngünün <b>büyümesi</b></li>
</ul>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      objectives: [
        {
          text: (c) => `N1'i %60'ın üstüne çıkar (şu an ${pct(c.snap.N1)})`,
          check: (c) => c.snap.N1 >= 0.6,
          hold: 2,
        },
      ],
      done: (c) =>
        `OPR şimdi <b>${c.snap.cycle.opr.toFixed(1)}</b>; kompresör çıkışında hava <b>${(c.snap.cycle.stations['3'].T - K).toFixed(0)} °C</b>.`,
    },
    {
      title: 'Soru: sıkıştırılan hava neden ısınır?',
      body: `<p>İstasyon 3'teki havaya bak: yanma odasına girmeden, sadece sıkıştırılarak yüzlerce derece ısındı.</p>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      quiz: {
        question: 'Kompresör çıkışında hava neden bu kadar sıcak?',
        options: [
          'Yanma odasından geriye ısı iletilir',
          'Kompresörün harcadığı iş havanın iç enerjisine dönüşür; sıkıştırma sıcaklığı yükseltir',
          'Sürtünme yüzünden kanatlar ısınır, havayı onlar ısıtır',
          'Dış hava zaten sıcaktır',
        ],
        answer: 1,
        explain:
          'Bisiklet pompasının ucunun ısınması gibi: gaza yapılan sıkıştırma işi sıcaklığı artırır. İdeal (izentropik) durumda T3/T2 = (P3/P2)^0.286. Gerçek kompresör kayıplı olduğu için biraz daha fazla ısınır — T–s diyagramında 2→3 çizgisinin hafifçe sağa yatması bu kayıptır.',
      },
    },
    {
      title: 'Kalkış gücü: en sıcak nokta',
      body: `<p>Şimdi gaz kolunu sonuna kadar (<b>TO</b>) it.</p>
<p>Türbin girişindeki gaz (istasyon <b>4</b>) motorun en sıcak noktasıdır. Bu sıcaklığı yükseltmek motoru hem güçlü hem verimli yapar; ama türbin kanatlarının dayanabileceği sınır bellidir. Kokpitteki <b>EGT</b>, doğrudan ölçülemeyen T4'ün güvenilir bir göstergesidir.</p>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      objectives: [
        {
          text: (c) => `Kalkış gücü: N1 ≥ %95 (şu an ${pct(c.snap.N1)})`,
          check: (c) => c.snap.N1 >= 0.95,
          hold: 3,
        },
      ],
      done: (c) =>
        `T4 = <b>${(c.snap.cycle.stations['4'].T - K).toFixed(0)} °C</b>, EGT = <b>${c.snap.egt.toFixed(0)} °C</b>, itki <b>${(c.snap.thrust / 1000).toFixed(0)} kN</b>. Motor saniyede <b>${c.snap.wf.toFixed(2)} kg</b> yakıt yakıyor.`,
    },
    {
      title: 'Soru: basınç oranı',
      body: `<p>Sağ paneldeki "Toplam basınç oranı (OPR)" satırına bak.</p>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      quiz: {
        question: 'Kalkış gücünde bu motorun toplam basınç oranı yaklaşık kaçtır?',
        options: ['5', '15', '45', '150'],
        answer: 2,
        explain:
          'Fan (~1.5) × booster (~1.9) × HPC (~16.5) ≈ 46. Yüksek OPR daha yüksek ısıl verim demektir; 1960\'ların turbojetlerinde bu değer 10–15 civarındaydı.',
      },
    },
    {
      title: 'Soru: itkiyi kim üretiyor?',
      body: `<p>Paneldeki "İtki: fan / çekirdek" satırına ve iki jet hızına bak (V9 çekirdek, V19 fan).</p>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      quiz: {
        question: 'Kalkışta itkinin büyük kısmını hangisi üretir?',
        options: [
          'Sıcak çekirdek jeti — çünkü çok daha hızlı',
          'Fan (baypas) akışı — çünkü çok daha fazla hava hızlandırıyor',
          'İkisi tam yarı yarıya',
          'Egzoz konisi',
        ],
        answer: 1,
        explain:
          'Çekirdek jeti daha hızlıdır ama fan ~9 kat fazla hava taşır. İtki ≈ akış × hız farkı olduğundan fan payı %85–90 civarındadır.',
      },
    },
    {
      title: 'Verimin sırrı',
      body: `<p>Neden bu kadar büyük bir fan? <b>İtki verimi</b> (propulsive efficiency) yaklaşık:</p>
<div class="callout">η<sub>itki</sub> ≈ 2 / (1 + V<sub>jet</sub>/V<sub>uçuş</sub>)</div>
<p>Jet hızı uçuş hızına ne kadar yakınsa, havaya bırakılan "boşa" kinetik enerji o kadar az olur. Aynı itkiyi daha yavaş ama çok daha büyük bir hava kütlesiyle üretmek yakıt tasarrufu demektir. Baypas oranı bu yüzden onlarca yıldır artıyor: 1970'lerde ~5, bugün 9–12.</p>
<p>Gücü rölantiye geri çek ve dersi bitir.</p>`,
      ui: { diagram: true, cockpit: true, switches: [] },
      objectives: [{ text: (c) => `Rölantiye dön: N1 < %30 (şu an ${pct(c.snap.N1)})`, check: (c) => c.snap.N1 < 0.3 }],
    },
  ],
};
