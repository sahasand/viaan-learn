# Plane Factory — design

A standalone game (`plane.html`) that teaches a five-year-old the core loop of
building with AI — describe what you want, let the machine build it, check the
result, refine your instructions — wrapped in an aeroplane factory game. Sixth
world card on the home screen, following the Chess / Memory Match conventions.

## Why this shape

A static GitHub Pages site cannot call a real AI (no server, no safe place for
an API key), and a pre-reader cannot type prompts anyway. So the "AI" is a
friendly deterministic robot engineer, **Robo 🤖**, and the prompting skill is
taught through its real structure, not its tooling:

1. **Specify** — the child composes instructions from picture tiles.
2. **Generate** — Robo builds a plane from the instructions.
3. **Evaluate** — the result is compared against what was wanted.
4. **Refine** — mismatches are fixed and the build re-run.

The one deliberately "AI-like" behaviour: any instruction slot the child leaves
empty gets a **robot guess**, visibly badged with a 🎲. Vague prompt → surprise
output. That is the lesson.

## Game structure

- **Setup screen** — pick a mode: **Orders** (📋, the teaching game) or
  **Free Build** (🎨, sandbox). "← Menu" link back to `index.html`.
- **Workshop screen** — instruction tiles in 4 categories, an instruction
  strip showing the current "prompt", Robo with a short speech line, the built
  plane rendered as inline SVG, and per-part result chips.
- **Flight screen** — after a successful build the plane flies: hold anywhere
  to climb, release to glide down, collect 5 sky stars scrolling past. No fail
  state; it is the reward that makes the aeroplane half real.
- **Win overlay** — after 5 delivered orders: total stars (build stars +
  collected sky stars), confetti.

## Parts catalogue (the "prompt vocabulary")

| Category | Options |
|---|---|
| Color | red, blue, yellow, green (body paint) |
| Wings | big, small |
| Engine | propeller, jets |
| Sticker | stars, hearts, plain |

48 distinct planes. All drawn by one pure-ish SVG builder (side view: fuselage,
cockpit, wing, tail, engine, decals, wheels) parameterised by the spec.

## Orders mode

- 5 orders per game. Each order: a random customer animal shows a random
  target plane ("X wants this plane!").
- The child picks tiles and taps **Build**. `robotBuild` fills unchosen
  categories with guesses (badged 🎲). `compareSpec` marks each part ✓/✗.
- All match → deliver: fly the flight, then next order. Mismatch → Robo names
  the wrong part kind-heartedly, wrong chips wiggle, the child adjusts and
  rebuilds. Attempts are counted: 1st-try build = 3⭐, 2nd = 2⭐, else 1⭐.
- After two misses on the same order, the correct tiles in the wrong
  categories glow (a pointing hint) — kindness over difficulty.

## Free Build mode

No target. Pick any tiles — or none, for a full robot surprise — build, fly,
return to the workshop with choices kept. Endless.

## Logic / UI split and tests

Same pattern as Chess and Memory Match: pure, DOM-free logic between
`/* LOGIC_START */`…`/* LOGIC_END */`, UI between `/* UI_START */`…`/* UI_END */`.

Logic surface (all pure, RNG injected for determinism):

- `CATS` — the parts catalogue.
- `randomSpec(rng)` — a full random plane spec (order targets, robot guesses).
- `robotBuild(choices, rng)` — fills nulls, returns `{spec, guessed}`.
- `compareSpec(target, spec)` — `{ok, wrong[], match{}}`.
- `starsFor(attempts)` — 3 / 2 / 1.
- `flightStep(state, hold, dt)` — one physics tick (gravity vs. climb,
  velocity and altitude clamped).
- `starHit(planeY, starY)` — collection test.
- `NUM_ORDERS`, `CUSTOMERS`.

`plane.test.mjs` (Node `vm` sandbox, like `memory.test.mjs`): catalogue
integrity, deterministic `randomSpec`, `robotBuild` guess/keep behaviour,
`compareSpec` correctness, star thresholds, flight physics clamps, star
collection, plus UI control-flow smoke tests (loads against a stubbed DOM,
timers cancelled on mode change, win guard). Gameplay timeouts go through the
`later()`/`clearTimers()` pattern from Memory Match; the flight loop is a
`later`-chained tick (no `requestAnimationFrame`) so it is cancellable and
testable.

## Non-goals

No persistence (like Memory Match), no audio (silent by design), no real AI
calls, no reading required — every instruction is a picture.
