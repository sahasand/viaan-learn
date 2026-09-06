"""Original Sky Playground assets. Run with Blender --background --python this_file."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1] / 'assets'
bpy.context.preferences.filepaths.save_version = 0
random.seed(17)

def clean():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.7):
    color = tuple(c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in color)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color,1)
    bs.inputs['Roughness'].default_value = roughness
    return m

def pos(v): return (v[0], -v[2], v[1])
def finish(o,name,mat):
    o.name=name
    o.data.materials.append(mat)
    return o

def ellipsoid(name, p, size, mat, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos(p))
    o=bpy.context.object
    o.scale=(size[0],size[2],size[1])
    finish(o,name,mat)
    for poly in o.data.polygons: poly.use_smooth=True
    return o

def box(name,p,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos(p))
    o=bpy.context.object; o.scale=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft toy edges','BEVEL'); mod.width=bevel; mod.segments=3
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for f in o.data.polygons: f.use_smooth=True
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,mat)

def cone(name,p,r1,r2,depth,mat,vertices=10):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=pos(p))
    return finish(bpy.context.object,name,mat)

def terrain(x,z):
    a=math.atan2(z/72,x/90)
    r=math.sqrt((x/90)**2+(z/72)**2)/(1+.055*math.sin(a*3)+.035*math.cos(a*7))
    if r>=1.04: return -.8
    beach=max(-.8,min(2.5,(1.04-r)*24))
    hills=22*math.exp(-((x+23)**2/420+(z+19)**2/300))+10*math.exp(-((x-40)**2/270+(z+18)**2/350))
    return beach+hills*max(0,min(1,(1-r)*5))

def export(name,join=False):
    if join:
        groups={}
        for o in list(bpy.context.scene.objects):
            if o.type=='MESH':
                key=o.data.materials[0].name
                groups.setdefault(key,[]).append(o)
        for name_,objects in groups.items():
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects:o.select_set(True)
            bpy.context.view_layer.objects.active=objects[0]
            bpy.ops.object.join(); bpy.context.object.name=name_
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(ROOT/(name+'.glb')),export_format='GLB',export_cameras=False,export_lights=False)

clean()
coral=material('Coral enamel',(.94,.20,.12),.32)
cream=material('Warm ivory',(.99,.91,.69),.5)
gold=material('Marigold', (1,.60,.08),.38)
navy=material('Deep teal',(.025,.15,.20),.38)
glass=material('Blue windscreen',(.22,.67,.79),.2)
brown=material('Pilot bear',(.48,.25,.12))
dark=material('Soft charcoal',(.035,.055,.06))
ellipsoid('Fuselage',(0,0,0),(.58,.53,1.85),coral,24,12)
ellipsoid('Nose',(0,.03,-1.55),(.48,.44,.50),cream)
box('Main wing',(0,-.13,-.08),(4.85,.17,.88),cream,.18)
for side in [-1,1]:
    box('Coral wingtip',(side*2.20,-.11,-.08),(.52,.21,.91),coral,.12)
    box('Wing racing stripe',(side*1.85,-.015,-.08),(.14,.026,.78),gold,.02)
box('Tail wings',(0,.13,1.35),(1.85,.13,.56),cream,.14)
box('Tail fin',(0,.55,1.3),(.13,1.12,.66),coral,.15)
box('Tail stripe',(0,.72,1.34),(.145,.17,.53),cream,.03)
ellipsoid('Cockpit',(0,.43,.20),(.40,.19,.65),navy)
ellipsoid('Windshield',(0,.59,-.20),(.37,.27,.23),glass)
ellipsoid('Pilot',(0,.62,.32),(.22,.25,.22),brown)
for side in [-1,1]:
    ellipsoid('Pilot ear',(side*.19,.77,.34),(.09,.09,.07),brown)
    ellipsoid('Goggle',(side*.09,.67,.115),(.08,.06,.028),cream)
    ellipsoid('Lens',(side*.09,.67,.088),(.06,.04,.016),navy)
    box('Undercarriage',(side*.42,-.58,-.25),(.09,.4,.1),navy,.04)
    wheel=cone('Wheel',(side*.49,-.77,-.25),.23,.23,.15,dark,16)
    wheel.rotation_euler[1]=math.pi/2
ellipsoid('Spinner',(0,.035,-2.00),(.17,.17,.25),gold)
prop=bpy.data.objects.new('Propeller',None);bpy.context.collection.objects.link(prop); prop.location=pos((0,.035,-1.98))
for ang in [0,math.pi/2]:
    o=box('Prop blade',(0,.035,-1.98),(.14,1.48,.07),navy,.065)
    o.rotation_euler[1]=ang
    o.parent=prop; o.matrix_parent_inverse=prop.matrix_world.inverted()
export('toy-plane')

clean()
sand=material('Peach sand',(.91,.75,.44))
obstacles=[]
grass=[material('Meadow '+str(i),c) for i,c in enumerate([(.42,.65,.27),(.49,.70,.31),(.55,.73,.35),(.38,.60,.25)])]
stone=material('Warm rock',(.55,.57,.43))
wood=material('Cinnamon wood',(.42,.25,.13))
leaves=[material('Leaf '+str(i),c) for i,c in enumerate([(.12,.39,.22),(.19,.48,.26),(.29,.55,.28)])]
roof=material('Terracotta roofs',(.85,.26,.15))
wall=material('Buttercream walls',(.98,.87,.64))
white=material('Chalk',(.99,.96,.83))
blue=material('Pool blue',(.15,.58,.62))
runway=material('Runway',(.25,.34,.31))

verts=[];faces=[];n=80;nr=24
for j in range(nr+1):
    rr=.001+(j/nr)*1.04
    for i in range(n):
        a=i/n*math.tau
        shape=1+.055*math.sin(a*3)+.035*math.cos(a*7)
        x=math.cos(a)*90*rr*shape;z=math.sin(a)*72*rr*shape
        verts.append(pos((x,terrain(x,z),z)))
for j in range(nr):
    for i in range(n):
        a=j*n+i;b=j*n+(i+1)%n;c=(j+1)*n+i;d=(j+1)*n+(i+1)%n
        faces.extend([(a,b,c),(b,d,c)])
mesh=bpy.data.meshes.new('Sculpted island');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('Island',mesh);bpy.context.collection.objects.link(obj)
for m in [sand]+grass:mesh.materials.append(m)
for poly in mesh.polygons:
    rad=sum(math.sqrt((verts[v][0]/90)**2+(verts[v][1]/72)**2) for v in poly.vertices)/3
    poly.material_index=0 if rad>.92 else random.randrange(1,5)

# A small airfield on the flat south coast. World coords: x right, y up, z south.
box('Airstrip',(22,2.65,38),(12,.18,44),runway,.2)
for z in range(20,58,6):box('Runway dash',(22,2.76,z),(.45,.025,2.8),white)
for x in [17.5,19,20.5,23.5,25,26.5]:box('Threshold',(x,2.77,56),(.65,.025,3),white)
box('Hangar',(40,5,43),(12,5,11),wall,.5)
box('Hangar roof',(40,7.6,43),(13,.7,12),roof,.4)
box('Hangar door',(40,4.5,37.42),(7,3.6,.1),blue,.4)
box('Tower',(35,7.3,31),(3,9.4,3),wall,.3)
box('Tower glass',(35,12.3,31),(4.6,2.1,4.6),blue,.25)
box('Tower roof',(35,13.5,31),(5.1,.4,5.1),cream,.2)
obstacles.extend([{'x':40,'z':43,'radius':8.5,'top':8}, {'x':35,'z':31,'radius':3.5,'top':13.8}])
cone('Windsock pole',(12,5,54),.08,.08,5,white)
sock=cone('Windsock',(13.3,7.4,54),.45,.23,2.5,coral);sock.rotation_euler[1]=math.pi/2

for i in range(135):
    x=random.uniform(-79,79);z=random.uniform(-61,61);h=terrain(x,z)
    if h<2.1 or (8<x<52 and 13<z<64) or (x+52)**2+(z-15)**2<180:continue
    scale=random.uniform(.7,1.25)
    obstacles.append({'x':x,'z':z,'radius':1.7*scale,'top':h+5.5*scale})
    cone('Tree trunk',(x,h+1.3*scale,z),.24*scale,.17*scale,2.6*scale,wood,7)
    if i%3:
        for dy,rr in [(2.1,1.5),(3.15,1.12),(4.1,.72)]:
            cone('Pine crown',(x,h+dy*scale,z),rr*scale,.05,2.5*scale,leaves[i%3],7)
    else:
        ellipsoid('Round crown',(x,h+3*scale,z),(1.6*scale,2*scale,1.5*scale),leaves[i%3],9,5)

for x,z in [(-48,29),(-60,22),(-61,35),(-46,43),(-34,37)]:
    h=terrain(x,z)
    obstacles.append({'x':x,'z':z,'radius':4,'top':h+5.2})
    box('Village house',(x,h+1.6,z),(5,3.2,5),wall,.2)
    o=cone('Village roof',(x,h+3.9,z),4.2,0,2.4,roof,4);o.rotation_euler[2]=math.pi/4
    box('Village door',(x,h+.95,z+2.52),(1.1,1.9,.06),wood,.08)
    box('Window',(x+1.5,h+1.9,z+2.53),(.8,.8,.07),blue,.08)

# Lighthouse on the north-west shore.
x,z=-62,-35;h=terrain(x,z)
obstacles.append({'x':x,'z':z,'radius':2.2,'top':h+12.6})
cone('Lighthouse',(x,h+5,z),2,1.35,10,white,16)
cone('Lighthouse stripe',(x,h+6,z),1.67,1.54,2,coral,16)
cone('Lantern',(x,h+10.7,z),1.65,1.65,1.7,glass,12)
cone('Lantern roof',(x,h+12,z),2.1,0,1.2,roof,12)

# Bear's picnic clearing: big welcoming bear, blanket, basket and balloons.
x,z=-52,15;h=terrain(x,z)
box('Picnic blanket',(x,h+.12,z),(6,.08,5),coral,.1)
for dx in [-2,0,2]:box('Blanket checks',(x+dx,h+.18,z),(.7,.035,4.8),cream)
ellipsoid('Bear body',(x,h+1.2,z-3),(.8,1.1,.65),brown)
ellipsoid('Bear head',(x,h+2.4,z-3),(.85,.75,.7),brown)
for side in [-1,1]:
    ellipsoid('Bear ear',(x+side*.61,h+3,z-3),(.30,.30,.22),brown)
    ellipsoid('Bear eye',(x+side*.27,h+2.5,z-2.34),(.075,.1,.04),dark)
ellipsoid('Bear muzzle',(x,h+2.18,z-2.35),(.43,.30,.22),cream)
ellipsoid('Bear nose',(x,h+2.35,z-2.16),(.13,.10,.07),dark)
box('Basket',(x+2,h+.6,z),(1.2,1,1),wood,.2)

for i in range(30):
    a=random.random()*math.tau;r=random.uniform(.93,1.02)
    x=math.cos(a)*90*r;z=math.sin(a)*72*r
    ellipsoid('Coastal rock',(x,max(.2,terrain(x,z)),z),(random.uniform(.7,2),1.3,1.5),stone,8,4)
export('sunny-island',join=True)
(ROOT/'obstacles.json').write_text(json.dumps(obstacles))
print('Finished original Blender assets:',ROOT)
