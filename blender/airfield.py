"""
Havaalanı — motor çalıştırma alanı (engine run-up pad) olan bir hava üssü.

Koddan modellenir, glb olarak dışa aktarılır. Yüzeyler oyunda gerçek
malzeme taramalarıyla (ambientCG, CC0) kaplanır; bunun için her ağın iki UV
kanalı vardır:
    UVMap   (TEXCOORD_0)  ortam kapanması (AO) atlası — --ao ile pişirilir
    Meters  (TEXCOORD_1)  metre ölçekli döşeme UV'si — taramalar (uv1)
Malzeme adları oyundaki tarama malzemelerine eşlenir (src/core/airfield.ts).

Yerleşim (three.js eksenleri; motor orijinde, ekseni z boyunca, giriş −z):
    zemin y = −2.4 (motor yer taşıma standında)
    apron: x ∈ [−70, 70], z ∈ [−60, 40], 5 m'lik beton plakalar
    motor çalıştırma alanı: motorun etrafında boyalı sınır, "ENGINE RUN-UP"
    jet egzozu saptırma duvarı: z ≈ 26, 24 m genişlik, kavisli perdeler
    hangarlar: x ≈ −62, kapıları apron'a (+x) bakar
    kontrol kulesi: x ≈ 78, z ≈ −55
    taksi yolu → pist: pist z ≈ 170 boyunca, x ∈ [−1200, 1200]

    /home/user/bpyenv/bin/python blender/airfield.py --out build/airfield_raw.glb [--ao]
    node scripts/pack-kit.mjs build/airfield_raw.glb src/assets/airfield.glb
"""

import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

from kitlib import C, link, reset, select_only  # noqa: E402

FLOOR = -2.4
APRON = (-70.0, 70.0, -60.0, 40.0)   # x0, x1, z0, z1
RUNWAY_Z = 170.0
RUNWAY_HALF = 22.5
RUNWAY_LEN = 1200.0
TAXI_X = 48.0
TAXI_HALF = 11.5
FENCE_Z = 26.0

MATS = {}


def mat(name, color=(0.5, 0.5, 0.5), emit=0.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    if emit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emit
    MATS[name] = m
    return m


# ---------------------------------------------------------------------------
# Ağ oluşturucu (three koordinatları, "Meters" UV'si köşe başına)
# ---------------------------------------------------------------------------

class Builder:
    """Bir grup için köşe/yüz/UV/malzeme biriktirir, sonunda tek nesne yapar."""

    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []      # (indeksler, malzeme adı, [uv...])

    def quad(self, a, b, c, d, material, uvs=None, flip=False):
        """Dörtgen; uvs verilmezse yüz düzleminde metre izdüşümü."""
        pts = [Vector(p) for p in (a, b, c, d)]
        if uvs is None:
            n = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            ax = max(range(3), key=lambda i: abs(n[i]))
            pick = {0: (2, 1), 1: (0, 2), 2: (0, 1)}[ax]
            uvs = [(p[pick[0]], p[pick[1]]) for p in pts]
        i0 = len(self.verts)
        self.verts += pts
        idx = [i0, i0 + 1, i0 + 2, i0 + 3]
        if flip:
            idx = idx[::-1]
            uvs = uvs[::-1]
        self.faces.append((idx, material, list(uvs)))

    def box(self, center, size, material, rot_y=0.0, skip_bottom=True):
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        R = Matrix.Rotation(rot_y, 3, 'Y')
        c = [R @ Vector((x * sx, y * sy, z * sz)) + Vector(center)
             for x, y, z in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                             (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
        faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]
        for k, f in enumerate(faces):
            if skip_bottom and k == 2:
                continue
            self.quad(*(c[i] for i in f), material)

    def ground(self, x0, x1, z0, z1, y, material, uv_offset=(0, 0)):
        """Yatay dikdörtgen (yukarı bakar)."""
        ox, oz = uv_offset
        self.quad((x0, y, z1), (x1, y, z1), (x1, y, z0), (x0, y, z0), material,
                  uvs=[(x0 + ox, z1 + oz), (x1 + ox, z1 + oz), (x1 + ox, z0 + oz), (x0 + ox, z0 + oz)])

    def build(self):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata([tuple(C @ v.to_4d())[:3] for v in self.verts], [], [f[0] for f in self.faces])
        names = []
        for _, m, _ in self.faces:
            if m not in names:
                names.append(m)
        for n in names:
            me.materials.append(mat(n))
        for poly, (_, m, _) in zip(me.polygons, self.faces):
            poly.material_index = names.index(m)
            poly.use_smooth = False
        ao = me.uv_layers.new(name='UVMap')
        meters = me.uv_layers.new(name='Meters')
        for poly, (_, _, uvs) in zip(me.polygons, self.faces):
            for li, uv in zip(poly.loop_indices, uvs):
                meters.data[li].uv = uv
                ao.data[li].uv = uv
        me.validate()
        obj = link(bpy.data.objects.new(self.name, me))
        return obj


# ---------------------------------------------------------------------------
# Zemin: çimen, apron, taksi yolu, pist, omuzlar, işaretler
# ---------------------------------------------------------------------------

def build_ground():
    g = Builder('AF_ground')
    y = FLOOR
    ax0, ax1, az0, az1 = APRON
    # Çimen: apron ve yolların çevresi (üst üste binmesin diye parçalı)
    G = 1500.0
    y_g = y - 0.03
    # apron + taksi yolu + pist dışında kalan dört şerit halinde değil, basitçe
    # büyük bir çimen düzlemi: yollar biraz yukarıda çizilir
    g.ground(-G, G, -G, G, y_g, 'grass')

    # Apron (beton plakalar)
    g.ground(ax0, ax1, az0, az1, y, 'apron')
    # Apron kenarında çakıl şerit
    for (x0, x1, z0, z1) in ((ax0 - 3, ax0, az0 - 3, az1 + 3), (ax1, ax1 + 3, az0 - 3, az1 + 3),
                             (ax0, ax1, az0 - 3, az0), (ax0, TAXI_X - TAXI_HALF, az1, az1 + 3),
                             (TAXI_X + TAXI_HALF, ax1, az1, az1 + 3)):
        g.ground(x0, x1, z0, z1, y - 0.015, 'gravel')

    # Taksi yolu: apron'dan piste
    g.ground(TAXI_X - TAXI_HALF, TAXI_X + TAXI_HALF, az1, RUNWAY_Z - RUNWAY_HALF, y, 'taxiway')
    for s in (-1, 1):
        x = TAXI_X + s * TAXI_HALF
        g.ground(min(x, x + s * 4), max(x, x + s * 4), az1 + 3, RUNWAY_Z - RUNWAY_HALF - 7, y - 0.015, 'gravel')

    # Pist ve omuzları
    g.ground(-RUNWAY_LEN, RUNWAY_LEN, RUNWAY_Z - RUNWAY_HALF, RUNWAY_Z + RUNWAY_HALF, y, 'asphalt')
    for s in (-1, 1):
        z = RUNWAY_Z + s * RUNWAY_HALF
        g.ground(-RUNWAY_LEN, RUNWAY_LEN, min(z, z + s * 7.5), max(z, z + s * 7.5), y - 0.012, 'gravel')
    return g.build()


def build_markings():
    """Boya ve derzler: zeminden 2–4 mm yukarıda ince dörtgenler."""
    m = Builder('AF_markings')
    y = FLOOR + 0.004
    ax0, ax1, az0, az1 = APRON

    # Beton plaka derzleri (5 m)
    w = 0.012
    x = ax0 + 5
    while x < ax1 - 0.1:
        m.ground(x - w, x + w, az0, az1, y - 0.002, 'joint')
        x += 5
    z = az0 + 5
    while z < az1 - 0.1:
        m.ground(ax0, ax1, z - w, z + w, y - 0.002, 'joint')
        z += 5

    # Motor çalıştırma alanı: sarı-siyah sınır (motorun etrafında 16 × 30 m)
    bx0, bx1, bz0, bz1 = -8.0, 8.0, -14.0, 16.0
    lw = 0.3
    for (x0, x1, z0, z1) in ((bx0, bx1, bz0, bz0 + lw), (bx0, bx1, bz1 - lw, bz1),
                             (bx0, bx0 + lw, bz0, bz1), (bx1 - lw, bx1, bz0, bz1)):
        m.ground(x0, x1, z0, z1, y, 'paint_yellow')
    # Giriş tehlike bölgesi: girişin önünde kırmızı taralı şeritler
    for k in range(10):
        zz = bz0 + 0.8 + k * 1.1
        if zz > -6:
            break
        m.ground(-6.5, 6.5, zz, zz + 0.45, y, 'paint_red')
    # Egzoz tehlike bölgesi çizgisi (motorun arkasında)
    m.ground(-7.5, 7.5, 7.0, 7.3, y, 'paint_white')
    # Bağlama halkaları (motor standının tekerlek takozları için)
    for sx in (-1.5, 1.5):
        for sz in (-3.0, 3.0):
            m.ground(sx - 0.25, sx + 0.25, sz - 0.25, sz + 0.25, y, 'steel')

    # Taksi yolu merkez çizgisi (sarı) apron içinden motor alanına döner
    m.ground(TAXI_X - 0.15, TAXI_X + 0.15, -10, RUNWAY_Z - RUNWAY_HALF - 2, y, 'paint_yellow')
    m.ground(bx1 + 2, TAXI_X + 0.15, -10.15, -9.85, y, 'paint_yellow')
    # Apron kenar çizgileri (çift sarı)
    for off in (0.5, 0.9):
        m.ground(ax0, ax1, az1 - off - 0.15, az1 - off, y, 'paint_yellow')
    # Hangar önü park pozisyonları: kurşun çizgisi + durma çubuğu
    for hz in (-30.0, 12.0):
        m.ground(-55, -20, hz - 0.1, hz + 0.1, y, 'paint_yellow')
        m.ground(-54, -52.5, hz - 2.5, hz + 2.5, y, 'paint_yellow')

    # Pist işaretleri: merkez çizgisi, kenar çizgileri, eşik "piyano tuşları"
    yr = FLOOR + 0.004
    x = -RUNWAY_LEN + 60
    while x < RUNWAY_LEN - 60:
        m.ground(x, x + 30, RUNWAY_Z - 0.45, RUNWAY_Z + 0.45, yr, 'paint_white')
        x += 50
    for s in (-1, 1):
        z = RUNWAY_Z + s * (RUNWAY_HALF - 1)
        m.ground(-RUNWAY_LEN, RUNWAY_LEN, z - 0.45, z + 0.45, yr, 'paint_white')
    for end in (-1, 1):
        x0 = end * (RUNWAY_LEN - 6) - (30 if end > 0 else 0)
        for k in range(8):
            for s in (-1, 1):
                z = RUNWAY_Z + s * (3 + k * 2.3)
                m.ground(x0, x0 + 30, z - 0.9, z + 0.9, yr, 'paint_white')
        # nişan noktası işaretleri
        xa = end * (RUNWAY_LEN - 300)
        for s in (-1, 1):
            m.ground(xa - 22, xa + 22, RUNWAY_Z + s * 7 - 5, RUNWAY_Z + s * 7 + 5, yr, 'paint_white')
    # Pist lastik izleri (koyu, yarı saydam değil; hafif koyu asfalt)
    for k in range(6):
        xa = -RUNWAY_LEN + 330 + k * 25
        m.ground(xa, xa + 22, RUNWAY_Z - 6, RUNWAY_Z + 6, yr - 0.001, 'rubber_marks')
    return m.build()


def text_mesh(body, pos, size, rot_y, material):
    cu = bpy.data.curves.new('t', 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.offset = 0.02
    o = link(bpy.data.objects.new('txt', cu))
    o.data.materials.append(mat(material))
    select_only(o)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    # yatay: yazı XY düzleminde → three zemini (XZ); okuma yönü motor önünden
    M = Matrix.Translation(pos) @ Matrix.Rotation(rot_y, 4, 'Y') @ Matrix.Rotation(-math.pi / 2, 4, 'X')
    o.data.transform(M)
    o.data.transform(C)
    uv = o.data.uv_layers.new(name='UVMap')
    o.data.uv_layers.new(name='Meters')
    return o


# ---------------------------------------------------------------------------
# Hangar: kemerli çatı, oluklu sac, sürgülü kapılar
# ---------------------------------------------------------------------------

def build_hangar(name, cx, cz, width_z=44.0, depth_x=40.0, wall_h=9.0, rise=7.0, door_open=0.55):
    """cx: hangarın ön (kapı) yüzünün x'i; hangar −x yönüne uzanır."""
    h = Builder(name)
    y0 = FLOOR
    x_front = cx
    x_back = cx - depth_x
    z0 = cz - width_z / 2
    z1 = cz + width_z / 2
    n = 24
    # Kemer profili (z boyunca): duvar + tonoz
    prof = [(z0, y0), (z0, y0 + wall_h)]
    for i in range(1, n):
        t = i / n
        zz = z0 + t * width_z
        yy = y0 + wall_h + rise * math.sin(math.pi * t)
        prof.append((zz, yy))
    prof += [(z1, y0 + wall_h), (z1, y0)]
    # Çatı + yan duvarlar: profil boyunca x'e süpürülür (dış yüz)
    for k in range(len(prof) - 1):
        (za, ya), (zb, yb) = prof[k], prof[k + 1]
        s0 = sum(math.hypot(prof[j + 1][0] - prof[j][0], prof[j + 1][1] - prof[j][1]) for j in range(k))
        s1 = s0 + math.hypot(zb - za, yb - ya)
        mat_name = 'corrugated'
        # dış yüz (normal dışarı)
        h.quad((x_back, ya, za), (x_back, yb, zb), (x_front, yb, zb), (x_front, ya, za), mat_name,
               uvs=[(s0, 0), (s1, 0), (s1, depth_x), (s0, depth_x)])
        # iç yüz (koyu, aynı geometri ters)
        h.quad((x_front, ya, za), (x_front, yb, zb), (x_back, yb, zb), (x_back, ya, za), 'interior',
               uvs=[(s0, depth_x), (s1, depth_x), (s1, 0), (s0, 0)])
    # Arka duvar (profil dolgusu, fan üçgenleri → dörtgen şeritler)
    for k in range(len(prof) - 1):
        (za, ya), (zb, yb) = prof[k], prof[k + 1]
        # bu sarım −x'e (dışarı) bakar; iç yüz ters sarımla +x'e
        h.quad((x_back, y0, za), (x_back, y0, zb), (x_back, yb, zb), (x_back, ya, za), 'corrugated',
               uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)])
        h.quad((x_back + 0.05, y0, za), (x_back + 0.05, y0, zb), (x_back + 0.05, yb, zb), (x_back + 0.05, ya, za), 'interior',
               uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)], flip=True)
    # Ön cephe: kapı açıklığının üstünde "alın" duvarı
    door_h = wall_h + 1.5
    for k in range(len(prof) - 1):
        (za, ya), (zb, yb) = prof[k], prof[k + 1]
        lo_a, lo_b = y0 + door_h, y0 + door_h
        if ya <= lo_a and yb <= lo_b:
            continue
        # ön yüz +x'e (apron'a) bakmalı: sarım ters çevrilir; içte koyu yüz
        h.quad((x_front, max(lo_a, y0), za), (x_front, max(lo_b, y0), zb), (x_front, max(yb, lo_b), zb), (x_front, max(ya, lo_a), za),
               'corrugated', uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)], flip=True)
        h.quad((x_front - 0.05, max(lo_a, y0), za), (x_front - 0.05, max(lo_b, y0), zb), (x_front - 0.05, max(yb, lo_b), zb),
               (x_front - 0.05, max(ya, lo_a), za), 'interior', uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)])
    # Alın kirişi ve kapı rayı
    h.box((x_front + 0.3, y0 + door_h, cz), (0.6, 0.8, width_z + 0.4), 'steel_dark')
    h.box((x_front + 0.5, y0 + 0.05, cz), (0.4, 0.1, width_z * 1.9), 'steel_dark')
    # Sürgülü kapı panelleri: iki yana itilmiş (kısmen açık)
    panels = 6
    pw = width_z / panels
    for i in range(panels):
        side = -1 if i < panels / 2 else 1
        k = i if side < 0 else panels - 1 - i
        # dıştaki panel en çok itilir; kapı açıklık oranı door_open
        shift = side * (width_z / 2) * door_open * (1 - k / (panels / 2)) if door_open > 0 else 0
        zc = z0 + (i + 0.5) * pw + shift
        zc = max(z0 - width_z * 0.45, min(z1 + width_z * 0.45, zc))
        h.box((x_front + 0.35 + 0.18 * (k % 2), y0 + door_h / 2, zc), (0.12, door_h - 0.2, pw), 'shutter')
    # Kapı dikmeleri (yan kolonlar)
    for zz in (z0 - 0.3, z1 + 0.3):
        h.box((x_front, y0 + door_h / 2, zz), (0.8, door_h, 0.6), 'steel_dark')
    # Zemin (içeride beton, apron'dan devam)
    h.ground(x_back, x_front, z0, z1, y0 + 0.002, 'hangar_floor')
    # Tavan armatürleri (içeride, gece yanar)
    for xi in (x_back + depth_x * 0.3, x_back + depth_x * 0.7):
        for zi in (cz - width_z * 0.25, cz, cz + width_z * 0.25):
            h.box((xi, y0 + wall_h + rise * 0.85, zi), (1.8, 0.1, 0.5), 'lamp_warm')
    # Çatı sırtı havalandırma
    h.box(((x_front + x_back) / 2, y0 + wall_h + rise + 0.25, cz), (depth_x - 2, 0.5, 1.2), 'steel_dark')
    return h.build()


# ---------------------------------------------------------------------------
# Jet egzozu saptırma duvarı (blast deflector)
# ---------------------------------------------------------------------------

def build_blast_fence():
    b = Builder('AF_blastfence')
    y0 = FLOOR
    width = 26.0
    H = 5.0
    sections = 13
    sw = width / sections
    # Kavisli perde: profil (z, y) arkaya doğru bükülür
    prof = []
    for i in range(9):
        t = i / 8
        ang = t * math.radians(60)
        prof.append((FENCE_Z + 2.8 * (1 - math.cos(ang)) * 1.6, y0 + 0.4 + H * math.sin(ang) / math.sin(math.radians(60))))
    for s in range(sections):
        x0 = -width / 2 + s * sw
        x1 = x0 + sw - 0.06
        # yatay oluklu levhalar gibi: profil boyunca şeritler (ön yüz)
        acc = 0.0
        for k in range(len(prof) - 1):
            (za, ya), (zb, yb) = prof[k], prof[k + 1]
            l = math.hypot(zb - za, yb - ya)
            b.quad((x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb), 'galv',
                   uvs=[(x0, acc), (x1, acc), (x1, acc + l), (x0, acc + l)])
            b.quad((x0, yb, zb + 0.05), (x1, yb, zb + 0.05), (x1, ya, za + 0.05), (x0, ya, za + 0.05), 'galv',
                   uvs=[(x0, acc + l), (x1, acc + l), (x1, acc), (x0, acc)])
            acc += l
        # arka destek üçgeni (her bölmenin kenarında)
        xs = x0 + 0.02
        zt, yt = prof[-1]
        b.box((xs, (y0 + yt) / 2, zt + 1.6), (0.2, yt - y0, 0.25), 'steel_dark')
        b.box((xs, y0 + 0.2, (FENCE_Z + zt + 3) / 2), (0.25, 0.4, zt + 3 - FENCE_Z), 'steel_dark')
        # çapraz
        L = math.hypot(3.2, yt - y0)
        b.box((xs, (y0 + yt) / 2, zt + 0.1), (0.15, L, 0.18), 'steel_dark', rot_y=0.0)
    # Beton temel kirişi
    b.box((0, y0 + 0.2, FENCE_Z + 1.5), (width + 1, 0.4, 5.0), 'concrete')
    return b.build()


# ---------------------------------------------------------------------------
# Kontrol kulesi, ışık direkleri, pist lambaları
# ---------------------------------------------------------------------------

def build_tower(cx, cz):
    t = Builder('AF_tower')
    y0 = FLOOR
    H = 18.0
    t.box((cx, y0 + H / 2, cz), (7, H, 7), 'concrete')
    # kabin: eğik camlı sekizgen yerine kutu + cam
    cab_y = y0 + H
    t.box((cx, cab_y + 0.3, cz), (11, 0.6, 11), 'concrete')
    t.box((cx, cab_y + 2.3, cz), (10, 3.4, 10), 'glass')
    t.box((cx, cab_y + 4.2, cz), (11.5, 0.5, 11.5), 'steel_dark')
    t.box((cx, cab_y + 6.5, cz), (0.2, 4.2, 0.2), 'steel_dark')
    t.box((cx, cab_y + 8.6, cz), (0.5, 0.5, 0.5), 'light_red')
    # alt bina
    t.box((cx + 9, y0 + 3, cz), (12, 6, 16), 'concrete')
    for k in range(5):
        t.box((cx + 3.05, y0 + 3.5, cz - 6 + k * 3), (0.1, 1.6, 2.0), 'glass')
    return t.build()


def build_lights():
    L = Builder('AF_lights')
    y0 = FLOOR
    # Apron ışık direkleri (4)
    ax0, ax1, az0, az1 = APRON
    for (x, z) in ((ax0 + 4, az0 + 4), (ax1 - 4, az0 + 4), (ax0 + 4, az1 - 4), (ax1 - 4, az1 - 4)):
        L.box((x, y0 + 11, z), (0.5, 22, 0.5), 'galv')
        L.box((x, y0 + 22.2, z), (2.6, 0.5, 0.8), 'steel_dark')
        L.box((x, y0 + 21.9, z), (2.4, 0.08, 0.6), 'lamp_white')
    # Pist kenar lambaları (60 m aralık) ve taksi yolu mavi lambaları
    x = -RUNWAY_LEN + 30
    while x < RUNWAY_LEN:
        for s in (-1, 1):
            L.box((x, y0 + 0.2, RUNWAY_Z + s * (RUNWAY_HALF + 1.5)), (0.25, 0.4, 0.25), 'light_white')
        x += 60
    z = APRON[3] + 10
    while z < RUNWAY_Z - RUNWAY_HALF - 5:
        for s in (-1, 1):
            L.box((TAXI_X + s * (TAXI_HALF + 1), y0 + 0.15, z), (0.2, 0.3, 0.2), 'light_blue')
        z += 20
    return L.build()


# ---------------------------------------------------------------------------
# AO pişirme (isteğe bağlı): UVMap'e lightmap atlası + Cycles AO
# ---------------------------------------------------------------------------

def bake_ao(obj, size, samples, outdir):
    select_only(obj)
    me = obj.data
    me.uv_layers.active = me.uv_layers['UVMap']
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{obj.name}_ao', size, size, float_buffer=False, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    for m in me.materials:
        nt = m.node_tree
        node = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'BAKE'
        node.image = img
        nt.nodes.active = node
    bpy.context.scene.cycles.samples = samples
    t0 = time.time()
    bpy.ops.object.bake(type='AO', margin=4, use_clear=True)
    img.filepath_raw = os.path.join(outdir, f'{obj.name}_ao.png')
    img.file_format = 'PNG'
    img.save()
    print(f'  AO {obj.name}: {time.time() - t0:.0f} s', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='build/airfield_raw.glb')
    ap.add_argument('--ao', action='store_true')
    ap.add_argument('--ao-size', type=int, default=2048)
    ap.add_argument('--samples', type=int, default=32)
    args = ap.parse_args(argv)
    t0 = time.time()
    reset()
    bpy.context.scene.world.light_settings.distance = 6.0
    objs = [
        build_ground(),
        build_markings(),
        build_hangar('AF_hangar_a', -52.0, -30.0),
        build_hangar('AF_hangar_b', -52.0, 18.0, door_open=0.0),
        build_blast_fence(),
        build_tower(80.0, -58.0),
        build_lights(),
    ]
    # Motorun önünden (−z) bakana düz okunur
    txt = text_mesh('ENGINE RUN-UP', (0, FLOOR + 0.005, -11.2), 1.6, math.pi, 'paint_white')
    objs.append(txt)
    for o in objs:
        print(f'  {o.name}: {len(o.data.polygons)} yüz', flush=True)
    if args.ao:
        outdir = os.path.dirname(os.path.abspath(args.out))
        for o in objs:
            if o.name in ('AF_ground', 'AF_hangar_a', 'AF_hangar_b', 'AF_blastfence'):
                bake_ao(o, args.ao_size, args.samples, outdir)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_materials='EXPORT',
                              export_image_format='NONE', export_yup=True, export_texcoords=True,
                              export_normals=True, export_apply=True)
    print(f'yazıldı {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB) — {time.time() - t0:.1f} s', flush=True)


if __name__ == '__main__':
    main()
