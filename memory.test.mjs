import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const htmlPath = fileURLToPath(new URL('./memory.html', import.meta.url));
const html = readFileSync(htmlPath, 'utf8');
const m = html.match(/\/\* LOGIC_START \*\/([\s\S]*?)\/\* LOGIC_END \*\//);
if (!m) throw new Error('LOGIC markers not found in memory.html');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);

// Deterministic RNG (mulberry32) so shuffle-dependent tests are reproducible.
function seeded(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function counts(vals){ const c={}; vals.forEach(v=>c[v]=(c[v]||0)+1); return c; }

test('every deck exists, is well-formed, and has >= 8 items (enough for Hard)', () => {
  const ids = Object.keys(sandbox.DECKS);
  assert.ok(ids.length >= 4);
  for (const id of ids){
    const d = sandbox.DECKS[id];
    assert.ok(d.label && d.cat && d.kind && Array.isArray(d.items));
    assert.ok(d.items.length >= 8, `${id} needs >=8 items, has ${d.items.length}`);
    assert.equal(new Set(d.items).size, d.items.length, `${id} has duplicate items`);
  }
  assert.equal(sandbox.DECKS.colors.kind, 'color');
});

test('SIZES define increasing pair counts and sane column counts', () => {
  assert.equal(sandbox.SIZES.easy.pairs, 3);
  assert.equal(sandbox.SIZES.medium.pairs, 6);
  assert.equal(sandbox.SIZES.hard.pairs, 8);
  for (const s of Object.values(sandbox.SIZES)){
    assert.ok(s.cols >= 2 && s.cols <= 4);
  }
});

test('buildGame: 2*pairs cards, each chosen value appears exactly twice, values come from the deck', () => {
  const g = sandbox.buildGame('animals', 6, seeded(1));
  assert.equal(g.cards.length, 12);
  const vals = g.cards.map(c => c.val);
  const c = counts(vals);
  const distinct = Object.keys(c);
  assert.equal(distinct.length, 6);                 // exactly `pairs` distinct values
  distinct.forEach(v => assert.equal(c[v], 2));     // each appears as a pair
  distinct.forEach(v => assert.ok(sandbox.DECKS.animals.items.includes(v)));
  g.cards.forEach((card, i) => assert.equal(card.i, i)); // index matches position
  assert.equal(g.kind, 'sym');
});

test('buildGame: Hard uses 8 pairs (16 cards) and is deterministic under a fixed seed', () => {
  const a = sandbox.buildGame('letters', 8, seeded(42));
  const b = sandbox.buildGame('letters', 8, seeded(42));
  assert.equal(a.cards.length, 16);
  assert.deepEqual(a.cards.map(c => c.val), b.cards.map(c => c.val)); // same seed -> same layout
});

test('shuffle: returns a permutation (same multiset), original untouched', () => {
  const src = ['a','b','c','d','e','f'];
  const out = sandbox.shuffle(src, seeded(7));
  assert.deepEqual(counts(out), counts(src));
  assert.deepEqual(src, ['a','b','c','d','e','f']); // non-mutating
});

test('cardsMatch: true for equal values at different indices, false otherwise (incl. same index)', () => {
  const cards = [{i:0,val:'🐶'},{i:1,val:'🐱'},{i:2,val:'🐶'}];
  assert.equal(sandbox.cardsMatch(cards, 0, 2), true);
  assert.equal(sandbox.cardsMatch(cards, 0, 1), false);
  assert.equal(sandbox.cardsMatch(cards, 1, 1), false); // a card can't match itself
});

test('isWin: true only when all pairs are matched', () => {
  assert.equal(sandbox.isWin(5, 6), false);
  assert.equal(sandbox.isWin(6, 6), true);
  assert.equal(sandbox.isWin(7, 6), true);
});
