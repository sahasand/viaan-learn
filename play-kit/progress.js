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
