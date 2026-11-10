// Pure race rules, shared by the game and headless regression tests.
// Cars live in track coordinates: d is distance driven along the centre line
// (it keeps growing lap after lap) and lat is metres to the right of centre.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const LAPS = 3;
export const CRUISE = 26;       // m/s on the road
export const BOOST = 10;        // extra m/s while a boost is glowing
export const GRASS = 15;        // m/s off the road
export const HALF_ROAD = 7;     // metres from the centre line to the kerb
export const EDGE = 10.5;       // soft wall: nobody travels further out than this
export const BOOST_SECONDS = 2.4;
export const AIR_SECONDS = .95;    // time spent flying after a jump ramp
export const TUNNEL_LENGTH = 42;
export const DRIFT_SMALL = .9;     // seconds of holding a corner for blue sparks
export const DRIFT_BIG = 1.9;      // ... and for orange sparks
export const MEGA_AIR = 1.9;       // the second ramp of every lap is a mega jump
export const NITRO_SECONDS = 1.7;
export const PAD_SECONDS = 1.3;     // a zoom strip on the road
export const NITRO_COST = 1 / 3;   // the tank holds three bursts
// A vertical loop: cars enter on the left lane, go right round and leave on the right.
// Distance counts slowly inside it so the trip round takes a few seconds.
export const LOOP = { ground: 22, radius: 11, lead: 24, lane: 4.5, half: 3, pace: 22 / (22 + Math.PI * 22) };
export const STORAGE_KEY = 'viaan-racer-v1';

// Paints and trails with a cost are unlocked with coins collected in races.
export const PAINTS = [
  { id: 'sunshine', name: 'Sunshine yellow', color: '#f7bf12' },
  { id: 'tangerine', name: 'Tangerine orange', color: '#f5741a' },
  { id: 'cherry', name: 'Cherry red', color: '#dd2b2b' },
  { id: 'bubblegum', name: 'Bubblegum pink', color: '#f2559c' },
  { id: 'ocean', name: 'Ocean blue', color: '#2274dd' },
  { id: 'grape', name: 'Grape purple', color: '#7c4ad6' },
  { id: 'gold', name: 'Shiny gold', color: '#ffc21a', cost: 150 },
  { id: 'rainbow', name: 'Rainbow', color: '#ff5fa2', cost: 300 },
  { id: 'galaxy', name: 'Galaxy', color: '#2f1f7a', cost: 450 }
];
export const TRAILS = [
  { id: 'none', name: 'No trail' },
  { id: 'bubbles', name: 'Bubble trail', cost: 100 },
  { id: 'ribbon', name: 'Rainbow trail', cost: 250 },
  { id: 'fire', name: 'Fire trail', cost: 400 }
];
// Vehicles unlock with cups: finish a race on that many different tracks.
export const CARS = [
  { id: 'supercar', name: 'Supercar', cups: 0 },
  { id: 'truck', name: 'Monster truck', cups: 1 },
  { id: 'formula', name: 'Formula racer', cups: 3 }
];
// Each track's boss is a big dog in a crown who waits behind its cup and drives the monster truck.
export const BOSSES = {
  beach: { id: 'bruno', name: 'Bruno', color: '#f2a516' },
  snow: { id: 'frosty', name: 'Frosty', color: '#6f8fd8' },
  jungle: { id: 'rumble', name: 'Rumble', color: '#e2553a' },
  galaxy: { id: 'comet', name: 'Comet', color: '#b06bff' }
};
// How every cartoon dog looks: fur, muzzle and ear colours, ear shape, collar and markings.
export const DOGS = {
  biscuit: { fur: '#f3c56d', muzzle: '#fff4dc', ear: '#d6953a', ears: 'floppy', collar: '#2274dd' },
  pepper: { fur: '#fbfaf6', muzzle: '#ffffff', ear: '#2d2d36', ears: 'floppy', collar: '#dd2b2b', patch: '#2d2d36', spots: '#2d2d36' },
  waffle: { fur: '#8d96aa', muzzle: '#ffffff', ear: '#5c6479', ears: 'pointy', collar: '#ffc21a', eyes: '#3d8fe0' },
  bruno: { fur: '#b97a41', muzzle: '#fff1dc', ear: '#7a4a22', ears: 'floppy', collar: '#28424a', crown: true },
  frosty: { fur: '#e3ecf7', muzzle: '#ffffff', ear: '#9fb4d0', ears: 'pointy', collar: '#2f7fe3', eyes: '#3d8fe0', crown: true },
  rumble: { fur: '#4a3f3a', muzzle: '#d39a5c', ear: '#2a2422', ears: 'pointy', collar: '#eb6548', crown: true },
  comet: { fur: '#9c7cf2', muzzle: '#efe6ff', ear: '#6a4fd0', ears: 'pointy', collar: '#3df0c2', spots: '#6a4fd0', crown: true }
};
const SHOP = [...PAINTS, ...TRAILS].filter(item => item.cost);
export const RIVALS = [
  { id: 'biscuit', name: 'Biscuit', color: '#17b3a6', pace: .98, lane: 3.2 },
  { id: 'pepper', name: 'Pepper', color: '#f4efe2', pace: .94, lane: -3.2 },
  { id: 'waffle', name: 'Waffle', color: '#2c9a52', pace: .90, lane: 3.2 }
];
// Control points are [x, z] in metres. Each loop starts at the origin heading +x.
// Hills are [height, bumps per lap, phase]; the start line always stays level.
export const TRACKS = [
  { id: 'beach', name: 'Sunny Beach', blurb: 'Big easy bends by the sea', scale: 1.32, hills: [[6, 2, .6], [3, 5, 2]],
    points: [[0, 0], [60, -8], [112, -45], [122, -105], [85, -150], [25, -142], [-12, -100], [-55, -82], [-102, -102], [-134, -62], [-112, -12], [-60, 4]] },
  { id: 'snow', name: 'Snowy Mountain', blurb: 'Twisty turns in the snow', scale: 1.3, hills: [[10, 2, 1.2], [3.5, 4, 0]],
    points: [[0, 0], [68, 0], [120, -28], [128, -84], [88, -118], [42, -98], [14, -62], [-22, -78], [-48, -124], [-108, -130], [-142, -84], [-116, -34], [-60, -8]] },
  { id: 'jungle', name: 'Jungle Loop', blurb: 'Wiggly roads through the trees', scale: 1.22, hills: [[7, 3, .4], [3.5, 5, 1.7]],
    points: [[0, 0], [56, 4], [102, -20], [108, -72], [74, -104], [78, -154], [32, -184], [-24, -164], [-36, -112], [-82, -92], [-122, -122], [-154, -82], [-128, -30], [-66, -6]] },
  { id: 'galaxy', name: 'Rainbow Galaxy', blurb: 'A rainbow road among the stars', scale: 1.2, hills: [[11, 3, 2.2], [3, 7, .5]],
    points: [[0, 0], [64, -2], [116, -30], [112, -86], [62, -100], [36, -142], [66, -186], [22, -214], [-40, -196], [-58, -144], [-104, -122], [-146, -148], [-176, -102], [-142, -48], [-80, -10]] }
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}
// Turns the control points into samples one metre apart, each with a height, a
// heading (0 faces -z, growing clockwise seen from above) and a signed curvature
// (positive bends right).
export function buildTrack(definition) {
  const pts = definition.points.map(([x, z]) => [x * definition.scale, z * definition.scale]), count = pts.length;
  const dense = [];
  for (let i = 0; i < count; i++) {
    const a = pts[(i + count - 1) % count], b = pts[i], c = pts[(i + 1) % count], e = pts[(i + 2) % count];
    for (let j = 0; j < 48; j++) dense.push([catmull(a[0], b[0], c[0], e[0], j / 48), catmull(a[1], b[1], c[1], e[1], j / 48)]);
  }
  // A few rounds of averaging open up the tightest corners for small hands.
  for (let pass = 0; pass < 3; pass++) {
    const copy = dense.map(p => [p[0], p[1]]), m = dense.length;
    for (let i = 0; i < m; i++) {
      let x = 0, z = 0;
      for (let j = -9; j <= 9; j++) { x += copy[(i + j + m) % m][0]; z += copy[(i + j + m) % m][1]; }
      dense[i][0] = x / 19; dense[i][1] = z / 19;
    }
  }
  const cumulative = [0];
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i], q = dense[(i + 1) % dense.length];
    cumulative.push(cumulative[i] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const total = cumulative[dense.length], n = Math.round(total), step = total / n;
  const xs = new Float64Array(n), zs = new Float64Array(n), ys = new Float64Array(n), hs = new Float64Array(n), ks = new Float64Array(n), slopes = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const target = i * step;
    while (cumulative[j + 1] < target) j++;
    const p = dense[j], q = dense[(j + 1) % dense.length], t = (target - cumulative[j]) / (cumulative[j + 1] - cumulative[j] || 1);
    xs[i] = p[0] + (q[0] - p[0]) * t; zs[i] = p[1] + (q[1] - p[1]) * t;
    const level = smooth(30, 170, target) * smooth(30, 170, total - target);
    for (const [height, bumps, phase] of definition.hills || []) ys[i] += level * height * (.5 - .5 * Math.cos(Math.PI * 2 * bumps * target / total + phase));
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    hs[i] = Math.atan2(xs[b] - xs[a], -(zs[b] - zs[a]));
    slopes[i] = (ys[b] - ys[a]) / (2 * step);
  }
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) raw[i] = angleDelta(hs[(i + 1) % n], hs[(i + n - 1) % n]) / (2 * step);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -4; j <= 4; j++) sum += raw[(i + j + n) % n];
    ks[i] = sum / 9;
  }
  // The straightest stretches host the tunnel, the two jump ramps and the loop.
  const bend = s => { let worst = 0; for (let i = -10; i <= 55; i++) worst = Math.max(worst, Math.abs(ks[((Math.round(s / step) + i) % n + n) % n])); return worst; };
  const options = [], chosen = [];
  for (let s = 100; s < total - 110; s += 5) options.push({ s, bend: bend(s) });
  options.sort((a, b) => a.bend - b.bend);
  for (let gap = 150; chosen.length < 4 && gap > 60; gap -= 15) {
    chosen.length = 0;
    for (const option of options) {
      if (chosen.every(c => Math.abs(c - option.s) > gap)) chosen.push(option.s);
      if (chosen.length === 4) break;
    }
  }
  const ramps = chosen.slice(1, 3).sort((a, b) => a - b);
  return { id: definition.id, name: definition.name, length: total, n, step, xs, zs, ys, hs, ks, slopes,
    tunnel: { s: chosen[0], length: TUNNEL_LENGTH }, ramps, mega: ramps[1], loop: { s: chosen[3] + LOOP.lead } };
}
const cache = new Map();
export function getTrack(id) {
  const definition = TRACKS.find(t => t.id === id) || TRACKS[0];
  if (!cache.has(definition.id)) cache.set(definition.id, buildTrack(definition));
  return cache.get(definition.id);
}
export function trackPose(track, d, lat = 0) {
  const s = ((d % track.length) + track.length) % track.length, f = s / track.step;
  const i = Math.floor(f) % track.n, j = (i + 1) % track.n, t = f - Math.floor(f);
  const heading = track.hs[i] + angleDelta(track.hs[j], track.hs[i]) * t, mix = (a) => a[i] + (a[j] - a[i]) * t;
  // The driver's right-hand side is (cos heading, sin heading).
  return { x: mix(track.xs) + Math.cos(heading) * lat, y: mix(track.ys), z: mix(track.zs) + Math.sin(heading) * lat, heading, k: mix(track.ks), slope: mix(track.slopes) };
}
// How far round the loop a car is (0 to 1), or -1 when it is on ordinary road.
export function loopPhase(track, d) {
  const s = ((d % track.length) + track.length) % track.length, t = (s - track.loop.s) / LOOP.ground;
  return t > 0 && t < 1 ? t : -1;
}
export const loopLane = t => (t * 2 - 1) * LOOP.lane;
// Where a car is in the world, with the way it faces and which way is up for it.
// On the road that follows the slope; in the loop it goes right over the top.
export function trackFrame(track, d, lat = 0) {
  const pose = trackPose(track, d, lat), t = loopPhase(track, d), fx = Math.sin(pose.heading), fz = -Math.cos(pose.heading);
  if (t < 0) {
    const n = Math.hypot(1, pose.slope);
    return { ...pose, fx: fx / n, fy: pose.slope / n, fz: fz / n, ux: -fx * pose.slope / n, uy: 1 / n, uz: -fz * pose.slope / n, loop: -1 };
  }
  const start = trackPose(track, track.loop.s, 0), sx = Math.sin(start.heading), sz = -Math.cos(start.heading), a = t * Math.PI * 2, R = LOOP.radius, turn = R * Math.PI * 2;
  let tx = fx * LOOP.ground + sx * turn * Math.cos(a), ty = pose.slope * LOOP.ground + turn * Math.sin(a), tz = fz * LOOP.ground + sz * turn * Math.cos(a);
  const length = Math.hypot(tx, ty, tz); tx /= length; ty /= length; tz /= length;
  let ux = -sx * Math.sin(a), uy = Math.cos(a), uz = -sz * Math.sin(a);
  const lean = ux * tx + uy * ty + uz * tz; ux -= tx * lean; uy -= ty * lean; uz -= tz * lean;
  const tall = Math.hypot(ux, uy, uz);
  return { ...pose, x: pose.x + sx * R * Math.sin(a), y: pose.y + R * (1 - Math.cos(a)), z: pose.z + sz * R * Math.sin(a), fx: tx, fy: ty, fz: tz, ux: ux / tall, uy: uy / tall, uz: uz / tall, loop: t };
}
export function distanceToTrack(track, x, z, stride = 3) {
  let best = Infinity;
  for (let i = 0; i < track.n; i += stride) best = Math.min(best, Math.hypot(track.xs[i] - x, track.zs[i] - z));
  return best;
}

/* ---------- saved choices, coins and unlocks ---------- */
export function normalizePrefs(raw) {
  let saved = raw;
  if (typeof raw === 'string') { try { saved = JSON.parse(raw); } catch { saved = null; } }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const owned = Array.isArray(saved.owned) ? SHOP.filter(item => saved.owned.includes(item.id)).map(item => item.id) : [];
  const pick = (list, id) => (list.find(item => item.id === id && (!item.cost || owned.includes(id))) || list[0]).id;
  const cups = {};
  for (const track of TRACKS) { const cup = saved.cups && typeof saved.cups === 'object' ? saved.cups[track.id] : 0; if (cup === 1 || cup === 2) cups[track.id] = cup; }
  for (const track of TRACKS) { const cup = saved.cups && typeof saved.cups === 'object' ? saved.cups[track.id] : 0; if (cup === 3) cups[track.id] = 3; }
  const won = Object.keys(cups).length, car = CARS.find(c => c.id === saved.car && c.cups <= won) || CARS[0];
  return {
    car: car.id, paint: pick(PAINTS, saved.paint), track: (TRACKS.find(t => t.id === saved.track) || TRACKS[0]).id, trail: pick(TRAILS, saved.trail),
    coins: Number.isInteger(saved.coins) && saved.coins > 0 ? Math.min(saved.coins, 99999) : 0, owned, cups
  };
}
// Buying never fails loudly: without enough coins the choices come back unchanged.
export function buy(prefs, id) {
  const current = normalizePrefs(prefs), item = SHOP.find(i => i.id === id);
  if (!item || current.owned.includes(id) || current.coins < item.cost) return current;
  return normalizePrefs({ ...current, coins: current.coins - item.cost, owned: [...current.owned, id] });
}
export const carUnlocked = (prefs, car) => car.cups <= Object.keys(prefs.cups).length;
// Every finished race banks its coins and a cup; winning upgrades the cup to gold,
// and beating the track's boss turns it into a crown (3).
export function award(prefs, trackId, place, coins, boss = false) {
  const current = normalizePrefs(prefs);
  if (!TRACKS.some(t => t.id === trackId)) return current;
  const earned = Number.isInteger(coins) && coins > 0 ? coins : 0;
  return normalizePrefs({ ...current, coins: current.coins + earned, cups: { ...current.cups, [trackId]: Math.max(current.cups[trackId] || 0, place === 1 ? (boss ? 3 : 2) : 1) } });
}
export const nextUnlock = prefs => SHOP.filter(item => !prefs.owned.includes(item.id)).sort((a, b) => a.cost - b.cost)[0] || null;

/* ---------- things on the road ---------- */
const clearOf = (track, s) => track.ramps.every(ramp => s < ramp - 8 || s > ramp + (ramp === track.mega ? 76 : 40)) && (s < track.loop.s - LOOP.lead - 4 || s > track.loop.s + LOOP.ground + 8);
export function starsFor(track) {
  const lanes = [0, 3.6, -3.6, 0, -3.6, 3.6], count = Math.floor((track.length - 60) / 62);
  return Array.from({ length: count }, (_, i) => ({ s: 50 + i * 62, lat: lanes[i % lanes.length], taken: false }))
    // Nothing to collect where the car is flying off a ramp or going round the loop.
    .filter(star => clearOf(track, star.s));
}
// Zoom strips are painted on the road between the stars: driving over one gives a short boost.
export function padsFor(track) {
  const lanes = [-3.4, 3.4, 0], pads = [];
  for (let s = 81, i = 0; s < track.length - 60; s += 124) if (clearOf(track, s - 6) && clearOf(track, s + 6)) pads.push({ s, lat: lanes[i++ % lanes.length], last: -9 });
  return pads;
}
export function coinsFor(track) {
  const coins = [], stars = starsFor(track), lanes = [-4, 0, 4, 0];
  // Rows of five on the road, weaving between lanes ...
  for (let row = 0, s = 24; s < track.length - 30; s += 58, row++) {
    if (!clearOf(track, s - 14) || !clearOf(track, s + 14) || stars.some(star => Math.abs(star.s - s - 6) < 13)) continue;
    for (let i = 0; i < 5; i++) coins.push({ s: s + i * 3, lat: lanes[row % lanes.length], air: false, taken: false });
  }
  // ... and an arc of five to grab in mid-air over each ramp.
  for (const ramp of track.ramps) {
    const mega = ramp === track.mega, count = mega ? 9 : 5, gap = mega ? 6 : 4.5;
    for (let i = 0; i < count; i++) coins.push({ s: ramp + 4 + i * gap, lat: 0, air: true, taken: false });
  }
  // ... and a ring of eight all the way round the loop.
  for (let i = 1; i <= 8; i++) coins.push({ s: track.loop.s + LOOP.ground * i / 9, lat: loopLane(i / 9), air: false, loop: true, taken: false });
  return coins;
}
export function createRace(trackId, options = {}) {
  const track = getTrack(trackId), boss = options.boss ? BOSSES[track.id] : null;
  const car = (id, name, d, lat, extra = {}) => ({ id, name, player: false, d, lat, speed: 0, steer: 0, slide: 0, boost: 0, air: 0, airTime: AIR_SECONDS, nitro: 0, nitroHeld: false, drift: 0, driftDir: 0, finished: false, finishTime: null, ...extra });
  // Viaan starts at the back of the grid so there is always someone to catch.
  const cars = boss
    ? [car('viaan', 'Viaan', -13, -3.2, { player: true, nitro: NITRO_COST }), car(boss.id, boss.name, -6, 3.2, { pace: 1, lane: 3.2, wobble: 1, boss: true })]
    : [car('viaan', 'Viaan', -24, -3.2, { player: true }), ...RIVALS.map((r, i) => car(r.id, r.name, -6 - i * 6, r.lane, { pace: r.pace, lane: r.lane, wobble: i * 2.1 }))];
  return { trackId: track.id, track, boss: !!boss, phase: 'countdown', countdown: 3, time: 0, cars, stars: starsFor(track), coins: coinsFor(track), pads: padsFor(track), collected: 0, finishOrder: [], bumped: {}, passed: '', lastPass: 0 };
}
export const playerOf = race => race.cars[0];
export const lapOf = (race, car) => clamp(Math.floor(car.d / race.track.length) + 1, 1, LAPS);
export function standings(race) {
  const done = race.finishOrder.map(id => race.cars.find(c => c.id === id));
  return [...done, ...race.cars.filter(c => !c.finished).sort((a, b) => b.d - a.d)];
}
export const placeOf = (race, id = 'viaan') => standings(race).findIndex(c => c.id === id) + 1;

// Rivals wait for a driver who is behind and hurry after one who is ahead.
export function rubberBand(gap) {
  return gap > 0 ? 1 - .5 * clamp(gap / 50, 0, 1) : 1 + .12 * clamp(-gap / 80, 0, 1);
}
// Ramps launch any car that reaches them at speed. Returns 'jump', 'land' or null.
function fly(race, car, before, dt) {
  const length = race.track.length;
  if (car.air > 0) { car.air = Math.max(0, car.air - dt); return car.air ? null : 'land'; }
  if (car.finished || car.speed < 12) return null;
  const ramp = race.track.ramps.find(s => Math.floor((car.d - s) / length) > Math.floor((before - s) / length));
  if (ramp === undefined) return null;
  car.airTime = car.air = ramp === race.track.mega ? MEGA_AIR : AIR_SECONDS;
  return ramp === race.track.mega ? 'megajump' : 'jump';
}
// The loop and its lead-in steer every car into the loop's lane. Returns the loop phase.
function loopGuide(race, car, dt) {
  const length = race.track.length, s = ((car.d % length) + length) % length, t = loopPhase(race.track, car.d);
  const leading = s > race.track.loop.s - LOOP.lead && s <= race.track.loop.s;
  if (t >= 0 || leading) car.lat += ((t >= 0 ? loopLane(t) : -LOOP.lane) - car.lat) * ease(t >= 0 ? 9 : 3, dt);
  if (t >= 0) car.speed = Math.max(car.speed, 20);
  return t >= 0 ? t : leading ? -2 : -1;
}
// A boss keeps closer than the friends do and never gets far ahead.
export function bossBand(gap) {
  return gap > 0 ? 1 - .38 * clamp(gap / 70, 0, 1) : 1 + .05 * clamp(-gap / 60, 0, 1);
}
function stepPlayer(race, car, input, dt) {
  const pose = trackPose(race.track, car.d, car.lat), before = car.d, flying = car.air > 0, notes = [];
  // A bare number is a steering value with the gas held, as the first version of the game worked.
  const pad = input && typeof input === 'object' ? input : { steer: input, gas: true };
  const guided = loopGuide(race, car, dt), looping = guided >= 0;
  if (looping && !car.looping && !car.finished) notes.push('loop');
  car.looping = looping;
  const steering = car.finished ? clamp(-car.lat * .4, -1, 1) : guided !== -1 ? 0 : clamp(Number(pad.steer) || 0, -1, 1);
  car.steer += (steering - car.steer) * ease(10, dt);
  const offRoad = Math.abs(car.lat) > HALF_ROAD && !looping;
  // The nitro button spends one third of the tank on a burst.
  if (pad.nitro && !car.nitroHeld && !car.finished) {
    if (car.nitro >= NITRO_COST - 1e-9) { car.nitro -= NITRO_COST; car.boost = Math.max(car.boost, NITRO_SECONDS); notes.push('nitro'); }
    else notes.push('empty');
  }
  car.nitroHeld = !!pad.nitro;
  const top = (offRoad ? GRASS : CRUISE) + (car.boost > 0 ? BOOST : 0), braking = !!pad.brake && !car.finished;
  const target = car.finished ? 9 : braking ? 0 : pad.gas || car.boost > 0 ? top : 0;
  if (!flying) car.speed += (target - car.speed) * ease(braking ? 3.2 : target > car.speed ? .9 : pad.gas || car.finished ? 2.6 : .45, dt);
  if (looping) car.speed = Math.max(car.speed, 20);
  car.boost = Math.max(0, car.boost - dt);
  // Holding a turn through a corner charges a drift; letting go spends it as a boost.
  const dir = car.finished || Math.abs(steering) < .6 ? 0 : Math.sign(steering), grips = !offRoad && !flying && !looping && car.speed > 18;
  if (dir && dir === car.driftDir && grips) {
    if (dir === Math.sign(pose.k) && Math.abs(pose.k) > .008) {
      const was = car.drift; car.drift += dt;
      if (was < DRIFT_SMALL && car.drift >= DRIFT_SMALL) notes.push('drift');
      if (was < DRIFT_BIG && car.drift >= DRIFT_BIG) notes.push('drift2');
    }
  } else {
    if (grips && car.drift >= DRIFT_SMALL) { car.boost = Math.max(car.boost, car.drift >= DRIFT_BIG ? 1.6 : .9); car.nitro = Math.min(1, car.nitro + (car.drift >= DRIFT_BIG ? .34 : .17)); notes.push('turbo'); }
    car.drift = 0; car.driftDir = dir;
  }
  // Corners push the car gently outward; steering into the bend holds the line.
  const push = car.finished || flying || guided !== -1 ? 0 : clamp(pose.k * car.speed * car.speed * .12, -3.2, 3.2);
  car.slide = car.steer * 9 * clamp(car.speed / CRUISE, .25, 1.2) * (flying ? .4 : car.drift > .3 ? .55 : 1) - push - (offRoad && !flying ? Math.sign(car.lat) * 2.2 : 0);
  car.lat = clamp(car.lat + car.slide * dt, -EDGE, EDGE);
  car.d += car.speed * dt * (looping ? LOOP.pace : 1 / clamp(1 - pose.k * car.lat, .6, 1.6));
  const wasLap = Math.floor(before / race.track.length), air = fly(race, car, before, dt);
  if (air) notes.push(air);
  return { lap: wasLap >= 0 && Math.floor(car.d / race.track.length) > wasLap, notes };
}
function stepRival(race, car, player, dt) {
  const pose = trackPose(race.track, car.d, car.lat), start = car.d;
  const wish = car.finished ? car.lane : car.lane + 1.6 * Math.sin(car.d * .013 + car.wobble);
  const before = car.lat, guided = loopGuide(race, car, dt);
  if (guided === -1) car.lat = clamp(car.lat + clamp(wish - car.lat, -1, 1) * 3.5 * dt, -HALF_ROAD + 1.3, HALF_ROAD - 1.3);
  car.slide = guided >= 0 ? 0 : (car.lat - before) / (dt || 1); car.steer = clamp(car.slide / 4, -1, 1);
  const band = car.boss ? bossBand : rubberBand, target = car.finished ? 9 : CRUISE * car.pace * (player.finished ? 1 : band(car.d - player.d));
  if (!(car.air > 0)) car.speed += (target - car.speed) * ease(target > car.speed ? .9 : 1.6, dt);
  if (guided >= 0) car.speed = Math.max(car.speed, 20);
  car.d += car.speed * dt * (guided >= 0 ? LOOP.pace : 1 / clamp(1 - pose.k * car.lat, .6, 1.6));
  fly(race, car, start, dt);
}
function softBumps(race, dt, events) {
  for (let i = 0; i < race.cars.length; i++) for (let j = i + 1; j < race.cars.length; j++) {
    const a = race.cars[i], b = race.cars[j], along = a.d - b.d, across = a.lat - b.lat;
    if (Math.abs(along) > 4.6 || Math.abs(across) > 2.5 || loopPhase(race.track, a.d) >= 0 || loopPhase(race.track, b.d) >= 0) continue;
    const key = a.id + b.id, side = across === 0 ? (i % 2 ? 1 : -1) : Math.sign(across), push = 7 * dt;
    // Cars slide apart sideways; the one behind eases off. Nobody spins or stops.
    a.lat = clamp(a.lat + side * push * (a.player ? .5 : 1), -EDGE, EDGE);
    b.lat = clamp(b.lat - side * push * (b.player ? .5 : 1), -EDGE, EDGE);
    const behind = along < 0 ? a : b;
    behind.speed = Math.max(8, behind.speed - 7 * dt);
    // One bump sound per touch, even while the two cars jostle for a moment.
    if ((a.player || b.player) && race.time - (race.bumped[key] ?? -9) > 2) events.push('bump');
    if (a.player || b.player) race.bumped[key] = race.time;
  }
}
// Advances the race and returns the names of things that just happened.
export function stepRace(race, input, elapsed) {
  const dt = clamp(Number(elapsed) || 0, 0, .05), events = [];
  if (race.phase === 'countdown') {
    const before = Math.ceil(race.countdown);
    race.countdown -= dt;
    if (race.countdown <= 0) { race.phase = 'racing'; events.push('go'); }
    else if (Math.ceil(race.countdown) < before) events.push('count');
    return events;
  }
  race.time += dt;
  const player = playerOf(race), length = race.track.length, finishLine = LAPS * length, placeBefore = placeOf(race);
  const moved = stepPlayer(race, player, input, dt);
  events.push(...moved.notes);
  if (moved.lap && player.d < finishLine) {
    for (const item of [...race.stars, ...race.coins]) item.taken = false;
    events.push(lapOf(race, player) === LAPS ? 'lastlap' : 'lap');
  }
  for (const car of race.cars) if (!car.player) stepRival(race, car, player, dt);
  softBumps(race, dt, events);
  if (!player.finished && player.d >= 0) {
    const s = ((player.d % length) + length) % length, near = (item, reach) => Math.abs(((s - item.s + length * 1.5) % length) - length / 2) < reach;
    for (const star of race.stars) {
      if (!star.taken && near(star, 3.4) && Math.abs(player.lat - star.lat) < 2.3) { star.taken = true; player.boost = BOOST_SECONDS; player.nitro = Math.min(1, player.nitro + NITRO_COST); events.push('star'); }
    }
    for (const coin of race.coins) {
      if (coin.taken || !near(coin, coin.loop ? 1.2 : 2.8) || Math.abs(player.lat - coin.lat) > (coin.air ? 4 : 2) || (coin.air && !(player.air > 0))) continue;
      coin.taken = true; race.collected++; player.nitro = Math.min(1, player.nitro + .05); events.push('coin');
    }
    for (const pad of race.pads) {
      if (player.air > 0 || !near(pad, 3.2) || Math.abs(player.lat - pad.lat) > 2.7 || race.time - pad.last < 1.5) continue;
      pad.last = race.time; player.boost = Math.max(player.boost, PAD_SECONDS); events.push('pad');
    }
  }
  for (const car of race.cars) {
    if (car.finished || car.d < finishLine) continue;
    car.finished = true; car.finishTime = race.time; race.finishOrder.push(car.id);
    if (car.player) { race.phase = 'finished'; events.push('finish'); }
  }
  // Overtaking a friend is worth a cheer, but not in the scramble off the line.
  const place = placeOf(race);
  if (place < placeBefore && !player.finished && race.time > 4 && race.time - race.lastPass > 2.5) {
    race.passed = standings(race)[place].name; race.lastPass = race.time; events.push('pass');
  }
  return events;
}
