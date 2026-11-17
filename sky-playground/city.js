// Where Big City's towers stand. Plain numbers only, so it runs in Node tests; cityscape.js draws them.
// Main Avenue runs straight through the runway from shore to shore, and every star trail in or
// out of the city follows it (see trailPath in sky.js), so the towers are never in a trail's way.
import { airportById, worldObstacles } from './airline.js?v=6';

export const TOWER = 5.5, BLOCK = 24;              // half a tower's width, and how far apart towers stand
export const AVENUE = 22;                          // Main Avenue's line, the runway's own (in the city's coordinates)
export const CROSS = -4;                           // Cross Street, where the city's own stars hang
export const PARK = { x: -17.5, z: -16 };          // one block is left as a park, under the big star
// How far up the avenue a departure flies before it turns, and where an arrival joins it.
export const RUN_OUT = 94, GATE = -128;
export const COLUMNS = [-65.5, -41.5, -17.5, 6.5, 37.5, 61.5], ROWS = [-64, -40, -16, 8, 32, 56];
// The Ferris wheel by the shore; a plane that meets it is lifted over, as over a tree.
export const WHEEL = { x: 66, z: 30, radius: 12.5, top: 30.5 };
const noise = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };

export function cityPlan() {
  const city = airportById('city'), towers = [], parks = [];
  COLUMNS.forEach((x, i) => ROWS.forEach((z, j) => {
    if (Math.hypot(x / 96, z / 78) > .9) return;
    // No towers on the park, or round the terminal and the end of the runway.
    if (Math.hypot(x - PARK.x, z - PARK.z) < 6 || (x > 22 && z > 20)) { parks.push({ x: x + city.x, z: z + city.z }); return; }
    // Tallest downtown, lower toward the runway end so the landing has an open view.
    const downtown = Math.exp(-((x + 10) ** 2 + (z + 26) ** 2) / (2 * 44 ** 2)), top = Math.round((15 + 44 * downtown + noise(i, j) * 16) * (z > 20 ? .6 : 1));
    // A tower is treated as round, a little wider than its walls. `wall` makes the plane go round it, not over.
    towers.push({ x: x + city.x, z: z + city.z, half: TOWER, radius: TOWER * 1.15, top, wall: true, style: Math.floor(noise(j, i) * 6) });
  }));
  return { towers, parks };
}
export const cityTowers = () => cityPlan().towers;
// Everything mapped that a plane must not fly through: the islands' trees and houses, and the city's towers.
export const allObstacles = local => { const city = airportById('city'); return [...worldObstacles(local), ...cityTowers(), { ...WHEEL, x: WHEEL.x + city.x, z: WHEEL.z + city.z }]; };
