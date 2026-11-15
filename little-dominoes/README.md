# Little Dominoes

A domino run for a young child. Drag a finger to stand dominoes up in a line, tap one, and watch
the whole line fall. Three toys wait at one end of the mat: a bell, a rocket and a present. A domino
that falls against a toy sets it off.

Open `little-dominoes/` from the home page, or serve the repository and visit
`http://localhost:8765/little-dominoes/`.

## How it plays

- **Draw.** Dragging on the mat stands a domino up every 0.72 units along the finger's path. The line
  bends at most 0.85 radians from one domino to the next, so a sharp scribble comes out as a curve
  that still knocks on. A line started on top of another line joins it.
- **Tap.** A tapped domino falls towards a neighbour it can knock over, forwards if it can. Tapping
  the far end of a line sends the fall back along it.
- **Gaps.** A gap wider than a domino is tall stops the fall. A pointing hand then shows the nearest
  domino still standing. Drawing across the gap fills only the gap.
- **Stand up.** Every fallen domino rises again, the last to fall first, and the toys reset. The same
  tap then gives the same fall.
- **Show me.** Three ready-made runs: Snake (rocket), Swirl (bell) and Big tree (all three toys).
  Choosing one replaces what is on the mat. The first visit starts with Snake already standing.
- **Undo** takes away the line drawn last. **Clear** asks for a second tap. **Colours** steps
  through four palettes.
- The camera follows the front of a fall and returns when it is over. With reduced motion it stays
  still, dominoes stand up at once and runs appear at once.

There is no score, timer or way to fail. The number on screen counts fallen dominoes.

## Files

- `topple.js` holds every rule and runs in Node: placing, drawing, falling, standing up, the
  ready-made runs and saving.
- `game.js` owns the Three.js scene, the toys, the camera, pointer input and the buttons.
- `audio.js` synthesizes all sound. Each falling domino plays the next note of a five-note scale.
- `topple.test.mjs` tests the rules.

Three.js is imported from `../sky-playground/vendor`, so keep those files in place. `index.html`
and `game.js` load their files with a `?v=` number; raise it in every place whenever code or
styles change (a test checks they match).

## The falling model

This is a hand-written model, not a general physics engine. A domino turns about its bottom edge,
pulled over faster the further it leans. When it starts to fall it works out what is in its path:
up to three dominoes side by side, and a toy if one is close. It knocks a standing domino on first
touch, handing on part of its turning speed, and after that it can lean no further than the one in
front allows. The last domino in a line lies flat.

Two deliberate departures from real dominoes, both to make a child's drawing work:

- A domino standing side on to a falling one is knocked if it is merely close (within 1.05 units to
  the side). This is what lets a branch drawn off the side of a line fall.
- A domino hit on its thin edge tips away from whatever hit it.

Dominoes cannot be stacked, and nothing can be thrown at them. Adding ramps, stairs or bridges
would need new rules in `topple.js`.

## Saving

`viaan-dominoes-v1` in localStorage holds the sound choice, the palette, whether the first visit
has happened, a running total of dominoes knocked over, and the dominoes on the mat as
`[x, z, yaw, colour, line]`. `normalizeSave` validates everything and drops anything off the mat.
The mat holds at most 500 dominoes.

## Checks

Run `node --test little-dominoes/*.test.mjs`. In a browser, check a drawn line, a gap, a branch,
each toy, each ready-made run, Stand up, Undo, Clear, a reload with dominoes on the mat, and the
layout on a wide screen and a phone both ways up.
