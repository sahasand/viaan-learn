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
  assert.equal(R.TRACKS.length, 3);
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
  assert.deepEqual(race.cars.map(c => c.id), ['viaan', 'panda', 'penguin', 'frog']);
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
    assert.ok(times[1] > 70 && times[1] < 120, `${id} took ${times[1]}s`);
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
  const fallback = { paint: R.PAINTS[0].id, track: R.TRACKS[0].id };
  for (const bad of [null, undefined, '', 'nonsense', '[]', '{"paint":7}', 42, '{"paint":"mud","track":"moon"}']) assert.deepEqual(R.normalizePrefs(bad), fallback);
  assert.deepEqual(R.normalizePrefs('{"paint":"grape","track":"snow","extra":1}'), { paint: 'grape', track: 'snow' });
  assert.deepEqual(R.normalizePrefs({ paint: 'ocean', track: 'moon' }), { paint: 'ocean', track: 'beach' });
  assert.equal(new Set(R.PAINTS.map(p => p.id)).size, 6);
});

test('the supercar model, portraits and page wiring are all present', () => {
  const glb = readFileSync(here('./assets/supercar.glb'));
  assert.equal(glb.toString('latin1', 0, 4), 'glTF');
  const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  const nodes = json.nodes.map(n => n.name), materials = json.materials.map(m => m.name);
  for (const wheel of ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']) assert.ok(nodes.includes(wheel), wheel);
  assert.ok(materials.includes('Paint'), 'the game repaints the Paint material');
  assert.ok(existsSync(here('./assets/supercar.blend')));
  assert.ok(existsSync(here('./assets/supercar.png')));
  for (const rival of R.RIVALS) assert.ok(existsSync(here(`../memory-assets/${rival.id}.png`)), rival.id);
  for (const vendor of ['three.module.js', 'three.core.js', 'GLTFLoader.js', 'BufferGeometryUtils.js']) assert.ok(existsSync(here(`../sky-playground/vendor/${vendor}`)));
  const html = readFileSync(here('./index.html'), 'utf8'), game = readFileSync(here('./game.js'), 'utf8');
  for (const id of game.matchAll(/\$\('([A-Za-z]+)'\)/g)) assert.ok(html.includes(`id="${id[1]}"`), `missing #${id[1]}`);
  assert.match(html, /href="\.\.\/index\.html"/);
  assert.match(readFileSync(here('../index.html'), 'utf8'), /href="little-racer\/"/);
});
