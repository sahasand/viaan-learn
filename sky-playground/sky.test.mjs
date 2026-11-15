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
  assert.equal(items.filter(i => i.big).length, 3 + 6 * 2, 'a big star over every island, and two on every trail');
  for (const thing of items) {
    assert.ok(Math.hypot(thing.x, thing.z) < 430, 'well inside the turn-back boundary');
    assert.ok(thing.y - worldGroundHeight(thing.x, thing.z) >= 6.4 && thing.y <= 44, `${thing.kind} height ${thing.y}`);
    for (const o of obstacles) if (Math.hypot(thing.x - o.x, thing.z - o.z) < o.radius + 3) assert.ok(thing.y >= o.top + 3);
    assert.equal(thing.taken, false);
    assert.equal(thing.value, thing.big ? S.BIG_STAR : { star: 1, balloon: 3, hoop: 2 }[thing.kind]);
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

test('every trail starts straight ahead of the takeoff and bends gently toward its destination', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const path = S.trailPath(from.id, to.id), start = afterTakeoff(from.id), end = approachFor(to.id)[0];
    const first = path.at(0), last = path.at(path.length);
    assert.ok(Math.abs(first.x - start.x) < .01 && first.z < start.z && first.z > start.z - 10 && first.heading === 0, 'dead ahead of the plane');
    assert.ok(Math.hypot(last.x - end.x, last.z - end.z) < .01, 'ends where the landing begins');
    for (let d = 0; d < path.length; d += 5) {
      const a = path.at(d), b = path.at(Math.min(d + 5, path.length));
      assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - Math.min(5, path.length - d)) < .2, 'no jumps along the path');
      assert.ok(Math.abs(b.heading - a.heading) < .15, 'a bend wide enough for the fastest plane');
    }
    // A child who has just taken off sees the first stars in front of the plane.
    const stars = S.routeItems(from.id, to.id, obstacles).filter(i => i.kind === 'star');
    for (const star of stars.slice(0, 2)) assert.ok(star.z < start.z && Math.abs(star.x - start.x) < 12 && Math.abs(star.y - start.y) < 4, `${from.id} to ${to.id} star at ${star.x - start.x}, ${star.z - start.z}`);
    assert.deepEqual(stars.filter(i => i.big).map(i => stars.indexOf(i)), [Math.floor((stars.length + 1) / 2) - 1, stars.length - 1]);
  }
});

test('only one star trail is in the sky at a time, and only what is in the sky can be collected', () => {
  const items = S.buildSky(obstacles), island = items.find(i => !i.route), routes = route => new Set(items.filter(i => S.inSky(i, route) && i.route).map(i => i.route));
  assert.deepEqual([...routes('sunny>jungle')], ['sunny>jungle']);
  assert.deepEqual([...routes('')].sort(), ['jungle>sunny', 'snowy>jungle', 'sunny>snowy'], 'free flying shows one trail leaving each island');
  assert.equal(routes('picnic').size, 0);
  for (const route of ['', 'picnic', 'snowy>sunny']) assert.equal(S.inSky(island, route), true);
  // A star from the middle of a trail, well away from where the two trails leaving Sunny Island part.
  const star = items.filter(i => i.route === 'sunny>jungle' && i.kind === 'star')[9], through = [{ x: star.x - 3, y: star.y, z: star.z }, { x: star.x + 3, y: star.y, z: star.z }];
  assert.deepEqual(S.collectSky(items, ...through, 'sunny>snowy'), []);
  assert.deepEqual(S.collectSky(items, ...through, ''), []);
  assert.ok(S.collectSky(items, ...through, 'sunny>jungle').includes(star));
});

test('a helped flight straight from takeoff gathers nearly every star and both hoops', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const route = `${from.id}>${to.id}`, items = S.routeItems(from.id, to.id, obstacles), target = approachFor(to.id)[0], found = [];
    let state = afterTakeoff(from.id), steps = 0;
    while (steps++ < 20000) {
      const previous = state, lead = S.nextOnRoute(items, route, state);
      state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, lead || target, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
      found.push(...S.collectSky(items, previous, state, route));
      if (!lead && touchesTarget(previous, state, target, 8)) break;
    }
    const stars = items.filter(i => i.kind === 'star').length;
    assert.ok(steps < 20000, `${route} reaches the landing approach`);
    assert.ok(found.filter(i => i.kind === 'star').length >= stars * .95, `${route}: ${found.length} found of ${stars}`);
    assert.equal(found.filter(i => i.kind === 'hoop').length, 2);
    assert.equal(new Set(found).size, found.length, 'nothing is collected twice');
  }
});

test('a child who only steers left and right, never up or down, still gathers most of a trail', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const route = `${from.id}>${to.id}`, items = S.routeItems(from.id, to.id, obstacles), stars = items.filter(i => i.kind === 'star');
    let state = afterTakeoff(from.id), got = 0;
    for (let steps = 0; steps < 12000 && stars.some(i => !i.taken); steps++) {
      const previous = state, lead = S.nextOnRoute(items, route, state);
      if (!lead) break;
      const turn = Math.atan2(Math.sin(Math.atan2(lead.x - state.x, -(lead.z - state.z)) - state.heading), Math.cos(Math.atan2(lead.x - state.x, -(lead.z - state.z)) - state.heading));
      state = stepFlight(state, { x: Math.max(-1, Math.min(1, turn * 1.5)), y: 0 }, 1 / 60, null, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
      got += S.collectSky(items, previous, state, route).filter(i => i.kind === 'star').length;
    }
    assert.ok(got >= stars.length * .7, `${route}: ${got} of ${stars.length} stars`);
  }
});

test('help asked for late joins the trail where the plane is and follows it forwards from there', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const route = `${from.id}>${to.id}`, items = S.buildSky(obstacles), target = approachFor(to.id)[0], stars = items.filter(i => i.route === route && i.kind === 'star');
    let state = afterTakeoff(from.id), steps = 0, order = [], turned = 0;
    // Fly straight on for a few seconds first, as a child would before asking for help.
    for (let i = 0; i < 300; i++) { const previous = state; state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, null, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight }); S.collectSky(items, previous, state, route); }
    const joined = S.nextOnRoute(items, route, state), nearest = stars.filter(i => !i.taken).reduce((a, b) => Math.hypot(a.x - state.x, a.z - state.z) <= Math.hypot(b.x - state.x, b.z - state.z) ? a : b);
    assert.equal(joined, nearest, `${route} joins at the nearest star`);
    while (steps++ < 30000) {
      const previous = state, lead = S.nextOnRoute(items, route, state);
      state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, lead || target, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
      turned += Math.abs(state.heading - previous.heading);
      order.push(...S.collectSky(items, previous, state, route).filter(i => i.route === route && i.kind === 'star').map(i => stars.indexOf(i)));
      if (!lead && touchesTarget(previous, state, target, 8)) break;
    }
    assert.ok(steps < 30000, `${route} reaches the landing approach`);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${route} never goes back for an earlier star`);
    assert.ok(order.length >= (stars.length - stars.indexOf(joined)) * .9, `${route}: ${order.length} stars from star ${stars.indexOf(joined)} of ${stars.length}`);
    assert.ok(turned < Math.PI * 2.5, `${route} does not circle: turned ${turned}`);
  }
  const items = S.routeItems('sunny', 'snowy');
  assert.equal(S.nextOnRoute(items, '', afterTakeoff('sunny')), null);
  assert.equal(S.nextOnRoute(items, 'sunny>jungle', afterTakeoff('sunny')), null);
  // A star just behind the plane is left alone.
  const first = items[0], past = { ...afterTakeoff('sunny'), x: first.x, z: first.z - 9 };
  assert.equal(S.nextOnRoute(items, 'sunny>snowy', past), items[1]);
  items.forEach(i => { i.taken = true; });
  assert.equal(S.nextOnRoute(items, 'sunny>snowy', afterTakeoff('sunny')), null);
});

test('the autopilot flies a whole trip: nearly every star, both hoops, every balloon, then on to the landing', () => {
  for (const from of AIRPORTS) for (const to of AIRPORTS) {
    if (from === to) continue;
    const route = `${from.id}>${to.id}`, items = S.buildSky(obstacles), target = approachFor(to.id)[0], mine = items.filter(i => i.route === route), found = [];
    let state = afterTakeoff(from.id), steps = 0, held = null, since = 0, longest = 0;
    while (steps++ < 30000) {
      const previous = state, next = S.autoTarget(items, route, state, held);
      if (next !== held) { held = next; since = steps; }
      longest = Math.max(longest, steps - since);
      state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, next || target, obstacles, { speed: 13, guideSpeed: 13, boundary: 490, groundHeight: worldGroundHeight });
      found.push(...S.collectSky(items, previous, state, route));
      if (!next && touchesTarget(previous, state, target, 8)) break;
    }
    const count = (list, kind) => list.filter(i => i.kind === kind).length;
    assert.ok(steps < 30000, `${route} reaches the landing approach`);
    assert.ok(found.filter(i => i.route === route && i.kind === 'star').length >= count(mine, 'star') * .9, `${route}: ${count(found, 'star')} stars`);
    assert.equal(found.filter(i => i.route === route && i.kind === 'hoop').length, 2, `${route} hoops`);
    assert.equal(found.filter(i => i.route === route && i.kind === 'balloon').length, 3, `${route} balloons`);
    assert.ok(longest < 60 * 10, `${route} never chases one thing for long: ${longest} steps`);
    assert.ok(found.every(i => S.inSky(i, route)));
  }
});

test('with nobody aboard the autopilot tours the sky, keeps its choice, and skips what it is told to avoid', () => {
  const items = S.buildSky(obstacles), found = [], avoid = new Set();
  let state = afterTakeoff('sunny'), held = null, since = 0;
  for (let steps = 0; steps < 60 * 150; steps++) {
    const previous = state, next = S.autoTarget(items, '', state, held, avoid);
    if (next !== held) { held = next; since = steps; } else if (next && steps - since > 60 * 12) { avoid.add(next); held = null; }
    assert.ok(next, 'there is always something to fly to');
    state = stepFlight(state, { x: 0, y: 0 }, 1 / 60, next, obstacles, { speed: 13, guideSpeed: 13, boundary: 490, groundHeight: worldGroundHeight });
    found.push(...S.collectSky(items, previous, state, ''));
  }
  assert.ok(found.length >= 70, `${found.length} things in two and a half minutes`);
  assert.ok(avoid.size <= 2, `gave up on ${avoid.size}`);
  assert.ok(new Set(found.map(i => i.route)).size >= 2, 'it leaves the island it took off from');
  // A choice is kept while it is still there, dropped once taken or flown past, and never comes from the avoid list.
  const fresh = S.buildSky(obstacles), start = afterTakeoff('sunny'), first = S.autoTarget(fresh, '', start);
  const other = fresh.find(i => i !== first && S.inSky(i, '') && Math.hypot(i.x - start.x, i.z - start.z) > 60);
  assert.equal(S.autoTarget(fresh, '', start, other), other);
  other.taken = true;
  assert.equal(S.autoTarget(fresh, '', start, other), first);
  assert.notEqual(S.autoTarget(fresh, '', start, null, new Set([first])), first);
  assert.equal(S.autoTarget(fresh, '', { ...start, x: first.x, z: first.z - 9 }, first) === first, false, 'flown past');
  fresh.forEach(i => { i.taken = true; });
  assert.equal(S.autoTarget(fresh, '', start), null);
  assert.equal(S.autoTarget(fresh, 'sunny>snowy', start), null);
});

test('collecting marks things taken once, works at low frame rates, and a new flight puts them back', () => {
  const items = S.routeItems('sunny', 'snowy'), star = items[7], route = 'sunny>snowy';
  const before = { x: star.x, y: star.y - 9, z: star.z }, after = { x: star.x, y: star.y + 9, z: star.z };
  assert.deepEqual(S.collectSky(items, before, after, route), [star]);
  assert.equal(star.taken, true);
  assert.deepEqual(S.collectSky(items, before, after, route), []);
  assert.deepEqual(S.collectSky(items, { x: 0, y: 200, z: 0 }, { x: 1, y: 200, z: 0 }, route), []);
  assert.equal(S.resetSky(items).some(i => i.taken), false);
  // Reach is taller than it is wide: flying well under a star still catches it, flying well beside it does not.
  const pass = (dx, dy) => S.collectSky(S.resetSky(items), { x: star.x + dx, y: star.y + dy, z: star.z - 1 }, { x: star.x + dx, y: star.y + dy, z: star.z + 1 }, route).includes(star);
  assert.deepEqual([pass(0, -16), pass(0, 16), pass(0, -20), pass(10, 0), pass(12.5, 0)], [true, true, false, true, false]);
  // A zooming plane pulls stars in from twice as far.
  const zooming = dx => S.collectSky(S.resetSky(items), { x: star.x + dx, y: star.y, z: star.z - 1 }, { x: star.x + dx, y: star.y, z: star.z + 1 }, route, S.ZOOM_PULL).includes(star);
  assert.deepEqual([zooming(20), zooming(24)], [true, false]);
  assert.equal(S.reachOf(star), 11);
});

test('the pilot’s saved stars, paints and trails are validated before use', () => {
  const fresh = { stars: 0, owned: [], paint: 'red', trail: 'clouds', toy: 'horn', sound: false };
  for (const bad of [null, undefined, '', 'nonsense', '[]', 42, '{"stars":-3,"owned":"gold","paint":"mud"}']) assert.deepEqual(S.normalizePilot(bad), fresh);
  assert.deepEqual(S.normalizePilot('{"stars":12,"paint":"blue","trail":"hearts","owned":["hearts","cheat","hearts"]}'), { stars: 12, owned: ['hearts'], paint: 'blue', trail: 'hearts', toy: 'horn', sound: false });
  assert.equal(S.normalizePilot({ toy: 'fireworks' }).toy, 'horn', 'a locked toy falls back to the free one');
  assert.equal(S.normalizePilot({ toy: 'fireworks', owned: ['fireworks'] }).toy, 'fireworks');
  assert.equal(S.normalizePilot({ sound: true }).sound, true);
  assert.equal(S.normalizePilot({ sound: 'yes' }).sound, false);
  assert.equal(S.earnStars({ sound: true }, 3).sound, true, 'earning stars keeps the sound choice');
  assert.equal(S.normalizePilot({ paint: 'gold' }).paint, 'red', 'locked paint falls back');
  assert.equal(S.normalizePilot({ stars: 1e9 }).stars, 99999);
  assert.equal(S.normalizePilot({ stars: 2.5 }).stars, 0);
  const shop = [...S.PLANE_PAINTS, ...S.PLANE_TRAILS, ...S.PLANE_TOYS];
  assert.equal(new Set(shop.map(i => i.id)).size, shop.length);
  assert.ok(!S.PLANE_TOYS[0].cost && S.PLANE_TOYS.every(t => t.icon && t.name), 'there is always a free toy');
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
  // Crossing a price is announced once, and never for something already owned.
  const names = (before, after) => S.nowAffordable(S.normalizePilot(before), S.normalizePilot(after)).map(i => i.id);
  assert.deepEqual(names({ stars: 38 }, { stars: 41 }), ['purple']);
  assert.deepEqual(names({ stars: 41 }, { stars: 44 }), []);
  assert.deepEqual(names({ stars: 38 }, { stars: 52 }), ['purple', 'bubbles']);
  assert.deepEqual(names({ stars: 20 }, { stars: 26 }), ['confetti']);
  assert.deepEqual(S.buyForPilot({ stars: 30 }, 'confetti').owned, ['confetti']);
  assert.deepEqual(names({ stars: 38, owned: ['purple'] }, { stars: 41, owned: ['purple'] }), []);
});

test('stars fill zooms, a zoom is spent whole, and the plane never holds more than three', () => {
  let zoom = S.freshZoom();
  assert.deepEqual(zoom, { ready: 1, stars: 0 });
  zoom = S.chargeZoom(zoom, 5); assert.deepEqual(zoom, { ready: 1, stars: 5 });
  zoom = S.chargeZoom(zoom, 1); assert.deepEqual(zoom, { ready: 2, stars: 0 });
  zoom = S.chargeZoom(zoom, 40); assert.deepEqual(zoom, { ready: S.ZOOM_MAX, stars: 0 }, 'full, and nothing is carried over');
  assert.deepEqual(S.chargeZoom(zoom, -3), zoom);
  zoom = S.spendZoom(zoom); assert.equal(zoom.ready, 2);
  assert.equal(S.spendZoom({ ready: 0, stars: 4 }), null);
});

test('a pilot who is not steering up or down is eased to the height of the nearest star ahead', () => {
  const items = S.routeItems('sunny', 'snowy', obstacles), route = 'sunny>snowy', first = items[0];
  const start = { ...afterTakeoff('sunny'), y: 40 };
  assert.equal(S.starHeight(items, route, start), first.y);
  assert.equal(S.starHeight(items, route, { ...start, heading: Math.PI }), null, 'stars behind the plane do not count');
  assert.equal(S.starHeight(items, 'picnic', start), null, 'nor do stars that are not in the sky');
  first.taken = true;
  assert.equal(S.starHeight(items, route, start), items[1].y);
  // Flying level from far too high, with only that help, still catches most of the trail.
  S.resetSky(items);
  let state = start, got = 0;
  for (let steps = 0; steps < 12000; steps++) {
    const previous = state, lead = S.nextOnRoute(items, route, state), y = S.starHeight(items, route, state);
    if (!lead) break;
    const turn = Math.atan2(Math.sin(Math.atan2(lead.x - state.x, -(lead.z - state.z)) - state.heading), Math.cos(Math.atan2(lead.x - state.x, -(lead.z - state.z)) - state.heading));
    state = stepFlight(state, { x: Math.max(-1, Math.min(1, turn * 1.5)), y: y === null ? 0 : Math.max(-.6, Math.min(.6, (y - state.y) * .12)) }, 1 / 60, null, obstacles, { speed: 13, boundary: 490, groundHeight: worldGroundHeight });
    got += S.collectSky(items, previous, state, route).filter(i => i.kind === 'star').length;
  }
  const stars = items.filter(i => i.kind === 'star').length;
  assert.ok(got >= stars * .8, `${got} of ${stars} stars from 22 too high`);
});

test('the page and every module load one another with the same version number', () => {
  const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
  const page = read('./index.html'), versions = new Set();
  for (const [, file, v] of page.matchAll(/(?:href|src)="(style\.css|game\.js)\?v=(\d+)"/g)) versions.add(v);
  assert.equal([...page.matchAll(/(?:href|src)="(style\.css|game\.js)\?v=\d+"/g)].length, 2, 'the page versions its styles and its script');
  for (const name of ['game.js', 'fx.js', 'sky.js', 'airline.js']) {
    for (const [, file, query] of read('./' + name).matchAll(/from '\.\/(flight|airline|sky|fx|tunes)\.js(\?v=\d+)?'/g)) {
      assert.ok(query, `${name} imports ${file}.js with a version`);
      versions.add(query.slice(3));
    }
  }
  assert.equal(versions.size, 1, `one version everywhere, found ${[...versions]}`);
});
