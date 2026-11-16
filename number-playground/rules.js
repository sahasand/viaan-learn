// Number Playground rules: the path of stops and the tasks each game sets. Plain data and
// numbers only, so everything here runs in Node tests. Stars, stickers and which stops
// are open are kept by ../play-kit/progress.js.
import { between, pick, shuffle, cap, ANIMALS } from '../play-kit/progress.js?v=4';
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

/* ---------- what the games say ---------- */
// Every spoken line is built here, as parts (see ../play-kit/progress.js), so the list of
// lines to record can be made from the same code that speaks them.
const foods = (food, n) => n === 1 || food === 'fish' ? food : food + 's';
export const sumLine = (a, b) => `${a} and ${b} make ${a + b}.`;
export const takeLine = (n, k) => `${n} take away ${k} is ${n - k}.`;
const stepOf = t => Math.abs(t.sequence[1] - t.sequence[0]);
const moreWord = t => t.numerals ? (t.ask === 'more' ? 'bigger' : 'smaller') : t.ask;
const moreQuestion = t => t.numerals ? `Which number is ${moreWord(t)}?` : `Who has ${t.ask} ${foods(t.food, 2)}?`;
export const V = {
  feedAsk: t => [`${cap(t.animal)} wants`, t.want, foods(t.food, t.want), '.', 'Put them on the plate!'],
  feedEmpty: () => ['Tap the food to put it on the plate.'],
  feedWrong: (t, n) => ['That is', n, '.', `${cap(t.animal)} wants`, t.want, '.', n < t.want ? 'Add some more!' : 'Take some back!'],
  feedRight: t => ['Yum!', t.want, foods(t.food, t.want), '.', 'Thank you!'],
  popFind: t => ['Pop number', t.target, '!'],
  popFindWrong: (t, n) => ['That is', n, '.', 'Find', t.target, '!'],
  popFound: t => ['Pop! Number', t.target, '!'],
  popOrder: t => t.launch ? ['Count down from', t.sequence[0], 'to blast off!'] : stepOf(t) > 1 ? [`Count by ${stepOf(t)}s. Start at`, t.sequence[0], '!'] : ['Pop them in order. Start at', t.sequence[0], '!'],
  popNotYet: n => ['Not yet.', 'Find', n, '!'],
  popDone: t => t.launch ? ['Blast off!'] : stepOf(t) > 1 ? [`You counted by ${stepOf(t)}s to`, t.sequence.at(-1), '!'] : ['You counted to', t.sequence.at(-1), '!'],
  moreAsk: t => [moreQuestion(t)],
  moreWrong: t => [t.numerals ? 'Look again.' : 'Count them.', moreQuestion(t)],
  moreRight: t => { const [win, lose] = moreAnswer(t) === 'left' ? [t.left, t.right] : [t.right, t.left]; return [win, `is ${moreWord(t)} than`, lose, '.']; },
  dotsAsk: () => ['How many dots altogether? Tap the dots to count them.'],
  dotsWrong: () => ['Count every dot. Tap them one by one.'],
  dotsRight: t => [sumLine(t.a, t.b)],
  hopAsk: t => t.ask === 'hops' ? ['Frog is on', t.start, '.', 'How many hops to the fly on', t.start + t.by, '?'] : ['Frog is on', t.start, '.', 'Hop', Math.abs(t.by), t.by < 0 ? 'back.' : 'forward.', 'Where does he land?'],
  hopWrong: t => ['Count', Math.abs(t.by), Math.abs(t.by) === 1 ? 'hop from' : 'hops from', t.start, '.'],
  hopOff: short => [short ? 'Not there yet! Try more hops.' : 'Too far! Try fewer hops.'],
  hopRight: t => [t.by < 0 ? takeLine(t.start, -t.by) : sumLine(t.start, t.by)],
  bowlAsk: t => [t.pins, 'pins! Tap the ball to roll it.'],
  bowlCount: () => ['Crash! How many pins are still standing?'],
  bowlWrong: () => ['Count the pins still standing. Tap each one.'],
  bowlRight: t => t.answer === 0 ? ['Strike!', takeLine(t.pins, t.down), 'None left!'] : [takeLine(t.pins, t.down)]
};
// Every line of text the game can say (numbers and punctuation are separate parts).
export function lines() {
  const out = new Set(['Put them on the plate!', 'Tap the food to put it on the plate.', 'That is', 'Add some more!', 'Take some back!', 'Yum!', 'Thank you!', 'apple', 'apples', 'cookie', 'cookies', 'fish',
    'Pop number', 'Find', 'Pop! Number', 'Count down from', 'to blast off!', 'Pop them in order. Start at', 'Not yet.', 'Blast off!', 'You counted to', 'Look again.', 'Count them.', 'Which number is bigger?', 'Which number is smaller?',
    'How many dots altogether? Tap the dots to count them.', 'Count every dot. Tap them one by one.', 'Frog is on', 'How many hops to the fly on', 'Hop', 'back.', 'forward.', 'Where does he land?', 'Count', 'hop from', 'hops from',
    'Not there yet! Try more hops.', 'Too far! Try fewer hops.', 'pins! Tap the ball to roll it.', 'Crash! How many pins are still standing?', 'Count the pins still standing. Tap each one.', 'Strike!', 'None left!']);
  for (const animal of ANIMALS) out.add(`${cap(animal)} wants`);
  for (const step of [2, 5, 10]) { out.add(`Count by ${step}s. Start at`); out.add(`You counted by ${step}s to`); }
  for (const ask of ['more', 'fewer']) for (const food of ['cookies', 'apples']) out.add(`Who has ${ask} ${food}?`);
  for (const word of ['more', 'fewer', 'bigger', 'smaller']) out.add(`is ${word} than`);
  for (let a = 0; a <= 9; a++) for (let b = 1; b <= 6 && a + b <= 10; b++) out.add(sumLine(a, b));
  for (let n = 1; n <= 10; n++) for (let k = 1; k <= n; k++) out.add(takeLine(n, k));
  return [...out];
}
