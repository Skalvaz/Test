# FİTİL — Yayın ve gelir planı (Ekim 2026)

Ürün sahibinin kararları (22 Ekim 2026):

- **Odak:** asıl ürün FİTİL. EBRULİ ikinci oyun; FİTİL'de öğrenilen dersler
  (ölçüm, ilk dakikalar, can/reklam akışları) sonra EBRULİ'ye uygulanır.
- **Yayın:** Android uygulaması (Google Play; geliştirici üyeliği var).
  claude.ai sayfası ve tek dosya `fitil.html` aile/test sürümü olarak kalır
  (reklam ve satın alma yok; ağ isteği yok).
- **Gelir modeli:** can sistemi + ödüllü reklam (AdMob) + küçük satın alma
  (Google Play Billing).

## İlkeler (GDD §11'in güncel hâli)

Can ve reklam gelir, ama oyuncuyu yıpratan desenler yine yasak:

- Sahte kıtlık, süreli FOMO ("1 saat kaldı!"), bildirim baskısı, gizli dinamik
  zorluk (kaybettikçe zorlaşan/satış için ayarlanan bölüm), şans kutusu satışı,
  çocuklara yönelik satış baskısı YOK.
- Zorunlu ara reklam YOK; reklam yalnız oyuncu bir ödül için isteyince.
- Satın almadan ve reklam izlemeden de bütün bölümler bitirilebilir; kasaba
  kandille (oyunla) kazanılır.
- Öğretim ve İskele (1–5) can harcamaz; kazanılan bölüm can harcamaz.

## Aşamalar

1. **Ölçüm + ilk dakikalar** (şimdi). Kişisel veri toplamayan olay katmanı
   (`src/platform/olcum.ts`, sözlük `docs/OLCUM.md`); ilk oturumun (bölüm
   1–10) denetimi ve sadeleştirilmesi. Hedef göstergeler: ilk oturumda bölüm
   5'e varma oranı, öğretimi bitirme, D1 ≥ %40, D7 ≥ %15, bölüm başına kayıp
   oranı ve terk noktası.
2. **Can + ödüllü reklam + satın alma akışları** (web derlemesinde sahte
   sağlayıcıyla; Android'de gerçek). Taslak: 5 can, 30 dk'da 1 dolar; kayıpta
   (ve bölümü yarıda bırakınca) 1 can gider; can bitince bekle / reklamla 1
   can (günde sınırlı) / satın alma. Kaybedince "+5 hamle" reklamla (bölüm
   başına bir kez; bugünkü ücretsiz Usta'nın Eli'yle ilişkisi o aşamada
   kararlaştırılır). Satın almalar (küçük): canları doldur, güçlendirici
   paketi, "Usta kartı" (ödüllü reklamların ödülünü reklamsız verir).
   **Durum (Ekim 2026): uygulandı, sahte sağlayıcıyla denendi.** Şartname
   ve kararlar `docs/CAN-REKLAM.md` (Usta'nın Eli sunuluyorsa reklam
   teklifi yok; reklamla +5 hamle Eli kurallarıyla). Web'de deneme:
   `?gelir=sahte` (ya da cihazda `localStorage` `fitil.gelir` = `sahte`;
   `?reklam=hizli|yok|hata`, `?satin=iptal|hata`, `?gelir=yok`); oynanış
   testi `npm run oynanis -- <url> <klasör> gelir`. Sağlayıcı yokken
   (claude.ai, `fitil.html`) can, reklam ve Mağaza görünmez. Aşama 3'ün
   işi: `window.FitilYerel.gelir` köprüsü (CAN-REKLAM §5.1), gerçek
   fiyatlar Play Console'dan.
3. **Android paketleme:** Capacitor sarmalayıcı (aynı web kodu), AdMob +
   UMP (KVKK/GDPR onayı), Play Billing, Firebase Analytics (ölçüm katmanının
   Android ucu), gizlilik politikası sayfası, uygulama simgesi ve mağaza
   görselleri, yaş derecelendirmesi.
4. **Kapalı test** (Play Console iç/kapalı test kanalı: aile, tanıdıklar) →
   göstergelere bak → düzelt → açık test → yayın.
5. **EBRULİ:** aynı katmanlar (ölçüm, can/reklam) + içerik (60+ bölüm,
   ilerleme sistemi) + Android.

## Aşama 1 denetimi: ilk oturum (22 Ekim 2026)

`scripts/ilk-dakikalar.mjs` (390×844, Türkçe, yeni kayıt; Acemi bot ilk
denemede 1–10'un hepsini kazandı). Gerçek süre tahmini hamle başına 4 sn
düşünme + 2 kelime/sn okumayla:

- Bölüm 5'e ~6 dk, bölüm 10'a ~22 dk (164 hamle). İlk oturumda bölüm 5
  hedefi rahat.
- Araya giren 42 öğe (13 Usta balonu, 22 modal/ekran, 5 bant, 2 harita
  balonu), ~630 okunacak kelime; her bölüm iki dokunuş (Kazandın "Devam",
  bölüm kartı "Oyna").
- Oyun kavramları GDD §15'e uygun: bölüm başına bir kavram, balonlar kısa.
- Yük bölüm 5–10'da: meta sistemler üst üste geliyor — kandil + Kasaba (3),
  sandık + defter kartı (5, 47 kelimelik kart), Kibrit + hediye + mühürler
  (6), mühür anlatımı (7, 27 kelime), Usta Bölümü (8), Günün Şenliği (10).
- Düzeltildi: 6. bölüm Kazandın'da hiç mühür basılmadıysa açıklamasız üç boş
  mühür (Ç K U) gösterilmiyor; mühürleri 7. bölüm kartı anlatır.
- Yapıldı (22 Ekim 2026, ürün sahibi onayı): meta tanıtımları yayıldı — Usta
  Bölümleri 12. bölüm kazanılınca (yıldız eşiğiyle birlikte), Günün Şenliği
  14. bölümden sonra; günlük geçmişi olan ya da Usta oynamış eski kayıtta
  açık kalır (GDD K25, §10.2, §10.5).
- Kullanıcı kararı bekleyen: claude.ai sürümünde ölçüm özetini (kişisel veri
  yok) bulut kaydının yanına yazıp aile testinden huniyi görmek.

