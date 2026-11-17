# City Swinger

A one-finger swinging game for Viaan. Super Viaan, an original kid hero with a mask and a
cape, crosses a city seen from the side: he throws a rope to a golden hook, swings over the
street, lands on the next roof, and rescues three friends on the way to the finish.

He is our own character. Do not give him, or anything in the game, the name, suit, emblem,
web or look of an existing superhero.

## Play locally

From the repository root, `python3 -m http.server 8765` and open
`http://127.0.0.1:8765/city-swinger/`. It imports Three.js from `../sky-playground/vendor`
and the crowd's pictures from `../memory-assets`, so keep those in place. No build step.

## How it plays

- **Hold** the screen (or Space, or the up arrow) to throw the rope; **let go** to fly.
  That is the only control.
- A rope is thrown only over a gap: on a roof he runs to its end first, then swings if the
  screen is held and leaps if it is not. Held, the rope lets go by itself once he is rising
  above the next roof, so simply keeping a finger down swings him across the whole city.
- He cannot be hurt or stuck. Left alone he leaps off each roof, bounces on the trampoline
  in the street, sticks to the next wall and climbs it. Doing nothing at all still reaches
  the finish and rescues everyone; swinging is faster and catches more stars.
- The hook a rope would catch right now is the one that bobs and glows.
- Stars hang in a smile under each hook and along the roofs; big ones are worth five. Each
  mission has three friends to rescue, on a roof, on a chimney and dangling under a hook,
  worth five stars each, and finishing is worth ten.
- Missions go on for ever, a little longer each time up to fifteen buildings, and cycle
  through day, sunset and night. Each mission is the same every time it is played.
- Stars are saved the moment they are caught. Suits with a price unlock once the hero has
  that many stars; stars are never spent and nothing is ever taken away. Stars, missions,
  rescues, the suit and the sound choice are kept in `viaan-swinger-v1`.
- Sound starts off; the choice is remembered. Pause, a hidden tab or losing focus stops
  the game.

## Code

- `swing.js` holds every rule in plain numbers and runs in Node: missions (`makeMission`),
  the hero's movement (`stepHero`), which hook a rope catches (`hookFor`), catching
  (`gather`) and the save (`normalizeSave` and friends). Positions are (along the street,
  height); the hero's is at his feet.
- `game.js` draws the city, the hero (built from simple shapes in `makeHero`), the rope and
  the screens, and passes "is the screen held" to the rules. `audio.js` synthesizes the
  tune and effects.
- `index.html`, `game.js` and the modules load one another with a `?v=` number. Raise it
  everywhere whenever code or styles change; a test checks they match.
- `window.citySwinger` exposes the hero, mission, save and `hold(true|false)` for checking
  by hand.

## Checks

```sh
node --test city-swinger/*.test.mjs
```

The tests play eleven missions three ways (never pressing, always holding, pressing at
random) and check that every one finishes, that the hero is never below the street or
inside a building, that holding uses about one rope a gap and beats doing nothing, and
that both rescue all three friends. They also cover mission layout, catching, the save and
matching version numbers.

In a browser, play a mission holding, one tapping and one not touching the screen; check
a rescue, the finish card, a suit change, pause, sound remembered after a reload, and the
layout on a phone both ways up.
