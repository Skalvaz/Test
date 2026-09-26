/** Bilgi bankası: derslerde geçen terimler. */

export interface GlossaryEntry {
  id: string;
  term: string;
  abbr?: string;
  body: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'turbofan',
    term: 'Turbofan',
    body: '<p>Havanın bir kısmını sıcak çekirdekten geçirip yakan, büyük kısmını ise yalnızca fanla hızlandırıp çekirdeğin etrafından geçiren jet motoru. Büyük miktarda havayı <b>az</b> hızlandırmak, az havayı <b>çok</b> hızlandırmaktan daha verimlidir; turbofanların turbojetlerden çok daha az yakıt harcamasının sebebi budur.</p>',
  },
  {
    id: 'n1',
    term: 'N1',
    abbr: 'Alçak basınç mili devri',
    body: '<p>Fan, booster ve LP türbinini taşıyan milin devri, tasarım devrinin yüzdesi olarak. Birçok motorda itki ayarı doğrudan N1 ile yapılır: FADEC, gaz kolu açısını bir N1 hedefine çevirir.</p>',
  },
  {
    id: 'n2',
    term: 'N2',
    abbr: 'Yüksek basınç mili devri',
    body: '<p>HP kompresör ve HP türbinini taşıyan çekirdek milinin devri. Çalıştırmada izlenen devirdir: marş motoru N2\'yi çevirir, yakıt belirli bir N2\'de verilir, rölanti bir asgari N2 ile tanımlanır.</p>',
  },
  {
    id: 'egt',
    term: 'EGT',
    abbr: 'Exhaust Gas Temperature — egzoz gazı sıcaklığı',
    body: '<p>Türbin bölgesinde termokupllarla ölçülen gaz sıcaklığı. Türbin giriş sıcaklığı (T4) doğrudan ölçülemeyecek kadar yüksek olduğundan EGT onun güvenilir bir göstergesidir. Kırmızı çizgiyi aşmak türbin kanatlarına kalıcı hasar verebilir. Bu simülasyonda HP türbin çıkışı (istasyon 45) kullanılır.</p>',
  },
  {
    id: 'bpr',
    term: 'Baypas oranı',
    abbr: 'BPR',
    body: '<p>Çekirdeğin etrafından geçen hava akışının, çekirdekten geçen hava akışına oranı. Modern geniş gövdeli uçak motorlarında 9–12 civarındadır: her 1 kg çekirdek havasına karşılık ~9 kg hava baypas kanalından geçer.</p>',
  },
  {
    id: 'opr',
    term: 'Toplam basınç oranı',
    abbr: 'OPR',
    body: '<p>Yüksek basınç kompresörü çıkışındaki basıncın (P3) fan girişindeki basınca (P2) oranı. Yüksek OPR daha yüksek ısıl verim demektir; modern motorlarda kalkışta 40–50\'dir.</p>',
  },
  {
    id: 'tsfc',
    term: 'Özgül yakıt tüketimi',
    abbr: 'TSFC',
    body: '<p>Birim itki başına saatlik ya da saniyelik yakıt tüketimi. Düşük TSFC daha verimli motor demektir. Burada g/(kN·s) kullanılır: 1 kN itki için saniyede kaç gram yakıt yakıldığı.</p>',
  },
  {
    id: 'brayton',
    term: 'Brayton çevrimi',
    body: '<p>Gaz türbinlerinin ideal termodinamik çevrimi: <b>izentropik sıkıştırma</b> (2→3), <b>sabit basınçta ısı ekleme</b> (3→4), <b>izentropik genişleme</b> (4→9). Gerçek motorda sıkıştırma ve genişleme kayıplıdır; T–s diyagramında bu, noktaların sağa (entropi artışı) kaymasıyla görülür.</p>',
  },
  {
    id: 'stations',
    term: 'İstasyon numaraları',
    body: '<p>Motor boyunca standart (SAE ARP 755) numaralar: <b>0</b> serbest akış, <b>2</b> fan girişi, <b>13</b> fan çıkışı (baypas), <b>21</b> fan çıkışı (çekirdek), <b>25</b> HPC girişi, <b>3</b> HPC çıkışı, <b>4</b> türbin girişi, <b>45</b> HPT çıkışı, <b>5</b> LPT çıkışı, <b>9</b> çekirdek lülesi çıkışı, <b>19</b> baypas lülesi çıkışı.</p>',
  },
  {
    id: 'fadec',
    term: 'FADEC',
    abbr: 'Full Authority Digital Engine Control',
    body: '<p>Motorun tam yetkili dijital kontrol birimi. Pilot gaz kolunu hareket ettirir; yakıtı FADEC belirler. İvmelenmede yakıtı <b>surge</b> sınırının altında, yavaşlamada <b>alev sönmesi</b> sınırının üstünde tutar; aşırı devri önler, çalıştırmada yakıt programını uygular.</p>',
  },
  {
    id: 'surge',
    term: 'Kompresör surge / stall',
    body: '<p>Kompresör, arkasındaki basınca karşı havayı itemediğinde akış kısa süreliğine tersine döner. Patlama sesi, girişten/egzozdan alev, EGT sıçraması ve itki kaybı görülür. Sebebi çalışma noktasının kompresör haritasındaki <b>surge hattını</b> aşmasıdır — örneğin yakıt ani artırıldığında türbin önünde sıcaklık ve basınç yükselir.</p>',
  },
  {
    id: 'surgeMargin',
    term: 'Surge payı',
    abbr: 'SM',
    body: '<p>Çalışma noktasının surge hattına ne kadar uzak olduğu. Burada aynı düzeltilmiş akışta: SM = PR<sub>surge</sub>/PR − 1. Kirlenmiş ya da hasarlı bir kompresörde surge hattı aşağı iner ve pay azalır.</p>',
  },
  {
    id: 'lightoff',
    term: 'Light-off',
    body: '<p>Çalıştırma sırasında yanma odasında alevin oluştuğu an. EGT\'nin hızla yükselmesiyle anlaşılır. Genellikle yakıt verildikten sonra 10 saniye içinde olmalıdır.</p>',
  },
  {
    id: 'hotStart',
    term: 'Sıcak çalıştırma',
    abbr: 'Hot start',
    body: '<p>Çalıştırma sırasında EGT\'nin çalıştırma limitini aşması. En yaygın sebebi yakıtın, kompresör yeterli hava sağlayacak devre ulaşmadan verilmesidir: az hava + aynı yakıt = çok yüksek sıcaklık.</p>',
  },
  {
    id: 'hungStart',
    term: 'Takılı çalıştırma',
    abbr: 'Hung start',
    body: '<p>Light-off olur ama motor rölanti devrine çıkamaz, N2 bir değerde asılı kalır. Zayıf marş havası ya da erken marş ayrılması tipik sebeplerdir. Yakıt kesilir, çalıştırma iptal edilir.</p>',
  },
  {
    id: 'wetStart',
    term: 'Islak çalıştırma',
    abbr: 'Wet start',
    body: '<p>Yakıt verilir ama ateşleme olmaz; yanmamış yakıt motorda birikir. Sonradan tutuşursa egzozdan uzun bir alev çıkar (<b>torching</b>). Prosedür: yakıtı kesip motoru bir süre kuru çevirerek birikmiş yakıtı boşaltmaktır.</p>',
  },
  {
    id: 'flameout',
    term: 'Alev sönmesi',
    abbr: 'Flameout',
    body: '<p>Yanmanın uçuş ya da çalışma sırasında kendiliğinden durması. Yakıt/hava oranı çok düştüğünde (ani yavaşlama, yakıt kesintisi) ya da yoğun su/buz yutulduğunda olabilir.</p>',
  },
  {
    id: 'corrected',
    term: 'Düzeltilmiş hız ve akış',
    body: '<p>Motor davranışı sıcaklık ve basınca göre ölçeklenir. N/√θ (θ = T/288.15 K) ve W·√θ/δ (δ = P/101325 Pa) biçimindeki düzeltilmiş değerler, farklı irtifa ve havalarda karşılaştırmayı mümkün kılar. Sıcak günde aynı mekanik devir daha düşük düzeltilmiş devre karşılık gelir.</p>',
  },
  {
    id: 'ramDrag',
    term: 'Ram direnci',
    body: '<p>Motora giren havanın uçuş hızıyla getirdiği momentum. Net itki = brüt itki − (hava akışı × uçuş hızı). Uçak hızlandıkça ram direnci artar, net itki düşer.</p>',
  },
  {
    id: 'isa',
    term: 'ISA',
    abbr: 'International Standard Atmosphere',
    body: '<p>Deniz seviyesinde 15 °C ve 1013.25 hPa kabul eden, 11 km\'ye kadar her kilometrede 6.5 °C soğuyan referans atmosfer. "ISA+20" standarttan 20 °C sıcak bir gün demektir.</p>',
  },
  {
    id: 'bleed',
    term: 'Bleed hava',
    body: '<p>Kompresörden ya da APU\'dan alınan basınçlı hava. Kabin basınçlandırma, buz önleme ve motor çalıştırma için kullanılır. Çalıştırmada APU bleed havası hava türbinli marş motorunu döndürür.</p>',
  },
];
