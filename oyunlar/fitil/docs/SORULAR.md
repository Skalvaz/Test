# Uzmanlara sorulacak sorular (FİTİL, Kasım 2026)

Doğrulanmış arka plan bilgileri ve kaynakları: `docs/YASAL-DOGRULAMA.md`.

## 1. Avukata (KVKK / bilişim hukuku)

**Durum özeti (avukata ilet):**
Türkiye'de yaşayan, tek kişilik (şirketsiz) bir geliştiriciyim. Google Play'de
ücretsiz bir Android bulmaca oyunu yayınlayacağım. Oyunda hesap, sunucu ya da
analitik yok; ilerleme yalnız telefonda. Gelir iki yoldan gelecek:
(1) Google Play Faturalandırma ile uygulama içi satın alma,
(2) Google AdMob ödüllü reklam: yalnız oyuncu "reklam izle"ye dokunursa ve
oyundaki ayrı bir izin kartında açık rıza verirse. İzin verilmezse reklam
yazılımı hiç başlamaz. İzin her an geri alınabilir. AdMob'un SDK'sı IP adresi,
reklam kimliği, cihaz bilgisi ve reklam etkileşimlerini otomatik toplayıp
Google'a (ABD) gönderir. Google AdMob'u kendi şartlarında "Controller Service"
olarak tanımlıyor (Google bağımsız veri sorumlusu); şartlarında KVKK standart
sözleşmesi yok. Oyuncular Türkiye'de ve yurt dışında olacak.

**Sorular:**
1. Oyuna gömülü AdMob SDK'sı veriyi doğrudan Google'a gönderiyor. KVKK m.9
   anlamında yurt dışına aktarımı yapan **ben** miyim, yoksa veriyi kendi
   adına toplayan Google mı?
2. Aktaran bensem: düzenli aktarım için açık rıza yetmediğine göre (m.9/6
   yalnız arızi aktarım) hangi güvenceyi kullanmalıyım? Google KVKK Standart
   Sözleşme-1'i imzalamazsa AdMob'u yasal olarak kullanmanın bir yolu var mı?
3. Türkiye'de yerleşik veri sorumlusu olarak **yurt dışındaki oyuncuların**
   verisi için de m.9 yükümlülüğüm var mı?
4. Oyundaki reklam izni kartı ve gizlilik politikası (KVKK aydınlatma metni)
   yeterli mi? (İki metni de ekte gönderiyorum: `docs/gizlilik.html` ve
   oyundaki izin kartının metni.)
5. Google Play'de Türkiye'deki satışlarda satıcı (merchant of record) kim?
   Mesafeli Sözleşmeler Yönetmeliği'ne göre bilgilendirme ve cayma hakkı
   istisnası (anında ifa edilen dijital içerik) için bana düşen bir
   yükümlülük var mı?
6. AB'deki oyuncular için GDPR m.27 kapsamında AB temsilcisi atamam gerekir
   mi? (Kendi sunucum yok; veriyi yalnız Google'ın SDK'sı rızayla işliyor.)
   Birleşik Krallık için aynı soru.
7. Bu riskleri azaltmak için şirket (şahıs şirketi ya da limited) kurmak ya da
   yayıncıyı yurt dışında konumlandırmak gerekir mi? Tek kişilik
   geliştiriciler bunu genelde nasıl çözüyor?
8. "Fitil" adı ve logosu için marka başvurusu yapmalı mıyım? Önce benzer
   kayıt araştırması yapar mısınız?

**İstenen:** 1–3 için yazılı görüş. Politikadaki "aktarım dayanağı" yer
tutucusu bu görüşle doldurulacak.

## 2. Mali müşavire

**Durum özeti:** Türkiye'de yaşıyorum. Google Play'deki bir mobil oyundan
uygulama içi satış geliri ve AdMob reklam geliri elde edeceğim. Ödemeler
Google'dan (yurt dışı) gelecek.

**Sorular:**
1. GVK mükerrer 20/B (mobil uygulama geliştiriciliği istisnası) bana
   uygulanır mı? Şartları neler: ayrı banka hesabı, istisna belgesi, kesinti
   oranı, 2026 beyan sınırı?
2. AdMob reklam geliri de 20/B kapsamına giriyor mu, yoksa ayrı mı
   değerlendiriliyor?
3. Şahıs şirketi kurmam mı, 20/B ile şirketsiz devam etmem mi daha uygun?
   Play, para kazanan geliştiricinin tam adresini mağazada gösteriyor; ev
   adresimi göstermek istemiyorum, iş adresi için ne yapabilirim?
4. ETBİS (Elektronik Ticaret Bilgi Sistemi) kaydı gerekir mi?
5. Google Play ve AdMob ödeme profillerinde hangi vergi bilgilerini
   girmeliyim (W-8BEN vb.)?

## 3. Reklam ağlarına (İngilizce; gizlilik/hukuk ekiplerine)

> Subject: Turkish data protection law (KVKK) — Standard Contract for cross-border transfers
>
> Hello,
>
> I am an individual developer based in Türkiye, planning to integrate your
> ads SDK into a mobile game published on Google Play. Under Article 9 of
> Türkiye's Personal Data Protection Law No. 6698 (as amended in 2024),
> regular transfers of personal data from Türkiye abroad require an
> appropriate safeguard. The Turkish Data Protection Authority published
> standard contracts for this purpose (Board decision 2024/959; "Standard
> Contract 1 – Controller to Controller").
>
> 1. Does your company sign the KVKK Standard Contract (Controller to
>    Controller, or another module that applies) with publishers/developers?
> 2. If yes, how can I request it, and which of your entities would sign?
> 3. If not, which transfer mechanism under KVKK Article 9 do you rely on
>    for data collected by your SDK from users in Türkiye?
>
> Thank you,
> [Ad Soyad], [e-posta]

Gönderilecek yerler: Google AdMob (AdMob yardım merkezi > iletişim / gizlilik
ekibi), AppLovin (privacy@ ya da dpo@ adresi, kendi gizlilik sayfasından
teyit et), Unity Ads (gizlilik sayfasındaki DPO iletişimi). Adresleri
şirketlerin güncel gizlilik politikasından al.
