# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Viaan is a children's learning app (Math + English) built as a single HTML file with CSS and JS inline, hosted on GitHub Pages. Audio files are served separately from the `audio/` directory. No frameworks, no build tools, no dependencies.

## Architecture

**index.html** — the entire app (~2100 lines). Key sections in order:

1. **CSS variables & styles** (~line 12-335) — design tokens in `:root`, screen-based layout (`.scr.on` toggles visibility), toy-like button styles with press animations. Includes phase navigation (`.ph-hdr`, `.ph-list`), blending (`.bl-bub`, `.bl-hl`), word building (`.wb-slots`, `.wb-lt`), missing letter (`.ml-box`, `.ml-gap`) classes.
2. **State** (~line 316) — `S` object holds game state including `S.phase` for English phase tracking; `S.best` persists star scores to `localStorage` key `vla4`
3. **Data maps** — `PHON` (letter/digraph→phonetic sound, includes `ch`, `sh`, `th`, `ai`, `ee`, `igh`, etc.), `EM` (word→emoji, ~120 entries), `PHASES` (6 SSP phase metadata), `WPH` (word→phoneme-segments for blending), `SW` (sight words grouped by phase)
4. **Curriculum arrays**:
   - `MATH[]` — 4 weeks × 4 levels × 5 questions (16 levels, 80 questions). Question types: `c` (count), `m` (missing), `b` (bigger), `cm`/`cl` (compare more/less), `ad` (addition), `eq` (equation)
   - `ENG[]` — 40 weeks × 4 levels × 5 questions (160 levels, 800 questions). Six SSP phases. Each level has a `ph` field (1-6) for phase grouping. Question types: `lr` (letter recognize), `ls` (letter starts-with), `ul` (upper-lower match), `snd` (sound), `rhy` (rhyme), `sw` (sight word), `fw` (fill word), `bl` (blending), `wb` (word building), `pm` (picture-word match), `ml` (missing letter)
5. **Audio** — wrapped in `/* AUDIO_START */` / `/* AUDIO_END */` markers. `playClip(id)` loads `audio/{id}.mp3` on demand (no base64 embedding). `speakSound(g)` handles digraphs. Clip IDs: `phon_A`-`phon_Z`, `phon_ch`/`phon_sh`/etc., `word_*`, `cheer_*`
6. **Screen navigation** — `show(id)` toggles screens: `home`, `levels`, `game`, `done`
7. **Level select** — `showLvls()` branches: Math uses week-tab + grid; English uses `renderEngLvls()` with phase accordion (colored headers, week rows, compact level buttons)
8. **Game engine** — `startLvl(i)` → `showQ()` → renderer per question type → answer handling → `onOk()`/`onNo()` → `nxt()`/`fin()`
9. **Renderers** — Math: `rCount`, `rMiss`, `rBig`, `rCmp`, `rAdd`, `rEq`. English: `rLR`, `rLS`, `rUL`, `rSnd`, `rRhy`, `rSW`, `rFW`, `rPM` (picture match), `rML` (missing letter), `rBL` (blending with phoneme bubbles), `rWB` (word building with tap-in-order tiles)
10. **Effects** — `flash()` (green/red overlay), `fstar()` (floating star), `conf()` (confetti)

## English Curriculum Structure (SSP Phonics)

The English curriculum follows the UK Letters and Sounds Systematic Synthetic Phonics framework:

| Phase | Weeks | Levels | Focus |
|-------|-------|--------|-------|
| 1 Listening | 1-2 | 8 | Rhyming, sound discrimination |
| 2 First Letters | 3-8 | 24 | s,a,t,p → i,n,m,d → g,o,c,k → ck,e,u,r → h,b,f,ff → l,ll,ss |
| 3 Digraphs | 9-20 | 48 | ch,sh,th,ng + vowel digraphs ai,ee,igh,oa,oo,ar,or,ur,ow,oi,ear,air |
| 4 Blending | 21-26 | 24 | Consonant clusters: -nd,-nt,-mp + bl,cl,fl + br,cr,dr + sp,st,sn,sw |
| 5 Alternatives | 27-38 | 48 | Split digraphs a_e,i_e,o_e,u_e + alternatives ay,ea,ie,oy,ou,ir,ue,ew,aw,ph,oe |
| 6 Fluency | 39-40 | 8 | Decodable sentence reading, spelling review |

Each week has 4 levels (a-d): (a) sound intro, (b) blending/reading, (c) spelling/building, (d) sight words/sentences.

## Audio Pipeline

The app serves ~260 audio clips as MP3 files from the `audio/` directory (26 single-letter phonics + ~40 digraph phonemes + ~120 decodable words + ~50 sight words + ~15 sentences + 5 cheers). Files are loaded on demand by `playClip(id)` which fetches `audio/{id}.mp3`.

**To regenerate audio:**
```
OPENAI_API_KEY=... node generate-audio.js   # generates audio/*.mp3
```

- `generate-audio.js` — calls OpenAI TTS API (model: `tts-1`, voice: `shimmer`, speed: 0.9). Skips clips that already exist in `audio/`. Delete an MP3 to regenerate it.
- `audio/` directory must be committed to the repo so GitHub Pages can serve the files.

## Key Conventions

- All code stays in the single `index.html` file — no splitting into separate JS/CSS files
- Variable names are intentionally terse (single-letter state `S`, short function names) to keep file size small
- CSS classes use 2-3 letter abbreviations (`.scr` = screen, `.qv` = question visual, `.cb` = choice button, `.bl-bub` = blend bubble, `.wb-lt` = word-build letter tile)
- Colors always use CSS variables from `:root`
- All buttons use `touch-action:manipulation` and `-webkit-appearance:none` for mobile
- Adding new question types: add a renderer function (`rXxx`), register it in the map at `showQ()`, add questions to the curriculum arrays
- English levels must include `ph` field (1-6) for phase grouping in the accordion navigation
- Audio block is delimited by `/* AUDIO_START */` / `/* AUDIO_END */` markers — do not remove these
- Audio files live in `audio/` and are loaded on demand — no base64 embedding in index.html
