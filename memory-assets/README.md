# Little Friends artwork

Twelve original clay-style animals for `../memory.html`, built from procedural
Blender meshes. No stock artwork or downloaded models are used.

- `*.png`: 512 × 512 transparent card illustrations, rendered with Cycles.
- `little-friends.blend`: editable scene containing all twelve animal collections,
  materials, camera and softbox lighting. Bear is visible on opening the file.
- `build_animals.py`: rebuilds the scene and renders all twelve images.

From the repository root, with Blender on PATH:

```sh
blender --background --factory-startup --python memory-assets/build_animals.py
```

Runtime needs only the PNG files. The scene and generator are included for future
art changes. Animal identifiers are mapped in `ANIMALS` in `memory.html`.
