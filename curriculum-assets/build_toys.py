"""Original curriculum clay toys. Blender background script; no downloaded art."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
def mat(name,hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=.64
    return m
M={k:mat(k,v) for k,v in dict(cream='FFF2CF',white='F8F5E8',brown='B98152',dark='503B31',black='293739',pink='EAA597',orange='EAA454',yellow='F5C15F',mint='8CB978',green='547E54',blue='8BAFB8',gray='A9BABD',red='D6634A',gold='C79852').items()}
active=None
def ball(name,p,s,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.data.materials.append(M[color])
    for f in o.data.polygons:f.use_smooth=True
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o)
    return o

def cube(name,p,s,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(M[color]);mod=o.modifiers.new('Rounded clay edges','BEVEL');mod.width=.13;mod.segments=4
    o.modifiers.new('Soft normals','WEIGHTED_NORMAL')
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o);return o
def ring(name,p,major,minor,color,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,location=p,rotation=rot)
    o=bpy.context.object;o.name=name;o.data.materials.append(M[color])
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o)
def build(name):
    global active
    active=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(active)
    if name=='apple':
        for x in [-.3,.3]:ball('Apple',(x,0,1),(.65,.67,.76),'red')
        cube('Stem',(0,0,1.84),(.13,.13,.45),'brown');o=ball('Leaf',(.34,0,1.95),(.38,.09,.16),'green');o.rotation_euler[1]=-.4
    elif name=='car':
        cube('Car body',(0,0,.72),(2,.95,.62),'blue');cube('Cabin',(-.1,0,1.2),(1.12,.84,.68),'blue');cube('Window',(-.1,-.445,1.32),(.87,.035,.35),'cream')
        for x in [-.64,.64]:
            for y in [-.49,.49]:
                o=ball('Wheel',(x,y,.39),(.31,.15,.31),'black');ball('Hub',(x,y*1.28,.39),(.14,.035,.14),'cream')
        for y in [-.26,.26]:ball('Headlight',(1.01,y,.75),(.03,.14,.12),'yellow')
    elif name=='fish':
        ball('Fish',(0,0,1.1),(.87,.35,.51),'blue');o=ball('Tail',(-.92,0,1.1),(.44,.10,.42),'blue');o.rotation_euler[1]=math.pi/4
        ball('Fin',(0,-.30,1),(.28,.10,.20),'mint');ball('Eye',(.52,-.31,1.24),(.13,.04,.14),'white');ball('Pupil',(.55,-.35,1.25),(.065,.025,.08),'black')
    elif name in ['seed','sprout','flower','tree']:
        ball('Soil',(0,0,.34),(.82,.62,.23),'brown')
        if name=='seed':ball('Seed',(0,-.07,.65),(.28,.16,.39),'gold')
        else:
            cube('Stem',(0,0,.98),(.14,.14,1.3),'green')
            for x in [-1,1]:
                o=ball('Leaf',(x*.28,0,.9),(.37,.12,.15),'mint');o.rotation_euler[1]=-x*.45
            if name=='flower':
                for i in range(8):
                    a=i/8*math.tau;ball('Petal',(math.sin(a)*.44,-.02,1.88+math.cos(a)*.44),(.23,.12,.29),'yellow')
                ball('Flower middle',(0,-.15,1.88),(.28,.10,.28),'gold')
            if name=='tree':
                for x,z in [(-.48,1.65),(.48,1.65),(0,2.04),(0,1.6)]:ball('Tree crown',(x,0,z),(.59,.37,.6),'mint')
    elif name=='cup':
        cube('Cup',(0,0,.95),(1.12,.93,1.05),'blue');ball('Dark opening',(0,0,1.49),(.49,.40,.03),'dark');ring('Handle',(.7,0,1),.34,.095,'blue')
    elif name=='ball':
        ball('Ball',(0,0,1),(.84,.84,.84),'red');ball('Patch',(.4,-.62,1.35),(.38,.13,.34),'cream');ball('Patch',(-.5,-.57,.78),(.34,.14,.34),'blue')
    elif name=='cookie':
        ball('Cookie',(0,0,1),(.88,.19,.88),'gold')
        for x,z in [(-.35,1.3),(.28,1.55),(.43,.79),(-.19,.47),(0,1.02)]:ball('Chocolate',(x,-.19,z),(.12,.045,.10),'dark')
    elif name=='book':
        cube('Back cover',(0,.13,.9),(1.85,.18,1.6),'red');cube('Pages',(0,0,.92),(1.67,.25,1.45),'cream');cube('Cover',(0,-.20,.93),(1.85,.11,1.6),'red');cube('Book label',(0,-.27,1.1),(.85,.025,.63),'cream')
    elif name=='blocks':
        cube('Mint block',(-.48,0,.55),(.88,.88,.88),'mint');cube('Blue block',(.48,0,.55),(.88,.88,.88),'blue');cube('Gold block',(0,0,1.49),(.88,.88,.88),'yellow')
    elif name=='hat':
        ball('Brim',(0,0,.65),(1.05,.54,.15),'gold');cube('Hat',(0,.06,1.06),(1.25,.75,.8),'gold');cube('Band',(0,-.33,.92),(1.27,.04,.17),'red')
    elif name=='ice':cube('Ice cube',(0,0,1),(1.3,1.3,1.3),'blue');cube('Gleam',(-.28,-.66,1.19),(.13,.03,.54),'white')
    elif name=='cloud':
        for x,z,size in [(-.6,1,.47),(0,1.24,.64),(.63,1.05,.46),(0,.9,.5)]:ball('Cloud puff',(x,0,z),(size,.34,size),'white')
    elif name=='egg':ball('Egg',(0,0,1),(.59,.51,.82),'cream')
    return active
names=['apple','car','fish','seed','sprout','flower','tree','cup','ball','cookie','book','blocks','hat','ice','cloud','egg']
collections=[build(n) for n in names]
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.compression=85
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.86,.82,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX'
def light(name,p,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=p;obj.rotation_euler=(Vector((0,0,1.5))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Large softbox',(-3,-4,7),450,5);light('Warm fill',(4,-1,4),260,4);light('Rim',(0,4,6),450,3)
data=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',data);scene.collection.objects.link(cam)
cam.location=(3,-10,4.1);cam.rotation_euler=(Vector((0,0,1.20))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=3.0;scene.camera=cam
for c in collections:c.hide_render=True;c.hide_viewport=True
for name,c in zip(names,collections):
    c.hide_render=False;c.hide_viewport=False
    scene.render.filepath=str(ROOT/(name+'.png'));bpy.ops.render.render(write_still=True)
    c.hide_render=True;c.hide_viewport=True
collections[2].hide_render=False;collections[2].hide_viewport=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'learning-toys.blend'))
print('Rendered sixteen learning toys')
