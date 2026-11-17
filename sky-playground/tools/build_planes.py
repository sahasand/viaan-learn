"""Two more original planes in the style of the toy plane, and a picture of each plane
for the chooser. Run with Blender --background --factory-startup --python this_file.
Parts are placed as (right, up, back); the nose points to the front (negative back).
The paintable parts use the material named 'Coral enamel', which the game recolours.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / 'assets'
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, roughness=.7, glow=0):
    color = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in color)
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF').inputs
    bs['Base Color'].default_value = (*color, 1); bs['Roughness'].default_value = roughness
    if glow: (bs.get('Emission Color') or bs.get('Emission')).default_value = (*color, 1); bs['Emission Strength'].default_value = glow
    return m
def pos(v): return (v[0], -v[2], v[1])
def finish(o, name, mat): o.name = name; o.data.materials.append(mat); return o
def ellipsoid(name, p, size, mat, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=pos(p))
    o = bpy.context.object; o.scale = (size[0], size[2], size[1]); finish(o, name, mat)
    for poly in o.data.polygons: poly.use_smooth = True
    return o
def box(name, p, size, mat, bevel=0, yaw=0, lean=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos(p))
    o = bpy.context.object; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Soft toy edges', 'BEVEL'); mod.width = bevel; mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in o.data.polygons: f.use_smooth = True
        mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    o.rotation_euler[2] = yaw; o.rotation_euler[1] = lean
    return finish(o, name, mat)
# A cone or tube lying along the plane: `front` and `back` are its two radii.
def tube(name, p, front, back, length, mat, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=front, radius2=back, depth=length, location=pos(p))
    o = bpy.context.object; o.rotation_euler[0] = math.pi / 2
    for f in o.data.polygons: f.use_smooth = len(f.vertices) == 4
    return finish(o, name, mat)
def wheel(p, radius, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, radius2=radius, depth=radius * .7, location=pos(p))
    o = bpy.context.object; o.rotation_euler[1] = math.pi / 2; return finish(o, 'Wheel', mat)

def start():
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.context.preferences.filepaths.save_version = 0
    return dict(coral=material('Coral enamel', (.94, .20, .12), .32), cream=material('Cream', (1, .93, .78), .5), gold=material('Marigold', (1, .60, .08), .38),
                navy=material('Deep teal', (.025, .15, .20), .38), glass=material('Blue windscreen', (.22, .67, .79), .2), brown=material('Pilot bear', (.48, .25, .12)),
                dark=material('Soft charcoal', (.035, .055, .06)), flame=material('Jet flame', (1, .55, .12), .4, 3))
# The bear at the controls, as in the toy plane: a seat, a windscreen, a head with ears and goggles.
def pilot(m, y, z):
    ellipsoid('Cockpit', (0, y - .19, z - .12), (.40, .19, .65), m['navy']); ellipsoid('Windshield', (0, y - .03, z - .52), (.37, .27, .23), m['glass'])
    ellipsoid('Pilot', (0, y, z), (.22, .25, .22), m['brown'])
    for side in [-1, 1]:
        ellipsoid('Pilot ear', (side * .19, y + .15, z + .02), (.09, .09, .07), m['brown'])
        ellipsoid('Goggle', (side * .09, y + .05, z - .205), (.08, .06, .028), m['cream']); ellipsoid('Lens', (side * .09, y + .05, z - .232), (.06, .04, .016), m['navy'])
    ellipsoid('Passenger seat', (0, y - .19, z + .52), (.36, .17, .48), m['navy'])
def save(name):
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (name + '.blend')))
    bpy.ops.export_scene.gltf(filepath=str(ROOT / (name + '.glb')), export_format='GLB', export_cameras=False, export_lights=False)
# A picture for the chooser: seen from the front and a little above, on a clear background.
def picture(name, far):
    scene = bpy.context.scene
    cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); scene.collection.objects.link(cam); scene.camera = cam
    cam.location = Vector((4.6, 6.0, 3.4)) * far; cam.rotation_euler = (Vector((0, 0, -.1)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 60
    for at, power in [((4, 3, 8), 3.2), ((-5, 6, 3), 1.2)]:
        sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scene.collection.objects.link(sun); sun.data.energy = power
        sun.rotation_euler = Vector(at).to_track_quat('Z', 'Y').to_euler()
    world = bpy.data.worlds.new('Soft light'); scene.world = world; world.use_nodes = True
    back = world.node_tree.nodes.get('Background'); back.inputs[0].default_value = (1, 1, 1, 1); back.inputs[1].default_value = .9
    scene.render.film_transparent = True; scene.render.resolution_x = scene.render.resolution_y = 384; scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'; scene.render.filepath = str(ROOT / (name + '.png'))
    for engine in ['BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH']:
        try: scene.render.engine = engine; bpy.ops.render.render(write_still=True); print('Pictured', name, 'with', engine); break
        except Exception as error: print(engine, 'could not draw', name, error)

# ---------- Big Jumbo: a chunky passenger plane ----------
m = start()
ellipsoid('Fuselage', (0, 0, 0), (.80, .78, 3.05), m['cream'], 28, 14)
ellipsoid('Painted belly', (0, -.17, .05), (.79, .68, 2.96), m['coral'], 28, 14)
pilot(m, .93, -1.45)
for side in [-1, 1]:
    for i in range(7):
        z = -.35 + i * .42; x = .80 * math.sqrt(max(0, 1 - (z / 3.05) ** 2 - (.26 / .78) ** 2)) - .015
        ellipsoid('Window', (side * x, .26, z), (.05, .13, .15), m['navy'], 10, 6)
    box('Main wing', (side * 1.8, -.2, .3), (3.3, .16, 1.15), m['cream'], .12, yaw=-side * .30)
    box('Coral wingtip', (side * 3.2, -.19, .73), (.5, .2, 1.18), m['coral'], .1, yaw=-side * .30)
    tube('Engine', (side * 1.55, -.56, .05), .36, .28, 1.2, m['coral']); ellipsoid('Engine mouth', (side * 1.55, -.56, -.56), (.30, .30, .09), m['dark'], 16, 6)
    box('Engine arm', (side * 1.55, -.33, .2), (.12, .26, .6), m['cream'], .04)
    box('Leg', (side * .55, -.66, .5), (.09, .34, .1), m['navy'], .03); wheel((side * .64, -.78, .5), .22, m['dark'])
box('Tail wings', (0, .30, 2.55), (2.8, .13, .78), m['cream'], .12)
box('Tail fin', (0, 1.0, 2.5), (.15, 1.5, .98), m['coral'], .14); box('Tail stripe', (0, 1.28, 2.53), (.165, .2, .82), m['cream'], .03)
box('Leg', (0, -.66, -1.9), (.09, .3, .1), m['navy'], .03); wheel((0, -.80, -1.9), .2, m['dark'])
save('jumbo-plane'); picture('plane-jumbo', 1.45)

# ---------- Zippy Jet: small, pointed and quick ----------
m = start()
ellipsoid('Fuselage', (0, 0, 0), (.46, .42, 2.0), m['coral'], 24, 12)
tube('Nose', (0, 0, -2.08), .03, .3, .95, m['gold'])
pilot(m, .55, -.3)
for side in [-1, 1]:
    box('Main wing', (side * 1.12, -.08, .6), (2.0, .13, 1.45), m['cream'], .1, yaw=-side * .5)
    box('Coral wingtip', (side * 1.98, -.07, 1.07), (.34, .17, 1.3), m['coral'], .08, yaw=-side * .5)
    box('Tail fin', (side * .4, .52, 1.45), (.12, .95, .72), m['coral'], .1, lean=side * .32)
    ellipsoid('Air scoop', (side * .43, .02, -.55), (.09, .2, .32), m['dark'], 12, 6)
    box('Leg', (side * .36, -.6, .5), (.08, .4, .09), m['navy'], .03); wheel((side * .44, -.80, .5), .2, m['dark'])
box('Tail wings', (0, .04, 1.62), (1.75, .11, .62), m['cream'], .1)
tube('Jet pipe', (0, 0, 1.92), .32, .25, .4, m['dark'])
ellipsoid('Flame', (0, 0, 2.38), (.17, .17, .42), m['flame'], 12, 8)
box('Leg', (0, -.56, -1.1), (.08, .46, .09), m['navy'], .03); wheel((0, -.83, -1.1), .17, m['dark'])
save('zippy-plane'); picture('plane-zippy', 1.0)

# ---------- the toy plane's picture, from its own file ----------
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'toy-plane.blend')); picture('plane-toy', 1.05)
print('Built Big Jumbo and Zippy Jet')
