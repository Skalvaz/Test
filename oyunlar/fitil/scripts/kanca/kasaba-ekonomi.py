"""Kasaba ekonomisi simülasyonu (docs/KANCALAR.md §B.4). python3 scripts/kanca/kasaba-ekonomi.py

Oyuncu profilleri: ilk kazançta ortalama yıldız, mühür oranı (ilk kazançta ve
sonradan tekrarla), günlük 3/3 görev sıklığı, Usta bölümleri. Bölüm bölüm
ilerlerken kandil birikir; oyuncu açık ve karşılanabilir en ucuz işi hemen
yapar (açgözlü; mahalle içinde ucuzdan pahalıya, taç en son). MALIYET
`src/app/katalog.ts` KASABA_ISLERI ile aynı tutulmalı.
Çıktı: bölüm başına kandil, yapılan iş, bekleyen işin açığı.
"""
import random, statistics

MALIYET = {
    0: [1, 2, 2, 2, 3, 4],
    1: [2, 2, 3, 3, 4, 4],
    2: [2, 3, 3, 4, 4, 4],
    3: [3, 3, 3, 4, 4, 5],
    4: [3, 3, 4, 4, 5, 5],
    5: [3, 4, 4, 5, 5, 5],
    6: [4, 4, 5, 5, 5, 5],
    7: [4, 5, 5, 6, 6, 8],
}
KANDIL_YILDIZ = 1
KANDIL_MUHUR = 1
KANDIL_MAHALLE = 3
KANDIL_GUNLUK = 1
KASABA_ACILIS = 3
BOLUM_GUN = 5  # günde ~5 bölüm

PROFIL = {
    # ad: (ilk kazanç yıldız ort., ilk kazançta mühür olasılıkları [ç,k,u], sonradan tekrar oranı (bölüm başına), günlük 3/3 olasılığı, Usta ★/bölüm)
    'gundelik': (1.7, [0.55, 0.15, 0.03], 0.15, 0.3, 0.7),
    'tipik':    (2.0, [0.78, 0.40, 0.12], 0.4, 0.5, 1.2),
    'usta':     (2.5, [0.90, 0.55, 0.20], 0.6, 0.7, 2.0),
}


def simule(profil, tohum, ayrinti=False):
    yo, mo, tekrar, gunluk, usta_y = PROFIL[profil]
    r = random.Random(tohum)
    yildiz = [0] * 41
    muhur = [[False] * 3 for _ in range(41)]
    usta = [0] * 9
    gunluk_kandil = 0
    yapilan = {m: 0 for m in range(8)}
    harcanan = 0
    satirlar = []
    is_bolumleri = []  # iş yapılan bölüm indeksleri
    tamam_bolum = {}

    def kazanilan():
        m = sum(1 for i in range(6, 41) for b in muhur[i] if b)
        mah = sum(1 for k in range(8) if all(yildiz[5 * k + j + 1] > 0 for j in range(5)))
        return sum(yildiz) + sum(usta) + m * KANDIL_MUHUR + mah * KANDIL_MAHALLE + gunluk_kandil

    def yap(n):
        nonlocal harcanan
        yapildi = 0
        if n < KASABA_ACILIS:
            return 0, None
        while True:
            # Haritada açık en yüksek bölüm n+1'in mahallesi.
            acik_mahalle = min(7, (min(40, n + 1) - 1) // 5)
            aday = None
            # Sıralı kasaba: en alttaki bitmemiş mahalle; haritada açık olmalı.
            m = next((x for x in range(8) if yapilan[x] < 6), None)
            if m is not None and m <= acik_mahalle:
                aday = (m, MALIYET[m][yapilan[m]])
            if aday is None:
                return yapildi, None
            bakiye = kazanilan() - harcanan
            if bakiye >= aday[1]:
                yapilan[aday[0]] += 1
                harcanan += aday[1]
                yapildi += 1
                if yapilan[aday[0]] == 6:
                    tamam_bolum[aday[0]] = n
            else:
                return yapildi, aday[1] - bakiye

    for n in range(1, 41):
        # n. bölümün ilk kazancı
        if n <= 3:
            y = r.choices([1, 2, 3], [0.15, 0.6, 0.25])[0]
        else:
            base = yo
            p3 = max(0.0, min(1.0, (base - 1.5) * 0.5))
            p1 = max(0.0, min(1.0, (2.5 - base) * 0.5))
            y = r.choices([1, 2, 3], [p1, 1 - p1 - p3, p3])[0]
        yildiz[n] = y
        if n >= 6:
            for i in range(3):
                if r.random() < mo[i]:
                    muhur[n][i] = True
        # sonradan tekrar: önceki bölümlerden birinde yıldız/mühür artışı
        if r.random() < tekrar and n > 1:
            j = r.randint(max(1, n - 10), n - 1)
            if yildiz[j] < 3 and r.random() < 0.6:
                yildiz[j] += 1
            elif j >= 6:
                eksik = [i for i in range(3) if not muhur[j][i]]
                if eksik:
                    muhur[j][eksik[0]] = True
        # Usta bölümleri: her 15★'da bir açılır, açıldığında oynanır
        ana = sum(yildiz)
        for u in range(1, 9):
            if ana >= 15 * u and usta[u] == 0 and r.random() < 0.8:
                usta[u] = max(1, min(3, round(usta_y + r.uniform(-0.5, 0.5))))
        # günlük: her BOLUM_GUN bölümde bir gün (10'dan sonra)
        if n > 10 and n % BOLUM_GUN == 0 and r.random() < gunluk:
            gunluk_kandil += KANDIL_GUNLUK
        yap_sayi, acik = yap(n)
        if yap_sayi:
            is_bolumleri.append(n)
        satirlar.append((n, kazanilan(), harcanan, sum(yapilan.values()), acik, yap_sayi))
    return satirlar, is_bolumleri, kazanilan(), harcanan, yapilan, tamam_bolum


def ozet(profil, n=400):
    tum = [simule(profil, t) for t in range(n)]
    print(f'\n=== {profil} ===')
    print('bölüm | kazanılan kandil (ort) | yapılan iş (ort) | bekleyen açık ort (kandil) | o bölümde iş yapan %')
    for i in range(40):
        kaz = statistics.mean(s[0][i][1] for s in tum)
        isler = statistics.mean(s[0][i][3] for s in tum)
        aciklar = [s[0][i][4] for s in tum if s[0][i][4] is not None]
        acik = statistics.mean(aciklar) if aciklar else 0
        yapan = 100 * sum(1 for s in tum if s[0][i][5] > 0) / len(tum)
        bitmis = 100 * sum(1 for s in tum if s[0][i][4] is None) / len(tum)
        if (i + 1) % 5 == 0 or i < 5:
            print(f'{i+1:3d} | {kaz:6.1f} | {isler:5.1f} | {acik:4.1f} (hiç bekleyen yok %{bitmis:.0f}) | {yapan:4.0f}%')
    # iş aralığı
    aralik = []
    for s in tum:
        b = s[1]
        for a, c in zip(b, b[1:]):
            aralik.append(c - a)
    print('iş yapılan bölümler arası ortalama:', round(statistics.mean(aralik), 2), ' p90:', sorted(aralik)[int(0.9 * len(aralik))])
    for m in range(8):
        t = [s[5][m] for s in tum if m in s[5]]
        print(f'  mahalle {m}: 6/6 olan %{100*len(t)/len(tum):.0f}, medyan bölüm {statistics.median(t) if t else "-"}')
    print('40. bölümde: kazanılan', round(statistics.mean(s[2] for s in tum), 1), 'harcanan', round(statistics.mean(s[3] for s in tum), 1), 'iş', round(statistics.mean(sum(s[4].values()) for s in tum), 1), '/ 48')


toplam = sum(sum(v) for v in MALIYET.values())
print('Toplam maliyet:', toplam, {m: sum(v) for m, v in MALIYET.items()})
print('Tavan kandil (günlük hariç): 120 + 24 + 105 + 24 =', 120 + 24 + 105 + 24)
for p in PROFIL:
    ozet(p)
