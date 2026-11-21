// Things to find in the sky and the pilot's star bank, independent of rendering and storage.
import { touchesTarget, TURN, straight, bend, joined } from './flight.js?v=9';
import { AIRPORTS, airportById, airportRunway, approachFor, worldGroundHeight, cityEdge } from './airline.js?v=9';
import { STAR_STREET, PARK, RUN_OUT, GATE, tourPath } from './city.js?v=9';

export const PILOT_KEY = 'viaan-pilot-v1';
export const BOOST_SECONDS = 3;
export const BOOST_SPEED = 1.45;       // a rainbow hoop multiplies the chosen speed
// The planes to choose from. All three are free and fly the same way; they differ in looks and
// sound. `seat` is where the passenger's head shows, `tail` how far behind the middle the trail
// starts, and `view` how much further back the camera sits.
export const PLANE_MODELS = [
  { id: 'toy', name: 'Little Prop', asset: 'toy-plane', seat: [0, .65, .83], tail: 2.2, view: 1, engine: 'prop' },
  { id: 'jumbo', name: 'Big Jumbo', asset: 'jumbo-plane', seat: [0, 1.15, -1.04], tail: 3.4, view: 1.2, engine: 'jet' },
  { id: 'zippy', name: 'Zippy Jet', asset: 'zippy-plane', seat: [0, .58, .21], tail: 2.7, view: 1, engine: 'jet' }
];
// Paints and trails with a cost are unlocked with stars collected while flying.
export const PLANE_PAINTS = [
  { id: 'red', name: 'Cherry red', color: '#f03320' },
  { id: 'blue', name: 'Sky blue', color: '#2f7fe3' },
  { id: 'green', name: 'Frog green', color: '#3fae5a' },
  { id: 'pink', name: 'Bubblegum pink', color: '#f2559c' },
  { id: 'purple', name: 'Grape purple', color: '#8a55e0', cost: 40 },
  { id: 'gold', name: 'Shiny gold', color: '#ffc21a', cost: 100 },
  { id: 'rainbow', name: 'Rainbow', color: '#ff5fa2', cost: 200 }
];
export const PLANE_TRAILS = [
  { id: 'clouds', name: 'Cloud puffs' },
  { id: 'bubbles', name: 'Bubbles', cost: 50 },
  { id: 'ribbon', name: 'Rainbow ribbon', cost: 120 },
  { id: 'hearts', name: 'Hearts', cost: 220 }
];
// Toys are set off with the toy button while flying.
export const PLANE_TOYS = [
  { id: 'horn', name: 'Honk', icon: '📯' },
  { id: 'confetti', name: 'Confetti', icon: '🎉', cost: 25 },
  { id: 'fireworks', name: 'Fireworks', icon: '🎆', cost: 60 },
  { id: 'presents', name: 'Presents', icon: '🎁', cost: 120 }
];
const SHOP = [...PLANE_PAINTS, ...PLANE_TRAILS, ...PLANE_TOYS].filter(item => item.cost);
// Height is the hardest thing for a small pilot to judge, so reach is taller than it is wide.
const REACH = { star: 11, balloon: 9.5, hoop: 10.5 }, TALL = .6;
const VALUE = { star: 1, balloon: 3, hoop: 2 };
export const BIG_STAR = 5, CLOUD_STARS = 2;
// Stars also come from landing, from a passenger's thank-you and from spotting a sea friend.
export const LANDING_STARS = 10, GIFT_STARS = 10, SIGHT_STARS = 5;
export const SHOOTING_STARS = 2;         // for a shooting star seen in the night over Starlight Island
export const ZOOM_PULL = 2;             // a zooming plane pulls stars in from twice as far
export const ZOOM_STARS = 6, ZOOM_MAX = 3;  // stars that fill one zoom, and how many zooms the plane holds
export const WISH_STARS = 3;            // for doing what the passenger asks while the autopilot flies
// Free flying shows one trail leaving each island, a round trip of all five.
const TOUR = ['sunny>snowy', 'snowy>starry', 'starry>jungle', 'jungle>city', 'city>sunny'];
// What is in the sky right now: island things always, and one star trail. On a passenger
// trip that is the trail to the destination; any other route name shows no trail at all.
// With nobody aboard, the autopilot flies the round-trip trail that leaves the island it took off from.
export const tourFrom = id => TOUR.find(leg => leg.startsWith(id + '>')) || '';
export const inSky = (thing, route = '') => !thing.route || (route ? thing.route === route : TOUR.includes(thing.route));

const item = (kind, x, y, z, extra = {}) => ({ kind, x, y, z, value: VALUE[kind], taken: false, route: '', ...extra });
const bigStar = (x, y, z, extra = {}) => item('star', x, y, z, { big: true, value: BIG_STAR, ...extra });
// Everything floats clear of the ground and of mapped trees and buildings.
const lift = (x, z, y, clearance, obstacles) => {
  let floor = Math.max(y, worldGroundHeight(x, z) + clearance);
  for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.radius + 4) floor = Math.max(floor, o.top + 4);
  return floor;
};

// The line a star trail follows: straight ahead off the runway, round a wide bend toward
// the destination, then straight to where its landing begins. Headings are flight headings.
// Big City is different at its end of a trail: a departure flies the length of Main Avenue
// before it bends, and an arrival bends onto the avenue and flies down it to the landing.
export function trailPath(fromId, toId) {
  const runway = airportRunway(fromId), end = approachFor(toId)[0], full = Math.PI * 2, from = airportById(fromId), to = airportById(toId), parts = [];
  const start = { x: runway.x, z: runway.stopZ - 54 };
  if (from.city) { parts.push(straight(start.x, start.z, 0, RUN_OUT)); start.z -= RUN_OUT; }
  // An arrival at the city aims for the avenue's gate, out at sea beyond its far shore.
  const aim = to.city ? { x: end.x, z: to.z + GATE } : end, side = aim.x >= start.x ? 1 : -1;
  const cx = start.x + side * TURN, cz = start.z;
  const bearing = Math.atan2(aim.z - cz, aim.x - cx), spread = Math.acos(Math.min(1, TURN / Math.hypot(aim.x - cx, aim.z - cz)));
  const turned = (((side > 0 ? bearing - spread - Math.PI : -bearing - spread) % full) + full) % full;
  const first = bend(start.x, start.z, 0, side, turned), leave = first.at(first.length), reach = Math.hypot(aim.x - leave.x, aim.z - leave.z);
  parts.push(first);
  if (to.city) {
    // Round the corner at the gate onto the avenue, heading south, then straight down it.
    const off = Math.atan2(Math.sin(Math.PI - leave.heading), Math.cos(Math.PI - leave.heading)), corner = Math.abs(off), cut = TURN * Math.tan(corner / 2);
    const run = straight(leave.x, leave.z, leave.heading, reach - cut), turn = run.at(run.length), round = bend(turn.x, turn.z, leave.heading, off >= 0 ? 1 : -1, corner), down = round.at(round.length);
    parts.push(run, round, straight(down.x, down.z, Math.PI, end.z - down.z));
  } else parts.push(straight(leave.x, leave.z, leave.heading, reach));
  return joined(parts);
}
// A line of stars follows that path, weaving a little so following it feels like play.
// Two rainbow hoops and three balloons sit along the way; the middle and last stars are big ones.
export const routeItems = (fromId, toId, obstacles = []) => itemsAlong(trailPath(fromId, toId), `${fromId}>${toId}`, obstacles);
// The City Tour's trail (see tourPath in city.js). It runs between buildings the whole way, so its hoops and balloons hang on the trail itself.
export const CITY_TOUR = 'city>city';
export const tourItems = (obstacles = []) => itemsAlong(tourPath(), CITY_TOUR, obstacles, false);
function itemsAlong(path, route, obstacles, overSea = true) {
  const count = Math.floor(path.length / 13), items = [];
  const at = (t, side = 0) => {
    const p = path.at(t * path.length), weave = Math.sin(t * Math.PI * 4) * 3.2 * Math.min(1, t * 5, (1 - t) * 5) + side;
    const x = p.x + Math.cos(p.heading) * weave, z = p.z + Math.sin(p.heading) * weave;
    return { x, z, heading: p.heading, y: lift(x, z, 18 + Math.sin(t * Math.PI * 2) * 1.5, 6.5, obstacles) };
  };
  for (let i = 1; i < count; i++) {
    const p = at(i / count), big = i === count - 1 || i === Math.floor(count / 2);
    items.push(big ? bigStar(p.x, p.y, p.z, { route }) : item('star', p.x, p.y, p.z, { route }));
  }
  // Hoops hang over open sea, clear of an island's own ring of stars.
  const atSea = t => { if (!overSea) return true; const p = path.at(t * path.length); return AIRPORTS.every(a => a.city ? cityEdge(p.x - a.x, p.z - a.z) > 40 : Math.hypot(p.x - a.x, p.z - a.z) > 135); };
  const hooped = [];
  for (const tries of [[.25, .3, .2, .35], [.75, .7, .65, .8, .6, .55, .5, .45, .4]]) { const t = tries.find(atSea) ?? tries[0], p = at(t); hooped.push(t); items.push(item('hoop', p.x, p.y, p.z, { route, heading: p.heading })); }
  // Balloons float beside the trail, so they too keep to open sea, apart from each other and clear of a hoop.
  const floated = [];
  [.2, .5, .86].forEach((want, i) => {
    const tries = Array.from({ length: 16 }, (_, k) => want + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * .04).filter(t => t > .08 && t < .94);
    // On a short hop with no sea to spare, the balloon hangs on the trail itself.
    const free = tries.find(t => atSea(t) && floated.every(f => Math.abs(f - t) > .09) && hooped.every(h => Math.abs(h - t) > .045)), t = free ?? want, p = at(t, free === undefined || !overSea ? 0 : i % 2 ? 13 : -13);
    floated.push(t); items.push(item('balloon', p.x, p.y + 3, p.z, { route }));
  });
  return items;
}
// Every island also wears a ring of stars, a few balloons and a big star above its tallest hill.
export function islandItems(airport, obstacles = []) {
  const items = [];
  // Big City's own stars hang along Cross Street between the towers, with the big one over the park.
  if (airport.city) {
    for (let i = 0; i < 12; i++) { const x = airport.x - 66 + i * 15.6, z = airport.z + STAR_STREET; items.push(item('star', x, lift(x, z, 19, 7, obstacles), z, { street: true })); }
    [[-70, 118], [150, 122], [-75, -338], [125, -338]].forEach(([dx, dz], i) => { const x = airport.x + dx, z = airport.z + dz; items.push(item('balloon', x, lift(x, z, 17 + i * 3, 9, obstacles), z)); });   // over the harbour and the north shore
    items.push(bigStar(airport.x + PARK.x, lift(airport.x + PARK.x, airport.z + PARK.z, 21, 9, obstacles), airport.z + PARK.z, { street: true }));
    return items;
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = airport.x + Math.cos(a) * 66, z = airport.z + Math.sin(a) * 54;
    items.push(item('star', x, lift(x, z, 20, 7, obstacles), z));
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .7, x = airport.x + Math.cos(a) * 98, z = airport.z + Math.sin(a) * 82;
    items.push(item('balloon', x, lift(x, z, 17 + i * 3, 9, obstacles), z));
  }
  const x = airport.x - 23, z = airport.z - 19;
  items.push(bigStar(x, lift(x, z, 20, 9, obstacles), z));
  return items;
}
export function buildSky(obstacles = []) {
  const items = AIRPORTS.flatMap(airport => islandItems(airport, obstacles));
  for (const from of AIRPORTS) for (const to of AIRPORTS) if (from !== to) items.push(...routeItems(from.id, to.id, obstacles));
  items.push(...tourItems(obstacles));
  return items;
}
// The helping wing follows the star trail forwards: the nearest star after the last one
// caught. Asking for help late joins the trail where the plane is instead of flying back
// to its start, and a star just missed is left behind rather than circled for.
export function nextOnRoute(items, route, state) {
  if (!route) return null;
  const fx = Math.sin(state.heading), fz = -Math.cos(state.heading), open = [];
  let first = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    const thing = items[i];
    if (thing.route !== route || thing.kind !== 'star') continue;
    if (thing.taken) break;
    first = i; open.push(i);
  }
  // The nearest star wins, so a plane far along joins the trail where it is. But where a trail
  // comes back past itself, the nearest may be many stars ahead: there the order is kept, by
  // charging a little for every star skipped and taking the cheaper one if it is much earlier.
  let near = -1, least = Infinity, cheap = -1, lowest = Infinity;
  for (const i of open) {
    const thing = items[i], dx = thing.x - state.x, dz = thing.z - state.z, far = Math.hypot(dx, dz);
    if (far < 20 && dx * fx + dz * fz < -2) continue;
    if (far <= least) { least = far; near = i; }
    if (far + (i - first) * 3 <= lowest) { lowest = far + (i - first) * 3; cheap = i; }
  }
  return near < 0 ? null : items[near - cheap > 6 ? cheap : near];
}
// Where the autopilot flies next. It keeps a choice until that is caught or flown past.
// On a passenger trip it follows the trail forwards, with a small detour for a balloon
// or island star close ahead; with the trail finished it returns null, and the game
// heads for the landing. When just flying it tours whatever is nearest and easiest to
// turn toward. `avoid` holds things it has given up on.
export function autoTarget(items, route, state, held = null, avoid = null) {
  const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
  const open = thing => !thing.taken && inSky(thing, route) && !avoid?.has(thing);
  const missed = (far, ahead) => far < 20 && ahead < -2;
  if (held && open(held)) {
    const dx = held.x - state.x, dz = held.z - state.z;
    if (!missed(Math.hypot(dx, dz), dx * fx + dz * fz)) return held;
  }
  const lead = route ? nextOnRoute(items, route, state) : null;
  if (route && !lead) return null;
  const limit = lead ? Math.min(30, Math.hypot(lead.x - state.x, lead.z - state.z) + 12) : Infinity;
  let best = lead, least = Infinity;
  for (const thing of items) {
    // On a trip it leaves the stars down Big City's side streets alone, and keeps to the avenue.
    if (!open(thing) || lead && (thing.street || thing.route === route && thing.kind !== 'balloon')) continue;
    const dx = thing.x - state.x, dz = thing.z - state.z, far = Math.hypot(dx, dz), ahead = dx * fx + dz * fz;
    if (missed(far, ahead) || lead && (ahead < 4 || far > limit)) continue;
    // A thing off to one side costs the distance of the turn it takes to face it.
    const cost = far + Math.abs(Math.atan2(dx * fz - dz * fx, ahead)) * 16;
    if (cost < least) { least = cost; best = thing; }
  }
  return best;
}
export function resetSky(items) { for (const thing of items) thing.taken = false; return items; }
// How close the plane must come to catch a thing; fx.js uses it to lean stars toward the plane.
export const reachOf = (thing, pull = 1) => REACH[thing.kind] * pull;
// A pilot who is not steering up or down is eased to the height of the nearest star ahead.
export function starHeight(items, route, state) {
  const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
  let best = null, nearest = 45;
  for (const thing of items) {
    if (thing.taken || thing.kind !== 'star' || !inSky(thing, route)) continue;
    const dx = thing.x - state.x, dz = thing.z - state.z, far = Math.hypot(dx, dz);
    if (far < nearest && dx * fx + dz * fz > 0) { nearest = far; best = thing; }
  }
  return best ? best.y : null;
}
// Every few stars fill one zoom. The plane takes off with one ready.
export const freshZoom = () => ({ ready: 1, stars: 0 });
export function chargeZoom(zoom, earned) {
  const stars = zoom.stars + Math.max(0, earned), ready = Math.min(ZOOM_MAX, zoom.ready + Math.floor(stars / ZOOM_STARS));
  return { ready, stars: ready === ZOOM_MAX ? 0 : stars % ZOOM_STARS };
}
export const spendZoom = zoom => zoom.ready > 0 ? { ...zoom, ready: zoom.ready - 1 } : null;
// Collects everything in the sky that the plane touched while moving from one frame to the next.
export function collectSky(items, previous, current, route = '', pull = 1) {
  const found = [], from = { x: previous.x, y: previous.y * TALL, z: previous.z }, to = { x: current.x, y: current.y * TALL, z: current.z };
  for (const thing of items) {
    if (thing.taken || Math.abs(thing.x - current.x) > 40 || Math.abs(thing.z - current.z) > 40 || !inSky(thing, route)) continue;
    if (touchesTarget(from, to, { x: thing.x, y: thing.y * TALL, z: thing.z }, REACH[thing.kind] * pull)) { thing.taken = true; found.push(thing); }
  }
  return found;
}

/* ---------- the pilot's saved stars, paints and trails ---------- */
export function normalizePilot(raw) {
  let saved = raw;
  if (typeof raw === 'string') { try { saved = JSON.parse(raw); } catch { saved = null; } }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const owned = Array.isArray(saved.owned) ? SHOP.filter(thing => saved.owned.includes(thing.id)).map(thing => thing.id) : [];
  const pick = (list, id) => (list.find(thing => thing.id === id && (!thing.cost || owned.includes(id))) || list[0]).id;
  return { stars: Number.isInteger(saved.stars) && saved.stars > 0 ? Math.min(saved.stars, 99999) : 0, owned, plane: pick(PLANE_MODELS, saved.plane), paint: pick(PLANE_PAINTS, saved.paint), trail: pick(PLANE_TRAILS, saved.trail), toy: pick(PLANE_TOYS, saved.toy), sound: saved.sound === true };
}
export function earnStars(pilot, count) {
  const current = normalizePilot(pilot);
  return Number.isInteger(count) && count > 0 ? normalizePilot({ ...current, stars: current.stars + count }) : current;
}
// Buying never fails loudly: without enough stars the pilot comes back unchanged.
export function buyForPilot(pilot, id) {
  const current = normalizePilot(pilot), thing = SHOP.find(i => i.id === id);
  if (!thing || current.owned.includes(id) || current.stars < thing.cost) return current;
  return normalizePilot({ ...current, stars: current.stars - thing.cost, owned: [...current.owned, id] });
}
// Paints and trails the latest stars have just brought within reach, so the game can say so.
export function nowAffordable(before, after) {
  return SHOP.filter(thing => !after.owned.includes(thing.id) && before.stars < thing.cost && after.stars >= thing.cost);
}
export const pilotOwns = (pilot, thing) => !thing.cost || pilot.owned.includes(thing.id);
