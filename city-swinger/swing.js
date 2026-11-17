// City Swinger's rules, in plain numbers so they run in Node tests. The city is seen from
// the side: x runs along the street, y is height. game.js draws what this file decides.
//
// The hero can never be hurt or stuck. Left alone he runs across a roof, leaps off its end,
// bounces on the trampoline in the street, sticks to the next wall and climbs it. Holding
// the screen throws a rope to a hook and swings him over the gap instead, which is faster,
// higher and catches the stars.
export const SAVE_KEY = 'viaan-swinger-v1';
export const GRAVITY = 24, RUN = 7.5, CLIMB = 8, MAX_SPEED = 21;
export const REACH = 19;            // how far the rope can be thrown
export const BODY = 1.2;            // the hero's middle is this far above his feet
export const CATCH = { star: 2.7, friend: 3.1 };   // how close counts as caught
export const FRIEND_STARS = 5, FINISH_STARS = 10;
// Who needs rescuing. Each waits somewhere different: on a roof, up on a chimney, or dangling under a hook.
export const FRIENDS = [
  { id: 'kitten', icon: '🐱', name: 'Kitten' }, { id: 'puppy', icon: '🐶', name: 'Puppy' }, { id: 'duckling', icon: '🐤', name: 'Duckling' },
  { id: 'teddy', icon: '🧸', name: 'Teddy' }, { id: 'balloon', icon: '🎈', name: 'Balloon' }, { id: 'kite', icon: '🪁', name: 'Kite' },
  { id: 'bunny', icon: '🐰', name: 'Bunny' }, { id: 'hat', icon: '🎩', name: 'Hat' }, { id: 'ball', icon: '⚽', name: 'Ball' }
];
// Suit colours. Those with a cost unlock when the hero has that many stars.
export const SUITS = [
  { id: 'teal', name: 'Sea green', suit: '#18a999', cape: '#ff9f1c' }, { id: 'purple', name: 'Grape', suit: '#7b4fd6', cape: '#ffd23f' },
  { id: 'green', name: 'Leaf', suit: '#3fae5a', cape: '#f25f8a' }, { id: 'orange', name: 'Sunset', suit: '#f2762e', cape: '#2ec4b6' },
  { id: 'pink', name: 'Bubblegum', suit: '#ef5da8', cape: '#5b8def', cost: 250 }, { id: 'gold', name: 'Golden', suit: '#f4b400', cape: '#ffffff', cost: 600 },
  { id: 'rainbow', name: 'Rainbow', suit: '#ff5fa2', cape: '#ffffff', cost: 1200 }
];
export const THEMES = ['day', 'sunset', 'night'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const seeded = seed => { let n = (seed * 2654435761) >>> 0 || 1; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); };

/* ---------- a mission: a row of buildings, hooks over the gaps, stars and three friends ---------- */
export function makeMission(number) {
  const rng = seeded(number + 11), between = (lo, hi) => lo + rng() * (hi - lo), n = Math.max(1, Math.floor(number));
  const count = Math.min(9 + n, 15), buildings = [], hooks = [], bouncers = [], stars = [], friends = [];
  let x = -8, height = 9;
  for (let i = 0; i <= count; i++) {
    const last = i === count, width = i === 0 ? 14 : last ? 20 : between(10, 17);
    buildings.push({ x0: x, x1: x + width, top: Math.round(height), style: Math.floor(rng() * 6), finish: last });
    if (last) break;
    const gap = between(10, 14), next = last ? height : clamp(height + between(-5, 5.5), 7, 22), left = x + width, right = left + gap;
    // The hook hangs over the middle of the gap, high enough to swing under and near enough to reach from the roof.
    const hookY = Math.max(height, next) + between(8.5, 10.5);
    hooks.push({ x: left + gap * between(.44, .56), y: hookY, kind: ['crane', 'flag', 'balloon'][Math.floor(rng() * 3)] });
    bouncers.push({ x0: left + 1.2, x1: right - 1.2 });
    // Stars hang in a smile under the hook, and a few sit along the next roof.
    const hook = hooks.at(-1), rope = Math.min(REACH - 2, Math.hypot(hook.x - left, hook.y - height - BODY)) * .86;
    for (let s = 0; s < 5; s++) { const a = (-56 + s * 28) * Math.PI / 180; stars.push({ x: hook.x + Math.sin(a) * rope, y: hook.y - Math.cos(a) * rope, big: s === 2 && i % 3 === 1 }); }
    for (let s = 1; s <= 2; s++) stars.push({ x: right + s * 3.2, y: next + 1.6 });
    x = right; height = next;
  }
  // Three friends to rescue, spread along the way, each waiting somewhere different.
  const places = ['roof', 'hang', 'perch'], order = [...FRIENDS].sort(() => rng() - .5), spread = [.25, .55, .82];
  for (let f = 0; f < 3; f++) {
    const i = clamp(Math.round(spread[f] * (count - 1)), 1, count - 1), b = buildings[i], place = places[(f + n) % 3], hook = hooks[i];
    const at = place === 'roof' ? { x: (b.x0 + b.x1) / 2 + 1.5, y: b.top + 1.3 } : place === 'perch' ? { x: b.x0 + 2.8, y: b.top + 3.1 } : { x: hook.x, y: hook.y - Math.min(REACH - 2, Math.hypot(hook.x - b.x1, hook.y - b.top - BODY)) * .86 - .4 };
    friends.push({ ...order[f], ...at, place });
  }
  // Nothing to catch sits inside a building: whatever would is lifted to just above the roof.
  for (const thing of [...stars, ...friends]) { const under = buildings.find(b => thing.x > b.x0 - .6 && thing.x < b.x1 + .6); if (under) thing.y = Math.max(thing.y, under.top + 1.5); }
  const end = buildings.at(-1);
  return { number: n, theme: THEMES[(n - 1) % THEMES.length], buildings, hooks, bouncers, stars, friends, start: { x: buildings[0].x0 + 3, y: buildings[0].top }, finish: { x: end.x0 + 9, y: end.top }, length: end.x1 };
}

/* ---------- the hero ---------- */
// mode: 'run' on a roof or the street, 'air', 'swing' on the rope, 'climb' up a wall, 'done' at the finish.
export const startHero = mission => ({ x: mission.start.x, y: mission.start.y, vx: 0, vy: 0, mode: 'run', on: 0, hook: -1, rope: 0, wait: 0, last: -1, side: 1, done: false });
// The hook a rope thrown now would catch: ahead or just overhead, above the hero, within reach, and not
// the one he has just let go of (`last`, forgotten once he has landed or stuck to a wall).
export function hookFor(mission, hero) {
  let best = -1, least = Infinity;
  mission.hooks.forEach((h, i) => {
    const dx = h.x - hero.x, dy = h.y - (hero.y + BODY), far = Math.hypot(dx, dy);
    if (i === hero.last || dx < -3 || dy < 2.5 || far > REACH) return;
    const cost = far + Math.abs(dx - 5) * .6;
    if (cost < least) { least = cost; best = i; }
  });
  return best;
}
const roofUnder = (mission, x) => mission.buildings.findIndex(b => x >= b.x0 && x <= b.x1);
// One step of time. `holding` is whether the screen is pressed. Returns the hero and what
// happened: 'throw', 'let go', 'land', 'bounce', 'stick', 'leap', 'jump', 'finish'.
export function stepHero(mission, hero, holding, elapsed) {
  const dt = clamp(elapsed, 0, .034), h = { ...hero, wait: Math.max(0, hero.wait - dt) }, events = [];
  if (h.done) return { hero: h, events };
  const throwRope = () => {
    const i = holding ? hookFor(mission, h) : -1; if (i < 0) return false;
    const hook = mission.hooks[i]; h.mode = 'swing'; h.hook = i; h.rope = clamp(Math.hypot(hook.x - h.x, hook.y - h.y - BODY), 4, REACH); h.start = h.rope;
    if (h.vx < 4) h.vx = 4; events.push('throw'); return true;
  };
  if (h.mode === 'run') {
    const b = h.on >= 0 ? mission.buildings[h.on] : null, floor = b ? b.top : 0;
    h.y = floor; h.vy = 0; h.vx = RUN * h.side; h.x += h.vx * dt;
    if (b?.finish && h.x >= mission.finish.x) { h.x = mission.finish.x; h.vx = 0; h.mode = 'done'; h.done = true; events.push('finish'); return { hero: h, events }; }
    // A rope is only thrown over a gap, so on a roof he runs to its end first: there he swings if the screen is held, and leaps if not.
    if (!b && throwRope()) return { hero: h, events };
    if (b && h.x > b.x1) { h.x = b.x1 + .6; h.mode = 'air'; h.vx = 8.5; h.vy = 8; if (throwRope()) h.vy = 2; else events.push('leap'); }
    else if (!b) {                                             // on the street: the next wall is climbed
      const wall = mission.buildings.findIndex(o => h.x + .5 >= o.x0 && h.x < o.x1);
      if (wall >= 0) { h.mode = 'climb'; h.on = wall; h.x = mission.buildings[wall].x0 - .5; h.side = 1; events.push('stick'); }
    }
    return { hero: h, events };
  }
  if (h.mode === 'climb') {
    const b = mission.buildings[h.on]; h.vx = 0; h.vy = CLIMB; h.y += CLIMB * dt;   // a wall is always climbed to the top
    if (h.y >= b.top) { h.y = b.top; h.x = h.x < b.x0 ? b.x0 + .4 : b.x1 - .4; h.mode = 'run'; h.side = 1; events.push('land'); }
    return { hero: h, events };
  }
  const before = { x: h.x, y: h.y };
  h.vy -= GRAVITY * dt;
  if (h.mode === 'swing') {
    const hook = mission.hooks[h.hook];
    // Reeling the rope in a little lifts him clear of the roofs, and a push forward keeps the swing lively.
    h.rope = Math.max(Math.max(4, h.start * .64), h.rope - 3.2 * dt);
    if (h.vx > 0) h.vx += 6 * dt;
    h.x += h.vx * dt; h.y += h.vy * dt;
    let dx = h.x - hook.x, dy = h.y + BODY - hook.y, far = Math.hypot(dx, dy);
    if (far > h.rope) {                                        // the rope is tight: stay on its circle and keep only the sideways speed
      dx /= far; dy /= far; h.x = hook.x + dx * h.rope; h.y = hook.y + dy * h.rope - BODY;
      const along = h.vx * dx + h.vy * dy; h.vx -= along * dx; h.vy -= along * dy;
    }
    // Let go by choice, or by itself at the top of the forward swing, or if the swing has turned back.
    // Held, it lets go by itself once he is rising above the roof ahead, or at the top of the swing.
    const forward = Math.atan2(h.x - hook.x, hook.y - h.y - BODY), ahead = mission.buildings.find(b => b.x0 > hook.x);
    if (!holding || h.vy > 0 && (forward > .95 || forward > .3 && ahead && h.y > ahead.top + 1) || h.vx < -1 && forward < .2) {
      h.mode = 'air'; h.last = h.hook; h.hook = -1; h.wait = .28; events.push('let go');
      if (h.vx < 6) h.vx = 6; if (h.vy < 3 && forward > 0) h.vy += 4;
    }
  } else {
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.wait <= 0 && roofUnder(mission, h.x) < 0 && throwRope()) return { hero: h, events };
  }
  const speed = Math.hypot(h.vx, h.vy); if (speed > MAX_SPEED) { h.vx *= MAX_SPEED / speed; h.vy *= MAX_SPEED / speed; }
  const street = h.y <= 0; if (street) h.y = 0;
  // Meeting the city: land on a roof from above, stick to a wall from the side, bounce on a trampoline, or land in the street.
  const drop = () => { if (h.mode === 'swing') { h.last = h.hook; h.hook = -1; h.wait = .28; } };
  for (let i = 0; i < mission.buildings.length; i++) {
    const b = mission.buildings[i];
    if (h.x < b.x0 - .5 || h.x > b.x1 + .5 || h.y >= b.top) continue;
    if (before.y >= b.top - .01 && h.x >= b.x0 && h.x <= b.x1) { drop(); h.last = -1; h.y = b.top; h.vy = 0; h.mode = 'run'; h.on = i; h.side = 1; events.push('land'); }
    else { drop(); h.last = -1; const left = before.x <= (b.x0 + b.x1) / 2; h.x = left ? b.x0 - .5 : b.x1 + .5; h.vx = 0; h.vy = 0; h.mode = 'climb'; h.on = i; h.side = 1; events.push('stick'); }
    return { hero: h, events };
  }
  if (street) {
    const pad = mission.bouncers.find(p => h.x >= p.x0 && h.x <= p.x1);
    drop();
    if (pad && h.vy < 0) { h.y = 0; h.vy = 19; h.vx = Math.max(h.vx, 4.5); h.mode = 'air'; events.push('bounce'); }
    else { h.y = 0; h.vy = 0; h.mode = 'run'; h.on = roofUnder(mission, h.x) >= 0 ? roofUnder(mission, h.x) : -1; h.side = 1; if (h.on >= 0) { h.mode = 'climb'; h.x = mission.buildings[h.on].x0 - .5; } events.push('land'); }
  }
  h.x = clamp(h.x, mission.buildings[0].x0 + .5, mission.length - .5);
  return { hero: h, events };
}
// What the hero has just reached: stars and friends not yet caught. Marks them and returns them.
export function gather(mission, hero) {
  const found = [], cx = hero.x, cy = hero.y + BODY;
  for (const star of mission.stars) if (!star.taken && Math.hypot(star.x - cx, star.y - cy) < CATCH.star) { star.taken = true; found.push({ kind: 'star', value: star.big ? 5 : 1, thing: star }); }
  for (const friend of mission.friends) if (!friend.taken && Math.hypot(friend.x - cx, friend.y - cy) < CATCH.friend) { friend.taken = true; found.push({ kind: 'friend', value: FRIEND_STARS, thing: friend }); }
  return found;
}

/* ---------- what is saved ---------- */
export function normalizeSave(raw) {
  let saved = raw;
  if (typeof raw === 'string') { try { saved = JSON.parse(raw); } catch { saved = null; } }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const whole = (n, most) => Number.isInteger(n) && n > 0 ? Math.min(n, most) : 0;
  const owned = Array.isArray(saved.owned) ? SUITS.filter(s => s.cost && saved.owned.includes(s.id)).map(s => s.id) : [];
  const rescued = {}; for (const f of FRIENDS) { const n = whole(saved.rescued?.[f.id], 9999); if (n) rescued[f.id] = n; }
  const suit = SUITS.find(s => s.id === saved.suit && (!s.cost || owned.includes(s.id))) || SUITS[0];
  return { stars: whole(saved.stars, 99999), missions: whole(saved.missions, 9999), owned, rescued, suit: suit.id, sound: saved.sound === true };
}
// Stars from a finished or abandoned mission are added the moment they are earned.
export const earn = (save, stars) => { const s = normalizeSave(save); return Number.isInteger(stars) && stars > 0 ? normalizeSave({ ...s, stars: s.stars + stars }) : s; };
export function rescue(save, id) { const s = normalizeSave(save); return FRIENDS.some(f => f.id === id) ? normalizeSave({ ...s, rescued: { ...s.rescued, [id]: (s.rescued[id] || 0) + 1 } }) : s; }
export const finishMission = save => { const s = normalizeSave(save); return normalizeSave({ ...s, missions: s.missions + 1, stars: s.stars + FINISH_STARS }); };
// A suit with a cost unlocks once the hero has that many stars. Stars are not spent: nothing is ever taken away.
export function chooseSuit(save, id) {
  const s = normalizeSave(save), suit = SUITS.find(x => x.id === id); if (!suit) return s;
  if (suit.cost && !s.owned.includes(id)) { if (s.stars < suit.cost) return s; return normalizeSave({ ...s, owned: [...s.owned, id], suit: id }); }
  return normalizeSave({ ...s, suit: id });
}
