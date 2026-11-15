// Little Dominoes rules: a flat table, dominoes that tip over and knock the next one, and three toys to set off.
// Everything is plain numbers (x across, z deep, angles in radians) so it runs in Node tests as well as the browser.

export const SIZE = { h: 1.5, w: .75, t: .24 };      // tall, wide, thick
export const SPACING = .72;                          // centre to centre along a drawn line
export const AREA = { x: 10, z: 7 };                 // half the play mat
export const LIMIT = 500;
export const STORAGE_KEY = 'viaan-dominoes-v1';
export const PALETTES = [
  { id: 'rainbow', name: 'Rainbow', colours: ['#f2495c', '#ff8a3c', '#ffc93c', '#4fc36b', '#35b6e8', '#5b7cf0', '#a868e8'] },
  { id: 'candy', name: 'Candy', colours: ['#ff6fa5', '#ffa3c4', '#fff1f5', '#8fe0d0', '#ffd66b', '#c39bff', '#ff8f70'] },
  { id: 'ocean', name: 'Ocean', colours: ['#0f6fb5', '#2196d8', '#4fc3e8', '#8fe3ee', '#f4fbff', '#35c9a5', '#1a8f8a'] },
  { id: 'sunset', name: 'Sunset', colours: ['#5b3fa8', '#a044b8', '#e04f8a', '#ff6b5c', '#ff9a4a', '#ffc94a', '#fff0a8'] }
];
// r is the body a domino bumps into. Dominoes cannot be placed closer than r + KEEP to the middle.
export const TOYS = [
  { kind: 'bell', x: 8.4, z: -4.8, r: .6 },
  { kind: 'rocket', x: 8.6, z: 0, r: .6 },
  { kind: 'box', x: 8.4, z: 4.8, r: .6 }
];
export const RUNS = [
  { id: 'snake', name: 'Snake', toys: ['rocket'] },
  { id: 'swirl', name: 'Swirl', toys: ['bell'] },
  { id: 'tree', name: 'Big tree', toys: ['bell', 'rocket', 'box'] }
];

const KEEP = .5, EDGE = .4;
const GRAVITY = 55;      // how hard a leaning domino is pulled over
const PUSH = 2.6;        // turning speed from a finger tap
const PASS = .74;        // share of turning speed handed to the next domino
const SLOWEST = 2;       // a knocked domino never starts slower than this
const DRAG = .6;
const SETTLE = .25;      // seconds without movement before a domino counts as resting
const RISE = .3;         // seconds for one domino to stand back up
const TURN = .85;        // the most a drawn line bends from one domino to the next

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const between = (a, b) => Math.atan2(Math.sin(a) + Math.sin(b), Math.cos(a) + Math.cos(b));

export function createTable() {
  return { dominoes: [], toys: TOYS.map(toy => ({ ...toy, fired: false })), falling: [], clock: 0, down: 0, strokes: 0, hue: 0, rewind: null };
}

// True when two dominoes would sit inside each other. Checked from both dominoes' point of view.
function crowds(ax, az, ayaw, bx, bz) {
  const dx = bx - ax, dz = bz - az, cos = Math.cos(ayaw), sin = Math.sin(ayaw);
  return Math.abs(dx * cos + dz * sin) < .5 && Math.abs(dz * cos - dx * sin) < .68;
}

export function place(table, x, z, yaw, stroke = 0, colour = null) {
  if (table.dominoes.length >= LIMIT || !Number.isFinite(x + z + yaw)) return null;
  if (Math.abs(x) > AREA.x - EDGE || Math.abs(z) > AREA.z - EDGE) return null;
  for (const toy of table.toys) if (Math.hypot(toy.x - x, toy.z - z) < toy.r + KEEP) return null;
  for (const d of table.dominoes) {
    if (Math.hypot(d.x - x, d.z - z) < .5 || crowds(d.x, d.z, d.yaw, x, z) || crowds(x, z, yaw, d.x, d.z)) return null;
  }
  const d = { x, z, yaw, c: colour ?? table.hue++ % 7, stroke, into: yaw, angle: 0, vel: 0, dir: 0, fx: Math.cos(yaw), fz: Math.sin(yaw), targets: [], toy: null, rest: false, flat: false, still: 0, top: -1, started: 0, order: 0, from: 0 };
  table.dominoes.push(d);
  return d;
}

// ---------- drawing a line ----------
export function startStroke(table, x, z) {
  return { id: ++table.strokes, x: clamp(x, -AREA.x + EDGE, AREA.x - EDGE), z: clamp(z, -AREA.z + EDGE, AREA.z - EDGE), last: null, heading: null };
}

// Follow the finger to (x, z), standing a domino up every SPACING. Returns the new dominoes.
// The line turns at most TURN per domino, like a toy car chasing the finger, so even a sharp scribble
// comes out as a bend that keeps knocking on.
export function trace(table, stroke, x, z) {
  const made = [];
  x = clamp(x, -AREA.x + EDGE, AREA.x - EDGE); z = clamp(z, -AREA.z + EDGE, AREA.z - EDGE);
  for (let guard = 0; guard < 60; guard++) {
    const dx = x - stroke.x, dz = z - stroke.z, far = Math.hypot(dx, dz);
    if (far < SPACING) break;
    const wanted = Math.atan2(dz, dx);
    if (stroke.heading === null) {
      // The first domino goes as near the finger as there is room, so a line begun on another line joins it.
      stroke.heading = wanted;
      for (let ahead = 0; ahead < 1.5 && !stroke.last; ahead += .06) {
        stroke.last = place(table, stroke.x + Math.cos(wanted) * ahead, stroke.z + Math.sin(wanted) * ahead, wanted, stroke.id);
      }
      if (stroke.last) { made.push(stroke.last); stroke.x = stroke.last.x; stroke.z = stroke.last.z; continue; }
    }
    const turn = Math.atan2(Math.sin(wanted - stroke.heading), Math.cos(wanted - stroke.heading));
    const yaw = stroke.heading + clamp(turn, -TURN, TURN);
    const nx = stroke.x + Math.cos(yaw) * SPACING, nz = stroke.z + Math.sin(yaw) * SPACING;
    // A finger just behind the line is inside its turning circle: wait for it to move on.
    if (far < 2.2 && Math.hypot(x - nx, z - nz) > far - .1) break;
    stroke.heading = yaw; stroke.x = nx; stroke.z = nz;
    // Turn the one before to face half way round the bend.
    const before = stroke.last && !stroke.last.dir ? stroke.last : null, old = before && before.yaw;
    if (before) before.yaw = between(before.into, yaw);
    const d = place(table, nx, nz, yaw, stroke.id);
    if (d) { made.push(d); stroke.last = d; }
    else { if (before) before.yaw = old; stroke.last = null; }
  }
  return made;
}

// ---------- falling ----------
// Work out what a falling domino will land on: up to three dominoes side by side, and maybe a toy.
function aim(table, d) {
  const found = [];
  for (const o of table.dominoes) {
    if (o === d) continue;
    const rx = o.x - d.x, rz = o.z - d.z, along = rx * d.fx + rz * d.fz, side = rz * d.fx - rx * d.fz;
    if (along < .08 || along > SIZE.h + SIZE.t) continue;
    // Side on, a domino only has to be brushed: this is what lets a branch drawn off a line fall.
    const edgeOn = Math.abs(Math.cos(o.yaw) * d.fx + Math.sin(o.yaw) * d.fz) < .5;
    if (Math.abs(side) > (edgeOn ? 1.05 : SIZE.w * .95)) continue;
    found.push({ o, along, side });
  }
  found.sort((a, b) => a.along - b.along);
  d.targets = [];
  for (const f of found) if (d.targets.length < 3 && d.targets.every(k => Math.abs(k.side - f.side) > SIZE.w * .5)) d.targets.push(f);
  d.toy = null;
  for (const toy of table.toys) {
    const rx = toy.x - d.x, rz = toy.z - d.z, along = rx * d.fx + rz * d.fz, side = Math.abs(rz * d.fx - rx * d.fz);
    if (along > 0 && along < toy.r + SIZE.h * .97 && side < toy.r + .3) d.toy = { toy, at: Math.asin(clamp((along - toy.r - SIZE.t / 2) / SIZE.h, .05, 1)) };
  }
}

function start(table, d, sign, vel) {
  d.dir = sign; d.fx = Math.cos(d.yaw) * sign; d.fz = Math.sin(d.yaw) * sign;
  d.vel = vel; d.angle = 0; d.rest = false; d.flat = false; d.still = 0; d.top = -1;
  d.started = table.clock; d.order = table.down++;
  aim(table, d);
  table.falling.push(d);
}

// The angle at which a falling domino first touches a standing one.
const touch = k => Math.asin(clamp((k.along - SIZE.t) / SIZE.h, 0, 1));

// The furthest a domino can lean right now, given what is in front of it.
function limit(d) {
  let max = Math.PI / 2;
  for (const k of d.targets) {
    const o = k.o;
    let lean;
    if (!o.dir) lean = touch(k);
    else if (o.fx * d.fx + o.fz * d.fz < -.3) lean = Math.asin(clamp((k.along - SIZE.t - SIZE.h * Math.sin(o.angle)) / SIZE.h, 0, 1));   // falling towards each other
    else lean = o.angle + Math.asin(clamp((k.along * Math.cos(o.angle) - SIZE.t) / SIZE.h, -1, 1));                                      // leaning on its back
    max = Math.min(max, lean);
  }
  if (d.toy) max = Math.min(max, d.toy.at);
  return Math.max(max, 0);
}

function knock(table, by, o) {
  const facing = Math.cos(o.yaw) * by.fx + Math.sin(o.yaw) * by.fz;
  // Hit on its thin edge, a domino tips away from whatever hit it.
  const sign = Math.abs(facing) >= .25 ? Math.sign(facing) : ((o.x - by.x) * Math.cos(o.yaw) + (o.z - by.z) * Math.sin(o.yaw) >= 0 ? 1 : -1);
  start(table, o, sign, Math.max(SLOWEST, by.vel * PASS));
  by.vel *= .55;
}

// A finger tap. The domino falls towards a neighbour it can knock over, forwards if it can.
export function push(table, d, events = []) {
  if (table.rewind || !d || d.dir) return false;
  // A fresh fall can set every toy off again, even if the last fall already did.
  if (!table.falling.length) for (const toy of table.toys) toy.fired = false;
  const useful = sign => {
    d.fx = Math.cos(d.yaw) * sign; d.fz = Math.sin(d.yaw) * sign; aim(table, d);
    return d.targets.some(k => !k.o.dir) || Boolean(d.toy && !d.toy.toy.fired);
  };
  start(table, d, useful(1) ? 1 : useful(-1) ? -1 : 1, PUSH);
  events.push({ type: 'push', d });
  return true;
}

export function step(table, dt, events = []) {
  table.clock += dt;
  if (table.rewind) return rise(table, dt, events);
  const list = table.falling;
  if (!list.length) return events;
  for (const d of list) {
    if (d.rest) continue;
    d.vel += (GRAVITY * Math.sin(d.angle + .04) - DRAG * d.vel) * dt;
    d.angle += d.vel * dt;
  }
  // Newest first, so each domino leans on a neighbour that has already moved this step.
  for (let i = list.length - 1; i >= 0; i--) {
    const d = list[i];
    if (d.rest) continue;
    for (const k of d.targets) if (!k.o.dir && d.angle >= touch(k)) { knock(table, d, k.o); events.push({ type: 'click', d: k.o, by: d }); }
    if (d.toy && !d.toy.toy.fired && d.angle >= d.toy.at) { d.toy.toy.fired = true; events.push({ type: 'toy', toy: d.toy.toy, d }); }
    const max = limit(d);
    if (d.angle < max) { d.still = 0; continue; }
    if (!d.flat && max >= Math.PI / 2 - 1e-6) { d.flat = true; events.push({ type: 'flat', d }); }
    d.angle = max; d.vel = Math.min(d.vel, 3);
    d.still = max - d.top < 1e-4 ? d.still + dt : 0; d.top = max;
    if (d.still >= SETTLE) { d.rest = true; d.vel = 0; }
  }
  if (list.every(d => d.rest)) {
    list.length = 0;
    events.push({ type: 'done', down: table.down, standing: table.dominoes.length - table.down });
  }
  return events;
}

// ---------- standing back up ----------
function settle(table) {
  for (const d of table.dominoes) { d.dir = 0; d.angle = 0; d.vel = 0; d.rest = false; d.flat = false; d.targets = []; d.toy = null; d.fx = Math.cos(d.yaw); d.fz = Math.sin(d.yaw); }
  for (const toy of table.toys) toy.fired = false;
  table.falling.length = 0; table.down = 0; table.rewind = null;
}

// Stand every fallen domino up again, the last to fall first, like a film played backwards.
export function standUp(table, instant = false) {
  if (table.rewind || !table.down) return false;
  table.falling.length = 0;
  let first = Infinity, last = -Infinity;
  for (const d of table.dominoes) if (d.dir) { d.from = d.angle; first = Math.min(first, d.started); last = Math.max(last, d.started); }
  const span = Math.max(last - first, 1e-6);
  table.rewind = { t: 0, first, span, ripple: clamp(span * .35, .25, 1.6) };
  if (instant) settle(table);
  return true;
}

function rise(table, dt, events) {
  const r = table.rewind;
  r.t += dt;
  for (const d of table.dominoes) {
    if (!d.dir) continue;
    const u = clamp((r.t - (1 - (d.started - r.first) / r.span) * r.ripple) / RISE, 0, 1);
    d.angle = d.from * (1 - u * u * (3 - 2 * u));
  }
  if (r.t >= r.ripple + RISE) { settle(table); events.push({ type: 'stood' }); }
  return events;
}

export function clear(table) {
  settle(table);
  table.dominoes.length = 0; table.hue = 0;
}

// Take away the line drawn last. Everything else stands back up first.
export function undo(table) {
  if (!table.dominoes.length) return 0;
  settle(table);
  const latest = Math.max(...table.dominoes.map(d => d.stroke)), before = table.dominoes.length;
  table.dominoes = table.dominoes.filter(d => d.stroke !== latest);
  return before - table.dominoes.length;
}

// ---------- ready-made runs ----------
function line(points, x, z) {
  const [ax, az] = points[points.length - 1], steps = Math.max(1, Math.ceil(Math.hypot(x - ax, z - az) / .05));
  for (let i = 1; i <= steps; i++) points.push([ax + (x - ax) * i / steps, az + (z - az) * i / steps]);
}
function arc(points, cx, cz, r, from, to) {
  const steps = Math.max(2, Math.ceil(Math.abs(to - from) * r / .05));
  for (let i = 1; i <= steps; i++) { const a = from + (to - from) * i / steps; points.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
}
function bend(points, x, z, heading, endHeading) {
  const [ax, az] = points[points.length - 1], reach = Math.hypot(x - ax, z - az) * .38;
  const bx = ax + Math.cos(heading) * reach, bz = az + Math.sin(heading) * reach, cx = x - Math.cos(endHeading) * reach, cz = z - Math.sin(endHeading) * reach;
  for (let i = 1; i <= 240; i++) {
    const t = i / 240, u = 1 - t;
    points.push([u * u * u * ax + 3 * u * u * t * bx + 3 * u * t * t * cx + t * t * t * x, u * u * u * az + 3 * u * u * t * bz + 3 * u * t * t * cz + t * t * t * z]);
  }
}
// Walk a fine path and stand a domino every SPACING, each facing along the path.
function spread(points) {
  const out = [];
  let next = 0, walked = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], len = Math.hypot(bx - ax, bz - az);
    while (len > 0 && next <= walked + len) {
      const t = (next - walked) / len;
      out.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bz - az, bx - ax) });
      next += SPACING;
    }
    walked += len;
  }
  return out;
}
// Where a toy's last domino should stand when it arrives heading this way.
const stop = (kind, heading) => { const toy = TOYS.find(t => t.kind === kind); return [toy.x - Math.cos(heading) * (toy.r + KEEP + .05), toy.z - Math.sin(heading) * (toy.r + KEEP + .05)]; };

function snake() {
  const columns = [-8.6, -6, -3.4, -.8, 1.8, 4.4], points = [[columns[0], -5.6]];
  columns.forEach((x, i) => {
    const down = i % 2 === 0, end = down ? 4.6 : -4.6;
    if (i === columns.length - 1) { line(points, x, 1.3); arc(points, x + 1.3, 1.3, 1.3, Math.PI, Math.PI * 1.5); line(points, ...stop('rocket', 0)); return; }
    line(points, x, end);
    arc(points, x + 1.3, end, 1.3, Math.PI, down ? 0 : Math.PI * 2);
  });
  return spread(points);
}

function swirl() {
  const cx = -.5, cz = .9, grow = 1.55 / (Math.PI * 2), bell = TOYS[0], at = a => [cx + (1.15 + grow * a) * Math.cos(a), cz + (1.15 + grow * a) * Math.sin(a)];
  // Leave the swirl where it is already heading straight for the bell.
  let best = 0, bestAim = -2;
  for (let a = Math.PI * 3.5; a <= Math.PI * 5.5; a += .01) {
    const [x, z] = at(a), [nx, nz] = at(a + .01), tx = nx - x, tz = nz - z, bx = bell.x - x, bz = bell.z - z;
    const lined = (tx * bx + tz * bz) / (Math.hypot(tx, tz) * Math.hypot(bx, bz));
    if (lined > bestAim) { bestAim = lined; best = a; }
  }
  const points = [at(0)];
  for (let a = .01; a <= best; a += .01) points.push(at(a));
  const [ex, ez] = points[points.length - 1];
  line(points, ...stop('bell', Math.atan2(bell.z - ez, bell.x - ex)));
  return spread(points);
}

function tree() {
  const out = [];
  const grow = (from, side, x, z, endHeading) => {
    // A new branch starts beside its twin, just in front of the domino that knocks them both.
    const heading = from.yaw + side * .35;
    const points = [[from.x + Math.cos(from.yaw) * SPACING - Math.sin(from.yaw) * side * .42, from.z + Math.sin(from.yaw) * SPACING + Math.cos(from.yaw) * side * .42]];
    bend(points, x, z, heading, endHeading);
    const made = spread(points);
    out.push(...made);
    return made[made.length - 1];
  };
  const trunk = [[-9.2, 0]]; line(trunk, -5.6, 0);
  out.push(...spread(trunk));
  const fork = out[out.length - 1];
  const upper = grow(fork, -1, -1.4, -2.6, 0), lower = grow(fork, 1, -1.4, 2.6, 0);
  grow(upper, -1, ...stop('bell', 0), 0); grow(upper, 1, ...stop('rocket', .5), .5);
  grow(lower, -1, ...stop('rocket', -.5), -.5); grow(lower, 1, ...stop('box', 0), 0);
  return out;
}

export function runSpecs(id) {
  return id === 'snake' ? snake() : id === 'swirl' ? swirl() : id === 'tree' ? tree() : [];
}

// ---------- saving ----------
const round = v => Math.round(v * 1000) / 1000;
export const snapshot = table => table.dominoes.map(d => [round(d.x), round(d.z), round(d.yaw), d.c, d.stroke]);

export function restore(table, list) {
  clear(table);
  for (const [x, z, yaw, c, stroke] of list) place(table, x, z, yaw, stroke, c);
  table.strokes = table.dominoes.reduce((most, d) => Math.max(most, d.stroke), 0);
  table.hue = table.dominoes.length;
  return table;
}

export function normalizeSave(raw) {
  let data = raw;
  if (typeof raw === 'string') { try { data = JSON.parse(raw); } catch { data = null; } }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const dominoes = [];
  if (Array.isArray(data.dominoes)) {
    for (const item of data.dominoes) {
      if (dominoes.length >= LIMIT) break;
      if (!Array.isArray(item) || item.length < 3 || !item.slice(0, 3).every(Number.isFinite)) continue;
      const [x, z, yaw, c, stroke] = item;
      if (Math.abs(x) > AREA.x - EDGE || Math.abs(z) > AREA.z - EDGE || Math.abs(yaw) > 7) continue;
      dominoes.push([x, z, yaw, Number.isInteger(c) && c >= 0 && c < 7 ? c : dominoes.length % 7, Number.isInteger(stroke) && stroke >= 0 && stroke < 1e6 ? stroke : 0]);
    }
  }
  return {
    sound: data.sound === true,
    met: data.met === true,
    palette: Number.isInteger(data.palette) && data.palette >= 0 && data.palette < PALETTES.length ? data.palette : 0,
    toppled: Number.isFinite(data.toppled) ? clamp(Math.floor(data.toppled), 0, 9999999) : 0,
    dominoes
  };
}
