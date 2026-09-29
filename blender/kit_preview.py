"""
Kit parçalarının önizleme tablosu (Cycles): her parçanın L0 sürümü ızgaraya
dizilir, altına adı yazılır. Geliştirme sırasında görsel kontrol içindir.

    /home/user/bpyenv/bin/python blender/kit_preview.py --lod 0 --out build/kit_preview.png
"""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import kit_parts  # noqa: E402
from kitlib import clear_mats, join, reset, SLOT_COLORS  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument('--lod', type=int, default=0)
    ap.add_argument('--out', default='build/kit_preview.png')
    ap.add_argument('--only', default='')
    ap.add_argument('--samples', type=int, default=24)
    args = ap.parse_args(argv)
    scn = reset()
    clear_mats()
    names = [n for n in kit_parts.PARTS if not args.only or n in args.only.split(',')]
    cols = 8
    cell = 0.34
    celly = 0.5
    for i, name in enumerate(names):
        objs = [o for o in kit_parts.PARTS[name](kit_parts.LODS[args.lod]) if o is not None]
        obj = join(objs, name)
        # sığdır
        bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        size = max(max(v[k] for v in bb) - min(v[k] for v in bb) for k in range(3))
        s = min(3.0, 0.24 / max(size, 1e-3))
        obj.scale = (s, s, s)
        cx = (i % cols) * cell
        cy = -(i // cols) * celly
        ctr = sum(bb, Vector()) / 8
        # zemine oturt (yazılar parçanın önünde, zeminde kalır)
        minz = min(v.z for v in bb)
        obj.location = Vector((cx - ctr.x * s, cy - ctr.y * s, -minz * s))
        obj.rotation_euler = (0, 0, 0)
        t = bpy.data.curves.new(name + '_t', 'FONT')
        t.body = f'{name}'
        t.size = 0.028
        t.align_x = 'CENTER'
        to = bpy.data.objects.new(name + '_t', t)
        scn.collection.objects.link(to)
        to.location = (cx, cy - 0.17, 0)
        m = bpy.data.materials.get('label') or bpy.data.materials.new('label')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.9, 0.9, 0.9, 1)
        to.data.materials.append(m)
    # metal görünüm + trim sheet dokuları (src/assets)
    assets = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src/assets')

    def img(name, color):
        im = bpy.data.images.load(os.path.join(assets, name))
        im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
        return im
    trim_alb = img('trim_albedo.webp', True)
    trim_nrm = img('trim_normal.webp', False)
    for slot, c in SLOT_COLORS.items():
        mm = bpy.data.materials.get(slot)
        if not mm:
            continue
        nt = mm.node_tree
        b = nt.nodes['Principled BSDF']
        metallic = slot in ('steel', 'ss', 'cast', 'weld', 'knurl', 'gold', 'anodized', 'iridite', 'tank')
        b.inputs['Metallic'].default_value = 0.9 if metallic else 0.0
        b.inputs['Roughness'].default_value = 0.38 if metallic else 0.55
        if slot in ('weld', 'knurl', 'rivet', 'louver', 'placard'):
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = trim_nrm
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
        if slot == 'placard':
            ta = nt.nodes.new('ShaderNodeTexImage')
            ta.image = trim_alb
            nt.links.new(ta.outputs['Color'], b.inputs['Base Color'])
    rows = math.ceil(len(names) / cols)
    cam_d = bpy.data.cameras.new('cam')
    cam_d.type = 'ORTHO'
    cam_d.ortho_scale = max(cols * cell, rows * celly * 0.78 * 16 / 9) * 1.06
    cam = bpy.data.objects.new('cam', cam_d)
    scn.collection.objects.link(cam)
    cx = (cols - 1) * cell / 2
    cy = -(rows - 1) * celly / 2 - 0.08
    # 3/4 bakış: parçaların "yukarı"sı (three Y = Blender Z) kameraya dönük
    cam.location = (cx, cy - 4.2, 5.2)
    d = Vector((cx, cy, 0)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scn.camera = cam
    w = bpy.data.worlds['World']
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.05, 0.055, 0.06, 1)
    for loc, e in (((cx - 3, cy - 3, 6), 600), ((cx + 5, cy + 2, 3), 250)):
        L = bpy.data.lights.new('l', 'AREA')
        L.energy = e
        L.size = 3
        lo = bpy.data.objects.new('l', L)
        scn.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((cx, cy, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.render.resolution_x = 1920
    scn.render.resolution_y = 1080
    scn.cycles.samples = args.samples
    scn.cycles.use_denoising = True
    scn.view_settings.view_transform = 'AgX'
    scn.render.filepath = os.path.abspath(args.out)
    bpy.ops.render.render(write_still=True)
    print('yazıldı', args.out)


if __name__ == '__main__':
    main()
