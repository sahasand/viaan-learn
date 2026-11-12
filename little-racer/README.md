# Little Racer

A gentle 3D race for Viaan. Pick one of four vehicles, a paint colour and one of four tracks
in the garage, then race three laps over hills, round a loop-the-loop and over a mega jump
against three cartoon dogs: Biscuit, Pepper and Waffle. Viaan's own car has no dog in it.
The car drives by itself; he steers left and right and has a boost and a brake button.
Coins collected in races unlock special paints, and every track gives a cup.

## Play locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/little-racer/`. The home Little Racer card opens this game.
No build, account or API key is required. The page asks Google Fonts for Baloo 2 and
falls back to a local rounded font when offline. Serve through HTTP;
browser security prevents GLB loading from a `file://` page. Requires WebGL 2.

## Controls and rules

- The car drives by itself from the green light, so one finger is enough to steer.
  There is no go button. Hold **STOP** to brake; letting go drives on. Steer with the
  **left** and **right** buttons or by touching either half of the picture. **BOOST** is
  the big button under the right thumb. Keys: left/right arrows or A/D to steer, down or S
  to brake, up, W, N or Shift for boost, H for the horn, P to pause.
- The race display is the place (a big outlined number) with the running order of dog
  faces under it, a lap and a coin chip in the middle, and the map on the right. The home
  button and name are hidden while racing; the pause card links back to Viaan.
- **Zoom strips** are blue arrows painted on the road between the stars. Driving over one
  gives a short boost every time; they are never used up.
- `index.html` and `game.js` load their files with a `?v=` number so phones do not keep an
  old copy. Raise that number in both files whenever the game's code or styles change.
- **Nitro** holds three bursts and every race starts with one. Coins, stars, drift boosts,
  spins and knock-overs fill it; one tap spends one.
- Every track has its own **thing to knock over**, standing in two rows right across the
  road so no car can miss: beach balls, snowmen, barrels and space bubbles (`toy` in
  `TRACKS`). Each one Viaan hits flies off and is worth a coin. Nothing slows the car, the
  dogs knock them over too without scoring, and they pop back up after four seconds.
- **Bouncers** are spotted domes in one lane. Driving over one hops the car over three
  coins. `toys` in `TRACKS` sets each track's mix of rows (`s`) and bouncers (`b`); they
  are placed wherever the road is free of stars, strips, ramps, the loop and the tunnel.
- **Spins:** steering while the car is in the air (a ramp, the mega jump or a bouncer)
  spins it once right round; landing gives a short boost and some nitro.
- The **last lap counts double**: every coin and knock-over is worth two, the coins grow
  and the coin chip shows ×2.
- Rainbow Galaxy has **low gravity** (`float` in `TRACKS`): every flight lasts a quarter
  longer and goes higher.
- A dog that has fallen well behind shows boost flames while it catches up.
- Every track has a **loop-the-loop**; Jungle Loop and Rainbow Galaxy have a **double
  loop** (`loops: 2` in `TRACKS`), a corkscrew that carries the car across the road and
  back. An orange **launch strip** steers every car into the loop's lane and fires it in at
  full boost speed whatever is pressed, so the loop cannot be failed. Inside, the car
  trades speed for height: it slows as it climbs, is slowest upside down at the top, and
  rushes back down (`LOOP.gravity`, never below `LOOP.slow`). A boost burning inside makes
  the whole trip quicker. Each trip over the top fills one burst of nitro, each turn has a
  ring of eight coins, and the car leaves with a short boost. The dogs ride it the same way.
- For the loop the camera swings out beside the road and stays square on to the ring, level
  with its middle, so the car is seen going right round; it swings back behind on the way
  out. With reduced motion it cuts instead of swinging.
- The second ramp of each lap is a **mega jump** over a line of buses and through two
  rings of fire, with a long arc of coins.
- **Vehicles** unlock with cups: the monster truck after finishing any race, the sports
  car after two tracks and the formula racer after three. They drive the same; only the look changes.
- A track's **boss race** opens once its cup is earned: one-on-one against a big dog in a
  crown (Bruno, Frosty, Rumble or Comet) in a monster truck. Winning turns the cup into a crown. Losing changes
  nothing and it can be tried again at once.
- Corners push the car gently outward, so steering into the bend holds the road.
- Grass is slower and nudges the car back. A soft wall stops it wandering further.
  Cars that touch slide apart. Nothing spins, crashes, or stops.
- Driving through a star gives a short zoom boost. Stars return every lap.
- Holding a turn through a corner charges a drift: blue sparks after about a second,
  orange after two. Letting go spends it as a short or longer boost. Sliding onto the
  grass loses the charge. The bar under the speed shows the charge.
- Coins sit in rows on the road and in an arc over each ramp, and return every lap.
  They are banked when the race finishes, whatever the place. The finish card says how
  many things were knocked over and how many spins were done.
- Each track has two jump ramps across the whole road and one tunnel. A ramp sends
  every car flying for about a second; nothing needs to be pressed and landing is safe.
- The dog drivers slow down when they are ahead and hurry when they are behind,
  so the pack stays together. A driver who never steers still finishes in about two minutes.
- Every finish gets the same celebration, shows the finishing order, and earns that
  track's cup; winning turns the cup gold. Cups never downgrade. There is no timer or
  lap record, and nothing is ever taken away.
- In the garage, locked paints (gold, rainbow, galaxy) show their price. One there are
  enough coins for swaps its padlock for a coin and glows. Tapping one buys it when there are enough coins and otherwise
  says how many more are needed. Coins are only earned by playing; there is no shop.
- Vehicle, colour, track, coins, unlocks and cups save locally under `viaan-racer-v1`;
  other games' progress is untouched. Saves from the first release still load.
- There are no trails behind the car any more. A save that bought one gets those coins
  back the next time it is read (`OLD_TRAILS` in `race.js`).
- Pause stops the simulation. Changing tabs or losing focus also pauses.
- Sound starts muted. The music-note button enables synthesized music (one tune per
  track, a little faster on the last lap), engine, tyre squeal, horn, chimes, and
  optional device speech. Play works without sound or speech support.

## Art and implementation

`assets/supercar.blend`, `truck.blend`, `sports.blend` and `formula.blend` are the editable Blender
sources for the four original vehicles. The supercar is styled as a sharp, flat-faceted
Italian-style wedge with Y-shaped lamps and a hexagonal exhaust. The sports car is a round
rear-engined coupé in the classic German style: round lamps on raised front wings, a roof
that falls in one curve to the tail, wide back wheels and a light bar across the back. They carry no real maker's name, badge, or
exact model shape; keep it that way, since the site is public. Rebuild a model, its GLB
export, and its card render with:

```sh
blender --background --factory-startup --python little-racer/tools/build_car.py -- supercar
blender --background --factory-startup --python little-racer/tools/build_car.py -- truck
blender --background --factory-startup --python little-racer/tools/build_car.py -- sports
blender --background --factory-startup --python little-racer/tools/build_car.py -- formula
```

The game repaints the material named `Paint` and spins the four `Wheel_*` objects, so
keep those names in every model. Friends drive the supercar and bosses the truck.
A new vehicle needs its three files in `assets/`, a line in `CARS` in `race.js` and a line in `SPECS` in `game.js`.

`dogs.js` builds every cartoon dog from soft round shapes in code; there are no dog image
or model files. `DOGS` in `race.js` holds each named dog's look (fur, muzzle, ears, collar,
markings, crown). A driver pokes out of the roof with ears that stream back with speed and
a head that turns into bends; the seat for each vehicle is `SPECS[...].seat` in `game.js`.
The crowd is drawn as a handful of instanced meshes, so its size costs almost nothing; dogs
wave and wag, throw both paws up as Viaan passes, and far-away dogs are left still. The
faces in the race order and on the finish card are small pictures of the same models taken
once at start-up. The dogs are original characters; do not model them on a known cartoon.

`race.js` holds every rule and runs in Node tests: track shapes and hills, car movement,
drifting, rival pacing, stars, coins, bumps, laps, finishing order, overtakes, and the
saved choices with their coins, unlocks and cups. `audio.js` builds all sound from
oscillators and noise; no audio files are used. Cars live in
track coordinates (distance along the centre line, metres to the right of it), which is
why nobody can drive backwards or get lost. `game.js` owns the scene, scenery, camera,
input, sound, and page lifecycle. Tracks, road markings, terrain, and scenery are generated
in code from the control points in `race.js`; changing a track's points needs no art work.
Each place has its own road surface from `THEMES` in `game.js`: tarmac with yellow dashes
on the beach, blue ice on the mountain, a dirt track in the jungle and a rainbow road for
Rainbow Galaxy, which floats in space with no ground, a star field, planets, flying saucers
and glowing ring gates. Corners carry arrow boards, striped arches stand over the road, and
each place has its own roadside things (surfboards, beach huts and giant ice creams; igloos,
candy poles and ice crystals; mushrooms, totems and giant flowers; glowing crystals).
`race.js` also picks the straightest stretches for the tunnel and ramps.

The look comes from a few pieces in `game.js`: a gradient sky with a sun that also feeds
the paint reflections, rolling terrain that stays flat beside the road, a sun shadow box
that follows the player, one landmark per track (sandcastle and lighthouse, ice castle,
temple and smoking volcano, rocket), a grandstand of cheering dogs, bunting, balloons,
snow or pollen in the air, and one shared particle pool for dust, sparkles, smoke,
confetti and fireworks. If frames stay slow for a few seconds the game switches off
shadows and lowers sharpness by itself. Reduced motion removes particles, weather,
camera sway and the speed streaks.
Three.js is shared from `../sky-playground/vendor` rather than copied.

## Verification

```sh
node --test little-racer/*.test.mjs
```

Tests cover closed, non-overlapping tracks and corner radius, hands-off and
steering-held drivers finishing every track, a careful driver winning at 20–120 Hz,
single lap announcements, star boosts and respawn, ramp and tunnel placement, jumps,
hill limits, the loop's shape and lane, the launch strip and the loop's speeds, double loops, gas and brake, nitro, the mega jump, boss races,
vehicle unlocks, drift charging and release, coin rows and air coins, unlock buying, cups,
overtake announcements, grass slowdown, rival pacing, soft
bumps, zoom strips, knock-over rows, bouncers, air spins, the double-coin last lap, low gravity,
bad input, fixed finishing order, saved choices, the trail refund, every dog's look, and
every vehicle's model and page wiring.
Browser checks should cover a full race to the finish card, a loop and a double loop, the mega jump, a
nitro burst, a zoom strip, a knock-over row, a bouncer, a spin, the last lap, a boss race, a drift boost, an unlock in the garage, pause and
resume, a colour and track change, all four tracks, saved choices after reload, and the
garage and race display on a wide screen, a phone upright and a phone sideways.
