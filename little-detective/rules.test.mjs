import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './rules.js';
import * as C from './cases.js';
import { ANIMALS, TOYS } from '../play-kit/progress.js';

const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pictured = name => ANIMALS.includes(name) || TOYS.includes(name) || !!C.PICTURES[name];

test('twelve cases in three lands, and every puzzle kind a case names has puzzles', () => {
  assert.equal(R.STOPS.length, 12);
  assert.deepEqual(R.LANDS.flatMap(l => l.stops), R.STOPS.map(s => s.id));
  for (const stop of R.STOPS) assert.ok(stop.title && stop.icon && stop.kinds.length && stop.kinds.every(k => ['odd', 'pattern', 'goes', 'next', 'silly', 'order'].includes(k)), stop.id);
  assert.deepEqual([C.ODD.length, C.GOES.length, C.NEXT.length, C.SILLY.length, C.ORDER.length], [20, 19, 11, 20, 6]);
  // No puzzle is in the pool twice, so a case never asks the same thing again.
  for (const [list, key] of [[C.GOES, g => g.thing + g.partner], [C.NEXT, n => n.thing + n.then], [C.SILLY, s => s.story], [C.ODD, o => o.odd + o.others]]) assert.equal(new Set(list.map(key)).size, list.length);
});

test('everything shown has a picture, and every puzzle has one answer and a reason', () => {
  for (const o of C.ODD) { assert.equal(o.others.length, 3); assert.ok(o.group && !o.others.includes(o.odd)); [...o.others, o.odd].forEach(n => assert.ok(pictured(n), n)); }
  for (const g of C.GOES) { assert.ok(g.why.length > 10 && !g.others.includes(g.partner) && g.others.length === 2); [g.thing, g.partner, ...g.others].forEach(n => assert.ok(pictured(n), n)); }
  for (const n of C.NEXT) { assert.ok(n.story.length > 10 && n.why.length > 10 && n.others.length === 2 && !n.others.includes(n.then)); [n.thing, n.then, ...n.others].forEach(x => assert.ok(pictured(x), x)); }
  for (const s of [...C.SILLY, ...C.NORMAL]) { assert.ok(s.story.length > 8 && s.items.length); s.items.forEach(n => assert.ok(pictured(n), n)); }
  for (const s of C.SILLY) assert.ok(s.why.length > 8);
  for (const o of C.ORDER) { assert.equal(o.length, 3); o.forEach(n => assert.ok(pictured(n), n)); }
  R.PATTERN_THINGS.forEach(n => assert.ok(TOYS.includes(n), n));
});

test('a pattern shows its repeating part twice and its next picture is certain', () => {
  for (let level = 0; level < 3; level++) for (let seed = 1; seed <= 200; seed++) {
    const p = R.makePattern(level, seeded(seed)), all = [...p.line, p.answer];
    // Find the shortest repeat that explains the whole line, then check it predicts the answer.
    let unit = 0;
    for (let n = 2; n <= 4 && !unit; n++) if (all.every((t, i) => t === all[i % n])) unit = n;
    assert.ok(unit, `level ${level} seed ${seed}: ${all}`);
    assert.ok(p.line.length >= unit * 2, 'the repeating part is seen twice');
    assert.equal(p.options.length, 3); assert.equal(new Set(p.options).size, 3); assert.ok(p.options.includes(p.answer));
    if (level === 0) assert.equal(unit, 2);
  }
});

test('a case is five puzzles from its own kinds, with no puzzle twice and every answer among the choices', () => {
  for (const stop of R.STOPS) for (let seed = 1; seed <= 60; seed++) {
    const round = R.makeRound(stop, seeded(seed));
    assert.equal(round.length, 5);
    assert.ok(round.every(t => stop.kinds.includes(t.game)), stop.id);
    const fixed = round.filter(t => t.game !== 'pattern').map(t => [t.game, t.thing, t.answer, ...[...(t.options || t.order || [])].sort()].join(':'));
    assert.equal(new Set(fixed).size, fixed.length, `${stop.id} seed ${seed} repeats a puzzle`);
    for (const t of round) {
      if (t.options) { assert.equal(t.options.filter(o => o === t.answer).length, 1); assert.equal(new Set(t.options).size, t.options.length); }
      if (t.game === 'odd') assert.equal(t.options.length, 4);
      if (t.game === 'silly') { assert.equal(t.scenes.length, 3); assert.equal(t.scenes.filter(s => s.story === t.answer).length, 1); assert.equal(t.scenes.filter(s => C.NORMAL.some(n => n.story === s.story)).length, 2); }
      if (t.game === 'order') assert.deepEqual([...t.tiles].sort(), [...t.order].sort());
    }
  }
});
