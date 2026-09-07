# Little Pilot

A forgiving 3D airline playground for Viaan, with original Blender models and three
island airports. Choose a destination, load a suitcase, welcome an animal passenger,
take off, and bring them safely to their holiday. Sunny Island welcomes Panda,
Snowy Mountain welcomes Penguin, and Jungle Bay welcomes Frog.

## Play locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/sky-playground/`. The home Planes card and Daily Adventure
plane reward open this game. The old `plane.html` URL redirects here.
No build, account, API key, or network asset service is required. Serve through HTTP;
browser security prevents GLB loading from a `file://` page. Requires WebGL 2.

## Controls and journeys

- Pick one of the other two islands at the airport. Load the suitcase, welcome the
  passenger, then tap **Take off**. Each arrival opens boarding at the new airport.
- Drag on the sky to steer; move up to climb and release to level out. Arrow keys or
  WASD also steer. The plane avoids terrain and mapped trees/buildings.
- **Slow**, **Cruise**, and **Fast** change free steering speed. Guidance slows down
  for accurate turns. The speed readout and engine pitch follow the plane's speed.
- **Guide me** flies toward your destination. Steering takes control back during
  flight. Reaching the destination marker starts the runway approach.
- **Land** offers **I'll steer · with helping wings**, or **Land for me**.
  The approach first aligns the plane; on the final glide, helping wings narrow the
  steering corridor for a safe touchdown. **Land for me** can take over mid-glide.
- **Keep flying** or steering cancels the approach before final descent. Passenger
  flights land at their destination; free exploration uses the nearest airport.
- Every completed passenger trip earns a passport visit. Stamps and the trip count
  save locally under `viaan-airline-v1`; other games' learner progress is untouched.
- **Just fly & explore** skips boarding. **Bear's picnic adventure** retains the
  original five golden rings, picnic delivery, landing, and free flight.
- Pause and How to fly stop the simulation. Changing tabs or losing focus also pauses.
- Sound starts muted. The music-note button enables a quiet engine, chimes, and
  optional device speech. Play works without sound or speech support.

## Art and implementation

`assets/toy-plane.blend` and the three `*-island.blend` files are editable native
Blender sources. Their GLB exports are loaded at runtime. The original island and
plane are reproduced with:

```sh
blender --background --factory-startup --python sky-playground/tools/build_assets.py
blender --background --factory-startup --python sky-playground/tools/build_destinations.py
```

The second script derives snowy and jungle material variants from Sunny Island.
They share geometry and local obstacle coordinates, translated per airport. If
moving buildings or trees, update `assets/obstacles.json` to match. The analytic
terrain formula in `flight.js` matches the original asset generator.

`game.js` owns the scene, input, mission, camera, sound, and lifecycle. `flight.js`
contains flight rules. `airline.js` owns airport coordinates, boarding transitions,
passport validation, and assisted landing rules. Animal portraits reuse the local
`memory-assets/` artwork. Three.js 0.180.0 is vendored under its MIT license
(`vendor/THREE-LICENSE.txt`); GLTFLoader uses a local BufferGeometryUtils import.
Native Blender sources are not fetched by the browser.

## Verification

```sh
node --test curriculum.test.mjs chess.test.mjs memory.test.mjs sky-playground/*.test.mjs
```

Tests cover all six inter-airport routes at every speed, runway alignment and
rollout, takeoff, steering effects and safe touchdown at 20–120 Hz, world terrain
and obstacle clearance, boundaries, passport validation, boarding order, pause and
resume, mid-glide takeover, original picnic availability, and GLB integrity.
Controller tests run the actual game logic with a minimal DOM/scene harness.
Browser checks should cover complete passenger trips, saved passport reload,
manual steering, landing choice, and portrait/landscape layouts.
