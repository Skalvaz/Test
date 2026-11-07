# Yasal doğrulama — birincil kaynaklardan (7 Kasım 2026)

Her satır kaynağın kendisinden okundu (indirilen metin içinde arandı). "Kaynakta
yok" yazan yerde tahmin yürütülmedi. Erişilemeyen siteler: mevzuat.gov.tr,
resmigazete.gov.tr, etbis.ticaret.gov.tr (bağlantı kurulamadı); kanun metni
KVKK'nın kendi yayınlarından okundu.

## Doğrulanan bilgiler

| # | Bilgi | Kaynak (birincil) |
|---|---|---|
| D1 | KVKK m.9 7499 sayılı Kanunla değişti; değişiklik 01.06.2024'te yürürlüğe girdi. | kvkk.gov.tr, Yurt Dışına Aktarım sayfası (Icerik/2053) |
| D2 | Yurt dışı aktarım sırası: (1) Kurulun yeterlilik kararı, (2) uygun güvence (standart sözleşme, bağlayıcı şirket kuralları, taahhütname, kamu anlaşması), (3) ikisi de yoksa yalnız **arızi** haller. | Aynı sayfa |
| D3 | **Kurul hiçbir ülke için yeterlilik kararı vermemiştir** ("Bu konuda Kurul tarafından henüz bir belirleme yapılmamıştır"). | Aynı sayfa |
| D4 | Açık rıza (m.9/6-a) **yalnız arızi aktarımda** dayanak olabilir; istisnalar "arızi, düzenli olmayan, süreklilik göstermeyen ve nadiren gerçekleşen" aktarımlar için geçerlidir ve dar yorumlanır. | Aynı sayfa |
| D5 | Standart sözleşme imzalanınca ek izin gerekmez; sözleşme **imzaların tamamlanmasından itibaren beş iş günü içinde Kurum'a bildirilir**. Sözleşmeye ekleme, çıkarma, değişiklik yapılamaz. Dört tür vardır; veri sorumlusundan veri sorumlusuna olanı "Standart Sözleşme-1". | Standart Sözleşme-1 metni (kvkk.gov.tr Icerik/7930), m.2 ve m.15; Kurul kararı 04.06.2024, 2024/959 |
| D6 | Bildirim yükümlülüğünü (m.9/5) yerine getirmeyene **50.000 TL – 1.000.000 TL** idari para cezası (m.18/1-d; 2024 tutarı). | KVKK yayını "Kanunda yapılan değişiklikler, Sayı 4" (CMSFiles/4eba766b…) |
| D7 | Yönetmelik: Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik, RG 10.07.2024, sayı 32598. | Standart Sözleşme-1, m.1 |
| D8 | KVKK, kişisel veriyi işleyen gerçek ve tüzel kişilere uygulanır; kapsam maddesinde **oyuncunun ülkesine göre bir sınır yoktur**. | KVKK yayını "Kişisel Verilerin Korunması Kanunu ve Uygulaması", "Kanunun Kapsamı" |
| D9 | Google, **AdMob'u "Controller Service"** olarak sayar (Google bağımsız veri sorumlusu; yalnız Secure Signals ve sunucu tarafı gösterim geliri özellikleri işleyen). | business.safety.google/adsservices |
| D10 | Google Ads Controller-Controller Data Protection Terms metninde **"Turkey", "Türkiye", "KVKK", "6698" geçmez**; tanımlı mevzuat GDPR, Swiss FDPA, UK GDPR, LGPD, ABD eyalet yasalarıdır. | business.safety.google/adscontrollerterms (tam metin arandı) |
| D11 | Google Mobile Ads SDK **otomatik olarak** IP adresi, kullanıcı ürün etkileşimleri, tanılama bilgisi, cihaz/hesap kimlikleri toplar ve paylaşır (reklam, analiz, sahtekârlık önleme). Reklam kimliği toplanması manifestle kapatılabilir. (Sayfa 05.11.2026'da güncellenmiş.) | developers.google.com/admob/android/privacy/play-data-disclosure |
| D12 | Play, geliştiricinin **yasal adını, ülkesini ve geliştirici e-postasını** gösterir; **para kazanan geliştiricinin tam adresini** gösterir. Bazı bölgelerde telefon da gösterilebilir. E-posta ve telefon tek kullanımlık kodla doğrulanır. | support.google.com/googleplay/android-developer/answer/13628312 |
| D13 | VERBİS istisnası (Kurul 04.09.2025, 2025/1572): yıllık çalışan < 50 ve yıllık mali bilanço < 100 milyon TL olan, ana faaliyeti özel nitelikli veri işlemek olmayanlar kayıttan istisnadır; **bilanço esasına göre defter tutmayanlarda yalnız çalışan sayısı** esas alınır. İstisna, Kanun'un diğer hükümlerinden muafiyet değildir. | kvkk.gov.tr Icerik/8577 |

## Kaynakta cevabı olmayan sorular (avukata sorulacak, tahmin yürütülmedi)

| # | Soru | Neden metinde cevap yok |
|---|---|---|
| S1 | Uygulamaya gömülü AdMob SDK'sının topladığı veride **yurt dışına aktarımı yapan geliştirici midir**, yoksa veriyi doğrudan toplayan Google mu? | D9'a göre Google bağımsız veri sorumlusu; Kanun ve rehber SDK durumunu özel olarak düzenlemiyor. |
| S2 | S1'in cevabı "geliştirici" ise: Google, KVKK Standart Sözleşme-1'i imzalar mı? | D10: Google'ın şartlarında KVKK hükmü yok; sözleşme metni değiştirilemez (D5). |
| S3 | Türkiye'de yerleşik geliştiricinin **yabancı oyuncuların** verisi için de m.9 yükümlülüğü var mı? | D8: kapsamda ülke sınırı yok; uygulaması yorum ister. |
| S4 | Google Play Türkiye satışlarında satıcı (merchant of record) kimdir; mesafeli satış bilgilendirmesi kime düşer? | Okunamadı (Play satış koşulları bu oturumda incelenmedi). |
| S5 | ETBİS kaydı gerekir mi? | etbis.ticaret.gov.tr erişilemedi. |
| S6 | GVK mükerrer 20/B: banka hesabı, kesinti oranı, 2026 beyan sınırı, reklam gelirinin kapsamı. | GİB özelge sayfası metin olarak okunamadı; mali müşavir. |

## Sonuç (yalnız doğrulanmış bilgilerden)

- D3 + D4: Türkiye'den ABD'ye düzenli aktarımda **açık rıza tek başına yeterli
  dayanak değildir**; uygun güvence (standart sözleşme + 5 iş günü bildirim) gerekir.
- D9 + D10: Google'ın AdMob şartlarında KVKK standart sözleşmesi bulunmuyor.
- Bu iki bilgi birlikte: AdMob kullanıldığında S1–S3 avukatın yazılı görüşü
  olmadan kesinleşmez. **AdMob hiç kullanılmazsa** bu soruların hiçbiri doğmaz:
  uygulama cihaz dışına reklam verisi göndermez.
- Önceki `docs/gizlilik.html` §5'teki "aktarımın dayanağı açık rızan" ifadesi
  D4 karşısında yetersizdir; karar verilince düzeltilecek (YASAL-UYUM §3).
