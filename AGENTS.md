# AGENTS.md

## Project and checks

Viaan is a static learning app for a young child, hosted on GitHub Pages. `index.html` contains the curriculum data and HTML shell; `curriculum-assets/learning.js`, `experience.js`, and `experience.css` provide rules, interactions, and design. No build step. Serve the repository over HTTP, for example `python3 -m http.server 8765`.

Run `node --test curriculum.test.mjs chess.test.mjs memory.test.mjs sky-playground/*.test.mjs little-racer/*.test.mjs`. For curriculum changes, also verify a complete lesson with a wrong answer, a clue, a correct retry, manual Next, completion, and saved-progress reload. Check a phone viewport for overflow and usable controls.

## Curriculum

Read `curriculum-assets/README.md` before changing lesson flow, progress, sound, art, or content corrections.

- Preserve the `CURRICULUM_START` / `CURRICULUM_END` markers in `index.html`; tests extract the existing `MATH`, `ENG`, `CRIT`, `WPH`, and `EM` maps from them. There are 196 stable lesson IDs and 980 questions: Math 16/80, English 160/800, Thinking 20/100.
- `learning.js` exports the browser global `Learning` and also runs in Node VM tests. It owns content preparation, explanations, hints, shuffle, progress normalization, completion rules, and next-lesson selection. `experience.js` exports `LearningApp.start(source)`, owns the DOM, audio lifecycle, and the 23 active question renderers. Add question types to its switch and test their data/interaction semantics.
- World names: Number Playground (math), Story Garden (eng), Little Detective (crit). English keeps the original six phonics phases and 40 weeks, with child-facing Listen/Build/Read cards and full lesson browsing in a grown-up disclosure. Thinking keeps five units: grouping, associations, cause/effect, silly stories, patterns/order.
- Shared flow: example → try → optional clue/retry → explanation → manual Next → completion badge. A wrong answer never advances. Used build tiles cannot be selected twice. No speed scoring, perfection threshold, or badge loss.
- Keep existing `vla4` localStorage values. New data lives in `__learning.levels[id]`: completion, latest independent/assisted counts and misses, play count, best independent count. Legacy numeric scores remain max-preserved; an older positive score means completed, with no fabricated assistance history. A completed round with help earns a badge even when its numeric score is zero. Parent summaries describe the latest recorded attempt per lesson.
- Daily Adventure retains `__adv={d,n,g,s}` and its four English/Math/English/Thinking stops. Validate date, cursor, game, world and level IDs before use. Completion increments the cursor only once; replaying the same stop cannot skip ahead. All three games remain freely available from home.
- New instructions/explanations use on-demand device speech. Phonemes and words reuse local recorded clips; never substitute general TTS for isolated phonics. `stopAudio` cancels the media singleton, delayed sequence callback, and device speech; a token rejects stale callbacks. Call it on question changes, navigation, examples, replay, and page hide.
- Clip IDs: `phon_A` for a single letter (uppercase, including on case-sensitive Pages hosting), `phon_ch` for a digraph, `word_` plus nonletters replaced with underscores. The `eer` spelling in deer uses the existing `phon_ear` sound. Number clips exist for 0–12, 15, 18, 20, 25, 30; other number-line labels use device speech. Existing `generate-audio.js` remains available for intentional recording work and reads `OPENAI_API_KEY`; no audio generation is needed to build or run the app.
- Math uses complete ten-frames, count-once objects, grouping trays, subtraction counters, and number trails. Do not cap displayed quantities at ten. Thinking story choices need explicit actions/captions and a concrete explanation; paired symbols alone do not establish an absurdity.
- Preserve original local PNGs and the Blender source/generator under `curriculum-assets/`; existing animal renders are shared from `memory-assets/`. Remaining vocabulary uses the `EM` symbol map inside consistent cards. Do not imply every vocabulary item has a Blender render.

## Chess (standalone game)

`chess.html` is Little Chess Club, a guided learning game. Read `chess-assets/README.md` when changing chess rules, lesson content, artwork, speech, or UI lifecycle; the old design documents describe the replaced king-capture game.

- **Modules:** `chess-assets/learning.mjs` owns 18 movement challenges and pure practice helpers. `game.mjs` exports an injectable `createClub` controller for DOM/timer tests. `chess.mjs` is the pinned, locally vendored chess.js rules engine with its BSD license.
- **Teaching:** six piece lessons, three one-move challenges each, then a badge saved in `viaan-chess-club-v1`. Puzzles are movement exercises rather than full positions. Practice enforces standard chess rules and offers four promotion choices; kings are never captured.
- **Practice:** Teddy plays black, or two people share a fixed white-at-bottom board. Hints suggest a legal move without altering history. Undo removes the child/Teddy turn pair, or one move in two-player mode. Navigation and reset cancel AI callbacks using a timer plus epoch guard.
- **Accessibility:** native square buttons, roving keyboard focus with arrow keys, explicit piece/square/move labels, on-demand device speech, and reduced-motion support. Mobile places the challenge above the board. Keep lesson goals and spoken directions aligned.
- **Checks:** `node --test chess.test.mjs` tests lesson solvability, blockers/jumps, king safety, badge validation, standard-rule integration, hint non-mutation, promotion and UI lifecycle. Visually verify a full lesson and practice flow after changes.

## Memory Match (standalone game)

`memory.html` is Little Friends, a cream-and-mint memory game reached from the home Little Friends link.

- **Logic boundary:** preserve the `LOGIC_START` / `LOGIC_END` and `UI_START` / `UI_END` markers used by `memory.test.mjs`. Pure logic includes deck data, shuffle/matching, `normalizePreferences`, and `mergeAlbum`.
- **Artwork:** Animals uses original transparent Blender renders in `memory-assets/`. Read `memory-assets/README.md` when changing art or regenerating the editable scene. Other decks retain emoji/letters/color swatches. Every deck needs at least eight distinct items.
- **Setup and persistence:** default Animals with 3 pairs; 6 and 8 pairs remain available. Three featured decks precede seven additional decks in a disclosure. Validated deck, size and collected animal IDs persist in localStorage `memory-friends-v1`; unavailable/corrupt storage falls back safely.
- **Rewards:** completing an animal round adds its distinct animals to the collection. Partial rounds add nothing. Every completed round receives the same celebration regardless of guesses; no star penalty or speed scoring.
- **Interaction:** identical mint backs, native card buttons with masked accessible names until flipped, matched cards disabled and retained in position. A mismatch stays visible for 1500 ms. Sound is optional and off initially; a user gesture enables a quiet synthesized chime. Pause provides resume/restart/deck controls; native dialogs manage focus.
- **Lifecycle:** all gameplay delays use `later()` and are cancelled by `startGame()` / `toSetup()`. Pause is temporarily disabled during comparisons and completion. `winGame()` requires a completed round on the active game screen.
- **Responsive/accessibility checks:** verify portrait and landscape at every pair count, reduced motion, keyboard navigation, hidden-card names and completion focus. Landscape uses two rows to preserve large tap targets. The board uses absolute front/back faces; retain the square card geometry.
- **Tests:** run `node --test memory.test.mjs` after game changes. It covers shuffle/decks, matches, validated preferences, album rules, accessible card labels, timer cancellation, completion, and asset presence.

## Little Pilot (current Planes game)

The home Little Pilot link and Daily Adventure's `plane` reward open `sky-playground/`.
This is a static Three.js flying playground with original Blender models, touch/keyboard
steering, three island airports, animal passenger boarding, speed controls, assisted
manual/automatic landings, and a locally saved pilot passport. The original picnic
adventure and free flight remain available. Read `sky-playground/README.md` when changing flight behavior, mission
flow, art, or local preview setup. `flight.js` holds flight rules; `airline.js` holds
airport, boarding, landing assistance, and passport rules; `sky.js` holds stars, balloons, rainbow hoops, the star trail and the saved pilot (`viaan-pilot-v1`: stars, plane paints, trails); `fx.js` draws that playful layer and `tunes.js` synthesizes music; `game.js` owns the browser lifecycle and reaches `fx.js`/`tunes.js` only through optional hooks so controller tests run without them. Stars only come from flying and nothing is ever lost. Run `node --test sky-playground/*.test.mjs` after changes,
and verify a passenger trip, saved passport, and mobile controls in a browser. The `.blend` source files,
GLB exports, and reproducible background Blender script are included. Keep generated
obstacle data and the runtime terrain formula aligned with island edits.

## Little Racer (standalone game)

The home Little Racer link opens `little-racer/`, a static Three.js supercar race:
garage (four vehicles, paints, four tracks), three laps over hills against three
cartoon dogs (Biscuit, Pepper, Waffle; Viaan's own car carries no dog),
steer/boost/brake controls, drift boosts, boost stars, zoom strips, coins, rows of things to knock over
(a different toy per track), bouncers, air spins, a double-coin last lap, low gravity on Rainbow Galaxy, a
loop-the-loop (a double one on two tracks) with a launch strip and real speed changes, a jump and a mega jump, a tunnel, boss races, and a finish card. Read `little-racer/README.md` when
changing race rules, tracks, art, or sound. `race.js` holds all rules in track coordinates
and runs in Node; `game.js` owns the scene, generated scenery, input and lifecycle;
`dogs.js` builds every dog (drivers, the instanced crowd, the race-order faces) in code from `DOGS` in `race.js`;
`audio.js` synthesizes music and effects. It imports Three.js from `sky-playground/vendor`,
so keep those files in place. The car is an original Blender model with no real maker's
name or badge, and the dogs are original characters, not copies of a known cartoon. The car drives by itself (there is no go button). Nothing crashes the car, the loop carries every car round safely, rivals
rubber-band to stay close, and there is no timer. Cups unlock vehicles and boss races. Coins only come from playing and unlock paints (trails were removed; old saves get those coins back); every
finish earns a cup and nothing is ever lost. Choices, coins, unlocks and cups persist in
`viaan-racer-v1`, validated by `normalizePrefs`. `index.html` and `game.js` load their files with a `?v=` number; raise it in both whenever code or styles change.
Run `node --test little-racer/*.test.mjs` after changes and verify a full race, a drift
boost, an unlock, pause, saved choices, and the garage and race display on a wide screen and a phone both ways up.

## Shared conventions

- Keep each standalone game's runtime in its existing folder. `plane.html` remains a compatibility redirect to `sky-playground/`. Games link back to `index.html`.
- Use native buttons and links with meaningful accessible names, visible keyboard focus, and at least 44px controls. Keep Hear controls separate from answer buttons. Native disclosures hide advanced navigation; native dialogs manage example focus.
- Curriculum design uses cream backgrounds, mint/peach/blue/lilac surfaces, restrained shadows, Baloo 2 headings, Nunito text, and original clay renders. Use the tokens in `experience.css`. Respect reduced motion. At narrow widths, world cards become horizontal, games stack, and long story choices stay readable.
- Keep unrelated local documents and mockups untouched. Scope staging to the requested work. Commit/push only when requested and verify the Pages release if publishing.
