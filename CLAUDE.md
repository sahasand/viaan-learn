# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Viaan is a children's learning app (Math, English, Critical Thinking) plus three standalone games (Chess, Memory Match, Plane Factory), hosted on GitHub Pages. The curriculum app is a single HTML file (`index.html`) with CSS and JS inline; the **Chess** (`chess.html`), **Memory Match** (`memory.html`) and **Plane Factory** (`plane.html`) games are separate self-contained pages (each with inline CSS+JS) linked from the home screen. Audio files are served separately from the `audio/` directory. No frameworks, no build tools. Only external dependency: Google Fonts (Baloo 2 + Nunito).

There is no build or lint step. Open `index.html` in a browser (or push to GitHub Pages) to run. The curriculum app has no tests; the standalone games keep their game logic between `/* LOGIC_START */`…`/* LOGIC_END */` markers and have headless unit tests that extract that block and run it in a Node `vm` sandbox — `node --test chess.test.mjs` (17 tests), `node --test memory.test.mjs` (11 tests) and `node --test plane.test.mjs` (14 tests).

## Architecture

**index.html** (~3990 lines) is the entire app. Key landmarks:

1. **CSS** (lines 17–1771, inside `<style>`) — design tokens in `:root`, screen-based layout (`.scr.on`/`.scr.vis` toggles visibility+transitions), toy-like button styles with press animations. Includes phase navigation (`.ph-hdr`, `.ph-list`), week cards (`.wk-cd`, `.wk-stp`, `.wk-stp-ico`), blending (`.bl-bub`, `.bl-hl`), word building (`.wb-slots`, `.wb-lt`), missing letter (`.ml-box`, `.ml-gap`), and rhyme tap-to-hear buttons (`.cb-rhy`, `.cb-hear`, `.cb-text`). A later block adds screen transitions, entrance animations (`fadeUp`), background depth, hover states, and progress bar polish.
2. **State** (`<script>` starts ~line 1834; `var S` at ~1841) — `S` object holds game state including `S.phase` for English phase tracking; `S.best` persists star scores to `localStorage` key `vla4`.
3. **Data maps** — `PHON` (letter/digraph→phonetic sound, includes `ch`, `sh`, `th`, `ai`, `ee`, `igh`, etc.), `EM` (word→emoji, ~120 entries), `PHASES` (6 SSP phase metadata), `WPH` (word→phoneme-segments for blending), `SW` (sight words grouped by phase).
4. **Curriculum arrays**:
   - `MATH[]` — 4 weeks × 4 levels × 5 questions (16 levels, 80 questions). Question types: `c` (count), `m` (missing), `b` (bigger), `cm`/`cl` (compare more/less), `ad` (addition), `eq` (equation).
   - `ENG[]` — 40 weeks × 4 levels × 5 questions (160 levels, 800 questions). Six SSP phases. Each level has a `ph` field (1–6) for phase grouping. Question types: `lr` (letter recognize), `ls` (letter starts-with), `ul` (upper-lower match), `snd` (sound), `rhy` (rhyme), `sw` (sight word), `fw` (fill word), `bl` (blending), `wb` (word building), `pm` (picture-word match), `ml` (missing letter).
   - `CRIT[]` — 5 skill-units × 4 levels × 5 questions (20 levels, 100 questions). The `w` field is the **unit number** (1–5, one level-select tab each). Question types: `odd` (which one doesn't belong — tap odd picture), `goes` (what goes together — stimulus + partner), `next` (cause→effect), `silly` (tap the absurd emoji scene), `pat` (pattern continuation), `seq` (put pictures in order — reuses the tap-in-order mechanic). Picture choices resolve through `EM`; `silly` choices are `{e,v}` objects carrying **literal** emoji scenes (no `EM` lookup). All are prompt-only audio.
5. **Audio** (lines ~3447–3476) — wrapped in `/* AUDIO_START */` / `/* AUDIO_END */` markers. Primitives: `playClip(id)` loads `audio/{id}.mp3` (singleton — starting a new clip cancels prior). `playSeq(ids, gap)` chains clips via `onended` for prompt-then-target sequences. `speakSound(g)` uppercases single letters then plays `phon_<g>`. `speakWord(w)` sanitizes non-letters to `_` then plays `word_<sanitized>`. `speakPrompt(p)` / `promptId(p)` map question text to `prompt_<sanitized>` (with `PROMPT_ALIAS` override for digit-containing prompts like "Count by 2s!"). `speakNum(n)` plays `num_<n>`. `cheer()` plays a random `cheer_*` on correct answers.
6. **Screen navigation** — `show(id)` (~line 3463) toggles screens `home`, `levels`, `game`, `done`. Uses `.on` (display) + `.vis` (opacity/transform) two-class pattern with double `requestAnimationFrame` for fade+slide.
7. **Level select** — `showLvls()` (~line 3492) branches on world: Math **and Critical Thinking** use the week-tab + grid path (`isGrid`); English uses `renderEngLvls()` with phase accordion (colored headers, week cards with emoji step buttons and derived labels). For Critical Thinking the tabs are labeled with each unit's `title` and tinted with each unit's `color` (rainbow per skill); the world card/title is purple.
8. **Game engine** — `startLvl(i)` (~line 3611) → `showQ()` (~line 3621) → renderer per question type → answer handling → `onOk()`/`onNo()` (~line 3937–3946) → `nxt()`/`fin()`.
9. **Renderers** — Math: `rCount`, `rMiss`, `rBig`, `rCmp`, `rAdd`, `rEq`. English: `rLR`, `rLS`, `rUL`, `rSnd`, `rRhy`, `rSW`, `rFW`, `rPM` (picture match), `rML` (missing letter), `rBL` (blending with phoneme bubbles), `rWB` (word building with tap-in-order tiles). Critical Thinking: `rOdd`, `rGoes`, `rNext`, `rSilly` (all clone `rPM`'s emoji-button pattern; `rSilly` adds `.cb-combo`), `rPat` (sequence strip via `.sr`/`.sb` + emoji choices), `rSeq` (clones `rWB`'s tap-in-order mechanic with emoji tiles + an `order` array). All renderers except `rFW` and `rEq` speak `q.p` (the prompt) on load via `playSeq` before any target audio; the Critical Thinking renderers are prompt-only (pictures aren't named aloud). `rFW` is silent by design (the sentence is shown). `rEq` skips prompt audio because its prompts contain digits that collide on sanitization. `rRhy` uses `chsRhy()` + `bindHear()` to give each text choice a 🔊 preview icon (tap icon → preview, tap word body → commit).
10. **Effects** — `flash()` (green/red overlay), `fstar()` (floating star), `conf()` (confetti), `sfx_oops` clip on wrong (`onNo`), tiered praise clip (`praise_perfect` / `praise_great` / `praise_keepgoing`) on `fin()` keyed by star percentage.

## English Curriculum Structure (SSP Phonics)

The English curriculum follows the UK Letters and Sounds Systematic Synthetic Phonics framework:

| Phase | Weeks | Levels | Focus |
|-------|-------|--------|-------|
| 1 Listening | 1–2 | 8 | Rhyming, sound discrimination |
| 2 First Letters | 3–8 | 24 | s,a,t,p → i,n,m,d → g,o,c,k → ck,e,u,r → h,b,f,ff → l,ll,ss |
| 3 Digraphs | 9–20 | 48 | ch,sh,th,ng + vowel digraphs ai,ee,igh,oa,oo,ar,or,ur,ow,oi,ear,air |
| 4 Blending | 21–26 | 24 | Consonant clusters: -nd,-nt,-mp + bl,cl,fl + br,cr,dr + sp,st,sn,sw |
| 5 Alternatives | 27–38 | 48 | Split digraphs a_e,i_e,o_e,u_e + alternatives ay,ea,ie,oy,ou,ir,ue,ew,aw,ph,oe |
| 6 Fluency | 39–40 | 8 | Decodable sentence reading, spelling review |

Each week has 4 levels (a–d): (a) sound intro, (b) blending/reading, (c) spelling/building, (d) sight words/sentences.

## Critical Thinking Curriculum

A third world (`S.world === 'crit'`, `CRIT[]`) with five reasoning skill-units, modeled on the `criteg.pdf` worksheet pack. Each unit is one level-select tab with four levels (a–d) of five questions:

| Unit (`w`) | Title | Type | Accent |
|---|---|---|---|
| 1 | Odd One Out | `odd` | `#8B5CF6` |
| 2 | Goes Together | `goes` | `#0D9488` |
| 3 | What Happens Next | `next` | `#3B82F6` |
| 4 | That's Silly! | `silly` | `#F97316` |
| 5 | Patterns & Order | `pat` (a,b) + `seq` (c) | `#10B981` |

All picture content is emoji (via `EM`); `silly` scenes embed literal emoji combos. Audio is prompt-only.

### Thinking gamification (mastery & collection)

The Thinking level-select screen renders a **Brain-Power map** above the unit tabs — `renderCritMap(d)` builds it into `#critMap` (shown only when `isCrit`). Per unit (`lv.w`): a medallion with a progress fill (stars earned / 40), a **gold** ring + ✓ when all 4 levels are perfect (10/10), and a **done** state when all 4 are merely completed; tapping a medallion jumps to that unit (`S.week`). Below it a **sticker shelf** shows one earned sticker per completed unit plus a 🏆 grand prize (greyed until all 5 units are complete). All of this is **derived from `S.best`** — no new persisted data except the best streak.

A **streak combo** is app-wide (in the shared `onOk`/`onNo`): `S.streak` counts consecutive correct answers, shows a `🔥 ×N` badge (`#combo`, `showCombo()`) at ≥2, and resets on a miss or at `startLvl`. The best streak persists as `S.best.__streak` (a non-level key, ignored by the per-level star totals which iterate the level arrays) and is shown on the done screen (`#dcStreak`, with a "New best streak!" variant via `S.newRecord`). No timers/speed scoring — mastery and persistence only, by design (don't rush reasoning).

## Audio Pipeline

The app serves ~381 MP3 clips from the `audio/` directory. Categories by ID prefix:

| Prefix | Count | Used by |
|---|---|---|
| `phon_*` | ~50 | Single letters (`phon_A`–`phon_Z`, uppercase) + digraphs (`phon_ch`, `phon_ai`, etc.). Played by `rSnd`, `rLR`, `rUL`, blending phonemes in `rBL`, per-tile feedback in `rWB`. |
| `word_*` | ~150 | Decodable words, sight words, rhyme targets, picture-match words. Played by `rPM`, `rML`, `rBL` (final blend), `rWB` (load), `rSW`, `rRhy`, choice icons in `rRhy`. |
| `num_*` | 18 | Spelled-out numbers (`num_0` = "zero" ... `num_30` = "thirty"). Played by Math renderers — `rCount` counts up one-by-one, `rMiss`/`rBig`/`rCmp`/`rAdd` speak operands on load. |
| `prompt_*` | ~101 | Spoken question text. Every `q.p` value gets one (except `fw` and `eq` whose prompts don't sound meaningful). Played on load by every audio-enabled renderer. Includes the Critical Thinking prompts (`prompt_Which_one_doesn_t_belong_`, `prompt_What_goes_together_`, `prompt_What_happens_next_`, `prompt_What_s_silly_here_`, `prompt_Put_them_in_order_`; `pat` reuses the existing `prompt_What_comes_next_`). |
| `cheer_*` | 5 | Correct-answer reaction. `cheer()` picks randomly. |
| `praise_*` | 3 | Level-end tiered voice (`perfect` ≥90%, `great` ≥60%, `keepgoing` below). |
| `sfx_oops` | 1 | Wrong-answer sound. |

**To regenerate audio:**
```
node generate-audio.js   # reads OPENAI_API_KEY from .env or env; writes audio/*.mp3
```

- Model: `gpt-4o-mini-tts` (OpenAI's newest TTS, supports natural-language `instructions`). Voice: `shimmer`. No `speed` parameter — pacing is steered via the per-clip instructions returned by `instructionsFor(id)`, which branches by ID prefix: phonemes get "slow articulated", numbers get "warm counting", cheers get "bright enthusiasm", `sfx_oops` gets "gentle not scolding", default is "warm early-childhood read-aloud".
- Skip-if-exists: the generator skips any clip already in `audio/`. To re-record one, delete it and rerun. To re-record everything (e.g., voice change), `rm audio/*.mp3 && node generate-audio.js`.
- The `audio/` directory must be committed so GitHub Pages can serve the files.
- `.env` and `audio-bundle.json` are gitignored.

**Clip ID convention** (must match between generator and renderer):
- `word_X` where `X = w.replace(/[^a-zA-Z]/g, '_')` — used by `speakWord`. Sentences with spaces become `word_I_see_a_cat_` etc.
- `phon_X` where single letters are **uppercase** (case-sensitive on GitHub Pages Linux — macOS APFS hides case mismatches locally). `speakSound` does the uppercasing automatically for single letters; digraphs stay lowercase.
- `prompt_X` where `X` is sanitized prompt text. Prompts containing digits collide (e.g., all "What + N = M?" become `prompt_What_________`) — those renderers must skip prompt audio.

## Chess (standalone game)

`chess.html` is a core-rules chess game (no frameworks/build), reached from the home screen's Chess world card. It loads piece artwork from the `pieces/` folder (so it's not a single self-contained file). Design philosophy and conventions are documented in `docs/superpowers/specs/2026-06-01-chess-game-design.md` and `docs/superpowers/plans/2026-06-01-chess-game.md`.

- **Two marked sections** inside the single `<script>`: a pure, DOM-free rules engine between `/* LOGIC_START */`…`/* LOGIC_END */` (the unit-test surface), and the UI/state/render/interaction code between `/* UI_START */`…`/* UI_END */`. Keep this split — `chess.test.mjs` extracts the LOGIC block via these exact markers.
- **Rules:** core movement + captures + turn enforcement only. No castling, en passant, promotion, or check/checkmate — a game ends when a **king is captured** (`applyMove` returns a `winner`).
- **Modes:** Two Players (hotseat) and vs Computer (a greedy depth-1 material AI, `aiPickMove`). The AI reply is on a `setTimeout` stored in `aiTimer` and cancelled by `newGame()`; `aiTurn` guards against stale callbacks (`mode==='ai' && turn===aiColor`).
- **Pieces & board:** pieces are SVG artwork (cburnett / Lichess set, GPLv2+) self-hosted in `pieces/` (`pieces/<color><type>.svg`, e.g. `pieces/wP.svg`), rendered as each square's `background-image` via `pieceSrc(p)`; captured pieces in the trays are `<img>`. Board uses the Lichess palette (`--lt:#f0d9b5` / `--dk:#b58863`) with a–h / 1–8 coordinate labels. (Earlier Unicode-glyph rendering was replaced because iOS rendered the filled glyphs as dark emoji.)
- **Mobile-first:** board sizes to `min(96vw, calc(100svh − 150px))`, tap-to-move, `touch-action:manipulation`.
- **Tests:** `node --test chess.test.mjs` (17 tests) covers move generation, captures, the AI, and the UI timer/lifecycle (via a stubbed-DOM `vm` sandbox). Run it after any change to `chess.html`.

## Memory Match (standalone game)

`memory.html` is a self-contained card-matching game (bright/bubbly kid styling, silent), reached from the home screen's Memory world card (`#wMem`).

- **Two marked sections** like Chess: pure logic between `/* LOGIC_START */`…`/* LOGIC_END */` (deck data, `shuffle`, `buildGame`, `cardsMatch`, `isWin` — the `memory.test.mjs` surface) and the DOM/UI between `/* UI_START */`…`/* UI_END */`.
- **Decks:** `DECKS` map, grouped by `cat` (`Pictures`: animals/food/vehicles/faces/nature — emoji; `Learning`: letters/numbers/shapes/weather — emoji/char, and `colors` with `kind:'color'` rendered as CSS swatches). Each deck needs ≥8 DISTINCT items (Hard = 8 pairs; `buildGame` slices distinct items, and the test asserts uniqueness).
- **Difficulty:** `SIZES` (easy 3 / medium 6 / hard 8 pairs; `cols` 2/3/4). Player picks deck + size on the setup screen each game; no progress persisted.
- **Gameplay:** tap-to-flip with 3D CSS flip (`.card.up`/`.card.done`), input locked during the compare delay, matched pairs get a golden-ring pop, confetti on win. Card faces scale via container queries (`cqmin`) with a `rem` fallback. Note: `.cf`/`.cf-d`/`.cf-u` are `position:absolute` overlays — do not add `position:relative` to `.cf-d` (it collapses the card height; the sparkle `::after` already works since an absolute parent is a containing block).
- **Polish:** sparkle-dot card backs (`.cf-d::after`), color-echo face borders (per `.g0`–`.g5`), staggered deal-in on game start (`.card.deal`, self-removed on `animationend` so it can't re-trigger after a `.shake`), wordless mismatch shake (`.card.shake`), a live progress bar in the `#pairs` stat, and a per-game 1–3 star rating on the win overlay (`starsFor(moves,pairs)`, pure/tested, **not** persisted) with a spring pop-in.
- **Timer lifecycle:** gameplay timeouts go through `later()` (tracked in `timers[]`) so `startGame()`/`toSetup()` can `clearTimers()` them — prevents a stale flip-back/match/win callback firing on a rebuilt board or the setup screen; `winGame()` also guards on the game screen being active.
- **Mobile fit:** `#board` width is capped by both viewport width and available height via per-game `--cols`/`--rows` (set in `buildBoard`), and `.scr` padding respects `env(safe-area-inset-*)` for notched phones.
- **Tests:** `node --test memory.test.mjs` (11 tests) covers deck integrity (incl. ≥8 distinct items per deck), `buildGame` pair/count correctness, deterministic seeded shuffle, match/win logic, `starsFor`, and UI control-flow (load, timer cancellation, win guard via a stubbed-DOM `vm` sandbox). Run it after any change to `memory.html`.

## Plane Factory (standalone game)

`plane.html` is a self-contained game that teaches the build-with-AI loop (describe → generate → check → refine) to a pre-reader, reached from the home screen's Planes world card (`#wPl`). Design doc: `docs/superpowers/specs/2026-08-17-plane-factory-design.md`.

- **Concept:** the child "prompts" a robot engineer (🤖) by tapping picture tiles in 4 categories (`CATS`: color / wings / engine / sticker); `robotBuild` fills any UNCHOSEN category with a random guess and marks it (🎲 chip badge) — the deliberate AI lesson: vague instructions → surprises. No real AI calls (static site), no reading required, silent like Memory Match, no persistence.
- **Two marked sections** like Chess/Memory: pure logic between `/* LOGIC_START */`…`/* LOGIC_END */` (`CATS`, `randomSpec`, `robotBuild`, `compareSpec`, `starsFor`, `flightStep`, `starHit` — the `plane.test.mjs` surface; RNG always injectable) and the DOM/UI between `/* UI_START */`…`/* UI_END */`.
- **Modes:** **Customer Orders** (5 orders per game: a customer animal shows a random target plane; the child must pick the instructions that produce it; `compareSpec` marks per-part ✓/✗ chips; attempts → `starsFor` 3/2/1; after 2 misses the correct tiles glow via `R.hints`) and **Free Build** (sandbox, endless).
- **Plane artwork:** one `planeSVG(spec)` builder draws a top-down SVG plane (fuselage/cockpit/wings/tailplane, propeller blur or twin jet pods, sticker glyphs) parameterised by the spec; used for targets, builds, and the flight sprite (rotated 90° via CSS in flight).
- **Flight:** after a good build the plane flies (hold-to-climb, release-to-glide, collect 5 scrolling 🌟; no fail state). Physics is the pure `flightStep` with **dt from real elapsed time** (capped at 0.12s) so throttled timers can't cause slow motion; the loop runs on `requestAnimationFrame` with a `later()` fallback so the vm tests can drive it.
- **Timer lifecycle:** same `later()`/`clearTimers()` pattern as Memory; `startOrders`/`startFree`/`toSetup` cancel pending build-reveal and flight-start timers, and `winGame()` guards on the workshop screen being active.
- **Tests:** `node --test plane.test.mjs` (14 tests) covers catalogue integrity, deterministic `randomSpec`, `robotBuild` keep/guess behaviour, `compareSpec`, star thresholds, flight physics clamps, `starHit`, and UI control-flow (load, first-try 3 stars, two-miss hints, timer cancellation, win guard via a stubbed-DOM `vm` sandbox). vm objects have foreign prototypes — compare with the `plain()` JSON round-trip helper, not `deepStrictEqual`. Run it after any change to `plane.html`.

## Key Conventions

- The curriculum app (Math / English / Thinking) stays in the single `index.html` file — no splitting *its* code into separate JS/CSS files; new curriculum features go in `index.html`. The exceptions are the standalone **games**: **Chess** (`chess.html` + `chess.test.mjs` + `pieces/` SVG artwork), **Memory Match** (`memory.html` + `memory.test.mjs`) and **Plane Factory** (`plane.html` + `plane.test.mjs`), each self-contained (inline CSS+JS) and reached from its own world card (`#wX` → `chess.html`, `#wMem` → `memory.html`, `#wPl` → `plane.html`). Each game page has a "← Menu" link back to `index.html`.
- Variable names are intentionally terse (single-letter state `S`, short function names) to keep file size small.
- CSS classes use 2–3 letter abbreviations (`.scr` = screen, `.qv` = question visual, `.cb` = choice button, `.bl-bub` = blend bubble, `.wb-lt` = word-build letter tile, `.wk-cd` = week card, `.wk-stp` = week step button).
- Colors always use CSS variables from `:root`.
- All buttons use `touch-action:manipulation` and `-webkit-appearance:none` for mobile.
- Adding new question types: add a renderer function (`rXxx`), register it in the map at `showQ()`, add questions to the curriculum arrays.
- English levels must include `ph` field (1–6) for phase grouping in the accordion navigation.
- Audio block is delimited by `/* AUDIO_START */` / `/* AUDIO_END */` markers — do not remove these.
- Audio files live in `audio/` and are loaded on demand — no base64 embedding in `index.html`.
- When adding a renderer that should speak its prompt: call `playSeq([promptId(q.p), ...targetIds], 250)` inside a `setTimeout(..., 400)` so it fires after the question entrance animation. The 400ms delay matches the existing pattern across all audio-enabled renderers.
- When adding a new question type that uses words/sounds the curriculum doesn't already reference, add them to `generate-audio.js` and rerun. Always cross-check via the alignment script pattern used in this repo (extract all referenced clip IDs from `ENG[]`/`MATH[]`, `LC_ALL=C comm` against `ls audio/`) — 0 missing is the success condition.

## Design System

- **Fonts**: Baloo 2 (display: titles, headings, prompts via `--fn-d`) + Nunito (body: buttons, labels via `--fn`), loaded from Google Fonts.
- **Screen transitions**: `.scr.on` shows the screen (`display:flex`), `.scr.vis` fades it in (opacity/transform 300ms). `show()` uses double `requestAnimationFrame` to trigger the transition after the display change.
- **Entrance animations**: `@keyframes fadeUp` with staggered `animation-delay` on child elements per screen.
- **Backgrounds**: Home has drifting color blobs (`::before` pseudo-element), levels has dot pattern (`::after`), done has golden radial glow.
- **Progress bar**: 14px height with star emoji marker riding the fill edge via `::after`.
- **Question transitions**: `showQ()` wraps content swap in 150ms fade (`.q-out` class).
- **Hover states**: Gated behind `@media(hover:hover)` so mobile is unaffected.
- **Completion indicators**: Golden outline on `.lv-card.dn`, golden ring + star badge on `.wk-stp.dn`.
- **English level cards**: Week cards (`.wk-cd`) with header showing week number + topic, 4 step buttons (`.wk-stp`) with 50px emoji icons, glass-shine overlay, and derived short labels (Read/Spell/Words/topic). Staggered `fadeUp` entrance via nth-child delays.
