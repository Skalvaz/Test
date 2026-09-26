import { runningAt, pct } from './helpers';
import type { Lesson } from './types';

export const birdStrike: Lesson = {
  id: 'birdstrike',
  title: 'Arıza senaryosu: kuş çarpması',
  summary: 'Kalkış gücündeyken motor bir kuş yutuyor. Belirtileri tanı ve motoru güvenle kapat.',
  minutes: 5,
  level: 'İleri',
  setup: (sim) => runningAt(sim, 1),
  steps: [
    {
      title: 'Brifing',
      body: `<p>Motor kalkış gücünde. Birkaç saniye içinde fan bir kuş yutacak.</p>
<p>Kuş çarpması fan kanatlarını büker ya da çentikler. Belirtiler:</p>
<ul>
<li><b>Yüksek titreşim</b> (EICAS'ta TİTR)</li>
<li>Kompresöre bozuk akış girer: <b>surge</b> olabilir</li>
<li>EGT artışı, itki kaybı</li>
</ul>
<p>Bu derste basitleştirilmiş bir prosedür uygulayacaksın: önce <b>gücü azalt</b>, belirtiler sürüyorsa <b>motoru kapat</b>.</p>
<div class="callout warn">Gerçek uçuşta bu kararlar üretici ve havayolunun kontrol listelerine (QRH) göre, uçağın durumu değerlendirilerek verilir. Buradaki sıra yalnızca eğitim amaçlıdır.</div>`,
      enter: (sim) => runningAt(sim, 1),
      ui: { view: 'inlet', cockpit: true, diagram: false, switches: ['fuelRun'] },
    },
    {
      title: 'Kuş çarpması!',
      body: `<p>Belirtileri gözle: titreşim, olası surge, EGT.</p>
<p>İlk hamle: <b>gaz kolunu IDLE'a çek</b>. Hasarlı bir fanı yüksek devirde çevirmek titreşimi ve hasarı büyütür.</p>`,
      enter: (sim) => runningAt(sim, 1),
      ui: { view: 'front', cockpit: true, switches: ['fuelRun'] },
      tick(c) {
        if (!c.memo.struck && c.t > 2) {
          c.memo.struck = true;
          c.sim.birdStrike();
        }
      },
      objectives: [
        { text: 'Kuş çarpmasını bekle', check: (c) => c.had('birdStrike') },
        { text: (c) => `Gaz kolu IDLE (titreşim ${c.snap.vibration.toFixed(1)})`, check: (c) => c.snap.controls.throttle < 0.05 },
        { text: (c) => `Motor yavaşlasın: N1 < %35 (şu an ${pct(c.snap.N1)})`, check: (c) => c.snap.N1 < 0.35 },
      ],
      done: (c) =>
        `Titreşim rölantide bile <b>${c.snap.vibration.toFixed(1)}</b> — normali 0.5'in altında. Fan ciddi hasarlı.`,
    },
    {
      title: 'Motoru kapat',
      body: `<p>Rölantide titreşim hâlâ yüksek: fan ciddi hasarlı. Motoru kapat: <b>YAKIT KONTROL → CUTOFF</b>.</p>
<p>Yakıt kesilince yanma durur, miller yavaşlar. Uçak diğer motorla devam eder.</p>`,
      ui: { cockpit: true, switches: ['fuelRun'], flash: (c) => (c.snap.controls.fuelRun ? ['fuelRun'] : null), throttleLocked: true },
      objectives: [
        { text: 'YAKIT KONTROL → CUTOFF', check: (c) => !c.snap.controls.fuelRun },
        { text: (c) => `Motor dursun: N2 < %20 (şu an ${pct(c.snap.N2)})`, check: (c) => c.snap.N2 < 0.2 },
      ],
    },
    {
      title: 'Soru',
      body: `<p>Neden önce gücü azalttık, hemen motoru kapatmadık?</p>`,
      ui: { cockpit: true, switches: ['fuelRun'], throttleLocked: true },
      quiz: {
        question: 'Kuş çarpmasından hemen sonra neden önce güç azaltılır?',
        options: [
          'Yakıt tasarrufu için',
          'Titreşimi ve hasarın büyümesini azaltmak, surge\'ü durdurmak ve motorun hâlâ kısmi itki verip veremeyeceğini değerlendirmek için',
          'Motor kendi kendine kapansın diye',
          'Kuşun dışarı atılması için',
        ],
        answer: 1,
        explain:
          'Hasarlı bir motor düşük güçte hâlâ işe yarar itki verebilir; kalkıştan hemen sonra bu çok değerlidir. Karar, belirtilerin şiddetine ve kontrol listesine göre verilir. Ciddi titreşim, yangın ya da sürekli surge varsa motor kapatılır.',
      },
    },
    {
      title: 'Senaryo tamam',
      body: `<p>Bir motor arızasını tanıdın ve güvenle yönettin.</p>
<p>Modern turbofan fanları, belirli büyüklükteki kuşları yutup çalışmaya devam edebilecek şekilde test edilir (sertifikasyonda gerçek kuş ağırlığında cisimlerle atış testleri yapılır). Fan muhafazası da kopan bir kanadın motor dışına çıkmasını engellemek zorundadır.</p>`,
      ui: { cockpit: true, switches: ['fuelRun'] },
    },
  ],
};
