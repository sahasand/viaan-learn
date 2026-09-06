# Little Pilot

A forgiving 3D flying playground for Viaan. Original Blender models, a tiny island,
five golden rings, a picnic delivery, assisted runway landings, and endless free flight.

## Play locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/sky-playground/`. The home screen's Planes card and the
Daily Adventure plane reward now open this game. The old `plane.html` URL redirects here; Plane Factory has been replaced.
No build, account, API key, or network asset service is required. Serve through HTTP;
browser security prevents GLB loading from a `file://` page.

## Controls

- Drag anywhere on the sky to steer. Move up to climb. Release to level out.
- Arrow keys or WASD also steer.
- **Guide me** flies toward the next ring or delivery. Steering takes control back.
- **Land** routes around to the airport, lines up with the runway, descends, and rolls
  to a stop. **Keep flying** or steering cancels the approach before final descent.
- **Take off again** accelerates down the runway and climbs back into the sky. Landing
  during the picnic adventure keeps your ring progress. Completing the picnic sends
  the plane back to the airport automatically, then unlocks free exploration.
- In free flight, **Guide me** also returns to the airport for a landing.
- The plane avoids terrain and mapped trees/buildings and turns back near the island boundary.
- Pause and How to fly stop the simulation. Changing tabs or losing focus also pauses.
- Sound starts muted; the music-note button enables a quiet engine, chimes, and optional
  device-provided speech. Flight works without sound or speech support.

## Art and implementation

`assets/toy-plane.blend` and `assets/sunny-island.blend` are editable native Blender
files. Their GLB exports are loaded at runtime. The models were created specifically
for this game; `tools/build_assets.py` reproduces them in a fresh background Blender
process without changing an open Blender document:

```sh
blender --background --factory-startup --python sky-playground/tools/build_assets.py
```

The script also exports `assets/obstacles.json` for terrain-safe flight. If editing
the island by hand, update that data to match moved buildings and trees. The analytic
terrain formula in `flight.js` matches the source in the asset generator.

`game.js` owns the scene, input, mission, camera, sound, and lifecycle. `flight.js`
contains pure flight rules. All browser dependencies are vendored: Three.js 0.180.0
(MIT, `vendor/THREE-LICENSE.txt`). The only vendor change is GLTFLoader's local
BufferGeometryUtils import path. Native models are not fetched by the browser;
the runtime GLBs total about 1.2 MB.

## Verification

```sh
node --test sky-playground/flight.test.mjs
node --test chess.test.mjs memory.test.mjs
```

Flight tests cover runway alignment, touchdown/rollout, takeoff, controls, ground/obstacle clearance, island return, route completion
at 20–120 Hz, recovery of a missed ring, frame-gap clamping, and GLB integrity.
Browser checks should also cover drag release, pause/resume, the complete delivery,
free-flight takeoff, restart, and portrait/landscape layout. Requires WebGL 2.
