// Little Detective rules: twelve cases, each a mixed visit of thinking puzzles drawn from
// cases.js, with patterns made fresh every time. Plain data only, so it runs in Node tests.
import { ODD, GOES, NEXT, SILLY, NORMAL, ORDER } from './cases.js?v=2';
import { between, pick, shuffle } from '../play-kit/progress.js?v=2';
export const SAVE_KEY = 'viaan-detective-v1';
// Clay things that patterns are made of.
export const PATTERN_THINGS = ['apple', 'cookie', 'ball', 'car', 'fish', 'flower', 'hat', 'cup', 'egg', 'tree', 'book', 'cloud'];
// The repeating unit of a pattern at each level, as positions into the things chosen.
const UNITS = [[[0, 1]], [[0, 0, 1], [0, 1, 1], [0, 1, 2]], [[0, 0, 1, 1], [0, 1, 2, 3], [0, 1, 0, 2]]];
export const STOPS = [
  { id: 'odd', title: 'Odd one out', icon: '🔍', kinds: ['odd'] },
  { id: 'pattern', title: 'Patterns', icon: '🧩', kinds: ['pattern'], level: 0 },
  { id: 'goes', title: 'Goes together', icon: '🧦', kinds: ['goes'] },
  { id: 'case1', title: 'Case one', icon: '🕵️', kinds: ['odd', 'pattern', 'goes'], level: 0 },
  { id: 'next', title: 'What happens next?', icon: '⏭️', kinds: ['next'] },
  { id: 'pattern2', title: 'Bigger patterns', icon: '🧩', kinds: ['pattern'], level: 1 },
  { id: 'silly', title: 'That’s silly!', icon: '🤪', kinds: ['silly'] },
  { id: 'case2', title: 'Case two', icon: '🕵️', kinds: ['next', 'silly', 'odd', 'pattern', 'goes'], level: 1 },
  { id: 'order', title: 'Put in order', icon: '🔢', kinds: ['order', 'next'] },
  { id: 'pattern3', title: 'Tricky patterns', icon: '🧩', kinds: ['pattern'], level: 2 },
  { id: 'case3', title: 'Case three', icon: '🕵️', kinds: ['order', 'silly', 'pattern', 'next', 'odd'], level: 2 },
  { id: 'master', title: 'Master detective', icon: '🏅', kinds: ['pattern', 'silly', 'order', 'goes', 'next', 'odd'], level: 2 }
];
export const LANDS = [{ title: 'First Cases', stops: ['odd', 'pattern', 'goes', 'case1'] }, { title: 'Clue Trail', stops: ['next', 'pattern2', 'silly', 'case2'] }, { title: 'Detective HQ', stops: ['order', 'pattern3', 'case3', 'master'] }];
const POOLS = { odd: ODD, goes: GOES, next: NEXT, silly: SILLY, order: ORDER };

// A pattern shows its unit at least twice and stops where the next picture is certain.
export function makePattern(level, rng) {
  const unit = pick(rng, UNITS[level]), things = shuffle(rng, PATTERN_THINGS), shown = unit.length * 2 + between(rng, 0, unit.length - 1);
  const line = Array.from({ length: shown + 1 }, (_, i) => things[unit[i % unit.length]]), answer = line.pop();
  const inUnit = [...new Set(unit)].map(i => things[i]), spare = things.find(t => !inUnit.includes(t));
  return { game: 'pattern', line, answer, options: shuffle(rng, [...new Set([answer, ...inUnit.filter(t => t !== answer), spare])].slice(0, 3)) };
}
// One puzzle of a kind. `item` is the entry of cases.js to use.
export function makeTask(kind, item, rng, level = 0) {
  if (kind === 'pattern') return makePattern(level, rng);
  if (kind === 'odd') return { game: 'odd', group: item.group, answer: item.odd, options: shuffle(rng, [...item.others, item.odd]) };
  if (kind === 'goes') return { game: 'goes', thing: item.thing, answer: item.partner, why: item.why, options: shuffle(rng, [item.partner, ...item.others]) };
  if (kind === 'next') return { game: 'next', thing: item.thing, story: item.story, answer: item.then, why: item.why, options: shuffle(rng, [item.then, ...item.others]) };
  if (kind === 'order') return { game: 'order', order: item, tiles: shuffle(rng, item) };
  const plain = shuffle(rng, NORMAL).slice(0, 2);
  return { game: 'silly', why: item.why, answer: item.story, scenes: shuffle(rng, [item, ...plain]) };
}
// A case: five puzzles, taking the stop's kinds in turn, never the same puzzle twice.
export function makeRound(stop, rng = Math.random) {
  const kinds = shuffle(rng, stop.kinds), left = {}, tasks = [];
  for (let i = 0; tasks.length < 5; i++) {
    const kind = kinds[i % kinds.length];
    if (kind === 'pattern') { tasks.push(makePattern(stop.level || 0, rng)); continue; }
    left[kind] ||= shuffle(rng, POOLS[kind]);
    tasks.push(makeTask(kind, left[kind].pop(), rng));
  }
  return tasks;
}
