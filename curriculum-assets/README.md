# Viaan’s learning worlds

The upgraded home and curriculum share a cream, mint, and clay-art style with Little Friends and Little Chess Club. Open `../index.html` through the local HTTP server.

## Files

- `experience.css`: responsive home, subject selection, lessons, examples, completion, and grown-up progress.
- `experience.js`: DOM controller and audio lifecycle for English and Thinking. All 16 question types share retry, help, and manual Next. Math is the separate game in `../number-playground/`; the home page reads a summary of its save and the Daily Adventure's math stop opens it.
- `learning.js`: pure progress/content rules. Imported as a browser global and exercised in `../curriculum.test.mjs`.
- `build_toys.py`: original procedural Blender objects, using the same material/geometry helpers as the animal set.
- `learning-toys.blend`: editable source scene with separate object collections.
- Sixteen transparent 384×384 PNGs: apple, car, fish, seed, sprout, flower, tree, cup, ball, cookie, book, blocks, hat, ice, cloud, egg. Existing animals are loaded from `../memory-assets/`. Other vocabulary retains symbols in consistent cards.

To regenerate artwork with an installed Blender:

```sh
blender --background --factory-startup --python curriculum-assets/build_toys.py
```

No external images, runtime 3D engine, paid service, or API call is required. The main page still uses Google Fonts with system fallbacks. Device read-aloud depends on browser speech support; the text is always visible. Recorded phonemes/words remain local.

## Lesson behavior

1. Each lesson begins with an example. Children can hear it and choose My turn.
2. Children try each activity, with optional manipulatives and audio replay.
3. A miss keeps the question available and gives a strategy. A clue explains the approach; asking again highlights the correct choice or next tile. Reopening an example counts as help.
4. A correct answer shows an explanation and enables Next. It never advances on a timer.
5. Completing all five questions earns a badge. The grown-up disclosure distinguishes independent answers from answers completed after a miss or optional help; hearing the prompt is part of the activity.

All 180 English and Thinking lesson IDs are retained; the 16 old math lessons were replaced by the Number Playground game, and their saved scores are simply left unused. `vla4` numeric scores and other keys survive migration. `__learning.levels` stores completion and latest attempt details, while `__adv` retains the daily adventure. Legacy positive scores mean completed; historical help use is unknown. Progress is local to the browser.

## Content corrections

`Learning.prepare` applies explicit corrections to the retained curriculum arrays before rendering: nonidentical rhyme pairs, a single missing-letter slot, the `eer` spelling in deer (sharing the recorded ear sound), distinct choices for equivalent phoneme spellings, explanatory grouping/association clues, contextual cause-and-effect stories, and 20 captioned silly actions. Stable level IDs keep saved progress compatible.

## Verification

```sh
node --test curriculum.test.mjs chess.test.mjs memory.test.mjs sky-playground/flight.test.mjs
```

Curriculum tests cover all question/choice data, word-building pools, missing letters, rhyme/sound ambiguity, retry/completion rules, storage compatibility, the hand-over to the math game, artwork, and stale audio callbacks. Browser verification must include wrong/retry/Next, tile building, examples, a completed lesson in each subject, phone layout, and reload persistence. Do not equate a badge or a few independent responses with a formal assessment of mastery.
