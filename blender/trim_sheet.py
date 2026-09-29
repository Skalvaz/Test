"""
Trim sheet — kit parçalarının küçük yüzey detayları için ortak doku.

1 × 1 m'lik düz bir levhanın üstüne yüksek poligonlu detay kurulur ve Cycles
ile alçak poligonlu levhaya pişirilir (panel_details.py ile aynı yöntem):

    şerit (U yönünde döşenir)       v aralığı
    kaynak dikişi (pul pul)          0.875–1.0
    tırtıl (baklava)                 0.75–0.875
    perçin sırası + bindirme derzi   0.625–0.75
    soğutma panjuru                  0.5–0.625
    etiketler (2 × 4)                0.0–0.5

Çıktılar (1024 × 1024 WebP):
    trim_albedo.webp   renk (sRGB; yalnız etiketler kullanır)
    trim_normal.webp   tanjant uzayı normal haritası (OpenGL, Y+)
    trim_orm.webp      R = ortam kapanması, G = pürüzlülük, B = 0

    /home/user/bpyenv/bin/python blender/trim_sheet.py --out src/assets
"""

import argparse
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix  # noqa: E402

from kitlib import PLACARDS, TRIM, link, placard_rect, reset, select_only  # noqa: E402

_emit = {}


def emat(name, color, rough):
    """Pişirme malzemesi: yayım rengi = albedo, 'rough' özel özellikte."""
    key = (name, color)
    if key in _emit:
        return _emit[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = 1.0
    m['rough'] = rough
    _emit[key] = m
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mesh_obj(name, verts, faces, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for p in me.polygons:
        p.use_smooth = smooth
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def ellipsoids(name, centers, radii, mat, segs=(16, 8), tilt=0.0):
    """Çok sayıda elipsoidi tek ağda (numpy ile çoğaltılmış)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    v = np.array([p.co[:] for p in bm.verts], np.float32)
    f = [[p.index for p in face.verts] for face in bm.faces]
    bm.free()
    allv, allf = [], []
    ct, st = math.cos(tilt), math.sin(tilt)
    R = np.array([[ct, 0, st], [0, 1, 0], [-st, 0, ct]], np.float32)   # Y ekseni etrafında
    for k, (c, r) in enumerate(zip(centers, radii)):
        allv.append((v * np.array(r, np.float32)) @ R.T + np.array(c, np.float32))
        allf += [[i + k * len(v) for i in face] for face in f]
    return mesh_obj(name, np.concatenate(allv).tolist(), allf, mat)


def slab(name, x0, y0, x1, y1, z0, z1, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.transform(Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @
                 Matrix.Diagonal(((x1 - x0), (y1 - y0), (z1 - z0), 1)))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES', profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    # Geniş düz yüzler düz kalsın, yalnız pah segmentleri yumuşasın
    obj.data.set_sharp_from_angle(angle=math.radians(31))
    return obj


def text(name, body, cx, cy, size, z, mat, extrude=0.0006, bold=True, align='CENTER'):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    if bold:
        cu.offset = 0.0008   # kalınlaştırma (varsayılan yazı tipi ince)
    obj = link(bpy.data.objects.new(name, cu))
    obj.location = (cx, cy, z)
    obj.data.materials.append(mat)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.view_layer.objects.active


# ---------------------------------------------------------------------------

def build():
    objs = []
    gray = emat('gray', (0.5, 0.5, 0.5), 0.45)

    # Taban levha (pişirmede görünmesin diye biraz aşağıda)
    objs.append(slab('base', -0.05, -0.05, 1.05, 1.05, -0.02, 0.0, gray))

    # --- Kaynak dikişi: üst üste binen pullar + taban dikiş ---
    v0, v1 = TRIM['weld']
    vm = (v0 + v1) / 2
    weld = emat('weld', (0.5, 0.48, 0.46), 0.62)
    # "Üst üste dizilmiş madeni paralar": her pul yarıçapının üçte biri kadar
    # ilerler, görünen kısım hilal biçimli sırtlardır
    n = 60
    cs, rs = [], []
    for i in range(-3, n + 3):
        cs.append((i / n, vm, -0.006))
        rs.append((0.05, 0.05, 0.02))
    # öne eğik pullar: komşu pulların kesişimi eğrilir → hilal sırtlar
    objs.append(ellipsoids('weld_ripples', cs, rs, weld, segs=(40, 16), tilt=math.radians(28)))
    # dikiş kenarında ısıdan etkilenmiş hafif sırt
    objs.append(slab('weld_edge_a', -0.05, v0 + 0.004, 1.05, v0 + 0.012, -0.002, 0.002, weld, bevel=0.002))
    objs.append(slab('weld_edge_b', -0.05, v1 - 0.012, 1.05, v1 - 0.004, -0.002, 0.002, weld, bevel=0.002))

    # --- Tırtıl: 45° kare piramitler ---
    v0, v1 = TRIM['knurl']
    knurl = emat('knurl', (0.6, 0.6, 0.62), 0.32)
    p = 1 / 40
    h = p * 0.32
    verts, faces = [], []
    for i in range(-1, 41):
        for j in range(int((v1 - v0) / p) + 2):
            for off in (0, 0.5):
                cx = (i + off) * p
                cy = v0 + (j + off) * p
                if cy < v0 + p * 0.5 or cy > v1 - p * 0.5:
                    continue
                b = len(verts)
                s = p * 0.5
                verts += [(cx - s, cy, 0), (cx, cy - s, 0), (cx + s, cy, 0), (cx, cy + s, 0), (cx, cy, h)]
                faces += [[b, b + 1, b + 4], [b + 1, b + 2, b + 4], [b + 2, b + 3, b + 4], [b + 3, b, b + 4]]
    objs.append(mesh_obj('knurl', verts, faces, knurl, smooth=False))
    # şerit kenarları (tırtıl bandının pahlı sınırı)
    objs.append(slab('knurl_edge_a', -0.05, v0 - 0.004, 1.05, v0 + 0.004, -0.004, 0.001, knurl, bevel=0.002))
    objs.append(slab('knurl_edge_b', -0.05, v1 - 0.004, 1.05, v1 + 0.004, -0.004, 0.001, knurl, bevel=0.002))

    # --- Perçin sırası ve bindirme derzi ---
    v0, v1 = TRIM['rivet']
    paint = emat('paint', (0.5, 0.5, 0.5), 0.5)
    rivet = emat('rivet', (0.55, 0.55, 0.55), 0.4)
    objs.append(slab('lap', -0.05, v0 - 0.01, 1.05, v0 + 0.085, 0.0, 0.003, paint, bevel=0.0025))
    n = 12
    objs.append(ellipsoids('rivets', [((i + 0.5) / n, v0 + 0.05, 0.003) for i in range(-1, n + 1)],
                           [(0.011, 0.011, 0.0045)] * (n + 2), rivet, segs=(24, 12)))
    # vida sırası (yıldız başlı) bindirmenin üstünde
    for i in range(-1, n + 1):
        cx = (i + 0.5) / n
        objs.append(ellipsoids(f'screw{i}', [(cx, v1 - 0.022, 0.0)], [(0.009, 0.009, 0.0025)], rivet, segs=(20, 8)))
        objs.append(slab(f'x{i}a', cx - 0.006, v1 - 0.0235, cx + 0.006, v1 - 0.0205, 0.0014, 0.0036, emat('dark', (0.1, 0.1, 0.1), 0.6)))
        objs.append(slab(f'x{i}b', cx - 0.0015, v1 - 0.0285, cx + 0.0015, v1 - 0.0155, 0.0014, 0.0036, emat('dark', (0.1, 0.1, 0.1), 0.6)))

    # --- Soğutma panjuru: eğik kaputlu yarıklar ---
    v0, v1 = TRIM['louver']
    n = 10
    for i in range(-1, n + 1):
        cx = (i + 0.5) / n
        objs.append(slab(f'louv{i}', cx - 0.01, v0 + 0.02, cx + 0.03, v1 - 0.02, -0.006, 0.006, gray, bevel=0.004))
        # yarık: kaputun gölgesindeki koyu boşluk (kaput yüzeyinden gömük)
        objs.append(slab(f'slot{i}', cx - 0.026, v0 + 0.03, cx - 0.01, v1 - 0.03, -0.004, 0.001,
                         emat('dark', (0.06, 0.06, 0.06), 0.7), bevel=0.001))

    # --- Etiketler ---
    spec = {
        'FUEL': ('#b0201a', '#ffffff', 'FUEL', 'JET A-1'),
        'OIL': ('#d9a21b', '#141414', 'OIL', 'MIL-PRF-23699'),
        'HYD': ('#2356a8', '#ffffff', 'HYDRAULIC', '3000 PSI'),
        'DANGER': ('#f2c200', '#111111', 'DANGER', 'HIGH VOLTAGE'),
        'FADEC': ('#b9bdc0', '#161616', 'EEC  FADEC', 'P/N 2045-771  S/N T6021'),
        'NOSTEP': ('#e9e9e4', '#111111', 'NO STEP', ''),
        'LIFT': ('#f2c200', '#111111', 'LIFT POINT', 'MAX 450 KG'),
        'FLOW': ('#1f7a3a', '#ffffff', 'FLOW  →', ''),
    }
    for row in PLACARDS:
        for key in row:
            u0, pv0, u1, pv1 = placard_rect(key)
            bg, fg, t1, t2 = spec[key]
            m_bg = emat(f'bg_{key}', srgb(bg), 0.42)
            m_fg = emat(f'fg_{key}', srgb(fg), 0.55)
            ins = 0.012
            objs.append(slab(f'pl_{key}', u0 + ins, pv0 + ins, u1 - ins, pv1 - ins, 0.0, 0.0025, m_bg, bevel=0.003))
            # ince çerçeve
            f = 0.006
            for (a, b, c, d) in ((u0 + ins + f, pv0 + ins + f, u1 - ins - f, pv0 + ins + f + 0.003),
                                 (u0 + ins + f, pv1 - ins - f - 0.003, u1 - ins - f, pv1 - ins - f),
                                 (u0 + ins + f, pv0 + ins + f, u0 + ins + f + 0.003, pv1 - ins - f),
                                 (u1 - ins - f - 0.003, pv0 + ins + f, u1 - ins - f, pv1 - ins - f)):
                objs.append(slab(f'fr_{key}_{a:.3f}{b:.3f}', a, b, c, d, 0.0025, 0.0033, m_fg))
            cx = (u0 + u1) / 2
            if key == 'DANGER':
                # sarı-siyah uyarı çizgileri (sol şerit) + şimşek işareti yerine ünlem
                for k in range(5):
                    x = u0 + ins + 0.02 + k * 0.016
                    objs.append(slab(f'hz{k}', x, pv0 + ins + 0.012, x + 0.008, pv1 - ins - 0.012, 0.0025, 0.0032, m_fg))
                cx += 0.04
            if key == 'FADEC':
                objs.append(ellipsoids(f'rv_{key}', [(u0 + ins + 0.016, pv0 + ins + 0.016, 0.0025), (u1 - ins - 0.016, pv0 + ins + 0.016, 0.0025),
                                                     (u0 + ins + 0.016, pv1 - ins - 0.016, 0.0025), (u1 - ins - 0.016, pv1 - ins - 0.016, 0.0025)],
                                       [(0.006, 0.006, 0.0025)] * 4, emat('rivet', (0.55, 0.55, 0.55), 0.4)))
            if t2:
                objs.append(text(f't1_{key}', t1, cx, pv0 + 0.078, 0.036 if len(t1) < 12 else 0.028, 0.0025, m_fg))
                objs.append(text(f't2_{key}', t2, cx, pv0 + 0.036, 0.02, 0.0025, m_fg, bold=False))
            else:
                objs.append(text(f't1_{key}', t1, cx, (pv0 + pv1) / 2, 0.046, 0.0025, m_fg))
    return objs


def low_plane():
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5,
                          matrix=Matrix.Translation((0.5, 0.5, 0)))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x, loop.vert.co.y)
    m = bpy.data.materials.new('LOW')
    m.use_nodes = True
    me = bpy.data.meshes.new('low')
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new('low', me))
    obj.location.z = 0.03
    obj.data.materials.append(m)
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
    bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=0.0,
                        max_ray_distance=0.08, margin=2, use_clear=True, **kw)
    print(f'  {kind}: {time.time() - t0:.1f} s', flush=True)


def arr(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def save(a, path, w, h, quality, color=False):
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    rgba = np.concatenate([a, np.ones((h, w, 1), np.float32)], axis=2)
    if color:
        # doğrusal → sRGB (8 bit görüntü sRGB olarak saklanır)
        c = np.clip(rgba[..., :3], 0, 1)
        rgba[..., :3] = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = 'WEBP'
    img.save(filepath=path, quality=quality)
    print(f'  yazıldı {path} ({os.path.getsize(path) / 1024:.0f} KB)', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='src/assets')
    ap.add_argument('--size', type=int, default=1024)
    ap.add_argument('--samples', type=int, default=32)
    ap.add_argument('--quality', type=int, default=90)
    args = ap.parse_args(argv)
    t0 = time.time()
    reset()
    bpy.context.scene.world.light_settings.distance = 0.02
    highs = build()
    low = low_plane()
    print(f'model: {len(highs)} nesne, {time.time() - t0:.1f} s', flush=True)
    S = args.size
    imgs = {k: bpy.data.images.new(k, S, S, float_buffer=True, alpha=False) for k in ('normal', 'ao', 'emit', 'rough')}
    for im in imgs.values():
        im.colorspace_settings.name = 'Non-Color'
    bake(low, highs, imgs['normal'], 'NORMAL', 4, normal_space='TANGENT')
    bake(low, highs, imgs['ao'], 'AO', args.samples)
    bake(low, highs, imgs['emit'], 'EMIT', 2)
    # Pürüzlülük: yayımı malzemenin 'rough' değeriyle değiştirip yeniden pişir
    for m in bpy.data.materials:
        if 'rough' in m.keys():
            b = m.node_tree.nodes['Principled BSDF']
            r = float(m['rough'])
            b.inputs['Emission Color'].default_value = (r, r, r, 1)
    bake(low, highs, imgs['rough'], 'EMIT', 2)

    normal = arr(imgs['normal'])[..., :3]
    ao = arr(imgs['ao'])[..., 0]
    albedo = arr(imgs['emit'])[..., :3]
    rough = arr(imgs['rough'])[..., 0]
    # oyuk diplerinde kir: pürüzlülük artar, albedo koyulaşır
    rough = np.clip(rough + (1 - ao) * 0.25, 0, 1)
    albedo = albedo * (0.55 + 0.45 * ao[..., None])
    os.makedirs(args.out, exist_ok=True)
    save(albedo, os.path.join(args.out, 'trim_albedo.webp'), S, S, args.quality, color=True)
    save(normal, os.path.join(args.out, 'trim_normal.webp'), S, S, args.quality)
    orm = np.stack([ao, rough, np.zeros_like(ao)], axis=2)
    save(orm, os.path.join(args.out, 'trim_orm.webp'), S, S, args.quality)
    print(f'toplam {time.time() - t0:.1f} s', flush=True)


if __name__ == '__main__':
    main()
