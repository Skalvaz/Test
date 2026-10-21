def yama(p, eski, yeni, n=1):
    s=open(p,encoding='utf-8').read()
    assert s.count(eski)==n,(p,eski[:60],s.count(eski))
    open(p,'w',encoding='utf-8').write(s.replace(eski,yeni))
# ikon
yama('src/ui/ikonlar.ts', "  hiz: '<path d=\"M4.6 6 10.6 12l-6 6M12.6 6l6 6-6 6\"/>',",
"  hiz: '<path d=\"M4.6 6 10.6 12l-6 6M12.6 6l6 6-6 6\"/>',\n  dil: '<circle cx=\"12\" cy=\"12\" r=\"8.6\"/><path d=\"M3.4 12h17.2M12 3.4c2.4 2.4 3.4 5.4 3.4 8.6s-1 6.2-3.4 8.6c-2.4-2.4-3.4-5.4-3.4-8.6s1-6.2 3.4-8.6z\"/>',")
# geri çağrım
yama('src/ui/tipler.ts', """  /** Herhangi bir ayar değişti (anında uygula, gecikmeli kaydet). */
  ayarDegisti(d: AyarDegisikligi): void;""", """  /** Herhangi bir ayar değişti (anında uygula, gecikmeli kaydet). */
  ayarDegisti(d: AyarDegisikligi): void;
  /** Ayarlar > Dil: seçim cihaza yazılır, kayıt hemen yazılır, sayfa yeniden yüklenir. */
  dilDegisti?(d: Dil): void;""")
s=open('src/ui/tipler.ts',encoding='utf-8').read()
i=s.index('\nimport ')
s=s[:i]+"\nimport type { Dil } from '../platform/dil';"+s[i:]
open('src/ui/tipler.ts','w',encoding='utf-8').write(s)
# ayarlar ekranı
p='src/ui/ekranlar/ayarlar.ts'
yama(p, "import type { AyarDegisikligi, AyarlarVM, MolaDakika, Palet } from '../tipler';",
"import type { AyarDegisikligi, AyarlarVM, MolaDakika, Palet } from '../tipler';\nimport { DIL, DILLER, type Dil } from '../../platform/dil';")
yama(p, """  /** Palet/hareket önizlemesini Arayuz'a anında uygula. */
  yerelUygula?: (d: AyarDegisikligi) => void;
}""", """  /** Palet/hareket önizlemesini Arayuz'a anında uygula. */
  yerelUygula?: (d: AyarDegisikligi) => void;
  /** Dil seçildi (uygulama sayfayı o dille yeniden açar). */
  dilDegisti?: (d: Dil) => void;
}

/** Dil adları kendi dillerinde (oyuncu kendi dilini tanısın). */
const DIL_ADLARI: Record<Dil, string> = { tr: 'Türkçe', en: 'English' };""")
yama(p, """    h('h3', { s: 'f-etiket', t: M.gorunum }),
    satir(M.hareketiAzalt,""", """    h('h3', { s: 'f-etiket', t: M.gorunum }),
    h(
      'div',
      { s: 'f-satir f-satir-dikey' },
      h('span', { s: 'f-satir-ust' }, h('span', { s: 'f-satir-ikon' }, ikon('dil')), h('span', { s: 'f-satir-etiket', t: M.dil })),
      parcali(
        DILLER.map((x) => ({ d: x, ad: DIL_ADLARI[x] })),
        DIL,
        M.dil,
        (v) => {
          if (v !== DIL) ek.dilDegisti?.(v);
        },
      ),
    ),
    satir(M.hareketiAzalt,""")
# metinler: dil anahtarı
yama('src/ui/metinler.ts', "  gorunum: 'Görünüm',", "  gorunum: 'Görünüm',\n  dil: 'Dil',")
# arayuz: geçir
yama('src/ui/arayuz.ts', """        defterKartiAc: ek.defterKartiAc ?? ((m, tur) => void this.defterKarti({ mahalle: m, oduller: [], tur })),
        yerelUygula,""", """        defterKartiAc: ek.defterKartiAc ?? ((m, tur) => void this.defterKarti({ mahalle: m, oduller: [], tur })),
        yerelUygula,
        dilDegisti: (d) => this.b.geri.dilDegisti?.(d),""")
# uygulama: dil değişince
yama('src/app/uygulama.ts', """      ayarDegisti: (d) => this.ayarDegisti(d),""", """      ayarDegisti: (d) => this.ayarDegisti(d),
      dilDegisti: (d) => {
        // Bütün metin tabloları sayfa açılırken kurulur: kaydı hemen yaz, seçimi cihaza yaz, yeniden yükle.
        this.kayitci.hemenYaz();
        dilKaydet(d);
        try {
          window.location.reload();
        } catch {
          /* yeniden yükleme engelli: seçim bir sonraki açılışta geçerli */
        }
      },""")
s=open('src/app/uygulama.ts',encoding='utf-8').read()
i=s.index('\nimport ')
s=s[:i]+"\nimport { dilKaydet } from '../platform/dil';"+s[i:]
open('src/app/uygulama.ts','w',encoding='utf-8').write(s)
# main: html lang
yama('src/main.ts', "import { Uygulama, type SicakVeri } from './app/uygulama';", "import { Uygulama, type SicakVeri } from './app/uygulama';\nimport { DIL } from './platform/dil';")
yama('src/main.ts', "window.__fitilAcildi = true;", "window.__fitilAcildi = true;\n// Dil: CSS büyük harfi (i → İ / I) ve ekran okuyucu için.\ndocument.documentElement.lang = DIL;")
