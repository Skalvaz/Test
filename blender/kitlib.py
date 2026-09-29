"""
Kit betikleri için ortak yardımcılar: sahne sıfırlama, three.js koordinatlarında
ilkel geometri (silindir, lathe, torus, pahlı kutu, boru süpürme, levha),
UV eşlemesi ve trim sheet düzeni.

Koordinatlar: bütün geometri **three.js eksenlerinde** kurulur (Y yukarı; kit
parçalarında Y = motor yüzeyinden dışarı, Z = motor ekseni boyunca). Dışa
aktarmadan önce Blender eksenlerine çevrilir (C matrisi); glTF dışa aktarıcısı
Y-yukarıya geri çevirdiğinde oyundaki eksenler birebir korunur.

UV'ler Blender kuralındadır (v = 0 alt kenar); glTF dışa aktarıcısı v'yi
çevirir, oyunda dokular flipY = false ile yüklenir.
"""

import math

import bpy  # noqa: I001
import bmesh
from mathutils import Matrix, Vector

# three (x, y, z) → Blender (x, −z, y)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

# Döşenen malzeme dokuları için UV ölçeği: 1 UV birimi = UVS metre
UVS = 0.15

# ---------------------------------------------------------------------------
# Trim sheet düzeni (1024 × 1024; Blender v ekseni aşağıdan yukarı).
# Şeritler U yönünde döşenir; V şerit içinde kalır.
# ---------------------------------------------------------------------------
TRIM = {
    'weld': (0.875, 1.0),     # kaynak dikişi (pul pul üst üste binen)
    'knurl': (0.75, 0.875),   # tırtıl (baklava deseni)
    'rivet': (0.625, 0.75),   # perçin ve vida sırası
    'louver': (0.5, 0.625),   # soğutma yarıkları
}
# Etiketler: alt yarı, 2 sütun × 4 satır (her biri 512 × 128 px)
PLACARDS = [
    ['FUEL', 'OIL'],
    ['HYD', 'DANGER'],
    ['FADEC', 'NOSTEP'],
    ['LIFT', 'FLOW'],
]


def placard_rect(key):
    for row, names in enumerate(PLACARDS):
        if key in names:
            col = names.index(key)
            v1 = 0.5 - row * 0.125
            return (col * 0.5, v1 - 0.125, col * 0.5 + 0.5, v1)
    raise KeyError(key)


# ---------------------------------------------------------------------------
# Sahne
# ---------------------------------------------------------------------------

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.light_settings.distance = 0.03
    scn.world = world
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.use_denoising = False
    return scn


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def select_only(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


# ---------------------------------------------------------------------------
# Malzeme yuvaları: oyunda ada göre gerçek malzemelerle değiştirilir; burada
# yalnız önizleme rengi taşırlar.
# ---------------------------------------------------------------------------
SLOT_COLORS = {
    'cast': (0.55, 0.56, 0.55),      # döküm alüminyum/magnezyum muhafaza
    'steel': (0.62, 0.62, 0.64),     # işlenmiş çelik: somun, cıvata, rakor
    'ss': (0.7, 0.7, 0.72),          # paslanmaz boru ve bant
    'anodized': (0.17, 0.37, 0.62),  # mavi eloksallı kapaklar
    'gold': (0.72, 0.55, 0.22),      # altın eloksal / kadmiyum kaplama
    'iridite': (0.55, 0.5, 0.3),     # kromat dönüşüm kaplamalı döküm (altın-zeytin)
    'paint': (0.24, 0.26, 0.24),     # boyalı kutular
    'rubber': (0.03, 0.03, 0.03),
    'glass': (0.3, 0.35, 0.3),
    'tank': (0.5, 0.5, 0.48),
    'red': (0.7, 0.05, 0.03),        # ΔP göstergesi, uyarı düğmeleri
    'yellow': (0.85, 0.65, 0.05),    # kaldırma noktası boyası
    'weld': (0.5, 0.48, 0.46),       # trim: kaynak dikişi
    'knurl': (0.6, 0.6, 0.62),       # trim: tırtıl
    'rivet': (0.24, 0.26, 0.24),     # trim: perçin sırası (boyalı yüzeyde)
    'louver': (0.24, 0.26, 0.24),    # trim: soğutma yarıkları
    'placard': (1.0, 1.0, 1.0),      # trim: etiket (renk dokudan)
}
_mats = {}


def mat(slot):
    if slot not in _mats or _mats[slot].name not in bpy.data.materials:
        m = bpy.data.materials.new(slot)
        m.use_nodes = True
        c = SLOT_COLORS[slot]
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*c, 1)
        _mats[slot] = m
    return _mats[slot]


def clear_mats():
    _mats.clear()


# ---------------------------------------------------------------------------
# İlkel geometri (three koordinatları)
# ---------------------------------------------------------------------------

def _axis_matrix(axis):
    """Yerel +Z eksenini istenen eksene çeviren dönüş."""
    if axis == 'y':
        return Matrix.Rotation(-math.pi / 2, 4, 'X')
    if axis == 'x':
        return Matrix.Rotation(math.pi / 2, 4, 'Y')
    if axis == '-z':
        return Matrix.Rotation(math.pi, 4, 'X')
    if axis == '-y':
        return Matrix.Rotation(math.pi / 2, 4, 'X')
    return Matrix.Identity(4)


def _obj_from_bm(bm, slot, name='prim'):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat(slot))
    return obj


def uv_box(obj, scale=UVS):
    """Yüz normaline göre üç düzlemli izdüşüm (döşenen malzeme dokuları için)."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if ax == 0:
                u, v = co.z * (1 if n.x > 0 else -1), co.y
            elif ax == 1:
                u, v = co.x, co.z * (1 if n.y > 0 else -1)
            else:
                u, v = co.x * (1 if n.z > 0 else -1), co.y
            uv.data[li].uv = (u / scale, v / scale)


def lathe(profile, segs, slot, axis='y', at=(0, 0, 0), rot=None, a0=0.0, a1=2 * math.pi,
          strip=None, ulen=0.05, smooth=True, phase=0.0):
    """Profil [(r, h), …] eksen etrafında döndürülür. r = 0 uçları kutba iner.
    strip=(v0, v1): trim şeridi (u = yay uzunluğu / ulen); yoksa kutu UV."""
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    n = segs if full else segs + 1
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for r, h in profile:
        ring = []
        for i in range(n):
            a = a0 + (a1 - a0) * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), h)))
        rings.append(ring)
    # profil boyunca birikimli uzunluk (UV v)
    acc = [0.0]
    for k in range(1, len(profile)):
        (r0, h0), (r1, h1) = profile[k - 1], profile[k]
        acc.append(acc[-1] + math.hypot(r1 - r0, h1 - h0))
    total = max(acc[-1], 1e-9)
    for k in range(len(profile) - 1):
        for i in range(segs):
            j = (i + 1) % n if full else i + 1
            quad = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
            # kutupta dejenere kenarları at
            uniq = []
            for v in quad:
                if all((v.co - u.co).length > 1e-9 for u in uniq):
                    uniq.append(v)
            if len(uniq) < 3:
                continue
            try:
                f = bm.faces.new(uniq)
            except ValueError:
                continue
            f.smooth = smooth
            for loop in f.loops:
                # hangi halka/indeks?
                v = loop.vert
                kk = k if v in rings[k] else k + 1
                ii = rings[kk].index(v)
                r = profile[kk][0]
                ang = (a1 - a0) * ii / segs
                if strip:
                    vv = strip[0] + (strip[1] - strip[0]) * acc[kk] / total
                    loop[uvl].uv = (ang * max(r, 1e-4) / ulen, vv)
                else:
                    loop[uvl].uv = (ang * max(r, 1e-4) / UVS, acc[kk] / UVS)
            # dikiş: son yüzde u'yu 2π'ye taşı
            if full and j == 0:
                for loop in f.loops:
                    if loop.vert in [rings[k][0], rings[k + 1][0]]:
                        r = profile[k if loop.vert is rings[k][0] else k + 1][0]
                        u = (a1 - a0) * max(r, 1e-4) / (ulen if strip else UVS)
                        loop[uvl].uv = (u, loop[uvl].uv[1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    m = Matrix.Translation(at) @ (rot or Matrix.Identity(4)) @ _axis_matrix(axis) @ Matrix.Rotation(phase, 4, 'Z')
    bm.transform(m)
    bm.normal_update()
    obj = _obj_from_bm(bm, slot)
    return obj


def cyl(r0, r1, h, segs, slot, axis='y', at=(0, 0, 0), base=0.0, rot=None, caps=True, phase=0.0):
    """Kesik koni; `base` yerel eksende alt yüzün konumu (0 → yüzeye oturur)."""
    prof = []
    if caps:
        prof.append((0, base))
    prof += [(r0, base), (r0, base), (r1, base + h), (r1, base + h)]
    if caps:
        prof.append((0, base + h))
    # köşelerde sert kenar için tekrar eden noktalar; lathe yüzleri düzgün kalır
    prof = _dedupe(prof)
    return lathe(prof, segs, slot, axis=axis, at=at, rot=rot, phase=phase)


def _dedupe(prof):
    out = []
    for p in prof:
        if not out or abs(out[-1][0] - p[0]) > 1e-9 or abs(out[-1][1] - p[1]) > 1e-9:
            out.append(p)
    return out


def hexp(af, h, slot, axis='y', at=(0, 0, 0), base=0.0, rot=None):
    """Altıgen prizma (somun/cıvata başı); af = anahtar ağzı."""
    r = af / math.sqrt(3)
    return cyl(r, r, h, 6, slot, axis=axis, at=at, base=base, rot=rot, phase=math.pi / 6)


def torus(R, r, segsR, segsr, slot, axis='z', at=(0, 0, 0), rot=None, a0=0.0, a1=2 * math.pi, strip=None, ulen=0.05):
    prof = [(R + r * math.cos(2 * math.pi * k / segsr), r * math.sin(2 * math.pi * k / segsr)) for k in range(segsr + 1)]
    return lathe(prof, segsR, slot, axis=axis, at=at, rot=rot, a0=a0, a1=a1, strip=strip, ulen=ulen)


def cbox(size, slot, at=(0, 0, 0), chamfer=0.0, rot=None):
    """Pahlı kutu (köşe noktalarının dışbükey zarfı)."""
    sx, sy, sz = (s / 2 for s in size)
    c = min(chamfer, sx * 0.9, sy * 0.9, sz * 0.9)
    pts = set()
    for x in (-1, 1):
        for y in (-1, 1):
            for z in (-1, 1):
                if c > 0:
                    pts.add((x * (sx - c), y * sy, z * (sz - c)))
                    pts.add((x * sx, y * (sy - c), z * (sz - c)))
                    pts.add((x * (sx - c), y * (sy - c), z * sz))
                else:
                    pts.add((x * sx, y * sy, z * sz))
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    m = Matrix.Translation(at) @ (rot or Matrix.Identity(4))
    bm.transform(m)
    bm.normal_update()
    for f in bm.faces:
        f.smooth = False
    obj = _obj_from_bm(bm, slot)
    uv_box(obj)
    return obj


def hull(points, slot, at=(0, 0, 0), rot=None, smooth=False):
    bm = bmesh.new()
    for p in points:
        bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
    bm.transform(Matrix.Translation(at) @ (rot or Matrix.Identity(4)))
    bm.normal_update()
    for f in bm.faces:
        f.smooth = smooth
    obj = _obj_from_bm(bm, slot)
    uv_box(obj)
    return obj


def sweep(points, radius, segs, slot, caps=True):
    """Nokta dizisi boyunca boru (paralel taşımalı çerçeve)."""
    pts = [Vector(p) for p in points]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    t0 = (pts[1] - pts[0]).normalized()
    ref = Vector((0, 1, 0)) if abs(t0.y) < 0.9 else Vector((1, 0, 0))
    nrm = t0.cross(ref).normalized()
    rings = []
    acc = 0.0
    accs = []
    for k, p in enumerate(pts):
        if k == 0:
            t = t0
        elif k == len(pts) - 1:
            t = (pts[k] - pts[k - 1]).normalized()
        else:
            t = (pts[k + 1] - pts[k - 1]).normalized()
        # paralel taşıma
        nrm = (nrm - t * nrm.dot(t)).normalized()
        bin_ = t.cross(nrm)
        if k:
            acc += (pts[k] - pts[k - 1]).length
        accs.append(acc)
        ring = [bm.verts.new(p + (nrm * math.cos(2 * math.pi * i / segs) + bin_ * math.sin(2 * math.pi * i / segs)) * radius)
                for i in range(segs)]
        rings.append(ring)
    for k in range(len(pts) - 1):
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
            f.smooth = True
            for loop, (kk, ii) in zip(f.loops, [(k, i), (k, i + 1), (k + 1, i + 1), (k + 1, i)]):
                loop[uvl].uv = (ii * 2 * math.pi * radius / segs / UVS, accs[kk] / UVS)
    if caps:
        for ring in (rings[0], rings[-1]):
            f = bm.faces.new(ring if ring is rings[-1] else list(reversed(ring)))
            f.smooth = False
    bm.normal_update()
    return _obj_from_bm(bm, slot)


def plate(w, d, rect, at=(0, 0, 0), rot=None, lift=0.0004, slot='placard'):
    """Etiket: yüzeye yapışık ince dörtgen, UV trim sheet dikdörtgeninde.
    Yerel düzlem XZ, normal +Y."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    u0, v0, u1, v1 = rect
    vs = [bm.verts.new((x * w / 2, lift, z * d / 2)) for x, z in ((-1, 1), (1, 1), (1, -1), (-1, -1))]
    f = bm.faces.new(vs)
    for loop, uv in zip(f.loops, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
        loop[uvl].uv = uv
    bm.transform(Matrix.Translation(at) @ (rot or Matrix.Identity(4)))
    bm.normal_update()
    if f.normal.y < 0 and rot is None:
        f.normal_flip()
    return _obj_from_bm(bm, slot)


def strip_quad(w, d, strip, ulen, at=(0, 0, 0), rot=None, lift=0.0004, slot='rivet'):
    """Trim şeridinden döşenen düz şerit (perçin sırası, panjur)."""
    return plate(w, d, (0, strip[0], w / ulen, strip[1]), at=at, rot=rot, lift=lift, slot=slot)


def rot(axis, ang):
    return Matrix.Rotation(ang, 4, axis.upper())


# ---------------------------------------------------------------------------
# Parça birleştirme
# ---------------------------------------------------------------------------

def join(objs, name):
    objs = [o for o in objs if o is not None]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.data.name = name
    # three → Blender eksenleri
    obj.data.transform(C)
    obj.data.set_sharp_from_angle(angle=math.radians(38))
    obj.data.update()
    return obj


def tri_count(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)
