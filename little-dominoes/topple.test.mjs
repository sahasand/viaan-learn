import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SIZE, SPACING, AREA, LIMIT, TOYS, RUNS, PALETTES, createTable, place, startStroke, trace, push, step, standUp, undo, clear, runSpecs, snapshot, restore, normalizeSave } from './topple.js';

const here = name => fileURLToPath(new URL(name, import.meta.url));

// Draw one finger stroke through the given points.
function draw(table, ...points) {
  const stroke = startStroke(table, ...points[0]);
  const made = [];
  for (const [x, z] of points.slice(1)) made.push(...trace(table, stroke, x, z));
  return made;
}
// Tap a domino and run until everything has come to rest.
function topple(table, d) {
  const events = [];
  assert.equal(push(table, d, events), true);
  for (let i = 0; i < 240 * 90 && !events.some(e => e.type === 'done'); i++) step(table, 1 / 240, events);
  assert.ok(events.some(e => e.type === 'done'), 'the fall comes to rest');
  return events;
}
const standing = table => table.dominoes.filter(d => !d.dir).length;
const lay = id => { const table = createTable(); for (const s of runSpecs(id)) place(table, s.x, s.z, s.yaw, 1); return table; };

test('nothing moves until a domino is tapped', () => {
  const table = createTable();
  draw(table, [-6, 0], [6, 0]);
  const events = [];
  for (let i = 0; i < 480; i++) step(table, 1 / 240, events);
  assert.equal(events.length, 0);
  assert.ok(table.dominoes.every(d => d.angle === 0 && d.dir === 0));
});

test('a drawn line falls from end to end at a pace a child can follow', () => {
  const table = createTable();
  const made = draw(table, [-9, 2], [9, 2]);
  assert.equal(made.length, 26);
  const events = topple(table, made[0]);
  assert.equal(table.down, 26);
  assert.equal(events.filter(e => e.type === 'click').length, 25);
  const pace = 25 / made[25].started;
  assert.ok(pace > 7 && pace < 13, `pace ${pace.toFixed(1)} per second`);
  assert.ok(made.slice(0, 25).every(d => d.angle > 1.1 && d.angle < Math.PI / 2), 'each leans on the next');
  assert.ok(Math.abs(made[25].angle - Math.PI / 2) < 1e-6, 'the last lies flat');
  assert.deepEqual(events.filter(e => e.type === 'flat').map(e => e.d), [made[25]]);
  assert.deepEqual(events.at(-1), { type: 'done', down: 26, standing: 0 });
});

test('a gap taller than a domino stops the fall, and filling it lets the rest go', () => {
  const table = createTable();
  const left = draw(table, [-8, 0], [-2, 0]), right = draw(table, [.5, 0], [6, 0]);
  assert.ok(right[0].x - left.at(-1).x > SIZE.h + SIZE.t);
  topple(table, left[0]);
  assert.equal(table.down, left.length);
  assert.equal(standing(table), right.length);
  standUp(table, true);
  const filled = draw(table, [left.at(-1).x, 0], [right[0].x, 0]);
  assert.ok(filled.length >= 1, 'drawing over the gap only fills the gap');
  topple(table, left[0]);
  assert.equal(standing(table), 0);
});

test('a tap sends the fall towards dominoes that are still standing', () => {
  const table = createTable();
  const made = draw(table, [-5, 0], [5, 0]);
  topple(table, made.at(-1));
  assert.equal(made.at(-1).dir, -1, 'the last domino falls back along the line');
  assert.equal(standing(table), 0);

  standUp(table, true);
  const middle = made[7];
  topple(table, middle);
  assert.equal(middle.dir, 1);
  assert.equal(standing(table), 7, 'only the dominoes in front fall');
  topple(table, made[6]);
  assert.equal(made[6].dir, -1, 'the next tap runs the other way');
  assert.equal(standing(table), 0);
  assert.equal(push(table, made[0]), false, 'a fallen domino cannot be pushed');
});

test('curves, sharp corners and scribbles keep knocking on', () => {
  const circle = createTable(), ring = [];
  for (let a = 0; a <= Math.PI * 1.8; a += .05) ring.push([Math.cos(a) * 3, Math.sin(a) * 3]);
  const curved = draw(circle, ...ring);
  topple(circle, curved[0]);
  assert.equal(standing(circle), 0);

  const corner = createTable();
  const bent = draw(corner, [-6, -3], [0, -3], [0, 4], [5, 4], [2, 0]);
  topple(corner, bent[0]);
  assert.equal(standing(corner), 0);
});

test('a branch drawn off the side of a line falls too', () => {
  const table = createTable();
  const trunk = draw(table, [-8, 0], [8, 0]);
  const branch = draw(table, [0, .3], [0, 6]);
  assert.ok(branch.length >= 6);
  topple(table, trunk[0]);
  assert.equal(standing(table), 0);
  assert.ok(branch.every(d => d.dir === 1), 'the branch falls away from the trunk');
});

test('two falls meeting head on come to rest', () => {
  const table = createTable();
  const made = draw(table, [-6, 0], [6, 0]);
  const events = [];
  push(table, made[0], events); push(table, made.at(-1), events);
  for (let i = 0; i < 240 * 30 && !events.some(e => e.type === 'done'); i++) step(table, 1 / 240, events);
  assert.ok(events.some(e => e.type === 'done'));
  assert.equal(standing(table), 0);
});

test('drawing keeps dominoes apart, on the mat, off the toys and under the limit', () => {
  const table = createTable();
  for (let i = 0; i < 40; i++) draw(table, [-12, -8 + i * .4], [12, -8 + i * .43], [-12, 8 - i * .4]);
  for (const toy of TOYS) draw(table, [toy.x - 5, toy.z - 1], [toy.x + 3, toy.z + 1]);
  assert.ok(table.dominoes.length > 200 && table.dominoes.length <= LIMIT);
  for (const d of table.dominoes) {
    assert.ok(Math.abs(d.x) <= AREA.x && Math.abs(d.z) <= AREA.z);
    for (const toy of TOYS) assert.ok(Math.hypot(d.x - toy.x, d.z - toy.z) >= toy.r + .5 - 1e-9);
  }
  for (let i = 0; i < table.dominoes.length; i++) for (let j = i + 1; j < table.dominoes.length; j++) {
    assert.ok(Math.hypot(table.dominoes[i].x - table.dominoes[j].x, table.dominoes[i].z - table.dominoes[j].z) >= .5 - 1e-9);
  }
  const full = createTable();
  for (let i = 0; i < 60; i++) draw(full, [-9.5, -6.5 + i * .22], [9.5, -6.5 + i * .22]);
  assert.ok(full.dominoes.length <= LIMIT);
  while (full.dominoes.length < LIMIT) full.dominoes.push({ ...full.dominoes[0] });
  assert.equal(place(full, 0, 0, 0), null);
  assert.equal(place(createTable(), NaN, 0, 0), null);
});

test('a line drawn up to a toy sets it off once', () => {
  for (const toy of TOYS) {
    const table = createTable();
    const made = draw(table, [toy.x - 6, toy.z + .3], [toy.x + 1, toy.z + .3]);
    const events = topple(table, made[0]);
    assert.deepEqual(events.filter(e => e.type === 'toy').map(e => e.toy.kind), [toy.kind]);
    assert.ok(made.at(-1).angle < 1.3, 'the last domino leans on the toy');
  }
});

test('a toy goes off again for a new fall, without standing anything up', () => {
  const table = createTable(), bell = TOYS[0];
  const first = draw(table, [bell.x - 5, bell.z], [bell.x, bell.z]);
  const second = draw(table, [bell.x, bell.z + 5], [bell.x, bell.z]);
  assert.equal(topple(table, first[0]).filter(e => e.type === 'toy').length, 1);
  assert.equal(topple(table, second[0]).filter(e => e.type === 'toy').length, 1);
});

test('every ready-made run fits the mat, falls completely and sets off its toys', () => {
  assert.deepEqual(RUNS.map(r => r.id), ['snake', 'swirl', 'tree']);
  for (const run of RUNS) {
    const specs = runSpecs(run.id), table = lay(run.id);
    assert.ok(specs.length >= 60 && specs.length <= 140, `${run.id} has ${specs.length} dominoes`);
    assert.equal(table.dominoes.length, specs.length, `${run.id} places every domino`);
    const events = topple(table, table.dominoes[0]);
    assert.equal(standing(table), 0, `${run.id} falls completely`);
    assert.deepEqual(events.filter(e => e.type === 'toy').map(e => e.toy.kind).sort(), [...run.toys].sort(), `${run.id} toys`);
    const seconds = table.dominoes.reduce((most, d) => Math.max(most, d.started), 0);
    assert.ok(seconds > 2 && seconds < 14, `${run.id} takes ${seconds.toFixed(1)} s`);
  }
  assert.deepEqual(runSpecs('nope'), []);
});

test('standing up rewinds the fall and the same tap gives the same fall again', () => {
  const table = lay('tree');
  const first = topple(table, table.dominoes[0]).filter(e => e.type === 'click').length;
  const angles = table.dominoes.map(d => d.angle);
  const events = [];
  assert.equal(standUp(table), true);
  assert.equal(push(table, table.dominoes[0]), false, 'no pushing while they stand up');
  step(table, .2, events);
  assert.ok(table.dominoes.some((d, i) => d.angle < angles[i]) && table.dominoes.some(d => d.angle > 0), 'they rise in a ripple');
  for (let i = 0; i < 600 && !events.some(e => e.type === 'stood'); i++) step(table, 1 / 60, events);
  assert.ok(events.some(e => e.type === 'stood'));
  assert.ok(table.dominoes.every(d => d.angle === 0 && d.dir === 0));
  assert.ok(table.toys.every(toy => !toy.fired));
  assert.equal(table.down, 0);
  assert.equal(standUp(table), false, 'nothing to stand up');
  assert.equal(topple(table, table.dominoes[0]).filter(e => e.type === 'click').length, first);
  table.dominoes.forEach((d, i) => assert.ok(Math.abs(d.angle - angles[i]) < 1e-9));
});

test('undo takes away the last line and clear empties the mat', () => {
  const table = createTable();
  const a = draw(table, [-6, -3], [6, -3]), b = draw(table, [-6, 3], [6, 3]);
  topple(table, a[0]);
  assert.equal(undo(table), b.length);
  assert.deepEqual(table.dominoes, a);
  assert.ok(a.every(d => d.dir === 0 && d.angle === 0), 'the rest stand up again');
  assert.equal(undo(table), a.length);
  assert.equal(undo(table), 0);
  draw(table, [-6, 0], [6, 0]);
  clear(table);
  assert.equal(table.dominoes.length, 0);
  assert.equal(table.down, 0);
});

test('saved mats are validated and restored', () => {
  const table = lay('snake');
  draw(table, [-9, 6.3], [9, 6.3]);
  const saved = normalizeSave(JSON.stringify({ sound: true, met: true, palette: 2, toppled: 41.7, dominoes: snapshot(table) }));
  assert.equal(saved.sound, true); assert.equal(saved.met, true); assert.equal(saved.palette, 2); assert.equal(saved.toppled, 41);
  const again = restore(createTable(), saved.dominoes);
  assert.equal(again.dominoes.length, table.dominoes.length);
  assert.equal(again.strokes, table.strokes);
  topple(table, table.dominoes[0]); topple(again, again.dominoes[0]);
  assert.ok(again.down >= 104, 'a restored run still falls');
  assert.equal(again.down, table.down, 'and falls the same way');

  for (const junk of [null, undefined, 'not json', '[]', 7, { dominoes: 'x' }]) {
    assert.deepEqual(normalizeSave(junk), { sound: false, met: false, palette: 0, toppled: 0, dominoes: [] });
  }
  const mixed = normalizeSave({ sound: 'yes', palette: 99, toppled: -5, dominoes: [[0, 0, 0, 3, 2], [99, 0, 0], [1, 1, NaN], 'x', [2, 2, 1, 44, -1], [3, 3]] });
  assert.deepEqual(mixed, { sound: false, met: false, palette: 0, toppled: 0, dominoes: [[0, 0, 0, 3, 2], [2, 2, 1, 1, 0]] });
  assert.equal(normalizeSave({ dominoes: Array.from({ length: LIMIT + 50 }, () => [0, 0, 0]) }).dominoes.length, LIMIT);
  assert.equal(restore(createTable(), [[0, 0, 0, 1, 1], [0, 0, 0, 1, 1]]).dominoes.length, 1, 'overlapping saved dominoes are dropped');
});

test('the game ships its files and is linked from home', () => {
  for (const file of ['index.html', 'style.css', 'game.js', 'audio.js', 'icon.svg', 'README.md']) assert.ok(existsSync(here(file)), file);
  const page = readFileSync(here('index.html'), 'utf8'), game = readFileSync(here('game.js'), 'utf8');
  const version = page.match(/game\.js\?v=(\d+)/)[1];
  assert.ok(page.includes(`style.css?v=${version}`));
  assert.ok(game.includes(`./topple.js?v=${version}`) && game.includes(`./audio.js?v=${version}`), 'one version number everywhere');
  assert.ok(page.includes('../sky-playground/vendor/three.module.js'));
  assert.ok(page.includes('href="../index.html"'));
  assert.ok(readFileSync(here('../index.html'), 'utf8').includes('href="little-dominoes/"'));
  assert.equal(PALETTES.length, 4);
  assert.ok(PALETTES.every(p => p.colours.length === 7));
  assert.ok(SPACING - SIZE.t < SIZE.h, 'neighbours are within reach');
});
