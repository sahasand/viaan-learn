// Story Garden rules: one stop for each week of the phonics course, and the tasks a visit
// sets from that week's sounds and words. Plain data only, so everything runs in Node tests.
import { WEEKS, PHASES } from './words.js?v=2';
import { between, pick, shuffle } from '../play-kit/progress.js?v=2';
export const SAVE_KEY = 'viaan-story-v1';
const LAND_NAMES = ['Listening Lawn', 'First Letters', 'Sound Teams', 'Blending Bridge', 'More Sounds', 'Story Hill'];
export const STOPS = WEEKS.map(week => ({ id: 'w' + week.w, title: week.title, week: week.w, phase: week.ph }));
export const LANDS = PHASES.map((_, i) => ({ title: LAND_NAMES[i], stops: STOPS.filter(s => s.phase === i + 1).map(s => s.id) }));
// Spellings of one sound are never offered against each other when the task is only to listen.
const SAME = [['ai', 'ay', 'a_e'], ['ee', 'ea'], ['igh', 'ie', 'i_e'], ['oa', 'oe', 'o_e'], ['ur', 'ir', 'er'], ['aw', 'au', 'or'], ['ue', 'ew', 'u_e', 'oo'], ['oi', 'oy'], ['ow', 'ou'], ['f', 'ph'], ['c', 'k'], ['s', 'ss'], ['l', 'll'], ['z', 'zz'], ['ear', 'eer']];
const alike = (a, b) => a === b || SAME.some(group => group.includes(a) && group.includes(b));
// Recorded clips: a single letter is filed in capitals, and the "eer" in deer shares the "ear" recording.
export const soundClip = s => 'phon_' + (s === 'eer' ? 'ear' : s.length === 1 ? s.toUpperCase() : s);
export const wordClip = w => 'word_' + w.replace(/[^a-zA-Z]/g, '_');

// Everything met up to and including a week: the pool that wrong choices and review come from.
export function known(week) {
  const upto = WEEKS.filter(w => w.w <= week), flat = key => [...new Set(upto.flatMap(w => w[key]))];
  const words = new Map(upto.flatMap(w => w.words));
  return { letters: [...new Set([...flat('letters'), ...[...words.values()].flat()])], words: [...words].map(([word, sounds]) => ({ word, sounds })), tricky: flat('tricky') };
}
const others = (rng, pool, not, count, same = (a, b) => a === b) => {
  const out = [];
  for (const one of shuffle(rng, pool)) { if (out.length === count) break; if (!same(one, not) && !out.some(o => same(o, one))) out.push(one); }
  return out;
};
// One task of a kind for a week; null when that week has nothing for it. `pictured` says which words have a picture.
export function makeTask(kind, week, rng, pictured = () => true) {
  const now = WEEKS[week - 1], all = known(week);
  if (kind === 'sound') {
    const target = pick(rng, now.letters.length ? now.letters : all.letters);
    return { game: 'hear', kind: 'sound', target, clip: soundClip(target), options: shuffle(rng, [target, ...others(rng, all.letters, target, 2, alike)]) };
  }
  if (kind === 'start') {
    if (!now.starts?.length) return null;
    const [picture, target] = pick(rng, now.starts);
    return { game: 'hear', kind: 'start', picture, target, clip: wordClip(picture), options: shuffle(rng, [target, ...others(rng, all.letters, target, 2, alike)]) };
  }
  if (kind === 'trick') {
    if (!all.tricky.length) return null;
    const target = pick(rng, now.tricky.length ? now.tricky : all.tricky), pool = [...all.tricky, ...all.words.map(w => w.word)];
    return { game: 'hear', kind: 'word', target, clip: wordClip(target), options: shuffle(rng, [target, ...others(rng, pool, target, 2)]) };
  }
  if (kind === 'read') {
    const can = all.words.filter(w => pictured(w.word)), fresh = can.filter(w => now.words.some(([word]) => word === w.word));
    if (can.length < 3) return null;
    const target = fresh.length && rng() < .7 ? pick(rng, fresh) : pick(rng, can);
    return { game: 'read', word: target.word, sounds: target.sounds, options: shuffle(rng, [target.word, ...others(rng, can.map(w => w.word), target.word, 2)]) };
  }
  if (kind === 'build') {
    if (!all.words.length) return null;
    const fresh = now.words.map(([word, sounds]) => ({ word, sounds })), target = fresh.length && rng() < .7 ? pick(rng, fresh) : pick(rng, all.words);
    const spare = others(rng, all.letters.filter(l => !target.sounds.some(s => alike(s, l))), '', between(rng, 2, 3), alike);
    return { game: 'build', word: target.word, sounds: target.sounds, tiles: shuffle(rng, [...target.sounds, ...spare]) };
  }
  if (kind === 'story') {
    if (!now.sentences.length) return null;
    const [text, answer, wrong] = pick(rng, now.sentences);
    return { game: 'story', text, answer, options: shuffle(rng, [answer, ...wrong]) };
  }
  if (!now.rhymes.length) return null;
  const [word, answer, wrong] = pick(rng, now.rhymes);
  return { game: 'rhyme', word, answer, options: shuffle(rng, [answer, ...wrong]) };
}
// Which kinds of task a week's visit is made of, most important first.
export function planFor(week) {
  const now = WEEKS[week - 1];
  if (!known(week).words.length) return now.starts?.length ? ['sound', 'start', 'rhyme', 'sound', 'start'] : now.letters.length ? ['sound', 'rhyme', 'sound', 'rhyme', 'sound'] : ['rhyme', 'rhyme', 'rhyme', 'rhyme', 'rhyme'];
  return [now.letters.length ? 'sound' : 'trick', 'read', 'build', now.sentences.length ? 'story' : 'read', now.tricky.length && now.letters.length ? 'trick' : 'build'];
}
// A visit: five tasks, mixed, never the same thing asked twice.
export function makeRound(stop, rng = Math.random, friends = ['bear'], pictured = () => true) {
  const tasks = [], asked = new Set(), key = t => t.game + ':' + (t.word || t.target || t.text);
  for (const kind of planFor(stop.week)) {
    let task = null;
    for (let tries = 0; tries < 16 && (!task || asked.has(key(task))); tries++) task = makeTask(kind, stop.week, rng, pictured) || makeTask('read', stop.week, rng, pictured) || makeTask('sound', stop.week, rng, pictured);
    asked.add(key(task)); tasks.push(task);
  }
  return shuffle(rng, tasks);
}
