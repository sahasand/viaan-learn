# Little Chess Club

`../chess.html` is the no-build entry point. Serve the repository over HTTP.

- `learning.mjs`: six pieces × three movement challenges, badge validation,
  lesson move generation, and practice helpers.
- `game.mjs`: browser controller, accessible board buttons, lessons, practice,
  hints, promotion choice, undo, speech and timer cancellation.
- `chess.mjs`: unmodified ESM distribution of **chess.js 1.4.0**, vendored from
  https://registry.npmjs.org/chess.js/-/chess.js-1.4.0.tgz. Download integrity was
  checked against the npm package SHA-512. Upstream: https://github.com/jhlywa/chess.js.
- `LICENSE`: upstream BSD-2-Clause license for chess.js.

Practice uses chess.js for legal moves, king safety, checkmate, stalemate,
castling, en passant, promotion and draws. All four promotion choices are offered.
Teddy is intentionally simple: mostly random legal moves, sometimes a one-move
material/safety heuristic. Hints use the heuristic; they are suggestions, not
claims of an optimal move. Hint search restores the game and its history.

Movement puzzles are separate training boards, not full chess positions. Kings
avoid attacks; pawns move forward and capture diagonally; sliding pieces stop
at blockers. Every goal is reachable in one move. A different legal move receives
encouragement while preserving the challenge. There is no miss counter or clock.

Only completed piece badges persist, in browser storage `viaan-chess-club-v1`.
Practice games and partial lessons are not persisted. Undo in Teddy mode takes
back the child's move and Teddy's reply (or cancels a pending reply). In two-player
mode it takes back one move. Reset/navigation cancels pending AI and speech.

Artwork reuses the existing cburnett/Lichess SVGs in `../pieces/` (GPLv2+) and the
original Blender bear render in `../memory-assets/`. No runtime CDN is needed for
rules or art; optional Google Fonts have local fallbacks. Spoken guidance uses
browser speech synthesis on explicit request, when supported.

Run `node --test chess.test.mjs` from the repository root. Verify a full three-step
lesson, badge persistence, practice/undo, promotion and phone layout when changing
these flows. Arrow keys move focus within the board; Enter/Space activates a square.
