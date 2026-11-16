"""Three original destination variants from the existing Blender island.
Geometry stays aligned with obstacles.json and the shared analytic terrain.
Run with Blender background mode; no third-party art or live scene is changed.
Names after "--" build only those islands, for example: ... -- starry-island
"""
import bpy,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'assets'
PALETTES={
 'snowy-island':{'Meadow':(.77,.88,.92),'Leaf':(.34,.53,.59),'Warm rock':(.58,.70,.76),'Peach sand':(.88,.90,.86),'Terracotta roofs':(.30,.52,.66),'Buttercream walls':(.85,.91,.93)},
 'jungle-island':{'Meadow':(.19,.49,.23),'Leaf':(.06,.30,.15),'Warm rock':(.35,.48,.31),'Peach sand':(.92,.76,.43),'Terracotta roofs':(.92,.53,.22),'Buttercream walls':(.93,.82,.52)},
 'starry-island':{'Meadow':(.33,.31,.62),'Leaf':(.16,.52,.58),'Warm rock':(.42,.37,.58),'Peach sand':(.78,.74,.92),'Terracotta roofs':(.96,.50,.74),'Buttercream walls':(1,.86,.52)}
}
# Starlight Island is seen at night, so its trees and houses give off a little light of their own.
GLOW={'starry-island':{'Leaf':((.20,.95,.85),.55),'Buttercream walls':((1,.80,.40),1.6),'Terracotta roofs':((1,.45,.75),.35)}}
ONLY=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for name,palette in PALETTES.items():
 if ONLY and name not in ONLY:continue
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/'sunny-island.blend'))
 bpy.context.preferences.filepaths.save_version=0
 for m in bpy.data.materials:
  for prefix,color in palette.items():
   if m.name.startswith(prefix):
    m.diffuse_color=(*color,1)
    if m.use_nodes:m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*color,1)
  for prefix,(color,strength) in GLOW.get(name,{}).items():
   if m.name.startswith(prefix) and m.use_nodes:
    shader=m.node_tree.nodes.get('Principled BSDF').inputs
    (shader.get('Emission Color') or shader.get('Emission')).default_value=(*color,1);shader['Emission Strength'].default_value=strength
 # Snow-dusted tree tops use the upper vertices of the existing trees; no collision geometry changes.
 if name=='snowy-island':
  snow=bpy.data.materials.new('Soft snow');snow.diffuse_color=(.92,.97,1,1);snow.use_nodes=True
  snow.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.92,.97,1,1)
  for o in bpy.data.objects:
   if o.type=='MESH' and o.name.startswith('Leaf'):
    o.data.materials.append(snow)
    for face in o.data.polygons:
     if face.normal.z>.3:face.material_index=len(o.data.materials)-1
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/(name+'.blend')))
 bpy.ops.export_scene.gltf(filepath=str(ROOT/(name+'.glb')),export_format='GLB',export_cameras=False,export_lights=False)
print('Built',', '.join(n for n in PALETTES if not ONLY or n in ONLY))
