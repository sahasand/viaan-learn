import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as R from './race.js';

const here = name => new URL(name, import.meta.url);
function drive(trackId, input, fps = 60, onEvent = () => {}) {
  const race = R.createRace(trackId);
  let steps = 0;
  while (race.phase !== 'finished' && steps++ < fps * 400) {
    const steer = typeof input === 'function' ? input(race) : input;
    for (const event of R.stepRace(race, steer, 1 / fps)) onEvent(event, race);
  }
  return race;
}
// Steers like a careful child: into each bend and back toward the middle.
const careful = race => {
  const player = R.playerOf(race);
  return R.clamp(-player.lat * .5 + R.trackPose(race.track, player.d + 8, 0).k * 40, -1, 1);
};

test('every track is a smooth closed loop that starts at the line heading along +x', () => {
  assert.equal(R.TRACKS.length, 4);
  for (const definition of R.TRACKS) {
    const track = R.getTrack(definition.id);
    assert.ok(track.length > 750 && track.length < 1100, `${definition.id} length ${track.length}`);
    assert.ok(Math.abs(track.step - 1) < .01);
    assert.ok(Math.hypot(track.xs[0], track.zs[0]) < 2, 'starts beside the origin');
    assert.ok(Math.abs(R.angleDelta(track.hs[0], Math.PI / 2)) < .25, 'faces +x at the start');
    let tightest = Infinity;
    for (const k of track.ks) tightest = Math.min(tightest, 1 / Math.abs(k));
    assert.ok(tightest > R.EDGE + 4, `${definition.id} tightest corner radius ${tightest}`);
    for (let i = 0; i < track.n; i++) {
      const j = (i + 1) % track.n;
      assert.ok(Math.abs(Math.hypot(track.xs[j] - track.xs[i], track.zs[j] - track.zs[i]) - track.step) < .05);
    }
    // No two separate stretches of road run close enough to overlap.
    for (let i = 0; i < track.n; i += 3) for (let j = i + 80; j < track.n; j += 3) {
      if (track.n - (j - i) < 80) continue;
      assert.ok(Math.hypot(track.xs[i] - track.xs[j], track.zs[i] - track.zs[j]) > 2 * R.EDGE + 6);
    }
  }
});

test('track poses wrap around the lap and place lateral offsets on the driver’s right', () => {
  const track = R.getTrack('beach'), a = R.trackPose(track, 5, 0), b = R.trackPose(track, 5 + track.length * 2, 0), c = R.trackPose(track, 5 - track.length, 0);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  assert.ok(Math.hypot(a.x - c.x, a.z - c.z) < 1e-6);
  const right = R.trackPose(track, 5, 3);
  // Heading +x: the right-hand side is +z (toward the viewer).
  assert.ok(right.z - a.z > 2.9);
  assert.ok(R.distanceToTrack(track, right.x, right.z, 1) < 3.2);
  assert.equal(R.getTrack('nowhere').id, 'beach');
});

test('the grid puts Viaan behind three animal friends and nobody moves before GO', () => {
  const race = R.createRace('snow');
  assert.deepEqual(race.cars.map(c => c.id), ['viaan', 'biscuit', 'pepper', 'waffle']);
  assert.ok(race.cars.every(c => c.d < 0));
  assert.equal(R.placeOf(race), 4);
  const events = [];
  for (let i = 0; i < 179; i++) events.push(...R.stepRace(race, 1, 1 / 60));
  assert.equal(race.phase, 'countdown');
  assert.deepEqual(events, ['count', 'count']);
  assert.ok(race.cars.every(c => c.speed === 0 && c.d < 0));
  for (let i = 0; i < 3; i++) events.push(...R.stepRace(race, 1, 1 / 60));
  assert.equal(race.phase, 'racing');
  assert.equal(events.at(-1), 'go');
});

test('a hands-off driver still finishes every track without leaving the soft walls', () => {
  for (const { id } of R.TRACKS) {
    for (const input of [0, -1, 1]) {
      let widest = 0;
      const race = drive(id, r => { widest = Math.max(widest, Math.abs(R.playerOf(r).lat)); return input; });
      assert.equal(race.phase, 'finished', `${id} with input ${input}`);
      assert.ok(widest <= R.EDGE);
      assert.ok(race.time < 240, `${id} took ${race.time}s holding ${input}`);
      assert.ok(R.placeOf(race) >= 1 && R.placeOf(race) <= 4);
    }
  }
});

test('a careful driver wins, in about a minute and a half, at any frame rate', () => {
  for (const { id } of R.TRACKS) {
    const times = [20, 60, 120].map(fps => {
      const race = drive(id, careful, fps);
      assert.equal(R.placeOf(race), 1, `${id} at ${fps} fps`);
      return race.time;
    });
    assert.ok(times[1] > 70 && times[1] < 130, `${id} took ${times[1]}s`);
    assert.ok(Math.max(...times) - Math.min(...times) < 2, `${id} frame-rate spread ${times}`);
  }
});

test('laps are announced exactly once each and never at the starting line', () => {
  const events = [];
  const race = drive('jungle', careful, 60, e => events.push(e));
  assert.deepEqual(events.filter(e => ['go', 'lap', 'lastlap', 'finish'].includes(e)), ['go', 'lap', 'lastlap', 'finish']);
  assert.equal(R.lapOf(race, R.playerOf(race)), R.LAPS);
  assert.equal(R.stepRace(race, 0, 1 / 60).includes('finish'), false);
});

test('stars boost only the player, come back each lap, and are spread along the road', () => {
  const race = R.createRace('beach');
  assert.ok(race.stars.length >= 10);
  assert.ok(race.stars.every(s => Math.abs(s.lat) < R.HALF_ROAD - 2 && s.s > 30 && s.s < race.track.length - 5));
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  const player = R.playerOf(race), first = race.stars[0];
  player.d = first.s - 2; player.lat = first.lat; player.speed = R.CRUISE;
  race.cars.slice(1).forEach(c => { c.d = player.d - 60; });
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('star'));
  assert.equal(first.taken, true);
  assert.equal(player.boost, R.BOOST_SECONDS);
  for (let i = 0; i < 60; i++) R.stepRace(race, 0, 1 / 60);
  assert.ok(player.speed > R.CRUISE + 3, 'the boost lifts speed above cruising');
  // A rival driving over a star leaves it for Viaan.
  const second = race.stars[1], rival = race.cars[1];
  rival.d = second.s; rival.lat = second.lat; player.d = second.s - 40;
  R.stepRace(race, 0, 1 / 60);
  assert.equal(second.taken, false);
  // Crossing the line puts every star back.
  player.d = race.track.length - .2; player.lat = 0;
  assert.ok(R.stepRace(race, 0, 1 / 20).includes('lap'));
  assert.ok(race.stars.every(s => !s.taken));
});

test('each track has a tunnel and two jump ramps on straight road, well apart', () => {
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id), spots = [track.tunnel.s, ...track.ramps];
    assert.equal(track.ramps.length, 2);
    assert.equal(track.tunnel.length, R.TUNNEL_LENGTH);
    for (const s of spots) {
      assert.ok(s >= 100 && s <= track.length - 110, `${id} feature at ${s}`);
      // Ramps need nearly straight road for the flight; the tunnel just follows a gentle bend.
      for (let d = s; d < s + 40; d += 2) assert.ok(Math.abs(R.trackPose(track, d, 0).k) < 1 / (s === track.tunnel.s ? 30 : 45), `${id} is nearly straight at ${d}`);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.ok(Math.abs(spots[i] - spots[j]) > 150);
    for (const star of R.starsFor(track)) for (const ramp of track.ramps) assert.ok(star.s < ramp - 6 || star.s > ramp + 38);
  }
});

test('ramps launch the car once each lap, hold its speed in the air and land it safely', () => {
  for (const fps of [20, 60, 120]) {
    const events = [];
    const race = drive('snow', careful, fps, e => events.push(e));
    assert.equal(events.filter(e => e === 'jump').length, R.LAPS, `jumps at ${fps} fps`);
    assert.equal(events.filter(e => e === 'megajump').length, R.LAPS);
    assert.equal(events.filter(e => e === 'loop').length, R.LAPS, 'one trip round the loop each lap');
    assert.equal(events.filter(e => e === 'land').length, 2 * R.LAPS + events.filter(e => e === 'bounce').length, 'every flight lands');
    assert.equal(R.playerOf(race).air, 0);
  }
  const race = R.createRace('beach');
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  const player = R.playerOf(race), ramp = race.track.ramps[0];
  race.cars.slice(1).forEach(c => { c.d = ramp + 300; });
  player.d = ramp - .2; player.lat = 0; player.speed = R.CRUISE;
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('jump'));
  assert.equal(player.air, R.AIR_SECONDS);
  // Flying over the grass does not slow the car, and the flight ends on time.
  player.lat = R.EDGE; let frames = 0;
  while (player.air > 0 && frames++ < 200) R.stepRace(race, 0, 1 / 60);
  assert.ok(Math.abs(frames / 60 - R.AIR_SECONDS) < .05);
  assert.ok(player.speed > R.CRUISE - .01);
  // A car crawling over the ramp just rolls across.
  player.d = race.track.ramps[0] + race.track.length - .1; player.speed = 5; player.lat = 0;
  assert.equal(R.stepRace(race, 0, 1 / 60).includes('jump'), false);
});

test('grass slows the car and nudges it back; the road restores full speed', () => {
  const race = R.createRace('beach');
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  const player = R.playerOf(race);
  race.cars.slice(1).forEach(c => { c.d = 400; });
  player.d = 20; player.lat = R.EDGE; player.speed = R.CRUISE;
  for (let i = 0; i < 40; i++) R.stepRace(race, 0, 1 / 60);
  assert.ok(player.speed < R.CRUISE - 3);
  assert.ok(player.lat < R.EDGE - .5, 'drifts back toward the road with no steering');
  assert.ok(player.speed >= 8, 'never stops');
});

test('rivals wait for a driver who is behind and chase one who is ahead', () => {
  assert.equal(R.rubberBand(0), 1);
  assert.ok(R.rubberBand(50) <= .5 && R.rubberBand(500) === R.rubberBand(50));
  assert.ok(R.rubberBand(-80) > 1.1 && R.rubberBand(-80) < 1.2);
  // Even the fastest rival, far ahead, drives slower than Viaan on the grass.
  assert.ok(R.CRUISE * Math.max(...R.RIVALS.map(r => r.pace)) * R.rubberBand(60) < R.GRASS);
});

test('bumps are soft: cars slide apart, keep moving and stay finite', () => {
  const race = R.createRace('snow');
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  const player = R.playerOf(race), panda = race.cars[1];
  player.d = 100; player.lat = 3; player.speed = R.CRUISE; panda.d = 102; panda.lat = 3.2; panda.speed = 20;
  const events = [];
  for (let i = 0; i < 90; i++) events.push(...R.stepRace(race, 0, 1 / 60));
  assert.equal(events.filter(e => e === 'bump').length, 1, 'one bump sound per touch');
  assert.ok(Math.abs(player.lat - panda.lat) >= 2.4 || Math.abs(player.d - panda.d) > 4.5);
  assert.ok(player.speed >= 8);
  for (const car of race.cars) for (const value of [car.d, car.lat, car.speed]) assert.ok(Number.isFinite(value));
});

test('odd inputs and long pauses cannot break the race', () => {
  const race = R.createRace('beach');
  for (const input of [NaN, undefined, 'left', Infinity, -Infinity, 99]) for (let i = 0; i < 80; i++) R.stepRace(race, input, 5);
  const player = R.playerOf(race);
  assert.ok(Number.isFinite(player.d) && Number.isFinite(player.lat) && Math.abs(player.lat) <= R.EDGE);
  // A five-second frame advances no more than the clamped step.
  const before = player.d; R.stepRace(race, 0, 5);
  assert.ok(player.d - before < (R.CRUISE + R.BOOST) * .05 / .6 + .01);
});

test('finishing order is fixed once a car crosses the line', () => {
  const race = drive('beach', careful);
  assert.equal(race.finishOrder[0], 'viaan');
  for (let i = 0; i < 60 * 60; i++) R.stepRace(race, 0, 1 / 60);
  assert.equal(race.finishOrder.length, 4);
  assert.equal(new Set(race.finishOrder).size, 4);
  assert.deepEqual(R.standings(race).map(c => c.id), race.finishOrder);
  assert.equal(R.placeOf(race), 1);
});

test('saved choices are validated before use', () => {
  const fallback = { car: 'supercar', paint: 'sunshine', track: 'beach', coins: 0, owned: [], cups: {} };
  for (const bad of [null, undefined, '', 'nonsense', '[]', '{"paint":7}', 42, '{"paint":"mud","track":"moon"}', '{"coins":-5,"owned":"gold","cups":[3]}']) assert.deepEqual(R.normalizePrefs(bad), fallback);
  // The first release saved only a paint and a track; that still loads.
  assert.deepEqual(R.normalizePrefs('{"paint":"grape","track":"snow","extra":1}'), { ...fallback, paint: 'grape', track: 'snow' });
  // Locked paints fall back until they are owned.
  assert.equal(R.normalizePrefs({ paint: 'gold' }).paint, 'sunshine');
  const rich = R.normalizePrefs({ paint: 'gold', owned: ['gold', 'gold', 'cheat', 7], coins: 12.5, cups: { beach: 2, snow: 9, moon: 1 } });
  assert.deepEqual(rich, { car: 'supercar', paint: 'gold', track: 'beach', coins: 0, owned: ['gold'], cups: { beach: 2 } });
  assert.equal(R.normalizePrefs({ coins: 1e9 }).coins, 99999);
  assert.equal(R.PAINTS.filter(p => !p.cost).length, 6);
  assert.equal(new Set(R.PAINTS.map(i => i.id)).size, R.PAINTS.length);
});

test('trails are gone and the coins once spent on them come back exactly once', () => {
  assert.equal(R.TRAILS, undefined);
  const old = { paint: 'gold', trail: 'bubbles', coins: 659, owned: ['gold', 'bubbles', 'fire', 'bubbles'], cups: { beach: 3 } };
  const now = R.normalizePrefs(old);
  assert.deepEqual(now, { car: 'supercar', paint: 'gold', track: 'beach', coins: 659 + 100 + 400, owned: ['gold'], cups: { beach: 3 } });
  assert.deepEqual(R.normalizePrefs(JSON.stringify(now)), now, 'reading the new save again adds nothing');
  assert.equal(R.normalizePrefs({ coins: 99990, owned: ['ribbon'] }).coins, 99999);
  assert.deepEqual(R.buy(R.normalizePrefs({ coins: 500 }), 'bubbles'), R.normalizePrefs({ coins: 500 }), 'trails are not for sale');
});

test('coins buy unlocks exactly once and only when there are enough', () => {
  let prefs = R.normalizePrefs({ coins: 120 });
  assert.deepEqual(R.buy(prefs, 'gold'), prefs, 'gold costs 150');
  prefs = R.buy(R.normalizePrefs({ coins: 170 }), 'gold');
  assert.deepEqual([prefs.coins, prefs.owned], [20, ['gold']]);
  assert.deepEqual(R.buy(prefs, 'gold'), prefs, 'already owned');
  assert.deepEqual(R.buy(prefs, 'sunshine'), prefs, 'free paints are not for sale');
  assert.deepEqual(R.buy(prefs, 'nonsense'), prefs);
  assert.equal(R.nextUnlock(prefs).id, 'rainbow');
  assert.equal(R.nextUnlock(R.normalizePrefs({ owned: ['gold', 'rainbow', 'galaxy'] })), null);
});

test('finishing banks coins and a cup; winning makes the cup gold and it never downgrades', () => {
  let prefs = R.award(R.normalizePrefs(null), 'snow', 3, 40);
  assert.deepEqual([prefs.coins, prefs.cups], [40, { snow: 1 }]);
  prefs = R.award(prefs, 'snow', 1, 25);
  assert.deepEqual([prefs.coins, prefs.cups], [65, { snow: 2 }]);
  prefs = R.award(prefs, 'snow', 4, 5);
  assert.deepEqual([prefs.coins, prefs.cups], [70, { snow: 2 }]);
  assert.deepEqual(R.award(prefs, 'moon', 1, 50), prefs);
  assert.equal(R.award(prefs, 'beach', 2, -30).coins, 70);
});

test('roads climb and dip gently, stay level at the start and never sink below zero', () => {
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id);
    let top = 0, steepest = 0;
    for (let i = 0; i < track.n; i++) { assert.ok(track.ys[i] >= 0); top = Math.max(top, track.ys[i]); steepest = Math.max(steepest, Math.abs(track.slopes[i])); }
    assert.ok(top > 5 && top < 20, `${id} highest point ${top}`);
    assert.ok(steepest > .05 && steepest < .2, `${id} steepest slope ${steepest}`);
    for (const d of [-28, -10, 0, 10, 28]) assert.ok(R.trackPose(track, d, 0).y < .01);
    assert.ok(Math.abs(track.ys[0] - track.ys[track.n - 1]) < .01, 'the lap closes without a step');
    const pose = R.trackPose(track, 300.5, 2);
    assert.ok(Math.abs(pose.y - (track.ys[300] + track.ys[301]) / 2) < .05 && Number.isFinite(pose.slope));
  }
});

test('holding a turn through a corner charges a drift and letting go gives a boost', () => {
  const race = R.createRace('snow'), player = R.playerOf(race), track = race.track;
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  // Find a long bend and sit the car on its outside edge at full speed.
  let s = 0; for (let i = 120; i < track.n - 120; i++) { let ok = true; for (let j = 0; j < 70; j++) if (Math.abs(track.ks[i + j]) < .012 || Math.sign(track.ks[i + j]) !== Math.sign(track.ks[i])) { ok = false; break; } if (ok) { s = i; break; } }
  assert.ok(s > 0, 'the track has a long corner');
  const dir = Math.sign(track.ks[s]);
  const setUp = () => { player.d = s; player.lat = -dir * 5; player.speed = R.CRUISE; player.boost = 0; player.drift = 0; player.driftDir = 0; player.air = 0; race.cars.slice(1).forEach(c => { c.d = s + 400; }); };
  setUp();
  const events = [];
  for (let i = 0; i < 80; i++) events.push(...R.stepRace(race, dir, 1 / 60));
  assert.ok(events.includes('drift'), 'blue sparks after holding the corner');
  assert.equal(player.boost, 0, 'no boost while still holding');
  assert.ok(Math.abs(player.lat) < R.HALF_ROAD, 'the drift holds the car on the road');
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('turbo'));
  assert.ok(player.boost > .8 && player.drift === 0);
  // A quick tap charges nothing, and steering away from the bend does not count.
  setUp(); events.length = 0;
  for (let i = 0; i < 20; i++) events.push(...R.stepRace(race, dir, 1 / 60));
  events.push(...R.stepRace(race, 0, 1 / 60));
  setUp();
  for (let i = 0; i < 40; i++) events.push(...R.stepRace(race, -dir, 1 / 60));
  events.push(...R.stepRace(race, 0, 1 / 60));
  assert.equal(events.includes('turbo'), false);
  // Sliding onto the grass throws the charge away.
  setUp(); player.drift = 1.5; player.driftDir = dir; player.lat = dir * (R.HALF_ROAD + 1);
  assert.equal(R.stepRace(race, dir, 1 / 60).includes('turbo'), false);
  assert.equal(player.drift, 0);
});

test('coins sit in rows and over ramps, count once and return each lap', () => {
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id), coins = R.coinsFor(track);
    assert.ok(coins.length >= 40, `${id} has ${coins.length} coins`);
    assert.equal(coins.filter(c => c.air).length, 14 + 3 * R.bouncersFor(track).length);
    assert.equal(coins.filter(c => c.loop).length, 8 * track.loop.turns);
    for (const coin of coins) assert.ok(Math.abs(coin.lat) < R.HALF_ROAD - 2 + (coin.loop ? 2 : 0) && coin.s > 20 && coin.s < track.length - 10);
    for (const coin of coins.filter(c => !c.air)) for (const star of R.starsFor(track)) assert.ok(Math.abs(coin.s - star.s) > 4 || coin.lat !== star.lat);
  }
  const race = R.createRace('beach'), player = R.playerOf(race);
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  race.cars.slice(1).forEach(c => { c.d = 500; });
  const row = race.coins.filter(c => !c.air).slice(0, 5);
  player.d = row[0].s - 3; player.lat = row[0].lat; player.speed = R.CRUISE;
  const events = [];
  for (let i = 0; i < 60; i++) events.push(...R.stepRace(race, 0, 1 / 60));
  assert.equal(events.filter(e => e === 'coin').length, 5);
  assert.equal(race.collected, 5);
  // Air coins need the car to be flying.
  const air = race.coins.find(c => c.air);
  player.d = air.s - 1; player.lat = 0; player.air = 0; player.speed = 5;
  R.stepRace(race, 0, 1 / 60); assert.equal(air.taken, false);
  player.d = air.s - 1; player.air = .5;
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('coin'));
  player.air = 0; player.d = race.track.length - .2; player.lat = 6.5;
  R.stepRace(race, 0, 1 / 20);
  assert.ok(race.coins.every(c => !c.taken));
  assert.equal(race.collected, 6, 'the count keeps growing across laps');
});

test('the loop joins the road smoothly, turns the car right over and carries it across lanes', () => {
  assert.deepEqual(R.TRACKS.map(t => R.getTrack(t.id).loop.turns), [1, 1, 2, 2]);
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id), s = track.loop.s, turns = track.loop.turns, G = track.loop.ground;
    assert.equal(G, R.LOOP.ground * turns);
    // In on the left; out on the right after one turn, back on the left after two.
    for (const [d, lat] of [[s + 1e-4, -R.LOOP.lane], [s + G - 1e-4, turns % 2 ? R.LOOP.lane : -R.LOOP.lane]]) {
      const frame = R.trackFrame(track, d, lat), road = R.trackPose(track, d, lat);
      assert.ok(Math.hypot(frame.x - road.x, frame.y - road.y, frame.z - road.z) < .05, 'no step where the loop meets the road');
      assert.ok(frame.uy > .98);
      assert.ok(Math.abs(R.loopLane(R.loopPhase(track, d), turns) - lat) < .01);
    }
    for (let k = 0; k < turns; k++) {
      const d = s + G * (k + .5) / turns, top = R.trackFrame(track, d, 0);
      assert.ok(Math.abs(top.y - R.trackPose(track, d, 0).y - 2 * R.LOOP.radius) < .01);
      assert.ok(top.uy < -.98, 'upside down at the top');
      assert.ok(Math.abs(R.loopHeight((k + .5) / turns, turns) - 2 * R.LOOP.radius) < 1e-9);
    }
    for (let t = .02; t < 1; t += .02) {
      const f = R.trackFrame(track, s + G * t, R.loopLane(t, turns));
      assert.ok(Math.abs(Math.hypot(f.fx, f.fy, f.fz) - 1) < 1e-6 && Math.abs(Math.hypot(f.ux, f.uy, f.uz) - 1) < 1e-6);
      assert.ok(Math.abs(f.fx * f.ux + f.fy * f.uy + f.fz * f.uz) < 1e-6, 'up stays square to forward');
      assert.ok(Math.abs(R.loopLane(t, turns)) <= R.LOOP.lane + 1e-9);
    }
    // The ribbon never runs through itself: where two parts pass each other there is room for a car between them.
    const spots = Array.from({ length: 200 }, (_, i) => { const t = (i + .5) / 200; return [R.trackFrame(track, s + G * t, R.loopLane(t, turns)), t]; });
    for (const [a, ta] of spots) for (const [b, tb] of spots) if (tb - ta > .12 / turns) assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 4, `${id} ribbon meets itself at ${ta} and ${tb}`);
    assert.equal(R.loopPhase(track, s - 1), -1);
    assert.equal(R.loopPhase(track, s + G + 1), -1);
    assert.equal(R.trackFrame(track, 50, 0).loop, -1);
    assert.equal(R.coinsFor(track).filter(c => c.loop).length, 8 * turns);
    // The loop stands clear of the tunnel and both ramps, on road that is very nearly straight.
    for (const other of [track.tunnel.s, ...track.ramps]) assert.ok(other < s - R.LOOP.lead - 30 || other > s + G + 30, `${id} loop too close to ${other}`);
    for (let i = -R.LOOP.lead; i <= G; i++) assert.ok(Math.abs(track.ks[Math.round(s + i) % track.n]) < 1 / 50, `${id} loop on a bend`);
  }
});

test('the launch strip fires every car into the loop, which slows it over the top and slings it out', () => {
  for (const id of ['beach', 'galaxy']) {
    const race = R.createRace(id), player = R.playerOf(race), track = race.track, s = track.loop.s, turns = track.loop.turns;
    for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
    race.cars.slice(1).forEach(c => { c.d = s + 300; });
    player.d = s - R.LOOP.lead - 1; player.lat = 5; player.speed = 6; player.nitro = 0; player.boost = 0;
    const events = [], speeds = []; let inside = 0, steps = 0, entry = 0;
    // Holding full right, no gas and the brake cannot fall out of the loop or stall in it.
    while (player.d < s + track.loop.ground + 1 && steps++ < 3000) {
      events.push(...R.stepRace(race, { steer: 1, gas: false, brake: true }, 1 / 60));
      const t = R.loopPhase(track, player.d);
      if (t < 0) continue;
      inside += 1 / 60; speeds.push([t, player.speed]); entry ||= player.speed;
      assert.ok(Math.abs(player.lat - R.loopLane(t, turns)) < 1.6, `lane at ${t}`);
      assert.ok(player.speed >= R.LOOP.slow - 1e-9 && player.speed <= R.CRUISE + R.BOOST + 2, `speed ${player.speed} at ${t}`);
      // Fast enough at every height to stay pressed onto the ribbon.
      assert.ok(player.speed * player.speed / R.LOOP.radius > R.LOOP.gravity * .95);
    }
    assert.ok(steps < 3000);
    assert.ok(entry > R.LOOP.launch - 2, `${id} enters at ${entry}`);
    assert.deepEqual(events.filter(e => ['launch', 'loop', 'looptop', 'looped'].includes(e)), ['launch', 'loop', ...Array(turns).fill('looptop'), 'looped']);
    // Slowest at each top, quick again at each bottom.
    const at = where => speeds.reduce((best, pair) => Math.abs(pair[0] - where) < Math.abs(best[0] - where) ? pair : best)[1];
    for (let k = 0; k < turns; k++) assert.ok(at((k + .5) / turns) < R.LOOP.launch - 10, `${id} top ${k} at ${at((k + .5) / turns)}`);
    for (let k = 1; k < turns; k++) assert.ok(at(k / turns) > R.LOOP.launch - 1);
    assert.ok(inside > 2.2 * turns && inside < 4.2 * turns, `${id}: the loop takes ${inside}s`);
    assert.ok(player.speed >= R.LOOP.launch - 6 && player.boost > R.LOOP.kick - .2, `slung out with a boost: ${player.speed}, ${player.boost}`);
    assert.ok(Math.abs(player.nitro - Math.min(1, turns * R.NITRO_COST + .05 * 8 * turns)) < .05 || player.nitro === 1, 'each top fills a burst');
    assert.ok(race.coins.filter(c => c.loop).every(c => c.taken), 'the ring of coins is swept up on the way round');
  }
  // A boost burning inside makes the trip quicker, and friends ride the loop the same way.
  const time = boosted => {
    const race = R.createRace('beach'), player = R.playerOf(race), s = race.track.loop.s;
    race.phase = 'racing'; race.cars.slice(1).forEach(c => { c.d = s + 300; });
    player.d = s - 1; player.lat = -R.LOOP.lane; player.speed = R.LOOP.launch; player.nitro = 1;
    let steps = 0;
    while (player.d < s + race.track.loop.ground && steps++ < 2000) R.stepRace(race, { steer: 0, gas: true, nitro: boosted && steps % 2 === 0 }, 1 / 60);
    return steps / 60;
  };
  assert.ok(time(true) < time(false) - .2);
  const race = R.createRace('snow'), rival = race.cars[1], s = race.track.loop.s;
  race.phase = 'racing'; rival.d = s - R.LOOP.lead - 1; rival.speed = 10; R.playerOf(race).d = s - 200;
  let slowest = 99, steps = 0;
  while (rival.d < s + race.track.loop.ground + 1 && steps++ < 3000) { R.stepRace(race, { steer: 0, gas: true, brake: true }, 1 / 60); if (R.loopPhase(race.track, rival.d) >= 0) slowest = Math.min(slowest, rival.speed); }
  assert.ok(steps < 3000 && slowest >= R.LOOP.slow - 1e-9 && slowest < R.LOOP.launch - 10);
});

test('gas makes the car go, letting go coasts, and the brake stops it without ever reversing', () => {
  const race = R.createRace('beach'), player = R.playerOf(race);
  for (let i = 0; i < 181; i++) R.stepRace(race, { steer: 0, gas: false }, 1 / 60);
  for (let i = 0; i < 60; i++) R.stepRace(race, { steer: 0, gas: false }, 1 / 60);
  assert.equal(player.speed, 0, 'no gas, no go');
  for (let i = 0; i < 240; i++) R.stepRace(race, { steer: 0, gas: true }, 1 / 60);
  assert.ok(player.speed > R.CRUISE - 2);
  const fast = player.speed;
  for (let i = 0; i < 60; i++) R.stepRace(race, { steer: 0 }, 1 / 60);
  assert.ok(player.speed < fast && player.speed > fast * .5, 'coasting slows gently');
  for (let i = 0; i < 120; i++) R.stepRace(race, { steer: 0, gas: true, brake: true }, 1 / 60);
  assert.ok(player.speed < .5, 'the brake wins over the gas');
  const stopped = player.d;
  for (let i = 0; i < 120; i++) R.stepRace(race, { steer: 0, brake: true }, 1 / 60);
  assert.ok(player.d >= stopped && player.d - stopped < .5 && player.speed >= 0);
});

test('nitro fills from coins, stars and drifts, and each press spends one burst', () => {
  const race = R.createRace('beach'), player = R.playerOf(race);
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  race.cars.slice(1).forEach(c => { c.d = 600; });
  assert.ok(Math.abs(player.nitro - R.NITRO_COST) < 1e-9, 'the race starts with one burst in the tank');
  player.nitro = 0;
  assert.ok(R.stepRace(race, { steer: 0, gas: true, nitro: true }, 1 / 60).includes('empty'));
  R.stepRace(race, { steer: 0, gas: true }, 1 / 60);
  const star = race.stars[0]; player.d = star.s - 1; player.lat = star.lat; player.speed = R.CRUISE;
  R.stepRace(race, { steer: 0, gas: true }, 1 / 60);
  assert.ok(Math.abs(player.nitro - R.NITRO_COST) < .05, 'a star adds one burst');
  player.nitro = 1; player.boost = 0;
  const first = R.stepRace(race, { steer: 0, gas: true, nitro: true }, 1 / 60);
  assert.ok(first.includes('nitro')); assert.equal(player.boost > 1.5, true);
  // Holding the button does not burn the whole tank.
  for (let i = 0; i < 30; i++) assert.equal(R.stepRace(race, { steer: 0, gas: true, nitro: true }, 1 / 60).includes('nitro'), false);
  assert.ok(Math.abs(player.nitro - 2 / 3) < .15, 'one burst gone, give or take a coin or a knock-over');
  R.stepRace(race, { steer: 0, gas: true }, 1 / 60);
  assert.ok(R.stepRace(race, { steer: 0, gas: true, nitro: true }, 1 / 60).includes('nitro'));
  assert.ok(player.nitro <= 1 && player.nitro >= 0);
});

test('the second ramp is a mega jump with a longer flight and a longer arc of coins', () => {
  const race = R.createRace('snow'), player = R.playerOf(race), track = race.track;
  assert.equal(track.mega, track.ramps[1]);
  for (let i = 0; i < 181; i++) R.stepRace(race, 0, 1 / 60);
  race.cars.slice(1).forEach(c => { c.d = track.mega + 400; });
  player.d = track.mega - .2; player.lat = 0; player.speed = R.CRUISE;
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('megajump'));
  assert.equal(player.airTime, R.MEGA_AIR);
  let frames = 0, coins = 0;
  while (player.air > 0 && frames++ < 400) coins += R.stepRace(race, 0, 1 / 60).filter(e => e === 'coin').length;
  assert.ok(Math.abs(frames / 60 - R.MEGA_AIR) < .05);
  assert.equal(coins, 9, 'every coin of the arc is caught in the air');
});

test('a boss race is one-on-one against the track’s boss, who stays close and can be beaten', () => {
  for (const { id } of R.TRACKS) {
    const race = R.createRace(id, { boss: true });
    assert.equal(race.boss, true);
    assert.deepEqual(race.cars.map(c => c.id), ['viaan', R.BOSSES[id].id]);
    assert.ok(race.cars[1].boss && R.playerOf(race).nitro > 0);
  }
  assert.equal(R.bossBand(0), 1);
  assert.ok(R.bossBand(200) > .55 && R.bossBand(200) < .7 && R.bossBand(-200) > 1 && R.bossBand(-200) <= 1.06);
  // Driving cleanly and using every nitro burst wins; never steering loses but still finishes.
  const win = R.createRace('beach', { boss: true }); let steps = 0, tap = false;
  while (win.phase !== 'finished' && steps++ < 60 * 400) { tap = !tap; R.stepRace(win, { steer: careful(win), gas: true, nitro: tap }, 1 / 60); }
  assert.equal(R.placeOf(win), 1);
  const lose = drive('beach', 0); assert.equal(lose.phase, 'finished');
  const idle = R.createRace('beach', { boss: true }); steps = 0;
  while (idle.phase !== 'finished' && steps++ < 60 * 400) R.stepRace(idle, 0, 1 / 60);
  assert.equal(idle.phase, 'finished');
  assert.equal(R.placeOf(idle), 2);
});

test('cups unlock vehicles and beating a boss crowns the track', () => {
  let prefs = R.normalizePrefs({ car: 'truck' });
  assert.equal(prefs.car, 'supercar', 'the truck needs a cup');
  assert.equal(R.carUnlocked(prefs, R.CARS[1]), false);
  prefs = R.award(prefs, 'beach', 4, 0);
  assert.equal(R.carUnlocked(prefs, R.CARS[1]), true);
  assert.equal(R.normalizePrefs({ ...prefs, car: 'truck' }).car, 'truck');
  assert.equal(R.normalizePrefs({ ...prefs, car: 'sports' }).car, 'supercar', 'the sports car needs two cups');
  assert.equal(R.normalizePrefs({ ...prefs, car: 'formula' }).car, 'supercar');
  prefs = R.award(prefs, 'snow', 2, 0);
  assert.equal(R.normalizePrefs({ ...prefs, car: 'sports' }).car, 'sports');
  assert.equal(R.normalizePrefs({ ...prefs, car: 'formula' }).car, 'supercar');
  prefs = R.award(prefs, 'jungle', 3, 0);
  assert.equal(R.normalizePrefs({ ...prefs, car: 'formula' }).car, 'formula');
  assert.deepEqual(R.CARS.map(c => c.id), ['supercar', 'truck', 'sports', 'formula']);
  assert.equal(R.award(prefs, 'beach', 2, 0, true).cups.beach, 1, 'losing to the boss changes nothing');
  prefs = R.award(prefs, 'beach', 1, 0, true);
  assert.equal(prefs.cups.beach, 3);
  assert.equal(R.award(prefs, 'beach', 1, 0).cups.beach, 3, 'a crown is never lost');
  assert.equal(R.normalizePrefs({ cups: { beach: 3, snow: 4 } }).cups.snow, undefined);
});

test('passing a friend is announced with their name, but not off the start line', () => {
  const events = [];
  const race = drive('beach', careful, 60, (e, r) => { if (e === 'pass') events.push([r.time, r.passed]); });
  assert.ok(events.length >= 1 && events.length <= 12, `${events.length} passes`);
  for (const [time, name] of events) { assert.ok(time > 4); assert.ok(['Biscuit', 'Pepper', 'Waffle'].includes(name)); }
  for (let i = 1; i < events.length; i++) assert.ok(events[i][0] - events[i - 1][0] > 2.5);
});

test('every vehicle model, the portraits and the page wiring are all present', () => {
  for (const { id } of R.CARS) {
    const glb = readFileSync(here(`./assets/${id}.glb`));
    assert.equal(glb.toString('latin1', 0, 4), 'glTF', id);
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
    const nodes = json.nodes.map(n => n.name), materials = json.materials.map(m => m.name);
    for (const wheel of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) assert.ok(nodes.includes(wheel), `${id} ${wheel}`);
    assert.ok(materials.includes('Paint'), `the game repaints the Paint material of the ${id}`);
    assert.ok(existsSync(here(`./assets/${id}.blend`)), id);
    assert.ok(existsSync(here(`./assets/${id}.png`)), id);
    assert.match(readFileSync(here('./game.js'), 'utf8'), new RegExp(`\\n  ${id}: \\{ flame:`), `${id} needs its SPECS`);
  }
  // Every rival and boss is a cartoon dog with a full look.
  for (const id of [...R.RIVALS.map(r => r.id), ...R.TRACKS.map(t => R.BOSSES[t.id].id)]) {
    const look = R.DOGS[id]; assert.ok(look, id);
    for (const key of ['fur', 'muzzle', 'ear', 'collar']) assert.match(look[key], /^#[0-9a-f]{6}$/, `${id} ${key}`);
    assert.ok(['floppy', 'pointy'].includes(look.ears), id);
  }
  assert.ok(existsSync(here('./dogs.js')));
  for (const vendor of ['three.module.js', 'three.core.js', 'GLTFLoader.js', 'BufferGeometryUtils.js']) assert.ok(existsSync(here(`../sky-playground/vendor/${vendor}`)));
  const html = readFileSync(here('./index.html'), 'utf8'), game = readFileSync(here('./game.js'), 'utf8');
  for (const id of game.matchAll(/\$\('([A-Za-z]+)'\)/g)) assert.ok(html.includes(`id="${id[1]}"`), `missing #${id[1]}`);
  assert.match(html, /href="\.\.\/index\.html"/);
  assert.match(readFileSync(here('../index.html'), 'utf8'), /href="little-racer\/"/);
});

test('zoom strips sit on clear road and give a short boost each time they are crossed', () => {
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id), pads = R.padsFor(track);
    assert.ok(pads.length >= 4 && pads.length <= 9, `${id} has ${pads.length} strips`);
    for (const pad of pads) {
      assert.ok(Math.abs(pad.lat) < R.HALF_ROAD - 2.7, 'the whole strip is on the road');
      assert.equal(R.loopPhase(track, pad.s), -1);
      for (const ramp of track.ramps) assert.ok(pad.s < ramp - 8 || pad.s > ramp + 40, 'not on a ramp or under a jump');
    }
  }
  const race = R.createRace('beach'), player = R.playerOf(race), pad = race.pads[1];
  race.phase = 'racing'; player.d = pad.s - 6; player.lat = pad.lat; player.speed = R.CRUISE;
  const events = [];
  for (let i = 0; i < 40; i++) events.push(...R.stepRace(race, { steer: 0, gas: true }, 1 / 60));
  assert.equal(events.filter(e => e === 'pad').length, 1, 'one whoosh per crossing');
  assert.ok(player.boost > 0 && player.boost <= R.PAD_SECONDS);
  // Driving past in another lane does nothing.
  const wide = R.createRace('beach'), other = R.playerOf(wide);
  wide.phase = 'racing'; other.d = wide.pads[1].s - 6; other.lat = wide.pads[1].lat > 0 ? -5 : 5; other.speed = R.CRUISE;
  let touched = 0;
  for (let i = 0; i < 40; i++) touched += R.stepRace(wide, { steer: other.lat > 0 ? 1 : -1, gas: true }, 1 / 60).filter(e => e === 'pad').length;
  assert.equal(touched, 0);
});

const onTrack = id => { const race = R.createRace(id); race.phase = 'racing'; race.cars.slice(1).forEach(c => { c.d = -400; }); return race; };
const run = (race, input, frames) => { const events = []; for (let i = 0; i < frames; i++) events.push(...R.stepRace(race, input, 1 / 60)); return events; };

test('every track has rows of things to knock over and bouncers, on clear road', () => {
  assert.deepEqual(R.TRACKS.map(t => t.toy), ['ball', 'snowman', 'barrel', 'bubble']);
  for (const { id } of R.TRACKS) {
    const track = R.getTrack(id), props = R.propsFor(track), bouncers = R.bouncersFor(track), stars = R.starsFor(track), pads = R.padsFor(track);
    assert.ok(props.length / 9 >= 3 && props.length / 9 <= 7, `${id} has ${props.length / 9} rows`);
    assert.ok(bouncers.length >= 2 && bouncers.length <= 5, `${id} has ${bouncers.length} bouncers`);
    for (const thing of [...props, ...bouncers]) {
      assert.ok(Math.abs(thing.lat) <= R.HALF_ROAD - 1.5, 'on the road');
      assert.equal(R.loopPhase(track, thing.s), -1);
      for (const ramp of track.ramps) assert.ok(thing.s < ramp - 8 || thing.s > ramp + 40, 'not on a ramp or under a jump');
      assert.ok(thing.s < track.tunnel.s - 4 || thing.s > track.tunnel.s + track.tunnel.length, 'not inside the tunnel');
      for (const star of stars) assert.ok(Math.abs(star.s - thing.s) > 8, 'clear of the stars');
      for (const pad of pads) assert.ok(Math.abs(pad.s - thing.s) > 9, 'clear of the zoom strips');
    }
    // A car anywhere across the road always hits at least one thing in a row.
    for (let lat = -R.HALF_ROAD; lat <= R.HALF_ROAD; lat += .25) assert.ok(props.slice(0, 9).some(prop => Math.abs(prop.lat - lat) <= 1.7), `${id} gap at ${lat}`);
  }
});

test('driving into a row knocks things over for a coin each, and they stand up again', () => {
  const race = onTrack('beach'), player = R.playerOf(race), row = race.props.slice(0, 9);
  player.d = row[0].s - 4; player.lat = 0; player.speed = R.CRUISE; player.nitro = 0;
  const events = run(race, 0, 30), hits = events.filter(e => e === 'smash').length;
  assert.ok(hits >= 1 && hits <= 4, `${hits} knocked over`);
  assert.equal(race.smashed, hits); assert.equal(race.collected, hits);
  assert.ok(player.nitro > 0, 'each one adds a little nitro');
  assert.ok(player.speed > R.CRUISE - 1, 'nothing slows the car');
  const down = row.filter(prop => race.time - prop.down < R.SMASH_BACK);
  assert.equal(down.length, hits);
  for (const prop of down) assert.ok(Math.abs(prop.lat) <= 1.7 && Math.abs(prop.dir) === 1);
  // Driving back over the same spot at once finds nothing to hit; a few seconds later they are back.
  player.d = row[0].s - 4;
  assert.equal(run(race, 0, 30).filter(e => e === 'smash').length, 0);
  run(race, { steer: 0, gas: true, brake: true }, Math.ceil(R.SMASH_BACK * 60));
  player.d = row[0].s - 4; player.lat = 0; player.speed = R.CRUISE;
  assert.equal(run(race, 0, 30).filter(e => e === 'smash').length, hits);
  // A friend knocks things over too, but only Viaan's count; a flying car sails over them.
  const other = onTrack('beach'), rival = other.cars[1], second = other.props.slice(0, 9);
  rival.d = second[0].s - 2; rival.speed = R.CRUISE;
  assert.equal(run(other, { steer: 0, gas: true, brake: true }, 30).filter(e => e === 'smash').length, 0);
  assert.ok(second.some(prop => prop.down > 0)); assert.equal(other.smashed, 0); assert.equal(other.collected, 0);
  const high = onTrack('beach'), flyer = R.playerOf(high);
  flyer.d = high.props[0].s - 4; flyer.lat = 0; flyer.speed = R.CRUISE; flyer.air = flyer.airTime = .9;
  assert.equal(run(high, 0, 30).filter(e => e === 'smash').length, 0);
});

test('a bouncer hops any moving car over three coins and lands it safely', () => {
  for (const id of ['beach', 'galaxy']) {
    const race = onTrack(id), player = R.playerOf(race), bouncer = race.bouncers[0], float = race.track.float;
    assert.equal(float, id === 'galaxy' ? 1.25 : 1);
    assert.equal(race.coins.filter(c => c.hop === bouncer.s).length, 3);
    player.d = bouncer.s - 3; player.lat = bouncer.lat; player.speed = R.CRUISE;
    const events = []; let frames = 0;
    while (!events.includes('land') && frames++ < 300) events.push(...R.stepRace(race, 0, 1 / 60));
    assert.equal(events.filter(e => e === 'bounce').length, 1, id);
    assert.equal(player.leap, 'hop'); assert.ok(Math.abs(player.airTime - R.HOP_SECONDS * float) < 1e-9);
    assert.equal(race.coins.filter(c => c.hop === bouncer.s && c.taken).length, 3, `${id}: all three coins are caught`);
    assert.equal(player.air, 0); assert.ok(player.speed > R.CRUISE - 1);
    // Another lane, or a crawl, rolls past without a hop.
    const miss = onTrack(id), slow = R.playerOf(miss);
    slow.d = bouncer.s - 3; slow.lat = bouncer.lat + (bouncer.lat > 0 ? -4 : 4); slow.speed = R.CRUISE;
    assert.equal(run(miss, 0, 30).includes('bounce'), false);
    slow.d = bouncer.s - 1; slow.lat = bouncer.lat; slow.speed = 5;
    assert.equal(R.stepRace(miss, { steer: 0, gas: false }, 1 / 60).includes('bounce'), false);
  }
  // Friends hop too.
  const race = onTrack('snow'), rival = race.cars[1], bouncer = race.bouncers[0];
  rival.d = bouncer.s - 2; rival.lat = bouncer.lat; rival.lane = bouncer.lat; rival.wobble = 0; rival.speed = R.CRUISE;
  run(race, { steer: 0, gas: true, brake: true }, 12);
  assert.ok(rival.air > 0 && rival.leap === 'hop');
});

test('steering in the air spins the car once and landing it gives a boost', () => {
  const launch = () => { const race = onTrack('beach'), player = R.playerOf(race); player.d = race.track.ramps[0] - .2; player.lat = 0; player.speed = R.CRUISE; player.nitro = 0; return [race, player]; };
  const [race, player] = launch(), events = [];
  let frames = 0;
  while (!events.includes('land') && frames++ < 300) events.push(...R.stepRace(race, { steer: 1, gas: true }, 1 / 60));
  assert.equal(events.filter(e => e === 'spin').length, 1, 'one spin per flight');
  assert.ok(events.indexOf('spin') > events.indexOf('jump') && events.indexOf('landed') > events.indexOf('spin'));
  assert.equal(race.tricks, 1);
  assert.ok(player.boost > R.SPIN_BOOST - .1 && player.nitro > .1);
  assert.equal(player.trick, 0);
  // A straight flight is just a flight.
  const [plain, straight] = launch(), quiet = [];
  frames = 0;
  while (!quiet.includes('land') && frames++ < 300) quiet.push(...R.stepRace(plain, { steer: 0, gas: true }, 1 / 60));
  assert.equal(quiet.includes('spin') || quiet.includes('landed'), false);
  assert.equal(plain.tricks, 0); assert.equal(straight.boost, 0);
  // Steering on the ground never spins.
  const ground = onTrack('beach');
  R.playerOf(ground).d = 20; R.playerOf(ground).speed = R.CRUISE;
  assert.equal(run(ground, { steer: 1, gas: true }, 40).includes('spin'), false);
});

test('the last lap counts every coin and knock-over double', () => {
  const race = onTrack('beach'), player = R.playerOf(race), length = race.track.length;
  const row = race.coins.filter(c => !c.air && !c.loop).slice(0, 5);
  player.d = row[0].s - 3; player.lat = row[0].lat; player.speed = R.CRUISE;
  assert.equal(run(race, 0, 60).filter(e => e === 'coin').length, 5);
  assert.equal(race.collected, 5);
  player.d = length * (R.LAPS - 1) - .2; player.lat = 6.5;
  assert.ok(R.stepRace(race, 0, 1 / 20).includes('lastlap'));
  const before = race.collected;
  player.d = length * (R.LAPS - 1) + row[0].s - 3; player.lat = row[0].lat;
  assert.equal(run(race, 0, 60).filter(e => e === 'coin').length, 5);
  assert.equal(race.collected - before, 10);
  const prop = race.props[2], had = race.collected;
  player.d = length * (R.LAPS - 1) + prop.s - 3; player.lat = prop.lat;
  const hits = run(race, 0, 20).filter(e => e === 'smash').length;
  assert.ok(hits >= 1); assert.equal(race.collected - had, hits * 2);
});

test('the galaxy has low gravity and friends show flames when they hurry', () => {
  const race = onTrack('galaxy'), player = R.playerOf(race), track = race.track;
  player.d = track.ramps[0] - .2; player.lat = 0; player.speed = R.CRUISE;
  assert.ok(R.stepRace(race, 0, 1 / 60).includes('jump'));
  assert.ok(Math.abs(player.airTime - R.AIR_SECONDS * 1.25) < 1e-9);
  let coins = 0, frames = 0;
  while (player.air > 0 && frames++ < 400) coins += R.stepRace(race, 0, 1 / 60).filter(e => e === 'coin').length;
  assert.equal(coins, 5, 'the stretched arc of coins is still all caught');
  // Friends far behind light their flames; friends ahead do not.
  const rival = race.cars[1];
  assert.ok(rival.boost > 0, 'a friend far behind is hurrying');
  rival.d = player.d + 30; run(race, 0, 40);
  assert.equal(rival.boost, 0);
});
