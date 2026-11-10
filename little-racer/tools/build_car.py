"""Original Little Racer supercar. Run with:
blender --background --factory-startup --python little-racer/tools/build_car.py
Writes assets/supercar.blend, supercar.glb and the home-card render supercar.png.
Coordinates below are game coordinates: x right, y up, the nose points to -z."""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / 'assets'
ROOT.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.5, metallic=0, emission=0):
    linear = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*linear, 1)
    bs.inputs['Roughness'].default_value = roughness
    bs.inputs['Metallic'].default_value = metallic
    if emission:
        bs.inputs['Emission Color'].default_value = (*linear, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

def pos(v): return (v[0], -v[2], v[1])

def smooth(o):
    for poly in o.data.polygons: poly.use_smooth = True

def loft(name, stations, mat, levels=2):
    """Each station is (z, half width, bottom, top, shoulder inset)."""
    verts, faces, ring = [], [], 10
    for z, w, bottom, top, inset in stations:
        edge = min(.12, (top - bottom) * .35)
        half = [(w * .55, bottom), (w * .92, bottom), (w, bottom + edge), (w, top - edge * 1.3), (w - inset, top)]
        section = half + [(-x, y) for x, y in reversed(half)]
        verts += [pos((x, y, z)) for x, y in section]
    for s in range(len(stations) - 1):
        for i in range(ring):
            a, b = s * ring + i, s * ring + (i + 1) % ring
            faces.append((a, b, b + ring, a + ring))
    faces.append(tuple(range(ring)))
    faces.append(tuple(reversed(range((len(stations) - 1) * ring, len(stations) * ring))))
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    mod = o.modifiers.new('Clay smoothing', 'SUBSURF'); mod.levels = levels; mod.render_levels = levels
    bpy.ops.object.modifier_apply(modifier=mod.name)
    smooth(o)
    return o

def box(name, p, size, mat, bevel=0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos(p))
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Soft toy edges', 'BEVEL'); mod.width = bevel; mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        smooth(o)
    # rot is given in game axes (x, y, z).
    o.rotation_euler = (rot[0], -rot[2], rot[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(mat)
    return o

def ellipsoid(name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, location=pos(p))
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat); smooth(o)
    return o

def cylinder_x(name, p, radius, width, mat, vertices=28, bevel=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=width, location=pos(p), rotation=(0, math.pi / 2, 0))
    o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bevel:
        mod = o.modifiers.new('Rounded tyre', 'BEVEL'); mod.width = bevel; mod.segments = 3; mod.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat); smooth(o)
    return o

# The game repaints the material named "Paint"; keep that name.
paint = material('Paint', (.97, .66, .02), .3)
glass = material('Glass', (.05, .09, .12), .12)
dark = material('Charcoal', (.045, .05, .055), .6)
tyre = material('Tyre', (.03, .03, .035), .85)
silver = material('Silver', (.80, .82, .84), .3, .7)
lamp = material('Headlamp', (1, .97, .82), .2, 0, 1.6)
tail = material('Tail lamp', (.95, .08, .06), .3, 0, 1.4)

# Low wedge body: (z, half width, bottom, top, shoulder inset)
loft('Body', [
    (-2.22, .74, .22, .34, .10), (-2.05, .90, .17, .40, .12), (-1.30, 1.00, .15, .54, .16),
    (-.50, 1.00, .15, .64, .14), (.55, 1.02, .15, .74, .12), (1.35, 1.05, .17, .82, .12),
    (1.95, 1.02, .20, .84, .12), (2.20, .96, .32, .78, .12)], paint)
# Cabin glass, raked hard at the front and falling into the engine cover.
loft('Cabin glass', [
    (-1.05, .56, .50, .56, .08), (-.55, .68, .58, .82, .16), (0, .72, .62, 1.06, .22),
    (.55, .72, .68, 1.07, .22), (1.15, .66, .74, .92, .18), (1.60, .58, .78, .86, .10)], glass)
loft('Roof panel', [
    (-.12, .50, 1.0, 1.085, .10), (.20, .56, 1.02, 1.10, .10), (.62, .54, 1.02, 1.095, .10), (.86, .46, .98, 1.05, .10)], paint, 1)
for side in (-1, 1):
    ellipsoid('Front fender', (side * .76, .42, -1.30), (.23, .29, .60), paint)
    ellipsoid('Rear haunch', (side * .80, .56, 1.35), (.24, .32, .72), paint)
    box('Side intake', (side * 1.0, .46, .62), (.10, .26, .62), dark, .04, (0, side * .12, 0))
    box('Door crease', (side * 1.035, .36, -.25), (.03, .05, 1.2), dark, .01)
    box('Headlamp', (side * .60, .405, -1.98), (.36, .05, .16), lamp, .02, (.16, side * -.42, 0))
    box('Nose intake', (side * .50, .25, -2.20), (.36, .10, .08), dark, .02)
    box('Wing post', (side * .62, .93, 1.86), (.07, .26, .22), dark, .02)
    box('Wing end plate', (side * 1.0, 1.06, 1.92), (.05, .22, .50), paint, .02)
    for i in (0, 1):
        cylinder_z = side * (.16 + i * .22)
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=.075, depth=.16, location=pos((cylinder_z, .34, 2.22)), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.object; o.name = 'Exhaust'; o.data.materials.append(silver); smooth(o)
box('Front splitter', (0, .15, -2.13), (1.66, .05, .22), dark, .02)
box('Side skirts', (0, .14, .05), (2.08, .06, 2.2), dark, .02)
box('Engine cover', (0, .845, 1.55), (.96, .05, .62), dark, .02, (-.04, 0, 0))
box('Rear diffuser', (0, .22, 2.12), (1.6, .14, .22), dark, .03)
box('Rear wing', (0, 1.08, 1.92), (1.98, .055, .44), paint, .025, (.07, 0, 0))
box('Tail lamp', (0, .62, 2.215), (1.62, .06, .05), tail, .02)

# Join everything so far by material; wheels stay separate so they can spin.
groups = {}
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH': groups.setdefault(o.data.materials[0].name, []).append(o)
for name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join(); bpy.context.object.name = name + ' parts'

def wheel(name, x, z, radius):
    side = 1 if x > 0 else -1
    parts = [cylinder_x('tyre', (x, radius, z), radius, .30, tyre, 28, .05),
             cylinder_x('rim', (x + side * .135, radius, z), radius * .62, .05, silver, 10),
             cylinder_x('hub', (x + side * .16, radius, z), radius * .2, .04, dark, 10)]
    for i in range(5):
        spoke = box('spoke', (x + side * .15, radius, z), (.03, radius * 1.1, .07), dark)
        spoke.rotation_euler = (i * math.pi / 5, 0, 0)
        parts.append(spoke)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.object; o.name = name
    # The origin sits on the axle so the game can spin and steer the wheel.
    bpy.context.scene.cursor.location = pos((x, radius, z))
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o

wheel('Wheel_FL', -.94, -1.30, .34); wheel('Wheel_FR', .94, -1.30, .34)
wheel('Wheel_RL', -.97, 1.35, .38); wheel('Wheel_RR', .97, 1.35, .38)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'supercar.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'supercar.glb'), export_format='GLB', export_cameras=False, export_lights=False, export_apply=True)

# Home-card portrait, lit like the Little Friends clay animals.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 32; scene.cycles.use_denoising = True
scene.render.resolution_x = 512; scene.render.resolution_y = 512; scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
if scene.world is None: scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes['Background']
background.inputs[0].default_value = (.8, .86, .82, 1); background.inputs[1].default_value = .3

def light(name, p, power, size):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = size
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o)
    o.location = p; o.rotation_euler = (Vector((0, 0, .5)) - o.location).to_track_quat('-Z', 'Y').to_euler()
light('Large softbox', (-4, -5, 7), 620, 6); light('Warm fill', (5, -2, 4), 260, 4); light('Rim', (0, 5, 6), 500, 3)
data = bpy.data.cameras.new('Portrait camera'); cam = bpy.data.objects.new('Portrait camera', data); scene.collection.objects.link(cam)
import sys
view = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'card'
cam.location = {'card': (-6.5, 8.5, 3.6), 'rear': (5.5, -8.5, 3.4), 'side': (-11, 0, 1.2), 'top': (0, .01, 12)}[view]
cam.rotation_euler = (Vector((0, 0, .5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
data.type = 'ORTHO'; data.ortho_scale = 5.0; scene.camera = cam
scene.render.filepath = str(ROOT / 'supercar.png') if view == 'card' else str(Path(sys.argv[sys.argv.index('--') + 2]))
bpy.ops.render.render(write_still=True)
