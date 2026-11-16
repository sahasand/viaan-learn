// Number Playground rules: the path of stops and the tasks each game sets. Plain data and
// numbers only, so everything here runs in Node tests. Stars, stickers and which stops
// are open are kept by ../play-kit/progress.js.
import { between, pick, shuffle } from '../play-kit/progress.js?v=3';
export const SAVE_KEY = 'viaan-numbers-v1';
const FOODS = { bear: 'apple', cat: 'fish', penguin: 'fish', dog: 'cookie', panda: 'apple', elephant: 'apple', giraffe: 'apple' };

// The path. Each stop is one game at one difficulty; a visit sets a fresh handful of tasks.
export const LANDS = [
  { title: 'Counting Meadow', stops: ['feed3', 'find5', 'feed5', 'order5', 'more5', 'feed10', 'find10', 'order10', 'more10'] },
  { title: 'Adding Pond', stops: ['dots5', 'hop5', 'bowl5', 'back5', 'dots10', 'hop10', 'bowl10', 'launch', 'fly10', 'doubles'] },
  { title: 'Big Number Hill', stops: ['find20', 'order20', 'feed20', 'big20', 'twos', 'fives', 'tens'] }
];
export const STOPS = [
  { id: 'feed3', game: 'feed', title: 'Feed the bear', icon: '🍎', min: 1, max: 3 },
  { id: 'find5', game: 'pop', mode: 'find', title: 'Pop the number', icon: '🎈', min: 1, max: 5 },
  { id: 'feed5', game: 'feed', title: 'Hungry friends', icon: '🍪', min: 2, max: 5 },
  { id: 'order5', game: 'pop', mode: 'order', title: 'Pop 1 to 5', icon: '🎈', from: 1, to: 5, step: 1 },
  { id: 'more5', game: 'more', title: 'Who has more?', icon: '⚖️', min: 1, max: 5 },
  { id: 'feed10', game: 'feed', title: 'Big dinner', icon: '🍽️', min: 5, max: 10 },
  { id: 'find10', game: 'pop', mode: 'find', title: 'Pop to 10', icon: '🎈', min: 0, max: 10 },
  { id: 'order10', game: 'pop', mode: 'order', title: 'Pop 1 to 10', icon: '🎈', from: 1, to: 10, step: 1 },
  { id: 'more10', game: 'more', title: 'More or fewer?', icon: '⚖️', min: 3, max: 10, fewer: true },
  { id: 'dots5', game: 'domino', title: 'Domino dots', icon: '🎲', max: 5 },
  { id: 'hop5', game: 'hop', title: 'Froggy hops', icon: '🐸', max: 5 },
  { id: 'bowl5', game: 'bowl', title: 'Bowling', icon: '🎳', max: 5 },
  { id: 'back5', game: 'hop', title: 'Hop back', icon: '🐸', max: 5, back: true },
  { id: 'dots10', game: 'domino', title: 'Big dominoes', icon: '🎲', max: 10 },
  { id: 'hop10', game: 'hop', title: 'Long hops', icon: '🐸', max: 10 },
  { id: 'bowl10', game: 'bowl', title: 'Ten pins', icon: '🎳', max: 10 },
  { id: 'launch', game: 'pop', mode: 'order', title: 'Rocket countdown', icon: '🚀', from: 10, to: 0, step: -1 },
  { id: 'fly10', game: 'hop', title: 'Catch the fly', icon: '🪰', max: 10, ask: 'hops' },
  { id: 'doubles', game: 'domino', title: 'Doubles', icon: '🎲', max: 10, doubles: true },
  { id: 'find20', game: 'pop', mode: 'find', title: 'Pop to 20', icon: '🎈', min: 11, max: 20 },
  { id: 'order20', game: 'pop', mode: 'order', title: 'Pop 11 to 20', icon: '🎈', from: 11, to: 20, step: 1 },
  { id: 'feed20', game: 'feed', title: 'Giant picnic', icon: '🧺', min: 11, max: 15 },
  { id: 'big20', game: 'more', title: 'Bigger number', icon: '⚖️', min: 0, max: 20, numerals: true },
  { id: 'twos', game: 'pop', mode: 'order', title: 'Count by 2s', icon: '👟', from: 2, to: 20, step: 2 },
  { id: 'fives', game: 'pop', mode: 'order', title: 'Count by 5s', icon: '🖐️', from: 5, to: 30, step: 5 },
  { id: 'tens', game: 'pop', mode: 'order', title: 'Count by 10s', icon: '🔟', from: 10, to: 100, step: 10 }
];
export const stopById = id => STOPS.find(s => s.id === id) || null;

export function sequenceOf(stop) {
  const out = [];
  for (let n = stop.from; stop.step > 0 ? n <= stop.to : n >= stop.to; n += stop.step) out.push(n);
  return out;
}

// One task for a stop. `friends` are the animals the player has met, who take turns in the games.
export function makeTask(stop, rng = Math.random, friends = ['bear']) {
  if (stop.game === 'feed') {
    const want = between(rng, stop.min, stop.max), animal = pick(rng, friends);
    return { game: 'feed', want, animal, food: FOODS[animal] || pick(rng, ['apple', 'cookie']), pile: want + between(rng, 2, 3) };
  }
  if (stop.game === 'pop' && stop.mode === 'find') {
    const all = []; for (let n = stop.min; n <= stop.max; n++) all.push(n);
    const numbers = shuffle(rng, all).slice(0, 6);
    return { game: 'pop', mode: 'find', target: pick(rng, numbers), numbers };
  }
  if (stop.game === 'pop') {
    const sequence = sequenceOf(stop);
    return { game: 'pop', mode: 'order', sequence, numbers: shuffle(rng, sequence), launch: stop.step < 0 };
  }
  if (stop.game === 'more') {
    const left = between(rng, stop.min, stop.max);
    let right = left;
    while (right === left || right < stop.min || right > stop.max) right = left + between(rng, 1, 3) * (rng() < .5 ? -1 : 1);
    const [a, b] = shuffle(rng, friends.length > 1 ? friends : ['bear', 'duck']);
    return { game: 'more', left, right, ask: stop.fewer && rng() < .5 ? 'fewer' : 'more', numerals: !!stop.numerals, animals: [a, b], food: pick(rng, ['cookie', 'apple']) };
  }
  if (stop.game === 'domino') {
    let a, b;
    if (stop.doubles) a = b = between(rng, 1, 5);
    else do { a = between(rng, 1, Math.min(6, stop.max - 1)); b = between(rng, 1, Math.min(6, stop.max - a)); } while (stop.max > 5 && a + b < 5);
    return { game: 'domino', a, b, answer: a + b, max: stop.max };
  }
  if (stop.game === 'hop') {
    const reach = stop.max > 5 ? 4 : 3;
    if (stop.ask === 'hops') { const start = between(rng, 0, stop.max - 1), by = between(rng, 1, Math.min(5, stop.max - start)); return { game: 'hop', ask: 'hops', start, by, answer: by, max: stop.max }; }
    if (stop.back) { const start = between(rng, 1, stop.max), by = -between(rng, 1, Math.min(reach, start)); return { game: 'hop', ask: 'land', start, by, answer: start + by, max: stop.max }; }
    const start = between(rng, 0, stop.max - 1), by = between(rng, 1, Math.min(reach, stop.max - start));
    return { game: 'hop', ask: 'land', start, by, answer: start + by, max: stop.max };
  }
  const pins = between(rng, stop.max > 5 ? 6 : 3, stop.max), down = between(rng, 1, pins);
  return { game: 'bowl', pins, down, answer: pins - down };
}
// A visit to a stop: five tasks, or two or three whole sequences to pop in order, never the same task twice running.
export function makeRound(stop, rng = Math.random, friends = ['bear']) {
  const count = stop.mode === 'order' ? (sequenceOf(stop).length >= 8 ? 2 : 3) : 5, tasks = [];
  while (tasks.length < count) {
    let task, tries = 0;
    do task = makeTask(stop, rng, friends); while (tasks.length && same(task, tasks.at(-1)) && ++tries < 12);
    tasks.push(task);
  }
  return tasks;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function judgeFeed(task, count) { return count === task.want ? 'right' : count < task.want ? 'few' : 'many'; }
export const moreAnswer = task => (task.ask === 'more') === (task.left > task.right) ? 'left' : 'right';
