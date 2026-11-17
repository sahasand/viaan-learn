// City Swinger: the scene, the hero, input and the screens. Every rule (where things are,
// how the hero moves, what is saved) lives in swing.js; this file draws and listens.
import * as THREE from 'three';
import { SAVE_KEY, BODY, SUITS, FINISH_STARS, makeMission, startHero, stepHero, gather, hookFor, normalizeSave, earn, rescue, finishMission, chooseSuit } from './swing.js?v=1';
import { createSound } from './audio.js?v=1';

const $ = id => document.getElementById(id);
const canvas = $('world'), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches, sound = createSound();
const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), dummy = new THREE.Object3D(), paint = new THREE.Color();
const rand = (() => { let n = 99; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const BODY_COLORS = ['#f7b9a6', '#a8d3f4', '#f8e19c', '#b6e2c4', '#d6c1f1', '#f1f3f5'], GLASS = ['#6a8fc0', '#4f79b4', '#7a93b8', '#5f97a8', '#7d78c0', '#6aa3d6'];
const CAR_COLORS = ['#eb5a46', '#ffc93c', '#3f9fe0', '#ffffff', '#58c7a0', '#f2559c'], CROWD = ['bear', 'cat', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'lion', 'owl', 'panda', 'penguin', 'turtle'];
// How each time of day is lit. `lit` is how brightly the windows glow.
const LOOK = {
  day: { fog: '#dff2fd', sun: '#fff4dc', power: 2.5, sky: '#fff6dc', ground: '#5c7f6b', air: 1.9, lit: 0, far: '#b9cfe2' },
  sunset: { fog: '#ffe0a8', sun: '#ffb37a', power: 2.1, sky: '#ffd9b0', ground: '#7a5a6a', air: 1.6, lit: .35, far: '#e8a98e' },
  night: { fog: '#4d4ba0', sun: '#aab8ff', power: .8, sky: '#8f9dff', ground: '#1d2452', air: .8, lit: 1, far: '#37397f' }
};
let renderer, scene, camera, sunLight, airLight, world = null, heroModel, rope, ropeEnd, starMesh, sparks, sky;
let save, mission, hero, phase = 'loading', paused = false, holding = false, clock = 0, last = 0, missionStars = 0, starRun = 0, lastStarAt = -9, toastUntil = 0, hintUntil = 0, doneAt = 0, bounceAt = -9, bouncePad = null;
const hooks = [], friends = [], crowd = [], cars = [], clouds = [], spark = { at: [], go: [], life: [] };
try { save = normalizeSave(localStorage.getItem(SAVE_KEY)); } catch { save = normalizeSave(null); }
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...more });
function add(geometry, material, x, y, z, parent = world) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; }
function toast(text, seconds = 1.8) { $('toast').textContent = text; $('toast').classList.add('show'); toastUntil = clock + seconds; }
function starShape(points = 5, outer = 1, inner = .46) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) { const a = i / (points * 2) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? inner : outer; shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ExtrudeGeometry(shape, { depth: .28, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }).center();
}
const STAR = starShape();
const BIG = 1.4;                  // the hero is drawn larger than life so he is easy to follow on a phone

/* ---------- Super Viaan ---------- */
// Built from simple shapes, facing forward along z; the game turns him to face along the street.
function makeHero() {
  const g = new THREE.Group(), suit = mat('#18a999', { roughness: .5 }), cape = new THREE.MeshStandardMaterial({ color: '#ff9f1c', side: THREE.DoubleSide, roughness: .7 });
  const skin = mat('#f2c9a0'), gold = mat('#ffd23f', { roughness: .4 }), dark = mat('#3b2a20'), white = mat('#ffffff');
  const part = (geometry, material, x, y, z, parent = g) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const limb = (x, y, long, thick, tip) => { const pivot = new THREE.Group(); pivot.position.set(x, y, 0); g.add(pivot); part(new THREE.CapsuleGeometry(thick, long, 4, 10), suit, 0, -long / 2 - thick * .4, 0, pivot); part(new THREE.SphereGeometry(thick * 1.25, 10, 8), gold, 0, -long - thick * 1.1, 0, pivot); return pivot; };
  part(new THREE.CapsuleGeometry(.36, .5, 6, 14), suit, 0, 1.12, 0);
  const belt = part(new THREE.TorusGeometry(.37, .06, 8, 20), gold, 0, .84, 0); belt.rotation.x = Math.PI / 2;
  const badge = part(STAR, gold, 0, 1.2, .37); badge.scale.setScalar(.2);
  part(new THREE.SphereGeometry(.5, 20, 16), skin, 0, 2.02, 0);
  const hair = part(new THREE.SphereGeometry(.53, 18, 10, 0, Math.PI * 2, 0, Math.PI * .5), dark, 0, 2.05, -.03); hair.rotation.x = -.3;
  part(new THREE.CylinderGeometry(.507, .507, .24, 22, 1, true), suit, 0, 2.08, 0);
  for (const side of [-1, 1]) { const eye = part(new THREE.SphereGeometry(.12, 10, 8), white, side * .19, 2.08, .45); eye.scale.set(1, 1.15, .5); part(new THREE.SphereGeometry(.055, 8, 6), dark, side * .19, 2.07, .51); }
  const smile = part(new THREE.TorusGeometry(.14, .028, 6, 12, Math.PI), mat('#b5483a'), 0, 1.86, .455); smile.rotation.z = Math.PI;
  const capeGeometry = new THREE.PlaneGeometry(.95, 1.3, 4, 6); capeGeometry.translate(0, -.65, 0);
  const capeMesh = part(capeGeometry, cape, 0, 1.55, -.36), rest = capeGeometry.attributes.position.array.slice();
  return { g, suit, cape, capeMesh, rest, arms: [limb(-.44, 1.44, .42, .13), limb(.44, 1.44, .42, .13)], legs: [limb(-.2, .74, .4, .17), limb(.2, .74, .4, .17)] };
}
function dressHero() {
  const s = SUITS.find(x => x.id === save.suit) || SUITS[0]; heroModel.suit.color.set(s.suit); heroModel.cape.color.set(s.cape);
}
// Poses the hero for what he is doing, and lays the rope from his hands to the hook.
function poseHero(dt) {
  const m = heroModel, g = m.g, t = clock, speed = Math.hypot(hero.vx, hero.vy), mode = phase === 'done' ? 'done' : phase === 'start' ? 'wait' : hero.mode;
  g.position.set(hero.x, hero.y, 0); g.rotation.order = 'YXZ'; g.scale.setScalar(BIG);
  let face = Math.PI / 2 - .5, lean = 0, armL = 0, armR = 0, legL = 0, legR = 0, hop = 0, spread = 0;
  if (mode === 'run') { const p = t * 13; lean = .2; legL = Math.sin(p) * .95; legR = -legL; armL = -legL * .8; armR = legL * .8; hop = Math.abs(Math.sin(p)) * .12; if (holding) armR = Math.PI * .85; }
  else if (mode === 'wait') { face = .35; armR = Math.PI + Math.sin(t * 6) * .4; spread = .35; hop = Math.abs(Math.sin(t * 3)) * .08; }   // waving on the first roof
  else if (mode === 'climb') { const p = t * 12; face = Math.PI / 2; armL = Math.PI + Math.sin(p) * .5; armR = Math.PI - Math.sin(p) * .5; legL = Math.sin(p) * .6 - .3; legR = -Math.sin(p) * .6 - .3; }
  else if (mode === 'swing') {
    const hook = mission.hooks[hero.hook], a = Math.atan2(hook.x - hero.x, hook.y - hero.y - BODY - 1.2);
    face = Math.PI / 2; lean = a * .7; armL = armR = a + Math.PI - lean; legL = .5 + hero.vx * .02; legR = .15 + hero.vx * .02;
  } else if (mode === 'air') { lean = THREE.MathUtils.clamp(-hero.vy * .03, -.5, .6); armL = armR = Math.PI * .8; spread = .7; legL = .55; legR = -.25; }
  else { face = 0; hop = Math.abs(Math.sin(t * 7)) * .9; armL = armR = Math.PI + Math.sin(t * 14) * .35; spread = .5; }
  const ease = 1 - Math.exp(-14 * dt);
  g.rotation.y += (face - g.rotation.y) * ease; g.rotation.x += (lean - g.rotation.x) * ease; g.position.y += hop;
  m.arms[0].rotation.x += (armL - m.arms[0].rotation.x) * ease; m.arms[1].rotation.x += (armR - m.arms[1].rotation.x) * ease;
  m.arms[0].rotation.z += (-spread - m.arms[0].rotation.z) * ease; m.arms[1].rotation.z += (spread - m.arms[1].rotation.z) * ease;
  m.legs[0].rotation.x += (legL - m.legs[0].rotation.x) * ease; m.legs[1].rotation.x += (legR - m.legs[1].rotation.x) * ease;
  if (save.suit === 'rainbow') { m.suit.color.setHSL((t * .2) % 1, .8, .55); m.cape.color.setHSL((t * .2 + .5) % 1, .9, .6); }
  // The cape streams out behind and ripples.
  const pos = m.capeMesh.geometry.attributes.position, flow = Math.min(1.25, .25 + speed * .07);
  for (let i = 0; i < pos.count; i++) { const y = m.rest[i * 3 + 1], down = -y / 1.3; pos.setZ(i, -down * flow * .9 + Math.sin(t * 9 + down * 4 + m.rest[i * 3]) * .08 * down * (reduced ? 0 : 1)); pos.setY(i, y * (1 - flow * .25)); }
  pos.needsUpdate = true;
  const tied = mode === 'swing'; rope.visible = ropeEnd.visible = tied;
  if (tied) {
    const hook = mission.hooks[hero.hook]; const hand = BODY + 1.5; tmp.set(hook.x - hero.x, hook.y - hero.y - hand, 0); const long = tmp.length();
    rope.position.set(hero.x + tmp.x / 2, hero.y + hand + tmp.y / 2, 0); rope.scale.set(1, long, 1); rope.quaternion.setFromUnitVectors(UP, tmp.normalize()); ropeEnd.position.set(hook.x, hook.y, 0); ropeEnd.rotation.z = t * 5;
  }
}

/* ---------- the city for one mission ---------- */
function windows(i, lit) {
  const tile = (draw) => { const t = canvasOf(128, 128, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const map = tile(g => { g.fillStyle = BODY_COLORS[i]; g.fillRect(0, 0, 128, 128); g.fillStyle = '#00000018'; for (const y of [58, 122]) g.fillRect(0, y, 128, 6);
    for (const y of [10, 74]) for (const x of [12, 74]) { g.fillStyle = GLASS[i]; g.fillRect(x, y, 42, 40); g.fillStyle = '#ffffff55'; g.fillRect(x, y, 42, 10); g.fillStyle = '#ffffff30'; g.fillRect(x + 26, y, 6, 40); } });
  const glow = tile(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; [[12, 10], [74, 74], [74, 10]].forEach(([x, y], k) => { if ((k + i) % 3) g.fillRect(x, y, 42, 40); }); });
  return new THREE.MeshStandardMaterial({ map, roughness: .55, metalness: .06, emissive: '#ffe08a', emissiveMap: glow, emissiveIntensity: lit * .95 });
}
function buildWorld() {
  if (world) { scene.remove(world); world.traverse(o => { o.geometry?.dispose?.(); }); }
  world = new THREE.Group(); scene.add(world); hooks.length = friends.length = crowd.length = cars.length = clouds.length = 0;
  const look = LOOK[mission.theme], long = mission.length + 140, mid = mission.length / 2;
  document.body.dataset.theme = mission.theme; scene.fog.color.set(look.fog); sunLight.color.set(look.sun); sunLight.intensity = look.power; airLight.color.set(look.sky); airLight.groundColor.set(look.ground); airLight.intensity = look.air;
  // The street, a pavement along the buildings, and grass stretching away behind.
  const lanes = canvasOf(256, 64, g => { g.fillStyle = '#5b636e'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f4f1e6'; g.fillRect(40, 29, 110, 6); }); lanes.wrapS = THREE.RepeatWrapping; lanes.repeat.set(long / 12, 1);
  const road = add(new THREE.PlaneGeometry(long, 16), new THREE.MeshStandardMaterial({ map: lanes, roughness: .95 }), mid, 0, 6); road.rotation.x = -Math.PI / 2; road.castShadow = false;
  const yard = add(new THREE.PlaneGeometry(long, 16), mat('#e9e4d8'), mid, -.02, -8); yard.rotation.x = -Math.PI / 2; yard.castShadow = false;
  const grass = mat(mission.theme === 'night' ? '#2b3a70' : mission.theme === 'sunset' ? '#b9c77a' : '#9ad68a', { roughness: 1 });
  for (const [deep, z] of [[240, -136], [90, 59]]) { const field = add(new THREE.PlaneGeometry(long + 300, deep), grass, mid, -.06, z); field.rotation.x = -Math.PI / 2; field.castShadow = false; }
  // Buildings: pastel walls, rows of windows, and something on most roofs.
  const walls = BODY_COLORS.map((_, i) => windows(i, look.lit)), roofs = BODY_COLORS.map(c => mat(new THREE.Color(c).multiplyScalar(.8))), dark = mat('#55606c'), green = mat('#6fbf63'), leaf = mat('#3f9e55'), white = mat('#fbfaf5'), red = mat('#ef5a45');
  mission.buildings.forEach((b, n) => {
    const wide = b.x1 - b.x0, deep = 12, box = new THREE.BoxGeometry(wide, b.top, deep), uv = box.attributes.uv, x = (b.x0 + b.x1) / 2;
    for (let i = 0; i < uv.count; i++) if (i < 8 || i >= 16) uv.setXY(i, uv.getX(i) * (i < 8 ? deep : wide) / 7, uv.getY(i) * b.top / 6.4);
    add(box, [walls[b.style], walls[b.style], roofs[b.style], roofs[b.style], walls[b.style], walls[b.style]], x, b.top / 2, -3);
    add(new THREE.BoxGeometry(wide + .5, .5, deep + .5), roofs[b.style], x, b.top - .05, -3);
    if (b.finish) return;
    if (n % 3 === 0) { add(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 12), mat('#c98a4b'), x + 1, b.top + 2, -6); add(new THREE.ConeGeometry(1.8, 1.2, 12), dark, x + 1, b.top + 3.8, -6); }
    else if (n % 3 === 1) { add(new THREE.BoxGeometry(wide * .55, .5, 4), green, x, b.top + .3, -6); for (const dx of [-2, 0, 2.2]) add(new THREE.SphereGeometry(1.1, 8, 6), leaf, x + dx, b.top + 1.5, -6); }
    else for (const dx of [-2.2, 1.6]) add(new THREE.BoxGeometry(2, 1.2, 1.8), dark, x + dx, b.top + .6, -6.5);
  });
  // The finish: a flag, bunting and a crowd of friends cheering on the last roof.
  const end = mission.buildings.at(-1), loader = new THREE.TextureLoader();
  add(new THREE.CylinderGeometry(.13, .13, 7, 8), white, mission.finish.x + 5, end.top + 3.5, -1);
  const flag = canvasOf(128, 96, g => { for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { g.fillStyle = (x + y) % 2 ? '#fff' : '#22314a'; g.fillRect(x * 22, y * 24, 22, 24); } });
  const banner = add(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshStandardMaterial({ map: flag, side: THREE.DoubleSide }), mission.finish.x + 6.7, end.top + 5.8, -1); banner.userData.wave = true;
  for (let i = 0; i < 7; i++) { const tex = loader.load(`../memory-assets/${CROWD[(mission.number * 3 + i) % CROWD.length]}.png`); tex.colorSpace = THREE.SRGBColorSpace; const fan = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); fan.scale.setScalar(2.9); fan.position.set(end.x0 + 2.2 + i * 2.5, end.top + 1.4, i % 2 ? -2.4 : -4); fan.userData.beat = i * .9; world.add(fan); crowd.push(fan); }
  // Hooks: a golden ring over each gap, held by a crane or a bunch of balloons.
  const ring = new THREE.TorusGeometry(.95, .2, 10, 24), gold = mat('#ffc928', { emissive: '#a86a00', emissiveIntensity: .5, roughness: .35 });
  mission.hooks.forEach((h, n) => {
    const group = new THREE.Group(); group.position.set(h.x, h.y, 0); world.add(group); add(ring, gold, 0, 0, 0, group);
    if (h.kind === 'balloon') [['#ef5a45', -1.1, 3.4], ['#3f9fe0', 0, 4.3], ['#ffc93c', 1.1, 3.5]].forEach(([color, dx, dy]) => { const balloon = add(new THREE.SphereGeometry(1.15, 14, 10), mat(color, { roughness: .35 }), dx, dy, 0, group); balloon.scale.y = 1.2; const string = add(new THREE.CylinderGeometry(.03, .03, dy - 1.2, 4), white, dx / 2, (dy + .4) / 2, 0, group); string.rotation.z = Math.atan2(-dx, dy); });
    else { add(new THREE.BoxGeometry(.7, h.y + 3.4, .7), mat('#ffb000'), h.x, (h.y + 3.4) / 2, -8.2); add(new THREE.BoxGeometry(.5, .5, 10.5), mat('#ffb000'), h.x, h.y + 3, -3.4); add(new THREE.CylinderGeometry(.05, .05, 2.1, 5), dark, h.x, h.y + 1.95, 0); if (h.kind === 'flag') add(new THREE.BoxGeometry(1.8, 1.1, .08), red, h.x + 1.1, h.y + 4.3, -8.2); }
    hooks.push(group);
  });
  // Trampolines in the street under every gap.
  mission.bouncers.forEach(p => { const pad = new THREE.Group(); pad.position.set((p.x0 + p.x1) / 2, 0, 0); world.add(pad); const top = add(new THREE.CylinderGeometry(1, 1, .5, 28), mat('#3f9fe0', { roughness: .4 }), 0, .7, 0, pad); top.scale.set((p.x1 - p.x0) / 2, 1, 2.6); const rim = add(new THREE.CylinderGeometry(1, 1, .34, 28), red, 0, .6, 0, pad); rim.scale.set((p.x1 - p.x0) / 2 + .3, 1, 2.9); p.model = pad; });
  // Friends to rescue, each in a bubble.
  for (const f of mission.friends) {
    const picture = canvasOf(128, 128, g => { g.fillStyle = '#ffffffe6'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#ffb703'; g.lineWidth = 7; g.stroke(); g.font = '78px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.icon, 64, 70); });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: picture, fog: false })); sprite.scale.setScalar(3); sprite.position.set(f.x, f.y, .4); world.add(sprite); friends.push(sprite);
    const b = mission.buildings.find(o => f.x > o.x0 - 1 && f.x < o.x1 + 1);
    if (f.place === 'perch' && b) add(new THREE.BoxGeometry(1.6, f.y - b.top - 1.2, 1.6), red, f.x, b.top + (f.y - b.top - 1.2) / 2, -1.6);
    if (f.place === 'hang') { const hook = mission.hooks.reduce((best, h) => Math.abs(h.x - f.x) < Math.abs(best.x - f.x) ? h : best); add(new THREE.CylinderGeometry(.04, .04, hook.y - f.y - 1.4, 5), white, f.x, (hook.y + f.y) / 2 + .2, 0); }
  }
  // Stars to catch.
  starMesh = new THREE.InstancedMesh(STAR, mat('#ffd23f', { emissive: '#b97a00', emissiveIntensity: .55, roughness: .3 }), mission.stars.length); starMesh.frustumCulled = false; world.add(starMesh);
  // Behind it all: a faded skyline, trees, cars and clouds.
  const far = BODY_COLORS.map(c => mat(new THREE.Color(c).lerp(new THREE.Color(look.far), .62), { roughness: 1 }));
  for (let i = 0; i < Math.ceil((long + 120) / 8); i++) { const tall = 10 + rand() * 30, wide = 7 + rand() * 8; const tower = add(new THREE.BoxGeometry(wide, tall, wide), far[i % far.length], -130 + i * 8 + rand() * 4, tall / 2, -62 - rand() * 46); tower.castShadow = false; }
  for (let x = -20; x < mission.length + 30; x += 11) { add(new THREE.CylinderGeometry(.22, .3, 1.8, 6), mat('#8a5a34'), x, .9, 13.2); add(new THREE.SphereGeometry(1.5, 9, 7), leaf, x, 2.9, 13.2); }
  for (let i = 0; i < 9; i++) { const car = add(new THREE.BoxGeometry(3, 1.3, 1.7), mat(CAR_COLORS[i % CAR_COLORS.length], { roughness: .5 }), rand() * mission.length, .8, i % 2 ? 8 : 10.6); add(new THREE.BoxGeometry(1.6, .8, 1.5), mat('#cfe6f7', { roughness: .3 }), -.1, .95, 0, car); car.userData.speed = (i % 2 ? 1 : -1) * (6 + rand() * 5); cars.push(car); }
  const puff = new THREE.SphereGeometry(1, 10, 8), cloudy = mat(mission.theme === 'night' ? '#6f72c2' : mission.theme === 'sunset' ? '#ffd0b0' : '#ffffff', { roughness: 1 });
  for (let i = 0; i < 12; i++) { const cloud = new THREE.Group(); cloud.position.set(-60 + i * (long / 11) + rand() * 20, 30 + rand() * 26, -55 - rand() * 30); for (let j = 0; j < 4; j++) { const p = add(puff, cloudy, (j - 1.5) * 3.6, j % 2 ? 1.4 : 0, 0, cloud); p.scale.set(4 + rand() * 2, 2.4 + rand(), 3); p.castShadow = false; } cloud.userData.speed = .6 + rand(); world.add(cloud); clouds.push(cloud); }
  // The sun or moon rides with the camera.
  sky.material.map?.dispose(); sky.material.map = canvasOf(256, 256, g => {
    const glow = g.createRadialGradient(128, 128, 50, 128, 128, 128); glow.addColorStop(0, mission.theme === 'sunset' ? '#ffb347cc' : '#fff6c9aa'); glow.addColorStop(1, '#fff6c900'); g.fillStyle = glow; g.fillRect(0, 0, 256, 256);
    g.fillStyle = mission.theme === 'night' ? '#fff3c2' : mission.theme === 'sunset' ? '#ff8a3d' : '#ffe066'; g.beginPath(); g.arc(128, 128, 70, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a6b3a'; g.lineWidth = 5; g.lineCap = 'round'; for (const x of [104, 152]) { g.beginPath(); g.arc(x, 120, 10, .15 * Math.PI, .85 * Math.PI); g.stroke(); } g.beginPath(); g.arc(128, 136, 20, .2 * Math.PI, .8 * Math.PI); g.stroke();
  }); sky.material.needsUpdate = true;
  showFriends(); dressHero();
}

/* ---------- playing ---------- */
function showFriends() {
  $('friendSlots').innerHTML = mission.friends.map(f => `<span class="${f.taken ? 'safe' : ''}" title="${f.name}">${f.icon}</span>`).join('');
  $('stars').textContent = save.stars;
}
function burst(x, y, count, colors, speed = 7) {
  if (reduced) return;
  for (let i = 0; i < count; i++) { const a = rand() * Math.PI * 2, v = speed * (.4 + rand() * .6); spark.at.push(new THREE.Vector3(x, y, .5)); spark.go.push(new THREE.Vector3(Math.cos(a) * v, Math.sin(a) * v + 2, (rand() - .5) * 3)); spark.life.push({ t: .7 + rand() * .4, c: colors[i % colors.length] }); }
  while (spark.at.length > 160) { spark.at.shift(); spark.go.shift(); spark.life.shift(); }
}
function happened(events) {
  for (const e of events) {
    if (e === 'throw') { sound.throwRope(); hintUntil = 0; }
    else if (e === 'let go') sound.letGo();
    else if (e === 'land') { sound.land(); burst(hero.x, hero.y + .2, 6, ['#ffffff', '#e9e4d8'], 3); }
    else if (e === 'stick') sound.stick();
    else if (e === 'leap') sound.leap();
    else if (e === 'bounce') { sound.bounce(); bounceAt = clock; bouncePad = mission.bouncers.find(p => hero.x >= p.x0 && hero.x <= p.x1); burst(hero.x, .8, 10, ['#3f9fe0', '#ffffff'], 6); toast('Boing!', .8); }
    else if (e === 'finish') finish();
  }
}
function caught(found) {
  for (const f of found) {
    save = earn(save, f.value); missionStars += f.value;
    if (f.kind === 'star') {
      starRun = clock - lastStarAt < 1.6 ? starRun + 1 : 0; lastStarAt = clock;
      if (f.thing.big) { sound.bigStar(); toast('Big star! +5 ⭐', 1.2); } else sound.star(starRun);
      burst(f.thing.x, f.thing.y, f.thing.big ? 16 : 6, ['#ffd23f', '#fff6c9']);
    } else {
      save = rescue(save, f.thing.id); sound.friend(); toast(`${f.thing.name} is safe! ${f.thing.icon}`, 2.2); burst(f.thing.x, f.thing.y, 22, ['#ff7a45', '#ffd23f', '#58c7a0', '#5b8def', '#ffffff'], 9);
      f.thing.savedAt = clock;
    }
  }
  if (found.length) { store(); showFriends(); const pill = $('starPill'); pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); }
}
function finish() {
  phase = 'done'; doneAt = clock; save = finishMission(save); missionStars += FINISH_STARS; store(); showFriends(); sound.finish(); sound.play(false); toast('You did it! 🎉', 2.4);
}
function showFinish() {
  const got = mission.friends.filter(f => f.taken), fresh = SUITS.find(s => s.cost && !save.owned.includes(s.id) && save.stars >= s.cost);
  $('finishKicker').textContent = `MISSION ${mission.number} DONE`;
  $('finishTitle').textContent = got.length === 3 ? 'You saved everyone!' : 'You saved the day!';
  $('finishFriends').innerHTML = mission.friends.map(f => `<span class="${f.taken ? '' : 'missed'}" title="${f.name}">${f.icon}</span>`).join('');
  $('finishStars').textContent = `+${missionStars} stars! You have ${save.stars} ⭐`;
  $('finishNote').textContent = fresh ? `You can wear the ${fresh.name} suit now!` : '';
  $('finishCard').showModal();
}
function renderSuits() {
  $('bank').textContent = save.stars;
  $('suits').innerHTML = SUITS.map(s => {
    const mine = !s.cost || save.owned.includes(s.id), ready = !mine && save.stars >= s.cost, fill = s.id === 'rainbow' ? 'conic-gradient(#ff5f5f,#ffd24a,#58d68d,#4aa8ff,#b06bff,#ff5f5f)' : s.suit;
    return `<button data-suit="${s.id}" class="${mine ? '' : ready ? 'locked ready' : 'locked'}" style="background:${fill}" aria-label="${s.name} suit${mine ? '' : `, ${ready ? 'ready to unlock' : 'locked'}, needs ${s.cost} stars`}" aria-pressed="${s.id === save.suit}">${mine ? '' : '🔒<br>' + s.cost}<i style="background:${s.cape}"></i></button>`;
  }).join('');
}
// Opens the card for a mission: who needs help, and the suit to wear.
function openMission(number) {
  mission = makeMission(number); hero = startHero(mission); missionStars = 0; starRun = 0; phase = 'start'; paused = false; holding = false; bouncePad = null;
  buildWorld(); frameCamera(true);
  const names = mission.friends.map(f => f.name);
  $('startKicker').textContent = `MISSION ${mission.number}`;
  $('startTitle').textContent = mission.number === 1 ? 'Super Viaan to the rescue!' : ['The city needs you!', 'Up, up and away!', 'Time to be a hero!'][mission.number % 3];
  $('startText').textContent = `${names[0]}, ${names[1]} and ${names[2]} need help.`;
  $('startFriends').innerHTML = mission.friends.map(f => `<span>${f.icon}</span>`).join('');
  $('suitNote').textContent = ''; renderSuits();
  for (const id of ['finishCard', 'menu']) if ($(id).open) $(id).close();
  if (!$('startCard').open) $('startCard').showModal();
  sound.play(false);
}
function play() {
  $('startCard').close(); phase = 'play'; paused = false; holding = false; last = performance.now(); hintUntil = clock + 9; sound.play(true, mission.theme);
}
function pause() { if (phase !== 'play' || paused) return; paused = true; holding = false; sound.play(false); $('menu').showModal(); }
function resume() { $('menu').close(); paused = false; last = performance.now(); sound.play(true, mission.theme); }
async function setSound(on) {
  try { await sound.set(on); } catch { return; }
  if (save.sound !== sound.on) { save = normalizeSave({ ...save, sound: sound.on }); store(); }
  $('sound').setAttribute('aria-pressed', sound.on); $('sound').setAttribute('aria-label', sound.on ? 'Turn sound off' : 'Turn sound on');
  if (sound.on) sound.play(phase === 'play' && !paused, mission.theme);
}

/* ---------- camera and frame ---------- */
const view = { x: 0, y: 10 };
function frameCamera(immediate, dt = 0) {
  const aspect = innerWidth / innerHeight, tall = aspect < 1, far = Math.max(21, (tall ? 17.5 : 27) / aspect) / .849;
  const wantX = hero.x + (tall ? 3 : 7), wantY = Math.max(8.5, hero.y + (tall ? 5.5 : 4)), ease = immediate ? 1 : 1 - Math.exp(-3.2 * dt);
  view.x += (wantX - view.x) * (immediate ? 1 : 1 - Math.exp(-6 * dt)); view.y += (wantY - view.y) * ease;
  camera.position.set(view.x - far * .14, view.y + 1.5, far); camera.lookAt(view.x, view.y - 1, 0);
  scene.fog.near = far + 40; scene.fog.far = far + 190; sky.position.set(tall ? -13 : -44, tall ? 40 : 22, -120);
  sunLight.position.set(view.x + 30, 60, 40); sunLight.target.position.set(view.x, 0, 0);
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - (last || now)) / 1000, .05); last = now;
  if (phase === 'loading') return;
  if (!paused) {
    clock += dt;
    if (phase === 'play') {
      for (let left = dt; left > 1e-5; left -= 1 / 60) { const out = stepHero(mission, hero, holding, Math.min(left, 1 / 60)); hero = out.hero; happened(out.events); caught(gather(mission, hero)); if (phase !== 'play') break; }
    } else if (phase === 'done' && clock - doneAt > 2.6 && !$('finishCard').open) showFinish();
    if (phase === 'done' && !reduced && Math.floor(clock * 3) !== Math.floor((clock - dt) * 3)) burst(hero.x + (rand() - .5) * 16, hero.y + 6 + rand() * 7, 18, ['#ff7a45', '#ffd23f', '#58c7a0', '#5b8def', '#f2559c'], 9);
    poseHero(dt);
    // Stars spin; the one hook a rope would catch now bobs and glows.
    mission.stars.forEach((s, i) => { dummy.position.set(s.x, s.y + Math.sin(clock * 2 + i) * .15, 0); dummy.rotation.set(0, reduced ? 0 : clock * 2 + i, 0); dummy.scale.setScalar(s.taken ? 0 : s.big ? 1.25 : .7); dummy.updateMatrix(); starMesh.setMatrixAt(i, dummy.matrix); });
    starMesh.instanceMatrix.needsUpdate = true; dummy.rotation.set(0, 0, 0);
    const next = phase === 'play' && hero.mode !== 'swing' ? hookFor(mission, hero) : -1;
    hooks.forEach((h, i) => { const big = i === next || i === hero.hook ? 1.35 + Math.sin(clock * 9) * .12 : 1; h.children[0].scale.setScalar(big); h.position.y = mission.hooks[i].y + (reduced ? 0 : Math.sin(clock * 1.4 + i) * .12); });
    mission.friends.forEach((f, i) => { const s = friends[i]; if (f.taken) { const t = clock - (f.savedAt ?? clock - 9); s.visible = t < .7; s.position.y = f.y + t * 6; s.scale.setScalar(3 * Math.max(0, 1 - t / .7)); } else { s.visible = true; s.position.set(f.x, f.y + Math.sin(clock * 3 + i) * .18, .4); s.scale.setScalar(3 + Math.sin(clock * 5 + i) * .15); } });
    for (const p of mission.bouncers) if (p.model) p.model.scale.y = p === bouncePad ? 1 - Math.max(0, .5 - (clock - bounceAt) * 2) * Math.cos((clock - bounceAt) * 30) : 1;
    crowd.forEach(fan => { fan.position.y = mission.buildings.at(-1).top + 1.4 + Math.abs(Math.sin(clock * (phase === 'done' ? 8 : 3) + fan.userData.beat)) * (phase === 'done' ? 1.1 : .25); });
    cars.forEach(car => { car.position.x += car.userData.speed * dt; if (car.position.x > mission.length + 40) car.position.x = -40; if (car.position.x < -40) car.position.x = mission.length + 40; });
    clouds.forEach(c => { c.position.x += c.userData.speed * dt; });
    world.traverse(o => { if (o.userData.wave) o.rotation.y = Math.sin(clock * 4) * .25; });
    // Sparks fly out and fall.
    for (let i = spark.at.length - 1; i >= 0; i--) { spark.life[i].t -= dt; if (spark.life[i].t <= 0) { spark.at.splice(i, 1); spark.go.splice(i, 1); spark.life.splice(i, 1); continue; } spark.go[i].y -= 14 * dt; spark.at[i].addScaledVector(spark.go[i], dt); }
    for (let i = 0; i < 160; i++) { if (i < spark.at.length) { dummy.position.copy(spark.at[i]); dummy.scale.setScalar(.22 * Math.min(1, spark.life[i].t * 2.5)); sparks.setColorAt(i, paint.set(spark.life[i].c)); } else dummy.scale.setScalar(0); dummy.updateMatrix(); sparks.setMatrixAt(i, dummy.matrix); }
    sparks.instanceMatrix.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true; dummy.scale.setScalar(1);
    frameCamera(false, dt);
  }
  if (clock > toastUntil) $('toast').classList.remove('show');
  $('hint').classList.toggle('show', phase === 'play' && !paused && clock < hintUntil);
  renderer.render(scene, camera);
}

/* ---------- input ---------- */
function setup() {
  const press = e => { if (phase !== 'play' || paused) return; e.preventDefault?.(); holding = true; }, release = () => { holding = false; };
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture?.(e.pointerId); press(e); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
  addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'ArrowUp') { if (phase === 'play' && !paused) e.preventDefault(); if (!e.repeat) press(e); } else if (e.key === 'Escape' && phase === 'play' && !paused) { e.preventDefault(); pause(); } });
  addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'ArrowUp') release(); });
  // A player who chose sound last time gets it back with the first tap or key press.
  let woke = false; const wake = e => { if (woke || !save.sound || e.target?.closest?.('#sound')) return; woke = true; setSound(true); };
  for (const name of ['pointerup', 'keydown']) addEventListener(name, wake);
  $('sound').addEventListener('click', () => { woke = true; setSound(!sound.on); });
  $('pause').addEventListener('click', pause); $('resume').addEventListener('click', resume);
  $('restart').addEventListener('click', () => openMission(mission.number));
  $('play').addEventListener('click', () => { sound.tap(); play(); });
  $('next').addEventListener('click', () => { sound.tap(); openMission(save.missions + 1); });
  $('suits').addEventListener('click', e => {
    const b = e.target.closest('[data-suit]'); if (!b) return;
    const suit = SUITS.find(s => s.id === b.dataset.suit), had = save.owned.includes(suit.id), before = save.suit; save = chooseSuit(save, suit.id); store();
    $('suitNote').textContent = save.suit !== suit.id ? `${suit.cost - save.stars} more stars for the ${suit.name} suit` : suit.cost && !had ? `You unlocked the ${suit.name} suit!` : '';
    if (save.suit !== before) sound.tap(); dressHero(); renderSuits();
  });
  for (const id of ['startCard', 'finishCard']) $(id).addEventListener('cancel', e => e.preventDefault());
  $('menu').addEventListener('cancel', e => { e.preventDefault(); resume(); });
  addEventListener('blur', () => { holding = false; pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { holding = false; pause(); } });
  addEventListener('pagehide', store);
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); });
}
function fail() { phase = 'loading'; $('loading').classList.remove('done'); $('loadText').textContent = 'Please reload the page to play.'; }
function init() {
  setup();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); scene.fog = new THREE.Fog('#dff2fd', 60, 220);
    camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, .5, 600); scene.add(camera);
    airLight = new THREE.HemisphereLight('#fff6dc', '#5c7f6b', 1.9); scene.add(airLight);
    sunLight = new THREE.DirectionalLight('#fff4dc', 2.5); sunLight.castShadow = true; sunLight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunLight.shadow.camera, { left: -45, right: 45, top: 45, bottom: -25, far: 160 }); sunLight.shadow.bias = -.0004; sunLight.shadow.normalBias = .05; scene.add(sunLight, sunLight.target);
    sky = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthWrite: false, depthTest: false })); sky.scale.setScalar(26); sky.position.set(-28, 22, -120); sky.renderOrder = -1; camera.add(sky);
    heroModel = makeHero(); scene.add(heroModel.g);
    rope = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1, 6), mat('#fff3c4', { roughness: .5 })); ropeEnd = new THREE.Mesh(STAR, mat('#ffd23f', { emissive: '#b97a00', emissiveIntensity: .6 })); ropeEnd.scale.setScalar(.45); rope.visible = ropeEnd.visible = false; scene.add(rope, ropeEnd);
    sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), new THREE.MeshBasicMaterial(), 160); sparks.frustumCulled = false; sparks.setColorAt(0, paint.set('#fff')); scene.add(sparks);
    // For checking the game by hand from the browser console.
    window.citySwinger = { get hero() { return hero; }, get mission() { return mission; }, get save() { return save; }, get phase() { return phase; }, sound, hold(on) { holding = on; } };
    openMission(save.missions + 1);
    $('loading').classList.add('done'); $('loading').inert = true;
    requestAnimationFrame(animate);
  } catch (error) { console.error('City Swinger could not start', error); fail(); }
}
init();
