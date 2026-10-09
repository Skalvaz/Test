/**
 * Parça bilgi kartları. Ders içindeki seçme görevleri ve 3B üzerinde gezinirken
 * gösterilen etiketler buradan gelir.
 */

import type { EngineTraits } from '../design/traits';
import type { PartId } from '../engine/visual';
import type { EngineKind } from '../sim';

export interface PartInfo {
  name: string;
  short: string;
}

export const PARTS: Record<PartId, PartInfo> = {
  spinner: {
    name: 'Burun konisi (spinner)',
    short:
      'Havayı fan köküne düzgün yönlendirir. Üzerindeki sarmal işaret, yer ekibinin fanın dönüp dönmediğini uzaktan görmesi içindir.',
  },
  inlet: {
    name: 'Hava girişi dudağı',
    short:
      'Havayı fana girdapsız ve düzgün hızla ulaştırır. Seyirde gelen havayı yavaşlatarak basıncını artırır (ram etkisi). Buzlanmaya karşı sıcak hava ile ısıtılır.',
  },
  fan: {
    name: 'Fan',
    short:
      'Motordaki en büyük kompresör kademesi. Havanın yaklaşık %90\'ı fandan geçip baypas kanalından çıkar; kalkış itkisinin %80\'inden fazlasını fan üretir. LP türbini tarafından N1 milinden çevrilir.',
  },
  fanCase: {
    name: 'Fan muhafazası (containment)',
    short:
      'Bir fan kanadı koparsa parçaların motor dışına fırlamasını engelleyen, aramid (Kevlar) sargılı dayanıklı halka.',
  },
  nacelle: {
    name: 'Nacelle / fan kaportası',
    short:
      'Motoru saran aerodinamik kabuk. İçinde itki çevirici (thrust reverser) ve bakım için açılan kapaklar bulunur.',
  },
  bypassDuct: {
    name: 'Baypas kanalı',
    short:
      'Fan havasının çekirdeğin etrafından geçtiği halka kanal. İç yüzeyi fan gürültüsünü emen delikli akustik astarla kaplıdır.',
  },
  bypassNozzle: {
    name: 'Baypas lülesi (chevron)',
    short:
      'Fan havasını hızlandırarak itki üretir. Testere dişli kenar (chevron) sıcak ve soğuk akışların karışmasını yumuşatıp jet gürültüsünü azaltır.',
  },
  ogv: {
    name: 'Fan çıkış yönlendiricileri (OGV) ve çerçeve',
    short:
      'Fanın verdiği dönme hareketini (girdabı) düzelterek akışı eksenel hale getirir; kalın kollar motorun yükünü taşır.',
  },
  coreCowl: {
    name: 'Çekirdek kaportası ve ayırıcı',
    short:
      'Ayırıcı (splitter) akışı baypas ve çekirdek olarak ikiye böler. Çekirdek kaportası sıcak motor gövdesini saran iç kabuktur.',
  },
  casing: {
    name: 'Çekirdek gövdesi',
    short: 'Kompresör, yanma odası ve türbinleri saran basınçlı dış gövde (gaz yolu duvarı).',
  },
  booster: {
    name: 'Alçak basınç kompresörü (booster)',
    short:
      'Fanın arkasında, aynı N1 milinde dönen birkaç kademelik kompresör. Çekirdeğe giren havanın basıncını HPC\'den önce bir miktar artırır.',
  },
  hpc: {
    name: 'Yüksek basınç kompresörü (HPC)',
    short:
      'Çok kademeli eksenel kompresör. Havayı 15–20 kat sıkıştırır; motorun toplam basınç oranı (OPR) 40\'ın üzerine çıkar. HP türbini tarafından N2 milinden çevrilir.',
  },
  combustor: {
    name: 'Yanma odası',
    short:
      'Halka biçimli oda. Enjektörler yakıtı sisler, ateşleyiciler çalıştırmada tutuşturur. Sabit basınçta ısı eklenir: gaz 1700 K\'e kadar ısınır.',
  },
  hpt: {
    name: 'Yüksek basınç türbini (HPT)',
    short:
      'Yanma odasından çıkan en sıcak gazla çalışır ve HPC\'yi çevirir. Kanatları tek kristal süper alaşımdır ve içinden soğutma havası geçer.',
  },
  lpt: {
    name: 'Alçak basınç türbini (LPT)',
    short:
      'Çok kademeli türbin. Gazdan kalan enerjinin büyük kısmını alıp N1 miliyle fanı ve booster\'ı çevirir.',
  },
  shafts: {
    name: 'Miller (N1 / N2)',
    short:
      'İç içe iki mil: LP mili (N1) fan + booster + LPT\'yi, onu saran HP mili (N2) HPC + HPT\'yi bağlar. İkisi farklı devirlerde döner.',
  },
  exhaust: {
    name: 'Egzoz lülesi ve konisi',
    short:
      'Türbinden çıkan sıcak gazı hızlandırıp atar (çekirdek itkisi). Koni akışı düzgünleştirir; türbin arka çerçevesi arka yatağı taşır.',
  },
  gearbox: {
    name: 'Aksesuar dişli kutusu',
    short:
      'HP milinden güç alır: yakıt ve yağ pompaları, hidrolik pompa, jeneratör buraya bağlıdır. Marş motoru da motoru buradan çevirir.',
  },
  pylon: {
    name: 'Pilon',
    short: 'Motoru kanada bağlayan yapı. İçinden yakıt, hidrolik, elektrik ve bleed hava hatları geçer.',
  },
  wing: {
    name: 'Kanat',
    short: 'Motorun asıldığı kanat kökü (görsel bağlam için).',
  },
  afterburner: {
    name: 'Art yakıcı (afterburner / reheat)',
    short:
      'Türbinden çıkan gazda hâlâ bol oksijen vardır. Art yakıcı bu gaza ikinci kez yakıt püskürtüp alev tutucuların arkasında yakar: itki %50-60 artar, yakıt tüketimi ise 3-4 katına çıkar.',
  },
  nozzle: {
    name: 'Değişken kesitli lüle',
    short:
      'Hidrolik aktüatörlerle açılıp kapanan yaprak halkası. Art yakıcı yanınca gaz hacmi büyür; lüle açılmasa türbin arkasındaki basınç yükselir ve fan stall olur. Yakınsak-ıraksak şekli jeti süpersonik hıza hızlandırır.',
  },
  propeller: {
    name: 'Pervane',
    short:
      'Güç türbininin gücünü dişli kutusu üzerinden alır. Sabit devir valisi pal açısını değiştirerek devri sabit tutar; motor kapanınca paller rüzgâra paralel "tüy" konumuna döner.',
  },
  stand: {
    name: 'Test standı',
    short: 'Motoru itki ölçüm çerçevesine asan çelik kiriş. Motorun ittiği kuvvet buradan yük hücresine aktarılır.',
  },
  // M5a yeni parçaları
  mixer: {
    name: 'Karıştırıcı (mixer)',
    short:
      'Türbin çıkışında sıcak çekirdek akışı ile soğuk baypas akışını ortak bir jet borusunda buluşturur. Lobe\'lu karıştırıcı iki akışı iç içe geçirerek hızlı karıştırır: jet hızı düşer, itki verimi artar, ses azalır.',
  },
  outputShaft: {
    name: 'Çıkış mili',
    short:
      'Turboşaftta serbest güç türbininin gücünü dışarı (helikopter rotor dişli kutusuna, jeneratöre ya da pompaya) taşıyan mil. Gaz jeneratörüne mekanik bağı yoktur; yalnız gaz akışıyla çevrilir.',
  },
  engineCase: {
    name: 'Motor gövdesi',
    short:
      'Kaportasız motorun dış kabuğu: kompresör, yanma odası ve türbin kasalarının flanşlarla birleşmiş dizisi. Basıncı taşır, yatakları ve dış donanımı tutar.',
  },
  accessories: {
    name: 'Aksesuar dişli kutusu',
    short:
      'HP milinden güç alır: yakıt ve yağ pompaları, hidrolik pompa, jeneratör buraya bağlıdır. Marş motoru da motoru buradan çevirir.',
  },
};

/**
 * Motor tipine göre farklı anlamı olan parçalar. Aynı etiket (ör. 'fan')
 * askeri turbofanda düşük baypaslı fanı, turbojette alçak basınç
 * kompresörünü gösterir; kartlar buna göre değişir.
 */
const PART_OVERRIDES: Partial<Record<EngineKind, Partial<Record<PartId, PartInfo>>>> = {
  militaryTurbofan: {
    spinner: {
      name: 'Burun konisi',
      short: 'Fan göbeğinin önündeki sabit koni. Havayı fan köküne düzgün yönlendirir; buzlanmaya karşı ısıtılır.',
    },
    inlet: {
      name: 'Test hücresi giriş ağzı (bellmouth)',
      short:
        'Uçakta motorun önünde uzun bir hava alığı kanalı bulunur. Test hücresinde bunun yerine havayı kayıpsız ve girdapsız emen yuvarlak ağızlı bir çan kullanılır.',
    },
    fan: {
      name: 'Fan (3 kademeli, düşük baypas)',
      short:
        'Yolcu turbofanının tek dev fanı yerine küçük çaplı, 3 kademeli bir fan. Havanın yalnız ~%30\'u baypastan geçer (BPR ≈ 0.4): motor ince kalır ve yüksek hızlı jet üretir. Öndeki değişken kanatlar (VSV) fanı stall\'dan korur.',
    },
    fanCase: {
      name: 'Motor gövdesi ve flanşlar',
      short:
        'Modüller flanşlarla birbirine cıvatalanır; bakımda motor bu flanşlardan ayrılır. Dışındaki borular yakıt, yağ ve bleed hava hatlarıdır, kablolar FADEC\'e gider.',
    },
    bypassDuct: {
      name: 'Baypas kanalı ve karıştırıcı',
      short:
        'Fan havasının bir kısmı çekirdeği soğutarak dolaşır, türbin arkasında sıcak gazla karışır. Karışmış akış art yakıcıya girer: soğuk havadaki oksijen ikinci yanmayı besler.',
    },
    gearbox: {
      name: 'Dış donanım (aksesuar kutusu, yakıt ve yağ)',
      short:
        'Motorun altındaki dişli kutusu HP milinden güç alıp yakıt/yağ pompalarını, jeneratörü ve hidrolik pompayı çevirir. Yakıt manifoldu enjektörlere, ateşleyiciler yanma odasına bağlıdır.',
    },
    exhaust: {
      name: 'Türbin arka çerçevesi',
      short: 'LPT\'den çıkan gazın girdabını düzelten kollar ve iç koni. Arka rulman buradan taşınır.',
    },
  },
  turbojet: {
    spinner: {
      name: 'Burun konisi',
      short: 'Kompresörün önündeki sabit koni; ön rulman yuvasını da taşır.',
    },
    inlet: {
      name: 'Giriş ağzı ve ön çerçeve',
      short:
        'Kalın ön kollar ön rulmanı taşır ve içlerinden yağ hatları geçer. Test hücresinde havayı düzgün emen çan ağız (bellmouth) takılır.',
    },
    booster: {
      name: 'Alçak basınç kompresörü (LPC)',
      short:
        'İki milli turbojetin ön kompresörü: LP türbini tarafından N1 milinden çevrilir. Baypas yoktur, havanın tamamı yanma odasından geçer.',
    },
    fanCase: {
      name: 'Motor gövdesi ve flanşlar',
      short:
        'Çok sayıda değişken stator (VSV) kademesinin aktüatör halkaları gövdenin dışında görünür: eski turbojetler yüksek basınç oranında stall\'a çok yatkın olduğu için bu kadar çok ayarlı kademe gerekirdi.',
    },
    gearbox: {
      name: 'Dış donanım (aksesuar kutusu, yakıt ve yağ)',
      short:
        'Aksesuar dişli kutusu, yağ tankı, yakıt manifoldu ve ateşleyiciler. Dışarıdaki borular sıcak gövdeye kelepçelerle tutturulur; genleşme için esnek bağlantılar kullanılır.',
    },
    exhaust: {
      name: 'Türbin arka çerçevesi',
      short:
        'Türbin çıkışındaki kollar ve koni. Eski turbojetlerde yanma is (kurum) üretir; sıcak gövde koyu renge döner ve art yakıcı alevi turuncu-sarı görünür.',
    },
  },
  turboprop: {
    spinner: {
      name: 'Pervane göbek kapağı',
      short: 'Pal açısını değiştiren hidrolik mekanizmayı örter ve havayı motor girişine düzgün yönlendirir.',
    },
    inlet: {
      name: 'S kanallı hava girişi',
      short:
        'Pervane redüktörü motorun önünü kapattığı için hava alttan bir S kanalıyla gaz jeneratörüne ulaşır. Kanalın alt kısmı yabancı cisimleri (buz, taş) ayırır.',
    },
    fanCase: {
      name: 'Gaz jeneratörü gövdesi',
      short:
        'Eksenel + santrifüj kompresör, yanma odası ve türbinleri saran gövde. Flanşlardan modüllere ayrılır.',
    },
    hpc: {
      name: 'Kompresör (eksenel + santrifüj)',
      short:
        'Birkaç eksenel kademenin arkasında tek bir santrifüj kademe: küçük motorlarda yüksek basınç oranını kısa bir boyda sağlar.',
    },
    gearbox: {
      name: 'Redüksiyon dişli kutusu (RGB)',
      short:
        'Türbin mili ~20 000 dev/dk döner, pervane ise ~1 200. Planet dişli seti devri ~15 kat düşürüp torku aynı oranda artırır. Üstünde pervane valisi, çevresinde yakıt ve yağ donanımı bulunur.',
    },
    lpt: {
      name: 'Güç türbini',
      short:
        'Gazdaki enerjinin neredeyse tamamını mil gücüne çevirir; jet itkisi toplamın yalnız ~%10\'udur. Mil, redüktör üzerinden pervaneyi çevirir.',
    },
    shafts: {
      name: 'Miller (gaz jeneratörü / güç türbini)',
      short:
        'Gaz jeneratörü mili (Ng) kompresörü, iç içe geçen güç türbini mili pervaneyi çevirir. İkisi mekanik olarak bağlı değildir: pervane devri vali tarafından sabit tutulur.',
    },
    exhaust: {
      name: 'Egzoz borusu',
      short: 'Güç türbininden çıkan, enerjisi büyük ölçüde alınmış gazı dışarı atar; az miktarda artık itki üretir.',
    },
  },
  turboshaft: {
    spinner: {
      name: 'Çıkış mili göbeği',
      short: 'Önden çıkan güç milinin flanşını örter. Mil girişin ortasından geçer; hava çevresindeki halkadan girer.',
    },
    inlet: {
      name: 'Halka giriş ve parçacık ayırıcı',
      short:
        'Hava çıkış milinin çevresindeki halkadan girer. Helikopter tozlu alanlara iner: ayırıcı havayı kıvırır, ağır kum ve buz taneleri dış kanala savrulup atılır, temiz hava kompresöre gider.',
    },
    fanCase: {
      name: 'Gaz jeneratörü gövdesi',
      short: 'Kompresör, yanma odası ve türbinleri saran gövde. Küçük ve hafiftir: helikopterde her kilogram yük demektir.',
    },
    engineCase: {
      name: 'Gaz jeneratörü gövdesi',
      short: 'Kompresör, yanma odası ve türbinleri saran gövde. Küçük ve hafiftir: helikopterde her kilogram yük demektir.',
    },
    hpc: {
      name: 'Kompresör (eksenel + santrifüj)',
      short:
        'Birkaç eksenel kademe ve tek santrifüj çark. Hava debisi küçük olduğundan son eksenel kanatlar çok kısalırdı; çark yüksek basınç oranını kısa ve sağlam bir parçayla verir.',
    },
    lpt: {
      name: 'Serbest güç türbini',
      short:
        'Gaz jeneratörüne mekanik bağı yoktur, yalnız gaz akışıyla döner. Gücünün tamamı çıkış miline gider; vali devrini (NP) %100\'de tutar, gaz kolu ise gaz jeneratörünün ne kadar güç vereceğini seçer.',
    },
    shafts: {
      name: 'Miller (gaz jeneratörü / güç türbini)',
      short:
        'Gaz jeneratörü mili (NG) kompresörü çevirir. İçinden geçen güç türbini mili öne uzanır ve çıkış miline bağlanır; iki mil farklı devirlerde döner.',
    },
    gearbox: {
      name: 'Aksesuar dişli kutusu',
      short: 'Gaz jeneratörü milinden güç alır: yakıt ve yağ pompaları, jeneratör, marş motoru buradadır.',
    },
    accessories: {
      name: 'Aksesuar dişli kutusu',
      short: 'Gaz jeneratörü milinden güç alır: yakıt ve yağ pompaları, jeneratör, marş motoru buradadır.',
    },
    exhaust: {
      name: 'Egzoz çıkışı',
      short: 'Güç türbininden çıkan, enerjisi neredeyse tamamen alınmış gazı yana ya da arkaya atar. İtki üretmez sayılır.',
    },
  },
};

/**
 * Mimariye bağlı kartlar: aynı etiket farklı donanımı gösterebilir (sabit
 * lüle, kutu yanma odası). Sunum tipinin kartlarından sonra uygulanır.
 */
function traitCard(part: PartId, t: EngineTraits): PartInfo | undefined {
  if (part === 'nozzle' && t.nozzle === 'fixed') {
    return {
      name: 'Sabit yakınsak lüle',
      short:
        'Art yakıcısız motorun lülesi: kesiti değişmez. Ağız alanı tasarımda türbinin ne kadar genişleyeceğini belirler; daha geniş ağız türbine daha çok iş, jete daha az hız bırakır.',
    };
  }
  if (part === 'combustor' && t.combustor === 'can') {
    return {
      name: 'Kutu yanma odası',
      short:
        'Çevreye dizilmiş ayrı ayrı yanma kutuları; her birinin kendi alev borusu ve kabı vardır. Erken jet motorlarında yaygındı: bakımı kolay ama ağır ve uzundur.',
    };
  }
  if (part === 'combustor' && t.combustor === 'canAnnular') {
    return {
      name: 'Kutu-halka yanma odası',
      short:
        'Ortak bir halka kasanın içinde ayrı alev boruları (kutular). Kutular birbirine ateşleme borularıyla bağlıdır: yalnız ikisinde buji vardır, alev ötekilere bu borulardan geçer.',
    };
  }
  return undefined;
}

/**
 * Motora uygun parça kartı: mimariye bağlı kart, sonra sunum tipinin kartı,
 * sonra genel kart. Türetilmiş tip (traits) ya da yalnız sunum tipi alır.
 */
export function partInfo(part: PartId, t: EngineTraits | EngineKind): PartInfo {
  const traits = typeof t === 'string' ? undefined : t;
  const kind = typeof t === 'string' ? t : t.presentation;
  return (traits && traitCard(part, traits)) ?? PART_OVERRIDES[kind]?.[part] ?? PARTS[part];
}
