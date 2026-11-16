// What the three learning games share: one star bank, one sticker book, and the rules
// for opening stops. Plain data and numbers only, so everything here runs in Node tests.
export const REWARDS_KEY = 'viaan-rewards-v1';
export const EGG_COST = 10;              // stars that hatch one surprise egg
export const ANIMALS = ['bear', 'cat', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'lion', 'owl', 'panda', 'penguin', 'turtle'];
export const TOYS = ['apple', 'car', 'fish', 'seed', 'sprout', 'flower', 'tree', 'cup', 'ball', 'cookie', 'book', 'blocks', 'hat', 'ice', 'cloud', 'egg'];
// Stickers without a clay model are drawn as these.
export const TREATS = { unicorn: '🦄', dragon: '🐉', dinosaur: '🦖', whale: '🐳', butterfly: '🦋', ladybird: '🐞', rainbow: '🌈', rocket: '🚀', train: '🚂', tractor: '🚜', robot: '🤖', castle: '🏰', crown: '👑', gem: '💎', kite: '🪁', drum: '🥁', guitar: '🎸', balloon: '🎈', teddy: '🧸', icecream: '🍦', cupcake: '🧁', strawberry: '🍓', sunflower: '🌻', star: '🌟' };
// Bear is there from the start; every other friend, toy and treat hatches from an egg.
export const STICKERS = [...ANIMALS.filter(a => a !== 'bear'), ...TOYS, ...Object.keys(TREATS)];

const parse = raw => {
  let value = raw;
  if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { value = null; } }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
};
const whole = n => Number.isInteger(n) && n > 0 ? Math.min(n, 99999) : 0;
// Stars, stickers and the sound choice, shared by every learning game. Number Playground
// once kept its own; `legacy` is that older save, read only when there is no shared one yet.
export function normalizeRewards(raw, legacy = null) {
  const saved = parse(raw) || parse(legacy) || {};
  return { stars: whole(saved.stars), stickers: Array.isArray(saved.stickers) ? STICKERS.filter(s => saved.stickers.includes(s)) : [], sound: saved.sound !== false };
}
// One game's visits to its stops. `next` is the title of the stop to play next, which the
// home page shows without loading the game.
export function normalizeVisits(raw, stops) {
  const saved = parse(raw) || {}, done = {};
  if (saved.done && typeof saved.done === 'object') for (const stop of stops) if (Number.isInteger(saved.done[stop.id]) && saved.done[stop.id] > 0) done[stop.id] = Math.min(saved.done[stop.id], 9999);
  const visits = { done };
  visits.next = stops[reached(visits, stops)].title;
  return visits;
}
// Stops open one after another; every stop already reached stays open for replay.
export function reached(visits, stops) { const first = stops.findIndex(s => !visits.done[s.id]); return first < 0 ? stops.length - 1 : first; }
export const friendsOf = rewards => ['bear', ...rewards.stickers.filter(s => ANIMALS.includes(s))];
// Every finished task earns a star, and one more when it was right first time. Nothing is ever taken away.
export function finishRound(rewards, visits, stops, stopId, firsts) {
  const bank = normalizeRewards(rewards), log = normalizeVisits(visits, stops);
  if (!stops.some(s => s.id === stopId) || !Array.isArray(firsts) || !firsts.length) return { rewards: bank, visits: log, earned: 0 };
  const earned = firsts.reduce((n, first) => n + (first ? 2 : 1), 0);
  return { earned, rewards: { ...bank, stars: whole(bank.stars + earned) }, visits: normalizeVisits({ done: { ...log.done, [stopId]: (log.done[stopId] || 0) + 1 } }, stops) };
}
export const canHatch = rewards => rewards.stars >= EGG_COST && rewards.stickers.length < STICKERS.length;
// An egg costs stars and always holds a sticker the player does not have yet.
export function hatchEgg(rewards, rng = Math.random) {
  const bank = normalizeRewards(rewards);
  if (!canHatch(bank)) return null;
  const left = STICKERS.filter(s => !bank.stickers.includes(s)), sticker = left[Math.floor(rng() * left.length)];
  return { sticker, rewards: normalizeRewards({ ...bank, stars: bank.stars - EGG_COST, stickers: [...bank.stickers, sticker] }) };
}
// The home page's Daily Adventure keeps its place in `vla4`. When today's adventure is
// waiting at a stop for this game's world, a finished visit moves it on.
export function advanceAdventure(raw, today, world) {
  const progress = parse(raw), a = progress?.__adv;
  if (!a || a.d !== today || !Array.isArray(a.s) || !Number.isInteger(a.n) || a.s[a.n]?.w !== world) return null;
  return { ...progress, __adv: { ...a, n: a.n + 1 } };
}
export const dayStamp = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

/* ---------- helpers for making tasks ---------- */
export const between = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/* ---------- spoken lines ---------- */
// What a game says is a list of parts: numbers, lines of text, and names of clips already
// recorded (sounds, words, numbers, cheers). Each line of text has its own recording,
// named from the text, so the same sentence always finds the same file.
export const isClip = part => typeof part === 'string' && /^(phon|word|num|cheer|praise|say)_[A-Za-z0-9_]+$/.test(part);
export function lineId(text) {
  let h = 5381; for (const ch of text) h = (h * 33 ^ ch.codePointAt(0)) >>> 0;
  return 'say_' + text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36) + '_' + h.toString(36);
}
// The words shown on screen for a list of parts.
export const textOf = parts => (Array.isArray(parts) ? parts : [parts]).filter(p => !isClip(p)).join(' ').replace(/ ([.!?,])/g, '$1');
export const cap = word => word[0].toUpperCase() + word.slice(1);
// Numbers the games can say aloud: counting to 20, then the skip-counting steps.
export const SPOKEN_NUMBERS = [...Array.from({ length: 21 }, (_, n) => n), 25, 30, 40, 50, 60, 70, 80, 90, 100];
// The kit's own lines: eggs, stickers and the end of a visit.
export const KIT = {
  needStars: n => ['You need', n, 'more stars. Play a game!'],
  allFound: () => ['You found every sticker!'],
  tapEgg: () => ['Tap the egg!'],
  surprise: name => ['Surprise! It’s', cap(name) + '!'],
  name: name => [cap(name) + '!'],
  newStars: n => [n, 'new stars!']
};
export function kitLines() {
  const out = new Set(['You need', 'more stars. Play a game!', 'You found every sticker!', 'Tap the egg!', 'Surprise! It’s', 'new stars!']);
  for (const name of ['bear', ...STICKERS]) out.add(cap(name) + '!');
  return [...out];
}
