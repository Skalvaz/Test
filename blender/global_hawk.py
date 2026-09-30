"""
Apronda park etmiş RQ-4 Global Hawk (insansız keşif uçağı, turbofan motorlu).

Kaynak: NASA 3D Resources "Global Hawk" (kamu malı; NASA kullanım
yönergeleri). NASA amblemi korumalı bir işarettir: model dokusuz alınır,
amblem ve kurum boyası kaldırılır; oyunda askeri açık gri boya ve lastik
malzemeleriyle kaplanır. Ölçek kanat açıklığına göre (39,9 m).

    /home/user/bpyenv/bin/python blender/global_hawk.py
    node scripts/pack-kit.mjs build/global_hawk_raw.glb src/assets/afprops/global_hawk.glb
"""

import math
import os

import bpy
from mathutils import Matrix, Vector

SRC = '/home/user/nasa/nasa-3d-resources/3D Models/Global Hawk/Global Hawk.glb'
OUT = 'build/global_hawk_raw.glb'
SPAN = 39.9


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    s = SPAN / (mx.x - mn.x)
    # Tabanı zemine, merkezi orijine; ölçek
    M = Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)))
    body = bpy.data.materials.new('gh_body')
    dark = bpy.data.materials.new('gh_dark')
    rubber = bpy.data.materials.new('gh_rubber')
    for o in objs:
        o.data.transform(o.matrix_world)
        o.data.transform(M)
        o.matrix_world = Matrix.Identity(4)
        for i, slot in enumerate(o.material_slots):
            n = slot.material.name if slot.material else ''
            if 'wheels' in n:
                slot.material = rubber
            elif 'blinn1' in n:
                slot.material = dark
            else:
                slot.material = body
    for img in list(bpy.data.images):
        bpy.data.images.remove(img)
    os.makedirs('build', exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_materials='EXPORT',
                              export_image_format='NONE', export_yup=True, export_normals=True, export_apply=True)
    print('yazıldı', OUT, [round(v * s, 2) for v in (mx - mn)])


if __name__ == '__main__':
    main()
