# Chess Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `chess.html` that plays core-rules chess on an iPhone-friendly screen, in two modes (two human players and a beginner AI).

**Architecture:** One HTML file. Pure, DOM-free chess logic lives between `/* LOGIC_START */`…`/* LOGIC_END */` and is unit-tested headlessly with Node by extracting that block and running it in a `vm` sandbox. The UI layer (`/* UI_START */`…`/* UI_END */`) holds mutable `S` state and the render/interaction code, calling the pure logic. Tap-to-move interaction; mobile-first CSS sizes the board to the viewport.

**Tech Stack:** Plain HTML/CSS/JS (no frameworks, no bundler). Tests: Node ≥18 built-in `node:test` + `node:assert` + `node:vm`. System fonts.

---

## File Structure

| File | Responsibility |
|---|---|
| `chess.html` | The entire app: `<head>`+CSS, board/controls markup, and `<script>` with a pure LOGIC block and a UI block. The single deliverable. |
| `chess.test.mjs` | Dev-only Node test: extracts the LOGIC block from `chess.html`, evals it in a `vm` context, asserts move-generation / capture / AI behavior. Not shipped; kept in repo for regression. |

**Pure LOGIC API (DOM-free, the unit-test surface):**
- `initBoard()` → 8×8 array (row 0 = rank 8 / black back rank; row 7 = white back rank)
- `inBounds(r,c)` → bool
- `slide(board,r,c,dirs,color)` → `[{r,c}]`
- `legalMoves(board,r,c)` → `[{r,c}]`
- `applyMove(board,from,to)` → `{board, captured, winner}` (pure; returns a new board)
- `allMoves(board,color)` → `[{from,to}]`
- `aiPickMove(board,color)` → `{from,to} | null`

**UI layer (manual-verify only):** `S` state, `GLYPH`, `buildGrid()`, `render()`, `renderTray()`, `onSquareTap()`, `doMove()`, `aiTurn()`, `newGame()`, `setMode()`, button wiring.

Piece codes: 2 chars `[color][type]`, color ∈ `w|b`, type ∈ `P R N B Q K`.

---

## Task 1: Scaffold + test harness + `initBoard`

**Files:**
- Create: `chess.html`
- Create: `chess.test.mjs`

- [ ] **Step 1: Create `chess.html` skeleton with empty LOGIC/UI blocks**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Chess</title>
<style>
/* CSS added in Task 7 */
</style>
</head>
<body>
  <div id="status">White to move</div>
  <div class="tray" id="trayTop"></div>
  <div id="board"></div>
  <div class="tray" id="trayBot"></div>
  <div id="bar">
    <button id="mode-hot" class="act" type="button">Two Players</button>
    <button id="mode-ai" type="button">vs Computer</button>
    <button id="new" type="button">New Game</button>
  </div>
  <script>
/* LOGIC_START */
function initBoard(){
  var back = ['R','N','B','Q','K','B','N','R'];
  var b = [];
  for (var r=0;r<8;r++){ b.push([null,null,null,null,null,null,null,null]); }
  for (var c=0;c<8;c++){
    b[0][c] = 'b'+back[c];
    b[1][c] = 'bP';
    b[6][c] = 'wP';
    b[7][c] = 'w'+back[c];
  }
  return b;
}
/* LOGIC_END */
/* UI_START */
/* UI added in Tasks 8-10 */
/* UI_END */
  </script>
</body>
</html>
```

- [ ] **Step 2: Create the failing test `chess.test.mjs`**

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const htmlPath = fileURLToPath(new URL('./chess.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf8');
const m = html.match(/\/\* LOGIC_START \*\/([\s\S]*?)\/\* LOGIC_END \*\//);
if (!m) throw new Error('LOGIC markers not found in chess.html');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);   // top-level function/var decls attach to sandbox global

export const API = sandbox;

// ---- helpers ----
export function empty(){ return Array.from({length:8}, () => Array(8).fill(null)); }
export function has(moves, r, c){ return moves.some(mv => mv.r === r && mv.c === c); }

// ---- tests ----
test('initBoard places the standard starting position', () => {
  const b = sandbox.initBoard();
  assert.equal(b.length, 8);
  assert.equal(b[0][0], 'bR');
  assert.equal(b[0][4], 'bK');
  assert.equal(b[1][3], 'bP');
  assert.equal(b[6][3], 'wP');
  assert.equal(b[7][4], 'wK');
  assert.equal(b[7][0], 'wR');
  assert.equal(b[3][3], null);
  assert.equal(b[4][4], null);
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node --test chess.test.mjs`
Expected: `pass 1` (the `initBoard` test passes; the harness successfully extracted and evaluated the LOGIC block).

- [ ] **Step 4: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): scaffold chess.html + node vm test harness + initBoard"
```

---

## Task 2: Sliding pieces — `inBounds`, `slide`, rook/bishop/queen

**Files:**
- Modify: `chess.html` (append inside LOGIC block, before `/* LOGIC_END */`)
- Modify: `chess.test.mjs` (append tests)

- [ ] **Step 1: Write failing tests for sliding pieces**

Append to `chess.test.mjs`:

```js
test('rook: slides on open lines, stops before friendly, captures enemy', () => {
  const b = empty();
  b[4][4] = 'wR';
  b[4][7] = 'bP';   // enemy to the right
  b[4][1] = 'wP';   // friendly to the left
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 4, 5));   // open
  assert.ok(has(mv, 4, 6));   // open up to enemy
  assert.ok(has(mv, 4, 7));   // capture enemy
  assert.ok(!has(mv, 4, 1));  // friendly blocks (cannot land)
  assert.ok(!has(mv, 4, 0));  // cannot pass friendly
  assert.ok(has(mv, 0, 4));   // full open column
  assert.ok(has(mv, 7, 4));
});

test('bishop: diagonals only, blocked correctly', () => {
  const b = empty();
  b[4][4] = 'wB';
  b[2][2] = 'bP';   // enemy up-left
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 3, 3));   // toward enemy
  assert.ok(has(mv, 2, 2));   // capture
  assert.ok(!has(mv, 1, 1));  // cannot pass enemy
  assert.ok(has(mv, 5, 5));   // other diagonal open
  assert.ok(!has(mv, 4, 5));  // not a straight move
});

test('queen: combines rook + bishop directions', () => {
  const b = empty();
  b[4][4] = 'wQ';
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 4, 0)); // rank
  assert.ok(has(mv, 0, 4)); // file
  assert.ok(has(mv, 0, 0)); // diagonal
  assert.ok(has(mv, 7, 1)); // diagonal
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: FAIL — `sandbox.legalMoves is not a function`.

- [ ] **Step 3: Implement sliding logic**

Append inside the LOGIC block of `chess.html` (just before `/* LOGIC_END */`):

```js
function inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }

function slide(board,r,c,dirs,color){
  var moves=[];
  for (var i=0;i<dirs.length;i++){
    var dr=dirs[i][0], dc=dirs[i][1];
    var nr=r+dr, nc=c+dc;
    while (inBounds(nr,nc)){
      var t=board[nr][nc];
      if (!t){ moves.push({r:nr,c:nc}); }
      else { if (t[0]!==color){ moves.push({r:nr,c:nc}); } break; }
      nr+=dr; nc+=dc;
    }
  }
  return moves;
}

function legalMoves(board,r,c){
  var p=board[r][c];
  if(!p) return [];
  var color=p[0], type=p[1];
  if (type==='R'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1]],color); }
  if (type==='B'){ return slide(board,r,c,[[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  if (type==='Q'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  return [];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): sliding move generation (rook, bishop, queen)"
```

---

## Task 3: Knight and king

**Files:**
- Modify: `chess.html` (LOGIC block), `chess.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `chess.test.mjs`:

```js
test('knight: 8 L-moves from center, edge-clamped, no friendly landing', () => {
  const b = empty();
  b[4][4] = 'wN';
  b[2][5] = 'wP'; // friendly on one L-target
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.equal(mv.length, 7);          // 8 minus the friendly-blocked one
  assert.ok(has(mv, 6, 5));
  assert.ok(has(mv, 2, 3));
  assert.ok(!has(mv, 2, 5));           // friendly blocks
  const corner = empty();
  corner[0][0] = 'bN';
  const cm = sandbox.legalMoves(corner, 0, 0);
  assert.equal(cm.length, 2);          // only (1,2) and (2,1)
  assert.ok(has(cm, 1, 2));
  assert.ok(has(cm, 2, 1));
});

test('king: 8 adjacent squares, edge-clamped, captures enemy', () => {
  const b = empty();
  b[4][4] = 'wK';
  b[4][5] = 'bP'; // capturable
  b[3][3] = 'wP'; // friendly blocks
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.equal(mv.length, 7);          // 8 minus friendly
  assert.ok(has(mv, 4, 5));            // capture enemy
  assert.ok(!has(mv, 3, 3));           // friendly
  const corner = sandbox.legalMoves((()=>{const x=empty();x[0][0]='wK';return x;})(), 0, 0);
  assert.equal(corner.length, 3);      // (0,1),(1,0),(1,1)
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: FAIL — knight/king cases return `[]` (assertions on length fail).

- [ ] **Step 3: Implement knight + king**

In `chess.html` LOGIC block, replace the body of `legalMoves` so it handles N and K. The full updated function (replace the existing `legalMoves`):

```js
function legalMoves(board,r,c){
  var p=board[r][c];
  if(!p) return [];
  var color=p[0], type=p[1];
  var moves=[];
  if (type==='R'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1]],color); }
  if (type==='B'){ return slide(board,r,c,[[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  if (type==='Q'){ return slide(board,r,c,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],color); }
  if (type==='N'){
    var no=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (var i=0;i<no.length;i++){
      var nr=r+no[i][0], nc=c+no[i][1];
      if (inBounds(nr,nc) && (!board[nr][nc] || board[nr][nc][0]!==color)) moves.push({r:nr,c:nc});
    }
    return moves;
  }
  if (type==='K'){
    var ko=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (var j=0;j<ko.length;j++){
      var kr=r+ko[j][0], kc=c+ko[j][1];
      if (inBounds(kr,kc) && (!board[kr][kc] || board[kr][kc][0]!==color)) moves.push({r:kr,c:kc});
    }
    return moves;
  }
  return moves;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): knight and king move generation"
```

---

## Task 4: Pawns

**Files:**
- Modify: `chess.html` (LOGIC block), `chess.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `chess.test.mjs`:

```js
test('white pawn: forward one and two from start, diagonal capture only', () => {
  const b = empty();
  b[6][4] = 'wP';        // white pawn on its start rank
  b[5][5] = 'bP';        // capturable diagonally
  const mv = sandbox.legalMoves(b, 6, 4);
  assert.ok(has(mv, 5, 4));   // forward one
  assert.ok(has(mv, 4, 4));   // forward two from start
  assert.ok(has(mv, 5, 5));   // diagonal capture
  assert.ok(!has(mv, 5, 3));  // empty diagonal is NOT a move
});

test('white pawn: forward blocked by any piece, double blocked if path occupied', () => {
  const b = empty();
  b[6][4] = 'wP';
  b[5][4] = 'bP';        // directly ahead blocks both forward steps
  const mv = sandbox.legalMoves(b, 6, 4);
  assert.ok(!has(mv, 5, 4));  // blocked (cannot capture straight)
  assert.ok(!has(mv, 4, 4));  // double blocked
  const b2 = empty();
  b2[6][4] = 'wP';
  b2[4][4] = 'bP';       // two ahead occupied
  const mv2 = sandbox.legalMoves(b2, 6, 4);
  assert.ok(has(mv2, 5, 4));  // one ahead still ok
  assert.ok(!has(mv2, 4, 4)); // double blocked by target
});

test('black pawn: moves down the board (increasing row)', () => {
  const b = empty();
  b[1][3] = 'bP';
  b[2][2] = 'wP';        // capturable
  const mv = sandbox.legalMoves(b, 1, 3);
  assert.ok(has(mv, 2, 3));   // forward one
  assert.ok(has(mv, 3, 3));   // forward two from start
  assert.ok(has(mv, 2, 2));   // diagonal capture
  const mid = empty();
  mid[4][3] = 'bP';           // not on start rank
  const mm = sandbox.legalMoves(mid, 4, 3);
  assert.ok(has(mm, 5, 3));
  assert.ok(!has(mm, 6, 3));  // no double when not on start rank
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: FAIL — pawn returns `[]`.

- [ ] **Step 3: Implement pawn logic**

In `chess.html` LOGIC block, add a pawn branch to `legalMoves` (insert before the final `return moves;`):

```js
  if (type==='P'){
    var dir = (color==='w') ? -1 : 1;
    var startRow = (color==='w') ? 6 : 1;
    var oneR = r+dir;
    if (inBounds(oneR,c) && !board[oneR][c]){
      moves.push({r:oneR,c:c});
      var twoR = r+2*dir;
      if (r===startRow && inBounds(twoR,c) && !board[twoR][c]) moves.push({r:twoR,c:c});
    }
    var caps=[[dir,-1],[dir,1]];
    for (var k=0;k<caps.length;k++){
      var pr=r+caps[k][0], pc=c+caps[k][1];
      if (inBounds(pr,pc) && board[pr][pc] && board[pr][pc][0]!==color) moves.push({r:pr,c:pc});
    }
    return moves;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): pawn move generation (push, double, diagonal capture)"
```

---

## Task 5: `applyMove` and `allMoves`

**Files:**
- Modify: `chess.html` (LOGIC block), `chess.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `chess.test.mjs`:

```js
test('applyMove: moves the piece, clears origin, is non-mutating', () => {
  const b = empty();
  b[6][4] = 'wP';
  const res = sandbox.applyMove(b, {r:6,c:4}, {r:4,c:4});
  assert.equal(res.board[4][4], 'wP');
  assert.equal(res.board[6][4], null);
  assert.equal(res.captured, null);
  assert.equal(res.winner, null);
  assert.equal(b[6][4], 'wP');   // original board untouched (pure)
  assert.equal(b[4][4], null);
});

test('applyMove: capturing a king sets winner to the mover color', () => {
  const b = empty();
  b[4][4] = 'wQ';
  b[4][7] = 'bK';
  const res = sandbox.applyMove(b, {r:4,c:4}, {r:4,c:7});
  assert.equal(res.captured, 'bK');
  assert.equal(res.winner, 'w');
});

test('allMoves: lists every legal move for a color as {from,to}', () => {
  const b = empty();
  b[7][4] = 'wK';        // 5 king moves available on empty board edge row (row 7)
  b[6][4] = 'wP';        // pawn adds moves
  const list = sandbox.allMoves(b, 'w');
  assert.ok(list.length > 0);
  assert.ok(list.every(mv => mv.from && mv.to));
  // black has no pieces -> no moves
  assert.equal(sandbox.allMoves(b, 'b').length, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: FAIL — `sandbox.applyMove is not a function`.

- [ ] **Step 3: Implement `applyMove` + `allMoves`**

Append inside the LOGIC block of `chess.html`:

```js
function cloneBoard(board){ return board.map(function(row){ return row.slice(); }); }

function applyMove(board, from, to){
  var nb = cloneBoard(board);
  var moving = nb[from.r][from.c];
  var captured = nb[to.r][to.c];
  nb[to.r][to.c] = moving;
  nb[from.r][from.c] = null;
  var winner = (captured && captured[1]==='K') ? moving[0] : null;
  return { board: nb, captured: captured, winner: winner };
}

function allMoves(board,color){
  var list=[];
  for (var r=0;r<8;r++){
    for (var c=0;c<8;c++){
      var p=board[r][c];
      if (p && p[0]===color){
        var ms=legalMoves(board,r,c);
        for (var i=0;i<ms.length;i++){ list.push({from:{r:r,c:c}, to:ms[i]}); }
      }
    }
  }
  return list;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): applyMove (pure) and allMoves enumerator"
```

---

## Task 6: Beginner AI — `aiPickMove`

**Files:**
- Modify: `chess.html` (LOGIC block), `chess.test.mjs`

- [ ] **Step 1: Write failing tests**

Append to `chess.test.mjs`:

```js
test('aiPickMove: grabs the most valuable free capture', () => {
  const b = empty();
  b[4][4] = 'bN';        // AI (black) knight
  b[2][5] = 'wQ';        // queen reachable by knight L-move (value 9)
  b[6][5] = 'wP';        // pawn also reachable (value 1)
  const mv = sandbox.aiPickMove(b, 'b');
  // Compare fields, not whole objects: vm-sandbox objects carry a different
  // realm prototype, which trips node:assert/strict's deepStrictEqual.
  assert.equal(mv.from.r, 4); assert.equal(mv.from.c, 4);
  assert.equal(mv.to.r, 2);   assert.equal(mv.to.c, 5);   // prefers the queen
});

test('aiPickMove: takes the king when offered', () => {
  const b = empty();
  b[4][4] = 'bR';
  b[4][0] = 'wK';        // rook can slide to capture the king
  const mv = sandbox.aiPickMove(b, 'b');
  assert.equal(mv.to.r, 4); assert.equal(mv.to.c, 0);
  const res = sandbox.applyMove(b, mv.from, mv.to);
  assert.equal(res.winner, 'b');
});

test('aiPickMove: returns null when the color has no pieces', () => {
  const b = empty();
  b[0][0] = 'wK';
  assert.equal(sandbox.aiPickMove(b, 'b'), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: FAIL — `sandbox.aiPickMove is not a function`.

- [ ] **Step 3: Implement `aiPickMove`**

Append inside the LOGIC block of `chess.html`:

```js
var VAL = {P:1,N:3,B:3,R:5,Q:9,K:1000};

function aiPickMove(board,color){
  var moves=allMoves(board,color);
  if (!moves.length) return null;
  var best=[], bestScore=-1;
  for (var i=0;i<moves.length;i++){
    var target=board[moves[i].to.r][moves[i].to.c];
    var score = target ? VAL[target[1]] : 0;
    if (score>bestScore){ bestScore=score; best=[moves[i]]; }
    else if (score===bestScore){ best.push(moves[i]); }
  }
  return best[Math.floor(Math.random()*best.length)];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "feat(chess): beginner greedy AI (aiPickMove)"
```

---

## Task 7: Mobile-first CSS + board styling

**Files:**
- Modify: `chess.html` (`<style>` block)

This task is verified manually in a browser — no automated test.

- [ ] **Step 1: Fill in the `<style>` block**

Replace `/* CSS added in Task 7 */` with:

```css
:root{
  --lt:#e9d7b5; --dk:#a06a3f; --bg:#241c14; --fg:#f3ecde;
  --sel:#7ad17a; --last:rgba(255,221,87,.55); --dot:rgba(30,24,16,.42);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
html,body{margin:0;height:100%;}
body{
  background:var(--bg);color:var(--fg);
  font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:6px;padding:8px;min-height:100svh;
}
#status{font-size:18px;font-weight:800;min-height:24px;text-align:center;}
#bar{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
button{
  font:inherit;font-size:14px;font-weight:700;padding:9px 13px;border:none;border-radius:11px;
  background:#5a4632;color:#fff;-webkit-appearance:none;touch-action:manipulation;cursor:pointer;
}
button.act{background:#cf8c3a;}
#board{
  width:min(96vw, calc(100svh - 150px));
  height:min(96vw, calc(100svh - 150px));
  display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);
  border:5px solid #3a2c1c;border-radius:7px;overflow:hidden;touch-action:manipulation;
  box-shadow:0 10px 30px rgba(0,0,0,.45);
}
.sq{
  display:flex;align-items:center;justify-content:center;position:relative;
  font-size:min(8.2vw, calc((100svh - 150px)/8 * .82));line-height:1;
  user-select:none;-webkit-user-select:none;cursor:pointer;
}
.sq.lt{background:var(--lt);}
.sq.dk{background:var(--dk);}
.sq.wp{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.55);-webkit-text-stroke:1.4px #2a2a2a;}
.sq.bp{color:#181818;-webkit-text-stroke:1.4px #000;}
.sq.sel{box-shadow:inset 0 0 0 4px var(--sel);}
.sq.last{box-shadow:inset 0 0 0 4px var(--last);}
.sq.sel.last{box-shadow:inset 0 0 0 4px var(--sel);}
.sq.mv::after{
  content:'';position:absolute;width:30%;height:30%;border-radius:50%;
  background:var(--dot);pointer-events:none;
}
.sq.mv.cap::after{
  width:86%;height:86%;background:transparent;border:5px solid var(--dot);
}
.tray{display:flex;flex-wrap:wrap;gap:1px;font-size:20px;line-height:1;min-height:22px;justify-content:center;}
.tray .wp{color:#fff;-webkit-text-stroke:1px #2a2a2a;}
.tray .bp{color:#181818;-webkit-text-stroke:1px #000;}
```

- [ ] **Step 2: Manual verification**

Open `chess.html` in a browser. Expected (board renders empty for now — UI added next task, so just verify layout/no console errors):
- No CSS parse errors in the console.
- The `#board` element is a visible square sized to the viewport.

- [ ] **Step 3: Commit**

```bash
git add chess.html
git commit -m "feat(chess): mobile-first CSS and board styling"
```

---

## Task 8: UI state, grid build, render, tray

**Files:**
- Modify: `chess.html` (UI block)

Verified manually in a browser.

- [ ] **Step 1: Implement state + glyphs + grid + render**

Replace `/* UI added in Tasks 8-10 */` with:

```js
var S = { board: initBoard(), turn:'w', selected:null, legal:[],
          mode:'hotseat', aiColor:'b', captured:{w:[],b:[]}, gameOver:null, lastMove:null };

var GLYPH = {P:'♟',R:'♜',N:'♞',B:'♝',Q:'♛',K:'♚'};

var boardEl = document.getElementById('board');
var cells = [];

function buildGrid(){
  boardEl.innerHTML='';
  cells=[];
  for (var r=0;r<8;r++){
    var rowCells=[];
    for (var c=0;c<8;c++){
      var d=document.createElement('div');
      d.className='sq '+(((r+c)%2===0)?'lt':'dk');
      (function(rr,cc){ d.addEventListener('click', function(){ onSquareTap(rr,cc); }); })(r,c);
      boardEl.appendChild(d);
      rowCells.push(d);
    }
    cells.push(rowCells);
  }
}

function sameSq(a,r,c){ return a && a.r===r && a.c===c; }

function render(){
  for (var r=0;r<8;r++){
    for (var c=0;c<8;c++){
      var d=cells[r][c];
      var p=S.board[r][c];
      d.textContent = p ? GLYPH[p[1]] : '';
      d.classList.toggle('wp', !!p && p[0]==='w');
      d.classList.toggle('bp', !!p && p[0]==='b');
      d.classList.toggle('sel', sameSq(S.selected,r,c));
      var isLast = S.lastMove && (sameSq(S.lastMove.from,r,c) || sameSq(S.lastMove.to,r,c));
      d.classList.toggle('last', !!isLast);
      var isLegal = S.legal.some(function(m){return m.r===r&&m.c===c;});
      d.classList.toggle('mv', isLegal);
      d.classList.toggle('cap', isLegal && !!p);
    }
  }
  var st=document.getElementById('status');
  if (S.gameOver){ st.textContent = (S.gameOver==='w'?'White':'Black')+' wins! 👑'; }
  else { st.textContent = (S.turn==='w'?'White':'Black')+' to move'; }
  renderTray();
}

function renderTray(){
  // trayTop shows black pieces white has captured; trayBot shows white pieces black has captured
  var top=document.getElementById('trayTop'), bot=document.getElementById('trayBot');
  top.innerHTML = S.captured.b.map(function(t){return '<span class="bp">'+GLYPH[t]+'</span>';}).join('');
  bot.innerHTML = S.captured.w.map(function(t){return '<span class="wp">'+GLYPH[t]+'</span>';}).join('');
}

buildGrid();
render();
```

- [ ] **Step 2: Manual verification**

Open `chess.html`. Expected:
- Full starting position renders: black pieces on top two rows, white on bottom two.
- White pieces show light fill, black pieces dark fill; all clearly visible on both square colors.
- Status reads "White to move". No console errors.
- (Clicking does nothing yet — interaction is Task 9.)

- [ ] **Step 3: Commit**

```bash
git add chess.html
git commit -m "feat(chess): board render, glyphs, state, captured tray"
```

---

## Task 9: Interaction + turn enforcement (hotseat playable)

**Files:**
- Modify: `chess.html` (UI block)

Verified manually in a browser.

- [ ] **Step 1: Implement tap flow + move application**

Append to the UI block (before the final `buildGrid(); render();` lines is fine, but these functions can be added anywhere in the UI block; place them above the `buildGrid(); render();` calls):

```js
function onSquareTap(r,c){
  if (S.gameOver) return;
  if (S.mode==='ai' && S.turn===S.aiColor) return;   // lock input during AI turn
  var p=S.board[r][c];
  if (S.selected){
    var isLegal=S.legal.some(function(m){return m.r===r&&m.c===c;});
    if (isLegal){ doMove(S.selected,{r:r,c:c}); return; }
  }
  if (p && p[0]===S.turn){
    S.selected={r:r,c:c};
    S.legal=legalMoves(S.board,r,c);
  } else {
    S.selected=null; S.legal=[];
  }
  render();
}

function doMove(from,to){
  var res=applyMove(S.board,from,to);
  S.board=res.board;
  if (res.captured){ S.captured[res.captured[0]].push(res.captured[1]); }
  S.lastMove={from:from,to:to};
  S.selected=null; S.legal=[];
  if (res.winner){ S.gameOver=res.winner; render(); return; }
  S.turn = (S.turn==='w')?'b':'w';
  render();
  if (S.mode==='ai' && S.turn===S.aiColor && !S.gameOver){
    setTimeout(aiTurn, 350);
  }
}

function aiTurn(){
  if (S.gameOver) return;
  var mv=aiPickMove(S.board,S.aiColor);
  if (!mv) return;
  doMove(mv.from, mv.to);
}
```

> Note: `aiTurn`/`setMode` reference the AI; `aiTurn` is defined here and `setMode` in Task 10. Both are function declarations, so call-order at load time is fine.

- [ ] **Step 2: Manual verification (hotseat)**

Open `chess.html`. Expected:
- Tap a white piece → it highlights (green inset) and legal destinations show dots; capturable squares show a ring.
- Tap a legal square → piece moves, last-move squares tint gold, status flips to "Black to move".
- Cannot select a black piece while it's White's turn (tap does nothing / deselects).
- Capturing adds the captured piece to a tray.
- Capture a king → status shows "<Color> wins! 👑" and further taps are ignored.

- [ ] **Step 3: Commit**

```bash
git add chess.html
git commit -m "feat(chess): tap-to-move interaction, turn enforcement, hotseat play"
```

---

## Task 10: Modes, AI wiring, New Game, buttons

**Files:**
- Modify: `chess.html` (UI block)

Verified manually in a browser.

- [ ] **Step 1: Implement newGame/setMode + wire buttons**

Append to the UI block (above the final `buildGrid(); render();`):

```js
function newGame(){
  S.board=initBoard(); S.turn='w'; S.selected=null; S.legal=[];
  S.captured={w:[],b:[]}; S.gameOver=null; S.lastMove=null;
  render();
}

function setMode(m){
  S.mode=m;
  document.getElementById('mode-hot').classList.toggle('act', m==='hotseat');
  document.getElementById('mode-ai').classList.toggle('act', m==='ai');
  newGame();
}

document.getElementById('new').addEventListener('click', newGame);
document.getElementById('mode-hot').addEventListener('click', function(){ setMode('hotseat'); });
document.getElementById('mode-ai').addEventListener('click', function(){ setMode('ai'); });
```

- [ ] **Step 2: Manual verification (AI mode + reset)**

Open `chess.html`. Expected:
- "vs Computer" button highlights when tapped and starts a fresh game; you play White, the computer replies as Black ~350ms after each of your moves.
- The AI grabs hanging pieces and will capture your king if you leave it exposed (ending the game).
- "New Game" resets the board, trays, status, and game-over state in the current mode.
- Switching modes also resets the board.

- [ ] **Step 3: Commit**

```bash
git add chess.html
git commit -m "feat(chess): mode toggle, AI turn wiring, New Game reset"
```

---

## Task 11: Mobile verification + regression pass

**Files:**
- Modify: `chess.html` only if issues are found.

- [ ] **Step 1: Run the full logic test suite**

Run: `node --test chess.test.mjs`
Expected: PASS (15 tests).

- [ ] **Step 2: Manual mobile verification**

In the browser, open devtools device emulation (or a real iPhone) and check at **375×667 (iPhone SE)** and a modern **~390–430px** width, portrait:
- The board is a full square that fits with no vertical scroll; status, trays, and buttons all visible.
- Each square is ≥ ~44px; taps reliably select the intended square; legal-move dots are easy to hit.
- No 300ms tap delay / double-tap zoom on squares or buttons.
- Glyphs are crisp and color-distinct on both light and dark squares.
- Landscape: board still fits (sized by the smaller of width/height budget) — acceptable, portrait is priority.

- [ ] **Step 3: Final commit (if any tweaks were needed)**

```bash
git add chess.html
git commit -m "fix(chess): mobile layout tweaks from device verification"
```

---

## Task 12: AI timer lifecycle hardening (from adversarial review)

**Files:**
- Modify: `chess.html` (UI block)
- Modify: `chess.test.mjs` (add UI control-flow tests with a stubbed DOM + fake timers)

A post-implementation multi-agent review confirmed two real defects: (1) the `setTimeout(aiTurn,350)` is never cancelled, so New Game / mode switch within 350ms fires a stale AI move onto the fresh board; (2) if the AI has zero legal moves, `aiTurn` returns silently and the UI hangs with input locked.

- [ ] **Step 1: Add UI tests that reproduce both bugs**

Append to `chess.test.mjs` two tests that evaluate the LOGIC+UI blocks in a `vm` sandbox with a stubbed `document` (no-op elements) and fake `setTimeout`/`clearTimeout` (capture pending callbacks): assert New Game cancels the pending timer and a manually-fired stale callback leaves `S.turn==='w'` with the board unchanged; and assert `aiTurn` on a zero-move AI position sets `S.gameOver` (no hang). See shipped `chess.test.mjs` for the exact harness.

- [ ] **Step 2: Run to verify failure**

Run: `node --test chess.test.mjs`
Expected: the two new UI tests FAIL (stale callback applies a move / game hangs).

- [ ] **Step 3: Apply the fix in `chess.html` UI block**

- Add `var aiTimer = null;` after the `S` declaration.
- In `doMove`, store the handle: `aiTimer = setTimeout(aiTurn, 350);`
- Harden `aiTurn`:
```js
function aiTurn(){
  aiTimer = null;
  if (S.gameOver) return;
  if (S.mode!=='ai' || S.turn!==S.aiColor) return;   // stale/cancelled callback — ignore
  var mv=aiPickMove(S.board,S.aiColor);
  if (!mv){ S.gameOver = (S.turn==='w')?'b':'w'; render(); return; }
  doMove(mv.from, mv.to);
}
```
- In `newGame`, cancel first: `if (aiTimer){ clearTimeout(aiTimer); aiTimer=null; }` (covers mode switch, since `setMode`→`newGame`).

- [ ] **Step 4: Run to verify pass**

Run: `node --test chess.test.mjs`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add chess.html chess.test.mjs
git commit -m "fix(chess): cancel pending AI timer on reset; end game on AI stalemate"
```

---

## Self-Review Notes (author checklist — completed)

- **Spec coverage:** initBoard/data model (T1, T8) · sliding+knight+king+pawn move gen (T2–T4) · captures + king-capture game end (T5) · turn enforcement + tap flow (T9) · hotseat + AI modes (T6, T9, T10) · mobile-first layout (T7, T11) · New Game/mode toggle/status/tray (T8, T10). All spec sections map to a task.
- **Placeholders:** none — every code step shows complete code; manual-verify steps list concrete expected observations.
- **Type/name consistency:** `legalMoves(board,r,c)`, `applyMove(board,from,to)→{board,captured,winner}`, `allMoves(board,color)→[{from,to}]`, `aiPickMove(board,color)`, `S` shape, `GLYPH`, CSS classes (`sq lt dk wp bp sel last mv cap`) used identically across tasks.
- **Out-of-scope confirmed absent:** no castling/en passant/promotion/check-detection/drag — matches spec YAGNI list.
