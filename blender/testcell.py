"""
Motor test hücresi — Blender ile üretilen ortam varlığı.

Sahnenin tamamı kodla kurulur (elle düzenlenmiş .blend dosyası yok); her
değişiklik incelenebilir ve tekrar üretilebilir:

    /home/user/bpyenv/bin/python blender/testcell.py --preview out/
    /home/user/bpyenv/bin/python blender/testcell.py --bake --out src/assets/testcell.glb

Koordinatlar oyundaki (three.js) eksenlerle yazılır: Y yukarı, +Z egzoz yönü,
motor ekseni Z. Blender Z-yukarı olduğundan `P()` dönüştürür; glTF dışa
aktarımı tekrar Y-yukarıya çevirir.

Işık "pişirilir": Cycles global aydınlatması doku haritalarına yazılır ve
oyunda aydınlatmasız (unlit) malzemeyle gösterilir. Renk (albedo) ve ışık ayrı
pişirilir; yalnızca ışık haritası gürültüden arındırılır, böylece doku
detayları bulanıklaşmaz. Pişirme sırasında dışa aktarılmayan bir "vekil motor"
zemine motorun yumuşak gölgesini düşürür.
"""

import argparse
import math
import os
import sys
import time

import bpy  # noqa: I001 — bmesh yalnızca bpy yüklendikten sonra içe aktarılabilir
import bmesh
import numpy as np
from mathutils import Euler, Vector

# ---------------------------------------------------------------------------
# Ölçüler (metre, oyun koordinatları)
# ---------------------------------------------------------------------------

FLOOR = -3.35          # oyundaki zemin yüksekliği
CEIL = 11.5
WALL_X = 13.5
FRONT_Z = -22.0        # hava girişi (susturucu) duvarı
BACK_Z = 16.0          # arka duvar (augmenter buradan geçer)
AUG_R = 2.45           # augmenter iç yarıçapı
AUG_Z0 = 9.0           # augmenter giriş ağzı


def P(x, y, z):
    """Oyun koordinatı (Y-yukarı, +Z arka) → Blender (Z-yukarı)."""
    return Vector((x, -z, y))


# ---------------------------------------------------------------------------
# Sahne yardımcıları
# ---------------------------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.004, 0.005, 0.006, 1)
    scn.world = world


def link(obj, collection='cell'):
    col = bpy.data.collections.get(collection)
    if col is None:
        col = bpy.data.collections.new(collection)
        bpy.context.scene.collection.children.link(col)
    col.objects.link(obj)
    return obj


def mesh_obj(name, bm, mat, collection='cell'):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    if mat:
        obj.data.materials.append(mat)
    return link(obj, collection)


def box(name, center, size, mat, collection='cell'):
    """Merkez ve boyut oyun koordinatlarında (sx, sy, sz)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sz, v.co.z * sy))
    obj = mesh_obj(name, bm, mat, collection)
    obj.location = P(*center)
    return obj


def quad(name, corners, normal, mat, collection='cell'):
    """Tek yüzlü dörtgen (oyun koordinatlarında köşeler). Görünmeyen arka
    yüzlere doku alanı harcanmaz — büyük yüzeylerde çözünürlüğü ikiye katlar."""
    bm = bmesh.new()
    verts = [bm.verts.new(P(*c)) for c in corners]
    face = bm.faces.new(verts)
    bm.normal_update()
    if face.normal.dot(P(*normal)) < 0:
        face.normal_flip()
    return mesh_obj(name, bm, mat, collection)


def cylinder(name, center, radius, length, axis, mat, segments=40, collection='cell'):
    """axis: oyun ekseninde 'x' | 'y' | 'z'."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=length)
    obj = mesh_obj(name, bm, mat, collection)
    obj.location = P(*center)
    if axis == 'x':
        obj.rotation_euler = Euler((0, math.pi / 2, 0))
    elif axis == 'z':
        obj.rotation_euler = Euler((math.pi / 2, 0, 0))
    return obj


def lathe(name, profile, mat, segments=64, collection='cell'):
    """profile: [(yarıçap, oyun-z)] → oyun Z ekseni etrafında dönel yüzey."""
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        rings.append([bm.verts.new(P(r * math.cos(a), r * math.sin(a), z)) for (r, z) in profile])
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(len(profile) - 1):
            bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
    bm.normal_update()
    return mesh_obj(name, bm, mat, collection)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


TEXT_ROT = {
    '+x': Euler((math.pi / 2, 0, math.pi / 2)),
    '-x': Euler((math.pi / 2, 0, -math.pi / 2)),
    '-z': Euler((math.pi / 2, 0, math.pi)),
    'up-z': Euler((0, 0, math.pi)),
}


def text(name, body, center, size, mat, facing='+x', extrude=0.004):
    """Tabela metni; facing: metnin baktığı oyun yönü."""
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    obj = link(bpy.data.objects.new(name, cu))
    obj.location = P(*center)
    obj.rotation_euler = TEXT_ROT[facing]
    obj.data.materials.append(mat)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active


# ---------------------------------------------------------------------------
# Malzemeler (prosedürel; renkler pişirmede haritaya yazılır)
# ---------------------------------------------------------------------------

class M:
    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.bsdf = self.nt.nodes['Principled BSDF']

    def node(self, kind, **inputs):
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if k in n.inputs:
                n.inputs[k].default_value = v
            else:
                setattr(n, k, v)
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def coords(self):
        return self.node('ShaderNodeTexCoord').outputs['Object']

    def multiply(self, a, b):
        mix = self.node('ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
        mix.inputs['Factor'].default_value = 1.0
        self.link(a, mix.inputs[6])
        self.link(b, mix.inputs[7])
        return mix.outputs[2]

    def gray(self, value_socket):
        comb = self.node('ShaderNodeCombineColor')
        for ch in ('Red', 'Green', 'Blue'):
            self.link(value_socket, comb.inputs[ch])
        return comb.outputs['Color']

    def ramp(self, fac, stops, constant=False):
        r = self.node('ShaderNodeValToRGB')
        if constant:
            r.color_ramp.interpolation = 'CONSTANT'
        els = r.color_ramp.elements
        while len(els) < len(stops):
            els.new(0.5)
        for el, (pos, col) in zip(els, stops):
            el.position = pos
            el.color = col
        self.link(fac, r.inputs['Fac'])
        return r.outputs['Color']

    def base(self, sock, rough=0.7):
        self.link(sock, self.bsdf.inputs['Base Color'])
        self.bsdf.inputs['Roughness'].default_value = rough
        return self.mat


def srgb(hexstr):
    """#rrggbb → doğrusal RGBA (Blender düğümleri doğrusal renk ister)."""
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1.0)


def flat(name, color, rough=0.6):
    m = M(name)
    m.bsdf.inputs['Base Color'].default_value = srgb(color)
    m.bsdf.inputs['Roughness'].default_value = rough
    return m.mat


def varied_socket(m, dark, light, scale, detail=8.0, grime=None, grime_scale=0.6):
    co = m.coords()
    n1 = m.node('ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=0.62)
    m.link(co, n1.inputs['Vector'])
    out = m.ramp(n1.outputs['Fac'], [(0.3, srgb(dark)), (0.72, srgb(light))])
    if grime:
        n2 = m.node('ShaderNodeTexNoise', Scale=grime_scale, Detail=4.0)
        m.link(co, n2.inputs['Vector'])
        stain = m.ramp(n2.outputs['Fac'], [(0.55, (1, 1, 1, 1)), (0.78, srgb(grime))])
        out = m.multiply(out, stain)
    return out


def varied(name, dark, light, scale=4.0, detail=8.0, rough=0.7, grime=None, grime_scale=0.6):
    m = M(name)
    return m.base(varied_socket(m, dark, light, scale, detail, grime, grime_scale), rough)


def gradient(m, axis, lo, hi, v_lo, v_hi):
    """Oyun ekseni boyunca açıklık/koyuluk çarpanı ('y' yükseklik, 'z' boy)."""
    sep = m.node('ShaderNodeSeparateXYZ')
    m.link(m.coords(), sep.inputs['Vector'])
    rng = m.node('ShaderNodeMapRange')
    if axis == 'y':
        src = sep.outputs['Z']
        a, b = lo, hi
    else:  # oyun z = −Blender y
        src = sep.outputs['Y']
        a, b = -lo, -hi
    rng.inputs['From Min'].default_value = a
    rng.inputs['From Max'].default_value = b
    rng.inputs['To Min'].default_value = v_lo
    rng.inputs['To Max'].default_value = v_hi
    m.link(src, rng.inputs['Value'])
    return m.gray(rng.outputs['Result'])


def floor_concrete(name):
    """Epoksi boyalı beton: gürültü, yağ lekeleri, augmenter önünde kurum."""
    m = M(name)
    col = varied_socket(m, '#4f4e4b', '#6a6863', 2.2, grime='#5b554a', grime_scale=0.35)
    col = m.multiply(col, gradient(m, 'z', AUG_Z0 - 0.5, AUG_Z0 - 7.0, 0.3, 1.0))
    return m.base(col, 0.6)


def panels(name, color_a, color_b, mortar, panel_w, panel_h, plane):
    """Akustik duvar panelleri (dikey), zemine yakın kir ve akıntı izleri."""
    m = M(name)
    co = m.coords()
    sep = m.node('ShaderNodeSeparateXYZ')
    m.link(co, sep.inputs['Vector'])
    comb = m.node('ShaderNodeCombineXYZ')
    axis = {'x': 'X', 'z': 'Y', 'y': 'Z'}
    m.link(sep.outputs[axis[plane[0]]], comb.inputs['X'])
    m.link(sep.outputs[axis[plane[1]]], comb.inputs['Y'])
    brick = m.node('ShaderNodeTexBrick', offset=0.0, squash=1.0)
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Mortar Size'].default_value = 0.014
    brick.inputs['Brick Width'].default_value = panel_w
    brick.inputs['Row Height'].default_value = panel_h
    brick.inputs['Color1'].default_value = srgb(color_a)
    brick.inputs['Color2'].default_value = srgb(color_b)
    brick.inputs['Mortar'].default_value = srgb(mortar)
    m.link(comb.outputs['Vector'], brick.inputs['Vector'])
    noise = m.node('ShaderNodeTexNoise', Scale=0.35, Detail=5.0)
    m.link(co, noise.inputs['Vector'])
    col = m.multiply(brick.outputs['Color'], m.ramp(noise.outputs['Fac'], [(0.0, (0.8, 0.8, 0.8, 1)), (1.0, (1, 1, 1, 1))]))
    # Dikey akıntı izleri (sadece yükseklik ekseninde uzatılmış gürültü)
    streak_vec = m.node('ShaderNodeMapping')
    streak_vec.inputs['Scale'].default_value = (6.0, 6.0, 0.25)
    m.link(co, streak_vec.inputs['Vector'])
    streak = m.node('ShaderNodeTexNoise', Scale=1.0, Detail=3.0)
    m.link(streak_vec.outputs['Vector'], streak.inputs['Vector'])
    col = m.multiply(col, m.ramp(streak.outputs['Fac'], [(0.45, (1, 1, 1, 1)), (0.8, (0.78, 0.76, 0.72, 1))]))
    col = m.multiply(col, gradient(m, 'y', FLOOR + 0.2, FLOOR + 3.5, 0.6, 1.0))
    return m.base(col, 0.8)


def hatch(name, a, b, width):
    """Çapraz çizgili zemin boyası."""
    m = M(name)
    wave = m.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='DIAGONAL', wave_profile='SAW')
    wave.inputs['Scale'].default_value = 1.0 / width
    wave.inputs['Distortion'].default_value = 0.0
    m.link(m.coords(), wave.inputs['Vector'])
    return m.base(m.ramp(wave.outputs['Fac'], [(0.0, srgb(a)), (0.5, srgb(b))], constant=True), 0.55)


def grating(name, bar, gap, pitch):
    m = M(name)
    brick = m.node('ShaderNodeTexBrick', offset=0.0)
    brick.inputs['Scale'].default_value = 1.0 / pitch
    brick.inputs['Mortar Size'].default_value = 0.15
    brick.inputs['Color1'].default_value = srgb(gap)
    brick.inputs['Color2'].default_value = srgb(gap)
    brick.inputs['Mortar'].default_value = srgb(bar)
    m.link(m.coords(), brick.inputs['Vector'])
    return m.base(brick.outputs['Color'], 0.6)


def emissive(name, color, strength):
    m = M(name)
    m.bsdf.inputs['Base Color'].default_value = srgb(color)
    m.bsdf.inputs['Emission Color'].default_value = srgb(color)
    m.bsdf.inputs['Emission Strength'].default_value = strength
    return m.mat


def build_materials():
    return {
        'concrete': floor_concrete('concrete'),
        'concrete_dark': varied('concrete_dark', '#383836', '#474643', scale=3.0),
        'wall_side': panels('wall_side', '#6f757a', '#787e83', '#3b3f43', 1.2, 3.0, plane='zy'),
        'wall_back': panels('wall_back', '#6f757a', '#787e83', '#3b3f43', 1.2, 3.0, plane='xy'),
        'dado': varied('dado', '#2c3034', '#363b40', scale=3.0),
        'ceiling': varied('ceiling', '#1c1e21', '#25282c', scale=1.5),
        'splitter': varied('splitter', '#5d6166', '#6c7075', scale=6.0),
        'steel_dark': varied('steel_dark', '#23262a', '#2f3337', scale=5.0, rough=0.5),
        'steel': varied('steel', '#3b424a', '#48505a', scale=5.0, rough=0.45, grime='#555048', grime_scale=0.9),
        'galv': varied('galv', '#7d8387', '#90969a', scale=9.0, rough=0.5),
        'yellow': varied('yellow', '#d69e00', '#efb700', scale=4.0, grime='#7a6a4a', grime_scale=1.2),
        'red': flat('red', '#b0170f', 0.5),
        'blue': flat('blue', '#1d4f9c', 0.4),
        'black': flat('black', '#111213', 0.7),
        'soot': varied('soot', '#0e0d0c', '#1d1a17', scale=1.2),
        'aug_outer': varied('aug_outer', '#383c40', '#474b50', scale=2.0, grime='#2e2a24', grime_scale=0.5),
        'paint_yellow': flat('paint_yellow', '#f0b400', 0.5),
        'paint_white': flat('paint_white', '#cfd0cb', 0.5),
        'hatch_red': hatch('hatch_red', '#b8160e', '#cfcac0', 0.45),
        'hatch_yellow': hatch('hatch_yellow', '#141414', '#f0b400', 0.25),
        'grate': grating('grate', '#4a4e52', '#0b0c0d', 0.05),
        'desk': varied('desk', '#23262b', '#2c3036', scale=4.0),
        'sign_white': flat('sign_white', '#e6e6e0', 0.5),
        'sign_red': flat('sign_red', '#b3160e', 0.5),
        'sign_blue': flat('sign_blue', '#1646a0', 0.5),
        'text_dark': flat('text_dark', '#101010', 0.5),
        # Çalışma zamanında parlak (aydınlatmasız) gösterilecek yüzeyler
        'fixture': emissive('EMIT_fixture', '#f4f6ff', 6.0),
        'daylight': emissive('EMIT_daylight', '#dfe9f5', 2.4),
        'monitor': emissive('EMIT_monitor', '#6fb3ff', 3.0),
        'monitor_green': emissive('EMIT_monitor_green', '#6fe0a0', 2.6),
        'exit_sign': emissive('EMIT_exit', '#35d06a', 4.0),
        'glass': flat('GLASS', '#0a1116', 0.05),
    }


# ---------------------------------------------------------------------------
# Sahne
# ---------------------------------------------------------------------------

def build_scene(mt):
    groups = {'floor': [], 'walls': [], 'props': [], 'emit': [], 'glass': []}
    F, W, Pp, E = groups['floor'], groups['walls'], groups['props'], groups['emit']

    width = 2 * WALL_X
    length = BACK_Z - FRONT_Z
    zc = (BACK_Z + FRONT_Z) / 2
    h = CEIL - FLOOR
    ymid = (CEIL + FLOOR) / 2
    intake_y = (CEIL - 1.8 + FLOOR + 1.0) / 2
    intake_h = CEIL - FLOOR - 2.8

    # ---------------- zemin ----------------
    F.append(quad('floor', [(-WALL_X, FLOOR, FRONT_Z), (WALL_X, FLOOR, FRONT_Z), (WALL_X, FLOOR, BACK_Z),
                            (-WALL_X, FLOOR, BACK_Z)], (0, 1, 0), mt['concrete']))
    py = FLOOR + 0.004
    for x in (-4.2, 4.2):
        F.append(box('line_side', (x, py, -0.5), (0.15, 0.008, 17.0), mt['paint_yellow']))
    for z in (-9.0, 8.0):
        F.append(box('line_end', (0, py, z), (8.55, 0.008, 0.15), mt['paint_yellow']))
    for i in range(-10, 8):
        F.append(box('dash', (0, py, i * 1.2 - 0.5), (0.1, 0.008, 0.6), mt['paint_white']))
    F.append(box('intake_zone', (0, py + 0.001, -12.6), (8.4, 0.008, 6.6), mt['hatch_red']))
    F.append(box('exhaust_zone', (0, py + 0.001, 8.7), (8.4, 0.008, 1.0), mt['hatch_yellow']))
    for x in (-10.5, 10.5):
        F.append(box('walkway', (x, py, zc), (2.2, 0.008, length - 1), mt['concrete_dark']))
        for s in (-1.1, 1.1):
            F.append(box('walk_edge', (x + s, py + 0.001, zc), (0.1, 0.008, length - 1), mt['paint_yellow']))
    F.append(box('drain', (0, py + 0.001, 0.5), (0.7, 0.008, 16.0), mt['grate']))
    for x in (-2.6, 2.6):
        F.append(box('rail', (x, py + 0.002, 0.0), (0.18, 0.02, 18.0), mt['steel']))
    F.append(text('floor_text', 'GİRİŞ TEHLİKE BÖLGESİ', (0, py + 0.003, -8.3), 0.55, mt['paint_white'], facing='up-z', extrude=0.0))

    # ---------------- duvarlar ve tavan ----------------
    for sgn in (-1, 1):
        xw = sgn * WALL_X
        W.append(quad('wall_side', [(xw, FLOOR, FRONT_Z), (xw, CEIL, FRONT_Z), (xw, CEIL, BACK_Z), (xw, FLOOR, BACK_Z)],
                      (-sgn, 0, 0), mt['wall_side']))
        W.append(box('dado', (sgn * (WALL_X - 0.02), FLOOR + 0.6, zc), (0.06, 1.2, length), mt['dado']))
        W.append(box('dado_stripe', (sgn * (WALL_X - 0.03), FLOOR + 1.24, zc), (0.06, 0.08, length), mt['paint_yellow']))
    W.append(quad('wall_back', [(-WALL_X, FLOOR, BACK_Z), (WALL_X, FLOOR, BACK_Z), (WALL_X, CEIL, BACK_Z),
                                (-WALL_X, CEIL, BACK_Z)], (0, 0, -1), mt['wall_back']))
    W.append(quad('ceiling', [(-WALL_X, CEIL, FRONT_Z), (WALL_X, CEIL, FRONT_Z), (WALL_X, CEIL, BACK_Z),
                              (-WALL_X, CEIL, BACK_Z)], (0, -1, 0), mt['ceiling']))
    for z in np.arange(FRONT_Z + 2, BACK_Z, 4.0):
        W.append(box('ceil_beam', (0, CEIL - 0.35, float(z)), (width, 0.7, 0.35), mt['steel_dark']))
    W.append(box('intake_lintel', (0, CEIL - 0.9, FRONT_Z - 0.2), (width + 0.6, 1.8, 0.4), mt['wall_back']))
    W.append(box('intake_sill', (0, FLOOR + 0.5, FRONT_Z - 0.2), (width + 0.6, 1.0, 0.4), mt['concrete_dark']))
    x = -WALL_X + 0.6
    while x < WALL_X - 0.4:
        W.append(box('splitter', (x, intake_y, FRONT_Z - 1.6), (0.34, intake_h, 3.0), mt['splitter']))
        x += 1.05
    zb = FRONT_Z - 3.6
    W.append(quad('intake_back', [(-WALL_X, FLOOR, zb), (WALL_X, FLOOR, zb), (WALL_X, CEIL, zb), (-WALL_X, CEIL, zb)],
                  (0, 0, 1), mt['steel_dark']))
    E.append(box('EMIT_daylight', (0, intake_y, FRONT_Z - 3.45), (width, intake_h, 0.05), mt['daylight']))

    # ---------------- augmenter (egzoz tüpü) ----------------
    inner = [(AUG_R + 1.05, AUG_Z0 - 0.05), (AUG_R + 0.55, AUG_Z0 + 0.2), (AUG_R + 0.15, AUG_Z0 + 0.7),
             (AUG_R, AUG_Z0 + 1.4), (AUG_R, BACK_Z + 0.5)]
    Pp.append(lathe('aug_inner', inner, mt['soot'], 72))
    outer = [(AUG_R + 1.05, AUG_Z0 - 0.05), (AUG_R + 1.12, AUG_Z0 + 0.25), (AUG_R + 0.4, AUG_Z0 + 1.0),
             (AUG_R + 0.25, AUG_Z0 + 1.6), (AUG_R + 0.25, BACK_Z + 0.5)]
    Pp.append(lathe('aug_outer', outer, mt['aug_outer'], 72))
    for z in np.arange(AUG_Z0 + 2.0, BACK_Z, 1.6):
        z = float(z)
        ring = [(AUG_R + 0.25, z - 0.08), (AUG_R + 0.42, z - 0.06), (AUG_R + 0.42, z + 0.06), (AUG_R + 0.25, z + 0.08)]
        Pp.append(lathe('aug_ring', ring, mt['steel_dark'], 72))
    for z in (AUG_Z0 + 2.8, BACK_Z - 1.6):
        top = -AUG_R - 0.3
        Pp.append(box('aug_saddle', (0, (FLOOR + top) / 2, z), (4.2, top - FLOOR, 0.6), mt['concrete_dark']))
    Pp.append(text('aug_text', 'AUGMENTER', (0, AUG_R + 0.85, AUG_Z0 + 0.35), 0.4, mt['text_dark'], facing='-z'))

    # ---------------- itki çerçevesi ----------------
    fix_y = 4.35
    for x in (-1.3, 1.3):
        Pp.append(box('fixed_beam', (x, fix_y, 0.0), (0.35, 0.55, 14.0), mt['steel']))
        for z in (-6.5, 6.5):
            Pp.append(box('column', (x, (CEIL + fix_y) / 2, z), (0.4, CEIL - fix_y, 0.4), mt['steel']))
    for z in (-6.5, -2.6, 2.6, 6.5):
        Pp.append(box('fixed_cross', (0, fix_y, z), (2.95, 0.45, 0.3), mt['steel']))
    live_y = 3.72
    Pp.append(box('live_frame', (0, live_y, -0.1), (1.9, 0.3, 4.2), mt['yellow']))
    for x in (-0.8, 0.8):
        for z in (-1.9, 1.7):
            Pp.append(box('flexure', (x, (fix_y + live_y) / 2, z), (0.22, fix_y - live_y - 0.1, 0.03), mt['galv']))
    Pp.append(box('adapter', (0, 3.3, -0.1), (0.62, 0.5, 2.5), mt['steel_dark']))
    # Yük hücresi: canlı çerçeveden öndeki sabit kirişe, eksen boyunca
    Pp.append(cylinder('loadcell_rod', (0, live_y, -2.4), 0.05, 0.9, 'z', mt['galv'], 16))
    Pp.append(cylinder('loadcell', (0, live_y, -2.25), 0.13, 0.22, 'z', mt['blue'], 28))
    Pp.append(box('loadcell_bracket', (0, (fix_y + live_y) / 2 - 0.05, -2.6), (0.4, fix_y - live_y + 0.2, 0.15), mt['steel_dark']))
    Pp.append(box('cable', (0.25, live_y + 0.18, -1.2), (0.03, 0.03, 2.2), mt['black']))

    # ---------------- aydınlatma armatürleri ----------------
    for xi, zi in fixture_grid():
        Pp.append(box('fixture_body', (xi, CEIL - 0.85, zi), (1.3, 0.12, 0.45), mt['steel_dark']))
        E.append(box('EMIT_fixture', (xi, CEIL - 0.92, zi), (1.2, 0.02, 0.36), mt['fixture']))
        Pp.append(box('fixture_hanger', (xi, CEIL - 0.45, zi), (0.04, 0.7, 0.04), mt['steel_dark']))
    for sgn in (-1, 1):
        for zi in (-7.0, 5.0):
            Pp.append(box('flood', (sgn * (WALL_X - 0.45), 6.2, zi), (0.5, 0.5, 0.7), mt['steel_dark']))
            E.append(box('EMIT_fixture', (sgn * (WALL_X - 0.71), 6.2, zi), (0.02, 0.38, 0.55), mt['fixture']))

    # ---------------- kontrol odası (sol duvar) ----------------
    wy0, wy1 = FLOOR + 1.1, FLOOR + 2.6
    wz0, wz1 = -5.5, 4.5
    wzc = (wz0 + wz1) / 2
    Pp.append(box('window_frame_top', (-WALL_X + 0.02, wy1 + 0.06, wzc), (0.1, 0.12, wz1 - wz0 + 0.2), mt['black']))
    Pp.append(box('window_frame_bot', (-WALL_X + 0.02, wy0 - 0.06, wzc), (0.1, 0.12, wz1 - wz0 + 0.2), mt['black']))
    for z in np.linspace(wz0, wz1, 5):
        Pp.append(box('window_mullion', (-WALL_X + 0.02, (wy0 + wy1) / 2, float(z)), (0.1, wy1 - wy0, 0.1), mt['black']))
    groups['glass'].append(box('GLASS_window', (-WALL_X + 0.01, (wy0 + wy1) / 2, wzc), (0.02, wy1 - wy0, wz1 - wz0), mt['glass']))
    room_x = -WALL_X - 2.2
    Pp.append(box('cr_back', (room_x - 2.0, (FLOOR + 1.0) / 2, wzc), (0.2, 1.0 - FLOOR, 12.0), mt['wall_back']))
    Pp.append(box('cr_floor', (room_x, FLOOR - 0.05, wzc), (4.4, 0.1, 12.0), mt['concrete_dark']))
    Pp.append(box('cr_ceiling', (room_x, 0.65, wzc), (4.4, 0.1, 12.0), mt['ceiling']))
    for z in np.linspace(wz0 + 0.6, wz1 - 0.6, 5):
        z = float(z)
        Pp.append(box('desk', (room_x + 1.0, FLOOR + 0.78, z), (1.0, 0.06, 1.7), mt['desk']))
        Pp.append(box('desk_leg', (room_x + 1.0, FLOOR + 0.39, z), (0.9, 0.78, 0.06), mt['desk']))
        for dz in (-0.45, 0.45):
            Pp.append(box('monitor_body', (room_x + 0.75, FLOOR + 1.15, z + dz), (0.05, 0.42, 0.7), mt['black']))
            E.append(box('EMIT_monitor', (room_x + 0.78, FLOOR + 1.15, z + dz), (0.01, 0.36, 0.64),
                         mt['monitor'] if dz < 0 else mt['monitor_green']))
    for z in np.linspace(wz0 + 1, wz1 - 1, 3):
        E.append(box('EMIT_fixture', (room_x, 0.58, float(z)), (0.8, 0.02, 0.8), mt['fixture']))

    # ---------------- tesisat ----------------
    for sgn in (-1, 1):
        Pp.append(box('cable_tray', (sgn * (WALL_X - 0.35), 8.2, zc), (0.5, 0.12, length - 1), mt['galv']))
        Pp.append(cylinder('fire_pipe', (sgn * (WALL_X - 0.25), 9.6, zc), 0.1, length - 1, 'z', mt['red'], 16))
        Pp.append(cylinder('air_pipe', (sgn * (WALL_X - 0.25), 9.2, zc), 0.14, length - 1, 'z', mt['galv'], 16))
        for zi in np.arange(FRONT_Z + 2, BACK_Z - 1, 3.0):
            Pp.append(box('pipe_bracket', (sgn * (WALL_X - 0.25), 9.4, float(zi)), (0.5, 0.6, 0.06), mt['steel_dark']))
    for x in (-6.0, 6.0):
        Pp.append(cylinder('sprinkler', (x, CEIL - 0.25, zc), 0.06, length - 1, 'z', mt['red'], 12))

    # ---------------- ekipman ----------------
    px, pz = -6.4, -4.5
    for dx in (-0.9, 0.9):
        for dz in (-1.2, 1.2):
            Pp.append(box('plat_leg', (px + dx, FLOOR + 1.1, pz + dz), (0.08, 2.2, 0.08), mt['yellow']))
            Pp.append(box('plat_rail', (px + dx, FLOOR + 3.2, pz + dz), (0.06, 2.0, 0.06), mt['yellow']))
    Pp.append(box('plat_deck', (px, FLOOR + 2.2, pz), (1.95, 0.08, 2.5), mt['grate']))
    for dx in (-0.9, 0.9):
        Pp.append(box('plat_toprail', (px + dx, FLOOR + 4.15, pz), (0.06, 0.06, 2.5), mt['yellow']))
    for dz in (-1.2, 1.2):
        Pp.append(box('plat_toprail', (px, FLOOR + 4.15, pz + dz), (1.9, 0.06, 0.06), mt['yellow']))
    for i in range(8):
        Pp.append(box('stair', (px + 1.35 + i * 0.26, FLOOR + 2.05 - i * 0.27, pz), (0.26, 0.05, 1.0), mt['grate']))
    for dz in (-0.52, 0.52):
        s = box('stringer', (px + 2.3, FLOOR + 1.12, pz + dz), (2.9, 0.12, 0.05), mt['yellow'])
        s.rotation_euler = Euler((0, math.atan2(2.15, 2.1), 0))
        Pp.append(s)
    # Alet dolabı, yangın tüpleri, varil, raf, kaynak arabası vb. oyunda gerçek
    # modellerdir (Poly Haven, CC0; src/core/cellProps.ts) — burada pişirilmez
    for z in np.arange(-8.5, 8.0, 2.0):
        Pp.append(cylinder('bollard', (5.6, FLOOR + 0.5, float(z)), 0.06, 1.0, 'y', mt['yellow'], 12))
        Pp.append(cylinder('bollard_base', (5.6, FLOOR + 0.03, float(z)), 0.18, 0.06, 'y', mt['black'], 16))
    for sgn in (-1, 1):
        for z in (-10.0, 3.0):
            Pp.append(box('cctv', (sgn * (WALL_X - 0.35), 7.0, z), (0.3, 0.22, 0.45), mt['sign_white']))

    # ---------------- tabelalar ----------------
    Pp.append(text('sign_cell', 'TEST HÜCRESİ 3', (-WALL_X + 0.05, 6.8, -1.0), 1.2, mt['sign_white'], facing='+x'))
    Pp.append(box('sign_ear_bg', (WALL_X - 0.03, FLOOR + 2.6, -12.0), (0.02, 0.9, 1.6), mt['sign_blue']))
    Pp.append(text('sign_ear', 'KULAK KORUYUCU\nTAKINIZ', (WALL_X - 0.05, FLOOR + 2.6, -12.0), 0.2, mt['sign_white'], facing='-x', extrude=0.002))
    Pp.append(box('sign_danger_bg', (-WALL_X + 0.03, FLOOR + 2.6, -12.0), (0.02, 0.9, 1.8), mt['sign_red']))
    Pp.append(text('sign_danger', 'MOTOR ÇALIŞIRKEN\nGİRİŞ YASAK', (-WALL_X + 0.05, FLOOR + 2.6, -12.0), 0.2, mt['sign_white'], facing='+x', extrude=0.002))
    Pp.append(box('door', (WALL_X - 0.02, FLOOR + 1.1, 12.0), (0.06, 2.2, 1.2), mt['steel']))
    E.append(box('EMIT_exit', (WALL_X - 0.05, FLOOR + 2.55, 12.0), (0.03, 0.22, 0.6), mt['exit_sign']))
    return groups


def fixture_grid():
    for xi in (-9.0, -4.5, 0.0, 4.5, 9.0):
        for zi in (-18.0, -12.0, -6.0, 0.0, 6.0, 12.0):
            if abs(xi) < 2 and abs(zi) < 8:
                continue  # itki çerçevesinin üstü
            yield xi, zi


def build_proxy_engine():
    """Pişirmede motorun gölgesi için vekil gövde. Dışa aktarılmaz."""
    mat = flat('PROXY', '#707070', 0.5)
    nacelle = [(1.5, -2.2), (1.78, -1.4), (1.76, 0.0), (1.52, 1.5), (0.9, 1.6), (0.66, 3.0), (0.3, 3.9),
               (0.01, 4.2), (0.01, -1.6), (1.5, -2.2)]
    return [lathe('PROXY_nacelle', nacelle, mat, 48, collection='proxy'),
            box('PROXY_pylon', (0, 2.3, 0.0), (0.26, 1.6, 2.6), mat, collection='proxy')]


# ---------------------------------------------------------------------------
# Işıklar (yalnızca pişirme için; oyunda eşdeğerleri ayrıca kurulur)
# ---------------------------------------------------------------------------

def add_light(kind, loc, power, size=None, rot=None, color=(1, 1, 1), spot=None):
    ld = bpy.data.lights.new('L', kind)
    ld.energy = power
    ld.color = color
    if kind == 'AREA' and size:
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = size
    if kind == 'SPOT' and spot:
        ld.spot_size = spot
        ld.spot_blend = 0.6
    ob = bpy.data.objects.new('L', ld)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    return link(ob, 'lights')


def build_lights():
    for xi, zi in fixture_grid():
        add_light('AREA', P(xi, CEIL - 0.95, zi), 700, size=(1.2, 0.36), color=(1.0, 0.97, 0.93))
    for sgn in (-1, 1):
        for zi in (-7.0, 5.0):
            loc = P(sgn * (WALL_X - 0.8), 6.2, zi)
            rot = (P(0, -1.0, zi * 0.3) - loc).normalized().to_track_quat('-Z', 'Y').to_euler()
            add_light('SPOT', loc, 7000, rot=rot, spot=math.radians(55), color=(1.0, 0.95, 0.88))
    add_light('AREA', P(0, (CEIL - 1.8 + FLOOR + 1.0) / 2, FRONT_Z - 3.3), 40000,
              size=(2 * WALL_X, CEIL - FLOOR - 2.8), rot=Euler((math.pi / 2, 0, 0)), color=(0.82, 0.9, 1.0))
    add_light('AREA', P(-WALL_X - 2.2, 0.5, -0.5), 600, size=(3, 8), color=(1.0, 0.92, 0.8))


# ---------------------------------------------------------------------------
# Önizleme
# ---------------------------------------------------------------------------

def preview(outdir, samples):
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = samples
    scn.cycles.use_denoising = True
    scn.render.resolution_x, scn.render.resolution_y = 1280, 720
    scn.view_settings.view_transform = 'AgX'
    os.makedirs(outdir, exist_ok=True)
    cam_data = bpy.data.cameras.new('cam')
    cam = link(bpy.data.objects.new('cam', cam_data), 'lights')
    scn.camera = cam
    views = {
        'wide': ((11.5, 4.5, -17.0), (0, 0.5, 0.0), 50),
        'back': ((-8.0, 2.0, 10.5), (0, 0, 0), 55),
    }
    for name, (pos, tgt, fov) in views.items():
        cam.location = P(*pos)
        cam.rotation_euler = (P(*tgt) - P(*pos)).normalized().to_track_quat('-Z', 'Y').to_euler()
        cam_data.angle = math.radians(fov)
        scn.render.filepath = os.path.join(outdir, f'{name}.png')
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'  render {name}: {time.time() - t0:.1f} s', flush=True)


# ---------------------------------------------------------------------------
# Pişirme ve dışa aktarma
# ---------------------------------------------------------------------------

def uv_unwrap(obj, margin=0.003):
    select_only(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_pass(obj, img, pass_filter, samples):
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('BAKE_TARGET') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'BAKE_TARGET'
        node.image = img
        nt.nodes.active = node
    bpy.context.scene.cycles.samples = samples
    select_only(obj)
    t0 = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=pass_filter, margin=8, margin_type='EXTEND', use_clear=True)
    print(f'    {obj.name} {sorted(pass_filter)}: {time.time() - t0:.1f} s', flush=True)


def image_array(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def box_blur(a, r):
    """Ayrılabilir kutu bulanıklığı (kümülatif toplamla)."""
    out = a
    for axis in (0, 1):
        pad = [(r + 1, r) if i == axis else (0, 0) for i in range(out.ndim)]
        c = np.cumsum(np.pad(out, pad, mode='edge'), axis=axis)
        n = out.shape[axis]
        out = (np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis) - np.take(c, np.arange(n), axis=axis)) / (2 * r + 1)
    return out


def denoise(light, mask, radius):
    """Maskeli yaklaşık Gauss süzgeci: UV adaları arasında ışık karışmaz."""
    num = light * mask[..., None]
    den = mask.copy()
    for _ in range(3):
        num = box_blur(num, radius)
        den = box_blur(den, radius)
    out = num / np.maximum(den[..., None], 1e-4)
    return np.where(mask[..., None] > 0, out, light)


def to_srgb(lin):
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def bake_group(obj, name, size, samples, exposure, outdir):
    uv_unwrap(obj)
    color_img = bpy.data.images.new(f'{name}_color', size, size, float_buffer=True, alpha=False)
    light_img = bpy.data.images.new(f'{name}_light', size, size, float_buffer=True, alpha=False)
    bake_pass(obj, color_img, {'COLOR'}, 1)
    bake_pass(obj, light_img, {'DIRECT', 'INDIRECT'}, samples)
    color = image_array(color_img)[..., :3]
    light = image_array(light_img)[..., :3]
    mask = (color.sum(axis=2) > 1e-6).astype(np.float32)
    light = denoise(light, mask, max(1, size // 1024))
    final = color * light * exposure
    rgba = np.concatenate([to_srgb(final), np.ones((*final.shape[:2], 1), np.float32)], axis=2)
    out = bpy.data.images.new(f'{name}_baked', size, size, float_buffer=False, alpha=False)
    out.pixels.foreach_set(rgba.astype(np.float32).ravel())
    out.filepath_raw = os.path.join(outdir, f'{name}_baked.png')
    out.file_format = 'PNG'
    out.save()
    clipped = float((final > 1).mean()) * 100
    print(f'  {name}: ışık p50={np.percentile(light[mask > 0], 50):.3f} p99={np.percentile(light[mask > 0], 99):.3f}, '
          f'kırpılan %{clipped:.2f}', flush=True)
    return out


def finalize_material(obj, img, name):
    mat = bpy.data.materials.new(f'BAKED_{name}')
    mat.use_nodes = True
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    bsdf = nt.nodes['Principled BSDF']
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', help='önizleme render klasörü')
    ap.add_argument('--bake', action='store_true')
    ap.add_argument('--out', default='src/assets/testcell.glb')
    ap.add_argument('--size', type=int, default=2048)
    ap.add_argument('--samples', type=int, default=128)
    ap.add_argument('--exposure', type=float, default=0.5,
                    help='pişirilen değerlerin ölçeği (oyun bunu malzeme rengiyle geri çarpar)')
    ap.add_argument('--work', default='/tmp/testcell_work')
    args = ap.parse_args(argv)

    t0 = time.time()
    reset()
    mt = build_materials()
    groups = build_scene(mt)
    proxy = build_proxy_engine()
    build_lights()
    print(f'sahne kuruldu: {time.time() - t0:.1f} s', flush=True)

    if args.preview:
        preview(args.preview, args.samples)
        return
    if not args.bake:
        return

    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    os.makedirs(args.work, exist_ok=True)
    baked = {}
    for gname in ('floor', 'walls', 'props'):
        obj = join(groups[gname], f'CELL_{gname}')
        baked[gname] = (obj, bake_group(obj, gname, args.size, args.samples, args.exposure, args.work))
    for gname, (obj, img) in baked.items():
        finalize_material(obj, img, gname)
    join(groups['emit'], 'EMIT_all')
    join(groups['glass'], 'GLASS_all')
    for o in proxy:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP',
                              export_image_quality=82, export_apply=True, export_lights=False,
                              export_cameras=False, export_yup=True, export_materials='EXPORT')
    print(f'dışa aktarıldı: {out} ({os.path.getsize(out) / 1e6:.2f} MB), toplam {time.time() - t0:.0f} s', flush=True)


if __name__ == '__main__':
    main()
