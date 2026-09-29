"""
Bitki impostor atlası: Poly Haven ağaç, çalı ve çim modellerinden (CC0)
yandan ortografik renderlarla billboard dokuları pişirir.

Uzaktaki ağaçlar oyunda kameraya dönen tek bir dörtgendir (core/vegetation.ts).
Dörtgen düz görünmesin diye iki doku pişirilir:
    veg_color   albedo × ortam kapanması (taç içi koyulaşır), alfa = kapsama
    veg_normal  teğet uzayı normal (x = sağ, y = yukarı, z = kameraya):
                güneş tacın bir yanını aydınlatır, öbür yanı gölgede kalır
Çim öbekleri tek tek tutamlardan rastgele dizilerek oluşturulur (çayır parçası).

Kaynak modeller scripts/fetch-assets.mjs -- vegetation ile build/dl/models
altına indirilir. Çıktı: build/impostors/*.png + meta.json → sharp ile WebP.

    /home/user/bpyenv/bin/python blender/impostors.py
"""

import glob
import json
import math
import os
import random
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

TILE = 512
COLS = 4
OUT = 'build/impostors'

# (ad, model, nesne adı öneki ya da None, dikey eksen etrafında dönüş, tür)
TILES = [
    ('olive_a', 'island_tree_01', None, 0, 'tree'),
    ('olive_b', 'island_tree_02', None, 0, 'tree'),
    ('broad_a', 'jacaranda_tree', None, 0, 'tree'),
    ('broad_b', 'jacaranda_tree', None, 90, 'tree'),
    ('young', 'tree_small_02', None, 0, 'tree'),
    ('fir_a', 'fir_tree_01', 'fir_tree_01_a', 0, 'conifer'),
    ('fir_c', 'fir_tree_01', 'fir_tree_01_c', 0, 'conifer'),
    ('pine_b', 'pine_tree_01', 'pine_tree_01_b', 0, 'conifer'),
    ('shrub_a', 'shrub_02', 'shrub_02_a', 0, 'shrub'),
    ('shrub_c', 'shrub_02', 'shrub_02_c', 0, 'shrub'),
    ('shrub_bc', 'shrub_02', ('shrub_02_b', 'shrub_02_d'), 0, 'shrub'),
    ('shrub_ac', 'shrub_02', ('shrub_02_a', 'shrub_02_c'), 45, 'shrub'),
    # Çayır parçaları: tutamlardan rastgele dizilir (tohum, genişlik m, yoğunluk)
    ('meadow_a', 'grass_medium_02', ('patch', 11, 2.4, 70), 0, 'grass'),
    ('meadow_b', 'grass_medium_02', ('patch', 23, 2.4, 45), 0, 'grass'),
    ('meadow_c', 'grass_medium_02', ('patch', 37, 1.6, 40), 0, 'grass'),
    ('meadow_d', 'grass_medium_02', ('patch', 53, 3.0, 110), 0, 'grass'),
]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = 48
    scn.cycles.use_denoising = False
    scn.cycles.max_bounces = 2
    scn.render.film_transparent = True
    scn.render.resolution_x = scn.render.resolution_y = TILE
    scn.render.image_settings.file_format = 'OPEN_EXR'
    scn.render.image_settings.color_depth = '32'
    scn.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w')
    scn.world = w
    w.color = (0, 0, 0)
    return scn


def import_model(model):
    f = glob.glob(f'build/dl/models/{model}/*.gltf')[0]
    bpy.ops.import_scene.gltf(filepath=f)
    return [o for o in bpy.data.objects if o.type == 'MESH']


def pick(objs, sel, rng_seed=None):
    if sel is None:
        # En ayrıntılı LOD'u al (LOD0), diğerlerini sil
        keep = [o for o in objs if 'LOD' not in o.name or o.name.endswith('LOD0')]
    elif isinstance(sel, str):
        keep = [o for o in objs if o.name.startswith(sel)]
    elif sel[0] == 'patch':
        return make_patch(objs, *sel[1:])
    else:
        keep = [o for o in objs if any(o.name.startswith(s) for s in sel)]
        # yan yana diz
        x = 0.0
        for o in keep:
            o.location = (x, 0, 0)
            x += o.dimensions.x * 0.55
    for o in objs:
        if o not in keep:
            bpy.data.objects.remove(o)
    return keep


def make_patch(objs, seed, width, count):
    """Tutamları rastgele konum/ölçek/dönüşle çoğaltıp bir çayır parçası yapar."""
    rnd = random.Random(seed)
    out = []
    for i in range(count):
        src = rnd.choice(objs)
        o = src.copy()
        bpy.context.scene.collection.objects.link(o)
        x = (rnd.random() - 0.5) * width
        y = (rnd.random() - 0.5) * 0.9
        # Kenarlarda seyrek ve alçak: öbek siluet olarak yumuşak biter
        edge = 1 - (abs(x) / (width / 2)) ** 2
        s = (1.6 + rnd.random() * 1.6) * (0.55 + 0.45 * edge)
        o.location = (x, y, 0)
        o.rotation_euler = (0, 0, rnd.random() * math.tau)
        o.scale = (s, s, s * (0.8 + rnd.random() * 0.5))
        out.append(o)
    for o in objs:
        bpy.data.objects.remove(o)
    return out


def bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector([min(p[k] for p in pts) for k in range(3)])
    mx = Vector([max(p[k] for p in pts) for k in range(3)])
    return mn, mx


def set_materials(objs, mode):
    """mode 'color': albedo × AO yayımı; 'normal': dünya normali yayımı."""
    done = {}
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if m is None:
                continue
            key = (m.name, mode)
            if key in done:
                slot.material = done[key]
                continue
            src = m.get('_orig') and bpy.data.materials.get(m['_orig']) or m
            nm = src.copy()
            nm.name = f'{src.name}__{mode}'
            nm['_orig'] = src.name
            nt = nm.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
            base_link = bsdf and next((l for l in nt.links if l.to_socket == bsdf.inputs['Base Color']), None)
            alpha_link = bsdf and next((l for l in nt.links if l.to_socket == bsdf.inputs['Alpha']), None)
            emit = nt.nodes.new('ShaderNodeEmission')
            if mode == 'color':
                ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
                ao.inputs['Distance'].default_value = 0.8
                ao.samples = 8
                if base_link:
                    nt.links.new(base_link.from_socket, ao.inputs['Color'])
                else:
                    ao.inputs['Color'].default_value = bsdf.inputs['Base Color'].default_value if bsdf else (0.3, 0.3, 0.3, 1)
                # AO'yu yumuşat: tamamen kararmasın (gökyüzü ışığı tacın içine de sızar)
                mix = nt.nodes.new('ShaderNodeMix')
                mix.data_type = 'RGBA'
                mix.inputs['Factor'].default_value = 0.35
                nt.links.new(ao.outputs['Color'], mix.inputs['A'])
                if base_link:
                    nt.links.new(base_link.from_socket, mix.inputs['B'])
                else:
                    mix.inputs['B'].default_value = ao.inputs['Color'].default_value
                nt.links.new(mix.outputs['Result'], emit.inputs['Color'])
            else:
                geo = nt.nodes.new('ShaderNodeNewGeometry')
                vm = nt.nodes.new('ShaderNodeVectorMath')
                vm.operation = 'MULTIPLY_ADD'
                vm.inputs[1].default_value = (0.5, 0.5, 0.5)
                vm.inputs[2].default_value = (0.5, 0.5, 0.5)
                nt.links.new(geo.outputs['Normal'], vm.inputs[0])
                nt.links.new(vm.outputs['Vector'], emit.inputs['Color'])
            shader = emit.outputs['Emission']
            if alpha_link:
                tr = nt.nodes.new('ShaderNodeBsdfTransparent')
                ms = nt.nodes.new('ShaderNodeMixShader')
                nt.links.new(alpha_link.from_socket, ms.inputs['Fac'])
                nt.links.new(tr.outputs['BSDF'], ms.inputs[1])
                nt.links.new(shader, ms.inputs[2])
                shader = ms.outputs['Shader']
            nt.links.new(shader, out.inputs['Surface'])
            done[key] = nm
            slot.material = nm


def render(path):
    scn = bpy.context.scene
    scn.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(os.path.abspath(path))
    a = np.array(img.pixels[:], dtype=np.float32).reshape(TILE, TILE, 4)[::-1]
    bpy.data.images.remove(img)
    return a


def unpremul(rgba):
    a = rgba[..., 3:4]
    rgb = np.where(a > 1e-4, rgba[..., :3] / np.maximum(a, 1e-4), 0)
    return np.concatenate([rgb, a], axis=-1)


def dilate(rgb, alpha, iters=24):
    """Saydam piksellere en yakın opak rengi yay (mip haritalarında koyu hale olmasın)."""
    rgb = rgb.copy()
    known = alpha > 0.02
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(known.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            cnt += k
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
        if known.all():
            break
    rgb[~known] = rgb[known].mean(axis=0)
    return rgb


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def main():
    os.makedirs(OUT, exist_ok=True)
    rows = math.ceil(len(TILES) / COLS)
    color = np.zeros((rows * TILE, COLS * TILE, 4), np.float32)
    normal = np.zeros((rows * TILE, COLS * TILE, 4), np.float32)
    meta = []
    for i, (name, model, sel, rot, kind) in enumerate(TILES):
        t0 = time.time()
        scn = reset()
        objs = pick(import_model(model), sel)
        # Dönüş: dünya Z ekseni etrafında (glTF içe aktarımı kuaterniyon kullanır)
        if rot:
            R = Matrix.Rotation(math.radians(rot), 4, 'Z')
            bpy.context.view_layer.update()
            for o in objs:
                if o.parent is None or o.parent not in objs:
                    o.matrix_world = R @ o.matrix_world
        mn, mx = bounds(objs)
        w, h = mx.x - mn.x, mx.z - mn.z
        span = max(w, h) * 1.02
        cam_d = bpy.data.cameras.new('c')
        cam_d.type = 'ORTHO'
        cam_d.ortho_scale = span
        cam = bpy.data.objects.new('c', cam_d)
        scn.collection.objects.link(cam)
        cx, cz = (mn.x + mx.x) / 2, (mn.z + mx.z) / 2
        cam.location = (cx, mn.y - 50, cz)
        cam.rotation_euler = (math.pi / 2, 0, 0)
        cam_d.clip_end = 200
        scn.camera = cam
        set_materials(objs, 'color')
        c = unpremul(render(f'{OUT}/_c.exr'))
        set_materials(objs, 'normal')
        n = unpremul(render(f'{OUT}/_n.exr'))
        # Kamera +Y'ye bakar: sağ = +X, yukarı = +Z, kameraya = −Y
        wn = n[..., :3] * 2 - 1
        tn = np.stack([wn[..., 0], wn[..., 2], -wn[..., 1]], axis=-1)
        # Arkaya bakan yüzler (yaprak kartlarının arkası): kameraya çevir
        tn[..., 2] = np.abs(tn[..., 2])
        tn /= np.maximum(np.linalg.norm(tn, axis=-1, keepdims=True), 1e-4)
        alpha = c[..., 3]
        crgb = dilate(c[..., :3], alpha)
        nrgb = dilate(tn * 0.5 + 0.5, alpha)
        r, col = divmod(i, COLS)
        sl = (slice(r * TILE, (r + 1) * TILE), slice(col * TILE, (col + 1) * TILE))
        color[sl] = np.concatenate([srgb(crgb), alpha[..., None]], axis=-1)
        normal[sl] = np.concatenate([nrgb, np.ones_like(alpha)[..., None]], axis=-1)
        # Sıkı sınır kutusu (piksel) ve metre karşılığı
        ys, xs = np.nonzero(alpha > 0.05)
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
        mpp = span / TILE
        # Dörtgen yerel koordinatları: x kütük eksenine, y zemine göre (m)
        ground_row = TILE / 2 + (cz - mn.z) / mpp
        meta.append({
            'name': name, 'kind': kind, 'tile': [col, r],
            'px': [x0, y0, x1, y1],
            'left': round((x0 - TILE / 2) * mpp, 3), 'right': round((x1 - TILE / 2) * mpp, 3),
            'bottom': round((ground_row - y1) * mpp, 3), 'top': round((ground_row - y0) * mpp, 3),
            'coverage': round(float((alpha > 0.5).mean()), 3),
            'source': model,
        })
        print(f'  {name}: {w:.1f} × {h:.1f} m, {time.time() - t0:.0f} s', flush=True)

    def save(arr, path):
        H, W = arr.shape[:2]
        img = bpy.data.images.new('o', W, H, alpha=True, float_buffer=False)
        img.colorspace_settings.name = 'Non-Color'
        img.pixels[:] = arr[::-1].ravel()
        img.filepath_raw = os.path.abspath(path)
        img.file_format = 'PNG'
        img.save()

    save(color, f'{OUT}/veg_color.png')
    save(normal, f'{OUT}/veg_normal.png')
    with open(f'{OUT}/meta.json', 'w') as f:
        json.dump({'tile': TILE, 'cols': COLS, 'rows': rows, 'tiles': meta}, f, indent=1)
    print('yazıldı', OUT)


if __name__ == '__main__':
    main()
