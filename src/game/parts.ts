/**
 * Parça bilgi kartları. Ders içindeki seçme görevleri ve 3B üzerinde gezinirken
 * gösterilen etiketler buradan gelir.
 */

import type { PartId } from '../engine/visual';

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
};
