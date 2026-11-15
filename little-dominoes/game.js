// Little Dominoes: the scene, the finger drawing, the toys and the camera. The rules live in topple.js.
import * as THREE from 'three';
import { SIZE, AREA, LIMIT, TOYS, PALETTES, RUNS, BLANK, INKS, STORAGE_KEY, createTable, place, startStroke, trace, push, step, standUp, undo, clear, runSpecs, snapshot, restore, normalizeSave } from './topple.js?v=2';
import { createSound } from './audio.js?v=2';

const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = createSound();

let stored = null; try { stored = localStorage.getItem(STORAGE_KEY); } catch {}
const prefs = normalizeSave(stored);
const table = restore(createTable(), prefs.dominoes);
function save() { prefs.dominoes = snapshot(table); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {} }

// ---------- scene ----------
const canvas = $('world');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (error) { $('broken').hidden = false; throw error; }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#f4e8d0');
const camera = new THREE.PerspectiveCamera(34, 1, 1, 260);

scene.add(new THREE.HemisphereLight('#ffffff', '#ecd9b6', 1.2));
const sun = new THREE.DirectionalLight('#fff3dc', 2.1);
sun.position.set(-7, 17, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 2, far: 48 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
scene.add(sun);

const paint = (colour, extra = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: .5, ...extra });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function roundedShape(w, h, r) {
  const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// The floor and the play mat.
{
  const floor = part(scene, new THREE.PlaneGeometry(500, 500), paint('#f1e3c6', { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const dots = document.createElement('canvas'); dots.width = dots.height = 64;
  const g = dots.getContext('2d');
  g.fillStyle = '#d3eedf'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#c2e6d3'; g.beginPath(); g.arc(32, 32, 7, 0, Math.PI * 2); g.fill();
  const texture = new THREE.CanvasTexture(dots);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(.5, .5); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const edge = part(scene, new THREE.ShapeGeometry(roundedShape(AREA.x * 2 + 1.5, AREA.z * 2 + 1.5, 1.6), 12), paint('#9fd2b7', { roughness: 1 }), 0, .012, 0);
  const mat = part(scene, new THREE.ShapeGeometry(roundedShape(AREA.x * 2 + .9, AREA.z * 2 + .9, 1.3), 12), paint('#ffffff', { roughness: 1, map: texture }), 0, .024, 0);
  for (const mesh of [edge, mat]) { mesh.rotation.x = -Math.PI / 2; mesh.castShadow = false; }
}

// ---------- dominoes ----------
function dominoGeometry() {
  const bevel = .035, depth = SIZE.t - bevel * 2;
  const shape = roundedShape(SIZE.w - bevel * 2, SIZE.h - bevel * 2, .07);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  geometry.translate(0, SIZE.h / 2, -depth / 2);     // feet on the floor, thickness centred
  geometry.rotateY(Math.PI / 2);                      // thickness along x, width along z
  return geometry;
}
const dominoMesh = new THREE.InstancedMesh(dominoGeometry(), paint('#ffffff', { roughness: .36 }), LIMIT);
dominoMesh.castShadow = true; dominoMesh.receiveShadow = true; dominoMesh.frustumCulled = false; dominoMesh.count = 0;
scene.add(dominoMesh);

const born = new WeakMap();          // when each domino was stood up, for its little pop
const shades = PALETTES.map(palette => [...palette.colours, '#fbf6ea'].map(colour => new THREE.Color(colour)));
const inks = INKS.map(colour => new THREE.Color(colour));
// How far a domino has turned from its standing colour to its picture colour.
const shown = d => !d.dir ? 0 : table.rewind ? (d.from > 0 ? d.angle / d.from : 0) : clamp((table.clock - d.started) / .22, 0, 1);
const pivot = new THREE.Object3D(); pivot.rotation.order = 'YZX';
const offset = new THREE.Matrix4().makeTranslation(-SIZE.t / 2, 0, 0), matrix = new THREE.Matrix4(), tint = new THREE.Color();
let clock = 0, growing = 0;

// Each domino turns about the bottom edge on the side it is falling towards.
function pose() {
  const list = table.dominoes, colours = shades[prefs.palette];
  dominoMesh.count = list.length;
  growing = 0;
  for (let i = 0; i < list.length; i++) {
    const d = list[i], fx = d.dir ? d.fx : Math.cos(d.yaw), fz = d.dir ? d.fz : Math.sin(d.yaw);
    const age = (clock - (born.get(d) ?? -9)) / .2, size = age >= 1 || reducedMotion ? 1 : 1 + Math.sin(age * Math.PI) * .25 - (1 - age) * (1 - age);
    if (size !== 1) growing++;
    pivot.position.set(d.x + fx * SIZE.t / 2, 0, d.z + fz * SIZE.t / 2);
    pivot.rotation.set(0, Math.atan2(-fz, fx), -d.angle);
    pivot.scale.setScalar(Math.max(size, .05));
    pivot.updateMatrix();
    dominoMesh.setMatrixAt(i, matrix.multiplyMatrices(pivot.matrix, offset));
  }
  dominoMesh.instanceMatrix.needsUpdate = true;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    tint.copy(colours[d.c]);
    if (d.p !== null && d.dir) tint.lerp(inks[d.p], shown(d));
    dominoMesh.setColorAt(i, tint);
  }
  if (dominoMesh.instanceColor) dominoMesh.instanceColor.needsUpdate = true;
}

// ---------- sparkles, smoke and confetti ----------
const SPARKS = 420;
const sparkAt = new Float32Array(SPARKS * 3).fill(-999), sparkColour = new Float32Array(SPARKS * 3);
const sparkMove = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS), sparkFall = new Float32Array(SPARKS);
let sparkNext = 0;
const sparks = (() => {
  const dot = document.createElement('canvas'); dot.width = dot.height = 32;
  const g = dot.getContext('2d'), fade = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  fade.addColorStop(0, '#fff'); fade.addColorStop(.6, '#fff'); fade.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fade; g.fillRect(0, 0, 32, 32);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(sparkAt, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(sparkColour, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: .5, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, alphaTest: .05 }));
  points.frustumCulled = false; scene.add(points);
  return points;
})();
function burst(x, y, z, count, speed, colours, fall = 9, life = 1.2, up = .6) {
  if (reducedMotion) count = Math.ceil(count / 3);
  for (let n = 0; n < count; n++) {
    const i = sparkNext; sparkNext = (sparkNext + 1) % SPARKS;
    const turn = Math.random() * Math.PI * 2, lift = Math.random() * 2 - 1 + up, flat = Math.sqrt(Math.max(0, 1 - Math.min(1, lift * lift))), go = speed * (.4 + Math.random() * .6);
    sparkAt.set([x, y, z], i * 3);
    sparkMove.set([Math.cos(turn) * flat * go, lift * go, Math.sin(turn) * flat * go], i * 3);
    tint.set(colours[n % colours.length]); sparkColour.set([tint.r, tint.g, tint.b], i * 3);
    sparkLife[i] = life * (.6 + Math.random() * .4); sparkFall[i] = fall;
  }
  sparks.geometry.attributes.color.needsUpdate = true;
}
function moveSparks(dt) {
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) continue;
    sparkLife[i] -= dt;
    const j = i * 3;
    if (sparkLife[i] <= 0 || sparkAt[j + 1] < 0) { sparkLife[i] = 0; sparkAt[j + 1] = -999; continue; }
    sparkMove[j + 1] -= sparkFall[i] * dt;
    sparkAt[j] += sparkMove[j] * dt; sparkAt[j + 1] += sparkMove[j + 1] * dt; sparkAt[j + 2] += sparkMove[j + 2] * dt;
  }
  sparks.geometry.attributes.position.needsUpdate = true;
}
const PARTY = ['#f2495c', '#ff8a3c', '#ffc93c', '#4fc36b', '#35b6e8', '#a868e8', '#ffffff'];

// ---------- the three toys ----------
function toyBase(toy, colour) {
  const group = new THREE.Group(); group.position.set(toy.x, 0, toy.z); scene.add(group);
  part(group, new THREE.CylinderGeometry(1.0, 1.06, .1, 40), paint(colour, { roughness: .85 }), 0, .05, 0).castShadow = false;
  return group;
}

function buildBell(toy) {
  const group = toyBase(toy, '#ffd3b5'), wood = paint('#c58a52');
  group.rotation.y = Math.PI / 4;      // turned so the frame reads as a frame from either camera
  for (const z of [-.66, .66]) part(group, new THREE.CylinderGeometry(.085, .11, 2.6, 12), wood, 0, 1.4, z);
  part(group, new THREE.BoxGeometry(.22, .18, 1.7), wood, 0, 2.7, 0);
  const swing = new THREE.Group(); swing.position.set(0, 2.6, 0); group.add(swing);
  const gold = paint('#ffcb2e', { roughness: .32, side: THREE.DoubleSide, emissive: '#8a5200', emissiveIntensity: .35 });
  const outline = [[.02, 0], [.1, -.03], [.18, -.12], [.25, -.38], [.31, -.74], [.44, -1.0], [.53, -1.1]].map(([r, y]) => new THREE.Vector2(r, y));
  part(swing, new THREE.LatheGeometry(outline, 28), gold);
  part(swing, new THREE.SphereGeometry(.1, 14, 10), gold, 0, .02, 0);
  part(swing, new THREE.SphereGeometry(.13, 16, 12), paint('#b9791f'), 0, -1.08, 0);
  let t = -1;
  return {
    fire() { t = 0; sound.bell(); burst(toy.x, 1.7, toy.z, 30, 4.5, ['#ffd84a', '#fff3b0', '#ffffff'], 4, 1.1); },
    reset() { t = -1; swing.rotation.z = 0; },
    update(dt) { if (t < 0) return; t += dt; swing.rotation.z = .8 * Math.sin(t * 9.5) * Math.exp(-t * 1.1); if (t > 5) this.reset(); },
    look: target => target.set(toy.x, 1.5, toy.z)
  };
}

function buildRocket(toy) {
  const group = toyBase(toy, '#dccdf7'), ship = new THREE.Group(); group.add(ship);
  const lathe = (points, colour) => part(ship, new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 28), paint(colour, { roughness: .35, side: THREE.DoubleSide }));
  lathe([[.2, .4], [.33, .72], [.37, 1.2], [.35, 1.75], [.27, 2.12]], '#ffffff');
  lathe([[.27, 2.12], [.21, 2.36], [.11, 2.6], [.01, 2.72]], '#f2495c');
  part(ship, new THREE.CylinderGeometry(.15, .21, .28, 20), paint('#56646b'), 0, .32, 0);
  for (let i = 0; i < 3; i++) {
    const fin = part(ship, new THREE.BoxGeometry(.5, .62, .08), paint('#f2495c', { roughness: .4 }), Math.cos(i * 2.094 + .5) * .43, .43, Math.sin(i * 2.094 + .5) * .43);
    fin.rotation.y = -(i * 2.094 + .5);
  }
  const band = (y, r, colour) => { const ring = part(ship, new THREE.TorusGeometry(r, .05, 10, 32), paint(colour, { roughness: .4 }), 0, y, 0); ring.rotation.x = Math.PI / 2; };
  band(1.5, .365, '#35b6e8'); band(.9, .355, '#ffc93c');
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.2, 1, 16), new THREE.MeshBasicMaterial({ color: '#ffb02e' }));
  flame.rotation.x = Math.PI; flame.position.y = -.3; flame.visible = false; ship.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(.1, .6, 12), new THREE.MeshBasicMaterial({ color: '#fff3a6' }));
  core.position.y = .15; flame.add(core);
  let t = -1, boomed = false;
  return {
    fire() { t = 0; boomed = false; sound.launch(); },
    reset() { t = -1; ship.position.set(0, 0, 0); ship.visible = true; flame.visible = false; },
    update(dt) {
      if (t < 0) return;
      t += dt;
      flame.visible = ship.visible; flame.scale.set(1, .8 + Math.random() * .5, 1);
      if (t > 5.2) ship.position.x = 0;
      else if (t < .6) ship.position.x = reducedMotion ? 0 : Math.sin(t * 70) * .035;
      else { ship.position.x = 0; ship.position.y = 9 * (t - .6) ** 2; }
      if (t < 4 && ship.position.y < 16 && Math.random() < dt * 70) burst(toy.x, ship.position.y + .2, toy.z, 2, 1.8, ['#ffffff', '#efe9f8', '#ffd9a8'], -1.2, 1, -.7);
      if (ship.position.y > 34) ship.visible = false;
      if (!boomed && t > 1.75) {
        boomed = true; sound.boom();
        burst(toy.x, 7.5, toy.z, 70, 7, PARTY, 5, 1.6, 0);
        burst(toy.x - 1.6, 6.2, toy.z + 1.2, 40, 5, ['#ffd84a', '#ffffff', '#ff8a3c'], 5, 1.4, 0);
        burst(toy.x - 1, 6.6, toy.z - 1.6, 40, 5, ['#35b6e8', '#ffffff', '#a868e8'], 5, 1.4, 0);
      }
      // It comes back by itself, ready to go again.
      if (t > 5.2) { const u = Math.min((t - 5.2) / .9, 1); ship.visible = true; flame.visible = false; ship.position.y = 14 * (1 - u) ** 2; }
      if (t > 6.3) this.reset();
    },
    look: target => target.set(toy.x, clamp(ship.visible ? ship.position.y + 1.4 : 5.2, 1.4, 5.2), toy.z)
  };
}

function buildBox(toy) {
  const group = toyBase(toy, '#c6e4f6'), wrap = paint('#ef6a4c', { roughness: .45 }), ribbon = paint('#ffc93c', { roughness: .4 });
  part(group, new THREE.BoxGeometry(1.06, .8, 1.06), wrap, 0, .5, 0);
  part(group, new THREE.BoxGeometry(1.09, .81, .2), ribbon, 0, .5, 0);
  part(group, new THREE.BoxGeometry(.2, .81, 1.09), ribbon, 0, .5, 0);
  // The lid is hinged on the far side, away from the dominoes that arrive.
  const lid = new THREE.Group(); lid.position.set(.58, .9, 0); group.add(lid);
  part(lid, new THREE.BoxGeometry(1.18, .2, 1.18), paint('#d9553a', { roughness: .45 }), -.58, .1, 0);
  part(lid, new THREE.BoxGeometry(1.2, .21, .2), ribbon, -.58, .1, 0);
  part(lid, new THREE.BoxGeometry(.2, .21, 1.2), ribbon, -.58, .1, 0);
  for (const z of [-.15, .15]) part(lid, new THREE.SphereGeometry(.16, 14, 10), ribbon, -.58, .3, z).scale.set(.8, .7, 1.2);
  const balloons = PARTY.slice(0, 6).map((colour, i) => {
    const balloon = part(scene, new THREE.SphereGeometry(.34, 18, 14), paint(colour, { roughness: .25 }));
    balloon.scale.set(1, 1.18, 1); balloon.visible = false; balloon.castShadow = false;
    return { mesh: balloon, wait: i * .13, sway: i * 1.7, drift: (i - 2.5) * .22 };
  });
  let t = -1;
  return {
    fire() { t = 0; sound.party(); burst(toy.x, 1.3, toy.z, 80, 7, PARTY, 9, 1.8, .9); },
    reset() { t = -1; lid.rotation.z = 0; for (const b of balloons) b.mesh.visible = false; },
    update(dt) {
      if (t < 0) return;
      t += dt;
      const open = Math.min(t / .3, 1);
      lid.rotation.z = -1.95 * (1 - (1 - open) ** 3) * (1 - clamp((t - 9.4) / .5, 0, 1));
      for (const b of balloons) {
        const u = t - b.wait;
        b.mesh.visible = u > 0 && u < 9;
        if (!b.mesh.visible) continue;
        const grow = Math.min(u / .35, 1);
        b.mesh.scale.set(grow, grow * 1.18, grow);
        b.mesh.position.set(toy.x + b.drift * u + Math.sin(u * 2 + b.sway) * .25, .9 + u * 2.1, toy.z + Math.cos(u * 1.6 + b.sway) * .3);
      }
      if (t > 10) { t = -1; }
    },
    look: target => target.set(toy.x, 2.4, toy.z)
  };
}

const toyViews = {};
for (const toy of TOYS) toyViews[toy.kind] = toy.kind === 'bell' ? buildBell(toy) : toy.kind === 'rocket' ? buildRocket(toy) : buildBox(toy);
const resetToys = () => { for (const kind in toyViews) toyViews[kind].reset(); };

// ---------- camera ----------
// The whole mat is fitted between the top bar and the tools. On a tall screen the camera looks along the
// mat so the toys are at the far end; on a wide screen it looks across with the toys on the right.
const HIGH = 56 * Math.PI / 180, LOW = 40 * Math.PI / 180;
const view = { back: new THREE.Vector3(0, 0, 1), home: new THREE.Vector3(), distance: 40 };
const v = new THREE.Vector3(), look = new THREE.Vector3(), near = new THREE.Vector3(), focus = new THREE.Vector3(), goal = new THREE.Vector3();
let follow = 0, holdUntil = 0, spread = 0, lastToyAt = -99;
const fired = [];       // toys that went off a moment ago, so the camera can take them all in

function fit() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  view.back.set(h > w ? -1 : 0, 0, h > w ? 0 : 1);
  const bar = document.querySelector('.topbar').getBoundingClientRect(), tools = document.querySelector('.tools').getBoundingClientRect();
  // Leave room for the count, which sits under the top bar on a narrow screen.
  const chip = $('count'), shown = !chip.hidden;
  chip.hidden = false; const counter = chip.getBoundingClientRect(); chip.hidden = !shown;
  const free = { l: 8, t: Math.max(bar.bottom, counter.bottom) + 4, r: w - 8, b: h - 8 };
  if (tools.width > tools.height) free.b = tools.top - 6; else free.l = tools.right + 6;
  const marks = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) marks.push([x * (AREA.x + .75), 0, z * (AREA.z + .75)], [x * (AREA.x - .4), SIZE.h, z * (AREA.z - .4)]);
  for (const toy of TOYS) marks.push([toy.x, 2.9, toy.z]);
  camera.clearViewOffset();
  const boxAt = distance => {
    camera.position.copy(view.back).multiplyScalar(Math.cos(HIGH) * distance).setY(Math.sin(HIGH) * distance);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const m of marks) {
      v.set(...m).project(camera);
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      box.l = Math.min(box.l, x); box.r = Math.max(box.r, x); box.t = Math.min(box.t, y); box.b = Math.max(box.b, y);
    }
    return box;
  };
  let lo = 10, hi = 200;
  for (let i = 0; i < 26; i++) {
    const middle = (lo + hi) / 2, box = boxAt(middle);
    if (box.r - box.l <= free.r - free.l && box.b - box.t <= free.b - free.t) hi = middle; else lo = middle;
  }
  const box = boxAt(hi);
  view.distance = hi; view.home.copy(camera.position);
  // Slide the picture so the mat sits in the middle of the free space.
  camera.setViewOffset(w, h, Math.round((box.l + box.r - free.l - free.r) / 2), Math.round((box.t + box.b - free.t - free.b) / 2), w, h);
}

function moveCamera(dt) {
  // Where the fall has got to: the dominoes that started tipping a moment ago, and a bit ahead of them.
  let n = 0, x = 0, z = 0, ax = 0, az = 0;
  for (const d of table.falling) if (table.clock - d.started < .14) { x += d.x; z += d.z; ax += d.fx; az += d.fz; n++; }
  if (n) {
    goal.set((x + ax * 1.3) / n, .7, (z + az * 1.3) / n);
    let wide = 0;
    for (const d of table.falling) if (table.clock - d.started < .14) wide = Math.max(wide, Math.hypot(d.x - x / n, d.z - z / n));
    spread += (wide - spread) * Math.min(1, dt * 3);
  } else {
    while (fired.length && clock - fired[0].at > 3.4) fired.shift();
    if (fired.length) {
      goal.set(0, 0, 0);
      for (const f of fired) goal.add(f.view.look(v));
      goal.multiplyScalar(1 / fired.length);
      let wide = 0;
      for (const f of fired) wide = Math.max(wide, f.view.look(v).distanceTo(goal));
      spread += (wide - spread) * Math.min(1, dt * 3);
    }
  }
  const chasing = table.falling.length > 0 && table.down >= 3;
  const want = !reducedMotion && !prefs.still && !strokes.size && (chasing || clock < holdUntil) ? 1 : 0;
  if (follow < .02 && want) focus.copy(goal);
  follow += clamp(want - follow, -dt * .9, dt * 1.6);
  focus.lerp(goal, 1 - Math.exp(-dt * 5));
  const ease = follow * follow * (3 - 2 * follow), distance = Math.min(Math.max(11.5, 13 / camera.aspect) + spread * 1.8 / Math.min(1, camera.aspect), view.distance * .9);   // further back on a narrow screen, to keep the same width in view
  near.copy(view.back).multiplyScalar(Math.cos(LOW) * distance).setY(Math.sin(LOW) * distance).add(focus);
  camera.position.lerpVectors(view.home, near, ease);
  camera.lookAt(look.set(0, 0, 0).lerp(focus, ease));
}

// ---------- display ----------
let toastTimer = 0;
function toast(text, seconds = 2) {
  const el = $('toast');
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), seconds * 1000);
}
let shownCount = -1;
function showCount() {
  if (table.down === shownCount) return;
  shownCount = table.down;
  $('count').hidden = table.down < 2;
  $('countText').textContent = table.down;
  if (!reducedMotion) { $('count').classList.remove('bump'); void $('count').offsetWidth; $('count').classList.add('bump'); }
}
function refreshTools() {
  const empty = !table.dominoes.length, busy = Boolean(laying || table.rewind);
  $('undo').setAttribute('aria-disabled', empty || busy);
  $('clear').setAttribute('aria-disabled', empty || busy);
  $('again').setAttribute('aria-disabled', !table.down || busy);
  $('prompt').hidden = !empty || Boolean(laying);
}

// The pointing hand: over the start of the newest line, or where the last fall stopped.
let idle = 0, hintFrom = null, lastFallen = null;
function hintDomino() {
  if (hintFrom && !hintFrom.dir && table.dominoes.includes(hintFrom)) return hintFrom;
  let best = null, bestFar = Infinity;
  for (const d of table.dominoes) {
    if (d.dir) continue;
    if (!lastFallen) return d;
    const far = Math.hypot(d.x - lastFallen.x, d.z - lastFallen.z);
    if (far < bestFar) { bestFar = far; best = d; }
  }
  return best;
}
function showHint(dt) {
  const busy = table.falling.length || table.rewind || laying || strokes.size || follow > .03;
  idle = busy ? 0 : idle + dt;
  const d = idle > 1.1 ? hintDomino() : null;
  $('hint').hidden = !d;
  if (d) {
    v.set(d.x, SIZE.h + .2, d.z).project(camera);
    $('hint').style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px,${((1 - v.y) / 2 * innerHeight).toFixed(1)}px)`;
  }
  $('again').classList.toggle('ready', !busy && table.down > 0 && table.down === table.dominoes.length);
}

// ---------- what happens during a fall ----------
let counted = 0, glitter = 0;      // glitter: how many sparkles the fall may still throw this frame
function handle(event) {
  if (event.type === 'push') sound.click(0);
  else if (event.type === 'click') {
    const d = event.d;
    sound.click(d.order); lastFallen = d;
    if (glitter > 0) { glitter--; burst(d.x, SIZE.h * .8, d.z, 2, 2.6, [d.p !== null ? INKS[d.p] : PALETTES[prefs.palette].colours[d.c] || '#ffffff', '#ffffff'], 7, .55, .8); }
  }
  else if (event.type === 'flat') { sound.thud(); lastFallen = event.d; burst(event.d.x + event.d.fx * SIZE.h, .15, event.d.z + event.d.fz * SIZE.h, 8, 2.2, ['#ffffff', '#f6ead2'], 3, .5); }
  else if (event.type === 'toy') { const toy = toyViews[event.toy.kind]; fired.push({ view: toy, at: clock }); lastToyAt = clock; toy.fire(); }
  else if (event.type === 'done') {
    const fell = event.down - counted;
    prefs.toppled += fell; counted = event.down; save();
    holdUntil = clock + (clock - lastToyAt < 3 ? 2.6 : .9);
    if (fell >= 3) {
      toast(event.standing ? `${event.down} fell!` : `All ${event.down} fell! 🎉`, 2.4);
      sound.say(`${event.down} dominoes!`);
      if (!event.standing) { sound.cheer(); if (lastFallen) burst(lastFallen.x, 1, lastFallen.z, 36, 6, PARTY, 9, 1.4, .9); }
    }
    refreshTools();
  } else if (event.type === 'stood') { resetToys(); fired.length = 0; counted = 0; lastFallen = null; refreshTools(); }
}

// ---------- laying a ready-made run ----------
let laying = null, lastPop = 0;
function lay(id) {
  const run = RUNS.find(r => r.id === id);
  if (!run) return;
  clear(table); resetToys(); fired.length = 0; counted = 0; lastFallen = null; hintFrom = null;
  prefs.still = Boolean(run.still);
  const specs = runSpecs(id, innerHeight > innerWidth);
  // Big runs are laid faster, so none takes more than about two seconds to appear.
  laying = { specs, next: 0, stroke: ++table.strokes, owed: 0, first: null, rate: Math.max(110, specs.length / 1.8) };
  refreshTools();
  if (reducedMotion) layMore(99);
}
function layMore(dt) {
  laying.owed += dt * laying.rate;
  while (laying.owed >= 1 && laying.next < laying.specs.length) {
    const spec = laying.specs[laying.next++], d = place(table, spec.x, spec.z, spec.yaw, laying.stroke, spec.c ?? null, spec.p ?? null);
    if (d) { born.set(d, clock); laying.first ||= d; if (clock - lastPop > .04) { lastPop = clock; sound.pop(laying.next); } }
    laying.owed -= 1;
  }
  if (laying.next >= laying.specs.length) { hintFrom = laying.first; laying = null; save(); refreshTools(); }
}

// ---------- fingers ----------
const strokes = new Map(), ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pointer = new THREE.Vector2();
function matPoint(x, y) {
  pointer.set(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2);
  ray.setFromCamera(pointer, camera);
  return ray.ray.intersectPlane(ground, v) ? { x: v.x, z: v.z } : null;
}
// The standing domino nearest a tap, measured on the screen so small fingers do not have to be exact.
function dominoAt(x, y) {
  let best = null, bestFar = 46;
  for (const d of table.dominoes) {
    if (d.dir) continue;
    v.set(d.x, SIZE.h * .5, d.z).project(camera);
    const far = Math.hypot((v.x + 1) / 2 * innerWidth - x, (1 - v.y) / 2 * innerHeight - y);
    if (far < bestFar) { bestFar = far; best = d; }
  }
  return best;
}
function knock(d) {
  const events = [];
  if (push(table, d, events)) events.forEach(handle);
}
const canDraw = () => follow < .05 && !table.rewind && !laying;

canvas.addEventListener('pointerdown', e => {
  sound.wake();
  if (e.button > 0) return;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  if (!table.falling.length) holdUntil = 0;        // a touch brings the camera back from watching a toy
  strokes.set(e.pointerId, { x: e.clientX, y: e.clientY, line: null, first: null, full: false, waited: false });
});
canvas.addEventListener('pointermove', e => {
  const s = strokes.get(e.pointerId);
  if (!s) return;
  if (!s.line) {
    // While the camera is away watching a fall, the line waits and then starts under the finger.
    if (!canDraw()) { if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) s.waited = true; s.x = e.clientX; s.y = e.clientY; return; }
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 10) return;
    const from = matPoint(s.x, s.y);
    if (!from) return;
    s.line = startStroke(table, from.x, from.z);
  }
  const at = matPoint(e.clientX, e.clientY);
  if (!at) return;
  const made = trace(table, s.line, at.x, at.z);
  for (const d of made) { born.set(d, clock); s.first ||= d; sound.pop(table.dominoes.length); }
  if (made.length) { $('prompt').hidden = true; pose(); }
  else if (table.dominoes.length >= LIMIT && !s.full) { s.full = true; toast('That is all the dominoes! Tap one!', 2.6); }
});
function lift(e, cancelled) {
  const s = strokes.get(e.pointerId);
  if (!s) return;
  strokes.delete(e.pointerId);
  if (s.line) { if (s.first) { hintFrom = s.first; save(); } refreshTools(); }
  else if (!cancelled && !s.waited && !laying) { const d = dominoAt(e.clientX, e.clientY); if (d) knock(d); }
}
canvas.addEventListener('pointerup', e => lift(e, false));
canvas.addEventListener('pointercancel', e => lift(e, true));
canvas.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault(); sound.wake();
  const d = hintDomino();
  if (d && !laying) knock(d);
});

// ---------- buttons ----------
const off = id => $(id).getAttribute('aria-disabled') === 'true';
$('again').addEventListener('click', () => {
  if (off('again')) return;
  if (standUp(table, reducedMotion)) { sound.zip(); holdUntil = 0; if (reducedMotion) handle({ type: 'stood' }); pose(); showCount(); refreshTools(); }
});
$('undo').addEventListener('click', () => {
  if (off('undo')) return;
  if (undo(table)) { if (!table.dominoes.length) prefs.still = false; resetToys(); counted = 0; lastFallen = null; hintFrom = null; sound.pop(3); save(); pose(); showCount(); refreshTools(); }
});
let sureTimer = 0;
function unsure() { clearTimeout(sureTimer); $('clear').removeAttribute('data-sure'); $('clear').querySelector('small').textContent = 'Clear'; $('clear').setAttribute('aria-label', 'Clear the mat'); }
$('clear').addEventListener('click', () => {
  if (off('clear')) return;
  if (!$('clear').hasAttribute('data-sure')) {
    $('clear').setAttribute('data-sure', ''); $('clear').querySelector('small').textContent = 'Sure?'; $('clear').setAttribute('aria-label', 'Tap again to clear the mat');
    sureTimer = setTimeout(unsure, 3000);
    return;
  }
  unsure(); clear(table); prefs.still = false; resetToys(); counted = 0; lastFallen = null; hintFrom = null; sound.thud(); save(); pose(); showCount(); refreshTools();
});
$('paint').addEventListener('click', () => {
  prefs.palette = (prefs.palette + 1) % PALETTES.length;
  toast(PALETTES[prefs.palette].name, 1.2); sound.pop(prefs.palette * 3); save(); pose();
});
function showSound() { $('sound').setAttribute('aria-pressed', sound.on); $('sound').setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on'); }
$('sound').addEventListener('click', () => { sound.set(!sound.on); prefs.sound = sound.on; save(); showSound(); if (sound.on) sound.cheer(); });

// The three ready-made runs, each drawn as a little map.
$('runList').innerHTML = RUNS.map(run => `<button data-run="${run.id}" aria-label="${run.name}: ${runSpecs(run.id).length} dominoes"><canvas width="240" height="170" aria-hidden="true"></canvas><strong>${run.name}</strong></button>`).join('');
function drawMaps() {
  // Drawn the same way round as the mat is seen: toys at the top on a tall screen, on the right on a wide one.
  const tall = innerHeight > innerWidth, w = tall ? 170 : 240, h = tall ? 240 : 170, scale = 240 / (AREA.x * 2 + .6), colours = PALETTES[prefs.palette].colours;
  const spot = (x, z) => tall ? [w / 2 + z * scale, h / 2 - x * scale] : [w / 2 + x * scale, h / 2 + z * scale];
  for (const button of $('runList').children) {
    const map = button.querySelector('canvas'), run = RUNS.find(r => r.id === button.dataset.run);
    map.width = w; map.height = h;
    const g = map.getContext('2d');
    for (const toy of TOYS) { g.fillStyle = run.toys.includes(toy.kind) ? '#ffc44e' : '#ffffff'; g.beginPath(); g.arc(...spot(toy.x, toy.z), 9, 0, Math.PI * 2); g.fill(); }
    g.lineCap = 'round';
    runSpecs(run.id, tall).forEach((s, i) => {
      // A picture domino is shown the colour it falls to, as a fat mark so the picture reads.
      const inked = s.p !== undefined && s.p !== null, reach = inked ? .3 : .27;
      const [ax, ay] = spot(s.x + Math.sin(s.yaw) * reach, s.z - Math.cos(s.yaw) * reach), [bx, by] = spot(s.x - Math.sin(s.yaw) * reach, s.z + Math.cos(s.yaw) * reach);
      g.lineWidth = inked ? 8 : 3.4; g.lineCap = inked ? 'butt' : 'round';
      g.strokeStyle = inked ? INKS[s.p] : colours[(s.c ?? i) % 7];
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    });
  }
}
$('runs').addEventListener('click', () => {
  drawMaps();
  $('tally').textContent = prefs.toppled ? `You have knocked over ${prefs.toppled.toLocaleString('en')} dominoes so far.` : '';
  prefs.seen = RUNS.length; $('runs').classList.remove('new'); save();
  $('runsDialog').showModal();
});
$('runsClose').addEventListener('click', () => $('runsDialog').close());
$('runsDialog').addEventListener('click', e => {
  if (e.target === $('runsDialog')) { $('runsDialog').close(); return; }
  const button = e.target.closest('[data-run]');
  if (!button) return;
  $('runsDialog').close(); sound.wake(); lay(button.dataset.run); canvas.focus({ preventScroll: true });
});

// ---------- every frame ----------
let before = performance.now(), slowFor = 0, quality = 2;
// A device that cannot keep up gets a softer picture first, then loses the shadows.
function ease(seconds) {
  slowFor = seconds > 1 / 32 ? slowFor + seconds : Math.max(0, slowFor - seconds * 2);
  if (slowFor < 2.5 || !quality) return;
  slowFor = 0; quality--;
  if (quality === 1) renderer.setPixelRatio(1); else { sun.castShadow = false; renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const real = (now - before) / 1000, dt = Math.min(real, .05); before = now; clock += dt;
  if (real < .5) ease(real);
  let moved = growing > 0;
  if (laying) { layMore(dt); moved = true; }
  glitter = 5;
  if (table.falling.length || table.rewind) {
    const events = [];
    for (let i = 0; i < 4; i++) step(table, dt / 4, events);
    events.forEach(handle);
    moved = true;
  }
  if (moved) pose();
  showCount();
  for (const kind in toyViews) toyViews[kind].update(dt);
  moveSparks(dt);
  moveCamera(dt);
  showHint(dt);
  renderer.render(scene, camera);
}

// Sound can only start from a touch, and browsers differ on which touch event counts.
for (const type of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(type, () => sound.wake(), { passive: true });
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 250));
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.close(); });
addEventListener('pagehide', () => sound.close());

sound.set(prefs.sound); showSound();
fit(); pose(); refreshTools();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
// The first visit starts with a run already standing, so the first thing to do is tap and watch.
if (!prefs.met && !table.dominoes.length) { prefs.met = true; lay('name'); }
// The star wiggles until the newest runs have been looked at.
$('runs').classList.toggle('new', prefs.seen < RUNS.length);
window.littleDominoes = { table, prefs, lay, knock, get follow() { return follow; }, get laying() { return Boolean(laying); } };
requestAnimationFrame(frame);
