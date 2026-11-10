"""Original Little Racer supercar. Run with:
blender --background --factory-startup --python little-racer/tools/build_car.py
Writes assets/supercar.blend, supercar.glb and the card render supercar.png.
Add `-- truck` or `-- formula` for the other vehicles, and `-- [model] side /tmp/out.png`
(or front, rear, top) for a check render from another angle.
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

def join_by_material():
    """Join every mesh by its first material; wheels are added afterwards so they can spin."""
    groups = {}
    for o in list(bpy.context.scene.objects):
        if o.type == 'MESH': groups.setdefault(o.data.materials[0].name, []).append(o)
    for name, objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join(); bpy.context.object.name = name + ' parts'

def wheel(name, side, x, z, radius, width=.30):
    x *= side; out = width / 2
    parts = [cylinder('tyre', (x, radius, z), radius, width, tyre, 'x', 36, min(.06, radius * .16)),
             cylinder('rim', (x + side * (out - .05), radius, z), radius * .70, .13, silver, 'x', 28, .015),
             cylinder('dish', (x + side * (out + .005), radius, z), radius * .60, .03, dark, 'x', 28),
             cylinder('cap', (x + side * (out + .035), radius, z), radius * .17, .04, silver, 'x', 14, .01)]
    for i in range(3):
        spoke = box('spoke', (x + side * (out + .02), radius, z), (.045, radius * 1.22, radius * .25), silver, .012)
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

def body_ring(z, w, floor, shoulder, centre):
    half = [(0, floor), (w * .78, floor), (w, floor + .10), (w, shoulder - .08), (w - .08, shoulder), (w * .5, (shoulder + centre) / 2), (0, centre)]
    return [(x, y, z) for x, y in half] + [(-x, y, z) for x, y in reversed(half[1:-1])]

def cabin_ring(z, wb, yb, wt, yt):
    return [(wb, yb, z), (wt, yt, z), (0, yt + .015, z), (-wt, yt, z), (-wb, yb, z), (0, yb, z)]

def cut_arches(body, wheels, margin, inner, depth):
    """Cut wheel arches out of a body; the cut faces take the dark material."""
    body.data.materials.append(dark)
    for x, z, radius in wheels:
        for side in (-1, 1):
            cutter = cylinder('cutter', (side * (inner + depth / 2), radius, z), radius + margin, depth, dark, 'x', 40)
            mod = body.modifiers.new('Arch', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cutter; mod.solver = 'EXACT'
            activate(body); bpy.ops.object.modifier_apply(modifier=mod.name)
            bpy.data.objects.remove(cutter, do_unlink=True)
    shade(body, 35)

def supercar():
    """A low, sharp-edged wedge: flat planes, hard creases and Y-shaped lights."""
    FRONT, REAR = (.95, -1.30, .31), (.98, 1.38, .39)      # wheel x, z, radius
    # (z, half width, floor, shoulder height, centre height). No smoothing: the flat facets are the style.
    stations = [
        (-2.30, .58, .21, .27, .28), (-2.12, .90, .15, .34, .35), (-1.72, 1.00, .14, .56, .47),
        (-1.30, 1.04, .14, .74, .61), (-.85, 1.01, .14, .68, .66), (-.25, .98, .14, .64, .66),
        (.45, 1.00, .14, .70, .72), (.95, 1.06, .15, .80, .78), (1.38, 1.09, .16, .88, .84),
        (1.90, 1.07, .18, .90, .86), (2.18, 1.03, .30, .88, .84), (2.28, .98, .42, .83, .80)]
    def ring(z, w, floor, shoulder, centre):
        half = [(0, floor), (w * .80, floor), (w * .97, floor + .09), (w, shoulder - .16), (w - .13, shoulder), (w * .46, (shoulder + centre) / 2), (0, centre)]
        return [(x, y, z) for x, y in half] + [(-x, y, z) for x, y in reversed(half[1:-1])]
    body = loft('Body', [ring(*s) for s in stations], paint)
    cut_arches(body, (FRONT, REAR), .075, .79, .67)
    shade(body, 24)

    # ---- cabin: the windscreen continues the line of the bonnet, the roof falls slowly to the tail ----
    # (z, base half width, base height, roof half width, roof height)
    CABIN = [(-1.38, .70, .50, .66, .60), (-.30, .88, .56, .56, 1.04), (.35, .90, .60, .58, 1.07), (1.30, .90, .70, .60, .96), (2.02, .86, .76, .66, .885)]
    cabin = loft('Cabin', [cabin_ring(*c) for c in CABIN], paint)
    modify(cabin, 'BEVEL', width=.022, segments=2); shade(cabin, 30)
    A, B, C, D, E = CABIN
    top = lambda c, side: (side * c[3], c[4], c[0])
    base = lambda c, side: (side * c[1], c[2] + .08, c[0])
    panel('Windscreen', [top(A, -1), top(A, 1), top(B, 1), top(B, -1)], glass, .06)
    panel('Rear glass', [top(C, -1), top(C, 1), top(D, 1), top(D, -1)], glass, .1)
    panel('Engine cover', [top(D, -1), top(D, 1), top(E, 1), top(E, -1)], dark, .1)
    for side in (-1, 1):
        panel('Quarter light', [base(A, side), base(B, side), top(B, side), top(A, side)], glass, .14)
        panel('Door glass', [base(B, side), base(C, side), top(C, side), top(B, side)], glass, .09)
        panel('Rear quarter', [base(C, side), base(D, side), top(D, side), top(C, side)], glass, .16)
    for i in range(5):
        t = .14 + i * .18
        box('Engine louvre', (0, D[4] + (E[4] - D[4]) * t + .03, D[0] + (E[0] - D[0]) * t), (.9, .03, .06), paint, .006, (-.1, 0, 0))

    def y_light(name, centre, side, mat, upright):
        """Three short bars meeting in a sideways Y, the lamp signature front and rear."""
        for angle, reach in ((0, .17), (2.2, .12), (-2.2, .12)):
            a = angle if side > 0 else math.pi - angle
            if upright:   # on the tail, drawn in the x-y plane
                box(name, (centre[0] + math.cos(a) * reach, centre[1] + math.sin(a) * reach, centre[2]), (reach * 2, .05, .04), mat, .008, (0, 0, a))
            else:         # on the bonnet, lying along the slope
                box(name, (centre[0] + math.cos(a) * reach, centre[1] + math.sin(a) * reach * .3, centre[2] - math.sin(a) * reach), (reach * 2, .022, .045), mat, .006, (0, a, 0))

    for side in (-1, 1):
        box('Lamp bed', (side * .66, .452, -1.86), (.46, .02, .30), dark, .006, (.3, side * -.25, 0))
        y_light('Headlamp', (side * .66, .478, -1.87), side, lamp, False)
        box('Nose intake', (side * .50, .225, -2.2), (.5, .11, .1), dark, .02, (0, side * -.2, 0))
        box('Side intake', (side * 1.05, .50, .86), (.08, .34, .66), dark, .03, (0, side * .13, 0))
        box('Sill intake', (side * 1.02, .25, .18), (.07, .13, .62), dark, .02)
        box('Door line', (side * 1.005, .40, -.3), (.025, .035, 1.05), dark, .006, (-.12, 0, 0))
        ellipsoid('Mirror', (side * .98, .78, -.62), (.12, .07, .09), paint)
        box('Mirror arm', (side * .88, .74, -.60), (.16, .03, .05), dark, .008)
        y_light('Tail lamp', (side * .60, .66, 2.305), side, tail, True)
        box('Wing support', (side * .56, .97, 2.02), (.05, .2, .16), dark, .01, (-.2, 0, 0))
        box('Wing end plate', (side * .96, 1.06, 2.07), (.04, .15, .42), paint, .01)
    box('Front splitter', (0, .125, -2.2), (1.56, .04, .26), dark, .01)
    box('Side skirts', (0, .13, .03), (2.16, .06, 2.1), dark, .015)
    box('Rear panel', (0, .64, 2.275), (1.86, .32, .05), dark, .015)
    box('Rear diffuser', (0, .31, 2.2), (1.72, .22, .3), dark, .015)
    for i in range(6): box('Diffuser fin', ((i - 2.5) * .28, .3, 2.3), (.03, .2, .2), silver, .005)
    cylinder('Exhaust', (0, .47, 2.31), .17, .12, silver, 'z', 6, .012)
    cylinder('Exhaust core', (0, .47, 2.36), .125, .03, dark, 'z', 6)
    box('Rear wing', (0, 1.075, 2.07), (1.9, .04, .38), paint, .012, (.08, 0, 0))
    join_by_material()
    wheel('Wheel_FL', -1, *FRONT); wheel('Wheel_FR', 1, *FRONT)
    wheel('Wheel_RL', -1, *REAR, .34); wheel('Wheel_RR', 1, *REAR, .34)

def truck():
    """A monster truck: tall pickup body on huge wheels."""
    wheels = ((1.16, -1.45, .66), (1.16, 1.45, .66))
    body = loft('Body', [body_ring(*s) for s in [
        (-2.30, .86, 1.12, 1.50, 1.52), (-2.14, 1.04, 1.04, 1.66, 1.70), (-1.10, 1.08, 1.02, 1.74, 1.78), (-.80, 1.08, 1.02, 1.76, 1.78),
        (.70, 1.08, 1.02, 1.76, 1.76), (2.10, 1.08, 1.04, 1.76, 1.76), (2.28, 1.02, 1.12, 1.70, 1.70)]], paint)
    modify(body, 'SUBSURF', levels=2, render_levels=2)
    cut_arches(body, wheels, .13, .74, .9)
    cab = [(-.92, 1.0, 1.66, .96, 1.78), (-.42, 1.02, 1.68, .82, 2.52), (.42, 1.02, 1.68, .84, 2.54), (.72, 1.0, 1.66, .9, 1.80)]
    cabin = loft('Cabin', [cabin_ring(*c) for c in cab], paint)
    modify(cabin, 'BEVEL', width=.06, segments=3); shade(cabin)
    A, B, C, D = cab
    top = lambda c, side: (side * c[3], c[4], c[0])
    base = lambda c, side: (side * c[1], c[2] + .12, c[0])
    panel('Windscreen', [top(A, -1), top(A, 1), top(B, 1), top(B, -1)], glass, .09)
    panel('Rear window', [top(C, -1), top(C, 1), top(D, 1), top(D, -1)], glass, .14)
    for side in (-1, 1):
        panel('Door glass', [base(B, side), base(C, side), top(C, side), top(B, side)], glass, .12)
        box('Headlamp', (side * .68, 1.5, -2.27), (.34, .2, .08), lamp, .03)
        box('Tail lamp', (side * .78, 1.5, 2.29), (.26, .2, .06), tail, .03)
        cylinder('Exhaust', (side * .92, 2.25, .98), .09, 1.3, silver, 'z', 16, .02).rotation_euler = (0, 0, 0)
        box('Step', (side * 1.12, .98, 0), (.16, .07, 1.4), silver, .02)
        box('Axle', (side * .6, .66, -1.45), (1.0, .16, .16), dark, .04); box('Axle', (side * .6, .66, 1.45), (1.0, .16, .16), dark, .04)
        box('Shock', (side * .78, .86, -1.45), (.1, .5, .1), silver, .03); box('Shock', (side * .78, .86, 1.45), (.1, .5, .1), silver, .03)
    for o in [o for o in bpy.context.scene.objects if o.name.startswith('Exhaust')]:
        o.rotation_euler = (math.pi / 2, 0, 0); activate(o); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    box('Chassis', (0, .9, 0), (1.3, .26, 3.9), dark, .05)
    box('Grille', (0, 1.42, -2.29), (.86, .34, .08), dark, .03)
    box('Bull bar', (0, 1.3, -2.42), (1.9, .1, .1), silver, .04); box('Bull bar', (0, 1.56, -2.42), (1.5, .08, .08), silver, .03)
    for x in (-.6, .6): box('Bull bar', (x, 1.38, -2.40), (.09, .5, .09), silver, .03)
    box('Bed liner', (0, 1.77, 1.42), (1.84, .04, 1.34), dark, .01)
    box('Roof bar', (0, 2.63, -.05), (1.5, .09, .14), dark, .03)
    for i in range(4): box('Roof lamp', ((i - 1.5) * .38, 2.66, -.14), (.24, .15, .08), lamp, .03)
    box('Rear bumper', (0, 1.14, 2.34), (1.9, .16, .12), silver, .04)
    join_by_material()
    for name, side, (x, z, radius) in (('Wheel_FL', -1, wheels[0]), ('Wheel_FR', 1, wheels[0]), ('Wheel_RL', -1, wheels[1]), ('Wheel_RR', 1, wheels[1])):
        wheel(name, side, x, z, radius, .56)

def formula():
    """An open-wheel formula racer with front and rear wings."""
    front, rear = (.98, -1.50, .33), (.98, 1.36, .37)
    body = loft('Body', [body_ring(*s) for s in [
        (-2.34, .10, .30, .36, .38), (-1.95, .18, .26, .42, .46), (-1.20, .30, .20, .52, .58), (-.45, .42, .16, .62, .68),
        (.50, .50, .16, .70, .84), (1.30, .44, .18, .62, .74), (1.95, .28, .24, .50, .56), (2.15, .18, .30, .44, .48)]], paint)
    modify(body, 'SUBSURF', levels=2, render_levels=2); shade(body, 40)
    for side in (-1, 1):
        pod = loft('Side pod', [body_ring(*s) for s in [(-.55, .30, .16, .40, .42), (-.2, .36, .16, .54, .56), (.9, .36, .16, .54, .54), (1.5, .26, .18, .40, .42)]], paint)
        modify(pod, 'SUBSURF', levels=2, render_levels=2); shade(pod, 40)
        pod.location.x = side * .68; activate(pod); bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        box('Pod intake', (side * .68, .36, -.56), (.5, .22, .06), dark, .02)
        box('Front end plate', (side * 1.0, .26, -2.18), (.04, .24, .46), paint, .012)
        box('Rear end plate', (side * .82, .82, 2.0), (.045, .62, .56), dark, .012)
        box('Mirror', (side * .5, .78, -.5), (.14, .06, .05), paint, .015)
        for z, reach in ((front[1], .22), (rear[1], .4)):
            box('Wishbone', (side * (reach + .98) / 2, .42, z - .12), (.98 - reach, .03, .05), dark, .01)
            box('Wishbone', (side * (reach + .98) / 2, .30, z + .12), (.98 - reach, .03, .05), dark, .01)
    box('Floor', (0, .13, .1), (1.5, .05, 3.0), dark, .012)
    box('Front wing', (0, .17, -2.2), (2.0, .04, .42), dark, .012)
    box('Front flap', (0, .25, -2.08), (1.9, .03, .2), paint, .01, (-.25, 0, 0))
    box('Cockpit', (0, .80, -.02), (.5, .1, .72), dark, .04)
    ellipsoid('Helmet', (0, .92, .06), (.2, .2, .22), lamp)
    box('Visor', (0, .94, -.1), (.3, .07, .1), dark, .03)
    ellipsoid('Air box', (0, 1.0, .62), (.2, .2, .44), paint)
    box('Air intake', (0, 1.04, .26), (.2, .16, .06), dark, .03)
    box('Engine fin', (0, .86, 1.3), (.05, .34, 1.0), paint, .015)
    box('Rear wing', (0, 1.1, 2.0), (1.62, .05, .46), paint, .015, (.12, 0, 0))
    box('Rear beam', (0, .62, 2.06), (1.6, .04, .28), dark, .012)
    box('Rain light', (0, .42, 2.19), (.1, .16, .05), tail, .02)
    for side in (-1, 1): cylinder('Exhaust', (side * .12, .5, 2.16), .06, .14, silver, 'z', 14, .01)
    join_by_material()
    wheel('Wheel_FL', -1, *front, .34); wheel('Wheel_FR', 1, *front, .34)
    wheel('Wheel_RL', -1, *rear, .42); wheel('Wheel_RR', 1, *rear, .42)

# Usage after "--": [model] [view out.png]; model is supercar, truck or formula.
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODEL = ARGS[0] if ARGS and ARGS[0] in ('supercar', 'truck', 'formula') else 'supercar'
if ARGS and ARGS[0] == MODEL: ARGS = ARGS[1:]
{'supercar': supercar, 'truck': truck, 'formula': formula}[MODEL]()

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / (MODEL + '.blend')))
bpy.ops.export_scene.gltf(filepath=str(ROOT / (MODEL + '.glb')), export_format='GLB', export_cameras=False, export_lights=False, export_apply=True)

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

AIM = 1.25 if MODEL == 'truck' else .5
def light(name, p, power, size):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'; data.size = size
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o)
    o.location = p; o.rotation_euler = (Vector((0, 0, AIM)) - o.location).to_track_quat('-Z', 'Y').to_euler()
light('Large softbox', (-4, -5, 7), 420, 6); light('Warm fill', (5, -2, 4), 180, 4); light('Rim', (0, 5, 6), 340, 3)
data = bpy.data.cameras.new('Portrait camera'); cam = bpy.data.objects.new('Portrait camera', data); scene.collection.objects.link(cam)
view = ARGS[0] if ARGS else 'card'
cam.location = {'card': (-6.5, 8.5, 3.6), 'rear': (5.5, -8.5, 3.4), 'side': (-11, 0, 1.2), 'front': (-2.5, 10, 2.2), 'top': (0, .01, 12)}[view]
cam.location.z += AIM - .5
cam.rotation_euler = (Vector((0, 0, AIM)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
data.type = 'ORTHO'; data.ortho_scale = 6.0 if MODEL == 'truck' else 5.0; scene.camera = cam
scene.render.filepath = str(ROOT / (MODEL + '.png')) if view == 'card' else str(Path(ARGS[1]))
bpy.ops.render.render(write_still=True)
