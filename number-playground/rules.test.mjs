import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as R from './rules.js';

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
    assert.ok(['bear', 'cat', 'penguin', 'lion'].includes(task.animal) && R.TOYS.includes(task.food));
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

test('the saved player is validated before use', () => {
  const fresh = { stars: 0, done: {}, stickers: [], sound: true, next: 'Feed the bear' };
  for (const bad of [null, undefined, '', 'nonsense', '[]', 42, '{"stars":-3,"done":"x","stickers":"cat"}']) assert.deepEqual(R.normalizeSave(bad), fresh);
  const save = R.normalizeSave('{"stars":12,"done":{"feed3":2,"cheat":5,"find5":-1},"stickers":["cat","cat","dragon","egg"],"sound":false}');
  assert.deepEqual(save, { stars: 12, done: { feed3: 2 }, stickers: ['cat', 'egg'], sound: false, next: 'Pop the number' });
  assert.equal(R.normalizeSave({ stars: 2.5 }).stars, 0);
  assert.equal(R.normalizeSave({ stars: 1e9 }).stars, 99999);
  assert.deepEqual(R.friendsOf(save), ['bear', 'cat']);
});

test('stops open one after another, stars are only ever added, and a finished path stays open', () => {
  let save = R.normalizeSave(null);
  assert.equal(R.reached(save), 0);
  const first = R.finishRound(save, 'feed3', [true, false, true, true, false]);
  assert.equal(first.earned, 8);
  save = first.save;
  assert.deepEqual([save.stars, save.done.feed3, R.reached(save), R.nextStop(save).id], [8, 1, 1, 'find5']);
  save = R.finishRound(save, 'feed3', [false]).save;
  assert.deepEqual([save.stars, save.done.feed3, R.reached(save)], [9, 2, 1], 'a replay still earns');
  assert.equal(R.finishRound(save, 'nonsense', [true]).earned, 0);
  assert.equal(R.finishRound(save, 'feed3', []).earned, 0);
  for (const stop of R.STOPS) save = R.finishRound(save, stop.id, [true]).save;
  assert.equal(R.reached(save), R.STOPS.length - 1);
});

test('an egg costs stars and always holds a new sticker, until every sticker is found', () => {
  assert.equal(R.hatchEgg({ stars: R.EGG_COST - 1 }), null);
  let save = R.normalizeSave({ stars: R.EGG_COST * (R.STICKERS.length + 2) });
  const found = [];
  for (let i = 0; i < R.STICKERS.length; i++) {
    const egg = R.hatchEgg(save, seeded(i + 1));
    assert.ok(egg && !found.includes(egg.sticker) && R.STICKERS.includes(egg.sticker));
    assert.equal(egg.save.stars, save.stars - R.EGG_COST);
    found.push(egg.sticker); save = egg.save;
  }
  assert.equal(save.stickers.length, R.STICKERS.length);
  assert.equal(R.canHatch(save), false);
  assert.equal(R.hatchEgg(save), null);
  assert.ok(!R.STICKERS.includes('bear') && R.STICKERS.length === 27);
});

test('a finished visit moves today’s Daily Adventure on only when it is waiting at its math stop', () => {
  const adv = n => ({ m1a: 4, __adv: { d: '2026-11-15', n, g: 'plane', s: [{ w: 'eng', id: 'e1a' }, { w: 'math', id: 'play' }, { w: 'eng', id: 'e1b' }, { w: 'crit', id: 'c1a' }] } });
  const moved = R.advanceAdventure(JSON.stringify(adv(1)), '2026-11-15');
  assert.equal(moved.__adv.n, 2);
  assert.equal(moved.m1a, 4, 'everything else in the save is kept');
  assert.equal(R.advanceAdventure(adv(0), '2026-11-15'), null, 'waiting at an English stop');
  assert.equal(R.advanceAdventure(adv(1), '2026-11-16'), null, 'yesterday’s adventure');
  for (const bad of [null, '', 'nonsense', '{}', { __adv: { d: '2026-11-15', n: 9, s: [] } }]) assert.equal(R.advanceAdventure(bad, '2026-11-15'), null);
  assert.equal(R.dayStamp(new Date(2026, 10, 5)), '2026-11-5');
});

test('every picture and number clip the game uses is in the repository, and files share one version number', () => {
  const root = new URL('../', import.meta.url);
  for (const name of R.ANIMALS) assert.ok(existsSync(new URL(`memory-assets/${name}.png`, root)), name);
  for (const name of R.TOYS) assert.ok(existsSync(new URL(`curriculum-assets/${name}.png`, root)), name);
  const game = readFileSync(new URL('./game.js', import.meta.url), 'utf8'), page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const clips = JSON.parse(game.match(/const CLIPS = (\[[^\]]+\])/)[1]);
  for (const n of clips) assert.ok(existsSync(new URL(`audio/num_${n}.mp3`, root)), `num_${n}`);
  const versions = new Set([...page.matchAll(/(?:style\.css|game\.js)\?v=(\d+)/g), ...game.matchAll(/\.js\?v=(\d+)/g)].map(m => m[1]));
  assert.equal(versions.size, 1, `one version everywhere, found ${[...versions]}`);
  assert.equal([...page.matchAll(/(?:style\.css|game\.js)\?v=\d+/g)].length, 2);
});
