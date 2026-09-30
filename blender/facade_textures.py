"""
Cephe, kapı ve levha dokuları — yüksek poligonlu detaydan Cycles ile pişirme
(trim_sheet.py ile aynı yöntem: detay alçak bir levhaya "selected to
active" ile pişirilir).

Setler (src/assets/facade/<ad>_*.webp):
    door      hangar sürgülü kapı kanadı (7,33 × 9,95 m): trapez nervürlü sac,
              kenar/üst çerçeveler, polikarbonat görüş şeridi, cıvata
              sıraları, tekmelik, lastik fitil, kenarlarda sarı-siyah bant
    cladding  trapez oluklu sac karosu (2,0 × 1,035 m, dikişsiz): hangar
              çatısı ve duvarları; nervürler U yönünde
    facade    prekast beton cephe modülü (3,2 × 3,4 m = bir aks × bir kat):
              panel derzleri, 14 cm derin pencere boşluğu, alüminyum doğrama,
              denizlik, denizlik uçlarından inen yağmur izleri
    signs     levha atlası (yalnız renk): Türkçe uyarı levhaları ve taksi
              yolu tabela yüzleri; hücreler SIGNS sözlüğünde (UV)

Her set için:
    <ad>_albedo.webp   renk (sRGB), oyuk diplerinde AO ile koyulaştırılmış
    <ad>_normal.webp   teğet uzayı normal (OpenGL, Y+)
    <ad>_orm.webp      R = AO, G = pürüzlülük, B = cam maskesi (1 = cam)

Yazı tipleri (blender/fonts, SIL OFL): Barlow Condensed, Saira Stencil One.

    /home/user/bpyenv/bin/python blender/facade_textures.py [--only door,signs]
"""

import argparse
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix  # noqa: E402

from kitlib import link, reset, select_only  # noqa: E402

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
OUT = 'src/assets/facade'

_mats = {}


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def emat(name, color, rough=0.5, glass=0.0, noise=0.0, noise_scale=6.0):
    """Pişirme malzemesi: yayım = albedo (isteğe bağlı gürültülü ton),
    'rough' ve 'glass' özel özellik olarak ayrı geçişlerde pişirilir."""
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    col = srgb(color) if isinstance(color, str) else color
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Emission Strength'].default_value = 1.0
    if noise > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = noise_scale
        nz.inputs['Detail'].default_value = 8
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.3
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[0].color = (*[c * (1 - noise) for c in col], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, c * (1 + noise * 0.5)) for c in col], 1)
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], b.inputs['Emission Color'])
        m['emit_linked'] = 1
    else:
        b.inputs['Emission Color'].default_value = (*col, 1)
    m['rough'] = rough
    m['glass'] = glass
    _mats[key] = m
    return m


def mesh_obj(name, verts, faces, mat, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for p in me.polygons:
        p.use_smooth = smooth
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def slab(name, x0, y0, x1, y1, z0, z1, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @
                 Matrix.Diagonal(((x1 - x0), (y1 - y0), (z1 - z0), 1)))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES', profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.set_sharp_from_angle(angle=math.radians(31))
    return obj


def cyl(name, x, y, z0, r, h, mat, segs=12):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r * 0.85, depth=h)
    bm.transform(Matrix.Translation((x, y, z0 + h / 2)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def join(objs, name):
    objs = [o for o in objs if o]
    if len(objs) == 1:
        return objs[0]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    return o


def text(body, cx, cy, size, z, mat, font='BarlowCondensed-Bold.ttf', align='CENTER', extrude=0.001, spacing=1.0):
    cu = bpy.data.curves.new('t', 'FONT')
    cu.font = bpy.data.fonts.load(os.path.join(FONTS, font), check_existing=True)
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = spacing
    obj = link(bpy.data.objects.new('t', cu))
    obj.location = (cx, cy, z)
    obj.data.materials.append(mat)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active


def trapezoid_prisms(name, centers, axis, a0, a1, base_w, top_w, h, z0, mat):
    """Trapez nervürler: axis 'y' → nervür y boyunca uzanır, merkezler x'te."""
    verts, faces = [], []
    for c in centers:
        prof = [(c - base_w / 2, z0), (c - top_w / 2, z0 + h), (c + top_w / 2, z0 + h), (c + base_w / 2, z0)]
        i0 = len(verts)
        for a in (a0, a1):
            for (u, z) in prof:
                verts.append((u, a, z) if axis == 'y' else (a, u, z))
        # yan yüzler (profil kenarları boyunca)
        for k in range(3):
            faces.append((i0 + k, i0 + k + 1, i0 + 4 + k + 1, i0 + 4 + k) if axis == 'y' else (i0 + k, i0 + 4 + k, i0 + 4 + k + 1, i0 + k + 1))
        faces.append((i0, i0 + 1, i0 + 2, i0 + 3)[::-1] if axis == 'y' else (i0, i0 + 1, i0 + 2, i0 + 3))
        faces.append((i0 + 4, i0 + 5, i0 + 6, i0 + 7) if axis == 'y' else (i0 + 4, i0 + 5, i0 + 6, i0 + 7)[::-1])
    o = mesh_obj(name, verts, faces, mat)
    # Yüz yönlerini dışa çevir
    select_only(o)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return o


# ---------------------------------------------------------------------------
# Setler
# ---------------------------------------------------------------------------

def build_door(W, H):
    """Hangar kapı kanadı; x ∈ [0, W], y ∈ [0, H], z dışarı."""
    objs = []
    paint = emat('door_paint', '#8a949b', 0.55, noise=0.08, noise_scale=0.6)
    frame = emat('door_frame', '#565e64', 0.5, noise=0.06)
    rubber = emat('door_rubber', '#141414', 0.9)
    kick = emat('door_kick', '#6b7277', 0.45, noise=0.12)
    poly = emat('door_poly', '#a3aba8', 0.25, glass=1.0)
    alu = emat('door_alu', '#9ca3a6', 0.35)
    bolt = emat('door_bolt', '#707476', 0.4)
    yel = emat('hz_yellow', '#d4a520', 0.5)
    blk = emat('hz_black', '#1b1b1a', 0.5)
    objs.append(slab('base', -0.05, -0.05, W + 0.05, H + 0.05, -0.02, 0.0, paint))
    # Nervürler (dikey): alt tekmelik ile üst çerçeve arasında, görüş şeridinde kesik
    p = 0.207
    xs = [0.12 + p / 2 + i * p for i in range(int((W - 0.24) / p))]
    band0, band1 = 7.15, 7.95
    objs.append(trapezoid_prisms('ribs_lo', xs, 'y', 0.6, band0, 0.09, 0.035, 0.035, 0.0, paint))
    objs.append(trapezoid_prisms('ribs_hi', xs, 'y', band1, H - 0.14, 0.09, 0.035, 0.035, 0.0, paint))
    # Kenar ve üst/alt çerçeveler
    objs.append(slab('fl', 0.0, 0.0, 0.12, H, 0.0, 0.07, frame, bevel=0.006))
    objs.append(slab('fr', W - 0.12, 0.0, W, H, 0.0, 0.07, frame, bevel=0.006))
    objs.append(slab('ft', 0.0, H - 0.14, W, H, 0.0, 0.07, frame, bevel=0.006))
    # Görüş şeridi: alüminyum kasa + polikarbonat
    objs.append(slab('b0', 0.12, band0 - 0.05, W - 0.12, band0, 0.0, 0.06, alu, bevel=0.004))
    objs.append(slab('b1', 0.12, band1, W - 0.12, band1 + 0.05, 0.0, 0.06, alu, bevel=0.004))
    n = 4
    for i in range(n):
        x0 = 0.12 + (W - 0.24) * i / n
        x1 = 0.12 + (W - 0.24) * (i + 1) / n
        objs.append(slab(f'pc{i}', x0 + 0.03, band0, x1 - 0.03, band1, 0.0, 0.02, poly))
        if i > 0:
            objs.append(slab(f'pm{i}', x0 - 0.03, band0, x0 + 0.03, band1, 0.0, 0.06, alu))
    # Tekmelik (alt 0,6 m) ve lastik fitil
    objs.append(slab('kick', 0.12, 0.08, W - 0.12, 0.6, 0.0, 0.045, kick, bevel=0.004))
    objs.append(slab('seal', 0.0, 0.0, W, 0.08, 0.0, 0.05, rubber))
    # Cıvata sıraları: nervür aralarında (vadilerde)
    heads = []
    for y in (0.95, 3.4, 5.85, 8.6):
        for x in xs[:-1]:
            heads.append(cyl('bh', x + p / 2, y, 0.0, 0.009, 0.012, bolt, segs=6))
    for y in (0.2, 0.48):
        for k in range(int((W - 0.3) / 0.3)):
            heads.append(cyl('kb', 0.2 + k * 0.3, y, 0.045, 0.01, 0.01, bolt, segs=6))
    objs.append(join(heads, 'bolts'))
    # Kenar çerçevelerinde sarı-siyah uyarı bandı (alt 2,4 m), 45°
    strips = []
    for side in (0.0, W - 0.12):
        k = 0
        y = 0.08
        while y < 2.4:
            v = [(side, y, 0.071), (side + 0.12, y + 0.12, 0.071), (side + 0.12, y + 0.24, 0.071), (side, y + 0.12, 0.071)]
            strips.append(mesh_obj('hz', v, [(0, 1, 2, 3)], yel if k % 2 == 0 else blk))
            y += 0.12
            k += 1
    objs += strips
    # Çekme kolu (öndeki kenarda)
    objs.append(slab('handle', W - 0.1, 1.0, W - 0.06, 1.7, 0.07, 0.1, alu, bevel=0.008))
    return objs


def build_cladding(W, H):
    """Trapez sac karosu: nervürler x (U) boyunca, 5 hatve y'de; dikişsiz."""
    objs = []
    paint = emat('clad_paint', '#9aa0a3', 0.5, noise=0.06, noise_scale=1.5)
    bolt = emat('clad_bolt', '#7c8083', 0.4)
    objs.append(slab('base', -0.2, -0.2, W + 0.2, H + 0.2, -0.02, 0.0, paint))
    p = H / 5
    ys = [p / 2 + i * p for i in range(-1, 6)]
    objs.append(trapezoid_prisms('ribs', ys, 'x', -0.3, W + 0.3, 0.1, 0.035, 0.038, 0.0, paint))
    heads = []
    for y in [i * p for i in range(-1, 7)]:
        for x in (W * 0.5,):
            heads.append(cyl('bh', x, y, 0.0, 0.01, 0.012, bolt, segs=6))
    # bindirme dikişi: karonun ortasında ince çizgi (sac kenarı)
    objs.append(join(heads, 'bolts'))
    objs.append(slab('lap', W * 0.25 - 0.004, -0.2, W * 0.25 + 0.004, H + 0.2, 0.0, 0.004, paint))
    return objs


def build_facade(W, H):
    """Prekast beton modül: x ∈ [0, W], y ∈ [0, H] (bir kat); pencere ortada."""
    objs = []
    conc = emat('conc', '#bdb6a8', 0.85, noise=0.12, noise_scale=3.0)
    seal = emat('sealant', '#2a2a28', 0.6)
    frame = emat('win_frame', '#3c3f41', 0.4)
    glass = emat('win_glass', '#0b0e10', 0.05, glass=1.0)
    sill = emat('win_sill', '#8c8f8f', 0.35)
    streak = emat('streak', '#8f887b', 0.9)
    T = 0.14   # panel kalınlığı = pencere boşluğu derinliği
    g = 0.012  # derz
    wx0, wx1 = 0.7, W - 0.7
    wy0, wy1 = 0.95, 2.35
    objs.append(slab('back', -0.05, -0.05, W + 0.05, H + 0.05, -0.02, 0.0, seal))
    # Panel: pencere çevresinde dört parça (derz payı modül kenarında)
    objs.append(slab('pl', g, g, wx0, H - g, 0.0, T, conc, bevel=0.01))
    objs.append(slab('pr', wx1, g, W - g, H - g, 0.0, T, conc, bevel=0.01))
    objs.append(slab('pb', wx0 - 0.02, g, wx1 + 0.02, wy0, 0.0, T, conc, bevel=0.01))
    objs.append(slab('pt', wx0 - 0.02, wy1, wx1 + 0.02, H - g, 0.0, T, conc, bevel=0.01))
    # Doğrama: kasa, orta kayıt, vasistas kaydı; cam boşluğun dibinde
    f = 0.06
    zf0, zf1 = 0.02, 0.09
    objs.append(slab('fb', wx0, wy0, wx1, wy0 + f, zf0, zf1, frame))
    objs.append(slab('ft', wx0, wy1 - f, wx1, wy1, zf0, zf1, frame))
    objs.append(slab('fl', wx0, wy0, wx0 + f, wy1, zf0, zf1, frame))
    objs.append(slab('fr', wx1 - f, wy0, wx1, wy1, zf0, zf1, frame))
    xm = (wx0 + wx1) / 2
    objs.append(slab('fm', xm - 0.03, wy0, xm + 0.03, wy1, zf0, zf1, frame))
    yt = wy1 - 0.42
    objs.append(slab('ftr', wx0, yt - 0.025, wx1, yt + 0.025, zf0, zf1, frame))
    objs.append(slab('glass', wx0, wy0, wx1, wy1, 0.0, 0.04, glass))
    # Denizlik (dışa taşan) ve üstte damlalık
    objs.append(slab('sill', wx0 - 0.1, wy0 - 0.06, wx1 + 0.1, wy0 + 0.0, 0.0, T + 0.05, sill, bevel=0.005))
    return objs


# Levha atlası: 2,0 × 1,0 birim (1 birim = 1024 px). Hücre: (x0, y0, x1, y1)
SIGNS = {
    'taxi_A': (0.00, 0.00, 0.25, 0.25),
    'taxi_rwy': (0.25, 0.00, 0.75, 0.25),
    'taxi_dir': (0.75, 0.00, 1.15, 0.25),
    'hangar_no1': (1.15, 0.00, 1.575, 0.25),
    'hangar_no2': (1.575, 0.00, 2.00, 0.25),
    'dikkat_kapi': (0.00, 0.25, 0.50, 0.60),
    'sigara': (0.50, 0.25, 0.78, 0.60),
    'askeri': (0.78, 0.25, 1.38, 0.60),
    'yangin': (1.38, 0.25, 1.63, 0.60),
    'kulak': (1.63, 0.25, 2.00, 0.60),
    'gerilim': (0.00, 0.60, 0.40, 1.00),
    'jet': (0.40, 0.60, 1.00, 1.00),
    'fod': (1.00, 0.60, 1.55, 1.00),
    'hiz': (1.55, 0.60, 2.00, 1.00),
}


def build_signs(W, H):
    objs = []
    z = 0.0
    M = lambda n, c: emat(n, c, 0.5)  # noqa: E731
    white, black, red, yellow, blue = M('s_white', '#e8e8e2'), M('s_black', '#141414'), M('s_red', '#b3201a'), M('s_yellow', '#e5b31c'), M('s_blue', '#1d5aa8')
    objs.append(slab('bg', -0.05, -0.05, W + 0.05, H + 0.05, -0.02, 0.0, M('s_grey', '#7a7a78')))

    def rect(name, x0, y0, x1, y1, mat, zz=0.002):
        return slab(name, x0, y0, x1, y1, 0.0, zz, mat)

    def cell(key):
        x0, y0, x1, y1 = SIGNS[key]
        # atlas y aşağıdan yukarı: satırları yukarıdan yerleştir
        return x0, H - y1, x1, H - y0

    def T(body, x, y, s, mat, font='BarlowCondensed-Bold.ttf', zz=0.004, align='CENTER'):
        objs.append(text(body, x, y, s, zz, mat, font=font, align=align))

    # Taksi yolu tabelaları
    x0, y0, x1, y1 = cell('taxi_A')
    objs.append(rect('a', x0, y0, x1, y1, black))
    objs.append(rect('a2', x0 + 0.012, y0 + 0.012, x1 - 0.012, y1 - 0.012, black, 0.003))
    objs.append(rect('ab', x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - 0.02, yellow, 0.0025))
    objs.append(rect('ai', x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, black, 0.003))
    T('A', (x0 + x1) / 2, (y0 + y1) / 2, 0.2, yellow)
    x0, y0, x1, y1 = cell('taxi_rwy')
    objs.append(rect('r', x0, y0, x1, y1, red))
    T('09-27', (x0 + x1) / 2, (y0 + y1) / 2, 0.19, white)
    x0, y0, x1, y1 = cell('taxi_dir')
    objs.append(rect('d', x0, y0, x1, y1, yellow))
    T('A', x0 + 0.13, (y0 + y1) / 2, 0.19, black)
    ay = (y0 + y1) / 2
    ax = x0 + 0.24
    objs.append(rect('ar', ax, ay - 0.02, ax + 0.08, ay + 0.02, black, 0.004))
    objs.append(mesh_obj('ah', [(ax + 0.08, ay - 0.055, 0.004), (ax + 0.14, ay, 0.004), (ax + 0.08, ay + 0.055, 0.004)], [(0, 1, 2)], black))
    for key, n in (('hangar_no1', '1'), ('hangar_no2', '2')):
        x0, y0, x1, y1 = cell(key)
        objs.append(rect('h' + n, x0, y0, x1, y1, white))
        objs.append(rect('hb' + n, x0 + 0.015, y0 + 0.015, x1 - 0.015, y1 - 0.015, M('s_navy', '#1c2a3a'), 0.003))
        T(f'HANGAR {n}', (x0 + x1) / 2, (y0 + y1) / 2, 0.12, white)
    # Dikkat: kapı hareketi (sarı başlık)
    x0, y0, x1, y1 = cell('dikkat_kapi')
    objs.append(rect('k', x0, y0, x1, y1, white))
    objs.append(rect('kh', x0, y1 - 0.1, x1, y1, yellow, 0.003))
    T('DİKKAT', (x0 + x1) / 2, y1 - 0.05, 0.085, black)
    T('KAPI HAREKET EDERKEN', (x0 + x1) / 2, y0 + 0.17, 0.05, black, font='BarlowCondensed-SemiBold.ttf')
    T('YAKLAŞMAYINIZ', (x0 + x1) / 2, y0 + 0.1, 0.05, black, font='BarlowCondensed-SemiBold.ttf')
    objs.append(rect('kf', x0 + 0.01, y0 + 0.01, x1 - 0.01, y0 + 0.02, black, 0.003))
    # Sigara içilmez: kırmızı halka + çapraz çizgi
    x0, y0, x1, y1 = cell('sigara')
    objs.append(rect('s', x0, y0, x1, y1, white))
    cx, cy, r = (x0 + x1) / 2, y1 - 0.12, 0.085
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=48, radius=r, cap_ends=True)
    me = bpy.data.meshes.new('ring')
    bm.to_mesh(me)
    bm.free()
    ring = link(bpy.data.objects.new('ring', me))
    ring.location = (cx, cy, 0.003)
    ring.data.materials.append(red)
    objs.append(ring)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=48, radius=r * 0.78, cap_ends=True)
    me = bpy.data.meshes.new('ringi')
    bm.to_mesh(me)
    bm.free()
    ri = link(bpy.data.objects.new('ringi', me))
    ri.location = (cx, cy, 0.0035)
    ri.data.materials.append(white)
    objs.append(ri)
    objs.append(rect('cig', cx - 0.05, cy - 0.012, cx + 0.04, cy + 0.012, black, 0.0038))
    a = math.radians(-45)
    ca, sa = math.cos(a), math.sin(a)
    L, t = r * 0.82, 0.013
    corners = [(-L, -t), (L, -t), (L, t), (-L, t)]
    objs.append(mesh_obj('bar', [(cx + u * ca - v * sa, cy + u * sa + v * ca, 0.0042) for u, v in corners], [(0, 1, 2, 3)], red))
    T('SİGARA', cx, y0 + 0.085, 0.045, red)
    T('İÇİLMEZ', cx, y0 + 0.035, 0.045, red)
    # Askeri yasak bölge
    x0, y0, x1, y1 = cell('askeri')
    objs.append(rect('m', x0, y0, x1, y1, red))
    objs.append(rect('mi', x0 + 0.012, y0 + 0.012, x1 - 0.012, y1 - 0.012, white, 0.003))
    objs.append(rect('mii', x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - 0.02, red, 0.0035))
    T('ASKERİ YASAK BÖLGE', (x0 + x1) / 2, y1 - 0.1, 0.075, white)
    T('YABANCI GİREMEZ', (x0 + x1) / 2, y0 + 0.13, 0.06, white, font='BarlowCondensed-SemiBold.ttf')
    T('GİRENLER HAKKINDA SİLAH KULLANILABİLİR', (x0 + x1) / 2, y0 + 0.06, 0.032, white, font='BarlowCondensed-SemiBold.ttf')
    # Yangın söndürme cihazı
    x0, y0, x1, y1 = cell('yangin')
    objs.append(rect('y', x0, y0, x1, y1, red))
    objs.append(rect('yb', (x0 + x1) / 2 - 0.035, y0 + 0.13, (x0 + x1) / 2 + 0.035, y1 - 0.06, white, 0.003))
    objs.append(rect('yh', (x0 + x1) / 2 - 0.015, y1 - 0.06, (x0 + x1) / 2 + 0.015, y1 - 0.03, white, 0.003))
    T('YANGIN', (x0 + x1) / 2, y0 + 0.085, 0.045, white)
    T('TÜPÜ', (x0 + x1) / 2, y0 + 0.037, 0.045, white)
    # Kulak koruyucu takınız (mavi zorunluluk levhası)
    x0, y0, x1, y1 = cell('kulak')
    objs.append(rect('q', x0, y0, x1, y1, white))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=48, radius=0.095, cap_ends=True)
    me = bpy.data.meshes.new('qc')
    bm.to_mesh(me)
    bm.free()
    qc = link(bpy.data.objects.new('qc', me))
    qc.location = ((x0 + x1) / 2, y1 - 0.12, 0.003)
    qc.data.materials.append(blue)
    objs.append(qc)
    # stilize kulaklık: iki kulaklık + bant (beyaz)
    cxq, cyq = (x0 + x1) / 2, y1 - 0.12
    objs.append(rect('q1', cxq - 0.06, cyq - 0.04, cxq - 0.035, cyq + 0.01, white, 0.004))
    objs.append(rect('q2', cxq + 0.035, cyq - 0.04, cxq + 0.06, cyq + 0.01, white, 0.004))
    objs.append(rect('q3', cxq - 0.05, cyq + 0.035, cxq + 0.05, cyq + 0.05, white, 0.004))
    objs.append(rect('q4', cxq - 0.05, cyq, cxq - 0.04, cyq + 0.045, white, 0.004))
    objs.append(rect('q5', cxq + 0.04, cyq, cxq + 0.05, cyq + 0.045, white, 0.004))
    T('KULAK KORUYUCU', (x0 + x1) / 2, y0 + 0.085, 0.042, blue)
    T('TAKINIZ', (x0 + x1) / 2, y0 + 0.037, 0.042, blue)
    # Yüksek gerilim: sarı üçgen, şimşek
    x0, y0, x1, y1 = cell('gerilim')
    objs.append(rect('g', x0, y0, x1, y1, white))
    cxg, by = (x0 + x1) / 2, y0 + 0.16
    objs.append(mesh_obj('gt', [(cxg - 0.14, by, 0.003), (cxg + 0.14, by, 0.003), (cxg, by + 0.22, 0.003)], [(0, 1, 2)], black))
    objs.append(mesh_obj('gti', [(cxg - 0.115, by + 0.015, 0.0035), (cxg + 0.115, by + 0.015, 0.0035), (cxg, by + 0.195, 0.0035)], [(0, 1, 2)], yellow))
    objs.append(mesh_obj('bolt', [(cxg + 0.01, by + 0.165, 0.004), (cxg - 0.03, by + 0.09, 0.004), (cxg + 0.0, by + 0.09, 0.004),
                                  (cxg - 0.015, by + 0.035, 0.004), (cxg + 0.035, by + 0.105, 0.004), (cxg + 0.005, by + 0.105, 0.004)],
                         [(0, 1, 2), (2, 3, 4), (2, 4, 5), (0, 2, 5)], black))
    T('YÜKSEK GERİLİM', cxg, y0 + 0.1, 0.05, black)
    T('ÖLÜM TEHLİKESİ', cxg, y0 + 0.045, 0.045, red)
    # Jet egzozu tehlikesi
    x0, y0, x1, y1 = cell('jet')
    objs.append(rect('j', x0, y0, x1, y1, yellow))
    objs.append(rect('jf', x0 + 0.012, y0 + 0.012, x1 - 0.012, y1 - 0.012, black, 0.003))
    objs.append(rect('ji', x0 + 0.022, y0 + 0.022, x1 - 0.022, y1 - 0.022, yellow, 0.0035))
    T('TEHLİKE', (x0 + x1) / 2, y1 - 0.08, 0.08, black)
    T('JET EGZOZU VE', (x0 + x1) / 2, y0 + 0.19, 0.055, black, font='BarlowCondensed-SemiBold.ttf')
    T('MOTOR EMİŞ BÖLGESİ', (x0 + x1) / 2, y0 + 0.12, 0.055, black, font='BarlowCondensed-SemiBold.ttf')
    T('MOTOR ÇALIŞIRKEN YAKLAŞMAYINIZ', (x0 + x1) / 2, y0 + 0.055, 0.035, black, font='BarlowCondensed-SemiBold.ttf')
    # FOD kontrolü
    x0, y0, x1, y1 = cell('fod')
    objs.append(rect('f', x0, y0, x1, y1, blue))
    objs.append(rect('fi', x0 + 0.012, y0 + 0.012, x1 - 0.012, y1 - 0.012, white, 0.003))
    objs.append(rect('fii', x0 + 0.02, y0 + 0.02, x1 - 0.02, y1 - 0.02, blue, 0.0035))
    T('FOD', (x0 + x1) / 2, y1 - 0.11, 0.13, white)
    T('YABANCI MADDE KONTROLÜ', (x0 + x1) / 2, y0 + 0.12, 0.045, white, font='BarlowCondensed-SemiBold.ttf')
    T('YAPMADAN APRONA ÇIKMAYINIZ', (x0 + x1) / 2, y0 + 0.06, 0.04, white, font='BarlowCondensed-SemiBold.ttf')
    # Hız sınırı (apron araç yolu)
    x0, y0, x1, y1 = cell('hiz')
    objs.append(rect('h', x0, y0, x1, y1, white))
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=48, radius=0.13, cap_ends=True)
    me = bpy.data.meshes.new('hc')
    bm.to_mesh(me)
    bm.free()
    hc = link(bpy.data.objects.new('hc', me))
    hc.location = ((x0 + x1) / 2, y1 - 0.16, 0.003)
    hc.data.materials.append(red)
    objs.append(hc)
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, segments=48, radius=0.1, cap_ends=True)
    me = bpy.data.meshes.new('hci')
    bm.to_mesh(me)
    bm.free()
    hci = link(bpy.data.objects.new('hci', me))
    hci.location = ((x0 + x1) / 2, y1 - 0.16, 0.0035)
    hci.data.materials.append(white)
    objs.append(hci)
    T('20', (x0 + x1) / 2, y1 - 0.16, 0.11, black)
    T('APRON AZAMİ HIZ', (x0 + x1) / 2, y0 + 0.05, 0.045, black)
    return objs


SETS = {
    # ad: (fiziksel W, H (m), piksel W, H, kurucu, max ışın mesafesi)
    'door': (7.33, 9.95, 1024, 1390, build_door, 0.2),
    'cladding': (2.0, 1.035, 512, 265, build_cladding, 0.2),
    'facade': (3.2, 3.4, 512, 544, build_facade, 0.35),
    'signs': (2.0, 1.0, 2048, 1024, build_signs, 0.1),
}


def low_plane(W, H, z):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5,
                          matrix=Matrix.Translation((0.5, 0.5, 0)))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x, loop.vert.co.y)
    bm.transform(Matrix.Diagonal((W, H, 1, 1)))
    m = bpy.data.materials.new('LOW')
    m.use_nodes = True
    me = bpy.data.meshes.new('low')
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new('low', me))
    obj.location.z = z
    obj.data.materials.append(m)
    return obj


def bake(low, highs, img, kind, samples, dist, **kw):
    nt = low.active_material.node_tree
    node = nt.nodes.get('BAKE_TARGET') or nt.nodes.new('ShaderNodeTexImage')
    node.name = 'BAKE_TARGET'
    node.image = img
    nt.nodes.active = node
    bpy.context.scene.cycles.samples = samples
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for h in highs:
        h.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    t0 = time.time()
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=0.0,
                        max_ray_distance=dist, margin=4, use_clear=True, **kw)
    print(f'  {kind}: {time.time() - t0:.1f} s', flush=True)


def arr(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def save(a, path, quality, color=False):
    h, w = a.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    rgba = np.concatenate([a, np.ones((h, w, 1), np.float32)], axis=2)
    if color:
        c = np.clip(rgba[..., :3], 0, 1)
        rgba[..., :3] = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = 'WEBP'
    img.save(filepath=path, quality=quality)
    print(f'  yazıldı {path} ({os.path.getsize(path) / 1024:.0f} KB)', flush=True)


def set_emission(prop):
    """Yayımı malzemenin özel özelliğine (rough/glass) çevir."""
    for m in bpy.data.materials:
        if prop in m.keys():
            b = m.node_tree.nodes['Principled BSDF']
            for l in list(b.inputs['Emission Color'].links):
                m.node_tree.links.remove(l)
            v = float(m[prop])
            b.inputs['Emission Color'].default_value = (v, v, v, 1)


def run(name, samples, quality):
    W, H, PW, PH, builder, dist = SETS[name]
    t0 = time.time()
    reset()
    _mats.clear()
    bpy.context.scene.world.light_settings.distance = 0.3 if name != 'signs' else 0.01
    highs = builder(W, H)
    top = 0.25 if name != 'signs' else 0.02
    low = low_plane(W, H, top)
    print(f'{name}: {len(highs)} nesne, {time.time() - t0:.1f} s', flush=True)
    imgs = {k: bpy.data.images.new(k, PW, PH, float_buffer=True, alpha=False) for k in ('normal', 'ao', 'emit', 'rough', 'glass')}
    for im in imgs.values():
        im.colorspace_settings.name = 'Non-Color'
    bake(low, highs, imgs['emit'], 'EMIT', 4, dist + top)
    albedo = arr(imgs['emit'])[..., :3]
    os.makedirs(OUT, exist_ok=True)
    if name == 'signs':
        save(albedo, os.path.join(OUT, f'{name}_albedo.webp'), quality, color=True)
        return
    bake(low, highs, imgs['normal'], 'NORMAL', 4, dist + top, normal_space='TANGENT')
    bake(low, highs, imgs['ao'], 'AO', samples, dist + top)
    set_emission('rough')
    bake(low, highs, imgs['rough'], 'EMIT', 2, dist + top)
    set_emission('glass')
    bake(low, highs, imgs['glass'], 'EMIT', 2, dist + top)
    normal = arr(imgs['normal'])[..., :3]
    ao = arr(imgs['ao'])[..., 0]
    rough = arr(imgs['rough'])[..., 0]
    glass = arr(imgs['glass'])[..., 0]
    rough = np.clip(rough + (1 - ao) * 0.2, 0, 1)
    albedo = albedo * (0.5 + 0.5 * ao[..., None])
    save(albedo, os.path.join(OUT, f'{name}_albedo.webp'), quality, color=True)
    save(normal, os.path.join(OUT, f'{name}_normal.webp'), quality)
    save(np.stack([ao, rough, glass], axis=2), os.path.join(OUT, f'{name}_orm.webp'), quality)
    print(f'{name}: {time.time() - t0:.1f} s', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--samples', type=int, default=48)
    ap.add_argument('--quality', type=int, default=88)
    args = ap.parse_args(argv)
    names = [n for n in SETS if not args.only or n in args.only.split(',')]
    for n in names:
        run(n, args.samples, args.quality)
    with open(os.path.join(OUT, 'signs.json'), 'w') as f:
        json.dump({k: [v[0] / 2.0, v[1], v[2] / 2.0, v[3]] for k, v in SIGNS.items()}, f, indent=1)


if __name__ == '__main__':
    main()
