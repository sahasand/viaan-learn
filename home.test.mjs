import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WORLDS, planAdventure, adventureHref } from './curriculum-assets/home.js';
import { advanceAdventure } from './play-kit/progress.js';
const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('the home page is a launcher: three learning games, no lessons of its own', () => {
  for (const gone of ['CURRICULUM_START', 'LearningApp', 'experience.js', 'learning.js', 'id="game"', 'exampleDialog']) assert.ok(!html.includes(gone), gone);
  assert.ok(html.includes('<script type="module" src="curriculum-assets/home.js?v='));
  for (const [id, world] of Object.entries(WORLDS)) {
    for (const file of ['index.html', 'game.js', 'rules.js', 'style.css']) assert.ok(fs.existsSync(new URL('./' + world.href + file, import.meta.url)), world.href + file);
    for (const el of [world.card, 'next-' + id, 'progress-' + id]) assert.ok(html.includes(`id="${el}"`), el);
    assert.ok(world.stops.length >= 12 && world.key.startsWith('viaan-'));
  }
  for (const el of ['advB', 'advLabel', 'advSub', 'adventureTrail', 'badgeCount', 'parentProgress', 'soundToggle']) assert.ok(html.includes(`id="${el}"`), el);
});

test('today’s adventure visits English, Math, English and Thinking, then a game', () => {
  const fresh = planAdventure(undefined, '2026-11-15', 2);
  assert.deepEqual(fresh, { d: '2026-11-15', n: 0, g: 'chess', s: [{ w: 'eng' }, { w: 'math' }, { w: 'eng' }, { w: 'crit' }] });
  assert.deepEqual([0, 1, 2, 3, 4].map(n => adventureHref({ ...fresh, n })), ['story-garden/?adventure=1', 'number-playground/?adventure=1', 'story-garden/?adventure=1', 'little-detective/?adventure=1', 'chess.html']);
  assert.equal(adventureHref({ ...fresh, n: 4, g: 'plane' }), 'sky-playground/');
  // A saved adventure from today is kept, including one saved before the games replaced the lessons.
  const old = { d: '2026-11-15', n: 2, g: 'memory', s: [{ w: 'eng', id: 'e1a' }, { w: 'math', id: 'm1a' }, { w: 'eng', id: 'e1b' }, { w: 'crit', id: 'ct1a' }] };
  assert.equal(planAdventure(old, '2026-11-15', 0), old);
  for (const bad of [{ ...old, d: '2026-11-14' }, { ...old, n: 7 }, { ...old, g: 'golf' }, { ...old, s: old.s.slice(1) }, { ...old, s: [{ w: 'art' }, ...old.s.slice(1)] }, 'x', []]) assert.equal(planAdventure(bad, '2026-11-15', 0).n, 0);
});

test('each game moves the adventure on only from its own stop', () => {
  let progress = { __adv: planAdventure(null, '2026-11-15', 0), other: 1 };
  assert.equal(advanceAdventure(progress, '2026-11-15', 'math'), null, 'waiting at English');
  for (const world of ['eng', 'math', 'eng', 'crit']) { progress = advanceAdventure(JSON.stringify(progress), '2026-11-15', world); assert.ok(progress); }
  assert.deepEqual([progress.__adv.n, progress.other], [4, 1]);
  assert.equal(advanceAdventure(progress, '2026-11-15', 'crit'), null, 'finished');
});
