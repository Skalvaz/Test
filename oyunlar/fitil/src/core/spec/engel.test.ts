/**
 * §5 engeller ve çevre öğeleri: fener çıkışı, kaya katları, dev fişek,
 * is (temizleme/yayılma), barut izi, döşeme, desen, meltem, çisenti.
 * (Vuruş tablosunun satır satır sınaması: vurus.test.ts.)
 */
import { describe, expect, it } from 'vitest';
import type { HavaOlayiVerisi } from '../index';
import { cift, fitil, hucreAt, hucrede, ic, kur, patlamaAt, patlamaHaritasi, sec, uygula } from './kur';

const UC = '0,5 1,5 2,5';
const ULASILMAZ = { tur: 'puan', puan: 999999 } as const;

describe('§5 fener çıkışı', () => {
  it('§5 fener sütunun deliksiz en alt hücresine ulaşınca toplanır (+hedef)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. F . . .', 'R R R . .'], hedefler: [{ tur: 'fener', adet: 2 }] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(sec(olaylar, 'fenerToplandi')).toMatchObject([{ hucre: { x: 1, y: 5 } }]);
    expect(durum.hucreler.some((c) => c.icerik?.tur === 'fener')).toBe(false);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2, tamam: false });
  });

  it('§5 cikislar: çıkış olmayan sütunda fener en alta inse de toplanmaz', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. F . . .', 'R R R . .'], cikislar: [0] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(sec(olaylar, 'fenerToplandi')).toEqual([]);
    expect(ic(durum, 1, 5)).toEqual({ tur: 'fener' });
  });

  it('§5 çıkış yuvası deliksiz en alt hücredir (altta delik varsa bir üstü)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. F . . .', 'R R R . .', '. # . . .'] });
    const { olaylar } = uygula(d, fitil('0,4 1,4 2,4'));
    expect(sec(olaylar, 'fenerToplandi')).toMatchObject([{ hucre: { x: 1, y: 4 } }]);
  });

  it('§5 çıkış yuvasında sabit engel varsa fener engel kalkana dek toplanamaz', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. F . . .', 'R R R . .', '. K3 . . .'] });
    const { olaylar, durum } = uygula(d, fitil('0,4 1,4 2,4'));
    expect(sec(olaylar, 'fenerToplandi')).toEqual([]);
    expect(ic(durum, 1, 4)).toEqual({ tur: 'fener' });
    expect(ic(durum, 1, 5)).toEqual({ tur: 'kaya', kat: 2 });
  });

  it('§3.5.4.2 toplama sonrası yerçekimine dönülür: üst üste iki fener aynı hamlede toplanır', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. F . . .', '. F . . .', 'R R R . .'], hedefler: [{ tur: 'fener', adet: 3 }] });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(sec(olaylar, 'fenerToplandi')).toMatchObject([{ hucre: { x: 1, y: 5 } }, { hucre: { x: 1, y: 5 } }]);
    expect(durum.hedefler[0].ilerleme).toBe(2);
    expect(durum.hucreler.every((c) => c.delik || c.icerik !== null)).toBe(true);
  });
});

describe('§5 kaya', () => {
  it('§5 kaya katları: her bitişik patlama −1 kat; K3 üç patlamada kalkar (+hedef)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R K3 R . .', '. R . . .'], hedefler: [{ tur: 'kaya' }, ULASILMAZ] });
    const { olaylar, durum } = uygula(d, fitil('0,4 1,5 2,4'));
    expect(hucrede(olaylar, 'engelHasar', 1, 4)).toMatchObject([
      { t: 0, engel: 'kaya', kalan: 2 },
      { t: 103, engel: 'kaya', kalan: 1 },
      { t: 199, engel: 'kaya', kalan: 0 },
    ]);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 1, tamam: true });
    expect(durum.hucreler.some((c) => c.icerik?.tur === 'kaya')).toBe(false);
  });
});

describe('§5 dev fişek', () => {
  const DEV = ['. . . . .', '. . . . .', '. . . . .', 'R . . . .', 'R . . . .', 'R D2:1 . . .'];

  it('§5 dev fişek N\'ye ulaşınca t + 150\'de fırlar; üstündeki hücreler t + 150 + 30·(y−y\') VURUŞ alır', () => {
    const { olaylar } = uygula(kur({ tahta: DEV }), fitil('0,5 0,4 0,3'));
    expect(hucrede(olaylar, 'devFisekDoldu', 1, 5)[0]).toMatchObject({ t: 0, dolum: 2, kapasite: 2 });
    expect(hucrede(olaylar, 'devFisekFirladi', 1, 5)).toMatchObject([{ t: 150 }]);
    [180, 210, 240, 270, 300].forEach((t, i) => {
      expect(patlamaAt(olaylar, 1, 4 - i), `(1,${4 - i})`).toMatchObject({ t, neden: 'devFisek', nesil: 0, puan: 15 });
    });
  });

  it('§5 fırlayan dev fişek kalkar ve devFisek hedefini sayar', () => {
    const d = kur({ tahta: DEV, hedefler: [{ tur: 'devFisek', adet: 2 }] });
    const { durum } = uygula(d, fitil('0,5 0,4 0,3'));
    expect(durum.hucreler.some((c) => c.icerik?.tur === 'devFisek')).toBe(false);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
  });

  it('§5 dolum N\'nin altında kalan dev fişek fırlamaz', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', 'R . . . .', 'R . . . .', 'R D3:1 . . .'] });
    const { olaylar, durum } = uygula(d, fitil('0,5 0,4 0,3'));
    expect(sec(olaylar, 'devFisekFirladi')).toEqual([]);
    expect(ic(durum, 1, 5)).toEqual({ tur: 'devFisek', dolum: 2, kapasite: 3 });
  });
});

describe('§5 is', () => {
  it('§5 is yayılması: temizlenmeyen hamlede ise dik komşu düz kapsül ise döner (tek aday)', () => {
    const d = kur({
      tahta: ['R R R . .', '. . . . .', '. . . . .', '. . . . .', '. . . . K3', '. . . G I'],
      hedefler: [{ tur: 'is' }],
    });
    const { olaylar, durum } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(olaylar, 'isYayildi')).toMatchObject([{ hucre: { x: 3, y: 5 } }]);
    expect(ic(durum, 3, 5)).toEqual({ tur: 'is' });
    // §6.8 kalan is yayılmayla artar: gerekli 1 → 2.
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 0, gerekli: 2, tamam: false });
  });

  it('§5 hamlede is temizlendiyse yayılma olmaz', () => {
    const d = kur({
      tahta: ['. . . R I', '. . . R .', '. . R . .', '. . . . .', 'K3 . . . .', 'I G . . .'],
      hedefler: [{ tur: 'is' }],
    });
    const { olaylar, durum } = uygula(d, fitil('2,2 3,1 3,0'));
    expect(hucrede(olaylar, 'isTemizlendi', 4, 0)).toMatchObject([{ t: 199 }]);
    expect(sec(olaylar, 'isYayildi')).toEqual([]);
    expect(ic(durum, 1, 5)).toMatchObject({ tur: 'kapsul', renk: 3 });
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
  });

  it('§5 is yayılması hamle başına en fazla 1 (iki aday → biri)', () => {
    const d = kur({ tahta: ['R R R . .', '. . . . .', '. . . . .', '. . . . .', '. . . . A', '. . . G I'] });
    const { olaylar, durum } = uygula(d, fitil('0,0 1,0 2,0'));
    const y = sec(olaylar, 'isYayildi');
    expect(y).toHaveLength(1);
    expect([
      [3, 5],
      [4, 4],
    ]).toContainEqual([y[0].hucre.x, y[0].hucre.y]);
    expect(durum.hucreler.filter((c) => c.icerik?.tur === 'is')).toHaveLength(2);
  });

  it('§5 is yayılması özel ve kafesli kapsüllere geçmez', () => {
    const d = kur({ tahta: ['R R R . .', '. . . . .', '. . . . .', '. . . . .', '. . . . C:A', '. . . G- I'] });
    const { olaylar } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(olaylar, 'isYayildi')).toEqual([]);
  });
});

describe('§5 barut izi', () => {
  const IZ_ZEMIN = ['. . . . .', '. . . . .', '. . . . .', 'i0 i1 i2 i3 i4', '. . . . .', '. . . . .'];

  it('§5 iz hücresindeki patlama izi o indeksten iki yöne 60 tik/adım yakar, her iz hücresine VURUŞ', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . R . .', '. . R . .', '. . R . .'], zemin: IZ_ZEMIN });
    const { olaylar, durum } = uygula(d, fitil('2,5 2,4 2,3'));
    const m = patlamaHaritasi(olaylar);
    expect(m.get('2,3')).toMatchObject({ t: 199, neden: 'fitil' });
    expect(m.get('1,3')).toMatchObject({ t: 259, neden: 'iz', puan: 15, nesil: 0 });
    expect(m.get('3,3')).toMatchObject({ t: 259, neden: 'iz' });
    expect(m.get('0,3')).toMatchObject({ t: 319, neden: 'iz' });
    expect(m.get('4,3')).toMatchObject({ t: 319, neden: 'iz' });
    expect(hucrede(olaylar, 'izYandi', 1, 3)).toMatchObject([{ t: 259 }]);
    expect(hucrede(olaylar, 'izYandi', 4, 3)).toMatchObject([{ t: 319 }]);
    expect(durum.izler[0].yandi).toEqual([true, true, true, true, true]);
  });

  it('§5 her iz hücresi bir kez yanar (iz patlaması izi yeniden tutuşturmaz)', () => {
    const d = kur({ tahta: ['. . . . .', '. . . . .', '. . . . .', '. . R . .', '. . R . .', '. . R . .'], zemin: IZ_ZEMIN });
    const { olaylar } = uygula(d, fitil('2,5 2,4 2,3'));
    for (let x = 0; x < 5; x++) expect(hucrede(olaylar, 'izYandi', x, 3).length, `(${x},3)`).toBeLessThanOrEqual(1);
    expect(sec(olaylar, 'izYandi').length).toBeGreaterThanOrEqual(4);
  });

  it('§5 iz hücresine gelen vuruş da izi tutuşturur', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . R| . .'],
      zemin: ['. . . . .', '. . i0 i1 i2', '. . . . .', '. . . . .', '. . . . .', '. . . . .'],
    });
    const { olaylar } = uygula(d, cift(2, 5));
    const m = patlamaHaritasi(olaylar);
    expect(m.get('2,1')).toMatchObject({ t: 100, neden: 'vurus' });
    expect(m.get('3,1')).toMatchObject({ t: 160, neden: 'iz' });
    expect(m.get('4,1')).toMatchObject({ t: 220, neden: 'iz' });
  });
});

describe('§5 döşeme ve desen', () => {
  it('§5 döşeme: hücresindeki her kapsül patlaması −1 kat (2 katlı → 1), aydinlat sayar', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R . .'],
      zemin: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '1 2 . . 1'],
      hedefler: [{ tur: 'aydinlat' }],
    });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'dosemeAydinlandi', 0, 5)).toMatchObject([{ t: 0, kalan: 0 }]);
    expect(hucrede(olaylar, 'dosemeAydinlandi', 1, 5)).toMatchObject([{ t: 103, kalan: 1 }]);
    expect(hucreAt(durum, 0, 5).doseme).toBe(0);
    expect(hucreAt(durum, 1, 5).doseme).toBe(1);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 2, gerekli: 4 });
  });

  it('§5 desen: desen renginde patlama hücreyi kalıcı boyar, başka renk boyamaz', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R . .'],
      zemin: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'dR dG . . .'],
      hedefler: [{ tur: 'desen', motif: 'lale' }],
    });
    const { olaylar, durum } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'desenBoyandi', 0, 5)).toMatchObject([{ t: 0, renk: 0 }]);
    expect(hucrede(olaylar, 'desenBoyandi', 1, 5)).toEqual([]);
    expect(hucreAt(durum, 0, 5).desenBoyali).toBe(true);
    expect(hucreAt(durum, 1, 5).desenBoyali).toBe(false);
    expect(durum.hedefler[0]).toMatchObject({ ilerleme: 1, gerekli: 2 });
  });

  it('§3.5.2 desen: yıldız topu patlaması her desen rengini boyar', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R * . .'],
      zemin: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . dG . .'],
    });
    const { olaylar } = uygula(d, fitil(UC));
    expect(hucrede(olaylar, 'desenBoyandi', 2, 5)).toMatchObject([{ t: 199 }]);
  });

  it('§3.5.2 boyalı desen yeniden boyanmaz (ikinci hamlede olay yok)', () => {
    const d = kur({
      tahta: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', 'R R R . .', 'R R R . .'],
      zemin: ['. . . . .', '. . . . .', '. . . . .', '. . . . .', '. . . . .', 'dR . . . .'],
    });
    const bir = uygula(d, fitil(UC));
    expect(hucrede(bir.olaylar, 'desenBoyandi', 0, 5)).toHaveLength(1);
    const iki = uygula(bir.durum, fitil(UC));
    expect(patlamaAt(iki.olaylar, 0, 5)).toBeDefined();
    expect(hucrede(iki.olaylar, 'desenBoyandi', 0, 5)).toEqual([]);
    expect(hucreAt(iki.durum, 0, 5).desenBoyali).toBe(true);
  });
});

describe('§5 hava olayları', () => {
  const meltem = (o: Partial<HavaOlayiVerisi> = {}): HavaOlayiVerisi[] => [
    { tur: 'meltem', eksen: 'satir', hatlar: [5, 2], periyot: 3, baslangic: 1, ...o },
  ];

  it('§5 meltem: hattaki ısınabilir kapsüllere +1, en fazla eşik−1 (tutuşturmaz), kalkan geçerli', () => {
    const d = kur({
      tahta: ['R R R . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', 'G G2 G3 A1 S G'],
      havaOlaylari: meltem(),
    });
    const { olaylar, durum } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(olaylar, 'havaOlayi')).toMatchObject([{ olay: 'meltem', eksen: 'satir', hat: 5, uyari: false }]);
    expect(ic(durum, 0, 5)).toMatchObject({ isi: 1 });
    expect(ic(durum, 1, 5)).toMatchObject({ isi: 3 });
    expect(ic(durum, 2, 5)).toMatchObject({ isi: 3 });
    expect(ic(durum, 3, 5)).toMatchObject({ isi: 1 }); // kovaya dik komşu: kalkan
    expect(ic(durum, 5, 5)).toMatchObject({ isi: 0 }); // kovaya dik komşu: kalkan
    expect(sec(olaylar, 'patlama').filter((p) => p.hucre.y === 5)).toEqual([]);
  });

  it('§5 hava sayacı: 0\'da sıradaki hat tetiklenir, sayaç periyoda döner, hatlar döngüsel ilerler', () => {
    const d = kur({ tahta: ['R R R . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', 'G . . . . .'], havaOlaylari: meltem() });
    const { durum } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(durum.havaOlaylari[0]).toMatchObject({ sayac: 3, sira: 1 });
  });

  it('§5 sayaç 1 olduğunda bir hamle önceden uyarı verilir; sonraki hamlede tetiklenir', () => {
    const d = kur({ tahta: ['R R R . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', 'G . . . . .'], havaOlaylari: meltem({ baslangic: 2 }) });
    const bir = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(bir.olaylar, 'havaOlayi')).toMatchObject([{ olay: 'meltem', hat: 5, uyari: true }]);
    expect(bir.durum.havaOlaylari[0].sayac).toBe(1);
    expect(ic(bir.durum, 0, 5)).toMatchObject({ isi: 0 });
    // dolum Gül olduğu için üst sıra yeniden Gül kapsülle dolar
    const iki = uygula(bir.durum, fitil('0,0 1,0 2,0'));
    expect(sec(iki.olaylar, 'havaOlayi')).toMatchObject([{ olay: 'meltem', hat: 5, uyari: false }]);
    expect(ic(iki.durum, 0, 5)).toMatchObject({ isi: 1 });
  });

  it('§5 hava sayacı çift dokunuşta da iner', () => {
    const d = kur({ tahta: ['R- . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', 'G . . . . .'], havaOlaylari: meltem({ baslangic: 3 }) });
    const { durum } = uygula(d, cift(0, 0));
    expect(durum.havaOlaylari[0].sayac).toBe(2);
  });

  it('§5 meltem sütun ekseninde: hattaki sütunun kapsülleri ısınır', () => {
    const d = kur({
      tahta: ['R R R . . .', '. . . . . G', '. . . . . .', '. . . . . G2', '. . . . . .', '. . . . . .'],
      havaOlaylari: [{ tur: 'meltem', eksen: 'sutun', hatlar: [5], periyot: 4, baslangic: 1 }],
    });
    const { olaylar, durum } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(olaylar, 'havaOlayi')).toMatchObject([{ olay: 'meltem', eksen: 'sutun', hat: 5 }]);
    expect(ic(durum, 5, 1)).toMatchObject({ isi: 1 });
    expect(ic(durum, 5, 3)).toMatchObject({ isi: 3 });
  });

  it('§5 çisenti: hattaki bütün kapsüllerin (kafesli dahil) ısısı 0 olur', () => {
    const d = kur({
      tahta: ['R R R . . .', '. . . . . .', '. . . . . .', '. . . . . .', '. . . . . .', 'G3 A2 C:R3 . . .'],
      havaOlaylari: [{ tur: 'cisenti', eksen: 'satir', hatlar: [5], periyot: 4, baslangic: 1 }],
    });
    const { olaylar, durum } = uygula(d, fitil('0,0 1,0 2,0'));
    expect(sec(olaylar, 'havaOlayi')).toMatchObject([{ olay: 'cisenti', hat: 5, uyari: false }]);
    expect(ic(durum, 0, 5)).toMatchObject({ isi: 0 });
    expect(ic(durum, 1, 5)).toMatchObject({ isi: 0 });
    expect(hucreAt(durum, 2, 5)).toMatchObject({ kafes: true, icerik: { isi: 0 } });
  });
});
