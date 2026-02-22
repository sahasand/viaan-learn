# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Viaan is a children's learning app (Math + English) built as a single self-contained HTML file with embedded CSS, JS, and base64-encoded audio. It targets mobile/tablet via iOS home screen (PWA-like). No frameworks, no build tools, no dependencies.

## Architecture

**index.html** — the entire app. Key sections in order:

1. **CSS variables & styles** (~line 12-256) — design tokens in `:root`, screen-based layout (`.scr.on` toggles visibility), toy-like button styles with press animations
2. **State** (~line 316) — `S` object holds game state; `S.best` persists star scores to `localStorage` key `vla3`
3. **Data maps** — `PHON` (letter→phonetic sound), `EM` (word→emoji)
4. **Curriculum arrays** — `MATH[]` and `ENG[]`, each with 4 weeks × 4 levels × 5 questions. Question types: `c` (count), `m` (missing), `b` (bigger), `cm`/`cl` (compare more/less), `ad` (addition), `eq` (equation), `lr` (letter recognize), `ls` (letter starts-with), `ul` (upper-lower match), `snd` (sound), `rhy` (rhyme), `sw` (sight word), `fw` (fill word)
5. **Audio** — `AUDIO` object with base64 data URIs, `playClip(id)` for playback. Clip IDs: `phon_A`-`phon_Z`, `word_the`/`word_is`/etc., `cheer_great`/`cheer_awesome`/etc.
6. **Screen navigation** — `show(id)` toggles screens: `home`, `levels`, `game`, `done`
7. **Game engine** — `startLvl(i)` → `showQ()` → renderer per question type (`rCount`, `rMiss`, `rBig`, etc.) → `bindCh()`/`bindCmp()` for answer handling → `onOk()`/`onNo()` → `nxt()`/`fin()`
8. **Effects** — `flash()` (green/red overlay), `fstar()` (floating star), `conf()` (confetti)

## Audio Pipeline

The app embeds 41 pre-generated audio clips (26 phonics + 5 sight words + 5 sentences + 5 cheers).

**To regenerate audio:**
```
OPENAI_API_KEY=... node generate-audio.js   # generates audio/*.mp3 + audio-bundle.json
node bundle-audio.js                         # patches index.html with base64 audio
```

- `generate-audio.js` — calls OpenAI TTS API (model: `tts-1`, voice: `shimmer`, speed: 0.9). Skips clips that already exist in `audio/`. Delete an MP3 to regenerate it.
- `bundle-audio.js` — reads `audio-bundle.json`, finds the speech functions block in index.html by string matching, replaces it with the `AUDIO` object + new playback functions.
- `audio/` and `audio-bundle.json` are build artifacts, not committed.

## Key Conventions

- All code stays in the single `index.html` file — no splitting into separate JS/CSS files
- Variable names are intentionally terse (single-letter state `S`, short function names) to keep file size small
- CSS classes use 2-3 letter abbreviations (`.scr` = screen, `.qv` = question visual, `.cb` = choice button)
- Colors always use CSS variables from `:root`
- All buttons use `touch-action:manipulation` and `-webkit-appearance:none` for mobile
- Adding new question types: add a renderer function (`rXxx`), register it in the map at `showQ()`, add questions to the curriculum arrays
