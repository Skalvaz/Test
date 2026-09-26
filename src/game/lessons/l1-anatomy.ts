import { idleEngine } from './helpers';
import type { Lesson } from './types';

export const anatomy: Lesson = {
  id: 'anatomy',
  title: 'Turbofan\'ın anatomisi',
  summary: 'Havanın motordaki yolculuğunu takip et: fan, baypas, kompresörler, yanma odası, türbinler ve miller.',
  minutes: 6,
  level: 'Başlangıç',
  setup: idleEngine,
  steps: [
    {
      title: 'Bir turbofan nasıl itki üretir?',
      body: `<p>Karşında rölantide çalışan, yüksek baypas oranlı bir turbofan var — geniş gövdeli yolcu uçaklarında kullanılan sınıftan.</p>
<p>Bütün jet motorlarının prensibi aynıdır: <b>havayı arkaya doğru hızlandırmak</b>. Newton'un üçüncü yasasına göre motor, hızlandırdığı havaya uyguladığı kuvvetin tepkisiyle ileri itilir:</p>
<div class="callout">İtki ≈ (hava akışı) × (jet hızı − uçuş hızı)</div>
<p>Turbofan bu işi iki yoldan yapar: havanın küçük bir kısmını sıcak <b>çekirdekten</b> geçirip yakar, büyük kısmını ise yalnızca <b>fanla</b> hızlandırıp çekirdeğin etrafından geçirir.</p>
<p>Fareyle motoru sürükleyerek döndürebilir, tekerlekle yaklaşabilirsin. Parçaların üzerine gelince adları görünür.</p>`,
      ui: { view: 'front', cockpit: false, diagram: false },
    },
    {
      title: 'Fan: motorun ön yüzü',
      body: `<p>Parlayan parça <b>fan</b>. 22 adet geniş kordlu titanyum kanat taşır ve 2.77 m çapındadır. Kalkış gücünde dakikada ~2 550 devir yapar; kanat uçları ses hızını aşar.</p>
<p>Fan aslında büyük, tek kademeli bir kompresördür. Havanın basıncını ~%55 artırır. Kanatların kökte dik, uca doğru yatık olmasının (burulma) sebebi: uç, kökten çok daha hızlı döner, bu yüzden havayı her yarıçapta doğru açıyla karşılamak için kanat boyunca açı değişir.</p>
<div class="callout">Fanın önündeki sarmal çizgi süs değil: yer ekibi fanın dönüp dönmediğini uzaktan bu çizgiyle anlar.</div>`,
      ui: { view: 'fan', highlight: 'fan' },
    },
    {
      title: 'Baypas: havanın büyük kısmı nereye gider?',
      body: `<p>Fandan geçen havanın çoğu çekirdeğe girmez; çekirdeği saran halka biçimli <b>baypas kanalından</b> geçip arkadaki lüleden çıkar.</p>
<p>Çekirdeğin etrafından geçen havanın, çekirdekten geçen havaya oranına <b>baypas oranı (BPR)</b> denir. Bu motorda BPR ≈ 9.</p>
<p>Neden böyle? Aynı itkiyi <b>çok havayı az hızlandırarak</b> üretmek, <b>az havayı çok hızlandırmaktan</b> daha az enerji ister — geride daha az kinetik enerji "çöpe" gider. Modern motorların turbojetlerin yarısı kadar yakıt yakmasının ana sebebi budur.</p>`,
      ui: { view: 'side', highlight: 'bypassDuct' },
      quiz: {
        question: 'Baypas oranı 9 olan bu motorda, fana giren havanın yaklaşık ne kadarı çekirdeğe (yanma odasına) girer?',
        options: ['%1', '%10', '%50', '%90'],
        answer: 1,
        explain: 'Her 1 birim çekirdek havasına 9 birim baypas havası düşer: 1/(1+9) = %10.',
      },
    },
    {
      title: 'Çekirdek: sıkıştır, yak, genişlet',
      body: `<p>Motoru ortadan kesip içine bakıyoruz. Çekirdek havası sırasıyla şunlardan geçer:</p>
<ul>
<li><b>Booster</b> (alçak basınç kompresörü) — fanla aynı milde</li>
<li><b>Yüksek basınç kompresörü (HPC)</b> — 9 kademe; havayı ~16 kat sıkıştırır</li>
<li><b>Yanma odası</b> — yakıt püskürtülür ve yakılır</li>
<li><b>Yüksek basınç türbini (HPT)</b> — HPC'yi çevirir</li>
<li><b>Alçak basınç türbini (LPT)</b> — fanı ve booster'ı çevirir</li>
<li><b>Egzoz lülesi</b> — kalan enerjiyle gazı hızlandırır</li>
</ul>
<p>Vurgulanan parça yüksek basınç kompresörü. Kademeler arkaya doğru küçülür: hava sıkıştıkça daha az yer kaplar.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: 'hpc' },
    },
    {
      title: 'Yanma odası ve türbinler',
      body: `<p><b>Yanma odası</b> halka biçimindedir. 20 enjektör yakıtı ince bir sis halinde püskürtür. Burada basınç neredeyse sabit kalırken sıcaklık ~700 °C'den ~1 400 °C'nin üstüne çıkar — kalkışta türbin girişi 1 680 K civarındadır.</p>
<p>Bu gaz, pek çok metalin erime noktasından sıcaktır. <b>HP türbin</b> kanatları tek kristal nikel süper alaşımdan dökülür, içlerinden kompresörden alınan soğutma havası geçer ve yüzeyleri seramik ısıl bariyerle kaplanır.</p>
<p>Türbinler, gazın enerjisinin bir kısmını mil işine çevirerek kompresörleri ve fanı döndürür. Kalanı egzozdan jet olarak çıkar.</p>`,
      ui: { view: 'cutawayCore', cutaway: true, highlight: 'combustor' },
    },
    {
      title: 'İki mil, iki devir: N1 ve N2',
      body: `<p>Motorda iç içe iki mil vardır ve farklı devirlerde döner:</p>
<ul>
<li><b>LP mili (N1):</b> fan + booster + LP türbin. Uzun ve incedir; en içte.</li>
<li><b>HP mili (N2):</b> HPC + HP türbin. Kısa ve kalındır; LP milini sarar.</li>
</ul>
<p>Büyük fan yavaş (kanat uçları aşırı süpersonik olmasın diye), küçük çekirdek hızlı dönmek ister. İki ayrı mil ikisinin de en verimli devrinde çalışmasını sağlar. Kokpitteki N1 ve N2 göstergeleri bu iki milin devridir.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: 'shafts' },
      quiz: {
        question: 'Fanı hangi parça döndürür?',
        options: [
          'Yüksek basınç türbini (HPT)',
          'Alçak basınç türbini (LPT)',
          'Marş motoru',
          'Yüksek basınç kompresörü (HPC)',
        ],
        answer: 1,
        explain: 'Fan, booster ve LP türbin aynı (N1) milindedir; LPT gazdan aldığı enerjiyle fanı çevirir.',
      },
    },
    {
      title: 'Sınav: yanma odasını bul',
      body: `<p>Şimdi sıra sende. Etiketler kapalı; parçanın üzerine gelince sadece çerçevesi yanar.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: null },
      pick: { part: 'combustor', prompt: 'Yakıtın yakıldığı <b>yanma odasına</b> tıkla.' },
    },
    {
      title: 'Sınav: yüksek basınç kompresörü',
      body: `<p>Havayı 16 kat sıkıştıran, 9 kademeli kompresörü bul.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: null },
      pick: { part: 'hpc', prompt: '<b>Yüksek basınç kompresörüne (HPC)</b> tıkla.' },
    },
    {
      title: 'Sınav: fanı çeviren türbin',
      body: `<p>Fanı döndüren türbin hangisiydi? Onu bul.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: null },
      pick: { part: 'lpt', prompt: 'Fanı çeviren <b>türbine</b> tıkla.' },
    },
    {
      title: 'Sınav: aksesuar dişli kutusu',
      body: `<p>Motor yalnızca itki üretmez: yakıt ve yağ pompalarını, hidrolik pompayı ve uçağın jeneratörünü de çalıştırır. Bunlar HP milinden güç alan <b>aksesuar dişli kutusuna</b> bağlıdır. Marş motoru da motoru bu kutu üzerinden çevirir.</p>`,
      ui: { view: 'cutaway', cutaway: true, highlight: null },
      pick: { part: 'gearbox', prompt: 'Pompaların bağlı olduğu <b>aksesuar dişli kutusuna</b> tıkla (çekirdeğin altında).' },
    },
    {
      title: 'Tebrikler',
      body: `<p>Havanın yolculuğunu tamamladın: <b>fan → baypas</b> ya da <b>booster → HPC → yanma odası → HPT → LPT → lüle</b>.</p>
<p>Sıradaki derste bu motoru kokpitten, gerçek prosedürle çalıştıracaksın.</p>`,
      ui: { view: 'front', cutaway: false, highlight: null },
    },
  ],
};
