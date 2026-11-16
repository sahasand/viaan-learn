# Home page and shared art

The home page (`../index.html`) is a launcher: three learning games, the Daily
Adventure that visits them in turn, a shelf of just-for-fun games, and a summary for
grown-ups. It has no lessons of its own. Math, English and Thinking are the games in
`../number-playground`, `../story-garden` and `../little-detective`, built on
`../play-kit`.

- `home.js`: reads each game's save to show what is next, plans today's adventure
  (`vla4.__adv = { d, n, g, s }`: English, Math, English, Thinking, then a game) and
  opens the right game with `?adventure=1`. The game moves the adventure on when a visit
  is finished.
- `experience.css`: the home page's styles. It still carries the styles of the retired
  lesson screens, which nothing uses now.
- `build_toys.py`, `learning-toys.blend` and sixteen transparent 384×384 PNGs (apple,
  car, fish, seed, sprout, flower, tree, cup, ball, cookie, book, blocks, hat, ice,
  cloud, egg): the clay toys the learning games draw. Animals are in `../memory-assets`.

To regenerate artwork with an installed Blender:

```sh
blender --background --factory-startup --python curriculum-assets/build_toys.py
```

Saved lesson badges from before the games (`vla4` scores and `__learning`) are left in
place and unused. `node --test home.test.mjs` checks the launcher and the adventure.
