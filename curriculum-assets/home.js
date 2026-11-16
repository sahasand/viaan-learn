// The home page: three learning games, the Daily Adventure that visits them in turn, and
// a summary for grown-ups. The games keep their own saves; this page only reads them.
import { REWARDS_KEY, STICKERS, normalizeRewards, normalizeVisits, dayStamp } from '../play-kit/progress.js?v=4';
import { STOPS as MATH, SAVE_KEY as MATH_KEY } from '../number-playground/rules.js?v=4';
import { STOPS as ENG, SAVE_KEY as ENG_KEY } from '../story-garden/rules.js?v=4';
import { STOPS as CRIT, SAVE_KEY as CRIT_KEY } from '../little-detective/rules.js?v=4';

export const WORLDS = {
  math: { short: 'Math', title: 'Number Playground', href: 'number-playground/', key: MATH_KEY, stops: MATH, card: 'wM' },
  eng: { short: 'English', title: 'Story Garden', href: 'story-garden/', key: ENG_KEY, stops: ENG, card: 'wE' },
  crit: { short: 'Thinking', title: 'Little Detective', href: 'little-detective/', key: CRIT_KEY, stops: CRIT, card: 'wC' }
};
const GAMES = { memory: 'memory.html', plane: 'sky-playground/', chess: 'chess.html' };
// Today's adventure: four learning stops, then a game. An adventure saved on another day,
// or one that does not make sense, is replaced by a fresh one.
export function planAdventure(saved, today, dayNumber) {
  const a = saved, valid = a && a.d === today && Number.isInteger(a.n) && a.n >= 0 && a.n <= 4 && Object.hasOwn(GAMES, a.g) && Array.isArray(a.s) && a.s.length === 4 && a.s.every(s => s && Object.hasOwn(WORLDS, s.w));
  return valid ? a : { d: today, n: 0, g: Object.keys(GAMES)[dayNumber % 3], s: ['eng', 'math', 'eng', 'crit'].map(w => ({ w })) };
}
export const adventureHref = a => a.n === 4 ? GAMES[a.g] : WORLDS[a.s[a.n].w].href + '?adventure=1';

if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  let progress; try { progress = JSON.parse(read('vla4')); } catch {}
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) progress = {};
  let rewards = normalizeRewards(read(REWARDS_KEY), read(MATH_KEY));
  const adventure = planAdventure(progress.__adv, dayStamp(), Math.floor(Date.now() / 864e5));
  $('badgeCount').textContent = `${rewards.stars} star${rewards.stars === 1 ? '' : 's'} · ${rewards.stickers.length} of ${STICKERS.length} stickers`;
  $('advLabel').textContent = adventure.n === 4 ? 'Pick your game' : adventure.n > 0 ? 'Continue my adventure' : 'Start my adventure';
  $('advSub').textContent = adventure.n === 4 ? 'Your four learning stops are complete.' : 'Four little learning stops, at your own pace.';
  $('adventureTrail').innerHTML = adventure.s.map((s, i) => `<span class="trail-stop ${i < adventure.n ? 'complete' : i === adventure.n ? 'current' : ''}"><b>${i < adventure.n ? '✓' : i + 1}</b>${WORLDS[s.w].short}</span>`).join('') + '<span class="trail-stop"><b>☆</b>Play</span>';
  $('advB').onclick = () => { try { localStorage.setItem('vla4', JSON.stringify({ ...progress, __adv: adventure })); } catch {} location.href = adventureHref(adventure); };
  let summary = '';
  for (const [id, world] of Object.entries(WORLDS)) {
    const visits = normalizeVisits(read(world.key), world.stops), played = Object.keys(visits.done).length, total = Object.values(visits.done).reduce((n, v) => n + v, 0);
    $('next-' + id).textContent = 'Next: ' + visits.next;
    $('progress-' + id).textContent = `${played} of ${world.stops.length} played`;
    $(world.card).onclick = () => { location.href = world.href; };
    summary += `<div><strong>${world.short}</strong><span>${played} of ${world.stops.length} stops played</span><small>${total} visit${total === 1 ? '' : 's'} in all. Each visit sets fresh tasks.</small></div>`;
  }
  $('parentProgress').innerHTML = summary + `<p>${rewards.stars} stars to spend and ${rewards.stickers.length} of ${STICKERS.length} stickers, shared by the three games. Progress is saved in this browser.</p>`;
  const showSound = () => { $('soundToggle').textContent = rewards.sound ? 'Sound on' : 'Sound off'; $('soundToggle').setAttribute('aria-pressed', String(rewards.sound)); };
  $('soundToggle').onclick = () => { rewards = { ...rewards, sound: !rewards.sound }; try { localStorage.setItem(REWARDS_KEY, JSON.stringify(rewards)); } catch {} showSound(); };
  showSound();
}
