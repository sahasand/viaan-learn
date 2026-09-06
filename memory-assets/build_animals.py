"""Original Little Friends clay characters. Blender background script; no downloaded art."""
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
M={k:mat(k,v) for k,v in dict(cream='FFF2CF',white='F8F5E8',brown='B98152',dark='503B31',black='293739',pink='EAA597',orange='EAA454',yellow='F5C15F',mint='8CB978',green='547E54',blue='8BAFB8',gray='A9BABD',red='CB785B',gold='C79852').items()}
active=None
def ball(name,p,s,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.data.materials.append(M[color])
    for f in o.data.polygons:f.use_smooth=True
    for c in list(o.users_collection):c.objects.unlink(o)
    active.objects.link(o)
    return o
def eyes(z=1.95,y=-.65,spread=.29,scale=1):
    for side in [-1,1]:
        ball('Bright eye',(side*spread,y,z),(.078*scale,.055*scale,.105*scale),'black')
        ball('Eye sparkle',(side*spread-.02,y-.047*scale,z+.035*scale),(.026*scale,.022*scale,.029*scale),'white')
def cheeks(z=1.72,y=-.68,spread=.46):
    for side in [-1,1]:ball('Rosy cheek',(side*spread,y,z),(.13,.03,.07),'pink')
def body(color='brown',belly='cream'):
    ball('Little body',(0,.04,.75),(.57,.42,.70),color)
    ball('Soft belly',(0,-.34,.77),(.40,.10,.45),belly)
    for side in [-1,1]:
        ball('Foot',(side*.31,-.09,.19),(.25,.32,.18),color)
        arm=ball('Arm',(side*.55,-.03,.88),(.19,.21,.40),color);arm.rotation_euler[1]=side*-.35
def head(color):return ball('Big friendly head',(0,-.03,1.86),(.75,.65,.69),color)
def ears(color,inner='pink',long=False):
    for side in [-1,1]:
        ball('Ear',(side*.57,.01,2.40),(.27,.21,.42 if long else .29),color)
        ball('Inner ear',(side*.57,-.19,2.43),(.16,.05,.27 if long else .17),inner)
def muzzle():
    ball('Muzzle',(0,-.60,1.66),(.35,.17,.23),'cream')
    ball('Nose',(0,-.77,1.78),(.115,.065,.08),'dark')
def build(name):
    global active
    active=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(active)
    if name in ['bear','dog','cat','panda','lion']:
        color={'bear':'brown','dog':'cream','cat':'orange','panda':'white','lion':'yellow'}[name]
        body(color);head(color)
        if name=='lion':
            for i in range(12):
                a=i/12*math.tau;ball('Fluffy mane',(math.sin(a)*.71,.09,1.90+math.cos(a)*.66),(.29,.29,.30),'brown')
        if name=='cat':
            for side in [-1,1]:
                ear=ball('Pointed ear',(side*.50,.03,2.43),(.24,.22,.38),'orange');ear.rotation_euler[1]=side*.3
                ball('Ear inset',(side*.50,-.17,2.43),(.13,.035,.23),'pink')
            for x in [-.24,0,.24]:ball('Forehead stripe',(x,-.49,2.27),(.065,.04,.16),'brown')
        elif name=='dog':
            for side in [-1,1]:ball('Floppy ear',(side*.73,.00,1.93),(.27,.31,.59),'brown')
            ball('Eye patch',(.28,-.55,1.95),(.22,.105,.26),'brown')
        else:ears('black' if name=='panda' else color,'dark' if name=='panda' else 'pink')
        if name=='panda':
            for side in [-1,1]:ball('Panda patch',(side*.30,-.56,1.96),(.22,.11,.24),'black')
            for side in [-1,1]:ball('Panda foot',(side*.31,-.10,.20),(.255,.33,.19),'black')
        eyes();muzzle();cheeks()
    elif name=='elephant':
        body('gray','blue')
        for side in [-1,1]:
            ball('Elephant ear',(side*.78,.05,1.95),(.51,.20,.67),'gray')
            ball('Pink ear',(side*.80,-.13,1.95),(.33,.06,.46),'pink')
        head('gray');eyes(y=-.64,spread=.32)
        ball('Trunk',(0,-.63,1.37),(.21,.24,.62),'gray')
        ball('Trunk tip',(0,-.83,.95),(.23,.23,.19),'gray');cheeks(spread=.5)
    elif name=='giraffe':
        body('yellow');ball('Neck',(0,0,1.65),(.29,.29,.80),'yellow')
        ball('Giraffe head',(0,-.10,2.50),(.58,.48,.51),'yellow')
        for side in [-1,1]:
            o=ball('Giraffe ear',(side*.62,.01,2.66),(.29,.14,.17),'yellow');o.rotation_euler[1]=side*-.4
            ball('Horn',(side*.27,.02,3.03),(.06,.06,.27),'yellow')
            ball('Horn tip',(side*.27,.02,3.25),(.12,.11,.11),'brown')
        ball('Giraffe muzzle',(0,-.45,2.30),(.41,.22,.24),'cream');eyes(z=2.62,y=-.54,spread=.24)
        for side in [-1,1]:
            for z in [.7,1.05,1.6,1.95]:ball('Giraffe spot',(side*.26,-.25,z),(.10,.05,.12),'brown')
    elif name=='frog':
        body('mint');ball('Frog head',(0,-.04,1.68),(.81,.59,.51),'mint')
        for side in [-1,1]:
            ball('Eye bump',(side*.44,-.15,2.09),(.33,.31,.33),'mint')
            ball('Eye white',(side*.44,-.43,2.11),(.23,.10,.23),'cream')
        eyes(z=2.14,y=-.54,spread=.44,scale=1.25);cheeks(z=1.65,y=-.6)
        ball('Smile',(0,-.613,1.50),(.25,.025,.035),'green')
    elif name=='turtle':
        ball('Shell',(0,.10,1.00),(.78,.57,.86),'green')
        ball('Turtle tummy',(0,-.41,.95),(.53,.14,.61),'cream')
        for side in [-1,1]:
            ball('Turtle foot',(side*.54,-.12,.23),(.30,.30,.19),'mint')
            ball('Turtle arm',(side*.70,-.17,1.04),(.22,.24,.38),'mint')
        ball('Turtle head',(0,-.18,1.94),(.58,.53,.55),'mint');eyes(z=2.01,y=-.70,spread=.24);cheeks(z=1.80,y=-.68,spread=.37)
        for z in [.7,1.0,1.3]:ball('Belly plate',(0,-.56,z),(.34,.015,.025),'gold')
    elif name=='duck':
        body('yellow');head('yellow');eyes(y=-.64)
        ball('Duck bill',(0,-.72,1.64),(.39,.32,.12),'orange')
        for side in [-1,1]:ball('Webbed foot',(side*.29,-.17,.16),(.28,.40,.12),'orange')
        cheeks()
    elif name=='owl':
        body('brown');head('brown')
        for side in [-1,1]:
            ball('Owl face disc',(side*.30,-.50,1.93),(.36,.18,.39),'cream')
            ball('Owl ear tuft',(side*.54,.05,2.47),(.17,.19,.34),'brown')
        eyes(z=1.99,y=-.70,scale=1.55)
        ball('Beak',(0,-.72,1.74),(.13,.13,.19),'orange')
        for z in [.60,.87,1.11]:
            for side in [-1,1]:ball('Feather dots',(side*.19,-.445,z),(.07,.025,.09),'gold')
    elif name=='penguin':
        body('black','white');head('black')
        for side in [-1,1]:ball('White face',(side*.26,-.49,1.91),(.33,.17,.42),'white')
        eyes(z=1.99,y=-.68,spread=.25);ball('Beak',(0,-.70,1.73),(.17,.20,.12),'orange')
        for side in [-1,1]:ball('Orange foot',(side*.31,-.13,.19),(.26,.36,.14),'orange')
        cheeks(y=-.66)
    return active
names=['dog','cat','bear','panda','elephant','giraffe','lion','frog','turtle','duck','owl','penguin']
collections=[build(n) for n in names]
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.compression=85
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.86,.82,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='AgX'
def light(name,p,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=p;obj.rotation_euler=(Vector((0,0,1.5))-obj.location).to_track_quat('-Z','Y').to_euler()
light('Large softbox',(-3,-4,7),450,5);light('Warm fill',(4,-1,4),260,4);light('Rim',(0,4,6),450,3)
data=bpy.data.cameras.new('Portrait camera');cam=bpy.data.objects.new('Portrait camera',data);scene.collection.objects.link(cam)
cam.location=(3,-10,4.1);cam.rotation_euler=(Vector((0,0,1.60))-cam.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=3.8;scene.camera=cam
for c in collections:c.hide_render=True;c.hide_viewport=True
for name,c in zip(names,collections):
    c.hide_render=False;c.hide_viewport=False
    scene.render.filepath=str(ROOT/(name+'.png'));bpy.ops.render.render(write_still=True)
    c.hide_render=True;c.hide_viewport=True
collections[2].hide_render=False;collections[2].hide_viewport=False
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'little-friends.blend'))
print('Rendered twelve original characters')
