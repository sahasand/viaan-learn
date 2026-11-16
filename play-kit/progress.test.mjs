import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import * as P from './progress.js';

const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const STOPS = [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }, { id: 'c', title: 'Third' }];

test('stars, stickers and the sound choice are validated, and an older Number Playground save is read once', () => {
  const fresh = { stars: 0, stickers: [], sound: true };
  for (const bad of [null, undefined, '', 'nonsense', '[]', 42, '{"stars":-3,"stickers":"cat"}']) assert.deepEqual(P.normalizeRewards(bad), fresh);
  assert.deepEqual(P.normalizeRewards('{"stars":12,"stickers":["cat","cat","hydra","egg","rocket"],"sound":false}'), { stars: 12, stickers: ['cat', 'egg', 'rocket'], sound: false });
  assert.equal(P.normalizeRewards({ stars: 2.5 }).stars, 0);
  assert.equal(P.normalizeRewards({ stars: 1e9 }).stars, 99999);
  const legacy = '{"stars":31,"done":{"feed3":2},"stickers":["frog"],"sound":false,"next":"Pop"}';
  assert.deepEqual(P.normalizeRewards(null, legacy), { stars: 31, stickers: ['frog'], sound: false });
  assert.deepEqual(P.normalizeRewards('{"stars":4}', legacy), { stars: 4, stickers: [], sound: true }, 'the shared save wins once it exists');
  assert.deepEqual(P.friendsOf({ stickers: ['egg', 'cat', 'rocket'] }), ['bear', 'cat']);
});

test('stops open one after another, stars are only ever added, and a finished path stays open', () => {
  let rewards = P.normalizeRewards(null), visits = P.normalizeVisits('{"done":{"cheat":4,"b":-1}}', STOPS);
  assert.deepEqual(visits, { done: {}, next: 'First' });
  let result = P.finishRound(rewards, visits, STOPS, 'a', [true, false, true, true, false]);
  assert.equal(result.earned, 8);
  assert.deepEqual([result.rewards.stars, result.visits.done.a, P.reached(result.visits, STOPS), result.visits.next], [8, 1, 1, 'Second']);
  result = P.finishRound(result.rewards, result.visits, STOPS, 'a', [false]);
  assert.deepEqual([result.rewards.stars, result.visits.done.a, P.reached(result.visits, STOPS)], [9, 2, 1], 'a replay still earns');
  assert.equal(P.finishRound(result.rewards, result.visits, STOPS, 'nonsense', [true]).earned, 0);
  assert.equal(P.finishRound(result.rewards, result.visits, STOPS, 'a', []).earned, 0);
  for (const stop of STOPS) result = P.finishRound(result.rewards, result.visits, STOPS, stop.id, [true]);
  assert.equal(P.reached(result.visits, STOPS), STOPS.length - 1);
  assert.equal(result.rewards.sound, true);
});

test('an egg costs stars and always holds a new sticker, until every sticker is found', () => {
  assert.equal(P.hatchEgg({ stars: P.EGG_COST - 1 }), null);
  let rewards = P.normalizeRewards({ stars: P.EGG_COST * (P.STICKERS.length + 2) });
  const found = [];
  for (let i = 0; i < P.STICKERS.length; i++) {
    const egg = P.hatchEgg(rewards, seeded(i + 1));
    assert.ok(egg && !found.includes(egg.sticker) && P.STICKERS.includes(egg.sticker));
    assert.equal(egg.rewards.stars, rewards.stars - P.EGG_COST);
    found.push(egg.sticker); rewards = egg.rewards;
  }
  assert.equal(P.canHatch(rewards), false);
  assert.equal(P.hatchEgg(rewards), null);
  assert.ok(!P.STICKERS.includes('bear'));
  assert.equal(new Set(P.STICKERS).size, P.STICKERS.length);
  assert.equal(P.STICKERS.length, 11 + 16 + Object.keys(P.TREATS).length);
});

test('every clay sticker has its picture, and every game file shares one version number', () => {
  const root = new URL('../', import.meta.url);
  for (const name of P.ANIMALS) assert.ok(existsSync(new URL(`memory-assets/${name}.png`, root)), name);
  for (const name of P.TOYS) assert.ok(existsSync(new URL(`curriculum-assets/${name}.png`, root)), name);
  for (const clip of ['cheer_awesome', 'cheer_great', 'cheer_super', 'cheer_wow', 'cheer_yes', ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 20, 25, 30].map(n => 'num_' + n)]) assert.ok(existsSync(new URL(`audio/${clip}.mp3`, root)), clip);
  const versions = new Set(), files = ['index.html', 'curriculum-assets/home.js'];
  for (const dir of ['play-kit', 'number-playground', 'story-garden', 'little-detective']) for (const file of readdirSync(new URL(dir + '/', root))) if (/\.(js|html)$/.test(file) && !file.includes('.test.')) files.push(dir + '/' + file);
  for (const file of files) for (const [, v] of readFileSync(new URL(file, root), 'utf8').matchAll(/\.(?:js|css)\?v=(\d+)/g)) versions.add(v);
  assert.equal(versions.size, 1, `one version everywhere, found ${[...versions]}`);
  // No module is loaded without a version, which would let an old copy mix with a new one.
  for (const file of files) for (const [, spec] of readFileSync(new URL(file, root), 'utf8').matchAll(/from '(\.[^']+)'/g)) assert.match(spec, /\?v=\d+$/, `${file} imports ${spec}`);
});
