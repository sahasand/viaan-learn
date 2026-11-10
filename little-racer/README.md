# Little Racer

A gentle 3D supercar race for Viaan. Pick a paint colour and a track in the garage,
then race three laps against Panda, Penguin and Frog. The car drives forward by
itself; the only job is steering left and right.

## Play locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/little-racer/`. The home Little Racer card opens this game.
No build, account, API key, or network asset service is required. Serve through HTTP;
browser security prevents GLB loading from a `file://` page. Requires WebGL 2.

## Controls and rules

- Hold the big **left** and **right** buttons, touch either half of the picture, or use
  the arrow keys / A and D. **Beep!** (or H) sounds the horn. P pauses.
- Corners push the car gently outward, so steering into the bend holds the road.
- Grass is slower and nudges the car back. A soft wall stops it wandering further.
  Cars that touch slide apart. Nothing spins, crashes, or stops.
- Driving through a star gives a short zoom boost. Stars return every lap.
- Each track has two jump ramps across the whole road and one tunnel. A ramp sends
  every car flying for about a second; nothing needs to be pressed and landing is safe.
- The animal drivers slow down when they are ahead and hurry when they are behind,
  so the pack stays together. A driver who never steers still finishes in about two minutes.
- Every finish gets the same celebration and shows the finishing order. There is no
  timer, lap record, or trophy shelf.
- The chosen colour and track save locally under `viaan-racer-v1`; other games'
  progress is untouched.
- Pause stops the simulation. Changing tabs or losing focus also pauses.
- Sound starts muted. The music-note button enables a quiet synthesized engine, horn,
  chimes, and optional device speech. Play works without sound or speech support.

## Art and implementation

`assets/supercar.blend` is the editable Blender source for the original wedge-shaped
supercar. It carries no real car maker's name, badge, or exact model shape; keep it that
way, since the site is public. Rebuild the model, its GLB export, and the home-card
render `supercar.png` with:

```sh
blender --background --factory-startup --python little-racer/tools/build_car.py
```

The game repaints the material named `Paint` and spins the four `Wheel_*` objects, so
keep those names. All four cars share the one model; rivals carry a `memory-assets/`
portrait above the roof.

`race.js` holds every rule and runs in Node tests: track shapes, car movement, rival
pacing, stars, bumps, laps, finishing order, and saved-choice validation. Cars live in
track coordinates (distance along the centre line, metres to the right of it), which is
why nobody can drive backwards or get lost. `game.js` owns the scene, scenery, camera,
input, sound, and page lifecycle. Tracks, road markings, terrain, and scenery are generated
in code from the control points in `race.js`; changing a track's points needs no art work.
`race.js` also picks the straightest stretches for the tunnel and ramps.

The look comes from a few pieces in `game.js`: a gradient sky with a sun that also feeds
the paint reflections, rolling terrain that stays flat beside the road, a sun shadow box
that follows the player, a cheering crowd of `memory-assets/` animals, bunting, balloons,
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
grass slowdown, rival pacing, soft
bumps, bad input, fixed finishing order, saved choices, and model/page wiring.
Browser checks should cover a full race to the finish card, pause and resume, a colour
and track change, saved choices after reload, and portrait/landscape layouts.
