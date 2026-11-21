// Where everything in Big City stands. Plain numbers only, so it runs in Node tests; cityscape.js
// draws it. All positions here are measured from City Airport unless a function says otherwise.
//
// The city is a grid of lots on a waterfront. Main Avenue runs north from the runway to the far
// shore, and every star trail in or out of the city follows it (see trailPath in sky.js). The
// City Tour is a loop of streets that never leaves the city. A lot keeps its building unless a
// flight line passes too close, so every trail is a street between buildings, never through one.
import { airportById, worldObstacles, approachFor, CITY, cityEdge } from './airline.js?v=9';
import { RUNWAY, straight, bend, joined } from './flight.js?v=9';

export const TOWER = 5.5;                          // half a building's width
export const AVENUE = 22;                          // Main Avenue's line, the runway's own
// Streets: `wide` ones carry a flight line. Lots sit between them.
export const ROADS_NS = [{ at: -76, wide: 12 }, { at: -40, wide: 7 }, { at: -16, wide: 7 }, { at: AVENUE, wide: 15 }, { at: 58, wide: 7 }, { at: 83, wide: 7 }, { at: 120, wide: 12 }];
export const ROADS_EW = [{ at: -259, wide: 7 }, { at: -212, wide: 12 }, { at: -176, wide: 7 }, { at: -152, wide: 7 }, { at: -128, wide: 7 }, { at: -104, wide: 7 }, { at: -80, wide: 7 }, { at: -56, wide: 7 }, { at: -10, wide: 12 }, { at: 26, wide: 7 }, { at: 50, wide: 7 }];
export const COLUMNS = [-100, -52, -28, -4, 46, 70, 96, 144], ROWS = [-272, -246, -188, -164, -140, -116, -92, -68, -44, 14, 38, 62];
export const STAR_STREET = -80;                    // the city's own stars hang along this street
export const PARK = { x: -40, z: -128, half: 22 };  // Central Park takes four lots, under the big star
export const WHEEL = { x: 150, z: 46, radius: 12.5, top: 30.5 };   // the Ferris wheel on the waterfront
// A departure flies up the avenue and out past the north shore before it turns; an arrival joins the avenue at a gate out at sea.
export const RUN_OUT = 285, GATE = CITY.z0 - 45;
// The middle of the city and how far from it a City Tour may stray before the plane is turned back.
export const LIMITS = { x: (CITY.x0 + CITY.x1) / 2, z: (CITY.z0 + CITY.z1) / 2, radius: 320 };
const noise = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };

// The City Tour: up the avenue, west through downtown, down the west side, east past the airport,
// down the east side to the harbour, and back up the avenue's line to where the landing begins.
// Given in the city's own coordinates; `tourPath` moves it into the world.
function tourParts() {
  const north = 0, east = Math.PI / 2, south = Math.PI, west = -Math.PI / 2, quarter = Math.PI / 2, end = approachFor('city')[0], city = airportById('city');
  const land = { x: end.x - city.x, z: end.z - city.z };
  return [
    straight(AVENUE, RUNWAY.stopZ - 54, north, 148), bend(AVENUE, -176, north, -1, quarter),            // up the avenue, left into the top street
    straight(-14, -212, west, 26), bend(-40, -212, west, -1, quarter),                                  // west, then left down the west side
    straight(-76, -176, south, 130), bend(-76, -46, south, -1, quarter),                                // south, then left past the airport
    straight(-40, -10, east, 124), bend(84, -10, east, 1, quarter),                                     // east over the avenue, then right down the east side
    straight(120, 26, south, land.z - 26), bend(120, land.z, south, 1, quarter),                        // south to the harbour, right along the waterfront
    straight(84, land.z + 36, west, 26), bend(58, land.z + 36, west, 1, quarter)                        // west, and right to face up the runway
  ];
}
export function tourPath() {
  const city = airportById('city'), path = joined(tourParts());
  return { length: path.length, at(d) { const p = path.at(d); return { x: p.x + city.x, z: p.z + city.z, heading: p.heading }; } };
}

// Every building, in the world's coordinates: tall `towers` downtown (walls: a plane goes round
// them), low `houses` round the outside (a plane is lifted over them), and the lots left open.
export function cityPlan() {
  const city = airportById('city'), towers = [], houses = [], parks = [], path = joined(tourParts()), keep = TOWER * 1.15 + 9, lines = [];
  for (let d = 0; d <= path.length; d += 3) lines.push(path.at(d));
  for (let z = CITY.z0 - 20; z <= CITY.z1 + 60; z += 4) lines.push({ x: AVENUE, z });
  COLUMNS.forEach((x, i) => ROWS.forEach((z, j) => {
    if (cityEdge(x, z) > -9) return;
    const airport = x > AVENUE - 10 && x < 64 && z > 0, park = Math.abs(x - PARK.x) < PARK.half && Math.abs(z - PARK.z) < PARK.half, wheel = Math.hypot(x - WHEEL.x, z - WHEEL.z) < 26;
    if (airport || wheel) return;
    if (park || lines.some(l => Math.hypot(x - l.x, z - l.z) < keep)) { parks.push({ x: x + city.x, z: z + city.z }); return; }
    // Tallest in the middle of downtown, falling away to houses at the edges and beside the runway.
    const downtown = Math.exp(-(((x + 10) / 78) ** 2 + ((z + 150) / 96) ** 2)), height = 9 + 62 * downtown * (.72 + noise(i, j) * .4), style = Math.floor(noise(j, i) * 6);
    const building = { x: x + city.x, z: z + city.z, half: TOWER, radius: TOWER * 1.15, style };
    if (height > 21 && z < 0) towers.push({ ...building, top: Math.round(height), wall: true }); else houses.push({ ...building, top: 7 + Math.round(noise(i + 3, j) * 5) });
  }));
  return { towers, houses, parks };
}
export const cityTowers = () => cityPlan().towers;
// Everything mapped that a plane must not fly through: the islands' trees and houses, and the city's buildings and wheel.
export function allObstacles(local) { const city = airportById('city'), plan = cityPlan(); return [...worldObstacles(local), ...plan.towers, ...plan.houses, { ...WHEEL, x: WHEEL.x + city.x, z: WHEEL.z + city.z }]; }
