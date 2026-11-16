# Play kit

What Viaan's three learning games share: Number Playground (math), Story Garden
(English) and Little Detective (thinking). Each game is a folder with its own rules,
its own task screens and a few styles; everything else comes from here.

- `progress.js`: one star bank and one sticker book for all three games
  (`viaan-rewards-v1`: `{ stars, stickers, sound }`), each game's visits to its stops
  (its own key: `{ done: { stopId: visits }, next }`), which stops are open, surprise
  eggs, and the Daily Adventure hand-off. Plain data; runs in Node tests. Number
  Playground first kept stars in its own save; that is read once when there is no shared
  save yet.
- `kit.js`: the page itself. The map of stops in lands, a visit of tasks with step dots,
  the buddy's speech bubble, the win card, eggs and the sticker book. A game calls
  `startPlayground({ key, world, title, buddy, lands, stops, makeRound, games })`, where
  `games` has one function per kind of task, `kind(task, stage)`. Task screens use the
  exported helpers: `ask`, `miss`, `solved`, `say`, `playClips`, `art`, `later`, `wobble`,
  `countOne`, `pad`, `sound` and the live flag `busy`.
- `audio.js`: synthesized music and effects. Words, sounds, numbers and cheers are
  recorded clips in `../audio`; sentences are spoken by the device voice.
- `kit.css`: the shared look.

## Rules every game keeps

The playing must be the learning: a task is answered by doing it, not by picking from a
quiz. A wrong try only gets a boing and a hint, and the task stays open. No timer, no
lost stars, no way to fail. Every visit sets fresh tasks. Every finished task earns a
star, two when right first time; ten stars hatch an egg holding a sticker not yet found
(11 animals, 16 toys and 24 treats). Stops open one after another and stay open.

Every file is loaded with a `?v=` number, the same one everywhere, including by the
home page. Raise it in all of them whenever code or styles change; a test checks they
match and that no module is imported without it.

`window.playground` exposes the rewards, visits, current task and `startStop(id)`.
