"""
Döşenebilir (dikişsiz) malzeme dokuları — Blender'da prosedürel gölgelendirici,
Cycles ile düz levhaya pişirme.

Dikişsizlik: UV (u, v) iki çembere eşlenir ve 4B gürültüye verilir:
    (cos 2πu, sin 2πu, cos 2πv, sin 2πv) · R
Böylece doku hem u hem v yönünde tam periyodiktir. Çember yarıçapları
farklı seçilerek yönlü desen (fırçalanmış metal) de dikişsiz kalır.

Malzemeler:
    cast       kum döküm alüminyum/magnezyum: gözenekler, dalgalı yüzey
    machined   torna/taşlama izli metal: ince yönlü çizgiler, takım izleri
    paint      boyalı çelik: portakal kabuğu, ince çizikler, tozlanma

Çıktılar: <ad>_normal.webp (tanjant uzayı, OpenGL), <ad>_orm.webp
(R = boşluk/AO, G = pürüzlülük, B = 1).

    /home/user/bpyenv/bin/python blender/materials.py --out src/assets --size 512
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

from kitlib import link, reset  # noqa: E402


class G:
    """Küçük düğüm grafiği yardımcısı."""

    def __init__(self, mat):
        self.nt = mat.node_tree
        self.nodes = self.nt.nodes
        self.links = self.nt.links

    def node(self, kind, **props):
        n = self.nodes.new(kind)
        for k, v in props.items():
            if k.startswith('in_'):
                n.inputs[k[3:].replace('_', ' ')].default_value = v
            else:
                setattr(n, k, v)
        return n

    def link(self, a, b):
        self.links.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                n.inputs[i].default_value = x
            else:
                self.link(x, n.inputs[i])
        return n.outputs[0]

    def torus4(self, ru, rv):
        """UV → 4B dikişsiz koordinat: (Vector xyz, W)."""
        uv = self.node('ShaderNodeTexCoord').outputs['UV']
        sep = self.node('ShaderNodeSeparateXYZ')
        self.link(uv, sep.inputs[0])
        tau = 2 * math.pi
        au = self.math('MULTIPLY', sep.outputs[0], tau)
        av = self.math('MULTIPLY', sep.outputs[1], tau)
        x = self.math('MULTIPLY', self.math('COSINE', au), ru)
        y = self.math('MULTIPLY', self.math('SINE', au), ru)
        z = self.math('MULTIPLY', self.math('COSINE', av), rv)
        w = self.math('MULTIPLY', self.math('SINE', av), rv)
        comb = self.node('ShaderNodeCombineXYZ')
        self.link(x, comb.inputs[0])
        self.link(y, comb.inputs[1])
        self.link(z, comb.inputs[2])
        return comb.outputs[0], w

    def noise(self, ru, rv, scale, detail=4.0, rough=0.5, offset=0.0):
        vec, w = self.torus4(ru, rv)
        n = self.node('ShaderNodeTexNoise', noise_dimensions='4D', in_Scale=scale, in_Detail=detail, in_Roughness=rough)
        self.link(vec, n.inputs['Vector'])
        self.link(self.math('ADD', w, offset), n.inputs['W'])
        return n.outputs['Fac']

    def voronoi(self, ru, rv, scale, feature='F1', offset=0.0, rand=1.0):
        vec, w = self.torus4(ru, rv)
        n = self.node('ShaderNodeTexVoronoi', voronoi_dimensions='4D', feature=feature, in_Scale=scale, in_Randomness=rand)
        self.link(vec, n.inputs['Vector'])
        self.link(self.math('ADD', w, offset), n.inputs['W'])
        return n.outputs['Distance']

    def ramp(self, x, lo, hi):
        """x'i [lo, hi] → [0, 1] (kırpılmış)."""
        return self.math('MULTIPLY', self.math('SUBTRACT', x, lo), 1.0 / (hi - lo), clamp=True)


def material(name, build):
    """build(g) → (height, roughness) çıkışları; yükseklikten tümsek ve
    pişirme için yayım (yükseklik) bağlanır."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    g = G(m)
    bsdf = g.nodes['Principled BSDF']
    height, rough, strength = build(g)
    bump = g.node('ShaderNodeBump', in_Strength=strength, in_Distance=0.02)
    g.link(height, bump.inputs['Height'])
    g.link(bump.outputs['Normal'], bsdf.inputs['Normal'])
    g.link(rough, bsdf.inputs['Roughness'])
    bsdf.inputs['Emission Strength'].default_value = 1.0
    g.link(height, bsdf.inputs['Emission Color'])
    return m


# ---------------------------------------------------------------------------

def cast(g):
    # Düşük frekanslı döküm dalgası + kum gözenekleri + ince kum dokusu
    wave = g.noise(0.6, 0.6, 2.0, detail=2.0, rough=0.5)
    sand = g.noise(1.0, 1.0, 20.0, detail=3.0, rough=0.55, offset=3.0)
    pits = g.voronoi(1.0, 1.0, 11.0, offset=7.0)
    pit = g.math('SUBTRACT', 1.0, g.ramp(pits, 0.0, 0.11))          # 1 = gözenek merkezi
    h = g.math('ADD', g.math('MULTIPLY', wave, 0.35), g.math('MULTIPLY', sand, 0.3))
    h = g.math('SUBTRACT', h, g.math('MULTIPLY', pit, 0.5))
    rough = g.math('ADD', 0.52, g.math('MULTIPLY', g.noise(0.8, 0.8, 4.0, detail=3.0, offset=11.0), 0.25))
    rough = g.math('ADD', rough, g.math('MULTIPLY', pit, 0.15))
    return h, rough, 0.6


def machined(g):
    # Yönlü ince çizgiler: v yönünde çok, u yönünde az değişim
    lines = g.noise(0.06, 3.0, 24.0, detail=4.0, rough=0.6)
    marks = g.noise(0.4, 1.2, 10.0, detail=3.0, rough=0.5, offset=5.0)   # takım izleri
    h = g.math('ADD', g.math('MULTIPLY', lines, 0.7), g.math('MULTIPLY', marks, 0.3))
    rough = g.math('ADD', 0.22, g.math('MULTIPLY', g.noise(0.5, 1.5, 6.0, detail=4.0, offset=9.0), 0.22))
    return h, rough, 0.12


def paint(g):
    # Portakal kabuğu + seyrek ince çizikler + tozlanma
    peel = g.noise(1.0, 1.0, 16.0, detail=2.0, rough=0.4)
    scratch_n = g.noise(0.15, 2.5, 30.0, detail=1.0, rough=0.3, offset=4.0)
    scratch = g.ramp(g.math('ABSOLUTE', g.math('SUBTRACT', scratch_n, 0.5)), 0.0, 0.012)
    scratch = g.math('SUBTRACT', 1.0, scratch)                            # 1 = çizik
    mask = g.ramp(g.noise(0.5, 0.5, 3.0, detail=2.0, offset=13.0), 0.55, 0.7)
    scratch = g.math('MULTIPLY', scratch, mask)
    h = g.math('SUBTRACT', g.math('MULTIPLY', peel, 0.6), g.math('MULTIPLY', scratch, 0.5))
    dust = g.noise(0.7, 0.7, 5.0, detail=4.0, offset=17.0)
    rough = g.math('ADD', 0.42, g.math('MULTIPLY', dust, 0.2))
    rough = g.math('ADD', rough, g.math('MULTIPLY', scratch, 0.25))
    return h, rough, 0.16


MATS = {'cast': cast, 'machined': machined, 'paint': paint}


# ---------------------------------------------------------------------------

def plane(mat):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, matrix=Matrix.Translation((0.5, 0.5, 0)))
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x, loop.vert.co.y)
    me = bpy.data.meshes.new('plane')
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new('plane', me))
    obj.data.materials.append(mat)
    return obj


def bake(obj, img, kind, **kw):
    nt = obj.active_material.node_tree
    node = nt.nodes.get('BAKE_TARGET') or nt.nodes.new('ShaderNodeTexImage')
    node.name = 'BAKE_TARGET'
    node.image = img
    nt.nodes.active = node
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    t0 = time.time()
    bpy.ops.object.bake(type=kind, margin=0, use_clear=True, **kw)
    print(f'    {kind}: {time.time() - t0:.1f} s', flush=True)


def arr(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def blur_wrap(a, r):
    """Döşenebilir kutu bulanıklığı (kenarlar sarılır)."""
    out = a.copy()
    for axis in (0, 1):
        acc = np.zeros_like(out)
        for k in range(-r, r + 1):
            acc += np.roll(out, k, axis=axis)
        out = acc / (2 * r + 1)
    return out


def save(a, path, S, quality):
    img = bpy.data.images.new(os.path.basename(path), S, S, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([a, np.ones((S, S, 1), np.float32)], axis=2)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.file_format = 'WEBP'
    img.save(filepath=path, quality=quality)
    print(f'    yazıldı {path} ({os.path.getsize(path) / 1024:.0f} KB)', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='src/assets')
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--quality', type=int, default=88)
    ap.add_argument('--only', default='')
    args = ap.parse_args(argv)
    S = args.size
    for name, fn in MATS.items():
        if args.only and name not in args.only.split(','):
            continue
        print(f'== {name}', flush=True)
        reset()
        bpy.context.scene.cycles.samples = 1
        m = material(name, fn)
        obj = plane(m)
        imgs = {k: bpy.data.images.new(k, S, S, float_buffer=True, alpha=False) for k in ('normal', 'rough', 'height')}
        for im in imgs.values():
            im.colorspace_settings.name = 'Non-Color'
        bake(obj, imgs['normal'], 'NORMAL', normal_space='TANGENT')
        bake(obj, imgs['rough'], 'ROUGHNESS')
        bake(obj, imgs['height'], 'EMIT')
        normal = arr(imgs['normal'])[..., :3]
        rough = arr(imgs['rough'])[..., 0]
        h = arr(imgs['height'])[..., 0]
        # Boşluk: yerel ortalamanın altındaki bölgeler (döşenebilir bulanıklık)
        cav = np.clip(1.0 - (blur_wrap(h, max(2, S // 64)) - h) * 3.0, 0.55, 1.0)
        orm = np.stack([cav, np.clip(rough, 0, 1), np.ones_like(h)], axis=2)
        os.makedirs(args.out, exist_ok=True)
        save(normal, os.path.join(args.out, f'mat_{name}_normal.webp'), S, args.quality)
        save(orm, os.path.join(args.out, f'mat_{name}_orm.webp'), S, args.quality)


if __name__ == '__main__':
    main()
