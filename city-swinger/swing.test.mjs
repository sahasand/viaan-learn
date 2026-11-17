import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as S from './swing.js';

const MISSIONS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 20, 37];
// Plays a mission with a way of pressing the screen, and reports how it went.
function play(number, press, seconds = 240) {
  const mission = S.makeMission(number), events = {}; let hero = S.startHero(mission), t = 0, stars = 0, friends = 0;
  while (!hero.done && t < seconds) {
    const out = S.stepHero(mission, hero, press(t, hero), 1 / 60); hero = out.hero; t += 1 / 60;
    for (const e of out.events) events[e] = (events[e] || 0) + 1;
    for (const found of S.gather(mission, hero)) found.kind === 'star' ? stars++ : friends++;
    assert.ok(hero.y >= -1e-9, 'never below the street');
    for (const b of mission.buildings) assert.ok(!(hero.x > b.x0 + .01 && hero.x < b.x1 - .01 && hero.y < b.top - .01), `never inside a building (mission ${number}, x ${hero.x.toFixed(1)})`);
    assert.ok(Math.hypot(hero.vx, hero.vy) <= S.MAX_SPEED + 6 && Number.isFinite(hero.x + hero.y));
  }
  return { mission, hero, t, stars, friends, events };
}
const random = seed => { let n = seed, held = false, until = 0; return t => { if (t >= until) { n = (n * 1664525 + 1013904223) >>> 0; held = n / 4294967296 < .5; n = (n * 1664525 + 1013904223) >>> 0; until = t + .15 + n / 4294967296 * .9; } return held; }; };

test('every mission is a row of buildings with a hook over each gap, stars and three different friends', () => {
  for (const number of MISSIONS) {
    const m = S.makeMission(number);
    assert.ok(m.buildings.length >= 10 && m.buildings.length <= 16);
    assert.equal(m.hooks.length, m.buildings.length - 1); assert.equal(m.bouncers.length, m.hooks.length);
    m.buildings.forEach((b, i) => {
      assert.ok(b.x1 - b.x0 >= 10 && b.top >= 7 && b.top <= 22, 'a sensible building');
      if (!i) return;
      const before = m.buildings[i - 1], gap = b.x0 - before.x1, hook = m.hooks[i - 1], pad = m.bouncers[i - 1];
      assert.ok(gap >= 10 && gap <= 14, `gap ${gap}`);
      assert.ok(hook.x > before.x1 + 3 && hook.x < b.x0 - 3 && hook.y >= Math.max(before.top, b.top) + 8, 'the hook hangs over the gap, above both roofs');
      assert.ok(Math.hypot(hook.x - before.x1, hook.y - before.top - S.BODY) < S.REACH, 'and can be reached from the roof before it');
      assert.ok(pad.x0 > before.x1 && pad.x1 < b.x0 && pad.x1 - pad.x0 > 6, 'a trampoline fills the street below');
    });
    assert.equal(m.friends.length, 3); assert.equal(new Set(m.friends.map(f => f.id)).size, 3); assert.equal(new Set(m.friends.map(f => f.place)).size, 3);
    assert.ok(m.stars.length > 50);
    for (const thing of [...m.stars, ...m.friends]) assert.ok(thing.y > 1 && !m.buildings.some(b => thing.x > b.x0 && thing.x < b.x1 && thing.y < b.top + .5), 'nothing to catch is inside a building');
    assert.ok(m.buildings.at(-1).finish && m.finish.x < m.length);
    assert.deepEqual(S.makeMission(number), m, 'the same mission every time');
  }
  assert.deepEqual([1, 2, 3, 4].map(n => S.makeMission(n).theme), ['day', 'sunset', 'night', 'day']);
});

test('doing nothing at all still reaches the finish and rescues everyone', () => {
  for (const number of MISSIONS) {
    const run = play(number, () => false);
    assert.ok(run.hero.done, `mission ${number} finishes`); assert.ok(run.t < 90, `in good time: ${run.t.toFixed(0)}s`);
    assert.equal(run.events.throw, undefined); assert.ok(run.events.stick > 3 && run.events.leap > 5, 'by leaping, bouncing and climbing');
    assert.equal(run.friends, 3, `mission ${number} friends`);
  }
});

test('holding the screen swings over every gap: faster, with a rope a gap, more stars and every friend', () => {
  for (const number of MISSIONS) {
    const lazy = play(number, () => false), run = play(number, () => true), gaps = run.mission.hooks.length;
    assert.ok(run.hero.done && run.t < lazy.t * .8, `mission ${number}: ${run.t.toFixed(0)}s against ${lazy.t.toFixed(0)}s`);
    assert.ok(run.events.throw >= gaps - 1 && run.events.throw <= gaps + 2, `${run.events.throw} ropes for ${gaps} gaps`);
    assert.ok((run.events.stick || 0) <= 4, 'mostly landing on roofs, not walls');
    assert.ok(run.stars >= run.mission.stars.length * .75, `${run.stars} of ${run.mission.stars.length} stars`); assert.ok(run.stars >= lazy.stars);
    assert.equal(run.friends, 3, `mission ${number} friends`);
  }
});

test('any way of pressing finishes the mission, and never swings on the same hook twice in a row', () => {
  for (const number of MISSIONS) for (const seed of [3, 77, 1234]) {
    const run = play(number, random(seed + number));
    assert.ok(run.hero.done, `mission ${number} seed ${seed}`); assert.ok(run.t < 110);
    assert.ok((run.events.throw || 0) <= run.mission.hooks.length * 2); assert.ok(run.friends >= 2);
  }
  const quick = play(2, t => Math.floor(t * 4) % 2 === 0); assert.ok(quick.hero.done, 'quick taps');
});

test('a rope is thrown only over a gap, to a hook above and within reach', () => {
  const m = S.makeMission(1), roof = { ...S.startHero(m) };
  assert.equal(S.stepHero(m, roof, true, 1 / 60).hero.mode, 'run', 'on a roof he runs to its end first');
  const b = m.buildings[0], edge = { ...roof, x: b.x1 - .01 }, off = S.stepHero(m, edge, true, 1 / 60);
  assert.equal(off.hero.mode, 'swing'); assert.deepEqual(off.events, ['throw']); assert.equal(off.hero.hook, 0);
  assert.equal(S.stepHero(m, edge, false, 1 / 60).hero.mode, 'air', 'and leaps when the screen is not held');
  assert.equal(S.hookFor(m, { ...roof, x: m.hooks[0].x, y: m.hooks[0].y + 2 }), -1, 'not to a hook below him');
  assert.equal(S.hookFor(m, { ...roof, x: m.hooks[0].x - 1, y: 2, last: 0 }), -1, 'nor to the one just let go');
  assert.equal(S.hookFor(m, { ...roof, x: m.hooks[0].x - 1, y: 2, last: -1 }), 0);
});

test('stars and friends are caught from close by, once each', () => {
  const m = S.makeMission(1), star = m.stars[0], friend = m.friends[0];
  assert.deepEqual(S.gather(m, { x: star.x + 30, y: star.y }), []);
  const got = S.gather(m, { x: star.x + 1.5, y: star.y - S.BODY });
  assert.ok(got.some(g => g.thing === star && g.value === (star.big ? 5 : 1)));
  assert.ok(!S.gather(m, { x: star.x + 1.5, y: star.y - S.BODY }).some(g => g.thing === star), 'only once');
  assert.deepEqual(S.gather(m, { x: friend.x, y: friend.y - S.BODY }).filter(g => g.kind === 'friend').map(g => g.value), [S.FRIEND_STARS]);
});

test('what is saved is checked before use, and nothing is ever taken away', () => {
  const fresh = { stars: 0, missions: 0, owned: [], rescued: {}, suit: 'teal', sound: false };
  for (const bad of [null, undefined, '', 'nonsense', '[]', 7, '{"stars":-4,"suit":"mud","owned":"gold","rescued":{"dragon":3}}']) assert.deepEqual(S.normalizeSave(bad), fresh);
  assert.deepEqual(S.normalizeSave('{"stars":12,"missions":2,"suit":"green","rescued":{"kitten":2,"puppy":-1},"sound":true}'), { stars: 12, missions: 2, owned: [], rescued: { kitten: 2 }, suit: 'green', sound: true });
  assert.equal(S.normalizeSave({ suit: 'gold' }).suit, 'teal', 'a locked suit falls back');
  let save = S.earn(fresh, 270); assert.equal(save.stars, 270); assert.equal(S.earn(save, -5).stars, 270);
  assert.equal(S.chooseSuit(save, 'gold').suit, 'teal', 'not enough stars yet');
  save = S.chooseSuit(save, 'pink'); assert.deepEqual([save.suit, save.owned, save.stars], ['pink', ['pink'], 270], 'unlocking costs no stars');
  save = S.chooseSuit(save, 'purple'); assert.equal(save.suit, 'purple'); assert.deepEqual(save.owned, ['pink']);
  save = S.rescue(S.rescue(save, 'kitten'), 'dragon'); assert.deepEqual(save.rescued, { kitten: 1 });
  save = S.finishMission(save); assert.deepEqual([save.missions, save.stars], [1, 270 + S.FINISH_STARS]);
  assert.equal(S.SUITS.filter(s => !s.cost).length >= 4, true); assert.equal(new Set(S.FRIENDS.map(f => f.id)).size, S.FRIENDS.length);
});

test('the page and its modules load one another with one version number, and the home page links here', () => {
  const read = name => readFileSync(new URL(name, import.meta.url), 'utf8'), page = read('./index.html'), game = read('./game.js');
  const version = page.match(/game\.js\?v=(\d+)/)[1];
  assert.ok(page.includes(`style.css?v=${version}`));
  for (const file of ['swing', 'hero', 'scenery', 'audio']) assert.ok(game.includes(`./${file}.js?v=${version}`), `${file} is loaded at version ${version}`);
  assert.ok(read('./scenery.js').includes(`./hero.js?v=${version}`), 'one version number everywhere');
  assert.ok(read('../index.html').includes('href="city-swinger/"'));
  for (const id of ['world', 'sound', 'pause', 'stars', 'track', 'trackHero', 'trackMarks', 'combo', 'pops', 'teach', 'hint', 'startCard', 'play', 'suits', 'finishCard', 'finishStars', 'next', 'menu', 'resume', 'restart']) assert.ok(page.includes(`id="${id}"`), id);
  assert.ok(!/spider|web-?sling|marvel/i.test(page + game + read('./swing.js') + read('./hero.js') + read('./scenery.js')), 'an original hero: no borrowed names');
});
