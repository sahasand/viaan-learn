// Pure flight rules, shared by the game and headless regression tests.
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function groundHeight(x, z) {
  const a = Math.atan2(z / 72, x / 90);
  const r = Math.hypot(x / 90, z / 72) / (1 + .055 * Math.sin(a * 3) + .035 * Math.cos(a * 7));
  if (r >= 1.04) return 0;
  const beach = clamp((1.04 - r) * 24, -.8, 2.5);
  const hills = 22 * Math.exp(-((x + 23) ** 2 / 420 + (z + 19) ** 2 / 300))
    + 10 * Math.exp(-((x - 40) ** 2 / 270 + (z + 18) ** 2 / 350));
  return Math.max(0, beach + hills * clamp((1 - r) * 5, 0, 1));
}
export const TRAIL = [
  { x: 22, y: 14, z: 51 }, { x: 18, y: 16, z: 18 },
  { x: -5, y: 23, z: -13 }, { x: -42, y: 20, z: -27 },
  { x: -70, y: 13, z: 0 }
];
export const PICNIC = { x: -52, y: 10, z: 15 };
// Blender airstrip: x=22, z=16..60, surface y=2.76. Wheels extend 1m below the plane.
export const RUNWAY = { x: 22, surface: 2.76, parkedY: 3.76, touchdownZ: 48, stopZ: 26 };
export const AIRPORT_APPROACH = [{ x: 22, y: 18, z: 124 }, { x: 22, y: 12, z: 82 }];
const smoothstep = t => t * t * (3 - 2 * t);
export function runwayLanding(start, seconds, runway = RUNWAY) {
  const glide = clamp(seconds / 5, 0, 1), roll = clamp((seconds - 5) / 6, 0, 1);
  const t = smoothstep(glide);
  return { ...start,
    x: start.x + (runway.x - start.x) * t,
    y: start.y + (runway.parkedY - start.y) * t,
    z: seconds <= 5 ? start.z + (runway.touchdownZ - start.z) * glide
      : runway.touchdownZ + (runway.stopZ - runway.touchdownZ) * (2 * roll - roll * roll),
    heading: start.heading + angleDelta(0, start.heading) * t,
    turn: start.turn * (1 - t), climb: seconds < 5 ? -.22 * Math.sin(glide * Math.PI) : 0,
    speed: seconds < 5 ? (start.z - runway.touchdownZ) / 5 : (runway.touchdownZ - runway.stopZ) / 3 * (1 - roll),
    finished: seconds >= 11 };
}
export function runwayTakeoff(start, seconds, runway = RUNWAY) {
  const t = clamp(seconds / 7, 0, 1), lift = clamp((t - .35) / .65, 0, 1);
  return { ...start, x: runway.x, z: start.z - 50 * t * t,
    y: runway.parkedY + 14 * smoothstep(lift), heading: 0, turn: 0,
    climb: .5 * Math.sin(lift * Math.PI), speed: 100 / 7 * t, finished: seconds >= 7 };
}
export function initialFlight() {
  return { x: 22, y: 14, z: 80, heading: 0, turn: 0, climb: 0, speed: 10, returning: false };
}
export function guidance(state, target) {
  const desired = Math.atan2(target.x - state.x, -(target.z - state.z));
  return { x: clamp(angleDelta(desired, state.heading) * 2.3, -1, 1),
    y: clamp((target.y - state.y) * .30, -1, 1) };
}
export function stepFlight(state, input, elapsed, target = null, obstacles = [], options = {}) {
  const dt = clamp(elapsed, 0, .05), next = { ...state };
  const terrain = options.groundHeight || groundHeight;
  const speed = clamp(options.speed ?? 10, 6, 20), boundary = options.boundary || 165;
  let steer = { x: clamp(input.x, -1, 1), y: clamp(input.y, -1, 1) };
  // Turn gently back toward the island, with hysteresis to avoid boundary chatter.
  next.returning = Math.hypot(state.x, state.z) > (state.returning ? boundary * 120 / 165 : boundary);
  if (next.returning) steer = guidance(state, { x: 0, y: 25, z: 0 });
  else if (target) steer = guidance(state, target);
  const smooth = 1 - Math.exp(-4 * dt);
  next.turn += (steer.x - state.turn) * smooth;
  next.climb += (steer.y - state.climb) * smooth;
  next.heading += next.turn * .88 * dt;
  // Slow down in a tight assisted turn so the guide never circles a missed target.
  next.speed = target ? Math.min(speed, 10) - Math.abs(next.turn) * 4 : speed;
  next.x += Math.sin(next.heading) * next.speed * dt;
  next.z -= Math.cos(next.heading) * next.speed * dt;
  next.y += next.climb * 7 * dt;
  const aheadX = next.x + Math.sin(next.heading) * 8;
  const aheadZ = next.z - Math.cos(next.heading) * 8;
  let floor = terrain(next.x, next.z) + 5.2;
  let aheadFloor = terrain(aheadX, aheadZ) + 5.2;
  for (const o of obstacles) {
    if (Math.hypot(next.x - o.x, next.z - o.z) < o.radius + 2.8) floor = Math.max(floor, o.top + 2);
    if (Math.hypot(aheadX - o.x, aheadZ - o.z) < o.radius + 3.5) aheadFloor = Math.max(aheadFloor, o.top + 3);
  }
  if (next.y < aheadFloor) next.y += (aheadFloor - next.y) * (1 - Math.exp(-3 * dt));
  next.y = clamp(next.y, floor, 48);
  return next;
}
export function touchesTarget(previous, current, target, radius = 5.8) {
  // Segment distance avoids skipping a ring at a low frame rate.
  const dx = current.x - previous.x, dy = current.y - previous.y, dz = current.z - previous.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 ? clamp(((target.x - previous.x) * dx + (target.y - previous.y) * dy + (target.z - previous.z) * dz) / length2, 0, 1) : 0;
  return Math.hypot(previous.x + dx * t - target.x, previous.y + dy * t - target.y, previous.z + dz * t - target.z) < radius;
}
