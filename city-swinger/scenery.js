// Draws the city for one mission: buildings with shops and busy roofs, the street and its
// life, hooks, trampolines, stars, friends, the finish, and everything in the distance.
// Where things are comes from the mission (swing.js); this file only draws and animates.
import * as THREE from 'three';
import { STAR, outlined } from './hero.js?v=3';

const WALLS = ['#ff9aa2', '#ffd166', '#8ecae6', '#b5e48c', '#cdb4f0', '#ffb37a', '#7fd6c2'];
const ROOFS = ['#e0565f', '#e59a1f', '#3f88c5', '#5fae4e', '#8e6fd1', '#e0703a', '#2fa58e'];
const CAR_COLORS = ['#eb5a46', '#ffc93c', '#3f9fe0', '#ffffff', '#58c7a0', '#f2559c'], CROWD = ['bear', 'cat', 'dog', 'duck', 'elephant', 'frog', 'giraffe', 'lion', 'owl', 'panda', 'penguin', 'turtle'];
const SHOPS = [['🍞', '#f4a261', 'BAKERY'], ['🍦', '#ef6f9f', 'ICE CREAM'], ['📚', '#4f86c6', 'BOOKS'], ['🧸', '#9b6fd3', 'TOYS'], ['🌷', '#4caf7a', 'FLOWERS'], ['🍕', '#e76f51', 'PIZZA']];
// How each time of day is lit. `lit` is how brightly windows and lamps glow.
export const LOOK = {
  day: { fog: '#dff2fd', sun: '#fff4dc', power: 2.6, sky: '#ffffff', ground: '#6f9a80', air: 2.0, lit: 0, far: '#cfe3f2', grass: '#8fd67c', cloud: '#ffffff' },
  sunset: { fog: '#ffdfa6', sun: '#ffb37a', power: 2.2, sky: '#ffd9b0', ground: '#8a6072', air: 1.7, lit: .45, far: '#f1b79a', grass: '#bfc86f', cloud: '#ffd3b8' },
  night: { fog: '#4d4ba0', sun: '#aab8ff', power: .9, sky: '#8f9dff', ground: '#1d2452', air: .95, lit: 1, far: '#3c3e88', grass: '#2f3f78', cloud: '#7a7dcc' }
};
const rand = (() => { let n = 4242; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const canvasOf = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const tiled = (w, h, draw) => { const t = canvasOf(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: .75, ...more });
const rounded = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
// A soft dot of light, for glows.
const DOT = canvasOf(64, 64, g => { const f = g.createRadialGradient(32, 32, 0, 32, 32, 32); f.addColorStop(0, '#ffffffee'); f.addColorStop(.4, '#ffffff66'); f.addColorStop(1, '#ffffff00'); g.fillStyle = f; g.fillRect(0, 0, 64, 64); });

// One tile of wall, 8 wide and 6.4 tall: two framed windows with a sill, and now and then a curtain or a flower box.
function wallMaterial(i, lit) {
  const map = tiled(256, 256, g => {
    g.fillStyle = WALLS[i]; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffffff22'; g.fillRect(0, 0, 256, 10); g.fillStyle = '#00000014'; g.fillRect(0, 244, 256, 12);
    [34, 150].forEach((x, k) => {
      g.fillStyle = '#fffaf0'; rounded(g, x - 8, 52, 88, 136, 12); g.fill();
      const pane = g.createLinearGradient(0, 60, 0, 180); pane.addColorStop(0, '#9fd3f5'); pane.addColorStop(1, '#4f86c6'); g.fillStyle = pane; rounded(g, x, 60, 72, 120, 8); g.fill();
      g.fillStyle = '#ffffff66'; g.beginPath(); g.moveTo(x + 8, 60); g.lineTo(x + 34, 60); g.lineTo(x + 8, 110); g.fill();
      g.fillStyle = '#fffaf0'; g.fillRect(x + 33, 60, 6, 120); g.fillRect(x, 116, 72, 6);
      if ((k + i) % 2) { g.fillStyle = ROOFS[i]; g.fillRect(x - 10, 186, 92, 14); g.fillStyle = '#4caf50'; for (let f = 0; f < 5; f++) { g.beginPath(); g.arc(x + 2 + f * 17, 184, 9, 0, Math.PI * 2); g.fill(); } g.fillStyle = ['#ff5d8f', '#ffd23f', '#ffffff'][i % 3]; for (let f = 0; f < 5; f++) { g.beginPath(); g.arc(x + 2 + f * 17, 180, 4, 0, Math.PI * 2); g.fill(); } }
      else { g.fillStyle = '#e8e2d2'; g.fillRect(x - 10, 186, 92, 9); }
    });
  });
  const glow = tiled(256, 256, g => { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff'; if (i % 2) g.fillRect(34, 60, 72, 120); g.fillRect(150, 60, 72, 120); });
  map.repeat.set(1 / 8, -1 / 6.4); glow.repeat.set(1 / 8, -1 / 6.4);   // the wall's own measure runs downward, so the tile is turned to stand upright
  return new THREE.MeshStandardMaterial({ map, roughness: .7, emissive: '#ffd98a', emissiveMap: glow, emissiveIntensity: lit * .9 });
}
// A shop front for the ground floor: a door, a big window and a sign.
const shopFront = (k, lit) => new THREE.MeshStandardMaterial({ roughness: .6, emissive: '#fff1c4', emissiveIntensity: lit * .35, map: canvasOf(512, 192, (g, w, h) => {
  const [icon, color, name] = SHOPS[k]; g.fillStyle = '#fff6e6'; g.fillRect(0, 0, w, h); g.fillStyle = color; g.fillRect(0, 0, w, 44); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, w / 2, 24);
  g.fillStyle = color; rounded(g, 40, 62, 100, 130, 10); g.fill(); g.fillStyle = '#bfe3f7'; rounded(g, 54, 76, 72, 58, 8); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(124, 138, 6, 0, Math.PI * 2); g.fill();
  const pane = g.createLinearGradient(0, 62, 0, 170); pane.addColorStop(0, '#cdeaf9'); pane.addColorStop(1, '#8cc4e8'); g.fillStyle = pane; rounded(g, 180, 62, 292, 110, 12); g.fill();
  g.fillStyle = '#ffffff77'; g.beginPath(); g.moveTo(196, 62); g.lineTo(250, 62); g.lineTo(196, 130); g.fill(); g.font = '70px serif'; g.fillText(icon, 326, 124);
  g.fillStyle = '#00000012'; g.fillRect(0, 178, w, 14);
}) });
const awningCloth = color => tiled(64, 64, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = color; g.fillRect(0, 0, 32, 64); });
function block(wide, deep, tall, corner = 1) {
  const s = new THREE.Shape(), w = wide / 2, d = deep / 2, r = Math.min(corner, w - .1, d - .1);
  s.moveTo(-w + r, -d); s.lineTo(w - r, -d); s.quadraticCurveTo(w, -d, w, -d + r); s.lineTo(w, d - r); s.quadraticCurveTo(w, d, w - r, d); s.lineTo(-w + r, d); s.quadraticCurveTo(-w, d, -w, d - r); s.lineTo(-w, -d + r); s.quadraticCurveTo(-w, -d, -w + r, -d);
  const g = new THREE.ExtrudeGeometry(s, { depth: tall, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); return g;
}

export function buildCity({ scene, camera, mission, reduced }) {
  const look = LOOK[mission.theme], world = new THREE.Group(), long = mission.length + 160, mid = mission.length / 2, lit = look.lit;
  scene.add(world);
  const add = (geometry, material, x, y, z, parent = world, shadow = true) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
  const flat = (wide, deep, material, x, y, z) => { const m = add(new THREE.PlaneGeometry(wide, deep), material, x, y, z, world, false); m.rotation.x = -Math.PI / 2; return m; };
  const white = mat('#fffaf0'), dark = mat('#4a5360'), leaf = mat('#3fa55a'), leaf2 = mat('#63c26b'), trunk = mat('#8a5a34'), red = mat('#ef5a45'), gold = mat('#ffc928', { emissive: '#a86a00', emissiveIntensity: .5, roughness: .35 }), glass = mat('#bfe3f7', { roughness: .25 });
  const lamps = mat('#fff3c4', { emissive: '#ffe08a', emissiveIntensity: .25 + lit * 1.6 }), movers = { cars: [], clouds: [], balloons: [], birds: [], rotors: [], waves: [], watchers: [], crowd: [], rays: null, blimp: null };

  /* ---------- ground ---------- */
  const lanes = tiled(256, 64, g => { g.fillStyle = '#5b636e'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f4f1e6'; g.fillRect(40, 28, 110, 8); }); lanes.repeat.set(long / 12, 1);
  flat(long, 26, new THREE.MeshStandardMaterial({ color: '#5b636e', roughness: .95 }), mid, -.03, 2);
  flat(long, 2.2, new THREE.MeshStandardMaterial({ map: lanes, roughness: .95 }), mid, -.01, 9.6);
  for (const [deep, z] of [[260, -141], [100, 65]]) flat(long + 320, deep, mat(look.grass, { roughness: 1 }), mid, -.06, z);
  const zebra = tiled(64, 64, g => { g.fillStyle = '#5b636e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#f4f1e6'; g.fillRect(0, 8, 64, 30); }); zebra.repeat.set(1, 1);

  /* ---------- buildings ---------- */
  const walls = WALLS.map((_, i) => wallMaterial(i, lit)), roofs = ROOFS.map(c => mat(c, { roughness: .8 })), awnings = ROOFS.map(c => new THREE.MeshStandardMaterial({ map: awningCloth(c), roughness: .8 })), shops = SHOPS.map((_, k) => shopFront(k, lit));
  const paving = mat('#efe7d6', { roughness: .9 }), kerb = mat('#cfc6b3');
  mission.buildings.forEach((b, n) => {
    const wide = b.x1 - b.x0, x = (b.x0 + b.x1) / 2, style = (b.style + n) % WALLS.length, deep = 12, front = 3;
    add(block(wide, deep, b.top, 1.1), [roofs[style], walls[style]], x, 0, -3);
    add(block(wide + .7, deep + .7, .5, 1.3), roofs[style], x, b.top - .5, -3);                                    // the roof's edge, level with where the hero runs
    add(new THREE.BoxGeometry(wide - 1.6, .1, deep - 2), mat('#e9e2d0', { roughness: 1 }), x, b.top - .03, -3, world, false);
    // A shop at street level with a striped awning.
    add(new THREE.PlaneGeometry(Math.min(wide - 2.4, 9.5), 3.5), shops[(n + mission.number) % SHOPS.length], x, 1.75, front + .03, world, false);
    const shade = add(new THREE.BoxGeometry(Math.min(wide - 2, 10), .14, 2), awnings[style], x, 3.85, front + .85); shade.rotation.x = .35; shade.material.map.repeat.set(Math.min(wide - 2, 10) / 1.4, 1);
    add(new THREE.BoxGeometry(wide + .8, .18, 2.6), paving, x, .09, front + 1.4, world, false); add(new THREE.BoxGeometry(wide + .8, .2, .22), kerb, x, .1, front + 2.8, world, false);
    // A lamp and a tree by the kerb.
    add(new THREE.CylinderGeometry(.09, .12, 4.4, 8), dark, b.x0 + 1.3, 2.2, front + 2.2); add(new THREE.SphereGeometry(.36, 12, 10), lamps, b.x0 + 1.3, 4.55, front + 2.2, world, false);
    if (lit > .3) { const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#ffe08a', transparent: true, opacity: .55 * lit, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(4.5); halo.position.set(b.x0 + 1.3, 4.55, front + 2.2); world.add(halo); }
    add(new THREE.CylinderGeometry(.2, .26, 1.7, 7), trunk, b.x1 - 1.6, 1, front + 2.1); add(new THREE.SphereGeometry(1.25, 10, 8), leaf, b.x1 - 1.6, 2.7, front + 2.1); add(new THREE.SphereGeometry(.85, 10, 8), leaf2, b.x1 - 1.1, 3.5, front + 2.3);
    // A friend on the pavement, looking up; they hop as the hero goes by.
    if (n % 2 === 0 && !b.finish) { const who = sprite(`../memory-assets/${CROWD[(n * 5 + mission.number) % CROWD.length]}.png`, 2.3); who.position.set(x + 2.4, 1.3, front + 1.5); who.userData = { x: x + 2.4, base: 1.3, beat: n }; world.add(who); movers.watchers.push(who); }
    if (b.finish) return;
    // Something different on every roof, set back out of the hero's way.
    const kind = (n + mission.number) % 6, back = -6.6, top = b.top;
    if (kind === 0) { add(new THREE.CylinderGeometry(1.5, 1.5, 2.4, 14), mat('#c98a4b'), x + 1, top + 2.2, back); add(new THREE.ConeGeometry(1.8, 1.2, 14), dark, x + 1, top + 4, back); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.CylinderGeometry(.09, .09, 1.1, 5), dark, x + 1 + dx, top + .5, back + dz); }
    else if (kind === 1) { add(new THREE.BoxGeometry(wide * .6, .5, 4), mat('#7a5a3a'), x, top + .25, back); for (let i = 0; i < 4; i++) { add(new THREE.SphereGeometry(1 + (i % 2) * .25, 9, 7), i % 2 ? leaf2 : leaf, x - wide * .22 + i * wide * .15, top + 1.3, back); add(new THREE.SphereGeometry(.2, 6, 5), mat(['#ff5d8f', '#ffd23f', '#ffffff', '#ff8a3d'][i]), x - wide * .2 + i * wide * .15, top + 2.2 + (i % 2) * .3, back + .7, world, false); } }
    else if (kind === 2) { const sign = canvasOf(512, 256, (g, w, h) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h); g.fillStyle = '#ef5a45'; g.fillRect(14, 14, w - 28, h - 28); g.fillStyle = '#fff'; g.font = 'bold 86px sans-serif'; g.textAlign = 'center'; g.fillText('GO VIAAN!', w / 2, 120); g.font = '70px serif'; g.fillText('⭐ 🦸 ⭐', w / 2, 210); }); add(new THREE.BoxGeometry(6.4, 3.2, .3), new THREE.MeshStandardMaterial({ map: sign, emissive: '#ffffff', emissiveMap: sign, emissiveIntensity: lit * .5 }), x, top + 3, back); for (const dx of [-2.4, 2.4]) add(new THREE.CylinderGeometry(.12, .12, 1.6, 6), dark, x + dx, top + .8, back); }
    else if (kind === 3) { for (const dx of [-3, 3]) add(new THREE.CylinderGeometry(.09, .09, 2.6, 6), white, x + dx, top + 1.3, back); add(new THREE.CylinderGeometry(.03, .03, 6, 4), dark, x, top + 2.5, back).rotation.z = Math.PI / 2; ['#ff5d8f', '#3f9fe0', '#ffd23f', '#58c7a0', '#ffffff'].forEach((c, i) => { const cloth = add(new THREE.PlaneGeometry(.8, 1 + (i % 2) * .3), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }), x - 2.2 + i * 1.1, top + 1.9 - (i % 2) * .15, back, world, false); cloth.userData.sway = i; movers.waves.push(cloth); }); }
    else if (kind === 4) { const dish = add(new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5), white, x + 1.5, top + 1.5, back); dish.rotation.x = Math.PI * .75; add(new THREE.CylinderGeometry(.1, .1, 1.3, 6), dark, x + 1.5, top + .65, back); for (const dx of [-2.6, -1]) add(new THREE.BoxGeometry(1.5, 1.1, 1.4), dark, x + dx, top + .55, back); }
    else { add(new THREE.BoxGeometry(4.6, 2.2, 3), glass, x, top + 1.1, back); add(new THREE.BoxGeometry(5, .25, 3.4), white, x, top + 2.3, back); for (const dx of [-1.4, 0, 1.4]) add(new THREE.SphereGeometry(.6, 8, 6), leaf2, x + dx, top + .7, back + .2, world, false); }
    // A zebra crossing over the street in the gap beyond this building.
    const next = mission.buildings[n + 1]; if (next) { const gap = next.x0 - b.x1, cross = flat(gap - 2, 2.4, new THREE.MeshStandardMaterial({ map: zebra.clone(), roughness: .95 }), b.x1 + gap / 2, -.005, front + 1.4); cross.material.map.repeat.set((gap - 2) / 1.3, 1); cross.material.map.rotation = Math.PI / 2; cross.material.map.needsUpdate = true; }
  });

  /* ---------- the finish: an arch, bunting and a cheering crowd ---------- */
  const end = mission.buildings.at(-1), fx = mission.finish.x;
  const arch = canvasOf(512, 128, (g, w, h) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#fff' : '#22314a'; g.fillRect(x * 32, y * 20, 32, 20); } g.fillStyle = '#ff7a45'; g.fillRect(0, 40, w, 88); g.fillStyle = '#fff'; g.font = 'bold 74px sans-serif'; g.textAlign = 'center'; g.fillText('FINISH', w / 2, 108); });
  for (const dx of [-4.6, 4.6]) add(new THREE.CylinderGeometry(.22, .22, 7, 10), white, fx + 3 + dx, end.top + 3.5, -1.2);
  add(new THREE.BoxGeometry(9.6, 2.3, .2), new THREE.MeshStandardMaterial({ map: arch, emissive: '#fff', emissiveMap: arch, emissiveIntensity: lit * .4 }), fx + 3, end.top + 6.6, -1.2);
  ['#ef5a45', '#ffd23f', '#3f9fe0', '#58c7a0', '#f2559c', '#ffffff', '#ff9f1c'].forEach((c, i) => { const flag = add(new THREE.ConeGeometry(.42, .8, 3), mat(c), fx - .9 + i * 1.3, end.top + 5 - Math.sin(i / 6 * Math.PI) * .6, -1.1, world, false); flag.rotation.z = Math.PI; });
  for (let i = 0; i < 8; i++) { const fan = sprite(`../memory-assets/${CROWD[(mission.number * 3 + i) % CROWD.length]}.png`, 3); fan.position.set(end.x0 + 1.8 + i * 2.3, end.top + 1.5, i % 2 ? -2.6 : -4.4); fan.userData = { base: end.top + 1.5, beat: i * .9 }; world.add(fan); movers.crowd.push(fan); }

  /* ---------- hooks: a golden ring over each gap, held by a crane, a bunch of balloons or a little drone ---------- */
  const ring = new THREE.TorusGeometry(1, .22, 10, 26), hooks = [];
  const stripes = tiled(32, 64, g => { g.fillStyle = '#ffb000'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#2a1f3d'; g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 16); g.lineTo(32, 32); g.lineTo(0, 16); g.fill(); g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 48); g.lineTo(32, 64); g.lineTo(0, 48); g.fill(); });
  mission.hooks.forEach(h => {
    const group = new THREE.Group(); group.position.set(h.x, h.y, 0); world.add(group);
    const loop = outlined(add(ring, gold, 0, 0, 0, group), 1.0); loop.children[0].scale.set(1.06, 1.06, 1.5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT, color: '#ffd23f', transparent: true, opacity: .0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(7); group.add(halo);
    if (h.kind === 'balloon') [['#ef5a45', -1.2, 3.6], ['#3f9fe0', 0, 4.6], ['#ffc93c', 1.2, 3.7]].forEach(([color, dx, dy]) => { const balloon = add(new THREE.SphereGeometry(1.25, 16, 12), mat(color, { roughness: .25 }), dx, dy, 0, group); balloon.scale.y = 1.2; add(new THREE.SphereGeometry(.28, 8, 6), white, dx - .4, dy + .5, .95, group, false).scale.set(1, 1.4, .3); const string = add(new THREE.CylinderGeometry(.03, .03, dy - 1.3, 4), white, dx / 2, (dy + .5) / 2, 0, group, false); string.rotation.z = Math.atan2(-dx, dy); });
    else if (h.kind === 'flag') {                       // a friendly drone
      const drone = new THREE.Group(); drone.position.y = 2.6; group.add(drone); outlined(add(new THREE.SphereGeometry(.95, 16, 12), white, 0, 0, 0, drone), 1.06).scale.set(1.25, .8, 1);
      for (const side of [-1, 1]) { add(new THREE.SphereGeometry(.15, 8, 6), dark, side * .35, .1, .82, drone, false); add(new THREE.CylinderGeometry(.06, .06, .5, 6), dark, side * 1.2, .6, 0, drone, false); const rotor = add(new THREE.BoxGeometry(1.9, .06, .22), mat('#3f9fe0'), side * 1.2, .9, 0, drone, false); movers.rotors.push(rotor); }
      add(new THREE.TorusGeometry(.22, .04, 6, 10, Math.PI), dark, 0, -.15, .86, drone, false).rotation.z = Math.PI; add(new THREE.CylinderGeometry(.03, .03, 1.7, 4), dark, 0, 1.4, 0, group, false);
    } else { const mast = new THREE.MeshStandardMaterial({ map: stripes.clone(), roughness: .7 }); mast.map.repeat.set(1, (h.y + 3.6) / 2.4); add(new THREE.BoxGeometry(.8, h.y + 3.6, .8), mast, h.x, (h.y + 3.6) / 2, -8.4); add(new THREE.BoxGeometry(.55, .55, 11), mat('#ffb000'), h.x, h.y + 3.2, -3.4); add(new THREE.BoxGeometry(1.6, 1.4, 1.6), mat('#ffb000'), h.x, h.y + 2.4, -8.4); add(new THREE.CylinderGeometry(.05, .05, 2.2, 5), dark, h.x, h.y + 2.1, 0, world, false); }
    group.userData = { loop, halo }; hooks.push(group);
  });

  /* ---------- trampolines ---------- */
  const padTop = canvasOf(256, 256, g => { g.fillStyle = '#3f9fe0'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 26 : 60; g[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill(); });
  mission.bouncers.forEach(p => {
    const pad = new THREE.Group(), half = (p.x1 - p.x0) / 2; pad.position.set((p.x0 + p.x1) / 2, 0, 0); world.add(pad);
    add(new THREE.CylinderGeometry(1, 1, .3, 30), [mat('#3f9fe0'), new THREE.MeshStandardMaterial({ map: padTop, roughness: .5 }), mat('#3f9fe0')], 0, .95, 0, pad).scale.set(half, 1, 2.7);
    add(new THREE.CylinderGeometry(1, 1, .42, 30), red, 0, .82, 0, pad).scale.set(half + .32, 1, 3);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.CylinderGeometry(.09, .09, .8, 5), dark, Math.cos(a) * (half - .2), .4, Math.sin(a) * 2.5, pad, false); }
    p.model = pad;
  });

  /* ---------- stars, with a dark edge so they stand out against any sky ---------- */
  const starMesh = new THREE.InstancedMesh(STAR, mat('#ffd23f', { emissive: '#c98a00', emissiveIntensity: .6, roughness: .3 }), mission.stars.length), starEdge = new THREE.InstancedMesh(STAR, new THREE.MeshBasicMaterial({ color: '#2a1f3d', side: THREE.BackSide }), mission.stars.length);
  starMesh.frustumCulled = starEdge.frustumCulled = false; world.add(starMesh, starEdge);

  /* ---------- friends: each in a shiny bubble, calling for help ---------- */
  const friends = mission.friends.map(f => {
    const picture = canvasOf(160, 160, g => { const fill = g.createRadialGradient(60, 56, 10, 80, 80, 76); fill.addColorStop(0, '#ffffff'); fill.addColorStop(1, '#d9f1ff'); g.fillStyle = fill; g.beginPath(); g.arc(80, 80, 72, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#2a1f3d'; g.lineWidth = 7; g.stroke(); g.strokeStyle = '#ffb703'; g.lineWidth = 5; g.beginPath(); g.arc(80, 80, 64, 0, Math.PI * 2); g.stroke(); g.font = '88px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.icon, 80, 88); g.fillStyle = '#ffffffcc'; g.beginPath(); g.ellipse(52, 44, 16, 9, -.6, 0, Math.PI * 2); g.fill(); });
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: picture, fog: false })); bubble.scale.setScalar(3.4); bubble.position.set(f.x, f.y, .6); world.add(bubble);
    const call = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: canvasOf(192, 96, g => { g.fillStyle = '#fff'; rounded(g, 6, 6, 180, 62, 26); g.fill(); g.strokeStyle = '#2a1f3d'; g.lineWidth = 6; g.stroke(); g.beginPath(); g.moveTo(80, 66); g.lineTo(96, 92); g.lineTo(112, 66); g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#ef5a45'; g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.fillText('HELP!', 96, 51); }) })); call.scale.set(2.6, 1.3, 1); world.add(call);
    const b = mission.buildings.find(o => f.x > o.x0 - 1 && f.x < o.x1 + 1);
    if (f.place === 'perch' && b) { add(new THREE.BoxGeometry(1.7, f.y - b.top - 1.4, 1.7), red, f.x, b.top + (f.y - b.top - 1.4) / 2 + .3, -1.8); add(new THREE.BoxGeometry(2.1, .3, 2.1), dark, f.x, f.y - 1.2, -1.8); }
    if (f.place === 'hang') { const hook = mission.hooks.reduce((best, h) => Math.abs(h.x - f.x) < Math.abs(best.x - f.x) ? h : best); const string = add(new THREE.CylinderGeometry(.04, .04, Math.max(.2, hook.y - f.y - 2.4), 5), white, f.x, (hook.y + f.y) / 2, 0, world, false); bubble.userData.string = string; }
    return { bubble, call, at: new THREE.Vector3(f.x, f.y, .6) };
  });

  /* ---------- the distance: two skylines, hills, clouds, balloons, birds, a blimp and the sun ---------- */
  const dots = tiled(64, 64, g => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.fillStyle = lit > .5 ? '#ffe08a' : '#00000022'; for (const x of [10, 38]) for (const y of [10, 38]) g.fillRect(x, y, 16, 16); });
  const nearSky = WALLS.map(c => { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c).lerp(new THREE.Color(look.far), .5), map: dots.clone(), roughness: 1, emissive: '#ffd98a', emissiveIntensity: lit * .25 }); return m; }), farSky = mat(look.far, { roughness: 1 });
  for (let i = 0; i < Math.ceil((long + 100) / 9); i++) { const tall = 12 + rand() * 30, wide = 7 + rand() * 7, m = nearSky[i % nearSky.length].clone(); m.map = dots.clone(); m.map.repeat.set(1 / 3.2, -1 / 3.2); add(block(wide, wide, tall, .8), [farSky, m], -110 + i * 9 + rand() * 4, 0, -44 - rand() * 22, world, false); }
  for (let i = 0; i < Math.ceil((long + 240) / 13); i++) { const tall = 18 + rand() * 40, wide = 9 + rand() * 9; add(new THREE.BoxGeometry(wide, tall, wide), farSky, -180 + i * 13 + rand() * 5, tall / 2, -96 - rand() * 40, world, false); }
  for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(1, 16, 10), mat(look.grass, { roughness: 1 }), -120 + i * (long + 200) / 6, -8, -190, world, false).scale.set(70 + rand() * 30, 26 + rand() * 12, 30);
  const puff = new THREE.SphereGeometry(1, 12, 9), cloudy = mat(look.cloud, { roughness: 1, emissive: look.cloud, emissiveIntensity: .12 });
  for (let i = 0; i < 16; i++) { const cloud = new THREE.Group(), near = i % 4 === 0; cloud.position.set(-80 + i * (long + 100) / 15 + rand() * 20, (near ? 30 : 34) + rand() * 26, near ? -24 - rand() * 8 : -60 - rand() * 50); for (let j = 0; j < 5; j++) add(puff, cloudy, (j - 2) * 3.2, j % 2 ? 1.6 : (j === 2 ? 2.2 : 0), 0, cloud, false).scale.set(3.6 + rand() * 2, 2.4 + rand() * 1.2, 2.8); cloud.scale.setScalar(near ? .7 : 1 + rand() * .5); cloud.userData.speed = .5 + rand(); world.add(cloud); movers.clouds.push(cloud); }
  // Hot-air balloons drifting by.
  [['#ef5a45', '#ffd23f'], ['#3f9fe0', '#ffffff'], ['#9b6fd3', '#ffd23f'], ['#58c7a0', '#ffffff']].forEach(([a, b], i) => {
    const cloth = tiled(64, 64, g => { g.fillStyle = a; g.fillRect(0, 0, 64, 64); g.fillStyle = b; g.fillRect(0, 0, 32, 64); }); cloth.repeat.set(6, 1);
    const balloon = new THREE.Group(); add(new THREE.SphereGeometry(4.2, 20, 14), new THREE.MeshStandardMaterial({ map: cloth, roughness: .6 }), 0, 0, 0, balloon, false).scale.y = 1.2; add(new THREE.ConeGeometry(2.6, 3, 14, 1, true), mat(a), 0, -5.2, 0, balloon, false).rotation.x = Math.PI; add(new THREE.BoxGeometry(1.5, 1.2, 1.5), mat('#b98253'), 0, -8, 0, balloon, false);
    balloon.position.set(20 + i * (mission.length / 3.4) + rand() * 20, 30 + rand() * 14, -30 - rand() * 12); balloon.userData = { y: balloon.position.y, beat: i * 1.7 }; world.add(balloon); movers.balloons.push(balloon);
  });
  // Birds in a little flock.
  for (let f = 0; f < 3; f++) { const flock = new THREE.Group(); flock.position.set(rand() * mission.length, 24 + rand() * 12, -14 - rand() * 8); for (let i = 0; i < 5; i++) { const bird = new THREE.Group(); bird.position.set(-Math.abs(i - 2) * 1.4, -Math.abs(i - 2) * .3, (i - 2) * 1.5); for (const side of [-1, 1]) { const wing = add(new THREE.ConeGeometry(.22, 1.2, 3), mat(mission.theme === 'night' ? '#cfd3ff' : '#ffffff'), 0, 0, side * .5, bird, false); wing.rotation.x = side * Math.PI / 2; wing.userData.side = side; } flock.add(bird); } flock.userData.speed = 5 + rand() * 3; world.add(flock); movers.birds.push(flock); }
  const banner = tiled(512, 256, g => { g.fillStyle = '#ffd24a'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#ef5a45'; g.fillRect(0, 92, 512, 72); g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; for (const x of [128, 384]) g.fillText('SUPER VIAAN', x, 144); });
  const blimp = new THREE.Group(); add(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshStandardMaterial({ map: banner, roughness: .5 }), 0, 0, 0, blimp, false).scale.set(11, 4, 4); add(new THREE.BoxGeometry(4, 1.2, 1.6), white, 0, -4.2, 0, blimp, false); for (const [w, h] of [[.3, 5.5], [5.5, .3]]) add(new THREE.BoxGeometry(2.6, h, w), red, -9.6, 0, 0, blimp, false);
  blimp.position.set(mid * .4, 40, -36); world.add(blimp); movers.blimp = blimp;
  if (mission.theme === 'day') ['#ed7767', '#f6b451', '#f2da74', '#81bd86', '#69babe', '#9b8fd9'].forEach((c, i) => { add(new THREE.TorusGeometry(70 - i * 2.4, 1.3, 6, 60, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .55, fog: false }), mid, -4, -170, world, false); });
  // Cars and a bus go by on the road in front.
  for (let i = 0; i < 8; i++) {
    const bus = i === 3, car = new THREE.Group(), body = bus ? 6.4 : 3.3, color = bus ? '#ffc93c' : CAR_COLORS[i % CAR_COLORS.length];
    add(new THREE.BoxGeometry(body, bus ? 1.9 : .95, 1.8), mat(color, { roughness: .45 }), 0, bus ? 1.45 : .85, 0, car); if (!bus) add(new THREE.BoxGeometry(1.8, .8, 1.6), glass, -.15, 1.6, 0, car); else add(new THREE.BoxGeometry(5.6, .7, 1.84), glass, 0, 1.75, 0, car, false);
    for (const dx of [-body * .32, body * .32]) for (const dz of [-.9, .9]) add(new THREE.CylinderGeometry(.42, .42, .3, 12), dark, dx, .42, dz, car, false).rotation.x = Math.PI / 2;
    if (lit > .3) for (const dz of [-.55, .55]) add(new THREE.SphereGeometry(.16, 6, 5), lamps, body / 2, .9, dz, car, false);
    const way = i % 2 ? 1 : -1; car.rotation.y = way > 0 ? 0 : Math.PI; car.position.set(rand() * mission.length, 0, way > 0 ? 8.4 : 10.9); car.userData.speed = way * (6 + rand() * 5); world.add(car); movers.cars.push(car);
  }
  // The sun (or moon) rides with the camera, with rays that slowly turn.
  const face = canvasOf(256, 256, g => {
    g.fillStyle = mission.theme === 'night' ? '#fff3c2' : mission.theme === 'sunset' ? '#ff8a3d' : '#ffe14d'; g.beginPath(); g.arc(128, 128, 96, 0, Math.PI * 2); g.fill();
    if (mission.theme === 'night') { g.fillStyle = '#f1dd9c'; for (const [x, y, r] of [[92, 96, 15], [168, 84, 9], [176, 160, 17]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } }
    g.strokeStyle = '#8a5a1e'; g.lineWidth = 7; g.lineCap = 'round'; for (const x of [98, 158]) { g.beginPath(); g.arc(x, 116, 13, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); } g.beginPath(); g.arc(128, 132, 34, .15 * Math.PI, .85 * Math.PI); g.stroke();
    g.fillStyle = '#ff9a7b88'; for (const x of [76, 180]) { g.beginPath(); g.arc(x, 146, 13, 0, Math.PI * 2); g.fill(); }
  });
  const sky = new THREE.Group(), sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: face, fog: false, depthWrite: false, depthTest: false })); sun.scale.setScalar(20); sky.add(sun);
  if (mission.theme !== 'night') { const rays = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, depthWrite: false, depthTest: false, transparent: true, opacity: .5, map: canvasOf(256, 256, g => { g.translate(128, 128); g.fillStyle = mission.theme === 'sunset' ? '#ffb347' : '#fff2a8'; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(-10, -70); g.lineTo(0, -126); g.lineTo(10, -70); g.fill(); } }) })); rays.scale.setScalar(36); rays.renderOrder = -2; sky.add(rays); movers.rays = rays; }
  sun.renderOrder = -1; sky.position.set(-28, 22, -120); camera.add(sky);

  function sprite(url, size) { const t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t })); s.scale.setScalar(size); return s; }
  const dummy = new THREE.Object3D(), follow = new THREE.Vector3();
  return {
    world, look, sky,
    // Called every frame. `next` is the hook a rope would catch now; `pad` and `padAt` say which trampoline was last bounced on.
    update({ dt, clock, hero, phase, next, pad, padAt }) {
      const still = reduced;
      mission.stars.forEach((s, i) => { dummy.position.set(s.x, s.y + (still ? 0 : Math.sin(clock * 2.4 + i) * .18), 0); dummy.rotation.set(0, still ? 0 : Math.sin(clock * 2 + i) * .7, 0); dummy.scale.setScalar(s.taken ? 0 : s.big ? 1.35 : .78); dummy.updateMatrix(); starMesh.setMatrixAt(i, dummy.matrix); dummy.scale.multiplyScalar(1.13); dummy.updateMatrix(); starEdge.setMatrixAt(i, dummy.matrix); });
      starMesh.instanceMatrix.needsUpdate = starEdge.instanceMatrix.needsUpdate = true; dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
      hooks.forEach((h, i) => { const live = i === next || i === hero.hook, u = h.userData; u.loop.scale.setScalar(live ? 1.3 + Math.sin(clock * 9) * .12 : 1); u.halo.material.opacity += ((live ? .75 : .18) - u.halo.material.opacity) * Math.min(1, dt * 8); h.position.y = mission.hooks[i].y + (still ? 0 : Math.sin(clock * 1.4 + i) * .14); });
      movers.rotors.forEach(r => { r.rotation.y += dt * 30; });
      // A friend waits and calls; once rescued it floats along behind the hero in its bubble.
      let line = 0;
      mission.friends.forEach((f, i) => {
        const model = friends[i];
        if (f.taken) { const k = line++; follow.set(hero.x - 2.2 - k * 2.6, hero.y + 4.2 + Math.sin(clock * 4 + k) * .3 + k * .5, .6); model.at.lerp(follow, 1 - Math.exp(-(5 - k) * dt)); model.call.visible = false; if (model.bubble.userData.string) model.bubble.userData.string.visible = false; model.bubble.scale.setScalar(2.5); }
        else { model.at.set(f.x, f.y + (still ? 0 : Math.sin(clock * 3 + i) * .2), .6); model.bubble.scale.setScalar(3.4 + (still ? 0 : Math.sin(clock * 5 + i) * .18)); model.call.position.set(f.x + .4, f.y + 2.5 + Math.sin(clock * 6 + i) * .12, .7); model.call.material.rotation = Math.sin(clock * 5 + i) * .12; }
        model.bubble.position.copy(model.at);
      });
      for (const p of mission.bouncers) if (p.model) p.model.scale.y = p === pad ? 1 - Math.max(0, .5 - (clock - padAt) * 2) * Math.cos((clock - padAt) * 30) : 1;
      const party = phase === 'done';
      movers.crowd.forEach(fan => { fan.position.y = fan.userData.base + Math.abs(Math.sin(clock * (party ? 8 : 3) + fan.userData.beat)) * (party ? 1.2 : .25); });
      movers.watchers.forEach(w => { const near = Math.abs(hero.x - w.userData.x) < 10; w.position.y = w.userData.base + (near ? Math.abs(Math.sin(clock * 9 + w.userData.beat)) * .7 : 0); });
      movers.cars.forEach(car => { car.position.x += car.userData.speed * dt; if (car.position.x > mission.length + 50) car.position.x = -50; if (car.position.x < -50) car.position.x = mission.length + 50; });
      movers.clouds.forEach(c => { c.position.x += c.userData.speed * dt; });
      movers.balloons.forEach(b => { b.position.x += .9 * dt; b.position.y = b.userData.y + Math.sin(clock * .6 + b.userData.beat) * 1.4; });
      movers.birds.forEach(flock => { flock.position.x += flock.userData.speed * dt; if (flock.position.x > mission.length + 60) flock.position.x = -60; flock.children.forEach((bird, i) => bird.children.forEach(wing => { wing.rotation.z = Math.sin(clock * 9 + i) * .7 * wing.userData.side; })); });
      movers.blimp.position.x += 1.6 * dt; if (movers.blimp.position.x > mission.length + 80) movers.blimp.position.x = -80;
      movers.waves.forEach(cloth => { cloth.rotation.x = Math.sin(clock * 3 + cloth.userData.sway) * .3; });
      if (movers.rays && !still) movers.rays.material.rotation = clock * .12;
    },
    dispose() { camera.remove(sky); scene.remove(world); world.traverse(o => { if (o.geometry && o.geometry !== STAR) o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { m.map?.dispose?.(); m.emissiveMap?.dispose?.(); m.dispose?.(); } }); DOT.needsUpdate = true; }
  };
}
