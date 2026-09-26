import { runningAt } from './helpers';
import type { Lesson } from './types';

export const altitude: Lesson = {
  id: 'altitude',
  title: 'İrtifa, hız ve sıcak günler',
  summary: 'Motoru 11 km\'ye ve Mach 0.8\'e çıkar, sonra 45 °C\'lik bir güne götür. İtkinin neden değiştiğini sayılarla gör.',
  minutes: 7,
  level: 'Orta',
  setup: (sim) => runningAt(sim, 1),
  steps: [
    {
      title: 'Aynı motor, farklı hava',
      body: `<p>Motor şu an deniz seviyesinde, durağan halde, kalkış gücünde. EICAS'taki itkiyi not et.</p>
<p>İtki temelde <b>her saniye ne kadar hava kütlesi</b> hızlandırıldığına bağlıdır. Yükseldikçe hava seyrekleşir: 11 km'de yoğunluk deniz seviyesinin yaklaşık üçte biridir. Uçak hızlandıkça da motora giren hava zaten bir hızla gelir; itkiden bu momentum (<b>ram direnci</b>) düşülür.</p>
<p>Bu derste ders panelindeki kaydırıcılarla motoru "uçuracaksın". Koşullar gerçekçi hızda değişir.</p>`,
      ui: { view: 'side', cockpit: true, diagram: true, switches: [], flightControls: true },
      enter(sim) {
        runningAt(sim, 1);
      },
      tick(c) {
        if (c.memo.slsThrust === undefined && c.t > 0.5) c.memo.slsThrust = c.snap.thrust;
      },
    },
    {
      title: 'Seyir irtifasına çık',
      body: `<p>İrtifayı <b>10 700 m</b> (~35 000 ft) civarına, hızı <b>Mach 0.80</b>'e getir. Gaz kolu TO'da kalsın.</p>
<p>Tırmanırken izle: itki hızla düşer, ama <b>N1 neredeyse aynı kalır</b>. Dış hava soğuduğu için motorun <b>düzeltilmiş</b> devri artar; FADEC aşırı devre izin vermez.</p>`,
      ui: { cockpit: true, diagram: true, switches: [], flightControls: true },
      objectives: [
        {
          text: (c) => `İrtifa ≥ 10 000 m, Mach ≥ 0.78 (şu an ${Math.round(c.sim.flight.altitude)} m, M${c.sim.flight.mach.toFixed(2)})`,
          check: (c) => c.sim.flight.altitude >= 10000 && c.sim.flight.mach >= 0.78,
        },
        { text: 'Gaz kolu TO', check: (c) => c.snap.controls.throttle > 0.95 },
        { text: 'Motor dengelensin', check: (c) => Math.abs(c.snap.N1 - (c.memo.prevN1 as number ?? 0)) < 0.002, hold: 3 },
      ],
      tick(c) {
        c.memo.prevN1Store = c.memo.prevN1Store ?? c.snap.N1;
        if (c.t - ((c.memo.prevN1At as number) ?? 0) > 0.5) {
          c.memo.prevN1 = c.memo.prevN1Store as number;
          c.memo.prevN1Store = c.snap.N1;
          c.memo.prevN1At = c.t;
        }
      },
      done: (c) => {
        const cruise = c.snap.thrust;
        return `Seyir irtifasında azami itki <b>${(cruise / 1000).toFixed(0)} kN</b>. Yakıt tüketimi (TSFC) <b>${(c.snap.tsfc * 1e6).toFixed(1)} g/kN·s</b> — deniz seviyesindekinden yüksek, çünkü itkinin bir kısmı ram direncine gidiyor.`;
      },
    },
    {
      title: 'Soru: seyirde ne kadar itki kalır?',
      body: `<p>Deniz seviyesindeki kalkış itkisiyle az önceki değeri karşılaştır.</p>`,
      ui: { cockpit: true, diagram: true, switches: [], flightControls: true },
      quiz: {
        question: '35 000 ft ve Mach 0.8\'de azami itki, deniz seviyesi kalkış itkisinin yaklaşık ne kadarıdır?',
        options: ['%95', '%60', '%15–20', '%2'],
        answer: 2,
        explain:
          'Seyrek hava ve ram direnci birlikte itkiyi büyük ölçüde düşürür. Neyse ki seyirde uçağın ihtiyacı da azdır: sürüklenme kuvveti kalkıştaki itki ihtiyacının çok altındadır.',
      },
    },
    {
      title: 'Sıcak bir yaz günü',
      body: `<p>Şimdi uçağı yere indir: irtifa <b>0</b>, Mach <b>0</b>. Sonra sıcaklığı <b>ISA+30</b>'a (45 °C) çıkar ve kalkış gücü ver.</p>
<p>EICAS'ı izle: EGT kırmızı çizgiye yaklaşınca FADEC itkiyi kısar ve <b>ENG EGT SINIRLAMA</b> mesajı belirir.</p>`,
      ui: { cockpit: true, diagram: true, switches: [], flightControls: true },
      objectives: [
        {
          text: (c) => `Deniz seviyesi, durağan (şu an ${Math.round(c.sim.flight.altitude)} m, M${c.sim.flight.mach.toFixed(2)})`,
          check: (c) => c.sim.flight.altitude <= 100 && c.sim.flight.mach <= 0.02,
        },
        { text: (c) => `ISA sapması ≥ +28 °C (şu an ${c.sim.flightTarget.isaDev >= 0 ? '+' : ''}${c.sim.flightTarget.isaDev})`, check: (c) => c.sim.flight.isaDev >= 28 },
        { text: 'Kalkış gücünde EGT sınırlamasını gözle', check: (c) => c.snap.controls.throttle > 0.95 && c.snap.egtLimited, hold: 2 },
      ],
      done: (c) =>
        `Sıcak günde kalkış itkisi <b>${(c.snap.thrust / 1000).toFixed(0)} kN</b> (standart günde ~319 kN). EGT <b>${c.snap.egt.toFixed(0)} °C</b>'de tutuluyor.`,
    },
    {
      title: 'Soru: sıcak günler',
      body: `<p>Sıcak ve yüksek rakımlı havalimanları (örneğin yazın Dubai ya da Denver) havayolları için neden zordur?</p>`,
      ui: { cockpit: true, diagram: true, switches: [], flightControls: true },
      quiz: {
        question: 'Sıcak günde kalkış itkisi neden düşer?',
        options: [
          'Yakıt sıcakta daha az enerji içerir',
          'Hava daha az yoğundur ve motor aynı itki için daha sıcak çalışmak zorundadır; EGT sınırına ulaşınca itki kısılır',
          'Fan kanatları sıcakta genişler',
          'Pilotlar sıcakta daha az gaz verir',
        ],
        answer: 1,
        explain:
          'Motorlar belirli bir dış sıcaklığa kadar sabit itki verecek şekilde derecelendirilir ("flat rating", tipik olarak ISA+15). Bunun üstünde sınırlayan EGT\'dir. Havayolları sıcak günlerde yükü azaltır ya da serin saatlerde kalkar.',
      },
    },
    {
      title: 'Özet',
      body: `<ul>
<li>İtki hava yoğunluğuyla orantılıdır; irtifada büyük ölçüde azalır.</li>
<li>Uçuş hızı <b>ram direnci</b> doğurur: net itki = brüt itki − hava akışı × uçuş hızı.</li>
<li>Motor davranışı <b>düzeltilmiş</b> büyüklüklerle karşılaştırılır; soğuk havada aynı mekanik devir daha yüksek düzeltilmiş devir demektir.</li>
<li>Sıcak günde sınırlayan <b>EGT</b>'dir.</li>
</ul>`,
      ui: { cockpit: true, diagram: true, switches: [], flightControls: true },
    },
  ],
};
