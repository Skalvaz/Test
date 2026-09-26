import { idleEngine, pct } from './helpers';
import type { Lesson } from './types';

export const fadec: Lesson = {
  id: 'fadec',
  title: 'Gaz kolu, FADEC ve spool gecikmesi',
  summary: 'Gaz kolu yakıtı değil, bir N1 hedefini komut eder. Motorun neden hemen tepki vermediğini ve FADEC\'in seni nelerden koruduğunu öğren.',
  minutes: 6,
  level: 'Orta',
  setup: idleEngine,
  steps: [
    {
      title: 'Gaz kolu aslında ne yapar?',
      body: `<p>Arabada gaz pedalı doğrudan yakıt verir. Modern jet motorunda ise gaz kolu <b>FADEC</b>'e (tam yetkili dijital motor kontrolü) bir istek gönderir: "şu kadar itki istiyorum".</p>
<p>FADEC bu isteği bir <b>N1 hedefine</b> çevirir. N1 kadranındaki <span style="color:var(--magenta)">magenta</span> çizgi bu hedeftir. Yakıtı FADEC, hedefe ulaşmak için saniyede yüzlerce kez hesaplayarak ayarlar.</p>
<p>Ama FADEC'in iki sınırı vardır:</p>
<ul>
<li><b>İvmelenme sınırı:</b> yakıt fazla hızlı artarsa kompresör <b>stall</b> olur</li>
<li><b>Yavaşlama sınırı:</b> yakıt fazla hızlı azalırsa <b>alev söner</b></li>
</ul>`,
      ui: { view: 'front', cockpit: true, diagram: false, switches: [] },
    },
    {
      title: 'Kalkış gücü: ne kadar sürüyor?',
      body: `<p>Gaz kolunu tek hamlede <b>TO</b>'ya it (<kbd>PgUp</kbd> ya da kolu en üste sürükle).</p>
<p>Magenta hedef hemen %100'e sıçrar ama ibre onu takip etmekte gecikir. Bu gecikme — <b>spool-up</b> — dönen parçaların ataletinden ve FADEC'in yakıtı güvenli hızda artırmasından kaynaklanır.</p>`,
      ui: { cockpit: true, switches: [] },
      tick(c) {
        if (c.memo.t0 === undefined && c.snap.controls.throttle > 0.9) c.memo.t0 = c.t;
        if (c.memo.t0 !== undefined && c.memo.t95 === undefined && c.snap.N1 >= 0.95) c.memo.t95 = c.t;
      },
      objectives: [
        { text: 'Gaz kolunu TO konumuna it', check: (c) => c.snap.controls.throttle > 0.9 },
        { text: (c) => `N1 %95'e ulaşsın (şu an ${pct(c.snap.N1)})`, check: (c) => c.memo.t95 !== undefined },
      ],
      done: (c) =>
        `Rölantiden %95 N1'e <b>${((c.memo.t95 as number) - (c.memo.t0 as number)).toFixed(1)} s</b>. Sertifikasyon kuralları (FAR/CS 33.73) rölantiden kalkış itkisinin %95'ine en fazla <b>5 saniyede</b> ulaşılmasını ister — pas geçme (go-around) sırasında hayati önemdedir.`,
    },
    {
      title: 'Rölantiye dön',
      body: `<p>Şimdi gaz kolunu <b>IDLE</b>'a çek (<kbd>PgDn</kbd>). Yavaşlamada da FADEC yakıtı birden kesmez: yanma odasında yakıt/hava oranı sönme sınırının altına inerse alev söner.</p>`,
      ui: { cockpit: true, switches: [] },
      objectives: [
        { text: 'Gaz kolu IDLE', check: (c) => c.snap.controls.throttle < 0.02 },
        { text: (c) => `N1 %30'un altına insin (şu an ${pct(c.snap.N1)})`, check: (c) => c.snap.N1 < 0.3 },
      ],
    },
    {
      title: 'Soru',
      body: `<p>FADEC'in ivmelenmede yakıtı neden kademeli artırdığını düşün.</p>`,
      ui: { cockpit: true, switches: [] },
      quiz: {
        question: 'Gaz kolu bir anda ileri itildiğinde FADEC yakıtı neden kademeli artırır?',
        options: [
          'Yakıt tasarrufu için',
          'Yakıt fazla hızlı artarsa türbin önünde sıcaklık ve basınç yükselir, kompresör çalışma noktası surge hattını aşar',
          'Yakıt pompası daha hızlı dönemez',
          'Pilot konforu için',
        ],
        answer: 1,
        explain:
          'Fazla yakıt → T4 yükselir → türbin aynı düzeltilmiş akışı geçiremez → kompresör daha yüksek basınç oranında, daha az akışla çalışmaya zorlanır → surge hattına yaklaşır. FADEC bu yüzden yakıtı surge sınırının altında bir "ivmelenme programı" ile artırır. Bunu Ders 5\'te bizzat deneyeceksin.',
      },
    },
    {
      title: 'Hassas kontrol',
      body: `<p>Şimdi motoru <b>tam %80 N1</b>'de tut. Gaz kolunu sürükleyebilir ya da <kbd>Shift</kbd> + <kbd>W</kbd>/<kbd>S</kbd> ile ince ayar yapabilirsin.</p>
<p>İpucu: hedefi (magenta çizgi) 80'e getir ve ibrenin oturmasını bekle. Gaz kolunu ileri geri oynatmak FADEC'in işini zorlaştırır.</p>`,
      ui: { cockpit: true, switches: [] },
      objectives: [
        {
          text: (c) => `N1 %78–82 aralığında 5 saniye (şu an ${(c.snap.N1 * 100).toFixed(1)}%)`,
          check: (c) => Math.abs(c.snap.N1 - 0.8) <= 0.02,
          hold: 5,
        },
      ],
    },
    {
      title: 'Özet',
      body: `<p>Öğrendiklerin:</p>
<ul>
<li>Gaz kolu bir <b>itki/N1 isteğidir</b>; yakıtı FADEC belirler.</li>
<li>Motor, dönen kütlesi nedeniyle <b>gecikmeli</b> tepki verir; büyük motorlarda rölantiden kalkışa ~5 s.</li>
<li>FADEC yakıtı <b>stall</b> ve <b>sönme</b> sınırları arasında tutar; aşırı devir ve EGT'ye karşı da sınırlar uygular.</li>
</ul>
<p>Rölantiye dönüp dersi bitirebilirsin.</p>`,
      ui: { cockpit: true, switches: [] },
    },
  ],
};
