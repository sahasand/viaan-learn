// Pure race rules, shared by the game and headless regression tests.
// Cars live in track coordinates: d is distance driven along the centre line
// (it keeps growing lap after lap) and lat is metres to the right of centre.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

export const LAPS = 3;
export const CRUISE = 26;       // m/s on the road
export const BOOST = 10;        // extra m/s while a star is glowing
export const GRASS = 15;        // m/s off the road
export const HALF_ROAD = 7;     // metres from the centre line to the kerb
export const EDGE = 10.5;       // soft wall: nobody travels further out than this
export const BOOST_SECONDS = 2.4;
export const STORAGE_KEY = 'viaan-racer-v1';

export const PAINTS = [
  { id: 'sunshine', name: 'Sunshine yellow', color: '#f7bf12' },
  { id: 'tangerine', name: 'Tangerine orange', color: '#f5741a' },
  { id: 'cherry', name: 'Cherry red', color: '#dd2b2b' },
  { id: 'bubblegum', name: 'Bubblegum pink', color: '#f2559c' },
  { id: 'ocean', name: 'Ocean blue', color: '#2274dd' },
  { id: 'grape', name: 'Grape purple', color: '#7c4ad6' }
];
export const RIVALS = [
  { id: 'panda', name: 'Panda', color: '#f4efe2', pace: .98, lane: 3.2 },
  { id: 'penguin', name: 'Penguin', color: '#17b3a6', pace: .94, lane: -3.2 },
  { id: 'frog', name: 'Frog', color: '#2c9a52', pace: .90, lane: 3.2 }
];
// Control points are [x, z] in metres. Each loop starts at the origin heading +x.
export const TRACKS = [
  { id: 'beach', name: 'Sunny Beach', blurb: 'Big easy bends by the sea', scale: 1.32,
    points: [[0, 0], [60, -8], [112, -45], [122, -105], [85, -150], [25, -142], [-12, -100], [-55, -82], [-102, -102], [-134, -62], [-112, -12], [-60, 4]] },
  { id: 'snow', name: 'Snowy Mountain', blurb: 'Twisty turns in the snow', scale: 1.3,
    points: [[0, 0], [68, 0], [120, -28], [128, -84], [88, -118], [42, -98], [14, -62], [-22, -78], [-48, -124], [-108, -130], [-142, -84], [-116, -34], [-60, -8]] },
  { id: 'jungle', name: 'Jungle Loop', blurb: 'Wiggly roads through the trees', scale: 1.22,
    points: [[0, 0], [56, 4], [102, -20], [108, -72], [74, -104], [78, -154], [32, -184], [-24, -164], [-36, -112], [-82, -92], [-122, -122], [-154, -82], [-128, -30], [-66, -6]] }
];

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3);
}
// Turns the control points into samples one metre apart, each with a heading
// (0 faces -z, growing clockwise seen from above) and a signed curvature
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
  const xs = new Float64Array(n), zs = new Float64Array(n), hs = new Float64Array(n), ks = new Float64Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const target = i * step;
    while (cumulative[j + 1] < target) j++;
    const p = dense[j], q = dense[(j + 1) % dense.length], t = (target - cumulative[j]) / (cumulative[j + 1] - cumulative[j] || 1);
    xs[i] = p[0] + (q[0] - p[0]) * t; zs[i] = p[1] + (q[1] - p[1]) * t;
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    hs[i] = Math.atan2(xs[b] - xs[a], -(zs[b] - zs[a]));
  }
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) raw[i] = angleDelta(hs[(i + 1) % n], hs[(i + n - 1) % n]) / (2 * step);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -4; j <= 4; j++) sum += raw[(i + j + n) % n];
    ks[i] = sum / 9;
  }
  return { id: definition.id, name: definition.name, length: total, n, step, xs, zs, hs, ks };
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
  const heading = track.hs[i] + angleDelta(track.hs[j], track.hs[i]) * t;
  const x = track.xs[i] + (track.xs[j] - track.xs[i]) * t, z = track.zs[i] + (track.zs[j] - track.zs[i]) * t;
  // The driver's right-hand side is (cos heading, sin heading).
  return { x: x + Math.cos(heading) * lat, z: z + Math.sin(heading) * lat, heading, k: track.ks[i] + (track.ks[j] - track.ks[i]) * t };
}
export function distanceToTrack(track, x, z, stride = 3) {
  let best = Infinity;
  for (let i = 0; i < track.n; i += stride) best = Math.min(best, Math.hypot(track.xs[i] - x, track.zs[i] - z));
  return best;
}

export function normalizePrefs(raw) {
  let saved = raw;
  if (typeof raw === 'string') { try { saved = JSON.parse(raw); } catch { saved = null; } }
  const ok = saved && typeof saved === 'object' && !Array.isArray(saved);
  return {
    paint: ok && PAINTS.some(p => p.id === saved.paint) ? saved.paint : PAINTS[0].id,
    track: ok && TRACKS.some(t => t.id === saved.track) ? saved.track : TRACKS[0].id
  };
}

export function starsFor(track) {
  const lanes = [0, 3.6, -3.6, 0, -3.6, 3.6], count = Math.floor((track.length - 60) / 62);
  return Array.from({ length: count }, (_, i) => ({ s: 50 + i * 62, lat: lanes[i % lanes.length], taken: false }));
}
export function createRace(trackId) {
  const track = getTrack(trackId);
  const car = (id, name, d, lat, extra = {}) => ({ id, name, player: false, d, lat, speed: 0, steer: 0, slide: 0, boost: 0, finished: false, finishTime: null, ...extra });
  // Viaan starts at the back of the grid so there is always someone to catch.
  const cars = [
    car('viaan', 'Viaan', -24, -3.2, { player: true }),
    ...RIVALS.map((r, i) => car(r.id, r.name, -6 - i * 6, r.lane, { pace: r.pace, lane: r.lane, wobble: i * 2.1 }))
  ];
  return { trackId: track.id, track, phase: 'countdown', countdown: 3, time: 0, cars, stars: starsFor(track), finishOrder: [], bumped: {} };
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
function stepPlayer(race, car, input, dt) {
  const pose = trackPose(race.track, car.d, car.lat), wasLap = Math.floor(car.d / race.track.length);
  const steering = car.finished ? clamp(-car.lat * .4, -1, 1) : clamp(Number(input) || 0, -1, 1);
  car.steer += (steering - car.steer) * ease(10, dt);
  const offRoad = Math.abs(car.lat) > HALF_ROAD;
  let target = car.finished ? 9 : (offRoad ? GRASS : CRUISE) + (car.boost > 0 ? BOOST : 0);
  car.speed += (target - car.speed) * ease(target > car.speed ? .9 : 2.6, dt);
  car.boost = Math.max(0, car.boost - dt);
  // Corners push the car gently outward; steering into the bend holds the line.
  const drift = car.finished ? 0 : clamp(pose.k * car.speed * car.speed * .12, -3.2, 3.2);
  car.slide = car.steer * 9 * clamp(car.speed / CRUISE, .25, 1.2) - drift - (offRoad ? Math.sign(car.lat) * 2.2 : 0);
  car.lat = clamp(car.lat + car.slide * dt, -EDGE, EDGE);
  car.d += car.speed * dt / clamp(1 - pose.k * car.lat, .6, 1.6);
  return wasLap >= 0 && Math.floor(car.d / race.track.length) > wasLap;
}
function stepRival(race, car, player, dt) {
  const pose = trackPose(race.track, car.d, car.lat);
  const wish = car.finished ? car.lane : car.lane + 1.6 * Math.sin(car.d * .013 + car.wobble);
  const before = car.lat;
  car.lat = clamp(car.lat + clamp(wish - car.lat, -1, 1) * 3.5 * dt, -HALF_ROAD + 1.3, HALF_ROAD - 1.3);
  car.slide = (car.lat - before) / (dt || 1); car.steer = clamp(car.slide / 4, -1, 1);
  const target = car.finished ? 9 : CRUISE * car.pace * (player.finished ? 1 : rubberBand(car.d - player.d));
  car.speed += (target - car.speed) * ease(target > car.speed ? .9 : 1.6, dt);
  car.d += car.speed * dt / clamp(1 - pose.k * car.lat, .6, 1.6);
}
function softBumps(race, dt, events) {
  for (let i = 0; i < race.cars.length; i++) for (let j = i + 1; j < race.cars.length; j++) {
    const a = race.cars[i], b = race.cars[j], along = a.d - b.d, across = a.lat - b.lat;
    if (Math.abs(along) > 4.6 || Math.abs(across) > 2.5) continue;
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
  const player = playerOf(race), length = race.track.length, finishLine = LAPS * length;
  if (stepPlayer(race, player, input, dt) && player.d < finishLine) {
    for (const star of race.stars) star.taken = false;
    events.push(lapOf(race, player) === LAPS ? 'lastlap' : 'lap');
  }
  for (const car of race.cars) if (!car.player) stepRival(race, car, player, dt);
  softBumps(race, dt, events);
  if (!player.finished) {
    const s = ((player.d % length) + length) % length;
    for (const star of race.stars) {
      if (star.taken || player.d < 0) continue;
      const along = Math.abs(((s - star.s + length * 1.5) % length) - length / 2);
      if (along < 3.4 && Math.abs(player.lat - star.lat) < 2.3) { star.taken = true; player.boost = BOOST_SECONDS; events.push('star'); }
    }
  }
  for (const car of race.cars) {
    if (car.finished || car.d < finishLine) continue;
    car.finished = true; car.finishTime = race.time; race.finishOrder.push(car.id);
    if (car.player) { race.phase = 'finished'; events.push('finish'); }
  }
  return events;
}
