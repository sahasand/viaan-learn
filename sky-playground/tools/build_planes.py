"""Two more original planes in the style of the toy plane, and a picture of each plane
for the chooser. Run with Blender --background --factory-startup --python this_file.
Parts are placed as (right, up, back); the nose points to the front (negative back).
The paintable parts use the material named 'Coral enamel', which the game recolours.
Names after "--" build only those: jumbo, zippy, toy (the toy plane's picture).
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / 'assets'
bpy.context.preferences.filepaths.save_version = 0
ONLY = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def want(name): return not ONLY or name in ONLY

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
def box(name, p, size, mat, bevel=0, yaw=0, lean=0, tilt=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos(p))
    o = bpy.context.object; o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new('Soft toy edges', 'BEVEL'); mod.width = bevel; mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in o.data.polygons: f.use_smooth = True
        mod = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    o.rotation_euler[2] = yaw; o.rotation_euler[1] = lean; o.rotation_euler[0] = tilt   # swept back, leaning out, tipped back
    return finish(o, name, mat)
# A cone or tube lying along the plane: `front` and `back` are its two radii.
def tube(name, p, front, back, length, mat, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=front, radius2=back, depth=length, location=pos(p))
    o = bpy.context.object; o.rotation_euler[0] = math.pi / 2
    for f in o.data.polygons: f.use_smooth = len(f.vertices) == 4
    return finish(o, name, mat)
# Raised letters on the side of the body: `side` is 1 for the right of the plane, -1 for the left.
def lettering(text, p, size, mat, side, turn=0):
    bpy.ops.object.text_add(location=pos(p)); o = bpy.context.object
    o.data.body = text; o.data.size = size; o.data.align_x = 'CENTER'; o.data.align_y = 'CENTER'; o.data.extrude = .012
    o.rotation_euler = (math.pi / 2, 0, side * (math.pi / 2 + turn)); bpy.ops.object.convert(target='MESH')   # `turn` follows a body that narrows toward the nose
    return finish(bpy.context.object, 'Lettering', mat)
def wheel(p, radius, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius, radius2=radius, depth=radius * .7, location=pos(p))
    o = bpy.context.object; o.rotation_euler[1] = math.pi / 2; return finish(o, 'Wheel', mat)

def start():
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.context.preferences.filepaths.save_version = 0
    return dict(coral=material('Coral enamel', (.94, .20, .12), .32), cream=material('Cream', (1, .93, .78), .5), gold=material('Marigold', (1, .60, .08), .38),
                navy=material('Deep teal', (.025, .15, .20), .38), glass=material('Blue windscreen', (.22, .67, .79), .2), brown=material('Pilot bear', (.48, .25, .12)),
                dark=material('Soft charcoal', (.035, .055, .06)), flame=material('Jet flame', (1, .55, .12), .4, 3),
                silver=material('Soft silver', (.78, .82, .86), .25), red=material('Red light', (1, .12, .1), .4, 2.5), green=material('Green light', (.15, 1, .35), .4, 2.5))
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

# ---------- Big Jumbo: a chunky passenger plane with an upper deck and four engines ----------
BODY = (.80, .78, 3.05)
def skin(y, z): return BODY[0] * math.sqrt(max(0, 1 - (z / BODY[2]) ** 2 - (y / BODY[1]) ** 2))   # how far out the body's side is
if want('jumbo'):
    m = start()
    ellipsoid('Fuselage', (0, 0, 0), BODY, m['cream'], 32, 16)
    ellipsoid('Painted belly', (0, -.17, .05), (.79, .68, 2.96), m['coral'], 32, 16)
    ellipsoid('Upper deck', (0, .40, -1.25), (.62, .57, 1.55), m['cream'], 24, 12)
    ellipsoid('Gold line', (0, .47, 0), (skin(.47, 0) + .03, .045, BODY[2] * math.sqrt(1 - (.47 / BODY[1]) ** 2) + .03), m['gold'], 32, 6)
    ellipsoid('Nose windows', (0, .30, -2.52), (.40, .13, .30), m['navy'], 16, 8)
    ellipsoid('Nose cap', (0, -.04, -2.98), (.20, .19, .12), m['silver'], 12, 6)
    ellipsoid('Wing root', (0, -.30, .30), (1.05, .20, 1.15), m['cream'], 20, 8)
    pilot(m, 1.12, -1.55)
    ellipsoid('Beacon', (0, .80, .9), (.07, .06, .07), m['red'], 8, 6); ellipsoid('Tail cap', (0, .04, 3.0), (.13, .13, .12), m['dark'], 10, 6)
    for side in [-1, 1]:
        for i in range(8):
            z = -.08 + i * .33; ellipsoid('Window', (side * (skin(.26, z) - .012), .26, z), (.045, .12, .11), m['navy'], 10, 6)
        for i in range(3):
            z = -.95 + i * .30; ellipsoid('Upper window', (side * .555, .70, z), (.04, .08, .09), m['navy'], 8, 6)
        for z in [-.47, 2.5]:                                     # a door at each end, with a little window
            box('Door', (side * (skin(.06, z) - .035), .06, z), (.07, .62, .30), m['silver'], .03); ellipsoid('Door window', (side * (skin(.2, z) + .006), .2, z), (.03, .07, .07), m['navy'], 8, 6)
        lettering('VIAAN AIR', (side * (skin(-.06, -1.36) + .012), -.06, -1.36), .2, m['navy'], side, turn=.115)   # ahead of the wing, where it can be read
        box('Main wing', (side * 1.8, -.2, .3), (3.3, .16, 1.15), m['cream'], .12, yaw=-side * .30)
        box('Wing flap', (side * 1.72, -.2, .93), (2.3, .1, .28), m['silver'], .04, yaw=-side * .30)
        box('Winglet', (side * 3.37, .0, .86), (.09, .46, .50), m['coral'], .04, yaw=-side * .30, lean=side * .25, tilt=.3)
        ellipsoid('Wing light', (side * 3.34, -.19, .30), (.07, .06, .07), m['red' if side < 0 else 'green'], 8, 6)
        # Two engines under each wing: a painted pod with a silver lip, a spinner in its mouth and a dark tail pipe.
        for x, z, big in [(1.25, -.06, 1), (2.32, .36, .84)]:
            tube('Engine', (side * x, -.56, z), .36 * big, .28 * big, 1.2 * big, m['coral']); tube('Engine lip', (side * x, -.56, z - .62 * big), .37 * big, .385 * big, .12 * big, m['silver'])
            ellipsoid('Engine mouth', (side * x, -.56, z - .62 * big), (.30 * big, .30 * big, .07), m['dark'], 16, 6); tube('Spinner', (side * x, -.56, z - .68 * big), .02, .13 * big, .22 * big, m['gold'], 12)
            tube('Tail pipe', (side * x, -.56, z + .72 * big), .22 * big, .1 * big, .32 * big, m['dark'], 12); box('Engine arm', (side * x, -.33, z + .15), (.12, .26, .6 * big), m['cream'], .04)
        box('Tail wing', (side * .78, .32, 2.62), (1.5, .12, .72), m['cream'], .1, yaw=-side * .30)
        ellipsoid('Tail badge', (side * .08, 1.02, 2.62), (.02, .27, .27), m['gold'], 16, 8)
        # Main wheels in pairs, one behind the other.
        box('Leg', (side * .55, -.64, .5), (.1, .32, .12), m['silver'], .03); box('Wheel beam', (side * .62, -.78, .5), (.08, .08, .5), m['silver'], .02)
        for z in [.3, .7]: wheel((side * .64, -.78, z), .22, m['dark'])
        wheel((side * .11, -.82, -1.9), .18, m['dark'])
    box('Tail fin', (0, 1.02, 2.5), (.15, 1.6, 1.0), m['coral'], .14, tilt=.3)
    box('Tail stripe', (0, 1.5, 2.66), (.165, .16, .96), m['gold'], .03, tilt=.3)
    box('Leg', (0, -.64, -1.9), (.09, .34, .1), m['silver'], .03)
    save('jumbo-plane'); picture('plane-jumbo', 1.5)

# ---------- Zippy Jet: small, pointed and quick ----------
if want('zippy'):
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
if want('toy'): bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'toy-plane.blend')); picture('plane-toy', 1.05)
print('Done:', ', '.join(ONLY) or 'everything')
