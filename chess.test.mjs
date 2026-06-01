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

// ---- helpers ----
function empty(){ return Array.from({length:8}, () => Array(8).fill(null)); }
function has(moves, r, c){ return moves.some(mv => mv.r === r && mv.c === c); }

// ---- initBoard ----
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

// ---- sliding pieces ----
test('rook: slides on open lines, stops before friendly, captures enemy', () => {
  const b = empty();
  b[4][4] = 'wR';
  b[4][7] = 'bP';   // enemy to the right
  b[4][1] = 'wP';   // friendly to the left
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 4, 5));
  assert.ok(has(mv, 4, 6));
  assert.ok(has(mv, 4, 7));   // capture enemy
  assert.ok(!has(mv, 4, 1));  // friendly blocks
  assert.ok(!has(mv, 4, 0));  // cannot pass friendly
  assert.ok(has(mv, 0, 4));
  assert.ok(has(mv, 7, 4));
});

test('bishop: diagonals only, blocked correctly', () => {
  const b = empty();
  b[4][4] = 'wB';
  b[2][2] = 'bP';
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 3, 3));
  assert.ok(has(mv, 2, 2));   // capture
  assert.ok(!has(mv, 1, 1));  // cannot pass enemy
  assert.ok(has(mv, 5, 5));
  assert.ok(!has(mv, 4, 5));  // not a straight move
});

test('queen: combines rook + bishop directions', () => {
  const b = empty();
  b[4][4] = 'wQ';
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.ok(has(mv, 4, 0));
  assert.ok(has(mv, 0, 4));
  assert.ok(has(mv, 0, 0));
  assert.ok(has(mv, 7, 1));
});

// ---- knight & king ----
test('knight: 8 L-moves from center, edge-clamped, no friendly landing', () => {
  const b = empty();
  b[4][4] = 'wN';
  b[2][5] = 'wP';
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.equal(mv.length, 7);
  assert.ok(has(mv, 6, 5));
  assert.ok(has(mv, 2, 3));
  assert.ok(!has(mv, 2, 5));
  const corner = empty();
  corner[0][0] = 'bN';
  const cm = sandbox.legalMoves(corner, 0, 0);
  assert.equal(cm.length, 2);
  assert.ok(has(cm, 1, 2));
  assert.ok(has(cm, 2, 1));
});

test('king: 8 adjacent squares, edge-clamped, captures enemy', () => {
  const b = empty();
  b[4][4] = 'wK';
  b[4][5] = 'bP';
  b[3][3] = 'wP';
  const mv = sandbox.legalMoves(b, 4, 4);
  assert.equal(mv.length, 7);
  assert.ok(has(mv, 4, 5));
  assert.ok(!has(mv, 3, 3));
  const cb = empty(); cb[0][0]='wK';
  const corner = sandbox.legalMoves(cb, 0, 0);
  assert.equal(corner.length, 3);
});

// ---- pawns ----
test('white pawn: forward one and two from start, diagonal capture only', () => {
  const b = empty();
  b[6][4] = 'wP';
  b[5][5] = 'bP';
  const mv = sandbox.legalMoves(b, 6, 4);
  assert.ok(has(mv, 5, 4));
  assert.ok(has(mv, 4, 4));
  assert.ok(has(mv, 5, 5));
  assert.ok(!has(mv, 5, 3));  // empty diagonal not a move
});

test('white pawn: forward blocked by any piece, double blocked if path occupied', () => {
  const b = empty();
  b[6][4] = 'wP';
  b[5][4] = 'bP';
  const mv = sandbox.legalMoves(b, 6, 4);
  assert.ok(!has(mv, 5, 4));
  assert.ok(!has(mv, 4, 4));
  const b2 = empty();
  b2[6][4] = 'wP';
  b2[4][4] = 'bP';
  const mv2 = sandbox.legalMoves(b2, 6, 4);
  assert.ok(has(mv2, 5, 4));
  assert.ok(!has(mv2, 4, 4));
});

test('black pawn: moves down the board (increasing row)', () => {
  const b = empty();
  b[1][3] = 'bP';
  b[2][2] = 'wP';
  const mv = sandbox.legalMoves(b, 1, 3);
  assert.ok(has(mv, 2, 3));
  assert.ok(has(mv, 3, 3));
  assert.ok(has(mv, 2, 2));
  const mid = empty();
  mid[4][3] = 'bP';
  const mm = sandbox.legalMoves(mid, 4, 3);
  assert.ok(has(mm, 5, 3));
  assert.ok(!has(mm, 6, 3));
});

// ---- applyMove & allMoves ----
test('applyMove: moves the piece, clears origin, is non-mutating', () => {
  const b = empty();
  b[6][4] = 'wP';
  const res = sandbox.applyMove(b, {r:6,c:4}, {r:4,c:4});
  assert.equal(res.board[4][4], 'wP');
  assert.equal(res.board[6][4], null);
  assert.equal(res.captured, null);
  assert.equal(res.winner, null);
  assert.equal(b[6][4], 'wP');   // original untouched
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
  b[7][4] = 'wK';
  b[6][4] = 'wP';
  const list = sandbox.allMoves(b, 'w');
  assert.ok(list.length > 0);
  assert.ok(list.every(mv => mv.from && mv.to));
  assert.equal(sandbox.allMoves(b, 'b').length, 0);
});

// ---- AI ----
test('aiPickMove: grabs the most valuable free capture', () => {
  const b = empty();
  b[4][4] = 'bN';
  b[2][5] = 'wQ';   // reachable knight L-move, value 9
  b[6][5] = 'wP';   // reachable knight L-move, value 1
  const mv = sandbox.aiPickMove(b, 'b');
  // Compare fields, not whole objects: vm-sandbox objects have a different
  // realm prototype, which trips deepStrictEqual's reference-equal check.
  assert.equal(mv.from.r, 4); assert.equal(mv.from.c, 4);
  assert.equal(mv.to.r, 2);   assert.equal(mv.to.c, 5);
});

test('aiPickMove: takes the king when offered', () => {
  const b = empty();
  b[4][4] = 'bR';
  b[4][0] = 'wK';
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

// ---- UI control-flow (LOGIC + UI evaluated against a stubbed DOM + fake timers) ----
// Reproduces the two bugs the adversarial review confirmed, to prove the fixes.
const logicSrc = html.match(/\/\* LOGIC_START \*\/([\s\S]*?)\/\* LOGIC_END \*\//)[1];
const uiSrc = html.match(/\/\* UI_START \*\/([\s\S]*?)\/\* UI_END \*\//)[1];

function makeUiSandbox(){
  const timers = [];
  const el = () => ({ classList:{ toggle(){} }, addEventListener(){}, appendChild(){}, innerHTML:'', textContent:'' });
  const sb = {
    document:{ getElementById:()=>el(), createElement:()=>el() },
    setTimeout:(fn)=>{ timers.push(fn); return timers.length; },   // 1-based id
    clearTimeout:(id)=>{ if(id) timers[id-1]=null; },
    __timers: timers,
  };
  vm.createContext(sb);
  vm.runInContext(logicSrc + '\n' + uiSrc, sb);
  return sb;
}

test('UI: New Game cancels a pending AI move, and a stale callback is a no-op', () => {
  const sb = makeUiSandbox();
  sb.setMode('ai');
  sb.doMove({r:6,c:4}, {r:4,c:4});               // human (white) plays; schedules AI
  assert.equal(sb.S.turn, 'b');                  // black (AI) to move
  const pendingFn = sb.__timers[sb.__timers.length - 1];
  assert.equal(typeof pendingFn, 'function');    // AI timer was scheduled

  sb.newGame();                                  // user resets within the 350ms window
  assert.equal(sb.__timers.filter(Boolean).length, 0);  // timer was cancelled
  assert.equal(sb.S.turn, 'w');                  // fresh board, white to move

  // Even if a stale callback leaked through, the guard makes it inert:
  const before = JSON.stringify(sb.S.board);
  pendingFn();
  assert.equal(sb.S.turn, 'w');                  // no spurious AI move
  assert.equal(JSON.stringify(sb.S.board), before);
});

test('UI: aiTurn ends the game (no hang) when the AI has zero legal moves', () => {
  const sb = makeUiSandbox();
  sb.setMode('ai');
  // Black king boxed by its own pawns; the back-rank pawn is immobile (no promotion).
  const b = empty();
  b[7][7] = 'bK'; b[7][6] = 'bP'; b[6][6] = 'bP'; b[6][7] = 'bP';
  assert.equal(sb.allMoves(b, 'b').length, 0);   // precondition: AI truly has no move
  sb.S.board = b; sb.S.turn = 'b'; sb.S.gameOver = null;
  sb.aiTurn();
  assert.equal(sb.S.gameOver, 'w');              // game ended (white wins), input unlocked — not frozen
});
