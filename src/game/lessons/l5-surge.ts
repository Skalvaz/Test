import { idleEngine, pct } from './helpers';
import type { EngineSim } from '../../sim';
import type { Lesson } from './types';

function manualAtIdle(sim: EngineSim) {
  idleEngine(sim);
  sim.controls.fadec = 'manual';
  sim.controls.manualFuel = sim.wf / (sim.eng.ref.Wf * 1.15);
}

export const surge: Lesson = {
  id: 'surge',
  title: 'Kompresör stall\'u ve surge',
  summary: 'FADEC korumasını kapat, yakıtı elle kontrol et ve bir surge\'ü bizzat yaşa. Çalışma noktası neden surge hattına kayar?',
  minutes: 8,
  level: 'İleri',
  setup: idleEngine,
  steps: [
    {
      title: 'Kompresör haritası ve surge hattı',
      body: `<p>Bir kompresörün her devirde basabileceği bir <b>azami basınç oranı</b> vardır. Bunun ötesinde kanatlar üzerindeki akış ayrılır (stall) ve hava, arkadaki yüksek basınca karşı itilemez hale gelir. Akış kısa süreliğine <b>tersine döner</b>: buna <b>surge</b> denir.</p>
<p>Belirtileri:</p>
<ul>
<li>Tabanca sesi gibi bir patlama, giriş ve egzozdan alev</li>
<li>EGT sıçraması, itki kaybı, titreşim</li>
</ul>
<p>Motorun çalışma noktasıyla surge hattı arasındaki mesafeye <b>surge payı (SM)</b> denir. EICAS'ta ve sağ panelde görebilirsin.</p>`,
      ui: { view: 'front', cockpit: true, diagram: true, switches: [] },
    },
    {
      title: 'FADEC\'i devre dışı bırak',
      body: `<p>Bu derste yakıtı <b>doğrudan</b> sen kontrol edeceksin: FADEC anahtarını <b>MANUEL</b>'e al. Çalıştırma panelinde bir <b>yakıt valfi</b> kaydırıcısı belirecek.</p>
<div class="callout warn">Manuel modda hiçbir koruma yok: surge, aşırı sıcaklık ve alev sönmesi tamamen senin elinde.</div>`,
      enter: idleEngine,
      ui: { cockpit: true, diagram: true, switches: ['fadec'], flash: ['fadec'], throttleLocked: true },
      objectives: [{ text: 'FADEC → MANUEL', check: (c) => c.snap.controls.fadec === 'manual' }],
      auto: true,
    },
    {
      title: 'Yavaş ve dikkatli',
      body: `<p>Yakıt valfini <b>yavaş yavaş</b> açarak N1'i %50'nin üstüne çıkar. Motorun her adımda yetişmesine izin ver.</p>
<p>Sağ paneldeki <b>surge payını</b> izle: yakıtı hızlı artırırsan pay hızla düşer.</p>`,
      enter: manualAtIdle,
      ui: { cockpit: true, diagram: true, switches: ['fadec'], throttleLocked: true },
      objectives: [
        {
          text: (c) => `Surge olmadan N1 ≥ %50 (şu an ${pct(c.snap.N1)}, SM ${(c.snap.cycle.surgeMargin * 100).toFixed(0)}%)`,
          check: (c) => c.snap.N1 >= 0.5,
          hold: 1,
        },
      ],
      fail: (c) => (c.had('surge') ? 'Surge oldu — yakıtı çok hızlı artırdın. Bu kez daha yavaş dene.' : null),
    },
    {
      title: 'Şimdi bilerek surge ettir',
      body: `<p>Motor rölantiye alındı. Kontrollü bir deney: yakıt valfini <b>bir anda sonuna kadar</b> aç ve olanları izle.</p>
<p>Rölantide yakıt akışı küçüktür; valfi birden açmak akışı ~15 katına çıkarır. Kompresör bu kadar hızlı yetişemez.</p>
<p>Sonra <b>yakıtı azaltarak</b> motoru stall'dan çıkar. Hızlı davran: surge sürerken EGT her saniye yükselir ve birkaç saniye içinde türbin hasar görür.</p>`,
      enter: manualAtIdle,
      ui: { view: 'side', cockpit: true, diagram: true, switches: ['fadec'], throttleLocked: true },
      tick(c) {
        if (c.snap.surging) c.memo.lastSurge = c.t;
      },
      objectives: [
        { text: 'Yakıt valfini sonuna kadar aç: surge', check: (c) => c.had('surge') },
        {
          text: 'Yakıtı azalt: 3 s boyunca surge olmasın ve EGT < 900 °C',
          check: (c) => !c.snap.surging && c.t - ((c.memo.lastSurge as number) ?? 0) > 0.5 && c.snap.egt < 900,
          hold: 3,
        },
      ],
      fail: (c) => (c.had('turbineDamage') ? 'Surge çok uzun sürdü ve türbin aşırı ısınarak hasar gördü.' : null),
    },
    {
      title: 'Neden EGT fırladı?',
      body: `<p>Surge sırasında EGT'nin nasıl davrandığını gördün.</p>`,
      ui: { cockpit: true, diagram: true, switches: ['fadec'], throttleLocked: true },
      quiz: {
        question: 'Surge sırasında EGT neden hızla yükselir?',
        options: [
          'Kompresör daha fazla hava basar',
          'Hava akışı çöker ama yakıt aynı hızla verilmeye devam eder; daha az havayla aynı yakıt çok daha sıcak yanar',
          'Termokupllar titreşimden bozulur',
          'Türbin durur, sürtünme ısıtır',
        ],
        answer: 1,
        explain:
          'Yanma odası sıcaklığı yakıt/hava oranıyla belirlenir. Akış yarıya inip yakıt aynı kalırsa sıcaklık ciddi biçimde artar. Pilotun ilk tepkisi bu yüzden gücü (yakıtı) azaltmaktır.',
      },
    },
    {
      title: 'FADEC seni korur',
      body: `<p>FADEC'i tekrar <b>NORMAL</b>'e al ve gaz kolunu bir anda <b>TO</b>'ya it. Bu kez surge olmayacak: FADEC yakıtı, kompresörün surge sınırına karşılık gelen yakıtın ~%82'si ile sınırlar.</p>
<p>Gerçek motorlarda bunlara ek olarak <b>değişken stator kanatları</b> (VSV) ve <b>tahliye valfleri</b> (bleed valves) düşük devirlerde surge payını artırır.</p>`,
      ui: { cockpit: true, diagram: true, switches: ['fadec'], flash: (c) => (c.snap.controls.fadec === 'manual' ? ['fadec'] : null) },
      enter(sim) {
        if (sim.controls.fadec === 'manual') sim.controls.manualFuel = Math.min(sim.controls.manualFuel, 0.2);
      },
      objectives: [
        { text: 'FADEC → NORMAL', check: (c) => c.snap.controls.fadec === 'normal' },
        { text: 'Gaz kolunu TO\'ya it', check: (c) => c.snap.controls.throttle > 0.95 },
        { text: (c) => `Surge olmadan N1 ≥ %95 (şu an ${pct(c.snap.N1)})`, check: (c) => c.snap.N1 >= 0.95 },
      ],
      fail: (c) => (c.snap.controls.fadec === 'normal' && c.had('surge') ? 'Beklenmedik surge. Adımı tekrarla.' : null),
    },
    {
      title: 'Özet',
      body: `<ul>
<li>Surge, kompresörün çalışma noktası <b>surge hattını</b> aştığında olur.</li>
<li>Ani yakıt artışı türbin önünde sıcaklığı yükseltir; türbin aynı akışı geçiremez ve kompresörü surge'e iter.</li>
<li>Kirlenmiş, aşınmış ya da hasarlı (örneğin kuş çarpmış) bir kompresörün surge hattı aşağı iner: aynı manevra bu kez FADEC altında bile stall'a yol açabilir.</li>
</ul>
<p>Test hücresinde "Kompresör aşınması" arızasını ekleyip gaz kolunu hızla iterek bunu deneyebilirsin.</p>`,
      ui: { cockpit: true, diagram: true, switches: ['fadec'] },
    },
  ],
};
