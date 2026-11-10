"""Original Little Racer supercar. Run with:
blender --background --factory-startup --python little-racer/tools/build_car.py
Writes assets/supercar.blend, supercar.glb and the home-card render supercar.png.
Add `-- side /tmp/out.png` (or front, rear, top) for a check render from another angle.
Coordinates below are game coordinates: x right, y up, the nose points to -z."""
import bpy, math, sys
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

def activate(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active = o

def shade(o, angle=40):
    for poly in o.data.polygons: poly.use_smooth = True
    o.data.set_sharp_from_angle(angle=math.radians(angle))

def modify(o, kind, **settings):
    mod = o.modifiers.new(kind.title(), kind)
    for key, value in settings.items(): setattr(mod, key, value)
    activate(o); bpy.ops.object.modifier_apply(modifier=mod.name)

def loft(name, rings, mat):
    """Skin a closed tube through rings of game-space points and cap both ends."""
    count = len(rings[0]); verts = [pos(p) for ring in rings for p in ring]; faces = []
    for s in range(len(rings) - 1):
        for i in range(count):
            a, b = s * count + i, s * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.append(tuple(range(count)))
    faces.append(tuple(reversed(range((len(rings) - 1) * count, len(rings) * count))))
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    return o

def box(name, p, size, mat, bevel=0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos(p))
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel: modify(o, 'BEVEL', width=bevel, segments=3); shade(o)
    # rot is given in game axes (x, y, z).
    o.rotation_euler = (rot[0], -rot[2], rot[1])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    o.data.materials.append(mat)
    return o

def ellipsoid(name, p, size, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, location=pos(p))
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat); shade(o, 80)
    return o

def cylinder(name, p, radius, depth, mat, axis='x', vertices=32, bevel=0):
    spin = (0, math.pi / 2, 0) if axis == 'x' else (math.pi / 2, 0, 0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos(p), rotation=spin)
    o = bpy.context.object; o.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bevel: modify(o, 'BEVEL', width=bevel, segments=3, limit_method='ANGLE')
    o.data.materials.append(mat); shade(o)
    return o

def panel(name, corners, mat, inset=.1, push=.02):
    """A flat piece of glass or trim laid just above a body face, facing outward."""
    points = [Vector(c) for c in corners]; centre = sum(points, Vector()) / len(points)
    points = [p + (centre - p) * inset for p in points]
    normal = (points[1] - points[0]).cross(points[2] - points[0]).normalized()
    if normal.dot(centre - Vector((0, .5, centre.z))) < 0: normal = -normal; points.reverse()
    mesh = bpy.data.meshes.new(name); mesh.from_pydata([pos(p + normal * push) for p in points], [], [tuple(range(len(points)))]); mesh.update()
    o = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(o); o.data.materials.append(mat)
    activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    # Game x is Blender x, so a face seen from outside keeps its winding after pos().
    if o.data.polygons[0].normal.dot(Vector(pos(normal))) < 0: activate(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode='OBJECT')
    return o

# The game repaints the material named "Paint"; keep that name.
paint = material('Paint', (.98, .72, .03), .26)
glass = material('Glass', (.05, .09, .12), .12)
dark = material('Charcoal', (.045, .05, .055), .6)
tyre = material('Tyre', (.03, .03, .035), .85)
silver = material('Silver', (.80, .82, .84), .3, .7)
lamp = material('Headlamp', (1, .97, .82), .2, 0, 1.6)
tail = material('Tail lamp', (.95, .08, .06), .3, 0, 1.4)

FRONT, REAR = (.94, -1.30, .31), (.97, 1.35, .38)      # wheel x, z, radius

# ---- body: a low wedge with raised fenders, a dipped bonnet and wide rear haunches ----
# (z, half width, floor, shoulder height, centre height)
STATIONS = [
    (-2.26, .52, .25, .30, .31), (-2.08, .84, .17, .36, .38), (-1.72, .99, .15, .58, .47),
    (-1.30, 1.04, .15, .77, .53), (-.88, 1.01, .15, .68, .58), (-.30, .97, .15, .63, .64),
    (.40, 1.00, .15, .69, .70), (.90, 1.05, .16, .78, .75), (1.35, 1.08, .17, .86, .79),
    (1.85, 1.06, .20, .87, .81), (2.14, 1.01, .28, .83, .79), (2.26, .93, .37, .75, .73)]
def body_ring(z, w, floor, shoulder, centre):
    half = [(0, floor), (w * .78, floor), (w, floor + .10), (w, shoulder - .08), (w - .08, shoulder), (w * .5, (shoulder + centre) / 2), (0, centre)]
    return [(x, y, z) for x, y in half] + [(-x, y, z) for x, y in reversed(half[1:-1])]
body = loft('Body', [body_ring(*s) for s in STATIONS], paint)
modify(body, 'SUBSURF', levels=2, render_levels=2)
# Wheel arches are cut out of the body; the cut faces take the dark material.
body.data.materials.append(dark)
for x, z, radius in (FRONT, REAR):
    for side in (-1, 1):
        cutter = cylinder('cutter', (side * 1.115, radius, z), radius + .075, .67, dark, 'x', 40)
        mod = body.modifiers.new('Arch', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter; mod.solver = 'EXACT'
        activate(body); bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)
shade(body, 35)

# ---- cabin: painted pillars and roof with flush dark glass ----
# (z, base half width, base height, roof half width, roof height)
CABIN = [(-.98, .66, .50, .62, .585), (-.12, .86, .56, .53, 1.06), (.46, .88, .62, .55, 1.085), (1.22, .80, .70, .50, .93), (1.80, .68, .74, .52, .845)]
def cabin_ring(z, wb, yb, wt, yt):
    return [(wb, yb, z), (wt, yt, z), (0, yt + .015, z), (-wt, yt, z), (-wb, yb, z), (0, yb, z)]
cabin = loft('Cabin', [cabin_ring(*c) for c in CABIN], paint)
modify(cabin, 'BEVEL', width=.045, segments=3); shade(cabin)
A, B, C, D, E = CABIN
top = lambda c, side: (side * c[3], c[4], c[0])
base = lambda c, side: (side * c[1], c[2] + .07, c[0])
panel('Windscreen', [top(A, -1), top(A, 1), top(B, 1), top(B, -1)], glass, .07)
panel('Engine glass', [top(C, -1), top(C, 1), top(D, 1), top(D, -1)], glass, .1)
for side in (-1, 1):
    panel('Quarter light', [base(A, side), base(B, side), top(B, side), top(A, side)], glass, .16)
    panel('Door glass', [base(B, side), base(C, side), top(C, side), top(B, side)], glass, .1)
    panel('Rear quarter', [base(C, side), base(D, side), top(D, side), top(C, side)], glass, .14)
for i in range(4):
    t = .16 + i * .23
    box('Engine louvre', (0, D[4] + (E[4] - D[4]) * t + .02, D[0] + (E[0] - D[0]) * t), (.84, .028, .075), dark, .008, (-.15, 0, 0))

# ---- trim and lights ----
for side in (-1, 1):
    box('Lamp housing', (side * .56, .375, -2.0), (.42, .05, .2), dark, .015, (.24, side * -.5, 0))
    box('Headlamp', (side * .56, .392, -2.02), (.34, .03, .08), lamp, .01, (.24, side * -.5, 0))
    box('Side intake', (side * 1.04, .47, .78), (.09, .26, .56), dark, .04, (0, side * .14, 0))
    box('Door line', (side * 1.0, .37, -.22), (.03, .04, 1.25), dark, .008)
    ellipsoid('Mirror', (side * .96, .80, -.44), (.12, .075, .10), paint)
    box('Mirror arm', (side * .86, .76, -.42), (.16, .035, .06), dark, .01)
    box('Wing support', (side * .58, .98, 1.94), (.06, .30, .20), dark, .015, (-.25, 0, 0))
    box('Wing end plate', (side * 1.02, 1.10, 1.98), (.045, .26, .54), paint, .015)
    cylinder('Exhaust', (side * .24, .43, 2.27), .10, .14, silver, 'z', 20, .015)
    cylinder('Exhaust core', (side * .24, .43, 2.33), .07, .03, dark, 'z', 16)
box('Nose intake', (0, .235, -2.20), (1.16, .10, .14), dark, .02)
box('Front splitter', (0, .135, -2.16), (1.5, .045, .26), dark, .012)
box('Side skirts', (0, .135, .03), (2.14, .07, 2.05), dark, .02)
box('Rear panel', (0, .56, 2.235), (1.74, .30, .07), dark, .02)
box('Tail lamp', (0, .655, 2.275), (1.62, .055, .04), tail, .015)
box('Rear diffuser', (0, .24, 2.13), (1.66, .17, .30), dark, .02)
for i in range(5): box('Diffuser fin', ((i - 2) * .34, .23, 2.22), (.035, .16, .22), silver, .006)
box('Rear wing', (0, 1.14, 1.98), (2.0, .05, .46), paint, .02, (.09, 0, 0))
box('Wing lip', (0, 1.185, 2.19), (2.0, .06, .04), dark, .01)

# Join everything so far by material; wheels stay separate so they can spin.
groups = {}
for o in list(bpy.context.scene.objects):
    if o.type == 'MESH': groups.setdefault(o.data.materials[0].name, []).append(o)
for name, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join(); bpy.context.object.name = name + ' parts'

def wheel(name, side, x, z, radius):
    x *= side
    parts = [cylinder('tyre', (x, radius, z), radius, .30, tyre, 'x', 36, .06),
             cylinder('rim', (x + side * .10, radius, z), radius * .70, .13, silver, 'x', 28, .015),
             cylinder('dish', (x + side * .155, radius, z), radius * .60, .03, dark, 'x', 28),
             cylinder('cap', (x + side * .185, radius, z), radius * .17, .04, silver, 'x', 14, .01)]
    for i in range(3):
        spoke = box('spoke', (x + side * .17, radius, z), (.045, radius * 1.22, .085), silver, .012)
        spoke.rotation_euler = (i * math.pi / 3, 0, 0)
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

wheel('Wheel_FL', -1, *FRONT); wheel('Wheel_FR', 1, *FRONT)
wheel('Wheel_RL', -1, *REAR); wheel('Wheel_RR', 1, *REAR)

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'supercar.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'supercar.glb'), export_format='GLB', export_cameras=False, export_lights=False, export_apply=True)

# Home-card portrait, lit like the Little Friends clay animals.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 32; scene.cycles.use_denoising = True
scene.render.resolution_x = 512; scene.render.resolution_y = 512; scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
if scene.world is None: scene.world = bpy.data.worlds.new('Studio')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes['Background']
background.inputs[0].default_value = (.8, .86, .82, 1); background.inputs[1].default_value = .3

def light(name, p, power, size):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = size
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o)
    o.location = p; o.rotation_euler = (Vector((0, 0, .5)) - o.location).to_track_quat('-Z', 'Y').to_euler()
light('Large softbox', (-4, -5, 7), 420, 6); light('Warm fill', (5, -2, 4), 180, 4); light('Rim', (0, 5, 6), 340, 3)
data = bpy.data.cameras.new('Portrait camera'); cam = bpy.data.objects.new('Portrait camera', data); scene.collection.objects.link(cam)
view = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'card'
cam.location = {'card': (-6.5, 8.5, 3.6), 'rear': (5.5, -8.5, 3.4), 'side': (-11, 0, 1.2), 'front': (-2.5, 10, 2.2), 'top': (0, .01, 12)}[view]
cam.rotation_euler = (Vector((0, 0, .5)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
data.type = 'ORTHO'; data.ortho_scale = 5.0; scene.camera = cam
scene.render.filepath = str(ROOT / 'supercar.png') if view == 'card' else str(Path(sys.argv[sys.argv.index('--') + 2]))
bpy.ops.render.render(write_still=True)
