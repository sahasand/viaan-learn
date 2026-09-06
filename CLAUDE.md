# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Viaan is a children's learning app (Math, English, Critical Thinking) plus three games (Chess, Memory Match, Little Pilot), hosted on GitHub Pages. The curriculum app is a single HTML file (`index.html`) with CSS and JS inline. Chess (`chess.html`) loads local modules from `chess-assets/`; Memory Match (`memory.html`) keeps its code inline and loads local artwork; Little Pilot lives in `sky-playground/` with vendored Three.js and Blender assets. The old `plane.html` URL redirects to Little Pilot. Audio files are served from `audio/`. No build step. The curriculum loads Google Fonts (Baloo 2 + Nunito); Little Pilot serves all runtime dependencies locally.

There is no build or lint step. Serve the repository over HTTP to run Little Pilot (its GLB assets cannot load over `file://`). Memory Match keeps pure logic between `/* LOGIC_START */`…`/* LOGIC_END */` markers for Node VM tests. Chess tests import its local ES modules. Little Pilot has a separate pure `flight.js` module. Run `node --test chess.test.mjs memory.test.mjs sky-playground/flight.test.mjs` for all game tests.

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

## Daily Adventure (Play! button)

The home screen's big **Play!** button (`#advB`, `.adv-btn`, subtitle `#advSub`) serves a ~10–15 min daily mix so a pre-reader never has to navigate world → week → level. The JS lives in a marked `DAILY ADVENTURE` block right after `data()`:

- **Plan**: `advPlan()` builds 4 stops — Eng, Math, Eng, Thinking (interleaved on purpose) — plus a dessert game rotating by day (`ADV_GAMES`: memory/plane/chess, `dayNum() % 3`). Level picks use `frontier(arr, skipId)`: first unplayed level, else first not-yet-perfect (< 90% of max stars), else rotate by day; the second English pick skips the first via `skipId`.
- **Persistence**: today's plan lives at `S.best.__adv = { d: dayStr(), n: <steps done>, g: <game>, s: [{w,id}×4] }` — a non-level `__` key like `__streak`, invisible to star totals. `advToday()` validates date + that every step id still exists (rebuilds if stale), so day rollover or curriculum edits self-heal.
- **Flow**: `advNext()` starts stop `n` (sets `S.adv = {step}` runtime flag, `S.world`, then `startLvl`); when `n ≥ 4` it redirects to the dessert game page. In `fin()`, adventure mode increments `A.n` once (guarded by `S.adv.step === A.n`, so Play Again can't double-count), shows a `🗺 ⭐⭐◦◦ ✈️` trail in `#dcAdv`, and relabels `#dcL` "Next stop ➡" / "🍦 Dessert time!" (`dcL` click routes to `advNext()` when `S.adv` is set; it and `#dcAdv` are reset in the non-adventure branch). `gBk` in adventure mode exits home (not level select); entering a world card manually clears `S.adv`. `show('home')` refreshes the button subtitle via `updateAdvBtn()`.

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

`chess.html` is Little Chess Club, a guided learning game. Read `chess-assets/README.md` when changing chess rules, lesson content, artwork, speech, or UI lifecycle; the old design documents describe the replaced king-capture game.

- **Modules:** `chess-assets/learning.mjs` owns 18 movement challenges and pure practice helpers. `game.mjs` exports an injectable `createClub` controller for DOM/timer tests. `chess.mjs` is the pinned, locally vendored chess.js rules engine with its BSD license.
- **Teaching:** six piece lessons, three one-move challenges each, then a badge saved in `viaan-chess-club-v1`. Puzzles are movement exercises rather than full positions. Practice enforces standard chess rules and offers four promotion choices; kings are never captured.
- **Practice:** Teddy plays black, or two people share a fixed white-at-bottom board. Hints suggest a legal move without altering history. Undo removes the child/Teddy turn pair, or one move in two-player mode. Navigation and reset cancel AI callbacks using a timer plus epoch guard.
- **Accessibility:** native square buttons, roving keyboard focus with arrow keys, explicit piece/square/move labels, on-demand device speech, and reduced-motion support. Mobile places the challenge above the board. Keep lesson goals and spoken directions aligned.
- **Checks:** `node --test chess.test.mjs` tests lesson solvability, blockers/jumps, king safety, badge validation, standard-rule integration, hint non-mutation, promotion and UI lifecycle. Visually verify a full lesson and practice flow after changes.

## Memory Match (standalone game)

`memory.html` is Little Friends, a cream-and-mint memory game reached from the home Memory card (`#wMem`).

- **Logic boundary:** preserve the `LOGIC_START` / `LOGIC_END` and `UI_START` / `UI_END` markers used by `memory.test.mjs`. Pure logic includes deck data, shuffle/matching, `normalizePreferences`, and `mergeAlbum`.
- **Artwork:** Animals uses original transparent Blender renders in `memory-assets/`. Read `memory-assets/README.md` when changing art or regenerating the editable scene. Other decks retain emoji/letters/color swatches. Every deck needs at least eight distinct items.
- **Setup and persistence:** default Animals with 3 pairs; 6 and 8 pairs remain available. Three featured decks precede seven additional decks in a disclosure. Validated deck, size and collected animal IDs persist in localStorage `memory-friends-v1`; unavailable/corrupt storage falls back safely.
- **Rewards:** completing an animal round adds its distinct animals to the collection. Partial rounds add nothing. Every completed round receives the same celebration regardless of guesses; no star penalty or speed scoring.
- **Interaction:** identical mint backs, native card buttons with masked accessible names until flipped, matched cards disabled and retained in position. A mismatch stays visible for 1500 ms. Sound is optional and off initially; a user gesture enables a quiet synthesized chime. Pause provides resume/restart/deck controls; native dialogs manage focus.
- **Lifecycle:** all gameplay delays use `later()` and are cancelled by `startGame()` / `toSetup()`. Pause is temporarily disabled during comparisons and completion. `winGame()` requires a completed round on the active game screen.
- **Responsive/accessibility checks:** verify portrait and landscape at every pair count, reduced motion, keyboard navigation, hidden-card names and completion focus. Landscape uses two rows to preserve large tap targets. The board uses absolute front/back faces; retain the square card geometry.
- **Tests:** run `node --test memory.test.mjs` after game changes. It covers shuffle/decks, matches, validated preferences, album rules, accessible card labels, timer cancellation, completion, and asset presence.

## Little Pilot (current Planes game)

The home Planes card and Daily Adventure's `plane` reward open `sky-playground/`.
This is a static Three.js flying playground with original Blender models, touch/keyboard
steering, terrain and obstacle clearance, five rings, an assisted picnic delivery, and
free flight. Read `sky-playground/README.md` when changing flight behavior, mission
flow, art, or local preview setup. `flight.js` holds pure rules; `game.js` owns the
browser lifecycle. Run `node --test sky-playground/flight.test.mjs` after changes,
and verify the delivery and mobile controls in a browser. The `.blend` source files,
GLB exports, and reproducible background Blender script are included. Keep generated
obstacle data and the runtime terrain formula aligned with island edits.

## Key Conventions

- The curriculum app (Math / English / Thinking) stays in the single `index.html` file; new curriculum features go there. Standalone games have their own files: `#wX` → `chess.html`, `#wMem` → `memory.html`, `#wPl` → `sky-playground/`. Keep Little Pilot's modules and art within its subfolder; keep `plane.html` as the compatibility redirect. Each game provides a route back to `index.html`.
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
