# FİTİL — Yasal uyum kontrol listesi (Play, KVKK, GDPR, ABD)

Kasım 2026 (7 Kasım'da birincil kaynaklardan yeniden doğrulandı: `docs/YASAL-DOGRULAMA.md`). Ürün sahibinin isteği: Türkiye'de ve yurt dışında eksiksiz, ceza
riski en aza indirilmiş yayın. **Bu belge hukuki görüş değildir.** Kodda ve
belgelerde yapılabilecek her şey yapıldı; ⚖️ işaretli maddeler bir avukat ya
da mali müşavirin onayını ister, 👤 işaretliler ürün sahibinin kendi
yapacağı işlerdir. Sıfır risk hiçbir uygulama için garanti edilemez; amaç
bilinen her yükümlülüğü karşılamak ve kalan kararları açıkça görmektir.

Durum işaretleri: ✅ yapıldı · 👤 ürün sahibi yapacak · ⚖️ uzman onayı · ❓ karar bekliyor

## 1. Uygulamanın gerçekte işlediği veriler

| Veri | Nerede | Kime gider | Dayanak |
|---|---|---|---|
| İlerleme, ayarlar, satın alma kaydı, ölçüm günlüğü | Yalnız cihaz (`localStorage`, yedekleme kapalı) | Kimseye | Hizmetin sunulması |
| Reklam kimliği, IP, cihaz/uygulama bilgisi, reklam etkileşimi | Google Mobile Ads SDK | Google (ABD) | **Açık rıza** (§2) |
| Satın alma (ürün, sipariş no.) | Google Play | Google; geliştiriciye Play Console | Sözleşme, vergi |

Sunucu, hesap, analitik SDK'sı (Firebase vb.), konum, kişiler, kamera yok.
claude.ai web sürümünde reklam ve satın alma hiç yoktur (bu belge Android içindir).

## 2. Reklam açık rızası (KVKK m.5, çerez rehberi; GDPR m.6/1-a) — ✅ kodda

- ✅ Reklam SDK'sı (UMP onay isteği, `initialize`, ön yükleme) **açık rıza
  verilene kadar hiç başlamaz**; onaydan önce Google'a veri gitmez
  (`platform/android/index.ts`, `kopru.ts`; test `index.test.ts`
  "izin yokken açılışta hiçbir AdMob çağrısı yapılmaz").
- ✅ İzin ilk "Reklam izle"de sorulur (`ui/ekranlar/reklamIzni.ts`): kısa
  açıklama (veri, alıcı, ülke), aydınlatma metnine bağlantı (rıza metninden
  ayrı), **iki eşit düğme** (İzin ver / İzin verme; kabul öne çıkarılmaz),
  kişiselleştirme için ayrı ve **önceden işaretsiz** kutu. Kapatmak karar
  sayılmaz.
- ✅ Kişiselleştirme izni yoksa her istek `npa` (kişiselleştirilmemiş reklam).
- ✅ Geri alma her an: Ayarlar > Reklam izni (geri alınca SDK yeni reklam
  yüklemez). Karar ve tarihi cihazda ispat için saklanır (`fitil.reklam-izni`).
- ✅ İzin vermeyen oyuncu oyunun tamamını oynar (can zamanla dolar, satın alma
  isteğe bağlı). Rıza bir hizmetin ön şartı yapılmadı.
- ✅ AEA/Birleşik Krallık/İsviçre'de Google UMP formu ayrıca gösterilir
  (rızamızdan sonra); Ayarlar'da "Reklam gizlilik seçenekleri" satırı.

## 3. KVKK

- ✅ **Aydınlatma metni** (m.10): `docs/gizlilik.html` Türkçe bölümü; veri
  sorumlusu, amaçlar, hukuki sebepler, alıcılar ve yurt dışı, toplama yöntemi,
  saklama, m.11 hakları, başvuru yolu. Uygulamada Ayarlar > Hakkında >
  Gizlilik politikası ve rıza kartındaki bağlantı.
- 👤 Yer tutucular: veri sorumlusunun **adı/unvanı, posta adresi, e-postası,
  yürürlük tarihi** (`[DOLDUR: …]`, `iletisim@ornek.com`). Yayın derlemesi bunlar
  kalırsa durur (`android/app/build.gradle`).
- ❗ **Yurt dışına aktarım (m.9) — doğrulandı, karar bekliyor** (`YASAL-DOGRULAMA.md`
  D1–D10, S1–S3): Kurul hiçbir ülke için yeterlilik kararı vermedi; açık rıza
  yalnız *arızi* aktarımda dayanak; düzenli aktarım için standart sözleşme +
  imzadan sonra 5 iş günü içinde Kurul'a bildirim (bildirmeme cezası 50.000 –
  1.000.000 TL, 2024 tutarı). Google AdMob'da bağımsız veri sorumlusu ve
  şartlarında KVKK standart sözleşmesi yok. Kanun kapsamında oyuncunun ülkesine
  göre sınır yok; yalnız Türk oyunculara reklamı kapatmak soruyu kesin çözmez.
  Kesin çözüm: AdMob'u hiç kullanmamak ya da avukatın S1–S3'e yazılı görüşü.
  **Ürün sahibinin kararı (7 Kasım 2026): reklamlı, avukat onayıyla.** ⚖️ Yayından
  önce avukat S1–S3'ü yazılı yanıtlar; `docs/gizlilik.html` §5'teki
  `[DOLDUR: avukatın yazılı görüşüne göre aktarım dayanağı …]` onunla doldurulur
  (doldurulmadan yayın derlemesi durur). Avukat standart sözleşme derse:
  Google'ın imzalayıp imzalamayacağı sorulur; imza olmazsa reklam çıkarılır.
- ✅ **Kayıt yedeği (sunucusuz, Kasım 2026):** ilerleme yalnız cihazda; oyun
  silinince gider. Ayarlar > Kayıt > Dışa aktar: kayıt kodu + **Paylaş**
  (Android paylaş penceresi, `platform/paylas.ts`) / Kopyala. 10/20/30/40.
  bölümün ilk kazancından sonra bir kez "Kaydını yedekle" kartı
  (`app/yedek.ts`, `ui/ekranlar/yedek.ts`). Kod yalnız oyuncunun seçtiği
  uygulamaya geçer; oyun ağ isteği yapmaz (politika §3'te yazılı). Kalıcı
  satın alma (Usta Kartı) Google Play'den geri yüklenir; tüketilen ürün
  stoku (can, güçlendirici) kodla taşınmaz (kötüye kullanım koruması,
  `kayitKoduGelirKoru`) ve uygulama silinince gider.
- ⚖️ **Android Otomatik Yedekleme (açılmadı):** açılırsa oyun verisi
  oyuncunun kendi Google Drive hesabına yedeklenir (biz görmeyiz). Yurt dışı
  aktarım sayılıp sayılmadığı avukata soruldu (`avukat-ozet.html`, SORULAR
  §1 soru 9). Sunucu (Contabo) şimdilik yok: Türkiye'de veri merkezi yok,
  yurt dışı aktarım sorusu doğar.
- ✅ **VERBİS** (doğrulandı, D13): Kurul 2025/1572 — yıllık çalışan < 50 ve
  yıllık mali bilanço < 100 milyon TL, ana faaliyeti özel nitelikli veri
  işlemek olmayan veri sorumluları kayıttan istisna; bilanço esasına göre
  defter tutmayanlarda yalnız çalışan sayısı esas alınır. İstisna, Kanun'un
  öteki yükümlülüklerinden muafiyet değildir.
- ✅ **Veri ihlali:** sunucu ve kullanıcı veritabanı olmadığı için ihlal alanı
  çok dar. Yine de bir ihlal öğrenilirse KVKK'ya **72 saat** içinde, ilgililere
  makul sürede bildirilir (👤 süreç sende).
- ✅ **Başvuru yanıtı:** en geç 30 gün, ücretsiz (politika §7). 👤 e-posta
  kutusunu düzenli kontrol et.

## 4. Google Play politikaları

- ✅ Gizlilik politikası uygulama içinde ve 👤 herkese açık bir adreste
  (giriş gerektirmeyen, kalıcı URL; Play Console > Uygulama içeriği).
- ✅ **Veri güvenliği formu:** `PLAY-KONSOL.md` §10.6. Reklam verileri
  "toplanıyor, **isteğe bağlı**" (oyuncu izin vermezse hiç toplanmaz).
- ✅ **Reklam politikası:** yalnız ödüllü, yalnız istekle; araya giren, kapatılamayan
  ya da oyunu kesen reklam yok; ödül açıkça yazılı.
- ✅ **Hedef kitle 13+** (`PLAY-KONSOL.md` §10.4); `tagForChildDirectedTreatment:
  false`, en çok PG içerik. ⚖️/❓ Google "çocuklara da hitap ediyor" derse ya
  Aileler politikasına geçilir ya da mağaza görselleri yetişkin/aileye
  netleştirilir.
- ✅ **Ganimet kutusu yok:** sandıklar parayla satılmaz; satılan her ürünün
  içeriği sabit ve yazılı (IARC "rastgele öğe satın alma: Hayır").
- ✅ **Uygulama içi satın alma** yalnız Google Play Faturalandırma ile;
  fiyatlar mağazadan, vergi dahil yerel para biriminde.
- ✅ Hesap yok → hesap silme zorunluluğu yok (`PLAY-KONSOL.md` §10.3).
- 👤 **Geliştirici bilgileri görünürlüğü** (doğrulandı, D12): Play yasal
  adını, ülkeni ve geliştirici e-postanı gösterir; **para kazanıyorsan tam
  adresini** gösterir; bazı bölgelerde telefon da. Ad ve adres Google
  Payments profilinden alınır ve doğrulanır. Ev adresinin görünmesini
  istemiyorsan bir iş adresi gerekir (⚖️ şirket/şahıs işletmesi).
- 👤 Ödeme profili ve satıcı hesabında gerçek kimlik, vergi bilgisi.

## 5. AB / Birleşik Krallık (GDPR, UK GDPR)

- ✅ Rıza (§2) + Google UMP; İngilizce politika GDPR haklarını sayar.
- ⚖️ **AB temsilcisi (GDPR m.27):** AB dışındaki veri sorumlusu AB'deki
  kişilere hizmet sunuyorsa temsilci atar; işleme "arızi ve düşük riskli"
  ise muafiyet var. Fitil kendisi veri işlemez, yalnız Google SDK'sı rızayla
  işler; muafiyet savunulabilir ama avukata sor. Birleşik Krallık için aynı.

## 6. ABD

- ✅ **COPPA:** 13 yaş altına yönelik değil; çocuk verisi toplanmaz.
- ✅ **Eyalet gizlilik yasaları (CCPA/CPRA vb.):** eşiklerin (ör. yıllık
  25 milyon $ gelir) çok altındasın; yine de 👤 AdMob > Gizlilik ve
  mesajlaşma > **ABD eyalet düzenlemeleri** mesajını aç; politika "satmıyoruz"
  der.

## 7. Türk tüketici ve ticaret mevzuatı

- ✅ Ürün içerikleri, fiyatlar (mağazadan, vergi dahil) ve "bir kez" bilgisi
  satın almadan önce görünür; satın alma Google Play ekranında onaylanır.
- ⚖️ **Mesafeli sözleşmeler:** anında ifa edilen dijital içerikte cayma hakkı
  istisnası var; iade süreçlerini Google Play yürütür. Avukat, Google'ın
  Türkiye'de satıcı (merchant of record) olup olmadığını ve sana kalan
  bilgilendirme yükümlülüğünü teyit etsin.
- ⚖️ **ETBİS (Elektronik Ticaret Bilgi Sistemi):** platform üzerinden satış
  yapanın kayıt yükümlülüğünü mali müşavir teyit etsin.

## 8. Vergi (Türkiye)

- ⚖️ **GVK mükerrer 20/B:** mobil uygulama geliştiricilerinin uygulama
  mağazası kazancı için istisna var. Şartları (ayrı banka hesabı, istisna
  belgesi, stopaj, sınır) her yıl güncellenir; **başlamadan önce mali
  müşavirle** kur. Reklam (AdMob) gelirinin bu istisnaya girip girmediğini
  de sor.
- 👤 Google ödemelerinin geleceği banka hesabı ve vergi formları (Play ve
  AdMob ödeme profilleri).

## 9. Fikri mülkiyet

- ✅ Yazı tipi Nunito (SIL OFL; Hakkında'da yazılı). Görseller ve sesler oyun
  kodunda üretilir; üçüncü taraf görsel/ses yok.
- 👤 "Fitil" adı ve logo için TÜRKPATENT'te marka araştırması (çakışan kayıt
  varsa sonradan ad değişikliği gerekebilir) ⚖️.

## 10. Yayından önce son kontrol (👤)

1. `docs/gizlilik.html` yer tutucuları dolduruldu, sayfa herkese açık adreste.
2. Play Console: gizlilik URL'si, Veri güvenliği formu, hedef kitle 13+,
   IARC anketi, reklam beyanı, DSA satıcı beyanı, ödeme profili.
3. AdMob: GDPR mesajı (AEA/UK/CH) ve ABD eyalet mesajı yayımlandı;
   uygulama mağazaya bağlandı.
4. ⚖️ Avukat: yurt dışı aktarım yolu (standart sözleşme ya da Türkiye'de
   reklam kapalı), AB temsilcisi, mesafeli satış.
5. ⚖️ Mali müşavir: 20/B istisnası ya da şahıs şirketi, ETBİS.
6. Telefonda: ilk "Reklam izle" → izin kartı; "İzin verme" → reklam yok, oyun
   sürer; Ayarlar > Reklam izni ile aç/kapat.
