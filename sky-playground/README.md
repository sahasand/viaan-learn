# Little Pilot

A forgiving 3D airline playground for Viaan, with original Blender models and five
island airports. Choose a destination, load a suitcase, welcome an animal passenger,
take off, and bring them safely to their holiday. Sunny Island welcomes Panda,
Snowy Mountain welcomes Penguin, Jungle Bay welcomes Frog, and Starlight Island,
where it is always night, welcomes Owl. Big City, an island of towers to fly between,
welcomes Giraffe.

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

- The airport card shows one thing at a time. First a big ticket for each of the other
  four islands (one not yet visited says **New!**), with **My plane** and **Just fly**
  beneath. A chosen ticket opens boarding, which shows a single big button: load the
  suitcase, welcome the passenger, then **Take off**. **Pick another place** goes back.
  **My plane** is a page of its own and glows when the stars can buy something.
- Takeoff counts **3, 2, 1, Go!** as the plane rolls and lifts off.
- Big City is a large flat city on a waterfront, about three times the size of an island.
  A downtown of 38 towers stands inside a ring of 49 low houses, on a grid of streets with
  lane lines and zebra crossings, cars and buses on every street, Central Park with a pond,
  a harbour with a pier and boats, a Ferris wheel and a blimp. The airport is on the south
  shore, so landings come in over the harbour. Main Avenue runs north from the runway to
  the far shore, and every star trail in or out of the city follows it: a departure flies
  its whole length before it bends, and an arrival joins it at sea and flies down it. A
  tower is a wall: a plane below its top slides round it and is turned a little away.
  Houses are low and the plane is lifted over them, like trees on the islands.
- **City tour** (a button at every airport) is a flight that never leaves the city. It
  starts at City Airport wherever the plane was, follows a loop of stars up the avenue,
  west through downtown, down the west side, east past the airport, down the east side to
  the harbour and back to the runway, then lands. The plane is turned back at the city
  limits, the map zooms in to show the streets and the stars still to catch, and the
  autopilot can fly the whole loop.
- Flying toward Starlight Island the day turns to dusk and then night (`nightAt` in
  `airline.js`): the lights dim, the sea darkens, and stars, a sleepy moon, northern
  lights and drifting lanterns fade in. The island's trees and houses glow. Now and
  then a shooting star crosses ahead of the plane and the passenger makes a wish, for
  two stars. Flying away brings the day back. It has its own lullaby.
- Drag on the sky to steer; move up to climb and release to level out. Arrow keys or
  WASD also steer. The plane avoids terrain and mapped trees/buildings.
- **Slow**, **Cruise**, and **Fast** change free steering speed. Guidance slows down
  for accurate turns. The speed readout and engine pitch follow the plane's speed.
- The sky is full of things to find. A trail of stars starts straight ahead of the
  takeoff, bends gently toward the destination and runs to where the landing begins.
  Only one trail is in the sky at a time: the trip's own, or a round trip of the three
  islands when just flying (none over the picnic). Each island wears a ring of stars.
  Big stars (the middle and last of every trail, and one above each island's hill) are
  worth five, balloons pop for three, rainbow hoops give a three-second zoom, a puffy
  cloud gives two, and the first sight of the whale or the dolphins gives five.
  Every landing gives ten, and a passenger brought to the right island gives ten more.
  Everything returns at the next takeoff.
- Collecting is deliberately easy. Stars lean toward a nearby plane and jump to it from
  eleven units away, twice that while zooming. Reach is taller than it is wide because
  height is the hardest thing for a small pilot to judge, and a pilot who is not
  steering up or down is eased to the height of the nearest star ahead. A run of stars
  plays a rising scale and every eighth rains gold. The badge shows every star the pilot
  owns; stars are saved the moment they are earned, so leaving mid-flight loses nothing.
- Three round buttons use the rewards while flying. **Loop** (or T) rolls the plane.
  **Zoom** (or Z) is filled by stars: every six fill one of three zooms, and the plane
  takes off with one ready. The **toy** button (or Space) sets off the toy chosen in My
  plane: a honk, confetti, three fireworks, or a present on a parachute that lands with
  a thank-you or a splash. Toys are thrown ahead of the plane so they stay in view.
- A whale, dolphins, and puffy clouds to fly through are there to be discovered, and
  the passenger comments in a speech bubble.
- At the airport, **My plane** starts with three planes to choose from, all free: Little
  Prop (the toy propeller plane), Big Jumbo (a chunky passenger jet with an upper deck,
  four engines, winglets, rows of windows, doors and VIAAN AIR along its sides, seen from
  a little further back) and Zippy Jet (small and pointed, with a flame that grows with speed and
  stretches when zooming). They fly the same way; the jets whine where the propeller
  buzzes. The chosen plane is saved and its picture shows on the My plane button. Below
  the planes are colours, trails and toys. Locked ones show their price
  in stars; tapping one buys it when there are enough and otherwise says how many more
  are needed. Anything affordable glows, and the game says so in flight the moment the
  stars reach a price. Stars only come from flying. Choices save under `viaan-pilot-v1`.
- **Autopilot** flies the plane by itself and stays on, flight after flight, until its
  button is tapped again. With a passenger it follows the star trail forwards (joining
  it where the plane is, never turning back for a star), detours for a balloon or island
  star close ahead, then lines up and lands on its own. With nobody aboard it follows the
  round-trip trail from the island it left to the next one (Sunny, Snowy, Starlight,
  Jungle, Big City, and back to Sunny) and lands there. It loops after a hoop
  or a big star and zooms when all three zooms are full. Steering takes the stick only
  while the pilot steers; a moment after letting go the autopilot carries on, and
  steering never interrupts a landing it has begun. Choosing to steer the landing, or
  **Keep flying**, switches it off.
- While the autopilot flies, the passenger asks for a loop, a zoom or the toy every few
  seconds and that button pulses. Doing it within six seconds earns three stars.
- Reaching the destination marker starts the runway approach, with or without autopilot.
- **Land** offers **I'll steer · with helping wings**, or **Land for me**.
  The approach first aligns the plane; on the final glide, helping wings narrow the
  steering corridor for a safe touchdown. **Land for me** can take over mid-glide.
- **Keep flying** or (without autopilot) steering cancels the approach before final descent. Passenger
  flights land at their destination; free exploration uses the nearest airport.
- Every completed passenger trip earns a passport visit. Stamps and the trip count
  save locally under `viaan-airline-v1`; other games' learner progress is untouched.
- **Just fly & explore** skips boarding. **Bear's picnic adventure** retains the
  original five golden rings, picnic delivery, landing, and free flight.
- Pause and How to fly stop the simulation. Changing tabs or losing focus also pauses.
- Sound starts muted. The music-note button (in the top bar, and on the airport card,
  which covers the top bar) turns it on, and the choice is remembered: next time sound
  returns with the first tap. Each island has its own song, played softly without drums
  at the airport and in full in the air on the way there. There is a propeller engine,
  wind that grows with speed, a note for every star, pops, whooshes, a suitcase thump,
  a hello from each passenger, a cabin chime, a touchdown chirp, and optional device
  speech. Play works without sound or speech support.

## Art and implementation

`assets/toy-plane.blend` and the three `*-island.blend` files are editable native
Blender sources. Their GLB exports are loaded at runtime. The original island and
plane are reproduced with:

```sh
blender --background --factory-startup --python sky-playground/tools/build_assets.py
blender --background --factory-startup --python sky-playground/tools/build_destinations.py
blender --background --factory-startup --python sky-playground/tools/build_planes.py
```

The third script builds Big Jumbo and Zippy Jet in the toy plane's style and renders the
three `plane-*.png` pictures for the chooser; names after `--` (`jumbo`, `zippy`, `toy`)
build only those. A plane's paintable parts use the material
named `Coral enamel`; a propeller is the object named `Propeller` and a jet flame `Flame`.
A new plane also needs an entry in `PLANE_MODELS` in `sky.js` (passenger seat, trail
start, camera distance, engine sound).

The second script derives the snowy, jungle and starry material variants from Sunny
Island; island names after `--` build only those (`... -- starry-island`).
They share geometry and local obstacle coordinates, translated per airport. If
moving buildings or trees, update `assets/obstacles.json` to match. The analytic
terrain formula in `flight.js` matches the original asset generator.

Big City is the one place built in code, not Blender: `city.js` says where its streets,
towers and houses stand and where the City Tour goes (plain numbers, tested in Node), and
`cityscape.js` draws it. Its outline is `CITY` in `airline.js`. A building is kept off any
lot that a flight line passes too close to, so to move a street or the tour, change the
numbers in `city.js` and the buildings follow.

`game.js` owns the scene, input, mission, camera, sound, and lifecycle. `flight.js`
contains flight rules. `sky.js` holds the rules for stars, balloons, hoops, the star
trail the helping wing follows, and the saved pilot (stars, paints, trails). `fx.js`
draws that playful layer: sky gradient, collectables, particles, sea friends, runway
fans, plane paint, trails and the loop. `tunes.js` synthesizes the engine, music and
effects on the game's audio context, through a limiter so it carries on a phone speaker. `game.js` only calls `fx.js` and `tunes.js` through optional
hooks, so the controller tests run without them. `airline.js` owns airport coordinates, boarding transitions,
passport validation, and assisted landing rules. Animal portraits reuse the local
`memory-assets/` artwork. Three.js 0.180.0 is vendored under its MIT license
(`vendor/THREE-LICENSE.txt`); GLTFLoader uses a local BufferGeometryUtils import.
Native Blender sources are not fetched by the browser.

`index.html` and the modules load one another with a `?v=` number so a returning
player never runs a mix of old and new files. Raise it everywhere whenever code or
styles change; a test checks they match. `window.littlePilot` exposes the flight
state, saved pilot, sound module and sky items for checking by hand.

## Verification

```sh
node --test sky-playground/*.test.mjs
```

Tests cover all twenty inter-airport routes at every speed, Big City's layout, tower
walls and avenue trails, the islands and their
approaches sitting inside the edge of the world (`WORLD` in `airline.js`), night and
dusk, the airport card's pages, the takeoff countdown, runway alignment and
rollout, takeoff, steering effects and safe touchdown at 20–120 Hz, world terrain
and obstacle clearance, boundaries, passport validation, boarding order, pause and
resume, mid-glide takeover, original picnic availability, and GLB integrity.
Controller tests run the actual game logic with a minimal DOM/scene harness.
`sky.test.mjs` covers item placement clear of land, trees and the world edge, star
trails for all six routes starting dead ahead and bending gently, which trail is in
the sky, helped and height-blind flights gathering the trail, help joining late
without turning back, the autopilot flying every trip and touring without circling, single collection, the tall reach and the wider reach while
zooming, the height help, zoom charging, reset, validated pilot saves, unlocks and
their announcement, and matching version numbers.
Browser checks should cover the airport card's three pages on a phone both ways up, a
flight into the night and back out, complete passenger trips, the first stars in view after
takeoff, star collecting and the saved total after leaving mid-flight, a hoop zoom, a
loop, the zoom button filling and emptying, each toy, the landing bonuses, an autopilot
trip with a wish granted and a landing, an unlock in My plane, sound on at the airport and remembered after a reload,
saved passport reload, manual steering, landing choice, and portrait/landscape layouts.
