import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as R from './rules.js';
import { WEEKS, PHASES, PICTURES } from './words.js';
import { ANIMALS, TOYS } from '../play-kit/progress.js';

const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const clip = name => existsSync(new URL(`../audio/${name}.mp3`, import.meta.url));
const pictured = w => ANIMALS.includes(w) || TOYS.includes(w) || !!PICTURES[w];
const everyTask = check => { for (const stop of R.STOPS) for (let seed = 1; seed <= 40; seed++) for (const task of R.makeRound(stop, seeded(seed), ['bear'], pictured)) check(task, stop, seed); };

test('the course is forty weeks in six phases, in order, one stop a week', () => {
  assert.equal(WEEKS.length, 40); assert.equal(PHASES.length, 6);
  assert.deepEqual(WEEKS.map(w => w.w), Array.from({ length: 40 }, (_, i) => i + 1));
  for (let i = 1; i < WEEKS.length; i++) assert.ok(WEEKS[i].ph >= WEEKS[i - 1].ph);
  assert.deepEqual(R.LANDS.flatMap(l => l.stops), R.STOPS.map(s => s.id));
  assert.ok(R.LANDS.every(l => l.title && l.stops.length));
  assert.deepEqual(WEEKS[2].letters, ['s', 'a', 't', 'p'], 'the first letters taught are s, a, t, p');
  assert.equal(new Set(WEEKS.flatMap(w => w.words.map(([word]) => word))).size, 114, 'every word of the course is kept');
});

test('every sound, word and rhyme the games can play has its recording', () => {
  const sounds = new Set(), words = new Set();
  for (const week of WEEKS) {
    week.letters.forEach(l => sounds.add(l));
    for (const [word, parts] of week.words) { words.add(word); parts.forEach(p => sounds.add(p)); assert.equal(parts.join('').replace(/_/g, '').length, word.length, `${word} is spelt by its sounds`); }
    week.tricky.forEach(w => words.add(w));
    for (const [word, answer, wrong] of week.rhymes) [word, answer, ...wrong].forEach(w => words.add(w));
    for (const [picture, letter] of week.starts || []) { words.add(picture); assert.equal(picture[0], letter); assert.ok(pictured(picture), picture); }
  }
  for (const s of sounds) assert.ok(clip(R.soundClip(s)), `sound ${s}`);
  for (const w of words) assert.ok(clip(R.wordClip(w)), `word ${w}`);
  assert.equal(R.soundClip('s'), 'phon_S'); assert.equal(R.soundClip('eer'), 'phon_ear'); assert.equal(R.soundClip('a_e'), 'phon_a_e');
});

test('a visit is five different tasks whose right answer is always among the choices, once', () => {
  const kinds = new Set();
  everyTask((task, stop, seed) => {
    kinds.add(task.game + (task.kind ? ':' + task.kind : ''));
    const at = `${stop.id} seed ${seed} ${task.game}`;
    if (task.options) { assert.equal(new Set(task.options).size, 3, at + ' has three different choices'); assert.equal(task.options.filter(o => o === (task.game === 'read' ? task.word : task.target ?? task.answer)).length, 1, at); }
    if (task.game === 'read') { assert.ok(task.options.every(pictured), at + ' every choice has a picture'); assert.equal(task.sounds.join('').replace(/_/g, '').length, task.word.length); }
    if (task.game === 'build') {
      const left = [...task.tiles]; for (const s of task.sounds) { const i = left.indexOf(s); assert.notEqual(i, -1, at + ' has a tile for ' + s); left.splice(i, 1); }
      assert.ok(left.length >= 2 && left.length <= 3 && left.every(s => !task.sounds.includes(s)), at + ' spare tiles are not in the word');
    }
    if (task.game === 'story') assert.ok(task.text.includes('___') && task.options.includes(task.answer));
  });
  assert.deepEqual([...kinds].sort(), ['build', 'hear:sound', 'hear:start', 'hear:word', 'read', 'rhyme', 'story']);
  for (const stop of R.STOPS) for (let seed = 1; seed <= 20; seed++) {
    const round = R.makeRound(stop, seeded(seed), ['bear'], pictured);
    assert.equal(round.length, 5);
    assert.equal(new Set(round.map(t => t.game + (t.word || t.target || t.text))).size, 5, `${stop.id} asks five different things`);
  }
});

test('listening choices never set two spellings of one sound against each other, and only use what has been met', () => {
  everyTask((task, stop) => {
    if (task.game !== 'hear') return;
    const met = R.known(stop.week);
    if (task.kind === 'word') { assert.ok(task.options.every(o => met.tricky.includes(o) || met.words.some(w => w.word === o))); return; }
    assert.ok(task.options.every(o => met.letters.includes(o)), `${stop.id} ${task.options}`);
    for (const group of [['c', 'k'], ['ai', 'ay', 'a_e'], ['ee', 'ea'], ['oi', 'oy'], ['ur', 'ir', 'er'], ['f', 'ph']]) assert.ok(task.options.filter(o => group.includes(o)).length <= 1, `${stop.id} ${task.options}`);
  });
  assert.equal(R.known(2).words.length, 0);
  assert.ok(R.known(3).words.length === 3 && R.known(40).words.length === 114);
  assert.deepEqual(R.planFor(1), ['rhyme', 'rhyme', 'rhyme', 'rhyme', 'rhyme']);
  assert.ok(R.planFor(25).includes('story') && R.planFor(25).includes('read') && R.planFor(25).includes('build'));
});
