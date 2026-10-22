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
3. **Android paketleme:** Capacitor sarmalayıcı (aynı web kodu), AdMob +
   UMP (KVKK/GDPR onayı), Play Billing, Firebase Analytics (ölçüm katmanının
   Android ucu), gizlilik politikası sayfası, uygulama simgesi ve mağaza
   görselleri, yaş derecelendirmesi.
4. **Kapalı test** (Play Console iç/kapalı test kanalı: aile, tanıdıklar) →
   göstergelere bak → düzelt → açık test → yayın.
5. **EBRULİ:** aynı katmanlar (ölçüm, can/reklam) + içerik (60+ bölüm,
   ilerleme sistemi) + Android.
