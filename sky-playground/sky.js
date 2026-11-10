// Things to find in the sky and the pilot's star bank, independent of rendering and storage.
import { touchesTarget } from './flight.js';
import { AIRPORTS, airportRunway, approachFor, worldGroundHeight } from './airline.js';

export const PILOT_KEY = 'viaan-pilot-v1';
export const BOOST_SECONDS = 3;
export const BOOST_SPEED = 1.45;       // a rainbow hoop multiplies the chosen speed
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
const SHOP = [...PLANE_PAINTS, ...PLANE_TRAILS].filter(item => item.cost);
const REACH = { star: 5.5, balloon: 5.2, hoop: 7.5 };
const VALUE = { star: 1, balloon: 3, hoop: 2 };

const item = (kind, x, y, z, extra = {}) => ({ kind, x, y, z, value: VALUE[kind], taken: false, route: '', ...extra });
// Everything floats clear of the ground and of mapped trees and buildings.
const lift = (x, z, y, clearance, obstacles) => {
  let floor = Math.max(y, worldGroundHeight(x, z) + clearance);
  for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.radius + 4) floor = Math.max(floor, o.top + 4);
  return floor;
};

// A line of stars leads from the end of the takeoff run to where the landing begins,
// weaving a little so following it feels like play. Two rainbow hoops and three
// balloons sit along the way.
export function routeItems(fromId, toId, obstacles = []) {
  const runway = airportRunway(fromId), end = approachFor(toId)[0], route = `${fromId}>${toId}`;
  const start = { x: runway.x, z: runway.stopZ - 62 }, dx = end.x - start.x, dz = end.z - start.z, length = Math.hypot(dx, dz);
  const nx = -dz / length, nz = dx / length, count = Math.floor(length / 13), items = [];
  const at = (t, side = 0) => {
    const weave = Math.sin(t * Math.PI * 4) * 3.2 * Math.min(1, t * 5, (1 - t) * 5) + side;
    const x = start.x + dx * t + nx * weave, z = start.z + dz * t + nz * weave;
    return { x, z, y: lift(x, z, 18 + Math.sin(t * Math.PI * 2) * 1.5, 6.5, obstacles) };
  };
  for (let i = 1; i < count; i++) { const p = at(i / count); items.push(item('star', p.x, p.y, p.z, { route })); }
  for (const t of [.25, .75]) { const p = at(t); items.push(item('hoop', p.x, p.y, p.z, { route, heading: Math.atan2(dx, -dz) })); }
  [.2, .5, .86].forEach((t, i) => { const p = at(t, i % 2 ? 13 : -13); items.push(item('balloon', p.x, p.y + 3, p.z, { route })); });
  return items;
}
// Every island also wears a ring of stars and a few balloons for free flying.
export function islandItems(airport, obstacles = []) {
  const items = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = airport.x + Math.cos(a) * 66, z = airport.z + Math.sin(a) * 54;
    items.push(item('star', x, lift(x, z, 24, 7, obstacles), z));
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .7, x = airport.x + Math.cos(a) * 98, z = airport.z + Math.sin(a) * 82;
    items.push(item('balloon', x, lift(x, z, 17 + i * 3, 9, obstacles), z));
  }
  return items;
}
export function buildSky(obstacles = []) {
  const items = AIRPORTS.flatMap(airport => islandItems(airport, obstacles));
  for (const from of AIRPORTS) for (const to of AIRPORTS) if (from !== to) items.push(...routeItems(from.id, to.id, obstacles));
  return items;
}
// The helping wing follows the star trail: the next star of this route that is
// still ahead of the plane, so a missed star is left behind rather than circled for.
export function nextOnRoute(items, route, state) {
  if (!route) return null;
  const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
  let started = false;
  for (let i = items.length - 1; i >= 0 && !started; i--) started = items[i].route === route && items[i].kind === 'star' && items[i].taken;
  for (const thing of items) {
    if (thing.route !== route || thing.kind !== 'star' || thing.taken) continue;
    const ahead = (thing.x - state.x) * fx + (thing.z - state.z) * fz;
    // Before the first star is caught the plane may still be turning toward the trail.
    if (ahead > -2 || !started && Math.hypot(thing.x - state.x, thing.z - state.z) > 30) return thing;
  }
  return null;
}
export function resetSky(items) { for (const thing of items) thing.taken = false; return items; }
// Collects everything the plane touched while moving from one frame to the next.
export function collectSky(items, previous, current) {
  const found = [];
  for (const thing of items) {
    if (thing.taken || Math.abs(thing.x - current.x) > 40 || Math.abs(thing.z - current.z) > 40) continue;
    if (touchesTarget(previous, current, thing, REACH[thing.kind])) { thing.taken = true; found.push(thing); }
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
  return { stars: Number.isInteger(saved.stars) && saved.stars > 0 ? Math.min(saved.stars, 99999) : 0, owned, paint: pick(PLANE_PAINTS, saved.paint), trail: pick(PLANE_TRAILS, saved.trail) };
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
export const pilotOwns = (pilot, thing) => !thing.cost || pilot.owned.includes(thing.id);
