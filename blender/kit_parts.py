"""
Kit-bash parça kütüphanesi — motor dış donanımı.

Kaportasız motorların üzerindeki küçük donanım (kelepçe, rakor, aktüatör,
ateşleyici, pompa, sensör, etiket…) burada tek tek modellenir ve tek bir
glb'ye yazılır. Oyun bu parçaları motor gövdesinin yarıçap profiline göre
yerleştirir (src/engine/kit.js), aynı parça çok kez kullanıldığı için
InstancedMesh ile çizilir.

Her parça üç detay seviyesinde üretilir: L0 (yüksek), L1 (orta), L2 (düşük)
kalite ayarına karşılık gelir. Nesne adları: KIT_<parça>_L<n>.

Eksen kuralı (three.js): parçanın kökü montaj yüzeyindedir, +Y yüzeyden
dışarı, +Z motor ekseni boyunca (arkaya). Borularla ilgili parçalarda kök
borunun merkezidir ve boru +Z yönündedir.

Malzeme yuvaları (kitlib.SLOT_COLORS): oyunda ada göre gerçek malzemelerle
değiştirilir. 'weld', 'knurl', 'rivet', 'louver', 'placard' yuvaları trim
sheet'i kullanır (blender/trim_sheet.py).

    /home/user/bpyenv/bin/python blender/kit_parts.py --out build/kit_raw.glb
    node scripts/pack-kit.mjs build/kit_raw.glb src/assets/kit.glb
"""

import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from kitlib import (TRIM, clear_mats, cbox, cyl, hexp, hull, join, lathe, placard_rect,  # noqa: E402
                    plate, reset, rot, strip_quad, sweep, torus, tri_count)

LODS = [
    {'s': 32, 'm': 16, 't': 8, 'lod': 0},
    {'s': 18, 'm': 10, 't': 6, 'lod': 1},
    {'s': 10, 'm': 6, 't': 4, 'lod': 2},
]
PARTS = {}


def part(fn):
    PARTS[fn.__name__] = fn
    return fn


def weld_ring(R, r, d, slot='weld', at=(0, 0, 0), axis='y'):
    """Kaynak dikişi halkası (trim şeridi); L2'de atlanır."""
    if d['lod'] == 2:
        return None
    return torus(R, r, d['s'], 6 if d['lod'] == 0 else 4, slot, axis=axis, at=at, strip=TRIM['weld'], ulen=0.03)


def bolt(at, d, af=0.010, h=0.005, axis='y', washer=True):
    """Altıgen başlı cıvata + pul (yüzeye oturur)."""
    out = []
    if washer and d['lod'] < 2:
        out.append(cyl(af * 0.85, af * 0.85, 0.0012, d['m'], 'steel', axis=axis, at=at))
    off = 0.0012 if washer and d['lod'] < 2 else 0
    base = [a + b for a, b in zip(at, _axis_vec(axis, off))]
    out.append(hexp(af, h, 'steel', axis=axis, at=base))
    return out


def _axis_vec(axis, k):
    return {'y': (0, k, 0), 'z': (0, 0, k), 'x': (k, 0, 0), '-z': (0, 0, -k), '-y': (0, -k, 0)}[axis]


# ---------------------------------------------------------------------------
# Boru bağlantıları
# ---------------------------------------------------------------------------

@part
def pClamp(d):
    """Yastıklı döngü kelepçesi (P-clamp) — Ø24 mm boru; kök boru merkezi,
    boru +Z yönünde, bağlantı dili −Y (gövdeye doğru)."""
    o = []
    # Paslanmaz bant (boruyu saran halka + dile inen iki kol)
    o.append(torus(0.0142, 0.0011, d['s'], 4, 'ss', axis='z'))
    # Silikon yastık (bandın içinde)
    o.append(lathe([(0.0122, -0.0065), (0.0131, -0.0065), (0.0131, 0.0065), (0.0122, 0.0065)], d['s'], 'rubber', axis='z',
                   at=(0, 0, 0), a0=0, a1=2 * math.pi))
    # Bant genişliği: halka yerine düz bant (L0/L1'de ince tüp yerine)
    o.append(lathe([(0.0135, -0.006), (0.0148, -0.006), (0.0148, 0.006), (0.0135, 0.006), (0.0135, -0.006)], d['s'], 'ss', axis='z'))
    # Dil (iki kat) ve cıvata
    o.append(cbox((0.012, 0.014, 0.012), 'ss', at=(0.0055, -0.020, 0), chamfer=0.0015))
    o.append(cbox((0.012, 0.014, 0.012), 'ss', at=(-0.0055, -0.020, 0), chamfer=0.0015))
    o += bolt((0.0115, -0.022, 0), d, af=0.008, h=0.004, axis='x', washer=False)
    o.append(cyl(0.0024, 0.0024, 0.03, d['t'], 'steel', axis='x', at=(-0.015, -0.022, 0)))
    return o


@part
def standoff(d):
    """Boru kelepçesi ayağı: gövdeye cıvatalı taban + dikme; yükseklik 30 mm
    (Y ölçeklenir). Kök yüzeyde, üst uç kelepçe dilini taşır."""
    o = [cbox((0.032, 0.004, 0.026), 'ss', at=(0, 0.002, 0), chamfer=0.0015),
         cbox((0.004, 0.03, 0.018), 'ss', at=(0, 0.015, 0), chamfer=0.001),
         cbox((0.012, 0.004, 0.018), 'ss', at=(0.004, 0.029, 0), chamfer=0.001)]
    # Takviye üçgeni
    o.append(hull([(0.002, 0.004, -0.008), (0.012, 0.004, -0.008), (0.002, 0.016, -0.008),
                   (0.002, 0.004, -0.0065), (0.012, 0.004, -0.0065), (0.002, 0.016, -0.0065)], 'ss'))
    for x in (-0.011, 0.011):
        o += bolt((x, 0.004, 0), d, af=0.007, h=0.0035)
    return o


@part
def bNut(d):
    """Boru rakoru (B-somun + rakor gövdesi + manşon) — Ø24 mm boru; kök
    gövde yüzeyi, boru +Y'den gelir."""
    o = [weld_ring(0.019, 0.0022, d),
         cyl(0.021, 0.02, 0.004, d['s'], 'steel'),
         hexp(0.03, 0.009, 'steel', at=(0, 0.004, 0)),
         cyl(0.0135, 0.0135, 0.004, d['m'], 'steel', at=(0, 0.013, 0)),
         hexp(0.028, 0.012, 'steel', at=(0, 0.017, 0)),
         lathe([(0.0115, 0.029), (0.0128, 0.029), (0.0128, 0.034), (0.0121, 0.042)], d['m'], 'steel')]
    if d['lod'] < 2:
        # Emniyet teli deliği / tel
        o.append(sweep([(0.012, 0.022, 0), (0.019, 0.016, 0.006), (0.024, 0.006, 0.012), (0.026, 0.002, 0.018)], 0.0006, 4, 'steel'))
    return o


@part
def boss(d):
    """Gövdeye kaynaklı boru/port pabucu (dairesel), 3 saplama."""
    o = [lathe([(0, 0.006), (0.024, 0.006), (0.028, 0.004), (0.03, 0)], d['s'], 'steel'),
         weld_ring(0.03, 0.0024, d)]
    for k in range(3):
        a = k * 2 * math.pi / 3 + 0.5
        o += bolt((0.019 * math.cos(a), 0.006, 0.019 * math.sin(a)), d, af=0.007, h=0.004, washer=False)
    o.append(cyl(0.011, 0.011, 0.003, d['m'], 'steel', at=(0, 0.006, 0)))
    return o


@part
def flangeBolt(d):
    """M8 flanş cıvatası: altıgen baş + pul + taşan diş ucu (+Y)."""
    o = bolt((0, 0, 0), d, af=0.012, h=0.0055)
    if d['lod'] < 2:
        o.append(cyl(0.0035, 0.0035, 0.004, d['t'], 'steel', at=(0, 0.0067, 0)))
    return o


@part
def tBolt(d):
    """V-bant kelepçesi T-cıvata kilidi (kanal flanşları için); kök bant
    üst yüzeyi, bant Z boyunca değil X boyunca (teğet) uzanır."""
    o = [cbox((0.05, 0.008, 0.022), 'ss', at=(0, 0.004, 0), chamfer=0.002),
         cbox((0.012, 0.014, 0.018), 'ss', at=(-0.02, 0.011, 0), chamfer=0.002),
         cbox((0.012, 0.014, 0.018), 'ss', at=(0.02, 0.011, 0), chamfer=0.002),
         cyl(0.0035, 0.0035, 0.06, d['t'], 'steel', axis='x', at=(-0.03, 0.013, 0)),
         hexp(0.011, 0.007, 'steel', axis='x', at=(0.026, 0.013, 0))]
    return o


# ---------------------------------------------------------------------------
# Değişken stator (VSV) mekanizması
# ---------------------------------------------------------------------------

@part
def vsvBoss(d):
    """VSV kanat mili yuvası: gövdedeki pabuç, burç, pul ve kilit somunu."""
    return [lathe([(0.012, 0), (0.011, 0.006), (0.0095, 0.0075)], d['m'], 'steel'),
            cyl(0.0075, 0.0075, 0.004, d['m'], 'gold', at=(0, 0.0075, 0)),
            hexp(0.011, 0.005, 'steel', at=(0, 0.0115, 0)),
            cyl(0.0028, 0.0028, 0.004, d['t'], 'steel', at=(0, 0.0165, 0))]


@part
def vsvLever(d):
    """VSV kolu: kökte mile geçer, +Z'de 50 mm uzanıp birleştirme halkasına
    pimle bağlanır."""
    L = 0.05
    t = 0.0045
    pts = []
    for z, w in ((0, 0.0075), (L, 0.005)):
        for k in range(d['m']):
            a = 2 * math.pi * k / d['m']
            for y in (0, t):
                pts.append((w * math.cos(a), y, z + w * math.sin(a)))
    o = [hull(pts, 'steel', smooth=False),
         cyl(0.003, 0.003, 0.012, d['t'], 'steel', at=(0, -0.005, L)),
         cyl(0.0045, 0.0045, 0.003, d['t'], 'gold', at=(0, t, L))]
    return o


@part
def actuator(d):
    """Hidrolik aktüatör gövdesi: 200 mm, Ø56; kök gövde ekseninin ortası,
    silindir +Z yönünde; −Z ucunda muylu kulakları, +Z ucunda keçe yuvası,
    üstte iki hidrolik port."""
    L = 0.2
    R = 0.028
    o = [lathe([(0, -L / 2), (R * 0.8, -L / 2), (R * 1.05, -L / 2 + 0.006), (R * 1.05, -L / 2 + 0.03),
                (R, -L / 2 + 0.034), (R, L / 2 - 0.03), (R * 1.08, L / 2 - 0.026), (R * 1.08, L / 2 - 0.006),
                (R * 0.55, L / 2), (R * 0.45, L / 2 + 0.01), (0, L / 2 + 0.01)], d['s'], 'anodized', axis='z')]
    # Muylu kulakları
    for x0 in (-R - 0.014, R):
        o.append(cyl(0.009, 0.009, 0.014, d['m'], 'steel', axis='x', at=(x0, 0, -L / 2 + 0.018)))
    # Portlar + rakorlar
    for z in (-L / 2 + 0.018, L / 2 - 0.016):
        o.append(cyl(0.008, 0.008, 0.01, d['m'], 'steel', at=(0, R * 1.02, z)))
        o.append(hexp(0.014, 0.008, 'steel', at=(0, R * 1.02 + 0.01, z)))
    if d['lod'] < 2:
        # Bağlantı kelepçe bantları
        for z in (-L / 2 + 0.05, L / 2 - 0.05):
            o.append(torus(R + 0.001, 0.0015, d['s'], 4, 'steel', axis='z', at=(0, 0, z)))
        o.append(plate(0.05, 0.022, placard_rect('HYD'), at=(0, R + 0.0003, 0), rot=None))
    return o


@part
def actuatorRod(d):
    """Aktüatör rodu: 100 mm krom rod + ucunda küresel rod-end (mafsal)."""
    L = 0.1
    o = [cyl(0.009, 0.009, L, d['m'], 'ss', axis='z'),
         hexp(0.016, 0.008, 'steel', axis='z', at=(0, 0, L)),
         cyl(0.007, 0.007, 0.014, d['m'], 'steel', axis='z', at=(0, 0, L + 0.008)),
         torus(0.011, 0.0045, d['m'], d['t'], 'steel', axis='x', at=(0, 0, L + 0.032)),
         cyl(0.0065, 0.0065, 0.012, d['t'], 'steel', axis='x', at=(-0.006, 0, L + 0.032))]
    return o


@part
def mountFoot(d):
    """Çatal (clevis) montaj braketi: taban levhası + iki kulak, 60 mm."""
    o = [cbox((0.05, 0.006, 0.04), 'steel', at=(0, 0.003, 0), chamfer=0.002)]
    for x in (-0.012, 0.012):
        o.append(hull([(x - 0.003, 0.006, -0.016), (x + 0.003, 0.006, -0.016), (x - 0.003, 0.006, 0.016), (x + 0.003, 0.006, 0.016),
                       (x - 0.003, 0.05, -0.009), (x + 0.003, 0.05, -0.009), (x - 0.003, 0.05, 0.009), (x + 0.003, 0.05, 0.009)], 'steel'))
    o.append(cyl(0.004, 0.004, 0.04, d['t'], 'steel', axis='x', at=(-0.02, 0.045, 0)))
    for x, z in ((-0.019, -0.013), (0.019, -0.013), (-0.019, 0.013), (0.019, 0.013)):
        o += bolt((x, 0.006, z), d, af=0.007, h=0.0035, washer=False)
    return o


# ---------------------------------------------------------------------------
# Ateşleme ve yakıt
# ---------------------------------------------------------------------------

@part
def igniter(d):
    """Ateşleyici bujisi: gövde pabucu, altıgen, gövde, bağlantı somunu ve
    örgülü kablo başlığı (toplam ~100 mm, +Y)."""
    o = [boss_pad(0.024, d),
         hexp(0.026, 0.012, 'steel', at=(0, 0.006, 0)),
         cyl(0.013, 0.013, 0.045, d['m'], 'steel', at=(0, 0.018, 0)),
         lathe([(0.016, 0.063), (0.016, 0.075), (0.0145, 0.077)], d['m'], 'knurl', strip=TRIM['knurl'], ulen=0.02),
         cyl(0.011, 0.009, 0.02, d['m'], 'ss', at=(0, 0.077, 0))]
    return o


def boss_pad(r, d):
    return lathe([(0, 0.006), (r * 0.9, 0.006), (r, 0.003), (r * 1.15, 0)], d['m'], 'steel')


@part
def exciter(d):
    """Ateşleme uyarıcı kutusu (exciter): 100×70×160 mm, kanatçıklı kapak,
    iki yüksek gerilim çıkışı, titreşim yalıtımlı ayaklar, uyarı etiketi.
    Kök kutu merkezi."""
    w, h, L = 0.1, 0.07, 0.16
    o = [cbox((w, h, L), 'paint', chamfer=0.006)]
    if d['lod'] < 2:
        for k in range(6):
            z = -L / 2 + 0.02 + k * (L - 0.04) / 5
            o.append(cbox((w * 0.85, 0.008, 0.004), 'paint', at=(0, h / 2 + 0.004, z), chamfer=0.001))
        o.append(plate(0.07, 0.018, placard_rect('DANGER'), at=(0, 0, 0), rot=rot('z', math.pi / 2) @ _tr(0, w / 2, 0)))
    for z in (-L / 2, L / 2):
        s = 1 if z > 0 else -1
        o.append(cyl(0.012, 0.012, 0.016, d['m'], 'gold', axis='z' if s > 0 else '-z', at=(0.02, 0, z)))
    for x, z in ((-w / 2 - 0.008, -L / 2 + 0.02), (w / 2 + 0.008, -L / 2 + 0.02), (-w / 2 - 0.008, L / 2 - 0.02), (w / 2 + 0.008, L / 2 - 0.02)):
        o.append(cyl(0.008, 0.008, 0.012, d['t'], 'rubber', at=(x, -h / 2 - 0.004, z)))
        o.append(cbox((0.018, 0.003, 0.022), 'steel', at=(x, -h / 2 - 0.004, z), chamfer=0.001))
    return o


def _tr(x, y, z):
    from mathutils import Matrix
    return Matrix.Translation((x, y, z))


@part
def injectorFlange(d):
    """Yakıt enjektörü montaj flanşı (iki cıvatalı elmas flanş) ve pigtail
    giriş rakoru (+Y)."""
    pts = []
    for k in range(d['m']):
        a = 2 * math.pi * k / d['m']
        for (cx, rr) in ((-0.02, 0.008), (0.02, 0.008), (0, 0.016)):
            for y in (0, 0.006):
                pts.append((cx + rr * math.cos(a), y, rr * math.sin(a)))
    o = [hull(pts, 'steel')]
    for x in (-0.02, 0.02):
        o += bolt((x, 0.006, 0), d, af=0.008, h=0.004, washer=False)
    o += [cyl(0.009, 0.008, 0.016, d['m'], 'steel', at=(0, 0.006, 0)),
          hexp(0.014, 0.008, 'steel', at=(0, 0.022, 0)),
          cyl(0.0045, 0.0045, 0.008, d['t'], 'ss', at=(0, 0.03, 0))]
    return o


@part
def borescope(d):
    """Boroskop tapası: pabuç, altıgen başlı tapa, emniyet teli kulağı."""
    o = [boss_pad(0.017, d),
         cyl(0.0105, 0.0105, 0.004, d['m'], 'steel', at=(0, 0.006, 0)),
         hexp(0.016, 0.008, 'steel', at=(0, 0.01, 0))]
    if d['lod'] < 2:
        o.append(cbox((0.004, 0.006, 0.008), 'steel', at=(0.012, 0.009, 0), chamfer=0.0008))
        o.append(sweep([(0.0, 0.017, 0.003), (0.006, 0.016, 0.004), (0.012, 0.012, 0.002)], 0.0005, 4, 'steel', caps=False))
    return o


@part
def probe(d):
    """Sıcaklık/basınç sondası (ör. T45 termokupl): iki cıvatalı flanş,
    gövde ve terminal kutusu (+Y)."""
    o = [cbox((0.05, 0.005, 0.022), 'steel', at=(0, 0.0025, 0), chamfer=0.003)]
    for x in (-0.017, 0.017):
        o += bolt((x, 0.005, 0), d, af=0.007, h=0.0035, washer=False)
    o += [cyl(0.007, 0.007, 0.018, d['m'], 'steel', at=(0, 0.005, 0)),
          cbox((0.028, 0.02, 0.03), 'steel', at=(0, 0.033, 0), chamfer=0.003),
          cyl(0.0035, 0.0035, 0.004, d['t'], 'gold', at=(-0.007, 0.043, 0.007)),
          cyl(0.0035, 0.0035, 0.004, d['t'], 'gold', at=(0.007, 0.043, 0.007))]
    return o


# ---------------------------------------------------------------------------
# Aksesuarlar (dişli kutusuna radyal monte; kök montaj flanşı, gövde +Y)
# Nominal: gövde yarıçapı 0.06, boy 0.14 (oyunda ölçeklenir)
# ---------------------------------------------------------------------------

def acc_flange(d, r=0.069):
    o = [lathe([(0, 0), (r, 0), (r, 0.008), (0.062, 0.012), (0, 0.012)], d['s'], 'cast')]
    n = 8 if d['lod'] < 2 else 4
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n
        o += bolt(((r - 0.006) * math.cos(a), 0.008, (r - 0.006) * math.sin(a)), d, af=0.008, h=0.004, washer=False)
    return o


@part
def pump(d):
    """Yakıt pompası: döküm gövde, iki kademe, giriş/çıkış portları, etiket."""
    o = acc_flange(d)
    o.append(lathe([(0.058, 0.012), (0.06, 0.02), (0.06, 0.09), (0.052, 0.1), (0.052, 0.13), (0.035, 0.145), (0, 0.145)],
                   d['s'], 'iridite'))
    if d['lod'] < 2:
        o.append(torus(0.06, 0.004, d['s'], 4, 'iridite', axis='y', at=(0, 0.055, 0)))
    for a, y in ((0.0, 0.05), (math.pi, 0.11)):
        x, z = math.cos(a), math.sin(a)
        o.append(cyl(0.016, 0.016, 0.02, d['m'], 'cast', axis='x', at=(0.052 * x - (0.02 if x < 0 else 0), y, 0)))
        o.append(hexp(0.024, 0.012, 'steel', axis='x', at=(0.072 * x - (0.012 if x < 0 else 0), y, 0)))
    if d['lod'] < 2:
        o.append(plate(0.05, 0.013, placard_rect('FUEL'), at=(0, 0.075, 0.0605), rot=rot('x', math.pi / 2)))
    return o


@part
def generator(d):
    """Jeneratör: kanatçıklı gövde, soğutma havası girişi, terminal kutusu."""
    o = acc_flange(d)
    o.append(lathe([(0.056, 0.012), (0.06, 0.02), (0.06, 0.13), (0.045, 0.145), (0, 0.145)], d['s'], 'paint'))
    nf = 7 if d['lod'] == 0 else (4 if d['lod'] == 1 else 0)
    for k in range(nf):
        o.append(torus(0.061, 0.0025, d['s'], 4, 'paint', axis='y', at=(0, 0.03 + k * 0.014, 0)))
    o.append(cyl(0.022, 0.022, 0.03, d['m'], 'paint', axis='y', at=(0, 0.145, 0)))
    o.append(cbox((0.04, 0.035, 0.05), 'paint', at=(0.065, 0.1, 0), chamfer=0.004))
    o.append(cyl(0.008, 0.008, 0.012, d['t'], 'gold', axis='x', at=(0.085, 0.1, 0.01)))
    if d['lod'] < 2:
        o.append(strip_quad(0.03, 0.018, TRIM['louver'], 0.03, at=(0, 0.1754 - 0.0004, 0), rot=None, slot='louver'))
    return o


@part
def starter(d):
    """Hava türbinli marş motoru: gövde + salyangoz muhafaza ve kanal flanşı."""
    o = acc_flange(d)
    o.append(lathe([(0.05, 0.012), (0.052, 0.06), (0.05, 0.12), (0.03, 0.14), (0, 0.14)], d['s'], 'cast'))
    # Salyangoz (volute)
    o.append(torus(0.058, 0.02, d['s'], d['m'], 'cast', axis='y', at=(0, 0.075, 0)))
    o.append(cyl(0.024, 0.024, 0.06, d['m'], 'cast', axis='x', at=(0.05, 0.075, 0.045)))
    o.append(cyl(0.03, 0.03, 0.008, d['m'], 'steel', axis='x', at=(0.108, 0.075, 0.045)))
    return o


@part
def oilPump(d):
    """Yağlama ve tahliye pompası: üst üste dizili pompa elemanları."""
    o = acc_flange(d, 0.06)
    for k in range(3):
        o.append(cbox((0.1, 0.035, 0.08), 'iridite', at=(0, 0.03 + k * 0.038, 0), chamfer=0.008))
    for k in range(3):
        o.append(hexp(0.018, 0.01, 'steel', axis='z', at=(0.03, 0.03 + k * 0.038, 0.04)))
    return o


@part
def hydPump(d):
    """Hidrolik pompa: basınç/dönüş portları, kasa tahliyesi, etiket."""
    o = acc_flange(d)
    o.append(lathe([(0.05, 0.012), (0.055, 0.03), (0.055, 0.11), (0.04, 0.135), (0, 0.135)], d['s'], 'anodized'))
    o.append(cbox((0.07, 0.04, 0.05), 'cast', at=(0, 0.1, 0.045), chamfer=0.005))
    for x in (-0.018, 0.018):
        o.append(hexp(0.016, 0.01, 'steel', axis='z', at=(x, 0.1, 0.07)))
    if d['lod'] < 2:
        o.append(plate(0.045, 0.011, placard_rect('HYD'), at=(0, 0.07, 0.0555), rot=rot('x', math.pi / 2)))
    return o


@part
def oilFilter(d):
    """Yağ filtresi: dökme kafa, kanister, ΔP göstergesi (kırmızı düğme)."""
    o = [cbox((0.08, 0.03, 0.06), 'cast', at=(0, 0.015, 0), chamfer=0.006),
         lathe([(0.032, 0.03), (0.034, 0.035), (0.034, 0.13), (0.028, 0.14), (0, 0.141)], d['s'], 'steel'),
         hexp(0.024, 0.01, 'steel', at=(0, 0.141, 0)),
         cyl(0.007, 0.007, 0.008, d['m'], 'red', at=(0.028, 0.03, 0))]
    if d['lod'] < 2:
        o.append(lathe([(0.035, 0.1), (0.035, 0.12)], d['s'], 'knurl', strip=TRIM['knurl'], ulen=0.02))
    return o


# ---------------------------------------------------------------------------
# Tank, kontrol ünitesi, kablo tesisatı
# ---------------------------------------------------------------------------

@part
def oilTank(d):
    """Yağ tankı: kapsül gövde (R 75, boy 340 mm), gözetleme camı, dolum
    kapağı, sıkma kayışları ve ayaklar. Kök tank merkezi; ayaklar −Y'de
    gövdeye iner (merkez yüzeyden 105 mm yukarıda)."""
    R, L = 0.075, 0.34
    n = d['m']
    prof = [(0, -L / 2 - R)]
    for k in range(1, n // 2 + 1):
        a = -math.pi / 2 + math.pi / 2 * k / (n // 2)
        prof.append((R * math.cos(a), -L / 2 + R * math.sin(a)))
    for k in range(0, n // 2 + 1):
        a = math.pi / 2 * k / (n // 2)
        prof.append((R * math.cos(a), L / 2 + R * math.sin(a)))
    o = [lathe(prof, d['s'], 'tank', axis='z')]
    # Kayışlar + ayaklar
    for z in (-L * 0.3, L * 0.3):
        o.append(torus(R + 0.003, 0.0035 if d['lod'] < 2 else 0.004, d['s'], 4, 'steel', axis='z', at=(0, 0, z)))
        o.append(hull([(-0.03, -0.105, z - 0.012), (0.03, -0.105, z - 0.012), (-0.03, -0.105, z + 0.012), (0.03, -0.105, z + 0.012),
                       (-0.045, -0.055, z - 0.008), (0.045, -0.055, z - 0.008), (-0.045, -0.055, z + 0.008), (0.045, -0.055, z + 0.008)], 'steel'))
    # Gözetleme camı (+X)
    o.append(cyl(0.024, 0.024, 0.006, d['m'], 'steel', axis='x', at=(R - 0.002, 0.01, 0.05)))
    o.append(cyl(0.017, 0.017, 0.003, d['m'], 'glass', axis='x', at=(R + 0.004, 0.01, 0.05)))
    # Dolum kapağı (üstte, tırtıllı) + zincir halkası
    o.append(cyl(0.02, 0.02, 0.014, d['m'], 'steel', at=(0, R - 0.004, -L * 0.3)))
    o.append(lathe([(0.024, R + 0.01), (0.024, R + 0.024)], d['m'], 'knurl', at=(0, 0, -L * 0.3), strip=TRIM['knurl'], ulen=0.02))
    o.append(cyl(0.024, 0.02, 0.004, d['m'], 'anodized', at=(0, R + 0.024, -L * 0.3)))
    if d['lod'] < 2:
        # etiket tank ekseni boyunca okunur
        o.append(plate(0.07, 0.018, placard_rect('OIL'), at=(0, 0, 0.07), rot=_tr(0, R + 0.0002, 0) @ rot('y', math.pi / 2)))
        o.append(weld_ring(0.02, 0.0018, d, at=(0, R - 0.005, -L * 0.3)))
    # Tahliye tapası
    o.append(hexp(0.016, 0.01, 'steel', axis='-y', at=(0, -R + 0.002, L * 0.15)))
    return o


@part
def fadec(d):
    """Motor kontrol ünitesi (FADEC/EEC): 220×80×300 mm kutu, kanatçıklar,
    dört dairesel konnektör (+Z yüzü), yalıtımlı ayaklar, bilgi plakası."""
    w, h, L = 0.22, 0.08, 0.3
    o = [cbox((w, h, L), 'paint', chamfer=0.008)]
    nf = 9 if d['lod'] == 0 else (5 if d['lod'] == 1 else 0)
    for k in range(nf):
        z = -L / 2 + 0.03 + k * (L - 0.06) / max(nf - 1, 1)
        o.append(cbox((w * 0.82, 0.014, 0.005), 'paint', at=(0, h / 2 + 0.007, z), chamfer=0.0015))
    for k in range(4):
        x = -w / 2 + 0.04 + k * (w - 0.08) / 3
        o.append(cyl(0.017, 0.017, 0.006, d['m'], 'steel', axis='z', at=(x, 0, L / 2)))
        o.append(cyl(0.013, 0.013, 0.02, d['m'], 'anodized', axis='z', at=(x, 0, L / 2 + 0.006)))
    for x, z in ((-w / 2 + 0.02, -L / 2 + 0.03), (w / 2 - 0.02, -L / 2 + 0.03), (-w / 2 + 0.02, L / 2 - 0.03), (w / 2 - 0.02, L / 2 - 0.03)):
        o.append(cyl(0.012, 0.012, 0.018, d['t'], 'rubber', at=(x, -h / 2 - 0.018, z)))
        o.append(cyl(0.015, 0.015, 0.003, d['t'], 'steel', at=(x, -h / 2 - 0.003, z)))
    if d['lod'] < 2:
        o.append(plate(0.1, 0.025, placard_rect('FADEC'), at=(0, 0, 0), rot=rot('z', -math.pi / 2) @ _tr(0, w / 2, 0)))
        o.append(strip_quad(w * 0.92, 0.01, TRIM['rivet'], 0.06, at=(0, 0, L / 2 - 0.006), rot=rot('x', math.pi / 2) @ _tr(0, 0, -h / 2 + 0.007), slot='rivet'))
    return o


@part
def connector(d):
    """Dairesel askeri konnektör (MIL-DTL-38999 benzeri) + arka kılıf;
    +Z'ye bakar (kutuya takılır, kablo +Z'den çıkar)."""
    o = [cyl(0.02, 0.02, 0.004, d['m'], 'steel', axis='z'),
         lathe([(0.0165, 0.004), (0.0165, 0.018)], d['m'], 'knurl', axis='z', strip=TRIM['knurl'], ulen=0.02) if d['lod'] < 2
         else cyl(0.0165, 0.0165, 0.014, d['m'], 'steel', axis='z', at=(0, 0, 0.004)),
         cyl(0.013, 0.009, 0.03, d['m'], 'anodized', axis='z', at=(0, 0, 0.018))]
    return o


@part
def harnessClamp(d):
    """Kablo demeti kelepçesi: Ø30 demeti saran yastıklı bant; kök demet
    merkezi, demet +Z yönünde, dil −Y."""
    o = [lathe([(0.0155, -0.006), (0.0175, -0.006), (0.0175, 0.006), (0.0155, 0.006), (0.0155, -0.006)], d['m'], 'ss', axis='z'),
         lathe([(0.0145, -0.0066), (0.0156, -0.0066), (0.0156, 0.0066), (0.0145, 0.0066)], d['m'], 'rubber', axis='z'),
         cbox((0.012, 0.012, 0.012), 'ss', at=(0, -0.022, 0), chamfer=0.0015)]
    o += bolt((0.006, -0.022, 0), d, af=0.007, h=0.0035, axis='x', washer=False)
    return o


@part
def liftLug(d):
    """Kaldırma kulağı: sarı boyalı delikli levha braketi + etiket."""
    o = [cbox((0.06, 0.008, 0.05), 'yellow', at=(0, 0.004, 0), chamfer=0.002)]
    ring = torus(0.022, 0.007, d['s'], d['t'], 'yellow', axis='z', at=(0, 0.035, 0))
    o.append(ring)
    o.append(hull([(-0.02, 0.008, -0.007), (0.02, 0.008, -0.007), (-0.02, 0.008, 0.007), (0.02, 0.008, 0.007),
                   (-0.014, 0.022, -0.007), (0.014, 0.022, -0.007), (-0.014, 0.022, 0.007), (0.014, 0.022, 0.007)], 'yellow'))
    for x in (-0.022, 0.022):
        for z in (-0.016, 0.016):
            o += bolt((x, 0.008, z), d, af=0.008, h=0.004, washer=False)
    if d['lod'] < 2:
        o.append(plate(0.034, 0.0085, placard_rect('LIFT'), at=(0, 0.0081, 0), rot=None))
    return o


@part
def drainValve(d):
    """Tahliye (drain) valfi: küçük dökme gövde, altıgen tapa, çıkış borusu."""
    o = [boss_pad(0.02, d),
         cbox((0.03, 0.022, 0.03), 'steel', at=(0, 0.017, 0), chamfer=0.004),
         hexp(0.016, 0.008, 'steel', axis='x', at=(0.015, 0.017, 0)),
         cyl(0.005, 0.005, 0.03, d['t'], 'ss', axis='z', at=(0, 0.017, 0.015))]
    return o


@part
def bracketL(d):
    """Genel amaçlı L braket (60 × 40 mm), iki cıvata."""
    o = [cbox((0.03, 0.004, 0.06), 'steel', at=(0, 0.002, 0), chamfer=0.001),
         cbox((0.03, 0.04, 0.004), 'steel', at=(0, 0.02, 0.028), chamfer=0.001),
         hull([(-0.002, 0.004, 0.026), (0.002, 0.004, 0.026), (-0.002, 0.004, 0.006), (0.002, 0.004, 0.006),
               (-0.002, 0.024, 0.026), (0.002, 0.024, 0.026)], 'steel')]
    for z in (-0.015, 0.008):
        o += bolt((0, 0.004, z), d, af=0.007, h=0.0035, washer=False)
    return o


@part
def flowArrow(d):
    """Borulara yapıştırılan akış yönü etiketi (ince levha)."""
    return [plate(0.05, 0.0125, placard_rect('FLOW'), lift=0.0)]


@part
def noStep(d):
    """'NO STEP' etiketi."""
    return [plate(0.06, 0.015, placard_rect('NOSTEP'), lift=0.0)]


# ---------------------------------------------------------------------------

def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='build/kit_raw.glb')
    ap.add_argument('--only', default='', help='virgülle ayrılmış parça listesi (önizleme için)')
    args = ap.parse_args(argv)
    t0 = time.time()
    reset()
    clear_mats()
    names = [n for n in PARTS if not args.only or n in args.only.split(',')]
    summary = []
    for name in names:
        tris = []
        for d in LODS:
            objs = [o for o in PARTS[name](d) if o is not None]
            obj = join(objs, f'KIT_{name}_L{d["lod"]}')
            tris.append(tri_count(obj))
        summary.append((name, tris))
        print(f'  {name:14s} üçgen L0/L1/L2 = {tris[0]:5d} / {tris[1]:5d} / {tris[2]:5d}', flush=True)
    total = [sum(t[k] for _, t in summary) for k in range(3)]
    print(f'toplam {len(summary)} parça, üçgen L0/L1/L2 = {total}', flush=True)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_materials='EXPORT',
                              export_image_format='NONE', export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_extras=False)
    print(f'yazıldı {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB) — {time.time() - t0:.1f} s', flush=True)


if __name__ == '__main__':
    main()
