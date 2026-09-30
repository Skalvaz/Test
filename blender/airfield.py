"""
Havaalanı — motor çalıştırma alanı (engine run-up pad) olan bir hava üssü.

Koddan modellenir, glb olarak dışa aktarılır. Yüzeyler oyunda gerçek
malzeme taramalarıyla (ambientCG, CC0) kaplanır; bunun için her ağın iki UV
kanalı vardır:
    UVMap   (TEXCOORD_0)  ortam kapanması (AO) atlası — --ao ile pişirilir
    Meters  (TEXCOORD_1)  metre ölçekli döşeme UV'si — taramalar (uv1)
Malzeme adları oyundaki tarama malzemelerine eşlenir (src/core/airfield.ts).

Arazi (çimen, tepeler), bitki örtüsü ve hazır modeller (Poly Haven: beton
bariyer, tel çit, elektrik direkleri, jeneratör…) oyunda eklenir; bu betik
yapıları ve zemin kaplamalarını üretir.

Yerleşim (three.js eksenleri; motor orijinde, ekseni z boyunca, giriş −z):
    zemin y = −2.4 (motor yer taşıma standında)
    apron: x ∈ [−52, 70], z ∈ [−60, 40], 5 m'lik beton plakalar
    motor çalıştırma alanı: motorun etrafında boyalı sınır, "ENGINE RUN-UP"
    jet egzozu saptırma duvarı: z ≈ 26, kavisli perdeler
    hangarlar: ön yüzleri x = −52, kapıları apron'a (+x) bakar
    doğu (kara tarafı): kule, operasyon binası, itfaiye, otopark
    güney: servis yolu, yakıt tankları
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
from mathutils import Matrix, Vector  # noqa: E402

from kitlib import C, link, reset, select_only  # noqa: E402
from facade_textures import SIGNS  # noqa: E402

FLOOR = -2.4
APRON = (-52.0, 70.0, -60.0, 40.0)   # x0, x1, z0, z1
RUNWAY_Z = 170.0
RUNWAY_HALF = 22.5
RUNWAY_LEN = 1200.0
TAXI_X = 48.0
TAXI_HALF = 11.5
FENCE_Z = 26.0
HANGAR_X = -52.0          # hangar ön yüzü
HANGAR_DEPTH = 40.0
HANGARS = (('A', -30.0, 0.55), ('B', 18.0, 0.0))   # ad, merkez z, kapı açıklığı
HANGAR_W = 44.0

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

BOX_FACES = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]
BOX_CORNERS = ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
               (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))


class Builder:
    """Bir grup için köşe/yüz/UV/malzeme biriktirir, sonunda tek nesne yapar."""

    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []      # (indeksler, malzeme adı, [uv...])

    def poly(self, pts, material, uvs=None, flip=False):
        """Dışbükey çokgen; uvs verilmezse yüz düzleminde metre izdüşümü.
        Normal (p1 − p0) × (p_son − p0) yönündedir."""
        pts = [Vector(p) for p in pts]
        if uvs is None:
            n = (pts[1] - pts[0]).cross(pts[-1] - pts[0])
            ax = max(range(3), key=lambda i: abs(n[i]))
            pick = {0: (2, 1), 1: (0, 2), 2: (0, 1)}[ax]
            uvs = [(p[pick[0]], p[pick[1]]) for p in pts]
        i0 = len(self.verts)
        self.verts += pts
        idx = list(range(i0, i0 + len(pts)))
        uvs = list(uvs)
        if flip:
            idx = idx[::-1]
            uvs = uvs[::-1]
        self.faces.append((idx, material, uvs))

    def quad(self, a, b, c, d, material, uvs=None, flip=False):
        self.poly((a, b, c, d), material, uvs, flip)

    def _frame_box(self, center, ex, ey, ez, size, material, skip=()):
        c = [Vector(center) + ex * (x * size[0] / 2) + ey * (y * size[1] / 2) + ez * (z * size[2] / 2)
             for x, y, z in BOX_CORNERS]
        for k, f in enumerate(BOX_FACES):
            if k in skip:
                continue
            self.quad(*(c[i] for i in f), material)

    def box(self, center, size, material, rot_y=0.0, skip_bottom=True):
        R = Matrix.Rotation(rot_y, 3, 'Y')
        self._frame_box(center, R @ Vector((1, 0, 0)), R @ Vector((0, 1, 0)), R @ Vector((0, 0, 1)),
                        size, material, skip=(2,) if skip_bottom else ())

    def beam(self, p0, p1, w, h, material, up=(0, 1, 0)):
        """p0'dan p1'e uzanan dikdörtgen kesitli kiriş (w: yan, h: 'yukarı' yönü)."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        if L < 1e-6:
            return
        dn = d / L
        right = dn.cross(Vector(up))
        if right.length < 1e-4:
            right = dn.cross(Vector((1, 0, 0)))
        right.normalize()
        upv = right.cross(dn).normalized()
        ez = right.cross(upv)
        self._frame_box((p0 + p1) / 2, right, upv, ez, (w, h, L), material)

    def cyl(self, base, axis, radius, length, material, segs=12, caps=True, r2=None):
        """Silindir (r2 verilirse kesik koni); base: bir uç merkezi, axis: yön."""
        a = Vector(axis).normalized()
        ref = Vector((0, 1, 0)) if abs(a.y) < 0.9 else Vector((1, 0, 0))
        ex = ref.cross(a).normalized()
        ey = a.cross(ex)
        r2 = radius if r2 is None else r2
        b0 = Vector(base)
        b1 = b0 + a * length
        ring0 = [b0 + (ex * math.cos(t) + ey * math.sin(t)) * radius for t in (2 * math.pi * i / segs for i in range(segs))]
        ring1 = [b1 + (ex * math.cos(t) + ey * math.sin(t)) * r2 for t in (2 * math.pi * i / segs for i in range(segs))]
        circ = 2 * math.pi * max(radius, r2)
        for i in range(segs):
            j = (i + 1) % segs
            u0, u1 = circ * i / segs, circ * (i + 1) / segs
            self.quad(ring0[i], ring0[j], ring1[j], ring1[i], material,
                      uvs=[(u0, 0), (u1, 0), (u1, length), (u0, length)])
        if caps:
            self.poly(ring1, material)
            self.poly(ring0[::-1], material)

    def ground(self, x0, x1, z0, z1, y, material, uv_offset=(0, 0)):
        """Yatay dikdörtgen (yukarı bakar)."""
        ox, oz = uv_offset
        self.quad((x0, y, z1), (x1, y, z1), (x1, y, z0), (x0, y, z0), material,
                  uvs=[(x0 + ox, z1 + oz), (x1 + ox, z1 + oz), (x1 + ox, z0 + oz), (x0 + ox, z0 + oz)])

    def wall(self, axis, coord, u0, u1, y0, y1, material, facing, uv=None):
        """Eksene dik düşey dikdörtgen. axis 'x': düzlem x = coord, u = z;
        axis 'z': düzlem z = coord, u = x. facing: +1 / −1 (normal yönü).
        uv = (a0, b0, a1, b1): dokulu yüzeyler için açık UV dikdörtgeni;
        bakana göre soldan sağa artacak şekilde çevrilir (ayna görüntü olmaz)."""
        if uv is None:
            uvs = [(u0, y0), (u1, y0), (u1, y1), (u0, y1)]
        else:
            a0, b0, a1, b1 = uv
            if (axis == 'z' and facing < 0) or (axis == 'x' and facing > 0):
                a0, a1 = a1, a0
            uvs = [(a0, b0), (a1, b0), (a1, b1), (a0, b1)]
        if axis == 'x':
            pts = [(coord, y0, u0), (coord, y0, u1), (coord, y1, u1), (coord, y1, u0)]
            # normal = (b − a) × (d − a) = +z × +y = −x
            flip = facing > 0
        else:
            pts = [(u0, y0, coord), (u1, y0, coord), (u1, y1, coord), (u0, y1, coord)]
            # +x × +y = +z
            flip = facing < 0
        self.quad(*pts, material, uvs=uvs, flip=flip)

    def plate(self, key, axis, coord, facing, u, y, w, h, post=0.0):
        """Levha: ince çelik arka kutu + atlas yüzü (facade_textures.SIGNS).
        post > 0: levha yerden bu yükseklikte iki ayaklı direğe takılır."""
        x0, y0a, x1, y1a = SIGNS[key]
        uv = (x0 / 2.0, 1.0 - y1a, x1 / 2.0, 1.0 - y0a)
        d = 0.025
        c = coord + facing * d
        if axis == 'x':
            self.box((c, y, u), (2 * d, h, w), 'steel_dark', skip_bottom=False)
        else:
            self.box((u, y, c), (w, h, 2 * d), 'steel_dark', skip_bottom=False)
        self.wall(axis, coord + facing * (2 * d + 0.003), u - w / 2, u + w / 2, y - h / 2, y + h / 2, 'signs', facing, uv=uv)
        if post > 0:
            for s in (-1, 1):
                pu = u + s * w * 0.35
                at = (c - facing * 0.04, (FLOOR + y - h / 2) / 2 + 0.2, pu) if axis == 'x' else (pu, (FLOOR + y - h / 2) / 2 + 0.2, c - facing * 0.04)
                self.box(at, (0.05, y - h / 2 - FLOOR + 0.4, 0.05), 'galv')

    def window(self, axis, coord, facing, u, y, w, h, glass='glass', frame='frame', sill='concrete'):
        """Duvar üstünde pencere: cam, çıkıntılı çerçeve ve denizlik."""
        n = 0.035 * facing
        self.wall(axis, coord + n, u - w / 2, u + w / 2, y, y + h, glass, facing)
        t = 0.07
        d = 0.09
        def at(uu, yy, off=0.0):
            return (coord + facing * off, yy, uu) if axis == 'x' else (uu, yy, coord + facing * off)
        sz = (lambda a, b, c: (c, b, a)) if axis == 'x' else (lambda a, b, c: (a, b, c))
        self.box(at(u, y + h, d / 2), sz(w + 2 * t, t, d), frame, skip_bottom=False)
        self.box(at(u, y, d / 2), sz(w + 2 * t, t, d), frame, skip_bottom=False)
        for s in (-1, 1):
            self.box(at(u + s * (w / 2 + t / 2), y + h / 2, d / 2), sz(t, h, d), frame)
        # orta kayıt
        self.box(at(u, y + h / 2, d / 2 - 0.02), sz(0.045, h, d * 0.6), frame)
        self.box(at(u, y - 0.06, 0.12), sz(w + 0.3, 0.06, 0.24), sill)

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


FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
SIGN_FONT = 'BarlowCondensed-Bold.ttf'
STENCIL_FONT = 'SairaStencilOne-Regular.ttf'


def text_obj(body, pos, size, material, rot_y=0.0, flat=False, align='CENTER', font=SIGN_FONT, extrude=0.0, spacing=1.0):
    """Yazı ağı. flat: zemine yatık (yukarı bakar); değilse düşey, +z'ye bakar
    (rot_y ile döndürülür). extrude: kabartma harf derinliğinin yarısı (m)."""
    cu = bpy.data.curves.new('t', 'FONT')
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font), check_existing=True)
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    cu.extrude = extrude
    # Eğri çözünürlüğü: harf boyuna göre (büyük pist numarası bile 4 yeter)
    cu.resolution_u = 3 if size < 1.0 else 4
    if extrude:
        cu.bevel_depth = min(extrude * 0.3, 0.008)
        cu.bevel_resolution = 0
    o = link(bpy.data.objects.new('txt', cu))
    o.data.materials.append(mat(material))
    select_only(o)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    M = Matrix.Translation(pos) @ Matrix.Rotation(rot_y, 4, 'Y') @ Matrix.Translation((0, 0, extrude))
    if flat:
        M = M @ Matrix.Rotation(-math.pi / 2, 4, 'X')
    o.data.transform(M)
    o.data.transform(C)
    o.data.uv_layers.new(name='UVMap')
    o.data.uv_layers.new(name='Meters')
    return o


def text_mesh(body, pos, size, rot_y, material):
    return text_obj(body, pos, size, material, rot_y=rot_y, flat=True)


# ---------------------------------------------------------------------------
# Zemin kaplamaları: apron, taksi yolu, pist, yollar, omuzlar
# (çimenli arazi oyunda üretilir: core/terrain.ts)
# ---------------------------------------------------------------------------

def build_ground():
    g = Builder('AF_ground')
    y = FLOOR
    ax0, ax1, az0, az1 = APRON

    # Apron (beton plakalar)
    g.ground(ax0, ax1, az0, az1, y, 'apron')
    # Hangar çevresi servis betonu (hangar tabanları hangarlarla birlikte)
    hz = [(cz - HANGAR_W / 2, cz + HANGAR_W / 2) for _, cz, _ in HANGARS]
    xb = HANGAR_X - HANGAR_DEPTH
    for (z0, z1) in ((az0, hz[0][0]), (hz[0][1], hz[1][0]), (hz[1][1], az1)):
        g.ground(xb - 8, ax0, z0, z1, y, 'concrete')
    g.ground(xb - 8, xb, hz[0][0], hz[1][1], y, 'concrete')
    # Apron kenarında çakıl şerit
    for (x0, x1, z0, z1) in ((ax1, ax1 + 2, az0 - 2, az1 + 2),
                             (xb - 10, TAXI_X - TAXI_HALF, az1, az1 + 2),
                             (TAXI_X + TAXI_HALF, ax1, az1, az1 + 2),
                             (xb - 10, xb - 8, az0 - 2, az1 + 2)):
        g.ground(x0, x1, z0, z1, y - 0.015, 'gravel')

    # Taksi yolu: apron'dan piste (asfalt), omuzlarda çakıl
    g.ground(TAXI_X - TAXI_HALF, TAXI_X + TAXI_HALF, az1, RUNWAY_Z - RUNWAY_HALF, y, 'taxiway')
    for s in (-1, 1):
        x = TAXI_X + s * TAXI_HALF
        g.ground(min(x, x + s * 4), max(x, x + s * 4), az1 + 2, RUNWAY_Z - RUNWAY_HALF - 7, y - 0.015, 'gravel')

    # Pist ve omuzları
    g.ground(-RUNWAY_LEN, RUNWAY_LEN, RUNWAY_Z - RUNWAY_HALF, RUNWAY_Z + RUNWAY_HALF, y, 'asphalt')
    for s in (-1, 1):
        z = RUNWAY_Z + s * RUNWAY_HALF
        g.ground(-RUNWAY_LEN, RUNWAY_LEN, min(z, z + s * 7.5), max(z, z + s * 7.5), y - 0.012, 'gravel')
    # Pist sonu dönüş cepleri
    for end in (-1, 1):
        x = end * RUNWAY_LEN
        g.ground(min(x, x + end * 60), max(x, x + end * 60), RUNWAY_Z - RUNWAY_HALF, RUNWAY_Z + RUNWAY_HALF, y - 0.004, 'taxiway')

    # Kara tarafı yolları (asfalt) ve otopark
    for (x0, x1, z0, z1) in ROADS:
        g.ground(x0, x1, z0, z1, y + 0.001, 'road')
    # Kaldırım/bina çevresi beton
    for (x0, x1, z0, z1) in PAVED:
        g.ground(x0, x1, z0, z1, y + 0.002, 'concrete')
    return g.build()


# Yollar: (x0, x1, z0, z1)
ROADS = [
    (72.0, 79.0, -110.0, 38.0),       # apron doğu kenarı boyunca servis yolu
    (-100.0, 150.0, -112.0, -104.0),  # güney servis yolu
    (132.0, 140.0, -420.0, -112.0),   # dış kapıya giden yol
    (122.0, 150.0, -100.0, -62.0),    # otopark
    (79.0, 122.0, -70.0, -62.0),      # otopark bağlantısı
]
PAVED = [
    (80.0, 121.0, -103.0, -99.0),     # operasyon binası önü
    (79.0, 106.0, -30.0, -2.0),       # itfaiye önü (apron tarafı)
    (86.0, 118.0, -58.0, -30.0),      # kule çevresi
    (-36.0, 12.0, -101.0, -76.0),     # yakıt sahası
]


def build_markings():
    """Boya ve derzler: zeminden 2–4 mm yukarıda ince dörtgenler (oyunda
    ayrıca polygonOffset ile zemine yapışık çizilir)."""
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

    # Motor çalıştırma alanı: sarı sınır (motorun etrafında 16 × 30 m)
    bx0, bx1, bz0, bz1 = -8.0, 8.0, -14.0, 16.0
    lw = 0.3
    for (x0, x1, z0, z1) in ((bx0, bx1, bz0, bz0 + lw), (bx0, bx1, bz1 - lw, bz1),
                             (bx0, bx0 + lw, bz0, bz1), (bx1 - lw, bx1, bz0, bz1)):
        m.ground(x0, x1, z0, z1, y, 'paint_yellow')
    # İkinci (dış) sınır: kesikli kırmızı — emme tehlike bölgesi
    for (x0, x1, z0, z1) in ((bx0 - 1.2, bx1 + 1.2, bz0 - 1.5, bz0 - 1.25),):
        xx = x0
        while xx < x1:
            m.ground(xx, min(xx + 1.2, x1), z0, z1, y, 'paint_red')
            xx += 2.0
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
    # Bekleme noktası (holding position): iki düz + iki kesikli sarı çizgi
    zh = RUNWAY_Z - RUNWAY_HALF - 45
    for k, off in enumerate((0.0, 0.45, 1.2, 1.65)):
        if k < 2:
            m.ground(TAXI_X - TAXI_HALF + 0.5, TAXI_X + TAXI_HALF - 0.5, zh + off, zh + off + 0.15, y, 'paint_yellow')
        else:
            xx = TAXI_X - TAXI_HALF + 0.5
            while xx < TAXI_X + TAXI_HALF - 0.5:
                m.ground(xx, min(xx + 1.0, TAXI_X + TAXI_HALF - 0.5), zh + off, zh + off + 0.15, y, 'paint_yellow')
                xx += 2.0
    # Taksi yolu kenar çizgileri (çift sarı)
    for s in (-1, 1):
        for off in (0.4, 0.7):
            xx = TAXI_X + s * (TAXI_HALF - off)
            m.ground(xx - 0.075, xx + 0.075, az1 + 2, RUNWAY_Z - RUNWAY_HALF - 1, y, 'paint_yellow')
    # Apron kenar çizgileri (çift sarı)
    for off in (0.5, 0.9):
        m.ground(ax0, ax1, az1 - off - 0.15, az1 - off, y, 'paint_yellow')
    # Hangar önü park pozisyonları: kurşun çizgisi + durma çubuğu + kanat ucu
    for _, hz, _ in HANGARS:
        m.ground(ax0 + 1, -20, hz - 0.1, hz + 0.1, y, 'paint_yellow')
        m.ground(ax0 + 3, ax0 + 4.5, hz - 2.5, hz + 2.5, y, 'paint_yellow')
        for s in (-1, 1):
            zz = hz + s * 9
            xx = ax0 + 6
            while xx < -24:
                m.ground(xx, xx + 1.5, zz - 0.08, zz + 0.08, y, 'paint_red')
                xx += 3.0
    # Hangar kapısı önü: sarı-siyah tehlike şeridi (kapı rayı boyunca)
    for _, hz, open_ in HANGARS:
        z0 = hz - HANGAR_W / 2
        k = 0
        zz = z0
        while zz < z0 + HANGAR_W:
            m.ground(HANGAR_X + 1.1, HANGAR_X + 1.5, zz, min(zz + 0.5, z0 + HANGAR_W), y, 'paint_yellow' if k % 2 == 0 else 'paint_black')
            zz += 0.5
            k += 1
    # Servis yolu: apron'dan ayıran beyaz kesikli çizgi (araç yolu)
    zz = az0 + 2
    while zz < az1 - 2:
        m.ground(ax1 - 3.2, ax1 - 3.05, zz, zz + 3, y, 'paint_white')
        zz += 6
    # Otopark çizgileri
    for k in range(14):
        xx = 123 + k * 2.6
        if xx > 149:
            break
        for (z0, z1) in ((-99.5, -94.5), (-67.5, -62.5)):
            m.ground(xx - 0.06, xx + 0.06, z0, z1, y + 0.001, 'paint_white')
    # Yol orta çizgileri
    for (x0, x1, z0, z1) in ROADS[:3]:
        if x1 - x0 > z1 - z0:
            zc = (z0 + z1) / 2
            xx = x0 + 2
            while xx < x1 - 3:
                m.ground(xx, xx + 3, zc - 0.06, zc + 0.06, y + 0.001, 'paint_white')
                xx += 9
        else:
            xc = (x0 + x1) / 2
            zz = z0 + 2
            while zz < z1 - 3:
                m.ground(xc - 0.06, xc + 0.06, zz, zz + 3, y + 0.001, 'paint_white')
                zz += 9

    # Drenaj ızgaraları: apron kuzey kenarında ve çalıştırma alanı çevresinde
    m.ground(ax0 + 2, TAXI_X - TAXI_HALF - 1, az1 - 2.3, az1 - 1.95, y - 0.001, 'grate')
    m.ground(bx0 - 3, bx1 + 3, bz0 - 3.4, bz0 - 3.05, y - 0.001, 'grate')
    m.ground(bx0 - 3.4, bx0 - 3.05, bz0 - 3, FENCE_Z - 2, y - 0.001, 'grate')
    m.ground(bx1 + 3.05, bx1 + 3.4, bz0 - 3, FENCE_Z - 2, y - 0.001, 'grate')

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
        # nişan noktası ve temas bölgesi işaretleri
        xa = end * (RUNWAY_LEN - 300)
        for s in (-1, 1):
            m.ground(xa - 22, xa + 22, RUNWAY_Z + s * 7 - 5, RUNWAY_Z + s * 7 + 5, yr, 'paint_white')
            for k in range(3):
                xt = end * (RUNWAY_LEN - 150 - k * 150)
                for j in range(3 - k):
                    zz = RUNWAY_Z + s * (4 + j * 2.2)
                    m.ground(xt - 11, xt + 11, zz - 0.8, zz + 0.8, yr, 'paint_white')
    # Pist lastik izleri (temas bölgelerinde)
    for end in (-1, 1):
        for k in range(8):
            xa = end * (RUNWAY_LEN - 330 - k * 22) - 11
            m.ground(xa, xa + 20, RUNWAY_Z - 6.5 + (k % 3) * 0.6, RUNWAY_Z + 6.5 - (k % 2) * 0.8, yr - 0.001, 'rubber_marks')
    return m.build()


def build_runway_text():
    """Pist numaraları (27 / 09) ve apron yazıları."""
    objs = []
    for end, num in ((-1, '09'), (1, '27')):
        x = end * (RUNWAY_LEN - 55)
        # Numara, pist ucuna yaklaşan uçaktan okunur
        objs.append(text_obj(num, (x, FLOOR + 0.005, RUNWAY_Z), 9.0, 'paint_white',
                             rot_y=-end * math.pi / 2, flat=True))
    # Motorun önünden (−z) bakana düz okunur
    objs.append(text_obj('MOTOR ÇALIŞTIRMA', (0, FLOOR + 0.005, -11.2), 1.5, 'paint_white', rot_y=math.pi, flat=True, font=STENCIL_FONT))
    objs.append(text_obj('JET EGZOZU  -  GİRMEYİNİZ', (0, FLOOR + 0.005, 13.6), 0.62, 'paint_red', flat=True, font=STENCIL_FONT))
    for n, (name, hz, _) in enumerate(HANGARS):
        objs.append(text_obj(f'H{n + 1}', (APRON[0] + 9, FLOOR + 0.005, hz + 4), 1.6, 'paint_yellow', rot_y=-math.pi / 2, flat=True, font=STENCIL_FONT))
    return objs


# ---------------------------------------------------------------------------
# Hangar: kemerli çatı, oluklu sac, sürgülü kapılar, kafes kirişler
# ---------------------------------------------------------------------------

def arch_profile(z0, width, y0, wall_h, rise, n=24):
    prof = [(z0, y0), (z0, y0 + wall_h)]
    for i in range(1, n):
        t = i / n
        prof.append((z0 + t * width, y0 + wall_h + rise * math.sin(math.pi * t)))
    prof += [(z0 + width, y0 + wall_h), (z0 + width, y0)]
    return prof


def build_hangar(label, number, cz, door_open, interior=True):
    """Ön yüz x = HANGAR_X; hangar −x yönüne uzanır."""
    name = f'AF_hangar_{label.lower()}'
    h = Builder(name)
    y0 = FLOOR
    width_z, depth_x, wall_h, rise = HANGAR_W, HANGAR_DEPTH, 9.0, 7.0
    x_front = HANGAR_X
    x_back = x_front - depth_x
    z0 = cz - width_z / 2
    z1 = cz + width_z / 2
    plinth = 1.2
    prof = arch_profile(z0, width_z, y0, wall_h, rise)
    # Profilin duvar kısmı kaide üstünden başlar
    prof_clad = [(prof[0][0], y0 + plinth)] + prof[1:-1] + [(prof[-1][0], y0 + plinth)]

    def inset(z, y, d=0.06):
        # Duvar noktaları yatay, kemer noktaları eğri normali boyunca içeri
        if abs(z - z0) < 1e-6:
            return (z + d, y)
        if abs(z - z1) < 1e-6:
            return (z - d, y)
        t = (z - z0) / width_z
        tz, ty = width_z, rise * math.pi * math.cos(math.pi * t)
        l = math.hypot(tz, ty)
        return (z + ty / l * d, y - tz / l * d)

    # Çatı + yan duvarlar: profil boyunca x'e süpürülür (dış yüz) + koyu iç yüz
    acc = 0.0
    lens = []
    for k in range(len(prof_clad) - 1):
        (za, ya), (zb, yb) = prof_clad[k], prof_clad[k + 1]
        l = math.hypot(zb - za, yb - ya)
        s0, s1 = acc, acc + l
        acc = s1
        lens.append((s0, s1))
        h.quad((x_back, ya, za), (x_back, yb, zb), (x_front, yb, zb), (x_front, ya, za), 'corrugated',
               uvs=[(s0, 0), (s1, 0), (s1, depth_x), (s0, depth_x)])
        # İç kaplama 6 cm içeride (aynı düzlemde olursa AO pişirmesinde birbirini kapatır)
        (zia, yia), (zib, yib) = inset(za, ya), inset(zb, yb)
        h.quad((x_front - 0.06, yia, zia), (x_front - 0.06, yib, zib), (x_back + 0.06, yib, zib), (x_back + 0.06, yia, zia), 'interior',
               uvs=[(s0, depth_x), (s1, depth_x), (s1, 0), (s0, 0)])
    # Çatı ışıklıkları: kemer üstünde üç şerit (yarı saydam polikarbonat)
    arch = prof_clad[2:-2]
    for t in (0.25, 0.5, 0.75):
        k = int(t * (len(arch) - 1))
        (za, ya), (zb, yb) = arch[k], arch[k + 1]
        nz, ny = -(yb - ya), (zb - za)
        nl = math.hypot(nz, ny)
        nz, ny = nz / nl * 0.03, ny / nl * 0.03
        xx = x_back + 2
        while xx < x_front - 3:
            h.quad((xx, ya + ny, za + nz), (xx, yb + ny, zb + nz), (xx + 3.0, yb + ny, zb + nz), (xx + 3.0, ya + ny, za + nz), 'skylight')
            xx += 5.5
    # Kaide (beton, hafif çıkıntılı): yan ve arka duvar
    for zz, f in ((z0, -1), (z1, 1)):
        h.wall('z', zz + f * 0.08, x_back - 0.08, x_front, y0, y0 + plinth, 'concrete', f)
        h.box((x_front - depth_x / 2, y0 + plinth + 0.03, zz + f * 0.04), (depth_x + 0.16, 0.06, 0.16), 'concrete')
    h.wall('x', x_back - 0.08, z0 - 0.08, z1 + 0.08, y0, y0 + plinth, 'concrete', -1)
    # Arka duvar (profil dolgusu)
    for k in range(len(prof) - 1):
        (za, ya), (zb, yb) = prof[k], prof[k + 1]
        ylo = y0 + plinth
        if max(ya, yb) <= ylo + 1e-3:
            continue
        ya2, yb2 = max(ya, ylo), max(yb, ylo)
        h.quad((x_back, ylo, za), (x_back, ylo, zb), (x_back, yb2, zb), (x_back, ya2, za), 'corrugated',
               uvs=[(0, za), (0, zb), (yb2 - y0, zb), (ya2 - y0, za)])
        h.quad((x_back + 0.05, y0, za), (x_back + 0.05, y0, zb), (x_back + 0.05, yb, zb), (x_back + 0.05, ya, za), 'interior',
               uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)], flip=True)
    # Saçak oluğu ve iniş boruları (yan duvarlar)
    for zz, f in ((z0, -1), (z1, 1)):
        h.box((x_front - depth_x / 2, y0 + wall_h - 0.1, zz + f * 0.18), (depth_x + 0.4, 0.22, 0.28), 'galv')
        for xx in (x_back + 1.0, x_back + depth_x / 2, x_front - 1.2):
            h.cyl((xx, y0 + 0.15, zz + f * 0.2), (0, 1, 0), 0.06, wall_h - 0.3, 'galv', segs=8, caps=False)
            h.beam((xx, y0 + 0.15, zz + f * 0.2), (xx, y0 + 0.05, zz + f * 0.5), 0.12, 0.12, 'galv')
    # Yan servis kapıları (kanopi + lamba) ve küçük pencereler
    for zz, f in ((z0, -1), (z1, 1)):
        xd = x_front - 8.0
        h.wall('z', zz + f * 0.1, xd - 0.55, xd + 0.55, y0, y0 + 2.2, 'door_paint', f)
        h.box((xd, y0 + 2.25, zz + f * 0.1), (1.3, 0.1, 0.12), 'steel_dark')
        for s in (-1, 1):
            h.box((xd + s * 0.6, y0 + 1.1, zz + f * 0.1), (0.1, 2.2, 0.12), 'steel_dark')
        h.box((xd, y0 + 2.6, zz + f * 0.55), (1.8, 0.1, 1.0), 'steel_dark', skip_bottom=False)
        h.box((xd, y0 + 2.5, zz + f * 0.9), (0.3, 0.06, 0.12), 'lamp_warm')
        # Levhalar: sigara içilmez, hangar numarası, (A'nın güneyinde) yüksek gerilim
        h.plate('sigara', 'z', zz + f * 0.08, f, xd + 1.15, y0 + 1.75, 0.3, 0.375)
        h.plate(f'hangar_no{number}', 'z', zz + f * 0.08, f, xd - 1.6, y0 + 2.1, 0.9, 0.53)
        if f < 0:
            h.plate('gerilim', 'z', zz + f * 0.08, f, x_front - 16.6, y0 + 2.2, 0.4, 0.4)
            h.plate('yangin', 'z', zz + f * 0.08, f, x_front - 4.5, y0 + 1.9, 0.25, 0.35)
        for xw in (x_front - 16, x_front - 22, x_front - 28):
            h.window('z', zz + f * 0.05, f, xw, y0 + 3.2, 1.8, 1.1)
    # Ön cephe: kapı açıklığının üstünde alın duvarı
    door_h = wall_h + 1.5
    for k in range(len(prof) - 1):
        (za, ya), (zb, yb) = prof[k], prof[k + 1]
        lo = y0 + door_h
        if ya <= lo and yb <= lo:
            continue
        h.quad((x_front, lo, za), (x_front, lo, zb), (x_front, max(yb, lo), zb), (x_front, max(ya, lo), za),
               'corrugated', uvs=[(lo - y0, za), (lo - y0, zb), (max(yb, lo) - y0, zb), (max(ya, lo) - y0, za)], flip=True)
        h.quad((x_front - 0.05, lo, za), (x_front - 0.05, lo, zb), (x_front - 0.05, max(yb, lo), zb),
               (x_front - 0.05, max(ya, lo), za), 'interior', uvs=[(za, 0), (zb, 0), (zb, yb - y0), (za, ya - y0)])
    # Alın kirişi: iki başlıklı kafes kiriş (kapı üstü), ışıklık bandı, tabela
    yb_ = y0 + door_h
    h.box((x_front + 0.35, yb_ - 0.15, cz), (0.7, 0.3, width_z + 1.2), 'steel_dark', skip_bottom=False)
    h.box((x_front + 0.35, yb_ + 1.35, cz), (0.7, 0.3, width_z + 1.2), 'steel_dark', skip_bottom=False)
    n_web = 22
    for i in range(n_web):
        za_ = z0 - 0.5 + (width_z + 1) * i / n_web
        zb_ = z0 - 0.5 + (width_z + 1) * (i + 1) / n_web
        h.beam((x_front + 0.35, yb_, za_), (x_front + 0.35, yb_ + 1.2, zb_ if i % 2 == 0 else za_), 0.12, 0.12, 'steel_dark', up=(1, 0, 0))
    h.wall('x', x_front + 0.72, z0 - 0.5, z1 + 0.5, yb_ + 1.5, yb_ + 2.6, 'skylight', 1)
    # Kapı rayı (zeminde) ve üst kılavuz
    h.box((x_front + 0.5, y0 + 0.02, cz), (0.5, 0.04, width_z * 1.9), 'steel_dark')
    h.box((x_front + 0.8, yb_ - 0.45, cz), (0.25, 0.3, width_z * 1.9), 'steel_dark', skip_bottom=False)
    # Sürgülü kapı kanatları: kenarları çelik kutu, ön/arka yüzleri pişirilmiş
    # kapı dokusu (facade_textures.py 'door'); ön yüzde şablon numara
    panels = 6
    pw = width_z / panels
    texts = []
    ex, ey, ez = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    for i in range(panels):
        side = -1 if i < panels / 2 else 1
        # k: uca uzaklık sırası; her kanat kendi rayında (teleskopik kapı),
        # açılınca hangarın kendi ucunda üst üste yığılır (komşu hangara taşmaz)
        k = i if side < 0 else panels - 1 - i
        base = z0 + (i + 0.5) * pw
        end = z0 + pw / 2 if side < 0 else z1 - pw / 2
        zc = base + (end - base) * door_open
        xp = x_front + 0.35 + 0.22 * k
        dh = door_h - 0.55
        lw = pw - 0.04
        # kutunun ön (+x) ve arka (−x) yüzleri atlanır: onların yerine dokulu yüzler
        h._frame_box((xp, y0 + dh / 2, zc), ex, ey, ez, (0.12, dh, lw), 'steel_dark', skip=(4, 5))
        h.wall('x', xp + 0.06, zc - lw / 2, zc + lw / 2, y0, y0 + dh, 'door_leaf', 1, uv=(0, 0, 1, 1))
        h.wall('x', xp - 0.06, zc - lw / 2, zc + lw / 2, y0, y0 + dh, 'door_leaf', -1, uv=(0, 0, 1, 1))
        texts.append(text_obj(str(panels - i), (xp + 0.072, y0 + 3.4, zc), 1.5, 'stencil_white', rot_y=math.pi / 2, font=STENCIL_FONT))
        if i == panels - 2:
            # Personel geçiş kapısı (kanadın içinde): kasa, kapı, kol, üstte lamba
            wz = zc + lw * 0.22
            h.box((xp + 0.09, y0 + 1.1, wz), (0.06, 2.2, 1.1), 'frame', skip_bottom=False)
            h.wall('x', xp + 0.121, wz - 0.48, wz + 0.48, y0 + 0.05, y0 + 2.12, 'door_paint', 1)
            h.box((xp + 0.14, y0 + 1.05, wz - 0.36), (0.05, 0.04, 0.16), 'steel')
            h.wall('x', xp + 0.122, wz - 0.2, wz + 0.2, y0 + 1.5, y0 + 1.9, 'glass', 1)
            h.box((xp + 0.2, y0 + 2.45, wz), (0.3, 0.12, 0.35), 'steel_dark', skip_bottom=False)
            h.box((xp + 0.2, y0 + 2.385, wz), (0.26, 0.012, 0.3), 'lamp_warm')
    # Cepheye montajlı harfler: HANGAR n (koyu gri, kabartma)
    texts.append(text_obj(f'HANGAR {number}', (x_front + 0.03, yb_ + 3.6, cz), 2.6, 'letters_white',
                          rot_y=math.pi / 2, extrude=0.05, spacing=1.05))
    # Kapı dikmeleri (yan kolonlar, beton kaide üstünde)
    for zz in (z0 - 0.35, z1 + 0.35):
        h.box((x_front + 0.1, y0 + 0.5, zz), (1.2, 1.0, 1.0), 'concrete')
        h.box((x_front + 0.1, y0 + door_h / 2 + 0.5, zz), (0.8, door_h - 1.0, 0.6), 'steel_dark')
        # sarı-siyah çarpma koruması
        for j in range(4):
            h.box((x_front + 0.1, y0 + 1.1 + j * 0.3, zz), (0.84, 0.15, 0.64), 'paint_yellow' if j % 2 == 0 else 'paint_black', skip_bottom=False)
        h.plate('dikkat_kapi', 'x', x_front + 0.5, 1, zz, y0 + 2.9, 0.54, 0.38)
    # Taban: hangar içi epoksi beton
    h.ground(x_back, x_front + 0.2, z0, z1, y0 + 0.002, 'hangar_floor')
    # Çatı sırtı havalandırma bacaları
    for xx in (x_back + 8, x_back + 20, x_back + 32):
        h.box((xx, y0 + wall_h + rise + 0.35, cz), (2.4, 0.7, 1.4), 'galv')
        h.box((xx, y0 + wall_h + rise + 0.75, cz), (2.8, 0.1, 1.8), 'galv', skip_bottom=False)

    if interior:
        # Kafes kemer kirişler (6,5 m aralık): dış ve iç başlık + dikme/çapraz
        n = 16
        pts = []
        for i in range(n + 1):
            t = i / n
            zz = z0 + 0.5 + t * (width_z - 1.0)
            yy = y0 + wall_h + rise * math.sin(math.pi * t) - 0.35
            tz, ty = width_z, rise * math.pi * math.cos(math.pi * t)
            l = math.hypot(tz, ty)
            nz, ny = -ty / l, tz / l
            pts.append(((zz, yy), (zz - nz * 1.1, yy - ny * 1.1)))
        xx = x_back + 3.0
        while xx < x_front - 1.5:
            for (zz, f) in ((z0 + 0.35, 1), (z1 - 0.35, -1)):
                h.box((xx, y0 + wall_h / 2, zz), (0.35, wall_h, 0.3), 'steel_dark')
            for i in range(n):
                (o0, i0), (o1, i1) = pts[i], pts[i + 1]
                h.beam((xx, o0[1], o0[0]), (xx, o1[1], o1[0]), 0.18, 0.2, 'steel_dark', up=(1, 0, 0))
                h.beam((xx, i0[1], i0[0]), (xx, i1[1], i1[0]), 0.16, 0.18, 'steel_dark', up=(1, 0, 0))
                a, b = (o0, i1) if i % 2 == 0 else (i0, o1)
                h.beam((xx, a[1], a[0]), (xx, b[1], b[0]), 0.08, 0.08, 'steel_dark', up=(1, 0, 0))
            # Asma armatürler
            for zz in (cz - width_z * 0.25, cz + width_z * 0.25):
                yl = y0 + wall_h + rise * 0.8 - 1.8
                h.beam((xx, yl + 1.2, zz), (xx, yl + 0.25, zz), 0.02, 0.02, 'steel_dark', up=(1, 0, 0))
                h.cyl((xx, yl, zz), (0, 1, 0), 0.32, 0.3, 'steel_dark', segs=10, r2=0.12)
                h.poly([(xx + 0.3 * math.cos(a_), yl - 0.005, zz - 0.3 * math.sin(a_)) for a_ in
                        (2 * math.pi * i / 10 for i in range(10))], 'lamp_warm')
            xx += 6.5
        # Arka duvarda asma kat ofisleri: camlı cephe, merdiven, korkuluk
        ox = x_back + 6.0
        h.box((x_back + 3.0, y0 + 1.6, cz), (6.0, 3.2, width_z - 6), 'wall_panel')
        h.box((x_back + 3.0, y0 + 3.35, cz), (6.2, 0.3, width_z - 5.6), 'concrete', skip_bottom=False)
        h.box((x_back + 3.0, y0 + 4.9, cz), (6.0, 2.8, width_z - 6), 'wall_panel')
        for k in range(8):
            zc_ = cz - (width_z - 8) / 2 + k * (width_z - 8) / 7
            h.window('x', ox, 1, zc_, y0 + 0.9, 2.2, 1.4)
            h.window('x', ox, 1, zc_, y0 + 4.1, 2.2, 1.5)
        for k in range(12):
            zr = cz - (width_z - 6) / 2 + k * (width_z - 6) / 11
            h.box((ox + 0.9, y0 + 3.5 + 0.55, zr), (0.05, 1.1, 0.05), 'paint_yellow')
        h.box((ox + 0.9, y0 + 4.6, cz), (0.06, 0.06, width_z - 6), 'paint_yellow')
        # merdiven
        for k in range(16):
            h.box((ox + 0.6 + k * 0.28, y0 + 0.1 + k * 0.21, cz + width_z / 2 - 5), (0.3, 0.05, 1.2), 'steel_dark', skip_bottom=False)
        h.beam((ox + 0.4, y0, cz + width_z / 2 - 5.65), (ox + 5.0, y0 + 3.4, cz + width_z / 2 - 5.65), 0.06, 0.25, 'steel_dark')
        h.beam((ox + 0.4, y0, cz + width_z / 2 - 4.35), (ox + 5.0, y0 + 3.4, cz + width_z / 2 - 4.35), 0.06, 0.25, 'steel_dark')
        # Zemin işaretleri (sarı yürüme yolu)
        h.ground(x_back + 7, x_front - 1, z0 + 1.5, z0 + 1.62, y0 + 0.004, 'paint_yellow')
        h.ground(x_back + 7, x_front - 1, z1 - 1.62, z1 - 1.5, y0 + 0.004, 'paint_yellow')
    else:
        # Kapalı hangar: içerisi görünmez; yalnız birkaç armatür (gece)
        pass
    obj = h.build()
    for t in texts:
        t.name = f'{name}_txt'
    return [obj] + texts


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
    prof = []
    for i in range(9):
        t = i / 8
        ang = t * math.radians(60)
        prof.append((FENCE_Z + 2.8 * (1 - math.cos(ang)) * 1.6, y0 + 0.4 + H * math.sin(ang) / math.sin(math.radians(60))))
    for s in range(sections):
        x0 = -width / 2 + s * sw
        x1 = x0 + sw - 0.06
        acc = 0.0
        for k in range(len(prof) - 1):
            (za, ya), (zb, yb) = prof[k], prof[k + 1]
            l = math.hypot(zb - za, yb - ya)
            b.quad((x0, ya, za), (x1, ya, za), (x1, yb, zb), (x0, yb, zb), 'galv',
                   uvs=[(x0, acc), (x1, acc), (x1, acc + l), (x0, acc + l)])
            b.quad((x0, yb, zb + 0.05), (x1, yb, zb + 0.05), (x1, ya, za + 0.05), (x0, ya, za + 0.05), 'galv',
                   uvs=[(x0, acc + l), (x1, acc + l), (x1, acc), (x0, acc)])
            acc += l
        # Panel ek kayışları (yatay) ve kenar profilleri
        for k in (2, 4, 6):
            (za, ya) = prof[k]
            b.box(((x0 + x1) / 2, ya, za - 0.04), (sw - 0.1, 0.12, 0.06), 'steel_dark')
        # Arka destek: dikme, taban kirişi, çapraz, cıvatalı taban plakası
        xs = x0 + 0.02
        zt, yt = prof[-1]
        b.box((xs, (y0 + yt) / 2, zt + 1.6), (0.2, yt - y0, 0.25), 'steel_dark')
        b.box((xs, y0 + 0.2, (FENCE_Z + zt + 3) / 2), (0.25, 0.4, zt + 3 - FENCE_Z), 'steel_dark')
        b.beam((xs, y0 + 0.4, FENCE_Z + 0.6), (xs, yt - 0.3, zt + 1.5), 0.15, 0.18, 'steel_dark', up=(1, 0, 0))
        b.box((xs, y0 + 0.43, zt + 1.6), (0.5, 0.04, 0.5), 'steel_dark')
    # Uç dikmeleri: sarı-siyah uyarı bantlı
    for sx in (-1, 1):
        xe = sx * (width / 2 + 0.2)
        for j in range(10):
            b.box((xe, y0 + 0.45 + j * 0.5, FENCE_Z + 1.2), (0.35, 0.5, 0.35), 'paint_yellow' if j % 2 == 0 else 'paint_black', skip_bottom=j > 0)
    # Beton temel kirişi
    b.box((0, y0 + 0.2, FENCE_Z + 1.5), (width + 1, 0.4, 5.0), 'concrete')
    return b.build()


# ---------------------------------------------------------------------------
# Binalar: kule, operasyon binası, itfaiye, yakıt tankları
# ---------------------------------------------------------------------------

def flat_building(b, x0, x1, z0, z1, floors, fh=3.4, wall='wall_panel', door_faces=(), parapet=0.8, name=None):
    """Düz çatılı prekast beton bina: pencere dizileri, kat bantları,
    parapet, çatı zarı ve çatı üstü teçhizat."""
    y0 = FLOOR
    H = floors * fh
    walls = [('z', z0, -1, x0, x1), ('z', z1, 1, x0, x1), ('x', x0, -1, z0, z1), ('x', x1, 1, z0, z1)]
    texts = []
    for (axis, coord, f, u0, u1) in walls:
        L = u1 - u0
        n = max(1, round(L / 3.2))
        mw = L / n
        # Cephe: pişirilmiş prekast modül (bir aks × bir kat), parapet düz
        b.wall(axis, coord, u0, u1, y0, y0 + H, 'facade', f, uv=(0, 0, n, floors))
        b.wall(axis, coord, u0, u1, y0 + H, y0 + H + parapet, wall, f)
        # Parapet altında damlalık bandı, zeminde kaide
        if axis == 'x':
            b.box((coord + f * 0.05, y0 + H + 0.05, (u0 + u1) / 2), (0.1, 0.1, L + 0.2), 'concrete')
        else:
            b.box(((u0 + u1) / 2, y0 + H + 0.05, coord + f * 0.05), (L + 0.2, 0.1, 0.1), 'concrete')
        b.wall(axis, coord + f * 0.02, u0, u1, y0, y0 + 0.35, 'concrete', f)
        if (axis, f) in door_faces:
            # Giriş portalı: ortadaki modülün yerine cam kapı, çerçeve, kanopi, lamba
            u = u0 + (n // 2 + 0.5) * mw
            at = lambda off, yy, uu: (coord + f * off, yy, uu) if axis == 'x' else (uu, yy, coord + f * off)  # noqa: E731
            sz = lambda d, hh, w: (d, hh, w) if axis == 'x' else (w, hh, d)  # noqa: E731
            b.box(at(0.1, y0 + 1.5, u), sz(0.2, 3.0, mw - 0.1), 'frame')
            b.wall(axis, coord + f * 0.205, u - 1.2, u + 1.2, y0, y0 + 2.5, 'glass', f)
            b.box(at(0.22, y0 + 1.25, u), sz(0.05, 2.5, 0.06), 'frame')
            b.box(at(1.0, y0 + 3.05, u), sz(2.0, 0.22, mw + 0.6), 'concrete', skip_bottom=False)
            b.box(at(1.6, y0 + 2.93, u), sz(0.4, 0.03, 0.4), 'lamp_warm')
            for s_ in (-1, 1):
                b.box(at(1.85, y0 + 1.5, u + s_ * (mw / 2 + 0.1)), sz(0.12, 3.0, 0.12), 'steel_dark')
            if name:
                rot = {('x', 1): math.pi / 2, ('x', -1): -math.pi / 2, ('z', 1): 0.0, ('z', -1): math.pi}[(axis, f)]
                texts.append(text_obj(name, at(0.02, y0 + H + parapet * 0.45, u), 0.62, 'letters_dark', rot_y=rot, extrude=0.03))
    # Çatı: bitümlü zar, parapet kapağı
    b.ground(x0, x1, z0, z1, y0 + H + 0.05, 'roof')
    for (axis, coord, f, u0, u1) in walls:
        b.wall(axis, coord - f * 0.25, u0 + 0.25, u1 - 0.25, y0 + H, y0 + H + parapet, wall, -f)
        if axis == 'x':
            b.box((coord - f * 0.12, y0 + H + parapet + 0.04, (u0 + u1) / 2), (0.34, 0.08, u1 - u0 + 0.1), 'galv')
        else:
            b.box(((u0 + u1) / 2, y0 + H + parapet + 0.04, coord - f * 0.12), (u1 - u0 + 0.1, 0.08, 0.34), 'galv')
    # Çatı üstü: merdiven kulesi, klima santrali, havalandırma
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    b.box((x0 + 3.0, y0 + H + 1.4, cz), (3.5, 2.8, 4.0), wall)
    b.box((cx + 2.0, y0 + H + 0.8, cz), (4.0, 1.5, 2.2), 'galv')
    for k in range(3):
        b.cyl((cx + 0.8 + k * 1.2, y0 + H + 1.55, cz), (0, 1, 0), 0.35, 0.12, 'steel_dark', segs=12)
    b.cyl((x1 - 2.0, y0 + H, cz - 1.5), (0, 1, 0), 0.25, 1.4, 'galv', segs=10)
    return texts


def build_tower(cx, cz):
    t = Builder('AF_tower')
    y0 = FLOOR
    H = 20.0
    s = 3.2
    # Şaft: dört yüzlü beton, köşe pahları, düşey merdiven pencere şeridi
    for (axis, coord, f) in (('z', cz - s, -1), ('z', cz + s, 1), ('x', cx - s, -1), ('x', cx + s, 1)):
        u0, u1 = (cx - s, cx + s) if axis == 'z' else (cz - s, cz + s)
        t.wall(axis, coord, u0, u1, y0, y0 + H, 'wall_panel', f)
        for k in range(1, 7):
            yy = y0 + k * 3.0
            if axis == 'x':
                t.box((coord + f * 0.03, yy, cz), (0.06, 0.1, 2 * s + 0.06), 'joint')
            else:
                t.box((cx, yy, coord + f * 0.03), (2 * s + 0.06, 0.1, 0.06), 'joint')
    for k in range(6):
        t.window('x', cx - s, -1, cz, y0 + 1.5 + k * 3.0, 0.9, 1.8)
        t.window('z', cz + s, 1, cx, y0 + 1.5 + k * 3.0, 0.9, 1.8)
    # Kabin: sekizgen, dışa eğik camlar, dikmeler, çatı saçağı
    cab_y = y0 + H
    R0, R1, Hc = 5.6, 6.3, 3.6
    t.cyl((cx, cab_y, cz), (0, 1, 0), 6.4, 0.6, 'concrete', segs=8)
    ring0 = [(cx + R0 * math.cos(a), cab_y + 0.6, cz + R0 * math.sin(a)) for a in (math.pi / 8 + i * math.pi / 4 for i in range(8))]
    ring1 = [(cx + R1 * math.cos(a), cab_y + 0.6 + Hc, cz + R1 * math.sin(a)) for a in (math.pi / 8 + i * math.pi / 4 for i in range(8))]
    for i in range(8):
        j = (i + 1) % 8
        t.quad(ring0[j], ring0[i], ring1[i], ring1[j], 'glass')
        t.beam(ring0[i], ring1[i], 0.14, 0.14, 'steel_dark')
    t.cyl((cx, cab_y + 0.6 + Hc, cz), (0, 1, 0), 7.0, 0.5, 'steel_dark', segs=8)
    # Seyir balkonu korkuluğu
    for i in range(32):
        a = i * math.tau / 32
        t.box((cx + 7.1 * math.cos(a), cab_y + 0.55 + 0.55, cz + 7.1 * math.sin(a)), (0.05, 1.1, 0.05), 'galv')
    t.cyl((cx, cab_y + 1.65, cz), (0, 1, 0), 7.12, 0.05, 'galv', segs=24, caps=False)
    t.cyl((cx, cab_y + 0.55, cz), (0, 1, 0), 7.3, 0.06, 'concrete', segs=24)
    # Çatı: antenler, rüzgâr ölçer, bekon
    top = cab_y + 0.6 + Hc + 0.5
    t.cyl((cx, top, cz), (0, 1, 0), 0.08, 5.5, 'galv', segs=6)
    t.box((cx, top + 5.6, cz), (0.35, 0.35, 0.35), 'light_red')
    for (dx, dz, hh) in ((2.5, 1.5, 3.0), (-2.2, -2.0, 2.2), (1.0, -3.0, 1.6)):
        t.cyl((cx + dx, top, cz + dz), (0, 1, 0), 0.03, hh, 'galv', segs=5)
    t.beam((cx - 3, top + 2.5, cz + 2), (cx - 3, top + 2.5, cz + 3.2), 0.05, 0.05, 'galv')
    t.cyl((cx - 3, top, cz + 2.6), (0, 1, 0), 0.04, 2.5, 'galv', segs=5)
    t.box((cx + 3.2, top + 0.4, cz - 0.5), (1.4, 0.8, 1.0), 'galv')
    # Alt bina (iki katlı) şaftın doğusunda
    texts = flat_building(t, cx + s, cx + s + 16, cz - 9, cz + 9, 2, door_faces=(('z', -1),), name='HAVA TRAFİK KONTROL')
    return [t.build()] + texts


def build_ops():
    b = Builder('AF_ops')
    # Operasyon binası: apron'a (kuzey, −z yönünde değil; +z) bakar
    texts = flat_building(b, 82.0, 120.0, -100.0, -80.0, 2, door_faces=(('z', 1),), name='HAREKÂT MERKEZİ')
    # İtfaiye: üç araç kapısı apron'a (−x) bakar
    y0 = FLOOR
    x0, x1, z0, z1 = 82.0, 104.0, -26.0, -4.0
    H = 7.0
    for (axis, coord, f, u0, u1) in (('z', z0, -1, x0, x1), ('z', z1, 1, x0, x1), ('x', x1, 1, z0, z1)):
        b.wall(axis, coord, u0, u1, y0, y0 + H + 0.6, 'wall_panel', f)
        b.wall(axis, coord + f * 0.02, u0, u1, y0, y0 + 0.6, 'concrete', f)
    for (axis, coord, f, u0, u1) in (('z', z0, -1, x0, x1), ('z', z1, 1, x0, x1)):
        for u in (x0 + 5, x0 + 11, x0 + 17):
            b.window(axis, coord, f, u, y0 + 4.2, 2.0, 1.2)
    # Ön cephe: kapı aralarında ayaklar, üstte bant
    doors = [(z0 + 1.2 + i * 6.9, z0 + 1.2 + i * 6.9 + 5.8) for i in range(3)]
    edges = [z0] + [v for d in doors for v in d] + [z1]
    for i in range(0, len(edges), 2):
        b.wall('x', x0, edges[i], edges[i + 1], y0, y0 + H + 0.6, 'wall_panel', -1)
    b.wall('x', x0, z0, z1, y0 + 5.0, y0 + H + 0.6, 'wall_panel', -1)
    for (d0, d1) in doors:
        b.wall('x', x0 + 0.25, d0, d1, y0, y0 + 5.0, 'shutter_red', -1)
        b.box((x0 + 0.1, y0 + 5.1, (d0 + d1) / 2), (0.3, 0.2, d1 - d0 + 0.2), 'steel_dark')
        for s in (-1, 1):
            b.box((x0 - 0.15, y0 + 0.6, d0 - 0.2 if s < 0 else d1 + 0.2), (0.3, 1.2, 0.3), 'paint_yellow')
        b.box((x0 - 0.5, y0 + 5.3, (d0 + d1) / 2), (0.4, 0.05, 0.6), 'lamp_warm')
    texts.append(text_obj('İTFAİYE', (x0 - 0.02, y0 + 6.25, (z0 + z1) / 2), 1.6, 'letters_red', rot_y=-math.pi / 2, extrude=0.04, spacing=1.08))
    for i, (d0, d1) in enumerate(doors):
        texts.append(text_obj(str(i + 1), (x0 - 0.02, y0 + 5.45, (d0 + d1) / 2), 0.5, 'letters_dark', rot_y=-math.pi / 2, extrude=0.02))
    b.plate('yangin', 'x', x0, -1, doors[0][0] - 0.6, y0 + 1.6, 0.25, 0.35)
    b.ground(x0, x1, z0, z1, y0 + H + 0.05, 'roof')
    b.cyl((x1 - 3, y0 + H, z0 + 3), (0, 1, 0), 0.06, 6.0, 'galv', segs=6)
    b.box((x1 - 3, y0 + H + 6.0, z0 + 3), (0.3, 0.3, 0.3), 'light_red')
    # Siren direği
    b.cyl((x1 - 1.5, y0 + H, z1 - 2), (0, 1, 0), 0.1, 3.0, 'galv', segs=6)
    b.cyl((x1 - 1.5, y0 + H + 3.0, z1 - 2), (1, 0, 0), 0.35, 0.5, 'steel_dark', segs=10)
    return [b.build()] + texts


def build_fuel_farm():
    f = Builder('AF_fuel')
    y0 = FLOOR
    x0, x1, z0, z1 = -34.0, 10.0, -99.0, -78.0
    # Beton set duvarı (taşma havuzu)
    for (axis, coord, fc, u0, u1) in (('z', z0, -1, x0, x1), ('z', z1, 1, x0, x1), ('x', x0, -1, z0, z1), ('x', x1, 1, z0, z1)):
        if axis == 'x':
            f.box((coord, y0 + 0.5, (u0 + u1) / 2), (0.3, 1.0, u1 - u0 + 0.3), 'concrete')
        else:
            f.box(((u0 + u1) / 2, y0 + 0.5, coord), (u1 - u0 + 0.3, 1.0, 0.3), 'concrete')
    # Yatay tanklar (beyaz boyalı), kaide, merdiven, borular
    for k in range(3):
        zc = z0 + 3.8 + k * 6.6
        f.cyl((x0 + 6, y0 + 2.2, zc), (1, 0, 0), 2.0, 26.0, 'tank_white', segs=24)
        for xs in (x0 + 9, x0 + 18, x0 + 27):
            f.box((xs, y0 + 0.6, zc), (0.8, 1.2, 3.0), 'concrete')
        # tank uçlarında bombe
        for (xe, d) in ((x0 + 6, -1), (x0 + 32, 1)):
            f.cyl((xe, y0 + 2.2, zc), (d, 0, 0), 2.0, 0.5, 'tank_white', segs=24, r2=1.3)
        # üst boru ve vana
        f.cyl((x0 + 30, y0 + 4.2, zc), (0, 1, 0), 0.25, 0.5, 'steel_dark', segs=8)
        f.cyl((x0 + 32.5, y0 + 1.2, zc), (1, 0, 0), 0.12, 6.0, 'paint_yellow', segs=8)
        # tank yazı bandı
        f.cyl((x0 + 17.5, y0 + 2.2, zc), (1, 0, 0), 2.02, 0.4, 'paint_red', segs=24, caps=False)
    # Dolum istasyonu (kanopi)
    f.box((x1 + 6, y0 + 4.5, (z0 + z1) / 2), (7.0, 0.4, 9.0), 'steel_dark', skip_bottom=False)
    for sx in (-1, 1):
        for sz in (-1, 1):
            f.box((x1 + 6 + sx * 3, y0 + 2.2, (z0 + z1) / 2 + sz * 4), (0.3, 4.4, 0.3), 'galv')
    f.box((x1 + 6, y0 + 0.8, (z0 + z1) / 2), (1.0, 1.6, 0.8), 'paint_red')
    return f.build()


def build_radar(cx, cz):
    """Gözetleme radarı: kafes kule (sabit) + dönen anten (ayrı nesne)."""
    r = Builder('AF_radar')
    y0 = FLOOR
    H = 12.0
    w0, w1 = 2.2, 0.9
    legs = [(sx, sz) for sx in (-1, 1) for sz in (-1, 1)]
    for sx, sz in legs:
        r.beam((cx + sx * w0, y0, cz + sz * w0), (cx + sx * w1, y0 + H, cz + sz * w1), 0.18, 0.18, 'galv')
    for k in range(6):
        ya, yb = y0 + k * H / 6, y0 + (k + 1) * H / 6
        wa = w0 + (w1 - w0) * k / 6
        wb = w0 + (w1 - w0) * (k + 1) / 6
        for (a, b) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            r.beam((cx + a[0] * wa, ya, cz + a[1] * wa), (cx + b[0] * wb, yb, cz + b[1] * wb), 0.08, 0.08, 'galv')
            r.beam((cx + a[0] * wb, yb, cz + a[1] * wb), (cx + b[0] * wb, yb, cz + b[1] * wb), 0.08, 0.08, 'galv')
    r.box((cx, y0 + H + 0.15, cz), (2.6, 0.3, 2.6), 'galv', skip_bottom=False)
    r.box((cx, y0 + H + 0.9, cz), (1.6, 1.2, 1.6), 'wall_panel')
    r.box((cx + 3.5, y0 + 1.3, cz), (3.0, 2.6, 2.4), 'wall_panel')
    tower = r.build()
    a = Builder('AF_radar_antenna')
    # Anten orijinde kurulur (oyun y ekseni etrafında döndürür); konum nesnede
    top = 0.0
    a.cyl((0, top, 0), (0, 1, 0), 0.35, 1.2, 'steel_dark', segs=10)
    # Kavisli ızgara reflektör: yatay latalar
    Wd, Hd = 7.0, 2.4
    for k in range(7):
        yy = top + 1.0 + k * Hd / 6
        bow = 0.6 * (1 - ((k - 3) / 3) ** 2)
        segs = 8
        for i in range(segs):
            xa = -Wd / 2 + Wd * i / segs
            xb = -Wd / 2 + Wd * (i + 1) / segs
            za = -0.5 - bow - 0.5 * (1 - (2 * xa / Wd) ** 2)
            zb = -0.5 - bow - 0.5 * (1 - (2 * xb / Wd) ** 2)
            a.beam((xa, yy, za), (xb, yy, zb), 0.05, 0.12, 'galv')
    for i in range(9):
        xx = -Wd / 2 + Wd * i / 8
        z_ = -0.5 - 0.5 * (1 - (2 * xx / Wd) ** 2)
        a.beam((xx, top + 1.0, z_ - 0.6), (xx, top + 1.0 + Hd, z_ - 0.6), 0.06, 0.06, 'galv')
    a.beam((0, top + 1.2, 0), (0, top + 1.0 + Hd / 2, -1.2), 0.15, 0.15, 'steel_dark')
    a.box((0, top + 1.0 + Hd / 2, 0.4), (0.4, 0.4, 0.8), 'steel_dark', skip_bottom=False)
    ant = a.build()
    ant.location = C @ Vector((cx, y0 + H + 1.5, cz))
    return [tower, ant]


def build_windsock(cx, cz):
    w = Builder('AF_windsock_mast')
    y0 = FLOOR
    w.box((cx, y0 + 0.15, cz), (1.6, 0.3, 1.6), 'concrete')
    w.cyl((cx, y0 + 0.3, cz), (0, 1, 0), 0.07, 6.2, 'paint_white', segs=8)
    for k in range(4):
        w.cyl((cx, y0 + 0.3 + k * 1.55, cz), (0, 1, 0), 0.075, 0.6, 'windsock', segs=8, caps=False)
    w.cyl((cx, y0 + 6.3, cz), (0, 1, 0), 0.5, 0.05, 'galv', segs=12)
    mast = w.build()
    s = Builder('AF_windsock')
    # Tulum orijinden +x yönüne; oyun rüzgâra göre döndürür/sallar
    L = 3.6
    for k in range(5):
        r0 = 0.45 - k * 0.055
        r1 = 0.45 - (k + 1) * 0.055
        s.cyl((k * L / 5, 0, 0), (1, 0, 0), r0, L / 5, 'windsock' if k % 2 == 0 else 'paint_white', segs=14, caps=False, r2=r1)
    sock = s.build()
    sock.location = C @ Vector((cx + 0.5, y0 + 6.0, cz))
    return [mast, sock]


# ---------------------------------------------------------------------------
# Işık direkleri, pist lambaları, tabelalar, yaklaşma ışıkları
# ---------------------------------------------------------------------------

MASTS = [(APRON[0] + 12, APRON[2] + 3), (APRON[1] - 3, APRON[2] + 3), (APRON[0] + 12, APRON[3] - 3), (APRON[1] - 3, APRON[3] - 3), (10.0, APRON[2] + 3)]


def build_lights():
    L = Builder('AF_lights')
    y0 = FLOOR
    H = 22.0
    for (x, z) in MASTS:
        # Kafes gövde: üç ayak + çaprazlar
        legs = [(math.cos(a), math.sin(a)) for a in (0, 2.094, 4.189)]
        r0, r1 = 1.1, 0.45
        L.cyl((x, y0, z), (0, 1, 0), 1.5, 0.5, 'concrete', segs=10)
        for (cx, cz) in legs:
            L.beam((x + cx * r0, y0 + 0.5, z + cz * r0), (x + cx * r1, y0 + H, z + cz * r1), 0.12, 0.12, 'galv')
        for k in range(10):
            ya = y0 + 0.5 + k * (H - 0.5) / 10
            yb = y0 + 0.5 + (k + 1) * (H - 0.5) / 10
            ra = r0 + (r1 - r0) * k / 10
            rb = r0 + (r1 - r0) * (k + 1) / 10
            for i in range(3):
                (ax, az), (bx, bz) = legs[i], legs[(i + 1) % 3]
                L.beam((x + ax * ra, ya, z + az * ra), (x + bx * rb, yb, z + bz * rb), 0.05, 0.05, 'galv')
                L.beam((x + ax * rb, yb, z + az * rb), (x + bx * rb, yb, z + bz * rb), 0.05, 0.05, 'galv')
        # Baş: platform, korkuluk, 6 projektör apron merkezine eğik
        L.cyl((x, y0 + H, z), (0, 1, 0), 1.6, 0.15, 'galv', segs=12)
        for i in range(16):
            a = i * math.tau / 16
            L.box((x + 1.55 * math.cos(a), y0 + H + 0.6, z + 1.55 * math.sin(a)), (0.04, 0.9, 0.04), 'galv')
        L.cyl((x, y0 + H + 1.05, z), (0, 1, 0), 1.56, 0.04, 'galv', segs=16, caps=False)
        toward = Vector((0 - x, 0, -10 - z)).normalized()
        base_a = math.atan2(toward.z, toward.x)
        for i in range(6):
            a = base_a + (i - 2.5) * 0.28
            d = Vector((math.cos(a), 0, math.sin(a)))
            c = Vector((x, y0 + H + 1.6 + (i % 2) * 0.7, z)) + d * 1.2
            # projektör kutusu: öne ve aşağı eğik
            fwd = (d * math.cos(0.6) + Vector((0, -1, 0)) * math.sin(0.6)).normalized()
            L.beam(c - fwd * 0.2, c + fwd * 0.2, 0.7, 0.5, 'steel_dark')
            L.beam(c + fwd * 0.2, c + fwd * 0.215, 0.62, 0.42, 'lamp_white')
    # Pist kenar lambaları (60 m aralık), taksi yolu mavi lambaları
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
    # Pist başı eşik ışıkları (yeşil/kırmızı) ve yaklaşma ışık barları
    for end in (-1, 1):
        xe = end * RUNWAY_LEN
        for k in range(12):
            zz = RUNWAY_Z - RUNWAY_HALF + 1 + k * (2 * RUNWAY_HALF - 2) / 11
            L.box((xe, y0 + 0.2, zz), (0.3, 0.35, 0.3), 'light_green')
        for k in range(10):
            xx = xe + end * (70 + k * 30)
            L.box((xx, y0 + 0.5 + k * 0.1, RUNWAY_Z), (0.25, 1.0 + k * 0.2, 0.25), 'galv')
            L.box((xx, y0 + 1.0 + k * 0.2, RUNWAY_Z), (0.3, 0.12, 9.0), 'steel_dark')
            for j in range(5):
                L.box((xx, y0 + 1.12 + k * 0.2, RUNWAY_Z - 4 + j * 2), (0.25, 0.2, 0.25), 'light_white')
    return L.build()


def build_signs():
    """Taksi yolu tabelaları (ışıklı kabin, iki yüzü atlas dokulu), serbest
    duran uyarı levhaları, çitte "askeri yasak bölge" levhaları, tank yazıları."""
    S = Builder('AF_signs')
    objs = []
    y0 = FLOOR
    ex, ey, ez = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))

    def cabinet(xs, zc, items, h=0.9):
        widths = []
        for k in items:
            x0, ya, x1, yb = SIGNS[k]
            widths.append(h * (x1 - x0) / (yb - ya))
        wt = sum(widths)
        S._frame_box((xs, y0 + 0.55 + h / 2, zc), ex, ey, ez, (wt + 0.08, h + 0.08, 0.32), 'steel_dark', skip=(0, 1))
        u = xs - wt / 2
        for k, w in zip(items, widths):
            x0, ya, x1, yb = SIGNS[k]
            uv = (x0 / 2.0, 1.0 - yb, x1 / 2.0, 1.0 - ya)
            for f in (-1, 1):
                S.wall('z', zc + f * 0.16, u, u + w, y0 + 0.55, y0 + 0.55 + h, 'signs_lit', f, uv=uv)
            u += w
        # kırılabilir ayaklar
        for s_ in (-1, 1):
            S.box((xs + s_ * (wt / 2 - 0.25), y0 + 0.28, zc), (0.08, 0.56, 0.08), 'galv')
            S.box((xs + s_ * (wt / 2 - 0.25), y0 + 0.02, zc), (0.3, 0.04, 0.3), 'concrete')

    zh = RUNWAY_Z - RUNWAY_HALF - 46
    cabinet(TAXI_X - TAXI_HALF - 6, zh, ['taxi_rwy', 'taxi_A'])
    cabinet(TAXI_X + TAXI_HALF + 6, zh, ['taxi_A', 'taxi_rwy'])
    cabinet(TAXI_X - TAXI_HALF - 5, APRON[3] + 6, ['taxi_dir'])
    # Çalıştırma alanı: jet egzozu / kulak koruyucu levhaları (direkli)
    S.plate('jet', 'z', -17.0, -1, -10.5, y0 + 1.7, 0.9, 0.6, post=1)
    S.plate('kulak', 'z', -17.0, -1, 10.5, y0 + 1.7, 0.555, 0.525, post=1)
    S.plate('jet', 'z', FENCE_Z - 2.0, 1, 11.5, y0 + 1.7, 0.9, 0.6, post=1)
    # Hangarlar arası: FOD uyarısı; servis yolu: hız sınırı
    S.plate('fod', 'x', -49.0, 1, -6.0, y0 + 1.8, 0.83, 0.6, post=1)
    S.plate('hiz', 'z', -50.0, -1, 80.8, y0 + 1.9, 0.45, 0.4, post=1)
    S.plate('hiz', 'z', 20.0, 1, 80.8, y0 + 1.9, 0.45, 0.4, post=1)
    # Güney çiti: askeri yasak bölge (iki yüzlü)
    for x in (-110.0, -30.0, 50.0, 124.0, 150.0):
        for f in (-1, 1):
            S.plate('askeri', 'z', -128.0 + f * 0.06, f, x, y0 + 1.5, 0.84, 0.49)
    # Yakıt tankları: şablon yazılar (apron'a bakan yüzde)
    for k in range(3):
        zc = -99.0 + 3.8 + k * 6.6
        for xx in (-34.0 + 12.0, -34.0 + 24.0):
            objs.append(text_obj('JP-8', (xx, y0 + 2.2, zc + 2.03), 0.9, 'letters_dark', font=STENCIL_FONT))
        objs.append(text_obj('YANICI MADDE', (-34.0 + 18.0, y0 + 1.25, zc + 1.86), 0.32, 'letters_red'))
    return [S.build()] + objs


# ---------------------------------------------------------------------------
# AO pişirme (isteğe bağlı): UVMap'e lightmap atlası + Cycles AO
# ---------------------------------------------------------------------------

# Pişirilecek yapılar ve doku boyutları (px)
AO_OBJECTS = {
    'AF_hangar_a': 2048, 'AF_hangar_b': 1024, 'AF_tower': 1024, 'AF_ops': 1024,
    'AF_fuel': 512, 'AF_blastfence': 1024, 'AF_radar': 512, 'AF_lights': 1024,
}
# Zemin AO bölgesi (three x0, x1, z0, z1) ve doku boyutu
GROUND_AO = (-110.0, 160.0, -120.0, 50.0)
GROUND_AO_PX = 2048


def _bake_image(obj, img, samples):
    me = obj.data
    for m in me.materials:
        nt = m.node_tree
        node = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'BAKE'
        node.image = img
        nt.nodes.active = node
    select_only(obj)
    bpy.context.scene.cycles.samples = samples
    bpy.ops.object.bake(type='AO', margin=6, use_clear=True)


def bake_ao(obj, size, samples, outdir):
    """Yapının kendi AO atlası: UVMap akıllı açılım + Cycles AO."""
    select_only(obj)
    me = obj.data
    me.uv_layers.active = me.uv_layers['UVMap']
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    img = bpy.data.images.new(f'{obj.name}_ao', size, size, float_buffer=False, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    t0 = time.time()
    _bake_image(obj, img, samples)
    img.filepath_raw = os.path.join(outdir, f'{obj.name}_ao.png')
    img.file_format = 'PNG'
    img.save()
    print(f'  AO {obj.name}: {time.time() - t0:.0f} s', flush=True)


def bake_ground_ao(samples, outdir, hide):
    """Zemin AO haritası: bölgeyi kaplayan yatay bir düzleme pişirilir
    (UV = dünya x/z). Oyunda zemin malzemeleri dünya konumundan okur:
    binaların, duvarların ve çitlerin dibinde yumuşak kararma."""
    x0, x1, z0, z1 = GROUND_AO
    g = Builder('AO_ground')
    g.ground(x0, x1, z0, z1, FLOOR + 0.01, 'ao_plane')
    obj = g.build()
    me = obj.data
    uv = me.uv_layers['UVMap']
    # Builder köşe sırası: (x0,z1) (x1,z1) (x1,z0) (x0,z0); v = z ekseni (z0 → 0)
    for li, (u, v) in zip(me.polygons[0].loop_indices, ((0, 1), (1, 1), (1, 0), (0, 0))):
        uv.data[li].uv = (u, v)
    for o in hide:
        o.hide_render = True
    W = GROUND_AO_PX
    H = int(round(W * (z1 - z0) / (x1 - x0)))
    img = bpy.data.images.new('ground_ao', W, H, float_buffer=False, alpha=False)
    img.colorspace_settings.name = 'Non-Color'
    t0 = time.time()
    _bake_image(obj, img, samples)
    img.filepath_raw = os.path.join(outdir, 'ground_ao.png')
    img.file_format = 'PNG'
    img.save()
    for o in hide:
        o.hide_render = False
    bpy.data.objects.remove(obj)
    print(f'  AO zemin: {time.time() - t0:.0f} s ({W}×{H})', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='build/airfield_raw.glb')
    ap.add_argument('--ao', action='store_true')
    ap.add_argument('--ao-size', type=int, default=2048)
    ap.add_argument('--samples', type=int, default=64)
    args = ap.parse_args(argv)
    t0 = time.time()
    reset()
    bpy.context.scene.world.light_settings.distance = 6.0
    objs = [build_ground(), build_markings()]
    for n, (label, cz, door) in enumerate(HANGARS):
        objs += build_hangar(label, n + 1, cz, door, interior=door > 0)
    objs += [build_blast_fence()] + build_tower(95.0, -44.0) + build_ops() + [build_fuel_farm(), build_lights()]
    objs += build_radar(158.0, 92.0)
    objs += build_windsock(96.0, 132.0)
    objs += build_signs()
    objs += build_runway_text()
    for o in objs:
        print(f'  {o.name}: {len(o.data.polygons)} yüz', flush=True)
    if args.ao:
        outdir = os.path.abspath('build/ao')
        os.makedirs(outdir, exist_ok=True)
        scn = bpy.context.scene
        scn.cycles.device = 'CPU'
        scn.render.bake.margin = 6
        scn.world.light_settings.distance = 25.0
        bake_ground_ao(args.samples, outdir, [o for o in objs if o.name in ('AF_ground', 'AF_markings') or o.name.startswith('txt')])
        scn.world.light_settings.distance = 5.0
        for o in objs:
            if o.name in AO_OBJECTS:
                bake_ao(o, AO_OBJECTS[o.name], args.samples, outdir)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=args.out, export_format='GLB', export_materials='EXPORT',
                              export_image_format='NONE', export_yup=True, export_texcoords=True,
                              export_normals=True, export_apply=True)
    print(f'yazıldı {args.out} ({os.path.getsize(args.out) / 1024:.0f} KB) — {time.time() - t0:.1f} s', flush=True)


if __name__ == '__main__':
    main()
