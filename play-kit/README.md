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
- `audio.js`: synthesized music and effects.
- `voice.js`: which spoken lines and numbers have a recording. Written by
  `../tools/record-voice.mjs`; never edited by hand.
- `kit.css`: the shared look: a backdrop of sky, sun, drifting clouds and hills behind
  everything (each game sets its own mood through `body[data-game]` colours), lands with
  ribbon titles, and a winding dotted path of round stops in rows of three. Class names
  here are shared with every game's own styles, so keep them distinct (`backdrop`, not
  `scene`; `across`/`below` for path links).

## Speech

Everything the games say is a list of parts: numbers, lines of text, punctuation that is
shown but not spoken, and names of clips (`phon_`, `word_`, `num_`, `cheer_`). Each
game builds its lines in the `V` object of its `rules.js` and lists them all in
`lines()`; the kit's own are `KIT` and `kitLines()` in `progress.js`. A line's recording
is named from its text by `lineId`. `speak(parts)` plays the recordings in order when
every part has one, and otherwise lets the device voice read the words, so a new line
works before it is recorded.

`node tools/record-voice.mjs --dry` lists what is missing and spends nothing. Without
`--dry` it records the missing lines with OpenAI text-to-speech (`gpt-4o-mini-tts`,
voice `marin`), using `OPENAI_API_KEY` from the environment or `.env`, and rewrites
`voice.js`. `--redo=num,word,cheer,praise,phon` re-records the older clips in the same
voice. After changing any spoken line, add it to that game's `lines()` (a test checks
every line a task can speak is listed) and run the script again.

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
