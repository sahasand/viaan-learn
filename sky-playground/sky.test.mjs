import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stepFlight, touchesTarget } from './flight.js';
import { AIRPORTS, airportRunway, approachFor, worldGroundHeight, worldObstacles } from './airline.js';
import * as S from './sky.js';

const obstacles = worldObstacles(JSON.parse(readFileSync(new URL('./assets/obstacles.json', import.meta.url))));
const afterTakeoff = id => { const r = airportRunway(id); return { x: r.x, y: r.parkedY + 14, z: r.stopZ - 50, heading: 0, turn: 0, climb: 0, speed: 13, returning: false }; };

test('the sky holds stars, balloons and hoops that float clear of land, trees and the edge of the world', () => {
  const items = S.buildSky(obstacles);
  assert.ok(items.filter(i => i.kind === 'star').length > 150);
  assert.equal(items.filter(i => i.kind === 'hoop').length, 12);
  assert.equal(items.filter(i => i.kind === 'balloon').length, 30);
  for (const thing of items) {
    assert.ok(Math.hypot(thing.x, thing.z) < 430, 'well inside the turn-back boundary');
    assert.ok(thing.y - worldGroundHeight(thing.x, thing.z) >= 6.4 && thing.y <= 44, `${thing.kind} height ${thing.y}`);
    for (const o of obstacles) if (Math.hypot(thing.x - o.x, thing.z - o.z) < o.radius + 3) assert.ok(thing.y >= o.top + 3);
    assert.equal(thing.taken, false);
    assert.equal(thing.value, { star: 1, balloon: 3, hoop: 2 }[thing.kind]);
  }
});

test('every route has a trail of evenly spaced stars from takeoff to the landing approach', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const items = S.routeItems(from.id, to.id, obstacles), stars = items.filter(i => i.kind === 'star');
    assert.ok(stars.length >= 15, `${from.id} to ${to.id} has ${stars.length} stars`);
    assert.equal(items.filter(i => i.kind === 'hoop').length, 2);
    assert.ok(items.every(i => i.route === `${from.id}>${to.id}`));
    for (let i = 1; i < stars.length; i++) { const gap = Math.hypot(stars[i].x - stars[i - 1].x, stars[i].z - stars[i - 1].z); assert.ok(gap > 9 && gap < 19, `gap ${gap}`); }
    const start = afterTakeoff(from.id), end = approachFor(to.id)[0];
    assert.ok(Math.hypot(stars[0].x - start.x, stars[0].z - start.z) < 40, 'the trail starts where the takeoff ends');
    assert.ok(Math.hypot(stars.at(-1).x - end.x, stars.at(-1).z - end.z) < 20, 'and ends where the landing begins');
  }
});

test('a helped flight along any route gathers most of its stars and both hoops', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const items = S.routeItems(from.id, to.id, obstacles), target = approachFor(to.id)[0], found = [];
    let state = afterTakeoff(from.id), steps = 0;
    while (steps++ < 20000) {
      const previous = state;
      state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, target, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
      found.push(...S.collectSky(items, previous, state));
      if (touchesTarget(previous, state, target, 8)) break;
    }
    const stars = items.filter(i => i.kind === 'star').length;
    assert.ok(found.filter(i => i.kind === 'star').length >= stars * .6, `${from.id} to ${to.id}: ${found.length} found`);
    assert.equal(found.filter(i => i.kind === 'hoop').length, 2);
    assert.equal(new Set(found).size, found.length, 'nothing is collected twice');
  }
});

test('the helping wing follows the star trail in order and gathers nearly all of it', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const route = `${from.id}>${to.id}`, items = S.buildSky(obstacles), target = approachFor(to.id)[0];
    let state = afterTakeoff(from.id), steps = 0, got = 0;
    // Fly straight on for a few seconds first, as a child would before asking for help.
    for (let i = 0; i < 300; i++) state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, null, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
    while (steps++ < 30000) {
      const previous = state, lead = S.nextOnRoute(items, route, state);
      state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, lead || target, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
      got += S.collectSky(items, previous, state).filter(i => i.route === route && i.kind === 'star').length;
      if (!lead && touchesTarget(previous, state, target, 8)) break;
    }
    const stars = items.filter(i => i.route === route && i.kind === 'star').length;
    assert.ok(steps < 30000, `${route} reaches the landing approach`);
    assert.ok(got >= stars * .8, `${route}: ${got} of ${stars} stars`);
  }
  const items = S.routeItems('sunny', 'snowy');
  assert.equal(S.nextOnRoute(items, '', afterTakeoff('sunny')), null);
  assert.equal(S.nextOnRoute(items, 'sunny>jungle', afterTakeoff('sunny')), null);
  items.forEach(i => { i.taken = true; });
  assert.equal(S.nextOnRoute(items, 'sunny>snowy', afterTakeoff('sunny')), null);
});

test('collecting marks things taken once, works at low frame rates, and a new flight puts them back', () => {
  const items = S.routeItems('sunny', 'snowy'), star = items[7];
  const before = { x: star.x, y: star.y - 9, z: star.z }, after = { x: star.x, y: star.y + 9, z: star.z };
  assert.deepEqual(S.collectSky(items, before, after), [star]);
  assert.equal(star.taken, true);
  assert.deepEqual(S.collectSky(items, before, after), []);
  assert.deepEqual(S.collectSky(items, { x: 0, y: 200, z: 0 }, { x: 1, y: 200, z: 0 }), []);
  assert.equal(S.resetSky(items).some(i => i.taken), false);
});

test('the pilot’s saved stars, paints and trails are validated before use', () => {
  const fresh = { stars: 0, owned: [], paint: 'red', trail: 'clouds' };
  for (const bad of [null, undefined, '', 'nonsense', '[]', 42, '{"stars":-3,"owned":"gold","paint":"mud"}']) assert.deepEqual(S.normalizePilot(bad), fresh);
  assert.deepEqual(S.normalizePilot('{"stars":12,"paint":"blue","trail":"hearts","owned":["hearts","cheat","hearts"]}'), { stars: 12, owned: ['hearts'], paint: 'blue', trail: 'hearts' });
  assert.equal(S.normalizePilot({ paint: 'gold' }).paint, 'red', 'locked paint falls back');
  assert.equal(S.normalizePilot({ stars: 1e9 }).stars, 99999);
  assert.equal(S.normalizePilot({ stars: 2.5 }).stars, 0);
  assert.equal(new Set([...S.PLANE_PAINTS, ...S.PLANE_TRAILS].map(i => i.id)).size, S.PLANE_PAINTS.length + S.PLANE_TRAILS.length);
  assert.ok(S.PLANE_PAINTS.filter(p => !p.cost).length >= 4);
});

test('stars are earned by flying and buy each unlock exactly once', () => {
  let pilot = S.earnStars(null, 45);
  assert.equal(pilot.stars, 45);
  assert.equal(S.earnStars(pilot, -5).stars, 45);
  assert.equal(S.earnStars(pilot, 1.5).stars, 45);
  assert.deepEqual(S.buyForPilot(pilot, 'gold'), pilot, 'gold costs more');
  pilot = S.buyForPilot(pilot, 'purple');
  assert.deepEqual([pilot.stars, pilot.owned], [5, ['purple']]);
  assert.deepEqual(S.buyForPilot(pilot, 'purple'), pilot);
  assert.deepEqual(S.buyForPilot(pilot, 'red'), pilot, 'free paints are not for sale');
  assert.deepEqual(S.buyForPilot(pilot, 'nonsense'), pilot);
  assert.equal(S.pilotOwns(pilot, S.PLANE_PAINTS.find(p => p.id === 'purple')), true);
  assert.equal(S.pilotOwns(pilot, S.PLANE_PAINTS.find(p => p.id === 'gold')), false);
});
