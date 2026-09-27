"""
Panel detay dokuları — Blender'da yüksek poligonlu modelden pişirme.

Motorun boyalı/metal gövde parçalarının yüzeyi düz bir levha olarak
modellenir: panel derzleri (pahlı kenarlı oluklar), perçin başları, vidalar,
kamlok bağlantılar, servis kapakları, kilit yuvaları, havalandırma panjurları,
boroskop tapaları, menteşe takviye plakaları. Cycles bu yüksek poligonlu
modeli düz bir alçak poligonlu levhaya "seçiliden aktife" pişirir:

    <out>/<parça>_normal.webp   tanjant uzayı normal haritası (OpenGL, Y+)
    <out>/<parça>_orm.webp      R = ortam kapanması, G = pürüzlülük, B = metallik

Parçalar ve yerleşimleri src/materials/panelLayouts.json dosyasındadır
(nacelle = fan kaportası, core = çekirdek kaportası, pylon = pilon). Oyun
albedo derzlerini de aynı dosyadan çizdiği için renk ve kabartma örtüşür.

    /home/user/bpyenv/bin/python blender/panel_details.py --out src/assets
    /home/user/bpyenv/bin/python blender/panel_details.py --part core --scale 0.5   # taslak
"""

import argparse
import json
import math
import os
import sys
import time

import bpy  # noqa: I001 — bmesh yalnızca bpy yüklendikten sonra içe aktarılabilir
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAYOUTS = json.load(open(os.path.join(ROOT, 'src/materials/panelLayouts.json'), encoding='utf8'))

# Etkin parçanın yerleşimi (use_layout ile seçilir)
LAYOUT = {}
HALF = 1.0   # levha genişliği (X; kaportada çevre, pilonda kord yönü)
LEN = 1.0    # levha boyu (Y; kaportada eksen, pilonda açıklık yönü)


def use_layout(part):
    global LAYOUT, HALF, LEN
    LAYOUT = {'latches': [], 'doors': [], 'grilles': [], 'plugs': [], 'hinges': [],
              'edgeSeams': True, 'seamFastener': 'rivet', **LAYOUTS[part]}
    HALF = LAYOUT['width']
    LEN = LAYOUT['length']

GAP = 0.005          # panel derzi üst genişliği (doku çözünürlüğüne göre hafif abartılı)
BEVEL = 0.0016       # panel kenar yuvarlatması
BASE_Z = -0.008      # derz tabanı / yuva zemini
DOOR_TOP = -0.0004   # kapaklar gövdeden hafifçe gömük


def X(u):
    return u * HALF


def Y(v):
    return v * LEN


# ---------------------------------------------------------------------------
# Sahne / malzeme
# ---------------------------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.light_settings.distance = 0.03   # AO pişirme mesafesi
    scn.world = world
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.use_denoising = False
    return scn


def material(name, emit, bump=0.0):
    """emit: metal maskesi (EMIT pişirmesinde okunur); bump: boya yüzey dalgası."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    bsdf.inputs['Emission Color'].default_value = (emit, emit, emit, 1)
    bsdf.inputs['Emission Strength'].default_value = 1.0
    if bump > 0:
        # Portakal kabuğu + panel "yağ tenekesi" dalgalanması: boyalı levhanın
        # tamamen düz olmadığı hissi
        coord = nt.nodes.new('ShaderNodeTexCoord')
        noise = nt.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 22.0
        noise.inputs['Detail'].default_value = 5.0
        noise.inputs['Roughness'].default_value = 0.55
        b = nt.nodes.new('ShaderNodeBump')
        b.inputs['Strength'].default_value = bump
        b.inputs['Distance'].default_value = 0.0006
        nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
        nt.links.new(noise.outputs['Fac'], b.inputs['Height'])
        nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def select_only(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ---------------------------------------------------------------------------
# 2B şekiller (poligon nokta listeleri, metre)
# ---------------------------------------------------------------------------

def rrect(cx, cy, w, h, r, n=5):
    r = min(r, w / 2, h / 2)
    pts = []
    for (ox, oy, a0) in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                         (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + ox + r * math.cos(a), cy + oy + r * math.sin(a)))
    return pts


def circle(cx, cy, r, n=20):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def slot(cx, cy, length, width, angle):
    ca, sa = math.cos(angle), math.sin(angle)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca)
            for x, y in ((-length / 2, -width / 2), (length / 2, -width / 2),
                         (length / 2, width / 2), (-length / 2, width / 2))]


def cross(cx, cy, size, width):
    s, w = size / 2, width / 2
    return [(cx + x, cy + y) for x, y in (
        (-w, -s), (w, -s), (w, -w), (s, -w), (s, w), (w, w),
        (w, s), (-w, s), (-w, w), (-s, w), (-s, -w), (-w, -w))]


def slab(name, shapes, top, mat, half=0.002, bevel=BEVEL):
    """Boş şekil listesi için None döner.
    Doldurulmuş 2B eğriyi pahlı levhaya çevirir. Üst yüzün kenarı tam olarak
    eğri üzerindedir; pah dışa doğru taşar. İç içe şekiller delik olur."""
    if not shapes:
        return None
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    cu.extrude = max(half - bevel, 0.00005)
    for pts in shapes:
        s = cu.splines.new('POLY')
        s.points.add(len(pts) - 1)
        for p, (x, y) in zip(s.points, pts):
            p.co = (x, y, 0, 1)
        s.use_cyclic_u = True
        s.use_smooth = True
    obj = link(bpy.data.objects.new(name, cu))
    obj.location.z = top - (cu.extrude + bevel)
    obj.data.materials.append(mat)
    select_only(obj)
    t0 = time.time()
    bpy.ops.object.convert(target='MESH')
    print(f'  {name}: {len(shapes)} şekil, {time.time() - t0:.1f} s', flush=True)
    return bpy.context.view_layer.objects.active


def mesh_from_bmesh(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def instanced(name, points, z, radius, mat):
    """Aynı küreyi çok sayıda noktaya kopyalar (bmesh işlemini binlerce kez
    çağırmak yerine köşe dizilerini numpy ile çoğaltır)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=radius)
    verts = np.array([v.co[:] for v in bm.verts], dtype=np.float32)
    faces = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    pts = np.array(points, dtype=np.float32)
    nv = len(verts)
    offs = np.stack([pts[:, 0], pts[:, 1], np.full(len(pts), z, np.float32)], axis=1)
    allv = (verts[None, :, :] + offs[:, None, :]).reshape(-1, 3)
    allf = [[i * nv + k for k in f] for i in range(len(pts)) for f in faces]
    me = bpy.data.meshes.new(name)
    me.from_pydata(allv.tolist(), [], allf)
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    print(f'  {name}: {len(pts)} adet', flush=True)
    return obj


# ---------------------------------------------------------------------------
# Yerleşim
# ---------------------------------------------------------------------------

def build(mt):
    paint, metal, dark = mt['paint'], mt['metal'], mt['dark']
    objs = []
    screws = []        # (x, y, çap, tür)
    rivets = []        # (x, y)

    # Derz tabanı
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1,
                          matrix=Matrix.Translation((HALF / 2, LEN / 2, BASE_Z)) @
                          Matrix.Diagonal((HALF / 2 + 0.1, LEN / 2 + 0.1, 1, 1)))
    objs.append(mesh_from_bmesh('base', bm, dark))

    u_edges = LAYOUT['seamsU']
    v_edges = [-0.03] + LAYOUT['ringsV'] + [1.03]
    g = GAP / 2

    latches = [(Y(l['v']), l['h']) for l in LAYOUT['latches']]
    LATCH_W = 0.042          # kilit yuvasının yarım genişliği (alt hat aynalanır)
    hinges = [Y(h['v']) for h in LAYOUT['hinges']]

    def contains(u0, u1, v0, v1, u, v):
        return u0 <= u < u1 and v0 <= v < v1

    panel_shapes = []
    for ui in range(len(u_edges) - 1):
        u0, u1 = u_edges[ui], u_edges[ui + 1]
        for vi in range(len(v_edges) - 1):
            v0, v1 = v_edges[vi], v_edges[vi + 1]
            # Levhanın dış kenarları (u = 0 / 1) aynalanan derz hatlarıdır;
            # pilonda ise hücum/firar kenarıdır, orada derz açılmaz.
            edge = LAYOUT['edgeSeams']
            x0 = X(u0) + (g if (ui > 0 or edge) else -0.03)
            x1 = X(u1) - (g if (ui < len(u_edges) - 2 or edge) else -0.03)
            y0 = Y(v0) + (g if vi > 0 else 0)
            y1 = Y(v1) - (g if vi < len(v_edges) - 2 else 0)
            # Dış çevre: alt kilit hattında (u = 0) kilit yuvası çentikleri
            left = [(x0, y0)]
            if u0 == 0 and edge:
                for (ly, lh) in latches:
                    a, b = ly - lh / 2, ly + lh / 2
                    if y0 < a and b < y1:
                        left += [(x0, a), (LATCH_W, a), (LATCH_W, b), (x0, b)]
            left.append((x0, y1))
            # saat yönünün tersine: sağ-alt → sağ-üst → sol-üst → ... → sol-alt
            outline = [(x1, y0), (x1, y1)] + left[::-1]
            shapes = [outline]
            for d in LAYOUT['doors']:
                if contains(u0, u1, v0, v1, d['u'], d['v']):
                    shapes.append(rrect(X(d['u']), Y(d['v']), d['w'] + 2 * GAP, d['h'] + 2 * GAP, 0.014 + GAP))
            for gr in LAYOUT['grilles']:
                if contains(u0, u1, v0, v1, gr['u'], gr['v']):
                    shapes.append(rrect(X(gr['u']), Y(gr['v']), gr['w'], gr['h'], 0.012))
            for p in LAYOUT['plugs']:
                if contains(u0, u1, v0, v1, p['u'], p['v']):
                    shapes.append(circle(X(p['u']), Y(p['v']), p['d'] / 2 + GAP, 40))
            panel_shapes.append(shapes)

    objs.append(slab('panels', [s for shapes in panel_shapes for s in shapes], 0.0, paint))

    # --- Kapaklar ---
    door_shapes = []
    for d in LAYOUT['doors']:
        cx, cy, w, h = X(d['u']), Y(d['v']), d['w'], d['h']
        door_shapes.append(rrect(cx, cy, w, h, 0.014))
        # Kapak çevresindeki çerçeve vidaları
        step = 0.055
        for sx in np.arange(-w / 2 + 0.02, w / 2 - 0.01, step):
            for sy in (-h / 2 - 0.02, h / 2 + 0.02):
                screws.append((cx + sx, cy + sy, 0.010, 'cross'))
        for sy in np.arange(-h / 2 + 0.03, h / 2 - 0.01, step):
            for sx in (-w / 2 - 0.02, w / 2 + 0.02):
                screws.append((cx + sx, cy + sy, 0.010, 'cross'))
        if d['kind'] == 'oil':
            # Kamlok bağlantılar + basmalı açma düğmesi
            for sx in (-1, 1):
                for sy in (-1, 1):
                    screws.append((cx + sx * (w / 2 - 0.028), cy + sy * (h / 2 - 0.028), 0.020, 'slot'))
            door_shapes.append(rrect(cx, cy, 0.07, 0.03, 0.012))   # düğme çukuru (delik)
        elif d['kind'] == 'relief':
            # Tahliye kapağı: ön kenarda menteşe perçinleri
            for sx in np.arange(-w / 2 + 0.02, w / 2 - 0.01, 0.03):
                rivets.append((cx + sx, cy - h / 2 + 0.018))
            for sx in (-1, 1):
                screws.append((cx + sx * (w / 2 - 0.03), cy + h / 2 - 0.03, 0.020, 'slot'))
    objs.append(slab('doors', door_shapes, DOOR_TOP, paint))
    # Yağ kapağı düğmesi
    for d in LAYOUT['doors']:
        if d['kind'] == 'oil':
            objs.append(slab('oil_button', [rrect(X(d['u']), Y(d['v']), 0.056, 0.018, 0.008)],
                             -0.0025, metal, half=0.001, bevel=0.0005))

    # --- Alt kilitler: yuva içinde gömük kol ---
    handle_shapes = []
    for (ly, lh) in latches:
        handle_shapes.append(rrect(0.0, ly + 0.012, 0.052, lh - 0.05, 0.01))
    objs.append(slab('latch_handles', handle_shapes, -0.0015, metal, half=0.003, bevel=0.0008))
    trig = [rrect(0.028, ly - lh / 2 + 0.016, 0.016, 0.012, 0.004) for (ly, lh) in latches]
    objs.append(slab('latch_triggers', trig, -0.001, metal, half=0.002, bevel=0.0006))

    # --- Havalandırma panjuru ---
    for gr in LAYOUT['grilles']:
        cx, cy, w, h = X(gr['u']), Y(gr['v']), gr['w'], gr['h']
        frame = [rrect(cx, cy, w + 0.05, h + 0.05, 0.02), rrect(cx, cy, w, h, 0.012)]
        objs.append(slab('grille_frame', frame, 0.0012, paint, half=0.0015, bevel=0.0009))
        bm = bmesh.new()
        n = gr['slats']
        pitch = (h - 0.02) / n
        for i in range(n):
            y = cy - h / 2 + 0.01 + pitch * (i + 0.5)
            m = (Matrix.Translation((cx, y, -0.0045)) @ Matrix.Rotation(math.radians(-38), 4, 'X') @
                 Matrix.Diagonal(((w - 0.012) / 2, pitch * 0.62, 0.0012, 1)))
            bmesh.ops.create_cube(bm, size=2.0, matrix=m)
        obj = mesh_from_bmesh('grille_slats', bm, paint)
        bev = obj.modifiers.new('bev', 'BEVEL')
        bev.width = 0.0008
        bev.segments = 2
        objs.append(obj)
        for sx in np.arange(-w / 2 - 0.012, w / 2 + 0.02, 0.05):
            for sy in (-h / 2 - 0.0125, h / 2 + 0.0125):
                screws.append((cx + sx, cy + sy, 0.009, 'cross'))

    # --- Tapalar ---
    plug_shapes = []
    for p in LAYOUT['plugs']:
        cx, cy, r = X(p['u']), Y(p['v']), p['d'] / 2
        plug_shapes.append(circle(cx, cy, r, 48))
        if r < 0.035:
            # Boroskop tapası: altıgen baş, çevre vidası yok
            plug_shapes.append([(cx + 0.011 * math.cos(math.pi / 3 * k), cy + 0.011 * math.sin(math.pi / 3 * k))
                                for k in range(6)])
            continue
        plug_shapes.append(cross(cx, cy, 0.026, 0.006))
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            screws.append((cx + math.cos(a) * (r - 0.012), cy + math.sin(a) * (r - 0.012), 0.009, 'cross'))
    objs.append(slab('plugs', plug_shapes, DOOR_TOP, paint))

    # --- Üst menteşe takviye plakaları ---
    hinge_shapes = []
    for hy in hinges:
        cx = HALF - 0.06
        hinge_shapes.append(rrect(cx, hy, 0.09, 0.15, 0.012))
        for sx in (-0.024, 0.024):
            for sy in (-0.05, 0.0, 0.05):
                screws.append((cx + sx, hy + sy, 0.010, 'cross'))
    objs.append(slab('hinge_plates', hinge_shapes, 0.0014, paint, half=0.0012, bevel=0.0008))

    # --- Derz boyunca bağlantı elemanı sıraları (perçin ya da vida) ---
    use_screws = LAYOUT['seamFastener'] == 'screw'
    PITCH = 0.06 if use_screws else 0.04
    row = []
    OFF = g + 0.011
    def free(x, y):
        for (ly, lh) in latches:
            if x < 0.08 and abs(y - ly) < lh / 2 + 0.03:
                return False
        for hy in hinges:
            if x > HALF - 0.12 and abs(y - hy) < 0.1:
                return False
        return True

    for v in LAYOUT['ringsV']:
        for side in (-1, 1):
            y = Y(v) + side * OFF
            for x in np.arange(0.02, HALF - 0.01, PITCH):
                if free(x, y):
                    row.append((x, y))
    for ui, u in enumerate(LAYOUT['seamsU']):
        if not LAYOUT['edgeSeams'] and ui in (0, len(LAYOUT['seamsU']) - 1):
            continue
        for side in (-1, 1):
            x = X(u) + side * OFF
            if not (0 < x < HALF):
                continue
            for y in np.arange(0.02, LEN, PITCH):
                if min(abs(y - Y(v)) for v in LAYOUT['ringsV']) < 0.03:
                    continue
                if free(x, y):
                    row.append((x, y))
    if use_screws:
        screws.extend((x, y, 0.009, 'cross') for (x, y) in row)
    else:
        rivets.extend(row)

    # Yuvarlak başlı perçin: 7.5 mm çap, 1.4 mm yükseklik (küre kapağı)
    R = 0.0057
    if rivets:
        objs.append(instanced('rivets', rivets, 0.0014 - R, R, metal))

    # --- Vida başları (hafif çıkık; yarık/yıldız oyuğu delik olarak) ---
    heads = []
    for (x, y, dia, kind) in screws:
        heads.append(circle(x, y, dia / 2, 18))
        if kind == 'cross':
            heads.append(cross(x, y, dia * 0.6, dia * 0.16))
        else:
            heads.append(slot(x, y, dia * 0.7, dia * 0.14, math.radians(35)))
    objs.append(slab('screw_heads', heads, 0.0005, metal, half=0.0008, bevel=0.0004))

    print(f'perçin: {len(rivets)}, vida: {len(screws)}', flush=True)
    return [o for o in objs if o is not None]


# ---------------------------------------------------------------------------
# Pişirme
# ---------------------------------------------------------------------------

def low_plane():
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1,
                          matrix=Matrix.Translation((HALF / 2, LEN / 2, 0)) @
                          Matrix.Diagonal((HALF / 2, LEN / 2, 1, 1)))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            co = loop.vert.co
            loop[uv].uv = (co.x / HALF, co.y / LEN)
    mat = bpy.data.materials.new('LOW')
    mat.use_nodes = True
    obj = mesh_from_bmesh('low', bm, mat)
    return obj


def bake(low, highs, img, kind, samples, **kw):
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
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=0.006,
                        max_ray_distance=0.02, margin=4, use_clear=True, **kw)
    print(f'  {kind}: {time.time() - t0:.1f} s', flush=True)


def image_array(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def smooth_noise(h, w, cells, seed):
    """Düşük frekanslı değer gürültüsü (pürüzlülükte boya/aşınma bölgeleri)."""
    rng = np.random.default_rng(seed)
    g = rng.random((cells + 1, cells * 2 + 1)).astype(np.float32)
    ys = np.linspace(0, cells, h)
    xs = np.linspace(0, cells * 2, w)
    y0, x0 = np.floor(ys).astype(int).clip(0, cells - 1), np.floor(xs).astype(int).clip(0, cells * 2 - 1)
    fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]
    b = g[y0][:, x0 + 1]
    c = g[y0 + 1][:, x0]
    d = g[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def save(arr, path, w, h, quality):
    """8 bit, renk yönetimi uygulanmadan (veri dokusu) WebP olarak yazar."""
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = 'WEBP'
    img.save(filepath=path, quality=quality)
    print(f'  yazıldı {path} ({os.path.getsize(path) / 1024:.0f} KB)', flush=True)


def bake_part(part, out, scale, samples, quality):
    use_layout(part)
    w, h = (max(64, int(n * scale)) for n in LAYOUT['texture'])
    surf = LAYOUT['surface']
    print(f'== {part}: {HALF} x {LEN} m, {w} x {h} px', flush=True)

    t0 = time.time()
    reset()
    base = 'paint' if surf['paint'] else 'bare'
    mt = {
        # Boyada portakal kabuğu dalgası; çıplak metalde daha ince taşlama izi
        'paint': material(base, 0.0, bump=0.08 if surf['paint'] else 0.04),
        'metal': material('metal', 1.0),
        'dark': material('dark', 0.0),
    }
    highs = build(mt)
    low = low_plane()
    print(f'model kuruldu: {time.time() - t0:.1f} s', flush=True)

    # Doku renk uzayı: veriler doğrusal kalmalı (normal/ORM sRGB değildir)
    imgs = {}
    for k in ('normal', 'ao', 'emit'):
        imgs[k] = bpy.data.images.new(k, w, h, float_buffer=True, alpha=False)
        imgs[k].colorspace_settings.name = 'Non-Color'
    bake(low, highs, imgs['normal'], 'NORMAL', 8, normal_space='TANGENT')
    bake(low, highs, imgs['ao'], 'AO', samples)
    bake(low, highs, imgs['emit'], 'EMIT', 2)

    normal = image_array(imgs['normal'])[..., :3]
    ao = image_array(imgs['ao'])[..., 0]
    fastener = np.clip(image_array(imgs['emit'])[..., 0], 0, 1)

    # Pürüzlülük: bölgesel dalgalanma, arkaya doğru is/yağ filmiyle artış,
    # bağlantı elemanları ayrı değerde; oyuk diplerinde toz birikir
    v = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    n = smooth_noise(h, w, 6, 7) * 0.6 + smooth_noise(h, w, 24, 11) * 0.4
    body_r = surf['rough'] + surf['roughVar'] * n + surf['aftSoot'] * np.clip((v - 0.55) / 0.45, 0, 1) ** 2
    rough = body_r * (1 - fastener) + surf['fastenerRough'] * fastener + (1 - ao) * 0.25
    # Metallik: boyalı gövdede yalnız bağlantı elemanları, çıplak gövdede her yer
    metal = fastener if surf['paint'] else np.ones_like(fastener)

    os.makedirs(out, exist_ok=True)
    # Blender pikselleri alt satırdan başlar; görüntü kaydı bunu dosyada
    # yukarı-aşağı doğru sıraya çevirir (UV v = 0 alt kenar).
    save(normal, os.path.join(out, f'{part}_normal.webp'), w, h, quality)
    orm = np.stack([ao, rough, metal], axis=2).astype(np.float32)
    save(orm, os.path.join(out, f'{part}_orm.webp'), w, h, quality)
    print(f'{part} toplam: {time.time() - t0:.1f} s', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--part', default=','.join(k for k in LAYOUTS if not k.startswith('_')),
                    help='virgülle ayrılmış parça listesi')
    ap.add_argument('--out', default='src/assets')
    ap.add_argument('--scale', type=float, default=1.0, help='doku boyutu çarpanı (taslak için 0.5)')
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--quality', type=int, default=92)
    args = ap.parse_args(argv)
    for part in args.part.split(','):
        bake_part(part, args.out, args.scale, args.samples, args.quality)


if __name__ == '__main__':
    main()
