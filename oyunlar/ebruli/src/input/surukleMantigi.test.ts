import { describe, expect, it } from 'vitest';
import type { SurukleGeriCagirim, TahtaGeometrisi } from '../app/sozlesme';
import type { Konum } from '../core/types';
import { ESIK_PX, SurukleMantigi } from './surukleMantigi';

/** 5×4 tahta, hücre 50 px, sol üst (10, 20). (4,0) boş; diğerleri damla. */
function kur(acik = true) {
  const geo: TahtaGeometrisi = { x: 10, y: 20, hucre: 50, w: 5, h: 4 };
  const kayit: string[] = [];
  let kapali = !acik;
  const k = (p: Konum | null) => (p ? `${p.x},${p.y}` : '-');
  const cb: SurukleGeriCagirim = {
    basladi: (p) => kayit.push(`basladi ${k(p)}`),
    surukleniyor: (p, h) => kayit.push(`surukle ${k(p)}>${k(h)}`),
    birakildi: (h) => kayit.push(`birak ${k(h.kaynak)}>${k(h.hedef)}`),
    iptal: () => kayit.push('iptal'),
    dokunuldu: () => kayit.push('dokun'),
    kisitliBasildi: (p) => kayit.push(`kisitli ${k(p)}`),
    imlecDegisti: (p) => kayit.push(`imlec ${k(p)}`),
  };
  const m = new SurukleMantigi({ geometri: () => geo, secilebilir: (p) => (kapali ? null : !(p.x === 4 && p.y === 0)) }, cb);
  /** Hücre merkezi (px). */
  const mz = (x: number, y: number) => ({ x: 10 + x * 50 + 25, y: 20 + y * 50 + 25 });
  const temiz = () => kayit.filter((s) => s !== 'dokun' && !s.startsWith('surukle'));
  return { m, kayit, temiz, mz, kapat: (v: boolean) => (kapali = v) };
}

describe('sürükleme (§3.2)', () => {
  it('12 px eşiği ve baskın eksen: sağa sürükle → (1,1)>(2,1)', () => {
    const { m, kayit, temiz, mz } = kur();
    const p = mz(1, 1);
    m.bas(1, p.x, p.y);
    m.hareket(1, p.x + ESIK_PX - 2, p.y + 3);
    expect(kayit.at(-1)).toBe('surukle 1,1>-');
    m.hareket(1, p.x + 30, p.y + 10);
    expect(kayit.at(-1)).toBe('surukle 1,1>2,1');
    // Parmak hedefi aşsa da hedef komşudur.
    m.hareket(1, p.x + 140, p.y + 20);
    expect(kayit.at(-1)).toBe('surukle 1,1>2,1');
    m.birak(1, p.x + 140, p.y + 20);
    expect(temiz()).toEqual(['basladi 1,1', 'birak 1,1>2,1']);
  });

  it('dikey baskın eksen ve yukarı', () => {
    const { m, temiz, mz } = kur();
    const p = mz(2, 2);
    m.bas(1, p.x, p.y);
    m.hareket(1, p.x + 8, p.y - 30);
    m.birak(1, p.x + 8, p.y - 30);
    expect(temiz()).toEqual(['basladi 2,2', 'birak 2,2>2,1']);
  });

  it('tahta dışına doğru sürükleme hedefsiz; geri dönüp bırakmak iptal', () => {
    const { m, temiz, mz } = kur();
    const p = mz(0, 1);
    m.bas(1, p.x, p.y);
    m.hareket(1, p.x - 40, p.y);
    m.birak(1, p.x - 40, p.y);
    expect(temiz()).toEqual(['basladi 0,1', 'iptal']);
    const q = mz(1, 1);
    m.bas(2, q.x, q.y);
    m.hareket(2, q.x + 30, q.y);
    m.hareket(2, q.x + 2, q.y);
    m.birak(2, q.x + 2, q.y);
    expect(temiz().slice(2)).toEqual(['basladi 1,1', 'iptal']);
  });

  it('hızlı fiske: hareket olayı olmadan uzak bırakma da hamle', () => {
    const { m, temiz, mz } = kur();
    const p = mz(1, 2);
    m.bas(1, p.x, p.y);
    m.birak(1, p.x, p.y + 25);
    expect(temiz()).toEqual(['basladi 1,2', 'birak 1,2>1,3']);
  });

  it('yalnız ilk pointer izlenir', () => {
    const { m, temiz, mz } = kur();
    const p = mz(1, 1);
    const q = mz(3, 3);
    m.bas(1, p.x, p.y);
    m.bas(2, q.x, q.y);
    m.hareket(2, q.x + 40, q.y);
    m.birak(2, q.x + 40, q.y);
    m.hareket(1, p.x, p.y + 40);
    m.birak(1, p.x, p.y + 40);
    expect(temiz()).toEqual(['basladi 1,1', 'birak 1,1>1,2']);
  });

  it('pointercancel iptal eder', () => {
    const { m, temiz, mz } = kur();
    const p = mz(1, 1);
    m.bas(7, p.x, p.y);
    m.hareket(7, p.x + 30, p.y);
    m.iptalEt(7);
    expect(temiz()).toEqual(['basladi 1,1', 'iptal']);
    expect(m.basili).toBe(false);
  });
});

describe('dokun-dokun', () => {
  it('dokun → seçili kalır; komşuya dokun → hamle', () => {
    const { m, temiz, mz } = kur();
    const a = mz(2, 2);
    const b = mz(3, 2);
    m.bas(1, a.x, a.y);
    m.birak(1, a.x + 3, a.y + 2);
    expect(m.secili).toEqual({ x: 2, y: 2 });
    m.bas(2, b.x, b.y);
    m.birak(2, b.x, b.y);
    expect(temiz()).toEqual(['basladi 2,2', 'birak 2,2>3,2']);
    expect(m.secili).toBeNull();
  });

  it('aynı damlaya ya da boşluğa dokunmak seçimi kaldırır; uzak damla seçimi taşır', () => {
    const { m, temiz, mz } = kur();
    const a = mz(1, 1);
    m.bas(1, a.x, a.y);
    m.birak(1, a.x, a.y);
    m.bas(2, a.x, a.y);
    m.birak(2, a.x, a.y);
    expect(temiz()).toEqual(['basladi 1,1', 'iptal']);
    m.bas(3, a.x, a.y);
    m.birak(3, a.x, a.y);
    const uzak = mz(3, 3);
    m.bas(4, uzak.x, uzak.y);
    m.birak(4, uzak.x, uzak.y);
    expect(temiz().slice(2)).toEqual(['basladi 1,1', 'iptal', 'basladi 3,3']);
    m.bas(5, 2, 2); // tahta dışı
    m.birak(5, 2, 2);
    expect(temiz().at(-1)).toBe('iptal');
    expect(m.secili).toBeNull();
  });

  it('seçiliyken komşuya basıp sürüklemek o damladan yeni sürükleme başlatır', () => {
    const { m, temiz, mz } = kur();
    const a = mz(1, 1);
    const b = mz(2, 1);
    m.bas(1, a.x, a.y);
    m.birak(1, a.x, a.y);
    m.bas(2, b.x, b.y);
    m.hareket(2, b.x, b.y + 30);
    m.birak(2, b.x, b.y + 30);
    expect(temiz()).toEqual(['basladi 1,1', 'iptal', 'basladi 2,1', 'birak 2,1>2,2']);
  });
});

describe('zorunlu ilk hamle (§12.1)', () => {
  it('yalnız zorunlu kaynak → hedef; dışarı basmak kısıtlı', () => {
    const { m, temiz, mz } = kur();
    m.zorunluAyarla({ tur: 'surukle', kaynak: { x: 3, y: 3 }, hedef: { x: 2, y: 3 } });
    const d = mz(0, 0);
    m.bas(1, d.x, d.y);
    m.birak(1, d.x, d.y);
    const k = mz(3, 3);
    m.bas(2, k.x, k.y);
    m.hareket(2, k.x, k.y - 30); // yanlış yön
    m.birak(2, k.x, k.y - 30);
    m.bas(3, k.x, k.y);
    m.hareket(3, k.x - 30, k.y);
    m.birak(3, k.x - 30, k.y);
    expect(temiz()).toEqual(['kisitli 0,0', 'basladi 3,3', 'iptal', 'basladi 3,3', 'birak 3,3>2,3']);
  });

  it('dokun-dokun ile de zorunlu hedef', () => {
    const { m, temiz, mz } = kur();
    m.zorunluAyarla({ tur: 'surukle', kaynak: { x: 3, y: 3 }, hedef: { x: 2, y: 3 } });
    const k = mz(3, 3);
    const h = mz(2, 3);
    m.bas(1, k.x, k.y);
    m.birak(1, k.x, k.y);
    m.bas(2, h.x, h.y);
    m.birak(2, h.x, h.y);
    expect(temiz()).toEqual(['basladi 3,3', 'birak 3,3>2,3']);
  });
});

describe('kip ve klavye', () => {
  it('kapalı kipte yalnız dokunuldu', () => {
    const { m, kayit, mz } = kur();
    m.kipAyarla('kapali');
    const p = mz(1, 1);
    m.bas(1, p.x, p.y);
    m.hareket(1, p.x + 40, p.y);
    m.birak(1, p.x + 40, p.y);
    expect(kayit).toEqual(['dokun']);
  });

  it('kapalıya geçiş süren seçimi iptal eder', () => {
    const { m, temiz, mz } = kur();
    const p = mz(1, 1);
    m.bas(1, p.x, p.y);
    m.birak(1, p.x, p.y);
    m.kipAyarla('kapali');
    expect(temiz()).toEqual(['basladi 1,1', 'iptal']);
  });

  it('oklar imleç, Enter seç, ok hamle, Esc bırak', () => {
    const { m, temiz } = kur();
    expect(m.tus('ArrowLeft')).toBe(true); // ilk tuş imleci ortada açar
    m.tus('ArrowLeft');
    m.tus('ArrowUp');
    m.tus('Enter');
    m.tus('ArrowRight');
    m.tus(' ');
    m.tus('Escape');
    m.tus('Escape');
    expect(m.tus('a')).toBe(false);
    expect(temiz()).toEqual(['imlec 2,2', 'imlec 1,2', 'imlec 1,1', 'basladi 1,1', 'birak 1,1>2,1', 'basladi 1,1', 'iptal', 'imlec -']);
  });

  it('imleç kenarda durur; boş hücre seçilmez', () => {
    const { m, temiz } = kur();
    m.tus('ArrowUp');
    for (let i = 0; i < 6; i++) m.tus('ArrowUp');
    for (let i = 0; i < 6; i++) m.tus('ArrowRight');
    m.tus('Enter');
    expect(temiz().at(-1)).toBe('imlec 4,0');
    expect(m.secili).toBeNull();
  });

  it('girdi kapalıyken (durum yok) basış yok sayılır', () => {
    const { m, temiz, mz, kapat } = kur();
    kapat(true);
    const p = mz(1, 1);
    m.bas(1, p.x, p.y);
    m.birak(1, p.x, p.y);
    expect(temiz()).toEqual([]);
    expect(m.basili).toBe(false);
  });
});
