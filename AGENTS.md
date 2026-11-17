# AGENTS.md

## Project and checks

Viaan is a static learning app for a young child, hosted on GitHub Pages. `index.html` is a home page that launches games; it holds no lessons. Math, English and Thinking are three learning games built on a shared kit, and the rest are just-for-fun games in their own folders. No build step. Serve the repository over HTTP, for example `python3 -m http.server 8765`.

Run `node --test home.test.mjs play-kit/*.test.mjs number-playground/*.test.mjs story-garden/*.test.mjs little-detective/*.test.mjs chess.test.mjs memory.test.mjs sky-playground/*.test.mjs little-racer/*.test.mjs little-dominoes/*.test.mjs city-swinger/*.test.mjs`. Check a phone viewport for overflow and usable controls.

## Learning games (Number Playground, Story Garden, Little Detective)

The home cards and the Daily Adventure open `number-playground/` (math), `story-garden/` (English) and `little-detective/` (thinking). They replaced the old five-question lessons, whose shell, data and tests are gone. Read `play-kit/README.md` first, then the game's own README, before changing any of them.

- **Shared kit (`play-kit/`):** `kit.js` is the whole page for every learning game: the map of stops in lands, a visit of tasks, the buddy's speech bubble, the win card, surprise eggs and the sticker book. `progress.js` holds the rules they share and runs in Node: one star bank and one sticker book for all three games (`viaan-rewards-v1`), each game's visits (`viaan-numbers-v1`, `viaan-story-v1`, `viaan-detective-v1`), which stops are open, eggs, and the Daily Adventure hand-off. `audio.js` synthesizes music and effects. A game supplies only `rules.js` (stops and task makers, runs in Node), `game.js` (one function per kind of task) and a few styles.
- **Rules every learning game keeps:** the playing must be the learning: a task is answered by doing it (counting things out, building a word, tapping pictures in order), not by a quiz with a skin. A wrong try only gets a boing and a hint and the task stays open. No timer, no lost stars, no failure. Every visit sets fresh tasks. Finished tasks earn stars, stars hatch eggs holding stickers, hatched animals join the games, and nothing is ever taken away.
- **Number Playground:** 26 stops in three lands; six games (Feed, Pop, More, Domino, Hop, Bowl) at rising difficulty to 20 and skip counting to 100.
- **Story Garden:** the phonics course in `story-garden/words.js`: forty weeks in six phases, in the order the sounds are taught, 114 words, one stop a week. Five games (Hear, Read, Build, Story, Rhyme) mixed from what the week teaches. Keep the course order and the words. Sounds and words always come from the recorded clips in `audio/` (`phon_A` for a single letter in capitals, `phon_ch` for a digraph, `phon_ear` shared by the "eer" in deer, `word_` plus the word); never use device speech for an isolated sound. Wrong choices come only from what has been met, and two spellings of one sound are never set against each other in a listening task.
- **Little Detective:** twelve cases in three lands mixing six puzzles (odd one out, patterns, goes together, what happens next, silly stories, put in order) from `little-detective/cases.js`. Patterns are made fresh and always show their repeating part twice. Silly stories need a spoken caption and a concrete reason; paired pictures alone do not establish an absurdity.
- **Speech:** sounds, words, numbers and cheers are recorded clips in `audio/`. Every sentence the games speak can be recorded too: lines are built as parts in each game's `V` and listed in `lines()`; `play-kit/voice.js` says which have a recording, and the device voice reads any that do not. Everything the three games say (551 lines, 30 numbers, 197 words, 63 letter sounds, the cheers) is recorded in one voice: OpenAI `gpt-4o-mini-tts`, voice `marin`. After changing a spoken line, list it and run `node tools/record-voice.mjs` (it reads `OPENAI_API_KEY` from `.env`, costs the owner money, and needs their say-so; `--dry` is free; `--only=id,id` redoes named clips). The tool cuts the silence off both ends of each clip and asks again for one that comes back silent; keep that, because lines are joined from several clips. The voice sometimes says a wrong word or fills in a "blank", so transcribe new clips back and compare before trusting them; letter sounds can only be checked by ear. The older `generate-audio.js` holds the texts of the letter sounds, and the `prompt_` clips in `audio/` belong to the removed lessons and are unused. No audio generation is needed to build or run the app.
- **Home and Daily Adventure:** `curriculum-assets/home.js` reads the games' saves, plans `vla4.__adv = {d, n, g, s}` (English, Math, English, Thinking, then a game) and opens each stop's game with `?adventure=1`; the game moves the cursor on once when a visit is finished. Older `vla4` lesson scores are left in place and unused.
- **Versions:** every learning-game file, the kit and `home.js` are loaded with the same `?v=` number. Raise it in all of them whenever code or styles change; a test checks they match and that no module is imported without it.
- **Art:** clay PNGs in `curriculum-assets/` (toys, with the Blender source and generator) and `memory-assets/` (animals); other pictures are emoji registered by each game. Do not imply every picture has a clay render.
- **Checks:** after changes, play a visit of each kind of task in the game touched, with a wrong try and a right one, hatch an egg, open the sticker book, follow the Daily Adventure from the home page, and check a phone both ways up.

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
steering, five island airports (Starlight Island is always in the night: flying to it turns day to dusk to a starry sky; Big City is a flat island of towers, built in code by `city.js` and `cityscape.js`, where every star trail runs down Main Avenue and towers are walls the plane slides round), animal passenger boarding on an airport card that shows one step at a time, a 3-2-1 takeoff countdown, speed controls, assisted
manual/automatic landings, an autopilot that flies and lands by itself while the child does the tricks its passenger asks for, and a locally saved pilot passport. The original picnic
adventure and free flight remain available. Read `sky-playground/README.md` when changing flight behavior, mission
flow, art, or local preview setup. `flight.js` holds flight rules; `airline.js` holds
airport, boarding, landing assistance, and passport rules; `sky.js` holds stars, balloons, rainbow hoops, the star trail and the saved pilot (`viaan-pilot-v1`: stars, plane paints, trails, sound choice); `fx.js` draws that playful layer and `tunes.js` synthesizes the engine, a song per island and effects; `game.js` owns the browser lifecycle and reaches `fx.js`/`tunes.js` only through optional hooks so controller tests run without them. Stars only come from flying, are saved the moment they are earned, and nothing is ever lost. Keep star collecting forgiving: each trail starts straight ahead of the takeoff and bends gently, only one trail is in the sky at a time, reach is wide and taller than it is wide, a pilot not steering up or down is eased to the next star's height, and the helping wing never turns back for a star. Stars also come from landing, a delivered passenger, clouds, sea friends and shooting stars. Three planes (Little Prop, Big Jumbo, Zippy Jet) are free to choose in My plane and fly identically; `PLANE_MODELS` in `sky.js` lists them and `tools/build_planes.py` builds the two newer models and all three pictures. Every island's runway faces north and is approached from the south, so a new island needs room for that, must sit inside `WORLD` in `airline.js`, and should be far enough north or south of the others that no trail is too short. They fill the Zoom button while flying and buy paints, trails and toys for the toy button; unlocks are kept for good. The page and modules load one another with a `?v=` number; raise it everywhere whenever code or styles change (a test checks they match). Run `node --test sky-playground/*.test.mjs` after changes,
and verify a passenger trip, stars saved after leaving mid-flight, sound at the airport, saved passport, and mobile controls in a browser. The `.blend` source files,
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

## Little Dominoes (standalone game)

The home Little Dominoes link opens `little-dominoes/`, a static Three.js domino run: drag to stand
dominoes up along the finger's path, tap one, and the line falls while the camera follows it. A bell,
a rocket and a present stand at one end of the mat and go off when a domino falls against them. Nine
ready-made runs: four picture fields (Viaan, Heart, Smiley, Rainbow) of 432 white dominoes that take
their picture colour as they fall, a Sunburst, a Fan, and three single lines (Swirl, Snake, Big tree).
Also Stand up (the fall rewinds), Undo, Clear with a second tap, and four colour palettes. Pictures
are laid the right way up for how the screen is held, and must fit 18 by 18. Read `little-dominoes/README.md` when changing the falling rules, the runs,
the toys or the camera. `topple.js` holds every rule in plain numbers and runs in Node; `game.js` owns
the scene, toys, camera and pointer input; `audio.js` synthesizes sound. It imports Three.js from
`sky-playground/vendor`. The falling is a hand-written model, not a physics engine: each domino tips
about its bottom edge, knocks what is in its path and leans on it. Two rules are deliberately generous
so a child's drawing works: drawn lines bend gently however sharp the scribble, and a domino standing
side on to a falling one is knocked when merely close, which lets a branch fall. Keep both. There is
no score, timer or way to fail, and toys reset themselves so they can go off again. The mat, palette,
sound choice and a running total persist in `viaan-dominoes-v1`, validated by `normalizeSave`; the mat
holds at most 500 dominoes. `index.html` and `game.js` load their files with a `?v=` number; raise it
everywhere whenever code or styles change (a test checks they match). Run
`node --test little-dominoes/*.test.mjs` after changes and verify a drawn line, a gap, a branch, each
toy, each run, Stand up, a reload, and the layout on a wide screen and a phone both ways up.

## City Swinger (standalone game)

The home City Swinger link opens `city-swinger/`, a static Three.js side-on swinging game. Super Viaan,
an original kid hero in a mask and cape, throws a rope to golden hooks, swings over the gaps between
buildings and rescues three friends each mission. He is our own character: never give him or the game
the name, suit, emblem, web or look of an existing superhero (a test checks for borrowed names). Read
`city-swinger/README.md` when changing the swinging, missions, hero or sound. `swing.js` holds every
rule in plain numbers and runs in Node; `game.js` owns the scene, hero, rope, input and screens;
`audio.js` synthesizes sound. It imports Three.js from `sky-playground/vendor` and crowd pictures from
`memory-assets`. One control: hold to throw the rope, let go to fly. Keep it impossible to fail: doing
nothing at all must still reach the finish and rescue everyone (leap, trampoline, stick to the wall,
climb), and holding the screen must swing across every gap by itself. Stars are saved as they are
caught, suits unlock at star totals without spending them, and nothing is ever taken away
(`viaan-swinger-v1`, validated by `normalizeSave`). `index.html` and `game.js` load their files with a
`?v=` number; raise it everywhere whenever code or styles change (a test checks they match). Run
`node --test city-swinger/*.test.mjs` after changes and verify a mission held, tapped and untouched, a
rescue, the finish card, a suit change, pause, and a phone both ways up.

## Shared conventions

- Keep each standalone game's runtime in its existing folder. `plane.html` remains a compatibility redirect to `sky-playground/`. Games link back to `index.html`.
- Use native buttons and links with meaningful accessible names, visible keyboard focus, and at least 44px controls. Keep Hear controls separate from answer buttons. Native disclosures hide advanced navigation; native dialogs manage example focus.
- The home page uses cream backgrounds, mint/peach/blue/lilac surfaces, restrained shadows, Baloo 2 headings, Nunito text, and original clay renders, with the tokens in `experience.css`; the learning games use the brighter look in `play-kit/kit.css`. Respect reduced motion. At narrow widths, world cards become horizontal and games stack.
- Keep unrelated local documents and mockups untouched. Scope staging to the requested work. Commit/push only when requested and verify the Pages release if publishing.
