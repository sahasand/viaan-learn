import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialFlight, stepFlight, touchesTarget, groundHeight, guidance, angleDelta, TRAIL, PICNIC, RUNWAY, AIRPORT_APPROACH, runwayLanding, runwayTakeoff } from './flight.js';

const obstacles = JSON.parse(readFileSync(new URL('./assets/obstacles.json', import.meta.url)));
test('airport approach lines up facing north from different parts of the island', () => {
  for (const start of [initialFlight(), { ...initialFlight(), x:-60, z:11, y:10, heading:-4.3 }, { ...initialFlight(), x:110, z:-80, heading:2 }]) {
    let s=start, leg=0, aligned=false;
    for (let i=0;i<60*150;i++) {
      const prev=s; s=stepFlight(s,{x:0,y:0},1/60,AIRPORT_APPROACH[leg],obstacles);
      if(touchesTarget(prev,s,AIRPORT_APPROACH[leg],4.5)) {
        if(leg===0) leg=1;
        else if(Math.abs(angleDelta(0,s.heading))<.45) { aligned=true; break; }
        else leg=0;
      }
    }
    assert.ok(aligned,`approach from ${start.x}, ${start.z}`);
    assert.ok(s.z>75 && s.z<90 && Math.abs(s.x-RUNWAY.x)<4.5);
  }
});
test('landing touches down inside the strip and decelerates to a complete stop', () => {
  const start={...initialFlight(),x:23,y:12,z:86,heading:.12};
  let prev=start;
  for(let i=0;i<=660;i++) {
    const s=runwayLanding(start,i/60);
    assert.ok(s.z<=prev.z+1e-8 && s.y>=RUNWAY.parkedY-1e-8);
    if(i>=300) {assert.equal(s.y,RUNWAY.parkedY);assert.equal(s.x,RUNWAY.x);assert.ok(s.z>=16 && s.z<=60);}
    if(i>300) assert.ok(s.speed<=prev.speed+1e-8);
    prev=s;
  }
  assert.equal(prev.z,RUNWAY.stopZ);assert.equal(prev.speed,0);assert.equal(prev.finished,true);
});
test('takeoff stays on runway centerline, rolls first, then climbs', () => {
  const parked=runwayLanding({...initialFlight(),z:86,y:12},11);
  assert.equal(runwayTakeoff(parked,0).y,RUNWAY.parkedY);
  assert.equal(runwayTakeoff(parked,2).y,RUNWAY.parkedY);
  const lift=runwayTakeoff(parked,3), airborne=runwayTakeoff(parked,7);
  assert.equal(lift.x,RUNWAY.x);assert.ok(lift.y>RUNWAY.parkedY && lift.z>16);
  assert.equal(airborne.heading,0);assert.ok(airborne.z<16 && airborne.y>15);assert.equal(airborne.finished,true);
});
test('right input turns right, up input climbs, and releasing levels the wings', () => {
  let s = initialFlight();
  for (let i = 0; i < 60; i++) s = stepFlight(s, { x: 1, y: 1 }, 1 / 60);
  assert.ok(s.x > 22 && s.heading > 0 && s.y > 14);
  for (let i = 0; i < 180; i++) s = stepFlight(s, { x: 0, y: 0 }, 1 / 60);
  assert.ok(Math.abs(s.turn) < .001 && Math.abs(s.climb) < .001);
});
test('continuous down input cannot go under terrain or through mapped obstacles', () => {
  for (const heading of [0, 1, 2, 3, 4, 5]) {
    let s = { ...initialFlight(), heading };
    for (let i = 0; i < 3000; i++) {
      s = stepFlight(s, { x: 0, y: -1 }, 1 / 60, null, obstacles);
      assert.ok(s.y >= groundHeight(s.x, s.z) + 5.2 - 1e-8);
      for (const o of obstacles) if (Math.hypot(s.x - o.x, s.z - o.z) < o.radius + 2.8) assert.ok(s.y >= o.top + 2 - 1e-8);
    }
  }
});
test('island boundary returns a departing plane without getting stuck turning', () => {
  let s = { ...initialFlight(), x: 170, z: 0, heading: Math.PI / 2 };
  let returned = false, farthest = 0;
  for (let i = 0; i < 3600; i++) {
    s = stepFlight(s, { x: 0, y: 0 }, 1 / 60);
    farthest = Math.max(farthest, Math.hypot(s.x, s.z));
    if (Math.hypot(s.x, s.z) < 120) { returned = true; break; }
  }
  assert.ok(returned); assert.ok(farthest < 200);
});
test('helping-wing route reaches all five rings and the delivery with real obstacle data', () => {
  for (const hz of [20, 30, 60, 120]) {
    let s = initialFlight(), reached = 0;
    const route = [...TRAIL, PICNIC];
    for (let i = 0; i < hz * 90 && reached < route.length; i++) {
      const target = route[reached], previous = s;
      s = stepFlight(s, { x: 0, y: 0 }, 1 / hz, target, obstacles);
      if (touchesTarget(previous, s, target, reached === 5 ? 9 : 5.8)) reached++;
    }
    assert.equal(reached, 6, `route completes at ${hz} Hz`);
  }
});
test('guidance can recover a ring after the child flies past it', () => {
  let s = { ...initialFlight(), z: -30 }, reached = false;
  for (let i = 0; i < 60 * 80; i++) {
    const previous = s; s = stepFlight(s, { x: 0, y: 0 }, 1 / 60, TRAIL[0], obstacles);
    if (touchesTarget(previous, s, TRAIL[0])) { reached = true; break; }
  }
  assert.ok(reached);
});
test('large frame gaps are capped and flight does not mutate the previous state', () => {
  const start = initialFlight(), snapshot = { ...start };
  const after = stepFlight(start, { x: 1, y: 1 }, 20);
  assert.deepEqual(start, snapshot);
  assert.ok(Math.hypot(after.x - start.x, after.z - start.z) <= .51);
  assert.deepEqual(stepFlight(start, { x: 1, y: 1 }, -1), start);
});
test('segment collection catches crossed targets but rejects distant flybys', () => {
  const a = { x: 0, y: 10, z: 20 }, b = { x: 0, y: 10, z: -20 };
  assert.equal(touchesTarget(a, b, { x: 0, y: 10, z: 0 }), true);
  assert.equal(touchesTarget(a, b, { x: 10, y: 10, z: 0 }), false);
  assert.ok(Number.isFinite(guidance({ ...a, heading: 0 }, a).x));
});
test('Blender exports contain a real mesh scene and named propeller', () => {
  for (const filename of ['toy-plane.glb', 'sunny-island.glb']) {
    const buffer = readFileSync(new URL(`./assets/${filename}`, import.meta.url));
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
    assert.equal(buffer.readUInt32LE(4), 2);
    const size = buffer.readUInt32LE(12), gltf = JSON.parse(buffer.toString('utf8', 20, 20 + size));
    assert.ok(gltf.meshes.length > 5 && gltf.scenes.length);
    if (filename === 'toy-plane.glb') assert.ok(gltf.nodes.some(n => n.name === 'Propeller'));
  }
});
