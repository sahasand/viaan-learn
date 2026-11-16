import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from './rules.js';
import { TOYS } from '../play-kit/progress.js';

// A repeatable stream of random numbers, so a failing seed can be found again.
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const everyTask = (check, friends = ['bear', 'cat', 'penguin', 'lion']) => {
  for (const stop of R.STOPS) for (let seed = 1; seed <= 60; seed++) for (const task of R.makeRound(stop, seeded(seed), friends)) check(task, stop, seed);
};

test('the path visits every stop once, in three lands, with a name and a picture for each', () => {
  assert.deepEqual(R.LANDS.flatMap(l => l.stops), R.STOPS.map(s => s.id));
  assert.equal(new Set(R.STOPS.map(s => s.id)).size, R.STOPS.length);
  for (const stop of R.STOPS) assert.ok(stop.title && stop.icon && ['feed', 'pop', 'more', 'domino', 'hop', 'bowl'].includes(stop.game), stop.id);
  assert.equal(R.stopById('nonsense'), null);
});

test('a visit is five fresh tasks, or a few whole sequences, and never the same task twice running', () => {
  for (const stop of R.STOPS) for (let seed = 1; seed <= 40; seed++) {
    const round = R.makeRound(stop, seeded(seed));
    assert.equal(round.length, stop.mode === 'order' ? (R.sequenceOf(stop).length >= 8 ? 2 : 3) : 5, stop.id);
    for (let i = 1; i < round.length; i++) if (stop.mode !== 'order' || R.sequenceOf(stop).length > 2) assert.notDeepEqual(round[i], round[i - 1], `${stop.id} seed ${seed}`);
  }
  assert.notDeepEqual(R.makeRound(R.STOPS[0], seeded(1)), R.makeRound(R.STOPS[0], seeded(2)), 'different visits differ');
});

test('feeding asks for an amount in range, from a friend the player has met, with spare food to leave behind', () => {
  everyTask((task, stop) => {
    if (task.game !== 'feed') return;
    assert.ok(task.want >= stop.min && task.want <= stop.max && task.pile > task.want && task.pile <= task.want + 3, stop.id);
    assert.ok(['bear', 'cat', 'penguin', 'lion'].includes(task.animal) && TOYS.includes(task.food));
    assert.deepEqual([R.judgeFeed(task, task.want), R.judgeFeed(task, task.want - 1), R.judgeFeed(task, task.want + 1)], ['right', 'few', 'many']);
  });
  assert.equal(R.makeTask(R.STOPS[0], seeded(3)).animal, 'bear', 'with nobody else met, bear is fed');
});

test('balloons hold the number to find among different numbers, or a whole sequence to pop in order', () => {
  everyTask((task, stop) => {
    if (task.game !== 'pop') return;
    assert.equal(new Set(task.numbers).size, task.numbers.length, 'no number twice');
    if (task.mode === 'find') {
      assert.ok(task.numbers.includes(task.target) && task.numbers.length === Math.min(6, stop.max - stop.min + 1));
      assert.ok(task.numbers.every(n => n >= stop.min && n <= stop.max));
    } else {
      assert.deepEqual([...task.numbers].sort((a, b) => a - b), [...task.sequence].sort((a, b) => a - b));
      for (let i = 1; i < task.sequence.length; i++) assert.equal(task.sequence[i] - task.sequence[i - 1], stop.step);
      assert.equal(task.launch, stop.step < 0);
    }
  });
  assert.deepEqual(R.sequenceOf(R.stopById('launch')), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(R.sequenceOf(R.stopById('fives')), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(R.sequenceOf(R.stopById('tens')).at(-1), 100);
});

test('comparing never offers a tie, and the right side follows the question', () => {
  let fewer = 0, numerals = 0;
  everyTask((task, stop) => {
    if (task.game !== 'more') return;
    assert.notEqual(task.left, task.right);
    for (const n of [task.left, task.right]) assert.ok(n >= stop.min && n <= stop.max, `${stop.id} ${n}`);
    assert.notEqual(task.animals[0], task.animals[1]);
    const side = R.moreAnswer(task), chosen = task[side], other = task[side === 'left' ? 'right' : 'left'];
    assert.ok(task.ask === 'more' ? chosen > other : chosen < other);
    if (task.ask === 'fewer') { fewer++; assert.ok(stop.fewer); }
    if (task.numerals) { numerals++; assert.ok(stop.numerals); }
  });
  assert.ok(fewer > 10 && numerals > 10);
  assert.notEqual(R.makeTask(R.stopById('more5'), seeded(5), ['bear']).animals[0], R.makeTask(R.stopById('more5'), seeded(5), ['bear']).animals[1], 'two animals even when only bear is met');
});

test('dominoes, hops and bowling are all true sums inside their range', () => {
  const seen = { zero: 0, back: 0, hops: 0 };
  everyTask((task, stop) => {
    if (task.game === 'domino') {
      assert.equal(task.a + task.b, task.answer);
      assert.ok(task.a >= 1 && task.b >= 1 && task.a <= 6 && task.b <= 6 && task.answer <= stop.max, `${stop.id} ${task.a}+${task.b}`);
      if (stop.doubles) assert.equal(task.a, task.b);
    } else if (task.game === 'hop') {
      assert.ok(task.start >= 0 && task.start <= stop.max && task.start + task.by >= 0 && task.start + task.by <= stop.max, `${stop.id} ${task.start} ${task.by}`);
      assert.notEqual(task.by, 0);
      if (task.ask === 'hops') { seen.hops++; assert.ok(task.answer === task.by && task.by >= 1 && task.by <= 5); }
      else assert.equal(task.answer, task.start + task.by);
      if (task.by < 0) { seen.back++; assert.ok(stop.back); } else assert.ok(!stop.back);
    } else if (task.game === 'bowl') {
      assert.equal(task.pins - task.down, task.answer);
      assert.ok(task.pins <= stop.max && task.down >= 1 && task.answer >= 0);
      if (task.answer === 0) seen.zero++;
    }
  });
  assert.ok(seen.zero > 0 && seen.back > 0 && seen.hops > 0, 'strikes, hops back and counting hops all come up');
});
