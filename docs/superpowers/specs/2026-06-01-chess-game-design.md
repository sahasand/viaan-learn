# Chess Game — Design Spec

**Date:** 2026-06-01
**Status:** Approved (design), pending implementation plan
**Deliverable:** A single self-contained `chess.html` file (inline CSS + JS, no build, no frameworks), in the spirit of the Viaan app but standalone.

## Goal

A playable chess game that works well on an iPhone screen. Two modes: two human players (hotseat) and a beginner AI opponent. Core movement rules only.

## Scope

### In scope
- 8×8 board with all six piece types and correct standard starting position.
- Legal move generation for every piece type (geometric legality only).
- Captures by overwriting the target square.
- Turn enforcement: a player may only move their own color; turn flips after a move.
- Two play modes: **Two Players** (hotseat) and **vs Computer** (beginner AI).
- Beginner AI: greedy depth-1 material maximizer.
- Mobile-first responsive layout (portrait priority), tap-to-move interaction.
- New Game / reset, mode toggle, status bar, compact captured-pieces display.

### Out of scope (YAGNI)
- Castling, en passant, pawn promotion.
- Check / checkmate / stalemate detection.
- Move history, undo/redo, PGN, board coordinates labels beyond minimal.
- Drag-and-drop (tap-to-move only — better on phones).
- Network/multiplayer, persistence of games.

### Game-end rule (consequence of "core rules")
Because there is no check/checkmate detection, **the game ends when a king is captured.** Players may legally move into or remain in check; the king is an ordinary capturable piece. Win is declared for the side that captures the opposing king.

## Data model

```
state = {
  board,      // 8x8 array; board[row][col] = null | "wP","bK",... (color + type)
  turn,       // 'w' | 'b'
  selected,   // {r,c} | null  — currently selected square
  legal,      // array of {r,c} — legal destinations for the selected piece
  mode,       // 'hotseat' | 'ai'
  aiColor,    // 'b' (computer plays black in ai mode)
  captured,   // { w: [pieceType,...], b: [...] } — for the tray
  gameOver,   // null | 'w' | 'b' (winner color)
}
```

- Row indexing: `row 0 = rank 8` (black back rank, drawn at top) → `row 7 = rank 1` (white back rank, drawn at bottom).
- Piece codes: 2 chars, `[color][type]`, color ∈ `w|b`, type ∈ `P R N B Q K`.
- Render glyphs: use the **solid (black) Unicode set for all pieces** — ♚♛♜♝♞♟ — and distinguish color with CSS, not glyph choice: white pieces get a light fill + dark outline (`color:#fff; text-shadow`/`-webkit-text-stroke`), black pieces a dark fill. This renders consistently across platforms, where the outline ♔ set is often hard to see on a colored square.

## Components / functions

| Unit | Responsibility | Depends on |
|---|---|---|
| `initBoard()` | Build starting position array | — |
| `legalMoves(r,c)` | All geometrically legal destinations for the piece on (r,c) | board, piece-type movement rules |
| `inBounds(r,c)` | Bounds check | — |
| `slide(r,c,dirs)` | Ray-walk for sliding pieces (R/B/Q) | board, inBounds |
| `move(from,to)` | Apply a move: capture bookkeeping, king-capture → gameOver, flip turn | state |
| `render()` | Draw board grid, selection highlight, legal-move dots, status, tray | state |
| `onSquareTap(r,c)` | Click flow: select / reselect / move | state, legalMoves, move |
| `aiMove()` | Generate all AI legal moves, score by material, pick best (random tie-break), apply | legalMoves, move |
| `newGame()` | Reset state, re-render | initBoard |
| `setMode(m)` | Switch hotseat/ai, reset | newGame |

### Move generation detail
- **Sliding (R/B/Q):** walk each direction vector until edge / friendly piece (stop, exclude) / enemy piece (include capture, stop).
  - Rook dirs: ±(1,0),(0,1). Bishop dirs: ±(1,1),(1,−1). Queen: union of both.
- **Knight:** 8 L-offsets; on-board and not friendly-occupied.
- **King:** 8 adjacent offsets; on-board and not friendly-occupied. (No castling, no check-safety filtering.)
- **Pawn:** direction = white up (−row), black down (+row).
  - Forward 1 if empty.
  - Forward 2 from starting rank if both intermediate and target empty.
  - Diagonal forward only if an enemy piece occupies it (capture).
  - No en passant, no promotion (a pawn reaching the last rank simply stays a pawn).

### AI detail
- Piece values: P=1, N=3, B=3, R=5, Q=9, K=1000.
- For each AI piece, for each legal destination: `score = value(target piece) if capture else 0`.
- Pick max score; ties broken randomly. (Depth-1 greedy. Grabs free material, takes the king when possible. Beatable.)
- Triggered on a short `setTimeout` after the human move so the UI updates first.

## Interaction flow

1. Tap a square holding a piece of the side to move → it becomes `selected`; compute and show `legal` dots.
2. Tap a highlighted legal square → `move(selected → that square)`, clear selection, flip turn, re-render.
3. Tap another own piece → reselect.
4. Tap an empty/invalid square → clear selection.
5. In `ai` mode, after a human (white) move that doesn't end the game, call `aiMove()`.
6. King captured → set `gameOver`, show winner banner, ignore further taps until New Game.

## Mobile-first layout

- **Board sizes to viewport:** square side = `min(100vw, 100svh − headerH − trayH)`; uses `svh` so iOS browser chrome doesn't clip it. Always a full square, no scroll in portrait.
- **Tap targets ≥ 44px:** at 375px width each square ≈ 46px; legal-move dots are large and centered so taps are forgiving.
- **`touch-action: manipulation`** + `-webkit-appearance:none` on interactive elements (matches Viaan convention) to remove tap delay / double-tap zoom.
- **Compact chrome:** thin status bar (whose turn / winner) on top; captured tray as a single small row; New Game + mode toggle as small buttons. No desktop side panel.
- **Light/dark square colors** from CSS variables; selection highlight, legal-move dots, and a simple **last-move highlight** (both from/to squares tinted) — the last-move highlight is included because it's cheap and helps orientation on a small screen.
- Works portrait and landscape; portrait is the priority target.

## Error handling / edge cases

- Taps ignored when `gameOver` is set (until New Game).
- In `ai` mode, taps on the AI's turn are ignored (input locked while AI "thinks").
- Selecting a piece with no legal moves: shows it selected with zero dots; tapping it again or elsewhere deselects.
- Pawn double-step blocked if either square occupied.
- Capturing own piece is impossible (excluded by move gen).
- **AI timer lifecycle:** the queued AI move (`setTimeout`) is stored and cancelled by New Game / mode switch, and `aiTurn` guards against stale callbacks (`mode==='ai' && turn===aiColor`) so a reset during the think-delay can never apply a move to the fresh board.
- **AI with no legal move:** if the AI's side has zero legal moves (king alive but boxed in), `aiTurn` ends the game (opponent wins) instead of freezing with input locked.

## Testing strategy

No build/test harness in this repo (open in browser). Verification is manual + scripted-by-eye:
- **Movement unit checks** (in-browser console or a tiny test block): from known positions, assert `legalMoves` returns the expected destination sets for each piece type, including blocked-by-friendly, capture-enemy, board edges, pawn double-step, pawn diagonal-capture-only.
- **Turn enforcement:** cannot select opponent's piece; turn flips after move.
- **King capture ends game** and declares correct winner.
- **AI:** prefers a free capture; takes the king when offered.
- **Mobile layout:** verify at 375×667 (iPhone SE) and a modern ~390–430px width — board fits without scroll in portrait, squares ≥44px, no tap delay.

## Definition of done

- `chess.html` opens in a browser and plays a full game in both modes.
- All piece types move correctly per the rules above.
- Renders and plays cleanly on an iPhone-width viewport in portrait.
- Self-contained: no external files except (optionally) the same Google Fonts already used by Viaan; otherwise system fonts.
